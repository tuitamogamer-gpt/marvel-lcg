import { eventPlaySources } from "./card-text.js";
import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import { printedCardMetadata } from "./printed-card-metadata.js";
import { expansionErrata } from "./expansion-errata.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [
    c.code,
    expansionErrata(printedCardMetadata(c)),
  ]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("drax-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );

export const DRAX_PACK_CORE_ALIASES = [
  "19014",
  "19019",
  "19022",
  "19023",
  "19024",
] as const;
export const DRAX_PACK_SCRIPT_CODES = [
  "19012",
  "19013",
  "19015",
  "19016",
  "19017",
  "19018",
  "19020",
  "19021",
  "19030",
  "19031",
  "19032",
  "19033",
] as const;
export interface DraxPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface DraxPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  enemyTargets(s: GameState, attack?: boolean): DraxPackTarget[];
  minionTargets(s: GameState): DraxPackTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** One actual top card. emptied describes the original deck, before recycling. */
  discardPlayerTop(s: GameState): { piece?: Piece; emptied: boolean };
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  preventDamage(s: GameState, amount: number, packet: Effect): void;
  removeStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused",
  ): void;
  canGiveTough(s: GameState, target: string): boolean;
  /** Reset and return the physical ally directly to its original owner's hand. */
  returnAllyToHand(s: GameState, id: string): void;
  /** Minion's own attack: its ATK/status/keywords, enemy target, no player Guard restriction. */
  minionAttackEnemy(s: GameState, minionId: string, targetId: string): void;
  attackProgram(s: GameState, effects: Effect[], after?: Effect[]): void;
}
const phaseKey = (s: GameState) => s.round + ":" + s.phase;
const heroDamageTarget = (target: string) =>
  target === "hero" || target.startsWith("hero:");
const statusCards = (s: GameState, status: "stunned" | "confused") =>
  status === "stunned"
    ? Number(s.player.stunCards || s.player.stunned)
    : Number(s.player.confuseCards || s.player.confused);

