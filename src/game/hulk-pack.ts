import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { captainPackHasTrait } from "./captain-pack.js";
import { hulkThreatLocked } from "./hulk.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";
import type { PaymentSource } from "./payment.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const pack = (type: string, args: Record<string, unknown> = {}) =>
  E("hulk-pack:" + type, args);
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
  [s.villain, ...s.minions, ...allInPlay(s)].find((p) => p.id === id);
const traits = (c?: Card) => (c?.traits || "").split(/\.\s*/).filter(Boolean);
const allies = (s: GameState) =>
  allInPlay(s).filter((p) => cards.get(p.code)?.type_code === "ally");
const inspiredAllies = (s: GameState) =>
  allies(s).filter((p) => p.damage > 0 || p.exhausted);
const recipients = (s: GameState, p: Piece) =>
  playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (other) =>
          other.id !== p.id &&
          cards.get(other.code)?.name === cards.get(p.code)?.name,
      ),
  );

/** The six exact reprints retain the existing native Core implementations. */
export const HULK_PACK_CORE_ALIASES = [
  "10017",
  "10020",
  "10021",
  "10022",
  "10023",
  "10024",
] as const;
/** These two whole-text programs are executed by the declarative interpreter. */
export const HULK_PACK_COMPILED_CODES = ["10014", "10019"] as const;
export const HULK_PACK_SCRIPT_CODES = [
  "10011",
  "10012",
  "10013",
  "10015",
  "10016",
  "10018",
  "10029",
  "10030",
  "10031",
  "10032",
] as const;

export interface HulkPackTarget {
  id: string;
  label: string;
  code?: string;
}
/** Capture at attack damage resolution, before after-attack effects deal damage.
 * heroDamage is damage actually dealt to the identity, including Overkill; it
 * excludes ally damage, retaliation, and subsequent card abilities. */
export interface HulkPackAttackSnapshot {
  attacker: string;
  attackerCode: string;
  attackerStage?: number;
  isVillain: boolean;
  playerId: string;
  heroDamage: number;
  /** True when the identity defended, including a defense event without a basic defense. */
  heroDefended: boolean;
}
export interface HulkPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  /** Preserve original ownership while transferring the persistent control zone. */
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Apply normal removal/immunity and scheme defeat hooks, returning actual threat moved. */
  moveThreat(s: GameState, target: string, amount: number): number;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    exclude: string,
    targetCode: string,
  ): boolean;
}

function schemeTargets(s: GameState): HulkPackTarget[] {
  return [
    ...(!s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis) &&
    s.scheme.code !== "01139b" &&
    s.scheme.threat > 0
      ? [
          {
            id: "main",
            label: cards.get(s.scheme.code)?.name || "Main scheme",
            code: s.scheme.code,
          },
        ]
      : []),
    ...s.sideSchemes
      .filter((p) => p.counters > 0 && !hulkThreatLocked(s, p.id))
      .map((p) => ({ id: p.id, label: cards.get(p.code)!.name, code: p.code })),
  ];
}
const sameAttacker = (s: GameState, attack: HulkPackAttackSnapshot) => {
  const p = piece(s, attack.attacker);
  // RRG47: a same-title next villain stage remains the same character.
  return p &&
    (p.code === attack.attackerCode ||
      (p.id === s.villain.id &&
        cards.get(p.code)?.name === cards.get(attack.attackerCode)?.name))
    ? p
    : undefined;
};

