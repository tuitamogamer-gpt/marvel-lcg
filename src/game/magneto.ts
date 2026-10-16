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
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `magneto:${name}`,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
export const MAGNETO_SET = "magneto_villain";
export const MAGNETO_SCENARIO = "magneto";
export const MAGNETO_SCRIPT_CODES = [
  "32138",
  "32139",
  "32140",
  "32141a",
  "32141b",
  "32142a",
  "32142b",
  "32143a",
  "32143b",
  "32144a",
  "32144b",
  "32145a",
  "32145b",
  "32146",
  "32147",
  "32148",
  "32149",
  "32150",
  "32151",
  "32152",
  "32153",
  "32154",
  "32155",
  "32156",
  "32157",
  "32158",
] as const;
const villains = ["32138", "32139", "32140"];
const mainBacks = ["32141b", "32142b", "32143b"];
const typedCost: Resource[] = ["energy", "mental", "physical"];

/** Every Piece here owns one actual source card, never a copied public view. */
export interface MagnetoState {
  orbital?: Piece;
  currentMain?: Piece;
  mainDeck?: Piece[];
  villainDeck?: Piece[];
  magnetCounters: number;
  mainCode?: string;
  setupIds?: string[];
  handledAttackResponses: string[];
  handledBoostResponses: string[];
  usedBasicResponses: string[];
}
export type MagnetoGameState = GameState & { magneto?: MagnetoState };
export interface MagnetoEnemyAttackReceipt {
  token: string;
  enemyId: string;
  enemyCode: string;
  playerId: string;
  performed: boolean;
}
export interface MagnetoBasicAttackReceipt {
  token: string;
  playerId: string;
  targetId: string;
  /** The attacked Magneto stage may have advanced before this response. */
  targetCode?: string;
  performed: boolean;
}
export interface MagnetoPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Pick<Piece, "code"> & { id?: string }): boolean;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  findPiece(s: GameState, id: string): Piece | undefined;
  /** Remove this exact original card from its current zone and reveal it. */
  revealEncounter(
    s: GameState,
    p: Piece,
    playerId: string,
    after: Effect[],
  ): void;
  /** Same physical front (or flipped back), with its printed starting threat. */
  revealSide(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  attach(s: GameState, p: Piece, targetId: string): void;
  addToVictory(s: GameState, p: Piece): void;
  discardPiece(s: GameState, id: string): void;
  /** When after is supplied, queue its copy augmented with id/code/emptied
   * after newly generated native exhaustion effects and before prior effects. */
  discardTop(s: GameState, after?: Effect): { piece?: Piece; emptied: boolean };
  searchAndReveal(
    s: GameState,
    kind: "sentinel" | "magnetic-attachment",
    playerId: string,
    after: Effect[],
  ): void;
  dealEncounter(s: GameState, playerId: string): void;
  giveTough(s: GameState, targetId: string): boolean;
  /** A supplied card is moved, with its original ID, rather than drawn. */
  giveFacedownBoost(s: GameState, piece?: Piece): void;
  activateEnemy(
    s: GameState,
    enemyId: string,
    playerId: string,
    kind: "attack" | "scheme",
    sourceId: string,
    /** Resolve only after this activation and its triggered abilities finish. */
    after?: Effect[],
  ): void;
  damageBatch(
    s: GameState,
    targets: { id: string; amount: number }[],
    sourceId: string,
    playerId: string,
  ): void;
  status(
    s: GameState,
    targetId: string,
    status: "stunned" | "confused",
    sourceId: string,
  ): void;
  addMainThreat(s: GameState, amount: number, sourceId: string): void;
  exhaustIdentity(s: GameState, playerId: string): void;
  exhaustControlled(
    s: GameState,
    playerId: string,
    kind: "upgrade-support" | "ally",
  ): void;
  /** Native defeat resolves the actual minion's When Defeated before after. */
  defeatMinion(
    s: GameState,
    id: string,
    playerId: string,
    after: Effect[],
  ): void;
  discardPlayerTopUnder(
    s: GameState,
    playerId: string,
    count: number,
    schemeId: string,
    after: Effect[],
  ): void;
  discardStoredCards(s: GameState, schemeId: string): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  canExhaustIdentity(s: GameState, playerId: string): boolean;
  canPay(s: GameState, cost: number, requirements?: Resource[]): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    sourceId: string,
    exhaustPlayerId?: string,
  ): void;
  /** Retain one source-specific boost receipt on the current attack. */
  registerAllyDefeatBoost(
    s: GameState,
    sourceId: string,
    attackId: string,
  ): void;
}

