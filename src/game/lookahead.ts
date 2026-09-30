import { card, maxHP, pieceHP } from "./cards";
import {
  abilityOptions,
  canPay,
  dispatch,
  playable,
  schemeLimit,
  targets,
} from "./engine";
import { seatView, syncSeat } from "./team";
import type { Command, GameState, Piece } from "./types";
import { advise, adviseAction, advisePrompt, endTurnDiscards } from "./advisor";
import type { Advice } from "./advisor";

/**
 * One-turn lookahead on top of the heuristic advisor. Each candidate action is
 * tried on a copy of the game whose hidden cards are reshuffled, the rest of
 * the round is played out by the heuristics, and the position at the start of
 * the next hero phase is scored. Nothing hidden leaks into the suggestion.
 */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function shuffleWith<T>(list: T[], random: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
/** A copy with unknown cards sampled across every facedown slot. */
export function fairClone(s: GameState, random: () => number): GameState {
  const c = structuredClone(s);
  syncSeat(c);
  const unknownEncounter = [
    ...c.encounter.deck,
    ...c.encounter.dealt,
    ...(c.attack?.pendingBoosts || []),
    ...(c.scheming?.pendingBoosts || []),
  ].map((piece) => {
    const p = { ...piece };
    delete p.dealtTo;
    return p;
  });
  // Start from a stable inventory, so the real hidden ordering cannot affect
  // a suggestion even when the planner uses only a few samples.
  unknownEncounter.sort((a, b) => a.id.localeCompare(b.id));
  shuffleWith(unknownEncounter, random);
  let encounterIndex = 0;
  const takeEncounter = () => unknownEncounter[encounterIndex++];
  c.encounter.deck = c.encounter.deck.map(takeEncounter);
  c.encounter.dealt = c.encounter.dealt.map((slot) => ({
    ...takeEncounter(),
    dealtTo: slot.dealtTo,
  }));
  if (c.attack?.pendingBoosts)
    c.attack.pendingBoosts = c.attack.pendingBoosts.map(takeEncounter);
  if (c.scheming)
    c.scheming.pendingBoosts = c.scheming.pendingBoosts.map(takeEncounter);
  const lookedAt = new Set<string>(
    c.prompt?.options.flatMap((o) =>
      o.effects.flatMap((e) => (e.type === "futurist" ? e.ids : [])),
    ) || [],
  );
  for (const seat of c.players) {
    const drones = c.minions.filter((p) => p.droneCard?.ownerId === seat.id);
    const known = seat.id === c.activePlayerId ? lookedAt : new Set<string>();
    const hidden: Piece[] = [
      ...seat.player.deck.filter((p) => !known.has(p.id)),
      ...drones.map((p) => p.droneCard!),
    ].sort((a, b) => a.id.localeCompare(b.id));
    shuffleWith(hidden, random);
    let index = 0;
    seat.player.deck = seat.player.deck.map((p) =>
      known.has(p.id) ? p : hidden[index++],
    );
    for (const drone of drones) drone.droneCard = hidden[index++];
  }
  c.seed = Math.floor(random() * 4294967295) || 1;
  return c;
}
/** How good a position is for the heroes; higher is better. */
export function evaluate(s: GameState): number {
  if (s.phase === "won") return 10000;
  if (s.phase === "lost") return -10000;
  let score = 0;
  const limit = schemeLimit(s);
  score -= (s.scheme.threat / Math.max(1, limit)) * 40;
  for (const side of s.sideSchemes) score -= 4 + side.counters;
  score += (s.villain.stage - 1) * 45 + (s.villain.maxHp - s.villain.hp) * 1.3;
  for (const m of s.minions) score -= 3 + (pieceHP(s, m) - m.damage);
  for (const seat of s.players) {
    if (seat.eliminated) {
      score -= 60;
      continue;
    }
    const v = seatView(s, seat);
    const p = v.player;
    score += p.hp * 3 - (maxHP(v) - p.hp) * 0.5;
    if (p.hp <= 2) score -= 12;
    if (p.stunned) score -= 3;
    if (p.confused) score -= 2;
    for (const piece of p.inPlay) {
      const c = card(piece);
      if (c.type_code === "ally")
        score += 2.5 + (pieceHP(v, piece) - piece.damage) * 0.6;
      else score += 1.5;
    }
    score += p.hand.length * 0.35;
  }
  return score;
}
/** Legal, sensible actions for the active hero right now. */
export function candidates(s: GameState): Command[] {
  const list: Command[] = [];
  if (s.phase !== "player" || s.prompt || s.review) return list;
  for (const p of s.player.hand)
    if (!playable(s, p)) list.push({ type: "PLAY", id: p.id });
  for (const p of s.player.inPlay) {
    const options = abilityOptions(s, p).filter((o) => !o.disabled);
    for (const o of options)
      if (o.id !== "special" || !["01020"].includes(p.code)) {
        const required = {
          "01018": "energy",
          "01026": "mental",
          "01039": "mental",
          "01068": "energy",
          "01093": "physical",
        }[p.code] as "energy" | "mental" | "physical" | undefined;
        if (o.id === "special" && required && !canPay(s, 1, [required]))
          continue;
        list.push({ type: "ABILITY", id: p.id, action: o.id });
      }
  }
  const hero = s.player.form === "hero";
  if (!s.player.exhausted) {
    if (hero && (targets(s, "enemy", true).length || s.player.stunned))
      list.push({ type: "BASIC", action: "attack" });
    if (hero && (targets(s, "scheme").length || s.player.confused))
      list.push({ type: "BASIC", action: "thwart" });
    if (!hero && s.player.hp < maxHP(s))
      list.push({ type: "BASIC", action: "recover" });
  }
  if (!s.player.flipped) list.push({ type: "FLIP" });
  if (
    (s.heroId === "iron_man" && !hero && !s.flags.futurist) ||
    (s.heroId === "captain_marvel" && !hero && !s.flags.commander) ||
    (s.heroId === "captain_marvel" &&
      hero &&
      !s.flags.rechannel &&
      s.player.hp < maxHP(s) &&
      canPay(s, 1, ["energy"]))
  )
    list.push({ type: "ABILITY", id: "identity" });
  list.push({
    type: "END_TURN",
    discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
  });
  return list;
}
/** Plays out the rest of this round with the heuristics and scores the next hero phase. */
function rollout(start: GameState, random: () => number, maxCommands = 400) {
  let s = start;
  const round = start.round;
  const seat = start.activePlayerId;
  for (let n = 0; n < maxCommands; n++) {
    if (["won", "lost"].includes(s.phase)) break;
    // The next hero phase has begun: stop and score.
    if (
      s.phase === "player" &&
      !s.prompt &&
      !s.review &&
      (s.round > round ||
        (s.round === round &&
          s.turnPlayerId !== seat &&
          s.playerCount > 1 &&
          n > 0))
    )
      break;
    const advice = advise(s);
    const command: Command = advice
      ? advice.command
      : {
          type: "END_TURN",
          discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
        };
    const next = dispatch(s, command);
    if (next.error) {
      const ended = dispatch(s, {
        type: "END_TURN",
        discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
      });
      if (ended.error) break;
      s = ended;
    } else s = next;
    void random;
  }
  return evaluate(s);
}
export interface PlanOptions {
  /** Independent samples reused across candidates; more is steadier and slower. */
  rollouts?: number;
  seed?: number;
  /** Tests only: play with the real deck order to check that a scenario can be won at all. */
  omniscient?: boolean;
}
/** The best next action for the active hero, chosen by lookahead. */
export function planAction(
  s: GameState,
  options: PlanOptions = {},
): Advice | null {
  const list = candidates(s);
  if (!list.length) return null;
  const random = rng(options.seed ?? Math.floor(Math.random() * 1e9));
  const rollouts = options.rollouts ?? 2;
  const samples = Array.from({ length: rollouts }, () =>
    options.omniscient ? structuredClone(s) : fairClone(s, random),
  );
  const scoreOf = (command: Command) => {
    let total = 0;
    for (let r = 0; r < rollouts; r++) {
      const applied = dispatch(samples[r], command);
      if (applied.error) return -Infinity;
      // An action whose only outcome is a cost that cannot be paid is no action.
      if (applied.prompt) {
        const answer = advisePrompt(applied);
        if (!answer || answer.command.type === "CANCEL") return -Infinity;
      }
      total += rollout(applied, random);
    }
    return total / rollouts;
  };
  const ending = list.find((c) => c.type === "END_TURN")!;
  const baseline = scoreOf(ending);
  let best: { command: Command; score: number } | null = null;
  for (const command of list) {
    if (command === ending) continue;
    const score = scoreOf(command);
    if (!best || score > best.score) best = { command, score };
  }
  // Only act when acting is clearly better than ending the turn as it stands.
  if (!best || !Number.isFinite(best.score) || best.score < baseline + 0.5)
    return null;
  const heuristic = adviseAction(s);
  const same =
    heuristic &&
    JSON.stringify(heuristic.command) === JSON.stringify(best.command);
  return {
    command: best.command,
    title: same ? heuristic!.title : describe(s, best.command),
    reason: same
      ? heuristic!.reason
      : "Playing the round out from here scores best for your hit points, the villain's damage and the threat.",
  };
}
/** Answers a choice prompt by lookahead; other prompts use the heuristics. */
export function planPrompt(
  s: GameState,
  options: PlanOptions = {},
): Advice | null {
  const p = s.prompt;
  if (!p) return null;
  if (p.kind !== "choice" || p.options.length > 8) return advisePrompt(s);
  const random = rng(options.seed ?? Math.floor(Math.random() * 1e9));
  const rollouts = options.rollouts ?? 2;
  const samples = Array.from({ length: rollouts }, () =>
    options.omniscient ? structuredClone(s) : fairClone(s, random),
  );
  let best: { id: string; score: number } | null = null;
  for (const o of p.options) {
    let total = 0;
    for (let r = 0; r < rollouts; r++) {
      const applied = dispatch(samples[r], { type: "CHOOSE", id: o.id });
      if (applied.error) {
        total = -Infinity;
        break;
      }
      total += rollout(applied, random);
    }
    const score = total / rollouts;
    if (!best || score > best.score) best = { id: o.id, score };
  }
  if (!best || !Number.isFinite(best.score)) return advisePrompt(s);
  const heuristic = advisePrompt(s);
  const option = p.options.find((o) => o.id === best!.id)!;
  return {
    command: { type: "CHOOSE", id: best.id },
    title: option.label,
    reason:
      heuristic &&
      heuristic.command.type === "CHOOSE" &&
      heuristic.command.id === best.id
        ? heuristic.reason
        : "Playing the round out from here scores best for your heroes.",
  };
}
function describe(s: GameState, c: Command) {
  switch (c.type) {
    case "PLAY":
      return `Play ${card(s.player.hand.find((p) => p.id === c.id)!).name}`;
    case "BASIC":
      return c.action === "attack"
        ? "Basic attack"
        : c.action === "thwart"
          ? "Basic thwart"
          : "Recover";
    case "FLIP":
      return s.player.form === "hero" ? "Change to alter-ego" : "Suit up";
    case "ABILITY": {
      if (c.id === "identity") return "Use your identity ability";
      const piece = s.player.inPlay.find((p) => p.id === c.id);
      return piece
        ? `${card(piece).name}: ${c.action || "ability"}`
        : "Use an ability";
    }
    default:
      return c.type;
  }
}
/** Plays a mission with lookahead decisions; slower but far stronger than the heuristics alone. */
export function autoplaySmart(
  start: GameState,
  options: PlanOptions & { maxRounds?: number; maxCommands?: number } = {},
) {
  let s = start;
  let commands = 0;
  const random = rng(options.seed ?? 4242);
  const maxRounds = options.maxRounds ?? 30;
  const maxCommands = options.maxCommands ?? 6000;
  let repeats = 0;
  let lastKey = "";
  while (
    !["won", "lost"].includes(s.phase) &&
    commands < maxCommands &&
    s.round <= maxRounds
  ) {
    const seed = Math.floor(random() * 1e9);
    const key = `${s.round}:${s.phase}:${s.activePlayerId}:${s.prompt?.title || ""}:${s.player.hand.map((p) => p.id).join(",")}`;
    repeats = key === lastKey ? repeats + 1 : 0;
    lastKey = key;
    if (repeats > 6) {
      // The same position keeps coming back: stop looping and end the turn.
      const open = s.prompt?.cancelable ? dispatch(s, { type: "CANCEL" }) : s;
      const ended = dispatch(open, {
        type: "END_TURN",
        discard: open.playerCount === 1 ? endTurnDiscards(open) : undefined,
      });
      if (!ended.error) {
        s = ended;
        commands++;
        repeats = 0;
        continue;
      }
    }
    let advice: Advice | null;
    if (s.review)
      advice = { command: { type: "PROCEED" }, title: "", reason: "" };
    else if (s.prompt)
      advice = planPrompt(s, {
        rollouts: options.rollouts,
        seed,
        omniscient: options.omniscient,
      });
    else if (s.phase === "mulligan") advice = advise(s);
    else
      advice = planAction(s, {
        rollouts: options.rollouts,
        seed,
        omniscient: options.omniscient,
      });
    const command: Command = advice
      ? advice.command
      : {
          type: "END_TURN",
          discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
        };
    const next = dispatch(s, command);
    if (next.error) {
      const ended = dispatch(s, {
        type: "END_TURN",
        discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
      });
      if (ended.error)
        throw Error(
          `${command.type}: ${next.error} / END_TURN: ${ended.error}`,
        );
      s = ended;
    } else s = next;
    commands++;
  }
  return { state: s, commands };
}
