import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** NeXt Evolution's fifth scenario, Stryfe: his attacks and his main scheme
 * grow with the most common card type in each player's hand, Stryfe's Grasp
 * holds Hope Summers until it turns into the Living Bomb, and Left to Your
 * Fate squeezes every player card; with the Extreme Measures and Mutant
 * Insurrection modular sets, which join any scenario with modular sets. */

export const STRYFE_SCRIPT_CODES = [
  "40163",
  "40164",
  "40165",
  "40166a",
  "40166b",
  "40167a",
  "40167b",
  "40168a",
  "40168b",
  "40169",
  "40170",
  "40171",
  "40172",
  "40173",
  "40174",
  "40175",
  "40176",
  "40177",
  "40178",
  "40179",
] as const;
export const EXTREME_MEASURES_CODES = [
  "40180",
  "40181",
  "40182",
  "40183",
  "40184",
] as const;
export const MUTANT_INSURRECTION_CODES = [
  "40185",
  "40186",
  "40187",
  "40188",
  "40189",
] as const;
export const STRYFE_MODULAR_SETS = [
  "extreme_measures",
  "mutant_insurrection",
] as const;

const STAGES = ["40163", "40164", "40165"];
export const UNCONTROLLABLE_POWER = "40166b";
export const LEFT_TO_YOUR_FATE = "40167b";
export const STRYFES_GRASP = "40168a";
export const LIVING_BOMB = "40168b";
const MENTAL_TRANSFERAL = "40169";
export const MIND_ALTERATION = "40170";
export const MIND_TRAP = "40171";
export const PSIONIC_AMNESIA = "40172";
export const PSYCHIC_INERTIA = "40173";
export const ZERO = "40174";
const CEREBRAL_ERASURE = "40175";
const TELEPATHIC_CAMOUFLAGE = "40176";
const PSIONIC_SURGE = "40177";
const PSYCHIC_OVERRIDE = "40178";
const TELEKINETIC_WAVE = "40179";
const STROBE = "40180";
export const TEMPO = "40181";
const THUMBELINA = "40182";
const WILDSIDE = "40183";
export const EXTREME_MEASURES = "40184";
const DRAGONESS = "40185";
const FOREARM = "40186";
const REAPER = "40187";
export const SAMURAI = "40188";
const MUTANT_INSURRECTION = "40189";
/** The identity attachments of the Stryfe set. */
const IDENTITY_CONDITIONS = [
  MIND_ALTERATION,
  MIND_TRAP,
  PSIONIC_AMNESIA,
  PSYCHIC_INERTIA,
];
const CARD_TYPES = ["ally", "event", "upgrade", "support", "resource"];

