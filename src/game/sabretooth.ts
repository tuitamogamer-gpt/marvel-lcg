import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
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
const S = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sabretooth:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const villainCodes = ["32060", "32061", "32062"];
const attachmentCodes = ["32067", "32068"];
const typedCost: Resource[] = ["energy", "mental", "physical"];

export const SABRETOOTH_SET = "sabretooth";
export const SABRETOOTH_SCRIPT_CODES = [
  "32060",
  "32061",
  "32062",
  "32063a",
  "32063b",
  "32064a",
  "32064b",
  "32065a",
  "32065b",
  "32066",
  "32067",
  "32068",
  "32069",
  "32070",
  "32071",
  "32072",
] as const;

/** The optional Kelly member is one physical NPC zone, never a second copy
 * of an ally in a player's inPlay. kellyId remains after an actual leave. */
export interface SabretoothState {
  kelly?: Piece;
  kellyId: string;
  startingDamage: number;
  controllerId?: string;
  completedActivationIds: string[];
  usedDefenseResponses: string[];
}
export type SabretoothGameState = GameState & {
  sabretooth?: SabretoothState;
};
export interface SabretoothActivationReceipt {
  token: string;
  enemyId: string;
  enemyCode: string;
  playerId: string;
  kind: "attack" | "scheme";
  performed: boolean;
}
export interface SabretoothDefenseReceipt {
  attackId: string;
  enemyId: string;
  enemyCode: string;
  playerId: string;
  /** An actual declared hero defender, including a defense event. */
  heroDefended: boolean;
}
export interface SabretoothUndefendedReceipt {
  playerId: string;
  /** False for ally/hero defense; Overkill never becomes an undefended attack. */
  undefended: boolean;
  target: string;
}
export interface SabretoothPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  /** Enter this existing setup piece without When Revealed. The caller removes
   * Find and Kelly from their prior setup source zones before calling setup. */
  putSetupSideScheme(s: GameState, p: Piece, threat: number): void;
  /** Advance through the native 2A reveal to 2B. The host uses sabretoothReveal
   * for 2A's physical facedown encounter deal to every surviving player. */
  advanceMain(s: GameState, frontCode: "32064a", after: Effect[]): void;
  /** Same-instance transfer from a defeated side scheme to environment. No
   * generic encounter discard, Victory routing, or fresh piece is permitted. */
  flipFind(s: GameState, p: Piece): void;
  attach(s: GameState, p: Piece, target: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Native encounter exhaustion, with the actual card even if recycling
   * immediately moves it from discard back into the encounter deck. */
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** NPC and villain damage/healing use native prevention, damage placement,
   * defeat, ownership and response windows. These are encounter card effects. */
  damage(s: GameState, target: string, amount: number, source: string): void;
  heal(s: GameState, target: string, amount: number, source: string): void;
  defeatKelly(s: GameState, id: string, source: string): void;
  lose(s: GameState, reason: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  canExhaustHero(s: GameState): boolean;
  exhaustHero(s: GameState): void;
  canReadyHero(s: GameState): boolean;
  readyHero(s: GameState): void;
  canPay(s: GameState, cost: number, requirements?: Resource[]): boolean;
  /** Native ability payment: real hand cards/resource abilities, typed/wild
   * assignment, resource-spend responses, cancellation, then paid effects. */
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    sourceId: string,
  ): void;
  /** Retain this boost trigger on the actual attack. Invoke the exported
   * ally-defeat hook only if that attack actually defeats an ally, once per
   * source; prevented defeat or an independent boost damage effect is not it. */
  registerAllyDefeatBoost(
    s: GameState,
    sourceId: string,
    attackId: string,
  ): void;
}

const state = (s: GameState) => (s as SabretoothGameState).sabretooth;
const active = (s: GameState) =>
  s.villainId === "sabretooth" && villainCodes.includes(s.villain.code);
const mission = (s: GameState) =>
  s.sideSchemes.find((p) => p.code === "32065a") ||
  s.environments?.find((p) => p.code === "32065b");
const protect = (s: GameState) =>
  s.environments?.find((p) => p.code === "32065b" && !isTextBlank(s, p));

