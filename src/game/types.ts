export type Aspect = "justice" | "aggression" | "leadership" | "protection";
export type Resource = "energy" | "mental" | "physical" | "wild";
/** How often guided play pauses for Proceed. Decisions always pause. */
export type Pacing = "guided" | "brisk" | "expert";
export interface Card {
  code: string;
  name: string;
  type_code: string;
  faction_code: string;
  /** Retail/downloadable product containing this printing. */
  pack_code?: string;
  set_code?: string;
  text?: string;
  errata?: { reference: string; url: string };
  traits?: string;
  quantity: number;
  cost?: number;
  permanent?: boolean;
  health_per_hero?: boolean;
  health_per_group?: boolean;
  cost_per_hero?: boolean;
  base_threat_per_group?: boolean;
  threat_per_group?: boolean;
  attack?: number;
  attack_star?: boolean;
  thwart?: number;
  defense?: number;
  recover?: number;
  health?: number;
  hand_size?: number;
  attack_cost?: number;
  thwart_cost?: number;
  scheme?: number;
  scheme_star?: boolean;
  boost?: number;
  boost_star?: boolean;
  stage?: number;
  base_threat?: number;
  threat?: number;
  escalation_threat?: number;
  scheme_crisis?: number;
  scheme_hazard?: number;
  scheme_acceleration?: number;
  resource_energy?: number;
  resource_mental?: number;
  resource_physical?: number;
  resource_wild?: number;
  is_unique?: boolean;
  hidden?: boolean;
  back_link?: string;
  deck_limit?: number;
  position: number;
  subname?: string;
  base_threat_fixed?: boolean;
  threat_fixed?: boolean;
  escalation_threat_fixed?: boolean;
}
/** Running mission totals for the result screen; never used by the rules. */
export interface MissionStats {
  damageDealt: number;
  damageTaken: number;
  threatRemoved: number;
  threatPlaced: number;
  cardsPlayed: number;
  enemiesDefeated: number;
}
export interface Piece {
  /** Beguiled changes the actual ally's current type without changing its face. */
  treatedAsMinion?: boolean;
  /** Actual owned cards tucked beneath this instance; faces stay private. */
  storedCards?: Piece[];
  /** Physical facedown boosts assigned to this enemy; consumed only on activation. */
  inheritorBoosts?: Piece[];
  /** Physical acceleration tokens on this side scheme leave with its instance. */
  accelerationTokens?: number;
  pendingDefeat?: boolean;
  id: string;
  code: string;
  exhausted: boolean;
  damage: number;
  counters: number;
  tough: boolean;
  stunned: boolean;
  confused: boolean;
  attachedTo?: string;
  /** Steady requires two status cards; booleans mean the status is active. */
  stunCards?: number;
  confuseCards?: number;
  toughCards?: number;
  droneCard?: Piece;
  captured?: Piece[];
  bonusAtk?: number;
  bonusThw?: number;
  used?: boolean;
  ownerId?: string;
  engagedWith?: string;
  dealtTo?: string;
}
export interface Effect {
  type: string;
  [key: string]: any;
}
export interface Option {
  id: string;
  label: string;
  detail?: string;
  image?: string;
  effects: Effect[];
}
export interface Prompt {
  context?: ActionReview;
  kind: "choice" | "payment" | "select";
  title: string;
  text: string;
  options: Option[];
  min?: number;
  max?: number;
  cost?: number;
  requirements?: Resource[];
  card?: Piece;
  after?: Effect[];
  /** Costs committed before resource-spend responses open. */
  paymentCommit?: Effect[];
  cancelable?: boolean;
  /** A canceled optional payment resumes the already initiated activation. */
  cancellationQueue?: Effect[];
  paymentTarget?: string;
  /** Printed costs such as Blade must spend cards from hand. */
  handOnly?: boolean;
  /** Printed Alliance permits contributions from other surviving seats. */
  alliance?: boolean;
  /** At least one actual additional-cost hand ally must remain unspent. */
  retainOneOfIds?: string[];
  /** At least one whole alternative group of actual hand cards must remain. */
  retainAlternatives?: string[][];
  /** Selected resource abilities must also fund the pending additional cost. */
  sourceRequirement?: { ids: string[]; minimum: number; label: string };
  /** The physical payment subject is using an ability, not being played. */
  abilityCost?: boolean;
  /** Actual already generated sources whose paid ability costs completed. */
  committedResources?: import("./payment.js").PaymentSource[];
  wildAs?: Resource;
  selectAction?: Effect;
}
export interface Attack {
  primaryTargetControllerId?: string;
  /** Actual Sabretooth Strikes boost sources retained for this attack only. */
  sabretoothAllyDefeatBoostIds?: string[];
  /** Stable identity of this native enemy attack across saved interrupts. */
  id?: string;
  /** A played Defense event has already declared the current hero/ally defender. */
  eventDefense?: boolean;
  /** Each actual attacked character receives Piercing once during this attack. */
  piercingTargets?: string[];
  mutantProtectorsDefender?: { allyId: string; playerId: string };
  colossusToughDiscardReceipts?: import("./colossus.js").ColossusToughDiscardReceipt[];
  /** This activation reached its actual attack damage step. */
  completionRecorded?: boolean;
  /** Flora Colossus applies once to each incoming identity damage packet. */
  grootDamageHandled?: boolean;
  grootOverkillHandled?: boolean;
  /** Wide Stance reduces each native identity attack packet once. */
  nebulaDamageHandled?: boolean;
  nebulaOverkillHandled?: boolean;
  /** The declared defender returned to hand before its damage was placed. */
  gmwReturnedDefender?: string;
  /** Printed boost grants and whole-attack prevention survive defender choice. */
  piercing?: boolean;
  preventAllDamage?: boolean;
  interruptsUsed?: string[];
  identityPrevented?: number;
  retainedBoostIds?: string[];
  modifier?: number;
  omitNormalBoost?: boolean;
  extraBoostIcons?: number;
  afterActivation?: Effect[];
  /** Effects tied to this actual attack, before optional aftermath responses. */
  visionAfterAttack?: Effect[];
  activationAfter?: Effect;
  attackerSnapshot?: Piece;
  identityDamage?: number;
  damagePlaced?: number;
  /** Actual per-character attack damage after a simultaneous replacement. */
  attackDamageReceipts?: { target: string; actualDamage: number }[];
  defenseBonus?: number;
  originalTarget?: string;
  targetPlayerId?: string;
  originalPlayerId?: string;
  basicDefense?: boolean;
  /** Shieldmaiden declares a defense without performing the basic power. */
  valkyrieDefense?: boolean;
  /** The Best Defense replaces DEF with current ATK for this defender only. */
  valkyriePackAttackDefensePlayerId?: string;
  visionPackManchaHandled?: boolean;
  magnetoAllyDefeatBoostIds?: string[];
  magnetoAllyDefeated?: boolean;
  attacker: string;
  base: number;
  boostCodes: string[];
  /** Committed numeric counts for original physical activation boost cards. */
  boostValues?: Record<string, number>;
  boostIds?: string[];
  pendingBoosts?: Piece[];
  boostEffects: Effect[];
  defender?: string;
  defense: number;
  prevented: number;
  damage: number;
  overkill: boolean;
  extra?: string;
  isVillain: boolean;
}
export interface GameState {
  /** Original Magneto main stages, future villains and set-aside Orbital Decay. */
  magneto?: import("./magneto.js").MagnetoState;
  /** Original Mansion Attack hidden piles and physical active main scheme. */
  mansionAttack?: import("./mansion-attack.js").MansionAttackState;
  /** Physical Magneto stays in an ordinary ally zone; these are saved receipts. */
  masterMold?: import("./master-mold.js").MasterMoldState;
  /** Actual set-aside Captive allies and saved Project Wideawake receipts. */
  projectWideawake?: import("./project-wideawake.js").ProjectWideawakeState;
  /** Saved confirmed defeat metadata, never another physical card zone. */
  zeroToleranceDefeats?: Record<
    string,
    import("./zero-tolerance.js").ZeroToleranceAllyDefeatReceipt[]
  >;
  /** One physical scenario ally, with independent control and saved receipts. */
  sabretooth?: import("./sabretooth.js").SabretoothState;
  /** Encounter cards with Victory remain outside every discard/recycle pile. */
  victoryDisplay?: Piece[];
  /** Last observed physical Shapeshifter hand entries, shared across seats. */
  mystiqueHandPresence?: Record<string, string[]>;
  /** Actual side-scheme entry receipt, independent of cooperative actor swaps. */
  brotherhoodEntered?: Record<string, boolean>;
  /** Actual completed enemy attacks by physical attacker, across defending seats. */
  enemyAttackCounts?: Record<string, number>;
  /** Physical source event for the currently resolving effect only. */
  currentEventId?: string;
  /** Independent nested attack: preserves printed clauses before its aftermath. */
  currentAttackProgramId?: string;
  /** Resolving attack aftermath. Queued effects retain this context across saves. */
  currentResponseGroup?: string;
  currentResponseMandatory?: boolean;
  currentRevealWindowId?: string;
  boostCancellations?: Record<string, { icons?: boolean; ability?: boolean }>;
  revealWindows?: Record<string, import("./reveal-window").RevealWindow>;
  pendingMainCompletion?: boolean;
  scriptCheckpoints?: Record<
    string,
    {
      target: string;
      code?: string;
      stage?: number;
      threat?: number;
      existed: boolean;
    }[]
  >;
  accountMission?: { id: string; startedAt: string };
  /** Presentation events from the latest command; never used by the rules. */
  combatEvents?: CombatEvent[];
  version: 1;
  seed: number;
  /** The seed the mission started with; `seed` itself advances with every shuffle. */
  startSeed?: number;
  nextId: number;
  heroId: string;
  aspect: Aspect;
  villainId: string;
  difficulty: "standard" | "expert";
  module: string;
  /** Exact selected modular sets; the primary module preserves old saves. */
  modules?: string[];
  phase: "mulligan" | "player" | "villain" | "won" | "lost";
  /** The part of the villain phase currently resolving. */
  villainStep?: VillainStep;
  round: number;
  players: PlayerSeat[];
  activePlayerId: string;
  firstPlayerId: string;
  turnPlayerId: string;
  playerCount: number;
  guided: boolean;
  pacing?: Pacing;
  /** Meaningful results that resolved without a pause in the faster tempos. */
  timeline?: ActionReview[];
  /** Heroic mode: additional encounter cards dealt to each player every villain phase. */
  heroic?: number;
  /** Increases whenever hidden information is revealed or the RNG advances; undo stops there. */
  hiddenInfo?: number;
  stats?: MissionStats;
  review: ActionReview | null;
  reviewCount: number;
  player: {
    form: "hero" | "alter";
    /** Three-sided identities retain their selected hero face through saves. */
    heroForm?: "tiny" | "giant";
    /** Ironheart's current physical identity. Its two other physical versions
     * remain set aside and swap with this instance without leaving play. */
    ironheartIdentity?: Piece;
    /** Spider-Ham's actual identity retains its physical ID and toon counters
     * when its face changes and through JSON saves. */
    spiderHamIdentity?: Piece;
    /** Active physical SP//dr identity; the other card occupies inPlay once. */
    spdrIdentity?: Piece;
    spdrSuitId?: string;
    spdrPilotId?: string;
    hp: number;
    exhausted: boolean;
    flipped: boolean;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
    hand: Piece[];
    stunCards?: number;
    confuseCards?: number;
    toughCards?: number;
    deck: Piece[];
    discard: Piece[];
    inPlay: Piece[];
    /** Actual owned cards set aside by setup. These remain outside the player
     * and encounter decks until a card ability moves that physical instance. */
    setAside?: Piece[];
    /** Doctor Strange's separate physical supplementary deck. Never part of the
     * player draw pile or its exhaustion rule. Only its current top is faceup. */
    invocationDeck?: Piece[];
    invocationDiscard?: Piece[];
  };
  villain: Piece & { hp: number; maxHp: number; stage: number };
  scheme: { code: string; threat: number; index: number };
  minions: Piece[];
  sideSchemes: Piece[];
  attachments: Piece[];
  /** Persistent scenario environments, distinct from encounter attachments. */
  environments?: Piece[];
  encounter: {
    storedBoosts?: Piece[];
    knownTop?: { id: string; playerId: string };
    deck: Piece[];
    discard: Piece[];
    dealt: Piece[];
    acceleration: number;
  };
  removed: Piece[];
  resolving: Piece[];
  scheming?: {
    id?: string;
    retainedBoostIds?: string[];
    modifier?: number;
    extraBoostIcons?: number;
    afterActivation?: Effect[];
    /** Effects tied to this actual attack, before optional aftermath responses. */
    visionAfterAttack?: Effect[];
    activationAfter?: Effect;
    threatBefore?: number;
    attacker: string;
    boostCodes: string[];
    boostValues?: Record<string, number>;
    boostIds: string[];
    pendingBoosts: Piece[];
    extra?: string;
  };
  prompt: Prompt | null;
  queue: Effect[];
  log: {
    id: number;
    round: number;
    text: string;
    kind: "info" | "good" | "bad" | "phase";
  }[];
  flags: Record<string, number | boolean | string>;
  /** Consequential-damage receipts remain attached to the actual ally until
   * its defeat window finishes, including saves during an interrupt. */
  spiderHamConsequentialReceipts?: Record<
    string,
    {
      token: string;
      playerId: string;
      consequential: boolean;
      amount: number;
      remainingHP: number;
      textBlank: boolean;
    }
  >;
  attack: Attack | null;
  lastEncounter?: string;
  result?: string;
  error?: string;
}
export interface CombatEvent {
  attacker: { code: string; name: string };
  target: { code: string; name: string };
  blocked: boolean;
  enemy: boolean;
}
export interface PlayerSeat {
  deckCards?: string[];
  deckAspects?: Aspect[];
  id: string;
  heroId: string;
  aspect: Aspect;
  player: GameState["player"];
  flags: GameState["flags"];
  ended: boolean;
  eliminated: boolean;
  mulliganDone: boolean;
}
export interface ReviewCard {
  id: string;
  code?: string;
  name: string;
  label: string;
  detail: string;
  kind:
    | "spent"
    | "drawn"
    | "discarded"
    | "played"
    | "revealed"
    | "moved"
    | "ability"
    | "boost"
    | "dealt";
  resources?: Resource[];
}
/** The villain phase runs threat, then each villain activation, then encounters, then the new round. */
export type VillainStep = "threat" | "activation" | "encounters" | "newRound";
export interface ActionReview {
  id: number;
  title: string;
  actor: string;
  phase: string;
  /** Which part of the villain phase this step belongs to, when it is one. */
  step?: VillainStep;
  source?: string;
  attack?: {
    attacker: { code: string; name: string };
    target: { code: string; name: string; playerId: string };
    identity: { code: string; name: string };
    label: string;
  };
  cards?: ReviewCard[];
  payment?: { title: string; cost: number; total: number };
  calculation?: {
    label: string;
    unit?: "damage" | "threat";
    parts: { label: string; value: number }[];
    total: number;
    note: string;
  };
  messages: string[];
  changes: {
    key?: string;
    label: string;
    before: string | number;
    after: string | number;
    kind: "health" | "threat" | "cards" | "status";
  }[];
}
export type Command =
  | { type: "PROCEED" }
  | { type: "MULLIGAN"; ids: string[] }
  | { type: "CHOOSE"; id: string }
  | { type: "SELECT"; ids: string[] }
  | { type: "PAY"; ids: string[]; wildAs?: Resource }
  | { type: "PLAY"; id: string; playerId?: string }
  | { type: "BASIC"; action: "attack" | "thwart" | "recover" }
  | { type: "FLIP"; target?: "alter" | "tiny" | "giant" }
  | { type: "ABILITY"; id: string; action?: string; playerId?: string }
  | { type: "END_TURN"; discard?: string[] }
  | { type: "CANCEL" }
  | { type: "SET_PACING"; pacing: Pacing };
