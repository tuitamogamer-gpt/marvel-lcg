import { describe, expect, it } from "vitest";
import { card, MODULES } from "../src/game/cards.js";
import { newGame, targets } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { statusCards } from "../src/game/keywords.js";
import { ACOLYTES_SCRIPT_CODES } from "../src/game/acolytes.js";
import type { GameState, Piece } from "../src/game/types.js";
import { command, choose, native, reload } from "./dv-test-helpers.js";

function settle(s: GameState) {
  for (let n = 0; s.prompt && n < 200; n++) {
    const o =
      s.prompt.options.find((o) =>
        /^(take|allow|skip|pass|continue|none|no|resolve)$/.test(o.id),
      ) || s.prompt.options[0];
    s = choose(s, o.id);
  }
  expect(s.prompt).toBeNull();
  expect(s.error).toBeUndefined();
  return reload(s);
}
function base(team = false) {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    module: "acolytes",
    seed: 321590,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const p of s.players) {
    const v = seatView(s, p);
    v.player.form = "hero";
    v.player.hp = 100;
    v.player.stunned = v.player.confused = v.player.tough = false;
    v.player.stunCards = v.player.confuseCards = v.player.toughCards = 0;
    // Keep actual source instances, remove optional player responses.
    v.player.deck.push(...v.player.hand);
    v.player.hand = [];
  }
  s.villain.hp = s.villain.maxHp = 100;
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.minions,
    s.sideSchemes,
    s.resolving,
  ]) {
    const n = zone.findIndex((p) => p.code === code);
    if (n >= 0) return zone.splice(n, 1)[0];
  }
  throw Error(`Missing original ${code}`);
}
function put(s: GameState, code: string, seat = "p1") {
  const p = take(s, code);
  p.engagedWith = seat;
  s.minions.push(p);
  return p;
}
function reveal(s: GameState, code: string, actorId = "p1") {
  return settle(native(s, { type: "reveal", piece: take(s, code), actorId }));
}
function defeat(s: GameState, p: Piece, actorId = "p1") {
  p.tough = false;
  p.toughCards = 0;
  const result = settle(
    native(s, {
      type: "damage",
      target: p.id,
      amount: 30,
      source: "hero",
      attack: false,
      actorId,
    }),
  );
  return result;
}
const counts = (s: GameState) => [
  ...s.encounter.deck,
  ...s.encounter.discard,
  ...s.encounter.dealt,
  ...(s.encounter.storedBoosts || []),
  ...s.minions,
  ...s.sideSchemes,
  ...s.resolving,
  ...(s.attack?.pendingBoosts || []),
  ...(s.scheming?.pendingBoosts || []),
];

