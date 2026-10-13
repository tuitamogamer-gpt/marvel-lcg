import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const W = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `wideawake:${name}`,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const villainCodes = ["32084", "32085", "32086"];
const captiveCodes = ["32089", "32090", "32091", "32092"];
const attachmentResources: Record<string, Resource> = {
  "32094": "physical",
  "32095": "mental",
  "32096": "energy",
};
export const PROJECT_WIDEAWAKE_SET = "project_wideawake";
export const PROJECT_WIDEAWAKE_SCRIPT_CODES = [
  "32084",
  "32085",
  "32086",
  "32087a",
  "32087b",
  "32088a",
  "32088b",
  "32089",
  "32090",
  "32091",
  "32092",
  "32093",
  "32094",
  "32095",
  "32096",
  "32097",
  "32098",
  "32099",
  "32100",
] as const;

export interface WideawakeBombReceipt {
  token: string;
  sourceId: string;
  playerId: string;
}
/** Only setAsideCaptives owns physical pieces. Jubilee lives in one seat's
 * ordinary inPlay, and OZT's facedown physical cards live in Piece.captured. */
export interface ProjectWideawakeState {
  setAsideCaptives: Piece[];
  setupIds?: { captives: string[]; mall: string; operation: string };
  captureAllocation: number[];
  setupCapturesResolved: boolean;
  handledSetupCaptures: string[];
  jubileeId?: string;
  bombs: { enemyId: string; count: number }[];
  delayedBombs: WideawakeBombReceipt[];
  usedAllyResponses: string[];
  handledThreatTokens: string[];
  handledTurnTokens: string[];
}
export type ProjectWideawakeGameState = GameState & {
  projectWideawake?: ProjectWideawakeState;
};
export interface WideawakeThreatReceipt {
  token: string;
  schemeCode: string;
  /** The exact positive amount actually placed, AFTER all prevention. */
  actualAmount: number;
  /** Snapshot immediately after this placement, before any response. */
  threatAfter: number;
}
export interface WideawakeAllyAttackReceipt {
  token: string;
  allyId: string;
  allyCode: string;
  playerId: string;
  performed: boolean;
  targetId: string;
  targetCode: string;
  /** Actual attack-damage defeat, never inferred from a missing target. */
  defeatedMinion: boolean;
}
export interface ProjectWideawakePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Pick<Piece, "code"> & { id?: string }): boolean;
  findPiece(s: GameState, id: string): Piece | undefined;
  findAlly(
    s: GameState,
    id: string,
  ): { piece: Piece; playerId: string } | undefined;
  /** Native REVEAL of this same setup piece, including all reveal/Hinder
   * windows. Caller extracts physical setup pieces before calling setup. */
  revealSetupSideScheme(s: GameState, p: Piece, after: Effect[]): void;
  /** Search actual encounter deck/discard, choose among actual matches,
   * REVEAL the selected same-ID card for playerId, then shuffle. */
  searchAndRevealSideScheme(
    s: GameState,
    code: string,
    playerId: string,
    after: Effect[],
  ): void;
  searchAndRevealMinion(
    s: GameState,
    trait: string,
    playerId: string,
    after: Effect[],
  ): void;
  /** Native same-piece flip/entry; no encounter discard or new Jubilee. */
  flipMallToJubilee(s: GameState, p: Piece, playerId: string): void;
  discardOtherJubilees(s: GameState, exceptId: string): void;
  transferAllyControl(s: GameState, id: string, playerId: string): void;
  /** Assign the rescued player's physical ownership, then ordinary native
   * PUT/uniqueness/ally-limit entry. It becomes part of that owner's deck. */
  putAlly(s: GameState, p: Piece, playerId: string): void;
  randomIndex(s: GameState, length: number): number;
  canCapturePlayerTop(s: GameState, playerId: string): boolean;
  /** Same-ID facedown tuck under actual OZT. Includes player-deck exhaustion,
   * recycling/dealt encounter windows, then after. Each after effect receives
   * captured:boolean for the actual physical tuck. Never reveals its face. */
  capturePlayerTop(
    s: GameState,
    playerId: string,
    sourceId: string,
    after: Effect[],
  ): void;
  captureCard(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  removeMainThreat(s: GameState, amount: number, sourceId: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  /** Explicit native attack, also when the target is in alter-ego form. */
  enemyAttack(
    s: GameState,
    enemyId: string,
    playerId: string,
    sourceId: string,
  ): void;
  /** These controlled-ally abilities deal unlabelled player-card damage;
   * neither Jubilee nor Rictor's response nor bombs initiate an attack. */
  damageBatch(
    s: GameState,
    targets: { id: string; amount: number }[],
    sourceId: string,
    playerId: string,
  ): void;
  enemyTargets(s: GameState): { id: string; label: string }[];
  canExhaust(s: GameState, id: string): boolean;
  exhaust(s: GameState, id: string): void;
  canPay(s: GameState, cost: number, requirements?: Resource[]): boolean;
  /** Native typed/wild payment/cancellation. commit is an additional cost
   * committed with resources BEFORE resource-spend responses open. */
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    sourceId: string,
    commit?: Effect[],
  ): void;
  attach(s: GameState, p: Piece, target: string, boost: boolean): void;
  putBoostMinion(s: GameState, p: Piece, playerId: string): void;
  discardPiece(s: GameState, id: string): void;
  clearVillainStatuses(s: GameState): void;
  giveVillainTough(s: GameState): void;
  healVillain(s: GameState, amount: number, sourceId: string): void;
}

