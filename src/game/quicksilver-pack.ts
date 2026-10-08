import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { defenseEventSources, isTextBlank } from "./card-text.js";
import type { PaymentSource } from "./payment.js";
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
  E("quicksilver-pack:" + type, args);
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
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );
const traits = (c?: Card) => (c?.traits || "").split(/\.\s*/).filter(Boolean);
const orderAndChaosCodes = ["14018", "15018"];

export const QUICKSILVER_PACK_CORE_ALIASES = [
  "14016",
  "14019",
  "14020",
  "14021",
] as const;
export const QUICKSILVER_PACK_SCRIPT_CODES = [
  "14012",
  "14013",
  "14014",
  "14015",
  "14017",
  "14018",
  "14022",
  "14023",
  "14029",
  "14030",
  "14031",
  "14032",
] as const;

export interface QuicksilverPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface QuicksilverPackDamageWindow {
  target: string;
  amount: number;
  playerId?: string;
  attack?: boolean;
  packet?: Effect;
  /** The enemy that actually caused this damage, never a default villain. */
  source?: string;
}
export interface QuicksilverPackDefenseSnapshot {
  heroDefended: boolean;
  heroDamage: number;
  attacker: string;
  attackerCode?: string;
  attackerStage?: number;
  isVillain: boolean;
  playerId: string;
  neverBackDownCount?: number;
}
export interface QuicksilverPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  friendlyTargets(s: GameState): QuicksilverPackTarget[];
  maxHeroHP(s: GameState, playerId: string): number;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
  ): boolean;
  shufflePlayerDeck(s: GameState): void;
  revealHidden(s: GameState): void;
  /** The caller has removed the actual physical copy from hand/deck. The host
   * must use normal entry responses and ally-limit enforcement, not hand play. */
  putAllyIntoPlay(s: GameState, p: Piece, beforeResponses?: Effect[]): void;
  damageDistribution(
    s: GameState,
    packets: { target: string; amount: number }[],
    options: { source: string },
  ): void;
  preventDamage(s: GameState, amount: number, packet?: Effect): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Cancel text only; the continuation still enters/resolves the physical
   * treachery normally, including its independent Incite and Surge keywords. */
  cancelWhenRevealed(s: GameState, p: Piece, after: Effect[]): void;
}

export function quicksilverPackResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  const target = cards.get(targetCode || "");
  if (target?.type_code !== "event") return [];
  return s.player.inPlay
    .filter(
      (p) =>
        !p.exhausted &&
        !isTextBlank(s, p) &&
        ((p.code === "14017" && traits(target).includes("Defense")) ||
          (p.code === "14030" && traits(target).includes("Thwart"))),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: cards.get(p.code)!.name,
      resources: [p.code === "14017" ? "energy" : "mental"],
      kind: "ability",
      description:
        "Exhaust · generate 1 " +
        (p.code === "14017"
          ? "energy for a Defense event"
          : "mental for a Thwart event"),
    }));
}

export function quicksilverPackHeroStatBonus(
  s: GameState,
  stat: "attack" | "thwart" | "defense",
) {
  if (s.player.form !== "hero") return 0;
  if (stat === "attack")
    return (
      Number(s.flags.qsvPackAdrenaline || 0) +
      s.player.inPlay.filter((p) => p.code === "14029" && !isTextBlank(s, p))
        .length
    );
  return stat === "thwart" ? Number(s.flags.qsvPackCivic || 0) : 0;
}
export function quicksilverPackBasicPiercing(s: GameState) {
  return (
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "14029" && !isTextBlank(s, p))
  );
}
/** A stun replacement is not a basic attack and must not call this hook. */
export function quicksilverPackAfterBasicAttack(s: GameState): Effect[] {
  return s.player.inPlay
    .filter((p) => p.code === "14029" && !isTextBlank(s, p))
    .map((p) => E("discardPiece", { id: p.id }));
}
export function quicksilverPackPhaseEnded(s: GameState) {
  delete s.flags.qsvPackAdrenaline;
  delete s.flags.qsvPackCivic;
}

