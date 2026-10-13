import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import {
  consumeStatus,
  giveStatus,
  printedKeyword,
} from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import * as shadowcat from "../src/game/shadowcat.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const S = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `shadowcat:${type}`,
  ...args,
});
function hydrate(s: GameState): GameState {
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
    seed: 32030,
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
  s.heroId = s.players[0].heroId = "shadowcat";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    Object.assign(v.player, {
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
      setAside: [],
      hp: 9,
      form: "hero",
      exhausted: false,
      flipped: false,
      stunned: false,
      confused: false,
      tough: false,
    });
    v.flags = seat.flags = {};
    if (seat.id === s.activePlayerId) s.flags = seat.flags;
  }
  Object.assign(s, {
    phase: "player",
    prompt: null,
    review: null,
    queue: [],
    resolving: [],
    minions: [],
    attachments: [],
    sideSchemes: [],
  });
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.scheme.threat = 20;
  const f = {
    s,
    history: [] as string[],
    packets: [] as Effect[],
    ports: {} as shadowcat.ShadowcatPorts,
  };
  const piece = (code: string, ownerId = f.s.activePlayerId) => ({
    ...makePiece(f.s, code),
    ownerId,
  });
  const textBlank = (s: GameState, p: Piece) => !!s.flags[`blank:${p.id}`];
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    makePiece,
    canChangeForm: (s) => !s.flags.formLocked,
    canChangeMassForm: (s) => !s.flags.formLocked,
    flip: (s, counts) => {
      s.player.form = s.player.form === "hero" ? "alter" : "hero";
      if (counts) s.player.flipped = true;
    },
    canReadyIdentity: () => true,
    canPay: (s) => !s.flags.cannotPay,
    cardCost: (_s, p) => cards.get(p.code)?.cost || 0,
    maxHeroHP: (s) => Number(s.flags.maxHP || 9),
    isTextBlank: textBlank,
    isIdentityTextBlank: (s) => !!s.flags.identityBlank,
    canGiveStatus: (s, target, status) => {
      const v = target.startsWith("hero:") ? seatView(s, target.slice(5)) : s;
      const p =
        target === "hero" || target.startsWith("hero:")
          ? v.player
          : target === s.villain.id
            ? s.villain
            : s.minions.find((p) => p.id === target);
      return (
        !!p &&
        giveStatus({ ...p }, { text: "" }, status, {
          steady: !!v.flags.steady,
          stalwart: !!v.flags.stalwart,
        })
      );
    },
    giveStatus: (s, target, status) => {
      const v = target.startsWith("hero:") ? seatView(s, target.slice(5)) : s;
      const p =
        target === "hero" || target.startsWith("hero:")
          ? v.player
          : target === s.villain.id
            ? s.villain
            : s.minions.find((p) => p.id === target);
      if (p)
        giveStatus(p, { text: "" }, status, {
          steady: !!v.flags.steady,
          stalwart: !!v.flags.stalwart,
        });
    },
    enemyTargets: (s, attack, ignore) => [
      ...(!attack ||
      ignore ||
      !s.minions.some(
        (p) =>
          (p.engagedWith || s.activePlayerId) === s.activePlayerId &&
          printedKeyword(cards.get(p.code)!, "Guard") &&
          !textBlank(s, p),
      )
        ? [{ id: s.villain.id, label: "Rhino" }]
        : []),
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (s, thwart, ignoreCrisis, ignorePatrol) => [
      ...(s.scheme.threat > 0 &&
      (!thwart ||
        ignorePatrol ||
        !s.minions.some((p) => printedKeyword(cards.get(p.code)!, "Patrol"))) &&
      (!thwart ||
        ignoreCrisis ||
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
    ],
    attackProgram: (s, effects, after) => {
      f.history.push("attack-program");
      s.queue.unshift(...effects, ...after);
    },
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
    },
    recycleEncounter: () => {},
    log: () => {},
    massFormChanged: (_s, from, to) => {
      f.history.push(`${from}>${to}`);
    },
    canDiscardAttachment: (s, p) =>
      !s.flags[`locked:${p.id}`] && !cards.get(p.code)?.permanent,
    playDefenseEvent: (s, id, after) => {
      f.history.push(`paid:${id}`);
      const p = s.player.hand.find((p) => p.id === id)!;
      f.ports.discardHand(s, id);
      s.queue.unshift(...shadowcat.shadowcatDefenseEvent(s, p)!, ...after);
    },
    declareDefense: (s, id) => {
      f.history.push(`defending:${id}`);
      s.attack!.defender = "hero";
      s.attack!.targetPlayerId = s.activePlayerId;
    },
    giveObligation: (s, p, id) => {
      f.history.push(`obligation:${id}`);
      seatView(s, id).player.inPlay.push(p);
    },
    putMinion: (s, p, id) => {
      p.engagedWith = id;
      s.minions.push(p);
      f.history.push(`put:${p.id}:${id}`);
    },
    shuffleEncounter: () => {
      f.history.push("shuffle");
    },
    wasDamageDealtTo: (s) => !s.flags.redirected,
  };
  function run(...effects: Effect[]) {
    f.ports.queue(f.s, ...effects);
    for (let n = 0; f.s.queue.length && !f.s.prompt && n < 100; n++) {
      f.s = hydrate(f.s);
      const e = f.s.queue.shift()!;
      if (e.actorId) activateSeat(f.s, e.actorId);
      if (shadowcat.resolveShadowcatEffect(f.s, e, f.ports)) continue;
      f.packets.push(e);
      switch (e.type) {
        case "optional":
          f.s.prompt = {
            kind: "choice",
            title: e.title,
            text: e.text,
            options: [
              { id: "yes", label: "Yes", effects: e.effects },
              { id: "no", label: "No", effects: [] },
            ],
          };
          break;
        case "ready":
          if (!f.s.flags.cannotReady) f.s.player.exhausted = false;
          break;
        case "draw":
          f.history.push(`draw:${e.amount}`);
          for (let i = 0; i < e.amount && f.s.player.deck.length; i++)
            f.s.player.hand.push(f.s.player.deck.shift()!);
          break;
        case "heal":
          f.s.player.hp = Math.min(
            Number(f.s.flags.maxHP || 9),
            f.s.player.hp + e.amount,
          );
          break;
        case "damage":
          f.history.push(`damage:${e.amount}`);
          break;
        case "status":
          f.ports.giveStatus(f.s, e.target, e.status);
          break;
        case "removeEncounter": {
          const i = f.s.player.inPlay.findIndex((p) => p.id === e.piece.id);
          if (i >= 0) f.s.removed.push(f.s.player.inPlay.splice(i, 1)[0]);
          break;
        }
      }
    }
  }
  function choose(id: string) {
    f.s = hydrate(f.s);
    const o = f.s.prompt!.options.find((o) => o.id === id);
    expect(o, `Missing choice ${id}`).toBeTruthy();
    f.s.prompt = null;
    run(...o!.effects);
  }
  function addMass(form: shadowcat.ShadowcatMassForm = "solid") {
    const p = piece(form === "solid" ? "32031a" : "32031b");
    f.s.player.inPlay.push(p);
    return p.id;
  }
  function receipt(
    kind: "attack" | "defense" = "attack",
    performed = true,
  ): shadowcat.ShadowcatCompletionReceipt {
    return {
      token: `use:${f.s.nextId++}`,
      playerId: f.s.activePlayerId,
      kind,
      performed,
      massForm: shadowcat.shadowcatMassForm(f.s),
      massId: f.s.player.inPlay.find((p) =>
        ["32031a", "32031b"].includes(p.code),
      )?.id,
    };
  }
  function attack() {
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defender: "none",
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
  }
  return { f, piece, run, choose, addMass, receipt, attack };
}

