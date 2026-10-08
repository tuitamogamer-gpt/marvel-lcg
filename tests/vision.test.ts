import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import {
  consumeStatus,
  consumeTough,
  printedKeyword,
} from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  VISION_SCRIPT_CODES,
  resolveVisionEffect,
  visionAbility,
  visionAbilityOptions,
  visionAllyStats,
  visionAlterStats,
  visionAttackDamageReduction,
  visionBoost,
  visionCanAttack,
  visionCanChangeMassForm,
  visionCanDefend,
  visionChangeMassForm,
  visionDefenseOptions,
  visionDroneStats,
  visionEncounterReveal,
  visionEnemyAttackInitiated,
  visionEvent,
  visionEventAction,
  visionInitializeMass,
  visionInitializeNemesis,
  visionMassForm,
  visionMassTextBlank,
  visionPlayRestriction,
  visionResourceSources,
  visionResourceSpent,
  visionRetaliate,
  visionSetup,
  visionShadowOfPast,
  visionStalwart,
  visionStats,
  visionTraits,
  type VisionPorts,
} from "../src/game/vision.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `vision:${type}`,
  ...args,
});
function saved(s: GameState) {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  const actor = copy.players.find((p) => p.id === copy.activePlayerId)!;
  actor.player = copy.player;
  actor.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 26001,
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
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.setAside = [];
    v.player.hp = 11;
    v.player.exhausted = false;
    v.player.flipped = false;
    v.player.stunned = v.player.confused = v.player.tough = false;
    v.flags = seat.flags = {};
    if (seat.id === s.activePlayerId) s.flags = seat.flags;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 20;
  const f: {
    s: GameState;
    ports: VisionPorts;
    history: string[];
    packets: Effect[];
    delayed: Effect[];
  } = { s, ports: {} as VisionPorts, history: [], packets: [], delayed: [] };
  const piece = (code: string, ownerId = f.s.activePlayerId) => ({
    ...makePiece(f.s, code),
    ownerId,
  });
  const enemies = (s: GameState, attack: boolean) => [
    ...(!attack ||
    !s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Guard"))
      ? [{ id: s.villain.id, label: "Rhino" }]
      : []),
    ...s.minions.map((p) => ({
      id: p.id,
      label: cards.get(p.code)?.name || "Drone",
      code: p.code,
    })),
  ];
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (s) => !s.flags.formLocked,
    canChangeMassForm: (s) => !s.flags.formLocked,
    flip: (s, _counts, target) => {
      s.player.form = target === "alter" ? "alter" : "hero";
    },
    canReadyIdentity: () => true,
    canPay: (s) => !s.flags.cannotPay,
    cardCost: (_s, p) => cards.get(p.code)?.cost || 0,
    canGiveStatus: (s, id, status) => {
      const p =
        id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
      return !!p && !p[status] && !s.flags[`stalwart:${id}`];
    },
    enemyTargets: enemies,
    schemeTargets: (s, thwart, ignoreCrisis, ignorePatrol) => {
      if (
        thwart &&
        !ignorePatrol &&
        s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Patrol"))
      )
        return [];
      return [
        ...(s.scheme.threat > 0 &&
        (ignoreCrisis ||
          !s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis))
          ? [{ id: "main", label: "Main scheme" }]
          : []),
        ...s.sideSchemes
          .filter((p) => p.counters > 0)
          .map((p) => ({
            id: p.id,
            label: cards.get(p.code)!.name,
            code: p.code,
          })),
      ];
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    isIdentityTextBlank: (s) => !!s.flags.identityBlank,
    discardHand: (s, id) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) s.player.discard.push(s.player.hand.splice(i, 1)[0]);
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
      const i = s.attachments.findIndex((p) => p.id === id);
      if (i >= 0) s.encounter.discard.push(s.attachments.splice(i, 1)[0]);
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      f.history.push("reveal-hidden");
    },
    recycleEncounter: vi.fn(),
    attackProgram: (s, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(s, ...effects, ...after);
    },
    log: vi.fn(),
    makePiece: (s, code) => makePiece(s, code),
    shufflePlayerDeck: (s, after) => {
      f.history.push("shuffle-player");
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      f.ports.queue(s, ...after);
    },
    shuffleEncounter: () => {
      f.history.push("shuffle-encounter");
    },
    canDiscardAttachment: (s, p) =>
      !s.flags[`cannotDiscard:${p.id}`] &&
      !printedKeyword(cards.get(p.code)!, "Permanent"),
    massFormChanged: (_s, from, to) => f.history.push(`mass:${from}:${to}`),
    preventAllAttackDamage: (s) => {
      s.attack!.preventAllDamage = true;
    },
    afterAttack: (_s, effects) => f.delayed.push(...effects),
    giveObligation: (s, p, ownerId) => {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.dealtTo = ownerId;
      seatView(s, ownerId).player.inPlay.push(p);
    },
    putEnvironment: (s, p) => {
      (s.environments ||= []).push(p);
    },
    discardRandomHand: (s, n) => {
      f.history.push(`random:${n}`);
      for (let i = 0; i < n && s.player.hand.length; i++)
        s.player.discard.push(s.player.hand.splice(0, 1)[0]);
    },
  };
  const pump = () => {
    let count = 0;
    while (!f.s.prompt && f.s.queue.length) {
      if (++count > 200) throw Error("Fixture continuation loop");
      const e = f.s.queue.shift()!,
        previous = f.s.activePlayerId;
      if (e.actorId) activateSeat(f.s, e.actorId);
      try {
        if (resolveVisionEffect(f.s, e, f.ports)) continue;
        switch (e.type) {
          case "draw":
            for (let i = 0; i < e.amount && f.s.player.deck.length; i++)
              f.s.player.hand.push(f.s.player.deck.shift()!);
            break;
          case "damage": {
            f.packets.push(e);
            const p =
              e.target === f.s.villain.id
                ? f.s.villain
                : f.s.minions.find((p) => p.id === e.target);
            if (p && !consumeTough(p)) {
              if (p === f.s.villain) f.s.villain.hp -= e.amount;
              else p.damage += e.amount;
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
          case "status": {
            const p =
              e.target === f.s.villain.id
                ? f.s.villain
                : f.s.minions.find((p) => p.id === e.target);
            if (p && !f.s.flags[`stalwart:${p.id}`])
              p[e.status as "stunned"] = true;
            break;
          }
          case "removeEncounter":
            for (const seat of f.s.players) {
              const v = seatView(f.s, seat);
              v.player.inPlay = v.player.inPlay.filter(
                (p) => p.id !== e.piece.id,
              );
            }
            f.s.removed.push(e.piece);
            break;
          case "reveal": {
            const p = e.piece as Piece,
              c = cards.get(p.code)!;
            if (c.type_code === "minion") {
              p.tough = !!printedKeyword(c, "Toughness");
              f.s.minions.push(p);
            } else if (c.type_code === "side_scheme") {
              p.counters = c.base_threat || 0;
              f.s.sideSchemes.push(p);
            } else if (c.type_code === "environment")
              (f.s.environments ||= []).push(p);
            f.ports.queue(f.s, ...(visionEncounterReveal(f.s, p) || []));
            break;
          }
          case "drone": {
            const top = f.s.player.deck.shift();
            if (top) {
              const p = piece("drone", f.s.activePlayerId);
              p.droneCard = top;
              p.engagedWith = f.s.activePlayerId;
              f.s.minions.push(p);
            }
            break;
          }
          case "surge":
            f.history.push(`surge:${e.sourceCode}`);
            break;
          case "fixture:after":
            f.history.push("after");
            break;
          default:
            throw Error(`Missing fixture effect ${e.type}`);
        }
      } finally {
        activateSeat(f.s, previous);
      }
    }
    return f.s;
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    return pump();
  };
  const choose = (id: string) => {
    f.s = saved(f.s);
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    f.ports.queue(f.s, ...o!.effects);
    return pump();
  };
  const put = (code: string) => {
    const p = piece(code);
    f.s.player.inPlay.push(p);
    return p;
  };
  const form = (dense = false) => {
    const p =
      f.s.player.inPlay.find((p) => ["26002", "26002b"].includes(p.code)) ||
      put("26002");
    p.code = dense ? "26002b" : "26002";
    return p;
  };
  const play = (code: string) => {
    const p = piece(code);
    const action = visionEventAction(f.s, p);
    if (action === "attack" && f.s.player.stunned)
      consumeStatus(f.s.player, "stunned");
    else if (action === "thwart" && f.s.player.confused)
      consumeStatus(f.s.player, "confused");
    else run(...(visionEvent(f.s, p) || []));
    return p;
  };
  const defending = (defender = "hero:p1") => {
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defender,
      defense: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      targetPlayerId: "p1",
    };
  };
  return { f, piece, put, form, run, choose, play, defending };
}

