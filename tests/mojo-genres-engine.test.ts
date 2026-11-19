/** MojoMania's six genre modular sets, exercised with the original
 * physical cards in another scenario. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  card,
  handSize,
  heroStats,
  pieceHP,
} from "../src/game/cards";
import {
  abilityOptions,
  allyLimit,
  cardCost,
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  targets,
} from "../src/game/engine";
import { isTextBlank } from "../src/game/card-text";
import {
  MOJO_GENRE_SCRIPT_CODES,
  mojoGenreAcceleration,
  mojoGenreBoost,
  mojoGenreDamage,
  mojoGenreKeyword,
  mojoGenreOverkill,
  mojoGenrePeril,
  mojoGenreRoundEnded,
} from "../src/game/mojo-genres";
import { hasExecutableScript } from "../src/game/script-registry";
import type { Card, Effect, GameState } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  play,
  put,
  reload,
} from "./dv-test-helpers";

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

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
describe("MojoMania genre sets: original source", () => {
  it("registers every face of the six genre sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) => c.pack_code === "mojo" && GENRES.includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(36);
    expect(new Set(MOJO_GENRE_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(MODULES.map((m) => m.id)).toEqual(expect.arrayContaining(GENRES));
    for (const module of GENRES) {
      const s = settle(setup(module));
      expect(s.modules).toEqual([module]);
      expect(
        s.encounter.deck.filter((p) => card(p).set_code === module).length,
        module,
      ).toBe(module === "sci-fi" ? 7 : 6);
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

const pick = (id: string) => (s: GameState) =>
  s.prompt?.options.some((o) => o.id === id) ? id : undefined;
function inHand(s: GameState, ...codes: string[]) {
  return codes.map((code) => {
    const i = s.player.deck.findIndex((p) => p.code === code);
    expect(i, code).toBeGreaterThanOrEqual(0);
    const [p] = s.player.deck.splice(i, 1);
    s.player.hand.push(p);
    return p;
  });
}
function alterEgo(s: GameState) {
  s.player.form = "alter";
  s.player.exhausted = false;
  return reload(s);
}

describe("Horror", () => {
  it("The Mojo Files gives each minion quickstrike, and Vampire toughens after damaging you unhurt", () => {
    let s = started("horror");
    s = settle(reveal(s, "39047"));
    expect(s.environments?.some((p) => p.code === "39047")).toBe(true);
    const hp = s.player.hp;
    s = settle(reveal(s, "39051"));
    const vampire = s.minions.find((p) => p.code === "39051")!;
    expect(mojoGenreKeyword(s, vampire, "Quickstrike")).toBe(true);
    expect(s.player.hp).toBe(hp - 2);
    expect(vampire.tough).toBe(true);
  });
  it("The Mojo Files: an ally takes 1 less consequential damage after attacking a minion", () => {
    let s = started("horror");
    const jessica = put(s, "01059");
    s = settle(reveal(s, "39049"));
    const cultist = s.minions.find((p) => p.code === "39049")!;
    s = settle(
      command(s, { type: "ABILITY", id: jessica.id, action: "attack" }),
      pick(cultist.id),
    );
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.damage).toBe(1);
    s.player.inPlay.find((p) => p.id === jessica.id)!.exhausted = false;
    s.player.inPlay.find((p) => p.id === jessica.id)!.damage = 0;
    s = settle(reveal(s, "39047"));
    s = settle(
      command(reload(s), { type: "ABILITY", id: jessica.id, action: "attack" }),
      pick(cultist.id),
    );
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.damage).toBe(0);
  });
  it("Bandolier of Stakes attaches for a resource and adds +1 ATK and piercing to basic attacks", () => {
    let s = started("horror");
    const [energy] = inHand(s, "01088");
    s = reveal(s, "39048");
    // Its When Revealed text and Surge share the reveal window.
    s = choose(s, "text");
    expect(s.prompt?.title).toBe("Bandolier of Stakes");
    s = choose(s, "attach");
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: [energy.id] }));
    const bandolier = s.attachments.find((p) => p.code === "39048")!;
    expect(bandolier.attachedTo).toBe("hero:p1");
    expect(bandolier.counters).toBe(3);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const hp = s.villain.hp;
    s = settle(
      command(reload(s), { type: "BASIC", action: "attack" }),
      (s) => pick("stake")(s) || pick(s.villain.id)(s),
    );
    expect(s.villain.hp).toBe(hp - (heroStats(s).attack + 1));
    expect(s.villain.tough).toBe(false);
    expect(s.attachments.find((p) => p.code === "39048")?.counters).toBe(2);
  });
  it("Bandolier of Stakes is discarded without payment", () => {
    let s = started("horror");
    s = settle(reveal(s, "39048"), pick("pass"));
    expect(s.attachments.some((p) => p.code === "39048")).toBe(false);
    expect(s.encounter.discard.some((p) => p.code === "39048")).toBe(true);
  });
  it("Cultist brings The Kraken engaged with you and leaves; The Kraken damages every other character", () => {
    let s = started("horror");
    s = settle(reveal(s, "39049"));
    const cultist = s.minions.find((p) => p.code === "39049")!;
    s = settle(
      native(s, { type: "enemyAttack", id: cultist.id, actorId: "p1" }),
    );
    expect(s.minions.some((p) => p.code === "39049")).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === cultist.id)).toBe(true);
    const kraken = s.minions.find((p) => p.code === "39050")!;
    expect(kraken.engagedWith).toBe("p1");
    const jessica = put(s, "01059");
    const villain = s.villain.hp;
    const hp = s.player.hp;
    s = settle(
      native(s, { type: "enemyAttack", id: kraken.id, actorId: "p1" }),
    );
    expect(s.villain.hp).toBe(villain - 1);
    expect(s.player.hp).toBe(hp - 2 - 1);
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.damage).toBe(1);
    const hurt = s.player.hp;
    s = settle(native(s, hit(kraken.id, 40)));
    expect(s.minions.some((p) => p.id === kraken.id)).toBe(false);
    expect(s.player.hp).toBe(hurt + 1);
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.damage).toBe(0);
  });
  it("Vampire takes double damage from piercing attacks and heals all damage after damaging you", () => {
    let s = started("horror");
    s = settle(reveal(s, "39051"));
    const vampire = s.minions.find((p) => p.code === "39051")!;
    expect(
      mojoGenreDamage(s, vampire.id, 2, undefined, {
        attack: true,
        piercing: true,
      }),
    ).toBe(4);
    expect(mojoGenreDamage(s, vampire.id, 2, undefined, { attack: true })).toBe(
      2,
    );
    s = settle(native(s, hit(vampire.id, 3)));
    expect(s.minions.find((p) => p.id === vampire.id)?.damage).toBe(3);
    s = settle(
      native(s, { type: "enemyAttack", id: vampire.id, actorId: "p1" }),
    );
    const after = s.minions.find((p) => p.id === vampire.id)!;
    expect(after.damage).toBe(0);
    expect(after.tough).toBe(false);
  });
  it("Werewolf Pack hides a defeated ally and survives defeat while one is under it", () => {
    let s = started("horror");
    const jessica = put(s, "01059");
    s = settle(reveal(s, "39052"));
    const pack = s.minions.find((p) => p.code === "39052")!;
    expect(pack.captured?.map((p) => p.id)).toEqual([jessica.id]);
    expect(s.player.inPlay.some((p) => p.id === jessica.id)).toBe(false);
    s = settle(native(s, hit(pack.id, 20)));
    const saved = s.minions.find((p) => p.id === pack.id)!;
    expect(saved.damage).toBe(0);
    expect(saved.captured || []).toHaveLength(0);
    expect(s.player.discard.some((p) => p.id === jessica.id)).toBe(true);
    s = settle(native(s, hit(pack.id, 20)));
    expect(s.minions.some((p) => p.id === pack.id)).toBe(false);
  });
});

describe("Sci-Fi", () => {
  it("Mojo Runner gives entering minions and allies a tough status", () => {
    let s = started("sci-fi");
    s = settle(reveal(s, "39053"));
    s = settle(reveal(s, "39055"));
    expect(s.minions.find((p) => p.code === "39055")?.tough).toBe(true);
    const [jessica, energy, may] = inHand(s, "01059", "01088", "01006");
    s = settle(play(reload(s), jessica, [energy, may]));
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.tough).toBe(true);
  });
  it("Avalanche 9.0 exhausts a character you control and damages it; its boost exhausts one", () => {
    let s = started("sci-fi");
    const hp = s.player.hp;
    s = settle(reveal(s, "39054"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
    const boost = mojoGenreBoost(
      s,
      s.minions.find((p) => p.code === "39054")!,
    )!;
    s.player.exhausted = false;
    s = settle(native(s, ...boost));
    expect(s.player.exhausted).toBe(true);
  });
  it("Blob 3.14 takes at most 2 damage from each attack; its boost stuns you", () => {
    let s = started("sci-fi");
    s = settle(reveal(s, "39055"));
    const blob = s.minions.find((p) => p.code === "39055")!;
    expect(mojoGenreDamage(s, blob.id, 5, undefined, { attack: true })).toBe(2);
    expect(mojoGenreDamage(s, blob.id, 5)).toBe(5);
    s = settle(native(s, ...mojoGenreBoost(s, blob)!));
    expect(s.player.stunned).toBe(true);
  });
  it("Magneto 2.6 gains a magnetic counter after each activation and you discard that many cards", () => {
    let s = started("sci-fi");
    s = settle(reveal(s, "39056"));
    const magneto = s.minions.find((p) => p.code === "39056")!;
    inHand(s, ...s.player.deck.slice(0, 4).map((p) => p.code));
    s = settle(
      native(s, { type: "enemyAttack", id: magneto.id, actorId: "p1" }),
    );
    expect(s.minions.find((p) => p.id === magneto.id)?.counters).toBe(1);
    expect(s.player.hand).toHaveLength(3);
    s = settle(
      native(s, { type: "enemyAttack", id: magneto.id, actorId: "p1" }),
    );
    expect(s.minions.find((p) => p.id === magneto.id)?.counters).toBe(2);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Pyro 4.0 deals you 2 indirect damage when it attacks you", () => {
    let s = started("sci-fi");
    s = settle(reveal(s, "39057"));
    const pyro = s.minions.find((p) => p.code === "39057")!;
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: pyro.id, actorId: "p1" }));
    expect(s.player.hp).toBe(hp - 2 - 2);
  });
  it("Toad 2.0 takes an upgrade you control and returns it to your hand when defeated", () => {
    let s = started("sci-fi");
    const tenacity = put(s, "01093");
    s = settle(reveal(s, "39058"));
    const toad = s.minions.find((p) => p.code === "39058")!;
    expect(toad.captured?.map((p) => p.id)).toEqual([tenacity.id]);
    expect(s.player.inPlay.some((p) => p.id === tenacity.id)).toBe(false);
    s = settle(native(s, hit(toad.id, 20)));
    expect(s.minions.some((p) => p.id === toad.id)).toBe(false);
    expect(s.player.hand.some((p) => p.id === tenacity.id)).toBe(true);
  });
  it("ICE-Teroid M gives minions guard and patrol and engages a minion at the end of the round", () => {
    let s = started("sci-fi");
    s = settle(reveal(s, "39055"));
    s = settle(reveal(s, "39059"));
    const blob = s.minions.find((p) => p.code === "39055")!;
    expect(mojoGenreKeyword(s, blob, "Guard")).toBe(true);
    expect(mojoGenreKeyword(s, blob, "Patrol")).toBe(true);
    const ended = mojoGenreRoundEnded(s);
    expect(ended).toHaveLength(1);
    const minions = s.minions.length;
    s = settle(native(s, ...ended));
    expect(s.minions).toHaveLength(minions + 1);
    expect(s.minions.at(-1)?.engagedWith).toBe("p1");
  });
});

describe("Sitcom", () => {
  it("Mojo in the Middle gives each obligation an acceleration icon and a draw when it is discarded", () => {
    let s = started("sitcom");
    s = settle(reveal(s, "39060"));
    s = settle(reveal(s, "39061"));
    expect(s.player.inPlay.some((p) => p.code === "39061")).toBe(true);
    expect(mojoGenreAcceleration(s)).toBe(1);
    s = alterEgo(s);
    const family = s.player.inPlay.find((p) => p.code === "39061")!;
    const hand = s.player.hand.length;
    s = command(s, { type: "ABILITY", id: family.id, action: "discard" });
    s = settle(s, pick("draw"));
    expect(s.player.inPlay.some((p) => p.code === "39061")).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(hand + 1);
  });
  it("Family Matters blanks the text box of each support you control, including resource abilities", () => {
    let s = started("sitcom");
    const may = put(s, "01006");
    const ship = makePiece(s, "22003");
    ship.ownerId = "p1";
    s.player.inPlay.push(ship);
    expect(isTextBlank(s, may)).toBe(false);
    expect(paymentSources(s).some((p) => p.id === ship.id)).toBe(true);
    s = settle(reveal(s, "39061"));
    expect(isTextBlank(s, may)).toBe(true);
    expect(paymentSources(s).some((p) => p.id === ship.id)).toBe(false);
  });
  it("Growing Pains makes your upgrades cost 2 more until an upgrade is discarded", () => {
    let s = started("sitcom");
    const cost = cardCost(s, card("01093"));
    s = settle(reveal(s, "39062"));
    expect(cardCost(s, card("01093"))).toBe(cost + 2);
    const [tenacity] = inHand(s, "01093");
    s = alterEgo(s);
    const pains = s.player.inPlay.find((p) => p.code === "39062")!;
    s = settle(
      command(s, { type: "ABILITY", id: pains.id, action: "discard" }),
      pick(tenacity.id),
    );
    expect(s.player.discard.some((p) => p.id === tenacity.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.code === "39062")).toBe(false);
  });
  it("The Odd Couple lowers your ally limit by 2 until you exhaust 2 characters", () => {
    let s = started("sitcom");
    const limit = allyLimit(s);
    s = settle(reveal(s, "39063"));
    expect(allyLimit(s)).toBe(limit - 2);
    const jessica = put(s, "01059");
    const cat = s.player.deck.find((p) => p.code === "01002")!;
    s.player.deck = s.player.deck.filter((p) => p !== cat);
    s.player.discard.push(cat);
    s = alterEgo(s);
    const couple = s.player.inPlay.find((p) => p.code === "39063")!;
    s = settle(
      command(s, { type: "ABILITY", id: couple.id, action: "discard" }),
      (s) => pick("hero")(s) || pick(jessica.id)(s) || pick(cat.id)(s),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === jessica.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.deck.some((p) => p.id === cat.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.code === "39063")).toBe(false);
  });
  it("The One with the Breakup gives encounter cards peril until you discard 3 cards", () => {
    let s = started("sitcom");
    s = settle(reveal(s, "39064"));
    expect(mojoGenrePeril(s)).toBe(true);
    inHand(s, ...s.player.deck.slice(0, 3).map((p) => p.code));
    s = alterEgo(s);
    const breakup = s.player.inPlay.find((p) => p.code === "39064")!;
    s = settle(
      command(s, { type: "ABILITY", id: breakup.id, action: "discard" }),
    );
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.code === "39064")).toBe(false);
    expect(mojoGenrePeril(s)).toBe(false);
  });
  it("Watch Me Play has incite 3, confuses you when you look up a rule and leaves with a confused status", () => {
    let s = started("sitcom");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "39065"));
    expect(s.scheme.threat).toBe(threat + 3);
    s = dispatch(s, { type: "LOOK_UP_RULE" });
    expect(s.error).toBeUndefined();
    expect(s.player.confused).toBe(true);
    s = alterEgo(s);
    const watch = s.player.inPlay.find((p) => p.code === "39065")!;
    s = settle(
      command(s, { type: "ABILITY", id: watch.id, action: "discard" }),
    );
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.some((p) => p.code === "39065")).toBe(false);
  });
});
