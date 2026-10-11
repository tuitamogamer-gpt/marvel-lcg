import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { isTextBlank } from "../src/game/card-text.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  SPDR_SCRIPT_CODES,
  spdrInitialize,
  spdrInitializeNemesis,
  spdrIdentity,
  spdrSuit,
  spdrPilot,
  spdrSyncIdentity,
  spdrChangedForm,
  spdrResourceSources,
  spdrResourceSpent,
  spdrResourcesGenerated,
  spdrPlayRestriction,
  spdrEvent,
  spdrAllyEntered,
  spdrAbilityOptions,
  spdrAbility,
  spdrBasicOptions,
  spdrDefenseOptions,
  spdrEncounterReveal,
  spdrShadowOfPast,
  resolveSpdrEffect,
  type SpdrPorts,
} from "../src/game/spdr.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
function fixture() {
  const s: GameState = {
    version: 1,
    seed: 31,
    nextId: 1,
    heroId: "spdr",
    aspect: "protection",
    villainId: "rhino",
    difficulty: "standard",
    module: "bomb_scare",
    phase: "player",
    round: 1,
    players: [],
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player: {
      form: "alter",
      hp: 14,
      exhausted: false,
      flipped: false,
      tough: false,
      stunned: false,
      confused: false,
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
      setAside: [],
    },
    villain: {
      id: "villain",
      code: "01094",
      exhausted: false,
      damage: 0,
      counters: 0,
      tough: false,
      stunned: false,
      confused: false,
      hp: 14,
      maxHp: 14,
      stage: 1,
    },
    scheme: { code: "01097", threat: 10, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    queue: [],
    prompt: null,
    flags: {},
    log: [],
    attack: null,
  };
  s.players.push({
    id: "p1",
    heroId: "spdr",
    aspect: "protection",
    player: s.player,
    flags: s.flags,
    ended: false,
    eliminated: false,
    mulliganDone: true,
  });
  const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
    id: `test${s.nextId++}`,
    code,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: false,
    stunned: false,
    confused: false,
    ownerId: s.activePlayerId,
    ...patch,
  });
  const removeEncounter = (state: GameState, p: Piece) => {
    for (const zone of [
      state.resolving,
      state.player.inPlay,
      state.encounter.deck,
      state.encounter.discard,
      state.encounter.dealt,
    ]) {
      const i = zone.findIndex((q) => q.id === p.id);
      if (i >= 0) zone.splice(i, 1);
    }
  };
  const native: Effect[] = [];
  const ports: SpdrPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    makePiece: (_state, code) => piece(code),
    enemyTargets: (state) =>
      [state.villain, ...state.minions].map((p) => ({
        id: p.id,
        code: p.code,
        label: cards.get(p.code)?.name || p.code,
      })),
    schemeTargets: (state) => [
      { id: "main", label: "Main scheme" },
      ...state.sideSchemes.map((p) => ({
        id: p.id,
        code: p.code,
        label: cards.get(p.code)?.name || p.code,
      })),
    ],
    canChangeForm: (state) => !state.flags.formLocked,
    canReadyIdentity: (state) => !state.flags.readyLocked,
    discardControlledCost: vi.fn(
      (state: GameState, id: string, after: Effect[]) => {
        const i = state.player.inPlay.findIndex((p) => p.id === id);
        if (i < 0) throw Error("The actual discard cost is unavailable.");
        const p = state.player.inPlay[i];
        if (cards.get(p.code)?.permanent)
          throw Error("A permanent cannot be discarded.");
        state.player.discard.push(state.player.inPlay.splice(i, 1)[0]);
        state.queue.unshift(...after);
      },
    ),
    discardHand: vi.fn((state: GameState, id: string) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("The actual hand cost is missing.");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    }),
    mill: vi.fn((state: GameState, count: number, after: Effect[]) => {
      const discarded = state.player.deck.splice(0, count);
      state.player.discard.push(...discarded);
      state.queue.unshift(
        ...after.map((e) => ({
          ...e,
          discardedIds: discarded.map((p) => p.id),
        })),
      );
    }),
    shufflePlayerDeck: vi.fn((state: GameState, after: Effect[]) => {
      state.player.deck.reverse();
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
      state.queue.unshift(...after);
    }),
    shuffleEncounter: vi.fn((state: GameState) => {
      state.encounter.deck.reverse();
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    canPay: (state) => !state.flags.cannotPay,
    pay: vi.fn((state, _title, _amount, _req, after) => {
      state.queue.unshift(...after);
    }),
    giveObligation: (state, p) => {
      removeEncounter(state, p);
      p.dealtTo = state.activePlayerId;
      state.player.inPlay.push(p);
    },
    removeEncounter: (state, p) => {
      removeEncounter(state, p);
      state.removed.push(p);
    },
    discardEncounter: (state, p) => {
      removeEncounter(state, p);
      state.encounter.discard.push(p);
    },
    revealEncounter: vi.fn((state: GameState, p: Piece) => {
      removeEncounter(state, p);
      if (cards.get(p.code)?.type_code === "minion") {
        p.engagedWith = state.activePlayerId;
        state.minions.push(p);
      } else if (cards.get(p.code)?.type_code === "side_scheme") {
        p.counters = cards.get(p.code)?.base_threat || 0;
        state.sideSchemes.push(p);
      } else state.resolving.push(p);
      state.queue.unshift(...(spdrEncounterReveal(state, p) || []));
    }),
    addDefense: vi.fn(),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveSpdrEffect(s, e, ports)) return;
    native.push(e);
    switch (e.type) {
      case "draw":
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
        break;
      case "ready":
        if (e.target === "hero") {
          s.player.exhausted = false;
          spdrSyncIdentity(s);
        } else {
          const p = s.player.inPlay.find((p) => p.id === e.target);
          if (p) p.exhausted = false;
        }
        break;
      case "exhaust":
        if (e.id === "hero") {
          s.player.exhausted = true;
          spdrSyncIdentity(s);
        }
        break;
      case "flip": {
        const from = s.player.form;
        s.player.form = from === "hero" ? "alter" : "hero";
        spdrChangedForm(s, from, s.player.form);
        break;
      }
      case "status":
        if (e.target === "hero")
          s.player[e.status as "tough" | "stunned" | "confused"] = true;
        else {
          const p = [s.villain, ...s.minions].find((p) => p.id === e.target);
          if (p) p[e.status as "tough" | "stunned" | "confused"] = true;
        }
        break;
      case "damage":
        if (e.target === "hero") s.player.hp -= e.amount;
        else {
          const p = [s.villain, ...s.minions].find((p) => p.id === e.target);
          if (p) p.damage += e.amount;
        }
        if (e.afterResolved) s.queue.unshift(...e.afterResolved);
        break;
      case "thwart":
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
        break;
      case "optional":
        ports.choose(s, e.title, e.text, [
          { id: "use", label: "Use response", effects: e.effects },
          { id: "skip", label: "Skip response", effects: [] },
        ]);
        break;
      case "surge":
        break;
      default:
        throw Error(`Unhandled pure-test native continuation: ${e.type}`);
    }
  };
  const drain = () => {
    let budget = 100;
    while (s.queue.length && !s.prompt) {
      if (!budget--) throw Error("Pure-test queue did not settle.");
      run(s.queue.shift()!);
    }
  };
  const enqueue = (effects: Effect[]) => {
    s.queue.push(...effects);
    drain();
  };
  const choose = (id: string) => {
    const o = s.prompt?.options?.find((o) => o.id === id);
    if (!o) throw Error(`Missing pure-test choice ${id}`);
    s.prompt = null;
    s.queue.unshift(...o.effects);
    drain();
  };
  const put = (code: string, patch: Partial<Piece> = {}) => {
    const p = piece(code, patch);
    s.player.inPlay.push(p);
    return p;
  };
  const form = (to: "hero" | "alter") => {
    const from = s.player.form;
    s.player.form = to;
    spdrChangedForm(s, from, to);
  };
  const ability = (id: string, action?: string) => {
    const effects = spdrAbility(s, id, action, ports);
    if (!effects) throw Error("No printed ability is available.");
    enqueue(effects);
  };
  spdrInitialize(s, ports);
  return {
    s,
    piece,
    put,
    ports,
    run,
    drain,
    enqueue,
    choose,
    form,
    ability,
    native,
  };
}