function controlSeats(s: GameState, p: Piece) {
  return playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (other) => other.id !== p.id && other.code === p.code,
      ),
  );
}
export function quicksilverPackCardEntered(s: GameState, p: Piece): Effect[] {
  return ["14017", "14030"].includes(p.code)
    ? [pack("control", { id: p.id })]
    : [];
}
function teamUp(s: GameState) {
  if (!["qsv", "quicksilver", "scw", "scarlet_witch"].includes(s.heroId))
    return false;
  const names = new Set(
    allInPlay(s)
      .filter((p) => cards.get(p.code)?.type_code === "ally")
      .map((p) => cards.get(p.code)!.name),
  );
  for (const seat of playerOrder(s))
    if (seatView(s, seat).player.form === "hero") {
      if (["qsv", "quicksilver"].includes(seat.heroId))
        names.add("Quicksilver");
      if (["scw", "scarlet_witch"].includes(seat.heroId))
        names.add("Scarlet Witch");
    }
  return names.has("Quicksilver") && names.has("Scarlet Witch");
}
function damagedFriendly(s: GameState, ports: QuicksilverPackPorts) {
  return ports.friendlyTargets(s).filter((target) => {
    if (target.id === "hero" || target.id.startsWith("hero:")) {
      const seat = s.players.find(
        (p) =>
          p.id ===
          (target.id === "hero" ? s.activePlayerId : target.id.slice(5)),
      );
      if (!seat || seat.eliminated) return false;
      const view = seatView(s, seat);
      return view.player.hp < ports.maxHeroHP(s, seat.id);
    }
    return !!allInPlay(s).find((p) => p.id === target.id && p.damage > 0);
  });
}