export function sabretoothKelly(s: GameState): Piece | undefined {
  const saved = state(s);
  return (
    saved?.kelly ||
    (saved ? s.minions.find((p) => p.id === saved.kellyId) : undefined)
  );
}
export function sabretoothKellyTextBlank(s: GameState): boolean {
  const p = sabretoothKelly(s);
  return (
    !!p &&
    ((s.scheme.code === "32063b" &&
      s.sideSchemes.some(
        (f) => f.code === "32065a" && f.id === p.attachedTo,
      )) ||
      isTextBlank(s, p))
  );
}
export function sabretoothKellyController(s: GameState): string | undefined {
  const kelly = sabretoothKelly(s);
  return kelly && !kelly.attachedTo && !kelly.treatedAsMinion
    ? state(s)?.controllerId
    : undefined;
}
export function sabretoothKellyCountsAgainstAllyLimit(s: GameState): boolean {
  return sabretoothKellyTextBlank(s);
}
export function sabretoothKellyCanHeal(
  s: GameState,
  origin: "player" | "encounter",
): boolean {
  const source = mission(s);
  return (
    !!sabretoothKelly(s) &&
    !(origin === "player" && source && !isTextBlank(s, source))
  );
}
export function sabretoothKellyCanAttach(s: GameState, card: Card): boolean {
  if (!sabretoothKelly(s)) return false;
  const source = mission(s);
  if (source && !isTextBlank(s, source) && card.type_code === "upgrade")
    return false;
  return sabretoothKellyTextBlank(s) || card.faction_code === "encounter";
}

/** No card factory: both arguments are the actual original-source pieces. */
export function sabretoothSetup(
  s: GameState,
  find: Piece,
  kelly: Piece,
  ports: SabretoothPorts,
  startingDamage = (s.heroic || 0) > 0 ? 3 : s.difficulty === "expert" ? 2 : 1,
): void {
  need(active(s), "Sabretooth setup requires the native Sabretooth scenario.");
  need(
    find.code === "32065a" && kelly.code === "32066" && find.id !== kelly.id,
    "Sabretooth setup requires the actual Find the Senator and Robert Kelly pieces.",
  );
  const saved = state(s);
  if (saved) {
    need(saved.kellyId === kelly.id, "Robert Kelly already has a physical ID.");
    return;
  }
  need(
    Number.isInteger(startingDamage) &&
      startingDamage >= 0 &&
      startingDamage <= 8,
    "Robert Kelly's starting damage must be an integer from 0 to 8.",
  );
  kelly.damage = startingDamage;
  kelly.attachedTo = find.id;
  delete kelly.ownerId;
  (s as SabretoothGameState).sabretooth = {
    kelly,
    kellyId: kelly.id,
    startingDamage,
    completedActivationIds: [],
    usedDefenseResponses: [],
  };
  ports.putSetupSideScheme(s, find, 5 * s.playerCount);
}

/** Call after native first-player rotation; attached, blank Kelly is uncontrolled. */
export function sabretoothFirstPlayerChanged(s: GameState): void {
  const saved = state(s);
  if (!saved?.kelly || saved.kelly.attachedTo || sabretoothKellyTextBlank(s))
    return;
  saved.controllerId = s.firstPlayerId;
}
/** Call after the host moves this actual NPC from its live zone. */
export function sabretoothKellyLeftPlay(
  s: GameState,
  id: string,
  ports: Pick<SabretoothPorts, "lose">,
): void {
  const saved = state(s);
  if (active(s) && saved?.kellyId === id) {
    delete saved.kelly;
    delete saved.controllerId;
    ports.lose(s, "Robert Kelly left play.");
  }
}

/** Printed stat modifiers are handled once by native attachment-stat sums.
 * These grants disappear when their donor is blank; recipient blanking does
 * not remove a grant from another source. */
export function sabretoothModifiers(s: GameState, target = s.villain.id) {
  const result = { piercing: false, stalwart: false };
  if (target !== s.villain.id || !villainCodes.includes(s.villain.code))
    return result;
  for (const p of s.attachments) {
    if (p.attachedTo !== target || isTextBlank(s, p)) continue;
    if (p.code === "32067") result.piercing = true;
    if (p.code === "32068") result.stalwart = true;
  }
  return result;
}

