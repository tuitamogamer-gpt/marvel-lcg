import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { seatView, syncSeat } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  ANT_MAN_SCRIPT_CODES,
  antManAbility,
  antManAbilityOptions,
  antManCanChangeForm,
  antManCardEntered,
  antManEncounterReveal,
  antManEnemyActivated,
  antManEnemyRetaliate,
  antManEnemyStats,
  antManEnemyTraits,
  antManEvent,
  antManForm,
  antManFormChanged,
  antManPhaseEnded,
  antManPlayRestriction,
  antManResourceSpent,
  antManStats,
  antManTurnEnded,
  resolveAntManEffect,
  type AntManPorts,
} from "../src/game/ant-man.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const A = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `antman:${type}`,
  ...args,
});
let next = 0;
const piece = (code: string, args: Partial<Piece> = {}): Piece => ({
  id: `ant${++next}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...args,
});
function fixture() {
  const player: GameState["player"] = {
    form: "hero",
    heroForm: "tiny",
    hp: 8,
    exhausted: false,
    flipped: false,
    stunned: false,
    confused: false,
    tough: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  };
  const s: GameState = {
    version: 1,
    seed: 12,
    nextId: 1,
    heroId: "ant",
    aspect: "leadership",
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
    player,
    villain: { ...piece("01094"), hp: 14, maxHp: 14, stage: 1 },
    scheme: { code: "01097", threat: 5, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    prompt: null,
    queue: [],
    log: [],
    flags: {},
    attack: null,
  };
  s.players = [
    {
      id: "p1",
      heroId: "ant",
      aspect: "leadership",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  let locked = false;
  const ports: AntManPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: () => !locked,
    flip: vi.fn((state, counts, form) => {
      if (locked || !antManCanChangeForm(state)) throw Error("Form is locked");
      state.player.form = form === "alter" ? "alter" : "hero";
      if (form !== "alter") state.player.heroForm = form || "tiny";
      if (counts) state.player.flipped = true;
      ports.queue(state, ...antManFormChanged(state, ports));
    }),
    canReadyIdentity: () => !locked,
    canPay: vi.fn(() => true),
    canGiveStatus: (state, id, status) => {
      const target =
        id === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === id);
      return !!target && !target[status];
    },
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some(
        (p) =>
          p.code === "01101" &&
          (p.engagedWith || "p1") === state.activePlayerId,
      )
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(!thwart || !state.sideSchemes.some((p) => p.code === "01104")
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)?.name || p.code,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) =>
      state.sideSchemes.some((p) => p.code === "12026") &&
      !!cards.get(p.code)?.traits?.split(/\.\s*/).includes("Tech"),
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing hand card");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: (state, id) => {
      for (const zone of [
        state.player.inPlay,
        state.attachments,
        state.minions,
      ]) {
        const i = zone.findIndex((p) => p.id === id);
        if (i >= 0) {
          const p = zone.splice(i, 1)[0];
          (cards.get(p.code)?.faction_code === "encounter"
            ? state.encounter.discard
            : state.player.discard
          ).push(p);
          return;
        }
      }
    },
    revealHidden: vi.fn((state) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    recycleEncounter: vi.fn((state) => {
      if (!state.encounter.deck.length && state.encounter.discard.length) {
        state.encounter.deck = state.encounter.discard.splice(0);
        state.encounter.acceleration++;
      }
    }),
    attackProgram: vi.fn((state, effects, after) =>
      ports.queue(state, ...effects, { type: "attackProgramEnd" }, ...after),
    ),
    log: vi.fn(),
  };
  function run(state = s) {
    for (let i = 0; state.queue.length && !state.prompt; i++) {
      if (i > 200) throw Error("Non-terminating effect queue");
      const e = state.queue.shift()!;
      if (resolveAntManEffect(state, e, ports)) continue;
      switch (e.type) {
        case "optional":
          ports.choose(state, e.title, e.text, [
            { id: "yes", label: "Use", effects: e.effects },
            { id: "skip", label: "Pass", effects: [] },
          ]);
          break;
        case "draw":
          state.player.hand.push(...state.player.deck.splice(0, e.amount));
          break;
        case "heal":
          state.player.hp = Math.min(12, state.player.hp + e.amount);
          break;
        case "ready":
          if (ports.canReadyIdentity(state, state.activePlayerId))
            state.player.exhausted = false;
          break;
        case "exhaust": {
          const p = state.player.inPlay.find((p) => p.id === e.id);
          if (p) p.exhausted = true;
          break;
        }
        case "damage": {
          if (e.target === state.villain.id) state.villain.hp -= e.amount;
          else {
            const p = state.minions.find((p) => p.id === e.target);
            if (p) {
              p.damage += e.amount;
              if (p.damage >= (cards.get(p.code)?.health || 1))
                ports.discardPiece(state, p.id);
            }
          }
          break;
        }
        case "thwart":
          if (e.target === "main")
            state.scheme.threat = Math.max(0, state.scheme.threat - e.amount);
          else {
            const p = state.sideSchemes.find((p) => p.id === e.target);
            if (p) p.counters = Math.max(0, p.counters - e.amount);
          }
          break;
        case "status": {
          const p =
            e.target === state.villain.id
              ? state.villain
              : state.minions.find((p) => p.id === e.target);
          if (p) p[e.status as "stunned" | "confused"] = true;
          break;
        }
        case "payRequest":
          state.prompt = {
            kind: "payment",
            title: e.title,
            text: "Pay",
            cost: e.cost,
            requirements: e.requirements,
            after: e.after,
            paymentCommit: e.commit,
            options: [],
            cancelable: e.cancelable,
          };
          break;
        case "reveal":
          state.resolving.push(e.piece);
          ports.queue(state, ...(antManEncounterReveal(state, e.piece) || []));
          break;
        case "attackProgramEnd":
          break;
        default:
          throw Error(`Unknown fixture effect ${e.type}`);
      }
    }
  }
  function choose(id: string, state = s) {
    const o = state.prompt?.options.find((o) => o.id === id);
    if (!o) throw Error(`Missing choice ${id} (${state.prompt?.title})`);
    state.prompt = null;
    ports.queue(state, ...o.effects);
    run(state);
  }
  return {
    s,
    ports,
    run,
    choose,
    lock: (value: boolean) => {
      locked = value;
    },
  };
}

describe("Ant-Man native signatures and nemesis", () => {
  it("owns each assigned printed face exactly once", () => {
    expect(new Set(ANT_MAN_SCRIPT_CODES).size).toBe(18);
    for (const code of ANT_MAN_SCRIPT_CODES) expect(cards.has(code)).toBe(true);
  });
  it("distinguishes Tiny, Giant and alter-ego without changing the public discriminator", () => {
    const { s } = fixture();
    expect(antManForm(s)).toBe("tiny");
    s.player.heroForm = "giant";
    expect(antManForm(s)).toBe("giant");
    s.player.form = "alter";
    expect(antManForm(s)).toBe("alter");
  });
  it("offers optional form responses and blanks Helmet while Tech Theft is in play", () => {
    const { s, ports } = fixture();
    s.player.inPlay.push(piece("12008"), piece("12009"), piece("12009"));
    s.player.heroForm = "giant";
    expect(antManFormChanged(s, ports).map((e) => e.title)).toEqual([
      "Giant Nuisance",
      "Ant-Man's Helmet",
      "Giant Strength",
      "Giant Strength",
    ]);
    s.sideSchemes.push(piece("12026", { counters: 2 }));
    expect(antManFormChanged(s, ports).map((e) => e.title)).toEqual([
      "Giant Nuisance",
      "Giant Strength",
      "Giant Strength",
    ]);
    expect(s.player.hp).toBe(8);
  });
  it("stacks every resolved Giant Strength response and expires at the actual turn boundary", () => {
    const { s, ports } = fixture();
    const strength = piece("12009");
    s.player.inPlay.push(strength);
    s.player.heroForm = "giant";
    const inner = antManFormChanged(s, ports).find(
      (e) => e.title === "Giant Strength",
    )!.effects[0];
    resolveAntManEffect(s, inner, ports);
    resolveAntManEffect(s, inner, ports);
    expect(antManStats(s).attack).toBe(2);
    s.player.inPlay = [];
    expect(antManStats(s).attack).toBe(2);
    antManTurnEnded(s, "p2");
    expect(antManStats(s).attack).toBe(2);
    antManTurnEnded(s);
    expect(antManStats(s).attack).toBe(0);
    s.flags.antManStrengthTurn = "1:villain:p1";
    s.flags.antManStrengthAmount = 1;
    antManPhaseEnded(s);
    expect(s.flags.antManStrengthAmount).toBeUndefined();
  });
  it("Pym Particles reacts in the form in which it was spent and offers no alter-ego response", () => {
    const { s, ports } = fixture();
    const p = piece("12006");
    expect(antManResourceSpent(s, p, ports)[0].effects[0]).toMatchObject({
      type: "draw",
      amount: 1,
    });
    s.player.heroForm = "giant";
    expect(antManResourceSpent(s, p, ports)[0].effects[0]).toMatchObject({
      type: "heal",
      amount: 2,
    });
    s.player.form = "alter";
    expect(antManResourceSpent(s, p, ports)).toEqual([]);
  });
  it("Wasp and Puny Pest remove threat without a thwart or confusion and ignore Crisis", () => {
    const { s, ports, run, choose } = fixture();
    s.player.confused = true;
    s.sideSchemes.push(piece("01104", { counters: 2 }));
    const wasp = piece("12002");
    ports.queue(s, ...antManCardEntered(s, wasp, ports));
    run();
    choose("yes");
    choose("main");
    expect(s.scheme.threat).toBe(3);
    expect(s.player.confused).toBe(true);
    ports.queue(s, A("puny-pest"));
    run();
    expect(
      s.prompt?.options.find((o) => o.id === "main")?.effects[0],
    ).toMatchObject({ action: false, ignoreCrisis: true });
    choose("main");
    expect(s.scheme.threat).toBe(2);
  });
  it("Giant Nuisance and Giant Wasp deal non-attack damage while stunned and through Guard", () => {
    const { s, ports, run, choose } = fixture();
    s.player.heroForm = "giant";
    s.player.stunned = true;
    s.minions.push(piece("01101"));
    ports.queue(s, A("giant-nuisance"));
    run();
    choose(s.villain.id);
    ports.queue(s, ...antManCardEntered(s, piece("12002"), ports));
    run();
    choose("yes");
    choose(s.villain.id);
    expect(s.villain.hp).toBe(11);
    expect(s.player.stunned).toBe(true);
  });
  it("does not grant size responses to an ordinary hero controlling Wasp or Tech upgrades", () => {
    const { s, ports } = fixture();
    s.heroId = s.players[0].heroId = "spider_man";
    delete s.player.heroForm;
    s.player.inPlay.push(
      piece("12008"),
      piece("12009"),
      piece("12007"),
      piece("12010"),
    );
    expect(antManCardEntered(s, piece("12002"), ports)).toEqual([]);
    expect(antManFormChanged(s, ports)).toEqual([]);
    expect(antManResourceSpent(s, piece("12006"), ports)).toEqual([]);
    expect(antManAbilityOptions(s, s.player.inPlay[2].id, ports)).toEqual([]);
    expect(antManAbilityOptions(s, s.player.inPlay[3].id, ports)).toEqual([]);
    expect(antManPlayRestriction(s, piece("12004"), ports)).toMatch(/Tiny/);
  });
  it("Giant Stomp removes one stun instead of its entire attack program", () => {
    const { s, ports, run } = fixture();
    s.player.heroForm = "giant";
    s.player.stunned = true;
    s.minions.push(piece("01101"));
    ports.queue(s, ...antManEvent(s, piece("12003"))!);
    run();
    expect(s.player.stunned).toBe(false);
    expect(ports.attackProgram).not.toHaveBeenCalled();
    expect(s.minions[0].damage).toBe(0);
  });
  it("Giant Stomp resolves all minion damage before choosing its 8-damage enemy", () => {
    const { s, ports, run } = fixture();
    s.player.heroForm = "giant";
    const guard = piece("01101", { damage: 2 });
    s.minions.push(guard);
    ports.queue(s, ...antManEvent(s, piece("12003"))!);
    run();
    expect(s.minions).toHaveLength(0);
    expect(s.encounter.discard.map((p) => p.id)).toContain(guard.id);
    expect(s.villain.hp).toBe(6);
    expect(ports.attackProgram).toHaveBeenCalledOnce();
  });
  it("Hive Mind adds every Army of Ants and consumes confusion only once", () => {
    const { s, ports, run } = fixture();
    s.player.inPlay.push(piece("12007"), piece("12007"), piece("12007"));
    ports.queue(s, ...antManEvent(s, piece("12004"))!);
    run();
    expect(s.scheme.threat).toBe(0);
    s.scheme.threat = 5;
    s.player.confused = true;
    ports.queue(s, A("hive-mind"));
    run();
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(5);
  });
  it("enforces printed hero-form restrictions before event payment", () => {
    const { s, ports, lock } = fixture();
    expect(antManPlayRestriction(s, piece("12003"), ports)).toMatch(/Giant/);
    s.player.heroForm = "giant";
    expect(antManPlayRestriction(s, piece("12004"), ports)).toMatch(/Tiny/);
    lock(true);
    expect(antManPlayRestriction(s, piece("12005"), ports)).toMatch(
      /cannot change/,
    );
  });
  it("Army chooses its target before committing exhaustion and survives JSON hydration", () => {
    const { s, ports, run, choose } = fixture();
    const army = piece("12007");
    s.player.inPlay.push(army);
    s.minions.push(piece("12027"));
    ports.queue(s, ...antManAbility(s, army.id, "army-of-ants", ports)!);
    run();
    expect(army.exhausted).toBe(false);
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    syncSeat(saved);
    choose(saved.villain.id, saved);
    expect(saved.player.inPlay[0].exhausted).toBe(true);
    expect(saved.villain.hp).toBe(13);
    expect(s.villain.hp).toBe(14);
  });
  it("Wrist Gauntlets requests exact form-dependent resources and commits only after payment", () => {
    const { s, ports, run } = fixture();
    const gauntlets = piece("12010");
    s.player.inPlay.push(gauntlets);
    ports.queue(s, ...antManAbility(s, gauntlets.id, undefined, ports)!);
    run();
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: ["energy", "energy"],
      cancelable: true,
    });
    expect(gauntlets.exhausted).toBe(false);
    s.prompt = null;
    expect(gauntlets.exhausted).toBe(false); // canceled payment
    s.player.heroForm = "giant";
    ports.queue(s, ...antManAbility(s, gauntlets.id, undefined, ports)!);
    run();
    expect((s.prompt as GameState["prompt"])?.requirements).toEqual([
      "physical",
      "physical",
    ]);
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    syncSeat(saved);
    const after = saved.prompt!.after!;
    const commit = saved.prompt!.paymentCommit!;
    saved.prompt = null;
    ports.queue(saved, ...commit, ...after);
    run(saved);
    expect(saved.player.inPlay[0].exhausted).toBe(true);
    expect(saved.villain.stunned).toBe(true);
    expect(gauntlets.exhausted).toBe(false);
  });
  it("Gauntlets filters illegal status targets and is disabled by Tech Theft", () => {
    const { s, ports } = fixture();
    const p = piece("12010");
    s.player.inPlay.push(p);
    s.villain.confused = true;
    expect(antManAbilityOptions(s, p.id, ports)).toEqual([]);
    s.villain.confused = false;
    expect(antManAbilityOptions(s, p.id, ports)).toHaveLength(1);
    s.sideSchemes.push(piece("12026"));
    expect(antManAbilityOptions(s, p.id, ports)).toEqual([]);
  });
  it("Resize preserves the voluntary flip receipt and draws after its response window", () => {
    const { s, ports, run, choose } = fixture();
    s.player.flipped = true;
    const draw = piece("12007");
    s.player.deck.push(draw);
    ports.queue(s, ...antManEvent(s, piece("12005"))!);
    run();
    expect(antManForm(s)).toBe("giant");
    expect(s.player.flipped).toBe(true);
    expect(s.player.hand).toHaveLength(0);
    expect(s.prompt?.title).toBe("Giant Nuisance");
    choose("skip");
    expect(s.player.hand[0].id).toBe(draw.id);
    expect(ports.flip).toHaveBeenCalledWith(s, false, "giant");
  });
  it("Swarm Tactics requires its Team-Up and then changes hero form and readies", () => {
    const { s, ports, run, choose } = fixture();
    const swarm = piece("12020");
    expect(antManPlayRestriction(s, swarm, ports)).toMatch(/Ant-Man and Wasp/);
    s.player.inPlay.push(piece("12002"));
    s.player.exhausted = true;
    expect(antManPlayRestriction(s, swarm, ports)).toBeNull();
    ports.queue(s, ...antManEvent(s, swarm)!);
    run();
    choose("skip");
    expect(antManForm(s)).toBe("giant");
    expect(s.player.exhausted).toBe(false);
    s.heroId = s.players[0].heroId = "spider_man";
    s.player.inPlay.push(piece("12011"));
    expect(antManPlayRestriction(s, swarm, ports)).toMatch(
      /one as your identity/,
    );
  });
  it("Care for Cassie may flip and remove exactly the physical obligation", () => {
    const { s, ports, run, choose } = fixture();
    const obligation = piece("12025");
    s.resolving.push(obligation);
    ports.queue(s, ...antManEncounterReveal(s, obligation)!);
    run();
    choose("flip");
    expect(s.prompt?.title).toBe("Time to Unwind");
    choose("yes");
    expect(s.player.hp).toBe(9);
    choose("remove");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.resolving).toHaveLength(0);
    expect(s.removed.map((p) => p.id)).toEqual([obligation.id]);
  });
  it("Care discards the chosen physical card and locks all changes through the next own turn end", () => {
    const { s, ports, run, choose } = fixture();
    const first = piece("12007"),
      second = piece("12006");
    s.player.hand.push(first, second);
    ports.queue(s, A("obligation-choice", { piece: piece("12025") }));
    run();
    choose("discard");
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    syncSeat(saved);
    choose(second.id, saved);
    expect(saved.player.hand.map((p) => p.id)).toEqual([first.id]);
    expect(saved.player.discard.map((p) => p.id)).toEqual([second.id]);
    expect(antManCanChangeForm(saved)).toBe(false);
    antManTurnEnded(saved);
    expect(antManCanChangeForm(saved)).toBe(false);
    saved.round = 2;
    antManTurnEnded(saved, "p2");
    expect(antManCanChangeForm(saved)).toBe(false);
    antManTurnEnded(saved);
    expect(antManCanChangeForm(saved)).toBe(true);
  });
  it("Care still locks form with an empty hand and respects an existing form lock", () => {
    const { s, ports, run, choose, lock } = fixture();
    lock(true);
    ports.queue(s, ...antManEncounterReveal(s, piece("12025"))!);
    run();
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    choose("discard");
    expect(s.flags.antManCannotChangeUntilTurnEnd).toBe(2);
  });
  it("Yellowjacket's modifiers follow its engaged identity rather than the currently active player", () => {
    const { s } = fixture();
    const yellowjacket = piece("12027", { engagedWith: "p2" });
    const other = structuredClone(s.players[0]);
    other.id = "p2";
    other.player.heroForm = "giant";
    s.players.push(other);
    expect(antManEnemyStats(s, yellowjacket).attack).toBe(0);
    expect(antManEnemyRetaliate(s, yellowjacket)).toBe(1);
    expect(antManEnemyTraits(s, yellowjacket)).toEqual(["Giant"]);
    other.player.heroForm = "tiny";
    expect(antManEnemyStats(s, yellowjacket).attack).toBe(1);
    expect(antManEnemyRetaliate(s, yellowjacket)).toBe(0);
    expect(antManEnemyTraits(s, yellowjacket)).toEqual(["Tiny"]);
    other.heroId = "spider_man";
    delete other.player.heroForm;
    expect(antManEnemyStats(s, yellowjacket).attack).toBe(0);
    expect(antManEnemyTraits(s, yellowjacket)).toEqual([]);
  });
  it("Size Increase prefers Yellowjacket and lasts exactly three completed activations", () => {
    const { s, ports, run } = fixture();
    const yellowjacket = piece("12027"),
      increase = piece("12028");
    s.minions.push(yellowjacket);
    s.attachments.push(increase);
    ports.queue(s, ...antManEncounterReveal(s, increase)!);
    run();
    expect(increase.attachedTo).toBe(yellowjacket.id);
    expect(increase.counters).toBe(3);
    expect(antManEnemyStats(s, yellowjacket)).toEqual({ attack: 3, scheme: 2 });
    for (let count = 2; count >= 0; count--) {
      ports.queue(s, ...antManEnemyActivated(s, yellowjacket.id));
      run();
      expect(increase.counters).toBe(count);
    }
    expect(s.attachments).toHaveLength(0);
    expect(s.encounter.discard.map((p) => p.id)).toContain(increase.id);
    expect(antManEnemyStats(s, yellowjacket)).toEqual({ attack: 1, scheme: 0 });
  });
  it("Size Increase falls back to the villain and stacks independent physical copies", () => {
    const { s, ports, run } = fixture();
    s.attachments.push(piece("12028"), piece("12028"));
    for (const p of s.attachments) {
      ports.queue(s, ...antManEncounterReveal(s, p)!);
      run();
    }
    expect(
      s.attachments.every(
        (p) => p.attachedTo === s.villain.id && p.counters === 3,
      ),
    ).toBe(true);
    expect(antManEnemyStats(s, s.villain)).toEqual({ attack: 4, scheme: 4 });
  });
  it("Yellowjacket's Plan reveals the exact discarded nemesis and conserves the last card across recycling", () => {
    const { s, ports, run } = fixture();
    const unrelated = piece("01109"),
      found = piece("12026");
    s.encounter.deck.push(unrelated, found);
    ports.queue(s, ...antManEncounterReveal(s, piece("12029"))!);
    run();
    expect(s.resolving.map((p) => p.id)).toEqual([found.id]);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([unrelated.id]);
    expect(s.encounter.acceleration).toBe(1);
    expect(ports.revealHidden).toHaveBeenCalledTimes(2);
  });
  it("Yellowjacket's Plan stops after exhausting the original encounter deck", () => {
    const { s, ports, run } = fixture();
    const unrelated = piece("01109"),
      previousNemesis = piece("12026");
    s.encounter.deck.push(unrelated);
    s.encounter.discard.push(previousNemesis);
    ports.queue(s, A("plan"));
    run();
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([
      previousNemesis.id,
      unrelated.id,
    ]);
    expect(s.resolving).toHaveLength(0);
    expect(ports.revealHidden).toHaveBeenCalledOnce();
  });
});
