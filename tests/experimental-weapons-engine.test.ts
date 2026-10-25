/** All positions retain the original source forty and each of the module's
 * four physical attachments. Choices resume through JSON-save boundaries. */
import { describe, expect, it } from "vitest";
import { abilityOptions, dispatch, newGame } from "../src/game/engine.js";
import {
  card,
  deckCodes,
  enemyAttachmentModifier,
  MODULES,
} from "../src/game/cards.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import { isTextBlank } from "../src/game/card-text.js";
import type { GameState, Piece, Resource } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

const codes = ["04072", "04073", "04074", "04075"];
type Fixture = GameState & { weaponsOriginalIds?: string[] };
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
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.removed,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const pieces = physical(s);
  for (const id of (s as Fixture).weaponsOriginalIds || [])
    expect(
      pieces.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 100; n++) {
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "take",
          "allow",
          "skip",
          "pass",
          "continue",
          "no",
          "resolve",
          "none",
        ].includes(o.id),
      )?.id ||
      (s.prompt.title === "Forced responses" || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function base(team = false, firstHero = "ironheart", villainId = "rhino") {
  const hero = {
    heroId: firstHero,
    aspect:
      firstHero === "black_panther"
        ? ("protection" as const)
        : ("leadership" as const),
  };
  let s = newGame({
    ...hero,
    villainId,
    module: "exper_weapon",
    seed: 4072,
    pacing: "expert",
    ...(team
      ? { heroes: [hero, { heroId: "spider_man", aspect: "justice" as const }] }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s, (v) =>
    v.prompt?.title === "Foresight" ? v.prompt.options[0]?.id : undefined,
  );
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      deckCodes(seat.heroId, seat.aspect).sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.exhausted = p.flipped = p.tough = p.stunned = p.confused = false;
  }
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  (s as Fixture).weaponsOriginalIds = physical(s).map((p) => p.id);
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing source ${seatId}:${code}`);
}
function hand(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.hand.push(p);
  return p;
}
function resource(s: GameState, type: Resource, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player.deck.find((p) => {
    const c = card(p);
    return (
      Number(c[`resource_${type}`]) === 1 &&
      ["energy", "mental", "physical", "wild"].reduce(
        (n, r) => n + Number(c[`resource_${r}` as keyof typeof c] || 0),
        0,
      ) === 1
    );
  });
  expect(p, `source ${type}`).toBeDefined();
  return hand(s, p!.code, seatId);
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing encounter ${code}`);
}
function reveal(s: GameState, code: string) {
  return settle(
    native(s, { type: "reveal", piece: encounter(s, code), skip: true }),
  );
}
function attachment(s: GameState, code: string) {
  return s.attachments.find((p) => p.code === code)!;
}
function zeroBoost(s: GameState) {
  const p = s.encounter.deck.find(
    (p) => !(card(p).boost || 0) && !card(p).boost_star,
  );
  expect(p, "original zero-icon boost").toBeDefined();
  s.encounter.deck.unshift(encounter(s, p!.code));
}
function attack(s: GameState, actorId = s.activePlayerId) {
  zeroBoost(s);
  return native(s, { type: "enemyAttack", id: s.villain.id, actorId });
}
function attackVillain(s: GameState) {
  s = command(s, { type: "BASIC", action: "attack" });
  if (s.prompt?.options.some((o) => o.id === s.villain.id))
    s = choose(reload(s), s.villain.id);
  return settle(s);
}
function blank(s: GameState, id: string) {
  const vivian = hand(s, "29024");
  const costs = [resource(s, "energy"), resource(s, "physical")];
  s = command(s, { type: "PLAY", id: vivian.id });
  s = command(s, { type: "PAY", ids: costs.map((p) => p.id) });
  expect(s.prompt?.title).toBe("Vivian");
  s = choose(reload(s), "yes");
  s = choose(reload(s), id);
  s = settle(s);
  expect(
    isTextBlank(s, attachment(s, physical(s).find((p) => p.id === id)!.code)),
  ).toBe(true);
  return s;
}

describe("Experimental Weapons original modular source", () => {
  it("registers all four faces and retains the original forty-card starter", () => {
    const s = base();
    expect(MODULES[26]?.id).toBe("exper_weapon");
    expect(
      physical(s)
        .filter((p) => card(p).set_code === "exper_weapon")
        .map((p) => p.code)
        .sort(),
    ).toEqual(codes);
    for (const code of codes)
      expect(hasExecutableScript(code), code).toBe(true);
    exact(reload(s));
  });
  it.each([
    "rhino",
    "klaw",
    "ultron",
    "mutagen_formula",
    "risky_business",
    "sabretooth",
    "master_mold",
    "magneto",
  ])("includes exactly four original attachments in %s setup", (villainId) => {
    const s = newGame({
      heroId: "ironheart",
      aspect: "leadership",
      villainId,
      module: "exper_weapon",
      seed: 4072,
    });
    const pieces = physical(s).filter(
      (p) => card(p).set_code === "exper_weapon",
    );
    expect(pieces.map((p) => p.code).sort()).toEqual(codes);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(4);
  });
  it.each(codes)(
    "reveals %s onto the same actual villain and keeps it out of discard",
    (code) => {
      let s = base();
      const original = physical(s).find((p) => p.code === code)!;
      s = reveal(s, code);
      expect(attachment(s, code)).toMatchObject({
        id: original.id,
        attachedTo: s.villain.id,
      });
      expect(s.encounter.discard.some((p) => p.id === original.id)).toBe(false);
      exact(reload(s));
    },
  );
  it("adds Laser Rifle and Exo-Suit printed ATK/SCH, retaining stats when Exo-Suit is blank", () => {
    let s = reveal(reveal(base(), "04072"), "04075");
    expect(enemyAttachmentModifier(s, s.villain.id, "attack")).toBe(2);
    expect(enemyAttachmentModifier(s, s.villain.id, "scheme")).toBe(1);
    s = blank(s, attachment(s, "04075").id);
    expect(enemyAttachmentModifier(s, s.villain.id, "attack")).toBe(2);
    expect(enemyAttachmentModifier(s, s.villain.id, "scheme")).toBe(1);
    expect(abilityOptions(s, attachment(s, "04075"))).toEqual([]);
  });
});

describe("Experimental Weapons attack keywords and aftermath", () => {
  it("Laser Rifle prevents the attacked Black Panther's Retaliate", () => {
    let s = reveal(base(false, "black_panther"), "04072");
    const villainHP = s.villain.hp;
    const heroHP = s.player.hp;
    s = settle(attack(s));
    expect(s.player.hp).toBe(heroHP - 3);
    expect(s.villain.hp).toBe(villainHP);
    expect(s.attack).toBeNull();
  });
  it("removing Laser Rifle restores Retaliate on the next actual attack", () => {
    let s = reveal(base(false, "black_panther"), "04072");
    const id = attachment(s, "04072").id;
    s = settle(native(s, { type: "discardPiece", id }));
    const villainHP = s.villain.hp;
    s = settle(attack(reload(s)));
    expect(s.villain.hp).toBe(villainHP - 1);
  });
  it("Energy Shield retaliates once after a surviving villain is attacked", () => {
    let s = reveal(base(), "04073");
    const before = s.player.hp;
    s = attackVillain(reload(s));
    expect(s.player.hp).toBe(before - 1);
  });
  it("blanking Energy Shield removes the granted retaliation", () => {
    let s = reveal(base(), "04073");
    s = blank(s, attachment(s, "04073").id);
    const hp = s.player.hp;
    s = attackVillain(reload(s));
    expect(s.player.hp).toBe(hp);
  });
  it("Energy Shield adds to Klaw's existing Solid-Sound Body Retaliate", () => {
    let s = base(false, "ironheart", "klaw");
    s = settle(
      native(s, ...s.minions.map((p) => ({ type: "discardPiece", id: p.id }))),
    );
    s = reveal(reveal(s, "01119"), "04073");
    const hp = s.player.hp;
    s = attackVillain(reload(s));
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Laser Rifle's interrupt remains on the current attack after the actual attachment leaves", () => {
    let s = reveal(base(false, "black_panther"), "04072");
    const rifle = attachment(s, "04072");
    const villainHP = s.villain.hp;
    s = attack(s);
    const take = s.prompt!.options.find((o) => o.id === "take")!;
    const remainder = [...s.queue];
    s = settle(
      native(
        reload(s),
        { type: "discardPiece", id: rifle.id },
        ...take.effects,
        ...remainder,
      ),
    );
    expect(s.villain.hp).toBe(villainHP);
    expect(s.encounter.discard.some((p) => p.id === rifle.id)).toBe(true);
    expect(s.attack).toBeNull();
  });
  it("Power Gauntlets forces a choice of one actual hand card after identity damage", () => {
    let s = reveal(base(), "04074");
    const cards = [resource(s, "mental"), resource(s, "physical")];
    s = attack(s);
    s = choose(reload(s), "take");
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === cards[0].id) && n < 20;
      n++
    ) {
      const id =
        s.prompt.options.find((o) =>
          ["resolve", "allow", "skip", "pass"].includes(o.id),
        )?.id || s.prompt.options[0]?.id;
      s = choose(reload(s), id!);
    }
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      cards.map((p) => p.id).sort(),
    );
    s = settle(choose(reload(s), cards[1].id));
    expect(s.player.hand.map((p) => p.id)).toEqual([cards[0].id]);
    expect(s.player.discard.filter((p) => p.id === cards[1].id)).toHaveLength(
      1,
    );
    expect(s.player.hp).toBe(8);
  });
  it.each(["tough", "stunned", "ally", "blank"])(
    "Power Gauntlets does not discard after %s prevents identity attack damage",
    (mode) => {
      let s = reveal(base(), "04074");
      if (mode === "blank") s = blank(s, attachment(s, "04074").id);
      const held = resource(s, "mental");
      if (mode === "tough") s.player.tough = true;
      if (mode === "stunned") s.villain.stunned = true;
      let defender: Piece | undefined;
      if (mode === "ally") {
        const ally = s.player.deck.find(
          (p) => card(p).type_code === "ally" && card(p).health! >= 3,
        )!;
        defender = source(s, ally.code);
        s.player.inPlay.push(defender);
      }
      s = attack(s);
      if (defender) s = choose(reload(s), defender.id);
      s = settle(s);
      expect(s.player.hand.some((p) => p.id === held.id)).toBe(true);
    },
  );
  it("Power Gauntlets has no hand cost after ordinary non-attack damage", () => {
    let s = reveal(base(), "04074");
    const held = resource(s, "mental");
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 1,
        source: s.villain.id,
      }),
    );
    expect(s.player.hand.some((p) => p.id === held.id)).toBe(true);
  });
  it("Gauntlets follows teammate defense and its actual overkill identity damage", () => {
    let s = reveal(reveal(base(true), "04074"), "01099");
    const originalHand = resource(s, "mental", "p1");
    const defendingHand = [
      resource(s, "mental", "p2"),
      resource(s, "physical", "p2"),
    ];
    const cat = source(s, "01002", "p2");
    seatView(s, "p2").player.inPlay.push(cat);
    s = attack(s, "p1");
    s = choose(reload(s), cat.id);
    s = settle(s, (v) =>
      v.prompt?.options.some((o) => o.id === defendingHand[0].id)
        ? defendingHand[0].id
        : undefined,
    );
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(7);
    expect(
      seatView(s, "p1").player.hand.some((p) => p.id === originalHand.id),
    ).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some(
        (p) => p.id === defendingHand[0].id,
      ),
    ).toBe(true);
    expect(
      seatView(s, "p2").player.hand.some((p) => p.id === defendingHand[1].id),
    ).toBe(true);
  });
  it("Exo-Suit increases the actual villain scheme after Vivian blanks its text", () => {
    let s = reveal(base(), "04075");
    s = blank(s, attachment(s, "04075").id);
    s.player.form = "alter";
    zeroBoost(s);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.scheme.threat).toBe(2);
  });
});

