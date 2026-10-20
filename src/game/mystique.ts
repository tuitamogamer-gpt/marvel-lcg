import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const M = (type: string, args: Record<string, unknown> = {}) =>
  E(`mystique:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const definition = (p: Piece) => cards.get(p.code);
const shapeshifter = (p: Piece) =>
  (definition(p)?.traits || "").split(/\.\s*/).includes("Shapeshifter");
const source = (p: Piece) => p.code === "32080";
const entryKey = (token: string) => `mystiqueHandEntry:${token}`;
const textPorts = { isTextBlank };
type TextPorts = Pick<MystiquePorts, "isTextBlank">;

export const MYSTIQUE_SCRIPT_CODES = [
  "32080",
  "32081",
  "32082",
  "32083",
] as const;
export const MYSTIQUE_SET = "mystique";
export const MYSTIQUE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const MYSTIQUE_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const MYSTIQUE_RULEBOOK_SOURCE =
  "https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf";
export const MYSTIQUE_SIDE_SCHEME = {
  baseThreat: 3,
  perPlayer: false,
  amplify: 1,
} as const;

export interface MystiqueHandEntryReceipt {
  /** Every ACTUAL hand entry has a fresh token, including searches/returns.
   * Multiple callbacks for that same entry retain its token. */
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
}
export interface MystiquePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  /** CURRENT villain SCH/ATK including native statistic modifiers. This is
   * not a stage snapshot or a copy of boost icons from another activation. */
  villainStats(s: GameState): { attack: number; scheme: number };
  /** Actual controlled Pieces, including a scenario ally held outside the
   * ordinary player inPlay array (e.g. the singleton Robert Kelly). */
  controlledPieces(s: GameState): Piece[];
  canDiscardControlled(s: GameState, p: Piece): boolean;
  /** Native leave-play cleanup, interrupts and actual owner's discard. */
  discardControlled(s: GameState, id: string, after: Effect[]): void;
  /** Move these exact IDs from their actual prior zones into this player's
   * existing deck, preserving encounter ownership. Shuffle that deck once;
   * do not manufacture player copies or invent a deck-exhaustion penalty.
   * Capture resolving encounter IDs so finishResolution cannot discard them. */
  shuffleIntoPlayerDeck(
    s: GameState,
    ids: string[],
    playerId: string,
    after: Effect[],
  ): void;
  /** Actual native activation against the hand-entry seat, even when engaged
   * with someone else. Hero/AE, Stun/Confuse, boosts and defense are native. */
  activateMystique(
    s: GameState,
    enemyId: string,
    playerId: string,
    after: Effect[],
  ): void;
  /** Search the actual deck/discard piece, remove exactly that ID and REVEAL
   * to this seat, preserving its original source/reveal receipt and native
   * encounter-exhaustion boundary. Continue only after reveal/keywords. */
  revealSearchedMystique(
    s: GameState,
    pieceId: string,
    playerId: string,
    after: Effect[],
  ): void;
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
}

/** Players cannot attack the villain is an absolute prohibition, independent
 * of Guard, engagement and the acting player's identity. Nonattack damage
 * remains legal; the host supplies the actual action's attack classification. */
export function mystiqueVillainAttackProhibited(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return s.minions.some((p) => source(p) && !ports.isTextBlank(s, p));
}
/** Return the actual current base values to replace the printed star stats.
 * Native modifiers attached/granted to Mystique are applied afterward. */
export function mystiqueStats(
  s: GameState,
  p: Piece,
  ports: Pick<MystiquePorts, "isTextBlank" | "villainStats">,
): { attack: number; scheme: number } | null {
  if (!source(p) || !s.minions.some((a) => a.id === p.id)) return null;
  return ports.isTextBlank(s, p)
    ? { attack: 0, scheme: 0 }
    : ports.villainStats(s);
}
export const mystiqueEnemyStats = mystiqueStats;

export function mystiqueReveal(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
): Effect[] | null {
  if (!(MYSTIQUE_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  if (!["32082", "32083"].includes(p.code) || ports.isTextBlank(s, p))
    return [];
  return [
    M("infiltrate-deck", {
      id: p.id,
      code: p.code,
      playerId: s.activePlayerId,
      actorId: s.activePlayerId,
    }),
  ];
}
/** No printed boost star ability on any of these four faces. */
export function mystiqueBoost(_s: GameState, p: Piece): Effect[] | null {
  return (MYSTIQUE_SCRIPT_CODES as readonly string[]).includes(p.code)
    ? []
    : null;
}
export function mystiqueSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId = s.activePlayerId,
  ports: TextPorts = textPorts,
): Effect[] {
  return p.code === "32081" && !ports.isTextBlank(s, p)
    ? [M("mayhem", { playerId, actorId: playerId })]
    : [];
}
/** The host calls this AFTER the actual piece moves into the actual hand,
 * before completing the parent draw/search/return. Receipt effects remain
 * valid if another mandatory effect subsequently moves the source away. */
export function mystiqueHandEntered(
  s: GameState,
  r: MystiqueHandEntryReceipt,
  ports: TextPorts = textPorts,
): Effect[] {
  const seat = playerOrder(s).find((p) => p.id === r.playerId);
  if (!seat || !["32082", "32083"].includes(r.code)) return [];
  const view = seatView(s, seat);
  const physical = view.player.hand.find(
    (p) => p.id === r.pieceId && p.code === r.code,
  );
  return !view.flags[entryKey(r.token)] &&
    !!physical &&
    !ports.isTextBlank(view, physical)
    ? [M("hand-response", { receipt: r, actorId: r.playerId })]
    : [];
}
/** Mutant Genesis rulebook p7: these actual treacheries discarded from HAND
 * or DECK enter encounter discard. Existing old player-discard cards are not
 * silently migrated by this rule. */
export function mystiqueDiscardFromPlayerZone(
  p: Piece,
  from: "hand" | "deck" | "discard",
): boolean {
  return from !== "discard" && ["32082", "32083", "38027"].includes(p.code);
}
const discardTargets = (s: GameState, ports: MystiquePorts) =>
  ports
    .controlledPieces(s)
    .filter(
      (p) =>
        !p.treatedAsMinion &&
        ["ally", "support"].includes(definition(p)?.type_code || "") &&
        ports.canDiscardControlled(s, p),
    );
const searched = (s: GameState) =>
  [...s.encounter.deck, ...s.encounter.discard].filter(source);

export function resolveMystiqueEffect(
  s: GameState,
  e: Effect,
  ports: MystiquePorts,
): boolean {
  if (!e.type.startsWith("mystique:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "mystique:infiltrate-deck":
      ports.shuffleIntoPlayerDeck(s, [e.id], e.playerId, [
        E("surge", { sourceCode: e.code, actorId: e.playerId }),
        ...after,
      ]);
      break;
    case "mystique:mayhem": {
      const ids = s.encounter.discard.filter(shapeshifter).map((p) => p.id);
      if (ids.length) ports.shuffleIntoPlayerDeck(s, ids, e.playerId, after);
      else ports.queue(s, ...after);
      break;
    }
    case "mystique:hand-response": {
      const r: MystiqueHandEntryReceipt = e.receipt;
      const recipient = s.players.find((p) => p.id === r.playerId);
      if (!recipient || recipient.eliminated) {
        ports.queue(s, ...after);
        break;
      }
      need(
        s.activePlayerId === r.playerId,
        "Mystique's hand-entry response belongs to the actual receiving player.",
      );
      if (s.flags[entryKey(r.token)]) {
        ports.queue(s, ...after);
        break;
      }
      s.flags[entryKey(r.token)] = true;
      if (r.code === "32082") {
        const targets = discardTargets(s, ports);
        if (targets.length)
          ports.choose(
            s,
            "Infiltration",
            "Discard an ally or support you control.",
            targets.map((p) =>
              O(
                p.id,
                definition(p)?.name || p.code,
                [
                  M("infiltration-discard", {
                    id: p.id,
                    source: r.pieceId,
                    after,
                    actorId: r.playerId,
                  }),
                ],
                p.code,
              ),
            ),
          );
        else ports.queue(s, ...after);
      } else if (r.code === "32083") {
        const mystique = s.minions.find(source);
        if (mystique) ports.activateMystique(s, mystique.id, r.playerId, after);
        else
          ports.queue(
            s,
            M("surprise-search", {
              playerId: r.playerId,
              after,
              actorId: r.playerId,
            }),
          );
      } else
        throw Error("This physical card has no Mystique hand-entry response.");
      break;
    }
    case "mystique:infiltration-discard": {
      const p = discardTargets(s, ports).find((p) => p.id === e.id);
      need(
        p,
        "Infiltration requires the selected actual controlled ally or support.",
      );
      ports.queue(
        s,
        E("discardPiece", {
          id: p!.id,
          encounterDiscard: true,
          source: e.source,
          after,
        }),
      );
      break;
    }
    case "mystique:surprise-search": {
      ports.revealHidden(s);
      const choices = searched(s);
      if (choices.length)
        ports.choose(
          s,
          "Shapeshifter Surprise",
          "Search the encounter deck and discard pile for Mystique and reveal her.",
          choices.map((p) =>
            O(
              p.id,
              "Mystique",
              [
                M("surprise-reveal", {
                  id: p.id,
                  playerId: e.playerId,
                  after,
                  actorId: e.playerId,
                }),
              ],
              p.code,
            ),
          ),
        );
      else {
        ports.shuffleEncounter(s);
        ports.queue(s, ...after);
      }
      break;
    }
    case "mystique:surprise-reveal":
      need(
        searched(s).some((p) => p.id === e.id),
        "Shapeshifter Surprise requires the actual searched Mystique card.",
      );
      ports.revealSearchedMystique(s, e.id, e.playerId, [
        M("search-finish", { after, actorId: e.playerId }),
      ]);
      break;
    case "mystique:search-finish":
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    default:
      throw Error(`Unknown Mystique effect: ${e.type}`);
  }
  return true;
}
