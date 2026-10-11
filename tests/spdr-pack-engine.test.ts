/** Original forty-card SP//dr pool through real serialized native commands.
 * Supplemental Clarity uses a legal declared forty-card Leadership deck. */
import { describe, expect, it } from "vitest";
import { card, deckCodes, heroStats } from "../src/game/cards.js";
import {
  dispatch,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  pay,
  play,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { spdrPackOriginalIds?: string[] };
function all(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
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
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
        ...(p.spiderHamIdentity ? [p.spiderHamIdentity] : []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  for (const id of (s as Fixture).spdrPackOriginalIds || [])
    expect(
      all(s).filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 180; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).not.toBe("payment");
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "skip",
          "pass",
          "no",
          "decline",
          "allow",
          "take",
          "resolve",
          "continue",
          "done",
          "none",
          "other",
          "text-first",
        ].includes(o.id),
      )?.id ||
      (s.prompt.options.length === 1 ||
      /Forced responses|mandatory/i.test(s.prompt.title)
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function leadership() {
  const signatures = deckCodes("spdr", "protection").filter(
    (code) => card(code).faction_code === "hero",
  );
  const pool = deckCodes("spider_man", "leadership").filter(
    (code) => card(code).faction_code !== "hero",
  );
  pool[pool.indexOf("01073")] = "31029";
  pool[pool.indexOf("01074")] = "31023";
  return [...signatures, ...pool];
}
function hamProtection() {
  return [
    ...deckCodes("spiderham", "justice").filter(
      (code) => card(code).faction_code === "hero",
    ),
    ...deckCodes("spdr", "protection")
      .filter((code) => card(code).faction_code !== "hero")
      .map((code) => (code === "31021" ? "01083" : code)),
  ];
}
function base(other?: string, clarity = false, ham = false, expert = false) {
  const sourceCodes = clarity
    ? leadership()
    : ham
      ? hamProtection()
      : deckCodes("spdr", "protection");
  const actor = {
    heroId: ham ? "spiderham" : "spdr",
    aspect: clarity ? ("leadership" as const) : ("protection" as const),
    ...(clarity || ham ? { deckCards: sourceCodes } : {}),
  };
  let s = newGame({
    ...actor,
    villainId: "rhino",
    module: "zzzax",
    ...(expert ? { difficulty: "expert" as const } : {}),
    seed: 31014,
    pacing: "expert",
    ...(other || clarity || ham
      ? {
          heroes: [
            actor,
            ...(other ? [{ heroId: other, aspect: "justice" as const }] : []),
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seatId of s.players.map((seat) => seat.id)) {
    const seat = s.players.find((seat) => seat.id === seatId)!;
    const p = seatView(s, seatId).player;
    const source = [
      ...p.deck,
      ...p.hand,
      ...p.discard,
      ...p.inPlay.filter((p) => !["31001b", "31002b"].includes(p.code)),
    ];
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      (seat.id === "p1" ? sourceCodes : deckCodes(seat.heroId, seat.aspect))
        .slice()
        .sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = p.inPlay.filter((p) => ["31001b", "31002b"].includes(p.code));
    if (p.form !== "hero") {
      activateSeat(s, seatId);
      s.turnPlayerId = seat.id;
      s = command(s, { type: "FLIP" });
    }
    const view = seatView(s, seatId);
    view.player.flipped = false;
    view.player.exhausted = false;
    view.player.stunned = view.player.confused = view.player.tough = false;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).spdrPackOriginalIds = all(s).map((p) => p.id);
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${seatId}:${code}`);
}
function hand(s: GameState, ...codes: string[]) {
  const ps = codes.map((code) => source(s, code));
  s.player.hand.push(...ps);
  return ps;
}
function control(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
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
function select(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function byCard(s: GameState, code: string) {
  return respond(
    s,
    new RegExp(card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    code,
  );
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: encounter(s, code), actorId });
}
function damage(s: GameState, amount: number, target = "hero") {
  return native(s, { type: "damage", target, amount, source: s.villain.id });
}

describe("SP//dr original pool through native dispatch and save/reload", () => {
  it("retains exact original protection40 and all twelve pool runtime registrations", () => {
    const s = base();
    expect(s.player.deck).toHaveLength(40);
    for (const code of [
      ...Array.from({ length: 11 }, (_, n) => String(31014 + n)),
      "31029",
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "31026",
      "31027",
      "31028",
      "31028",
      "31028",
    ]);
    exact(s);
  });
  it("paid original31018 Energy Barrier enters with three actual counters", () => {
    let s = base();
    const [barrier, a, b] = hand(s, "31018", "31023", "31024");
    s = settle(play(s, barrier, [a, b]));
    expect(s.player.inPlay.find((p) => p.id === barrier.id)).toMatchObject({
      code: "31018",
      counters: 3,
    });
  });
  it("31018 original printing prevents one, reflects one, and discards only after its third use", () => {
    let s = base();
    const [barrier, a, b] = hand(s, "31018", "31023", "31024");
    s = settle(play(s, barrier, [a, b]));
    const hp = s.player.hp;
    for (let n = 1; n <= 3; n++) {
      s = damage(s, 2);
      s = byCard(s, "31018");
      s = select(s, s.villain.id);
      s = settle(s);
      expect(s.player.hp).toBe(hp - n);
      expect(s.villain.hp).toBe(50 - n);
      if (n < 3)
        expect(s.player.inPlay.find((p) => p.id === barrier.id)?.counters).toBe(
          3 - n,
        );
    }
    expect(s.player.inPlay.some((p) => p.id === barrier.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === barrier.id)).toHaveLength(1);
  });
  it("paid Forcefield Generator enters with six counters and blocks another copy", () => {
    let s = base();
    const [g, a, b, c] = hand(s, "31019", "31023", "31024", "31020");
    s = settle(play(s, g, [a, b, c]));
    expect(s.player.inPlay.find((p) => p.id === g.id)?.counters).toBe(6);
    const [second, ra, rb, rc] = hand(s, "31019", "31023", "31024", "31020");
    expect(playable(s, second)).toMatch(/max 1/);
    expect([ra, rb, rc]).toHaveLength(3);
  });
  it("Forcefield forced actual prevention6 leaves damage2 and native-discard once", () => {
    let s = base();
    const g = control(s, "31019");
    g.counters = 6;
    const hp = s.player.hp;
    s = settle(damage(s, 8));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.filter((p) => p.id === g.id)).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === g.id)).toBe(false);
  });
  it("Forcefield prevents actual enemy attack packets, not only event damage", () => {
    let s = base();
    const g = control(s, "31019");
    g.counters = 6;
    const boost = encounter(s, "01105");
    s.encounter.deck.unshift(boost);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.title.includes("Defense") ? "none" : undefined,
    );
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((p) => p.id === g.id)!.counters).toBeLessThan(
      6,
    );
  });
  it("Repurpose native Tech discard uses printed3 and persists DEF through villain phase", () => {
    let s = base();
    const g = control(s, "31019");
    g.counters = 2;
    s.player.exhausted = true;
    const [event] = hand(s, "31016");
    s = play(s, event);
    s = select(s, g.id);
    s = select(s, "defense");
    s = settle(s);
    expect(s.player.exhausted).toBe(false);
    expect(heroStats(s).defense).toBe(5);
    expect(s.player.discard.filter((p) => p.id === g.id)).toHaveLength(1);
    const saved = reload(s);
    saved.phase = "villain";
    expect(heroStats(saved).defense).toBe(5);
    saved.round++;
    expect(heroStats(saved).defense).toBe(2);
  });
  it("Repurpose actual Tech Interface discard never spends exhausted state or discounted cost", () => {
    let s = base();
    const host = control(s, "31011");
    host.exhausted = true;
    const [event] = hand(s, "31016");
    s = play(s, event);
    s = select(s, host.id);
    s = select(s, "attack");
    s = settle(s);
    expect(heroStats(s).attack).toBe(4);
    expect(s.player.discard.filter((p) => p.id === host.id)).toHaveLength(1);
  });
  it("Thwip original paid event deals real controlled WW damage before two enemies stun", () => {
    let s = base();
    const minion = encounter(s, "01103");
    minion.engagedWith = "p1";
    s.minions.push(minion);
    const [event, a, b] = hand(s, "31017", "31023", "31024");
    const hp = s.player.hp;
    s = play(s, event, [a, b]);
    s = select(s, "hero:p1");
    s = select(s, s.villain.id);
    s = select(s, minion.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.stunned).toBe(true);
    expect(s.minions.find((p) => p.id === minion.id)!.stunned).toBe(true);
  });
  it("Thwip actual DEAL cost is paid when Tough prevents its damage", () => {
    let s = base();
    s.player.tough = true;
    const hp = s.player.hp;
    const [event, a, b] = hand(s, "31017", "31023", "31024");
    s = play(s, event, [a, b]);
    s = select(s, "hero:p1");
    s = select(s, s.villain.id);
    s = select(s, s.villain.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.villain.stunned).toBe(true);
  });
  it("Thwip can assign both actual stun attempts to the same enemy without duplicating ordinary status", () => {
    let s = base();
    const z = encounter(s, "29037");
    z.engagedWith = "p1";
    s.minions.push(z);
    const [event, a, b] = hand(s, "31017", "31023", "31024");
    s = play(s, event, [a, b]);
    s = select(s, "hero:p1");
    s = select(s, z.id);
    s = select(s, z.id);
    s = settle(s);
    expect(s.minions.find((p) => p.id === z.id)).toMatchObject({
      stunned: true,
      stunCards: 1,
    });
  });
  it("Thwip damage can defeat its controlled ally and still resolve the established event", () => {
    let s = base();
    const noir = control(s, "31015");
    noir.damage = 2;
    const [event, a, b] = hand(s, "31017", "31023", "31024");
    s = play(s, event, [a, b]);
    s = select(s, noir.id);
    s = select(s, s.villain.id);
    s = select(s, s.villain.id);
    s = settle(s);
    expect(s.player.discard.filter((p) => p.id === noir.id)).toHaveLength(1);
    expect(s.villain.stunned).toBe(true);
  });
  it("Thwip Spider-Ham damage response creates real toon only after payment", () => {
    let s = base(undefined, false, true);
    const hp = s.player.hp;
    const identity = s.player.spiderHamIdentity!;
    identity.counters = 0;
    const [event, a, b] = hand(s, "31017", "31023", "31024");
    expect(
      paymentSources(s, event.id, event.code).some((p) =>
        p.id.startsWith("spider-ham-toon:"),
      ),
    ).toBe(false);
    s = play(s, event, [a, b]);
    s = select(s, "hero:p1");
    s = byCard(s, "30001a");
    s = select(s, s.villain.id);
    s = select(s, s.villain.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.spiderHamIdentity?.counters).toBe(1);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([event.id, a.id, b.id]),
    );
  });
  it("Limitless Stamina actual paid PLAY readies suit with printed14HP even while wounded", () => {
    let s = base();
    s.player.exhausted = true;
    s.player.hp = 1;
    const [event, resource] = hand(s, "31023", "31024");
    s = settle(play(s, event, [resource]));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hp).toBe(1);
  });
  it("Unshakable grants native two-status Steady in both physical identity forms", () => {
    let s = base();
    const [u, resource] = hand(s, "31024", "31023");
    s = settle(play(s, u, [resource]));
    s = settle(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(1);
    s = settle(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunned).toBe(true);
    expect(s.player.stunCards).toBe(2);
    s.player.stunned = false;
    s.player.stunCards = 0;
    s.player.flipped = false;
    s = settle(command(s, { type: "FLIP" }));
    s = settle(
      native(s, { type: "status", target: "hero", status: "confused" }),
    );
    expect(s.player.confused).toBe(false);
    expect(s.player.confuseCards).toBe(1);
  });
  it("Otto paid PLAY readies an actual controlled Tech and draws one", () => {
    let s = base();
    const host = control(s, "31011");
    host.exhausted = true;
    const [otto, a, b] = hand(s, "31022", "31023", "31024");
    const top = s.player.deck[0];
    s = play(s, otto, [a, b]);
    s = byCard(s, "31022");
    s = select(s, host.id);
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === host.id)!.exhausted).toBe(
      false,
    );
    expect(s.player.hand.some((p) => p.id === top.id)).toBe(true);
  });
  it("Otto PUT into play leaves exhausted upgrade and draws nothing", () => {
    let s = base();
    const host = control(s, "31011");
    host.exhausted = true;
    const otto = source(s, "31022");
    s.player.discard.push(otto);
    const top = s.player.deck[0];
    s = settle(native(s, { type: "returnAlly", id: otto.id }));
    expect(s.player.inPlay.find((p) => p.id === host.id)!.exhausted).toBe(true);
    expect(s.player.deck[0].id).toBe(top.id);
  });
  it("Otto non-Tech ready never draws and targets only controlled upgrades", () => {
    let s = base("spider_man");
    const u = control(s, "31024");
    u.exhausted = true;
    const other = control(s, "01008", "p2");
    other.exhausted = true;
    const [otto, a, b] = hand(s, "31022", "31023", "31024");
    const top = s.player.deck[0];
    s = play(s, otto, [a, b]);
    s = byCard(s, "31022");
    expect(s.prompt?.options.some((o) => o.id === other.id)).toBe(false);
    s = select(s, u.id);
    s = settle(s);
    expect(s.player.deck[0].id).toBe(top.id);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === other.id)!.exhausted,
    ).toBe(true);
  });
  it("Spider-Ham actual attack discards real top encounter and applies boost damage", () => {
    let s = base();
    const ham = control(s, "31021"),
      boost = encounter(s, "01106");
    s.encounter.deck.unshift(boost);
    s = command(s, { type: "ABILITY", id: ham.id, action: "attack" });
    s = select(s, s.villain.id);
    s = settle(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === ham.id)?.damage).toBe(
      card(boost).boost,
    );
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
  });
  it("Spider-Ham actual thwart reshuffles exhausted encounter deck before real boost discard", () => {
    let s = base();
    const ham = control(s, "31021"),
      boost = encounter(s, "01106");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    // Retain all original instances; one real card is on top after a deterministic
    // shuffle, and every actual result is checked rather than assuming a draw.
    s.encounter.discard.unshift(boost);
    const accel = s.encounter.acceleration;
    s = command(s, { type: "ABILITY", id: ham.id, action: "thwart" });
    s = select(s, "main");
    s = settle(s);
    expect(s.encounter.acceleration).toBe(accel + 1);
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.discard).toHaveLength(1);
    const actual = s.encounter.discard[0];
    const alive = s.player.inPlay.find((p) => p.id === ham.id);
    expect(alive?.damage ?? 3).toBe(
      Math.min(3, Number(card(actual).boost || 0)),
    );
  });
  it("stunned Spider-Ham performs no attack and discards no encounter card", () => {
    let s = base();
    const ham = control(s, "31021");
    ham.stunned = true;
    const top = s.encounter.deck[0];
    s = settle(
      select(
        command(s, { type: "ABILITY", id: ham.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(50);
    expect(s.encounter.deck[0].id).toBe(top.id);
    expect(s.player.inPlay.find((p) => p.id === ham.id)!.stunned).toBe(false);
  });
  it("Daredevil survives actual defense and moves one damage through attacker Tough", () => {
    let s = base();
    const dd = control(s, "31014");
    s.villain.tough = true;
    const boost = encounter(s, "01105");
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === dd.id));
    s = choose(s, dd.id);
    s = byCard(s, "31014");
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === dd.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(49);
    expect(s.villain.tough).toBe(true);
  });
  it("Daredevil defeated by actual defense cannot move damage afterward", () => {
    let s = base();
    const dd = control(s, "31014");
    dd.damage = 2;
    const boost = encounter(s, "01105");
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === dd.id));
    s = choose(s, dd.id);
    s = settle(s);
    expect(s.player.discard.filter((p) => p.id === dd.id)).toHaveLength(1);
    expect(s.villain.hp).toBe(50);
  });
  it("Noir after actual resolved treachery captures original facedown piece once and X becomes one", () => {
    let s = base();
    const noir = control(s, "31015"),
      treachery = encounter(s, "01104");
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31015");
    s = settle(s);
    expect(
      s.player.inPlay
        .find((p) => p.id === noir.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([treachery.id]);
    expect(s.encounter.discard.some((p) => p.id === treachery.id)).toBe(false);
    s = command(s, { type: "ABILITY", id: noir.id, action: "attack" });
    s = select(s, s.villain.id);
    s = settle(s);
    expect(s.villain.hp).toBe(49);
  });
  it("Noir real attached treachery returns to encounter discard exactly once when ally leaves", () => {
    let s = base();
    const noir = control(s, "31015"),
      treachery = encounter(s, "01104");
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31015");
    s = settle(s);
    s = settle(damage(s, 3, noir.id));
    expect(s.player.discard.filter((p) => p.id === noir.id)).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
  });
  it("Spider-Tingle actual blind WR cancellation pays damage and leaves physical source discard", () => {
    let s = base();
    const tingle = control(s, "31020"),
      treachery = encounter(s, "01104");
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: treachery });
    expect(
      JSON.stringify({
        title: s.prompt?.title,
        text: s.prompt?.text,
        choices: s.prompt?.options.map(({ id, label, image }) => ({
          id,
          label,
          image,
        })),
      }),
    ).not.toContain(treachery.code);
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = settle(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.filter((p) => p.id === tingle.id)).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
  });
  it("Spider-Tingle on actual non-treachery pays damage and remains in play", () => {
    let s = base();
    const tingle = control(s, "31020"),
      minion = encounter(s, "01103");
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: minion });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = settle(s);
    // Its paid damage and Shocker's actual When Revealed both resolve.
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.inPlay.some((p) => p.id === tingle.id)).toBe(true);
    expect(s.minions.some((p) => p.id === minion.id)).toBe(true);
  });
  it("Tingle WR cancellation preserves printed Surge and permits Noir after actual keyword resolution", () => {
    let s = base(undefined, false, false, true);
    const tingle = control(s, "31020"),
      noir = control(s, "31015"),
      treachery = encounter(s, "01191");
    const dealtBefore = s.encounter.dealt.length;
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = byCard(s, "31015");
    s = settle(s);
    expect(s.encounter.dealt.length).toBe(dealtBefore + 1);
    expect(
      s.player.inPlay
        .find((p) => p.id === noir.id)
        ?.storedCards?.map((p) => p.id),
    ).toContain(treachery.id);
    expect(s.player.discard.filter((p) => p.id === tingle.id)).toHaveLength(1);
  });
  it("Tingle cancellation with no surviving keyword does not count a resolved treachery for Noir", () => {
    let s = base();
    const tingle = control(s, "31020"),
      noir = control(s, "31015"),
      treachery = encounter(s, "01104");
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = settle(s);
    expect(
      s.player.inPlay.find((p) => p.id === noir.id)?.storedCards || [],
    ).toEqual([]);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === tingle.id)).toHaveLength(1);
  });
  it("Tough precedes Forcefield's would-take window while a Tingle DEAL cost remains paid", () => {
    let s = base();
    const generator = control(s, "31019"),
      tingle = control(s, "31020");
    generator.counters = 6;
    s.player.tough = true;
    const hp = s.player.hp,
      treachery = encounter(s, "01104");
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === generator.id)?.counters).toBe(
      6,
    );
    expect(s.player.discard.filter((p) => p.id === tingle.id)).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
  });
  it("Forcefield prevents a Tingle's DEAL damage without preventing the actual cancellation", () => {
    let s = base();
    const generator = control(s, "31019"),
      tingle = control(s, "31020");
    generator.counters = 6;
    const hp = s.player.hp,
      treachery = encounter(s, "01104");
    s = native(s, { type: "reveal", piece: treachery });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((p) => p.id === generator.id)?.counters).toBe(
      5,
    );
    expect(s.player.discard.filter((p) => p.id === tingle.id)).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
  });
  it("Spider-Ham Tingle cost produces a toon before revealing the actual non-treachery", () => {
    let s = base(undefined, false, true);
    const tingle = control(s, "31020"),
      minion = encounter(s, "01103");
    s.player.spiderHamIdentity!.counters = 0;
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: minion });
    s = byCard(s, "31020");
    s = select(s, "hero:p1");
    s = until(s, (v) => /Spider-Nonsense/.test(v.prompt?.title || ""));
    expect(s.minions.some((p) => p.id === minion.id)).toBe(false);
    s = choose(s, "yes");
    s = settle(s);
    expect(s.player.spiderHamIdentity?.counters).toBe(1);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.minions.some((p) => p.id === minion.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === tingle.id)).toBe(true);
  });
  it("Clarity uses legal custom40 with the original supplemental printing", () => {
    const s = base("spiderham", true);
    expect(s.player.deck).toHaveLength(40);
    expect(s.player.deck.filter((p) => p.code === "31029")).toHaveLength(1);
    expect(
      s.player.deck.every((p) =>
        ["hero", "leadership", "basic"].includes(card(p).faction_code),
      ),
    ).toBe(true);
    exact(s);
  });
  it("Clarity paid original attach to another identity and real wild damages exact friendly character", () => {
    let s = base("spiderham", true);
    const [c, payment] = hand(s, "31029", "01088");
    s = play(s, c, [payment]);
    s = select(s, "hero:p2");
    s = settle(s);
    const hp = seatView(s, "p2").player.hp;
    const [event] = hand(s, "31023");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], "energy", [c.id]);
    s = byCard(s, "30001a");
    s = settle(s);
    expect(seatView(s, "p2").player.hp).toBe(hp - 1);
    expect(seatView(s, "p2").player.spiderHamIdentity?.counters).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === c.id)?.exhausted).toBe(true);
  });
  it("Clarity native DEAL cost through Tough still generates one real wild", () => {
    let s = base(undefined, true);
    const c = control(s, "31029");
    c.attachedTo = "hero:p1";
    s.player.tough = true;
    const [event] = hand(s, "31023");
    const hp = s.player.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], "energy", [c.id]);
    s = select(s, "hero:p1");
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === c.id)?.exhausted).toBe(true);
  });
  it("Clarity real ally damage may defeat attached character before generated resource completes", () => {
    let s = base(undefined, true);
    const c = control(s, "31029"),
      ally = control(s, "01083");
    c.attachedTo = ally.id;
    ally.damage = 2;
    const [event] = hand(s, "31023");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], "energy", [c.id]);
    s = select(s, "hero:p1");
    s = settle(s);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === c.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
});
