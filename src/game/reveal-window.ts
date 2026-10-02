import type { Card, Effect, GameState, Option, Piece } from "./types.js";
import { keywordDeclarations, printedKeyword } from "./keywords.js";
import { playerOrder } from "./team.js";

export type RevealAbilityId = "text" | "incite" | "surge";
export interface RevealWindow {
  piece: Piece;
  /** Original revealer, even when a text activation changes the defending player. */
  playerId: string;
  /** One ordinary resolution plus additional Media Coverage resolutions. */
  copies: number;
  incite: number;
  pending: RevealAbilityId[];
  resolved: RevealAbilityId[];
}
type RevealState = GameState & { revealWindows?: Record<string, RevealWindow> };
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const W = (name: string, args: Record<string, unknown> = {}) =>
  E(`reveal-window:${name}`, args);
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};

export interface RevealWindowEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  /** Resolve only original When Revealed text, once, recalculating conditions.
   * Do not perform card entry, keywords, a cancellation prompt or cleanup again.
   * Tag child effects with revealWindowId so gainsSurge is intercepted below. */
  resolveText(s: GameState, piece: Piece, windowId: string): void;
  /** Deal directly. Do not route through the gained-Surge interception again. */
  dealEncounter(s: GameState, playerId: string): void;
  afterSurge?(s: GameState, piece: Piece, playerId: string): Effect[];
  /** Finish the original physical card exactly once after all groups resolve. */
  finish(s: GameState, piece: Piece): void;
}
function windows(s: GameState) {
  return ((s as RevealState).revealWindows ||= {});
}
const chooser = (s: GameState) => playerOrder(s)[0]?.id || s.firstPlayerId;

/** Begin after cancellation and one physical entry. This helper implements
 * same-window Surge/Incite/text ordering, not card-specific text interpretation.
 * Current explicit modules have one applicable original When Revealed group;
 * future cards with multiple independently applicable text groups need group IDs. */
export function beginRevealWindow(
  s: GameState,
  piece: Piece,
  card: Card,
  playerId: string,
  copies = 1,
): Effect[] {
  need(
    !windows(s)[piece.id],
    "This physical encounter already has an active reveal window.",
  );
  need(
    Number.isInteger(copies) && copies >= 1,
    "Reveal resolution count must be a positive integer.",
  );
  const declaration = keywordDeclarations(card).find(
    (keyword) => keyword.name === "Incite",
  );
  const incite = declaration
    ? declaration.value * (declaration.perPlayer ? s.playerCount : 1)
    : 0;
  const pending: RevealAbilityId[] = [];
  if (
    /<b>When Revealed(?:\s*\([^)]*\))?<\/b>\s*:/i.test(card.text || "") ||
    /(?:^|\n)When Revealed(?:\s*\([^)]*\))?\s*:/i.test(card.text || "")
  )
    pending.push("text");
  if (incite) pending.push("incite");
  if (printedKeyword(card, "Surge")) pending.push("surge");
  windows(s)[piece.id] = {
    piece,
    playerId,
    copies,
    incite,
    pending,
    resolved: [],
  };
  return [W("step", { windowId: piece.id, actorId: chooser(s) })];
}

/** Intercept an effect that represents this resolving card gaining Surge.
 * Unnumbered keywords do not stack (RRG1.8 p25). If printed Surge has already
 * resolved, gaining another instance cannot create another ability window.
 * false means no such window exists and the host owns the ordinary effect. */
export function revealWindowGainSurge(s: GameState, windowId: string): boolean {
  const window = (s as RevealState).revealWindows?.[windowId];
  if (!window) return false;
  if (!window.pending.includes("surge") && !window.resolved.includes("surge"))
    window.pending.push("surge");
  return true;
}
export function activeRevealWindow(
  s: GameState,
  windowId: string,
): RevealWindow | undefined {
  return (s as RevealState).revealWindows?.[windowId];
}

export function resolveRevealWindowEffect(
  s: GameState,
  e: Effect,
  ports: RevealWindowEnginePorts,
): boolean {
  if (!e.type.startsWith("reveal-window:")) return false;
  const window = activeRevealWindow(s, e.windowId);
  // An already completed or canceled window cannot replay physical effects.
  if (!window) return true;
  const next = () => W("step", { windowId: e.windowId, actorId: chooser(s) });
  switch (e.type) {
    case "reveal-window:step": {
      if (!window.pending.length) {
        delete windows(s)[e.windowId];
        ports.finish(s, window.piece);
        break;
      }
      const effects = (id: RevealAbilityId) => [
        W("execute", {
          windowId: e.windowId,
          abilityId: id,
          actorId: window.playerId,
        }),
      ];
      if (window.pending.length === 1)
        ports.queue(s, ...effects(window.pending[0]));
      else
        ports.choose(
          s,
          "When Revealed · ability order",
          "The first player chooses which ability resolves next. Surge, Incite and When Revealed text share this timing window.",
          window.pending.map((id) => ({
            id,
            label:
              id === "text"
                ? "Resolve When Revealed text"
                : id === "incite"
                  ? `Resolve Incite ${window.incite}`
                  : "Resolve Surge",
            effects: effects(id),
            image: window.piece.code,
          })),
        );
      break;
    }
    case "reveal-window:execute": {
      const index = window.pending.indexOf(e.abilityId);
      need(index >= 0, "This reveal ability is no longer pending.");
      window.pending.splice(index, 1);
      window.resolved.push(e.abilityId);
      if (e.abilityId === "text")
        ports.queue(
          s,
          ...Array.from({ length: window.copies }, () =>
            W("text", { windowId: e.windowId, actorId: window.playerId }),
          ),
          next(),
        );
      else if (e.abilityId === "incite")
        ports.queue(
          s,
          ...Array.from({ length: window.copies }, () =>
            E("threat", {
              target: "main",
              amount: window.incite,
              actorId: window.playerId,
              revealWindowId: e.windowId,
            }),
          ),
          next(),
        );
      else if (e.abilityId === "surge") {
        for (let n = 0; n < window.copies; n++)
          ports.dealEncounter(s, window.playerId);
        ports.queue(
          s,
          ...(ports.afterSurge?.(s, window.piece, window.playerId) || []),
          next(),
        );
      } else throw Error(`Unknown reveal ability: ${e.abilityId}`);
      break;
    }
    case "reveal-window:text":
      ports.resolveText(s, window.piece, e.windowId);
      break;
    default:
      throw Error(`Unknown reveal-window effect: ${e.type}`);
  }
  return true;
}
