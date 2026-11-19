import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: The Sinister Six, with its required Guerrilla Tactics
 * set. Several villains are in play at once; the one with the active
 * counter is "the villain". */
export const SINISTER_SIX_SCENARIO_CODES = [
  "27094",
  "27095",
  "27096",
  "27097",
  "27098",
  "27099",
  "27100a",
  "27100b",
  "27101a",
  "27101b",
  "27102a",
  "27102b",
  "27103",
  "27104",
  "27105",
  "27106",
  "27107",
  "27108",
  "27109",
  "27110",
  "27111",
  "27112",
] as const;
export const GUERRILLA_TACTICS_CODES = [
  "27142",
  "27143",
  "27144",
  "27145",
  "27146",
] as const;
export const SINISTER_SIX_SCRIPT_CODES = [
  ...SINISTER_SIX_SCENARIO_CODES,
  ...GUERRILLA_TACTICS_CODES,
] as const;
export const SINISTER_SIX_MODULAR_SETS = ["guerrilla_tactics"] as const;
/** The six villains by activation order. */
export const SIX = ["27094", "27095", "27096", "27097", "27098", "27099"];
export const SYNCHRONIZATION = "27100b";
export const BEATDOWN = "27101b";
export const LIGHT_TRAP = "27102a";
export const LIGHT_CHASE = "27102b";
const MORALE = "27103";
const TAUNTING = "27104";
const LEADER = "27105";
const TAKE_ONE = "27106";
const BARRICADE = "27107";
const FLYERS = "27108";
const FASHION = "27109";
const ROBOTIC = "27110";
const PARTNERSHIP = "27111";
const SURPRISE = "27112";
const DECOY = "27142";
const COORDINATED = "27143";
const HIDDEN = "27144";
const TEAMWORK = "27145";
const DIRECTION = "27146";

type Villain = GameState["villain"];

export interface SinisterSixState {
  /** Villains in play out of focus, by code. */
  bench: Record<string, Villain>;
  /** The code of the villain that is native `s.villain`. */
  focus: string;
  /** The code of the villain with the active counter. */
  active?: string;
  /** Villain cards set aside, by code. */
  setAside: string[];
  /** No villain is in play: `s.villain` is the last one, out of play. */
  absent?: boolean;
  /** Open focus windows. */
  windows?: number;
}

