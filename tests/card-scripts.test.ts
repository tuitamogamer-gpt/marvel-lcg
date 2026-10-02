import { describe, expect, it } from "vitest";
import { CARDS, CATALOG_CARDS, card } from "../src/game/cards";
import { dispatch, makePiece, newGame, targets } from "../src/game/engine";
import type { Card, Effect, GameState } from "../src/game/types";
import {
  canonicalCoreCode,
  checkScriptLegality,
  compileCardScript,
  compileScriptRegistry,
  mechanicalSignature,
  normalizeRules,
  resourceAbility,
  scriptEffects,
  staticModifierValue,
} from "../src/game/scripts";

function base() {
  return dispatch(
    newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 517,
      pacing: "expert",
    }),
    { type: "MULLIGAN", ids: [] },
  );
}
function execute(state: GameState, effects: Effect[]) {
  state.prompt = null;
  state.queue = effects;
  state.review = {
    id: 1,
    title: "Printed effect fixture",
    actor: "Spider-Man",
    phase: state.phase,
    messages: [],
    changes: [],
  };
  const result = dispatch(state, { type: "PROCEED" });
  expect(result.error).toBeUndefined();
  return result;
}
function context(state: GameState, code: string) {
  return {
    state,
    source: makePiece(state, code),
    targets: (selector: string) =>
      targets(state, selector === "controlled-ally" ? "ally" : selector),
  };
}

