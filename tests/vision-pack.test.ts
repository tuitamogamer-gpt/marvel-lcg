import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";
import {
  VISION_PACK_CORE_ALIASES,
  VISION_PACK_SCRIPT_CODES,
  resolveVisionPackEffect,
  visionPackAbility,
  visionPackAbilityOptions,
  visionPackAllyEnter,
  visionPackAllyUseOptions,
  visionPackAttackDamageReduction,
  visionPackAttachmentTargets,
  visionPackBeforeEvent,
  visionPackBoostOptions,
  visionPackCardEntered,
  visionPackCardLeftPlay,
  visionPackCardPlayed,
  visionPackDamageOptions,
  visionPackDefenseEvents,
  visionPackEvent,
  visionPackJoiningPairs,
  visionPackPaymentAllowed,
  visionPackPlayRestriction,
  visionPackResourcesSpent,
  visionPackSchemeDefeating,
  visionPackStoredPlayable,
  visionPackTakeStoredForPlay,
  type VisionPackPorts,
} from "../src/game/vision-pack.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `vision-pack:${type}`,
  ...args,
});
function save(s: GameState) {
  const copy: GameState = JSON.parse(JSON.stringify(s)),
    seat = copy.players.find((seat) => seat.id === copy.activePlayerId)!;
  seat.player = copy.player;
  seat.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 26013,
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
  s.heroId = s.players[0].heroId = "vision";
  s.phase = "player";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hp = 11;
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.exhausted = false;
    v.player.tough = false;
    v.player.stunned = false;
    v.player.confused = false;
    seat.flags = {};
    if (seat.id === s.activePlayerId) s.flags = seat.flags;
  }
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.villain.hp = 50;
  const f: {
    s: GameState;
    ports: VisionPackPorts;
    history: string[];
    packets: Effect[];
    prevention: number[];
    batches: string[][];
  } = {
    s,
    ports: {} as VisionPackPorts,
    history: [],
    packets: [],
    prevention: [],
    batches: [],
  };
  const piece = (code: string, ownerId = f.s.activePlayerId) => ({
    ...makePiece(f.s, code),
    ownerId,
  });
  const targetPiece = (s: GameState, id: string) =>
    s.players
      .flatMap((seat) => seatView(s, seat).player.inPlay)
      .find((p) => p.id === id);
  const hasTrait = (s: GameState, id: string, trait: string) =>
    id.startsWith("hero:")
      ? trait === "Android" && seatView(s, id.slice(5)).heroId === "vision"
      : (cards.get(targetPiece(s, id)?.code || "")?.traits || "")
          .split(/\.\s*/)
          .includes(trait);
  const qualify = (s: GameState, e: Effect) => ({
    actorId: s.activePlayerId,
    ...e,
  });
  f.ports = {
    queue: (s, ...effects) =>
      s.queue.unshift(...effects.map((e) => qualify(s, e))),
    choose: (s, title, text, options) => {
      s.prompt = {
        kind: "choice",
        title,
        text,
        options: options.map((o) => ({
          ...o,
          effects: o.effects.map((e) => qualify(s, e)),
        })),
      };
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    cardCost: (_s, p) => Number(cards.get(p.code)?.cost || 0),
    canPay: (s, cost, _exclude, _target, req) =>
      !s.flags.cannotPay &&
      cost <= Number(s.flags.available ?? 10) &&
      (!req?.length || !!s.flags.mentalAvailable),
    maxHeroHP: () => 11,
    canReady: (s, id) =>
      !s.flags[`cannotReady:${id}`] &&
      (id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player.exhausted
        : !!targetPiece(s, id)?.exhausted),
    hasTrait,
    friendlyTargets: (s) => [
      ...s.players.map((seat) => ({
        id: `hero:${seat.id}`,
        label: seat.heroId,
      })),
      ...s.players.flatMap((seat) =>
        seatView(s, seat)
          .player.inPlay.filter((p) => cards.get(p.code)?.type_code === "ally")
          .map((p) => ({
            id: p.id,
            label: cards.get(p.code)!.name,
            code: p.code,
          })),
      ),
    ],
    enemyTargets: (s) => [
      { id: s.villain.id, label: "Rhino" },
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    canPutAlly: (s, p, playerId) =>
      !s.flags[`cannotPut:${p.id}`] &&
      !seatView(s, playerId).player.inPlay.some(
        (a) => cards.get(a.code)?.name === cards.get(p.code)?.name,
      ),
    canPayKeepingAllies: (s, _event, pair) =>
      !s.flags.cannotPay && !pair.some((p) => !!s.flags[`mustSpend:${p.id}`]),
    canPlayWithDiscount: (s, p, discount) =>
      !s.flags[`cannotPlay:${p.id}`] &&
      Number(cards.get(p.code)?.cost || 0) - discount <=
        Number(s.flags.available ?? 10) &&
      (p.code !== "26036" || !s.player.exhausted),
    playFromHandDiscount: (s, id, discount, after) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing actual hand piece");
      const p = s.player.hand.splice(i, 1)[0];
      s.player.inPlay.push(p);
      f.history.push(`play:${p.id}:${discount}`);
      f.ports.queue(s, ...after);
    },
    putAlliesFromHand: (s, choices, after) => {
      const moved: Piece[] = [];
      for (const choice of choices) {
        const v = seatView(s, choice.playerId),
          i = v.player.hand.findIndex((p) => p.id === choice.id);
        if (i < 0) throw Error("Missing actual ally");
        const p = v.player.hand.splice(i, 1)[0];
        v.player.inPlay.push(p);
        moved.push(p);
      }
      f.batches.push(moved.map((p) => p.id));
      f.history.push(`put-batch:${moved.length}`);
      f.ports.queue(s, ...after);
    },
    transferControl: (s, id, playerId) => {
      let p: Piece | undefined;
      for (const seat of s.players) {
        const v = seatView(s, seat),
          i = v.player.inPlay.findIndex((p) => p.id === id);
        if (i >= 0) p = v.player.inPlay.splice(i, 1)[0];
      }
      if (!p) throw Error("Missing actual controlled card");
      seatView(s, playerId).player.inPlay.push(p);
    },
    attach: (s, id, target) => {
      targetPiece(s, id)!.attachedTo = target;
    },
    discardPiece: (s, id) => {
      for (const seat of s.players) {
        const v = seatView(s, seat),
          i = v.player.inPlay.findIndex((p) => p.id === id);
        if (i >= 0) {
          v.player.discard.push(v.player.inPlay.splice(i, 1)[0]);
          return;
        }
      }
    },
    shufflePlayerDeck: (s, after) => {
      f.history.push(`shuffle:${s.activePlayerId}`);
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      f.ports.queue(s, ...after);
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      f.history.push(`search:${s.activePlayerId}`);
    },
    canUseDefense: (s, _p, inAttack) =>
      !s.flags.defenseForbidden && (!inAttack || !s.flags.intangible),
    pendingBoosts: (s) => s.attack?.pendingBoosts || [],
    discardBoostBeforeFlip: (s, id) => {
      const z = s.attack!.pendingBoosts!,
        i = z.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing actual facedown boost");
      s.encounter.discard.push(z.splice(i, 1)[0]);
      f.history.push(`boost-discard:${id}`);
    },
    claimDefense: (_s, packet) => {
      f.history.push(packet?.attack ? "claim-defense" : "claim");
    },
    preventDamage: (_s, amount) => {
      f.prevention.push(amount);
    },
  };
  const pump = () => {
    let n = 0;
    while (!f.s.prompt && f.s.queue.length) {
      if (++n > 200) throw Error("Fixture continuation loop");
      const e = f.s.queue.shift()!,
        actor = f.s.activePlayerId;
      if (e.actorId) activateSeat(f.s, e.actorId);
      try {
        if (resolveVisionPackEffect(f.s, e, f.ports)) continue;
        switch (e.type) {
          case "optional":
            f.ports.choose(f.s, e.title, e.text, [
              { id: "yes", label: "Yes", effects: e.effects },
              { id: "no", label: "No", effects: [] },
            ]);
            break;
          case "ready":
            if (e.target.startsWith("hero:"))
              seatView(f.s, e.target.slice(5)).player.exhausted = false;
            else {
              const p = targetPiece(f.s, e.target);
              if (p && !f.s.flags[`cannotReady:${p.id}`]) p.exhausted = false;
            }
            break;
          case "heal":
            if (e.target.startsWith("hero:")) {
              const p = seatView(f.s, e.target.slice(5)).player;
              p.hp = Math.min(11, p.hp + e.amount);
            } else {
              const p = targetPiece(f.s, e.target);
              if (p) p.damage = Math.max(0, p.damage - e.amount);
            }
            break;
          case "damage":
            f.packets.push(e);
            if (e.target === f.s.villain.id) f.s.villain.hp -= e.amount;
            else {
              const p = f.s.minions.find((p) => p.id === e.target);
              if (p) p.damage += e.amount;
            }
            break;
          case "payRequest":
            f.s.prompt = {
              kind: "payment",
              title: e.title,
              text: "Native payment",
              options: [],
              cost: e.cost,
              requirements: e.requirements,
              card: e.piece,
              after: e.after,
              paymentCommit: e.paymentCommit,
              abilityCost: e.abilityCost,
              cancelable: e.cancelable,
              cancellationQueue: e.cancellationQueue,
            };
            break;
          case "resolveHandEvent": {
            let p = f.s.player.hand.find((p) => p.id === e.id);
            if (p) f.s.player.hand.splice(f.s.player.hand.indexOf(p), 1);
            else p = visionPackTakeStoredForPlay(f.s, e.id, f.ports);
            if (!p) throw Error("Missing actual event");
            f.s.resolving.push(p);
            f.ports.queue(
              f.s,
              ...e.after.map((a: Effect) => ({
                ...a,
                paid: e.paid,
                paidForCard: e.paidForCard,
              })),
              { type: "fixture:finish", piece: p },
              ...e.continuation,
            );
            break;
          }
          case "fixture:finish":
            f.s.resolving = f.s.resolving.filter((p) => p.id !== e.piece.id);
            f.s.player.discard.push(e.piece);
            f.history.push(`event:${e.piece.id}`);
            break;
          case "fixture:after":
            f.history.push("after");
            f.packets.push(e);
            break;
          default:
            throw Error(`Missing fixture effect ${e.type}`);
        }
      } finally {
        activateSeat(f.s, actor);
      }
    }
    return f.s;
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    return pump();
  };
  const choose = (id: string) => {
    f.s = save(f.s);
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    f.ports.queue(f.s, ...o!.effects);
    return pump();
  };
  const pay = (paid: Resource[] = [], paidForCard: Resource[] = paid) => {
    f.s = save(f.s);
    const p = f.s.prompt!;
    expect(p.kind).toBe("payment");
    f.s.prompt = null;
    f.ports.queue(
      f.s,
      ...(p.paymentCommit || []),
      ...(p.after || []).map((e) => ({ ...e, paid, paidForCard })),
    );
    return pump();
  };
  const put = (code: string, owner = f.s.activePlayerId) => {
    const p = piece(code, owner);
    seatView(f.s, owner).player.inPlay.push(p);
    return p;
  };
  const attack = () => {
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      targetPlayerId: "p1",
      pendingBoosts: [],
    };
  };
  return { f, piece, put, run, choose, pay, attack };
}