export interface SinisterSixPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** A fresh villain piece with its printed hit points. */
  makeVillain(s: GameState, code: string): Villain;
  /** A seeded random index below n. */
  pick(s: GameState, n: number): number;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  randomDiscard(s: GameState, playerId: string): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  /** Discard the top cards of a player's deck. */
  millPlayer(s: GameState, playerId: string, count: number): void;
  /** Cards a player controls in play, with their costs. */
  controlled(s: GameState, playerId: string): Piece[];
  cost(p: Piece): number;
  allies(s: GameState, playerId: string): Piece[];
  win(s: GameState, reason: string): void;
  enemyStat(s: GameState, p: Piece, stat: "attack" | "scheme"): number;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const X = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `six:${type}`,
  ...args,
});
const scripted = new Set<string>(SINISTER_SIX_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
/** A villain's activation order value. */
export const order = (code: string) => SIX.indexOf(code) + 1;

// -------------------------------------------------------------- villains

/** The villains in play, wherever the focus is, by activation order. */
export function sixVillains(s: GameState): Villain[] {
  const st = s.sinisterSix;
  if (!st) return [];
  const list = [...(st.absent ? [] : [s.villain]), ...Object.values(st.bench)];
  return list.sort((a, b) => order(a.code) - order(b.code));
}
/** The villains in play out of focus. */
export function sixBench(s: GameState): Villain[] {
  return Object.values(s.sinisterSix?.bench || {});
}
export function sixBenchCode(s: GameState, id: string): string | undefined {
  const st = s.sinisterSix;
  if (!st) return undefined;
  return Object.keys(st.bench).find((code) => st.bench[code].id === id);
}
export function sixActiveVillain(s: GameState): Villain | undefined {
  const st = s.sinisterSix;
  if (!st?.active) return undefined;
  return st.focus === st.active && !st.absent ? s.villain : st.bench[st.active];
}
export function sixVillainAbsent(s: GameState): boolean {
  return !!s.sinisterSix?.absent;
}

/** Swap the bench so that `code` is native `s.villain`. */
export function sixFocus(s: GameState, code: string) {
  const st = s.sinisterSix;
  if (!st || st.focus === code) return;
  const next = st.bench[code];
  if (!next) return;
  if (!st.absent) st.bench[st.focus] = s.villain;
  delete st.bench[code];
  s.villain = next;
  st.focus = code;
  st.absent = false;
}
/** Run synchronous engine code with `code` in focus, then restore. */
export function withSixFocus<R>(s: GameState, code: string, fn: () => R): R {
  const st = s.sinisterSix;
  if (!st || st.focus === code || !st.bench[code]) return fn();
  const previous = st.focus;
  const wasAbsent = !!st.absent;
  st.windows = (st.windows || 0) + 1;
  sixFocus(s, code);
  try {
    return fn();
  } finally {
    st.windows = Math.max(0, (st.windows || 0) - 1);
    if (s.villain && st.focus === code && st.bench[previous]) {
      sixFocus(s, previous);
    } else if (wasAbsent && st.focus === code) {
      // Nothing to restore: the outer focus had no villain in play.
    }
  }
}
/** Open a focus window on `code`; returns the focus to restore. */
export function sixOpenWindow(s: GameState, code: string): string {
  const st = s.sinisterSix!;
  const previous = st.focus;
  st.windows = (st.windows || 0) + 1;
  sixFocus(s, code);
  return previous;
}
/** Close a window: back to the outer window's villain, or the active one. */
export function sixCloseWindow(s: GameState, previous: string) {
  const st = s.sinisterSix;
  if (!st) return;
  st.windows = Math.max(0, (st.windows || 0) - 1);
  const target =
    st.windows > 0 && st.bench[previous] ? previous : st.active || previous;
  if (st.bench[target]) sixFocus(s, target);
}
const focusFields = ["target", "targetId", "enemyId", "crewVillainId"];
const activationTypes = [
  "enemyAttack",
  "enemyScheme",
  "ghostNativeEnemyAttack",
  "ghostNativeEnemyScheme",
];
/** An effect that names a villain out of focus resolves inside a focus
 * window on that villain. */
export function sixWindowCode(s: GameState, e: Effect): string | undefined {
  const st = s.sinisterSix;
  if (!st || e.type.startsWith("six:")) return undefined;
  const fields = activationTypes.includes(e.type)
    ? [...focusFields, "id"]
    : focusFields;
  return Object.keys(st.bench).find((code) =>
    fields.some((field) => e[field] === st.bench[code].id),
  );
}

/** The active villain is in focus outside any window. */
export function sixFocusActive(s: GameState) {
  const st = s.sinisterSix;
  if (!st?.active || st.windows) return;
  sixFocus(s, st.active);
}

/** Put a set-aside villain into play. */
function enter(
  s: GameState,
  code: string,
  ports: SinisterSixPorts,
  makeActive: boolean,
) {
  const st = s.sinisterSix!;
  st.setAside = st.setAside.filter((c) => c !== code);
  const v = ports.makeVillain(s, code);
  if (st.absent) {
    s.villain = v;
    st.focus = code;
    st.absent = false;
  } else st.bench[code] = v;
  if (makeActive || !st.active) st.active = code;
  ports.log(s, `${name(code)} enters play.`, "bad");
}

/** Ambush!: a random set-aside villain enters play with the active counter.
 * Returns whether a villain entered play. */
function ambush(s: GameState, ports: SinisterSixPorts): boolean {
  const st = s.sinisterSix;
  if (!st || over(s)) return false;
  if (s.difficulty === "expert") {
    const light = s.sideSchemes.find((p) =>
      [LIGHT_TRAP, LIGHT_CHASE].includes(p.code),
    );
    if (light) ports.queue(s, { type: "threat", target: light.id, amount: 2 });
  }
  if (!st.setAside.length) return false;
  const code = st.setAside[ports.pick(s, st.setAside.length)];
  enter(s, code, ports, true);
  sixFocusActive(s);
  ports.log(s, `Ambush! ${name(code)} takes the active counter.`, "bad");
  return true;
}

/** Move the active counter to the next villain in the activation order. */
function advanceCounter(s: GameState, ports: SinisterSixPorts) {
  const st = s.sinisterSix;
  if (!st) return;
  const inPlay = sixVillains(s).map((v) => v.code);
  if (!inPlay.length) return;
  const current = order(st.active || "") || 0;
  const next = inPlay.find((code) => order(code) > current) || inPlay[0];
  st.active = next;
  ports.log(s, `The active counter moves to ${name(next)}.`, "bad");
}

// ---------------------------------------------------------------- setup

/** Sinister Synchronization (1A): 1 more villain than players at random. */
export function sinisterSixSetup(
  s: GameState,
  pick: (n: number) => number,
): { villains: string[]; setAside: string[] } {
  const pool = [...SIX];
  const villains: string[] = [];
  for (let i = 0; i < Math.min(6, s.playerCount + 1); i++)
    villains.push(pool.splice(pick(pool.length), 1)[0]);
  villains.sort((a, b) => order(a) - order(b));
  return { villains, setAside: pool };
}

/** Light at the End's threat: its base threat and hinder 10 per player. */
export function lightThreat(s: GameState, code: string) {
  return (def(code)?.base_threat || 0) + 10 * s.playerCount;
}

// ---------------------------------------------------------- constants

/** The villain's ATK and SCH modifiers from Sinister Six cards. */
export function sixEnemyModifier(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
): number {
  let n = 0;
  // Teamwork Makes the Dream Work: each enemy gets +1 SCH and +1 ATK.
  if (s.sideSchemes.some((q) => q.code === TEAMWORK && active(s, q))) n++;
  // Heightened Morale: +X ATK, X the villains in play. Its printed ATK
  // (-1, the catalog's X) is already counted by the attachment modifier.
  if (stat === "attack" && s.sinisterSix && SIX.includes(p.code))
    n +=
      s.attachments.filter(
        (a) => a.code === MORALE && a.attachedTo === p.id && active(s, a),
      ).length *
      (sixVillains(s).length + 1);
  return n;
}

/** Coordinated Effort and Hidden in Shadow: each enemy gains an icon. */
export function sixEnemyIcons(
  s: GameState,
  icon: "acceleration" | "hazard",
): number {
  const code = icon === "acceleration" ? COORDINATED : HIDDEN;
  if (!s.sideSchemes.some((q) => q.code === code && active(s, q))) return 0;
  return enemyCount(s);
}
/** The enemies in play: every villain and minion. */
export function enemyCount(s: GameState): number {
  const villains = s.sinisterSix ? sixVillains(s).length : 1;
  return villains + s.minions.length;
}

/** Take One for the Team: villains without a copy cannot be attacked. */
export function sixAttackForbidden(s: GameState, id: string): boolean {
  const taking = s.attachments.filter(
    (a) => a.code === TAKE_ONE && active(s, a),
  );
  if (!taking.length) return false;
  const villain = sixVillains(s).find((v) => v.id === id);
  return !!villain && !taking.some((a) => a.attachedTo === id);
}

/** Brute Force Barricade: threat cannot be removed from other side
 * schemes. Light at the End and Life-Size Decoy's engaged player. */
export function sixThwartLocked(
  s: GameState,
  target: string,
  playerId: string,
): boolean {
  if (target === "main") return false;
  const scheme = s.sideSchemes.find((p) => p.id === target);
  if (!scheme) return false;
  if (
    s.sideSchemes.some(
      (q) => q.code === BARRICADE && q.id !== target && active(s, q),
    )
  )
    return true;
  return s.minions.some(
    (m) => m.code === DECOY && m.engagedWith === playerId && active(s, m),
  );
}

// ------------------------------------------------------------ responses

/** A villain's printed Forced Response after it attacks and damages you:
 * its effect, then the active counter moves on. */
export function sixAttackResponses(
  s: GameState,
  r: { token: string; attackerId: string; playerId: string; damaged: boolean },
): { id: string; title: string; effects: Effect[] }[] {
  const st = s.sinisterSix;
  if (!st || !r.damaged || st.absent) return [];
  const villain = sixVillains(s).find((v) => v.id === r.attackerId);
  if (!villain || !active(s, villain)) return [];
  return [
    {
      id: `${r.token}:six`,
      title: name(villain),
      effects: [
        X("strike", { code: villain.code, playerId: r.playerId }),
        X("advance"),
      ],
    },
  ];
}

/** A Sinister Six villain is defeated: remove threat, set it aside. */
export function sixVillainDefeated(
  s: GameState,
  ports: SinisterSixPorts,
): Effect[] {
  const st = s.sinisterSix;
  if (!st || st.absent) return [];
  const v = s.villain;
  const others = sixVillains(s).filter((q) => q.id !== v.id).length;
  for (const a of s.attachments.filter((q) => q.attachedTo === v.id))
    ports.discardPiece(s, a.id);
  st.setAside.push(v.code);
  const wasActive = st.active === v.code;
  ports.log(s, `${name(v)} is defeated and set aside.`, "good");
  const nextCode = Object.keys(st.bench).sort((a, b) => order(a) - order(b))[0];
  if (nextCode) {
    s.villain = st.bench[nextCode];
    delete st.bench[nextCode];
    st.focus = nextCode;
  } else st.absent = true;
  if (wasActive) {
    st.active = undefined;
    const inPlay = sixVillains(s).map((q) => q.code);
    st.active = inPlay.find((code) => order(code) > order(v.code)) || inPlay[0];
  }
  return [X("defeat-threat", { amount: others ? 4 : 7 })];
}

/** Sinister Synchronization and Sinister Beatdown: when a villain would
 * activate with no villain in play, resolve Ambush! first. */
export function sixBeforeActivation(s: GameState, ports: SinisterSixPorts) {
  const st = s.sinisterSix;
  if (!st) return;
  if (st.absent) ambush(s, ports);
  sixFocusActive(s);
}

/** Light at the End: its last threat removed. Returns true when handled. */
export function sixLightCleared(
  s: GameState,
  p: Piece,
  ports: SinisterSixPorts,
): boolean {
  if (!s.sinisterSix || !active(s, p)) return false;
  if (p.code === LIGHT_TRAP) {
    p.code = LIGHT_CHASE;
    p.counters = lightThreat(s, LIGHT_CHASE);
    ports.log(
      s,
      "Light at the End flips: the Chase! begins. Clear it to escape.",
      "good",
    );
    ambush(s, ports);
    return true;
  }
  if (p.code === LIGHT_CHASE) {
    ports.win(s, "The players escape the Sinister Six.");
    return true;
  }
  return false;
}

/** Sinister Beatdown (2A) When Revealed. */
export function sixMainAdvanced(s: GameState): Effect[] {
  return s.scheme.code === BEATDOWN ? [X("beatdown")] : [];
}

// ----------------------------------------------------------- reveal

export function sixReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if ([MORALE, TAUNTING, LEADER, TAKE_ONE].includes(p.code))
    return [X("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  const expert = s.difficulty === "expert";
  // In expert mode the three pair treacheries gain incite 1, and Surprise!
  // and From Every Direction gain surge.
  const incite: Effect[] = expert
    ? [{ type: "threat", target: "main", amount: 1 }]
    : [];
  const surge: Effect[] = expert ? [{ type: "surge", sourceCode: p.code }] : [];
  switch (p.code) {
    case FLYERS:
      return [
        ...incite,
        X("pair", { codes: ["27096", "27099"], playerId, card: p.code }),
      ];
    case FASHION:
      return [
        ...incite,
        X("pair", { codes: ["27095", "27097"], playerId, card: p.code }),
      ];
    case ROBOTIC:
      return [
        ...incite,
        X("pair", { codes: ["27094", "27098"], playerId, card: p.code }),
      ];
    case PARTNERSHIP:
      return [X(hero ? "partner-attack" : "partner-scheme", { playerId })];
    case SURPRISE:
      return [X("surprise"), ...surge];
    case DIRECTION:
      return [X("direction"), ...surge];
    default:
      return [];
  }
}

/** Life-Size Decoy gains toughness in expert mode. */
export function sixMinionTough(s: GameState, p: Piece): boolean {
  return p.code === DECOY && s.difficulty === "expert" && active(s, p);
}

export function sixBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case BARRICADE:
      return [X("extra-boost")];
    case DECOY:
      return [X("decoy-boost", { id: p.id, playerId })];
    case COORDINATED:
      return [X("coordinated-boost")];
    case HIDDEN:
      return [X("hidden-boost")];
    case TEAMWORK:
      return s.difficulty === "expert" && (s.attack || s.scheming)
        ? [X("teamwork-boost")]
        : [];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

function attachTarget(s: GameState, code: string): Villain | undefined {
  const villains = sixVillains(s);
  if (!villains.length) return undefined;
  if (code === MORALE)
    return villains.reduce((a, b) => (order(b.code) > order(a.code) ? b : a));
  if (code === LEADER)
    return villains.reduce((a, b) => (order(b.code) < order(a.code) ? b : a));
  if (code === TAUNTING)
    return villains.reduce((a, b) => (b.hp > a.hp ? b : a));
  return undefined;
}

export function resolveSinisterSixEffect(
  s: GameState,
  e: Effect,
  ports: SinisterSixPorts,
): boolean {
  if (!e.type.startsWith("six:")) return false;
  const st = s.sinisterSix;
  switch (e.type) {
    case "six:ambush":
      ambush(s, ports);
      break;
    case "six:focus-back":
      sixCloseWindow(s, e.code);
      break;
    case "six:advance":
      advanceCounter(s, ports);
      break;
    case "six:strike": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      switch (e.code) {
        case "27094":
          ports.queue(s, { type: "threat", target: "main", amount: 1 });
          for (const q of s.sideSchemes)
            ports.queue(s, { type: "threat", target: q.id, amount: 1 });
          break;
        case "27095":
          ports.millPlayer(s, e.playerId, 7);
          break;
        case "27096":
          ports.indirect(s, e.playerId, 2, "27096", name("27096"));
          break;
        case "27097": {
          // Permanent cards cannot be discarded.
          const cards = ports
            .controlled(s, e.playerId)
            .filter((q) =>
              ["support", "upgrade"].includes(def(q)?.type_code || ""),
            );
          if (cards.length)
            ports.choose(
              s,
              name("27097"),
              "Choose and discard 1 support or upgrade you control.",
              cards.map((q) => ({
                id: q.id,
                label: name(q),
                image: q.code,
                effects: [{ type: "discardPiece", id: q.id }],
              })),
            );
          break;
        }
        case "27098":
          ports.queue(s, {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: e.playerId,
          });
          break;
        case "27099": {
          const hand = view.player.hand;
          if (hand.length)
            ports.choose(
              s,
              name("27099"),
              "Choose and discard 1 card from your hand.",
              hand.map((q) => ({
                id: q.id,
                label: name(q),
                image: q.code,
                effects: [
                  X("hand-discard", { playerId: e.playerId, id: q.id }),
                ],
              })),
            );
          break;
        }
      }
      break;
    }
    case "six:hand-discard":
      if (seatView(s, e.playerId).player.hand.some((q) => q.id === e.id))
        ports.discardHandCard(s, e.playerId, e.id);
      break;
    case "six:defeat-threat": {
      const schemes = s.sideSchemes.filter((q) => q.counters > 0);
      if (!schemes.length) break;
      ports.choose(
        s,
        "Villain defeated",
        `Remove ${e.amount} threat from a side scheme.`,
        schemes.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            {
              type: "thwart",
              target: q.id,
              amount: e.amount,
              source: "villain-defeat",
            },
          ],
        })),
      );
      break;
    }
    case "six:beatdown": {
      const entered = st?.setAside.length ? ambushNoThreat(s, ports) : false;
      if (!entered || s.difficulty === "expert")
        ports.dealEncounter(s, s.firstPlayerId);
      break;
    }
    case "six:attach": {
      const p = e.piece as Piece;
      let target = p.code === TAKE_ONE ? undefined : attachTarget(s, p.code);
      if (p.code === TAKE_ONE) {
        const villains = sixVillains(s);
        if (villains.length)
          target = villains.reduce((a, b) =>
            ports.enemyStat(s, b, "attack") > ports.enemyStat(s, a, "attack")
              ? b
              : a,
          );
      }
      if (!target) {
        ambush(s, ports);
        target = sixActiveVillain(s);
      }
      if (target) ports.attach(s, p, target.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "six:pair": {
      if (!st) break;
      for (const code of e.codes as string[]) {
        if (st.setAside.includes(code)) enter(s, code, ports, false);
        else if (alive(s, e.playerId)) {
          if (code === "27096")
            ports.indirect(s, e.playerId, 2, e.card, name(e.card));
          if (code === "27099") ports.randomDiscard(s, e.playerId);
          if (code === "27095" || code === "27097") {
            const cards = ports.controlled(s, e.playerId);
            if (cards.length) {
              const costs = cards.map((q) => ports.cost(q));
              const target =
                code === "27095" ? Math.max(...costs) : Math.min(...costs);
              const q = cards[costs.indexOf(target)];
              ports.discardPiece(s, q.id);
            }
          }
          if (code === "27094")
            ports.queue(s, {
              type: "status",
              target: "hero",
              status: "confused",
              actorId: e.playerId,
            });
          if (code === "27098")
            ports.queue(s, {
              type: "status",
              target: "hero",
              status: "stunned",
              actorId: e.playerId,
            });
        }
      }
      break;
    }
    case "six:partner-attack":
    case "six:partner-scheme": {
      const villains = sixVillains(s);
      if (!villains.length || !alive(s, e.playerId)) break;
      const attack = e.type === "six:partner-attack";
      const lead = attack ? villains[villains.length - 1] : villains[0];
      const bonus = villains
        .filter((v) => v.id !== lead.id)
        .reduce(
          (n, v) => n + ports.enemyStat(s, v, attack ? "attack" : "scheme"),
          0,
        );
      ports.activate(s, {
        enemyId: lead.id,
        playerId: e.playerId,
        kind: attack ? "attack" : "scheme",
        modifier: bonus,
      });
      break;
    }
    case "six:surprise": {
      const entered = ambush(s, ports);
      if (!entered) {
        const light = s.sideSchemes.find((p) =>
          [LIGHT_TRAP, LIGHT_CHASE].includes(p.code),
        );
        if (light)
          ports.queue(s, { type: "threat", target: light.id, amount: 3 });
      }
      break;
    }
    case "six:direction": {
      const n = enemyCount(s);
      if (n) ports.queue(s, { type: "threat", target: "main", amount: n });
      break;
    }
    case "six:extra-boost":
      if (s.villain) ports.giveBoost(s, s.villain.id, "current");
      break;
    case "six:decoy-boost": {
      const activation = s.attack || s.scheming;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      ports.putMinion(s, p, e.playerId);
      break;
    }
    case "six:coordinated-boost":
      ports.queue(s, {
        type: "threat",
        target: "main",
        amount: s.difficulty === "expert" ? 2 : 1,
      });
      for (const q of s.sideSchemes)
        ports.queue(s, { type: "threat", target: q.id, amount: 1 });
      break;
    case "six:hidden-boost":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.indirect(
          s,
          seat.id,
          1 +
            (s.difficulty === "expert" && seat.id === s.firstPlayerId ? 1 : 0),
          HIDDEN,
          name(HIDDEN),
        );
      break;
    case "six:teamwork-boost": {
      const activation = s.attack || s.scheming;
      if (activation)
        activation.extraBoostIcons = (activation.extraBoostIcons || 0) + 2;
      break;
    }
    default:
      return false;
  }
  return true;
}

/** Sinister Beatdown's own entry: no expert threat on Light at the End. */
function ambushNoThreat(s: GameState, ports: SinisterSixPorts): boolean {
  const st = s.sinisterSix;
  if (!st || !st.setAside.length) return false;
  const code = st.setAside[ports.pick(s, st.setAside.length)];
  enter(s, code, ports, true);
  sixFocusActive(s);
  return true;
}

/** Villain cards and attachments of the scenario for audits. */
export function sixStoredVillains(s: GameState): Villain[] {
  return sixBench(s);
}
export type { Option };