describe("Shadowcat original physical accounting", () => {
  it("owns eighteen scripted faces and fifteen playing signatures plus one reversible Permanent", () => {
    expect(shadowcat.SHADOWCAT_SCRIPT_CODES).toHaveLength(18);
    const signature = [...cards.values()].filter(
      (c) =>
        c.set_code === "shadowcat" &&
        c.type_code !== "obligation" &&
        !["hero", "alter_ego"].includes(c.type_code) &&
        !c.hidden &&
        !c.permanent,
    );
    expect(signature.reduce((n, c) => n + c.quantity, 0)).toBe(15);
    const starter = sources.find((s) => s.id === "starter-32030a")!;
    expect(Object.values(starter.cards).reduce((n, q) => n + q, 0)).toBe(41);
    expect(starter.cards["32031a" as keyof typeof starter.cards]).toBe(1);
  });
  it("holds the original Permanent outside draw zones then enters Solid after mulligan", () => {
    const { f, piece } = fixture();
    const p = piece("32031b");
    p.exhausted = true;
    p.counters = 4;
    f.s.player.deck.push(p);
    shadowcat.shadowcatInitializeMass(f.s, f.ports);
    expect(f.s.player.deck).toHaveLength(0);
    expect(f.s.player.setAside).toEqual([{ ...p, code: "32031a" }]);
    shadowcat.shadowcatSetup(f.s, f.ports);
    expect(f.s.player.inPlay[0]).toMatchObject({
      id: p.id,
      code: "32031a",
      counters: 4,
      exhausted: true,
    });
    shadowcat.shadowcatSetup(f.s, f.ports);
    expect(f.s.player.inPlay).toHaveLength(1);
  });
  it("rejects duplicate physical Permanent faces", () => {
    const { f, piece } = fixture();
    f.s.player.hand.push(piece("32031a"), piece("32031b"));
    expect(() => shadowcat.shadowcatInitializeMass(f.s, f.ports)).toThrow(
      /one physical/,
    );
  });
  it("creates one original nemesis minion, scheme, two Pawns and attachment only during setup", () => {
    const { f } = fixture();
    f.s.phase = "mulligan";
    shadowcat.shadowcatInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.code)).toEqual([
      "32056",
      "32057",
      "32058",
      "32058",
      "32059",
    ]);
    const ids = f.s.player.setAside!.map((p) => p.id);
    shadowcat.shadowcatInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
  });
  it("never regenerates an empty played reserve", () => {
    const { f } = fixture();
    shadowcat.shadowcatInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual([]);
  });
  it("never regenerates a partial played reserve", () => {
    const { f, piece } = fixture();
    f.s.player.setAside!.push(piece("32058"));
    shadowcat.shadowcatInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toHaveLength(1);
  });
});

