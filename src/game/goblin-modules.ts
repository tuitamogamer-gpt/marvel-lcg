import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
import { engaged, playerOrder, seatView } from "./team.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import type {
  MutagenActivation,
  MutagenForcedResponse,
} from "./mutagen-formula.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const gm = (name: string, args: Record<string, unknown> = {}) =>
  E(`goblin-module:${name}`, args);
const choice = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};

/** Authored hooks. The host must install and verify the native timing/physical-card ports. */
export const GOBLIN_MODULE_SCRIPT_CODES = [
  "02037",
  "02038",
  "02039",
  "02040",
  "02041",
  "02042",
  "02043",
  "02044",
  "02045",
  "02046",
  "02047",
  "02048",
  "02049",
] as const;
export const GOBLIN_MODULE_SETS = [
  "a_mess_of_things",
  "power_drain",
  "running_interference",
] as const;

export interface GoblinModuleEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  pay(
    s: GameState,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    title: string,
    cancelable: boolean,
  ): void;
  canPay(s: GameState, cost: number, requirements: Resource[]): boolean;
  /** Return the actual card and first exhaustion boundary, even after an immediate reset. */
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** Put the actual discarded instance; do not reveal it. Native uniqueness and engagement apply. */
  putMinion(s: GameState, piece: Piece, playerId: string): void;
  attach(s: GameState, piece: Piece, target: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Discard a card in the current actor's hand, retaining its physical owner. No resource generation. */
  discardHand(s: GameState, id: string): void;
  /** Finish the entire activation before callback; callback receives performed and actual outcomes. */
  activate(s: GameState, request: MutagenActivation): void;
}

export function goblinModuleReveal(
  s: GameState,
  piece: Piece,
): Effect[] | null {
  const playerId = s.activePlayerId;
  switch (piece.code) {
    case "02037":
      return [gm("mess", { id: piece.id })];
    case "02038":
    case "02041":
    case "02042":
    case "02047":
      return [];
    case "02039":
      return s.player.form === "alter"
        ? [E("surge", { actorId: playerId })]
        : [gm("gang-up", { playerId, actorId: playerId })];
    case "02040":
      return [gm("tail-sweep", { playerId, actorId: playerId })];
    case "02043":
      return [gm("pulse", { playerId, actorId: playerId })];
    case "02044":
      return [
        gm("discard-icons", { amount: 2, mode: "indirect", actorId: playerId }),
      ];
    case "02045":
      return [
        gm("discard-icons", {
          amount: s.playerCount,
          mode: "heal",
          actorId: playerId,
        }),
      ];
    case "02046":
      return [
        gm("interference-each", {
          id: piece.id,
          remaining: playerOrder(s).map((seat) => seat.id),
          actorId: s.firstPlayerId,
        }),
      ];
    case "02048":
    case "02049":
      return [gm("attach-identity", { piece, playerId, actorId: playerId })];
    default:
      return null;
  }
}

/** YOU in a boost refers to the final attacked player; provide that actor after defense is declared. */
export function goblinModuleBoost(
  _s: GameState,
  piece: Piece,
  playerId: string,
): Effect[] | null {
  if (piece.code === "02040")
    return [
      E("status", { target: "hero", status: "stunned", actorId: playerId }),
    ];
  if (["02042", "02043", "02044", "02045"].includes(piece.code))
    return [
      gm("discard-icons", { amount: 3, mode: "none", actorId: playerId }),
    ];
  return GOBLIN_MODULE_SCRIPT_CODES.includes(
    piece.code as (typeof GOBLIN_MODULE_SCRIPT_CODES)[number],
  )
    ? []
    : null;
}

/** Power Drain's When Defeated is a Forced Interrupt while its acceleration remains in play. */
export function goblinModuleDefeated(
  s: GameState,
  piece: Piece,
): Effect[] | null {
  if (piece.code === "02041")
    return [gm("power-drain", { actorId: s.firstPlayerId })];
  return GOBLIN_MODULE_SCRIPT_CODES.includes(
    piece.code as (typeof GOBLIN_MODULE_SCRIPT_CODES)[number],
  )
    ? []
    : null;
}

