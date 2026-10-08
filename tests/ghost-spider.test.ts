import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import { consumeStatus, consumeTough } from "../src/game/keywords.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  GHOST_SPIDER_SCRIPT_CODES,
  ghostSpiderAbility,
  ghostSpiderAbilityOptions,
  ghostSpiderActivationOptions,
  ghostSpiderAfterBasicPower,
  ghostSpiderBasicPowerOptions,
  ghostSpiderBoost,
  ghostSpiderCannotPlayEvents,
  ghostSpiderCardEntered,
  ghostSpiderCommitReaction,
  ghostSpiderEncounterReveal,
  ghostSpiderEnemyModifiers,
  ghostSpiderEvent,
  ghostSpiderEventRequirements,
  ghostSpiderEventResolved,
  ghostSpiderEventResolutionOptions,
  ghostSpiderInitializeNemesis,
  ghostSpiderPlayRestriction,
  ghostSpiderReactionEffects,
  ghostSpiderRevealOptions,
  ghostSpiderShadowOfPast,
  ghostSpiderStoredPlayable,
  ghostSpiderTakeStoredForPlay,
  ghostSpiderVillainPhaseBegins,
  resolveGhostSpiderEffect,
  type GhostSpiderBasicReceipt,
  type GhostSpiderEventReceipt,
  type GhostSpiderPorts,
  type GhostSpiderReactionContext,
} from "../src/game/ghost-spider.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ghost-spider:${type}`,
  ...args,
});
const basic = (
  args: Partial<GhostSpiderBasicReceipt> = {},
): GhostSpiderBasicReceipt => ({
  token: "basic-1",
  playerId: "p1",
  power: "attack",
  performed: true,
  wasHero: true,
  ...args,
});
const resolved = (
  args: Partial<GhostSpiderEventReceipt> = {},
): GhostSpiderEventReceipt => ({
  token: "play-1",
  playerId: "p1",
  eventId: "event-1",
  code: "27002",
  kind: "response",
  resolved: true,
  ...args,
});

