import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import { statusCards } from "./keywords.js";
import type { PaymentSource } from "./payment.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const pack = (type: string, args: Record<string, unknown> = {}) =>
  E("wasp-pack:" + type, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const piece = (s: GameState, id: string) =>
  allInPlay(s).find((p) => p.id === id);

/** Exact reprints use the existing native rules, preserving their retail IDs. */
export const WASP_PACK_CORE_ALIASES = [
  "13015",
  "13021",
  "13022",
  "13023",
] as const;
/** Boot Camp's complete printed text includes controller-aware static bonuses,
 * control transfer on entry, and its one-per-player limit in the interpreter. */
export const WASP_PACK_COMPILED_CODES = ["13016"] as const;
export const WASP_PACK_SCRIPT_CODES = [
  "13011",
  "13012",
  "13013",
  "13014",
  "13017",
  "13018",
  "13019",
  "13024",
  "13025",
  "13031",
  "13032",
  "13033",
  "13034",
] as const;

export interface WaspPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface WaspPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  /** Discard one physical status card, then recompute Steady's effective state. */
  discardHeroStatus(s: GameState, kind: "stunned" | "confused"): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  enemyTargets(s: GameState): WaspPackTarget[];
  minionTargets(s: GameState): WaspPackTarget[];
  schemeTargets(s: GameState): WaspPackTarget[];
  canGiveStatus(s: GameState, target: string, status: "tough"): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId: string,
    targetCode: string,
  ): boolean;
}

/** Resource types have already been allocated, including wild-as-energy.
 * Printed cost zero makes the range deterministic; a future cost increase can
 * require the player to allocate resources between the cost and overpayment. */
export function waspPackEnergyOverpayRange(paid: Resource[], finalCost = 0) {
  const energy = paid.filter((resource) => resource === "energy").length;
  const cost = Math.max(0, Math.floor(finalCost));
  return {
    min: Math.max(0, energy - cost),
    max: Math.min(energy, Math.max(0, paid.length - cost)),
  };
}

/** Entry interrupt must run before ally-limit enforcement and zero-HP defeat.
 * Put-into-play supplies no payment and therefore receives no pym counters. */
export function waspPackAllyPlayed(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
  finalCost = 0,
  energyOverpaid?: number,
) {
  if (p.code !== "13012") return;
  const range = waspPackEnergyOverpayRange(paid, finalCost);
  const amount = energyOverpaid ?? range.max;
  need(
    Number.isInteger(amount) && amount >= range.min && amount <= range.max,
    "Wasp's pym counters require energy resources overpaid for her cost.",
  );
  p.counters = Math.min(3, amount);
}
export function waspPackAllyHP(s: GameState, p: Piece) {
  return p.code === "13012" && !isTextBlank(s, p) ? p.counters : 0;
}

/** Quincarrier is an exact expansion reprint, rather than a Core alias. Its
 * resource ability works in either form once its Avenger play requirement was
 * satisfied, and the payment host pays the exhaust cost normally. */
export function waspPackResourceSources(s: GameState): PaymentSource[] {
  return s.player.inPlay
    .filter((p) => p.code === "13025" && !p.exhausted && !isTextBlank(s, p))
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Quincarrier",
      resources: ["wild"],
      kind: "ability",
      description: "Exhaust · generate 1 wild resource",
    }));
}

/** Established hand-play bonuses expire at every phase boundary even if the
 * ally is exhausted or its printed text subsequently becomes blank. */
export function waspPackPhaseEnded(s: GameState) {
  for (const p of s.player.inPlay.filter((p) => p.code === "13019")) {
    p.bonusAtk = 0;
    p.bonusThw = 0;
  }
}

/** The host clears these existing temporary fields at the end of each phase. */
export function waspPackAllyEnter(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
  fromHand = false,
): Effect[] | null {
  if (p.code === "13012") return [];
  if (!["13011", "13018", "13019"].includes(p.code)) return null;
  if (!fromHand || isTextBlank(s, p)) return [];
  const effects =
    p.code === "13011"
      ? [
          E("damage", {
            target: s.villain.id,
            amount: paid.includes("physical") ? 3 : 2,
            source: p.id,
          }),
        ]
      : p.code === "13018"
        ? [E("draw", { amount: 1 })]
        : [pack("miles-choose", { id: p.id })];
  return [
    E("optional", {
      actorId: controller(s, p.id)?.id || s.activePlayerId,
      title: cards.get(p.code)!.name,
      text:
        p.code === "13011"
          ? "Deal " +
            (paid.includes("physical") ? 3 : 2) +
            " damage to the villain?"
          : p.code === "13018"
            ? "Draw 1 card after playing Ironheart from your hand?"
            : "Give Spider-Man +2 THW or +2 ATK until the end of the phase?",
      effects,
    }),
  ];
}