export interface GoblinModuleAttackResult {
  attacker: Piece;
  playerId: string;
  performed: boolean;
  identityDamage: number;
  /** Actual damaged characters, including both ally and identity when overkill applies. */
  damaged: { target: string; playerId: string; amount: number }[];
}
export function goblinModuleAttackResponses(
  s: GameState,
  result: GoblinModuleAttackResult,
): MutagenForcedResponse[] {
  if (!result.performed) return [];
  const current = s.minions.find(
    (p) => p.id === result.attacker.id && p.code === result.attacker.code,
  );
  if (!current) return [];
  const response = (
    suffix: string,
    effects: Effect[],
  ): MutagenForcedResponse => ({
    id: `${current.id}:${suffix}`,
    sourceId: current.id,
    title: cards.get(current.code)!.name,
    effects,
  });
  if (current.code === "02038")
    return result.damaged
      .filter((d) => d.amount > 0)
      .map((d) =>
        response(d.target, [
          E("status", {
            target: d.target,
            status: "stunned",
            actorId: d.playerId,
          }),
        ]),
      );
  if (current.code === "02042")
    return [
      response("electro", [
        gm("discard-icons", {
          amount: 1,
          mode: "indirect",
          actorId: result.playerId,
        }),
      ]),
    ];
  if (current.code === "02047" && result.identityDamage > 0)
    return [
      response("tombstone", [
        gm("hand-resources", {
          amount: 1,
          types: ["mental", "physical"],
          actorId: result.playerId,
        }),
      ]),
    ];
  return [];
}

/** Identity attachment targets use the native multiplayer hero:<seatId> convention. */
export function goblinIdentityLocked(
  s: GameState,
  playerId = s.activePlayerId,
): boolean {
  return s.attachments.some(
    (p) => p.code === "02048" && p.attachedTo === `hero:${playerId}`,
  );
}
/** Additional resolutions of each When Revealed ability, not additional card entry.
 * RRG 1.8 includes Surge and Incite. Only player-revealed encounter cards qualify;
 * villain stage/environment reveals are game functions and are excluded by the host. */
export function goblinWhenRevealedCopies(
  s: GameState,
  playerId = s.activePlayerId,
): number {
  return s.attachments.filter(
    (p) => p.code === "02049" && p.attachedTo === `hero:${playerId}`,
  ).length;
}
export function goblinModuleAttachmentActions(
  s: GameState,
  piece: Piece,
): Option[] {
  if (s.phase !== "player" || !s.attachments.some((p) => p.id === piece.id))
    return [];
  // Both attachments use "your". RRG p4 reserves their actions/costs to the
  // attached identity's controller, even though they are encounter cards.
  if (piece.attachedTo !== `hero:${s.activePlayerId}`) return [];
  if (piece.code === "02048")
    return [
      choice(
        "remove",
        "Spend mental + physical · discard All Tied Up",
        [gm("remove-cost", { id: piece.id, actorId: s.activePlayerId })],
        piece.code,
      ),
    ];
  if (piece.code === "02049" && s.player.form === "alter")
    return [
      choice(
        "remove",
        "Spend mental · discard Media Coverage",
        [gm("remove-cost", { id: piece.id, actorId: s.activePlayerId })],
        piece.code,
      ),
    ];
  return [];
}

function discardCards(
  s: GameState,
  amount: number,
  ports: GoblinModuleEnginePorts,
): Piece[] {
  const discarded: Piece[] = [];
  for (let count = 0; count < amount; count++) {
    const result = ports.discardTop(s);
    if (result.piece) discarded.push(result.piece);
    if (!result.piece || result.emptied) break;
  }
  return discarded;
}
function resourceCount(piece: Piece, types: Resource[]): number {
  const c = cards.get(piece.code);
  return c
    ? types.reduce(
        (total, type) =>
          total + ((c[`resource_${type}` as keyof Card] as number) || 0),
        0,
      )
    : 0;
}
const allResources: Resource[] = ["energy", "mental", "physical", "wild"];

