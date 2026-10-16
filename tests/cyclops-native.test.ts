import { describe, it, expect } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sourceDecks from "../src/data/catalog-decks.json" with { type: "json" };
import {
  card,
  deckCodes,
  imageFor,
  maxHP,
  pieceHP,
} from "../src/game/cards.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import {
  dispatch,
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  enemyStats,
  allyLimit,
  playable,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { paymentSources } from "../src/game/payment.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  cyclopsCanAttack,
  cyclopsFirstTurn,
  cyclopsCharacterModifiers,
  cyclopsBoost,
  cyclopsShadowOfPast,
} from "../src/game/cyclops.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  minion,
  native,
  pay,
  physical,
  play,
  target,
  respond,
  reload,
} from "./dv-test-helpers.js";
function base(team = false) {
  let s = newGame({
    heroId: "cyclops",
    aspect: "leadership",
    villainId: "rhino",
    seed: 33001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "cyclops", aspect: "leadership" as Aspect },
            { heroId: "spider_man", aspect: "justice" as Aspect },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    const all = physical(s);
    s.player.deck = all;
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = [];
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.flipped = false;
  }
  activateSeat(s, "p1");
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  return s;
}
function attached(s: GameState, code: string, id: string) {
  const p = put(s, code);
  p.attachedTo = id;
  return p;
}
function ability(s: GameState, action: string, id = "identity") {
  return command(s, { type: "ABILITY", id, action });
}
function basic(s: GameState, id: string) {
  return target(command(s, { type: "BASIC", action: "attack" }), id);
}
function reveal(s: GameState, code: string) {
  const p = makePiece(s, code);
  return { p, s: native(s, { type: "reveal", piece: p }) };
}
function use(s: GameState, p: Piece, id: string) {
  return target(
    command(s, { type: "ABILITY", id: p.id, action: "attack" }),
    id,
  );
}

