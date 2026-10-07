import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, controller, seatView } from "../src/game/team";
import {
  ANT_MAN_PACK_CORE_ALIASES,
  ANT_MAN_PACK_SCRIPT_CODES,
  antManPackAllyPlayed,
  antManPackAllyHP,
  antManPackModifiers,
  antManPackAllyExcluded,
  antManPackStats,
  antManPackHandSize,
  antManPackPhaseEnded,
  antManPackRoundEnded,
  antManPackPlayRestriction,
  antManPackAllyEnter,
  antManPackCardEntered,
  antManPackEvent,
  antManPackAbilityOptions,
  antManPackAbility,
  antManPackAfterAllyBasic,
  antManPackFormChanged,
  antManPackFormResponseOptions,
  antManPackAfterAttackDefeat,
  resolveAntManPackEffect,
  type AntManPackPorts,
} from "../src/game/ant-man-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "leadership",
    seed: 127,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "leadership" as const },
            { heroId: "captain_marvel", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.queue = [];
  s.prompt = null;
  s.sideSchemes = [];
  s.minions = [];
  s.scheme.threat = 3;
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.discard = [];
    view.player.deck = [];
  }
  const ports: AntManPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    attach: vi.fn((state: GameState, id: string, target: string) => {
      allInPlay(state).find((p) => p.id === id)!.attachedTo = target;
    }),
    mill: vi.fn((state: GameState, n: number) => {
      const discarded = state.player.deck.splice(0, n);
      state.player.discard.push(...discarded);
      return discarded;
    }),
    maxAllyHP: (state, p) => (card(p).health || 0) + antManPackAllyHP(state, p),
    maxHeroHP: () => 10,
    hasTrait: vi.fn((state: GameState, target: string, trait: string) =>
      target === "hero"
        ? state.player.form === "hero" && ["Avenger", "Tiny"].includes(trait)
        : !!allInPlay(state).find(
            (p) =>
              p.id === target &&
              (card(p).traits || "").split(/\.\s*/).includes(trait),
          ),
    ),
    friendlyTargets: (state) => [
      ...state.players
        .filter((seat) => !seat.eliminated)
        .map((seat) => ({ id: "hero:" + seat.id, label: "Hero " + seat.id })),
      ...allInPlay(state)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    schemeTargets: vi.fn((state: GameState) =>
      state.scheme.threat > 0 ? [{ id: "main", label: "Main scheme" }] : [],
    ),
    canGiveStatus: (state, target) =>
      target.startsWith("hero:")
        ? !seatView(state, target.slice(5)).player.tough
        : !allInPlay(state).find((p) => p.id === target)!.tough,
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    playableWithDiscount: vi.fn(() => true),
    playFromHand: vi.fn(),
  };
  const run = (effect: Effect) => resolveAntManPackEffect(s, effect, ports);
  const choose = (id: string) => {
    const selected = s.prompt!.options.find((o) => o.id === id);
    if (!selected) throw Error("Invalid fixture choice: " + id);
    s.prompt = null;
    for (const effect of selected.effects) {
      if (effect.type.startsWith("ant-pack:")) run(effect);
      else s.queue.push(effect);
    }
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = s.activePlayerId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  return { s, ports, run, choose, play, hand };
}