describe("real mass forms and completion receipts", () => {
  it("changes only the face, retaining owner, exhaustion, counters and Hero/AE budget", () => {
    const { f, addMass } = fixture();
    const id = addMass();
    Object.assign(f.s.player.inPlay[0], {
      exhausted: true,
      counters: 3,
      damage: 1,
      ownerId: "p2",
    });
    f.s.player.flipped = true;
    shadowcat.shadowcatChangeMassForm(f.s, "phased", f.ports);
    expect(f.s.player.inPlay[0]).toMatchObject({
      id,
      code: "32031b",
      exhausted: true,
      counters: 3,
      damage: 1,
      ownerId: "p2",
    });
    expect(f.s.player.form).toBe("hero");
    expect(f.s.player.flipped).toBe(true);
  });
  it("Phase Control is an alter-ego once-round action with no exhaustion", () => {
    const { f, addMass, run } = fixture();
    addMass();
    expect(shadowcat.shadowcatAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.player.form = "alter";
    run(S("phase-control"));
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("phased");
    expect(f.s.player.exhausted).toBe(false);
    expect(shadowcat.shadowcatAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.round++;
    expect(shadowcat.shadowcatAbilityOptions(f.s, "hero", f.ports)[0].id).toBe(
      "phase-control",
    );
  });
  it("identity blanking suppresses Phase Control but does not blank the mass upgrade", () => {
    const { f, addMass, receipt } = fixture();
    addMass("phased");
    f.s.flags.identityBlank = true;
    expect(shadowcat.shadowcatIgnoresGuardPatrolCrisis(f.s, f.ports)).toBe(
      false,
    );
    expect(
      shadowcat.shadowcatAttackDefenseCompletion(f.s, receipt(), f.ports),
    ).toHaveLength(1);
  });
  it.each(["attack", "defense"] as const)(
    "Solid optional completion after %s flips once for the actual token",
    (kind) => {
      const { f, addMass, receipt, run } = fixture();
      addMass();
      const r = receipt(kind);
      expect(
        shadowcat.shadowcatAttackDefenseCompletion(f.s, r, f.ports),
      ).toEqual([]);
      const o = shadowcat.shadowcatAttackDefenseOptions(f.s, r, [], f.ports)[0];
      run(...o.effects);
      expect(shadowcat.shadowcatMassForm(f.s)).toBe("phased");
      run(...o.effects);
      expect(shadowcat.shadowcatMassForm(f.s)).toBe("phased");
    },
  );
  it.each(["attack", "defense"] as const)(
    "Phased mandatory completion after %s precedes optional responses",
    (kind) => {
      const { f, addMass, receipt, run } = fixture();
      addMass("phased");
      const r = receipt(kind);
      expect(
        shadowcat.shadowcatAttackDefenseOptions(f.s, r, [], f.ports),
      ).toEqual([]);
      run(...shadowcat.shadowcatAttackDefenseCompletion(f.s, r, f.ports), {
        type: "response-marker",
      });
      expect(shadowcat.shadowcatMassForm(f.s)).toBe("solid");
      expect(f.history).toEqual(["phased>solid"]);
      expect(f.packets[0].type).toBe("response-marker");
    },
  );
  it.each(["attack", "defense"] as const)(
    "status/cancellation replaced %s does not flip",
    (kind) => {
      const { f, addMass, receipt } = fixture();
      addMass("phased");
      expect(
        shadowcat.shadowcatAttackDefenseCompletion(
          f.s,
          receipt(kind, false),
          f.ports,
        ),
      ).toEqual([]);
    },
  );
  it("a teammate's attack and an ally attack cannot flip the identity upgrade", () => {
    const { f, addMass, receipt } = fixture(true);
    addMass("phased");
    const r = receipt();
    r.playerId = f.s.players[1].id;
    expect(shadowcat.shadowcatAttackDefenseCompletion(f.s, r, f.ports)).toEqual(
      [],
    );
  });
  it("nested player attack and enclosing defense have distinct completion tokens", () => {
    const { f, addMass, receipt, run } = fixture();
    addMass();
    const nested = receipt("attack");
    run(
      ...shadowcat.shadowcatAttackDefenseOptions(f.s, nested, [], f.ports)[0]
        .effects,
    );
    const defending = receipt("defense");
    run(...shadowcat.shadowcatAttackDefenseCompletion(f.s, defending, f.ports));
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("solid");
    expect(f.history).toEqual(["solid>phased", "phased>solid"]);
  });
  it("mass blanking suppresses completion and damage prohibition but not identity's ignore text", () => {
    const { f, addMass, receipt } = fixture();
    const id = addMass("phased");
    f.s.flags[`blank:${id}`] = true;
    expect(
      shadowcat.shadowcatAttackDefenseCompletion(f.s, receipt(), f.ports),
    ).toEqual([]);
    expect(shadowcat.shadowcatPreventsDamage(f.s, true, f.ports)).toBe(false);
    expect(shadowcat.shadowcatIgnoresGuardPatrolCrisis(f.s, f.ports)).toBe(
      true,
    );
  });
  it("absolute form locks suppress even mandatory flips", () => {
    const { f, addMass, receipt } = fixture();
    addMass("phased");
    f.s.flags.formLocked = true;
    expect(
      shadowcat.shadowcatAttackDefenseCompletion(f.s, receipt(), f.ports),
    ).toEqual([]);
    expect(() =>
      shadowcat.shadowcatChangeMassForm(f.s, "solid", f.ports),
    ).toThrow(/cannot change/);
  });
  it("Phased prohibits attack and nonattack damage only throughout actual defending", () => {
    const { f, addMass } = fixture();
    addMass("phased");
    expect(shadowcat.shadowcatPreventsDamage(f.s, true, f.ports)).toBe(true);
    expect(shadowcat.shadowcatPreventsDamage(f.s, false, f.ports)).toBe(false);
    f.s.player.inPlay[0].code = "32031a";
    expect(shadowcat.shadowcatPreventsDamage(f.s, true, f.ports)).toBe(false);
  });
});

describe("restricted Solid resource and exact ignore receipts", () => {
  it.each(["32037", "32038", "32040", "01005"])(
    "can exhaust actual Solid for Attack/Defense event %s",
    (code) => {
      const { f, addMass } = fixture();
      const id = addMass();
      expect(
        shadowcat.shadowcatResourceSources(f.s, code, f.ports),
      ).toMatchObject([{ id, resources: ["physical"] }]);
      expect(shadowcat.shadowcatResourceSpent(f.s, id, code, f.ports)).toBe(
        true,
      );
      expect(f.s.player.inPlay[0].exhausted).toBe(true);
      shadowcat.shadowcatChangeMassForm(f.s, "phased", f.ports);
      expect(f.s.player.inPlay[0].exhausted).toBe(true);
    },
  );
  it.each(["32039", "32036", "32032", undefined])(
    "cannot generate for unrelated payment %s",
    (code) => {
      const { f, addMass } = fixture();
      const id = addMass();
      expect(shadowcat.shadowcatResourceSources(f.s, code, f.ports)).toEqual(
        [],
      );
      expect(() =>
        shadowcat.shadowcatResourceSpent(f.s, id, code, f.ports),
      ).toThrow(/unavailable/);
    },
  );
  it.each(["alter", "phased", "exhausted", "blank"])(
    "suppresses resource with %s",
    (reason) => {
      const { f, addMass } = fixture();
      const id = addMass(reason === "phased" ? "phased" : "solid");
      if (reason === "alter") f.s.player.form = "alter";
      if (reason === "exhausted") f.s.player.inPlay[0].exhausted = true;
      if (reason === "blank") f.s.flags[`blank:${id}`] = true;
      expect(shadowcat.shadowcatResourceSources(f.s, "32037", f.ports)).toEqual(
        [],
      );
    },
  );
  it.each(["guard", "patrol"] as const)(
    "Acute Control damages only exact ignored %s minion with nonattack damage",
    (kind) => {
      const { f, piece, run } = fixture();
      const target = piece("32058"),
        other = piece("32058"),
        source = piece("32034");
      f.s.minions.push(target, other);
      f.s.player.inPlay.push(source);
      const r: shadowcat.ShadowcatIgnoreReceipt = {
        token: "ignore:1",
        playerId: f.s.activePlayerId,
        kind,
        sourceIds: [target.id],
        performed: true,
      };
      const opts = shadowcat.shadowcatIgnoredKeywordOptions(
        f.s,
        r,
        [],
        f.ports,
      );
      expect(opts).toHaveLength(1);
      run(...opts[0].effects);
      expect(f.packets[0]).toMatchObject({
        type: "damage",
        amount: 2,
        target: target.id,
      });
      expect(f.packets[0].attack).toBeUndefined();
      expect(
        shadowcat.shadowcatIgnoredKeywordOptions(f.s, r, [], f.ports),
      ).toEqual([]);
    },
  );
  it("Interference removes threat only from actual ignored crisis source without thwarting", () => {
    const { f, piece, run } = fixture();
    const target = piece("01107"),
      source = piece("32035");
    target.counters = 4;
    f.s.sideSchemes.push(target);
    f.s.player.inPlay.push(source);
    const r: shadowcat.ShadowcatIgnoreReceipt = {
      token: "crisis:1",
      playerId: f.s.activePlayerId,
      kind: "crisis",
      sourceIds: [target.id],
      performed: true,
    };
    run(
      ...shadowcat.shadowcatIgnoredKeywordOptions(f.s, r, [], f.ports)[0]
        .effects,
    );
    expect(f.packets[0]).toMatchObject({
      type: "thwart",
      action: false,
      target: target.id,
      amount: 2,
    });
  });
  it("no successful ignored receipt means no upgrade response", () => {
    const { f, piece } = fixture();
    f.s.player.inPlay.push(piece("32034"));
    const p = piece("32058");
    f.s.minions.push(p);
    expect(
      shadowcat.shadowcatIgnoredKeywordOptions(
        f.s,
        {
          token: "false",
          playerId: f.s.activePlayerId,
          kind: "guard",
          sourceIds: [p.id],
          performed: false,
        },
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("stale saved ignore target is revalidated before exhausting", () => {
    const { f, piece, run } = fixture();
    const p = piece("32058"),
      source = piece("32034");
    f.s.minions.push(p);
    f.s.player.inPlay.push(source);
    const r: shadowcat.ShadowcatIgnoreReceipt = {
      token: "gone",
      playerId: f.s.activePlayerId,
      kind: "patrol",
      sourceIds: [p.id],
      performed: true,
    };
    const o = shadowcat.shadowcatIgnoredKeywordOptions(f.s, r, [], f.ports)[0];
    f.s.minions = [];
    expect(() => run(...o.effects)).toThrow(/actual ignored/);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
  });
});

describe("signature events, entry and native timing", () => {
  it("Surprise uses one native attack and readies inside its complete printed ability", () => {
    const { f, addMass, piece, run, choose } = fixture();
    addMass();
    f.s.player.exhausted = true;
    const p = piece("32037");
    run(...shadowcat.shadowcatEvent(f.s, p)!);
    choose(f.s.villain.id);
    expect(f.packets.map((e) => e.type)).toEqual(["damage", "ready"]);
    expect(f.packets[0]).toMatchObject({
      amount: 3,
      attack: true,
      abilitySource: p.id,
    });
    expect(f.s.player.exhausted).toBe(false);
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("solid");
  });
  it("Surprise respects native cannot-ready restrictions", () => {
    const { f, addMass, piece, run, choose } = fixture();
    addMass();
    f.s.player.exhausted = true;
    f.s.flags.cannotReady = true;
    run(...shadowcat.shadowcatEvent(f.s, piece("32037"))!);
    choose(f.s.villain.id);
    expect(f.s.player.exhausted).toBe(true);
  });
  it.each(["solid", "phased"] as const)(
    "Airwalk removes correct threat in %s at effect time",
    (form) => {
      const { f, addMass, piece, run, choose } = fixture();
      addMass(form);
      run(...shadowcat.shadowcatEvent(f.s, piece("32039"))!);
      choose("main");
      expect(f.packets[0]).toMatchObject({
        type: "thwart",
        amount: form === "phased" ? 4 : 2,
        action: true,
        source: "hero",
      });
    },
  );
  it("Phased Strike checks form before attack completion and discards only actual eligible encounter attachments", () => {
    const { f, addMass, piece, run, choose } = fixture();
    addMass("phased");
    const eligible = piece("01100"),
      upgrade = piece("32034");
    eligible.attachedTo = upgrade.attachedTo = f.s.villain.id;
    f.s.attachments.push(eligible, upgrade);
    run(...shadowcat.shadowcatEvent(f.s, piece("32038"))!);
    choose(f.s.villain.id);
    expect(f.packets[0]).toMatchObject({ amount: 6, attack: true });
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([
      eligible.id,
      "continue",
    ]);
    choose(eligible.id);
    expect(f.s.encounter.discard[0].id).toBe(eligible.id);
    expect(f.s.attachments[0].id).toBe(upgrade.id);
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("phased");
  });
  it.each(["solid", "redirected", "locked"])(
    "Phased Strike has no attachment clause when %s",
    (why) => {
      const { f, addMass, piece, run, choose } = fixture();
      addMass(why === "solid" ? "solid" : "phased");
      const p = piece("01100");
      p.attachedTo = f.s.villain.id;
      f.s.attachments.push(p);
      if (why === "redirected") f.s.flags.redirected = true;
      if (why === "locked") f.s.flags[`locked:${p.id}`] = true;
      run(...shadowcat.shadowcatEvent(f.s, piece("32038"))!);
      choose(f.s.villain.id);
      expect(f.s.prompt).toBeNull();
      expect(f.s.attachments).toHaveLength(1);
    },
  );
  it("Quick Shift declares defense before changing Solid to Phased and waits for enemy completion to force flip", () => {
    const { f, addMass, piece, run, attack, receipt } = fixture();
    addMass();
    attack();
    const p = piece("32040");
    run(...shadowcat.shadowcatDefenseEvent(f.s, p)!);
    expect(f.history).toEqual([`defending:${p.id}`, "solid>phased"]);
    expect(shadowcat.shadowcatPreventsDamage(f.s, true, f.ports)).toBe(true);
    run(
      ...shadowcat.shadowcatAttackDefenseCompletion(
        f.s,
        receipt("defense"),
        f.ports,
      ),
    );
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("solid");
  });
  it("Quick Shift in Phased draws two real cards while remaining defending Phased", () => {
    const { f, addMass, piece, run, attack } = fixture();
    addMass("phased");
    attack();
    const ids = [piece("01088"), piece("01089")];
    f.s.player.deck.push(...ids);
    run(...shadowcat.shadowcatDefenseEvent(f.s, piece("32040"))!);
    expect(f.s.player.hand.map((p) => p.id)).toEqual(ids.map((p) => p.id));
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("phased");
    expect(f.history[0]).toMatch(/^defending:/);
  });
  it("Quick Shift uses actual paid event and saved source, not an invented clone", () => {
    const { f, addMass, piece, run, attack } = fixture();
    addMass();
    attack();
    const p = piece("32040");
    f.s.player.hand.push(p);
    const opts = shadowcat.shadowcatDefenseOptions(f.s, [], [], f.ports);
    expect(opts[0].id).toBe(p.id);
    run(...opts[0].effects);
    expect(f.s.player.hand).toEqual([]);
    expect(f.s.player.discard[0].id).toBe(p.id);
    expect(f.history[0]).toBe(`paid:${p.id}`);
  });
  it.each(["solid", "phased"] as const)(
    "Lockheed entry in %s uses nonattack/nonthwart effect",
    (form) => {
      const { f, addMass, piece, run, choose } = fixture();
      addMass(form);
      const p = piece("32032");
      f.s.player.inPlay.push(p);
      run(...shadowcat.shadowcatCardEntered(f.s, p, f.ports));
      choose("yes");
      choose(form === "solid" ? f.s.villain.id : "main");
      expect(f.packets.at(-1)).toMatchObject({
        type: form === "solid" ? "damage" : "thwart",
        amount: 2,
      });
      expect(f.packets.at(-1)!.attack).toBeUndefined();
      if (form === "phased") expect(f.packets.at(-1)!.action).toBe(false);
    },
  );
  it.each(["solid", "phased"] as const)(
    "Room in %s uses actual exhaustion and heal/draw branch",
    (form) => {
      const { f, addMass, piece, run } = fixture();
      addMass(form);
      f.s.player.form = "alter";
      f.s.player.hp = 5;
      const p = piece("32033");
      f.s.player.inPlay.push(p);
      run(S("room", { id: p.id }));
      expect(f.s.player.inPlay.find((p) => p.code === "32033")!.exhausted).toBe(
        true,
      );
      expect(f.packets[0]).toMatchObject({
        type: form === "solid" ? "heal" : "draw",
        amount: form === "solid" ? 2 : 1,
      });
    },
  );
  it("Room uses current maximum HP with native modifiers", () => {
    const { f, addMass, piece } = fixture();
    addMass();
    f.s.player.form = "alter";
    f.s.flags.maxHP = 12;
    f.s.player.hp = 10;
    const p = piece("32033");
    f.s.player.inPlay.push(p);
    expect(shadowcat.shadowcatAbilityOptions(f.s, p.id, f.ports)).toHaveLength(
      1,
    );
  });
  it("Phased and Confused attachment Max is shared across players", () => {
    const { f, piece } = fixture(true);
    const p = piece("32036");
    p.attachedTo = f.s.villain.id;
    seatView(f.s, f.s.players[1]).player.inPlay.push(p);
    expect(
      shadowcat.shadowcatAttachmentTargets(f.s, piece("32036"), f.ports),
    ).toEqual([]);
  });
  it("Phased and Confused replacement discards owner physical upgrade then confuses enemy", () => {
    const { f, piece, run } = fixture(true);
    const p = piece("32036", f.s.players[1].id);
    p.attachedTo = f.s.villain.id;
    seatView(f.s, f.s.players[1]).player.inPlay.push(p);
    run(
      ...shadowcat.shadowcatEnemyAttackReplacement(
        f.s,
        f.s.villain.id,
        f.ports,
      )!,
    );
    expect(f.s.player.discard[0].id).toBe(p.id);
    expect(f.s.villain.confused).toBe(true);
  });
});

describe("obligation and physical native nemesis", () => {
  it("obligation forces Phased before lock and routes to actual Kitty seat", () => {
    const { f, addMass, piece, run } = fixture(true);
    const id = addMass();
    const kitty = f.s.activePlayerId;
    activateSeat(f.s, f.s.players[1].id);
    run(...shadowcat.shadowcatEncounterReveal(f.s, piece("32055"))!);
    const view = seatView(f.s, kitty);
    expect(view.player.inPlay.find((p) => p.id === id)!.code).toBe("32031b");
    expect(shadowcat.shadowcatCanAttack(view, f.ports)).toBe(false);
    expect(shadowcat.shadowcatCanDefend(view, f.ports)).toBe(false);
    expect(shadowcat.shadowcatCanChangeMassForm(view, f.ports)).toBe(false);
    expect(f.history.slice(0, 2)).toEqual([
      "solid>phased",
      `obligation:${kitty}`,
    ]);
  });
  it("Kitty can change identity form and remove obligation by exhausting in alter ego", () => {
    const { f, addMass, piece, run } = fixture();
    addMass("phased");
    const p = piece("32055");
    f.s.player.inPlay.push(p);
    expect(shadowcat.shadowcatAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    run(S("obligation-remove", { id: p.id }));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.at(-1)!.id).toBe(p.id);
    expect(shadowcat.shadowcatCanAttack(f.s, f.ports)).toBe(true);
  });
  it("blanked obligation releases attack, defense and mass-form restrictions", () => {
    const { f, addMass, piece } = fixture();
    addMass();
    const p = piece("32055");
    f.s.player.inPlay.push(p);
    f.s.flags[`blank:${p.id}`] = true;
    expect(shadowcat.shadowcatCanAttack(f.s, f.ports)).toBe(true);
    expect(shadowcat.shadowcatCanChangeMassForm(f.s, f.ports)).toBe(true);
  });
  it.each([false, true])(
    "White Queen replenishes real Confused status cards with steady=%s and leaves cards behind",
    (steady) => {
      const { f, piece } = fixture();
      f.s.flags.steady = steady;
      const p = piece("32056");
      p.engagedWith = f.s.activePlayerId;
      f.s.minions.push(p);
      shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
      expect(f.s.player.confuseCards).toBe(steady ? 2 : 1);
      consumeStatus(f.s.player, "confused");
      shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
      expect(f.s.player.confused).toBe(true);
      f.s.minions = [];
      shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
      expect(f.s.player.confused).toBe(true);
      consumeStatus(f.s.player, "confused");
      expect(f.s.player.confused).toBe(false);
    },
  );
  it("White Queen does not bypass Stalwart", () => {
    const { f, piece } = fixture();
    f.s.flags.stalwart = true;
    const p = piece("32056");
    f.s.minions.push(p);
    shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
    expect(f.s.player.confused).toBe(false);
  });
  it("White Queen engages only her actual player and blank text suppresses replenishment", () => {
    const { f, piece } = fixture(true);
    const p = piece("32056");
    p.engagedWith = f.s.players[1].id;
    f.s.minions.push(p);
    expect(shadowcat.shadowcatContinuousStatus(f.s, "confused", f.ports)).toBe(
      false,
    );
    activateSeat(f.s, f.s.players[1].id);
    f.s.flags[`blank:${p.id}`] = true;
    shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
    expect(f.s.player.confused).toBe(false);
  });
  it("Restraint attaches actual ID and continuously replenishes Stunned after each replacement", () => {
    const { f, piece, run } = fixture();
    const p = piece("32059");
    run(...shadowcat.shadowcatEncounterReveal(f.s, p)!);
    expect(f.s.attachments[0]).toMatchObject({
      id: p.id,
      attachedTo: `hero:${f.s.activePlayerId}`,
    });
    expect(f.s.player.stunned).toBe(true);
    consumeStatus(f.s.player, "stunned");
    shadowcat.shadowcatRefreshContinuousStatuses(f.s, f.ports);
    expect(f.s.player.stunned).toBe(true);
  });
  it("Restraint paid removal costs exactly two mental and does not clear leftover Stunned", () => {
    const { f, piece, run } = fixture();
    const p = piece("32059");
    run(...shadowcat.shadowcatEncounterReveal(f.s, p)!);
    run(S("restraint-pay", { id: p.id }));
    const payment = f.packets.at(-1)!;
    expect(payment).toMatchObject({
      type: "payRequest",
      cost: 2,
      requirements: ["mental", "mental"],
      abilityCost: true,
      cancelable: true,
    });
    expect(f.s.attachments[0].id).toBe(p.id);
    run(...payment.after);
    expect(f.s.attachments).toEqual([]);
    expect(f.s.encounter.discard[0].id).toBe(p.id);
    expect(f.s.player.stunned).toBe(true);
  });
  it("another player may pay Restraint's unqualified Action", () => {
    const { f, piece, run } = fixture(true);
    const p = piece("32059");
    p.attachedTo = `hero:${f.s.players[1].id}`;
    f.s.attachments.push(p);
    expect(shadowcat.shadowcatAbilityOptions(f.s, p.id, f.ports)[0].id).toBe(
      "remove",
    );
    run(S("restraint-pay", { id: p.id }));
    expect(f.packets.at(-1)!.requirements).toEqual(["mental", "mental"]);
  });
  it("Shadows moves actual five set-aside IDs and adds Surge when Queen is unavailable", () => {
    const { f, piece, run } = fixture();
    const p = ["32056", "32057", "32058", "32058", "32059"].map((c) =>
      piece(c),
    );
    f.s.player.setAside = p;
    const effects = shadowcat.shadowcatShadowOfPast(f.s)!;
    expect(effects[0].id).toBe(p[0].id);
    expect(effects[1].id).toBe(p[1].id);
    run(effects[2]);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(
      p.slice(2).map((p) => p.id),
    );
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(
      p.slice(0, 2).map((p) => p.id),
    );
    f.s.flags.nemesis = false;
    f.s.player.setAside = [];
    expect(shadowcat.shadowcatShadowOfPast(f.s)!.at(-1)).toMatchObject({
      type: "surge",
    });
  });
  it("Hellfire Club searches physical deck/discard/all seats' set-aside zones then PUTs without Surge", () => {
    const { f, piece, run, choose } = fixture(true);
    const p = piece("32058");
    seatView(f.s, f.s.players[1]).player.setAside!.push(p);
    const ss = piece("32057");
    run(
      ...shadowcat.shadowcatSideSchemeDefeated(
        f.s,
        ss,
        f.s.activePlayerId,
        f.ports,
      ),
    );
    choose(p.id);
    expect(f.s.minions[0]).toMatchObject({
      id: p.id,
      engagedWith: f.s.activePlayerId,
    });
    expect(seatView(f.s, f.s.players[1]).player.setAside).toEqual([]);
    expect(
      f.packets.some((e) => e.type === "surge" || e.type === "reveal"),
    ).toBe(false);
    expect(f.history.at(-1)).toBe("shuffle");
  });
  it("failed Hellfire Club search still shuffles once", () => {
    const { f, piece, run } = fixture();
    run(
      ...shadowcat.shadowcatSideSchemeDefeated(
        f.s,
        piece("32057"),
        undefined,
        f.ports,
      ),
    );
    expect(f.history).toEqual(["shuffle"]);
  });
  it("Pawn boost puts the same physical resolving boost into play without revealing Surge", () => {
    const { f, piece, run } = fixture();
    const p = piece("32058");
    f.s.resolving.push(p);
    run(...shadowcat.shadowcatBoost(f.s, p)!);
    expect(f.s.resolving).toEqual([]);
    expect(f.s.minions[0].id).toBe(p.id);
    expect(f.packets).toEqual([]);
  });
  it("White Queen boost confuses attacked player while preserving numeric1+star", () => {
    const { f, piece, run } = fixture();
    const p = piece("32056");
    expect(cards.get(p.code)).toMatchObject({ boost: 1, boost_star: true });
    run(...shadowcat.shadowcatBoost(f.s, p)!);
    expect(f.s.player.confused).toBe(true);
  });
});

describe("saved response timing limits", () => {
  it("readying Acute Control cannot repeat its response to the same ignored occurrence", () => {
    const { f, piece, run } = fixture();
    const p = piece("32058"),
      source = piece("32034");
    f.s.minions.push(p);
    f.s.player.inPlay.push(source);
    const r: shadowcat.ShadowcatIgnoreReceipt = {
      token: "ignore:ready",
      playerId: f.s.activePlayerId,
      kind: "guard",
      sourceIds: [p.id],
      performed: true,
    };
    run(
      ...shadowcat.shadowcatIgnoredKeywordOptions(f.s, r, [], f.ports)[0]
        .effects,
    );
    f.s.player.inPlay[0].exhausted = false;
    expect(
      shadowcat.shadowcatIgnoredKeywordOptions(f.s, r, [], f.ports),
    ).toEqual([]);
    expect(
      shadowcat.shadowcatIgnoredKeywordOptions(
        f.s,
        { ...r, token: "ignore:next" },
        [],
        f.ports,
      ),
    ).toHaveLength(1);
  });
  it("Quick Shift still declares defense when an absolute lock prevents its Solid flip", () => {
    const { f, addMass, piece, run, attack } = fixture();
    addMass();
    attack();
    f.s.flags.formLocked = true;
    const p = piece("32040");
    run(...shadowcat.shadowcatDefenseEvent(f.s, p)!);
    expect(f.history).toEqual([`defending:${p.id}`]);
    expect(shadowcat.shadowcatMassForm(f.s)).toBe("solid");
  });
  it("the named Shadowcat protection ends if her identity is now Kitty Pryde", () => {
    const { f, addMass } = fixture();
    addMass("phased");
    f.s.player.form = "alter";
    expect(shadowcat.shadowcatPreventsDamage(f.s, true, f.ports)).toBe(false);
  });
  it("unblanking a mass card later does not create a missed completion response", () => {
    const { f, addMass, receipt } = fixture();
    addMass();
    const r = { ...receipt(), massTextBlank: true };
    expect(
      shadowcat.shadowcatAttackDefenseOptions(f.s, r, [], f.ports),
    ).toEqual([]);
  });
});