export function hulkPackModifiers(s: GameState, target: string) {
  const p = piece(s, target);
  return { attack: p?.code === "10013" ? Math.max(0, p.damage) : 0 };
}
export function hulkPackPlayRestriction(s: GameState, p: Piece): string | null {
  if (p.code === "10016") return "Available after the villain attacks you.";
  if (p.code === "10030") {
    if (!captainPackHasTrait(s, "hero", "Avenger"))
      return "Your identity must have the Avenger trait.";
    if (!inspiredAllies(s).length)
      return "Choose an ally that is damaged or exhausted.";
  }
  if (["10018", "10031"].includes(p.code) && !recipients(s, p).length)
    return "Each player already controls this upgrade.";
  return null;
}
export function hulkPackEvent(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "10015")
    return [
      E("target", {
        group: "enemy",
        title: "Toe to Toe",
        action: pack("toe", { attack: true, source: "hero" }),
      }),
    ];
  if (p.code === "10016") return [];
  if (p.code === "10030") return [pack("inspiring")];
  return null;
}
export function hulkPackAllyEnter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "10012")
    return [
      pack("sentry", {
        id: p.id,
        actorId: controller(s, p.id)?.id || s.activePlayerId,
      }),
    ];
  if (["10011", "10013"].includes(p.code)) return [];
  return null;
}
/** Native allyResponse calls this after the attack and before consequential damage. */
export function hulkPackAllyResponse(
  s: GameState,
  p: Piece,
  attack: boolean,
): Effect[] {
  if (
    !attack ||
    p.code !== "10011" ||
    !piece(s, p.id) ||
    !schemeTargets(s).length
  )
    return [];
  return [
    E("optional", {
      actorId: controller(s, p.id)?.id || s.activePlayerId,
      title: "Brawn",
      text: "Remove 1 threat from a scheme after Brawn attacks?",
      effects: [
        E("target", {
          group: "scheme",
          title: "Brawn",
          action: E("thwart", { amount: 1, source: p.id }),
        }),
      ],
    }),
  ];
}
export function hulkPackCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "10029") p.counters = 0;
  return ["10018", "10031"].includes(p.code)
    ? [pack("control", { id: p.id })]
    : [];
}
export function hulkPackAbilityOptions(s: GameState, id: string): Option[] {
  const p = s.player.inPlay.find(
    (p) => p.id === id && p.code === "10029" && !p.exhausted,
  );
  if (!p) return [];
  return [
    ...(schemeTargets(s).length
      ? [
          option(
            "cop-move",
            "Beat Cop · move 1 threat here",
            [pack("cop-move", { id })],
            p.code,
          ),
        ]
      : []),
    ...(p.counters > 0 && s.minions.length
      ? [
          option(
            "cop-damage",
            "Beat Cop · discard to deal " + p.counters + " damage to a minion",
            [pack("cop-damage", { id })],
            p.code,
          ),
        ]
      : []),
  ];
}
export function hulkPackAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = hulkPackAbilityOptions(s, id);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function hulkPackResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  const c = targetCode ? cards.get(targetCode) : undefined;
  return s.player.inPlay.flatMap((p): PaymentSource[] => {
    if (
      p.code === "10018" &&
      !p.exhausted &&
      c?.type_code === "event" &&
      traits(c).includes("Attack")
    )
      return [
        {
          id: p.id,
          code: p.code,
          name: "Martial Prowess",
          resources: ["physical"],
          kind: "ability",
          description:
            "Exhaust · generate 1 physical resource for an Attack event",
        },
      ];
    if (p.code === "10032")
      return [
        {
          id: p.id,
          code: p.code,
          name: "Resourceful",
          resources: ["wild"],
          kind: "ability",
          description: "Discard from play · generate 1 wild resource",
        },
      ];
    return [];
  });
}
/** Validate the whole payment first. Resourceful has no exhaust cost. */
export function hulkPackResourceSpent(
  s: GameState,
  p: Piece,
  targetCode?: string,
): Effect[] {
  if (p.code === "10032") {
    need(
      s.player.inPlay.some((candidate) => candidate.id === p.id),
      "Resourceful is no longer under your control.",
    );
    return [E("discardPiece", { id: p.id })];
  }
  if (p.code === "10018") {
    const c = targetCode ? cards.get(targetCode) : undefined;
    need(
      c?.type_code === "event" && traits(c).includes("Attack"),
      "Martial Prowess only pays for an Attack event.",
    );
  }
  return [];
}

