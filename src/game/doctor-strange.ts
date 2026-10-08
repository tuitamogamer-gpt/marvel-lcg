import { printedCardMetadata } from "./printed-card-metadata.js";
import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import { goblinIdentityLocked } from "./goblin-modules.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [
    c.code,
    printedCardMetadata(c),
  ]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const D = (type: string, args: Record<string, unknown> = {}) =>
  E("ds:" + type, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "doctor_strange";
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const trait = (code: string, name: string) =>
  (cards.get(code)?.traits || "").split(/\.\s*/).includes(name);
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const statusNames = ["stunned", "confused", "tough"] as const;
type Status = (typeof statusNames)[number];

export const DOCTOR_STRANGE_CORE_ALIASES = [
  "09017",
  "09018",
  "09022",
  "09023",
  "09024",
  "09025",
] as const;
export const DOCTOR_STRANGE_INVOCATIONS = [
  "09032",
  "09033",
  "09034",
  "09035",
  "09036",
] as const;
export const DOCTOR_STRANGE_SCRIPT_CODES = [
  "09001a",
  "09001b",
  "09002",
  "09003",
  "09004",
  "09005",
  "09006",
  "09007",
  "09008",
  "09009",
  "09010",
  "09011",
  "09012",
  "09013",
  "09014",
  "09015",
  "09016",
  "09019",
  "09020",
  "09021",
  "09026",
  "09027",
  "09028",
  "09029",
  "09030",
  "09031",
  ...DOCTOR_STRANGE_INVOCATIONS,
  "09037",
  "09038",
  "09039",
] as const;
export const DOCTOR_STRANGE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const DOCTOR_STRANGE_INSERT_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc08_doctor_strange_rulesheet.pdf";
/** FFG-authored Alex rulings, dated September 15, 2025 (MotMA), May 10,
 * 2024 (Vapors), and October 21, 2024 (Counterspell), archived verbatim. */
export const DOCTOR_STRANGE_RULINGS_SOURCES = [
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/",
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/",
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/#28",
] as const;

export interface InvocationZones {
  invocationDeck?: Piece[];
  invocationDiscard?: Piece[];
}
const zones = (s: GameState): InvocationZones =>
  s.player as typeof s.player & InvocationZones;
export interface DoctorStrangeDamageWindow {
  target: string;
  playerId: string;
  amount: number;
  attack?: boolean;
  packet?: Effect;
}
export interface DoctorStrangeDefenseSnapshot {
  heroDefended: boolean;
  heroDamage: number;
  playerId: string;
}
export interface DoctorStrangePorts {
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
  makePiece(s: GameState, code: string): Piece;
  shuffle<T>(s: GameState, pieces: T[]): T[];
  revealHidden(s: GameState): void;
  discardPiece(s: GameState, id: string): void;
  discardTop(s: GameState, playerId: string, count: number): Piece[];
  /** Recycle an empty encounter deck normally, then LOOK without discarding.
   * Reveal/record this actual face to the player; the fair planner only knows
   * this face if its existing hidden-information contract permits it. */
  peekEncounter(s: GameState): Piece | undefined;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
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
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Remove the actual ally, discard its attachments, reset its in-play state,
   * and shuffle it into its OWNER'S normal deck. Never copy a face. */
  shuffleAllyIntoOwnerDeck(s: GameState, id: string): void;
  heroMaxHP(s: GameState, playerId: string): number;
  /** Remove exactly ONE physical status card, including one of Steady's two. */
  removeStatus(s: GameState, target: string, status: Status): void;
  canAddStatus(s: GameState, target: string, status: Status): boolean;
  /** Numeric boost icons only. Retain the boost ability/star and source piece. */
  cancelBoost(s: GameState, id: string, scheme?: boolean): number;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canChangeForm(s: GameState): boolean;
  flip(s: GameState, counts: boolean): void;
}

function identityCode(s: GameState, playerId: string) {
  const v = seatView(s, playerId);
  return (
    (importedCards as unknown as Card[]).find(
      (c) =>
        c.set_code === v.heroId &&
        c.type_code === (v.player.form === "hero" ? "hero" : "alter_ego"),
    )?.code || "09001a"
  );
}
function characters(s: GameState): Piece[] {
  return [
    ...playerOrder(s).map((p) => ({
      ...s.villain,
      id: `hero:${p.id}`,
      code: identityCode(s, p.id),
    })),
    s.villain,
    ...s.minions,
    ...allInPlay(s).filter((p) => cards.get(p.code)?.type_code === "ally"),
  ];
}
function character(
  s: GameState,
  id: string,
): Piece | GameState["player"] | undefined {
  if (id === "hero") return s.player;
  if (id.startsWith("hero:")) {
    const seat = s.players.find((p) => p.id === id.slice(5) && !p.eliminated);
    return seat ? seatView(s, seat).player : undefined;
  }
  return [s.villain, ...s.minions, ...allInPlay(s)].find((p) => p.id === id);
}
function statusCount(p: Piece | GameState["player"], status: Status) {
  return Number(
    (status === "stunned"
      ? p.stunCards
      : status === "confused"
        ? p.confuseCards
        : p.toughCards) ?? Number(p[status]),
  );
}
function schemes(s: GameState) {
  return [
    ...(s.scheme.threat > 0 &&
    !s.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
      ? [{ id: "main", code: s.scheme.code }]
      : []),
    ...s.sideSchemes
      .filter((p) => p.counters > 0)
      .map((p) => ({ id: p.id, code: p.code })),
  ];
}
function chooseScheme(
  s: GameState,
  title: string,
  action: Effect,
  ports: DoctorStrangePorts,
) {
  const targets = schemes(s);
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose a scheme.",
      targets.map((p) =>
        option(
          p.id,
          cards.get(p.code)?.name || "Main scheme",
          [{ ...action, target: p.id }],
          p.code,
        ),
      ),
    );
}
function invocationOwner(s: GameState) {
  return playerOrder(s).find((p) => p.heroId === "doctor_strange");
}
function resetInvocation(p: Piece): Piece {
  return {
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: false,
    stunned: false,
    confused: false,
  };
}
export function doctorStrangeTopInvocation(s: GameState): Piece | undefined {
  return zones(s).invocationDeck?.[0];
}
/** Wong may be controlled by another player (for example, Make the Call).
 * His reference to "the Invocation deck" still means Doctor Strange's deck,
 * while "your identity" means Wong's current controller. */
