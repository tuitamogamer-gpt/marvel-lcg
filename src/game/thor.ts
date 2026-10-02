import catalog from "../data/catalog-cards.json";
import { allInPlay, controller, playerOrder, seatView } from "./team";
import { consumeStatus } from "./keywords";
import type { Card, Effect, GameState, Option, Piece, Resource } from "./types";
import type { PaymentSource } from "./payment";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const T = (name: string, args: Record<string, unknown> = {}) =>
  E("thor:" + name, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const active = (s: GameState) => s.heroId === "thor";
const definition = (p: Piece) => cards.get(p.code)!;
const hasTrait = (p: Piece, trait: string) =>
  (definition(p)?.traits || "").split(/\.\s*/).includes(trait);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const mjolnir = (s: GameState) =>
  s.player.inPlay.find((p) => p.code === "06009");
const phaseKey = (s: GameState) => String(s.round) + ":" + s.phase;
const readyAllies = (s: GameState) =>
  s.player.inPlay.filter(
    (p) => definition(p)?.type_code === "ally" && !p.exhausted,
  );
const readyWeapons = (s: GameState) =>
  s.player.inPlay.filter(
    (p) =>
      definition(p)?.type_code === "upgrade" &&
      hasTrait(p, "Weapon") &&
      !p.exhausted &&
      (!p.attachedTo ||
        p.attachedTo === "hero" ||
        p.attachedTo === "hero:" + s.activePlayerId),
  );
const recipientSeats = (s: GameState, p: Piece) =>
  playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (other) =>
          other.id !== p.id && definition(other)?.name === definition(p)?.name,
      ),
  );

/** Existing handlers own these exact reprints and already compiled whole texts. */
export const THOR_CORE_ALIASES = [
  "06013",
  "06016",
  "06022",
  "06023",
  "06024",
  "06025",
] as const;
export const THOR_COMPILED_CODES = [
  "06007",
  "06008",
  "06010",
  "06021",
] as const;
export const THOR_SCRIPT_CODES = [
  "06001a",
  "06001b",
  "06002",
  "06003",
  "06004",
  "06005",
  "06006",
  "06009",
  "06011",
  "06012",
  "06014",
  "06015",
  "06017",
  "06018",
  "06019",
  "06020",
  "06026",
  "06027",
  "06028",
  "06029",
  "06030",
  "06031",
  "06032",
  "06033",
  "06034",
] as const;
export const THOR_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface ThorEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(
    s: GameState,
    title: string,
    text: string,
    options: Option[],
    cancelable?: boolean,
  ): void;
  revealHidden(s: GameState): void;
  /** Includes all native/current identity sources, not just Mjolnir. */
  aerial(s: GameState): boolean;
  recycleEncounter(s: GameState): void;
  shufflePlayerDeck(s: GameState): void;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  returnUpgrade(s: GameState, id: string): void;
  /** Reset an emptied deck immediately; report that boundary so discard-until
   * never continues in the newly shuffled deck (RRG17). */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** Remove exact instance from encounter zones; run normal entry keywords,
   * Quickstrike, and engagement responses before the already queued continuation. */
  putMinion(s: GameState, p: Piece, playerId: string): void;
  /** Only transfers to a different player; do not re-run entry keywords. */
  engageMinion(s: GameState, id: string, playerId: string): void;
  mill(s: GameState, count: number): Piece[];
  /** Native form-changing restrictions apply to voluntary obligation flips too. */
  canChangeForm(s: GameState): boolean;
  flip(s: GameState, counts: boolean): void;
  identityMaxHP(s: GameState, playerId: string): number;
  allyPower(s: GameState, p: Piece, kind: "attack" | "thwart"): number;
  paymentSources(
    s: GameState,
    excludeId?: string,
    targetCode?: string,
  ): PaymentSource[];
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** Keep original ownership when moving the persistent control zone. */
  transferControl(s: GameState, id: string, playerId: string): void;
  log(s: GameState, text: string): void;
}

