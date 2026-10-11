import { describe, expect, it } from "vitest";
import raw from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import * as pack from "../src/game/spider-ham-pack.js";

const cards = new Map((raw as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
function save(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  const seat = copy.players.find((p) => p.id === copy.activePlayerId)!;
  seat.player = copy.player;
  seat.flags = copy.flags;
  return copy;
}
function physical(s: GameState): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const v = seatView(s, seat).player;
      return [...v.deck, ...v.hand, ...v.discard, ...v.inPlay];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
  ];
}
function expectPhysical(s: GameState, ids: string[]) {
  const actual = physical(s).map((p) => p.id);
  expect(actual.slice().sort()).toEqual(ids.slice().sort());
  expect(new Set(actual).size).toBe(actual.length);
}

function initialState() {
  const s = newGame({
    heroId: "rocket",
    aspect: "justice",
    villainId: "rhino",
    seed: 30012,
    pacing: "expert",
    heroes: [
      { heroId: "rocket", aspect: "justice" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.heroId = s.players[0].heroId = "spider_ham";
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
    v.player.stunned = v.player.confused = v.player.tough = false;
    seat.flags = {};
  }
  s.flags = s.players[0].flags;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 10;
  return s;
}

function fixture() {
  const f = {
    s: initialState(),
    ports: {} as pack.SpiderHamPackPorts,
    history: [] as string[],
    packets: [] as Effect[],
  };
  const targetPiece = (s: GameState, id: string) =>
    allInPlay(s).find((p) => p.id === id);
  const qualify = (s: GameState, e: Effect): Effect => ({
    actorId: s.activePlayerId,
    ...e,
  });
  const piece = (code: string, owner = f.s.activePlayerId): Piece => ({
    ...makePiece(f.s, code),
    ownerId: owner,
  });
  const put = (
    code: string,
    controller = f.s.activePlayerId,
    owner = controller,
  ) => {
    const p = piece(code, owner);
    seatView(f.s, controller).player.inPlay.push(p);
    return p;
  };
  const side = (threat = 4) => {
    const p = piece("01107");
    p.counters = threat;
    f.s.sideSchemes.push(p);
    return p;
  };
  const traits = (s: GameState, p: Piece) => [
    ...(s.flags[`traits:${p.id}`] === undefined
      ? (cards.get(p.code)?.traits || "")
          .split(/\.\s*/)
          .map((t) => t.trim())
          .filter(Boolean)
      : String(s.flags[`traits:${p.id}`]).split("|").filter(Boolean)),
    ...pack.spiderHamPackCharacterTraits(s, p.id, f.ports),
  ];
  const identityHasTrait = (s: GameState, trait: string) =>
    s.flags.identityTraits === undefined
      ? s.heroId === "spider_ham" &&
        s.player.form === "hero" &&
        trait === "Web-Warrior"
      : String(s.flags.identityTraits).split("|").includes(trait);
  const hasTrait = (s: GameState, id: string, trait: string) =>
    id === "hero" || id.startsWith("hero:")
      ? identityHasTrait(id === "hero" ? s : seatView(s, id.slice(5)), trait) ||
        pack.spiderHamPackCharacterTraits(s, id, f.ports).includes(trait)
      : !!targetPiece(s, id) && traits(s, targetPiece(s, id)!).includes(trait);
  const remove = (s: GameState, target: string, amount: number) => {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (target === "main")
      s.scheme.threat = Math.max(0, s.scheme.threat - amount);
    else if (p) p.counters = Math.max(0, p.counters - amount);
  };
  const defeatSchemes = (s: GameState, ids: string[]) => {
    for (const id of ids) {
      const i = s.sideSchemes.findIndex((p) => p.id === id);
      if (i >= 0) s.encounter.discard.push(s.sideSchemes.splice(i, 1)[0]);
      for (const p of allInPlay(s).filter((p) => p.attachedTo === id)) {
        const seat = s.players.find((seat) =>
          seatView(s, seat).player.inPlay.some((a) => a.id === p.id),
        )!;
        const v = seatView(s, seat),
          index = v.player.inPlay.findIndex((a) => a.id === p.id);
        seatView(s, p.ownerId || seat.id).player.discard.push(
          v.player.inPlay.splice(index, 1)[0],
        );
      }
    }
  };
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
    isTextBlank: (s, p) =>
      s.players.some((seat) => !!seatView(s, seat).flags[`blank:${p.id}`]),
    traits,
    hasTrait,
    controlledTraitCards: (s, t) => [
      ...(hasTrait(s, `hero:${s.activePlayerId}`, t)
        ? [{ id: `hero:${s.activePlayerId}`, label: s.heroId }]
        : []),
      ...s.player.inPlay
        .filter((p) => traits(s, p).includes(t))
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    characterTargets: (s) => [
      ...s.players
        .filter((seat) => !seat.eliminated)
        .map((seat) => ({
          id: `hero:${seat.id}`,
          label:
            seatView(s, seat).player.form === "hero"
              ? seat.heroId === "spider_ham"
                ? "Spider-Ham"
                : "Spider-Man"
              : "Peter Parker",
        })),
      ...allInPlay(s)
        .filter((p) => cards.get(p.code)?.type_code === "ally")
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    schemeTargets: (s) => [
      ...(s.scheme.threat > 0 ? [{ id: "main", label: "main" }] : []),
      ...s.sideSchemes
        .filter((p) => p.counters > 0 && !s.flags[`cannotThwart:${p.id}`])
        .map((p) => ({ id: p.id, label: "side", code: p.code })),
    ],
    enemyTargets: (s) => [
      { id: s.villain.id, label: "Rhino" },
      ...s.minions.map((p) => ({ id: p.id, label: "minion", code: p.code })),
    ],
    cardCost: (_s, p) => Number(cards.get(p.code)?.cost || 0),
    canPay: (s, cost, requirements) =>
      !s.flags.cannotPay &&
      cost <= Number(s.flags.available ?? 10) &&
      (!requirements?.includes("energy") || !!s.flags.energyAvailable),
    canPlayWithDiscount: (s, p, discount) =>
      !s.flags[`cannotPlay:${p.id}`] &&
      Math.max(0, Number(cards.get(p.code)?.cost || 0) - discount) <=
        Number(s.flags.available ?? 10),
    playFromHand: (s, id, discount, after) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      expect(i).toBeGreaterThanOrEqual(0);
      const p = s.player.hand.splice(i, 1)[0];
      if (s.flags.cancelPlay) s.player.hand.push(p);
      else s.player.inPlay.push(p);
      f.history.push(`play:${id}:${discount}`);
      f.ports.queue(s, ...after);
    },
    discardControlled: (s, id, after) => {
      const i = s.player.inPlay.findIndex((p) => p.id === id);
      expect(i).toBeGreaterThanOrEqual(0);
      const p = s.player.inPlay.splice(i, 1)[0];
      seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
      f.history.push(`discard:${id}`);
      f.ports.queue(s, ...after);
    },
    attach: (s, id, target) => {
      targetPiece(s, id)!.attachedTo = target;
    },
    removeThreat: (s, target, amount, source, after) => {
      remove(s, target, amount);
      f.history.push(`remove:${target}:${amount}:${source}`);
      f.packets.push(E("removeThreat", { target, amount, source }));
      const p = s.sideSchemes.find((p) => p.id === target && !p.counters);
      if (p) defeatSchemes(s, [p.id]);
      f.ports.queue(s, ...after);
    },
    thwartBatch: (s, targets, sourceId, after) => {
      for (const t of targets) remove(s, t.id, t.amount);
      const defeatedIds = targets
        .filter((t) =>
          s.sideSchemes.some(
            (p) =>
              p.id === t.id && !p.counters && !s.flags[`cannotDefeat:${p.id}`],
          ),
        )
        .map((t) => t.id);
      f.history.push(`batch:${targets.map((t) => t.id).join(",")}`);
      f.packets.push(E("thwartBatch", { targets, sourceId }));
      defeatSchemes(s, defeatedIds);
      f.ports.queue(s, ...after.map((e) => ({ ...e, defeatedIds })));
    },
    addBasicThwartBonus: (_s, packet, amount) => {
      packet.fixtureBonus = Number(packet.fixtureBonus || 0) + amount;
      f.history.push(`thwart-bonus:${amount}`);
    },
    playThwartInterrupt: (s, id, packet, after) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      expect(i).toBeGreaterThanOrEqual(0);
      s.player.discard.push(s.player.hand.splice(i, 1)[0]);
      f.history.push(`thwart-play:${id}`);
      f.ports.queue(s, ...after);
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      f.history.push("hidden");
    },
    revealAvailable: (s, r) =>
      s.flags.revealToken === r.token &&
      s.encounter.dealt.some((p) => p.id === r.pieceId),
    lookEncounter: (s, id) => {
      const p = s.encounter.dealt.find((p) => p.id === id)!;
      expect(p).toBeTruthy();
      f.ports.revealHidden(s);
      f.history.push(`look:${id}`);
      return cards.get(p.code)!.type_code;
    },
    revealEncounterFromDeck: (s, id, after) => {
      const i = s.encounter.deck.findIndex((p) => p.id === id);
      expect(i).toBeGreaterThanOrEqual(0);
      const p = s.encounter.deck.splice(i, 1)[0];
      s.encounter.dealt.push(p);
      f.history.push(`reveal:${id}`);
      f.ports.queue(s, ...after);
    },
    shuffleEncounter: (s, after) => {
      f.history.push("shuffle");
      f.ports.queue(s, ...after);
    },
    damageAlly: (s, id, amount, after) => {
      const p = targetPiece(s, id)!;
      expect(p).toBeTruthy();
      if (p.tough) p.tough = false;
      else p.damage += amount;
      if (p.damage >= Number(cards.get(p.code)?.health || 0)) {
        const i = s.player.inPlay.findIndex((a) => a.id === id);
        seatView(s, p.ownerId || s.activePlayerId).player.discard.push(
          s.player.inPlay.splice(i, 1)[0],
        );
      }
      f.history.push(`ally-damage:${id}:${amount}`);
      f.ports.queue(s, ...after);
    },
    returnDefeatedAlly: (s, p, ownerId) => {
      for (const seat of s.players) {
        const v = seatView(s, seat).player;
        for (const z of [v.inPlay, v.discard]) {
          const i = z.findIndex((a) => a.id === p.id);
          if (i >= 0) z.splice(i, 1);
        }
      }
      seatView(s, ownerId).player.hand.push(p);
      f.history.push(`return:${p.id}:${ownerId}`);
    },
  };
  const pump = () => {
    let n = 0;
    while (!f.s.prompt && f.s.queue.length) {
      if (++n > 200) throw Error("Fixture continuation loop");
      const e = f.s.queue.shift()!;
      const actor = f.s.activePlayerId;
      if (e.actorId) activateSeat(f.s, e.actorId);
      try {
        if (pack.resolveSpiderHamPackEffect(f.s, e, f.ports)) continue;
        switch (e.type) {
          case "optional":
            f.ports.choose(f.s, e.title, e.text, [
              { id: "yes", label: "Yes", effects: e.effects },
              { id: "no", label: "No", effects: [] },
            ]);
            break;
          case "draw":
            for (let i = 0; i < e.amount && f.s.player.deck.length; i++)
              f.s.player.hand.push(f.s.player.deck.shift()!);
            f.packets.push(e);
            f.history.push(`draw:${f.s.activePlayerId}:${e.amount}`);
            break;
          case "damage": {
            if (e.target === f.s.villain.id) f.s.villain.hp -= e.amount;
            else {
              const p =
                f.s.minions.find((p) => p.id === e.target) ||
                targetPiece(f.s, e.target);
              if (p) p.damage += e.amount;
            }
            f.packets.push(e);
            break;
          }
          case "thwart": {
            if (e.target === "main")
              f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
            else {
              const p = f.s.sideSchemes.find((p) => p.id === e.target);
              if (p) p.counters = Math.max(0, p.counters - e.amount);
            }
            f.packets.push(e);
            break;
          }
          case "heal": {
            const id =
              e.target === "hero" ? f.s.activePlayerId : e.target.slice(5);
            const p = seatView(f.s, id).player;
            p.hp = Math.min(10, p.hp + e.amount);
            f.packets.push(e);
            break;
          }
          case "fixture:after":
            f.history.push("after");
            break;
          case "fixture:thwart":
            f.packets.push(e);
            f.history.push("basic-thwart");
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
  return { f, piece, put, side, targetPiece, traits, run, choose };
}

describe("Spider-Ham player pack printed physical sources", () => {
  it("registers twelve printed adapters and one exact Core alias", () => {
    expect(pack.SPIDER_HAM_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(pack.SPIDER_HAM_PACK_CORE_ALIASES).toEqual(["30015"]);
    expect(pack.SPIDER_HAM_PACK_CORE_ALIAS_PAIRS).toEqual([["30015", "01061"]]);
    const codes = [
      ...pack.SPIDER_HAM_PACK_SCRIPT_CODES,
      ...pack.SPIDER_HAM_PACK_CORE_ALIASES,
    ];
    expect(new Set(codes).size).toBe(13);
    for (const code of codes)
      expect(cards.get(code)?.pack_code).toBe("spiderham");
  });
  it.each([
    ["30015", "01061"],
    ["30016", "20013"],
    ["30017", "22015"],
    ["30018", "03032"],
    ["30022", "12024"],
    ["30023", "27023"],
  ])("%s retains the printed mechanics of %s", (code, original) => {
    const printing = cards.get(code)!;
    expect(printing.pack_code).toBe("spiderham");
    for (const field of [
      "name",
      "type_code",
      "faction_code",
      "cost",
      "attack",
      "thwart",
      "health",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
    ])
      expect((printing as unknown as Record<string, unknown>)[field]).toEqual(
        (cards.get(original) as unknown as Record<string, unknown>)[field],
      );
  });
});

const thwart = (
  sourceId: string,
  target: string,
  overrides: Partial<pack.SpiderHamPackThwartReceipt> = {},
): pack.SpiderHamPackThwartReceipt => ({
  token: "thwart-1",
  playerId: "p1",
  sourceId,
  target,
  amount: 1,
  performed: true,
  thwart: true,
  basic: true,
  ...overrides,
});

describe("Lady Spider and Pavitr actual controlled Web-Warriors", () => {
  it("rechecks the other controlled Web-Warrior condition when the saved response is accepted", () => {
    const { f, put, side, run, choose } = fixture();
    const lady = put("30012"),
      source = side(),
      target = side();
    run(
      ...pack.spiderHamPackAllyThwarted(
        f.s,
        thwart(lady.id, source.id),
        f.ports,
      ),
    );
    f.s.flags.identityTraits = "";
    expect(() => choose("yes")).toThrow(/another controlled Web-Warrior/);
    expect(f.s.sideSchemes.find((p) => p.id === target.id)?.counters).toBe(4);
  });
  it("Lady Spider copies actual removed threat under her controller across a saved response", () => {
    const { f, put, side, run, choose } = fixture();
    const lady = put("30012", "p2"),
      source = side(5),
      target = side(5);
    const r = thwart(lady.id, source.id, { playerId: "p2", amount: 1 });
    expect(pack.spiderHamPackAllyThwarted(f.s, r, f.ports)).toEqual([]);
    put("30023", "p2");
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackAllyThwarted(f.s, r, f.ports));
    choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(source.id);
    choose(target.id);
    expect(f.s.sideSchemes.find((p) => p.id === target.id)?.counters).toBe(4);
    expect(f.s.sideSchemes.find((p) => p.id === source.id)?.counters).toBe(5);
    expect(f.packets[0]).toMatchObject({
      type: "removeThreat",
      target: target.id,
      amount: 1,
      source: lady.id,
    });
    expectPhysical(f.s, ids);
    expect(f.s.activePlayerId).toBe("p1");
    expect(pack.spiderHamPackAllyThwarted(f.s, r, f.ports)).toEqual([]);
  });
  it.each([{ amount: 0 }, { performed: false }, { thwart: false }])(
    "Lady Spider rejects a nonqualifying actual receipt %j",
    (overrides) => {
      const { f, put, side } = fixture();
      const lady = put("30012"),
        a = side(),
        b = side();
      expect(
        pack.spiderHamPackAllyThwarted(
          f.s,
          thwart(lady.id, a.id, overrides),
          f.ports,
        ),
      ).toEqual([]);
      expect(b.counters).toBe(4);
    },
  );
  it("blank Lady Spider and the absence of a different scheme suppress the response", () => {
    const { f, put } = fixture();
    const lady = put("30012"),
      r = thwart(lady.id, "main");
    expect(pack.spiderHamPackAllyThwarted(f.s, r, f.ports)).toEqual([]);
    f.s.flags[`blank:${lady.id}`] = true;
    expect(
      pack.spiderHamPackAllyThwarted(
        f.s,
        { ...r, target: "defeated-original" },
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Pavitr entry counts identity, ally and support cards controlled by his player", () => {
    const { f, put, side, run, choose } = fixture();
    const pavitr = put("30013"),
      target = side(10);
    put("30021");
    put("30023");
    put("30023", "p2");
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackAllyEntered(f.s, pavitr, f.ports)!);
    choose("yes");
    choose(target.id);
    expect(f.s.sideSchemes[0].counters).toBe(6);
    expect(f.packets[0]).toMatchObject({
      type: "removeThreat",
      amount: 4,
      source: pavitr.id,
    });
    expectPhysical(f.s, ids);
  });
  it("Pavitr still responds in alter-ego and blanking suppresses entry", () => {
    const { f, put, run, choose } = fixture();
    f.s.player.form = "alter";
    const pavitr = put("30013");
    run(...pack.spiderHamPackAllyEntered(f.s, pavitr, f.ports)!);
    choose("yes");
    choose("main");
    expect(f.s.scheme.threat).toBe(9);
    f.s.flags[`blank:${pavitr.id}`] = true;
    expect(pack.spiderHamPackAllyEntered(f.s, pavitr, f.ports)).toEqual([]);
  });
});

describe("Even the Odds actual simultaneous thwart results", () => {
  it("requires Energy and hero form before play", () => {
    const { f, piece, side } = fixture();
    const event = piece("30014");
    expect(pack.spiderHamPackRequirements(event)).toEqual(["energy"]);
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeTruthy();
    side();
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeNull();
    f.s.player.form = "alter";
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeTruthy();
  });
  it("thwarts eligible side schemes per player and counts actual defeats before villain damage", () => {
    const { f, piece, side, run } = fixture();
    const event = piece("30014"),
      defeated = side(2),
      retained = side(3),
      preventedDefeat = side(1),
      barred = side(1);
    f.s.resolving.push(event);
    f.s.flags[`cannotDefeat:${preventedDefeat.id}`] = true;
    f.s.flags[`cannotThwart:${barred.id}`] = true;
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackEvent(f.s, event)!);
    expect(f.s.sideSchemes.map((p) => [p.id, p.counters])).toEqual([
      [retained.id, 1],
      [preventedDefeat.id, 0],
      [barred.id, 1],
    ]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([defeated.id]);
    expect(f.s.scheme.threat).toBe(10);
    expect(f.s.villain.hp).toBe(49);
    expect(f.packets[0]).toMatchObject({
      type: "thwartBatch",
      sourceId: event.id,
      targets: [
        { id: defeated.id, amount: 2 },
        { id: retained.id, amount: 2 },
        { id: preventedDefeat.id, amount: 2 },
      ],
    });
    expect(f.packets[1]).toMatchObject({
      type: "damage",
      amount: 1,
      target: f.s.villain.id,
      attack: false,
    });
    expectPhysical(f.s, ids);
  });
});

describe("Overwatch physical pre-removal interrupt", () => {
  it("rejects a saved attachment selection if another player's copy occupies the scheme meanwhile", () => {
    const { f, put, run, choose } = fixture();
    const fresh = put("30019");
    run(...pack.spiderHamPackCardEntered(f.s, fresh));
    const competitor = put("30019", "p2");
    competitor.attachedTo = "main";
    const ids = physical(f.s).map((p) => p.id);
    expect(() => choose("main")).toThrow(/eligible actual attachment target/);
    expect(
      allInPlay(f.s).find((p) => p.id === fresh.id)?.attachedTo,
    ).toBeUndefined();
    expectPhysical(f.s, ids);
  });
  it("declining the saved interrupt leaves its physical discard cost unpaid", () => {
    const { f, put, side, run, choose } = fixture();
    const original = side(),
      other = side(),
      overwatch = put("30019", "p2");
    overwatch.attachedTo = original.id;
    const ids = physical(f.s).map((p) => p.id);
    run(
      ...pack.spiderHamPackSchemeThwarting(
        f.s,
        thwart("hero:p1", original.id),
        f.ports,
      ),
    );
    choose("no");
    expect(allInPlay(f.s).find((p) => p.id === overwatch.id)?.attachedTo).toBe(
      original.id,
    );
    expect(f.s.sideSchemes.find((p) => p.id === other.id)?.counters).toBe(4);
    expect(f.history).toEqual([]);
    expectPhysical(f.s, ids);
  });
  it("discards the controller's actual upgrade before copying the actual amount to a different scheme", () => {
    const { f, put, side, run, choose } = fixture();
    const source = side(1),
      target = side(5),
      overwatch = put("30019", "p2", "p1");
    overwatch.attachedTo = source.id;
    const r = thwart("hero:p1", source.id, { amount: 1 });
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackSchemeThwarting(f.s, r, f.ports));
    choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain(source.id);
    choose(target.id);
    expect(f.s.sideSchemes.find((p) => p.id === source.id)?.counters).toBe(1);
    expect(f.s.sideSchemes.find((p) => p.id === target.id)?.counters).toBe(4);
    expect(f.history).toEqual([
      `discard:${overwatch.id}`,
      `remove:${target.id}:1:${overwatch.id}`,
    ]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([overwatch.id]);
    expect(seatView(f.s, "p2").player.discard).toEqual([]);
    expectPhysical(f.s, ids);
    expect(pack.spiderHamPackSchemeThwarting(f.s, r, f.ports)).toEqual([]);
  });
  it("plain copied removal, zero removal, blank text and an alter-ego controller cannot trigger Overwatch", () => {
    const { f, put, side } = fixture();
    const source = side(),
      target = side(),
      overwatch = put("30019", "p2");
    overwatch.attachedTo = source.id;
    for (const override of [
      { thwart: false },
      { performed: false },
      { amount: 0 },
    ])
      expect(
        pack.spiderHamPackSchemeThwarting(
          f.s,
          thwart("hero:p1", source.id, override),
          f.ports,
        ),
      ).toEqual([]);
    seatView(f.s, "p2").player.form = "alter";
    expect(
      pack.spiderHamPackSchemeThwarting(
        f.s,
        thwart("hero:p1", source.id),
        f.ports,
      ),
    ).toEqual([]);
    seatView(f.s, "p2").player.form = "hero";
    f.s.flags[`blank:${overwatch.id}`] = true;
    expect(
      pack.spiderHamPackSchemeThwarting(
        f.s,
        thwart("hero:p1", source.id),
        f.ports,
      ),
    ).toEqual([]);
    expect(target.counters).toBe(4);
  });
  it("enforces max one on the main and each physical side scheme across players", () => {
    const { f, put, side, piece, run, choose } = fixture();
    const a = side(),
      b = side(),
      old = put("30019", "p2"),
      fresh = put("30019");
    old.attachedTo = "main";
    const targets = pack.spiderHamPackAttachmentTargets(f.s, fresh, f.ports)!;
    expect(targets.map((t) => t.id)).toEqual([a.id, b.id]);
    run(...pack.spiderHamPackCardEntered(f.s, fresh));
    choose(a.id);
    expect(allInPlay(f.s).find((p) => p.id === fresh.id)?.attachedTo).toBe(
      a.id,
    );
    expect(
      pack
        .spiderHamPackAttachmentTargets(f.s, piece("30019"), f.ports)!
        .map((t) => t.id),
    ).toEqual([b.id]);
  });
});

describe("Scarlet Spider naming before looking at the actual reveal", () => {
  function prepare() {
    const h = fixture(),
      scarlet = h.put("30020"),
      encounter = h.piece("01104"),
      drawn = h.piece("30014");
    h.f.s.encounter.dealt.push(encounter);
    h.f.s.player.deck.push(drawn);
    h.f.s.flags.revealToken = "reveal-1";
    const receipt: pack.SpiderHamPackRevealReceipt = {
      token: "reveal-1",
      playerId: "p1",
      pieceId: encounter.id,
    };
    return { ...h, scarlet, encounter, drawn, receipt };
  }
  it("a saved type choice cannot look at a different instance with the same printed face", () => {
    const { f, encounter, receipt, piece, run, choose } = prepare();
    run(
      ...pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports)[0]
        .effects,
    );
    f.s.encounter.dealt = [piece(encounter.code)];
    f.s.encounter.discard.push(encounter);
    const ids = physical(f.s).map((p) => p.id);
    expect(() => choose("treachery")).toThrow(
      /actual still-pending encounter card/,
    );
    expect(f.history).toEqual([]);
    expectPhysical(f.s, ids);
  });
  it("names before hidden information advances and a correct guess damages then draws", () => {
    const { f, scarlet, encounter, drawn, receipt, run, choose } = prepare();
    const ids = physical(f.s).map((p) => p.id),
      hidden = f.s.hiddenInfo;
    run(
      ...pack.spiderHamPackEncounterRevealOptions(
        f.s,
        receipt,
        [E("fixture:after")],
        f.ports,
      )[0].effects,
    );
    expect(f.s.hiddenInfo).toBe(hidden);
    expect(f.history).toEqual([]);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain("treachery");
    choose("treachery");
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual([encounter.id]);
    expect(f.s.player.inPlay.find((p) => p.id === scarlet.id)?.damage).toBe(1);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
    expect(f.history).toEqual([
      "hidden",
      `look:${encounter.id}`,
      `ally-damage:${scarlet.id}:1`,
      "draw:p1:1",
      "after",
    ]);
    expect(
      pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports),
    ).toEqual([]);
    expectPhysical(f.s, ids);
  });
  it("a wrong guess still looks at the same card without damage, drawing or revealing it", () => {
    const { f, scarlet, encounter, drawn, receipt, run, choose } = prepare();
    run(
      ...pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports)[0]
        .effects,
    );
    choose("minion");
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual([encounter.id]);
    expect(f.s.player.inPlay.find((p) => p.id === scarlet.id)?.damage).toBe(0);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([drawn.id]);
    expect(f.history).toEqual(["hidden", `look:${encounter.id}`]);
  });
  it("the damage is an effect: Tough prevents it and the correct guess still draws", () => {
    const { f, scarlet, drawn, receipt, run, choose } = prepare();
    scarlet.tough = true;
    f.s.player.form = "alter";
    run(
      ...pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports)[0]
        .effects,
    );
    choose("treachery");
    const actual = f.s.player.inPlay.find((p) => p.id === scarlet.id)!;
    expect(actual.tough).toBe(false);
    expect(actual.damage).toBe(0);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
  });
  it("native defeat of Scarlet Spider completes before the retained draw effect", () => {
    const { f, scarlet, drawn, receipt, run, choose } = prepare();
    scarlet.damage = 3;
    const ids = physical(f.s).map((p) => p.id);
    run(
      ...pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports)[0]
        .effects,
    );
    choose("treachery");
    expect(f.s.player.inPlay).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([scarlet.id]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
    expectPhysical(f.s, ids);
  });
  it("blank text, another player's reveal and a stale reveal window suppress the interrupt", () => {
    const { f, scarlet, receipt } = prepare();
    expect(
      pack.spiderHamPackEncounterRevealOptions(
        f.s,
        { ...receipt, playerId: "p2" },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.flags[`blank:${scarlet.id}`] = true;
    expect(
      pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports),
    ).toEqual([]);
    delete f.s.flags[`blank:${scarlet.id}`];
    delete f.s.flags.revealToken;
    expect(
      pack.spiderHamPackEncounterRevealOptions(f.s, receipt, [], f.ports),
    ).toEqual([]);
  });
});

describe("SP//dr exact physical excess consequential defeat", () => {
  const defeat = (
    overrides: Partial<pack.SpiderHamPackDefeatReceipt> = {},
  ): pack.SpiderHamPackDefeatReceipt => ({
    token: "defeat-1",
    playerId: "p1",
    consequential: true,
    amount: 2,
    remainingHP: 1,
    textBlank: false,
    ...overrides,
  });
  it.each([
    { amount: 1 },
    { consequential: false },
    { textBlank: true },
    { remainingHP: 0 },
  ])("does not return after an ineligible packet %j", (override) => {
    const { f, put } = fixture();
    const spdr = put("30021");
    expect(pack.spiderHamPackAllyDefeated(f.s, spdr, defeat(override))).toEqual(
      [],
    );
  });
  it("returns the same serialized instance to its owner and can return after a later reentry", () => {
    const { f, put, run } = fixture();
    const spdr = put("30021", "p1", "p2");
    spdr.damage = 3;
    const ids = physical(f.s).map((p) => p.id);
    f.ports.queue(f.s, ...pack.spiderHamPackAllyDefeated(f.s, spdr, defeat()));
    f.s = save(f.s);
    run();
    expect(f.s.player.inPlay).toEqual([]);
    expect(seatView(f.s, "p2").player.hand.map((p) => p.id)).toEqual([spdr.id]);
    expectPhysical(f.s, ids);
    const returned = seatView(f.s, "p2").player.hand.pop()!;
    returned.damage = 3;
    f.s.player.inPlay.push(returned);
    run(
      ...pack.spiderHamPackAllyDefeated(
        f.s,
        returned,
        defeat({ token: "defeat-2" }),
      ),
    );
    expect(seatView(f.s, "p2").player.hand.map((p) => p.id)).toEqual([spdr.id]);
    expect(f.history).toEqual([`return:${spdr.id}:p2`, `return:${spdr.id}:p2`]);
    expectPhysical(f.s, ids);
  });
  it("play restrictions use controlled cards, including a trait granted to the identity", () => {
    const { f, piece, put } = fixture();
    f.s.flags.identityTraits = "";
    for (const code of ["30020", "30021"])
      expect(
        pack.spiderHamPackPlayRestriction(f.s, piece(code), f.ports),
      ).toBeTruthy();
    put("30023", "p2");
    expect(
      pack.spiderHamPackPlayRestriction(f.s, piece("30021"), f.ports),
    ).toBeTruthy();
    const title = put("30029");
    title.attachedTo = "hero:p1";
    expect(
      pack.spiderHamPackPlayRestriction(f.s, piece("30021"), f.ports),
    ).toBeNull();
    f.s.flags[`blank:${title.id}`] = true;
    expect(
      pack.spiderHamPackPlayRestriction(f.s, piece("30021"), f.ports),
    ).toBeTruthy();
  });
});

const leave = (
  piece: Piece,
  overrides: Partial<pack.SpiderHamPackLeaveReceipt> = {},
): pack.SpiderHamPackLeaveReceipt => ({
  token: "leave-1",
  playerId: "p1",
  pieceId: piece.id,
  code: piece.code,
  traits: ["Web-Warrior"],
  typeCode: "ally",
  ...overrides,
});

describe("Warrior of the Great Web dynamic title and phase duration", () => {
  it("attaches only to actual Spider titles across players and enforces max one per character", () => {
    const { f, put, run, choose } = fixture();
    const lady = put("30012", "p2"),
      spdr = put("30021"),
      title = put("30029");
    const targets = pack
      .spiderHamPackAttachmentTargets(f.s, title, f.ports)!
      .map((t) => t.id);
    expect(targets).toEqual(["hero:p1", "hero:p2", lady.id]);
    expect(targets).not.toContain(spdr.id);
    run(...pack.spiderHamPackCardEntered(f.s, title));
    choose("hero:p2");
    expect(f.ports.hasTrait(f.s, "hero:p2", "Web-Warrior")).toBe(true);
    const other = put("30029", "p2");
    expect(
      pack
        .spiderHamPackAttachmentTargets(f.s, other, f.ports)!
        .map((t) => t.id),
    ).not.toContain("hero:p2");
    f.s.flags[`blank:${title.id}`] = true;
    expect(pack.spiderHamPackCharacterTraits(f.s, "hero:p2", f.ports)).toEqual(
      [],
    );
    expect(
      pack
        .spiderHamPackAttachmentTargets(f.s, other, f.ports)!
        .map((t) => t.id),
    ).not.toContain("hero:p2");
  });
  it("adds ATK across controllers for distinct leave receipts and persists until the phase ends", () => {
    const { f, put, piece, run, choose } = fixture();
    const title = put("30029", "p2");
    title.attachedTo = "hero:p1";
    const ally = piece("30021"),
      r = leave(ally);
    run(...pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports));
    choose("yes");
    expect(pack.spiderHamPackCharacterModifiers(f.s, "hero")).toEqual({
      attack: 1,
    });
    expect(pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports)).toEqual([]);
    run(
      ...pack.spiderHamPackAllyLeftPlay(
        f.s,
        { ...r, token: "leave-2" },
        f.ports,
      ),
    );
    choose("yes");
    expect(pack.spiderHamPackCharacterModifiers(f.s, "hero:p1")).toEqual({
      attack: 2,
    });
    f.s.flags[`blank:${title.id}`] = true;
    expect(pack.spiderHamPackCharacterModifiers(f.s, "hero:p1")).toEqual({
      attack: 2,
    });
    f.s = save(f.s);
    pack.spiderHamPackPhaseEnded(f.s);
    expect(pack.spiderHamPackCharacterModifiers(f.s, "hero:p1")).toEqual({
      attack: 0,
    });
  });
  it("target departure removes its own accrued ATK and nonally/non-Web-Warrior departures do not respond", () => {
    const { f, put, piece, run, choose } = fixture();
    const lady = put("30012", "p2"),
      title = put("30029");
    title.attachedTo = lady.id;
    const r = leave(piece("30021"));
    expect(
      pack.spiderHamPackAllyLeftPlay(f.s, { ...r, traits: [] }, f.ports),
    ).toEqual([]);
    expect(
      pack.spiderHamPackAllyLeftPlay(
        f.s,
        { ...r, typeCode: "support" },
        f.ports,
      ),
    ).toEqual([]);
    run(...pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports));
    choose("yes");
    expect(pack.spiderHamPackCharacterModifiers(f.s, lady.id)).toEqual({
      attack: 1,
    });
    pack.spiderHamPackCardLeftPlay(f.s, lady);
    expect(pack.spiderHamPackCharacterModifiers(f.s, lady.id)).toEqual({
      attack: 0,
    });
  });
});

describe("Web of Life and Destiny actual-code response", () => {
  it("waives the printed cost from the current identity trait only", () => {
    const { f, piece, put } = fixture();
    const web = piece("30023");
    expect(pack.spiderHamPackCostReduction(f.s, web, f.ports)).toBe(3);
    f.s.player.form = "alter";
    expect(pack.spiderHamPackCostReduction(f.s, web, f.ports)).toBe(0);
    const title = put("30029", "p2");
    title.attachedTo = "hero:p1";
    expect(pack.spiderHamPackCostReduction(f.s, web, f.ports)).toBe(3);
  });
  it("another controller's saved response draws the chosen player's actual top card", () => {
    const { f, put, piece, run, choose } = fixture();
    put("30023", "p2");
    const card = piece("30014"),
      r = leave(piece("30021"));
    f.s.player.deck.push(card);
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports));
    choose("yes");
    choose("p1");
    expect(f.s.player.hand.map((p) => p.id)).toEqual([card.id]);
    expect(seatView(f.s, "p2").player.hand).toEqual([]);
    expect(f.history).toEqual(["draw:p1:1"]);
    expect(pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports)).toEqual([]);
    expectPhysical(f.s, ids);
  });
  it("blanking disables the response and eliminated players are absent from choices", () => {
    const { f, put, piece, run, choose } = fixture();
    const web = put("30023"),
      r = leave(piece("30021"));
    f.s.flags[`blank:${web.id}`] = true;
    expect(pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${web.id}`];
    f.s.players[1].eliminated = true;
    run(...pack.spiderHamPackAllyLeftPlay(f.s, r, f.ports));
    choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p1"]);
  });
});

describe("Making an Entrance printed basic thwart interrupt", () => {
  it("plays the actual card before adding its one-use THW bonus and heals only after clearing all threat", () => {
    const { f, piece, run } = fixture();
    const entrance = piece("30016");
    f.s.player.hand.push(entrance);
    f.s.player.hp = 7;
    const packet = E("fixture:thwart", {
      basic: true,
      target: "main",
      amount: 2,
    });
    const ids = physical(f.s).map((p) => p.id);
    const options = pack.spiderHamPackBasicThwartOptions(
      f.s,
      packet,
      [E("fixture:after")],
      f.ports,
    );
    f.ports.queue(f.s, ...options[0].effects);
    f.s = save(f.s);
    run();
    const completed = f.packets.find((p) => p.type === "fixture:thwart")!;
    expect(completed.fixtureBonus).toBe(2);
    expect(completed.spiderHamPackEntrances).toEqual([entrance.id]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([entrance.id]);
    expect(f.history).toEqual([
      `thwart-play:${entrance.id}`,
      "thwart-bonus:2",
      "basic-thwart",
      "after",
    ]);
    expect(pack.spiderHamPackBasicThwartEnded(f.s, completed, false)).toEqual(
      [],
    );
    run(...pack.spiderHamPackBasicThwartEnded(f.s, completed, true));
    expect(f.s.player.hp).toBe(9);
    expectPhysical(f.s, ids);
  });
  it("does not offer an event thwart, a confused hero, alter-ego or an unaffordable actual card", () => {
    const { f, piece } = fixture();
    const entrance = piece("30016");
    f.s.player.hand.push(entrance);
    const packet = E("fixture:thwart", { basic: true });
    expect(
      pack.spiderHamPackBasicThwartOptions(
        f.s,
        { ...packet, basic: false },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.player.confused = true;
    expect(
      pack.spiderHamPackBasicThwartOptions(f.s, packet, [], f.ports),
    ).toEqual([]);
    f.s.player.confused = false;
    f.s.player.form = "alter";
    expect(
      pack.spiderHamPackBasicThwartOptions(f.s, packet, [], f.ports),
    ).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags.cannotPay = true;
    expect(
      pack.spiderHamPackBasicThwartOptions(f.s, packet, [], f.ports),
    ).toEqual([]);
    delete f.s.flags.cannotPay;
    f.s.flags[`blank:${entrance.id}`] = true;
    expect(
      pack.spiderHamPackBasicThwartOptions(f.s, packet, [], f.ports),
    ).toEqual([]);
    expect(
      pack.spiderHamPackPlayRestriction(f.s, entrance, f.ports),
    ).toBeTruthy();
  });
});

describe("One Way or Another actual encounter-deck reveal cost", () => {
  it("selects and reveals the same physical side scheme before drawing and shuffling", () => {
    const { f, piece, run, choose } = fixture();
    const event = piece("30017"),
      scheme = piece("01107"),
      treachery = piece("01104");
    f.s.resolving.push(event);
    f.s.encounter.deck.push(treachery, scheme);
    const drawn = [piece("30014"), piece("30019"), piece("30022")];
    f.s.player.deck.push(...drawn);
    const ids = physical(f.s).map((p) => p.id);
    run(
      ...pack.spiderHamPackBeforeEvent(f.s, event, [
        ...pack.spiderHamPackEvent(f.s, event)!,
        E("fixture:after"),
      ])!,
    );
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([scheme.id]);
    expect(f.s.player.hand).toEqual([]);
    choose(scheme.id);
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual([scheme.id]);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual([treachery.id]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    expect(f.history).toEqual([
      "hidden",
      `reveal:${scheme.id}`,
      "draw:p1:3",
      "shuffle",
      "after",
    ]);
    expectPhysical(f.s, ids);
  });
  it("shares max one per round with other players and the original One Way or Another printing", () => {
    const { f, piece } = fixture();
    const event = piece("30017");
    f.s.encounter.deck.push(piece("01107"));
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeNull();
    seatView(f.s, "p2").flags.nebulaPackOneWayRound = f.s.round;
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeTruthy();
    f.s.round++;
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeNull();
    pack.spiderHamPackCardPlayed(f.s, event);
    activateSeat(f.s, "p2");
    expect(pack.spiderHamPackPlayRestriction(f.s, event, f.ports)).toBeTruthy();
  });
});

describe("Followed actual defeat interrupt before attachment cleanup", () => {
  it("an ally's controller can damage an actual enemy while the source and defeated scheme still exist", () => {
    const { f, put, side, run, choose } = fixture();
    const scheme = side(0),
      followed = put("30018", "p2");
    followed.attachedTo = scheme.id;
    const ids = physical(f.s).map((p) => p.id);
    run(...pack.spiderHamPackSchemeDefeating(f.s, scheme, f.ports));
    choose("yes");
    choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(46);
    expect(f.s.sideSchemes.map((p) => p.id)).toEqual([scheme.id]);
    expect(allInPlay(f.s).map((p) => p.id)).toContain(followed.id);
    expect(f.packets[0]).toMatchObject({
      type: "damage",
      target: f.s.villain.id,
      amount: 4,
      source: followed.id,
      attack: false,
    });
    expectPhysical(f.s, ids);
  });
  it("enforces max one across the original printing and disables a blanked source", () => {
    const { f, put, side, piece } = fixture();
    const scheme = side(),
      original = put("03032", "p2"),
      printing = piece("30018");
    original.attachedTo = scheme.id;
    expect(pack.spiderHamPackAttachmentTargets(f.s, printing, f.ports)).toEqual(
      [],
    );
    const followed = put("30018");
    followed.attachedTo = scheme.id;
    f.s.flags[`blank:${followed.id}`] = true;
    expect(pack.spiderHamPackSchemeDefeating(f.s, scheme, f.ports)).toEqual([]);
  });
});

describe("Team-Building Exercise ordinary paid hand play", () => {
  it("exhausts the support before playing the same hand card with one resource discount", () => {
    const { f, put, piece, run, choose } = fixture();
    const support = put("30022"),
      ally = piece("30020"),
      nonmatching = piece("30014");
    f.s.player.hand.push(ally, nonmatching);
    f.s.flags.available = 3;
    const ids = physical(f.s).map((p) => p.id);
    expect(pack.spiderHamPackAbility(f.s, support.id, f.ports)).toBe(true);
    run();
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([ally.id]);
    choose(ally.id);
    expect(allInPlay(f.s).find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    expect(allInPlay(f.s).some((p) => p.id === ally.id)).toBe(true);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([nonmatching.id]);
    expect(f.history).toEqual([`play:${ally.id}:1`]);
    expectPhysical(f.s, ids);
  });
  it("canceling the native paid play retains the already committed exhaust cost", () => {
    const { f, put, piece, run, choose } = fixture();
    const support = put("30022"),
      ally = piece("30020");
    f.s.player.hand.push(ally);
    f.s.flags.cancelPlay = true;
    run(
      ...pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)[0].effects,
    );
    choose(ally.id);
    expect(allInPlay(f.s).find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    expect(f.s.player.hand.map((p) => p.id)).toEqual([ally.id]);
  });
  it("requires an unblanked ready support, hero form and an affordable actual hand card", () => {
    const { f, put, piece } = fixture();
    const support = put("30022"),
      ally = piece("30020");
    f.s.player.hand.push(ally);
    f.s.flags[`cannotPlay:${ally.id}`] = true;
    expect(pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)).toEqual(
      [],
    );
    delete f.s.flags[`cannotPlay:${ally.id}`];
    support.exhausted = true;
    expect(pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)).toEqual(
      [],
    );
    support.exhausted = false;
    f.s.flags[`blank:${support.id}`] = true;
    expect(pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)).toEqual(
      [],
    );
    delete f.s.flags[`blank:${support.id}`];
    f.s.player.form = "alter";
    expect(pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)).toEqual(
      [],
    );
    f.s.player.form = "hero";
    f.s.player.hand = [];
    support.storedCards = [ally];
    f.ports.handPlayableCards = () => [ally];
    expect(pack.spiderHamPackAbilityOptions(f.s, support.id, f.ports)).toEqual(
      [],
    );
  });
});
