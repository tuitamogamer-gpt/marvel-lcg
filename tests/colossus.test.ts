import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { seatView } from "../src/game/team.js";
import { statusCards, giveStatus } from "../src/game/keywords.js";
import * as colossus from "../src/game/colossus.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";

const cards = new Map((catalog as unknown as Card[]).map((p) => [p.code, p]));
let serial = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `colossus${++serial}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
function fixture() {
  const player: GameState["player"] = {
    form: "hero",
    hp: 14,
    exhausted: false,
    flipped: false,
    tough: false,
    stunned: false,
    confused: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  };
  const s: GameState = {
    version: 1,
    seed: 32,
    nextId: 1,
    heroId: "colossus",
    aspect: "protection",
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
    queue: [],
    prompt: null,
    flags: {},
    log: [],
    attack: null,
  };
  s.players.push({
    id: "p1",
    heroId: "colossus",
    aspect: "protection",
    player,
    flags: s.flags,
    ended: false,
    eliminated: false,
    mulliganDone: true,
  });
  const native: Effect[] = [];
  const target = (id: string) =>
    id === "hero" || id === "hero:p1"
      ? s.player
      : id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player
        : [
            ...s.players.flatMap((seat) => seat.player.inPlay),
            ...s.minions,
            s.villain,
          ].find((p) => p.id === id);
  const ports: colossus.ColossusPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_state, p) => Boolean(s.flags[`blank:${p.id}`]),
    isIdentityTextBlank: () => Boolean(s.flags.identityBlank),
    canDraw: () => s.player.deck.length + s.player.discard.length > 0,
    canReadyIdentity: () => !s.flags.readyLocked,
    canChangeForm: () => !s.flags.formLocked,
    flip: vi.fn((state, counts, form) => {
      state.player.form = form;
      if (counts) state.player.flipped = true;
    }),
    cardCost: (_state, p) => Number(cards.get(p.code)?.cost || 0),
    canPay: () => true,
    canGiveStatus: (_state, id, kind) => {
      const p = target(id);
      if (!p) return false;
      if (kind === "tough")
        return (
          statusCards(p, "tough") <
          (id.startsWith("hero") ? colossus.colossusToughLimit(s, ports) : 1)
        );
      if (cards.get((p as Piece).code)?.text?.includes("Stalwart"))
        return false;
      return !p[kind];
    },
    enemyTargets: (_state, attack) => [
      ...(!attack || !s.minions.some((p) => p.code === "01101")
        ? [{ id: s.villain.id, label: "Rhino", code: s.villain.code }]
        : []),
      ...s.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
        code: p.code,
      })),
    ],
    friendlyTargets: () => [
      ...s.players.map((seat) => ({
        id: `hero:${seat.id}`,
        label: seat.heroId,
      })),
      ...s.players.flatMap((seat) =>
        seat.player.inPlay
          .filter((p) => cards.get(p.code)?.type_code === "ally")
          .map((p) => ({ id: p.id, label: cards.get(p.code)!.name })),
      ),
    ],
    attackProgram: (_state, effects, after) => {
      native.push(...effects, ...after);
    },
    shufflePlayerDeck: vi.fn((state, after) => ports.queue(state, ...after)),
    shuffleEncounter: vi.fn(),
    makePiece: (_state, code) => piece(code),
    revealEncounter: vi.fn((_state, p) =>
      native.push({ type: "reveal", piece: p }),
    ),
    attach: (state, p, id) => {
      p.attachedTo = id;
      state.attachments.push(p);
    },
    discardPiece: (state, id) => {
      for (const zone of [state.player.inPlay, state.attachments]) {
        const index = zone.findIndex((p) => p.id === id);
        if (index >= 0) state.player.discard.push(zone.splice(index, 1)[0]);
      }
    },
    discardTough: vi.fn(
      (
        state: GameState,
        targets: { targetId: string; amount: number }[],
        after: Effect[],
      ) => {
        const receipts = targets.map((item) => {
          const p = target(item.targetId)!;
          const count = Math.min(statusCards(p, "tough"), item.amount);
          p.toughCards = statusCards(p, "tough") - count;
          p.tough = p.toughCards > 0;
          return {
            token: `discard:${state.nextId++}`,
            playerId: item.targetId.startsWith("hero:")
              ? item.targetId.slice(5)
              : state.activePlayerId,
            targetId: item.targetId,
            count,
            wasHero: state.player.form === "hero",
          };
        });
        ports.queue(
          state,
          ...receipts.flatMap((receipt) =>
            colossus.colossusToughDiscarded(state, receipt, ports),
          ),
          ...after,
        );
      },
    ),
    discardUntilColossus: vi.fn((_state, after) =>
      native.push({ type: "discardUntilColossus" }, ...after),
    ),
    playReaction: vi.fn((_state, id, context, after) =>
      native.push({ type: "playReaction", id, context, after }),
    ),
    resumeBasicAttack: (state, packet, after) =>
      ports.queue(state, packet, ...after),
    activationAvailable: () => !s.flags.activationEnded,
  };
  const run = (e: Effect) => colossus.resolveColossusEffect(s, e, ports);
  const tick = () => {
    const e = s.queue.shift()!;
    if (e.type.startsWith("colossus:")) run(e);
    else if (e.type === "status") {
      const p = target(e.target)!;
      giveStatus(
        p,
        cards.get((p as Piece).code) || cards.get("32001a")!,
        e.status,
        {
          toughLimit: e.target.startsWith("hero")
            ? colossus.colossusToughLimit(s, ports)
            : 1,
        },
      );
    } else native.push(e);
  };
  const pick = (id: string) => {
    const option = s.prompt?.options.find((o) => o.id === id);
    expect(option).toBeTruthy();
    s.prompt = null;
    ports.queue(s, ...option!.effects);
    tick();
  };
  return { s, ports, native, run, tick, pick };
}
const C = (type: string, patch: Record<string, unknown> = {}): Effect => ({
  type: `colossus:${type}`,
  ...patch,
});
const tough = (s: GameState, count: number) => {
  s.player.toughCards = count;
  s.player.tough = count > 0;
};

describe("native Colossus", () => {
  it("covers all physical hero and nemesis faces with original counts", () => {
    expect(colossus.COLOSSUS_SCRIPT_CODES).toHaveLength(16);
    const selected = colossus.COLOSSUS_SCRIPT_CODES.map((code) =>
      cards.get(code)!,
    );
    expect(selected.every((p) => p.pack_code === "mut_gen")).toBe(true);
    expect(
      selected
        .filter(
          (p) =>
            p.faction_code === "hero" &&
            !["hero", "alter_ego"].includes(p.type_code),
        )
        .reduce((sum, p) => sum + Number(p.quantity), 0),
    ).toBe(15);
    expect(colossus.colossusEventAction(piece("32008"))).toBe("attack");
  });
  it("native Organic Steel entry places two Uses counters on its actual reset physical instance", () => {
    const { s, run } = fixture();
    const steel = piece("32006");
    s.player.inPlay.push(steel);
    run(colossus.colossusCardEntered(s, steel)[0]);
    expect(steel.counters).toBe(2);
    expect(s.player.inPlay).toEqual([steel]);
    expect(colossus.colossusCardEntered(s, piece("32004"))).toEqual([]);
  });
  it("setup searches only the physical remaining deck after opening hand/mulligan", () => {
    const { s, ports, run, pick } = fixture();
    s.player.form = "alter";
    const hand = piece("32006"),
      deck = piece("32006"),
      discard = piece("32006");
    s.player.hand.push(hand);
    s.player.deck.push(deck, piece("32004"));
    s.player.discard.push(discard);
    run(colossus.colossusSetup(s)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([deck.id]);
    pick(deck.id);
    expect(s.player.hand.map((p) => p.id)).toEqual([hand.id, deck.id]);
    expect(s.player.discard[0]).toBe(discard);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(colossus.colossusSetup(s)).toEqual([]);
  });
  it("setup never fabricates Organic Steel when both physical copies are outside deck", () => {
    const { s, run, ports } = fixture();
    s.player.hand.push(piece("32006"));
    s.player.discard.push(piece("32006"));
    run(colossus.colossusSetup(s)[0]);
    expect(s.prompt).toBeNull();
    expect(s.player.hand).toHaveLength(1);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Steel Skin and Aspiring Artist are optional actual change-of-form windows", () => {
    const { s, ports, run, pick, tick } = fixture();
    run(colossus.colossusFormChanged(s, ports)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "steel-skin",
      "continue",
    ]);
    pick("steel-skin");
    tick();
    expect(statusCards(s.player, "tough")).toBe(1);
    s.player.form = "alter";
    const discarded = piece("32008");
    s.player.discard.push(discarded, piece("01111"));
    run(colossus.colossusFormChanged(s, ports)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      discarded.id,
      "continue",
    ]);
    pick(discarded.id);
    expect(s.player.deck).toContain(discarded);
  });
  it("hero permits two Tough while alter ego and blanked identity discard down to one", () => {
    const { s, ports } = fixture();
    tough(s, 2);
    expect(colossus.colossusToughLimit(s, ports)).toBe(2);
    s.player.form = "alter";
    expect(colossus.colossusEnforceToughLimit(s, ports)).toBe(true);
    expect(statusCards(s.player, "tough")).toBe(1);
    s.player.form = "hero";
    tough(s, 2);
    s.flags.identityBlank = true;
    colossus.colossusEnforceToughLimit(s, ports);
    expect(statusCards(s.player, "tough")).toBe(1);
  });
  it("Iron Will responds once per actual discarded Tough including a simultaneous two-card batch", () => {
    const { s, ports, run, pick, tick, native } = fixture();
    const iron = piece("32004");
    s.player.inPlay.push(iron);
    s.player.deck.push(piece("32006"));
    tough(s, 2);
    ports.discardTough(
      s,
      [{ targetId: "hero:p1", amount: 2 }],
      [{ type: "resume" }],
    );
    expect(statusCards(s.player, "tough")).toBe(0);
    tick();
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      `${iron.id}:0`,
      `${iron.id}:1`,
      "continue",
    ]);
    pick(`${iron.id}:0`);
    tick();
    tick();
    expect(native).toEqual([{ type: "draw", amount: 1 }]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      `${iron.id}:1`,
      "continue",
    ]);
    pick(`${iron.id}:1`);
    tick();
    tick();
    tick();
    expect(native).toEqual([
      { type: "draw", amount: 1 },
      { type: "draw", amount: 1 },
      { type: "resume" },
    ]);
    expect(
      colossus.colossusToughDiscardOptions(
        s,
        {
          token: "discard:1",
          playerId: "p1",
          targetId: "hero:p1",
          count: 2,
          wasHero: true,
        },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(run({ type: "unrelated" })).toBe(false);
  });
  it("Organic Steel keeps new Tough after completed Piercing damage and its last use discards the actual upgrade", () => {
    const { s, ports, pick, tick } = fixture();
    const steel = piece("32006", { counters: 1 });
    s.player.inPlay.push(steel);
    // Native host finished the whole Piercing/damage occurrence before opening
    // these deferred receipts. The new Tough cannot undo the six HP damage.
    tough(s, 0);
    s.player.hp = 8;
    ports.queue(
      s,
      ...colossus.colossusToughDiscarded(
        s,
        {
          token: "piercing:1",
          playerId: "p1",
          targetId: "hero:p1",
          count: 2,
          wasHero: true,
        },
        ports,
      ),
      { type: "attack-aftermath", piercingHandled: true },
    );
    tick();
    pick(`${steel.id}:0`);
    expect(steel.exhausted).toBe(true);
    expect(s.player.inPlay).not.toContain(steel);
    expect(s.player.discard).toContain(steel);
    tick();
    expect(statusCards(s.player, "tough")).toBe(1);
    expect(s.player.hp).toBe(8);
    tick();
    expect(s.queue[0]).toMatchObject({
      type: "attack-aftermath",
      piercingHandled: true,
    });
  });
  it("Titanium generates physical resources from actual Tough counts and never in alter ego", () => {
    const { s, ports } = fixture();
    const muscles = piece("32005");
    s.player.inPlay.push(muscles);
    tough(s, 2);
    expect(colossus.colossusResourceSources(s, ports)[0].resources).toEqual([
      "physical",
      "physical",
    ]);
    colossus.colossusResourceSpent(s, muscles.id, ports);
    expect(muscles.exhausted).toBe(true);
    expect(() =>
      colossus.colossusResourceSpent(s, muscles.id, ports),
    ).toThrow();
    muscles.exhausted = false;
    s.player.form = "alter";
    expect(colossus.colossusResourceSources(s, ports)).toEqual([]);
  });
  it("Made of Rage is offered after Stun replacement and spends Tough before a +6 Overkill continuation", () => {
    const { s, ports, run, tick } = fixture();
    const rage = piece("32007");
    s.player.hand.push(rage);
    tough(s, 1);
    const packet = {
      type: "basicPower",
      power: "attack",
      amount: 3,
      basicStatAmount: 3,
    };
    s.player.stunned = true;
    expect(colossus.colossusBasicAttackOptions(s, packet, [], ports)).toEqual(
      [],
    );
    s.player.stunned = false;
    expect(
      colossus.colossusBasicAttackOptions(s, packet, [], ports)[0].id,
    ).toBe(rage.id);
    run(
      colossus.colossusReaction(s, rage, { kind: "basic-attack", packet })[0],
    );
    expect(statusCards(s.player, "tough")).toBe(0);
    tick();
    expect(s.queue[0]).toMatchObject({
      type: "basicPower",
      amount: 9,
      overkill: true,
    });
  });
  it("Armor Up interrupts any actual villain activation but requires alter form and permits native type reset", () => {
    const { s, ports, run } = fixture();
    const armor = piece("32010");
    s.player.hand.push(armor);
    s.player.form = "alter";
    const receipt: colossus.ColossusActivationReceipt = {
      token: "activation:1",
      enemyId: s.villain.id,
      playerId: "p2",
      kind: "scheme",
      isVillain: true,
    };
    expect(
      colossus.colossusActivationOptions(s, receipt, [], ports)[0].id,
    ).toBe(armor.id);
    expect(
      colossus.colossusActivationOptions(
        s,
        { ...receipt, isVillain: false },
        [],
        ports,
      ),
    ).toEqual([]);
    run(
      colossus.colossusReaction(s, armor, { kind: "activation", receipt })[0],
    );
    expect(ports.flip).toHaveBeenCalledWith(s, false, "hero");
    expect(s.player.flipped).toBe(false);
  });
  it("Steel Fist carries all printed clauses inside one attack and cannot spend Tough to status Stalwart", () => {
    const { s, ports, run, pick, native } = fixture();
    const fist = piece("32008"),
      juggernaut = piece("32026");
    s.minions.push(juggernaut);
    tough(s, 1);
    run(colossus.colossusEvent(s, fist)![0]);
    pick(juggernaut.id);
    expect(native[0]).toMatchObject({
      type: "damage",
      amount: 5,
      attack: true,
      eventCode: "32008",
    });
    expect(native[1]).toMatchObject({
      type: "colossus:steel-fist-status",
      target: juggernaut.id,
    });
    run(native[1]);
    expect(s.prompt).toBeNull();
    expect(statusCards(s.player, "tough")).toBe(1);
    expect(colossus.colossusPlayRestriction(s, fist, ports)).toBeNull();
  });
  it("Bulletproof Protector pays one Tough first and gives two or readies", () => {
    const { s, run, tick, pick } = fixture();
    const event = piece("32009");
    tough(s, 1);
    s.player.exhausted = true;
    run(colossus.colossusAdditionalCost(s, event)[0]);
    expect(statusCards(s.player, "tough")).toBe(0);
    run(colossus.colossusEvent(s, event)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["tough", "ready"]);
    pick("tough");
    tick();
    tick();
    expect(statusCards(s.player, "tough")).toBe(2);
  });
  it("Piotr Studio requires alter form, actual support, ready source and blanking legality", () => {
    const { s, ports, run } = fixture();
    const studio = piece("32003");
    s.player.inPlay.push(studio);
    s.player.deck.push(piece("32004"));
    expect(colossus.colossusAbilityOptions(s, studio.id, ports)).toEqual([]);
    s.player.form = "alter";
    run(colossus.colossusAbility(s, studio.id, ports)![0]);
    expect(studio.exhausted).toBe(true);
    expect(ports.discardUntilColossus).toHaveBeenCalledOnce();
    studio.exhausted = false;
    s.flags[`blank:${studio.id}`] = true;
    expect(colossus.colossusAbility(s, studio.id, ports)).toBeNull();
  });
  it("Piotr Studio legality never reveals whether hidden deck cards include a signature", () => {
    const { s, ports } = fixture();
    s.player.form = "alter";
    const studio = piece("32003");
    s.player.inPlay.push(studio);
    s.player.deck.push(piece("01111"));
    expect(colossus.colossusAbility(s, studio.id, ports)).toEqual([
      C("studio", { id: studio.id }),
    ]);
  });
  it("nemesis reserve preserves all five owned physical cards and repeat Shadows only surges", () => {
    const { s, ports, run, native } = fixture();
    colossus.colossusInitializeNemesis(s, ports);
    const ids = s.player.setAside!.map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
    expect(s.player.setAside!.every((p) => p.ownerId === "p1")).toBe(true);
    colossus.colossusInitializeNemesis(s, ports);
    expect(s.player.setAside!.map((p) => p.id)).toEqual(ids);
    const effects = colossus.colossusShadowOfPast(s)!;
    effects.forEach(run);
    expect(native.map((e) => e.piece.code)).toEqual(["32026", "32027"]);
    expect(s.encounter.deck.map((p) => p.code)).toEqual([
      "32028",
      "32028",
      "32029",
    ]);
    expect(s.player.setAside).toEqual([]);
    expect(colossus.colossusShadowOfPast(s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });
  it("Rampaging Juggernaut batch discards all friendly Tough before responses and counts both Colossus cards", () => {
    const { s, ports, run, tick } = fixture();
    const rampage = piece("32027"),
      ally = piece("32002", { tough: true, toughCards: 1 });
    s.sideSchemes.push(rampage);
    s.player.inPlay.push(ally);
    tough(s, 2);
    run(colossus.colossusEncounterReveal(s, rampage)![0]);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(statusCards(ally, "tough")).toBe(0);
    expect(ports.discardTough).toHaveBeenCalledWith(
      s,
      [
        { targetId: "hero:p1", amount: 2 },
        { targetId: ally.id, amount: 1 },
      ],
      [C("rampage-threat", { id: rampage.id, count: 3 })],
    );
    tick();
    expect(s.queue[0]).toMatchObject({
      type: "threat",
      target: rampage.id,
      amount: 6,
    });
  });
  it("Unstoppable chooses highest printed ATK without a copy and grants keywords only for a real attack", () => {
    const { s, ports, run, pick } = fixture();
    const juggernaut = piece("32026"),
      attachment = piece("32028");
    s.minions.push(juggernaut);
    run(colossus.colossusEncounterReveal(s, attachment)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([juggernaut.id]);
    pick(juggernaut.id);
    expect(attachment.attachedTo).toBe(juggernaut.id);
    expect(colossus.colossusEnemyStats(s, juggernaut, ports).attack).toBe(2);
    s.attack = {
      attacker: juggernaut.id,
      base: 4,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: false,
    };
    run(colossus.colossusEnemyAttackStarted(s, juggernaut.id, ports)[0]);
    expect(s.attack).toMatchObject({ piercing: true, overkill: true });
    run(colossus.colossusEnemyAttackEnded(s)[0]);
    expect(s.attachments).toEqual([]);
  });
  it("Slammed reveals its actual boost instance and already stunned damage can consume Tough", () => {
    const { s, run, native } = fixture();
    const slammed = piece("32029");
    run(colossus.colossusBoost(s, slammed)![0]);
    expect(native[0].piece).toBe(slammed);
    s.player.stunned = true;
    run(colossus.colossusEncounterReveal(s, slammed)![0]);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 2,
      target: "hero",
    });
  });
  it("Unstoppable's retained cleanup belongs only to its own attack through nested attacks", () => {
    const { s, ports, run } = fixture();
    const attachment = piece("32028", { attachedTo: s.villain.id });
    s.attachments.push(attachment);
    const outer: NonNullable<GameState["attack"]> = {
      attacker: s.villain.id,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    s.attack = outer;
    run(colossus.colossusEnemyAttackStarted(s, s.villain.id, ports)[0]);
    s.attack = { ...outer, attacker: "nested-enemy", afterActivation: [] };
    expect(colossus.colossusEnemyAttackEnded(s)).toEqual([]);
    s.attack = outer;
    expect(colossus.colossusEnemyAttackEnded(s)).toEqual([
      C("unstoppable-discard", { id: attachment.id, actorId: "p1" }),
    ]);
  });
  it("Homesick uses actual player seat and Surge only when no Tough is discarded this way", () => {
    const { s, run, tick, pick } = fixture();
    const obligation = piece("32025");
    tough(s, 2);
    run(colossus.colossusEncounterReveal(s, obligation)![0]);
    pick("stay");
    pick("discard");
    expect(s.queue[0]).toMatchObject({
      type: "discardEncounter",
      piece: obligation,
    });
    tick();
    tick();
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.queue.some((e) => e.type === "surge")).toBe(false);
    run(C("obligation-discard", { piece: obligation }));
    tick();
    tick();
    expect(s.queue[0]).toMatchObject({ type: "surge", sourceCode: "32025" });
  });
  it("Shadowcat ally's ignore permissions and static bonuses respect physical text blanking", () => {
    const { s, ports } = fixture();
    const shadowcat = piece("32002"),
      iron = piece("32004"),
      muscles = piece("32005");
    s.player.inPlay.push(shadowcat, iron, muscles);
    expect(colossus.colossusAllyModifiers(s, shadowcat, ports)).toEqual({
      ignoreGuard: true,
      ignorePatrol: true,
      ignoreCrisis: true,
    });
    expect(colossus.colossusStats(s, ports)).toEqual({ attack: 1, thwart: 1 });
    s.flags[`blank:${shadowcat.id}`] = true;
    s.flags[`blank:${iron.id}`] = true;
    expect(
      colossus.colossusAllyModifiers(s, shadowcat, ports).ignoreGuard,
    ).toBe(false);
    expect(colossus.colossusStats(s, ports)).toEqual({ attack: 1, thwart: 0 });
  });
});
