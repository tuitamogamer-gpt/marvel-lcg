import catalog from "../data/catalog-cards.json" with { type: "json" };
import players from "../data/core-player.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map(
  ([...catalog, ...players] as Card[]).map((c) => [c.code, c]),
);
const Z = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zero-tolerance:${name}`,
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
  (ZERO_TOLERANCE_SCRIPT_CODES as readonly string[]).includes(p.code);
const textPorts = { isTextBlank };
const reactionKey = (token: string, sourceId: string, kind: string) =>
  `zeroToleranceReaction:${token}:${sourceId}:${kind}`;
const reactionFlags = (s: GameState) => s.players[0]?.flags || s.flags;

export const ZERO_TOLERANCE_SET = "zero_tolerance";
export const ZERO_TOLERANCE_SCRIPT_CODES = [
  "32101",
  "32102",
  "32103",
  "32104",
] as const;
export const ZERO_TOLERANCE_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const ZERO_TOLERANCE_RULEBOOK_SOURCE =
  "https://hallofheroeslcg.com/wp-content/uploads/2022/10/mutant-genesis-rulebook.pdf";
export const ZERO_TOLERANCE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const ZERO_TOLERANCE_CURRENT_RULINGS =
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/";
export const ZERO_TOLERANCE_SIDE_SCHEME = {
  baseThreat: 3,
  perPlayer: true,
} as const;
export const ZERO_TOLERANCE_BARRIER = { attack: 2 } as const;

export interface ZeroToleranceSourceReceipt {
  sourceId: string;
  code: string;
  /** Source text at the actual completed attack's triggering condition. */
  textBlank: boolean;
}
export interface ZeroToleranceAllyDefeatReceipt {
  id: string;
  code: string;
  ownerId?: string;
  controllerId?: string;
  /** Actual ally at confirmed enemy-attack defeat, excluding a printed ally
   * currently treated as a minion or a prevented/replaced defeat. A printed
   * minion treated as an ally reverts after leaving and cannot be captured. */
  actualAlly: boolean;
}
export interface ZeroToleranceAttackReceipt {
  token: string;
  attackerId: string;
  attackerCode: string;
  playerId: string;
  /** Actual completed attack; status-replaced/aborted attacks are false. */
  performed: boolean;
  /** OZT requires an enemy attack, not a player attack/consequential damage. */
  enemyAttack: boolean;
  defeatedAllies: ZeroToleranceAllyDefeatReceipt[];
  /** Capture these sources AT the completed attack's trigger; if omitted,
   * zeroToleranceAfterAttack reads the actual current sources at that time. */
  barrierSources?: ZeroToleranceSourceReceipt[];
  schemeSources?: ZeroToleranceSourceReceipt[];
}
export interface ZeroTolerancePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  hasStatus(s: GameState, target: string, status: "stunned" | "tough"): boolean;
  /** Apply native actual-character status limits, Steady/Stalwart, prevention
   * and elimination. An absent target or reached maximum is harmless. */
  addStatus(s: GameState, target: string, status: "stunned" | "tough"): void;
  /** Native nonattack BOOST damage, including while-defending prevention.
   * Continue only after real damage/defeat/response windows finish. */
  damage(
    s: GameState,
    target: string,
    amount: number,
    sourceId: string,
    after: Effect[],
  ): void;
  /** Move exactly this actual encounter/resolving ID onto this actual minion.
   * This port only attaches; the module separately resolves ordinary Barrier
   * entry Tough. Mark III's specific attach skips Barrier's attach-to text. */
  attachBarrier(
    s: GameState,
    id: string,
    minionId: string,
    after: Effect[],
  ): void;
  /** Search REVEALS this same actual encounter-deck/discard scheme. Preserve
   * native deck-exhaustion, unique entry, threat and When Revealed windows. */
  revealSearchedSideScheme(
    s: GameState,
    id: string,
    playerId: string,
    after: Effect[],
  ): void;
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
  /** Move the SAME confirmed defeated ally from its actual post-defeat zone
   * (including Victory or Regroup hand) into actual in-play OZT.captured.
   * Preserve owner/controller provenance; never defeat/discard it again or
   * clone it. Missing source/destination resolves as far as possible. */
  captureDefeatedAlly(
    s: GameState,
    schemeId: string,
    ally: ZeroToleranceAllyDefeatReceipt,
    after: Effect[],
  ): void;
  lose(s: GameState, reason: string): void;
}
type TextPorts = Pick<ZeroTolerancePorts, "isTextBlank">;

/** The live main scheme grants Permanent to the actual OZT in play. OZT's
 * own text blanking cannot suppress this external source's grant. */
export function zeroToleranceIsPermanent(
  s: GameState,
  p = s.sideSchemes.find((p) => p.code === "32104"),
): boolean {
  return (
    !!p &&
    p.code === "32104" &&
    s.sideSchemes.some((a) => a.id === p.id && a.code === "32104") &&
    s.scheme.code === "32087b" &&
    !isTextBlank(s, { ...s.scheme, id: "main" })
  );
}
export const zeroToleranceLossThreshold = (s: GameState) => 3 + s.playerCount;
/** Alternate loss conditions cannot be blanked/canceled (RRG1.8 Winning the
 * Game). Check continuously, immediately after every actual capture commit. */
export function zeroToleranceCheckLoss(
  s: GameState,
  ports: Pick<ZeroTolerancePorts, "lose">,
): boolean {
  if (["won", "lost"].includes(s.phase)) return false;
  const scheme = s.sideSchemes.find(
    (p) =>
      p.code === "32104" &&
      (p.captured || []).length >= zeroToleranceLossThreshold(s),
  );
  if (!scheme) return false;
  ports.lose(
    s,
    `Operation Zero Tolerance has ${scheme.captured!.length} facedown cards. The players lose.`,
  );
  return true;
}
export function zeroToleranceBarrierSources(
  s: GameState,
  minionId: string,
  ports: TextPorts = textPorts,
): ZeroToleranceSourceReceipt[] {
  return s.attachments
    .filter((p) => p.code === "32103" && p.attachedTo === minionId)
    .map((p) => ({
      sourceId: p.id,
      code: p.code,
      textBlank: ports.isTextBlank(s, p),
    }));
}
export function zeroToleranceSchemeSources(
  s: GameState,
  ports: TextPorts = textPorts,
): ZeroToleranceSourceReceipt[] {
  return s.sideSchemes
    .filter((p) => p.code === "32104")
    .map((p) => ({
      sourceId: p.id,
      code: p.code,
      textBlank: ports.isTextBlank(s, p),
    }));
}
/** Ordinary revealed Barrier attach-to instructions, including any other
 * actual Energy Barrier already attached. Blank attached cards still exist. */
export function zeroToleranceBarrierTargets(
  s: GameState,
  ports: Pick<ZeroTolerancePorts, "hasTrait">,
): Piece[] {
  const attached = [...s.attachments, ...allInPlay(s)];
  return s.minions.filter(
    (p) =>
      ports.hasTrait(s, p.id, "Sentinel") &&
      !attached.some(
        (a) =>
          a.attachedTo === p.id &&
          definitions.get(a.code)?.name === "Energy Barrier",
      ),
  );
}
/** Printed +2 ATK is handled once by native enemyAttachmentModifier. It is
 * outside the text box and remains when Barrier's printed abilities blank. */
export function zeroToleranceReveal(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "32101")
    return [
      Z("mark-ii", {
        sourceId: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32102")
    return [
      Z("mark-iii-search", {
        minionId: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32103")
    return [Z("barrier", { id: p.id, actorId: s.activePlayerId })];
  return [];
}
export function zeroToleranceBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  return p.code === "32102"
    ? [
        Z("mark-iii-boost", {
          sourceId: p.id,
          playerId: s.activePlayerId,
          actorId: s.activePlayerId,
        }),
      ]
    : [];
}
export function zeroToleranceAfterAttack(
  s: GameState,
  receipt: ZeroToleranceAttackReceipt,
  ports: TextPorts = textPorts,
): Effect[] {
  if (!receipt.performed) return [];
  const effects: Effect[] = [];
  for (const source of receipt.barrierSources ||
    zeroToleranceBarrierSources(s, receipt.attackerId, ports))
    if (source.code === "32103" && !source.textBlank)
      effects.push(
        Z("barrier-after", {
          sourceId: source.sourceId,
          minionId: receipt.attackerId,
          token: receipt.token,
          actorId: receipt.playerId,
          mandatory: true,
        }),
      );
  if (receipt.enemyAttack)
    for (const source of receipt.schemeSources ||
      zeroToleranceSchemeSources(s, ports))
      if (source.code === "32104" && !source.textBlank)
        for (const ally of receipt.defeatedAllies)
          if (
            ally.actualAlly &&
            definitions.get(ally.code)?.type_code === "ally"
          )
            effects.push(
              Z("capture", {
                schemeId: source.sourceId,
                ally,
                token: receipt.token,
                actorId: receipt.playerId,
                mandatory: true,
              }),
            );
  return effects;
}
const searched = (s: GameState, code: string) =>
  [...s.encounter.deck, ...s.encounter.discard].filter((p) => p.code === code);

export function resolveZeroToleranceEffect(
  s: GameState,
  e: Effect,
  ports: ZeroTolerancePorts,
): boolean {
  if (!e.type.startsWith("zero-tolerance:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "zero-tolerance:mark-ii":
      if (s.sideSchemes.some((p) => p.code === "32104"))
        ports.queue(
          s,
          E("surge", { sourceCode: "32101", actorId: e.playerId }),
          ...after,
        );
      else
        ports.queue(
          s,
          Z("scheme-search", {
            playerId: e.playerId,
            actorId: e.playerId,
            after,
          }),
        );
      break;
    case "zero-tolerance:scheme-search": {
      ports.revealHidden(s);
      const choices = searched(s, "32104");
      if (choices.length)
        ports.choose(
          s,
          "Sentinel Mark II",
          "Search for Operation Zero Tolerance and reveal it.",
          choices.map((p) =>
            O(
              p.id,
              "Operation Zero Tolerance",
              [
                Z("scheme-reveal", {
                  id: p.id,
                  playerId: e.playerId,
                  actorId: e.playerId,
                  after,
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
    case "zero-tolerance:scheme-reveal":
      need(
        searched(s, "32104").some((p) => p.id === e.id),
        "Reveal the actual searched Operation Zero Tolerance.",
      );
      ports.revealSearchedSideScheme(s, e.id, e.playerId, [
        Z("search-finish", { actorId: e.playerId, after }),
      ]);
      break;
    case "zero-tolerance:mark-iii-search": {
      ports.revealHidden(s);
      const choices = searched(s, "32103");
      if (choices.length && s.minions.some((p) => p.id === e.minionId))
        ports.choose(
          s,
          "Sentinel Mark III",
          "Search for Energy Barrier and attach it to this minion.",
          choices.map((p) =>
            O(
              p.id,
              "Energy Barrier",
              [
                Z("mark-iii-attach", {
                  id: p.id,
                  minionId: e.minionId,
                  actorId: e.playerId,
                  after,
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
    case "zero-tolerance:mark-iii-attach":
      need(
        searched(s, "32103").some((p) => p.id === e.id),
        "Attach the actual searched Energy Barrier.",
      );
      if (s.minions.some((p) => p.id === e.minionId))
        ports.attachBarrier(s, e.id, e.minionId, [
          Z("search-finish", { after }),
        ]);
      else {
        ports.shuffleEncounter(s);
        ports.queue(s, ...after);
      }
      break;
    case "zero-tolerance:search-finish":
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    case "zero-tolerance:mark-iii-boost": {
      const target = `hero:${e.playerId}`;
      if (ports.hasStatus(s, target, "stunned"))
        ports.damage(s, target, 2, e.sourceId, after);
      else {
        ports.addStatus(s, target, "stunned");
        ports.queue(s, ...after);
      }
      break;
    }
    case "zero-tolerance:barrier": {
      const targets = zeroToleranceBarrierTargets(s, ports);
      if (targets.length)
        ports.choose(
          s,
          "Energy Barrier",
          "Attach to a Sentinel minion without Energy Barrier and give it Tough.",
          targets.map((p) =>
            O(
              p.id,
              definitions.get(p.code)?.name || p.code,
              [
                Z("barrier-attach", {
                  id: e.id,
                  minionId: p.id,
                  actorId: s.activePlayerId,
                  after,
                }),
              ],
              p.code,
            ),
          ),
        );
      else
        ports.queue(
          s,
          E("surge", { sourceCode: "32103", actorId: s.activePlayerId }),
          ...after,
        );
      break;
    }
    case "zero-tolerance:barrier-attach":
      need(
        zeroToleranceBarrierTargets(s, ports).some((p) => p.id === e.minionId),
        "Energy Barrier requires the actual eligible Sentinel minion.",
      );
      ports.attachBarrier(s, e.id, e.minionId, [
        Z("barrier-tough", { minionId: e.minionId, after }),
      ]);
      break;
    case "zero-tolerance:barrier-tough":
      ports.addStatus(s, e.minionId, "tough");
      ports.queue(s, ...after);
      break;
    case "zero-tolerance:barrier-after": {
      const key = reactionKey(e.token, e.sourceId, "barrier");
      if (!reactionFlags(s)[key]) {
        reactionFlags(s)[key] = true;
        ports.addStatus(s, e.minionId, "tough");
      }
      ports.queue(s, ...after);
      break;
    }
    case "zero-tolerance:capture": {
      const key = reactionKey(e.token, e.schemeId, `capture:${e.ally.id}`);
      if (reactionFlags(s)[key]) {
        ports.queue(s, ...after);
        break;
      }
      reactionFlags(s)[key] = true;
      if (s.sideSchemes.some((p) => p.code === "32104" && p.id === e.schemeId))
        ports.captureDefeatedAlly(s, e.schemeId, e.ally, [
          Z("check-loss", { after }),
        ]);
      else ports.queue(s, ...after);
      break;
    }
    case "zero-tolerance:check-loss":
      zeroToleranceCheckLoss(s, ports);
      if (!["won", "lost"].includes(s.phase)) ports.queue(s, ...after);
      break;
    default:
      throw Error(`Unknown Zero Tolerance effect: ${e.type}`);
  }
  return true;
}
