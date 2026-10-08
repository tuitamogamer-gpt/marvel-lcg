import { eventPlaySources } from "./card-text.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { giveStatus } from "./keywords.js";
import { card as nativeCard } from "./cards.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
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
  E("nebula-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const printedTrait = (p: Piece, name: string) =>
  (cards.get(p.code)?.traits || "").split(/\.\s*/).includes(name);
type TextPorts = Pick<NebulaPackPorts, "isTextBlank">;
const blank = (s: GameState, p: Piece, ports?: TextPorts) =>
  ports ? ports.isTextBlank(s, p) : isTextBlank(s, p);
const own = (s: GameState, id: string, code?: string, ports?: TextPorts) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !blank(s, p, ports),
  );
const attachments = (
  s: GameState,
  target: string,
  code: string,
  ports?: TextPorts,
) =>
  allInPlay(s).filter(
    (p) => p.attachedTo === target && p.code === code && !blank(s, p, ports),
  );
const identityName = (s: GameState, id: string) => {
  const v = seatView(s, id);
  return (
    [...cards.values()].find(
      (c) =>
        c.set_code === v.heroId &&
        c.type_code === (v.player.form === "hero" ? "hero" : "alter_ego"),
    )?.name || v.heroId
  );
};
const namedIdentity = (s: GameState, name: string) =>
  playerOrder(s).some((seat) =>
    [...cards.values()].some(
      (c) =>
        c.set_code === seat.heroId &&
        ["hero", "alter_ego"].includes(c.type_code) &&
        c.name === name,
    ),
  );
const namedFriendly = (s: GameState, name: string) =>
  namedIdentity(s, name) ||
  allInPlay(s).some(
    (p) =>
      cards.get(p.code)?.type_code === "ally" &&
      [cards.get(p.code)?.name, cards.get(p.code)?.subname].includes(name),
  );

/** Only these printings are physically equivalent to already implemented Core cards. */
export const NEBULA_PACK_CORE_ALIASES = [
  "22017",
  "22019",
  "22023",
  "22024",
  "22025",
  "22026",
] as const;
export const NEBULA_PACK_SCRIPT_CODES = [
  "22011",
  "22012",
  "22013",
  "22014",
  "22015",
  "22016",
  "22018",
  "22020",
  "22021",
  "22022",
  "22032",
  "22033",
  "22034",
  "22035",
] as const;
export const NEBULA_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const NEBULA_PACK_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface NebulaPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface NebulaPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  friendlyTargets(s: GameState): NebulaPackTarget[];
  enemyTargets(s: GameState, attack?: boolean): NebulaPackTarget[];
  canGiveStatus(s: GameState, target: string, status: "confused"): boolean;
  canReady(s: GameState, target: string): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  heroThwart(s: GameState): number;
  discardPiece(s: GameState, id: string): void;
  attach(s: GameState, upgradeId: string, targetId: string): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
  /** Move the actual selected encounter-deck instance into ordinary reveal.
   * Resolve its complete reveal/cancellation windows BEFORE after; a canceled
   * side scheme still fulfills the reveal cost. Do not generate a new card. */
  revealEncounterFromDeck(s: GameState, id: string, after: Effect[]): void;
  /** One actual top card, returned even if its deck immediately resets. The
   * player is explicit; preserve ownership, original zones and reset rules. */
  discardPlayerTop(s: GameState, playerId: string): Piece | undefined;
  discardEncounterTop(s: GameState): Piece | undefined;
  /** Current physical faceup boost only, before its ability resolves. Numeric
   * icons are independent; an uncancelable ability is unavailable. */
  canCancelBoostAbility(s: GameState, p: Piece): boolean;
  cancelBoostAbility(s: GameState, boostId: string): void;
}