export function quicksilverPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: QuicksilverPackPorts,
): string | null {
  if (["14014", "14015", ...orderAndChaosCodes].includes(p.code))
    return "Available automatically during its interrupt window.";
  if (["14017", "14030"].includes(p.code) && !controlSeats(s, p).length)
    return cards.get(p.code)!.name + " is limited to 1 per player.";
  if (p.code === "14031") {
    if (!ports.hasTrait(s, "hero", "Avenger"))
      return "Your identity must have the Avenger trait.";
    if (!damagedFriendly(s, ports).length)
      return "United We Stand requires a damaged friendly character.";
  }
  return null;
}
export function quicksilverPackAllyEnter(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "14013") return [];
  if (p.code !== "14012") return null;
  if (isTextBlank(s, p)) return [];
  return [
    E("optional", {
      actorId: controller(s, p.id)?.id || s.activePlayerId,
      title: "Multiple Man",
      text: "Search your deck and hand for another Multiple Man and put that copy into play?",
      effects: [pack("multiple-search", { id: p.id })],
    }),
  ];
}
export function quicksilverPackEvent(
  s: GameState,
  p: Piece,
  _paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "14014":
      return [pack("never-bonus")];
    case "14015":
    case "14018":
    case "15018":
      return [];
    case "14031":
      return [
        pack("united", {
          selected: [],
          limit: Math.min(3, Math.max(0, s.villain.stage)),
        }),
      ];
    case "14032":
      return [pack("beat")];
    default:
      return null;
  }
}
export function quicksilverPackAbilityOptions(
  s: GameState,
  id: string,
  ports: QuicksilverPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p) return [];
  if (
    p.code === "14013" &&
    p.damage > 0 &&
    ports.canPay(s, 1, undefined, p.code, ["mental"])
  )
    return [
      option(
        "heal",
        "Spend 1 mental resource · heal up to 2 damage from Warlock",
        [pack("warlock", { id: p.id })],
        p.code,
      ),
    ];
  if (s.player.form === "hero" && ["14022", "14023"].includes(p.code))
    return [
      option(
        "use",
        "Discard " +
          cards.get(p.code)!.name +
          " · +1 " +
          (p.code === "14022" ? "ATK" : "THW") +
          " this phase",
        [pack("phase-bonus", { id: p.id })],
        p.code,
      ),
    ];
  return [];
}
export function quicksilverPackAbility(
  s: GameState,
  id: string,
  ports: QuicksilverPackPorts,
  action?: string,
): boolean {
  const p = own(s, id);
  if (!p || !["14013", "14022", "14023"].includes(p.code)) return false;
  if (action && action !== (p.code === "14013" ? "heal" : "use")) return false;
  const choice = quicksilverPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  need(choice, "That card's action is unavailable.");
  ports.queue(s, ...choice!.effects);
  return true;
}
export function quicksilverPackDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: QuicksilverPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !s.attack ||
    s.attack.defender !== "hero" ||
    (s.attack.targetPlayerId && s.attack.targetPlayerId !== s.activePlayerId)
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "14014" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Never Back Down · +2 DEF and stun if this attack deals no damage",
        [pack("never-pay", { id: p.id, after })],
        p.code,
      ),
    );
}
export function quicksilverPackAfterDefense(
  s: GameState,
  snapshot: QuicksilverPackDefenseSnapshot,
): Effect[] {
  const used = Number(snapshot.neverBackDownCount || 0);
  const attacker = snapshot.isVillain
    ? s.villain
    : s.minions.find((p) => p.id === snapshot.attacker);
  const same =
    attacker &&
    attacker.id === snapshot.attacker &&
    (!snapshot.attackerCode ||
      (snapshot.isVillain
        ? cards.get(attacker.code)?.name ===
          cards.get(snapshot.attackerCode)?.name
        : attacker.code === snapshot.attackerCode));
  return used &&
    snapshot.heroDefended &&
    snapshot.heroDamage === 0 &&
    snapshot.playerId === s.activePlayerId &&
    same
    ? Array.from({ length: used }, () =>
        E("status", { target: attacker!.id, status: "stunned" }),
      )
    : [];
}
export function quicksilverPackDamageOptions(
  s: GameState,
  window: QuicksilverPackDamageWindow,
  after: Effect[],
  ports: QuicksilverPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.player.tough ||
    window.amount <= 0 ||
    !["hero", `hero:${s.activePlayerId}`].includes(window.target) ||
    (window.playerId && window.playerId !== s.activePlayerId)
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "14015" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Side Step · prevent 3 damage",
        [pack("side-pay", { id: p.id, window, after })],
        p.code,
      ),
    );
}
export function quicksilverPackEncounterOptions(
  s: GameState,
  p: Piece,
  fromDeck: boolean,
  after: Effect[],
  ports: QuicksilverPackPorts,
): Option[] {
  const text = (cards.get(p.code)?.text || "")
    .split(/<hr\b/i)[0]
    .replace(/<[^>]*>/g, "");
  if (
    !fromDeck ||
    cards.get(p.code)?.type_code !== "treachery" ||
    !/\bWhen Revealed(?:\s*\([^)]*\))?\s*:/i.test(text) ||
    s.player.form !== "hero" ||
    !teamUp(s)
  )
    return [];
  return s.player.hand
    .filter(
      (event) =>
        orderAndChaosCodes.includes(event.code) &&
        ports.canPay(s, ports.cardCost(s, event), event.id, event.code),
    )
    .map((event) =>
      option(
        event.id,
        "Order and Chaos · cancel When Revealed and deal 2 damage to the villain",
        [pack("order-pay", { id: event.id, piece: p, fromDeck, after })],
        event.code,
      ),
    );
}
function eventPayment(
  s: GameState,
  p: Piece,
  effects: Effect[],
  after: Effect[],
  ports: QuicksilverPackPorts,
) {
  ports.queue(
    s,
    E("payRequest", {
      title: cards.get(p.code)!.name,
      cost: ports.cardCost(s, p),
      piece: p,
      cancelable: false,
      after: [pack("event-paid", { id: p.id, effects, continuation: after })],
    }),
  );
}

