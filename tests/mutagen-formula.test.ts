import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { activateSeat } from "../src/game/team";
import { giveStatus } from "../src/game/keywords";
import type { Effect, GameState, Piece } from "../src/game/types";
import catalogCards from "../src/data/catalog-cards.json";
import {
  MUTAGEN_FORMULA_CONFIG,
  MUTAGEN_FORMULA_SCRIPT_CODES,
  mutagenSetup,
  mutagenVillainRevealed,
  mutagenSchemeValues,
  mutagenMainCompleted,
  mutagenAttackModifiers,
  mutagenAdditionalBoosts,
  mutagenAttackResponses,
  mutagenDefeated,
  mutagenAttachmentActions,
  mutagenEncounterReveal,
  mutagenBoost,
  resolveMutagenEffect,
  type MutagenEnginePorts,
} from "../src/game/mutagen-formula";

function fixture(playerCount = 1, stage = 1) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 51,
    guided: false,
  });
  s.playerCount = playerCount;
  s.phase = "player";
  s.player.form = "hero";
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.players[0].player = s.player;
  for (let index = 1; index < playerCount; index++)
    s.players.push({
      ...s.players[0],
      id: `p${index + 1}`,
      player: structuredClone(s.player),
      flags: {},
      eliminated: false,
    });
  s.villainId = "mutagen_formula";
  const villain = makePiece(s, `020${13 + stage}`);
  s.villain = {
    ...villain,
    hp: card(villain).health! * playerCount,
    maxHp: card(villain).health! * playerCount,
    stage,
  };
  s.scheme = { code: "02017b", index: 0, threat: 2 * playerCount };
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  s.queue = [];
  s.prompt = null;
  const remove = (piece: Piece) => {
    let found: Piece | undefined;
    for (const zone of [
      s.encounter.deck,
      s.encounter.discard,
      s.encounter.dealt,
      s.resolving,
    ]) {
      const index = zone.findIndex((p) => p.id === piece.id);
      if (index >= 0) found = zone.splice(index, 1)[0];
    }
    return found || piece;
  };
  const ports: MutagenEnginePorts = {
    queue: (s, ...effects) => {
      s.queue.unshift(...effects);
    },
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    canPay: vi.fn(() => true),
    pay: vi.fn((s, cost, requirements, after, title, cancelable) => {
      s.prompt = {
        kind: "payment",
        title,
        text: "",
        cost,
        requirements,
        after,
        cancelable,
        options: [],
      };
    }),
    discardTop: vi.fn((s) => {
      const piece = s.encounter.deck.shift();
      if (piece) {
        s.hiddenInfo = (s.hiddenInfo || 0) + 1;
        s.encounter.discard.push(piece);
      }
      const emptied = s.encounter.deck.length === 0;
      if (emptied && s.encounter.discard.length) {
        s.encounter.deck = s.encounter.discard.splice(0);
        s.encounter.acceleration++;
      }
      return { piece, emptied };
    }),
    putMinion: vi.fn((s, piece, playerId) => {
      const actual = remove(piece);
      actual.engagedWith = playerId;
      s.minions.push(actual);
    }),
    putSideScheme: vi.fn((s, piece) => {
      const actual = remove(piece);
      actual.counters =
        (card(actual).base_threat || 0) *
        (card(actual).base_threat_fixed ? 1 : s.playerCount);
      s.sideSchemes.push(actual);
    }),
    attach: vi.fn((s, piece, enemyId) => {
      const actual = remove(piece);
      actual.attachedTo = enemyId;
      s.attachments.push(actual);
    }),
    discardPiece: vi.fn((s, id) => {
      for (const zone of [s.attachments, s.minions, s.sideSchemes]) {
        const index = zone.findIndex((p: Piece) => p.id === id);
        if (index >= 0) {
          s.encounter.discard.push(zone.splice(index, 1)[0]);
          return;
        }
      }
    }),
    shuffleIntoEncounter: vi.fn((s, piece) => {
      s.encounter.deck.push(remove(piece));
    }),
    shuffleEncounter: vi.fn(),
    dealEncounter: vi.fn((s, playerId) => {
      const piece = s.encounter.deck.shift();
      if (piece) {
        piece.dealtTo = playerId;
        s.encounter.dealt.push(piece);
      }
    }),
    giveBoost: vi.fn(),
    activate: vi.fn(),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveMutagenEffect(s, e, ports)) return;
    if (e.type === "threat") {
      if (e.target === "main") s.scheme.threat += e.amount;
      else s.sideSchemes.find((p) => p.id === e.target)!.counters += e.amount;
    }
    if (e.type === "damage") s.player.hp -= e.amount;
    if (e.type === "status") giveStatus(s.player, card("01001a"), e.status);
  };
  const drain = () => {
    for (let count = 0; !s.prompt && s.queue.length && count < 100; count++)
      run(s.queue.shift()!);
  };
  const effects = (list: Effect[] | null) => {
    expect(list).not.toBeNull();
    ports.queue(s, ...list!);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    expect(option).toBeDefined();
    s.prompt = null;
    ports.queue(s, ...option.effects);
    drain();
  };
  const completePayment = () => {
    const after = s.prompt!.after || [];
    s.prompt = null;
    ports.queue(s, ...after);
    drain();
  };
  const piece = (code: string) => makePiece(s, code);
  const deck = (...codes: string[]) => {
    s.encounter.deck = codes.map(piece);
    return [...s.encounter.deck];
  };
  const minion = (code: string, playerId = s.activePlayerId) => {
    const p = piece(code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const attachment = (code: string, enemyId = s.villain.id) => {
    const p = piece(code);
    p.attachedTo = enemyId;
    s.attachments.push(p);
    return p;
  };
  return {
    s,
    ports,
    run,
    drain,
    effects,
    choose,
    completePayment,
    piece,
    deck,
    minion,
    attachment,
  };
}

describe("Mutagen Formula authored card and scenario hooks", () => {
  it("covers every scenario/modular face and every actual boost star, without certifying host integration", () => {
    const expected = catalogCards
      .filter((c) =>
        ["mutagen_formula", "goblin_gimmicks"].includes(c.set_code),
      )
      .map((c) => c.code);
    expect([...MUTAGEN_FORMULA_SCRIPT_CODES].sort()).toEqual(expected.sort());
    expect(MUTAGEN_FORMULA_CONFIG.standardVillains).toEqual(["02014", "02015"]);
    expect(MUTAGEN_FORMULA_CONFIG.expertVillains).toEqual(["02015", "02016"]);
    expect(MUTAGEN_FORMULA_CONFIG.requiredSets).toEqual(["standard"]);
    expect(MUTAGEN_FORMULA_CONFIG.expertSets).toEqual(["expert"]);
    const f = fixture();
    const stars = expected.filter((code) => card(code).boost_star);
    expect(stars).toHaveLength(8);
    for (const code of stars)
      expect(
        mutagenBoost(f.s, f.piece(code), {
          attackerId: f.s.villain.id,
          playerId: "p1",
        }),
      ).not.toBeNull();
    expect(
      mutagenBoost(f.s, f.piece("02019"), {
        attackerId: f.s.villain.id,
        playerId: "p1",
      }),
    ).toBeNull();
  });

  it("puts one actual Thrall per player, shuffles, starts at 2 threat per starting player", () => {
    const f = fixture(3);
    const thralls = f.deck("02024", "02024", "02024", "02024", "02019");
    f.effects(mutagenSetup());
    expect(f.s.minions).toEqual(thralls.slice(0, 3));
    expect(f.s.minions.map((p) => p.engagedWith)).toEqual(["p1", "p2", "p3"]);
    expect(f.s.encounter.deck).toEqual(thralls.slice(3));
    expect(f.s.scheme).toEqual({ code: "02017b", index: 0, threat: 6 });
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
    expect(f.ports.dealEncounter).not.toHaveBeenCalled();
  });

  it("rejects an incomplete setup atomically", () => {
    const f = fixture(3);
    f.deck("02024", "02024");
    expect(() => f.effects(mutagenSetup())).toThrow(
      "one Goblin Thrall per player",
    );
    expect(f.s.minions).toEqual([]);
    expect(f.s.encounter.deck).toHaveLength(2);
  });

  it("expert setup resolves II after Thralls and lets first player choose each-player encounter order", () => {
    const f = fixture(2, 2);
    f.deck("02024", "02024", "02019", "02020", "02021", "02022");
    f.effects(mutagenSetup());
    expect(f.s.minions).toHaveLength(2);
    expect(f.s.prompt?.title).toContain("encounter order");
    expect(f.ports.dealEncounter).not.toHaveBeenCalled();
    f.choose("p2");
    expect(f.s.encounter.dealt.map((p) => [p.code, p.dealtTo])).toEqual([
      ["02019", "p2"],
      ["02020", "p2"],
      ["02021", "p1"],
      ["02022", "p1"],
    ]);
  });

  it("stage III deals three encounters per surviving player, and I deals none", () => {
    const f = fixture(2, 3);
    f.s.players[1].eliminated = true;
    f.deck("02019", "02020", "02021", "02022");
    f.effects(mutagenVillainRevealed(f.s));
    expect(f.s.encounter.dealt.map((p) => p.dealtTo)).toEqual([
      "p1",
      "p1",
      "p1",
    ]);
    f.s.villain.code = "02014";
    expect(mutagenVillainRevealed(f.s)).toEqual([]);
  });

  it("stage 1 completion discards exactly three for each eligible player and puts only the first Goblin", () => {
    const f = fixture(3);
    f.minion("02024", "p2");
    f.minion("01102", "p1");
    f.deck("02019", "02025", "02023", "02023", "02024", "02019", "02020");
    f.effects(mutagenMainCompleted(f.s));
    expect(
      f.s.minions.filter((p) => p.engagedWith === "p1").map((p) => p.code),
    ).toEqual(["01102", "02025"]);
    expect(
      f.s.minions.filter((p) => p.engagedWith === "p2").map((p) => p.code),
    ).toEqual(["02024"]);
    expect(
      f.s.minions.filter((p) => p.engagedWith === "p3").map((p) => p.code),
    ).toEqual(["02023"]);
    expect(f.s.player.stunned).toBe(false); // Monster was put, not revealed.
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual(["02020"]);
    expect(f.s.scheme).toEqual({ code: "02018b", index: 1, threat: 12 });
  });

  it("stage 2 uses the Goblin count without extra player scaling and loses on completion", () => {
    const f = fixture(3);
    expect(mutagenSchemeValues(f.s)).toEqual({
      baseThreat: 6,
      threshold: 21,
      escalation: 3,
    });
    f.s.scheme = { code: "02018b", index: 1, threat: 12 };
    f.minion("02024", "p1");
    f.minion("02023", "p2");
    f.minion("01102", "p3");
    f.s.players[2].eliminated = true;
    expect(mutagenSchemeValues(f.s)).toEqual({
      baseThreat: 12,
      threshold: 33,
      escalation: 3,
    });
    f.effects(mutagenMainCompleted(f.s));
    expect(f.s.phase).toBe("lost");
  });

  it("Goblin Nation and Glider bonuses are dynamic for villain and minions", () => {
    const f = fixture();
    const soldier = f.minion("02023");
    const nonGoblin = f.minion("01102");
    f.s.sideSchemes.push(f.piece("02027"), f.piece("02027"));
    f.attachment("02019", soldier.id);
    f.attachment("02033", f.s.villain.id);
    expect(mutagenAttackModifiers(f.s, soldier)).toEqual({
      attachment: 1,
      goblinNation: 2,
    });
    expect(mutagenAttackModifiers(f.s, f.s.villain)).toEqual({
      attachment: 1,
      goblinNation: 2,
    });
    expect(mutagenAttackModifiers(f.s, nonGoblin)).toEqual({
      attachment: 0,
      goblinNation: 0,
    });
    f.s.sideSchemes.pop();
    expect(mutagenAttackModifiers(f.s, soldier).goblinNation).toBe(1);
  });

  it("Glider attaches to highest printed hit points, excluding all existing Glider printings", () => {
    const f = fixture(2);
    f.minion("02022");
    const p = f.piece("02019");
    f.s.resolving.push(p);
    f.effects(mutagenEncounterReveal(f.s, p));
    expect(p.attachedTo).toBe(f.s.villain.id);
    const next = f.piece("02033");
    f.s.resolving.push(next);
    f.effects(mutagenEncounterReveal(f.s, next));
    expect(next.attachedTo).toBe(f.s.minions[0].id);
    expect(f.s.attachments).toHaveLength(2);
  });

  it("Glider leaves equal-highest choice explicit and surges when no enemy is eligible", () => {
    const f = fixture();
    f.attachment("02033");
    const a = f.minion("02023");
    const b = f.minion("02023");
    const p = f.piece("02019");
    f.effects(mutagenEncounterReveal(f.s, p));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(() =>
      f.run({
        type: "mutagen:attach-glider",
        piece: p,
        id: f.s.villain.id,
        eligible: [a.id, b.id],
      }),
    ).toThrow();
    f.choose(b.id);
    expect(p.attachedTo).toBe(b.id);
    f.attachment("02019", a.id);
    f.run({ type: "mutagen:glider", piece: f.piece("02033") });
    expect(f.s.queue).toContainEqual({ type: "surge", sourceCode: "02033" });
  });

  it("Hysteria adds a boost per copy only for Green Goblin actual activations", () => {
    const f = fixture();
    f.attachment("02020");
    f.attachment("02020");
    expect(mutagenAdditionalBoosts(f.s, f.s.villain.id)).toBe(2);
    expect(mutagenAdditionalBoosts(f.s, f.minion("02022").id)).toBe(0);
    f.s.villain.code = "01094";
    expect(mutagenAdditionalBoosts(f.s, f.s.villain.id)).toBe(0);
  });

  it("Goblin threat requires actual identity damage; Pumpkin triggers even for zero damage and ally defense", () => {
    const f = fixture(2, 3);
    const pumpkin = f.attachment("02034");
    const result = {
      attacker: { ...f.s.villain },
      playerId: "p2",
      performed: true,
      identityDamage: 0,
    };
    expect(mutagenAttackResponses(f.s, result).map((r) => r.title)).toEqual([
      "Pumpkin Bombs",
    ]);
    const responses = mutagenAttackResponses(f.s, {
      ...result,
      identityDamage: 1,
    });
    expect(responses.map((r) => r.title)).toEqual([
      "Green Goblin",
      "Pumpkin Bombs",
    ]);
    expect(responses[0].effects).toEqual([
      { type: "threat", target: "main", amount: 2 },
    ]);
    f.run(responses[1].effects[0]);
    expect(f.s.attachments).not.toContain(pumpkin);
    expect(f.s.queue).toContainEqual({
      type: "indirect",
      amount: 2,
      actorId: "p2",
      source: "Pumpkin Bombs",
    });
    expect(
      mutagenAttackResponses(f.s, { ...result, performed: false }),
    ).toEqual([]);
    f.s.villain.code = "02015";
    expect(
      mutagenAttackResponses(f.s, { ...result, identityDamage: 3 })[0].effects,
    ).toEqual([{ type: "threat", target: "main", amount: 1 }]); // Same-title stage is the same character (RRG1.8 p47).
    f.s.villain.code = "01094";
    expect(
      mutagenAttackResponses(f.s, { ...result, identityDamage: 3 }),
    ).toEqual([]);
  });

  it.each([1, 2])(
    "Goblin stage %i places one threat, regardless of amount of damage",
    (stage) => {
      const f = fixture(1, stage);
      expect(
        mutagenAttackResponses(f.s, {
          attacker: f.s.villain,
          playerId: "p1",
          performed: true,
          identityDamage: 7,
        })[0].effects,
      ).toEqual([{ type: "threat", target: "main", amount: 1 }]);
    },
  );

  it("Knight discards one after attacking, and puts a Goblin without revealing it", () => {
    const f = fixture(2);
    const knight = f.minion("02022", "p1");
    f.deck("02025", "02019");
    f.effects(
      mutagenAttackResponses(f.s, {
        attacker: knight,
        playerId: "p2",
        performed: true,
        identityDamage: 0,
      })[0].effects,
    );
    expect(f.s.minions.find((p) => p.code === "02025")?.engagedWith).toBe("p2");
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual(["02019"]);
  });

  it("Soldier defeat damages the engaged player's identity; other Goblins invent no defeat effect", () => {
    const f = fixture(2);
    const soldier = f.minion("02023", "p2");
    const before = f.s.players[1].player.hp;
    f.effects(mutagenDefeated(f.s, soldier));
    expect(f.s.players[1].player.hp).toBe(before - 1);
    expect(mutagenDefeated(f.s, f.piece("02024"))).toEqual([]);
    expect(mutagenDefeated(f.s, f.piece("01102"))).toBeNull();
  });

  it("Overrun processes players in first-player order and stops an individual's discard at deck reset", () => {
    const f = fixture(2);
    f.s.firstPlayerId = "p2";
    f.deck("02025");
    f.s.encounter.discard.push(
      f.piece("02023"),
      f.piece("02019"),
      f.piece("02020"),
    );
    f.effects(mutagenDefeated(f.s, f.piece("02028")));
    expect(f.s.minions.map((p) => [p.code, p.engagedWith])).toEqual([
      ["02025", "p2"],
      ["02023", "p1"],
    ]);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual(["02020"]);
    expect(
      f.s.minions.every((p) => !f.s.encounter.deck.some((c) => c.id === p.id)),
    ).toBe(true);
  });

  it("Monster's already-stunned replacement is checked before giving status", () => {
    const f = fixture();
    const p = f.minion("02025");
    expect(mutagenEncounterReveal(f.s, p)).toEqual([
      { type: "status", target: "hero", status: "stunned" },
    ]);
    f.s.player.stunCards = 1;
    f.s.player.stunned = false;
    expect(mutagenEncounterReveal(f.s, p)?.[0].type).toBe("status");
    f.s.player.stunned = true;
    expect(mutagenEncounterReveal(f.s, p)).toEqual([
      { type: "damage", target: "hero", amount: 2, source: "Monster" },
    ]);
  });

  it("Reinforcements adds one per Goblin minion in play to its fixed two base threat", () => {
    const f = fixture(3);
    const p = f.piece("02026");
    p.counters = 2;
    f.s.sideSchemes.push(p);
    f.minion("02024", "p1");
    f.minion("02025", "p2");
    f.minion("01102", "p3");
    f.effects(mutagenEncounterReveal(f.s, p));
    expect(p.counters).toBe(4);
    expect(card(p).scheme_hazard).toBe(1);
  });

  it.each(["hero", "alter"] as const)(
    "Death from Above gives stage-number modifier to its %s activation",
    (form) => {
      const f = fixture(1, 3);
      f.s.player.form = form;
      f.effects(mutagenEncounterReveal(f.s, f.piece("02029")));
      expect(f.ports.activate).toHaveBeenCalledWith(f.s, {
        enemyId: f.s.villain.id,
        playerId: "p1",
        kind: form === "hero" ? "attack" : "scheme",
        modifier: 3,
        omitNormalBoost: false,
      });
    },
  );

  it("I See You attacks alter-ego and instructs the host to suppress newly given boosts", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.attachment("02020");
    f.effects(mutagenEncounterReveal(f.s, f.piece("02030")));
    expect(f.ports.activate).toHaveBeenCalledWith(f.s, {
      enemyId: f.s.villain.id,
      playerId: "p1",
      kind: "attack",
      modifier: 0,
      omitNormalBoost: true,
    });
    expect(mutagenAdditionalBoosts(f.s, f.s.villain.id)).toBe(1);
  });

  it("Overconfidence tests native actual activation outcomes, including ally damage", () => {
    const f = fixture();
    f.effects(mutagenEncounterReveal(f.s, f.piece("02031")));
    const request = vi.mocked(f.ports.activate).mock.calls[0][1];
    expect(request.after?.type).toBe("mutagen:overconfidence-after");
    for (const args of [
      { performed: false, damagePlaced: 5 },
      { performed: true, damagePlaced: 2 },
    ]) {
      f.run({ ...request.after!, ...args });
      expect(f.s.queue).toEqual([]);
    }
    f.run({ ...request.after!, performed: true, damagePlaced: 3 });
    expect(f.s.queue).toEqual([{ type: "surge", sourceCode: "02031" }]);
    f.s.queue = [];
    f.s.player.form = "alter";
    f.effects(mutagenEncounterReveal(f.s, f.piece("02031")));
    const scheme = vi.mocked(f.ports.activate).mock.calls[1][1];
    f.run({
      ...scheme.after!,
      performed: true,
      threatPlaced: 3,
      damagePlaced: 0,
    });
    expect(f.s.queue).toEqual([{ type: "surge", sourceCode: "02031" }]);
  });

  it("Wicked Ambitions halts on each Goblin decision before discarding the next card", () => {
    const f = fixture(1, 2);
    f.deck("02023", "02019", "02025", "02020", "02021");
    f.effects(mutagenEncounterReveal(f.s, f.piece("02032")));
    expect(f.ports.discardTop).toHaveBeenCalledOnce();
    const hp = f.s.player.hp;
    f.choose("damage");
    expect(f.s.player.hp).toBe(hp - 3);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(3);
    expect(f.s.prompt?.title).toBe("Wicked Ambitions");
    f.choose("minion");
    expect(f.s.minions.map((p) => p.code)).toEqual(["02025"]);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(4);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual(["02021"]);
  });

  it("Wicked Ambitions never continues into a reset deck and moves the actual discarded instance", () => {
    const f = fixture(1, 3);
    const [p] = f.deck("02023");
    f.s.encounter.discard.push(f.piece("02019"));
    f.effects(mutagenEncounterReveal(f.s, f.piece("02032")));
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck).toContain(p);
    f.choose("minion");
    expect(f.s.minions).toEqual([p]);
    expect(f.s.encounter.deck).not.toContain(p);
    expect(f.ports.discardTop).toHaveBeenCalledOnce();
  });

  it.each([
    ["02019", "energy"],
    ["02033", "energy"],
    ["02020", "mental"],
    ["02021", "physical"],
    ["02034", "physical"],
  ] as const)(
    "%s removal uses two %s resources and waits for native payment",
    (code, resource) => {
      const f = fixture();
      const p = f.attachment(code);
      const options = mutagenAttachmentActions(f.s, p);
      f.effects(options[0].effects);
      expect(f.s.attachments).toContain(p);
      expect(f.s.prompt).toMatchObject({
        kind: "payment",
        cost: 2,
        requirements: [resource, resource],
        cancelable: true,
      });
      f.completePayment();
      expect(f.s.attachments).not.toContain(p);
    },
  );

  it("attachment actions require hero/player phase and reject resource tampering before payment", () => {
    const f = fixture();
    const p = f.attachment("02019");
    f.s.player.form = "alter";
    expect(mutagenAttachmentActions(f.s, p)).toEqual([]);
    f.s.player.form = "hero";
    f.s.phase = "villain";
    expect(mutagenAttachmentActions(f.s, p)).toEqual([]);
    f.s.phase = "player";
    expect(() =>
      f.run({ type: "mutagen:remove-cost", id: p.id, resource: "mental" }),
    ).toThrow();
    expect(f.ports.pay).not.toHaveBeenCalled();
  });

  it("Intimidation's affordable choice has generic payment; its boost persists until next activation", () => {
    const f = fixture();
    f.effects(mutagenEncounterReveal(f.s, f.piece("02035")));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["pay", "boost"]);
    f.choose("pay");
    expect(f.s.prompt).toMatchObject({
      cost: 2,
      requirements: [],
      cancelable: false,
    });
    f.completePayment();
    expect(f.ports.giveBoost).not.toHaveBeenCalled();
    vi.mocked(f.ports.canPay).mockReturnValue(false);
    f.effects(mutagenEncounterReveal(f.s, f.piece("02035")));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["boost"]);
    f.choose("boost");
    expect(f.ports.giveBoost).toHaveBeenCalledWith(f.s, f.s.villain.id, "next");
  });

  it("Regenerative Healing heals twice stage number, capped at max HP, and surges only when none healed", () => {
    const f = fixture(1, 3);
    f.s.villain.hp -= 4;
    f.effects(mutagenEncounterReveal(f.s, f.piece("02036")));
    expect(f.s.villain.hp).toBe(f.s.villain.maxHp);
    expect(f.s.queue).toEqual([]);
    f.run(mutagenEncounterReveal(f.s, f.piece("02036"))![0]);
    expect(f.s.queue).toEqual([{ type: "surge", sourceCode: "02036" }]);
    f.s.queue = [];
    f.s.villain.hp -= 5;
    f.effects(
      mutagenBoost(f.s, f.piece("02036"), {
        attackerId: f.s.villain.id,
        playerId: "p1",
      })!.effects,
    );
    expect(f.s.villain.hp).toBe(f.s.villain.maxHp - 3);
    expect(f.s.queue).toEqual([]);
  });

  it.each(["02023", "02024"])(
    "%s boost enters against the defending player before minion activation, without reveal",
    (code) => {
      const f = fixture(2);
      const p = f.piece(code);
      f.s.resolving.push(p);
      const boost = mutagenBoost(f.s, p, {
        attackerId: f.s.villain.id,
        playerId: "p2",
      })!;
      expect(boost.retainsCard).toBe(true);
      f.effects(boost.effects);
      expect(f.s.minions).toEqual([p]);
      expect(p.engagedWith).toBe("p2");
      expect(f.s.resolving).not.toContain(p);
    },
  );

  it("Goblin Nation boost puts the real scheme with printed per-player threat", () => {
    const f = fixture(3);
    const p = f.piece("02027");
    f.s.resolving.push(p);
    const boost = mutagenBoost(f.s, p, {
      attackerId: f.s.villain.id,
      playerId: "p1",
    })!;
    f.effects(boost.effects);
    expect(boost.retainsCard).toBe(true);
    expect(p.counters).toBe(6);
    expect(f.s.sideSchemes).toEqual([p]);
  });

  it.each(["02022", "02025"])(
    "%s boost shuffles only after activation ends and cannot duplicate its card",
    (code) => {
      const f = fixture();
      const p = f.piece(code);
      f.s.resolving.push(p);
      const boost = mutagenBoost(f.s, p, {
        attackerId: f.s.villain.id,
        playerId: "p1",
      })!;
      expect(boost.effects).toEqual([]);
      expect(boost.afterActivation).toHaveLength(1);
      expect(f.ports.shuffleIntoEncounter).not.toHaveBeenCalled();
      f.effects(boost.afterActivation);
      expect(f.s.encounter.deck).toEqual([p]);
      expect(f.s.resolving).toEqual([]);
    },
  );

  it("I See You boost checks Goblin minions engaged with the actual defending player", () => {
    const f = fixture(2);
    const p = f.piece("02030");
    f.minion("02023", "p1");
    f.minion("01102", "p2");
    expect(
      mutagenBoost(f.s, p, { attackerId: f.s.villain.id, playerId: "p1" })!
        .extraIcons,
    ).toBe(1);
    expect(
      mutagenBoost(f.s, p, { attackerId: f.s.villain.id, playerId: "p2" })!
        .extraIcons,
    ).toBe(0);
    f.minion("02024", "p2");
    expect(
      mutagenBoost(f.s, p, { attackerId: f.s.villain.id, playerId: "p2" })!
        .extraIcons,
    ).toBe(1);
  });

  it("Intimidation boost adds a current villain boost; literal villain is not a villainous minion", () => {
    const f = fixture();
    const p = f.piece("02035");
    const boost = mutagenBoost(f.s, p, {
      attackerId: f.s.villain.id,
      playerId: "p1",
    })!;
    f.effects(boost.effects);
    expect(f.ports.giveBoost).toHaveBeenCalledWith(
      f.s,
      f.s.villain.id,
      "current",
    );
    expect(
      mutagenBoost(f.s, p, {
        attackerId: f.minion("16075").id,
        playerId: "p1",
      })!.effects,
    ).toEqual([]);
  });

  it("unknown effects fail closed and other modules remain untouched", () => {
    const f = fixture();
    expect(resolveMutagenEffect(f.s, { type: "other:ability" }, f.ports)).toBe(
      false,
    );
    expect(() => f.run({ type: "mutagen:unknown" })).toThrow("Unregistered");
    expect(mutagenEncounterReveal(f.s, f.piece("01104"))).toBeNull();
  });
});
