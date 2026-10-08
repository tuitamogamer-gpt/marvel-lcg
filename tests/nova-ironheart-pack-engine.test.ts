/** Native acceptance for original player faces. Commands cross a JSON reload;
 * all forty actual starter instances remain in native zones throughout. */
import { describe, expect, it } from "vitest";
import { card, heroStats, maxHP, pieceHP } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece, Resource } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  finish,
  hand,
  minion,
  native,
  owned,
  pay,
  physical,
  play,
  put,
  reload,
  side,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type Identity = "nova" | "ironheart";
type SourceState = GameState & { dvSourceIds?: Record<string, string[]> };
function base(heroId: Identity = "nova", team = false) {
  const nova = { heroId: "nova", aspect: "aggression" as const },
    iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...(heroId === "nova" ? nova : iron),
    villainId: "rhino",
    seed: 28013,
    pacing: "expert",
    ...(team ? { heroes: [nova, iron] } : {}),
  });
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat),
      original = physical(s, seat.id);
    expect(original).toHaveLength(40);
    expect(new Set(original.map((p) => p.id)).size).toBe(40);
    original.forEach((p) => (p.ownerId = seat.id));
    v.player.deck = original;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.flipped = false;
  }
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  (s as SourceState).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  return s;
}
function select(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function response(s: GameState, code: string) {
  const name = card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  s = until(
    s,
    (v) =>
      !!v.prompt?.options.some(
        (o) => o.image === code || new RegExp(name, "i").test(o.label),
      ) ||
      !!(
        v.prompt &&
        new RegExp(name, "i").test(v.prompt.title) &&
        v.prompt.options.some((o) => o.id === "yes")
      ),
  );
  const o =
    s.prompt!.options.find(
      (o) => o.image === code || new RegExp(name, "i").test(o.label),
    ) || s.prompt!.options.find((o) => o.id === "yes")!;
  return choose(s, o.id);
}
function allocate(s: GameState, wanted: Resource[]) {
  if (s.prompt?.title !== "Allocate payment resources") return s;
  const key = [...wanted].sort().join(":"),
    o = s.prompt.options.find(
      (o) =>
        [...(o.effects[0].paidForCard as Resource[])].sort().join(":") === key,
    );
  expect(o, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, o!.id);
}
function discardOriginal(s: GameState, code: string) {
  const p = top(s, code);
  expect(s.player.deck.shift()?.id).toBe(p.id);
  s.player.discard.push(p);
  return p;
}
function source(s: GameState) {
  return physical(s);
}

describe("native Nova player pool payments and exact attack aftermath", () => {
  it("No Quarter spends Physical and recovers only the exact newly milled Aggression IDs", () => {
    let s = base();
    const original = source(s),
      [event, strength] = hand(s, "28013", "01090"),
      old = discardOriginal(s, "28014"),
      a = top(s, "28016"),
      b = top(s, "28018"),
      c = top(s, "28012");
    // Preserve explicit known top order without adding or cloning cards.
    const selected = new Set([a.id, b.id, c.id]);
    s.player.deck = [
      a,
      b,
      c,
      ...s.player.deck.filter((p) => !selected.has(p.id)),
    ];
    const enemy = minion(s, "01103", s.activePlayerId, 2);
    s = play(s, event, [strength]);
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([a.id, c.id]);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === old.id)).toBe(true);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    conserved(s, original);
  });
  it("Honed Technique uses actual Physical+Mental allocated from the original Power of Aggression", () => {
    let s = base();
    const original = source(s);
    put(s, "28017");
    const [event, power] = hand(s, "28013", "28015"),
      enemy = minion(s, "01172");
    s = play(s, event, [power], "mental");
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === power.id)).toHaveLength(1);
    conserved(s, original);
  });
  it("overpaid Mental grants no Honed bonus when actual FOR cost is entirely Physical", () => {
    let s = base();
    const original = source(s);
    put(s, "28017");
    const [event, strength, genius] = hand(s, "28013", "01090", "01089"),
      enemy = minion(s, "01162");
    s = play(s, event, [strength, genius]);
    s = allocate(s, ["physical", "physical"]);
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(4);
    expect(s.player.discard.some((p) => p.id === genius.id)).toBe(true);
    conserved(s, original);
  });
  it("Tough blocks actual No Quarter excess and keeps the top player cards untouched", () => {
    let s = base();
    const original = source(s),
      [event, strength] = hand(s, "28013", "01090"),
      first = top(s, "28016"),
      enemy = minion(s, "01103", s.activePlayerId, 2);
    enemy.tough = true;
    s = play(s, event, [strength]);
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.player.deck[0].id).toBe(first.id);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      damage: 2,
      tough: false,
    });
    conserved(s, original);
  });
  it("a fully discounted No Quarter still requires spending Physical, with no zero-FOR Honed bonus", () => {
    let s = base();
    put(s, "28017");
    const [event, strength] = hand(s, "28013", "01090");
    s.flags.discount = 2;
    const enemy = minion(s, "01162");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    expect(s.prompt?.requirements).toEqual(["physical"]);
    const rejected = dispatch(reload(s), { type: "PAY", ids: [] });
    expect(rejected.error).toMatch(/physical/i);
    s = pay(s, [strength]);
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(4);
  });
  it("No Quarter recovers an earlier red before a later nonred empties the deck and stops after one reset", () => {
    let s = base();
    const original = source(s),
      [event, strength] = hand(s, "28013", "01090"),
      red = top(s, "28016"),
      nonred = top(s, "28018"),
      enemy = minion(s, "01103", s.activePlayerId, 2);
    const keep = new Set([red.id, nonred.id]);
    s.player.discard.push(...s.player.deck.filter((p) => !keep.has(p.id)));
    s.player.deck = [red, nonred];
    s = play(s, event, [strength]);
    s = select(s, enemy.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([red.id]);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck).toHaveLength(39);
    expect(s.player.deck.filter((p) => p.id === nonred.id)).toHaveLength(1);
    expect(s.player.discard.map((p) => p.id)).toEqual([event.id]);
    conserved(s, original);
  });
  it("the sole Worldmind wild spent for a discounted Physical requirement cannot also fund Honed Mental", () => {
    let s = base();
    const original = source(s);
    put(s, "28017");
    const [event, worldmind] = hand(s, "28013", "28007");
    s.flags.discount = 1;
    s = play(s, event, [worldmind], "mental");
    s = select(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.discard.filter((p) => p.id === worldmind.id)).toHaveLength(
      1,
    );
    conserved(s, original);
  });
  it("One by One follows actual defeat, then resolves the second damage in one attack", () => {
    let s = base();
    const original = source(s),
      [event, energy] = hand(s, "28014", "01088"),
      enemy = minion(s, "01103", s.activePlayerId, 1);
    put(s, "28017");
    s = play(s, event, [energy]);
    s = allocate(s, ["energy"]);
    s = select(s, enemy.id);
    s = select(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    conserved(s, original);
  });
  it("Fluid Motion sees one actual Attack-event PLAY and shares Max 1 across copies", () => {
    let s = base();
    const original = source(s),
      a = put(s, "28016"),
      b = put(s, "28016"),
      [event, energy] = hand(s, "28014", "01088");
    const before = heroStats(s).attack;
    s = play(s, event, [energy]);
    s = allocate(s, ["energy"]);
    s = select(s, s.villain.id);
    s = response(s, "28016");
    s = finish(s);
    const statuses = s.player.inPlay
      .filter((p) => [a.id, b.id].includes(p.id))
      .map((p) => p.exhausted);
    expect(statuses.filter(Boolean)).toHaveLength(1);
    expect(heroStats(s).attack).toBe(before + 1);
    conserved(s, original);
  });
  it("canceling Pitchback payment preserves the original response and each physical copy responds once after retry", () => {
    let s = base();
    const original = source(s),
      marvel = put(s, "28002"),
      [first, second, worldmind, everyday] = hand(
        s,
        "28012",
        "28012",
        "28007",
        "28019",
      );
    put(s, "28009");
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === first.id));
    const token = s.prompt!.options.find((o) => o.id === first.id)!.effects[0]
        .receipt.token,
      handBefore = s.player.hand.map((p) => p.id),
      discardBefore = s.player.discard.map((p) => p.id);
    expect(s.prompt!.options.some((o) => o.id === second.id)).toBe(true);
    s = choose(s, first.id);
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 1 });
    s = command(s, { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual(handBefore);
    expect(s.player.discard.map((p) => p.id)).toEqual(discardBefore);
    expect(
      s.prompt?.options.find((o) => o.id === first.id)?.effects[0].receipt
        .token,
    ).toBe(token);
    expect(s.prompt?.options.some((o) => o.id === second.id)).toBe(true);
    conserved(s, original);

    s = choose(s, first.id);
    s = pay(s, [worldmind], "mental");
    s = select(s, s.villain.id);
    // Decline the new attack's separate response window, then return this
    // actual played copy with Ms. Marvel to challenge the original token.
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "28002"));
    expect(s.player.discard.filter((p) => p.id === first.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === worldmind.id)).toHaveLength(
      1,
    );
    s = response(s, "28002");
    s = until(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === second.id)?.effects[0].receipt
          .token === token,
    );
    expect(s.player.hand.filter((p) => p.id === first.id)).toHaveLength(1);
    expect(s.prompt?.options.some((o) => o.id === first.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === marvel.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });

    s = choose(s, second.id);
    s = pay(s, [everyday], "energy");
    s = select(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(41);
    expect(s.player.hand.filter((p) => p.id === first.id)).toHaveLength(1);
    for (const p of [second, worldmind, everyday])
      expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    conserved(s, original);
  });
  it("Moon Girl's ordinary hand PLAY draws only actual FOR Mental resources", () => {
    let s = base();
    const original = source(s),
      [moon, genius, physical] = hand(s, "28018", "01089", "28020"),
      first = top(s, "28014"),
      second = top(s, "28016");
    const selected = new Set([first.id, second.id]);
    s.player.deck = [
      first,
      second,
      ...s.player.deck.filter((p) => !selected.has(p.id)),
    ];
    s = play(s, moon, [genius, physical]);
    s = response(s, "28018");
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([first.id, second.id]);
    expect(s.player.inPlay.find((p) => p.id === moon.id)?.code).toBe("28018");
    conserved(s, original);
  });
  it("The Locust responds to actual PUT entry and retrieves the same discarded red event", () => {
    let s = base();
    const original = source(s),
      red = discardOriginal(s, "28014"),
      [locust] = hand(s, "28010");
    s = native(s, { type: "sinisterNativePut", id: locust.id });
    s = response(s, "28010");
    s = select(s, red.id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === red.id)).toBe(true);
    conserved(s, original);
  });
});