/** Asgard/Helmet/God of Thunder remain owned by existing generic scripts. */
export function thorStats(s: GameState) {
  const equipped = active(s) && s.player.form === "hero" && !!mjolnir(s);
  return { atk: equipped ? 1 : 0, aerial: equipped };
}
export function thorAllyDiscount(s: GameState, c: Card) {
  return c.code === "06011"
    ? s.minions.filter(
        (p) => !p.engagedWith || p.engagedWith === s.activePlayerId,
      ).length
    : 0;
}
export function thorSchemeLimitModifier(s: GameState) {
  return (
    allInPlay(s).filter(
      (p) =>
        p.code === "06031" &&
        (p.attachedTo === "main" || p.attachedTo === "main:" + s.scheme.code),
    ).length * 4
  );
}
/** Discard before replacing the old main-scheme card (RRG27). */
export function thorMainSchemeAdvances(s: GameState): Effect[] {
  return allInPlay(s)
    .filter(
      (p) =>
        p.code === "06031" &&
        (p.attachedTo === "main" || p.attachedTo === "main:" + s.scheme.code),
    )
    .map((p) => E("discardPiece", { id: p.id }));
}
export function thorPlayRestriction(
  s: GameState,
  p: Piece,
  ports?: Pick<ThorEnginePorts, "identityMaxHP" | "canPay">,
): string | null {
  if (["06015", "06032"].includes(p.code))
    return "Play this card during your basic power's interrupt window.";
  if (p.code === "06005" && (!mjolnir(s) || mjolnir(s)!.exhausted))
    return "Hammer Throw requires a ready Mjolnir.";
  if (p.code === "06014" && !s.minions.length && !s.player.stunned)
    return "There is no minion to attack.";
  if (p.code === "06018" && !recipientSeats(s, p).length)
    return "Each player already controls Battle Fury.";
  if (
    p.code === "06031" &&
    allInPlay(s).some(
      (p) =>
        p.code === "06031" &&
        (p.attachedTo === "main" || p.attachedTo === "main:" + s.scheme.code),
    )
  )
    return "The main scheme already has Under Surveillance.";
  if (
    p.code === "06033" &&
    ports &&
    !playerOrder(s).some(
      (seat) => seatView(s, seat).player.hp < ports.identityMaxHP(s, seat.id),
    )
  )
    return "No identity can be healed.";
  return null;
}

/** One atomic payment: choose X BEFORE spending printed cost. Pass lightningX
 * through native play/event. Typed icons pay X; base accepts any resource. */