function controlSeats(s: GameState, code: string, id?: string) {
  return playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) =>
          p.id !== id &&
          (code === "22033"
            ? printedTrait(p, "Team")
            : cards.get(p.code)?.name === cards.get(code)?.name),
      ),
  );
}
export function nebulaPackAttachmentTargets(
  s: GameState,
  code: string,
  ports: Pick<NebulaPackPorts, "hasTrait" | "friendlyTargets">,
): NebulaPackTarget[] {
  if (!["22032", "22035"].includes(code)) return [];
  return ports
    .friendlyTargets(s)
    .map((target) => ({
      ...target,
      id: target.id === "hero" ? `hero:${s.activePlayerId}` : target.id,
    }))
    .filter((target) => {
      const p = allInPlay(s).find((p) => p.id === target.id);
      if (
        code === "22032" &&
        (!p ||
          cards.get(p.code)?.type_code !== "ally" ||
          !ports.hasTrait(s, target.id, "Guardian"))
      )
        return false;
      return !allInPlay(s).some(
        (a) =>
          a.attachedTo === target.id &&
          cards.get(a.code)?.name === cards.get(code)?.name,
      );
    });
}
export function nebulaPackModifiers(
  s: GameState,
  target: string,
  ports?: TextPorts,
) {
  const normalized = target === "hero" ? `hero:${s.activePlayerId}` : target;
  return {
    attack: attachments(s, normalized, "22032", ports).length * 2,
    health: attachments(s, normalized, "22035", ports).length,
    guardian: attachments(s, normalized, "22035", ports).length > 0,
    piercing: attachments(s, normalized, "22032", ports).length > 0,
  };
}
export function nebulaPackAllyLimit(s: GameState, ports?: TextPorts) {
  return s.player.inPlay.filter(
    (p) => p.code === "22021" && !blank(s, p, ports),
  ).length;
}
export function nebulaPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: NebulaPackPorts,
): string | null {
  if (p.code === "22018")
    return "Available automatically after your hero makes a basic thwart.";
  if (["22014", "22033"].includes(p.code) && !controlSeats(s, p.code).length)
    return p.code === "22033"
      ? "Each player already controls a Team card."
      : "Each player already controls Justice Served.";
  if (
    ["22021", "22035"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Guardian")
  )
    return "Your identity must have the Guardian trait.";
  if (
    ["22032", "22035"].includes(p.code) &&
    !nebulaPackAttachmentTargets(s, p.code, ports).length
  )
    return "There is no eligible attachment target.";
  if (
    p.code === "22022" &&
    (!namedFriendly(s, "Gamora") || !namedFriendly(s, "Nebula"))
  )
    return "Daughters of Thanos requires both Gamora and Nebula in play.";
  if (p.code === "22015") {
    if (
      playerOrder(s).some(
        (seat) => seatView(s, seat).flags.nebulaPackOneWayRound === s.round,
      )
    )
      return "One Way or Another is limited to 1 per round across all players.";
    if (
      !s.encounter.deck.some(
        (p) => cards.get(p.code)?.type_code === "side_scheme",
      )
    )
      return "One Way or Another requires a side scheme in the encounter deck.";
  }
  return null;
}
/** Actual PLAY only, before cancellation; putting cards into play does not call this. */
export function nebulaPackCardPlayed(s: GameState, p: Piece): void {
  if (p.code === "22015") s.flags.nebulaPackOneWayRound = s.round;
}
export function nebulaPackRoundEnded(s: GameState): void {
  for (const seat of s.players)
    delete seatView(s, seat).flags.nebulaPackOneWayRound;
}
export function nebulaPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "22034") p.counters = 2;
  if (["22032", "22035"].includes(p.code))
    return [P("attach", { id: p.id, code: p.code })];
  return ["22014", "22033"].includes(p.code)
    ? [P("control", { id: p.id, code: p.code })]
    : [];
}
/** Search/reveal is a before-arrow cost, including the ordinary When Revealed
 * and cancellation windows. Shuffling occurs at the end after drawing. */
export function nebulaPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  return p.code === "22015" ? [P("one-way-cost", { after })] : after;
}
export function nebulaPackEvent(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "22015")
    return [E("draw", { amount: 3 }), P("shuffle-encounter")];
  if (p.code === "22022") return [E("draw", { amount: 3 })];
  return p.code === "22018" ? [] : null;
}
/** Mental icons are the host's actual allocation PAID FOR EROS, excluding
 * surplus resources. Eros only responds when PLAYED FROM HAND (RRG1.8p67). */
