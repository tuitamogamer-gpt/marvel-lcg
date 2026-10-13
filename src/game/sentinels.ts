import catalog from "../data/catalog-cards.json" with { type: "json" };
import players from "../data/core-player.json" with { type: "json" };
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map(
  ([...catalog, ...players] as Card[]).map((c) => [c.code, c]),
);
const S = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sentinels:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};

export const SENTINELS_SET = "sentinels";
export const SENTINELS_SCRIPT_CODES = [
  "32105",
  "32106",
  "32107",
  "32108",
] as const;
export const SENTINELS_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const SENTINELS_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface SentinelsPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  /** Current native traits: text blanking does not erase printed traits. */
  hasTrait(s: GameState, targetId: string, trait: string): boolean;
  isEngagedWith(s: GameState, minion: Piece, playerId: string): boolean;
  /** Identity exhaustion in either hero or alter-ego form, including a
   * physical SP//dr identity. Costs always affect this actual player's identity. */
  canExhaustIdentity(s: GameState, playerId: string): boolean;
  exhaustIdentity(s: GameState, playerId: string): void;
  /** Move this same actual resolving attachment onto the named identity,
   * using a stable hero:<playerId> target. Never create another copy. */
  attachIdentity(s: GameState, pieceId: string, playerId: string): void;
  discardPiece(s: GameState, pieceId: string): void;
  /** Search only actual encounter deck/discard for32107, REVEAL that same
   * physical piece to this player through complete native reveal/attachment
   * windows, and perform the required deck shuffle. Absence fabricates nothing. */
  searchAndRevealTargeted(
    s: GameState,
    playerId: string,
    after: Effect[],
  ): void;
  /** Start a native ATTACK against this actual player, even in alter-ego.
   * Entry, Stun/replacement, cooperative defense, boosts and receipts remain
   * native. An absent/defeated actual source performs no attack. */
  startAttack(
    s: GameState,
    minionId: string,
    playerId: string,
    after: Effect[],
  ): void;
  /** Deal this SAME physical resolving/boost card facedown to this player.
   * Mark it retained on its current activation, remove only its physical
   * source zone, preserve original numeric boost receipts, and never REVEAL
   * it now or let ordinary boost cleanup duplicate/discard it. */
  dealBoostFacedown(s: GameState, pieceId: string, playerId: string): void;
}
type TraitPorts = Pick<SentinelsPorts, "hasTrait" | "isEngagedWith">;
type RestrictionPorts = TraitPorts & Pick<SentinelsPorts, "isTextBlank">;
const known = (p: Pick<Piece, "code">) =>
  (SENTINELS_SCRIPT_CODES as readonly string[]).includes(p.code);
function onIdentity(s: GameState, p: Piece, playerId: string) {
  return (
    p.attachedTo === `hero:${playerId}` ||
    (p.attachedTo === "hero" && playerId === s.activePlayerId)
  );
}
function targeted(s: GameState, playerId: string) {
  return s.attachments.filter(
    (p) => p.code === "32107" && onIdentity(s, p, playerId),
  );
}
function sentinelEngaged(s: GameState, playerId: string, ports: TraitPorts) {
  return s.minions.some(
    (p) =>
      ports.isEngagedWith(s, p, playerId) &&
      ports.hasTrait(s, p.id, "Sentinel"),
  );
}
function identityLabel(s: GameState, playerId: string) {
  const seat = s.players.find((p) => p.id === playerId)!;
  return (
    [...definitions.values()].find(
      (c) => c.type_code === "hero" && c.set_code === seat.heroId,
    )?.name || seat.heroId
  );
}
/** Presence conditions reference the actual named attachment even if its
 * text is blank. Its own restrictions/actions still require active text. */
export function sentinelsTargetedIdentities(s: GameState): string[] {
  return s.players
    .filter((seat) => !seat.eliminated && targeted(s, seat.id).length)
    .map((seat) => seat.id);
}
/** Only hero→alter-ego is prohibited. Alter→hero and changes between hero
 * faces/modes remain the ordinary host's decision. Minion text blanking does
 * not remove its Sentinel trait or another card's active restriction. */
export function sentinelsCanChangeForm(
  s: GameState,
  playerId: string,
  from: "hero" | "alter",
  to: "hero" | "alter",
  ports: RestrictionPorts,
): boolean {
  return (
    from !== "hero" ||
    to !== "alter" ||
    !targeted(s, playerId).some((p) => !ports.isTextBlank(s, p)) ||
    !sentinelEngaged(s, playerId, ports)
  );
}
/** Absolute THW prohibition for this actual acting player; non-THW threat
 * removal remains legal and must call its ordinary host path separately. */
