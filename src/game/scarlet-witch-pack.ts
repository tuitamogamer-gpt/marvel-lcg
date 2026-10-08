import { eventPlaySources } from "./card-text.js";
import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, engaged, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import { printedKeyword } from "./keywords.js";
import { scarletWitchCountBoosts } from "./scarlet-witch.js";
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
  E("scarlet-pack:" + type, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const lastStandKey = (id: string) => "scwPackLastStand:" + id;
const speedKey = (id: string) => "scwPackSpeed:" + id;

export const SCARLET_WITCH_PACK_CORE_ALIASES = [
  "15016",
  "15017",
  "15020",
  "15021",
  "15022",
] as const;
export const SCARLET_WITCH_PACK_SCRIPT_CODES = [
  "15010",
  "15011",
  "15012",
  "15013",
  "15014",
  "15015",
  "15018",
  "15019",
  "15028",
  "15029",
  "15030",
  "15031",
] as const;

export interface ScarletWitchPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface ScarletWitchPackThwartSnapshot {
  /** The actual physical scheme ID, or "main" for the main scheme. */
  scheme: string;
  beforeThreat: number;
  removed: number;
  playerId?: string;
  /** Captured at initiation; a forced aftermath flip does not erase the trigger. */
  wasHero?: boolean;
}
export interface ScarletWitchPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  enemyTargets(s: GameState, attack?: boolean): ScarletWitchPackTarget[];
  /** Ignoring Crisis does not ignore Patrol, threat locks, or an empty scheme. */
  schemeTargets(s: GameState, ignoreCrisis?: boolean): ScarletWitchPackTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
  ): boolean;
  heroREC(s: GameState): number;
  /** Discard a real top card and immediately recycle an exhausted encounter deck. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
}

export function scarletWitchPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: ScarletWitchPackPorts,
): string | null {
  if (["15015", "15018", "15029"].includes(p.code))
    return "Available automatically during its response or interrupt window.";
  if (p.code === "15019" && !ports.hasTrait(s, "hero", "Mystic"))
    return "Your identity must have the Mystic trait.";
  if (p.code === "15028" && !ports.hasTrait(s, "hero", "Avenger"))
    return "Your identity must have the Avenger trait.";
  if (p.code === "15012" && !s.player.confused) {
    if (!ports.schemeTargets(s, true).some((target) => target.id === "main"))
      return "Crisis Averted requires an eligible main scheme with threat.";
    if (
      !ports.schemeTargets(s).some((target) => target.id === "main") &&
      !ports.canPay(s, ports.cardCost(s, p), p.id, p.code, ["mental"])
    )
      return "Ignoring Crisis requires paying a mental resource.";
  }
  if (
    p.code === "15013" &&
    !s.player.confused &&
    !ports.schemeTargets(s).length
  )
    return "Multitasking requires an eligible scheme with threat.";
  if (
    ["15014", "15028"].includes(p.code) &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).some((target) => target.id === s.villain.id)
  )
    return "This attack requires an eligible villain target.";
  if (
    p.code === "15030" &&
    !s.player.confused &&
    engaged(s).some((p) => {
      const definition = cards.get(p.code);
      return definition && printedKeyword(definition, "Patrol") > 0;
    })
  )
    return "Patrol prevents thwarting the main scheme.";
  return null;
}

export function scarletWitchPackEvent(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "15012":
      return [
        E("thwart", {
          target: "main",
          amount: 6,
          action: true,
          source: "hero",
          thwartInitiated: true,
          thwartStatusChecked: true,
          ignoreCrisis: paid.includes("mental"),
        }),
      ];
    case "15013":
      return [
        pack("multitask", { eventId: p.id, mental: paid.includes("mental") }),
      ];
    case "15014":
      return [
        E("enemyScheme", { id: s.villain.id }),
        E("damage", {
          target: s.villain.id,
          amount: 4,
          attack: true,
          source: "hero",
          attackInitiated: true,
        }),
      ];
    case "15015":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Turn the Tide",
          action: E("damage", {
            amount: 3,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
        }),
      ];
    case "15018":
      return [];
    case "15019":
      return [E("draw", { amount: 2 }), pack("meditation-discard")];
    case "15028":
      return [
        E("damage", {
          target: s.villain.id,
          amount: 2 + Math.min(3, Math.max(0, s.villain.stage)),
          attack: true,
          source: "hero",
          attackInitiated: true,
        }),
      ];
    case "15029":
      return [];
    case "15030":
      return [
        E("enemyAttack", { id: s.villain.id }),
        E("thwart", {
          target: "main",
          amount: 4,
          action: true,
          source: "hero",
          thwartInitiated: true,
          thwartStatusChecked: true,
        }),
      ];
    case "15031":
      return [pack("recuperation")];
    default:
      return null;
  }
}

export function scarletWitchPackAbilityOptions(
  _s: GameState,
  _id: string,
  _ports: ScarletWitchPackPorts,
): Option[] {
  return [];
}
export function scarletWitchPackAbility(
  _s: GameState,
  _id: string,
  _ports: ScarletWitchPackPorts,
  _action?: string,
): boolean {
  return false;
}
export function scarletWitchPackAllyEnter(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return ["15010", "15011"].includes(p.code) ? [] : null;
}

/** Call after an actual ally thwart, including effect-driven thwarts. A confuse
 * replacement is not a thwart. Responses precede consequential damage. */