function wongInvocationView(s: GameState): GameState | undefined {
  const doctor = playerOrder(s).find(
    (seat) => seat.heroId === "doctor_strange",
  );
  return doctor ? seatView(s, doctor) : undefined;
}
/** Initialize before opening hands; the top is exposed only after mulligans. */
export function doctorStrangeSetup(s: GameState, ports: DoctorStrangePorts) {
  if (!active(s) || zones(s).invocationDeck) return;
  zones(s).invocationDeck = ports.shuffle(
    s,
    DOCTOR_STRANGE_INVOCATIONS.map((code) => ({
      ...ports.makePiece(s, code),
      ownerId: s.activePlayerId,
    })),
  );
  zones(s).invocationDiscard = [];
}
function recycleInvocations(
  s: GameState,
  ports: DoctorStrangePorts,
  playerId = s.activePlayerId,
) {
  const z = zones(seatView(s, playerId));
  if (!z.invocationDeck?.length && z.invocationDiscard?.length) {
    z.invocationDeck = ports.shuffle(s, z.invocationDiscard.splice(0));
    ports.revealHidden(s);
  }
}
function discardInvocation(
  s: GameState,
  id: string,
  ports: DoctorStrangePorts,
  playerId = s.activePlayerId,
) {
  need(
    doctorStrangeTopInvocation(seatView(s, playerId))?.id === id,
    "The selected Invocation is no longer on top of the deck.",
  );
  discardResolvedInvocation(s, id, ports, playerId);
}
/** A Special can defeat Open the Dark Dimension and shuffle this same physical
 * Invocation away from the top before its printed self-discard resolves. Its
 * initial top-card requirement was checked at invoke, before any effects ran. */
function discardResolvedInvocation(
  s: GameState,
  id: string,
  ports: DoctorStrangePorts,
  playerId = s.activePlayerId,
) {
  const z = zones(seatView(s, playerId)),
    index = z.invocationDeck?.findIndex((p) => p.id === id) ?? -1;
  need(
    index >= 0,
    "The resolving physical Invocation is no longer in its deck.",
  );
  const [p] = z.invocationDeck!.splice(index, 1);
  (z.invocationDiscard ||= []).push(resetInvocation(p));
  recycleInvocations(s, ports, playerId);
  if (z.invocationDeck?.[0]) ports.revealHidden(s);
}
/** Bind this physical ID in the PLAY/payment continuation, across JSON saves. */
export function doctorStrangeMasterInvocation(
  s: GameState,
  p: Piece,
): Piece | undefined {
  return p.code === "09005" && active(s) && s.player.form === "hero"
    ? doctorStrangeTopInvocation(s)
    : undefined;
}
export function doctorStrangeAdditionalPlayCost(
  s: GameState,
  p: Piece,
): number {
  return Number(
    cards.get(doctorStrangeMasterInvocation(s, p)?.code || "")?.cost || 0,
  );
}
function attached(s: GameState, code: string) {
  return s.attachments.filter(
    (p) =>
      p.code === code &&
      ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || ""),
  );
}
export function doctorStrangeCostModifier(s: GameState, c: Card) {
  return c.type_code === "event" ? attached(s, "09027").length * 3 : 0;
}
export function doctorStrangeCardPlayed(s: GameState, c: Card): Effect[] {
  return c.type_code === "event"
    ? attached(s, "09027").map((p) => E("discardPiece", { id: p.id }))
    : [];
}
/** Host invokes AFTER the native Stunned/Confused replacement has had priority.
 * Invocations merely resolve their Special; they never pass through this hook. */
export function doctorStrangeBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  const counter = attached(s, "09030")[0];
  return counter ? [E("discardPiece", { id: counter.id })] : after;
}
export function doctorStrangeStats(s: GameState) {
  const n =
    s.player.form === "hero"
      ? s.player.inPlay.filter((p) => p.code === "09010").length
      : 0;
  return { attack: n, thwart: n, defense: n };
}
export function doctorStrangeHandSize(s: GameState) {
  return s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "09026")
    ? 1
    : 0;
}
export function doctorStrangeTraits(s: GameState) {
  return s.player.inPlay.some((p) => p.code === "09009") ? ["Aerial"] : [];
}
export function doctorStrangeAttachedUpgradeDiscount(
  s: GameState,
  targetId: string,
) {
  return allInPlay(s).some((p) => p.id === targetId && p.code === "09039")
    ? 1
    : 0;
}
export function doctorStrangePhaseEnded(s: GameState) {
  for (const p of s.players) delete seatView(s, p).flags.dsNaturalTalent;
}
export function doctorStrangeRoundEnded(s: GameState): Effect[] {
  return allInPlay(s)
    .filter((p) => p.code === "09010")
    .map((p) => E("discardPiece", { id: p.id }));
}
export function doctorStrangePlayRestriction(
  s: GameState,
  p: Piece,
  ports?: Pick<DoctorStrangePorts, "heroMaxHP">,
): string | null {
  if (
    DOCTOR_STRANGE_INVOCATIONS.includes(
      p.code as (typeof DOCTOR_STRANGE_INVOCATIONS)[number],
    )
  )
    return "Invocation cards resolve only from their separate deck.";
  if (p.code === "09005" && !doctorStrangeTopInvocation(s))
    return "There is no Invocation on top of the deck.";
  if (
    p.code === "09016" &&
    ports &&
    ports.heroMaxHP(s, s.activePlayerId) - s.player.hp < 2
  )
    return "Momentum Shift requires healing 2 damage as its cost.";
  if (p.code === "09026" && !trait(identityCode(s, s.activePlayerId), "Mystic"))
    return "The Sorcerer Supreme requires the Mystic trait.";
  if (
    p.code === "09020" &&
    playerOrder(s).every((seat) =>
      seatView(s, seat).player.inPlay.some(
        (u) => cards.get(u.code)?.name === "Unflappable",
      ),
    )
  )
    return "Every player already controls Unflappable.";
  return null;
}