describe("Vision player pack physical boundary", () => {
  it("declares thirteen actual-code adapters and six exact Core reprints", () => {
    expect(VISION_PACK_SCRIPT_CODES).toHaveLength(13);
    expect(VISION_PACK_CORE_ALIASES).toHaveLength(6);
    expect(
      new Set([...VISION_PACK_SCRIPT_CODES, ...VISION_PACK_CORE_ALIASES]).size,
    ).toBe(19);
    for (const code of [
      ...VISION_PACK_SCRIPT_CODES,
      ...VISION_PACK_CORE_ALIASES,
    ])
      expect(cards.get(code)?.pack_code).toBe("vision");
  });
  it.each([
    ["26017", "01082"],
    ["26020", "01078"],
    ["26023", "01091"],
    ["26025", "01088"],
    ["26026", "01089"],
    ["26027", "01090"],
  ])("%s retains exact Core mechanics of %s", (code, base) => {
    for (const field of [
      "cost",
      "type_code",
      "faction_code",
      "traits",
      "attack",
      "thwart",
      "defense",
      "health",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
    ]) {
      expect(
        (cards.get(code) as unknown as Record<string, unknown>)[field],
      ).toEqual((cards.get(base) as unknown as Record<string, unknown>)[field]);
    }
  });
  it("uses dedicated raw adapters for reprinted Side Step and Preservation", () => {
    expect(VISION_PACK_SCRIPT_CODES).toContain("26019");
    expect(VISION_PACK_SCRIPT_CODES).toContain("26021");
    expect(VISION_PACK_CORE_ALIASES).not.toContain("26019");
    expect(VISION_PACK_CORE_ALIASES).not.toContain("26021");
  });
});

