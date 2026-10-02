import type { Effect, GameState, Option, Piece } from "./types.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenActivation } from "./mutagen-formula.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const rb = (name: string, args: Record<string, unknown> = {}) =>
  E(`risky:${name}`, args);
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
type EnvironmentState = GameState & { environments?: Piece[] };

/** Authored module coverage; native integration and complete dependencies are separate gates. */
export const RISKY_BUSINESS_SCRIPT_CODES = [
  "02001a",
  "02001b",
  "02002a",
  "02002b",
  "02003a",
  "02003b",
  "02004a",
  "02004b",
  "02005a",
  "02005b",
  "02006a",
  "02006b",
  "02007",
  "02008",
  "02009",
  "02010",
  "02011",
  "02012",
  "02013",
] as const;
export const RISKY_BUSINESS_CONFIG = {
  id: "risky_business",
  name: "Risky Business",
  standardVillains: ["02001a", "02002a"],
  expertVillains: ["02002a", "02003a"],
  mainSchemes: ["02004b", "02005b"],
  scenarioSet: "risky_business",
  requiredSets: ["standard"],
  expertSets: ["expert"],
  recommendedModule: "goblin_gimmicks",
  environment: "02006a",
  source:
    "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc02_green_goblin_rules_insert.pdf",
} as const;

export interface RiskyBusinessEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  /** Create/move exactly one physical environment instance into its own zone. */
  putEnvironment(s: GameState, code: "02006a", counters: number): Piece;
  shuffleEncounter(s: GameState): void;
  /** Native batch discard, not draw: stop at the first player-deck exhaustion,
   * immediately reset/deal encounter and preserve physical owners/hidden info. */
  discardPlayerCards(s: GameState, playerId: string, amount: number): void;
  giveBoost(s: GameState, villainId: string, scope: "next"): void;
  /** Use the whole native activation and supply performed/actual outcomes to
   * the callback, including status/replacement cancellations. */
  activate(s: GameState, request: MutagenActivation): void;
}

export const isRiskyVillain = (code: string) => /^0200[123][ab]$/.test(code);
export const riskyVillainForm = (s: GameState): "norman" | "goblin" | null =>
  isRiskyVillain(s.villain.code)
    ? s.villain.code.endsWith("a")
      ? "norman"
      : "goblin"
    : null;
export function riskyEnvironment(s: GameState): Piece | undefined {
  return (s as EnvironmentState).environments?.find((p) =>
    ["02006a", "02006b"].includes(p.code),
  );
}
export function riskyCounters(
  s: GameState,
  kind: "infamy" | "madness",
): number {
  const environment = riskyEnvironment(s);
  return environment?.code === (kind === "infamy" ? "02006a" : "02006b")
    ? environment.counters
    : 0;
}
/** A dash is not a modifiable printed power. Ongoing boost icons are handled
 * by the native activation; the Norman mid-attack exception is RRG p59. */
export function riskyBlankPower(
  s: GameState,
  kind: "attack" | "scheme",
  enemyId: string,
): boolean {
  return (
    enemyId === s.villain.id &&
    (kind === "attack"
      ? riskyVillainForm(s) === "norman"
      : riskyVillainForm(s) === "goblin")
  );
}
export function riskySetup(): Effect[] {
  return [rb("setup")];
}

export function riskyVillainRevealed(s: GameState): Effect[] {
  if (riskyVillainForm(s) !== "goblin") return [];
  return [
    rb("reveal-each", {
      remaining: playerOrder(s)
        .filter(
          (seat) =>
            s.villain.stage !== 1 || seatView(s, seat).player.form === "hero",
        )
        .map((seat) => seat.id),
      stage: s.villain.stage,
      actorId: s.firstPlayerId,
    }),
  ];
}

/** Run after status priority, before attack/scheme initiation, drawing boosts or
 * attack-trigger responses. A null result means no replacement applies. */
export function riskyActivationReplacement(
  s: GameState,
  kind: "attack" | "scheme",
  enemyId: string,
): Effect[] | null {
  if (!riskyBlankPower(s, kind, enemyId)) return null;
  return kind === "attack"
    ? [rb("counters", { kind: "infamy", amount: s.villain.stage })]
    : [
        rb("counters", {
          kind: "madness",
          amount: -(s.villain.stage === 3 ? 2 : 1),
        }),
      ];
}

/** Replace the entire positive damage packet, including excess: it never
 * spills onto the Goblin face. Status/prevention priority occurs in the host. */
export function riskyDamageReplacement(
  s: GameState,
  target: string,
  amount: number,
): Effect[] | null {
  return target === s.villain.id &&
    amount > 0 &&
    riskyVillainForm(s) === "norman"
    ? [rb("counters", { kind: "infamy", amount: -amount })]
    : null;
}
/** In-place form flips are distinct from stage advancement. Next stage keeps
 * the previous side even though Norman/Goblin titles differ (insert p4). */