type TextPorts = Pick<MagnetoPorts, "isTextBlank">;
const saved = (s: GameState) => (s as MagnetoGameState).magneto;
const known = (p: Pick<Piece, "code">) =>
  (MAGNETO_SCRIPT_CODES as readonly string[]).includes(p.code);
const active = (s: GameState) => s.villainId === MAGNETO_SCENARIO;
const firstPlayer = (s: GameState) => playerOrder(s)[0]?.id;
const liveAttachment = (
  s: GameState,
  code: string,
  target: string,
  ports: TextPorts,
) =>
  s.attachments.find(
    (p) =>
      p.code === code && p.attachedTo === target && !ports.isTextBlank(s, p),
  );
const characters = (s: GameState, id: string) => [
  { id: `hero:${id}`, amount: 1 },
  ...seatView(s, id)
    .player.inPlay.filter(
      (p) =>
        ["ally", "minion"].includes(cards.get(p.code)?.type_code || "") &&
        !p.treatedAsMinion,
    )
    .map((p) => ({ id: p.id, amount: 1 })),
];
const magnetic = (p: Pick<Piece, "code">) =>
  /(?:^|\.\s*)Magnetic\./i.test(cards.get(p.code)?.traits || "");

export function magnetoInitialize(s: GameState): MagnetoState {
  const state =
    saved(s) ||
    ((s as MagnetoGameState).magneto = {
      magnetCounters: 0,
      handledAttackResponses: [],
      handledBoostResponses: [],
      usedBasicResponses: [],
    });
  state.magnetCounters ||= 0;
  state.handledAttackResponses ||= [];
  state.handledBoostResponses ||= [];
  state.usedBasicResponses ||= [];
  return state;
}
export function magnetoSetup(
  s: GameState,
  pieces: { boarding: Piece; orbital: Piece },
  ports: MagnetoPorts,
): void {
  need(active(s), "Magneto setup requires the native Magneto scenario.");
  need(
    pieces.boarding.code === "32144a" && pieces.orbital.code === "32145a",
    "Magneto setup requires the original Boarding Party and Orbital Decay fronts.",
  );
  const state = magnetoInitialize(s);
  const ids = [pieces.boarding.id, pieces.orbital.id];
  need(ids[0] !== ids[1], "Magneto setup cards need distinct physical IDs.");
  if (state.setupIds) {
    need(
      ids.every((id) => state.setupIds!.includes(id)),
      "Magneto setup already owns different physical cards.",
    );
    return;
  }
  state.setupIds = ids;
  state.orbital = pieces.orbital;
  state.mainCode = s.scheme.code;
  state.magnetCounters = 0;
  const actor = firstPlayer(s);
  need(actor, "Magneto setup requires a surviving first player.");
  ports.revealSide(s, pieces.boarding, actor!, []);
}
/** A new physical main scheme starts without its predecessor's counters. */
export function magnetoMainChanged(s: GameState, code = s.scheme.code): void {
  const state = magnetoInitialize(s);
  state.mainCode = code.endsWith("a") ? `${code.slice(0, -1)}b` : code;
  state.magnetCounters = 0;
}
export function magnetoMainThreatLimit(s: GameState): number | undefined {
  const i = mainBacks.indexOf(s.scheme.code);
  return i < 0 ? undefined : (5 + i) * s.playerCount;
}
export function magnetoSideSchemeBaseThreat(
  s: GameState,
  p: Pick<Piece, "code">,
): number | undefined {
  if (["32144a", "32144b", "32145a", "32158"].includes(p.code))
    return 3 * s.playerCount;
  return p.code === "32156" ? 4 : p.code === "32157" ? 2 : undefined;
}
export function magnetoMainRevealed(s: GameState, code: string): Effect[] {
  if (code === "32142a")
    return [
      M("place-counters", { amount: 1, actorId: firstPlayer(s) }),
      M("stage-search", { kind: "sentinel", actorId: firstPlayer(s) }),
    ];
  if (code === "32143a")
    return [
      M("place-counters", { amount: 2, actorId: firstPlayer(s) }),
      M("stage-search", {
        kind: "magnetic-attachment",
        actorId: firstPlayer(s),
      }),
    ];
  return [];
}
export function magnetoModifiers(
  s: GameState,
  p: Pick<Piece, "code"> & { id?: string },
  ports: TextPorts,
) {
  const villain = p.id === s.villain.id;
  return {
    attack:
      villain && !!liveAttachment(s, "32148", s.villain.id, ports) ? 1 : 0,
    scheme:
      villain && !!liveAttachment(s, "32147", s.villain.id, ports) ? 1 : 0,
    retaliate:
      villain && !!liveAttachment(s, "32149", s.villain.id, ports) ? 1 : 0,
    losesSteady: villain && !!liveAttachment(s, "32145b", s.villain.id, ports),
    cannotStun: villain && !!liveAttachment(s, "32148", s.villain.id, ports),
    cannotConfuse: villain && !!liveAttachment(s, "32147", s.villain.id, ports),
  };
}
export function magnetoIdentityRestricted(
  s: GameState,
  playerId: string,
  ports: TextPorts,
): boolean {
  return (
    !!liveAttachment(s, "32150", `hero:${playerId}`, ports) ||
    (playerId === s.activePlayerId &&
      !!liveAttachment(s, "32150", "hero", ports))
  );
}
export function magnetoDamageCap(
  s: GameState,
  ports: TextPorts,
): number | undefined {
  const limits: Record<string, number> = {
    "32144a": 6,
    "32144b": 12,
    "32145a": 18,
  };
  const live = s.sideSchemes
    .filter((p) => limits[p.code] && !ports.isTextBlank(s, p))
    .map((p) => limits[p.code] * s.playerCount);
  return live.length ? Math.min(...live) : undefined;
}
/** Native constant limits must already have reduced amount. Returning undefined
 * means no replacement; zero means Bubble replaced this entire damage event. */
