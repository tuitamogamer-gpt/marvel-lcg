/** Independent scenario boundaries: commands always cross a JSON save/reload,
 * and the fixtures retain every original player/encounter/setup instance. */
import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { boardSnapshot } from "../src/game/review.js";
import {
  abilityOptions,
  allyCount,
  dispatch,
  enemyStats,
  newGame,
  playable,
  schemeLimit,
  targets,
} from "../src/game/engine.js";
import {
  sabretoothKelly,
  type SabretoothGameState,
} from "../src/game/sabretooth.js";
import { activateSeat, controller, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  hand,
  native,
  pay,
  passId,
  put,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type SourceState = SabretoothGameState & { hostSourceIds?: string[] };
function nested(pieces: Piece[]): Piece[] {
  return pieces.flatMap((p) => [
    p,
    ...nested(p.storedCards || []),
    ...nested(p.captured || []),
    ...(p.droneCard ? nested([p.droneCard]) : []),
  ]);
}
function physical(s: SourceState): Piece[] {
  return nested([
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.spiderHamIdentity ? [p.spiderHamIdentity] : []),
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
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
    ...(s.sabretooth?.kelly ? [s.sabretooth.kelly] : []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ]);
}
function conserved(s: SourceState) {
  const all = physical(s);
  for (const id of s.hostSourceIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original physical source ${id}`,
    ).toHaveLength(1);
  return s;
}
function settle(s: GameState) {
  return conserved(
    finish(s, (v) =>
      /setup/i.test(v.prompt?.title || "")
        ? v.prompt?.options.find((o) => o.image === "32006")?.id
        : /forced|order/i.test(v.prompt?.title || "")
          ? v.prompt?.options[0]?.id
          : undefined,
    ) as SourceState,
  );
}
function create(
  heroId = "spider_man",
  team = false,
  otherHeroId = "captain_marvel",
) {
  return newGame({
    heroId,
    aspect: heroId === "shadowcat" ? "aggression" : "justice",
    villainId: "sabretooth",
    seed: 320660,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId, aspect: "justice" as const },
            { heroId: otherHeroId, aspect: "protection" as const },
          ],
        }
      : {}),
  }) as SourceState;
}
function base(
  heroId = "spider_man",
  team = false,
  otherHeroId = "captain_marvel",
) {
  let s = create(heroId, team, otherHeroId);
  for (const _seat of s.players)
    s = command(s, { type: "MULLIGAN", ids: [] }) as SourceState;
  s = settle(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    const original = [
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    const permanent = original.filter((p) =>
      ["32031a", "32031b"].includes(p.code),
    );
    s.player.deck = original.filter((p) => !permanent.includes(p));
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = permanent;
    s.player.form = "hero";
    s.player.exhausted = s.player.flipped = false;
  }
  activateSeat(s, s.firstPlayerId);
  kelly(s).damage = 0;
  s.hostSourceIds = physical(s).map((p) => p.id);
  expect(new Set(s.hostSourceIds).size).toBe(s.hostSourceIds.length);
  return s;
}
function actualEncounter(s: GameState, code: string) {
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
function activationDeck(s: GameState) {
  const boost = actualEncounter(s, "32070"),
    heal = actualEncounter(s, "32071");
  s.encounter.deck.unshift(boost, heal);
  return { boost, heal };
}
function attack(s: GameState, actorId = s.activePlayerId) {
  return native(s, { type: "enemyAttack", id: s.villain.id, actorId });
}
function rescue(s: GameState) {
  const find = s.sideSchemes.find((p) => p.code === "32065a")!;
  expect(find, "original Find the Senator").toBeTruthy();
  return settle(
    native(s, {
      type: "thwart",
      target: find.id,
      amount: find.counters,
      source: "hero",
    }),
  );
}
function kelly(s: GameState) {
  expect(sabretoothKelly(s), "actual live Robert Kelly").toBeTruthy();
  return sabretoothKelly(s)!;
}
function beguileKelly(s: GameState) {
  const zone = s.player.setAside || [];
  const index = zone.findIndex((p) => p.code === "25031");
  expect(index, "actual original Beguiled nemesis").toBeGreaterThanOrEqual(0);
  const attachment = zone.splice(index, 1)[0];
  s = native(s, { type: "reveal", piece: attachment, skip: true });
  expect(s.prompt?.title).toBe("Beguiled");
  return { s: settle(choose(s, kelly(s).id)), attachment };
}

describe("Sabretooth independent native host boundaries", () => {
  it("extracts one physical Find and uncontrolled Kelly before opening hands and retains both recommended modular sets", () => {
    const s = create();
    const find = s.sideSchemes.find((p) => p.code === "32065a")!;
    expect(find.counters).toBe(5);
    expect(kelly(s).attachedTo).toBe(find.id);
    expect(controller(s, kelly(s).id)).toBeUndefined();
    expect(isTextBlank(s, kelly(s))).toBe(true);
    expect(kelly(s).damage).toBe(1);
    expect(targets(s, "ally").some((t) => t.id === kelly(s).id)).toBe(false);
    expect(physical(s).filter((p) => p.id === find.id)).toHaveLength(1);
    expect(physical(s).filter((p) => p.id === kelly(s).id)).toHaveLength(1);
    expect(
      physical(s).filter((p) => card(p).set_code === "brotherhood"),
    ).toHaveLength(8);
    expect(
      physical(s).filter((p) => card(p).set_code === "mystique"),
    ).toHaveLength(5);
    expect(s.player.hand).toHaveLength(6);
  });

  it("keeps stage one unlimited and rescues the same physical cards before the multiplayer 9-per-hero stage-two limit", () => {
    let s = base("spider_man", true);
    const npcId = kelly(s).id,
      findId = s.sideSchemes.find((p) => p.code === "32065a")!.id;
    s.scheme.threat = 100;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme.code).toBe("32063b");
    expect(s.scheme.threat).toBe(101);
    expect(schemeLimit(s)).toBe(0);
    s = rescue(s);
    expect(s.scheme.code).toBe("32064b");
    expect(s.scheme.threat).toBe(0);
    expect(schemeLimit(s)).toBe(18);
    expect(kelly(s).id).toBe(npcId);
    expect(kelly(s).attachedTo).toBeUndefined();
    expect(controller(s, npcId)?.id).toBe("p1");
    expect(s.environments?.find((p) => p.id === findId)?.code).toBe("32065b");
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    s.scheme.threat = 17;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.phase).toBe("lost");
    expect(sabretoothKelly(s)).toBeUndefined();
    expect(s.encounter.discard.some((p) => p.id === npcId)).toBe(true);
  });

  it.each([false, true])(
    "step-one Kelly damage uses threat AFTER actual prevention: %s",
    (prevent) => {
      let s = base("she_hulk");
      s.player.form = "alter";
      s.scheme.threat = 5;
      const npcId = kelly(s).id;
      s = native(s, { type: "villainStepOne" });
      expect(s.prompt?.options.some((o) => o.id === "object")).toBe(true);
      s = settle(choose(s, prevent ? "object" : "allow"));
      expect(s.scheme.threat).toBe(prevent ? 5 : 6);
      expect(kelly(s).id).toBe(npcId);
      expect(kelly(s).damage).toBe(prevent ? 2 : 3);
    },
  );

  it.each(["attack", "scheme"] as const)(
    "heals after an actual %s and discards the exact numeric-icons card once through saves",
    (kind) => {
      let s = base();
      s.player.form = kind === "attack" ? "hero" : "alter";
      s.villain.hp -= 5;
      const hp = s.villain.hp,
        { heal } = activationDeck(s);
      s = settle(
        native(s, {
          type: kind === "attack" ? "enemyAttack" : "enemyScheme",
          id: s.villain.id,
        }),
      );
      expect(s.villain.hp).toBe(hp + 2);
      expect(s.encounter.discard.filter((p) => p.id === heal.id)).toHaveLength(
        1,
      );
      expect(
        (s as SourceState).sabretooth?.completedActivationIds,
      ).toHaveLength(1);
      s = settle(
        native(s, { type: "flag", key: "boundaryNoReplay", value: true }),
      );
      expect(s.villain.hp).toBe(hp + 2);
      expect(
        (s as SourceState).sabretooth?.completedActivationIds,
      ).toHaveLength(1);
    },
  );

  it.each(["attack", "scheme"] as const)(
    "a status-replaced %s does not discard for regeneration",
    (kind) => {
      let s = base();
      s.player.form = kind === "attack" ? "hero" : "alter";
      s.villain.hp -= 5;
      if (kind === "attack") {
        s.villain.stunned = true;
        s.villain.stunCards = 1;
      } else {
        s.villain.confused = true;
        s.villain.confuseCards = 1;
      }
      const hp = s.villain.hp,
        { boost, heal } = activationDeck(s);
      s = settle(
        native(s, {
          type: kind === "attack" ? "enemyAttack" : "enemyScheme",
          id: s.villain.id,
        }),
      );
      expect(s.villain.hp).toBe(hp);
      expect(s.encounter.deck[0].id).toBe(boost.id);
      expect(s.encounter.deck[1].id).toBe(heal.id);
      expect(
        (s as SourceState).sabretooth?.completedActivationIds,
      ).toHaveLength(0);
    },
  );

  it("Feral Rage's actual extra attack in alter ego also regenerates once", () => {
    let s = base();
    s.player.form = "alter";
    s.villain.hp -= 5;
    const rage = actualEncounter(s, "32072");
    s = settle(native(s, { type: "reveal", piece: rage, skip: true }));
    const hp = s.villain.hp;
    activationDeck(s);
    s = settle(
      native(s, { type: "thwart", target: rage.id, amount: 4, source: "hero" }),
    );
    expect(s.villain.hp).toBe(hp + 2);
    expect(s.player.hp).toBe(7);
    expect((s as SourceState).sabretooth?.completedActivationIds).toHaveLength(
      1,
    );
  });

  it.each([false, true])(
    "Unrelenting Savage's actual attack gets its undamaged-only +1: %s",
    (damaged) => {
      let s = base();
      if (damaged) s.villain.hp--;
      const savage = actualEncounter(s, "32070");
      activationDeck(s);
      const hp = s.player.hp;
      s = settle(native(s, { type: "reveal", piece: savage, skip: true }));
      expect(s.player.hp).toBe(hp - (damaged ? 3 : 4));
      expect(
        (s as SourceState).sabretooth?.completedActivationIds,
      ).toHaveLength(1);
    },
  );

  it("transfers control with the first-player token without leaving, entering or resetting Kelly", () => {
    let s = rescue(base("spider_man", true));
    const id = kelly(s).id;
    kelly(s).damage = 3;
    kelly(s).exhausted = true;
    s = settle(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p2");
    expect(controller(s, id)?.id).toBe("p2");
    expect(kelly(s).damage).toBe(3);
    expect(kelly(s).exhausted).toBe(true);
    expect(s.phase).toBe("player");
  });

  it("rescuing Kelly from another player's actual thwart gives control to the first player", () => {
    let s = base("spider_man", true);
    const find = s.sideSchemes.find((p) => p.code === "32065a")!,
      id = kelly(s).id;
    s = settle(
      native(s, {
        type: "thwart",
        target: find.id,
        amount: find.counters,
        source: "hero",
        actorId: "p2",
      }),
    );
    expect(controller(s, id)?.id).toBe("p1");
    expect(s.scheme.code).toBe("32064b");
    expect(s.environments?.find((p) => p.id === find.id)?.code).toBe("32065b");
  });

  it("an eliminated first player immediately transfers the same live NPC to the next player", () => {
    let s = rescue(base("spider_man", true));
    const id = kelly(s).id;
    kelly(s).damage = 2;
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 20,
        source: "32069",
      }),
    );
    expect(s.players[0].eliminated).toBe(true);
    expect(s.firstPlayerId).toBe("p2");
    expect(controller(s, id)?.id).toBe("p2");
    expect(kelly(s).damage).toBe(2);
    expect(s.phase).toBe("player");
  });

  it("an actual activation still regenerates when its targeted hero is eliminated and another hero survives", () => {
    let s = base("spider_man", true);
    s.player.hp = 1;
    s.villain.hp -= 5;
    const hp = s.villain.hp;
    const { heal } = activationDeck(s);
    s = settle(attack(s));
    expect(s.players[0].eliminated).toBe(true);
    expect(s.players[1].eliminated).toBe(false);
    expect(s.villain.hp).toBe(hp + 2);
    expect(s.encounter.discard.filter((p) => p.id === heal.id)).toHaveLength(1);
    expect(s.sabretooth?.completedActivationIds).toHaveLength(1);
  });

  it("redirects an undefended attack before hero Tough while applying Kelly's own Tough", () => {
    let s = rescue(base());
    s.player.tough = true;
    s.player.toughCards = 1;
    kelly(s).tough = true;
    kelly(s).toughCards = 1;
    const hp = s.player.hp;
    activationDeck(s);
    s = settle(attack(s));
    expect(s.player.hp).toBe(hp);
    expect(s.player.toughCards).toBe(1);
    expect(kelly(s).damage).toBe(0);
    expect(kelly(s).toughCards).toBe(0);
  });

  it("redirects before identity-only damage interrupts can spend a card or counter", () => {
    let s = rescue(base());
    const [sidestep, resource] = hand(s, "14015", "01088");
    const barrier = put(s, "05017");
    barrier.counters = 3;
    activationDeck(s);
    const hp = s.player.hp;
    s = attack(s);
    for (let n = 0; s.prompt && n < 100; n++) {
      expect(
        s.prompt.options.some((o) =>
          ["14015", "05017"].includes(o.image || ""),
        ),
        JSON.stringify(s.prompt),
      ).toBe(false);
      const id =
        passId(s) ||
        (/forced|order/i.test(s.prompt.title)
          ? s.prompt.options[0]?.id
          : undefined);
      expect(id, JSON.stringify(s.prompt)).toBeTruthy();
      s = choose(s, id!);
    }
    conserved(s);
    expect(s.player.hp).toBe(hp);
    expect(kelly(s).damage).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === barrier.id)?.counters).toBe(3);
    expect(s.player.hand.some((p) => p.id === sidestep.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
    expect(boardSnapshot(s).values[`${kelly(s).id}:damage`]?.value).toBe(3);
  });

  it("uses the actual cross-seat hero defender for Protect the Senator", () => {
    let s = rescue(base("spider_man", true));
    const [energy] = hand(s, "01088");
    activationDeck(s);
    const otherHP = seatView(s, "p2").player.hp;
    s = until(
      attack(s, "p2"),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero:p1"),
    );
    s = choose(s, "hero:p1");
    s = respond(s, /Protect the Senator/, "32065b");
    expect(s.activePlayerId).toBe("p1");
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [energy]));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(otherHP);
    expect(kelly(s).damage).toBe(0);
  });

  it("a defended ally's Overkill damages the defending identity rather than Kelly", () => {
    let s = rescue(base("colossus"));
    const ally = put(s, "01067");
    ally.damage = 1;
    const source = s.player.setAside!;
    const index = source.findIndex((p) => p.code === "32028");
    expect(index, "actual original Unstoppable source").toBeGreaterThanOrEqual(
      0,
    );
    const unstoppable = source.splice(index, 1)[0];
    unstoppable.attachedTo = s.villain.id;
    s.attachments.push(unstoppable);
    activationDeck(s);
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === ally.id),
    );
    s = settle(choose(s, ally.id));
    expect(s.player.hp).toBe(hp - 4);
    expect(kelly(s).damage).toBe(0);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });

  it("does not evict a player ally when controlled Kelly joins three allies", () => {
    let s = rescue(base());
    const allies = [put(s, "01067"), put(s, "01083"), put(s, "01084")];
    expect(allyCount(s)).toBe(3);
    s = settle(native(s, { type: "allyLimit" }));
    expect(
      s.player.inPlay.filter((p) => allies.some((a) => a.id === p.id)),
    ).toHaveLength(3);
    expect(controller(s, kelly(s).id)?.id).toBe("p1");
  });

  it("actual end-of-player-phase refill readies the same controlled NPC", () => {
    let s = rescue(base());
    const id = kelly(s).id;
    kelly(s).exhausted = true;
    s = settle(native(s, { type: "refill" }));
    expect(kelly(s).id).toBe(id);
    expect(kelly(s).exhausted).toBe(false);
    expect(s.player.hand).toHaveLength(5);
  });

  it("Kelly can defend but cannot initiate a dashed basic power or pay its costs", () => {
    let s = rescue(base());
    const npc = kelly(s);
    activationDeck(s);
    expect(abilityOptions(s, npc)).toEqual([]);
    const result = dispatch(reload(s), {
      type: "ABILITY",
      id: npc.id,
      action: "attack",
    });
    expect(result.error).toMatch(/no basic ATK or THW/i);
    expect(kelly(result).exhausted).toBe(false);
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === npc.id),
    );
    s = settle(choose(s, npc.id));
    expect(kelly(s).exhausted).toBe(true);
    expect(kelly(s).damage).toBe(3);
    expect(s.player.hp).toBe(10);
  });

  it.each(["01086", "01074"])(
    "rejects a Kelly-only healing/attachment play before PAY: %s",
    (code) => {
      const s = rescue(base());
      kelly(s).damage = 3;
      const [piece, resource] = hand(s, code, "01088");
      expect(playable(s, piece)).toMatch(/eligible|Robert Kelly/i);
      const result = dispatch(reload(s), {
        type: "PLAY",
        id: piece.id,
      }) as SourceState;
      expect(result.error).toMatch(/eligible|Robert Kelly/i);
      expect(result.prompt?.kind).not.toBe("payment");
      expect(result.player.hand.some((p) => p.id === piece.id)).toBe(true);
      expect(result.player.hand.some((p) => p.id === resource.id)).toBe(true);
      expect(kelly(result).damage).toBe(3);
      conserved(result);
    },
  );

  it("Medical Emergency heals Kelly as an encounter effect and preserves its physical Victory card", () => {
    let s = base();
    kelly(s).damage = 3;
    const emergency = actualEncounter(s, "32071");
    s = settle(native(s, { type: "reveal", piece: emergency, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === emergency.id)?.counters).toBe(4);
    s = settle(
      native(s, {
        type: "thwart",
        target: emergency.id,
        amount: 4,
        source: "hero",
      }),
    );
    expect(kelly(s).damage).toBe(1);
    expect(s.encounter.discard.some((p) => p.id === emergency.id)).toBe(false);
    expect(
      physical(s as SourceState).filter((p) => p.id === emergency.id),
    ).toHaveLength(1);
    expect(boardSnapshot(s).locations[emergency.id]?.zone).toBe(
      "Victory display",
    );
  });

  it("Phased Shadowcat cannot bypass Mystique's absolute attack restriction while nonattack damage remains legal", () => {
    let s = base("shadowcat");
    s.player.inPlay.find((p) => p.code === "32031a")!.code = "32031b";
    const mystique = actualEncounter(s, "32080");
    s = settle(native(s, { type: "reveal", piece: mystique, skip: true }));
    expect(targets(s, "enemy", true).some((t) => t.id === s.villain.id)).toBe(
      false,
    );
    expect(targets(s, "enemy", false).some((t) => t.id === s.villain.id)).toBe(
      true,
    );
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 2,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(hp - 2);
  });

  it.each(["draw", "fromDeck"])(
    "an actual Shapeshifter %s hand entrance responds once across repeated saved continuations",
    (entry) => {
      let s = rescue(base());
      const infiltration = actualEncounter(s, "32082"),
        team = put(s, "01080");
      team.counters = 3;
      s.player.deck.unshift(infiltration);
      const effect: Effect =
        entry === "draw"
          ? { type: "draw", amount: 1 }
          : { type: "fromDeck", id: infiltration.id };
      s = native(s, effect);
      expect(s.prompt?.title).toBe("Infiltration");
      expect(s.prompt?.options.some((o) => o.id === kelly(s).id)).toBe(true);
      s = settle(choose(s, team.id));
      expect(s.player.hand.some((p) => p.id === infiltration.id)).toBe(true);
      const second = put(s, "01091");
      s = settle(
        native(s, { type: "flag", key: "sameHandContinuation", value: true }),
      );
      expect(s.player.inPlay.some((p) => p.id === second.id)).toBe(true);
      s = settle(native(s, { type: "endDiscard", ids: [infiltration.id] }));
      expect(s.encounter.discard.some((p) => p.id === infiltration.id)).toBe(
        true,
      );
      expect(s.player.discard.some((p) => p.id === infiltration.id)).toBe(
        false,
      );
    },
  );

  it("Infiltration offers the real controlled NPC and its actual discard loses immediately", () => {
    let s = rescue(base());
    const npcId = kelly(s).id;
    const infiltration = actualEncounter(s, "32082");
    s.player.deck.unshift(infiltration);
    s = native(s, { type: "draw", amount: 1 });
    expect(s.prompt?.title).toBe("Infiltration");
    s = conserved(choose(s, npcId) as SourceState);
    expect(s.phase).toBe("lost");
    expect(sabretoothKelly(s)).toBeUndefined();
    expect(s.encounter.discard.some((p) => p.id === npcId)).toBe(true);
    expect(s.player.discard.some((p) => p.id === npcId)).toBe(false);
  });

  it("a Shapeshifter's first draw interrupts the remaining draws and terminal NPC loss stops them", () => {
    let s = rescue(base());
    const npcId = kelly(s).id;
    const infiltration = actualEncounter(s, "32082");
    s.player.deck.unshift(infiltration);
    s = native(s, { type: "draw", amount: 3 });
    expect(s.prompt?.title).toBe("Infiltration");
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.hand[0].id).toBe(infiltration.id);
    s = conserved(choose(s, npcId) as SourceState);
    expect(s.phase).toBe("lost");
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.deck).toHaveLength(40);
  });

  it("Spider-Man drawing Surprise completes Mystique's nested activation and resumes the same villain activation", () => {
    let s = base();
    const mystique = actualEncounter(s, "32080");
    s = settle(native(s, { type: "reveal", piece: mystique, skip: true }));
    const surprise = actualEncounter(s, "32083");
    s.player.deck.unshift(surprise);
    s.villain.hp -= 5;
    const villainHP = s.villain.hp,
      heroHP = s.player.hp;
    activationDeck(s);
    s = settle(attack(s));
    expect(s.player.hp).toBe(heroHP - 5);
    expect(s.villain.hp).toBe(villainHP + 2);
    expect(s.enemyAttackCounts?.[mystique.id]).toBe(1);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(s.sabretooth?.completedActivationIds).toHaveLength(1);
    expect(s.player.hand.filter((p) => p.id === surprise.id)).toHaveLength(1);
    expect(s.attack).toBeNull();
  });

  it("terminal nested Surprise keeps the outer attack's actual facedown boost exactly once", () => {
    let s = rescue(base("shadowcat"));
    const mass = s.player.inPlay.find((p) => p.code === "32031a")!;
    mass.code = "32031b";
    kelly(s).damage = 8;
    const mystique = actualEncounter(s, "32080");
    s = settle(native(s, { type: "reveal", piece: mystique, skip: true }));
    hand(s, "32040");
    const surprise = actualEncounter(s, "32083");
    s.player.deck.unshift(surprise);
    const { boost } = activationDeck(s);
    s = respond(attack(s), /Quick Shift/, "32040");
    s = settle(s);
    expect(s.phase).toBe("lost");
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
    expect(s.player.hand.filter((p) => p.id === surprise.id)).toHaveLength(1);
  });

  it("a real Regroup return still makes Kelly leave and lose without creating a player-hand copy", () => {
    let s = rescue(base());
    const npcId = kelly(s).id;
    kelly(s).damage = 8;
    put(s, "19032");
    activationDeck(s);
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === npcId),
    );
    s = choose(s, npcId);
    s = respond(s, /Regroup/, "19032");
    conserved(s);
    expect(s.phase).toBe("lost");
    expect(sabretoothKelly(s)).toBeUndefined();
    expect(
      s.players
        .flatMap((seat) => seatView(s, seat).player.hand)
        .some((p) => p.id === npcId),
    ).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === npcId)).toHaveLength(1);
    expect(s.queue).toHaveLength(0);
  });

  it("real Beguiled converts and restores the same NPC once without a leave or player-zone copy", () => {
    let s = rescue(base("valk", true));
    const id = kelly(s).id;
    kelly(s).damage = 3;
    kelly(s).exhausted = true;
    const converted = beguileKelly(s);
    s = converted.s;
    expect(s.sabretooth?.kelly).toBeUndefined();
    expect(s.minions.filter((p) => p.id === id)).toHaveLength(1);
    expect(kelly(s).treatedAsMinion).toBe(true);
    expect(isTextBlank(s, kelly(s))).toBe(true);
    expect(controller(s, id)).toBeUndefined();
    expect(targets(s, "ally").some((t) => t.id === id)).toBe(false);
    expect(targets(s, "enemy").some((t) => t.id === id)).toBe(true);
    expect(s.phase).toBe("player");
    s = settle(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p2");
    s = settle(
      native(s, { type: "discardPiece", id: converted.attachment.id }),
    );
    expect(s.sabretooth?.kelly?.id).toBe(id);
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(kelly(s).damage).toBe(3);
    expect(kelly(s).exhausted).toBe(true);
    expect(kelly(s).treatedAsMinion).toBeUndefined();
    expect(controller(s, id)?.id).toBe("p2");
    expect(
      s.players
        .flatMap((seat) => seatView(s, seat).player.inPlay)
        .some((p) => p.id === id),
    ).toBe(false);
  });

  it("defeating the actual NPC while Beguiled still loses and never restores a defeated copy", () => {
    let s = rescue(base("valk"));
    const id = kelly(s).id;
    s = beguileKelly(s).s;
    s = settle(
      native(s, { type: "damage", target: id, amount: 9, source: "hero" }),
    );
    expect(s.phase).toBe("lost");
    expect(sabretoothKelly(s)).toBeUndefined();
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });

  it("Kelly's real dash-derived minion powers stay zero under an actual Gobbler Glider", () => {
    let s = rescue(base("valk", true, "spiderham"));
    const id = kelly(s).id;
    s = beguileKelly(s).s;
    const zone = seatView(s, "p2").player.setAside || [];
    const index = zone.findIndex((p) => p.code === "30027");
    expect(index, "actual original Gobbler Glider").toBeGreaterThanOrEqual(0);
    const glider = zone.splice(index, 1)[0];
    s = settle(native(s, { type: "reveal", piece: glider, skip: true }));
    expect(s.attachments.find((p) => p.id === glider.id)?.attachedTo).toBe(id);
    expect(enemyStats(s, kelly(s))).toEqual({ attack: 0, scheme: 0 });
    const hp = s.player.hp;
    s.scheme.threat = 0;
    s = settle(native(s, { type: "enemyAttack", id }));
    expect(s.player.hp).toBe(hp);
    s.player.form = "alter";
    s = settle(native(s, { type: "enemyScheme", id }));
    expect(s.scheme.threat).toBe(0);
  });

  it.each(["damage", "discard-find"])(
    "an actual NPC leave loses before later queued effects: %s",
    (cause) => {
      let s = base();
      const npcId = kelly(s).id;
      const effect: Effect =
        cause === "damage"
          ? { type: "damage", target: npcId, amount: 9, source: "32063b" }
          : {
              type: "discardPiece",
              id: s.sideSchemes.find((p) => p.code === "32065a")!.id,
            };
      s = settle(
        native(s, effect, { type: "flag", key: "afterNPCLeft", value: true }),
      );
      expect(s.phase).toBe("lost");
      expect(s.flags.afterNPCLeft).toBeUndefined();
      expect(sabretoothKelly(s)).toBeUndefined();
      expect(s.encounter.discard.some((p) => p.id === npcId)).toBe(true);
    },
  );
});