export function riskyNextVillainFace(
  s: GameState,
  nextCode: string,
): string | null {
  if (!isRiskyVillain(s.villain.code)) return null;
  need(isRiskyVillain(nextCode), "Unknown Risky Business villain stage.");
  return `${nextCode.slice(0, 5)}${s.villain.code.slice(-1)}`;
}
export function riskySchemeValues(s: GameState) {
  if (s.scheme.code === "02004b")
    return {
      baseThreat: 2 * s.playerCount,
      threshold: 7 * s.playerCount,
      escalation: s.playerCount,
    };
  if (s.scheme.code === "02005b")
    return {
      baseThreat: s.playerCount,
      threshold: 10 * s.playerCount,
      escalation: 2 * s.playerCount,
    };
  return null;
}
export function riskyMainCompleted(s: GameState): Effect[] | null {
  if (s.scheme.code === "02004b")
    return [rb("main-completed"), rb("advance-main")];
  if (s.scheme.code === "02005b") return [rb("loss")];
  return null;
}
/** Constant condition guard for non-module counter mutations. Host must avoid
 * queueing duplicate flips and resolve it before ordinary triggered effects. */
export function riskyEnvironmentEffects(s: GameState): Effect[] {
  const p = riskyEnvironment(s);
  return p &&
    p.counters <= 0 &&
    !s.queue.some((e) => e.type === "risky:flip" && e.id === p.id)
    ? [rb("flip", { id: p.id })]
    : [];
}
export function riskyEncounterReveal(
  s: GameState,
  piece: Piece,
): Effect[] | null {
  switch (piece.code) {
    case "02007":
      return [rb("hired-gun")];
    case "02008":
    case "02009":
    case "02011":
      return [];
    case "02010":
      return riskyVillainForm(s) === "norman"
        ? [E("threat", { target: piece.id, amount: s.playerCount })]
        : [];
    case "02012":
      return [rb("counter-fallback", { amount: 2 })];
    case "02013":
      return riskyVillainForm(s) === "goblin"
        ? [
            rb("mad-genius", {
              revealerId: s.activePlayerId,
              actorId: s.firstPlayerId,
            }),
          ]
        : riskyVillainForm(s) === "norman"
          ? [
              rb("discard-player", {
                playerId: s.activePlayerId,
                amount: riskyCounters(s, "infamy"),
              }),
            ]
          : [];
    default:
      return null;
  }
}
/** All five boost stars have identical counter fallback; others contain only
 * printed icons. Counter removal/flip occurs before power calculation. */
export function riskyBoost(_s: GameState, piece: Piece): Effect[] | null {
  if (["02007", "02008", "02009", "02011", "02012"].includes(piece.code))
    return [rb("counter-fallback", { amount: 1 })];
  return ["02010", "02013"].includes(piece.code) ? [] : null;
}

