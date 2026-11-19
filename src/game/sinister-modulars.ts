import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: the Osborn Tech and Sinister Assault modular sets. */
export const OSBORN_TECH_CODES = [
  "27147",
  "27148",
  "27149",
  "27150",
  "27151",
  "27152",
] as const;
export const SINISTER_ASSAULT_CODES = [
  "27158",
  "27159",
  "27160",
  "27161",
  "27162",
  "27163",
] as const;
export const SINISTER_MODULAR_SCRIPT_CODES = [
  ...OSBORN_TECH_CODES,
  ...SINISTER_ASSAULT_CODES,
] as const;
export const SINISTER_MODULAR_SETS = [
  "osborn_tech",
  "sinister_assault",
] as const;

const ARM_CANNON = "27147";
const IONIC_BOOTS = "27148";
const KINETIC_ARMOR = "27149";
const NEOCARBON = "27150";
const GAUNTLET = "27151";
const TRACKING = "27152";
const OCTOPUS = "27158";
const ELECTRO = "27159";
const HOBGOBLIN = "27160";
const KRAVEN = "27161";
const SCORPION = "27162";
const VULTURE = "27163";

export interface SinisterModularPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  randomDiscard(s: GameState, playerId: string): void;
  /** Discard the top card of a player's deck and return it. */
  millOne(s: GameState, playerId: string): Piece | undefined;
  /** Cards a player controls in play that can be discarded. */
  controlled(s: GameState, playerId: string): Piece[];
  /** Characters a player controls: the identity ("hero:<id>") and allies. */
  characters(s: GameState, playerId: string): string[];
  exhaust(s: GameState, id: string): void;
  cost(p: Piece): number;
  payResources(
    s: GameState,
    title: string,
    resources: ("energy" | "mental" | "physical")[],
    after: Effect[],
  ): void;
  /** Whether a character ("hero" for the player's identity) is stunned. */
  stunned(s: GameState, target: string, playerId: string): boolean;
  heroHp(s: GameState, playerId: string): number;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const S = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `smod:${type}`,
  ...args,
});
const scripted = new Set<string>(SINISTER_MODULAR_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
/** Permanent cards cannot be discarded from play. */
const permanent = (p: Piece) =>
  (def(p) as { permanent?: boolean } | undefined)?.permanent === true ||
  /(?:^|[.\n])\s*Permanent\b/.test(
    (def(p)?.text || "").replace(/<[^>]+>/g, ""),
  );
/** Osborn Tech attachments on an enemy. */
const attached = (s: GameState, enemyId: string, code: string) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === enemyId && active(s, a),
  );

// -------------------------------------------------------------- constants

/** Arm Cannon's overkill and piercing, Kinetic Armor's retaliate 1. */
export function sinisterModularKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (
    (keyword === "Overkill" || keyword === "Piercing") &&
    attached(s, p.id, ARM_CANNON).length
  )
    return 1;
  if (keyword === "Retaliate") return attached(s, p.id, KINETIC_ARMOR).length;
  return 0;
}
/** Neocarbon Scales: 1 less damage from each attack. */
export function sinisterModularAttackReduction(
  s: GameState,
  targetId: string,
): number {
  return attached(s, targetId, NEOCARBON).length;
}
/** Tracking Display: no character can defend against the attached villain. */
export function sinisterModularCannotDefend(
  s: GameState,
  attackerId: string,
): boolean {
  return attached(s, attackerId, TRACKING).length > 0;
}

// -------------------------------------------------------------- responses

/** Forced Responses after an enemy activates against a player, attacks or
 * engages. */
