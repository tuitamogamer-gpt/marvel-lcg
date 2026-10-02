import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { controller, playerOrder, seatView } from "./team.js";
import { consumeStatus } from "./keywords.js";
import { uniqueConflict } from "./unique.js";
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
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const B = (type: string, args: Record<string, unknown> = {}) =>
  E(`bw:${type}`, args);
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const active = (s: GameState) => s.heroId === "black_widow";
const trait = (p: Piece | string, value: string) =>
  (cards.get(typeof p === "string" ? p : p.code)?.traits || "")
    .split(/\.\s*/)
    .includes(value);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const prep = (p: Piece) => trait(p, "Preparation");
const maxOne = new Set(["08017", "08024", "08030", "08031", "08032"]);
const heroPreps = new Set([
  "08006",
  "08008",
  "08010",
  "08024",
  "08030",
  "08031",
  "08032",
]);
const attackPreps = new Set(["08006", "08010", "08030"]);

/** Only independently executable native faces are declared here. The exact
 * Core aliases and the two whole-text compiler programs retain their owners. */
export const BLACK_WIDOW_CORE_ALIASES = [
  "08014",
  "08015",
  "08016",
  "08019",
  "08020",
  "08021",
  "08022",
  "08028",
] as const;
export const BLACK_WIDOW_COMPILED_CODES = ["08003", "08013"] as const;
export const BLACK_WIDOW_SCRIPT_CODES = [
  "08001a",
  "08001b",
  "08002",
  "08004",
  "08005",
  "08006",
  "08007",
  "08008",
  "08009",
  "08010",
  "08011",
  "08012",
  "08017",
  "08018",
  "08023",
  "08024",
  "08025",
  "08026",
  "08027",
  "08029",
  "08030",
  "08031",
  "08032",
  "08033",
] as const;
export const BLACK_WIDOW_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const BLACK_WIDOW_CARD_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/";

export interface BlackWidowTarget {
  id: string;
  label: string;
  code?: string;
}
export interface BlackWidowDamageWindow {
  target: string;
  playerId: string;
  amount: number;
  attack?: boolean;
  /** Native persisted non-attack/overkill packet, or omitted for attack state. */
  packet?: Effect;
  kind?: string;
}
export interface BlackWidowAttackSnapshot {
  attacker: string;
  attackerCode: string;
  playerId: string;
  heroDamage: number;
}
export interface BlackWidowPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  shufflePlayerDeck(s: GameState): void;
  revealHidden(s: GameState): void;
  canChangeForm(s: GameState): boolean;
  flip(s: GameState, counts: boolean): void;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  identityHasTrait(s: GameState, playerId: string, trait: string): boolean;
  /** Native target legality, including Guard for an attack and damage immunity. */
  enemyTargets(s: GameState, attack: boolean): BlackWidowTarget[];
  /** Finish this complete, independent attack program (including its remaining
   * clauses and all attack aftermath) before after. Overrides event-wide scope. */
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  numericBoostIcons(s: GameState, id: string): number;
  cancelBoostIcons(s: GameState, id: string): number;
  hasBoostAbility(s: GameState, id: string): boolean;
  cancelBoostAbility(s: GameState, id: string): void;
  /** Before encounter entry: cancel ALL effects/keywords, remove its reveal
   * window, and discard this physical card exactly once. */
  cancelEncounter(s: GameState, piece: Piece): void;
  /** Spycraft reveals, rather than merely deals, the actual next encounter. */
  revealReplacement(s: GameState, playerId: string): void;
  preventDamage(
    s: GameState,
    window: BlackWidowDamageWindow,
    amount: number,
  ): void;
  /** Re-enter the exact ally from THIS controller's discard with reset state
   * and apply damage immediately (simultaneous AND effects, RRG p7), BEFORE
   * entrance/defeat/ally-limit responses; then resolve the continuation. */
  returnDefeatedAlly(
    s: GameState,
    id: string,
    playerId: string,
    damage: number,
    after: Effect[],
  ): void;
  activationModifier(s: GameState, attack: number, scheme: number): void;
  log(s: GameState, message: string): void;
}

const hasSpy = (s: GameState, ports: BlackWidowPorts) =>
  ports.identityHasTrait(s, s.activePlayerId, "Spy") ||
  s.player.inPlay.some(
    (p) => cards.get(p.code)?.type_code === "ally" && trait(p, "Spy"),
  );
