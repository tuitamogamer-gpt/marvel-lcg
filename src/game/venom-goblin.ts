import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: Venom Goblin, with Goblin Gear. Three main schemes are
 * in play at once; the one with the glider counter is native `s.scheme`
 * outside focus windows. */
export const VENOM_GOBLIN_SCENARIO_CODES = [
  "27113",
  "27114",
  "27115",
  "27116a",
  "27116b",
  "27117a",
  "27117b",
  "27118a",
  "27118b",
  "27119a",
  "27119b",
  "27120",
  "27121",
  "27122",
  "27123",
  "27124",
  "27125",
  "27126",
] as const;
export const GOBLIN_GEAR_CODES = [
  "27136",
  "27137",
  "27138",
  "27139",
  "27140",
  "27141",
] as const;
export const VENOM_GOBLIN_SCRIPT_CODES = [
  ...VENOM_GOBLIN_SCENARIO_CODES,
  ...GOBLIN_GEAR_CODES,
] as const;
export const VENOM_GOBLIN_MODULAR_SETS = ["goblin_gear"] as const;

export type GliderKey = "lower" | "midtown" | "upper";
export const GLIDER_KEYS: GliderKey[] = ["lower", "midtown", "upper"];
/** Each Manhattan main scheme and its environment side. */
export const MANHATTAN: Record<GliderKey, string> = {
  lower: "27117a",
  midtown: "27118a",
  upper: "27119a",
};
export const MANHATTAN_FLIPPED: Record<GliderKey, string> = {
  lower: "27117b",
  midtown: "27118b",
  upper: "27119b",
};
export const SKIES = "27116a";
export const SKIES_RULES = "27116b";
/** The target ID of a main scheme out of focus. */
export const vgTarget = (key: GliderKey) => `vgob:${key}`;
export function vgTargetKey(target: unknown): GliderKey | undefined {
  if (typeof target !== "string" || !target.startsWith("vgob:"))
    return undefined;
  const key = target.slice(5) as GliderKey;
  return GLIDER_KEYS.includes(key) ? key : undefined;
}

const VG_I = "27113";
const VG_II = "27114";
const VG_III = "27115";
const WE_ARE_ONE = "27120";
const BERSERKER = "27121";
const MONSTROSITY = "27122";
const THRALL = "27123";
const FESTERING = "27124";
const JOY_RIDE = "27125";
const PANIC = "27126";
const ADVANCED_GLIDER = "27136";
const CONCUSSIVE = "27137";
const INCENDIARY = "27138";
const SMOKE = "27139";
const LIMITLESS = "27140";
const REMOTE = "27141";
const BOMBS = [CONCUSSIVE, INCENDIARY, SMOKE];

interface StoredScheme {
  code: string;
  threat: number;
  index: number;
  /** Acceleration tokens on this main scheme. */
  acceleration: number;
}
export interface VenomGoblinState {
  /** The main schemes out of focus, by key. */
  bench: Partial<Record<GliderKey, StoredScheme>>;
  /** The scheme that is native `s.scheme`. */
  focus: GliderKey;
  /** The scheme with the glider counter. */
  glider: GliderKey;
  /** Completed main schemes, flipped to their environment side. */
  flipped: GliderKey[];
  /** Open focus windows. */
  windows?: number;
}

