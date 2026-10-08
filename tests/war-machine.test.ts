import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import {
  consumeStatus,
  consumeTough,
  printedKeyword,
} from "../src/game/keywords.js";
import { seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  WAR_MACHINE_SCRIPT_CODES,
  resolveWarMachineEffect,
  warMachineAbility,
  warMachineAbilityOptions,
  warMachineAllyEnter,
  warMachineAmmo,
  warMachineBeforeEvent,
  warMachineBoost,
  warMachineEncounterReveal,
  warMachineEnemyKeywords,
  warMachineEvent,
  warMachineFormChanged,
  warMachineInitializeNemesis,
  warMachinePhaseEnded,
  warMachinePlayRestriction,
  warMachineResourceSources,
  warMachineResourceSpent,
  warMachineSchemeDefeated,
  warMachineShadowOfPast,
  warMachineTraits,
  type WarMachinePorts,
} from "../src/game/war-machine.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const W = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `war-machine:${type}`,
  ...args,
});
function saved(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s)),
    seat = copy.players.find((p) => p.id === copy.activePlayerId)!;
  seat.player = copy.player;
  seat.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 23001,
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
  s.heroId = s.players[0].heroId = "warm";
  s.phase = "player";
  s.turnPlayerId = s.activePlayerId = "p1";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.exhausted = false;
    v.player.flipped = false;
    v.player.hp = 10;
    v.player.stunned = v.player.confused = v.player.tough = false;
    v.flags.warMachineAmmo = 0;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 10;
  const f: {
    s: GameState;
    ports: WarMachinePorts;
    packets: Effect[];
    receipts: Effect[];
    batches: string[][];
    history: string[];
    piece(code: string): Piece;
  } = {
    s,
    ports: {} as WarMachinePorts,
    packets: [],
    receipts: [],
    batches: [],
    history: [],
    piece: (code) => ({ ...makePiece(f.s, code), ownerId: f.s.activePlayerId }),
  };
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (s) => !s.flags.formLocked,
    flip: (s, _counts, target) => {
      const from = s.player.form,
        to = target === "alter" ? "alter" : "hero";
      s.player.form = to;
      f.ports.queue(s, ...warMachineFormChanged(s, from, to, f.ports));
    },
    canReadyIdentity: () => false,
    canReadyPiece: (s, p) => !s.flags[`cannotReady:${p.id}`],
    canPay: () => true,
    canGiveStatus: (s, id, status) => {
      const target = id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player
        : s.minions.find((p) => p.id === id);
      return !!target && !target[status];
    },
    enemyTargets: (s, attack) => [
      ...(!attack ||
      !s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Guard"))
        ? [{ id: s.villain.id, label: "Rhino" }]
        : []),
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (s) => [
      ...(s.scheme.threat > 0 &&
      !s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
        ? [{ id: "main", label: "Main scheme" }]
        : []),
      ...s.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    isIdentityTextBlank: (s) => !!s.flags.identityBlank,
    discardHand: (s, id) => {
      const i = s.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) s.player.discard.push(s.player.hand.splice(i, 1)[0]);
    },
    discardPiece: (s, id) => {
      for (const seat of s.players) {
        const p = seatView(s, seat).player,
          i = p.inPlay.findIndex((p) => p.id === id);
        if (i >= 0) {
          p.discard.push(p.inPlay.splice(i, 1)[0]);
          return;
        }
      }
      throw Error("Missing actual source");
    },
    revealHidden: () => {
      f.history.push("reveal-hidden");
    },
    recycleEncounter: vi.fn(),
    attackProgram: (s, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(s, ...effects, ...after);
    },
    log: vi.fn(),
    makePiece: (s, code) => makePiece(s, code),
    shuffleEncounter: vi.fn(),
    shufflePlayerDeck: (s, after) => {
      f.history.push("shuffle-deck");
      f.ports.queue(s, ...after);
    },
    canDiscardUpgrade: (s, p) =>
      !s.flags[`cannotDiscard:${p.id}`] &&
      !printedKeyword(cards.get(p.code)!, "Permanent"),
    damageBatch: (s, ids, amount, source) => {
      f.batches.push(ids);
      f.ports.queue(
        s,
        ...ids.map((target) => ({
          type: "damage",
          target,
          amount,
          source,
          attack: false,
        })),
      );
    },
  };
  const resolve = (e: Effect) => {
    if (resolveWarMachineEffect(f.s, e, f.ports)) return;
    switch (e.type) {
      case "optional":
        f.ports.choose(f.s, e.title, e.text, [
          { id: "yes", label: "Yes", effects: e.effects },
          { id: "no", label: "No", effects: [] },
        ]);
        break;
      case "fixture:event": {
        f.receipts.push(e);
        if (["23008", "23011"].includes(e.piece.code) && f.s.player.stunned)
          consumeStatus(f.s.player, "stunned");
        else if (e.piece.code === "23009" && f.s.player.confused)
          consumeStatus(f.s.player, "confused");
        else
          f.ports.queue(
            f.s,
            ...(warMachineEvent(f.s, e.piece, e.warMachineTarget) || []),
          );
        break;
      }
      case "damage": {
        f.packets.push(e);
        if (e.target.startsWith("hero:")) {
          const p = seatView(f.s, e.target.slice(5)).player;
          if (!consumeTough(p)) p.hp -= e.amount;
          break;
        }
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
        const p = seatView(f.s, e.target.slice(5)).player;
        p[e.status as "tough"] = true;
        break;
      }
      case "flip":
        f.ports.flip(f.s, false, e.target);
        break;
      case "surge":
        f.history.push(`surge:${e.sourceCode}`);
        if (f.s.encounter.deck.length)
          f.s.encounter.dealt.push(f.s.encounter.deck.shift()!);
        break;
      case "discardEncounter":
        f.s.encounter.discard.push(e.piece);
        break;
      case "removeEncounter":
        f.s.removed.push(e.piece);
        break;
      case "reveal":
        if (cards.get(e.piece.code)?.type_code === "minion")
          f.s.minions.push(e.piece);
        else f.s.sideSchemes.push(e.piece);
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
    f.s = saved(f.s);
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    f.ports.queue(f.s, ...o!.effects);
    return pump();
  };
  const put = (code: string) => {
    const p = f.piece(code);
    f.s.player.inPlay.push(p);
    return p;
  };
  const cast = (p: Piece) =>
    run(
      ...(warMachineBeforeEvent(f.s, p, [
        { type: "fixture:event", piece: p },
      ]) || []),
    );
  return Object.assign(f, { run, pump, choose, put, cast });
}