const state = (s: GameState) =>
  (s as ProjectWideawakeGameState).projectWideawake;
const active = (s: GameState) =>
  s.villainId === PROJECT_WIDEAWAKE_SET &&
  villainCodes.includes(s.villain.code);
const known = (p: Pick<Piece, "code">) =>
  (PROJECT_WIDEAWAKE_SCRIPT_CODES as readonly string[]).includes(p.code);
const firstPlayer = (s: GameState) => playerOrder(s)[0]?.id;

export function projectWideawakeInitialize(
  s: GameState,
): ProjectWideawakeState {
  const saved = state(s);
  if (saved) {
    saved.setAsideCaptives ||= [];
    saved.captureAllocation ||= [];
    saved.setupCapturesResolved ??= false;
    saved.handledSetupCaptures ||= [];
    saved.bombs ||= [];
    saved.delayedBombs ||= [];
    saved.usedAllyResponses ||= [];
    saved.handledThreatTokens ||= [];
    saved.handledTurnTokens ||= [];
    return saved;
  }
  const created: ProjectWideawakeState = {
    setAsideCaptives: [],
    captureAllocation: [],
    setupCapturesResolved: false,
    handledSetupCaptures: [],
    bombs: [],
    delayedBombs: [],
    usedAllyResponses: [],
    handledThreatTokens: [],
    handledTurnTokens: [],
  };
  (s as ProjectWideawakeGameState).projectWideawake = created;
  return created;
}

export function projectWideawakeSetup(
  s: GameState,
  pieces: { captives: Piece[]; mall: Piece; operation: Piece },
  ports: ProjectWideawakePorts,
  captureAllocation = [
    (s.heroic || 0) > 0 ? 3 : s.difficulty === "expert" ? 2 : 1,
    ...Array(Math.max(0, s.playerCount - 1)).fill(0),
  ] as number[],
): void {
  need(
    active(s),
    "Project Wideawake setup requires the native Sentinel scenario.",
  );
  need(
    pieces.mall.code === "32088a" && pieces.operation.code === "32104",
    "Project Wideawake setup needs the actual Mall and Operation Zero Tolerance pieces.",
  );
  need(
    pieces.captives.length === 4 &&
      captiveCodes.every((code) =>
        pieces.captives.some((p) => p.code === code),
      ),
    "Set aside the four actual original Captive allies.",
  );
  need(
    new Set([
      ...pieces.captives.map((p) => p.id),
      pieces.mall.id,
      pieces.operation.id,
    ]).size === 6,
    "Project Wideawake setup pieces must have distinct physical IDs.",
  );
  need(
    captureAllocation.length === s.playerCount &&
      captureAllocation.every((n) => Number.isInteger(n) && n >= 0) &&
      captureAllocation.reduce((a, b) => a + b, 0) < 3 + s.playerCount,
    "Setup capture allocation needs one nonnegative integer per player and must remain below Operation Zero Tolerance's loss threshold.",
  );
  const saved = projectWideawakeInitialize(s);
  if (saved.setupIds) {
    need(
      saved.setupIds.mall === pieces.mall.id &&
        saved.setupIds.operation === pieces.operation.id &&
        saved.setupIds.captives.every((id) =>
          pieces.captives.some((c) => c.id === id),
        ),
      "Project Wideawake already has different physical setup pieces.",
    );
    return;
  }
  saved.setupIds = {
    captives: pieces.captives.map((p) => p.id),
    mall: pieces.mall.id,
    operation: pieces.operation.id,
  };
  saved.captureAllocation = [...captureAllocation];
  saved.setAsideCaptives.push(...pieces.captives);
  ports.revealSetupSideScheme(s, pieces.operation, [
    W("setup-mall", { piece: pieces.mall, actorId: firstPlayer(s) }),
  ]);
}