describe("Vision original physical source", () => {
  it("keeps the two mass faces one physical Permanent outside the 40-card source", () => {
    const source = sources.find((d) => d.packCode === "vision")!;
    const codes = Object.entries(source.cards).flatMap(
      ([code, n]) => Array(n).fill(code) as string[],
    );
    expect(codes).toHaveLength(41);
    const playable = codes.filter((c) => c !== "26002");
    expect(playable).toHaveLength(40);
    expect(
      playable.filter((c) => cards.get(c)!.faction_code === "hero"),
    ).toHaveLength(15);
    expect(
      playable.filter((c) => cards.get(c)!.faction_code === "protection"),
    ).toHaveLength(17);
    expect(
      playable.filter((c) => cards.get(c)!.faction_code === "basic"),
    ).toHaveLength(8);
    expect(cards.get("26001b")?.recover).toBe(3);
    expect(cards.get("26002")?.text).not.toMatch(/\bSetup\b/);
    expect(cards.get("26002")?.permanent).toBe(true);
  });
  it("declares exactly 19 raw faces without borrowing another identity's IDs", () => {
    expect(VISION_SCRIPT_CODES).toHaveLength(19);
    for (const code of VISION_SCRIPT_CODES)
      expect(cards.get(code)?.pack_code).toBe("vision");
  });
  it("holds the same mass ID aside before initial draw and puts it in play only at player Setup", () => {
    const { f, piece } = fixture(),
      p = piece("26002");
    f.s.player.deck.push(
      p,
      ...Array.from({ length: 40 }, () => piece("26024")),
    );
    visionInitializeMass(f.s, f.ports);
    expect(f.s.player.deck).toHaveLength(40);
    expect(f.s.player.setAside?.map((p) => p.id)).toEqual([p.id]);
    f.s.player.form = "alter";
    expect(visionAlterStats(f.s, f.ports).handSize).toBe(0);
    f.s.player.hand.push(...f.s.player.deck.splice(0, 5));
    visionSetup(f.s, f.ports);
    expect(f.s.player.hand).toHaveLength(5);
    expect(f.s.player.inPlay).toHaveLength(1);
    expect(f.s.player.inPlay[0].id).toBe(p.id);
    expect(visionAlterStats(f.s, f.ports).handSize).toBe(1);
    visionSetup(f.s, f.ports);
    expect(f.s.player.inPlay).toHaveLength(1);
  });
  it("rejects a duplicate physical mass card rather than silently dropping a face", () => {
    const { f, piece } = fixture();
    f.s.player.deck.push(piece("26002"), piece("26002b"));
    expect(() => visionInitializeMass(f.s, f.ports)).toThrow(/one physical/);
  });
  it("initializes exactly five physical nemesis cards once alongside the Permanent", () => {
    const { f } = fixture();
    visionInitializeMass(f.s, f.ports);
    visionInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    visionInitializeMass(f.s, f.ports);
    visionInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id).sort()).toEqual(ids.sort());
  });
});