describe("War Machine original faces and printed accounting", () => {
  it("registers exactly sixteen dedicated faces and fifteen physical signature cards", () => {
    expect(WAR_MACHINE_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(WAR_MACHINE_SCRIPT_CODES).size).toBe(16);
    for (const code of WAR_MACHINE_SCRIPT_CODES)
      expect(cards.has(code)).toBe(true);
    const signatures = [...cards.values()].filter(
      (c) =>
        c.set_code === "warm" &&
        c.faction_code === "hero" &&
        !["hero", "alter_ego"].includes(c.type_code),
    );
    expect(signatures.map((p) => p.code)).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `230${String(i + 2).padStart(2, "0")}`,
      ),
    );
    expect(signatures.reduce((n, c) => n + Number(c.quantity), 0)).toBe(15);
    expect(cards.get("23001a")).toMatchObject({
      set_code: "warm",
      health: 10,
      attack: 2,
      thwart: 1,
      defense: 2,
      hand_size: 5,
    });
    expect(cards.get("23001b")).toMatchObject({ recover: 3, hand_size: 6 });
    expect(cards.get("23001b")?.text).toContain("Limit once per phase");
    expect(cards.get("23010")?.traits).toBe("Tactic.");
  });
  it("initializes five separate nemesis instances only when their zone is missing", () => {
    const f = fixture();
    delete f.s.player.setAside;
    warMachineInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    expect(f.s.player.setAside!.map((p) => p.code)).toEqual([
      "23029",
      "23030",
      "23031",
      "23031",
      "23031",
    ]);
    expect(new Set(ids).size).toBe(5);
    warMachineInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
    f.s.player.setAside = [];
    warMachineInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual([]);
  });
  it("returns false for another module's effect", () => {
    const f = fixture();
    expect(resolveWarMachineEffect(f.s, { type: "venom:event" }, f.ports)).toBe(
      false,
    );
  });
});

