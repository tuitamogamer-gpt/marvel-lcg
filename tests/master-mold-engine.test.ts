/** Native Master Mold acceptance moves original physical source cards and
 * hydrates every command. Printed triggered effects run through dispatch. */
import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { advisePrompt } from "../src/game/advisor.js";
import {
  abilityOptions,
  allyCount,
  enemyStats,
  escalation,
  newGame,
  schemeLimit,
  targets,
} from "../src/game/engine.js";
import { statusCards } from "../src/game/keywords.js";
import { activateSeat, controller, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  passId,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { masterMoldOriginalIds?: string[] };
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
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
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const ids = physical(s)
    .map((p) => p.id)
    .sort();
  expect(new Set(ids).size, "one physical zone per original ID").toBe(
    ids.length,
  );
  const originals = (s as Fixture).masterMoldOriginalIds;
  if (originals) expect(ids).toEqual([...originals].sort());
  return s;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 180; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      s.prompt.options.find((o) => o.id === "allow")?.id ||
      (/forced|order|setup|each player|children/i.test(s.prompt.title) ||
      s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function opening(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  module = "zero_tolerance",
  heroId = "spider_man",
) {
  const first = { heroId, aspect: "justice" as const };
  return newGame({
    ...first,
    villainId: "master_mold",
    module,
    difficulty,
    seed: 321090,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            first,
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  });
}
function base(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  module = "zero_tolerance",
  heroId = "spider_man",
) {
  let s = settle(opening(team, difficulty, module, heroId));
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const magneto = p.inPlay.filter((p) => p.code === "32172b");
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay].filter(
      (p) => p.code !== "32172b",
    );
    expect(source).toHaveLength(40);
    p.deck = source;
    p.hand = p.discard = [];
    p.inPlay = magneto;
    p.form = "hero";
    p.flipped = p.exhausted = p.stunned = p.confused = p.tough = false;
    p.stunCards = p.confuseCards = p.toughCards = 0;
  }
  // Clear setup engagements by moving the same cards to actual discard.
  s.encounter.discard.push(...s.minions.splice(0));
  for (const p of s.attachments.splice(0)) {
    delete p.attachedTo;
    s.encounter.discard.push(p);
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.scheme.threat = 0;
  (s as Fixture).masterMoldOriginalIds = physical(s).map((p) => p.id);
  return exact(reload(s));
}
function take(s: GameState, code: string, playerId?: string): Piece {
  const zones = playerId
    ? (() => {
        const p = seatView(s, playerId).player;
        return [p.deck, p.hand, p.discard, p.inPlay];
      })()
    : [s.encounter.deck, s.encounter.discard, s.encounter.dealt];
  for (const zone of zones) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing original ${playerId || "encounter"}:${code}`);
}
function minion(s: GameState, code = "32114", playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  p.damage = 0;
  p.tough = p.stunned = p.confused = false;
  p.toughCards = p.stunCards = p.confuseCards = 0;
  s.minions.push(p);
  return p;
}
function ally(s: GameState, code = "01083", playerId = "p1") {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function attach(s: GameState, code: string, target: string) {
  const p = take(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
function top(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => take(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}
function magneto(s: GameState) {
  const p = s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "32172b");
  expect(p, "actual setup Magneto").toBeTruthy();
  return p!;
}
function attack(s: GameState, id = s.villain.id, playerId = "p1") {
  return native(s, {
    type: "enemyAttack",
    id,
    actorId: playerId,
    activation: { enemyId: id, playerId, kind: "attack" },
  });
}
function scheme(s: GameState, id = s.villain.id, playerId = "p1") {
  return native(s, {
    type: "enemyScheme",
    id,
    actorId: playerId,
    activation: { enemyId: id, playerId, kind: "scheme" },
  });
}
function defend(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code), skip: true });
}
function attachPrompt(s: GameState, target: string) {
  if (s.prompt?.options.some((o) => o.id === target)) return choose(s, target);
  return s;
}
// Native basic powers auto-select their only legal target. A response window
// may already be open when the same public ABILITY command returns.
function attackTarget(s: GameState, target: string) {
  return s.prompt?.options.some((o) => o.id === target) ? choose(s, target) : s;
}

describe("Master Mold original-source native setup and main scheme", () => {
  it.each([false, true])(
    "puts one Sentinel per player into play and keeps fixed sets unique (team %s)",
    (team) => {
      let s = settle(opening(team));
      for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
      s = settle(s);
      expect(s.villain).toMatchObject({
        code: "32109",
        hp: 12 * s.playerCount,
        tough: true,
      });
      expect(s.scheme).toMatchObject({ code: "32112b", threat: s.playerCount });
      expect(schemeLimit(s)).toBe(6 * s.playerCount);
      expect(escalation(s)).toBe(s.playerCount);
      for (const seat of s.players) {
        expect(s.minions.filter((p) => p.engagedWith === seat.id)).toHaveLength(
          1,
        );
        expect(
          s.minions
            .filter((p) => p.engagedWith === seat.id)
            .every((p) => card(p).traits?.includes("Sentinel.")),
        ).toBe(true);
      }
      expect(controller(s, magneto(s).id)?.id).toBe(s.firstPlayerId);
      const all = physical(s);
      expect(all.filter((p) => p.code === "32105")).toHaveLength(2);
      expect(all.filter((p) => p.code === "32106")).toHaveLength(2);
      expect(all.filter((p) => p.code === "32107")).toHaveLength(2);
      expect(all.filter((p) => p.code === "32108")).toHaveLength(1);
      expect(all.filter((p) => p.code === "32104")).toHaveLength(1);
      expect(all.filter((p) => p.code === "32172b")).toHaveLength(1);
      expect(all.some((p) => p.code === "32172a")).toBe(false);
      exact(reload(s));
    },
  );

  it("lets the first player order setup before opening hands, resolving one actual mill per seat", () => {
    let s = opening(true);
    expect(s.prompt?.title).toMatch(/each player/i);
    expect(
      s.players.every((seat) => seatView(s, seat).player.hand.length === 0),
    ).toBe(true);
    s = settle(choose(s, "p2"));
    expect(s.phase).toBe("mulligan");
    expect(
      s.players.every((seat) => seatView(s, seat).player.hand.length === 6),
    ).toBe(true);
    expect(s.minions.filter((p) => p.engagedWith === "p1")).toHaveLength(1);
    expect(s.minions.filter((p) => p.engagedWith === "p2")).toHaveLength(1);
    expect(controller(s, magneto(s).id)?.id).toBe("p1");
    exact(reload(s));
  });

  it("starts Expert at Master Mold II with his physical Tough status", () => {
    const s = base(false, "expert");
    expect(s.villain).toMatchObject({
      code: "32110",
      stage: 2,
      hp: 14,
      maxHp: 14,
      tough: true,
    });
    expect(enemyStats(s, s.villain)).toEqual({ attack: 3, scheme: 2 });
  });

  it.each([false, true])(
    "advances at6N, shuffles discard and mills each seat, then loses at8N (team %s)",
    (team) => {
      let s = base(team);
      const n = s.playerCount,
        beforeIds = physical(s).map((p) => p.id);
      // Every eligible Sentinel is in discard. Stage2A must shuffle them in before milling.
      s.encounter.discard.push(...s.encounter.deck.splice(0));
      s.scheme.threat = 6 * n - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.scheme).toMatchObject({ code: "32113b", threat: n });
      expect(schemeLimit(s)).toBe(8 * n);
      for (const seat of s.players)
        expect(s.minions.filter((p) => p.engagedWith === seat.id)).toHaveLength(
          1,
        );
      expect(
        physical(s)
          .map((p) => p.id)
          .sort(),
      ).toEqual(beforeIds.sort());
      s.scheme.threat = 8 * n - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.phase).toBe("lost");
    },
  );

  it("main-scheme Guard applies to blank minions and ends when its own text is blank", () => {
    const s = base(),
      p = minion(s, "32105");
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    s.flags["novaIronheartPackBlank:main"] = s.round;
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    expect(targets(s, "enemy", false).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    exact(s);
  });

  it.each([false, true])(
    "Shield Toss's real target prompt and advisor honor granted Guard, including a blank minion (main blank %s)",
    (mainBlank) => {
      let s = base(false, "standard", "zero_tolerance", "captain_america");
      const p = minion(s, "32105");
      s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
      if (mainBlank) s.flags["novaIronheartPackBlank:main"] = s.round;
      const shield = take(s, "03009", "p1"),
        toss = take(s, "03006", "p1"),
        cost = take(s, "03003", "p1");
      s.player.inPlay.push(shield);
      s.player.hand.push(toss, cost);
      s = command(s, { type: "PLAY", id: toss.id });
      expect(s.prompt?.title).toBe("Shield Toss · discard");
      s = command(s, { type: "SELECT", ids: [cost.id] });
      expect(s.prompt?.title).toBe("Shield Toss · targets");
      const legalTargets = targets(s, "enemy", true).map((t) => t.id);
      expect(s.prompt?.options.map((o) => o.id)).toEqual(legalTargets);
      expect(legalTargets.includes(s.villain.id)).toBe(mainBlank);
      const advice = advisePrompt(s);
      expect(advice?.command).toEqual({
        type: "SELECT",
        ids: [mainBlank ? s.villain.id : p.id],
      });
      s = settle(command(s, advice!.command));
      expect(s.minions.find((m) => m.id === p.id)?.damage).toBe(
        mainBlank ? 0 : 4,
      );
      expect(s.player.hand.some((p) => p.id === shield.id)).toBe(true);
      expect(s.player.discard.some((p) => p.id === cost.id)).toBe(true);
    },
  );

  it("ordinary Operation Zero Tolerance remains defeatable in this main scheme", () => {
    let s = base();
    const operation = take(s, "32104");
    s = settle(native(s, { type: "reveal", piece: operation, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === operation.id)?.counters).toBe(3);
    s = settle(
      native(s, {
        type: "thwart",
        target: operation.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === operation.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === operation.id)).toBe(true);
  });
});

describe("Master Mold native activations and engagements", () => {
  it("Stalwart rejects both actual native status grants", () => {
    let s = base();
    s = settle(
      native(
        s,
        { type: "status", target: s.villain.id, status: "stunned" },
        { type: "status", target: s.villain.id, status: "confused" },
      ),
    );
    expect(statusCards(s.villain, "stunned")).toBe(0);
    expect(statusCards(s.villain, "confused")).toBe(0);
  });

  it("scheming mills actual cards, puts without MarkVI reveal, and uses no boost", () => {
    let s = base();
    s.player.form = "alter";
    const [discarded, sentinel, next] = top(s, "32117", "32106", "32119");
    s = settle(scheme(s));
    expect(s.minions.find((p) => p.id === sentinel.id)?.engagedWith).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === discarded.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.scheme.threat).toBe(1);
  });

  it("suppresses new boosts while resolving actual preassigned boosts on this activation", () => {
    let s = base();
    s.player.form = "alter";
    const stored = take(s, "32117"),
      assigned = take(s, "32120");
    s.encounter.storedBoosts = [stored];
    s.villain.inheritorBoosts = [assigned];
    const [sentinel, next] = top(s, "32105", "32119");
    s = settle(scheme(s));
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.storedBoosts).toEqual([]);
    expect(s.villain.inheritorBoosts).toEqual([]);
    expect(s.encounter.discard.some((p) => p.id === stored.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === assigned.id)).toBe(true);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.minions.some((p) => p.id === sentinel.id)).toBe(true);
    s = settle(attack(s));
    expect(s.encounter.discard.some((p) => p.id === next.id)).toBe(true);
  });

  it("stops at the first exhausted deck without a Sentinel, still skips the boost, and resets on the next scheme", () => {
    let s = base();
    s.player.form = "alter";
    const one = take(s, "32119"),
      two = take(s, "32120");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(one, two);
    const acceleration = s.encounter.acceleration;
    s = settle(scheme(s));
    expect(s.minions).toHaveLength(0);
    expect(s.scheme.threat).toBe(1);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.encounter.deck.length).toBeGreaterThan(2);
    const [sentinel, next] = top(s, "32105", "32117");
    s = settle(scheme(s));
    expect(s.minions.find((p) => p.id === sentinel.id)?.engagedWith).toBe("p1");
    expect(s.scheme.threat).toBe(2);
    expect(s.encounter.deck[0].id).toBe(next.id);
  });

  it("a blanked confused activation replaces scheming before any mill or boost", () => {
    let s = base();
    s.player.form = "alter";
    s.flags[`novaIronheartPackBlank:${s.villain.id}`] = s.round;
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    const [next] = top(s, "32119", "32105");
    const count = s.encounter.discard.length;
    s = settle(scheme(s));
    expect(s.villain.confused).toBe(false);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.encounter.discard).toHaveLength(count);
    expect(s.minions).toHaveLength(0);
    expect(s.scheme.threat).toBe(0);
  });

  it("a blanked Master Mold schemes normally with a real boost and no mill", () => {
    let s = base();
    s.player.form = "alter";
    s.flags[`novaIronheartPackBlank:${s.villain.id}`] = s.round;
    const [boost, next] = top(s, "32119", "32105");
    s = settle(scheme(s));
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.minions).toHaveLength(0);
  });

  it("Master Mold's PUT still resolves Quickstrike when the engaged identity is a hero", () => {
    let s = base();
    const [p, next] = top(s, "32106", "32119");
    const hp = s.player.hp;
    s = settle(scheme(s));
    expect(s.minions.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.scheme.threat).toBe(1);
  });

  it("MarkVIII attaches the actual topmost discarded Sentinel attachment on reveal", () => {
    let s = base();
    const older = take(s, "32115"),
      newer = take(s, "32116");
    s.encounter.discard.push(older, newer);
    const p = take(s, "32114");
    s = settle(native(s, { type: "reveal", piece: p, skip: true }));
    expect(s.attachments.find((q) => q.id === newer.id)?.attachedTo).toBe(p.id);
    expect(s.encounter.discard.some((q) => q.id === older.id)).toBe(true);
    expect(
      enemyStats(
        s,
        s.minions.find((q) => q.id === p.id)!,
      ),
    ).toEqual({ attack: 4, scheme: 3 });
  });

  it("MarkVIII's scheme-mill entry directly attaches Barrier without its reveal Tough", () => {
    let s = base();
    s.player.form = "alter";
    const barrier = take(s, "32103");
    s.encounter.discard.push(barrier);
    const [p, next] = top(s, "32114", "32119");
    s = settle(scheme(s));
    expect(s.attachments.find((q) => q.id === barrier.id)?.attachedTo).toBe(
      p.id,
    );
    expect(s.minions.find((q) => q.id === p.id)?.tough).toBe(false);
    expect(s.encounter.deck[0].id).toBe(next.id);
  });

  it("MarkVIII re-engagement attaches another actual source, while same-seat movement does not", () => {
    let s = base(true);
    const p = minion(s, "32114", "p2"),
      beam = attach(s, "32116", p.id);
    const second = take(s, "32116");
    s.encounter.discard.push(second);
    s = settle(
      native(s, { type: "thor:engage-target", target: p.id, aerial: true }),
    );
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p1");
    expect(
      s.attachments
        .filter((q) => q.code === "32116" && q.attachedTo === p.id)
        .map((q) => q.id)
        .sort(),
    ).toEqual([beam.id, second.id].sort());
    const unit = take(s, "32115");
    s.encounter.discard.push(unit);
    s = settle(
      native(s, { type: "thor:engage-target", target: p.id, aerial: true }),
    );
    expect(s.encounter.discard.some((q) => q.id === unit.id)).toBe(true);
  });
});

describe("Master Mold native attachments and actual damaged defenders", () => {
  it("UnitUpgrade grants printed stats once, text HP and Retaliate only while unblank", () => {
    let s = base();
    const p = minion(s),
      unit = take(s, "32115");
    p.damage = 7;
    s = settle(
      attachPrompt(
        native(s, { type: "reveal", piece: unit, skip: true }),
        p.id,
      ),
    );
    expect(
      enemyStats(
        s,
        s.minions.find((q) => q.id === p.id)!,
      ),
    ).toEqual({ attack: 4, scheme: 4 });
    const m = magneto(s);
    m.damage = 0;
    s = command(s, { type: "ABILITY", id: m.id, action: "attack" });
    s = settle(attackTarget(s, p.id));
    expect(s.minions.some((q) => q.id === p.id)).toBe(false);
    expect(magneto(s).damage).toBe(1);
    // The defeat removes retaliate's source; consequence remains exactly one.
    expect(s.encounter.discard.some((q) => q.id === unit.id)).toBe(true);
  });

  it.each([false, true])(
    "UnitUpgrade preserves minion damage and blanks only text HP/Retaliate (blank %s)",
    (blank) => {
      let s = base();
      const p = minion(s),
        unit = attach(s, "32115", p.id);
      p.damage = 4;
      if (blank) s.flags[`novaIronheartPackBlank:${unit.id}`] = s.round;
      expect(enemyStats(s, p)).toEqual({ attack: 4, scheme: 4 });
      const m = magneto(s);
      s = command(s, { type: "ABILITY", id: m.id, action: "attack" });
      s = settle(attackTarget(s, p.id));
      expect(s.minions.find((q) => q.id === p.id)?.damage).toBe(7);
      expect(magneto(s).damage).toBe(blank ? 1 : 2);
      s = settle(
        native(s, { type: "damage", target: p.id, amount: 1, source: "hero" }),
      );
      expect(s.minions.some((q) => q.id === p.id)).toBe(!blank);
      if (!blank) expect(s.minions.find((q) => q.id === p.id)?.damage).toBe(8);
    },
  );

  it.each([false, true])(
    "StunBeam stuns the actual cooperative hero defender only after damage (Tough %s)",
    (tough) => {
      let s = base(true);
      const p = minion(s),
        beam = attach(s, "32116", p.id);
      const other = seatView(s, "p2").player;
      other.tough = tough;
      other.toughCards = tough ? 1 : 0;
      const p1Hp = s.player.hp,
        p2Hp = other.hp;
      s = settle(defend(attack(s, p.id), "hero:p2"));
      expect(seatView(s, "p1").player.hp).toBe(p1Hp);
      expect(seatView(s, "p2").player.hp).toBe(tough ? p2Hp : p2Hp - 3);
      expect(seatView(s, "p1").player.stunned).toBe(false);
      expect(seatView(s, "p2").player.stunned).toBe(!tough);
      expect(s.attachments.some((q) => q.id === beam.id)).toBe(true);
    },
  );

  it("StunBeam stuns a surviving actual ally defender", () => {
    let s = base();
    const p = minion(s),
      beam = attach(s, "32116", p.id),
      m = magneto(s);
    s = settle(defend(attack(s, p.id), m.id));
    expect(magneto(s).damage).toBe(4);
    expect(magneto(s).stunned).toBe(true);
    expect(s.player.stunned).toBe(false);
    expect(s.attachments.some((q) => q.id === beam.id)).toBe(true);
  });

  it("StunBeam excludes separate boost damage when the actual ally takes no attack damage", () => {
    let s = base();
    const p = minion(s),
      m = magneto(s);
    attach(s, "32116", p.id);
    p.inheritorBoosts = [take(s, "32102")];
    s.player.stunned = true;
    s.player.stunCards = 1;
    m.tough = true;
    m.toughCards = 1;
    const hp = s.player.hp;
    s = settle(defend(attack(s, p.id), m.id));
    expect(s.player.hp).toBe(hp - 2);
    expect(magneto(s)).toMatchObject({
      damage: 0,
      tough: false,
      stunned: false,
    });
  });

  it("a stunned attached minion replaces its attack without damaging or stunning the character", () => {
    let s = base();
    const p = minion(s);
    attach(s, "32116", p.id);
    p.stunned = true;
    p.stunCards = 1;
    const hp = s.player.hp;
    s = settle(attack(s, p.id));
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(false);
    expect(s.minions.find((q) => q.id === p.id)?.stunned).toBe(false);
  });

  it("blanked StunBeam retains printed +1ATK but cannot stun", () => {
    let s = base();
    const p = minion(s),
      beam = attach(s, "32116", p.id);
    s.flags[`novaIronheartPackBlank:${beam.id}`] = s.round;
    const hp = s.player.hp;
    s = settle(attack(s, p.id));
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.stunned).toBe(false);
  });
});

describe("Master Mold native encounter effects and Magneto", () => {
  it.each(["hero", "alter"] as const)(
    "Children activates all engaged minions sequentially in %s form",
    (form) => {
      let s = base();
      s.player.form = form;
      const one = minion(s, "32105"),
        two = minion(s, "32102");
      if (form === "hero") {
        one.stunned = true;
        one.stunCards = 1;
      } else {
        one.confused = true;
        one.confuseCards = 1;
      }
      const hp = s.player.hp;
      s = settle(reveal(s, "32117"));
      expect(s.minions.find((p) => p.id === one.id)?.stunned).toBe(false);
      expect(s.minions.find((p) => p.id === one.id)?.confused).toBe(false);
      if (form === "hero") {
        expect(s.player.hp).toBe(hp - 3);
        expect(s.scheme.threat).toBe(0);
      } else {
        expect(s.scheme.threat).toBe(2);
        expect(s.player.hp).toBe(hp);
      }
      expect(s.minions.some((p) => p.id === two.id)).toBe(true);
    },
  );

  it.each(["hero", "alter"] as const)(
    "Children also activates actual non-Sentinel minions in %s form",
    (form) => {
      let s = base(false, "standard", "bomb_scare");
      s.player.form = form;
      minion(s, "32105");
      const hydra = minion(s, "01110");
      const hp = s.player.hp;
      s = settle(reveal(s, "32117"));
      expect(s.minions.some((p) => p.id === hydra.id)).toBe(true);
      expect(s.player.hp).toBe(form === "hero" ? hp - 4 : hp);
      expect(s.scheme.threat).toBe(form === "hero" ? 0 : 2);
    },
  );

  it("Children without engaged minions initiates Master Mold's real scheme interrupt", () => {
    let s = base();
    s.player.form = "alter";
    const [p, next] = top(s, "32105", "32119");
    s = settle(reveal(s, "32117"));
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p1");
    expect(s.scheme.threat).toBe(1);
    expect(s.encounter.deck[0].id).toBe(next.id);
  });

  it.each(["empty", "tough", "mixed"] as const)(
    "ShieldsUp surges only when no actual Tough status is given (%s)",
    (kind) => {
      let s = base(true);
      const other = minion(s, "32105", "p2");
      let own: Piece | undefined;
      if (kind !== "empty") {
        own = minion(s, "32114");
        own.tough = kind === "tough";
        own.toughCards = own.tough ? 1 : 0;
        if (kind === "mixed") {
          const alreadyTough = minion(s, "32114");
          alreadyTough.tough = true;
          alreadyTough.toughCards = 1;
        }
      }
      const [next] = top(s, "32120");
      s = settle(reveal(s, "32118"));
      expect(s.minions.find((p) => p.id === other.id)?.tough).toBe(false);
      if (own) expect(s.minions.find((p) => p.id === own.id)?.tough).toBe(true);
      expect(
        s.encounter.dealt.some((p) => p.id === next.id && p.dealtTo === "p1"),
      ).toBe(kind !== "mixed");
      if (kind === "mixed") expect(s.encounter.deck[0].id).toBe(next.id);
    },
  );

  it("IntruderAlert mills for the actual thwarting seat", () => {
    let s = base(true);
    const alert = take(s, "32119");
    s = settle(native(s, { type: "reveal", piece: alert, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === alert.id)?.counters).toBe(6);
    const [p, next] = top(s, "32105", "32117");
    s = settle(
      native(s, {
        type: "thwart",
        target: alert.id,
        amount: 6,
        source: "hero:p2",
        actorId: "p2",
      }),
    );
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p2");
    expect(s.encounter.deck[0].id).toBe(next.id);
  });

  it("Virus uses fixed2 plus Hinder2N, damages all Sentinel enemies and retains its actual Victory source", () => {
    let s = base(true, "standard", "bomb_scare");
    const own = minion(s, "32114"),
      other = minion(s, "32105", "p2"),
      hydra = minion(s, "01110");
    const virus = take(s, "32120");
    s = settle(native(s, { type: "reveal", piece: virus, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === virus.id)?.counters).toBe(6);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "thwart",
        target: virus.id,
        amount: 6,
        source: "hero:p2",
        actorId: "p2",
      }),
    );
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.minions.find((p) => p.id === own.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === hydra.id)?.damage).toBe(0);
    expect(s.victoryDisplay?.filter((p) => p.id === virus.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === virus.id)).toBe(false);
  });

  it("Magneto follows the first player with the same source and never consumes an ally slot", () => {
    let s = base(true);
    const m = magneto(s);
    m.damage = 2;
    m.exhausted = true;
    const allies = s.player.deck
      .filter((p) => card(p).type_code === "ally")
      .slice(0, 3);
    for (const p of allies) ally(s, p.code);
    expect(allyCount(s)).toBe(3);
    s = settle(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p2");
    expect(magneto(s)).toMatchObject({ id: m.id, damage: 2, exhausted: true });
    expect(controller(s, m.id)?.id).toBe("p2");
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === m.id)).toBe(
      false,
    );
    expect(allyCount(s)).toBe(0);
  });

  it("first-player elimination transfers the same Magneto before removing the defeated seat's cards", () => {
    let s = base(true);
    const m = magneto(s);
    m.damage = 2;
    m.exhausted = true;
    const p = minion(s),
      beam = take(s, "32116");
    s.encounter.discard.push(beam);
    s = settle(
      native(s, {
        type: "damage",
        target: "hero:p1",
        amount: s.player.hp,
        source: "enemy",
      }),
    );
    expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
    expect(s.firstPlayerId).toBe("p2");
    expect(controller(s, m.id)?.id).toBe("p2");
    expect(magneto(s)).toMatchObject({ id: m.id, damage: 2, exhausted: true });
    expect(s.removed.some((piece) => piece.id === m.id)).toBe(false);
    expect(s.minions.find((piece) => piece.id === p.id)?.engagedWith).toBe(
      "p2",
    );
    expect(
      s.attachments.find((piece) => piece.id === beam.id)?.attachedTo,
    ).toBe(p.id);
  });

  it("Magneto's ordinary thwart removes2 and places1 consequential damage", () => {
    let s = base();
    const m = magneto(s);
    s.scheme.threat = 4;
    expect(abilityOptions(s, m).map((o) => o.id)).toContain("thwart");
    s = command(s, { type: "ABILITY", id: m.id, action: "thwart" });
    if (s.prompt?.options.some((o) => o.id === "main")) s = choose(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(2);
    expect(magneto(s)).toMatchObject({ damage: 1, exhausted: true });
  });

  it.each([true, false])(
    "Magneto's Sentinel-kill heal is optional and precedes lethal consequence (accept %s)",
    (accept) => {
      let s = base();
      const m = magneto(s);
      m.damage = 4;
      const p = minion(s, "32105");
      p.damage = 2;
      s = command(s, { type: "ABILITY", id: m.id, action: "attack" });
      s = attackTarget(s, p.id);
      if (accept) s = respond(s, /Magneto/);
      s = settle(s);
      expect(s.minions.some((q) => q.id === p.id)).toBe(false);
      if (accept) expect(magneto(s)).toMatchObject({ id: m.id, damage: 4 });
      else {
        expect(
          s.players.some((seat) =>
            seatView(s, seat).player.inPlay.some((p) => p.id === m.id),
          ),
        ).toBe(false);
        expect(s.victoryDisplay?.some((p) => p.id === m.id)).toBe(true);
        expect(s.encounter.discard.some((p) => p.id === m.id)).toBe(false);
      }
    },
  );

  it.each([false, true])(
    "an enemy-defeated Magneto passes through Victory to OZT unless blanking removes him from game (blank %s)",
    (blank) => {
      let s = base();
      const operation = take(s, "32104");
      s = settle(native(s, { type: "reveal", piece: operation, skip: true }));
      const m = magneto(s);
      m.damage = 4;
      if (blank) s.flags[`novaIronheartPackBlank:${m.id}`] = s.round;
      const p = minion(s);
      s = settle(defend(attack(s, p.id), m.id));
      expect(
        s.players.some((seat) =>
          seatView(s, seat).player.inPlay.some((p) => p.id === m.id),
        ),
      ).toBe(false);
      expect(s.victoryDisplay?.some((p) => p.id === m.id) || false).toBe(false);
      expect(
        s.sideSchemes
          .find((p) => p.id === operation.id)
          ?.captured?.some((p) => p.id === m.id) || false,
      ).toBe(!blank);
      expect(s.removed.some((p) => p.id === m.id)).toBe(blank);
      expect(s.encounter.discard.some((p) => p.id === m.id)).toBe(false);
    },
  );

  it("Magneto's actual non-Sentinel kill cannot heal him", () => {
    let s = base(false, "standard", "bomb_scare");
    const m = magneto(s);
    m.damage = 2;
    const hydra = minion(s, "01110");
    s = command(s, { type: "ABILITY", id: m.id, action: "attack" });
    s = settle(attackTarget(s, hydra.id));
    expect(s.minions.some((p) => p.id === hydra.id)).toBe(false);
    expect(magneto(s).damage).toBe(3);
  });

  it("Magneto's ally-limit exemption is suppressed by blanking his own text", () => {
    const s = base(),
      m = magneto(s);
    expect(allyCount(s)).toBe(0);
    s.flags[`novaIronheartPackBlank:${m.id}`] = s.round;
    expect(allyCount(s)).toBe(1);
    delete s.flags[`novaIronheartPackBlank:${m.id}`];
    expect(allyCount(s)).toBe(0);
    exact(s);
  });

  it("blanked Magneto cannot heal after a real Sentinel kill", () => {
    let s = base();
    const m = magneto(s);
    m.damage = 2;
    s.flags[`novaIronheartPackBlank:${m.id}`] = s.round;
    const p = minion(s, "32105");
    p.damage = 2;
    s = command(s, { type: "ABILITY", id: m.id, action: "attack" });
    s = settle(attackTarget(s, p.id));
    expect(magneto(s).damage).toBe(3);
  });
});
