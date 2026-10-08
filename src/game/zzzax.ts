import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import corePlayers from "../data/core-player.json" with { type: "json" };

const definitions = new Map(
  ([...catalog, ...corePlayers] as Card[]).map((c) => [c.code, c]),
);
const card = (p: Pick<Piece, "code">): Card => definitions.get(p.code)!;
const identities = new Map(
  [...definitions.values()]
    .filter((c) => ["hero", "alter_ego"].includes(c.type_code))
    .map((c) => [`${c.set_code}:${c.type_code}`, c]),
);
const identitySets: Record<string, string> = {
  ant: "ant_man",
  wsp: "wasp",
  qsv: "quicksilver",
  scw: "scarlet_witch",
};
function identityCard(s: GameState): Card | undefined {
  if (s.player.ironheartIdentity) return card(s.player.ironheartIdentity);
  return identities.get(
    `${identitySets[s.heroId] || s.heroId}:${s.player.form === "hero" ? "hero" : "alter_ego"}`,
  );
}
function printedResources(c: Card): Resource[] {
  return (["energy", "mental", "physical", "wild"] as const).flatMap((r) =>
    Array<Resource>(Number(c[`resource_${r}`] || 0)).fill(r),
  );
}

export const ZZZAX_SCRIPT_CODES = [
  "29036",
  "29037",
  "29038",
  "29039",
  "29040",
] as const;

