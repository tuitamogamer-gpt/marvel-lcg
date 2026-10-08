import { printedCardMetadata } from "./printed-card-metadata.js";
import { defenseEventSources, isTextBlank } from "./card-text.js";
import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { uniqueConflict } from "./unique.js";
import { goblinIdentityLocked } from "./goblin-modules.js";
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
  (importedCards as unknown as Card[]).map((card) => [
    card.code,
    printedCardMetadata(card),
  ]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const M = (type: string, args: Record<string, unknown> = {}) =>
  E("ms:" + type, args);
const active = (s: GameState) => s.heroId === "ms_marvel";
const trait = (code: string, name: string) =>
  (cards.get(code)?.traits || "").split(/\.\s*/).includes(name);
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const ownPiece = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const eventKey = (kind: string, id: string) => `msEvent:${kind}:${id}`;
const robotKey = (id: string) => `msRobotBlank:${id}`;
const mayDefend = (s: GameState) => {
  const a = s.attack;
  if (!a?.defender || a.defender === "none") return true;
  const defendingPlayer =
    a.targetPlayerId ||
    (a.defender === "hero"
      ? a.originalPlayerId || s.activePlayerId
      : controller(s, a.defender)?.id);
  return defendingPlayer === s.activePlayerId;
};

/** Source: printed retail faces and the current official rules/FAQ. The six
 * exact reprints retain native Core handlers. No face is executed twice. */
export const MS_MARVEL_CORE_ALIASES = [
  "05013",
  "05016",
  "05019",
  "05020",
  "05021",
  "05022",
] as const;
export const MS_MARVEL_SCRIPT_CODES = [
  "05001a",
  "05001b",
  "05002",
  "05003",
  "05004",
  "05005",
  "05006",
  "05007",
  "05008",
  "05009",
  "05010",
  "05011",
  "05012",
  "05014",
  "05015",
  "05017",
  "05018",
  "05023",
  "05024",
  "05025",
  "05026",
  "05027",
  "05028",
  "05029",
  "05030",
  "05031",
  "05032",
  "05033",
] as const;
export const MS_MARVEL_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const MS_MARVEL_DEFENSE_SOURCE =
  "https://www.fantasyflightgames.com/en/news/2021/5/18/rules-reference-debrief/";

export interface MsMarvelDamageWindow {
  target: string;
  amount: number;
  attack?: boolean;
  /** Host-owned non-attack packet. ms:prevent-damage mutates this amount. The
   * supplied continuation resumes it after this interrupt fully resolves. */
  packet?: Effect;
}
export interface MsMarvelPorts {
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
  discardPiece(s: GameState, id: string): void;
  /** Discard actual physical cards and recycle the exhausted deck normally;
   * never continue discarding from the newly shuffled deck (RRG Player Deck). */
  discardTop(s: GameState, playerId: string, count: number): Piece[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
  ): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    piece?: Piece,
    targetCode?: string,
  ): void;
  /** Validate all selected sources before paying. Wild resources may represent
   * different types individually; Bio-Suit cannot pay for this ally ability. */
  canPayDifferentTypes(
    s: GameState,
    count: number,
    targetCode: string,
  ): boolean;
  payDifferentTypes(
    s: GameState,
    title: string,
    count: number,
    after: Effect[],
    targetCode: string,
  ): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Return only this actual completed event from its owner's discard pile
   * (or resolving during a native transition), retaining its original ID. */
  returnEvent(s: GameState, id: string): void;
  /** Return the actual ally to its owner's hand, clearing damage/status and
   * discarding attachments, without firing a defeat response. */
  returnAlly(s: GameState, id: string): void;
  /** Cancel this face's numeric boost icons only, retaining boost-star effects.
   * Return the number cancelled; defense-event targeting belongs to the host. */
  cancelBoost(s: GameState, id: string): number;
  /** Forced obligation flips run form-change responses without using the
   * player's voluntary once-per-round flip allowance. */
  flip(s: GameState, counts: boolean): void;
}

/** Each damage/removal packet inherits the physical source event ID. Never
 * apply this to prevention, enemy attacks, retaliate, or additional damage. */