function fixture() {
  const s = newGame({
    heroId: "rocket",
    aspect: "protection",
    villainId: "rhino",
    seed: 27001,
    pacing: "expert",
    heroes: [
      { heroId: "rocket", aspect: "protection" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.heroId = s.players[0].heroId = "ghost_spider";
  s.phase = "player";
  s.activePlayerId = s.turnPlayerId = s.firstPlayerId = "p1";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.setAside = [];
    v.player.exhausted = false;
    v.player.stunned = v.player.confused = v.player.tough = false;
    v.flags = {};
    seat.flags = v.flags;
  }
  s.flags = s.players[0].flags;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.removed = [];
  s.encounter.deck = [];
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 10;
  const f = {
    s,
    ports: {} as GhostSpiderPorts,
    packets: [] as Effect[],
    history: [] as string[],
    removed: [] as string[],
    playCounter: 0,
    cancelPlay: false,
    attackPerformed: true,
    piece: (code: string): Piece => ({
      ...makePiece(f.s, code),
      ownerId: f.s.activePlayerId,
    }),
  };
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    isIdentityTextBlank: (s) => !!s.flags.identityBlank,
    canReadyIdentity: (s, id) => !seatView(s, id).flags.cannotReady,
    canReadyPiece: (s, p) => !s.flags[`cannotReady:${p.id}`],
    cardCost: (_s, p) => cards.get(p.code)?.cost || 0,
    canPay: vi.fn(() => true),
    canPlayReaction: (s) => !s.flags.peril,
    playReaction: (s, id, context, after) => {
      if (f.cancelPlay) {
        f.history.push("payment-cancel");
        f.ports.queue(s, ...after);
        return;
      }
      const hi = s.player.hand.findIndex((p) => p.id === id),
        p =
          hi >= 0
            ? s.player.hand.splice(hi, 1)[0]
            : ghostSpiderTakeStoredForPlay(s, id, f.ports);
      if (!p) throw Error("Missing actual event source");
      s.resolving.push(p);
      ghostSpiderCommitReaction(s, p, context);
      f.history.push(`play:${p.id}`);
      const receipt = resolved({
        token: `play-${++f.playCounter}`,
        playerId: s.activePlayerId,
        eventId: p.id,
        code: p.code,
        kind: context.kind === "basic" ? "response" : "interrupt",
      });
      const replaced =
        (p.code === "27002" && consumeStatus(s.player, "stunned")) ||
        (p.code === "27004" && consumeStatus(s.player, "confused"));
      receipt.resolved = !replaced;
      f.ports.queue(
        s,
        ...(!replaced ? ghostSpiderReactionEffects(s, p, context) : []),
        { type: "fixture:finish-event", id: p.id, receipt, after },
      );
    },
    enemyTargets: (s) => [
      { id: s.villain.id, label: "villain" },
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (s) => [
      ...(s.scheme.threat > 0 ? [{ id: "main", label: "main" }] : []),
      ...s.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({ id: p.id, label: "side", code: p.code })),
    ],
    attackProgram: (s, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(s, ...effects, ...after);
    },
    countEncounterBoostIcons: (s, id, after) => {
      f.history.push(`count:${id}`);
      const p = [
        ...s.resolving,
        ...s.encounter.dealt,
        ...s.minions,
        ...s.attachments,
        ...s.sideSchemes,
      ].find((p) => p.id === id)!;
      const total = Number(
        s.flags.boostOverride ?? cards.get(p.code)?.boost ?? 0,
      );
      f.ports.queue(s, ...after.map((e) => ({ ...e, boostTotal: total })));
    },
    cancelWhenRevealed: (s, r, after) => {
      f.packets.push({ type: "cancelWhenRevealed", ...r });
      f.history.push(`cancel:${r.pieceId}`);
      f.ports.queue(s, ...after);
    },
    activationAvailable: (s, r) => s.flags.activationToken === r.token,
    cancelActivation: (s, r) => {
      const success = s.flags.activationToken === r.token;
      delete s.flags.activationToken;
      f.packets.push({ type: "cancelActivation", success, ...r });
      return success;
    },
    discardHand: (s, id) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) {
        const p = s.player.hand.splice(i, 1)[0];
        seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
      }
    },
    removeControlledCard: (s, id) => {
      const i = s.player.inPlay.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing actual controlled source");
      s.removed.push(s.player.inPlay.splice(i, 1)[0]);
      f.removed.push(id);
    },
    shufflePlayerDeck: (s, after) => {
      f.history.push("shuffle-deck");
      f.ports.queue(s, ...after);
    },
    shuffleDiscardIntoDeck: (s, after) => {
      s.player.deck.push(...s.player.discard.splice(0));
      f.history.push("merge-shuffle");
      f.ports.queue(s, ...after);
    },
    handSize: (s) =>
      Number(s.flags.handSize ?? (s.player.form === "hero" ? 5 : 6)),
    revealHidden: () => {
      f.history.push("reveal-hidden");
    },
    makePiece: (s, code) => makePiece(s, code),
    shuffleEncounter: () => {
      f.history.push("shuffle-encounter");
    },
    enemyRemainingHP: (s, p) =>
      (cards.get(p.code)?.health || 0) +
      ghostSpiderEnemyModifiers(s, p, f.ports).health -
      p.damage,
    captureGeorgeForObligation: (s, id) => {
      const ob = s.player.inPlay.find((p) => p.id === id)!;
      for (const z of [
        s.player.deck,
        s.player.hand,
        s.player.discard,
        s.player.inPlay,
      ]) {
        const i = z.findIndex((p) => p.code === "27007");
        if (i < 0) continue;
        const g = z.splice(i, 1)[0];
        for (const e of g.storedCards || [])
          seatView(s, e.ownerId || s.activePlayerId).player.discard.push(e);
        g.storedCards = [];
        ob.storedCards = [g];
        f.history.push(`capture:${g.id}`);
        return;
      }
    },
    attackLizard: (s, id, playerId, completion) => {
      f.packets.push({
        type: "lizardAttack",
        id,
        playerId,
        locked: ghostSpiderCannotPlayEvents(seatView(s, playerId)),
        teammateLocked: ghostSpiderCannotPlayEvents(
          seatView(s, playerId === "p1" ? "p2" : "p1"),
        ),
        form: seatView(s, playerId).player.form,
      });
      f.ports.queue(s, { ...completion, performed: f.attackPerformed });
    },
  };
  const resolve = (e: Effect) => {
    if (e.actorId && e.actorId !== f.s.activePlayerId)
      activateSeat(f.s, e.actorId);
    if (resolveGhostSpiderEffect(f.s, e, f.ports)) return;
    switch (e.type) {
      case "fixture:finish-event": {
        const i = f.s.resolving.findIndex((p) => p.id === e.id);
        const p = f.s.resolving.splice(i, 1)[0];
        seatView(f.s, p.ownerId || f.s.activePlayerId).player.discard.push(p);
        f.ports.queue(
          f.s,
          ...ghostSpiderEventResolved(f.s, e.receipt, e.after),
        );
        break;
      }
      case "damage": {
        f.packets.push(e);
        const p = f.s.minions.find((p) => p.id === e.target);
        if (p) {
          if (!consumeTough(p)) p.damage += e.amount;
        } else if (e.target === f.s.villain.id && !consumeTough(f.s.villain))
          f.s.villain.hp -= e.amount;
        break;
      }
      case "thwart":
        f.packets.push(e);
        if (e.target === "main")
          f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
        else {
          const p = f.s.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
        break;
      case "draw":
        for (let i = 0; i < e.amount && f.s.player.deck.length; i++)
          f.s.player.hand.push(f.s.player.deck.shift()!);
        f.packets.push(e);
        break;
      case "ready": {
        if (e.target.startsWith("hero:"))
          seatView(f.s, e.target.slice(5)).player.exhausted = false;
        else {
          const p = allInPlay(f.s).find((p) => p.id === e.target);
          if (p) p.exhausted = false;
        }
        f.history.push(`ready:${e.target}`);
        break;
      }
      case "heal": {
        const p = f.s.minions.find((p) => p.id === e.target);
        if (p) p.damage = Math.max(0, p.damage - e.amount);
        else if (e.target === f.s.villain.id)
          f.s.villain.hp = Math.min(
            f.s.villain.maxHp,
            f.s.villain.hp + e.amount,
          );
        f.packets.push(e);
        break;
      }
      case "surge":
        f.history.push(`surge:${e.sourceCode}`);
        break;
      case "reveal":
        if (cards.get(e.piece.code)!.type_code === "minion")
          f.s.minions.push(e.piece);
        else f.s.sideSchemes.push(e.piece);
        break;
      case "fixture:done":
        f.history.push("done");
        break;
      default:
        throw Error(`Missing fixture effect ${e.type}`);
    }
  };
  const pump = () => {
    for (let i = 0; !f.s.prompt && f.s.queue.length && i < 200; i++)
      resolve(f.s.queue.shift()!);
    return f.s;
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    return pump();
  };
  const choose = (id: string) => {
    f.s = JSON.parse(JSON.stringify(f.s));
    const seat = f.s.players.find((p) => p.id === f.s.activePlayerId)!;
    seat.player = f.s.player;
    seat.flags = f.s.flags;
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    f.ports.queue(f.s, ...o!.effects);
    return pump();
  };
  const put = (code: string) => {
    const p = f.piece(code);
    f.s.player.inPlay.push(p);
    ghostSpiderCardEntered(f.s, p);
    return p;
  };
  const hand = (code: string) => {
    const p = f.piece(code);
    f.s.player.hand.push(p);
    return p;
  };
  const options = (r = resolved()) =>
    ghostSpiderEventResolutionOptions(f.s, r, [], f.ports);
  return Object.assign(f, { run, pump, choose, put, hand, options });
}

describe("Ghost-Spider source printings and physical setup", () => {
  it("exports exactly the fifteen original identity/signature/encounter faces", () => {
    expect(GHOST_SPIDER_SCRIPT_CODES).toHaveLength(15);
    expect(new Set(GHOST_SPIDER_SCRIPT_CODES).size).toBe(15);
    for (const code of GHOST_SPIDER_SCRIPT_CODES)
      expect(cards.get(code)?.pack_code).toBe("sm");
  });
  it("has fifteen signature cards and a forty-card source with no setup reserve", () => {
    const d = decks.find((d) => d.heroCode === "27001a")!;
    expect(d.deckSize).toBe(40);
    expect(d.setupCards).toEqual({});
    expect(Object.values(d.cards).reduce((a, b) => a + b, 0)).toBe(40);
    const totals = { hero: 0, protection: 0, basic: 0 };
    for (const [code, n] of Object.entries(d.cards))
      totals[cards.get(code)!.faction_code as keyof typeof totals] += n;
    expect(totals).toEqual({ hero: 15, protection: 15, basic: 10 });
  });
  it("retains the actual printed two Wild resources on Ticket", () => {
    expect(cards.get("27008")?.resource_wild).toBe(2);
    expect(cards.get("27008")?.permanent).not.toBe(true);
  });
  it("creates the five nemesis physical IDs once and reveals/shuffles those IDs", () => {
    const f = fixture();
    delete f.s.player.setAside;
    ghostSpiderInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    ghostSpiderInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toHaveLength(5);
    f.run(...ghostSpiderShadowOfPast(f.s)!);
    expect(f.s.player.setAside).toEqual([]);
    expect(
      [...f.s.minions, ...f.s.sideSchemes, ...f.s.encounter.deck]
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids.sort());
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual([
      "27028",
      "27029",
      "27029",
    ]);
    expect(ghostSpiderShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });
  it("preserves existing empty or partial nemesis zones during migration", () => {
    const f = fixture();
    ghostSpiderInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual([]);
    delete f.s.flags.ghostSpiderNemesisSetupComplete;
    const p = f.piece("27029");
    f.s.player.setAside = [p];
    ghostSpiderInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual([p]);
  });
  it("uses fixed five threat and zero non-star boost on Experimental Injection", () => {
    expect(cards.get("27026")).toMatchObject({
      base_threat: 5,
      base_threat_fixed: true,
    });
    expect(Number(cards.get("27028")?.boost || 0)).toBe(0);
    expect(cards.get("27028")?.boost_star).not.toBe(true);
  });
});

describe("completed basic powers and actual paid signature responses", () => {
  it.each(["attack", "thwart", "defense"] as const)(
    "offers both events only after a completed hero %s",
    (power) => {
      const f = fixture();
      f.hand("27002");
      f.hand("27004");
      expect(
        ghostSpiderBasicPowerOptions(f.s, basic({ power }), [], f.ports),
      ).toHaveLength(2);
    },
  );
  it.each([
    { performed: false },
    { wasHero: false },
    { power: "recover" as const },
    { playerId: "p2" },
  ])(
    "rejects a replaced, alter-ego, recovery or other-player basic power %j",
    (args) => {
      const f = fixture();
      f.hand("27002");
      expect(
        ghostSpiderBasicPowerOptions(f.s, basic(args), [], f.ports),
      ).toEqual([]);
    },
  );
  it("defense receipt belongs to the actual defender after attack damage", () => {
    const f = fixture();
    f.hand("27002");
    f.s.player.exhausted = true;
    const r = basic({ power: "defense" });
    f.run(...ghostSpiderAfterBasicPower(f.s, r));
    const id = f.s.player.hand[0].id;
    f.choose(id);
    expect(f.s.prompt?.title).toBe("Ghost Kick");
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(44);
    expect(f.s.prompt?.title).toContain("resolved event");
    f.choose("dizzying-reflexes");
    expect(f.s.player.exhausted).toBe(false);
  });
  it("a saved completed defense rebinds to the actual p2 Ghost-Spider defender", () => {
    const f = fixture();
    f.s.players[0].heroId = f.s.heroId = "rocket";
    f.s.players[1].heroId = "ghost_spider";
    activateSeat(f.s, "p2");
    const p = f.hand("27002");
    f.s.player.exhausted = true;
    activateSeat(f.s, "p1");
    f.run(
      ...ghostSpiderAfterBasicPower(
        f.s,
        basic({ playerId: "p2", power: "defense" }),
      ),
    );
    expect(f.s.activePlayerId).toBe("p2");
    f.choose(p.id);
    f.choose(f.s.villain.id);
    f.choose("dizzying-reflexes");
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(seatView(f.s, "p1").player.discard).toEqual([]);
  });
  it("each named max applies across copies but Kick and Flip can share the same use", () => {
    const f = fixture(),
      a = f.hand("27002"),
      b = f.hand("27002"),
      flip = f.hand("27004");
    const ctx: GhostSpiderReactionContext = { kind: "basic", basic: basic() };
    ghostSpiderCommitReaction(f.s, a, ctx);
    expect(
      ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports).map((o) => o.id),
    ).toEqual([flip.id]);
    expect(() => ghostSpiderCommitReaction(f.s, b, ctx)).toThrow(/max/);
    expect(
      ghostSpiderBasicPowerOptions(
        f.s,
        basic({ token: "basic-2" }),
        [],
        f.ports,
      ),
    ).toHaveLength(3);
  });
  it.each(["27002", "27004"])(
    "all-effect status replacement spends %s max but creates no resolved event response",
    (code) => {
      const f = fixture(),
        p = f.hand(code);
      f.put("27009");
      f.s.player.exhausted = true;
      if (code === "27002") f.s.player.stunned = true;
      else f.s.player.confused = true;
      f.run(...ghostSpiderAfterBasicPower(f.s, basic()));
      f.choose(p.id);
      expect(f.s.prompt).toBeNull();
      expect(f.s.player.exhausted).toBe(true);
      expect(f.s.player.discard.map((p) => p.id)).toContain(p.id);
      expect(f.s.flags[`ghostSpiderBasic:basic-1:${code}`]).toBe(true);
      expect(f.packets).toEqual([]);
    },
  );
  it("a canceled payment leaves the actual stored event and basic-use allowance untouched", () => {
    const f = fixture(),
      g = f.put("27007"),
      p = f.piece("27002");
    g.storedCards = [p];
    f.cancelPlay = true;
    const o = ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)[0];
    f.run(...o.effects);
    expect(ghostSpiderStoredPlayable(f.s, f.ports).map((p) => p.id)).toEqual([
      p.id,
    ]);
    expect(f.s.flags["ghostSpiderBasic:basic-1:27002"]).toBeUndefined();
  });
  it("revalidates an old serialized response after its max was consumed", () => {
    const f = fixture(),
      p = f.hand("27002"),
      o = ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)[0];
    ghostSpiderCommitReaction(f.s, p, { kind: "basic", basic: basic() });
    expect(() => f.run(...o.effects)).toThrow(/cannot be played/);
  });
  it("Phantom Flip emits actual hero thwart action after its selected legal scheme", () => {
    const f = fixture(),
      p = f.hand("27004");
    f.run(...ghostSpiderAfterBasicPower(f.s, basic({ power: "thwart" })));
    f.choose(p.id);
    f.choose("main");
    expect(f.s.scheme.threat).toBe(5);
    expect(f.packets[0]).toMatchObject({
      type: "thwart",
      amount: 5,
      source: "hero",
      action: true,
      basic: false,
      abilitySource: p.id,
    });
  });
  it("native restrictions, current form and cannot-pay suppress play options", () => {
    const f = fixture();
    f.hand("27002");
    f.s.flags.peril = true;
    expect(ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
    delete f.s.flags.peril;
    f.ports.canPay = () => false;
    expect(ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
    f.ports.canPay = () => true;
    f.s.player.form = "alter";
    expect(ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
  });
});

describe("Dizzying Reflexes and Web-Bracelet event-instance windows", () => {
  it("a non-Ghost-Spider controller can use Web-Bracelet without gaining the identity ability", () => {
    const f = fixture();
    activateSeat(f.s, "p2");
    const b = f.put("27009");
    f.s.player.exhausted = true;
    expect(f.options(resolved({ playerId: "p2" })).map((o) => o.id)).toEqual([
      b.id,
    ]);
  });
  it("readies once per phase and again in the next phase/round", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    f.run(...f.options()[0].effects);
    expect(f.s.player.exhausted).toBe(false);
    f.s.player.exhausted = true;
    expect(f.options()).toEqual([]);
    f.s.phase = "villain";
    expect(f.options()).toHaveLength(1);
    f.run(...f.options()[0].effects);
    f.s.player.exhausted = true;
    f.s.round++;
    expect(f.options()).toHaveLength(1);
  });
  it.each([
    { resolved: false },
    { kind: "action" as const },
    { playerId: "p2" },
    { code: "27009" },
  ])(
    "does not treat %j as a resolved owned event interrupt/response",
    (args) => {
      const f = fixture();
      f.s.player.exhausted = true;
      f.put("27009");
      expect(f.options(resolved(args))).toEqual([]);
    },
  );
  it("Dizzy is optional, blankable, respects cannot-ready and does not consume limit when passed", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    f.s.flags.identityBlank = true;
    expect(f.options()).toEqual([]);
    delete f.s.flags.identityBlank;
    f.s.flags.cannotReady = true;
    expect(f.options()).toEqual([]);
    delete f.s.flags.cannotReady;
    f.run(...ghostSpiderEventResolved(f.s, resolved()));
    f.choose("pass");
    expect(f.s.flags.ghostSpiderDizzyPhase).toBeUndefined();
    expect(f.s.player.exhausted).toBe(true);
  });
  it("a Skilled Strike interrupt may ready the already exhausted identity before the basic attack finishes", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    const code = [...cards.values()].find(
      (c) => c.name === "Skilled Strike",
    )!.code;
    const opts = f.options(resolved({ code, kind: "interrupt" }));
    f.run(...opts[0].effects, { type: "fixture:done" });
    expect(f.history).toEqual(["ready:hero:p1", "done"]);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("two physical bracelets share Max1 for one actual event, but a replay of that event is new", () => {
    const f = fixture(),
      a = f.put("27009"),
      b = f.put("27009");
    f.s.player.deck.push(f.piece("27004"));
    f.run(...f.options()[0].effects);
    expect(f.s.player.inPlay.find((p) => p.id === a.id)?.exhausted).toBe(true);
    expect(f.options()).toEqual([]);
    expect(f.options(resolved({ token: "play-2" })).map((o) => o.id)).toEqual([
      b.id,
    ]);
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.packets).toContainEqual({ type: "draw", amount: 1 });
  });
  it("drawn Phantom Flip remains playable in the original completed-basic-power window", () => {
    const f = fixture(),
      kick = f.hand("27002"),
      bracelet = f.put("27009"),
      flip = f.piece("27004");
    f.s.player.deck.push(flip);
    f.run(...ghostSpiderAfterBasicPower(f.s, basic()));
    f.choose(kick.id);
    f.choose(f.s.villain.id);
    f.choose(bracelet.id);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(flip.id);
    f.choose(flip.id);
    f.choose("main");
    expect(f.s.scheme.threat).toBe(5);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([kick.id, flip.id]);
  });
  it("bracelet blanking and already-exhausted copies suppress draw", () => {
    const f = fixture(),
      a = f.put("27009");
    f.s.flags[`blank:${a.id}`] = true;
    expect(f.options()).toEqual([]);
    delete f.s.flags[`blank:${a.id}`];
    a.exhausted = true;
    expect(f.options()).toEqual([]);
  });
});