const sameAttacker = (s: GameState, a: BlackWidowAttackSnapshot) => {
  const p = enemy(s, a.attacker);
  return p &&
    (p.code === a.attackerCode ||
      (p.id === s.villain.id &&
        cards.get(p.code)?.name === cards.get(a.attackerCode)?.name))
    ? p
    : undefined;
};
/** A global Preparation changes the resolving seat to its controller. Keep
 * the suspended native continuation bound to the original resolving seat. */
const continuation = (
  s: GameState,
  effects: Effect[],
  playerId = s.activePlayerId,
) => effects.map((e) => ({ ...e, actorId: e.actorId || playerId }));
function preparationOption(
  ownerId: string,
  p: Piece,
  kind: string,
  args: Record<string, unknown>,
  after: Effect[],
): Option {
  return option(
    p.id,
    cards.get(p.code)!.name,
    [B("preparation", { id: p.id, kind, ...args, after, actorId: ownerId })],
    p.code,
  );
}
function controlledPreparations(s: GameState, code: string, heroOnly: boolean) {
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat);
    return heroOnly && view.player.form !== "hero"
      ? []
      : view.player.inPlay
          .filter((p) => p.code === code)
          .map((p) => ({ p, ownerId: seat.id, view }));
  });
}

export function blackWidowStats(s: GameState) {
  return {
    defense:
      active(s) && s.player.form === "hero"
        ? s.player.inPlay.filter((p) => p.code === "08009").length
        : 0,
  };
}
export function blackWidowAllyDiscount(s: GameState, c: Card) {
  return c.code === "08002" ? s.player.inPlay.filter(prep).length : 0;
}
export function blackWidowPlayRestriction(
  s: GameState,
  p: Piece,
  ports: BlackWidowPorts,
): string | null {
  if (
    maxOne.has(p.code) &&
    s.player.inPlay.some(
      (other) => cards.get(other.code)?.name === cards.get(p.code)?.name,
    )
  )
    return "You already control this maximum-one-per-player card.";
  if (["08018", "08033"].includes(p.code) && !hasSpy(s, ports))
    return "Control a Spy character to play this card.";
  if (
    p.code === "08023" &&
    !ports.identityHasTrait(s, s.activePlayerId, "Avenger")
  )
    return "Your current identity must have the Avenger trait.";
  if (
    p.code === "08004" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "There is no enemy that can be attacked.";
  return null;
}
/** Call only after the card has really been played. Declining preserves the
 * once-per-phase opportunity; playing another Preparation can offer it again. */
export function blackWidowCardPlayed(s: GameState, p: Piece): Effect[] {
  return active(s) &&
    s.player.form === "alter" &&
    prep(p) &&
    s.flags.bwMissionPrepPhase !== phaseKey(s) &&
    (s.player.deck.length || s.player.discard.length)
    ? [
        E("optional", {
          title: "Mission Prep",
          text: "Draw 1 card after playing this Preparation? Once per phase.",
          effects: [B("mission-prep", { phase: phaseKey(s) })],
        }),
      ]
    : [];
}
export function blackWidowAbilityOptions(s: GameState, id: string): Option[] {
  const p = own(s, id, "08005");
  return p &&
    !p.exhausted &&
    s.player.form === "alter" &&
    s.player.discard.some(prep)
    ? [
        option(
          "safe-house",
          "Safe House #29 · recover a Preparation",
          [B("safe-house", { id })],
          p.code,
        ),
      ]
    : [];
}
export function blackWidowAbility(
  s: GameState,
  id: string,
  action?: string,
): Effect[] | null {
  const choices = blackWidowAbilityOptions(s, id);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function blackWidowResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) =>
        !p.exhausted &&
        (p.code === "08023" ||
          (p.code === "08007" &&
            targetCode &&
            trait(targetCode, "Preparation"))),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: cards.get(p.code)!.name,
      resources: ["wild"],
      kind: "ability",
      description:
        p.code === "08007"
          ? "Exhaust · 1 wild for a Preparation card"
          : "Exhaust · 1 wild resource",
    }));
}
export function blackWidowResourceSpent(
  s: GameState,
  p: Piece,
  targetCode?: string,
): Effect[] {
  if (p.code === "08007")
    need(
      targetCode && trait(targetCode, "Preparation"),
      "Black Widow's Gauntlet only pays for Preparation cards.",
    );
  return [];
}
export function blackWidowEvent(
  _s: GameState,
  p: Piece,
  _paid: Resource[] = [],
): Effect[] | null {
  return p.code === "08004" ? [B("dance", { step: 0, initiated: true })] : null;
}
export function blackWidowAllyEnter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "08002" || p.code === "08012") return [];
  if (p.code !== "08011") return null;
  const actorId = controller(s, p.id)?.id || s.activePlayerId;
  return [
    E("optional", {
      actorId,
      title: "Agent Coulson",
      text: "Search your deck and discard pile for a Preparation, then shuffle your deck?",
      effects: [B("search", { actorId })],
    }),
  ];
}

