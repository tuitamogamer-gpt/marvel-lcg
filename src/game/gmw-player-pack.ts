import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
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
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("gmw-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (v: unknown, message: string) => {
  if (!v) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );
const text = (p: Piece) => cards.get(p.code)!;
const trait = (c: Card, name: string) =>
  (c.traits || "")
    .split(/\.\s*/)
    .some((t) => t.toLowerCase() === name.toLowerCase());

export const GMW_PLAYER_PACK_CORE_ALIASES = [
  "16015",
  "16018",
  "16021",
  "16022",
  "16023",
  "16041",
  "16044",
  "16049",
  "16050",
  "16051",
] as const;
export const GMW_PLAYER_PACK_SCRIPT_CODES = [
  "16012",
  "16013",
  "16014",
  "16016",
  "16017",
  "16019",
  "16020",
  "16024",
  "16040",
  "16042",
  "16043",
  "16045",
  "16046",
  "16047",
  "16048",
  "16052",
] as const;

export interface GmwPlayerPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface GmwPlayerPackDefenseSnapshot {
  heroDefended: boolean;
  heroDamage: number;
  playerId: string;
  /** Actual physical ally ID, retained after the attack completes. */
  defender?: string;
}
export interface GmwPlayerPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
  ): boolean;
  minionTargets(s: GameState): GmwPlayerPackTarget[];
  enemyTargets?(s: GameState, attack?: boolean): GmwPlayerPackTarget[];
  /** Printed identity HP; maximum HP and campaign damage do not change it. */
  startingHeroHP(s: GameState): number;
  allyMaxHP(s: GameState, p: Piece): number;
  /** Discard the actual top encounter card and recycle immediately on exhaustion. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  putMinion(s: GameState, p: Piece, playerId: string): void;
  /** Pay the actual top-card cost, with normal exhausted-player-deck handling. */
  discardPlayerTop(s: GameState): Piece | undefined;
  preventDamage(s: GameState, amount: number, packet?: Effect): void;
  /** Return the physical ally to its owner's hand, resetting its in-play state. */
  returnAllyToHand(s: GameState, id: string): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Root may impose additional absolute cannot-remove/ready restrictions. */
  canRemoveMainThreat?(s: GameState): boolean;
  canReady?(s: GameState, target: string): boolean;
  growthCounters(s: GameState, target: string): number;
  addGrowthCounters(s: GameState, target: string, amount: number): void;
  attackExcess?(s: GameState, packet: Effect): number;
}

function characters(s: GameState, name: string): GmwPlayerPackTarget[] {
  const result = allInPlay(s)
    .filter((p) => text(p)?.type_code === "ally" && text(p).name === name)
    .map((p) => ({ id: p.id, label: name, code: p.code }));
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (
      (name === "Groot" && view.heroId === "groot") ||
      (name === "Rocket Raccoon" && view.heroId === "rocket")
    )
      result.push({
        id: "hero:" + seat.id,
        label: name,
        code:
          name === "Groot"
            ? view.player.form === "hero"
              ? "16001a"
              : "16001b"
            : view.player.form === "hero"
              ? "16029a"
              : "16029b",
      });
  }
  return result;
}
function floraTargets(s: GameState, ports: GmwPlayerPackPorts) {
  if (
    !["groot", "rocket"].includes(s.heroId) ||
    !characters(s, "Groot").length ||
    !characters(s, "Rocket Raccoon").length
  )
    return [];
  const result = characters(s, "Groot").filter((t) => {
    const exhausted = t.id.startsWith("hero:")
      ? seatView(s, t.id.slice(5)).player.exhausted
      : !!allInPlay(s).find((p) => p.id === t.id)?.exhausted;
    return (
      ports.growthCounters(s, t.id) < 10 ||
      (exhausted && (ports.canReady?.(s, t.id) ?? true))
    );
  });
  for (const p of allInPlay(s))
    if (text(p)?.type_code === "upgrade" && text(p)?.set_code === "rocket") {
      const seat = controller(s, p.id);
      if (seat && seat.heroId === "rocket")
        result.push({ id: p.id, label: text(p).name, code: p.code });
    }
  return result;
}

