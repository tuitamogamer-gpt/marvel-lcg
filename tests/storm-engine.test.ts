import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  enemyStats,
  paymentSources,
  cardCost,
  dispatch,
} from "../src/game/engine.js";
import {
  card,
  heroStats,
  pieceHP,
  maxHP,
  imageFor,
  MODULES,
} from "../src/game/cards.js";
import {
  stormWeather,
  stormGlobal,
  STORM_SCRIPT_CODES,
} from "../src/game/storm.js";
import { isTextBlank } from "../src/game/card-text.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { deckErrors } from "../src/game/decks.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  native,
  pay,
  play,
  respond,
  reload,
  target,
  until,
} from "./dv-test-helpers.js";

function starting(module = "bomb_scare") {
  return newGame({
    heroId: "storm",
    aspect: "leadership",
    villainId: "rhino",
    module,
    seed: 36001,
    pacing: "expert",
  });
}
function base(weather = "36002", module = "bomb_scare") {
  let s = command(starting(module), { type: "MULLIGAN", ids: [] });
  expect(s.prompt?.title).toBe("Choose starting weather");
  s = finish(choose(s, s.prompt!.options.find((o) => o.image === weather)!.id));
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.form = "hero";
  s.villain.hp = s.villain.maxHp = 60;
  s.scheme.threat = 10;
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
) {
  for (const pile of [
    s.player.deck,
    s.player.hand,
    s.player.discard,
    s.player.inPlay,
  ]) {
    const i = pile.findIndex((p) => p.code === code);
    if (i >= 0) {
      const p = pile.splice(i, 1)[0];
      s.player[zone].push(p);
      return p;
    }
  }
  const p = makePiece(s, code);
  p.ownerId = s.activePlayerId;
  s.player[zone].push(p);
  return p;
}
function reveal(s: GameState, code: string) {
  const reserve = s.player.setAside || [],
    i = reserve.findIndex((p) => p.code === code),
    p = i >= 0 ? reserve.splice(i, 1)[0] : makePiece(s, code);
  return native(s, { type: "reveal", piece: p });
}
function cast(s: GameState, code: string, resources: string[]) {
  const event = take(s, code);
  const paid = resources.map((code) => take(s, code));
  return play(s, event, paid);
}