/** These windows return opt-in abilities only; the host retains/queues its
 * original continuation on decline and passes it into the accepted ability. */
export function blackWidowBoostOptions(
  s: GameState,
  p: Piece,
  when: "interrupt" | "response",
  after: Effect[],
  ports: BlackWidowPorts,
): Option[] {
  const code = when === "interrupt" ? "08006" : "08024";
  if (
    when === "interrupt"
      ? ports.numericBoostIcons(s, p.id) <= 0
      : !ports.hasBoostAbility(s, p.id)
  )
    return [];
  return controlledPreparations(s, code, true).map(({ p: source, ownerId }) =>
    preparationOption(
      ownerId,
      source,
      when === "interrupt" ? "attacrobatics" : "target-acquired",
      { boostId: p.id },
      continuation(s, after),
    ),
  );
}
export function blackWidowRevealOptions(
  s: GameState,
  p: Piece,
  revealerId: string,
  after: Effect[],
): Option[] {
  const view = seatView(s, revealerId);
  return view.player.inPlay
    .filter(
      (source) =>
        source.code === "08018" ||
        (source.code === "08008" &&
          view.player.form === "hero" &&
          cards.get(p.code)?.type_code === "treachery"),
    )
    .map((source) =>
      preparationOption(
        revealerId,
        source,
        source.code === "08018" ? "spycraft" : "grappling-hook",
        { piece: p, revealerId },
        continuation(s, after, revealerId),
      ),
    );
}
/** Hook AFTER forced entry keywords, including Quickstrike (RRG1.8 FAQ p60). */
export function blackWidowMinionEntered(
  s: GameState,
  p: Piece,
  after: Effect[] = [],
  ports: BlackWidowPorts,
): Option[] {
  if (!s.minions.some((m) => m.id === p.id)) return [];
  return controlledPreparations(s, "08010", true)
    .filter(
      ({ view }) =>
        view.player.stunned ||
        ports.enemyTargets(view, true).some((target) => target.id === p.id),
    )
    .map(({ p: source, ownerId }) =>
      preparationOption(
        ownerId,
        source,
        "widows-bite",
        { target: p.id },
        continuation(s, after),
      ),
    );
}
export function blackWidowThreatOptions(
  s: GameState,
  packet: Effect,
  after: Effect[] = [],
): Option[] {
  if (packet.target !== "main" || packet.amount <= 0) return [];
  return controlledPreparations(s, "08017", false).map(({ p, ownerId }) =>
    preparationOption(
      ownerId,
      p,
      "counterintelligence",
      {
        packet: { ...packet, actorId: packet.actorId || s.activePlayerId },
      },
      continuation(s, after),
    ),
  );
}
export function blackWidowDamageOptions(
  s: GameState,
  window: BlackWidowDamageWindow,
  after: Effect[],
): Option[] {
  if (
    window.amount <= 0 ||
    !["hero", `hero:${window.playerId}`].includes(window.target)
  )
    return [];
  const view = seatView(s, window.playerId);
  if (view.player.form !== "hero" || view.player.tough) return [];
  return view.player.inPlay
    .filter((p) => p.code === "08032")
    .map((p) =>
      preparationOption(
        window.playerId,
        p,
        "defensive-stance",
        { window },
        continuation(s, after, window.playerId),
      ),
    );
}
/** Actual identity damage from the enemy attack only, including Overkill, not
 * boost/after-attack damage or damage that was dealt only to an ally. */
