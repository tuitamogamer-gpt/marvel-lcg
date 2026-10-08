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
import { card, heroStats, pieceHP, maxHP } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

type Hero = "nebu" | "gam" | "captain_marvel" | "wsp";
type State = GameState & { nebulaPackOriginalIds?: Record<string, string[]> };
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
    (s as State).nebulaPackOriginalIds || {},
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
    title: "Nebula supplementary native rule fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function base(hero: Hero, other?: Hero) {
  const aspect = "justice" as const;
  let s = newGame({
    heroId: hero,
    aspect,
    villainId: "rhino",
    seed: 22020,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId: hero, aspect },
            {
              heroId: other,
              aspect: "justice" as const,
            },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as State).nebulaPackOriginalIds = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player;
      expect(p.hand.length + p.deck.length).toBe(40);
      const ps = [...p.hand, ...p.deck, ...p.discard, ...p.inPlay];
      expect(ps).toHaveLength(40);
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
  }
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 12;
  s.villain.hp = s.villain.maxHp = 60;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01174"));
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

describe("Nebula supplementary cards through saved native play", () => {
  it("Eros confuses the actual saved Ultron Drone and conserves its captured original player card through scheme and defeat", () => {
    let s = base("nebu");
    const eros = take(s, "22011"),
      genius = take(s, "22025"),
      captured = s.player.deck[0];
    s = finish(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    expect(drone.droneCard?.id).toBe(captured.id);
    s = play(s, eros, [genius]);
    s = choose(reload(s), "yes");
    expect(s.prompt?.options).toEqual([
      expect.objectContaining({
        id: drone.id,
        label: "Ultron Drone",
        image: "drone",
      }),
    ]);
    s = finish(choose(reload(s), drone.id));
    expect(s.minions.find((p) => p.id === drone.id)?.confused).toBe(true);
    expect(s.minions.find((p) => p.id === drone.id)?.droneCard?.id).toBe(
      captured.id,
    );
    const threat = s.scheme.threat;
    s = finish(native(reload(s), { type: "enemyScheme", id: drone.id }));
    expect(s.scheme.threat).toBe(threat);
    expect(s.minions.find((p) => p.id === drone.id)?.confused).toBe(false);
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, drone.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === captured.id)).toBe(true);
    conserved(s);
  });
  it("retains both original forty-card Nebula and Gamora decks at every saved decision", () => {
    const s = base("nebu", "gam");
    expect(
      Object.values((s as State).nebulaPackOriginalIds!).map(
        (ids) => ids.length,
      ),
    ).toEqual([40, 40]);
    conserved(reload(s));
  });

  it("Brains Over Brawn responds to a basic thwart that leaves threat and uses the hero's current THW", () => {
    let s = base("nebu");
    const brains = take(s, "22018"),
      resource = take(s, "22025"),
      justice = take(s, "22014", "inPlay");
    const technique = take(s, "22006", "inPlay");
    expect(heroStats(s).thwart).toBe(3);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.scheme.threat).toBe(9);
    expect(s.prompt?.title).toBe("After your hero thwarts");
    expect(s.prompt?.options.some((o) => o.id === justice.id)).toBe(false);
    s = choose(reload(s), brains.id);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.villain.hp).toBe(57);
    expect(s.player.discard.some((p) => p.id === brains.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === technique.id)).toBe(true);
  });

  it("Justice Served and Brains Over Brawn can resolve in either saved response order", () => {
    let s = base("nebu");
    const justice = take(s, "22014", "inPlay"),
      brains = take(s, "22018"),
      resource = take(s, "22025");
    s.scheme.threat = 2;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(reload(s), justice.id);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === justice.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === brains.id)).toBe(true);
    s = choose(s, brains.id);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.villain.hp).toBe(58);
  });

  it("a confused basic power offers neither thwart response and a stunned paid Brains keeps its cost", () => {
    let s = base("nebu");
    const brains = take(s, "22018"),
      resource = take(s, "22025"),
      justice = take(s, "22014", "inPlay");
    s.player.confused = true;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = finish(s);
    expect(s.scheme.threat).toBe(12);
    expect(s.player.inPlay.some((p) => p.id === justice.id)).toBe(true);
    s.player.exhausted = false;
    s.player.stunned = true;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, brains.id);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.villain.hp).toBe(60);
    expect(s.player.stunned).toBe(false);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === brains.id)).toBe(true);
  });

  it("Determination can be spent through an ordinary zero-cost play and removes threat without thwarting", () => {
    let s = base("nebu");
    const event = take(s, "22015"),
      determination = take(s, "22016"),
      side = makePiece(s, "01108"),
      justice = take(s, "22014", "inPlay");
    s.encounter.deck.unshift(side);
    s.player.exhausted = true;
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.options.some((o) => o.id === "spend")).toBe(true);
    s = choose(s, "spend");
    s = pay(s, [determination]);
    s = choose(s, "yes");
    expect(s.scheme.threat).toBe(11);
    s = choose(s, side.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === justice.id)).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(true);
    expect(s.player.hand).toHaveLength(3);
  });

  it("Knowhere's new printing increases the limit in both forms and draws for the actual teammate player", () => {
    let s = base("nebu", "gam");
    const knowhere = take(s, "22021", "inPlay"),
      eros = take(s, "22011", "hand", "p2"),
      resource = take(s, "18023", "hand", "p2");
    expect(allyLimit(s)).toBe(4);
    s.player.form = "alter";
    expect(allyLimit(s)).toBe(4);
    s.player.form = "hero";
    s = command(s, { type: "END_TURN" });
    s = finish(s);
    const p2Before = s.player.hand.length;
    s = play(s, eros, [resource]);
    expect(s.prompt?.title).toBe("Knowhere");
    expect(s.activePlayerId).toBe("p1");
    s = choose(reload(s), "yes");
    s = finish(s);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === knowhere.id)
        ?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p2").player.hand).toHaveLength(p2Before - 1);
  });

  it("Knowhere does not trigger on Make the Call's put into play", () => {
    let s = base("nebu");
    const knowhere = take(s, "22021", "inPlay"),
      ally = take(s, "22020", "discard"),
      makeCall = take(s, "01071"),
      resource = take(s, "22024");
    s = play(s, makeCall);
    s = choose(s, ally.id);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === knowhere.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });

  it("a same-play Honorary Guardian makes the complete character group eligible for Guardians of the Galaxy", () => {
    let s = base("nebu");
    const team = take(s, "22033", "inPlay"),
      ally = take(s, "01002", "inPlay"),
      honorary = take(s, "22035");
    s = play(s, honorary);
    s = choose(reload(s), ally.id);
    expect(s.prompt?.title).toBe("Guardians of the Galaxy");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === honorary.id)?.attachedTo).toBe(
      ally.id,
    );
    expect(
      pieceHP(
        s,
        s.player.inPlay.find((p) => p.id === ally.id)!,
      ),
    ).toBe(3);
    expect(s.player.inPlay.some((p) => p.id === team.id)).toBe(true);
  });

  it("an upgrade on a teammate's ally responds for the actual playing player's Guardian team", () => {
    let s = base("nebu", "gam");
    const team = take(s, "22033", "inPlay"),
      ally = take(s, "18019", "inPlay", "p2"),
      spear = take(s, "22032"),
      r = take(s, "22016");
    s = play(s, spear, [r]);
    s = choose(s, "skip");
    s = choose(s, ally.id);
    expect(s.prompt?.title).toBe("Guardians of the Galaxy");
    s = choose(reload(s), "yes");
    s = finish(s);
    expect(s.player.hand).toHaveLength(1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === spear.id),
    ).toMatchObject({ ownerId: "p1", attachedTo: ally.id });
    expect(s.player.inPlay.some((p) => p.id === team.id)).toBe(true);
  });

  it("one Team slot counts another actual Team card", () => {
    const s = base("nebu");
    take(s, "21015", "inPlay");
    const team = take(s, "22033");
    expect(playable(s, team)).toMatch(/Team/);
    conserved(s);
  });

  it("a second Energy Spear printing cannot attach to the same actual Guardian ally", () => {
    let s = base("nebu");
    const ally = take(s, "22020", "inPlay"),
      spear = take(s, "22032"),
      r = take(s, "22016");
    s = play(s, spear, [r]);
    s = choose(s, "skip");
    s = choose(s, ally.id);
    s = finish(s);
    const second = { ...makePiece(s, "22032"), ownerId: "p1" };
    s.player.hand.push(second);
    expect(playable(s, second)).toMatch(/attachment target/);
    conserved(s);
  });

  it("Energy Spear uses native ATK and Piercing when a Guardian ally attacks a Tough villain", () => {
    let s = base("nebu");
    const ally = take(s, "22020", "inPlay"),
      spear = take(s, "22032", "inPlay");
    spear.attachedTo = ally.id;
    s.villain.tough = true;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, "continue");
    s = finish(s);
    expect(s.villain.hp).toBe(57);
    expect(s.villain.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });

  it("Defensive Training enters with two Uses and spends its last physical counter only after choosing a valid discarded event", () => {
    let s = base("nebu");
    s.player.form = "alter";
    const training = take(s, "22034"),
      r = take(s, "22016"),
      event = take(s, "01078", "discard");
    s = play(s, training, [r]);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === training.id)?.counters).toBe(2);
    s = command(s, { type: "ABILITY", id: training.id, action: "training" });
    expect(s.player.inPlay.find((p) => p.id === training.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === training.id)?.counters).toBe(2);
    s = choose(reload(s), event.id);
    s = finish(s);
    expect(s.player.deck.some((p) => p.id === event.id)).toBe(true);
    const live = s.player.inPlay.find((p) => p.id === training.id)!;
    live.exhausted = false;
    live.counters = 1;
    const event2 = take(s, "18031", "discard");
    s = command(s, { type: "ABILITY", id: training.id, action: "training" });
    s = choose(s, event2.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === training.id)).toBe(false);
    expect(s.player.discard.find((p) => p.id === training.id)).toMatchObject({
      ownerId: "p1",
    });
    expect(s.player.deck.some((p) => p.id === event2.id)).toBe(true);
  });

  it("Defensive Training refuses a stale saved discard target without paying exhaust or counters", () => {
    let s = base("nebu");
    s.player.form = "alter";
    const training = take(s, "22034", "inPlay"),
      event = take(s, "01078", "discard");
    training.counters = 2;
    s = command(s, { type: "ABILITY", id: training.id, action: "training" });
    const i = s.player.discard.findIndex((p) => p.id === event.id);
    s.player.deck.push(s.player.discard.splice(i, 1)[0]);
    const refused = dispatch(reload(s), { type: "CHOOSE", id: event.id });
    expect(refused.error).toMatch(/complete cost and target/);
    expect(
      refused.player.inPlay.find((p) => p.id === training.id),
    ).toMatchObject({ exhausted: false, counters: 2 });
    conserved(refused);
  });

  it("Daughters of Thanos recognizes both identities in either form and draws three from the physical deck", () => {
    let s = base("nebu", "gam");
    seatView(s, "p2").player.form = "alter";
    const daughters = take(s, "22022"),
      r = take(s, "22016");
    s = play(s, daughters, [r]);
    s = choose(s, "skip");
    s = finish(s);
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.discard.some((p) => p.id === daughters.id)).toBe(true);
  });
});

