/** Native modular encounters preserve every original starter and encounter
 * instance. Focused positions move existing cards; no replacement printings. */
import { describe, expect, it } from "vitest";
import {
  abilityOptions,
  dispatch,
  newGame,
  targets,
} from "../src/game/engine.js";
import { card, deckCodes, MODULES } from "../src/game/cards.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece, Resource } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

const sets = {
  hydra_assault: ["04145", "04145", "04145", "04146", "04146", "04147"],
  weap_master: ["04148", "04149", "04150", "04150", "04151"],
  hydra_patrol: ["04152", "04152", "04153", "04153", "04153", "04154"],
};
type Module = keyof typeof sets;
type Saved = GameState & { redSkullSources?: { id: string; code: string }[] };
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.inheritorBoosts || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
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
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.removed,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function conserved(s: GameState) {
  const all = physical(s);
  for (const source of (s as Saved).redSkullSources || []) {
    const found = all.filter((p) => p.id === source.id);
    expect(found, `original physical ${source.code}:${source.id}`).toHaveLength(
      1,
    );
    expect(found[0].code).toBe(source.code);
  }
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 100; n++) {
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "take",
          "allow",
          "skip",
          "pass",
          "continue",
          "no",
          "resolve",
          "none",
        ].includes(o.id),
      )?.id ||
      (s.prompt.title === "Forced responses" ||
      s.prompt.title === "When defeated" ||
      s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(s.prompt).toBeNull();
  conserved(s);
  return s;
}
function until(s: GameState, match: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !match(s) && n < 100; n++) {
    const id =
      s.prompt.options.find((o) =>
        [
          "take",
          "allow",
          "skip",
          "pass",
          "continue",
          "no",
          "resolve",
          "none",
        ].includes(o.id),
      )?.id ||
      (s.prompt.title === "Forced responses" || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(match(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function base(
  module: Module,
  team = false,
  heroId = "black_panther",
  villainId = "rhino",
  otherModule = "hydra_assault",
) {
  const aspect: Aspect =
    heroId === "black_panther"
      ? "protection"
      : heroId === "spider_man"
        ? "justice"
        : heroId === "she_hulk"
          ? "aggression"
          : "leadership";
  const hero = { heroId, aspect };
  let s = newGame({
    ...hero,
    villainId,
    module,
    ...(villainId === "sabretooth"
      ? { modules: [module, otherModule], senatorDamage: 0 }
      : {}),
    seed: 4145,
    pacing: "expert",
    ...(team
      ? { heroes: [hero, { heroId: "spider_man", aspect: "justice" as const }] }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s, (v) =>
    v.prompt?.title === "Choose starting weather"
      ? v.prompt.options.find((o) => o.image === "36002")?.id
      : v.prompt?.title === "Foresight"
        ? v.prompt.options[0]?.id
        : undefined,
  );
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const codes = deckCodes(seat.heroId, seat.aspect),
      codeSet = new Set(codes);
    const source = [
      ...p.deck,
      ...p.hand,
      ...p.discard,
      ...p.inPlay.filter((q) => codeSet.has(q.code)),
    ];
    expect(source).toHaveLength(40);
    expect(source.map((q) => q.code).sort()).toEqual(codes.sort());
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = p.inPlay.filter((q) => !codeSet.has(q.code));
    p.form = "hero";
    p.exhausted = p.flipped = p.tough = p.stunned = p.confused = false;
    p.toughCards = p.stunCards = p.confuseCards = 0;
  }
  s.scheme.threat = 0;
  s.villain.hp = s.villain.maxHp = 60;
  activateSeat(s, "p1");
  (s as Saved).redSkullSources = physical(s).map(({ id, code }) => ({
    id,
    code,
  }));
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((q) => q.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original player source ${seatId}:${code}`);
}
function put(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function support(s: GameState, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player.deck.find(
    (q) => card(q).type_code === "support",
  );
  expect(p).toBeDefined();
  return put(s, p!.code, seatId);
}
function resource(s: GameState, type: Resource) {
  const p = s.player.deck.find(
    (q) =>
      Number(card(q)[`resource_${type}`]) === 1 &&
      ["energy", "mental", "physical", "wild"].reduce(
        (n, r) =>
          n +
          Number(
            card(q)[`resource_${r}` as keyof ReturnType<typeof card>] || 0,
          ),
        0,
      ) === 1,
  );
  expect(p, `original ${type} resource`).toBeDefined();
  const actual = source(s, p!.code);
  s.player.hand.push(actual);
  return actual;
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original encounter ${code}`);
}
function minion(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = encounter(s, code);
  p.engagedWith = seatId;
  s.minions.push(p);
  return p;
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: encounter(s, code), skip: true });
}
function zeroBoost(s: GameState) {
  const p = s.encounter.deck.find((q) => !card(q).boost && !card(q).boost_star);
  expect(p, "original zero-icon boost").toBeDefined();
  s.encounter.deck.unshift(encounter(s, p!.code));
}
function top(s: GameState, code: string) {
  const p = encounter(s, code);
  s.encounter.deck.unshift(p);
  return p;
}
function villainAttack(s: GameState, boost?: string) {
  if (boost) top(s, boost);
  else zeroBoost(s);
  return native(s, { type: "enemyAttack", id: s.villain.id });
}
function attach(s: GameState, code: string) {
  s = settle(reveal(s, code));
  expect(s.attachments.find((p) => p.code === code)?.attachedTo).toBe(
    s.villain.id,
  );
  return s;
}

describe("Rise of Red Skull original modular sources", () => {
  it.each(Object.keys(sets) as Module[])(
    "keeps all original %s quantities and forty-card source",
    (module) => {
      const s = base(module);
      expect(
        physical(s)
          .filter((p) => card(p).set_code === module)
          .map((p) => p.code)
          .sort(),
      ).toEqual(sets[module]);
      for (const code of sets[module])
        expect(hasExecutableScript(code), code).toBe(true);
      expect(MODULES.map((m) => m.id)).toContain(module);
      conserved(reload(s));
    },
  );
  it("appends all three modules after Experimental Weapons without shifting it", () => {
    expect(MODULES.slice(26).map((m) => m.id)).toEqual([
      "exper_weapon",
      "hydra_assault",
      "weap_master",
      "hydra_patrol",
    ]);
  });
});

describe("Hydra Assault native attacks and boosts", () => {
  it("Flame-Soldier boost sees an undefended attack when an earlier physical boost defeated its ally defender", () => {
    let s = base(
      "hydra_assault",
      false,
      "black_panther",
      "sabretooth",
      "under_attack",
    );
    const ally = put(s, "01041"),
      held = support(s);
    ally.damage = 2;
    const blast = encounter(s, "01154"),
      flame = encounter(s, "04145");
    s.encounter.storedBoosts = [blast, flame];
    s = villainAttack(s);
    s = settle(choose(reload(s), ally.id), (v) =>
      v.prompt?.options.some((o) => o.id === held.id) ? held.id : undefined,
    );
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === held.id)).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.id === blast.id)).toHaveLength(
      1,
    );
    expect(s.encounter.discard.filter((p) => p.id === flame.id)).toHaveLength(
      1,
    );
  });
  it("Backflip event defense keeps the support after an otherwise undefended Flame-Soldier attack", () => {
    let s = base("hydra_assault", false, "spider_man");
    const flame = minion(s, "04145"),
      held = support(s),
      event = source(s, "01003"),
      hp = s.player.hp;
    s.player.hand.push(event);
    s = native(s, { type: "enemyAttack", id: flame.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "backflip"));
    s = settle(choose(reload(s), "backflip"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.some((p) => p.id === held.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });
  it("a Jet-Trooper follow-up keeps a predealt boost but suppresses its request for an additional boost", () => {
    let s = base("hydra_assault", false, "she_hulk");
    s = settle(reveal(s, "01190"));
    expect(s.encounter.deck.some((p) => p.code === "01164")).toBe(true);
    (s as Saved).redSkullSources = physical(s).map(({ id, code }) => ({
      id,
      code,
    }));
    const hp = s.player.hp;
    top(s, "04146");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(reload(s), "take");
    s = until(
      s,
      (v) =>
        !!v.attack &&
        v.player.hp < hp &&
        !!v.prompt?.options.some((o) => o.id === "take"),
    );
    // This exact original nemesis card was already dealt to the follow-up
    // activation. Its numeric icon remains; its star cannot deal a new card.
    const stored = encounter(s, "01164");
    (s.attack!.pendingBoosts ||= []).push(stored);
    const deck = s.encounter.deck.map((p) => p.id);
    s = settle(choose(reload(s), "take"));
    expect(s.player.hp).toBe(hp - 5);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    expect(s.encounter.discard.filter((p) => p.id === stored.id)).toHaveLength(
      1,
    );
  });
  it("makes the undefended Flame-Soldier's player choose one of their actual supports", () => {
    let s = base("hydra_assault");
    const flame = minion(s, "04145"),
      a = support(s),
      b = support(s),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: flame.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === a.id));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    s = settle(choose(reload(s), b.id));
    expect(s.player.inPlay.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === b.id)).toHaveLength(1);
  });
  it.each(["hero", "ally"])(
    "Flame-Soldier preserves supports after %s defense",
    (mode) => {
      let s = base("hydra_assault");
      const flame = minion(s, "04145"),
        held = support(s);
      const defender = mode === "ally" ? put(s, "01041").id : "hero";
      s = native(s, { type: "enemyAttack", id: flame.id });
      s = settle(choose(reload(s), defender));
      expect(s.player.inPlay.some((p) => p.id === held.id)).toBe(true);
    },
  );
  it("Tough does not turn an undefended Flame-Soldier attack into a defended one", () => {
    let s = base("hydra_assault");
    const flame = minion(s, "04145"),
      held = support(s),
      hp = s.player.hp;
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(native(s, { type: "enemyAttack", id: flame.id }), (v) =>
      v.prompt?.options.some((o) => o.id === held.id) ? held.id : undefined,
    );
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.some((p) => p.id === held.id)).toBe(true);
  });
  it("a stunned Flame-Soldier has no attack response and preserves the support", () => {
    let s = base("hydra_assault");
    const flame = minion(s, "04145"),
      held = support(s);
    flame.stunned = true;
    flame.stunCards = 1;
    s = settle(native(s, { type: "enemyAttack", id: flame.id }));
    expect(s.player.inPlay.some((p) => p.id === held.id)).toBe(true);
    expect(s.minions.find((p) => p.id === flame.id)?.stunned).toBe(false);
  });
  it("an undefended Flame-Soldier attack finishes when there is no support", () => {
    let s = base("hydra_assault");
    const flame = minion(s, "04145"),
      hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: flame.id }));
    expect(s.player.hp).toBe(hp - 1);
  });
  it.each(["take", "hero", "ally"])(
    "Flame-Soldier boost observes actual %s defense",
    (mode) => {
      let s = base("hydra_assault");
      const held = support(s),
        defender = mode === "ally" ? put(s, "01041").id : mode;
      s = villainAttack(s, "04145");
      s = settle(choose(reload(s), defender), (v) =>
        v.prompt?.options.some((o) => o.id === held.id) ? held.id : undefined,
      );
      expect(s.player.discard.some((p) => p.id === held.id)).toBe(
        mode === "take",
      );
    },
  );
  it.each(["hero", "alter"])(
    "Jet-Trooper entry only quickstrikes %s form when appropriate",
    (form) => {
      let s = base("hydra_assault");
      s.player.form = form as "hero" | "alter";
      const hp = s.player.hp;
      s = settle(reveal(s, "04146"));
      expect(s.player.hp).toBe(hp - (form === "hero" ? 2 : 0));
      expect(s.minions.filter((p) => p.code === "04146")).toHaveLength(1);
    },
  );
  it("Jet-Trooper boost waits for the current attack and gives its next attack no boost card", () => {
    let s = base("hydra_assault");
    const boost = top(s, "04146"),
      next = s.encounter.deck[1],
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(reload(s), "take");
    s = until(
      s,
      (v) =>
        !!v.attack &&
        v.encounter.discard.some((p) => p.id === boost.id) &&
        v.player.hp < hp &&
        !!v.prompt?.options.some((o) => o.id === "take"),
    );
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.deck[0].id).toBe(next.id);
    s = settle(choose(reload(s), "take"));
    expect(s.player.hp).toBe(hp - 4);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
  });
  it("Jet-Trooper boost after a scheme attacks a hero without another boost", () => {
    let s = base("hydra_assault");
    const boost = top(s, "04146"),
      next = s.encounter.deck[1],
      hp = s.player.hp;
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    expect(s.scheme.threat).toBe(1);
    expect(s.attack?.attacker).toBe(s.villain.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
  });
  it("Jet-Trooper boost has no follow-up attack against alter ego", () => {
    let s = base("hydra_assault");
    s.player.form = "alter";
    top(s, "04146");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBe(1);
    expect(s.attack).toBeNull();
  });
  it("Hail Hydra searches after a stunned minion replacement and puts the same Jet-Trooper into play", () => {
    let s = base("hydra_assault");
    const flame = minion(s, "04145"),
      jet = s.encounter.deck.find((p) => p.code === "04146")!,
      hp = s.player.hp;
    flame.stunned = true;
    flame.stunCards = 1;
    s = reveal(s, "04147");
    expect(s.player.hp).toBe(hp);
    expect(s.prompt?.title).toBe("Hail Hydra!");
    s = settle(choose(reload(s), jet.id));
    expect(s.minions.find((p) => p.id === jet.id)?.engagedWith).toBe("p1");
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Hail Hydra's completed attack satisfies only the actually attacked player", () => {
    let s = base("hydra_assault", true);
    minion(s, "04145", "p1");
    const searched = s.encounter.deck.find((p) => p.code === "04145")!;
    seatView(s, "p2").player.form = "alter";
    s = reveal(s, "04147");
    s = until(
      s,
      (v) => v.prompt?.title === "Hail Hydra!" && v.activePlayerId === "p2",
    );
    s = settle(choose(reload(s), searched.id));
    expect(s.minions.find((p) => p.id === searched.id)?.engagedWith).toBe("p2");
    expect(s.player.hp).toBe(10);
  });
});