export function sinisterModularActivated(
  s: GameState,
  r: {
    enemyId: string;
    playerId: string;
    attack: boolean;
    /** The character the attack damaged, if any. */
    damagedTarget?: string;
    identityDamaged?: boolean;
  },
): Effect[] {
  if (over(s) || !alive(s, r.playerId)) return [];
  const out: Effect[] = [];
  const enemy =
    s.villain?.id === r.enemyId
      ? s.villain
      : s.minions.find((m) => m.id === r.enemyId);
  if (!enemy) return out;
  if (r.attack && r.identityDamaged)
    for (const a of attached(s, r.enemyId, IONIC_BOOTS))
      out.push({ type: "threat", target: "main", amount: 2, source: a.id });
  if (!active(s, enemy)) return out;
  switch (enemy.code) {
    case OCTOPUS:
      out.push(S("octopus"));
      break;
    case ELECTRO:
      out.push(S("electro", { playerId: r.playerId }));
      break;
    case HOBGOBLIN:
      if (r.attack)
        out.push(
          S("indirect", { playerId: r.playerId, amount: 2, id: enemy.id }),
        );
      break;
    case KRAVEN:
      if (r.attack && r.damagedTarget)
        out.push(S("kraven", { playerId: r.playerId }));
      break;
    case SCORPION:
      if (r.attack && r.damagedTarget)
        out.push(
          S("scorpion", {
            target: r.damagedTarget,
            id: enemy.id,
            playerId: r.playerId,
          }),
        );
      break;
    case VULTURE:
      out.push(S("vulture", { playerId: r.playerId }));
      break;
  }
  return out;
}
/** Electro's Forced Response after he engages you. */
export function sinisterModularEngaged(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === ELECTRO && active(s, p) && alive(s, playerId)
    ? [S("electro", { playerId })]
    : [];
}

// ---------------------------------------------------------------- actions

export function sinisterModularActions(s: GameState, p: Piece): Option[] {
  if (!known(p) || !active(s, p) || s.player.form !== "hero") return [];
  if (!s.attachments.some((q) => q.id === p.id)) return [];
  const playerId = s.activePlayerId;
  const label = (cost: string) => `${cost} · discard ${name(p)}`;
  switch (p.code) {
    case ARM_CANNON:
      return s.player.inPlay.some(
        (q) => def(q)?.type_code === "upgrade" && !permanent(q),
      )
        ? [
            {
              id: "discard",
              label: label("Discard your highest-cost upgrade"),
              image: p.code,
              effects: [S("arm-cannon", { id: p.id, playerId })],
            },
          ]
        : [];
    case IONIC_BOOTS:
      return [
        {
          id: "discard",
          label: label("Spend energy, mental, physical"),
          image: p.code,
          effects: [S("boots", { id: p.id })],
        },
      ];
    case KINETIC_ARMOR:
      return [
        {
          id: "discard",
          label: label("Take 3 indirect damage"),
          image: p.code,
          effects: [
            S("indirect", { playerId, amount: 3, id: p.id }),
            { type: "discardPiece", id: p.id },
          ],
        },
      ];
    case NEOCARBON:
      return [
        {
          id: "discard",
          label: label("Give the villain a tough status and a facedown boost"),
          image: p.code,
          effects: [S("scales", { id: p.id })],
        },
      ];
    case GAUNTLET:
      return [
        {
          id: "discard",
          label:
            "The villain attacks you · discard Spiked Gauntlet if your identity takes no damage",
          image: p.code,
          effects: [S("gauntlet", { id: p.id, playerId })],
        },
      ];
    case TRACKING:
      return s.player.hand.length
        ? [
            {
              id: "discard",
              label: label("Exhaust a character and discard a random card"),
              image: p.code,
              effects: [S("tracking", { id: p.id, playerId })],
            },
          ]
        : [];
    default:
      return [];
  }
}

// ----------------------------------------------------------------- reveal

export function sinisterModularReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if ((OSBORN_TECH_CODES as readonly string[]).includes(p.code))
    return [S("attach", { piece: p })];
  return [];
}
export function sinisterModularBoost(s: GameState, p: Piece): Effect[] | null {
  return known(p) ? [] : null;
}

// --------------------------------------------------------------- resolver

