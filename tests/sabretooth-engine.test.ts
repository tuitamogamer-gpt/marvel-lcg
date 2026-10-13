/** Native dispatcher acceptance beyond the independent NPC boundary suite.
 * Fixtures move actual original-source pieces and hydrate every command. */
import { describe, expect, it } from "vitest";
import { abilityOptions, newGame } from "../src/game/engine.js";
import { statusCards } from "../src/game/keywords.js";
import { seatView } from "../src/game/team.js";
import { sabretoothKelly } from "../src/game/sabretooth.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  native,
  pay,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

function pieces(s: GameState): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...(s.sabretooth?.kelly ? [s.sabretooth.kelly] : []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ];
}
const ids = (s: GameState) =>
  pieces(s)
    .map((p) => p.id)
    .sort();
function conserved(s: GameState, original: string[]) {
  const actual = ids(s);
  expect(actual).toEqual(original);
  expect(new Set(actual).size).toBe(actual.length);
  return s;
}
function settle(s: GameState) {
  return finish(s, (v) =>
    /forced|order/i.test(v.prompt?.title || "")
      ? v.prompt?.options[0]?.id
      : undefined,
  );
}
function base(difficulty: "standard" | "expert" = "standard") {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "sabretooth",
    difficulty,
    seed: 320670,
    pacing: "expert",
  });
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  const source = [
    ...s.player.deck,
    ...s.player.hand,
    ...s.player.discard,
    ...s.player.inPlay,
  ];
  s.player.deck = source;
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.player.form = "hero";
  s.player.exhausted = false;
  s.player.tough = false;
  s.player.toughCards = 0;
  sabretoothKelly(s)!.damage = 0;
  return reload(s);
}
function takePlayer(
  s: GameState,
  code: string,
  destination: "hand" | "inPlay" = "hand",
) {
  for (const zone of [
    s.player.deck,
    s.player.hand,
    s.player.discard,
    s.player.inPlay,
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index < 0) continue;
    const p = zone.splice(index, 1)[0];
    s.player[destination].push(p);
    return p;
  }
  throw Error(`Original player source ${code} missing.`);
}
function takeEncounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Original encounter source ${code} missing.`);
}
function top(s: GameState, boost: string, regeneration = "32070") {
  const p = takeEncounter(s, boost),
    heal = takeEncounter(s, regeneration);
  s.encounter.deck.unshift(p, heal);
  return { boost: p, heal };
}
function rescue(s: GameState) {
  const find = s.sideSchemes.find((p) => p.code === "32065a")!;
  return settle(
    native(s, {
      type: "thwart",
      target: find.id,
      amount: find.counters,
      source: "hero",
    }),
  );
}
const attack = (s: GameState, modifier = 0) =>
  native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    activation: {
      enemyId: s.villain.id,
      playerId: s.activePlayerId,
      kind: "attack",
      modifier,
    },
  });

describe("Sabretooth native reveal, boost, payment and stage acceptance", () => {
  it("mandatory full-health regeneration discards the actual boost-star Claws without resolving it", () => {
    let s = base();
    const source = ids(s);
    const { heal } = top(s, "32070", "32067");
    s = settle(attack(s));
    expect(s.villain.hp).toBe(s.villain.maxHp);
    expect(s.encounter.discard.filter((p) => p.id === heal.id)).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === heal.id)).toBe(false);
    expect(s.sabretooth?.completedActivationIds).toHaveLength(1);
    conserved(s, source);
  });

  it("a Claws boost attaches that same piece, contributes +1 ATK once, and Pierces the identity's Tough", () => {
    let s = base();
    const source = ids(s);
    s.player.tough = true;
    s.player.toughCards = 1;
    const { boost } = top(s, "32067");
    s = settle(attack(s));
    expect(s.attachments.filter((p) => p.id === boost.id)).toHaveLength(1);
    expect(s.attachments.find((p) => p.id === boost.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.player.hp).toBe(7);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
    conserved(s, source);
  });

  it("a Ferocity boost attaches its actual card and native Stalwart rejects both status types", () => {
    let s = base();
    const source = ids(s);
    const { boost } = top(s, "32068");
    s = settle(attack(s));
    s = settle(
      native(
        s,
        { type: "status", target: s.villain.id, status: "stunned" },
        { type: "status", target: s.villain.id, status: "confused" },
      ),
    );
    expect(s.attachments.find((p) => p.id === boost.id)?.code).toBe("32068");
    expect(statusCards(s.villain, "stunned")).toBe(0);
    expect(statusCards(s.villain, "confused")).toBe(0);
    conserved(s, source);
  });

  it.each(["32067", "32068"])(
    "%s native Hero Action commits actual typed payment before discarding",
    (code) => {
      let s = base();
      const source = ids(s);
      const p = takeEncounter(s, code);
      s = settle(native(s, { type: "reveal", piece: p, skip: true }));
      const resources = ["01088", "01089", "01090"].map((code) =>
        takePlayer(s, code),
      );
      const option = abilityOptions(s, p).find(
        (o) => o.id === `discard:${p.id}`,
      )!;
      expect(option).toBeDefined();
      s = command(s, { type: "ABILITY", id: p.id, action: option.id });
      expect(s.prompt).toMatchObject({
        kind: "payment",
        cost: 3,
        requirements: ["energy", "mental", "physical"],
        abilityCost: true,
      });
      expect(s.attachments.some((a) => a.id === p.id)).toBe(true);
      s = settle(pay(s, resources));
      expect(s.attachments.some((a) => a.id === p.id)).toBe(false);
      expect(s.encounter.discard.filter((a) => a.id === p.id)).toHaveLength(1);
      for (const resource of resources)
        expect(
          s.player.discard.filter((a) => a.id === resource.id),
        ).toHaveLength(1);
      conserved(s, source);
    },
  );

  it("canceling the real attachment payment preserves every physical resource and the attached source", () => {
    let s = base();
    const source = ids(s);
    const p = takeEncounter(s, "32067");
    s = settle(native(s, { type: "reveal", piece: p, skip: true }));
    const resources = ["01088", "01089", "01090"].map((code) =>
      takePlayer(s, code),
    );
    s = command(s, { type: "ABILITY", id: p.id, action: `discard:${p.id}` });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "CANCEL" }));
    expect(s.attachments.some((a) => a.id === p.id)).toBe(true);
    for (const resource of resources)
      expect(s.player.hand.some((a) => a.id === resource.id)).toBe(true);
    conserved(s, source);
  });

  it.each(["exhaust", "damage"])(
    "Strikes' native saved %s choice prevents or places the exact Kelly packet",
    (choice) => {
      let s = base();
      const source = ids(s);
      const strikes = takeEncounter(s, "32069");
      const kellyId = sabretoothKelly(s)!.id;
      s = native(s, { type: "reveal", piece: strikes, skip: true });
      s = until(s, (v) => v.prompt?.title === "Sabretooth Strikes");
      s = settle(choose(s, choice));
      expect(sabretoothKelly(s)?.id).toBe(kellyId);
      expect(sabretoothKelly(s)?.damage).toBe(choice === "exhaust" ? 0 : 1);
      expect(s.player.exhausted).toBe(choice === "exhaust");
      expect(
        s.encounter.discard.filter((p) => p.id === strikes.id),
      ).toHaveLength(1);
      conserved(s, source);
    },
  );

  it("Strikes in alter ego resolves direct NPC damage without an invalid hero-exhaust choice", () => {
    let s = base();
    const source = ids(s);
    s.player.form = "alter";
    const strikes = takeEncounter(s, "32069");
    s = settle(native(s, { type: "reveal", piece: strikes, skip: true }));
    expect(sabretoothKelly(s)?.damage).toBe(1);
    expect(s.player.exhausted).toBe(false);
    conserved(s, source);
  });

  it.each([false, true])(
    "Strikes boost places two threat only if the native attack actually defeats its ally: %s",
    (defeated) => {
      let s = base();
      const source = ids(s);
      const ally = takePlayer(s, "01002", "inPlay");
      top(s, "32069");
      s = until(
        attack(s, defeated ? 0 : -1),
        (v) => !!v.prompt?.options.some((o) => o.id === ally.id),
      );
      s = settle(choose(s, ally.id));
      expect(s.scheme.threat).toBe(defeated ? 2 : 0);
      expect(s.player.discard.some((p) => p.id === ally.id)).toBe(defeated);
      expect(sabretoothKelly(s)?.damage).toBe(0);
      conserved(s, source);
    },
  );

  it("Protect pays with two actual Web-Shooter resource abilities and readies only after their costs", () => {
    let s = rescue(base());
    const source = ids(s);
    const shooters = [
      takePlayer(s, "01008", "inPlay"),
      takePlayer(s, "01008", "inPlay"),
    ];
    shooters.forEach((p) => {
      p.counters = 3;
      p.exhausted = false;
    });
    top(s, "32070");
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero"),
    );
    s = respond(choose(s, "hero"), /Protect the Senator/, "32065b");
    expect(s.player.exhausted).toBe(true);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      abilityCost: true,
    });
    s = settle(
      pay(
        s,
        [],
        "energy",
        shooters.map((p) => p.id),
      ),
    );
    expect(s.player.exhausted).toBe(false);
    for (const shooter of shooters)
      expect(s.player.inPlay.find((p) => p.id === shooter.id)).toMatchObject({
        exhausted: true,
        counters: 2,
      });
    expect(s.sabretooth?.usedDefenseResponses).toHaveLength(1);
    conserved(s, source);
  });

  it("canceled Protect payment resumes the native attack aftermath without spending its ready resource sources", () => {
    let s = rescue(base());
    const source = ids(s);
    const energy = takePlayer(s, "01088");
    top(s, "32070");
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero"),
    );
    s = respond(choose(s, "hero"), /Protect the Senator/, "32065b");
    s = settle(command(s, { type: "CANCEL" }));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.some((p) => p.id === energy.id)).toBe(true);
    expect(s.sabretooth?.usedDefenseResponses).toEqual([]);
    expect(s.attack).toBeNull();
    conserved(s, source);
  });

  it.each(["standard", "expert"] as const)(
    "actual %s stage advancement grants Toughness; stage III also retaliates natively",
    (difficulty) => {
      let s = base(difficulty);
      const source = ids(s);
      s.villain.tough = false;
      s.villain.toughCards = 0;
      s.villain.hp = 1;
      s = settle(
        native(s, {
          type: "damage",
          target: s.villain.id,
          amount: 1,
          source: "hero",
        }),
      );
      expect(s.villain.code).toBe(
        difficulty === "standard" ? "32061" : "32062",
      );
      expect(statusCards(s.villain, "tough")).toBe(1);
      if (difficulty === "expert") {
        s.villain.tough = false;
        s.villain.toughCards = 0;
        const hp = s.player.hp;
        s = command(s, { type: "BASIC", action: "attack" });
        if (s.prompt?.options.some((o) => o.id === s.villain.id))
          s = choose(s, s.villain.id);
        s = settle(s);
        expect(s.player.hp).toBe(hp - 1);
        expect(s.villain.hp).toBe(16);
      }
      conserved(s, source);
    },
  );
});
