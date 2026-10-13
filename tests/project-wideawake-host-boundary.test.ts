/** Native boundaries use original physical cards and hydrate every command.
 * A zone census deliberately does not deduplicate IDs or count effect payloads
 * as extra physical cards. No fixture creates replacement card instances. */
import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { dispatch, newGame } from "../src/game/engine.js";
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

type Fixture = GameState & { wideawakeBoundaryIds?: string[] };
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
    ...(s.projectWideawake?.setAsideCaptives || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const ids = physical(s)
    .map((p) => p.id)
    .sort();
  expect(new Set(ids).size, "one actual physical zone per ID").toBe(ids.length);
  const originals = (s as Fixture).wideawakeBoundaryIds;
  if (originals) expect(ids).toEqual([...originals].sort());
  return s;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      s.prompt.options.find((o) => o.id === "allow")?.id ||
      (/forced|order/i.test(s.prompt.title) || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function opening(team = false, allocation = team ? [0, 0] : [0]) {
  const first = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...first,
    villainId: "project_wideawake",
    module: "sentinels",
    seed: 321040,
    pacing: "expert",
    captureAllocation: allocation,
    ...(team
      ? {
          heroes: [
            first,
            { heroId: "colossus", aspect: "protection" as const },
          ],
        }
      : {}),
  });
}
function operation(s: GameState) {
  const p = s.sideSchemes.find((p) => p.code === "32104");
  expect(
    p,
    "actual Operation Zero Tolerance entered during setup",
  ).toBeTruthy();
  return p!;
}
function base(team = false) {
  let s = opening(team);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s, (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.flipped = p.exhausted = p.tough = p.stunned = p.confused = false;
    p.toughCards = p.stunCards = p.confuseCards = 0;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.scheme.threat = 0;
  (s as Fixture).wideawakeBoundaryIds = physical(s).map((p) => p.id);
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
  throw Error(
    `Missing original physical source ${playerId || "encounter"}:${code}`,
  );
}
function ally(s: GameState, code = "01083", playerId = "p1") {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = "32102", playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function boost(s: GameState, code = "32098") {
  const p = take(s, code);
  s.encounter.deck.unshift(p);
  return p;
}
function attack(s: GameState, id = s.villain.id, playerId = "p1") {
  return native(s, {
    type: "enemyAttack",
    id,
    actorId: playerId,
    activation: { enemyId: id, playerId, kind: "attack" },
  });
}
function defend(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function rescue(s: GameState, playerId = "p1") {
  const p = s.sideSchemes.find((p) => p.code === "32100")!;
  expect(p, "actual villain-setup Abduction Protocols").toBeTruthy();
  return settle(
    native(s, {
      type: "thwart",
      target: p.id,
      amount: p.counters,
      source: `hero:${playerId}`,
      actorId: playerId,
    }),
  );
}
function jubilee(s: GameState) {
  const mall = s.sideSchemes.find((p) => p.code === "32088a")!;
  expect(mall, "actual double-sided Mall source").toBeTruthy();
  s = settle(
    native(s, {
      type: "thwart",
      target: mall.id,
      amount: mall.counters,
      source: "hero",
      actorId: "p1",
    }),
    (v) =>
      v.prompt?.title === "Search encounter cards"
        ? v.prompt.options.find((o) => o.image === "32093")?.id
        : undefined,
  );
  const p = seatView(s, "p1").player.inPlay.find((p) => p.id === mall.id)!;
  expect(p?.code).toBe("32088b");
  return { s, id: mall.id };
}
function captive(s: GameState) {
  return s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => ["32089", "32090", "32091", "32092"].includes(p.code))!;
}

describe("Project Wideawake original-source host boundaries", () => {
  it.each([
    [1, 0],
    [0, 2],
    [1, 1],
  ])(
    "allocates setup captures %j before each seat's opening hand, preserving both original40 decks",
    (p1, p2) => {
      const s = opening(true, [p1, p2]);
      expect(s.phase).toBe("mulligan");
      expect(s.error).toBeUndefined();
      expect(operation(s).captured).toHaveLength(p1 + p2);
      for (const [index, seat] of s.players.entries()) {
        const p = seatView(s, seat).player;
        const captures = operation(s).captured!.filter(
          (c) => c.ownerId === seat.id,
        );
        expect(captures).toHaveLength([p1, p2][index]);
        expect(p.hand).toHaveLength(6);
        expect(p.deck).toHaveLength(34 - captures.length);
        expect([...p.deck, ...p.hand, ...captures]).toHaveLength(40);
        expect(captures.every((c) => !p.hand.some((h) => h.id === c.id))).toBe(
          true,
        );
      }
      expect(s.projectWideawake?.setAsideCaptives).toHaveLength(4);
      expect(s.sideSchemes.some((p) => p.code === "32088a")).toBe(true);
      exact(reload(s));
    },
  );

  it.each([false, true])(
    "a large single placement captures once and removes exactly5N (team=%s)",
    (team) => {
      let s = base(team);
      const n = s.playerCount,
        topId = s.player.deck[0].id;
      s = settle(native(s, { type: "threat", target: "main", amount: 15 * n }));
      expect(operation(s).captured?.map((p) => p.id)).toEqual([topId]);
      expect(s.scheme.threat).toBe(10 * n);
      s = settle(
        native(reload(s), { type: "threat", target: "main", amount: 1 }),
      );
      expect(operation(s).captured).toHaveLength(2);
      expect(s.scheme.threat).toBe(5 * n + 1);
      exact(s);
    },
  );

  it("captures the first player's source even when p2 places threshold threat", () => {
    let s = base(true);
    const first = seatView(s, "p1").player.deck[0],
      other = seatView(s, "p2").player.deck[0];
    s = settle(
      native(s, { type: "threat", target: "main", amount: 10, actorId: "p2" }),
    );
    expect(operation(s).captured?.map((p) => p.id)).toEqual([first.id]);
    expect(operation(s).captured?.[0].ownerId).toBe("p1");
    expect(seatView(s, "p2").player.deck[0].id).toBe(other.id);
    exact(s);
  });

  it("true empty deck AND discard cannot pay capture and cannot remove threshold threat", () => {
    let s = base();
    s.player.hand.push(...s.player.deck.splice(0));
    expect(s.player.discard).toHaveLength(0);
    s = settle(native(s, { type: "threat", target: "main", amount: 15 }));
    expect(operation(s).captured || []).toHaveLength(0);
    expect(s.scheme.threat).toBe(15);
    expect(s.player.hand).toHaveLength(40);
    exact(s);
  });

  it("an empty deck with one real discarded card recycles, captures that card, and deals one real encounter", () => {
    let s = base();
    s.player.hand.push(...s.player.deck.splice(0));
    const p = take(s, "01088", "p1");
    s.player.discard.push(p);
    const before = s.encounter.dealt.length;
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    expect(operation(s).captured?.map((c) => c.id)).toEqual([p.id]);
    expect(s.scheme.threat).toBe(0);
    expect(s.encounter.dealt).toHaveLength(before + 1);
    expect(s.encounter.dealt.at(-1)?.dealtTo).toBe("p1");
    exact(s);
  });

  it("thwarting permanent Operation tozero does not defeat it or emit a defeat destination", () => {
    let s = base();
    const id = operation(s).id;
    s = settle(
      native(s, { type: "thwart", target: id, amount: 20, source: "hero" }),
    );
    expect(operation(s).id).toBe(id);
    expect(operation(s).counters).toBe(0);
    expect(s.encounter.discard.some((p) => p.id === id)).toBe(false);
    s = settle(native(s, { type: "defeatScheme", id }));
    expect(operation(s).id).toBe(id);
    exact(s);
  });

  it("native discard cannot move externally permanent Operation fromplay after hydration", () => {
    const s = base(),
      id = operation(s).id;
    s.prompt = {
      kind: "choice",
      title: "Native boundary",
      text: "",
      options: [
        { id: "go", label: "Go", effects: [{ type: "discardPiece", id }] },
      ],
    };
    const result = dispatch(reload(s), { type: "CHOOSE", id: "go" });
    expect(result.error).toMatch(/permanent/i);
    expect(operation(result).id).toBe(id);
    exact(result);
  });

  it("an actual enemy attack captures the same defeated ally with its owner distinct from its defender-controller", () => {
    let s = base(true);
    const p = take(s, "32011", "p2");
    p.damage = 1;
    s.player.inPlay.push(p);
    expect(p.ownerId).toBe("p2");
    expect(controller(s, p.id)?.id).toBe("p1");
    boost(s);
    s = settle(defend(attack(s), p.id));
    const captured = operation(s).captured?.find((c) => c.id === p.id);
    expect(captured?.code).toBe("32011");
    expect(captured?.ownerId).toBe("p2");
    expect(seatView(s, "p2").player.discard.some((c) => c.id === p.id)).toBe(
      false,
    );
    exact(s);
  });

  it("actual consequential ally defeat has an ordinary discard destination and no OZT capture", () => {
    let s = base();
    const p = ally(s),
      id = p.id;
    p.damage = card(p).health! - 1;
    s = settle(
      native(s, {
        type: "allyAction",
        id,
        kind: "attack",
        target: s.villain.id,
      }),
    );
    expect(s.player.discard.some((c) => c.id === id)).toBe(true);
    expect(operation(s).captured || []).toHaveLength(0);
    exact(s);
  });

  it("independent damage inside a live enemy attack cannot become that attack's ally-defeat receipt", () => {
    let s = base();
    const p = ally(s),
      id = p.id;
    boost(s);
    s = until(attack(s), (v) => !!v.prompt?.options.some((o) => o.id === id));
    const continuation =
      s.prompt!.options.find((o) => o.id === "none") ||
      s.prompt!.options.find((o) => o.id === "hero")!;
    expect(continuation).toBeTruthy();
    s.prompt!.options.push({
      id: "independent-packet",
      label: "Resolve independent damage before defense",
      effects: [
        {
          type: "damage",
          target: id,
          amount: card(p).health!,
          source: s.attack!.attacker,
        },
        ...continuation.effects,
      ],
    });
    s = settle(choose(s, "independent-packet"));
    expect(s.player.discard.some((c) => c.id === id)).toBe(true);
    expect(operation(s).captured || []).toHaveLength(0);
    exact(s);
  });

  it("Jubilee enters Victory BEFORE completed-attack OZT capture, then the exact double-sided piece moves beneath OZT", () => {
    const result = jubilee(base());
    let s = result.s;
    const id = result.id,
      p = s.player.inPlay.find((p) => p.id === id)!;
    p.damage = 2;
    const attacker = minion(s);
    const barrier = take(s, "32103");
    barrier.attachedTo = attacker.id;
    s.attachments.push(barrier);
    s = defend(attack(s, attacker.id), id);
    s = until(s, (v) => !!v.victoryDisplay?.some((p) => p.id === id));
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.victoryDisplay?.find((p) => p.id === id)?.code).toBe("32088b");
    expect(operation(s).captured || []).toHaveLength(0);
    exact(reload(s));
    s = settle(s);
    expect(s.victoryDisplay?.some((p) => p.id === id)).toBe(false);
    expect(operation(s).captured?.filter((p) => p.id === id)).toHaveLength(1);
    expect(operation(s).captured?.find((p) => p.id === id)?.code).toBe(
      "32088b",
    );
    exact(s);
  });

  it("nondefeat native RETURN sends double-sided Jubilee to removed rather than any hand/discard", () => {
    const result = jubilee(base());
    let s = result.s;
    s = settle(native(s, { type: "ms:red-return", id: result.id }));
    expect(s.removed.find((p) => p.id === result.id)?.code).toBe("32088b");
    expect(s.victoryDisplay?.some((p) => p.id === result.id)).toBeFalsy();
    expect(operation(s).captured || []).toHaveLength(0);
    exact(s);
  });

  it("a saved nondefeat deck-destination leave also removes the actual double-sided Jubilee", () => {
    const result = jubilee(base());
    let s = result.s;
    const token = "native-destination-control";
    s.flags[`niLeaveShuffle:${result.id}`] = "p1";
    s = settle(
      native(reload(s), {
        type: "niNativeLeaveCommit",
        receipt: {
          token,
          pieceId: result.id,
          code: "32088b",
          ownerId: "p1",
          playerCard: false,
          fromPlay: true,
          toDiscard: true,
        },
        replaced: true,
      }),
    );
    expect(s.removed.find((p) => p.id === result.id)?.code).toBe("32088b");
    expect(s.player.deck.some((p) => p.id === result.id)).toBe(false);
    expect(s.victoryDisplay?.some((p) => p.id === result.id)).toBeFalsy();
    exact(s);
  });

  it("a real rescue assigns the same original Captive to the defeating player and its later discard joins that player's deck", () => {
    let s = base(true);
    const originals = s.projectWideawake!.setAsideCaptives.map((p) => p.id);
    s = rescue(s, "p2");
    const p = captive(s),
      id = p.id;
    expect(originals).toContain(id);
    expect(p.ownerId).toBe("p2");
    expect(controller(s, id)?.id).toBe("p2");
    expect(s.projectWideawake?.setAsideCaptives).toHaveLength(3);
    s = settle(native(reload(s), { type: "discardPiece", id }));
    expect(
      seatView(s, "p2").player.discard.find((p) => p.id === id)?.ownerId,
    ).toBe("p2");
    expect(s.encounter.discard.some((p) => p.id === id)).toBe(false);
    exact(s);
  });

  it("rescue's real ally-limit decision includes the newly owned Captive and discards one physical original", () => {
    let s = base(true);
    const allies = ["32011", "32012", "32019"].map((code) =>
      ally(s, code, "p2"),
    );
    const abduction = s.sideSchemes.find((p) => p.code === "32100")!;
    s = native(s, {
      type: "thwart",
      target: abduction.id,
      amount: abduction.counters,
      source: "hero:p2",
      actorId: "p2",
    });
    if (s.prompt?.title === "Forced responses")
      s = choose(
        s,
        s.prompt.options.find((o) => o.label === "Abduction Protocols")!.id,
      );
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === allies[0].id));
    const newAlly = captive(s);
    expect(newAlly.ownerId).toBe("p2");
    expect(s.prompt?.options.some((o) => o.id === newAlly.id)).toBe(true);
    s = settle(choose(s, allies[0].id));
    expect(
      seatView(s, "p2").player.inPlay.filter(
        (p) => card(p).type_code === "ally",
      ),
    ).toHaveLength(3);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === allies[0].id),
    ).toBe(true);
    exact(s);
  });

  it("Jubilee follows an actual first-player change while retaining the same physical ownership", () => {
    const result = jubilee(base(true));
    let s = result.s;
    const owner = s.player.inPlay.find((p) => p.id === result.id)!.ownerId;
    s = settle(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p2");
    expect(controller(s, result.id)?.id).toBe("p2");
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === result.id)?.ownerId,
    ).toBe(owner);
    exact(s);
  });

  it("Warn captures after p1's real turn before p2's turn and before whole-team refill", () => {
    let s = base(true);
    const warn = take(s, "32099");
    s = settle(native(s, { type: "reveal", piece: warn, actorId: "p1" }));
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === warn.id)).toBe(
      true,
    );
    const topId = seatView(s, "p1").player.deck[0].id;
    s = command(reload(s), { type: "END_TURN" });
    s = settle(s);
    expect(s.phase).toBe("player");
    expect(s.turnPlayerId).toBe("p2");
    expect(operation(s).captured?.map((p) => p.id)).toEqual([warn.id]);
    expect(seatView(s, "p1").player.hand).toHaveLength(0);
    expect(seatView(s, "p1").player.deck[0].id).toBe(topId);
    exact(s);
  });

  it("p2's Warn does not respond to p1 turn end or to a round transition", () => {
    let s = base(true);
    const warn = take(s, "32099");
    s = settle(native(s, { type: "reveal", piece: warn, actorId: "p2" }));
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    s = settle(command(s, { type: "END_TURN" }));
    expect(operation(s).captured || []).toHaveLength(0);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === warn.id)).toBe(
      true,
    );
    s = settle(native(s, { type: "newRound" }));
    expect(operation(s).captured || []).toHaveLength(0);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === warn.id)).toBe(
      true,
    );
    exact(s);
  });

  it("Boom's real delayed attack response survives source departure through saved phase-end resolution", () => {
    let s = base();
    // Rescue chooses a real Captive via the native seeded random result. Move
    // the real Boom piece into play only if another original was rescued.
    s = rescue(s);
    let boom = captive(s);
    if (boom.code !== "32090") {
      const index = s.projectWideawake!.setAsideCaptives.findIndex(
        (p) => p.code === "32090",
      );
      expect(index).toBeGreaterThanOrEqual(0);
      boom = s.projectWideawake!.setAsideCaptives.splice(index, 1)[0];
      boom.ownerId = "p1";
      s.player.inPlay.push(boom);
    }
    const id = boom.id;
    expect(s.villain.tough).toBe(true);
    s = respond(
      native(s, {
        type: "allyAction",
        id,
        kind: "attack",
        target: s.villain.id,
      }),
      /Boom Boom/,
    );
    s = settle(s);
    expect(s.projectWideawake?.bombs).toEqual([
      { enemyId: s.villain.id, count: 1 },
    ]);
    expect(s.projectWideawake?.delayedBombs).toHaveLength(1);
    const afterAttack = s.villain.hp;
    expect(s.villain.tough).toBe(false);
    s = settle(native(s, { type: "discardPiece", id }));
    expect(s.projectWideawake?.bombs).toHaveLength(1);
    expect(s.projectWideawake?.delayedBombs).toHaveLength(1);
    s = command(reload(s), { type: "END_TURN" });
    for (let n = 0; s.prompt && s.phase === "player" && n < 50; n++) {
      if (s.prompt.kind === "select")
        s = command(s, { type: "SELECT", ids: [] });
      else s = choose(s, passId(s) || s.prompt.options[0].id);
    }
    expect(s.phase).toBe("villain");
    expect(s.villain.hp).toBe(afterAttack - 2);
    expect(s.projectWideawake?.bombs).toHaveLength(0);
    expect(s.projectWideawake?.delayedBombs).toHaveLength(0);
    exact(s);
  });

  it("enemy departure removes its physical bomb counters while retaining the already-created delayed receipt", () => {
    let s = base();
    const enemy = minion(s, "32105");
    const index = s.projectWideawake!.setAsideCaptives.findIndex(
      (p) => p.code === "32090",
    );
    const boom = s.projectWideawake!.setAsideCaptives.splice(index, 1)[0];
    boom.ownerId = "p1";
    s.player.inPlay.push(boom);
    s = settle(
      respond(
        native(s, {
          type: "allyAction",
          id: boom.id,
          kind: "attack",
          target: enemy.id,
        }),
        /Boom Boom/,
      ),
    );
    expect(s.projectWideawake?.bombs).toEqual([
      { enemyId: enemy.id, count: 1 },
    ]);
    expect(s.projectWideawake?.delayedBombs[0].sourceId).toBe(boom.id);
    s = settle(
      native(reload(s), {
        type: "damage",
        target: enemy.id,
        amount: 10,
        source: "hero",
      }),
    );
    expect(s.projectWideawake?.bombs).toHaveLength(0);
    expect(s.projectWideawake?.delayedBombs).toHaveLength(1);
    s = settle(
      native(reload(s), {
        type: "wideawake:bomb-window",
        receipts: s.projectWideawake!.delayedBombs,
        actorId: s.firstPlayerId,
      }),
    );
    expect(s.projectWideawake?.delayedBombs).toHaveLength(0);
    exact(s);
  });
});