export function magnetoReplaceDamage(
  s: GameState,
  targetId: string,
  amount: number,
  ports: TextPorts & Pick<MagnetoPorts, "discardPiece">,
): number | undefined {
  if (targetId !== s.villain.id || amount <= 0) return undefined;
  const bubble = liveAttachment(s, "32149", targetId, ports);
  if (!bubble) return undefined;
  bubble.damage += amount;
  if (bubble.damage >= 8) ports.discardPiece(s, bubble.id);
  return 0;
}
export function magnetoAttachmentTargets(
  s: GameState,
  p: Piece,
  playerId = s.activePlayerId,
): string[] | null {
  if (["32145b", "32147", "32148", "32149"].includes(p.code))
    return [s.villain.id];
  if (p.code === "32150")
    return s.attachments.some(
      (a) =>
        a.code === p.code &&
        ["hero", `hero:${playerId}`].includes(a.attachedTo || ""),
    )
      ? []
      : [`hero:${playerId}`];
  return null;
}
export function magnetoReveal(
  s: GameState,
  p: Piece,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  const actorId = s.activePlayerId;
  if (["32142a", "32143a"].includes(p.code))
    return magnetoMainRevealed(s, p.code);
  if (["32139", "32140"].includes(p.code))
    return [M("deal-each", { actorId: firstPlayer(s) })];
  if (["32145b", "32147", "32148", "32149", "32150"].includes(p.code))
    return [M("attachment", { id: p.id, playerId: actorId, actorId })];
  const names: Record<string, string> = {
    "32151": "magnetism",
    "32152": "shock",
    "32153": "blast",
    "32154": "shards",
    "32155": "missile",
    "32157": "sealed",
    "32158": "seized",
  };
  return names[p.code]
    ? [
        M(names[p.code], {
          id: p.id,
          sourceId: p.id,
          playerId: actorId,
          actorId,
        }),
      ]
    : [];
}
export function magnetoBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === "32146")
    return [M("sentinel-boost", { sourceId: p.id, actorId: s.activePlayerId })];
  if (p.code === "32153")
    return [
      M("exhaust-identity", {
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32154")
    return [
      M("register-shards", {
        sourceId: p.id,
        attackId: s.attack?.id,
        actorId: s.activePlayerId,
      }),
    ];
  if (p.code === "32157")
    return [
      M("exhaust-allies", {
        playerId: s.activePlayerId,
        actorId: s.activePlayerId,
      }),
    ];
  return [];
}
export function magnetoSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  const names: Record<string, string> = {
    "32144a": "flip-boarding",
    "32144b": "sabotage-defeated",
    "32145a": "flip-orbital",
    "32156": "mayhem",
    "32158": "seized-defeated",
  };
  return names[p.code]
    ? [
        M(names[p.code], {
          id: p.id,
          sourceId: p.id,
          playerId,
          actorId: playerId,
        }),
      ]
    : [];
}
export function magnetoMinionDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  return p.code === "32146" && !ports.isTextBlank(s, p)
    ? [M("villain-tough", { sourceId: p.id, actorId: playerId })]
    : [];
}
export function magnetoAfterEnemyAttack(
  s: GameState,
  receipt: MagnetoEnemyAttackReceipt,
  ports: TextPorts,
): Effect[] {
  if (
    !active(s) ||
    !receipt.performed ||
    !receipt.token ||
    receipt.enemyId !== s.villain.id ||
    !villains.includes(receipt.enemyCode) ||
    ports.isTextBlank(s, s.villain) ||
    saved(s)?.handledAttackResponses.includes(receipt.token)
  )
    return [];
  return [
    M("attack-response", {
      receipt,
      actorId: receipt.playerId,
      mandatory: true,
      forced: true,
    }),
  ];
}
export function magnetoAllyDefeatedByAttack(
  s: GameState,
  sourceId: string,
  attackId: string,
  playerId = s.activePlayerId,
): Effect[] {
  const key = `${sourceId}:${attackId}`;
  return sourceId && attackId && !saved(s)?.handledBoostResponses.includes(key)
    ? [M("shards-boost-response", { key, sourceId, actorId: playerId })]
    : [];
}
export function magnetoBoostAllyDefeated(
  s: GameState,
  receipt: { attackId: string; sourceId: string; allyId: string },
): Effect[] {
  return receipt.allyId
    ? magnetoAllyDefeatedByAttack(s, receipt.sourceId, receipt.attackId)
    : [];
}
export function magnetoBasicAttackResponseOptions(
  s: GameState,
  receipt: MagnetoBasicAttackReceipt,
  ports: TextPorts & Pick<MagnetoPorts, "canPay">,
): Option[] {
  const view = seatView(s, receipt.playerId);
  if (
    !receipt.token ||
    !receipt.performed ||
    (receipt.targetId !== s.villain.id &&
      !(active(s) && villains.includes(receipt.targetCode || ""))) ||
    view.player.form !== "hero" ||
    !ports.canPay(view, 3, typedCost)
  )
    return [];
  return s.attachments
    .filter(
      (p) =>
        ["32147", "32148"].includes(p.code) &&
        p.attachedTo === s.villain.id &&
        !ports.isTextBlank(s, p) &&
        !saved(s)?.usedBasicResponses.includes(`${p.id}:${receipt.token}`),
    )
    .map((p) => ({
      id: `magneto-response:${p.id}:${receipt.token}`,
      label: `${cards.get(p.code)?.name} · spend energy, mental and physical to discard`,
      image: p.code,
      effects: [
        M("paid-basic-response", {
          id: p.id,
          receipt,
          actorId: receipt.playerId,
        }),
      ],
    }));
}
export function magnetoActionOptions(
  s: GameState,
  id: string,
  ports: TextPorts & Pick<MagnetoPorts, "canPay" | "canExhaustIdentity">,
): Option[] {
  const playerId = s.activePlayerId;
  return s.attachments
    .filter(
      (p) =>
        p.id === id &&
        p.code === "32150" &&
        [`hero:${playerId}`, "hero"].includes(p.attachedTo || "") &&
        !ports.isTextBlank(s, p) &&
        ports.canExhaustIdentity(s, playerId) &&
        ports.canPay(s, 1, ["physical"]),
    )
    .map((p) => ({
      id: `magneto-wrapped:${p.id}`,
      label:
        "Wrapped in Metal · exhaust identity and spend physical to discard",
      image: p.code,
      effects: [M("wrapped-action", { id: p.id, playerId, actorId: playerId })],
    }));
}
export function magnetoAddCounters(
  s: GameState,
  amount: number,
  ports: Pick<MagnetoPorts, "queue">,
  playerId = s.activePlayerId,
): void {
  ports.queue(s, M("place-counters", { amount, actorId: playerId }));
}

