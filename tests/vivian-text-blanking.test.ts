/** Original Vivian PLAY/PAY, native text effects, and physical source IDs. */
import { describe, expect, it } from "vitest";
import { card, pieceHP } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { deckErrors } from "../src/game/decks.js";
import { makePiece, newGame, targets } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  passId,
  play,
  target,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { vivianOriginalOwnedIds?: string[] };
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).vivianOriginalOwnedIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(s: GameState) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const id =
      passId(s) ||
      s.prompt.options.find((o) => o.id === "undefended")?.id ||
      s.prompt.options.find((o) => o.id === "resolve")?.id ||
      (s.prompt.title === "Forced responses"
        ? s.prompt.options[0]?.id
        : undefined) ||
      (/remaining indirect damage/.test(s.prompt.text)
        ? s.prompt.options.find((o) => o.id === "hero")?.id
        : undefined) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function base(villainId = "rhino", team = false): GameState {
  const iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...iron,
    villainId,
    seed: 29024,
    pacing: "expert",
    ...(team
      ? {
          heroes: [iron, { heroId: "spider_man", aspect: "justice" as const }],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  const originals = physical(s).filter(
    (p) => p.ownerId && card(p).faction_code !== "encounter",
  );
  expect(originals.filter((p) => p.ownerId === "p1")).toHaveLength(43);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const source = originals.filter(
      (p) =>
        p.ownerId === seat.id &&
        !["hero", "alter_ego"].includes(card(p).type_code),
    );
    expect(source).toHaveLength(40);
    expect(
      deckErrors(
        seat.heroId,
        seat.aspect,
        source.map((p) => p.code),
      ),
    ).toEqual([]);
    view.player.deck = source;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.hp = 10;
    view.player.exhausted = view.player.flipped = false;
    view.player.stunned = view.player.confused = view.player.tough = false;
  }
  // Ultron setup already put one original source ID under a Drone. This
  // focused position returns that same card to its owner's deck above.
  for (const m of s.minions) delete m.droneCard;
  // Keep actual encounter IDs when arranging a focused native position.
  s.encounter.deck.push(
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
  );
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck.unshift(
    ...Array.from({ length: 30 }, () => makePiece(s, "01104")),
  );
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 0;
  s.queue = [];
  s.prompt = s.review = null;
  (s as Fixture).vivianOriginalOwnedIds = originals.map((p) => p.id);
  exact(s);
  return s;
}
function playerCard(s: GameState, code: string) {
  for (const zone of [s.player.deck, s.player.hand, s.player.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original player source ${code}`);
}
function encounter(s: GameState, code: string) {
  const i = s.encounter.deck.findIndex((p) => p.code === code);
  return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : makePiece(s, code);
}
function minion(s: GameState, code: string) {
  const p = encounter(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function attachment(s: GameState, code: string, targetId = s.villain.id) {
  const p = encounter(s, code);
  p.attachedTo = targetId;
  s.attachments.push(p);
  return p;
}
function entry(s: GameState) {
  const vivian = playerCard(s, "29024");
  const resources = [playerCard(s, "29009"), playerCard(s, "29009")];
  expect(new Set(resources.map((p) => p.id)).size).toBe(2);
  s.player.hand.push(vivian, ...resources);
  s = play(s, vivian, resources);
  s = until(s, (v) => v.prompt?.title === "Vivian");
  expect(s.player.inPlay.some((p) => p.id === vivian.id)).toBe(true);
  for (const resource of resources)
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
  s = choose(s, "yes");
  exact(s);
  return s;
}
function blank(s: GameState, targetId: string) {
  s = entry(s);
  expect(s.prompt?.options.some((o) => o.id === targetId)).toBe(true);
  s = choose(s, targetId);
  s = settle(s);
  expect(
    isTextBlank(
      s,
      physical(s).find((p) => p.id === targetId)!,
    ),
  ).toBe(true);
  exact(s);
  return s;
}
function expire(s: GameState) {
  const old = s.round;
  s = settle(native(s, { type: "newRound" }));
  expect(s.round).toBe(old + 1);
  return s;
}
function attack(s: GameState, id = s.villain.id) {
  s = native(s, { type: "enemyAttack", id });
  expect(s.attack?.attacker).toBe(id);
  exact(s);
  return s;
}
function basicAttack(s: GameState, id: string) {
  s = target(command(s, { type: "BASIC", action: "attack" }), id);
  return settle(s);
}

describe("Vivian blanks actual supported Core and Goblin printed text", () => {
  it("excludes actual player upgrades, printed Elite minions and Permanent schemes from its entry choices", () => {
    let s = base();
    const upgrade = playerCard(s, "29012");
    upgrade.attachedTo = s.villain.id;
    s.attachments.push(upgrade);
    const elite = minion(s, "01102");
    // This catalog face is a negative target only; its scenario is not run.
    const permanent = encounter(s, "27102a");
    permanent.counters = 10;
    s.sideSchemes.push(permanent);
    const legal = attachment(s, "01098");
    s = entry(s);
    const choices = s.prompt!.options.map((o) => o.id);
    expect(choices).toContain(legal.id);
    expect(choices).not.toContain(upgrade.id);
    expect(choices).not.toContain(elite.id);
    expect(choices).not.toContain(permanent.id);
    expect(card(upgrade).type_code).toBe("upgrade");
    expect(card(elite).traits).toBe("Criminal. Elite.");
    expect(card(permanent).text).toContain("Permanent.");
    s = settle(choose(s, legal.id));
    expect(isTextBlank(s, upgrade)).toBe(false);
    expect(isTextBlank(s, elite)).toBe(false);
    expect(isTextBlank(s, permanent)).toBe(false);
  });
  it("suppresses and restores Upgraded Drones' textual HP on the same captured original source ID", () => {
    let s = base("ultron");
    const original = playerCard(s, "29004");
    s.player.deck.unshift(original);
    s = settle(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    expect(drone.droneCard?.id).toBe(original.id);
    const environment =
      s.environments?.find((p) => p.code === "01140") || encounter(s, "01140");
    if (!s.environments?.some((p) => p.id === environment.id))
      (s.environments ||= []).push(environment);
    const upgrade = attachment(s, "01142", environment.id);
    expect(pieceHP(s, drone)).toBe(2);
    s = blank(s, upgrade.id);
    const same = s.minions.find((p) => p.id === drone.id)!;
    expect(pieceHP(s, same)).toBe(1);
    expect(same.droneCard?.id).toBe(original.id);
    s = expire(s);
    const restored = s.minions.find((p) => p.id === drone.id)!;
    expect(pieceHP(s, restored)).toBe(2);
    expect(restored.droneCard?.id).toBe(original.id);
  });
  it("removes actual Guard and restores it next round while retaining stats and traits", () => {
    let s = base();
    const guard = minion(s, "01101");
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    s = blank(s, guard.id);
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    expect(card(guard)).toMatchObject({
      attack: 1,
      health: 3,
      traits: "Hydra.",
    });
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === guard.id)!,
      ),
    ).toBe(3);
    s = expire(s);
    expect(
      isTextBlank(
        s,
        s.minions.find((p) => p.id === guard.id)!,
      ),
    ).toBe(false);
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
  });
  it("suppresses Genetically Enhanced's textual HP and restores it without healing", () => {
    let s = base();
    const m = minion(s, "01101"),
      a = attachment(s, "01163", m.id);
    m.damage = 1;
    expect(pieceHP(s, m)).toBe(6);
    s = blank(s, a.id);
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === m.id)!,
      ),
    ).toBe(3);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
    s = expire(s);
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === m.id)!,
      ),
    ).toBe(6);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("retains Charge's printed +3 ATK but suppresses Overkill and its forced discard", () => {
    let s = base();
    const charge = attachment(s, "01099");
    expect(card(charge).attack).toBe(3);
    s = blank(s, charge.id);
    s = attack(s);
    expect(s.attack).toMatchObject({ base: 5, overkill: false });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === charge.id)).toBe(true);
    s = expire(s);
    s = attack(s);
    expect(s.attack).toMatchObject({ base: 5, overkill: true });
  });
  it.each(["01119", "01153"])(
    "suppresses and restores actual %s Retaliate",
    (code) => {
      let s = base("klaw");
      const a = attachment(s, code);
      s = blank(s, a.id);
      s = basicAttack(s, s.villain.id);
      expect(s.villain.hp).toBe(48);
      expect(s.player.hp).toBe(10);
      s = expire(s);
      s = settle(native(s, { type: "ready", target: "hero" }));
      s = basicAttack(s, s.villain.id);
      expect(s.villain.hp).toBe(46);
      expect(s.player.hp).toBe(9);
    },
  );
  it("suppresses Armored Rhino Suit's text replacement without inventing damage on it", () => {
    let s = base();
    const a = attachment(s, "01098");
    s = blank(s, a.id);
    s = basicAttack(s, s.villain.id);
    expect(s.villain.hp).toBe(48);
    expect(s.attachments.find((p) => p.id === a.id)?.damage).toBe(0);
    s = expire(s);
    s = settle(native(s, { type: "ready", target: "hero" }));
    s = basicAttack(s, s.villain.id);
    expect(s.villain.hp).toBe(48);
    expect(s.attachments.find((p) => p.id === a.id)?.damage).toBe(2);
  });
  it("removes and restores Immortal Klaw's ten HP while preserving all damage", () => {
    let s = base("klaw");
    const scheme = encounter(s, "01127");
    s = settle(native(s, { type: "reveal", piece: scheme }));
    expect(s.villain).toMatchObject({ hp: 60, maxHp: 60 });
    s.villain.hp -= 7;
    s = blank(s, scheme.id);
    expect(s.villain).toMatchObject({ hp: 43, maxHp: 50 });
    s = expire(s);
    expect(s.villain).toMatchObject({ hp: 53, maxHp: 60 });
  });
  it("does not subtract Immortal Klaw's ten HP twice when defeated while blank", () => {
    let s = base("klaw");
    const scheme = encounter(s, "01127");
    s = settle(native(s, { type: "reveal", piece: scheme }));
    s.villain.hp -= 7;
    s = blank(s, scheme.id);
    const amount = s.sideSchemes.find((p) => p.id === scheme.id)!.counters;
    s = settle(
      native(s, { type: "thwart", target: scheme.id, amount, action: true }),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.villain).toMatchObject({ hp: 43, maxHp: 50 });
    s = expire(s);
    expect(s.villain).toMatchObject({ hp: 43, maxHp: 50 });
  });
  it("suppresses and restores Goblin Nation's textual attack modifier", () => {
    let s = base("mutagen_formula");
    const scheme = encounter(s, "02027");
    s = settle(native(s, { type: "reveal", piece: scheme }));
    s = blank(s, scheme.id);
    s = attack(s);
    expect(s.attack?.base).toBe(2);
    s = settle(s);
    s = expire(s);
    s = attack(s);
    expect(s.attack?.base).toBe(3);
  });
  it("retains Goblin Glider's printed attack modifier while its removal text is blank", () => {
    let s = base("mutagen_formula");
    const glider = attachment(s, "02019");
    expect(card(glider).attack).toBe(1);
    s = blank(s, glider.id);
    s = attack(s);
    expect(s.attack?.base).toBe(3);
  });
  it("suppresses actual Hysteria's extra boost and restores it on round expiry", () => {
    let s = base("mutagen_formula");
    const hysteria = attachment(s, "02020");
    s = blank(s, hysteria.id);
    s = attack(s);
    expect(s.attack?.pendingBoosts).toHaveLength(1);
    s = settle(s);
    s = expire(s);
    s = attack(s);
    expect(s.attack?.pendingBoosts).toHaveLength(2);
  });
  it.each(["02021", "02034"])(
    "suppresses actual %s Pumpkin Bombs response and keeps the attachment",
    (code) => {
      let s = base("mutagen_formula");
      const bombs = attachment(s, code);
      s = blank(s, bombs.id);
      s = settle(attack(s));
      expect(s.player.hp).toBe(8);
      expect(s.attachments.some((p) => p.id === bombs.id)).toBe(true);
      s = expire(s);
      s = settle(attack(s));
      expect(s.attachments.some((p) => p.id === bombs.id)).toBe(false);
      expect(s.player.hp).toBe(4);
    },
  );
  it("suppresses Goblin Soldier's original when-defeated text before leave cleanup", () => {
    let s = base("mutagen_formula");
    const soldier = minion(s, "02023");
    soldier.damage = card(soldier).health! - 2;
    s = blank(s, soldier.id);
    s = basicAttack(s, soldier.id);
    expect(s.minions.some((p) => p.id === soldier.id)).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.discard.filter((p) => p.id === soldier.id)).toHaveLength(
      1,
    );
  });
  it("suppresses Whirlwind's additional player attacks in an actual two-seat position", () => {
    let s = base("klaw", true);
    const whirlwind = minion(s, "01130");
    s = blank(s, whirlwind.id);
    s = settle(attack(s, whirlwind.id));
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hp).toBe(10);
  });
  it("suppresses and restores Tiger Shark's Tough-after-attack text", () => {
    let s = base("klaw");
    const shark = minion(s, "01131");
    s = blank(s, shark.id);
    s = settle(attack(s, shark.id));
    expect(s.minions.find((p) => p.id === shark.id)?.tough).toBe(false);
    s = expire(s);
    s = settle(attack(s, shark.id));
    expect(s.minions.find((p) => p.id === shark.id)?.tough).toBe(true);
  });
  it.each(["01143", "01182"])(
    "suppresses actual %s when-defeated text using its pre-leave state",
    (code) => {
      let s = base(code === "01143" ? "ultron" : "rhino");
      const m = minion(s, code);
      m.damage = card(m).health! - 2;
      s = blank(s, m.id);
      const deckBefore = s.player.deck.length,
        dealtBefore = s.encounter.dealt.length;
      s = basicAttack(s, m.id);
      expect(s.minions.some((p) => p.id === m.id)).toBe(false);
      expect(s.minions.filter((p) => p.code === "drone")).toHaveLength(0);
      expect(s.player.deck).toHaveLength(deckBefore);
      expect(s.encounter.dealt).toHaveLength(dealtBefore);
    },
  );
  it("suppresses Biomechanical Upgrades' defeat replacement on the actual attachment", () => {
    let s = base();
    const m = minion(s, "01101"),
      a = attachment(s, "01185", m.id);
    m.damage = 1;
    s = blank(s, a.id);
    s = basicAttack(s, m.id);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.attachments.some((p) => p.id === a.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === m.id || p.id === a.id),
    ).toHaveLength(2);
  });
});
