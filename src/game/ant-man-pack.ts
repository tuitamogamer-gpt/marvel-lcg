import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller } from "./team.js";
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
const pack = (type: string, args: Record<string, unknown> = {}) =>
  E("ant-pack:" + type, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const piece = (s: GameState, id: string) =>
  allInPlay(s).find((p) => p.id === id);
const printedTraits = (c?: Card) =>
  (c?.traits || "").split(/\.\s*/).filter(Boolean);
const attached = (s: GameState, id: string, code?: string) =>
  allInPlay(s).filter((p) => p.attachedTo === id && (!code || p.code === code));

export const ANT_MAN_PACK_CORE_ALIASES = [
  "12019",
  "12021",
  "12022",
  "12023",
] as const;
export const ANT_MAN_PACK_SCRIPT_CODES = [
  "12011",
  "12012",
  "12013",
  "12014",
  "12015",
  "12016",
  "12017",
  "12018",
  "12024",
  "12030",
  "12031",
  "12032",
  "12033",
] as const;

export interface AntManPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface AntManPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  attach(s: GameState, upgradeId: string, targetId: string): void;
  /** Discard at most the current deck's size, then run the normal exhaustion rule. */
  mill(s: GameState, n: number): Piece[];
  maxAllyHP(s: GameState, p: Piece): number;
  maxHeroHP(s: GameState): number;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  friendlyTargets(s: GameState): AntManPackTarget[];
  schemeTargets(s: GameState): AntManPackTarget[];
  canGiveStatus(s: GameState, target: string, status: "tough"): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId: string,
    targetCode: string,
  ): boolean;
  /** Validate every native play restriction and payment, with an immediate discount. */
  playableWithDiscount(s: GameState, p: Piece, discount: number): boolean;
  /** Native play/payment lifecycle. Discount is bound to this physical card only.
   * The ability's exhaust cost has been paid: payment must not be cancelable. */
  playFromHand(s: GameState, id: string, discount: number): void;
}

/** Entry interrupt, before ally-limit enforcement or the zero-HP defeat check.
 * A put-into-play effect passes zero; overpayment is actual resources generated
 * minus the final reduced resource cost, not the card's printed zero cost. */
export function antManPackAllyPlayed(s: GameState, p: Piece, overpaid = 0) {
  if (p.code === "12011")
    p.counters = Math.min(4, Math.max(0, Math.floor(overpaid)));
}
export function antManPackAllyHP(s: GameState, p: Piece) {
  return (
    (p.code === "12011" && !isTextBlank(s, p) ? p.counters : 0) +
    attached(s, p.id, "12018").filter((upgrade) => !isTextBlank(s, upgrade))
      .length *
      2
  );
}
export function antManPackModifiers(
  s: GameState,
  target: string,
  ports?: Pick<AntManPackPorts, "maxAllyHP">,
) {
  const p = piece(s, target);
  const ronin =
    p?.code === "12013" &&
    !isTextBlank(s, p) &&
    attached(s, target).some((a) => cards.get(a.code)?.type_code === "upgrade");
  const hp =
    p &&
    (ports
      ? ports.maxAllyHP(s, p)
      : (cards.get(p.code)?.health || 0) + antManPackAllyHP(s, p));
  return {
    attack:
      Number(ronin) +
      (p?.code === "12012" && !isTextBlank(s, p) && hp! - p.damage >= 3
        ? 2
        : 0),
    thwart: Number(ronin),
  };
}
export function antManPackAllyExcluded(s: GameState, p: Piece) {
  return p.code === "12014" && !isTextBlank(s, p);
}
export function antManPackStats(s: GameState) {
  const amount = Number(s.flags.antPackMoxie || 0);
  return { attack: amount, thwart: amount, defense: amount };
}
export function antManPackHandSize(s: GameState) {
  return Number(s.flags.antPackAssess || 0);
}
/** Call after every player's end-of-phase refill, so Assess affects that refill. */
export function antManPackPhaseEnded(s: GameState) {
  delete s.flags.antPackAssess;
}
export function antManPackRoundEnded(s: GameState) {
  delete s.flags.antPackMoxie;
}