/** Called after initial villain When Revealed and before opening draws. This
 * optional difficulty adjustment is a GROUP total, not a per-player default. */
export function projectWideawakeSetupCaptureEffects(s: GameState): Effect[] {
  const saved = state(s);
  if (!saved?.setupIds || saved.setupCapturesResolved) return [];
  saved.setupCapturesResolved = true;
  return s.players.flatMap((player, index) =>
    Array.from({ length: saved.captureAllocation[index] || 0 }, (_, ordinal) =>
      W("setup-capture", { playerId: player.id, ordinal, actorId: player.id }),
    ),
  );
}
export function projectWideawakeBombCount(
  s: GameState,
  enemyId: string,
): number {
  return state(s)?.bombs.find((b) => b.enemyId === enemyId)?.count || 0;
}

/** Unlimited is represented by native zero, never JSON-hostile Infinity. */
export function projectWideawakeMainThreatLimit(
  s: GameState,
): number | undefined {
  return s.scheme.code === "32087b" ? 0 : undefined;
}
export function projectWideawakeGrantsPermanent(
  s: GameState,
  p: Pick<Piece, "code">,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): boolean {
  return (
    s.scheme.code === "32087b" &&
    p.code === "32104" &&
    !ports.isTextBlank(s, { code: "32087b", id: "main" })
  );
}
export function projectWideawakeAfterMainThreatPlaced(
  s: GameState,
  receipt: WideawakeThreatReceipt,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): Effect[] {
  if (
    receipt.schemeCode !== "32087b" ||
    receipt.actualAmount <= 0 ||
    receipt.threatAfter < 5 * s.playerCount ||
    ports.isTextBlank(s, { code: "32087b", id: "main" })
  )
    return [];
  return [
    W("threshold", {
      receipt,
      playerId: firstPlayer(s),
      mandatory: true,
      forced: true,
    }),
  ];
}
export function projectWideawakeJubileeController(
  s: GameState,
  ports: Pick<ProjectWideawakePorts, "findAlly">,
): string | undefined {
  const id = state(s)?.jubileeId;
  return id ? ports.findAlly(s, id)?.playerId : undefined;
}
export function projectWideawakeJubileeCountsAgainstAllyLimit(
  s: GameState,
  p: Piece,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): boolean {
  return p.code !== "32088b" || ports.isTextBlank(s, p);
}
export function projectWideawakeFirstPlayerChanged(
  s: GameState,
  ports: ProjectWideawakePorts,
): void {
  const id = state(s)?.jubileeId;
  const live = id ? ports.findAlly(s, id) : undefined;
  const next = firstPlayer(s);
  if (
    live &&
    next &&
    live.playerId !== next &&
    !ports.isTextBlank(s, live.piece)
  )
    ports.transferAllyControl(s, live.piece.id, next);
}