export function msMarvelEventAmountModifier(
  s: GameState,
  eventId: string | undefined,
  kind: "damage" | "thwart",
  additional = false,
): number {
  return eventId && !additional
    ? Number(s.flags[eventKey(kind, eventId)] || 0)
    : 0;
}
export function msMarvelBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  if (!active(s) || s.player.form !== "hero") return after;
  const matches = s.player.inPlay.filter(
    (u) =>
      !u.exhausted &&
      ((u.code === "05010" && trait(p.code, "Attack")) ||
        (u.code === "05011" &&
          trait(p.code, "Thwart") &&
          /\bremove\b[^.!?]*\bthreat\b/i.test(cards.get(p.code)?.text || ""))),
  );
  return matches.length
    ? [
        M("event-interrupt", {
          event: p,
          upgrades: matches.map((u) => u.id),
          after,
        }),
      ]
    : after;
}
/** Invoke after the whole event resolves and is discarded. The
 * same physical piece is returned, including a cancelled but played event. */
export function msMarvelAfterEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  const cleanup = M("event-cleanup", { eventId: p.id, after });
  return active(s) &&
    s.player.form === "hero" &&
    !s.player.exhausted &&
    ["Attack", "Thwart", "Defense"].some((name) => trait(p.code, name)) &&
    [...s.resolving, ...s.player.discard].some((event) => event.id === p.id)
    ? [
        E("optional", {
          title: "Morphogenetics",
          text: `Exhaust Ms. Marvel to return ${cards.get(p.code)?.name} to your hand?`,
          effects: [M("return-event", { id: p.id })],
        }),
        cleanup,
      ]
    : [cleanup];
}

export function msMarvelStats(s: GameState) {
  const morale =
    s.flags.msMoraleRound === s.round && s.player.form === "hero"
      ? Number(s.flags.msMoraleAmount || 0)
      : 0;
  return {
    atk: morale,
    thw: morale,
    def: morale,
    health: s.player.inPlay.filter((p) => p.code === "05023").length * 3,
    recover:
      s.player.form === "alter"
        ? s.player.inPlay.filter((p) => p.code === "05033").length * 2
        : 0,
  };
}
export function msMarvelDiscount(s: GameState): number {
  return Number(s.flags.msNakiaDiscount || 0);
}
export function msMarvelCardPlayed(s: GameState) {
  delete s.flags.msNakiaDiscount;
}
export function msMarvelPhaseEnded(s: GameState) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.msNakiaDiscount;
    for (const key of Object.keys(flags))
      if (key.startsWith("msRobotBlank:")) delete flags[key];
  }
}
export function msMarvelRoundEnded(s: GameState) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.msMoraleRound;
    delete flags.msMoraleAmount;
  }
}

const recipients = (s: GameState, p: Piece) =>
  playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (other) =>
          other.id !== p.id &&
          cards.get(other.code)?.name === cards.get(p.code)?.name,
      ),
  );
export function msMarvelPlayRestriction(s: GameState, p: Piece): string | null {
  if (p.code === "05005")
    return "Available when your identity would take damage.";
  if (p.code === "05014")
    return "Available when a villain attack boost card is turned face up.";
  if (["05023", "05033"].includes(p.code) && !recipients(s, p).length)
    return "Each player already controls this upgrade.";
  if (
    p.code === "05032" &&
    !playerOrder(s).some((seat) => seatView(s, seat).player.form === "hero")
  )
    return "Choose an identity in hero form.";
  return null;
}
export function msMarvelEvent(
  s: GameState,
  p: Piece,
  paid: Resource[],
): Effect[] | null {
  switch (p.code) {
    case "05003":
      return [
        E("target", {
          group: "enemy",
          action: E("damage", { amount: 4, attack: true, source: "hero" }),
        }),
      ];
    case "05004":
      return [
        E("target", {
          group: "scheme",
          action: E("thwart", { amount: 3, action: true, source: "hero" }),
        }),
      ];
    case "05005":
    case "05014":
      return []; // Their native interrupt windows supply effects.
    case "05015":
    case "05031":
      return [
        E("target", {
          group: "enemy",
          action: M("status-strike", {
            attack: true,
            source: "hero",
            status: p.code === "05015" ? "stunned" : "confused",
            physical: paid.includes("physical"),
            eventId: p.id,
          }),
        }),
      ];
    case "05030":
      return [
        E("target", {
          group: "enemy",
          title: "Melee · first enemy",
          action: M("melee-first", {
            attack: true,
            source: "hero",
            eventId: p.id,
          }),
        }),
      ];
    case "05032":
      return [M("morale-choice")];
    default:
      return null;
  }
}
export function msMarvelAllyEnter(s: GameState, p: Piece): Effect[] | null {
  return ["05002", "05012", "05018"].includes(p.code) ? [] : null;
}
export function msMarvelCardEntered(s: GameState, p: Piece): Effect[] {
  if (["05017", "05024"].includes(p.code)) p.counters = 3;
  if (["05023", "05033"].includes(p.code))
    return [M("recipient", { id: p.id })];
  return [];
}