export function hulkPackAttackResponseOptions(
  s: GameState,
  attack: HulkPackAttackSnapshot,
  ports: Pick<HulkPackPorts, "cardCost" | "canPay">,
  used: string[] = [],
): Option[] {
  const seat = s.players.find(
    (seat) => seat.id === attack.playerId && !seat.eliminated,
  );
  if (!seat) return [];
  const view = seatView(s, seat);
  const armor =
    attack.heroDefended && sameAttacker(s, attack)
      ? view.player.inPlay.filter(
          (p) => p.code === "10031" && !used.includes(p.id),
        )
      : [];
  const vengeance =
    attack.isVillain &&
    view.player.form === "hero" &&
    (attack.heroDamage > 0 || view.player.confused) &&
    (view.player.confused || schemeTargets(view).length)
      ? view.player.hand.filter(
          (p) =>
            p.code === "10016" &&
            !used.includes(p.id) &&
            ports.canPay(view, ports.cardCost(view, p), p.id, p.code),
        )
      : [];
  return [
    ...armor.map((p) =>
      option(
        p.id,
        "Electrostatic Armor · deal 1 damage to the attacker",
        [pack("armor", { id: p.id, attack, actorId: seat.id })],
        p.code,
      ),
    ),
    ...vengeance.map((p) =>
      option(
        p.id,
        "You'll Pay for That! · remove " +
          Math.min(5, Math.max(0, attack.heroDamage)) +
          " threat",
        [pack("vengeance", { id: p.id, attack, actorId: seat.id })],
        p.code,
      ),
    ),
  ];
}
/** The host can combine hulkPackAttackResponseOptions with native responses to
 * let the player choose their ordering within the same response window. */
export function hulkPackAfterEnemyAttack(
  s: GameState,
  attack: HulkPackAttackSnapshot,
): Effect[] {
  return [pack("after-attack", { attack, used: [], actorId: attack.playerId })];
}

