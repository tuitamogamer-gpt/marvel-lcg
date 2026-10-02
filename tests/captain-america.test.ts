import { describe, expect, it, vi } from "vitest";
import { newGame, makePiece } from "../src/game/engine";
import { card } from "../src/game/cards";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  CAPTAIN_AMERICA_SCRIPT_CODES,
  captainAbilityOptions,
  captainAllyDiscount,
  captainCardPlayed,
  captainPhaseEnded,
  captainStats,
  captainEvent,
  captainResourceSources,
  captainShieldBlockOptions,
  captainHelmetOptions,
  captainEncounterReveal,
  captainMinionDefeated,
  captainThwartBlocked,
  captainAttackTargets,
  captainPlayRestriction,
  resolveCaptainEffect,
  type CaptainEnginePorts,
} from "../src/game/captain-america";

function fixture() {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
  });
  s.heroId = s.players[0].heroId = "captain_america";
  s.phase = "player";
  s.player.form = "hero";
  s.player.hp = 11;
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.queue = [];
  s.prompt = null;
  const ports: CaptainEnginePorts = {
    queue: (s, ...effects) => {
      s.queue.unshift(...effects);
    },
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    select: (s, title, text, pieces, min, max, action) => {
      s.prompt = {
        kind: "select",
        title,
        text,
        min,
        max,
        selectAction: action,
        options: pieces.map((p) => ({
          id: p.id,
          label: card(p).name,
          effects: [],
        })),
      };
    },
    shuffle: vi.fn(),
    discardHand: (s, id) => {
      const index = s.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in hand");
      s.player.discard.push(s.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (s, id) => {
      const index = s.player.inPlay.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in play");
      s.player.discard.push(s.player.inPlay.splice(index, 1)[0]);
    },
    attackBatch: vi.fn((s: GameState, ids: string[], amount: number) => {
      if (s.player.stunned) {
        s.player.stunned = false;
        return false;
      }
      for (const id of ids) {
        if (id === s.villain.id) s.villain.hp -= amount;
        else {
          const p = s.minions.find((p) => p.id === id);
          if (p) p.damage += amount;
        }
      }
      return true;
    }),
    drawEncounter: (s) => s.encounter.deck.shift(),
    dealEncounter: vi.fn(),
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
    },
  };
  const run = (effect: Effect) => resolveCaptainEffect(s, effect, ports);
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    s.prompt = null;
    option.effects.forEach(run);
    while (!s.prompt && s.queue[0]?.type.startsWith("cap:"))
      run(s.queue.shift()!);
  };
  const select = (...ids: string[]) => {
    const action = s.prompt!.selectAction!;
    s.prompt = null;
    run({ ...action, ids });
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const play = (code: string) => {
    const p = makePiece(s, code);
    s.player.inPlay.push(p);
    return p;
  };
  const minion = (code: string, owner = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = owner;
    s.minions.push(p);
    return p;
  };
  return { s, ports, run, choose, select, hand, play, minion };
}