describe("SP//dr physical identities and Sync Ratio", () => {
  it("moves another player's actual physically attached card with the identity while preserving that player's ownership and exclusive zone", () => {
    const f = fixture(),
      pilotId = spdrPilot(f.s)!.id,
      suitId = spdrSuit(f.s)!.id;
    const attachment = f.piece("31029", { ownerId: "p2", attachedTo: pilotId });
    f.s.players.push({
      ...f.s.players[0],
      id: "p2",
      heroId: "nova",
      player: {
        ...f.s.player,
        spdrIdentity: undefined,
        spdrSuitId: undefined,
        spdrPilotId: undefined,
        hand: [],
        deck: [],
        discard: [],
        inPlay: [attachment],
        setAside: [],
      },
      flags: {},
    });
    f.s.playerCount = 2;
    f.form("hero");
    expect(attachment).toMatchObject({ ownerId: "p2", attachedTo: suitId });
    expect(f.s.player.inPlay.some((p) => p.id === attachment.id)).toBe(false);
    expect(seatView(f.s, "p2").player.inPlay).toEqual([attachment]);
    f.form("alter");
    expect(attachment).toMatchObject({ ownerId: "p2", attachedTo: pilotId });
    const saved = JSON.parse(JSON.stringify(f.s)) as GameState;
    expect(
      saved.players
        .flatMap((seat) => seatView(saved, seat).player.inPlay)
        .filter((p) => p.id === attachment.id),
    ).toHaveLength(1);
  });

  it("protects the two expressly unblankable permanent faces from Tech Theft while retaining blanking of the ordinary Tech Interfaces", () => {
    const f = fixture(),
      link = f.put("31011");
    f.s.sideSchemes.push(f.piece("12026"));
    expect(isTextBlank(f.s, spdrSuit(f.s)!)).toBe(false);
    expect(isTextBlank(f.s, link)).toBe(true);
    f.form("hero");
    expect(isTextBlank(f.s, spdrPilot(f.s)!)).toBe(false);
    expect(isTextBlank(f.s, link)).toBe(true);
  });
  it("allocates the two actual reversible pieces once, outside every player-deck zone", () => {
    const f = fixture(),
      suit = spdrSuit(f.s)!,
      pilot = spdrPilot(f.s)!;
    expect(suit).toMatchObject({ code: "31001b", ownerId: "p1" });
    expect(pilot).toMatchObject({ code: "31002a", ownerId: "p1" });
    expect(suit.id).not.toBe(pilot.id);
    expect(spdrIdentity(f.s)).toBe(pilot);
    expect(f.s.player.inPlay).toEqual([suit]);
    spdrInitialize(f.s, f.ports);
    expect(f.s.player.inPlay).toEqual([suit]);
    expect(f.s.player.deck).toEqual([]);
  });

  it("preserves independent exhaustion: Maintenance exhausts Suit, which stays exhausted after Suit Up", () => {
    const f = fixture();
    f.s.player.deck.push(f.piece("31004"), f.piece("31005"));
    f.ability("identity", "maintenance");
    expect(f.s.player.hand).toHaveLength(2);
    expect(spdrSuit(f.s)!.exhausted).toBe(true);
    expect(spdrPilot(f.s)!.exhausted).toBe(false);
    expect(f.s.player.exhausted).toBe(false);
    f.form("hero");
    expect(f.s.player.exhausted).toBe(true);
    expect(spdrPilot(f.s)!).toMatchObject({
      code: "31002b",
      exhausted: false,
      attachedTo: spdrSuit(f.s)!.id,
    });
    f.form("alter");
    expect(f.s.player.exhausted).toBe(false);
    expect(spdrSuit(f.s)!.exhausted).toBe(true);
    expect(spdrAbilityOptions(f.s, "identity", f.ports)).toEqual([]);
  });

  it("moves all counters and actual attachments to the currently active identity in both directions per RRG1.8", () => {
    const f = fixture(),
      pilot = spdrPilot(f.s)!,
      suit = spdrSuit(f.s)!;
    pilot.counters = 3;
    suit.counters = 2;
    const clarity = f.put("31029", { attachedTo: pilot.id }),
      encounter = f.piece("01159", { attachedTo: pilot.id });
    f.s.attachments.push(encounter);
    f.form("hero");
    expect(spdrIdentity(f.s)!.id).toBe(suit.id);
    expect(suit.counters).toBe(5);
    expect(pilot.counters).toBe(0);
    expect(clarity.attachedTo).toBe(suit.id);
    expect(encounter.attachedTo).toBe(suit.id);
    suit.counters = 7;
    f.form("alter");
    expect(pilot.counters).toBe(7);
    expect(suit.counters).toBe(0);
    expect(clarity.attachedTo).toBe(pilot.id);
    expect(encounter.attachedTo).toBe(pilot.id);
    expect(pilot.attachedTo).toBeUndefined();
    expect(f.s.player.inPlay.map((p) => p.id)).not.toContain(pilot.id);
  });

  it("hydrates an exclusive identity zone without fabricating an additional Suit or Pilot", () => {
    const f = fixture();
    f.form("hero");
    const saved = JSON.parse(JSON.stringify(f.s)) as GameState;
    const ids = [
      spdrIdentity(saved)!.id,
      ...saved.player.inPlay.map((p) => p.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const original = [spdrSuit(saved)!.id, spdrPilot(saved)!.id];
    saved.player.form = "alter";
    spdrChangedForm(saved, "hero", "alter");
    saved.player.form = "hero";
    spdrChangedForm(saved, "alter", "hero");
    expect([spdrSuit(saved)!.id, spdrPilot(saved)!.id]).toEqual(original);
    expect(
      [spdrIdentity(saved)!.id, ...saved.player.inPlay.map((p) => p.id)].sort(),
    ).toEqual(ids.sort());
  });

  it("generates each Interface's printed resource, including the real attached Wild Pilot", () => {
    const f = fixture();
    f.form("hero");
    const host = f.put("31010"),
      link = f.put("31011"),
      alloy = f.put("31012"),
      compressor = f.put("31013");
    const sources = spdrResourceSources(f.s, f.ports);
    expect(sources.map((p) => [p.code, p.resources])).toEqual([
      ["31002b", ["wild"]],
      ["31010", ["wild"]],
      ["31011", ["mental"]],
      ["31012", ["physical"]],
      ["31013", ["energy"]],
    ]);
    for (const p of [spdrPilot(f.s)!, host, link, alloy, compressor])
      expect(
        sources.find((source) => source.id === `spdr-sync:${p.id}`)?.code,
      ).toBe(p.code);
    const id = `spdr-sync:${compressor.id}`;
    expect(spdrResourceSpent(f.s, id)).toBe(true);
    expect(compressor.exhausted).toBe(true);
    expect(spdrResourceSources(f.s, f.ports).some((p) => p.id === id)).toBe(
      false,
    );
    expect(() => spdrResourceSpent(f.s, id)).toThrow(/unavailable/);
    expect(spdrResourceSpent(f.s, "ordinary-source")).toBe(false);
    expect(f.s.player.discard).toEqual([]);
  });

  it("keeps Sync Ratio available from a text-blank Interface's printed icons, but blocks a blank Suit or alter ego", () => {
    const f = fixture();
    f.form("hero");
    const compressor = f.put("31013");
    f.s.flags[`blank:${compressor.id}`] = true;
    expect(
      spdrResourceSources(f.s, f.ports).some((p) => p.code === "31013"),
    ).toBe(true);
    f.s.flags[`blank:${spdrIdentity(f.s)!.id}`] = true;
    expect(spdrResourceSources(f.s, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${spdrIdentity(f.s)!.id}`];
    f.form("alter");
    expect(spdrResourceSources(f.s, f.ports)).toEqual([]);
  });

  it("does not allocate SP//dr identity pieces or Sync resources for an unrelated identity", () => {
    const f = fixture();
    f.s.heroId = "nova";
    const ids = f.s.player.inPlay.map((p) => p.id);
    spdrInitialize(f.s, f.ports);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual(ids);
    f.s.player.form = "hero";
    expect(spdrResourceSources(f.s, f.ports)).toEqual([]);
  });
});

describe("SP//dr printed signatures and physical paid receipts", () => {
  it("registers exactly the nineteen hero, signature, obligation and nemesis faces", () => {
    expect(SPDR_SCRIPT_CODES).toEqual([
      "31001a",
      "31001b",
      "31002a",
      "31002b",
      "31003",
      "31004",
      "31005",
      "31006",
      "31007",
      "31008",
      "31009",
      "31010",
      "31011",
      "31012",
      "31013",
      "31025",
      "31026",
      "31027",
      "31028",
    ]);
    expect(
      resolveSpdrEffect(fixture().s, { type: "unrelated" }, fixture().ports),
    ).toBe(false);
  });

  it("offers All Systems Go's two alternatives and readies every actual Interface, including the Pilot", () => {
    const f = fixture();
    f.form("hero");
    const pilot = spdrPilot(f.s)!,
      link = f.put("31011", { exhausted: true }),
      other = f.put("31009", { exhausted: true });
    pilot.exhausted = true;
    f.s.player.deck.push(f.piece("31012"));
    f.enqueue(spdrEvent(f.s, f.piece("31004"))!);
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual(["ready", "search"]);
    f.choose("ready");
    expect(pilot.exhausted).toBe(false);
    expect(link.exhausted).toBe(false);
    expect(other.exhausted).toBe(true);
  });

  it.each(["deck", "discard"] as const)(
    "searches the actual chosen Interface in the %s and shuffles once",
    (zone) => {
      const f = fixture();
      f.form("hero");
      const chosen = f.piece("31011"),
        differentCopy = f.piece("31011");
      f.s.player[zone].push(chosen);
      f.s.player[zone === "deck" ? "discard" : "deck"].push(differentCopy);
      f.enqueue(spdrEvent(f.s, f.piece("31004"))!);
      f.choose("search");
      expect(f.s.prompt?.options?.map((o) => o.id).sort()).toEqual(
        [chosen.id, differentCopy.id].sort(),
      );
      f.choose(chosen.id);
      expect(f.s.player.hand).toEqual([chosen]);
      expect([...f.s.player.deck, ...f.s.player.discard]).toEqual([
        differentCopy,
      ]);
      expect(f.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
      expect(f.s.hiddenInfo).toBe(1);
    },
  );

  it("does not allow All Systems Go if neither printed alternative can change game state", () => {
    const f = fixture();
    f.form("hero");
    expect(spdrPlayRestriction(f.s, f.piece("31004"), f.ports)).toMatch(
      /no Interface/,
    );
    spdrPilot(f.s)!.exhausted = true;
    expect(spdrPlayRestriction(f.s, f.piece("31004"), f.ports)).toBeUndefined();
    f.form("alter");
    expect(spdrPlayRestriction(f.s, f.piece("31004"), f.ports)).toMatch(
      /Hero form/,
    );
  });

  it.each([0, 1])(
    "uses the real %i Sync resource receipt to determine Rapid Deployment's three-threat occurrences",
    (syncPaid) => {
      const f = fixture();
      f.form("hero");
      const side = f.piece("31026", { counters: 5 });
      f.s.sideSchemes.push(side);
      f.enqueue(spdrEvent(f.s, f.piece("31005"), { syncPaid })!);
      f.choose(side.id);
      expect(side.counters).toBe(2);
      if (syncPaid) {
        expect(f.s.prompt?.title).toBe("Rapid Deployment");
        f.choose("main");
      }
      expect(f.s.scheme.threat).toBe(syncPaid ? 7 : 10);
      expect(
        f.native.filter((e) => e.type === "thwart").map((e) => e.amount),
      ).toEqual(syncPaid ? [3, 3] : [3]);
    },
  );

  it.each([0, 1])(
    "Web-Trap's actual %i Sync receipt grants stun only after the five-damage attack",
    (syncPaid) => {
      const f = fixture();
      f.form("hero");
      f.enqueue(spdrEvent(f.s, f.piece("31006"), { syncPaid })!);
      f.choose(f.s.villain.id);
      expect(f.s.villain.damage).toBe(5);
      expect(f.s.villain.stunned).toBe(!!syncPaid);
      expect(f.native[0]).toMatchObject({
        type: "damage",
        amount: 5,
        attack: true,
        attackInitiated: true,
        source: "hero",
      });
      if (syncPaid)
        expect(f.native[1]).toMatchObject({
          type: "status",
          status: "stunned",
        });
    },
  );

  it("VEN#m offers one optional response for resources actually used from Sync Ratio and retains its actual physical instance", () => {
    const f = fixture();
    f.form("hero");
    const venom = f.put("31003");
    f.enqueue(spdrAllyEntered(f.s, venom, { syncPaid: 3 })!);
    expect(venom.counters).toBe(0);
    f.choose("use");
    expect(venom.counters).toBe(3);
    expect(f.s.player.inPlay.find((p) => p.id === venom.id)).toBe(venom);
    expect(spdrAllyEntered(f.s, venom, { syncPaid: 0 })).toEqual([]);
    expect(spdrAllyEntered(f.s, f.piece("31014"), { syncPaid: 3 })).toBeNull();
    f.form("alter");
    expect(spdrAllyEntered(f.s, venom, { syncPaid: 3 })).toEqual([]);
  });

  it("can decline VEN#m's sym response without a mandatory counter or duplicate ally", () => {
    const f = fixture();
    f.form("hero");
    const venom = f.put("31003");
    f.enqueue(spdrAllyEntered(f.s, venom, { syncPaid: 2 })!);
    f.choose("skip");
    expect(venom.counters).toBe(0);
    expect(f.s.player.inPlay.filter((p) => p.code === "31003")).toEqual([
      venom,
    ]);
  });

  it.each(["alter", "hero"] as const)(
    "Aunt May & Uncle Ben mill the real %s count and return only SP//dr cards from that occurrence",
    (form) => {
      const f = fixture();
      f.form(form);
      const may = f.put("31007"),
        prior = f.piece("31011"),
        signature = f.piece("31004"),
        offAspect = f.piece("31016"),
        third = f.piece("31012"),
        remainder = f.piece("31006");
      f.s.player.discard.push(prior);
      f.s.player.deck.push(signature, offAspect, third, remainder);
      f.ability(may.id);
      expect(may.exhausted).toBe(true);
      expect(f.s.player.hand.map((p) => p.id)).toEqual(
        form === "alter" ? [signature.id, third.id] : [signature.id],
      );
      expect(f.s.player.discard).toEqual([prior, offAspect]);
      expect(f.s.player.deck).toEqual(
        form === "alter" ? [remainder] : [third, remainder],
      );
      expect(f.ports.mill).toHaveBeenCalledWith(
        f.s,
        form === "alter" ? 3 : 2,
        expect.any(Array),
      );
    },
  );

  it.each([2, 14])(
    "Ejection Protocol sets HP %i to six, exhausts all Interfaces and preserves the Pilot's actual exhaustion across the forced flip",
    (hp) => {
      const f = fixture();
      f.form("hero");
      f.s.player.hp = hp;
      const protocol = f.put("31008"),
        link = f.put("31011"),
        unrelated = f.put("31007");
      const pilotId = spdrPilot(f.s)!.id,
        suitId = spdrSuit(f.s)!.id;
      f.ability(protocol.id);
      expect(f.s.player.hp).toBe(6);
      expect(f.s.player.form).toBe("alter");
      expect(f.s.player.tough).toBe(true);
      expect(f.s.player.exhausted).toBe(true);
      expect(link.exhausted).toBe(true);
      expect(unrelated.exhausted).toBe(false);
      expect(spdrIdentity(f.s)!.id).toBe(pilotId);
      expect(spdrSuit(f.s)!.id).toBe(suitId);
      expect(f.s.player.discard).toEqual([protocol]);
      expect(f.native.filter((e) => e.type === "damage")).toEqual([]);
    },
  );

  it("does not offer Ejection Protocol through a form lock", () => {
    const f = fixture();
    f.form("hero");
    const protocol = f.put("31008");
    f.s.flags.formLocked = true;
    expect(spdrAbilityOptions(f.s, protocol.id, f.ports)).toEqual([]);
  });

  it("SP//dr Command pays its actual two exhaust costs before drawing, without discarding either piece", () => {
    const f = fixture();
    f.form("hero");
    const command = f.put("31009"),
      link = f.put("31011"),
      draw = f.piece("31004");
    f.s.player.deck.push(draw);
    f.ability(command.id, "command-draw");
    expect(command.exhausted).toBe(false);
    expect(link.exhausted).toBe(false);
    f.choose(link.id);
    expect(command.exhausted).toBe(true);
    expect(link.exhausted).toBe(true);
    expect(f.s.player.hand).toEqual([draw]);
    expect(f.s.player.discard).toEqual([]);
  });

  it("SP//dr Command discards the chosen actual hand piece before offering exhausted Interface targets", () => {
    const f = fixture();
    f.form("hero");
    const command = f.put("31009"),
      link = f.put("31011", { exhausted: true }),
      first = f.piece("31004"),
      keep = f.piece("31004");
    f.s.player.hand.push(first, keep);
    f.ability(command.id, "command-ready");
    f.choose(first.id);
    expect(command.exhausted).toBe(true);
    expect(f.s.player.discard).toEqual([first]);
    expect(f.s.player.hand).toEqual([keep]);
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual([link.id]);
    f.choose(link.id);
    expect(link.exhausted).toBe(false);
  });

  it("Host Spider readies the actual Suit once and respects the ready lock", () => {
    const f = fixture();
    f.form("hero");
    f.s.player.exhausted = true;
    spdrSyncIdentity(f.s);
    const host = f.put("31010");
    f.s.flags.readyLocked = true;
    expect(spdrAbilityOptions(f.s, host.id, f.ports)).toEqual([]);
    delete f.s.flags.readyLocked;
    f.ability(host.id);
    expect(host.exhausted).toBe(true);
    expect(f.s.player.exhausted).toBe(false);
    expect(spdrSuit(f.s)!.exhausted).toBe(false);
  });

  it.each([
    ["attack", "31013"],
    ["thwart", "31011"],
  ] as const)(
    "the %s Interface adds two only to this retained basic-power packet",
    (power, code) => {
      const f = fixture();
      f.form("hero");
      const upgrade = f.put(code),
        packet = {
          type: power === "attack" ? "damage" : "thwart",
          target: power === "attack" ? f.s.villain.id : "main",
          amount: 2,
          source: "hero",
        };
      const options = spdrBasicOptions(f.s, power, packet, f.ports);
      expect(options).toHaveLength(1);
      f.enqueue(options[0].effects);
      expect(upgrade.exhausted).toBe(true);
      expect(f.native[0]).toMatchObject({
        ...packet,
        amount: 4,
        spdrBasicHandled: true,
      });
      expect(spdrBasicOptions(f.s, power, packet, f.ports)).toEqual([]);
    },
  );

  it("Speed-Metal Alloy spends its actual exhaust cost to add two to the current defense", () => {
    const f = fixture();
    f.form("hero");
    const alloy = f.put("31012");
    f.enqueue(spdrDefenseOptions(f.s, f.ports)[0].effects);
    expect(alloy.exhausted).toBe(true);
    expect(f.ports.addDefense).toHaveBeenCalledWith(f.s, 2);
    expect(spdrDefenseOptions(f.s, f.ports)).toEqual([]);
  });
});

describe("SP//dr obligation and five-card nemesis reserve", () => {
  it("allocates exactly five owned reserve instances once and reveals/shuffles those same IDs", () => {
    const f = fixture();
    spdrInitializeNemesis(f.s, f.ports);
    const original = [...f.s.player.setAside!];
    expect(original.map((p) => p.code)).toEqual([
      "31026",
      "31027",
      "31028",
      "31028",
      "31028",
    ]);
    spdrInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual(original);
    f.enqueue(spdrShadowOfPast(f.s)!);
    expect(f.s.player.setAside).toEqual([]);
    expect(f.s.minions[0].id).toBe(
      original.find((p) => p.code === "31027")!.id,
    );
    expect(f.s.sideSchemes[0].id).toBe(
      original.find((p) => p.code === "31026")!.id,
    );
    expect(f.s.encounter.deck.map((p) => p.id).sort()).toEqual(
      original
        .filter((p) => p.code === "31028")
        .map((p) => p.id)
        .sort(),
    );
    expect(f.ports.shuffleEncounter).toHaveBeenCalledTimes(1);
    expect(spdrShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });

  it("M.O.R.B.I.U.S. follows engaged-player generation from every source, without damaging an alter ego", () => {
    const f = fixture();
    f.form("hero");
    const mine = f.piece("31027", { engagedWith: "p1" }),
      teammate = f.piece("31027", { engagedWith: "p2" });
    f.s.minions.push(mine, teammate);
    expect(spdrResourcesGenerated(f.s, 3)).toEqual([
      { type: "damage", target: "hero", amount: 3, source: mine.id },
    ]);
    f.enqueue(spdrResourcesGenerated(f.s, 3));
    expect(f.s.player.hp).toBe(11);
    expect(spdrResourcesGenerated(f.s, 0)).toEqual([]);
    f.form("alter");
    expect(spdrResourcesGenerated(f.s, 3)).toEqual([]);
  });

  it.each(["hero", "alter"] as const)(
    "Energy Drain retains the real %s alternative and an exact two-Energy payment",
    (form) => {
      const f = fixture();
      f.form(form);
      const drain = f.piece("31028");
      f.enqueue(spdrEncounterReveal(f.s, drain)!);
      expect(f.s.prompt?.options?.map((o) => o.id)).toEqual(["pay", "other"]);
      f.choose("pay");
      expect(f.ports.pay).toHaveBeenCalledWith(
        f.s,
        "Energy Drain",
        2,
        ["energy", "energy"],
        [],
      );
      expect(f.s.player.hp).toBe(14);
      expect(f.s.player.exhausted).toBe(false);
      f.enqueue(spdrEncounterReveal(f.s, drain)!);
      f.choose("other");
      expect(f.s.player.hp).toBe(form === "hero" ? 11 : 14);
      expect(f.s.player.exhausted).toBe(form === "alter");
    },
  );

  it("does not invent the Energy Drain payment when two Energy cannot actually be spent", () => {
    const f = fixture();
    f.form("hero");
    f.s.flags.cannotPay = true;
    f.enqueue(spdrEncounterReveal(f.s, f.piece("31028"))!);
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual(["other"]);
  });

  it("Inherited Burden's remove option requires the actual ready Peni after the optional paired flip", () => {
    const f = fixture();
    f.form("hero");
    const burden = f.piece("31025");
    f.s.resolving.push(burden);
    f.enqueue(spdrEncounterReveal(f.s, burden)!);
    f.choose("flip");
    expect(f.s.player.form).toBe("alter");
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual(["remove"]);
    f.choose("remove");
    expect(f.s.player.exhausted).toBe(true);
    expect(spdrPilot(f.s)!.exhausted).toBe(true);
    expect(f.s.removed).toEqual([burden]);
    expect(f.s.encounter.discard).toEqual([]);
  });

  it("Inherited Burden discards the selected real Interface and never offers the permanent Pilot", () => {
    const f = fixture();
    f.form("hero");
    const burden = f.piece("31025"),
      link = f.put("31011");
    f.s.resolving.push(burden);
    f.enqueue(spdrEncounterReveal(f.s, burden)!);
    f.choose("continue");
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual([link.id]);
    f.choose(link.id);
    expect(f.s.player.discard).toEqual([link]);
    expect(f.s.encounter.discard).toEqual([burden]);
    expect(spdrPilot(f.s)!.code).toBe("31002b");
  });

  it("Inherited Burden cannot remove itself by exhausting an already exhausted Peni", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    spdrSyncIdentity(f.s);
    const burden = f.piece("31025"),
      link = f.put("31011");
    f.enqueue(spdrEncounterReveal(f.s, burden)!);
    f.choose("continue");
    expect(f.s.prompt?.options?.map((o) => o.id)).toEqual([link.id]);
  });

  it("routes the obligation to the actual living SP//dr teammate and preserves its physical instance", () => {
    const f = fixture();
    const spdr = f.s.players[0];
    const nova = {
      ...spdr,
      id: "p2",
      heroId: "nova",
      player: { ...spdr.player, hand: [], deck: [], discard: [], inPlay: [] },
      flags: {},
    };
    f.s.players.push(nova);
    f.s.playerCount = 2;
    activateSeat(f.s, "p2");
    const burden = f.piece("31025");
    f.s.resolving.push(burden);
    const effects = spdrEncounterReveal(f.s, burden)!;
    expect(effects[0].actorId).toBe("p1");
    f.enqueue(effects);
    expect(f.s.activePlayerId).toBe("p1");
    expect(
      seatView(f.s, "p1").player.inPlay.filter((p) => p.id === burden.id),
    ).toEqual([burden]);
    expect(seatView(f.s, "p2").player.inPlay).toEqual([]);
  });
});
