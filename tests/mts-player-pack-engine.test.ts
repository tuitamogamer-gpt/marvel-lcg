import { describe, expect, it } from "vitest";
import {
  allyLimit,
  cardCost,
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { card, heroStats, pieceHP } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

type Hero = "spectrum" | "warlock";
type State = GameState & { mtsPackOriginalIds?: Record<string, string[]> };
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function physical(s: GameState) {
  const ps: Piece[] = s.players.flatMap((seat) => {
    const p = seatView(s, seat).player;
    return [
      ...p.hand,
      ...p.deck,
      ...p.discard,
      ...p.inPlay,
      ...(p.setAside || []),
    ];
  });
  ps.push(
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
    ps.push(...children);
    children.forEach(nested);
  };
  [...ps].forEach(nested);
  return ps;
}
function conserved(s: GameState) {
  const ps = physical(s);
  for (const [owner, ids] of Object.entries(
    (s as State).mtsPackOriginalIds || {},
  ))
    for (const id of ids) {
      const found = ps.filter((p) => p.id === id);
      expect(found, `owned original ${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
}
function command(s: GameState, cmd: Command) {
  s = dispatch(reload(s), cmd);
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
const pass = (s: GameState) =>
  s.prompt?.options.find((o) =>
    /^(skip|pass|none|done|continue|no|decline|take|resolve)$/.test(o.id),
  )?.id;
function finish(s: GameState) {
  for (let n = 0; s.prompt && n < 150; n++) {
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
function until(s: GameState, predicate: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !predicate(s) && n < 120; n++) {
    const id = pass(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(predicate(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Shared pool native rule fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function base(hero: Hero, other?: Hero) {
  const aspect = hero === "spectrum" ? "leadership" : "aggression";
  let s = newGame({
    heroId: hero,
    aspect,
    villainId: "rhino",
    seed: 21055,
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
                  : ("aggression" as const),
            },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as State).mtsPackOriginalIds = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player;
      expect(p.hand.length + p.deck.length).toBe(40);
      const ps = [...p.hand, ...p.deck, ...p.discard, ...p.inPlay];
      expect(ps).toHaveLength(seat.heroId === "spectrum" ? 43 : 40);
      return [seat.id, ps.map((p) => p.id)];
    }),
  );
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(
      ...v.player.hand.splice(0),
      ...v.player.discard.splice(0),
    );
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    if (seat.heroId === "spectrum")
      v.flags.spectrumEnergyFormId = v.player.inPlay.find(
        (p) => p.code === "21002",
      )!.id;
  }
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 12;
  s.villain.hp = s.villain.maxHp = 60;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
  playerId = s.activePlayerId,
) {
  const v = seatView(s, playerId);
  let p: Piece | undefined;
  for (const a of [
    v.player.deck,
    v.player.hand,
    v.player.discard,
    v.player.inPlay,
  ]) {
    const i = a.findIndex((p) => p.code === code);
    if (i >= 0) {
      p = a.splice(i, 1)[0];
      break;
    }
  }
  p ||= { ...makePiece(s, code), ownerId: playerId };
  v.player[zone].push(p);
  return p;
}
function top(s: GameState, ...codes: string[]) {
  const ps = codes.map((code) => take(s, code));
  for (const p of ps)
    s.player.hand.splice(
      s.player.hand.findIndex((q) => q.id === p.id),
      1,
    );
  s.player.deck.unshift(...ps);
  return ps;
}
function onlyDeck(s: GameState, ...codes: string[]) {
  const ps = top(s, ...codes);
  s.player.discard.push(...s.player.deck.splice(ps.length));
  return ps;
}
function pay(s: GameState, ps: Piece[], sourceIds: string[] = []) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("payment");
  return command(s, {
    type: "PAY",
    ids: [...ps.map((p) => p.id), ...sourceIds],
  });
}
function play(s: GameState, p: Piece, ps: Piece[] = []) {
  s = command(s, { type: "PLAY", id: p.id });
  return s.prompt?.kind === "payment" ? pay(s, ps) : s;
}

describe("Original physical MTS player pools in the native engine", () => {
  it("retains both complete forty-card source decks plus exactly three physical Spectrum setup cards", () => {
    const s = base("spectrum", "warlock");
    expect(
      Object.values((s as State).mtsPackOriginalIds!).map((ids) => ids.length),
    ).toEqual([43, 40]);
    conserved(reload(s));
  });
  it("Avengers Tower and per-character Captain America reductions let Band Together alone pay the actual ally cost", () => {
    let s = base("spectrum");
    const tower = take(s, "21020", "inPlay");
    take(s, "21012", "inPlay");
    take(s, "21019", "inPlay");
    const captain = take(s, "21011"),
      band = take(s, "21018");
    s = command(s, { type: "ABILITY", id: tower.id, action: "tower" });
    expect(cardCost(s, card(captain), captain)).toBe(2);
    expect(
      paymentSources(s, captain.id, captain.code).find(
        (source) => source.id === band.id,
      )?.resources,
    ).toEqual(["wild", "wild"]);
    s = finish(play(s, captain, [band]));
    expect(s.player.inPlay.find((p) => p.id === captain.id)).toMatchObject({
      tough: true,
    });
    expect(s.flags.mtsPackTowerDiscount).toBeUndefined();
    expect(allyLimit(s)).toBe(4);
    conserved(s);
  });
  it("Power Man actually enters with two chi and spends both without exhausting to add four ATK for this phase", () => {
    let s = base("spectrum");
    const p = take(s, "21012"),
      energy = take(s, "21023"),
      genius = take(s, "21024");
    s = finish(play(s, p, [energy, genius]));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(2);
    s = command(s, { type: "ABILITY", id: p.id, action: "chi-2" });
    expect(s.player.inPlay.find((q) => q.id === p.id)).toMatchObject({
      counters: 0,
      exhausted: false,
    });
    s = command(s, { type: "ABILITY", id: p.id, action: "attack" });
    s = finish(s);
    expect(s.villain.hp).toBe(56);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(
      card(p).attack_cost,
    );
    conserved(s);
  });
  it("Make the Call puts the same discarded Power Man back as a fresh instance with two chi and no previous phase bonus", () => {
    let s = base("spectrum");
    const power = take(s, "21012", "inPlay");
    power.counters = 2;
    s = command(s, { type: "ABILITY", id: power.id, action: "chi-2" });
    expect(s.flags["mtsPackChi:" + power.id]).toBe(4);
    s = finish(native(s, { type: "discardPiece", id: power.id }));
    const call = take(s, "21056"),
      rs = [take(s, "21023"), take(s, "21024")];
    s = play(s, call);
    expect(s.prompt?.title).toBe("Make the Call");
    s = choose(reload(s), power.id);
    expect(s.prompt?.cost).toBe(3);
    s = pay(reload(s), rs);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === power.id)).toMatchObject({
      counters: 2,
      damage: 0,
      exhausted: false,
    });
    expect(s.flags["mtsPackChi:" + power.id]).toBeUndefined();
    conserved(s);
  });
  it("White Tiger's actual hand play draws the villain's stage while putting her into play does not", () => {
    let s = base("spectrum");
    s.villain.stage = 2;
    s.villain.code = "01095";
    const tiger = take(s, "21013"),
      resources = [take(s, "21023"), take(s, "21024")],
      drawn = top(s, "21016", "21017");
    s = play(s, tiger, resources);
    expect(s.prompt?.title).toBe("White Tiger");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    conserved(s);
  });
  it("Mass Attack resolves as one hero attack and exhausts allies without Blade payment, ally damage or basic responses", () => {
    let s = base("spectrum");
    take(s, "21015", "inPlay");
    const a = take(s, "21012", "inPlay"),
      b = take(s, "21019", "inPlay"),
      c = take(s, "21014", "inPlay");
    a.counters = 2;
    s = command(s, { type: "ABILITY", id: a.id, action: "chi-2" });
    const event = take(s, "21016"),
      rs = [take(s, "21023"), take(s, "21024")];
    s = play(s, event, rs);
    expect(s.prompt?.title).toBe("Mass Attack");
    s = choose(reload(s), [a, b, c].map((p) => p.id).join("+"));
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.exhausted).toBe(false);
    for (const p of [a, b, c])
      expect(s.player.inPlay.find((q) => q.id === p.id)).toMatchObject({
        exhausted: true,
        damage: 0,
      });
    conserved(s);
  });
  it("a stunned Mass Attack still pays all three additional exhaust costs and clears the status without dealing damage", () => {
    let s = base("spectrum");
    const ps = [
        take(s, "21012", "inPlay"),
        take(s, "21019", "inPlay"),
        take(s, "21014", "inPlay"),
      ],
      event = take(s, "21016"),
      rs = [take(s, "21023"), take(s, "21024")];
    s.player.stunned = true;
    s = play(s, event, rs);
    s = choose(s, ps.map((p) => p.id).join("+"));
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(60);
    expect(
      ps.every((p) => s.player.inPlay.find((q) => q.id === p.id)?.exhausted),
    ).toBe(true);
    expect(s.flags["mtsPackEventCost:" + event.id]).toBeUndefined();
    conserved(s);
  });
  it("Mass Attack accepts Kaluu's Mystic trait and the other allies' Guardian trait independently against Warlock", () => {
    let s = base("warlock");
    const ps = [
        take(s, "21014", "inPlay"),
        take(s, "21047", "inPlay"),
        take(s, "21065", "inPlay"),
      ],
      event = take(s, "21016"),
      rs = [take(s, "21034"), take(s, "21040"), take(s, "21036")];
    expect(playable(s, event)).toBeNull();
    s = play(s, event, rs);
    expect(s.prompt?.title).toBe("Mass Attack");
    s = choose(s, ps.map((p) => p.id).join("+"));
    s = finish(s);
    expect(s.villain.hp).toBe(
      60 - 1 - ps.reduce((n, p) => n + Number(card(p).attack || 0), 0),
    );
    conserved(s);
  });
});

describe("Saved physical Mystic additional costs and spent resources", () => {
  it.each([
    ["21043", "stunned"],
    ["21050", "confused"],
  ] as const)(
    "%s pays a positive exact deck cost before %s cancels its entire body",
    (code, status) => {
      let s = base("warlock");
      const event = take(s, code),
        r = take(s, "21034"),
        milled = onlyDeck(s, "21042", "21048");
      s.player[status] = true;
      s = play(s, event, [r]);
      s = choose(s, code === "21043" ? s.villain.id : "main");
      expect(s.prompt?.options.map((o) => o.id)).toEqual(["1", "2"]);
      s = choose(reload(s), "2");
      s = finish(s);
      expect(s.player[status]).toBe(false);
      expect(s.villain.hp).toBe(60);
      expect(s.scheme.threat).toBe(12);
      expect(s.encounter.dealt).toHaveLength(1);
      expect(s.flags["mtsPackEventCost:" + event.id]).toBeUndefined();
      for (const p of milled)
        expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
      conserved(s);
    },
  );
  it("empty original decks reject up-to spell costs before spending any resource even if Stun would cancel", () => {
    const s = base("warlock"),
      event = take(s, "21043"),
      r = take(s, "21034");
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.stunned = true;
    expect(playable(s, event)).toMatch(/actual cards|deck card/i);
    expect(s.player.hand.some((p) => p.id === r.id)).toBe(true);
    conserved(s);
  });
  it("Summoning Spell's Kaluu enter-play response waits until the actual spell has finished and discarded", () => {
    let s = base("warlock");
    const event = take(s, "21055"),
      r = take(s, "21034"),
      r2 = take(s, "21040"),
      ps = top(s, "21042", "21014", "21043");
    s = play(s, event, [r, r2]);
    expect(s.prompt?.title).toBe("Kaluu");
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === ps[1].id)).toBe(true);
    s = choose(s, "yes");
    expect(s.prompt?.options.some((o) => o.id === ps[2].id)).toBe(true);
    s = choose(reload(s), ps[2].id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === ps[2].id)).toBe(true);
    conserved(s);
  });
  it("Summoning Spell uses the same physical last ally after an immediate player-deck recycle", () => {
    let s = base("warlock");
    const event = take(s, "21055"),
      rs = [take(s, "21034"), take(s, "21040")],
      ps = onlyDeck(s, "21042", "21047");
    s = play(s, event, rs);
    expect(s.prompt?.title).toBe("Quasar");
    expect(s.player.inPlay.some((p) => p.id === ps[1].id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === ps[1].id)).toBe(false);
    s = finish(s);
    expect(s.encounter.dealt).toHaveLength(1);
    conserved(s);
  });
  it("Summoning Spell stops at the first duplicate unique ally instead of continuing to the playable second ally", () => {
    let s = base("warlock");
    const existing = take(s, "21065", "inPlay"),
      event = take(s, "21055"),
      rs = [take(s, "21034"), take(s, "21040")],
      ps = [
        { ...makePiece(s, "21065"), ownerId: s.activePlayerId },
        ...top(s, "21047"),
      ];
    s.player.deck.unshift(ps[0]);
    s = finish(play(s, event, rs));
    expect(
      s.player.inPlay
        .filter((p) => card(p).name === "Martinex")
        .map((p) => p.id),
    ).toEqual([existing.id]);
    expect(s.player.discard.some((p) => p.id === ps[0].id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === ps[1].id)).toBe(true);
    conserved(s);
  });
  it("actual spent Audacity and Determination resolve without attack/thwart labels and do not consume status cards", () => {
    let s = base("warlock");
    s.player.stunned = true;
    s.player.confused = true;
    const event = take(s, "21042"),
      a = take(s, "21046"),
      d = take(s, "21052");
    s = play(s, event, [a, d]);
    expect(s.prompt?.title).toBe("Audacity");
    s = choose(s, "yes");
    expect(s.prompt?.title).toBe("Determination");
    s = choose(reload(s), "yes");
    s = finish(s);
    expect(s.villain.hp).toBe(59);
    expect(s.scheme.threat).toBe(11);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    conserved(s);
  });
  it("actual spent Innovation only heals an owned ally and Preservation heals the payer's hero", () => {
    let s = base("warlock", "spectrum");
    const own = take(s, "21047", "inPlay"),
      other = take(s, "21012", "inPlay", s.players[1].id);
    own.damage = 1;
    other.damage = 1;
    s.player.hp = 9;
    const event = take(s, "21042"),
      i = take(s, "21058"),
      p = take(s, "21064");
    s = play(s, event, [i, p]);
    s = choose(s, "yes");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([own.id]);
    s = choose(s, own.id);
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.inPlay.find((q) => q.id === own.id)?.damage).toBe(0);
    expect(
      seatView(s, s.players[1].id).player.inPlay.find((q) => q.id === other.id)
        ?.damage,
    ).toBe(1);
    expect(s.player.hp).toBe(10);
    conserved(s);
  });
  it("a normal zero-cost Shield Spell can overpay actual resources and resolve all four spent responses before its discard cost", () => {
    let s = base("warlock");
    const spell = take(s, "21061"),
      spent = [
        take(s, "21046"),
        take(s, "21052"),
        take(s, "21058"),
        take(s, "21064"),
      ],
      ally = take(s, "21047", "inPlay");
    ally.damage = 1;
    s.player.hp = 9;
    const deckSize = s.player.deck.length;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "21061"));
    s = choose(s, s.prompt!.options.find((o) => o.image === "21061")!.id);
    expect(s.prompt?.title).toBe("Shield Spell");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["continue", "spend"]);
    s = choose(reload(s), "spend");
    expect(s.prompt?.cost).toBe(0);
    s = pay(reload(s), spent);
    for (const name of [
      "Audacity",
      "Determination",
      "Innovation",
      "Preservation",
    ]) {
      expect(s.prompt?.title).toBe(name);
      s = choose(reload(s), "yes");
      if (name === "Innovation") s = choose(s, ally.id);
    }
    s = finish(s);
    expect(s.villain.hp).toBe(59);
    expect(s.scheme.threat).toBe(11);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    expect(s.player.deck).toHaveLength(deckSize - 2);
    for (const p of [...spent, spell])
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    conserved(s);
  });
});

describe("Native ally payments, defeat interrupts and full attack prevention", () => {
  it("Blade's forced response spends a physical resource from hand even while its controller is in alter-ego", () => {
    let s = base("spectrum");
    const blade = take(s, "21019", "inPlay"),
      power = take(s, "13024"),
      unused = take(s, "21016");
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: blade.id, action: "attack" });
    expect(s.prompt?.title).toBe("Blade");
    s = choose(s, "pay");
    expect(s.prompt?.handOnly).toBe(true);
    expect(s.prompt?.paymentTarget).toBe("21019");
    expect(
      paymentSources(s, undefined, s.prompt?.paymentTarget, true).find(
        (p) => p.id === power.id,
      )?.resources,
    ).toEqual(["wild", "wild"]);
    s = pay(reload(s), [power]);
    s = finish(s);
    expect(s.villain.hp).toBe(58);
    expect(s.player.inPlay.find((p) => p.id === blade.id)?.damage).toBe(0);
    expect(s.player.hand.some((p) => p.id === unused.id)).toBe(true);
    conserved(s);
  });
  it("Blade cannot use an in-play Resourceful generator and discards when no physical resource is in hand", () => {
    let s = base("spectrum");
    const blade = take(s, "21019", "inPlay"),
      resourceful = take(s, "20020", "inPlay");
    s = finish(command(s, { type: "ABILITY", id: blade.id, action: "attack" }));
    expect(s.player.discard.some((p) => p.id === blade.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === resourceful.id)).toBe(true);
    expect(s.villain.hp).toBe(58);
    conserved(s);
  });
  it("Marvel Boy spends Power of Aggression for piercing/ranged, removes Tough and avoids actual Retaliate", () => {
    let s = base("warlock");
    const boy = take(s, "21041", "inPlay"),
      power = take(s, "01055");
    const enemy = makePiece(s, "01172");
    enemy.engagedWith = s.activePlayerId;
    enemy.tough = true;
    s.minions.push(enemy);
    s = command(s, { type: "ABILITY", id: boy.id, action: "attack" });
    s = choose(s, enemy.id);
    expect(s.prompt?.title).toBe("Marvel Boy");
    s = choose(s, boy.id);
    expect(s.prompt?.paymentTarget).toBe("21041");
    expect(
      paymentSources(s, undefined, "21041").find((p) => p.id === power.id)
        ?.resources,
    ).toEqual(["wild", "wild"]);
    s = pay(reload(s), [power]);
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      tough: false,
      damage: 2,
    });
    expect(s.player.inPlay.find((p) => p.id === boy.id)?.damage).toBe(
      card(boy).attack_cost || 0,
    );
    conserved(s);
  });
  it("Major Victory's defeat interrupt readies a friendly Guardian in another seat before the same physical ally discards", () => {
    let s = base("spectrum", "warlock");
    const major = take(s, "21053", "inPlay"),
      guardian = take(s, "21041", "inPlay", s.players[1].id);
    guardian.exhausted = true;
    s = native(s, {
      type: "damage",
      target: major.id,
      amount: pieceHP(s, major),
      source: "fixture",
    });
    expect(s.prompt?.title).toBe("Major Victory");
    s = choose(reload(s), guardian.id);
    s = finish(s);
    expect(
      seatView(s, s.players[1].id).player.inPlay.find(
        (p) => p.id === guardian.id,
      )?.exhausted,
    ).toBe(false);
    expect(s.player.discard.some((p) => p.id === major.id)).toBe(true);
    conserved(s);
  });
  it("Major Victory does not respond when discarded as an ally-limit cost", () => {
    let s = base("warlock");
    const p = take(s, "21053", "inPlay");
    s.player.exhausted = true;
    s = finish(native(s, { type: "discardPiece", id: p.id }));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    conserved(s);
  });
  it("Major Victory readies a Guardian before a saved Regroup interrupt returns that same defeated ally to its owner, preserving Overkill", () => {
    let s = base("warlock");
    const major = take(s, "21053", "inPlay"),
      regroup = take(s, "19032", "inPlay");
    s.player.exhausted = true;
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, major.id);
    s = until(s, (v) => v.prompt?.title === "Major Victory");
    expect(s.prompt?.options.some((o) => o.id === regroup.id)).toBe(true);
    s = choose(reload(s), "hero");
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === major.id)?.pendingDefeat).toBe(
      true,
    );
    expect(s.prompt?.options.map((o) => o.id)).toEqual([regroup.id, "defeat"]);
    s = choose(reload(s), regroup.id);
    s = finish(s);
    expect(s.player.hand.find((p) => p.id === major.id)?.ownerId).toBe(
      s.activePlayerId,
    );
    expect(s.player.discard.some((p) => p.id === major.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 3);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    conserved(s);
  });
  it("a teammate's Major Victory readies that teammate's hero through the correct saved actor context", () => {
    let s = base("spectrum", "warlock");
    const otherId = s.players[1].id,
      p = take(s, "21053", "inPlay", otherId);
    s.player.exhausted = true;
    seatView(s, otherId).player.exhausted = true;
    s = native(s, {
      type: "damage",
      target: p.id,
      amount: pieceHP(seatView(s, otherId), p),
      source: "fixture",
    });
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
    s = choose(reload(s), "hero");
    s = finish(s);
    expect(seatView(s, otherId).player.exhausted).toBe(false);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, otherId).player.discard.some((q) => q.id === p.id)).toBe(
      true,
    );
    conserved(s);
  });
  it("Charlie-27 receives printed Toughness on actual play and retaliates against an enemy attack even when Tough prevents its damage", () => {
    let s = base("warlock");
    const ally = take(s, "21059"),
      rs = [
        take(s, "21034"),
        take(s, "21040"),
        take(s, "21036"),
        take(s, "21038"),
      ];
    s = finish(play(s, ally, rs));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(true);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    s = finish(s);
    expect(s.villain.hp).toBe(59);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      tough: false,
      damage: 0,
    });
    conserved(s);
  });
  it("Shield Spell discards exactly the real incoming amount, defends once and suppresses later would-take offers after full prevention", () => {
    let s = base("warlock");
    const spell = take(s, "21061"),
      extra = take(s, "19015"),
      milled = top(s, "21042", "21048");
    const initialDeckSize = s.player.deck.length,
      beforeHP = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "21061"));
    s = choose(
      reload(s),
      s.prompt!.options.find((o) => o.image === "21061")!.id,
    );
    s = finish(s);
    expect(s.player.hp).toBe(beforeHP);
    expect(s.player.deck).toHaveLength(initialDeckSize - 2);
    expect(s.player.discard.some((p) => p.id === spell.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === extra.id)).toBe(true);
    for (const p of milled)
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.attack).toBeNull();
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    conserved(s);
  });
});

describe("Cosmic Entity native reveal/boost provenance and form response windows", () => {
  it.each([
    ["21042", "damage"],
    ["21048", "threat"],
    ["21054", "draw"],
    ["21060", "heal"],
  ] as const)(
    "%s keeps its actual player owner through an encounter reveal and then removes the same card",
    (code, benefit) => {
      let s = base("warlock", "spectrum");
      const event = take(s, code),
        resources = [take(s, "21034"), take(s, "21040")];
      s = finish(play(s, event, resources));
      expect(
        s.encounter.deck.some((p) => p.id === event.id && p.ownerId === "p1"),
      ).toBe(true);
      const i = s.encounter.deck.findIndex((p) => p.id === event.id);
      const [revealed] = s.encounter.deck.splice(i, 1);
      const p2 = s.players[1].id;
      seatView(s, p2).player.hp = 9;
      const previousHand = seatView(s, p2).player.hand.length;
      s = finish(
        native(s, {
          type: "reveal",
          piece: revealed,
          fromEncounterDeck: true,
          actorId: p2,
        }),
      );
      expect(s.removed.find((p) => p.id === event.id)?.ownerId).toBe("p1");
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
      if (benefit === "damage") expect(s.villain.hp).toBe(58);
      if (benefit === "threat") expect(s.scheme.threat).toBe(10);
      if (benefit === "draw")
        expect(seatView(s, p2).player.hand).toHaveLength(previousHand + 1);
      if (benefit === "heal") expect(seatView(s, p2).player.hp).toBe(11);
      conserved(s);
    },
  );
  it("Living Tribunal respects an actual Crisis while still removing the revealed Cosmic Entity", () => {
    let s = base("warlock");
    const entity = take(s, "21048");
    s.player.hand.splice(
      s.player.hand.findIndex((p) => p.id === entity.id),
      1,
    );
    const crisis = makePiece(s, "01108");
    crisis.counters = 3;
    s.sideSchemes.push(crisis);
    s = finish(
      native(s, { type: "reveal", piece: entity, fromEncounterDeck: true }),
    );
    expect(s.scheme.threat).toBe(12);
    expect(s.removed.some((p) => p.id === entity.id)).toBe(true);
    conserved(s);
  });
  it("a physical Cosmic Entity used as a boost has no reveal benefit and goes to encounter discard with its original owner", () => {
    let s = base("warlock");
    const entity = take(s, "21042");
    s.player.hand.splice(
      s.player.hand.findIndex((p) => p.id === entity.id),
      1,
    );
    s.encounter.deck.unshift(entity);
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.hp).toBe(60);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.discard.find((p) => p.id === entity.id)?.ownerId).toBe(
      "p1",
    );
    expect(s.player.discard.some((p) => p.id === entity.id)).toBe(false);
    expect(s.removed.some((p) => p.id === entity.id)).toBe(false);
    conserved(s);
  });
  it("Spectrum can spend actual Moxie then Rumble through a saved energy-form union after the event's draw effect", () => {
    let s = base("spectrum");
    const rumble = take(s, "21022", "inPlay"),
      moxie = take(s, "21017"),
      event = take(s, "21010"),
      drawn = top(s, "21016");
    s.player.exhausted = true;
    s = play(s, event);
    const photon = s.player.inPlay.find((p) => p.code === "21003")!;
    s = choose(s, photon.id);
    expect(s.player.hand.some((p) => p.id === drawn[0].id)).toBe(true);
    expect(s.prompt?.title).toBe("Photon energy form");
    s = choose(reload(s), moxie.id);
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 4, defense: 2 });
    s = choose(reload(s), rumble.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === moxie.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === rumble.id)).toBe(true);
    conserved(s);
  });
  it("ordinary alter-ego to hero changes offer the same physical Moxie and Rumble response window", () => {
    let s = base("warlock");
    const moxie = take(s, "21017"),
      rumble = take(s, "21022", "inPlay");
    s.player.form = "alter";
    s.player.exhausted = true;
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("After changing form");
    s = choose(reload(s), moxie.id);
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 3 });
    s = choose(reload(s), rumble.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === rumble.id)).toBe(true);
    conserved(s);
  });
  it("phase cleanup expires Tower and Power Man bonuses for every seat while Moxie lasts until the actual round ends", () => {
    let s = base("spectrum", "warlock");
    s.scheme.threat = 2;
    // Hard to Keep Down surges while an undamaged Rhino cannot heal. A deck
    // made entirely of that card would legitimately repeat Surge forever.
    s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01174"));
    for (const seat of s.players) {
      const v = seatView(s, seat);
      v.flags.mtsPackMoxie = 1;
      v.flags.mtsPackTowerDiscount = 1;
      v.flags.mtsPackTowerPhase = `${s.round}:${s.phase}`;
      v.flags["mtsPackChi:physical-test"] = 4;
    }
    s = native(s, { type: "beginVillain" });
    for (const seat of s.players) {
      const v = seatView(s, seat);
      expect(v.flags.mtsPackTowerDiscount).toBeUndefined();
      expect(v.flags["mtsPackChi:physical-test"]).toBeUndefined();
      expect(v.flags.mtsPackMoxie).toBe(1);
    }
    s = finish(s);
    expect(s.phase).toBe("player");
    for (const seat of s.players)
      expect(seatView(s, seat).flags.mtsPackMoxie).toBeUndefined();
    conserved(s);
  });
});

describe("Mystic Spell initiation before resources are committed", () => {
  it("Zone of Silence rejects an empty main with no eligible scheme before payment", () => {
    const s = base("warlock"),
      event = take(s, "21050"),
      r = take(s, "21034");
    s.scheme.threat = 0;
    const deck = s.player.deck.map((p) => p.id);
    expect(playable(s, event)).toMatch(/eligible scheme/);
    const refused = dispatch(reload(s), { type: "PLAY", id: event.id });
    expect(refused.error).toMatch(/eligible scheme/);
    expect(refused.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(refused.player.hand.some((p) => p.id === r.id)).toBe(true);
    expect(refused.player.deck.map((p) => p.id)).toEqual(deck);
    expect(refused.stats!.cardsPlayed).toBe(s.stats!.cardsPlayed);
    conserved(refused);
  });

  it("Confused Zone pays its positive actual deck cost at main zero before clearing the status", () => {
    let s = base("warlock");
    const event = take(s, "21050"),
      r = take(s, "21034"),
      [milled] = top(s, "21042");
    s.scheme.threat = 0;
    s.player.confused = true;
    expect(playable(s, event)).toBeNull();
    s = play(s, event, [r]);
    expect(s.prompt?.title).toBe("Zone of Silence");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["1", "2", "3", "4"]);
    s = choose(reload(s), "1");
    s = finish(s);
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(0);
    expect(s.player.discard.some((p) => p.id === milled.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === r.id)).toBe(true);
    expect(s.flags["mtsPackEventCost:" + event.id]).toBeUndefined();
    conserved(s);
  });
});
