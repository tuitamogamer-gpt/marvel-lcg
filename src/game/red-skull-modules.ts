import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { printedCardMetadata } from "./printed-card-metadata.js";
import { playerOrder, seatView } from "./team.js";
import { uniqueConflict } from "./unique.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type {
  Attack,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

export const RED_SKULL_MODULE_SCRIPT_CODES = [
  "04145",
  "04146",
  "04147",
  "04148",
  "04149",
  "04150",
  "04151",
  "04152",
  "04153",
  "04154",
] as const;
const definitions = new Map(
  catalog.map((c) => [c.code, printedCardMetadata(c)]),
);
const known = (p: Piece) =>
  (RED_SKULL_MODULE_SCRIPT_CODES as readonly string[]).includes(p.code);
const R = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `red-skull-modules:${name}`,
  ...args,
});
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const weaponCosts: Resource[] = ["mental", "physical"];
const isWeapon = (p: Piece) => ["04148", "04149"].includes(p.code);
export interface RedSkullModulePorts extends Pick<
  MutagenEnginePorts,
  | "queue"
  | "choose"
  | "attach"
  | "pay"
  | "canPay"
  | "discardPiece"
  | "shuffleEncounter"
> {
  /** Defer an activation until the current activation and its responses end. */
  activateEffect(s: GameState, effect: Effect): void;
  supports(s: GameState): Piece[];
  undefended(s: GameState, attack: Attack): boolean;
  revealHidden(s: GameState): void;
  putMinion(s: GameState, p: Piece, playerId: string): void;
}
function activeAttachment(s: GameState, id: string, code: string) {
  return (
    id === s.villain.id &&
    s.attachments.some(
      (p) => p.code === code && p.attachedTo === id && !isTextBlank(s, p),
    )
  );
}
/** The knife's constant ability is checked at the actual Piercing window. */
export function redSkullPiercing(s: GameState, id: string) {
  return activeAttachment(s, id, "04148");
}
/** Sidearm grants Ranged to the attack at its initiation, independent of later removal. */
export function redSkullRanged(s: GameState, id: string) {
  return activeAttachment(s, id, "04149");
}
export function redSkullActions(s: GameState, p: Piece): Option[] {
  if (
    !isWeapon(p) ||
    s.player.form !== "hero" ||
    isTextBlank(s, p) ||
    !s.attachments.some((q) => q.id === p.id)
  )
    return [];
  return [
    {
      id: "remove",
      label: `Spend mental + physical resources · discard ${definitions.get(p.code)!.name}`,
      image: p.code,
      effects: [R("remove-cost", { id: p.id })],
    },
  ];
}
export function redSkullActionEffects(
  s: GameState,
  p: Piece,
  action: string | undefined,
): Effect[] | null {
  if (!isWeapon(p)) return null;
  const chosen = redSkullActions(s, p).find(
    (o) => !action || action === "special" || action === o.id,
  );
  need(chosen, "This Weapon Master Hero Action is not available.");
  return chosen!.effects;
}
export function redSkullReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isWeapon(p)) return [R("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  if (p.code === "04147") return [E("sw:hydra", { origin: s.activePlayerId })];
  if (p.code === "04150")
    return [
      R("activate", {
        playerId: s.activePlayerId,
        kind: s.player.form === "hero" ? "attack" : "scheme",
        after: [
          R("weapon-surge", { sourceId: p.id, actorId: s.activePlayerId }),
        ],
      }),
    ];
  if (p.code === "04151") {
    const hero = s.player.form === "hero",
      status = hero ? "stunned" : "confused";
    const amount = s.player[status] ? 2 : 1;
    return [
      E("status", { target: "hero", status }),
      hero
        ? E("damage", { target: "hero", amount, source: p.id })
        : E("threat", { target: "main", amount }),
    ];
  }
  return [];
}
/** No damage requirement: an undefended zero-damage/Tough attack still triggers. */
export function redSkullAttackResponses(
  s: GameState,
  a: Attack,
  ports: Pick<RedSkullModulePorts, "supports" | "undefended">,
): MutagenForcedResponse[] {
  const p = s.minions.find((p) => p.id === a.attacker);
  const playerId = a.targetPlayerId || s.activePlayerId;
  if (
    !p ||
    p.code !== "04145" ||
    isTextBlank(s, p) ||
    !ports.undefended(s, a) ||
    !s.players.some((seat) => seat.id === playerId && !seat.eliminated) ||
    !ports.supports(seatView(s, playerId)).length
  )
    return [];
  return [
    {
      id: `${a.id}:flame-soldier`,
      sourceId: p.id,
      title: "Hydra Flame-Soldier",
      effects: [R("discard-support", { actorId: playerId })],
    },
  ];
}
export function redSkullBoost(
  s: GameState,
  p: Piece,
  ports: Pick<RedSkullModulePorts, "undefended">,
): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === "04145" && s.attack && ports.undefended(s, s.attack))
    return [R("discard-support", { actorId: s.activePlayerId })];
  if (
    p.code === "04146" &&
    (s.attack || s.scheming) &&
    s.player.form === "hero"
  )
    return [
      R("activate", {
        playerId: s.activePlayerId,
        kind: "attack",
        omitNormalBoost: true,
        after: [],
      }),
    ];
  return [];
}
export function redSkullSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === "04154" && !isTextBlank(s, p)
    ? [
        R("patrol-search", {
          players: playerOrder(s).map((seat) => seat.id),
          origin: s.activePlayerId,
        }),
      ]
    : [];
}
function hydraCandidates(s: GameState) {
  return [...s.encounter.deck, ...s.encounter.discard].filter((p) => {
    const c = definitions.get(p.code);
    return (
      c?.type_code === "minion" &&
      c.traits?.split(".").some((t) => t.trim() === "Hydra") &&
      !uniqueConflict(s, c)
    );
  });
}
export function resolveRedSkullModuleEffect(
  s: GameState,
  e: Effect,
  ports: RedSkullModulePorts,
): boolean {
  if (!e.type.startsWith("red-skull-modules:")) return false;
  switch (e.type) {
    case "red-skull-modules:attach":
      if (!s.attachments.some((p) => p.id === e.piece.id))
        ports.attach(s, e.piece, s.villain.id);
      break;
    case "red-skull-modules:remove-cost": {
      const p = s.attachments.find((p) => p.id === e.id);
      need(
        p && redSkullActions(s, p).length,
        "The Weapon Master Hero Action is no longer available.",
      );
      need(
        ports.canPay(s, 2, weaponCosts),
        "The required resource types cannot be paid.",
      );
      ports.pay(
        s,
        2,
        weaponCosts,
        [R("remove-paid", { id: p!.id })],
        definitions.get(p!.code)!.name,
        true,
      );
      break;
    }
    case "red-skull-modules:remove-paid":
      if (s.attachments.some((p) => p.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "red-skull-modules:discard-support": {
      const options = ports.supports(s).map((p) => ({
        id: p.id,
        label: definitions.get(p.code)!.name,
        image: p.code,
        effects: [R("discard-support-chosen", { id: p.id })],
      }));
      if (options.length)
        ports.choose(
          s,
          "Hydra Flame-Soldier",
          "Discard a support you control.",
          options,
        );
      break;
    }
    case "red-skull-modules:discard-support-chosen":
      need(
        ports.supports(s).some((p) => p.id === e.id),
        "Choose an actual support you control that can be discarded.",
      );
      ports.discardPiece(s, e.id);
      break;
    case "red-skull-modules:activate":
      ports.activateEffect(s, e);
      break;
    case "red-skull-modules:activation-finished":
      ports.queue(s, ...(e.after || []));
      break;
    case "red-skull-modules:weapon-surge":
      if (
        s.attachments.some(
          (p) =>
            p.attachedTo === s.villain.id &&
            definitions
              .get(p.code)
              ?.traits?.split(".")
              .some((t) => t.trim() === "Weapon"),
        )
      )
        ports.queue(
          s,
          E("surge", { sourceCode: "04150", sourceId: e.sourceId }),
        );
      break;
    case "red-skull-modules:patrol-search": {
      const players = (e.players as string[]).filter((id) =>
        s.players.some((seat) => seat.id === id && !seat.eliminated),
      );
      if (!players.length) {
        ports.shuffleEncounter(s);
        break;
      }
      const playerId = players[0];
      if (s.activePlayerId !== playerId) {
        ports.queue(s, { ...e, players, actorId: playerId });
        break;
      }
      ports.revealHidden(s);
      const after = R("patrol-search", {
        players: players.slice(1),
        origin: e.origin,
        actorId: e.origin,
      });
      const options = hydraCandidates(s).map((p) => ({
        id: p.id,
        label: definitions.get(p.code)!.name,
        image: p.code,
        effects: [
          R("patrol-found", { id: p.id, playerId, after, actorId: playerId }),
        ],
      }));
      if (options.length)
        ports.choose(
          s,
          "Hydra Patrol",
          `Choose a Hydra minion to engage ${playerId}.`,
          options,
        );
      else ports.queue(s, after);
      break;
    }
    case "red-skull-modules:patrol-found": {
      const p = hydraCandidates(s).find((p) => p.id === e.id);
      need(p, "This Hydra minion can no longer enter play.");
      need(
        s.players.some((seat) => seat.id === e.playerId && !seat.eliminated),
        "The engagement player is no longer in the mission.",
      );
      ports.queue(s, e.after);
      ports.putMinion(s, p!, e.playerId);
      break;
    }
    default:
      throw Error(`Unknown Red Skull modular effect: ${e.type}`);
  }
  return true;
}