describe("Experimental Weapons typed native payment", () => {
  const costs: [string, Resource[]][] = [
    ["04072", ["energy", "physical"]],
    ["04073", ["energy", "mental"]],
    ["04074", ["mental", "physical"]],
    ["04075", ["energy", "mental", "physical"]],
  ];
  it.each(costs)(
    "removes actual %s only after its printed resource types are paid",
    (code, requirements) => {
      let s = reveal(base(), code);
      const p = attachment(s, code);
      const cards = requirements.map((type) => resource(s, type));
      expect(abilityOptions(s, p).some((o) => o.id === "remove")).toBe(true);
      s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
      expect(s.prompt?.kind).toBe("payment");
      expect(s.prompt?.requirements).toEqual(requirements);
      expect(s.attachments.some((q) => q.id === p.id)).toBe(true);
      s = settle(
        command(reload(s), { type: "PAY", ids: cards.map((q) => q.id) }),
      );
      expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
      for (const paid of cards)
        expect(s.player.discard.filter((q) => q.id === paid.id)).toHaveLength(
          1,
        );
    },
  );
  it("rejects wrong resource types without spending or removing an attachment", () => {
    let s = reveal(base(), "04073");
    const p = attachment(s, "04073");
    const cards = [resource(s, "physical"), resource(s, "physical")];
    resource(s, "energy");
    resource(s, "mental");
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    const failed = dispatch(reload(s), {
      type: "PAY",
      ids: cards.map((q) => q.id),
    });
    expect(failed.error).toBeTruthy();
    expect(failed.attachments.some((q) => q.id === p.id)).toBe(true);
    for (const held of cards)
      expect(failed.player.hand.some((q) => q.id === held.id)).toBe(true);
    exact(failed);
  });
  it("canceling removal preserves every physical payment card and attachment", () => {
    let s = reveal(base(), "04075");
    const p = attachment(s, "04075");
    const cards = [
      resource(s, "energy"),
      resource(s, "mental"),
      resource(s, "physical"),
    ];
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    s = settle(command(reload(s), { type: "CANCEL" }));
    expect(s.attachments.some((q) => q.id === p.id)).toBe(true);
    for (const held of cards)
      expect(s.player.hand.some((q) => q.id === held.id)).toBe(true);
  });
  it("allows a different hero to pay for removal from the shared villain", () => {
    let s = reveal(base(true), "04072");
    const p = attachment(s, "04072");
    activateSeat(s, "p2");
    const cards = [resource(s, "energy"), resource(s, "physical")];
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    s = settle(
      command(reload(s), { type: "PAY", ids: cards.map((q) => q.id) }),
    );
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    for (const paid of cards)
      expect(
        seatView(s, "p2").player.discard.some((q) => q.id === paid.id),
      ).toBe(true);
    expect(seatView(s, "p1").player.discard).toHaveLength(0);
  });
  it("does not offer removal to an alter-ego", () => {
    const s = reveal(base(), "04075");
    s.player.form = "alter";
    for (const type of ["energy", "mental", "physical"] as Resource[])
      resource(s, type);
    expect(abilityOptions(s, attachment(s, "04075"))).toEqual([]);
  });
});