export function gmwPlayerPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: GmwPlayerPackPorts,
): string | null {
  if (p.code === "16013")
    return "Available when your hero defends against an attack.";
  if (
    p.code === "16016" &&
    playerOrder(s).every((seat) =>
      seatView(s, seat).player.inPlay.some((other) => other.code === "16016"),
    )
  )
    return "Every player already controls Dauntless.";
  if (
    ["16024", "16052"].includes(p.code) &&
    s.player.inPlay.some((other) => other.code === p.code)
  )
    return "Max 1 per player.";
  if (
    ["16019", "16047", "16052"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Guardian")
  )
    return "Your identity must have the Guardian trait.";
  if (["16020", "16048"].includes(p.code) && !floraTargets(s, ports).length)
    return "Flora and Fauna requires Groot and Rocket Raccoon in play and an eligible target.";
  if (p.code === "16042" && !s.player.stunned && !ports.minionTargets(s).length)
    return "Into the Fray requires an eligible minion.";
  if (
    p.code === "16014" &&
    !s.player.stunned &&
    ports.enemyTargets &&
    !ports.enemyTargets(s, true).some((target) => target.id === s.villain.id)
  )
    return "Fighting Fit requires an eligible villain target.";
  return null;
}

export function gmwPlayerPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "16013":
      return [];
    case "16014":
      return [P("fighting-fit")];
    case "16020":
    case "16048":
      return [P("flora")];
    case "16042":
      return [
        E("target", {
          group: "minion",
          title: "Into the Fray",
          action: E("damage", {
            amount: 6,
            source: "hero",
            attack: true,
            attackInitiated: true,
            excessToMain: true,
          }),
        }),
      ];
    // This effect is an additional cost, and must precede the host's event
    // status replacement. The event cost hook below owns the actual search.
    case "16043":
      return [
        E("thwart", {
          target: "main",
          amount: 3,
          source: "hero",
          action: true,
        }),
      ];
    default:
      return null;
  }
}
/** Additional costs occur before checking Confused or newly engaged Patrol. */
export function gmwPlayerPackBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  return p.code === "16043" ? [P("looking-cost", { after })] : after;
}