export function scarletWitchPackAfterAllyThwart(
  s: GameState,
  p: Piece,
): Effect[] {
  const seat = controller(s, p.id);
  if (!seat || !["15010", "15011"].includes(p.code) || isTextBlank(s, p))
    return [];
  const view = seatView(s, seat);
  if (
    p.code === "15010" &&
    (!p.exhausted || view.flags[speedKey(p.id)] === s.round)
  )
    return [];
  return [
    E("optional", {
      actorId: seat.id,
      title: cards.get(p.code)!.name,
      text:
        p.code === "15010"
          ? "Ready Speed? (Limit once per round.)"
          : "Discard the top encounter card and deal damage equal to its boost icons to an enemy?",
      effects: [
        pack(p.code === "15010" ? "speed-ready" : "wiccan-count", { id: p.id }),
      ],
    }),
  ];
}

function tideQualifies(s: GameState, snapshot: ScarletWitchPackThwartSnapshot) {
  return (
    snapshot.wasHero !== false &&
    (!snapshot.playerId || snapshot.playerId === s.activePlayerId) &&
    snapshot.beforeThreat > 0 &&
    snapshot.removed === snapshot.beforeThreat
  );
}
export function scarletWitchPackAfterHeroThwart(
  s: GameState,
  snapshot: ScarletWitchPackThwartSnapshot,
  after: Effect[],
  ports: ScarletWitchPackPorts,
): Option[] {
  if (!tideQualifies(s, snapshot)) return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "15015" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Turn the Tide · deal 3 damage to an enemy",
        [pack("tide-pay", { id: p.id, snapshot, continuation: after })],
        p.code,
      ),
    );
}

/** The host has initiated an actual ally attack and checked its stun status.
 * Each reaction finishes physically before the next interrupt can be chosen. */
export function scarletWitchPackAllyAttackOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: ScarletWitchPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !own(s, p.id) ||
    cards.get(p.code)?.type_code !== "ally" ||
    p.stunned
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (event) =>
        event.code === "15029" &&
        ports.canPay(s, ports.cardCost(s, event), event.id, event.code),
    )
    .map((event) =>
      option(
        event.id,
        "Last Stand · +3 ATK, then discard " + cards.get(p.code)!.name,
        [pack("last-pay", { id: event.id, allyId: p.id, continuation: after })],
        event.code,
      ),
    );
}
export function scarletWitchPackAllyAttackBonus(
  s: GameState,
  p: Piece | string,
): number {
  return Number(s.flags[lastStandKey(typeof p === "string" ? p : p.id)] || 0);
}
/** Call only after the actual attack and all its aftermath, including Retaliate
 * and consequential damage. Removing a replaced attack just clears its bonus. */
