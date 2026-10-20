import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mastermold:${name}`,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const villainCodes = ["32109", "32110", "32111"];
export const MASTER_MOLD_SET = "master_mold";
export const MASTER_MOLD_SCRIPT_CODES = [
  "32109",
  "32110",
  "32111",
  "32112a",
  "32112b",
  "32113a",
  "32113b",
  "32114",
  "32115",
  "32116",
  "32117",
  "32118",
  "32119",
  "32120",
  "32172b",
] as const;

/** Metadata only: Magneto occupies an ordinary controlled-ally zone, or the
 * first player's set-aside zone if a matching unique card prevents entry. */
export interface MasterMoldState {
  magnetoId?: string;
  handledSchemes: string[];
  handledEngagements: string[];
  handledAttackResponses: string[];
  usedMagnetoResponses: string[];
}
export type MasterMoldGameState = GameState & { masterMold?: MasterMoldState };
export interface MasterMoldSchemeReceipt {
  token: string;
  enemyId: string;
  enemyCode: string;
  playerId: string;
  /** Confuse or another replacement already canceled the activation if false. */
  performed: boolean;
}
export interface MasterMoldEngagementReceipt {
  token: string;
  minionId: string;
  playerId: string;
}
export interface MasterMoldEnemyAttackReceipt {
  token: string;
  enemyId: string;
  enemyCode: string;
  performed: boolean;
  /** Actual attack damage only, including Overkill, after all prevention.
   * Separate boost abilities and indirect damage never enter this receipt. */
  damagedTargets: { targetId: string; actualDamage: number }[];
}
export interface MasterMoldAllyAttackReceipt {
  token: string;
  allyId: string;
  allyCode: string;
  playerId: string;
  performed: boolean;
  /** Snapshot of the actual attack defeat and defeated minion's current traits. */
  defeatedSentinelMinion: boolean;
}
export interface MasterMoldPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Pick<Piece, "code"> & { id?: string }): boolean;
  hasTrait(s: GameState, targetId: string, trait: string): boolean;
  isEngagedWith(s: GameState, minion: Piece, playerId: string): boolean;
  findPiece(s: GameState, id: string): Piece | undefined;
  findAlly(
    s: GameState,
    id: string,
  ): { piece: Piece; playerId: string } | undefined;
  /** Move the same original-source ally through native unique/entry windows. */
  putMagneto(s: GameState, p: Piece, playerId: string): void;
  transferAllyControl(s: GameState, id: string, playerId: string): void;
  healAlly(s: GameState, id: string, amount: number, sourceId: string): void;
  /** Actual native discard; emptied marks the first exhaustion boundary even
   * if native recycle has already moved the final card into a new deck. */
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** Take this same-ID instance from deck/discard. PUT retains entry keywords
   * and engagement windows, never When Revealed. Resolve those before after. */
  putMinion(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  /** Shuffle the entire actual discard into deck without an exhaustion token. */
  shuffleEncounterDiscard(s: GameState): void;
  /** Move the same physical attachment, without its reveal/boost ability.
   * boost=true retains its source on the current activation for cleanup. */
  attach(s: GameState, p: Piece, targetId: string, boost: boolean): void;
  activateEnemy(
    s: GameState,
    enemyId: string,
    playerId: string,
    kind: "attack" | "scheme",
    sourceId: string,
  ): void;
  /** Return true only when a tough status was actually placed. */
  giveTough(s: GameState, id: string): boolean;
  surge(
    s: GameState,
    playerId: string,
    sourceId: string,
    sourceCode: string,
  ): void;
  damageBatch(
    s: GameState,
    targets: { id: string; amount: number }[],
    sourceId: string,
    playerId: string,
  ): void;
  stun(s: GameState, targetId: string, sourceId: string): void;
}
type TextPorts = Pick<MasterMoldPorts, "isTextBlank">;
type TraitPorts = Pick<MasterMoldPorts, "hasTrait">;
const saved = (s: GameState) => (s as MasterMoldGameState).masterMold;
const known = (p: Pick<Piece, "code">) =>
  (MASTER_MOLD_SCRIPT_CODES as readonly string[]).includes(p.code);
const active = (s: GameState) =>
  s.villainId === MASTER_MOLD_SET && villainCodes.includes(s.villain.code);
const firstPlayer = (s: GameState) => playerOrder(s)[0]?.id;

export function masterMoldInitialize(s: GameState): MasterMoldState {
  const state =
    saved(s) ||
    ((s as MasterMoldGameState).masterMold = {
      handledSchemes: [],
      handledEngagements: [],
      handledAttackResponses: [],
      usedMagnetoResponses: [],
    });
  state.handledSchemes ||= [];
  state.handledEngagements ||= [];
  state.handledAttackResponses ||= [];
  state.usedMagnetoResponses ||= [];
  return state;
}
export function masterMoldSetup(
  s: GameState,
  magneto: Piece,
  ports: MasterMoldPorts,
): void {
  need(
    active(s),
    "Master Mold setup requires the native Master Mold scenario.",
  );
  need(
    magneto.code === "32172b",
    "Master Mold setup requires the actual Magneto Ally (172B).",
  );
  const state = masterMoldInitialize(s);
  if (state.magnetoId) {
    need(
      state.magnetoId === magneto.id,
      "Magneto already has a different physical ID.",
    );
    return;
  }
  const first = firstPlayer(s);
  need(first, "Master Mold setup needs a surviving first player.");
  state.magnetoId = magneto.id;
  delete magneto.ownerId;
  ports.putMagneto(s, magneto, first!);
}
export function masterMoldMagnetoCountsAgainstAllyLimit(
  s: GameState,
  p: Piece,
  ports: TextPorts,
): boolean {
  return p.code !== "32172b" || ports.isTextBlank(s, p);
}
export function masterMoldFirstPlayerChanged(
  s: GameState,
  ports: Pick<
    MasterMoldPorts,
    "findAlly" | "isTextBlank" | "transferAllyControl"
  >,
): void {
  const id = saved(s)?.magnetoId;
  const ally = id ? ports.findAlly(s, id) : undefined;
  const next = firstPlayer(s);
  if (
    ally &&
    next &&
    ally.playerId !== next &&
    !ports.isTextBlank(s, ally.piece)
  )
    ports.transferAllyControl(s, ally.piece.id, next);
}
export function masterMoldMainThreatLimit(s: GameState): number | undefined {
  return s.scheme.code === "32112b"
    ? 6 * s.playerCount
    : s.scheme.code === "32113b"
      ? 8 * s.playerCount
      : undefined;
}
export function masterMoldSideSchemeBaseThreat(
  s: GameState,
  p: Pick<Piece, "code">,
): number | undefined {
  return p.code === "32119"
    ? 3 * s.playerCount
    : p.code === "32120"
      ? 2
      : undefined;
}
export function masterMoldMainRevealed(s: GameState, code: string): Effect[] {
  if (code === "32112b")
    return [M("mill-each", { sourceId: code, actorId: firstPlayer(s) })];
  if (code === "32113a")
    return [M("agenda", { sourceId: code, actorId: firstPlayer(s) })];
  return [];
}
export function masterMoldSuppressesBoost(
  s: GameState,
  receipt: MasterMoldSchemeReceipt,
  ports: TextPorts,
): boolean {
  return (
    active(s) &&
    receipt.performed &&
    !!receipt.token &&
    receipt.enemyId === s.villain.id &&
    receipt.enemyCode === s.villain.code &&
    villainCodes.includes(receipt.enemyCode) &&
    !ports.isTextBlank(s, s.villain)
  );
}
export function masterMoldBeforeScheme(
  s: GameState,
  receipt: MasterMoldSchemeReceipt,
  ports: TextPorts,
): Effect[] {
  return masterMoldSuppressesBoost(s, receipt, ports) &&
    !saved(s)?.handledSchemes.includes(receipt.token)
    ? [
        M("scheme-interrupt", {
          receipt,
          actorId: receipt.playerId,
          mandatory: true,
          forced: true,
        }),
      ]
    : [];
}
export function masterMoldModifiers(
  s: GameState,
  p: Piece,
  ports: TextPorts & TraitPorts,
) {
  const live = s.minions.some((m) => m.id === p.id);
  const attachments = live
    ? s.attachments.filter(
        (a) => a.attachedTo === p.id && !ports.isTextBlank(s, a),
      )
    : [];
  return {
    guard:
      live &&
      ["32112b", "32113b"].includes(s.scheme.code) &&
      !ports.isTextBlank(s, { code: s.scheme.code, id: "main" }) &&
      ports.hasTrait(s, p.id, "Sentinel"),
    health: attachments.filter((a) => a.code === "32115").length * 2,
    retaliate: attachments.filter((a) => a.code === "32115").length,
  };
}
export function masterMoldMinionEngaged(
  s: GameState,
  receipt: MasterMoldEngagementReceipt,
  ports: TextPorts,
): Effect[] {
  const minion = s.minions.find(
    (p) => p.id === receipt.minionId && p.code === "32114",
  );
  return minion &&
    receipt.token &&
    !ports.isTextBlank(s, minion) &&
    !saved(s)?.handledEngagements.includes(receipt.token)
    ? [
        M("mark-viii", {
          receipt,
          actorId: receipt.playerId,
          mandatory: true,
          forced: true,
        }),
      ]
    : [];
}
/** Ordinary printed Attach To restrictions apply only to this ability. Mark
 * VIII's separate direct attachment bypasses the entire Attach To phrase. */
export function masterMoldAttachmentTargets(
  s: GameState,
  attachment: Piece,
  ports: TraitPorts,
): Piece[] {
  if (!["32115", "32116"].includes(attachment.code)) return [];
  return s.minions.filter(
    (p) =>
      ports.hasTrait(s, p.id, "Sentinel") &&
      (attachment.code !== "32116" ||
        !s.attachments.some(
          (a) => a.code === "32116" && a.attachedTo === p.id,
        )),
  );
}
export function masterMoldReveal(
  s: GameState,
  p: Piece,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (["32112b", "32113a"].includes(p.code))
    return masterMoldMainRevealed(s, p.code);
  if (["32115", "32116"].includes(p.code))
    return [
      M("attachment", { id: p.id, boost: false, actorId: s.activePlayerId }),
    ];
  if (p.code === "32117")
    return [
      M("children", {
        sourceId: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32118")
    return [
      M("shields", {
        sourceId: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  return [];
}
export function masterMoldBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === "32115")
    return [
      M("attachment", { id: p.id, boost: true, actorId: s.activePlayerId }),
    ];
  if (p.code === "32118")
    return [M("villain-tough", { actorId: s.activePlayerId })];
  return [];
}
export function masterMoldSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "32119")
    return [M("mill", { sourceId: p.id, playerId, actorId: playerId })];
  if (p.code === "32120")
    return [M("virus", { sourceId: p.id, playerId, actorId: playerId })];
  return [];
}
export function masterMoldAfterEnemyAttack(
  s: GameState,
  receipt: MasterMoldEnemyAttackReceipt,
  ports: TextPorts,
): Effect[] {
  if (
    !receipt.performed ||
    !receipt.token ||
    !receipt.damagedTargets.some((t) => t.actualDamage > 0)
  )
    return [];
  return s.attachments
    .filter(
      (p) =>
        p.code === "32116" &&
        p.attachedTo === receipt.enemyId &&
        !ports.isTextBlank(s, p) &&
        !saved(s)?.handledAttackResponses.includes(`${p.id}:${receipt.token}`),
    )
    .map((p) =>
      M("stun-beam", {
        id: p.id,
        receipt,
        actorId: firstPlayer(s),
        mandatory: true,
        forced: true,
      }),
    );
}
export function masterMoldAllyAttackResponseOptions(
  s: GameState,
  receipt: MasterMoldAllyAttackReceipt,
  ports: Pick<MasterMoldPorts, "findAlly" | "isTextBlank">,
): Option[] {
  const ally = ports.findAlly(s, receipt.allyId);
  const key = `${receipt.allyId}:${receipt.token}`;
  return receipt.token &&
    receipt.performed &&
    receipt.defeatedSentinelMinion &&
    receipt.allyCode === "32172b" &&
    ally &&
    ally.piece.code === receipt.allyCode &&
    ally.playerId === receipt.playerId &&
    ally.piece.damage > 0 &&
    !ports.isTextBlank(s, ally.piece) &&
    !saved(s)?.usedMagnetoResponses.includes(key)
    ? [
        {
          id: `mastermold-magneto:${key}`,
          label: "Magneto · heal 1 damage",
          image: "32172b",
          effects: [M("magneto-heal", { receipt, actorId: receipt.playerId })],
        },
      ]
    : [];
}

export function resolveMasterMoldEffect(
  s: GameState,
  e: Effect,
  ports: MasterMoldPorts,
): boolean {
  if (!e.type.startsWith("mastermold:")) return false;
  switch (e.type) {
    case "mastermold:agenda":
      ports.shuffleEncounterDiscard(s);
      ports.queue(
        s,
        M("mill-each", { sourceId: e.sourceId, actorId: firstPlayer(s) }),
      );
      break;
    case "mastermold:mill-each":
      ports.queue(
        s,
        M("mill-order", {
          sourceId: e.sourceId,
          remaining: playerOrder(s).map((p) => p.id),
          actorId: firstPlayer(s),
        }),
      );
      break;
    case "mastermold:mill-order": {
      const remaining = (e.remaining as string[]).filter((id) =>
        s.players.some((p) => p.id === id && !p.eliminated),
      );
      if (!remaining.length) break;
      const effects = (playerId: string) => [
        M("mill", {
          sourceId: e.sourceId,
          playerId,
          actorId: playerId,
          after: [
            M("mill-order", {
              sourceId: e.sourceId,
              remaining: remaining.filter((id) => id !== playerId),
              actorId: firstPlayer(s),
            }),
          ],
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...effects(remaining[0]));
      else
        ports.choose(
          s,
          "Master Mold · each player",
          "The first player chooses which player resolves next.",
          remaining.map((id) => ({
            id,
            label: s.players.find((p) => p.id === id)!.heroId,
            effects: effects(id),
          })),
        );
      break;
    }
    case "mastermold:mill": {
      const { piece, emptied } = ports.discardTop(s);
      if (
        piece &&
        cards.get(piece.code)?.type_code === "minion" &&
        (cards.get(piece.code)?.traits || "")
          .split(/\.\s*/)
          .some((trait) => trait.toLowerCase() === "sentinel")
      )
        ports.putMinion(s, piece, e.playerId, e.after || []);
      else if (piece && !emptied)
        ports.queue(s, M("mill", { ...e, type: "mastermold:mill" }));
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "mastermold:scheme-interrupt": {
      const receipt = e.receipt as MasterMoldSchemeReceipt;
      const state = masterMoldInitialize(s);
      if (state.handledSchemes.includes(receipt.token)) break;
      state.handledSchemes.push(receipt.token);
      ports.queue(
        s,
        M("mill", {
          sourceId: receipt.enemyId,
          playerId: receipt.playerId,
          actorId: receipt.playerId,
        }),
      );
      break;
    }
    case "mastermold:mark-viii": {
      const receipt = e.receipt as MasterMoldEngagementReceipt;
      const state = masterMoldInitialize(s);
      if (state.handledEngagements.includes(receipt.token)) break;
      state.handledEngagements.push(receipt.token);
      const minion = s.minions.find(
        (p) => p.id === receipt.minionId && p.code === "32114",
      );
      if (!minion) break;
      const top = [...s.encounter.discard]
        .reverse()
        .find(
          (p) =>
            cards.get(p.code)?.type_code === "attachment" &&
            (cards.get(p.code)?.traits || "")
              .split(/\.\s*/)
              .some((trait) => trait.toLowerCase() === "sentinel"),
        );
      if (top) ports.attach(s, top, minion.id, false);
      break;
    }
    case "mastermold:attachment": {
      const p = ports.findPiece(s, e.id);
      if (!p) break;
      const targets = masterMoldAttachmentTargets(s, p, ports);
      if (!targets.length) {
        if (!e.boost) ports.surge(s, s.activePlayerId, p.id, p.code);
      } else if (targets.length === 1)
        ports.attach(s, p, targets[0].id, !!e.boost);
      else
        ports.choose(
          s,
          cards.get(p.code)!.name,
          "Choose a Sentinel minion to attach this card to.",
          targets.map((target) => ({
            id: target.id,
            label: `${cards.get(target.code)?.name || target.code} · ${target.id}`,
            effects: [
              M("attach-chosen", {
                id: p.id,
                targetId: target.id,
                boost: !!e.boost,
                actorId: s.activePlayerId,
              }),
            ],
          })),
        );
      break;
    }
    case "mastermold:attach-chosen": {
      const p = ports.findPiece(s, e.id);
      need(
        p &&
          masterMoldAttachmentTargets(s, p, ports).some(
            (t) => t.id === e.targetId,
          ),
        "The selected Sentinel can no longer receive this attachment.",
      );
      ports.attach(s, p!, e.targetId, !!e.boost);
      break;
    }
    case "mastermold:children": {
      const seat = s.players.find((p) => p.id === e.playerId && !p.eliminated);
      if (!seat) break;
      const ids = s.minions
        .filter((p) => ports.isEngagedWith(s, p, e.playerId))
        .map((p) => p.id);
      const kind =
        seatView(s, seat).player.form === "hero" ? "attack" : "scheme";
      if (!ids.length)
        ports.activateEnemy(s, s.villain.id, e.playerId, kind, e.sourceId);
      else
        ports.queue(
          s,
          M("children-order", {
            ...e,
            type: "mastermold:children-order",
            remaining: ids,
            kind,
          }),
        );
      break;
    }
    case "mastermold:children-order": {
      const remaining = (e.remaining as string[]).filter((id) =>
        s.minions.some((p) => p.id === id),
      );
      if (!remaining.length) break;
      const effects = (id: string) => [
        M("children-activate", {
          id,
          playerId: e.playerId,
          kind: e.kind,
          sourceId: e.sourceId,
          actorId: e.playerId,
        }),
        M("children-order", {
          ...e,
          type: "mastermold:children-order",
          remaining: remaining.filter((p) => p !== id),
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...effects(remaining[0]));
      else
        ports.choose(
          s,
          "Master Mold's Children",
          "Choose the next engaged minion to activate.",
          remaining.map((id) => ({
            id,
            label: `${cards.get(s.minions.find((p) => p.id === id)!.code)?.name || id} · ${id}`,
            effects: effects(id),
          })),
        );
      break;
    }
    case "mastermold:children-activate":
      if (s.minions.some((p) => p.id === e.id))
        ports.activateEnemy(s, e.id, e.playerId, e.kind, e.sourceId);
      break;
    case "mastermold:shields": {
      let placed = false;
      for (const p of s.minions.filter(
        (p) =>
          ports.isEngagedWith(s, p, e.playerId) &&
          ports.hasTrait(s, p.id, "Sentinel"),
      ))
        placed = ports.giveTough(s, p.id) || placed;
      if (!placed) ports.surge(s, e.playerId, e.sourceId, "32118");
      break;
    }
    case "mastermold:villain-tough":
      ports.giveTough(s, s.villain.id);
      break;
    case "mastermold:virus":
      ports.damageBatch(
        s,
        [s.villain, ...s.minions]
          .filter((p) => ports.hasTrait(s, p.id, "Sentinel"))
          .map((p) => ({ id: p.id, amount: 2 })),
        e.sourceId,
        e.playerId,
      );
      break;
    case "mastermold:stun-beam": {
      const receipt = e.receipt as MasterMoldEnemyAttackReceipt;
      const key = `${e.id}:${receipt.token}`;
      const state = masterMoldInitialize(s);
      if (state.handledAttackResponses.includes(key)) break;
      state.handledAttackResponses.push(key);
      for (const id of new Set(
        receipt.damagedTargets
          .filter((t) => t.actualDamage > 0)
          .map((t) => t.targetId),
      ))
        ports.stun(s, id, e.id);
      break;
    }
    case "mastermold:magneto-heal": {
      const receipt = e.receipt as MasterMoldAllyAttackReceipt;
      need(
        masterMoldAllyAttackResponseOptions(s, receipt, ports).length,
        "Magneto cannot heal from this attack.",
      );
      masterMoldInitialize(s).usedMagnetoResponses.push(
        `${receipt.allyId}:${receipt.token}`,
      );
      ports.healAlly(s, receipt.allyId, 1, receipt.allyId);
      break;
    }
    default:
      throw Error(`Unknown Master Mold effect: ${e.type}`);
  }
  return true;
}
