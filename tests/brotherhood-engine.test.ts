/** Original encounter/player instances, real engine continuations and JSON saves. */
import { describe, expect, it } from "vitest";
import { card, pieceHP } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { enemyStats, newGame, targets } from "../src/game/engine.js";
import { sabretoothKelly } from "../src/game/sabretooth.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  pay,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { brotherhoodSourceIds?: string[] };
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
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.removed,
    ...(s.victoryDisplay || []),
    ...(sabretoothKelly(s) ? [sabretoothKelly(s)!] : []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).brotherhoodSourceIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
  return s;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 180; n++) {
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "take",
          "allow",
          "skip",
          "pass",
          "continue",
          "none",
          "no",
          "resolve",
        ].includes(o.id),
      )?.id ||
      (/forced|order/i.test(s.prompt.title) || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function base(team = false, villainId = "rhino", mystique = false) {
  const first = { heroId: "colossus", aspect: "protection" as const };
  let s = newGame({
    ...first,
    villainId,
    module: "brotherhood",
    ...(mystique ? { modules: ["brotherhood", "mystique"] } : {}),
    seed: 320730,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            first,
            { heroId: "shadowcat", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s, (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  for (const seat of s.players) {
    const view = seatView(s, seat),
      p = view.player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    const permanent = source.filter((p) =>
      ["32031a", "32031b"].includes(p.code),
    );
    expect(source.filter((p) => !permanent.includes(p))).toHaveLength(40);
    p.deck = source.filter((p) => !permanent.includes(p));
    p.hand = [];
    p.discard = [];
    p.inPlay = permanent;
    p.form = "hero";
    p.flipped = p.exhausted = p.tough = p.stunned = p.confused = false;
    p.toughCards = p.stunCards = p.confuseCards = 0;
  }
  activateSeat(s, "p1");
  (s as Fixture).brotherhoodSourceIds = physical(s).map((p) => p.id);
  expect(new Set((s as Fixture).brotherhoodSourceIds).size).toBe(
    (s as Fixture).brotherhoodSourceIds!.length,
  );
  s.villain.hp = s.villain.maxHp = 60;
  return s;
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing original encounter ${code}`);
}
function playerCard(s: GameState, code: string, playerId = "p1") {
  const p = seatView(s, playerId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing original player card ${playerId}:${code}`);
}
function put(s: GameState, code: string, playerId = "p1") {
  const p = encounter(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function reveal(s: GameState, code: string, playerId = "p1") {
  return native(s, {
    type: "reveal",
    piece: encounter(s, code),
    actorId: playerId,
  });
}
function attack(
  s: GameState,
  p: Piece,
  modifier = 0,
  playerId = "p1",
  originalTarget?: string,
) {
  return native(s, {
    type: "enemyAttack",
    id: p.id,
    actorId: playerId,
    originalTarget,
    activation: { kind: "attack", enemyId: p.id, playerId, modifier },
  });
}
function topEncounter(s: GameState, code: string) {
  const p = encounter(s, code);
  s.encounter.deck.unshift(p);
  return p;
}
function topPlayer(s: GameState, code: string, playerId = "p1") {
  const p = playerCard(s, code, playerId);
  seatView(s, playerId).player.deck.unshift(p);
  return p;
}
function blank(s: GameState, p: Piece) {
  s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
  expect(isTextBlank(s, p)).toBe(true);
}
function ultronMystique() {
  let s = newGame({
    heroId: "colossus",
    aspect: "protection",
    villainId: "ultron",
    difficulty: "expert",
    module: "mystique",
    seed: 3208035,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s, (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  s.player.form = "hero";
  s.player.tough =
    s.player.stunned =
    s.player.confused =
    s.player.exhausted =
      false;
  s.player.toughCards = s.player.stunCards = s.player.confuseCards = 0;
  s.player.deck.push(...s.player.hand.splice(0), ...s.player.inPlay.splice(0));
  (s as Fixture).brotherhoodSourceIds = physical(s).map((p) => p.id);
  expect(
    physical(s).filter(
      (p) => p.ownerId === "p1" && card(p).faction_code !== "encounter",
    ),
  ).toHaveLength(40);
  while (s.minions.filter((p) => p.code === "drone").length < 2)
    s = settle(native(s, { type: "drone" }));
  s = settle(reveal(s, "32080"));
  return s;
}

describe("Brotherhood native encounter boundaries", () => {
  it("standalone Mystique copies Ultron II's current2ATK without his attack-only2Drone bonus", () => {
    let s = ultronMystique();
    const mystique = s.minions.find((p) => p.code === "32080")!,
      hp = s.player.hp;
    expect(s.attack).toBeNull();
    expect(enemyStats(s, s.villain).attack).toBe(2);
    expect(enemyStats(s, mystique).attack).toBe(2);
    s = settle(attack(s, mystique));
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Mystique retains Ultron II's live3Drone grant during a real paid Defensive Energy Surprise interruption", () => {
    let s = ultronMystique();
    const mystique = s.minions.find((p) => p.code === "32080")!;
    const event = playerCard(s, "32017"),
      defensive = playerCard(s, "32018"),
      ally = playerCard(s, "32011");
    s.player.hand.push(event, defensive, ally);
    s.player.deck.unshift(encounter(s, "32083"));
    // Ultron's actual initiation consumes this original card as its new Drone,
    // leaving the actual Surprise for the later paid resource response draw.
    s.player.deck.unshift(playerCard(s, "32016"));
    topEncounter(s, "01186");
    s = respond(attack(s, s.villain), /Mutant Protectors/, "32017");
    s = pay(s, [defensive]);
    s = respond(s, /Defensive Energy/, "32018");
    s = until(
      s,
      (v) =>
        v.attack?.attacker === mystique.id &&
        !!v.prompt?.options.some((o) => o.id === "take"),
    );
    expect(s.minions.filter((p) => p.code === "drone")).toHaveLength(3);
    expect(s.attack?.activationAfter?.type).toBe(
      "mystique-native:activation-finish",
    );
    expect(enemyStats(reload(s), s.villain).attack).toBe(5);
    expect(s.attack?.base).toBe(5);
    s = settle(choose(s, "take"), (v) =>
      v.prompt?.options.some((o) => o.id === ally.id) ? ally.id : undefined,
    );
    expect(enemyStats(s, s.villain).attack).toBe(2);
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === mystique.id)!,
      ).attack,
    ).toBe(2);
  });
  it("imports all seven faces as exactly eight original physical module cards", () => {
    const s = base(),
      pool = physical(s).filter((p) => card(p).set_code === "brotherhood");
    expect(pool.map((p) => p.code).sort()).toEqual([
      "32073",
      "32074",
      "32075",
      "32076",
      "32077",
      "32077",
      "32078",
      "32079",
    ]);
    exact(reload(s));
  });
  it.each([false, true])(
    "uses fixed base3 plus native Hinder2N once (team=%s)",
    (team) => {
      let s = base(team);
      const source = physical(s).find((p) => p.code === "32079")!;
      s = settle(reveal(s, "32079"));
      const scheme = s.sideSchemes.find((p) => p.id === source.id)!;
      expect(scheme.counters).toBe(3 + 2 * s.playerCount);
      expect(scheme.code).toBe("32079");
    },
  );
  it("Avalanche exhausts a real controlled character after an actual zero-damage attack", () => {
    let s = base();
    const a = put(s, "32073"),
      hp = s.player.hp;
    s = until(attack(s, a, -3), (v) => v.prompt?.title === "Avalanche");
    expect(s.player.hp).toBe(hp);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["hero:p1"]);
    s = settle(choose(reload(s), "hero:p1"));
    expect(s.player.exhausted).toBe(true);
  });
  it("Avalanche's boost independently exhausts a controlled actual ally", () => {
    let s = base();
    const ally = playerCard(s, "32011");
    s.player.inPlay.push(ally);
    const boost = topEncounter(s, "32073");
    s = until(attack(s, s.villain), (v) => v.prompt?.title === "Avalanche");
    s = settle(choose(reload(s), ally.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
  });
  it.each(["stunned", "blank"])(
    "Avalanche has no after-attack trigger for %s replacement/text",
    (mode) => {
      let s = base();
      const a = put(s, "32073");
      if (mode === "stunned") {
        a.stunned = true;
        a.stunCards = 1;
      } else blank(s, a);
      s = settle(attack(s, a), (v) => {
        expect(v.prompt?.title).not.toBe("Avalanche");
        return undefined;
      });
      expect(s.player.exhausted).toBe(false);
    },
  );
  it("Blob's printed Guard restricts the actual native attack target list", () => {
    const s = base(),
      blob = put(s, "32074");
    expect(targets(s, "enemy", true).map((t) => t.id)).toEqual([blob.id]);
  });
  it("Blob stuns the actual hero only after positive attack damage", () => {
    let s = base();
    const blob = put(s, "32074"),
      hp = s.player.hp;
    s = settle(attack(s, blob));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.stunned).toBe(true);
    expect(s.player.stunCards).toBe(1);
  });
  it("Blob's Tough-canceled damage does not stun", () => {
    let s = base();
    const blob = put(s, "32074"),
      hp = s.player.hp;
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(attack(s, blob));
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(false);
  });
  it("Blob stuns the actual rescued Robert Kelly recipient", () => {
    let s = base(false, "sabretooth");
    const find = s.sideSchemes.find((p) => p.code === "32065a")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: find.id,
        amount: find.counters,
        source: "hero",
      }),
    );
    const blob = put(s, "32074"),
      kelly = sabretoothKelly(s)!;
    const before = kelly.damage;
    s = settle(attack(s, blob, 0, "p1", kelly.id));
    expect(sabretoothKelly(s)?.damage).toBe(before + 2);
    expect(sabretoothKelly(s)?.stunned).toBe(true);
    expect(s.player.stunned).toBe(false);
  });
  it("Pyro's actual zero-ATK attack discards two original double-resource cards and assigns four indirect", () => {
    let s = base();
    const pyro = put(s, "32075"),
      hp = s.player.hp;
    const first = topPlayer(s, "32022"),
      second = topPlayer(s, "32023");
    s = settle(attack(s, pyro), (v) =>
      v.prompt?.title === "Pyro" ? "hero" : undefined,
    );
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.discard.map((p) => p.id)).toEqual([second.id, first.id]);
  });
  it("Pyro stops at the first player-deck boundary, retains the last physical card and completes reset before indirect", () => {
    let s = base();
    const pyro = put(s, "32075"),
      hp = s.player.hp;
    const energy = playerCard(s, "32022");
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck = [energy];
    const originalDeckIds = new Set(s.player.discard.map((p) => p.id));
    s = until(attack(s, pyro), (v) => v.prompt?.title === "Pyro");
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck).toHaveLength(40);
    expect(s.player.deck.some((p) => p.id === energy.id)).toBe(true);
    expect(s.player.discard).toHaveLength(0);
    s = settle(s, (v) => (v.prompt?.title === "Pyro" ? "hero" : undefined));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.deck.filter((p) => originalDeckIds.has(p.id))).toHaveLength(
      39,
    );
  });
  it("Pyro mills actual Shapeshifter to encounter discard with zero icons and no hand-entry response", () => {
    let s = base(false, "sabretooth", true);
    const pyro = put(s, "32075"),
      hp = s.player.hp;
    const energy = topPlayer(s, "32022"),
      shape = encounter(s, "32082");
    s.player.deck.unshift(shape);
    s = settle(attack(s, pyro), (v) => {
      expect(v.prompt?.title).not.toBe("Infiltration");
      return v.prompt?.title === "Pyro" ? "hero" : undefined;
    });
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.discard.some((p) => p.id === shape.id)).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toEqual([energy.id]);
    expect(s.player.deck.some((p) => p.id === shape.id)).toBe(false);
  });
  it("Pyro uses the actual attacked cooperative seat's deck and indirect health", () => {
    let s = base(true);
    const pyro = put(s, "32075", "p2");
    const hp1 = s.player.hp,
      hp2 = seatView(s, "p2").player.hp;
    const energy = topPlayer(s, "32052", "p2"),
      genius = topPlayer(s, "32053", "p2");
    s = settle(attack(s, pyro, 0, "p2"), (v) =>
      v.prompt?.title === "Pyro" ? "hero" : undefined,
    );
    expect(seatView(s, "p1").player.hp).toBe(hp1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 4);
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toEqual([
      genius.id,
      energy.id,
    ]);
  });
  it("Toad discards one deterministic actual hand card after real damage", () => {
    const start = base(),
      toad = put(start, "32076");
    start.player.hand.push(
      playerCard(start, "32022"),
      playerCard(start, "32023"),
      playerCard(start, "32024"),
    );
    const a = settle(attack(reload(start), toad)),
      b = settle(attack(reload(start), toad));
    expect(a.player.hand).toHaveLength(2);
    expect(a.player.discard).toHaveLength(1);
    expect(a.player.discard.map((p) => p.id)).toEqual(
      b.player.discard.map((p) => p.id),
    );
    expect(a.seed).toBe(b.seed);
    expect(a.seed).not.toBe(start.seed);
    expect(a.hiddenInfo).toBeGreaterThan(start.hiddenInfo || 0);
  });
  it("Toad's prevented attack leaves the actual hand intact", () => {
    let s = base();
    const toad = put(s, "32076"),
      energy = playerCard(s, "32022");
    s.player.hand.push(energy);
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(attack(s, toad));
    expect(s.player.hand.map((p) => p.id)).toEqual([energy.id]);
  });
  it("Toad's boost independently discards the actual physical Shapeshifter to encounter discard", () => {
    let s = base(false, "sabretooth", true);
    const shape = encounter(s, "32082");
    s.player.hand.push(shape);
    const boost = topEncounter(s, "32076");
    s = settle(attack(s, s.villain));
    expect(s.player.hand).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.id === shape.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === shape.id)).toBe(false);
  });
  it("Homo Superior attaches its actual revealed card, adds native5HP and gives Tough", () => {
    let s = base();
    const blob = put(s, "32074"),
      homo = encounter(s, "32077");
    const before = pieceHP(s, blob);
    s = until(
      native(s, { type: "reveal", piece: homo }),
      (v) => v.prompt?.title === "Homo Superior",
    );
    s = settle(choose(reload(s), blob.id));
    expect(s.attachments.find((p) => p.id === homo.id)?.attachedTo).toBe(
      blob.id,
    );
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === blob.id)!,
      ),
    ).toBe(before + 5);
    expect(s.minions.find((p) => p.id === blob.id)?.tough).toBe(true);
  });
  it("Homo Superior's attached boost retains its original one numeric icon and physical card", () => {
    let s = base();
    const blob = put(s, "32074"),
      hp = s.player.hp;
    const homo = topEncounter(s, "32077");
    s = until(attack(s, s.villain), (v) => v.prompt?.title === "Homo Superior");
    s = settle(choose(reload(s), blob.id));
    expect(s.player.hp).toBe(hp - 3); // Rhino I's 2 ATK + this real1icon.
    expect(s.attachments.find((p) => p.id === homo.id)?.attachedTo).toBe(
      blob.id,
    );
    expect(s.encounter.discard.some((p) => p.id === homo.id)).toBe(false);
  });
  it("already-Tough minion still receives Homo attachment without Surge", () => {
    let s = base();
    const blob = put(s, "32074");
    blob.tough = true;
    blob.toughCards = 1;
    const homo = encounter(s, "32077"),
      before = s.encounter.dealt.length;
    s = until(
      native(s, { type: "reveal", piece: homo }),
      (v) => v.prompt?.title === "Homo Superior",
    );
    s = settle(choose(s, blob.id));
    expect(s.encounter.dealt).toHaveLength(before);
    expect(s.minions.find((p) => p.id === blob.id)?.toughCards).toBe(1);
    expect(s.attachments.some((p) => p.id === homo.id)).toBe(true);
  });
  it("no-minion Homo reveal Surges while the no-minion boost contributes1 without Surge", () => {
    let revealed = base();
    const revealedId = physical(revealed).find((p) => p.code === "32077")!.id;
    revealed = settle(reveal(revealed, "32077"));
    expect(revealed.encounter.dealt).toHaveLength(1);
    expect(revealed.encounter.discard.some((p) => p.id === revealedId)).toBe(
      true,
    );
    let boosted = base();
    const hp = boosted.player.hp,
      homo = topEncounter(boosted, "32077");
    boosted = settle(attack(boosted, boosted.villain));
    expect(boosted.encounter.dealt).toHaveLength(0);
    expect(boosted.player.hp).toBe(hp - 3);
    expect(boosted.encounter.discard.some((p) => p.id === homo.id)).toBe(true);
  });
  it.each(["deck", "discard"])(
    "Mutant Terrorists reveals the original scheme from %s with Hinder, then skips minion fallback",
    (zone) => {
      let s = base(true);
      const scheme = encounter(s, "32079"),
        avalanche = physical(s).find((p) => p.code === "32073")!;
      s.encounter[zone as "deck" | "discard"].push(scheme);
      s = settle(reveal(s, "32078"));
      expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(7);
      expect(s.minions.some((p) => p.id === avalanche.id)).toBe(false);
      expect(s.brotherhoodEntered?.[scheme.id]).toBeUndefined();
    },
  );
  it("Mutant Terrorists fallback REVEALS the actual last discarded minion after encounter reset and grants Quickstrike", () => {
    let s = settle(reveal(base(), "32079"));
    const pyro = encounter(s, "32075"),
      terrorists = encounter(s, "32078");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck = [pyro];
    const energy = topPlayer(s, "32022"),
      genius = topPlayer(s, "32023"),
      hp = s.player.hp;
    s = settle(native(s, { type: "reveal", piece: terrorists }), (v) =>
      v.prompt?.title === "Pyro" ? "hero" : undefined,
    );
    expect(s.encounter.acceleration).toBe(1);
    expect(s.minions.find((p) => p.id === pyro.id)?.engagedWith).toBe("p1");
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.discard.map((p) => p.id)).toEqual([genius.id, energy.id]);
  });
  it("Brotherhood Quickstrike follows the live source and its own blanking", () => {
    let s = settle(reveal(base(), "32079"));
    const scheme = s.sideSchemes.find((p) => p.code === "32079")!;
    blank(s, scheme);
    const hp = s.player.hp;
    s = settle(reveal(s, "32074"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(false);
  });
  it("unblanked Brotherhood grants native Quickstrike even to a minion with a blanked own text box", () => {
    let s = settle(reveal(base(), "32079"));
    const blob = encounter(s, "32074");
    blank(s, blob);
    const hp = s.player.hp;
    s = settle(native(s, { type: "reveal", piece: blob }));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.stunned).toBe(false); // Its own Blob response remains blank.
  });
  it("Homo's native health grant follows attachment blanking rather than recipient blanking", () => {
    let s = base();
    const blob = put(s, "32074"),
      originalHP = pieceHP(s, blob);
    s = until(reveal(s, "32077"), (v) => v.prompt?.title === "Homo Superior");
    s = settle(choose(s, blob.id));
    const recipient = s.minions.find((p) => p.id === blob.id)!;
    const attachment = s.attachments.find((p) => p.attachedTo === blob.id)!;
    blank(s, recipient);
    expect(pieceHP(s, recipient)).toBe(originalHP + 5);
    blank(s, attachment);
    expect(pieceHP(s, recipient)).toBe(originalHP);
    exact(reload(s));
  });
  it("both original Homo Superior copies stack +5HP independently without duplicating Tough", () => {
    let s = base();
    const blob = put(s, "32074"),
      originalHP = pieceHP(s, blob);
    for (let n = 0; n < 2; n++) {
      s = until(reveal(s, "32077"), (v) => v.prompt?.title === "Homo Superior");
      s = settle(choose(reload(s), blob.id));
    }
    expect(s.attachments.filter((p) => p.code === "32077")).toHaveLength(2);
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === blob.id)!,
      ),
    ).toBe(originalHP + 10);
    expect(s.minions.find((p) => p.id === blob.id)?.toughCards).toBe(1);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("Brotherhood's granted Quickstrike retains the native hero-form condition", () => {
    let s = settle(reveal(base(true), "32079"));
    seatView(s, "p2").player.form = "alter";
    const hp = seatView(s, "p2").player.hp;
    s = settle(reveal(s, "32074", "p2"));
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(s.minions.find((p) => p.code === "32074")?.engagedWith).toBe("p2");
  });
  it("Mutant Terrorists stops its fallback at encounter exhaustion without searching the recycled deck", () => {
    let s = settle(reveal(base(), "32079"));
    const terrorists = encounter(s, "32078"),
      nonMinion = encounter(s, "01104");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck = [nonMinion];
    s = settle(native(s, { type: "reveal", piece: terrorists }));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.minions).toHaveLength(0);
    expect(
      s.encounter.deck.some((p) => card(p).set_code === "brotherhood"),
    ).toBe(true);
  });
  it("Mutant Terrorists reveals the other modular set's original Brotherhood-trait Mystique through Toughness and Quickstrike", () => {
    let s = settle(reveal(base(false, "sabretooth", true), "32079"));
    const terrorists = encounter(s, "32078"),
      mystique = encounter(s, "32080");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck = [mystique];
    const hp = s.player.hp;
    s = settle(native(s, { type: "reveal", piece: terrorists }));
    const actual = s.minions.find((p) => p.id === mystique.id)!;
    expect(actual.engagedWith).toBe("p1");
    expect(actual.tough).toBe(true);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Toad's actual completed attack against an empty hand creates no card or random choice", () => {
    let s = base();
    const toad = put(s, "32076"),
      seed = s.seed;
    s = settle(attack(s, toad));
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.discard).toHaveLength(0);
    expect(s.seed).toBe(seed);
  });
  it("Toad uses actual defender control and attacked player even when the defeated ally has another owner", () => {
    let s = base(true);
    const toad = put(s, "32076"),
      ally = playerCard(s, "32011", "p1");
    ally.damage = Math.max(0, card(ally).health! - 1);
    seatView(s, "p2").player.inPlay.push(ally);
    const first = playerCard(s, "32022", "p1"),
      second = playerCard(s, "32052", "p2");
    seatView(s, "p1").player.hand.push(first);
    seatView(s, "p2").player.hand.push(second);
    s = until(
      attack(s, toad),
      (v) => !!v.prompt?.options.some((o) => o.id === ally.id),
    );
    s = settle(choose(reload(s), ally.id));
    expect(seatView(s, "p1").player.hand.map((p) => p.id)).toEqual([first.id]);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === ally.id)).toBe(
      true,
    );
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === second.id),
    ).toBe(true);
  });
  it("Avalanche offers rescued Kelly as the same controlled physical character to exhaust", () => {
    let s = base(false, "sabretooth");
    const find = s.sideSchemes.find((p) => p.code === "32065a")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: find.id,
        amount: find.counters,
        source: "hero",
      }),
    );
    const kellyId = sabretoothKelly(s)!.id,
      avalanche = put(s, "32073");
    s = until(attack(s, avalanche, -3), (v) => v.prompt?.title === "Avalanche");
    expect(s.prompt?.options.some((o) => o.id === kellyId)).toBe(true);
    s = settle(choose(reload(s), kellyId));
    expect(sabretoothKelly(s)?.exhausted).toBe(true);
    expect(s.player.exhausted).toBe(false);
  });
});