describe("native Ironheart supplementary allies, lasting effects and Uses", () => {
  it("the original Agent 13 readies another player's real Helicarrier after native ally thwart", () => {
    let s = base("nova", true);
    const original = physical(s, "p2");
    activateSeat(s, "p2");
    const agent = put(s, "29022"),
      carrier = put(s, "29026", "p1");
    carrier.exhausted = true;
    s.turnPlayerId = "p2";
    s = command(s, { type: "ABILITY", id: agent.id, action: "thwart" });
    s = target(s, "main");
    s = response(s, "29022");
    s = select(s, carrier.id);
    s = finish(s);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === carrier.id)
        ?.exhausted,
    ).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === agent.id)).toMatchObject({
      code: "29022",
      damage: 1,
    });
    conserved(s, original, "p2");
  });
  it("Snowguard's real entry response stores a mode that survives reload and grants HP/Retaliate", () => {
    let s = base("ironheart");
    const original = source(s),
      [snow, strength, genius] = hand(s, "29023", "01090", "01089");
    s = play(s, snow, [strength, genius]);
    s = select(s, "3");
    s = finish(s);
    const actual = s.player.inPlay.find((p) => p.id === snow.id)!;
    expect(actual.counters).toBe(3);
    expect(pieceHP(s, actual)).toBe(8);
    conserved(s, original);
  });
  it("Cloud 9 retains her native basic attack and thwart alongside the available printed special", () => {
    let s = base("ironheart");
    const original = source(s),
      cloud = put(s, "29014");
    s = command(s, { type: "ABILITY", id: cloud.id, action: "attack" });
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.inPlay.find((p) => p.id === cloud.id)?.damage).toBe(1);
    s.player.inPlay.find((p) => p.id === cloud.id)!.exhausted = false;
    s = command(s, { type: "ABILITY", id: cloud.id, action: "thwart" });
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === cloud.id)?.damage).toBe(2);
    conserved(s, original);
  });
  it("Snowguard's Aerial/THW mode gains Cloud 9's native phase modifier", () => {
    let s = base("ironheart");
    const original = source(s),
      snow = put(s, "29023"),
      cloud = put(s, "29014");
    snow.counters = 2;
    s = command(s, { type: "ABILITY", id: cloud.id, action: "cloud" });
    s = target(s, "p1");
    s = finish(s);
    const actual = s.player.inPlay.find((p) => p.id === snow.id)!;
    s = command(s, { type: "ABILITY", id: actual.id, action: "thwart" });
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(4);
    expect(actual.code).toBe("29023");
    conserved(s, original);
  });
  it("Falcon's actual Energy ability SPEND readies a different controlled Champion before consequential damage", () => {
    let s = base("ironheart");
    const original = source(s),
      falcon = put(s, "29015"),
      patriot = put(s, "29016"),
      [energy] = hand(s, "01088");
    patriot.exhausted = true;
    s = command(s, { type: "ABILITY", id: falcon.id, action: "thwart" });
    s = target(s, "main");
    s = response(s, "29015");
    s = pay(s, [energy]);
    s = select(s, patriot.id);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === patriot.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === falcon.id)?.damage).toBe(1);
    conserved(s, original);
  });
  it("R&D Facility's final research counter resolves the lasting benefit before native Uses discard", () => {
    let s = base("ironheart");
    const original = source(s),
      rd = put(s, "29020");
    rd.counters = 1;
    const before = heroStats(s);
    s = command(s, { type: "ABILITY", id: rd.id, action: "research" });
    s = select(s, "hero");
    s = finish(s);
    expect(heroStats(s).attack).toBe(before.attack + 1);
    expect(heroStats(s).thwart).toBe(before.thwart + 1);
    expect(s.player.discard.filter((p) => p.id === rd.id)).toHaveLength(1);
    conserved(s, original);
  });
  it("Ingenuity is a real Mental resource provider in alter-ego form and exhausts on payment", () => {
    let s = base("ironheart");
    const original = source(s),
      ingenuity = put(s, "29027"),
      [cardToPlay, genius] = hand(s, "29026", "01089");
    s.player.form = "alter";
    expect(
      paymentSources(s).find((p) => p.id === ingenuity.id)?.resources,
    ).toEqual(["mental"]);
    s = command(s, { type: "PLAY", id: cardToPlay.id });
    s = pay(s, [genius], undefined, [ingenuity.id]);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ingenuity.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === cardToPlay.id)?.code).toBe(
      "29026",
    );
    conserved(s, original);
  });
  it("Vivian blanks actual Tech Theft to restore the same Photon Blasters until native round expiration", () => {
    let s = base("ironheart");
    const original = source(s),
      printedMax = maxHP(s),
      photon = put(s, "29012"),
      ingenuity = put(s, "29027"),
      theft = side(s, "12026", 2),
      printedTheft = { ...card(theft) },
      [vivian, power, morale] = hand(s, "29024", "29021", "29019");
    expect(card(photon).traits).toBe("Tech. Weapon.");
    expect(isTextBlank(s, photon)).toBe(true);
    expect(maxHP(s)).toBe(printedMax);
    expect(
      paymentSources(s).find((p) => p.id === ingenuity.id)?.resources,
    ).toEqual(["mental"]);
    expect(
      dispatch(reload(s), { type: "ABILITY", id: photon.id }).error,
    ).toMatch(/unavailable|blank/i);

    s = play(s, vivian, [power, morale], "mental");
    s = response(s, "29024");
    s = select(s, theft.id);
    s = finish(s);
    expect(
      isTextBlank(
        s,
        s.sideSchemes.find((p) => p.id === theft.id)!,
      ),
    ).toBe(true);
    expect(
      isTextBlank(
        s,
        s.player.inPlay.find((p) => p.id === photon.id)!,
      ),
    ).toBe(false);
    expect(maxHP(s)).toBe(printedMax + 2);
    expect(card(s.sideSchemes.find((p) => p.id === theft.id)!)).toEqual(
      printedTheft,
    );
    expect(s.sideSchemes.find((p) => p.id === theft.id)?.counters).toBe(2);
    s = command(s, { type: "ABILITY", id: photon.id });
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.inPlay.find((p) => p.id === photon.id)?.exhausted).toBe(
      true,
    );
    expect(
      paymentSources(s).find((p) => p.id === ingenuity.id)?.resources,
    ).toEqual(["mental"]);

    const round = s.round;
    s.scheme.threat = 1;
    s = native(s, { type: "beginVillain" });
    expect(s.phase).toBe("villain");
    expect(s.round).toBe(round);
    expect(maxHP(s)).toBe(printedMax + 2);
    s = finish(s);
    expect(s.round).toBe(round + 1);
    expect(
      isTextBlank(
        s,
        s.sideSchemes.find((p) => p.id === theft.id)!,
      ),
    ).toBe(false);
    expect(
      isTextBlank(
        s,
        s.player.inPlay.find((p) => p.id === photon.id)!,
      ),
    ).toBe(true);
    expect(maxHP(s)).toBe(printedMax);
    expect(card(s.sideSchemes.find((p) => p.id === theft.id)!)).toEqual(
      printedTheft,
    );
    expect(s.sideSchemes.find((p) => p.id === theft.id)?.counters).toBe(2);
    expect(
      paymentSources(s).find((p) => p.id === ingenuity.id)?.resources,
    ).toEqual(["mental"]);
    s = finish(native(s, { type: "ready", id: photon.id }));
    expect(s.player.inPlay.find((p) => p.id === photon.id)?.exhausted).toBe(
      false,
    );
    expect(
      dispatch(reload(s), { type: "ABILITY", id: photon.id }).error,
    ).toMatch(/unavailable|blank/i);
    conserved(s, original);
  });
  it("Go All Out pays the real hero exhaust cost, then deals the sum of native current stats", () => {
    let s = base("ironheart");
    const original = source(s),
      [event, energy] = hand(s, "29017", "01088"),
      before = heroStats(s);
    s = play(s, event, [energy]);
    s = select(s, s.villain.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.villain.hp).toBe(
      50 - before.attack - before.thwart - before.defense,
    );
    conserved(s, original);
  });
  it("Push Ahead exhausts the hero despite Confuse replacing the printed labeled effect", () => {
    let s = base("ironheart");
    const original = source(s),
      [event, genius, mental] = hand(s, "29018", "01089", "29020");
    s.player.confused = true;
    const before = s.scheme.threat;
    s = play(s, event, [genius, mental]);
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(before);
    conserved(s, original);
  });
  it("Go for Champions removes its same physical event and prevents damage without consuming Tough", () => {
    let s = base("ironheart");
    const original = source(s),
      [event, strength, mental] = hand(s, "29025", "01090", "29020");
    const hp = s.player.hp;
    s = play(s, event, [strength, mental]);
    s = finish(s);
    expect(s.removed.filter((p) => p.id === event.id)).toHaveLength(1);
    s.player.tough = true;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "scenario",
    });
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(true);
    conserved(s, original);
  });
  it("Bombshell divides the native attack among every enemy and pays consequential damage only once", () => {
    let s = base("ironheart");
    const original = source(s),
      bombshell = put(s, "29033"),
      guard = minion(s, "01101"),
      other = minion(s, "01110");
    s = command(s, { type: "ABILITY", id: bombshell.id, action: "attack" });
    s = select(s, guard.id);
    if (s.prompt?.options.some((o) => o.id === "even")) s = choose(s, "even");
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === bombshell.id)?.damage).toBe(1);
    conserved(s, original);
  });
  it("Everyday Hero contributes its real owner's hand resource to another ordinary card payment and heals that beneficiary", () => {
    let s = base("nova", true);
    const first = physical(s, "p1"),
      second = physical(s, "p2");
    const everyday = owned(s, "28019", "p1");
    s.player.hand.push(everyday);
    s.player.form = "alter";
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    s.player.hp = 6;
    const [carrier, genius] = hand(s, "29026", "01089");
    s = command(s, { type: "PLAY", id: carrier.id });
    const shared = paymentSources(
      s,
      s.prompt?.card?.id,
      s.prompt?.paymentTarget,
    ).find((p) => p.code === "28019" && p.playerId === "p1");
    expect(shared).toBeTruthy();
    s = command(s, {
      type: "PAY",
      ids: [genius.id, shared!.id],
      wildAs: "energy",
    });
    s = response(s, "28019");
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(7);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === everyday.id),
    ).toHaveLength(1);
    expect(physical(s, "p1").filter((p) => p.id === everyday.id)).toHaveLength(
      1,
    );
    conserved(s, first, "p1");
    conserved(s, second, "p2");
  });
  it("Wasp's native ally attack bypasses the actual Guard without granting another ally the bypass", () => {
    let s = base("ironheart");
    const original = source(s),
      wasp = put(s, "29034"),
      other = put(s, "29016");
    minion(s, "01182");
    minion(s, "01101");
    s = command(s, { type: "ABILITY", id: wasp.id, action: "attack" });
    s = select(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    s = command(s, { type: "ABILITY", id: other.id, action: "attack" });
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(s.villain.id);
    s = choose(s, s.prompt!.options[0].id);
    s = finish(s);
    conserved(s, original);
  });
  it("Wasp's native thwart ignores Crisis for her actual use", () => {
    let s = base("ironheart");
    const original = source(s),
      wasp = put(s, "29034");
    side(s, "01108", 5);
    s = command(s, { type: "ABILITY", id: wasp.id, action: "thwart" });
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(6);
    conserved(s, original);
  });
  it("Pinpoint shuffles the actual other-player discarded ally into its owner's deck", () => {
    let s = base("nova", true);
    const original = physical(s, "p2");
    activateSeat(s, "p2");
    const pinpoint = put(s, "29035"),
      ally = put(s, "28010", "p1");
    s.turnPlayerId = "p2";
    s = native(s, { type: "discardPiece", id: ally.id });
    s = response(s, "29035");
    s = finish(s);
    expect(
      seatView(s, "p1").player.deck.filter((p) => p.id === ally.id),
    ).toHaveLength(1);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === pinpoint.id)?.exhausted).toBe(
      true,
    );
    conserved(s, original, "p2");
  });
  it("Pinpoint can replace her own impending discard without creating a second piece", () => {
    let s = base("ironheart");
    const original = source(s),
      p = put(s, "29035");
    s = native(s, { type: "discardPiece", id: p.id });
    s = response(s, "29035");
    s = finish(s);
    expect(s.player.deck.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(physical(s).filter((q) => q.id === p.id)).toHaveLength(1);
    conserved(s, original);
  });
});