export interface StryfePorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  heroName(s: GameState, playerId: string): string;
  allies(s: GameState, playerId: string): Piece[];
  /** Upgrades and supports the player controls, with their printed cost. */
  ownCards(
    s: GameState,
    playerId: string,
    types: string[],
  ): { piece: Piece; cost: number }[];
  /** Return a card the player controls to its owner's hand. */
  returnToHand(s: GameState, id: string): void;
  /** Discard a card from the player's hand. */
  discardFromHand(s: GameState, playerId: string, id: string): void;
  drawTo(s: GameState, playerId: string): void;
  mill(s: GameState, playerId: string, n: number): void;
  /** Reveal an encounter card discarded by a search for this player. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** Deal this discarded encounter card facedown to the player. */
  dealFacedown(s: GameState, p: Piece, playerId: string): void;
  endGame(s: GameState, won: boolean, reason: string): void;
  /** Stryfe at 0 hit points is defeated once Living Bomb is gone. */
  defeatVillain(s: GameState): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece | string) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const ST = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `stryfe:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const stryfe = (s: GameState) => s.villainId === "stryfe";
const stryfeInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code) && active(s, s.villain);
const isStryfe = (s: GameState, id: string) =>
  stryfeInPlay(s) && id === s.villain.id;
const scheme = (s: GameState, code: string) =>
  s.sideSchemes.find((q) => q.code === code && active(s, q));
const hand = (s: GameState, playerId: string) =>
  seatView(s, playerId).player.hand;
const typeOf = (p: Piece) => def(p)?.type_code || "";
const threat = (n: number, target = "main"): Effect => ({
  type: "threat",
  target,
  amount: n,
});
const minionPiece = (s: GameState, id: string) =>
  s.minions.find((m) => m.id === id);
const mlf = (p: Piece) => traits(p).includes("Mutant Liberation Front");

/** The number of cards of the most common type in a player's hand. */
export function commonType(s: GameState, playerId: string): number {
  const counts = new Map<string, number>();
  for (const p of hand(s, playerId))
    counts.set(typeOf(p), (counts.get(typeOf(p)) || 0) + 1);
  return Math.max(0, ...counts.values());
}
/** The printed resources of this type in a player's hand. */
const handResources = (
  s: GameState,
  playerId: string,
  r: "energy" | "mental" | "physical",
) =>
  hand(s, playerId).reduce(
    (n, p) =>
      n +
      Number(
        (def(p) as unknown as Record<string, unknown>)?.[`resource_${r}`] || 0,
      ),
    0,
  );
/** An identity condition of the Stryfe set attached to this player. */
const condition = (s: GameState, playerId: string, code: string) =>
  s.attachments.filter(
    (a) =>
      a.code === code && a.attachedTo === `hero:${playerId}` && active(s, a),
  );

// ------------------------------------------------------------------- setup

/** The deck leaves out Stryfe's Grasp, which starts in play. */
export const stryfeSetupCard = (code: string) =>
  code === STRYFES_GRASP || code === LIVING_BOMB;
/** Uncontrollable Power (1A): reveal Stryfe's Grasp. */
export function stryfeSetupEffects(
  s: GameState,
  makePiece: (s: GameState, code: string) => Piece,
): Effect[] {
  if (!stryfe(s)) return [];
  return [
    {
      type: "reveal",
      piece: makePiece(s, STRYFES_GRASP),
      actorId: s.firstPlayerId,
    },
  ];
}

// --------------------------------------------------------------- villain

/** While Stryfe attacks you, +X ATK; Dragoness's activation bonus. */
export function stryfeStatBonus(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
  playerId: string,
): number {
  if (stat === "attack" && isStryfe(s, p.id) && s.attack?.attacker === p.id)
    return commonType(s, playerId);
  const m = minionPiece(s, p.id);
  if (
    m?.code === DRAGONESS &&
    active(s, m) &&
    (s.attack?.attacker === m.id || s.scheming?.attacker === m.id)
  )
    return handResources(s, playerId, "energy");
  return 0;
}
/** Stryfe (II) When Revealed. */
export function stryfeVillainRevealed(s: GameState): Effect[] {
  if (!stryfe(s) || !stryfeInPlay(s) || s.villain.code !== "40164") return [];
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .map((seat) => ST("psionic-dig", { playerId: seat.id, actorId: seat.id }));
}
/** Stryfe (III): after you attack him, take X damage. */
export function stryfeAfterAttack(
  s: GameState,
  targetId: string,
  playerId: string,
): Effect[] {
  if (!isStryfe(s, targetId) || s.villain.code !== "40165") return [];
  const x = commonType(s, playerId);
  return x
    ? [
        {
          type: "damage",
          target: "hero",
          amount: x,
          source: s.villain.id,
          actorId: playerId,
        },
      ]
    : [];
}
/** Living Bomb: Stryfe cannot be defeated. */
export const stryfeCannotBeDefeated = (s: GameState) =>
  stryfe(s) && !!scheme(s, LIVING_BOMB);
/** Stryfe's Grasp: after Stryfe is defeated, it flips with its threat. */
export function stryfeVillainDefeated(s: GameState): Effect[] {
  const grasp = scheme(s, STRYFES_GRASP);
  return grasp ? [ST("flip", { id: grasp.id })] : [];
}
/** Uncontrollable Power: after step one of the villain phase, each player
 * places threat. */
export function stryfeStepOne(s: GameState): Effect[] {
  if (!stryfe(s) || s.scheme.code !== UNCONTROLLABLE_POWER) return [];
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .map((seat) => ST("power", { playerId: seat.id, actorId: seat.id }));
}
/** Uncontrollable Power is lost when completed. */
export const stryfeMainLoses = (s: GameState) =>
  stryfe(s) && s.scheme.code === UNCONTROLLABLE_POWER;
/** Left to Your Fate: Stryfe gains stalwart. */
export const stryfeStalwart = (s: GameState, p: Piece) =>
  stryfe(s) && isStryfe(s, p.id) && s.scheme.code === LEFT_TO_YOUR_FATE;
/** Left to Your Fate: +2 hand size; Tempo engaged with you: +1. */
export function stryfeHandSize(s: GameState): number {
  let n = 0;
  if (stryfe(s) && s.scheme.code === LEFT_TO_YOUR_FATE) n += 2;
  n += s.minions.filter(
    (m) =>
      m.code === TEMPO &&
      active(s, m) &&
      (m.engagedWith || s.activePlayerId) === s.activePlayerId,
  ).length;
  return n;
}
/** Left to Your Fate: each player card costs 1 more; Psionic Amnesia: each
 * ally and support you play costs 2 more. */
export function stryfeCostIncrease(s: GameState, c: Card): number {
  let n = 0;
  if (stryfe(s) && s.scheme.code === LEFT_TO_YOUR_FATE) n += 1;
  if (["ally", "support"].includes(c.type_code))
    n += 2 * condition(s, s.activePlayerId, PSIONIC_AMNESIA).length;
  return n;
}
/** Psychic Inertia: -1 ATK and -1 THW for each on your identity. */
export const stryfeIdentityPenalty = (s: GameState, playerId: string) =>
  condition(s, playerId, PSYCHIC_INERTIA).length;
/** Stryfe's Grasp: Hope Summers can attack only Stryfe and thwart only it. */
export function stryfeHopeTarget(
  s: GameState,
  p: Piece,
  action: "attack" | "thwart",
  targetId: string,
): boolean {
  if (p.code !== "40130" || !scheme(s, STRYFES_GRASP)) return true;
  if (action === "attack") return isStryfe(s, targetId);
  return scheme(s, STRYFES_GRASP)?.id === targetId;
}
/** Thumbelina takes 1 less damage from each attack unless the attacker is
 * Tiny. */
export function stryfeAttackReduction(
  s: GameState,
  target: string,
  attackerTiny: boolean,
): number {
  const m = minionPiece(s, target);
  return m?.code === THUMBELINA && active(s, m) && !attackerTiny ? 1 : 0;
}
/** Mutant Insurrection: each minion gains toughness. */
export const stryfeMinionToughness = (s: GameState) =>
  !!scheme(s, MUTANT_INSURRECTION);

// ---------------------------------------------------------------- windows

/** After the villain takes damage: Mental Transferal. */
export function stryfeVillainDamaged(
  s: GameState,
  target: string,
  n: number,
): Effect[] {
  if (n <= 0 || !isStryfe(s, target)) return [];
  return s.attachments
    .filter((a) => a.code === MENTAL_TRANSFERAL && active(s, a))
    .map((a) => ST("transferal", { id: a.id, n }));
}
/** After a player card is played: Mind Alteration and Psionic Amnesia. */
export function stryfeCardPlayed(
  s: GameState,
  playerId: string,
  c: Card,
): Effect[] {
  const effects: Effect[] = [];
  if (["event", "upgrade"].includes(c.type_code))
    for (const a of condition(s, playerId, MIND_ALTERATION))
      effects.push({
        type: "damage",
        target: "hero",
        amount: 1,
        source: a.id,
        actorId: playerId,
      });
  if (["ally", "support"].includes(c.type_code))
    for (const a of condition(s, playerId, PSIONIC_AMNESIA))
      effects.push(
        ST("amnesia-offer", { id: a.id, playerId, actorId: playerId }),
      );
  return effects;
}
/** After a player card enters play: Mind Trap and Extreme Measures. */
export function stryfeEnteredPlay(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  const c = def(p);
  if (!c) return [];
  if (
    ["ally", "upgrade", "support"].includes(c.type_code) &&
    condition(s, playerId, MIND_TRAP).length
  )
    p.exhausted = true;
  const cost = c.cost || 0;
  return scheme(s, EXTREME_MEASURES) && cost > 0
    ? [ST("indirect", { playerId, n: cost, source: EXTREME_MEASURES })]
    : [];
}
/** After you recover: Mind Alteration's Response. */
export function stryfeRecovered(s: GameState, playerId: string): Effect[] {
  return condition(s, playerId, MIND_ALTERATION).map((a) =>
    ST("alteration-offer", { id: a.id, playerId, actorId: playerId }),
  );
}
/** The hero attacked or thwarted this phase, for Psychic Inertia. */
export function stryfeBasicPower(
  s: GameState,
  action: string,
  playerId: string,
) {
  if (action !== "attack" && action !== "thwart") return;
  if (!condition(s, playerId, PSYCHIC_INERTIA).length) return;
  const view = seatView(s, playerId);
  view.flags[`stryfe:${action}:${s.round}:${s.phase}`] = true;
}
/** When the last threat is removed from Stryfe's Grasp, it flips. */
export function stryfeGraspCleared(
  s: GameState,
  p: Piece,
  ports: Pick<StryfePorts, "queue">,
): boolean {
  if (p.code !== STRYFES_GRASP || !active(s, p)) return false;
  ports.queue(s, ST("flip", { id: p.id }));
  return true;
}
/** After a side scheme is defeated: Living Bomb lets Stryfe be defeated;
 * Cerebral Erasure's When Defeated. */
export function stryfeSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (p.code === LIVING_BOMB) return [ST("bomb-defused")];
  if (p.code === CEREBRAL_ERASURE && active(s, p))
    return [ST("erasure", { playerId, actorId: playerId })];
  return [];
}
/** Zero's When Defeated: shuffled back unless the defeater holds 3 cards of
 * one type. */
export function stryfeMinionDefeatReplaced(
  s: GameState,
  p: Piece,
  playerId: string,
): boolean {
  return p.code === ZERO && active(s, p) && commonType(s, playerId) < 3;
}
/** When an enemy attacks you: Reaper. */
export function stryfeAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const m = minionPiece(s, attackerId);
  if (m?.code !== REAPER || !active(s, m)) return [];
  const mental = handResources(s, playerId, "mental");
  const effects: Effect[] = [];
  if (mental >= 2)
    effects.push({
      type: "status",
      target: "hero",
      status: "stunned",
      actorId: playerId,
    });
  if (mental >= 4)
    effects.push({ type: "exhaust", id: "hero", actorId: playerId });
  return effects;
}
/** After an enemy attacks you: Forearm and Samurai. */
export function stryfeAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const m = minionPiece(s, attackerId);
  if (!m || !active(s, m)) return [];
  if (m.code === FOREARM) {
    const n = handResources(s, playerId, "physical");
    return n ? [ST("mill", { playerId, n })] : [];
  }
  if (m.code === SAMURAI)
    return [ST("samurai", { id: m.id, playerId, actorId: playerId })];
  return [];
}
/** After Tempo activates against you. */
export function stryfeActivated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  const m = minionPiece(s, enemyId);
  if (m?.code !== TEMPO || !active(s, m) || !alive(s, playerId)) return [];
  const n = 2 * hand(s, playerId).length;
  return n ? [ST("mill", { playerId, n })] : [];
}

// ---------------------------------------------------------- reveal/boost

const ALL_CODES: readonly string[] = [
  ...STRYFE_SCRIPT_CODES,
  ...EXTREME_MEASURES_CODES,
  ...MUTANT_INSURRECTION_CODES,
];
export function stryfeReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  if (p.code === MENTAL_TRANSFERAL)
    return [ST("attach-transferal", { piece: p, playerId })];
  if (IDENTITY_CONDITIONS.includes(p.code))
    return [ST("attach-identity", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case LIVING_BOMB:
      return [ST("advance")];
    case CEREBRAL_ERASURE:
      return [ST("erasure", { playerId })];
    case TELEPATHIC_CAMOUFLAGE:
      return playerOrder(s)
        .filter((seat) => !seat.eliminated)
        .map((seat) => threat(commonType(s, seat.id), p.id));
    case PSIONIC_SURGE:
      return [ST("surge-dig", { playerId, n: commonType(s, playerId) })];
    case PSYCHIC_OVERRIDE:
      return [ST("override", { playerId })];
    case TELEKINETIC_WAVE:
      return [
        ST("return", { playerId, types: ["upgrade", "support"], own: true }),
        ST("activate", { playerId }),
      ];
    case STROBE:
      return [ST("strobe", { playerId })];
    case THUMBELINA:
      return [ST("return-highest", { playerId, cardType: "upgrade" })];
    case WILDSIDE:
      return [ST("wildside", { id: p.id, playerId })];
    case MUTANT_INSURRECTION: {
      const n = 2 * [...s.minions, s.villain].filter((q) => q && mlf(q)).length;
      return n ? [threat(n, p.id)] : [{ type: "surge", sourceCode: p.code }];
    }
    default:
      return [];
  }
}
export function stryfeBoost(s: GameState, p: Piece): Effect[] | null {
  if (![PSYCHIC_OVERRIDE, TELEKINETIC_WAVE].includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  if (p.code === PSYCHIC_OVERRIDE) return [ST("discard-draw", { playerId })];
  return commonType(s, playerId) >= 3 ? [threat(3)] : [];
}

// ------------------------------------------------------------ actions

export function stryfeActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.attachments.find(
    (p) => p.id === id && (p.code === MIND_TRAP || p.code === PSYCHIC_INERTIA),
  );
}
export function stryfeActions(
  s: GameState,
  p: Piece,
  ports: Pick<StryfePorts, "allies">,
): Option[] {
  if (
    s.phase !== "player" ||
    !active(s, p) ||
    p.attachedTo !== `hero:${s.activePlayerId}`
  )
    return [];
  if (p.code === MIND_TRAP) {
    // Alter-Ego Action: exhaust 3 cards you control.
    if (s.player.form !== "alter") return [];
    const ready = [
      ...(s.player.exhausted ? [] : [{ id: "hero" }]),
      ...s.player.inPlay.filter((q) => !q.exhausted),
    ];
    if (ready.length < 3) return [];
    return [
      {
        id: "discard",
        label:
          "Alter-Ego Action · exhaust 3 cards you control · discard Mind Trap",
        image: p.code,
        effects: [
          ST("trap-exhaust", { id: p.id, left: 3, playerId: s.activePlayerId }),
        ],
      },
    ];
  }
  if (p.code === PSYCHIC_INERTIA) {
    // Hero Action: if your hero attacked and thwarted this phase.
    const flags = s.flags;
    if (
      s.player.form !== "hero" ||
      !flags[`stryfe:attack:${s.round}:${s.phase}`] ||
      !flags[`stryfe:thwart:${s.round}:${s.phase}`]
    )
      return [];
    return [
      {
        id: "discard",
        label:
          "Hero Action · your hero attacked and thwarted · discard Psychic Inertia",
        image: p.code,
        effects: [{ type: "discardPiece", id: p.id }],
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------- resolver

export function resolveStryfeEffect(
  s: GameState,
  e: Effect,
  ports: StryfePorts,
): boolean {
  if (!e.type.startsWith("stryfe:")) return false;
  switch (e.type) {
    case "stryfe:flip": {
      // Stryfe's Grasp flips to Living Bomb with any threat on it.
      const grasp = s.sideSchemes.find((q) => q.id === e.id);
      if (!grasp || grasp.code !== STRYFES_GRASP) break;
      const carried = grasp.counters || 0;
      grasp.code = LIVING_BOMB;
      grasp.counters = (def(LIVING_BOMB)?.base_threat || 0) + carried;
      ports.log(s, "Stryfe's Grasp flips: Living Bomb.", "bad");
      ports.queue(s, ST("advance"));
      break;
    }
    case "stryfe:advance":
      // Living Bomb When Revealed: advance the main scheme to stage 2A.
      if (s.scheme.code !== UNCONTROLLABLE_POWER) break;
      s.scheme.code = LEFT_TO_YOUR_FATE;
      s.scheme.index = 1;
      s.scheme.threat =
        (def(LEFT_TO_YOUR_FATE)?.base_threat || 0) * s.playerCount;
      ports.log(s, "The main scheme advances: Left to Your Fate.", "bad");
      break;
    case "stryfe:bomb-defused":
      // Living Bomb is gone: Stryfe can be defeated again.
      if (stryfeInPlay(s) && s.villain.hp <= 0) ports.defeatVillain(s);
      break;
    case "stryfe:power": {
      // Uncontrollable Power: each player may discard 1 card, then places
      // threat equal to their most common card type.
      if (!alive(s, e.playerId) || over(s)) break;
      const cards = hand(s, e.playerId);
      const place = ST("power-threat", { playerId: e.playerId });
      if (!cards.length) {
        ports.queue(s, place);
        break;
      }
      ports.choose(
        s,
        name(UNCONTROLLABLE_POWER),
        `${ports.heroName(s, e.playerId)}: you may discard 1 card before placing threat equal to your most common card type (${commonType(s, e.playerId)}).`,
        [
          { id: "pass", label: "Do not discard", effects: [place] },
          ...cards.map((p) => ({
            id: p.id,
            label: `Discard ${name(p)}`,
            image: p.code,
            effects: [
              ST("discard-hand", { playerId: e.playerId, id: p.id }),
              place,
            ],
          })),
        ],
      );
      break;
    }
    case "stryfe:power-threat": {
      const n = commonType(s, e.playerId);
      if (n) ports.queue(s, threat(n));
      break;
    }
    case "stryfe:discard-hand":
      ports.discardFromHand(s, e.playerId, e.id);
      break;
    case "stryfe:psionic-dig": {
      // Discard from the encounter deck until a Psionic attachment.
      if (!alive(s, e.playerId) || over(s)) break;
      for (let i = 0; i < 60; i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (
          piece &&
          def(piece)?.type_code === "attachment" &&
          traits(piece).includes("Psionic")
        ) {
          ports.reveal(s, piece, e.playerId);
          break;
        }
        if (emptied || !piece) break;
      }
      break;
    }
    case "stryfe:surge-dig": {
      // Psionic Surge: discard the top X; Psionic cards are dealt to you.
      for (let i = 0; i < Number(e.n); i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && traits(piece).includes("Psionic"))
          ports.dealFacedown(s, piece, e.playerId);
        if (emptied || !piece) break;
      }
      break;
    }
    case "stryfe:transferal": {
      // Mental Transferal: the attached character takes equal damage.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a) break;
      const target = a.attachedTo || "";
      ports.queue(
        s,
        target.startsWith("hero:")
          ? {
              type: "damage",
              target: "hero",
              amount: e.n,
              source: a.id,
              actorId: target.slice(5),
            }
          : { type: "damage", target, amount: e.n, source: a.id },
        { type: "discardPiece", id: a.id },
      );
      break;
    }
    case "stryfe:attach-transferal": {
      // Attach to Hope Summers while Stryfe's Grasp is in play, otherwise to
      // your identity.
      const p = e.piece as Piece;
      const hope = s.players
        .flatMap((seat) => seatView(s, seat.id).player.inPlay)
        .find((q) => q.code === "40130");
      const target =
        scheme(s, STRYFES_GRASP) && hope ? hope.id : `hero:${e.playerId}`;
      p.attachedTo = target;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      if (!s.attachments.some((q) => q.id === p.id)) s.attachments.push(p);
      break;
    }
    case "stryfe:attach-identity": {
      const p = e.piece as Piece;
      p.attachedTo = `hero:${e.playerId}`;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      if (!s.attachments.some((q) => q.id === p.id)) s.attachments.push(p);
      break;
    }
    case "stryfe:amnesia-offer":
      if (!s.attachments.some((a) => a.id === e.id)) break;
      if (seatView(s, e.playerId).player.exhausted) break;
      ports.choose(s, name(PSIONIC_AMNESIA), "You played an ally or support.", [
        {
          id: "discard",
          label: "Exhaust your identity · discard Psionic Amnesia",
          image: PSIONIC_AMNESIA,
          effects: [
            { type: "exhaust", id: "hero", actorId: e.playerId },
            { type: "discardPiece", id: e.id },
          ],
        },
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    case "stryfe:alteration-offer":
      if (!s.attachments.some((a) => a.id === e.id)) break;
      if (!ports.canPay(s, 1, ["mental"])) break;
      ports.choose(s, name(MIND_ALTERATION), "You recovered.", [
        {
          id: "discard",
          label: "Spend 1 mental resource · discard Mind Alteration",
          image: MIND_ALTERATION,
          effects: [ST("pay-discard", { id: e.id, resources: ["mental"] })],
        },
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    case "stryfe:pay-discard":
      ports.pay(
        s,
        (e.resources as string[]).length,
        e.resources,
        [{ type: "discardPiece", id: e.id }],
        name(e.id),
        true,
      );
      break;
    case "stryfe:trap-exhaust": {
      // Mind Trap: exhaust 3 cards you control, one at a time.
      if (!s.attachments.some((a) => a.id === e.id)) break;
      const left = Number(e.left);
      if (left <= 0) {
        ports.queue(s, { type: "discardPiece", id: e.id });
        break;
      }
      const view = seatView(s, e.playerId).player;
      const next = ST("trap-exhaust", {
        id: e.id,
        left: left - 1,
        playerId: e.playerId,
      });
      const options: Option[] = [
        ...(view.exhausted
          ? []
          : [
              {
                id: "hero",
                label: `Exhaust ${ports.heroName(s, e.playerId)}`,
                effects: [
                  { type: "exhaust", id: "hero", actorId: e.playerId },
                  next,
                ],
              },
            ]),
        ...view.inPlay
          .filter((q) => !q.exhausted && q.id !== e.id)
          .map((q) => ({
            id: q.id,
            label: `Exhaust ${name(q)}`,
            image: q.code,
            effects: [{ type: "exhaust", id: q.id }, next],
          })),
      ];
      if (options.length)
        ports.choose(s, name(MIND_TRAP), `Exhaust ${left} more.`, options);
      break;
    }
    case "stryfe:erasure":
      // Cerebral Erasure: return an upgrade or support you control.
      ports.queue(
        s,
        ST("return", {
          playerId: e.playerId,
          types: ["upgrade", "support"],
          own: false,
        }),
      );
      break;
    case "stryfe:return": {
      // Return one of your upgrades or supports to its owner's (or your)
      // hand.
      if (!alive(s, e.playerId)) break;
      const own = ports.ownCards(s, e.playerId, e.types as string[]);
      if (own.length === 1) ports.returnToHand(s, own[0].piece.id);
      else if (own.length)
        ports.choose(
          s,
          "Return a card",
          "Return an upgrade or support you control to your hand.",
          own.map((o) => ({
            id: o.piece.id,
            label: `Return ${name(o.piece)}`,
            image: o.piece.code,
            effects: [ST("return-one", { id: o.piece.id })],
          })),
        );
      break;
    }
    case "stryfe:return-one":
      ports.returnToHand(s, e.id);
      break;
    case "stryfe:return-highest": {
      if (!alive(s, e.playerId)) break;
      const own = ports.ownCards(s, e.playerId, [e.cardType]);
      if (!own.length) break;
      const high = Math.max(...own.map((o) => o.cost));
      const tied = own.filter((o) => o.cost === high);
      if (tied.length === 1) ports.returnToHand(s, tied[0].piece.id);
      else
        ports.choose(
          s,
          "Return a card",
          `Return the highest-cost ${e.cardType} you control.`,
          tied.map((o) => ({
            id: o.piece.id,
            label: `Return ${name(o.piece)}`,
            image: o.piece.code,
            effects: [ST("return-one", { id: o.piece.id })],
          })),
        );
      break;
    }
    case "stryfe:activate":
      // Telekinetic Wave: Stryfe activates against you.
      if (!alive(s, e.playerId) || !stryfeInPlay(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    case "stryfe:override": {
      // Psychic Override: choose a card type.
      if (!alive(s, e.playerId)) break;
      ports.choose(
        s,
        name(PSYCHIC_OVERRIDE),
        "Choose a card type. Discard each other card from your hand, draw up to your hand size, then place 1 threat for each card of that type.",
        CARD_TYPES.map((t) => ({
          id: t,
          label: t[0].toUpperCase() + t.slice(1),
          effects: [ST("override-type", { playerId: e.playerId, cardType: t })],
        })),
      );
      break;
    }
    case "stryfe:override-type": {
      for (const p of [...hand(s, e.playerId)].filter(
        (q) => typeOf(q) !== e.cardType,
      ))
        ports.discardFromHand(s, e.playerId, p.id);
      ports.drawTo(s, e.playerId);
      const n = hand(s, e.playerId).filter(
        (q) => typeOf(q) === e.cardType,
      ).length;
      if (n) ports.queue(s, threat(n));
      break;
    }
    case "stryfe:discard-draw": {
      // Psychic Override's boost: discard 1 card, then draw 1.
      const cards = hand(s, e.playerId);
      if (!cards.length) break;
      ports.choose(
        s,
        name(PSYCHIC_OVERRIDE),
        "Discard 1 card from your hand, then draw 1 card.",
        cards.map((p) => ({
          id: p.id,
          label: `Discard ${name(p)}`,
          image: p.code,
          effects: [
            ST("discard-hand", { playerId: e.playerId, id: p.id }),
            { type: "draw", amount: 1, actorId: e.playerId },
          ],
        })),
      );
      break;
    }
    case "stryfe:strobe":
      // Strobe: stun each character you control, or 1 damage to each.
      if (!alive(s, e.playerId)) break;
      ports.choose(s, name(STROBE), "Choose one.", [
        {
          id: "stun",
          label: "Stun each character you control",
          effects: [
            {
              type: "status",
              target: "hero",
              status: "stunned",
              actorId: e.playerId,
            },
            ...ports.allies(s, e.playerId).map((q) => ({
              type: "status",
              target: q.id,
              status: "stunned",
            })),
          ],
        },
        {
          id: "damage",
          label: "Deal 1 damage to each character you control",
          effects: [
            {
              type: "damage",
              target: "hero",
              amount: 1,
              source: STROBE,
              actorId: e.playerId,
            },
            ...ports.allies(s, e.playerId).map((q) => ({
              type: "damage",
              target: q.id,
              amount: 1,
              source: STROBE,
            })),
          ],
        },
      ]);
      break;
    case "stryfe:wildside": {
      if (!alive(s, e.playerId)) break;
      const m = minionPiece(s, e.id);
      ports.choose(s, name(WILDSIDE), "Choose one.", [
        ...(m
          ? [
              {
                id: "attack",
                label: "Wildside attacks you",
                effects: [
                  ST("minion-attack", { id: m.id, playerId: e.playerId }),
                ],
              },
            ]
          : []),
        {
          id: "return",
          label:
            "Return the highest-cost support you control to its owner's hand",
          effects: [
            ST("return-highest", { playerId: e.playerId, cardType: "support" }),
          ],
        },
      ]);
      break;
    }
    case "stryfe:minion-attack": {
      const m = minionPiece(s, e.id);
      if (!m || !alive(s, e.playerId)) break;
      ports.activate(s, {
        enemyId: m.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "stryfe:indirect":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, e.n, e.source, name(e.source));
      break;
    case "stryfe:mill":
      if (alive(s, e.playerId)) ports.mill(s, e.playerId, Number(e.n));
      break;
    case "stryfe:zero-shuffle": {
      // Zero returns to the encounter deck.
      const i = s.encounter.discard.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = s.encounter.discard.splice(i, 1);
      s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, p]);
      delete s.encounter.knownTop;
      ports.log(s, "Zero is shuffled into the encounter deck.", "bad");
      break;
    }
    case "stryfe:samurai": {
      // Samurai: a charge counter, then damage or a costly card discarded.
      const m = minionPiece(s, e.id);
      if (!m || !alive(s, e.playerId)) break;
      m.counters = (m.counters || 0) + 1;
      const n = m.counters;
      const costly = ports
        .ownCards(s, e.playerId, ["ally", "upgrade", "support"])
        .filter((o) => o.cost >= n);
      ports.choose(
        s,
        name(SAMURAI),
        `Samurai has ${n} charge counter${n === 1 ? "" : "s"}.`,
        [
          {
            id: "damage",
            label: `Take ${n} damage`,
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: n,
                source: m.id,
                actorId: e.playerId,
              },
            ],
          },
          ...costly.map((o) => ({
            id: o.piece.id,
            label: `Discard ${name(o.piece)}`,
            image: o.piece.code,
            effects: [{ type: "discardPiece", id: o.piece.id }],
          })),
        ],
      );
      break;
    }
    default:
      throw Error(`Unknown Stryfe effect: ${e.type}`);
  }
  return true;
}
