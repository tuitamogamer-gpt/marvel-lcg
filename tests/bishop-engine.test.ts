import { describe, expect, it } from "vitest";
import rawCards from "../src/data/catalog-cards.json" with { type: "json" };
import { card, deckCodes, heroStats, pieceHP } from "../src/game/cards.js";
import {
  newGame,
  dispatch,
  makePiece,
  playable,
  nativeHeroAbilityOptions,
  nativeCanPutIntoPlay,
  nativePutIntoPlay,
} from "../src/game/engine.js";
import {
  BISHOP_SCRIPT_CODES,
  bishopCharacterBonus,
  bishopAttachmentTargets,
  bishopSuitUpUpgrade,
} from "../src/game/bishop.js";
import { deckErrors } from "../src/game/decks.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { cyclopsCharacterModifiers } from "../src/game/cyclops.js";
import { captainPackHasTrait } from "../src/game/captain-pack.js";
import { heroRuntime, heroStarterCodes } from "../src/game/hero-runtime.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  command,
  choose,
  finish,
  native,
  play,
  pay,
  respond,
  target,
  hand,
  put,
  minion,
  side,
  top,
  reload,
  conserved,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";
const source = () =>
  newGame({
    heroId: "bishop",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 45001,
    pacing: "expert",
  });
function base(alter = false, team = false) {
  let s = team
    ? newGame({
        heroId: "bishop",
        aspect: "leadership",
        villainId: "rhino",
        module: "bomb_scare",
        seed: 45001,
        pacing: "expert",
        heroes: [
          { heroId: "bishop", aspect: "leadership" },
          { heroId: "spider_man", aspect: "justice" },
        ],
      })
    : source();
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (!alter) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 15;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
const cast = (s: GameState, code: string, ...paid: string[]) => {
  const p = hand(s, code, ...paid);
  return play(s, p[0], p.slice(1));
};
const attackDamage = (s: GameState, amount: number) =>
  native(s, {
    type: "damage",
    target: "hero",
    amount,
    damageFromAttack: true,
    enemyAttack: true,
    source: s.villain.id,
  });
function reveal(s: GameState, code: string) {
  const reserve = s.player.setAside || [],
    i = reserve.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i >= 0 ? reserve.splice(i, 1)[0] : makePiece(s, code),
  });
}
const attachmentTargets = (s: GameState, p: Piece) =>
  bishopAttachmentTargets(s, p, {
    hasTrait: (s, id, name) =>
      (name === "X-Men" && cyclopsCharacterModifiers(s, id).xmen) ||
      captainPackHasTrait(s, id, name),
    identitySpecific: (p) => !!heroRuntime(card(p).set_code || ""),
  });
function actualResource(s: GameState, code: string) {
  const p = top(s, code);
  return p;
}

