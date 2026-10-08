import type { GameState, PlayerSeat, Piece } from "./types.js";
import { venomInitializeNemesis } from "./venom.js";

// The active view keeps the original solo API. Seats own every persistent zone.
// Rebind after JSON hydration, which does not preserve shared object references.
export function syncSeat(s: GameState) {
  const seat = s.players?.find((p) => p.id === s.activePlayerId);
  if (seat) {
    seat.player = s.player;
    seat.flags = s.flags;
  }
}
export function activateSeat(s: GameState, id: string) {
  syncSeat(s);
  const seat = s.players.find((p) => p.id === id);
  if (!seat) throw Error("Unknown hero seat.");
  s.activePlayerId = id;
  s.player = seat.player;
  s.flags = seat.flags;
  s.heroId = seat.heroId;
  s.aspect = seat.aspect;
}
export function seatView(s: GameState, seat: PlayerSeat | string): GameState {
  const p =
    typeof seat === "string" ? s.players.find((p) => p.id === seat)! : seat;
  return p.id === s.activePlayerId
    ? s
    : {
        ...s,
        player: p.player,
        flags: p.flags,
        heroId: p.heroId,
        aspect: p.aspect,
        activePlayerId: p.id,
      };
}
export function playerOrder(s: GameState): PlayerSeat[] {
  const i = Math.max(
    0,
    s.players.findIndex((p) => p.id === s.firstPlayerId),
  );
  return [...s.players.slice(i), ...s.players.slice(0, i)].filter(
    (p) => !p.eliminated,
  );
}
export function engaged(s: GameState, id = s.activePlayerId) {
  return s.minions.filter((p) => !p.engagedWith || p.engagedWith === id);
}
export function allInPlay(s: GameState): Piece[] {
  return s.players.flatMap((p) =>
    p.id === s.activePlayerId ? s.player.inPlay : p.player.inPlay,
  );
}
export function controller(s: GameState, id: string) {
  return s.players.find((p) =>
    (p.id === s.activePlayerId ? s.player : p.player).inPlay.some(
      (x) => x.id === id,
    ),
  );
}
export function upgradeSave(s: GameState): GameState {
  s.environments ||= [];
  s.resolving ||= [];
  s.pacing ||= "guided";
  s.timeline ||= [];
  s.heroic ||= 0;
  s.hiddenInfo ||= 0;
  s.stats ||= {
    damageDealt: 0,
    damageTaken: 0,
    threatRemoved: 0,
    threatPlaced: 0,
    cardsPlayed: 0,
    enemiesDefeated: 0,
  };
  if (!s.players?.length) {
    s.players = [
      {
        id: "p1",
        heroId: s.heroId,
        aspect: s.aspect,
        player: s.player,
        flags: s.flags,
        ended: false,
        eliminated: false,
        mulliganDone: s.phase !== "mulligan",
      },
    ];
    s.activePlayerId = s.firstPlayerId = s.turnPlayerId = "p1";
    s.playerCount = 1;
    s.guided = true;
    s.review = null;
    s.reviewCount = 0;
    for (const p of [
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ])
      p.ownerId = "p1";
    for (const p of s.minions) {
      p.engagedWith = "p1";
      if (p.droneCard) p.droneCard.ownerId = "p1";
    }
    for (const p of s.encounter.dealt) p.dealtTo = "p1";
  }
  syncSeat(s);
  for (const seat of s.players) {
    // The view shares zones but copies primitive counters. Allocate IDs from
    // the root state so a different seat's migration cannot reuse future IDs.
    venomInitializeNemesis(seatView(s, seat), {
      makePiece: (_view, code) => ({
        id: `c${s.nextId++}`,
        code,
        exhausted: false,
        damage: 0,
        counters: 0,
        tough: false,
        stunned: false,
        confused: false,
      }),
    });
  }
  return s;
}