export function waspPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: WaspPackPorts,
): string | null {
  if (["13014", "13033"].includes(p.code))
    return "Available after you change to a hero form.";
  if (p.code === "13025" && !ports.hasTrait(s, "hero", "Avenger"))
    return "Your identity must have the Avenger trait.";
  if (p.code === "13013" && !s.player.stunned && !ports.minionTargets(s).length)
    return "Into the Fray requires a minion target.";
  if (p.code === "13032" && !s.player.stunned && !ports.enemyTargets(s).length)
    return "All for One requires an enemy target.";
  if (p.code === "13031") {
    if (!ports.hasTrait(s, "hero", "Avenger"))
      return "Your identity must have the Avenger trait.";
    if (
      !s.player.confused &&
      !ports.schemeTargets(s).some((target) => target.id === "main")
    )
      return "Running Interference requires threat on an eligible main scheme.";
  }
  if (
    p.code === "13034" &&
    !statusCards(s.player, "stunned") &&
    !statusCards(s.player, "confused")
  )
    return "Your hero has no stun or confuse status card to discard.";
  return null;
}

export function waspPackEvent(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "13013":
      return [
        E("target", {
          group: "minion",
          title: "Into the Fray",
          action: E("damage", {
            amount: 6,
            attack: true,
            source: "hero",
            // The dispatcher captures actual attack excess before its
            // responses. This removal is not a thwart; Crisis still applies.
            excessToMain: true,
          }),
        }),
      ];
    case "13014":
      return [
        E("target", {
          group: "enemy",
          title: "Surprise Attack",
          action: E("damage", {
            amount: paid.includes("physical") ? 4 : 3,
            attack: true,
            source: "hero",
          }),
        }),
      ];
    case "13031":
      return [
        E("thwart", {
          target: "main",
          amount: 2 + Math.min(3, Math.max(0, s.villain.stage)),
          action: true,
          source: "hero",
        }),
      ];
    case "13032":
      return [
        E("target", {
          group: "enemy",
          title: "All for One",
          action: pack("all-for-one", {
            selected: [],
            attack: true,
            source: "hero",
          }),
        }),
      ];
    case "13033":
      return [E("status", { target: "hero", status: "tough" })];
    case "13034":
      return [pack("conditioning")];
    default:
      return null;
  }
}

function formResponseCards(
  s: GameState,
  ports: WaspPackPorts,
  used: string[] = [],
) {
  return s.player.form === "hero"
    ? s.player.hand.filter(
        (p) =>
          ["13014", "13033"].includes(p.code) &&
          !used.includes(p.id) &&
          (p.code !== "13014" ||
            s.player.stunned ||
            ports.enemyTargets(s).length) &&
          (p.code !== "13033" || ports.canGiveStatus(s, "hero", "tough")) &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
      )
    : [];
}
/** Combine these with native identity/upgrade responses in one form window. */
export function waspPackFormResponseOptions(
  s: GameState,
  ports: WaspPackPorts,
): Option[] {
  return formResponseCards(s, ports).map((p) =>
    option(
      p.id,
      cards.get(p.code)!.name,
      [pack("form-pay", { id: p.id, used: [] })],
      p.code,
    ),
  );
}
export function waspPackFormChanged(s: GameState): Effect[] {
  return s.player.form === "hero" ? [pack("form-responses", { used: [] })] : [];
}

/** An engagement is addressed to that player's response window, including
 * drones and effects that move an already-in-play minion to another player. */
export function waspPackMinionEngaged(s: GameState, p: Piece): Effect[] {
  const playerId = p.engagedWith || s.activePlayerId;
  const seat = s.players.find(
    (seat) => seat.id === playerId && !seat.eliminated,
  );
  if (!seat || !s.minions.some((minion) => minion.id === p.id)) return [];
  const view = seatView(s, seat);
  if (view.player.form !== "hero") return [];
  return view.player.inPlay
    .filter((source) => source.code === "13017" && !isTextBlank(view, source))
    .map((source) =>
      E("optional", {
        actorId: playerId,
        title: "Lie in Wait",
        text:
          "Discard Lie in Wait to deal 3 attack damage to " +
          (cards.get(p.code)?.name || "the minion") +
          "?",
        effects: [pack("lie", { id: source.id, target: p.id })],
      }),
    );
}

function readyAvengers(s: GameState, ports: WaspPackPorts): WaspPackTarget[] {
  return [
    ...(!s.player.exhausted && ports.hasTrait(s, "hero", "Avenger")
      ? [{ id: "hero", label: "Your hero" }]
      : []),
    ...s.player.inPlay
      .filter(
        (p) =>
          cards.get(p.code)?.type_code === "ally" &&
          !p.exhausted &&
          ports.hasTrait(s, p.id, "Avenger"),
      )
      .map((p) => ({ id: p.id, label: cards.get(p.code)!.name, code: p.code })),
  ];
}

