import catalog from "../data/catalog-cards.json" with { type: "json" };
import corePlayers from "../data/core-player.json" with { type: "json" };
import { seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map(
  ([...catalog, ...corePlayers] as Card[]).map((c) => [c.code, c]),
);
const B = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `brotherhood:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const known = (p: Pick<Piece, "code">) =>
  (BROTHERHOOD_SCRIPT_CODES as readonly string[]).includes(p.code);
const label = (p: Piece) => definitions.get(p.code)?.name || "Ultron Drone";

export const BROTHERHOOD_SET = "brotherhood";
export const BROTHERHOOD_SCRIPT_CODES = [
  "32073",
  "32074",
  "32075",
  "32076",
  "32077",
  "32078",
  "32079",
] as const;
export const BROTHERHOOD_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const BROTHERHOOD_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const BROTHERHOOD_HOMO_BOOST_RULING =
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#134";

export interface BrotherhoodCharacter {
  id: string;
  label: string;
  code?: string;
}
export interface BrotherhoodAttackReceipt {
  token: string;
  attackerId: string;
  attackerCode: string;
  /** Actual player attacked after cooperative defense changes. */
  playerId: string;
  /** An actual completed attack; Stun/replacement/aborted attacks are false. */
  performed: boolean;
  /** Source text at its actual forced-response triggering condition. */
  textBlank: boolean;
  /** Actual primary character damaged, including a native Kelly replacement. */
  targetId?: string;
  /** Actual damage TAKEN from this attack, excluding boost/prevention/Tough. */
  damageTaken: number;
  /** Captured actual controller before damage/defeat; never the physical owner. */
  targetControllerId?: string;
}
export interface BrotherhoodPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  /** Active identity in either form and actual controlled allies/NPCs. */
  controlledCharacters(s: GameState): BrotherhoodCharacter[];
  canExhaustCharacter(s: GameState, id: string): boolean;
  exhaustCharacter(s: GameState, id: string): void;
  /** Current native Steady/Stalwart/max status rules; Tough remains legal on
   * Stalwart/Steady and fails harmlessly when its printed maximum is reached. */
  statusEligible(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  addStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): void;
  /** Discard one actual player-deck top through native owner-aware routing,
   * immediate player-deck exhaustion/reset and all corresponding windows.
   * Resume after with discardedPiece?:Piece and deckEmptied:boolean. */
  discardPlayerTop(s: GameState, playerId: string, after: Effect[]): void;
  /** Actual deterministic shared RNG and hidden-information advancement;
   * physical hand encounter cards retain their correct native destinations. */
  discardRandomHand(s: GameState, playerId: string, after: Effect[]): void;
  /** Native indirect assignment, Tough/prevention and per-character maximum
   * allocations; amount is the exact printed resource-icon total. */
  indirectDamage(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    after: Effect[],
  ): void;
  /** Move this exact resolving/physical boost attachment into play and attach
   * it to this actual minion; prevent ordinary boost cleanup discarding it.
   * Retain its original numeric boost count (Homo Superior still contributes 1). */
  attachMinion(
    s: GameState,
    id: string,
    minionId: string,
    boost: boolean,
  ): void;
  /** Search only actual encounter deck/discard, reveal the chosen physical
   * scheme through complete native entry/reveal/Hinder windows, then shuffle.
   * Resume with entered:boolean captured AT ENTRY; an already-in-play copy,
   * unique conflict or absence must not count as having entered this way.
   * A later leave does not retroactively change a true entry receipt. */
  searchAndRevealSideScheme(s: GameState, code: string, after: Effect[]): void;
  /** Native bounded discard-until, including exhaustion/reset windows. Resume
   * with only the actual discarded matching minion as discardedPiece?:Piece. */
  discardUntilMinion(s: GameState, trait: string, after: Effect[]): void;
  /** REVEAL this SAME discarded physical card, locating its ID after any
   * immediate native reset. Entry, uniqueness, Quickstrike and When Revealed
   * resolve normally before after. This is never PUT or a newly created card. */
  revealDiscardedMinion(
    s: GameState,
    piece: Piece,
    playerId: string,
    after: Effect[],
  ): void;
}

/** Printed resource icons, including every double icon and wild. No generated
 * resources or cost multiplier applies. An infiltrating encounter card such
 * as Shapeshifter consequently contributes its actual printed zero. */
export function brotherhoodPrintedResources(p: Piece): number {
  const c = definitions.get(p.code);
  return (
    Number(c?.resource_energy || 0) +
    Number(c?.resource_mental || 0) +
    Number(c?.resource_physical || 0) +
    Number(c?.resource_wild || 0)
  );
}
/** Grants follow live sources. Minion text blanking never removes another
 * card's +5 HP/Quickstrike grant; blanking the attachment/scheme does. */
export function brotherhoodModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<BrotherhoodPorts, "isTextBlank" | "hasTrait">,
) {
  const inPlay = s.minions.some((m) => m.id === p.id);
  return {
    health: inPlay
      ? s.attachments.filter(
          (a) =>
            a.code === "32077" &&
            a.attachedTo === p.id &&
            !ports.isTextBlank(s, a),
        ).length * 5
      : 0,
    quickstrike:
      inPlay &&
      ports.hasTrait(s, p.id, "Brotherhood of Mutants") &&
      s.sideSchemes.some((a) => a.code === "32079" && !ports.isTextBlank(s, a)),
  };
}
/** The Brotherhood's printed base is FIXED 3. Native printed Hinder 2 per
 * player adds 2N exactly once; no authored Hinder/base-threat duplicate. */
export function brotherhoodReveal(
  s: GameState,
  p: Piece,
  ports: Pick<BrotherhoodPorts, "isTextBlank">,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "32077")
    return [B("homo", { id: p.id, boost: false, actorId: s.activePlayerId })];
  if (p.code === "32078")
    return [B("terrorists", { id: p.id, actorId: s.activePlayerId })];
  return [];
}
export function brotherhoodBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === "32073") return [B("exhaust", { actorId: s.activePlayerId })];
  if (p.code === "32076")
    return [
      B("random", {
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
        after: [],
      }),
    ];
  if (p.code === "32077")
    return [B("homo", { id: p.id, boost: true, actorId: s.activePlayerId })];
  return [];
}
/** Frozen actual attack receipts permit already-triggered effects to resolve
 * after later text/source changes. Re-evaluating HP cannot replace a receipt. */
export function brotherhoodAfterAttack(
  _s: GameState,
  receipt: BrotherhoodAttackReceipt,
): Effect[] {
  if (
    !receipt.performed ||
    receipt.textBlank ||
    !["32073", "32074", "32075", "32076"].includes(receipt.attackerCode)
  )
    return [];
  if (
    ["32074", "32076"].includes(receipt.attackerCode) &&
    (!receipt.targetId || receipt.damageTaken <= 0)
  )
    return [];
  if (
    receipt.attackerCode === "32076" &&
    receipt.targetControllerId !== receipt.playerId
  )
    return [];
  return [
    B("attack", {
      receipt,
      actorId: receipt.playerId,
      mandatory: true,
      forced: true,
    }),
  ];
}
function exhaustTargets(s: GameState, ports: BrotherhoodPorts) {
  return ports
    .controlledCharacters(s)
    .filter((t) => ports.canExhaustCharacter(s, t.id));
}
export function resolveBrotherhoodEffect(
  s: GameState,
  e: Effect,
  ports: BrotherhoodPorts,
): boolean {
  if (!e.type.startsWith("brotherhood:")) return false;
  switch (e.type) {
    case "brotherhood:attack": {
      const r = e.receipt as BrotherhoodAttackReceipt;
      const v = seatView(s, r.playerId),
        key = `brotherhoodAttack:${r.token}:${r.attackerId}`;
      if (v.flags[key] || !brotherhoodAfterAttack(s, r).length) break;
      v.flags[key] = true;
      if (r.attackerCode === "32073")
        ports.queue(s, B("exhaust", { actorId: r.playerId }));
      else if (r.attackerCode === "32074") {
        if (r.targetId && ports.statusEligible(s, r.targetId, "stunned"))
          ports.addStatus(s, r.targetId, "stunned");
      } else if (r.attackerCode === "32075")
        ports.queue(
          s,
          B("pyro-mill", {
            playerId: r.playerId,
            sourceId: r.attackerId,
            remaining: 2,
            icons: 0,
            discardedIds: [],
            actorId: r.playerId,
          }),
        );
      else if (r.attackerCode === "32076")
        ports.discardRandomHand(s, r.playerId, []);
      break;
    }
    case "brotherhood:exhaust": {
      const targets = exhaustTargets(s, ports);
      if (targets.length)
        ports.choose(
          s,
          "Avalanche",
          "Choose a ready character you control to exhaust.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                B("exhaust-target", {
                  target: t.id,
                  actorId: s.activePlayerId,
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "brotherhood:exhaust-target":
      need(
        exhaustTargets(s, ports).some((t) => t.id === e.target),
        "Avalanche can exhaust only an actual ready character you control.",
      );
      ports.exhaustCharacter(s, e.target);
      break;
    case "brotherhood:random":
      ports.discardRandomHand(s, e.playerId, e.after || []);
      break;
    case "brotherhood:pyro-mill":
      ports.discardPlayerTop(s, e.playerId, [
        B("pyro-step", { ...e, type: "brotherhood:pyro-step" }),
      ]);
      break;
    case "brotherhood:pyro-step": {
      const piece = e.discardedPiece as Piece | undefined;
      const icons = e.icons + (piece ? brotherhoodPrintedResources(piece) : 0);
      const ids = piece ? [...e.discardedIds, piece.id] : e.discardedIds;
      if (piece && !e.deckEmptied && e.remaining > 1)
        ports.queue(
          s,
          B("pyro-mill", {
            playerId: e.playerId,
            sourceId: e.sourceId,
            remaining: e.remaining - 1,
            icons,
            discardedIds: ids,
            actorId: e.playerId,
          }),
        );
      else if (icons > 0)
        ports.indirectDamage(s, e.playerId, icons, e.sourceId, []);
      break;
    }
    case "brotherhood:homo": {
      const minions = s.minions;
      if (!minions.length) {
        if (!e.boost)
          ports.queue(s, E("surge", { sourceCode: "32077", sourceId: e.id }));
        break;
      }
      ports.choose(
        s,
        "Homo Superior",
        "Choose a minion to attach the same physical card and give Tough.",
        minions.map((p) =>
          O(
            p.id,
            label(p),
            [
              B("homo-attach", {
                id: e.id,
                target: p.id,
                boost: !!e.boost,
                actorId: s.activePlayerId,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "brotherhood:homo-attach":
      need(
        s.minions.some((p) => p.id === e.target),
        "Homo Superior requires an actual minion still in play.",
      );
      ports.attachMinion(s, e.id, e.target, !!e.boost);
      if (ports.statusEligible(s, e.target, "tough"))
        ports.addStatus(s, e.target, "tough");
      break;
    case "brotherhood:terrorists":
      ports.searchAndRevealSideScheme(s, "32079", [
        B("terrorists-result", {
          id: e.id,
          playerId: s.activePlayerId,
          actorId: s.activePlayerId,
        }),
      ]);
      break;
    case "brotherhood:terrorists-result":
      if (!e.entered)
        ports.discardUntilMinion(s, "Brotherhood of Mutants", [
          B("terrorists-minion", { playerId: e.playerId, actorId: e.playerId }),
        ]);
      break;
    case "brotherhood:terrorists-minion": {
      const p = e.discardedPiece as Piece | undefined;
      if (p) ports.revealDiscardedMinion(s, p, e.playerId, []);
      break;
    }
    default:
      throw Error(`Unknown Brotherhood effect: ${e.type}`);
  }
  return true;
}