describe("Captain America's exact identity and signature hooks", () => {
  it("accounts for every identity/signature/obligation/nemesis face, without invented boost effects", () => {
    expect(CAPTAIN_AMERICA_SCRIPT_CODES).toHaveLength(16);
    for (const code of CAPTAIN_AMERICA_SCRIPT_CODES)
      expect(card(code).code).toBe(code);
    for (const code of ["03026", "03027", "03028", "03029", "03030"])
      expect(card(code).boost_star).toBeFalsy();
  });
  it("setup searches only deck and discard, moves the actual Shield and shuffles even when not found", () => {
    const { s, hand, play, run, ports } = fixture();
    hand("03003");
    const sh = makePiece(s, "03009");
    s.player.discard.push(sh);
    run({ type: "cap:setup" });
    expect(s.player.hand).toContain(sh);
    expect(s.player.discard).not.toContain(sh);
    expect(ports.shuffle).toHaveBeenCalledWith(s, s.player.deck);
    s.player.hand = [];
    play("03009");
    run({ type: "cap:setup" });
    expect(s.player.hand).toEqual([]);
    expect(ports.shuffle).toHaveBeenCalledTimes(2);
    expect(s.hiddenInfo).toBeGreaterThan(0);
  });
  it("ready action waits for a selected discard, exhausts no other card, and is once per round", () => {
    const { s, run, select, hand } = fixture();
    const cards = hand("03003", "03004");
    s.player.exhausted = true;
    run(captainAbilityOptions(s, "identity")[0].effects[0]);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(2);
    select(cards[1].id);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard).toEqual([cards[1]]);
    s.player.exhausted = true;
    expect(captainAbilityOptions(s, "identity")).toEqual([]);
    s.round++;
    expect(captainAbilityOptions(s, "identity")).toHaveLength(1);
    s.player.form = "alter";
    expect(captainAbilityOptions(s, "identity")).toEqual([]);
  });
  it("invalid discard selection cannot ready Captain America or consume his round limit", () => {
    const { s, run, hand } = fixture();
    hand("03003");
    s.player.exhausted = true;
    expect(() => run({ type: "cap:ready-paid", ids: ["missing"] })).toThrow();
    expect(s.player.exhausted).toBe(true);
    expect(s.flags.captainReadyRound).toBeUndefined();
  });
  it("Living Legend never discounts the second ally, including a first ally played in hero form", () => {
    const { s } = fixture();
    const ally = card("03002");
    expect(captainAllyDiscount(s, ally)).toBe(0);
    captainCardPlayed(s, ally);
    s.player.form = "alter";
    expect(captainAllyDiscount(s, ally)).toBe(0);
    s.round++;
    expect(captainAllyDiscount(s, ally)).toBe(1);
    expect(captainAllyDiscount(s, card("03003"))).toBe(0);
  });
  it("Fearless Determination stacks for a phase and does not permanently change printed THW", () => {
    const { s, run } = fixture();
    run({ type: "cap:fearless" });
    run({ type: "cap:fearless" });
    expect(captainStats(s).thw).toBe(2);
    expect(captainEvent(s, makePiece(s, "03003"), [])).toEqual([
      { type: "cap:fearless" },
      { type: "draw", amount: 1 },
    ]);
    captainPhaseEnded(s);
    expect(captainStats(s).thw).toBe(0);
  });
  it("Shield supplies DEF and retaliate only while it remains in play", () => {
    const { s, play } = fixture();
    play("03009");
    expect(captainStats(s)).toEqual({ thw: 0, def: 1, retaliate: 1 });
    s.player.form = "alter";
    expect(captainStats(s)).toEqual({ thw: 0, def: 0, retaliate: 0 });
    s.player.form = "hero";
    s.player.inPlay = [];
    expect(captainStats(s).def).toBe(0);
  });
  it("Heroic Strike stuns its surviving same-title character only when paid with physical", () => {
    const { s, run, minion, ports } = fixture();
    const m = minion("03028");
    run({ type: "cap:strike", target: m.id, physical: false });
    expect(s.queue).toEqual([]);
    run({ type: "cap:strike", target: m.id, physical: true });
    expect(s.queue[0]).toEqual({
      type: "status",
      target: m.id,
      status: "stunned",
    });
    s.queue = [];
    vi.mocked(ports.attackBatch).mockImplementationOnce((s) => {
      s.villain.stage++;
      return true;
    });
    run({ type: "cap:strike", target: s.villain.id, physical: true });
    expect(s.queue).toEqual([
      { type: "status", target: s.villain.id, status: "stunned" },
    ]);
    s.queue = [];
    vi.mocked(ports.attackBatch).mockReturnValueOnce(false);
    run({ type: "cap:strike", target: m.id, physical: true });
    expect(s.queue).toEqual([]);
    vi.mocked(ports.attackBatch).mockImplementationOnce((s) => {
      s.villain.code = "02014";
      return true;
    });
    run({ type: "cap:strike", target: s.villain.id, physical: true });
    expect(s.queue).toEqual([]);
  });
  it("Shield Toss explicitly pays discards and returns even an exhausted Shield before targeting", () => {
    const { s, play, hand, minion, run, select, ports } = fixture();
    const sh = play("03009");
    sh.exhausted = true;
    const h = hand("03003", "03004");
    const m = minion("03028");
    run({ type: "cap:toss-cost" });
    expect(s.player.inPlay).toContain(sh);
    select(h[0].id, h[1].id);
    expect(s.player.discard).toEqual(h);
    expect(s.player.hand).toEqual([sh]);
    expect(sh.exhausted).toBe(false);
    expect(s.prompt?.min).toBe(2);
    select(s.villain.id, m.id);
    expect(ports.attackBatch).toHaveBeenCalledWith(s, [s.villain.id, m.id], 4);
  });
  it("Stunned replaces Shield Toss after paying all printed additional costs", () => {
    const { s, play, hand, run, select, ports } = fixture();
    const sh = play("03009");
    const h = hand("03003");
    s.player.stunned = true;
    run({ type: "cap:toss-cost" });
    select(h[0].id);
    expect(s.player.hand).toEqual([sh]);
    expect(s.player.stunned).toBe(false);
    expect(s.prompt).toBeNull();
    expect(ports.attackBatch).not.toHaveBeenCalled();
  });
  it("Shield Toss cannot target the villain together with an engaged Guard minion or hit one enemy twice", () => {
    const { s, minion, run, play, hand } = fixture();
    const guard = minion("03029");
    play("03009");
    hand("03003");
    expect(captainAttackTargets(s).map((p) => p.id)).toEqual([guard.id]);
    expect(() =>
      run({
        type: "cap:toss-targets",
        ids: [guard.id, guard.id],
        count: 2,
        eligible: [guard.id],
      }),
    ).toThrow();
    expect(captainPlayRestriction(s, makePiece(s, "03005"))).toContain(
      "damage",
    );
  });
  it("Serum is a physical resource in both forms and cannot be reused while exhausted", () => {
    const { s, play } = fixture();
    const p = play("03010");
    expect(captainResourceSources(s)[0].resources).toEqual(["physical"]);
    s.player.form = "alter";
    expect(captainResourceSources(s)).toHaveLength(1);
    p.exhausted = true;
    expect(captainResourceSources(s)).toEqual([]);
  });
  it("Apartment is an alter-ego action with a real exhaust cost and ordered draw/heal effects", () => {
    const { s, play, run } = fixture();
    const p = play("03007");
    expect(captainAbilityOptions(s, p.id)).toEqual([]);
    s.player.form = "alter";
    run(captainAbilityOptions(s, p.id)[0].effects[0]);
    expect(p.exhausted).toBe(true);
    expect(s.queue).toEqual([
      { type: "draw", amount: 1 },
      { type: "heal", target: "hero", amount: 1 },
    ]);
  });
  it("Shield Block consumes the event and exhausts Shield, prevents any damage type, and respects Tough priority", () => {
    const { s, play, hand, run } = fixture();
    const sh = play("03009");
    const h = hand("03005");
    s.player.form = "alter";
    const continuation = [
      { type: "preventAttack", amount: 99 },
      { type: "finishAttack" },
    ];
    const opts = captainShieldBlockOptions(s, continuation);
    expect(opts).toHaveLength(1);
    run(opts[0].effects[0]);
    expect(sh.exhausted).toBe(true);
    expect(s.queue).toEqual([
      { type: "resolveHandEvent", id: h[0].id, after: continuation },
    ]);
    sh.exhausted = false;
    s.player.tough = true;
    expect(captainShieldBlockOptions(s, continuation)).toEqual([]);
  });
  it("Helmet is an optional defeat replacement that leaves exactly1HP and discards itself", () => {
    const { s, play, run } = fixture();
    const helmet = play("03008");
    s.player.hp = 0;
    s.player.form = "alter";
    expect(captainHelmetOptions(s, [{ type: "defeat" }])).toEqual([]);
    s.player.form = "hero";
    const opts = captainHelmetOptions(s, [{ type: "defeat" }]);
    expect(opts[1].effects).toEqual([{ type: "defeat" }]);
    run(opts[0].effects[0]);
    expect(s.player.hp).toBe(1);
    expect(s.player.discard).toContain(helmet);
    expect(s.player.inPlay).not.toContain(helmet);
  });
});

