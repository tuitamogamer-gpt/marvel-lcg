import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { statusCards } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type {
  Aspect,
  Card,
  Effect,
  GameState,
  Option,
  Piece,
} from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const W = (type: string, args: Record<string, unknown> = {}) =>
  E(`warlock:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const definition = (p: Piece) => cards.get(p.code)!;
const active = (s: GameState) => s.heroId === "warlock";
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const aspects: readonly Aspect[] = [
  "aggression",
  "justice",
  "protection",
  "leadership",
];
const aspect = (p: Piece): Aspect | undefined =>
  aspects.find((a) => definition(p)?.faction_code === a);
const statuses = ["stunned", "confused", "tough"] as const;
const reservedNemesis = (s: GameState) =>
  new Set(
    String(s.flags.warlockReservedNemesis || "")
      .split(",")
      .filter(Boolean),
  );
const releaseNemesis = (s: GameState, id: string) => {
  const ids = reservedNemesis(s);
  ids.delete(id);
  if (ids.size) s.flags.warlockReservedNemesis = [...ids].join(",");
  else delete s.flags.warlockReservedNemesis;
};
type Status = (typeof statuses)[number];
const friendlyAllies = (s: GameState) =>
  allInPlay(s).filter((p) => definition(p)?.type_code === "ally");
const heroTargets = (s: GameState): AntManTarget[] =>
  playerOrder(s)
    .filter((seat) => seatView(s, seat).player.form === "hero")
    .map((seat) => ({
      id: `hero:${seat.id}`,
      label:
        cards.get(seatView(s, seat).heroId === "warlock" ? "21031a" : "")
          ?.name || seat.heroId,
    }));

export const WARLOCK_SCRIPT_CODES = [
  "21031a",
  "21031b",
  "21032",
  "21033",
  "21034",
  "21035",
  "21036",
  "21037",
  "21038",
  "21039",
  "21040",
  "21066",
  "21067",
  "21068",
  "21069",
  "21070",
] as const;
export const WARLOCK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const WARLOCK_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/the-mad-titans-shadow/#adam";
export const WARLOCK_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#adam";
export interface WarlockRevealContext {
  playerId: string;
  knifeSurge?: number;
}

export interface WarlockPorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  shuffleEncounter(s: GameState): void;
  /** Simultaneously discard up to count actual cards from the ORIGINAL deck,
   * returning their faces. Perform normal exhaustion/reset; never continue
   * milling a reset deck. Count is fixed before any card is revealed. */
  discardPlayerCards(s: GameState, count: number): Piece[];
  heroMaxHP(s: GameState): number;
  /** Remove exactly ONE status card, including one of two Steady cards, and
   * resynchronize the active status under current continuous modifiers. */
  removeIdentityStatusCard(s: GameState, status: Status): boolean;
  /** Physical Pip leaves owner's hand and enters target player's control,
   * retaining ownership, gaining printed Toughness, and opening ordinary ally
   * entry/limit handling. This is putting into play, not playing an ally. */
  putAllyFromHand(s: GameState, id: string, targetPlayerId: string): void;
  canPutAlly(s: GameState, p: Piece): boolean;
  canCancelTreachery(s: GameState, p: Piece): boolean;
  /** Cancel only When Revealed groups; keep printed Surge/Incite. Run after
   * clauses in their order and retain exact physical encounter cleanup. */
  cancelWhenRevealed(
    s: GameState,
    p: Piece,
    after: Effect[],
    context?: WarlockRevealContext,
  ): void;
  /** Search only encounter deck, discard and true set-aside areas, move the
   * actual found card to its normal reveal, and shuffle the encounter deck.
   * A found physical source must not be generated again. */
  findAndRevealEncounter(s: GameState, code: string): void;
  putBoostMinion(s: GameState, p: Piece, playerId: string): void;
  /** Remove the actual boost source from pending activation cleanup before
   * its normal reveal; include the side scheme's normal entry handling. */
  revealBoostCard(s: GameState, p: Piece): void;
}

/** Exactly five original physical nemesis instances, including the Church
 * which Cosmic Inquisition can search before Shadows has entered the set. */
export function warlockInitializeNemesis(
  s: GameState,
  ports: Pick<WarlockPorts, "makePiece">,
): void {
  if (!active(s) || s.player.setAside !== undefined) return;
  s.player.setAside = ["21067", "21068", "21069", "21069", "21070"].map(
    (code) => ports.makePiece(s, code),
  );
}
export function warlockShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    minion = zone.find((p) => p.code === "21067"),
    scheme = zone.find((p) => p.code === "21068");
  const rest = zone.filter(
    (p) =>
      definition(p)?.set_code === "warlock_nemesis" &&
      p.id !== minion?.id &&
      p.id !== scheme?.id,
  );
  const ids = [
    ...(minion ? [minion] : []),
    ...(scheme ? [scheme] : []),
    ...rest,
  ].map((p) => p.id);
  if (ids.length) s.flags.warlockReservedNemesis = ids.join(",");
  return [
    ...(minion
      ? [W("reveal-setaside", { id: minion.id, actorId: s.activePlayerId })]
      : []),
    ...(scheme
      ? [W("reveal-setaside", { id: scheme.id, actorId: s.activePlayerId })]
      : []),
    W("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!minion ? [E("surge")] : []),
  ];
}

/** Leadership grants belong to the RECEIVING seat, regardless of its hero. */
export function warlockStats(s: GameState) {
  const amount =
    s.player.form === "hero" &&
    Number(s.flags.warlockLeadershipRound) === s.round
      ? Number(s.flags.warlockLeadershipAmount || 0)
      : 0;
  return { attack: amount, thwart: amount, defense: amount };
}
export function warlockPhaseEnded(s: GameState): void {
  for (const seat of s.players) delete seatView(s, seat).flags.warlockMagePhase;
}
export function warlockRoundEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.warlockLeadershipRound;
    delete flags.warlockLeadershipAmount;
  }
}
export function warlockDistinctAspects(pieces: Piece[]): number {
  return new Set(pieces.map(aspect).filter(Boolean)).size;
}
export function warlockPlayRestriction(s: GameState, p: Piece): string | null {
  if (["21038", "21039"].includes(p.code)) {
    if (s.player.form !== "hero") return "This event requires hero form.";
    if (!s.player.deck.length)
      return "The additional discard cost requires at least 1 deck card.";
  }
  if (p.code === "21040" && !s.player.discard.length)
    return "Quantum Magic requires a card already in your discard pile.";
  return null;
}

/** Call AFTER cancelable resource payment but BEFORE event status replacement.
 * The chosen original top cards are an additional cost, so Stun/Confuse cannot
 * avoid discarding them. Copies in the receipt are face snapshots, not zones. */
export function warlockBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  if (!["21038", "21039"].includes(p.code)) return null;
  return [W("spell-cost", { piece: p, after })];
}
export function warlockEvent(
  _s: GameState,
  p: Piece,
  discarded: Piece[] = [],
): Effect[] | null {
  switch (p.code) {
    case "21038":
      return [
        W("spell-target", {
          attack: true,
          bonus: warlockDistinctAspects(discarded),
          eventId: p.id,
        }),
      ];
    case "21039":
      return [
        W("spell-target", {
          attack: false,
          bonus: warlockDistinctAspects(discarded),
          eventId: p.id,
        }),
      ];
    case "21040":
      return [W("quantum")];
    default:
      return null;
  }
}
export function warlockAbilityOptions(
  s: GameState,
  id: string,
  ports: WarlockPorts,
): Option[] {
  if (["hero", "identity"].includes(id) && active(s)) {
    if (
      s.player.form === "hero" &&
      s.player.hand.length &&
      s.flags.warlockMagePhase !== phaseKey(s)
    )
      return [
        option(
          "battle-mage",
          "Battle Mage · discard a card",
          [W("mage")],
          "21031a",
        ),
      ];
    if (
      s.player.form === "alter" &&
      s.player.hand.length &&
      statuses.some((status) => statusCards(s.player, status))
    )
      return [
        option(
          "avatar-of-life",
          "Avatar of Life · discard a card to remove a status",
          [W("avatar")],
          "21031b",
        ),
      ];
    return [];
  }
  const p = own(s, id, "21033");
  return p &&
    !ports.isTextBlank(s, p) &&
    !p.exhausted &&
    p.counters > 0 &&
    s.player.form === "alter" &&
    s.player.hp < ports.heroMaxHP(s)
    ? [
        option(
          "soul-heal",
          "Soul World · remove 1 soul counter and heal all damage",
          [W("soul-heal", { id })],
          p.code,
        ),
      ]
    : [];
}
export function warlockAbility(
  s: GameState,
  id: string,
  ports: WarlockPorts,
  action?: string,
): boolean {
  const choice = warlockAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!choice) return false;
  ports.queue(s, ...choice.effects);
  return true;
}
export function warlockResourceSources(
  s: GameState,
  ports: Pick<WarlockPorts, "isTextBlank">,
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) => p.code === "21034" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Karmic Staff",
      resources: ["wild"],
      description: "Exhaust Karmic Staff · generate 1 wild resource",
      kind: "ability",
    }));
}
export function warlockResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<WarlockPorts, "isTextBlank">,
): boolean {
  const p = own(s, id, "21034");
  if (!p) return false;
  need(
    !p.exhausted && !ports.isTextBlank(s, p),
    "Karmic Staff is unavailable.",
  );
  p.exhausted = true;
  return true;
}

/** Capture sources at the actual empty-deck transition, even if a native reset
 * follows immediately. Empty observations and searches do not call this. */
export function warlockDeckExhausted(s: GameState): Effect[] {
  return s.player.inPlay
    .filter((p) => p.code === "21033" && !isTextBlank(s, p))
    .map((p) =>
      E("optional", {
        title: "Soul World",
        text: "Your deck ran out of cards. Place 1 soul counter?",
        effects: [W("soul-counter", { id: p.id })],
        image: p.code,
      }),
    );
}
/** Runs for EACH actual player's deck reset, from any draw/discard/search. */
export function warlockDeckReset(s: GameState): Effect[] {
  return s.sideSchemes
    .filter((p) => p.code === "21068" && !isTextBlank(s, p))
    .map((p) => W("church-reset", { id: p.id }));
}
export function warlockSchemeLocked(s: GameState, target: string): boolean {
  return (
    s.sideSchemes.some((p) => p.id === target && p.code === "21068") &&
    s.minions.some((p) => p.code === "21069" && !isTextBlank(s, p))
  );
}
export function warlockEnemyActivated(
  s: GameState,
  id: string,
  performed = true,
): Effect[] {
  const p = s.minions.find((p) => p.id === id && p.code === "21067");
  return performed && p && !isTextBlank(s, p) ? [W("magus", { id })] : [];
}

/** This is an ANY-player attacked interrupt, with no form or identity gate.
 * The owner generates both required icons; the physical ally enters the
 * originally attacked player's control before defender declaration. */
export function warlockAttackInitiatedOptions(
  s: GameState,
  initialPlayerId: string,
  after: Effect[],
  ports: WarlockPorts,
): Option[] {
  if (
    !s.players.some((seat) => seat.id === initialPlayerId && !seat.eliminated)
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "21032" &&
        ports.canPutAlly(s, p) &&
        ports.canPay(s, 2, ["energy", "mental"], p.id),
    )
    .map((p) =>
      option(
        p.id,
        "Pip the Troll · spend Energy + Mental and put into play",
        [
          E("payRequest", {
            title: "Pip the Troll · attack interrupt",
            cost: 2,
            requirements: ["energy", "mental"],
            piece: p,
            targetCode: p.code,
            abilityCost: true,
            cancelable: true,
            after: [
              W("pip", { id: p.id, targetPlayerId: initialPlayerId }),
              ...after,
            ],
          }),
        ],
        p.code,
      ),
    );
}
/** A forced interrupt precedes optional treachery cancellation. One physical
 * Ward cancels the reveal; an already canceled reveal cannot consume another. */
export function warlockForcedTreacheryInterrupt(
  s: GameState,
  p: Piece,
  ports: Pick<WarlockPorts, "isTextBlank" | "canCancelTreachery">,
  revealContext?: WarlockRevealContext,
): Effect[] | null {
  if (
    definition(p)?.type_code !== "treachery" ||
    !ports.canCancelTreachery(s, p)
  )
    return null;
  const ids = s.player.inPlay
    .filter((x) => x.code === "21036" && !ports.isTextBlank(s, x))
    .map((x) => x.id);
  return ids.length
    ? [W("ward-window", { piece: p, ids, revealContext })]
    : null;
}
export function warlockEncounterReveal(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "21066":
      return [W("obligation", { piece: p })];
    case "21070":
      return [W("inquisition")];
    case "21067":
    case "21068":
    case "21069":
      return [];
    default:
      return null;
  }
}
export function warlockBoost(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "21068") return [W("boost-church", { piece: p })];
  if (p.code === "21069") return [W("boost-zealot", { piece: p })];
  return null;
}

function chooseTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: WarlockPorts,
  after: Effect[] = [],
) {
  if (!targets.length) {
    ports.queue(s, ...after);
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) =>
      option(t.id, t.label, [{ ...effect, target: t.id }], t.code),
    ),
  );
}
function mageResponses(
  s: GameState,
  usedIds: string[],
  sourceIds: string[],
  ports: WarlockPorts,
): Option[] {
  if (s.player.form !== "hero") return [];
  const next = (id: string) =>
    W("mage-after", { usedIds: [...usedIds, id], sourceIds });
  return s.player.inPlay
    .filter(
      (p) =>
        sourceIds.includes(p.id) &&
        !usedIds.includes(p.id) &&
        !ports.isTextBlank(s, p),
    )
    .flatMap((p) => {
      if (p.code === "21037")
        return [
          option(
            p.id,
            "Mystic Senses · draw 1 card",
            [W("senses", { id: p.id }), next(p.id)],
            p.code,
          ),
        ];
      if (
        p.code === "21035" &&
        !p.exhausted &&
        s.player.exhausted &&
        ports.canReadyIdentity(s, s.activePlayerId)
      )
        return [
          option(
            p.id,
            "Warlock's Cape · exhaust to ready Adam Warlock",
            [W("cape", { id: p.id }), next(p.id)],
            p.code,
          ),
        ];
      return [];
    });
}

export function resolveWarlockEffect(
  s: GameState,
  e: Effect,
  ports: WarlockPorts,
): boolean {
  if (!e.type.startsWith("warlock:")) return false;
  switch (e.type) {
    case "warlock:reveal-setaside": {
      const zone = s.player.setAside || [],
        index = zone.findIndex((p) => p.id === e.id);
      if (index < 0 || !reservedNemesis(s).has(e.id)) break;
      const p = zone.splice(index, 1)[0];
      releaseNemesis(s, p.id);
      ports.queue(s, E("reveal", { piece: p, actorId: s.activePlayerId }));
      break;
    }
    case "warlock:shuffle-nemesis": {
      for (const id of e.ids || []) {
        const zone = s.player.setAside || [],
          index = zone.findIndex((p) => p.id === id);
        if (index >= 0 && reservedNemesis(s).has(id))
          s.encounter.deck.push(zone.splice(index, 1)[0]);
        releaseNemesis(s, id);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "warlock:mage":
      need(
        active(s) &&
          s.player.form === "hero" &&
          s.player.hand.length &&
          s.flags.warlockMagePhase !== phaseKey(s),
        "Battle Mage is unavailable.",
      );
      ports.choose(
        s,
        "Battle Mage",
        "Discard 1 actual card. Any card resolves Battle Mage, including Basic and identity cards.",
        s.player.hand.map((p) =>
          option(
            p.id,
            definition(p).name,
            [W("mage-discard", { id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    case "warlock:mage-discard": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        active(s) &&
          s.player.form === "hero" &&
          p &&
          s.flags.warlockMagePhase !== phaseKey(s),
        "Battle Mage requires its actual hand card and unused phase limit.",
      );
      const color = aspect(p!);
      const queuedBefore = s.queue.length;
      ports.discardHand(s, p!.id);
      const responses = s.queue.splice(0, s.queue.length - queuedBefore);
      s.flags.warlockMagePhase = phaseKey(s);
      ports.queue(s, ...responses, W("mage-effect", { aspect: color }));
      break;
    }
    case "warlock:mage-effect": {
      const after = [W("mage-after", { usedIds: [] })];
      if (e.aspect === "aggression")
        chooseTarget(
          s,
          "Battle Mage · Aggression",
          ports.enemyTargets(s, false),
          W("mage-damage"),
          ports,
          after,
        );
      else if (e.aspect === "justice")
        chooseTarget(
          s,
          "Battle Mage · Justice",
          ports.schemeTargets(s, false),
          W("mage-threat"),
          ports,
          after,
        );
      else if (e.aspect === "protection")
        chooseTarget(
          s,
          "Battle Mage · Protection",
          friendlyAllies(s)
            .filter((p) => p.damage > 0)
            .map((p) => ({
              id: p.id,
              label: definition(p).name,
              code: p.code,
            })),
          W("mage-heal"),
          ports,
          after,
        );
      else if (e.aspect === "leadership")
        chooseTarget(
          s,
          "Battle Mage · Leadership",
          heroTargets(s),
          W("mage-leadership"),
          ports,
          after,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "warlock:mage-damage":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Battle Mage's enemy is unavailable.",
      );
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 2,
          source: "hero",
          attack: false,
        }),
        W("mage-after", { usedIds: [] }),
      );
      break;
    case "warlock:mage-threat":
      need(
        ports.schemeTargets(s, false).some((t) => t.id === e.target),
        "Battle Mage's scheme is unavailable.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 2,
          source: "hero",
          action: false,
          ignoreCrisis: false,
        }),
        W("mage-after", { usedIds: [] }),
      );
      break;
    case "warlock:mage-heal":
      need(
        friendlyAllies(s).some((p) => p.id === e.target && p.damage > 0),
        "Battle Mage requires a damaged ally.",
      );
      ports.queue(
        s,
        E("heal", { target: e.target, amount: 1 }),
        W("mage-after", { usedIds: [] }),
      );
      break;
    case "warlock:mage-leadership": {
      const id = String(e.target).replace(/^hero:/, "");
      need(
        heroTargets(s).some((t) => t.id === e.target),
        "Battle Mage requires a hero.",
      );
      const flags = seatView(s, id).flags;
      const previous =
        Number(flags.warlockLeadershipRound) === s.round
          ? Number(flags.warlockLeadershipAmount || 0)
          : 0;
      flags.warlockLeadershipRound = s.round;
      flags.warlockLeadershipAmount = previous + 1;
      ports.queue(s, W("mage-after", { usedIds: [] }));
      break;
    }
    case "warlock:mage-after": {
      const sourceIds =
        e.sourceIds ||
        s.player.inPlay
          .filter((p) => ["21035", "21037"].includes(p.code))
          .map((p) => p.id);
      const choices = mageResponses(s, e.usedIds || [], sourceIds, ports);
      if (choices.length)
        ports.choose(
          s,
          "Battle Mage · responses",
          "Choose a response. Each physical Mystic Senses and Cape can respond once, in your chosen order.",
          [...choices, option("continue", "Finish Battle Mage", [])],
        );
      break;
    }
    case "warlock:senses": {
      const p = own(s, e.id, "21037");
      need(
        p && s.player.form === "hero" && !ports.isTextBlank(s, p),
        "Mystic Senses is unavailable.",
      );
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "warlock:cape": {
      const p = own(s, e.id, "21035");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "hero" &&
          s.player.exhausted &&
          ports.canReadyIdentity(s, s.activePlayerId),
        "Warlock's Cape is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "warlock:avatar":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.player.hand.length &&
          statuses.some((status) => statusCards(s.player, status)),
        "Avatar of Life requires a status and a hand card.",
      );
      ports.choose(
        s,
        "Avatar of Life",
        "Choose the actual card to discard.",
        s.player.hand.map((p) =>
          option(
            p.id,
            definition(p).name,
            [W("avatar-status", { id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    case "warlock:avatar-status":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.player.hand.some((p) => p.id === e.id),
        "Avatar of Life's discard card is unavailable.",
      );
      ports.choose(
        s,
        "Avatar of Life · status",
        "Remove 1 status card from Adam Warlock.",
        statuses
          .filter((status) => statusCards(s.player, status))
          .map((status) =>
            option(
              status,
              `Remove 1 ${status === "stunned" ? "Stun" : status === "confused" ? "Confused" : "Tough"} card`,
              [W("avatar-remove", { id: e.id, status })],
            ),
          ),
      );
      break;
    case "warlock:avatar-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.player.hand.some((p) => p.id === e.id) &&
          statuses.includes(e.status) &&
          statusCards(s.player, e.status) > 0,
        "Avatar of Life requires its actual cost and status.",
      );
      ports.discardHand(s, e.id);
      need(
        ports.removeIdentityStatusCard(s, e.status),
        "Avatar of Life must remove one actual status card.",
      );
      break;
    case "warlock:soul-counter": {
      const p = own(s, e.id, "21033");
      if (p && !ports.isTextBlank(s, p)) p.counters++;
      break;
    }
    case "warlock:soul-heal": {
      const p = own(s, e.id, "21033");
      need(
        p &&
          !p.exhausted &&
          p.counters > 0 &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "alter" &&
          s.player.hp < ports.heroMaxHP(s),
        "Soul World's alter-ego action is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      ports.queue(
        s,
        E("heal", { target: "hero", amount: ports.heroMaxHP(s) - s.player.hp }),
      );
      break;
    }
    case "warlock:spell-cost": {
      need(
        ["21038", "21039"].includes(e.piece?.code) && s.player.deck.length,
        "The event's additional cost requires a deck card.",
      );
      const max = Math.min(4, s.player.deck.length);
      ports.choose(
        s,
        `${definition(e.piece).name} · discard cost`,
        "Choose the count before revealing any top card. Discard these cards simultaneously.",
        Array.from({ length: max }, (_, n) =>
          option(
            String(n + 1),
            `Discard ${n + 1} card${n ? "s" : ""}`,
            [
              W("spell-discard", {
                ...e,
                type: "warlock:spell-discard",
                count: n + 1,
              }),
            ],
            e.piece.code,
          ),
        ),
      );
      break;
    }
    case "warlock:spell-discard": {
      need(
        Number.isInteger(e.count) &&
          e.count >= 1 &&
          e.count <= 4 &&
          s.player.deck.length >= e.count,
        "Choose 1–4 actual cards from the original deck.",
      );
      const queuedBefore = s.queue.length;
      const discarded = ports.discardPlayerCards(s, e.count);
      const responses = s.queue.splice(0, s.queue.length - queuedBefore);
      need(
        discarded.length === e.count,
        "The event must commit its full chosen discard cost.",
      );
      ports.queue(
        s,
        ...responses,
        W("spell-status-cost", {
          piece: e.piece,
          discarded,
          after: e.after || [],
        }),
      );
      break;
    }
    case "warlock:spell-status-cost": {
      const attack = e.piece.code === "21038";
      const replaced = attack ? s.player.stunned : s.player.confused;
      const after = (e.after || []).map((effect: Effect) => ({
        ...effect,
        warlockDiscarded: e.discarded,
        warlockDiscardCostPaid: true,
      }));
      if (!replaced) ports.queue(s, ...after);
      else
        chooseTarget(
          s,
          `${attack ? "Karmic Blast" : "Cosmic Awareness"} · initial cost`,
          attack ? ports.enemyTargets(s, false) : ports.schemeTargets(s, false),
          W("spell-initial-cost", { attack, after }),
          ports,
          after,
        );
      break;
    }
    case "warlock:spell-initial-cost":
      ports.queue(
        s,
        e.attack
          ? E("damage", {
              target: e.target,
              amount: 4,
              source: "hero",
              attack: false,
            })
          : E("thwart", {
              target: e.target,
              amount: 3,
              source: "hero",
              action: false,
              ignoreCrisis: false,
            }),
        ...(e.after || []),
      );
      break;
    case "warlock:spell-target": {
      const targets = e.attack
        ? ports.enemyTargets(s, true)
        : ports.schemeTargets(s, true);
      chooseTarget(
        s,
        e.attack ? "Karmic Blast" : "Cosmic Awareness",
        targets,
        W("spell-resolve", { ...e, type: "warlock:spell-resolve" }),
        ports,
      );
      break;
    }
    case "warlock:spell-resolve":
      if (e.attack) {
        need(
          ports.enemyTargets(s, true).some((t) => t.id === e.target),
          "Karmic Blast needs its legal attack target.",
        );
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount: 4 + e.bonus,
              source: "hero",
              attack: true,
              eventId: e.eventId,
            }),
          ],
          [],
        );
      } else {
        need(
          ports.schemeTargets(s, true).some((t) => t.id === e.target),
          "Cosmic Awareness needs its legal thwart target.",
        );
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: 3 + e.bonus,
            source: "hero",
            action: true,
            eventId: e.eventId,
          }),
        );
      }
      break;
    case "warlock:quantum":
      if (s.player.discard.length)
        ports.choose(
          s,
          "Quantum Magic",
          "Choose an actual discarded card to return to hand.",
          s.player.discard.map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("quantum-return", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    case "warlock:quantum-return": {
      const index = s.player.discard.findIndex((p) => p.id === e.id);
      need(index >= 0, "Quantum Magic's actual discarded card is missing.");
      s.player.hand.push(s.player.discard.splice(index, 1)[0]);
      break;
    }
    case "warlock:pip": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "21032");
      need(
        p &&
          ports.canPutAlly(s, p) &&
          s.players.some(
            (seat) => seat.id === e.targetPlayerId && !seat.eliminated,
          ),
        "Pip's physical card or attacked player is unavailable.",
      );
      ports.putAllyFromHand(s, p!.id, e.targetPlayerId);
      break;
    }
    case "warlock:ward-window": {
      const ids: string[] = e.ids.filter((id: string) => {
        const p = own(s, id, "21036");
        return p && !ports.isTextBlank(s, p);
      });
      need(
        ids.length && ports.canCancelTreachery(s, e.piece),
        "Cosmic Ward's forced cancellation is unavailable.",
      );
      if (ids.length === 1)
        ports.queue(
          s,
          W("ward", {
            id: ids[0],
            piece: e.piece,
            revealContext: e.revealContext,
          }),
        );
      else
        ports.choose(
          s,
          "Cosmic Ward · forced interrupt",
          "Choose the physical Cosmic Ward to discard after canceling this treachery.",
          ids.map((id) =>
            option(
              id,
              "Use this Cosmic Ward",
              [
                W("ward", {
                  id,
                  piece: e.piece,
                  revealContext: e.revealContext,
                }),
              ],
              "21036",
            ),
          ),
        );
      break;
    }
    case "warlock:ward": {
      const p = own(s, e.id, "21036");
      need(
        p && !ports.isTextBlank(s, p) && ports.canCancelTreachery(s, e.piece),
        "Cosmic Ward is unavailable.",
      );
      ports.cancelWhenRevealed(
        s,
        e.piece,
        [
          E("discardEncounter", { piece: e.piece }),
          W("ward-discard", { id: p!.id }),
        ],
        e.revealContext,
      );
      break;
    }
    case "warlock:ward-discard":
      if (own(s, e.id, "21036")) ports.discardPiece(s, e.id);
      break;
    case "warlock:church-reset":
      if (
        s.sideSchemes.some(
          (p) =>
            p.id === e.id && p.code === "21068" && !ports.isTextBlank(s, p),
        )
      ) {
        s.player.exhausted = true;
        ports.queue(s, E("status", { target: "hero", status: "stunned" }));
      }
      break;
    case "warlock:magus":
      if (
        s.minions.some(
          (p) =>
            p.id === e.id && p.code === "21067" && !ports.isTextBlank(s, p),
        )
      )
        ports.discardPlayerCards(s, 5);
      break;
    case "warlock:boost-church":
      ports.revealBoostCard(s, e.piece);
      break;
    case "warlock:boost-zealot":
      ports.putBoostMinion(s, e.piece, s.activePlayerId);
      break;
    case "warlock:inquisition":
      if (s.sideSchemes.some((p) => p.code === "21068"))
        ports.discardPlayerCards(s, 10);
      else ports.findAndRevealEncounter(s, "21068");
      break;
    case "warlock:obligation":
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Regeneration Cycle",
          "You may change to alter-ego form.",
          [
            option(
              "alter",
              "Change to alter-ego",
              [
                E("flip", { counts: false, target: "alter" }),
                W("obligation-choices", { piece: e.piece }),
              ],
              "21031b",
            ),
            option("stay", "Stay in hero form", [
              W("obligation-choices", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, W("obligation-choices", { piece: e.piece }));
      break;
    case "warlock:obligation-choices": {
      const choices = [
        option(
          "discard",
          "Discard top 5 cards; place threat for each different aspect",
          [W("obligation-discard", { piece: e.piece })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "exhaust",
            "Exhaust Adam Warlock and remove this obligation from the game",
            [W("obligation-exhaust", { piece: e.piece })],
            "21031b",
          ),
        );
      ports.choose(s, "Regeneration Cycle", "Choose an option.", choices);
      break;
    }
    case "warlock:obligation-exhaust":
      need(
        s.player.form === "alter" && !s.player.exhausted,
        "Regeneration Cycle requires ready alter-ego Adam Warlock.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "warlock:obligation-discard": {
      const queuedBefore = s.queue.length;
      const pieces = ports.discardPlayerCards(s, 5);
      const responses = s.queue.splice(0, s.queue.length - queuedBefore);
      ports.queue(
        s,
        ...responses,
        E("threat", { target: "main", amount: warlockDistinctAspects(pieces) }),
        E("discardEncounter", { piece: e.piece }),
      );
      break;
    }
    default:
      throw Error(`Unknown Adam Warlock effect: ${e.type}`);
  }
  return true;
}