/** Step-one threat, acceleration and all resulting threat windows finish first. */
export function sabretoothVillainPhaseStepOne(s: GameState): Effect[] {
  return active(s) && s.scheme.code === "32063b" && sabretoothKelly(s)
    ? [S("step-one", { actorId: s.firstPlayerId })]
    : [];
}
/** 1B has a printed dash, so its threat never advances the main scheme. */
export function sabretoothMainThreatLimit(s: GameState): number | null {
  if (!active(s)) return null;
  return s.scheme.code === "32063b"
    ? 0
    : s.scheme.code === "32064b"
      ? 9 * s.playerCount
      : null;
}
export function sabretoothMainCompleted(s: GameState): Effect[] | null {
  return active(s) && s.scheme.code === "32064b"
    ? [S("main-completed", { actorId: s.firstPlayerId })]
    : null;
}
/** Native base threat plus native Hinder on reveal. PUT does not add Hinder. */
export function sabretoothSideSchemeBaseThreat(
  s: GameState,
  p: Pick<Piece, "code">,
): number | null {
  if (p.code === "32065a") return 5 * s.playerCount;
  if (p.code === "32071") return 2;
  if (p.code === "32072") return 4;
  return null;
}
/** The host retains Find until its same-piece flip. Medical's healing and
 * Victory are mandatory When Defeated abilities in the same native window;
 * first-player ordering applies, with no fixed heal/Victory priority. */
export function sabretoothSideSchemeDefeated(
  s: GameState,
  p: Piece,
  defeatingPlayerId: string,
): Effect[] | null {
  if (!["32065a", "32071", "32072"].includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  return [
    S(`defeated-${p.code}`, {
      piece: p,
      actorId: defeatingPlayerId,
    }),
  ];
}
/** A replacement of the entire undefended attack's recipient, never an
 * Overkill packet from an attack defended by an ally. Preserve the attack's
 * native amount, prevention, Piercing, Tough and defeat timing. */
export function sabretoothUndefendedTarget(
  s: GameState,
  receipt: SabretoothUndefendedReceipt,
): string | null {
  const kelly = sabretoothKelly(s);
  return kelly &&
    receipt.undefended &&
    !sabretoothKellyTextBlank(s) &&
    sabretoothKellyController(s) === receipt.playerId &&
    ["hero", `hero:${receipt.playerId}`].includes(receipt.target)
    ? kelly.id
    : null;
}

export function sabretoothAfterActivation(
  s: GameState,
  receipt: SabretoothActivationReceipt,
): Effect[] {
  return active(s) &&
    receipt.performed &&
    !!receipt.token &&
    receipt.enemyId === s.villain.id &&
    villainCodes.includes(receipt.enemyCode) &&
    !isTextBlank(s, s.villain) &&
    !state(s)?.completedActivationIds.includes(receipt.token)
    ? [S("regenerate", { receipt, actorId: receipt.playerId })]
    : [];
}

/** Native main schemes store their active face in scheme.code rather than
 * fabricating a physical Piece to reveal their front. */
export function sabretoothMainRevealed(s: GameState, code: string): Effect[] {
  return code === "32064a"
    ? [S("deal-each", { actorId: s.firstPlayerId })]
    : [];
}

export function sabretoothReveal(s: GameState, p: Piece): Effect[] | null {
  if (!SABRETOOTH_SCRIPT_CODES.includes(p.code as never)) return null;
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "32064a":
      return sabretoothMainRevealed(s, p.code);
    case "32067":
    case "32068":
      return [S("attach", { piece: p, actorId: s.activePlayerId })];
    case "32069":
      return [S("strikes", { sourceId: p.id, actorId: s.activePlayerId })];
    case "32070":
      return [S("savage", { sourceId: p.id, actorId: s.activePlayerId })];
    default:
      return [];
  }
}
/** Numeric icons stay native. Regeneration discards never call this hook. */
export function sabretoothBoost(s: GameState, p: Piece): Effect[] | null {
  if (!SABRETOOTH_SCRIPT_CODES.includes(p.code as never)) return null;
  if (isTextBlank(s, p)) return [];
  if (attachmentCodes.includes(p.code)) return [S("attach", { piece: p })];
  return p.code === "32069" && s.attack?.id
    ? [S("strikes-boost", { sourceId: p.id, attackId: s.attack.id })]
    : [];
}
export function sabretoothBoostAllyDefeated(
  _s: GameState,
  receipt: { attackId: string; sourceId: string; allyId: string },
): Effect[] {
  return receipt.attackId && receipt.sourceId && receipt.allyId
    ? [E("threat", { target: "main", amount: 2, source: receipt.sourceId })]
    : [];
}