describe("Vision mass forms and physical responses", () => {
  it("changes the same mass card once per round without exhausting or consuming Hero/AE flip", () => {
    const { f, form, choose } = fixture(),
      p = form();
    f.s.player.flipped = true;
    expect(visionAbility(f.s, "hero", f.ports)).toBe(true);
    const e = f.s.queue.shift()!;
    resolveVisionEffect(f.s, e, f.ports);
    expect(f.s.player.inPlay.find((x) => x.id === p.id)?.code).toBe("26002b");
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.flipped).toBe(true);
    expect(visionAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    resolveVisionEffect(f.s, f.s.queue.shift()!, f.ports);
    choose("continue");
    f.s.round++;
    expect(visionAbilityOptions(f.s, "hero", f.ports)).toHaveLength(1);
  });
  it.each(["alter", "hero"] as const)(
    "Dense draw applies after an actual mass change in %s form",
    (identityForm) => {
      const { f, form, piece, run, choose } = fixture();
      form();
      f.s.player.form = identityForm;
      const top = piece("26024");
      f.s.player.deck.push(top);
      run(...visionChangeMassForm(f.s, "dense", f.ports));
      choose(f.s.player.inPlay[0].id);
      expect(f.s.player.hand.map((p) => p.id)).toEqual([top.id]);
      expect(f.s.prompt).toBeNull();
    },
  );
  it("does not draw for initial Intangible setup or changing to the same physical face", () => {
    const { f, piece } = fixture();
    f.s.player.deck.push(piece("26024"));
    visionSetup(f.s, f.ports);
    expect(f.s.player.hand).toHaveLength(0);
    expect(visionChangeMassForm(f.s, "intangible", f.ports)).toEqual([]);
  });
  it("can order Density Control before Dense draw across serialized choices", () => {
    const { f, form, put, piece, run, choose } = fixture(),
      mass = form(),
      control = put("26007"),
      event = piece("26008"),
      top = piece("26024");
    f.s.player.discard.push(event);
    f.s.player.deck.push(top);
    run(...visionChangeMassForm(f.s, "dense", f.ports));
    choose(control.id);
    expect(f.s.player.inPlay.some((p) => p.id === control.id)).toBe(true);
    choose(event.id);
    expect(f.s.player.discard.some((p) => p.id === control.id)).toBe(true);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([event.id]);
    choose(mass.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([event.id, top.id]);
    expect(f.s.player.inPlay.find((p) => p.id === mass.id)?.code).toBe(
      "26002b",
    );
  });
  it("does not offer Density Control in AE or without a discarded Vision event", () => {
    const { f, form, put, piece, run } = fixture();
    form(true);
    put("26007");
    f.s.player.form = "alter";
    f.s.player.discard.push(piece("26008"));
    run(...visionChangeMassForm(f.s, "intangible", f.ports));
    expect(f.s.prompt).toBeNull();
    f.s.player.form = "hero";
    f.s.player.discard = [piece("26018")];
    run(...visionChangeMassForm(f.s, "dense", f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      f.s.player.inPlay[0].id,
      "continue",
    ]);
  });
  it("offers two physical Density Controls separately and cannot retrieve one event twice", () => {
    const { f, form, put, piece, run, choose } = fixture();
    form(true);
    const a = put("26007"),
      b = put("26007"),
      event = piece("26010");
    f.s.player.discard.push(event);
    run(...visionChangeMassForm(f.s, "intangible", f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      a.id,
      b.id,
      "continue",
    ]);
    choose(a.id);
    choose(event.id);
    expect(f.s.prompt).toBeNull();
    expect(f.s.player.inPlay.some((p) => p.id === b.id)).toBe(true);
  });
  it("rejects an event that moved out of discard before Density Control commits its discard cost", () => {
    const { f, form, put, piece } = fixture();
    form();
    const source = put("26007"),
      event = piece("26008");
    f.s.player.hand.push(event);
    expect(() =>
      resolveVisionEffect(
        f.s,
        V("control-card", { source: source.id, id: event.id }),
        f.ports,
      ),
    ).toThrow(/original/);
    expect(f.s.player.inPlay.some((p) => p.id === source.id)).toBe(true);
  });
  it("a prohibited Density Control discard is neither offered nor committed", () => {
    const { f, form, put, piece, run } = fixture();
    form(true);
    const source = put("26007"),
      event = piece("26008");
    f.s.player.discard.push(event);
    f.ports.canDiscardUpgrade = (_s, p) => p.id !== source.id;
    run(...visionChangeMassForm(f.s, "intangible", f.ports));
    expect(f.s.prompt).toBeNull();
    expect(() =>
      resolveVisionEffect(
        f.s,
        V("control-card", { source: source.id, id: event.id }),
        f.ports,
      ),
    ).toThrow(/original/);
    expect(f.s.player.inPlay.some((p) => p.id === source.id)).toBe(true);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([event.id]);
  });
  it("mixes ordinary form responses into the same selectable response ordering", () => {
    const { f, form, run } = fixture();
    form();
    f.ports.formResponseOptions = (_s, after) => [
      { id: "generic", label: "Generic form response", effects: after },
    ];
    run(...visionChangeMassForm(f.s, "dense", f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      f.s.player.inPlay[0].id,
      "generic",
      "continue",
    ]);
  });
  it.each(["formLocked", "identityBlank"])(
    "respects %s on the manual identity action",
    (flag) => {
      const { f, form } = fixture();
      form();
      f.s.flags[flag] = true;
      expect(visionAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
      if (flag === "formLocked")
        expect(visionCanChangeMassForm(f.s, f.ports)).toBe(false);
    },
  );
});

describe("Vision modifiers and Corrupted Programming", () => {
  it.each([false, true])(
    "computes Hero, AE, Vivian and Cape bonuses for Dense=%s",
    (dense) => {
      const { f, form, put } = fixture();
      form(dense);
      const ally = put("26003");
      put("26006");
      expect(visionStats(f.s, f.ports)).toEqual({
        attack: dense ? 2 : 0,
        thwart: 0,
        defense: dense ? 2 : 0,
      });
      expect(visionAllyStats(f.s, ally, f.ports)).toEqual({
        attack: dense ? 2 : 0,
        thwart: dense ? 0 : 2,
      });
      expect(visionRetaliate(f.s, f.ports)).toBe(dense ? 1 : 0);
      expect(visionStalwart(f.s, f.ports)).toBe(!dense);
      expect(visionCanAttack(f.s, f.ports)).toBe(dense);
      expect(visionCanDefend(f.s, f.ports)).toBe(dense);
      expect(visionAttackDamageReduction(f.s, f.ports)).toBe(dense ? 0 : 2);
      f.s.player.form = "alter";
      expect(visionAlterStats(f.s, f.ports)).toEqual({
        recover: dense ? 2 : 0,
        handSize: dense ? 0 : 1,
      });
      expect(visionStats(f.s, f.ports).attack).toBe(0);
    },
  );
  it.each([false, true])(
    "Corrupted Programming blanks mass abilities but leaves its face, Permanent, identity and Cape intact (Dense=%s)",
    (dense) => {
      const { f, form, put } = fixture(),
        p = form(dense);
      put("26006");
      put("26028");
      expect(visionMassTextBlank(f.s, f.ports)).toBe(true);
      expect(visionStats(f.s, f.ports)).toEqual({
        attack: 0,
        thwart: 0,
        defense: 0,
      });
      expect(visionCanAttack(f.s, f.ports)).toBe(true);
      expect(visionAttackDamageReduction(f.s, f.ports)).toBe(0);
      expect(visionRetaliate(f.s, f.ports)).toBe(dense ? 1 : 0);
      expect(visionStalwart(f.s, f.ports)).toBe(!dense);
      expect(printedKeyword(cards.get(p.code)!, "Permanent")).toBe(1);
      f.s.player.form = "alter";
      expect(visionAlterStats(f.s, f.ports)).toEqual({
        recover: dense ? 2 : 0,
        handSize: dense ? 0 : 1,
      });
    },
  );
  it("blanked Dense suppresses its draw while unblanked Density Control still responds", () => {
    const { f, form, put, piece, run } = fixture();
    form();
    put("26028");
    const source = put("26007");
    f.s.player.discard.push(piece("26008"));
    run(...visionChangeMassForm(f.s, "dense", f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      source.id,
      "continue",
    ]);
  });
  it("give-to Vision assigns the actual resolving obligation to its owner in multiplayer", () => {
    const { f, piece, run } = fixture(true),
      p = piece("26028");
    f.s.resolving.push(p);
    activateSeat(f.s, "p2");
    run(...visionEncounterReveal(f.s, p)!);
    expect(seatView(f.s, "p1").player.inPlay.map((p) => p.id)).toEqual([p.id]);
    expect(seatView(f.s, "p2").player.inPlay).toEqual([]);
    expect(f.s.resolving).toEqual([]);
  });
  it("removal needs ready AE, exhausts its actual identity, and removes the same obligation ID", () => {
    const { f, form, put, run } = fixture();
    form();
    const p = put("26028");
    expect(visionAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    expect(visionAbility(f.s, p.id, f.ports, "remove")).toBe(true);
    run();
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.map((p) => p.id)).toEqual([p.id]);
    expect(visionMassTextBlank(f.s, f.ports)).toBe(false);
  });
  it("Intangible cannot attempt even a Stunned attack", () => {
    const { f, form } = fixture();
    form();
    f.s.player.stunned = true;
    expect(visionCanAttack(f.s, f.ports)).toBe(false);
    expect(f.s.player.stunned).toBe(true);
  });
  it("blanked Cape or Solar Gem provides no dynamic keywords or Aerial trait", () => {
    const { f, form, put } = fixture();
    form();
    const cape = put("26006"),
      gem = put("26005");
    f.s.flags[`blank:${cape.id}`] = true;
    f.s.flags[`blank:${gem.id}`] = true;
    expect(visionStalwart(f.s, f.ports)).toBe(false);
    expect(visionTraits(f.s, f.ports)).toEqual([]);
  });
});

describe("Vision resources and Android search", () => {
  it("Solar Gem provides exactly one actual wild resource and commits exhaustion once", () => {
    const { f, put } = fixture(),
      p = put("26005");
    expect(visionTraits(f.s, f.ports)).toEqual(["Aerial"]);
    expect(
      visionResourceSources(f.s, f.ports).map((x) => ({
        id: x.id,
        resources: x.resources,
      })),
    ).toEqual([{ id: p.id, resources: ["wild"] }]);
    expect(visionResourceSpent(f.s, p.id, f.ports)).toBe(true);
    expect(visionResourceSources(f.s, f.ports)).toEqual([]);
    expect(() => visionResourceSpent(f.s, p.id, f.ports)).toThrow(
      /unavailable/,
    );
  });
  it("does not consume a foreign or nonexistent resource source", () => {
    const { f } = fixture();
    expect(visionResourceSpent(f.s, "missing", f.ports)).toBe(false);
  });
  it.each(["deck", "discard"] as const)(
    "Lane searches a physical Android ally from %s and shuffles once",
    (zone) => {
      const { f, put, piece, run, choose } = fixture();
      f.s.player.form = "alter";
      const source = put("26004"),
        android = piece("26003"),
        other = piece("01083");
      f.s.player[zone].push(android, other);
      expect(visionAbility(f.s, source.id, f.ports)).toBe(true);
      run();
      expect(f.s.prompt?.options.map((o) => o.id)).toEqual([android.id]);
      expect(f.s.player.inPlay.find((p) => p.id === source.id)?.exhausted).toBe(
        true,
      );
      choose(android.id);
      expect(f.s.player.hand.map((p) => p.id)).toEqual([android.id]);
      expect(f.s.player[zone].map((p) => p.id)).toEqual([other.id]);
      expect(f.history.filter((x) => x === "shuffle-player")).toHaveLength(1);
    },
  );
  it("Lane still exhausts and shuffles once on a failed search", () => {
    const { f, put, run } = fixture();
    f.s.player.form = "alter";
    const p = put("26004");
    visionAbility(f.s, p.id, f.ports);
    run();
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(f.history).toEqual(["reveal-hidden", "shuffle-player"]);
  });
  it("Lane cannot act from Hero form, while exhausted, or blanked", () => {
    const { f, put } = fixture(),
      p = put("26004");
    expect(visionAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    p.exhausted = true;
    expect(visionAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    p.exhausted = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(visionAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
  });
});

describe("Vision attacks, thwarts and disruption", () => {
  it.each([false, true])(
    "Solar Beam uses only its actual mass branch (Dense=%s)",
    (dense) => {
      const { f, form, play, choose } = fixture();
      form(dense);
      const p = play("26008");
      expect(visionEventAction(f.s, p)).toBe(dense ? "attack" : "thwart");
      choose(dense ? f.s.villain.id : "main");
      expect(dense ? f.s.villain.hp : f.s.scheme.threat).toBe(dense ? 43 : 15);
      expect(f.packets[0].type).toBe(dense ? "damage" : "thwart");
    },
  );
  it.each([false, true])(
    "Solar Beam removes only the matching status before initiation (Dense=%s)",
    (dense) => {
      const { f, form, play } = fixture();
      form(dense);
      f.s.player.stunned = f.s.player.confused = true;
      play("26008");
      expect(f.s.player.stunned).toBe(!dense);
      expect(f.s.player.confused).toBe(dense);
      expect(f.s.prompt).toBeNull();
      expect(f.packets).toEqual([]);
    },
  );
  it.each(["26009", "26012"])(
    "%s requires Dense even if mass text is blanked",
    (code) => {
      const { f, form, piece, put } = fixture();
      form();
      put("26028");
      expect(visionPlayRestriction(f.s, piece(code), f.ports)).toMatch(/Dense/);
      form(true);
      expect(visionPlayRestriction(f.s, piece(code), f.ports)).toBeNull();
    },
  );
  it.each(["26010", "26011"])("%s requires Intangible", (code) => {
    const { f, form, piece } = fixture();
    form(true);
    expect(visionPlayRestriction(f.s, piece(code), f.ports)).toMatch(
      /Intangible/,
    );
    form();
    expect(visionPlayRestriction(f.s, piece(code), f.ports)).toBeNull();
  });
  it("Superdense Strike carries Piercing through the ordinary native attack program", () => {
    const { f, form, play, choose } = fixture();
    form(true);
    play("26009");
    choose(f.s.villain.id);
    expect(f.packets[0]).toMatchObject({
      amount: 5,
      piercing: true,
      attack: true,
      attackInitiated: true,
    });
    expect(f.history).toContain("attack-program");
  });
  it("Just Passing Through ignores Patrol and Crisis together without changing base thwart targets", () => {
    const { f, form, piece, play, choose } = fixture();
    form();
    const patrol = [...cards.values()].find(
        (c) => c.type_code === "minion" && printedKeyword(c, "Patrol"),
      )!,
      crisis = [...cards.values()].find(
        (c) => c.type_code === "side_scheme" && c.scheme_crisis,
      )!;
    f.s.minions.push(piece(patrol.code));
    const scheme = piece(crisis.code);
    scheme.counters = 3;
    f.s.sideSchemes.push(scheme);
    expect(f.ports.schemeTargets(f.s, true)).toEqual([]);
    play("26010");
    expect(f.s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    choose("main");
    expect(f.s.scheme.threat).toBe(17);
    expect(f.packets[0]).toMatchObject({
      ignoreCrisis: true,
      ignorePatrol: true,
    });
  });
  it("Phase Disruption bypasses Guard, confuses first, and only discards a matching attachment", () => {
    const { f, form, piece, play, choose } = fixture();
    form();
    const eligibleDef = [...cards.values()].find(
        (c) =>
          c.type_code === "attachment" &&
          /Hero\s+Action/.test((c.text || "").replace(/<[^>]*>/g, "")),
      )!,
      eligible = piece(eligibleDef.code),
      other = piece("01107");
    eligible.attachedTo = other.attachedTo = f.s.villain.id;
    f.s.attachments.push(eligible, other);
    play("26011");
    choose(f.s.villain.id);
    expect(f.s.villain.confused).toBe(true);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([eligible.id]);
    choose(eligible.id);
    expect(f.s.attachments.map((p) => p.id)).toEqual([other.id]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([eligible.id]);
  });
  it("Phase Disruption can discard eligible enemy attachment even when confusion is prohibited", () => {
    const { f, form, piece, play } = fixture();
    form();
    f.s.flags[`stalwart:${f.s.villain.id}`] = true;
    const c = [...cards.values()].find(
        (c) =>
          c.type_code === "attachment" &&
          /Hero\s+Action/.test((c.text || "").replace(/<[^>]*>/g, "")),
      )!,
      p = piece(c.code);
    p.attachedTo = f.s.villain.id;
    f.s.attachments.push(p);
    expect(visionPlayRestriction(f.s, piece("26011"), f.ports)).toBeNull();
    play("26011");
    expect(f.s.prompt?.options).toHaveLength(1);
  });
  it("all ordinary Vision signature events require Hero form", () => {
    const { f, form, piece } = fixture();
    form();
    f.s.player.form = "alter";
    for (const code of ["26008", "26009", "26010", "26011", "26012"])
      expect(visionPlayRestriction(f.s, piece(code), f.ports)).toMatch(
        /hero form/,
      );
  });
});

describe("Vision Mass Increase timing", () => {
  it("Solar Beam needs actual threat unless its matching Confuse replacement can resolve", () => {
    const { f, form, piece } = fixture();
    form();
    f.s.scheme.threat = 0;
    expect(visionPlayRestriction(f.s, piece("26008"), f.ports)).toMatch(
      /legal scheme/,
    );
    f.s.player.stunned = true;
    expect(visionPlayRestriction(f.s, piece("26008"), f.ports)).toMatch(
      /legal scheme/,
    );
    f.s.player.confused = true;
    expect(visionPlayRestriction(f.s, piece("26008"), f.ports)).toBeNull();
  });
  it("is offered only when the actual Vision identity defends, including a teammate's attack", () => {
    const { f, form, piece, defending } = fixture(true);
    form(true);
    f.s.player.hand.push(piece("26012"));
    defending("none");
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    defending("ally:missing");
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    defending("hero:p2");
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    defending("hero:p1");
    f.s.attack!.originalPlayerId = "p2";
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toHaveLength(1);
  });
  it("prevents all attack damage and defers stun until that same attack has resolved", () => {
    const { f, form, defending, run } = fixture();
    form(true);
    defending();
    run(V("mass-increase"));
    expect(f.s.attack!.preventAllDamage).toBe(true);
    expect(f.s.villain.stunned).toBe(false);
    expect(f.delayed).toHaveLength(1);
    f.s = saved(f.s);
    f.s.attack = null;
    run(...f.delayed);
    expect(f.s.villain.stunned).toBe(true);
  });
  it("a defeated attacker is not replaced with the villain for deferred stun", () => {
    const { f, form, piece, defending, run } = fixture();
    form(true);
    const p = piece("26029");
    f.s.minions.push(p);
    defending();
    f.s.attack!.attacker = p.id;
    run(V("mass-increase"));
    f.s.minions = [];
    f.s.attack = null;
    run(...f.delayed);
    expect(f.s.villain.stunned).toBe(false);
  });
  it("payment uses actual physical hand event and resumes a serialized defense window", () => {
    const { f, form, piece, defending, run } = fixture();
    form(true);
    defending();
    const p = piece("26012");
    f.s.player.hand.push(p);
    resolveVisionEffect(
      f.s,
      V("mass-increase-pay", {
        id: p.id,
        used: [],
        after: [{ type: "fixture:after" }],
      }),
      f.ports,
    );
    const e = f.s.queue[0];
    expect(e).toMatchObject({
      type: "payRequest",
      cost: 1,
      piece: { id: p.id },
      cancelable: false,
    });
    expect(e.after[0]).toMatchObject({
      type: "resolveHandEvent",
      id: p.id,
      after: [{ type: "vision:mass-increase" }],
      continuation: [{ type: "vision:defense-window", used: [p.id] }],
    });
  });
  it("the host's permitted stored Defense getter offers the same Jocasta event and pays without premature extraction", () => {
    const { f, form, piece, defending } = fixture();
    form(true);
    defending();
    const event = piece("26012"),
      jocasta = piece("26013");
    jocasta.storedCards = [event];
    f.s.player.inPlay.push(jocasta);
    expect(f.s.player.hand).toEqual([]);
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    f.ports.defenseEventSources = (s) => [
      ...s.player.hand,
      ...s.player.inPlay
        .filter((p) => p.code === "26013" && !f.ports.isTextBlank(s, p))
        .flatMap((p) => p.storedCards || []),
    ];
    f.s = saved(f.s);
    const options = visionDefenseOptions(f.s, [], [], f.ports);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ id: event.id, image: "26012" });
    resolveVisionEffect(f.s, options[0].effects[0], f.ports);
    expect(f.s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      piece: { id: event.id, code: event.code },
      after: [{ type: "resolveHandEvent", id: event.id }],
    });
    expect(
      f.s.player.inPlay.find((p) => p.id === jocasta.id)?.storedCards,
    ).toEqual([expect.objectContaining({ id: event.id, code: event.code })]);
    expect(f.s.player.hand).toEqual([]);
    f.s.flags[`blank:${jocasta.id}`] = true;
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    expect(() =>
      resolveVisionEffect(f.s, options[0].effects[0], f.ports),
    ).toThrow(/payable event/);
  });
  it("unfunded, used or non-Dense Mass Increase is unavailable", () => {
    const { f, form, piece, defending } = fixture();
    form(true);
    defending();
    const p = piece("26012");
    f.s.player.hand.push(p);
    expect(visionDefenseOptions(f.s, [p.id], [], f.ports)).toEqual([]);
    f.s.flags.cannotPay = true;
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    delete f.s.flags.cannotPay;
    form();
    expect(visionDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
  });
});

describe("Vision physical nemesis and original owned Drone cards", () => {
  it("Shadows reveals actual Ultron/Unleashed, moves its one environment, and shuffles only remaining cards", () => {
    const { f, piece, run } = fixture();
    visionInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id),
      top = piece("26024");
    f.s.player.deck.push(top);
    run(...visionShadowOfPast(f.s)!);
    expect(f.s.minions.find((p) => p.code === "26029")?.tough).toBe(true);
    expect(f.s.minions.find((p) => p.code === "drone")?.droneCard?.id).toBe(
      top.id,
    );
    expect(f.s.sideSchemes[0].code).toBe("26030");
    expect(f.s.environments?.map((p) => p.code)).toEqual(["26031"]);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual(["26032", "26032"]);
    expect(f.s.player.setAside).toEqual([]);
    const physical = [
      ...f.s.minions.filter((p) => p.code !== "drone"),
      ...f.s.sideSchemes,
      ...f.s.environments!,
      ...f.s.encounter.deck,
    ];
    expect(physical.map((p) => p.id).sort()).toEqual(ids.sort());
    expect(visionShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });
  it.each(["deck", "discard", "setAside"] as const)(
    "Unleashed retrieves the exact environment from %s without revealing it",
    (zone) => {
      const { f, piece, run } = fixture(),
        env = piece("26031");
      (zone === "setAside" ? f.s.player.setAside! : f.s.encounter[zone]).push(
        env,
      );
      run(V("unleashed"));
      expect(f.s.environments?.map((p) => p.id)).toEqual([env.id]);
      expect(f.s.prompt).toBeNull();
      expect(f.history).toEqual(["shuffle-encounter"]);
    },
  );
  it("Unleashed uses each actual player's top card and owner, preserving saved IDs", () => {
    const { f, piece, run } = fixture(true),
      a = piece("26024", "p1"),
      b = piece("01088", "p2");
    f.s.player.deck.push(a);
    seatView(f.s, "p2").player.deck.push(b);
    f.s = saved(f.s);
    run(V("unleashed"));
    expect(
      f.s.minions.map((p) => ({
        card: p.droneCard?.id,
        owner: p.droneCard?.ownerId,
        engaged: p.engagedWith,
      })),
    ).toEqual([
      { card: a.id, owner: "p1", engaged: "p1" },
      { card: b.id, owner: "p2", engaged: "p2" },
    ]);
    expect(f.s.activePlayerId).toBe("p1");
  });
  it("Ultron's attack interrupt uses the attacked seat and needs the named environment in play", () => {
    const { f, piece } = fixture(true),
      env = piece("26031"),
      ultron = piece("26029");
    f.s.environments!.push(env);
    expect(visionEnemyAttackInitiated(f.s, ultron, "p2", f.ports)).toEqual([
      { type: "drone", actorId: "p2" },
    ]);
    f.s.flags[`blank:${ultron.id}`] = true;
    expect(visionEnemyAttackInitiated(f.s, ultron, "p2", f.ports)).toEqual([]);
    delete f.s.flags[`blank:${ultron.id}`];
    f.s.flags[`blank:${env.id}`] = true;
    expect(visionEnemyAttackInitiated(f.s, ultron, "p2", f.ports)).toEqual([
      { type: "drone", actorId: "p2" },
    ]);
    f.s.environments = [];
    expect(visionEnemyAttackInitiated(f.s, ultron, "p2", f.ports)).toEqual([]);
  });
  it("Core Ultron Drones also satisfies the printed-name condition on Vision's nemesis", () => {
    const { f, piece, run } = fixture(),
      env = piece("01140"),
      ultron = piece("26029"),
      a = piece("26024"),
      b = piece("26025");
    f.s.environments!.push(env);
    f.s.player.deck.push(a, b);
    expect(visionEnemyAttackInitiated(f.s, ultron, "p1", f.ports)).toEqual([
      { type: "drone", actorId: "p1" },
    ]);
    run(V("relentless"));
    expect(f.s.minions.map((p) => p.droneCard?.id)).toEqual([a.id, b.id]);
  });
  it("Unleashed chooses between matching physical Core and Vision environments across saved prompts", () => {
    const { f, piece, run, choose } = fixture(),
      core = piece("01140"),
      original = piece("26031");
    f.s.encounter.discard.push(core);
    f.s.player.setAside!.push(original);
    run(V("unleashed"));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      core.id,
      original.id,
    ]);
    choose(core.id);
    expect(f.s.environments!.map((p) => p.id)).toEqual([core.id]);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual([original.id]);
    expect(f.history).toEqual(["shuffle-encounter"]);
  });
  it("Relentless still uses its Drone branch if the named environment is blanked", () => {
    const { f, piece, run } = fixture(),
      env = piece("26031"),
      a = piece("26024"),
      b = piece("26025");
    f.s.environments!.push(env);
    f.s.flags[`blank:${env.id}`] = true;
    f.s.player.deck.push(a, b);
    run(V("relentless"));
    expect(f.s.minions.map((p) => p.droneCard?.id)).toEqual([a.id, b.id]);
    expect(f.history).not.toContain("random:2");
  });
  it("Relentless Android creates two original owned drones while Drones is active", () => {
    const { f, piece, run } = fixture(),
      a = piece("26024"),
      b = piece("26025");
    f.s.player.deck.push(a, b);
    f.s.environments!.push(piece("26031"));
    run(...visionEncounterReveal(f.s, piece("26032"))!);
    expect(f.s.minions.map((p) => p.droneCard?.id)).toEqual([a.id, b.id]);
    expect(f.history).not.toContain("random:2");
    expect(visionDroneStats(f.s, f.s.minions[0], f.ports)).toEqual({
      attack: 1,
      scheme: 1,
      health: 1,
    });
  });
  it("Relentless Android discards up to two actual hand cards only if Drones is absent", () => {
    const { f, piece, run } = fixture(),
      a = piece("26024");
    f.s.player.hand.push(a);
    run(V("relentless"));
    expect(f.s.player.discard.map((p) => p.id)).toEqual([a.id]);
    expect(f.s.minions).toEqual([]);
    expect(f.history).toEqual(["random:2"]);
  });
  it("numeric boost icons remain 2/2/3/0/2 with no invented starred abilities", () => {
    const { f, piece } = fixture();
    expect(
      ["26028", "26029", "26030", "26031", "26032"].map(
        (c) => cards.get(c)?.boost || 0,
      ),
    ).toEqual([2, 2, 3, 0, 2]);
    for (const c of ["26028", "26029", "26030", "26031", "26032"])
      expect(visionBoost(f.s, piece(c))).toEqual([]);
  });
});
