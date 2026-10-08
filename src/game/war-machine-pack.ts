import { eventPlaySources } from "./card-text.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`war-machine-pack:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const card = (p: Piece) => cards.get(p.code)!;
const traits = (p: Piece) =>
  (card(p)?.traits || "").split(/\.\s+|\.$/).filter(Boolean);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const allies = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p)?.type_code === "ally");
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const leadershipEvent = (p: Piece) =>
  card(p)?.type_code === "event" && card(p)?.faction_code === "leadership";
const tech = (p: Piece) =>
  card(p)?.type_code === "upgrade" && traits(p).includes("Tech");

/** Only exact mechanically equal CORE reprints belong here. */
export const WAR_MACHINE_PACK_CORE_ALIASES = [
  "23020",
  "23022",
  "23025",
  "23026",
  "23027",
] as const;
/** Eleven new faces plus four other-pack reprints needing actual-code adapters. */
export const WAR_MACHINE_PACK_SCRIPT_CODES = [
  "23012",
  "23013",
  "23014",
  "23015",
  "23016",
  "23017",
  "23018",
  "23019",
  "23021",
  "23023",
  "23024",
  "23032",
  "23033",
  "23034",
  "23035",
] as const;
export const WAR_MACHINE_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const WAR_MACHINE_PACK_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";
export interface WarMachinePackCharacter extends AntManTarget {
  name: string;
  playerId: string;
  type: "hero" | "alter_ego" | "ally";
  exhausted: boolean;
}
export interface WarMachinePackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  characters(s: GameState): WarMachinePackCharacter[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  characterAttack(s: GameState, id: string): number;
  exhaustCharacter(s: GameState, id: string): boolean;
  canReady(s: GameState, id: string): boolean;
  canDiscardAlly(s: GameState, p: Piece): boolean;
  canPutAlly(s: GameState, p: Piece): boolean;
  canPutUpgrade(s: GameState, p: Piece): boolean;
  cardCost(s: GameState, p: Piece): number;
  /** Correlate card affordability with retaining this actual hand ally.
   * Exclude BOTH event and held ally from payment sources, respecting native
   * discounts, source restrictions and optional hand-play interrupts. */
  canPayKeepingHandAlly(s: GameState, event: Piece, ally: Piece): boolean;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    alliance?: boolean,
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  discardPiece(s: GameState, id: string): void;
  /** Put actual hand ally into play, resolve ally limit and enter responses,
   * THEN run after. Sneak Attack is still resolving during this entry window. */
  putAllyFromHand(s: GameState, id: string, after: Effect[]): void;
  putUpgradeFromDeck(s: GameState, id: string, after: Effect[]): void;
  /** One original top-card batch. Queue saved continuation with discarded:
   * Piece[] AFTER actual exhaustion/reset response windows; never mill reset. */
  discardPlayerCards(s: GameState, count: number, continuation: Effect): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  revealHidden(s: GameState): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  preventAttackDamage(s: GameState, packet: Effect, amount: number): void;
}
function sharedAlly(s: GameState, p: Piece, ports: WarMachinePackPorts) {
  return (
    card(p)?.type_code === "ally" &&
    ports.canPutAlly(s, p) &&
    traits(p).some((t) => ports.hasTrait(s, `hero:${s.activePlayerId}`, t))
  );
}
/** Actual eligible hand pieces, for retainOneOfIds payment constraints.
 * Does not include stored/out-of-play cards or allies whose put is illegal. */
