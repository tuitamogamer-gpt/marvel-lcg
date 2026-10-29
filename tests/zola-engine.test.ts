import { describe, expect, it } from "vitest";
import {
  card,
  CATALOG_CARDS,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import {
  newGame,
  schemeLimit,
  enemyStats,
  targets,
  dispatch,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "zola",
    difficulty,
    seed: 4109,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      ...(players >= 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
      ...(players >= 3
        ? [{ heroId: "iron_man", aspect: "leadership" as const }]
        : []),
    ],
  });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      s,
      prefer?.(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  return reload(s);
}
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    [s.villain],
    s.zola!.villainDeck,
    s.zola!.mainDeck,
    [s.zola!.currentMain],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay];
    }),
  ];
}
function nested(ps: Piece[]): Piece[] {
  return ps.flatMap((p) => [
    p,
    ...nested(p.captured || []),
    ...nested(p.storedCards || []),
  ]);
}
function exact(s: GameState) {
  const ps = nested(zones(s).flat()).filter((p) => card(p).set_code === "zola");
  expect(ps).toHaveLength(30);
  expect(new Set(ps.map((p) => p.id)).size).toBe(30);
}
function take(s: GameState, code: string) {
  for (const z of zones(s)) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  throw Error(`Missing original ${code}`);
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code) });
}
function put(s: GameState, code: string, playerId = "p1") {
  return native(s, {
    type: "mutagen:put-minion",
    piece: take(s, code),
    playerId,
  });
}
function zeroBoost(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost && !card(p).boost_star,
  );
  expect(i).toBeGreaterThanOrEqual(0);
  s.encounter.deck.unshift(s.encounter.deck.splice(i, 1)[0]);
}
function attack(s: GameState) {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: "p1",
    activation: { enemyId: s.villain.id, playerId: "p1", kind: "attack" },
  });
}
function boost(s: GameState, code: string) {
  const p = take(s, code);
  s.encounter.deck.unshift(p);
  return p;
}
function withoutPlayerReactions(s: GameState) {
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.deck.push(...p.hand.splice(0));
  }
  return s;
}

