import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  ROCKET_SCRIPT_CODES,
  rocketAbility,
  rocketAbilityOptions,
  rocketAfterBasicThwart,
  rocketAttachmentActions,
  rocketBoost,
  rocketDamageResolved,
  rocketEncounterReveal,
  rocketEnemyStats,
  rocketEnterPlay,
  rocketEvent,
  rocketHeroTraits,
  rocketIsIdentitySource,
  rocketMaxHpBonus,
  rocketPhaseEnded,
  rocketPlayRestriction,
  rocketResourceSpent,
  rocketRoundEnded,
  rocketStats,
  rocketTurnEnded,
  resolveRocketEffect,
  type RocketPorts,
} from "../src/game/rocket.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const R = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `rocket:${type}`,
  ...args,
});
const reload = (s: GameState): GameState => {
  const result: GameState = JSON.parse(JSON.stringify(s));
  const seat = result.players.find((p) => p.id === result.activePlayerId)!;
  seat.player = result.player;
  seat.flags = result.flags;
  return result;
};
function fixture(team = false) {
  let s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 16029,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "rocket", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  if (team) s = dispatch(s, { type: "MULLIGAN", ids: [] });
  expect(s.error).toBeUndefined();
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.player.discard = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.flags = {};
  s.players[0].player = s.player;
  s.players[0].flags = s.flags;
  const ports: RocketPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    select: (state, title, text, pieces, min, max, action) => {
      state.prompt = {
        kind: "select",
        title,
        text,
        min,
        max,
        selectAction: action,
        options: pieces.map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          image: p.code,
          effects: [],
        })),
      };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: (state, _counts, form) => {
      state.player.form = form === "alter" ? "alter" : "hero";
    },
    canReadyIdentity: () => true,
    canPay: vi.fn(() => true),
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack || !state.minions.some((p) => p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: () => [],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing physical card");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const zone = [state.player.inPlay, state.attachments, state.minions].find(
        (zone) => zone.some((p) => p.id === id),
      );
      if (!zone) throw Error("Missing physical card");
      const p = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      )[0];
      (cards.get(p.code)!.faction_code === "encounter"
        ? state.encounter.discard
        : state.player.discard
      ).push(p);
    }),
    revealHidden: (state) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    },
    recycleEncounter: vi.fn(),
    attackProgram: vi.fn(),
    log: vi.fn(),
    cardCost: (_state, p) => Number(cards.get(p.code)?.cost || 0),
    damageBatch: vi.fn(),
    discardEncounterTop: (state) => {
      const p = state.encounter.deck.shift();
      if (p) state.encounter.discard.push(p);
      const emptied = state.encounter.deck.length === 0;
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
      if (emptied) {
        state.encounter.deck = state.encounter.discard.splice(0);
        state.encounter.acceleration++;
      }
      return { piece: p, emptied };
    },
  };
  const piece = (code: string, patch: Partial<Piece> = {}) => ({
    ...makePiece(s, code),
    ...patch,
  });
  return { s, ports, piece };
}
const damage = (patch: Record<string, unknown> = {}) => ({
  actualDamage: 2,
  excessDamage: 1,
  sourceIsIdentity: true,
  wasHero: true,
  ...patch,
});

