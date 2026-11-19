import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Piece } from "./types.js";

/** The free Kree Fanatic modular set: Ronan the Accuser as a minion. */
export const KREE_FANATIC_SCRIPT_CODES = [
  "90001",
  "90002",
  "90003",
  "90004",
  "90005",
] as const;
export const KREE_FANATIC_MODULAR_SETS = ["kree_fanatic"] as const;

const RONAN = "90001";
const JUDGE = "90002";
const ACCUSED = "90003";
const HAMMER = "90004";
const OPPOSE = "90005";

export interface KreeFanaticPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** The hit points a player's identity has left. */
  remainingHp(s: GameState, playerId: string): number;
  /** Deal this encounter card to a player facedown. */
  dealPiece(s: GameState, p: Piece, playerId: string): void;
  heroName(s: GameState, playerId: string): string;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const K = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `kfan:${type}`,
  ...args,
});
const scripted = new Set<string>(KREE_FANATIC_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const ronans = (s: GameState) =>
  s.minions.filter((m) => m.code === RONAN && active(s, m));

// -------------------------------------------------------------- constants

/** Ronan the Accuser cannot be stunned. */
export function kreeFanaticCannotStun(s: GameState, p: Piece): boolean {
  return p.code === RONAN && active(s, p);
}
/** The Accused: an enemy attack initiated against the attached identity
 * gets +1 ATK. */
export function kreeFanaticAttackBonus(s: GameState, playerId: string): number {
  return s.attachments.filter(
    (a) =>
      a.code === ACCUSED && a.attachedTo === `hero:${playerId}` && active(s, a),
  ).length;
}
/** You Dare Oppose Me?'s boost: this attack gains overkill. */
export function kreeFanaticOverkill(s: GameState, attackerId: string) {
  return !!s.attack?.kfanOverkill && s.attack.attacker === attackerId;
}

// -------------------------------------------------------------- responses

/** Ronan the Accuser: when the villain phase begins, he engages the hero
 * with the fewest remaining hit points. */
export function kreeFanaticVillainPhaseInterrupts(s: GameState): Effect[] {
  return ronans(s).map((m) => K("engage", { id: m.id }));
}
/** A friendly character is defeated by an enemy attack. */
export function kreeFanaticCharacterDefeated(
  s: GameState,
  source: string,
): Effect[] {
  const a = s.attack;
  if (!a || a.attacker !== source || over(s)) return [];
  const out: Effect[] = [];
  // Judge, Jury, Executioner.
  for (const q of s.sideSchemes.filter((q) => q.code === JUDGE && active(s, q)))
    out.push({ type: "threat", target: "main", amount: 2, source: q.id });
  // Bring the Hammer Down's boost, once for this activation.
  if (a.kfanHammer && !a.kfanHammerDealt) {
    a.kfanHammerDealt = true;
    out.push(K("deal-first"));
  }
  return out;
}
/** The Accused is discarded after Ronan the Accuser is defeated. */
export function kreeFanaticMinionDefeated(s: GameState, m: Piece): Effect[] {
  if (m.code !== RONAN) return [];
  return s.attachments
    .filter((a) => a.code === ACCUSED && active(s, a))
    .map((a) => ({ type: "discardPiece", id: a.id }));
}

// ----------------------------------------------------------------- reveal

export function kreeFanaticReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === ACCUSED) return [K("accuse", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case HAMMER:
      return [K("hammer", { playerId, code: p.code })];
    case OPPOSE:
      return [K("oppose", { playerId })];
    default:
      return [];
  }
}

export function kreeFanaticBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case RONAN:
      return [K("ronan-boost", { id: p.id, playerId })];
    case JUDGE:
      return [K("judge-boost", { id: p.id })];
    case ACCUSED:
      return [K("accused-boost", { id: p.id, playerId })];
    case HAMMER:
      return s.attack ? [K("hammer-boost")] : [];
    case OPPOSE:
      return s.attack ? [K("oppose-boost")] : [];
    default:
      return [];
  }
}

/** Keep a boost card in play instead of discarding it after the
 * activation. */
function retain(s: GameState, id: string) {
  const activation = s.attack || s.scheming;
  if (activation && !activation.retainedBoostIds?.includes(id))
    (activation.retainedBoostIds ||= []).push(id);
}

// --------------------------------------------------------------- resolver

export function resolveKreeFanaticEffect(
  s: GameState,
  e: Effect,
  ports: KreeFanaticPorts,
): boolean {
  if (!e.type.startsWith("kfan:")) return false;
  switch (e.type) {
    case "kfan:engage": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m) break;
      const seats = playerOrder(s).filter((q) => !q.eliminated);
      if (!seats.length) break;
      const min = Math.min(...seats.map((q) => ports.remainingHp(s, q.id)));
      const lowest = seats.filter((q) => ports.remainingHp(s, q.id) === min);
      if (lowest.length === 1 || lowest.some((q) => q.id === m.engagedWith)) {
        const target = lowest.some((q) => q.id === m.engagedWith)
          ? m.engagedWith!
          : lowest[0].id;
        ports.queue(s, K("engage-to", { id: m.id, playerId: target }));
        break;
      }
      ports.choose(
        s,
        name(RONAN),
        "The heroes are tied for the fewest hit points. Choose who Ronan the Accuser engages.",
        lowest.map((q) => ({
          id: q.id,
          label: ports.heroName(s, q.id),
          effects: [K("engage-to", { id: m.id, playerId: q.id })],
        })),
      );
      break;
    }
    case "kfan:engage-to": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, e.playerId) || m.engagedWith === e.playerId) break;
      m.engagedWith = e.playerId;
      ports.log(s, `${name(RONAN)} engages a new hero.`, "bad");
      break;
    }
    case "kfan:accuse": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "kfan:hammer": {
      const m = ronans(s)[0] || s.minions.find((q) => q.code === RONAN);
      if (!m) {
        // If Ronan the Accuser is not in play, this card gains surge.
        ports.queue(s, { type: "surge", sourceCode: e.code });
        break;
      }
      const playerId =
        m.engagedWith && alive(s, m.engagedWith) ? m.engagedWith : e.playerId;
      const view = seatView(s, playerId);
      ports.activate(s, {
        enemyId: m.id,
        playerId,
        kind: view.player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "kfan:oppose": {
      if (!alive(s, e.playerId)) break;
      for (let i = 0; i < 5; i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (
          piece &&
          def(piece)?.set_code === "kree_fanatic" &&
          s.encounter.discard.some((q) => q.id === piece.id)
        ) {
          s.encounter.discard = s.encounter.discard.filter(
            (q) => q.id !== piece.id,
          );
          ports.dealPiece(s, piece, e.playerId);
        }
        if (emptied) break;
      }
      break;
    }
    case "kfan:ronan-boost": {
      retain(s, e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p && alive(s, e.playerId)) ports.putMinion(s, p, e.playerId);
      break;
    }
    case "kfan:judge-boost": {
      retain(s, e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.putSideScheme(s, p);
      break;
    }
    case "kfan:accused-boost": {
      retain(s, e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p && alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      break;
    }
    case "kfan:hammer-boost":
      if (s.attack) s.attack.kfanHammer = true;
      break;
    case "kfan:oppose-boost":
      if (s.attack) s.attack.kfanOverkill = true;
      break;
    case "kfan:deal-first":
      if (alive(s, s.firstPlayerId)) ports.dealEncounter(s, s.firstPlayerId);
      break;
    default:
      return false;
  }
  return true;
}
