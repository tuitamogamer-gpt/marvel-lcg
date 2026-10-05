import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { uniqueConflict } from "./unique.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";
import type { PaymentSource } from "./payment.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const heroProfiles = new Map<
  string,
  { code: string; alter: string; name: string; identity: string }
>();
for (const c of cards.values()) {
  if (c.type_code !== "hero" || !c.set_code || heroProfiles.has(c.set_code))
    continue;
  const alter = [...cards.values()].find(
    (face) => face.set_code === c.set_code && face.type_code === "alter_ego",
  );
  if (alter)
    heroProfiles.set(c.set_code, {
      code: c.code,
      alter: alter.code,
      name: c.name,
      identity: alter.name,
    });
}
const heroProfile = (id: string) => heroProfiles.get(id);
const assemblePlayed = (s: GameState) =>
  s.players.some(
    (seat) => seatView(s, seat).flags.captainAssembleRound === s.round,
  );
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const pack = (type: string, args: Record<string, unknown> = {}) =>
  E("cap-pack:" + type, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const traitList = (text = "") =>
  text
    .replace(/\.$/, "")
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
const hasPrintedTrait = (c: Card | undefined, name: string) =>
  traitList(c?.traits).some(
    (trait) => trait.toLowerCase() === name.toLowerCase(),
  );
const heroId = (s: GameState, target: string) =>
  target === "hero"
    ? s.activePlayerId
    : target.startsWith("hero:")
      ? target.slice(5)
      : undefined;
const canonical = (s: GameState, target: string) =>
  target === "hero" ? "hero:" + s.activePlayerId : target;
const attachedTarget = (s: GameState, p: Piece) =>
  p.attachedTo === "hero"
    ? "hero:" + (p.ownerId || s.activePlayerId)
    : p.attachedTo;
const attached = (s: GameState, target: string, code: string) =>
  allInPlay(s).filter(
    (p) => p.code === code && attachedTarget(s, p) === canonical(s, target),
  );
const inPlay = (s: GameState, id: string) =>
  [s.villain, ...s.minions, ...s.sideSchemes, ...allInPlay(s)].find(
    (p) => p.id === id,
  );
const ownAllies = (s: GameState) =>
  s.player.inPlay.filter((p) => cards.get(p.code)?.type_code === "ally");

/** Exact Core reprints have one owner: the existing native Core handler. */
export const CAPTAIN_PACK_CORE_ALIASES = [
  "03012",
  "03016",
  "03018",
  "03020",
  "03021",
  "03022",
  "03023",
] as const;
export const CAPTAIN_PACK_SCRIPT_CODES = [
  "03011",
  "03013",
  "03014",
  "03015",
  "03017",
  "03019",
  "03024",
  "03025",
  "03031",
  "03032",
  "03033",
  "03034",
] as const;

export interface CaptainPackPorts {
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
  discardHand(s: GameState, id: string): void;
  revealHidden(s: GameState): void;
  /** Bypass payment and play triggers; still run ally-limit and enters-play hooks. */
  putAllyFromHand(s: GameState, id: string): void;
  /** Canonical hero:seat / ally / side-scheme attachment lifecycle, including HP
   * changes, transfer to target controller and maximum-one checks. */
  attach(s: GameState, upgradeId: string, targetId: string): void;
}

export function captainPackModifiers(s: GameState, target: string) {
  return {
    hp: attached(s, target, "03025").length,
    attack: attached(s, target, "03031").length * 2,
    consequentialAttack: attached(s, target, "03031").length,
    traits: attached(s, target, "03025").length ? ["Avenger"] : [],
  };
}
export function captainPackHasTrait(
  s: GameState,
  target: string,
  name: string,
) {
  const seatId = heroId(s, target);
  const seat = seatId
    ? s.players.find((seat) => seat.id === seatId)
    : undefined;
  const view = seat ? seatView(s, seat) : undefined;
  const hero = view ? heroProfile(view.heroId) : undefined;
  const c =
    view && hero
      ? cards.get(view.player.form === "hero" ? hero.code : hero.alter)
      : cards.get(inPlay(s, target)?.code || "");
  return (
    hasPrintedTrait(c, name) ||
    captainPackModifiers(s, target).traits.some(
      (trait) => trait.toLowerCase() === name.toLowerCase(),
    )
  );
}
export function captainPackAllyLimit(s: GameState) {
  return s.player.inPlay.some((p) => ["03024", "04021"].includes(p.code)) &&
    ownAllies(s).every((p) => captainPackHasTrait(s, p.id, "Avenger"))
    ? 1
    : 0;
}
export function captainPackDiscount(s: GameState, c: Card) {
  return c.type_code === "ally" && hasPrintedTrait(c, "Avenger")
    ? Number(s.flags.captainTowerDiscount || 0)
    : 0;
}
export function captainPackCardPlayed(s: GameState, c: Card) {
  if (c.code === "03015") {
    s.flags.captainAssembleRound = s.round;
    s.flags.captainAssemblePending = true;
  }
  if (c.type_code === "ally" && hasPrintedTrait(c, "Avenger"))
    delete s.flags.captainTowerDiscount;
}
export function captainPackStats(s: GameState) {
  return {
    attack: Number(s.flags.captainAssembleHeroAtk || 0),
    thwart: Number(s.flags.captainAssembleHeroThw || 0),
  };
}
type AssembleRecipient = { id: string; hero?: boolean; code?: string };
export function captainPackPhaseEnded(s: GameState) {
  const recipients: AssembleRecipient[] = JSON.parse(
    String(s.flags.captainAssembleApplied || "[]"),
  );
  for (const recipient of recipients) {
    if (recipient.hero) {
      const seat = s.players.find((seat) => seat.id === recipient.id);
      if (seat) {
        const view = seatView(s, seat);
        view.flags.captainAssembleHeroAtk = Math.max(
          0,
          Number(view.flags.captainAssembleHeroAtk || 0) - 1,
        );
        view.flags.captainAssembleHeroThw = Math.max(
          0,
          Number(view.flags.captainAssembleHeroThw || 0) - 1,
        );
      }
    } else {
      const p = inPlay(s, recipient.id);
      if (p && p.code === recipient.code) {
        p.bonusAtk = Math.max(0, (p.bonusAtk || 0) - 1);
        p.bonusThw = Math.max(0, (p.bonusThw || 0) - 1);
      }
    }
  }
  delete s.flags.captainAssembleApplied;
  delete s.flags.captainAssemblePending;
  delete s.flags.captainTowerDiscount;
}

export function captainPackPlayRestriction(
  s: GameState,
  p: Piece,
): string | null {
  if (p.code === "03033")
    return "Available when your hero defends against an attack.";
  if (p.code === "03015" && assemblePlayed(s))
    return "Avengers Assemble! is limited to once per round.";
  if (p.code === "03017" && !ownAllies(s).some((p) => !p.exhausted))
    return "Strength In Numbers requires an ally you can exhaust.";
  if (p.code === "03025" && !captainPackHasTrait(s, "hero", "Avenger"))
    return "Your identity must have the Avenger trait.";
  if (
    ["03025", "03031", "03032"].includes(p.code) &&
    !attachmentTargets(s, p.code).length
  )
    return "There is no eligible attachment target.";
  return null;
}
export function captainPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "03015":
      return [pack("assemble")];
    case "03017":
      return [pack("strength")];
    case "03033":
      return [];
    default:
      return null;
  }
}
export function captainPackAllyEnter(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "03011":
      return [
        E("optional", {
          title: "Falcon",
          text: "Look at the top 3 encounter cards and remove threat for each treachery?",
          effects: [pack("falcon")],
        }),
      ];
    case "03013":
      return [
        E("optional", {
          title: "Squirrel Girl",
          text: "Deal 1 damage to each enemy?",
          effects: [pack("squirrel")],
        }),
      ];
    case "03014":
      return [];
    default:
      return null;
  }
}
export function captainPackAllyAttackCost(
  s: GameState,
  p: Piece,
): Effect[] | null {
  return p.code === "03014" ? [pack("wonder-cost", { id: p.id })] : null;
}
export function captainPackCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "03034") p.counters = 3;
  return ["03025", "03031", "03032"].includes(p.code)
    ? [pack("attach", { id: p.id })]
    : [];
}
export function captainPackTurnStart(s: GameState): Effect[] {
  return s.player.inPlay
    .filter((p) => p.code === "03019")
    .map((p) =>
      E("optional", {
        title: "Quinjet",
        text: "Place 1 time counter on Quinjet after your turn begins?",
        effects: [E("counter", { id: p.id, amount: 1 })],
      }),
    );
}
export function captainPackAbilityOptions(s: GameState, id: string): Option[] {
  const p = s.player.inPlay.find((p) => p.id === id);
  if (!p) return [];
  if (["03024", "04021"].includes(p.code) && !p.exhausted)
    return [
      option(
        "tower",
        "Avengers Tower · next Avenger ally costs 1 less",
        [pack("tower", { id })],
        p.code,
      ),
    ];
  if (p.code === "03019" && quinjetAllies(s, p).length)
    return [
      option(
        "quinjet",
        "Quinjet · put an Avenger ally into play",
        [pack("quinjet", { id })],
        p.code,
      ),
    ];
  return [];
}
export function captainPackAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = captainPackAbilityOptions(s, id);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function captainPackResourceSources(s: GameState): PaymentSource[] {
  if (s.player.form !== "hero") return [];
  return s.player.inPlay
    .filter((p) => p.code === "03034" && !p.exhausted && p.counters > 0)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Enhanced Awareness",
      kind: "ability",
      description:
        "Exhaust · spend 1 of " +
        p.counters +
        " mental counters" +
        (p.counters === 1 ? " · then discard" : ""),
      resources: ["mental"],
    }));
}
/** Validate the complete payment before this hook; discard returned effects
 * before resolving the played card. */