export function doctorStrangeEvent(
  s: GameState,
  p: Piece,
  _paid: Resource[] = [],
  masterInvocationId?: string,
): Effect[] | null {
  switch (p.code) {
    case "09003":
      return [D("astral-target", { eventId: p.id })];
    case "09004":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Magic Blast",
          action: D("blast", { eventId: p.id, attack: true }),
        }),
      ];
    case "09005":
      return [
        D("invoke", {
          id: masterInvocationId || doctorStrangeTopInvocation(s)?.id,
          master: true,
          paid: !!masterInvocationId,
        }),
      ];
    case "09006":
      return [D("studies")];
    case "09016":
      return [
        D("momentum-cost"),
        E("target", {
          group: "enemy",
          attack: true,
          title: "Momentum Shift",
          action: E("damage", {
            amount: 2,
            attack: true,
            source: "hero",
            eventId: p.id,
          }),
        }),
      ];
    default:
      return null;
  }
}
export function doctorStrangeAllyEnter(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "09012")
    return [
      E("optional", {
        title: "Brother Voodoo",
        text: "Search the top 5 cards of your deck for an event?",
        effects: [D("voodoo-search")],
      }),
    ];
  return ["09002", "09013", "09014", "09039"].includes(p.code) ? [] : null;
}
export function doctorStrangeCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "09014") p.counters = 2;
  if (p.code === "09019") p.counters = 3;
  return ["09010", "09020"].includes(p.code)
    ? [D("recipient", { id: p.id })]
    : [];
}
export function doctorStrangeAbilityOptions(
  s: GameState,
  id: string,
  ports?: Pick<DoctorStrangePorts, "heroMaxHP" | "canReadyIdentity">,
): Option[] {
  if (id === "identity") {
    if (!active(s)) return [];
    const top = doctorStrangeTopInvocation(s);
    if (s.player.form === "alter")
      return top && !s.flags.dsNaturalTalent
        ? [
            option(
              "natural",
              "Natural Talent · discard the top Invocation",
              [D("natural", { id: top.id })],
              "09001b",
            ),
          ]
        : [];
    return top && !s.player.exhausted
      ? [
          option(
            "spell",
            `Spell Mastery · ${cards.get(top.code)?.name} (${cards.get(top.code)?.cost || 0} resources)`,
            [D("spell-cost", { id: top.id })],
            top.code,
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (!p || p.exhausted) return [];
  const invocationView = p.code === "09002" && wongInvocationView(s);
  if (
    p.code === "09002" &&
    ((invocationView && doctorStrangeTopInvocation(invocationView)) ||
      (ports && s.player.hp < ports.heroMaxHP(s, s.activePlayerId)))
  )
    return [
      option(
        "wong",
        "Wong · heal 1 or discard the top Invocation",
        [D("wong-choice", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "09008" &&
    s.player.form === "alter" &&
    s.player.discard.some((p) => trait(p.code, "Spell"))
  )
    return [
      option(
        "sanctum",
        "Sanctum Sanctorum · shuffle a Spell into your deck and draw 1",
        [D("sanctum-choice", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "09009" &&
    active(s) &&
    s.player.form === "hero" &&
    s.player.exhausted &&
    (ports
      ? ports.canReadyIdentity(s, s.activePlayerId)
      : !goblinIdentityLocked(s))
  )
    return [
      option(
        "cloak",
        "Cloak of Levitation · ready Doctor Strange",
        [D("cloak", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "09019" &&
    p.counters > 0 &&
    ports &&
    playerOrder(s).some((seat) => {
      const view = seatView(s, seat);
      return (
        view.player.form === "hero" &&
        (view.player.hp < ports.heroMaxHP(s, seat.id) ||
          statusNames.some((status) => statusCount(view.player, status)))
      );
    })
  )
    return [
      option(
        "nurse",
        "The Night Nurse · heal a hero and discard 1 status card",
        [D("nurse-choice", { id })],
        p.code,
      ),
    ];
  return [];
}
export function doctorStrangeAbility(
  s: GameState,
  id: string,
  action?: string,
  ports?: Pick<DoctorStrangePorts, "heroMaxHP" | "canReadyIdentity">,
): Effect[] | null {
  const opts = doctorStrangeAbilityOptions(s, id, ports);
  if (opts.length) {
    const chosen = opts.find((o) => !action || o.id === action);
    need(chosen, "This Doctor Strange ability is unavailable.");
    return chosen!.effects;
  }
  if (
    (id === "identity" && active(s)) ||
    (own(s, id) &&
      ["09002", "09008", "09009", "09019"].includes(own(s, id)!.code))
  )
    throw Error("This Doctor Strange ability is unavailable.");
  return null;
}
export function doctorStrangeResourceSources(s: GameState): PaymentSource[] {
  return s.player.form === "hero"
    ? s.player.inPlay
        .filter((p) => p.code === "09011" && !p.exhausted)
        .map((p) => ({
          id: p.id,
          name: "The Eye of Agamotto",
          code: p.code,
          resources: ["wild"],
          description: "Exhaust · generate 1 wild resource",
          kind: "ability" as const,
        }))
    : [];
}
export function doctorStrangeResourceSpent(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code !== "09011") return null;
  need(
    own(s, p.id, "09011") && !p.exhausted && s.player.form === "hero",
    "The Eye of Agamotto is unavailable.",
  );
  p.exhausted = true;
  return [];
}
export function doctorStrangeBeforeAllyAttack(
  s: GameState,
  p: Piece,
  target: string,
  after: Effect[],
): Effect[] {
  return p.code === "09014" && p.counters > 0
    ? [
        E("optional", {
          title: "Iron Fist",
          text: "Remove 1 mystic counter to stun this enemy and deal 1 damage before the basic attack?",
          effects: [
            D("ironfist", {
              id: p.id,
              target,
              targetName: cards.get(enemy(s, target)?.code || "")?.name,
              after,
            }),
          ],
        }),
        D("ironfist-resume", {
          target,
          targetName: cards.get(enemy(s, target)?.code || "")?.name,
          after,
        }),
      ]
    : after;
}
export function doctorStrangeDefeatOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
): Option[] {
  const owner = controller(s, p.id);
  return p.code === "09013" && owner && !owner.eliminated
    ? [
        option(
          p.id,
          "Clea · shuffle her into her owner's deck",
          [D("clea", { id: p.id, actorId: owner.id, after })],
          p.code,
        ),
      ]
    : [];
}
export function doctorStrangeDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: DoctorStrangePorts,
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
        p.code === "09015" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Desperate Defense · +2 DEF and ready if this attack deals no damage",
        [D("defense-cost", { id: p.id, after })],
        p.code,
      ),
    );
}
export function doctorStrangeAfterDefense(
  s: GameState,
  snapshot: DoctorStrangeDefenseSnapshot,
): Effect[] {
  const effects: Effect[] = [];
  if (s.flags.dsDesperateDefense) {
    if (snapshot.heroDefended && snapshot.heroDamage === 0)
      effects.push(E("ready", { target: "hero" }));
    delete s.flags.dsDesperateDefense;
  }
  if (snapshot.heroDefended && snapshot.heroDamage === 0)
    for (const p of s.player.inPlay.filter(
      (p) => p.code === "09020" && !p.exhausted,
    ))
      effects.push(
        E("optional", {
          title: "Unflappable",
          text: "Exhaust Unflappable to draw 1 card?",
          effects: [E("exhaust", { id: p.id }), E("draw", { amount: 1 })],
        }),
      );
  return effects;
}
export function doctorStrangeDamageOptions(
  s: GameState,
  window: DoctorStrangeDamageWindow,
  after: Effect[],
  ports: DoctorStrangePorts,
): Option[] {
  const target = s.players.find(
    (p) => p.id === window.playerId && !p.eliminated,
  );
  const view = target ? seatView(s, target) : undefined;
  if (
    !view ||
    view.player.form !== "hero" ||
    view.player.tough ||
    window.amount <= 0 ||
    !["hero", `hero:${window.playerId}`].includes(window.target)
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "09021" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Warning · reduce this hero's damage by 1",
        [D("warning-cost", { id: p.id, window, after })],
        p.code,
      ),
    );
}
export function doctorStrangeSchemeBoostOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: DoctorStrangePorts,
): Option[] {
  if (!s.scheming || Number(cards.get(p.code)?.boost || 0) === 0) return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "09038" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((card) =>
      option(
        card.id,
        "Foiled! · cancel this scheme boost's numeric icons",
        [D("foiled-cost", { id: card.id, boostId: p.id, after })],
        card.code,
      ),
    );
}
export function doctorStrangeBasicAttackWindow(
  s: GameState,
  attack: Effect,
  ports: DoctorStrangePorts,
): Effect[] {
  if (!attack.basic || s.player.form !== "hero" || s.player.stunned)
    return [attack];
  const available = s.player.hand.filter(
    (p) =>
      p.code === "09037" && ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
  );
  return available.length
    ? [D("skilled-choice", { attack })]
    : [{ ...attack, strangeBasicHandled: true }];
}
export function doctorStrangeTreacheryOptions(
  s: GameState,
  p: Piece,
  ports: DoctorStrangePorts,
): Option[] {
  return s.player.form === "hero" &&
    cards.get(p.code)?.type_code === "treachery"
    ? s.player.hand
        .filter(
          (p) =>
            p.code === "09007" &&
            ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        )
        .map((ward) =>
          option(
            ward.id,
            "Protective Ward · cancel all effects and discard the treachery",
            [D("ward-cost", { id: ward.id, piece: p })],
            ward.code,
          ),
        )
    : [];
}
export function doctorStrangeEnemyAttackInitiated(
  _s: GameState,
  p: Piece,
): Effect[] {
  return p.code === "09028" ? [D("mordo", { playerId: p.engagedWith })] : [];
}
export function doctorStrangeEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "09027":
      return [D("obligation", { piece: p })];
    case "09028":
      return [];
    case "09029":
      return [D("dimension-capture", { id: p.id })];
    case "09030":
      return s.player.form === "hero"
        ? [D("counterspell-attach", { piece: p })]
        : [];
    case "09031":
      return [D("thoughtcasting")];
    default:
      return null;
  }
}
/** Call while the actual defeated side scheme still exists, BEFORE its generic
 * stored-card/attachment discard. The forced return has no optional choices. */
export function doctorStrangeSchemeDefeated(
  s: GameState,
  p: Piece,
  ports: DoctorStrangePorts,
) {
  if (p.code !== "09029") return;
  const held = p.storedCards?.splice(0) || [];
  for (const invocation of held) {
    const owner = s.players.find(
      (p) => p.id === invocation.ownerId && !p.eliminated,
    );
    if (!owner) {
      s.removed.push(resetInvocation(invocation));
      continue;
    }
    const view = seatView(s, owner),
      z = zones(view);
    z.invocationDeck = ports.shuffle(s, [
      ...(z.invocationDeck || []),
      resetInvocation(invocation),
    ]);
    ports.revealHidden(s);
  }
}

function invocationEffects(s: GameState, p: Piece): Effect[] {
  switch (p.code) {
    case "09032":
      return [
        E("target", {
          group: "enemy",
          title: "Crimson Bands of Cyttorak",
          action: E("scriptSequence", {
            effects: [
              E("status", { status: "stunned" }),
              E("damage", { amount: 7, source: "hero" }),
            ],
          }),
        }),
      ];
    case "09033":
      return [
        E("status", { target: s.villain.id, status: "confused" }),
        D("ikonn-target"),
      ];
    case "09034":
      return [D("rings-choice")];
    case "09035":
      return [D("vapors-choice")];
    case "09036":
      return [E("draw", { amount: 3 })];
    default:
      throw Error("Unknown Invocation card.");
  }
}
function eventPayment(
  s: GameState,
  p: Piece,
  title: string,
  effects: Effect[],
  resume: Effect[],
  ports: DoctorStrangePorts,
) {
  ports.pay(
    s,
    title,
    ports.cardCost(s, p),
    [],
    [E("resolveHandEvent", { id: p.id, after: effects, resume })],
    p,
    p.code,
  );
}
/** All queued decisions carry physical IDs and plain JSON data. Unknown and
 * host-owned effects return false; importing a face never asserts support. */
export function resolveDoctorStrangeEffect(
  s: GameState,
  e: Effect,
  ports: DoctorStrangePorts,
): boolean {
  switch (e.type) {
    case "ds:natural":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.flags.dsNaturalTalent &&
          doctorStrangeTopInvocation(s)?.id === e.id,
        "Natural Talent is unavailable.",
      );
      s.flags.dsNaturalTalent = true;
      discardInvocation(s, e.id, ports);
      break;
    case "ds:spell-cost": {
      const p = doctorStrangeTopInvocation(s);
      need(
        active(s) &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          p?.id === e.id,
        "Spell Mastery is unavailable.",
      );
      ports.pay(
        s,
        "Spell Mastery · " + cards.get(p!.code)!.name,
        Number(cards.get(p!.code)!.cost || 0),
        [],
        [D("spell-paid", { id: p!.id })],
        undefined,
        p!.code,
      );
      break;
    }
    case "ds:spell-paid":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          doctorStrangeTopInvocation(s)?.id === e.id,
        "The Invocation or identity changed before its costs were paid.",
      );
      s.player.exhausted = true;
      ports.queue(s, D("invoke", { id: e.id, paid: true }));
      break;
    case "ds:invoke": {
      const p = doctorStrangeTopInvocation(s);
      need(
        active(s) && s.player.form === "hero" && p?.id === e.id,
        "The paid Invocation is no longer on top of the deck.",
      );
      if (!e.paid) {
        ports.pay(
          s,
          "Invocation · " + cards.get(p!.code)!.name,
          Number(cards.get(p!.code)!.cost || 0),
          [],
          [D("invoke", { ...e, paid: true })],
          undefined,
          p!.code,
        );
        break;
      }
      ports.queue(
        s,
        ...invocationEffects(s, p!),
        D("invocation-finish", { id: p!.id, master: !!e.master }),
      );
      break;
    }
    case "ds:invocation-finish": {
      discardResolvedInvocation(s, e.id, ports);
      if (e.master) {
        const z = zones(s);
        const source = [z.invocationDiscard!, z.invocationDeck!].find((zone) =>
          zone.some((p) => p.id === e.id),
        );
        need(source, "The resolved Invocation is no longer available.");
        const [p] = source!.splice(
          source!.findIndex((p) => p.id === e.id),
          1,
        );
        z.invocationDeck!.unshift(p);
        ports.revealHidden(s);
      }
      break;
    }
    case "ds:ikonn-target":
      chooseScheme(
        s,
        "Images of Ikonn",
        E("thwart", { amount: 4, source: "invocation" }),
        ports,
      );
      break;
    case "ds:rings-choice": {
      const choices = characters(s).filter((p) =>
        ports.canAddStatus(s, p.id, "tough"),
      );
      if (choices.length)
        ports.select(
          s,
          "Seven Rings of Raggadorr",
          "Give a Tough status to up to 3 different characters.",
          choices,
          0,
          Math.min(3, choices.length),
          D("rings"),
        );
      break;
    }
    case "ds:rings": {
      const ids: string[] = e.ids || [];
      need(
        ids.length <= 3 &&
          new Set(ids).size === ids.length &&
          ids.every(
            (id) => !!character(s, id) && ports.canAddStatus(s, id, "tough"),
          ),
        "Choose up to 3 different eligible characters.",
      );
      ports.queue(
        s,
        ...ids.map((target) => E("status", { target, status: "tough" })),
      );
      break;
    }
    case "ds:vapors-choice": {
      const choices = characters(s).filter((p) => {
        const c = character(s, p.id)!;
        return statusNames.some(
          (old) =>
            statusCount(c, old) &&
            statusNames.some(
              (next) => next !== old && ports.canAddStatus(s, p.id, next),
            ),
        );
      });
      if (choices.length)
        ports.choose(
          s,
          "Vapors of Valtorr",
          "Choose a character whose status card will be replaced.",
          choices.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [D("vapors-status", { target: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "ds:vapors-status": {
      const p = character(s, e.target);
      need(p, "That character has left play.");
      const choices = statusNames.filter(
        (old) =>
          statusCount(p!, old) &&
          statusNames.some(
            (next) => next !== old && ports.canAddStatus(s, e.target, next),
          ),
      );
      if (choices.length === 1)
        ports.queue(
          s,
          D("vapors-replacement", { target: e.target, old: choices[0] }),
        );
      else
        ports.choose(
          s,
          "Vapors of Valtorr",
          "Choose ONE status card to replace.",
          choices.map((old) =>
            option(old, `Replace one ${old} status card`, [
              D("vapors-replacement", { target: e.target, old }),
            ]),
          ),
        );
      break;
    }
    case "ds:vapors-replacement": {
      const p = character(s, e.target);
      need(
        p && statusNames.includes(e.old) && statusCount(p!, e.old),
        "That status card is no longer present.",
      );
      ports.choose(
        s,
        "Vapors of Valtorr",
        "Choose a different legal status card.",
        statusNames
          .filter(
            (next) => next !== e.old && ports.canAddStatus(s, e.target, next),
          )
          .map((next) =>
            option(next, `Replace ${e.old} with ${next}`, [
              D("vapors", { target: e.target, old: e.old, status: next }),
            ]),
          ),
      );
      break;
    }
    case "ds:vapors": {
      const p = character(s, e.target);
      need(
        p &&
          statusNames.includes(e.old) &&
          statusCount(p!, e.old) &&
          e.status !== e.old &&
          ports.canAddStatus(s, e.target, e.status),
        "This status replacement is no longer legal.",
      );
      ports.removeStatus(s, e.target, e.old);
      ports.queue(s, E("status", { target: e.target, status: e.status }));
      break;
    }
    case "ds:wong-choice": {
      const p = own(s, e.id, "09002");
      need(p && !p.exhausted, "Wong is unavailable.");
      const invocationView = wongInvocationView(s),
        invocation =
          invocationView && doctorStrangeTopInvocation(invocationView);
      const opts = [
        ...(s.player.hp < ports.heroMaxHP(s, s.activePlayerId)
          ? [
              option("heal", "Heal 1 damage from your identity", [
                D("wong", { id: p!.id, heal: true }),
              ]),
            ]
          : []),
        ...(invocation
          ? [
              option("discard", "Discard the top Invocation", [
                D("wong", {
                  id: p!.id,
                  invocationId: invocation.id,
                  invocationPlayerId: invocationView!.activePlayerId,
                }),
              ]),
            ]
          : []),
      ];
      need(opts.length, "Wong has no eligible effect.");
      ports.choose(s, "Wong", "Choose Wong's action.", opts);
      break;
    }
    case "ds:wong": {
      const p = own(s, e.id, "09002"),
        invocationView = wongInvocationView(s);
      need(
        p &&
          !p.exhausted &&
          (e.heal
            ? s.player.hp < ports.heroMaxHP(s, s.activePlayerId)
            : invocationView &&
              invocationView.activePlayerId === e.invocationPlayerId &&
              doctorStrangeTopInvocation(invocationView)?.id ===
                e.invocationId),
        "Wong's selected action is unavailable.",
      );
      p!.exhausted = true;
      if (e.heal) ports.queue(s, E("heal", { target: "hero", amount: 1 }));
      else discardInvocation(s, e.invocationId, ports, e.invocationPlayerId);
      break;
    }
    case "ds:cloak": {
      const p = own(s, e.id, "09009");
      need(
        active(s) &&
          s.player.form === "hero" &&
          s.player.exhausted &&
          ports.canReadyIdentity(s, s.activePlayerId) &&
          p &&
          !p.exhausted,
        "Cloak of Levitation is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "ds:studies": {
      ports.revealHidden(s);
      const choices = [...s.player.deck, ...s.player.discard].filter(
        (p) => cards.get(p.code)?.set_code === "doctor_strange",
      );
      if (choices.length)
        ports.select(
          s,
          "Mystical Studies",
          "Search your deck and discard pile for a Doctor Strange card.",
          choices,
          s.player.discard.some(
            (p) => cards.get(p.code)?.set_code === "doctor_strange",
          )
            ? 1
            : 0,
          1,
          D("search-picked", { candidates: choices.map((p) => p.id) }),
        );
      else s.player.deck = ports.shuffle(s, s.player.deck);
      break;
    }
    case "ds:voodoo-search": {
      ports.revealHidden(s);
      const choices = s.player.deck
        .slice(0, 5)
        .filter((p) => cards.get(p.code)?.type_code === "event");
      if (choices.length)
        ports.select(
          s,
          "Brother Voodoo",
          "Search the top 5 cards for one event.",
          choices,
          0,
          1,
          D("search-picked", { candidates: choices.map((p) => p.id) }),
        );
      else s.player.deck = ports.shuffle(s, s.player.deck);
      break;
    }
    case "ds:search-picked": {
      const ids: string[] = e.ids || [];
      need(
        ids.length <= 1 && ids.every((id) => e.candidates.includes(id)),
        "Choose one card from the actual search area.",
      );
      if (ids.length) {
        const zone = [s.player.deck, s.player.discard].find((zone) =>
          zone.some((p) => p.id === ids[0]),
        );
        need(zone, "The searched card is no longer in its zone.");
        s.player.hand.push(
          ...zone!.splice(
            zone!.findIndex((p) => p.id === ids[0]),
            1,
          ),
        );
      }
      s.player.deck = ports.shuffle(s, s.player.deck);
      break;
    }
    case "ds:sanctum-choice": {
      const p = own(s, e.id, "09008");
      const choices = s.player.discard.filter((p) => trait(p.code, "Spell"));
      need(
        p && !p.exhausted && s.player.form === "alter" && choices.length,
        "Sanctum Sanctorum is unavailable.",
      );
      ports.select(
        s,
        "Sanctum Sanctorum",
        "Shuffle one Spell from your discard pile into your deck, then draw 1.",
        choices,
        1,
        1,
        D("sanctum", { id: p!.id }),
      );
      break;
    }
    case "ds:sanctum": {
      const p = own(s, e.id, "09008"),
        ids: string[] = e.ids || [],
        selected = s.player.discard.find(
          (p) => p.id === ids[0] && trait(p.code, "Spell"),
        );
      need(
        p &&
          !p.exhausted &&
          s.player.form === "alter" &&
          ids.length === 1 &&
          selected,
        "The selected Spell is unavailable.",
      );
      p!.exhausted = true;
      s.player.discard.splice(s.player.discard.indexOf(selected!), 1);
      s.player.deck = ports.shuffle(s, [...s.player.deck, selected!]);
      ports.revealHidden(s);
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "ds:astral-target":
      if (schemes(s).length)
        chooseScheme(
          s,
          "Astral Projection",
          D("astral", { eventId: e.eventId }),
          ports,
        );
      else ports.queue(s, D("astral", { eventId: e.eventId }));
      break;
    case "ds:astral": {
      // "Remove ... AND look" resolves simultaneously. Capture the actual
      // encounter face before a defeated scheme can mill/change that deck.
      const looked = ports.peekEncounter(s);
      ports.queue(
        s,
        ...(e.target
          ? [
              E("thwart", {
                target: e.target,
                amount: 3,
                source: "event",
                eventId: e.eventId,
              }),
            ]
          : []),
        D("astral-peek", {
          looked,
          target: e.target,
          code:
            e.target === "main"
              ? s.scheme.code
              : s.sideSchemes.find((p) => p.id === e.target)?.code,
          eventId: e.eventId,
        }),
      );
      break;
    }
    case "ds:astral-peek": {
      const p: Piece | undefined = e.looked;
      if (!p) break;
      const same =
        e.target === "main"
          ? s.scheme.code === e.code
          : s.sideSchemes.some((p) => p.id === e.target && p.code === e.code);
      const next =
        same && Number(cards.get(p.code)?.boost || 0)
          ? [
              E("thwart", {
                target: e.target,
                amount: Number(cards.get(p.code)?.boost || 0),
                source: "event",
                additional: true,
                eventId: e.eventId,
              }),
            ]
          : [];
      ports.choose(
        s,
        "Astral Projection · encounter card",
        `You looked at ${cards.get(p.code)!.name}: ${Number(cards.get(p.code)?.boost || 0)} numeric boost icons.`,
        [option("continue", "Continue", next, p.code)],
      );
      break;
    }
    case "ds:blast":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 5,
          attack: true,
          source: "hero",
          eventId: e.eventId,
          attackAlreadyInitiated: true,
        }),
        D("blast-discard", {
          target: e.target,
          name: cards.get(enemy(s, e.target)?.code || "")?.name,
          eventId: e.eventId,
        }),
      );
      break;
    case "ds:blast-discard": {
      const [p] = ports.discardTop(s, s.activePlayerId, 1),
        target = enemy(s, e.target);
      if (!p || !target || cards.get(target.code)?.name !== e.name) break;
      const c = cards.get(p.code)!,
        wild = Number(c.resource_wild || 0) > 0;
      ports.queue(
        s,
        ...(wild || Number(c.resource_physical || 0) > 0
          ? [E("status", { target: e.target, status: "stunned" })]
          : []),
        ...(wild || Number(c.resource_energy || 0) > 0
          ? [
              E("damage", {
                target: e.target,
                amount: 2,
                attack: true,
                source: "hero",
                eventId: e.eventId,
                attackAlreadyInitiated: true,
              }),
            ]
          : []),
        ...(wild || Number(c.resource_mental || 0) > 0
          ? [E("status", { target: e.target, status: "confused" })]
          : []),
      );
      break;
    }
    case "ds:momentum-cost":
      need(
        ports.heroMaxHP(s, s.activePlayerId) - s.player.hp >= 2,
        "Momentum Shift's full heal-2 cost cannot be paid.",
      );
      ports.queue(s, E("heal", { target: "hero", amount: 2 }));
      break;
    case "ds:recipient": {
      const p = own(s, e.id);
      if (!p) break;
      const seats = playerOrder(s).filter(
        (seat) =>
          p!.code !== "09020" ||
          !seatView(s, seat).player.inPlay.some(
            (u) => u.id !== p!.id && cards.get(u.code)?.name === "Unflappable",
          ),
      );
      need(seats.length, "Every player already controls Unflappable.");
      if (seats.length === 1)
        ports.queue(s, D("transfer", { id: p!.id, playerId: seats[0].id }));
      else
        ports.choose(
          s,
          cards.get(p!.code)!.name,
          "Choose its controller. Ownership stays with the original player.",
          seats.map((seat) =>
            option(
              seat.id,
              cards.get(identityCode(s, seat.id))!.name,
              [D("transfer", { id: p!.id, playerId: seat.id })],
              p!.code,
            ),
          ),
        );
      break;
    }
    case "ds:transfer": {
      const p = own(s, e.id),
        seat = s.players.find((p) => p.id === e.playerId && !p.eliminated);
      need(
        p &&
          seat &&
          (p!.code !== "09020" ||
            !seatView(s, seat!).player.inPlay.some(
              (u) =>
                u.id !== p!.id && cards.get(u.code)?.name === "Unflappable",
            )),
        "That player already controls Unflappable.",
      );
      ports.transferControl(s, e.id, e.playerId);
      break;
    }
    case "ds:ironfist": {
      const p = own(s, e.id, "09014"),
        target = enemy(s, e.target);
      need(
        p && p.counters > 0 && target,
        "Iron Fist's interrupt is unavailable.",
      );
      p!.counters--;
      // The host's queued resume checks whether the original target survived;
      // it must not grant another attack or consequent damage when it did not.
      ports.queue(
        s,
        E("status", { target: e.target, status: "stunned" }),
        E("damage", { target: e.target, amount: 1, source: p!.id }),
      );
      break;
    }
    case "ds:ironfist-resume":
      if (
        enemy(s, e.target) &&
        cards.get(enemy(s, e.target)!.code)?.name === e.targetName
      )
        ports.queue(s, ...e.after);
      break;
    case "ds:clea":
      need(
        own(s, e.id, "09013"),
        "Clea is no longer controlled by this player.",
      );
      ports.shuffleAllyIntoOwnerDeck(s, e.id);
      ports.queue(s, ...e.after);
      break;
    case "ds:defense-cost": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "09015");
      need(
        p && s.attack?.defender === "hero" && s.player.form === "hero",
        "Desperate Defense is unavailable.",
      );
      eventPayment(s, p!, "Desperate Defense", [D("defense")], e.after, ports);
      break;
    }
    case "ds:defense":
      need(s.attack?.defender === "hero", "Your hero is no longer defending.");
      s.attack!.defenseBonus = Number(s.attack!.defenseBonus || 0) + 2;
      s.flags.dsDesperateDefense = true;
      break;
    case "ds:warning-cost": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "09021");
      need(
        p &&
          doctorStrangeDamageOptions(s, e.window, e.after, ports).some(
            (o) => o.id === p!.id,
          ),
        "Warning is unavailable.",
      );
      eventPayment(
        s,
        p!,
        "Warning",
        [
          E("ms:prevent-damage", {
            actorId: e.window.playerId,
            amount: 1,
            packet: e.window.packet,
          }),
        ],
        e.after,
        ports,
      );
      break;
    }
    case "ds:foiled-cost": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "09038");
      need(p && s.scheming, "Foiled! is unavailable.");
      eventPayment(
        s,
        p!,
        "Foiled!",
        [D("foiled", { boostId: e.boostId })],
        e.after,
        ports,
      );
      break;
    }
    case "ds:foiled":
      ports.cancelBoost(s, e.boostId, true);
      break;
    case "ds:skilled-choice": {
      e.attack = {
        ...e.attack,
        amount: e.attack.amount + Number(s.flags.dsSkilledBonus || 0),
      };
      delete s.flags.dsSkilledBonus;
      const opts = s.player.hand
        .filter(
          (p) =>
            p.code === "09037" &&
            ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        )
        .map((p) =>
          option(
            p.id,
            "Skilled Strike · +2 ATK for this basic attack",
            [D("skilled-cost", { id: p.id, attack: e.attack })],
            p.code,
          ),
        );
      if (!opts.length) {
        ports.queue(s, { ...e.attack, strangeBasicHandled: true });
        break;
      }
      ports.choose(
        s,
        "Basic attack",
        "Play Skilled Strike before this basic attack?",
        [
          ...opts,
          option("continue", "Resolve the basic attack", [
            { ...e.attack, strangeBasicHandled: true },
          ]),
        ],
      );
      break;
    }
    case "ds:skilled-cost": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "09037");
      need(
        p && e.attack.basic && !s.player.stunned && s.player.form === "hero",
        "Skilled Strike is unavailable.",
      );
      eventPayment(
        s,
        p!,
        "Skilled Strike",
        [D("skilled-bonus")],
        [D("skilled-choice", { attack: e.attack })],
        ports,
      );
      break;
    }
    case "ds:skilled-bonus":
      s.flags.dsSkilledBonus = Number(s.flags.dsSkilledBonus || 0) + 2;
      break;
    case "ds:nurse-choice": {
      const p = own(s, e.id, "09019");
      need(
        p && !p.exhausted && p.counters > 0,
        "The Night Nurse is unavailable.",
      );
      const choices = playerOrder(s).filter((seat) => {
        const view = seatView(s, seat);
        return (
          view.player.form === "hero" &&
          (view.player.hp < ports.heroMaxHP(s, seat.id) ||
            statusNames.some((status) => statusCount(view.player, status)))
        );
      });
      need(choices.length, "No hero has damage or a status card.");
      ports.choose(
        s,
        "The Night Nurse",
        "Choose a hero to heal and remove one status card from.",
        choices.map((seat) =>
          option(
            seat.id,
            cards.get(identityCode(s, seat.id))!.name,
            [D("nurse", { id: p!.id, playerId: seat.id })],
            identityCode(s, seat.id),
          ),
        ),
      );
      break;
    }
    case "ds:nurse": {
      const p = own(s, e.id, "09019"),
        seat = s.players.find(
          (seat) => seat.id === e.playerId && !seat.eliminated,
        ),
        view = seat ? seatView(s, seat) : undefined;
      need(
        p &&
          !p.exhausted &&
          p.counters > 0 &&
          view?.player.form === "hero" &&
          (view.player.hp < ports.heroMaxHP(s, e.playerId) ||
            statusNames.some((status) => statusCount(view.player, status))),
        "The Night Nurse's target is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      ports.queue(
        s,
        E("heal", { target: `hero:${e.playerId}`, amount: 1 }),
        D("nurse-status", { playerId: e.playerId }),
        ...(p!.counters === 0 ? [E("discardPiece", { id: p!.id })] : []),
      );
      break;
    }
    case "ds:nurse-status": {
      const p = seatView(s, e.playerId).player,
        statuses = statusNames.filter((status) => statusCount(p, status));
      if (statuses.length === 1)
        ports.removeStatus(s, `hero:${e.playerId}`, statuses[0]);
      else if (statuses.length)
        ports.choose(
          s,
          "The Night Nurse",
          "Discard one status card, including Tough if it is the only type present.",
          statuses.map((status) =>
            option(status, `Discard one ${status} status card`, [
              D("remove-status", { target: `hero:${e.playerId}`, status }),
            ]),
          ),
        );
      break;
    }
    case "ds:remove-status": {
      const p = character(s, e.target);
      need(
        p && statusNames.includes(e.status) && statusCount(p!, e.status),
        "That status card is no longer present.",
      );
      ports.removeStatus(s, e.target, e.status);
      break;
    }
    case "ds:ward-cost": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "09007");
      need(p && s.player.form === "hero", "Protective Ward is unavailable.");
      eventPayment(
        s,
        p!,
        "Protective Ward",
        [E("cancelEncounter", { piece: e.piece })],
        [],
        ports,
      );
      break;
    }
    case "ds:obligation": {
      const flip = s.player.form === "hero" && ports.canChangeForm(s);
      if (flip)
        ports.choose(
          s,
          "Physical Toll",
          "You may flip to Stephen Strange before choosing.",
          [
            option("flip", "Flip to Stephen Strange", [
              E("flip", { counts: false }),
              D("obligation-choice", { piece: e.piece }),
            ]),
            option("stay", "Keep your current form", [
              D("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, D("obligation-choice", { piece: e.piece }));
      break;
    }
    case "ds:obligation-choice":
      ports.choose(
        s,
        "Physical Toll",
        "Exhaust Stephen Strange, or make your next played event cost 3 additional resources.",
        [
          ...(s.player.form === "alter" && !s.player.exhausted
            ? [
                option(
                  "exhaust",
                  "Exhaust Stephen Strange and remove Physical Toll",
                  [
                    E("exhaust", { id: "hero" }),
                    E("removeEncounter", { piece: e.piece }),
                  ],
                ),
              ]
            : []),
          option("event", "The next event you play costs 3 more", [
            D("toll", { piece: e.piece }),
          ]),
        ],
      );
      break;
    case "ds:toll": {
      const p: Piece = e.piece;
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.attachedTo = `hero:${s.activePlayerId}`;
      s.attachments.push(p);
      break;
    }
    case "ds:counterspell-attach": {
      const p: Piece = e.piece;
      if (s.player.form !== "hero") break;
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.attachedTo = `hero:${s.activePlayerId}`;
      s.attachments.push(p);
      break;
    }
    case "ds:dimension-capture": {
      const p = s.sideSchemes.find((p) => p.id === e.id),
        owner = invocationOwner(s);
      if (!p || !owner) break;
      const view = seatView(s, owner),
        top = doctorStrangeTopInvocation(view);
      if (!top) break;
      zones(view).invocationDeck!.shift();
      (p.storedCards ||= []).push(top);
      recycleInvocations(view, ports);
      if (doctorStrangeTopInvocation(view)) ports.revealHidden(s);
      break;
    }
    case "ds:mordo": {
      const playerId = e.playerId || s.activePlayerId,
        [p] = ports.discardTop(s, playerId, 1);
      if (!p) break;
      const c = cards.get(p.code)!,
        wild = Number(c.resource_wild || 0) > 0;
      ports.queue(
        s,
        ...(wild || Number(c.resource_physical || 0) > 0
          ? [E("status", { target: `hero:${playerId}`, status: "stunned" })]
          : []),
        ...(wild || Number(c.resource_energy || 0) > 0
          ? [
              E("damage", {
                target: `hero:${playerId}`,
                amount: 2,
                source: "Baron Mordo",
              }),
            ]
          : []),
        ...(wild || Number(c.resource_mental || 0) > 0
          ? [E("status", { target: `hero:${playerId}`, status: "confused" })]
          : []),
      );
      break;
    }
    case "ds:thoughtcasting": {
      const highest = Math.max(
          -1,
          ...s.player.hand.map((p) => Number(cards.get(p.code)?.cost || 0)),
        ),
        choices = s.player.hand.filter(
          (p) => Number(cards.get(p.code)?.cost || 0) === highest,
        );
      if (!choices.length) break;
      if (choices.length === 1)
        ports.queue(
          s,
          D("thoughtcasting-discard", {
            id: choices[0].id,
            cost: highest,
            form: s.player.form,
          }),
        );
      else
        ports.choose(
          s,
          "Thoughtcasting",
          "Choose a card tied for the highest printed cost.",
          choices.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [
                D("thoughtcasting-discard", {
                  id: p.id,
                  cost: highest,
                  form: s.player.form,
                }),
              ],
              p.code,
            ),
          ),
        );
      break;
    }
    case "ds:thoughtcasting-discard": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      need(
        i >= 0 &&
          Number(cards.get(s.player.hand[i].code)?.cost || 0) === e.cost &&
          s.player.hand.every(
            (p) => Number(cards.get(p.code)?.cost || 0) <= e.cost,
          ),
        "Choose a card with the highest printed cost.",
      );
      s.player.discard.push(...s.player.hand.splice(i, 1));
      ports.queue(
        s,
        e.form === "alter"
          ? E("threat", { target: "main", amount: e.cost })
          : E("damage", {
              target: "hero",
              amount: e.cost,
              source: "Thoughtcasting",
            }),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
