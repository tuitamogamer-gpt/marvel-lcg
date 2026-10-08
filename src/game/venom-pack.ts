import { eventPlaySources } from "./card-text.js";
import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("venom-pack:" + type, args);
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
const trait = (c: Card | undefined, name: string) =>
  (c?.traits || "").split(/\.\s*/).includes(name);
const phaseKey = (s: GameState) => s.round + ":" + s.phase;

export const VENOM_PACK_CORE_ALIASES = [
  "20014",
  "20017",
  "20018",
  "20019",
] as const;
export const VENOM_PACK_SCRIPT_CODES = [
  "20011",
  "20012",
  "20013",
  "20015",
  "20016",
  "20020",
  "20021",
  "20022",
  "20026",
  "20027",
  "20028",
  "20029",
] as const;
export interface VenomPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface VenomPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  enemyTargets(s: GameState, attack?: boolean): VenomPackTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  transferControl(s: GameState, id: string, playerId: string): void;
  maxHeroHP(s: GameState, playerId: string): number;
  canGiveTough(s: GameState, target: string): boolean;
}
function controlSeats(s: GameState, code: string, id?: string) {
  return playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) => p.id !== id && p.code === code,
      ),
  );
}
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const weapons = (s: GameState) =>
  s.player.inPlay.filter(
    (p) =>
      cards.get(p.code)?.type_code === "upgrade" &&
      trait(cards.get(p.code), "Weapon") &&
      !p.exhausted,
  );
function confusedEnemies(s: GameState, ports: VenomPackPorts) {
  return ports.enemyTargets(s, true).filter((t) => enemy(s, t.id)?.confused);
}

