import { isTextBlank } from "./card-text.js";
import { seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };

export const EXPERIMENTAL_WEAPONS_SCRIPT_CODES = [
  "04072",
  "04073",
  "04074",
  "04075",
] as const;
const names = new Map(catalog.map((c) => [c.code, c.name]));
const requirements: Record<string, Resource[]> = {
  "04072": ["energy", "physical"],
  "04073": ["energy", "mental"],
  "04074": ["mental", "physical"],
  "04075": ["energy", "mental", "physical"],
};
const W = (name: string, fields: Record<string, unknown> = {}): Effect => ({
  type: `experimental-weapons:${name}`,
  ...fields,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
export interface ExperimentalWeaponsPorts extends Pick<
  MutagenEnginePorts,
  "queue" | "choose" | "attach" | "pay" | "canPay" | "discardPiece"
> {
  discardHand(s: GameState, id: string): void;
}
function activeAttachments(s: GameState, enemyId: string, code: string) {
  return s.attachments.filter(
    (p) => p.code === code && p.attachedTo === enemyId && !isTextBlank(s, p),
  );
}
/** Latch when the villain actually attacks. The granted keyword belongs to
 * that attack even if Laser Rifle later leaves play or becomes blank. */
export function experimentalWeaponsRanged(
  s: GameState,
  enemyId: string,
): boolean {
  return (
    enemyId === s.villain.id &&
    activeAttachments(s, enemyId, "04072").length > 0
  );
}
/** Retaliate values add to the villain's other active sources. */
export function experimentalWeaponsRetaliate(
  s: GameState,
  enemyId: string,
): number {
  return enemyId === s.villain.id
    ? activeAttachments(s, enemyId, "04073").length
    : 0;
}
export function experimentalWeaponsReveal(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return requirements[p.code] ? [W("attach", { piece: p })] : null;
}
export function experimentalWeaponsActions(s: GameState, p: Piece): Option[] {
  const resources = requirements[p.code];
  if (
    !resources ||
    s.player.form !== "hero" ||
    isTextBlank(s, p) ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  return [
    {
      id: "remove",
      label: `Spend ${resources.join(" + ")} resources · discard ${names.get(p.code)}`,
      image: p.code,
      effects: [W("remove-cost", { id: p.id })],
    },
  ];
}
export function experimentalWeaponsActionEffects(
  s: GameState,
  p: Piece,
  action: string | undefined,
): Effect[] | null {
  if (!requirements[p.code]) return null;
  const selected = experimentalWeaponsActions(s, p).find(
    (o) => !action || action === "special" || o.id === action,
  );
  need(selected, "This Experimental Weapons Hero Action is not available.");
  return selected!.effects;
}
/** Only actual identity damage from this completed villain attack satisfies
 * Power Gauntlets. A teammate defender becomes the attacked player. */
export function experimentalWeaponsAttackResponses(
  s: GameState,
  enemyId: string,
  playerId: string,
  identityDamage: number,
): MutagenForcedResponse[] {
  if (enemyId !== s.villain.id || identityDamage <= 0) return [];
  const seat = s.players.find((p) => p.id === playerId && !p.eliminated);
  if (!seat || !seatView(s, seat).player.hand.length) return [];
  return activeAttachments(s, enemyId, "04074").map((p) => ({
    id: `${p.id}:power-gauntlets`,
    sourceId: p.id,
    title: "Power Gauntlets",
    effects: [
      W("discard-choice", {
        id: p.id,
        playerId,
        actorId: playerId,
        mandatory: true,
      }),
    ],
  }));
}
export function resolveExperimentalWeaponsEffect(
  s: GameState,
  e: Effect,
  ports: ExperimentalWeaponsPorts,
): boolean {
  if (!e.type.startsWith("experimental-weapons:")) return false;
  switch (e.type) {
    case "experimental-weapons:attach":
      if (!s.attachments.some((p) => p.id === e.piece.id))
        ports.attach(s, e.piece, s.villain.id);
      break;
    case "experimental-weapons:remove-cost": {
      const p = s.attachments.find((p) => p.id === e.id);
      need(
        p && experimentalWeaponsActions(s, p).length,
        "The Experimental Weapons Hero Action is no longer available.",
      );
      const resources = requirements[p!.code];
      need(
        ports.canPay(s, resources.length, resources),
        "The required resource types cannot be paid.",
      );
      ports.pay(
        s,
        resources.length,
        resources,
        [W("remove-paid", { id: p!.id })],
        names.get(p!.code)!,
        true,
      );
      break;
    }
    case "experimental-weapons:remove-paid":
      if (s.attachments.some((p) => p.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "experimental-weapons:discard-choice": {
      if (!s.players.some((p) => p.id === e.playerId && !p.eliminated)) break;
      const options = s.player.hand.map((p) => ({
        id: p.id,
        label: names.get(p.code) || p.code,
        image: p.code,
        effects: [
          W("discard", {
            id: p.id,
            playerId: e.playerId,
            actorId: e.playerId,
            mandatory: true,
          }),
        ],
      }));
      if (options.length)
        ports.choose(
          s,
          "Power Gauntlets",
          "Discard 1 card from your hand.",
          options,
        );
      break;
    }
    case "experimental-weapons:discard":
      if (s.player.hand.some((p) => p.id === e.id)) ports.discardHand(s, e.id);
      break;
    default:
      throw Error(`Unknown Experimental Weapons effect: ${e.type}`);
  }
  return true;
}