export function warMachinePackSneakAllies(
  s: GameState,
  ports: WarMachinePackPorts,
): Piece[] {
  return s.player.hand.filter((p) => sharedAlly(s, p, ports));
}
function pairs(
  s: GameState,
  ports: WarMachinePackPorts,
): Array<[WarMachinePackCharacter, WarMachinePackCharacter]> {
  const available = ports.characters(s).filter((c) => !c.exhausted);
  return available
    .filter((c) => ports.hasTrait(s, c.id, "Avenger"))
    .flatMap((a) =>
      available
        .filter((c) => c.id !== a.id && ports.hasTrait(s, c.id, "Guardian"))
        .map(
          (b) => [a, b] as [WarMachinePackCharacter, WarMachinePackCharacter],
        ),
    );
}
export function warMachinePackAllyModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
) {
  const sidearms = allInPlay(s).filter(
    (a) =>
      a.code === "23035" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
  );
  return { attack: sidearms.length, ranged: sidearms.length > 0 };
}
export function warMachinePackResourceSources(
  s: GameState,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) => p.code === "23023" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Quincarrier",
      resources: ["wild"],
      description: "Exhaust Quincarrier · generate 1 wild",
      kind: "ability",
    }));
}
export function warMachinePackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
): boolean {
  const p = own(s, id, "23023");
  if (!p) return false;
  need(!p.exhausted && !ports.isTextBlank(s, p), "Quincarrier is unavailable.");
  p.exhausted = true;
  return true;
}
export function warMachinePackResourcesSpent(
  s: GameState,
  pieces: Piece[],
): Effect[] {
  return s.player.form === "hero" && allies(s).some((p) => p.damage > 0)
    ? pieces
        .filter((p) => p.code === "23021")
        .map((p) =>
          E("optional", {
            title: "Innovation",
            image: p.code,
            text: "Heal 1 damage from an ally you control?",
            effects: [P("innovation")],
          }),
        )
    : [];
}
export function warMachinePackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "23016") p.counters = 3;
  if (p.code === "23033") p.counters = 2;
  return [];
}
/** Invoke before ANY actual leave-play/reset/return. Control transfer is not a
 * leave-play event; global expiry still follows the original physical ally. */