export function resolveRiskyEffect(
  s: GameState,
  e: Effect,
  ports: RiskyBusinessEnginePorts,
): boolean {
  if (!e.type.startsWith("risky:")) return false;
  switch (e.type) {
    case "risky:setup": {
      need(
        riskyVillainForm(s) === "norman",
        "Risky Business begins on the Norman Osborn face.",
      );
      need(
        !riskyEnvironment(s),
        "Risky Business environment is already in play.",
      );
      ports.putEnvironment(s, "02006a", 2 * s.playerCount);
      ports.shuffleEncounter(s);
      s.scheme = { code: "02004b", index: 0, threat: 2 * s.playerCount };
      break;
    }
    case "risky:counters": {
      const p = riskyEnvironment(s);
      const code = e.kind === "infamy" ? "02006a" : "02006b";
      if (!p || p.code !== code) break;
      p.counters = Math.max(0, p.counters + e.amount);
      if (!p.counters) ports.queue(s, rb("flip", { id: p.id }));
      break;
    }
    case "risky:counter-fallback":
      ports.queue(
        s,
        riskyEnvironment(s)?.code === "02006a"
          ? rb("counters", { kind: "infamy", amount: e.amount })
          : rb("counters", { kind: "madness", amount: -e.amount }),
      );
      break;
    case "risky:flip": {
      const p = riskyEnvironment(s);
      if (!p || p.id !== e.id || p.counters > 0) break;
      need(
        isRiskyVillain(s.villain.code),
        "Risky Business form flip requires its villain.",
      );
      const side = p.code === "02006a" ? "b" : "a";
      p.code = `02006${side}`;
      p.counters = 2 * s.playerCount;
      s.villain.code = `${s.villain.code.slice(0, 5)}${side}`;
      ports.queue(s, ...riskyVillainRevealed(s));
      break;
    }
    case "risky:reveal-each": {
      const remaining: string[] = e.remaining.filter((id: string) =>
        s.players.some((seat) => seat.id === id && !seat.eliminated),
      );
      if (!remaining.length) break;
      const next = (id: string) => [
        E(e.stage === 3 ? "damage" : "indirect", {
          target: "hero",
          amount: e.stage === 3 ? 4 : 3,
          source: "Green Goblin",
          actorId: id,
        }),
        rb("reveal-each", {
          remaining: remaining.filter((other) => other !== id),
          stage: e.stage,
          actorId: s.firstPlayerId,
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...next(remaining[0]));
      else
        ports.choose(
          s,
          "Green Goblin · reveal order",
          "The first player chooses which player resolves the reveal damage next.",
          remaining.map((id) => option(id, id, next(id))),
        );
      break;
    }
    case "risky:main-completed": {
      const p = riskyEnvironment(s);
      if (p?.code !== "02006a") break; // The preceding infamy effect cannot resolve, so neither can its then clause.
      p.counters += s.playerCount;
      ports.queue(
        s,
        rb("discard-each", {
          remaining: playerOrder(s).map((seat) => seat.id),
          amount: p.counters,
          actorId: s.firstPlayerId,
        }),
      );
      break;
    }
    case "risky:discard-each": {
      const remaining: string[] = e.remaining.filter((id: string) =>
        s.players.some((seat) => seat.id === id && !seat.eliminated),
      );
      if (!remaining.length) break;
      const next = (id: string) => [
        rb("discard-player", { playerId: id, amount: e.amount, actorId: id }),
        rb("discard-each", {
          remaining: remaining.filter((other) => other !== id),
          amount: e.amount,
          actorId: s.firstPlayerId,
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...next(remaining[0]));
      else
        ports.choose(
          s,
          "Hostile Takeover · discard order",
          "The first player chooses which player discards from their deck next.",
          remaining.map((id) => option(id, id, next(id))),
        );
      break;
    }
    case "risky:discard-player":
      ports.discardPlayerCards(s, e.playerId, e.amount);
      break;
    case "risky:advance-main":
      s.scheme = { code: "02005b", index: 1, threat: s.playerCount };
      break;
    case "risky:loss":
      s.phase = "lost";
      s.result = "Oscorp acquires Stark technology. The heroes lose.";
      break;
    case "risky:hired-gun": {
      const choices = [
        option("boost", "Give the villain one facedown boost card", [
          rb("give-boost"),
        ]),
      ];
      if (riskyEnvironment(s)?.code === "02006a")
        choices.push(
          option("infamy", "Place two infamy counters", [
            rb("counters", { kind: "infamy", amount: 2 }),
          ]),
        );
      if (choices.length === 1) ports.queue(s, ...choices[0].effects);
      else
        ports.choose(
          s,
          "Hired Gun",
          "Choose the cost of Norman's hired muscle.",
          choices,
        );
      break;
    }
    case "risky:give-boost":
      ports.giveBoost(s, s.villain.id, "next");
      break;
    case "risky:mad-genius": {
      const heroes = playerOrder(s).filter(
        (seat) => seatView(s, seat).player.form === "hero",
      );
      const lowest = Math.min(
        ...heroes.map((seat) => seatView(s, seat).player.hp),
      );
      const tied = heroes.filter(
        (seat) => seatView(s, seat).player.hp === lowest,
      );
      const action = (playerId: string) => [
        rb("mad-genius-attack", { playerId, revealerId: e.revealerId }),
      ];
      if (!tied.length)
        ports.queue(
          s,
          E("surge", { sourceCode: "02013", actorId: e.revealerId }),
        );
      else if (tied.length === 1) ports.queue(s, ...action(tied[0].id));
      else
        ports.choose(
          s,
          "Mad Genius · target",
          "The first player chooses a hero tied for the fewest remaining hit points.",
          tied.map((seat) => option(seat.id, seat.id, action(seat.id))),
        );
      break;
    }
    case "risky:mad-genius-attack": {
      const target = s.players.find(
        (seat) => seat.id === e.playerId && !seat.eliminated,
      );
      need(
        target && seatView(s, target).player.form === "hero",
        "Mad Genius needs an eligible hero target.",
      );
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: rb("mad-genius-after", {
          actorId: e.revealerId,
          revealerId: e.revealerId,
        }),
      });
      break;
    }
    case "risky:mad-genius-after":
      if (!e.performed)
        ports.queue(
          s,
          E("surge", { sourceCode: "02013", actorId: e.revealerId }),
        );
      break;
    default:
      throw Error(`Unknown Risky Business effect: ${e.type}`);
  }
  return true;
}
