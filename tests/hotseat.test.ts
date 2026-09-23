import { describe, expect, it } from "vitest";
import {
  newGame,
  dispatch,
  makePiece,
  schemeLimit,
  targets,
  playable,
  paymentSources,
} from "../src/game/engine";
import {
  activateSeat,
  seatView,
  syncSeat,
  upgradeSave,
} from "../src/game/team";
import { card, HEROES, maxHP } from "../src/game/cards";
import type { Command, Effect, GameState, Piece } from "../src/game/types";
const heroes = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "leadership" as const },
  { heroId: "black_panther", aspect: "protection" as const },
];
function send(s: GameState, c: Command) {
  const n = dispatch(s, c);
  expect(n.error).toBeUndefined();
  return n;
}
function proceed(s: GameState) {
  for (let i = 0; s.review && i < 100; i++) s = send(s, { type: "PROCEED" });
  return s;
}
function settle(s: GameState) {
  for (let n = 0; (s.prompt || s.review) && n < 500; n++) {
    if (s.review) {
      s = send(s, { type: "PROCEED" });
      continue;
    }
    const p = s.prompt!;
    if (p.kind === "choice") {
      const opt =
        p.options.find((o) =>
          [
            "allow",
            "take",
            "resolve",
            "skip",
            "pass",
            "threat",
            "exhaust",
          ].includes(o.id),
        ) || p.options[0];
      s = send(s, { type: "CHOOSE", id: opt.id });
    } else if (p.kind === "select")
      s = send(s, {
        type: "SELECT",
        ids: p.options.slice(0, p.min || 0).map((o) => o.id),
      });
    else if (p.cancelable) s = send(s, { type: "CANCEL" });
    else {
      let total = 0;
      const ids: string[] = [];
      for (const src of paymentSources(s, p.card?.id, p.paymentTarget)) {
        if (total >= (p.cost || 0)) break;
        ids.push(src.id);
        total += src.resources.length;
      }
      s = send(s, { type: "PAY", ids });
    }
  }
  expect(s.review).toBeNull();
  expect(s.prompt).toBeNull();
  return s;
}
function team(size = 3, guided = false, villainId = "rhino") {
  let s = newGame({
    ...heroes[0],
    heroes: heroes.slice(0, size),
    villainId,
    seed: 56,
    guided,
  });
  for (let i = 0; i < size; i++)
    s = settle(send(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function fixture(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Test trigger",
    text: "",
    options: [{ id: "run", label: "Run", effects: [] }],
  };
  return send(s, { type: "CHOOSE", id: "run" });
}
function quietEncounters(s: GameState) {
  s.encounter.deck = Array.from({ length: 60 }, () => makePiece(s, "01098"));
  s.encounter.discard = [];
}
function owned(s: GameState, id: string) {
  const pieces = [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [...p.hand, ...p.deck, ...p.discard, ...p.inPlay];
    }),
    ...s.minions.flatMap((p) => (p.droneCard ? [p.droneCard] : [])),
    ...s.sideSchemes.flatMap((p) => p.captured || []),
    ...s.removed,
  ];
  return pieces.filter((p) => p.ownerId === id && p.code !== "drone");
}
describe("guided action checkpoints", () => {
  it("pauses basic attack cost and damage separately and rejects out-of-order actions", () => {
    let s = team(1, true);
    s = proceed(send(s, { type: "FLIP" }));
    s = send(s, { type: "BASIC", action: "attack" });
    expect(s.review).not.toBeNull();
    expect(s.player.exhausted).toBe(true);
    expect(s.villain.hp).toBe(14);
    expect(dispatch(s, { type: "END_TURN" }).error).toMatch(/Proceed/);
    s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
    expect(s.villain.hp).toBe(12);
    expect(
      s.review?.changes.some((c) => c.before === 14 && c.after === 12),
    ).toBe(true);
    const hp = s.villain.hp;
    s = proceed(s);
    expect(s.villain.hp).toBe(hp);
  });
  it("a saved villain phase pauses on boosts before dealing damage", () => {
    let s = team(2, true);
    s.players.forEach((p) => (p.player.form = "hero"));
    quietEncounters(s);
    s = proceed(send(s, { type: "END_TURN" }));
    s = send(s, { type: "END_TURN" });
    for (let i = 0; i < 80 && !s.prompt?.title.includes("attacks"); i++) {
      if (s.review) s = send(s, { type: "PROCEED" });
      else if (s.prompt?.kind === "select")
        s = send(s, {
          type: "SELECT",
          ids: s.prompt.options.slice(0, s.prompt.min || 0).map((p) => p.id),
        });
    }
    s = proceed(s);
    expect(s.prompt?.title).toMatch(/attacks/);
    const before = s.player.hp;
    s = send(s, { type: "CHOOSE", id: "take" });
    for (let i = 0; i < 20 && s.review?.title !== "Reveal attack boosts"; i++)
      s = send(s, { type: "PROCEED" });
    expect(s.review?.title).toBe("Reveal attack boosts");
    expect(s.player.hp).toBe(before);
    s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
    expect(s.player.hp).toBeLessThan(before);
    expect(s.review?.title).toBe("Resolve the attack");
  });
  it("migrates previous solo saves without losing cards", () => {
    const old: any = team(1);
    delete old.players;
    delete old.playerCount;
    delete old.review;
    delete old.activePlayerId;
    const s = upgradeSave(JSON.parse(JSON.stringify(old)));
    expect(s.players).toHaveLength(1);
    expect(s.guided).toBe(true);
    expect(owned(s, "p1")).toHaveLength(40);
  });
});
describe("hot-seat turn structure", () => {
  for (const n of [1, 2, 3])
    it(`creates ${n} independent decks and scales the scenario`, () => {
      const s = team(n);
      expect(s.players).toHaveLength(n);
      expect(s.villain.hp).toBe(14 * n);
      expect(schemeLimit(s)).toBe(7 * n);
      for (const seat of s.players) {
        const a = owned(s, seat.id);
        expect(a).toHaveLength(40);
        expect(new Set(a.map((p) => p.id)).size).toBe(40);
        expect(seat.player.hand.length).toBeGreaterThan(0);
      }
      expect(
        new Set(
          s.encounter.deck
            .filter((p) => card(p).type_code === "obligation")
            .map((p) => card(p).set_code),
        ).size,
      ).toBe(n);
    });
  it("rejects repeated identities and more than three seats", () => {
    expect(() =>
      newGame({
        ...heroes[0],
        villainId: "rhino",
        heroes: [heroes[0], heroes[0]],
      }),
    ).toThrow(/once/);
    expect(() =>
      newGame({
        ...heroes[0],
        villainId: "rhino",
        heroes: [...heroes, { heroId: "iron_man", aspect: "aggression" }],
      }),
    ).toThrow(/three/);
  });
  it("does not ready/refill earlier heroes until all turns end, then rotates first player", () => {
    let s = team();
    quietEncounters(s);
    s.players.forEach((p) => (p.player.form = "hero"));
    s.player.exhausted = true;
    s.player.discard.push(s.player.hand.pop()!);
    const n = s.player.hand.length;
    s = send(s, { type: "END_TURN" });
    expect(s.activePlayerId).toBe("p2");
    expect(s.players[0].player.exhausted).toBe(true);
    expect(s.players[0].player.hand).toHaveLength(n);
    s = send(s, { type: "END_TURN" });
    expect(s.activePlayerId).toBe("p3");
    expect(s.round).toBe(1);
    s = settle(send(s, { type: "END_TURN" }));
    expect(s.round).toBe(2);
    expect(s.firstPlayerId).toBe("p2");
    expect(s.turnPlayerId).toBe("p2");
    expect(s.activePlayerId).toBe("p2");
    expect(s.scheme.threat).toBe(3);
    expect(s.players[0].player.hand).toHaveLength(6); // refill to 5, then Spider-Sense draws 1
    expect(s.players.map((p) => p.player.hp)).toEqual([8, 10, 9]);
  });
  it("deals hazard cards across the team, not once per hero", () => {
    let s = team();
    const p = makePiece(s, "01107");
    p.counters = 5;
    s.sideSchemes.push(p);
    s.guided = true;
    s = proceed(fixture(s, { type: "dealEncounters" }));
    // proceed stops on the first encounter's decision, so test the dealt checkpoint directly.
    let t = team();
    t.sideSchemes.push(makePiece(t, "01107"));
    t.guided = true;
    t = send(fixture(t, { type: "dealEncounters" }), { type: "PROCEED" });
    expect(t.review?.title).toBe("Deal encounter cards");
    expect(t.encounter.dealt.map((p) => p.dealtTo)).toEqual([
      "p1",
      "p2",
      "p3",
      "p1",
    ]);
  });
  it("a teammate can defend, with damage and exhaustion assigned to that teammate", () => {
    let s = team(2);
    s.players.forEach((p) => (p.player.form = "hero"));
    quietEncounters(s);
    s = fixture(s, { type: "enemyAttack", id: "villain", actorId: "p1" });
    expect(s.prompt?.options.some((p) => p.id === "hero:p2")).toBe(true);
    const hp = s.players.map((p) => p.player.hp);
    s = settle(send(s, { type: "CHOOSE", id: "hero:p2" }));
    expect(s.players[0].player.hp).toBe(hp[0]);
    expect(s.players[1].player.hp).toBe(hp[1] - 1);
    expect(s.players[1].player.exhausted).toBe(true);
    expect(s.activePlayerId).toBe("p1");
  });
  it("only an engaged guard blocks the acting hero; all minions remain attackable", () => {
    const s = team(2);
    const m = makePiece(s, "01101");
    m.engagedWith = "p2";
    s.minions.push(m);
    expect(targets(s, "enemy", true).some((t) => t.id === "villain")).toBe(
      true,
    );
    expect(
      targets(seatView(s, "p2"), "enemy", true).some((t) => t.id === "villain"),
    ).toBe(false);
  });
  it("an eliminated hero passes minions and first-player token without reducing scaling", () => {
    let s = team();
    const m = makePiece(s, "01101");
    m.engagedWith = "p1";
    s.minions.push(m);
    s = settle(fixture(s, { type: "damage", target: "hero", amount: 99 }));
    expect(s.phase).toBe("player");
    expect(s.players[0].eliminated).toBe(true);
    expect(s.firstPlayerId).toBe("p2");
    expect(s.activePlayerId).toBe("p2");
    expect(s.minions[0].engagedWith).toBe("p2");
    expect(schemeLimit(s)).toBe(21);
    expect(s.villain.maxHp).toBe(42);
    expect(owned(s, "p1")).toHaveLength(40);
  });
  it("only engaged minions activate for a hero", () => {
    let s = team(2);
    s.players.forEach((p) => (p.player.form = "hero"));
    const m = makePiece(s, "01101");
    m.engagedWith = "p2";
    s.minions.push(m);
    const hp = s.players.map((p) => p.player.hp);
    s = settle(fixture(s, { type: "minionActivations", actorId: "p1" }));
    expect(s.players.map((p) => p.player.hp)).toEqual(hp);
    s = settle(fixture(s, { type: "minionActivations", actorId: "p2" }));
    expect(s.players[1].player.hp).toBe(hp[1] - 1);
  });
});
describe("core cards across hero seats", () => {
  it("Maria Hill draws for every player", () => {
    let s = team();
    const n = s.players.map((p) => p.player.hand.length);
    const maria = makePiece(s, "01067");
    s.player.inPlay.push(maria);
    s = settle(fixture(s, { type: "allyEnter", id: maria.id }));
    expect(s.players.map((p) => p.player.hand.length)).toEqual(
      n.map((x) => x + 1),
    );
  });
  it("Commander can draw for another hero and retains its once-per-round limit", () => {
    let s = team(2);
    s = send(s, { type: "END_TURN" });
    const count = s.players[0].player.hand.length;
    s = send(s, { type: "ABILITY", id: "identity" });
    expect(s.prompt?.title).toBe("Commander");
    s = settle(send(s, { type: "CHOOSE", id: "p1" }));
    expect(s.players[0].player.hand.length).toBe(count + 1);
    expect(s.activePlayerId).toBe("p2");
    expect(s.flags.commander).toBe(true);
  });
  it("unique allies are enforced across the team", () => {
    const s = team(2);
    const p = makePiece(s, "01084");
    s.players[1].player.inPlay.push(p);
    const x = makePiece(s, "01084");
    expect(playable(s, x)).toMatch(/unique/);
  });
  it("Make the Call returns an ally from another player's discard and preserves its owner", () => {
    let s = team(2);
    activateSeat(s, "p2");
    const p = makePiece(s, "01084");
    s.player.discard.push(p);
    activateSeat(s, "p1");
    s = settle(fixture(s, { type: "returnAlly", id: p.id }));
    expect(s.player.inPlay.some((a) => a.id === p.id)).toBe(true);
    s = settle(fixture(s, { type: "discardPiece", id: p.id }));
    expect(s.players[1].player.discard.some((a) => a.id === p.id)).toBe(true);
  });
  it("obligations are resolved by their identity, not the hero who drew them", () => {
    let s = team(2);
    s = fixture(s, {
      type: "reveal",
      piece: makePiece(s, "01175"),
      actorId: "p1",
    });
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("Family Emergency");
    s = settle(s);
    expect(s.players[1].player.exhausted).toBe(true);
    expect(s.activePlayerId).toBe("p1");
  });
  it("Ultron setup and Android Efficiency put a drone in each hero's area", () => {
    let s = team(3, false, "ultron");
    expect(s.minions.map((p) => p.engagedWith)).toEqual(["p1", "p2", "p3"]);
    s = settle(fixture(s, { type: "reveal", piece: makePiece(s, "01144a") }));
    for (const p of s.players) {
      expect(s.minions.filter((m) => m.engagedWith === p.id)).toHaveLength(2);
      expect(owned(s, p.id)).toHaveLength(40);
    }
  });
  it("Highway Robbery returns cards to their owners", () => {
    let s = team();
    const counts = s.players.map((p) => p.player.hand.length);
    const robbery = makePiece(s, "01166");
    s = settle(fixture(s, { type: "reveal", piece: robbery }));
    expect(
      s.sideSchemes.find((p) => p.id === robbery.id)?.captured,
    ).toHaveLength(3);
    expect(s.players.map((p) => p.player.hand.length)).toEqual(
      counts.map((n) => n - 1),
    );
    s = settle(fixture(s, { type: "thwart", target: robbery.id, amount: 99 }));
    expect(s.players.map((p) => p.player.hand.length)).toEqual(counts);
  });
  it("per-player side scheme threat and villain stages retain the original team count", () => {
    let s = team();
    s = settle(fixture(s, { type: "reveal", piece: makePiece(s, "01107") }));
    expect(s.sideSchemes[0].counters).toBe(5);
    s = settle(fixture(s, { type: "damage", target: "villain", amount: 42 }));
    expect(s.villain.hp).toBe(45);
  });
  it("Rhino III and Shocker affect heroes but not alter egos", () => {
    let s = team();
    s.players[0].player.form = "hero";
    s.players[2].player.form = "hero";
    const n = s.players.map((p) => p.player.hp);
    s = settle(fixture(s, { type: "reveal", piece: makePiece(s, "01103") }));
    expect(s.players.map((p) => p.player.hp)).toEqual([
      n[0] - 1,
      n[1],
      n[2] - 1,
    ]);
  });
  for (const villainId of ["rhino", "klaw", "ultron"])
    for (const size of [2, 3])
      it(`${size} heroes can finish a ${villainId} mission without losing card ownership`, () => {
        let s = team(size, true, villainId);
        for (let n = 0; n < 100 && !["won", "lost"].includes(s.phase); n++) {
          if (s.player.form === "alter") s = settle(send(s, { type: "FLIP" }));
          if (s.phase !== "player") break;
          if (!s.player.exhausted)
            s = settle(send(s, { type: "BASIC", action: "attack" }));
          if (s.phase === "player") s = settle(send(s, { type: "END_TURN" }));
          s = upgradeSave(JSON.parse(JSON.stringify(s)));
          for (const seat of s.players) {
            const pieces = owned(s, seat.id);
            expect(pieces).toHaveLength(40);
            expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
          }
        }
        expect(["won", "lost"]).toContain(s.phase);
      });
});