export function nebulaPackAllyEnter(
  s: GameState,
  p: Piece,
  fromHand: boolean,
  paidForCard: Resource[] = [],
  ports?: TextPorts & Partial<Pick<NebulaPackPorts, "canGiveStatus">>,
): Effect[] | null {
  if (!["22011", "22012", "22013", "22020"].includes(p.code)) return null;
  const count = paidForCard.filter((r) => r === "mental").length;
  const eligible = s.minions.some((minion) =>
    ports?.canGiveStatus
      ? ports.canGiveStatus(s, minion.id, "confused")
      : giveStatus(
          { ...minion },
          cards.get(minion.code) || nativeCard(minion),
          "confused",
        ),
  );
  return p.code === "22011" &&
    fromHand &&
    count > 0 &&
    eligible &&
    !blank(s, p, ports)
    ? [
        E("optional", {
          actorId: controller(s, p.id)?.id || s.activePlayerId,
          title: "Eros",
          text: `For each of the ${count} Mental resources paid, choose a minion and confuse it?`,
          image: p.code,
          effects: [P("eros", { id: p.id, count })],
        }),
      ]
    : [];
}
/** A real play of ANY Guardian ally, including a play from discard; never a
 * put-into-play origin. Dynamic traits apply before this response (Star-Lord). */
export function nebulaPackAllyPlayed(
  s: GameState,
  p: Piece,
  playedPlayerId: string,
  ports: Pick<NebulaPackPorts, "hasTrait" | "isTextBlank">,
): Effect[] {
  if (
    cards.get(p.code)?.type_code !== "ally" ||
    !ports.hasTrait(s, p.id, "Guardian")
  )
    return [];
  return allInPlay(s)
    .filter((k) => k.code === "22021" && !k.exhausted && !blank(s, k, ports))
    .map((k) =>
      E("optional", {
        actorId: controller(s, k.id)?.id,
        title: "Knowhere",
        text: "Exhaust Knowhere so the player who played this Guardian ally draws 1 card?",
        image: k.code,
        effects: [P("knowhere", { id: k.id, playedPlayerId })],
      }),
    );
}
/** Call after the actually PLAYED upgrade has attached, before after-play
 * responses. A put-into-play upgrade does not qualify. Target ally may belong
 * to another player; every character controlled by the support owner counts. */
