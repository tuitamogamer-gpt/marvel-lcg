/** Age of Apocalypse: En Sabah Nur with the Celestial Tech and Clan
 * Akkaba sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import { enemyStats, newGame } from "../src/game/engine";
import {
  CELESTIAL_TECH_CODES,
  CLAN_AKKABA_CODES,
  EN_SABAH_NUR_SCRIPT_CODES,
  esnForm,
  esnPower,
} from "../src/game/en-sabah-nur";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
// Captain Marvel first: Spider-Man's Spider-Sense would draw the card a
// test puts on top of the deck when the villain attacks.
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const PYRAMID = "45147b";
const RISE = "45148b";
const STAGGERING = "45149";
const BIOMORPHIC_BLAST = "45150";
const INTERFACE = "45151";
const DESPOT = "45152";
const SOURCE_OF_POWER = "45153";
const PLUGGED_IN = "45154";
const ARMOR = "45156";
const WEAPON = "45157";
const CELESTIAL_TECH = "45158";
const OZYMANDIAS = "45159";
const SCARAB = "45160";
const ZEALOT = "45161";
const TYRANT_WORSHIP = "45162";
const ANCIENT_RITUAL = "45163";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "en_sabah_nur",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45184,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(modules ? { modules } : {}),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 200; n++) {
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
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "en_sabah_nur",
  modules?: string[],
) {
  let s = settle(setup(difficulty, players, villainId, modules));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "en_sabah_nur",
  modules?: string[],
) {
  const s = opened(difficulty, players, villainId, modules);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
/** An original encounter card from any encounter zone. */
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
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function resolveEncounter(s: GameState) {
  for (
    let n = 0;
    n < 5 &&
    s.prompt?.options.some((o) => o.id === "resolve") &&
    /interrupt available/i.test(s.prompt.text);
    n++
  )
    s = choose(s, "resolve");
  return s;
}
/** Put an original encounter card on top of the encounter deck. */
function onTop(s: GameState, code: string) {
  const p = take(s, code);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
/** A boost card with no boost ability on top of the encounter deck. */
function plainTop(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost_star && card(p).type_code !== "minion",
  );
  expect(i).toBeGreaterThanOrEqual(0);
  const [p] = s.encounter.deck.splice(i, 1);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
/** A card of the player's deck with exactly one kind of printed resource
 * put on top of it. */
function resourceTop(
  s: GameState,
  kind: "energy" | "mental" | "physical",
  playerId = "p1",
) {
  const deck = seatView(s, playerId).player.deck;
  const kinds = ["energy", "mental", "physical", "wild"] as const;
  const i = deck.findIndex((p) => {
    const c = card(p) as unknown as Record<string, number | undefined>;
    return kinds.every((k) =>
      k === kind ? (c[`resource_${k}`] || 0) > 0 : !c[`resource_${k}`],
    );
  });
  expect(i, kind).toBeGreaterThanOrEqual(0);
  const [p] = deck.splice(i, 1);
  deck.unshift(p);
  return p;
}
function own(s: GameState, type: string) {
  const view = s.player;
  const i = view.deck.findIndex((p) => card(p).type_code === type);
  expect(i, type).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const attack = (id: string, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id,
  actorId: playerId,
});
const scheme = (id: string, playerId = "p1"): Effect => ({
  type: "enemyScheme",
  id,
  actorId: playerId,
});
function untough(s: GameState, p: Piece = s.villain) {
  p.tough = false;
  p.toughCards = 0;
  return reload(s);
}
/** A minion of the code put into play engaged with the first player. */
function minion(s: GameState, code: string) {
  const p = take(s, code);
  p.engagedWith = "p1";
  p.tough = false;
  p.toughCards = 0;
  s.minions.push(p);
  return p;
}
const ritual = (s: GameState) =>
  s.sideSchemes.find((p) => p.code === ANCIENT_RITUAL);
const superpowersLeft = (s: GameState) =>
  s.encounter.deck.filter((p) => card(p).traits?.includes("Superpower")).length;
const attacks = (s: GameState) => Number(s.flags.attacksPerformed || 0);

describe("En Sabah Nur: original source", () => {
  it("registers every face of the En Sabah Nur, Celestial Tech and Clan Akkaba sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aoa" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(EN_SABAH_NUR_SCRIPT_CODES)).toEqual(
      new Set(faces("en_sabah_nur")),
    );
    expect(new Set(CELESTIAL_TECH_CODES)).toEqual(
      new Set(faces("celestial_tech")),
    );
    expect(new Set(CLAN_AKKABA_CODES)).toEqual(new Set(faces("clan_akkaba")));
    for (const code of [
      ...EN_SABAH_NUR_SCRIPT_CODES,
      ...CELESTIAL_TECH_CODES,
      ...CLAN_AKKABA_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.slice(-13, -11).map((m) => m.id)).toEqual([
      "celestial_tech",
      "clan_akkaba",
    ]);
    expect(scenarioModules("en_sabah_nur")).toHaveLength(MODULES.length);
    expect(VILLAINS.find((v) => v.id === "en_sabah_nur")).toMatchObject({
      codes: ["45184a", "45185a", "45186a"],
      schemes: [PYRAMID, RISE],
      moduleCount: 2,
      defaultModules: ["celestial_tech", "clan_akkaba"],
    });
  });

  it("Apocalypse (I) starts in Biomorph form, each player has a facedown card and Ancient Ritual is in play", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("45184a");
      expect(esnForm(s)).toBe("Biomorph");
      expect(s.villain.hp).toBe(16 * players);
      expect(s.scheme.code).toBe(PYRAMID);
      expect(s.scheme.threat).toBe(players);
      expect(esnPower(s)).toBe(0);
      expect(s.encounter.dealt).toHaveLength(players);
      expect(ritual(s)?.counters).toBe(5);
      expect(
        [...s.encounter.deck, ...s.encounter.discard].some(
          (p) => p.code === ANCIENT_RITUAL,
        ),
      ).toBe(false);
    }
  });

  it("Expert starts with Apocalypse (II) in Biomorph form", () => {
    for (const players of [1, 2]) {
      const s = opened("expert", players);
      expect(s.villain.code).toBe("45185a");
      expect(s.villain.hp).toBe(20 * players);
    }
  });
});

