import catalog from "../data/catalog-cards.json" with { type: "json" };
import { controller, playerOrder, seatView } from "./team.js";
import { uniqueConflict } from "./unique.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const SW = (type: string, args: Record<string, unknown> = {}) =>
  E(`sw:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "spider_woman";
const aspects = new Set([
  "aggression",
  "justice",
  "leadership",
  "protection",
  "pool",
]);
const aspect = (c: Card | undefined) => !!c && aspects.has(c.faction_code);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const hasTrait = (p: Piece, name: string) =>
  (cards.get(p.code)?.traits || "").split(/\.\s*/).includes(name);
const schemeThreat = (s: GameState, id: string) =>
  id === "main"
    ? s.scheme.threat
    : s.sideSchemes.find((p) => p.id === id)?.counters || 0;
const actorEffects = (effects: Effect[], playerId: string) =>
  effects.map((e) => ({ ...e, actorId: e.actorId || playerId }));
const survivingActor = (s: GameState, preferred?: string) =>
  s.players.find((seat) => seat.id === preferred && !seat.eliminated)?.id ||
  playerOrder(s)[0]?.id ||
  s.activePlayerId;

/** The Spider-Woman half of Rise of Red Skull, with one complete owner per
 * printed face. Core reprints and whole-text compiler programs stay separate. */
export const SPIDER_WOMAN_CORE_ALIASES = [
  "04041",
  "04042",
  "04046",
  "04048",
  "04050",
  "04051",
  "04052",
] as const;
export const SPIDER_WOMAN_COMPILED_CODES = ["04035", "04044", "04049"] as const;
export const SPIDER_WOMAN_SCRIPT_CODES = [
  "04031a",
  "04031b",
  "04032",
  "04033",
  "04034",
  "04036",
  "04037",
  "04038",
  "04039",
  "04040",
  "04043",
  "04045",
  "04047",
  "04053",
  "04054",
  "04055",
  "04056",
  "04057",
] as const;
export const SPIDER_WOMAN_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf";
export const SPIDER_WOMAN_STARTER_SOURCE =
  "https://images-cdn.fantasyflightgames.com/filer_public/92/1d/921ddef8-c28c-4096-a9e9-63142230a602/mc10_the_rise_of_red_skull_rules_web.pdf";
export const SPIDER_WOMAN_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface SpiderWomanTarget {
  id: string;
  label: string;
  code?: string;
}
export interface SpiderWomanDeckTop {
  id: string;
  label: string;
  top?: Piece;
}
export interface SpiderWomanPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  revealHidden(s: GameState): void;
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  identityMaxHP(s: GameState, playerId: string): number;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): SpiderWomanTarget[];
  schemeTargets(s: GameState, thwart: boolean): SpiderWomanTarget[];
  /** Nonempty player, encounter and supplementary/scenario decks. Only labels
   * are shown until a deck is chosen; this operation must not reveal any face. */
  peekableDecks(s: GameState): SpiderWomanDeckTop[];
  /** Apply all allocated reductions before opening side-scheme defeat windows.
   * Legality is determined before this single thwart ability resolves. */
  thwartDistribution(
    s: GameState,
    packets: { target: string; amount: number }[],
  ): void;
  /** Normal enemy activation, with the exact after effect receiving performed.
   * The callback also reports attackedPlayerId after any defensive redirect.
   * Stunned/Webbed-Up replacement is not an attack for Hail Hydra's condition. */
  attackMinion(s: GameState, id: string, playerId: string, after: Effect): void;
  /** Remove exact instance from encounter zones, reset it and run entry/forced
   * keywords/Quickstrike/engagement responses; never run When Revealed/Incite. */
  putMinion(s: GameState, p: Piece, playerId: string): void;
  log(s: GameState, message: string): void;
}
/** Enemy labels come from the host, including synthesized encounter pieces
 * such as Ultron's facedown Drone cards that have no printed catalog face. */
const enemyName = (s: GameState, p: Piece, ports: SpiderWomanPorts) =>
  ports.enemyTargets(s, false).find((target) => target.id === p.id)?.label ||
  cards.get(p.code)?.name ||
  p.code;

export function spiderWomanStats(s: GameState) {
  const amount =
    active(s) && s.player.form === "hero"
      ? [...aspects].filter((a) => s.flags[`swAgility:${a}`] === s.round).length
      : 0;
  return { attack: amount, thwart: amount, defense: amount };
}
export function spiderWomanHasAerial(s: GameState) {
  return active(s) && s.flags.swAerialRound === s.round;
}
/** The Viper affects the identity it is engaged with, regardless of hero ID or
 * form, and stops as soon as it leaves play or changes its engagement. */
export function spiderWomanHandSize(s: GameState) {
  const count = s.minions.filter(
    (p) =>
      p.code === "04054" &&
      (p.engagedWith || s.activePlayerId) === s.activePlayerId,
  ).length;
  return count ? -count : 0;
}
/** Call in the play interrupt window before the played card's effect. Playing
 * a signature aspect card qualifies; spending an aspect resource does not. */
export function spiderWomanCardPlayed(s: GameState, c: Card): Effect[] {
  return active(s) &&
    s.player.form === "hero" &&
    aspect(c) &&
    s.flags[`swAgility:${c.faction_code}`] !== s.round
    ? [
        E("optional", {
          title: "Superhuman Agility",
          text: `Get +1 THW, ATK and DEF this round for playing a ${c.faction_code} card?`,
          effects: [SW("agility", { aspect: c.faction_code, round: s.round })],
        }),
      ]
    : [];
}

export function spiderWomanAbilityOptions(
  s: GameState,
  id: string,
  ports: SpiderWomanPorts,
): Option[] {
  if (id === "identity")
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.swPeekRound !== s.round &&
      ports.peekableDecks(s).some((deck) => deck.top)
      ? [
          option(
            "double-agent",
            "Jessica Drew · look at the top card of any deck",
            [SW("peek")],
            "04031b",
          ),
        ]
      : [];
  const p = own(s, id, "04034");
  return p && !p.exhausted && s.player.form === "alter" && s.player.deck.length
    ? [
        option(
          "apartment",
          "Jessica Drew's Apartment · search the top 5 cards",
          [SW("apartment", { id })],
          p.code,
        ),
      ]
    : [];
}
export function spiderWomanAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: SpiderWomanPorts,
): Effect[] | null {
  const choices = spiderWomanAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function spiderWomanResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  return s.player.form === "hero" && aspect(cards.get(targetCode || ""))
    ? s.player.inPlay
        .filter((p) => p.code === "04033" && !p.exhausted)
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: cards.get(p.code)!.name,
          resources: ["wild"],
          kind: "ability",
          description: "Exhaust · 1 wild for an aspect card or its ability",
        }))
    : [];
}
export function spiderWomanResourceSpent(
  s: GameState,
  p: Piece,
  targetCode?: string,
): Effect[] {
  if (p.code === "04033")
    need(
      s.player.form === "hero" && aspect(cards.get(targetCode || "")),
      "Finesse only pays for an aspect card or its ability in hero form.",
    );
  return [];
}
export function spiderWomanPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SpiderWomanPorts,
): string | null {
  if (
    p.code === "04036" &&
    !ports
      .enemyTargets(s, false)
      .some(
        (target) =>
          ports.canGiveStatus(s, target.id, "stunned") ||
          ports.canGiveStatus(s, target.id, "confused"),
      )
  )
    return "There is no enemy that Pheromones can stun or confuse.";
  if (
    p.code === "04047" &&
    s.player.inPlay.some(
      (p) => cards.get(p.code)?.name === "Skilled Investigator",
    )
  )
    return "You already control Skilled Investigator (maximum 1 per player).";
  if (
    p.code === "04037" &&
    s.player.hp >= ports.identityMaxHP(s, s.activePlayerId) &&
    !ports.canGiveStatus(s, "hero", "tough")
  )
    return "Contaminant Immunity requires damage to heal or a Tough card to give.";
  if (
    p.code === "04038" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "There is no legal scheme to thwart.";
  if (
    p.code === "04039" &&
    (!s.player.exhausted || !ports.canReadyIdentity(s, s.activePlayerId)) &&
    spiderWomanHasAerial(s)
  )
    return "Self-Propelled Glide cannot ready Spider-Woman or grant Aerial.";
  if (
    p.code === "04043" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "There is no legal enemy to attack.";
  return null;
}
export function spiderWomanEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "04036":
      return [SW("pheromones")];
    case "04037":
      return [
        E("heal", { target: "hero", amount: 3 }),
        E("status", { target: "hero", status: "tough" }),
      ];
    case "04038":
      return [SW("inconspicuous", { remaining: 3, assigned: {} })];
    case "04039":
      return [SW("glide")];
    case "04043":
      return [
        E("target", {
          group: "enemy",
          title: "Press the Advantage",
          action: SW("press", { attack: true }),
        }),
      ];
    default:
      return null;
  }
}
/** Unlike enters-play responses, both printed responses require a real play
 * from hand. The host must explicitly pass that provenance. */
export function spiderWomanAllyEnter(
  s: GameState,
  p: Piece,
  fromHand = false,
): Effect[] | null {
  if (p.code === "04032") return [];
  if (!["04040", "04045"].includes(p.code)) return null;
  if (!fromHand) return [];
  const actorId = controller(s, p.id)?.id || s.activePlayerId;
  return [
    E("optional", {
      actorId,
      title: cards.get(p.code)!.name,
      text:
        p.code === "04040"
          ? "Stun and confuse a minion?"
          : `Remove ${3 * s.playerCount} threat from a side scheme?`,
      effects: [
        SW(p.code === "04040" ? "spider-girl" : "spider-man", {
          actorId,
          source: p.id,
        }),
      ],
    }),
  ];
}
/** After the basic attack/thwart resolves, before consequential damage. An
 * ally defending has not used a DEF basic power (RRG1.8 Basic Power/Defend). */
export function spiderWomanAllyBasicUsed(
  s: GameState,
  p: Piece,
  kind: "attack" | "thwart" | "defense",
): Effect[] {
  if (p.code !== "04032" || kind === "defense") return [];
  const actorId = controller(s, p.id)?.id;
  return actorId
    ? [
        E("optional", {
          actorId,
          title: "Captain Marvel",
          text: "Draw 1 card after using this basic power?",
          effects: [E("draw", { amount: 1, actorId })],
        }),
      ]
    : [];
}
export function spiderWomanSchemeDefeated(
  s: GameState,
  _piece: Piece,
): Effect[] {
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat);
    return view.player.form === "hero"
      ? view.player.inPlay
          .filter((p) => p.code === "04047" && !p.exhausted)
          .map((p) =>
            E("optional", {
              actorId: seat.id,
              title: "Skilled Investigator",
              text: "Exhaust Skilled Investigator to draw 1 card?",
              effects: [SW("investigator", { id: p.id, actorId: seat.id })],
            }),
          )
      : [];
  });
}
export function spiderWomanEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "04053": {
      const owner = s.players.find(
        (seat) => seat.heroId === "spider_woman" && !seat.eliminated,
      );
      return owner
        ? [SW("obligation", { piece: p, actorId: owner.id })]
        : [E("removeEncounter", { piece: p }), E("revealNext")];
    }
    case "04055":
      return [E("threat", { target: p.id, amount: s.playerCount })];
    case "04057":
      return [SW("hydra", { origin: s.activePlayerId })];
    case "04054":
    case "04056":
      return [];
    default:
      return null;
  }
}
export function spiderWomanBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["04053", "04054", "04055", "04056", "04057"].includes(p.code)
    ? []
    : null;
}

export function resolveSpiderWomanEffect(
  s: GameState,
  e: Effect,
  ports: SpiderWomanPorts,
): boolean {
  if (!e.type.startsWith("sw:")) return false;
  switch (e.type) {
    case "sw:agility":
      need(
        active(s) &&
          s.player.form === "hero" &&
          aspects.has(e.aspect) &&
          e.round === s.round &&
          s.flags[`swAgility:${e.aspect}`] !== s.round,
        "Superhuman Agility is unavailable for this aspect this round.",
      );
      s.flags[`swAgility:${e.aspect}`] = s.round;
      break;
    case "sw:peek": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.swPeekRound !== s.round,
        "Jessica Drew's look ability is unavailable.",
      );
      const decks = ports.peekableDecks(s).filter((deck) => deck.top);
      need(decks.length, "There is no deck with a top card to look at.");
      ports.choose(
        s,
        "Jessica Drew",
        "Choose a deck. Only its top card will be shown.",
        decks.map((deck) =>
          option(deck.id, deck.label, [SW("peek-deck", { deck: deck.id })]),
        ),
      );
      break;
    }
    case "sw:peek-deck": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.swPeekRound !== s.round,
        "Jessica Drew's look ability has already been used.",
      );
      const deck = ports.peekableDecks(s).find((deck) => deck.id === e.deck);
      need(deck?.top, "The chosen deck no longer has a top card.");
      s.flags.swPeekRound = s.round;
      ports.revealHidden(s);
      ports.choose(s, "Jessica Drew", `Top of ${deck!.label}`, [
        option("done", cards.get(deck!.top!.code)!.name, [], deck!.top!.code),
      ]);
      break;
    }
    case "sw:apartment": {
      const p = own(s, e.id, "04034");
      need(
        p && !p.exhausted && s.player.form === "alter" && s.player.deck.length,
        "Jessica Drew's Apartment is unavailable.",
      );
      p!.exhausted = true;
      const top = s.player.deck.slice(0, 5);
      ports.revealHidden(s);
      const candidates = top.filter((p) => aspect(cards.get(p.code)));
      if (!candidates.length) {
        ports.shufflePlayerDeck(s);
        break;
      }
      ports.choose(
        s,
        "Jessica Drew's Apartment",
        "Choose an aspect card from the top 5, then shuffle your deck.",
        [
          ...candidates.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [SW("apartment-found", { id: p.id, top: top.map((p) => p.id) })],
              p.code,
            ),
          ),
        ],
      );
      break;
    }
    case "sw:apartment-found": {
      if (e.id) {
        const index = s.player.deck.findIndex((p) => p.id === e.id);
        need(
          index >= 0 &&
            index < 5 &&
            e.top.includes(e.id) &&
            aspect(cards.get(s.player.deck[index].code)),
          "That card is no longer an aspect card in the searched top 5.",
        );
        s.player.hand.push(s.player.deck.splice(index, 1)[0]);
      }
      ports.shufflePlayerDeck(s);
      break;
    }
    case "sw:glide":
      need(
        active(s) && s.player.form === "hero",
        "Spider-Woman must be in hero form.",
      );
      s.flags.swAerialRound = s.round;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    case "sw:pheromones": {
      const targets = ports
        .enemyTargets(s, false)
        .filter(
          (target) =>
            ports.canGiveStatus(s, target.id, "stunned") ||
            ports.canGiveStatus(s, target.id, "confused"),
        );
      if (targets.length)
        ports.choose(
          s,
          "Pheromones",
          "Choose an enemy to stun and confuse.",
          targets.map((target) =>
            option(
              target.id,
              target.label,
              [SW("pheromones-status", { target: target.id })],
              target.code,
            ),
          ),
        );
      break;
    }
    case "sw:pheromones-status":
      need(
        ports.enemyTargets(s, false).some((target) => target.id === e.target) &&
          (ports.canGiveStatus(s, e.target, "stunned") ||
            ports.canGiveStatus(s, e.target, "confused")),
        "Pheromones' enemy can no longer be stunned or confused.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "stunned" }),
        E("status", { target: e.target, status: "confused" }),
      );
      break;
    case "sw:inconspicuous": {
      const assigned = e.assigned as Record<string, number>;
      const legal: string[] =
        e.legal || ports.schemeTargets(s, true).map((p) => p.id);
      const targets = ports
        .schemeTargets(s, true)
        .filter(
          (p) =>
            legal.includes(p.id) &&
            schemeThreat(s, p.id) > (assigned[p.id] || 0),
        );
      if (e.remaining <= 0 || !targets.length) {
        ports.thwartDistribution(
          s,
          Object.entries(assigned).map(([target, amount]) => ({
            target,
            amount,
          })),
        );
        break;
      }
      ports.choose(
        s,
        "Inconspicuous",
        `Allocate ${e.remaining} remaining threat removal before resolving this thwart.`,
        targets.flatMap((target) => {
          const max = Math.min(
            e.remaining,
            schemeThreat(s, target.id) - (assigned[target.id] || 0),
          );
          return Array.from({ length: max }, (_, index) => {
            const amount = index + 1;
            return option(
              `${target.id}:${amount}`,
              `${target.label} · remove ${amount} threat`,
              [
                SW("inconspicuous-assign", {
                  remaining: e.remaining,
                  assigned,
                  target: target.id,
                  amount,
                  legal,
                }),
              ],
              target.code,
            );
          });
        }),
      );
      break;
    }
    case "sw:inconspicuous-assign": {
      const assigned = e.assigned as Record<string, number>;
      need(
        Number.isInteger(e.amount) &&
          e.amount > 0 &&
          e.amount <= e.remaining &&
          e.legal.includes(e.target) &&
          ports.schemeTargets(s, true).some((p) => p.id === e.target) &&
          schemeThreat(s, e.target) - (assigned[e.target] || 0) >= e.amount,
        "This threat allocation is no longer legal.",
      );
      ports.queue(
        s,
        SW("inconspicuous", {
          remaining: e.remaining - e.amount,
          legal: e.legal,
          assigned: {
            ...assigned,
            [e.target]: (assigned[e.target] || 0) + e.amount,
          },
        }),
      );
      break;
    }
    case "sw:press": {
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target),
        "Press the Advantage's enemy is no longer a legal attack target.",
      );
      const p =
        e.target === s.villain.id
          ? s.villain
          : s.minions.find((p) => p.id === e.target)!;
      ports.queue(
        s,
        E("damage", { target: p.id, amount: 2, attack: true, source: "hero" }),
        SW("press-draw", { target: p.id, name: enemyName(s, p, ports) }),
      );
      break;
    }
    case "sw:press-draw": {
      const p =
        e.target === s.villain.id
          ? s.villain
          : s.minions.find((p) => p.id === e.target);
      if (p && enemyName(s, p, ports) === e.name && (p.stunned || p.confused))
        ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "sw:spider-girl": {
      const targets = s.minions.filter(
        (p) =>
          ports.canGiveStatus(s, p.id, "stunned") ||
          ports.canGiveStatus(s, p.id, "confused"),
      );
      if (targets.length)
        ports.choose(
          s,
          "Spider-Girl",
          "Choose a minion to stun and confuse.",
          targets.map((p) =>
            option(
              p.id,
              enemyName(s, p, ports),
              [SW("spider-girl-status", { target: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "sw:spider-girl-status":
      need(
        s.minions.some((p) => p.id === e.target),
        "Spider-Girl's minion is no longer in play.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "stunned" }),
        E("status", { target: e.target, status: "confused" }),
      );
      break;
    case "sw:spider-man": {
      const targets = ports
        .schemeTargets(s, false)
        .filter((p) => p.id !== "main");
      if (targets.length)
        ports.choose(
          s,
          "Spider-Man",
          "Choose a side scheme.",
          targets.map((p) =>
            option(
              p.id,
              p.label,
              [SW("spider-man-thwart", { target: p.id, source: e.source })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "sw:spider-man-thwart":
      need(
        ports
          .schemeTargets(s, false)
          .some((p) => p.id === e.target && p.id !== "main"),
        "Spider-Man's side scheme is no longer legal.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 3 * s.playerCount,
          source: e.source,
        }),
      );
      break;
    case "sw:investigator": {
      const p = own(s, e.id, "04047");
      need(
        p && !p.exhausted && s.player.form === "hero",
        "Skilled Investigator is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "sw:obligation": {
      need(active(s), "Uncertain Loyalties belongs to Jessica Drew.");
      const options = [
        option("threat", "Place 3 threat on the main scheme", [
          E("threat", { target: "main", amount: 3 }),
          E("discardEncounter", { piece: e.piece }),
        ]),
      ];
      // This obligation does not offer the voluntary flip printed on most others.
      if (s.player.form === "alter" && !s.player.exhausted)
        options.unshift(
          option("exhaust", "Exhaust Jessica Drew · remove this obligation", [
            SW("obligation-exhaust", { piece: e.piece }),
          ]),
        );
      ports.choose(
        s,
        "Uncertain Loyalties",
        "Choose how to resolve Jessica Drew's obligation.",
        options,
      );
      break;
    }
    case "sw:obligation-exhaust":
      need(
        active(s) && s.player.form === "alter" && !s.player.exhausted,
        "Jessica Drew cannot pay this obligation's exhaust cost.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "sw:hydra":
      ports.queue(
        s,
        SW("hydra-attacks", {
          origin: e.origin,
          actorId: survivingActor(s, s.firstPlayerId),
          remaining: s.minions
            .filter((p) => {
              const seat = s.players.find(
                (seat) =>
                  seat.id === (p.engagedWith || s.activePlayerId) &&
                  !seat.eliminated,
              );
              return (
                seat &&
                hasTrait(p, "Hydra") &&
                seatView(s, seat).player.form === "hero"
              );
            })
            .map((p) => ({
              id: p.id,
              playerId: p.engagedWith || s.activePlayerId,
            })),
          attacked: [],
        }),
      );
      break;
    case "sw:hydra-attacks": {
      const remaining = (
        e.remaining as { id: string; playerId: string }[]
      ).filter(
        (entry) =>
          s.minions.some(
            (p) =>
              p.id === entry.id &&
              (p.engagedWith || entry.playerId) === entry.playerId,
          ) &&
          s.players.some(
            (seat) => seat.id === entry.playerId && !seat.eliminated,
          ),
      );
      if (!remaining.length) {
        ports.queue(
          s,
          SW("hydra-search", {
            origin: e.origin,
            players: playerOrder(s)
              .filter((seat) => !e.attacked.includes(seat.id))
              .map((seat) => seat.id),
            actorId: survivingActor(s, e.origin),
          }),
        );
        break;
      }
      const effects = (entry: { id: string; playerId: string }) => [
        SW("hydra-attack", {
          ...entry,
          remaining: remaining.filter((x) => x.id !== entry.id),
          attacked: e.attacked,
          origin: e.origin,
          actorId: entry.playerId,
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...effects(remaining[0]));
      else
        ports.choose(
          s,
          "Hail Hydra!",
          "Choose the next Hydra minion to attack.",
          remaining.map((entry) =>
            option(
              entry.id,
              cards.get(s.minions.find((p) => p.id === entry.id)!.code)!.name,
              effects(entry),
              s.minions.find((p) => p.id === entry.id)!.code,
            ),
          ),
        );
      break;
    }
    case "sw:hydra-attack": {
      const after = SW("hydra-after-attack", {
        remaining: e.remaining,
        attacked: e.attacked,
        origin: e.origin,
        playerId: e.playerId,
        actorId: e.origin,
      });
      const minion = s.minions.find((p) => p.id === e.id);
      const seat = s.players.find(
        (seat) => seat.id === e.playerId && !seat.eliminated,
      );
      if (
        !minion ||
        !hasTrait(minion, "Hydra") ||
        (minion.engagedWith || e.playerId) !== e.playerId ||
        !seat ||
        seatView(s, seat).player.form !== "hero"
      )
        ports.queue(s, { ...after, performed: false });
      else ports.attackMinion(s, minion.id, e.playerId, after);
      break;
    }
    case "sw:hydra-after-attack":
      ports.queue(
        s,
        SW("hydra-attacks", {
          remaining: e.remaining,
          attacked: e.performed
            ? [...new Set([...e.attacked, e.attackedPlayerId || e.playerId])]
            : e.attacked,
          origin: e.origin,
          actorId: survivingActor(s, s.firstPlayerId),
        }),
      );
      break;
    case "sw:hydra-search": {
      const players = (e.players as string[]).filter((id) =>
        s.players.some((seat) => seat.id === id && !seat.eliminated),
      );
      if (!players.length) {
        ports.queue(
          s,
          SW("hydra-finish", {
            searchedDeck: e.searchedDeck,
            actorId: survivingActor(s, e.origin),
          }),
        );
        break;
      }
      const playerId = players[0];
      if (s.activePlayerId !== playerId) {
        ports.queue(s, { ...e, players, actorId: playerId });
        break;
      }
      const candidates = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) =>
          cards.get(p.code)?.type_code === "minion" &&
          hasTrait(p, "Hydra") &&
          !uniqueConflict(s, cards.get(p.code)!),
      );
      ports.revealHidden(s);
      const after = SW("hydra-search", {
        players: players.slice(1),
        origin: e.origin,
        actorId: e.origin,
        searchedDeck: e.searchedDeck || s.encounter.deck.length > 0,
      });
      if (!candidates.length) {
        ports.queue(s, after);
        break;
      }
      ports.choose(
        s,
        "Hail Hydra!",
        `Choose a Hydra minion to engage ${playerId}.`,
        candidates.map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [
              SW("hydra-found", {
                id: p.id,
                playerId,
                after,
                actorId: playerId,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "sw:hydra-found": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) => p.id === e.id,
      );
      need(
        p &&
          cards.get(p.code)?.type_code === "minion" &&
          hasTrait(p, "Hydra") &&
          !uniqueConflict(s, cards.get(p.code)!),
        "This Hydra minion can no longer enter play.",
      );
      need(
        s.players.some((seat) => seat.id === e.playerId && !seat.eliminated),
        "This Hydra engagement player is no longer in the mission.",
      );
      ports.queue(s, ...actorEffects([e.after], e.origin || s.activePlayerId));
      ports.putMinion(s, p!, e.playerId);
      break;
    }
    case "sw:hydra-finish":
      if (e.searchedDeck) ports.shuffleEncounter(s);
      break;
    default:
      throw Error(`Unimplemented Spider-Woman effect: ${e.type}`);
  }
  return true;
}