describe("Acolytes original-card native integration", () => {
  it("registers exactly seven selectable original cards", () => {
    const s = base();
    expect(MODULES.find((m) => m.id === "acolytes")).toBeTruthy();
    expect(
      counts(s)
        .filter((p) => card(p).set_code === "acolytes")
        .map((p) => p.code)
        .sort(),
    ).toEqual([...ACOLYTES_SCRIPT_CODES]);
    for (const code of ACOLYTES_SCRIPT_CODES)
      expect(hasExecutableScript(card(code))).toBe(true);
  });
  it("does not activate a lone entrant", () => {
    let s = base();
    const hp = s.player.hp;
    s = reveal(s, "32161");
    expect(s.player.hp).toBe(hp);
  });
  it.each(["hero", "alter"] as const)(
    "Teamwork activates both minions against their own %s seats",
    (form) => {
      let s = base(true);
      const first = put(s, "32161", "p1");
      for (const seat of s.players) seatView(s, seat).player.form = form;
      const before = s.scheme.threat;
      s = reveal(s, "32160", "p2");
      if (form === "hero") {
        expect(seatView(s, "p1").player.hp).toBe(97);
        expect(seatView(s, "p2").player.hp).toBe(99);
      } else expect(s.scheme.threat).toBe(before + 3);
      expect(s.minions.find((p) => p.id === first.id)?.engagedWith).toBe("p1");
    },
  );
  it("Amelia's Stalwart rejects stun and confuse", () => {
    let s = base();
    const m = put(s, "32160");
    s = settle(
      native(
        s,
        { type: "status", target: m.id, status: "stunned" },
        { type: "status", target: m.id, status: "confused" },
      ),
    );
    expect(
      statusCards(
        s.minions.find((p) => p.id === m.id)!,
        "stunned",
      ),
    ).toBe(0);
    expect(
      statusCards(
        s.minions.find((p) => p.id === m.id)!,
        "confused",
      ),
    ).toBe(0);
  });
  it.each([false, true])(
    "Amelia uses the actual defeating player's existing confuse (%s)",
    (already) => {
      let s = base(true);
      const m = put(s, "32160", "p1");
      seatView(s, "p2").player.confused = already;
      seatView(s, "p2").player.confuseCards = Number(already);
      const before = s.scheme.threat;
      s = defeat(s, m, "p2");
      expect(s.scheme.threat).toBe(before + (already ? 2 : 0));
      expect(seatView(s, "p2").player.confused).toBe(true);
      expect(seatView(s, "p1").player.confused).toBe(false);
    },
  );
  it.each([false, true])(
    "Senyaka uses the defeating player's existing stun (%s)",
    (already) => {
      let s = base(true);
      const m = put(s, "32161");
      const p = seatView(s, "p2").player;
      p.stunned = already;
      p.stunCards = Number(already);
      s = defeat(s, m, "p2");
      expect(seatView(s, "p2").player.stunned).toBe(true);
      expect(seatView(s, "p2").player.hp).toBe(already ? 97 : 100);
    },
  );
  it("Delgado clears every villain status and preserves the actual boost card", () => {
    let s = base();
    const m = put(s, "32162"),
      boost = s.encounter.deck[0];
    s.villain.stunned = s.villain.confused = true;
    s.villain.stunCards = s.villain.confuseCards = 2;
    s = defeat(s, m);
    expect(statusCards(s.villain, "stunned")).toBe(0);
    expect(statusCards(s.villain, "confused")).toBe(0);
    expect(s.encounter.storedBoosts?.map((p) => p.id)).toContain(boost.id);
  });
  it.each([false, true])(
    "Unuscione tough or heal uses existing villain tough (%s)",
    (already) => {
      let s = base();
      const m = put(s, "32163");
      s.villain.hp = 80;
      s.villain.tough = already;
      s.villain.toughCards = Number(already);
      s = defeat(s, m);
      expect(s.villain.hp).toBe(already ? 84 : 80);
      expect(statusCards(s.villain, "tough")).toBe(1);
    },
  );
  it("Fabian puts the SAME discarded minion and leaves before its Teamwork window", () => {
    let s = base();
    const fabian = put(s, "32159"),
      next = take(s, "32161");
    s.encounter.deck.unshift(next);
    s = defeat(s, fabian);
    expect(s.encounter.discard.some((p) => p.id === fabian.id)).toBe(true);
    expect(s.minions.find((p) => p.code === "32161")?.id).toBe(next.id);
    expect(s.player.hp).toBe(100);
    expect(counts(s).filter((p) => p.id === next.id)).toHaveLength(1);
  });
  it("Fabian replacement still triggers Teamwork with a surviving Acolyte", () => {
    let s = base();
    const fabian = put(s, "32159");
    put(s, "32160");
    const next = take(s, "32161");
    s.encounter.deck.unshift(next);
    s = defeat(s, fabian);
    expect(s.player.hp).toBe(96);
  });
  it("Fabian's discard stops at deck exhaustion without finding himself", () => {
    let s = base();
    const fabian = put(s, "32159");
    const filler = take(s, "01108");
    s.encounter.discard.push(...s.encounter.deck);
    s.encounter.deck = [filler];
    s = defeat(s, fabian);
    expect(s.minions.some((p) => p.id === fabian.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === fabian.id)).toBe(true);
    expect(s.encounter.acceleration).toBe(1);
  });
  it("Zeal resolves abilities without defeating the minions", () => {
    let s = base();
    const a = put(s, "32160"),
      b = put(s, "32161");
    s = reveal(s, "32164");
    expect(s.player.confused).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.minions.map((p) => p.id)).toEqual([a.id, b.id]);
  });
  it("Zeal reveals the SAME discarded minion when no Acolyte is engaged", () => {
    let s = base();
    const m = take(s, "32163");
    s.encounter.deck.unshift(m);
    s = reveal(s, "32164");
    expect(s.minions.find((p) => p.id === m.id)?.tough).toBe(true);
    expect(counts(s).filter((p) => p.id === m.id)).toHaveLength(1);
  });
  it("The Acolytes grants Guard and removes the grant when defeated", () => {
    let s = base();
    const m = put(s, "32160");
    s = reveal(s, "32165");
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    const scheme = s.sideSchemes.find((p) => p.code === "32165")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 99,
        source: "hero",
      }),
    );
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    expect(s.minions.some((p) => p.id === m.id)).toBe(true);
  });
  it("the boost shuffles only physical Acolyte minions from discard", () => {
    let s = base();
    const a = take(s, "32160"),
      b = take(s, "32161"),
      other = take(s, "01108");
    s.encounter.discard.push(a, b, other);
    s = settle(native(s, { type: "acolytes:shuffle" }));
    expect(
      s.encounter.deck.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
    expect(s.encounter.discard.map((p) => p.id)).toContain(other.id);
  });
  it("Senyaka's native attack pierces actual identity Tough", () => {
    let s = base();
    const m = put(s, "32161");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(
      native(s, {
        type: "enemyAttack",
        id: m.id,
        actorId: "p1",
        activation: {
          kind: "attack",
          enemyId: m.id,
          playerId: "p1",
          modifier: 0,
        },
      }),
    );
    expect(s.player.hp).toBe(97);
    expect(statusCards(s.player, "tough")).toBe(0);
  });
  it("Fabian's Villainous draws and resolves an actual boost card", () => {
    let s = base();
    const m = put(s, "32159"),
      boost = take(s, "32160");
    s.encounter.deck.unshift(boost);
    s = settle(
      native(s, {
        type: "enemyAttack",
        id: m.id,
        actorId: "p1",
        activation: {
          kind: "attack",
          enemyId: m.id,
          playerId: "p1",
          modifier: 0,
        },
      }),
    );
    expect(s.player.hp).toBe(97);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
  });
  it("The Acolytes actual star boost shuffles original discarded minions", () => {
    let s = base();
    const a = take(s, "32160"),
      b = take(s, "32161"),
      boost = take(s, "32165");
    s.encounter.discard.push(a, b);
    s.encounter.deck.unshift(boost);
    s = settle(
      native(s, {
        type: "enemyAttack",
        id: s.villain.id,
        actorId: "p1",
        activation: {
          kind: "attack",
          enemyId: s.villain.id,
          playerId: "p1",
          modifier: 0,
        },
      }),
    );
    expect(
      s.encounter.deck.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
  });
  it("blank text suppresses Teamwork and When Defeated, while another source can still grant Guard", () => {
    let s = base();
    const m = put(s, "32160");
    s.flags["novaIronheartPackBlank:" + m.id] = s.round;
    s = reveal(s, "32165");
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    s = defeat(
      s,
      s.minions.find((p) => p.id === m.id)!,
    );
    expect(s.player.confused).toBe(false);
  });
  it("Zeal does not use its no-Acolyte fallback for a blank engaged Acolyte", () => {
    let s = base();
    const m = put(s, "32160");
    s.flags["novaIronheartPackBlank:" + m.id] = s.round;
    const next = s.encounter.deck[0].id;
    s = reveal(s, "32164");
    expect(s.encounter.deck[0].id).toBe(next);
    expect(s.player.confused).toBe(false);
  });
});