describe("team action and interrupt windows", () => {
  it("allows a teammate's Action without handing over the turn", () => {
    let s = team(2, true);
    const n = s.player.hand.length;
    s = proceed(send(s, { type: "ABILITY", id: "identity", playerId: "p2" }));
    expect(s.activePlayerId).toBe("p2");
    expect(s.turnPlayerId).toBe("p1");
    s = settle(send(s, { type: "CHOOSE", id: "p1" }));
    expect(s.player.hand).toHaveLength(n + 1);
    expect(s.activePlayerId).toBe("p1");
    expect(s.players[1].flags.commander).toBe(true);
    expect(s.players[1].ended).toBe(false);
  });
  it("rejects off-turn ally basic powers and permanent card plays", () => {
    const s = team(2);
    activateSeat(s, "p2");
    const ally = makePiece(s, "01067");
    s.player.inPlay.push(ally);
    const upgrade = makePiece(s, "01057");
    s.player.hand.push(upgrade);
    activateSeat(s, "p1");
    const before = JSON.stringify(s);
    expect(
      dispatch(s, {
        type: "ABILITY",
        id: ally.id,
        action: "attack",
        playerId: "p2",
      }).error,
    ).toMatch(/own turn/);
    expect(
      dispatch(s, { type: "PLAY", id: upgrade.id, playerId: "p2" }).error,
    ).toMatch(/Only Action/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("allows Emergency from another hero without redirecting scheme effects", () => {
    let s = team(2);
    quietEncounters(s);
    activateSeat(s, "p2");
    const emergency = makePiece(s, "01085");
    s.player.hand = [emergency];
    activateSeat(s, "p1");
    s.player.hand = [];
    s = fixture(s, { type: "enemyScheme", id: "villain" });
    expect(s.prompt?.options.some((o) => o.id === "reduce:p2")).toBe(true);
    s = settle(send(s, { type: "CHOOSE", id: "reduce:p2" }));
    expect(s.scheme.threat).toBe(0);
    expect(s.players[1].player.discard.some((p) => p.id === emergency.id)).toBe(
      true,
    );
    expect(s.activePlayerId).toBe("p1");
  });
  it("Get Behind Me uses its controller's payment and redirects the attack to that hero", () => {
    let s = team(2);
    quietEncounters(s);
    activateSeat(s, "p2");
    s.player.form = "hero";
    const block = makePiece(s, "01078"),
      resource = makePiece(s, "01044");
    s.player.hand = [block, resource];
    activateSeat(s, "p1");
    s = fixture(s, { type: "reveal", piece: makePiece(s, "01186") });
    s = send(s, { type: "CHOOSE", id: "01078:p2" });
    expect(s.activePlayerId).toBe("p2");
    s = settle(send(s, { type: "PAY", ids: [resource.id] }));
    expect(s.players[0].player.hp).toBe(10);
    expect(s.players[1].player.hp).toBe(10);
    expect(s.scheme.threat).toBe(0);
  });
  it("Black Widow can interrupt a teammate's encounter and reveals the replacement for her controller", () => {
    let s = team(2);
    activateSeat(s, "p2");
    const widow = makePiece(s, "01075"),
      resource = makePiece(s, "01044");
    s.player.inPlay.push(widow);
    s.player.hand = [resource];
    activateSeat(s, "p1");
    s.encounter.deck.unshift(makePiece(s, "01101"));
    s = fixture(s, { type: "reveal", piece: makePiece(s, "01186") });
    s = send(s, { type: "CHOOSE", id: "widow:p2" });
    s = settle(send(s, { type: "PAY", ids: [resource.id], wildAs: "mental" }));
    expect(s.minions.find((p) => p.code === "01101")?.engagedWith).toBe("p2");
    expect(
      s.players[1].player.inPlay.find((p) => p.id === widow.id)?.exhausted,
    ).toBe(true);
    expect(s.activePlayerId).toBe("p1");
    expect(s.scheme.threat).toBe(0);
  });
  it("shared healing changes the selected hero only", () => {
    let s = team(2);
    s.players[0].player.hp = 4;
    s.players[1].player.hp = 5;
    s = settle(fixture(s, { type: "heal", target: "hero:p2", amount: 2 }));
    expect(s.players.map((p) => p.player.hp)).toEqual([4, 7]);
    expect(s.activePlayerId).toBe("p1");
  });
  it("an upgrade on another player's ally follows that ally's controller but retains ownership", () => {
    let s = team(2);
    const inspired = makePiece(s, "01074");
    s.player.inPlay.push(inspired);
    activateSeat(s, "p2");
    const ally = makePiece(s, "01067");
    s.player.inPlay.push(ally);
    activateSeat(s, "p1");
    s = settle(
      fixture(s, { type: "attachPlayer", id: inspired.id, target: ally.id }),
    );
    expect(
      s.players[1].player.inPlay.find((p) => p.id === inspired.id)?.ownerId,
    ).toBe("p1");
    s = settle(fixture(s, { type: "discardPiece", id: ally.id }));
    expect(s.players[0].player.discard.some((p) => p.id === inspired.id)).toBe(
      true,
    );
  });
});