describe("Apocalypse's forms", () => {
  it("changing form keeps his damage and attachments and resolves the new form's Forced Response", () => {
    let s = untough(started());
    s.villain.hp -= 4;
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, ARMOR)));
    const armor = s.attachments.find((a) => a.code === ARMOR)!;
    expect(armor.attachedTo).toBe(s.villain.id);
    const hp = s.villain.hp;
    const threat = s.scheme.threat;
    const rite = ritual(s)!.counters;
    s = settle(native(s, { type: "esn:form", form: "Cyberpath" }));
    expect(s.villain.code).toBe("45184b");
    expect(esnForm(s)).toBe("Cyberpath");
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.find((a) => a.id === armor.id)?.attachedTo).toBe(
      s.villain.id,
    );
    // Cyberpath: 1 threat on each scheme in play.
    expect(s.scheme.threat).toBe(threat + 1);
    expect(ritual(s)!.counters).toBe(rite + 1);
    // Giant: he heals 1.
    s = settle(native(s, { type: "esn:form", form: "Giant" }));
    expect(s.villain.code).toBe("45184c");
    expect(s.villain.hp).toBe(hp + 1);
    // Biomorph: 1 indirect damage to each player.
    const hero = s.player.hp;
    s = settle(native(s, { type: "esn:form", form: "Biomorph" }));
    expect(s.villain.code).toBe("45184a");
    expect(s.player.hp).toBe(hero - 1);
    // Changing to the form he is in does nothing.
    const again = s.player.hp;
    s = settle(native(s, { type: "esn:form", form: "Biomorph" }));
    expect(s.player.hp).toBe(again);
  });

  it("each form's printed ATK and SCH, and X is his stage", () => {
    let s = untough(started());
    for (const [form, code] of [
      ["Cyberpath", "45184b"],
      ["Giant", "45184c"],
      ["Biomorph", "45184a"],
    ]) {
      s = settle(native(s, { type: "esn:form", form }));
      expect(enemyStats(s, s.villain)).toMatchObject({
        attack: card(code).attack,
        scheme: card(code).scheme,
      });
    }
    // Apocalypse (II): changing to Cyberpath places 2 threat on each scheme.
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("45185a");
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "esn:form", form: "Cyberpath" }));
    expect(s.scheme.threat).toBe(threat + 2);
  });

  it("Biomorph's attacks gain overkill; Cyberpath and Giant's do not", () => {
    const run = (form: string) => {
      let s = untough(started());
      if (form !== "Biomorph")
        s = settle(native(s, { type: "esn:form", form }));
      const ally = own(s, "ally");
      ally.damage = pieceHP(s, ally) - 1;
      plainTop(s);
      s = reload(s);
      const hp = s.player.hp;
      s = settle(
        native(s, attack(s.villain.id)),
        (v) => v.prompt?.options.find((o) => o.id === ally.id)?.id,
      );
      expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
      return hp - s.player.hp;
    };
    expect(run("Biomorph")).toBeGreaterThan(0);
    expect(run("Giant")).toBe(0);
  });

  it("Cyberpath has retaliate 1 and Giant has stalwart", () => {
    let s = untough(started());
    s = settle(native(s, { type: "esn:form", form: "Cyberpath" }));
    s = untough(s);
    let hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp - 1);
    s = settle(native(s, { type: "esn:form", form: "Giant" }));
    s = untough(s);
    s.player.exhausted = false;
    s = reload(s);
    hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
  });

  it("the next stage enters in Biomorph form, keeping his attachments, without a form-change response", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, STAGGERING)));
    expect(esnForm(s)).toBe("Giant");
    const hero = s.player.hp;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("45185a");
    expect(esnForm(s)).toBe("Biomorph");
    expect(s.villain.hp).toBe(20);
    expect(s.player.hp).toBe(hero);
    expect(
      s.attachments.some(
        (a) => a.code === STAGGERING && a.attachedTo === s.villain.id,
      ),
    ).toBe(true);
  });
});