describe("exact printed card scripts", () => {
  it("executes an imported attack against the explicitly chosen enemy", () => {
    let state = base();
    state.player.form = "hero";
    const minion = makePiece(state, "01110");
    state.minions.push(minion);
    const script = compileCardScript(card("03004"), CARDS);
    const beforeHP = state.villain.hp;
    expect(script.status).toBe("supported");
    state = execute(
      state,
      scriptEffects(script, "event-action", context(state, "03004")),
    );
    expect(state.prompt?.options.map((option) => option.id)).toContain(
      minion.id,
    );
    expect(state.villain.hp).toBe(beforeHP);
    state = dispatch(state, { type: "CHOOSE", id: state.villain.id });
    expect(state.villain.hp).toBe(beforeHP - 6);
    expect(state.villain.stunned).toBe(false);
    expect(state.minions[0].damage).toBe(0);
  });

  it("preserves the same target for a paid-resource status follow-up", () => {
    const state = base();
    state.player.form = "hero";
    const script = compileCardScript(card("03004"), CARDS);
    const physical = scriptEffects(script, "event-action", {
      ...context(state, "03004"),
      paid: ["physical"],
    });
    expect(physical[0].action).toMatchObject({
      type: "scriptSequence",
      attack: true,
      source: "hero",
      effects: [
        { type: "damage", amount: 6 },
        { type: "status", status: "stunned" },
      ],
    });
    const mental = scriptEffects(script, "event-action", {
      ...context(state, "03004"),
      paid: ["mental"],
    });
    expect(mental[0].action.type).toBe("damage");
    expect(mental[0].action.amount).toBe(6);
  });

  it("executes the physical Heroic Strike follow-up on its chosen enemy", () => {
    let state = base();
    state.player.form = "hero";
    const minion = makePiece(state, "01110");
    state.minions.push(minion);
    const beforeHP = state.villain.hp;
    const script = compileCardScript(card("03004"), CARDS);
    state = execute(
      state,
      scriptEffects(script, "event-action", {
        ...context(state, "03004"),
        paid: ["physical"],
      }),
    );
    state = dispatch(state, { type: "CHOOSE", id: state.villain.id });
    expect(state.error).toBeUndefined();
    expect(state.villain.hp).toBe(beforeHP - 6);
    expect(state.villain.stunned).toBe(true);
    expect(state.minions[0].stunned).toBe(false);
  });

  it("Clear the Area draws only when real thwarting removes the final threat", () => {
    for (const threat of [1, 4]) {
      let state = base();
      state.player.form = "hero";
      state.scheme.threat = threat;
      const hand = state.player.hand.length;
      const script = compileCardScript(card("04049"), CARDS);
      state = execute(
        state,
        scriptEffects(script, "event-action", context(state, "04049")),
      );
      expect(state.error).toBeUndefined();
      expect(state.scheme.threat).toBe(Math.max(0, threat - 2));
      expect(state.player.hand.length).toBe(hand + (threat <= 2 ? 1 : 0));
    }
  });

  it("Precision Strike heals only after defeating its selected enemy", () => {
    for (const damage of [0, 2]) {
      let state = base();
      state.player.form = "hero";
      state.player.hp = 6;
      const minion = makePiece(state, "01103");
      minion.damage = damage;
      state.minions.push(minion);
      const script = compileCardScript(card("35018"), CARDS);
      state = execute(
        state,
        scriptEffects(script, "event-action", context(state, "35018")),
      );
      state = dispatch(state, { type: "CHOOSE", id: minion.id });
      expect(state.error).toBeUndefined();
      expect(state.player.hp).toBe(damage === 2 ? 8 : 6);
      expect(state.minions.some((piece) => piece.id === minion.id)).toBe(
        damage !== 2,
      );
    }
  });

  it("unpaid Tackle remains an attack and triggers surviving enemy Retaliate", () => {
    let state = base();
    state.player.form = "hero";
    const minion = makePiece(state, "01184");
    state.minions.push(minion);
    const beforeHP = state.player.hp;
    const script = compileCardScript(card("05015"), CARDS);
    state = execute(
      state,
      scriptEffects(script, "event-action", {
        ...context(state, "05015"),
        paid: ["mental", "energy", "mental"],
      }),
    );
    state = dispatch(state, { type: "CHOOSE", id: minion.id });
    expect(state.error).toBeUndefined();
    expect(state.minions[0].stunned).toBe(true);
    expect(state.minions[0].damage).toBe(0);
    expect(state.player.hp).toBe(beforeHP - 2);
  });

  it("only-paid branches require every spent resource to match", () => {
    const state = base();
    state.player.form = "hero";
    const script = compileCardScript(card("10014"), CARDS);
    const mixed = scriptEffects(script, "event-action", {
      ...context(state, "10014"),
      paid: ["physical", "physical", "mental"],
    });
    expect(mixed[0].action.type).toBe("damage");
    const exact = scriptEffects(script, "event-action", {
      ...context(state, "10014"),
      paid: ["physical", "physical", "physical"],
    });
    expect(
      exact[0].action.effects.map((effect: Effect) => effect.type),
    ).toEqual(["damage", "status", "draw"]);
  });

  it("additional resource costs pause before exhausting the source or resolving effects", () => {
    let state = base();
    const source = makePiece(state, "03010");
    state.player.inPlay.push(source);
    const resource = makePiece(state, "01089");
    state.player.hand = [resource];
    const printed = compileCardScript(card("03010"), CARDS);
    const script = {
      ...printed,
      trigger: "activate" as const,
      costs: { exhaustSource: true, spend: ["mental" as const] },
      program: [{ op: "draw" as const, amount: 1 }],
    };
    state = execute(
      state,
      scriptEffects(script, "activate", { state, source }),
    );
    expect(state.prompt?.kind).toBe("payment");
    expect(state.player.inPlay[0].exhausted).toBe(false);
    expect(state.player.hand.length).toBe(1);
    state = dispatch(state, { type: "PAY", ids: [resource.id] });
    expect(state.error).toBeUndefined();
    expect(state.player.inPlay[0].exhausted).toBe(true);
    expect(state.player.discard.some((piece) => piece.id === resource.id)).toBe(
      true,
    );
    expect(state.player.hand.length).toBe(1);
  });

  it("plays a retail Mockingbird reprint through the real Core handler", () => {
    let state = base();
    const ally = makePiece(state, "03020");
    const resources = [makePiece(state, "01088"), makePiece(state, "01089")];
    state.player.hand = [ally, ...resources];
    state = dispatch(state, { type: "PLAY", id: ally.id });
    expect(state.error).toBeUndefined();
    expect(state.prompt?.kind).toBe("payment");
    state = dispatch(state, {
      type: "PAY",
      ids: resources.map((piece) => piece.id),
    });
    expect(state.error).toBeUndefined();
    while (state.review) state = dispatch(state, { type: "PROCEED" });
    if (state.prompt?.options.some((option) => option.id === "yes"))
      state = dispatch(state, { type: "CHOOSE", id: "yes" });
    expect(
      state.player.inPlay.some(
        (piece) => piece.id === ally.id && piece.code === "03020",
      ),
    ).toBe(true);
    expect(state.villain.stunned).toBe(true);
  });

  it("keeps Agent 13's entrance response optional and removes real scheme threat", () => {
    let state = base();
    state.scheme.threat = 5;
    const script = compileCardScript(card("03002"), CARDS);
    state = execute(
      state,
      scriptEffects(script, "ally-enter", context(state, "03002")),
    );
    expect(state.prompt?.options.map((option) => option.id)).toEqual([
      "yes",
      "skip",
    ]);
    expect(state.scheme.threat).toBe(5);
    state = dispatch(state, { type: "CHOOSE", id: "yes" });
    expect(state.scheme.threat).toBe(3);
    expect(state.prompt).toBeNull();
  });

  it("passing an optional response changes nothing", () => {
    let state = base();
    state.scheme.threat = 5;
    const script = compileCardScript(card("03002"), CARDS);
    state = execute(
      state,
      scriptEffects(script, "ally-enter", context(state, "03002")),
    );
    state = dispatch(state, { type: "CHOOSE", id: "skip" });
    expect(state.scheme.threat).toBe(5);
  });

  it("an optional entrance with no possible effect quietly closes its response window", () => {
    const state = base();
    state.scheme.threat = 0;
    const script = compileCardScript(card("03002"), CARDS);
    expect(
      scriptEffects(script, "ally-enter", context(state, "03002")),
    ).toEqual([]);
  });

  it("Squirrel Girl damages every enemy once without treating it as an attack", () => {
    let state = base();
    const minion = makePiece(state, "01110");
    state.minions.push(minion);
    state.player.stunned = true;
    const beforeHP = state.villain.hp;
    const script = compileCardScript(card("03013"), CARDS);
    state = execute(
      state,
      scriptEffects(script, "ally-enter", context(state, "03013")),
    );
    state = dispatch(state, { type: "CHOOSE", id: "yes" });
    expect(state.villain.hp).toBe(beforeHP - 1);
    expect(state.minions[0].damage).toBe(1);
    expect(state.player.stunned).toBe(true);
  });

  it("offers Super-Soldier Serum only as a bounded payment source", () => {
    const state = base();
    const piece = makePiece(state, "03010");
    const script = compileCardScript(card(piece), CARDS);
    expect(script.rule).toBe("whole-exhaust-resource");
    expect(resourceAbility(script, piece, "alter")).toEqual({
      id: piece.id,
      code: piece.code,
      resources: ["physical"],
      exhaust: true,
    });
    expect(() =>
      scriptEffects(script, "resource", { state, source: piece }),
    ).toThrow("payment sources");
    piece.exhausted = true;
    expect(resourceAbility(script, piece, "hero")).toBeNull();
  });

  it("applies Boot Camp to the controller's allies only", () => {
    const state = base();
    const piece = makePiece(state, "13016");
    const script = compileCardScript(card(piece), CARDS);
    expect(script.constraints).toEqual({
      playUnderAnyPlayer: true,
      maxPerPlayer: 1,
    });
    const query = {
      stat: "attack" as const,
      target: "ally" as const,
      source: piece,
      sourceOwnerId: "seat-one",
      targetOwnerId: "seat-one",
    };
    expect(staticModifierValue(script, query)).toBe(1);
    expect(
      staticModifierValue(script, { ...query, targetOwnerId: "seat-two" }),
    ).toBe(0);
    expect(staticModifierValue(script, { ...query, target: "hero" })).toBe(0);
  });

  it("rejects the entire face when even one operative clause is unknown", () => {
    const state = base();
    const source = makePiece(state, "03004");
    const printed = {
      ...card(source),
      text: "Hero Action (attack): Deal 6 damage to an enemy. Discard your entire hand.",
    };
    const script = compileCardScript(printed, CARDS);
    expect(script.status).toBe("unsupported");
    expect(script.program).toEqual([]);
    expect(() =>
      scriptEffects(script, "event-action", { state, source }),
    ).toThrow("No exact executable rule");
  });

  it("rejects dynamic statistics and preserves all boost text", () => {
    const printed = { ...card("03004"), code: "test-dynamic", cost: -1 };
    expect(compileCardScript(printed, CARDS).status).toBe("unsupported");
    expect(
      normalizeRules(
        "<b>When Revealed:</b> Take 2 damage.<hr>[star] <b>Boost:</b> You are stunned.",
      ),
    ).toBe(
      "When Revealed: Take 2 damage. | BOOST | [star] Boost: You are stunned.",
    );
    expect(
      compileCardScript(
        {
          ...card("03004"),
          text: "Hero Action (attack): Deal 6 damage to an enemy.<hr>[star] Boost: You are stunned.",
        },
        CARDS,
      ).status,
    ).toBe("unsupported");
  });

  it("never mistakes a global entrance response for a self-entrance response", () => {
    expect(compileCardScript(card("52033"), CARDS).status).toBe("unsupported");
  });

  it("shares Core handlers only for mechanically identical printings", () => {
    const printed = card("03020");
    expect(canonicalCoreCode(printed, CARDS)).toBe("01083");
    expect(
      canonicalCoreCode({ ...printed, code: "test-cheaper", cost: 0 }, CARDS),
    ).toBeUndefined();
    expect(
      canonicalCoreCode(
        { ...printed, code: "test-scaled", health_per_hero: true } as Card,
        CARDS,
      ),
    ).toBeUndefined();
    expect(
      mechanicalSignature({
        ...printed,
        pack_code: "a-different-printing",
        quantity: 99,
      }),
    ).toBe(mechanicalSignature(printed));
  });

  it("checks form and legal targets before emitting executable costs", () => {
    const state = base();
    const script = compileCardScript(card("03004"), CARDS);
    expect(checkScriptLegality(script, context(state, "03004"))).toBe(
      "Change to hero form first.",
    );
    state.player.form = "hero";
    expect(
      checkScriptLegality(script, {
        ...context(state, "03004"),
        targets: () => [],
      }),
    ).toBe("No printed effect can change the current game state.");
  });

  it("rejects pure status effects with no usable target without blocking a useful conjunction", () => {
    const state = base();
    state.player.form = "hero";
    const pheromones = compileCardScript(card("04036"), CARDS);
    const unused = { ...context(state, "04036"), canAffect: () => false };
    expect(checkScriptLegality(pheromones, unused)).toBe(
      "No printed effect can change the current game state.",
    );
    const covertOps = compileCardScript(card("08003"), CARDS);
    expect(
      checkScriptLegality(covertOps, {
        ...context(state, "08003"),
        targets: (selector) =>
          selector === "scheme"
            ? []
            : [{ id: state.villain.id, label: "Rhino" }],
        canAffect: (node) => node.op === "status",
      }),
    ).toBeNull();
  });

  it("inventories every imported face with an explicit supported or unsupported result", () => {
    const registry = compileScriptRegistry(CATALOG_CARDS, CARDS);
    expect(registry.size).toBe(4551);
    expect(
      [...registry.values()].every(
        (script) => script.status === "supported" || !!script.reason,
      ),
    ).toBe(true);
    const rules: Record<string, number> = {};
    for (const script of registry.values())
      rules[script.rule || "unsupported"] =
        (rules[script.rule || "unsupported"] || 0) + 1;
    console.info("Exact executable card-script inventory:", rules);
  });
});
