import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Attack, Effect, GameState, Option, Piece } from "./types.js";

export const ABSORBING_MAN_SCRIPT_CODES = [
  "04076",
  "04077",
  "04078",
  "04079a",
  "04079b",
  "04080",
  "04081",
  "04082",
  "04083",
  "04084",
  "04085",
  "04086",
  "04087",
  "04088",
  "04089",
  "04090",
  "04091",
  "04092",
] as const;
export interface AbsorbingManState {
  delay: number;
  currentMain: Piece;
  villainDeck: Piece[];
}
const definitions = new Map(catalog.map((c) => [c.code, c]));
const A = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `absorbing:${name}`,
  ...args,
});
const environments = ["04080", "04081", "04082", "04083"];
const isAbsorbing = (s: GameState) =>
  ["04076", "04077", "04078"].includes(s.villain.code);
export interface AbsorbingManPorts extends MutagenEnginePorts {
  putEnvironment(s: GameState, p: Piece): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  indirect(s: GameState, playerId: string, amount: number, source: Piece): void;
  giveTough(s: GameState): boolean;
  discardHand(s: GameState, id: string): void;
  handResources(s: GameState, p: Piece): number;
  controlledCards(s: GameState): Piece[];
}
export function absorbingTraits(s: GameState): string[] {
  if (!isAbsorbing(s)) return [];
  const traits = s.sideSchemes.some(
    (p) => p.code === "04092" && !isTextBlank(s, p),
  )
    ? ["Ice", "Metal", "Stone", "Wood"]
    : [];
  if (!isTextBlank(s, s.villain))
    for (const p of s.environments || []) {
      traits.push(
        ...(definitions.get(p.code)?.traits || "")
          .split(/\.\s*/)
          .filter(Boolean),
      );
    }
  return [...new Set(traits)];
}
function has(s: GameState, trait: string) {
  return absorbingTraits(s).includes(trait);
}
function indirect(
  s: GameState,
  amount: number,
  p: Piece,
  playerId = s.activePlayerId,
): Effect {
  return A("indirect", { amount, piece: p, playerId, actorId: playerId });
}
export function absorbingReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(ABSORBING_MAN_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  if (p.code === "04084") return [A("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04077":
      return [A("power")];
    case "04085":
      return [A("stall", { piece: p, before: s.scheme.threat })];
    case "04086":
      return [
        A("activate", {
          playerId: s.activePlayerId,
          modifier: Number(has(s, "Stone")),
          kind: s.player.form === "hero" ? "attack" : "scheme",
        }),
      ];
    case "04087":
      return s.player.form === "hero"
        ? [indirect(s, 3 + Number(has(s, "Metal")), p)]
        : [
            {
              type: "threat",
              target: "main",
              amount: 2 + Number(has(s, "Metal")),
            },
          ];
    case "04088":
      return [
        { type: "randomDiscard" },
        ...(has(s, "Wood") ? [A("discard-controlled")] : []),
      ];
    case "04089":
      return [
        ...(has(s, "Ice") ? [{ type: "exhaust", id: "hero" }] : []),
        ...(has(s, "Metal")
          ? [A("tough"), { type: "heal", target: s.villain.id, amount: 1 }]
          : []),
        ...(has(s, "Stone") ? [A("boost")] : []),
        ...(has(s, "Wood") ? [{ type: "randomDiscard" }] : []),
      ];
    case "04090":
      return [
        { type: "status", target: "hero", status: "stunned" },
        ...(has(s, "Ice") ? [indirect(s, 2, p)] : []),
      ];
    case "04091":
      return playerOrder(s).map((seat) =>
        A("avalanche", { piece: p, playerId: seat.id, actorId: seat.id }),
      );
    default:
      return [];
  }
}
export function absorbingBoost(s: GameState, p: Piece): Effect[] | null {
  if (environments.includes(p.code)) return [A("environment", { piece: p })];
  if (["04084", "04092"].includes(p.code))
    return [A("reveal", { piece: p, playerId: s.activePlayerId })];
  if (p.code === "04085")
    return (s.absorbingMan?.delay || 0) >= 5 ? [indirect(s, 1, p)] : [];
  if (p.code === "04088")
    return has(s, "Stone") || has(s, "Wood")
      ? [{ type: "status", target: "hero", status: "stunned" }]
      : [];
  if (p.code === "04090")
    return has(s, "Ice") || has(s, "Metal") ? [A("tough")] : [];
  return null;
}
export function absorbingActivation(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    enemyId !== s.villain.id ||
    s.villain.code !== "04078" ||
    isTextBlank(s, s.villain)
  )
    return [];
  return [
    ...(has(s, "Ice") || has(s, "Stone")
      ? [{ type: "threat", target: "main", amount: 1, actorId: playerId }]
      : []),
    ...(has(s, "Metal") || has(s, "Wood")
      ? [indirect(s, 1, s.villain, playerId)]
      : []),
  ];
}
export function absorbingAttackResponses(
  s: GameState,
  a: Attack,
  playerId: string,
): MutagenForcedResponse[] {
  if (a.attacker !== s.villain.id || !isAbsorbing(s)) return [];
  const responses: MutagenForcedResponse[] = [];
  const activation = absorbingActivation(s, a.attacker, playerId);
  if (activation.length)
    responses.push({
      id: `${a.id}:absorbing-activation`,
      sourceId: s.villain.id,
      title: "Absorbing Man",
      effects: activation,
    });
  // At attack completion a defender killed by attack damage still defended.
  // The engine already clears an ally lost during boosts before dealing damage.
  if (
    a.eventDefense ||
    (a.defender && a.defender !== "none") ||
    (a.originalTarget &&
      a.originalTarget !== "hero" &&
      !a.originalTarget.startsWith("hero:"))
  )
    return responses;
  const amount = (s.absorbingMan?.delay || 0) >= 5 ? 2 : 1;
  for (const p of s.environments || []) {
    if (!environments.includes(p.code) || isTextBlank(s, p)) continue;
    const effects =
      p.code === "04080"
        ? [indirect(s, amount, p, playerId)]
        : p.code === "04081"
          ? [{ type: "threat", target: "main", amount }]
          : p.code === "04082"
            ? [{ type: "heal", target: s.villain.id, amount }]
            : [A("discard-resources", { amount, actorId: playerId })];
    responses.push({
      id: `${a.id}:${p.id}`,
      sourceId: p.id,
      title: definitions.get(p.code)!.name,
      effects: effects.map((e) => ({ ...e, actorId: playerId })),
    });
  }
  return responses;
}
export function absorbingActions(s: GameState, p: Piece): Option[] {
  if (
    p.code !== "04084" ||
    s.player.form !== "hero" ||
    isTextBlank(s, p) ||
    !s.attachments.some((x) => x.id === p.id)
  )
    return [];
  return [
    {
      id: "remove",
      label: "Spend physical · shuffle Ball and Chain into the encounter deck",
      image: p.code,
      effects: [A("remove", { id: p.id })],
    },
  ];
}
export function resolveAbsorbingEffect(
  s: GameState,
  e: Effect,
  ports: AbsorbingManPorts,
): boolean {
  if (!e.type.startsWith("absorbing:")) return false;
  switch (e.type) {
    case "absorbing:delay":
      if (s.absorbingMan && !isTextBlank(s, s.absorbingMan.currentMain))
        s.absorbingMan.delay++;
      break;
    case "absorbing:environment":
      ports.putEnvironment(s, e.piece);
      break;
    case "absorbing:reveal":
      ports.reveal(s, e.piece, e.playerId);
      break;
    case "absorbing:indirect":
      ports.indirect(s, e.playerId, e.amount, e.piece);
      break;
    case "absorbing:tough":
      ports.giveTough(s);
      break;
    case "absorbing:boost":
      ports.giveBoost(s, s.villain.id, "next");
      break;
    case "absorbing:attach":
      if (isAbsorbing(s)) ports.attach(s, e.piece, s.villain.id);
      break;
    case "absorbing:power": {
      if (s.sideSchemes.some((p) => p.code === "04092")) {
        for (const seat of playerOrder(s)) ports.dealEncounter(s, seat.id);
      } else {
        // Discard pile is public; only shuffle when the deck was searched.
        let p = s.encounter.discard.find((p) => p.code === "04092");
        if (!p) {
          p = s.encounter.deck.find((p) => p.code === "04092");
          ports.revealHidden(s);
          ports.shuffleEncounter(s);
        }
        if (p) ports.reveal(s, p, s.firstPlayerId);
      }
      break;
    }
    case "absorbing:stall":
      ports.queue(
        s,
        {
          type: "threat",
          target: "main",
          amount: Math.floor((s.absorbingMan?.delay || 0) / 2),
        },
        A("stall-after", { piece: e.piece, before: e.before }),
      );
      break;
    case "absorbing:stall-after":
      if (s.scheme.threat <= e.before)
        ports.queue(s, {
          type: "surge",
          sourceCode: e.piece.code,
          sourceId: e.piece.id,
        });
      break;
    case "absorbing:activate":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: e.modifier,
        });
      break;
    case "absorbing:remove": {
      const p = s.attachments.find((p) => p.id === e.id);
      if (
        !p ||
        !absorbingActions(s, p).length ||
        !ports.canPay(s, 1, ["physical"])
      )
        throw Error(
          "Spend a physical resource in hero form to remove Ball and Chain.",
        );
      ports.pay(
        s,
        1,
        ["physical"],
        [A("shuffle", { id: p.id })],
        "Ball and Chain",
        true,
      );
      break;
    }
    case "absorbing:shuffle": {
      const p = s.attachments.find((p) => p.id === e.id);
      if (p) {
        ports.revealHidden(s);
        ports.shuffleIntoEncounter(s, p);
      }
      break;
    }
    case "absorbing:discard-controlled": {
      const choices = ports.controlledCards(s).map((p) => ({
        id: p.id,
        image: p.code,
        label: definitions.get(p.code)!.name,
        effects: [{ type: "discardPiece", id: p.id }],
      }));
      if (choices.length)
        ports.choose(
          s,
          "Piercing Thorns",
          "Discard 1 card you control.",
          choices,
        );
      break;
    }
    case "absorbing:discard-resources": {
      const choices = s.player.hand
        .filter((p) => ports.handResources(s, p) > 0)
        .map((p) => ({
          id: p.id,
          label: definitions.get(p.code)!.name,
          image: p.code,
          effects: [A("discard-resource", { id: p.id, amount: e.amount })],
        }));
      if (e.amount > 0 && choices.length)
        ports.choose(
          s,
          "Abandoned Facility",
          `Discard ${e.amount} more resource icon${e.amount === 1 ? "" : "s"} from your hand.`,
          choices,
        );
      break;
    }
    case "absorbing:discard-resource": {
      const p = s.player.hand.find((p) => p.id === e.id);
      if (p) {
        const remaining = e.amount - ports.handResources(s, p);
        ports.discardHand(s, p.id);
        if (remaining > 0)
          ports.queue(s, A("discard-resources", { amount: remaining }));
      }
      break;
    }
    case "absorbing:avalanche": {
      if (!s.players.some((p) => p.id === e.playerId && !p.eliminated)) break;
      const options: Option[] = [
        {
          id: "damage",
          label: `Take ${(s.absorbingMan?.delay || 0) >= 5 ? 3 : 2} indirect damage`,
          effects: [
            indirect(
              s,
              (s.absorbingMan?.delay || 0) >= 5 ? 3 : 2,
              e.piece,
              e.playerId,
            ),
          ],
        },
      ];
      if (ports.canPay(s, 1, ["energy"]))
        options.unshift({
          id: "pay",
          label: "Spend an energy resource",
          effects: [A("avalanche-pay")],
        });
      ports.choose(
        s,
        "Avalanche!",
        "Spend an energy resource or take indirect damage.",
        options,
      );
      break;
    }
    case "absorbing:avalanche-pay":
      ports.pay(s, 1, ["energy"], [], "Avalanche!", false);
      break;
    default:
      throw Error(`Unknown Absorbing Man effect: ${e.type}`);
  }
  return true;
}