describe("Storm original source and physical weather", () => {
  it("registers all 40 original faces, a 40-card starter and the five-card Shadow King set", () => {
    const faces = catalog.filter((c) => c.pack_code === "storm");
    expect(faces).toHaveLength(40);
    expect(faces.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    expect(STORM_SCRIPT_CODES).toHaveLength(37);
    expect(
      deckErrors("storm", "leadership", heroStarterCodes("storm")),
    ).toEqual([]);
    expect(heroStarterCodes("storm")).toHaveLength(40);
    const s = starting("shadow_king");
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "shadow_king"),
    ).toHaveLength(5);
    expect(MODULES.at(-1)?.id).toBe("shadow_king");
    expect(imageFor("36001a")).toContain("36001b");
    expect(imageFor("36001b")).toContain("36001a");
  });
  it.each(["36002", "36003", "36004", "36005"])(
    "chooses %s after mulligan, no Special, preserves all four IDs across save",
    (weather) => {
      let s = starting();
      expect(s.player.hand).toHaveLength(6);
      expect(s.player.deck).toHaveLength(34);
      const ids = s.player
        .setAside!.filter((p) => p.code < "36006")
        .map((p) => p.id);
      expect(ids).toHaveLength(4);
      expect(s.player.inPlay).toHaveLength(0);
      s = command(reload(s), { type: "MULLIGAN", ids: [] });
      s = finish(
        choose(s, s.prompt!.options.find((o) => o.image === weather)!.id),
      );
      expect(s.player.hand).toHaveLength(6);
      expect(stormWeather(s)?.code).toBe(weather);
      expect(
        [...s.player.inPlay, ...s.player.setAside!]
          .filter((p) => p.code < "36006")
          .map((p) => p.id)
          .sort(),
      ).toEqual(ids.sort());
    },
  );
  it("Weather Control swaps a physical support once per round, Clear Skies draws and Cape readies", () => {
    let s = base("36004");
    const cape = take(s, "36007", "inPlay");
    s.player.exhausted = true;
    const ids = [
      stormWeather(s)!,
      ...s.player.setAside!.filter((p) => p.code < "36006"),
    ].map((p) => p.id);
    s = command(s, { type: "ABILITY", id: "identity", action: "weather" });
    s = choose(s, s.prompt!.options.find((o) => o.image === "36002")!.id);
    s = respond(s, /Storm's Cape/);
    s = finish(s);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === cape.id)?.exhausted).toBe(true);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    expect(
      [...s.player.inPlay, ...s.player.setAside!]
        .filter((p) => p.code < "36006")
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids.sort());
  });
  it("Thunderstorm modifies Storm, allies and enemies; Hurricane retaliates against a basic attack", () => {
    let s = base("36004");
    expect(heroStats(s).attack).toBe(3);
    expect(enemyStats(s, s.villain).attack).toBe(3);
    take(s, "36006", "inPlay");
    take(s, "36007", "inPlay");
    expect(heroStats(s)).toMatchObject({ thwart: 2, defense: 2 });
    s = base("36003");
    const hp = s.player.hp;
    s = target(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    s = finish(s);
    expect(s.player.hp).toBe(hp - 1);
  });
  it("Clear Skies removes statuses from every character even in alter ego", () => {
    let s = base("36004");
    const ally = take(s, "36014", "inPlay");
    ally.stunned = true;
    s.player.stunned = true;
    s.villain.confused = true;
    s = command(s, { type: "ABILITY", id: "identity", action: "weather" });
    s = finish(
      choose(s, s.prompt!.options.find((o) => o.image === "36002")!.id),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.villain.confused).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.stunned).toBe(false);
    s.player.form = "alter";
    s = finish(
      native(s, { type: "status", target: "hero", status: "confused" }),
    );
    expect(s.player.confused).toBe(false);
  });
  it("Blizzard blanks a non-Elite minion through this round and does not blank printed attack", () => {
    let s = base("36002");
    const m = makePiece(s, "01103");
    m.engagedWith = "p1";
    s.minions.push(m);
    s = command(s, { type: "ABILITY", id: "identity", action: "weather" });
    s = choose(s, s.prompt!.options.find((o) => o.image === "36005")!.id);
    s = finish(choose(s, m.id));
    expect(isTextBlank(s, s.minions[0])).toBe(true);
    expect(enemyStats(s, s.minions[0]).attack).toBe(
      Math.max(0, card(m).attack! - 1),
    );
    s.round++;
    expect(isTextBlank(s, s.minions[0])).toBe(false);
  });
  it("Crown pays its current weather's resource and the X-Jet works for another X-Men identity", () => {
    let s = base("36004");
    const crown = take(s, "36006", "inPlay"),
      jet = take(s, "36023", "inPlay");
    expect(paymentSources(s).find((p) => p.id === crown.id)?.resources).toEqual(
      ["energy"],
    );
    expect(paymentSources(s).find((p) => p.id === jet.id)?.resources).toEqual([
      "wild",
    ]);
    const event = take(s, "36010");
    s = play(s, event, [crown, jet]);
    s = finish(choose(s, "main:3"));
    expect(s.player.inPlay.find((p) => p.id === crown.id)?.exhausted).toBe(
      true,
    );
  });
});
describe("Storm signature events and encounter rules", () => {
  it("Lightning Bolt deals 8 then Thunderstorm's separate nonattack 2; stun replaces entire event", () => {
    let s = base("36004");
    s = target(cast(s, "36011", ["36027", "36028"]), s.villain.id);
    expect(s.villain.hp).toBe(52);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    s = base("36004");
    s.player.stunned = true;
    s = finish(cast(s, "36011", ["36027", "36028"]));
    expect(s.villain.hp).toBe(60);
    expect(s.player.stunned).toBe(false);
  });
  it("Torrential Rain distributes exactly three, then Hurricane removes two", () => {
    let s = base("36003");
    const side = makePiece(s, "01107");
    side.counters = 4;
    s.sideSchemes.push(side);
    s = cast(s, "36010", ["36027"]);
    s = choose(s, `${side.id}:1`);
    s = choose(s, "main:2");
    expect(s.scheme.threat).toBe(8);
    expect(s.sideSchemes[0].counters).toBe(3);
    s = finish(target(s, side.id));
    expect(s.sideSchemes[0].counters).toBe(1);
  });
  it("Blast of Wind damages the villain and every engaged minion before its Special", () => {
    let s = base();
    const m = makePiece(s, "01103");
    m.engagedWith = "p1";
    s.minions.push(m);
    s = cast(s, "36013", ["36027", "36028"]);
    s = finish(choose(s, "p1"));
    expect(s.villain.hp).toBe(57);
    expect(s.player.hand).toHaveLength(1);
    expect(s.minions).toHaveLength(0);
  });
  it("Weather Goddess allows another swap without consuming Weather Control", () => {
    let s = base();
    s = cast(s, "36009", []);
    s = choose(s, s.prompt!.options.find((o) => o.image === "36004")!.id);
    s = finish(target(s, s.villain.id));
    expect(nativeHeroAbilityOptions(s).some((o) => o.id === "weather")).toBe(
      true,
    );
  });
  it("Claustrophobia preserves its physical piece, forces alter ego and locks hero form until exhausted removal", () => {
    let s = base();
    s = finish(reveal(s, "36030"));
    const obligation = s.player.inPlay.find((p) => p.code === "36030")!;
    expect(s.player.form).toBe("alter");
    expect(dispatch(reload(s), { type: "FLIP" }).error).toBeTruthy();
    s = finish(
      command(s, {
        type: "ABILITY",
        id: obligation.id,
        action: "claustrophobia",
      }),
    );
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
  });
  it("Shadows of the Past reveals original Callisto and scheme, and shuffles exactly remaining nemesis pieces", () => {
    let s = base();
    const ids = s.player
      .setAside!.filter((p) => p.code >= "36031")
      .map((p) => p.id);
    s.player.form = "alter";
    s = finish(reveal(s, "01190"));
    expect(s.minions.some((p) => p.code === "36031")).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "36032")?.counters).toBe(2);
    expect(
      [...s.minions, ...s.sideSchemes, ...s.encounter.deck].filter((p) =>
        ids.includes(p.id),
      ),
    ).toHaveLength(5);
  });
  it("Switchblade chooses highest printed ATK and grants its attached minion +2 ATK", () => {
    let s = base("36005");
    const m = makePiece(s, "36031");
    m.engagedWith = "p1";
    s.minions.push(m);
    s = finish(target(reveal(s, "36033"), m.id));
    expect(enemyStats(s, s.minions[0]).attack).toBe(4);
    expect(s.attachments[0].attachedTo).toBe(m.id);
  });
  it("Knife Fight gives Callisto Tough, then deals reciprocal nonattack damage", () => {
    let s = base("36004");
    const m = makePiece(s, "36031");
    m.engagedWith = "p1";
    s.minions.push(m);
    const hp = s.player.hp;
    s = finish(target(reveal(s, "36034"), m.id));
    expect(s.player.hp).toBe(hp - 4);
    expect(s.minions[0].damage).toBe(0);
    expect(s.minions[0].tough).toBe(false);
  });
});
describe("Storm player pool and Shadow King", () => {
  it("Uncanny X-Men adds ally health and conditional X-Men discount; Endurance adds identity HP", () => {
    const s = base();
    take(s, "36018", "inPlay");
    const ally = take(s, "36014", "inPlay");
    expect(pieceHP(s, ally)).toBe(4);
    expect(cardCost(s, card("36015"))).toBe(2);
    s.player.form = "alter";
    expect(cardCost(s, card("36015"))).toBe(3);
    take(s, "36026", "inPlay");
    expect(maxHP(s)).toBe(13);
  });
  it("Havok discards one encounter card and uses numeric boost icons for attack and consequential damage", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay");
    s.encounter.deck.unshift(makePiece(s, "01107"));
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(56);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
    expect(s.encounter.discard.some((p) => p.code === "01107")).toBe(true);
  });
  it("Leadership Skill spends once per action and removes its exhausted Uses at zero", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay"),
      skill = take(s, "36019", "inPlay");
    skill.counters = 1;
    s.encounter.deck = [makePiece(s, "01104")];
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = target(s, "main");
    s = choose(s, skill.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.discard.some((p) => p.id === skill.id)).toBe(true);
  });
  it("Pixie returns an actual discarded X-Men ally only after being played from hand", () => {
    let s = base();
    const ally = take(s, "36014", "discard");
    s = cast(s, "36017", ["36027"]);
    s = respond(s, /Pixie/);
    s = finish(target(s, ally.id));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Forge searches an actual support and shuffles its deck", () => {
    let s = base();
    const jet = s.player.deck.find((p) => p.code === "36023")!;
    const seed = s.seed;
    s = cast(s, "36022", ["36027"]);
    s = respond(s, /Forge/);
    s = finish(choose(s, jet.id));
    expect(s.player.hand.some((p) => p.id === jet.id)).toBe(true);
    expect(s.seed).not.toBe(seed);
  });
  it("Possessed converts lowest-THW ally in place, protects Shadow King, and removal restores the same ally", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay");
    ally.damage = 1;
    const king = makePiece(s, "36036");
    king.engagedWith = "p1";
    s.minions.push(king);
    s = finish(target(reveal(s, "36038"), ally.id));
    expect(s.minions.find((p) => p.id === ally.id)).toMatchObject({
      stormControlled: true,
      treatedAsMinion: true,
      engagedWith: "p1",
      damage: 1,
    });
    expect(card(s.minions.find((p) => p.id === ally.id)!).traits).toContain(
      "Controlled",
    );
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === ally.id)!,
      ).scheme,
    ).toBe(1);
    s = finish(
      native(s, { type: "damage", target: king.id, amount: 5, source: "hero" }),
    );
    expect(s.minions.find((p) => p.id === king.id)?.damage).toBe(0);
    const possession = s.attachments.find((p) => p.code === "36038")!;
    s = finish(
      native(s, { type: "storm:discard-target", target: possession.id }),
    );
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
    });
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
  });
  it("ending Possessed returns an ally to its physical owner after an earlier control transfer", () => {
    let s = newGame({
      heroId: "storm",
      aspect: "leadership",
      villainId: "rhino",
      module: "shadow_king",
      seed: 360382,
      pacing: "expert",
      heroes: [
        {
          heroId: "storm",
          aspect: "leadership",
          deckCards: heroStarterCodes("storm"),
        },
        {
          heroId: "spider_man",
          aspect: "justice",
          deckCards: heroStarterCodes("spider_man"),
        },
      ],
    });
    for (let n = 0; s.phase === "mulligan" && n < 5; n++) {
      s = command(s, { type: "MULLIGAN", ids: [] });
      if (s.prompt)
        s = finish(
          s,
          (v) => v.prompt?.options.find((o) => o.image === "36002")?.id,
        );
    }
    s = finish(
      s,
      (v) => v.prompt?.options.find((o) => o.image === "36002")?.id,
    );
    const owner = seatView(s, "p2");
    const pile = [owner.player.deck, owner.player.hand].find((pile) =>
      pile.some((p) => p.code === "01002"),
    )!;
    const ally = pile.splice(
      pile.findIndex((p) => p.code === "01002"),
      1,
    )[0];
    expect(ally.ownerId).toBe("p2");
    seatView(s, "p1").player.inPlay.push(ally);
    s = finish(target(reveal(s, "36038"), ally.id));
    expect(s.minions.find((p) => p.id === ally.id)?.engagedWith).toBe("p1");
    const possession = s.attachments.find((p) => p.code === "36038")!;
    s = finish(
      native(reload(s), {
        type: "storm:discard-target",
        target: possession.id,
      }),
    );
    expect(
      seatView(s, "p2").player.inPlay.filter((p) => p.id === ally.id),
    ).toHaveLength(1);
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
  });
  it("Ruler has fixed six threat and its defeat discards a real Possessed attachment", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay");
    s = finish(target(reveal(s, "36038"), ally.id));
    s = finish(reveal(s, "36037"));
    const scheme = s.sideSchemes.find((p) => p.code === "36037")!;
    expect(scheme.counters).toBe(6);
    s = finish(native(s, { type: "thwart", target: scheme.id, amount: 6 }));
    expect(s.attachments.some((p) => p.code === "36038")).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Astral Attack activates a Controlled ally as a minion and its boost recycles Shadow King cards", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay");
    s = finish(target(reveal(s, "36038"), ally.id));
    s.player.form = "alter";
    s.scheme.threat = 1;
    const before = s.scheme.threat;
    s = finish(reveal(s, "36039"));
    expect(s.scheme.threat).toBe(before + 1);
    const recycled = makePiece(s, "36036");
    s.encounter.discard.push(recycled);
    s = finish(native(s, { type: "storm:recycle-shadow" }));
    expect(s.encounter.deck.some((p) => p.id === recycled.id)).toBe(true);
  });
});