export function resolveHulkPackEffect(
  s: GameState,
  e: Effect,
  ports: HulkPackPorts,
): boolean {
  if (!e.type.startsWith("hulk-pack:")) return false;
  switch (e.type) {
    case "hulk-pack:sentry": {
      const p = piece(s, e.id);
      need(p?.code === "10012", "Sentry is no longer in play.");
      ports.dealEncounter(s, controller(s, p!.id)?.id || s.activePlayerId);
      break;
    }
    case "hulk-pack:control": {
      const p = piece(s, e.id);
      need(
        p && ["10018", "10031"].includes(p.code),
        "Upgrade is no longer in play.",
      );
      ports.choose(
        s,
        cards.get(p!.code)!.name,
        "Choose a player to control this upgrade. Maximum one per player.",
        recipients(s, p!).map((seat) =>
          option(
            seat.id,
            "Player " + seat.id,
            [pack("control-to", { id: p!.id, playerId: seat.id })],
            p!.code,
          ),
        ),
      );
      break;
    }
    case "hulk-pack:control-to": {
      const p = piece(s, e.id);
      need(
        p && recipients(s, p).some((seat) => seat.id === e.playerId),
        "That player already controls this upgrade.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "hulk-pack:inspiring":
      need(
        s.player.form === "hero" && captainPackHasTrait(s, "hero", "Avenger"),
        "Inspiring Presence requires an Avenger hero.",
      );
      ports.choose(
        s,
        "Inspiring Presence",
        "Choose an ally to heal 1 damage and ready.",
        inspiredAllies(s).map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [pack("inspiring-target", { target: p.id })],
            p.code,
          ),
        ),
      );
      break;
    case "hulk-pack:inspiring-target": {
      const p = inspiredAllies(s).find((p) => p.id === e.target);
      need(p, "Choose an ally that can be healed or readied.");
      ports.queue(
        s,
        E("heal", { target: p!.id, amount: 1 }),
        E("ready", { target: p!.id }),
      );
      break;
    }
    case "hulk-pack:toe": {
      const p = piece(s, e.target);
      need(
        p && (p.id === s.villain.id || s.minions.includes(p)),
        "Toe to Toe requires an enemy.",
      );
      ports.queue(
        s,
        E("enemyAttack", { id: p!.id }),
        pack("toe-damage", {
          target: p!.id,
          code: p!.code,
          stage: cards.get(p!.code)?.stage,
        }),
      );
      break;
    }
    case "hulk-pack:toe-damage": {
      const p = piece(s, e.target);
      if (
        p &&
        (p.code === e.code ||
          (p.id === s.villain.id &&
            cards.get(p.code)?.name === cards.get(e.code)?.name))
      )
        ports.queue(
          s,
          E("damage", {
            target: p.id,
            amount: 5,
            attack: true,
            attackInitiated: true,
            source: "hero",
          }),
        );
      break;
    }
    case "hulk-pack:cop-move": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "10029" && !p.exhausted,
      );
      need(
        p && schemeTargets(s).length,
        "Beat Cop needs to be ready and move threat from a scheme.",
      );
      ports.choose(
        s,
        "Beat Cop",
        "Choose a scheme and move 1 threat onto Beat Cop.",
        schemeTargets(s).map((target) =>
          option(
            target.id,
            target.label,
            [pack("cop-moved", { id: p!.id, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "hulk-pack:cop-moved": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "10029" && !p.exhausted,
      );
      need(
        p && schemeTargets(s).some((target) => target.id === e.target),
        "Beat Cop cannot move threat from that scheme.",
      );
      p!.exhausted = true;
      p!.counters += ports.moveThreat(s, e.target, 1);
      break;
    }
    case "hulk-pack:cop-damage": {
      const p = s.player.inPlay.find(
        (p) =>
          p.id === e.id && p.code === "10029" && !p.exhausted && p.counters > 0,
      );
      need(
        p && s.minions.length,
        "Beat Cop needs stored threat and a minion target.",
      );
      ports.choose(
        s,
        "Beat Cop",
        "Discard Beat Cop to deal " + p!.counters + " damage to one minion.",
        s.minions.map((target) =>
          option(
            target.id,
            cards.get(target.code)!.name,
            [pack("cop-damaged", { id: p!.id, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "hulk-pack:cop-damaged": {
      const p = s.player.inPlay.find(
        (p) =>
          p.id === e.id && p.code === "10029" && !p.exhausted && p.counters > 0,
      );
      const target = s.minions.find((p) => p.id === e.target);
      need(
        p && target,
        "Beat Cop's cost or minion target is no longer available.",
      );
      const amount = p!.counters;
      p!.exhausted = true;
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("damage", { target: target!.id, amount, source: p!.id }),
      );
      break;
    }
    case "hulk-pack:after-attack": {
      const used = (e.used || []) as string[];
      const options = hulkPackAttackResponseOptions(s, e.attack, ports, used);
      if (!options.length) break;
      ports.choose(
        s,
        "After the enemy attack",
        "Choose a response to this attack, or continue.",
        [
          ...options.map((choice) => ({
            ...choice,
            effects: [
              ...choice.effects,
              pack("after-attack", {
                attack: e.attack,
                used: [...used, choice.id],
              }),
            ],
          })),
          option("pass", "Continue", []),
        ],
      );
      break;
    }
    case "hulk-pack:armor": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "10031",
      );
      const attack = e.attack as HulkPackAttackSnapshot;
      need(
        p && attack.heroDefended && attack.playerId === s.activePlayerId,
        "Electrostatic Armor requires your identity to have defended.",
      );
      if (sameAttacker(s, attack))
        ports.queue(
          s,
          E("damage", { target: attack.attacker, amount: 1, source: p!.id }),
        );
      break;
    }
    case "hulk-pack:vengeance": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "10016");
      const attack = e.attack as HulkPackAttackSnapshot;
      need(
        p &&
          hulkPackAttackResponseOptions(s, attack, ports).some(
            (o) => o.id === p.id,
          ),
        "You'll Pay for That!'s response cannot be played.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "You'll Pay for That!",
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [
                E("target", {
                  group: "scheme",
                  title: "You'll Pay for That!",
                  action: E("thwart", {
                    amount: Math.min(5, Math.max(0, attack.heroDamage)),
                    action: true,
                    source: "hero",
                  }),
                }),
              ],
            }),
          ],
        }),
      );
      break;
    }
    default:
      throw Error("Unknown Hulk pack effect: " + e.type);
  }
  return true;
}
