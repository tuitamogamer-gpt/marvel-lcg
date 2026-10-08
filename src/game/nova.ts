import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const N = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`nova:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["nova", "sam_alexander"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const printedWild = (p: Piece) => Number(cards.get(p.code)?.resource_wild || 0);

export const NOVA_SCRIPT_CODES = [
  "28001a",
  "28001b",
  "28002",
  "28003",
  "28004",
  "28005",
  "28006",
  "28007",
  "28008",
  "28009",
  "28021",
  "28022",
  "28023",
  "28024",
  "28025",
] as const;
export const NOVA_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const NOVA_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/sam-alexander-nova/";
export const NOVA_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#nova";

export interface NovaPaymentReceipt {
  /** Actual cost allocation with original generated types, before wild conversion.
   * Overpayment is excluded. One generated wild is sufficient for "using wild". */
  generatedForCard?: Resource[];
  /** Compatibility receipt only when the host knows there was no overpayment. */
  paidForCard?: Resource[];
  playToken?: string;
}
export interface NovaBasicReceipt {
  token: string;
  playerId: string;
  power: "attack" | "thwart" | "defense" | "recover";
  performed: boolean;
  wasHero: boolean;
}
export interface NovaEventReceipt {
  token: string;
  playerId: string;
  eventId: string;
  code: string;
  /** Actual PLAY commit; an ability canceled after committing still played. */
  played: boolean;
}
export interface NovaAchievementReceipt {
  /** Distinct native occurrence, not merely the physical target ID. For one
   * simultaneous batch, use one occurrence per actual defeated enemy/scheme. */
  token: string;
  playerId: string;
  kind: "enemy-defeat" | "last-threat";
  targetId: string;
  attributedToIdentity: boolean;
  /** Actual defeat or positive-to-zero removal. HP-stat loss/leaving play,
   * attempted/prevented damage and removing threat from zero are false. */
  performed: boolean;
}
export interface NovaDamageContext {
  token: string;
  playerId: string;
  targetId: string;
  fromAttack: boolean;
  amount: number;
  friendly: boolean;
}
export interface NovaPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canReadyPiece(s: GameState, p: Piece): boolean;
  canDraw?(s: GameState, amount: number): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** Resume after with generatedForCard preserving Wild before conversion and
   * excluding overpaid resources. UI cancellation leaves the original window. */
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    targetCode?: string,
  ): void;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  /** Put the ACTUAL found Helmet into play, with native enter-play windows. */
  putPlayerCard(s: GameState, p: Piece, after: Effect[]): void;
  canDiscardPiece?(s: GameState, p: Piece): boolean;
  discardPiece(s: GameState, id: string): void;
  /** Exhaust and deal the full damage as one cost. Damage replacement which
   * prevents full payment (including Tough) makes the cost unavailable. Native
   * defeat/leave-play cleanup and responses precede after; cost may defeat her. */
  canPayAllyDamageCost(s: GameState, p: Piece, amount: number): boolean;
  payAllyDamageCost(
    s: GameState,
    id: string,
    amount: number,
    after: Effect[],
  ): void;
  /** Actual owned hand/George PLAY-only event. George stored events remain
   * unavailable as resources and unrelated hand/discard costs. */
  reactionEvents?(s: GameState): Piece[];
  canPlayDamageReaction?(
    s: GameState,
    p: Piece,
    context: NovaDamageContext,
  ): boolean;
  playDamageReaction(
    s: GameState,
    id: string,
    context: NovaDamageContext,
    after: Effect[],
  ): void;
  /** Reduce only the retained actual would-take-damage instance, preserving
   * victim and defender. Forcefield Projection has NO defense designation. */
  preventAttackDamage(
    s: GameState,
    context: NovaDamageContext,
    amount: number,
  ): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  removeEncounter(s: GameState, p: Piece): void;
  /** Actual in-play player-controlled cards, including transferred upgrades;
   * excludes hand/deck/discard and out-of-play stored cards. */
  controlledCards?(s: GameState): Piece[];
  enemyAttack(
    s: GameState,
    enemyId: string,
    playerId: string,
    allowAlter: boolean,
    continuation: Effect,
  ): boolean;
  /** Exactly count top-card discards across native deck exhaustion/reset. */
  discardEncounterTop(s: GameState, count: number, after: Effect[]): void;
}
const wildPaid = (receipt: NovaPaymentReceipt) =>
  (receipt.generatedForCard ?? receipt.paidForCard ?? []).includes("wild");
const controlled = (s: GameState, ports: Pick<NovaPorts, "controlledCards">) =>
  ports.controlledCards?.(s) ??
  s.player.inPlay.filter(
    (p) => cards.get(p.code)?.faction_code !== "encounter",
  );
const helmetLocked = (s: GameState, ports: Pick<NovaPorts, "isTextBlank">) =>
  s.players.some((seat) => {
    const view = seatView(s, seat);
    return view.player.inPlay.some(
      (p) => p.code === "28021" && !ports.isTextBlank(view, p),
    );
  }) ||
  s.attachments.some((p) => p.code === "28021" && !ports.isTextBlank(s, p));

/** Apply ONCE to every generated source while paying for either printed card.
 * The Helmet itself never doubles other Nova cards or generic abilities. */
export function novaPaymentResources(
  targetCode: string | undefined,
  generated: Resource[],
  textBlank = false,
): Resource[] {
  return !textBlank && ["28004", "28005"].includes(targetCode || "")
    ? generated.flatMap((r) => (r === "wild" ? [r, r] : [r]))
    : [...generated];
}
export function novaTraits(
  s: GameState,
  ports: Pick<NovaPorts, "isTextBlank">,
): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "28009" && !ports.isTextBlank(s, p))
    ? ["Aerial"]
    : [];
}
/** Recheck after EVERY draw while resetting a hand. Connection becomes ignored
 * as soon as drawn, and can itself be the last card causing another draw. */
export function novaHandSize(
  s: GameState,
  base: number,
  ports?: Pick<NovaPorts, "isTextBlank">,
): number {
  // RRG setup suppresses ordinary player-card abilities until Keep completes.
  if (s.phase === "mulligan") return base;
  return (
    base +
    s.player.hand.filter((p) => p.code === "28007" && !ports?.isTextBlank(s, p))
      .length
  );
}
export function novaCanReadyPiece(
  s: GameState,
  p: Piece,
  ports: Pick<NovaPorts, "isTextBlank">,
): boolean {
  if (p.code !== "28009") return true;
  return !helmetLocked(s, ports);
}
export function novaResourceSources(
  s: GameState,
  ports: Pick<NovaPorts, "isTextBlank">,
): PaymentSource[] {
  return s.player.form === "hero"
    ? s.player.inPlay
        .filter(
          (p) => p.code === "28009" && !p.exhausted && !ports.isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Supernova Helmet",
          resources: ["wild"],
          kind: "ability",
          description: "Exhaust Supernova Helmet · generate 1 wild resource",
        }))
    : [];
}
export function novaResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<NovaPorts, "isTextBlank">,
): boolean {
  const p = own(s, id, "28009");
  if (!p) return false;
  need(
    novaResourceSources(s, ports).some((q) => q.id === id),
    "Supernova Helmet is unavailable.",
  );
  p.exhausted = true;
  return true;
}
const unleashUsed = (s: GameState) =>
  s.players.some(
    (seat) => seatView(s, seat).flags.novaUnleashPlayedRound === s.round,
  );
export function novaCardPlayCommitted(
  s: GameState,
  p: Piece,
  playToken: string,
): void {
  if (p.code !== "28006") return;
  need(playToken, "Unleash Nova Force requires a native PLAY token.");
  need(
    !unleashUsed(s) ||
      (s.flags.novaUnleashPlayedRound === s.round &&
        s.flags.novaUnleashPlayToken === playToken),
    "Unleash Nova Force is max 1 per round across all players.",
  );
  s.flags.novaUnleashPlayedRound = s.round;
  s.flags.novaUnleashPlayToken = playToken;
}
export function novaEventAction(p: Piece): "attack" | "thwart" | undefined {
  return p.code === "28005"
    ? "attack"
    : p.code === "28004"
      ? "thwart"
      : undefined;
}
export function novaPlayRestriction(
  s: GameState,
  p: Piece,
  ports?: NovaPorts,
): string | null {
  if (!["28003", "28004", "28005", "28006"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This Nova event requires hero form.";
  if (p.code === "28003")
    return "Forcefield Projection needs an actual friendly attack damage window.";
  if (p.code === "28006" && unleashUsed(s))
    return "Unleash Nova Force is max 1 per round.";
  const action = novaEventAction(p);
  if (
    ports &&
    action === "attack" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "Pot Shot needs a legal enemy.";
  if (
    ports &&
    action === "thwart" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Lightspeed Flight needs a legal scheme with threat.";
  return null;
}
export function novaEvent(
  _s: GameState,
  p: Piece,
  receipt: NovaPaymentReceipt = {},
): Effect[] | null {
  if (p.code === "28004" || p.code === "28005")
    return [N("event", { piece: p })];
  if (p.code === "28006")
    return [N("unleash", { piece: p, playToken: receipt.playToken })];
  return p.code === "28003" ? [] : null;
}
const basicKey = (receipt: NovaBasicReceipt) => `novaBasic:${receipt.token}`;
export function novaBasicPowerOptions(
  s: GameState,
  receipt: NovaBasicReceipt,
  after: Effect[],
  ports: NovaPorts,
): Option[] {
  if (
    !active(s) ||
    !receipt.token ||
    receipt.playerId !== s.activePlayerId ||
    !receipt.performed ||
    !receipt.wasHero ||
    receipt.power === "recover" ||
    s.player.form !== "hero" ||
    ports.isIdentityTextBlank?.(s) ||
    s.flags[basicKey(receipt)]
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "28009" &&
        p.exhausted &&
        novaCanReadyPiece(s, p, ports) &&
        ports.canReadyPiece(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Nova · ready Supernova Helmet",
        [N("helmet-ready", { id: p.id, receipt, after })],
        "28001a",
      ),
    );
}
export function novaAfterBasicPower(
  s: GameState,
  receipt: NovaBasicReceipt,
  ports: NovaPorts,
): Effect[] {
  return novaBasicPowerOptions(s, receipt, [], ports).length
    ? [N("basic-window", { receipt })]
    : [];
}
export function novaAchievement(
  s: GameState,
  receipt: NovaAchievementReceipt,
): Effect[] {
  const view = seatView(s, receipt.playerId);
  return active(view) &&
    receipt.token &&
    receipt.attributedToIdentity &&
    receipt.performed &&
    view.flags.novaUnleashRound === s.round &&
    !view.flags[
      `novaAchievement:${receipt.token}:${receipt.kind}:${receipt.targetId}`
    ]
    ? [N("achievement", { receipt, actorId: receipt.playerId })]
    : [];
}
export function novaRoundEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.novaUnleashRound;
    for (const key of Object.keys(flags))
      if (
        key.startsWith("novaAchievement:") ||
        key.startsWith("novaBasic:") ||
        key.startsWith("novaEvent:") ||
        key.startsWith("novaDamage:")
      )
        delete flags[key];
  }
}
export function novaEventPlayedOptions(
  s: GameState,
  receipt: NovaEventReceipt,
  after: Effect[],
  ports: NovaPorts,
): Option[] {
  if (
    !receipt.token ||
    !receipt.played ||
    receipt.playerId !== s.activePlayerId ||
    s.player.form !== "hero" ||
    cards.get(receipt.code)?.type_code !== "event" ||
    !s.player.discard.some(
      (p) => p.id === receipt.eventId && p.code === receipt.code,
    )
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "28002" &&
        !p.exhausted &&
        !ports.isTextBlank(s, p) &&
        !s.flags[`novaEvent:${receipt.token}:${p.id}`] &&
        ports.canPayAllyDamageCost(s, p, 1),
    )
    .map((p) =>
      O(
        p.id,
        "Ms. Marvel · exhaust and deal 1 damage to return that event",
        [N("marvel-return", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
export function novaAfterEventPlayed(
  s: GameState,
  receipt: NovaEventReceipt,
  ports: NovaPorts,
): Effect[] {
  return novaEventPlayedOptions(s, receipt, [], ports).length
    ? [N("event-window", { receipt })]
    : [];
}
export function novaDamageOptions(
  s: GameState,
  context: NovaDamageContext,
  after: Effect[],
  ports: NovaPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !context.token ||
    !context.friendly ||
    !context.fromAttack ||
    context.amount <= 0
  )
    return [];
  return (ports.reactionEvents?.(s) ?? s.player.hand)
    .filter(
      (p) =>
        p.code === "28003" &&
        !ports.isTextBlank(s, p) &&
        (!ports.canPlayDamageReaction ||
          ports.canPlayDamageReaction(s, p, context)) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Forcefield Projection · prevent 3 attack damage",
        [N("play-forcefield", { id: p.id, context, after })],
        p.code,
      ),
    );
}
export function novaForcefieldEffects(
  _s: GameState,
  p: Piece,
  context: NovaDamageContext,
  receipt: NovaPaymentReceipt,
): Effect[] {
  need(
    p.code === "28003" &&
      context.friendly &&
      context.fromAttack &&
      context.amount > 0,
    "Forcefield Projection needs the actual friendly attack-damage window.",
  );
  return [N("forcefield", { piece: p, context, wild: wildPaid(receipt) })];
}
export function novaHeroAbilityOptions(
  s: GameState,
  ports: NovaPorts,
): Option[] {
  return active(s) &&
    s.player.form === "alter" &&
    !ports.isIdentityTextBlank?.(s) &&
    [...s.player.deck, ...s.player.discard].some((p) => p.code === "28009") &&
    ports.canPay(s, 1, [], undefined, "28001b")
    ? [
        O(
          "sam-search",
          "Sam Alexander · spend 1 to find Supernova Helmet",
          [N("sam-pay")],
          "28001b",
        ),
      ]
    : [];
}
export function novaHeroAbility(
  s: GameState,
  ports: NovaPorts,
  action?: string,
): boolean {
  if (!active(s)) return false;
  const available = novaHeroAbilityOptions(s, ports),
    choice = action ? available.find((o) => o.id === action) : available[0];
  need(choice, "Sam Alexander's search is unavailable.");
  ports.queue(s, ...choice!.effects);
  return true;
}
export function novaAbilityOptions(
  s: GameState,
  id: string,
  ports: NovaPorts,
): Option[] {
  const p = own(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "28008" &&
    !p.exhausted &&
    s.player.form === "alter" &&
    (s.player.discard.some((q) => q.code === "28007") ||
      (ports.canDraw?.(s, 1) ??
        s.player.deck.length + s.player.discard.length > 0))
  )
    return [
      O(
        "jesse",
        "Jesse Alexander · shuffle Connection to the Worldmind, draw 1",
        [N("jesse", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "28021" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted
  )
    return [
      O(
        "remove",
        "Exhaust Sam Alexander · remove Weight of the World",
        [N("obligation-remove", { id })],
        p.code,
      ),
    ];
  return [];
}
export function novaAbility(
  s: GameState,
  id: string,
  ports: NovaPorts,
  action?: string,
): boolean {
  const p = own(s, id);
  if (!p || !["28008", "28021"].includes(p.code)) return false;
  const choices = novaAbilityOptions(s, id, ports),
    choice = action ? choices.find((o) => o.id === action) : choices[0];
  need(choice, "This Nova ability is unavailable.");
  ports.queue(s, ...choice!.effects);
  return true;
}
export function novaInitializeNemesis(
  s: GameState,
  ports: Pick<NovaPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.novaNemesisInitialized) return;
  const required = ["28022", "28023", "28024", "28024", "28025"],
    zone = (s.player.setAside ||= []);
  for (const code of new Set(required)) {
    const have = zone.filter((p) => p.code === code).length,
      count = required.filter((c) => c === code).length;
    need(have <= count, "Nova nemesis reserve has duplicate physical cards.");
    for (let n = have; n < count; n++) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      zone.push(p);
    }
  }
  s.flags.novaNemesisInitialized = true;
}
export function novaShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    shown = ["28023", "28022"].flatMap((code) =>
      zone.filter((p) => p.code === code),
    ),
    rest = zone.filter((p) => ["28024", "28025"].includes(p.code));
  return [
    ...shown.map((p) => N("reveal-setaside", { id: p.id })),
    N("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!shown.some((p) => p.code === "28023")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function novaEnemyAttackModifiers(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: Pick<NovaPorts, "isTextBlank">,
): { attack: number; overkill: boolean } {
  return p.code === "28023" && !ports.isTextBlank(s, p)
    ? {
        attack: seatView(s, playerId).player.hand.filter(
          (q) => printedWild(q) > 0,
        ).length,
        overkill: true,
      }
    : { attack: 0, overkill: false };
}
export function novaEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "28021": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [N("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "28022":
      return [
        N("bring-war", {
          id: p.id,
          playerIds: playerOrder(s).map((seat) => seat.id),
          index: 0,
        }),
      ];
    case "28023":
      return [];
    case "28024":
      return [N("war-delivery", { playerId: s.activePlayerId })];
    case "28025":
      return [N("war-brought")];
    default:
      return null;
  }
}
export function novaBoost(s: GameState, p: Piece): Effect[] | null {
  return p.code === "28024"
    ? [
        E("threat", {
          target: "main",
          amount: s.player.hand.filter((q) => printedWild(q) > 0).length,
        }),
      ]
    : ["28021", "28022", "28023", "28025"].includes(p.code)
      ? []
      : null;
}
function select(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: NovaPorts,
) {
  if (!targets.length) {
    ports.queue(s, ...after);
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
  );
}
export function resolveNovaEffect(
  s: GameState,
  e: Effect,
  ports: NovaPorts,
): boolean {
  if (!e.type.startsWith("nova:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "nova:event": {
      const p = e.piece as Piece,
        attack = p.code === "28005";
      need(["28004", "28005"].includes(p.code), "Unknown Nova action event.");
      select(
        s,
        cards.get(p.code)!.name,
        attack ? ports.enemyTargets(s, true) : ports.schemeTargets(s, true),
        N("event-target", { piece: p, after }),
        after,
        ports,
      );
      break;
    }
    case "nova:event-target": {
      const attack = e.piece.code === "28005",
        targets = attack
          ? ports.enemyTargets(s, true)
          : ports.schemeTargets(s, true);
      need(
        targets.some((t) => t.id === e.target),
        "This Nova event needs an actual legal target.",
      );
      const effect = attack
        ? E("damage", {
            target: e.target,
            amount: 4,
            source: "hero",
            attack: true,
            attackInitiated: true,
            eventCode: e.piece.code,
          })
        : E("thwart", {
            target: e.target,
            amount: 3,
            source: "hero",
            action: true,
            thwartInitiated: true,
            eventCode: e.piece.code,
          });
      if (attack) ports.attackProgram(s, [effect], after);
      else ports.queue(s, effect, ...after);
      break;
    }
    case "nova:unleash":
      need(active(s), "Unleash Nova Force belongs to Nova.");
      novaCardPlayCommitted(
        s,
        e.piece,
        e.playToken || s.flags.novaUnleashPlayToken,
      );
      s.flags.novaUnleashRound = s.round;
      ports.queue(s, ...after);
      break;
    case "nova:achievement": {
      const receipt = e.receipt as NovaAchievementReceipt;
      if (!novaAchievement(s, receipt).length) {
        ports.queue(s, ...after);
        break;
      }
      const view = seatView(s, receipt.playerId);
      view.flags[
        `novaAchievement:${receipt.token}:${receipt.kind}:${receipt.targetId}`
      ] = true;
      ports.queue(
        s,
        ...(ports.canReadyIdentity(view, receipt.playerId) &&
        view.player.exhausted
          ? [E("ready", { target: `hero:${receipt.playerId}` })]
          : []),
        E("draw", { amount: 1, playerId: receipt.playerId }),
        ...after,
      );
      break;
    }
    case "nova:basic-window": {
      const choices = novaBasicPowerOptions(s, e.receipt, after, ports);
      if (choices.length)
        ports.choose(
          s,
          "Nova",
          "Ready Supernova Helmet after this completed basic power?",
          [...choices, O("skip", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "nova:helmet-ready": {
      const choice = novaBasicPowerOptions(s, e.receipt, after, ports).find(
        (o) => o.id === e.id,
      );
      need(choice, "Nova's actual Helmet response is unavailable.");
      s.flags[basicKey(e.receipt)] = true;
      ports.queue(s, E("ready", { id: e.id }), ...after);
      break;
    }
    case "nova:event-window": {
      const choices = novaEventPlayedOptions(s, e.receipt, after, ports);
      if (choices.length)
        ports.choose(
          s,
          "Ms. Marvel",
          "Return this actual played event from your discard pile?",
          [...choices, O("skip", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "nova:marvel-return": {
      const receipt = e.receipt as NovaEventReceipt;
      need(
        novaEventPlayedOptions(s, receipt, after, ports).some(
          (o) => o.id === e.id,
        ),
        "Ms. Marvel cannot pay for returning this actual played event.",
      );
      s.flags[`novaEvent:${receipt.token}:${e.id}`] = true;
      ports.payAllyDamageCost(s, e.id, 1, [
        N("marvel-after-cost", { receipt, after }),
      ]);
      break;
    }
    case "nova:marvel-after-cost": {
      const receipt = e.receipt as NovaEventReceipt,
        i = s.player.discard.findIndex(
          (p) => p.id === receipt.eventId && p.code === receipt.code,
        );
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      ports.queue(s, ...after);
      break;
    }
    case "nova:play-forcefield":
      need(
        novaDamageOptions(s, e.context, after, ports).some(
          (o) => o.id === e.id,
        ),
        "Forcefield Projection is unavailable for this actual damage window.",
      );
      ports.playDamageReaction(s, e.id, e.context, after);
      break;
    case "nova:forcefield":
      need(
        e.context.friendly && e.context.fromAttack && e.context.amount > 0,
        "Forcefield Projection lost its attack-damage context.",
      );
      ports.preventAttackDamage(s, e.context, 3);
      if (e.wild)
        select(
          s,
          "Forcefield Projection",
          ports.enemyTargets(s, false),
          N("forcefield-hit", { after }),
          after,
          ports,
        );
      else ports.queue(s, ...after);
      break;
    case "nova:forcefield-hit":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Forcefield Projection needs an actual enemy.",
      );
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 3,
          source: "hero",
          attack: false,
          eventCode: "28003",
        }),
        ...after,
      );
      break;
    case "nova:sam-pay":
      need(
        novaHeroAbilityOptions(s, ports).length,
        "Sam Alexander's actual search is unavailable.",
      );
      ports.pay(
        s,
        "Sam Alexander",
        1,
        [],
        [N("sam-search", { after, paymentReceipt: true })],
        "28001b",
      );
      break;
    case "nova:sam-search": {
      need(active(s), "Sam Alexander's search belongs to Nova.");
      const choices = [...s.player.deck, ...s.player.discard].filter(
        (p) => p.code === "28009",
      );
      if (!choices.length) {
        ports.shufflePlayerDeck(s, after);
        break;
      }
      const receipt: NovaPaymentReceipt = e.receipt || e;
      ports.choose(
        s,
        "Sam Alexander",
        wildPaid(receipt)
          ? "Put the found Supernova Helmet into play."
          : "Add the found Supernova Helmet to your hand.",
        choices.map((p) =>
          O(
            p.id,
            "Supernova Helmet",
            [N("sam-found", { id: p.id, wild: wildPaid(receipt), after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nova:sam-found": {
      const zone = [s.player.deck, s.player.discard].find((z) =>
        z.some((p) => p.id === e.id && p.code === "28009"),
      );
      need(zone, "The actual searched Supernova Helmet is unavailable.");
      const p = zone!.splice(
          zone!.findIndex((q) => q.id === e.id),
          1,
        )[0],
        finish = [N("sam-shuffle", { after })];
      if (e.wild) ports.putPlayerCard(s, p, finish);
      else {
        s.player.hand.push(p);
        ports.queue(s, ...finish);
      }
      break;
    }
    case "nova:sam-shuffle":
      ports.shufflePlayerDeck(s, after);
      break;
    case "nova:jesse": {
      const p = own(s, e.id, "28008");
      need(
        p && novaAbilityOptions(s, e.id, ports).length,
        "Jesse Alexander cannot pay his exhaustion cost.",
      );
      p!.exhausted = true;
      const copies = s.player.discard.filter((q) => q.code === "28007");
      if (copies.length)
        ports.choose(
          s,
          "Jesse Alexander",
          "Shuffle one actual Connection to the Worldmind into your deck, then draw 1.",
          copies.map((q) =>
            O(
              q.id,
              "Connection to the Worldmind",
              [N("jesse-shuffle", { id: q.id, after })],
              q.code,
            ),
          ),
        );
      else ports.queue(s, E("draw", { amount: 1 }), ...after);
      break;
    }
    case "nova:jesse-shuffle": {
      const i = s.player.discard.findIndex(
        (p) => p.id === e.id && p.code === "28007",
      );
      if (i >= 0) s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      ports.shufflePlayerDeck(s, [E("draw", { amount: 1 }), ...after]);
      break;
    }
    case "nova:obligation":
      need(active(s), "Weight of the World belongs to Sam Alexander.");
      ports.giveObligation(s, e.piece, s.activePlayerId);
      ports.queue(s, ...after);
      break;
    case "nova:obligation-remove": {
      const p = own(s, e.id, "28021");
      need(
        p && novaAbilityOptions(s, e.id, ports).some((o) => o.id === "remove"),
        "Sam Alexander cannot pay the obligation's exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.removeEncounter(s, p!);
      ports.queue(s, ...after);
      break;
    }
    case "nova:bring-war": {
      const ids: string[] = e.playerIds || [],
        index = Number(e.index || 0);
      if (index >= ids.length) {
        ports.queue(s, ...after);
        break;
      }
      const view = seatView(s, ids[index]),
        candidates = controlled(view, ports).filter(
          (p) =>
            printedWild(p) > 0 &&
            (!ports.canDiscardPiece || ports.canDiscardPiece(view, p)),
        ),
        next = N("bring-war", {
          ...e,
          type: "nova:bring-war",
          index: index + 1,
          after,
        });
      if (!candidates.length) {
        ports.queue(s, next);
        break;
      }
      ports.choose(
        s,
        '"Bring the War!"',
        `${ids[index]} discards 1 controlled card with a printed wild resource.`,
        candidates.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [
              N("bring-war-discard", {
                id: p.id,
                schemeId: e.id,
                playerId: ids[index],
                next,
                actorId: ids[index],
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nova:bring-war-discard": {
      const view = seatView(s, e.playerId),
        p = controlled(view, ports).find(
          (q) => q.id === e.id && printedWild(q) > 0,
        );
      need(
        p && (!ports.canDiscardPiece || ports.canDiscardPiece(view, p)),
        "Bring the War needs an actual discardable controlled printed-wild card.",
      );
      ports.discardPiece(s, e.id);
      const scheme = s.sideSchemes.find((q) => q.id === e.schemeId);
      ports.queue(
        s,
        ...(scheme && !controlled(view, ports).some((q) => q.id === e.id)
          ? [E("threat", { target: scheme.id, amount: 1 })]
          : []),
        e.next,
        ...after,
      );
      break;
    }
    case "nova:war-delivery": {
      const attack = N("delivery-attacks", {
        playerId: e.playerId,
        ids: [
          s.villain.id,
          ...s.minions.filter((p) => p.code === "28023").map((p) => p.id),
        ],
        index: 0,
        after,
      });
      const options = [
        O("attack", "The villain and Warbringer attack you", [attack]),
      ];
      if (ports.canPay(s, 1, ["wild"], undefined, "28024"))
        options.unshift(
          O("pay", "Spend 1 wild resource", [N("delivery-pay", { after })]),
        );
      ports.choose(
        s,
        "War Delivery",
        "You may spend a wild resource to avoid the attacks.",
        options,
      );
      break;
    }
    case "nova:delivery-pay":
      need(
        ports.canPay(s, 1, ["wild"], undefined, "28024"),
        "War Delivery needs an actual wild resource.",
      );
      ports.pay(s, "War Delivery", 1, ["wild"], after, "28024");
      break;
    case "nova:delivery-attacks": {
      const ids: string[] = e.ids || [],
        index = Number(e.index || 0);
      if (index >= ids.length) {
        ports.queue(s, ...after);
        break;
      }
      const next = N("delivery-attacks", {
          ...e,
          type: "nova:delivery-attacks",
          index: index + 1,
          after,
        }),
        exists =
          ids[index] === s.villain.id ||
          s.minions.some((p) => p.id === ids[index]);
      if (!exists || !ports.enemyAttack(s, ids[index], e.playerId, true, next))
        ports.queue(s, next);
      break;
    }
    case "nova:war-brought": {
      const total = [
        ...s.player.hand,
        ...controlled(s, ports),
        ...s.player.discard,
      ].reduce((n, p) => n + printedWild(p), 0);
      ports.discardEncounterTop(s, total, after);
      break;
    }
    case "nova:reveal-setaside": {
      const zone = s.player.setAside || [],
        i = zone.findIndex((p) => p.id === e.id);
      need(i >= 0, "Nova's actual nemesis reserve card is unavailable.");
      ports.queue(s, E("reveal", { piece: zone.splice(i, 1)[0] }), ...after);
      break;
    }
    case "nova:shuffle-nemesis": {
      const ids: string[] = e.ids || [],
        zone = s.player.setAside || [];
      need(
        new Set(ids).size === ids.length,
        "Nova nemesis shuffle requires distinct physical IDs.",
      );
      for (const id of ids) {
        const i = zone.findIndex((p) => p.id === id);
        need(i >= 0, "The actual Nova nemesis card is unavailable.");
        s.encounter.deck.push(zone.splice(i, 1)[0]);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    }
    default:
      throw Error(`Unknown Nova effect: ${e.type}`);
  }
  return true;
}