export function blackWidowAttackResponses(
  s: GameState,
  attack: BlackWidowAttackSnapshot,
  after: Effect[] = [],
): Option[] {
  const view = seatView(s, attack.playerId);
  if (
    view.player.form !== "hero" ||
    attack.heroDamage <= 0 ||
    (!sameAttacker(s, attack) && !view.player.stunned)
  )
    return [];
  return view.player.inPlay
    .filter((p) => p.code === "08030")
    .map((p) =>
      preparationOption(
        attack.playerId,
        p,
        "counterattack",
        { attack },
        continuation(s, after, attack.playerId),
      ),
    );
}
/** Call after the exact defeated ally reaches its owner's discard. A transferred
 * ally in another owner's discard is not in "your discard pile" (printed text). */
export function blackWidowAllyDefeated(
  s: GameState,
  ally: Piece,
  playerId: string,
  after: Effect[] = [],
): Option[] {
  const view = seatView(s, playerId);
  if (
    view.player.form !== "hero" ||
    !view.player.discard.some((p) => p.id === ally.id) ||
    uniqueConflict(s, cards.get(ally.code)!)
  )
    return [];
  return view.player.inPlay
    .filter((p) => p.code === "08031")
    .map((p) =>
      preparationOption(
        playerId,
        p,
        "rapid-response",
        { allyId: ally.id },
        continuation(s, after, playerId),
      ),
    );
}
export function blackWidowMinionSchemed(
  s: GameState,
  minion: Piece,
  after: Effect[] = [],
): Option[] {
  if (!s.minions.some((p) => p.id === minion.id)) return [];
  return playerOrder(s).flatMap((seat) =>
    seatView(s, seat)
      .player.inPlay.filter((p) => p.code === "08012" && !p.exhausted)
      .map((p) =>
        option(
          p.id,
          "Quake · exhaust to deal 2 damage to this minion",
          [
            B("quake", {
              id: p.id,
              target: minion.id,
              after: continuation(s, after),
              actorId: seat.id,
            }),
          ],
          p.code,
        ),
      ),
  );
}
export function blackWidowSurgeOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
): Option[] {
  return controlledPreparations(s, "08033", false).map(
    ({ p: source, ownerId }) =>
      preparationOption(
        ownerId,
        source,
        "espionage",
        { piece: p },
        continuation(s, after),
      ),
  );
}
export function blackWidowPreparationResolved(
  s: GameState,
  p: Piece | string,
  after: Effect[] = [],
): Effect[] {
  return trait(typeof p === "string" ? p : p.code, "Preparation")
    ? [B("after-preparation", { after, used: [] })]
    : after;
}
export function blackWidowEnemyModifier(
  s: GameState,
  p: Piece,
  playerId?: string,
) {
  return p.code === "08026"
    ? seatView(
        s,
        p.engagedWith || playerId || s.activePlayerId,
      ).player.inPlay.filter((p) => cards.get(p.code)?.type_code === "upgrade")
        .length
    : 0;
}
export function blackWidowEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "08025") {
    const owner = s.players.find(
      (seat) => seat.heroId === "black_widow" && !seat.eliminated,
    );
    return owner
      ? [B("obligation", { piece: p, actorId: owner.id })]
      : [E("discardEncounter", { piece: p })];
  }
  if (p.code === "08027")
    return [E("threat", { target: p.id, amount: s.playerCount })];
  if (p.code === "08029") return [B("deadly-shot")];
  if (p.code === "08026") return [];
  return null;
}
export function blackWidowBoost(s: GameState, p: Piece): Effect[] | null {
  return p.code === "08026"
    ? [B("taskmaster-boost")]
    : BLACK_WIDOW_SCRIPT_CODES.includes(
          p.code as (typeof BLACK_WIDOW_SCRIPT_CODES)[number],
        )
      ? []
      : null;
}