export function draxPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: DraxPackPorts,
): string | null {
  if (["19015", "19017", "19018"].includes(p.code))
    return "Available automatically during its interrupt window.";
  if (
    ["19020", "19031"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Guardian")
  )
    return "Your identity must have the Guardian trait.";
  if (
    p.code === "19021" &&
    !statusCards(s, "stunned") &&
    !statusCards(s, "confused")
  )
    return "Athletic Conditioning requires a stun or confuse status card.";
  if (p.code === "19030") {
    if (
      playerOrder(s).some(
        (seat) => seatView(s, seat).flags.draxPackBringPhase === phaseKey(s),
      )
    )
      return '"Bring It!" is limited to 1 per phase.';
    if (
      !s.minions.some(
        (m) => !m.engagedWith || m.engagedWith === s.activePlayerId,
      )
    )
      return '"Bring It!" requires a minion engaged with you.';
  }
  return null;
}
export function draxPackAllyEnter(_s: GameState, p: Piece): Effect[] | null {
  return ["19012", "19013", "19020"].includes(p.code) ? [] : null;
}
export function draxPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "19033") p.counters = 3;
  return [];
}
export function draxPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "19015":
    case "19017":
    case "19018":
      return [];
    case "19016":
      return [
        E("target", {
          group: "enemy",
          title: "Hard Knocks",
          action: P("hard-knocks", { attack: true }),
        }),
      ];
    case "19021":
      return [P("condition")];
    case "19030":
      return [P("bring")];
    case "19031":
      return [
        E("damage", { target: "hero", amount: 1, source: "think-fast" }),
        E("status", { target: s.villain.id, status: "confused" }),
      ];
    default:
      return null;
  }
}
export function draxPackAbilityOptions(
  s: GameState,
  id: string,
  ports: DraxPackPorts,
): Option[] {
  const p = own(s, id, "19013");
  return p && !p.exhausted && ports.minionTargets(s).length
    ? [
        O(
          "command-minion",
          "Discard Moondragon · a minion attacks another enemy",
          [P("moondragon", { id })],
          p.code,
        ),
      ]
    : [];
}
export function draxPackAbility(
  s: GameState,
  id: string,
  ports: DraxPackPorts,
  action?: string,
): boolean {
  const choice = draxPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!choice) return false;
  ports.queue(s, ...choice.effects);
  return true;
}
export function draxPackResourceSources(s: GameState): PaymentSource[] {
  return s.player.form !== "hero"
    ? []
    : s.player.inPlay
        .filter(
          (p) =>
            p.code === "19033" &&
            !p.exhausted &&
            p.counters > 0 &&
            !isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Enhanced Physique",
          resources: ["physical"],
          kind: "ability",
          description:
            "Exhaust · spend 1 physical counter · generate 1 physical resource",
        }));
}
export function draxPackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<DraxPackPorts, "discardPiece">,
) {
  const p = own(s, id, "19033");
  if (!p) return false;
  need(
    s.player.form === "hero" && !p.exhausted && p.counters > 0,
    "Enhanced Physique is unavailable.",
  );
  p.exhausted = true;
  if (!--p.counters) ports.discardPiece(s, p.id);
  return true;
}
export function draxPackAfterAllyBasic(s: GameState, p: Piece): Effect[] {
  return p.code === "19020" &&
    s.player.form === "hero" &&
    !isTextBlank(s, p) &&
    s.player.deck.length
    ? [
        E("optional", {
          title: "Gamora",
          text: "Discard cards from your deck until you discard an event, then add that event to your hand?",
          effects: [P("gamora-search", { id: p.id })],
        }),
      ]
    : [];
}
export interface DraxPackAllyConsequenceSnapshot {
  attack: boolean;
  defeatedEnemy: boolean;
  actualDamage: number;
}
/** After consequential damage has actually been placed and defeat handled. */
export function draxPackAfterAllyConsequence(
  s: GameState,
  p: Piece,
  snapshot: DraxPackAllyConsequenceSnapshot,
  ports: Pick<DraxPackPorts, "canGiveTough">,
): Effect[] {
  return p.code === "19012" &&
    allInPlay(s).some((a) => a.id === p.id) &&
    !isTextBlank(s, p) &&
    snapshot.attack &&
    snapshot.defeatedEnemy &&
    snapshot.actualDamage > 0 &&
    ports.canGiveTough(s, p.id)
    ? [
        E("optional", {
          actorId: controller(s, p.id)?.id,
          title: "Martyr",
          text: "Give Martyr a tough status after this attack's consequential damage?",
          effects: [E("status", { target: p.id, status: "tough" })],
        }),
      ]
    : [];
}
export interface DraxPackAllyDefeatSnapshot {
  attack: boolean;
  enemySource: boolean;
}
/** Does not trigger from consequent damage, retaliation, or a card ability. */
export function draxPackRegroupOptions(
  s: GameState,
  ally: Piece,
  snapshot: DraxPackAllyDefeatSnapshot,
  after: Effect[],
  _ports: DraxPackPorts,
): Option[] {
  if (
    !snapshot.attack ||
    !snapshot.enemySource ||
    !allInPlay(s).some((p) => p.id === ally.id)
  )
    return [];
  return allInPlay(s)
    .filter((p) => p.code === "19032" && !isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        "Regroup · return this ally to its owner's hand",
        [
          P("regroup", {
            actorId: controller(s, p.id)?.id,
            id: p.id,
            allyId: ally.id,
            after,
          }),
        ],
        p.code,
      ),
    );
}
/** Forced interrupt at round end, before the next round begins. */
export function draxPackRoundEnded(s: GameState): Effect[] {
  return allInPlay(s)
    .filter((p) => p.code === "19032" && !isTextBlank(s, p))
    .map((p) =>
      E("discardPiece", {
        id: p.id,
        mandatory: true,
        actorId: controller(s, p.id)?.id,
      }),
    );
}
export function draxPackDamageOptions(
  s: GameState,
  packet: Effect,
  amount: number,
  after: Effect[],
  ports: DraxPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !heroDamageTarget(packet.target) ||
    !packet.attack ||
    amount <= 0
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "19015" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Deflection · prevent up to 5 attack damage to this identity",
        [P("deflect-pay", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
export function draxPackBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: DraxPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.player.stunned ||
    !packet.basic ||
    !s.encounter.deck.length
  )
    return [];
  const used: string[] = packet.draxPackLeadingBlows || [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "19017" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Leading Blow · discard a boost card to prepare a delayed ready",
        [P("leading-pay", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
/** Delayed effect: after this basic attack's damage, before forced responses.
 * RRG 1.8: positive damage dealt can be prevented, so Tough still qualifies;
 * do not pass damage taken. The Leading Blow event has already discarded. */
export function draxPackBasicAttackDamageResolved(
  _s: GameState,
  packet: Effect,
  damageDealt: number,
): Effect[] {
  return damageDealt > 0 && packet.draxPackLeadingBlows?.length
    ? packet.draxPackLeadingBlows.map(() => E("ready", { target: "hero" }))
    : [];
}
export function draxPackAttackInitiatedOptions(
  s: GameState,
  enemy: Piece,
  packet: Effect,
  after: Effect[],
  ports: DraxPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    ![s.villain, ...s.minions].some(
      (p) => p.id === enemy.id && p.code === enemy.code,
    )
  )
    return [];
  const used: string[] = packet.draxPackSubdues || [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "19018" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Subdue · this enemy gets -3 ATK for this attack",
        [P("subdue-pay", { id: p.id, enemyId: enemy.id, packet, after })],
        p.code,
      ),
    );
}
function pay(
  s: GameState,
  p: Piece,
  effects: Effect[],
  continuation: Effect[],
  ports: DraxPackPorts,
) {
  ports.queue(
    s,
    E("payRequest", {
      title: cards.get(p.code)!.name,
      cost: ports.cardCost(s, p),
      piece: p,
      cancelable: false,
      after: [
        E("resolveHandEvent", { id: p.id, after: effects, continuation }),
      ],
    }),
  );
}
export function resolveDraxPackEffect(
  s: GameState,
  e: Effect,
  ports: DraxPackPorts,
): boolean {
  if (!e.type.startsWith("drax-pack:")) return false;
  switch (e.type) {
    case "drax-pack:condition": {
      const options = (["stunned", "confused"] as const)
        .filter((status) => statusCards(s, status))
        .map((status) =>
          O(
            status,
            "Discard 1 " +
              (status === "stunned" ? "stun" : "confuse") +
              " status card",
            [P("condition-status", { status })],
          ),
        );
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(
          s,
          "Athletic Conditioning",
          "Choose one status card to discard.",
          options,
        );
      break;
    }
    case "drax-pack:condition-status":
      need(statusCards(s, e.status), "That status card is unavailable.");
      ports.removeStatus(s, "hero", e.status);
      break;
    case "drax-pack:bring": {
      need(
        !playerOrder(s).some(
          (seat) => seatView(s, seat).flags.draxPackBringPhase === phaseKey(s),
        ),
        '"Bring It!" is limited to 1 per phase.',
      );
      s.flags.draxPackBringPhase = phaseKey(s);
      ports.queue(
        s,
        E("draw", {
          amount: s.minions.filter(
            (p) => !p.engagedWith || p.engagedWith === s.activePlayerId,
          ).length,
        }),
      );
      break;
    }
    case "drax-pack:hard-knocks": {
      const target = e.target,
        enemy =
          target === s.villain.id
            ? s.villain
            : s.minions.find((p) => p.id === target);
      if (!enemy) break;
      ports.attackProgram(s, [
        E("damage", {
          target,
          amount: 4,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
        P("hard-knocks-check", {
          target,
          code: enemy.code,
          stage: target === s.villain.id ? s.villain.stage : undefined,
        }),
      ]);
      break;
    }
    case "drax-pack:hard-knocks-check": {
      const defeated =
        e.target === s.villain.id
          ? s.villain.stage !== e.stage || s.villain.code !== e.code
          : !s.minions.some((p) => p.id === e.target && p.code === e.code);
      if (defeated && ports.canGiveTough(s, "hero"))
        ports.queue(s, E("status", { target: "hero", status: "tough" }));
      break;
    }
    case "drax-pack:moondragon": {
      const p = own(s, e.id, "19013");
      need(
        p && !p.exhausted && ports.minionTargets(s).length,
        "Moondragon requires an eligible minion.",
      );
      p!.exhausted = true;
      ports.discardPiece(s, p!.id);
      ports.choose(
        s,
        "Moondragon",
        "Choose the minion that will attack another enemy.",
        ports
          .minionTargets(s)
          .map((m) =>
            O(m.id, m.label, [P("moon-target", { minionId: m.id })], m.code),
          ),
      );
      break;
    }
    case "drax-pack:moon-target": {
      need(
        s.minions.some((p) => p.id === e.minionId),
        "The selected minion is unavailable.",
      );
      const targets = ports.enemyTargets(s).filter((t) => t.id !== e.minionId);
      if (targets.length)
        ports.choose(
          s,
          "Moondragon",
          "Choose another enemy for that minion to attack.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [P("moon-attack", { minionId: e.minionId, target: t.id })],
              t.code,
            ),
          ),
        );
      break;
    }
    case "drax-pack:moon-attack":
      need(
        s.minions.some((p) => p.id === e.minionId) &&
          ports
            .enemyTargets(s)
            .some((t) => t.id === e.target && t.id !== e.minionId),
        "Moondragon's attack targets are unavailable.",
      );
      ports.minionAttackEnemy(s, e.minionId, e.target);
      break;
    case "drax-pack:gamora-search": {
      need(
        own(s, e.id, "19020") && s.player.form === "hero",
        "Gamora's hero response is unavailable.",
      );
      while (s.player.deck.length) {
        const result = ports.discardPlayerTop(s),
          p = result.piece;
        if (p && cards.get(p.code)?.type_code === "event") {
          for (const zone of [s.player.discard, s.player.deck]) {
            const i = zone.findIndex((q) => q.id === p.id);
            if (i >= 0) {
              s.player.hand.push(...zone.splice(i, 1));
              break;
            }
          }
          break;
        }
        if (result.emptied || !p) break;
      }
      break;
    }
    case "drax-pack:regroup": {
      const p = own(s, e.id, "19032"),
        ally = allInPlay(s).find((p) => p.id === e.allyId);
      need(p && ally, "Regroup or the defeated ally is unavailable.");
      ports.returnAllyToHand(s, ally!.id);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "drax-pack:deflect-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "19015",
      );
      need(
        p &&
          draxPackDamageOptions(
            s,
            e.packet,
            e.amount,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Deflection is unavailable.",
      );
      pay(
        s,
        p!,
        [P("deflect-amount", { packet: e.packet, amount: e.amount })],
        e.after || [],
        ports,
      );
      break;
    }
    case "drax-pack:deflect-amount": {
      const maximum = Math.min(5, Math.max(0, e.amount));
      ports.choose(
        s,
        "Deflection",
        "Choose up to 5 damage to prevent, then discard that many cards from your deck.",
        Array.from({ length: maximum + 1 }, (_, amount) =>
          O(String(amount), "Prevent " + amount + " damage", [
            P("deflect", { packet: e.packet, amount }),
          ]),
        ),
      );
      break;
    }
    case "drax-pack:deflect": {
      need(
        e.amount >= 0 && e.amount <= 5,
        "Deflection can prevent at most 5 damage.",
      );
      ports.preventDamage(s, e.amount, e.packet);
      for (let i = 0; i < e.amount && s.player.deck.length; i++) {
        const result = ports.discardPlayerTop(s);
        if (result.emptied) break;
      }
      break;
    }
    case "drax-pack:leading-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "19017",
      );
      need(
        p &&
          draxPackBasicAttackOptions(s, e.packet, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Leading Blow requires a basic attack and an actual encounter card.",
      );
      pay(
        s,
        p!,
        [P("leading", { id: p!.id, packet: e.packet })],
        [
          P("resume-leading", {
            id: p!.id,
            packet: e.packet,
            after: e.after || [],
          }),
        ],
        ports,
      );
      break;
    }
    case "drax-pack:leading": {
      const result = ports.discardEncounterTop(s);
      need(result.piece, "Leading Blow must discard an actual encounter card.");
      s.flags["draxPackLeading:" + e.id] = Number(
        cards.get(result.piece!.code)?.boost || 0,
      );
      break;
    }
    case "drax-pack:resume-leading": {
      const reduction = Number(s.flags["draxPackLeading:" + e.id] || 0);
      delete s.flags["draxPackLeading:" + e.id];
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) - reduction,
          gmwBasicBonus: Number(e.packet.gmwBasicBonus || 0) - reduction,
          draxPackLeadingBlows: [
            ...(e.packet.draxPackLeadingBlows || []),
            e.id,
          ],
        },
        ...(e.after || []),
      );
      break;
    }
    case "drax-pack:subdue-pay": {
      const p = eventPlaySources(s).find(
          (p) => p.id === e.id && p.code === "19018",
        ),
        enemy = [s.villain, ...s.minions].find((p) => p.id === e.enemyId);
      need(
        p &&
          enemy &&
          draxPackAttackInitiatedOptions(
            s,
            enemy,
            e.packet,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Subdue requires an initiating enemy attack.",
      );
      pay(
        s,
        p!,
        [],
        [
          P("resume-subdue", {
            id: p!.id,
            packet: e.packet,
            after: e.after || [],
          }),
        ],
        ports,
      );
      break;
    }
    case "drax-pack:resume-subdue":
      ports.queue(
        s,
        {
          ...e.packet,
          modifier: Number(e.packet.modifier || 0) - 3,
          draxPackSubdues: [...(e.packet.draxPackSubdues || []), e.id],
        },
        ...(e.after || []),
      );
      break;
    default:
      throw Error("Unknown Drax player-pack effect: " + e.type);
  }
  return true;
}