describe("Jocasta actual facedown Defense events", () => {
  it("responds to entry, including PUT, and selects only actual discarded Defense events", () => {
    const { f, put, piece, run, choose } = fixture(),
      source = put("26013"),
      event = piece("26012"),
      other = piece("26008");
    f.s.player.discard.push(event, other);
    run(...visionPackAllyEnter(f.s, source, f.ports)!);
    choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([event.id]);
    choose(event.id);
    expect(visionPackStoredPlayable(f.s, f.ports).map((p) => p.id)).toEqual([
      event.id,
    ]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([other.id]);
  });
  it("a serialized Jocasta retains the event's physical ID and owner", () => {
    const { f, put, piece } = fixture(),
      source = put("26013"),
      event = piece("26018");
    source.storedCards = [event];
    f.s = save(f.s);
    expect(visionPackTakeStoredForPlay(f.s, event.id, f.ports)).toMatchObject({
      id: event.id,
      ownerId: "p1",
      code: "26018",
    });
    expect(visionPackTakeStoredForPlay(f.s, event.id, f.ports)).toBeUndefined();
  });
  it("blanked Jocasta cannot provide stored events and preserves them physically", () => {
    const { f, put, piece } = fixture(),
      source = put("26013"),
      event = piece("26019");
    source.storedCards = [event];
    f.s.flags[`blank:${source.id}`] = true;
    expect(visionPackStoredPlayable(f.s, f.ports)).toEqual([]);
    expect(visionPackTakeStoredForPlay(f.s, event.id, f.ports)).toBeUndefined();
    expect(source.storedCards.map((p) => p.id)).toEqual([event.id]);
  });
  it("stored events are added to the proper physical interrupt sources without becoming hand cards", () => {
    const { f, put, piece } = fixture(),
      source = put("26013"),
      stored = piece("26019"),
      hand = piece("26018");
    source.storedCards = [stored];
    f.s.player.hand.push(hand);
    expect(visionPackDefenseEvents(f.s, f.ports).map((p) => p.id)).toEqual([
      hand.id,
      stored.id,
    ]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([hand.id]);
  });
  it("cannot attach a hand card or a discarded non-Defense event", () => {
    const { f, put, piece } = fixture(),
      source = put("26013"),
      event = piece("26008");
    f.s.player.discard.push(event);
    expect(visionPackAllyEnter(f.s, source, f.ports)).toEqual([]);
    expect(() =>
      resolveVisionPackEffect(
        f.s,
        P("jocasta-card", { source: source.id, id: event.id }),
        f.ports,
      ),
    ).toThrow(/original Defense/);
  });
});

describe("Protector and Victor Mancha damage", () => {
  it("Protector spends one actual Mental resource and marks its round limit at cost commit", () => {
    const { f, put, run, pay } = fixture(),
      p = put("26014");
    f.s.flags.mentalAvailable = true;
    const window = {
      target: p.id,
      amount: 2,
      packet: { type: "damage", target: p.id, amount: 2 },
    };
    const choices = visionPackDamageOptions(f.s, window, [], f.ports);
    run(...choices[0].effects);
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      requirements: ["mental"],
      abilityCost: true,
    });
    expect(f.s.flags[`visionPackProtector:${p.id}`]).toBeUndefined();
    pay(["mental"]);
    expect(f.s.flags[`visionPackProtector:${p.id}`]).toBe(f.s.round);
    expect(f.prevention).toEqual([1]);
    expect(visionPackDamageOptions(f.s, window, [], f.ports)).toEqual([]);
  });
  it("Protector only offers affordable unblanked positive damage before Tough", () => {
    const { f, put } = fixture(),
      p = put("26014"),
      w = { target: p.id, amount: 1 };
    expect(visionPackDamageOptions(f.s, w, [], f.ports)).toEqual([]);
    f.s.flags.mentalAvailable = true;
    p.tough = true;
    expect(visionPackDamageOptions(f.s, w, [], f.ports)).toEqual([]);
    p.tough = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(visionPackDamageOptions(f.s, w, [], f.ports)).toEqual([]);
    delete f.s.flags[`blank:${p.id}`];
    expect(
      visionPackDamageOptions(f.s, { ...w, amount: 0 }, [], f.ports),
    ).toEqual([]);
  });
  it("Protector's physical reentry and next round release its own limit", () => {
    const { f, put } = fixture(),
      p = put("26014");
    f.s.flags.mentalAvailable = true;
    f.s.flags[`visionPackProtector:${p.id}`] = f.s.round;
    visionPackCardLeftPlay(f.s, p);
    expect(
      visionPackDamageOptions(f.s, { target: p.id, amount: 1 }, [], f.ports),
    ).toHaveLength(1);
    f.s.flags[`visionPackProtector:${p.id}`] = f.s.round;
    f.s.round++;
    expect(
      visionPackDamageOptions(f.s, { target: p.id, amount: 1 }, [], f.ports),
    ).toHaveLength(1);
  });
  it("a teammate's Protector interrupt retains its actual controller for typed payment", () => {
    const { f, put } = fixture(true),
      p = put("26014", "p2");
    seatView(f.s, "p2").flags.mentalAvailable = true;
    const o = visionPackDamageOptions(
      f.s,
      { target: p.id, amount: 2 },
      [],
      f.ports,
    );
    expect(o[0].effects[0].actorId).toBe("p2");
  });
  it("Victor Mancha supplies one constant attack reduction while unblanked", () => {
    const { f, put } = fixture(),
      p = put("26015");
    expect(visionPackAttackDamageReduction(f.s, p, f.ports)).toBe(1);
    f.s.flags[`blank:${p.id}`] = true;
    expect(visionPackAttackDamageReduction(f.s, p, f.ports)).toBe(0);
  });
});