/** Additional restricted slots are specifically for Weapon upgrades. */
export function venomPackRestrictedWeaponAllowance(s: GameState) {
  return s.player.inPlay.filter((p) => p.code === "20021" && !isTextBlank(s, p))
    .length;
}
export function venomPackAllyKeywords(s: GameState, p: Piece) {
  return { ranged: p.code === "20016" && !isTextBlank(s, p) };
}
export function venomPackCardCostReduction(s: GameState, c: Card) {
  return c.type_code === "ally"
    ? playerOrder(s).filter(
        (seat) => seatView(s, seat).flags.venomPackWelcomePhase === phaseKey(s),
      ).length * 2
    : 0;
}
/** Actual card plays only; putting an ally into play does not spend this reduction. */
export function venomPackCardPlayed(s: GameState, c: Card) {
  if (c.type_code === "ally")
    for (const seat of playerOrder(s))
      delete seatView(s, seat).flags.venomPackWelcomePhase;
}
export function venomPackPhaseEnded(s: GameState) {
  for (const seat of playerOrder(s))
    delete seatView(s, seat).flags.venomPackWelcomePhase;
}
export function venomPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: VenomPackPorts,
): string | null {
  if (["20013", "20028"].includes(p.code))
    return "Available automatically during its interrupt or response window.";
  if (["20021", "20029"].includes(p.code) && !controlSeats(s, p.code).length)
    return cards.get(p.code)!.name + " is limited to 1 per player.";
  if (
    p.code === "20012" &&
    !s.player.stunned &&
    !confusedEnemies(s, ports).length
  )
    return "Scare Tactic requires a confused enemy that can be attacked.";
  if (p.code === "20026" && !weapons(s).length)
    return "Fusillade requires a ready Weapon upgrade you control.";
  if (p.code === "20027") {
    if (!ports.hasTrait(s, "hero", "Guardian"))
      return "Your identity must have the Guardian trait.";
    if (
      playerOrder(s).some(
        (seat) => seatView(s, seat).flags.venomPackWelcomeRound === s.round,
      )
    )
      return '"Welcome Aboard" is limited to 1 per round.';
  }
  return null;
}
export function venomPackAllyEnter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "20016")
    return [
      E("dealEncounter", {
        playerId: controller(s, p.id)?.id || s.activePlayerId,
        mandatory: true,
      }),
    ];
  return p.code === "20011" ? [] : null;
}
export function venomPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "20015") p.counters = 2;
  if (p.code === "20022") p.counters = 3;
  return ["20021", "20029"].includes(p.code)
    ? [P("control", { id: p.id })]
    : [];
}
export function venomPackBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  return p.code === "20026" ? [P("fusillade-cost", { after })] : after;
}
export function venomPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "20012":
      return [P("scare")];
    case "20013":
    case "20028":
      return [];
    case "20026":
      return [
        E("target", {
          group: "enemy",
          title: "Fusillade",
          action: E("damage", {
            amount: 5,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        }),
      ];
    case "20027":
      return [P("welcome")];
    default:
      return null;
  }
}
function damagedAlterEgos(s: GameState, ports: VenomPackPorts) {
  return playerOrder(s).filter(
    (seat) =>
      seatView(s, seat).player.form === "alter" &&
      seatView(s, seat).player.hp < ports.maxHeroHP(s, seat.id),
  );
}
export function venomPackAbilityOptions(
  s: GameState,
  id: string,
  ports: VenomPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted) return [];
  if (p.code === "20029")
    return s.player.form === "alter" && damagedAlterEgos(s, ports).length
      ? [
          O(
            "heal-alter-ego",
            "Crew Quarters · heal 1 damage from an alter-ego",
            [P("quarters", { id })],
            p.code,
          ),
        ]
      : [];
  if (s.player.form !== "hero") return [];
  if (p.code === "20011" && p.counters > 0 && ports.enemyTargets(s).length)
    return [
      O(
        "ammo",
        "Spend 1 ammo counter · deal 2 damage",
        [P("jack", { id })],
        p.code,
      ),
    ];
  if (
    ["20015", "20022"].includes(p.code) &&
    p.counters > 0 &&
    ports.enemyTargets(s).length
  )
    return [
      O(
        p.code === "20015" ? "sonic" : "plasma",
        p.code === "20015"
          ? "Sonic Rifle · confuse an enemy or deal 3 damage if confused"
          : "Plasma Pistol · deal 1 damage",
        [P("weapon", { id })],
        p.code,
      ),
    ];
  return [];
}
export function venomPackAbility(
  s: GameState,
  id: string,
  ports: VenomPackPorts,
  action?: string,
): boolean {
  const choice = venomPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!choice) return false;
  ports.queue(s, ...choice.effects);
  return true;
}
export function venomPackResourceSources(s: GameState): PaymentSource[] {
  return s.player.inPlay
    .filter((p) => p.code === "20020" && !isTextBlank(s, p))
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Resourceful",
      resources: ["wild"],
      kind: "ability",
      description: "Discard Resourceful · generate 1 wild resource",
    }));
}
export function venomPackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<VenomPackPorts, "discardPiece">,
) {
  const p = own(s, id, "20020");
  if (!p) return false;
  ports.discardPiece(s, p.id);
  return true;
}
export function venomPackAfterAllyThwart(s: GameState, p: Piece): Effect[] {
  return p.code === "20011" && !isTextBlank(s, p)
    ? [
        E("optional", {
          actorId: controller(s, p.id)?.id,
          title: "Jack Flag",
          text: "Place 1 ammo counter on Jack Flag?",
          effects: [P("jack-ammo", { id: p.id })],
        }),
      ]
    : [];
}
export function venomPackBasicThwartOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: VenomPackPorts,
): Option[] {
  if (s.player.form !== "hero" || s.player.confused || !packet.basic) return [];
  const used: string[] = packet.venomPackEntrances || [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "20013" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Making an Entrance · +2 THW and a conditional heal",
        [P("entrance-pay", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
/** Once after the entire basic thwart. removedAllThreat is an actual native
 * outcome from at least one scheme, including a defeated side scheme. */
export function venomPackBasicThwartEnded(
  _s: GameState,
  packet: Effect,
  removedAllThreat: boolean,
): Effect[] {
  return removedAllThreat && packet.venomPackEntrances?.length
    ? packet.venomPackEntrances.map(() =>
        E("heal", { target: "hero", amount: 2 }),
      )
    : [];
}
export interface VenomPackAttackDamageSnapshot {
  target: string;
  actualDamage: number;
  attack: boolean;
}
/** Optional Hero Response after damage taken, not after prevention or consequential damage. */
export function venomPackAfterAttackDamageOptions(
  s: GameState,
  snapshot: VenomPackAttackDamageSnapshot,
  after: Effect[],
  ports: VenomPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !snapshot.attack ||
    snapshot.actualDamage <= 0 ||
    !ports.hasTrait(s, snapshot.target, "Guardian") ||
    !ports.canGiveTough(s, snapshot.target)
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "20028" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Shake it Off · give this damaged Guardian a tough status",
        [P("shake-pay", { id: p.id, snapshot, after })],
        p.code,
      ),
    );
}
function pay(
  s: GameState,
  p: Piece,
  effects: Effect[],
  continuation: Effect[],
  ports: VenomPackPorts,
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
export function resolveVenomPackEffect(
  s: GameState,
  e: Effect,
  ports: VenomPackPorts,
): boolean {
  if (!e.type.startsWith("venom-pack:")) return false;
  switch (e.type) {
    case "venom-pack:control": {
      const p = own(s, e.id);
      if (!p) break;
      const seats = controlSeats(s, p.code, p.id);
      need(seats.length, "No player can control another copy of this card.");
      if (seats.length === 1) ports.transferControl(s, p.id, seats[0].id);
      else
        ports.choose(
          s,
          cards.get(p.code)!.name,
          "Choose a player to control this card.",
          seats.map((seat) =>
            O(seat.id, seat.heroId, [
              P("control-to", { id: p.id, playerId: seat.id }),
            ]),
          ),
        );
      break;
    }
    case "venom-pack:control-to": {
      const p = own(s, e.id);
      need(
        p &&
          controlSeats(s, p.code, p.id).some((seat) => seat.id === e.playerId),
        "That player already controls this card.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "venom-pack:scare": {
      const targets = confusedEnemies(s, ports);
      if (targets.length)
        ports.choose(
          s,
          "Scare Tactic",
          "Choose a confused enemy to attack.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                E("damage", {
                  target: t.id,
                  amount: 3,
                  source: "hero",
                  attack: true,
                  attackInitiated: true,
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "venom-pack:fusillade-cost": {
      const eligible = weapons(s);
      need(
        eligible.length,
        "Fusillade must exhaust a ready Weapon upgrade you control.",
      );
      ports.choose(
        s,
        "Fusillade",
        "Exhaust a Weapon upgrade as an additional cost.",
        eligible.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [P("fusillade-exhaust", { id: p.id, after: e.after || [] })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "venom-pack:fusillade-exhaust": {
      const p = weapons(s).find((p) => p.id === e.id);
      need(p, "Fusillade's Weapon cost is unavailable.");
      p!.exhausted = true;
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "venom-pack:welcome":
      need(
        !playerOrder(s).some(
          (seat) => seatView(s, seat).flags.venomPackWelcomeRound === s.round,
        ),
        '"Welcome Aboard" is limited to 1 per round.',
      );
      s.flags.venomPackWelcomeRound = s.round;
      s.flags.venomPackWelcomePhase = phaseKey(s);
      break;
    case "venom-pack:quarters": {
      const p = own(s, e.id, "20029");
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Crew Quarters requires alter-ego form.",
      );
      const targets = damagedAlterEgos(s, ports);
      need(targets.length, "There is no damaged alter-ego to heal.");
      p!.exhausted = true;
      ports.choose(
        s,
        "Crew Quarters",
        "Choose an alter-ego to heal 1 damage.",
        targets.map((seat) =>
          O(seat.id, seat.heroId, [
            E("heal", { target: "hero:" + seat.id, amount: 1 }),
          ]),
        ),
      );
      break;
    }
    case "venom-pack:jack-ammo": {
      const p = own(s, e.id, "20011");
      if (p) p.counters++;
      break;
    }
    case "venom-pack:jack": {
      const p = own(s, e.id, "20011");
      need(
        p && !p.exhausted && p.counters > 0 && s.player.form === "hero",
        "Jack Flag requires a ready ally and an ammo counter.",
      );
      p!.exhausted = true;
      p!.counters--;
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Jack Flag",
          action: E("damage", { amount: 2, source: p!.id }),
        }),
      );
      break;
    }
    case "venom-pack:weapon": {
      const p = own(s, e.id);
      need(
        p &&
          ["20015", "20022"].includes(p.code) &&
          !p.exhausted &&
          p.counters > 0 &&
          s.player.form === "hero",
        "This charged weapon is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      const code = p!.code;
      if (!p!.counters) ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: cards.get(code)!.name,
          action: P("weapon-target", { code }),
        }),
      );
      break;
    }
    case "venom-pack:weapon-target": {
      const target = enemy(s, e.target);
      if (!target) break;
      if (e.code === "20015" && !target.confused)
        ports.queue(s, E("status", { target: target.id, status: "confused" }));
      else
        ports.queue(
          s,
          E("damage", {
            target: target.id,
            amount: e.code === "20015" ? 3 : 1,
            source: "hero",
          }),
        );
      break;
    }
    case "venom-pack:entrance-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "20013",
      );
      need(
        p &&
          venomPackBasicThwartOptions(s, e.packet, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Making an Entrance requires a basic thwart.",
      );
      pay(
        s,
        p!,
        [],
        [
          P("resume-entrance", {
            id: p!.id,
            packet: e.packet,
            after: e.after || [],
          }),
        ],
        ports,
      );
      break;
    }
    case "venom-pack:resume-entrance":
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 2,
          venomPackEntrances: [...(e.packet.venomPackEntrances || []), e.id],
          gmwBasicBonus: Number(e.packet.gmwBasicBonus || 0) + 2,
        },
        ...(e.after || []),
      );
      break;
    case "venom-pack:shake-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "20028",
      );
      need(
        p &&
          venomPackAfterAttackDamageOptions(
            s,
            e.snapshot,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Shake it Off requires a Guardian that took attack damage.",
      );
      pay(
        s,
        p!,
        [E("status", { target: e.snapshot.target, status: "tough" })],
        e.after || [],
        ports,
      );
      break;
    }
    default:
      throw Error("Unknown Venom player-pack effect: " + e.type);
  }
  return true;
}