describe("Zola original-source scenario", () => {
  it("registers every original face and preserves the 31-card retail source", () => {
    const original = CATALOG_CARDS.filter((c) => c.set_code === "zola");
    expect(original).toHaveLength(18);
    for (const p of original)
      expect(hasExecutableScript(p.code), p.code).toBe(true);
    expect(
      original.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0),
    ).toBe(31);
  });
  it.each([1, 2, 3])(
    "sets up original captured hero allies and Bio-Servants for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const prison = s.sideSchemes.find((p) => p.code === "04122")!;
        expect(prison.captured).toHaveLength(players);
        expect(prison.counters).toBe(
          1 + [2, 3, 4].slice(0, players).reduce((a, b) => a + b, 0),
        );
        expect(prison.captured!.map((p) => p.ownerId).sort()).toEqual(
          s.players.map((p) => p.id).sort(),
        );
        expect(s.minions.filter((p) => p.code === "04114")).toHaveLength(
          players,
        );
        expect(s.minions.map((p) => p.engagedWith).sort()).toEqual(
          s.players.map((p) => p.id).sort(),
        );
        expect(s.minions.every((p) => p.tough)).toBe(true);
        expect(s.sideSchemes.filter((p) => p.code === "04123")).toHaveLength(
          difficulty === "expert" ? 1 : 0,
        );
        expect(s.scheme.threat).toBe(0);
        expect(schemeLimit(s)).toBe(6 * players);
        expect(s.zola!.currentMain.counters).toBe(0);
        expect(s.villain.hp).toBe(
          (difficulty === "standard" ? 12 : 14) * players,
        );
        exact(reload(s));
      }
    },
  );
  it("keeps setup sources with every legal replacement modular set", () => {
    for (const m of scenarioModules("zola")) {
      const s = settle(
        newGame({
          heroId: "spider_man",
          aspect: "justice",
          villainId: "zola",
          module: m.id,
          seed: 7,
          pacing: "expert",
        }),
      );
      expect(s.modules).toEqual([m.id]);
      expect(s.sideSchemes.some((p) => p.code === "04122")).toBe(true);
      expect(s.minions.some((p) => p.code === "04114")).toBe(true);
      exact(s);
    }
  });
  it("returns each captive to its original owner when another player defeats Hydra Prison", () => {
    let s = started("standard", 3);
    const prison = s.sideSchemes.find((p) => p.code === "04122")!,
      allies = prison.captured!.map((p) => ({ id: p.id, owner: p.ownerId }));
    s = settle(
      native(s, {
        type: "thwart",
        target: prison.id,
        amount: prison.counters,
        actorId: "p2",
      }),
    );
    expect(s.removed.some((p) => p.id === prison.id)).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === prison.id)).toBe(false);
    for (const p of allies)
      expect(seatView(s, p.owner!).player.hand.some((q) => q.id === p.id)).toBe(
        true,
      );
    exact(reload(s));
  });
  it("advances original villain stages and reveals Test Subjects once", () => {
    let s = started();
    const id = s.villain.id;
    s = settle(native(s, { type: "damage", target: id, amount: 99 }));
    expect(s.villain.code).toBe("04110");
    expect(s.removed.some((p) => p.id === id)).toBe(true);
    expect(s.sideSchemes.filter((p) => p.code === "04123")).toHaveLength(1);
    exact(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("won");
    exact(s);
  });
  it("stage III reveals a chosen original minion for each player", () => {
    let s = withoutPlayerReactions(started("expert", 2));
    const before = s.minions.length;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.villain.code).toBe("04111");
    expect(s.minions).toHaveLength(before + 2);
    exact(s);
  });
  it("main scheme progression reveals minions and resets physical test counters", () => {
    let s = withoutPlayerReactions(started("standard", 2));
    const old = s.zola!.currentMain.id;
    s.zola!.currentMain.counters = 2;
    const before = s.minions.length;
    s = settle(native(s, { type: "threat", target: "main", amount: 12 }));
    expect(s.scheme.code).toBe("04113b");
    expect(s.zola!.currentMain.id).not.toBe(old);
    expect(s.zola!.currentMain.counters).toBe(0);
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    expect(s.scheme.threat).toBe(2);
    expect(schemeLimit(s)).toBe(16);
    expect(s.minions).toHaveLength(before + 2);
    exact(s);
    s = settle(native(s, { type: "threat", target: "main", amount: 14 }));
    expect(s.phase).toBe("lost");
    exact(s);
  });
  it.each([0, 1, 2, 5, 6])(
    "adds one test counter and spawns at most one minion for initial %i counters",
    (initial) => {
      let s = withoutPlayerReactions(started());
      s.zola!.currentMain.counters = initial;
      const minion = take(s, "04115");
      s.encounter.deck.unshift(minion);
      const before = s.minions.length;
      s = settle(native(s, { type: "villainStepOne" }));
      expect(s.scheme.threat).toBe(1);
      expect(s.zola!.currentMain.counters).toBe(
        initial + 1 - (initial >= 2 ? 3 : 0),
      );
      expect(s.minions).toHaveLength(before + (initial >= 2 ? 1 : 0));
      if (initial >= 2) {
        expect(s.minions.find((p) => p.id === minion.id)?.engagedWith).toBe(
          s.firstPlayerId,
        );
        expect(
          s.attachments.filter((p) => p.attachedTo === minion.id),
        ).toHaveLength(0);
      }
      exact(reload(s));
    },
  );
  it("minion search stops at encounter deck exhaustion instead of continuing after reshuffle", () => {
    let s = withoutPlayerReactions(started());
    const minions = s.encounter.deck.filter(
      (p) => card(p).type_code === "minion",
    );
    s.encounter.deck = s.encounter.deck.filter(
      (p) => card(p).type_code !== "minion",
    );
    s.encounter.discard.push(...minions);
    s.zola!.currentMain.counters = 2;
    const count = s.minions.length,
      acceleration = s.encounter.acceleration;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.minions).toHaveLength(count);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.zola!.currentMain.counters).toBe(0);
    exact(s);
  });
  it("Zola's Mutate searches and attaches Tech only when revealed", () => {
    let s = started();
    const tech = take(s, "04119");
    s.encounter.deck.unshift(tech);
    const p = take(s, "04115");
    s = settle(native(s, { type: "reveal", piece: p }));
    expect(s.attachments.find((q) => q.id === tech.id)?.attachedTo).toBe(p.id);
    expect(
      pieceHP(
        s,
        s.minions.find((q) => q.id === p.id)!,
      ),
    ).toBe(7);
    exact(s);
    const other = take(s, "04115"),
      nextTech = take(s, "04117");
    s.encounter.deck.unshift(nextTech);
    s = settle(
      native(s, { type: "mutagen:put-minion", piece: other, playerId: "p1" }),
    );
    expect(s.attachments.some((q) => q.attachedTo === other.id)).toBe(false);
    expect(s.encounter.deck[0].id).toBe(nextTech.id);
    exact(s);
  });
  it("the Mutate Tech search also stops at deck exhaustion", () => {
    let s = started();
    const mutate = take(s, "04115"),
      tech = s.encounter.deck.filter((p) => card(p).traits?.includes("Tech."));
    s.encounter.deck = s.encounter.deck.filter((p) => !tech.includes(p));
    s.encounter.discard.push(...tech);
    const acceleration = s.encounter.acceleration;
    s = settle(native(s, { type: "reveal", piece: mutate }));
    expect(
      s.attachments.filter((p) => p.attachedTo === mutate.id),
    ).toHaveLength(0);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    exact(s);
  });
  it.each(["04117", "04118", "04119"])(
    "%s attaches to greatest remaining HP and avoids an existing copy",
    (code) => {
      let s = settle(put(started(), "04115"));
      const high = s.minions.find((p) => p.code === "04115")!,
        low = s.minions.find((p) => p.code === "04114")!;
      s = settle(reveal(s, code));
      const first = s.attachments.find((p) => p.code === code)!;
      expect(first.attachedTo).toBe(high.id);
      expect(
        pieceHP(
          s,
          s.minions.find((p) => p.id === high.id)!,
        ),
      ).toBe(7);
      s = settle(reveal(s, code));
      expect(
        s.attachments
          .filter((p) => p.code === code)
          .map((p) => p.attachedTo)
          .sort(),
      ).toEqual([low.id, high.id].sort());
      exact(s);
    },
  );
  it("Tech uses remaining HP, not printed maximum, and permits a tied target choice", () => {
    let s = settle(put(started(), "04115"));
    const mutate = s.minions.find((p) => p.code === "04115")!,
      bio = s.minions.find((p) => p.code === "04114")!;
    mutate.damage = 1;
    s = reveal(s, "04117");
    while (!s.prompt?.options.some((o) => o.id === bio.id))
      s = choose(s, passId(s) || s.prompt!.options[0].id);
    expect(s.prompt!.options.some((o) => o.id === mutate.id)).toBe(true);
    s = settle(choose(reload(s), bio.id));
    expect(s.attachments.find((p) => p.code === "04117")?.attachedTo).toBe(
      bio.id,
    );
    exact(s);
  });
  it("Tech gains Surge when every minion already has that same attachment", () => {
    let s = settle(reveal(started(), "04117"));
    const before = s.encounter.dealt.length;
    s = settle(reveal(s, "04117"));
    expect(s.attachments.filter((p) => p.code === "04117")).toHaveLength(1);
    expect(s.encounter.dealt).toHaveLength(before + 1);
    exact(s);
  });
  it("Zola's Experiments attaches the topmost discarded Tech on a put-into-play entry", () => {
    let s = settle(reveal(started(), "04124"));
    const bottom = take(s, "04117"),
      top = take(s, "04118");
    s.encounter.discard.push(bottom, top);
    const minion = take(s, "04114");
    s = settle(
      native(s, { type: "mutagen:put-minion", piece: minion, playerId: "p1" }),
    );
    expect(s.attachments.find((p) => p.id === top.id)?.attachedTo).toBe(
      minion.id,
    );
    expect(s.encounter.discard.some((p) => p.id === bottom.id)).toBe(true);
    exact(reload(s));
  });
  it("Bio-Servant ATK counts every attachment in addition to its printed modifiers", () => {
    let s = started();
    const bio = s.minions[0];
    s = settle(reveal(s, "04117"));
    s = settle(reveal(s, "04118"));
    s = settle(reveal(s, "04119"));
    expect(s.attachments.filter((p) => p.attachedTo === bio.id)).toHaveLength(
      3,
    );
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === bio.id)!,
      ),
    ).toMatchObject({ attack: 6, scheme: 3 });
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === bio.id)!,
      ),
    ).toBe(10);
    exact(s);
  });
  it.each(["hero", "alter"] as const)(
    "Berserk boost increases only the current %s activation and never spawns a minion",
    (form) => {
      let s = withoutPlayerReactions(started());
      s.player.form = form;
      s.zola!.currentMain.counters = 2;
      const before = s.minions.length,
        hp = s.player.hp,
        threat = s.scheme.threat;
      boost(s, "04116");
      s = settle(
        form === "hero"
          ? attack(s)
          : native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
      );
      expect(s.zola!.currentMain.counters).toBe(3);
      expect(s.minions).toHaveLength(before);
      if (form === "hero") expect(s.player.hp).toBe(hp - 4);
      else expect(s.scheme.threat).toBe(threat + 5);
      expect(enemyStats(s, s.villain)).toMatchObject({ attack: 1, scheme: 2 });
      exact(s);
    },
  );
  it("Ultimate Bio-Servant's boost gives Zola Tough", () => {
    let s = withoutPlayerReactions(started());
    const p = boost(s, "04114");
    s = settle(attack(s));
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
  it("Zola's Mutate boost shuffles the same physical card into the deck", () => {
    let s = withoutPlayerReactions(started());
    const p = boost(s, "04115");
    s = settle(attack(s));
    expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
    exact(reload(s));
  });
  it("Technological Enhancements adds Incite and a counter without spawning", () => {
    let s = withoutPlayerReactions(started());
    s.zola!.currentMain.counters = 2;
    const before = s.minions.length;
    s = settle(reveal(s, "04121"));
    expect(s.scheme.threat).toBe(1);
    expect(s.zola!.currentMain.counters).toBe(3);
    expect(s.minions).toHaveLength(before);
    exact(s);
  });
  it("Technological Enhancements boost adds a counter but no Incite", () => {
    let s = withoutPlayerReactions(started());
    boost(s, "04121");
    s = settle(attack(s));
    expect(s.scheme.threat).toBe(0);
    expect(s.zola!.currentMain.counters).toBe(1);
    exact(s);
  });
  it.each(["hero", "alter"] as const)(
    "Mind Ray completes the %s activation before applying the identity status",
    (form) => {
      let s = withoutPlayerReactions(started());
      s.player.form = form;
      zeroBoost(s);
      const hp = s.player.hp,
        threat = s.scheme.threat;
      s = reveal(s, "04120");
      if (form === "hero") expect(s.player.stunned).toBe(false);
      s = settle(s);
      if (form === "hero") {
        expect(s.player.hp).toBe(hp - 1);
        expect(s.player.stunned).toBe(true);
      } else {
        expect(s.scheme.threat).toBe(threat + 2);
        expect(s.player.confused).toBe(true);
      }
      exact(s);
    },
  );
  it("Mind Ray still stuns after Stun replaces Zola's attack", () => {
    let s = withoutPlayerReactions(started());
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    const hp = s.player.hp;
    s = settle(reveal(s, "04120"));
    expect(s.player.hp).toBe(hp);
    expect(s.villain.stunned).toBe(false);
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("Test Subjects reveals its discarded minion, including the Mutate's Tech search", () => {
    let s = started("expert");
    const subjects = s.sideSchemes.find((p) => p.code === "04123")!,
      mutate = take(s, "04115"),
      tech = take(s, "04117");
    s.encounter.deck.unshift(mutate, tech);
    s = settle(
      native(s, {
        type: "thwart",
        target: subjects.id,
        amount: subjects.counters,
      }),
    );
    expect(s.minions.some((p) => p.id === mutate.id)).toBe(true);
    expect(s.attachments.find((p) => p.id === tech.id)?.attachedTo).toBe(
      mutate.id,
    );
    exact(s);
  });
});

describe("Zola explicit Tech attachment instructions", () => {
  it("Experiments and a Mutate reveal may attach two original copies of the same Tech", () => {
    let s = settle(reveal(started(), "04124"));
    const first = take(s, "04119"),
      second = take(s, "04119"),
      mutate = take(s, "04115");
    s.encounter.discard.push(first);
    s.encounter.deck.unshift(second);
    s = settle(native(s, { type: "reveal", piece: mutate }));
    expect(
      s.attachments
        .filter((p) => p.code === "04119" && p.attachedTo === mutate.id)
        .map((p) => p.id)
        .sort(),
    ).toEqual([first.id, second.id].sort());
    const m = s.minions.find((p) => p.id === mutate.id)!;
    expect(pieceHP(s, m)).toBe(9);
    expect(enemyStats(s, m)).toMatchObject({ attack: 6, scheme: 5 });
    exact(reload(s));
  });
  it("a Mutate's explicit attach ignores Energy Barrier's Sentinel instruction and gives no Tough", () => {
    let s = settle(
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "zola",
        module: "zero_tolerance",
        seed: 4109,
        pacing: "expert",
      }),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    const barrier = take(s, "32103"),
      mutate = take(s, "04115");
    s.encounter.deck.unshift(barrier);
    s = settle(native(s, { type: "reveal", piece: mutate }));
    expect(s.attachments.find((p) => p.id === barrier.id)?.attachedTo).toBe(
      mutate.id,
    );
    expect(s.minions.find((p) => p.id === mutate.id)?.tough).toBe(false);
    expect(s.encounter.dealt).toHaveLength(0);
    exact(s);
  });
});

describe("Zola multiplayer resolution ownership", () => {
  it.each([2, 3])(
    "Hydra Prison captures all %i allies before one combined threat placement",
    (players) => {
      let s = started("standard", players);
      const prison = s.sideSchemes.find((p) => p.code === "04122")!;
      // Focus the original When Revealed in a later hero-form position, with
      // each original captive returned to its owner's hand before re-resolution.
      for (const ally of prison.captured!.splice(0))
        seatView(s, ally.ownerId!).player.hand.push(ally);
      prison.counters = 1;
      const responsibility = take(s, "01061");
      s.player.hand.push(responsibility);
      const hp = s.player.hp,
        total = [2, 3, 4].slice(0, players).reduce((a, b) => a + b, 0);
      s = reveal(s, "04122");
      for (let i = 0; s.prompt?.title !== "Threat incoming" && i < 20; i++)
        s = choose(reload(s), passId(s) || s.prompt!.options[0].id);
      expect(s.prompt?.title).toBe("Threat incoming");
      const captured = s.sideSchemes.find((p) => p.id === prison.id)!;
      expect(captured.captured).toHaveLength(players);
      expect(captured.counters).toBe(1);
      const placement = s
        .prompt!.options.find((o) => o.id === "allow")!
        .effects.find((e) => e.type === "threat")!;
      expect(placement.amount).toBe(total);
      expect(placement.target).toBe(prison.id);
      expect(
        s.queue.filter(
          (e) => e.type === "threat" || e.type === "zola:prison-threat",
        ),
      ).toHaveLength(0);
      const prevent = s.prompt!.options.find((o) =>
        /Great Responsibility/.test(o.label),
      )!;
      expect(prevent).toBeTruthy();
      s = settle(choose(reload(s), prevent.id));
      expect(s.player.hp).toBe(hp - total);
      expect(s.sideSchemes.find((p) => p.id === prison.id)!.counters).toBe(1);
      expect(
        s.sideSchemes.find((p) => p.id === prison.id)!.captured,
      ).toHaveLength(players);
      exact(reload(s));
    },
  );
  it("the first player chooses a Tech attachment tie when another player revealed it", () => {
    let s = started("standard", 2);
    s.firstPlayerId = "p2";
    const tech = take(s, "04117");
    s = native(s, { type: "reveal", piece: tech, actorId: "p1" });
    for (
      let i = 0;
      !s.prompt?.options.some((o) => s.minions.some((p) => p.id === o.id)) &&
      i < 20;
      i++
    )
      s = choose(s, passId(s) || s.prompt!.options[0].id);
    expect(s.prompt?.title).toBe("Defensive Programming");
    expect(s.prompt!.options).toHaveLength(2);
    for (const o of s.prompt!.options)
      expect(o.effects.every((e) => e.actorId === "p2")).toBe(true);
    const selected = s.minions.find((p) => p.engagedWith === "p1")!;
    s = settle(choose(reload(s), selected.id));
    expect(s.attachments.find((p) => p.id === tech.id)?.attachedTo).toBe(
      selected.id,
    );
    exact(s);
  });
});

describe("Zola granted Guard target legality", () => {
  it("Defensive Programming blocks native villain attacks while its blank host retains granted Guard", () => {
    let s = started("standard", 2);
    const host = s.minions.find((p) => p.engagedWith === "p1")!;
    s = settle(reveal(s, "04117"), (v) =>
      v.prompt?.options.some((o) => o.id === host.id) ? host.id : undefined,
    );
    const attachment = s.attachments.find((p) => p.code === "04117")!;
    expect(attachment.attachedTo).toBe(host.id);
    for (const blankHost of [false, true]) {
      if (blankHost) s.flags[`novaIronheartPackBlank:${host.id}`] = s.round;
      expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
        false,
      );
      const choosing = command(reload(s), { type: "BASIC", action: "attack" });
      expect(choosing.prompt!.options.some((o) => o.id === s.villain.id)).toBe(
        false,
      );
      const rejected = dispatch(reload(choosing), {
        type: "CHOOSE",
        id: s.villain.id,
      });
      expect(rejected.error).toBeTruthy();
      expect(rejected.villain.hp).toBe(s.villain.hp);
    }
    s.flags[`novaIronheartPackBlank:${attachment.id}`] = s.round;
    expect(
      targets(reload(s), "enemy", true).some((t) => t.id === s.villain.id),
    ).toBe(true);
    const allowed = command(reload(s), { type: "BASIC", action: "attack" });
    expect(allowed.prompt!.options.some((o) => o.id === s.villain.id)).toBe(
      true,
    );
    const hit = settle(choose(allowed, s.villain.id));
    expect(hit.villain.hp).toBe(s.villain.hp - 2);
    exact(hit);
    delete s.flags[`novaIronheartPackBlank:${attachment.id}`];
    s = settle(native(s, { type: "discardPiece", id: attachment.id }));
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    exact(s);
  });
});