export function warMachinePackCardLeftPlay(s: GameState, p: Piece) {
  for (const seat of s.players) {
    delete seatView(s, seat).flags[`warMachinePackSneak:${p.id}`];
    delete seatView(s, seat).flags[`warMachinePackGoliath:${p.id}`];
  }
}
export function warMachinePackPhaseEnded(
  s: GameState,
  ports: Pick<WarMachinePackPorts, "discardPiece">,
) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    for (const key of Object.keys(flags)) {
      if (
        !/^warMachinePack(?:Sneak|Goliath):/.test(key) ||
        flags[key] !== phaseKey(s)
      )
        continue;
      const id = key.slice(key.indexOf(":") + 1),
        p = allInPlay(s).find((p) => p.id === id);
      if (p && card(p)?.type_code === "ally") ports.discardPiece(s, p.id);
      delete flags[key];
    }
  }
}
export function warMachinePackStoredPlayable(
  s: GameState,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
): Piece[] {
  return s.player.inPlay
    .filter((p) => p.code === "23012" && !ports.isTextBlank(s, p))
    .flatMap((p) => (p.storedCards || []).filter(leadershipEvent));
}
export function warMachinePackTakeStoredForPlay(
  s: GameState,
  id: string,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
): Piece | undefined {
  for (const source of s.player.inPlay.filter(
    (p) => p.code === "23012" && !ports.isTextBlank(s, p),
  )) {
    const i = (source.storedCards || []).findIndex(
      (p) => p.id === id && leadershipEvent(p),
    );
    if (i >= 0) return source.storedCards!.splice(i, 1)[0];
  }
  return undefined;
}
export function warMachinePackAttachmentTargets(
  s: GameState,
  p: Piece,
): AntManTarget[] | null {
  return p.code === "23035"
    ? allInPlay(s)
        .filter(
          (a) =>
            card(a)?.type_code === "ally" &&
            !allInPlay(s).some(
              (x) => x.code === "23035" && x.attachedTo === a.id,
            ),
        )
        .map((a) => ({ id: a.id, label: card(a).name, code: a.code }))
    : null;
}
export function warMachinePackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: WarMachinePackPorts,
): string | null {
  if (
    ["23018", "23019", "23024", "23032"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "This card requires hero form.";
  if (
    p.code === "23023" &&
    !ports.hasTrait(s, `hero:${s.activePlayerId}`, "Avenger")
  )
    return "Quincarrier requires the Avenger trait.";
  if (p.code === "23035" && !warMachinePackAttachmentTargets(s, p)?.length)
    return "Sidearm needs an ally without a Sidearm attached.";
  if (p.code === "23017") {
    const eligible = warMachinePackSneakAllies(s, ports);
    if (!eligible.length)
      return "Sneak Attack needs a hand ally sharing a current identity trait.";
    if (!eligible.some((a) => ports.canPayKeepingHandAlly(s, p, a)))
      return "Sneak Attack must retain its chosen hand ally while paying its resource cost.";
  }
  if (
    ["23018", "23019"].includes(p.code) &&
    !allies(s).some(
      (a) => Number(card(a).cost || 0) > 0 && ports.canDiscardAlly(s, a),
    )
  )
    return "This event needs a discardable ally with a positive printed cost.";
  if (p.code === "23032" && !pairs(s, ports).length)
    return "As One needs two distinct ready Avenger and Guardian characters.";
  if (p.code === "23024") {
    const named = ports.characters(s).map((c) => c.name);
    if (!named.includes("Iron Man") || !named.includes("War Machine"))
      return "Two Against the World requires Iron Man and War Machine in play.";
  }
  return null;
}
/** Validate before ANY selected resources are committed. The Pay UI must use
 * the same predicate, so the final eligible ally cannot fund its own event. */
export function warMachinePackPaymentAllowed(
  s: GameState,
  p: Piece,
  resourceIds: string[],
  ports: WarMachinePackPorts,
): boolean {
  return (
    p.code !== "23017" ||
    warMachinePackSneakAllies(s, ports).some(
      (a) => !resourceIds.includes(a.id) && sharedAlly(s, a, ports),
    )
  );
}
export function warMachinePackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return ["23017", "23018", "23019", "23032"].includes(p.code)
    ? [P("event-cost", { piece: p, after })]
    : null;
}
export function warMachinePackEvent(
  _s: GameState,
  p: Piece,
  receipt: { allyId?: string; amount?: number } = {},
): Effect[] | null {
  if (p.code === "23017") return [P("sneak", { id: receipt.allyId })];
  if (["23018", "23019", "23032"].includes(p.code))
    return [P("event-target", { piece: p, amount: receipt.amount || 0 })];
  if (p.code === "23024") return [P("two-against")];
  return null;
}
export function warMachinePackAllyEnter(
  s: GameState,
  p: Piece,
  ports: Pick<WarMachinePackPorts, "isTextBlank"> = { isTextBlank },
): Effect[] | null {
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "23012")
    return leadershipEventPresent(s)
      ? [
          E("optional", {
            title: "Black Panther",
            image: p.code,
            text: "Attach a discarded Leadership event facedown?",
            effects: [P("panther", { id: p.id })],
          }),
        ]
      : [];
  if (p.code === "23013")
    return !s.player.deck.length
      ? []
      : [
          E("optional", {
            title: "Captain Marvel",
            image: p.code,
            text: "Discard your original top 4 cards to resolve Captain Marvel?",
            effects: [P("captain-marvel", { id: p.id })],
          }),
        ];
  if (p.code === "23014")
    return !s.encounter.deck.length
      ? []
      : [
          E("optional", {
            title: "Falcon",
            image: p.code,
            text: "Look at the original top 3 encounter cards?",
            effects: [P("falcon", { id: p.id })],
          }),
        ];
  return null;
}
const leadershipEventPresent = (s: GameState) =>
  s.player.discard.some(leadershipEvent);