export function resolveSinisterModularEffect(
  s: GameState,
  e: Effect,
  ports: SinisterModularPorts,
): boolean {
  if (!e.type.startsWith("smod:")) return false;
  switch (e.type) {
    case "smod:attach": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "smod:octopus":
      ports.queue(s, { type: "threat", target: "main", amount: 1 });
      for (const q of s.sideSchemes)
        ports.queue(s, { type: "threat", target: q.id, amount: 1 });
      break;
    case "smod:electro": {
      if (!alive(s, e.playerId)) break;
      // Discard from the top of your deck until an energy or wild resource.
      for (let n = 0; n < 60; n++) {
        const p = ports.millOne(s, e.playerId);
        if (!p) break;
        const c = def(p);
        if (c?.resource_energy || c?.resource_wild) break;
      }
      break;
    }
    case "smod:indirect":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, e.amount, e.id, name(e.id));
      break;
    case "smod:kraven": {
      if (!alive(s, e.playerId)) break;
      const cards = ports
        .controlled(s, e.playerId)
        .filter((q) =>
          ["upgrade", "support"].includes(def(q)?.type_code || ""),
        );
      if (cards.length)
        ports.choose(
          s,
          name(KRAVEN),
          "Discard 1 upgrade or support you control.",
          cards.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [{ type: "discardPiece", id: q.id }],
          })),
        );
      break;
    }
    case "smod:scorpion":
      // Stun the damaged character; if it is already stunned, deal it 2.
      if (!alive(s, e.playerId)) break;
      if (ports.stunned(s, e.target, e.playerId))
        ports.queue(s, {
          type: "damage",
          target: e.target,
          amount: 2,
          source: e.id,
          actorId: e.playerId,
        });
      else
        ports.queue(s, {
          type: "status",
          target: e.target,
          status: "stunned",
          actorId: e.playerId,
        });
      break;
    case "smod:vulture":
      if (alive(s, e.playerId)) ports.randomDiscard(s, e.playerId);
      break;
    case "smod:arm-cannon": {
      if (!s.attachments.some((q) => q.id === e.id)) break;
      const upgrades = ports
        .controlled(s, e.playerId)
        .filter((q) => def(q)?.type_code === "upgrade");
      if (!upgrades.length) break;
      const max = Math.max(...upgrades.map((q) => ports.cost(q)));
      const highest = upgrades.filter((q) => ports.cost(q) === max);
      ports.choose(
        s,
        name(ARM_CANNON),
        "Discard the highest-cost upgrade you control.",
        highest.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            { type: "discardPiece", id: q.id },
            { type: "discardPiece", id: e.id },
          ],
        })),
      );
      break;
    }
    case "smod:boots":
      if (!s.attachments.some((q) => q.id === e.id)) break;
      ports.payResources(
        s,
        name(IONIC_BOOTS),
        ["energy", "mental", "physical"],
        [{ type: "discardPiece", id: e.id }],
      );
      break;
    case "smod:scales":
      if (!s.attachments.some((q) => q.id === e.id) || !s.villain) break;
      ports.queue(
        s,
        { type: "status", target: s.villain.id, status: "tough" },
        S("boost-facedown"),
        { type: "discardPiece", id: e.id },
      );
      break;
    case "smod:boost-facedown":
      if (s.villain) ports.giveBoost(s, s.villain.id, "next");
      break;
    case "smod:gauntlet": {
      if (!s.attachments.some((q) => q.id === e.id) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: S("gauntlet-after", {
          id: e.id,
          playerId: e.playerId,
          hp: ports.heroHp(s, e.playerId),
        }),
      });
      break;
    }
    case "smod:gauntlet-after":
      if (
        alive(s, e.playerId) &&
        ports.heroHp(s, e.playerId) >= e.hp &&
        s.attachments.some((q) => q.id === e.id)
      )
        ports.discardPiece(s, e.id);
      break;
    case "smod:tracking": {
      if (!s.attachments.some((q) => q.id === e.id)) break;
      const view = seatView(s, e.playerId);
      const characters = ports
        .characters(s, e.playerId)
        .filter((id) =>
          id.startsWith("hero:")
            ? !view.player.exhausted
            : !view.player.inPlay.find((q) => q.id === id)?.exhausted,
        );
      if (!characters.length || !view.player.hand.length) break;
      ports.choose(
        s,
        name(TRACKING),
        "Exhaust a character you control.",
        characters.map((id) => ({
          id,
          label: id.startsWith("hero:")
            ? "Your identity"
            : name(view.player.inPlay.find((q) => q.id === id)!),
          effects: [
            S("exhaust", { id }),
            S("random-discard", { playerId: e.playerId }),
            { type: "discardPiece", id: e.id },
          ],
        })),
      );
      break;
    }
    case "smod:exhaust":
      ports.exhaust(s, e.id);
      break;
    case "smod:random-discard":
      if (alive(s, e.playerId)) ports.randomDiscard(s, e.playerId);
      break;
    default:
      return false;
  }
  return true;
}
