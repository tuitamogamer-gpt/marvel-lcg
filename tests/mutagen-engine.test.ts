import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { card, VILLAINS } from "../src/game/cards";
import { activateSeat } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";
import catalogCards from "../src/data/catalog-cards.json";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, `${cmd.type}: ${s.error || ""}`).toBeUndefined();
  for (let count = 0; s.review && count < 50; count++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    `${s.prompt?.title}: missing ${id}`,
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function allow(s: GameState) {
  for (let count = 0; s.prompt && count < 30; count++) {
    expect(s.prompt.kind, s.prompt.title).toBe("choice");
    const option = s.prompt.options.find((o) =>
      ["take", "resolve", "allow", "pass", "skip"].includes(o.id),
    );
    if (option) s = choose(s, option.id);
    else if (/forced|response|order/i.test(s.prompt.title))
      s = choose(s, s.prompt.options[0].id);
    else
      throw Error(
        `Unexpected decision: ${s.prompt.title} (${s.prompt.options.map((o) => o.id).join(", ")})`,
      );
  }
  expect(s.prompt).toBeNull();
  return s;
}
function begin(s: GameState) {
  for (let count = 0; s.phase === "mulligan" && count < 10; count++) {
    if (s.prompt?.kind === "choice") s = choose(s, s.prompt.options[0].id);
    else s = command(s, { type: "MULLIGAN", ids: [] });
  }
  if (s.prompt?.title === "Foresight") s = choose(s, s.prompt.options[0].id);
  expect(s.phase).toBe("player");
  expect(s.prompt).toBeNull();
  return s;
}
function create(
  difficulty: "standard" | "expert" = "standard",
  playerCount = 1,
  heroId = "spider_man",
) {
  return newGame({
    heroId,
    aspect: "justice",
    villainId: "mutagen_formula",
    difficulty,
    seed: 318,
    pacing: "expert",
    module: "goblin_gimmicks",
    ...(playerCount > 1
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
            ...(playerCount > 2
              ? [{ heroId: "iron_man", aspect: "leadership" as const }]
              : []),
          ],
        }
      : {}),
  });
}
function base(
  difficulty: "standard" | "expert" = "standard",
  playerCount = 1,
  heroId = "spider_man",
) {
  const s = begin(create(difficulty, playerCount, heroId));
  for (const seat of s.players) {
    seat.player.form = "hero";
    seat.player.hand = [];
    seat.player.inPlay = [];
    seat.player.discard = [];
    seat.player.deck = Array.from({ length: 8 }, () => makePiece(s, "01089"));
  }
  activateSeat(s, "p1");
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.resolving = [];
  s.queue = [];
  s.prompt = null;
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native fixture",
    text: "Resolve the native effect.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
}
function deck(s: GameState, ...codes: string[]) {
  s.encounter.deck = codes.map((code) => makePiece(s, code));
  s.encounter.discard = [];
  return [...s.encounter.deck];
}
function minion(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function attachment(s: GameState, code: string, enemyId = s.villain.id) {
  const p = makePiece(s, code);
  p.attachedTo = enemyId;
  s.attachments.push(p);
  return p;
}
function physicalPieces(s: GameState): Piece[] {
  const stored =
    (s.encounter as typeof s.encounter & { storedBoosts?: Piece[] })
      .storedBoosts || [];
  return [
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
      return [...p.hand, ...p.deck, ...p.discard, ...p.inPlay];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...stored,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.removed,
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ];
}
function uniqueInstances(s: GameState) {
  const ids = physicalPieces(s).map((p) => p.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("Mutagen Formula through the native dispatcher", () => {
  it("registers the exact scenario and physically complete default product sets", () => {
    const profile = VILLAINS.find((v) => v.id === "mutagen_formula");
    expect(profile?.codes).toEqual(["02014", "02015", "02016"]);
    expect(profile?.schemes).toEqual(["02017b", "02018b"]);
    const s = create();
    const pieces = physicalPieces(s);
    for (const c of catalogCards.filter(
      (c) =>
        ["mutagen_formula", "goblin_gimmicks"].includes(c.set_code) &&
        !["villain", "main_scheme"].includes(c.type_code),
    ))
      expect(
        pieces.filter((p) => p.code === c.code),
        c.code,
      ).toHaveLength(c.quantity);
    expect(s.villain).toMatchObject({
      code: "02014",
      stage: 1,
      hp: 16,
      maxHp: 16,
    });
    uniqueInstances(s);
  });

  it("resolves standard scenario setup before the opening hand/mulligan", () => {
    const s = create();
    expect(s.phase).toBe("mulligan");
    expect(s.scheme).toEqual({ code: "02017b", threat: 2, index: 0 });
    expect(s.minions).toHaveLength(1);
    expect(s.minions[0]).toMatchObject({ code: "02024", engagedWith: "p1" });
    expect(s.player.hand).toHaveLength(6);
    expect(s.encounter.deck.filter((p) => p.code === "02024")).toHaveLength(5);
    expect(s.encounter.dealt).toHaveLength(0);
    uniqueInstances(s);
  });

  it("expert setup puts Thralls, deals encounters in chosen order, then draws opening hands", () => {
    let s = create("expert", 2);
    expect(s.villain).toMatchObject({
      code: "02015",
      hp: 36,
      maxHp: 36,
      stage: 2,
    });
    expect(s.scheme.threat).toBe(4);
    expect(s.minions.map((p) => p.engagedWith)).toEqual(["p1", "p2"]);
    expect(s.players.every((seat) => seat.player.hand.length === 0)).toBe(true);
    expect(s.prompt?.title).toContain("encounter order");
    s = choose(s, "p2");
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual([
      "p2",
      "p2",
      "p1",
      "p1",
    ]);
    expect(s.players.map((seat) => seat.player.hand.length)).toEqual([6, 6]);
    expect(s.phase).toBe("mulligan");
    uniqueInstances(s);
  });

  it("advances I to II, deals two encounters, and keeps same-character status and attachments", () => {
    let s = base();
    s.villain.hp = 1;
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    s.villain.tough = false;
    const hysteria = attachment(s, "02020");
    deck(s, "02019", "02021", "02029");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.villain).toMatchObject({
      code: "02015",
      stage: 2,
      hp: 18,
      confused: true,
      confuseCards: 1,
    });
    expect(s.attachments.find((p) => p.id === hysteria.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["02019", "02021"]);
    uniqueInstances(s);
  });

  it("advances expert II to III, deals three per player and wins on the final villain", () => {
    let s = base("expert");
    s.villain.hp = 1;
    deck(s, "02019", "02020", "02021", "02029");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.villain).toMatchObject({ code: "02016", stage: 3, hp: 20 });
    expect(s.encounter.dealt).toHaveLength(3);
    s.player.exhausted = false;
    s.villain.hp = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.phase).toBe("won");
  });

  it("stage 1 completion discards in player order, skips engaged Goblins and initializes stage2 correctly", () => {
    let s = base("standard", 2);
    minion(s, "02023", "p2");
    deck(s, "02019", "02025", "02024", "02020");
    s = native(s, { type: "threat", target: "main", amount: 10 });
    expect(s.scheme).toEqual({ code: "02018b", index: 1, threat: 8 });
    expect(s.minions.map((p) => [p.code, p.engagedWith])).toEqual([
      ["02023", "p2"],
      ["02025", "p1"],
    ]);
    expect(s.players.every((seat) => !seat.player.stunned)).toBe(true);
    expect(s.minions.every((p) => p.code !== "drone")).toBe(true);
    expect(s.encounter.deck.map((p) => p.code)).toEqual(["02020"]);
    uniqueInstances(s);
  });

  it("stage2 escalation counts Goblin enemies once plus acceleration, and threshold completion loses", () => {
    let s = base("standard", 2);
    s.scheme = { code: "02018b", index: 1, threat: 8 };
    minion(s, "02024", "p1");
    minion(s, "02023", "p2");
    minion(s, "01102", "p2");
    s.encounter.acceleration = 1;
    const overrun = makePiece(s, "02028");
    overrun.counters = 2;
    s.sideSchemes.push(overrun);
    s = native(s, { type: "villainStepOne" });
    expect(s.scheme.threat).toBe(14); //3 Goblins +1 acceleration token +2 printed icons.
    s = native(s, { type: "threat", target: "main", amount: 8 });
    expect(s.phase).toBe("lost");
  });

  it.each([
    ["02019", "01088"],
    ["02033", "01088"],
    ["02020", "01089"],
    ["02021", "01090"],
    ["02034", "01090"],
  ])(
    "%s enters and removes through its exact typed resource action",
    (code, resource) => {
      let s = base();
      s = reveal(s, code);
      const p = s.attachments.find((p) => p.code === code)!;
      expect(p?.attachedTo).toBe(s.villain.id);
      s.player.hand = [makePiece(s, resource)];
      s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
      expect(s.prompt).toMatchObject({ kind: "payment", cost: 2 });
      expect(s.attachments.some((a) => a.id === p.id)).toBe(true);
      s = command(s, { type: "PAY", ids: [s.player.hand[0].id] });
      expect(s.attachments.some((a) => a.id === p.id)).toBe(false);
      expect(s.encounter.discard.filter((a) => a.id === p.id)).toHaveLength(1);
      expect(s.player.exhausted).toBe(false);
      uniqueInstances(s);
    },
  );

  it("attachment payment can cancel without discarding and rejects the wrong typed resources", () => {
    let s = base();
    const p = attachment(s, "02019");
    s.player.hand = [makePiece(s, "01089"), makePiece(s, "01088")];
    s = command(s, { type: "ABILITY", id: p.id });
    const invalid = dispatch(s, { type: "PAY", ids: [s.player.hand[0].id] });
    expect(invalid.error).toBeTruthy();
    expect(invalid.attachments.some((a) => a.id === p.id)).toBe(true);
    s = command(s, { type: "CANCEL" });
    expect(s.attachments.some((a) => a.id === p.id)).toBe(true);
    expect(s.player.hand).toHaveLength(2);
  });

  it("Glider moves to the highest eligible enemy and enforces duplicates across both printings", () => {
    let s = base();
    attachment(s, "02019");
    const knight = minion(s, "02022");
    s = reveal(s, "02033");
    expect(s.attachments.find((p) => p.code === "02033")?.attachedTo).toBe(
      knight.id,
    );
    uniqueInstances(s);
  });

  it.each(["02023", "02024"])(
    "%s boost puts a real minion early enough to activate in villain step2",
    (code) => {
      let s = base();
      const [boost] = deck(s, code, "02029", "02019");
      const hp = s.player.hp;
      s = allow(native(s, { type: "villainActivate" }));
      expect(s.player.hp).toBe(hp - 3); //Goblin2 + new minion1.
      expect(s.minions.find((p) => p.id === boost.id)?.engagedWith).toBe("p1");
      expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
      expect(s.resolving.some((p) => p.id === boost.id)).toBe(false);
      uniqueInstances(s);
    },
  );

  it.each(["02022", "02025"])(
    "%s boost remains out of the deck until activation ends, then returns once",
    (code) => {
      let s = base();
      const [boost] = deck(s, code, "02029", "02019");
      const backflip = makePiece(s, "01003");
      s.player.hand.push(backflip);
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "take");
      expect(s.prompt?.title).toBe("Incoming attack");
      expect(s.encounter.deck.some((p) => p.id === boost.id)).toBe(false);
      expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
      const hp = s.player.hp;
      s = choose(s, "backflip");
      s = allow(s);
      expect(s.player.hp).toBe(hp);
      expect(s.encounter.deck.filter((p) => p.id === boost.id)).toHaveLength(1);
      expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
      uniqueInstances(s);
    },
  );

  it("Goblin Nation boost increases the current attack and enters with printed threat", () => {
    let s = base();
    const [boost] = deck(s, "02027", "02029", "02019");
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.sideSchemes.find((p) => p.id === boost.id)?.counters).toBe(2);
    uniqueInstances(s);
  });

  it("I See You boost contributes one extra icon only for an engaged Goblin minion", () => {
    let s = base();
    minion(s, "02024");
    deck(s, "02030", "02029", "02019");
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 4); //printed1 plus conditional1 plus Goblin2.
    expect(s.scheme.threat).toBe(3);
  });

  it("Intimidation boost appends and resolves the next current boost exactly once", () => {
    let s = base();
    const cards = deck(s, "02035", "02029", "02019", "02020");
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 4); //base2 + one icon each on the first two boosts.
    expect(
      s.encounter.discard.filter((p) =>
        cards.slice(0, 2).some((c) => c.id === p.id),
      ),
    ).toHaveLength(2);
    expect(s.encounter.deck.map((p) => p.code)).toEqual(["02019", "02020"]);
    uniqueInstances(s);
  });

  it("Regenerative Healing boost heals two before activation damage without inventing surge", () => {
    let s = base();
    s.villain.hp -= 4;
    deck(s, "02036", "02029", "02019");
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.hp).toBe(14);
    expect(s.encounter.dealt).toHaveLength(0);
  });

  it("Green Goblin's damage response ignores Tough/ally damage and uses current-stage threat value", () => {
    let s = base();
    s.player.tough = true;
    s.player.toughCards = 1;
    deck(s, "02029", "02019", "02020");
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBe(2);
    s = base("expert");
    s.villain.code = "02016";
    s.villain.stage = 3;
    s.villain.hp = s.villain.maxHp = 20;
    deck(s, "02029", "02019", "02020");
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.scheme.threat).toBe(4);
    s = base();
    deck(s, "02029", "02019", "02020");
    const ally = makePiece(s, "01083");
    s.player.inPlay.push(ally);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    s = allow(s);
    expect(s.scheme.threat).toBe(2);
  });

  it("Hysteria boosts both attacks and schemes, and canceled activations consume no cards", () => {
    let s = base();
    attachment(s, "02020");
    const cards = deck(s, "02029", "02030", "02019", "02021");
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(s.encounter.deck.map((p) => p.id)).toEqual(cards.map((p) => p.id));
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 4);
    s = base();
    attachment(s, "02020");
    deck(s, "02029", "02030", "02019", "02021");
    s.player.form = "alter";
    s = allow(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.scheme.threat).toBe(5); //base1 plus two1-icon boosts.
  });

  it("Soldier defeat deals one damage to the engaged identity through native Tough prevention", () => {
    let s = base();
    const soldier = minion(s, "02023");
    soldier.damage = 3;
    s.player.tough = true;
    s.player.toughCards = 1;
    const hp = s.player.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, soldier.id);
    s = allow(s);
    expect(s.minions).toHaveLength(0);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === soldier.id)).toHaveLength(
      1,
    );
    uniqueInstances(s);
  });

  it("Knight after-attack discards one and puts Monster without a reveal stun", () => {
    let s = base();
    const knight = minion(s, "02022");
    const [monster] = deck(s, "02025", "02029", "02019");
    s = allow(native(s, { type: "enemyAttack", id: knight.id }));
    expect(s.minions.find((p) => p.id === monster.id)?.engagedWith).toBe("p1");
    expect(s.player.stunned).toBe(false);
    uniqueInstances(s);
  });

  it("Monster reveals with stun, and already-stunned replacement deals two through normal damage", () => {
    let s = base();
    s = reveal(s, "02025");
    expect(s.player.stunned).toBe(true);
    s.minions = [];
    const hp = s.player.hp;
    s = reveal(s, "02025");
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.stunned).toBe(true);
  });

  it("Goblin Reinforcements uses fixed base2 plus all Goblin minions and retains its hazard icon", () => {
    let s = base("standard", 2);
    minion(s, "02023", "p2");
    minion(s, "02024", "p1");
    minion(s, "01102", "p2");
    s = reveal(s, "02026");
    expect(s.sideSchemes.find((p) => p.code === "02026")?.counters).toBe(4);
    expect(card("02026").scheme_hazard).toBe(1);
  });

  it("Overrun's native defeat processes each player and stops at individual discard exhaustion", () => {
    let s = base("standard", 2);
    const overrun = makePiece(s, "02028");
    overrun.counters = 1;
    s.sideSchemes.push(overrun);
    deck(s, "02025", "02023", "02024", "02019", "02020");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, overrun.id);
    s = allow(s);
    expect(s.minions.map((p) => [p.code, p.engagedWith])).toEqual([
      ["02025", "p1"],
      ["02023", "p1"],
      ["02024", "p2"],
    ]);
    expect(s.sideSchemes.some((p) => p.id === overrun.id)).toBe(false);
    expect(s.players.every((seat) => !seat.player.stunned)).toBe(true);
    uniqueInstances(s);
  });

  it("Death from Above applies stage2 bonus only to that attack and scheme", () => {
    let s = base("expert");
    deck(s, "02029", "02030", "02019", "02021");
    const hp = s.player.hp;
    s = allow(reveal(s, "02029"));
    expect(s.player.hp).toBe(hp - 5); //2+stage2+boost1.
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 8); //2+boost1 only.
    s = base("expert");
    s.player.form = "alter";
    s.scheme.threat = 0;
    deck(s, "02029", "02019", "02020");
    s = allow(reveal(s, "02029"));
    expect(s.scheme.threat).toBe(5); //SCH2+stage2+boost1; no advancement hides the result.
  });

  it("I See You attacks alter-ego without ordinary or Hysteria boosts", () => {
    let s = base();
    s.player.form = "alter";
    attachment(s, "02020");
    const cards = deck(s, "02029", "02019", "02021");
    const hp = s.player.hp;
    s = allow(reveal(s, "02030"));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(cards.map((p) => p.id));
    expect(s.scheme.threat).toBe(3); //The main starts at3; this direct encounter attack adds no threat.
  });

  it("Overconfidence surges from actual ally damage, not blocked identity damage or printed attack", () => {
    let s = base();
    s.player.tough = true;
    s.player.toughCards = 1;
    deck(s, "02019", "02029", "02020");
    s = allow(reveal(s, "02031"));
    expect(s.encounter.dealt).toHaveLength(0);
    s = base();
    const ally = makePiece(s, "01083");
    s.player.inPlay.push(ally);
    deck(s, "02019", "02029", "02020");
    s = reveal(s, "02031");
    s = choose(s, ally.id);
    s = allow(s);
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["02029"]);
  });

  it("Overconfidence counts actual scheme threat even when stage advancement resets the visible value", () => {
    let s = base();
    s.player.form = "alter";
    s.scheme.threat = 6;
    deck(s, "02019", "02025", "02029", "02020", "02021", "02023");
    s = allow(reveal(s, "02031"));
    expect(s.scheme.code).toBe("02018b");
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["02021"]);
  });

  it("Overconfidence counts all damage placed on a defeated ally, including excess beyond remaining HP", () => {
    let s = base();
    const ally = makePiece(s, "01083");
    ally.damage = Number(card(ally).health) - 1;
    s.player.inPlay.push(ally);
    deck(s, "02029", "02020", "02021");
    s = reveal(s, "02031");
    s = choose(s, ally.id);
    s = allow(s);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["02020"]);
    uniqueInstances(s);
  });

  it("Wicked Ambitions pauses at each Goblin choice and survives JSON hydration without duplication", () => {
    let s = base();
    const [soldier] = deck(s, "02023", "02025", "02019", "02029");
    s = reveal(s, "02032");
    expect(s.prompt?.title).toBe("Wicked Ambitions");
    expect(s.encounter.deck[0].code).toBe("02025");
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, "minion");
    expect(s.minions.find((p) => p.id === soldier.id)?.engagedWith).toBe("p1");
    expect(s.prompt?.title).toBe("Wicked Ambitions");
    const hp = s.player.hp;
    s = choose(s, "damage");
    expect(s.player.hp).toBe(hp - 3);
    expect(s.encounter.deck.map((p) => p.code)).toEqual(["02019", "02029"]);
    uniqueInstances(s);
  });

  it("Wicked Ambitions stops at deck exhaustion even when the last Goblin was reshuffled", () => {
    let s = base("expert");
    const [soldier] = deck(s, "02023");
    s.encounter.discard.push(makePiece(s, "02019"));
    s = reveal(s, "02032");
    expect(s.encounter.acceleration).toBe(1);
    s = choose(s, "minion");
    expect(s.minions.find((p) => p.id === soldier.id)).toBeDefined();
    expect(s.encounter.deck.some((p) => p.id === soldier.id)).toBe(false);
    expect(s.prompt).toBeNull();
    uniqueInstances(s);
  });

  it("Intimidation gives a retained facedown boost, survives hydration and preserves it through Stunned cancellation", () => {
    let s = base();
    const cards = deck(s, "02019", "02029", "02020", "02021");
    s = reveal(s, "02035");
    s = choose(s, "boost");
    expect(
      (
        s.encounter as typeof s.encounter & { storedBoosts: Piece[] }
      ).storedBoosts.map((p) => p.id),
    ).toEqual([cards[0].id]);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(
      (s.encounter as typeof s.encounter & { storedBoosts: Piece[] })
        .storedBoosts,
    ).toHaveLength(1);
    const hp = s.player.hp;
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 6); //base2+storedGlider3+ordinaryDeathFromAbove1.
    expect(
      (s.encounter as typeof s.encounter & { storedBoosts: Piece[] })
        .storedBoosts,
    ).toHaveLength(0);
    expect(
      s.encounter.discard.filter((p) => p.id === cards[0].id),
    ).toHaveLength(1);
    uniqueInstances(s);
  });

  it("Intimidation affordable branch pays exactly two generic resources and gives no boost", () => {
    let s = base();
    s.player.hand = [makePiece(s, "01089")];
    s = reveal(s, "02035");
    s = choose(s, "pay");
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: [],
      cancelable: false,
    });
    s = command(s, { type: "PAY", ids: [s.player.hand[0].id] });
    expect(
      (s.encounter as typeof s.encounter & { storedBoosts?: Piece[] })
        .storedBoosts || [],
    ).toEqual([]);
  });

  it("Regenerative Healing heals to maximum and uses surge only if no damage healed", () => {
    let s = base();
    s.villain.hp = 15;
    deck(s, "02029", "02020", "02021");
    s = reveal(s, "02036");
    expect(s.villain.hp).toBe(16);
    expect(s.encounter.dealt).toHaveLength(0);
    s = reveal(s, "02036");
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["02029"]);
    uniqueInstances(s);
  });

  it("Pumpkin Bombs allocates indirect damage explicitly and treats each character as one packet", () => {
    let s = base();
    const pumpkin = attachment(s, "02021");
    const ally = makePiece(s, "01083");
    s.player.inPlay.push(ally);
    s.player.tough = true;
    s.player.toughCards = 1;
    deck(s, "02029", "02019", "02020");
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.prompt?.text).toMatch(/indirect/i);
    expect(s.attachments.some((p) => p.id === pumpkin.id)).toBe(false);
    s = choose(s, "hero");
    s = choose(s, ally.id);
    s = allow(s);
    expect(s.player.hp).toBe(hp - 1); //attack consumed Tough; one indirect assigned to identity.
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    uniqueInstances(s);
  });

  it("two indirect points assigned to one Tough ally form one prevented damage packet", () => {
    let s = base();
    const pumpkin = attachment(s, "02021");
    const ally = makePiece(s, "01083");
    ally.tough = true;
    ally.toughCards = 1;
    s.player.inPlay.push(ally);
    deck(s, "02029", "02019", "02020");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, pumpkin.id);
    expect(s.prompt?.text).toMatch(/indirect/i);
    s = choose(s, ally.id);
    s = choose(s, ally.id);
    s = allow(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 0,
      tough: false,
      toughCards: 0,
    });
    uniqueInstances(s);
  });

  it("indirect allocation respects remaining HP even when Tough will prevent damage", () => {
    let s = base();
    const pumpkin = attachment(s, "02021");
    const ally = makePiece(s, "01083");
    ally.damage = Number(card(ally).health) - 1;
    ally.tough = true;
    ally.toughCards = 1;
    s.player.inPlay.push(ally);
    deck(s, "02029", "02019", "02020");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, pumpkin.id);
    s = choose(s, ally.id);
    expect(s.prompt?.options.some((o) => o.id === ally.id)).toBe(false);
    s = choose(s, "hero");
    s = allow(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: Number(card(ally).health) - 1,
      tough: false,
    });
    uniqueInstances(s);
  });

  it.each([
    "02022",
    "02023",
    "02024",
    "02025",
    "02027",
    "02030",
    "02035",
    "02036",
  ])(
    "%s boost resolves through native scheming without retaining duplicate physical cards",
    (code) => {
      let s = base();
      s.player.form = "alter";
      s.scheme = { code: "02018b", index: 1, threat: 0 };
      if (code === "02030") minion(s, "02024");
      if (code === "02036") s.villain.hp -= 4;
      const [boost] = deck(s, code, "02029", "02019", "02020");
      s = allow(native(s, { type: "enemyScheme", id: s.villain.id }));
      const extra = ["02030", "02035"].includes(code) ? 1 : 0;
      expect(s.scheme.threat).toBe(1 + Number(card(code).boost || 0) + extra);
      if (["02023", "02024"].includes(code))
        expect(
          s.minions.some((p) => p.id === boost.id && p.engagedWith === "p1"),
        ).toBe(true);
      if (code === "02027")
        expect(s.sideSchemes.find((p) => p.id === boost.id)?.counters).toBe(2);
      if (["02022", "02025"].includes(code)) {
        expect(s.encounter.deck.filter((p) => p.id === boost.id)).toHaveLength(
          1,
        );
        expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
      }
      if (code === "02036") expect(s.villain.hp).toBe(14);
      uniqueInstances(s);
    },
  );

  it("delayed boost shuffle precedes forced reactions and Retaliate can be ordered before Goblin's response", () => {
    let s = base("standard", 1, "black_panther");
    s.villain.hp = 1;
    const [knight] = deck(s, "02022", "02029", "02020", "02021", "02019");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.villain.stage).toBe(1);
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.encounter.deck.some((p) => p.id === knight.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === knight.id)).toBe(false);
    const retaliation = s.prompt?.options.find((o) =>
      /retaliate/i.test(o.label),
    );
    expect(retaliation).toBeDefined();
    s = choose(s, retaliation!.id);
    s = allow(s);
    expect(s.villain.stage).toBe(2);
    expect(s.encounter.dealt).toHaveLength(2);
    expect(s.scheme.threat).toBe(3);
    uniqueInstances(s);
  });
});
