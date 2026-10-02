import catalog from "../data/catalog-cards.json" with { type: "json" };
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
import type { PaymentSource } from "./payment.js";

const cards = new Map((catalog as Card[]).map((card) => [card.code, card]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const H = (name: string, args: Record<string, unknown> = {}) =>
  E(`hulk:${name}`, args);
const active = (s: GameState) => s.heroId === "hulk";
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const onlyPhysical = (paid: readonly Resource[]) =>
  paid.length > 0 && paid.every((resource) => resource === "physical");
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((piece) => piece.id === id);

/** These faces require every explicit timing, resource and encounter port below.
 * Metadata presence alone never certifies this hero as automated. */
export const HULK_SCRIPT_CODES = [
  "10001a",
  "10001b",
  "10002",
  "10003",
  "10004",
  "10005",
  "10006",
  "10007",
  "10008",
  "10009",
  "10010",
  "10025",
  "10026",
  "10027",
  "10028",
] as const;
export const HULK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface HulkEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  select(
    s: GameState,
    title: string,
    text: string,
    pieces: Piece[],
    min: number,
    max: number,
    action: Effect,
  ): void;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  mill(s: GameState, count: number): Piece[];
  heroATK(s: GameState, playerId?: string): number;
  enemyATK(s: GameState, piece: Piece): number;
  allyATK(s: GameState, piece: Piece, playerId: string): number;
  cardCost(s: GameState, piece: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** Forced changes also run all form-change responses, without using the voluntary flip allowance. */
  flip(s: GameState, counts: boolean): void;
  /** Preserve an original ally target through an undefended attack. False means
   * no attack occurred (for example Stunned or Webbed Up), requiring surge. */
  startEnemyAttack(
    s: GameState,
    attackerId: string,
    targetId: string,
    ownerId: string,
  ): boolean;
}

export function hulkStats(s: GameState) {
  if (!active(s)) return { atk: 0, recover: 0, health: 0, retaliate: 0 };
  return {
    atk:
      s.player.form === "hero"
        ? s.player.inPlay.filter((piece) => piece.code === "10009").length
        : 0,
    recover:
      s.player.form === "alter" &&
      s.player.inPlay.some((piece) => piece.code === "10008")
        ? 2
        : 0,
    health:
      s.player.inPlay.filter((piece) => piece.code === "10010").length * 4,
    retaliate:
      s.player.form === "hero"
        ? s.player.inPlay.filter((piece) => piece.code === "10010").length
        : 0,
  };
}
export function hulkFormChanged(s: GameState): Effect[] {
  return active(s)
    ? s.player.inPlay
        .filter((piece) => piece.code === "10009")
        .map((piece) => E("discardPiece", { id: piece.id }))
    : [];
}
/** Invoke on this hero's own turn ending, before end-of-phase hand replenishment. */
export function hulkTurnEnds(s: GameState): Effect[] {
  return active(s) && s.player.form === "hero" ? [H("enraged")] : [];
}
export function hulkAbilityOptions(s: GameState, id: string): Option[] {
  return active(s) &&
    id === "identity" &&
    s.player.form === "alter" &&
    s.flags.hulkResearchRound !== s.round
    ? [
        option(
          "research",
          "Experimental Research · draw 1, then choose 1 card to discard",
          [H("research")],
          "10001b",
        ),
      ]
    : [];
}
export function hulkAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = hulkAbilityOptions(s, id);
  return (
    (
      options.find((candidate) => candidate.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function hulkResourceSources(s: GameState): PaymentSource[] {
  if (!active(s) || s.player.form !== "alter") return [];
  return s.player.inPlay
    .filter((piece) => piece.code === "10008" && !piece.exhausted)
    .map((piece) => ({
      id: piece.id,
      code: piece.code,
      name: "Banner's Laboratory",
      resources: ["mental"],
      description: "Exhaust · generate 1 mental resource",
      kind: "ability",
    }));
}
export function hulkCanSpendCard(s: GameState, piece: Piece): boolean {
  return piece.code !== "10007" || s.player.form === "hero";
}
/** The engine validates the selected printed pool before spending any source;
 * wild resources may be declared physical while paying this cost. */
export function hulkPaymentAllowed(
  piece: Pick<Piece, "code">,
  printed: readonly Resource[],
  wildAs: Resource,
): boolean {
  return (
    piece.code !== "10002" ||
    printed.every(
      (resource) =>
        resource === "physical" ||
        (resource === "wild" && wildAs === "physical"),
    )
  );
}
export function hulkPlayRestriction(s: GameState, piece: Piece): string | null {
  if (piece.code === "10003")
    return "Play Hulk Smash during your basic attack's interrupt window.";
  if (piece.code === "10009" && s.player.form !== "hero")
    return "Boundless Rage can only be played in hero form.";
  return null;
}

/** Host passes the exact chosen basic-attack packet; the bonus never persists
 * into another attack or an event. Repeated interrupts can use both copies. */
export function hulkBasicAttackWindow(s: GameState, attack: Effect): Effect[] {
  return active(s) && s.player.form === "hero" && !s.player.stunned
    ? [H("smash-window", { attack })]
    : [attack];
}
export function hulkEvent(
  s: GameState,
  piece: Piece,
  paid: Resource[],
): Effect[] | null {
  switch (piece.code) {
    case "10002":
      need(
        paid.every((resource) => resource === "physical"),
        "Crushing Blow can only be paid with physical resources.",
      );
      return [H("crushing")];
    case "10003":
      throw Error("Hulk Smash requires its basic-attack interrupt window.");
    case "10004":
      return [
        E("target", {
          group: "scheme",
          title: "Sub-Orbital Leap",
          action: E("thwart", {
            amount: onlyPhysical(paid) ? 5 : 3,
            action: true,
            source: "hero",
          }),
        }),
      ];
    case "10005":
      return [H("thunderclap")];
    case "10006":
      return [
        E("ready", { target: "hero" }),
        ...(onlyPhysical(paid) ? [E("draw", { amount: 1 })] : []),
      ];
    default:
      return null;
  }
}

export function hulkThreatLocked(s: GameState, schemeId: string): boolean {
  return (
    s.sideSchemes.some(
      (scheme) => scheme.id === schemeId && scheme.code === "10027",
    ) && s.minions.some((piece) => piece.code === "10026")
  );
}
export function hulkAfterEnemyAttack(s: GameState, attacker: Piece): Effect[] {
  return attacker.code === "10026" &&
    s.minions.some((piece) => piece.id === attacker.id)
    ? [H("abomination", { id: attacker.id })]
    : [];
}
export function hulkEncounterReveal(
  s: GameState,
  piece: Piece,
): Effect[] | null {
  switch (piece.code) {
    case "10025": {
      const owner = s.players.find(
        (seat) => seat.heroId === "hulk" && !seat.eliminated,
      );
      return owner ? [H("obligation", { piece, actorId: owner.id })] : [];
    }
    case "10026":
    case "10027":
      return [];
    case "10028":
      return [
        H("clash", {
          actorId: s.firstPlayerId,
          revealingPlayerId: s.activePlayerId,
        }),
      ];
    default:
      return null;
  }
}

function chooseHighest(
  s: GameState,
  candidates: {
    id: string;
    label: string;
    amount: number;
    image?: string;
    effects: Effect[];
  }[],
  title: string,
  ports: HulkEnginePorts,
  revealingPlayerId?: string,
) {
  if (!candidates.length) {
    ports.queue(
      s,
      E("surge", revealingPlayerId ? { actorId: revealingPlayerId } : {}),
    );
    return;
  }
  const maximum = Math.max(...candidates.map((candidate) => candidate.amount));
  const tied = candidates.filter((candidate) => candidate.amount === maximum);
  if (tied.length === 1) ports.queue(s, ...tied[0].effects);
  else
    ports.choose(
      s,
      title,
      "The first player decides the tie for highest current ATK.",
      tied.map((candidate) =>
        option(
          candidate.id,
          `${candidate.label} · ${candidate.amount} ATK`,
          candidate.effects,
          candidate.image,
        ),
      ),
    );
}
function selectedHand(s: GameState, ids: string[], count: number) {
  need(
    Array.isArray(ids) && ids.length === count && new Set(ids).size === count,
    `Choose exactly ${count} different cards.`,
  );
  const pieces = ids.map((id) =>
    s.player.hand.find((piece) => piece.id === id),
  );
  need(pieces.every(Boolean), "A selected card is no longer in hand.");
  return pieces as Piece[];
}

export function resolveHulkEffect(
  s: GameState,
  effect: Effect,
  ports: HulkEnginePorts,
): boolean {
  if (!effect.type.startsWith("hulk:")) return false;
  switch (effect.type) {
    case "hulk:enraged":
      if (active(s) && s.player.form === "hero")
        for (const piece of [...s.player.hand]) ports.discardHand(s, piece.id);
      break;
    case "hulk:research":
      need(
        hulkAbilityOptions(s, "identity").length,
        "Experimental Research is unavailable.",
      );
      s.flags.hulkResearchRound = s.round;
      ports.queue(s, E("draw", { amount: 1 }), H("research-discard"));
      break;
    case "hulk:research-discard":
      if (s.player.hand.length)
        ports.select(
          s,
          "Experimental Research",
          "Choose 1 card from your hand to discard.",
          s.player.hand,
          1,
          1,
          H("research-paid"),
        );
      break;
    case "hulk:research-paid":
      for (const piece of selectedHand(s, effect.ids, 1))
        ports.discardHand(s, piece.id);
      break;
    case "hulk:crushing":
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Crushing Blow",
          action: E("damage", {
            amount: ports.heroATK(s),
            attack: true,
            source: "hero",
          }),
        }),
      );
      break;
    case "hulk:thunderclap":
      ports.select(
        s,
        "Thunderclap",
        "Choose up to 3 different enemies. This damage is not an attack.",
        [s.villain, ...s.minions],
        0,
        Math.min(3, s.minions.length + 1),
        H("thunderclap-targets"),
      );
      break;
    case "hulk:thunderclap-targets":
      need(
        Array.isArray(effect.ids) &&
          effect.ids.length <= 3 &&
          new Set(effect.ids).size === effect.ids.length &&
          effect.ids.every((id: string) => enemy(s, id)),
        "Choose up to 3 different enemies in play.",
      );
      ports.queue(
        s,
        ...effect.ids.map((id: string) =>
          E("damage", {
            target: id,
            amount: 3,
            source: "10005",
            attack: false,
          }),
        ),
      );
      break;
    case "hulk:smash-window": {
      const available =
        active(s) && s.player.form === "hero" && !s.player.stunned
          ? s.player.hand.filter(
              (piece) =>
                piece.code === "10003" &&
                ports.canPay(s, ports.cardCost(s, piece), piece.id, piece.code),
            )
          : [];
      if (!available.length) {
        ports.queue(s, effect.attack);
        break;
      }
      ports.choose(
        s,
        "Hulk Smash",
        "You are making a basic attack. Pay for Hulk Smash to add 10 ATK to this attack, or continue without it.",
        [
          ...available.map((piece) =>
            option(
              piece.id,
              "Play Hulk Smash · +10 ATK for this attack",
              [H("smash-request", { id: piece.id, attack: effect.attack })],
              piece.code,
            ),
          ),
          option("continue", "Continue the basic attack", [effect.attack]),
        ],
      );
      break;
    }
    case "hulk:smash-request": {
      const piece = s.player.hand.find(
        (piece) => piece.id === effect.id && piece.code === "10003",
      );
      need(
        active(s) && s.player.form === "hero" && !s.player.stunned && piece,
        "Hulk Smash is not available in this interrupt window.",
      );
      const cost = ports.cardCost(s, piece!);
      need(
        ports.canPay(s, cost, piece!.id, piece!.code),
        "Hulk Smash cannot be paid for.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Hulk Smash",
          cost,
          piece,
          targetCode: piece!.code,
          cancelable: false,
          after: [
            H("smash-paid", { id: piece!.id, attack: effect.attack, cost }),
          ],
        }),
      );
      break;
    }
    case "hulk:smash-paid": {
      const piece = s.player.hand.find(
        (piece) => piece.id === effect.id && piece.code === "10003",
      );
      need(
        piece &&
          Array.isArray(effect.paid) &&
          effect.paid.length >= effect.cost,
        "Hulk Smash payment or card is no longer valid.",
      );
      const attack = {
        ...effect.attack,
        amount: Number(effect.attack.amount || 0) + 10,
        overkill: !!effect.attack.overkill || onlyPhysical(effect.paid),
      };
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: piece!.id,
          after: [H("smash-window", { attack })],
        }),
      );
      break;
    }
    case "hulk:obligation":
      ports.queue(s, H("obligation-after-flip", { piece: effect.piece }));
      ports.flip(s, false);
      break;
    case "hulk:obligation-after-flip":
      if (s.player.form === "hero")
        ports.queue(
          s,
          E("exhaust", { id: "hero" }),
          E("discardEncounter", { piece: effect.piece }),
        );
      else {
        const count = Math.min(2, s.player.hand.length);
        if (count)
          ports.select(
            s,
            "Inner Demons",
            `Choose ${count} card(s) to discard.`,
            s.player.hand,
            count,
            count,
            H("obligation-paid", { piece: effect.piece, count }),
          );
        else ports.queue(s, E("discardEncounter", { piece: effect.piece }));
      }
      break;
    case "hulk:obligation-paid":
      for (const piece of selectedHand(s, effect.ids, effect.count))
        ports.discardHand(s, piece.id);
      ports.queue(s, E("discardEncounter", { piece: effect.piece }));
      break;
    case "hulk:abomination": {
      // Forced abilities initiate one at a time (RRG20). Retaliate may defeat
      // this minion before its response is chosen; out-of-play text cannot
      // initiate that deferred response (RRG23).
      if (!s.minions.some((p) => p.id === effect.id && p.code === "10026"))
        break;
      const discarded = ports.mill(s, 1);
      if (
        discarded.some(
          (piece) => (cards.get(piece.code)?.resource_physical || 0) > 0,
        )
      )
        ports.queue(
          s,
          E("damage", { target: "hero", amount: 2, source: "Abomination" }),
        );
      break;
    }
    case "hulk:clash":
      chooseHighest(
        s,
        [s.villain, ...s.minions].map((piece) => ({
          id: piece.id,
          label: cards.get(piece.code)?.name || "Enemy",
          amount: ports.enemyATK(s, piece),
          image: piece.code,
          effects: [
            H("clash-target", {
              attackerId: piece.id,
              revealingPlayerId: effect.revealingPlayerId,
            }),
          ],
        })),
        "Clash of the Titans · enemy",
        ports,
        effect.revealingPlayerId,
      );
      break;
    case "hulk:clash-target": {
      need(
        enemy(s, effect.attackerId),
        "The chosen attacker is no longer in play.",
      );
      const candidates = s.players
        .filter((seat) => !seat.eliminated)
        .flatMap((seat) => [
          ...(seat.player.form === "hero"
            ? [
                {
                  id: `hero:${seat.id}`,
                  label:
                    cards.get(
                      [...cards.values()].find(
                        (card) =>
                          card.type_code === "hero" &&
                          card.set_code === seat.heroId,
                      )?.code || "",
                    )?.name || seat.heroId,
                  amount: ports.heroATK(s, seat.id),
                  effects: [
                    H("clash-attack", {
                      attackerId: effect.attackerId,
                      targetId: "hero",
                      ownerId: seat.id,
                      revealingPlayerId: effect.revealingPlayerId,
                    }),
                  ],
                },
              ]
            : []),
          ...seat.player.inPlay
            .filter((piece) => cards.get(piece.code)?.type_code === "ally")
            .map((piece) => ({
              id: piece.id,
              label: cards.get(piece.code)!.name,
              image: piece.code,
              amount: ports.allyATK(s, piece, seat.id),
              effects: [
                H("clash-attack", {
                  attackerId: effect.attackerId,
                  targetId: piece.id,
                  ownerId: seat.id,
                  revealingPlayerId: effect.revealingPlayerId,
                }),
              ],
            })),
        ]);
      chooseHighest(
        s,
        candidates,
        "Clash of the Titans · hero or ally",
        ports,
        effect.revealingPlayerId,
      );
      break;
    }
    case "hulk:clash-attack":
      need(
        enemy(s, effect.attackerId),
        "The chosen attacker is no longer in play.",
      );
      if (
        !ports.startEnemyAttack(
          s,
          effect.attackerId,
          effect.targetId,
          effect.ownerId,
        )
      )
        ports.queue(
          s,
          E("surge", { actorId: effect.revealingPlayerId || s.activePlayerId }),
        );
      break;
    default:
      throw Error(`Unregistered Hulk effect: ${effect.type}`);
  }
  return true;
}