const Z = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zzzax:${name}`,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const alive = (s: GameState, id: string) =>
  s.players.some((seat) => seat.id === id && !seat.eliminated);

export interface ZzzaxIndirectRequest {
  playerId: string;
  amount: number;
  sourceId: string;
  sourceTitle: string;
  /** Native damage receipts, after every allocated packet and its responses:
   * identityDamageDealt preserves dealt damage through would-take prevention;
   * damageTaken totals damage actually taken by all allocated characters.
   * Both fields must survive JSON saves. Never infer either from HP deltas. */
  after?: Effect;
}
export interface ZzzaxPorts extends Pick<
  MutagenEnginePorts,
  "queue" | "choose" | "putMinion" | "attach" | "discardPiece"
> {
  indirect(s: GameState, request: ZzzaxIndirectRequest): void;
  /** Native remaining-HP and mandatory-prevention checks for a TAKE cost. */
  canTakeIndirectCost(s: GameState, amount: number): boolean;
  /** Includes Permanent and other native cannot-discard restrictions. */
  canDiscardControlled(s: GameState, p: Piece): boolean;
  /** Complete native leave interrupts and latch the actual paid discard cost.
   * Queue after only if the card was discarded, including when a subsequent
   * response moves it again. A shuffle-instead replacement is not a discard. */
  discardControlledCost(s: GameState, id: string, after: Effect): void;
}
type ActionPorts = Pick<
  ZzzaxPorts,
  "canTakeIndirectCost" | "canDiscardControlled"
>;

/** Printed resource replacement applies only to the attached seat's hand.
 * Every actual printed icon is replaced; zero icons remain zero. Haywires do
 * not multiply resources, change controlled cards, or generate resources. */
export function zzzaxHandResources(
  s: GameState,
  p: Piece,
  printed: readonly Resource[],
): Resource[] {
  return s.attachments.some(
    (x) =>
      x.code === "29038" &&
      ["hero", `hero:${s.activePlayerId}`].includes(x.attachedTo || "") &&
      !isTextBlank(s, x),
  ) && s.player.hand.some((x) => x.id === p.id)
    ? printed.map(() => "energy")
    : [...printed];
}
/** Do not use resourcesFor: generated payment abilities and target-specific
 * doubling are separate from these effective printed resource icons. */
export function effectivePrintedHandResources(
  s: GameState,
  p: Piece,
): Resource[] {
  return zzzaxHandResources(s, p, printedResources(card(p)));
}
export function zzzaxHandEnergy(s: GameState): number {
  return s.player.hand.reduce(
    (n, p) =>
      n +
      effectivePrintedHandResources(s, p).filter((r) => r === "energy").length,
    0,
  );
}
export function zzzaxControlledEnergy(s: GameState): number {
  return (
    Number(identityCard(s)?.resource_energy || 0) +
    s.player.inPlay.reduce(
      (n, p) => n + Number(card(p).resource_energy || 0),
      0,
    )
  );
}
export function zzzaxTotalEnergy(s: GameState): number {
  return zzzaxHandEnergy(s) + zzzaxControlledEnergy(s);
}
/** Dynamic modifiers, not total stats. Damage tokens remain unchanged when
 * controlled cards leave play, engagement changes, or printed text is blanked. */
export function zzzaxEnemyStats(
  s: GameState,
  p: Piece,
): { attack: number; health: number } {
  if (p.code !== "29037") return { attack: 0, health: 0 };
  const seat = s.players.find(
    (x) => x.id === (p.engagedWith || s.activePlayerId) && !x.eliminated,
  );
  const bonus =
    seat && !isTextBlank(s, p) ? zzzaxControlledEnergy(seatView(s, seat)) : 0;
  return { attack: bonus, health: bonus };
}

function removalSource(s: GameState, id: string): Piece | undefined {
  return [...s.attachments, ...(s.environments || [])].find(
    (p) => p.id === id && ["29038", "29039"].includes(p.code),
  );
}
function discardCosts(s: GameState, ports: ActionPorts): Piece[] {
  return s.player.inPlay.filter(
    (p) =>
      Number(card(p).resource_energy || 0) > 0 &&
      ports.canDiscardControlled(s, p),
  );
}
/** Encounter Hero Actions may be triggered by any active Hero. The acting
 * player must pay using their own controlled cards or characters. */
export function zzzaxActions(
  s: GameState,
  p: Piece,
  ports: ActionPorts,
): Option[] {
  if (
    s.phase !== "player" ||
    s.player.form !== "hero" ||
    !alive(s, s.activePlayerId) ||
    !removalSource(s, p.id) ||
    isTextBlank(s, p) ||
    (!discardCosts(s, ports).length && !ports.canTakeIndirectCost(s, 2))
  )
    return [];
  return [
    {
      id: "remove",
      label: `Discard a controlled card with printed energy or take 2 indirect damage · discard ${card(p).name}`,
      image: p.code,
      effects: [Z("remove-cost", { id: p.id, actorId: s.activePlayerId })],
    },
  ];
}
export function zzzaxActionEffects(
  s: GameState,
  p: Piece,
  action: string | undefined,
  ports: ActionPorts,
): Effect[] | null {
  if (!["29038", "29039"].includes(p.code)) return null;
  const option = zzzaxActions(s, p, ports).find((o) => o.id === action);
  need(option, "This encounter card's Hero Action is unavailable.");
  return option!.effects;
}

/** The host initializes fixed base threat and physically enters minions and
 * environments first. Haywire's attachment effect moves the actual piece. */
export function zzzaxReveal(s: GameState, p: Piece): Effect[] | null {
  if (
    !ZZZAX_SCRIPT_CODES.includes(p.code as (typeof ZZZAX_SCRIPT_CODES)[number])
  )
    return null;
  if (isTextBlank(s, p)) return [];
  const actorId = s.activePlayerId;
  switch (p.code) {
    case "29036":
      return playerOrder(s).map((seat) =>
        Z("feedback-player", { id: p.id, actorId: seat.id }),
      );
    case "29038":
      return [Z("haywire", { piece: p, actorId })];
    case "29040":
      return [Z("zzzap", { id: p.id, actorId })];
    default:
      return [];
  }
}
/** Return null for other modules. The moved card is the exact physical boost,
 * never a new instance; retained boosts must not be discarded afterwards. */
export function zzzaxBoost(
  s: GameState,
  p: Piece,
  playerId: string,
): { effects: Effect[]; retainsCard: boolean } | null {
  if (p.code !== "29037") return null;
  const seat = s.players.find((x) => x.id === playerId && !x.eliminated);
  const qualifies =
    !!seat && !isTextBlank(s, p) && zzzaxHandEnergy(seatView(s, seat)) >= 2;
  return {
    effects: qualifies
      ? [Z("put-minion", { piece: p, playerId, actorId: playerId })]
      : [],
    retainsCard: qualifies,
  };
}
/** Forced Interrupts run before villain-phase-begins Responses and regular
 * threat. First player orders simultaneous sources. Resource eligibility is
 * part of the resolving effect, not its unconditional phase-begins trigger. */
export function zzzaxVillainPhaseInterrupts(s: GameState): Effect[] {
  const sources = (s.environments || [])
    .filter((p) => p.code === "29039" && !isTextBlank(s, p))
    .map((p) => p.id);
  return sources.length > 1
    ? [Z("static-order", { remaining: sources, actorId: s.firstPlayerId })]
    : sources.map((id) => Z("static-source", { id, actorId: s.firstPlayerId }));
}

export function resolveZzzaxEffect(
  s: GameState,
  e: Effect,
  ports: ZzzaxPorts,
): boolean {
  if (!e.type.startsWith("zzzax:")) return false;
  switch (e.type) {
    case "zzzax:feedback-player":
      if (
        alive(s, s.activePlayerId) &&
        s.sideSchemes.some((p) => p.id === e.id)
      )
        ports.queue(s, {
          type: "threat",
          target: e.id,
          amount: zzzaxTotalEnergy(s),
          actorId: s.activePlayerId,
          source: e.id,
        });
      break;
    case "zzzax:haywire":
      if (alive(s, s.activePlayerId))
        ports.attach(s, e.piece, `hero:${s.activePlayerId}`);
      break;
    case "zzzax:put-minion":
      if (alive(s, e.playerId)) ports.putMinion(s, e.piece, e.playerId);
      break;
    case "zzzax:static-order": {
      const remaining = (e.remaining as string[]).filter((id) => {
        const p = (s.environments || []).find((x) => x.id === id);
        return p?.code === "29039" && !isTextBlank(s, p);
      });
      const options = remaining.map((id) => ({
        id,
        label: "Air Static",
        image: "29039",
        effects: [
          Z("static-source", { id, actorId: s.firstPlayerId }),
          Z("static-order", {
            remaining: remaining.filter((x) => x !== id),
            actorId: s.firstPlayerId,
          }),
        ],
      }));
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length > 1)
        ports.choose(
          s,
          "Forced interrupts",
          "The first player chooses the next simultaneous Air Static interrupt.",
          options,
        );
      break;
    }
    case "zzzax:static-source": {
      const p = (s.environments || []).find((x) => x.id === e.id);
      if (p?.code === "29039" && !isTextBlank(s, p))
        ports.queue(
          s,
          ...playerOrder(s).map((seat) =>
            Z("static-player", { id: p.id, actorId: seat.id }),
          ),
        );
      break;
    }
    case "zzzax:static-player": {
      const p = (s.environments || []).find((x) => x.id === e.id);
      if (
        p?.code === "29039" &&
        !isTextBlank(s, p) &&
        alive(s, s.activePlayerId) &&
        zzzaxTotalEnergy(s) > 0
      )
        ports.indirect(s, {
          playerId: s.activePlayerId,
          amount: 2,
          sourceId: e.id,
          sourceTitle: "Air Static",
        });
      break;
    }
    case "zzzax:zzzap":
      if (alive(s, s.activePlayerId))
        ports.indirect(s, {
          playerId: s.activePlayerId,
          amount: zzzaxHandEnergy(s),
          sourceId: e.id,
          sourceTitle: "Zzzap!",
          after: Z("zzzap-after", { actorId: s.activePlayerId }),
        });
      break;
    case "zzzax:zzzap-after":
      need(
        Number.isFinite(e.identityDamageDealt) && e.identityDamageDealt >= 0,
        "Zzzap! requires its completed native damage-dealt receipt.",
      );
      if (e.identityDamageDealt <= 1 && alive(s, s.activePlayerId))
        ports.queue(s, { type: "surge", actorId: s.activePlayerId });
      break;
    case "zzzax:remove-cost": {
      const p = removalSource(s, e.id);
      need(
        p && zzzaxActions(s, p, ports).length,
        "Hero Action is unavailable.",
      );
      const options: Option[] = discardCosts(s, ports).map((cost) => ({
        id: cost.id,
        label: `Discard ${card(cost).name} · printed energy`,
        image: cost.code,
        effects: [
          Z("remove-discard", {
            id: e.id,
            costId: cost.id,
            actorId: s.activePlayerId,
          }),
        ],
      }));
      if (ports.canTakeIndirectCost(s, 2))
        options.push({
          id: "indirect",
          label: "Take 2 indirect damage",
          effects: [
            Z("remove-indirect", { id: e.id, actorId: s.activePlayerId }),
          ],
        });
      options.push({ id: "cancel", label: "Cancel", effects: [] });
      ports.choose(
        s,
        card(p!).name,
        "Pay the full cost to discard this encounter card. Hand cards cannot pay the controlled-card discard cost.",
        options,
      );
      break;
    }
    case "zzzax:remove-discard": {
      const p = removalSource(s, e.id);
      need(
        p && zzzaxActions(s, p, ports).length,
        "Hero Action is unavailable.",
      );
      need(
        discardCosts(s, ports).some((cost) => cost.id === e.costId),
        "Discard an actual controlled card with printed energy.",
      );
      ports.discardControlledCost(
        s,
        e.costId,
        Z("remove-paid", { id: e.id, actorId: s.activePlayerId }),
      );
      break;
    }
    case "zzzax:remove-indirect": {
      const p = removalSource(s, e.id);
      need(
        p && zzzaxActions(s, p, ports).length,
        "Hero Action is unavailable.",
      );
      need(
        ports.canTakeIndirectCost(s, 2),
        "The full damage cost cannot be paid.",
      );
      ports.indirect(s, {
        playerId: s.activePlayerId,
        amount: 2,
        sourceId: e.id,
        sourceTitle: card(p!).name,
        after: Z("remove-damage-after", {
          id: e.id,
          actorId: s.activePlayerId,
        }),
      });
      break;
    }
    case "zzzax:remove-damage-after":
      need(
        Number.isFinite(e.damageTaken) && e.damageTaken >= 0,
        "The TAKE cost requires its completed native damage-taken receipt.",
      );
      if (e.damageTaken === 2)
        ports.queue(
          s,
          Z("remove-paid", { id: e.id, actorId: s.activePlayerId }),
        );
      break;
    case "zzzax:remove-paid":
      // Form and text were checked when the action began. Their changes during
      // cost responses must not undo a fully paid, already initiated effect.
      if (removalSource(s, e.id)) ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Zzzax effect: ${e.type}`);
  }
  return true;
}