export function sabretoothActionOptions(
  s: GameState,
  id: string,
  ports: SabretoothPorts,
): Option[] {
  const p = s.attachments.find((a) => a.id === id);
  return p &&
    attachmentCodes.includes(p.code) &&
    p.attachedTo === s.villain.id &&
    s.player.form === "hero" &&
    !isTextBlank(s, p) &&
    ports.canPay(s, 3, typedCost)
    ? [
        {
          id: `discard:${p.id}`,
          label: `Discard ${cards.get(p.code)!.name} · spend energy, mental and physical`,
          image: p.code,
          effects: [S("discard-attachment", { id, actorId: s.activePlayerId })],
        },
      ]
    : [];
}
const defenseKey = (p: Piece, r: SabretoothDefenseReceipt) =>
  `${p.id}:${r.attackId}`;
export function sabretoothHeroDefended(
  s: GameState,
  receipt: SabretoothDefenseReceipt,
  ports: SabretoothPorts,
): Option[] {
  const defender = s.players.find(
    (seat) => seat.id === receipt.playerId && !seat.eliminated,
  );
  if (!defender) return [];
  const p = protect(s);
  const view = seatView(s, defender);
  return p &&
    receipt.attackId &&
    receipt.heroDefended &&
    receipt.enemyId === s.villain.id &&
    villainCodes.includes(receipt.enemyCode) &&
    sabretoothKellyController(s) === receipt.playerId &&
    view.player.hp > 0 &&
    view.player.form === "hero" &&
    view.player.exhausted &&
    ports.canReadyHero(view) &&
    ports.canPay(view, 2) &&
    !state(s)?.usedDefenseResponses.includes(defenseKey(p, receipt))
    ? [
        {
          id: `protect:${p.id}:${receipt.attackId}`,
          label: "Protect the Senator · spend 2 resources to ready your hero",
          image: p.code,
          effects: [
            S("protect", {
              sourceId: p.id,
              receipt,
              actorId: receipt.playerId,
            }),
          ],
        },
      ]
    : [];
}