describe("Captain America's obligation and nemesis", () => {
  it("Man Out of Time allows an optional flip then an independent outcome choice", () => {
    const { s, run, choose, hand, select } = fixture();
    const h = hand("03003", "03004", "03005", "03006", "03010");
    const p = makePiece(s, "03026");
    run(captainEncounterReveal(s, p)![0]);
    choose("stay");
    expect(s.player.form).toBe("hero");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    choose("discard");
    expect(s.prompt?.min).toBe(2);
    select(h[1].id, h[3].id);
    expect(s.player.hand).toHaveLength(3);
    expect(s.queue[0]).toEqual({ type: "discardEncounter", piece: p });
  });
  it("ready Steve can remove the obligation, exhausted Steve must choose the discard outcome", () => {
    const { s, run, choose } = fixture();
    const p = makePiece(s, "03026");
    run(captainEncounterReveal(s, p)![0]);
    choose("flip");
    choose("exhaust");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({ type: "removeEncounter", piece: p });
    s.queue = [];
    run({ type: "cap:obligation-choice", piece: p });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    choose("discard");
    expect(s.queue[0].type).toBe("discardEncounter");
  });
  it("Hit Squad discards the encounter card and counts printed numeric boosts without resolving boost text", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "03027");
    s.encounter.deck = [p];
    s.encounter.discard = [];
    run({ type: "cap:hit-squad" });
    expect(s.encounter.discard).toEqual([p]);
    expect(s.queue).toEqual([
      { type: "damage", target: "hero", amount: 3, source: "Hit Squad" },
    ]);
  });
  it("Baron Zemo restricts only the engaged identity; Hydra Soldier deals the engaged player an encounter card", () => {
    const { s, minion, run, ports } = fixture();
    const zemo = minion("03028", "p2");
    expect(captainThwartBlocked(s)).toBe(false);
    zemo.engagedWith = s.activePlayerId;
    expect(captainThwartBlocked(s)).toBe(true);
    const soldier = minion("03029", "p2");
    run(captainMinionDefeated(s, soldier)[0]);
    expect(ports.dealEncounter).toHaveBeenCalledWith(s, "p2");
  });
  it("Hail Hydra distinguishes a canceled attack from a performed attack and searches both encounter zones", () => {
    const { s, minion, run, choose } = fixture();
    const attacker = minion("03029");
    attacker.stunned = true;
    const found = makePiece(s, "03028");
    s.encounter.deck = [];
    s.encounter.discard = [found];
    run({ type: "cap:hail-hydra" });
    expect(s.queue[0]).toEqual({ type: "enemyAttack", id: attacker.id });
    const after = s.queue[1];
    s.queue = [];
    run(after);
    expect(s.queue[0].type).toBe("cap:hydra-search");
    run(s.queue.shift()!);
    choose(found.id);
    expect(s.minions).toContain(found);
    expect(found.engagedWith).toBe(s.activePlayerId);
    expect(s.encounter.discard).toEqual([]);
    expect(s.queue[0]).toEqual({ type: "minionEntered", id: found.id });
    s.queue = [];
    run({ type: "cap:hail-after", before: 0 });
    s.queue = [];
    s.flags.attacksPerformed = 1;
    run({ type: "cap:hail-after", before: 0 });
    expect(s.queue).toEqual([]);
  });
});
