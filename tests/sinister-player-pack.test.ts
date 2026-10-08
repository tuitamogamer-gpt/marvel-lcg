import { describe, expect, it, vi } from "vitest";
import raw from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import { consumeStatus } from "../src/game/keywords.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  SINISTER_PLAYER_PACK_SCRIPT_CODES,
  SINISTER_PLAYER_PACK_CORE_ALIASES,
  resolveSinisterPlayerPackEffect,
  sinisterPlayerPackAbility,
  sinisterPlayerPackAbilityOptions,
  sinisterPlayerPackAllyDefenseInterrupt,
  sinisterPlayerPackAllyEntered,
  sinisterPlayerPackAllyLeaveInterrupt,
  sinisterPlayerPackAllyLeftPlay,
  sinisterPlayerPackAllyPowerResponses,
  sinisterPlayerPackBasicPowerInterrupt,
  sinisterPlayerPackBeforeEvent,
  sinisterPlayerPackCardEntered,
  sinisterPlayerPackCardPlayed,
  sinisterPlayerPackConsequentialOptions,
  sinisterPlayerPackCostReduction,
  sinisterPlayerPackEncounterRevealed,
  sinisterPlayerPackEvent,
  sinisterPlayerPackHazards,
  sinisterPlayerPackIdentityModifiers,
  sinisterPlayerPackJumpFlipOptions,
  sinisterPlayerPackPlayRestriction,
  sinisterPlayerPackRequirements,
  type SinisterPlayerPackPorts,
  type SinisterPlayerPowerReceipt,
  type SinisterPlayerDeckReceipt,
  type SinisterPlayerDamageReceipt,
} from "../src/game/sinister-player-pack.js";
const cards = new Map((raw as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sinister-player:${type}`,
  ...args,
});
const power = (
  id: string,
  args: Partial<SinisterPlayerPowerReceipt> = {},
): SinisterPlayerPowerReceipt => ({
  token: "basic-use-1",
  playerId: "p1",
  allyId: id,
  power: "attack",
  performed: true,
  basic: true,
  ...args,
});
function fixture() {
  const s = newGame({
    heroId: "rocket",
    aspect: "protection",
    villainId: "rhino",
    pacing: "expert",
    seed: 27100,
    heroes: [
      { heroId: "rocket", aspect: "protection" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.heroId = s.players[0].heroId = "ghost_spider";
  s.phase = "player";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.hp = 10;
    v.player.stunned = v.player.confused = false;
    seat.flags = {};
  }
  s.flags = s.players[0].flags;
  s.queue = [];
  s.prompt = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 10;
  const f = {
    s,
    ports: {} as SinisterPlayerPackPorts,
    history: [] as string[],
    packets: [] as Effect[],
    count: 0,
    cancelPlay: false,
    repeatAccept: true,
    put: (code: string): Piece => {
      const p = f.piece(code);
      f.s.player.inPlay.push(p);
      sinisterPlayerPackCardEntered(f.s, p);
      return p;
    },
    piece: (code: string): Piece => ({
      ...makePiece(f.s, code),
      ownerId: f.s.activePlayerId,
    }),
  };
  const take = (s: GameState, id: string): Piece => {
    for (const z of [s.player.deck, s.player.hand, s.player.discard]) {
      const i = z.findIndex((p) => p.id === id);
      if (i >= 0) return z.splice(i, 1)[0];
    }
    for (const g of s.player.inPlay) {
      const i = g.storedCards?.findIndex((p) => p.id === id) ?? -1;
      if (i >= 0) return g.storedCards!.splice(i, 1)[0];
    }
    throw Error("Missing actual source");
  };
  const traits = (s: GameState, p: Piece): string[] => {
    if (s.flags[`traits:${p.id}`])
      return String(s.flags[`traits:${p.id}`]).split("|");
    const text = cards.get(p.code)?.traits || "";
    return [
      ...(text.includes("S.H.I.E.L.D.") ? ["S.H.I.E.L.D."] : []),
      ...text
        .replace("S.H.I.E.L.D.", "")
        .split(".")
        .map((t) => t.trim())
        .filter(Boolean),
    ];
  };
  const identityTrait = (s: GameState, t: string) =>
    s.flags.identityTraits
      ? String(s.flags.identityTraits).split("|").includes(t)
      : s.player.form === "hero" &&
        ["ghost_spider", "spider_man_morales"].includes(s.heroId) &&
        t === "Web-Warrior";
  f.ports = {
    queue: (s, ...e) => s.queue.unshift(...e),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    traits,
    identityHasTrait: identityTrait,
    identityName: (s) =>
      s.heroId === "ghost_spider"
        ? "Gwen Stacy"
        : s.heroId === "spider_man_morales"
          ? "Miles Morales"
          : "Peter Parker",
    identityMaxHP: (s) => Number(s.flags.maxHP || 10),
    canReadyIdentity: (s, id) => !seatView(s, id).flags.cannotReady,
    canReadyPiece: (s, p) => !s.flags[`cannotReady:${p.id}`],
    canGiveStatus: (s, id, status) => {
      const p =
        id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
      return !!p && !p[status];
    },
    controlledTraitCards: (s, t, ready) => [
      ...(identityTrait(s, t) && (!ready || !s.player.exhausted)
        ? [{ id: `hero:${s.activePlayerId}`, label: "identity" }]
        : []),
      ...s.player.inPlay
        .filter((p) => traits(s, p).includes(t) && (!ready || !p.exhausted))
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    characterTargets: (s, t, except) => [
      ...s.players
        .filter((seat) => {
          const v = seatView(s, seat);
          return (
            identityTrait(v, t) &&
            v.player.exhausted &&
            f.ports.canReadyIdentity(s, seat.id) &&
            `hero:${seat.id}` !== except
          );
        })
        .map((seat) => ({ id: `hero:${seat.id}`, label: "identity" })),
      ...allInPlay(s)
        .filter(
          (p) =>
            cards.get(p.code)?.type_code === "ally" &&
            traits(s, p).includes(t) &&
            p.exhausted &&
            p.id !== except &&
            f.ports.canReadyPiece(s, p),
        )
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    exhaustCards: (s, ids) => {
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        if (id.startsWith("hero:")) {
          expect(seatView(s, id.slice(5)).player.exhausted).toBe(false);
          seatView(s, id.slice(5)).player.exhausted = true;
        } else {
          const p = s.player.inPlay.find((p) => p.id === id)!;
          expect(p.exhausted).toBe(false);
          p.exhausted = true;
        }
      }
      f.history.push(`exhaust:${ids.join(",")}`);
    },
    cardCost: (_s, p) => cards.get(p.code)?.cost || 0,
    canPay: vi.fn(() => true),
    handPlayableCards: (s) => [
      ...s.player.hand,
      ...s.player.inPlay
        .filter((p) => p.code === "27007" && !f.ports.isTextBlank(s, p))
        .flatMap((p) => p.storedCards || []),
    ],
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
    attackProgram: (s, e, after) => {
      f.history.push("attack");
      f.ports.queue(s, ...e, ...after);
    },
    attackVillain: (s, id, after) => {
      f.history.push(`villain-attack:${id}`);
      f.ports.queue(s, ...after);
    },
    discardHand: (s, id) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      const p = s.player.hand.splice(i, 1)[0];
      seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
    },
    discardControlled: (s, id) => {
      const i = s.player.inPlay.findIndex((p) => p.id === id);
      s.player.discard.push(s.player.inPlay.splice(i, 1)[0]);
      f.history.push(`discard:${id}`);
    },
    discardRandomHand: (s, after) => {
      const p = s.player.hand[0];
      f.history.push(`random-cost:${p.id}`);
      f.ports.discardHand(s, p.id);
      s.seed++;
      f.ports.queue(s, ...after);
    },
    revealHidden: () => {
      f.history.push("hidden");
    },
    shuffleEncounter: (s, after) => {
      f.history.push("shuffle-encounter");
      f.ports.queue(s, ...after);
    },
    shufflePlayerDeck: (s, after) => {
      f.history.push("shuffle-player");
      f.ports.queue(s, ...after);
    },
    discardTopEncounter: (s, n, after) => {
      const discarded = s.encounter.deck.splice(0, n);
      s.encounter.discard.push(...discarded);
      f.ports.queue(
        s,
        ...after.map((e) => ({
          ...e,
          discardedIds: discarded.map((p) => p.id),
        })),
      );
    },
    discardUntilTreachery: (s, after) => {
      let treachery: Piece | undefined;
      while (s.encounter.deck.length) {
        const p = s.encounter.deck.shift()!;
        s.encounter.discard.push(p);
        if (cards.get(p.code)?.type_code === "treachery") {
          treachery = p;
          break;
        }
      }
      f.history.push("discard-until");
      f.ports.queue(
        s,
        ...after.map((e) => ({ ...e, treacheryId: treachery?.id })),
      );
    },
    revealDiscardedCost: (s, id, after) => {
      const i = s.encounter.discard.findIndex((p) => p.id === id);
      const p = s.encounter.discard.splice(i, 1)[0];
      s.encounter.dealt.push(p);
      f.history.push(`reveal-cost:${id}`);
      f.ports.queue(s, ...after);
    },
    countEncounterIcons: (s, ids, stars, after) => {
      f.history.push(`count:${stars}:${ids.join(",")}`);
      const pieces = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...s.resolving,
        ...s.minions,
        ...s.sideSchemes,
        ...s.attachments,
      ];
      const amount = ids.reduce((n, id) => {
        const c = cards.get(pieces.find((p) => p.id === id)!.code)!;
        return n + (c.boost || 0) + (stars && c.boost_star ? 1 : 0);
      }, 0);
      f.ports.queue(s, ...after.map((e) => ({ ...e, boostTotal: amount })));
    },
    healIdentityCost: (s, n, after) => {
      s.player.hp += n;
      f.history.push(`heal-cost:${n}`);
      f.ports.queue(s, ...after);
    },
    damageAllyCost: (s, id, n, after) => {
      const p = s.player.inPlay.find((p) => p.id === id)!;
      p.damage += n;
      f.history.push(`ally-cost:${id}`);
      if (p.damage >= (cards.get(p.code)?.health || 0))
        f.ports.discardControlled(s, id);
      f.ports.queue(s, ...after);
    },
    canPutCard: (s, p) => !s.flags[`cannotPut:${p.id}`],
    putCard: (s, id, after) => {
      const p = take(s, id);
      s.player.inPlay.push(p);
      if (cards.get(p.code)?.name === "Surveillance Team") p.counters = 3;
      sinisterPlayerPackCardEntered(s, p);
      f.history.push(`put:${id}`);
      f.ports.queue(s, ...after);
    },
    playFromHand: (s, id, discount, after) => {
      f.history.push(`play:${id}:discount${discount}`);
      if (!f.cancelPlay) s.player.inPlay.push(take(s, id));
      f.ports.queue(s, ...after);
    },
    payRepeat: (s, id, n, yes, no) => {
      f.history.push(`pay-repeat:${id}:${n}`);
      f.ports.queue(s, ...(f.repeatAccept ? yes : no));
    },
    addBasicPowerBonus: (s, r, n) => {
      s.flags[`bonus:${r.token}`] = n;
      f.history.push(`bonus:${r.allyId}:${n}`);
    },
    damageAvailable: (s, r) => s.flags.damageToken === r.token,
    preventDamage: (s, r, n, after) => {
      s.flags.preventedDamage = Math.min(r.amount, n);
      f.history.push(`prevent:${r.token}:${n}`);
      f.ports.queue(s, ...after);
    },
    playJumpFlip: (s, id, r, after) => {
      const p = take(s, id);
      s.player.discard.push(p);
      f.history.push(`defense-play:${id}`);
      f.ports.queue(
        s,
        ...sinisterPlayerPackEvent(s, p, ["energy"], r)!,
        ...after,
      );
    },
    consequentialAvailable: (s, r) => s.flags.consequentialToken === r.token,
    preventConsequential: (s, r, n, after) => {
      s.flags.preventedConsequential = Math.min(r.amount, n);
      f.ports.queue(s, ...after);
    },
    lookDeck: (s, id, enc, n, after) => {
      const z = enc ? s.encounter.deck : seatView(s, id!).player.deck;
      const receipt: SinisterPlayerDeckReceipt = {
        token: `look-${++f.count}`,
        playerId: id,
        encounter: enc,
        ids: z.slice(0, n).map((p) => p.id),
      };
      f.history.push(`look:${id || "encounter"}`);
      f.ports.queue(s, ...after.map((e) => ({ ...e, deckReceipt: receipt })));
    },
    arrangeDeck: (s, r, discard, top, bottom, after) => {
      const view = r.encounter ? s : seatView(s, r.playerId!);
      const z = r.encounter ? s.encounter.deck : view.player.deck;
      expect([...discard, ...top, ...bottom].sort()).toEqual([...r.ids].sort());
      const taken = r.ids.map((id) => {
        const i = z.findIndex((p) => p.id === id);
        expect(i).toBeGreaterThanOrEqual(0);
        return z.splice(i, 1)[0];
      });
      const byId = (ids: string[]) =>
        ids.map((id) => taken.find((p) => p.id === id)!);
      (r.encounter ? s.encounter.discard : view.player.discard).push(
        ...byId(discard),
      );
      z.unshift(...byId(top));
      z.push(...byId(bottom));
      f.history.push("arrange");
      f.ports.queue(s, ...after);
    },
  };
  const resolve = (e: Effect) => {
    if (e.actorId && e.actorId !== f.s.activePlayerId)
      activateSeat(f.s, e.actorId);
    if (resolveSinisterPlayerPackEffect(f.s, e, f.ports)) return;
    switch (e.type) {
      case "damage": {
        f.packets.push(e);
        const p = f.s.minions.find((p) => p.id === e.target);
        if (p) p.damage += e.amount;
        else if (e.target === f.s.villain.id) f.s.villain.hp -= e.amount;
        else {
          const a = allInPlay(f.s).find((p) => p.id === e.target);
          if (a) a.damage += e.amount;
        }
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
      case "ready":
        if (e.target.startsWith("hero:"))
          seatView(f.s, e.target.slice(5)).player.exhausted = false;
        else {
          const p = allInPlay(f.s).find((p) => p.id === e.target)!;
          p.exhausted = false;
        }
        break;
      case "status": {
        const p =
          e.target === f.s.villain.id
            ? f.s.villain
            : f.s.minions.find((p) => p.id === e.target)!;
        p[e.status as "stunned"] = true;
        break;
      }
      case "draw":
        for (let n = 0; n < e.amount && f.s.player.deck.length; n++)
          f.s.player.hand.push(f.s.player.deck.shift()!);
        f.packets.push(e);
        break;
      case "heal":
        if (e.target.startsWith("hero:")) {
          const p = seatView(f.s, e.target.slice(5)).player;
          p.hp = Math.min(10, p.hp + e.amount);
        } else {
          const p = allInPlay(f.s).find((p) => p.id === e.target)!;
          p.damage = Math.max(0, p.damage - e.amount);
        }
        f.packets.push(e);
        break;
      case "fixture:event":
        if (
          (e.piece.code === "27015" && consumeStatus(f.s.player, "stunned")) ||
          (e.piece.code === "27013" && consumeStatus(f.s.player, "confused"))
        ) {
          f.history.push("status-replaced");
        } else
          f.ports.queue(
            f.s,
            ...sinisterPlayerPackEvent(f.s, e.piece, e.paid || [])!,
          );
        break;
      case "fixture:done":
        f.history.push("done");
        break;
      default:
        throw Error(`Unknown fixture effect ${e.type}`);
    }
  };
  const pump = () => {
    for (let i = 0; !f.s.prompt && f.s.queue.length && i < 300; i++)
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
  const hand = (...codes: string[]) =>
    codes.map((code) => {
      const p = f.piece(code);
      f.s.player.hand.push(p);
      return p;
    });
  const cast = (p: Piece) =>
    run(
      ...(sinisterPlayerPackBeforeEvent(f.s, p, [
        { type: "fixture:event", piece: p },
      ]) || [{ type: "fixture:event", piece: p }]),
    );
  return Object.assign(f, { run, pump, choose, hand, cast });
}

describe("Sinister original player closure and exact source printings", () => {
  it("covers all33 genuine non-set player faces and excludes signatures/campaign/scenarios", () => {
    const pool = [...cards.values()].filter(
      (c) =>
        c.pack_code === "sm" &&
        ["justice", "protection", "basic", "aggression", "leadership"].includes(
          c.faction_code,
        ),
    );
    const codes = [
      ...SINISTER_PLAYER_PACK_SCRIPT_CODES,
      ...SINISTER_PLAYER_PACK_CORE_ALIASES,
    ];
    expect(codes).toHaveLength(33);
    expect(new Set(codes).size).toBe(33);
    expect(codes.sort()).toEqual(pool.map((c) => c.code).sort());
    expect(codes).toContain("27190");
    expect(codes).toContain("27191");
  });
  it.each([
    ["27020", "01088"],
    ["27021", "01089"],
    ["27022", "01090"],
    ["27045", "01064"],
    ["27051", "01088"],
    ["27052", "01089"],
    ["27053", "01090"],
  ])("aliases %s only because all16 gameplay fields match Core %s", (a, b) => {
    const fields = [
      "name",
      "type_code",
      "faction_code",
      "cost",
      "text",
      "traits",
      "attack",
      "thwart",
      "defense",
      "health",
      "attack_cost",
      "thwart_cost",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
    ];
    for (const field of fields)
      expect(
        (cards.get(a) as unknown as Record<string, unknown>)[field] ?? null,
      ).toEqual(
        (cards.get(b) as unknown as Record<string, unknown>)[field] ?? null,
      );
  });
  it("keeps physical original source40 for each hero and never injects optional Suit/Venom", () => {
    for (const code of ["27001a", "27030a"]) {
      const d = decks.find((d) => d.heroCode === code)!;
      expect(Object.values(d.cards).reduce((a, b) => a + b, 0)).toBe(40);
      expect(d.setupCards).toEqual({});
      expect(d.cards).not.toHaveProperty("27190");
      expect(d.cards).not.toHaveProperty("27191");
    }
    expect(cards.get("27191")?.quantity).toBe(4);
  });
  it("does not alias Bait and Switch or the second Young Love to a non-Core script", () => {
    expect(SINISTER_PLAYER_PACK_SCRIPT_CODES).toContain("27013");
    expect(SINISTER_PLAYER_PACK_SCRIPT_CODES).toContain("27019");
    expect(SINISTER_PLAYER_PACK_SCRIPT_CODES).toContain("27050");
  });
});
describe("printed payment, stat and hazard contracts", () => {
  it("keeps every printed Requirement even at zero resource cost", () => {
    const f = fixture(),
      p = f.piece("27016"),
      peter = f.piece("27049");
    expect(sinisterPlayerPackRequirements(p)).toEqual(["physical"]);
    expect(sinisterPlayerPackRequirements(peter)).toEqual([
      "energy",
      "mental",
      "physical",
    ]);
    expect(sinisterPlayerPackRequirements(f.piece("27018"))).toEqual([]);
  });
  it("Web of Life is free only for current identity Web-Warrior, not merely a controlled ally", () => {
    const f = fixture(),
      p = f.piece("27023");
    expect(sinisterPlayerPackCostReduction(f.s, p, f.ports)).toBe(3);
    f.s.player.form = "alter";
    f.put("27012");
    expect(sinisterPlayerPackCostReduction(f.s, p, f.ports)).toBe(0);
  });
  it("Spider-Woman discount counts every actually confused enemy across seats", () => {
    const f = fixture(),
      p = f.piece("27041"),
      m = f.piece("27027");
    m.engagedWith = "p2";
    m.confused = true;
    f.s.minions.push(m);
    f.s.villain.confused = true;
    expect(sinisterPlayerPackCostReduction(f.s, p, f.ports)).toBe(2);
  });
  it.each(["hero", "alter"] as const)(
    "Suit modifies all basic powers/hand/HP in %s, but its printed hazard survives blanking",
    (form) => {
      const f = fixture(),
        suit = f.put("27191"),
        venom = f.put("27190");
      f.s.player.form = form;
      expect(sinisterPlayerPackIdentityModifiers(f.s, f.ports)).toEqual({
        attack: 1,
        thwart: 1,
        defense: 1,
        recover: 1,
        handSize: 1,
        health: 10,
      });
      f.s.flags[`blank:${suit.id}`] = f.s.flags[`blank:${venom.id}`] = true;
      expect(sinisterPlayerPackIdentityModifiers(f.s, f.ports).health).toBe(0);
      expect(sinisterPlayerPackHazards(f.s)).toBe(2);
    },
  );
});
describe("actual ally play/entry/leave/basic-power hooks", () => {
  it("Silk triggers on HAND PLAY with another Web-Warrior, not put into play", () => {
    const f = fixture(),
      silk = f.put("27010"),
      t = f.piece("27029");
    f.s.encounter.deck.push(t);
    expect(sinisterPlayerPackAllyEntered(f.s, silk, false, f.ports)).toBeNull();
    f.run(...sinisterPlayerPackAllyEntered(f.s, silk, true, f.ports)!);
    f.choose("yes");
    f.choose(t.id);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([t.id]);
    expect(f.history).toEqual(["hidden", "shuffle-encounter"]);
  });
  it("Miles ally needs3controlledWebWarriors including himself and gives each missing status", () => {
    const f = fixture(),
      m = f.put("27011");
    expect(sinisterPlayerPackAllyEntered(f.s, m, true, f.ports)).toBeNull();
    f.put("27023");
    f.s.villain.stunned = true;
    f.run(...sinisterPlayerPackAllyEntered(f.s, m, true, f.ports)!);
    f.choose("yes");
    f.choose(f.s.villain.id);
    expect(f.s.villain.confused).toBe(true);
    expect(f.s.villain.stunned).toBe(true);
  });
  it("Spider-UK damages the actual attacker before attack continuation using actual controlled count", () => {
    const f = fixture(),
      uk = f.put("27012"),
      a = f.piece("27027");
    uk.exhausted = true;
    f.s.minions.push(a);
    f.put("27023");
    f.run(
      ...sinisterPlayerPackAllyDefenseInterrupt(f.s, uk.id, a.id, f.ports, [
        { type: "fixture:done" },
      ])!,
    );
    f.choose("yes");
    expect(f.s.minions[0].damage).toBe(3);
    expect(f.packets[0]).toMatchObject({
      attack: false,
      source: uk.id,
      target: a.id,
    });
    expect(f.history).toEqual(["done"]);
  });
  it.each(["deck", "hand", "discard"] as const)(
    "Monica PUT finds actual Surveillance Team from %s and adds counters to every current Team",
    (zone) => {
      const f = fixture(),
        monica = f.put("27040"),
        old = f.put("01064"),
        fresh = f.piece("27045");
      old.counters = 2;
      f.s.player[zone].push(fresh);
      f.run(...sinisterPlayerPackAllyEntered(f.s, monica, false, f.ports)!);
      f.choose("yes");
      f.choose(fresh.id);
      expect(f.s.player.inPlay.find((p) => p.id === fresh.id)?.counters).toBe(
        4,
      );
      expect(f.s.player.inPlay.find((p) => p.id === old.id)?.counters).toBe(3);
      expect(f.history).toContain(`put:${fresh.id}`);
    },
  );
  it("Agent13 can ready another controller's actual SHIELD support after a performed power", () => {
    const f = fixture(),
      a = f.put("27046");
    activateSeat(f.s, "p2");
    const support = f.put("27054");
    support.exhausted = true;
    activateSeat(f.s, "p1");
    f.run(...sinisterPlayerPackAllyPowerResponses(f.s, power(a.id), f.ports)!);
    f.choose(support.id);
    expect(seatView(f.s, "p2").player.inPlay[0].exhausted).toBe(false);
    expect(
      sinisterPlayerPackAllyPowerResponses(
        f.s,
        power(a.id, { performed: false }),
        f.ports,
      ),
    ).toBeNull();
  });
  it("Dugan exhausts distinct actual SHIELD sources and scopes bonus to one basic-use token", () => {
    const f = fixture(),
      d = f.put("27047"),
      a = f.put("27054"),
      b = f.put("27045");
    d.exhausted = true;
    const r = power(d.id);
    f.run(...sinisterPlayerPackBasicPowerInterrupt(f.s, r, f.ports)!);
    f.choose("yes");
    f.choose(a.id);
    f.choose(b.id);
    f.choose("done");
    expect(f.s.flags[`bonus:${r.token}`]).toBe(2);
    expect(
      f.s.player.inPlay
        .filter((p) => [a.id, b.id].includes(p.id))
        .every((p) => p.exhausted),
    ).toBe(true);
    expect(f.s.flags["bonus:other-use"]).toBeUndefined();
  });
  it("Peter Parker readies another actual Web-Warrior character, never himself or a support", () => {
    const f = fixture(),
      p = f.put("27049"),
      uk = f.put("27012");
    p.exhausted = uk.exhausted = true;
    f.s.player.exhausted = true;
    f.put("27023").exhausted = true;
    f.run(...sinisterPlayerPackAllyPowerResponses(f.s, power(p.id), f.ports)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["hero:p1", uk.id]);
    f.choose("hero:p1");
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Hobie uses actual discarded3 numeric icons without stars and runs before leave continuation", () => {
    const f = fixture(),
      h = f.put("27017"),
      a = f.piece("27025"),
      b = f.piece("27029"),
      c = f.piece("23031");
    f.s.encounter.deck.push(a, b, c);
    const r = {
      token: "leave",
      playerId: "p1",
      pieceId: h.id,
      code: h.code,
      traits: ["Web-Warrior"],
    };
    f.run(
      ...sinisterPlayerPackAllyLeaveInterrupt(f.s, r, f.ports, [
        { type: "fixture:done" },
      ])!,
    );
    f.choose("yes");
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
    expect(f.s.villain.hp).toBe(46);
    expect(f.history).toContain(`count:false:${[a.id, b.id, c.id].join(",")}`);
    expect(f.history.at(-1)).toBe("done");
  });
  it("Gwen ally finds only an actual identity-specific event, preserving its ID", () => {
    const f = fixture(),
      g = f.put("27048"),
      sig = f.piece("27002"),
      aspect = f.piece("27015");
    f.s.player.deck.push(sig, aspect);
    const r = {
      token: "leave",
      playerId: "p1",
      pieceId: g.id,
      code: g.code,
      traits: ["Web-Warrior"],
    };
    f.run(...sinisterPlayerPackAllyLeaveInterrupt(f.s, r, f.ports)!);
    f.choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([sig.id]);
    f.choose(sig.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([sig.id]);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([aspect.id]);
  });
});
describe("actual event costs and labeled/unlabeled effects", () => {
  it("Bait completes native villain attack before its actual hero thwart", () => {
    const f = fixture(),
      p = f.piece("27013");
    f.cast(p);
    expect(f.history).toEqual(["villain-attack:p1"]);
    expect(f.packets[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 4,
      action: true,
      basic: false,
    });
  });
  it("Confuse replacement prevents all Bait body including villain attack", () => {
    const f = fixture();
    f.s.player.confused = true;
    f.cast(f.piece("27013"));
    expect(f.history).toEqual(["status-replaced"]);
    expect(f.s.scheme.threat).toBe(10);
  });
  it("Return Favor reveals the same treachery as cost BEFORE Stun replacement", () => {
    const f = fixture(),
      p = f.piece("27015"),
      t = f.piece("27029");
    f.s.encounter.deck.push(f.piece("27027"), t);
    f.s.player.stunned = true;
    f.cast(p);
    expect(f.history).toEqual([
      "discard-until",
      `reveal-cost:${t.id}`,
      "status-replaced",
    ]);
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual([t.id]);
    expect(f.s.villain.hp).toBe(50);
  });
  it("a replay pays a new Return Favor cost and then makes one5damage attack", () => {
    const f = fixture(),
      p = f.piece("27015"),
      a = f.piece("27029"),
      b = f.piece("27029");
    f.s.encounter.deck.push(a, b);
    f.s.player.stunned = true;
    f.cast(p);
    f.cast(p);
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(f.s.villain.hp).toBe(45);
    expect(f.packets).toHaveLength(1);
    expect(f.packets[0]).toMatchObject({
      attack: true,
      amount: 5,
      abilitySource: p.id,
    });
  });
  it.each(["guard", "form"])(
    "Return the Favor retains its paid reveal and resolves according to current target legality after a %s change",
    (change) => {
      const f = fixture(),
        p = f.piece("27015"),
        t = f.piece("27029"),
        reveal = f.ports.revealDiscardedCost;
      expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toBeNull();
      f.s.encounter.deck.push(t);
      f.ports.revealDiscardedCost = (s, id, after) => {
        reveal(s, id, after);
        if (change === "guard") f.ports.enemyTargets = () => [];
        else s.player.form = "alter";
      };
      f.cast(p);
      expect(f.history).toEqual([
        "discard-until",
        `reveal-cost:${t.id}`,
        ...(change === "form" ? ["attack"] : []),
      ]);
      expect(f.s.encounter.dealt[0].id).toBe(t.id);
      expect(f.s.villain.hp).toBe(change === "form" ? 45 : 50);
      expect(f.packets).toHaveLength(change === "form" ? 1 : 0);
      if (change === "form") {
        expect(f.s.player.form).toBe("alter");
        expect(f.packets[0]).toMatchObject({
          attack: true,
          amount: 5,
          abilitySource: p.id,
        });
      }
      expect(f.s.flags[`sinisterFavorPaid:${p.id}`]).toBeUndefined();
    },
  );
  it("Return the Favor requires an initial legal villain target while preserving Stun replacement", () => {
    const f = fixture(),
      p = f.piece("27015");
    f.ports.enemyTargets = () => [];
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /villain attack target/,
    );
    f.s.player.stunned = true;
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toBeNull();
  });
  it("Homeland requires actual removable threat even when Confused, while Global Logistics can inspect a deck", () => {
    const f = fixture();
    f.put("27054");
    f.s.scheme.threat = 0;
    f.s.player.confused = true;
    expect(
      sinisterPlayerPackPlayRestriction(f.s, f.piece("27042"), f.ports),
    ).toMatch(/scheme with threat/);
    expect(
      sinisterPlayerPackPlayRestriction(f.s, f.piece("27043"), f.ports),
    ).toBeNull();
  });
  it.each([0, 1])(
    "WhatDoesn'tKillMe cannot pay a2healingcost with only%sdamage",
    (damage) => {
      const f = fixture(),
        p = f.piece("27016");
      f.s.player.hp = 10 - damage;
      f.s.player.exhausted = true;
      expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toMatch(
        /exactly 2/,
      );
      expect(() => f.cast(p)).toThrow(/exactly/);
    },
  );
  it("WhatDoesn'tKillMe requires exhausted readyable hero, heals2cost then readies", () => {
    const f = fixture(),
      p = f.piece("27016");
    f.s.player.hp = 7;
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).not.toBeNull();
    f.s.player.exhausted = true;
    f.cast(p);
    expect(f.s.player.hp).toBe(9);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.history).toEqual(["heal-cost:2"]);
  });
  it.each([true, false])(
    "JumpFlip works for attack=%s damage and Energy removal is not a thwart action",
    (attack) => {
      const f = fixture(),
        [p] = f.hand("27014"),
        r: SinisterPlayerDamageReceipt = {
          token: "damage",
          playerId: "p1",
          target: "hero:p1",
          amount: 1,
          attack,
        };
      f.s.flags.damageToken = r.token;
      f.run(
        ...sinisterPlayerPackJumpFlipOptions(f.s, r, [], f.ports)[0].effects,
      );
      expect(f.s.flags.preventedDamage).toBe(1);
      expect(f.s.scheme.threat).toBe(8);
      expect(f.packets[0]).toEqual({
        type: "thwart",
        target: "main",
        amount: 2,
        source: p.id,
      });
    },
  );
  it("JumpFlip includes actual George-stored events without making them random-discard costs", () => {
    const f = fixture(),
      g = f.put("27007"),
      p = f.piece("27014");
    g.storedCards = [p];
    const r = { token: "damage", playerId: "p1", target: "hero:p1", amount: 3 };
    f.s.flags.damageToken = r.token;
    expect(
      sinisterPlayerPackJumpFlipOptions(f.s, r, [], f.ports).map((o) => o.id),
    ).toEqual([p.id]);
    expect(f.s.player.hand).toEqual([]);
    const plan = f.put("27024");
    expect(sinisterPlayerPackAbilityOptions(f.s, plan.id, f.ports)).toEqual([]);
  });
  it("Homeland pays upTo3actualSHIELDcosts then ordinary threat removal ignores Confuse", () => {
    const f = fixture(),
      a = f.put("27054"),
      b = f.put("27045"),
      p = f.piece("27042");
    f.s.player.confused = true;
    f.cast(p);
    f.choose(a.id);
    f.choose(b.id);
    f.choose("done");
    f.choose("main");
    expect(f.s.scheme.threat).toBe(6);
    expect(f.s.player.confused).toBe(true);
    expect(f.packets[0]).toEqual({
      type: "thwart",
      target: "main",
      amount: 4,
      source: p.id,
    });
  });
  it("GlobalLogistics exhausts actual cost before look and atomically preserves all top4IDs across discard/top/bottom", () => {
    const f = fixture(),
      support = f.put("27054"),
      p = f.piece("27043"),
      a = f.piece("27025"),
      b = f.piece("27026"),
      c = f.piece("27029"),
      d = f.piece("27028"),
      rest = f.piece("27027");
    f.s.encounter.deck.push(a, b, c, d, rest);
    f.cast(p);
    f.choose(support.id);
    expect(f.s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    f.choose("encounter");
    f.choose("bottom");
    f.choose("top");
    f.choose("discard");
    f.choose("top");
    f.choose(d.id);
    f.choose(b.id);
    f.choose(a.id);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual([
      d.id,
      b.id,
      rest.id,
      a.id,
    ]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([c.id]);
    expect(f.history[0]).toBe(`exhaust:${support.id}`);
  });
  it("YoungLove has bothoriginalfaces and heals actual Gwen/Miles identities across current faces", () => {
    const f = fixture();
    f.s.players[1].heroId = "spider_man_morales";
    f.s.player.form = "alter";
    f.s.player.hp = 6;
    seatView(f.s, "p2").player.hp = 5;
    const p = f.piece("27050");
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.cast(p);
    expect(f.s.player.hp).toBe(9);
    expect(seatView(f.s, "p2").player.hp).toBe(8);
  });
  it("Young Love rejects an unrelated chosen identity and a team with no damage to heal", () => {
    const f = fixture(),
      p = f.piece("27019");
    f.s.players[1].heroId = "spider_man_morales";
    f.s.player.form = "alter";
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /damage to heal/,
    );
    f.s.player.hp = 9;
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.s.heroId = f.s.players[0].heroId = "rocket";
    f.put("27048");
    expect(sinisterPlayerPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /your chosen identity/,
    );
  });
});
describe("native-ready repeat, consequential, random-cost and response receipts", () => {
  it("Plan B transfers the same physical owner ID to another controller and enforces max1 per player", () => {
    const f = fixture(),
      old = f.put("27024"),
      newPlan = f.put("27024");
    f.run(...sinisterPlayerPackCardEntered(f.s, newPlan));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p2"]);
    f.choose("p2");
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([old.id]);
    expect(seatView(f.s, "p2").player.inPlay[0]).toMatchObject({
      id: newPlan.id,
      ownerId: "p1",
    });
    expect(
      sinisterPlayerPackPlayRestriction(f.s, f.piece("27024"), f.ports),
    ).toMatch(/already controls/);
  });
  it("Across SpiderVerse PUT ignores allyRequirement and recursive repeat pays3for selected player", () => {
    const f = fixture(),
      p = f.piece("27018"),
      ally = f.piece("27049");
    f.s.player.discard.push(ally);
    f.s.players[1].heroId = "spider_man_morales";
    const other = f.piece("27012");
    other.ownerId = "p2";
    seatView(f.s, "p2").player.discard.push(other);
    f.cast(p);
    f.choose("hero:p1");
    f.choose(ally.id);
    f.choose("p2");
    expect(f.history).toContain("pay-repeat:p2:3");
    expect(f.ports.canPay).toHaveBeenLastCalledWith(
      expect.objectContaining({ activePlayerId: "p2" }),
      3,
    );
    f.choose("hero:p2");
    f.choose(other.id);
    f.choose("pass");
    expect(f.s.activePlayerId).toBe("p1");
    expect(seatView(f.s, "p2").player.inPlay[0].id).toBe(other.id);
    expect(f.s.player.inPlay[0].id).toBe(ally.id);
  });
  it("declining repeat payment leaves chosen player's real cards ready and in discard", () => {
    const f = fixture(),
      p = f.piece("27018"),
      a = f.piece("27012"),
      b = f.piece("27049");
    f.s.player.discard.push(a, b);
    f.repeatAccept = false;
    f.cast(p);
    f.choose("hero:p1");
    f.choose(a.id);
    f.choose("p1");
    expect(f.s.player.discard.map((p) => p.id)).toEqual([b.id]);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
  });
  it("the card-instructed repeat can use an alter-ego contributor's actual Web-Warrior ally cost", () => {
    const f = fixture(),
      p = f.piece("27018"),
      first = f.piece("27049");
    f.s.player.discard.push(first);
    activateSeat(f.s, "p2");
    f.s.player.form = "alter";
    const ready = f.put("27012"),
      second = f.piece("27017");
    f.s.player.discard.push(second);
    activateSeat(f.s, "p1");
    f.cast(p);
    f.choose("hero:p1");
    f.choose(first.id);
    f.choose("p2");
    f.choose(ready.id);
    f.choose(second.id);
    f.choose("pass");
    expect(
      seatView(f.s, "p2").player.inPlay.find((p) => p.id === ready.id)
        ?.exhausted,
    ).toBe(true);
    expect(
      seatView(f.s, "p2").player.inPlay.some((p) => p.id === second.id),
    ).toBe(true);
    expect(f.s.activePlayerId).toBe("p1");
  });
  it("FieldAgent prevents actual SHIELD ally consequential, expends lastcounter and native discards source", () => {
    const f = fixture(),
      field = f.put("27044"),
      ally = f.put("27047"),
      r = { token: "consequence", allyId: ally.id, amount: 3 };
    field.counters = 1;
    f.s.flags.consequentialToken = r.token;
    f.run(
      ...sinisterPlayerPackConsequentialOptions(f.s, r, [], f.ports)[0].effects,
    );
    expect(f.s.flags.preventedConsequential).toBe(1);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([field.id]);
  });
  it("FieldAgent requires Hero form and a true pending consequential receipt", () => {
    const f = fixture(),
      field = f.put("27044"),
      ally = f.put("27047"),
      r = { token: "x", allyId: ally.id, amount: 1 };
    expect(field.counters).toBe(3);
    expect(sinisterPlayerPackConsequentialOptions(f.s, r, [], f.ports)).toEqual(
      [],
    );
    f.s.flags.consequentialToken = "x";
    f.s.player.form = "alter";
    expect(sinisterPlayerPackConsequentialOptions(f.s, r, [], f.ports)).toEqual(
      [],
    );
  });
  it("PlanB actualrandomhanddiscardcost happens before2nonattackbenefit and respects controller", () => {
    const f = fixture(),
      plan = f.put("27024"),
      [p] = f.hand("27002");
    f.s.player.stunned = true;
    const seed = f.s.seed;
    sinisterPlayerPackAbility(f.s, plan.id, f.ports);
    f.pump();
    expect(f.s.player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(f.s.seed).toBe(seed + 1);
    expect(f.history).toEqual([`random-cost:${p.id}`]);
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(48);
    expect(f.s.player.stunned).toBe(true);
  });
  it("Government actualHANDplaydiscount is retained after canceled payment and source remains exhausted", () => {
    const f = fixture(),
      g = f.put("27054"),
      [p] = f.hand("27040");
    f.cancelPlay = true;
    sinisterPlayerPackAbility(f.s, g.id, f.ports);
    f.pump();
    f.choose(p.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([p.id]);
    expect(f.s.player.inPlay.find((p) => p.id === g.id)?.exhausted).toBe(true);
    expect(f.history).toEqual([`play:${p.id}:discount1`]);
  });
  it("WebLife uses captured leavingtrait, canchoosep2draw, and resumesactualcontroller", () => {
    const f = fixture(),
      web = f.put("27023"),
      card = f.piece("27002");
    seatView(f.s, "p2").player.deck.push(card);
    const r = {
      token: "leave",
      playerId: "p1",
      pieceId: "gone",
      code: "27012",
      traits: ["Web-Warrior"],
    };
    f.run(...sinisterPlayerPackAllyLeftPlay(f.s, r, f.ports)!);
    f.choose(web.id);
    f.choose("p2");
    expect(seatView(f.s, "p2").player.hand.map((p) => p.id)).toEqual([card.id]);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.s.prompt).toBeNull();
  });
  it("SkyDestroyer triggers actualPLAY evenifcanceled event but eachsourceonlyonce perPLAYtoken", () => {
    const f = fixture(),
      sky = f.put("27055"),
      r = {
        token: "play",
        playerId: "p1",
        pieceId: "played",
        code: "27042",
        traits: ["S.H.I.E.L.D."],
        fromHand: true,
      };
    f.run(...sinisterPlayerPackCardPlayed(f.s, r, f.ports)!);
    f.choose(sky.id);
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(48);
    f.s.player.inPlay[0].exhausted = false;
    f.run(...sinisterPlayerPackCardPlayed(f.s, r, f.ports)!);
    expect(f.s.prompt).toBeNull();
    r.token = "play2";
    f.run(...sinisterPlayerPackCardPlayed(f.s, r, f.ports)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(sky.id);
  });
  it("Venom counts actualnumeric ANDstar after lethal1damagecost and stillresolves benefit", () => {
    const f = fixture(),
      v = f.put("27190"),
      reveal = f.piece("23031");
    v.damage = 5;
    f.s.encounter.dealt.push(reveal);
    const r = {
      token: "reveal",
      playerId: "p1",
      pieceId: reveal.id,
      code: reveal.code,
    };
    f.run(...sinisterPlayerPackEncounterRevealed(f.s, r, f.ports)!);
    f.choose(v.id);
    f.choose(f.s.villain.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([v.id]);
    expect(f.s.villain.hp).toBe(48);
    expect(f.history).toContain(`count:true:${reveal.id}`);
    expect(f.packets[0]).toMatchObject({
      source: v.id,
      attack: false,
      amount: 2,
    });
  });
  it("unknown cards/effects fall through and source blanking suppresses owned hooks", () => {
    const f = fixture(),
      p = f.put("27012");
    f.s.flags[`blank:${p.id}`] = true;
    expect(
      sinisterPlayerPackAllyDefenseInterrupt(
        f.s,
        p.id,
        f.s.villain.id,
        f.ports,
      ),
    ).toBeNull();
    expect(sinisterPlayerPackEvent(f.s, f.piece("27002"))).toBeNull();
    expect(
      resolveSinisterPlayerPackEffect(f.s, { type: "other" }, f.ports),
    ).toBe(false);
  });
});