describe("Actual form responses and ammo zones", () => {
  it("does not grant initial-setup ammo or retrigger an unchanged form", () => {
    const f = fixture();
    expect(warMachineFormChanged(f.s, "hero", "hero", f.ports)).toEqual([]);
    expect(warMachineAmmo(f.s)).toBe(0);
  });
  it("can choose Chassis before Locked and Loaded through saved response windows", () => {
    const f = fixture(),
      p = f.put("23004");
    f.run(...warMachineFormChanged(f.s, "alter", "hero", f.ports));
    f.choose(p.id);
    expect(f.s.player.tough).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(0);
    f.choose("identity");
    expect(warMachineAmmo(f.s)).toBe(5);
    expect(f.s.prompt).toBeNull();
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
  });
  it("may decline both responses without gaining ammo or exhausting Chassis", () => {
    const f = fixture();
    f.put("23004");
    f.run(...warMachineFormChanged(f.s, "alter", "hero", f.ports));
    f.choose("continue");
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
  });
  it("adds five to existing ammo when the actual hero response resolves", () => {
    const f = fixture();
    f.s.flags.warMachineAmmo = 3;
    f.run(...warMachineFormChanged(f.s, "alter", "hero", f.ports));
    f.choose("identity");
    expect(warMachineAmmo(f.s)).toBe(8);
  });
  it("already Tough prevents Chassis exhaustion while the ammo response remains legal", () => {
    const f = fixture(),
      p = f.put("23004");
    f.s.player.tough = true;
    f.run(...warMachineFormChanged(f.s, "alter", "hero", f.ports));
    expect(f.s.prompt?.options.some((o) => o.id === p.id)).toBe(false);
    f.choose("identity");
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
  });
  it("a blank identity suppresses its own responses, while printed Chassis still responds", () => {
    const f = fixture(),
      p = f.put("23004");
    f.s.flags.identityBlank = true;
    f.run(...warMachineFormChanged(f.s, "alter", "hero", f.ports));
    expect(f.s.prompt?.options.some((o) => o.id === "identity")).toBe(false);
    f.choose(p.id);
    expect(f.s.player.tough).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(0);
  });
  it("alter ego discards identity ammo, preserving all physical Bunker counters", () => {
    const f = fixture(),
      bunker = f.put("23003");
    bunker.counters = 6;
    f.s.flags.warMachineAmmo = 7;
    f.s.player.form = "alter";
    expect(warMachineFormChanged(f.s, "hero", "alter", f.ports)).toEqual([]);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(bunker.counters).toBe(6);
  });
  it("does not resolve a blank alter-ego forced response", () => {
    const f = fixture();
    f.s.flags.warMachineAmmo = 4;
    f.s.flags.identityBlank = true;
    f.s.player.form = "alter";
    warMachineFormChanged(f.s, "hero", "alter", f.ports);
    expect(warMachineAmmo(f.s)).toBe(4);
  });
  it("Chassis grants Aerial only to the hero form and stops while blank", () => {
    const f = fixture(),
      p = f.put("23004");
    expect(warMachineTraits(f.s)).toEqual(["Aerial"]);
    f.s.player.form = "alter";
    expect(warMachineTraits(f.s)).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags[`blank:${p.id}`] = true;
    expect(warMachineTraits(f.s, f.ports)).toEqual([]);
  });
});

