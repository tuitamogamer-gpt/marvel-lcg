import { goblinIdentityLocked } from "./goblin-modules";
import type { Card, Effect, GameState, Option, Piece, Resource } from "./types";
import type { PaymentSource } from "./payment";
import { playerOrder } from "./team";
import { consumeStatus } from "./keywords";
import catalogCards from "../data/catalog-cards.json";

const cards = new Map((catalogCards as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const cap = (name: string, args: Record<string, unknown> = {}) =>
  E(`cap:${name}`, args);
const active = (s: GameState) => s.heroId === "captain_america";
const shield = (s: GameState) =>
  s.player.inPlay.find((p) => p.code === "03009");
const enemy = (s: GameState, id: string) =>
  s.villain.id === id ? s.villain : s.minions.find((p) => p.id === id);
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });

/** Explicit hooks for the complete identity, signature set, obligation and nemesis.
 * The engine must bind every port and install the damage/defeat windows before
 * using this module to certify Captain America as automated. */
export const CAPTAIN_AMERICA_SCRIPT_CODES = [
  "03001a",
  "03001b",
  "03002",
  "03003",
  "03004",
  "03005",
  "03006",
  "03007",
  "03008",
  "03009",
  "03010",
  "03026",
  "03027",
  "03028",
  "03029",
  "03030",
] as const;

export interface CaptainEnginePorts {
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
  shuffle(s: GameState, pieces: Piece[]): void;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Targets are validated together before any damage. Resolve one multi-target
   * attack, including Tough, retaliate and defeat hooks. Return false if stunned. */
  attackBatch(s: GameState, ids: string[], amount: number): boolean;
  drawEncounter(s: GameState): Piece | undefined;
  dealEncounter(s: GameState, playerId: string): void;
  /** Reveal hidden information for searches, retaining the engine's undo guard. */
  revealHidden(s: GameState): void;
}

export function captainSetup(s: GameState): Effect[] {
  return active(s) ? [cap("setup")] : [];
}

export function captainStats(s: GameState) {
  return active(s)
    ? {
        thw: s.player.form === "hero" ? Number(s.flags.captainThw || 0) : 0,
        def: s.player.form === "hero" && shield(s) ? 1 : 0,
        retaliate: s.player.form === "hero" && shield(s) ? 1 : 0,
      }
    : { thw: 0, def: 0, retaliate: 0 };
}

/** Living Legend belongs to the alter-ego face. The first ally played in hero
 * form still consumes the round's first-ally condition. */
export function captainAllyDiscount(s: GameState, c: Card): number {
  return active(s) &&
    s.player.form === "alter" &&
    c.type_code === "ally" &&
    s.flags.captainFirstAllyRound !== s.round
    ? 1
    : 0;
}
export function captainCardPlayed(s: GameState, c: Card) {
  if (active(s) && c.type_code === "ally")
    s.flags.captainFirstAllyRound = s.round;
}
export function captainPhaseEnded(s: GameState) {
  if (active(s)) delete s.flags.captainThw;
}

export function captainAbilityOptions(s: GameState, id: string): Option[] {
  if (!active(s)) return [];
  if (id === "identity")
    return s.player.form === "hero" &&
      s.player.exhausted &&
      !goblinIdentityLocked(s) &&
      s.player.hand.length > 0 &&
      s.flags.captainReadyRound !== s.round
      ? [
          option(
            "all-day",
            "I Can Do This All Day! · discard 1 card to ready",
            [cap("ready-cost")],
            "03001a",
          ),
        ]
      : [];
  const p = s.player.inPlay.find((p) => p.id === id);
  if (p?.code === "03007" && !p.exhausted && s.player.form === "alter")
    return [
      option(
        "apartment",
        "Steve’s Apartment · draw 1 and heal 1",
        [cap("apartment", { id })],
        p.code,
      ),
    ];
  return [];
}
export function captainAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = captainAbilityOptions(s, id);
  const chosen =
    options.find((o) => o.id === action) ||
    (options.length === 1 && !action ? options[0] : undefined);
  return chosen?.effects || null;
}

export function captainResourceSources(s: GameState): PaymentSource[] {
  if (!active(s)) return [];
  return s.player.inPlay
    .filter((p) => p.code === "03010" && !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Super-Soldier Serum",
      resources: ["physical"],
      description: "Exhaust · generate 1 physical resource",
      kind: "ability",
    }));
}

