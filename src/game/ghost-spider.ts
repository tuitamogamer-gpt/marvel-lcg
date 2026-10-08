import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
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
const G = (type: string, args: Record<string, unknown> = {}) =>
  E(`ghost-spider:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) =>
  ["ghost_spider", "ghost-spider"].includes(s.heroId);
const definition = (p: Piece) => cards.get(p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const signature = (p: Piece) =>
  definition(p)?.set_code === "ghost_spider" &&
  definition(p)?.faction_code === "hero";
const event = (p: Piece) => definition(p)?.type_code === "event";
const george = (s: GameState) => allInPlay(s).find((p) => p.code === "27007");
const basicKey = (token: string, code: string) =>
  `ghostSpiderBasic:${token}:${code}`;
const braceletKey = (token: string) => `ghostSpiderBracelet:${token}`;

export const GHOST_SPIDER_SCRIPT_CODES = [
  "27001a",
  "27001b",
  "27002",
  "27003",
  "27004",
  "27005",
  "27006",
  "27007",
  "27008",
  "27009",
  "27025",
  "27026",
  "27027",
  "27028",
  "27029",
] as const;
export const GHOST_SPIDER_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const GHOST_SPIDER_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/sinister-motives/";
export const GHOST_SPIDER_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface GhostSpiderBasicReceipt {
  /** A unique native USE instance, not the card ID or merely the round. */
  token: string;
  playerId: string;
  power: "attack" | "thwart" | "defense" | "recover";
  performed: boolean;
  wasHero: boolean;
}
export interface GhostSpiderEventReceipt {
  /** Unique actual event PLAY instance; multiple ability resolutions and
   * shared windows from that same PLAY retain this token. Replaying the same
   * physical event later creates a new token. */
  token: string;
  playerId: string;
  eventId: string;
  code: string;
  kind: "interrupt" | "response" | "action";
  resolved: boolean;
}
export interface GhostSpiderRevealReceipt {
  token: string;
  pieceId: string;
  code: string;
  playerId: string;
  fromEncounterDeck: boolean;
  windowId?: string;
}
export interface GhostSpiderActivationReceipt {
  token: string;
  enemyId: string;
  playerId: string;
  kind: "attack" | "scheme";
}
export type GhostSpiderReactionContext =
  | { kind: "basic"; basic: GhostSpiderBasicReceipt }
  | { kind: "reveal"; reveal: GhostSpiderRevealReceipt }
  | { kind: "activation"; activation: GhostSpiderActivationReceipt };

export interface GhostSpiderPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canReadyPiece(s: GameState, p: Piece): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** Additional native restrictions such as Peril, cannot-play and source
   * legality. The supplied actual source may be hand OR owned George storage. */
  canPlayReaction?(
    s: GameState,
    p: Piece,
    context: GhostSpiderReactionContext,
  ): boolean;
  /** Actual paid PLAY from hand/George, honoring required Mental, discounts,
   * card play/entry windows, actual ownership and atomic cancellation. On PLAY
   * commit call ghostSpiderCommitReaction before status replacement; resolve
   * ghostSpiderReactionEffects as the ability, then collect the real completed
   * event's options only when at least one effect resolved. Complete after on
   * cancellation too, preserving the original reaction window. */
  playReaction(
    s: GameState,
    id: string,
    context: GhostSpiderReactionContext,
    after: Effect[],
  ): void;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** Count actual numerical boost icons on this actual revealed ID, preserving
   * native Scarlet Witch count controls and excluding star icons/Amplify.
   * Resume after with boostTotal (as native scarlet count adapter does). */
  countEncounterBoostIcons(
    s: GameState,
    pieceId: string,
    after: Effect[],
  ): void;
  /** Cancel only this actual card's When Revealed group; preserve physical
   * entry, Surge/Incite, other text and the original revealer/window. */
  cancelWhenRevealed(
    s: GameState,
    receipt: GhostSpiderRevealReceipt,
    after: Effect[],
  ): void;
  activationAvailable(
    s: GameState,
    receipt: GhostSpiderActivationReceipt,
  ): boolean;
  cancelActivation(
    s: GameState,
    receipt: GhostSpiderActivationReceipt,
  ): boolean;
  discardHand(s: GameState, id: string): void;
  removeControlledCard(s: GameState, id: string): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  /** Merge the ACTUAL discard into the existing deck and shuffle once. This
   * printed shuffle is not a draw/reset and creates no invented encounter. */
  shuffleDiscardIntoDeck(s: GameState, after: Effect[]): void;
  handSize(s: GameState): number;
  revealHidden(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  shuffleEncounter(s: GameState): void;
  enemyRemainingHP(s: GameState, p: Piece): number;
  /** Native leave-play cleanup directly into the obligation's storedCards;
   * discard George's actual attached events to their owners, then retain the
   * same George ID. Search only this player's printed four source zones. */
  captureGeorgeForObligation(s: GameState, obligationId: string): void;
  /** Forced Lizard attack against the actual revealing player, even in AE.
   * Resume completion at the attack-resolved boundary (RRG step 6), BEFORE
   * opening after-attack/completed-defense responses, to release the event
   * lock in time for those responses. Keep ordinary forced aftermath,
   * Retaliate and native defense/late-defense sequencing. The performed field
   * reflects ACTUAL attack initiation:
   * Stun/Webbed cancellation before initiation is false; later attacker defeat
   * after initiation is true. */
  attackLizard(
    s: GameState,
    enemyId: string,
    playerId: string,
    completion: Effect,
  ): void;
}

export function ghostSpiderInitializeNemesis(
  s: GameState,
  ports: Pick<GhostSpiderPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.ghostSpiderNemesisSetupComplete) return;
  // An existing empty zone is a played save, not permission to regenerate
  // physical nemesis cards. Native setup/migration owns the root allocator.
  if (s.player.setAside === undefined)
    s.player.setAside = ["27027", "27026", "27028", "27029", "27029"].map(
      (code) => ports.makePiece(s, code),
    );
  s.flags.ghostSpiderNemesisSetupComplete = true;
}
export function ghostSpiderShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    minion = zone.find((p) => p.code === "27027"),
    scheme = zone.find((p) => p.code === "27026"),
    rest = zone.filter((p) => ["27028", "27029"].includes(p.code));
  return [
    ...[minion, scheme]
      .filter((p): p is Piece => !!p)
      .map((p) => G("reveal-setaside", { id: p.id })),
    G("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!minion ? [E("surge", { sourceCode: "01190" })] : []),
  ];
}
export function ghostSpiderStoredPlayable(
  s: GameState,
  ports: Pick<GhostSpiderPorts, "isTextBlank"> = { isTextBlank },
): Piece[] {
  return s.player.inPlay
    .filter((p) => p.code === "27007" && !ports.isTextBlank(s, p))
    .flatMap((p) => (p.storedCards || []).filter(event));
}
export function ghostSpiderTakeStoredForPlay(
  s: GameState,
  id: string,
  ports: Pick<GhostSpiderPorts, "isTextBlank"> = { isTextBlank },
): Piece | undefined {
  for (const g of s.player.inPlay.filter(
    (p) => p.code === "27007" && !ports.isTextBlank(s, p),
  )) {
    const i = (g.storedCards || []).findIndex((p) => p.id === id && event(p));
    if (i >= 0) return g.storedCards!.splice(i, 1)[0];
  }
  return undefined;
}
function availableEvents(s: GameState, ports: GhostSpiderPorts): Piece[] {
  return [
    ...s.player.hand.filter(event),
    ...ghostSpiderStoredPlayable(s, ports),
  ];
}
export function ghostSpiderEventRequirements(p: Piece): Resource[] {
  return p.code === "27006" ? ["mental"] : [];
}
export function ghostSpiderCannotPlayEvents(s: GameState): boolean {
  return Number(s.flags.ghostSpiderColdBloodLock || 0) > 0;
}
export function ghostSpiderPlayRestriction(
  s: GameState,
  p: Piece,
): string | null {
  if (event(p) && ghostSpiderCannotPlayEvents(s))
    return "In Cold Blood prevents you from playing events until its attack resolves.";
  if (["27002", "27004"].includes(p.code))
    return "This response is played after Ghost-Spider finishes an actual basic power.";
  if (p.code === "27005")
    return "Pirouette and Punch is played when an encounter-deck card is revealed.";
  if (p.code === "27006")
    return "Web Binding is played when an enemy would activate.";
  if (p.code === "27003" && s.player.form !== "alter")
    return "Parental Guidance requires alter-ego form.";
  if (p.code === "27003") {
    const g = george(s);
    if (g && (g.storedCards || []).length >= 3)
      return "George Stacy cannot hold more than three events.";
    if (
      g &&
      !s.player.hand
        .concat(s.player.discard)
        .some((a) => event(a) && a.id !== p.id)
    )
      return "Parental Guidance needs an actual event to attach.";
    if (
      !g &&
      !s.player.deck.concat(s.player.discard).some((p) => p.code === "27007")
    )
      return "Parental Guidance needs an actual George Stacy to find.";
  }
  return null;
}
export function ghostSpiderCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "27007") p.storedCards ||= [];
  return [];
}

function reactionAllowed(
  s: GameState,
  p: Piece,
  context: GhostSpiderReactionContext,
  ports: GhostSpiderPorts,
): boolean {
  return (
    active(s) &&
    s.player.form === "hero" &&
    !ghostSpiderCannotPlayEvents(s) &&
    (!ports.canPlayReaction || ports.canPlayReaction(s, p, context)) &&
    ports.canPay(
      s,
      ports.cardCost(s, p),
      ghostSpiderEventRequirements(p),
      p.id,
      p.code,
    )
  );
}
export function ghostSpiderBasicPowerOptions(
  s: GameState,
  basic: GhostSpiderBasicReceipt,
  after: Effect[],
  ports: GhostSpiderPorts,
): Option[] {
  if (
    !basic.performed ||
    !basic.wasHero ||
    basic.playerId !== s.activePlayerId ||
    basic.power === "recover"
  )
    return [];
  const context: GhostSpiderReactionContext = { kind: "basic", basic };
  return availableEvents(s, ports)
    .filter(
      (p) =>
        ["27002", "27004"].includes(p.code) &&
        !s.flags[basicKey(basic.token, p.code)] &&
        reactionAllowed(s, p, context, ports) &&
        (p.code === "27002"
          ? s.player.stunned || ports.enemyTargets(s, true).length > 0
          : s.player.confused || ports.schemeTargets(s, true).length > 0),
    )
    .map((p) =>
      O(
        p.id,
        definition(p).name,
        [G("play-reaction", { id: p.id, context, after })],
        p.code,
      ),
    );
}
export function ghostSpiderAfterBasicPower(
  _s: GameState,
  basic: GhostSpiderBasicReceipt,
  after: Effect[] = [],
): Effect[] {
  return [G("basic-window", { basic, after, actorId: basic.playerId })];
}
export function ghostSpiderRevealOptions(
  s: GameState,
  reveal: GhostSpiderRevealReceipt,
  after: Effect[],
  ports: GhostSpiderPorts,
): Option[] {
  if (!reveal.fromEncounterDeck) return [];
  const context: GhostSpiderReactionContext = { kind: "reveal", reveal };
  return availableEvents(s, ports)
    .filter((p) => p.code === "27005" && reactionAllowed(s, p, context, ports))
    .map((p) =>
      O(
        p.id,
        "Pirouette and Punch · damage and cancel When Revealed",
        [G("play-reaction", { id: p.id, context, after })],
        p.code,
      ),
    );
}
export function ghostSpiderActivationOptions(
  s: GameState,
  activation: GhostSpiderActivationReceipt,
  after: Effect[],
  ports: GhostSpiderPorts,
): Option[] {
  if (!ports.activationAvailable(s, activation)) return [];
  const context: GhostSpiderReactionContext = {
    kind: "activation",
    activation,
  };
  return availableEvents(s, ports)
    .filter((p) => p.code === "27006" && reactionAllowed(s, p, context, ports))
    .map((p) =>
      O(
        p.id,
        "Web Binding · cancel this activation (Mental required)",
        [G("play-reaction", { id: p.id, context, after })],
        p.code,
      ),
    );
}
/** Native PLAY commit hook, BEFORE all-effect status replacements. A canceled
 * ability still consumes its printed Max once-per-basic-use allowance. */
export function ghostSpiderCommitReaction(
  s: GameState,
  p: Piece,
  context: GhostSpiderReactionContext,
): void {
  if (context.kind !== "basic" || !["27002", "27004"].includes(p.code)) return;
  const key = basicKey(context.basic.token, p.code);
  need(!s.flags[key], "This event already used its max once per basic power.");
  s.flags[key] = true;
}
export function ghostSpiderReactionEffects(
  _s: GameState,
  p: Piece,
  context: GhostSpiderReactionContext,
): Effect[] {
  if (p.code === "27002" && context.kind === "basic")
    return [G("kick", { id: p.id })];
  if (p.code === "27004" && context.kind === "basic")
    return [G("flip", { id: p.id })];
  if (p.code === "27005" && context.kind === "reveal")
    return [G("pirouette", { id: p.id, reveal: context.reveal })];
  if (p.code === "27006" && context.kind === "activation")
    return [G("binding", { id: p.id, activation: context.activation })];
  throw Error(
    "The signature event does not match this native reaction window.",
  );
}
/** Call in the same actual response window as attack/thwart responses, after
 * the complete event ability. NOT after unrelated windows have been closed. */
export function ghostSpiderEventResolutionOptions(
  s: GameState,
  receipt: GhostSpiderEventReceipt,
  after: Effect[],
  ports: GhostSpiderPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    receipt.playerId !== s.activePlayerId ||
    cards.get(receipt.code)?.type_code !== "event" ||
    !receipt.resolved ||
    receipt.kind === "action"
  )
    return [];
  const options: Option[] = [];
  if (
    active(s) &&
    !ports.isIdentityTextBlank?.(s) &&
    s.flags.ghostSpiderDizzyPhase !== phaseKey(s) &&
    s.player.exhausted &&
    ports.canReadyIdentity(s, s.activePlayerId)
  )
    options.push(
      O(
        "dizzying-reflexes",
        "Dizzying Reflexes · ready Ghost-Spider",
        [G("dizzy", { receipt, after })],
        "27001a",
      ),
    );
  if (!s.flags[braceletKey(receipt.token)])
    options.push(
      ...s.player.inPlay
        .filter(
          (p) => p.code === "27009" && !p.exhausted && !ports.isTextBlank(s, p),
        )
        .map((p) =>
          O(
            p.id,
            "Web-Bracelet · exhaust to draw 1 (max 1 per event)",
            [G("bracelet", { id: p.id, receipt, after })],
            p.code,
          ),
        ),
    );
  return options;
}
export function ghostSpiderEventResolved(
  _s: GameState,
  receipt: GhostSpiderEventReceipt,
  after: Effect[] = [],
): Effect[] {
  return [G("event-window", { receipt, after, actorId: receipt.playerId })];
}
export function ghostSpiderEvent(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "27003"
    ? [G("parental", { id: p.id })]
    : ["27002", "27004", "27005", "27006"].includes(p.code)
      ? []
      : null;
}

export function ghostSpiderAbilityOptions(
  s: GameState,
  id: string,
  ports: GhostSpiderPorts,
): Option[] {
  if (["hero", "identity"].includes(id)) {
    if (
      !active(s) ||
      s.player.form !== "alter" ||
      ports.isIdentityTextBlank?.(s) ||
      s.flags.ghostSpiderGwenRound === s.round
    )
      return [];
    const options: Option[] = [],
      ticket = s.player.discard.find((p) => p.code === "27008"),
      g = george(s);
    if (ticket)
      options.push(
        O(
          "gwen-ticket",
          "Shuffle Ticket to the Multiverse into your deck",
          [G("gwen-ticket", { id: ticket.id })],
          "27001b",
        ),
      );
    if (g && g.exhausted && ports.canReadyPiece(s, g))
      options.push(
        O(
          "gwen-george",
          "Ready George Stacy",
          [G("gwen-george", { id: g.id })],
          "27001b",
        ),
      );
    return options;
  }
  const p = own(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "27007" &&
    !p.exhausted &&
    (p.storedCards || []).length < 3 &&
    s.player.hand.some(event)
  )
    return [
      O(
        "george-store",
        "Exhaust George Stacy · attach an event (max 3)",
        [G("george-store", { id })],
        p.code,
      ),
    ];
  if (p.code === "27008")
    return [
      O(
        "ticket-multiverse",
        "Remove Ticket · reset your hand/deck and ready Ghost-Spider cards",
        [G("ticket", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "27025" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted &&
    p.storedCards?.some((a) => a.code === "27007")
  )
    return [
      O(
        "worried-father",
        "Exhaust Gwen · remove Worried Father and recover George",
        [G("remove-worried", { id })],
        p.code,
      ),
    ];
  return [];
}
export function ghostSpiderAbility(
  s: GameState,
  id: string,
  ports: GhostSpiderPorts,
  action?: string,
): boolean {
  const options = ghostSpiderAbilityOptions(s, id, ports);
  if (!options.length) return false;
  const choice = action
    ? options.find((o) => o.id === action)
    : options.length === 1
      ? options[0]
      : undefined;
  need(!action || choice, "Ghost-Spider's action is unavailable.");
  if (choice) ports.queue(s, ...choice.effects);
  else
    ports.choose(s, "Gwen Stacy", "Choose one once-per-round action.", options);
  return true;
}
export function ghostSpiderEnemyModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<GhostSpiderPorts, "isTextBlank"> = { isTextBlank },
) {
  const count = s.attachments.filter(
    (a) =>
      a.code === "27028" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
  ).length;
  return { health: 4 * count, traits: count ? ["Creature"] : [] };
}
export function ghostSpiderVillainPhaseBegins(
  s: GameState,
  ports: Pick<GhostSpiderPorts, "isTextBlank"> = { isTextBlank },
): Effect[] {
  return [
    ...s.sideSchemes
      .filter((p) => p.code === "27026" && !ports.isTextBlank(s, p))
      .map((p) => G("heal-each", { id: p.id, mandatory: true, forced: true })),
    ...s.minions
      .filter((p) => p.code === "27027" && !ports.isTextBlank(s, p))
      .map((p) =>
        G("heal-lizard", { id: p.id, mandatory: true, forced: true }),
      ),
  ];
}
export function ghostSpiderEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "27025") {
    const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
    return owner ? [G("worried", { id: p.id, actorId: owner.id })] : [];
  }
  if (p.code === "27026" || p.code === "27027") return [];
  if (p.code === "27028")
    return [
      G("injection", {
        id: p.id,
        actorId: s.firstPlayerId,
        resumeActorId: s.activePlayerId,
      }),
    ];
  if (p.code === "27029")
    return [G("cold-blood", { playerId: s.activePlayerId })];
  return null;
}
export function ghostSpiderBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["27025", "27026", "27027", "27028", "27029"].includes(p.code)
    ? []
    : null;
}

function take(zones: Piece[][], id: string): Piece | undefined {
  const z = zones.find((z) => z.some((p) => p.id === id));
  return z?.splice(
    z.findIndex((p) => p.id === id),
    1,
  )[0];
}
function target(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: GhostSpiderPorts,
) {
  if (!targets.length) {
    ports.queue(s, ...(effect.after || []));
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
  );
}
export function resolveGhostSpiderEffect(
  s: GameState,
  e: Effect,
  ports: GhostSpiderPorts,
): boolean {
  if (!e.type.startsWith("ghost-spider:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "ghost-spider:basic-window": {
      const next = G("basic-window", { basic: e.basic, after }),
        choices = ghostSpiderBasicPowerOptions(s, e.basic, [next], ports);
      if (choices.length)
        ports.choose(
          s,
          "Ghost-Spider · basic power responses",
          "After the complete basic power, each named response can be played once.",
          [...choices, O("pass", "Pass remaining responses", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:play-reaction": {
      const p = availableEvents(s, ports).find((p) => p.id === e.id);
      const context: GhostSpiderReactionContext = e.context;
      const legal =
        context.kind === "basic"
          ? ghostSpiderBasicPowerOptions(s, context.basic, [], ports)
          : context.kind === "reveal"
            ? ghostSpiderRevealOptions(s, context.reveal, [], ports)
            : ghostSpiderActivationOptions(s, context.activation, [], ports);
      need(
        p && legal.some((o) => o.id === p.id),
        "This actual Ghost-Spider event cannot be played now.",
      );
      ports.playReaction(s, p!.id, e.context, after);
      break;
    }
    case "ghost-spider:kick":
      if (consumeStatus(s.player, "stunned")) {
        ports.queue(s, ...after);
        break;
      }
      target(
        s,
        "Ghost Kick",
        ports.enemyTargets(s, true),
        G("kick-target", { id: e.id, after }),
        ports,
      );
      break;
    case "ghost-spider:kick-target":
      need(
        ports.enemyTargets(s, true).some((t) => t.id === e.target),
        "Ghost Kick requires a legal enemy.",
      );
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 6,
            source: "hero",
            attack: true,
            attackInitiated: true,
            abilitySource: e.id,
          }),
        ],
        after,
      );
      break;
    case "ghost-spider:flip":
      if (consumeStatus(s.player, "confused")) {
        ports.queue(s, ...after);
        break;
      }
      target(
        s,
        "Phantom Flip",
        ports.schemeTargets(s, true),
        G("flip-target", { id: e.id, after }),
        ports,
      );
      break;
    case "ghost-spider:flip-target":
      need(
        ports.schemeTargets(s, true).some((t) => t.id === e.target),
        "Phantom Flip requires a legal scheme.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 5,
          source: "hero",
          action: true,
          basic: false,
          thwartInitiated: true,
          abilitySource: e.id,
        }),
        ...after,
      );
      break;
    case "ghost-spider:pirouette":
      ports.countEncounterBoostIcons(s, e.reveal.pieceId, [
        G("pirouette-counted", { id: e.id, reveal: e.reveal, after }),
      ]);
      break;
    case "ghost-spider:pirouette-counted":
      ports.queue(
        s,
        E("damage", {
          target: s.villain.id,
          amount: 1 + Number(e.boostTotal || 0),
          source: "hero",
          attack: false,
          abilitySource: e.id,
        }),
        G("pirouette-cancel", { reveal: e.reveal, after }),
      );
      break;
    case "ghost-spider:pirouette-cancel":
      ports.cancelWhenRevealed(s, e.reveal, after);
      break;
    case "ghost-spider:binding": {
      const receipt: GhostSpiderActivationReceipt = e.activation,
        canceled = ports.cancelActivation(s, receipt),
        minion = s.minions.find((p) => p.id === receipt.enemyId);
      ports.queue(
        s,
        ...(canceled && minion
          ? [
              E("damage", {
                target: minion.id,
                amount: 4,
                source: "hero",
                attack: false,
                abilitySource: e.id,
              }),
            ]
          : []),
        ...after,
      );
      break;
    }
    case "ghost-spider:event-window": {
      const next = G("event-window", { receipt: e.receipt, after }),
        options = ghostSpiderEventResolutionOptions(
          s,
          e.receipt,
          [next],
          ports,
        );
      if (options.length)
        ports.choose(
          s,
          "Ghost-Spider · resolved event responses",
          "Choose a response after the actual event ability. Each printed limit still applies.",
          [...options, O("pass", "Pass remaining responses", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:dizzy":
      need(
        ghostSpiderEventResolutionOptions(s, e.receipt, [], ports).some(
          (o) => o.id === "dizzying-reflexes",
        ),
        "Dizzying Reflexes is unavailable.",
      );
      s.flags.ghostSpiderDizzyPhase = phaseKey(s);
      ports.queue(
        s,
        E("ready", { target: `hero:${s.activePlayerId}` }),
        ...after,
      );
      break;
    case "ghost-spider:bracelet": {
      const p = own(s, e.id, "27009");
      need(
        p &&
          ghostSpiderEventResolutionOptions(s, e.receipt, [], ports).some(
            (o) => o.id === p.id,
          ),
        "This Web-Bracelet cannot respond to this event again.",
      );
      p!.exhausted = true;
      s.flags[braceletKey(e.receipt.token)] = true;
      ports.queue(s, E("draw", { amount: 1 }), ...after);
      break;
    }
    case "ghost-spider:gwen-ticket": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.ghostSpiderGwenRound !== s.round &&
          !ports.isIdentityTextBlank?.(s),
        "Gwen's once-per-round action is unavailable.",
      );
      const p = take([s.player.discard], e.id);
      need(p?.code === "27008", "Gwen needs the actual discarded Ticket.");
      s.flags.ghostSpiderGwenRound = s.round;
      s.player.deck.push(p!);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "ghost-spider:gwen-george": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "27007");
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.ghostSpiderGwenRound !== s.round &&
          !ports.isIdentityTextBlank?.(s) &&
          p?.exhausted &&
          ports.canReadyPiece(s, p),
        "Gwen cannot ready George now.",
      );
      s.flags.ghostSpiderGwenRound = s.round;
      ports.queue(s, E("ready", { target: p!.id }), ...after);
      break;
    }
    case "ghost-spider:george-store": {
      const p = own(s, e.id, "27007");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          (p.storedCards || []).length < 3 &&
          s.player.hand.some(event),
        "George needs a hand event, ready state and free storage.",
      );
      p!.exhausted = true;
      ports.choose(
        s,
        "George Stacy",
        "Attach one actual hand event facedown.",
        s.player.hand.filter(event).map((a) =>
          O(
            a.id,
            definition(a).name,
            [
              G("store-event", {
                id: p!.id,
                cardId: a.id,
                from: "hand",
                after,
              }),
            ],
            a.code,
          ),
        ),
      );
      break;
    }
    case "ghost-spider:store-event": {
      const g = allInPlay(s).find((p) => p.id === e.id && p.code === "27007"),
        zones =
          e.from === "hand"
            ? [s.player.hand]
            : [s.player.hand, s.player.discard],
        p = zones.flat().find((p) => p.id === e.cardId && event(p));
      need(
        g && (g.storedCards || []).length < 3 && p,
        "George needs the actual selected event and room below its max3.",
      );
      (g!.storedCards ||= []).push(take(zones, p!.id)!);
      ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:parental": {
      need(s.player.form === "alter", "Parental Guidance requires alter-ego.");
      const g = george(s);
      if (g) {
        need(
          (g.storedCards || []).length < 3,
          "George cannot hold more than3 events.",
        );
        const available = [...s.player.hand, ...s.player.discard].filter(
          (p) => event(p) && p.id !== e.id,
        );
        if (available.length)
          ports.choose(
            s,
            "Parental Guidance",
            "Attach one actual hand/discard event facedown to George.",
            available.map((p) =>
              O(
                p.id,
                definition(p).name,
                [
                  G("store-event", {
                    id: g.id,
                    cardId: p.id,
                    from: "hand-discard",
                    after,
                  }),
                ],
                p.code,
              ),
            ),
          );
        else ports.queue(s, ...after);
      } else {
        ports.revealHidden(s);
        const found = [...s.player.deck, ...s.player.discard].filter(
          (p) => p.code === "27007",
        );
        if (found.length)
          ports.choose(
            s,
            "Parental Guidance",
            "Find the actual George Stacy in your deck/discard.",
            found.map((p) =>
              O(
                p.id,
                "George Stacy",
                [G("parental-george", { id: p.id, after })],
                p.code,
              ),
            ),
          );
        else ports.shufflePlayerDeck(s, after);
      }
      break;
    }
    case "ghost-spider:parental-george": {
      const p = take([s.player.deck, s.player.discard], e.id);
      need(p?.code === "27007", "Find the actual George Stacy.");
      s.player.hand.push(p!);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "ghost-spider:ticket": {
      const p = own(s, e.id, "27008");
      need(
        p && !ports.isTextBlank(s, p),
        "Ticket to the Multiverse is unavailable.",
      );
      ports.removeControlledCard(s, p!.id);
      for (const id of s.player.hand.map((p) => p.id)) ports.discardHand(s, id);
      ports.shuffleDiscardIntoDeck(s, [G("ticket-draw", { after })]);
      break;
    }
    case "ghost-spider:ticket-draw":
      ports.queue(
        s,
        ...(ports.handSize(s) > s.player.hand.length
          ? [E("draw", { amount: ports.handSize(s) - s.player.hand.length })]
          : []),
        G("ticket-ready", { after }),
      );
      break;
    case "ghost-spider:ticket-ready": {
      const ids = s.player.inPlay
        .filter(signature)
        .filter((p) => p.exhausted && ports.canReadyPiece(s, p))
        .map((p) => p.id);
      ports.queue(
        s,
        ...(active(s) &&
        s.player.exhausted &&
        ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: `hero:${s.activePlayerId}` })]
          : []),
        ...ids.map((id) => E("ready", { target: id })),
        ...after,
      );
      break;
    }
    case "ghost-spider:worried": {
      let p = own(s, e.id, "27025");
      if (!p) {
        p = take([s.resolving, s.encounter.dealt, s.encounter.discard], e.id);
        need(
          p?.code === "27025",
          "Worried Father requires its actual revealed source.",
        );
        s.player.inPlay.push(p!);
      }
      ports.revealHidden(s);
      ports.captureGeorgeForObligation(s, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:remove-worried": {
      const p = own(s, e.id, "27025");
      need(
        p &&
          active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          !ports.isTextBlank(s, p) &&
          p.storedCards?.some((a) => a.code === "27007"),
        "Worried Father requires exhausting Gwen.",
      );
      s.player.exhausted = true;
      const g = (p!.storedCards || []).find((a) => a.code === "27007");
      if (g)
        p!.storedCards!.splice(
          p!.storedCards!.findIndex((a) => a.id === g.id),
          1,
        );
      ports.removeControlledCard(s, p!.id);
      if (g) s.player.hand.push(g);
      ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:injection": {
      const candidates = s.minions,
        highest = Math.max(
          0,
          ...candidates.map((p) => ports.enemyRemainingHP(s, p)),
        ),
        found = candidates.filter(
          (p) => ports.enemyRemainingHP(s, p) === highest && highest > 0,
        );
      if (found.length)
        ports.choose(
          s,
          "Experimental Injection",
          "The first player chooses among minions with most remaining HP.",
          found.map((p) =>
            O(
              p.id,
              ports.enemyTargets(s, false).find((t) => t.id === p.id)?.label ||
                definition(p)?.name ||
                "Minion",
              [
                G("inject", {
                  id: e.id,
                  target: p.id,
                  resumeActorId: e.resumeActorId,
                  after,
                }),
              ],
              p.code,
            ),
          ),
        );
      else
        ports.queue(
          s,
          E("surge", { sourceCode: "27028" }),
          G("resume", { actorId: e.resumeActorId, after }),
        );
      break;
    }
    case "ghost-spider:inject": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "27028"),
        minion = s.minions.find((p) => p.id === e.target);
      need(
        p && minion,
        "Experimental Injection needs its actual attachment and minion.",
      );
      p!.attachedTo = minion!.id;
      ports.queue(s, G("resume", { actorId: e.resumeActorId, after }));
      break;
    }
    case "ghost-spider:heal-each": {
      const p = s.sideSchemes.find((p) => p.id === e.id && p.code === "27026");
      if (p && !ports.isTextBlank(s, p))
        ports.queue(
          s,
          ...[s.villain, ...s.minions].map((enemy) =>
            E("heal", { target: enemy.id, amount: 1 }),
          ),
          ...after,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "ghost-spider:heal-lizard": {
      const p = s.minions.find((p) => p.id === e.id && p.code === "27027");
      ports.queue(
        s,
        ...(p && !ports.isTextBlank(s, p)
          ? [E("heal", { target: p.id, amount: 1 })]
          : []),
        ...after,
      );
      break;
    }
    case "ghost-spider:cold-blood": {
      const minion = s.minions.find((p) => p.code === "27027"),
        playerId = e.playerId || s.activePlayerId;
      if (!minion) {
        ports.queue(s, E("surge", { sourceCode: "27029" }), ...after);
        break;
      }
      const view = seatView(s, playerId);
      view.flags.ghostSpiderColdBloodLock =
        Number(view.flags.ghostSpiderColdBloodLock || 0) + 1;
      ports.attackLizard(
        s,
        minion.id,
        playerId,
        G("cold-blood-after", { playerId, after, actorId: playerId }),
      );
      break;
    }
    case "ghost-spider:cold-blood-after": {
      const view = seatView(s, e.playerId);
      view.flags.ghostSpiderColdBloodLock = Math.max(
        0,
        Number(view.flags.ghostSpiderColdBloodLock || 0) - 1,
      );
      ports.queue(
        s,
        ...(!e.performed ? [E("surge", { sourceCode: "27029" })] : []),
        ...after,
      );
      break;
    }
    case "ghost-spider:reveal-setaside": {
      const p = take([s.player.setAside || []], e.id);
      if (p) ports.queue(s, E("reveal", { piece: p }));
      break;
    }
    case "ghost-spider:shuffle-nemesis":
      for (const id of e.ids || []) {
        const p = take([s.player.setAside || []], id);
        if (p) s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    case "ghost-spider:resume":
      ports.queue(s, ...after);
      break;
    default:
      return false;
  }
  return true;
}