export interface VenomGoblinPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  makePiece(s: GameState, code: string): Piece;
  reveal(s: GameState, p: Piece, playerId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  millPlayer(s: GameState, playerId: string, count: number): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  lose(s: GameState, reason: string): void;
  /** Cards a player controls in play. */
  controlled(s: GameState, playerId: string): Piece[];
  exhaust(s: GameState, id: string): void;
  cost(p: Piece): number;
  /** Spend one resource of each type, then resolve `after`. */
  payResources(
    s: GameState,
    title: string,
    resources: ("energy" | "mental" | "physical")[],
    after: Effect[],
  ): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `vgob:${type}`,
  ...args,
});
const scripted = new Set<string>(VENOM_GOBLIN_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const hasTrait = (p: Piece, trait: string) =>
  (def(p)?.traits || "").split(/\.\s*/).includes(trait);

// ---------------------------------------------------------------- schemes

/** The threat view of one main scheme, wherever the focus is. */
export function vgScheme(
  s: GameState,
  key: GliderKey,
): (StoredScheme & { key: GliderKey }) | undefined {
  const st = s.venomGoblin;
  if (!st || st.flipped.includes(key)) return undefined;
  if (st.focus === key)
    return {
      key,
      code: s.scheme.code,
      threat: s.scheme.threat,
      index: s.scheme.index,
      acceleration: s.encounter.acceleration,
    };
  const stored = st.bench[key];
  return stored && { key, ...stored };
}
/** The main schemes still in play, Lower to Upper Manhattan. */
export function vgSchemes(s: GameState) {
  return GLIDER_KEYS.map((key) => vgScheme(s, key)).filter(
    (x): x is StoredScheme & { key: GliderKey } => !!x,
  );
}
/** The threshold of a Manhattan main scheme. */
export function vgSchemeLimit(s: GameState, key: GliderKey) {
  const c = def(MANHATTAN[key]);
  return (c?.threat || 0) * (c?.threat_fixed ? 1 : s.playerCount);
}
function escalationOf(s: GameState, key: GliderKey) {
  const c = def(MANHATTAN[key]);
  return (
    (c?.escalation_threat || 0) *
    (c?.escalation_threat_fixed ? 1 : s.playerCount)
  );
}

/** Swap so that `key`'s main scheme is native `s.scheme`. */
export function vgFocus(s: GameState, key: GliderKey) {
  const st = s.venomGoblin;
  if (!st || st.focus === key) return;
  const next = st.bench[key];
  if (!next) return;
  if (!st.flipped.includes(st.focus))
    st.bench[st.focus] = {
      code: s.scheme.code,
      threat: s.scheme.threat,
      index: s.scheme.index,
      acceleration: s.encounter.acceleration,
    };
  delete st.bench[key];
  s.scheme = { code: next.code, threat: next.threat, index: next.index };
  s.encounter.acceleration = next.acceleration;
  st.focus = key;
}
/** Run synchronous engine code with `key`'s main scheme in focus. */
export function withVgFocus<R>(s: GameState, key: GliderKey, fn: () => R): R {
  const st = s.venomGoblin;
  if (!st || st.focus === key || !st.bench[key]) return fn();
  const previous = st.focus;
  st.windows = (st.windows || 0) + 1;
  vgFocus(s, key);
  try {
    return fn();
  } finally {
    st.windows = Math.max(0, (st.windows || 0) - 1);
    if (st.bench[previous]) vgFocus(s, previous);
    else if (!st.windows && st.bench[st.glider]) vgFocus(s, st.glider);
  }
}
/** Outside any window the glider's main scheme is in focus. */
export function vgFocusGlider(s: GameState) {
  const st = s.venomGoblin;
  if (!st || st.windows) return;
  vgFocus(s, st.glider);
}

/** The main schemes out of focus are legal threat targets too. */
export function vgSchemeTargets(s: GameState, thwarting: boolean) {
  const st = s.venomGoblin;
  if (!st) return [];
  return GLIDER_KEYS.filter((key) => key !== st.focus && st.bench[key])
    .filter((key) => !thwarting || st.bench[key]!.threat > 0)
    .map((key) => ({
      id: vgTarget(key),
      label: name(MANHATTAN[key]),
      code: MANHATTAN[key],
    }));
}
export function vgTargetThreat(s: GameState, target: string): number {
  const key = vgTargetKey(target);
  return key ? vgScheme(s, key)?.threat || 0 : 0;
}
/** The stored threat of a main scheme out of focus, for code that moves or
 * splits threat directly. */
export function vgBenchScheme(
  s: GameState,
  target: string,
): { code: string; threat: number } | undefined {
  const key = vgTargetKey(target);
  const st = s.venomGoblin;
  return key && st && st.focus !== key ? st.bench[key] : undefined;
}

/** Symbiote environments in play: completed main schemes, and Festering
 * Mass while there is no other. */
export function symbioteEnvironments(s: GameState): number {
  const envs = (s.environments || []).filter(
    (p) => hasTrait(p, "Symbiote") && def(p)?.type_code === "environment",
  ).length;
  if (envs) return envs;
  return s.sideSchemes.some((p) => p.code === FESTERING && active(s, p))
    ? 1
    : 0;
}

function leastThreat(s: GameState): GliderKey[] {
  const schemes = vgSchemes(s);
  if (!schemes.length) return [];
  const min = Math.min(...schemes.map((x) => x.threat));
  return schemes.filter((x) => x.threat === min).map((x) => x.key);
}
function mostThreat(s: GameState): GliderKey[] {
  const schemes = vgSchemes(s);
  if (!schemes.length) return [];
  const max = Math.max(...schemes.map((x) => x.threat));
  return schemes.filter((x) => x.threat === max).map((x) => x.key);
}
/** Move the glider counter to one of `keys`, the players choosing a tie,
 * then resolve `then` with the chosen key. */
function moveGlider(
  s: GameState,
  keys: GliderKey[],
  then: (key: GliderKey) => Effect[],
  ports: VenomGoblinPorts,
  title: string,
) {
  if (!keys.length) return;
  if (keys.length === 1) {
    ports.queue(s, G("glider", { key: keys[0] }), ...then(keys[0]));
    return;
  }
  ports.choose(
    s,
    title,
    "The main schemes are tied. Choose where the glider counter goes.",
    keys.map((key) => ({
      id: key,
      label: name(MANHATTAN[key]),
      image: MANHATTAN[key],
      effects: [G("glider", { key }), ...then(key)],
    })),
  );
}

/** A main scheme's "Special" ability. It always resolves for the main
 * scheme with the glider counter, which is in focus. */
function special(s: GameState, key: GliderKey, playerId: string): Effect[] {
  const symbiote = symbioteEnvironments(s) > 0;
  switch (key) {
    case "lower":
      return [
        { type: "threat", target: "main", amount: symbiote ? 2 : 1 },
        ...s.sideSchemes.map((q) => ({
          type: "threat",
          target: q.id,
          amount: 1,
        })),
      ];
    case "midtown":
      return [G("indirect", { playerId, amount: symbiote ? 3 : 2 })];
    case "upper":
      return [G("upper", { playerId, mill: symbiote })];
  }
}

// ---------------------------------------------------------------- setup

/** Skies Over New York (setup): the three Manhattan main schemes, the glider
 * counter on Midtown Manhattan. */
export function venomGoblinSetup(s: GameState) {
  const base = (key: GliderKey) => {
    const c = def(MANHATTAN[key]);
    return (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
  };
  s.scheme = { code: MANHATTAN.midtown, threat: base("midtown"), index: 0 };
  s.venomGoblin = {
    bench: {
      lower: {
        code: MANHATTAN.lower,
        threat: base("lower"),
        index: 0,
        acceleration: 0,
      },
      upper: {
        code: MANHATTAN.upper,
        threat: base("upper"),
        index: 0,
        acceleration: 0,
      },
    },
    focus: "midtown",
    glider: "midtown",
    flipped: [],
  };
}

/** Each main scheme out of focus accumulates its own threat. */
export function venomGoblinStepOne(s: GameState): Effect[] {
  const st = s.venomGoblin;
  if (!st) return [];
  return GLIDER_KEYS.filter((key) => st.bench[key]).map((key) => ({
    type: "threat",
    target: vgTarget(key),
    amount: escalationOf(s, key) + (st.bench[key]!.acceleration || 0),
  }));
}

/** A Manhattan main scheme is completed: it flips to its environment side.
 * Returns the effects of its When Revealed ability. */
export function venomGoblinMainCompleted(
  s: GameState,
  ports: VenomGoblinPorts,
): void {
  const st = s.venomGoblin;
  if (!st || st.flipped.includes(st.focus)) return;
  const key = st.focus;
  const tokens = s.encounter.acceleration;
  const hadGlider = st.glider === key;
  st.flipped.push(key);
  const env = ports.makePiece(s, MANHATTAN_FLIPPED[key]);
  (s.environments ||= []).push(env);
  ports.log(
    s,
    `${name(MANHATTAN[key])} is completed and flips: the symbiote spreads.`,
    "bad",
  );
  if (symbioteEnvironments(s) >= 2) {
    ports.lose(
      s,
      "Two Manhattan districts are infested. Venom Goblin claims the city.",
    );
    return;
  }
  // Focus a scheme still in play before anything else resolves.
  const remaining = GLIDER_KEYS.filter((k) => st.bench[k]);
  if (!remaining.length) {
    ports.lose(s, "Every Manhattan district is infested.");
    return;
  }
  const first = remaining[0];
  const next = st.bench[first]!;
  delete st.bench[first];
  s.scheme = { code: next.code, threat: next.threat, index: next.index };
  s.encounter.acceleration = next.acceleration;
  st.focus = first;
  // When Revealed: the glider counter and the acceleration tokens move from
  // here to the main scheme with the least threat.
  ports.queue(s, G("flip-move", { tokens, glider: hadGlider, from: key }));
}

// ---------------------------------------------------------------- villain

/** Venom Goblin's star Forced Response after he activates against you. */
export function venomGoblinActivated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (!s.venomGoblin || !s.villain || enemyId !== s.villain.id) return [];
  if (!active(s, s.villain) || over(s)) return [];
  if (![VG_I, VG_II, VG_III].includes(s.villain.code)) return [];
  return [G("infest", { playerId, stage: s.villain.code })];
}

/** Venom Goblin (II) and (III) When Revealed. */
export function venomGoblinVillainRevealed(
  s: GameState,
  code: string,
): Effect[] {
  if (!s.venomGoblin) return [];
  const count = code === VG_II ? 2 : code === VG_III ? 3 : 0;
  return count ? [G("deal", { count })] : [];
}

// -------------------------------------------------------------- constants

/** Symbiotic Monstrosity gets +3 hit points with a Symbiote environment. */
export function venomGoblinHealth(s: GameState, p: Piece): number {
  return p.code === MONSTROSITY && active(s, p) && symbioteEnvironments(s)
    ? 3
    : 0;
}
/** Keywords Venom Goblin's minions gain with a Symbiote environment. */
export function venomGoblinKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): boolean {
  if (!symbioteEnvironments(s) || !active(s, p)) return false;
  return (
    (keyword === "Quickstrike" && p.code === BERSERKER) ||
    (keyword === "Patrol" && p.code === THRALL)
  );
}
/** Symbiotic Monstrosity's boost: this attack deals indirect damage. */
export function venomGoblinIndirectAttack(s: GameState, attackerId: string) {
  return !!s.attack?.vgobIndirect && s.attack.attacker === attackerId;
}
/** Limitless Supply: each Tech attachment gains surge. */
export function venomGoblinGainsSurge(s: GameState, p: Piece): boolean {
  return (
    def(p)?.type_code === "attachment" &&
    hasTrait(p, "Tech") &&
    s.sideSchemes.some((q) => q.code === LIMITLESS && active(s, q))
  );
}