export function captainEvent(
  s: GameState,
  p: Piece,
  paid: Resource[],
): Effect[] | null {
  switch (p.code) {
    case "03003":
      return [cap("fearless"), E("draw", { amount: 1 })];
    case "03004":
      return [
        E("target", {
          group: "enemy",
          action: cap("strike", {
            attack: true,
            physical: paid.includes("physical"),
          }),
        }),
      ];
    case "03006":
      return [cap("toss-cost")];
    case "03005":
      return []; // Reaction-only; the damage window supplies its effect.
    default:
      return null;
  }
}
export function captainPlayRestriction(s: GameState, p: Piece): string | null {
  if (p.code === "03005")
    return "Available when your identity would take damage.";
  if (p.code === "03006") {
    if (!shield(s)) return "Captain America’s Shield must be in play.";
    if (s.player.hand.filter((x) => x.id !== p.id).length === 0)
      return "Shield Toss requires another card to discard.";
    if (!captainAttackTargets(s).length)
      return "There is no eligible enemy to attack.";
  }
  return null;
}
export function captainAllyEnter(p: Piece): Effect[] {
  return p.code === "03002"
    ? [
        E("optional", {
          title: "Agent 13",
          text: "Remove 2 threat from a scheme?",
          effects: [
            E("target", {
              group: "scheme",
              action: E("thwart", { amount: 2 }),
            }),
          ],
        }),
      ]
    : [];
}

/** The caller offers these choices in every positive identity-damage window,
 * including non-attack damage and alter-ego form. `prevent` contains the engine's
 * continuation with the entire incoming damage packet prevented. */
export function captainShieldBlockOptions(
  s: GameState,
  prevent: Effect[],
): Option[] {
  if (!active(s) || s.player.tough) return [];
  const sh = shield(s);
  if (!sh || sh.exhausted) return [];
  return s.player.hand
    .filter((p) => p.code === "03005")
    .map((p) =>
      option(
        p.id,
        "Shield Block · exhaust Shield and prevent all damage",
        [cap("block", { id: p.id, shieldId: sh.id, after: prevent })],
        p.code,
      ),
    );
}
/** Offer before the engine eliminates this identity. Accepting the replacement
 * consumes Helmet and sets the dial to 1; declining uses the supplied effects. */
export function captainHelmetOptions(
  s: GameState,
  defeatEffects: Effect[],
): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  const p = s.player.inPlay.find((p) => p.code === "03008");
  return p
    ? [
        option(
          "helmet",
          "Discard Captain America’s Helmet · remain at 1 HP",
          [cap("helmet", { id: p.id })],
          p.code,
        ),
        option(
          "allow-defeat",
          "Allow the identity to be defeated",
          defeatEffects,
        ),
      ]
    : [];
}