describe("Flow Like Water control and actual PLAY", () => {
  it("can enter under another player's control while preserving its physical owner", () => {
    const { f, put, run, choose } = fixture(true),
      p = put("26016");
    run(...visionPackCardEntered(f.s, p));
    choose("p2");
    expect(seatView(f.s, "p2").player.inPlay.map((p) => p.id)).toEqual([p.id]);
    expect(seatView(f.s, "p2").player.inPlay[0].ownerId).toBe("p1");
  });
  it("enforces max one per player before resource payment", () => {
    const { f, put, piece } = fixture(true);
    put("26016", "p1");
    put("26016", "p2");
    expect(visionPackPlayRestriction(f.s, piece("26016"), f.ports)).toMatch(
      /already controls/,
    );
  });
  it("responds only to PLAY of a Defense-traited card, using the actual attacker", () => {
    const { f, put, piece, run, choose } = fixture(),
      flow = put("26016"),
      enemy = piece("26029");
    f.s.minions.push(enemy);
    expect(
      visionPackCardPlayed(f.s, piece("26008"), enemy.id, f.ports),
    ).toEqual([]);
    run(...visionPackCardPlayed(f.s, piece("26018"), enemy.id, f.ports));
    choose("yes");
    expect(f.packets[0]).toMatchObject({
      target: enemy.id,
      amount: 1,
      source: flow.id,
      attack: false,
    });
    expect(f.s.villain.hp).toBe(50);
  });
  it("does not infer an attacker for nonattack Defense-card play", () => {
    const { f, put, piece } = fixture();
    put("26016");
    expect(
      visionPackCardPlayed(f.s, piece("26019"), undefined, f.ports),
    ).toEqual([]);
  });
  it("blanking disables Flow Like Water's actual response", () => {
    const { f, put, piece } = fixture(),
      p = put("26016");
    f.s.flags[`blank:${p.id}`] = true;
    expect(
      visionPackCardPlayed(f.s, piece("26018"), f.s.villain.id, f.ports),
    ).toEqual([]);
  });
});

