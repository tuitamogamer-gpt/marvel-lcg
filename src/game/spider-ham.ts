import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const H = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`spider-ham:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["spiderham", "spider_ham"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const hamCard = (p: Piece) =>
  cards.get(p.code)?.set_code === "spiderham" &&
  cards.get(p.code)?.faction_code === "hero";
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
type IdentityPlayer = GameState["player"] & { spiderHamIdentity?: Piece };
const identity = (s: GameState) =>
  (s.player as IdentityPlayer).spiderHamIdentity;
type TextPorts = Pick<SpiderHamPorts, "isTextBlank" | "isIdentityTextBlank">;
const defaultTextPorts: TextPorts = { isTextBlank };
const identityBlank = (s: GameState, ports: TextPorts) =>
  ports.isIdentityTextBlank?.(s) ??
  isTextBlank(s, {
    code: s.player.form === "hero" ? "30001a" : "30001b",
    id: identity(s)?.id,
  });

/** Authored hero/signature and obligation/nemesis faces; native ports required. */
export const SPIDER_HAM_SCRIPT_CODES = [
  "30001a",
  "30001b",
  "30002",
  "30003",
  "30004",
  "30005",
  "30006",
  "30007",
  "30008",
  "30009",
  "30010",
  "30011",
  "30024",
  "30025",
  "30026",
  "30027",
  "30028",
] as const;
export const SPIDER_HAM_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const SPIDER_HAM_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#spiderham";

export interface SpiderHamDamageReceipt {
  token: string;
  playerId: string;
  /** Actual positive damage taken by this identity, after all prevention. */
  actualDamage: number;
}
export interface SpiderHamRecoverReceipt {
  token: string;
  playerId: string;
  performed: boolean;
  wasAlter: boolean;
}
export interface SpiderHamDamageContext {
  token: string;
  playerId: string;
  targetId: string;
  amount: number;
}
export interface SpiderHamRevealReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
  fromEncounterDeck: boolean;
}
export interface SpiderHamPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  makePiece(s: GameState, code: string): Piece;
  /** Captain Americat places a counter on its controller's actual identity,
   * including another identity that cannot spend toon counters as resources. */
  addIdentityToonCounters?(s: GameState, count: number): void;
  canChangeForm(s: GameState): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** Complete activation and all windows before after; a canceled attack still
   * continues, because Petulant Pig does not use THEN. */
  attackVillain(s: GameState, playerId: string, after: Effect[]): void;
  enemyAttack(
    s: GameState,
    enemyId: string,
    playerId: string,
    after: Effect[],
  ): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  /** Combined native resource/additional-counter legality, reserving the toon
   * cost while paying resources. No newly gained cost-damage response can fund
   * that same payment (official Spider-Ham ruling). */
  canPayWithToonCost(s: GameState, p: Piece, count: number): boolean;
  canDiscardPiece(s: GameState, p: Piece): boolean;
  /** Resume only after the actual discard cost and its native leave windows.
   * A replacement that shuffles rather than discards cannot pay this cost. */
  discardControlledCost(s: GameState, id: string, after: Effect[]): void;
  /** Preserve the actual victim/token; works for attack, boost, effect,
   * retaliate and overkill damage, in either identity form. */
  preventDamage(
    s: GameState,
    context: SpiderHamDamageContext,
    amount: number,
  ): void;
  /** Requery after discard-cost leave windows; another interrupt may have
   * changed this retained packet since its original choice was presented. */
  damageRemaining?(s: GameState, context: SpiderHamDamageContext): number;
  reactionEvents?(s: GameState): Piece[];
  canPlayRevealReaction?(
    s: GameState,
    p: Piece,
    receipt: SpiderHamRevealReceipt,
  ): boolean;
  /** Native paid PLAY, discard event exactly once; UI payment cancellation
   * returns to the original reveal without spending any additional toon. */
  playRevealReaction(
    s: GameState,
    id: string,
    receipt: SpiderHamRevealReceipt,
    after: Effect[],
  ): void;
  cancelEncounter(s: GameState, piece: Piece): void;
  /** Move the ACTUAL found minion, PUT not reveal; complete entry before after. */
  putMinion(
    s: GameState,
    piece: Piece,
    playerId: string,
    after: Effect[],
  ): void;
  revealEncounter(s: GameState, piece: Piece): void;
  attach(s: GameState, piece: Piece, target: string): void;
  /** Remove all all-purpose counters from the actual controlled cards and
   * identity, including toon/ammo/growth/progress; preserve HP, damage tokens,
   * threat/acceleration tokens and status cards (RRG Counter definition). */
  clearControlledCounters(s: GameState, playerId: string): void;
}

/** Allocate only for the real Spider-Ham seat, preserving its physical ID and
 * counters across form changes and JSON hydration. Host owns face synchronization. */
export function spiderHamInitializeIdentity(
  s: GameState,
  ports: Pick<SpiderHamPorts, "makePiece">,
) {
  if (!active(s) || identity(s)) return;
  const p = ports.makePiece(s, s.player.form === "hero" ? "30001a" : "30001b");
  p.ownerId = s.activePlayerId;
  (s.player as IdentityPlayer).spiderHamIdentity = p;
}
export function spiderHamToonCounters(s: GameState): number {
  return active(s) ? Math.max(0, Number(identity(s)?.counters || 0)) : 0;
}
export function spiderHamAddToonCounters(s: GameState, count: number) {
  need(
    active(s) && identity(s) && Number.isInteger(count) && count >= 0,
    "Toon counters require Spider-Ham's actual identity and a nonnegative integer.",
  );
  identity(s)!.counters = spiderHamToonCounters(s) + count;
}
export function spiderHamSpendToonCounters(s: GameState, count: number) {
  need(
    active(s) &&
      identity(s) &&
      Number.isInteger(count) &&
      count >= 0 &&
      spiderHamToonCounters(s) >= count,
    "Spider-Ham cannot pay this toon counter cost.",
  );
  identity(s)!.counters = spiderHamToonCounters(s) - count;
}

/** Individual selectable slots let native typed/wild/Alliance allocation count
 * each physical identity counter exactly once. Reserve additional event costs. */
export function spiderHamResourceSources(
  s: GameState,
  targetCode?: string,
  ports: TextPorts = defaultTextPorts,
): PaymentSource[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !identity(s) ||
    identityBlank(s, ports)
  )
    return [];
  const reserve = ["30004", "30005"].includes(targetCode || "") ? 1 : 0;
  return Array.from(
    { length: Math.max(0, spiderHamToonCounters(s) - reserve) },
    (_, index) => ({
      id: `spider-ham-toon:${identity(s)!.id}:${index + 1}`,
      code: "30001a",
      name: "Toon counter",
      resources: ["wild"],
      kind: "ability",
      description: "Spend 1 toon counter from Spider-Ham · 1 wild resource",
    }),
  );
}
/** The host validates every selected slot atomically before spending any.
 * Do not recheck a remaining ordinal after earlier selected slots were spent. */
export function spiderHamResourceSpent(
  s: GameState,
  id: string,
  ports: TextPorts = defaultTextPorts,
): boolean {
  if (!id.startsWith("spider-ham-toon:")) return false;
  const prefix = `spider-ham-toon:${identity(s)?.id}:`;
  need(
    active(s) &&
      s.player.form === "hero" &&
      !identityBlank(s, ports) &&
      id.startsWith(prefix) &&
      /^[1-9]\d*$/.test(id.slice(prefix.length)) &&
      spiderHamToonCounters(s) > 0,
    "This actual Spider-Ham toon resource is unavailable.",
  );
  spiderHamSpendToonCounters(s, 1);
  return true;
}

export function spiderHamStats(
  s: GameState,
  ports: TextPorts = defaultTextPorts,
) {
  const enabled = active(s) && s.player.form === "hero";
  return {
    attack: enabled
      ? s.player.inPlay.filter(
          (p) => p.code === "30010" && !ports.isTextBlank(s, p),
        ).length
      : 0,
    thwart: enabled
      ? s.player.inPlay.filter(
          (p) => p.code === "30011" && !ports.isTextBlank(s, p),
        ).length
      : 0,
  };
}
export function spiderHamTraits(s: GameState): string[] {
  return active(s) && s.flags.spiderHamAerialPhase === phaseKey(s)
    ? ["Aerial"]
    : [];
}
export function spiderHamPhaseEnded(s: GameState) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.spiderHamAerialPhase;
    for (const key of Object.keys(flags))
      if (key.startsWith("spiderHamResponse:")) delete flags[key];
  }
}
const responseKey = (kind: string, token: string) =>
  `spiderHamResponse:${kind}:${token}`;
function responseAvailable(
  s: GameState,
  kind: "damage" | "recover",
  receipt: SpiderHamDamageReceipt | SpiderHamRecoverReceipt,
  ports: TextPorts,
) {
  const seat = s.players.find(
    (p) => p.id === receipt.playerId && !p.eliminated,
  );
  if (!seat) return false;
  const view = seatView(s, seat);
  return (
    active(view) &&
    !identityBlank(view, ports) &&
    !!receipt.token &&
    !view.flags[responseKey(kind, receipt.token)] &&
    (kind === "damage"
      ? view.player.form === "hero" &&
        (receipt as SpiderHamDamageReceipt).actualDamage > 0
      : view.player.form === "alter" &&
        (receipt as SpiderHamRecoverReceipt).wasAlter &&
        (receipt as SpiderHamRecoverReceipt).performed)
  );
}
/** Host calls only AFTER the complete cost commit when damage paid a cost. A
 * response may never create a resource to finish the cost that triggered it. */
export function spiderHamAfterDamage(
  s: GameState,
  receipt: SpiderHamDamageReceipt,
  ports: TextPorts = defaultTextPorts,
): Effect[] {
  return responseAvailable(s, "damage", receipt, ports)
    ? [
        E("optional", {
          title: "Spider-Nonsense",
          text: "Place 1 toon counter on Spider-Ham after taking damage?",
          image: "30001a",
          actorId: receipt.playerId,
          effects: [
            H("response", {
              kind: "damage",
              receipt,
              actorId: receipt.playerId,
            }),
          ],
        }),
      ]
    : [];
}
export function spiderHamAfterBasicRecover(
  s: GameState,
  receipt: SpiderHamRecoverReceipt,
  ports: TextPorts = defaultTextPorts,
): Effect[] {
  return responseAvailable(s, "recover", receipt, ports)
    ? [
        E("optional", {
          title: "Cartoon Power",
          text: "Place 1 toon counter on Peter Porker after this basic recovery?",
          image: "30001b",
          actorId: receipt.playerId,
          effects: [
            H("response", {
              kind: "recover",
              receipt,
              actorId: receipt.playerId,
            }),
          ],
        }),
      ]
    : [];
}
export function spiderHamAllyEnter(
  s: GameState,
  p: Piece,
  ports: TextPorts = defaultTextPorts,
): Effect[] | null {
  if (p.code !== "30002") return null;
  return !ports.isTextBlank(s, p)
    ? [
        E("optional", {
          title: "Captain Americat",
          text: "Place 1 toon counter on your identity and shuffle a Spider-Ham card from your discard pile into your deck?",
          image: p.code,
          effects: [H("americat", { id: p.id, actorId: s.activePlayerId })],
        }),
      ]
    : [];
}

const hogTargets = (s: GameState, ports: SpiderHamPorts) => [
  ...ports
    .enemyTargets(s, false)
    .filter((t) => s.minions.some((p) => p.id === t.id))
    .map((t) => ({ ...t, mode: "damage" })),
  ...ports
    .schemeTargets(s, false)
    .filter((t) => s.sideSchemes.some((p) => p.id === t.id))
    .map((t) => ({ ...t, mode: "threat" })),
];
export function spiderHamPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SpiderHamPorts,
): string | null {
  if (!["30003", "30004", "30005", "30006", "30007"].includes(p.code))
    return null;
  if (!active(s) || s.player.form !== "hero")
    return "This Spider-Ham event requires hero form.";
  if (p.code === "30005")
    return "This event requires your actual encounter-deck reveal interrupt.";
  if (
    p.code === "30004" &&
    (!ports.canPayWithToonCost(s, p, 1) || !hogTargets(s, ports).length)
  )
    return "Hogwashed needs its resource cost, 1 additional toon counter and a minion or side scheme.";
  if (
    p.code === "30003" &&
    !s.player.confused &&
    (!spiderHamToonCounters(s) || !ports.schemeTargets(s, true).length)
  )
    return "Ham It Up needs toon counters and a legal scheme to thwart.";
  if (
    p.code === "30007" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "Swinging Web Pig needs an attackable enemy.";
  return null;
}
/** The actual resource payment commits before this additional cost. */
export function spiderHamBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "30004" ? [H("hog-cost", { piece: p, after })] : null;
}
export function spiderHamEvent(_s: GameState, p: Piece): Effect[] | null {
  return ["30003", "30004", "30006", "30007"].includes(p.code)
    ? [H("event", { piece: p })]
    : null;
}

export function spiderHamAbilityOptions(
  s: GameState,
  id: string,
  ports: SpiderHamPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p) || !active(s)) return [];
  if (p.code === "30008" && s.player.form === "alter")
    return [
      O(
        "daily-beagle",
        "The Daily Beagle · exhaust, place 1 toon counter",
        [H("beagle", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "30011" &&
    s.player.form === "hero" &&
    spiderHamToonCounters(s) > 0 &&
    ((s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId)) ||
      !spiderHamTraits(s).includes("Aerial"))
  )
    return [
      O(
        "organic-webbing",
        "Organic Webbing · exhaust and spend 1 toon, ready Spider-Ham and gain Aerial this phase",
        [H("webbing", { id })],
        p.code,
      ),
    ];
  return [];
}
export function spiderHamAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: SpiderHamPorts,
): Effect[] | null {
  const choices = spiderHamAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function spiderHamBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: SpiderHamPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    s.player.stunned ||
    spiderHamToonCounters(s) <= 0 ||
    packet.spiderHamHammerHandled
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "30010" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Huge Wooden Hammer · exhaust and spend 1 toon, +2 ATK and overkill for this basic attack",
        [H("hammer", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
export function spiderHamDamageOptions(
  s: GameState,
  context: SpiderHamDamageContext,
  after: Effect[],
  ports: SpiderHamPorts,
): Option[] {
  if (
    !context.token ||
    context.playerId !== s.activePlayerId ||
    !["hero", `hero:${s.activePlayerId}`].includes(context.targetId) ||
    context.amount <= 1
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "30009" &&
        !ports.isTextBlank(s, p) &&
        ports.canDiscardPiece(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Cartoon Physics · discard to prevent all but 1 damage",
        [H("physics-cost", { id: p.id, context, after })],
        p.code,
      ),
    );
}
export function spiderHamRevealOptions(
  s: GameState,
  receipt: SpiderHamRevealReceipt,
  after: Effect[],
  ports: SpiderHamPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    receipt.playerId !== s.activePlayerId ||
    !receipt.fromEncounterDeck ||
    !receipt.token ||
    spiderHamToonCounters(s) < 1
  )
    return [];
  return (ports.reactionEvents?.(s) || s.player.hand)
    .filter(
      (p) =>
        p.code === "30005" &&
        !ports.isTextBlank(s, p) &&
        ports.canPayWithToonCost(s, p, 1) &&
        (!ports.canPlayRevealReaction ||
          ports.canPlayRevealReaction(s, p, receipt)),
    )
    .map((p) =>
      O(
        p.id,
        '"I Don\'t Think So!" · spend 1 resource and 1 toon, cancel and discard the encounter',
        [H("play-cancel", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
/** Native paid event resolves this after resource commit, before cancellation. */
export function spiderHamRevealCancelEffects(
  _s: GameState,
  p: Piece,
  receipt: SpiderHamRevealReceipt,
): Effect[] {
  need(
    p.code === "30005" && receipt.fromEncounterDeck && !!receipt.token,
    '"I Don\'t Think So!" requires an actual encounter-deck reveal.',
  );
  return [H("cancel", { receipt, eventId: p.id })];
}

export function spiderHamInitializeNemesis(
  s: GameState,
  ports: Pick<SpiderHamPorts, "makePiece">,
) {
  if (!active(s) || s.flags.spiderHamNemesisInitialized) return;
  const required = ["30025", "30026", "30027", "30028", "30028"],
    zone = (s.player.setAside ||= []);
  for (const code of new Set(required)) {
    const have = zone.filter((p) => p.code === code).length,
      count = required.filter((c) => c === code).length;
    need(
      have <= count,
      "Spider-Ham's nemesis reserve contains duplicate physical cards.",
    );
    for (let n = have; n < count; n++) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      zone.push(p);
    }
  }
  s.flags.spiderHamNemesisInitialized = true;
}
export function spiderHamShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    shown = ["30026", "30025"].flatMap((code) =>
      zone.filter((p) => p.code === code),
    ),
    rest = zone.filter((p) => ["30027", "30028"].includes(p.code));
  return [
    ...shown.map((p) => H("reveal-setaside", { id: p.id })),
    H("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!shown.some((p) => p.code === "30026")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function spiderHamEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (
    ["30024", "30025", "30026", "30027", "30028"].includes(p.code) &&
    isTextBlank(s, p)
  )
    return [];
  switch (p.code) {
    case "30024": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [H("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "30025":
    case "30026":
      return [];
    case "30027":
      return [H("glider", { piece: p })]; // Native printed Surge remains separate.
    case "30028":
      return [
        E("damage", { target: "hero", amount: 2, source: p.id }),
        H("feast-status", { sourceId: p.id }),
      ];
    default:
      return null;
  }
}
export function spiderHamBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["30024", "30025", "30026", "30027", "30028"].includes(p.code)
    ? []
    : null;
}
export function spiderHamSideDefeated(
  s: GameState,
  p: Piece,
  playerId = s.activePlayerId,
): Effect[] | null {
  return p.code === "30025"
    ? !isTextBlank(s, p)
      ? [H("trap", { playerId, actorId: playerId })]
      : []
    : null;
}
/** Every actual engagement, including PUT and control/engagement changes. */
export function spiderHamMinionEngaged(
  s: GameState,
  p: Piece,
  playerId = p.engagedWith || s.activePlayerId,
): Effect[] {
  return p.code === "30026" && !isTextBlank(s, p)
    ? [H("clear-counters", { sourceId: p.id, playerId, actorId: playerId })]
    : [];
}
export function spiderHamEnemyTraits(s: GameState, p: Piece): string[] {
  return s.attachments.some(
    (a) => a.code === "30027" && a.attachedTo === p.id && !isTextBlank(s, a),
  )
    ? ["Aerial"]
    : [];
}

function chooseTargets(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: SpiderHamPorts,
) {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
  else ports.queue(s, ...after);
}

export function resolveSpiderHamEffect(
  s: GameState,
  e: Effect,
  ports: SpiderHamPorts,
): boolean {
  if (!e.type.startsWith("spider-ham:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "spider-ham:response": {
      need(
        responseAvailable(s, e.kind, e.receipt, ports),
        "This actual Spider-Ham response is unavailable.",
      );
      const view = seatView(s, e.receipt.playerId);
      view.flags[responseKey(e.kind, e.receipt.token)] = true;
      spiderHamAddToonCounters(view, 1);
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham:americat": {
      const source = own(s, e.id, "30002");
      need(
        source && !ports.isTextBlank(s, source),
        "Captain Americat's actual enter-play response is unavailable.",
      );
      if (ports.addIdentityToonCounters) ports.addIdentityToonCounters(s, 1);
      else spiderHamAddToonCounters(s, 1);
      const choices = s.player.discard.filter(hamCard);
      if (choices.length)
        ports.choose(
          s,
          "Captain Americat",
          "Shuffle one actual Spider-Ham card from your discard pile into your deck.",
          choices.map((p) =>
            O(
              p.id,
              cards.get(p.code)!.name,
              [H("americat-shuffle", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spider-ham:americat-shuffle": {
      const index = s.player.discard.findIndex(
        (p) => p.id === e.id && hamCard(p),
      );
      need(
        index >= 0,
        "Captain Americat needs the actual discarded Spider-Ham card.",
      );
      s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "spider-ham:hog-cost":
      need(
        active(s) && s.player.form === "hero",
        "Hogwashed requires Spider-Ham's hero form.",
      );
      spiderHamSpendToonCounters(s, 1);
      ports.queue(s, ...after);
      break;
    case "spider-ham:event": {
      const p: Piece = e.piece;
      if (p.code === "30006") {
        ports.attackVillain(s, s.activePlayerId, [
          E("draw", { amount: 3 }),
          ...after,
        ]);
        break;
      }
      if (p.code === "30004") {
        const targets = hogTargets(s, ports);
        if (targets.length)
          ports.choose(
            s,
            "Hogwashed",
            "Deal 5 damage to a minion or remove 5 threat from a side scheme.",
            targets.map((t) =>
              O(
                t.id,
                `${t.mode === "damage" ? "Deal 5 damage" : "Remove 5 threat"} · ${t.label}`,
                [
                  H("hog-target", {
                    target: t.id,
                    mode: t.mode,
                    sourceId: p.id,
                    after,
                  }),
                ],
                t.code,
              ),
            ),
          );
        else ports.queue(s, ...after);
        break;
      }
      need(
        ["30003", "30007"].includes(p.code),
        "Unknown Spider-Ham action event.",
      );
      chooseTargets(
        s,
        cards.get(p.code)!.name,
        p.code === "30003"
          ? ports.schemeTargets(s, true)
          : ports.enemyTargets(s, true),
        H("event-target", { piece: p, after }),
        after,
        ports,
      );
      break;
    }
    case "spider-ham:event-target": {
      const p: Piece = e.piece;
      if (p.code === "30003") {
        need(
          ports.schemeTargets(s, true).some((t) => t.id === e.target),
          "Ham It Up requires a legal thwart target.",
        );
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: spiderHamToonCounters(s),
            source: "hero",
            abilitySource: p.id,
            action: true,
            thwartInitiated: true,
            eventCode: p.code,
          }),
          ...after,
        );
      } else {
        need(
          p.code === "30007" &&
            ports.enemyTargets(s, true).some((t) => t.id === e.target),
          "Swinging Web Pig requires an attackable enemy.",
        );
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount: 6,
              source: "hero",
              abilitySource: p.id,
              attack: true,
              attackInitiated: true,
              eventCode: p.code,
            }),
          ],
          [E("status", { target: e.target, status: "confused" }), ...after],
        );
      }
      break;
    }
    case "spider-ham:hog-target":
      need(
        hogTargets(s, ports).some(
          (t) => t.id === e.target && t.mode === e.mode,
        ),
        "Hogwashed requires the actual minion or side scheme.",
      );
      ports.queue(
        s,
        E(e.mode === "damage" ? "damage" : "thwart", {
          target: e.target,
          amount: 5,
          source: "hero",
          abilitySource: e.sourceId,
          attack: false,
          action: false,
          ignoreCrisis: true,
          eventCode: "30004",
        }),
        ...after,
      );
      break;
    case "spider-ham:beagle": {
      need(
        spiderHamAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "daily-beagle",
        ),
        "The Daily Beagle cannot pay its exhaustion cost.",
      );
      own(s, e.id)!.exhausted = true;
      spiderHamAddToonCounters(s, 1);
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham:webbing": {
      need(
        spiderHamAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "organic-webbing",
        ),
        "Organic Webbing's native action is unavailable.",
      );
      own(s, e.id)!.exhausted = true;
      spiderHamSpendToonCounters(s, 1);
      s.flags.spiderHamAerialPhase = phaseKey(s);
      ports.queue(
        s,
        ...(s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: "hero" })]
          : []),
        ...after,
      );
      break;
    }
    case "spider-ham:hammer": {
      need(
        spiderHamBasicAttackOptions(s, e.packet, after, ports).some(
          (o) => o.id === e.id,
        ),
        "Huge Wooden Hammer cannot pay its actual exhaustion and toon costs.",
      );
      own(s, e.id)!.exhausted = true;
      spiderHamSpendToonCounters(s, 1);
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 2,
          overkill: true,
          spiderHamHammerHandled: true,
        },
        ...after,
      );
      break;
    }
    case "spider-ham:physics-cost":
      need(
        spiderHamDamageOptions(s, e.context, after, ports).some(
          (o) => o.id === e.id,
        ),
        "Cartoon Physics requires an actual discardable upgrade and identity damage window.",
      );
      ports.discardControlledCost(s, e.id, [
        H("physics-prevent", { context: e.context, after }),
      ]);
      break;
    case "spider-ham:physics-prevent":
      ports.preventDamage(
        s,
        e.context,
        Math.max(
          0,
          (ports.damageRemaining?.(s, e.context) ?? e.context.amount) - 1,
        ),
      );
      ports.queue(s, ...after);
      break;
    case "spider-ham:play-cancel":
      need(
        spiderHamRevealOptions(s, e.receipt, after, ports).some(
          (o) => o.id === e.id,
        ),
        '"I Don\'t Think So!" is unavailable for this actual reveal.',
      );
      ports.playRevealReaction(s, e.id, e.receipt, after);
      break;
    case "spider-ham:cancel": {
      need(
        active(s) &&
          s.player.form === "hero" &&
          e.receipt.playerId === s.activePlayerId &&
          e.receipt.fromEncounterDeck,
        '"I Don\'t Think So!" requires your actual hero reveal.',
      );
      const p = [...s.resolving, ...s.encounter.dealt].find(
        (p) => p.id === e.receipt.pieceId && p.code === e.receipt.code,
      );
      need(p, "The actual revealed encounter card is unavailable.");
      spiderHamSpendToonCounters(s, 1);
      ports.cancelEncounter(s, p!);
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham:reveal-setaside": {
      const index = s.player.setAside?.findIndex((p) => p.id === e.id) ?? -1;
      if (index >= 0)
        ports.revealEncounter(s, s.player.setAside!.splice(index, 1)[0]);
      break;
    }
    case "spider-ham:shuffle-nemesis": {
      for (const id of e.ids as string[]) {
        const index = s.player.setAside?.findIndex((p) => p.id === id) ?? -1;
        if (index >= 0)
          s.encounter.deck.push(s.player.setAside!.splice(index, 1)[0]);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "spider-ham:clear-counters": {
      const source = s.minions.find(
        (p) => p.id === e.sourceId && p.code === "30026",
      );
      if (source && !ports.isTextBlank(s, source))
        ports.clearControlledCounters(s, e.playerId);
      break;
    }
    case "spider-ham:trap": {
      const gobbler = s.minions.find((p) => p.code === "30026");
      if (gobbler) ports.enemyAttack(s, gobbler.id, e.playerId, after);
      else {
        const found = [...s.encounter.deck, ...s.encounter.discard].filter(
          (p) => p.code === "30026",
        );
        if (found.length)
          ports.choose(
            s,
            "Nefarious Trap",
            "Put the actual Green Gobbler into play engaged with the player who defeated this scheme.",
            found.map((p) =>
              O(
                p.id,
                "The Green Gobbler",
                [
                  H("trap-found", {
                    id: p.id,
                    playerId: e.playerId,
                    actorId: e.playerId,
                    after,
                  }),
                ],
                p.code,
              ),
            ),
          );
        else {
          ports.shuffleEncounter(s);
          ports.queue(s, ...after);
        }
      }
      break;
    }
    case "spider-ham:trap-found": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) => p.id === e.id && p.code === "30026",
      );
      need(p, "Nefarious Trap needs the actual searched Green Gobbler.");
      ports.shuffleEncounter(s);
      ports.putMinion(s, p!, e.playerId, after);
      break;
    }
    case "spider-ham:glider": {
      const gobbler = s.minions.find((p) => p.code === "30026");
      const targets = gobbler ? [gobbler] : s.minions;
      if (targets.length)
        ports.choose(
          s,
          "Gobbler Glider",
          "Attach to The Green Gobbler, if able; otherwise attach to a minion.",
          targets.map((p) =>
            O(
              p.id,
              cards.get(p.code)!.name,
              [H("glider-attach", { piece: e.piece, target: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spider-ham:glider-attach": {
      const gobbler = s.minions.find((p) => p.code === "30026");
      need(
        s.minions.some((p) => p.id === e.target) &&
          (!gobbler || gobbler.id === e.target),
        "Gobbler Glider needs its legal current minion.",
      );
      ports.attach(s, e.piece, e.target);
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham:feast-status":
      ports.queue(
        s,
        E("status", { target: "hero", status: "confused" }),
        ...(s.player.confused
          ? [E("surge", { source: e.sourceId, sourceCode: "30028" })]
          : []),
        ...after,
      );
      break;
    case "spider-ham:obligation":
      need(active(s), "This obligation belongs to Peter Porker.");
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          '"I Really Want a Hot Dog!"',
          "You may change to alter-ego form.",
          [
            O("alter", "Change to alter-ego", [
              E("flip", { counts: false, target: "alter" }),
              H("obligation-choices", { piece: e.piece }),
            ]),
            O("stay", "Stay in hero form", [
              H("obligation-choices", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, H("obligation-choices", { piece: e.piece }));
      break;
    case "spider-ham:obligation-choices": {
      const choices = [
        O("stun", "Become stunned · Surge if already stunned", [
          H("obligation-stun", { piece: e.piece }),
        ]),
      ];
      if (
        s.player.form === "alter" &&
        !s.player.exhausted &&
        spiderHamToonCounters(s) > 0
      )
        choices.unshift(
          O(
            "exhaust",
            "Exhaust Peter Porker and spend 1 toon · remove this obligation",
            [H("obligation-exhaust", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        '"I Really Want a Hot Dog!"',
        "Choose an option.",
        choices,
      );
      break;
    }
    case "spider-ham:obligation-exhaust":
      need(
        s.player.form === "alter" &&
          !s.player.exhausted &&
          spiderHamToonCounters(s) > 0,
        "Peter Porker must be ready and pay the full toon cost.",
      );
      s.player.exhausted = true;
      spiderHamSpendToonCounters(s, 1);
      ports.queue(s, E("removeEncounter", { piece: e.piece }), ...after);
      break;
    case "spider-ham:obligation-stun":
      ports.queue(
        s,
        E("status", { target: "hero", status: "stunned" }),
        ...(s.player.stunned ? [E("surge", { sourceCode: "30024" })] : []),
        E("discardEncounter", { piece: e.piece }),
        ...after,
      );
      break;
    default:
      throw Error(`Unknown Spider-Ham effect: ${e.type}`);
  }
  return true;
}