/** “You cannot thwart” restricts the identity, not allies controlled by it. */
export function captainThwartBlocked(s: GameState): boolean {
  return s.minions.some(
    (p) =>
      p.code === "03028" &&
      (!p.engagedWith || p.engagedWith === s.activePlayerId),
  );
}
export function captainMinionDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === "03029"
    ? [cap("soldier-defeated", { playerId: p.engagedWith || s.activePlayerId })]
    : [];
}
export function captainEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "03026": {
      const owner = s.players.find(
        (seat) => seat.heroId === "captain_america" && !seat.eliminated,
      );
      return owner ? [cap("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "03027":
      return playerOrder(s).map((seat) =>
        cap("hit-squad", { actorId: seat.id }),
      );
    case "03028":
    case "03029":
      return []; // Quickstrike / Guard use the generic keyword hooks.
    case "03030":
      return playerOrder(s).map((seat) =>
        cap("hail-hydra", { actorId: seat.id }),
      );
    default:
      return null;
  }
}

export function captainAttackTargets(s: GameState): Piece[] {
  const guard = s.minions.some(
    (p) =>
      (!p.engagedWith || p.engagedWith === s.activePlayerId) &&
      /\bGuard\./.test(cards.get(p.code)?.text || ""),
  );
  return [...(guard ? [] : [s.villain]), ...s.minions];
}

function selectedHand(s: GameState, ids: string[], count?: number): Piece[] {
  need(
    Array.isArray(ids) && new Set(ids).size === ids.length,
    "Select each card once.",
  );
  if (count !== undefined)
    need(ids.length === count, `Choose exactly ${count} cards.`);
  const pieces = ids.map((id) => s.player.hand.find((p) => p.id === id));
  need(pieces.every(Boolean), "Selected card is no longer in your hand.");
  return pieces as Piece[];
}
function returnShield(s: GameState, sh: Piece) {
  s.player.inPlay.splice(s.player.inPlay.indexOf(sh), 1);
  Object.assign(sh, {
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: false,
    stunned: false,
    confused: false,
  });
  s.player.hand.push(sh);
}

export function resolveCaptainEffect(
  s: GameState,
  e: Effect,
  ports: CaptainEnginePorts,
): boolean {
  if (!e.type.startsWith("cap:")) return false;
  switch (e.type) {
    case "cap:setup": {
      const from = [s.player.deck, s.player.discard];
      const zone = from.find((zone) => zone.some((p) => p.code === "03009"));
      ports.revealHidden(s);
      if (zone)
        s.player.hand.push(
          zone.splice(
            zone.findIndex((p) => p.code === "03009"),
            1,
          )[0],
        );
      ports.shuffle(s, s.player.deck);
      break;
    }
    case "cap:ready-cost":
      need(
        captainAbilityOptions(s, "identity").length,
        "I Can Do This All Day! is unavailable.",
      );
      ports.select(
        s,
        "I Can Do This All Day!",
        "Discard one card from hand to ready Captain America.",
        s.player.hand,
        1,
        1,
        cap("ready-paid"),
      );
      break;
    case "cap:ready-paid":
      need(
        s.player.form === "hero" &&
          s.player.exhausted &&
          s.flags.captainReadyRound !== s.round,
        "Captain America cannot use this action now.",
      );
      selectedHand(s, e.ids, 1);
      ports.discardHand(s, e.ids[0]);
      s.flags.captainReadyRound = s.round;
      s.player.exhausted = false;
      break;
    case "cap:apartment": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03007",
      );
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Steve’s Apartment is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("draw", { amount: 1 }),
        E("heal", { target: "hero", amount: 1 }),
      );
      break;
    }
    case "cap:fearless":
      s.flags.captainThw = Number(s.flags.captainThw || 0) + 1;
      break;
    case "cap:strike": {
      const target = enemy(s, e.target);
      const code = target?.code;
      if (ports.attackBatch(s, [e.target], 6) && e.physical) {
        const remaining = enemy(s, e.target);
        if (
          remaining &&
          (remaining.code === code ||
            (remaining.id === s.villain.id &&
              !!code &&
              cards.get(remaining.code)?.name === cards.get(code)?.name))
        )
          ports.queue(s, E("status", { target: e.target, status: "stunned" }));
      }
      break;
    }
    case "cap:toss-cost": {
      need(shield(s), "Captain America’s Shield is no longer in play.");
      const targets = captainAttackTargets(s);
      const max = Math.min(targets.length, s.player.hand.length);
      need(
        max > 0,
        "Shield Toss needs a card to discard and an eligible enemy.",
      );
      ports.select(
        s,
        "Shield Toss · discard",
        "Choose X cards to discard. The Shield then returns to your hand; choose X different enemies.",
        s.player.hand,
        1,
        max,
        cap("toss-paid"),
      );
      break;
    }
    case "cap:toss-paid": {
      const discard = selectedHand(s, e.ids);
      const sh = shield(s);
      const targets = captainAttackTargets(s);
      need(
        sh && discard.length > 0 && discard.length <= targets.length,
        "Shield Toss costs cannot be paid.",
      );
      for (const p of discard) ports.discardHand(s, p.id);
      returnShield(s, sh!);
      // Additional costs precede Stunned replacing this attack ability.
      if (s.player.stunned) {
        consumeStatus(s.player, "stunned");
        break;
      }
      ports.select(
        s,
        "Shield Toss · targets",
        `Choose ${discard.length} different enemies. Deal 4 damage to each simultaneously.`,
        targets,
        discard.length,
        discard.length,
        cap("toss-targets", {
          count: discard.length,
          eligible: targets.map((p) => p.id),
        }),
      );
      break;
    }
    case "cap:toss-targets":
      need(
        Array.isArray(e.ids) &&
          e.ids.length === e.count &&
          new Set(e.ids).size === e.ids.length &&
          e.ids.every((id: string) => e.eligible.includes(id) && enemy(s, id)),
        "Choose X different eligible enemies.",
      );
      ports.attackBatch(s, e.ids, 4);
      break;
    case "cap:block": {
      const sh = shield(s);
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "03005");
      need(
        p && sh && sh.id === e.shieldId && !sh.exhausted,
        "Shield Block costs cannot be paid.",
      );
      sh!.exhausted = true;
      ports.queue(s, E("resolveHandEvent", { id: p!.id, after: e.after }));
      break;
    }
    case "cap:helmet": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03008",
      );
      need(p, "Captain America’s Helmet is no longer in play.");
      s.player.hp = 1;
      ports.discardPiece(s, p!.id);
      break;
    }
    case "cap:obligation":
      ports.choose(
        s,
        "Man Out of Time",
        "You may flip to alter-ego form before resolving this obligation.",
        [
          ...(s.player.form === "hero" && !goblinIdentityLocked(s)
            ? [
                option(
                  "flip",
                  "Flip to Steve Rogers",
                  [cap("obligation-flip", { piece: e.piece })],
                  "03001b",
                ),
              ]
            : []),
          option("stay", "Keep your current form", [
            cap("obligation-choice", { piece: e.piece }),
          ]),
        ],
      );
      break;
    case "cap:obligation-flip":
      need(!goblinIdentityLocked(s), "All Tied Up prevents changing form.");
      s.player.form = "alter";
      ports.queue(s, cap("obligation-choice", { piece: e.piece }));
      break;
    case "cap:obligation-choice": {
      const count = Math.floor(s.player.hand.length / 2);
      ports.choose(
        s,
        "Man Out of Time",
        "Choose one of the printed obligation outcomes.",
        [
          ...(s.player.form === "alter" && !s.player.exhausted
            ? [
                option(
                  "exhaust",
                  "Exhaust Steve Rogers · remove obligation",
                  [cap("obligation-remove", { piece: e.piece })],
                  "03001b",
                ),
              ]
            : []),
          option(
            "discard",
            `Discard ${count} cards from hand · discard obligation`,
            [cap("obligation-discard", { piece: e.piece, count })],
          ),
        ],
      );
      break;
    }
    case "cap:obligation-remove":
      need(
        s.player.form === "alter" && !s.player.exhausted,
        "Steve Rogers must be ready in alter-ego form.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "cap:obligation-discard":
      if (!e.count) ports.queue(s, E("discardEncounter", { piece: e.piece }));
      else
        ports.select(
          s,
          "Man Out of Time · discard",
          `Choose ${e.count} cards from hand to discard.`,
          s.player.hand,
          e.count,
          e.count,
          cap("obligation-paid", { piece: e.piece, count: e.count }),
        );
      break;
    case "cap:obligation-paid":
      for (const p of selectedHand(s, e.ids, e.count))
        ports.discardHand(s, p.id);
      ports.queue(s, E("discardEncounter", { piece: e.piece }));
      break;
    case "cap:hit-squad": {
      const p = ports.drawEncounter(s);
      if (p) {
        s.encounter.discard.push(p);
        ports.queue(
          s,
          E("damage", {
            target: "hero",
            amount: cards.get(p.code)?.boost || 0,
            source: "Hit Squad",
          }),
        );
      }
      break;
    }
    case "cap:soldier-defeated":
      ports.dealEncounter(s, e.playerId);
      break;
    case "cap:hail-hydra": {
      const hydra =
        s.player.form === "hero"
          ? s.minions.filter(
              (p) =>
                (!p.engagedWith || p.engagedWith === s.activePlayerId) &&
                cards.get(p.code)?.traits?.includes("Hydra."),
            )
          : [];
      ports.queue(
        s,
        ...hydra.map((p) => E("enemyAttack", { id: p.id })),
        cap("hail-after", { before: Number(s.flags.attacksPerformed || 0) }),
      );
      break;
    }
    case "cap:hail-after":
      if (Number(s.flags.attacksPerformed || 0) === e.before)
        ports.queue(s, cap("hydra-search"));
      break;
    case "cap:hydra-search": {
      ports.revealHidden(s);
      const matches = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) =>
          cards.get(p.code)?.type_code === "minion" &&
          cards.get(p.code)?.traits?.includes("Hydra."),
      );
      if (matches.length)
        ports.choose(
          s,
          "Hail Hydra!",
          "Choose a Hydra minion from the encounter deck or discard pile to put into play engaged with you.",
          matches.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [cap("hydra-found", { id: p.id })],
              p.code,
            ),
          ),
        );
      else ports.shuffle(s, s.encounter.deck);
      break;
    }
    case "cap:hydra-found": {
      const zone = [s.encounter.deck, s.encounter.discard].find((zone) =>
        zone.some((p) => p.id === e.id),
      );
      need(zone, "The chosen Hydra minion is no longer available.");
      const p = zone!.splice(
        zone!.findIndex((p) => p.id === e.id),
        1,
      )[0];
      p.engagedWith = s.activePlayerId;
      s.minions.push(p);
      ports.shuffle(s, s.encounter.deck);
      ports.queue(s, E("minionEntered", { id: p.id }));
      break;
    }
    default:
      throw Error(`Unregistered Captain America effect: ${e.type}`);
  }
  return true;
}