export function captainPackResourceSpent(s: GameState, p: Piece): Effect[] {
  if (p.code !== "03034") return [];
  need(
    s.player.form === "hero" && p.counters > 0,
    "Enhanced Awareness has no usable mental counter.",
  );
  p.counters--;
  return p.counters === 0 ? [E("discardPiece", { id: p.id })] : [];
}
export function captainPackSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return attached(s, p.id, "03032").map((followed) =>
    E("optional", {
      actorId:
        controller(s, followed.id)?.id || followed.ownerId || s.activePlayerId,
      title: "Followed",
      text: "Deal 4 damage to an enemy before the attached side scheme is defeated?",
      effects: [
        E("target", {
          group: "enemy",
          action: E("damage", { amount: 4, source: followed.id }),
        }),
      ],
    }),
  );
}
export function captainPackExpertDefenseOptions(
  s: GameState,
  after: Effect[],
): Option[] {
  if (
    s.player.form !== "hero" ||
    !s.attack?.basicDefense ||
    s.attack.defender !== "hero"
  )
    return [];
  return s.player.hand
    .filter((p) => p.code === "03033")
    .map((p) =>
      option(
        p.id,
        "Expert Defense · +3 DEF for this attack",
        [pack("expert", { id: p.id, after })],
        p.code,
      ),
    );
}
function quinjetAllies(s: GameState, p: Piece) {
  return s.player.hand.filter((ally) => {
    const c = cards.get(ally.code)!;
    return (
      c.type_code === "ally" &&
      hasPrintedTrait(c, "Avenger") &&
      c.cost !== undefined &&
      c.cost <= p.counters &&
      !uniqueConflict(s, c)
    );
  });
}
function attachmentTargets(
  s: GameState,
  code: string,
): { id: string; name: string; code: string }[] {
  const targets =
    code === "03032"
      ? s.sideSchemes.map((p) => ({
          id: p.id,
          name: cards.get(p.code)!.name,
          code: p.code,
        }))
      : [
          ...(code === "03025"
            ? playerOrder(s).map((seat) => {
                const hero = heroProfile(seat.heroId)!;
                const view = seatView(s, seat);
                return {
                  id: "hero:" + seat.id,
                  name: view.player.form === "hero" ? hero.name : hero.identity,
                  code: view.player.form === "hero" ? hero.code : hero.alter,
                };
              })
            : []),
          ...allInPlay(s)
            .filter((p) => cards.get(p.code)?.type_code === "ally")
            .map((p) => ({
              id: p.id,
              name: cards.get(p.code)!.name,
              code: p.code,
            })),
        ];
  return targets.filter((target) => !attached(s, target.id, code).length);
}
export function resolveCaptainPackEffect(
  s: GameState,
  e: Effect,
  ports: CaptainPackPorts,
): boolean {
  if (!e.type.startsWith("cap-pack:")) return false;
  switch (e.type) {
    case "cap-pack:falcon": {
      ports.revealHidden(s);
      const top = s.encounter.deck.slice(0, 3);
      ports.choose(
        s,
        "Falcon · encounter preview",
        "Top cards remain in this order. For each treachery, choose a scheme and remove 1 threat.",
        [
          option("continue", "Continue", [
            pack("falcon-thwart", {
              amount: top.filter(
                (p) => cards.get(p.code)?.type_code === "treachery",
              ).length,
            }),
          ]),
        ],
      );
      s.prompt!.options[0].detail =
        top
          .map((p, index) => String(index + 1) + ". " + cards.get(p.code)?.name)
          .join(" · ") || "Encounter deck is empty.";
      break;
    }
    case "cap-pack:falcon-thwart":
      ports.queue(
        s,
        ...Array.from({ length: e.amount }, () =>
          E("target", {
            group: "scheme",
            title: "Falcon",
            action: E("thwart", { amount: 1 }),
          }),
        ),
      );
      break;
    case "cap-pack:squirrel":
      ports.queue(
        s,
        ...[s.villain, ...s.minions].map((p) =>
          E("damage", { target: p.id, amount: 1, source: "Squirrel Girl" }),
        ),
      );
      break;
    case "cap-pack:strength": {
      const allies = ownAllies(s).filter((p) => !p.exhausted);
      need(allies.length, "Strength In Numbers needs an ally to exhaust.");
      ports.select(
        s,
        "Strength In Numbers",
        "Choose any number of your ready allies to exhaust. Draw one card for each.",
        allies,
        0,
        allies.length,
        pack("strength-paid"),
      );
      break;
    }
    case "cap-pack:strength-paid": {
      const ids = e.ids as string[];
      const allies = ids.map((id) =>
        ownAllies(s).find((p) => p.id === id && !p.exhausted),
      );
      need(
        new Set(ids).size === ids.length && allies.every(Boolean),
        "Choose distinct ready allies you control.",
      );
      allies.forEach((p) => {
        p!.exhausted = true;
      });
      ports.queue(s, E("draw", { amount: allies.length }));
      break;
    }
    case "cap-pack:wonder-cost": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03014",
      );
      need(
        p && !p.exhausted && s.player.hand.length > 0,
        "Wonder Man needs to be ready and discard one card to attack.",
      );
      ports.select(
        s,
        "Wonder Man · attack cost",
        "Discard one card from hand before Wonder Man attacks.",
        s.player.hand,
        1,
        1,
        pack("wonder-paid", { id: p!.id }),
      );
      break;
    }
    case "cap-pack:wonder-paid": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03014",
      );
      const h = s.player.hand.find((p) => p.id === e.ids?.[0]);
      need(
        p && !p.exhausted && e.ids?.length === 1 && h,
        "Wonder Man's attack cost cannot be paid.",
      );
      ports.discardHand(s, h!.id);
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          action: E("allyAction", { id: p!.id, kind: "attack", attack: true }),
        }),
      );
      break;
    }
    case "cap-pack:quinjet": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03019",
      );
      need(p, "Quinjet is no longer in play.");
      ports.choose(
        s,
        "Quinjet",
        "Choose an Avenger ally with printed cost at most " +
          p!.counters +
          ". Ally limit and enters-play response apply.",
        quinjetAllies(s, p!).map((ally) =>
          option(
            ally.id,
            cards.get(ally.code)!.name,
            [pack("quinjet-put", { id: p!.id, allyId: ally.id })],
            ally.code,
          ),
        ),
      );
      break;
    }
    case "cap-pack:quinjet-put": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "03019",
      );
      need(
        p && quinjetAllies(s, p).some((ally) => ally.id === e.allyId),
        "Quinjet can no longer put that ally into play.",
      );
      ports.putAllyFromHand(s, e.allyId);
      ports.queue(s, E("discardPiece", { id: p!.id }));
      break;
    }
    case "cap-pack:tower": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && ["03024", "04021"].includes(p.code),
      );
      need(p && !p.exhausted, "Avengers Tower must be ready.");
      p!.exhausted = true;
      s.flags.captainTowerDiscount =
        Number(s.flags.captainTowerDiscount || 0) + 1;
      break;
    }
    case "cap-pack:attach": {
      const p = inPlay(s, e.id);
      need(
        p && ["03025", "03031", "03032"].includes(p.code),
        "Attachment is no longer in play.",
      );
      ports.choose(
        s,
        cards.get(p!.code)!.name,
        "Choose an eligible printed attachment target.",
        attachmentTargets(s, p!.code).map((target) =>
          option(
            target.id,
            target.name,
            [pack("attach-to", { id: p!.id, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "cap-pack:attach-to": {
      const p = inPlay(s, e.id);
      need(
        p &&
          attachmentTargets(s, p.code).some((target) => target.id === e.target),
        "Attachment target is no longer eligible.",
      );
      ports.attach(s, p!.id, e.target);
      break;
    }
    case "cap-pack:expert":
      need(
        s.attack?.basicDefense &&
          s.attack.defender === "hero" &&
          s.player.form === "hero" &&
          s.player.hand.some((p) => p.id === e.id && p.code === "03033"),
        "Expert Defense's trigger is no longer available.",
      );
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: e.id,
          after: [pack("expert-bonus"), ...e.after],
        }),
      );
      break;
    case "cap-pack:expert-bonus":
      if (s.attack?.basicDefense) {
        const attack = s.attack as typeof s.attack & { defenseBonus?: number };
        attack.defenseBonus = (attack.defenseBonus || 0) + 3;
        attack.defense += 3;
      }
      break;
    case "cap-pack:assemble": {
      need(
        s.player.form === "hero" &&
          (s.flags.captainAssemblePending || !assemblePlayed(s)),
        "Avengers Assemble! is unavailable this round.",
      );
      s.flags.captainAssembleRound = s.round;
      delete s.flags.captainAssemblePending;
      if (captainPackHasTrait(s, "hero", "Avenger")) s.player.exhausted = false;
      for (const p of ownAllies(s))
        if (captainPackHasTrait(s, p.id, "Avenger")) p.exhausted = false;
      const recipients: AssembleRecipient[] = [];
      for (const seat of playerOrder(s))
        if (captainPackHasTrait(s, "hero:" + seat.id, "Avenger")) {
          const view = seatView(s, seat);
          view.flags.captainAssembleHeroAtk =
            Number(view.flags.captainAssembleHeroAtk || 0) + 1;
          view.flags.captainAssembleHeroThw =
            Number(view.flags.captainAssembleHeroThw || 0) + 1;
          recipients.push({ id: seat.id, hero: true });
        }
      for (const p of [
        s.villain,
        ...s.minions,
        ...allInPlay(s).filter((p) => cards.get(p.code)?.type_code === "ally"),
      ])
        if (captainPackHasTrait(s, p.id, "Avenger")) {
          p.bonusAtk = (p.bonusAtk || 0) + 1;
          p.bonusThw = (p.bonusThw || 0) + 1;
          recipients.push({ id: p.id, code: p.code });
        }
      s.flags.captainAssembleApplied = JSON.stringify(recipients);
      break;
    }
    default:
      throw Error("Unregistered Captain America pack effect: " + e.type);
  }
  return true;
}