describe("En Sabah Nur's main schemes", () => {
  it("after step one of each villain phase a power counter; the fourth digs out a Superpower", () => {
    let s = started();
    for (let i = 1; i <= 3; i++) {
      s = settle(native(s, { type: "villainStepOne" }));
      expect(esnPower(s)).toBe(i);
    }
    const left = superpowersLeft(s);
    s = settle(resolveEncounter(native(s, { type: "villainStepOne" })));
    expect(esnPower(s)).toBe(0);
    expect(superpowersLeft(s)).toBe(left - 1);
  });

  it("a Superpower treachery's power counter waits for the next step one", () => {
    let s = started();
    s.enSabahNur!.power = 3;
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, INTERFACE)));
    expect(esnForm(s)).toBe("Cyberpath");
    expect(esnPower(s)).toBe(4);
    const left = superpowersLeft(s);
    s = settle(resolveEncounter(native(s, { type: "villainStepOne" })));
    expect(esnPower(s)).toBe(1);
    expect(superpowersLeft(s)).toBe(left - 1);
  });

  it("En Sabah Nur's Pyramid advances to The Rise of Apocalypse, which digs out a Superpower; completing it loses", () => {
    let s = started();
    s.enSabahNur!.power = 2;
    s.scheme.threat = card(PYRAMID).threat! - 1;
    s = reload(s);
    const left = superpowersLeft(s);
    s = settle(
      resolveEncounter(
        native(s, { type: "threat", target: "main", amount: 1 }),
      ),
    );
    expect(s.scheme.code).toBe(RISE);
    expect(esnPower(s)).toBe(0);
    expect(superpowersLeft(s)).toBe(left - 1);
    s.scheme.threat = card(RISE).threat! - 1;
    s = reload(s);
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Apocalypse's Superpowers", () => {
  it("a Superpower treachery: in its form he activates against you, otherwise he changes to it", () => {
    let s = untough(started());
    plainTop(s);
    s = reload(s);
    const before = attacks(s);
    s = settle(resolveEncounter(reveal(s, BIOMORPHIC_BLAST)));
    expect(attacks(s)).toBe(before + 1);
    expect(esnForm(s)).toBe("Biomorph");
    // In alter-ego form he schemes.
    s.player.form = "alter";
    plainTop(s);
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, BIOMORPHIC_BLAST)));
    expect(s.scheme.threat).toBeGreaterThan(threat);
    // Otherwise: Giant form, 1 power counter, and Giant's Forced Response.
    s.player.form = "hero";
    s.villain.hp -= 3;
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(resolveEncounter(reveal(s, DESPOT)));
    expect(esnForm(s)).toBe("Giant");
    expect(esnPower(s)).toBe(1);
    expect(s.villain.hp).toBe(hp + 1);
  });

  it("a Superpower side scheme's When Defeated: a tough status card and a form change, or an activation against its defeater", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, PLUGGED_IN)));
    let side = s.sideSchemes.find((p) => p.code === PLUGGED_IN)!;
    expect(side.counters).toBe(5);
    s = settle(
      native(s, {
        type: "thwart",
        target: side.id,
        amount: side.counters,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(false);
    expect(esnForm(s)).toBe("Cyberpath");
    expect(s.villain.tough).toBe(true);
    // In its form: he activates against the player who defeated it.
    s = settle(native(s, { type: "esn:form", form: "Biomorph" }));
    s = untough(s);
    s = settle(resolveEncounter(reveal(s, SOURCE_OF_POWER)));
    side = s.sideSchemes.find((p) => p.code === SOURCE_OF_POWER)!;
    plainTop(s);
    s = reload(s);
    const before = attacks(s);
    s = settle(
      native(s, {
        type: "thwart",
        target: side.id,
        amount: side.counters,
        source: "hero",
      }),
    );
    expect(attacks(s)).toBe(before + 1);
    expect(s.villain.tough).toBe(false);
    expect(esnForm(s)).toBe("Biomorph");
  });

  it("Staggering Strength: +2 ATK and Giant form; when he attacks you, you are stunned and it is discarded after the attack", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, STAGGERING)));
    const staggering = s.attachments.find((a) => a.code === STAGGERING)!;
    expect(staggering.attachedTo).toBe(s.villain.id);
    expect(esnForm(s)).toBe("Giant");
    expect(enemyStats(s, s.villain).attack).toBe(card("45184c").attack! + 2);
    plainTop(s);
    s = reload(s);
    s = settle(native(s, attack(s.villain.id)));
    expect(s.player.stunned).toBe(true);
    expect(s.attachments.some((a) => a.id === staggering.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === staggering.id)).toBe(true);
  });

  it("the Superpowers' boosts: Staggering Strength is revealed after the activation, the treacheries change his form", () => {
    let s = untough(started());
    onTop(s, STAGGERING);
    s = reload(s);
    s = settle(native(s, attack(s.villain.id)));
    expect(
      s.attachments.some(
        (a) => a.code === STAGGERING && a.attachedTo === s.villain.id,
      ),
    ).toBe(true);
    expect(esnForm(s)).toBe("Giant");
    onTop(s, INTERFACE);
    s.player.form = "alter";
    s = reload(s);
    s = settle(native(s, scheme(s.villain.id)));
    expect(esnForm(s)).toBe("Cyberpath");
    expect(s.encounter.discard.some((p) => p.code === INTERFACE)).toBe(true);
  });
});