describe("Defiance before actual boost flip", () => {
  it("discards the whole facedown boost without revealing its icons or ability", () => {
    const { f, piece, attack, run, pay } = fixture();
    attack();
    const boost = piece("01103"),
      event = piece("26018");
    f.s.attack!.pendingBoosts!.push(boost);
    f.s.player.hand.push(event);
    const before = f.s.hiddenInfo;
    run(...visionPackBoostOptions(f.s, boost.id, [], f.ports)[0].effects);
    pay();
    expect(f.s.attack!.pendingBoosts).toEqual([]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([boost.id]);
    expect(f.s.hiddenInfo).toBe(before);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([event.id]);
  });
  it("Jocasta can supply the same physical Defiance from its facedown storage", () => {
    const { f, put, piece, attack, run, pay } = fixture();
    attack();
    const boost = piece("01103"),
      source = put("26013"),
      event = piece("26018");
    source.storedCards = [event];
    f.s.attack!.pendingBoosts!.push(boost);
    run(...visionPackBoostOptions(f.s, boost.id, [], f.ports)[0].effects);
    pay();
    expect(f.s.player.inPlay[0].storedCards).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([event.id]);
  });
  it("cannot act after the boost turned faceup, in AE, or while defense is prohibited", () => {
    const { f, piece, attack } = fixture();
    attack();
    const boost = piece("01103"),
      event = piece("26018");
    f.s.player.hand.push(event);
    expect(visionPackBoostOptions(f.s, boost.id, [], f.ports)).toEqual([]);
    f.s.attack!.pendingBoosts!.push(boost);
    f.s.player.form = "alter";
    expect(visionPackBoostOptions(f.s, boost.id, [], f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags.intangible = true;
    expect(visionPackBoostOptions(f.s, boost.id, [], f.ports)).toEqual([]);
  });
});

describe("Side Step and Preservation actual-code reprints", () => {
  it.each([true, false])(
    "Side Step uses actual paid-for-card Energy (Energy=%s)",
    (energy) => {
      const { f, piece, run, pay } = fixture(),
        event = piece("26019"),
        enemy = piece("26029");
      f.s.minions.push(enemy);
      f.s.player.hand.push(event);
      const window = {
        target: "hero:p1",
        amount: 2,
        source: enemy.id,
        inAttack: true,
        packet: { type: "damage", target: "hero:p1", amount: 2, attack: true },
      };
      run(...visionPackDamageOptions(f.s, window, [], f.ports)[0].effects);
      pay(energy ? ["energy"] : ["mental"]);
      expect(f.prevention).toEqual([3]);
      expect(f.packets).toHaveLength(energy ? 1 : 0);
      if (energy) expect(f.packets[0].target).toBe(enemy.id);
    },
  );
  it("does not treat overpaid Energy as paid-for-card Energy", () => {
    const { f, piece, run, pay } = fixture(),
      event = piece("26019");
    f.s.player.hand.push(event);
    run(
      ...visionPackDamageOptions(
        f.s,
        { target: "hero:p1", amount: 2, source: f.s.villain.id },
        [],
        f.ports,
      )[0].effects,
    );
    pay(["mental", "energy"], ["mental"]);
    expect(f.prevention).toEqual([3]);
    expect(f.packets).toEqual([]);
  });
  it("Intangible permits Side Step outside an attack but prohibits it in an attack window", () => {
    const { f, piece } = fixture(),
      event = piece("26019");
    f.s.player.hand.push(event);
    f.s.flags.intangible = true;
    expect(
      visionPackDamageOptions(
        f.s,
        { target: "hero:p1", amount: 1, inAttack: false },
        [],
        f.ports,
      ),
    ).toHaveLength(1);
    expect(
      visionPackDamageOptions(
        f.s,
        { target: "hero:p1", amount: 1, inAttack: true },
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Side Step does not invent a villain damage target for an unrelated nonattack source", () => {
    const { f, piece, run, pay } = fixture();
    f.s.player.hand.push(piece("26019"));
    run(
      ...visionPackDamageOptions(
        f.s,
        { target: "hero:p1", amount: 2, source: "some-support" },
        [],
        f.ports,
      )[0].effects,
    );
    pay(["energy"]);
    expect(f.packets).toEqual([]);
  });
  it("Preservation responds to actual SPEND only in wounded Hero form", () => {
    const { f, piece, run, choose } = fixture(),
      p = piece("26021");
    f.s.player.hp = 9;
    run(...visionPackResourcesSpent(f.s, [p], f.ports));
    choose("yes");
    expect(f.s.player.hp).toBe(10);
    f.s.player.form = "alter";
    expect(visionPackResourcesSpent(f.s, [p], f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.player.hp = 11;
    expect(visionPackResourcesSpent(f.s, [p], f.ports)).toEqual([]);
    expect(visionPackResourcesSpent(f.s, [piece("26025")], f.ports)).toEqual(
      [],
    );
  });
});

describe("Machine Man resources for one actual use", () => {
  it.each(["attack", "thwart"] as const)(
    "adds a saved bonus for exactly one %s continuation",
    (action) => {
      const { f, put, run, pay } = fixture(),
        p = put("26022"),
        after = [{ type: "fixture:after", action }];
      run(
        ...visionPackAllyUseOptions(f.s, p, action, after, f.ports)[2].effects,
      );
      expect(f.s.prompt).toMatchObject({
        kind: "payment",
        cost: 3,
        abilityCost: true,
        cancelable: true,
      });
      pay(["energy", "mental", "physical"]);
      expect(f.packets[0]).toMatchObject({
        visionPackMachineBonus: 3,
        visionPackMachineId: p.id,
        visionPackMachineAction: action,
      });
      expect(p.bonusAtk).toBeUndefined();
      expect(p.bonusThw).toBeUndefined();
    },
  );
  it("offers only one to three affordable resources, with decline handled by the native window", () => {
    const { f, put } = fixture(),
      p = put("26022");
    f.s.flags.available = 2;
    expect(
      visionPackAllyUseOptions(f.s, p, "attack", [], f.ports).map((o) => o.id),
    ).toEqual(["1", "2"]);
    f.s.flags.available = 0;
    expect(visionPackAllyUseOptions(f.s, p, "attack", [], f.ports)).toEqual([]);
  });
  it.each(["attack", "thwart"] as const)(
    "does not pay an interrupt for a status-replaced %s",
    (action) => {
      const { f, put } = fixture(),
        p = put("26022");
      if (action === "attack") p.stunned = true;
      else p.confused = true;
      expect(visionPackAllyUseOptions(f.s, p, action, [], f.ports)).toEqual([]);
    },
  );
});

describe("Reboot actual friendly Androids", () => {
  it("readies and heals the same actual Android ally across a saved selection", () => {
    const { f, put, piece, run, choose } = fixture(),
      ally = put("26015");
    ally.exhausted = true;
    ally.damage = 2;
    run(...visionPackEvent(f.s, piece("26024"))!);
    choose(ally.id);
    expect(f.s.player.inPlay[0]).toMatchObject({
      id: ally.id,
      exhausted: false,
      damage: 1,
    });
  });
  it("heals a wounded Android identity even when readying is unavailable", () => {
    const { f, piece, run, choose } = fixture();
    f.s.player.hp = 8;
    f.s.flags["cannotReady:hero:p1"] = true;
    run(...visionPackEvent(f.s, piece("26024"))!);
    choose("hero:p1");
    expect(f.s.player.hp).toBe(9);
  });
  it("supports AE Androids but rejects a ready undamaged character or a non-Android", () => {
    const { f, piece } = fixture(true);
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    expect(visionPackPlayRestriction(f.s, piece("26024"), f.ports)).toBeNull();
    f.s.player.exhausted = false;
    expect(visionPackPlayRestriction(f.s, piece("26024"), f.ports)).toMatch(
      /ready or heal/,
    );
  });
});

describe("Assault Training and Chance Encounter", () => {
  it("initializes two training counters and uses the actual Aggression event", () => {
    const { f, put, piece, run, choose } = fixture(),
      source = put("26033"),
      event = piece("01052");
    f.s.player.form = "alter";
    visionPackCardEntered(f.s, source);
    f.s.player.discard.push(event, piece("26008"));
    expect(source.counters).toBe(2);
    visionPackAbility(f.s, source.id, f.ports);
    run();
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([event.id]);
    choose(event.id);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([event.id]);
    expect(f.s.player.inPlay[0]).toMatchObject({
      exhausted: true,
      counters: 1,
    });
    expect(f.history).toEqual(["shuffle:p1"]);
  });
  it("last training counter discards the physical Uses support before shuffling its event", () => {
    const { f, put, piece, run, choose } = fixture(),
      source = put("26033"),
      event = piece("01052");
    f.s.player.form = "alter";
    source.counters = 1;
    f.s.player.discard.push(event);
    visionPackAbility(f.s, source.id, f.ports);
    run();
    choose(event.id);
    expect(f.s.player.inPlay).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([source.id]);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([event.id]);
  });
  it("training cannot consume a counter in Hero form or for a non-Aggression event", () => {
    const { f, put, piece } = fixture(),
      p = put("26033");
    p.counters = 2;
    f.s.player.discard.push(piece("01052"));
    expect(visionPackAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.s.player.discard = [piece("26008")];
    expect(visionPackAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(p.counters).toBe(2);
  });
  it("Chance Encounter attaches to one actual side scheme and enforces max one per scheme", () => {
    const { f, put, piece, run, choose } = fixture(),
      a = put("26034"),
      scheme = piece("01109");
    f.s.sideSchemes.push(scheme);
    run(...visionPackCardEntered(f.s, a));
    choose(scheme.id);
    expect(f.s.player.inPlay[0].attachedTo).toBe(scheme.id);
    expect(visionPackAttachmentTargets(f.s, piece("26034"))).toEqual([]);
  });
  it("Chance Encounter's interrupt searches its actual controller's zones before scheme cleanup", () => {
    const { f, put, piece, run, choose } = fixture(true),
      a = put("26034", "p2"),
      scheme = piece("01109"),
      ally = piece("26013", "p2");
    a.attachedTo = scheme.id;
    f.s.sideSchemes.push(scheme);
    seatView(f.s, "p2").player.discard.push(ally);
    run(...visionPackSchemeDefeating(f.s, scheme, f.ports));
    choose("yes");
    choose(ally.id);
    expect(seatView(f.s, "p2").player.hand.map((p) => p.id)).toEqual([ally.id]);
    expect(f.s.player.hand).toEqual([]);
    expect(f.history).toEqual(["search:p2", "shuffle:p2"]);
  });
  it("Chance Encounter shuffles after a failed ally search", () => {
    const { f, put, piece, run, choose } = fixture(),
      a = put("26034"),
      scheme = piece("01109");
    a.attachedTo = scheme.id;
    run(...visionPackSchemeDefeating(f.s, scheme, f.ports));
    choose("yes");
    expect(f.history).toEqual(["search:p1", "shuffle:p1"]);
  });
});

describe("Joining Forces actual retained Alliance pair", () => {
  it("requires two distinct actual allies and retains them while paying", () => {
    const { f, piece } = fixture(),
      a = piece("01083"),
      b = piece("23014"),
      event = piece("26035");
    f.s.player.hand.push(a, b, event);
    expect(visionPackJoiningPairs(f.s, f.ports)).toEqual([]);
    const guardian = [...cards.values()].find(
      (c) =>
        c.type_code === "ally" &&
        (c.traits || "").split(/\.\s*/).includes("Guardian"),
    )!;
    const g = piece(guardian.code);
    f.s.player.hand.push(g);
    expect(visionPackJoiningPairs(f.s, f.ports).length).toBeGreaterThan(0);
    expect(visionPackPaymentAllowed(f.s, event, [a.id, b.id], f.ports)).toBe(
      false,
    );
    expect(visionPackPaymentAllowed(f.s, event, [], f.ports)).toBe(true);
  });
  it("one actual Guardian cannot occupy two physical ally slots", () => {
    const { f, piece } = fixture(),
      guardian = [...cards.values()].find(
        (c) =>
          c.type_code === "ally" &&
          (c.traits || "").split(/\.\s*/).includes("Guardian"),
      )!;
    f.s.player.hand.push(piece(guardian.code));
    expect(visionPackJoiningPairs(f.s, f.ports)).toEqual([]);
  });
  it("puts both actual owners' allies into play as one native batch before entry responses", () => {
    const { f, piece, run, choose } = fixture(true),
      a = piece("26013", "p1"),
      gdef = [...cards.values()].find(
        (c) =>
          c.type_code === "ally" &&
          (c.traits || "").split(/\.\s*/).includes("Guardian"),
      )!,
      g = piece(gdef.code, "p2");
    f.s.player.hand.push(a);
    seatView(f.s, "p2").player.hand.push(g);
    run(...visionPackEvent(f.s, piece("26035"))!);
    choose(`${a.id}|${g.id}`);
    expect(f.batches).toEqual([[a.id, g.id]]);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([a.id]);
    expect(seatView(f.s, "p2").player.inPlay.map((p) => p.id)).toEqual([g.id]);
    expect(seatView(f.s, "p2").player.inPlay[0].ownerId).toBe("p2");
  });
  it("refuses payment that must consume the remaining required hand ally", () => {
    const { f, piece } = fixture(),
      a = piece("26013"),
      gdef = [...cards.values()].find(
        (c) =>
          c.type_code === "ally" &&
          (c.traits || "").split(/\.\s*/).includes("Guardian"),
      )!,
      g = piece(gdef.code);
    f.s.player.hand.push(a, g);
    f.s.flags[`mustSpend:${a.id}`] = true;
    expect(visionPackPlayRestriction(f.s, piece("26035"), f.ports)).toMatch(
      /retain its two/,
    );
  });
  it("Joining Forces requires Hero form", () => {
    const { f, piece } = fixture();
    f.s.player.form = "alter";
    expect(visionPackPlayRestriction(f.s, piece("26035"), f.ports)).toMatch(
      /hero form/,
    );
  });
});

describe("Meditation actual additional exhaust and discounted PLAY", () => {
  it("pays AE exhaustion before choosing the actual discounted card", () => {
    const { f, piece, run, choose } = fixture(),
      event = piece("26036"),
      target = piece("26013");
    f.s.player.form = "alter";
    f.s.player.hand.push(event, target);
    const after = visionPackEvent(f.s, event, { meditationCostPaid: true })!;
    run(...visionPackBeforeEvent(f.s, event, after)!);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([target.id]);
    choose(target.id);
    expect(f.history).toEqual([`play:${target.id}:3`]);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([target.id]);
  });
  it("cannot bypass the actual exhaust cost by directly invoking Meditation's body", () => {
    const { f, piece } = fixture(),
      event = piece("26036");
    f.s.player.form = "alter";
    f.s.player.hand.push(piece("26013"));
    expect(() =>
      resolveVisionPackEffect(f.s, visionPackEvent(f.s, event)![0], f.ports),
    ).toThrow(/actual playable/);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("an exhausted AE or unplayable discounted card makes Meditation unavailable before any cost", () => {
    const { f, piece } = fixture(),
      event = piece("26036"),
      target = piece("26013");
    f.s.player.form = "alter";
    f.s.player.hand.push(event, target);
    f.s.player.exhausted = true;
    expect(visionPackPlayRestriction(f.s, event, f.ports)).toMatch(
      /ready alter/,
    );
    f.s.player.exhausted = false;
    f.s.flags[`cannotPlay:${target.id}`] = true;
    expect(visionPackPlayRestriction(f.s, event, f.ports)).toMatch(
      /another playable/,
    );
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Meditation cannot fund or choose itself as its own other card", () => {
    const { f, piece } = fixture(),
      event = piece("26036");
    f.s.player.form = "alter";
    f.s.player.hand.push(event);
    expect(visionPackPlayRestriction(f.s, event, f.ports)).toMatch(
      /another playable/,
    );
  });
});
