import { describe, expect, it } from "vitest";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
} from "../src/game/engine.js";
import { heroStats, card } from "../src/game/cards.js";
import { paymentSources } from "../src/game/payment.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  top,
  minion,
  side,
  attach,
  play,
  pay,
  respond,
  target,
  passId,
} from "./dv-test-helpers.js";
import type { GameState } from "../src/game/types.js";

const base = (alter = false) => {
  let s = newGame({
    heroId: "iceman",
    aspect: "aggression",
    villainId: "rhino",
    module: "sauron",
    seed: 46001,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  if (!alter) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 10;
  s.encounter.deck = Array.from({ length: 10 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
};
const cast = (s: GameState, ...codes: string[]) => {
  const p = hand(s, ...codes);
  return play(s, p[0], p.slice(1));
};
const reveal = (s: GameState, code: string) =>
  native(s, { type: "reveal", piece: makePiece(s, code) });

describe("Iceman retail reprints and complete encounter execution", () => {
  it("Team-BuildingExerciseusesitsactual46021printingandpaysreducedIcecost", () => {
    let s = base();
    const support = put(s, "46021");
    const [event, resource] = hand(s, "46009", "46023");
    expect(
      nativeHeroAbilityOptions(s, support.id).some(
        (o) => o.id === "team-building",
      ),
    ).toBe(true);
    s = command(s, {
      type: "ABILITY",
      id: support.id,
      action: "team-building",
    });
    s = choose(s, event.id);
    s = pay(s, [resource]);
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find(
          (o) => o.id === "freeze" || o.id === s.villain.id,
        )?.id,
    );
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.find((p) => p.id === event.id)?.code).toBe("46009");
    expect(s.villain.hp).toBe(76);
  });
  it("Recuperation reprint heals printed REC in alter ego", () => {
    let s = base(true);
    s.player.hp = 2;
    const recover = heroStats(s).recover;
    s = finish(cast(s, "46022", "01088"));
    expect(s.player.hp).toBe(2 + recover);
  });
  it("ThePowerinAllofUsdoublesforBasiccardsandnotIcemanssignatures", () => {
    const s = base();
    const [resource] = hand(s, "46023");
    expect(
      paymentSources(s, undefined, "46020").find((p) => p.id === resource.id)
        ?.resources,
    ).toHaveLength(2);
    expect(
      paymentSources(s, undefined, "46009").find((p) => p.id === resource.id)
        ?.resources,
    ).toHaveLength(1);
  });
  it("LookingforTrouble movesoriginalminionbeforetheconfusedstatusreplacement", () => {
    let s = base();
    const m = makePiece(s, "01103");
    s.encounter.deck.unshift(m);
    s.player.confused = true;
    s = finish(cast(s, "46017"));
    expect(
      s.minions.some(
        (p) => p.id === m.id && p.engagedWith === s.activePlayerId,
      ),
    ).toBe(true);
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(10);
  });
  it("LookingforTrouble normal reprint removes3frommain", () => {
    let s = base();
    s.encounter.deck.unshift(makePiece(s, "01103"));
    s = finish(cast(s, "46017"));
    expect(s.scheme.threat).toBe(7);
  });
  it("PyrosFlamethrower uses all icons and preserves indirect attack damage", () => {
    let s = base();
    const pyro = minion(s, "46025");
    attach(s, "46027", pyro.id);
    top(s, "01088");
    s = native(s, { type: "enemyAttack", id: pyro.id });
    s = finish(s, (v) =>
      /indirect/i.test(v.prompt?.text || "")
        ? v.prompt?.options.find((o) => o.id === "hero")?.id
        : undefined,
    );
    expect(s.player.hp).toBe(6);
  });
  it("Burn boost adds numeric icons from the physical discarded card", () => {
    let s = base();
    top(s, "01088");
    s.encounter.deck.unshift(makePiece(s, "46028"));
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(7);
  });
  it("Sauron boost heals and grants Tough to the actual activating enemy", () => {
    let s = base();
    s.villain.hp = 70;
    s.encounter.deck.unshift(makePiece(s, "46029"));
    s = finish(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.villain.hp).toBe(73);
    expect(s.villain.tough).toBe(true);
    expect(s.scheme.threat).toBe(11);
  });
  it("PlayingwithFire mills3 and assigns one indirect damage per printed icon", () => {
    let s = base();
    top(s, "46023");
    top(s, "46011");
    top(s, "01088");
    const scheme = side(s, "46026", 1);
    s = finish(
      native(s, { type: "thwart", target: scheme.id, amount: 1 }),
      (v) =>
        /indirect/i.test(v.prompt?.text || "")
          ? v.prompt?.options.find((o) => o.id === "hero")?.id
          : undefined,
    );
    expect(s.player.hp).toBe(7);
  });
  for (const [resource, code] of [
    ["energy", "46009"],
    ["mental", "46011"],
    ["physical", "46003"],
    ["wild", "46023"],
  ])
    it(`The Eye of Sauron resolves every printed ${resource} icon separately`, () => {
      let s = base();
      if (resource === "energy") s.scheme.threat = 0;
      const ally = put(s, "46012");
      const copies = hand(s, code, code, "46004", "46005");
      const discarded = copies.slice(2);
      s.player.deck.unshift(...s.player.hand.splice(0, 2));
      s = finish(reveal(s, "46032"), (v) =>
        v.prompt?.title === "The Eye of Sauron"
          ? v.prompt.options[0]?.id
          : undefined,
      );
      if (resource === "energy") expect(s.scheme.threat).toBe(2);
      if (resource === "mental") expect(s.player.hand).toHaveLength(0);
      if (resource === "physical") expect(s.player.hp).toBe(9);
      if (resource === "wild") {
        expect(s.player.exhausted).toBe(true);
        expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
          true,
        );
      }
      for (const p of discarded)
        expect(
          [...s.player.hand, ...s.player.deck, ...s.player.discard].filter(
            (q) => q.id === p.id,
          ),
        ).toHaveLength(1);
    });
  it("PyrosFlamethrower with no Pyro surges and conserves the physical attachment", () => {
    let s = base();
    const a = makePiece(s, "46027");
    s = finish(native(s, { type: "reveal", piece: a }));
    expect(s.encounter.discard.filter((p) => p.id === a.id)).toHaveLength(1);
  });
  it("LifeDrain chooses the minion with highest PRINTED HP, not remainingHP", () => {
    let s = base();
    const low = minion(s, "01103");
    const high = minion(s, "46029");
    high.damage = 5;
    const a = makePiece(s, "46031");
    s = native(s, { type: "reveal", piece: a });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([high.id]);
    s = finish(s);
    expect(s.attachments.find((p) => p.id === a.id)?.attachedTo).toBe(high.id);
    expect(s.attachments.find((p) => p.id === a.id)?.attachedTo).not.toBe(
      low.id,
    );
  });
});