describe("Celestial Tech", () => {
  it("Celestial Armor: when the villain schemes against you, the top card of your deck decides", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, ARMOR)));
    s.player.form = "alter";
    s.villain.hp -= 5;
    // Energy: he heals 2.
    let top = resourceTop(s, "energy");
    plainTop(s);
    s = reload(s);
    let hp = s.villain.hp;
    s = settle(native(s, scheme(s.villain.id)));
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
    expect(s.villain.hp).toBe(hp + 2);
    // Physical: a tough status card.
    top = resourceTop(s, "physical");
    plainTop(s);
    s = reload(s);
    s = settle(native(s, scheme(s.villain.id)));
    expect(s.villain.tough).toBe(true);
    // Mental: you are confused and the Armor is discarded.
    top = resourceTop(s, "mental");
    plainTop(s);
    s = reload(s);
    hp = s.villain.hp;
    s = settle(native(s, scheme(s.villain.id)));
    expect(s.player.confused).toBe(true);
    expect(s.attachments.some((a) => a.code === ARMOR)).toBe(false);
    expect(s.villain.hp).toBe(hp);
  });

  it("Celestial Weapon: when the villain attacks you, the top card of your deck decides", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, WEAPON)));
    expect(s.attachments.find((a) => a.code === WEAPON)?.attachedTo).toBe(
      s.villain.id,
    );
    // Energy: 2 damage to your identity, on top of the attack.
    resourceTop(s, "energy");
    const boost = plainTop(s);
    s = reload(s);
    let hp = s.player.hp;
    s = settle(native(s, attack(s.villain.id)));
    expect(hp - s.player.hp).toBe(
      2 + card("45184a").attack! + (card(boost).boost || 0),
    );
    // Mental: discard a card from your hand.
    s.player.hp = 30;
    s.player.hand.push(...s.player.deck.splice(5, 2));
    resourceTop(s, "mental");
    plainTop(s);
    s = reload(s);
    const hand = s.player.hand.length;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.player.hand.length).toBe(hand - 1);
    // Physical: you are stunned and the Weapon is discarded.
    resourceTop(s, "physical");
    plainTop(s);
    s = reload(s);
    hp = s.player.hp;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.player.stunned).toBe(true);
    expect(s.attachments.some((a) => a.code === WEAPON)).toBe(false);
  });

  it("Celestial Tech resolves each Celestial attachment as if the villain schemed and attacked; with none it finds one", () => {
    let s = untough(started());
    // None in play: a choice between the two, then it attaches.
    s = settle(
      resolveEncounter(reveal(s, CELESTIAL_TECH)),
      (v) => v.prompt?.options.find((o) => o.image === WEAPON)?.id,
    );
    expect(s.attachments.find((a) => a.code === WEAPON)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.attachments.some((a) => a.code === ARMOR)).toBe(false);
    // With the Weapon and the Armor attached, both resolve: two cards of
    // your deck are discarded.
    s = settle(resolveEncounter(reveal(s, ARMOR)));
    s.player.hp = 30;
    resourceTop(s, "physical");
    s = reload(s);
    const discard = s.player.discard.length;
    s = settle(resolveEncounter(reveal(s, CELESTIAL_TECH)));
    expect(s.player.discard.length).toBe(discard + 2);
  });

  it("joins another scenario: the Celestial attachments attach to its villain", () => {
    let s = untough(started("standard", 1, "rhino", ["celestial_tech"]));
    s = settle(resolveEncounter(reveal(s, WEAPON)));
    expect(s.attachments.find((a) => a.code === WEAPON)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(ritual(s)).toBeUndefined();
  });
});