describe("Simultaneous Wasp thwart classification in the shared response window", () => {
  it("the actual Giant basic thwart offers Brains Over Brawn once after its entire distribution", () => {
    let s = base("wsp");
    s.player.heroForm = "giant";
    const brains = take(s, "22018"),
      r = take(s, "22025");
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.title).toBe("After your hero thwarts");
    expect(s.prompt?.options.filter((o) => o.id === brains.id)).toHaveLength(1);
    s = choose(reload(s), brains.id);
    s = pay(s, [r]);
    s = finish(s);
    expect(s.villain.hp).toBe(60 - heroStats(s).thwart);
  });

  it("Giant Help's event distribution can trigger Justice Served but cannot trigger a basic-thwart event", () => {
    let s = base("wsp");
    s.player.heroForm = "giant";
    s.player.exhausted = true;
    s.scheme.threat = 2;
    const brains = take(s, "22018"),
      justice = take(s, "22014", "inPlay"),
      giantHelp = take(s, "13003"),
      r = take(s, "22025");
    s = play(s, giantHelp, [r]);
    expect(s.prompt?.title).toBe("After your hero thwarts");
    expect(s.prompt?.options.some((o) => o.id === brains.id)).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === justice.id)).toBe(true);
    s = choose(s, justice.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === brains.id)).toBe(true);
  });
});

describe("Cosmo's teammate deck mutation uses the native global state", () => {
  it("discarding a teammate's last card commits hidden information and RNG at that same player's immediate reset", () => {
    let s = base("nebu", "gam");
    const cosmo = take(s, "22020", "inPlay"),
      top = take(s, "18023", "hand", "p2"),
      other = seatView(s, "p2").player;
    other.hand.splice(
      other.hand.findIndex((p) => p.id === top.id),
      1,
    );
    other.discard.push(...other.deck.splice(0));
    other.deck.push(top);
    const rng = s.seed,
      hidden = s.hiddenInfo || 0;
    s = command(s, { type: "ABILITY", id: cosmo.id, action: "thwart" });
    s = choose(s, cosmo.id);
    s = choose(s, "resource");
    s = choose(reload(s), "p2");
    s = finish(s);
    expect(s.seed).not.toBe(rng);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(s.activePlayerId).toBe("p1");
    expect(seatView(s, "p2").player.deck.some((p) => p.id === top.id)).toBe(
      true,
    );
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual(["p2"]);
    expect(s.player.inPlay.find((p) => p.id === cosmo.id)?.damage).toBe(0);
  });
});