export function resolveQuicksilverPackEffect(
  s: GameState,
  e: Effect,
  ports: QuicksilverPackPorts,
): boolean {
  if (!e.type.startsWith("quicksilver-pack:")) return false;
  switch (e.type) {
    case "quicksilver-pack:event-paid":
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: e.id,
          after: (e.effects || []).map((effect: Effect) => ({
            ...effect,
            paid: e.paid || [],
            paidForCard: e.paidForCard,
          })),
          continuation: e.continuation || [],
        }),
      );
      break;
    case "quicksilver-pack:control": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && ["14017", "14030"].includes(p.code),
      );
      need(p, "That resource upgrade is no longer in play.");
      const seats = controlSeats(s, p!);
      need(seats.length, "This upgrade is limited to 1 per player.");
      if (seats.length === 1) ports.transferControl(s, p!.id, seats[0].id);
      else
        ports.choose(
          s,
          cards.get(p!.code)!.name,
          "Choose which player controls this upgrade (max 1 per player).",
          seats.map((seat) =>
            option(
              seat.id,
              seat.heroId,
              [pack("controlled", { id: p!.id, playerId: seat.id })],
              p!.code,
            ),
          ),
        );
      break;
    }
    case "quicksilver-pack:controlled": {
      const p = allInPlay(s).find(
        (p) => p.id === e.id && ["14017", "14030"].includes(p.code),
      );
      need(
        p && controlSeats(s, p).some((seat) => seat.id === e.playerId),
        "That player already controls a copy of this upgrade.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "quicksilver-pack:multiple-search":
      ports.choose(
        s,
        "Multiple Man",
        "Choose which locations to search. Shuffle your deck only if you search it.",
        [
          option(
            "hand",
            "Search your hand only",
            [pack("multiple-find", { id: e.id, searchDeck: false })],
            "14012",
          ),
          option(
            "deck",
            "Search your deck and hand",
            [pack("multiple-find", { id: e.id, searchDeck: true })],
            "14012",
          ),
          option("decline", "Search neither location", []),
        ],
      );
      break;
    case "quicksilver-pack:multiple-find": {
      if (e.searchDeck) ports.revealHidden(s);
      const copies = [
        ...s.player.hand,
        ...(e.searchDeck ? s.player.deck : []),
      ].filter((p) => p.code === "14012");
      ports.choose(
        s,
        "Multiple Man",
        "Choose a physical copy to put into play, or end the search.",
        [
          ...copies.map((p) =>
            option(
              p.id,
              "Multiple Man · " +
                (s.player.hand.some((h) => h.id === p.id) ? "hand" : "deck"),
              [pack("multiple-put", { id: p.id, searchDeck: !!e.searchDeck })],
              p.code,
            ),
          ),
          option(
            "fail",
            "End search without finding a copy",
            e.searchDeck ? [pack("multiple-shuffle")] : [],
          ),
        ],
      );
      break;
    }
    case "quicksilver-pack:multiple-put": {
      const zone = s.player.hand.some((p) => p.id === e.id)
        ? s.player.hand
        : e.searchDeck
          ? s.player.deck
          : [];
      const index = zone.findIndex((p) => p.id === e.id && p.code === "14012");
      need(
        index >= 0,
        "That physical Multiple Man is no longer in a searched location.",
      );
      const p = zone.splice(index, 1)[0];
      // Complete the ability's printed shuffle before the new ally's after-
      // entry response opens. Each deck search independently shuffles once.
      ports.putAllyIntoPlay(
        s,
        p,
        e.searchDeck ? [pack("multiple-shuffle")] : [],
      );
      break;
    }
    case "quicksilver-pack:multiple-shuffle":
      ports.shufflePlayerDeck(s);
      break;
    case "quicksilver-pack:warlock": {
      const p = own(s, e.id, "14013");
      need(
        p && p.damage > 0 && ports.canPay(s, 1, undefined, p.code, ["mental"]),
        "Warlock requires damage and a mental resource.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Warlock",
          cost: 1,
          requirements: ["mental"],
          paymentTarget: p!.code,
          after: [E("heal", { target: p!.id, amount: 2 })],
        }),
      );
      break;
    }
    case "quicksilver-pack:phase-bonus": {
      const p = own(s, e.id);
      need(
        p && s.player.form === "hero" && ["14022", "14023"].includes(p.code),
        "That hero action is unavailable.",
      );
      const key = p!.code === "14022" ? "qsvPackAdrenaline" : "qsvPackCivic";
      ports.discardPiece(s, p!.id);
      s.flags[key] = Number(s.flags[key] || 0) + 1;
      break;
    }
    case "quicksilver-pack:never-pay": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "14014",
      );
      need(
        p &&
          quicksilverPackDefenseOptions(s, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Never Back Down requires your hero to defend this attack.",
      );
      eventPayment(
        s,
        p!,
        [pack("never-bonus")],
        e.continuation || e.after || [],
        ports,
      );
      break;
    }
    case "quicksilver-pack:never-bonus":
      need(
        s.attack && s.attack.defender === "hero",
        "Your hero is no longer using its basic defense.",
      );
      s.attack!.defenseBonus = Number(s.attack!.defenseBonus || 0) + 2;
      {
        const attack = s.attack as NonNullable<GameState["attack"]> & {
          neverBackDownCount?: number;
        };
        attack.neverBackDownCount = Number(attack.neverBackDownCount || 0) + 1;
      }
      break;
    case "quicksilver-pack:side-pay": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "14015",
      );
      need(
        p &&
          quicksilverPackDamageOptions(s, e.window, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Side Step requires positive damage to your hero.",
      );
      eventPayment(
        s,
        p!,
        [pack("side", { window: e.window })],
        e.continuation || e.after || [],
        ports,
      );
      break;
    }
    case "quicksilver-pack:side": {
      ports.preventDamage(s, 3, e.window.packet);
      const source = e.window.source || e.window.packet?.source;
      const enemy =
        source === s.villain.id
          ? s.villain
          : s.minions.find((p) => p.id === source);
      if ((e.paidForCard ?? e.paid ?? []).includes("energy") && enemy)
        ports.queue(
          s,
          E("damage", { target: enemy.id, amount: 1, source: "hero" }),
        );
      break;
    }
    case "quicksilver-pack:order-pay": {
      const p = s.player.hand.find(
        (p) => p.id === e.id && orderAndChaosCodes.includes(p.code),
      );
      need(
        p &&
          quicksilverPackEncounterOptions(
            s,
            e.piece,
            e.fromDeck,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Order and Chaos requires both teammates and an encounter-deck treachery.",
      );
      eventPayment(
        s,
        p!,
        [pack("order", { piece: e.piece, after: e.after || [] })],
        [],
        ports,
      );
      break;
    }
    case "quicksilver-pack:order":
      ports.cancelWhenRevealed(s, e.piece, [
        E("damage", { target: s.villain.id, amount: 2, source: "hero" }),
        ...(e.after || []),
      ]);
      break;
    case "quicksilver-pack:united": {
      const selected = (e.selected || []) as string[];
      const limit = Math.min(
        3,
        Math.max(0, Number(e.limit ?? s.villain.stage)),
      );
      const targets = damagedFriendly(s, ports).filter(
        (p) => !selected.includes(p.id),
      );
      if (selected.length >= limit || !targets.length) {
        ports.queue(s, pack("united-finish", { selected, limit }));
        break;
      }
      ports.choose(
        s,
        "United We Stand",
        "Choose up to " +
          limit +
          " different friendly characters to heal 1 damage (" +
          selected.length +
          " selected).",
        [
          ...targets.map((p) =>
            option(
              p.id,
              p.label,
              [pack("united", { selected: [...selected, p.id], limit })],
              p.code,
            ),
          ),
          option("finish", "Heal the selected characters", [
            pack("united-finish", { selected, limit }),
          ]),
        ],
      );
      break;
    }
    case "quicksilver-pack:united-finish": {
      const selected = (e.selected || []) as string[];
      const limit = Math.min(
        3,
        Math.max(0, Number(e.limit ?? s.villain.stage)),
      );
      need(
        new Set(selected).size === selected.length &&
          selected.length <= limit &&
          selected.every((id) =>
            damagedFriendly(s, ports).some((p) => p.id === id),
          ),
        "United We Stand requires distinct damaged friendly characters.",
      );
      ports.queue(
        s,
        ...selected.map((target) => E("heal", { target, amount: 1 })),
      );
      break;
    }
    case "quicksilver-pack:beat":
      ports.damageDistribution(
        s,
        [
          { target: s.villain.id, amount: 1 },
          ...s.minions
            .filter((p) => !p.engagedWith || p.engagedWith === s.activePlayerId)
            .map((p) => ({ target: p.id, amount: 1 })),
        ],
        { source: "hero" },
      );
      break;
    default:
      throw Error("Unknown Quicksilver pack effect: " + e.type);
  }
  return true;
}
