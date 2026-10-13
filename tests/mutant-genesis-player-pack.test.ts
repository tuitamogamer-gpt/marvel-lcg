import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import {
  activateSeat,
  allInPlay,
  controller,
  seatView,
} from "../src/game/team.js";
import { mechanicalSignature } from "../src/game/scripts/compiler.js";
import type { Effect, GameState, Piece, Resource } from "../src/game/types.js";
import * as pack from "../src/game/mutant-genesis-player-pack.js";
import { rulesCode } from "../src/game/rules-code.js";
import { hulkPackEvent } from "../src/game/hulk-pack.js";
import { scarletWitchPackEvent } from "../src/game/scarlet-witch-pack.js";
import {
  waspPackEvent,
  waspPackFormResponseOptions,
  type WaspPackPorts,
} from "../src/game/wasp-pack.js";
import {
  mtsPlayerPackCardEntered,
  mtsPlayerPackFormResponseOptions,
  mtsPlayerPackPlayRestriction,
  resolveMtsPlayerPackEffect,
  type MtsPlayerPackPorts,
} from "../src/game/mts-player-pack.js";

function fixture() {
  let s = newGame({
    heroId: "spiderham",
    aspect: "justice",
    villainId: "rhino",
    seed: 32011,
    pacing: "expert",
    heroes: [
      { heroId: "spiderham", aspect: "justice" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.phase = "player";
  s.scheme.threat = 10;
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.hp = 10;
    v.flags = seat.flags = {
      xmen: true,
      identityName: seat.id === "p1" ? "Shadowcat" : "Colossus",
    };
  }
  s.flags = s.players[0].flags;
  const log: string[] = [];
  const qualify = (v: GameState, e: Effect) => ({
    actorId: v.activePlayerId,
    ...e,
  });
  const traits = (v: GameState, id: string) => {
    const p = [
      ...allInPlay(v),
      ...v.minions,
      ...v.players.flatMap((seat) => seatView(v, seat).player.hand),
    ].find((p) => p.id === id);
    return p ? (card(p).traits || "").split(/\.\s*/).filter(Boolean) : [];
  };
  const getTarget = (v: GameState, id: string) =>
    id === "hero"
      ? v.player
      : id.startsWith("hero:")
        ? seatView(v, id.slice(5)).player
        : id === v.villain.id
          ? v.villain
          : [...allInPlay(v), ...v.minions].find((p) => p.id === id)!;
  const sources = (v: GameState, exclude?: string) =>
    v.player.hand
      .filter((p) => p.id !== exclude)
      .map((p) => ({
        p,
        res: [
          ...Array(card(p).resource_energy || 0).fill("energy"),
          ...Array(card(p).resource_mental || 0).fill("mental"),
          ...Array(card(p).resource_physical || 0).fill("physical"),
          ...Array(card(p).resource_wild || 0).fill("wild"),
        ] as Resource[],
      }));
  const ports: pack.MutantGenesisPlayerPackPorts = {
    queue: (v, ...es) => v.queue.unshift(...es.map((e) => qualify(v, e))),
    choose: (v, title, text, options) => {
      v.prompt = {
        kind: "choice",
        title,
        text,
        options: options.map((o) => ({
          ...o,
          effects: o.effects.map((e) => qualify(v, e)),
        })),
      };
    },
    isTextBlank: (v, p) => !!v.flags[`blank:${p.id}`],
    identityHasTrait: (v, t) =>
      t === "X-Men"
        ? !!v.flags.xmen
        : t === "Mutant"
          ? !!v.flags.mutant
          : false,
    identityHeroName: (v) => String(v.flags.identityName),
    hasTrait: (v, id, t) =>
      id === "hero" || id.startsWith("hero:")
        ? ports.identityHasTrait(
            id === "hero" ? v : seatView(v, id.slice(5)),
            t,
          )
        : traits(v, id).includes(t),
    friendlyTargets: (v) => [
      ...v.players
        .filter((seat) => !seat.eliminated)
        .map((seat) => ({
          id: `hero:${seat.id}`,
          label: String(seatView(v, seat).flags.identityName),
        })),
      ...allInPlay(v)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    enemyTargets: (v, attack) =>
      v.flags.noTargets && attack
        ? []
        : [
            { id: v.villain.id, label: card(v.villain).name },
            ...v.minions.map((p) => ({
              id: p.id,
              label: card(p).name,
              code: p.code,
            })),
          ],
    canReady: (v, id) =>
      !!getTarget(v, id).exhausted && !v.flags[`cannotReady:${id}`],
    canHeal: (v, id) =>
      id === "hero" || id.startsWith("hero:")
        ? Number((getTarget(v, id) as GameState["player"]).hp) < 14
        : Number((getTarget(v, id) as Piece).damage) > 0,
    canGiveStatus: (v, id, status) =>
      !getTarget(v, id)[status] && !v.flags[`immune:${id}:${status}`],
    canExhaustIdentity: (v) => v.player.form === "hero" && !v.player.exhausted,
    exhaustCards: (v, ids) => {
      for (const id of ids) {
        const p = getTarget(v, id);
        if (p.exhausted) throw Error("not ready");
      }
      for (const id of ids) getTarget(v, id).exhausted = true;
      log.push(`exhaust:${ids.join("+")}`);
    },
    heroAttack: (v) => Number(v.flags.heroAttack || 2),
    allyAttack: (_v, p) => Number(card(p).attack || 0),
    cardCost: (_v, p) => Number(card(p).cost || 0),
    canPay: (v, cost, requirements = [], exclude) => {
      const rs = sources(v, exclude).flatMap((x) => x.res);
      for (const t of requirements) {
        let i = rs.indexOf(t);
        if (i < 0) i = rs.indexOf("wild");
        if (i < 0) return false;
        rs.splice(i, 1);
      }
      return rs.length + requirements.length >= cost;
    },
    handPlayableCards: (v) => v.player.hand,
    canPutAlly: (v, p) =>
      !allInPlay(v).some(
        (a) => card(a).is_unique && card(a).name === card(p).name,
      ),
    putAlly: (v, id, after) => {
      const i = v.player.hand.findIndex((p) => p.id === id);
      const p = v.player.hand.splice(i, 1)[0];
      v.player.inPlay.push(p);
      log.push(`put:${id}`);
      ports.queue(
        v,
        ...(pack.mutantGenesisPlayerPackAllyEntered(
          v,
          p,
          false,
          ports,
          [],
          false,
        ) || []),
        ...after,
      );
    },
    canDeclareAllyDefender: (v, r, id) =>
      !!ownPiece(v, id) &&
      !ownPiece(v, id)!.exhausted &&
      ports.attackAvailable(v, r),
    declareAllyDefender: (v, _r, id) => {
      ownPiece(v, id)!.exhausted = true;
      v.attack!.defender = id;
      v.attack!.targetPlayerId = controller(v, id)!.id;
      log.push(`defender:${id}`);
    },
    returnAllyToHand: (v, id, after) => {
      const seat = controller(v, id)!;
      const zone = seatView(v, seat).player.inPlay;
      const p = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      )[0];
      seatView(v, p.ownerId || seat.id).player.hand.push(p);
      log.push(`return:${id}`);
      ports.queue(v, ...after);
    },
    shuffleMinionIntoEncounter: (v, id, after) => {
      const p = v.minions.splice(
        v.minions.findIndex((p) => p.id === id),
        1,
      )[0];
      v.encounter.deck.push(p);
      log.push(`shuffle:${id}`);
      ports.queue(v, ...after);
    },
    attach: (v, id, target) => {
      allInPlay(v).find((p) => p.id === id)!.attachedTo = target;
    },
    attackAvailable: (v, r) => !!v.attack && v.attack.attacker === r.attackerId,
    playEvent: (v, id, effects, r, after) => {
      const i = v.player.hand.findIndex((p) => p.id === id);
      const p = v.player.hand.splice(i, 1)[0];
      v.resolving.push(p);
      log.push(`play:${id}`);
      ports.queue(
        v,
        {
          type: "mutant-genesis-player:attack-paid",
          id,
          code: p.code,
          receipt: r,
        },
        ...effects,
        ...after,
      );
    },
    claimDefense: (v) => {
      v.attack!.defender = "hero";
      v.attack!.targetPlayerId = v.activePlayerId;
      v.attack!.basicDefense = false;
      log.push("claimDefense");
    },
    preventAttack: (v) => {
      v.attack!.preventAllDamage = true;
      log.push("preventAttack");
    },
    damageAvailable: (v, p) =>
      !!v.attack && p.amount > 0 && !v.flags.damageGone,
    preventDamage: (v, _p, amount) => {
      v.attack!.prevented += amount;
      log.push(`prevent:${amount}`);
    },
    simultaneousAttack: (v, allocations, after) => {
      if (v.player.stunned) {
        v.player.stunned = false;
        log.push("stunReplaced");
      } else {
        log.push(`simultaneous:${JSON.stringify(allocations)}`);
        for (const a of allocations) {
          if (a.target === v.villain.id) v.villain.hp -= a.amount;
          else v.minions.find((p) => p.id === a.target)!.damage += a.amount;
        }
      }
      ports.queue(v, ...after);
    },
  };
  const piece = (code: string, owner = "p1") => {
    const p = makePiece(s, code);
    p.ownerId = owner;
    return p;
  };
  const put = (code: string, owner = "p1") => {
    const p = piece(code, owner);
    seatView(s, owner).player.inPlay.push(p);
    return p;
  };
  const hand = (code: string, owner = "p1") => {
    const p = piece(code, owner);
    seatView(s, owner).player.hand.push(p);
    return p;
  };
  const minion = (code = "01103", owner = "p1") => {
    const p = piece(code);
    p.engagedWith = owner;
    s.minions.push(p);
    return p;
  };
  const attack = (
    stage: "initiated" | "attacks" = "attacks",
  ): pack.MutantGenesisAttackReceipt => {
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      targetPlayerId: "p1",
      originalPlayerId: "p1",
    };
    return {
      token: `actual:${s.nextId++}`,
      playerId: "p1",
      attackerId: s.villain.id,
      stage,
    };
  };
  const run = () => {
    for (let n = 0; s.queue.length && !s.prompt && n < 100; n++) {
      const e = s.queue.shift()!;
      if (e.actorId) activateSeat(s, e.actorId);
      if (pack.resolveMutantGenesisPlayerPackEffect(s, e, ports)) continue;
      if (e.type === "optional")
        ports.choose(s, e.title, e.text || "Respond?", [
          { id: "yes", label: "Use", effects: e.effects },
          { id: "skip", label: "Skip", effects: [] },
        ]);
      else if (e.type === "payRequest") {
        log.push(`pay:${e.cost}:${(e.requirements || []).join("+")}`);
        const required = e.requirements || [];
        const source = sources(s).find((x) =>
          required.every(
            (r: Resource) => x.res.includes(r) || x.res.includes("wild"),
          ),
        );
        if (!source) throw Error("No real resource");
        s.player.hand.splice(s.player.hand.indexOf(source.p), 1);
        s.player.discard.push(source.p);
        ports.queue(s, ...e.after);
      } else if (e.type === "status") {
        const status = e.status as "tough" | "stunned" | "confused";
        getTarget(s, e.target)[status] = true;
      } else if (e.type === "ready") getTarget(s, e.target).exhausted = false;
      else if (e.type === "heal") {
        const p = getTarget(s, e.target);
        if ("hp" in p) p.hp = Math.min(14, p.hp + e.amount);
        else p.damage = Math.max(0, p.damage - e.amount);
      } else if (e.type === "draw") {
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
        log.push("draw");
      } else if (e.type === "discardPiece") {
        const p = ownPiece(s, e.id);
        if (p) {
          s.player.inPlay.splice(s.player.inPlay.indexOf(p), 1);
          seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
        }
      } else if (e.type === "thwart") {
        s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        log.push(`thwart:${e.source}:${e.amount}`);
      } else if (e.type === "damage") {
        if (e.target === s.villain.id) s.villain.hp -= e.amount;
        else s.minions.find((p) => p.id === e.target)!.damage += e.amount;
        log.push(`damage:${e.target}:${e.amount}`);
      } else log.push(e.type);
    }
  };
  const start = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  const choose = (id: string) => {
    s = JSON.parse(JSON.stringify(s)) as GameState;
    const seat = s.players.find((seat) => seat.id === s.activePlayerId)!;
    seat.player = s.player;
    seat.flags = s.flags;
    const option = s.prompt?.options.find((o) => o.id === id);
    expect(option, JSON.stringify(s.prompt)).toBeTruthy();
    s.prompt = null;
    ports.queue(s, ...option!.effects);
    run();
  };
  return {
    get s() {
      return s;
    },
    ports,
    piece,
    put,
    hand,
    minion,
    attack,
    run,
    start,
    choose,
    log,
  };
}
const ownPiece = (s: GameState, id: string) =>
  allInPlay(s).find((p) => p.id === id);

describe("Mutant Genesis original player pool", () => {
  it("partitions the exact 28 printings and keeps every code", () => {
    const codes = [
      ...pack.MUTANT_GENESIS_PLAYER_PACK_CORE_ALIASES,
      ...pack.MUTANT_GENESIS_PLAYER_PACK_SCRIPT_CODES,
    ];
    expect(new Set(codes).size).toBe(28);
    expect(codes.every((c) => card(c).pack_code === "mut_gen")).toBe(true);
    expect(codes).toContain("32050");
  });
  it.each([
    ...pack.MUTANT_GENESIS_PLAYER_PACK_CORE_ALIAS_PAIRS,
    ...pack.MUTANT_GENESIS_PLAYER_PACK_NATIVE_ALIAS_PAIRS,
  ])("mechanical alias %s -> %s preserves rules fields", (a, b) => {
    expect(mechanicalSignature(card(a))).toBe(mechanicalSignature(card(b)));
  });
  it("retains both Shadow and Steel printings with identical mechanics", () =>
    expect(mechanicalSignature(card("32050"))).toBe(
      mechanicalSignature(card("32021")),
    ));
  it("Protective Training targets teammate X-Men allies and excludes identities", () => {
    const f = fixture(),
      a = f.put("32041", "p2"),
      u = f.put("32013");
    const ts = pack.mutantGenesisPlayerPackAttachmentTargets(f.s, u, f.ports)!;
    expect(ts.map((t) => t.id)).toEqual([a.id]);
    f.start(...pack.mutantGenesisPlayerPackCardEntered(f.s, u));
    f.choose(a.id);
    expect(ownPiece(f.s, u.id)!.attachedTo).toBe(a.id);
    expect(controller(f.s, u.id)!.id).toBe("p1");
    expect(
      pack.mutantGenesisPlayerPackCharacterModifiers(f.s, a.id, f.ports),
    ).toEqual({ attack: 0, health: 3 });
  });
  it("max one Training uses the printed trait even when the previous upgrade is blank", () => {
    const f = fixture(),
      a = f.put("32041"),
      u = f.put("32013");
    u.attachedTo = a.id;
    f.s.flags[`blank:${u.id}`] = true;
    expect(
      pack.mutantGenesisPlayerPackAttachmentTargets(
        f.s,
        f.piece("32043"),
        f.ports,
      ),
    ).toEqual([]);
    expect(
      pack.mutantGenesisPlayerPackCharacterModifiers(f.s, a.id, f.ports),
    ).toEqual({ attack: 0, health: 0 });
  });
  it("Attack Training grants actual +1 ATK and +2 HP", () => {
    const f = fixture(),
      a = f.put("32041"),
      u = f.put("32043");
    u.attachedTo = a.id;
    expect(
      pack.mutantGenesisPlayerPackCharacterModifiers(f.s, a.id, f.ports),
    ).toEqual({ attack: 1, health: 2 });
  });
  it("training rejects non-X-Men ally", () => {
    const f = fixture();
    f.put("01067");
    expect(
      pack.mutantGenesisPlayerPackPlayRestriction(
        f.s,
        f.piece("32013"),
        f.ports,
      ),
    ).toMatch(/target/);
  });
  it("Polaris optional PUT entry gives teammate hero Tough after reload", () => {
    const f = fixture(),
      p = f.put("32012");
    f.start(
      ...pack.mutantGenesisPlayerPackAllyEntered(f.s, p, false, f.ports)!,
    );
    f.choose("yes");
    f.choose("hero:p2");
    expect(seatView(f.s, "p2").player.tough).toBe(true);
    expect(f.s.player.tough).toBe(false);
  });
  it("Polaris entry response is suppressed by blanking", () => {
    const f = fixture(),
      p = f.put("32012");
    f.s.flags[`blank:${p.id}`] = true;
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, p, true, f.ports),
    ).toBeNull();
  });
  it("Professor X mandatory entry creates delayed owner-aware round discard", () => {
    const f = fixture(),
      p = f.put("32019", "p2");
    activateSeat(f.s, "p2");
    f.start(
      ...pack.mutantGenesisPlayerPackAllyEntered(f.s, p, false, f.ports)!,
    );
    expect(f.s.prompt!.options.some((o) => o.id === "no")).toBe(false);
    f.choose("confuse");
    expect(f.s.villain.confused).toBe(true);
    f.s.flags[`blank:${p.id}`] = true;
    f.start(...pack.mutantGenesisPlayerPackRoundEnded(f.s));
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toContain(p.id);
  });
  it("Professor X may stun a real minion", () => {
    const f = fixture(),
      m = f.minion(),
      p = f.put("32019");
    f.start(...pack.mutantGenesisPlayerPackAllyEntered(f.s, p, true, f.ports)!);
    f.choose(`stun:${m.id}`);
    expect(f.s.minions[0].stunned).toBe(true);
  });
  it("Professor X may ready teammate X-Men", () => {
    const f = fixture(),
      p = f.put("32019");
    seatView(f.s, "p2").player.exhausted = true;
    f.start(...pack.mutantGenesisPlayerPackAllyEntered(f.s, p, true, f.ports)!);
    f.choose("ready:hero:p2");
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
  });
  it("Professor leave/reentry clears the previous delayed effect", () => {
    const f = fixture(),
      p = f.put("32019");
    f.start(...pack.mutantGenesisPlayerPackAllyEntered(f.s, p, true, f.ports)!);
    f.choose("confuse");
    pack.mutantGenesisPlayerPackCardLeft(f.s, p.id);
    expect(pack.mutantGenesisPlayerPackRoundEnded(f.s)).toEqual([]);
  });
  it("X-Jet checks actual payer X-Men trait and actual remote controller", () => {
    const f = fixture(),
      jet = f.put("32020", "p2");
    const sources = pack.mutantGenesisPlayerPackResourceSources(
      f.s,
      "p1",
      f.ports,
    );
    expect(sources[0]).toMatchObject({
      id: jet.id,
      playerId: "p2",
      resources: ["wild"],
    });
    f.s.flags.xmen = false;
    expect(
      pack.mutantGenesisPlayerPackResourceSources(f.s, "p1", f.ports),
    ).toEqual([]);
    expect(
      pack.mutantGenesisPlayerPackResourceSources(f.s, "p2", f.ports),
    ).toHaveLength(1);
  });
  it("X-Jet unavailable while exhausted or text blank", () => {
    const f = fixture(),
      jet = f.put("32020");
    jet.exhausted = true;
    expect(
      pack.mutantGenesisPlayerPackResourceSources(f.s, "p1", f.ports),
    ).toEqual([]);
    jet.exhausted = false;
    f.s.flags[`blank:${jet.id}`] = true;
    expect(
      pack.mutantGenesisPlayerPackResourceSources(f.s, "p1", f.ports),
    ).toEqual([]);
  });
  it.each(["32021", "32050"])(
    "Shadow and Steel %s requires a chosen named identity and both characters",
    (code) => {
      const f = fixture(),
        p = f.hand(code);
      expect(
        pack.mutantGenesisPlayerPackPlayRestriction(f.s, p, f.ports),
      ).toBeUndefined();
      f.s.flags.identityName = "Spider-Ham";
      expect(
        pack.mutantGenesisPlayerPackPlayRestriction(f.s, p, f.ports),
      ).toMatch(/chosen/);
      f.s.flags.identityName = "Shadowcat";
      seatView(f.s, "p2").flags.identityName = "Spider-Man";
      expect(
        pack.mutantGenesisPlayerPackPlayRestriction(f.s, p, f.ports),
      ).toMatch(/both/);
      f.put("32048", "p2");
      expect(
        pack.mutantGenesisPlayerPackPlayRestriction(f.s, p, f.ports),
      ).toBeUndefined();
    },
  );
  it.each(["32021", "32050"])(
    "Shadow and Steel %s uses actual attack prevention and attack damage",
    (code) => {
      const f = fixture(),
        p = f.hand(code);
      f.hand("32022");
      const r = f.attack(),
        hp = f.s.villain.hp;
      const o = pack
        .mutantGenesisPlayerPackAttackOptions(f.s, r, [], f.ports)
        .find((o) => o.id === p.id)!;
      f.start(...o.effects);
      expect(f.s.attack!.preventAllDamage).toBe(true);
      expect(f.s.villain.hp).toBe(hp - 4);
      expect(f.s.attack!.defender).toBe("hero");
    },
  );
  it("Powerful Punch exists at initiation, excluding later attacks window", () => {
    const f = fixture(),
      p = f.hand("32014");
    f.hand("32022");
    const r = f.attack("initiated");
    expect(
      pack
        .mutantGenesisPlayerPackAttackOptions(f.s, r, [], f.ports)
        .map((o) => o.id),
    ).toEqual([p.id]);
    expect(
      pack.mutantGenesisPlayerPackAttackOptions(
        f.s,
        { ...r, stage: "attacks" },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.start(
      ...pack.mutantGenesisPlayerPackAttackOptions(f.s, r, [], f.ports)[0]
        .effects,
    );
    expect(f.s.attack!.defender).toBe("hero");
    expect(f.s.attack!.preventAllDamage).toBeUndefined();
  });
  it("Mutant Protectors PUTs exact ally then finishes Polaris entry before exhausting defender", () => {
    const f = fixture(),
      event = f.hand("32017"),
      ally = f.hand("32012");
    f.hand("32022");
    const r = f.attack();
    f.start(
      ...pack
        .mutantGenesisPlayerPackAttackOptions(
          f.s,
          r,
          [{ type: "resumeAttack" }],
          f.ports,
        )
        .find((o) => o.id === event.id)!.effects,
    );
    f.choose(ally.id);
    expect(f.log).toContain(`put:${ally.id}`);
    expect(f.log).not.toContain(`defender:${ally.id}`);
    f.choose("yes");
    f.choose(ally.id);
    expect(ownPiece(f.s, ally.id)!.tough).toBe(true);
    expect(ownPiece(f.s, ally.id)!.exhausted).toBe(true);
    expect(f.s.attack!.defender).toBe(ally.id);
    expect(f.log.at(-1)).toBe("resumeAttack");
  });
  it("Mutant Protectors cannot create a missing ally or violate identity trait", () => {
    const f = fixture(),
      p = f.hand("32017");
    f.hand("32022");
    const r = f.attack();
    expect(
      pack.mutantGenesisPlayerPackAttackOptions(f.s, r, [], f.ports),
    ).toEqual([]);
    f.hand("32041");
    f.s.flags.xmen = false;
    expect(
      pack.mutantGenesisPlayerPackAttackOptions(f.s, r, [], f.ports),
    ).toEqual([]);
    expect(p.code).toBe("32017");
  });
  it("Nightcrawler pays actual Energy and returns same physical ally to owner before prevention", () => {
    const f = fixture(),
      n = f.put("32011"),
      energy = f.hand("32022");
    n.ownerId = "p2";
    f.attack();
    const packet = {
      type: "attackDamage",
      attack: true,
      target: "hero:p2",
      amount: 8,
      attacker: f.s.villain.id,
      damageToken: "real",
    };
    const options = pack.mutantGenesisPlayerPackDamageOptions(
      f.s,
      packet,
      [{ type: "resumeDamage" }],
      f.ports,
    );
    f.start(...options[0].effects);
    expect(f.s.player.discard.map((p) => p.id)).toContain(energy.id);
    expect(seatView(f.s, "p2").player.hand.map((p) => p.id)).toContain(n.id);
    expect(f.log).toEqual([
      "pay:1:energy",
      `return:${n.id}`,
      "prevent:8",
      "resumeDamage",
    ]);
    expect(f.s.attack!.prevented).toBe(8);
  });
  it("Nightcrawler ordinary Interrupt works in alter ego and with Wild Energy payment", () => {
    const f = fixture();
    f.put("32011");
    f.hand("32018");
    f.s.player.form = "alter";
    f.attack();
    const p = {
      type: "attackDamage",
      attack: true,
      target: "hero:p2",
      amount: 3,
    };
    expect(
      pack.mutantGenesisPlayerPackDamageOptions(f.s, p, [], f.ports),
    ).toHaveLength(1);
  });
  it.each([
    { attack: false, target: "hero:p1", amount: 3 },
    { attack: true, target: "hero:p1", amount: 0 },
    { attack: true, target: "villain", amount: 3 },
  ])("Nightcrawler excludes ineligible packet %j", (packet) => {
    const f = fixture();
    f.put("32011");
    f.hand("32022");
    f.attack();
    expect(
      pack.mutantGenesisPlayerPackDamageOptions(
        f.s,
        { type: "damage", ...packet },
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Nightcrawler cannot pay with Mental or Physical alone", () => {
    const f = fixture();
    f.put("32011");
    f.hand("32023");
    f.hand("32024");
    f.attack();
    expect(
      pack.mutantGenesisPlayerPackDamageOptions(
        f.s,
        { type: "attackDamage", attack: true, target: "hero:p1", amount: 3 },
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Defensive Energy draws before next queued PLAY and consumes exact spend receipt once", () => {
    const f = fixture(),
      resource = f.piece("32018"),
      draw = f.piece("32012");
    f.s.player.discard.push(resource);
    f.s.player.deck = [draw];
    const r = {
      token: "payment",
      playerId: "p1",
      eventId: "event",
      eventCode: "32017",
      playing: true,
      resourceIds: [resource.id],
    };
    f.start(
      ...pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [resource], r),
      { type: "PLAY" },
    );
    f.choose("yes");
    expect(f.s.player.hand.map((p) => p.id)).toEqual([draw.id]);
    expect(f.log).toEqual(["draw", "PLAY"]);
    expect(
      pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [resource], r),
    ).toEqual([]);
  });
  it.each([
    { playing: false, eventCode: "32017" },
    { playing: true, eventCode: "32019" },
    { playing: true, eventCode: "32045" },
  ])("Defensive Energy requires actual Defense event PLAY %j", (data) => {
    const f = fixture(),
      p = f.piece("32018");
    expect(
      pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [p], {
        token: "p",
        playerId: "p1",
        eventId: "e",
        resourceIds: [p.id],
        ...data,
      }),
    ).toEqual([]);
  });
  it("Aggressive Energy bonuses stack per physical spent card and vanish on event finish", () => {
    const f = fixture(),
      a = f.piece("32047"),
      b = f.piece("32047");
    const r = {
      token: "actual",
      playerId: "p1",
      eventId: "event",
      eventCode: "32045",
      playing: true,
      resourceIds: [a.id, b.id],
    };
    f.start(...pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [a, b], r));
    f.choose("yes");
    f.choose("yes");
    expect(pack.mutantGenesisPlayerPackAttackEventBonus(f.s, "event")).toBe(2);
    expect(pack.mutantGenesisPlayerPackAttackEventBonus(f.s, "other")).toBe(0);
    pack.mutantGenesisPlayerPackEventFinished(f.s, "event");
    expect(pack.mutantGenesisPlayerPackAttackEventBonus(f.s, "event")).toBe(0);
  });
  it("resource interruption inspects physical committed IDs and spender form", () => {
    const f = fixture(),
      p = f.piece("32047"),
      r = {
        token: "p",
        playerId: "p1",
        eventId: "event",
        eventCode: "32045",
        playing: true,
        resourceIds: [] as string[],
      };
    expect(pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [p], r)).toEqual(
      [],
    );
    r.resourceIds = [p.id];
    f.s.player.form = "alter";
    expect(pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [p], r)).toEqual(
      [],
    );
  });
  it("Wolverine is piercing and heals only controller's own beginning-turn response", () => {
    const f = fixture(),
      w = f.put("32041"),
      remote = f.put("32041", "p2");
    w.damage = 2;
    remote.damage = 2;
    expect(pack.mutantGenesisPlayerPackPiercing(f.s, w, f.ports)).toBe(true);
    f.start(...pack.mutantGenesisPlayerPackTurnBegan(f.s, f.ports));
    f.choose("yes");
    expect(ownPiece(f.s, w.id)!.damage).toBe(1);
    expect(ownPiece(f.s, remote.id)!.damage).toBe(2);
    f.s.flags[`blank:${w.id}`] = true;
    expect(
      pack.mutantGenesisPlayerPackPiercing(f.s, ownPiece(f.s, w.id)!, f.ports),
    ).toBe(false);
    expect(pack.mutantGenesisPlayerPackTurnBegan(f.s, f.ports)).toEqual([]);
  });
  it("Magik PLAY from hand requires Mental then shuffles actual eligible teammate minion", () => {
    const f = fixture(),
      m = f.put("32042"),
      enemy = f.minion("01103", "p2"),
      resource = f.hand("32023");
    f.start(...pack.mutantGenesisPlayerPackAllyEntered(f.s, m, true, f.ports)!);
    f.choose("yes");
    f.choose(enemy.id);
    expect(f.s.encounter.deck.map((p) => p.id)).toContain(enemy.id);
    expect(f.s.minions).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toContain(resource.id);
    expect(f.log).toEqual(["pay:1:mental", `shuffle:${enemy.id}`]);
  });
  it("Magik excludes PUT, non-X-Men or alter-ego engagement and Elite minions", () => {
    const f = fixture(),
      m = f.put("32042");
    f.minion();
    f.hand("32023");
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, m, false, f.ports),
    ).toBeNull();
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, m, true, f.ports, [], false),
    ).toBeNull();
    f.s.flags.xmen = false;
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, m, true, f.ports),
    ).toBeNull();
    f.s.flags.xmen = true;
    f.s.player.form = "alter";
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, m, true, f.ports),
    ).toBeNull();
  });
  it("Magik decline preserves the entry continuation", () => {
    const f = fixture(),
      m = f.put("32042");
    f.minion();
    f.hand("32023");
    f.start(
      ...pack.mutantGenesisPlayerPackAllyEntered(f.s, m, true, f.ports, [
        { type: "continueEntry" },
      ])!,
    );
    f.choose("no");
    expect(f.log).toEqual(["continueEntry"]);
  });
  it("Gatekeeper attaches minion, grants +2 HP and Patrol, and actual controller removes threat", () => {
    const f = fixture(),
      m = f.minion(),
      g = f.put("32044", "p2");
    activateSeat(f.s, "p2");
    f.start(...pack.mutantGenesisPlayerPackCardEntered(f.s, g));
    f.choose(m.id);
    expect(
      pack.mutantGenesisPlayerPackMinionModifiers(f.s, m, f.ports),
    ).toEqual({ health: 2, patrol: true });
    f.start(
      ...pack.mutantGenesisPlayerPackMinionDefeatOptions(
        f.s,
        m.id,
        "defeat",
        [{ type: "cleanupMinion" }],
        f.ports,
      )[0].effects,
    );
    expect(f.s.scheme.threat).toBe(6);
    expect(f.log).toEqual([`thwart:${g.id}:4`, "cleanupMinion"]);
    expect(
      pack.mutantGenesisPlayerPackMinionDefeatOptions(
        f.s,
        m.id,
        "defeat",
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("blanked Gatekeeper loses stats, Patrol and defeat interrupt", () => {
    const f = fixture(),
      m = f.minion(),
      g = f.put("32044");
    g.attachedTo = m.id;
    f.s.flags[`blank:${g.id}`] = true;
    expect(
      pack.mutantGenesisPlayerPackMinionModifiers(f.s, m, f.ports),
    ).toEqual({ health: 0, patrol: false });
    expect(
      pack.mutantGenesisPlayerPackMinionDefeatOptions(
        f.s,
        m.id,
        "d",
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Team Strike exhausts exact controlled X-Men cost and distributes one Attack without ally consequences", () => {
    const f = fixture(),
      a = f.put("32041"),
      remote = f.put("32012", "p2"),
      p = f.piece("32045"),
      m = f.minion();
    f.start(
      ...pack.mutantGenesisPlayerPackBeforeEvent(f.s, p, [
        { type: "mutant-genesis-player:strike-commit", id: p.id, code: p.code },
        ...pack.mutantGenesisPlayerPackEvent(f.s, p)!,
      ])!,
    );
    expect(f.s.prompt!.options.some((o) => o.id.includes(remote.id))).toBe(
      false,
    );
    f.choose(a.id);
    f.choose(m.id);
    f.choose("2");
    f.choose(f.s.villain.id);
    f.choose("3");
    expect(f.s.player.exhausted).toBe(true);
    expect(ownPiece(f.s, a.id)!.exhausted).toBe(true);
    expect(ownPiece(f.s, a.id)!.damage).toBe(0);
    expect(ownPiece(f.s, remote.id)!.exhausted).toBe(false);
    expect(f.s.minions[0].damage).toBe(2);
    expect(f.log.filter((x) => x.startsWith("simultaneous:"))).toHaveLength(1);
  });
  it("Team Strike zero allies is valid and Stun replaces whole Attack after paid exhaust cost", () => {
    const f = fixture(),
      p = f.piece("32045");
    f.s.player.stunned = true;
    f.start(
      ...pack.mutantGenesisPlayerPackBeforeEvent(f.s, p, [
        { type: "mutant-genesis-player:strike-commit", id: p.id, code: p.code },
        ...pack.mutantGenesisPlayerPackEvent(f.s, p)!,
      ])!,
    );
    f.choose("hero");
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.stunned).toBe(false);
    expect(f.log.at(-1)).toBe("stunReplaced");
  });
  it("Team Strike Aggressive Energy increases total before dividing rather than each allocation", () => {
    const f = fixture(),
      p = f.piece("32045"),
      r = f.piece("32047"),
      m = f.minion();
    f.start(
      ...pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [r], {
        token: "actual",
        playerId: "p1",
        eventId: p.id,
        eventCode: p.code,
        playing: true,
        resourceIds: [r.id],
      }),
    );
    f.choose("yes");
    f.start(
      ...pack.mutantGenesisPlayerPackBeforeEvent(f.s, p, [
        { type: "mutant-genesis-player:strike-commit", id: p.id, code: p.code },
        ...pack.mutantGenesisPlayerPackEvent(f.s, p)!,
      ])!,
    );
    f.choose("hero");
    f.choose(m.id);
    f.choose("1");
    f.choose(f.s.villain.id);
    f.choose("2");
    const line = f.log.find((x) => x.startsWith("simultaneous:"))!;
    expect(
      JSON.parse(line.slice("simultaneous:".length)).reduce(
        (n: number, a: { amount: number }) => n + a.amount,
        0,
      ),
    ).toBe(3);
  });
  it("Team Strike rejects duplicate or exhausted cost selections", () => {
    const f = fixture(),
      a = f.put("32041");
    expect(() =>
      f.start({
        type: "mutant-genesis-player:strike-stage",
        id: "event",
        ids: [a.id, a.id],
      }),
    ).toThrow(/distinct/);
    a.exhausted = true;
    expect(() =>
      f.start({
        type: "mutant-genesis-player:strike-stage",
        id: "event",
        ids: [a.id],
      }),
    ).toThrow(/distinct/);
  });
  it.each(["X-Men", "Mutant"])(
    "Colossus ally discount recognizes %s in either identity form",
    (trait) => {
      const f = fixture();
      f.s.player.form = "alter";
      f.s.flags.xmen = trait === "X-Men";
      f.s.flags.mutant = trait === "Mutant";
      expect(
        pack.mutantGenesisPlayerPackCostReduction(
          f.s,
          f.piece("32048"),
          f.ports,
        ),
      ).toBe(1);
      f.s.flags.xmen = false;
      f.s.flags.mutant = false;
      expect(
        pack.mutantGenesisPlayerPackCostReduction(
          f.s,
          f.piece("32048"),
          f.ports,
        ),
      ).toBe(0);
    },
  );
  it("X-Mansion's controller can trigger in alter ego; teammate needs Mutant", () => {
    const f = fixture(),
      m = f.put("32049", "p2"),
      w = f.put("32041", "p2");
    w.damage = 1;
    f.s.player.form = "alter";
    expect(
      pack.mutantGenesisPlayerPackAbilityOptions(f.s, m.id, f.ports),
    ).toEqual([]);
    f.s.flags.mutant = true;
    expect(
      pack.mutantGenesisPlayerPackAbility(f.s, m.id, f.ports, "heal"),
    ).toBe(true);
    f.run();
    f.choose(w.id);
    expect(ownPiece(f.s, w.id)!.damage).toBe(0);
    expect(ownPiece(f.s, m.id)!.exhausted).toBe(true);
  });
  it("X-Mansion requires actual injury, source ready, and actor alter ego", () => {
    const f = fixture(),
      m = f.put("32049");
    expect(
      pack.mutantGenesisPlayerPackAbilityOptions(f.s, m.id, f.ports),
    ).toEqual([]);
    f.s.player.form = "alter";
    f.s.player.hp = 14;
    seatView(f.s, "p2").player.hp = 14;
    expect(
      pack.mutantGenesisPlayerPackAbilityOptions(f.s, m.id, f.ports),
    ).toEqual([]);
    f.s.player.hp = 13;
    m.exhausted = true;
    expect(
      pack.mutantGenesisPlayerPackAbilityOptions(f.s, m.id, f.ports),
    ).toEqual([]);
  });
});

describe("Mutant Genesis timing boundaries", () => {
  it("Team Strike selection only stages IDs and cancellation clears staging while all characters stay ready", () => {
    const f = fixture(),
      ally = f.put("32041"),
      event = f.piece("32045");
    f.start(...pack.mutantGenesisPlayerPackBeforeEvent(f.s, event, [])!);
    f.choose(ally.id);
    expect(f.s.player.exhausted).toBe(false);
    expect(ownPiece(f.s, ally.id)!.exhausted).toBe(false);
    f.start({ type: "mutant-genesis-player:strike-cancel", id: event.id });
    expect(pack.mutantGenesisPlayerPackPaymentCommit(f.s, event)).toEqual([]);
    expect(f.s.player.exhausted).toBe(false);
    expect(ownPiece(f.s, ally.id)!.exhausted).toBe(false);
  });
  it("Team Strike cost preflight rejects an unavailable staged ally before any exhaust mutation", () => {
    const f = fixture(),
      ally = f.put("32041"),
      event = f.piece("32045");
    f.start(...pack.mutantGenesisPlayerPackBeforeEvent(f.s, event, [])!);
    f.choose(ally.id);
    ownPiece(f.s, ally.id)!.exhausted = true;
    expect(() =>
      pack.mutantGenesisPlayerPackPaymentPreflight(f.s, event, f.ports),
    ).toThrow(/staged/);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Team Strike preflight rejects the same physical source paying both exhaust and resource costs", () => {
    const f = fixture(),
      ally = f.put("32041"),
      event = f.piece("32045");
    f.start(...pack.mutantGenesisPlayerPackBeforeEvent(f.s, event, [])!);
    f.choose(ally.id);
    expect(() =>
      pack.mutantGenesisPlayerPackPaymentPreflight(f.s, event, f.ports, [
        ally.id,
      ]),
    ).toThrow(/staged/);
    expect(f.s.player.exhausted).toBe(false);
    expect(ownPiece(f.s, ally.id)!.exhausted).toBe(false);
  });
  it("Team Strike computes current ATK after payment interrupts and counts only remaining exhausted allies", () => {
    const f = fixture(),
      ally = f.put("32041"),
      event = f.piece("32045");
    f.start(...pack.mutantGenesisPlayerPackBeforeEvent(f.s, event, [])!);
    f.choose(ally.id);
    expect(f.s.player.exhausted).toBe(false);
    expect(ownPiece(f.s, ally.id)!.exhausted).toBe(false);
    f.start(...pack.mutantGenesisPlayerPackPaymentCommit(f.s, event));
    f.s.player.inPlay.splice(
      f.s.player.inPlay.findIndex((p) => p.id === ally.id),
      1,
    );
    f.s.player.discard.push(ally);
    f.s.flags.heroAttack = 4;
    f.start(...pack.mutantGenesisPlayerPackEvent(f.s, event)!);
    f.choose(f.s.villain.id);
    f.choose("4");
    const line = f.log.find((l) => l.startsWith("simultaneous:"))!;
    expect(JSON.parse(line.slice("simultaneous:".length))).toEqual([
      { target: f.s.villain.id, amount: 4 },
    ]);
  });
  it("a paid but status-canceled Attack/Defense event consumes receipt without claiming defense", () => {
    const f = fixture();
    const r = f.attack("initiated");
    f.start({
      type: "mutant-genesis-player:attack-paid",
      id: "physicalEvent",
      code: "32014",
      receipt: r,
    });
    expect(f.s.attack!.defender).toBeUndefined();
    expect(f.log).toEqual([]);
    expect(f.s.flags[`mutantGenesisResponse:${r.token}:physicalEvent`]).toBe(
      true,
    );
  });
  it("Magik excludes actual Elite minion despite X-Men engagement and sufficient Mental", () => {
    const f = fixture(),
      magik = f.put("32042");
    f.minion("01102");
    f.hand("32023");
    expect(
      pack.mutantGenesisPlayerPackAllyEntered(f.s, magik, true, f.ports),
    ).toBeNull();
  });
  it("Nightcrawler stops with its paid costs retained if pending damage disappears after return", () => {
    const f = fixture(),
      n = f.put("32011");
    f.hand("32022");
    f.attack();
    const packet = {
      type: "attackDamage",
      target: "hero:p1",
      attack: true,
      amount: 3,
      damageWindowId: "actual",
    };
    const after = [{ type: "resume" }];
    f.s.flags.damageGone = true;
    f.start({
      type: "mutant-genesis-player:nightcrawler-return",
      id: n.id,
      packet,
      token: "actual",
      after,
    });
    expect(f.s.player.hand.some((p) => p.id === n.id)).toBe(true);
    expect(f.log).toEqual([`return:${n.id}`, "resume"]);
  });
  it("Aggressive Energy cooperative spender bonus belongs to the actual event and cleans all seats", () => {
    const f = fixture(),
      p = f.piece("32047", "p2");
    activateSeat(f.s, "p2");
    f.start(
      ...pack.mutantGenesisPlayerPackPaymentInterrupts(f.s, [p], {
        token: "actual",
        playerId: "p2",
        eventId: "p1event",
        eventCode: "32045",
        playing: true,
        resourceIds: [p.id],
      }),
    );
    f.choose("yes");
    activateSeat(f.s, "p1");
    expect(pack.mutantGenesisPlayerPackAttackEventBonus(f.s, "p1event")).toBe(
      1,
    );
    pack.mutantGenesisPlayerPackEventFinished(f.s, "p1event");
    expect(pack.mutantGenesisPlayerPackAttackEventBonus(f.s, "p1event")).toBe(
      0,
    );
  });
});

describe("Mutant Genesis native reprint adapters", () => {
  it.each(pack.MUTANT_GENESIS_PLAYER_PACK_NATIVE_ALIAS_PAIRS)(
    "%s has explicit native rules identity %s without recoding piece",
    (printing, original) => {
      const f = fixture(),
        p = f.piece(printing);
      expect(rulesCode(p)).toBe(original);
      expect(p.code).toBe(printing);
    },
  );
  it("Bait and Switch uses its actual printing with the native villain attack/thwart sequence", () => {
    const f = fixture(),
      p = f.piece("32015");
    expect(scarletWitchPackEvent(f.s, p)).toEqual(
      scarletWitchPackEvent(f.s, f.piece("15030")),
    );
    expect(p.code).toBe("32015");
  });
  it("Toe to Toe uses its actual printing in the native chosen enemy attack sequence", () => {
    const f = fixture(),
      p = f.piece("32046");
    expect(hulkPackEvent(f.s, p)).toEqual(hulkPackEvent(f.s, f.piece("10015")));
    expect(p.code).toBe("32046");
  });
  it("Perseverance participates in the actual form response with original art/physicalID", () => {
    const f = fixture(),
      p = f.hand("32016");
    f.hand("32022");
    const ports = {
      ...f.ports,
      canPay: (s: GameState, cost: number, exclude: string, code: string) =>
        f.ports.canPay(s, cost, [], exclude, code),
    } as unknown as WaspPackPorts;
    const option = waspPackFormResponseOptions(f.s, ports).find(
      (o) => o.id === p.id,
    )!;
    expect(option.image).toBe("32016");
    expect(waspPackEvent(f.s, p)).toEqual([
      { type: "status", target: "hero", status: "tough" },
    ]);
  });
  it("Ready to Rumble original printing retains any-player entry and maxone across printings", () => {
    const f = fixture(),
      p = f.put("32051"),
      other = f.put("21022", "p2");
    const ports = {
      canReady: f.ports.canReady,
    } as unknown as MtsPlayerPackPorts;
    expect(mtsPlayerPackCardEntered(f.s, p)).toEqual([
      { type: "mts-pack:control", id: p.id },
    ]);
    expect(mtsPlayerPackPlayRestriction(f.s, f.piece("32051"), ports)).toMatch(
      /1 per player/,
    );
    expect(other.code).toBe("21022");
    expect(p.code).toBe("32051");
  });
  it("Ready to Rumble original form response discards exact physical card then readies", () => {
    const f = fixture(),
      p = f.put("32051");
    f.s.player.exhausted = true;
    const ports = {
      canReady: f.ports.canReady,
      discardPiece: (s: GameState, id: string) => {
        const a = s.player.inPlay.find((p) => p.id === id)!;
        s.player.inPlay.splice(s.player.inPlay.indexOf(a), 1);
        s.player.discard.push(a);
      },
      queue: f.ports.queue,
    } as unknown as MtsPlayerPackPorts;
    const o = mtsPlayerPackFormResponseOptions(f.s, [], ports).find(
      (o) => o.id === p.id,
    )!;
    expect(o.image).toBe("32051");
    expect(resolveMtsPlayerPackEffect(f.s, o.effects[0], ports)).toBe(true);
    f.run();
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.discard[0].id).toBe(p.id);
    expect(f.s.player.discard[0].code).toBe("32051");
  });
});
