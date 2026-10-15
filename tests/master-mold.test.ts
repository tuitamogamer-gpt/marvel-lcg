import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { playerOrder, seatView } from "../src/game/team";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  MASTER_MOLD_SCRIPT_CODES,
  MASTER_MOLD_SET,
  masterMoldAfterEnemyAttack,
  masterMoldAllyAttackResponseOptions,
  masterMoldAttachmentTargets,
  masterMoldBeforeScheme,
  masterMoldBoost,
  masterMoldFirstPlayerChanged,
  masterMoldInitialize,
  masterMoldMagnetoCountsAgainstAllyLimit,
  masterMoldMainRevealed,
  masterMoldMainThreatLimit,
  masterMoldMinionEngaged,
  masterMoldModifiers,
  masterMoldReveal,
  masterMoldSetup,
  masterMoldSideSchemeBaseThreat,
  masterMoldSideSchemeDefeated,
  masterMoldSuppressesBoost,
  resolveMasterMoldEffect,
  type MasterMoldAllyAttackReceipt,
  type MasterMoldEnemyAttackReceipt,
  type MasterMoldGameState,
  type MasterMoldPorts,
  type MasterMoldSchemeReceipt,
} from "../src/game/master-mold";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const piece = (code: string, id = `piece-${code}`): Piece => ({
  code,
  id,
  damage: 0,
  counters: 0,
  exhausted: false,
  tough: false,
  stunned: false,
  confused: false,
});
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mastermold:${name}`,
  ...args,
});
function fixture(count = 1) {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    heroId: "spider_man",
    aspect: "justice",
    flags: {},
    eliminated: false,
    ended: false,
    player: {
      form: "hero",
      exhausted: false,
      hp: 10,
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
    },
  }));
  let s = {
    villainId: MASTER_MOLD_SET,
    playerCount: count,
    firstPlayerId: "p1",
    activePlayerId: "p1",
    players,
    player: players[0].player,
    flags: players[0].flags,
    villain: {
      ...piece("32109", "villain"),
      hp: 12 * count,
      maxHp: 12 * count,
      stage: 1,
    },
    scheme: { code: "32112b", threat: count, index: 0 },
    sideSchemes: [],
    attachments: [],
    minions: [],
    resolving: [],
    removed: [],
    environments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    queue: [],
    prompt: null,
    phase: "player",
    nextId: 1,
  } as unknown as MasterMoldGameState;
  const blank = new Set<string>();
  const events: string[] = [];
  const allAllies = () =>
    playerOrder(s).flatMap((p) => seatView(s, p).player.inPlay);
  const zones = () => [
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.resolving,
    s.removed,
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    ...s.players.map((seat) => seatView(s, seat).player.inPlay),
  ];
  const take = (id: string) => {
    for (const zone of zones()) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    return undefined;
  };
  const recycle = () => {
    if (!s.encounter.deck.length && s.encounter.discard.length) {
      s.encounter.deck = s.encounter.discard.splice(0);
      s.encounter.acceleration++;
      events.push("exhaustion");
    }
  };
  const ports: MasterMoldPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_state, p) => blank.has(p.id || p.code) || blank.has(p.code),
    hasTrait: (_state, id, trait) => {
      const p =
        id === s.villain.id
          ? s.villain
          : zones()
              .flat()
              .find((p) => p.id === id);
      return (
        !!p &&
        (cards.get(p.code)?.traits || "")
          .toLowerCase()
          .split(/\.\s*/)
          .includes(trait.toLowerCase())
      );
    },
    isEngagedWith: (_state, p, id) => !p.engagedWith || p.engagedWith === id,
    findPiece: (_state, id) =>
      [s.villain, ...zones().flat()].find((p) => p.id === id),
    findAlly: (_state, id) => {
      for (const seat of playerOrder(s)) {
        const p = seatView(s, seat).player.inPlay.find(
          (p) =>
            p.id === id &&
            cards.get(p.code)?.type_code === "ally" &&
            !p.treatedAsMinion,
        );
        if (p) return { piece: p, playerId: seat.id };
      }
      return undefined;
    },
    putMagneto: vi.fn((_state, p, id) => {
      take(p.id);
      seatView(s, id).player.inPlay.push(p);
      events.push(`magneto:${id}`);
    }),
    transferAllyControl: vi.fn((_state, id, target) => {
      const p = take(id);
      if (p) seatView(s, target).player.inPlay.push(p);
    }),
    healAlly: vi.fn((_state, id, amount) => {
      const p = allAllies().find((p) => p.id === id);
      if (p) p.damage = Math.max(0, p.damage - amount);
    }),
    discardTop: vi.fn(() => {
      recycle();
      const p = s.encounter.deck.shift();
      if (p) {
        s.encounter.discard.push(p);
        events.push(`discard:${p.id}`);
      }
      const emptied = !!p && !s.encounter.deck.length;
      recycle();
      return { piece: p, emptied };
    }),
    putMinion: vi.fn((_state, p, id, after) => {
      take(p.id);
      p.engagedWith = id;
      s.minions.push(p);
      events.push(`put:${p.id}:${id}`);
      ports.queue(s, ...after);
    }),
    shuffleEncounterDiscard: vi.fn(() => {
      s.encounter.deck.push(...s.encounter.discard.splice(0));
      events.push("shuffle-discard");
    }),
    attach: vi.fn((_state, p, target, boost) => {
      take(p.id);
      p.attachedTo = target;
      s.attachments.push(p);
      events.push(`attach:${p.id}:${boost}`);
    }),
    activateEnemy: vi.fn((_state, enemy, id, kind) =>
      events.push(`activate:${enemy}:${id}:${kind}`),
    ),
    giveTough: vi.fn((_state, id) => {
      const p = [s.villain, ...s.minions].find((p) => p.id === id);
      if (!p || p.tough) return false;
      p.tough = true;
      return true;
    }),
    surge: vi.fn((_state, id, source) => events.push(`surge:${id}:${source}`)),
    damageBatch: vi.fn((_state, targets, source) =>
      events.push(
        `damage:${source}:${targets.map((p: { id: string; amount: number }) => `${p.id}/${p.amount}`).join(",")}`,
      ),
    ),
    stun: vi.fn((_state, target, source) =>
      events.push(`stun:${target}:${source}`),
    ),
  };
  const run = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    let steps = 0;
    while (s.queue.length && !s.prompt) {
      if (++steps > 100) throw Error("Unbounded pure continuation");
      expect(resolveMasterMoldEffect(s, s.queue.shift()!, ports)).toBe(true);
    }
  };
  const choose = (id: string) => {
    const selected = s.prompt?.options.find((p) => p.id === id);
    expect(selected, `No actual choice ${id}`).toBeDefined();
    s.prompt = null;
    run(...selected!.effects);
  };
  const reload = () => {
    s = JSON.parse(JSON.stringify(s));
    const active = s.players.find((p) => p.id === s.activePlayerId)!;
    s.player = active.player;
    s.flags = active.flags;
    masterMoldInitialize(s);
  };
  return {
    get s() {
      return s;
    },
    ports,
    blank,
    events,
    run,
    choose,
    reload,
    zones,
  };
}
const schemeReceipt = (
  args: Partial<MasterMoldSchemeReceipt> = {},
): MasterMoldSchemeReceipt => ({
  token: "scheme-1",
  enemyId: "villain",
  enemyCode: "32109",
  playerId: "p1",
  performed: true,
  ...args,
});
const magnetoReceipt = (
  args: Partial<MasterMoldAllyAttackReceipt> = {},
): MasterMoldAllyAttackReceipt => ({
  token: "ally-attack-1",
  allyId: "magneto",
  allyCode: "32172b",
  playerId: "p1",
  performed: true,
  defeatedSentinelMinion: true,
  ...args,
});
const attackReceipt = (
  args: Partial<MasterMoldEnemyAttackReceipt> = {},
): MasterMoldEnemyAttackReceipt => ({
  token: "enemy-attack-1",
  enemyId: "mark",
  enemyCode: "32114",
  performed: true,
  damagedTargets: [{ targetId: "hero:p1", actualDamage: 2 }],
  ...args,
});

describe("Master Mold original-source pure module", () => {
  it("owns exactly fourteen scenario faces and the required 172B ally without campaign reverse", () => {
    expect(MASTER_MOLD_SCRIPT_CODES).toHaveLength(15);
    expect(new Set(MASTER_MOLD_SCRIPT_CODES).size).toBe(15);
    expect(MASTER_MOLD_SCRIPT_CODES).toContain("32172b");
    expect(MASTER_MOLD_SCRIPT_CODES as readonly string[]).not.toContain(
      "32172a",
    );
    const f = fixture();
    expect(masterMoldReveal(f.s, piece("32172a"), f.ports)).toBeNull();
    expect(masterMoldBoost(f.s, piece("32172a"))).toBeNull();
    expect(resolveMasterMoldEffect(f.s, { type: "other:noop" }, f.ports)).toBe(
      false,
    );
  });
  it("setup moves the same physical Magneto under first-player control without player ownership", () => {
    const f = fixture(2);
    f.s.firstPlayerId = "p2";
    const ally = piece("32172b", "magneto");
    ally.ownerId = "p1";
    f.s.resolving.push(ally);
    masterMoldSetup(f.s, ally, f.ports);
    expect(f.s.players[1].player.inPlay).toEqual([ally]);
    expect(f.s.resolving).toEqual([]);
    expect(ally.ownerId).toBeUndefined();
    expect(f.s.masterMold?.magnetoId).toBe("magneto");
    masterMoldSetup(f.s, ally, f.ports);
    expect(f.ports.putMagneto).toHaveBeenCalledTimes(1);
  });
  it("rejects a campaign reverse, a different setup instance, and another scenario", () => {
    const f = fixture();
    expect(() => masterMoldSetup(f.s, piece("32172a"), f.ports)).toThrow(
      /172B/,
    );
    masterMoldSetup(f.s, piece("32172b", "magneto"), f.ports);
    expect(() =>
      masterMoldSetup(f.s, piece("32172b", "duplicate"), f.ports),
    ).toThrow(/physical ID/);
    f.s.villainId = "rhino";
    expect(() => masterMoldSetup(f.s, piece("32172b"), f.ports)).toThrow(
      /native/,
    );
  });
  it("keeps metadata rather than duplicate physical allies after save/reload", () => {
    const f = fixture();
    masterMoldSetup(f.s, piece("32172b", "magneto"), f.ports);
    f.reload();
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual(["magneto"]);
    expect(
      Object.values(f.s.masterMold!).some(
        (v) => typeof v === "object" && !Array.isArray(v),
      ),
    ).toBe(false);
  });
  it("transfers the same live Magneto to the next first player and respects blank text", () => {
    const f = fixture(2);
    const ally = piece("32172b", "magneto");
    masterMoldSetup(f.s, ally, f.ports);
    f.s.firstPlayerId = "p2";
    f.blank.add("magneto");
    masterMoldFirstPlayerChanged(f.s, f.ports);
    expect(f.ports.transferAllyControl).not.toHaveBeenCalled();
    f.blank.clear();
    masterMoldFirstPlayerChanged(f.s, f.ports);
    expect(f.s.players[1].player.inPlay).toEqual([ally]);
    expect(f.s.player.inPlay).toEqual([]);
    masterMoldFirstPlayerChanged(f.s, f.ports);
    expect(f.ports.transferAllyControl).toHaveBeenCalledTimes(1);
  });
  it("does not resurrect Magneto after leaving play", () => {
    const f = fixture(2);
    masterMoldSetup(f.s, piece("32172b", "magneto"), f.ports);
    f.s.player.inPlay.length = 0;
    f.s.firstPlayerId = "p2";
    masterMoldFirstPlayerChanged(f.s, f.ports);
    expect(f.ports.transferAllyControl).not.toHaveBeenCalled();
  });
  it("Magneto's ally-limit exemption belongs to its active text", () => {
    const f = fixture();
    const p = piece("32172b", "magneto");
    expect(masterMoldMagnetoCountsAgainstAllyLimit(f.s, p, f.ports)).toBe(
      false,
    );
    f.blank.add(p.id);
    expect(masterMoldMagnetoCountsAgainstAllyLimit(f.s, p, f.ports)).toBe(true);
    expect(
      masterMoldMagnetoCountsAgainstAllyLimit(f.s, piece("32089"), f.ports),
    ).toBe(true);
  });
  it.each([1, 2, 3, 4])(
    "uses native 6N/8N goals, Intruder3N, fixed Virus2 for %i players",
    (count) => {
      const f = fixture(count);
      expect(masterMoldMainThreatLimit(f.s)).toBe(6 * count);
      f.s.scheme.code = "32113b";
      expect(masterMoldMainThreatLimit(f.s)).toBe(8 * count);
      expect(masterMoldSideSchemeBaseThreat(f.s, piece("32119"))).toBe(
        3 * count,
      );
      expect(masterMoldSideSchemeBaseThreat(f.s, piece("32120"))).toBe(2);
      expect(
        masterMoldSideSchemeBaseThreat(f.s, piece("01001")),
      ).toBeUndefined();
    },
  );
  it.each(["32112b", "32113b"])(
    "%s grants Guard to every live Sentinel regardless of recipient blanking",
    (code) => {
      const f = fixture(2);
      const p = piece("32114", "mark");
      p.engagedWith = "p2";
      f.s.minions.push(p, piece("01097", "nonsentinel"));
      f.s.scheme.code = code;
      f.blank.add(p.id);
      expect(masterMoldModifiers(f.s, p, f.ports).guard).toBe(true);
      expect(masterMoldModifiers(f.s, f.s.minions[1], f.ports).guard).toBe(
        false,
      );
      expect(masterMoldModifiers(f.s, f.s.villain, f.ports).guard).toBe(false);
      f.blank.add("main");
      expect(masterMoldModifiers(f.s, p, f.ports).guard).toBe(false);
    },
  );
  it("Unit Upgrade text grants stack health and Retaliate while printed numeric stats stay native", () => {
    const f = fixture();
    const p = piece("32114", "mark");
    f.s.minions.push(p);
    const one = { ...piece("32115", "unit1"), attachedTo: p.id };
    const two = { ...piece("32115", "unit2"), attachedTo: p.id };
    f.s.attachments.push(one, two, {
      ...piece("32115", "other"),
      attachedTo: "villain",
    });
    expect(masterMoldModifiers(f.s, p, f.ports)).toMatchObject({
      health: 4,
      retaliate: 2,
    });
    f.blank.add("unit1");
    expect(masterMoldModifiers(f.s, p, f.ports)).toMatchObject({
      health: 2,
      retaliate: 1,
    });
    f.s.minions.length = 0;
    expect(masterMoldModifiers(f.s, p, f.ports)).toMatchObject({
      health: 0,
      retaliate: 0,
    });
    expect(masterMoldModifiers(f.s, p, f.ports)).not.toHaveProperty("attack");
  });
  it("mills actual encounter cards until the first Sentinel MINION and PUTs the same piece", () => {
    const f = fixture();
    const beam = piece("32116", "beam");
    const non = piece("01097", "non");
    const mark = piece("32114", "mark");
    const tail = piece("32118", "tail");
    f.s.encounter.deck.push(beam, non, mark, tail);
    f.run(M("mill", { sourceId: "villain", playerId: "p1" }));
    expect(f.s.minions).toEqual([mark]);
    expect(mark.engagedWith).toBe("p1");
    expect(f.s.encounter.discard).toEqual([beam, non]);
    expect(f.s.encounter.deck).toEqual([tail]);
    expect(f.ports.putMinion).toHaveBeenCalledWith(f.s, mark, "p1", []);
  });
  it("a no-match mill stops at the first native exhaustion and never loops through the new deck", () => {
    const f = fixture();
    f.s.encounter.deck.push(piece("32118", "a"), piece("32115", "b"));
    f.run(M("mill", { sourceId: "villain", playerId: "p1" }));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(["a", "b"]);
    expect(f.ports.putMinion).not.toHaveBeenCalled();
  });
  it("the final qualifying discarded card is still PUT from its recycled physical location", () => {
    const f = fixture();
    const mark = piece("32114", "last-mark");
    f.s.encounter.deck.push(piece("32118", "first"), mark);
    f.run(M("mill", { sourceId: "villain", playerId: "p1" }));
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.minions).toEqual([mark]);
    expect(
      f
        .zones()
        .flat()
        .filter((p) => p.id === mark.id),
    ).toHaveLength(1);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(["first"]);
  });
  it("an empty encounter universe terminates without fabricating a minion", () => {
    const f = fixture();
    f.run(M("mill", { sourceId: "villain", playerId: "p1" }));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(1);
    expect(f.s.minions).toEqual([]);
    expect(f.s.queue).toEqual([]);
  });
  it("each-player setup lets the first player choose order and resumes remaining players after exhaustion", () => {
    const f = fixture(2);
    f.s.encounter.deck.push(piece("32118", "only"));
    f.run(...masterMoldMainRevealed(f.s, "32112b"));
    expect(f.s.prompt?.options.map((p) => p.id)).toEqual(["p1", "p2"]);
    f.reload();
    f.choose("p2");
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.acceleration).toBe(2);
    expect(f.s.queue).toEqual([]);
    expect(f.s.prompt).toBeNull();
  });
  it("2A shuffles actual discard into encounter deck before either player's mill", () => {
    const f = fixture(2);
    const first = piece("32105", "one"),
      second = piece("32114", "two");
    f.s.encounter.discard.push(first, second);
    f.run(...masterMoldMainRevealed(f.s, "32113a"));
    expect(f.events).toEqual(["shuffle-discard"]);
    expect(f.s.encounter.discard).toEqual([]);
    f.choose("p2");
    expect(f.events.indexOf("shuffle-discard")).toBeLessThan(
      f.events.indexOf("discard:one"),
    );
    expect(f.s.minions.map((p) => [p.id, p.engagedWith])).toEqual([
      ["one", "p2"],
      ["two", "p1"],
    ]);
  });
  it("ordinary 1A and 2B reveal hooks do not repeat the encounter mills", () => {
    const f = fixture();
    expect(masterMoldMainRevealed(f.s, "32112a")).toEqual([]);
    expect(masterMoldMainRevealed(f.s, "32113b")).toEqual([]);
  });
  it("a saved scheme interrupt mills once and suppresses boosts even when no minion exists", () => {
    const f = fixture();
    const r = schemeReceipt();
    f.s.encounter.deck.push(piece("32118", "no-minion"));
    expect(masterMoldSuppressesBoost(f.s, r, f.ports)).toBe(true);
    const effects = masterMoldBeforeScheme(f.s, r, f.ports);
    f.s.queue.push(...effects);
    f.reload();
    f.run();
    expect(f.s.masterMold?.handledSchemes).toEqual([r.token]);
    f.run(...effects);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(1);
    expect(masterMoldBeforeScheme(f.s, r, f.ports)).toEqual([]);
    expect(masterMoldSuppressesBoost(f.s, r, f.ports)).toBe(true);
  });
  it.each([
    { performed: false },
    { enemyId: "mark" },
    { enemyCode: "32110" },
    { token: "" },
  ])(
    "does not trigger an unperformed, foreign or stale scheme receipt %j",
    (args) => {
      const f = fixture();
      expect(masterMoldBeforeScheme(f.s, schemeReceipt(args), f.ports)).toEqual(
        [],
      );
      expect(masterMoldSuppressesBoost(f.s, schemeReceipt(args), f.ports)).toBe(
        false,
      );
    },
  );
  it("blank Master Mold schemes normally and grants no boost suppression", () => {
    const f = fixture();
    f.blank.add("villain");
    expect(masterMoldSuppressesBoost(f.s, schemeReceipt(), f.ports)).toBe(
      false,
    );
    expect(masterMoldBeforeScheme(f.s, schemeReceipt(), f.ports)).toEqual([]);
  });
  it("Sentinel Mark VIII attaches the topmost actual Sentinel attachment rather than another discarded type", () => {
    const f = fixture();
    const mark = piece("32114", "mark");
    f.s.minions.push(mark);
    const old = piece("32115", "old"),
      top = piece("32116", "top"),
      ignored = piece("32118", "treachery");
    f.s.encounter.discard.push(old, top, ignored);
    f.run(
      ...masterMoldMinionEngaged(
        f.s,
        { token: "engage", minionId: mark.id, playerId: "p1" },
        f.ports,
      ),
    );
    expect(f.s.attachments).toEqual([top]);
    expect(top.attachedTo).toBe(mark.id);
    expect(f.s.encounter.discard).toEqual([old, ignored]);
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it("Mark VIII direct attachment bypasses the entire Attach To phrase including a physical duplicate Stun Beam", () => {
    const f = fixture();
    const mark = piece("32114", "mark");
    f.s.minions.push(mark);
    const old = { ...piece("32116", "old-beam"), attachedTo: mark.id },
      next = piece("32116", "new-beam");
    f.s.attachments.push(old);
    f.s.encounter.discard.push(next);
    expect(masterMoldAttachmentTargets(f.s, next, f.ports)).toEqual([]);
    f.run(
      ...masterMoldMinionEngaged(
        f.s,
        { token: "engage", minionId: mark.id, playerId: "p1" },
        f.ports,
      ),
    );
    expect(f.s.attachments.map((p) => p.id)).toEqual(["old-beam", "new-beam"]);
  });
  it("Mark VIII direct Energy Barrier attachment grants neither When Revealed Tough nor surge", () => {
    const f = fixture();
    const mark = piece("32114", "mark");
    f.s.minions.push(mark);
    const barrier = piece("32103", "barrier");
    f.s.encounter.discard.push(barrier);
    f.run(
      ...masterMoldMinionEngaged(
        f.s,
        { token: "engage", minionId: mark.id, playerId: "p1" },
        f.ports,
      ),
    );
    expect(f.s.attachments).toEqual([barrier]);
    expect(mark.tough).toBe(false);
    expect(f.ports.giveTough).not.toHaveBeenCalled();
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it("Mark VIII's saved engagement token cannot attach twice and another genuine engagement can", () => {
    const f = fixture();
    const mark = piece("32114", "mark");
    f.s.minions.push(mark);
    f.s.encounter.discard.push(
      piece("32115", "unit1"),
      piece("32115", "unit2"),
    );
    const receipt = { token: "engage-1", minionId: mark.id, playerId: "p1" };
    const trigger = masterMoldMinionEngaged(f.s, receipt, f.ports);
    f.run(...trigger);
    f.reload();
    f.run(...trigger);
    expect(f.ports.attach).toHaveBeenCalledTimes(1);
    f.run(
      ...masterMoldMinionEngaged(
        f.s,
        { ...receipt, token: "engage-2" },
        f.ports,
      ),
    );
    expect(f.ports.attach).toHaveBeenCalledTimes(2);
  });
  it("blank or absent Mark VIII does not fabricate an attachment or trigger", () => {
    const f = fixture();
    const mark = piece("32114", "mark");
    f.s.minions.push(mark);
    f.blank.add(mark.id);
    expect(
      masterMoldMinionEngaged(
        f.s,
        { token: "engage", minionId: mark.id, playerId: "p1" },
        f.ports,
      ),
    ).toEqual([]);
    f.blank.clear();
    f.run(
      ...masterMoldMinionEngaged(
        f.s,
        { token: "empty", minionId: mark.id, playerId: "p1" },
        f.ports,
      ),
    );
    expect(f.ports.attach).not.toHaveBeenCalled();
  });
  it("ordinary Stun Beam checks an attached physical duplicate even when that copy is blank", () => {
    const f = fixture();
    const mark = piece("32114", "mark"),
      other = piece("32105", "other");
    f.s.minions.push(mark, other, piece("01097", "nonsentinel"));
    f.s.attachments.push({ ...piece("32116", "old"), attachedTo: mark.id });
    f.blank.add("old");
    expect(
      masterMoldAttachmentTargets(f.s, piece("32116"), f.ports).map(
        (p) => p.id,
      ),
    ).toEqual(["other"]);
    expect(
      masterMoldAttachmentTargets(f.s, piece("32115"), f.ports).map(
        (p) => p.id,
      ),
    ).toEqual(["mark", "other"]);
  });
  it.each(["32115", "32116"])(
    "ordinary %s surges if there is no Sentinel-minion target",
    (code) => {
      const f = fixture();
      f.s.resolving.push(piece(code, "source"));
      f.run(...masterMoldReveal(f.s, f.s.resolving[0], f.ports)!);
      expect(f.ports.surge).toHaveBeenCalledWith(f.s, "p1", "source", code);
      expect(f.ports.attach).not.toHaveBeenCalled();
    },
  );
  it("Unit Upgrade's boost directly attaches to an actual chosen Sentinel and never gains ordinary surge", () => {
    const f = fixture();
    const source = piece("32115", "unit");
    f.s.resolving.push(source);
    f.s.minions.push(piece("32114", "a"), piece("32105", "b"));
    f.run(...masterMoldBoost(f.s, source)!);
    expect(f.s.prompt?.options.map((p) => p.id)).toEqual(["a", "b"]);
    f.reload();
    f.choose("b");
    expect(f.ports.attach).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({ id: "unit" }),
      "b",
      true,
    );
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it("Unit Upgrade's no-target boost does nothing and does not surge", () => {
    const f = fixture();
    const p = piece("32115");
    f.s.resolving.push(p);
    f.run(...masterMoldBoost(f.s, p)!);
    expect(f.ports.attach).not.toHaveBeenCalled();
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it("an attachment saved choice revalidates the physical restriction before committing", () => {
    const f = fixture();
    const source = piece("32116", "beam");
    f.s.resolving.push(source);
    f.s.minions.push(piece("32114", "a"), piece("32105", "b"));
    f.run(...masterMoldReveal(f.s, source, f.ports)!);
    f.s.attachments.push({ ...piece("32116", "blocker"), attachedTo: "a" });
    expect(() => f.choose("a")).toThrow(/no longer receive/);
    expect(f.ports.attach).not.toHaveBeenCalled();
  });
  it.each(["hero", "alter"] as const)(
    "Children activates ALL engaged minions in %s, allowing choice of order",
    (form) => {
      const f = fixture(2);
      f.s.player.form = form;
      f.s.minions.push(
        { ...piece("32114", "sentinel"), engagedWith: "p1" },
        { ...piece("01097", "other-trait"), engagedWith: "p1" },
        { ...piece("32105", "other-player"), engagedWith: "p2" },
      );
      f.run(...masterMoldReveal(f.s, piece("32117", "children"), f.ports)!);
      expect(f.s.prompt?.options.map((p) => p.id)).toEqual([
        "sentinel",
        "other-trait",
      ]);
      f.reload();
      f.choose("other-trait");
      const kind = form === "hero" ? "attack" : "scheme";
      expect(f.events).toEqual([
        `activate:other-trait:p1:${kind}`,
        `activate:sentinel:p1:${kind}`,
      ]);
    },
  );
  it.each(["hero", "alter"] as const)(
    "Children delegates Master Mold's native %s activation when no minion is engaged",
    (form) => {
      const f = fixture(2);
      f.s.player.form = form;
      f.s.minions.push({
        ...piece("32114", "other-player"),
        engagedWith: "p2",
      });
      f.run(...masterMoldReveal(f.s, piece("32117", "children"), f.ports)!);
      expect(f.ports.activateEnemy).toHaveBeenCalledWith(
        f.s,
        "villain",
        "p1",
        form === "hero" ? "attack" : "scheme",
        "children",
      );
    },
  );
  it("Children does not add a newly entered minion to an already initiated all-minions instruction", () => {
    const f = fixture();
    f.s.minions.push(piece("32114", "a"), piece("32105", "b"));
    f.run(...masterMoldReveal(f.s, piece("32117", "children"), f.ports)!);
    f.s.minions.push(piece("32106", "new"));
    f.choose("a");
    expect(f.events).toEqual(["activate:a:p1:attack", "activate:b:p1:attack"]);
  });
  it("Children skips a minion that leaves after the group is chosen without falling back to Master Mold", () => {
    const f = fixture();
    f.s.minions.push(piece("32114", "a"), piece("32105", "b"));
    f.run(...masterMoldReveal(f.s, piece("32117", "children"), f.ports)!);
    f.s.minions = f.s.minions.filter((p) => p.id !== "b");
    f.choose("a");
    expect(f.events).toEqual(["activate:a:p1:attack"]);
  });
  it("Shields Up gives Tough only to this player's Sentinel minions and succeeds if at least one changes", () => {
    const f = fixture(2);
    const a = piece("32114", "a"),
      b = piece("32105", "b"),
      other = piece("32106", "other"),
      non = piece("01097", "non");
    a.tough = true;
    other.engagedWith = "p2";
    f.s.minions.push(a, b, other, non);
    f.run(...masterMoldReveal(f.s, piece("32118", "shields"), f.ports)!);
    expect(b.tough).toBe(true);
    expect(other.tough).toBe(false);
    expect(non.tough).toBe(false);
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "Shields Up surges when there is no successful Tough placement (existing target: %s)",
    (exists) => {
      const f = fixture();
      if (exists)
        f.s.minions.push({ ...piece("32114", "already-tough"), tough: true });
      f.run(...masterMoldReveal(f.s, piece("32118", "shields"), f.ports)!);
      expect(f.ports.surge).toHaveBeenCalledWith(f.s, "p1", "shields", "32118");
    },
  );
  it("Shields Up's boost gives only the villain Tough with no ordinary surge", () => {
    const f = fixture();
    f.s.minions.push(piece("32114", "mark"));
    f.run(...masterMoldBoost(f.s, piece("32118"))!);
    expect(f.s.villain.tough).toBe(true);
    expect(f.s.minions[0].tough).toBe(false);
    expect(f.ports.surge).not.toHaveBeenCalled();
  });
  it("Intruder Alert uses the actual defeating player rather than the active viewer", () => {
    const f = fixture(2);
    f.s.encounter.deck.push(piece("32114", "mark"), piece("32118", "tail"));
    f.run(
      ...masterMoldSideSchemeDefeated(
        f.s,
        piece("32119", "intruder"),
        "p2",
        f.ports,
      )!,
    );
    expect(f.s.minions[0].engagedWith).toBe("p2");
  });
  it("Virus deals an unlabelled native damage batch to every current Sentinel enemy only", () => {
    const f = fixture(2);
    f.s.minions.push(
      piece("32114", "a"),
      { ...piece("32105", "b"), engagedWith: "p2" },
      piece("01097", "non"),
    );
    f.run(
      ...masterMoldSideSchemeDefeated(
        f.s,
        piece("32120", "virus"),
        "p2",
        f.ports,
      )!,
    );
    expect(f.ports.damageBatch).toHaveBeenCalledWith(
      f.s,
      [
        { id: "villain", amount: 2 },
        { id: "a", amount: 2 },
        { id: "b", amount: 2 },
      ],
      "virus",
      "p2",
    );
    expect(f.ports.activateEnemy).not.toHaveBeenCalled();
  });
  it("blanked source reveals and defeated side schemes have no authored ability", () => {
    const f = fixture();
    for (const code of ["32115", "32116", "32117", "32118", "32119", "32120"]) {
      f.blank.add(code);
      expect(masterMoldReveal(f.s, piece(code), f.ports)).toEqual([]);
      expect(
        masterMoldSideSchemeDefeated(f.s, piece(code), "p1", f.ports),
      ).toEqual([]);
    }
  });
  it("Stun Beam uses actual completed attack damage including separate Overkill recipients", () => {
    const f = fixture();
    f.s.attachments.push({ ...piece("32116", "beam"), attachedTo: "mark" });
    const r = attackReceipt({
      damagedTargets: [
        { targetId: "defender", actualDamage: 2 },
        { targetId: "hero:p2", actualDamage: 1 },
        { targetId: "prevented", actualDamage: 0 },
      ],
    });
    f.run(...masterMoldAfterEnemyAttack(f.s, r, f.ports));
    expect(f.events).toEqual(["stun:defender:beam", "stun:hero:p2:beam"]);
  });
  it("a damaged character is stunned only once per Stun Beam's actual attack receipt", () => {
    const f = fixture();
    f.s.attachments.push({ ...piece("32116", "beam"), attachedTo: "mark" });
    const r = attackReceipt({
      damagedTargets: [
        { targetId: "hero:p1", actualDamage: 2 },
        { targetId: "hero:p1", actualDamage: 1 },
      ],
    });
    const triggers = masterMoldAfterEnemyAttack(f.s, r, f.ports);
    f.run(...triggers);
    f.reload();
    f.run(...triggers);
    expect(f.ports.stun).toHaveBeenCalledTimes(1);
  });
  it("two directly attached Stun Beams retain two independent forced responses", () => {
    const f = fixture();
    f.s.attachments.push(
      { ...piece("32116", "beam1"), attachedTo: "mark" },
      { ...piece("32116", "beam2"), attachedTo: "mark" },
    );
    f.run(...masterMoldAfterEnemyAttack(f.s, attackReceipt(), f.ports));
    expect(f.events).toEqual(["stun:hero:p1:beam1", "stun:hero:p1:beam2"]);
  });
  it.each([
    { performed: false },
    { damagedTargets: [] },
    { damagedTargets: [{ targetId: "hero:p1", actualDamage: 0 }] },
    { enemyId: "different" },
  ])(
    "Stun Beam ignores canceled, prevented, Tough-only and other-source attacks %j",
    (args) => {
      const f = fixture();
      f.s.attachments.push({ ...piece("32116", "beam"), attachedTo: "mark" });
      expect(
        masterMoldAfterEnemyAttack(f.s, attackReceipt(args), f.ports),
      ).toEqual([]);
    },
  );
  it("blank Stun Beam grants no forced response", () => {
    const f = fixture();
    f.s.attachments.push({ ...piece("32116", "beam"), attachedTo: "mark" });
    f.blank.add("beam");
    expect(masterMoldAfterEnemyAttack(f.s, attackReceipt(), f.ports)).toEqual(
      [],
    );
  });
  it("Magneto optionally heals one actual damage after an earned Sentinel attack defeat", () => {
    const f = fixture();
    const ally = piece("32172b", "magneto");
    ally.damage = 4;
    masterMoldSetup(f.s, ally, f.ports);
    const options = masterMoldAllyAttackResponseOptions(
      f.s,
      magnetoReceipt(),
      f.ports,
    );
    expect(options).toHaveLength(1);
    f.run(...options[0].effects);
    expect(ally.damage).toBe(3);
    expect(f.ports.healAlly).toHaveBeenCalledWith(f.s, "magneto", 1, "magneto");
    expect(
      masterMoldAllyAttackResponseOptions(f.s, magnetoReceipt(), f.ports),
    ).toEqual([]);
  });
  it.each([
    { performed: false },
    { defeatedSentinelMinion: false },
    { allyCode: "32089" },
    { playerId: "p2" },
    { token: "" },
  ])(
    "Magneto cannot heal from a canceled, non-Sentinel or foreign attack %j",
    (args) => {
      const f = fixture();
      const ally = piece("32172b", "magneto");
      ally.damage = 2;
      masterMoldSetup(f.s, ally, f.ports);
      expect(
        masterMoldAllyAttackResponseOptions(f.s, magnetoReceipt(args), f.ports),
      ).toEqual([]);
    },
  );
  it("Magneto's heal cannot initiate with no damage, a blank source or an ally already defeated", () => {
    const f = fixture();
    const ally = piece("32172b", "magneto");
    masterMoldSetup(f.s, ally, f.ports);
    expect(
      masterMoldAllyAttackResponseOptions(f.s, magnetoReceipt(), f.ports),
    ).toEqual([]);
    ally.damage = 4;
    f.blank.add(ally.id);
    expect(
      masterMoldAllyAttackResponseOptions(f.s, magnetoReceipt(), f.ports),
    ).toEqual([]);
    f.blank.clear();
    f.s.player.inPlay.length = 0;
    expect(
      masterMoldAllyAttackResponseOptions(f.s, magnetoReceipt(), f.ports),
    ).toEqual([]);
  });
  it("Magneto response keeps its actual source through save/reload and revalidates before heal", () => {
    const f = fixture();
    const ally = piece("32172b", "magneto");
    ally.damage = 4;
    masterMoldSetup(f.s, ally, f.ports);
    const options = masterMoldAllyAttackResponseOptions(
      f.s,
      magnetoReceipt(),
      f.ports,
    );
    f.s.queue.push(...options[0].effects);
    f.reload();
    f.run();
    expect(f.s.player.inPlay[0].damage).toBe(3);
    f.reload();
    expect(() => f.run(...options[0].effects)).toThrow(/cannot heal/);
    expect(f.ports.healAlly).toHaveBeenCalledTimes(1);
  });
});