export function warMachinePackAbilityOptions(
  s: GameState,
  id: string,
  ports: WarMachinePackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "23015" &&
    !s.players.some(
      (seat) => seatView(s, seat).flags.hawkeyeGoliathPhase === phaseKey(s),
    )
  )
    return [
      O(
        "goliath",
        "Goliath · +4 ATK this phase; discard at phase end",
        [P("goliath", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "23016" &&
    !p.exhausted &&
    p.counters > 0 &&
    ports
      .characters(s)
      .some((c) => c.type === "ally" && c.exhausted && ports.canReady(s, c.id))
  )
    return [
      O(
        "command-team",
        "Spend 1 command counter · ready an ally",
        [P("command-team", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "23033" &&
    s.player.form === "alter" &&
    !p.exhausted &&
    p.counters > 0 &&
    s.player.discard.some(
      (p) =>
        card(p)?.type_code === "event" && card(p)?.faction_code === "justice",
    )
  )
    return [
      O(
        "vigilante-training",
        "Spend 1 training counter · shuffle a Justice event into deck",
        [P("training", { id })],
        p.code,
      ),
    ];
  return [];
}
export function warMachinePackAbility(
  s: GameState,
  id: string,
  ports: WarMachinePackPorts,
  action?: string,
): boolean {
  const piece = own(s, id);
  if (
    piece &&
    card(piece)?.type_code === "ally" &&
    (action === "attack" || action === "thwart")
  )
    return false;
  const options = warMachinePackAbilityOptions(s, id, ports);
  if (!options.length) return false;
  const selected = action ? options.find((o) => o.id === action) : options[0];
  need(selected, "This War Machine pack action is unavailable.");
  ports.queue(s, ...selected!.effects);
  return true;
}
/** Stand Together has no defense label. It prevents/reflexively deals damage
 * without declaring the event owner a defender or creating an attack. */
export function warMachinePackDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: WarMachinePackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !(packet.attack || ["attack", "overkill"].includes(packet.kind)) ||
    packet.amount <= 0 ||
    !ports
      .characters(s)
      .some(
        (c) =>
          c.id === packet.target ||
          (packet.target === "hero" && c.id === `hero:${s.activePlayerId}`),
      ) ||
    !pairs(s, ports).length
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "23034" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code, true),
    )
    .map((p) =>
      O(
        p.id,
        "Stand Together · prevent all attack damage and deal that much to the attacker",
        [
          E("payRequest", {
            title: "Stand Together",
            cost: ports.cardCost(s, p),
            piece: p,
            targetCode: p.code,
            alliance: true,
            cancelable: false,
            after: [
              E("resolveHandEvent", {
                id: p.id,
                after: [P("stand-pair", { piece: p, packet })],
                continuation: after,
              }),
            ],
          }),
        ],
        p.code,
      ),
    );
}
function costReceipt(after: Effect[], values: Record<string, unknown>) {
  return after.map((e) => ({
    ...e,
    warMachinePackCostPaid: true,
    warMachinePackReceipt: values,
  }));
}
function pairChoices(
  s: GameState,
  effect: Effect,
  ports: WarMachinePackPorts,
): Option[] {
  return pairs(s, ports).map(([a, b]) =>
    O(`${a.id}|${b.id}`, `${a.label} (Avenger) + ${b.label} (Guardian)`, [
      { ...effect, ids: [a.id, b.id] },
    ]),
  );
}
export function resolveWarMachinePackEffect(
  s: GameState,
  e: Effect,
  ports: WarMachinePackPorts,
): boolean {
  if (!e.type.startsWith("war-machine-pack:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "war-machine-pack:event-cost": {
      const p: Piece = e.piece;
      if (p.code === "23017")
        ports.choose(
          s,
          "Sneak Attack · additional cost",
          "Choose an actual hand ally sharing an identity trait.",
          warMachinePackSneakAllies(s, ports).map((a) =>
            O(
              a.id,
              card(a).name,
              [P("sneak-cost", { id: a.id, after })],
              a.code,
            ),
          ),
        );
      else if (["23018", "23019"].includes(p.code))
        ports.choose(
          s,
          `${card(p).name} · additional cost`,
          "Choose an ally you control to discard.",
          allies(s)
            .filter(
              (a) =>
                Number(card(a).cost || 0) > 0 && ports.canDiscardAlly(s, a),
            )
            .map((a) =>
              O(
                a.id,
                card(a).name,
                [P("discard-ally-cost", { id: a.id, after })],
                a.code,
              ),
            ),
        );
      else
        ports.choose(
          s,
          "As One · additional cost",
          "Exhaust two distinct ready characters. Alliance allows their owners to contribute.",
          pairChoices(s, P("as-one-cost", { after }), ports),
        );
      break;
    }
    case "war-machine-pack:sneak-cost": {
      need(
        s.player.hand.some((p) => p.id === e.id && sharedAlly(s, p, ports)),
        "Sneak Attack's hand ally is unavailable.",
      );
      ports.queue(s, ...costReceipt(after, { allyId: e.id }));
      break;
    }
    case "war-machine-pack:discard-ally-cost": {
      const p = allies(s).find(
        (p) => p.id === e.id && ports.canDiscardAlly(s, p),
      );
      need(p, "Choose an actual discardable controlled ally.");
      const amount = Number(card(p!).cost || 0);
      ports.discardPiece(s, p!.id);
      ports.queue(s, ...costReceipt(after, { amount }));
      break;
    }
    case "war-machine-pack:as-one-cost": {
      const pair = pairs(s, ports).find(
        ([a, b]) => a.id === e.ids?.[0] && b.id === e.ids?.[1],
      );
      need(pair, "Both distinct Alliance characters must still be ready.");
      const amount = pair!.reduce(
        (n, p) => n + ports.characterAttack(s, p.id),
        0,
      );
      need(
        ports.exhaustCharacter(s, pair![0].id) &&
          ports.exhaustCharacter(s, pair![1].id),
        "Cannot exhaust both Alliance characters.",
      );
      ports.queue(s, ...costReceipt(after, { amount }));
      break;
    }
    case "war-machine-pack:sneak": {
      const p = s.player.hand.find(
        (p) => p.id === e.id && sharedAlly(s, p, ports),
      );
      need(p, "Sneak Attack's chosen ally is no longer in hand.");
      ports.putAllyFromHand(s, p!.id, [
        P("sneak-delay", { id: p!.id }),
        ...after,
      ]);
      break;
    }
    case "war-machine-pack:sneak-delay":
      if (
        allInPlay(s).some((p) => p.id === e.id && card(p)?.type_code === "ally")
      )
        s.flags[`warMachinePackSneak:${e.id}`] = phaseKey(s);
      ports.queue(s, ...after);
      break;
    case "war-machine-pack:event-target": {
      const p: Piece = e.piece,
        targets =
          p.code === "23018"
            ? ports.schemeTargets(s, false)
            : ports.enemyTargets(s, p.code === "23032");
      if (targets.length)
        ports.choose(
          s,
          card(p).name,
          "Choose the target.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                P("event-resolve", {
                  piece: p,
                  amount: e.amount,
                  target: t.id,
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
    case "war-machine-pack:event-resolve": {
      const p: Piece = e.piece;
      if (p.code === "23018")
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: e.amount,
            source: "hero",
            action: false,
            ignoreCrisis: false,
          }),
          ...after,
        );
      else if (p.code === "23032")
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount: e.amount,
              source: "hero",
              attack: true,
              overkill: true,
            }),
          ],
          after,
        );
      else
        ports.queue(
          s,
          E("damage", {
            target: e.target,
            amount: e.amount,
            source: "hero",
            attack: false,
          }),
          ...after,
        );
      break;
    }
    case "war-machine-pack:panther": {
      const p = own(s, e.id, "23012");
      need(p && !ports.isTextBlank(s, p), "Black Panther is unavailable.");
      ports.choose(
        s,
        "Black Panther",
        "Choose an actual discarded Leadership event to attach facedown.",
        s.player.discard
          .filter(leadershipEvent)
          .map((a) =>
            O(
              a.id,
              card(a).name,
              [P("panther-store", { id: p!.id, cardId: a.id })],
              a.code,
            ),
          ),
      );
      break;
    }
    case "war-machine-pack:panther-store": {
      const p = own(s, e.id, "23012"),
        i = s.player.discard.findIndex(
          (p) => p.id === e.cardId && leadershipEvent(p),
        );
      need(
        p && !ports.isTextBlank(s, p) && i >= 0,
        "Black Panther needs the actual discarded Leadership event.",
      );
      (p!.storedCards ||= []).push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "war-machine-pack:captain-marvel":
      ports.discardPlayerCards(
        s,
        4,
        P("captain-marvel-discarded", { id: e.id, after }),
      );
      break;
    case "war-machine-pack:captain-marvel-discarded": {
      const energy = ((e.discarded as Piece[]) || []).reduce(
        (n, p) => n + Number(card(p)?.resource_energy || 0),
        0,
      );
      if (energy)
        ports.choose(
          s,
          "Captain Marvel",
          "Choose an enemy for nonattack damage.",
          ports.enemyTargets(s, false).map((t) =>
            O(
              t.id,
              t.label,
              [
                P("captain-marvel-damage", {
                  target: t.id,
                  targetCode: t.code,
                  source: e.id,
                  stun: energy > 1,
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
    case "war-machine-pack:captain-marvel-damage":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 3,
          source: e.source || "Captain Marvel",
          sourceCode: "23013",
          attack: false,
        }),
        ...(e.stun
          ? [
              P("captain-marvel-stun", {
                target: e.target,
                targetCode: e.targetCode,
              }),
            ]
          : []),
        ...after,
      );
      break;
    case "war-machine-pack:captain-marvel-stun":
      if (
        ports
          .enemyTargets(s, false)
          .some(
            (t) =>
              t.id === e.target && (!e.targetCode || t.code === e.targetCode),
          )
      )
        ports.queue(s, E("status", { target: e.target, status: "stunned" }));
      break;
    case "war-machine-pack:falcon": {
      const top = s.encounter.deck.slice(0, 3);
      ports.revealHidden(s);
      const amount = top.filter(
        (p) => card(p)?.type_code === "treachery",
      ).length;
      ports.choose(
        s,
        "Falcon · encounter preview",
        top.map((p, i) => `${i + 1}. ${card(p).name}`).join(" · "),
        [O("continue", "Continue", [P("falcon-threat", { amount, after })])],
      );
      break;
    }
    case "war-machine-pack:falcon-threat":
      if (e.amount > 0 && ports.schemeTargets(s, false).length)
        ports.choose(
          s,
          "Falcon",
          "Choose a scheme for this 1 threat removal.",
          ports.schemeTargets(s, false).map((t) =>
            O(
              t.id,
              t.label,
              [
                E("thwart", {
                  target: t.id,
                  amount: 1,
                  source: "Falcon",
                  action: false,
                  ignoreCrisis: false,
                }),
                P("falcon-threat", { amount: e.amount - 1, after }),
              ],
              t.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    case "war-machine-pack:goliath": {
      const p = own(s, e.id, "23015");
      need(
        p &&
          warMachinePackAbilityOptions(s, e.id, ports).some(
            (o) => o.id === "goliath",
          ),
        "Goliath has reached the global phase maximum.",
      );
      s.flags.hawkeyeGoliathPhase = phaseKey(s);
      s.flags[`warMachinePackGoliath:${p!.id}`] = phaseKey(s);
      p!.bonusAtk = Number(p!.bonusAtk || 0) + 4;
      break;
    }
    case "war-machine-pack:command-team": {
      need(
        warMachinePackAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "command-team",
        ),
        "Command Team is unavailable.",
      );
      ports.choose(
        s,
        "Command Team",
        "Choose any actual exhausted ally.",
        ports
          .characters(s)
          .filter(
            (c) => c.type === "ally" && c.exhausted && ports.canReady(s, c.id),
          )
          .map((c) =>
            O(
              c.id,
              c.label,
              [P("command-ready", { id: e.id, target: c.id })],
              c.code,
            ),
          ),
      );
      break;
    }
    case "war-machine-pack:command-ready": {
      const p = own(s, e.id, "23016");
      need(
        p &&
          !p.exhausted &&
          p.counters > 0 &&
          ports
            .characters(s)
            .some(
              (c) =>
                c.id === e.target &&
                c.type === "ally" &&
                c.exhausted &&
                ports.canReady(s, c.id),
            ),
        "Command Team cannot pay for this ready.",
      );
      p!.exhausted = true;
      p!.counters--;
      if (!p!.counters) ports.discardPiece(s, p!.id);
      ports.queue(s, E("ready", { target: e.target }));
      break;
    }
    case "war-machine-pack:training": {
      need(
        warMachinePackAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "vigilante-training",
        ),
        "Vigilante Training is unavailable.",
      );
      ports.choose(
        s,
        "Vigilante Training",
        "Choose an actual discarded Justice event.",
        s.player.discard
          .filter(
            (p) =>
              card(p)?.type_code === "event" &&
              card(p)?.faction_code === "justice",
          )
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [P("training-shuffle", { id: e.id, cardId: p.id, after })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "war-machine-pack:training-shuffle": {
      const p = own(s, e.id, "23033"),
        i = s.player.discard.findIndex(
          (p) =>
            p.id === e.cardId &&
            card(p)?.type_code === "event" &&
            card(p)?.faction_code === "justice",
        );
      need(
        p &&
          !p.exhausted &&
          p.counters > 0 &&
          i >= 0 &&
          s.player.form === "alter",
        "Vigilante Training cannot pay its actual cost.",
      );
      p!.exhausted = true;
      p!.counters--;
      const event = s.player.discard.splice(i, 1)[0];
      if (!p!.counters) ports.discardPiece(s, p!.id);
      s.player.deck.push(event);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "war-machine-pack:innovation": {
      const choices = allies(s).filter((p) => p.damage > 0);
      if (choices.length)
        ports.choose(
          s,
          "Innovation",
          "Heal 1 damage from an ally you control.",
          choices.map((p) =>
            O(
              p.id,
              card(p).name,
              [E("heal", { target: p.id, amount: 1 })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "war-machine-pack:two-against": {
      const choices = s.player.deck.filter(
        (p) => tech(p) && ports.canPutUpgrade(s, p),
      );
      ports.revealHidden(s);
      if (choices.length)
        ports.choose(
          s,
          "Two Against the World",
          "Choose an actual Tech upgrade in your deck.",
          choices.map((p) =>
            O(p.id, card(p).name, [P("two-tech", { id: p.id, after })], p.code),
          ),
        );
      else ports.shufflePlayerDeck(s, [P("two-ready"), ...after]);
      break;
    }
    case "war-machine-pack:two-tech":
      need(
        s.player.deck.some(
          (p) => p.id === e.id && tech(p) && ports.canPutUpgrade(s, p),
        ),
        "Choose an actual available Tech upgrade.",
      );
      ports.putUpgradeFromDeck(s, e.id, [P("two-shuffle", { after })]);
      break;
    case "war-machine-pack:two-shuffle":
      ports.shufflePlayerDeck(s, [P("two-ready"), ...after]);
      break;
    case "war-machine-pack:two-ready":
      ports.queue(
        s,
        ...ports
          .characters(s)
          .filter(
            (c) =>
              ["Iron Man", "War Machine"].includes(c.name) &&
              c.exhausted &&
              ports.canReady(s, c.id),
          )
          .map((c) => E("ready", { target: c.id })),
      );
      break;
    case "war-machine-pack:stand-pair":
      ports.choose(
        s,
        "Stand Together · additional cost",
        "Exhaust two distinct ready Avenger and Guardian characters.",
        pairChoices(
          s,
          P("stand-cost", { piece: e.piece, packet: e.packet, after }),
          ports,
        ),
      );
      break;
    case "war-machine-pack:stand-cost": {
      const pair = pairs(s, ports).find(
        ([a, b]) => a.id === e.ids?.[0] && b.id === e.ids?.[1],
      );
      need(pair, "Stand Together needs its two distinct ready characters.");
      need(
        ports.exhaustCharacter(s, pair![0].id) &&
          ports.exhaustCharacter(s, pair![1].id),
        "Cannot exhaust both Alliance characters.",
      );
      ports.preventAttackDamage(s, e.packet, e.packet.amount);
      ports.queue(
        s,
        E("damage", {
          target: e.packet.attacker,
          amount: e.packet.amount,
          source: "hero",
          attack: false,
        }),
        ...after,
      );
      break;
    }
    default:
      throw Error(`Unknown War Machine pack effect: ${e.type}`);
  }
  return true;
}