export function antManPackAttachmentTargets(
  s: GameState,
  code: string,
  ports: Pick<AntManPackPorts, "hasTrait">,
) {
  return allInPlay(s).filter(
    (p) =>
      cards.get(p.code)?.type_code === "ally" &&
      (code !== "12017" || ports.hasTrait(s, p.id, "Avenger")) &&
      !attached(s, p.id, code).length,
  );
}
function toughTargets(
  s: GameState,
  ports: Pick<AntManPackPorts, "friendlyTargets" | "canGiveStatus">,
) {
  return ports
    .friendlyTargets(s)
    .filter((target) => ports.canGiveStatus(s, target.id, "tough"));
}
export function antManPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: AntManPackPorts,
): string | null {
  if (["12016", "12031"].includes(p.code))
    return "Available after you change to a hero form.";
  if (p.code === "12030")
    return "Available after your hero attacks and defeats an enemy.";
  if (
    ["12014", "12032"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Avenger")
  )
    return "Your identity must have the Avenger trait.";
  if (
    ["12017", "12018"].includes(p.code) &&
    !antManPackAttachmentTargets(s, p.code, ports).length
  )
    return "There is no eligible ally attachment target.";
  if (p.code === "12032" && !toughTargets(s, ports).length)
    return "No friendly character can receive a tough status card.";
  if (p.code === "12015" && !s.player.deck.length)
    return "Call for Aid requires cards in your deck.";
  return null;
}
export function antManPackAllyEnter(s: GameState, p: Piece): Effect[] | null {
  return ["12011", "12012", "12013", "12014"].includes(p.code) ? [] : null;
}
export function antManPackCardEntered(s: GameState, p: Piece): Effect[] {
  // "Attach to" is resolved as the card enters play, before in-play text
  // blanking starts to suppress its continuous effects and responses.
  return ["12017", "12018"].includes(p.code) && !p.attachedTo
    ? [pack("attach", { id: p.id })]
    : [];
}
export function antManPackEvent(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "12015":
      return [pack("aid")];
    case "12016":
      return [pack("moxie")];
    case "12030":
      return [];
    case "12031":
      return [
        E("target", {
          group: "scheme",
          title: "Lay Down the Law",
          action: E("thwart", {
            amount: paid.includes("mental") ? 4 : 3,
            action: true,
            source: "hero",
          }),
        }),
      ];
    case "12032":
      return [pack("muster", { selected: [] })];
    case "12033":
      return [pack("assess")];
    default:
      return null;
  }
}
function teamCards(s: GameState, ports: AntManPackPorts) {
  return s.player.hand.filter(
    (p) =>
      printedTraits(cards.get(p.code)).some((trait) =>
        ports.hasTrait(s, "hero", trait),
      ) && ports.playableWithDiscount(s, p, 1),
  );
}
export function antManPackAbilityOptions(
  s: GameState,
  id: string,
  ports: AntManPackPorts,
): Option[] {
  const p = s.player.inPlay.find(
    (p) =>
      p.id === id && p.code === "12024" && !p.exhausted && !isTextBlank(s, p),
  );
  return p && s.player.form === "hero" && teamCards(s, ports).length
    ? [
        option(
          "team-building",
          "Team-Building Exercise · play a matching card for 1 less",
          [pack("team-building", { id })],
          p.code,
        ),
      ]
    : [];
}
export function antManPackAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: AntManPackPorts,
): Effect[] | null {
  const options = antManPackAbilityOptions(s, id, ports);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function antManPackAfterAllyBasic(s: GameState, p: Piece): Effect[] {
  return attached(s, p.id, "12017")
    .filter((gloves) => !isTextBlank(s, gloves))
    .map((gloves) =>
      E("optional", {
        actorId: controller(s, gloves.id)?.id || s.activePlayerId,
        title: "Power Gloves",
        text: "Deal 1 damage to an enemy after the attached ally attacks or thwarts?",
        effects: [
          E("target", {
            group: "enemy",
            title: "Power Gloves",
            action: E("damage", { amount: 1, source: gloves.id }),
          }),
        ],
      }),
    );
}
/** Queue in the identity's response window after the new form is established. */
export function antManPackFormChanged(s: GameState): Effect[] {
  return s.player.form === "hero" ? [pack("form-responses", { used: [] })] : [];
}
/** Only the identity's own attack, after all damage/defeat effects. Excess must
 * reflect actual damage past the defeated enemy's remaining HP. */
export function antManPackAfterAttackDefeat(
  s: GameState,
  excessDamage: number,
): Effect[] {
  return s.player.form === "hero" && excessDamage > 0
    ? [pack("triumph-responses", { excessDamage, used: [] })]
    : [];
}
function responseCards(
  s: GameState,
  codes: string[],
  used: string[],
  ports: AntManPackPorts,
) {
  return s.player.form === "hero"
    ? s.player.hand.filter(
        (p) =>
          codes.includes(p.code) &&
          (p.code !== "12031" ||
            s.player.confused ||
            ports.schemeTargets(s).length > 0) &&
          !used.includes(p.id) &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
      )
    : [];
}

/** One shared window can mix these paid hand responses with identity/upgrade
 * responses. The host may supply a continuation on the first effect to resume
 * that shared window after this one event has finished resolving. */
export function antManPackFormResponseOptions(
  s: GameState,
  ports: AntManPackPorts,
): Option[] {
  return responseCards(s, ["12016", "12031"], [], ports).map((p) =>
    option(
      p.id,
      cards.get(p.code)!.name,
      [pack("form-pay", { id: p.id, used: [] })],
      p.code,
    ),
  );
}

export function resolveAntManPackEffect(
  s: GameState,
  e: Effect,
  ports: AntManPackPorts,
): boolean {
  if (!e.type.startsWith("ant-pack:")) return false;
  switch (e.type) {
    case "ant-pack:aid": {
      const index = s.player.deck.findIndex(
        (p) =>
          cards.get(p.code)?.type_code === "ally" &&
          printedTraits(cards.get(p.code)).includes("Avenger"),
      );
      const discarded = ports.mill(
        s,
        index >= 0 ? index + 1 : s.player.deck.length,
      );
      const ally = index >= 0 ? discarded[index] : undefined;
      if (ally) {
        // Exhausting a player deck immediately shuffles its discard. The found
        // physical card is still the card referred to by this resolving effect.
        for (const zone of [s.player.discard, s.player.deck]) {
          const at = zone.findIndex((p) => p.id === ally.id);
          if (at >= 0) {
            zone.splice(at, 1);
            s.player.hand.push(ally);
            break;
          }
        }
      }
      break;
    }
    case "ant-pack:moxie":
      s.flags.antPackMoxie = Number(s.flags.antPackMoxie || 0) + 1;
      break;
    case "ant-pack:assess":
      s.flags.antPackAssess = Number(s.flags.antPackAssess || 0) + 1;
      break;
    case "ant-pack:attach": {
      const p = piece(s, e.id);
      need(
        p && ["12017", "12018"].includes(p.code),
        "The attachment is no longer in play.",
      );
      ports.choose(
        s,
        cards.get(p!.code)!.name,
        "Choose an eligible ally. Maximum one copy per ally.",
        antManPackAttachmentTargets(s, p!.code, ports).map((target) =>
          option(
            target.id,
            cards.get(target.code)!.name,
            [pack("attach-to", { id: p!.id, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "ant-pack:attach-to": {
      const p = piece(s, e.id);
      need(
        p &&
          antManPackAttachmentTargets(s, p.code, ports).some(
            (target) => target.id === e.target,
          ),
        "That ally is no longer an eligible attachment target.",
      );
      ports.attach(s, p!.id, e.target);
      break;
    }
    case "ant-pack:team-building": {
      need(
        antManPackAbilityOptions(s, e.id, ports).length,
        "Team-Building Exercise needs a ready support and an eligible card.",
      );
      ports.choose(
        s,
        "Team-Building Exercise",
        "Choose a card sharing a trait with your hero. Pay its reduced cost immediately.",
        teamCards(s, ports).map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [pack("team-play", { id: e.id, cardId: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "ant-pack:team-play": {
      const support = s.player.inPlay.find(
        (p) =>
          p.id === e.id &&
          p.code === "12024" &&
          !p.exhausted &&
          !isTextBlank(s, p),
      );
      need(
        support &&
          s.player.form === "hero" &&
          teamCards(s, ports).some((p) => p.id === e.cardId),
        "Team-Building Exercise cannot play that card now.",
      );
      support!.exhausted = true;
      ports.playFromHand(s, e.cardId, 1);
      break;
    }
    case "ant-pack:form-responses": {
      const used = (e.used || []) as string[];
      const events = responseCards(s, ["12016", "12031"], used, ports);
      if (!events.length) break;
      ports.choose(
        s,
        "After changing form",
        "Choose a response, or continue.",
        [
          ...events.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [pack("form-pay", { id: p.id, used })],
              p.code,
            ),
          ),
          option("pass", "Continue", []),
        ],
      );
      break;
    }
    case "ant-pack:form-pay": {
      const used = (e.used || []) as string[];
      const p = responseCards(s, ["12016", "12031"], used, ports).find(
        (p) => p.id === e.id,
      );
      need(p, "That form-change response cannot be played now.");
      ports.queue(
        s,
        E("payRequest", {
          title: cards.get(p!.code)!.name,
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            pack("form-paid", {
              id: p!.id,
              used,
              continuation: e.continuation,
            }),
          ],
        }),
      );
      break;
    }
    case "ant-pack:form-paid": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && ["12016", "12031"].includes(p.code),
        "The response card is no longer in hand.",
      );
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: p!.id,
          after: antManPackEvent(s, p!, e.paid || []),
          continuation: e.continuation || [
            pack("form-responses", { used: [...(e.used || []), p!.id] }),
          ],
        }),
      );
      break;
    }
    case "ant-pack:triumph-responses": {
      const used = (e.used || []) as string[];
      const events =
        e.excessDamage > 0 && s.player.hp < ports.maxHeroHP(s)
          ? responseCards(s, ["12030"], used, ports)
          : [];
      if (!events.length) break;
      ports.choose(
        s,
        "Moment of Triumph",
        "Heal " +
          e.excessDamage +
          " damage for the excess damage from that attack?",
        [
          ...events.map((p) =>
            option(
              p.id,
              "Moment of Triumph · heal " + e.excessDamage,
              [
                pack("triumph-pay", {
                  id: p.id,
                  excessDamage: e.excessDamage,
                  used,
                }),
              ],
              p.code,
            ),
          ),
          option("pass", "Continue", []),
        ],
      );
      break;
    }
    case "ant-pack:triumph-pay": {
      const p = responseCards(s, ["12030"], e.used || [], ports).find(
        (p) => p.id === e.id,
      );
      need(
        p && e.excessDamage > 0 && s.player.hp < ports.maxHeroHP(s),
        "Moment of Triumph cannot heal your hero now.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Moment of Triumph",
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [E("heal", { target: "hero", amount: e.excessDamage })],
              continuation: [
                pack("triumph-responses", {
                  excessDamage: e.excessDamage,
                  used: [...(e.used || []), p!.id],
                }),
              ],
            }),
          ],
        }),
      );
      break;
    }
    case "ant-pack:muster": {
      const selected = (e.selected || []) as string[];
      const max = Math.min(3, Math.max(0, s.villain.stage));
      const targets = toughTargets(s, ports).filter(
        (target) => !selected.includes(target.id),
      );
      if (selected.length >= max || !targets.length) {
        ports.queue(
          s,
          ...selected.map((target) => E("status", { target, status: "tough" })),
        );
        break;
      }
      ports.choose(
        s,
        "Muster Courage",
        "Choose up to " +
          max +
          " distinct friendly characters (" +
          selected.length +
          " selected).",
        [
          ...targets.map((target) =>
            option(
              target.id,
              target.label,
              [pack("muster", { selected: [...selected, target.id] })],
              target.code,
            ),
          ),
          option(
            "finish",
            "Give tough to selected characters",
            selected.map((target) => E("status", { target, status: "tough" })),
          ),
        ],
      );
      break;
    }
    default:
      throw Error("Unknown Ant-Man pack effect: " + e.type);
  }
  return true;
}
