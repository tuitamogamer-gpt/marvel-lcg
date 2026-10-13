/** Actual original40-card setup and native command/reveal/activation acceptance.
 * Every operation crosses JSON hydration; fixture moves preserve physical IDs. */
import { describe, expect, it } from "vitest";
import { card, heroCard } from "../src/game/cards.js";
import { newGame, nativeHeroAbilityOptions } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import { statusCards } from "../src/game/keywords.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  native,
  reload,
  respond,
  pay,
  play,
  until,
} from "./dv-test-helpers.js";

const original = (s: GameState, playerId = "p1") => {
  const p = seatView(s, playerId).player;
  return [
    ...p.deck,
    ...p.hand,
    ...p.discard,
    ...p.inPlay,
    ...s.resolving.filter((p) => p.ownerId === playerId),
  ];
};
function starting(team = false) {
  return newGame({
    heroId: "colossus",
    aspect: "protection",
    villainId: "rhino",
    seed: 32001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "colossus", aspect: "protection" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(form: "hero" | "alter" = "hero", team = false) {
  let s = starting(team);
  for (let index = 0; index < s.players.length; index++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) =>
    v.prompt?.title === "Piotr Rasputin setup"
      ? v.prompt.options[0]?.id
      : undefined,
  );
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const source = original(s, seat.id);
    expect(source).toHaveLength(40);
    source.forEach((p) => {
      p.ownerId = seat.id;
    });
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
    view.player.deck = source;
    view.player.form = seat.heroId === "colossus" ? form : "alter";
    view.player.exhausted = false;
    view.player.flipped = false;
    view.player.tough = false;
    view.player.toughCards = 0;
  }
  s.prompt = null;
  s.queue = [];
  s.review = null;
  return reload(s);
}
function take(
  s: GameState,
  code: string,
  destination: "hand" | "inPlay" | "discard" = "hand",
  playerId = "p1",
) {
  const p = seatView(s, playerId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay]) {
    const index = zone.findIndex((piece) => piece.code === code);
    if (index < 0) continue;
    const source = zone.splice(index, 1)[0];
    p[destination].push(source);
    return source;
  }
  throw Error(`Original physical ${code} is missing.`);
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Actual encounter ${code} is missing.`);
}
function tough(s: GameState, count: number, playerId = "p1") {
  const p = seatView(s, playerId).player;
  p.toughCards = count;
  p.tough = count > 0;
}
function safeBoost(s: GameState) {
  const safe = s.encounter.deck.findIndex(
    (p) => !card(p).boost && !card(p).boost_star,
  );
  expect(safe).toBeGreaterThanOrEqual(0);
  s.encounter.deck.unshift(s.encounter.deck.splice(safe, 1)[0]);
}

describe("Colossus native engine acceptance", () => {
  it("launches original40 cards, six-card opener, one obligation and five owned reserved nemesis cards", () => {
    const s = starting();
    expect(heroCard(s).code).toBe("32001b");
    expect(s.player.hand).toHaveLength(6);
    expect(original(s)).toHaveLength(40);
    expect(new Set(original(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "32026",
      "32027",
      "32028",
      "32028",
      "32029",
    ]);
    expect(s.player.setAside?.every((p) => p.ownerId === "p1")).toBe(true);
    expect(s.encounter.deck.filter((p) => p.code === "32025")).toHaveLength(1);
  });
  it("after mulligan selects one actual Organic Steel from remaining deck and conserves original IDs", () => {
    let s = starting();
    const ids = original(s)
      .map((p) => p.id)
      .sort();
    s = command(s, { type: "MULLIGAN", ids: [] });
    expect(s.prompt?.title).toBe("Piotr Rasputin setup");
    const foundId = s.prompt!.options[0].id;
    expect(
      s.player.deck.some((p) => p.id === foundId && p.code === "32006"),
    ).toBe(true);
    s = finish(choose(s, foundId));
    expect(s.player.hand).toHaveLength(7);
    expect(s.player.hand.some((p) => p.id === foundId)).toBe(true);
    expect(
      original(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
  });
  it("does not create Organic Steel when both actual copies are already in the six-card opener", () => {
    let s = starting();
    const source = original(s),
      steel = source.filter((p) => p.code === "32006");
    expect(steel).toHaveLength(2);
    const filler = source.filter((p) => p.code !== "32006").slice(0, 4);
    s.player.hand = [...steel, ...filler];
    s.player.deck = source.filter(
      (p) => !s.player.hand.some((q) => q.id === p.id),
    );
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.hand).toHaveLength(6);
    expect(
      original(s)
        .filter((p) => p.code === "32006")
        .map((p) => p.id)
        .sort(),
    ).toEqual(steel.map((p) => p.id).sort());
  });
  it("Steel Skin is an optional response to the native change of form", () => {
    let s = base("alter");
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("hero");
    expect(statusCards(s.player, "tough")).toBe(0);
    s = finish(choose(s, "steel-skin"));
    expect(statusCards(s.player, "tough")).toBe(1);
    s.player.flipped = false;
    s = finish(command(s, { type: "FLIP" }));
    s.player.flipped = false;
    s = command(s, { type: "FLIP" });
    s = finish(choose(s, "continue"));
    expect(statusCards(s.player, "tough")).toBe(1);
  });
  it("flipping two Tough to alter ego discards one and opens an actual Iron Will response", () => {
    let s = base();
    const iron = take(s, "32004", "inPlay");
    tough(s, 2);
    const drawn = s.player.deck[0].id;
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    expect(statusCards(s.player, "tough")).toBe(1);
    s = finish(respond(s, /Iron Will/, "32004"));
    expect(s.player.hand.some((p) => p.id === drawn)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === iron.id)).toBe(true);
  });
  it("Piotr Studio retrieves the actual last discarded Colossus card through deck exhaustion", () => {
    let s = base("alter");
    const studio = take(s, "32003", "inPlay"),
      fist = take(s, "32008");
    s.player.hand.push(...s.player.deck.splice(0));
    s.player.hand = s.player.hand.filter((p) => p.id !== fist.id);
    s.player.deck = [fist];
    expect(
      nativeHeroAbilityOptions(s, studio.id).some(
        (o) => o.id === "piotr-studio",
      ),
    ).toBe(true);
    s = finish(
      command(s, { type: "ABILITY", id: studio.id, action: "piotr-studio" }),
    );
    expect(s.player.inPlay.find((p) => p.id === studio.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.hand.filter((p) => p.id === fist.id)).toHaveLength(1);
    expect(original(s)).toHaveLength(40);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Homesick moves its actual obligation into discard before the two Tough response occurrences", () => {
    let s = base();
    take(s, "32004", "inPlay");
    const obligation = encounter(s, "32025");
    tough(s, 2);
    s = native(s, { type: "reveal", piece: obligation });
    s = choose(s, "stay");
    s = choose(s, "discard");
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    s = respond(s, /Iron Will/, "32004");
    s = respond(s, /Iron Will/, "32004");
    s = finish(s);
    expect(s.player.hand).toHaveLength(2);
    expect(
      s.encounter.discard.filter((p) => p.id === obligation.id),
    ).toHaveLength(1);
  });
  it("Shadows reveals actual Juggernaut/Rampaging cards and shuffles the remaining three nemesis instances", () => {
    let s = base();
    const reserve = s.player.setAside!.map((p) => ({ id: p.id, code: p.code }));
    const shadows = encounter(s, "01190");
    tough(s, 2);
    const ally = take(s, "32002", "inPlay");
    ally.tough = true;
    ally.toughCards = 1;
    s = finish(native(s, { type: "reveal", piece: shadows }));
    expect(s.minions.find((p) => p.code === "32026")?.id).toBe(
      reserve.find((p) => p.code === "32026")!.id,
    );
    expect(s.minions.find((p) => p.code === "32026")?.tough).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "32027")?.counters).toBe(8);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(false);
    expect(s.player.setAside).toEqual([]);
    for (const p of reserve.filter((p) => ["32028", "32029"].includes(p.code)))
      expect(s.encounter.deck.filter((q) => q.id === p.id)).toHaveLength(1);
  });
  it("Unstoppable chooses the actual highest printed ATK enemy and retains original attachment identity", () => {
    let s = base();
    const juggernaut = encounter(s, "32026"),
      unstoppable = encounter(s, "32028");
    s = finish(native(s, { type: "reveal", piece: juggernaut }));
    s = native(s, { type: "reveal", piece: unstoppable });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([juggernaut.id]);
    s = finish(choose(s, juggernaut.id));
    expect(s.attachments.find((p) => p.id === unstoppable.id)?.attachedTo).toBe(
      juggernaut.id,
    );
  });
  it("Armor Up changes this native villain activation to an attack and opens Steel Skin first", () => {
    let s = base("alter");
    const armor = take(s, "32010");
    safeBoost(s);
    s = native(s, { type: "villainActivate" });
    s = choose(s, `p1:${armor.id}`);
    s = until(s, (v) => v.prompt?.title === "Steel Skin");
    expect(s.player.form).toBe("hero");
    s = choose(s, "steel-skin");
    s = finish(s);
    expect(s.player.hp).toBe(14);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.player.discard.some((p) => p.id === armor.id)).toBe(true);
    expect(s.scheme.threat).toBe(0);
  });
  it("Confused replaces the original scheme before Armor Up can be played", () => {
    let s = base("alter");
    const armor = take(s, "32010");
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    s = finish(native(s, { type: "villainActivate" }));
    expect(s.player.form).toBe("alter");
    expect(s.player.hand.some((p) => p.id === armor.id)).toBe(true);
    expect(s.villain.confused).toBe(false);
  });
  it("Armor Up resets a changed activation and Stun then cancels the new attack", () => {
    let s = base("alter");
    const armor = take(s, "32010");
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    s = native(s, { type: "villainActivate" });
    s = choose(s, `p1:${armor.id}`);
    s = finish(s);
    expect(s.player.form).toBe("hero");
    expect(s.player.hp).toBe(14);
    expect(s.villain.stunned).toBe(false);
    expect(s.player.discard.some((p) => p.id === armor.id)).toBe(true);
  });
  it("Armor Up during another player's activation flips Colossus while that player still receives a scheme", () => {
    let s = base("alter", true);
    const armor = take(s, "32010");
    safeBoost(s);
    const before = s.scheme.threat;
    s = native(s, { type: "villainActivate", actorId: "p2" });
    s = choose(s, `p1:${armor.id}`);
    s = until(s, (v) => v.prompt?.title === "Steel Skin");
    s = choose(s, "steel-skin");
    s = finish(s);
    expect(seatView(s, "p1").player.form).toBe("hero");
    expect(statusCards(seatView(s, "p1").player, "tough")).toBe(1);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(s.scheme.threat).toBeGreaterThan(before);
  });
  it("Armor Up interrupts an explicit extra villain attack and preserves that attack", () => {
    let s = base("alter");
    const armor = take(s, "32010");
    safeBoost(s);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, `p1:${armor.id}`);
    s = until(s, (v) => v.prompt?.title === "Steel Skin");
    s = choose(s, "steel-skin");
    s = finish(s);
    expect(s.player.form).toBe("hero");
    expect(s.player.hp).toBe(14);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.scheme.threat).toBe(0);
    expect(s.player.discard.some((p) => p.id === armor.id)).toBe(true);
  });
  it("Armor Up during an explicit extra scheme changes form while the printed scheme still resolves", () => {
    let s = base("alter");
    const armor = take(s, "32010");
    safeBoost(s);
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = choose(s, `p1:${armor.id}`);
    s = until(s, (v) => v.prompt?.title === "Steel Skin");
    s = choose(s, "steel-skin");
    s = finish(s);
    expect(s.player.form).toBe("hero");
    expect(s.player.hp).toBe(14);
    expect(statusCards(s.player, "tough")).toBe(1);
    expect(s.scheme.threat).toBeGreaterThan(0);
    expect(s.player.discard.some((p) => p.id === armor.id)).toBe(true);
  });
  it("status-replaced explicit extra attacks and schemes do not offer Armor Up", () => {
    for (const kind of ["attack", "scheme"] as const) {
      let s = base("alter");
      const armor = take(s, "32010");
      if (kind === "attack") {
        s.villain.stunned = true;
        s.villain.stunCards = 1;
      } else {
        s.villain.confused = true;
        s.villain.confuseCards = 1;
      }
      s = finish(
        native(s, {
          type: kind === "attack" ? "enemyAttack" : "enemyScheme",
          id: s.villain.id,
        }),
      );
      expect(s.player.form).toBe("alter");
      expect(s.player.hand.some((p) => p.id === armor.id)).toBe(true);
      expect(s.player.hp).toBe(14);
      expect(s.scheme.threat).toBe(0);
    }
  });
  it("Titanium pays actual Steel Fist, then Iron Will/Organic Steel respond to its optional Tough payment", () => {
    let s = base();
    const fist = take(s, "32008"),
      iron = take(s, "32004", "inPlay"),
      muscles = take(s, "32005", "inPlay"),
      steel = take(s, "32006", "inPlay");
    steel.counters = 2;
    tough(s, 2);
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: fist.id });
    s = pay(s, [], undefined, [muscles.id]);
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp - 5);
    s = choose(s, "discard");
    s = respond(s, /Iron Will/, "32004");
    s = respond(s, /Organic Steel/, "32006");
    s = finish(s);
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.confused).toBe(true);
    expect(statusCards(s.player, "tough")).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === muscles.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === steel.id)).toMatchObject({
      exhausted: true,
      counters: 1,
    });
    expect(s.player.inPlay.some((p) => p.id === iron.id)).toBe(true);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === fist.id)).toHaveLength(1);
    expect(original(s)).toHaveLength(40);
  });
  it("Stun replaces Steel Fist after native resource payment while leaving optional Tough untouched", () => {
    let s = base();
    const fist = take(s, "32008"),
      muscles = take(s, "32005", "inPlay");
    tough(s, 2);
    s.player.stunned = true;
    s.player.stunCards = 1;
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: fist.id });
    s = finish(pay(s, [], undefined, [muscles.id]));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(hp);
    expect(statusCards(s.player, "tough")).toBe(2);
    expect(s.player.discard.some((p) => p.id === fist.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === muscles.id)?.exhausted).toBe(
      true,
    );
  });
  it("Bulletproof Protector's actual Tough cost responses precede its ready choice", () => {
    let s = base();
    const event = take(s, "32009"),
      steel = take(s, "32006", "inPlay");
    take(s, "32004", "inPlay");
    steel.counters = 2;
    tough(s, 1);
    s.player.exhausted = true;
    s = play(s, event);
    expect(statusCards(s.player, "tough")).toBe(0);
    s = respond(s, /Iron Will/, "32004");
    s = respond(s, /Organic Steel/, "32006");
    s = until(s, (v) => v.prompt?.title === "Bulletproof Protector");
    s = finish(choose(s, "ready"));
    expect(s.player.exhausted).toBe(false);
    expect(statusCards(s.player, "tough")).toBe(1);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });
  it("Made of Rage resolves and discards its actual event before the interrupted basic attack", () => {
    let s = base();
    const rage = take(s, "32007");
    tough(s, 1);
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = respond(s, /Made of Rage/, "32007");
    s = finish(s);
    expect(s.villain.hp).toBe(hp - 8);
    expect(statusCards(s.player, "tough")).toBe(0);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.filter((p) => p.id === rage.id)).toHaveLength(1);
    expect(s.resolving).toEqual([]);
  });
  it("a Stun-replaced basic attack does not play Made of Rage or discard Tough", () => {
    let s = base();
    const rage = take(s, "32007");
    tough(s, 1);
    s.player.stunned = true;
    s.player.stunCards = 1;
    const hp = s.villain.hp;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(hp);
    expect(s.player.hand.some((p) => p.id === rage.id)).toBe(true);
    expect(statusCards(s.player, "tough")).toBe(1);
  });
  it("Unstoppable Piercing deals damage once before Organic Steel keeps new Tough, then discards its actual attachment", () => {
    let s = base();
    const juggernaut = encounter(s, "32026"),
      attachment = encounter(s, "32028"),
      steel = take(s, "32006", "inPlay");
    steel.counters = 2;
    tough(s, 2);
    s = finish(native(s, { type: "reveal", piece: juggernaut }));
    s = finish(native(s, { type: "reveal", piece: attachment }));
    s = native(s, { type: "enemyAttack", id: juggernaut.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "32006"));
    expect(s.player.hp).toBe(8);
    expect(statusCards(s.player, "tough")).toBe(0);
    s = finish(respond(s, /Organic Steel/, "32006"));
    expect(s.player.hp).toBe(8);
    expect(statusCards(s.player, "tough")).toBe(1);
    expect(
      s.encounter.discard.filter((p) => p.id === attachment.id),
    ).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
  });
  it("Slammed's star boost reveals the same physical card while retaining its two numeric boost icons", () => {
    let s = base();
    const slammed = encounter(s, "32029");
    s.encounter.deck.unshift(slammed);
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.discard.filter((p) => p.id === slammed.id)).toHaveLength(
      1,
    );
    expect(s.resolving.some((p) => p.id === slammed.id)).toBe(false);
  });
  it("Organic Steel enters through actual native payment with two Uses counters", () => {
    let s = base();
    const steel = take(s, "32006"),
      energy = take(s, "32022");
    s = finish(play(s, steel, [energy]));
    expect(s.player.inPlay.find((p) => p.id === steel.id)).toMatchObject({
      counters: 2,
      exhausted: false,
    });
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(original(s)).toHaveLength(40);
  });
  it("Shadowcat's own native ally attack ignores Guard without granting that permission to Colossus", () => {
    let s = base();
    const kitty = take(s, "32002", "inPlay"),
      guard = encounter(s, "01101");
    s = finish(native(s, { type: "reveal", piece: guard }));
    const basic = command(s, { type: "BASIC", action: "attack" });
    expect(basic.prompt?.options.some((o) => o.id === s.villain.id)).not.toBe(
      true,
    );
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: kitty.id, action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(true);
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.player.inPlay.find((p) => p.id === kitty.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
  });
  it("Shadowcat's own native thwart ignores Crisis while Colossus must target the side scheme", () => {
    let s = base();
    const kitty = take(s, "32002", "inPlay"),
      crisis = encounter(s, "01108");
    s.scheme.threat = 5;
    s = finish(native(s, { type: "reveal", piece: crisis }));
    const basic = finish(command(s, { type: "BASIC", action: "thwart" }));
    expect(basic.scheme.threat).toBe(5);
    s = command(s, { type: "ABILITY", id: kitty.id, action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = finish(choose(s, "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === kitty.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
  });
});