describe("Rocket printed rules and physical continuations", () => {
  it("covers every Rocket identity, signature, obligation and nemesis face exactly", () => {
    const expected = (catalog as unknown as Card[])
      .filter((c) => ["rocket", "rocket_nemesis"].includes(c.set_code || ""))
      .map((c) => c.code);
    expect([...ROCKET_SCRIPT_CODES].sort()).toEqual(expected.sort());
    expect(new Set(ROCKET_SCRIPT_CODES).size).toBe(17);
  });
  it("tracks HP in both forms and ATK, THW and Aerial only in hero form", () => {
    const { s, piece } = fixture();
    s.player.inPlay.push(piece("16035"), piece("16039"));
    expect(rocketMaxHpBonus(s)).toBe(3);
    expect(rocketStats(s)).toEqual({ attack: 1, thwart: 1 });
    expect(rocketHeroTraits(s)).toEqual(["Aerial"]);
    s.player.form = "alter";
    expect(rocketMaxHpBonus(s)).toBe(3);
    expect(rocketStats(s)).toEqual({ attack: 0, thwart: 0 });
    expect(rocketHeroTraits(s)).toEqual([]);
  });
  it("Tech Theft blanks all three continuous upgrade modifiers without deleting their pieces", () => {
    const { s, piece } = fixture();
    s.player.inPlay.push(piece("16035"), piece("16039"));
    s.sideSchemes.push(piece("12026"));
    expect(rocketMaxHpBonus(s)).toBe(0);
    expect(rocketStats(s)).toEqual({ attack: 0, thwart: 0 });
    expect(rocketHeroTraits(s)).toEqual([]);
    expect(s.player.inPlay).toHaveLength(2);
  });
  it.each([
    ["16034", 2],
    ["16036", 2],
    ["16037", 2],
    ["16038", 3],
  ] as const)(
    "initializes physical %s with %i charge counters without a Uses effect",
    (code, count) => {
      const { s, piece } = fixture();
      const p = piece(code);
      s.player.inPlay.push(p);
      expect(rocketEnterPlay(s, p)).toEqual([]);
      expect(p.counters).toBe(count);
      p.counters = 0;
      expect(s.player.inPlay.some((c) => c.id === p.id)).toBe(true);
    },
  );
  it("does not resolve a blanked enter-play charge ability", () => {
    const { s, piece } = fixture();
    const p = piece("16036");
    s.player.inPlay.push(p);
    s.sideSchemes.push(piece("12026"));
    rocketEnterPlay(s, p);
    expect(p.counters).toBe(0);
  });
  it("Tinkering pays the selected actual Tech upgrade before queuing two draws", () => {
    let { s, ports, piece } = fixture();
    s.player.form = "alter";
    const p = piece("16038", { counters: 0, exhausted: true });
    s.player.inPlay.push(p);
    expect(rocketAbility(s, "identity", "tinkering", ports)).toEqual([
      R("tinker"),
    ]);
    resolveRocketEffect(s, R("tinker"), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    s = reload(s);
    resolveRocketEffect(s, { ...s.prompt!.selectAction!, ids: [p.id] }, ports);
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.discard.at(-1)?.id).toBe(p.id);
    expect(s.queue).toEqual([{ type: "draw", amount: 2 }]);
    expect(s.flags.rocketTinkerRound).toBe(s.round);
    expect(rocketAbilityOptions(s, "identity", ports)).toEqual([]);
  });
  it("Tinkering accepts a blank Tech upgrade because its traits remain", () => {
    const { s, ports, piece } = fixture();
    s.player.form = "alter";
    const p = piece("16036");
    s.player.inPlay.push(p);
    s.sideSchemes.push(piece("12026"));
    resolveRocketEffect(s, R("tinker-discard", { ids: [p.id] }), ports);
    expect(s.queue[0]).toEqual({ type: "draw", amount: 2 });
  });
  it("Tinkering rejects a Tech support, another player's upgrade and duplicate selections", () => {
    const { s, ports, piece } = fixture(true);
    s.player.form = "alter";
    const support = piece("01044"),
      other = piece("16038", { ownerId: "p2" });
    s.player.inPlay.push(support);
    s.players[1].player.inPlay.push(other);
    for (const ids of [[support.id], [other.id], [other.id, other.id]])
      expect(() =>
        resolveRocketEffect(s, R("tinker-discard", { ids }), ports),
      ).toThrow();
  });
  it("a replacement destination still pays Tinkering's discard cost", () => {
    const { s, ports, piece } = fixture();
    s.player.form = "alter";
    const p = piece("16038");
    s.player.inPlay.push(p);
    ports.discardPiece = (state, id) => {
      state.removed.push(
        state.player.inPlay.splice(
          state.player.inPlay.findIndex((p) => p.id === id),
          1,
        )[0],
      );
    };
    resolveRocketEffect(s, R("tinker-discard", { ids: [p.id] }), ports);
    expect(s.removed.at(-1)?.id).toBe(p.id);
    expect(s.queue[0]).toEqual({ type: "draw", amount: 2 });
  });
  it("round cleanup permits Tinkering again while phase cleanup does not", () => {
    const { s, ports, piece } = fixture();
    s.player.form = "alter";
    s.player.inPlay.push(piece("16038"));
    s.flags.rocketTinkerRound = s.round;
    rocketPhaseEnded(s);
    expect(rocketAbilityOptions(s, "identity", ports)).toEqual([]);
    rocketRoundEnded(s);
    expect(rocketAbilityOptions(s, "identity", ports)).toHaveLength(1);
  });
  it("Battery Pack exhausts as its cost then moves one actual charge after saved target choice", () => {
    let { s, ports, piece } = fixture();
    s.player.form = "alter";
    const battery = piece("16034", { counters: 1 }),
      pistol = piece("16038"),
      skeleton = piece("16035");
    s.player.inPlay.push(battery, pistol, skeleton);
    resolveRocketEffect(s, R("battery", { id: battery.id }), ports);
    expect(battery.exhausted).toBe(true);
    expect(battery.counters).toBe(1);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      pistol.id,
      skeleton.id,
    ]);
    s = reload(s);
    resolveRocketEffect(
      s,
      s.prompt!.options.find((o) => o.id === pistol.id)!.effects[0],
      ports,
    );
    expect(s.player.inPlay.find((p) => p.id === battery.id)?.counters).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === pistol.id)?.counters).toBe(1);
    expect(s.player.inPlay).toHaveLength(3);
  });
  it("Battery Pack cannot move a counter to itself or a foreign Tech card", () => {
    const { s, ports, piece } = fixture(true);
    const b = piece("16034", { counters: 1, exhausted: true });
    const p = piece("16036", { ownerId: "p2" });
    s.player.inPlay.push(b);
    s.players[1].player.inPlay.push(p);
    for (const target of [b.id, p.id])
      expect(() =>
        resolveRocketEffect(s, R("battery-move", { id: b.id, target }), ports),
      ).toThrow();
  });
  it.each(["16036", "16038"])(
    "%s pays exhaustion and its final charge before the host checks Stun",
    (code) => {
      const { s, ports, piece } = fixture();
      s.player.stunned = true;
      const p = piece(code, { counters: 1 });
      s.player.inPlay.push(p);
      resolveRocketEffect(s, R("weapon", { id: p.id }), ports);
      expect(p.exhausted).toBe(true);
      expect(p.counters).toBe(0);
      expect(s.player.inPlay[0].id).toBe(p.id);
      expect(s.queue[0]).toMatchObject({
        type: "attackAction",
        target: s.villain.id,
        source: "hero",
        amount: code === "16036" ? 4 : 2,
      });
      if (code === "16036")
        expect(s.queue[0]).toMatchObject({ ranged: true, overkill: true });
      expect(s.player.stunned).toBe(true); // Native attackAction performs the replacement.
    },
  );
  it("charged weapons require hero form, ready active text and an attack target", () => {
    const { s, ports, piece } = fixture();
    const p = piece("16036", { counters: 1 });
    s.player.inPlay.push(p);
    for (const patch of [{ exhausted: true }, { counters: 0 }]) {
      Object.assign(p, patch);
      expect(rocketAbilityOptions(s, p.id, ports)).toEqual([]);
      Object.assign(p, { exhausted: false, counters: 1 });
    }
    s.player.form = "alter";
    expect(rocketAbilityOptions(s, p.id, ports)).toEqual([]);
    s.player.form = "hero";
    s.flags[`blank:${p.id}`] = true;
    expect(rocketAbilityOptions(s, p.id, ports)).toEqual([]);
  });
  it("Rocket Launcher saves a player choice then commits one nonattack enemy batch", () => {
    let { s, ports, piece } = fixture(true);
    const p = piece("16037", { counters: 1 });
    const one = piece("01101", { engagedWith: "p1" }),
      two = piece("01102", { engagedWith: "p2" });
    s.player.inPlay.push(p);
    s.minions.push(one, two);
    s.player.stunned = true;
    resolveRocketEffect(s, R("launcher", { id: p.id }), ports);
    expect(p.exhausted).toBe(true);
    expect(p.counters).toBe(0);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    s = reload(s);
    resolveRocketEffect(s, s.prompt!.options[1].effects[0], ports);
    expect(ports.damageBatch).toHaveBeenCalledWith(
      s,
      [s.villain.id, two.id],
      2,
      "hero",
    );
    expect(s.player.stunned).toBe(true);
    expect(s.minions.some((p) => p.id === one.id)).toBe(true);
  });
  it("Reload readies every exhausted controlled Tech upgrade and ignores other cards", () => {
    const { s, ports, piece } = fixture();
    const tech = piece("16036", { exhausted: true }),
      armor = piece("01076", { exhausted: true });
    const ready = piece("16038");
    s.player.inPlay.push(tech, armor, ready);
    resolveRocketEffect(s, rocketEvent(s, piece("16031"))![0], ports);
    expect(s.queue).toEqual([{ type: "ready", target: tech.id }]);
    s.player.inPlay = [ready];
    expect(rocketPlayRestriction(s, piece("16031"))).toContain(
      "exhausted Tech",
    );
  });
  it("Schadenfreude heals for each actual damaged enemy, including distinct nonattack packets", () => {
    const { s, ports } = fixture();
    resolveRocketEffect(s, R("schadenfreude"), ports);
    const result = rocketDamageResolved(s, damage({ excessDamage: 0 }));
    expect(result).toEqual([
      {
        type: "heal",
        target: "hero",
        amount: 2,
        title: "Schadenfreude",
        mandatory: true,
      },
    ]);
    expect(rocketDamageResolved(s, damage({ excessDamage: 0 }))).toEqual(
      result,
    );
    s.player.form = "alter";
    expect(rocketDamageResolved(s, damage({ excessDamage: 0 }))).toEqual(
      result,
    );
  });
  it.each([
    { actualDamage: 0 },
    { sourceIsIdentity: false },
    { playerId: "p2" },
  ])(
    "prevention and foreign sources produce no Rocket damage response: %j",
    (patch) => {
      const { s, ports } = fixture();
      resolveRocketEffect(s, R("schadenfreude"), ports);
      expect(rocketDamageResolved(s, damage(patch))).toEqual([]);
    },
  );
  it("Murdered You has no attack or once-per-round restriction and no draw for exact lethal", () => {
    const { s } = fixture();
    expect(rocketDamageResolved(s, damage({ excessDamage: 0 }))).toEqual([]);
    for (const target of ["minion-one", "minion-two", s.villain.id])
      expect(rocketDamageResolved(s, damage({ target }))[0]).toMatchObject({
        type: "optional",
        effects: [{ type: "draw", amount: 1 }],
      });
    expect(rocketDamageResolved(s, damage({ wasHero: false }))).toEqual([]);
  });
  it("Schadenfreude stacks actual copies and expires at the establishing turn's end", () => {
    const { s, ports } = fixture();
    resolveRocketEffect(s, R("schadenfreude"), ports);
    resolveRocketEffect(s, R("schadenfreude"), ports);
    expect(rocketDamageResolved(s, damage({ excessDamage: 0 }))[0].amount).toBe(
      4,
    );
    rocketTurnEnded(s, "p2");
    expect(s.flags.rocketSchadenTurn).toBeDefined();
    rocketTurnEnded(s, "p1");
    expect(rocketDamageResolved(s, damage({ excessDamage: 0 }))).toEqual([]);
  });
  it("identity source classification excludes actual allies, supports and foreign character upgrades", () => {
    const { s, piece } = fixture(true);
    const own = piece("16036"),
      ally = piece("01067"),
      support = piece("01078");
    const attached = piece("01076", { attachedTo: ally.id });
    s.player.inPlay.push(own, ally, support, attached);
    expect(rocketIsIdentitySource(s, "hero")).toBe(true);
    expect(rocketIsIdentitySource(s, own.id)).toBe(true);
    for (const p of [ally, support, attached])
      expect(rocketIsIdentitySource(s, p.id)).toBe(false);
    own.attachedTo = "hero:p2";
    expect(rocketIsIdentitySource(s, own.id)).toBe(false);
  });
  it("actual resolving owned events qualify while another player's event does not", () => {
    const { s, piece } = fixture();
    const event = piece("01077");
    s.resolving.push(event);
    s.currentEventId = event.id;
    for (const source of ["hero", event.id, event.code])
      expect(rocketIsIdentitySource(s, source)).toBe(true);
    event.ownerId = "p2";
    expect(rocketIsIdentitySource(s, "hero")).toBe(false);
  });
  it("I've Got a Plan uses an actual hand event, native payment and repeatable saved continuation", () => {
    let { s, ports, piece } = fixture();
    const first = piece("16030"),
      second = piece("16030");
    s.player.hand.push(first, second);
    const after = [{ type: "sentinel" }];
    expect(rocketAfterBasicThwart(s, after, ports).map((o) => o.id)).toEqual([
      first.id,
      second.id,
    ]);
    resolveRocketEffect(s, R("plan-pay", { id: first.id, after }), ports);
    s = reload(s);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      piece: { id: first.id },
      cancelable: false,
    });
    expect(s.queue[0].after[0]).toEqual({
      type: "resolveHandEvent",
      id: first.id,
      after: [R("plan")],
      continuation: [R("plan-window", { after })],
    });
    expect(rocketPlayRestriction(s, first)).toContain("response");
  });
  it("Plan bonuses stack, apply only in hero form and reset at phase end", () => {
    const { s, ports } = fixture();
    resolveRocketEffect(s, R("plan"), ports);
    resolveRocketEffect(s, R("plan"), ports);
    expect(rocketStats(s).thwart).toBe(2);
    expect(s.queue.filter((e) => e.type === "ready")).toHaveLength(2);
    s.player.form = "alter";
    expect(rocketStats(s).thwart).toBe(0);
    s.player.form = "hero";
    rocketPhaseEnded(s);
    expect(rocketStats(s).thwart).toBe(0);
  });
  it("Plan requires payable actual event and hero form", () => {
    const { s, ports, piece } = fixture();
    const event = piece("16030");
    s.player.hand.push(event);
    ports.canPay = () => false;
    expect(rocketAfterBasicThwart(s, [], ports)).toEqual([]);
    ports.canPay = () => true;
    s.player.form = "alter";
    expect(rocketAfterBasicThwart(s, [], ports)).toEqual([]);
    expect(() =>
      resolveRocketEffect(s, R("plan-pay", { id: event.id }), ports),
    ).toThrow();
  });
  it("Salvage has an optional response in either form and preserves its selected physical Tech card", () => {
    let { s, ports, piece } = fixture();
    s.player.form = "alter";
    const salvage = piece("16033"),
      a = piece("16038"),
      b = piece("16038");
    s.player.discard.push(salvage, a, b);
    const originalTop = s.player.deck[0].id;
    expect(rocketResourceSpent(s, salvage)[0]).toMatchObject({
      type: "optional",
      effects: [R("salvage")],
    });
    resolveRocketEffect(s, R("salvage"), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    s = reload(s);
    resolveRocketEffect(s, s.prompt!.options[1].effects[0], ports);
    expect(s.player.deck.slice(0, 2).map((p) => p.id)).toEqual([
      b.id,
      originalTop,
    ]);
    expect(s.player.discard.map((p) => p.id)).toEqual([salvage.id, a.id]);
  });
  it("Salvage cannot retrieve a support, itself or an upgrade outside the actual discard", () => {
    const { s, ports, piece } = fixture();
    const salvage = piece("16033"),
      support = piece("01078"),
      p = piece("16038");
    s.player.discard.push(salvage, support);
    s.player.inPlay.push(p);
    expect(rocketResourceSpent(s, salvage)).toEqual([]);
    for (const id of [salvage.id, support.id, p.id])
      expect(() =>
        resolveRocketEffect(s, R("salvage-top", { id }), ports),
      ).toThrow();
  });
  it("Crisis on Halfworld routes to Rocket's actual seat", () => {
    const { s, piece } = fixture(true);
    const other = seatView(s, "p2"),
      p = piece("16053");
    expect(rocketEncounterReveal(other, p)).toEqual([
      R("obligation", { piece: p, actorId: "p1" }),
    ]);
  });
  it("an obligation flip is optional and its exhaustion permanently removes its physical card", () => {
    let { s, ports, piece } = fixture();
    const p = piece("16053", { ownerId: undefined });
    s.resolving.push(p);
    resolveRocketEffect(s, R("obligation", { piece: p }), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["flip", "stay"]);
    resolveRocketEffect(s, s.prompt!.options[0].effects[0], ports);
    expect(s.player.form).toBe("alter");
    s = reload(s);
    resolveRocketEffect(s, R("obligation-remove", { piece: p }), ports);
    expect(s.player.exhausted).toBe(true);
    expect(s.resolving).toEqual([]);
    expect(s.removed.at(-1)?.id).toBe(p.id);
  });
  it("Crisis discards exactly a highest printed cost upgrade, choosing ties", () => {
    const { s, ports, piece } = fixture();
    const cheap = piece("16034"),
      one = piece("16036"),
      two = piece("16037");
    s.player.inPlay.push(cheap, one, two);
    resolveRocketEffect(s, R("obligation-discard"), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([one.id, two.id]);
    expect(() =>
      resolveRocketEffect(
        s,
        R("obligation-upgrade", { target: cheap.id }),
        ports,
      ),
    ).toThrow();
    resolveRocketEffect(s, s.prompt!.options[1].effects[0], ports);
    expect(s.player.discard.at(-1)?.id).toBe(two.id);
  });
  it("Crisis gains surge when no upgrade can be discarded", () => {
    const { s, ports } = fixture();
    resolveRocketEffect(s, R("obligation-discard"), ports);
    expect(s.queue).toEqual([{ type: "surge", sourceCode: "16053" }]);
  });
  it("Blackjack's Bazooka attaches to actual Blackjack then adds the face's +2 ATK", () => {
    const { s, ports, piece } = fixture();
    const bazooka = piece("16056", { ownerId: undefined }),
      blackjack = piece("16055", { ownerId: undefined });
    s.attachments.push(bazooka);
    s.minions.push(blackjack);
    resolveRocketEffect(s, R("bazooka", { id: bazooka.id }), ports);
    expect(bazooka.attachedTo).toBe(blackjack.id);
    expect(rocketEnemyStats(s, blackjack)).toEqual({ attack: 2 });
    expect(rocketEnemyStats(s, s.villain)).toEqual({ attack: 0 });
  });
  it("Bazooka falls back to the villain and requires three actual mental resources", () => {
    const { s, ports, piece } = fixture();
    const p = piece("16056");
    s.attachments.push(p);
    resolveRocketEffect(s, R("bazooka", { id: p.id }), ports);
    expect(p.attachedTo).toBe(s.villain.id);
    expect(rocketAttachmentActions(s, p, ports)[0].id).toBe("remove");
    resolveRocketEffect(s, R("bazooka-pay", { id: p.id }), ports);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 3,
      requirements: ["mental", "mental", "mental"],
      targetCode: "16056",
    });
    s.player.form = "alter";
    expect(rocketAttachmentActions(s, p, ports)).toEqual([]);
  });
  it("Planetary Invasion reveals the discarded physical minion before its Tough clause", () => {
    const { s, ports, piece } = fixture();
    const skipped = piece("01099"),
      minion = piece("01101"),
      after = piece("01103");
    s.encounter.deck = [skipped, minion, after];
    s.encounter.discard = [];
    resolveRocketEffect(s, R("invasion"), ports);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([after.id]);
    expect(s.encounter.discard.map((p) => p.id)).toEqual([skipped.id]);
    expect(s.queue).toEqual([
      { type: "reveal", piece: minion, fromEncounterDeck: false },
      R("invasion-tough", { id: minion.id }),
    ]);
    expect(s.minions).toEqual([]);
  });
  it("the last discarded minion is removed from a newly recycled deck exactly once", () => {
    const { s, ports, piece } = fixture();
    const minion = piece("01101");
    s.encounter.deck = [minion];
    s.encounter.discard = [];
    resolveRocketEffect(s, R("invasion"), ports);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toEqual([]);
    expect(s.encounter.discard).toEqual([]);
    expect(s.queue[0].piece.id).toBe(minion.id);
  });
  it("an exhausted discard-until effect stops even when recycling made an old minion available", () => {
    const { s, ports, piece } = fixture();
    const last = piece("01099"),
      oldMinion = piece("01101");
    s.encounter.deck = [last];
    s.encounter.discard = [oldMinion];
    resolveRocketEffect(s, R("invasion"), ports);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.queue).toEqual([]);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([oldMinion.id, last.id]);
  });
  it("Planetary Invasion grants Tough only to the minion that actually entered play", () => {
    const { s, ports, piece } = fixture();
    const minion = piece("01101");
    resolveRocketEffect(s, R("invasion-tough", { id: minion.id }), ports);
    expect(s.queue).toEqual([]);
    s.minions.push(minion);
    resolveRocketEffect(s, R("invasion-tough", { id: minion.id }), ports);
    expect(s.queue).toEqual([
      { type: "status", target: minion.id, status: "tough" },
    ]);
  });
  it("plain nemesis keywords stay with the shared host and unrelated effects stay unclaimed", () => {
    const { s, ports, piece } = fixture();
    for (const code of ["16054", "16055"])
      expect(rocketEncounterReveal(s, piece(code))).toEqual([]);
    expect(rocketBoost(s, piece("16057"))).toBeNull();
    expect(rocketEnterPlay(s, piece("16035"))).toBeNull();
    expect(rocketEvent(s, piece("01077"))).toBeNull();
    expect(resolveRocketEffect(s, { type: "draw", amount: 1 }, ports)).toBe(
      false,
    );
  });
});