// -------------------------------------------------------------- responses

/** Advanced Glider's and the bombs' Forced Responses after the villain
 * attacks or activates against you. */
export function goblinGearEffects(
  s: GameState,
  r: { attackerId: string; playerId: string; attack: boolean },
): Effect[] {
  if (!s.villain || r.attackerId !== s.villain.id || over(s)) return [];
  const out: Effect[] = [];
  for (const a of s.attachments.filter(
    (q) => q.attachedTo === s.villain.id && active(s, q),
  )) {
    if (r.attack && BOMBS.includes(a.code) && (a.counters || 0) > 0)
      out.push(G("bomb", { id: a.id, playerId: r.playerId }));
    if (a.code === ADVANCED_GLIDER)
      out.push(
        G("again", {
          id: a.id,
          playerId: r.playerId,
          key: `vgGlider:${s.round}:${r.playerId}`,
        }),
      );
  }
  return out;
}

// ---------------------------------------------------------------- actions

/** The [[attack]] cards in a hand: events and other cards with the Attack
 * trait. */
function attackCards(s: GameState, playerId: string) {
  return seatView(s, playerId).player.hand.filter((q) => hasTrait(q, "Attack"));
}
export function venomGoblinActions(s: GameState, p: Piece): Option[] {
  if (!known(p) || !active(s, p) || s.player.form !== "hero") return [];
  if (!s.attachments.some((q) => q.id === p.id)) return [];
  if (p.code === WE_ARE_ONE)
    return [
      {
        id: "discard",
        label: `Spend energy, mental, physical · discard ${name(p)}`,
        image: p.code,
        effects: [G("we-are-one", { id: p.id })],
      },
    ];
  if (p.code === ADVANCED_GLIDER) {
    const total = attackCards(s, s.activePlayerId).reduce(
      (n, q) => n + Number(def(q)?.cost || 0),
      0,
    );
    return total >= 3
      ? [
          {
            id: "discard",
            label: `Discard attack cards costing 3 or more · discard ${name(p)}`,
            image: p.code,
            effects: [
              G("glider-discard", { id: p.id, playerId: s.activePlayerId }),
            ],
          },
        ]
      : [];
  }
  return [];
}