export function sentinelsCanThwart(
  s: GameState,
  schemeId: string,
  playerId: string,
  ports: RestrictionPorts,
): boolean {
  const p = s.sideSchemes.find((p) => p.id === schemeId && p.code === "32108");
  return !p || ports.isTextBlank(s, p) || !sentinelEngaged(s, playerId, ports);
}
export function sentinelsReveal(
  s: GameState,
  p: Piece,
  ports: Pick<SentinelsPorts, "isTextBlank">,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "32105")
    return [
      S("mark-v", {
        id: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32107")
    return [
      S("targeted", {
        id: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  // Printed Quickstrike and base3N/Hazard stay exclusively in the native host.
  return [];
}
export function sentinelsBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  return p.code === "32106"
    ? [S("mark-vi-boost", { id: p.id, actorId: s.activePlayerId })]
    : [];
}
export function sentinelsAbilityOptions(
  s: GameState,
  pieceId: string,
  ports: Pick<SentinelsPorts, "isTextBlank" | "canExhaustIdentity">,
): Option[] {
  const p = s.attachments.find((p) => p.id === pieceId && p.code === "32107");
  return p &&
    !ports.isTextBlank(s, p) &&
    onIdentity(s, p, s.activePlayerId) &&
    ports.canExhaustIdentity(s, s.activePlayerId)
    ? [
        {
          id: `discard:${pieceId}`,
          label: "Targeted for Elimination · exhaust your identity to discard",
          image: p.code,
          effects: [
            S("discard", {
              id: pieceId,
              playerId: s.activePlayerId,
              actorId: s.activePlayerId,
            }),
          ],
        },
      ]
    : [];
}
export function sentinelsAbility(
  s: GameState,
  pieceId: string,
  action: string,
  ports: Pick<SentinelsPorts, "isTextBlank" | "canExhaustIdentity">,
): Effect[] | null {
  const p = s.attachments.find((p) => p.id === pieceId && p.code === "32107");
  if (!p || !["discard", `discard:${pieceId}`].includes(action)) return null;
  const option = sentinelsAbilityOptions(s, pieceId, ports)[0];
  need(
    option,
    "Targeted for Elimination requires its actual ready identity and active source.",
  );
  return option!.effects;
}
export function resolveSentinelsEffect(
  s: GameState,
  e: Effect,
  ports: SentinelsPorts,
): boolean {
  if (!e.type.startsWith("sentinels:")) return false;
  switch (e.type) {
    case "sentinels:mark-v":
      if (targeted(s, e.playerId).length)
        ports.startAttack(s, e.id, e.playerId, e.after || []);
      else ports.searchAndRevealTargeted(s, e.playerId, e.after || []);
      break;
    case "sentinels:targeted":
      if (targeted(s, e.playerId).length)
        ports.queue(
          s,
          E("surge", {
            sourceCode: "32107",
            sourceId: e.id,
            actorId: e.playerId,
          }),
        );
      else ports.attachIdentity(s, e.id, e.playerId);
      break;
    case "sentinels:mark-vi-boost": {
      const recipients = sentinelsTargetedIdentities(s);
      if (recipients.length === 1)
        ports.dealBoostFacedown(s, e.id, recipients[0]);
      else if (recipients.length > 1)
        ports.queue(
          s,
          S("mark-vi-choice", {
            id: e.id,
            returnPlayerId: s.activePlayerId,
            actorId: s.firstPlayerId,
          }),
        );
      break;
    }
    case "sentinels:mark-vi-choice": {
      const recipients = sentinelsTargetedIdentities(s);
      if (recipients.length <= 1) {
        ports.queue(
          s,
          recipients.length
            ? S("deal-boost", {
                id: e.id,
                playerId: recipients[0],
                actorId: e.returnPlayerId,
              })
            : S("boost-return", { actorId: e.returnPlayerId }),
        );
      } else
        ports.choose(
          s,
          "Sentinel Mark VI",
          "The first player chooses an identity with Targeted for Elimination to receive this same card facedown.",
          recipients.map((playerId) => ({
            id: playerId,
            label: identityLabel(s, playerId),
            effects: [
              S("deal-boost", {
                id: e.id,
                playerId,
                actorId: e.returnPlayerId,
              }),
            ],
          })),
        );
      break;
    }
    case "sentinels:boost-return":
      break;
    case "sentinels:deal-boost":
      need(
        sentinelsTargetedIdentities(s).includes(e.playerId),
        "The selected identity no longer has Targeted for Elimination attached.",
      );
      ports.dealBoostFacedown(s, e.id, e.playerId);
      break;
    case "sentinels:discard":
      need(
        s.activePlayerId === e.playerId &&
          sentinelsAbilityOptions(s, e.id, ports).length,
        "Targeted for Elimination requires its actual ready identity and active source.",
      );
      ports.exhaustIdentity(s, e.playerId);
      ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Sentinels effect: ${e.type}`);
  }
  return true;
}