export function thorLightningPaymentOptions(
  s: GameState,
  p: Piece,
  baseCost: number,
  ports: Pick<ThorEnginePorts, "paymentSources" | "canPay" | "aerial">,
): Option[] {
  if (p.code !== "06006") return [];
  const max = ports
    .paymentSources(s, p.id, p.code)
    .reduce((sum, source) => sum + source.resources.length, 0);
  const changes =
    ports.aerial(s) ||
    [
      s.villain,
      ...s.minions.filter(
        (p) => !p.engagedWith || p.engagedWith === s.activePlayerId,
      ),
    ].some((p) => !p.tough);
  if (!changes) return [];
  const result: Option[] = [];
  for (let x = 1; x <= max; x++) {
    const requirements: Resource[] = Array(x).fill("energy");
    if (ports.canPay(s, baseCost + x, requirements, p.id, p.code))
      result.push(
        option(
          String(x),
          "X = " + x + " · " + x + " energy + " + baseCost + " card cost",
          [
            E("payRequest", {
              title: "Lightning Strike",
              cost: baseCost + x,
              requirements,
              piece: p,
              targetCode: p.code,
              cancelable: true,
              after: [E("play", { piece: p, lightningX: x })],
            }),
          ],
          p.code,
        ),
      );
  }
  return result;
}
export function thorEvent(
  s: GameState,
  p: Piece,
  paid: Resource[],
  lightningX?: number,
): Effect[] | null {
  switch (p.code) {
    case "06003":
      return [T("defender")];
    case "06004":
      return [T("search", { mode: "asgard" })];
    case "06005":
      return [T("hammer-cost")];
    case "06006":
      need(
        Number.isInteger(lightningX) &&
          Number(lightningX) > 0 &&
          paid.filter((r) => r === "energy").length >= Number(lightningX),
        "Lightning Strike requires an atomic X-energy payment.",
      );
      return [T("lightning", { amount: lightningX })];
    case "06014":
      return [
        E("target", {
          group: "minion",
          title: "Get Over Here!",
          action: T("get-over-here", { attack: true, source: "hero" }),
        }),
      ];
    case "06015":
    case "06032":
      throw Error("This event requires its basic power interrupt window.");
    case "06033":
      return [T("second-wind", { amount: paid.includes("mental") ? 5 : 4 })];
    default:
      return null;
  }
}
export function thorAllyEnter(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  const actorId = controller(s, p.id)?.id || s.activePlayerId;
  if (p.code === "06002") {
    const thor = s.players.find(
      (seat) => seat.heroId === "thor" && !seat.eliminated,
    );
    return thor && seatView(s, thor).player.exhausted
      ? [
          E("optional", {
            actorId,
            title: "Lady Sif",
            text: "Ready Thor or Odinson?",
            effects: [T("sif", { playerId: thor.id })],
          }),
        ]
      : [];
  }
  if (p.code === "06012")
    return s.minions.length
      ? [
          E("optional", {
            actorId,
            title: "Valkyrie",
            text:
              "Deal " +
              (paid.includes("energy") ? 3 : 2) +
              " damage to a minion?",
            effects: [
              E("target", {
                group: "minion",
                title: "Valkyrie",
                action: E("damage", {
                  amount: paid.includes("energy") ? 3 : 2,
                  source: p.id,
                }),
              }),
            ],
          }),
        ]
      : [];
  if (p.code === "06020")
    return s.encounter.deck.length
      ? [
          E("optional", {
            actorId,
            title: "Heimdall",
            text: "Look at the top 3 encounter cards, discard 1 and order the rest?",
            effects: [T("heimdall", { id: p.id })],
          }),
        ]
      : [];
  if (p.code === "06011") return [];
  return null;
}
export function thorCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "06017") p.counters = 0;
  if (p.code === "06034") p.counters = 3;
  if (p.code === "06031") p.attachedTo = "main:" + s.scheme.code;
  return p.code === "06018" ? [T("control", { id: p.id })] : [];
}
export function thorAbilityOptions(s: GameState, id: string): Option[] {
  if (id === "identity")
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.thorWorthyRound !== s.round
      ? [
          option(
            "worthy",
            "Worthy · search for Mjolnir",
            [T("worthy")],
            "06001b",
          ),
        ]
      : [];
  const p = own(s, id, "06017");
  return p && !p.exhausted && p.counters >= 3 && s.player.form === "alter"
    ? [
        option(
          "hall",
          "Hall of Heroes · spend 3 glory, draw 3",
          [T("hall-draw", { id })],
          p.code,
        ),
      ]
    : [];
}
export function thorAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = thorAbilityOptions(s, id);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function thorResourceSources(s: GameState): PaymentSource[] {
  return s.player.form !== "hero"
    ? []
    : s.player.inPlay
        .filter((p) => p.code === "06034" && !p.exhausted && p.counters > 0)
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Enhanced Physique",
          resources: ["physical"],
          kind: "ability",
          description: "Exhaust · spend 1 physical counter",
        }));
}
export function thorResourceSpent(s: GameState, p: Piece): Effect[] {
  if (p.code !== "06034") return [];
  need(
    s.player.form === "hero" && p.counters > 0 && !!own(s, p.id),
    "Enhanced Physique has no usable counter.",
  );
  p.counters--;
  return p.counters === 0 ? [E("discardPiece", { id: p.id })] : [];
}

/** Entry and transfers both engage. Same-seat transfer never re-engages.
 * Optional response consumes the phase limit only when accepted. */
