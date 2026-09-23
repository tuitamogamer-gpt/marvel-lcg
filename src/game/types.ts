export type Aspect = "justice" | "aggression" | "leadership" | "protection";
export type Resource = "energy" | "mental" | "physical" | "wild";
export interface Card {
  code: string;
  name: string;
  type_code: string;
  faction_code: string;
  set_code?: string;
  text?: string;
  traits?: string;
  quantity: number;
  cost?: number;
  attack?: number;
  thwart?: number;
  defense?: number;
  recover?: number;
  health?: number;
  hand_size?: number;
  attack_cost?: number;
  thwart_cost?: number;
  scheme?: number;
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
export interface Piece {
  id: string;
  code: string;
  exhausted: boolean;
  damage: number;
  counters: number;
  tough: boolean;
  stunned: boolean;
  confused: boolean;
  attachedTo?: string;
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
  cancelable?: boolean;
  paymentTarget?: string;
  wildAs?: Resource;
  selectAction?: Effect;
}
export interface Attack {
  targetPlayerId?: string;
  attacker: string;
  base: number;
  boostCodes: string[];
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
  version: 1;
  seed: number;
  nextId: number;
  heroId: string;
  aspect: Aspect;
  villainId: string;
  difficulty: "standard" | "expert";
  module: string;
  phase: "mulligan" | "player" | "villain" | "won" | "lost";
  round: number;
  players: PlayerSeat[];
  activePlayerId: string;
  firstPlayerId: string;
  turnPlayerId: string;
  playerCount: number;
  guided: boolean;
  review: ActionReview | null;
  reviewCount: number;
  player: {
    form: "hero" | "alter";
    hp: number;
    exhausted: boolean;
    flipped: boolean;
    stunned: boolean;
    confused: boolean;
    tough: boolean;
    hand: Piece[];
    deck: Piece[];
    discard: Piece[];
    inPlay: Piece[];
  };
  villain: Piece & { hp: number; maxHp: number; stage: number };
  scheme: { code: string; threat: number; index: number };
  minions: Piece[];
  sideSchemes: Piece[];
  attachments: Piece[];
  encounter: {
    deck: Piece[];
    discard: Piece[];
    dealt: Piece[];
    acceleration: number;
  };
  removed: Piece[];
  prompt: Prompt | null;
  queue: Effect[];
  log: {
    id: number;
    round: number;
    text: string;
    kind: "info" | "good" | "bad" | "phase";
  }[];
  flags: Record<string, number | boolean | string>;
  attack: Attack | null;
  lastEncounter?: string;
  result?: string;
  error?: string;
}
export interface PlayerSeat {
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
export interface ActionReview {
  id: number;
  title: string;
  actor: string;
  phase: string;
  source?: string;
  cards?: ReviewCard[];
  payment?: { title: string; cost: number; total: number };
  calculation?: {
    label: string;
    parts: { label: string; value: number }[];
    total: number;
    note: string;
  };
  messages: string[];
  changes: {
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
  | { type: "FLIP" }
  | { type: "ABILITY"; id: string; action?: string; playerId?: string }
  | { type: "END_TURN"; discard?: string[] }
  | { type: "CANCEL" };