describe("Physical actions, recovery and Iron Man search", () => {
  it("James Rhodes shuffles an actual signature card once per phase using current erratum", () => {
    const f = fixture(),
      p = f.piece("23011"),
      basic = f.piece("23025");
    f.s.player.form = "alter";
    f.s.player.discard.push(p, basic);
    expect(warMachineAbility(f.s, "hero", f.ports, "recover-war-machine")).toBe(
      true,
    );
    f.pump();
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    f.choose(p.id);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([p.id]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([basic.id]);
    expect(f.history).toContain("shuffle-deck");
    expect(warMachineAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.phase = "villain";
    f.s.player.discard.push(f.s.player.deck.pop()!);
    expect(warMachineAbilityOptions(f.s, "hero", f.ports)).toHaveLength(1);
  });
  it("phase cleanup resets the recovering phase flag for every seat", () => {
    const f = fixture(true);
    for (const p of f.s.players)
      seatView(f.s, p).flags.warMachineRecoverPhase = "1:player";
    warMachinePhaseEnded(f.s);
    for (const p of f.s.players)
      expect(seatView(f.s, p).flags.warMachineRecoverPhase).toBeUndefined();
  });
  it("Munitions Bunker stores two physically, then transfers every stored ammo after a form change", () => {
    const f = fixture(),
      bunker = f.put("23003");
    f.s.player.form = "alter";
    f.s.flags.warMachineAmmo = 9;
    warMachineAbility(f.s, bunker.id, f.ports, "store-ammo");
    f.pump();
    expect(bunker.counters).toBe(2);
    expect(warMachineAmmo(f.s)).toBe(9);
    expect(bunker.exhausted).toBe(true);
    bunker.exhausted = false;
    bunker.counters += 4;
    f.s.player.form = "hero";
    warMachineAbility(f.s, bunker.id, f.ports, "transfer-ammo");
    f.pump();
    expect(warMachineAmmo(f.s)).toBe(15);
    expect(bunker.counters).toBe(0);
    expect(bunker.exhausted).toBe(true);
  });
  it("an empty Bunker cannot exhaust solely to transfer zero ammo", () => {
    const f = fixture(),
      p = f.put("23003");
    expect(warMachineAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(p.exhausted).toBe(false);
  });
  it("Iron Man responds to any entry and returns the actual discard Tech upgrade", () => {
    const f = fixture(),
      iron = f.put("23002"),
      tech = f.piece("23005"),
      nonTech = f.piece("23003");
    f.s.player.discard.push(tech);
    f.s.player.deck.push(nonTech);
    f.run(...warMachineAllyEnter(f.s, iron, f.ports)!);
    f.choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([tech.id]);
    f.choose(tech.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([tech.id]);
    expect(f.s.player.discard).toEqual([]);
    expect(f.s.player.deck[0].id).toBe(nonTech.id);
    expect(f.history).toContain("shuffle-deck");
  });
  it("Iron Man searches Tech upgrades from the physical deck, not just signatures", () => {
    const f = fixture(),
      iron = f.put("23002"),
      tech = f.piece("01037");
    f.s.player.deck.push(tech);
    f.run(...warMachineAllyEnter(f.s, iron, f.ports)!);
    f.choose("yes");
    f.choose(tech.id);
    expect(f.s.player.hand[0].id).toBe(tech.id);
  });
  it("Iron Man can decline without searching or shuffling", () => {
    const f = fixture(),
      iron = f.put("23002");
    f.run(...warMachineAllyEnter(f.s, iron, f.ports)!);
    f.choose("no");
    expect(f.history).toEqual([]);
  });
});

describe("Gauntlet Gun resource and additional ammo costs", () => {
  it.each(["23008", "23009", "23010", "23011"])(
    "generates its actual resource only for War Machine event %s",
    (code) => {
      const f = fixture(),
        gun = f.put("23005");
      expect(
        warMachineResourceSources(f.s, code, f.ports).map((p) => p.id),
      ).toEqual([gun.id]);
      expect(gun.exhausted).toBe(false);
      expect(warMachineAmmo(f.s)).toBe(0);
    },
  );
  it.each([undefined, "23006", "23024", "01053", "23003"])(
    "does not generate an ammo resource for %s",
    (code) => {
      const f = fixture(),
        gun = f.put("23005");
      expect(warMachineResourceSources(f.s, code, f.ports)).toEqual([]);
      expect(() => warMachineResourceSpent(f.s, gun.id, code, f.ports)).toThrow(
        /event payment/,
      );
      expect(gun.exhausted).toBe(false);
      expect(warMachineAmmo(f.s)).toBe(0);
    },
  );
  it("a zero-ammo Gauntlet resource pays Repulsor Beam and supplies its required ammo before status replacement", () => {
    const f = fixture(),
      gun = f.put("23005"),
      p = f.piece("23008");
    warMachineResourceSpent(f.s, gun.id, p.code, f.ports);
    expect(warMachineAmmo(f.s)).toBe(1);
    f.cast(p);
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(46);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(gun.exhausted).toBe(true);
    expect(f.receipts[0].warMachineAmmoCostPaid).toBe(true);
  });
  it("two committed Gauntlets turn two existing ammo into a legal Full Auto cost", () => {
    const f = fixture(),
      a = f.put("23005"),
      b = f.put("23005"),
      p = f.piece("23011");
    f.s.flags.warMachineAmmo = 2;
    warMachineResourceSpent(f.s, a.id, p.code, f.ports);
    warMachineResourceSpent(f.s, b.id, p.code, f.ports);
    f.cast(p);
    expect(f.s.prompt?.title).toMatch(/additional cost/);
    f.choose(f.s.villain.id);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.villain.hp).toBe(42);
    expect(f.receipts[0].warMachineTarget).toBe(f.s.villain.id);
    expect(f.packets).toHaveLength(1);
    expect(f.packets[0]).toMatchObject({
      amount: 8,
      attack: true,
      overkill: true,
    });
  });
  it("blank or exhausted Gauntlets cannot be spent twice or provide hypothetical ammo", () => {
    const f = fixture(),
      gun = f.put("23005");
    f.s.flags[`blank:${gun.id}`] = true;
    expect(warMachineResourceSources(f.s, "23008", f.ports)).toEqual([]);
    expect(() =>
      warMachineResourceSpent(f.s, gun.id, "23008", f.ports),
    ).toThrow();
    delete f.s.flags[`blank:${gun.id}`];
    warMachineResourceSpent(f.s, gun.id, "23008", f.ports);
    expect(() =>
      warMachineResourceSpent(f.s, gun.id, "23008", f.ports),
    ).toThrow();
    expect(warMachineAmmo(f.s)).toBe(1);
  });
  it("does not spend Gun/ammo when resource payment is merely offered then canceled", () => {
    const f = fixture(),
      gun = f.put("23005");
    const offered = warMachineResourceSources(f.s, "23008", f.ports);
    f.s = saved(f.s);
    expect(offered).toHaveLength(1);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.inPlay[0].id).toBe(gun.id);
  });
  it("play availability can ask the native host for correlated ammo and resource funding", () => {
    const f = fixture(),
      p = f.piece("23011");
    const funded = vi.fn(() => true);
    expect(
      warMachinePlayRestriction(f.s, p, { canPayEventWithAmmo: funded }),
    ).toBeNull();
    expect(funded).toHaveBeenCalledWith(f.s, p, 4);
    expect(
      warMachinePlayRestriction(f.s, p, { canPayEventWithAmmo: () => false }),
    ).toMatch(/resource cost/);
    f.s.player.form = "alter";
    expect(
      warMachinePlayRestriction(f.s, p, { canPayEventWithAmmo: funded }),
    ).toMatch(/hero/);
  });
  it("Repulsor's ammo cost is still paid when Stun replaces its attack", () => {
    const f = fixture(),
      p = f.piece("23008");
    f.s.flags.warMachineAmmo = 1;
    f.s.player.stunned = true;
    f.cast(p);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.villain.hp).toBe(50);
    expect(f.packets).toEqual([]);
  });
  it("Targeted Strike's ammo cost is still paid when Confuse replaces the thwart", () => {
    const f = fixture(),
      p = f.piece("23009");
    f.s.flags.warMachineAmmo = 1;
    f.s.player.confused = true;
    f.cast(p);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.confused).toBe(false);
    expect(f.s.scheme.threat).toBe(10);
  });
  it("Full Auto chooses its physical enemy and spends four ammo even when Stun replaces all attack effects", () => {
    const f = fixture(),
      p = f.piece("23011"),
      guard = f.piece("01101");
    f.s.minions.push(guard);
    f.s.flags.warMachineAmmo = 4;
    f.s.player.stunned = true;
    f.cast(p);
    expect(f.s.prompt?.options.some((o) => o.id === f.s.villain.id)).toBe(true);
    f.choose(f.s.villain.id);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.stunned).toBe(false);
    expect(f.packets).toEqual([]);
    expect(f.receipts[0].warMachineTarget).toBe(f.s.villain.id);
  });
  it("without enough committed ammo the additional cost cannot resolve", () => {
    const f = fixture();
    f.s.flags.warMachineAmmo = 3;
    expect(() => f.cast(f.piece("23011"))).toThrow(/ammo cost/);
    expect(warMachineAmmo(f.s)).toBe(3);
  });
});