export function msMarvelAbilityOptions(s: GameState, id: string): Option[] {
  if (id === "identity")
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.msTeenSpiritRound !== s.round &&
      s.player.deck.length > 0
      ? [
          option(
            "teen-spirit",
            "Teen Spirit · find a Ms. Marvel card",
            [M("teen-spirit")],
            "05001b",
          ),
        ]
      : [];
  const p = ownPiece(s, id);
  if (p && !p.exhausted) {
    if (
      p.code === "05006" &&
      s.player.form === "alter" &&
      s.player.discard.length
    )
      return [
        option(
          "aamir",
          "Aamir Khan · recycle a card and draw 1",
          [M("aamir-choice", { id })],
          p.code,
        ),
      ];
    if (p.code === "05007")
      return [
        ...(s.player.form === "alter" && s.player.hand.length
          ? [
              option(
                "bruno-store",
                "Bruno · store 1 facedown card",
                [M("bruno-store-choice", { id })],
                p.code,
              ),
            ]
          : []),
        ...(p.storedCards?.length
          ? [
              option(
                "bruno-retrieve",
                "Bruno · retrieve up to 3 stored cards",
                [M("bruno-retrieve-choice", { id })],
                p.code,
              ),
            ]
          : []),
      ];
    if (p.code === "05008" && s.player.form === "alter")
      return [
        option(
          "nakia",
          "Nakia Bahadir · reduce the next card cost by 1",
          [M("nakia", { id })],
          p.code,
        ),
      ];
  }
  const robot = s.minions.find((p) => p.id === id && p.code === "05028");
  return robot && s.player.form === "hero" && !msMarvelRobotBlank(s, id)
    ? [
        option(
          "robot-blank",
          "Spend 1 mental · blank the Robot for this phase",
          [M("robot-cost", { id })],
          robot.code,
        ),
      ]
    : [];
}
export function msMarvelAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const options = msMarvelAbilityOptions(s, id);
  return (
    (
      options.find((o) => o.id === action) ||
      (options.length === 1 && !action ? options[0] : undefined)
    )?.effects || null
  );
}
export function msMarvelResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (s.player.form !== "hero") return [];
  return s.player.inPlay
    .filter(
      (p) =>
        !p.exhausted &&
        ((p.code === "05009" &&
          cards.get(targetCode || "")?.type_code === "event") ||
          (p.code === "05024" && p.counters > 0)),
    )
    .map((p) => ({
      id: p.id,
      name: cards.get(p.code)!.name,
      code: p.code,
      resources: [p.code === "05009" ? "wild" : "energy"],
      kind: "ability",
      description:
        p.code === "05009"
          ? "Exhaust · generate 1 wild resource for an event"
          : `Exhaust · spend 1 of ${p.counters} energy counters${p.counters === 1 ? " · then discard" : ""}`,
    }));
}
export function msMarvelResourceSpent(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== "05009" && p.code !== "05024") return null;
  need(
    !p.exhausted && s.player.form === "hero",
    "This hero resource is unavailable.",
  );
  if (p.code === "05024")
    need(p.counters > 0, "Enhanced Reflexes has no counters.");
  p.exhausted = true;
  return p.code === "05024" && --p.counters === 0
    ? [E("discardPiece", { id: p.id })]
    : [];
}

/** Host applies mandatory Tough first and excludes used interrupt IDs from each
 * single damage occurrence. Energy Barrier protects its controller's identity
 * in either form; Wiggle Room is a hero interrupt and does not protect allies. */