// ----------------------------------------------------------------- reveal

export function venomGoblinReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if ([WE_ARE_ONE, ADVANCED_GLIDER, ...BOMBS].includes(p.code))
    return [G("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case JOY_RIDE:
      return [G("joy-ride", { playerId })];
    case PANIC:
      return [G("panic", { playerId })];
    case REMOTE:
      return [G("remote", { playerId })];
    default:
      return [];
  }
}

export function venomGoblinBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case BERSERKER:
      return [G("berserker-boost")];
    case MONSTROSITY:
      return s.attack ? [G("monstrosity-boost")] : [];
    case THRALL:
      return [G("thrall-boost")];
    case FESTERING:
      return [G("reveal-boost", { id: p.id, playerId })];
    case PANIC:
      return [G("panic", { playerId })];
    case REMOTE:
      // "Give the villain 2 additional boost cards for this activation."
      return s.villain &&
        (s.attack?.attacker === s.villain.id ||
          s.scheming?.attacker === s.villain.id)
        ? [G("extra-boost", { count: 2 })]
        : [];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

export function resolveVenomGoblinEffect(
  s: GameState,
  e: Effect,
  ports: VenomGoblinPorts,
): boolean {
  if (!e.type.startsWith("vgob:")) return false;
  const st = s.venomGoblin;
  switch (e.type) {
    case "vgob:glider": {
      if (!st || st.flipped.includes(e.key)) break;
      st.glider = e.key;
      vgFocusGlider(s);
      ports.log(
        s,
        `The glider counter moves to ${name(MANHATTAN[e.key as GliderKey])}.`,
        "bad",
      );
      break;
    }
    case "vgob:flip-move": {
      if (!st) break;
      const keys = leastThreat(s);
      if (!keys.length) break;
      const apply = (key: GliderKey): Effect[] => [
        G("tokens", { key, amount: e.tokens }),
        ...(e.glider ? [G("glider", { key })] : []),
      ];
      if (keys.length === 1) ports.queue(s, ...apply(keys[0]));
      else
        ports.choose(
          s,
          name(MANHATTAN_FLIPPED[e.from as GliderKey]),
          "The main schemes are tied. Choose where the glider counter and the acceleration tokens go.",
          keys.map((key) => ({
            id: key,
            label: name(MANHATTAN[key]),
            image: MANHATTAN[key],
            effects: apply(key),
          })),
        );
      break;
    }
    case "vgob:tokens": {
      if (!st || !e.amount) break;
      const key = e.key as GliderKey;
      if (st.focus === key) s.encounter.acceleration += e.amount;
      else if (st.bench[key]) st.bench[key]!.acceleration += e.amount;
      break;
    }
    case "vgob:infest": {
      if (!st || !alive(s, e.playerId)) break;
      moveGlider(
        s,
        leastThreat(s),
        (key) =>
          e.stage === VG_I
            ? [G("infest-choice", { key, playerId: e.playerId })]
            : e.stage === VG_III
              ? [
                  { type: "threat", target: "main", amount: 1 },
                  G("special", { key, playerId: e.playerId }),
                ]
              : [G("special", { key, playerId: e.playerId })],
        ports,
        name(e.stage),
      );
      break;
    }
    case "vgob:infest-choice":
      ports.choose(s, name(VG_I), "Infest the City: choose one.", [
        {
          id: "threat",
          label: `Place 2 threat on ${name(MANHATTAN[e.key as GliderKey])}`,
          effects: [{ type: "threat", target: "main", amount: 2 }],
        },
        {
          id: "special",
          label: `Resolve ${name(MANHATTAN[e.key as GliderKey])}'s Special`,
          effects: [G("special", { key: e.key, playerId: e.playerId })],
        },
      ]);
      break;
    case "vgob:special": {
      if (!st || st.flipped.includes(e.key)) break;
      ports.queue(s, ...special(s, e.key, e.playerId));
      break;
    }
    case "vgob:indirect":
      if (alive(s, e.playerId))
        ports.indirect(
          s,
          e.playerId,
          e.amount,
          MANHATTAN.midtown,
          name(MANHATTAN.midtown),
        );
      break;
    case "vgob:upper": {
      if (!alive(s, e.playerId)) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (e.mill) ports.millPlayer(s, e.playerId, 4);
      if (hand.length)
        ports.choose(
          s,
          name(MANHATTAN.upper),
          "Choose and discard 1 card from your hand.",
          hand.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [G("hand-discard", { playerId: e.playerId, id: q.id })],
          })),
        );
      break;
    }
    case "vgob:hand-discard":
      if (seatView(s, e.playerId).player.hand.some((q) => q.id === e.id))
        ports.discardHandCard(s, e.playerId, e.id);
      break;
    case "vgob:deal":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        for (let i = 0; i < e.count; i++) ports.dealEncounter(s, seat.id);
      break;
    case "vgob:joy-ride":
      moveGlider(
        s,
        mostThreat(s),
        (key) => [G("special", { key, playerId: e.playerId })],
        ports,
        name(JOY_RIDE),
      );
      break;
    case "vgob:panic":
      if (st)
        ports.queue(s, G("special", { key: st.glider, playerId: e.playerId }));
      break;
    case "vgob:berserker-boost":
      moveGlider(
        s,
        mostThreat(s),
        () => [{ type: "threat", target: "main", amount: 1 }],
        ports,
        name(BERSERKER),
      );
      break;
    case "vgob:thrall-boost":
      if (st)
        for (const key of GLIDER_KEYS.filter(
          (k) => k !== st.glider && vgScheme(s, k),
        ))
          ports.queue(s, {
            type: "threat",
            target: key === st.focus ? "main" : vgTarget(key),
            amount: 1,
          });
      break;
    case "vgob:monstrosity-boost":
      if (s.attack) s.attack.vgobIndirect = true;
      break;
    case "vgob:reveal-boost": {
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "vgob:extra-boost":
      if (s.villain)
        for (let i = 0; i < e.count; i++)
          ports.giveBoost(s, s.villain.id, "current");
      break;
    case "vgob:attach": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      if (BOMBS.includes(p.code)) p.counters = 2;
      break;
    }
    case "vgob:we-are-one":
      if (!s.attachments.some((q) => q.id === e.id)) break;
      ports.payResources(
        s,
        name(WE_ARE_ONE),
        ["energy", "mental", "physical"],
        [{ type: "discardPiece", id: e.id }],
      );
      break;
    case "vgob:glider-discard": {
      if (!s.attachments.some((q) => q.id === e.id)) break;
      // Discard the fewest attack cards that reach a combined cost of 3.
      const sorted = attackCards(s, e.playerId).sort(
        (a, b) => ports.cost(b) - ports.cost(a),
      );
      let total = 0;
      const chosen: Piece[] = [];
      for (const q of sorted) {
        if (total >= 3) break;
        total += ports.cost(q);
        chosen.push(q);
      }
      if (total < 3) break;
      for (const q of chosen) ports.discardHandCard(s, e.playerId, q.id);
      ports.discardPiece(s, e.id);
      break;
    }
    case "vgob:again": {
      // Limit once per round per player.
      if (!alive(s, e.playerId) || !s.villain || s.flags[e.key]) break;
      if (!s.attachments.some((q) => q.id === e.id && active(s, q))) break;
      s.flags[e.key] = true;
      const view = seatView(s, e.playerId);
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: view.player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "vgob:bomb": {
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !(a.counters || 0) || !alive(s, e.playerId)) break;
      a.counters = (a.counters || 0) - 1;
      if (a.code === INCENDIARY)
        ports.indirect(s, e.playerId, 2, a.id, name(a));
      if (a.code === SMOKE) {
        const events = seatView(s, e.playerId).player.hand.filter(
          (q) => def(q)?.type_code === "event",
        );
        if (events.length) {
          const min = Math.min(...events.map((q) => ports.cost(q)));
          const lowest = events.filter((q) => ports.cost(q) === min);
          ports.choose(
            s,
            name(SMOKE),
            "Discard the event with the lowest cost from your hand.",
            lowest.map((q) => ({
              id: q.id,
              label: name(q),
              image: q.code,
              effects: [G("hand-discard", { playerId: e.playerId, id: q.id })],
            })),
          );
        }
      }
      if (a.code === CONCUSSIVE)
        ports.queue(
          s,
          G("exhaust-choice", { playerId: e.playerId, cardType: "upgrade" }),
          G("exhaust-choice", { playerId: e.playerId, cardType: "support" }),
        );
      if (!a.counters) ports.discardPiece(s, a.id);
      break;
    }
    case "vgob:exhaust":
      ports.exhaust(s, e.id);
      break;
    case "vgob:exhaust-choice": {
      // Concussive Bombs: exhaust 1 upgrade and 1 support you control.
      if (!alive(s, e.playerId)) break;
      const ready = ports
        .controlled(s, e.playerId)
        .filter((q) => def(q)?.type_code === e.cardType && !q.exhausted);
      if (ready.length)
        ports.choose(
          s,
          name(CONCUSSIVE),
          `Exhaust 1 ${e.cardType} you control.`,
          ready.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [G("exhaust", { id: q.id })],
          })),
        );
      break;
    }
    case "vgob:remote": {
      if (!alive(s, e.playerId) || !s.villain) break;
      if (s.attachments.some((q) => q.code === ADVANCED_GLIDER)) {
        const view = seatView(s, e.playerId);
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: view.player.form === "hero" ? "attack" : "scheme",
          modifier: 0,
        });
        break;
      }
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((q) => q.code === ADVANCED_GLIDER);
        if (i < 0) continue;
        const [glider] = zone.splice(i, 1);
        if (zone === s.encounter.deck) ports.shuffleEncounter(s);
        ports.reveal(s, glider, e.playerId);
        break;
      }
      break;
    }
    default:
      return false;
  }
  return true;
}

export type { Option };