export function resolveMagnetoEffect(
  s: GameState,
  e: Effect,
  ports: MagnetoPorts,
): boolean {
  const actor = (e.playerId || e.actorId || s.activePlayerId) as string;
  const state = () => magnetoInitialize(s);
  switch (e.type) {
    case "magneto:place-counters": {
      const mainCode = s.scheme.code.replace(/a$/, "b");
      if (!active(s) || !mainBacks.includes(mainCode) || !(e.amount > 0))
        return true;
      const data = state();
      if (data.mainCode !== mainCode) {
        data.mainCode = mainCode;
        data.magnetCounters = 0;
      }
      data.magnetCounters += e.amount;
      if (
        data.magnetCounters >= 3 &&
        mainBacks.includes(s.scheme.code) &&
        !ports.isTextBlank(s, {
          code: s.scheme.code,
          id: data.currentMain?.id || "main",
        })
      )
        ports.queue(
          s,
          M("magnetic-response", { mainCode: s.scheme.code, actorId: actor }),
        );
      return true;
    }
    case "magneto:magnetic-response": {
      if (s.scheme.code !== e.mainCode || state().magnetCounters < 3)
        return true;
      // Rules Reference 1.8 errata removes three counters before the search,
      // including when that finite search never finds a Magnetic card.
      state().magnetCounters = Math.max(0, state().magnetCounters - 3);
      ports.queue(s, M("magnetic-mill", { actorId: actor }));
      return true;
    }
    case "magneto:magnetic-mill": {
      // Native queuing may clone/contextualize effects, so the discard port
      // captures the receipt and orders it after native exhaustion windows.
      ports.discardTop(s, M("magnetic-mill-result", { actorId: actor }));
      return true;
    }
    case "magneto:magnetic-mill-result": {
      if (e.id && magnetic({ code: e.code })) {
        const found = ports.findPiece(s, e.id);
        if (found) ports.revealEncounter(s, found, actor, []);
      } else if (e.id && !e.emptied)
        ports.queue(s, M("magnetic-mill", { actorId: actor }));
      return true;
    }
    case "magneto:stage-search":
      if (
        e.kind === "sentinel"
          ? !(s.victoryDisplay || []).some((p) => p.code === "32144b")
          : !s.attachments.some(
              (p) => p.code === "32145b" && p.attachedTo === s.villain.id,
            )
      )
        ports.searchAndReveal(s, e.kind, actor, []);
      return true;
    case "magneto:deal-each":
      for (const player of playerOrder(s)) ports.dealEncounter(s, player.id);
      return true;
    case "magneto:attachment": {
      const p = ports.findPiece(s, e.id);
      if (!p) return true;
      const targets = magnetoAttachmentTargets(s, p, actor) || [];
      if (targets.length) ports.attach(s, p, targets[0]);
      else ports.discardPiece(s, p.id);
      return true;
    }
    case "magneto:flip-boarding": {
      const p = ports.findPiece(s, e.id);
      if (p?.code === "32144a") {
        p.code = "32144b";
        p.damage = 0;
        p.counters = 0;
        ports.revealSide(s, p, actor, []);
      }
      return true;
    }
    case "magneto:sabotage-defeated": {
      const p = ports.findPiece(s, e.id);
      if (p?.code !== "32144b") return true;
      const orbital = state().orbital;
      ports.addToVictory(s, p);
      if (orbital) {
        delete state().orbital;
        ports.revealSide(s, orbital, actor, []);
      }
      return true;
    }
    case "magneto:flip-orbital": {
      const p = ports.findPiece(s, e.id);
      if (p?.code === "32145a") {
        p.code = "32145b";
        p.damage = 0;
        p.counters = 0;
        ports.revealEncounter(s, p, actor, []);
      }
      return true;
    }
    case "magneto:attack-response": {
      const r = e.receipt as MagnetoEnemyAttackReceipt;
      if (!magnetoAfterEnemyAttack(s, r, ports).length) return true;
      state().handledAttackResponses.push(r.token);
      magnetoAddCounters(s, 1, ports, r.playerId);
      return true;
    }
    case "magneto:villain-tough":
      ports.giveTough(s, s.villain.id);
      return true;
    case "magneto:sentinel-boost":
      ports.giveTough(s, s.villain.id);
      ports.giveFacedownBoost(s);
      return true;
    case "magneto:register-shards":
      if (e.attackId) ports.registerAllyDefeatBoost(s, e.sourceId, e.attackId);
      return true;
    case "magneto:shards-boost-response":
      if (!state().handledBoostResponses.includes(e.key)) {
        state().handledBoostResponses.push(e.key);
        magnetoAddCounters(s, 1, ports, actor);
      }
      return true;
    case "magneto:exhaust-identity":
      ports.exhaustIdentity(s, actor);
      return true;
    case "magneto:exhaust-allies":
      ports.exhaustControlled(s, actor, "ally");
      return true;
    case "magneto:magnetism": {
      const p = [...s.encounter.discard].reverse().find(magnetic);
      if (p) ports.giveFacedownBoost(s, p);
      ports.activateEnemy(
        s,
        s.villain.id,
        actor,
        seatView(s, actor).player.form === "hero" ? "attack" : "scheme",
        e.sourceId,
      );
      return true;
    }
    case "magneto:shock": {
      const count = saved(s)?.magnetCounters || 0;
      const hero = seatView(s, actor).player.form === "hero";
      if (hero)
        ports.damageBatch(
          s,
          [{ id: `hero:${actor}`, amount: count }],
          e.sourceId,
          actor,
        );
      else ports.addMainThreat(s, count, e.sourceId);
      ports.status(
        s,
        `hero:${actor}`,
        hero ? "stunned" : "confused",
        e.sourceId,
      );
      return true;
    }
    case "magneto:blast":
      ports.exhaustControlled(s, actor, "upgrade-support");
      magnetoAddCounters(s, 1, ports, actor);
      return true;
    case "magneto:shards":
      magnetoAddCounters(s, 1, ports, actor);
      ports.damageBatch(s, characters(s, actor), e.sourceId, actor);
      return true;
    case "magneto:missile": {
      const targets = s.minions.filter((p) =>
        ports.hasTrait(s, p.id, "Sentinel"),
      );
      if (!targets.length) return true;
      const effects = (p: Piece) => [
        M("missile-defeat", {
          id: p.id,
          sourceId: e.sourceId,
          playerId: actor,
          actorId: actor,
        }),
      ];
      if (targets.length === 1) ports.queue(s, ...effects(targets[0]));
      else
        ports.choose(
          s,
          "Magnetic Missile",
          "Choose a Sentinel minion to defeat.",
          targets.map((p) => ({
            id: p.id,
            label: cards.get(p.code)?.name || p.code,
            image: p.code,
            effects: effects(p),
          })),
        );
      return true;
    }
    case "magneto:missile-defeat": {
      const p = s.minions.find((p) => p.id === e.id);
      if (p && ports.hasTrait(s, p.id, "Sentinel"))
        ports.defeatMinion(s, p.id, actor, [
          M("missile-prevent", {
            damage: 5,
            sourceId: e.sourceId,
            playerId: actor,
            actorId: actor,
          }),
        ]);
      return true;
    }
    case "magneto:missile-prevent": {
      const hand = seatView(s, actor).player.hand;
      if (!(e.damage > 0)) return true;
      const finish = M("missile-damage", {
        damage: e.damage,
        sourceId: e.sourceId,
        playerId: actor,
        actorId: actor,
      });
      if (!hand.length) ports.queue(s, finish);
      else
        ports.choose(
          s,
          "Magnetic Missile",
          `Take ${e.damage} damage, or discard a card to prevent 1.`,
          [
            {
              id: "take-damage",
              label: `Take ${e.damage} damage`,
              effects: [finish],
            },
            ...hand.map((p) => ({
              id: p.id,
              label: `Discard ${cards.get(p.code)?.name || p.code}`,
              image: p.code,
              effects: [
                M("missile-discard", {
                  id: p.id,
                  damage: e.damage,
                  sourceId: e.sourceId,
                  playerId: actor,
                  actorId: actor,
                }),
              ],
            })),
          ],
        );
      return true;
    }
    case "magneto:missile-discard": {
      if (!seatView(s, actor).player.hand.some((p) => p.id === e.id))
        return true;
      ports.discardHandCard(s, actor, e.id);
      ports.queue(
        s,
        M("missile-prevent", {
          damage: e.damage - 1,
          sourceId: e.sourceId,
          playerId: actor,
          actorId: actor,
        }),
      );
      return true;
    }
    case "magneto:missile-damage":
      ports.damageBatch(
        s,
        [{ id: `hero:${actor}`, amount: e.damage }],
        e.sourceId,
        actor,
      );
      return true;
    case "magneto:sealed": {
      const p = s.sideSchemes.find((p) => p.id === e.id);
      if (p)
        p.counters +=
          playerOrder(s)
            .flatMap((player) => seatView(s, player).player.inPlay)
            .filter(
              (p) =>
                ["ally", "minion"].includes(
                  cards.get(p.code)?.type_code || "",
                ) && !p.treatedAsMinion,
            ).length * 2;
      return true;
    }
    case "magneto:seized":
      ports.queue(
        s,
        M("seized-order", {
          id: e.id,
          playerIds: playerOrder(s).map((p) => p.id),
          actorId: firstPlayer(s),
        }),
      );
      return true;
    case "magneto:seized-order": {
      const alive = playerOrder(s).map((p) => p.id);
      const remaining = (e.playerIds as string[]).filter((id) =>
        alive.includes(id),
      );
      if (!remaining.length) return true;
      const effects = (id: string) => [
        M("seize-player", {
          id: e.id,
          playerId: id,
          remaining: remaining.filter((p) => p !== id),
          actorId: id,
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...effects(remaining[0]));
      else
        ports.choose(
          s,
          "Seized!",
          "The first player chooses the next player to resolve this effect.",
          remaining.map((id) => ({
            id,
            label: `Resolve for ${id}`,
            effects: effects(id),
          })),
        );
      return true;
    }
    case "magneto:seize-player":
      ports.discardPlayerTopUnder(s, actor, 6, e.id, [
        M("seized-order", {
          id: e.id,
          playerIds: e.remaining || [],
          actorId: firstPlayer(s),
        }),
      ]);
      return true;
    case "magneto:seized-defeated":
      ports.activateEnemy(
        s,
        s.villain.id,
        actor,
        seatView(s, actor).player.form === "hero" ? "attack" : "scheme",
        e.sourceId,
        [M("seized-cleanup", { id: e.id, actorId: actor })],
      );
      return true;
    case "magneto:seized-cleanup":
      ports.discardStoredCards(s, e.id);
      ports.discardPiece(s, e.id);
      return true;
    case "magneto:mayhem":
      ports.queue(
        s,
        M("mayhem-mill", { remaining: 4, count: 0, actorId: actor }),
      );
      return true;
    case "magneto:mayhem-mill": {
      ports.discardTop(
        s,
        M("mayhem-mill-result", {
          remaining: e.remaining,
          count: e.count,
          actorId: actor,
        }),
      );
      return true;
    }
    case "magneto:mayhem-mill-result": {
      const count = e.count + (e.id && magnetic({ code: e.code }) ? 1 : 0);
      if (e.id && !e.emptied && e.remaining > 1)
        ports.queue(
          s,
          M("mayhem-mill", {
            remaining: e.remaining - 1,
            count,
            actorId: actor,
          }),
        );
      else
        ports.queue(
          s,
          ...Array.from({ length: count }, () =>
            M("place-counters", { amount: 1, actorId: actor }),
          ),
        );
      return true;
    }
    case "magneto:basic-response-window": {
      const r = e.receipt as MagnetoBasicAttackReceipt;
      const options = magnetoBasicAttackResponseOptions(s, r, ports);
      if (options.length)
        ports.choose(
          s,
          "Magneto attachments",
          "You may spend resources after your basic attack.",
          [...options, { id: "continue", label: "Continue", effects: [] }],
        );
      return true;
    }
    case "magneto:paid-basic-response": {
      const r = e.receipt as MagnetoBasicAttackReceipt;
      if (
        !magnetoBasicAttackResponseOptions(s, r, ports).some(
          (o) => o.effects[0].id === e.id,
        )
      )
        return true;
      const key = `${e.id}:${r.token}`;
      ports.pay(
        seatView(s, r.playerId),
        cards.get(ports.findPiece(s, e.id)?.code || "")?.name ||
          "Magneto attachment",
        3,
        typedCost,
        [
          M("discard-paid", {
            id: e.id,
            key,
            playerId: r.playerId,
            actorId: r.playerId,
          }),
          M("basic-response-window", { receipt: r, actorId: r.playerId }),
        ],
        e.id,
      );
      return true;
    }
    case "magneto:wrapped-action": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "32150");
      if (
        !p ||
        !magnetoActionOptions(seatView(s, actor), p.id, ports).some(
          (o) => o.effects[0].id === p.id,
        )
      )
        return true;
      ports.pay(
        seatView(s, actor),
        "Wrapped in Metal",
        1,
        ["physical"],
        [
          M("discard-wrapped-paid", {
            id: p.id,
            playerId: actor,
            actorId: actor,
          }),
        ],
        p.id,
        actor,
      );
      return true;
    }
    case "magneto:discard-paid":
      if (e.key && !state().usedBasicResponses.includes(e.key)) {
        state().usedBasicResponses.push(e.key);
        ports.discardPiece(s, e.id);
      }
      return true;
    case "magneto:discard-wrapped-paid":
      ports.discardPiece(s, e.id);
      return true;
    default:
      return false;
  }
}