export function nebulaPackUpgradePlayed(
  s: GameState,
  p: Piece,
  playedPlayerId: string,
  ports: Pick<NebulaPackPorts, "hasTrait" | "isTextBlank">,
): Effect[] {
  if (
    cards.get(p.code)?.type_code !== "upgrade" ||
    !allInPlay(s).some(
      (ally) =>
        ally.id === p.attachedTo && cards.get(ally.code)?.type_code === "ally",
    )
  )
    return [];
  const v = seatView(s, playedPlayerId),
    allies = v.player.inPlay.filter(
      (p) => cards.get(p.code)?.type_code === "ally",
    );
  if (
    !["hero", ...allies.map((p) => p.id)].every((id) =>
      ports.hasTrait(v, id, "Guardian"),
    )
  )
    return [];
  return v.player.inPlay
    .filter((k) => k.code === "22033" && !blank(v, k, ports))
    .map((k) =>
      E("optional", {
        actorId: playedPlayerId,
        title: "Guardians of the Galaxy",
        text: "Draw 1 card after playing this upgrade on an ally?",
        image: k.code,
        effects: [E("draw", { amount: 1, actorId: playedPlayerId })],
      }),
    );
}
export function nebulaPackResourcesSpent(
  s: GameState,
  spent: Piece[],
): Effect[] {
  return s.player.form === "hero"
    ? spent
        .filter((p) => p.code === "22016")
        .map((p) =>
          E("optional", {
            actorId: s.activePlayerId,
            title: "Determination",
            text: "Remove 1 threat from the main scheme after spending Determination?",
            image: p.code,
            effects: [
              E("thwart", {
                target: "main",
                amount: 1,
                source: "determination",
                action: false,
              }),
            ],
          }),
        )
    : [];
}
export interface NebulaPackThwartSnapshot {
  playerId: string;
  source: string;
  thwart: boolean;
  basic: boolean;
  removedAllThreat: boolean;
}
export function nebulaPackAfterThwartOptions(
  s: GameState,
  snapshot: NebulaPackThwartSnapshot,
  after: Effect[],
  ports: NebulaPackPorts,
): Option[] {
  if (
    !snapshot.thwart ||
    snapshot.playerId !== s.activePlayerId ||
    !["hero", `hero:${s.activePlayerId}`].includes(snapshot.source) ||
    s.player.form !== "hero"
  )
    return [];
  const result: Option[] = [];
  if (
    snapshot.removedAllThreat &&
    s.player.exhausted &&
    ports.canReady(s, "hero")
  )
    for (const p of s.player.inPlay.filter(
      (p) => p.code === "22014" && !blank(s, p, ports),
    ))
      result.push(
        O(
          p.id,
          "Discard Justice Served · ready your hero",
          [P("justice-served", { id: p.id }), ...after],
          p.code,
        ),
      );
  if (snapshot.basic)
    for (const p of eventPlaySources(s).filter(
      (p) =>
        p.code === "22018" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    ))
      result.push(
        O(
          p.id,
          "Brains Over Brawn · attack for your hero's THW",
          [P("brains-pay", { id: p.id, after })],
          p.code,
        ),
      );
  return result;
}
export function nebulaPackBoostInterruptOptions(
  s: GameState,
  boost: Piece,
  after: Effect[],
  ports: NebulaPackPorts,
): Option[] {
  if (s.player.form !== "hero" || !ports.canCancelBoostAbility(s, boost))
    return [];
  return s.player.inPlay
    .filter((p) => p.code === "22012" && !p.exhausted && !blank(s, p, ports))
    .map((p) =>
      O(
        p.id,
        "Wraith · exhaust and deal 1 damage to cancel this boost ability",
        [P("wraith", { id: p.id, boost, after })],
        p.code,
      ),
    );
}
const cardTypes = [
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "minion",
  "side_scheme",
  "main_scheme",
  "treachery",
  "attachment",
  "environment",
  "obligation",
  "hero",
  "alter_ego",
  "villain",
  "player_side_scheme",
];
export function nebulaPackBeforeAllyBasicOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
  after: Effect[],
  ports: NebulaPackPorts,
): Option[] {
  if (
    p.code !== "22020" ||
    !["attack", "thwart"].includes(packet.kind) ||
    blank(s, p, ports) ||
    packet.nebulaPackCosmoHandled ||
    (packet.kind === "attack" ? p.stunned : p.confused)
  )
    return [];
  if (
    !s.encounter.deck.length &&
    !playerOrder(s).some((seat) => seatView(s, seat).player.deck.length)
  )
    return [];
  return [
    O(
      p.id,
      "Cosmo · name a card type",
      [P("cosmo-type", { id: p.id, packet, after })],
      p.code,
    ),
  ];
}
/** This prediction is delayed for ONE physical use. Venom's continuous
 * reduction is checked at consequential damage, including printed extra icons. */
export function nebulaPackConsequentialDamage(
  s: GameState,
  p: Piece,
  packet: Effect,
  printed: number,
  ports?: TextPorts,
): number {
  if (
    p.code === "22020" &&
    packet.nebulaPackCosmoId === p.id &&
    packet.nebulaPackCosmoSafe
  )
    return 0;
  return Math.max(
    0,
    printed -
      Number(
        p.code === "22013" && s.scheme.threat === 0 && !blank(s, p, ports),
      ),
  );
}
export function nebulaPackAbilityOptions(
  s: GameState,
  id: string,
  ports: NebulaPackPorts,
): Option[] {
  const p = own(s, id, "22034", ports);
  return p &&
    !p.exhausted &&
    p.counters > 0 &&
    s.player.form === "alter" &&
    s.player.discard.some(
      (p) =>
        cards.get(p.code)?.type_code === "event" &&
        cards.get(p.code)?.faction_code === "protection",
    )
    ? [
        O(
          "training",
          "Defensive Training · shuffle a discarded Protection event into your deck",
          [P("training", { id })],
          p.code,
        ),
      ]
    : [];
}
export function nebulaPackAbility(
  s: GameState,
  id: string,
  ports: NebulaPackPorts,
  action?: string,
): boolean {
  const choice = nebulaPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!choice) return false;
  ports.queue(s, ...choice.effects);
  return true;
}