describe("Bishop original source and registration", () => {
  it("registers all30faces without touching original40-card source", () => {
    const faces = rawCards.filter(
      (c) => c.pack_code === "aoa" && c.position <= 29,
    );
    expect(faces).toHaveLength(30);
    expect(
      faces.filter((c) => !hasExecutableScript(c.code)).map((c) => c.code),
    ).toEqual([]);
    expect(BISHOP_SCRIPT_CODES).toHaveLength(24);
    expect(heroStarterCodes("bishop")).toHaveLength(40);
    expect(
      deckErrors("bishop", "leadership", heroStarterCodes("bishop")),
    ).toEqual([]);
    expect(deckCodes("bishop", "leadership")).toEqual(
      heroStarterCodes("bishop"),
    );
  });
  it.each([
    "aggression",
    "justice",
    "leadership",
    "protection",
    "pool",
  ] as const)("constructs legal %s deck", (aspect) => {
    expect(deckErrors("bishop", aspect, deckCodes("bishop", aspect))).toEqual(
      [],
    );
  });
  it("has six-card alter-ego opener and five actual nemesis cards", () => {
    const s = source();
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "45026",
      "45027",
      "45028",
      "45029",
      "45029",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(s.player.inPlay).toEqual([]);
  });
});
describe("Energy Absorption and Temporal form response", () => {
  it("takes actual damage, mills that many cards and recovers actual resource cards", () => {
    let s = base();
    const a = actualResource(s, "45010"),
      b = top(s, "45007"),
      c = top(s, "45022");
    const expected = [c, b, a];
    s = attackDamage(s, 3);
    expect(s.player.hp).toBe(9);
    expect(s.prompt?.title).toBe("Energy Absorption");
    s = finish(respond(reload(s), /Energy Absorption/));
    expect(s.player.hand.map((p) => p.id)).toEqual([c.id, a.id]);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    conserved(s, expected);
  });
  it("is optional and does not trigger for nonattack damage or alter ego", () => {
    let s = base();
    const n = s.player.deck.length;
    s = finish(attackDamage(s, 1));
    expect(s.player.deck).toHaveLength(n);
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.prompt).toBeNull();
    s.player.form = "alter";
    s = attackDamage(s, 1);
    expect(s.prompt).toBeNull();
  });
  it("cannot initiate a no-op Absorption when no player-deck cards remain", () => {
    let s = base();
    s.player.hand.push(...s.player.deck.splice(0));
    s = attackDamage(s, 1);
    expect(s.prompt).toBeNull();
  });
  it("Uniform cannot exhaust for a zero-healing response", () => {
    let s = base();
    const uniform = put(s, "45005");
    hand(s, "45010");
    s = native(s, { type: "bishop:uniform-window", id: uniform.id });
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === uniform.id)?.exhausted).toBe(
      false,
    );
  });
  it("does not trigger when Tough prevents all attack damage", () => {
    let s = base();
    s.player.tough = true;
    s = attackDamage(s, 2);
    expect(s.player.hp).toBe(12);
    expect(s.prompt).toBeNull();
  });
  it("stops at the initial empty deck, reshuffles once and retrieves same IDs once", () => {
    let s = base();
    const r = actualResource(s, "45010"),
      other = top(s, "45007");
    s.player.discard.push(
      ...s.player.deck.filter((p) => ![r.id, other.id].includes(p.id)),
    );
    s.player.deck = [r, other];
    const ids = [...s.player.deck, ...s.player.discard].map((p) => p.id);
    s = finish(respond(attackDamage(s, 4), /Energy Absorption/));
    expect(s.player.hand.map((p) => p.id)).toEqual([r.id]);
    expect(s.encounter.dealt).toHaveLength(1);
    const current = [
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
    ].map((p) => p.id);
    expect(current.slice().sort()).toEqual(ids.slice().sort());
    expect(new Set(current).size).toBe(current.length);
    expect(
      s.log.some(
        (l) =>
          l.text ===
          "Energy Absorption: discarded 2 cards; returned 1 resource cards.",
      ),
    ).toBe(true);
  });
  it("Uniform heals per resource CARD after recovery, not per printed icon", () => {
    let s = base();
    const uniform = put(s, "45005");
    const a = top(s, "45010"),
      b = top(s, "45022");
    s = respond(attackDamage(s, 3), /Energy Absorption/);
    s = finish(respond(reload(s), /Bishop's Uniform/));
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.find((p) => p.id === uniform.id)?.exhausted).toBe(
      true,
    );
    expect(
      s.player.hand.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("after changing to Lucas, returns a Temporal physical card only", () => {
    let s = base();
    const p = top(s, "45010"),
      other = top(s, "45007");
    s.player.deck.splice(s.player.deck.indexOf(p), 1);
    s.player.deck.splice(s.player.deck.indexOf(other), 1);
    s.player.discard.push(p, other);
    s = respond(command(s, { type: "FLIP" }), /Temporally Displaced/);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    s = finish(choose(reload(s), p.id));
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
  });
  it("offers Absorption at the damage step before Retaliate", () => {
    let s = base();
    put(s, "16016");
    put(s, "05023");
    s.player.hp = 15;
    const hp = s.villain.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Energy Absorption/);
    // Choosing the response opens its own discard resolution before the attacker takes Retaliate.
    expect(
      s.log.findIndex((l) => l.text.startsWith("Energy Absorption: discarded")),
    ).toBeGreaterThan(-1);
    s = finish(s);
    expect(s.villain.hp).toBe(hp - 1);
  });
});
describe("Energy Conversion native defense", () => {
  it("recycles actual resource cards and caps an event-defended attack at3", () => {
    let s = base();
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    const resource = top(s, "45010");
    s.player.deck.splice(s.player.deck.indexOf(resource), 1);
    s.player.discard.push(resource);
    const [event] = hand(s, "45009");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Energy Conversion/);
    s = pay(s, []);
    expect(s.attack?.eventDefense).toBe(true);
    expect(s.player.deck.some((p) => p.id === resource.id)).toBe(true);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.log.some((l) => /5 ATK/.test(l.text))).toBe(true);
  });
  it("applies cap before Side Step prevention, so3prevention absorbs the entire cappedattack", () => {
    let s = base();
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    const [conversion, side, energy] = hand(s, "45009", "14015", "45022");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Energy Conversion/);
    s = pay(s, []);
    s = respond(s, /Side Step/);
    s = pay(s, [energy]);
    s = finish(s);
    expect(s.player.hp).toBe(12);
    expect(s.player.discard.some((p) => p.id === conversion.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === side.id)).toBe(true);
    expect(
      s.log.some((l) => l.text.startsWith("Energy Absorption: discarded")),
    ).toBe(false);
  });
  it("a second no-op Conversion is not offered and attack allowance survives packet boundaries", () => {
    let s = base();
    const [first, second] = hand(s, "45009", "45009");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Energy Conversion/);
    s = pay(s, []);
    expect(s.prompt?.options.some((o) => o.image === "45009")).not.toBe(true);
    expect(s.player.hand.some((p) => p.id === second.id)).toBe(true);
    const source = s.villain.id;
    s = finish(
      native(
        s,
        {
          type: "damage",
          target: "hero",
          amount: 2,
          damageFromAttack: true,
          source,
        },
        {
          type: "damage",
          target: "hero",
          amount: 2,
          damageFromAttack: true,
          source,
        },
      ),
    );
    expect(s.player.hp).toBe(9);
    expect(s.flags.bishopConversionDamage).toBe(3);
  });
  it("cannot be played as an ordinary player-phase action", () => {
    const s = base();
    const [p] = hand(s, "45009");
    expect(playable(s, p)).toBeTruthy();
  });
});
describe("Bishop original-source public flow seed", () => {
  it("seed45009 naturally recovers an actual resource after a basic attack and end turn", () => {
    let s = newGame({
      heroId: "bishop",
      aspect: "leadership",
      villainId: "rhino",
      module: "bomb_scare",
      seed: 45009,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s = finish(command(s, { type: "FLIP" }));
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    const first = s.player.hand[0].id;
    s = command(s, { type: "END_TURN", discard: [first] });
    s = respond(s, /Energy Absorption/);
    const receipt = s.log.find((l) =>
      l.text.startsWith("Energy Absorption: discarded"),
    );
    expect(receipt?.text).toMatch(/returned [1-9]\d* resource cards/);
    expect(s.player.hand.some((p) => card(p).type_code === "resource")).toBe(
      true,
    );
  });
});
describe("Bishop respects The Merc with the Mouth", () => {
  it("cannot trigger Energy Absorption during the other player's protected turn", () => {
    let s = base(false, true);
    s.turnPlayerId = "p2";
    put(s, "44032", "p2");
    const count = s.player.deck.length;
    s = attackDamage(s, 2);
    expect(s.player.hp).toBe(10);
    expect(s.prompt).toBeNull();
    expect(seatView(s, "p1").player.deck).toHaveLength(count);
  });
  it("changing to Lucas during that turn creates no Temporally Displaced response", () => {
    let s = base(false, true);
    s.turnPlayerId = "p2";
    put(s, "44032", "p2");
    const p = top(s, "45010");
    s.player.deck.splice(s.player.deck.indexOf(p), 1);
    s.player.discard.push(p);
    s = native(s, { type: "flip", counts: false, target: "alter" });
    expect(s.player.form).toBe("alter");
    expect(s.prompt).toBeNull();
    expect(seatView(s, "p1").player.discard.some((q) => q.id === p.id)).toBe(
      true,
    );
  });
});
describe("Bishop allies and weapons", () => {
  it.each([
    ["45002", "45024"],
    ["45003", "45022"],
  ])(
    "%s discards a matching resource, readies and heals, once per phase",
    (code, resource) => {
      let s = base();
      const p = put(s, code);
      p.exhausted = true;
      p.damage = 1;
      const [r] = hand(s, resource);
      s = command(s, { type: "ABILITY", id: p.id, action: "resource-ready" });
      s = finish(choose(reload(s), r.id));
      expect(s.player.inPlay.find((q) => q.id === p.id)).toMatchObject({
        exhausted: false,
        damage: 0,
      });
      expect(s.player.discard.some((q) => q.id === r.id)).toBe(true);
      expect(nativeHeroAbilityOptions(s, p.id)).toEqual([]);
    },
  );
  it("Malcolm does not treat Wild as a printed Physical icon", () => {
    let s = base();
    const p = put(s, "45002");
    p.exhausted = true;
    p.damage = 1;
    const [r] = hand(s, "45019");
    s = finish(
      choose(
        command(s, { type: "ABILITY", id: p.id, action: "resource-ready" }),
        r.id,
      ),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
  });
  it("Rifle counts resource cards instead of icons, exhausts its physical instance", () => {
    let s = base();
    const rifle = put(s, "45004");
    hand(s, "45010", "45022", "45007");
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: rifle.id, action: "rifle" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.player.inPlay.find((p) => p.id === rifle.id)?.exhausted).toBe(
      true,
    );
  });
  it("zero-resource Rifle can clear Stunned", () => {
    let s = base();
    const p = put(s, "45004");
    s.player.stunned = true;
    const hp = s.villain.hp;
    s = finish(command(s, { type: "ABILITY", id: p.id, action: "rifle" }));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(hp);
  });
  it("each Super-Charged stores printed icons and two upgrades can add16ATK", () => {
    let s = base();
    const a = put(s, "45006"),
      b = put(s, "45006");
    a.counters = b.counters = 5;
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, a.id);
    s = choose(reload(s), b.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(hp - 18);
    expect(
      s.player.discard.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("charging discards only a resource TYPE and stores all its printed icons", () => {
    let s = base();
    const p = put(s, "45006"),
      [r] = hand(s, "45010");
    s = finish(
      choose(command(s, { type: "ABILITY", id: p.id, action: "charge" }), r.id),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(2);
  });
  it("Concussive Blast readies when a physical resource card paid", () => {
    let s = base();
    s.player.exhausted = true;
    s = cast(s, "45007", "45010", "45004");
    s = finish(target(s, s.villain.id));
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.hp).toBe(74);
  });
  it("ordinary-card payment does not grant Concussive Blast ready", () => {
    let s = base();
    s.player.exhausted = true;
    s = cast(s, "45007", "45004", "45005", "45006");
    s = finish(target(s, s.villain.id));
    expect(s.player.exhausted).toBe(true);
  });
  it("borrowed Concussive Blast readies Bishop rather than the playing identity", () => {
    let s = base(false, true);
    s.player.exhausted = true;
    activateSeat(s, "p2");
    s.player.form = "hero";
    s.player.exhausted = true;
    s.turnPlayerId = "p2";
    s = cast(s, "45007", "45010", "45004");
    s = finish(target(s, s.villain.id));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
  });
  it("Command Authority draws only with a resource card in its payment", () => {
    let s = base();
    s = cast(s, "45008", "45010");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(12);
    expect(s.player.hand).toHaveLength(1);
  });
  it("only grants Command Authority's draw when a Resource card pays part of the actual cost, even with identical overpaid icons", () => {
    for (const usedResourceCard of [false, true]) {
      let s = base();
      const [event, resource, first, second] = hand(
        s,
        "45008",
        "45022",
        "45009",
        "45009",
      );
      s = play(s, event, [resource, first, second]);
      expect(s.prompt?.title).toBe("Allocate resource-card payment");
      expect(s.player.hand.map((p) => p.id)).toEqual(
        [event, resource, first, second].map((p) => p.id),
      );
      s = choose(
        reload(s),
        usedResourceCard ? "resource-card" : "other-sources",
      );
      s = finish(target(s, "main"));
      expect(s.scheme.threat).toBe(12);
      expect(s.player.hand).toHaveLength(Number(usedResourceCard));
      for (const piece of [event, resource, first, second])
        expect(s.player.discard.filter((p) => p.id === piece.id)).toHaveLength(
          1,
        );
    }
  });
  it("X23 ally readies after defeating an enemy and Cable draws after side-scheme defeat", () => {
    let s = base();
    const x = put(s, "45012"),
      m = minion(s, "01103");
    s = command(s, { type: "ABILITY", id: x.id, action: "attack" });
    s = finish(target(s, m.id), (v) =>
      v.prompt?.title === "X-23" && v.prompt.options.some((o) => o.id === "yes")
        ? "yes"
        : undefined,
    );
    expect(s.player.inPlay.find((p) => p.id === x.id)?.exhausted).toBe(false);
    const cable = put(s, "45011"),
      scheme = side(s, "01107", 2);
    s = target(
      command(s, { type: "ABILITY", id: cable.id, action: "thwart" }),
      scheme.id,
    );
    s = finish(respond(s, /^Cable$/));
    expect(s.player.hand).toHaveLength(1);
  });
  it("Legion resolves Energy and Physical branches for Stored Energy but no Wild substitution", () => {
    let s = base();
    const p = put(s, "45020");
    p.damage = 2;
    top(s, "45010");
    const hp = s.villain.hp;
    s = command(s, {
      type: "ABILITY",
      id: p.id,
      action: "attack",
    });
    s = respond(s, /^Legion$/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
  });
  it("Marrow enforces trait on play and responds after any entry", () => {
    let s = base(true);
    const [p] = hand(s, "45021");
    expect(playable(s, p)).toMatch(/X-Men or X-Force/);
    s.player.form = "hero";
    const resources = hand(s, "45021", "45022");
    s = respond(play(s, resources[0], resources.slice(1)), /^Marrow$/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(78);
  });
});
describe("Sidekick, Advanced Suit, Side-by-Side and Suit Up", () => {
  it("Sidekick attaches only to your identity-specific ally and adds2HP", () => {
    let s = base();
    const signature = put(s, "45002"),
      ordinary = put(s, "45020");
    const [upgrade, resource] = hand(s, "45015", "45004");
    expect(attachmentTargets(s, upgrade)?.map((p) => p.id)).toEqual([
      signature.id,
    ]);
    s = command(s, { type: "PLAY", id: upgrade.id });
    s = choose(s, signature.id);
    s = finish(pay(s, [resource]));
    const ally = s.player.inPlay.find((p) => p.id === signature.id)!;
    expect(pieceHP(s, ally)).toBe(5);
    expect(pieceHP(s, ordinary)).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.attachedTo).toBe(
      signature.id,
    );
  });
  it("Sidekick can attach to a teammate's identity-specific ally you control", () => {
    const s = base();
    const ally = put(s, "43003"),
      upgrade = hand(s, "45015")[0];
    ally.ownerId = "p2";
    expect(attachmentTargets(s, upgrade)?.map((p) => p.id)).toContain(ally.id);
    expect(nativeCanPutIntoPlay(s, upgrade)).toBe(true);
  });
  it("Advanced Suit checks current traits, including Honorary X-Men", () => {
    const s = base();
    const ally = put(s, "01075"),
      upgrade = hand(s, "45014")[0];
    expect(attachmentTargets(s, upgrade)?.map((p) => p.id)).not.toContain(
      ally.id,
    );
    const honorary = put(s, "33035");
    honorary.attachedTo = ally.id;
    expect(attachmentTargets(s, upgrade)?.map((p) => p.id)).toContain(ally.id);
  });
  it("Cable ally does not draw after non-thwart threat removal", () => {
    let s = base();
    const cable = put(s, "45011"),
      scheme = side(s, "01107", 2);
    s = finish(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 2,
        source: cable.id,
      }),
    );
    expect(s.player.hand).toHaveLength(0);
  });
  it("X23 ally readies after defeating a villain stage", () => {
    let s = base();
    const ally = put(s, "45012");
    s.villain.hp = 2;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      s.villain.id,
    );
    s = finish(respond(s, /^X-23$/));
    expect(s.villain.stage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
  });
  it("Sidekick heals2 after basic recovery and stays attached after reload", () => {
    let s = base(true);
    const p = put(s, "45002"),
      up = put(s, "45015");
    up.attachedTo = p.id;
    p.damage = 3;
    s.player.hp = 8;
    s = finish(
      respond(
        command(reload(s), { type: "BASIC", action: "recover" }),
        /^Sidekick$/,
      ),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
  });
  it("Side-by-Side pays readying the actual sidekick then readies hero and boosts both thisphase", () => {
    let s = base();
    const p = put(s, "45002"),
      up = put(s, "45015");
    up.attachedTo = p.id;
    p.exhausted = true;
    s.player.exhausted = true;
    const pieces = hand(s, "45016", "45022");
    s = play(s, pieces[0]);
    s = choose(s, p.id);
    s = pay(s, [pieces[1]]);
    s = finish(choose(reload(s), "boost"));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(false);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3 });
    s = command(s, {
      type: "ABILITY",
      id: p.id,
      action: "attack",
    });
    s = finish(s);
    expect(s.villain.hp).toBe(77);
    s.phase = "villain";
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2 });
  });
  it("cancelling Side-by-Side's payment leaves its sidekick exhausted and all costs unspent", () => {
    let s = base();
    const ally = put(s, "45002"),
      title = put(s, "45015");
    title.attachedTo = ally.id;
    ally.exhausted = true;
    const [event, resource] = hand(s, "45016", "45022");
    s = choose(command(s, { type: "PLAY", id: event.id }), ally.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    s = command(s, { type: "CANCEL" });
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
  });
  it("Side-by-Side's ally bonus follows control changes and resets on a new entry", () => {
    let s = base(false, true);
    const ally = put(s, "45002");
    s = finish(native(s, { type: "bishop:side-bonus", id: ally.id }));
    expect(bishopCharacterBonus(s, ally.id)).toBe(1);
    const actual = s.player.inPlay.splice(
      s.player.inPlay.findIndex((p) => p.id === ally.id),
      1,
    )[0];
    seatView(s, "p2").player.inPlay.push(actual);
    expect(bishopCharacterBonus(s, actual.id)).toBe(1);
    seatView(s, "p2").player.inPlay.pop();
    nativePutIntoPlay(s, actual);
    s = finish(native(s, ...s.queue));
    expect(bishopCharacterBonus(s, actual.id)).toBe(0);
  });
  it("free play also readies the sidekick before the card commits", () => {
    let s = base();
    const ally = put(s, "45002"),
      title = put(s, "45015");
    title.attachedTo = ally.id;
    ally.exhausted = true;
    s.player.exhausted = true;
    const [event] = hand(s, "45016");
    s = native(s, { type: "play", piece: event, paid: [] });
    expect(s.prompt?.title).toBe("Side-by-Side · additional cost");
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    s = choose(s, ally.id);
    expect(s.prompt?.title).toBe("Side-by-Side");
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    s = finish(choose(s, "heal"));
    expect(s.player.exhausted).toBe(false);
  });
  it("rejects Side-by-Side without an exhausted readyable sidekick", () => {
    const s = base();
    const [p] = hand(s, "45016", "45022");
    expect(playable(s, p)).toMatch(/sidekick/i);
  });
  it.each(["The Merc with the Mouth", "Restrained"])(
    "%s prevents initiating Side-by-Side and spends no costs",
    (restriction) => {
      let s = base();
      const ally = put(s, "45002"),
        title = put(s, "45015");
      title.attachedTo = ally.id;
      ally.exhausted = true;
      if (restriction === "The Merc with the Mouth") put(s, "44032");
      else {
        const restrained = makePiece(s, "21083");
        restrained.attachedTo = ally.id;
        s.attachments.push(restrained);
      }
      const [event, resource] = hand(s, "45016", "45022");
      expect(playable(s, event)).toMatch(/readying.*sidekick/i);
      s = dispatch(reload(s), { type: "PLAY", id: event.id });
      expect(s.error).toMatch(/readying.*sidekick/i);
      expect(s.player.hand.map((p) => p.id)).toEqual([event.id, resource.id]);
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
        true,
      );
    },
  );
  it("rechecks Side-by-Side's readying cost at payment commitment without spending resources on failure", () => {
    let s = base();
    const ally = put(s, "45002"),
      title = put(s, "45015");
    title.attachedTo = ally.id;
    ally.exhausted = true;
    const [event, resource] = hand(s, "45016", "45022");
    s = choose(command(s, { type: "PLAY", id: event.id }), ally.id);
    expect(s.prompt?.kind).toBe("payment");
    put(s, "44032");
    s = dispatch(reload(s), { type: "PAY", ids: [resource.id] });
    expect(s.error).toMatch(/must ready.*sidekick/i);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.player.hand.map((p) => p.id)).toEqual([event.id, resource.id]);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(false);
  });
  it("X-23 offers no ready response when The Merc with the Mouth prevents readying her", () => {
    let s = base();
    const ally = put(s, "45012"),
      enemy = minion(s, "01103");
    put(s, "44032");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      enemy.id,
    );
    expect(s.prompt).toBeNull();
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
  });
  it("Advanced Suit only attaches to X-Men/X-Force and heals per discarded printedicons afterdefeat", () => {
    let s = base();
    const p = put(s, "45002");
    p.damage = 2;
    const up = put(s, "45014");
    up.attachedTo = p.id;
    const [r] = hand(s, "45022");
    const m = minion(s, "01103");
    m.damage = 1;
    s = target(
      command(s, { type: "ABILITY", id: p.id, action: "attack" }),
      m.id,
    );
    s = respond(s, /Advanced Suit/);
    s = finish(choose(s, r.id));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
    expect(s.player.discard.some((q) => q.id === r.id)).toBe(true);
  });
  it("current Suit Up ruling finds Sidekick independent of selected ally traits", () => {
    let s = base(true);
    const ally = top(s, "45020"),
      upgrade = top(s, "45015");
    s = cast(s, "45017", "45022");
    s = choose(s, ally.id);
    expect(s.prompt?.options.some((o) => o.id === upgrade.id)).toBe(true);
    s = finish(choose(reload(s), upgrade.id));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === upgrade.id)).toBe(true);
    expect(attachmentTargets(s, upgrade)?.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(card("45017").text).toContain("an ally");
    expect(rawCards.find((p) => p.code === "45017")?.text).toContain(
      "that ally",
    );
  });
  it("Suit Up can take only an ally and never searches non-ally-only upgrades", () => {
    let s = base(true);
    const ally = top(s, "45002");
    s = cast(s, "45017", "45022");
    s = choose(s, ally.id);
    s = finish(choose(s, "none"));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(bishopSuitUpUpgrade(makePiece(s, "45004"))).toBe(false);
    expect(bishopSuitUpUpgrade(makePiece(s, "45015"))).toBe(true);
  });
});
describe("Bishop obligation and physical nemesis dependencies", () => {
  it("Fear the Future optionally changes form and removes the physical obligation", () => {
    let s = base();
    s = reveal(s, "45025");
    s = choose(s, "flip");
    s = finish(choose(reload(s), "settle"));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.code === "45025")).toHaveLength(1);
  });
  it("discard branch removes every resourcecard, retaining othercards and noSurge", () => {
    let s = base();
    const p = hand(s, "45010", "45022", "45007");
    s = reveal(s, "45025");
    s = choose(s, "stay");
    s = finish(choose(s, "discard"));
    expect(s.player.hand.map((q) => q.id)).toEqual([p[2].id]);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("Fear the Future surges if no resourcecard was discarded", () => {
    let s = base();
    hand(s, "45007");
    s = reveal(s, "45025");
    s = choose(s, "stay");
    s = finish(choose(s, "discard"));
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Shadows introduces the five actual reserve IDs, including distinct Trickery copies", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = finish(reveal(s, "01190"));
    expect(s.player.setAside).toEqual([]);
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.encounter.dealt,
    ];
    for (const id of ids)
      expect(all.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.sideSchemes.some((p) => p.code === "45027")).toBe(true);
  });
  it("Bantam finds actual Portal from reserve, then adds2 if alreadyinplay", () => {
    let s = base();
    const portal = s.player.setAside!.find((p) => p.code === "45027")!;
    s = finish(reveal(s, "45028"));
    expect(s.sideSchemes.find((p) => p.id === portal.id)?.counters).toBe(4);
    s = finish(native(s, { type: "bishop:portal" }));
    expect(s.sideSchemes.find((p) => p.id === portal.id)?.counters).toBe(6);
  });
  it("Portal grants Surge to a revealed Temporal card once per phase across players", () => {
    let s = base(false, true);
    s.scheme.threat = 1;
    side(s, "45027", 4);
    hand(s, "45007");
    s = finish(reveal(s, "45029"), (v) =>
      ["Temporal Trickery", "When Revealed · ability order"].includes(
        v.prompt?.title || "",
      )
        ? v.prompt?.options[0]?.id
        : undefined,
    );
    expect(s.encounter.dealt).toHaveLength(1);
    s = finish(reveal(s, "45029"), (v) =>
      ["Temporal Trickery", "When Revealed · ability order"].includes(
        v.prompt?.title || "",
      )
        ? v.prompt?.options[0]?.id
        : undefined,
    );
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Fitzroy's forced response resolves after his actual attack defeats an ally", () => {
    let s = base();
    s.scheme.threat = 1;
    const enemy = minion(s, "45026"),
      ally = put(s, "45002");
    ally.damage = 2;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === ally.id) ? ally.id : undefined,
    );
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.code === "45027")?.counters).toBe(4);
  });
  it("pending Shadows reveals retain each physical reserve ID during the quickstrike prompt", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = reveal(s, "01190");
    const actual = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.resolving,
      ...(s.player.setAside || []),
    ];
    for (const id of ids)
      expect(actual.filter((p) => p.id === id)).toHaveLength(1);
    s = finish(s);
    expect(s.sideSchemes.some((p) => p.code === "45027")).toBe(true);
  });
  it("Temporal Trickery requires maximum printedicons and places thatmany oneachscheme", () => {
    let s = base();
    s.scheme.threat = 1;
    const scheme = side(s, "01107", 2),
      cards = hand(s, "45010", "45007", "45022");
    s = reveal(s, "45029");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [cards[0].id, cards[2].id].sort(),
    );
    s = finish(choose(reload(s), cards[0].id));
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(4);
  });
});