export function msMarvelDamageOptions(
  s: GameState,
  window: MsMarvelDamageWindow,
  after: Effect[],
  ports: MsMarvelPorts,
): Option[] {
  if (
    window.amount <= 0 ||
    s.player.tough ||
    !["hero", `hero:${s.activePlayerId}`].includes(window.target)
  )
    return [];
  return [
    ...(s.player.form === "hero" && mayDefend(s)
      ? defenseEventSources(s)
          .filter(
            (p) =>
              p.code === "05005" &&
              ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
          )
          .map((p) =>
            option(
              p.id,
              "Wiggle Room · prevent 3 damage and draw 1",
              [M("wiggle-cost", { id: p.id, window, after })],
              p.code,
            ),
          )
      : []),
    ...s.player.inPlay
      .filter((p) => p.code === "05017" && p.counters > 0 && !isTextBlank(s, p))
      .map((p) =>
        option(
          p.id,
          "Energy Barrier · prevent 1 damage and deal 1 to an enemy",
          [M("barrier", { id: p.id, window, after })],
          p.code,
        ),
      ),
  ];
}
export function msMarvelAttackInitiatedOptions(
  s: GameState,
  attacker: Piece,
  after: Effect[],
  ports: MsMarvelPorts,
): Option[] {
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "05012" && ports.canPay(s, 1, undefined, p.code, ["energy"]),
    )
    .map((p) =>
      option(
        p.id,
        "Nova · spend 1 energy to deal 2 damage to the attacker",
        [M("nova-cost", { id: p.id, attackerId: attacker.id, after })],
        p.code,
      ),
    );
}
export function msMarvelBoostOptions(
  s: GameState,
  boost: Piece,
  after: Effect[],
  ports: MsMarvelPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !mayDefend(s) ||
    !s.attack?.isVillain ||
    Number(cards.get(boost.code)?.boost || 0) === 0
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "05014" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Preemptive Strike · cancel numeric boost icons and damage the villain",
        [M("preemptive-cost", { id: p.id, boostId: boost.id, after })],
        p.code,
      ),
    );
}
/** after resumes the enclosing attack/effect, excluding the actual ally defeat.
 * Declining the host replacement still performs that native defeat first. */
export function msMarvelRedDaggerOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: MsMarvelPorts,
): Option[] {
  const owner = controller(s, p.id);
  if (p.code !== "05002" || !owner || owner.eliminated) return [];
  const view = seatView(s, owner);
  return ports.canPayDifferentTypes(view, 2, p.code)
    ? [
        option(
          p.id,
          "Red Dagger · spend 2 different resource types to deal 2 and return him",
          [M("red-cost", { id: p.id, actorId: owner.id, after })],
          p.code,
        ),
      ]
    : [];
}
export function msMarvelDiscardPlayable(s: GameState, p: Piece): boolean {
  return (
    p.code === "05018" &&
    s.phase === "player" &&
    s.turnPlayerId === s.activePlayerId &&
    s.player.discard.some((card) => card.id === p.id) &&
    !uniqueConflict(s, cards.get(p.code)!)
  );
}
export function msMarvelRobotBlank(s: GameState, id: string): boolean {
  return s.players.some((seat) => !!seatView(s, seat).flags[robotKey(id)]);
}
export function msMarvelDamageImmune(s: GameState, id: string): boolean {
  const p = s.minions.find((p) => p.id === id);
  if (!p) return false;
  if (p.code === "05028") return !msMarvelRobotBlank(s, p.id);
  return (
    p.code === "05027" &&
    s.minions.some(
      (other) =>
        other.id !== p.id &&
        (other.engagedWith || s.activePlayerId) ===
          (p.engagedWith || s.activePlayerId),
    )
  );
}
export function msMarvelEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "05025") {
    const owner = playerOrder(s).find((seat) => seat.heroId === "ms_marvel");
    return owner ? [M("obligation", { piece: p, actorId: owner.id })] : [];
  }
  if (p.code === "05026") {
    const count = allInPlay(s).filter(
      (p) =>
        cards.get(p.code)?.type_code === "ally" ||
        (cards.get(p.code)?.type_code === "support" &&
          trait(p.code, "Persona")),
    ).length;
    return playerOrder(s).map((seat) =>
      M("generation", { count, actorId: seat.id }),
    );
  }
  if (p.code === "05029") return [M("harvest")];
  if (["05027", "05028"].includes(p.code)) return []; // Passive immunity/Robot action above; no boost-star text.
  return null;
}

