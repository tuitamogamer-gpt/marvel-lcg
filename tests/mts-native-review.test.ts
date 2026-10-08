/** Independent native acceptance uses actual source-composition instances.
 * Every dispatched decision is saved/reloaded and every original ID conserved. */
import { describe, expect, it } from "vitest";
import { card, deckCodes, heroStats } from "../src/game/cards.js";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine.js";
import { deckErrors } from "../src/game/decks.js";
import { paymentSources, paymentStatus } from "../src/game/payment.js";
import {
  spectrumEnergyForm,
  spectrumFormFaceup,
} from "../src/game/spectrum.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

type Hero = "spectrum" | "warlock";
type ReviewState = GameState & { reviewOriginalIds: Record<string, string[]> };
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(s: GameState, command: Command) {
  s = dispatch(reload(s), command);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(reload(s), { type: "PROCEED" });
    expect(s.error).toBeUndefined();
  }
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function pass(s: GameState) {
  return s.prompt?.options.find((o) =>
    /^(skip|pass|none|done|continue|no|decline|take)$/.test(o.id),
  )?.id;
}
function finish(s: GameState) {
  for (let n = 0; s.prompt && n < 120; n++) {
    const id =
      pass(s) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  conserved(s);
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Independent native rule review",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function pieces(s: GameState): Piece[] {
  const result = s.players.flatMap((seat) => {
    const p = seatView(s, seat).player;
    return [
      ...p.hand,
      ...p.deck,
      ...p.discard,
      ...p.inPlay,
      ...(p.setAside || []),
      ...(p.invocationDeck || []),
      ...(p.invocationDiscard || []),
    ];
  });
  result.push(
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  );
  const nested = (p: Piece) => {
    const children = [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ];
    result.push(...children);
    children.forEach(nested);
  };
  [...result].forEach(nested);
  return result;
}
function conserved(s: GameState) {
  const physical = pieces(s);
  for (const [ownerId, ids] of Object.entries(
    (s as ReviewState).reviewOriginalIds || {},
  ))
    for (const id of ids) {
      const found = physical.filter((p) => p.id === id);
      expect(found, `physical source ${ownerId}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(ownerId);
    }
}
function opening(hero: Hero, other?: Hero | "spider_man") {
  const aspect = hero === "spectrum" ? "leadership" : "aggression";
  let s = newGame({
    heroId: hero,
    aspect,
    villainId: "rhino",
    seed: 21070,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId: hero, aspect },
            {
              heroId: other,
              aspect:
                other === "spectrum"
                  ? ("leadership" as const)
                  : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    expect(p.deck.length + p.hand.length + p.discard.length).toBe(40);
  }
  (s as ReviewState).reviewOriginalIds = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player;
      return [
        seat.id,
        [...p.deck, ...p.hand, ...p.discard, ...p.inPlay].map((p) => p.id),
      ];
    }),
  );
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  return finish(s);
}
function base(hero: Hero, other?: Hero | "spider_man") {
  const s = opening(hero, other);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(
      ...v.player.hand.splice(0),
      ...v.player.discard.splice(0),
    );
    v.player.exhausted = false;
    v.player.flipped = false;
    v.player.form = "hero";
  }
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 12;
  s.villain.hp = s.villain.maxHp = 50;
  s.villain.tough = false;
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
  playerId = s.activePlayerId,
) {
  const p = seatView(s, playerId).player;
  let found: Piece | undefined;
  for (const cards of [p.deck, p.hand, p.discard, p.inPlay]) {
    const index = cards.findIndex((p) => p.code === code);
    if (index >= 0) {
      found = cards.splice(index, 1)[0];
      break;
    }
  }
  found ||= { ...makePiece(s, code), ownerId: playerId };
  p[zone].push(found);
  return found;
}
function top(s: GameState, ...codes: string[]) {
  const cards = codes.map((code) => take(s, code));
  for (const p of cards)
    s.player.hand.splice(
      s.player.hand.findIndex((x) => x.id === p.id),
      1,
    );
  s.player.deck.unshift(...cards);
  return cards;
}
function onlyDeck(s: GameState, ...codes: string[]) {
  const cards = top(s, ...codes);
  s.player.discard.push(...s.player.deck.splice(cards.length));
  return cards;
}
function pay(s: GameState, ids: string[]) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("payment");
  return command(s, { type: "PAY", ids });
}
function play(s: GameState, p: Piece, resources: Piece[]) {
  s = command(s, { type: "PLAY", id: p.id });
  return s.prompt?.kind === "payment"
    ? pay(
        s,
        resources.map((p) => p.id),
      )
    : s;
}
function respond(s: GameState, code: string) {
  for (
    let n = 0;
    s.prompt && !s.prompt.options.some((o) => o.image === code) && n < 40;
    n++
  ) {
    const id = pass(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  const option = s.prompt?.options.find((o) => o.image === code);
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, option!.id);
}

describe("MTS independent physical source and payment review", () => {
  it("native source launch extracts the same three Permanent forms from43 and keeps only40 in deck/hand", () => {
    let s = opening("spectrum", "warlock");
    const ids = s.player.inPlay.map((p) => p.id);
    expect(s.player.inPlay.map((p) => p.code).sort()).toEqual([
      "21002",
      "21003",
      "21004",
    ]);
    expect(ids).toHaveLength(3);
    expect(s.player.inPlay.every((p) => !spectrumFormFaceup(s, p))).toBe(true);
    s = command(s, { type: "FLIP" });
    const photon = s.prompt!.options.find((o) => o.image === "21003")!;
    s = choose(s, photon.id);
    s = finish(s);
    expect(spectrumEnergyForm(s)).toBe("photon");
    expect(heroStats(s).thwart).toBe(3);
    expect(s.player.inPlay.map((p) => p.id)).toEqual(ids);
    s.player.flipped = false;
    s = command(s, { type: "FLIP" });
    expect(spectrumEnergyForm(s)).toBeUndefined();
    expect(s.player.inPlay.every((p) => !spectrumFormFaceup(s, p))).toBe(true);
    expect((s as ReviewState).reviewOriginalIds.p1).toHaveLength(43);
    expect((s as ReviewState).reviewOriginalIds.p2).toHaveLength(40);
    conserved(s);
  });

  it("all four Warlock aspects are automatic and logical non-signature singleton survives reprints", () => {
    const source = deckCodes("warlock", "justice");
    expect(deckErrors("warlock", "justice", source)).toEqual([]);
    for (const color of ["aggression", "justice", "leadership", "protection"])
      expect(
        source.filter((code) => card(code).faction_code === color),
      ).toHaveLength(6);
    const duplicate = [...source];
    duplicate[duplicate.indexOf("21042")] = "01054";
    expect(
      deckErrors("warlock", "justice", duplicate).some((e) =>
        /Uppercut.*1|singleton/i.test(e),
      ),
    ).toBe(true);
    const s = opening("warlock");
    expect((s as ReviewState).reviewOriginalIds.p1).toHaveLength(40);
    conserved(s);
  });

  for (const [code, expected] of [
    ["21042", "damage"],
    ["21048", "threat"],
    ["21054", "draw"],
    ["21060", "heal"],
  ] as const) {
    it(`${code} preserves one owned physical instance from PLAY through encounter reveal to Removed`, () => {
      let s = base("warlock", "spider_man");
      const entity = take(s, code),
        staff = take(s, "21034", "inPlay"),
        other = take(s, "21040");
      s = command(s, { type: "PLAY", id: entity.id });
      s = pay(s, [staff.id, other.id]);
      s = finish(s);
      expect(s.encounter.deck.filter((p) => p.id === entity.id)).toHaveLength(
        1,
      );
      expect(s.player.discard.some((p) => p.id === entity.id)).toBe(false);
      const physical = s.encounter.deck.splice(
        s.encounter.deck.findIndex((p) => p.id === entity.id),
        1,
      )[0];
      const before = seatView(s, "p2").player;
      before.hp = 5;
      const count = before.hand.length;
      s = native(s, { type: "reveal", piece: physical, actorId: "p2" });
      s = finish(s);
      expect(s.removed.filter((p) => p.id === entity.id)).toHaveLength(1);
      expect(s.removed.find((p) => p.id === entity.id)?.ownerId).toBe("p1");
      expect(s.encounter.discard.some((p) => p.id === entity.id)).toBe(false);
      if (expected === "damage") expect(s.villain.hp).toBe(48);
      if (expected === "threat") expect(s.scheme.threat).toBe(10);
      if (expected === "draw")
        expect(seatView(s, "p2").player.hand).toHaveLength(count + 1);
      if (expected === "heal") expect(seatView(s, "p2").player.hp).toBe(7);
      conserved(s);
    });

    it(`${code} used as an actual boost has no When Revealed effect and goes to encounter discard`, () => {
      let s = base("warlock");
      const entity = take(s, code),
        payment = [take(s, "21034"), take(s, "21040")];
      s = finish(play(s, entity, payment));
      const index = s.encounter.deck.findIndex((p) => p.id === entity.id);
      s.encounter.deck.unshift(...s.encounter.deck.splice(index, 1));
      s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(
        s.encounter.discard.filter((p) => p.id === entity.id),
      ).toHaveLength(1);
      expect(s.player.discard.some((p) => p.id === entity.id)).toBe(false);
      expect(s.removed.some((p) => p.id === entity.id)).toBe(false);
      expect(s.villain.hp).toBe(50);
      expect(s.scheme.threat).toBe(12);
      expect(s.player.hand).toHaveLength(0);
      expect(s.player.hp).toBe(9);
      conserved(s);
    });
  }

  it("a Cosmic Entity spent as a resource stays in its owner's player discard and does not become an encounter", () => {
    let s = base("warlock");
    const event = take(s, "21040"),
      entity = take(s, "21042"),
      target = take(s, "21065", "discard");
    s = play(s, event, [entity]);
    s = choose(s, target.id);
    s = finish(s);
    expect(s.player.discard.filter((p) => p.id === entity.id)).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === entity.id)).toBe(false);
    expect(s.villain.hp).toBe(50);
    conserved(s);
  });

  it("a matching Power card doubles for paying the Cosmic Entity's actual card cost", () => {
    let s = base("warlock");
    const entity = take(s, "21042"),
      power = take(s, "01055");
    s = command(s, { type: "PLAY", id: entity.id });
    const available = paymentSources(s, entity.id, s.prompt?.paymentTarget);
    expect(available.find((p) => p.id === power.id)?.resources).toEqual([
      "wild",
      "wild",
    ]);
    expect(paymentStatus(available, [power.id], 2).ready).toBe(true);
    s = finish(pay(s, [power.id]));
    expect(s.encounter.deck.some((p) => p.id === entity.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === power.id)).toBe(true);
    conserved(s);
  });

  it("Marvel Boy's actual ally-ability payment doubles Power of Aggression and preserves piercing/ranged", () => {
    let s = base("warlock");
    const ally = take(s, "21041", "inPlay"),
      power = take(s, "01055");
    s.villain.tough = true;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = respond(s, "21041");
    expect(s.prompt?.paymentTarget).toBe("21041");
    expect(s.prompt?.requirements).toEqual(["physical"]);
    const sources = paymentSources(s, undefined, s.prompt?.paymentTarget);
    expect(sources.find((p) => p.id === power.id)?.resources).toEqual([
      "wild",
      "wild",
    ]);
    s = pay(s, [power.id]);
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
    expect(s.player.discard.filter((p) => p.id === power.id)).toHaveLength(1);
    conserved(s);
  });

  it("Pip's typed ability cost stays Hero-classified, excludes himself and transfers the original owned ally", () => {
    let s = base("warlock", "spider_man");
    const pip = take(s, "21032"),
      aggression = take(s, "01055"),
      justice = take(s, "01062");
    s.player.form = "alter";
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
      "21032",
    );
    expect(s.activePlayerId).toBe("p1");
    expect(s.prompt?.requirements).toEqual(["energy", "mental"]);
    const sources = paymentSources(s, pip.id, s.prompt?.paymentTarget);
    expect(sources.some((p) => p.id === pip.id)).toBe(false);
    expect(sources.find((p) => p.id === aggression.id)?.resources).toEqual([
      "wild",
    ]);
    expect(sources.find((p) => p.id === justice.id)?.resources).toEqual([
      "wild",
    ]);
    expect(
      paymentStatus(sources, [aggression.id], 2, ["energy", "mental"]).ready,
    ).toBe(false);
    s = pay(s, [aggression.id, justice.id]);
    s = finish(s);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === pip.id),
    ).toMatchObject({ ownerId: "p1", code: "21032", tough: true });
    expect(seatView(s, "p1").player.hand.some((p) => p.id === pip.id)).toBe(
      false,
    );
    conserved(s);
  });

  it("canceling Pip's attack interrupt preserves its actual hand card and all uncommitted resources", () => {
    let s = base("warlock", "spider_man");
    const pip = take(s, "21032"),
      staff = take(s, "21034", "inPlay"),
      mental = take(s, "21042");
    s.player.form = "alter";
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
      "21032",
    );
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    const owner = seatView(s, "p1").player;
    expect(owner.hand.some((p) => p.id === pip.id)).toBe(true);
    expect(owner.hand.some((p) => p.id === mental.id)).toBe(true);
    expect(owner.inPlay.find((p) => p.id === staff.id)?.exhausted).toBe(false);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === pip.id)).toBe(
      false,
    );
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    conserved(s);
  });
});

describe("MTS independent before-arrow costs and actual deck exhaustion", () => {
  for (const [code, status] of [
    ["21038", "stunned"],
    ["21039", "confused"],
  ] as const) {
    it(`${code} pays its physical initial cost and original top cards even when ${status} replaces its effect`, () => {
      let s = base("warlock");
      const event = take(s, code),
        resources = [take(s, "21034"), take(s, "21040")];
      const milled = top(s, "21042", "21048", "21054", "21060");
      s.player[status] = true;
      s = play(s, event, resources);
      // Counts are committed before any of these four physical faces are revealed.
      s = choose(s, "4");
      if (
        s.prompt?.options.some(
          (o) => o.id === (code === "21038" ? s.villain.id : "main"),
        )
      )
        s = choose(s, code === "21038" ? s.villain.id : "main");
      s = finish(s);
      expect(s.player[status]).toBe(false);
      for (const p of milled)
        expect(s.player.discard.some((x) => x.id === p.id)).toBe(true);
      expect(s.villain.hp).toBe(code === "21038" ? 46 : 50);
      expect(s.scheme.threat).toBe(code === "21039" ? 9 : 12);
      conserved(s);
    });
  }

  for (const code of ["21043", "21050"]) {
    it(`${code} offers only positive discard costs and rejects an empty original deck before resources are spent`, () => {
      let s = base("warlock");
      const event = take(s, code),
        resource = take(s, "21034");
      s = play(s, event, [resource]);
      s = choose(s, code === "21043" ? s.villain.id : "main");
      expect(s.prompt?.options.some((o) => o.id === "0")).toBe(false);
      s = choose(s, "1");
      s = finish(s);
      const next = take(s, code);
      s.player.discard.push(...s.player.deck.splice(0));
      expect(playable(s, next)).toMatch(/actual cards|deck card/i);
      conserved(s);
    });
  }

  it("Battle Mage discards an actual Basic card as an effect and still opens both physical Mystic Senses responses", () => {
    let s = base("warlock");
    const basic = take(s, "21065"),
      first = take(s, "21037", "inPlay"),
      second = take(s, "21037", "inPlay");
    const drawn = top(s, "21042", "21048");
    s = command(s, { type: "ABILITY", id: "hero", action: "battle-mage" });
    expect(s.prompt?.kind).toBe("choice");
    s = choose(s, basic.id);
    expect(s.player.discard.some((p) => p.id === basic.id)).toBe(true);
    s = choose(s, second.id);
    s = choose(s, first.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    expect(s.villain.hp).toBe(50);
    expect(s.scheme.threat).toBe(12);
    conserved(s);
  });

  it("a simultaneous short-deck spell cost resets exactly once, stops milling, and captures actual Soul World", () => {
    let s = base("warlock");
    const event = take(s, "21038"),
      resources = [take(s, "21034"), take(s, "21040")],
      world = take(s, "21033", "inPlay");
    const original = onlyDeck(s, "21042", "21048");
    s = play(s, event, resources);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["1", "2"]);
    s = choose(s, "2");
    expect(s.prompt?.title).toBe("Soul World");
    s = choose(s, "yes");
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.villain.hp).toBe(44);
    expect(s.player.deck.some((p) => p.id === original[0].id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === original[1].id)).toBe(true);
    conserved(s);
  });

  it("repeated observations of the same actually exhausted empty deck do not create extra Soul World responses", () => {
    let s = base("warlock");
    const world = take(s, "21033", "inPlay"),
      last = top(s, "21042")[0];
    s.player.hand.push(...s.player.deck.splice(1));
    s = native(s, { type: "draw", amount: 3 });
    expect(s.prompt?.title).toBe("Soul World");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.player.hand.some((p) => p.id === last.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(0);
    s = finish(native(s, { type: "draw", amount: 2 }));
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.encounter.dealt).toHaveLength(0);
    conserved(s);
  });

  it("the actual Church reset's forced exhaust/stun precedes the captured Soul World optional response", () => {
    let s = base("warlock");
    const world = take(s, "21033", "inPlay"),
      church = makePiece(s, "21068");
    church.counters = 6;
    s.sideSchemes.push(church);
    onlyDeck(s, "21042");
    s = native(s, { type: "draw", amount: 1 });
    expect(s.prompt?.title).toBe("Soul World");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    conserved(s);
  });

  it("a two-card payment resets one physical pool before spent-resource benefits and never repeats the prior exhaustion", () => {
    let s = base("warlock");
    const world = take(s, "21033", "inPlay"),
      entity = take(s, "21042"),
      audacity = take(s, "21046"),
      determination = take(s, "21052");
    const last = top(s, "21065")[0];
    s.player.hand.push(...s.player.deck.splice(1));
    s = native(s, { type: "draw", amount: 1 });
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === last.id)).toBe(true);
    expect(s.player.deck).toHaveLength(0);
    const church = makePiece(s, "21068");
    church.counters = 6;
    s.sideSchemes.push(church);
    s = command(s, { type: "PLAY", id: entity.id });
    s = pay(s, [audacity.id, determination.id]);
    expect(s.prompt?.title).toBe("Audacity");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      [audacity.id, determination.id].sort(),
    );
    expect(s.player.discard).toHaveLength(0);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.resolving.some((p) => p.id === entity.id)).toBe(false);
    s = choose(s, "yes");
    expect(s.villain.hp).toBe(49);
    expect(s.prompt?.title).toBe("Determination");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.scheme.threat).toBe(11);
    expect(s.encounter.deck.some((p) => p.id === entity.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    conserved(s);
  });

  it("Shield Spell's prevention ends the damage occurrence without reopening Parry or Energy Barrier", () => {
    let s = base("warlock");
    const spell = take(s, "21061"),
      barrier = take(s, "05017", "inPlay"),
      parry = take(s, "19006");
    barrier.counters = 3;
    const originalTop = top(s, "21042", "21048");
    s = respond(native(s, { type: "enemyAttack", id: s.villain.id }), "21061");
    expect(s.review).toBeNull();
    expect(s.prompt).toBeNull();
    expect(s.attack).toBeNull();
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.find((p) => p.id === barrier.id)?.counters).toBe(3);
    expect(s.player.hand.some((p) => p.id === parry.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === spell.id)).toHaveLength(1);
    for (const p of originalTop)
      expect(s.player.discard.some((x) => x.id === p.id)).toBe(true);
    conserved(s);
  });
});

describe("MTS independent simultaneous friendly damage placement", () => {
  it("Bound by Duty damages every original friendly recipient across both player seats", () => {
    let s = base("spectrum", "warlock");
    const first = take(s, "21019", "inPlay"),
      second = take(s, "21032", "inPlay", "p2"),
      scheme = makePiece(s, "21028");
    first.damage = 1;
    second.tough = false;
    second.toughCards = 0;
    second.damage = 0;
    scheme.counters = 1;
    s.sideSchemes.push(scheme);
    s = finish(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 1,
        source: "hero",
        action: false,
      }),
    );
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === first.id)?.damage,
    ).toBe(2);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === second.id)?.damage,
    ).toBe(1);
    expect(s.encounter.discard.some((p) => p.id === scheme.id)).toBe(true);
    conserved(s);
  });

  it("a lethal batch places the teammate and ally damage before eliminating the first identity", () => {
    let s = base("spectrum", "warlock");
    const ally = take(s, "21019", "inPlay"),
      scheme = makePiece(s, "21028");
    ally.damage = 2;
    s.player.hp = 1;
    seatView(s, "p2").player.hp = 5;
    scheme.counters = 1;
    s.sideSchemes.push(scheme);
    s = finish(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 1,
        source: "hero",
        action: false,
      }),
    );
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(4);
    expect(pieces(s).filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.removed.some((p) => p.id === ally.id)).toBe(true);
    conserved(s);
  });
});