describe("Printed attack packets and Scorched Earth", () => {
  it("Targeted Strike removes three threat after its actual ammo payment", () => {
    const f = fixture();
    f.s.flags.warMachineAmmo = 1;
    f.cast(f.piece("23009"));
    f.choose("main");
    expect(f.s.scheme.threat).toBe(7);
    expect(f.packets[0]).toMatchObject({
      amount: 3,
      source: "hero",
      action: true,
    });
  });
  it("Scorched Earth is simultaneous nonattack damage to every enemy across engaged seats", () => {
    const f = fixture(true),
      a = f.piece("01103"),
      b = f.piece("01103");
    a.engagedWith = "p1";
    b.engagedWith = "p2";
    f.s.minions.push(a, b);
    f.s.flags.warMachineAmmo = 3;
    f.s.player.stunned = true;
    f.cast(f.piece("23010"));
    expect(f.batches).toEqual([[f.s.villain.id, a.id, b.id]]);
    expect(f.packets.every((p) => p.attack === false)).toBe(true);
    expect(f.s.villain.hp).toBe(47);
    expect(a.damage).toBe(3);
    expect(b.damage).toBe(3);
    expect(f.s.player.stunned).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(0);
  });
  it("Missile Launcher spends ammo/exhausts its actual source and makes one ranged two-damage attack", () => {
    const f = fixture(),
      p = f.put("23006");
    f.s.flags.warMachineAmmo = 1;
    warMachineAbility(f.s, p.id, f.ports, "attack");
    f.pump();
    f.choose(f.s.villain.id);
    expect(f.packets).toHaveLength(1);
    expect(f.packets[0]).toMatchObject({
      amount: 2,
      attack: true,
      ranged: true,
      abilitySource: p.id,
    });
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Stun still pays Missile Launcher's exhaustion and ammo but cancels its ranged attack", () => {
    const f = fixture(),
      p = f.put("23006");
    f.s.flags.warMachineAmmo = 1;
    f.s.player.stunned = true;
    warMachineAbility(f.s, p.id, f.ports, "attack");
    f.pump();
    expect(p.exhausted).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(0);
    expect(f.s.player.stunned).toBe(false);
    expect(f.packets).toEqual([]);
  });
  it("Shoulder Cannon spends no ammo until its optional printed ready clause", () => {
    const f = fixture(),
      p = f.put("23007");
    f.s.flags.warMachineAmmo = 2;
    warMachineAbility(f.s, p.id, f.ports, "attack");
    f.pump();
    f.choose(f.s.villain.id);
    expect(warMachineAmmo(f.s)).toBe(2);
    expect(f.packets[0]).toMatchObject({ amount: 1, attack: true });
    f.choose("ready");
    expect(warMachineAmmo(f.s)).toBe(1);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Shoulder Cannon may remain exhausted and keep the optional ammo", () => {
    const f = fixture(),
      p = f.put("23007");
    f.s.flags.warMachineAmmo = 1;
    warMachineAbility(f.s, p.id, f.ports, "attack");
    f.pump();
    f.choose(f.s.villain.id);
    f.choose("continue");
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(1);
  });
  it("Stun cancels Shoulder Cannon's ready sentence as well as its damage", () => {
    const f = fixture(),
      p = f.put("23007");
    f.s.flags.warMachineAmmo = 2;
    f.s.player.stunned = true;
    warMachineAbility(f.s, p.id, f.ports, "attack");
    f.pump();
    expect(f.s.prompt).toBeNull();
    expect(p.exhausted).toBe(true);
    expect(warMachineAmmo(f.s)).toBe(2);
    expect(f.s.player.stunned).toBe(false);
  });
  it("a prohibited physical ready cannot consume ammo merely to ready Shoulder Cannon", () => {
    const f = fixture(),
      p = f.put("23007");
    p.exhausted = true;
    f.s.flags.warMachineAmmo = 1;
    f.s.flags[`cannotReady:${p.id}`] = true;
    f.run(W("shoulder-ready", { id: p.id }));
    expect(f.s.prompt).toBeNull();
    expect(warMachineAmmo(f.s)).toBe(1);
  });
  it("an un-stunned Full Auto obeys Guard when choosing its cost target", () => {
    const f = fixture(),
      guard = f.piece("01101");
    f.s.minions.push(guard);
    f.s.flags.warMachineAmmo = 4;
    f.cast(f.piece("23011"));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([guard.id]);
    f.choose(guard.id);
    expect(f.packets[0]).toMatchObject({
      target: guard.id,
      amount: 8,
      overkill: true,
    });
  });
});