export function scarletWitchPackAfterAllyAttack(
  s: GameState,
  p: Piece | string,
  actualAttack = true,
): Effect[] {
  const id = typeof p === "string" ? p : p.id;
  return scarletWitchPackAllyAttackBonus(s, id)
    ? [pack("last-finish", { id, actualAttack })]
    : [];
}

function eventPayment(
  s: GameState,
  p: Piece,
  effects: Effect[],
  continuation: Effect[],
  ports: ScarletWitchPackPorts,
) {
  ports.queue(
    s,
    E("payRequest", {
      title: cards.get(p.code)!.name,
      cost: ports.cardCost(s, p),
      piece: p,
      cancelable: false,
      after: [pack("event-paid", { id: p.id, effects, continuation })],
    }),
  );
}
function selectTarget(
  s: GameState,
  title: string,
  targets: ScarletWitchPackTarget[],
  action: Effect,
  ports: ScarletWitchPackPorts,
) {
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
}

export function resolveScarletWitchPackEffect(
  s: GameState,
  e: Effect,
  ports: ScarletWitchPackPorts,
): boolean {
  if (!e.type.startsWith("scarlet-pack:")) return false;
  switch (e.type) {
    case "scarlet-pack:event-paid":
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: e.id,
          after: (e.effects || []).map((effect: Effect) => ({
            ...effect,
            paid: e.paid || [],
          })),
          continuation: e.continuation || [],
        }),
      );
      break;
    case "scarlet-pack:speed-ready": {
      const p = own(s, e.id, "15010");
      need(
        p &&
          p.exhausted &&
          !isTextBlank(s, p) &&
          s.flags[speedKey(p.id)] !== s.round,
        "Speed's once-per-round response is unavailable.",
      );
      s.flags[speedKey(p!.id)] = s.round;
      ports.queue(s, E("ready", { target: p!.id }));
      break;
    }
    case "scarlet-pack:wiccan-count": {
      const p = own(s, e.id, "15011");
      need(
        p && !isTextBlank(s, p),
        "Wiccan is no longer available for this response.",
      );
      const discarded = ports.discardEncounterTop(s).piece;
      ports.queue(
        s,
        ...scarletWitchCountBoosts(
          s,
          discarded ? [discarded] : [],
          [pack("wiccan-damage", { id: p!.id })],
          { sourceTitle: "Wiccan" },
        ),
      );
      break;
    }
    case "scarlet-pack:wiccan-damage":
      if (Number(e.boostTotal || 0) > 0)
        selectTarget(
          s,
          "Wiccan",
          ports.enemyTargets(s, false),
          E("damage", { amount: Number(e.boostTotal), source: e.id }),
          ports,
        );
      break;
    case "scarlet-pack:multitask":
      selectTarget(
        s,
        "Multitasking",
        ports.schemeTargets(s),
        pack("multitask-first", { eventId: e.eventId, mental: !!e.mental }),
        ports,
      );
      break;
    case "scarlet-pack:multitask-first":
      need(
        ports.schemeTargets(s).some((t) => t.id === e.target),
        "Multitasking requires an eligible first scheme.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 2,
          action: true,
          source: "hero",
          thwartInitiated: true,
          thwartStatusChecked: true,
        }),
        ...(e.mental
          ? [
              pack("multitask-second", {
                firstTarget: e.target,
                eventId: e.eventId,
              }),
            ]
          : []),
      );
      break;
    case "scarlet-pack:multitask-second":
      selectTarget(
        s,
        "Multitasking · different scheme",
        ports.schemeTargets(s).filter((target) => target.id !== e.firstTarget),
        E("thwart", {
          amount: 2,
          action: true,
          source: "hero",
          thwartInitiated: true,
          thwartStatusChecked: true,
        }),
        ports,
      );
      break;
    case "scarlet-pack:meditation-discard":
      if (s.player.hand.length)
        ports.choose(
          s,
          "Spiritual Meditation",
          "Choose 1 card from your hand to discard.",
          s.player.hand.map((p) =>
            option(
              p.id,
              cards.get(p.code)?.name || p.code,
              [pack("meditation-discarded", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    case "scarlet-pack:meditation-discarded": {
      need(
        s.player.hand.some((p) => p.id === e.id),
        "Choose a physical card still in your hand.",
      );
      ports.queue(s, E("discardHand", { id: e.id }));
      break;
    }
    case "scarlet-pack:recuperation":
      ports.queue(
        s,
        E("heal", { target: "hero", amount: Math.max(0, ports.heroREC(s)) }),
      );
      break;
    case "scarlet-pack:tide-window": {
      const options = scarletWitchPackAfterHeroThwart(
        s,
        e.snapshot,
        e.continuation || [],
        ports,
      );
      if (options.length)
        ports.choose(
          s,
          "After your hero clears a scheme",
          "Use Turn the Tide, or continue.",
          [...options, option("pass", "Continue", e.continuation || [])],
        );
      else ports.queue(s, ...(e.continuation || []));
      break;
    }
    case "scarlet-pack:tide-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "15015",
      );
      need(
        p &&
          tideQualifies(s, e.snapshot) &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        "Turn the Tide is unavailable for this thwart.",
      );
      eventPayment(
        s,
        p!,
        scarletWitchPackEvent(s, p!)!,
        [
          pack("tide-window", {
            snapshot: e.snapshot,
            continuation: e.continuation || [],
          }),
        ],
        ports,
      );
      break;
    }
    case "scarlet-pack:last-window": {
      const p = own(s, e.id);
      const options = p
        ? scarletWitchPackAllyAttackOptions(s, p, e.continuation || [], ports)
        : [];
      if (options.length)
        ports.choose(
          s,
          "Ally attack",
          "Use Last Stand, or continue the attack.",
          [...options, option("pass", "Continue", e.continuation || [])],
        );
      else ports.queue(s, ...(e.continuation || []));
      break;
    }
    case "scarlet-pack:last-pay": {
      const p = eventPlaySources(s).find(
          (p) => p.id === e.id && p.code === "15029",
        ),
        ally = own(s, e.allyId);
      need(
        p &&
          ally &&
          scarletWitchPackAllyAttackOptions(s, ally, [], ports).some(
            (o) => o.id === p.id,
          ),
        "Last Stand requires an actual attack by an ally you control.",
      );
      eventPayment(
        s,
        p!,
        [pack("last-bonus", { id: ally!.id })],
        [
          pack("last-window", {
            id: ally!.id,
            continuation: e.continuation || [],
          }),
        ],
        ports,
      );
      break;
    }
    case "scarlet-pack:last-bonus": {
      const p = own(s, e.id);
      need(
        p && cards.get(p.code)?.type_code === "ally",
        "Last Stand's ally has left play.",
      );
      s.flags[lastStandKey(p!.id)] = scarletWitchPackAllyAttackBonus(s, p!) + 3;
      break;
    }
    case "scarlet-pack:last-finish": {
      const applied = scarletWitchPackAllyAttackBonus(s, e.id);
      delete s.flags[lastStandKey(e.id)];
      if (
        applied &&
        e.actualAttack !== false &&
        allInPlay(s).some((p) => p.id === e.id)
      )
        ports.discardPiece(s, e.id);
      break;
    }
    default:
      throw Error("Unknown Scarlet Witch pack effect: " + e.type);
  }
  return true;
}