describe("Clan Akkaba", () => {
  it("Ancient Ritual begins play in another scenario and cannot be defeated", () => {
    let s = started("standard", 1, "rhino", ["clan_akkaba"]);
    const rite = ritual(s)!;
    expect(rite.counters).toBe(5);
    expect(s.encounter.deck.some((p) => p.code === OZYMANDIAS)).toBe(true);
    s = settle(
      native(s, { type: "thwart", target: rite.id, amount: 5, source: "hero" }),
    );
    expect(ritual(s)?.id).toBe(rite.id);
    expect(ritual(s)?.counters).toBe(0);
  });

  it("Ancient Ritual: at 10 threat 5 come off and each player is dealt a facedown card", () => {
    let s = started("standard", 2);
    const rite = ritual(s)!;
    rite.counters = 9;
    s = reload(s);
    s = settle(native(s, { type: "threat", target: rite.id, amount: 1 }));
    expect(ritual(s)!.counters).toBe(5);
    expect(s.encounter.dealt).toHaveLength(2);
  });

  it("Tyrant Worship places 5 threat on Ancient Ritual", () => {
    let s = started();
    ritual(s)!.counters = 2;
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, TYRANT_WORSHIP)));
    expect(ritual(s)!.counters).toBe(7);
    expect(s.encounter.dealt).toHaveLength(0);
  });

  it("Ozymandias schemes onto Ancient Ritual", () => {
    let s = started();
    const oz = minion(s, OZYMANDIAS);
    s.player.form = "alter";
    const boost = plainTop(s);
    s = reload(s);
    const threat = s.scheme.threat;
    const rite = ritual(s)!.counters;
    s = settle(native(s, scheme(oz.id)));
    expect(s.scheme.threat).toBe(threat);
    expect(ritual(s)!.counters).toBe(
      rite + card(OZYMANDIAS).scheme! + (card(boost).boost || 0),
    );
  });

  it("Scarab: 1 threat on Ancient Ritual after it attacks, 3 when the attack defeats an ally", () => {
    let s = started();
    const scarab = minion(s, SCARAB);
    s = reload(s);
    let rite = ritual(s)!.counters;
    s = settle(native(s, attack(scarab.id)));
    expect(ritual(s)!.counters).toBe(rite + 1);
    const ally = own(s, "ally");
    ally.damage = pieceHP(s, ally) - 1;
    s.player.hp = 30;
    s = reload(s);
    rite = ritual(s)!.counters;
    s = settle(
      native(s, attack(scarab.id)),
      (v) => v.prompt?.options.find((o) => o.id === ally.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(ritual(s)!.counters).toBe(rite + 3);
  });

  it("Clan Akkaba Zealot: 2 threat on Ancient Ritual when defeated, 1 as a boost", () => {
    let s = started();
    const zealot = minion(s, ZEALOT);
    s = reload(s);
    let rite = ritual(s)!.counters;
    s = settle(native(s, hit(zealot.id, 10)));
    expect(s.minions.some((m) => m.id === zealot.id)).toBe(false);
    expect(ritual(s)!.counters).toBe(rite + 2);
    s = untough(s);
    onTop(s, ZEALOT);
    s = reload(s);
    rite = ritual(s)!.counters;
    s = settle(native(s, attack(s.villain.id)));
    expect(ritual(s)!.counters).toBe(rite + 1);
  });

  it("Ozymandias' and Tyrant Worship's boosts: 3 threat on Ancient Ritual, or three more boost icons", () => {
    let s = untough(started());
    onTop(s, TYRANT_WORSHIP);
    s = reload(s);
    let rite = ritual(s)!.counters;
    let hp = s.player.hp;
    s = settle(
      native(s, attack(s.villain.id)),
      (v) => v.prompt?.options.find((o) => o.id === "ritual")?.id,
    );
    expect(ritual(s)!.counters).toBe(rite + 3);
    expect(hp - s.player.hp).toBe(card("45184a").attack);
    // Three more boost icons instead.
    s.player.hp = 30;
    onTop(s, OZYMANDIAS);
    s = reload(s);
    rite = ritual(s)!.counters;
    hp = s.player.hp;
    s = settle(
      native(s, attack(s.villain.id)),
      (v) => v.prompt?.options.find((o) => o.id === "icons")?.id,
    );
    expect(ritual(s)!.counters).toBe(rite);
    expect(hp - s.player.hp).toBe(card("45184a").attack! + 3);
    expect(
      Object.keys(s.flags).filter((k) => k.startsWith("esnIcons:")),
    ).toEqual([]);
  });
});