describe("Storm native interrupt and additional pool windows", () => {
  it("Flash Freeze pays the real event during a villain attack and applies signed ATK before boost icons", () => {
    let s = base();
    s.phase = "villain";
    s.encounter.deck.unshift(makePiece(s, "01107"));
    const event = take(s, "36012"),
      resource = take(s, "36029"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Flash Freeze/, "36012");
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay).toHaveLength(1);
  });
  it("Flash Freeze's Blizzard Special blanks the selected minion before the attack continues", () => {
    let s = base("36005");
    s.phase = "villain";
    const minion = makePiece(s, "01103");
    minion.engagedWith = "p1";
    s.minions.push(minion);
    take(s, "36012");
    const resource = take(s, "36029");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Flash Freeze/);
    s = pay(s, [resource]);
    s = finish(target(s, minion.id));
    expect(
      isTextBlank(
        s,
        s.minions.find((p) => p.id === minion.id)!,
      ),
    ).toBe(true);
    expect(s.player.hp).toBe(10);
  });
  it("Mirage stuns only an enemy whose current SCH is below her THW", () => {
    let s = base("36004");
    s = cast(s, "36015", ["36027", "36028"]);
    s = respond(s, /Mirage/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.stunned).toBe(true);
  });
  it("Gentle takes the extra consequential damage only when attacking the villain", () => {
    let s = base();
    const ally = take(s, "36016", "inPlay");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
  });
  it("Hangar Bay offers its real response only after a surviving ally defends", () => {
    let s = base("36005");
    const ally = take(s, "36014", "inPlay"),
      bay = take(s, "36035", "inPlay");
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    s = choose(s, ally.id);
    s = respond(s, /Hangar Bay/);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === bay.id)?.exhausted).toBe(true);
  });
  it('"To Me, My X-Men!" returns the same surviving ally to its owner at phase end', () => {
    let s = base();
    const ally = s.player.deck.find((p) => p.code === "36014")!;
    s.player.deck.splice(s.player.deck.indexOf(ally), 1);
    s.player.deck.unshift(ally);
    s = cast(s, "36020", ["36027"]);
    s = finish(choose(s, ally.id));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    s = finish(native(s, { type: "allReady" }));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
  });
  it("The Shadow King's reveal searches, reveals and attaches an actual Possessed from the encounter deck", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay"),
      possession = makePiece(s, "36038");
    s.encounter.deck.unshift(possession);
    s = finish(target(reveal(s, "36036"), ally.id));
    expect(
      s.attachments.some(
        (p) => p.id === possession.id && p.attachedTo === ally.id,
      ),
    ).toBe(true);
    expect(s.minions.some((p) => p.code === "36036")).toBe(true);
  });
  it("Ruler's boost reveals its same physical card only when a Controlled minion engages you", () => {
    let s = base();
    const ally = take(s, "36014", "inPlay");
    s = finish(target(reveal(s, "36038"), ally.id));
    const ruler = makePiece(s, "36037");
    s.encounter.deck.unshift(ruler);
    s.phase = "villain";
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.sideSchemes.some((p) => p.id === ruler.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === ruler.id)).toBe(false);
  });
});

describe("Storm reveal boundary conservation", () => {
  it("Possessed without an eligible ally surges and discards instead of staying unattached", () => {
    let s = base();
    s = finish(reveal(s, "36038"));
    expect(s.attachments.some((p) => p.code === "36038")).toBe(false);
    expect(s.encounter.discard.filter((p) => p.code === "36038")).toHaveLength(
      1,
    );
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Callisto's Tough is present before Knife Fight's optional cancellation window", () => {
    let s = base("36004");
    const callisto = makePiece(s, "36031");
    callisto.engagedWith = "p1";
    s.minions.push(callisto);
    take(s, "01075", "inPlay");
    take(s, "36028");
    s = reveal(s, "36034");
    expect(s.prompt?.options.some((o) => o.label.includes("Black Widow"))).toBe(
      true,
    );
    expect(s.minions.find((p) => p.id === callisto.id)?.tough).toBe(true);
  });
});