describe("Actual obligation, nemesis and boost sources", () => {
  it("preserves actual numeric boost counts separately from Laser Strike's boost star", () => {
    expect(cards.get("23030")?.boost).toBe(3);
    expect(cards.get("23031")?.boost).toBe(1);
    expect(cards.get("23031")?.text).toContain("[star] <b>Boost</b>");
  });
  it("Living Laser's own attacks gain Piercing, not the villain's or a player's attacks", () => {
    const f = fixture(),
      laser = f.piece("23029");
    expect(warMachineEnemyKeywords(f.s, laser, f.ports).piercing).toBe(true);
    expect(
      warMachineEnemyKeywords(f.s, f.piece("01103"), f.ports).piercing,
    ).toBe(false);
    f.s.flags[`blank:${laser.id}`] = true;
    expect(warMachineEnemyKeywords(f.s, laser, f.ports).piercing).toBe(false);
    expect(printedKeyword(cards.get(laser.code)!, "Quickstrike")).toBe(1);
  });
  it("Shadows reserves actual five sources and moves each only at its saved reveal continuation", () => {
    const f = fixture();
    delete f.s.player.setAside;
    warMachineInitializeNemesis(f.s, f.ports);
    const set = [...f.s.player.setAside!],
      effects = warMachineShadowOfPast(f.s)!;
    expect(f.s.player.setAside).toHaveLength(5);
    f.s = saved(f.s);
    f.run(...effects);
    expect(f.s.player.setAside).toEqual([]);
    expect(f.s.minions.map((p) => p.id)).toEqual([set[0].id]);
    expect(f.s.sideSchemes.map((p) => p.id)).toEqual([set[1].id]);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(
      set.slice(2).map((p) => p.id),
    );
    expect(warMachineShadowOfPast(f.s)?.[0].type).toBe("surge");
  });
  it("does not reconstruct a nemesis piece which already left set aside", () => {
    const f = fixture();
    delete f.s.player.setAside;
    warMachineInitializeNemesis(f.s, f.ports);
    const laser = f.s.player.setAside!.shift()!;
    f.s.encounter.discard.push(laser);
    f.run(...warMachineShadowOfPast(f.s)!);
    expect(f.s.minions).toEqual([]);
    expect(f.history).toContain("surge:01190");
    expect(f.s.encounter.discard.find((p) => p.id === laser.id)).toBeTruthy();
  });
  it("Deadly Light Show damages every identity including alter ego through a single nonattack batch", () => {
    const f = fixture(true),
      scheme = f.piece("23030");
    seatView(f.s, "p2").player.form = "alter";
    f.s.player.tough = true;
    f.run(...warMachineSchemeDefeated(f.s, scheme));
    expect(f.batches).toEqual([["hero:p1", "hero:p2"]]);
    expect(f.s.player.hp).toBe(10);
    expect(f.s.player.tough).toBe(false);
    expect(seatView(f.s, "p2").player.hp).toBe(9);
    expect(f.packets.every((p) => p.attack === false)).toBe(true);
  });
  it("Laser Strike discards the chosen physical upgrade and does not Surge when a legal upgrade exists", () => {
    const f = fixture(),
      a = f.put("23005"),
      b = f.put("23004");
    f.run(...warMachineEncounterReveal(f.s, f.piece("23031"))!);
    f.choose(b.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([b.id]);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([a.id]);
    expect(f.history).toEqual([]);
  });
  it("Laser Strike gains native Surge when no discardable upgrade exists", () => {
    const f = fixture(),
      p = f.put("23004");
    f.s.flags[`cannotDiscard:${p.id}`] = true;
    f.run(...warMachineEncounterReveal(f.s, f.piece("23031"))!);
    expect(f.history).toContain("surge:23031");
    expect(f.s.player.inPlay).toHaveLength(1);
  });
  it.each(["none", undefined])(
    "the original Laser Strike boost forces upgrade discard during undefended attack (%s)",
    (defender) => {
      const f = fixture(),
        p = f.put("23004");
      f.s.attack = { defender } as GameState["attack"];
      f.run(...warMachineBoost(f.s, f.piece("23031"))!);
      f.choose(p.id);
      expect(f.s.player.discard[0].id).toBe(p.id);
      expect(f.history).toEqual([]);
    },
  );
  it("a defended Laser Strike boost and a scheming boost do not discard upgrades", () => {
    const f = fixture();
    f.put("23004");
    f.s.attack = { defender: "hero" } as GameState["attack"];
    expect(warMachineBoost(f.s, f.piece("23031"))).toEqual([]);
    f.s.attack = null;
    expect(warMachineBoost(f.s, f.piece("23031"))).toEqual([]);
  });
  it.each([0, 1, 2, 3, 5])(
    "Equipment Malfunction removes %s actual ammo and only surges below three",
    (count) => {
      const f = fixture(),
        bunker = f.put("23003"),
        p = f.piece("23028");
      bunker.counters = 4;
      f.s.flags.warMachineAmmo = count;
      f.run(...warMachineEncounterReveal(f.s, p)!);
      f.choose("stay");
      f.choose("ammo");
      expect(warMachineAmmo(f.s)).toBe(0);
      expect(f.history.includes("surge:23028")).toBe(count <= 2);
      expect(f.s.encounter.discard[0].id).toBe(p.id);
      expect(f.s.player.inPlay[0].counters).toBe(4);
    },
  );
  it("free obligation change to alter ego first clears ammo, so choosing the ammo option now surges", () => {
    const f = fixture(),
      p = f.piece("23028");
    f.s.flags.warMachineAmmo = 5;
    f.run(...warMachineEncounterReveal(f.s, p)!);
    f.choose("alter");
    expect(warMachineAmmo(f.s)).toBe(0);
    f.choose("ammo");
    expect(f.history).toContain("surge:23028");
    expect(f.s.player.flipped).toBe(false);
  });
  it("exhausting the actual alter ego removes the physical obligation rather than discarding it", () => {
    const f = fixture(),
      p = f.piece("23028");
    f.run(...warMachineEncounterReveal(f.s, p)!);
    f.choose("alter");
    f.choose("exhaust");
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.some((q) => q.id === p.id)).toBe(true);
    expect(f.s.encounter.discard).toEqual([]);
  });
  it("a form lock prevents free obligation flipping without preventing the ammo option", () => {
    const f = fixture(),
      p = f.piece("23028");
    f.s.flags.formLocked = true;
    f.s.flags.warMachineAmmo = 3;
    f.run(...warMachineEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["ammo"]);
    f.choose("ammo");
    expect(f.s.player.form).toBe("hero");
    expect(f.history).toEqual([]);
  });
});