export function gmwPlayerPackAbilityOptions(
  s: GameState,
  id: string,
  _ports: GmwPlayerPackPorts,
): Option[] {
  const p = own(s, id, "16024");
  return p && !p.exhausted && s.player.form === "hero"
    ? [
        O(
          "deft-focus",
          "Exhaust · reduce the next Superpower card's cost by 1 this turn",
          [P("deft", { id })],
          p.code,
        ),
      ]
    : [];
}
export function gmwPlayerPackAbility(
  s: GameState,
  id: string,
  ports: GmwPlayerPackPorts,
  action?: string,
): boolean {
  if (!own(s, id, "16024")) return false;
  need(!action || action === "deft-focus", "Unknown Deft Focus ability.");
  need(
    gmwPlayerPackAbilityOptions(s, id, ports).length,
    "Deft Focus is unavailable.",
  );
  ports.queue(s, P("deft", { id }));
  return true;
}
export function gmwPlayerPackCardCostReduction(s: GameState, c: Card): number {
  return trait(c, "Superpower") ? Number(s.flags.gmwDeftFocus || 0) : 0;
}
/** The next Superpower played consumes the discount even when it costs zero. */
export function gmwPlayerPackCardPlayed(s: GameState, c: Card): void {
  if (trait(c, "Superpower")) delete s.flags.gmwDeftFocus;
}
/** Call for every controller at the end of ANY player's turn. */
export function gmwPlayerPackTurnEnded(s: GameState): void {
  for (const seat of playerOrder(s))
    delete seatView(s, seat).flags.gmwDeftFocus;
}
export function gmwPlayerPackCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "16046" && !isTextBlank(s, p)) p.counters = 3;
  return p.code === "16016" ? [P("control", { id: p.id })] : [];
}
export function gmwPlayerPackAllyEnter(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return ["16012", "16019", "16040", "16047"].includes(p.code) ? [] : null;
}
export function gmwPlayerPackRetaliate(
  s: GameState,
  ports: GmwPlayerPackPorts,
): number {
  return s.player.form === "hero" && s.player.hp >= ports.startingHeroHP(s)
    ? s.player.inPlay.filter((p) => p.code === "16016" && !isTextBlank(s, p))
        .length
    : 0;
}
export function gmwPlayerPackAllyAttackModifier(
  s: GameState,
  p: Piece,
  target: string,
): { amount: number; overkill: boolean } {
  const minion = s.minions.find((m) => m.id === target);
  return p.code === "16019" &&
    !p.stunned &&
    !isTextBlank(s, p) &&
    !!controller(s, p.id) &&
    !!minion
    ? { amount: 3, overkill: true }
    : { amount: 0, overkill: false };
}
export function gmwPlayerPackAllyAttackOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
  after: Effect[],
  _ports: GmwPlayerPackPorts,
): Option[] {
  return !packet.gmwRocketAllyHandled &&
    gmwPlayerPackAllyAttackModifier(s, p, packet.target).amount
    ? [
        O(
          p.id,
          "Rocket Raccoon · +3 ATK and overkill against this minion",
          [P("rocket-ally", { id: p.id, packet, after })],
          p.code,
        ),
      ]
    : [];
}
export function gmwPlayerPackAfterBasicAttack(s: GameState): Effect[] {
  return s.player.form === "hero"
    ? s.player.inPlay
        .filter((p) => p.code === "16040" && p.damage > 0 && !isTextBlank(s, p))
        .map((p) =>
          E("optional", {
            title: "Bug",
            text: "Heal 1 damage from Bug?",
            effects: [P("bug", { id: p.id })],
          }),
        )
    : [];
}
export function gmwPlayerPackAfterDefense(
  s: GameState,
  snapshot: GmwPlayerPackDefenseSnapshot,
  ports: GmwPlayerPackPorts,
): Effect[] {
  const effects: Effect[] = [];
  if (s.flags.gmwDesperateDefense) {
    if (
      snapshot.heroDefended &&
      snapshot.heroDamage === 0 &&
      snapshot.playerId === s.activePlayerId
    )
      effects.push(E("ready", { target: "hero" }));
    delete s.flags.gmwDesperateDefense;
  }
  if (
    snapshot.heroDefended &&
    snapshot.heroDamage === 0 &&
    snapshot.playerId === s.activePlayerId &&
    s.player.form === "hero" &&
    s.scheme.threat > 0 &&
    (ports.canRemoveMainThreat?.(s) ?? true)
  )
    for (const p of s.player.inPlay.filter(
      (p) => p.code === "16017" && !p.exhausted && !isTextBlank(s, p),
    ))
      effects.push(
        E("optional", {
          title: "Hard to Ignore",
          text: "Exhaust Hard to Ignore to remove 1 threat from the main scheme?",
          effects: [P("hard", { id: p.id })],
        }),
      );
  const groot =
    snapshot.defender &&
    allInPlay(s).find(
      (p) =>
        p.id === snapshot.defender && p.code === "16047" && !isTextBlank(s, p),
    );
  if (groot && groot.damage > 0)
    effects.push(
      E("optional", {
        actorId: controller(s, groot.id)!.id,
        title: "Groot",
        text: "Heal 2 damage from Groot after he defends?",
        effects: [P("groot-heal", { id: groot.id })],
      }),
    );
  return effects;
}
export function gmwPlayerPackDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: GmwPlayerPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.attack?.defender !== "hero" ||
    (s.attack.targetPlayerId && s.attack.targetPlayerId !== s.activePlayerId)
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "16013" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Desperate Defense · +2 DEF, then ready if this attack deals no damage",
        [P("defense-pay", { id: p.id, after })],
        p.code,
      ),
    );
}
export function gmwPlayerPackDamageOptions(
  s: GameState,
  packet: Effect,
  amount: number,
  after: Effect[],
  _ports: GmwPlayerPackPorts,
): Option[] {
  const attack =
    packet.attack || packet.kind === "attack" || packet.kind === "overkill";
  if (
    !attack ||
    amount <= 0 ||
    s.player.form !== "hero" ||
    s.player.tough ||
    !["hero", "hero:" + s.activePlayerId].includes(packet.target || "hero") ||
    !s.player.deck.length
  )
    return [];
  return s.player.inPlay
    .filter((p) => p.code === "16052" && !p.exhausted && !isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        "Booster Boots · discard the top card of your deck, prevent 1 damage",
        [P("boots", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
/** Offer only after the host determines the actual unprevented damage packet. */
export function gmwPlayerPackStarhawkDamageOptions(
  s: GameState,
  p: Piece,
  amount: number,
  after: Effect[],
  ports: GmwPlayerPackPorts,
): Option[] {
  return p.code === "16012" &&
    !p.tough &&
    !isTextBlank(s, p) &&
    !!controller(s, p.id) &&
    amount > 0 &&
    amount === ports.allyMaxHP(s, p) - p.damage
    ? [
        O(
          p.id,
          "Starhawk · return him to his owner's hand",
          [P("starhawk", { id: p.id, amount, after })],
          p.code,
        ),
      ]
    : [];
}
export function gmwPlayerPackBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  _ports: GmwPlayerPackPorts,
): Option[] {
  if (s.player.form !== "hero" || s.player.stunned || !packet.basic) return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "16046" &&
        p.counters > 0 &&
        !p.exhausted &&
        !isTextBlank(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Hand Cannon · +2 ATK and overkill",
        [P("cannon", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
export function gmwPlayerPackExcessOptions(
  s: GameState,
  packet: Effect,
  excess: number,
  after: Effect[],
  _ports: GmwPlayerPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    excess <= 0 ||
    !packet.attack ||
    !["hero", "hero:" + s.activePlayerId].includes(packet.source || "hero")
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "16045" &&
        !isTextBlank(s, p) &&
        !(packet.gmwExcessUsed || []).includes(p.id),
    )
    .map((p) =>
      O(
        p.id,
        "Follow Through · increase excess damage by 1",
        [P("excess", { id: p.id, packet, excess, after })],
        p.code,
      ),
    );
}

export function resolveGmwPlayerPackEffect(
  s: GameState,
  e: Effect,
  ports: GmwPlayerPackPorts,
): boolean {
  if (!e.type.startsWith("gmw-pack:")) return false;
  switch (e.type) {
    case "gmw-pack:fighting-fit":
      ports.queue(
        s,
        E("damage", {
          target: s.villain.id,
          amount: s.player.hp >= ports.startingHeroHP(s) ? 5 : 2,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
      );
      break;
    case "gmw-pack:flora": {
      const targets = floraTargets(s, ports);
      if (targets.length)
        ports.choose(
          s,
          "Flora and Fauna",
          "Choose Groot or a Rocket Raccoon upgrade.",
          targets.map((t) =>
            O(
              t.id,
              t.label +
                (t.code &&
                text({ code: t.code } as Piece)?.type_code === "upgrade"
                  ? " · add 2 charges and ready"
                  : " · add 2 growth and ready"),
              [P("flora-target", { target: t.id })],
              t.code,
            ),
          ),
        );
      break;
    }
    case "gmw-pack:flora-target": {
      need(
        floraTargets(s, ports).some((t) => t.id === e.target),
        "Flora and Fauna requires an eligible physical target.",
      );
      const p = allInPlay(s).find((p) => p.id === e.target);
      if (p && text(p).type_code === "upgrade") p.counters += 2;
      else ports.addGrowthCounters(s, e.target, 2);
      ports.queue(s, E("ready", { target: e.target }));
      break;
    }
    case "gmw-pack:looking-cost": {
      // Entry interrupts (including Quickstrike) go ahead of the ability's
      // status/legality continuation; an additional cost has not initiated
      // the printed thwart yet.
      ports.queue(s, ...(e.after || []));
      for (;;) {
        const result = ports.discardEncounterTop(s);
        if (result.piece && text(result.piece).type_code === "minion") {
          ports.putMinion(s, result.piece, s.activePlayerId);
          break;
        }
        if (!result.piece || result.emptied) break;
      }
      break;
    }
    case "gmw-pack:deft": {
      const p = own(s, e.id, "16024");
      need(
        p && !p.exhausted && s.player.form === "hero",
        "Deft Focus is unavailable.",
      );
      p!.exhausted = true;
      s.flags.gmwDeftFocus = Number(s.flags.gmwDeftFocus || 0) + 1;
      break;
    }
    case "gmw-pack:control": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "16016");
      if (!p) break;
      const seats = playerOrder(s).filter(
        (seat) =>
          !seatView(s, seat).player.inPlay.some(
            (other) => other.id !== p.id && other.code === p.code,
          ),
      );
      if (seats.length === 1) ports.transferControl(s, p.id, seats[0].id);
      else if (seats.length)
        ports.choose(
          s,
          "Dauntless",
          "Choose a player without Dauntless.",
          seats.map((seat) =>
            O(
              seat.id,
              seat.heroId,
              [P("controlled", { id: p.id, playerId: seat.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "gmw-pack:controlled": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "16016");
      need(
        p &&
          !seatView(s, e.playerId).player.inPlay.some(
            (other) => other.id !== p.id && other.code === p.code,
          ),
        "That player already controls Dauntless.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "gmw-pack:bug": {
      const p = own(s, e.id, "16040");
      if (p) ports.queue(s, E("heal", { target: p.id, amount: 1 }));
      break;
    }
    case "gmw-pack:rocket-ally": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      need(
        p &&
          gmwPlayerPackAllyAttackModifier(s, p, e.packet.target).amount &&
          !e.packet.gmwRocketAllyHandled,
        "Rocket Raccoon's minion attack interrupt is unavailable.",
      );
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 3,
          overkill: true,
          gmwRocketAllyHandled: true,
        },
        ...(e.after || []),
      );
      break;
    }
    case "gmw-pack:groot-heal": {
      const p = allInPlay(s).find(
        (p) => p.id === e.id && p.code === "16047" && !isTextBlank(s, p),
      );
      if (p) ports.queue(s, E("heal", { target: p.id, amount: 2 }));
      break;
    }
    case "gmw-pack:hard": {
      const p = own(s, e.id, "16017");
      need(
        p &&
          !p.exhausted &&
          s.player.form === "hero" &&
          s.scheme.threat > 0 &&
          (ports.canRemoveMainThreat?.(s) ?? true),
        "Hard to Ignore is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("thwart", {
          target: "main",
          amount: 1,
          source: p!.id,
          ignorePatrol: true,
        }),
      );
      break;
    }
    case "gmw-pack:defense-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "16013");
      need(
        p &&
          gmwPlayerPackDefenseOptions(s, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Desperate Defense is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Desperate Defense",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            P("event-paid", {
              id: p!.id,
              effects: [P("defense")],
              continuation: e.after || [],
            }),
          ],
        }),
      );
      break;
    }
    case "gmw-pack:event-paid":
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: e.id,
          after: e.effects || [],
          continuation: e.continuation || [],
        }),
      );
      break;
    case "gmw-pack:defense":
      need(s.attack?.defender === "hero", "Your hero is no longer defending.");
      s.attack!.defenseBonus = Number(s.attack!.defenseBonus || 0) + 2;
      s.flags.gmwDesperateDefense = true;
      break;
    case "gmw-pack:boots": {
      const p = own(s, e.id, "16052");
      need(
        p &&
          gmwPlayerPackDamageOptions(
            s,
            e.packet,
            e.amount,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Booster Boots is unavailable.",
      );
      p!.exhausted = true;
      need(
        ports.discardPlayerTop(s),
        "Booster Boots requires an actual top card to discard.",
      );
      ports.preventDamage(s, 1, e.packet);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "gmw-pack:starhawk": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      need(
        p &&
          gmwPlayerPackStarhawkDamageOptions(
            s,
            p,
            e.amount,
            e.after || [],
            ports,
          ).length,
        "Starhawk must take exactly his remaining hit points in damage.",
      );
      ports.returnAllyToHand(s, p!.id);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "gmw-pack:cannon": {
      const p = own(s, e.id, "16046");
      need(
        p &&
          gmwPlayerPackBasicAttackOptions(
            s,
            e.packet,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Hand Cannon is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      const packet = {
        ...e.packet,
        amount: Number(e.packet.amount || 0) + 2,
        gmwBasicBonus: Number(e.packet.gmwBasicBonus || 0) + 2,
        overkill: true,
      };
      if (!p!.counters) ports.discardPiece(s, p!.id);
      ports.queue(s, packet, ...(e.after || []));
      break;
    }
    case "gmw-pack:excess": {
      const p = own(s, e.id, "16045"),
        excess = ports.attackExcess?.(s, e.packet) ?? e.excess;
      need(
        p &&
          gmwPlayerPackExcessOptions(
            s,
            e.packet,
            excess,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Follow Through requires positive excess damage from your hero's attack.",
      );
      ports.queue(
        s,
        {
          ...e.packet,
          excessBonus: Number(e.packet.excessBonus || 0) + 1,
          gmwExcessUsed: [...(e.packet.gmwExcessUsed || []), p!.id],
        },
        ...(e.after || []),
      );
      break;
    }
    default:
      throw Error("Unknown GMW player-pack effect: " + e.type);
  }
  return true;
}