describe("George Stacy, Parental Guidance and actual stored-event ownership", () => {
  it("stores one actual hand event facedown, exhausts George as cost, and offers it as if in hand", () => {
    const f = fixture(),
      g = f.put("27007"),
      p = f.hand("27002");
    ghostSpiderAbility(f.s, g.id, f.ports);
    f.pump();
    expect(f.s.player.inPlay.find((p) => p.id === g.id)?.exhausted).toBe(true);
    f.choose(p.id);
    expect(f.s.player.hand).toEqual([]);
    expect(ghostSpiderStoredPlayable(f.s, f.ports).map((p) => p.id)).toEqual([
      p.id,
    ]);
    expect(allInPlay(f.s).map((p) => p.id)).not.toContain(p.id);
    f.run(
      ...ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)[0].effects,
    );
    f.choose(f.s.villain.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(ghostSpiderStoredPlayable(f.s, f.ports)).toEqual([]);
  });
  it("storage does not expose non-events, other controller storage, or blanked George", () => {
    const f = fixture(),
      g = f.put("27007"),
      p = f.piece("27002");
    g.storedCards = [p, f.piece("27008")];
    expect(ghostSpiderStoredPlayable(f.s, f.ports)).toEqual([p]);
    f.s.flags[`blank:${g.id}`] = true;
    expect(ghostSpiderTakeStoredForPlay(f.s, p.id, f.ports)).toBeUndefined();
    delete f.s.flags[`blank:${g.id}`];
    activateSeat(f.s, "p2");
    expect(ghostSpiderStoredPlayable(f.s, f.ports)).toEqual([]);
  });
  it("both George's action and Parental Guidance enforce the same maximum of three", () => {
    const f = fixture(),
      g = f.put("27007"),
      p = f.hand("27003");
    g.storedCards = [f.piece("27002"), f.piece("27004"), f.piece("27005")];
    f.s.player.form = "alter";
    expect(ghostSpiderAbilityOptions(f.s, g.id, f.ports)).toEqual([]);
    expect(ghostSpiderPlayRestriction(f.s, p)).toMatch(/three/);
    expect(() => f.run(...ghostSpiderEvent(f.s, p)!)).toThrow(/more than3/);
  });
  it.each(["hand", "discard"] as const)(
    "Parental Guidance attaches the actual %s event even when George is blank",
    (zone) => {
      const f = fixture(),
        g = f.put("27007"),
        p = f.piece("27004"),
        pg = f.piece("27003");
      f.s.player.form = "alter";
      f.s.player[zone].push(p);
      f.s.flags[`blank:${g.id}`] = true;
      f.run(...ghostSpiderEvent(f.s, pg)!);
      f.choose(p.id);
      expect(f.s.player.inPlay[0].storedCards?.map((p) => p.id)).toEqual([
        p.id,
      ]);
      expect(f.s.player[zone]).toEqual([]);
    },
  );
  it.each(["deck", "discard"] as const)(
    "Parental Guidance finds the existing George ID from %s and shuffles",
    (zone) => {
      const f = fixture(),
        g = f.piece("27007"),
        p = f.piece("27003");
      f.s.player.form = "alter";
      f.s.player[zone].push(g);
      f.run(...ghostSpiderEvent(f.s, p)!);
      f.choose(g.id);
      expect(f.s.player.hand.map((p) => p.id)).toEqual([g.id]);
      expect(f.s.player[zone]).toEqual([]);
      expect(f.history).toEqual(["reveal-hidden", "shuffle-deck"]);
    },
  );
  it("a teammate can attach her owned event to George; his controller can play it and discard to its owner", () => {
    const f = fixture(),
      g = f.put("27007");
    activateSeat(f.s, "p2");
    f.s.player.form = "alter";
    const p = f.hand("27004"),
      pg = f.piece("27003");
    f.run(...ghostSpiderEvent(f.s, pg)!);
    f.choose(p.id);
    activateSeat(f.s, "p1");
    expect(ghostSpiderStoredPlayable(f.s, f.ports).map((p) => p.id)).toEqual([
      p.id,
    ]);
    f.run(
      ...ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)[0].effects,
    );
    f.choose("main");
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(f.s.player.discard).toEqual([]);
    expect(f.s.player.inPlay.find((p) => p.id === g.id)?.storedCards).toEqual(
      [],
    );
  });
  it("Gwen chooses one once-per-round option and can ready another player's George", () => {
    const f = fixture();
    activateSeat(f.s, "p2");
    const g = f.put("27007");
    g.exhausted = true;
    activateSeat(f.s, "p1");
    f.s.player.form = "alter";
    const t = f.piece("27008");
    f.s.player.discard.push(t);
    expect(ghostSpiderAbilityOptions(f.s, "hero", f.ports)).toHaveLength(2);
    ghostSpiderAbility(f.s, "hero", f.ports, "gwen-george");
    f.pump();
    expect(seatView(f.s, "p2").player.inPlay[0].exhausted).toBe(false);
    expect(ghostSpiderAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.round++;
    ghostSpiderAbility(f.s, "hero", f.ports, "gwen-ticket");
    f.pump();
    expect(f.s.player.deck.map((p) => p.id)).toEqual([t.id]);
    expect(f.s.player.discard).toEqual([]);
  });
});

