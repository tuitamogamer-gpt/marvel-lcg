import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { card, MODULES } from "../src/game/cards";
import { isTextBlank } from "../src/game/card-text";
import { activateSeat, seatView } from "../src/game/team";
import { hasExecutableScript } from "../src/game/script-registry";
import { armadilloDefenseBlocked } from "../src/game/armadillo";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(s: GameState, c: Command) {
  s = dispatch(s, c);
  expect(s.error, s.error).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(s, { type: "PROCEED" });
    expect(s.error, s.error).toBeUndefined();
  }
  return s;
}
function choose(s: GameState, id: string) {
  expect(
    s.prompt?.options.some((o) => o.id === id),
    s.prompt?.title,
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function allow(s: GameState) {
  for (let n = 0; s.prompt && n < 100; n++) {
    expect(s.prompt.kind).toBe("choice");
    const option =
      s.prompt.options.find((o) =>
        ["take", "resolve", "allow", "pass", "skip", "continue"].includes(o.id),
      ) || s.prompt.options[0];
    s = choose(s, option.id);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function base(players = 1, villainId = "rhino", heroId = "spider_man") {
  let s = newGame({
    heroId,
    aspect: "justice",
    villainId,
    module: "armadillo",
    pacing: "expert",
    seed: 28029,
    ...(players === 2
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (let n = 0; s.phase === "mulligan" && n < 20; n++)
    s = s.prompt
      ? choose(s, s.prompt.options[0].id)
      : command(s, { type: "MULLIGAN", ids: [] });
  s = allow(s);
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  activateSeat(s, "p1");
  s.scheme.threat = 0;
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.prompt = {
    kind: "choice",
    title: "Native encounter",
    text: "Resolve",
    options: [{ id: "go", label: "Resolve", effects }],
  };
  return choose(s, "go");
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
  throw Error("Missing actual encounter " + code);
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code), skip: true });
}
function arm(s: GameState) {
  return s.minions.find((p) => p.code === "28029")!;
}
function attack(s: GameState) {
  return native(s, { type: "enemyAttack", id: arm(s).id });
}
function scheme(s: GameState) {
  return native(s, { type: "enemyScheme", id: arm(s).id });
}
function audit(s: GameState, ids: string[]) {
  const all: Piece[] = [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.resolving,
    ...s.removed,
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ];
  expect(
    all
      .filter((p) => ids.includes(p.id))
      .map((p) => p.id)
      .sort(),
  ).toEqual([...ids].sort());
}
const modularIds = (s: GameState) =>
  s.encounter.deck
    .filter((p) => card(p).set_code === "armadillo")
    .map((p) => p.id);

describe("Armadillo modular set through the actual native dispatcher", () => {
  it("registers five faces and exactly six physical modular cards", () => {
    const s = base();
    expect(MODULES.some((m) => m.id === "armadillo")).toBe(true);
    expect(modularIds(s)).toHaveLength(6);
    for (const code of ["28028", "28029", "28030", "28031", "28032"])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(hasExecutableScript("29037")).toBe(false);
  });
  it.each([1, 2])(
    "reveals per-player scheme threat with %i players",
    (players) => {
      let s = base(players);
      const ids = modularIds(s);
      s = reveal(s, "28028");
      expect(s.sideSchemes.find((p) => p.code === "28028")?.counters).toBe(
        3 * players,
      );
      audit(s, ids);
    },
  );
  it("keeps each Tough card through JSON reload and consumes one per damage instance", () => {
    let s = base();
    const ids = modularIds(s);
    s = reveal(s, "28029");
    const id = arm(s).id;
    s = native(
      s,
      { type: "status", target: id, status: "tough" },
      { type: "status", target: id, status: "tough" },
    );
    expect(arm(s)).toMatchObject({ tough: true, toughCards: 3, damage: 0 });
    s = JSON.parse(JSON.stringify(s));
    for (const remaining of [2, 1, 0]) {
      s = allow(
        native(s, { type: "damage", target: id, amount: 2, attack: true }),
      );
      expect(arm(s)).toMatchObject({
        tough: remaining > 0,
        toughCards: remaining,
        damage: 0,
      });
    }
    s = allow(
      native(s, { type: "damage", target: id, amount: 2, attack: true }),
    );
    expect(arm(s).damage).toBe(2);
    audit(s, ids);
  });
  it("Piercing removes all Tough; zero damage leaves every status intact", () => {
    let s = reveal(base(), "28029");
    const id = arm(s).id;
    s = native(s, { type: "status", target: id, status: "tough" });
    s = allow(
      native(s, {
        type: "damage",
        target: id,
        amount: 0,
        attack: true,
        piercing: true,
      }),
    );
    expect(arm(s).toughCards).toBe(2);
    s = allow(
      native(s, {
        type: "damage",
        target: id,
        amount: 1,
        attack: true,
        piercing: true,
      }),
    );
    expect(arm(s)).toMatchObject({ tough: false, toughCards: 0, damage: 1 });
  });
  it.each(["attack", "scheme"])(
    "grants exactly one Tough after an actual %s",
    (kind) => {
      let s = reveal(base(), "28029");
      s = allow(kind === "attack" ? attack(s) : scheme(s));
      expect(arm(s).toughCards).toBe(2);
    },
  );
  it.each(["stunned", "confused"])(
    "does not grant Tough when %s replaces activation",
    (status) => {
      let s = reveal(base(), "28029");
      const id = arm(s).id;
      s = native(s, { type: "status", target: id, status });
      s = allow(status === "stunned" ? attack(s) : scheme(s));
      expect(arm(s).tough).toBe(true);
      expect(arm(s).toughCards || 1).toBe(1);
      expect(arm(s)[status as "stunned" | "confused"]).toBe(false);
    },
  );
  it.each(["deck", "discard"])(
    "Rollin searches the actual %s instance and attaches once",
    (zone) => {
      let s = base();
      const ids = modularIds(s);
      const original = take(s, "28029");
      s.encounter[zone as "deck" | "discard"].push(original);
      s = allow(reveal(s, "28030"));
      expect(arm(s)).toMatchObject({
        id: original.id,
        engagedWith: "p1",
        tough: true,
      });
      expect(s.attachments.filter((p) => p.code === "28030")).toHaveLength(1);
      expect(s.attachments.find((p) => p.code === "28030")?.attachedTo).toBe(
        original.id,
      );
      audit(s, ids);
    },
  );
  it("Rollin attaches to an already engaged Armadillo without moving its controller", () => {
    let s = reveal(base(2), "28029");
    arm(s).engagedWith = "p2";
    const id = arm(s).id;
    s = allow(reveal(s, "28030"));
    expect(arm(s)).toMatchObject({ id, engagedWith: "p2" });
    expect(s.attachments.find((p) => p.code === "28030")?.attachedTo).toBe(id);
  });
  it("an unsuccessful Rollin search does not invent or duplicate a minion", () => {
    let s = base();
    const original = take(s, "28029");
    s.removed.push(original);
    const id = s.encounter.deck.find((p) => p.code === "28030")!.id;
    s = allow(reveal(s, "28030"));
    expect(s.minions.some((p) => p.code === "28029")).toBe(false);
    expect(s.attachments.some((p) => p.code === "28030")).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("Rollin prevents every seat's basic defense and prevents Backflip from being offered", () => {
    let s = reveal(base(2), "28029");
    s = allow(reveal(s, "28030"));
    const back = s.player.deck.find((p) => p.code === "01003")!;
    s.player.deck = s.player.deck.filter((p) => p.id !== back.id);
    s.player.hand.push(back);
    s = attack(s);
    expect(s.prompt?.title).toBe("Armadillo attacks");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["take"]);
    s = choose(s, "take");
    expect(s.prompt?.options.some((o) => o.image === "01003")).toBe(false);
    s = allow(s);
    expect(s.player.hand.some((p) => p.id === back.id)).toBe(true);
    expect(s.player.exhausted).toBe(false);
  });
  it("removing the last Tough permits ordinary defense immediately", () => {
    let s = allow(reveal(reveal(base(), "28029"), "28030"));
    s = allow(native(s, { type: "damage", target: arm(s).id, amount: 1 }));
    expect(armadilloDefenseBlocked(s, arm(s).id)).toBe(false);
    s = attack(s);
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
  });
  it("Armored Assault adds exactly three ATK to each Tough enemy and stops when defeated", () => {
    let s = reveal(base(), "28029");
    s = reveal(s, "28028");
    s = attack(s);
    expect(s.attack?.base).toBe(5);
    s = allow(s);
    const side = s.sideSchemes.find((p) => p.code === "28028")!;
    s = allow(native(s, { type: "thwart", target: side.id, amount: 3 }));
    s = attack(s);
    expect(s.attack?.base).toBe(2);
  });
  it.each(["hero", "alter"])(
    "Tough and Tumble activates every Tough enemy, including another seat's minion: %s",
    (form) => {
      let s = reveal(base(2), "28029");
      arm(s).engagedWith = "p2";
      s.player.form = form as "hero" | "alter";
      s.villain.tough = true;
      const zeroBoost = take(s, "28032");
      s.encounter.deck.unshift(zeroBoost);
      const id = arm(s).id;
      s = reveal(s, "28031");
      expect(s.prompt?.title).toBe("Tough and Tumble · enemy order");
      s = JSON.parse(JSON.stringify(s));
      s = choose(s, id);
      s = allow(s);
      expect(arm(s)).toMatchObject({ id, engagedWith: "p2", toughCards: 2 });
      expect(s.encounter.dealt).toHaveLength(0);
      if (form === "hero")
        expect(s.players.find((p) => p.id === "p2")!.player.hp).toBe(12);
      else expect(s.scheme.threat).toBe(2);
    },
  );
  it.each(["none", "cancelled"])(
    "Tough and Tumble gains Surge when no activation performed: %s",
    (kind) => {
      let s = base();
      if (kind === "cancelled") {
        s = reveal(s, "28029");
        s = native(s, { type: "status", target: arm(s).id, status: "stunned" });
      }
      const next = s.encounter.deck.find((p) => p.code !== "28031")!.id;
      s = allow(reveal(s, "28031"));
      expect(s.encounter.dealt.map((p) => p.id)).toEqual([next]);
      if (kind === "cancelled") expect(arm(s).toughCards || 1).toBe(1);
    },
  );
  it.each([false, true])(
    "Tough It Out counts actual new status cards, not recipients: villain already Tough=%s",
    (already) => {
      let s = reveal(base(), "28029");
      s.villain.tough = already;
      s = allow(reveal(s, "28032"));
      expect(arm(s).toughCards).toBe(2);
      expect(s.villain.tough).toBe(true);
      expect(s.encounter.dealt).toHaveLength(already ? 1 : 0);
    },
  );
  it("Tough It Out gains Surge when Armadillo is absent", () => {
    let s = base();
    s = allow(reveal(s, "28032"));
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("a completed attack grants Tough even when the target's Tough prevents all damage", () => {
    let s = reveal(base(), "28029");
    const hp = s.player.hp;
    s.player.tough = true;
    s = allow(attack(s));
    expect(s.player.hp).toBe(hp);
    expect(arm(s).toughCards).toBe(2);
  });
  it("Cosmic Flight's printed Defense ability is also blocked", () => {
    let s = allow(
      reveal(reveal(base(1, "rhino", "captain_marvel"), "28029"), "28030"),
    );
    const flight = s.player.deck.find((p) => p.code === "01017")!;
    expect(flight).toBeTruthy();
    s.player.deck = s.player.deck.filter((p) => p.id !== flight.id);
    s.player.inPlay.push(flight);
    const hp = s.player.hp;
    s = choose(attack(s), "take");
    expect((s.prompt?.options || []).some((o) => o.id === "flight")).toBe(
      false,
    );
    expect(s.attack?.defender || "none").toBe("none");
    s = allow(s);
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === flight.id)).toBe(true);
    expect(arm(s).toughCards).toBe(2);
  });
  it("Groot's non-Defense prevention still absorbs damage from an undefendable attack", () => {
    let s = allow(reveal(reveal(base(1, "rhino", "groot"), "28029"), "28030"));
    s.flags.grootGrowthCounters = 2;
    const hp = s.player.hp;
    s = allow(choose(attack(s), "take"));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.flags.grootGrowthCounters).toBe(0);
    expect(s.player.exhausted).toBe(false);
    expect(arm(s).toughCards).toBe(2);
  });
  it.each(["28028", "28030"])(
    "plays original Vivian to blank %s without targeting Elite Armadillo",
    (code) => {
      let s = newGame({
        heroId: "ironheart",
        aspect: "leadership",
        villainId: "rhino",
        module: "armadillo",
        seed: 28029,
        pacing: "expert",
      });
      s = command(s, { type: "MULLIGAN", ids: [] });
      s.player.form = "hero";
      s.player.deck.push(...s.player.hand.splice(0));
      s = reveal(s, "28029");
      s = allow(reveal(s, code));
      const originalId =
        code === "28028" ? s.sideSchemes[0].id : s.attachments[0].id;
      const vivian = s.player.deck.find((p) => p.code === "29024")!;
      const resources = s.player.deck
        .filter((p) => card(p).resource_energy === 1)
        .slice(0, 2);
      expect(resources).toHaveLength(2);
      s.player.deck = s.player.deck.filter(
        (p) => ![vivian.id, ...resources.map((p) => p.id)].includes(p.id),
      );
      s.player.hand.push(vivian, ...resources);
      s = command(s, { type: "PLAY", id: vivian.id });
      expect(s.prompt?.kind).toBe("payment");
      s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
      expect(s.prompt?.title).toBe("Vivian");
      s = choose(s, "yes");
      expect(s.prompt?.options.some((o) => o.id === arm(s).id)).toBe(false);
      expect(s.prompt?.options.some((o) => o.id === originalId)).toBe(true);
      s = choose(s, originalId);
      s = JSON.parse(JSON.stringify(s));
      const source = code === "28028" ? s.sideSchemes[0] : s.attachments[0];
      expect(isTextBlank(s, source)).toBe(true);
      if (code === "28028") {
        s = attack(s);
        expect(s.attack?.base).toBe(2);
      } else {
        s = attack(s);
        expect(s.attack?.base).toBe(4);
        expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
      }
    },
  );
  it.each(["rhino", "klaw", "ultron", "mutagen_formula", "risky_business"])(
    "native setup retains six exact Armadillo pieces: %s",
    (scenario) => {
      const s = newGame({
        heroId: "nova",
        aspect: "aggression",
        villainId: scenario,
        module: "armadillo",
        seed: 28029,
        pacing: "expert",
      });
      expect(modularIds(s)).toHaveLength(6);
      expect(new Set(modularIds(s)).size).toBe(6);
    },
  );
});