describe("Ant-Man Hero Pack supplementary cards", () => {
  it("assigns all thirteen non-Core supplementary cards and the four exact Core aliases", () => {
    expect(ANT_MAN_PACK_SCRIPT_CODES).toHaveLength(13);
    expect(ANT_MAN_PACK_CORE_ALIASES).toEqual([
      "12019",
      "12021",
      "12022",
      "12023",
    ]);
    expect(
      new Set([...ANT_MAN_PACK_SCRIPT_CODES, ...ANT_MAN_PACK_CORE_ALIASES])
        .size,
    ).toBe(17);
    for (const code of ["12011", "12012", "12013", "12014"]) {
      const { s } = fixture();
      expect(antManPackAllyEnter(s, makePiece(s, code))).toEqual([]);
    }
  });

  it("sets Hank Pym's entry interrupt before zero-HP defeat, caps overpayment at four, and gives no counters for put-into-play", () => {
    const { s, play } = fixture();
    const hank = play("12011");
    for (const [paid, expected] of [
      [0, 0],
      [1, 1],
      [4, 4],
      [7, 4],
      [-2, 0],
    ]) {
      antManPackAllyPlayed(s, hank, paid);
      expect(antManPackAllyHP(s, hank)).toBe(expected);
    }
    antManPackAllyPlayed(s, hank);
    expect(hank.counters).toBe(0);
  });

  it("Giant-Man changes ATK at three remaining HP, including an attached Reinforced Suit", () => {
    const { s, play, ports } = fixture();
    const giant = play("12012");
    expect(antManPackModifiers(s, giant.id, ports).attack).toBe(2);
    giant.damage = 2;
    expect(antManPackModifiers(s, giant.id, ports).attack).toBe(0);
    const suit = play("12018");
    suit.attachedTo = giant.id;
    expect(antManPackModifiers(s, giant.id, ports).attack).toBe(2);
    giant.damage = 4;
    expect(antManPackModifiers(s, giant.id, ports).attack).toBe(0);
  });

  it("Ronin gains one stat bonus for any number of attached upgrades, including a blank Tech upgrade", () => {
    const { s, play } = fixture(true);
    const ronin = play("12013", "p2");
    expect(antManPackModifiers(s, ronin.id)).toEqual({ attack: 0, thwart: 0 });
    const suit = play("12018", "p2");
    suit.attachedTo = ronin.id;
    const gloves = play("12017", "p2");
    gloves.attachedTo = ronin.id;
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(antManPackModifiers(s, ronin.id)).toEqual({ attack: 1, thwart: 1 });
    expect(antManPackAllyHP(s, ronin)).toBe(0);
  });

  it("Stinger requires the current identity to be an Avenger and remains excluded from the ally limit", () => {
    const { s, play, ports } = fixture();
    const stinger = play("12014");
    expect(antManPackPlayRestriction(s, stinger, ports)).toBeNull();
    expect(antManPackAllyExcluded(s, stinger)).toBe(true);
    s.player.form = "alter";
    expect(antManPackPlayRestriction(s, stinger, ports)).toContain("Avenger");
    expect(antManPackAllyExcluded(s, stinger)).toBe(true);
    expect(antManPackAllyExcluded(s, play("12013"))).toBe(false);
  });

  it("Call for Aid discards through the first printed Avenger ally and puts only that physical ally in hand", () => {
    const { s, run, ports } = fixture();
    const deck = ["12033", "01084", "12013", "12012"].map((code) =>
      makePiece(s, code),
    );
    s.player.deck = deck.slice();
    run(antManPackEvent(s, makePiece(s, "12015"))![0]);
    expect(ports.mill).toHaveBeenCalledWith(s, 3);
    expect(s.player.hand).toEqual([deck[2]]);
    expect(s.player.discard).toEqual(deck.slice(0, 2));
    expect(s.player.deck).toEqual([deck[3]]);
  });

  it("Call for Aid stops at one deck exhaustion when no Avenger is found, and retrieves a last-card ally across the native immediate reshuffle", () => {
    const { s, run, ports } = fixture();
    const original = [makePiece(s, "12033"), makePiece(s, "12015")];
    s.player.deck = original.slice();
    vi.mocked(ports.mill).mockImplementation((state, n) => {
      const discarded = state.player.deck.splice(0, n);
      state.player.discard.push(...discarded);
      if (!state.player.deck.length)
        state.player.deck = state.player.discard.splice(0).reverse();
      return discarded;
    });
    run({ type: "ant-pack:aid" });
    expect(s.player.hand).toEqual([]);
    expect(s.player.deck).toHaveLength(2);
    const lastAlly = makePiece(s, "12011");
    s.player.deck = [lastAlly];
    run({ type: "ant-pack:aid" });
    expect(s.player.hand).toEqual([lastAlly]);
    expect(s.player.deck).toHaveLength(0);
  });

  it("Reinforced Suit can attach across controllers, applies +2 HP dynamically, and allows only one suit per ally", () => {
    const { s, play, run, choose, ports } = fixture(true);
    const ronin = play("12013", "p2");
    const suit = play("12018");
    run(antManPackCardEntered(s, suit)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([ronin.id]);
    choose(ronin.id);
    expect(ports.attach).toHaveBeenCalledWith(s, suit.id, ronin.id);
    expect(antManPackAllyHP(s, ronin)).toBe(2);
    expect(
      antManPackPlayRestriction(s, makePiece(s, "12018"), ports),
    ).toContain("eligible");
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(antManPackAllyHP(s, ronin)).toBe(0);
  });

  it("Power Gloves attach only to an Avenger and respond to either basic power before consequential damage", () => {
    const { s, play, run, choose } = fixture(true);
    play("01084");
    const ronin = play("12013", "p2");
    const gloves = play("12017", "p2");
    run(antManPackCardEntered(s, gloves)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([ronin.id]);
    choose(ronin.id);
    const response = antManPackAfterAllyBasic(s, ronin)[0];
    expect(response).toMatchObject({
      type: "optional",
      actorId: "p2",
      effects: [
        {
          type: "target",
          action: { type: "damage", amount: 1, source: gloves.id },
        },
      ],
    });
    expect(response.effects[0].action.attack).toBeUndefined();
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(antManPackAfterAllyBasic(s, ronin)).toEqual([]);
  });

  it("Team-Building Exercise binds one immediate discount to the selected matching-trait card after paying exhaust", () => {
    const { s, play, hand, run, choose, ports } = fixture();
    const support = play("12024");
    const [giant, ronin] = hand("12012", "12013", "12033");
    const options = antManPackAbilityOptions(s, support.id, ports);
    expect(options.map((o) => o.id)).toEqual(["team-building"]);
    run(options[0].effects[0]);
    expect(support.exhausted).toBe(false);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([giant.id, ronin.id]);
    choose(ronin.id);
    expect(support.exhausted).toBe(true);
    expect(ports.playFromHand).toHaveBeenCalledExactlyOnceWith(s, ronin.id, 1);
    expect(s.flags.discount).toBeFalsy();
    expect(antManPackAbility(s, support.id, undefined, ports)).toBeNull();
  });

  it("Team-Building Exercise is a Hero Action and filters unaffordable native plays before exhausting", () => {
    const { s, play, hand, ports } = fixture();
    const support = play("12024");
    hand("12012");
    vi.mocked(ports.playableWithDiscount).mockReturnValue(false);
    expect(antManPackAbilityOptions(s, support.id, ports)).toEqual([]);
    expect(support.exhausted).toBe(false);
    vi.mocked(ports.playableWithDiscount).mockReturnValue(true);
    s.player.form = "alter";
    expect(antManPackAbilityOptions(s, support.id, ports)).toEqual([]);
  });

  it("Moxie responses work on every hero-form change, stack, and expire at the round boundary", () => {
    const { s, hand, run, choose } = fixture();
    const [moxie] = hand("12016");
    run(antManPackFormChanged(s)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([moxie.id, "pass"]);
    choose(moxie.id);
    const payment = s.queue.shift()!;
    expect(payment).toMatchObject({
      type: "payRequest",
      cost: 0,
      cancelable: false,
    });
    run(payment.after[0]);
    const resolve = s.queue.shift()!;
    expect(resolve.type).toBe("resolveHandEvent");
    run(resolve.after[0]);
    run({ type: "ant-pack:moxie" });
    expect(antManPackStats(s)).toEqual({ attack: 2, thwart: 2, defense: 2 });
    antManPackPhaseEnded(s);
    expect(antManPackStats(s).attack).toBe(2);
    antManPackRoundEnded(s);
    expect(antManPackStats(s).attack).toBe(0);
    s.player.form = "alter";
    expect(antManPackFormChanged(s)).toEqual([]);
  });

  it("Lay Down the Law uses the paid mental resource from the response's complete native payment", () => {
    const { s, hand, run, choose } = fixture();
    const [law] = hand("12031");
    run(antManPackFormChanged(s)[0]);
    choose(law.id);
    const payment = s.queue.shift()!;
    expect(payment).toMatchObject({ cost: 1, piece: law });
    run({ ...payment.after[0], paid: ["mental"] });
    expect(s.queue[0].after[0]).toMatchObject({
      type: "target",
      group: "scheme",
      action: { type: "thwart", amount: 4, action: true, source: "hero" },
    });
    expect(antManPackEvent(s, law, ["energy"])![0].action.amount).toBe(3);
  });

  it("form responses honor affordability, do not enable ordinary event play, and keep the response window after event resolution", () => {
    const { s, ports, hand, run, choose } = fixture();
    const [moxie, law] = hand("12016", "12031");
    vi.mocked(ports.canPay).mockImplementation(
      (_s, _cost, id) => id === moxie.id,
    );
    run(antManPackFormChanged(s)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([moxie.id, "pass"]);
    expect(antManPackPlayRestriction(s, law, ports)).toContain("after");
    choose(moxie.id);
    run(s.queue.shift()!.after[0]);
    expect(s.queue[0].continuation[0]).toMatchObject({
      type: "ant-pack:form-responses",
      used: [moxie.id],
    });
  });

  it("Lay Down the Law needs a valid thwart target unless Confused replaces the thwart", () => {
    const { s, hand, ports } = fixture();
    const [law, moxie] = hand("12031", "12016");
    vi.mocked(ports.schemeTargets).mockReturnValue([]);
    expect(antManPackFormResponseOptions(s, ports).map((o) => o.id)).toEqual([
      moxie.id,
    ]);
    s.player.confused = true;
    expect(antManPackFormResponseOptions(s, ports).map((o) => o.id)).toEqual([
      law.id,
      moxie.id,
    ]);
  });

  it("one form-change event resumes a host shared response window after payment and complete event resolution", () => {
    const { s, hand, ports, run } = fixture();
    hand("12031");
    const continuation = [
      {
        type: "host:form-responses",
        responses: [{ type: "optional", title: "Ant-Man's Helmet" }],
      },
    ];
    run({
      ...antManPackFormResponseOptions(s, ports)[0].effects[0],
      continuation,
    });
    const payment = s.queue.shift()!;
    run({ ...payment.after[0], paid: ["mental"] });
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      continuation,
      after: [{ action: { amount: 4 } }],
    });
  });

  it("Tech Theft suppresses an attached suit's bonus without stopping its as-enters attachment instruction", () => {
    const { s, play, run, choose } = fixture();
    const ally = play("12013");
    s.sideSchemes.push(makePiece(s, "12026"));
    const suit = play("12018");
    run(antManPackCardEntered(s, suit)[0]);
    choose(ally.id);
    expect(suit.attachedTo).toBe(ally.id);
    expect(antManPackAllyHP(s, ally)).toBe(0);
    s.sideSchemes = [];
    expect(antManPackAllyHP(s, ally)).toBe(2);
  });

  it("Moment of Triumph uses attack excess damage, only offers useful healing, and resolves through native event payment", () => {
    const { s, hand, run, choose, ports } = fixture();
    const [triumph] = hand("12030");
    s.player.hp = 6;
    expect(antManPackAfterAttackDefeat(s, 0)).toEqual([]);
    run(antManPackAfterAttackDefeat(s, 5)[0]);
    choose(triumph.id);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 0,
      piece: triumph,
      after: [
        {
          type: "resolveHandEvent",
          after: [{ type: "heal", target: "hero", amount: 5 }],
        },
      ],
    });
    s.queue = [];
    s.player.hp = ports.maxHeroHP(s);
    run(antManPackAfterAttackDefeat(s, 2)[0]);
    expect(s.prompt).toBeNull();
    s.player.form = "alter";
    expect(antManPackAfterAttackDefeat(s, 5)).toEqual([]);
  });

  it("Muster Courage chooses distinct eligible friendly characters across players, caps at three, and permits stopping early", () => {
    const { s, play, run, choose, ports } = fixture(true);
    const ally = play("12013", "p2");
    s.villain.stage = 3;
    s.player.tough = true;
    run(antManPackEvent(s, makePiece(s, "12032"))![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "hero:p2",
      ally.id,
      "finish",
    ]);
    choose("hero:p2");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([ally.id, "finish"]);
    choose("finish");
    expect(s.queue).toEqual([
      { type: "status", target: "hero:p2", status: "tough" },
    ]);
    s.queue = [];
    s.player.tough = false;
    s.villain.stage = 4;
    run({ type: "ant-pack:muster", selected: [] });
    choose("hero:p1");
    choose("hero:p2");
    choose(ally.id);
    expect(s.queue).toHaveLength(3);
    expect(s.prompt).toBeNull();
    expect(
      antManPackPlayRestriction(s, makePiece(s, "12032"), ports),
    ).toBeNull();
  });

  it("Assess the Situation stacks through the end-of-player-phase refill, then expires independently of Moxie", () => {
    const { s, run } = fixture();
    s.player.form = "alter";
    run(antManPackEvent(s, makePiece(s, "12033"))![0]);
    run({ type: "ant-pack:assess" });
    expect(antManPackHandSize(s)).toBe(2);
    antManPackRoundEnded(s);
    expect(antManPackHandSize(s)).toBe(2);
    antManPackPhaseEnded(s);
    expect(antManPackHandSize(s)).toBe(0);
  });

  it("unrelated effects fall through and unimplemented claimed effects fail closed", () => {
    const { run } = fixture();
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run({ type: "ant-pack:invented" })).toThrow(
      /Unknown Ant-Man pack effect/,
    );
  });
});