describe("Ticket to the Multiverse printed reset", () => {
  it.each(["hero", "alter"] as const)(
    "uses current %s hand size and readies physical signature cards plus the identity",
    (form) => {
      const f = fixture(),
        ticket = f.put("27008"),
        g = f.put("27007"),
        b = f.put("27009"),
        other = f.put("01073");
      f.s.player.form = form;
      f.s.player.exhausted = true;
      g.exhausted = b.exhausted = other.exhausted = true;
      f.s.flags[`blank:${g.id}`] = true;
      f.s.flags.handSize = 4;
      const oldHand = f.hand("27002"),
        oldDiscard = f.piece("27004"),
        existing = f.piece("27005");
      f.s.player.discard.push(oldDiscard);
      f.s.player.deck.push(existing, f.piece("27006"), f.piece("27002"));
      f.run(...ghostSpiderAbilityOptions(f.s, ticket.id, f.ports)[0].effects);
      expect(f.removed).toEqual([ticket.id]);
      expect(f.s.removed.map((p) => p.id)).toEqual([ticket.id]);
      expect(f.s.player.hand).toHaveLength(4);
      expect(
        [...f.s.player.hand, ...f.s.player.deck].map((p) => p.id),
      ).toContain(existing.id);
      expect(
        [...f.s.player.hand, ...f.s.player.deck].map((p) => p.id),
      ).toContain(oldHand.id);
      expect(
        [...f.s.player.hand, ...f.s.player.deck].map((p) => p.id),
      ).toContain(oldDiscard.id);
      expect(f.s.player.discard).toEqual([]);
      expect(f.s.player.exhausted).toBe(false);
      expect(f.s.player.inPlay.find((p) => p.id === g.id)?.exhausted).toBe(
        false,
      );
      expect(f.s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(
        false,
      );
      expect(f.s.player.inPlay.find((p) => p.id === other.id)?.exhausted).toBe(
        true,
      );
      expect(f.history).toContain("merge-shuffle");
      expect(f.history.some((h) => h.startsWith("surge"))).toBe(false);
    },
  );
  it("ready prohibitions are respected independently for identity and signature cards", () => {
    const f = fixture(),
      t = f.put("27008"),
      b = f.put("27009");
    f.s.player.exhausted = b.exhausted = true;
    f.s.flags.cannotReady = true;
    f.s.flags[`cannotReady:${b.id}`] = true;
    f.run(...ghostSpiderAbilityOptions(f.s, t.id, f.ports)[0].effects);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
  });
});

describe("actual reveal and enemy-activation interruptions", () => {
  it("Pirouette counts the actual encounter ID before damage and cancels only its When Revealed", () => {
    const f = fixture(),
      p = f.hand("27005"),
      r = f.piece("27029");
    f.s.encounter.dealt.push(r);
    f.s.flags.boostOverride = 3;
    const receipt = {
      token: "reveal-1",
      pieceId: r.id,
      code: r.code,
      playerId: "p2",
      fromEncounterDeck: true,
      windowId: "native-window",
    };
    f.run(
      ...ghostSpiderRevealOptions(
        f.s,
        receipt,
        [{ type: "fixture:done" }],
        f.ports,
      )[0].effects,
    );
    expect(f.s.villain.hp).toBe(46);
    expect(f.packets[0]).toMatchObject({
      type: "damage",
      amount: 4,
      attack: false,
      abilitySource: p.id,
    });
    expect(f.packets[1]).toMatchObject({
      type: "cancelWhenRevealed",
      pieceId: r.id,
      playerId: "p2",
      windowId: "native-window",
    });
    expect(f.history).toEqual([
      `play:${p.id}`,
      `count:${r.id}`,
      `cancel:${r.id}`,
      "done",
    ]);
    expect(f.s.encounter.dealt[0].id).toBe(r.id);
  });
  it("Pirouette excludes non-deck reveals and counts no star icon as a numeric icon", () => {
    const f = fixture();
    f.hand("27005");
    const r = f.piece("27028");
    f.s.attachments.push(r);
    const receipt = {
      token: "r",
      pieceId: r.id,
      code: r.code,
      playerId: "p1",
      fromEncounterDeck: false,
    };
    expect(ghostSpiderRevealOptions(f.s, receipt, [], f.ports)).toEqual([]);
    receipt.fromEncounterDeck = true;
    f.run(...ghostSpiderRevealOptions(f.s, receipt, [], f.ports)[0].effects);
    expect(f.packets[0].amount).toBe(1);
  });
  it.each(["attack", "scheme"] as const)(
    "Web Binding cancels another player's minion %s and deals four nonattack damage",
    (kind) => {
      const f = fixture(),
        p = f.hand("27006"),
        m = f.piece("27027");
      m.engagedWith = "p2";
      f.s.minions.push(m);
      f.s.flags.activationToken = "activate-1";
      f.s.player.stunned = true;
      const receipt = {
        token: "activate-1",
        enemyId: m.id,
        playerId: "p2",
        kind,
      };
      expect(ghostSpiderEventRequirements(p)).toEqual(["mental"]);
      const opts = ghostSpiderActivationOptions(f.s, receipt, [], f.ports);
      expect(f.ports.canPay).toHaveBeenCalledWith(
        f.s,
        2,
        ["mental"],
        p.id,
        p.code,
      );
      f.run(...opts[0].effects);
      expect(f.s.minions[0].damage).toBe(4);
      expect(f.s.player.stunned).toBe(true);
      expect(f.packets[1]).toMatchObject({
        type: "damage",
        attack: false,
        amount: 4,
      });
    },
  );
  it("villain activation cancellation has no invented minion damage and stale receipt cannot play", () => {
    const f = fixture();
    f.hand("27006");
    f.s.flags.activationToken = "a";
    const r = {
      token: "a",
      enemyId: f.s.villain.id,
      playerId: "p1",
      kind: "attack" as const,
    };
    const opts = ghostSpiderActivationOptions(f.s, r, [], f.ports);
    f.run(...opts[0].effects);
    expect(f.packets).toHaveLength(1);
    expect(f.packets[0].success).toBe(true);
    expect(() => f.run(...opts[0].effects)).toThrow(/cannot be played/);
  });
});

describe("current obligation, nemesis attachment, healing and forced Lizard attack", () => {
  it.each(["deck", "hand", "discard", "inPlay"] as const)(
    "Worried Father attaches the actual George from %s and recovers that ID after payment",
    (zone) => {
      const f = fixture(),
        g = f.piece("27007"),
        ob = f.piece("27025");
      f.s.player[zone].push(g);
      f.s.resolving.push(ob);
      f.run(...ghostSpiderEncounterReveal(f.s, ob)!);
      expect(
        f.s.player.inPlay
          .find((p) => p.id === ob.id)
          ?.storedCards?.map((p) => p.id),
      ).toEqual([g.id]);
      expect(f.s.player.setAside).toEqual([]);
      f.s.player.form = "alter";
      f.run(...ghostSpiderAbilityOptions(f.s, ob.id, f.ports)[0].effects);
      expect(f.s.player.exhausted).toBe(true);
      expect(f.s.removed.map((p) => p.id)).toEqual([ob.id]);
      expect(f.s.player.hand.map((p) => p.id)).toEqual([g.id]);
    },
  );
  it("capturing in-play George discards stored events to their actual owners before attaching him", () => {
    const f = fixture(),
      g = f.put("27007"),
      own = f.piece("27002");
    activateSeat(f.s, "p2");
    const foreign = f.piece("27004");
    activateSeat(f.s, "p1");
    g.storedCards = [own, foreign];
    const ob = f.piece("27025");
    f.s.resolving.push(ob);
    f.run(...ghostSpiderEncounterReveal(f.s, ob)!);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([own.id]);
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([
      foreign.id,
    ]);
    expect(f.s.player.inPlay[0].storedCards?.[0]).toMatchObject({
      id: g.id,
      storedCards: [],
    });
  });
  it("obligation gives to the actual Gwen seat and never invents a missing George", () => {
    const f = fixture(),
      ob = f.piece("27025");
    f.s.resolving.push(ob);
    activateSeat(f.s, "p2");
    f.run(...ghostSpiderEncounterReveal(f.s, ob)!);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([ob.id]);
    expect(f.s.player.inPlay[0].storedCards).toBeUndefined();
    f.s.player.form = "alter";
    expect(ghostSpiderAbilityOptions(f.s, ob.id, f.ports)).toEqual([]);
    expect(() => f.run(G("remove-worried", { id: ob.id }))).toThrow(/requires/);
  });
  it("Injection chooses most remaining HP, including existing modifiers, and the first player breaks ties", () => {
    const f = fixture(),
      a = f.piece("27027"),
      b = f.piece("27027"),
      old = f.piece("27028"),
      injection = f.piece("27028");
    a.damage = 3;
    b.damage = 0;
    old.attachedTo = a.id;
    f.s.minions.push(a, b);
    f.s.attachments.push(old, injection);
    activateSeat(f.s, "p2");
    f.run(...ghostSpiderEncounterReveal(f.s, injection)!);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    f.choose(a.id);
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.attachments.find((p) => p.id === injection.id)?.attachedTo).toBe(
      a.id,
    );
    expect(ghostSpiderEnemyModifiers(f.s, f.s.minions[0], f.ports)).toEqual({
      health: 8,
      traits: ["Creature"],
    });
  });
  it("Injection labels an actual native drone through the enemy provider without inventing a printed face", () => {
    const f = fixture(),
      drone = f.piece("drone"),
      injection = f.piece("27028");
    f.s.minions.push(drone);
    f.s.attachments.push(injection);
    f.ports.enemyRemainingHP = () => 1;
    f.ports.enemyTargets = () => [
      { id: drone.id, label: "Ultron Drone", code: drone.code },
    ];
    f.run(...ghostSpiderEncounterReveal(f.s, injection)!);
    expect(f.s.prompt?.options[0]).toMatchObject({
      id: drone.id,
      label: "Ultron Drone",
      image: "drone",
    });
    f.choose(drone.id);
    expect(f.s.attachments[0].attachedTo).toBe(drone.id);
    expect(ghostSpiderEnemyModifiers(f.s, drone, f.ports)).toEqual({
      health: 4,
      traits: ["Creature"],
    });
  });
  it("Injection text blanking removes its HP and Creature modifiers; no minion grants Surge", () => {
    const f = fixture(),
      m = f.piece("27027"),
      a = f.piece("27028");
    a.attachedTo = m.id;
    f.s.minions.push(m);
    f.s.attachments.push(a);
    f.s.flags[`blank:${a.id}`] = true;
    expect(ghostSpiderEnemyModifiers(f.s, m, f.ports)).toEqual({
      health: 0,
      traits: [],
    });
    f.s.minions = [];
    f.run(...ghostSpiderEncounterReveal(f.s, a)!);
    expect(f.history).toContain("surge:27028");
  });
  it("Research and Lizard are distinct forced phase interrupts, healing Lizard twice", () => {
    const f = fixture(),
      l = f.piece("27027"),
      other = f.piece("27027"),
      ss = f.piece("27026");
    other.code = "01102";
    l.damage = 3;
    other.damage = 3;
    f.s.minions.push(l, other);
    f.s.sideSchemes.push(ss);
    f.s.villain.hp = 45;
    const effects = ghostSpiderVillainPhaseBegins(f.s, f.ports);
    expect(effects).toHaveLength(2);
    expect(effects.every((e) => e.forced && e.mandatory)).toBe(true);
    f.run(...effects);
    expect(l.damage).toBe(1);
    expect(other.damage).toBe(2);
    expect(f.s.villain.hp).toBe(46);
  });
  it("blanked phase interrupts are absent and defeated Lizard is not resurrected", () => {
    const f = fixture(),
      l = f.piece("27027"),
      ss = f.piece("27026");
    f.s.minions.push(l);
    f.s.sideSchemes.push(ss);
    f.s.flags[`blank:${ss.id}`] = true;
    f.s.flags[`blank:${l.id}`] = true;
    expect(ghostSpiderVillainPhaseBegins(f.s, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${l.id}`];
    const effects = ghostSpiderVillainPhaseBegins(f.s, f.ports);
    f.s.minions = [];
    f.run(...effects);
    expect(f.packets).toEqual([]);
  });
  it.each([true, false])(
    "In Cold Blood locks only its revealer through native attack completion (performed=%s)",
    (performed) => {
      const f = fixture(),
        l = f.piece("27027"),
        cold = f.piece("27029");
      f.s.minions.push(l);
      f.attackPerformed = performed;
      f.s.player.form = "alter";
      f.run(...ghostSpiderEncounterReveal(f.s, cold)!);
      expect(f.packets[0]).toMatchObject({
        type: "lizardAttack",
        playerId: "p1",
        locked: true,
        teammateLocked: false,
        form: "alter",
      });
      expect(ghostSpiderCannotPlayEvents(f.s)).toBe(false);
      expect(f.history.includes("surge:27029")).toBe(!performed);
    },
  );
  it("In Cold Blood absent Lizard surges immediately without locking events", () => {
    const f = fixture(),
      c = f.piece("27029");
    f.run(...ghostSpiderEncounterReveal(f.s, c)!);
    expect(f.history).toEqual(["surge:27029"]);
    expect(ghostSpiderCannotPlayEvents(f.s)).toBe(false);
  });
  it("the attack-resolved completion unlocks Ghost Kick for the completed basic-defense window", () => {
    const f = fixture(),
      l = f.piece("27027"),
      c = f.piece("27029"),
      p = f.hand("27002");
    f.s.minions.push(l);
    f.ports.attackLizard = (s, _id, _playerId, completion) => {
      expect(ghostSpiderCannotPlayEvents(s)).toBe(true);
      f.ports.queue(
        s,
        { ...completion, performed: true },
        ...ghostSpiderAfterBasicPower(s, basic({ power: "defense" })),
      );
    };
    f.run(...ghostSpiderEncounterReveal(f.s, c)!);
    expect(ghostSpiderCannotPlayEvents(f.s)).toBe(false);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(p.id);
  });
  it("cannot-play-event restriction applies to ordinary events and all reaction windows", () => {
    const f = fixture(),
      p = f.hand("27002");
    f.s.flags.ghostSpiderColdBloodLock = 1;
    expect(ghostSpiderPlayRestriction(f.s, p)).toMatch(/prevents/);
    expect(ghostSpiderBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
  });
  it("all five encounter printings have no fabricated boost ability and unknown namespaces fall through", () => {
    const f = fixture();
    for (const code of ["27025", "27026", "27027", "27028", "27029"])
      expect(ghostSpiderBoost(f.s, f.piece(code))).toEqual([]);
    expect(ghostSpiderBoost(f.s, f.piece("27002"))).toBeNull();
    expect(
      resolveGhostSpiderEffect(f.s, { type: "other:unknown" }, f.ports),
    ).toBe(false);
  });
});
