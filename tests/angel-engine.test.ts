import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  card,
  deckCodes,
  heroCard,
  heroStats,
  maxHP,
  resources,
} from "../src/game/cards.js";
import {
  cardCost,
  enemyStats,
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
} from "../src/game/engine.js";
import { deckErrors } from "../src/game/decks.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { angelPlayerSideSchemeDefeated } from "../src/game/angel.js";
import { seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  native,
  play,
  pay,
  respond,
  reload,
  target,
  hand,
  put,
  minion,
  side,
  top,
  attach,
  until,
} from "./dv-test-helpers.js";

function starting(aspect: Aspect = "protection", teammate = false) {
  return newGame({
    heroId: "angel",
    aspect,
    villainId: "rhino",
    module: "bomb_scare",
    pacing: "expert",
    seed: 42001,
    ...(teammate
      ? {
          heroes: [
            { heroId: "angel", aspect, deckCards: heroStarterCodes("angel") },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(
  form: "angel" | "archangel" | "alter" = "angel",
  teammate = false,
) {
  let s = starting("protection", teammate);
  for (let i = 0; s.phase === "mulligan" && i < 3; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (form !== "alter") s = finish(command(s, { type: "FLIP", target: form }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.flipped = false;
  s.villain.hp = s.villain.maxHp = 60;
  s.scheme.threat = 10;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function cast(s: GameState, code: string, ...payment: string[]) {
  const cards = hand(s, code, ...payment);
  return play(s, cards[0], cards.slice(1));
}
function reveal(s: GameState, code: string) {
  const reserve = s.player.setAside || [],
    i = reserve.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i >= 0 ? reserve.splice(i, 1)[0] : makePiece(s, code),
  });
}
function yes(s: GameState, title: RegExp) {
  return respond(s, title);
}
function borrowedEvent(code: string, ...paymentCodes: string[]) {
  let s = newGame({
    heroId: "gambit",
    aspect: "justice",
    villainId: "rhino",
    module: "bomb_scare",
    pacing: "expert",
    seed: 42009,
    heroes: [
      { heroId: "gambit", aspect: "justice" },
      { heroId: "angel", aspect: "protection" },
    ],
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(command(finish(s), { type: "FLIP" }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 60;
  s.scheme.threat = 10;
  const payments = hand(s, ...paymentCodes);
  const owner = seatView(s, "p2").player;
  const zone = [owner.deck, owner.hand, owner.discard].find((cards) =>
    cards.some((p) => p.code === code),
  )!;
  const event = zone.splice(
    zone.findIndex((p) => p.code === code),
    1,
  )[0];
  expect(event.ownerId).toBe("p2");
  s.player.hand.push(event);
  return { s, event, payments };
}

describe("Angel source and three identity forms", () => {
  it("registers the complete 34 faces with original40, five physical nemesis cards and no invented reserves", () => {
    const faces = catalog.filter((c) => c.pack_code === "angel");
    expect(faces).toHaveLength(34);
    expect(faces.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    const s = starting();
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.deck).toHaveLength(34);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "42025",
      "42026",
      "42027",
      "42028",
      "42028",
    ]);
    expect(heroStarterCodes("angel")).toHaveLength(40);
  });
  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "builds and starts a legal %s deck",
    (aspect) => {
      const codes = deckCodes("angel", aspect);
      expect(deckErrors("angel", aspect, codes)).toEqual([]);
      expect(starting(aspect).heroId).toBe("angel");
    },
  );
  it("exposes actual Archangel flip, saves the third face and preserves the one voluntary change", () => {
    let s = command(starting(), { type: "MULLIGAN", ids: [] });
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.options.map((o) => o.image)).toEqual(["42001a", "42001c"]);
    s = choose(reload(s), "archangel");
    expect(heroCard(s).code).toBe("42001c");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 0, defense: 3 });
    expect(s.player.flipped).toBe(true);
    s = finish(
      target(
        command(reload(s), { type: "BASIC", action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.player.exhausted).toBe(true);
  });
  it("Regrowth heals one once per round without exhaustion", () => {
    let s = base("alter");
    s.player.hp = 9;
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "regrowth" }),
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
  });
  it("Archangel adds one actual acceleration, Angel does not", () => {
    let s = base("archangel");
    s.scheme.threat = 0;
    s = finish(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(2);
    s = finish(command(s, { type: "FLIP", target: "angel" }));
    s.scheme.threat = 0;
    s = finish(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(1);
  });
});

describe("Angel signatures and play timing", () => {
  it("Angel of Life responds after a paid Aerial event and is once per phase", () => {
    let s = base();
    s = cast(s, "42006", "42022");
    s = target(s, "main");
    s = yes(s, /Angel of Life/);
    s = finish(s);
    expect(s.scheme.threat).toBe(6);
    expect(s.player.hand).toHaveLength(1);
    s = cast(s, "42006", "42022");
    s = finish(target(s, "main"));
    expect(s.player.hand).toHaveLength(0);
  });
  it("Archangel uses printed event cost, separately from a Wings discount", () => {
    let s = base("archangel");
    const wings = put(s, "42010");
    s = finish(command(s, { type: "ABILITY", id: wings.id, action: "wings" }));
    const [event, payment] = hand(s, "42007", "42003");
    expect(cardCost(s, card(event), event)).toBe(1);
    s = target(play(s, event, [payment]), s.villain.id);
    s = yes(s, /Angel of Death/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(51);
    expect(s.flags.angelWingsDiscount).toBeUndefined();
  });
  it("Adaptive Plumage uses only the current form's action label", () => {
    let s = base();
    s.player.stunned = true;
    s = cast(s, "42003", "42022", "42009");
    s = target(s, "main");
    s = finish(target(s, s.villain.id));
    expect(s.scheme.threat).toBe(7);
    expect(s.villain.confused).toBe(true);
    expect(s.player.stunned).toBe(true);
    s = base("archangel");
    s.player.confused = true;
    s = finish(target(cast(s, "42003", "42022", "42009"), s.villain.id));
    expect(s.villain.hp).toBe(56);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
  });
  it("Metamorphosis changes a hero face after voluntary flip and resolves the destination nonattack effect", () => {
    let s = base();
    s.player.flipped = true;
    s.player.stunned = true;
    s = cast(s, "42005", "42022");
    s = choose(s, "archangel");
    s = finish(target(s, s.villain.id));
    expect(heroCard(s).code).toBe("42001c");
    expect(s.villain.hp).toBe(57);
    expect(s.player.stunned).toBe(true);
    expect(s.player.flipped).toBe(true);
  });
  it("Natural Flight ignores both crisis and patrol only as Angel", () => {
    let s = base();
    side(s, "01108", 3);
    minion(s, "16119");
    s = cast(s, "42006", "42022");
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(6);
  });
  it("Avian Anatomy returns the same physical event after resolving and survives a saved payment response", () => {
    let s = base();
    const [event, anatomy, resource] = hand(s, "42006", "42008", "42009");
    s = play(s, event, [anatomy, resource]);
    s = yes(s, /Avian Anatomy/);
    s = finish(target(reload(s), "main"));
    expect(s.player.hand.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === anatomy.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
  });
  it("Worthington Industries shuffles the chosen original Aerial card and draws only in alter ego", () => {
    let s = base("alter");
    const support = put(s, "42009"),
      cards = hand(s, "42006");
    s.player.discard.push(...s.player.hand.splice(0));
    const seed = s.seed;
    s = command(s, { type: "ABILITY", id: support.id, action: "industries" });
    s = finish(target(s, cards[0].id));
    expect(s.seed).not.toBe(seed);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    expect(
      [...s.player.hand, ...s.player.deck].filter((p) => p.id === cards[0].id),
    ).toHaveLength(1);
  });
  it("Aerial Agility ignores numeric boosts and boost abilities in Angel form", () => {
    let s = base();
    const cards = hand(s, "42004", "42009");
    s.encounter.deck.unshift(makePiece(s, "01131"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Aerial Agility/);
    s = pay(s, [cards[1]]);
    s = finish(s);
    expect(s.player.hp).toBe(10);
    expect(s.villain.tough).toBe(false);
    expect(s.player.discard.some((p) => p.id === cards[0].id)).toBe(true);
  });
  it("Aerial Agility in Archangel grants Tough and retaliate for this actual attack only", () => {
    let s = base("archangel");
    const cards = hand(s, "42004", "42009");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Aerial Agility/);
    s = finish(pay(s, [cards[1]]));
    expect(s.player.hp).toBe(12);
    expect(s.player.tough).toBe(false);
    expect(s.villain.hp).toBe(59);
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.hp).toBe(59);
  });
});

describe("Angel events borrowed by another identity", () => {
  it.each(["crisis", "patrol"] as const)(
    "Natural Flight keeps its base thwart but does not bypass %s for a different identity",
    (blocker) => {
      let { s, event, payments } = borrowedEvent("42006", "01088");
      const scheme = side(s, blocker === "crisis" ? "01108" : "01109", 8);
      if (blocker === "patrol") minion(s, "16119");
      s = play(s, event, payments);
      expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
      s = finish(target(reload(s), scheme.id));
      expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(4);
      expect(s.scheme.threat).toBe(10);
      expect(s.player.hand).toHaveLength(0);
      expect(
        seatView(s, "p2").player.discard.some((p) => p.id === event.id),
      ).toBe(true);
    },
  );
  it("Metamorphosis changes the borrower's actual form without named identity rewards", () => {
    let { s, event, payments } = borrowedEvent("42005", "01088");
    const teammateHand = seatView(s, "p2").player.hand.length;
    s = finish(play(reload(s), event, payments));
    expect(heroCard(s).code).toBe("37001b");
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(true);
    expect(s.player.angelForm).toBeUndefined();
    expect(s.player.hand).toHaveLength(0);
    expect(s.scheme.threat).toBe(10);
    expect(s.villain.hp).toBe(60);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(seatView(s, "p2").player.hand).toHaveLength(teammateHand);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
  });
  it("Adaptive Plumage requires one of its printed named forms", () => {
    const { s, event } = borrowedEvent("42003", "01088", "01089");
    expect(playable(s, event)).toMatch(/Angel or Archangel form/);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
  });
  it("borrowed Aerial Agility does not offer a defense mode to another identity", () => {
    let { s, event } = borrowedEvent("42004", "01088");
    s.encounter.deck = Array.from({ length: 5 }, () => makePiece(s, "01104"));
    const hp = s.player.hp;
    const seen: string[] = [];
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }), (q) => {
      seen.push(...(q.prompt?.options.map((o) => o.image || "") || []));
      return q.prompt?.options.find(
        (o) => o.id === "take" || o.id === "resolve",
      )?.id;
    });
    expect(seen).not.toContain("42004");
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.hp).toBeLessThan(hp);
  });
});

describe("Angel player pool", () => {
  it("The Power of Flight doubles for Aerial, including non-Basic, and never arbitrary Basic cards", () => {
    expect(resources(card("42022"), card("42006"))).toEqual([
      "energy",
      "energy",
    ]);
    expect(resources(card("42022"), card("42012"))).toHaveLength(2);
    expect(resources(card("42022"), card("01088"))).toHaveLength(1);
  });
  it("Psylocke readies Archangel after her actual attack", () => {
    let s = base("archangel");
    const ally = put(s, "42002");
    s.player.exhausted = true;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      s.villain.id,
    );
    s = finish(yes(s, /Psylocke/));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Cannonball counts actual Aerial cards in hand for consequential damage", () => {
    let s = base();
    const ally = put(s, "42020");
    hand(s, "42006", "42003");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      s.villain.id,
    );
    s = finish(choose(s, "reduce"));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
  });
  it("Siryn stuns a selected minion after an actual attack", () => {
    let s = base();
    const ally = put(s, "42012"),
      m = minion(s);
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      s.villain.id,
    );
    s = yes(s, /Siryn/);
    s = finish(target(s, m.id));
    expect(s.minions.find((p) => p.id === m.id)?.stunned).toBe(true);
  });
  it("Elixir checks identity traits and heals another friendly character", () => {
    let s = base("alter");
    const [elixir] = hand(s, "42011", "01088", "01089");
    expect(playable(s, elixir)).toContain("trait");
    s = base();
    const ally = put(s, "42011");
    s.player.hp = 10;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    s = yes(s, /Elixir/);
    s = finish(target(s, "hero"));
    expect(s.player.hp).toBe(11);
  });
  it("Soaring Acrobatics boosts one basic attack and exhausts the actual upgrade", () => {
    let s = base();
    const upgrade = put(s, "42023");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, upgrade.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(58);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
      true,
    );
  });
  it("Taunt allows only the acting hero to defend, then draws three after the attack", () => {
    let s = base("angel", true);
    put(s, "42020");
    s = cast(s, "42016", "42009");
    s = until(s, (q) => !!q.prompt?.title.includes("attacks"));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["take", "hero"]);
    s = finish(choose(s, "take"));
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.hp).toBe(10);
  });
  it("Aerial Intervention exhausts an owned Aerial character and prevents attack damage", () => {
    let s = base();
    const [event] = hand(s, "42014");
    const ally = put(s, "42020");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Aerial Intervention/);
    s = finish(target(s, ally.id));
    expect(s.player.hp).toBe(12);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Angel's Aerie gains fatigue after defense and heals in alter ego", () => {
    let s = base();
    const support = put(s, "42018");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (q) => !!q.prompt?.options.some((o) => o.id === "hero"));
    s = choose(s, "hero");
    s = finish(yes(s, /Angel's Aerie/));
    expect(s.player.inPlay.find((p) => p.id === support.id)?.counters).toBe(1);
    s.player.hp = 10;
    s = finish(command(s, { type: "FLIP", target: "alter" }));
    s = finish(
      command(s, { type: "ABILITY", id: support.id, action: "aerie" }),
    );
    expect(s.player.hp).toBe(11);
  });
  it("Containment Strategy attaches to one actual scheme and removes two after an undamaged hero defense", () => {
    let s = base();
    const scheme = side(s, "01107", 4);
    s = finish(target(cast(s, "42019", "42009"), scheme.id));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (q) => !!q.prompt?.options.some((o) => o.id === "hero"));
    s = choose(s, "hero");
    s = finish(yes(s, /Containment Strategy/));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
  });
  it("Bombs Away is simultaneous nonattack damage paid by exhausting an Aerial character", () => {
    let s = base();
    s.player.stunned = true;
    const m = minion(s);
    m.damage = 0;
    s = cast(s, "42029", "42022");
    s = target(s, "hero");
    s = finish(choose(s, "p1"));
    expect(s.villain.hp).toBe(57);
    expect(s.player.stunned).toBe(true);
    expect(s.player.exhausted).toBe(true);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
  });
  it("Flying Formation readies up to three distinct Aerial characters", () => {
    let s = base();
    const ally = put(s, "42020");
    ally.exhausted = true;
    s.player.exhausted = true;
    s = cast(s, "42031", "42022", "42022");
    s = target(s, "hero");
    s = finish(target(s, ally.id));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
  });
  it("Eyes in the Sky cancels and discards the actual non-Elite minion before its effects", () => {
    let s = base();
    const upgrade = put(s, "42030"),
      ally = put(s, "42020"),
      m = makePiece(s, "01103");
    s = native(s, { type: "reveal", piece: m });
    s = respond(s, /Eyes in the Sky/);
    s = finish(target(s, ally.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === m.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(true);
  });
  it("X-Force Recruit grants health on the actual target and removes the same health on leaving", () => {
    let s = base();
    const [upgrade] = hand(s, "42032");
    s = finish(target(play(s, upgrade), "hero"));
    expect(maxHP(s)).toBe(13);
    expect(s.player.hp).toBe(13);
    s = finish(native(s, { type: "discardPiece", id: upgrade.id }));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(12);
  });
});

describe("Angel obligation and nemesis", () => {
  it("Apocalyptic Influence changes to Archangel, adds a physical hazard obligation, and discards after paying its AE cost", () => {
    let s = base("alter");
    s = finish(reveal(s, "42024"));
    expect(heroCard(s).code).toBe("42001c");
    const obligation = s.player.inPlay.find((p) => p.code === "42024")!;
    s = finish(command(s, { type: "FLIP", target: "alter" }));
    const dealt = s.encounter.dealt.length;
    s = finish(
      command(s, { type: "ABILITY", id: obligation.id, action: "influence" }),
    );
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
  });
  it("Harpoon discards through the first original event and deals its printed cost as indirect damage", () => {
    let s = base();
    top(s, "42003");
    top(s, "42009");
    const hp = s.player.hp;
    s = finish(
      reveal(s, "42025"),
      (q) => q.prompt?.options.find((o) => o.id === "hero")?.id,
    );
    expect(s.player.hp).toBe(hp - 3);
    const harpoon = s.minions.find((p) => p.code === "42025")!;
    expect(enemyStats(s, harpoon).attack).toBe(2);
    s = finish(command(s, { type: "FLIP", target: "alter" }));
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === harpoon.id)!,
      ).attack,
    ).toBe(1);
  });
  it("Hook, Line, and Sinker exhausts each character actually damaged by indirect damage, excluding Tough prevention", () => {
    let s = base();
    side(s, "42026", 2);
    const ally = put(s, "42020");
    ally.tough = true;
    s = native(s, { type: "angel:indirect", amount: 2, source: "42028" });
    s = choose(s, ally.id);
    s = finish(choose(s, "hero"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(false);
  });
  it("Hook, Line, and Sinker converts a printed Brute attack into saved indirect allocation", () => {
    let s = base();
    side(s, "42026", 2);
    const harpoon = minion(s, "42025"),
      ally = put(s, "42020"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: harpoon.id });
    s = choose(s, "take");
    s = choose(s, "hero");
    s = finish(choose(reload(s), ally.id));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.attack).toBeNull();
  });
  it("Harpoon's Harpoon searches and attaches the physical source, then adds indirect damage after an attack", () => {
    let s = base();
    const h = makePiece(s, "42025");
    s.encounter.discard.push(h);
    top(s, "42004");
    s = finish(
      reveal(s, "42027"),
      (q) => q.prompt?.options.find((o) => o.id === "hero")?.id,
    );
    expect(s.attachments.find((p) => p.code === "42027")?.attachedTo).toBe(
      h.id,
    );
    s = finish(
      native(s, { type: "enemyAttack", id: h.id }),
      (q) =>
        q.prompt?.options.find((o) => o.id === "take" || o.id === "hero")?.id,
    );
    expect(s.player.hp).toBe(6);
  });
  it("Render Medical Aid allocates exactly five healing per seat without moving the defeated physical PSS", () => {
    let s = base("angel", true);
    const scheme = side(s, "42017", 0),
      ally = put(s, "42020");
    ally.damage = 1;
    s.player.hp = 7;
    seatView(s, "p2").player.hp = 5;
    s = native(s, ...angelPlayerSideSchemeDefeated(s, scheme));
    s = finish(s, (q) => q.prompt?.options.find((o) => o.id === "hero")?.id);
    expect(s.player.hp).toBe(12);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(true);
  });
});
