import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  passId,
  play,
  put,
  reload,
  respond,
  target,
} from "./dv-test-helpers.js";

function base(hero = false, team = false) {
  let s = newGame({
    heroId: "nightcrawler",
    aspect: "protection",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 48001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "nightcrawler", aspect: "protection" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (hero) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.scheme.threat = 0;
  s.villain.hp = 50;
  s.villain.maxHp = 100;
  s.encounter.deck = Array.from({ length: 30 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function actualEncounter(s: GameState, code: string) {
  for (const seat of s.players) {
    const zone = seatView(s, seat).player.setAside || [];
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  for (const zone of [s.encounter.deck, s.encounter.discard]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  return makePiece(s, code);
}
const reveal = (s: GameState, code: string, actorId = s.activePlayerId) =>
  native(s, { type: "reveal", piece: actualEncounter(s, code), actorId });
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.inheritorBoosts || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.minions,
    ...s.attachments,
    ...s.sideSchemes,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.removed,
    ...(s.victoryDisplay || []),
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
const exact = (s: GameState, ids: string[]) => {
  for (const id of ids)
    expect(
      physical(s).filter((p) => p.id === id),
      id,
    ).toHaveLength(1);
};

describe("Nightcrawler original obligation and nemesis encounter flow", () => {
  it("sets aside five distinct physical nemesis cards and Shadows introduces those same IDs once", () => {
    let s = base();
    const reserve = (s.player.setAside || []).filter(
      (p) => card(p).set_code === "nightcrawler_nemesis",
    );
    expect(reserve.map((p) => p.code).sort()).toEqual([
      "48027",
      "48028",
      "48029",
      "48030",
      "48030",
    ]);
    s = finish(reveal(s, "01190"));
    expect(
      s.minions.some(
        (p) => p.id === reserve.find((p) => p.code === "48027")!.id,
      ),
    ).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "48028")?.counters).toBe(5);
    exact(
      reload(s),
      reserve.map((p) => p.id),
    );
  });
  it("Shadows still gains Surge when Brimstone Strike already introduced Azazel from reserve", () => {
    let s = base();
    const reserve = [...(s.player.setAside || [])];
    s = finish(reveal(s, "48030"));
    const azazel = s.minions.find((p) => p.code === "48027")!;
    s = finish(reveal(reload(s), "01190"));
    expect(s.minions.filter((p) => p.id === azazel.id)).toHaveLength(1);
    expect(s.sideSchemes.some((p) => p.code === "48028")).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
    exact(
      s,
      reserve.map((p) => p.id),
    );
  });
  it("Crisis of Faith discards matching events once, leaving non-event upgrades and other events", () => {
    let s = base();
    const [attack, defense, both, upgrade, thwart, resource] = hand(
      s,
      "48007",
      "48011",
      "48017",
      "48006",
      "48009",
      "48023",
    );
    s = finish(choose(reveal(s, "48026"), "discard"));
    expect(s.player.hand.map((p) => p.id)).toEqual(
      [upgrade, thwart, resource].map((p) => p.id),
    );
    for (const p of [attack, defense, both])
      expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.code === "48026")).toHaveLength(
      1,
    );
  });
  it("Crisis of Faith offers its optional flip before exhausting Kurt and removing the actual obligation", () => {
    let s = base(true);
    s = choose(reveal(s, "48026"), "flip");
    s = finish(choose(reload(s), "settle"));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.code === "48026")).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.code === "48026")).toBe(false);
  });
  it("a teammate's revealed obligation is resolved by the Kurt Wagner player", () => {
    let s = base(false, true);
    s = reveal(s, "48026", "p2");
    expect(s.activePlayerId).toBe("p1");
    s = finish(choose(reload(s), "settle"));
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
  });
  it("Brimstone Strike preserves damage, statuses and attachments and does not re-Quickstrike the same player", () => {
    let s = base(true);
    s = finish(reveal(s, "48027"));
    const azazel = s.minions.find((p) => p.code === "48027")!;
    azazel.damage = 1;
    azazel.tough = true;
    s = finish(reveal(s, "48029"));
    const sword = s.attachments.find((p) => p.code === "48029")!;
    const hp = s.player.hp;
    const deck = s.encounter.deck.map((p) => p.id);
    s = finish(reveal(reload(s), "48030"));
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    expect(s.minions.find((p) => p.id === azazel.id)).toMatchObject({
      damage: 1,
      tough: true,
      engagedWith: "p1",
    });
    expect(s.attachments.find((p) => p.id === sword.id)?.attachedTo).toBe(
      azazel.id,
    );
    exact(s, [azazel.id, sword.id]);
  });
  it("Brimstone Strike finds the same Azazel engaged elsewhere, preserves his state, and triggers new engagement Quickstrike", () => {
    let s = base(true, true);
    s = finish(reveal(s, "48027", "p2"));
    const azazel = s.minions.find((p) => p.code === "48027")!;
    azazel.damage = 1;
    s = finish(reveal(reload(s), "48030", "p1"));
    expect(s.minions.find((p) => p.id === azazel.id)).toMatchObject({
      damage: 1,
      engagedWith: "p1",
    });
    expect(seatView(s, "p1").player.hp).toBe(6);
    exact(s, [azazel.id]);
  });
  it.each(["dealt", "assigned", "victory"])(
    "Find cannot take Azazel from the excluded %s area",
    (area) => {
      let s = base();
      const azazel = actualEncounter(s, "48027");
      if (area === "dealt") {
        azazel.dealtTo = "p1";
        s.encounter.dealt.push(azazel);
      } else if (area === "assigned")
        (s.encounter.storedBoosts ||= []).push(azazel);
      else (s.victoryDisplay ||= []).push(azazel);
      s = finish(reveal(reload(s), "48030"));
      expect(s.minions.some((p) => p.id === azazel.id)).toBe(false);
      exact(s, [azazel.id]);
    },
  );
  it("Brimstone Dimension's actual basic-thwart defeat deals the reserved Azazel facedown", () => {
    let s = base(true);
    const azazel = (s.player.setAside || []).find((p) => p.code === "48027")!;
    s = finish(reveal(s, "48028"));
    const scheme = s.sideSchemes.find((p) => p.code === "48028")!;
    const [scout, resource] = hand(s, "48009", "48023");
    s = finish(target(play(s, scout, [resource]), scheme.id));
    const deck = s.encounter.deck.map((p) => p.id);
    s = finish(
      target(
        command(reload(s), { type: "BASIC", action: "thwart" }),
        scheme.id,
      ),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.encounter.dealt.find((p) => p.id === azazel.id)?.dealtTo).toBe(
      "p1",
    );
    expect(s.minions.some((p) => p.id === azazel.id)).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    exact(s, [azazel.id, scheme.id]);
  });
  it("Azazel's boost deals that physical card to Nightcrawler without discarding a second copy", () => {
    let s = base(true);
    const azazel = actualEncounter(s, "48027");
    s.encounter.deck.unshift(azazel);
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.encounter.dealt.find((p) => p.id === azazel.id)?.dealtTo).toBe(
      "p1",
    );
    expect(s.encounter.discard.some((p) => p.id === azazel.id)).toBe(false);
    exact(s, [azazel.id]);
  });
  it("Azazel's Sword uses a saved random hand-card cost after an actual hero defense", () => {
    let s = base(true);
    s = finish(reveal(s, "48029"));
    const sword = s.attachments.find((p) => p.code === "48029")!;
    const cards = hand(s, "48006", "48009", "48023");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    const saved = reload(s);
    const first = finish(respond(s, /Azazel's Sword/));
    const second = finish(respond(saved, /Azazel's Sword/));
    const discarded = (v: GameState) =>
      v.player.discard
        .filter((p) => cards.some((q) => q.id === p.id))
        .map((p) => p.id);
    expect(discarded(first)).toHaveLength(1);
    expect(discarded(second)).toEqual(discarded(first));
    expect(first.encounter.discard.some((p) => p.id === sword.id)).toBe(true);
    expect(first.attachments.some((p) => p.id === sword.id)).toBe(false);
    exact(first, [sword.id, ...cards.map((p) => p.id)]);
  });
  it("Azazel's Sword offers no player-triggered response during a teammate's protected Merc turn", () => {
    let s = base(true, true);
    s = finish(reveal(s, "48029"));
    const sword = s.attachments.find((p) => p.code === "48029")!;
    put(s, "44032", "p2");
    s.turnPlayerId = "p2";
    const cards = hand(s, "48006", "48009", "48023");
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" }),
    );
    expect(seatView(s, "p1").player.hand.map((p) => p.id)).toEqual(
      cards.map((p) => p.id),
    );
    expect(s.attachments.some((p) => p.id === sword.id)).toBe(true);
  });
});

describe("The Crazy Gang actual encounter and activation programs", () => {
  it("Queen finds and reveals the physical Crazy Gang scheme, then deals an encounter if already in play", () => {
    let s = base(true);
    const gang = makePiece(s, "48033");
    s.encounter.discard.push(gang);
    s = finish(reveal(s, "48034"));
    expect(s.sideSchemes.find((p) => p.id === gang.id)?.counters).toBe(2);
    const queen = s.minions.find((p) => p.code === "48034")!;
    const [blast, resource] = hand(s, "48007", "48023");
    s = finish(target(play(s, blast, [resource]), queen.id));
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), queen.id),
    );
    s = finish(reveal(s, "48034"));
    expect(s.encounter.dealt).toHaveLength(1);
    exact(s, [gang.id]);
  });
  it.each([
    ["48035", "confused", "48003"],
    ["48037", "stunned", "48005"],
  ] as const)(
    "%s applies its status first and discards the controlled matching type only when already affected",
    (code, status, discardedCode) => {
      for (const already of [false, true]) {
        let s = base();
        const source = put(s, discardedCode);
        s.player[status] = already;
        s = finish(reveal(s, code));
        expect(s.player[status]).toBe(true);
        expect(s.player.inPlay.some((p) => p.id === source.id)).toBe(!already);
        expect(s.player.discard.some((p) => p.id === source.id)).toBe(already);
      }
    },
  );
  it("Executioner targets the least remaining HP and removes the ally defeated by that forced attack", () => {
    let s = base();
    const ally = put(s, "48002");
    ally.damage = 1;
    s = finish(reveal(s, "48036"));
    expect(s.removed.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(false);
    exact(s, [ally.id]);
  });
  it("Executioner removes the actual ally defender that the forced attack defeats, not its original target", () => {
    let s = base();
    const original = put(s, "48002"),
      defender = put(s, "01083");
    original.damage = 1;
    defender.damage = 1;
    s = reveal(s, "48036");
    s = finish(choose(reload(s), defender.id));
    expect(s.removed.some((p) => p.id === defender.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === original.id)).toBe(true);
    exact(s, [original.id, defender.id]);
  });
  it("a later ordinary Executioner attack discards its defeated ally normally", () => {
    let s = finish(reveal(base(), "48036"));
    const executioner = s.minions.find((p) => p.code === "48036")!;
    const ally = put(s, "48002");
    s = native(s, { type: "enemyAttack", id: executioner.id });
    s = finish(choose(s, ally.id));
    expect(s.removed.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    exact(s, [ally.id]);
  });
  it("Crazy Gang passes a non-Elite minion to the next player after a native scheme and cleans its attached upgrade", () => {
    let s = base(false, true);
    s = finish(reveal(s, "48033"));
    const enemy = minion(s, "01101");
    enemy.damage = 1;
    const [upgrade] = hand(s, "48015");
    s = finish(target(play(s, upgrade), enemy.id));
    s = finish(native(s, { type: "enemyScheme", id: enemy.id, actorId: "p1" }));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.dealt.find((p) => p.id === enemy.id)).toMatchObject({
      dealtTo: "p2",
      damage: 0,
    });
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === upgrade.id),
    ).toBe(true);
    exact(s, [enemy.id, upgrade.id]);
  });
  it("Crazy Gang leaves Elite Azazel in play after he schemes", () => {
    let s = base();
    s = finish(reveal(s, "48033"));
    s = finish(reveal(s, "48027"));
    const azazel = s.minions.find((p) => p.code === "48027")!;
    s = finish(native(s, { type: "enemyScheme", id: azazel.id }));
    expect(s.minions.some((p) => p.id === azazel.id)).toBe(true);
    expect(s.encounter.dealt.some((p) => p.id === azazel.id)).toBe(false);
    exact(s, [azazel.id]);
  });
  it("a public cooperative end-turn phase passes and re-reveals the same minion at the next player", () => {
    let s = base(false, true);
    s = finish(reveal(s, "48033"));
    const enemy = minion(s, "01101");
    enemy.damage = 1;
    s = command(s, { type: "END_TURN", discard: [] });
    s = command(reload(s), { type: "END_TURN", discard: [] });
    for (let n = 0; s.prompt && n < 100; n++) {
      if (s.prompt.kind === "select")
        s = command(reload(s), { type: "SELECT", ids: [] });
      else {
        const id =
          passId(s) ||
          s.prompt.options.find((o) => o.id === "allow")?.id ||
          (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
        expect(id, JSON.stringify(s.prompt)).toBeTruthy();
        s = choose(reload(s), id!);
      }
    }
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      engagedWith: "p2",
      damage: 0,
    });
    exact(reload(s), [enemy.id]);
  });
  it("Off with His Head activates each engaged minion through its real native attack and uses no fallback if any activated", () => {
    let s = base(true);
    const skipped = minion(s, "01101"),
      active = minion(s, "01103");
    skipped.stunned = true;
    const fallback = makePiece(s, "48035");
    s.encounter.deck.unshift(fallback);
    s = finish(reveal(s, "48038"));
    expect(s.minions.find((p) => p.id === skipped.id)?.stunned).toBe(false);
    expect(s.player.hp).toBe(7);
    expect(s.encounter.deck.some((p) => p.id === fallback.id)).toBe(true);
    expect(s.minions.some((p) => p.id === fallback.id)).toBe(false);
    exact(s, [skipped.id, active.id, fallback.id]);
  });
  it("Off with His Head falls back when every attempted activation was replaced by a status card", () => {
    let s = base(true);
    const skipped = minion(s, "01101");
    skipped.stunned = true;
    const found = makePiece(s, "48035");
    s.encounter.deck.unshift(found);
    s = finish(reveal(s, "48038"));
    expect(s.minions.some((p) => p.id === found.id)).toBe(true);
    expect(s.player.confused).toBe(true);
    exact(s, [skipped.id, found.id]);
  });
  it("Off with His Head reveals the actual last discarded minion after immediate encounter reset", () => {
    let s = base();
    const found = makePiece(s, "48035"),
      other = makePiece(s, "01104");
    s.encounter.deck = [found];
    s.encounter.discard = [other];
    s = finish(reveal(s, "48038"));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.minions.some((p) => p.id === found.id)).toBe(true);
    exact(s, [found.id, other.id]);
  });
  it("Off with His Head stops discarding at the initial encounter-deck boundary", () => {
    let s = base();
    const last = makePiece(s, "01104"),
      excluded = makePiece(s, "48035");
    s.encounter.deck = [last];
    s.encounter.discard = [excluded];
    s = finish(reveal(s, "48038"));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.minions).toHaveLength(0);
    exact(s, [last.id, excluded.id]);
  });
});
