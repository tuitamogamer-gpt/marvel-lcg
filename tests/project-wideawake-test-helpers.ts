import { expect } from "vitest";
import { card } from "../src/game/cards.js";
import { newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { command, finish } from "./dv-test-helpers.js";
export {
  choose,
  command,
  hand,
  native,
  pay,
  passId,
  put,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

export type NativeState = GameState & { wideawakeSourceIds?: string[] };
function nested(pieces: Piece[]): Piece[] {
  return pieces.flatMap((p) => [
    p,
    ...nested(p.storedCards || []),
    ...nested(p.captured || []),
    ...(p.droneCard ? nested([p.droneCard]) : []),
  ]);
}
export function physical(s: GameState): Piece[] {
  return nested([
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.removed,
    ...(s.victoryDisplay || []),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.projectWideawake?.setAsideCaptives || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ]);
}
export function conserved(s: NativeState) {
  for (const id of s.wideawakeSourceIds || [])
    expect(
      physical(s).filter((p) => p.id === id),
      `original source ${id}`,
    ).toHaveLength(1);
  return s;
}
export function settle(s: GameState): NativeState {
  return conserved(
    finish(s, (v) =>
      /search|forced responses|setup|starting mass/i.test(v.prompt?.title || "")
        ? v.prompt?.options[0]?.id
        : undefined,
    ) as NativeState,
  );
}
export function base(
  heroId = "spider_man",
  team = false,
  module = "sentinels",
): NativeState {
  let s = newGame({
    heroId,
    aspect: "justice",
    villainId: "project_wideawake",
    module,
    captureAllocation: Array(team ? 2 : 1).fill(0),
    seed: 320840,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId, aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  }) as NativeState;
  for (const _ of s.players)
    s = command(s, { type: "MULLIGAN", ids: [] }) as NativeState;
  s = settle(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    const originals = [
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    const forms = originals.filter((p) =>
      ["32031a", "32031b"].includes(p.code),
    );
    s.player.deck = originals.filter((p) => !forms.includes(p));
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = forms;
    s.player.form = "hero";
    s.player.flipped = s.player.exhausted = false;
  }
  activateSeat(s, s.firstPlayerId);
  s.wideawakeSourceIds = physical(s).map((p) => p.id);
  expect(new Set(s.wideawakeSourceIds).size).toBe(s.wideawakeSourceIds.length);
  return s;
}
export function actualEncounter(s: GameState, code: string): Piece {
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
export function captive(
  s: GameState,
  code: string,
  playerId = s.activePlayerId,
): Piece {
  const pool = s.projectWideawake!.setAsideCaptives;
  const index = pool.findIndex((p) => p.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  const [p] = pool.splice(index, 1);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
export function operation(s: GameState) {
  const p = s.sideSchemes.find((p) => p.code === "32104");
  expect(p).toBeTruthy();
  return p!;
}
export function neutralBoost(s: GameState) {
  const p = actualEncounter(s, "32098");
  s.encounter.deck.unshift(p);
  expect(card(p).boost).toBe(2);
  return p;
}
