import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
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
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`vision-pack:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const card = (p: Piece) => cards.get(p.code)!;
const traits = (p: Piece) =>
  (card(p)?.traits || "").split(/\.\s*/).filter(Boolean);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const defense = (p: Piece) =>
  card(p)?.type_code === "event" && traits(p).includes("Defense");
const aggressionEvent = (p: Piece) =>
  card(p)?.type_code === "event" && card(p)?.faction_code === "aggression";
type TextPorts = Pick<VisionPackPorts, "isTextBlank">;
const defaultText: TextPorts = { isTextBlank };

/** These six mechanically exact Core aliases preserve their original IDs. */
export const VISION_PACK_CORE_ALIASES = [
  "26017",
  "26020",
  "26023",
  "26025",
  "26026",
  "26027",
] as const;
/** Eleven new faces and two non-Core reprints requiring actual-code adapters. */
export const VISION_PACK_SCRIPT_CODES = [
  "26013",
  "26014",
  "26015",
  "26016",
  "26018",
  "26019",
  "26021",
  "26022",
  "26024",
  "26033",
  "26034",
  "26035",
  "26036",
] as const;
export const VISION_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface VisionPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
    alliance?: boolean,
  ): boolean;
  maxHeroHP(s: GameState, playerId: string): number;
  canReady(s: GameState, id: string): boolean;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  friendlyTargets(s: GameState): AntManTarget[];
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  canPutAlly(s: GameState, p: Piece, playerId: string): boolean;
  /** Group affordability excluding BOTH actual ally IDs from every player's
   * resource sources, in addition to excluding the physical Joining Forces. */
  canPayKeepingAllies(s: GameState, event: Piece, allies: Piece[]): boolean;
  /** Native actual PLAY legality/affordability, with a temporary discount of 3.
   * Do not mutate the ordinary shared next-card discount while probing. */
  canPlayWithDiscount(s: GameState, p: Piece, discount: number): boolean;
  playFromHandDiscount(
    s: GameState,
    id: string,
    discount: number,
    after: Effect[],
  ): void;
  /** Commit both actual hand allies into play before entry/ally-limit windows.
   * Preserve owners/controllers and resume after the ordinary native windows.
   * Neither ally was PLAYED by this batch. */
  putAlliesFromHand(
    s: GameState,
    allies: { id: string; playerId: string }[],
    after: Effect[],
  ): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  attach(s: GameState, id: string, target: string): void;
  discardPiece(s: GameState, id: string): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  revealHidden(s: GameState): void;
  /** Current native defense legality, including any Intangible prohibition.
   * Outside-attack damage prevention may be legal even when attack defense is
   * prohibited. Do not substitute presence of s.attack for the real window. */
  canUseDefense(s: GameState, p: Piece, inAttack: boolean): boolean;
  /** Actual still-facedown boost IDs about to be flipped, not their faces. */
  pendingBoosts(s: GameState): Piece[];
  /** Discard the whole actual facedown boost BEFORE flip. Cancel its numeric
   * icons AND starred ability without revealing it or advancing hiddenInfo. */
  discardBoostBeforeFlip(s: GameState, id: string): void;
  claimDefense(s: GameState, packet?: Effect): void;
  /** Apply prevention to the actual queued/native packet and resume after;
   * preserve dealt-damage receipts, Tough ordering and existing actor flags. */
  preventDamage(s: GameState, amount: number, packet?: Effect): void;
}

export interface VisionPackDamageWindow {
  target: string;
  amount: number;
  source?: string;
  attack?: boolean;
  inAttack?: boolean;
  packet?: Effect;
}

export function visionPackStoredPlayable(
  s: GameState,
  ports: TextPorts = defaultText,
): Piece[] {
  return s.player.inPlay
    .filter((p) => p.code === "26013" && !ports.isTextBlank(s, p))
    .flatMap((p) => (p.storedCards || []).filter(defense));
}
export function visionPackTakeStoredForPlay(
  s: GameState,
  id: string,
  ports: TextPorts = defaultText,
): Piece | undefined {
  for (const p of s.player.inPlay.filter(
    (p) => p.code === "26013" && !ports.isTextBlank(s, p),
  )) {
    const i = (p.storedCards || []).findIndex((p) => p.id === id && defense(p));
    if (i >= 0) return p.storedCards!.splice(i, 1)[0];
  }
  return undefined;
}
export function visionPackDefenseEvents(
  s: GameState,
  ports: TextPorts = defaultText,
): Piece[] {
  return [
    ...s.player.hand.filter(defense),
    ...visionPackStoredPlayable(s, ports),
  ];
}
const eventSource = (
  s: GameState,
  id: string,
  code: string,
  ports: TextPorts,
) =>
  visionPackDefenseEvents(s, ports).find((p) => p.id === id && p.code === code);
export function visionPackAllyEnter(
  s: GameState,
  p: Piece,
  ports: TextPorts = defaultText,
): Effect[] | null {
  if (p.code !== "26013")
    return ["26014", "26015", "26022"].includes(p.code) ? [] : null;
  return !ports.isTextBlank(s, p) && s.player.discard.some(defense)
    ? [
        E("optional", {
          title: "Jocasta",
          image: p.code,
          text: "Attach a discarded Defense event facedown?",
          effects: [P("jocasta", { id: p.id })],
        }),
      ]
    : [];
}
export function visionPackResourcesSpent(
  s: GameState,
  pieces: Piece[],
  ports: Pick<VisionPackPorts, "maxHeroHP">,
): Effect[] {
  return s.player.form === "hero" &&
    s.player.hp < ports.maxHeroHP(s, s.activePlayerId)
    ? pieces
        .filter((p) => p.code === "26021")
        .map((p) =>
          E("optional", {
            title: "Preservation",
            image: p.code,
            text: "Heal 1 damage from your hero?",
            effects: [P("preservation", { actorId: s.activePlayerId })],
          }),
        )
    : [];
}
export function visionPackAttackDamageReduction(
  s: GameState,
  p: Piece,
  ports: TextPorts = defaultText,
): number {
  return p.code === "26015" && !ports.isTextBlank(s, p) ? 1 : 0;
}
export function visionPackCardLeftPlay(s: GameState, p: Piece) {
  for (const seat of s.players)
    delete seatView(s, seat).flags[`visionPackProtector:${p.id}`];
}

const flowSeats = (s: GameState, id?: string) =>
  playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) => p.id !== id && card(p)?.name === "Flow Like Water",
      ),
  );
export function visionPackCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "26033") p.counters = 2;
  return p.code === "26016"
    ? [P("flow-control", { id: p.id })]
    : p.code === "26034" && !p.attachedTo
      ? [P("chance-attach", { id: p.id })]
      : [];
}
export function visionPackCardPlayed(
  s: GameState,
  p: Piece,
  attacker?: string,
  ports: TextPorts = defaultText,
): Effect[] {
  const enemy =
    attacker === s.villain.id
      ? s.villain
      : s.minions.find((p) => p.id === attacker);
  if (!traits(p).includes("Defense") || !enemy) return [];
  return s.player.inPlay
    .filter((p) => p.code === "26016" && !ports.isTextBlank(s, p))
    .map((p) =>
      E("optional", {
        title: "Flow Like Water",
        image: p.code,
        text: "Deal 1 damage to the actual attacking enemy?",
        effects: [
          P("flow-damage", {
            source: p.id,
            target: enemy.id,
            actorId: s.activePlayerId,
          }),
        ],
      }),
    );
}
export function visionPackAttachmentTargets(
  s: GameState,
  p: Piece,
): AntManTarget[] | null {
  return p.code === "26034"
    ? s.sideSchemes
        .filter(
          (scheme) =>
            !allInPlay(s).some(
              (a) =>
                a.id !== p.id &&
                card(a)?.name === "Chance Encounter" &&
                a.attachedTo === scheme.id,
            ),
        )
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code }))
    : null;
}
export function visionPackJoiningPairs(
  s: GameState,
  ports: Pick<VisionPackPorts, "canPutAlly">,
): Array<[Piece, Piece]> {
  const choices = playerOrder(s).flatMap((seat) =>
    seatView(s, seat).player.hand.filter(
      (p) => card(p)?.type_code === "ally" && ports.canPutAlly(s, p, seat.id),
    ),
  );
  return choices
    .filter((p) => traits(p).includes("Avenger"))
    .flatMap((a) =>
      choices
        .filter((b) => b.id !== a.id && traits(b).includes("Guardian"))
        .map((b) => [a, b] as [Piece, Piece]),
    );
}
export function visionPackPaymentAllowed(
  s: GameState,
  p: Piece,
  selectedActualCardIds: string[],
  ports: Pick<VisionPackPorts, "canPutAlly">,
): boolean {
  return (
    p.code !== "26035" ||
    visionPackJoiningPairs(s, ports).some((pair) =>
      pair.every((ally) => !selectedActualCardIds.includes(ally.id)),
    )
  );
}
function rebootTargets(s: GameState, ports: VisionPackPorts) {
  return ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        ports.hasTrait(s, t.id, "Android") &&
        (ports.canReady(s, t.id) ||
          (t.id.startsWith("hero:")
            ? seatView(s, t.id.slice(5)).player.hp <
              ports.maxHeroHP(s, t.id.slice(5))
            : Number(allInPlay(s).find((p) => p.id === t.id)?.damage || 0) >
              0)),
    );
}
function meditationTargets(
  s: GameState,
  event: Piece | undefined,
  ports: VisionPackPorts,
) {
  return s.player.hand.filter(
    (p) => p.id !== event?.id && ports.canPlayWithDiscount(s, p, 3),
  );
}
export function visionPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: VisionPackPorts,
): string | null {
  if (p.code === "26016" && !flowSeats(s).length)
    return "Each player already controls Flow Like Water.";
  if (p.code === "26034" && !visionPackAttachmentTargets(s, p)?.length)
    return "Chance Encounter needs a side scheme without one attached.";
  if (p.code === "26024" && !rebootTargets(s, ports).length)
    return "Reboot needs a friendly Android it can ready or heal.";
  if (p.code === "26035") {
    if (s.player.form !== "hero") return "Joining Forces requires hero form.";
    const pairs = visionPackJoiningPairs(s, ports);
    if (!pairs.length)
      return "Joining Forces needs two distinct eligible hand allies: one Avenger and one Guardian.";
    if (!pairs.some((pair) => ports.canPayKeepingAllies(s, p, pair)))
      return "Joining Forces must retain its two hand allies while paying Alliance costs.";
  }
  if (
    p.code === "26036" &&
    (s.player.form !== "alter" ||
      s.player.exhausted ||
      !meditationTargets(s, p, ports).length)
  )
    return "Meditation needs ready alter-ego and another playable hand card after its discount.";
  if (["26018", "26019"].includes(p.code))
    return "Available in its printed native defense interrupt window.";
  return null;
}
export function visionPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "26036"
    ? [P("meditation-cost", { piece: p, after })]
    : null;
}
export function visionPackEvent(
  _s: GameState,
  p: Piece,
  receipt: { meditationCostPaid?: boolean } = {},
): Effect[] | null {
  return ["26024", "26035", "26036"].includes(p.code)
    ? [P("event", { piece: p, meditationCostPaid: receipt.meditationCostPaid })]
    : null;
}

export function visionPackAbilityOptions(
  s: GameState,
  id: string,
  ports: VisionPackPorts,
): Option[] {
  const p = own(s, id, "26033");
  return p &&
    !ports.isTextBlank(s, p) &&
    s.player.form === "alter" &&
    !p.exhausted &&
    p.counters > 0 &&
    s.player.discard.some(aggressionEvent)
    ? [
        O(
          "train",
          "Exhaust Assault Training · spend 1 training counter and shuffle an Aggression event",
          [P("training", { id })],
          p.code,
        ),
      ]
    : [];
}
export function visionPackAbility(
  s: GameState,
  id: string,
  ports: VisionPackPorts,
  action?: string,
): boolean {
  const o = visionPackAbilityOptions(s, id, ports);
  if (!o.length) return false;
  need(
    !action || action === "train",
    "Assault Training's action is unavailable.",
  );
  ports.queue(s, ...o[0].effects);
  return true;
}
export function visionPackSchemeDefeating(
  s: GameState,
  p: Piece,
  ports: TextPorts = defaultText,
): Effect[] {
  return allInPlay(s)
    .filter(
      (a) =>
        a.code === "26034" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
    )
    .map((a) =>
      E("optional", {
        title: "Chance Encounter",
        image: a.code,
        text: "Search your deck and discard for an ally?",
        effects: [
          P("chance-search", {
            actorId: controller(s, a.id)?.id || s.activePlayerId,
          }),
        ],
      }),
    );
}
export function visionPackAllyUseOptions(
  s: GameState,
  p: Piece,
  action: "attack" | "thwart",
  after: Effect[],
  ports: VisionPackPorts,
): Option[] {
  if (
    p.code !== "26022" ||
    ports.isTextBlank(s, p) ||
    (action === "attack" ? p.stunned : p.confused)
  )
    return [];
  return [1, 2, 3]
    .filter((n) => ports.canPay(s, n, p.id, undefined))
    .map((amount) =>
      O(
        String(amount),
        `Machine Man · spend ${amount} resources for +${amount} ATK/THW for this use`,
        [P("machine-pay", { id: p.id, action, amount, after })],
        p.code,
      ),
    );
}
function eventPayment(
  s: GameState,
  p: Piece,
  effect: Effect,
  after: Effect[],
  ports: VisionPackPorts,
) {
  ports.queue(
    s,
    E("payRequest", {
      title: card(p).name,
      cost: ports.cardCost(s, p),
      piece: p,
      cancelable: false,
      after: [
        E("resolveHandEvent", {
          id: p.id,
          after: [effect],
          continuation: after,
        }),
      ],
    }),
  );
}
export function visionPackBoostOptions(
  s: GameState,
  boostId: string,
  after: Effect[],
  ports: VisionPackPorts,
): Option[] {
  const a = s.attack;
  if (
    s.player.form !== "hero" ||
    !a ||
    (a.targetPlayerId || s.activePlayerId) !== s.activePlayerId ||
    !ports.pendingBoosts(s).some((p) => p.id === boostId)
  )
    return [];
  return visionPackDefenseEvents(s, ports)
    .filter(
      (p) =>
        p.code === "26018" &&
        ports.canUseDefense(s, p, true) &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Defiance · discard this facedown boost instead of flipping it",
        [P("defiance-pay", { id: p.id, boostId, after })],
        p.code,
      ),
    );
}
export function visionPackDamageOptions(
  s: GameState,
  window: VisionPackDamageWindow,
  after: Effect[],
  ports: VisionPackPorts,
): Option[] {
  if (window.amount <= 0) return [];
  const result: Option[] = [],
    p = allInPlay(s).find((p) => p.id === window.target);
  if (p?.code === "26014" && !p.tough && !ports.isTextBlank(s, p)) {
    const owner = controller(s, p.id),
      view = owner && seatView(s, owner);
    if (
      view &&
      view.flags[`visionPackProtector:${p.id}`] !== s.round &&
      ports.canPay(view, 1, undefined, undefined, ["mental"])
    )
      result.push(
        O(
          p.id,
          "Protector · spend 1 mental resource to reduce damage by 1",
          [P("protector-pay", { id: p.id, window, after, actorId: owner!.id })],
          p.code,
        ),
      );
  }
  const heroTarget =
    window.target === "hero" ? `hero:${s.activePlayerId}` : window.target;
  if (
    s.player.form === "hero" &&
    !s.player.tough &&
    heroTarget === `hero:${s.activePlayerId}`
  )
    result.push(
      ...visionPackDefenseEvents(s, ports)
        .filter(
          (p) =>
            p.code === "26019" &&
            ports.canUseDefense(s, p, !!window.inAttack) &&
            ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        )
        .map((p) =>
          O(
            p.id,
            "Side Step · prevent 3 damage",
            [P("side-pay", { id: p.id, window, after })],
            p.code,
          ),
        ),
    );
  return result;
}

export function resolveVisionPackEffect(
  s: GameState,
  e: Effect,
  ports: VisionPackPorts,
): boolean {
  if (!e.type.startsWith("vision-pack:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "vision-pack:jocasta": {
      const source = own(s, e.id, "26013");
      need(source && !ports.isTextBlank(s, source), "Jocasta is unavailable.");
      const choices = s.player.discard.filter(defense);
      if (choices.length)
        ports.choose(
          s,
          "Jocasta",
          "Attach an actual Defense event from your discard facedown.",
          choices.map((p) =>
            O(
              p.id,
              card(p).name,
              [P("jocasta-card", { source: e.id, id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "vision-pack:jocasta-card": {
      const source = own(s, e.source, "26013"),
        i = s.player.discard.findIndex((p) => p.id === e.id && defense(p));
      need(
        source && !ports.isTextBlank(s, source) && i >= 0,
        "Jocasta needs the original Defense event in discard.",
      );
      (source!.storedCards ||= []).push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "vision-pack:preservation":
      if (s.player.form === "hero")
        ports.queue(
          s,
          E("heal", { target: `hero:${s.activePlayerId}`, amount: 1 }),
        );
      break;
    case "vision-pack:flow-control": {
      const source = own(s, e.id, "26016");
      need(source, "Flow Like Water's physical source is unavailable.");
      const seats = flowSeats(s, e.id);
      need(seats.length, "Flow Like Water is max 1 per player.");
      if (seats.length === 1) ports.transferControl(s, e.id, seats[0].id);
      else
        ports.choose(
          s,
          "Flow Like Water",
          "Choose its actual controller.",
          seats.map((seat) =>
            O(
              seat.id,
              seat.heroId,
              [P("flow-controller", { id: e.id, playerId: seat.id })],
              source!.code,
            ),
          ),
        );
      break;
    }
    case "vision-pack:flow-controller":
      need(
        flowSeats(s, e.id).some((seat) => seat.id === e.playerId),
        "This player already controls Flow Like Water.",
      );
      ports.transferControl(s, e.id, e.playerId);
      break;
    case "vision-pack:flow-damage": {
      const source = own(s, e.source, "26016");
      if (
        source &&
        !ports.isTextBlank(s, source) &&
        ports.enemyTargets(s, false).some((t) => t.id === e.target)
      )
        ports.queue(
          s,
          E("damage", {
            target: e.target,
            amount: 1,
            source: source.id,
            attack: false,
          }),
        );
      break;
    }
    case "vision-pack:chance-attach": {
      const p = own(s, e.id, "26034");
      need(p, "Chance Encounter is unavailable.");
      const targets = visionPackAttachmentTargets(s, p!) || [];
      need(targets.length, "Chance Encounter needs an unoccupied side scheme.");
      ports.choose(
        s,
        "Chance Encounter",
        "Attach to an actual side scheme.",
        targets.map((t) =>
          O(
            t.id,
            t.label,
            [P("chance-target", { id: e.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "vision-pack:chance-target": {
      const p = own(s, e.id, "26034");
      need(
        p && visionPackAttachmentTargets(s, p)!.some((t) => t.id === e.target),
        "Chance Encounter's scheme is unavailable or occupied.",
      );
      ports.attach(s, e.id, e.target);
      break;
    }
    case "vision-pack:chance-search": {
      const choices = [...s.player.deck, ...s.player.discard].filter(
        (p) => card(p)?.type_code === "ally",
      );
      ports.revealHidden(s);
      if (choices.length)
        ports.choose(
          s,
          "Chance Encounter",
          "Choose an actual ally from your deck or discard.",
          choices.map((p) =>
            O(
              p.id,
              card(p).name,
              [P("chance-card", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.shufflePlayerDeck(s, after);
      break;
    }
    case "vision-pack:chance-card": {
      const zone = [s.player.deck, s.player.discard].find((z) =>
        z.some((p) => p.id === e.id && card(p)?.type_code === "ally"),
      );
      need(zone, "Chance Encounter needs the actual searched ally.");
      s.player.hand.push(
        zone!.splice(
          zone!.findIndex((p) => p.id === e.id),
          1,
        )[0],
      );
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "vision-pack:training": {
      need(
        visionPackAbilityOptions(s, e.id, ports).length,
        "Assault Training is unavailable.",
      );
      ports.choose(
        s,
        "Assault Training",
        "Choose an actual discarded Aggression event.",
        s.player.discard
          .filter(aggressionEvent)
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [P("training-card", { source: e.id, id: p.id, after })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "vision-pack:training-card": {
      const source = own(s, e.source, "26033"),
        i = s.player.discard.findIndex(
          (p) => p.id === e.id && aggressionEvent(p),
        );
      need(
        source &&
          visionPackAbilityOptions(s, source.id, ports).length &&
          i >= 0,
        "Assault Training needs its counter and actual discarded Aggression event.",
      );
      source!.exhausted = true;
      source!.counters--;
      if (!source!.counters) ports.discardPiece(s, source!.id);
      const j = s.player.discard.findIndex((p) => p.id === e.id);
      s.player.deck.push(s.player.discard.splice(j, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "vision-pack:meditation-cost": {
      const p: Piece = e.piece;
      need(
        !visionPackPlayRestriction(s, p, ports),
        "Meditation requires ready alter-ego and a playable discounted hand card.",
      );
      s.player.exhausted = true;
      ports.queue(
        s,
        ...after.map((e) => ({ ...e, visionMeditationCostPaid: true })),
      );
      break;
    }
    case "vision-pack:event": {
      const p: Piece = e.piece;
      if (p.code === "26024") {
        const targets = rebootTargets(s, ports);
        need(
          targets.length,
          "Reboot needs an actual readyable or damaged Android.",
        );
        ports.choose(
          s,
          "Reboot",
          "Choose a friendly Android to ready and heal.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                E("ready", { target: t.id }),
                E("heal", { target: t.id, amount: 1 }),
                ...after,
              ],
              t.code,
            ),
          ),
        );
      } else if (p.code === "26035") {
        const pairs = visionPackJoiningPairs(s, ports);
        need(
          pairs.length,
          "Joining Forces must retain two eligible actual hand allies after payment.",
        );
        ports.choose(
          s,
          "Joining Forces",
          "Choose two distinct hand allies: one Avenger and one Guardian.",
          pairs.map(([a, b]) =>
            O(
              `${a.id}|${b.id}`,
              `${card(a).name} + ${card(b).name}`,
              [P("joining", { ids: [a.id, b.id], after })],
              a.code,
            ),
          ),
        );
      } else if (p.code === "26036") {
        const choices = meditationTargets(s, p, ports);
        need(
          e.meditationCostPaid && s.player.form === "alter" && choices.length,
          "Meditation needs an actual playable card with its discount.",
        );
        ports.choose(
          s,
          "Meditation",
          "Play an actual hand card, reducing its resource cost by 3.",
          choices.map((p) =>
            O(
              p.id,
              card(p).name,
              [P("meditation-play", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      }
      break;
    }
    case "vision-pack:joining": {
      const pair = visionPackJoiningPairs(s, ports).find(
        (pair) => pair[0].id === e.ids?.[0] && pair[1].id === e.ids?.[1],
      );
      need(pair, "Joining Forces needs its actual two distinct hand allies.");
      ports.putAlliesFromHand(
        s,
        pair!.map((p) => ({
          id: p.id,
          playerId: playerOrder(s).find((seat) =>
            seatView(s, seat).player.hand.some((a) => a.id === p.id),
          )!.id,
        })),
        after,
      );
      break;
    }
    case "vision-pack:meditation-play": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && ports.canPlayWithDiscount(s, p, 3),
        "Meditation must play the original hand card with legal discounted payment.",
      );
      ports.playFromHandDiscount(s, e.id, 3, after);
      break;
    }
    case "vision-pack:machine-pay": {
      const p = own(s, e.id, "26022");
      need(
        p &&
          visionPackAllyUseOptions(s, p, e.action, after, ports).some(
            (o) => o.id === String(e.amount),
          ),
        "Machine Man needs its actual use and one to three payable resources.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Machine Man",
          cost: e.amount,
          requirements: [],
          abilityCost: true,
          cancelable: true,
          cancellationQueue: after,
          after: [
            P("machine-paid", {
              id: e.id,
              action: e.action,
              amount: e.amount,
              after,
            }),
          ],
        }),
      );
      break;
    }
    case "vision-pack:machine-paid": {
      need(
        own(s, e.id, "26022"),
        "Machine Man left play before completing this use.",
      );
      ports.queue(
        s,
        ...after.map((e2) => ({
          ...e2,
          visionPackMachineBonus: e.amount,
          visionPackMachineId: e.id,
          visionPackMachineAction: e.action,
        })),
      );
      break;
    }
    case "vision-pack:defiance-pay": {
      const p = eventSource(s, e.id, "26018", ports);
      need(
        p &&
          visionPackBoostOptions(s, e.boostId, after, ports).some(
            (o) => o.id === e.id,
          ),
        "Defiance needs the actual facedown boost and legal Defense event.",
      );
      eventPayment(s, p!, P("defiance", { boostId: e.boostId }), after, ports);
      break;
    }
    case "vision-pack:defiance":
      need(
        ports.pendingBoosts(s).some((p) => p.id === e.boostId),
        "Defiance's actual boost already turned faceup or moved.",
      );
      ports.claimDefense(s);
      ports.discardBoostBeforeFlip(s, e.boostId);
      break;
    case "vision-pack:side-pay": {
      const p = eventSource(s, e.id, "26019", ports);
      need(
        p &&
          visionPackDamageOptions(s, e.window, after, ports).some(
            (o) => o.id === e.id,
          ),
        "Side Step needs the actual legal damage window and event.",
      );
      eventPayment(s, p!, P("side", { window: e.window }), after, ports);
      break;
    }
    case "vision-pack:side": {
      ports.claimDefense(s, e.window.packet);
      ports.preventDamage(s, 3, e.window.packet);
      const source = e.window.source || e.window.packet?.source,
        enemy =
          source === s.villain.id
            ? s.villain
            : s.minions.find((p) => p.id === source);
      if ((e.paidForCard || e.paid || []).includes("energy") && enemy)
        ports.queue(
          s,
          E("damage", {
            target: enemy.id,
            amount: 1,
            source: "hero",
            attack: false,
          }),
        );
      break;
    }
    case "vision-pack:protector-pay": {
      const p = own(s, e.id, "26014");
      need(
        p &&
          visionPackDamageOptions(s, e.window, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Protector needs its actual damage window and unused round limit.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Protector",
          cost: 1,
          requirements: ["mental"],
          abilityCost: true,
          cancelable: true,
          cancellationQueue: after,
          paymentCommit: [P("protector-cost", { id: p!.id })],
          after: [
            P("protector-reduce", { id: p!.id, window: e.window }),
            ...after,
          ],
        }),
      );
      break;
    }
    case "vision-pack:protector-cost":
      need(
        own(s, e.id, "26014") &&
          s.flags[`visionPackProtector:${e.id}`] !== s.round,
        "Protector's round limit is unavailable.",
      );
      s.flags[`visionPackProtector:${e.id}`] = s.round;
      break;
    case "vision-pack:protector-reduce":
      ports.preventDamage(s, 1, e.window.packet);
      break;
    default:
      throw Error(`Unknown Vision pack effect: ${e.type}`);
  }
  return true;
}