function selected(
  pieces: Piece[],
  ids: string[],
  min: number,
  max: number,
): Piece[] {
  need(
    Array.isArray(ids) &&
      ids.length >= min &&
      ids.length <= max &&
      new Set(ids).size === ids.length,
    `Choose ${min === max ? min : `${min}–${max}`} different cards.`,
  );
  const found = ids.map((id) => pieces.find((p) => p.id === id));
  need(found.every(Boolean), "A selected card is no longer in this zone.");
  return found as Piece[];
}
const prevent = (window: MsMarvelDamageWindow, amount: number) =>
  M("prevent-damage", { amount, packet: window.packet });
const attackTargets = (s: GameState) => [
  ...(!s.minions.some(
    (p) =>
      (!p.engagedWith || p.engagedWith === s.activePlayerId) &&
      /\bGuard\./.test(cards.get(p.code)?.text || ""),
  )
    ? [s.villain]
    : []),
  ...s.minions,
];
const identityName = (heroId: string) =>
  (importedCards as unknown as Card[]).find(
    (c) => c.type_code === "hero" && c.set_code === heroId,
  )?.name || heroId;

/** Prefix cases never silently succeed: unsupported ms: effects return false
 * so the host must handle ms:prevent-damage or report an unimplemented effect. */
export function resolveMsMarvelEffect(
  s: GameState,
  e: Effect,
  ports: MsMarvelPorts,
): boolean {
  if (!e.type.startsWith("ms:")) return false;
  switch (e.type) {
    case "ms:event-interrupt": {
      const [id, ...remaining] = e.upgrades as string[];
      const p = ownPiece(s, id);
      const follow = remaining.length
        ? [
            M("event-interrupt", {
              event: e.event,
              upgrades: remaining,
              after: e.after,
            }),
          ]
        : e.after;
      if (!p || p.exhausted || s.player.form !== "hero") {
        ports.queue(s, ...follow);
        break;
      }
      ports.choose(
        s,
        cards.get(p.code)!.name,
        `Exhaust ${cards.get(p.code)!.name} to increase this event's ${p.code === "05010" ? "damage" : "threat removal"} by 2?`,
        [
          option(
            "use",
            "Exhaust and increase each instance by 2",
            [M("event-boost", { id, eventId: e.event.id, after: follow })],
            p.code,
          ),
          option("skip", "Keep the upgrade ready", follow),
        ],
      );
      break;
    }
    case "ms:event-boost": {
      const p = ownPiece(s, e.id);
      need(
        active(s) &&
          s.player.form === "hero" &&
          p &&
          !p.exhausted &&
          ["05010", "05011"].includes(p.code),
        "This event interrupt is unavailable.",
      );
      p!.exhausted = true;
      const kind = p!.code === "05010" ? "damage" : "thwart";
      s.flags[eventKey(kind, e.eventId)] =
        Number(s.flags[eventKey(kind, e.eventId)] || 0) + 2;
      ports.queue(s, ...e.after);
      break;
    }
    case "ms:return-event":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          [...s.resolving, ...s.player.discard].some(
            (p) =>
              p.id === e.id &&
              ["Attack", "Thwart", "Defense"].some((name) =>
                trait(p.code, name),
              ),
          ),
        "Morphogenetics is unavailable.",
      );
      s.player.exhausted = true;
      ports.returnEvent(s, e.id);
      break;
    case "ms:event-cleanup":
      delete s.flags[eventKey("damage", e.eventId)];
      delete s.flags[eventKey("thwart", e.eventId)];
      ports.queue(s, ...e.after);
      break;
    case "ms:teen-spirit": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.msTeenSpiritRound !== s.round &&
          s.player.deck.length,
        "Teen Spirit is unavailable.",
      );
      s.flags.msTeenSpiritRound = s.round;
      const limit = s.player.deck.length;
      for (let index = 0; index < limit; index++) {
        const [p] = ports.discardTop(s, s.activePlayerId, 1);
        if (!p) break;
        if (cards.get(p.code)?.set_code === "ms_marvel") {
          // The last discard can already be in a recycled deck. Recover exactly
          // that physical card from whichever native zone now owns it.
          const zone = [s.player.discard, s.player.deck].find((zone) =>
            zone.some((card) => card.id === p.id),
          );
          if (zone)
            s.player.hand.push(
              zone.splice(
                zone.findIndex((card) => card.id === p.id),
                1,
              )[0],
            );
          break;
        }
      }
      break;
    }
    case "ms:aamir-choice": {
      const p = ownPiece(s, e.id, "05006");
      need(
        p &&
          !p.exhausted &&
          s.player.form === "alter" &&
          s.player.discard.length,
        "Aamir Khan is unavailable.",
      );
      ports.choose(
        s,
        "Aamir Khan",
        "Choose a discard to put on the bottom of your deck, then draw 1.",
        s.player.discard.map((card) =>
          option(
            card.id,
            cards.get(card.code)!.name,
            [M("aamir", { id: p!.id, cardId: card.id })],
            card.code,
          ),
        ),
      );
      break;
    }
    case "ms:aamir": {
      const p = ownPiece(s, e.id, "05006");
      const index = s.player.discard.findIndex((card) => card.id === e.cardId);
      need(
        p && !p.exhausted && s.player.form === "alter" && index >= 0,
        "Aamir's chosen discard is unavailable.",
      );
      p!.exhausted = true;
      s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "ms:bruno-store-choice":
    case "ms:bruno-retrieve-choice": {
      const p = ownPiece(s, e.id, "05007");
      const storing = e.type === "ms:bruno-store-choice";
      need(
        p && !p.exhausted && (!storing || s.player.form === "alter"),
        "Bruno Carrelli is unavailable.",
      );
      const source = storing ? s.player.hand : p!.storedCards || [];
      need(source.length, "There are no eligible cards.");
      ports.select(
        s,
        "Bruno Carrelli",
        storing
          ? "Store one actual hand card facedown."
          : "Choose up to three stored cards to retrieve.",
        source,
        storing ? 1 : 0,
        storing ? 1 : Math.min(3, source.length),
        M(storing ? "bruno-store" : "bruno-retrieve", { id: p!.id }),
      );
      break;
    }
    case "ms:bruno-store":
    case "ms:bruno-retrieve": {
      const p = ownPiece(s, e.id, "05007");
      const storing = e.type === "ms:bruno-store";
      need(
        p && !p.exhausted && (!storing || s.player.form === "alter"),
        "Bruno Carrelli is unavailable.",
      );
      const source = storing ? s.player.hand : p!.storedCards || [];
      const chosen = selected(source, e.ids, storing ? 1 : 0, storing ? 1 : 3);
      p!.exhausted = true;
      p!.storedCards ||= [];
      for (const card of chosen) source.splice(source.indexOf(card), 1);
      (storing ? p!.storedCards : s.player.hand).push(...chosen);
      break;
    }
    case "ms:nakia": {
      const p = ownPiece(s, e.id, "05008");
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Nakia Bahadir is unavailable.",
      );
      p!.exhausted = true;
      s.flags.msNakiaDiscount = Number(s.flags.msNakiaDiscount || 0) + 1;
      break;
    }
    case "ms:recipient": {
      const p = ownPiece(s, e.id);
      if (!p) break;
      const seats = recipients(s, p);
      need(seats.length, "Each player already controls this upgrade.");
      if (seats.length === 1)
        ports.queue(s, M("transfer", { id: p.id, playerId: seats[0].id }));
      else
        ports.choose(
          s,
          cards.get(p.code)!.name,
          "Choose the player who will control this upgrade.",
          seats.map((seat) =>
            option(
              seat.id,
              identityName(seat.heroId),
              [M("transfer", { id: p.id, playerId: seat.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "ms:transfer": {
      const p = ownPiece(s, e.id);
      need(
        p && recipients(s, p).some((seat) => seat.id === e.playerId),
        "This recipient already controls that upgrade.",
      );
      ports.transferControl(s, e.id, e.playerId);
      break;
    }
    case "ms:status-strike":
      ports.queue(
        s,
        E("status", { target: e.target, status: e.status }),
        // The printed ability is still one attack when no physical resource
        // was spent; a zero packet retains Retaliate/after-attack timing without
        // inventing damage or allowing Embiggen to create a missing instance.
        E("damage", {
          target: e.target,
          amount: e.physical ? 3 : 0,
          attack: true,
          source: "hero",
          eventId: e.eventId,
          attackAlreadyInitiated: true,
        }),
      );
      break;
    case "ms:melee-first":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 3,
          attack: true,
          source: "hero",
          eventId: e.eventId,
          attackAlreadyInitiated: true,
        }),
        M("melee-second", { firstId: e.target, eventId: e.eventId }),
      );
      break;
    case "ms:melee-second":
      if (attackTargets(s).some((p) => p.id !== e.firstId))
        ports.queue(
          s,
          E("target", {
            group: "enemy",
            exclude: e.firstId,
            title: "Melee · another enemy",
            action: E("damage", {
              amount: 3,
              attack: true,
              source: "hero",
              eventId: e.eventId,
              attackAlreadyInitiated: true,
            }),
          }),
        );
      break;
    case "ms:morale-choice": {
      const seats = playerOrder(s).filter(
        (seat) => seatView(s, seat).player.form === "hero",
      );
      if (seats.length === 1)
        ports.queue(s, M("morale", { playerId: seats[0].id }));
      else
        ports.choose(
          s,
          "Morale Boost",
          "Choose a hero to gain +1 ATK, THW and DEF until the round ends.",
          seats.map((seat) =>
            option(
              seat.id,
              identityName(seat.heroId),
              [M("morale", { playerId: seat.id })],
              "05032",
            ),
          ),
        );
      break;
    }
    case "ms:morale": {
      const seat = playerOrder(s).find((seat) => seat.id === e.playerId);
      need(
        seat && seatView(s, seat).player.form === "hero",
        "Choose a hero in play.",
      );
      const flags = seatView(s, seat!).flags;
      flags.msMoraleAmount =
        (flags.msMoraleRound === s.round
          ? Number(flags.msMoraleAmount || 0)
          : 0) + 1;
      flags.msMoraleRound = s.round;
      break;
    }
    case "ms:wiggle-cost": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "05005",
      );
      need(
        p &&
          s.player.form === "hero" &&
          mayDefend(s) &&
          e.window.amount > 0 &&
          !s.player.tough,
        "Wiggle Room is unavailable.",
      );
      ports.pay(
        s,
        "Wiggle Room",
        ports.cardCost(s, p!),
        [],
        [
          E("resolveHandEvent", {
            id: p!.id,
            after: [prevent(e.window, 3), E("draw", { amount: 1 })],
            resume: e.after,
          }),
        ],
        p!,
        p!.code,
      );
      break;
    }
    case "ms:barrier": {
      const p = ownPiece(s, e.id, "05017");
      need(
        p &&
          !isTextBlank(s, p) &&
          p.counters > 0 &&
          e.window.amount > 0 &&
          !s.player.tough,
        "Energy Barrier is unavailable.",
      );
      p!.counters--;
      ports.queue(
        s,
        prevent(e.window, 1),
        E("target", {
          group: "enemy",
          title: "Energy Barrier",
          action: E("damage", { amount: 1, source: p!.id }),
        }),
        ...(p!.counters === 0 ? [E("discardPiece", { id: p!.id })] : []),
        ...e.after,
      );
      break;
    }
    case "ms:nova-cost": {
      const p = ownPiece(s, e.id, "05012");
      need(
        p && enemy(s, e.attackerId),
        "Nova or the attacker is no longer in play.",
      );
      ports.pay(
        s,
        "Nova",
        1,
        ["energy"],
        [
          E("damage", { target: e.attackerId, amount: 2, source: p!.id }),
          ...e.after,
        ],
        undefined,
        p!.code,
      );
      break;
    }
    case "ms:preemptive-cost": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "05014",
      );
      need(
        p && s.player.form === "hero" && mayDefend(s) && s.attack?.isVillain,
        "Preemptive Strike is unavailable.",
      );
      ports.pay(
        s,
        "Preemptive Strike",
        ports.cardCost(s, p!),
        [],
        [
          E("resolveHandEvent", {
            id: p!.id,
            after: [M("preemptive", { boostId: e.boostId })],
            resume: e.after,
          }),
        ],
        p!,
        p!.code,
      );
      break;
    }
    case "ms:preemptive": {
      const count = ports.cancelBoost(s, e.boostId);
      if (count > 0)
        ports.queue(
          s,
          E("damage", { target: s.villain.id, amount: count, source: "hero" }),
        );
      break;
    }
    case "ms:red-cost": {
      const p = ownPiece(s, e.id, "05002");
      need(p, "Red Dagger is no longer in play.");
      ports.payDifferentTypes(
        s,
        "Red Dagger",
        2,
        [
          E("target", {
            group: "enemy",
            title: "Red Dagger",
            action: E("damage", { amount: 2, source: p!.id }),
          }),
          M("red-return", { id: p!.id }),
          ...e.after,
        ],
        p!.code,
      );
      break;
    }
    case "ms:red-return":
      ports.returnAlly(s, e.id);
      break;
    case "ms:robot-cost":
      need(
        msMarvelAbilityOptions(s, e.id).some((o) => o.id === "robot-blank"),
        "The Robot action is unavailable.",
      );
      ports.pay(
        s,
        "Edison's Giant Robot",
        1,
        ["mental"],
        [M("robot-blank", { id: e.id })],
        undefined,
        "05028",
      );
      break;
    case "ms:robot-blank":
      if (s.minions.some((p) => p.id === e.id && p.code === "05028"))
        s.flags[robotKey(e.id)] = true;
      break;
    case "ms:generation":
      ports.discardTop(s, s.activePlayerId, e.count);
      break;
    case "ms:harvest": {
      const supports = allInPlay(s).filter(
        (p) =>
          !p.exhausted &&
          cards.get(p.code)?.type_code === "support" &&
          trait(p.code, "Persona"),
      );
      for (const p of supports) p.exhausted = true;
      ports.queue(
        s,
        ...(supports.length
          ? [E("heal", { target: s.villain.id, amount: supports.length })]
          : [E("surge")]),
      );
      break;
    }
    case "ms:obligation":
      if (s.player.form === "hero" && !goblinIdentityLocked(s))
        ports.choose(
          s,
          "Home by Dawn",
          "You may flip to Kamala Khan before choosing how to resolve the obligation.",
          [
            option("flip", "Flip to Kamala Khan", [
              M("obligation-flip"),
              M("obligation-choice", { piece: e.piece }),
            ]),
            option("stay", "Remain in hero form", [
              M("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, M("obligation-choice", { piece: e.piece }));
      break;
    case "ms:obligation-flip":
      ports.flip(s, false);
      break;
    case "ms:obligation-choice": {
      const supports = s.player.inPlay.filter(
        (p) =>
          cards.get(p.code)?.type_code === "support" &&
          trait(p.code, "Persona"),
      );
      ports.choose(s, "Home by Dawn", "Choose one obligation option.", [
        ...(s.player.form === "alter" && !s.player.exhausted
          ? [
              option(
                "exhaust",
                "Exhaust Kamala Khan · remove this obligation",
                [M("obligation-remove", { piece: e.piece })],
              ),
            ]
          : []),
        option(
          "discard",
          supports.length
            ? "Discard a Persona support"
            : "No Persona support · gain surge and discard obligation",
          [M("obligation-persona", { piece: e.piece })],
        ),
      ]);
      break;
    }
    case "ms:obligation-remove":
      need(
        active(s) && s.player.form === "alter" && !s.player.exhausted,
        "Kamala Khan cannot be exhausted now.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "ms:obligation-persona": {
      const supports = s.player.inPlay.filter(
        (p) =>
          cards.get(p.code)?.type_code === "support" &&
          trait(p.code, "Persona"),
      );
      if (!supports.length) ports.queue(s, E("surge"));
      else if (supports.length === 1) ports.discardPiece(s, supports[0].id);
      else
        ports.choose(
          s,
          "Home by Dawn",
          "Discard one Persona support you control.",
          supports.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [E("discardPiece", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    default:
      return false;
  }
  return true;
}