export function thorEngagementResponses(
  s: GameState,
  p: Piece,
  previousPlayerId?: string,
  isNew = true,
): Effect[] {
  const seat = s.players.find(
    (seat) =>
      seat.id === p.engagedWith && seat.heroId === "thor" && !seat.eliminated,
  );
  if (!seat || (!isNew && previousPlayerId === seat.id)) return [];
  const view = seatView(s, seat);
  if (
    view.player.form !== "hero" ||
    view.flags.thorEngagedPhase === phaseKey(s) ||
    !["player", "villain"].includes(s.phase)
  )
    return [];
  return [
    E("optional", {
      actorId: seat.id,
      title: '"Have at thee!"',
      text: "Draw 2 cards after engaging this minion? Once per phase.",
      effects: [T("engaged", { actorId: seat.id, phase: phaseKey(s) })],
    }),
  ];
}
/** Once per real basic-power initiation; statuses replace the power first. */
export function thorBasicPowerWindow(
  s: GameState,
  packet: Effect,
  kind: "attack" | "thwart",
): Effect[] {
  return s.player.form !== "hero" ||
    (kind === "attack" ? s.player.stunned : s.player.confused)
    ? [packet]
    : [T("basic-window", { packet, kind })];
}
export interface ThorHeroAttackSnapshot {
  target: string;
  defeatedMinion: boolean;
  actorId: string;
}
/** Per attacked enemy, after an entire simultaneous attack batch. Never call for
 * Overkill secondary damage, which is not an attack on the villain (RRG31). */
export function thorAfterHeroAttack(
  s: GameState,
  attack: ThorHeroAttackSnapshot,
): Effect[] {
  const view = seatView(s, attack.actorId);
  if (
    !view.player.inPlay.some(
      (p) =>
        p.code === "06019" ||
        (p.code === "06018" && attack.defeatedMinion && view.player.exhausted),
    )
  )
    return [];
  return [T("after-attack", { attack, used: [], actorId: attack.actorId })];
}
/** RRG49: identity-attributed defeats only; allies/supports are not 'you'. */
export function thorMinionDefeated(
  s: GameState,
  sourceIsIdentity: boolean,
  actorId = s.activePlayerId,
): Effect[] {
  if (!sourceIsIdentity) return [];
  const view = seatView(s, actorId);
  return view.player.inPlay
    .filter((p) => p.code === "06017")
    .map((p) =>
      E("optional", {
        actorId,
        title: "Hall of Heroes",
        text: "Place 1 glory counter after your identity defeats a minion?",
        effects: [T("hall-counter", { id: p.id, actorId })],
      }),
    );
}
/** Synchronous before committing defeat/kill responses/Overkill. True replaces
 * defeat with healing; downstream must not award a kill or apply Overkill. */
export function thorPreventsDefeat(
  s: GameState,
  p: Piece,
  ports: Pick<ThorEnginePorts, "discardEncounterTop">,
): boolean {
  if (p.code !== "06028" || !s.minions.some((m) => m.id === p.id)) return false;
  const { piece } = ports.discardEncounterTop(s);
  if (piece && definition(piece).type_code === "treachery") {
    p.damage = 0;
    return true;
  }
  return false;
}
export function thorEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "06026": {
      const owner = s.players.find(
        (seat) => seat.heroId === "thor" && !seat.eliminated,
      );
      return owner ? [T("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "06027":
      return [E("threat", { target: p.id, amount: thorAsgardCards(s) })];
    case "06028":
    case "06029":
      return [];
    case "06030":
      return [T("trickster")];
    default:
      return null;
  }
}
export function thorAsgardCards(s: GameState): number {
  const identities = playerOrder(s).filter((seat) => {
    if (seat.heroId === "thor") return true;
    const view = seatView(s, seat);
    const c = [...cards.values()].find(
      (c) =>
        c.set_code === seat.heroId &&
        c.type_code === (view.player.form === "hero" ? "hero" : "alter_ego"),
    );
    return (c?.traits || "").split(/\.\s*/).includes("Asgard");
  }).length;
  return (
    identities +
    [
      s.villain,
      ...s.minions,
      ...s.attachments,
      ...s.sideSchemes,
      ...allInPlay(s),
    ].filter((p) => hasTrait(p, "Asgard")).length
  );
}
/** Printed boost icons stay native. The delayed boost stuns surviving damaged
 * recipients including Overkill's identity recipient, never during scheming. */
export function thorBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== "06029") return null;
  if (s.attack?.isVillain) s.attack.boostEffects.push(T("frost-boost"));
  return [];
}