export function resolveWaspPackEffect(
  s: GameState,
  e: Effect,
  ports: WaspPackPorts,
): boolean {
  if (!e.type.startsWith("wasp-pack:")) return false;
  switch (e.type) {
    case "wasp-pack:miles-choose": {
      const p = piece(s, e.id);
      if (p?.code !== "13019" || isTextBlank(s, p)) break;
      ports.choose(
        s,
        "Spider-Man",
        "Choose a basic power to increase by 2 until the end of the phase.",
        [
          option(
            "attack",
            "+2 ATK",
            [pack("miles-power", { id: p.id, power: "attack" })],
            p.code,
          ),
          option(
            "thwart",
            "+2 THW",
            [pack("miles-power", { id: p.id, power: "thwart" })],
            p.code,
          ),
        ],
      );
      break;
    }
    case "wasp-pack:miles-power": {
      const p = piece(s, e.id);
      need(
        p?.code === "13019" && ["attack", "thwart"].includes(e.power),
        "Spider-Man's chosen power is unavailable.",
      );
      if (e.power === "attack") p!.bonusAtk = (p!.bonusAtk || 0) + 2;
      else p!.bonusThw = (p!.bonusThw || 0) + 2;
      break;
    }
    case "wasp-pack:lie": {
      const source = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "13017" && !isTextBlank(s, p),
      );
      const target = s.minions.find(
        (p) =>
          p.id === e.target &&
          (!p.engagedWith || p.engagedWith === s.activePlayerId),
      );
      need(
        source && target && s.player.form === "hero",
        "Lie in Wait requires the minion that engaged you and your hero form.",
      );
      ports.discardPiece(s, source!.id);
      ports.queue(
        s,
        E("damage", {
          target: target!.id,
          amount: 3,
          attack: true,
          source: "hero",
        }),
      );
      break;
    }
    case "wasp-pack:all-for-one": {
      need(s.player.form === "hero", "All for One requires hero form.");
      const selected = (e.selected || []) as string[];
      const characters = readyAvengers(s, ports).filter(
        (p) => !selected.includes(p.id),
      );
      if (!characters.length) {
        ports.queue(
          s,
          pack("all-for-one-finish", { target: e.target, selected }),
        );
        break;
      }
      ports.choose(
        s,
        "All for One",
        "Choose any number of ready Avenger characters you control (" +
          selected.length +
          " selected).",
        [
          ...characters.map((p) =>
            option(
              p.id,
              p.label,
              [
                pack("all-for-one", {
                  target: e.target,
                  selected: [...selected, p.id],
                }),
              ],
              p.code,
            ),
          ),
          option("finish", "Deal " + (3 + selected.length) + " damage", [
            pack("all-for-one-finish", { target: e.target, selected }),
          ]),
        ],
      );
      break;
    }
    case "wasp-pack:all-for-one-finish": {
      const selected = (e.selected || []) as string[];
      const characters = readyAvengers(s, ports);
      need(
        new Set(selected).size === selected.length &&
          selected.every((id) => characters.some((p) => p.id === id)),
        "Each selected character must be a distinct ready Avenger you control.",
      );
      for (const id of selected) {
        if (id === "hero") s.player.exhausted = true;
        else piece(s, id)!.exhausted = true;
      }
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 3 + selected.length,
          attack: true,
          source: "hero",
        }),
      );
      break;
    }
    case "wasp-pack:conditioning": {
      const statuses = (["stunned", "confused"] as const).filter(
        (kind) => statusCards(s.player, kind) > 0,
      );
      need(statuses.length, "Your hero has no stun or confuse status card.");
      ports.choose(
        s,
        "Athletic Conditioning",
        "Discard one status card from your hero.",
        statuses.map((kind) =>
          option(
            kind,
            "Discard 1 " +
              (kind === "stunned" ? "stun" : "confuse") +
              " status card",
            [pack("conditioned", { status: kind })],
          ),
        ),
      );
      break;
    }
    case "wasp-pack:conditioned":
      need(
        ["stunned", "confused"].includes(e.status) &&
          statusCards(s.player, e.status) > 0,
        "That status card is no longer on your hero.",
      );
      ports.discardHeroStatus(s, e.status);
      break;
    case "wasp-pack:form-responses": {
      const used = (e.used || []) as string[];
      const events = formResponseCards(s, ports, used);
      if (!events.length) break;
      ports.choose(
        s,
        "After changing form",
        "Choose a response, or continue.",
        [
          ...events.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [pack("form-pay", { id: p.id, used })],
              p.code,
            ),
          ),
          option("pass", "Continue", []),
        ],
      );
      break;
    }
    case "wasp-pack:form-pay": {
      const p = formResponseCards(s, ports, e.used || []).find(
        (p) => p.id === e.id,
      );
      need(p, "That form-change response cannot be played now.");
      ports.queue(
        s,
        E("payRequest", {
          title: cards.get(p!.code)!.name,
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            pack("form-paid", {
              id: p!.id,
              used: e.used || [],
              continuation: e.continuation,
            }),
          ],
        }),
      );
      break;
    }
    case "wasp-pack:form-paid": {
      const p = s.player.hand.find(
        (p) => p.id === e.id && ["13014", "13033"].includes(p.code),
      );
      need(p, "The response card is no longer in hand.");
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: p!.id,
          after: waspPackEvent(s, p!, e.paid || []),
          continuation: e.continuation || [
            pack("form-responses", { used: [...(e.used || []), p!.id] }),
          ],
        }),
      );
      break;
    }
    default:
      throw Error("Unknown Wasp pack effect: " + e.type);
  }
  return true;
}
