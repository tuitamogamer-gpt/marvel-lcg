import catalog from "../data/catalog-cards.json" with { type: "json" };
import corePlayers from "../data/core-player.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map(
  ([...catalog, ...corePlayers] as Card[]).map((c) => [c.code, c]),
);
const I = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `inheritors:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const inheritor = (p: Pick<Piece, "code">) => {
  const c = definitions.get(p.code);
  return (
    c?.type_code === "minion" &&
    (c.traits || "").split(/\.\s*/).includes("Inheritor")
  );
};

/** Authored module hooks. Native timing and physical-card ports are required. */
export const INHERITORS_SCRIPT_CODES = [
  "30030",
  "30031",
  "30032",
  "30033",
  "30034",
  "30035",
  "30036",
  "30037",
  "30038",
] as const;
export const INHERITORS_SET = "inheritors";

export interface InheritorsCharacter {
  id: string;
  label: string;
  code?: string;
}
export interface InheritorsPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  /** Native dynamic traits, including traits granted by upgrades. */
  hasTrait(s: GameState, target: string, trait: string): boolean;
  /** The active seat's identity in either form and actual controlled allies. */
  controlledCharacters(s: GameState): InheritorsCharacter[];
  /** Native Stalwart, Steady and existing-status limits. */
  statusEligible(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  canDiscardControlled(s: GameState, p: Piece): boolean;
  /** Native physical discard, including leave-play interrupts and ownership. */
  discardControlled(s: GameState, id: string): void;
  /** Return the actual discarded piece and exhaustion boundary, even when
   * discarding the final card immediately resets the native encounter deck. */
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** Move this exact instance from every prior encounter zone. PUT does not
   * resolve its When Revealed ability; native entry and uniqueness still apply. */
  putMinion(s: GameState, piece: Piece, playerId: string): void;
  /** Give this physical minion a facedown encounter card for its next actual
   * activation. Do not consume it when stun/confuse cancels an activation. */
  giveBoost(s: GameState, enemyId: string): void;
  /** Prepare native prevention for each target, then place all damage before
   * checking defeats or opening damage/defeat responses. Serializable pauses. */
  damageSimultaneously(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
}

/** These are grants, not total printed stats/keywords. A blanked recipient
 * retains its traits and grants from other unblanked sources. Numeric effects
 * accumulate per source; each source also grants its own effect to itself. */
export function inheritorsModifiers(s: GameState, p: Piece) {
  const result = {
    attack: 0,
    acceleration: 0,
    patrol: false,
    stalwart: false,
    guard: false,
    overkill: false,
    piercing: false,
    villainous: false,
    retaliate: 0,
  };
  if (!s.minions.some((m) => m.id === p.id) || !inheritor(p)) return result;
  for (const source of s.minions) {
    if (isTextBlank(s, source)) continue;
    switch (source.code) {
      case "30031":
        result.acceleration++;
        break;
      case "30032":
        result.patrol = true;
        break;
      case "30033":
        result.stalwart = true;
        break;
      case "30034":
        result.guard = true;
        break;
      case "30035":
        result.overkill = result.piercing = true;
        break;
      case "30036":
        result.attack++;
        break;
      case "30037":
        result.villainous = true;
        break;
      case "30038":
        result.retaliate++;
        break;
    }
  }
  return result;
}

/** Check the actual current identity face and actual allies. Web-Warrior
 * supports/upgrades do not qualify; traits on an inactive hero face do not
 * carry across to its alter-ego face. A native grant to that current face does. */
export function inheritorsQualifyingPlayers(
  s: GameState,
  ports: Pick<InheritorsPorts, "hasTrait">,
) {
  return playerOrder(s).filter((seat) => {
    const view = seatView(s, seat);
    return (
      ports.hasTrait(view, "hero", "Web-Warrior") ||
      view.player.inPlay.some(
        (p) =>
          !p.treatedAsMinion &&
          definitions.get(p.code)?.type_code === "ally" &&
          ports.hasTrait(view, p.id, "Web-Warrior"),
      )
    );
  });
}

/** The host enters the actual minion first, then resolves its reveal. The
 * global Web-Warrior condition is evaluated at native ability initiation. */
export function inheritorsReveal(s: GameState, p: Piece): Effect[] | null {
  if (
    !INHERITORS_SCRIPT_CODES.includes(
      p.code as (typeof INHERITORS_SCRIPT_CODES)[number],
    )
  )
    return null;
  if (p.code === "30030" || isTextBlank(s, p)) return [];
  return [
    I(`reveal-${p.code}`, {
      id: p.id,
      actorId: s.activePlayerId,
    }),
  ];
}

/** All nine imported faces have ordinary boost icons and no boost ability. */
export function inheritorsBoost(_s: GameState, p: Piece): Effect[] | null {
  return INHERITORS_SCRIPT_CODES.includes(
    p.code as (typeof INHERITORS_SCRIPT_CODES)[number],
  )
    ? []
    : null;
}

/** Give each source to the native same-window forced-interrupt scheduler.
 * These resolve before phase-begins responses and ordinary step-one threat. */
export function inheritorsVillainPhaseInterrupts(s: GameState): Effect[] {
  return s.sideSchemes
    .filter((p) => p.code === "30030" && !isTextBlank(s, p))
    .map((p) => I("hunt", { id: p.id, actorId: s.firstPlayerId }));
}

function discardTargets(s: GameState, ports: InheritorsPorts) {
  return s.player.inPlay.filter(
    (p) =>
      ["support", "upgrade"].includes(
        definitions.get(p.code)?.type_code || "",
      ) && ports.canDiscardControlled(s, p),
  );
}
function huntRecipients(s: GameState, ports: InheritorsPorts) {
  const qualified = inheritorsQualifyingPlayers(s, ports);
  return qualified.length ? qualified : playerOrder(s).slice(0, 1);
}

export function resolveInheritorsEffect(
  s: GameState,
  e: Effect,
  ports: InheritorsPorts,
): boolean {
  if (!e.type.startsWith("inheritors:")) return false;
  switch (e.type) {
    case "inheritors:hunt": {
      const source = s.sideSchemes.find((p) => p.id === e.id);
      if (!source || source.code !== "30030" || isTextBlank(s, source)) break;
      const discarded: Piece[] = [];
      for (let count = 0; count < 3; count++) {
        const result = ports.discardTop(s);
        if (result.piece && inheritor(result.piece))
          discarded.push(result.piece);
        // RRG discard-top-X stops at the first deck-exhaustion boundary.
        if (!result.piece || result.emptied) break;
      }
      ports.queue(
        s,
        I("hunt-next", {
          remaining: discarded,
          actorId: s.firstPlayerId,
        }),
      );
      break;
    }
    case "inheritors:hunt-next": {
      const [piece, ...remaining] = e.remaining as Piece[];
      if (!piece) break;
      const recipients = huntRecipients(s, ports);
      const options = recipients.map((seat): Option => ({
        id: seat.id,
        label:
          ports
            .controlledCharacters(seatView(s, seat))
            .find((target) => target.id.startsWith("hero"))?.label ||
          seat.heroId,
        image: piece.code,
        effects: [
          I("put", {
            piece,
            remaining,
            playerId: seat.id,
            actorId: s.firstPlayerId,
          }),
        ],
      }));
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length > 1)
        ports.choose(
          s,
          "Hunting the Spider-Totems",
          `Choose a player who controls a Web-Warrior character to engage ${definitions.get(piece.code)!.name}.`,
          options,
        );
      break;
    }
    case "inheritors:put": {
      // A saved choice can outlive an eliminated seat or a lost trait grant.
      if (!huntRecipients(s, ports).some((p) => p.id === e.playerId)) {
        ports.queue(
          s,
          I("hunt-next", {
            remaining: [e.piece, ...e.remaining],
            actorId: s.firstPlayerId,
          }),
        );
        break;
      }
      // Native entry/Quickstrike effects prepend before this continuation.
      ports.queue(
        s,
        I("hunt-next", {
          remaining: e.remaining,
          actorId: s.firstPlayerId,
        }),
      );
      ports.putMinion(s, e.piece, e.playerId);
      break;
    }
    case "inheritors:reveal-30031":
    case "inheritors:reveal-30032":
    case "inheritors:reveal-30033":
    case "inheritors:reveal-30034":
    case "inheritors:reveal-30035":
    case "inheritors:reveal-30036":
    case "inheritors:reveal-30037":
    case "inheritors:reveal-30038": {
      if (!inheritorsQualifyingPlayers(s, ports).length) break;
      const code = e.type.slice(-5);
      switch (code) {
        case "30031":
          ports.queue(
            s,
            E("threat", { target: "main", amount: 1, source: e.id }),
            ...s.sideSchemes.map((p) =>
              E("threat", { target: p.id, amount: 1, source: e.id }),
            ),
          );
          break;
        case "30032":
          ports.queue(
            s,
            E("threat", { target: "main", amount: 2, source: e.id }),
          );
          break;
        case "30033": {
          const options = ports
            .controlledCharacters(s)
            .filter((target) => ports.statusEligible(s, target.id, "stunned"))
            .map((target): Option => ({
              id: target.id,
              label: target.label,
              image: target.code,
              effects: [
                I("stun", {
                  target: target.id,
                  actorId: s.activePlayerId,
                }),
              ],
            }));
          if (options.length)
            ports.choose(
              s,
              "Daemos",
              "Choose a character you control to stun.",
              options,
            );
          break;
        }
        case "30034":
          ports.queue(s, E("status", { target: e.id, status: "tough" }));
          break;
        case "30035": {
          const options = discardTargets(s, ports).map((p): Option => ({
            id: p.id,
            label: definitions.get(p.code)!.name,
            image: p.code,
            effects: [I("discard", { id: p.id, actorId: s.activePlayerId })],
          }));
          if (options.length)
            ports.choose(
              s,
              "Karn",
              "Choose an upgrade or support you control to discard.",
              options,
            );
          break;
        }
        case "30036":
          ports.queue(
            s,
            E("damage", {
              target: "hero",
              amount: 2,
              source: e.id,
              actorId: s.activePlayerId,
            }),
          );
          break;
        case "30037":
          if (s.minions.some((p) => p.id === e.id && p.code === code))
            ports.giveBoost(s, e.id);
          break;
        case "30038":
          ports.damageSimultaneously(
            s,
            ports.controlledCharacters(s).map((target) => target.id),
            1,
            e.id,
          );
          break;
      }
      break;
    }
    case "inheritors:stun":
      need(
        ports.controlledCharacters(s).some((p) => p.id === e.target) &&
          ports.statusEligible(s, e.target, "stunned"),
        "The chosen controlled character cannot receive a stun status card.",
      );
      ports.queue(
        s,
        E("status", {
          target: e.target,
          status: "stunned",
          actorId: s.activePlayerId,
        }),
      );
      break;
    case "inheritors:discard":
      need(
        discardTargets(s, ports).some((p) => p.id === e.id),
        "The chosen controlled upgrade or support cannot be discarded.",
      );
      ports.discardControlled(s, e.id);
      break;
    default:
      throw Error(`Unknown Inheritors effect: ${e.type}`);
  }
  return true;
}