export function projectWideawakeReveal(
  s: GameState,
  p: Piece,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (villainCodes.includes(p.code))
    return [W("stage-reveal", { stageCode: p.code, actorId: firstPlayer(s) })];
  if (attachmentResources[p.code])
    return [W("attach", { id: p.id, boost: false, actorId: s.activePlayerId })];
  if (p.code === "32097")
    return [W("repair", { id: p.id, actorId: s.activePlayerId })];
  if (p.code === "32098")
    return [
      W("detected", {
        id: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  return [];
}
export function projectWideawakeBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === "32093")
    return [
      W("boost-minion", {
        id: p.id,
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32094")
    return [W("exhaust-identity", { actorId: s.activePlayerId })];
  if (p.code === "32095" || p.code === "32096")
    return [W("attach", { id: p.id, boost: true, actorId: s.activePlayerId })];
  if (p.code === "32097") return [W("tough", { actorId: s.activePlayerId })];
  return [];
}
/** Printed ATK/SCH fields remain native base modifiers. This adds only text. */
export function projectWideawakeModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
) {
  const attachments =
    p.id === s.villain.id
      ? s.attachments.filter(
          (a) => a.attachedTo === p.id && !ports.isTextBlank(s, a),
        )
      : [];
  return {
    health: attachments.filter((a) => a.code === "32096").length * 8,
    retaliate: attachments.filter((a) => a.code === "32095").length,
    piercing: attachments.some((a) => a.code === "32094"),
    ranged: attachments.some((a) => a.code === "32094"),
  };
}

export function projectWideawakeSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "32088a")
    return [
      W("mall", {
        id: p.id,
        playerId: firstPlayer(s),
        actorId: firstPlayer(s),
      }),
    ];
  if (p.code === "32100")
    return [W("rescue", { sourceId: p.id, playerId, actorId: playerId })];
  return [];
}
export function projectWideawakeAllyAttackModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
) {
  return { piercing: p.code === "32092" && !ports.isTextBlank(s, p) };
}
export function projectWideawakeConsequentialReduction(
  s: GameState,
  receipt: WideawakeAllyAttackReceipt,
  ports: Pick<ProjectWideawakePorts, "findAlly" | "isTextBlank">,
): number {
  const ally = ports.findAlly(s, receipt.allyId);
  return receipt.performed &&
    receipt.allyCode === "32091" &&
    receipt.defeatedMinion &&
    ally &&
    ally.piece.code === receipt.allyCode &&
    !ports.isTextBlank(s, ally.piece)
    ? 1
    : 0;
}
export function projectWideawakeAllyAttackResponseOptions(
  s: GameState,
  receipt: WideawakeAllyAttackReceipt,
  ports: Pick<ProjectWideawakePorts, "findAlly" | "isTextBlank">,
): Option[] {
  if (!receipt.performed || !["32089", "32090"].includes(receipt.allyCode))
    return [];
  const ally = ports.findAlly(s, receipt.allyId);
  const key = `${receipt.allyId}:${receipt.token}`;
  if (
    !ally ||
    ally.piece.code !== receipt.allyCode ||
    ally.playerId !== receipt.playerId ||
    ports.isTextBlank(s, ally.piece) ||
    state(s)?.usedAllyResponses.includes(key)
  )
    return [];
  if (
    receipt.allyCode === "32090" &&
    ![s.villain, ...s.minions].some(
      (p) => p.id === receipt.targetId && p.code === receipt.targetCode,
    )
  )
    return [];
  return [
    {
      id: `wideawake-response:${key}`,
      label:
        receipt.allyCode === "32089"
          ? "Rictor · deal 1 damage to the villain and your minions"
          : "Boom Boom · place a bomb counter",
      image: receipt.allyCode,
      effects: [W("ally-response", { receipt, actorId: receipt.playerId })],
    },
  ];
}
export function projectWideawakeEndPlayerPhase(s: GameState): Effect[] {
  const receipts = state(s)?.delayedBombs || [];
  return receipts.length
    ? [W("bomb-window", { receipts: [...receipts], actorId: firstPlayer(s) })]
    : [];
}
export function projectWideawakeEnemyLeftPlay(s: GameState, id: string): void {
  const saved = state(s);
  if (saved) saved.bombs = saved.bombs.filter((b) => b.enemyId !== id);
}
export function projectWideawakeEndPlayerTurn(
  s: GameState,
  playerId: string,
  token: string,
  ports: Pick<ProjectWideawakePorts, "isTextBlank">,
): Effect[] {
  const player = s.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return [];
  return seatView(s, player)
    .player.inPlay.filter(
      (p) =>
        p.code === "32099" &&
        !ports.isTextBlank(s, p) &&
        !state(s)?.handledTurnTokens.includes(`${p.id}:${token}`),
    )
    .map((p) =>
      W("warn-turn", {
        id: p.id,
        playerId,
        token,
        actorId: playerId,
        mandatory: true,
        forced: true,
      }),
    );
}
export function projectWideawakeActionOptions(
  s: GameState,
  id: string,
  ports: ProjectWideawakePorts,
): Option[] {
  const p = ports.findPiece(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  const resource = attachmentResources[p.code];
  if (
    resource &&
    p.attachedTo === s.villain.id &&
    s.attachments.some((a) => a.id === id) &&
    s.player.form === "hero" &&
    ports.canPay(s, 3, [resource, resource, resource])
  )
    return [
      {
        id: `wideawake-attachment:${id}`,
        label: `Discard ${cards.get(p.code)!.name}`,
        image: p.code,
        effects: [W("attachment-action", { id, actorId: s.activePlayerId })],
      },
    ];
  const ally = ports.findAlly(s, id);
  if (
    p.code === "32088b" &&
    ally?.playerId === s.activePlayerId &&
    ports.canExhaust(s, id) &&
    ports.canPay(s, 1, ["energy"]) &&
    ports.enemyTargets(s).length
  )
    return [
      {
        id: `wideawake-jubilee:${id}`,
        label: "Jubilee · exhaust and spend energy to deal 2 damage",
        image: p.code,
        effects: [W("jubilee-action", { id, actorId: s.activePlayerId })],
      },
    ];
  if (
    p.code === "32099" &&
    s.player.form === "alter" &&
    s.player.inPlay.some((a) => a.id === id) &&
    ports.canExhaust(s, "hero")
  )
    return [
      {
        id: `wideawake-warn:${id}`,
        label: "Warn the Others · exhaust your identity to discard",
        image: p.code,
        effects: [W("warn-action", { id, actorId: s.activePlayerId })],
      },
    ];
  return [];
}

export function resolveProjectWideawakeEffect(
  s: GameState,
  e: Effect,
  ports: ProjectWideawakePorts,
): boolean {
  if (!e.type.startsWith("wideawake:")) return false;
  switch (e.type) {
    case "wideawake:setup-mall":
      ports.revealSetupSideScheme(s, e.piece as Piece, []);
      break;
    case "wideawake:stage-reveal": {
      const first = firstPlayer(s);
      if (first)
        ports.searchAndRevealSideScheme(s, "32100", first, [
          W("stage-deal", { stageCode: e.stageCode, firstPlayerId: first }),
        ]);
      break;
    }
    case "wideawake:stage-deal":
      if (e.stageCode !== "32084")
        for (const player of playerOrder(s))
          if (e.stageCode === "32086" || player.id !== e.firstPlayerId)
            ports.dealEncounter(s, player.id);
      ports.queue(s, ...projectWideawakeSetupCaptureEffects(s));
      break;
    case "wideawake:setup-capture": {
      const saved = state(s);
      const key = `${e.playerId}:${e.ordinal}`;
      if (!saved || saved.handledSetupCaptures.includes(key)) break;
      saved.handledSetupCaptures.push(key);
      ports.capturePlayerTop(s, e.playerId, "32087a", []);
      break;
    }
    case "wideawake:threshold": {
      const saved = projectWideawakeInitialize(s);
      const receipt = e.receipt as WideawakeThreatReceipt;
      if (saved.handledThreatTokens.includes(receipt.token)) break;
      saved.handledThreatTokens.push(receipt.token);
      const after = [W("threshold-remove", { amount: 5 * s.playerCount })];
      if (e.playerId) ports.capturePlayerTop(s, e.playerId, "32087b", after);
      else ports.queue(s, ...after.map((e) => ({ ...e, captured: false })));
      break;
    }
    case "wideawake:threshold-remove":
      if (e.captured === true) ports.removeMainThreat(s, e.amount, "32087b");
      break;
    case "wideawake:mall":
      ports.searchAndRevealMinion(s, "Sentinel", e.playerId, [
        W("mall-flip", { id: e.id }),
      ]);
      break;
    case "wideawake:mall-flip": {
      const mall = ports.findPiece(s, e.id);
      const first = firstPlayer(s);
      if (mall?.code === "32088a" && first) {
        ports.discardOtherJubilees(s, mall.id);
        ports.flipMallToJubilee(s, mall, first);
        projectWideawakeInitialize(s).jubileeId = mall.id;
      }
      break;
    }
    case "wideawake:rescue": {
      const saved = state(s);
      const player = s.players.find(
        (p) => p.id === e.playerId && !p.eliminated,
      );
      if (!saved?.setAsideCaptives.length || !player) break;
      const index = ports.randomIndex(s, saved.setAsideCaptives.length);
      need(
        Number.isInteger(index) &&
          index >= 0 &&
          index < saved.setAsideCaptives.length,
        "Captive rescue requires a valid native random index.",
      );
      const [captive] = saved.setAsideCaptives.splice(index, 1);
      ports.putAlly(s, captive, player.id);
      break;
    }
    case "wideawake:attach": {
      const p = ports.findPiece(s, e.id);
      if (p) ports.attach(s, p, s.villain.id, !!e.boost);
      break;
    }
    case "wideawake:boost-minion": {
      const p = ports.findPiece(s, e.id);
      if (p) ports.putBoostMinion(s, p, e.playerId);
      break;
    }
    case "wideawake:exhaust-identity":
      if (ports.canExhaust(s, "hero")) ports.exhaust(s, "hero");
      break;
    case "wideawake:repair":
      ports.clearVillainStatuses(s);
      ports.giveVillainTough(s);
      ports.healVillain(s, 5, e.id);
      break;
    case "wideawake:tough":
      ports.giveVillainTough(s);
      break;
    case "wideawake:detected": {
      const options: Option[] = [];
      if (ports.canCapturePlayerTop(s, e.playerId))
        options.push({
          id: "capture",
          label:
            "Place your deck's top card facedown under Operation Zero Tolerance",
          effects: [
            W("detected-capture", {
              id: e.id,
              playerId: e.playerId,
              actorId: e.playerId,
            }),
          ],
        });
      options.push({
        id: "attacks",
        label: "The villain and all your engaged minions attack you",
        effects: [
          W("detected-attacks", {
            sourceId: e.id,
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        ],
      });
      ports.choose(s, "Mutant Detected", "Choose one option.", options);
      break;
    }
    case "wideawake:detected-capture":
      ports.capturePlayerTop(s, e.playerId, e.id, []);
      break;
    case "wideawake:detected-attacks": {
      const enemies = [
        s.villain,
        ...s.minions.filter(
          (p) => !p.engagedWith || p.engagedWith === e.playerId,
        ),
      ].map((p) => p.id);
      ports.queue(
        s,
        ...enemies.map((id) =>
          W("explicit-attack", {
            id,
            playerId: e.playerId,
            sourceId: e.sourceId,
            actorId: e.playerId,
          }),
        ),
      );
      break;
    }
    case "wideawake:explicit-attack":
      if (e.id === s.villain.id || s.minions.some((p) => p.id === e.id))
        ports.enemyAttack(s, e.id, e.playerId, e.sourceId);
      break;
    case "wideawake:attachment-action": {
      need(
        projectWideawakeActionOptions(s, e.id, ports).length,
        "This attachment's hero action is unavailable.",
      );
      const p = ports.findPiece(s, e.id)!;
      const resource = attachmentResources[p.code];
      ports.pay(
        s,
        cards.get(p.code)!.name,
        3,
        [resource, resource, resource],
        [W("discard-paid", { id: p.id })],
        p.id,
      );
      break;
    }
    case "wideawake:discard-paid":
      if (ports.findPiece(s, e.id)) ports.discardPiece(s, e.id);
      break;
    case "wideawake:jubilee-action":
      need(
        projectWideawakeActionOptions(s, e.id, ports).length,
        "Jubilee's action is unavailable.",
      );
      ports.choose(
        s,
        "Jubilee",
        "Choose an enemy to deal 2 damage.",
        ports.enemyTargets(s).map((t) => ({
          id: t.id,
          label: t.label,
          effects: [
            W("jubilee-pay", {
              id: e.id,
              target: t.id,
              actorId: s.activePlayerId,
            }),
          ],
        })),
      );
      break;
    case "wideawake:jubilee-pay":
      need(
        projectWideawakeActionOptions(s, e.id, ports).length &&
          ports.enemyTargets(s).some((t) => t.id === e.target),
        "Jubilee needs a ready controlled ally, one energy resource, and an enemy.",
      );
      ports.pay(
        s,
        "Jubilee",
        1,
        ["energy"],
        [
          W("jubilee-damage", {
            id: e.id,
            target: e.target,
            playerId: s.activePlayerId,
          }),
        ],
        e.id,
        [W("jubilee-exhaust", { id: e.id })],
      );
      break;
    case "wideawake:jubilee-exhaust":
      need(
        ports.canExhaust(s, e.id),
        "Jubilee cannot pay her exhaustion cost.",
      );
      ports.exhaust(s, e.id);
      break;
    case "wideawake:jubilee-damage":
      ports.damageBatch(s, [{ id: e.target, amount: 2 }], e.id, e.playerId);
      break;
    case "wideawake:warn-action":
      need(
        projectWideawakeActionOptions(s, e.id, ports).length,
        "Warn the Others needs an alter-ego identity that can exhaust.",
      );
      ports.exhaust(s, "hero");
      ports.discardPiece(s, e.id);
      break;
    case "wideawake:warn-turn": {
      const saved = projectWideawakeInitialize(s);
      const key = `${e.id}:${e.token}`;
      if (saved.handledTurnTokens.includes(key)) break;
      saved.handledTurnTokens.push(key);
      const p = ports.findPiece(s, e.id);
      if (p) ports.captureCard(s, p, e.playerId, []);
      break;
    }
    case "wideawake:ally-response": {
      const receipt = e.receipt as WideawakeAllyAttackReceipt;
      need(
        projectWideawakeAllyAttackResponseOptions(s, receipt, ports).length,
        "This Captive ally cannot respond to that attack.",
      );
      const saved = projectWideawakeInitialize(s);
      saved.usedAllyResponses.push(`${receipt.allyId}:${receipt.token}`);
      if (receipt.allyCode === "32089") {
        ports.damageBatch(
          s,
          [
            s.villain,
            ...s.minions.filter(
              (p) => !p.engagedWith || p.engagedWith === receipt.playerId,
            ),
          ].map((p) => ({ id: p.id, amount: 1 })),
          receipt.allyId,
          receipt.playerId,
        );
      } else if (
        [s.villain, ...s.minions].some(
          (p) => p.id === receipt.targetId && p.code === receipt.targetCode,
        )
      ) {
        const counter = saved.bombs.find((b) => b.enemyId === receipt.targetId);
        if (counter) counter.count++;
        else saved.bombs.push({ enemyId: receipt.targetId, count: 1 });
        saved.delayedBombs.push({
          token: receipt.token,
          sourceId: receipt.allyId,
          playerId: receipt.playerId,
        });
      }
      break;
    }
    case "wideawake:bomb-window": {
      const receipts = (e.receipts as WideawakeBombReceipt[]).filter((r) =>
        state(s)?.delayedBombs.some(
          (d) => d.token === r.token && d.sourceId === r.sourceId,
        ),
      );
      if (!receipts.length) break;
      if (receipts.length === 1)
        ports.queue(
          s,
          W("bombs", { receipt: receipts[0], actorId: firstPlayer(s) }),
        );
      else
        ports.choose(
          s,
          "Boom Boom delayed effects",
          "The first player chooses the order of these simultaneous delayed effects.",
          receipts.map((r, index) => ({
            id: `${r.sourceId}:${r.token}`,
            label: `Resolve Boom Boom's delayed effect ${index + 1}`,
            effects: [
              W("bombs", { receipt: r, actorId: firstPlayer(s) }),
              W("bomb-window", {
                receipts: receipts.filter((p) => p !== r),
                actorId: firstPlayer(s),
              }),
            ],
          })),
        );
      break;
    }
    case "wideawake:bombs": {
      const saved = state(s);
      const receipt = e.receipt as WideawakeBombReceipt;
      if (
        !saved?.delayedBombs.some(
          (r) => r.token === receipt.token && r.sourceId === receipt.sourceId,
        )
      )
        break;
      saved.delayedBombs = saved.delayedBombs.filter(
        (r) => !(r.token === receipt.token && r.sourceId === receipt.sourceId),
      );
      const counters = saved.bombs;
      saved.bombs = [];
      const enemies = new Set([s.villain.id, ...s.minions.map((p) => p.id)]);
      const targets = counters
        .filter((b) => enemies.has(b.enemyId))
        .map((b) => ({ id: b.enemyId, amount: b.count * 2 }));
      if (targets.length)
        ports.damageBatch(s, targets, receipt.sourceId, receipt.playerId);
      break;
    }
    default:
      throw Error(`Unknown Project Wideawake effect: ${e.type}`);
  }
  return true;
}
