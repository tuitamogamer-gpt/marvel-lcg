import type { Card, Effect, GameState, Piece, Resource } from "../types";

export type ScriptTrigger =
  | "event-action"
  | "ally-enter"
  | "activate"
  | "resource"
  | "static"
  | "encounter-reveal";
export type ScriptForm = "hero" | "alter" | "any";
export type ScriptSelector =
  | "enemy"
  | "minion"
  | "scheme"
  | "ally"
  | "controlled-ally"
  | "character"
  | "friendly";
export type ScriptNode =
  | { op: "draw"; amount: number }
  | { op: "target"; selector: ScriptSelector; effects: ScriptNode[] }
  | {
      op: "damage";
      amount: number;
      attack?: boolean;
      overkill?: boolean;
      piercing?: boolean;
      ranged?: boolean;
      ifDefeated?: ScriptNode[];
      target?: "hero" | "source" | "villain";
    }
  | {
      op: "thwart";
      amount: number;
      action?: boolean;
      target?: "main";
      ifThreatRemoved?: ScriptNode[];
    }
  | { op: "heal"; amount: number; target?: "hero" | "source" }
  | { op: "ready"; target?: "hero" | "source" }
  | {
      op: "status";
      status: "stunned" | "confused" | "tough";
      target?: "hero" | "source" | "villain";
    }
  | { op: "each-enemy"; effects: ScriptNode[] }
  | { op: "each-player"; effects: ScriptNode[] }
  | {
      op: "if-paid";
      resource: Resource;
      mode?: "any" | "only";
      yes: ScriptNode[];
      no?: ScriptNode[];
    }
  | {
      op: "if-paid-types";
      minimum: number;
      yes: ScriptNode[];
      no?: ScriptNode[];
    }
  | { op: "choice"; options: { label: string; effects: ScriptNode[] }[] }
  | { op: "generate-resource"; resources: Resource[] };
export interface StaticModifier {
  target: "hero" | "self" | "attached-ally" | "controlled-allies";
  stat:
    | "attack"
    | "thwart"
    | "defense"
    | "recover"
    | "health"
    | "hand_size"
    | "ally_limit";
  amount: number;
}
export interface CardScript {
  code: string;
  name: string;
  status: "supported" | "unsupported";
  implementation?: "core" | "script";
  canonicalCoreCode?: string;
  rule?: string;
  reason?: string;
  normalizedText: string;
  trigger?: ScriptTrigger;
  action?: "attack" | "thwart";
  form: ScriptForm;
  optional: boolean;
  costs: {
    exhaustSource?: boolean;
    discardSource?: boolean;
    spend?: Resource[];
  };
  program: ScriptNode[];
  modifiers: StaticModifier[];
  keywords: string[];
  constraints: {
    maxPerPlayer?: number;
    maxPerAlly?: number;
    attachTo?: ScriptSelector;
    namedIdentity?: string;
    playUnderAnyPlayer?: boolean;
  };
}
export interface ScriptContext {
  state: GameState;
  source: Piece;
  paid?: readonly Resource[];
  /** Both current hero and alter-ego printed names. */
  identityNames?: readonly string[];
  /** Native adapter accounts for immunity, status capacity, health limits and exhausted state. */
  canAffect?: (node: ScriptNode, targetId?: string) => boolean;
  /** Adapter resolves filtered choices; native broad groups work without it. */
  targets?: (
    selector: ScriptSelector,
    intent?: { attack: boolean; thwart: boolean },
  ) => { id: string; label: string; code?: string }[];
}
export type NativeScriptEffect = Effect;
export interface RegistryEntry {
  card: Card;
  script: CardScript;
}
