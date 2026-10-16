import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { seatView } from "./team.js";
import { statusCards } from "./keywords.js";
import type { Card, Effect, GameState, Piece } from "./types.js";

export const ACOLYTES_SCRIPT_CODES = [
  "32159",
  "32160",
  "32161",
  "32162",
  "32163",
  "32164",
  "32165",
] as const;
const definitions = new Map((catalog as Card[]).map((c) => [c.code, c]));
const A = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `acolytes:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
export const acolyte = (p: Pick<Piece, "code">) => {
  const c = definitions.get(p.code);
  return (
    c?.type_code === "minion" &&
    /(?:^|\.\s*)Acolyte(?:\.|$)/i.test(c.traits || "")
  );
};
export function acolytesGuard(s: GameState, p: Piece) {
  return (
    s.minions.some((m) => m.id === p.id) &&
    acolyte(p) &&
    s.sideSchemes.some((p) => p.code === "32165" && !isTextBlank(s, p))
  );
}
export function acolytesPiercing(s: GameState, p: Piece) {
  return p.code === "32161" && !isTextBlank(s, p);
}
export function acolytesEngaged(s: GameState, p: Piece): Effect[] {
  if (
    !ACOLYTES_SCRIPT_CODES.slice(0, 5).includes(p.code as never) ||
    isTextBlank(s, p)
  )
    return [];
  return [A("teamwork", { id: p.id })];
}
export function acolytesReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(ACOLYTES_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  return p.code === "32164" && !isTextBlank(s, p)
    ? [A("zeal", { playerId: s.activePlayerId })]
    : [];
}
export function acolytesBoost(s: GameState, p: Piece): Effect[] | null {
  if (!(ACOLYTES_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  return p.code === "32165" ? [A("shuffle")] : [];
}
export function acolytesDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  after: Effect[],
): Effect[] | null {
  if (
    !ACOLYTES_SCRIPT_CODES.slice(0, 5).includes(p.code as never) ||
    isTextBlank(s, p)
  )
    return null;
  return [A("defeated", { code: p.code, playerId, after })];
}
export interface AcolytesPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  activate(s: GameState, id: string, playerId: string): void;
  discardUntil(s: GameState, trait: string, after: Effect[]): void;
  put(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  reveal(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  boost(s: GameState): void;
  clearVillainStatuses(s: GameState): void;
  shuffle(s: GameState): void;
}
export function resolveAcolytesEffect(
  s: GameState,
  e: Effect,
  ports: AcolytesPorts,
) {
  if (!e.type.startsWith("acolytes:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "acolytes:teamwork": {
      const live = s.minions.filter((m) => !m.pendingDefeat && acolyte(m));
      const entered = live.find((m) => m.id === e.id);
      if (!entered || isTextBlank(s, entered) || live.length < 2) break;
      // RRG 1.8 p43 supersedes the original expansion insert: only the
      // entrant activates, against its own engaged player.
      ports.queue(
        s,
        A("activate", {
          id: entered.id,
          playerId: entered.engagedWith || s.activePlayerId,
        }),
      );
      break;
    }
    case "acolytes:activate":
      if (s.minions.some((m) => m.id === e.id && !m.pendingDefeat))
        ports.activate(s, e.id, e.playerId);
      break;
    case "acolytes:zeal": {
      const engaged = s.minions.filter(
        (m) =>
          acolyte(m) &&
          !m.pendingDefeat &&
          (m.engagedWith || s.activePlayerId) === e.playerId,
      );
      if (!engaged.length)
        ports.discardUntil(s, "", [
          A("found", { playerId: e.playerId, reveal: true }),
        ]);
      else
        ports.queue(
          s,
          A("zeal-order", {
            playerId: e.playerId,
            ids: engaged.filter((m) => !isTextBlank(s, m)).map((m) => m.id),
          }),
        );
      break;
    }
    case "acolytes:zeal-order": {
      const remaining = (e.ids as string[])
        .map((id) => s.minions.find((m) => m.id === id && !isTextBlank(s, m)))
        .filter((p): p is Piece => !!p);
      if (!remaining.length) break;
      const options = remaining.map((p) => ({
        id: p.id,
        label: definitions.get(p.code)!.name,
        image: p.code,
        effects: [
          A("defeated", {
            code: p.code,
            playerId: e.playerId,
            after: [
              A("zeal-order", {
                playerId: e.playerId,
                ids: remaining.filter((m) => m.id !== p.id).map((m) => m.id),
              }),
            ],
          }),
        ],
      }));
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else
        ports.queue(
          s,
          E("acolytes-native:order", { options, actorId: s.firstPlayerId }),
        );
      break;
    }
    case "acolytes:defeated": {
      const view = seatView(s, e.playerId);
      const before = s.queue.length;
      switch (e.code) {
        case "32159":
          ports.discardUntil(s, "Acolyte", [
            A("found", { playerId: e.playerId, after }),
          ]);
          return true;
        case "32160":
          ports.queue(
            s,
            statusCards(view.player, "confused")
              ? E("threat", { target: "main", amount: 2 })
              : E("status", {
                  target: `hero:${e.playerId}`,
                  status: "confused",
                }),
          );
          break;
        case "32161":
          ports.queue(
            s,
            statusCards(view.player, "stunned")
              ? E("damage", {
                  target: `hero:${e.playerId}`,
                  amount: 3,
                  source: "32161",
                })
              : E("status", {
                  target: `hero:${e.playerId}`,
                  status: "stunned",
                }),
          );
          break;
        case "32162":
          ports.clearVillainStatuses(s);
          ports.boost(s);
          break;
        case "32163":
          ports.queue(
            s,
            statusCards(s.villain, "tough")
              ? E("heal", {
                  target: s.villain.id,
                  amount: 4,
                  origin: "encounter",
                })
              : E("status", { target: s.villain.id, status: "tough" }),
          );
          break;
      }
      // add() prepends. Preserve ability-before-continuation ordering.
      const ability = s.queue.splice(0, s.queue.length - before);
      ports.queue(s, ...ability, ...after);
      break;
    }
    case "acolytes:found":
      if (e.discardedPiece) {
        if (e.reveal) ports.reveal(s, e.discardedPiece, e.playerId, after);
        else ports.put(s, e.discardedPiece, e.playerId, after);
      } else ports.queue(s, ...after);
      break;
    case "acolytes:shuffle":
      ports.shuffle(s);
      break;
    default:
      throw Error(`Unknown Acolytes effect: ${e.type}`);
  }
  return true;
}
