/** MojoMania's Crime, Fantasy and Western modular sets, exercised with the
 * original physical cards in another scenario. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  card,
  handSize,
  heroStats,
  pieceHP,
} from "../src/game/cards";
import { abilityOptions, newGame, targets } from "../src/game/engine";
import {
  MOJO_GENRE_SCRIPT_CODES,
  mojoGenreDamage,
  mojoGenreOverkill,
} from "../src/game/mojo-genres";
import { hasExecutableScript } from "../src/game/script-registry";
import type { Card, Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(module: string) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    difficulty: "standard",
    seed: 39035,
    pacing: "expert",
    heroes: [{ heroId: "spider_man", aspect: "justice" }],
    module,
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(module: string) {
  let s = settle(setup(module));
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  s.player.deck.push(...s.player.hand.splice(0));
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code), actorId: "p1" });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
const hit = (target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  source: "hero",
});
const withResource = (r: string): Card =>
  ({ code: "x", name: "x", [`resource_${r}`]: 1 }) as unknown as Card;

describe("MojoMania genre sets: original source", () => {
  it("registers every face of Crime, Fantasy and Western", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "mojo" &&
        ["crime", "fantasy", "western"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(17);
    expect(new Set(MOJO_GENRE_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["crime", "fantasy", "western"]),
    );
    for (const module of ["crime", "fantasy", "western"]) {
      const s = settle(setup(module));
      expect(s.modules).toEqual([module]);
      expect(
        s.encounter.deck.filter((p) => card(p).set_code === module).length,
        module,
      ).toBe(6);
    }
  });
});

describe("Crime", () => {
  it("Dial M for Mojo surges, gives +1 THW and incite 1 to other encounter cards", () => {
    let s = started("crime");
    const thw = heroStats(s).thwart;
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "39035"));
    expect(s.environments?.some((p) => p.code === "39035")).toBe(true);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(heroStats(s).thwart).toBe(thw + 1);
    const threat = s.scheme.threat;
    s = settle(reveal(s, "39040"));
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1);
  });
  it("Crime Scene Investigation keeps threat on the other schemes and has a Hero Action", () => {
    let s = started("crime");
    s.scheme.threat = 3;
    s = settle(reveal(s, "39037"));
    const csi = s.sideSchemes.find((p) => p.code === "39037")!;
    expect(csi.counters).toBe(6);
    s = settle(
      native(s, { type: "thwart", target: "main", amount: 2, source: "hero" }),
    );
    expect(s.scheme.threat).toBe(3);
    expect(abilityOptions(s, csi)).toHaveLength(0);
    // Hero Action: spend X mental resources to remove X threat from it.
    const mentals = s.player.deck
      .filter((p) => card(p).resource_mental === 1 && !card(p).resource_wild)
      .slice(0, 2);
    expect(mentals).toHaveLength(2);
    s.player.deck = s.player.deck.filter((p) => !mentals.includes(p));
    s.player.hand.push(...mentals);
    expect(abilityOptions(s, csi)).toHaveLength(1);
    s = command(s, { type: "ABILITY", id: csi.id, action: "remove" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["x1", "x2"]);
    s = choose(s, "x2");
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: mentals.map((p) => p.id) }));
    expect(s.sideSchemes.find((p) => p.id === csi.id)?.counters).toBe(4);
    expect(s.scheme.threat).toBe(3);
    expect(s.player.hand).toHaveLength(0);
  });
  it("Crime Scene Investigation also keeps threat on Tower Defense's other main scheme", () => {
    let s = settle(
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "tower_defense",
        difficulty: "standard",
        seed: 39037,
        pacing: "expert",
        heroes: [{ heroId: "spider_man", aspect: "justice" }],
        module: "crime",
      }),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s.scheme.threat = 3;
    s.towerDefense!.other.scheme.threat = 3;
    s = reload(s);
    const ids = (thwarting: boolean) =>
      targets(s, "scheme", false, thwarting).map((t) => t.id);
    expect(ids(true)).toEqual(expect.arrayContaining(["main", "tower:main"]));
    s = settle(reveal(s, "39037"));
    const scene = s.sideSchemes.find((p) => p.code === "39037")!;
    expect(ids(true)).toEqual([scene.id]);
    expect(ids(false)).toEqual(
      expect.arrayContaining(["main", "tower:main", scene.id]),
    );
  });
  it("Elementary, My Dear Mojo cannot move the threat Crime Scene Investigation keeps in place", () => {
    let s = started("crime");
    s = settle(reveal(s, "39039"));
    s = settle(reveal(s, "39037"));
    const dragnet = s.sideSchemes.find((p) => p.code === "39039")!;
    const scene = s.sideSchemes.find((p) => p.code === "39037")!;
    const [held, moved, main] = [
      dragnet.counters,
      scene.counters,
      s.scheme.threat,
    ];
    let offered: string[] = [];
    s = settle(reveal(s, "39040"), (s) => {
      if (s.prompt?.title !== "Elementary, My Dear Mojo") return undefined;
      offered = s.prompt.options.map((o) => o.id);
      return scene.id;
    });
    expect(offered).toEqual([scene.id, "dig"]);
    expect(s.sideSchemes.some((p) => p.id === scene.id)).toBe(false);
    expect(s.scheme.threat).toBe(main + moved);
    expect(s.sideSchemes.find((p) => p.id === dragnet.id)?.counters).toBe(held);
  });
  it("Law & Order gives -2 ATK and Dragnet keeps the villain from taking damage", () => {
    let s = started("crime");
    const atk = heroStats(s).attack;
    s = settle(reveal(s, "39038"));
    expect(heroStats(s).attack).toBe(atk - 2);
    s = settle(reveal(s, "39039"));
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(hp);
  });
  it("Build the Case leaves after three side schemes are defeated", () => {
    let s = started("crime");
    s = settle(reveal(s, "39036"));
    expect(s.player.inPlay.some((p) => p.code === "39036")).toBe(true);
    for (const code of ["39037", "39038", "39039"]) {
      s = settle(reveal(s, code));
      const q = s.sideSchemes.find((p) => p.code === code)!;
      s = settle(
        native(s, { type: "thwart", target: q.id, amount: 20, source: "hero" }),
      );
    }
    expect(s.player.inPlay.some((p) => p.code === "39036")).toBe(false);
  });
});

describe("Fantasy", () => {
  it("the fantasy minions read the printed resources of the card dealing damage", () => {
    let s = started("fantasy");
    s = settle(reveal(s, "39042"));
    s = settle(reveal(s, "39044"));
    const dragon = s.minions.find((p) => p.code === "39042")!;
    const troll = s.minions.find((p) => p.code === "39044")!;
    expect(mojoGenreDamage(s, dragon.id, 2, withResource("energy"))).toBe(4);
    expect(mojoGenreDamage(s, dragon.id, 2, withResource("mental"))).toBe(2);
    expect(mojoGenreDamage(s, troll.id, 2, withResource("mental"))).toBe(3);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = settle(reveal(s, "39043"));
    const goblin = s.minions.find((p) => p.code === "39043")!;
    expect(mojoGenreDamage(s, goblin.id, 2, withResource("energy"))).toBe(0);
    expect(mojoGenreDamage(s, goblin.id, 2, withResource("physical"))).toBe(2);
    expect(mojoGenreDamage(s, goblin.id, 2, undefined)).toBe(0);
  });
  it("A Game of Mojo's gives +1 hand size; Mana Drain empties a resource type from hands", () => {
    let s = started("fantasy");
    const size = handSize(s);
    s = settle(reveal(s, "39041"));
    expect(handSize(s)).toBe(size + 1);
    s = settle(
      reveal(s, "39046"),
      (s) => s.prompt?.options.find((o) => o.id === "energy")?.id,
    );
    expect(s.player.hand.some((p) => (card(p).resource_energy || 0) > 0)).toBe(
      false,
    );
  });
  it("the Dragon's defeat draws each player 4 cards", () => {
    let s = started("fantasy");
    s = settle(reveal(s, "39042"));
    const dragon = s.minions.find((p) => p.code === "39042")!;
    const hand = s.player.hand.length;
    for (let n = 0; n < 2; n++) s = settle(native(s, hit(dragon.id, 40)));
    expect(s.minions.some((p) => p.code === "39042")).toBe(false);
    expect(s.player.hand.length).toBe(hand + 4);
  });
  it("Fetch Quest's defeat plays a card from your deck, ignoring its resource cost", () => {
    let s = started("fantasy");
    s = settle(reveal(s, "39045"));
    const quest = s.sideSchemes.find((p) => p.code === "39045")!;
    const allies = s.player.deck.filter((p) => card(p).type_code === "ally");
    expect(allies.length).toBeGreaterThan(0);
    const deck = s.player.deck.length;
    let offered: string[] = [];
    let played = "";
    s = settle(
      native(s, {
        type: "thwart",
        target: quest.id,
        amount: 20,
        source: "hero",
      }),
      (s) => {
        if (s.prompt?.title !== "Fetch Quest") return undefined;
        offered = s.prompt.options.map((o) => o.id);
        played = s.prompt.options.find(
          (o) => o.id !== "pass" && card(o.image!).type_code === "ally",
        )!.id;
        return played;
      },
    );
    expect(offered).toContain("pass");
    expect(s.prompt).toBeNull();
    expect(s.sideSchemes.some((p) => p.code === "39045")).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === played)).toBe(true);
    expect(s.player.deck).toHaveLength(deck - 1);
    expect(s.player.deck.some((p) => p.id === played)).toBe(false);
  });
});

describe("Western", () => {
  it("Wild Wild Mojo gives enemy attacks overkill and each character 1 more damage", () => {
    let s = started("western");
    s = settle(reveal(s, "39066"));
    expect(mojoGenreOverkill(s, s.villain)).toBe(true);
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(s.villain.hp).toBe(hp - 3);
  });
  it("Dead or Alive strengthens the toughest minion and returns cards when it falls", () => {
    let s = started("western");
    s = settle(reveal(s, "39068"));
    const shark = s.minions.find((p) => p.code === "39068")!;
    const base = pieceHP(s, shark);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = settle(reveal(s, "39067"));
    expect(s.attachments.find((p) => p.code === "39067")?.attachedTo).toBe(
      shark.id,
    );
    expect(pieceHP(s, shark)).toBe(base + 3);
    s.player.discard.push(s.player.deck.shift()!);
    const hand = s.player.hand.length;
    s = settle(native(s, hit(shark.id, 40)));
    expect(s.minions.some((p) => p.code === "39068")).toBe(false);
    expect(s.player.hand.length).toBe(hand + 1);
  });
  it("Card Shark mills 3 and deals indirect damage for each printed resource type", () => {
    let s = started("western");
    s = settle(reveal(s, "39068"));
    const shark = s.minions.find((p) => p.code === "39068")!;
    const discard = s.player.discard.length;
    stack(s, "01186");
    s = settle(native(s, { type: "enemyAttack", id: shark.id, actorId: "p1" }));
    expect(s.player.discard.length).toBeGreaterThanOrEqual(discard + 3);
  });
  it("A Game of Cards draws 5 and discards 5", () => {
    let s = started("western");
    s = settle(reveal(s, "39070"));
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.discard.length).toBeGreaterThanOrEqual(5);
  });
});