export function resolveNebulaPackEffect(
  s: GameState,
  e: Effect,
  ports: NebulaPackPorts,
): boolean {
  if (!e.type.startsWith("nebula-pack:")) return false;
  switch (e.type) {
    case "nebula-pack:control": {
      const p = own(s, e.id, e.code, ports),
        seats = controlSeats(s, e.code, e.id);
      need(p && seats.length, "There is no eligible controller.");
      if (seats.length === 1) ports.transferControl(s, p!.id, seats[0].id);
      else
        ports.choose(
          s,
          cards.get(e.code)!.name,
          "Choose a player to control this card.",
          seats.map((seat) =>
            O(seat.id, identityName(s, seat.id), [
              P("control-to", { id: e.id, code: e.code, playerId: seat.id }),
            ]),
          ),
        );
      break;
    }
    case "nebula-pack:control-to":
      need(
        own(s, e.id, e.code, ports) &&
          controlSeats(s, e.code, e.id).some((seat) => seat.id === e.playerId),
        "This player cannot control another copy.",
      );
      ports.transferControl(s, e.id, e.playerId);
      break;
    case "nebula-pack:attach": {
      need(own(s, e.id, e.code), "The attaching upgrade is unavailable.");
      const targets = nebulaPackAttachmentTargets(s, e.code, ports);
      need(targets.length, "There is no eligible attachment target.");
      ports.choose(
        s,
        cards.get(e.code)!.name,
        "Choose a character.",
        targets.map((target) =>
          O(
            target.id,
            target.label,
            [P("attach-to", { id: e.id, code: e.code, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "nebula-pack:attach-to":
      need(
        own(s, e.id, e.code) &&
          nebulaPackAttachmentTargets(s, e.code, ports).some(
            (p) => p.id === e.target,
          ),
        "The attachment target is unavailable.",
      );
      ports.attach(s, e.id, e.target);
      break;
    case "nebula-pack:eros": {
      if (!own(s, e.id, "22011", ports) || e.count <= 0) break;
      const targets = s.minions.filter((p) =>
        ports.canGiveStatus(s, p.id, "confused"),
      );
      if (targets.length)
        ports.choose(
          s,
          "Eros",
          "Choose a minion for this Mental resource. A Steady minion may be chosen again.",
          targets.map((p) =>
            O(
              p.id,
              (cards.get(p.code) || nativeCard(p)).name,
              [
                E("status", { target: p.id, status: "confused" }),
                P("eros", { id: e.id, count: e.count - 1 }),
              ],
              p.code,
            ),
          ),
        );
      break;
    }
    case "nebula-pack:knowhere": {
      const p = own(s, e.id, "22021", ports);
      need(p && !p.exhausted, "Knowhere is unavailable.");
      p!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1, actorId: e.playedPlayerId }));
      break;
    }
    case "nebula-pack:one-way-cost": {
      const targets = s.encounter.deck.filter(
        (p) => cards.get(p.code)?.type_code === "side_scheme",
      );
      need(
        targets.length,
        "One Way or Another requires a physical side scheme in the encounter deck.",
      );
      ports.revealHidden(s);
      ports.choose(
        s,
        "One Way or Another",
        "Choose the actual side scheme to reveal as a cost.",
        targets.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [P("one-way-reveal", { id: p.id, after: e.after || [] })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nebula-pack:one-way-reveal":
      need(
        s.encounter.deck.some(
          (p) =>
            p.id === e.id && cards.get(p.code)?.type_code === "side_scheme",
        ),
        "The selected side scheme is no longer in the encounter deck.",
      );
      ports.revealEncounterFromDeck(s, e.id, e.after || []);
      break;
    case "nebula-pack:shuffle-encounter":
      ports.shuffleEncounter(s);
      break;
    case "nebula-pack:justice-served": {
      const p = own(s, e.id, "22014", ports);
      need(
        p &&
          s.player.form === "hero" &&
          s.player.exhausted &&
          ports.canReady(s, "hero"),
        "Justice Served cannot ready this hero.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "nebula-pack:brains-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "22018",
      );
      need(
        p &&
          s.player.form === "hero" &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        "Brains Over Brawn is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Brains Over Brawn",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [P("brains")],
              continuation: e.after || [],
            }),
          ],
        }),
      );
      break;
    }
    case "nebula-pack:brains":
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Brains Over Brawn",
          attack: true,
          action: E("damage", {
            amount: ports.heroThwart(s),
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        }),
      );
      break;
    case "nebula-pack:wraith": {
      const p = own(s, e.id, "22012", ports);
      need(
        p &&
          !p.exhausted &&
          s.player.form === "hero" &&
          ports.canCancelBoostAbility(s, e.boost),
        "Wraith cannot cancel this boost ability.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("damage", { target: p!.id, amount: 1, source: p!.id, cost: true }),
        P("wraith-cancel", { boostId: e.boost.id }),
        ...(e.after || []),
      );
      break;
    }
    case "nebula-pack:wraith-cancel":
      ports.cancelBoostAbility(s, e.boostId);
      break;
    case "nebula-pack:cosmo-type":
      need(own(s, e.id, "22020", ports), "Cosmo is unavailable.");
      ports.choose(
        s,
        "Cosmo",
        "Name a card type before selecting a player deck or the encounter deck.",
        cardTypes.map((named) =>
          O(named, named.replaceAll("_", " "), [
            P("cosmo-deck", { ...e, type: "nebula-pack:cosmo-deck", named }),
          ]),
        ),
      );
      break;
    case "nebula-pack:cosmo-deck": {
      const decks = [
        ...playerOrder(s)
          .filter((seat) => seatView(s, seat).player.deck.length)
          .map((seat) => ({
            id: seat.id,
            label: identityName(s, seat.id) + "'s player deck",
            topId: seatView(s, seat).player.deck[0].id,
          })),
        ...(s.encounter.deck.length
          ? [
              {
                id: "encounter",
                label: "Encounter deck",
                topId: s.encounter.deck[0].id,
              },
            ]
          : []),
      ];
      if (!decks.length) {
        ports.queue(
          s,
          { ...e.packet, nebulaPackCosmoHandled: true },
          ...(e.after || []),
        );
        break;
      }
      ports.choose(
        s,
        "Cosmo",
        "Choose a player deck or the encounter deck. The top card stays hidden until discarded.",
        decks.map((deck) =>
          O(deck.id, deck.label, [
            P("cosmo-discard", {
              ...e,
              type: "nebula-pack:cosmo-discard",
              deck: deck.id,
              topId: deck.topId,
            }),
          ]),
        ),
      );
      break;
    }
    case "nebula-pack:cosmo-discard": {
      const zone =
        e.deck === "encounter"
          ? s.encounter.deck
          : s.players.find((seat) => seat.id === e.deck && !seat.eliminated)
            ? seatView(s, e.deck).player.deck
            : undefined;
      need(
        zone?.[0]?.id === e.topId,
        "Cosmo's selected physical top card is no longer available.",
      );
      const discarded =
        e.deck === "encounter"
          ? ports.discardEncounterTop(s)
          : ports.discardPlayerTop(s, e.deck);
      need(
        discarded?.id === e.topId,
        "Cosmo must discard the selected physical card.",
      );
      ports.queue(
        s,
        {
          ...e.packet,
          nebulaPackCosmoHandled: true,
          nebulaPackCosmoId: e.id,
          nebulaPackCosmoSafe:
            cards.get(discarded!.code)?.type_code === e.named,
        },
        ...(e.after || []),
      );
      break;
    }
    case "nebula-pack:training": {
      need(
        nebulaPackAbilityOptions(s, e.id, ports).length,
        "Defensive Training is unavailable.",
      );
      const targets = s.player.discard.filter(
        (p) =>
          cards.get(p.code)?.type_code === "event" &&
          cards.get(p.code)?.faction_code === "protection",
      );
      ports.choose(
        s,
        "Defensive Training",
        "Choose the actual discarded Protection event before paying the exhaust/counter cost.",
        targets.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [P("training-shuffle", { id: e.id, cardId: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nebula-pack:training-shuffle": {
      const p = own(s, e.id, "22034", ports),
        index = s.player.discard.findIndex(
          (p) =>
            p.id === e.cardId &&
            cards.get(p.code)?.type_code === "event" &&
            cards.get(p.code)?.faction_code === "protection",
        );
      need(
        p &&
          !p.exhausted &&
          p.counters > 0 &&
          s.player.form === "alter" &&
          index >= 0,
        "Defensive Training's complete cost and target must remain available.",
      );
      p!.exhausted = true;
      p!.counters--;
      const [event] = s.player.discard.splice(index, 1);
      s.player.deck.push(event);
      if (!p!.counters) ports.discardPiece(s, p!.id);
      ports.shufflePlayerDeck(s);
      break;
    }
    default:
      throw Error("Unknown Nebula player-pack effect: " + e.type);
  }
  return true;
}