function responseOptions(
  s: GameState,
  attack: ThorHeroAttackSnapshot,
  used: string[],
  ports: ThorEnginePorts,
): Option[] {
  const result: Option[] = [];
  for (const p of s.player.inPlay) {
    if (used.includes(p.id)) continue;
    if (p.code === "06018" && attack.defeatedMinion && s.player.exhausted)
      result.push(
        option(
          p.id,
          "Battle Fury · deal 1 damage, discard and ready your hero",
          [T("fury", { id: p.id })],
          p.code,
        ),
      );
    if (
      p.code === "06019" &&
      ports.canPay(s, 1, ["physical"], undefined, p.code)
    )
      result.push(
        option(
          p.id,
          "Jarnbjorn · spend 1 physical, deal 2 damage to an enemy",
          [T("jarnbjorn", { id: p.id })],
          p.code,
        ),
      );
  }
  return result;
}
export function resolveThorEffect(
  s: GameState,
  e: Effect,
  ports: ThorEnginePorts,
): boolean {
  if (!e.type.startsWith("thor:")) return false;
  switch (e.type) {
    case "thor:worthy":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.thorWorthyRound !== s.round,
        "Worthy is unavailable this round.",
      );
      s.flags.thorWorthyRound = s.round;
      ports.queue(s, T("search", { mode: "mjolnir" }));
      break;
    case "thor:search": {
      need(s.player.form === "alter", "This search requires alter-ego form.");
      ports.revealHidden(s);
      const found = [...s.player.deck, ...s.player.discard].filter((p) =>
        e.mode === "mjolnir" ? p.code === "06009" : hasTrait(p, "Asgard"),
      );
      if (!found.length) {
        ports.shufflePlayerDeck(s);
        break;
      }
      ports.choose(
        s,
        e.mode === "mjolnir" ? "Worthy" : "For Asgard!",
        "Choose a matching card from your deck or discard pile. Shuffle your deck afterward.",
        found.map((p) =>
          option(
            p.id,
            definition(p).name,
            [T("search-found", { id: p.id, mode: e.mode })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "thor:search-found": {
      const zone = [s.player.deck, s.player.discard].find((zone) =>
        zone.some((p) => p.id === e.id),
      );
      const p = zone?.find((p) => p.id === e.id);
      need(
        p &&
          (e.mode === "mjolnir" ? p.code === "06009" : hasTrait(p, "Asgard")),
        "Search target is no longer eligible.",
      );
      s.player.hand.push(zone!.splice(zone!.indexOf(p!), 1)[0]);
      ports.shufflePlayerDeck(s);
      break;
    }
    case "thor:sif": {
      const seat = s.players.find(
        (seat) =>
          seat.id === e.playerId && seat.heroId === "thor" && !seat.eliminated,
      );
      if (seat)
        ports.queue(s, E("ready", { target: "hero", actorId: seat.id }));
      break;
    }
    case "thor:engaged":
      if (
        active(s) &&
        s.player.form === "hero" &&
        s.flags.thorEngagedPhase !== e.phase &&
        phaseKey(s) === e.phase
      ) {
        s.flags.thorEngagedPhase = e.phase;
        ports.queue(s, E("draw", { amount: 2 }));
      }
      break;
    case "thor:defender": {
      let found: Piece | undefined;
      while (s.encounter.deck.length) {
        const next = ports.discardEncounterTop(s);
        if (next.piece && definition(next.piece).type_code === "minion") {
          found = next.piece;
          break;
        }
        if (!next.piece || next.emptied) break;
      }
      if (!found) {
        ports.log(
          s,
          "Defender of the Nine Realms found no minion; its engagement cost was not paid.",
        );
        break;
      }
      ports.queue(
        s,
        E("target", {
          group: "scheme",
          title: "Defender of the Nine Realms",
          action: E("thwart", {
            amount: 3,
            action: true,
            source: "hero",
            thwartInitiated: true,
          }),
        }),
      );
      ports.putMinion(s, found, s.activePlayerId);
      break;
    }
    case "thor:hammer-cost": {
      const p = mjolnir(s);
      need(p && !p.exhausted, "Hammer Throw must exhaust a ready Mjolnir.");
      p!.exhausted = true;
      if (s.player.stunned) {
        consumeStatus(s.player, "stunned");
        break;
      }
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Hammer Throw",
          action: T("hammer-hit", { id: p!.id, attack: true, source: "hero" }),
        }),
      );
      break;
    }
    case "thor:hammer-hit":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 8,
          attack: true,
          overkill: true,
          source: "hero",
        }),
        T("return-hammer", { id: e.id }),
      );
      break;
    case "thor:return-hammer":
      if (own(s, e.id, "06009")) ports.returnUpgrade(s, e.id);
      break;
    case "thor:lightning": {
      need(
        Number.isInteger(e.amount) && e.amount > 0,
        "Lightning Strike requires a positive X.",
      );
      const targets = [
        s.villain,
        ...s.minions.filter(
          (p) => !p.engagedWith || p.engagedWith === s.activePlayerId,
        ),
      ];
      ports.queue(
        s,
        ...targets.map((p) =>
          E("damage", {
            target: p.id,
            amount: e.amount,
            source: "hero",
            attack: false,
            ignoreTough: ports.aerial(s),
          }),
        ),
      );
      break;
    }
    case "thor:get-over-here":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 1,
          attack: true,
          source: "hero",
        }),
        T("engage-target", { target: e.target, aerial: ports.aerial(s) }),
      );
      break;
    case "thor:engage-target":
      if (e.aerial && s.minions.some((p) => p.id === e.target))
        ports.engageMinion(s, e.target, s.activePlayerId);
      break;
    case "thor:second-wind":
      ports.choose(
        s,
        "Second Wind",
        "Choose an identity to heal " + e.amount + " damage.",
        playerOrder(s)
          .filter(
            (seat) =>
              seatView(s, seat).player.hp < ports.identityMaxHP(s, seat.id),
          )
          .map((seat) =>
            option(
              seat.id,
              seat.heroId,
              [
                E("heal", {
                  target: "hero",
                  amount: e.amount,
                  actorId: seat.id,
                }),
              ],
              [...cards.values()].find(
                (c) => c.set_code === seat.heroId && c.type_code === "hero",
              )?.code,
            ),
          ),
      );
      break;
    case "thor:hall-counter": {
      const p = own(s, e.id, "06017");
      if (p) p.counters++;
      break;
    }
    case "thor:hall-draw": {
      const p = own(s, e.id, "06017");
      need(
        p && !p.exhausted && p.counters >= 3 && s.player.form === "alter",
        "Hall of Heroes requires alter-ego form, ready state and 3 glory.",
      );
      p!.exhausted = true;
      p!.counters -= 3;
      ports.queue(s, E("draw", { amount: 3 }));
      break;
    }
    case "thor:basic-window": {
      if (
        s.player.form !== "hero" ||
        (e.kind === "attack" ? s.player.stunned : s.player.confused)
      ) {
        ports.queue(s, e.packet);
        break;
      }
      const playable: Option[] = [];
      for (const p of s.player.hand) {
        if (p.code === "06015" && e.kind === "attack" && readyWeapons(s).length)
          playable.push(
            option(
              p.id,
              "Mean Swing · exhaust a Weapon for +3 ATK",
              [T("basic-cost", { id: p.id, kind: e.kind, packet: e.packet })],
              p.code,
            ),
          );
        if (
          p.code === "06032" &&
          readyAllies(s).some((ally) => ports.allyPower(s, ally, e.kind) > 0)
        )
          playable.push(
            option(
              p.id,
              "Teamwork · exhaust an ally and add its power",
              [T("basic-cost", { id: p.id, kind: e.kind, packet: e.packet })],
              p.code,
            ),
          );
      }
      if (!playable.length) ports.queue(s, e.packet);
      else
        ports.choose(
          s,
          "Basic power interrupts",
          "Use an interrupt, or continue with this basic power.",
          [...playable, option("continue", "Continue", [e.packet])],
        );
      break;
    }
    case "thor:basic-cost": {
      const p = s.player.hand.find(
        (p) => p.id === e.id && ["06015", "06032"].includes(p.code),
      );
      need(p, "Basic-power interrupt is no longer in hand.");
      const eligible =
        p!.code === "06015"
          ? readyWeapons(s)
          : readyAllies(s).filter(
              (ally) => ports.allyPower(s, ally, e.kind) > 0,
            );
      need(eligible.length, "This interrupt has no ready cost source.");
      ports.choose(
        s,
        definition(p!).name,
        p!.code === "06015"
          ? "Choose a Weapon upgrade on your hero to exhaust."
          : "Choose an ally you control to exhaust. It takes no consequential damage.",
        eligible.map((source) =>
          option(
            source.id,
            definition(source).name,
            [
              T("basic-paid", {
                id: p!.id,
                sourceId: source.id,
                kind: e.kind,
                packet: e.packet,
              }),
            ],
            source.code,
          ),
        ),
      );
      break;
    }
    case "thor:basic-paid": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && ["06015", "06032"].includes(p.code),
        "Basic-power interrupt is no longer in hand.",
      );
      const source = (
        p!.code === "06015"
          ? readyWeapons(s)
          : readyAllies(s).filter(
              (ally) => ports.allyPower(s, ally, e.kind) > 0,
            )
      ).find((p) => p.id === e.sourceId);
      need(
        source && (p!.code !== "06015" || e.kind === "attack"),
        "The interrupt's additional cost cannot be paid.",
      );
      const amount =
        p!.code === "06015" ? 3 : ports.allyPower(s, source!, e.kind);
      source!.exhausted = true;
      const packet = {
        ...e.packet,
        amount: Number(e.packet.amount || 0) + amount,
      };
      ports.queue(
        s,
        E("resolveHandEvent", {
          id: p!.id,
          after: [],
          continuation: [T("basic-window", { packet, kind: e.kind })],
        }),
      );
      break;
    }
    case "thor:after-attack": {
      const options = responseOptions(s, e.attack, e.used || [], ports);
      if (!options.length) break;
      ports.choose(
        s,
        "After your hero attacks",
        "Choose a response or continue. Each instance responds once to this enemy attack.",
        [
          ...options.map((o) => ({
            ...o,
            effects: [
              ...o.effects,
              T("after-attack", {
                attack: e.attack,
                used: [...(e.used || []), o.id],
                actorId: e.attack.actorId,
              }),
            ],
          })),
          option("continue", "Continue", []),
        ],
      );
      break;
    }
    case "thor:fury": {
      const p = own(s, e.id, "06018");
      need(
        p && s.player.exhausted,
        "Battle Fury is no longer able to ready your hero.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("damage", { target: "hero", amount: 1, source: p!.id }),
        E("ready", { target: "hero" }),
      );
      break;
    }
    case "thor:jarnbjorn": {
      const p = own(s, e.id, "06019");
      need(
        p && ports.canPay(s, 1, ["physical"], undefined, p.code),
        "Jarnbjorn requires a physical resource.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Jarnbjorn",
          cost: 1,
          requirements: ["physical"],
          targetCode: p!.code,
          cancelable: false,
          after: [
            E("target", {
              group: "enemy",
              title: "Jarnbjorn",
              action: E("damage", { amount: 2, source: p!.id }),
            }),
          ],
        }),
      );
      break;
    }
    case "thor:control": {
      const p = own(s, e.id, "06018");
      need(p, "Battle Fury is no longer in play.");
      ports.choose(
        s,
        "Battle Fury",
        "Choose a player to control this upgrade. Maximum one per player.",
        recipientSeats(s, p!).map((seat) =>
          option(
            seat.id,
            seat.heroId,
            [T("control-to", { id: p!.id, playerId: seat.id })],
            p!.code,
          ),
        ),
      );
      break;
    }
    case "thor:control-to": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "06018");
      need(
        p && recipientSeats(s, p).some((seat) => seat.id === e.playerId),
        "The recipient already controls Battle Fury.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "thor:heimdall": {
      if (!own(s, e.id, "06020")) break;
      ports.revealHidden(s);
      const top = s.encounter.deck.slice(0, 3);
      if (!top.length) break;
      ports.choose(
        s,
        "Heimdall · discard",
        "Choose one of these top encounter cards to discard.",
        top.map((p) =>
          option(
            p.id,
            definition(p).name,
            [T("heimdall-discard", { id: p.id, top: top.map((p) => p.id) })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "thor:heimdall-discard": {
      const top = s.encounter.deck.slice(0, e.top.length);
      need(
        top.map((p) => p.id).join() === e.top.join() &&
          top.some((p) => p.id === e.id),
        "Heimdall's preview is stale.",
      );
      const index = s.encounter.deck.findIndex((p) => p.id === e.id);
      const p = s.encounter.deck.splice(index, 1)[0];
      s.encounter.discard.push(p);
      const remaining = top.filter((p) => p.id !== e.id);
      ports.recycleEncounter(s);
      if (remaining.length === 2)
        ports.choose(
          s,
          "Heimdall · order",
          "Choose which remaining card goes on top; the other goes second.",
          remaining.map((p) =>
            option(
              p.id,
              definition(p).name,
              [
                T("heimdall-order", {
                  first: p.id,
                  ids: remaining.map((p) => p.id),
                }),
              ],
              p.code,
            ),
          ),
        );
      break;
    }
    case "thor:heimdall-order": {
      const top = s.encounter.deck.slice(0, e.ids.length);
      need(
        e.ids.length === 2 &&
          top.every((p) => e.ids.includes(p.id)) &&
          e.ids.includes(e.first),
        "Heimdall's remaining cards changed.",
      );
      s.encounter.deck.splice(
        0,
        2,
        top.find((p) => p.id === e.first)!,
        top.find((p) => p.id !== e.first)!,
      );
      break;
    }
    case "thor:obligation":
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Odin's Anger",
          "You may change to Odinson before choosing this obligation's effect.",
          [
            option("flip", "Change to Odinson", [
              T("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay as Thor", [
              T("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, T("obligation-choice", { piece: e.piece }));
      break;
    case "thor:obligation-flip":
      need(
        s.player.form === "hero" && ports.canChangeForm(s),
        "This identity cannot change to Odinson.",
      );
      ports.flip(s, false);
      ports.queue(s, T("obligation-choice", { piece: e.piece }));
      break;
    case "thor:obligation-choice": {
      const options: Option[] = [];
      if (s.player.form === "alter" && !s.player.exhausted)
        options.push(
          option("exhaust", "Exhaust Odinson and remove this obligation", [
            E("exhaust", { id: "hero" }),
            E("removeEncounter", { piece: e.piece }),
          ]),
        );
      const hammers = [...s.player.hand, ...s.player.inPlay].filter(
        (p) => p.code === "06009",
      );
      if (hammers.length)
        options.push(
          option("discard", "Discard Mjolnir and become stunned", [
            T("obligation-discard", { piece: e.piece }),
          ]),
        );
      if (!options.length) {
        ports.log(s, "Odin's Anger has no legal target for either choice.");
        ports.queue(s, E("discardEncounter", { piece: e.piece }));
      } else
        ports.choose(
          s,
          "Odin's Anger",
          "Choose an available obligation effect.",
          options,
        );
      break;
    }
    case "thor:obligation-discard": {
      const hammer = [...s.player.hand, ...s.player.inPlay].find(
        (p) => p.code === "06009",
      );
      need(hammer, "Odin's Anger requires Mjolnir in hand or play.");
      if (s.player.hand.some((p) => p.id === hammer!.id))
        ports.discardHand(s, hammer!.id);
      else ports.discardPiece(s, hammer!.id);
      ports.queue(
        s,
        E("status", { target: "hero", status: "stunned" }),
        E("discardEncounter", { piece: e.piece }),
      );
      break;
    }
    case "thor:trickster": {
      const discarded = ports.mill(s, 3);
      const amount = new Set(discarded.map((p) => definition(p).type_code))
        .size;
      ports.queue(s, E("threat", { target: "main", amount }));
      break;
    }
    case "thor:frost-boost": {
      const a = s.attack;
      if (!a?.isVillain) break;
      const target =
        a.defender && a.defender !== "none"
          ? a.defender
          : a.originalTarget || "hero";
      const targets: string[] = [];
      if (a.damage > 0) targets.push(target);
      if (target !== "hero" && Number(a.identityDamage || 0) > 0)
        targets.push("hero");
      ports.queue(
        s,
        ...targets.map((target) => E("status", { target, status: "stunned" })),
      );
      break;
    }
    default:
      throw Error("Unregistered Thor effect: " + e.type);
  }
  return true;
}