describe("Cyclops original source and native lifecycle", () => {
  it("registers all36 original faces and shared Psychic Rapport without mutating source", () => {
    const faces = catalog.filter((c) => c.pack_code === "cyclops");
    expect(faces).toHaveLength(36);
    expect(faces.every((c) => hasExecutableScript(c.code))).toBe(true);
    expect(hasExecutableScript("34023")).toBe(true);
    const source = sourceDecks.find((d) => d.heroCode === "33001a")!;
    expect(source.aspect).toBe("multi");
    expect(deckCodes("cyclops", "leadership")).toEqual(
      Object.entries(source.cards).flatMap(([c, n]) => Array(n).fill(c)),
    );
    expect(deckCodes("cyclops", "leadership")).toHaveLength(40);
  });
  it.each(["leadership", "aggression", "justice", "protection"] as Aspect[])(
    "validates %s composition and preserves15 mandatory signatures",
    (aspect) => {
      const codes = deckCodes("cyclops", aspect);
      expect(deckErrors("cyclops", aspect, codes)).toEqual([]);
      expect(codes.filter((c) => card(c).set_code === "cyclops")).toHaveLength(
        15,
      );
    },
  );
  it("offers off-aspect X-Men allies, excludes other off-aspect allies, and uses matching art", () => {
    const options = deckOptions("cyclops", "leadership");
    expect(options.some((c) => c.code === "33012")).toBe(true);
    expect(options.some((c) => c.code === "01051")).toBe(false);
    expect(imageFor("33001a")).toContain("33001b");
    expect(imageFor("33001b")).toContain("33001a");
  });
  it("opens with six cards and five actual set-aside nemesis pieces", () => {
    const s = newGame({
      heroId: "cyclops",
      aspect: "leadership",
      villainId: "rhino",
      seed: 1,
    });
    expect(s.player.hand).toHaveLength(6);
    expect(physical(s)).toHaveLength(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "33028",
      "33029",
      "33030",
      "33030",
      "33031",
    ]);
  });
  it("Constant Training moves one actual deck Tactic and survives save/reload limit", () => {
    let s = base();
    s.player.form = "alter";
    const chosen = s.player.deck.find((p) => p.code === "33005")!;
    s = ability(s, "constant-training");
    s = choose(s, chosen.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toContain(chosen.id);
    expect(nativeHeroAbilityOptions(reload(s))).toEqual([]);
    expect(physical(s).filter((p) => p.id === chosen.id)).toHaveLength(1);
  });
  it("Visor is restricted to Optic Blast and its paid attack is piercing/ranged", () => {
    let s = base();
    attached(s, "33006", s.villain.id);
    const visor = put(s, "33003");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    expect(
      paymentSources(s, undefined, "33009").some((p) => p.id === visor.id),
    ).toBe(false);
    expect(
      paymentSources(s, undefined, "33001a").some((p) => p.id === visor.id),
    ).toBe(true);
    s = ability(s, "optic-blast");
    s = choose(s, s.villain.id);
    s = pay(s, [], undefined, [visor.id]);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.villain.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === visor.id)?.exhausted).toBe(
      true,
    );
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
  });
  it("Optic Blast can use hand resources without exhausting Cyclops", () => {
    let s = base();
    attached(s, "33005", s.villain.id);
    const [r] = hand(s, "33024");
    s = ability(s, "optic-blast");
    s = choose(s, s.villain.id);
    s = finish(pay(s, [r]));
    expect(s.villain.hp).toBe(46);
    expect(s.player.exhausted).toBe(false);
  });
  it("Full Blast pays its event and exhaustion costs before11-damage Optic Blast", () => {
    let s = base();
    attached(s, "33006", s.villain.id);
    const visor = put(s, "33003"),
      [full, r] = hand(s, "33008", "33024");
    s = ability(s, "optic-blast");
    s = choose(s, s.villain.id);
    s = pay(s, [], undefined, [visor.id]);
    s = choose(s, full.id);
    s = pay(s, [r]);
    s = finish(s);
    expect(s.villain.hp).toBe(39);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === full.id)).toBe(true);
  });
  it("stunned Optic Blast pays its resource and round limit but deals no damage", () => {
    let s = base();
    attached(s, "33006", s.villain.id);
    const [r] = hand(s, "33024");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = ability(s, "optic-blast");
    s = choose(s, s.villain.id);
    s = finish(pay(s, [r]));
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.flags.cyclopsOpticRound).toBe(s.round);
  });
  it("Ricochet Beam applies both printed attack damage instructions to a marked enemy", () => {
    let s = base();
    attached(s, "33005", s.villain.id);
    const [event, r] = hand(s, "33009", "33024");
    s = play(s, event, [r]);
    s = choose(s, s.villain.id);
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(42);
  });
  it("Tactical Brilliance thwarts then retrieves an actual discarded Tactic", () => {
    let s = base();
    const tactic = s.player.deck.splice(
      s.player.deck.findIndex((p) => p.code === "33006"),
      1,
    )[0];
    s.player.discard.push(tactic);
    const [event, r] = hand(s, "33010", "33024");
    s = play(s, event, [r]);
    s = target(s, "main");
    s = choose(s, tactic.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.hand.some((p) => p.id === tactic.id)).toBe(true);
  });
  it("confusion replaces Tactical Brilliance including its retrieval", () => {
    let s = base();
    const tactic = s.player.deck.splice(
      s.player.deck.findIndex((p) => p.code === "33006"),
      1,
    )[0];
    s.player.discard.push(tactic);
    s.player.confused = true;
    s.player.confuseCards = 1;
    const [event, r] = hand(s, "33010", "33024");
    s = finish(play(s, event, [r]));
    expect(s.scheme.threat).toBe(8);
    expect(s.player.hand.some((p) => p.id === tactic.id)).toBe(false);
  });
  it("plays a physical enemy Tactic and refuses a second same-title copy", () => {
    let s = base();
    const [t] = hand(s, "33006");
    s = finish(target(play(s, t), s.villain.id));
    expect(s.player.inPlay.find((p) => p.id === t.id)?.attachedTo).toBe(
      s.villain.id,
    );
    const [duplicate] = hand(s, "33006");
    expect(playable(s, duplicate)).toContain("target");
    expect(enemyStats(s, s.villain).attack).toBe(
      (card(s.villain).attack || 0) - 1,
    );
  });
  it("temporary Tactics expire while Field Commander preserves only minion attachments", () => {
    let s = base();
    const m = minion(s);
    put(s, "33004");
    const retained = attached(s, "33006", m.id),
      expired = attached(s, "33005", s.villain.id);
    s = finish(native(s, { type: "newRound" }));
    expect(s.player.inPlay.some((p) => p.id === retained.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === expired.id)).toBe(true);
  });
  it("Priority Target gives its defeating player two cards before removing actual attachment", () => {
    let s = base();
    const m = minion(s, "01103");
    attached(s, "33007", m.id);
    s = native(s, {
      type: "damage",
      target: m.id,
      amount: 5,
      source: "hero",
      attack: true,
    });
    s = respond(s, /Priority Target/);
    s = finish(s);
    expect(s.player.hand).toHaveLength(2);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.discard.some((p) => p.code === "33007")).toBe(true);
  });
  it("Field Commander changes only turn order, leaving first-player token unchanged", () => {
    let s = base(true);
    const commander = put(s, "33004");
    s.firstPlayerId = "p2";
    expect(cyclopsFirstTurn(s)).toBe("p1");
    s = finish(native(s, { type: "newRound" }));
    expect(s.turnPlayerId).toBe("p1");
    expect(s.player.inPlay.some((p) => p.id === commander.id)).toBe(true);
  });
  it("Beast searches an actual resource in discard and returns same ID", () => {
    let s = base();
    const beast = put(s, "33011"),
      resource = s.player.deck.splice(
        s.player.deck.findIndex((p) => p.code === "33024"),
        1,
      )[0];
    s.player.discard.push(resource);
    s = native(s, { type: "allyEnter", id: beast.id });
    s = choose(s, beast.id);
    s = choose(s, resource.id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
    expect(physical(s).filter((p) => p.id === resource.id)).toHaveLength(1);
  });
  it("Phoenix returns an actual Cyclops signature from discard", () => {
    let s = base();
    const phoenix = put(s, "33002"),
      sig = s.player.deck.splice(
        s.player.deck.findIndex((p) => p.code === "33009"),
        1,
      )[0];
    s.player.discard.push(sig);
    s = native(s, { type: "allyEnter", id: phoenix.id });
    s = choose(s, phoenix.id);
    s = finish(choose(s, sig.id));
    expect(s.player.hand.some((p) => p.id === sig.id)).toBe(true);
  });
  it("Blindfold inspects up to5, discards exactly1, preserves remaining order across reload", () => {
    let s = base();
    const blind = put(s, "33014"),
      before = s.encounter.deck.map((p) => p.id),
      hidden = s.hiddenInfo || 0;
    s = native(s, { type: "allyEnter", id: blind.id });
    s = choose(s, blind.id);
    expect(s.prompt?.options).toHaveLength(5);
    s = finish(choose(s, before[2]));
    expect(s.encounter.deck.map((p) => p.id)).toEqual(
      before.filter((id) => id !== before[2]),
    );
    expect(s.encounter.discard.map((p) => p.id)).toContain(before[2]);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
  });
  it("Danger Room attaches actual Training from deck to the entering X-Men ally", () => {
    let s = base();
    s.player.form = "alter";
    const room = put(s, "33021"),
      ally = put(s, "33019"),
      training = s.player.deck.find((p) => p.code === "33015")!;
    s = native(s, { type: "allyEnter", id: ally.id });
    s = choose(s, `${room.id}:p1`);
    s = finish(choose(s, training.id));
    expect(s.player.inPlay.find((p) => p.id === training.id)?.attachedTo).toBe(
      ally.id,
    );
    expect(s.player.inPlay.find((p) => p.id === room.id)?.exhausted).toBe(true);
    expect(
      pieceHP(
        s,
        s.player.inPlay.find((p) => p.id === ally.id)!,
      ),
    ).toBe(4);
  });
  it.each(["33020", "36024"])(
    "Utopia printing %s readies another X-Men and increases ally limit",
    (code) => {
      let s = base();
      const utopia = put(s, code),
        ally = put(s, "33019");
      s.player.exhausted = true;
      expect(allyLimit(s)).toBe(4);
      s = native(s, { type: "allyEnter", id: ally.id });
      s = choose(s, utopia.id);
      s = finish(choose(s, "hero:p1"));
      expect(s.player.exhausted).toBe(false);
      expect(s.player.inPlay.find((p) => p.id === utopia.id)?.exhausted).toBe(
        true,
      );
      put(s, "01067");
      expect(allyLimit(s)).toBe(3);
    },
  );
  it.each(["33018", "36021"])(
    "Effective Leadership printing %s grants the paid ally temporary stats",
    (code) => {
      let s = base();
      const [ally, r1, r2] = hand(s, "33019", code, "33024");
      s = play(s, ally, [r1, r2]);
      s = respond(s, /Effective Leadership/);
      s = finish(s);
      const entered = s.player.inPlay.find((p) => p.id === ally.id)!;
      expect(entered.bonusAtk).toBe(1);
      expect(entered.bonusThw).toBe(1);
      s = finish(native(s, { type: "refill" }));
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.bonusAtk).toBe(0);
    },
  );
  it("Game Time readies and heals a Training ally", () => {
    let s = base();
    const ally = put(s, "33019");
    ally.exhausted = true;
    ally.damage = 2;
    attached(s, "33015", ally.id);
    const [event] = hand(s, "33022");
    s = play(s, event);
    s = finish(choose(s, ally.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      exhausted: false,
      damage: 1,
    });
  });
  it("Honorary X-Men grants the actual friendly identity trait and maximum HP", () => {
    let s = base(true);
    const before = maxHP(seatView(s, "p2"));
    const [upgrade] = hand(s, "33035");
    s = play(s, upgrade);
    s = finish(choose(s, "hero:p2"));
    expect(maxHP(seatView(s, "p2"))).toBe(before + 1);
    expect(cyclopsCharacterModifiers(s, "hero:p2").xmen).toBe(true);
  });
  it("Lost Visor stores one physical Visor, blocks attacks, and Scott recovers it", () => {
    let s = base();
    const visor = put(s, "33003");
    const r = reveal(s, "33027");
    s = finish(r.s);
    expect(cyclopsCanAttack(s)).toBe(false);
    expect(
      s.player.inPlay
        .find((p) => p.id === r.p.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([visor.id]);
    expect(
      dispatch(reload(s), { type: "BASIC", action: "attack" }).error,
    ).toMatch(/Visor/);
    s.player.form = "alter";
    s = finish(ability(s, "recover-visor", r.p.id));
    expect(s.player.hand.some((p) => p.id === visor.id)).toBe(true);
    expect(s.removed.some((p) => p.id === r.p.id)).toBe(true);
    expect(physical(s).filter((p) => p.id === visor.id)).toHaveLength(1);
  });
  it("Gene Therapy selects lowest printed ATK and grants actual attack piercing/overkill", () => {
    let s = base();
    const m = minion(s, "01103");
    s = reveal(s, "33030").s;
    s = finish(choose(s, m.id));
    const gene = s.attachments.find((p) => p.code === "33030")!;
    expect(gene.attachedTo).toBe(m.id);
    s = native(s, { type: "enemyAttack", id: m.id });
    expect(s.attack).toMatchObject({ piercing: true, overkill: true });
  });
  it("Mister Sinister's boost stuns, or deals2 damage if already stunned", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const before = s.player.hp;
    const p = makePiece(s, "33028");
    s = finish(native(s, ...cyclopsBoost(s, p)!));
    expect(s.player.hp).toBe(before - 2);
  });
  it("Dust optionally attacks all minions once and takes two consequential damage", () => {
    let s = base();
    const dust = put(s, "33012"),
      m1 = minion(s, "01103"),
      m2 = minion(s, "01103");
    s = use(s, dust, m1.id);
    s = choose(s, "all");
    s = finish(s);
    expect(s.minions.find((p) => p.id === m1.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === m2.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === dust.id)?.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === dust.id)?.exhausted).toBe(true);
  });
  it("Coordinated Attack reduces consequence for the actual attacked minion even after its defeat", () => {
    let s = base();
    const ally = put(s, "33019"),
      m = minion(s, "01103", undefined, 1);
    attached(s, "33016", m.id);
    s = finish(use(s, ally, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
  });
  it("Marked gives overkill to a native basic ally attack", () => {
    let s = base();
    const ally = put(s, "33013"),
      m = minion(s, "01103", undefined, 2);
    attached(s, "33032", m.id);
    s = finish(use(s, ally, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(48);
  });
  it("Befuddle optionally substitutes current hero THW for current ATK", () => {
    let s = base();
    const m = minion(s, "01103");
    attached(s, "33033", m.id);
    s = basic(s, m.id);
    s = finish(choose(s, "thw"));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
  });
  it("Pinned Down reduces only its attached minion's ATK", () => {
    const s = base();
    const m = minion(s, "01103");
    attached(s, "33034", m.id);
    expect(enemyStats(s, m).attack).toBe((card(m).attack || 0) - 2);
    expect(enemyStats(s, s.villain).attack).toBe(card(s.villain).attack);
  });
  it("Teamwork's original printing exhausts an ally, boosts basic attack and enters discard", () => {
    let s = base();
    const ally = put(s, "33019"),
      [teamwork] = hand(s, "33017");
    s = basic(s, s.villain.id);
    s = choose(s, teamwork.id);
    s = target(s, ally.id);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    expect(s.player.discard.some((p) => p.id === teamwork.id)).toBe(true);
  });
  it.each(["33023", "34023"])(
    "Psychic Rapport printing %s readies both named characters and returns an actual Cyclops card",
    (code) => {
      let s = base();
      const phoenix = put(s, "33002");
      phoenix.exhausted = true;
      s.player.exhausted = true;
      const sig = s.player.deck.splice(
        s.player.deck.findIndex((p) => p.code === "33009"),
        1,
      )[0];
      s.player.discard.push(sig);
      const [event, r] = hand(s, code, "33024");
      s = play(s, event, [r]);
      s = target(s, "recover");
      s = finish(target(s, sig.id));
      expect(s.player.exhausted).toBe(false);
      expect(s.player.inPlay.find((p) => p.id === phoenix.id)?.exhausted).toBe(
        false,
      );
      expect(s.player.hand.some((p) => p.id === sig.id)).toBe(true);
    },
  );
  it("Shadows of the Past uses all five original nemesis IDs and gives Sinister Tough", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = finish(native(s, ...cyclopsShadowOfPast(s)!));
    expect(s.player.setAside).toHaveLength(0);
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
    ];
    for (const id of ids)
      expect(all.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.minions.find((p) => p.code === "33028")?.tough).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "33029")?.counters).toBe(2);
  });
  it("Genetic Manipulation defeat reveals one actual Gene Therapy then shuffles", () => {
    let s = base();
    const scheme = makePiece(s, "33029"),
      therapy = makePiece(s, "33030");
    scheme.counters = 1;
    s.sideSchemes.push(scheme);
    s.encounter.discard.push(therapy);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 1,
      source: "hero",
      action: true,
    });
    s = finish(target(s, s.villain.id));
    expect(s.attachments.find((p) => p.id === therapy.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.sideSchemes).toHaveLength(0);
  });
  it.each(["hero", "alter"] as const)(
    "Concussive Force in %s form follows its missing-Sinister clause",
    (form) => {
      let s = base();
      s.player.form = form;
      const hp = s.player.hp;
      s = finish(reveal(s, "33031").s);
      expect(s.player.hp).toBe(hp - (form === "hero" ? 2 : 0));
      expect(s.scheme.threat).toBe(8 + (form === "alter" ? 2 : 0));
    },
  );
});