describe("Weapon Master native rules", () => {
  it.each(["04148", "04149"])(
    "%s removal pays Mental and Physical using actual player cards",
    (code) => {
      let s = attach(base("weap_master"), code);
      const attachment = s.attachments.find((p) => p.code === code)!,
        costs = [resource(s, "mental"), resource(s, "physical")];
      expect(abilityOptions(s, attachment).some((o) => o.id === "remove")).toBe(
        true,
      );
      s = command(s, { type: "ABILITY", id: attachment.id, action: "remove" });
      expect(s.prompt?.requirements).toEqual(["mental", "physical"]);
      s = settle(
        command(reload(s), { type: "PAY", ids: costs.map((p) => p.id) }),
      );
      expect(
        s.encounter.discard.filter((p) => p.id === attachment.id),
      ).toHaveLength(1);
      for (const p of costs)
        expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    },
  );
  it("wrong resource types and canceled removal preserve the attachment and costs", () => {
    let s = attach(base("weap_master"), "04148");
    const attachment = s.attachments.find((p) => p.code === "04148")!,
      wrong = [resource(s, "energy"), resource(s, "energy")];
    resource(s, "mental");
    resource(s, "physical");
    s = command(s, { type: "ABILITY", id: attachment.id, action: "remove" });
    const failed = dispatch(reload(s), {
      type: "PAY",
      ids: wrong.map((p) => p.id),
    });
    expect(failed.error).toBeTruthy();
    conserved(failed);
    s = settle(command(reload(s), { type: "CANCEL" }));
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(true);
    for (const p of wrong)
      expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
  });
  it.each(["04148", "04149"])(
    "%s Hero Action is unavailable in alter ego",
    (code) => {
      const s = attach(base("weap_master"), code);
      s.player.form = "alter";
      expect(
        abilityOptions(
          s,
          s.attachments.find((p) => p.code === code)!,
        ),
      ).toEqual([]);
    },
  );
  it("Combat Knife removes Tough and deals its modified attack damage through piercing", () => {
    let s = attach(base("weap_master"), "04148");
    const hp = s.player.hp;
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(villainAttack(s));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(hp - 3);
  });
  it("Hydra Sidearm bypasses Retaliate and grants Ranged for the actual attack", () => {
    let s = attach(base("weap_master"), "04149");
    const hp = s.villain.hp;
    s = settle(villainAttack(s));
    expect(s.villain.hp).toBe(hp);
  });
  it("Sidearm Ranged survives attachment removal after the attack starts", () => {
    let s = attach(base("weap_master"), "04149");
    const attachment = s.attachments.find((p) => p.code === "04149")!,
      hp = s.villain.hp;
    s = villainAttack(s);
    const take = s.prompt!.options.find((o) => o.id === "take")!,
      rest = [...s.queue];
    s = settle(
      native(
        reload(s),
        { type: "discardPiece", id: attachment.id },
        ...take.effects,
        ...rest,
      ),
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.encounter.discard.some((p) => p.id === attachment.id)).toBe(true);
  });
  it.each([false, true])(
    "Weapon Master checks Weapon surge after a stunned activation (weapon=%s)",
    (weapon) => {
      let s = base("weap_master");
      if (weapon) s = attach(s, "04148");
      s.villain.stunned = true;
      s.villain.stunCards = 1;
      const grenade = top(s, "04151"),
        hp = s.player.hp;
      s = settle(reveal(s, "04150"));
      expect(s.player.hp).toBe(hp);
      expect(s.player.stunned).toBe(false);
      expect(
        s.encounter.dealt.some(
          (p) => p.id === grenade.id && p.dealtTo === "p1",
        ),
      ).toBe(weapon);
      if (weapon) {
        s = settle(reveal(reload(s), "04151"));
        expect(s.player.hp).toBe(hp - 1);
        expect(s.player.stunned).toBe(true);
      }
    },
  );
  it("Weapon Master schemes in alter ego and then resolves its weapon-dependent surge", () => {
    let s = attach(base("weap_master"), "04149");
    s.player.form = "alter";
    top(s, "04151");
    zeroBoost(s);
    s = settle(reveal(s, "04150"));
    expect(s.scheme.threat).toBe(1);
    expect(
      s.encounter.dealt.filter((p) => p.code === "04151" && p.dealtTo === "p1"),
    ).toHaveLength(1);
    s = settle(reveal(reload(s), "04151"));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.confused).toBe(true);
  });
  it("Weapon Master does not surge when its Weapon leaves before the activation finishes", () => {
    let s = attach(base("weap_master"), "04148");
    const attachment = s.attachments.find((p) => p.code === "04148")!,
      grenade = top(s, "04151");
    zeroBoost(s);
    s = reveal(s, "04150");
    const take = s.prompt!.options.find((o) => o.id === "take")!,
      rest = [...s.queue];
    s = settle(
      native(
        reload(s),
        { type: "discardPiece", id: attachment.id },
        ...take.effects,
        ...rest,
      ),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.encounter.deck.some((p) => p.id === grenade.id)).toBe(true);
  });
  it.each([false, true])(
    "Concussion Grenade uses preexisting hero stun for its damage (already=%s)",
    (already) => {
      let s = base("weap_master");
      s.player.stunned = already;
      s.player.stunCards = Number(already);
      const hp = s.player.hp;
      s = settle(reveal(s, "04151"));
      expect(s.player.stunned).toBe(true);
      expect(s.player.hp).toBe(hp - (already ? 2 : 1));
    },
  );
  it.each([false, true])(
    "Concussion Grenade uses preexisting alter-ego confusion for threat (already=%s)",
    (already) => {
      let s = base("weap_master");
      s.player.form = "alter";
      s.player.confused = already;
      s.player.confuseCards = Number(already);
      s = settle(reveal(s, "04151"));
      expect(s.player.confused).toBe(true);
      expect(s.scheme.threat).toBe(already ? 2 : 1);
    },
  );
  it("one Steady stun card was not already stunned when Grenade supplies the second", () => {
    let s = base("weap_master", false, "magneto");
    put(s, "49003");
    s = settle(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunCards).toBe(1);
    expect(s.player.stunned).toBe(false);
    const hp = s.player.hp;
    s = settle(reveal(s, "04151"));
    expect(s.player.stunCards).toBe(2);
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
  });
  it.each(["hero", "alter"])(
    "Stalwart prevents Grenade status but not its %s consequence",
    (form) => {
      let s = base("weap_master", false, "storm");
      s.player.form = form as "hero" | "alter";
      const hp = s.player.hp;
      s = settle(reveal(s, "04151"));
      expect(s.player.stunned).toBe(false);
      expect(s.player.confused).toBe(false);
      expect(s.player.hp).toBe(hp - (form === "hero" ? 1 : 0));
      expect(s.scheme.threat).toBe(form === "alter" ? 1 : 0);
    },
  );
});