describe("Zola activation and entry timing regressions", () => {
  it("Mind Ray does not stun the surviving teammate after its attack eliminates the targeted player", () => {
    let s = withoutPlayerReactions(started("standard", 2));
    s.player.hp = 1;
    seatView(s, "p2").player.form = "hero";
    zeroBoost(s);
    const hp = seatView(s, "p2").player.hp;
    s = settle(reveal(s, "04120"));
    expect(s.players.find((p) => p.id === "p1")!.eliminated).toBe(true);
    expect(s.phase).not.toBe("lost");
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(seatView(s, "p2").player.stunned).toBe(false);
    expect(seatView(s, "p2").player.confused).toBe(false);
    exact(reload(s));
  });
  it("a revealed Mutate attaches its searched Tech before the Experiments entry response", () => {
    let s = settle(reveal(started(), "04124"));
    const searched = take(s, "04117"),
      discarded = take(s, "04118"),
      mutate = take(s, "04115");
    s.encounter.discard.push(discarded);
    s.encounter.deck.unshift(searched);
    const next = s.encounter.deck[1].id;
    s = settle(native(s, { type: "reveal", piece: mutate }));
    // The physical attachment order records the two resolved effects: the
    // minion's When Revealed search first, then the entry Forced Response.
    expect(
      s.attachments.filter((p) => p.attachedTo === mutate.id).map((p) => p.id),
    ).toEqual([searched.id, discarded.id]);
    expect(s.encounter.deck[0].id).toBe(next);
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === mutate.id)!,
      ),
    ).toBe(9);
    exact(reload(s));
  });
});