export function resolveSabretoothEffect(
  s: GameState,
  e: Effect,
  ports: SabretoothPorts,
): boolean {
  if (!e.type.startsWith("sabretooth:")) return false;
  switch (e.type) {
    case "sabretooth:step-one": {
      const kelly = sabretoothKelly(s);
      if (active(s) && s.scheme.code === "32063b" && kelly)
        ports.damage(
          s,
          kelly.id,
          s.scheme.threat >= 6 * s.playerCount ? 3 : 2,
          "32063b",
        );
      break;
    }
    case "sabretooth:main-completed": {
      const kelly = sabretoothKelly(s);
      if (kelly && s.scheme.code === "32064b")
        ports.defeatKelly(s, kelly.id, "32064b");
      break;
    }
    case "sabretooth:defeated-32065a": {
      const p = e.piece as Piece;
      const saved = state(s);
      need(
        p.code === "32065a" && saved?.kelly?.attachedTo === p.id,
        "Find the Senator must retain its actual attached Robert Kelly.",
      );
      delete saved!.kelly!.attachedTo;
      saved!.controllerId = s.firstPlayerId;
      // The printed instruction advances to 2A before flipping Find. Keep
      // the same physical source available across any native advance pauses.
      ports.advanceMain(s, "32064a", [
        S("flip-find", { id: p.id, actorId: s.firstPlayerId }),
      ]);
      break;
    }
    case "sabretooth:flip-find": {
      const p = s.sideSchemes.find((piece) => piece.id === e.id);
      if (p?.code === "32065a") ports.flipFind(s, p);
      break;
    }
    case "sabretooth:defeated-32071": {
      const kelly = sabretoothKelly(s);
      if (kelly) ports.heal(s, kelly.id, 2, (e.piece as Piece).id);
      break;
    }
    case "sabretooth:defeated-32072":
      ports.queue(
        s,
        E("enemyAttack", {
          id: s.villain.id,
          actorId: e.actorId,
        }),
      );
      break;
    case "sabretooth:deal-each":
      for (const seat of playerOrder(s)) ports.dealEncounter(s, seat.id);
      break;
    case "sabretooth:attach":
      if (villainCodes.includes(s.villain.code))
        ports.attach(s, e.piece as Piece, s.villain.id);
      break;
    case "sabretooth:regenerate": {
      const receipt = e.receipt as SabretoothActivationReceipt;
      if (!sabretoothAfterActivation(s, receipt).length) break;
      const saved = state(s);
      need(
        saved,
        "Sabretooth's native setup must establish its scenario state.",
      );
      saved!.completedActivationIds.push(receipt.token);
      const { piece } = ports.discardTop(s);
      // A boost star is an ability symbol, not a numeric boost icon.
      if (piece)
        ports.heal(
          s,
          s.villain.id,
          cards.get(piece.code)?.boost || 0,
          s.villain.id,
        );
      break;
    }
    case "sabretooth:strikes": {
      if (!sabretoothKelly(s)) break;
      if (s.player.form === "hero" && ports.canExhaustHero(s))
        ports.choose(
          s,
          "Sabretooth Strikes",
          "Exhaust your hero to prevent 1 damage to Robert Kelly?",
          [
            {
              id: "exhaust",
              label: "Exhaust your hero · prevent the damage",
              effects: [S("strikes-prevent", { actorId: s.activePlayerId })],
            },
            {
              id: "damage",
              label: "Deal 1 damage to Robert Kelly",
              effects: [
                S("strikes-damage", {
                  sourceId: e.sourceId,
                  actorId: s.activePlayerId,
                }),
              ],
            },
          ],
        );
      else
        ports.queue(
          s,
          S("strikes-damage", {
            sourceId: e.sourceId,
            actorId: s.activePlayerId,
          }),
        );
      break;
    }
    case "sabretooth:strikes-prevent":
      need(
        s.player.form === "hero" && ports.canExhaustHero(s),
        "Sabretooth Strikes requires a ready hero who can exhaust.",
      );
      ports.exhaustHero(s);
      break;
    case "sabretooth:strikes-damage": {
      const kelly = sabretoothKelly(s);
      if (kelly) ports.damage(s, kelly.id, 1, e.sourceId);
      break;
    }
    case "sabretooth:strikes-boost":
      ports.registerAllyDefeatBoost(s, e.sourceId, e.attackId);
      break;
    case "sabretooth:savage":
      ports.queue(
        s,
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: s.villain.id,
          activation: {
            enemyId: s.villain.id,
            playerId: s.activePlayerId,
            kind: s.player.form === "hero" ? "attack" : "scheme",
            modifier: s.villain.hp === s.villain.maxHp ? 1 : 0,
          },
          actorId: s.activePlayerId,
          source: e.sourceId,
        }),
      );
      break;
    case "sabretooth:discard-attachment": {
      const option = sabretoothActionOptions(s, e.id, ports)[0];
      need(
        option,
        "The Sabretooth attachment cannot be discarded by this hero action.",
      );
      ports.pay(
        s,
        cards.get(s.attachments.find((p) => p.id === e.id)!.code)!.name,
        3,
        [...typedCost],
        [S("discard-paid", { id: e.id })],
        e.id,
      );
      break;
    }
    case "sabretooth:discard-paid":
      if (s.attachments.some((p) => p.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "sabretooth:protect": {
      const receipt = e.receipt as SabretoothDefenseReceipt;
      need(
        sabretoothHeroDefended(s, receipt, ports).some(
          (o) => o.effects[0].sourceId === e.sourceId,
        ),
        "Protect the Senator requires the controller's actual hero defense.",
      );
      ports.pay(
        s,
        "Protect the Senator",
        2,
        [],
        [
          S("protect-paid", {
            sourceId: e.sourceId,
            receipt,
            actorId: receipt.playerId,
          }),
        ],
        e.sourceId,
      );
      break;
    }
    case "sabretooth:protect-paid": {
      const receipt = e.receipt as SabretoothDefenseReceipt;
      const saved = state(s);
      const key = `${e.sourceId}:${receipt.attackId}`;
      need(
        saved && !saved.usedDefenseResponses.includes(key),
        "Protect the Senator has already responded to this attack.",
      );
      saved!.usedDefenseResponses.push(key);
      const defender = s.players.find(
        (seat) => seat.id === receipt.playerId && !seat.eliminated,
      );
      if (!defender) break;
      const view = seatView(s, defender);
      if (
        view.player.hp > 0 &&
        view.player.form === "hero" &&
        ports.canReadyHero(view)
      )
        ports.readyHero(view);
      break;
    }
    default:
      throw Error(`Unknown Sabretooth effect: ${e.type}`);
  }
  return true;
}