export function resolveBlackWidowEffect(
  s: GameState,
  e: Effect,
  ports: BlackWidowPorts,
): boolean {
  if (!e.type.startsWith("bw:")) return false;
  switch (e.type) {
    case "bw:mission-prep":
      if (
        active(s) &&
        s.player.form === "alter" &&
        e.phase === phaseKey(s) &&
        s.flags.bwMissionPrepPhase !== e.phase
      ) {
        s.flags.bwMissionPrepPhase = e.phase;
        ports.queue(s, E("draw", { amount: 1 }));
      }
      break;
    case "bw:safe-house": {
      const p = own(s, e.id, "08005");
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Safe House #29 is unavailable.",
      );
      const candidates = s.player.discard.filter(prep);
      need(candidates.length, "There is no discarded Preparation to recover.");
      ports.choose(
        s,
        "Safe House #29",
        "Choose a Preparation to recover.",
        candidates.map((target) =>
          option(
            target.id,
            cards.get(target.code)!.name,
            [B("safe-house-found", { id: p!.id, target: target.id })],
            target.code,
          ),
        ),
      );
      break;
    }
    case "bw:safe-house-found": {
      const p = own(s, e.id, "08005");
      const index = s.player.discard.findIndex(
        (p) => p.id === e.target && prep(p),
      );
      need(
        p && !p.exhausted && s.player.form === "alter" && index >= 0,
        "Safe House's cost or target is unavailable.",
      );
      p!.exhausted = true;
      s.player.hand.push(s.player.discard.splice(index, 1)[0]);
      break;
    }
    case "bw:search": {
      ports.revealHidden(s);
      const candidates = [...s.player.deck, ...s.player.discard].filter(prep);
      if (!candidates.length) {
        ports.shufflePlayerDeck(s);
        break;
      }
      ports.choose(
        s,
        "Agent Coulson",
        "Choose a Preparation from your deck or discard pile, then shuffle your deck.",
        candidates.map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [B("search-found", { id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "bw:search-found": {
      const zone = [s.player.deck, s.player.discard].find((pieces) =>
        pieces.some((p) => p.id === e.id && prep(p)),
      );
      need(zone, "Coulson's chosen Preparation is unavailable.");
      s.player.hand.push(
        zone!.splice(
          zone!.findIndex((p) => p.id === e.id),
          1,
        )[0],
      );
      ports.shufflePlayerDeck(s);
      break;
    }
    case "bw:dance": {
      if (e.step >= 3) break;
      // Form restrictions are checked when the event is initiated, not again
      // between attacks of its already-resolving ability (RRG p24–25).
      need(
        e.initiated || s.player.form === "hero",
        "Dance of Death requires hero form.",
      );
      if (s.player.stunned) {
        consumeStatus(s.player, "stunned");
        ports.queue(s, B("dance", { step: e.step + 1, initiated: true }));
        break;
      }
      const targets = ports.enemyTargets(s, true);
      if (!targets.length) {
        ports.queue(s, B("dance", { step: e.step + 1, initiated: true }));
        break;
      }
      ports.choose(
        s,
        "Dance of Death",
        `Choose the target of attack ${e.step + 1} (damage ${e.step + 1}).`,
        targets.map((p) =>
          option(
            p.id,
            p.label,
            [B("dance-hit", { target: p.id, step: e.step })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "bw:dance-hit":
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target) ||
          s.player.stunned,
        "Dance of Death's target is unavailable.",
      );
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: e.step + 1,
            source: "hero",
            attack: true,
          }),
        ],
        [B("dance", { step: e.step + 1, initiated: true })],
      );
      break;
    case "bw:preparation": {
      const p = own(s, e.id);
      need(
        p && prep(p!),
        "The Preparation is no longer controlled by this player.",
      );
      need(
        !heroPreps.has(p!.code) || s.player.form === "hero",
        "This Preparation requires hero form.",
      );
      const expected: Record<string, string> = {
        "08006": "attacrobatics",
        "08008": "grappling-hook",
        "08010": "widows-bite",
        "08017": "counterintelligence",
        "08018": "spycraft",
        "08024": "target-acquired",
        "08030": "counterattack",
        "08031": "rapid-response",
        "08032": "defensive-stance",
        "08033": "espionage",
      };
      need(
        expected[p!.code] === e.kind,
        "Preparation does not match this timing window.",
      );
      if (e.kind === "attacrobatics")
        need(
          ports.numericBoostIcons(s, e.boostId) > 0,
          "There are no boost icons to cancel.",
        );
      if (e.kind === "target-acquired")
        need(
          ports.hasBoostAbility(s, e.boostId),
          "There is no boost ability to cancel.",
        );
      if (e.kind === "widows-bite")
        need(
          enemy(s, e.target) || s.player.stunned,
          "The entering minion is no longer in play.",
        );
      if (e.kind === "counterattack")
        need(
          e.attack.heroDamage > 0 &&
            (sameAttacker(s, e.attack) || s.player.stunned),
          "Counterattack requires actual attack damage and its attacker.",
        );
      if (e.kind === "rapid-response")
        need(
          s.player.discard.some((a) => a.id === e.allyId) &&
            !uniqueConflict(
              s,
              cards.get(s.player.discard.find((a) => a.id === e.allyId)!.code)!,
            ),
          "The defeated ally is unavailable in your discard pile.",
        );
      if (e.kind === "defensive-stance")
        need(
          e.window.amount > 0 && !s.player.tough,
          "There is no damage to prevent.",
        );
      if (e.kind === "counterintelligence")
        need(
          e.packet.target === "main" && e.packet.amount > 0,
          "There is no main-scheme threat to prevent.",
        );
      if (["grappling-hook", "spycraft"].includes(e.kind))
        need(
          e.revealerId === s.activePlayerId &&
            (e.kind !== "grappling-hook" ||
              cards.get(e.piece.code)?.type_code === "treachery"),
          "This player is not revealing an eligible encounter.",
        );
      ports.discardPiece(s, p!.id);
      // Current errata: replacement by Stunned means the ability did not
      // resolve, so neither Widowmaker nor Synth-Suit can respond (RRG66).
      if (attackPreps.has(p!.code) && s.player.stunned) {
        consumeStatus(s.player, "stunned");
        ports.queue(s, ...(e.after || []));
        break;
      }
      const after = blackWidowPreparationResolved(s, p!, e.after || []);
      switch (e.kind) {
        case "attacrobatics": {
          const cancelled = ports.cancelBoostIcons(s, e.boostId);
          ports.attackProgram(
            s,
            [
              E("damage", {
                target: s.villain.id,
                amount: cancelled,
                source: "hero",
                attack: true,
              }),
            ],
            after,
          );
          break;
        }
        case "target-acquired":
          ports.cancelBoostAbility(s, e.boostId);
          ports.queue(s, ...after);
          break;
        case "grappling-hook":
          ports.cancelEncounter(s, e.piece);
          ports.queue(s, ...blackWidowPreparationResolved(s, p!));
          break;
        case "spycraft":
          ports.cancelEncounter(s, e.piece);
          ports.queue(
            s,
            ...blackWidowPreparationResolved(s, p!, [
              B("replacement", { playerId: e.revealerId }),
            ]),
          );
          break;
        case "widows-bite":
          ports.attackProgram(
            s,
            [
              E("damage", {
                target: e.target,
                amount: 2,
                source: "hero",
                attack: true,
              }),
              E("status", { target: e.target, status: "stunned" }),
            ],
            after,
          );
          break;
        case "counterattack":
          ports.attackProgram(
            s,
            [
              E("damage", {
                target: e.attack.attacker,
                amount: e.attack.heroDamage,
                source: "hero",
                attack: true,
              }),
            ],
            after,
          );
          break;
        case "counterintelligence": {
          const packet = {
            ...e.packet,
            amount: Math.max(0, e.packet.amount - 3),
          };
          ports.queue(
            s,
            ...blackWidowPreparationResolved(s, p!, [
              packet,
              ...(e.after || []),
            ]),
          );
          break;
        }
        case "defensive-stance":
          ports.preventDamage(s, e.window, 3);
          ports.queue(s, ...after);
          break;
        case "rapid-response":
          ports.returnDefeatedAlly(s, e.allyId, s.activePlayerId, 1, after);
          break;
        case "espionage":
          ports.queue(s, E("draw", { amount: 2 }), ...after);
          break;
        default:
          throw Error(`Unknown Preparation: ${e.kind}`);
      }
      break;
    }
    case "bw:replacement":
      ports.revealReplacement(s, e.playerId);
      break;
    case "bw:after-preparation": {
      const used: string[] = e.used || [];
      const choices: Option[] = [];
      if (active(s) && s.player.form === "hero") {
        if (!used.includes("widowmaker") && ports.enemyTargets(s, false).length)
          choices.push(
            option(
              "widowmaker",
              "Widowmaker · deal 1 damage to an enemy",
              [
                B("widowmaker"),
                B("after-preparation", {
                  after: e.after,
                  used: [...used, "widowmaker"],
                }),
              ],
              "08001a",
            ),
          );
        if (s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId))
          for (const p of s.player.inPlay.filter(
            (p) => p.code === "08009" && !p.exhausted && !used.includes(p.id),
          ))
            choices.push(
              option(
                p.id,
                "Synth-Suit · exhaust to ready Black Widow",
                [
                  B("synth-suit", { id: p.id }),
                  B("after-preparation", {
                    after: e.after,
                    used: [...used, p.id],
                  }),
                ],
                p.code,
              ),
            );
      }
      if (!choices.length) ports.queue(s, ...(e.after || []));
      else
        ports.choose(
          s,
          "After your Preparation resolves",
          "Use each available response once, in any order, or continue.",
          [...choices, option("continue", "Continue", e.after || [])],
        );
      break;
    }
    case "bw:widowmaker":
      need(
        active(s) && s.player.form === "hero",
        "Widowmaker requires Black Widow in hero form.",
      );
      ports.choose(
        s,
        "Widowmaker",
        "Choose an enemy for 1 non-attack damage.",
        ports
          .enemyTargets(s, false)
          .map((p) =>
            option(
              p.id,
              p.label,
              [E("damage", { target: p.id, amount: 1, source: "hero" })],
              p.code,
            ),
          ),
      );
      break;
    case "bw:synth-suit": {
      const p = own(s, e.id, "08009");
      need(
        active(s) &&
          s.player.form === "hero" &&
          p &&
          !p.exhausted &&
          s.player.exhausted &&
          ports.canReadyIdentity(s, s.activePlayerId),
        "Synth-Suit cannot ready this identity.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "bw:quake": {
      const p = own(s, e.id, "08012");
      need(
        p && !p.exhausted && s.minions.some((m) => m.id === e.target),
        "Quake's response is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 2, source: p!.id }),
        ...(e.after || []),
      );
      break;
    }
    case "bw:obligation":
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Burn Notice",
          "You may change to Natasha Romanoff before resolving this obligation.",
          [
            option("flip", "Change to Natasha Romanoff", [
              B("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              B("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, B("obligation-choice", { piece: e.piece }));
      break;
    case "bw:obligation-flip":
      need(
        s.player.form === "hero" && ports.canChangeForm(s),
        "This identity cannot change form.",
      );
      ports.flip(s, false);
      ports.queue(s, B("obligation-choice", { piece: e.piece }));
      break;
    case "bw:obligation-choice": {
      const choices: Option[] = [];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.push(
          option("exhaust", "Exhaust Natasha Romanoff · remove Burn Notice", [
            E("exhaust", { id: "hero" }),
            E("removeEncounter", { piece: e.piece }),
          ]),
        );
      choices.push(
        option(
          "discard",
          "Discard your highest-cost Preparation (Surge if none)",
          [B("obligation-discard", { piece: e.piece })],
        ),
      );
      ports.choose(
        s,
        "Burn Notice",
        "Choose an available obligation effect.",
        choices,
      );
      break;
    }
    case "bw:obligation-discard": {
      const candidates = s.player.inPlay.filter(prep);
      if (!candidates.length) {
        ports.queue(s, E("surge"), E("discardEncounter", { piece: e.piece }));
        break;
      }
      const highest = Math.max(
        ...candidates.map((p) => Number(cards.get(p.code)?.cost || 0)),
      );
      ports.choose(
        s,
        "Burn Notice",
        "Choose a highest printed-cost Preparation to discard.",
        candidates
          .filter((p) => Number(cards.get(p.code)?.cost || 0) === highest)
          .map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [
                E("discardPiece", { id: p.id }),
                E("discardEncounter", { piece: e.piece }),
              ],
              p.code,
            ),
          ),
      );
      break;
    }
    case "bw:deadly-shot": {
      const candidates = s.player.inPlay.filter(
        (p) => cards.get(p.code)?.type_code === "upgrade",
      );
      const after =
        s.player.form === "hero"
          ? E("damage", { target: "hero", amount: 1, source: "Deadly Shot" })
          : E("threat", { target: "main", amount: 1 });
      if (!candidates.length) ports.queue(s, after);
      else
        ports.choose(
          s,
          "Deadly Shot",
          "Choose an upgrade to discard.",
          candidates.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [E("discardPiece", { id: p.id }), after],
              p.code,
            ),
          ),
        );
      break;
    }
    case "bw:taskmaster-boost": {
      const count = s.player.inPlay.filter(
        (p) => cards.get(p.code)?.type_code === "upgrade",
      ).length;
      ports.activationModifier(s, count, count);
      break;
    }
    default:
      throw Error(`Unimplemented Black Widow effect: ${e.type}`);
  }
  return true;
}
