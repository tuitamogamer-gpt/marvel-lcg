/** Original Crossbones cards, standalone setup and native dispatch only.
 * Fixtures reposition the same physical sources and hydrate every command. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  HEROES,
  card,
  deckCodes,
  scenarioModules,
  VILLAINS,
} from "../src/game/cards.js";
import {
  dispatch,
  enemyStats,
  escalation,
  newGame,
  schemeLimit,
  targets,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { isPermanent } from "../src/game/hero-runtime.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import { choose, command, native, passId, reload } from "./dv-test-helpers.js";

const recommended = ["hydra_assault", "weap_master", "legions_of_hydra"];
type Fixture = GameState & {
  crossbonesOriginals?: { id: string; code: string }[];
};
function zones(s: GameState): Piece[][] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments || [],
    s.resolving,
    s.removed,
    s.victoryDisplay || [],
    s.crossbones?.weaponDeck || [],
    s.crossbones?.mainDeck || [],
    s.crossbones?.villainDeck || [],
    ...(s.crossbones?.currentMain ? [[s.crossbones.currentMain]] : []),
    [s.villain],
  ];
}
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.inheritorBoosts || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return zones(s).flat().flatMap(nested);
}
function exact(s: GameState) {
  const all = physical(s);
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical ID").toBe(
    all.length,
  );
  const original = (s as Fixture).crossbonesOriginals;
  if (original) {
    expect(all.map((p) => p.id).sort()).toEqual(
      original.map((p) => p.id).sort(),
    );
    for (const source of original) {
      const piece = all.find((p) => p.id === source.id)!;
      expect(piece.code.replace(/[ab]$/, ""), source.id).toBe(
        source.code.replace(/[ab]$/, ""),
      );
    }
  }
  return s;
}
function defaultChoice(s: GameState) {
  return (
    (/indirect damage/i.test(s.prompt?.text || "")
      ? s.prompt?.options.find((o) => o.id === "hero")?.id
      : undefined) ||
    passId(s) ||
    s.prompt?.options.find((o) => /^(allow|resolve)$/.test(o.id))?.id ||
    (/forced|order|when defeated|setup/i.test(s.prompt?.title || "") ||
    s.prompt?.options.length === 1
      ? s.prompt?.options[0]?.id
      : undefined)
  );
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 120; n++) {
    const id = prefer?.(s) || defaultChoice(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return exact(s);
}
function until(s: GameState, match: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !match(s) && n < 120; n++) {
    const id = defaultChoice(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(match(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function opening(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  heroId = "spider_man",
) {
  const aspect = HEROES.find((hero) => hero.id === heroId)!.aspect;
  return newGame({
    heroId,
    aspect,
    villainId: "crossbones",
    difficulty,
    seed: 40580,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId, aspect },
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  });
}
function started(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  heroId = "spider_man",
) {
  let s = settle(opening(team, difficulty, heroId));
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  expect(s.phase).toBe("player");
  (s as Fixture).crossbonesOriginals = physical(s).map(({ id, code }) => ({
    id,
    code,
  }));
  return exact(reload(s));
}
function base(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  heroId = "spider_man",
) {
  const s = started(team, difficulty, heroId);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const deck = deckCodes(seat.heroId, seat.aspect).filter(
      (code) => !isPermanent(card(code)),
    );
    const codes = new Set(deck);
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay].filter(
      (p) => codes.has(p.code),
    );
    expect(source.map((p) => p.code).sort()).toEqual(deck.sort());
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = p.inPlay.filter((p) => !codes.has(p.code));
    p.form = "hero";
    p.flipped = p.exhausted = p.stunned = p.confused = p.tough = false;
    p.stunCards = p.confuseCards = p.toughCards = 0;
  }
  // Setup weapons become ordinary encounter cards once they have entered play.
  for (const p of s.attachments.splice(0)) {
    delete p.attachedTo;
    p.counters = p.damage = 0;
    s.encounter.discard.push(p);
  }
  activateSeat(s, "p1");
  s.scheme.threat = 0;
  return exact(s);
}
function take(s: GameState, code: string, playerId?: string) {
  const source = playerId
    ? (() => {
        const p = seatView(s, playerId).player;
        return [p.deck, p.hand, p.discard];
      })()
    : [s.encounter.deck, s.encounter.discard, s.encounter.dealt];
  for (const zone of source) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${playerId || "encounter"}:${code}`);
}
function top(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => take(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function attached(s: GameState, code: string) {
  s = settle(reveal(s, code));
  expect(s.attachments.find((p) => p.code === code)?.attachedTo).toBe(
    s.villain.id,
  );
  return s;
}
function ally(s: GameState, code = "01083", playerId = "p1") {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function attack(s: GameState, playerId = "p1") {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: playerId,
    activation: { enemyId: s.villain.id, playerId, kind: "attack" },
  });
}
function damage(s: GameState, amount: number, extra: Partial<Effect> = {}) {
  return settle(
    native(s, {
      type: "damage",
      target: s.villain.id,
      amount,
      source: "hero",
      ...extra,
    }),
  );
}
function blank(s: GameState, p: Piece) {
  s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
}

describe("Crossbones exact standalone setup", () => {
  it("registers all seventeen original faces and appends its scenario", () => {
    const faces = CATALOG_CARDS.filter((p) => p.set_code === "crossbones");
    expect(faces).toHaveLength(17);
    for (const p of faces)
      expect(hasExecutableScript(p.code), p.code).toBe(true);
    expect(VILLAINS.findIndex((v) => v.id === "crossbones")).toBe(10);
    expect(VILLAINS.find((v) => v.id === "crossbones")?.moduleCount).toBe(3);
    expect(
      scenarioModules("crossbones").some((m) => m.id === "exper_weapon"),
    ).toBe(false);
  });
  it.each([false, true])(
    "preserves physical sources and three recommended modules (team %s)",
    (team) => {
      const s = started(team);
      expect(s.modules).toEqual(recommended);
      expect(s.crossbones?.weaponDeck).toHaveLength(3);
      const weapons = physical(s).filter(
        (p) => card(p).set_code === "exper_weapon",
      );
      expect(weapons.map((p) => p.code).sort()).toEqual([
        "04072",
        "04073",
        "04074",
        "04075",
      ]);
      expect(
        s.attachments.filter((p) => card(p).set_code === "exper_weapon"),
      ).toHaveLength(1);
      expect(
        physical(s).filter((p) => card(p).set_code === "crossbones"),
      ).toHaveLength(18);
      expect(s.villain).toMatchObject({
        code: "04058",
        stage: 1,
        hp: 12 * s.playerCount,
      });
      expect(schemeLimit(s)).toBe(3 * s.playerCount);
      expect(escalation(s)).toBe(s.playerCount);
      exact(reload(s));
    },
  );
  it("starts Expert II with the original Machine Gun and all ammo", () => {
    const s = started(true, "expert");
    expect(s.villain).toMatchObject({ code: "04059", stage: 2, hp: 28 });
    expect(s.attachments.find((p) => p.code === "04064")).toMatchObject({
      attachedTo: s.villain.id,
      counters: 4,
    });
    expect(s.crossbones?.weaponDeck).toHaveLength(3);
  });
  it("accepts three distinct alternate modules without adding a fourth set", () => {
    const s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "crossbones",
      modules: ["bomb_scare", "hydra_patrol", "masters_of_evil"],
      seed: 4058,
    });
    expect(s.modules).toEqual([
      "bomb_scare",
      "hydra_patrol",
      "masters_of_evil",
    ]);
    const sets = new Set(physical(s).map((p) => card(p).set_code));
    expect(sets.has("hydra_assault")).toBe(false);
    expect(sets.has("weap_master")).toBe(false);
    expect(sets.has("legions_of_hydra")).toBe(false);
  });
  it.each([
    ["hydra_assault", "weap_master"],
    ["hydra_assault", "hydra_assault", "weap_master"],
    ["hydra_assault", "weap_master", "exper_weapon"],
  ])("rejects invalid three-module composition %j", (...modules) => {
    expect(() =>
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "crossbones",
        modules,
        seed: 4058,
      }),
    ).toThrow();
  });
  it.each([false, true])(
    "advances all three main schemes with one weapon each, then loses (team %s)",
    (team) => {
      let s = base(team);
      const count = s.playerCount;
      s.scheme.threat = schemeLimit(s) - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.scheme).toMatchObject({
        code: "04062b",
        index: 1,
        threat: count,
      });
      expect(schemeLimit(s)).toBe(6 * count);
      expect(s.crossbones?.weaponDeck).toHaveLength(2);
      expect(s.minions).toHaveLength(0);
      s.scheme.threat = schemeLimit(s) - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.scheme).toMatchObject({
        code: "04063b",
        index: 2,
        threat: count,
      });
      expect(schemeLimit(s)).toBe(5 * count);
      expect(s.crossbones?.weaponDeck).toHaveLength(1);
      s.scheme.threat = schemeLimit(s) - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.phase).toBe("lost");
    },
  );
  it("advances Standard I to II and searches the same gun from discard", () => {
    let s = base();
    const gun = take(s, "04064");
    s.encounter.discard.push(gun);
    s = damage(s, s.villain.hp);
    expect(s.villain).toMatchObject({ code: "04059", stage: 2, hp: 14 });
    expect(s.attachments.find((p) => p.code === "04064")).toMatchObject({
      id: gun.id,
      counters: 2,
    });
    expect(s.crossbones?.weaponDeck).toHaveLength(3);
    s = damage(s, s.villain.hp);
    expect(s.phase).toBe("won");
  });
  it("advances Expert II to III and reveals exactly one weapon", () => {
    let s = base(false, "expert");
    const next = s.crossbones!.weaponDeck[0];
    s = damage(s, s.villain.hp);
    expect(s.villain).toMatchObject({ code: "04060", stage: 3, hp: 16 });
    expect(s.crossbones?.weaponDeck).toHaveLength(2);
    expect(s.attachments.some((p) => p.id === next.id)).toBe(true);
    s = damage(s, s.villain.hp);
    expect(s.phase).toBe("won");
  });
  it("stage II does not recreate or refill a gun already attached", () => {
    let s = attached(base(), "04064");
    const gun = s.attachments.find((p) => p.code === "04064")!;
    gun.counters = 1;
    s = damage(s, s.villain.hp);
    expect(s.attachments.find((p) => p.code === "04064")).toMatchObject({
      id: gun.id,
      counters: 1,
    });
  });
  it("stage II retains the same Energy Shield and retaliates after the stage-defeating attack", () => {
    let s = base();
    const index = s.crossbones!.weaponDeck.findIndex((p) => p.code === "04073");
    if (index >= 0)
      s.encounter.discard.push(s.crossbones!.weaponDeck.splice(index, 1)[0]);
    s = attached(s, "04073");
    const shield = s.attachments.find((p) => p.code === "04073")!;
    const hp = s.player.hp;
    s = damage(s, s.villain.hp, { attack: true });
    expect(s.villain.code).toBe("04059");
    expect(s.player.hp).toBe(hp - 1);
    expect(s.attachments.find((p) => p.id === shield.id)?.attachedTo).toBe(
      s.villain.id,
    );
  });
  it("stage II retains the actual Beetle Armor and its four extra hit points", () => {
    let s = base(false, "standard", "wsp");
    // Shadows of the Past brings the hero's actual nemesis source into this
    // mission through its native import boundary, then conservation restarts.
    delete (s as Fixture).crossbonesOriginals;
    s = settle(reveal(s, "01190"));
    const index = s.minions.findIndex((p) => p.code === "13028");
    expect(index).toBeGreaterThanOrEqual(0);
    s.encounter.discard.push(s.minions.splice(index, 1)[0]);
    (s as Fixture).crossbonesOriginals = physical(s).map(({ id, code }) => ({
      id,
      code,
    }));
    s = attached(s, "13029");
    const armor = s.attachments.find((p) => p.code === "13029")!;
    expect(s.villain.hp).toBe(16);
    s = damage(s, s.villain.hp);
    expect(s.villain).toMatchObject({ code: "04059", hp: 18, maxHp: 18 });
    expect(s.attachments.find((p) => p.id === armor.id)?.attachedTo).toBe(
      s.villain.id,
    );
  });
  it("an exhausted Experimental Weapons deck never refills from encounter discard", () => {
    let s = base();
    const weapons = s.crossbones!.weaponDeck.splice(0);
    s.encounter.discard.push(...weapons);
    const acceleration = s.encounter.acceleration;
    s.scheme.threat = schemeLimit(s) - 1;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme.code).toBe("04062b");
    expect(s.crossbones!.weaponDeck).toHaveLength(0);
    expect(s.attachments).toHaveLength(0);
    expect(s.encounter.acceleration).toBe(acceleration);
    for (const p of weapons)
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
  });
});

describe("Crossbones Machine Gun and piercing timing", () => {
  it("spends ammo and allocates discarded numeric boosts before defense", () => {
    let s = attached(base(), "04064");
    const gun = s.attachments.find((p) => p.code === "04064")!;
    const [discard] = top(s, "04065", "04068");
    const hp = s.player.hp;
    s = attack(s);
    s = until(s, (v) => /indirect damage/i.test(v.prompt?.text || ""));
    expect(s.attachments.find((p) => p.id === gun.id)?.counters).toBe(1);
    expect(s.encounter.discard.some((p) => p.id === discard.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === "take")).toBe(false);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hp).toBe(hp - 3);
    s = settle(choose(reload(s), "hero"));
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  });
  it("allocates one indirect packet between a controlled ally and identity", () => {
    let s = attached(base(), "04064");
    const a = ally(s);
    const hp = s.player.hp;
    top(s, "04065", "04068");
    s = until(attack(s), (v) => /indirect damage/i.test(v.prompt?.text || ""));
    s = choose(reload(s), a.id);
    s = choose(reload(s), a.id);
    s = choose(reload(s), "hero");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(2);
    expect(s.player.hp).toBe(hp - 1);
    s = settle(choose(s, "hero"));
    exact(s);
  });
  it("ignores a boost star on the gun's discarded card", () => {
    let s = attached(base(), "04064");
    top(s, "04068", "04066");
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "take"),
    );
    expect(s.player.hp).toBe(hp);
    expect(s.villain.tough).toBe(false);
    expect(s.attachments.find((p) => p.code === "04064")?.counters).toBe(1);
    s = settle(choose(s, "hero"));
  });
  it("discards the last-ammo gun before attack damage and stops its sole Weapon piercing", () => {
    let s = attached(base(), "04064");
    const gun = s.attachments.find((p) => p.code === "04064")!;
    gun.counters = 1;
    s.player.tough = true;
    s.player.toughCards = 1;
    top(s, "04068", "04066");
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "take"),
    );
    expect(s.attachments.some((p) => p.id === gun.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === gun.id)).toBe(true);
    s = settle(choose(s, "take"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
  });
  it.each(["stunned", "blank"])(
    "does not spend ammo when %s suppresses its trigger",
    (mode) => {
      let s = attached(base(), "04064");
      const gun = s.attachments.find((p) => p.code === "04064")!;
      if (mode === "stunned") {
        s.villain.stunned = true;
        s.villain.stunCards = 1;
      } else blank(s, gun);
      const [next] = top(s, "04068");
      s = settle(attack(s));
      expect(s.attachments.find((p) => p.id === gun.id)?.counters).toBe(2);
      if (mode === "stunned") expect(s.encounter.deck[0].id).toBe(next.id);
    },
  );
  it("a weapon grants live piercing even if its own text is blank", () => {
    let s = attached(base(), "04149");
    blank(
      s,
      s.attachments.find((p) => p.code === "04149")!,
    );
    s.player.tough = true;
    s.player.toughCards = 1;
    top(s, "04068");
    const hp = s.player.hp;
    s = settle(attack(s));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.tough).toBe(false);
  });
  it("blank Crossbones does not derive piercing from its Weapon trait", () => {
    let s = attached(base(), "04149");
    blank(s, s.villain);
    s.player.tough = true;
    s.player.toughCards = 1;
    top(s, "04068");
    const hp = s.player.hp;
    s = settle(attack(s));
    expect(s.player.hp).toBe(hp);
  });
  it("gun damages the originally attacked seat before a teammate can defend", () => {
    let s = attached(base(true), "04064");
    top(s, "04065", "04068");
    const hp1 = seatView(s, "p1").player.hp;
    const hp2 = seatView(s, "p2").player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero:p2"),
    );
    expect(seatView(s, "p1").player.hp).toBe(hp1 - 3);
    expect(seatView(s, "p2").player.hp).toBe(hp2);
    s = settle(choose(reload(s), "hero:p2"));
    expect(seatView(s, "p2").player.hp).toBe(hp2);
  });
  it("Webbed Up replaces the entire attack before gun ammo or Spider-Sense", () => {
    let s = attached(base(), "04064");
    const web = take(s, "01009", "p1");
    web.attachedTo = s.villain.id;
    s.player.inPlay.push(web);
    const gun = s.attachments.find((p) => p.code === "04064")!;
    const deck = s.encounter.deck.map((p) => p.id);
    s = settle(attack(s));
    expect(s.villain.stunned).toBe(true);
    expect(s.player.hand).toHaveLength(0);
    expect(s.attachments.find((p) => p.id === gun.id)?.counters).toBe(2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    expect(s.player.discard.some((p) => p.id === web.id)).toBe(true);
  });
  it("the gun's Forced Interrupt precedes Spider-Sense's optional draw", () => {
    let s = attached(base(), "04064");
    top(s, "04065", "04068");
    const nextDraw = s.player.deck[0].id;
    s = until(attack(s), (v) => /indirect damage/i.test(v.prompt?.text || ""));
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.deck[0].id).toBe(nextDraw);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hand.map((p) => p.id)).toEqual([nextDraw]);
    s = settle(choose(s, "hero"));
  });
  it("actual Side Step prevents gun ability damage and makes the player a defender", () => {
    let s = attached(base(false, "standard", "qsv"), "04064");
    const event = take(s, "14015", "p1");
    const resource = take(s, "14020", "p1");
    const defense = take(s, "14014", "p1");
    const defenseResource = take(s, "14021", "p1");
    s.player.hand.push(event, resource, defense, defenseResource);
    const hp = s.player.hp;
    top(s, "04065", "04068");
    s = until(attack(s), (v) => /indirect damage/i.test(v.prompt?.text || ""));
    s = choose(s, "hero");
    s = choose(s, "hero");
    s = choose(s, "hero");
    s = until(
      s,
      (v) => !!v.prompt?.options.some((o) => /Side Step/i.test(o.label)),
    );
    const option = s.prompt!.options.find((o) => /Side Step/i.test(o.label))!;
    s = choose(reload(s), option.id);
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = until(s, (v) => !!v.attack?.eventDefense || !v.prompt);
    expect(s.player.hp).toBe(hp);
    expect(s.attack?.eventDefense).toBe(true);
    expect(s.attack?.defender).toBe("hero");
    s = settle(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Intangible Vision cannot defend with Side Step or reduce gun ability damage as attack damage", () => {
    let s = attached(base(false, "standard", "vision"), "04064");
    expect(s.player.inPlay.some((p) => p.code === "26002")).toBe(true);
    const event = take(s, "26019", "p1");
    const resource = s.player.deck.find((p) => !!card(p).resource_mental)!;
    s.player.hand.push(event, take(s, resource.code, "p1"));
    const hp = s.player.hp;
    top(s, "04065", "04068");
    s = attack(s);
    for (let count = 0; s.prompt && count < 120; count++) {
      expect(
        s.prompt.options.some(
          (o) => o.image === "26019" || /Side Step/i.test(o.label),
        ),
      ).toBe(false);
      const id = defaultChoice(s);
      expect(id, JSON.stringify(s.prompt)).toBeTruthy();
      s = choose(reload(s), id!);
    }
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    exact(s);
  });
  it("Weapon Master has no Surge after the final-ammo gun is its only Weapon", () => {
    let s = attached(base(), "04064");
    s.attachments.find((p) => p.code === "04064")!.counters = 1;
    top(s, "04068", "04066");
    s = settle(reveal(s, "04150"));
    expect(s.attachments.some((p) => p.code === "04064")).toBe(false);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("last-ammo gun leaves play even when its damage eliminates the attacked player", () => {
    let s = attached(base(true), "04064");
    const gun = s.attachments.find((p) => p.code === "04064")!;
    gun.counters = 1;
    s.player.hp = 3;
    const survivorHP = seatView(s, "p2").player.hp;
    top(s, "04065");
    s = settle(attack(s));
    expect(s.players.find((p) => p.id === "p1")!.eliminated).toBe(true);
    expect(s.players.find((p) => p.id === "p2")!.eliminated).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(survivorHP);
    expect(s.attachments.some((p) => p.id === gun.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === gun.id)).toBe(true);
    expect(s.attack).toBeNull();
  });
  it("an attack directed at an ally still triggers Gun against its player", () => {
    let s = attached(base(), "04064");
    const a = ally(s);
    const hp = s.player.hp;
    top(s, "04065", "04068");
    s = native(s, {
      type: "enemyAttack",
      id: s.villain.id,
      originalTarget: a.id,
      activation: { enemyId: s.villain.id, playerId: "p1", kind: "attack" },
    });
    s = until(s, (v) => /indirect damage/i.test(v.prompt?.text || ""));
    expect(s.attachments.find((p) => p.code === "04064")?.counters).toBe(1);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(1);
  });
});

describe("Crossbones Armor damage replacement", () => {
  it("accumulates small packets and absorbs the entire packet that reaches five", () => {
    let s = attached(base(), "04065");
    const armor = s.attachments.find((p) => p.code === "04065")!;
    const hp = s.villain.hp;
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 2 });
    s = damage(s, 3);
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(3);
    s = damage(s, 8);
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.id === armor.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === armor.id)).toHaveLength(
      1,
    );
    expect(enemyStats(s, s.villain)).toEqual({ attack: 1, scheme: 1 });
    s = damage(s, 2);
    expect(s.villain.hp).toBe(hp - 2);
  });
  it("does not place prevented Tough damage on Armor", () => {
    let s = attached(base(), "04065");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const hp = s.villain.hp;
    s = damage(s, 4);
    expect(s.villain.hp).toBe(hp);
    expect(s.villain.tough).toBe(false);
    expect(s.attachments.find((p) => p.code === "04065")?.damage).toBe(0);
  });
  it("blanking suppresses replacement but retains both printed stat bonuses", () => {
    let s = attached(base(), "04065");
    blank(
      s,
      s.attachments.find((p) => p.code === "04065")!,
    );
    const hp = s.villain.hp;
    s = damage(s, 3);
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.attachments.find((p) => p.code === "04065")?.damage).toBe(0);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 2 });
  });
  it("zero damage neither adds counters nor removes Armor", () => {
    let s = attached(base(), "04065");
    const armor = s.attachments.find((p) => p.code === "04065")!;
    armor.damage = 4;
    s = damage(s, 0);
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(4);
  });
  it("a Piercing attack removes Tough before the Armor absorbs its whole packet", () => {
    let s = attached(base(), "04065");
    const armor = s.attachments.find((p) => p.code === "04065")!;
    const hp = s.villain.hp;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = damage(s, 8, { attack: true, piercing: true });
    expect(s.villain.hp).toBe(hp);
    expect(s.villain.tough).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === armor.id)).toBe(true);
  });
});

describe("Crossbones native encounter cards", () => {
  it("putting Hydra Bomber into play never resolves its When Revealed choice", () => {
    let s = base();
    const bomber = take(s, "04066");
    const hp = s.player.hp;
    s = settle(
      native(s, { type: "mutagen:put-minion", piece: bomber, playerId: "p1" }),
    );
    expect(s.minions.find((p) => p.id === bomber.id)?.engagedWith).toBe("p1");
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBe(0);
  });
  it.each(["damage", "threat"])(
    "Hydra Bomber chooses actual %s on reveal",
    (choice) => {
      let s = base();
      const hp = s.player.hp;
      s = reveal(s, "04066");
      const option = s.prompt?.options.find((o) =>
        choice === "damage" ? /damage/i.test(o.label) : /threat/i.test(o.label),
      );
      expect(option, JSON.stringify(s.prompt)).toBeDefined();
      s = settle(choose(reload(s), option!.id));
      expect(s.player.hp).toBe(hp - (choice === "damage" ? 2 : 0));
      expect(s.scheme.threat).toBe(choice === "threat" ? 1 : 0);
      expect(s.minions.filter((p) => p.code === "04066")).toHaveLength(1);
    },
  );
  it("Hard as Nails gives a Tough status without healing", () => {
    let s = base();
    s.villain.hp -= 4;
    const hp = s.villain.hp;
    s = settle(reveal(s, "04068"));
    expect(s.villain.tough).toBe(true);
    expect(s.villain.hp).toBe(hp);
  });
  it("Hard as Nails heals only three when already Tough", () => {
    let s = base();
    s.villain.hp -= 4;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = settle(reveal(s, "04068"));
    expect(s.villain.hp).toBe(s.villain.maxHp - 1);
    expect(s.villain.toughCards).toBe(1);
  });
  it.each([false, true])(
    "Hard as Nails boost gives Tough or heals without numeric boost (already Tough %s)",
    (tough) => {
      let s = base();
      s.villain.hp -= 4;
      s.villain.tough = tough;
      s.villain.toughCards = tough ? 1 : 0;
      const hp = s.player.hp;
      top(s, "04068");
      s = settle(attack(s));
      expect(s.player.hp).toBe(hp - 1);
      expect(s.villain.tough).toBe(true);
      expect(s.villain.hp).toBe(s.villain.maxHp - (tough ? 1 : 4));
    },
  );
  it("Full Auto in alter ego deals one facedown Surge card", () => {
    let s = base();
    s.player.form = "alter";
    const hp = s.player.hp;
    s = settle(reveal(s, "04067"));
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.hp).toBe(hp);
  });
  it("Full Auto uses modified ATK, adds numeric icons and never executes discarded boost stars", () => {
    let s = attached(base(), "04065");
    const hp = s.player.hp;
    const discarded = top(s, "04068", "04066");
    const next = s.encounter.deck[2].id;
    s = settle(reveal(s, "04067"));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.tough).toBe(false);
    expect(s.encounter.deck[0].id).toBe(next);
    for (const p of discarded)
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Full Auto stops its fixed discard count at the first encounter-deck exhaustion", () => {
    let s = attached(base(), "04065");
    const auto = take(s, "04067");
    const bomber = take(s, "04066");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(bomber);
    const hp = s.player.hp;
    const acceleration = s.encounter.acceleration;
    const expectedRecycled = [...s.encounter.discard, bomber]
      .map((p) => p.id)
      .sort();
    s = settle(native(s, { type: "reveal", piece: auto }));
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.encounter.deck.map((p) => p.id).sort()).toEqual(expectedRecycled);
  });
  it("Raid the Armory Incites then reveals the same first Weapon attachment", () => {
    let s = base();
    const [skip, gun] = top(s, "04066", "04064");
    s = settle(reveal(s, "04069"));
    expect(s.scheme.threat).toBe(1);
    expect(s.minions).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.id === skip.id)).toBe(true);
    expect(s.attachments.find((p) => p.id === gun.id)).toMatchObject({
      counters: 2,
      attachedTo: s.villain.id,
    });
  });
  it("Raid the Armory skips non-Weapon Armor and does not consult the separate weapon deck", () => {
    let s = base();
    const weapons = s.crossbones!.weaponDeck.map((p) => p.id);
    const [armor, sidearm] = top(s, "04065", "04149");
    s = settle(reveal(s, "04069"));
    expect(s.encounter.discard.some((p) => p.id === armor.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === sidearm.id)).toBe(true);
    expect(s.crossbones!.weaponDeck.map((p) => p.id)).toEqual(weapons);
  });
  it("Raid the Armory stops at its first deck exhaustion with no Weapon found", () => {
    let s = base();
    const raid = take(s, "04069");
    const bombers = [take(s, "04066"), take(s, "04066")];
    s.encounter.dealt.push(
      ...s.encounter.deck.splice(0),
      ...s.encounter.discard.splice(0),
    );
    s.encounter.deck.push(...bombers);
    const acceleration = s.encounter.acceleration;
    s = settle(native(s, { type: "reveal", piece: raid }));
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.encounter.deck.map((p) => p.id).sort()).toEqual(
      bombers.map((p) => p.id).sort(),
    );
    expect(s.attachments).toHaveLength(0);
    expect(s.minions).toHaveLength(0);
  });
  it("Enhanced Spider-Sense cancels Full Auto without discarding any encounter card", () => {
    let s = base();
    const event = take(s, "01004", "p1");
    const resource = take(s, "01089", "p1");
    s.player.hand.push(event, resource);
    const fullAuto = take(s, "04067");
    const deck = s.encounter.deck.map((p) => p.id);
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: fullAuto });
    s = choose(reload(s), "01004");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    expect(s.encounter.discard.some((p) => p.id === fullAuto.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it.each(["hero", "alter"])(
    "Crossbones' Assault activates against its actual thwarting %s seat",
    (form) => {
      let s = base(true);
      s = settle(reveal(s, "04070"));
      const side = s.sideSchemes.find((p) => p.code === "04070")!;
      expect(side.counters).toBe(4);
      expect(escalation(s)).toBe(2);
      seatView(s, "p2").player.form = form as "hero" | "alter";
      const hp1 = seatView(s, "p1").player.hp;
      const hp2 = seatView(s, "p2").player.hp;
      top(s, "04068");
      s = settle(
        native(s, {
          type: "thwart",
          target: side.id,
          amount: side.counters,
          actorId: "p2",
        }),
      );
      expect(seatView(s, "p1").player.hp).toBe(hp1);
      expect(seatView(s, "p2").player.hp).toBe(hp2 - (form === "hero" ? 1 : 0));
      expect(s.scheme.threat).toBe(form === "alter" ? 1 : 0);
      expect(s.encounter.discard.some((p) => p.id === side.id)).toBe(true);
    },
  );
  it("blank Assault has no When Defeated activation", () => {
    let s = settle(reveal(base(), "04070"));
    const side = s.sideSchemes.find((p) => p.code === "04070")!;
    blank(s, side);
    const hp = s.player.hp;
    const deck = s.encounter.deck.map((p) => p.id);
    s = settle(
      native(s, { type: "thwart", target: side.id, amount: side.counters }),
    );
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
  });
  it.each([false, true])(
    "Cornered Staff begins at fixed three and adds one discarded card per player (team %s)",
    (team) => {
      let s = base(team);
      const discarded = top(s, ...(team ? ["04065", "04068"] : ["04065"]));
      s = settle(reveal(s, "04071"));
      expect(s.sideSchemes.find((p) => p.code === "04071")?.counters).toBe(6);
      expect(targets(s, "scheme").some((t) => t.id === "main")).toBe(false);
      expect(s.villain.tough).toBe(false);
      for (const p of discarded)
        expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    },
  );
  it("Cornered Staff stops its multiplayer discard count at the first deck exhaustion", () => {
    let s = base(true);
    const staff = take(s, "04071");
    const armor = take(s, "04065");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(armor);
    const expectedRecycled = [...s.encounter.discard, armor]
      .map((p) => p.id)
      .sort();
    const acceleration = s.encounter.acceleration;
    s = settle(native(s, { type: "reveal", piece: staff }));
    expect(s.sideSchemes.find((p) => p.id === staff.id)?.counters).toBe(6);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.encounter.deck.map((p) => p.id).sort()).toEqual(expectedRecycled);
  });
});

describe("Crossbones preserves the same character across physical stages", () => {
  it("native Steel Fist can spend Tough to stun and confuse the next physical stage", () => {
    let s = base(false, "standard", "colossus");
    s.player.tough = true;
    s.player.toughCards = 1;
    s.villain.hp = 1;
    s.villain.counters = 3;
    const old = s.villain.id;
    const event = take(s, "32008", "p1");
    const resource = take(s, "32024", "p1");
    s.player.hand.push(event, resource);
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = choose(s, old);
    expect(s.villain.stage).toBe(2);
    expect(s.villain.id).not.toBe(old);
    expect(s.villain.counters).toBe(3);
    expect(s.prompt?.title).toBe("Steel Fist");
    s = settle(choose(reload(s), "discard"));
    expect(s.villain).toMatchObject({ stunned: true, confused: true });
    expect(s.player.tough).toBe(false);
    expect(s.removed.find((p) => p.id === old)?.code).toBe("04058");
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("native Heroic Strike stuns the next same-title stage after physical payment", () => {
    let s = base(false, "standard", "captain_america");
    s.villain.hp = 1;
    const old = s.villain.id;
    const event = take(s, "03004", "p1");
    const physicalResource = s.player.deck.find(
      (p) => card(p).type_code === "resource" && !!card(p).resource_physical,
    )!;
    const otherResource = s.player.deck.find(
      (p) => card(p).type_code === "resource" && p.id !== physicalResource.id,
    )!;
    const resources = [physicalResource, otherResource];
    expect(resources.every(Boolean)).toBe(true);
    s.player.deck = s.player.deck.filter(
      (p) => !resources.some((r) => r.id === p.id),
    );
    s.player.hand.push(event, ...resources);
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
    if (s.prompt?.options.some((o) => o.id === old)) s = choose(s, old);
    s = settle(s);
    expect(s.villain.stage).toBe(2);
    expect(s.villain.id).not.toBe(old);
    expect(s.villain.stunned).toBe(true);
    expect(s.removed.find((p) => p.id === old)?.code).toBe("04058");
  });
  it("native Magic Blast keeps its second damage packet and statuses on the continuing villain", () => {
    let s = base(false, "standard", "doctor_strange");
    s.villain.hp = 1;
    const old = s.villain.id;
    const event = take(s, "09004", "p1");
    const wild = take(s, "09002", "p1");
    expect(card(wild).resource_wild).toBe(1);
    s.player.deck.unshift(wild);
    const resources = s.player.deck
      .filter(
        (p) =>
          card(p).type_code === "resource" &&
          (card(p).resource_physical || 0) +
            (card(p).resource_mental || 0) +
            (card(p).resource_energy || 0) >=
            2,
      )
      .slice(0, 2);
    s.player.deck = s.player.deck.filter(
      (p) => !resources.some((r) => r.id === p.id),
    );
    s.player.hand.push(event, ...resources);
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
    if (s.prompt?.options.some((o) => o.id === old)) s = choose(s, old);
    s = settle(s);
    expect(s.villain).toMatchObject({
      stage: 2,
      stunned: true,
      confused: true,
      hp: 12,
    });
    expect(s.player.discard.some((p) => p.id === wild.id)).toBe(true);
  });
  it("Melee cannot choose the next stage as its other enemy", () => {
    let s = base();
    s.villain.hp = 3;
    const old = s.villain.id;
    s = settle(native(s, { type: "ms:melee-first", target: old }));
    expect(s.villain).toMatchObject({ stage: 2, hp: 14 });
    expect(s.prompt).toBeNull();
  });
  it("a queued activation follows the continuing character while retaining the old physical stage", () => {
    let s = base();
    const old = s.villain.id;
    s.player.form = "alter";
    s = settle(
      native(
        s,
        { type: "damage", target: old, amount: s.villain.hp, source: "hero" },
        { type: "enemyScheme", id: old },
      ),
    );
    expect(s.villain.stage).toBe(2);
    expect(s.scheme.threat > 0 || s.scheme.index > 0).toBe(true);
    expect(s.removed.find((p) => p.id === old)?.code).toBe("04058");
  });
  it("Steel Fist does not rebind a defeated minion to the villain", () => {
    let s = base(false, "standard", "colossus");
    s.player.tough = true;
    s.player.toughCards = 1;
    const minion = take(s, "04066");
    minion.engagedWith = "p1";
    s.minions.push(minion);
    const event = take(s, "32008", "p1");
    const resource = take(s, "32024", "p1");
    s.player.hand.push(event, resource);
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = settle(choose(s, minion.id));
    expect(s.player.tough).toBe(true);
    expect(s.villain).toMatchObject({ stunned: false, confused: false });
    expect(s.encounter.discard.some((p) => p.id === minion.id)).toBe(true);
  });
  it("does not rebind removed main-scheme target IDs or physical cleanup IDs", () => {
    let s = base();
    const oldMain = s.crossbones!.currentMain.id;
    s = settle(
      native(s, { type: "threat", target: "main", amount: schemeLimit(s) }),
    );
    expect(s.removed.some((p) => p.id === oldMain)).toBe(true);
    const oldVillain = s.villain.id;
    s = damage(s, s.villain.hp);
    s = settle(
      native(
        s,
        { type: "status", target: oldMain, status: "stunned" },
        { type: "finishResolution", id: oldVillain },
      ),
    );
    expect(s.villain.stunned).toBe(false);
    expect(s.villain.stage).toBe(2);
    expect(s.removed.some((p) => p.id === oldVillain)).toBe(true);
  });
});

describe("Crossbones discarded boost counts use Scarlet Witch's native windows", () => {
  const chaos = (s: GameState) =>
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === "chaos:p1"));
  const crest = (s: GameState) => {
    const p = take(s, "15009", "p1");
    seatView(s, "p1").player.inPlay.push(p);
    return p;
  };
  function withNextEvolution(team = false) {
    let s = base(team, "standard", "scw");
    // Import the published nemesis through Shadows of the Past; no fixture
    // duplicates or substitutes the side scheme or its companion cards.
    delete (s as Fixture).crossbonesOriginals;
    s = settle(reveal(s, "01190"));
    expect(s.sideSchemes.some((p) => p.code === "15024")).toBe(true);
    (s as Fixture).crossbonesOriginals = physical(s).map(({ id, code }) => ({
      id,
      code,
    }));
    return s;
  }

  it("Chaos Control replaces the Gun's discarded count without resolving the replacement's star", () => {
    let s = attached(base(false, "standard", "scw"), "04064");
    const hp = s.player.hp;
    const [original, replacement] = top(s, "04065", "04068", "04066");
    s = chaos(attack(s));
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.discard.some((p) => p.id === original.id)).toBe(true);
    expect(s.encounter.deck[0].id).toBe(replacement.id);
    s = choose(reload(s), "chaos:p1");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hp).toBe(hp);
    expect(s.villain.tough).toBe(false);
    expect(s.flags.scwChaosControlPhase).toBeTruthy();
    expect(s.encounter.discard.some((p) => p.id === replacement.id)).toBe(true);
    s = settle(choose(reload(s), "hero"));
    expect(s.player.hp).toBe(hp);
  });

  it("declining the Gun count preserves Chaos Control for the ordinary attack boost", () => {
    let s = attached(base(false, "standard", "scw"), "04064");
    const hp = s.player.hp;
    top(s, "04065", "04068", "04066");
    s = choose(reload(chaos(attack(s))), "continue");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.flags.scwChaosControlPhase).toBeUndefined();
    s = chaos(choose(reload(s), "hero"));
    s = settle(choose(reload(s), "chaos:p1"));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.flags.scwChaosControlPhase).toBeTruthy();
  });

  it("Crest modifies Gun damage while its final-ammo cleanup waits for the damage packet", () => {
    let s = attached(base(false, "standard", "scw"), "04064");
    const gun = s.attachments.find((p) => p.code === "04064")!;
    gun.counters = 1;
    const actualCrest = crest(s);
    const hp = s.player.hp;
    top(s, "04065", "04068");
    s = choose(reload(chaos(attack(s))), "continue");
    expect(s.attachments.find((p) => p.id === gun.id)?.counters).toBe(0);
    s = choose(reload(s), `crest:${actualCrest.id}:-1`);
    expect(s.prompt?.text).toMatch(/Allocate 2 remaining indirect damage/);
    expect(s.attachments.some((p) => p.id === gun.id)).toBe(true);
    expect(
      s.player.inPlay.find((p) => p.id === actualCrest.id)?.exhausted,
    ).toBe(true);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.attachments.some((p) => p.id === gun.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === gun.id)).toBe(true);
    s = settle(choose(reload(s), "hero"));
    expect(s.player.hp).toBe(hp - 2);
  });

  it("Full Auto discards its whole batch before Chaos Control replaces one card's count", () => {
    let s = attached(base(false, "standard", "scw"), "04149");
    const hp = s.player.hp;
    const [first, second, replacement] = top(s, "04065", "04066", "04068");
    s = chaos(reveal(s, "04067"));
    for (const p of [first, second])
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.deck[0].id).toBe(replacement.id);
    s = settle(choose(reload(s), "chaos:p1"));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.tough).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === replacement.id)).toBe(true);
  });

  it("Cornered Staff aggregates its two counts after one saved Chaos replacement", () => {
    let s = base(true, "standard", "scw");
    const [first, second, replacement] = top(s, "04065", "04066", "04068");
    s = chaos(reveal(s, "04071", "p2"));
    for (const p of [first, second])
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.deck[0].id).toBe(replacement.id);
    s = settle(choose(reload(s), "chaos:p1"));
    expect(s.sideSchemes.find((p) => p.code === "04071")?.counters).toBe(4);
    expect(s.villain.tough).toBe(false);
  });

  it("a teammate's Chaos Control retains the originally attacked player's Gun damage", () => {
    let s = attached(base(true, "standard", "scw"), "04064");
    const witchHP = seatView(s, "p1").player.hp;
    const recipientHP = seatView(s, "p2").player.hp;
    top(s, "04065", "04066", "04068");
    s = chaos(attack(s, "p2"));
    s = choose(reload(s), "chaos:p1");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(seatView(s, "p1").player.hp).toBe(witchHP);
    expect(seatView(s, "p2").player.hp).toBe(recipientHP - 1);
    expect(seatView(s, "p1").flags.scwChaosControlPhase).toBeTruthy();
    expect(seatView(s, "p2").flags.scwChaosControlPhase).toBeUndefined();
    s = settle(choose(reload(s), "hero"));
    expect(seatView(s, "p2").player.hp).toBe(recipientHP - 1);
  });

  it("Next Evolution gives the Gun's discarded star-only card one numerical icon", () => {
    let s = attached(withNextEvolution(), "04064");
    const hp = s.player.hp;
    top(s, "04068", "04066");
    s = choose(reload(chaos(attack(s))), "continue");
    expect(s.prompt?.text).toMatch(/Allocate 1 remaining indirect damage/);
    expect(s.villain.tough).toBe(false);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.player.hp).toBe(hp - 1);
    s = settle(choose(reload(s), "hero"));
    expect(s.player.hp).toBe(hp - 2);
  });

  it("Next Evolution modifies Full Auto's discarded zero-icon count", () => {
    let s = withNextEvolution();
    const hp = s.player.hp;
    top(s, "04068");
    s = settle(reveal(s, "04067"));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.tough).toBe(false);
  });

  it("Next Evolution adds one to every Cornered Staff batch item", () => {
    let s = withNextEvolution(true);
    top(s, "04068", "04066");
    s = settle(reveal(s, "04071"));
    expect(s.sideSchemes.find((p) => p.code === "04071")?.counters).toBe(6);
    expect(s.villain.tough).toBe(false);
  });

  it("Crest can modify Cornered Staff in alter ego without offering Chaos Control", () => {
    let s = base(false, "standard", "scw");
    const actualCrest = crest(s);
    s.player.form = "alter";
    top(s, "04065");
    s = reveal(s, "04071");
    expect(s.prompt?.options.some((o) => o.id === "chaos:p1")).toBe(false);
    s = settle(choose(reload(s), `crest:${actualCrest.id}:-1`));
    expect(s.sideSchemes.find((p) => p.code === "04071")?.counters).toBe(5);
    expect(
      s.player.inPlay.find((p) => p.id === actualCrest.id)?.exhausted,
    ).toBe(true);
  });
});