export function resolveGoblinModuleEffect(
  s: GameState,
  e: Effect,
  ports: GoblinModuleEnginePorts,
): boolean {
  if (!e.type.startsWith("goblin-module:")) return false;
  switch (e.type) {
    case "goblin-module:mess": {
      const stunned = playerOrder(s).reduce((count, seat) => {
        const view = seatView(s, seat);
        return (
          count +
          Number(view.player.stunned) +
          view.player.inPlay.filter(
            (p) => cards.get(p.code)?.type_code === "ally" && p.stunned,
          ).length
        );
      }, 0);
      if (stunned && s.sideSchemes.some((p) => p.id === e.id))
        ports.queue(s, E("threat", { target: e.id, amount: 2 * stunned }));
      break;
    }
    case "goblin-module:gang-up":
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: gm("gang-up-minions", {
          playerId: e.playerId,
          done: [],
          actorId: e.playerId,
        }),
      });
      break;
    case "goblin-module:gang-up-minions": {
      if (s.players.find((seat) => seat.id === e.playerId)?.eliminated) break;
      const minions = engaged(s, e.playerId).filter(
        (p) => !e.done.includes(p.id),
      );
      const next = (p: Piece) => [
        gm("gang-up-attack", {
          id: p.id,
          playerId: e.playerId,
          done: [...e.done, p.id],
          actorId: e.playerId,
        }),
      ];
      if (minions.length === 1) ports.queue(s, ...next(minions[0]));
      else if (minions.length)
        ports.choose(
          s,
          "Gang-Up · minion order",
          "Choose the next engaged minion to attack. Resolve each whole activation before the next.",
          minions.map((p) =>
            choice(p.id, cards.get(p.code)?.name || p.code, next(p), p.code),
          ),
        );
      break;
    }
    case "goblin-module:gang-up-attack": {
      const after = gm("gang-up-minions", {
        playerId: e.playerId,
        done: e.done,
        actorId: e.playerId,
      });
      if (!engaged(s, e.playerId).some((p) => p.id === e.id))
        ports.queue(s, after);
      else
        ports.activate(s, {
          enemyId: e.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 0,
          after,
        });
      break;
    }
    case "goblin-module:tail-sweep": {
      const scorpion = s.minions.find((p) => p.code === "02038");
      if (!scorpion || seatView(s, e.playerId).player.form !== "hero")
        ports.queue(
          s,
          E("status", {
            target: "hero",
            status: "stunned",
            actorId: e.playerId,
          }),
        );
      else
        ports.activate(s, {
          enemyId: scorpion.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 0,
          after: gm("tail-after", {
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        });
      break;
    }
    case "goblin-module:tail-after":
      if (!e.performed)
        ports.queue(
          s,
          E("status", {
            target: "hero",
            status: "stunned",
            actorId: e.playerId,
          }),
        );
      break;
    case "goblin-module:pulse": {
      const electro = discardCards(s, 7, ports).find((p) => p.code === "02042");
      if (electro) ports.putMinion(s, electro, e.playerId);
      else ports.queue(s, E("surge", { actorId: e.playerId }));
      break;
    }
    case "goblin-module:discard-icons": {
      const amount = discardCards(s, e.amount, ports).reduce(
        (total, p) => total + (cards.get(p.code)?.boost || 0),
        0,
      );
      if (amount && e.mode === "indirect")
        ports.queue(
          s,
          E("indirect", {
            amount,
            source: "Power Drain",
            actorId: s.activePlayerId,
          }),
        );
      if (amount && e.mode === "heal")
        ports.queue(s, E("heal", { target: s.villain.id, amount }));
      break;
    }
    case "goblin-module:power-drain": {
      const amount = discardCards(s, 2, ports).reduce(
        (total, p) => total + (cards.get(p.code)?.boost || 0),
        0,
      );
      if (amount)
        ports.queue(
          s,
          gm("power-drain-each", {
            remaining: playerOrder(s).map((seat) => seat.id),
            amount,
            actorId: s.firstPlayerId,
          }),
        );
      break;
    }
    case "goblin-module:power-drain-each":
    case "goblin-module:interference-each": {
      const remaining: string[] = e.remaining.filter(
        (id: string) => !s.players.find((seat) => seat.id === id)?.eliminated,
      );
      if (!remaining.length) break;
      const power = e.type === "goblin-module:power-drain-each";
      const next = (id: string): Effect[] => [
        power
          ? gm("hand-resources", {
              amount: e.amount,
              types: allResources,
              actorId: id,
            })
          : gm("interference-player", { id: e.id, actorId: id }),
        {
          ...e,
          remaining: remaining.filter((other) => other !== id),
          actorId: s.firstPlayerId,
        },
      ];
      if (remaining.length === 1) ports.queue(s, ...next(remaining[0]));
      else
        ports.choose(
          s,
          power
            ? "Power Drain · player order"
            : "Running Interference · player order",
          "The first player chooses the next player to resolve this effect.",
          remaining.map((id) => choice(id, id, next(id))),
        );
      break;
    }
    case "goblin-module:hand-resources": {
      if (e.amount <= 0) break;
      const available = s.player.hand.filter(
        (p) => resourceCount(p, e.types) > 0,
      );
      if (!available.length) break;
      ports.choose(
        s,
        "Discard hand resources",
        `Discard ${e.amount} remaining printed resource${e.amount === 1 ? "" : "s"} from your hand, if able.`,
        available.map((p) =>
          choice(
            p.id,
            `${cards.get(p.code)?.name} · ${resourceCount(p, e.types)} resource(s)`,
            [
              gm("discard-resource-card", {
                id: p.id,
                remaining: e.amount,
                types: e.types,
                actorId: s.activePlayerId,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "goblin-module:discard-resource-card": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && resourceCount(p, e.types) > 0,
        "Selected card no longer has an eligible printed resource in your hand.",
      );
      const amount = resourceCount(p!, e.types);
      ports.discardHand(s, p!.id);
      ports.queue(
        s,
        gm("hand-resources", {
          amount: e.remaining - amount,
          types: e.types,
          actorId: s.activePlayerId,
        }),
      );
      break;
    }
    case "goblin-module:interference-player": {
      if (!s.sideSchemes.some((p) => p.id === e.id)) break;
      const options = [
        choice("threat", "Place 2 threat on Running Interference", [
          E("threat", { target: e.id, amount: 2 }),
        ]),
      ];
      if (ports.canPay(s, 2, ["mental", "physical"]))
        options.unshift(
          choice("pay", "Spend mental + physical", [
            gm("interference-pay", { id: e.id, actorId: s.activePlayerId }),
          ]),
        );
      ports.choose(
        s,
        "Running Interference",
        "Choose to spend the required resources or place threat.",
        options,
      );
      break;
    }
    case "goblin-module:interference-pay":
      ports.pay(
        s,
        2,
        ["mental", "physical"],
        [],
        "Running Interference",
        false,
      );
      break;
    case "goblin-module:attach-identity":
      ports.attach(s, e.piece, `hero:${e.playerId}`);
      break;
    case "goblin-module:remove-cost": {
      const p = s.attachments.find(
        (p) => p.id === e.id && ["02048", "02049"].includes(p.code),
      );
      need(
        p && s.phase === "player",
        "Goblin attachment is no longer actionable.",
      );
      need(
        p!.attachedTo === `hero:${s.activePlayerId}`,
        "Only the attached identity's controller can pay this attachment's cost.",
      );
      need(
        p!.code !== "02049" || s.player.form === "alter",
        "Media Coverage requires an alter-ego action.",
      );
      const requirements: Resource[] =
        p!.code === "02048" ? ["mental", "physical"] : ["mental"];
      ports.pay(
        s,
        requirements.length,
        requirements,
        [gm("remove", { id: p!.id, actorId: s.activePlayerId })],
        cards.get(p!.code)!.name,
        true,
      );
      break;
    }
    case "goblin-module:remove":
      if (s.attachments.some((p) => p.id === e.id)) ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Goblin module effect: ${e.type}`);
  }
  return true;
}