describe("Hydra Patrol native entry and defeat", () => {
  it("Patrol searches continue after the first player's searched Jet-Trooper eliminates that player", () => {
    let s = base("hydra_patrol", true, "black_panther", "sabretooth");
    s = settle(reveal(s, "04154"));
    const patrol = s.sideSchemes.find((p) => p.code === "04154")!,
      jet = s.encounter.deck.find((p) => p.code === "04146")!,
      regular = s.encounter.deck.find((p) => p.code === "04152")!;
    s.player.hp = 1;
    const seed = s.seed,
      seats: string[] = [];
    s = settle(
      native(s, {
        type: "thwart",
        target: patrol.id,
        amount: patrol.counters,
        source: "hero",
      }),
      (v) => {
        const id = v.activePlayerId === "p1" ? jet.id : regular.id;
        if (v.prompt?.options.some((o) => o.id === id)) {
          seats.push(v.activePlayerId);
          return id;
        }
        return undefined;
      },
    );
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.phase).not.toBe("lost");
    expect(seats).toEqual(["p1", "p2"]);
    expect(s.minions.find((p) => p.id === regular.id)?.engagedWith).toBe("p2");
    expect(s.scheme.threat).toBe(0);
    expect(s.seed).not.toBe(seed);
    expect(s.encounter.discard.filter((p) => p.id === patrol.id)).toHaveLength(
      1,
    );
  });
  it("revealing the actual Regular resolves Incite once", () => {
    let s = base("hydra_patrol");
    s = settle(reveal(s, "04152"));
    expect(s.scheme.threat).toBe(1);
    expect(s.minions.filter((p) => p.code === "04152")).toHaveLength(1);
  });
  it("Soldier guards only its engaged hero and deals that player a physical encounter after defeat", () => {
    let s = base("hydra_patrol", true);
    const soldier = minion(s, "04153", "p2"),
      topId = s.encounter.deck[0].id;
    expect(targets(s, "enemy", true).map((p) => p.id)).toContain(s.villain.id);
    activateSeat(s, "p2");
    expect(targets(s, "enemy", true).map((p) => p.id)).not.toContain(
      s.villain.id,
    );
    activateSeat(s, "p1");
    s = settle(
      native(s, {
        type: "damage",
        target: soldier.id,
        amount: 4,
        source: "hero",
      }),
    );
    expect(s.encounter.dealt.find((p) => p.id === topId)?.dealtTo).toBe("p2");
    expect(s.encounter.discard.filter((p) => p.id === soldier.id)).toHaveLength(
      1,
    );
  });
  it("Patrol defeat lets each player choose a real Regular without its When Revealed Incite", () => {
    let s = base("hydra_patrol", true);
    s = settle(reveal(s, "04154"));
    const patrol = s.sideSchemes.find((p) => p.code === "04154")!;
    expect(patrol.counters).toBe(4);
    const regulars = s.encounter.deck.filter((p) => p.code === "04152");
    const seats: string[] = [];
    s = settle(
      native(s, { type: "thwart", target: patrol.id, amount: 4 }),
      (v) => {
        const found = v.prompt?.options.find((o) =>
          regulars.some((p) => p.id === o.id),
        );
        if (found) {
          seats.push(v.activePlayerId);
          return found.id;
        }
        return undefined;
      },
    );
    expect(seats).toEqual(["p1", "p2"]);
    expect(s.scheme.threat).toBe(0);
    expect(
      regulars
        .map((p) => s.minions.find((q) => q.id === p.id)?.engagedWith)
        .sort(),
    ).toEqual(["p1", "p2"]);
    expect(s.encounter.discard.filter((p) => p.id === patrol.id)).toHaveLength(
      1,
    );
  });
});
