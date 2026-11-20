import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Agents of S.H.I.E.L.D.'s first scenario: the spy Yelena Belova, the
 * Black Widow. Her encounter cards carry "Preparation" abilities instead of
 * boosts: whenever a hero or ally attacks her, she removes 1 threat from her
 * main scheme, and the attacking player discards the top encounter card and
 * resolves its Preparation before the attack. With the A.I.M. Abduction and
 * A.I.M. Science modular sets, which join any scenario with modular sets. */

export const BLACK_WIDOW_VILLAIN_CODES = [
  "50064",
  "50065",
  "50066",
  "50067a",
  "50067b",
  "50068",
  "50069",
  "50070",
  "50071",
  "50072",
  "50073",
  "50074",
  "50075",
  "50076",
  "50077",
  "50078",
  "50079",
] as const;
export const AIM_ABDUCTION_CODES = ["50080", "50081", "50082"] as const;
export const AIM_SCIENCE_CODES = ["50083", "50084", "50085"] as const;
/** The two modular sets, which join any scenario with modular sets. */
export const BLACK_WIDOW_MODULAR_SETS = [
  "a.i.m._abduction",
  "a.i.m._science",
] as const;
const ALL_CODES: readonly string[] = [
  ...BLACK_WIDOW_VILLAIN_CODES,
  ...AIM_ABDUCTION_CODES,
  ...AIM_SCIENCE_CODES,
];

/** Black Widow (I) to (III). */
const STAGES = ["50064", "50065", "50066"];
export const WIDOWS_WEB = "50067b";
export const GAUNTLET = "50068";
const GRAPPLING_HOOK = "50069";
export const NIGHT_VISION = "50070";
export const STUN_NET = "50071";
const COMMANDO = "50072";
const GRUNT = "50073";
export const AUTOMATED_DEFENSES = "50074";
export const DESTROY_EVIDENCE = "50075";
const ATTACROBATICS = "50076";
const COVERT_OPS = "50077";
const DANCE_OF_DEATH = "50078";
const WIDOWS_BITE = "50079";
const ABDUCTOR = "50080";
export const ABDUCT_SUPERHUMANS = "50081";
const NABBED = "50082";
const SCIENTIST = "50083";
const SOLDIER = "50084";
export const MAD_SCIENCE = "50085";
/** The encounter cards with a printed Preparation ability. */
const PREPARATIONS = [
  GAUNTLET,
  GRAPPLING_HOOK,
  NIGHT_VISION,
  STUN_NET,
  COMMANDO,
  GRUNT,
  ATTACROBATICS,
  COVERT_OPS,
  DANCE_OF_DEATH,
  WIDOWS_BITE,
];

export interface BlackWidowVillainState {
  /** The attack whose Forced Interrupt last resolved, and what its
   * Preparation did to that attack. */
  attack?: { token: string; prevent?: boolean; redirect?: string };
  /** An additional boost card for Attacrobatics' attack. */
  extraBoost?: number;
}

export interface BlackWidowVillainPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Reveal an encounter card, removing it from its zone first. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** The characters a player controls: their identity, then their allies. */
  characters(s: GameState, playerId: string): string[];
  remainingHP(s: GameState, id: string): number;
  /** Discard the top cards of the player's deck and return them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  discardFromHand(s: GameState, playerId: string, id: string): void;
  /** Attach an encounter card to a character ("hero:<player>" or an ally). */
  attachToCharacter(s: GameState, p: Piece, target: string): void;
  /** A player's ally leaves play to its owner's discard pile. */
  allyLeavesPlay(s: GameState, id: string): void;
  /** Put an ally card into play under its owner's control. */
  putAllyIntoPlay(s: GameState, p: Piece, ownerId: string): void;
  /** Remove 1 threat from the main scheme, ignoring crisis icons; 1 when
   * there was threat to remove. */
  removeMainThreat(s: GameState): number;
  changeToHero(s: GameState, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `bwv:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const seats = (s: GameState) => playerOrder(s).filter((x) => !x.eliminated);
export const blackWidowVillain = (s: GameState) => !!s.blackWidowVillain;
const widowInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code) && active(s, s.villain);
/** Black Widow's stage, 1 to 3: the X of The Widow's Web. */
export const widowStage = (s: GameState) =>
  s.villain && STAGES.includes(s.villain.code)
    ? STAGES.indexOf(s.villain.code) + 1
    : 0;
/** The A.I.M. trait: its dots defeat the usual trait split. */
const aim = (p: Piece) => (def(p)?.traits || "").includes("A.I.M.");
const inPlay = (s: GameState, code: string) =>
  [...s.sideSchemes, ...s.attachments, ...s.minions].find(
    (p) => p.code === code && active(s, p),
  );
const abduct = (s: GameState) =>
  s.sideSchemes.find((p) => p.code === ABDUCT_SUPERHUMANS);
/** The player a character belongs to. */
const ownerOf = (s: GameState, character: string) =>
  character.startsWith("hero:")
    ? character.slice(5)
    : (s.players.find((seat) =>
        seatView(s, seat.id).player.inPlay.some((p) => p.id === character),
      )?.id ?? s.activePlayerId);

// ------------------------------------------------------------- interface

/** The line under Black Widow's stats. */
export const BLACK_WIDOW_CAPTION =
  "When you attack her: 1 threat off the main scheme, then the top encounter card's Preparation";
/** The main scheme's note: X is her stage. */
export const widowsWebNote = (s: GameState) =>
  `+${widowStage(s)} threat per player each villain phase · X = her stage`;

// --------------------------------------------------------------- setup

/** The Widow's Web (1A): 2 threat per player. */
export function blackWidowSetup(s: GameState) {
  s.blackWidowVillain = {};
  const c = def(WIDOWS_WEB);
  s.scheme.threat =
    (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
}
/** Each player searches the encounter deck for a minion and puts it into
 * play engaged with them. */
export function blackWidowSetupEffects(s: GameState): Effect[] {
  return s.blackWidowVillain
    ? seats(s).map((seat) =>
        E("setup-minion", { playerId: seat.id, actorId: seat.id }),
      )
    : [];
}
/** X threat per player each villain phase, X being Black Widow's stage. */
export function blackWidowEscalation(s: GameState): number | undefined {
  if (!s.blackWidowVillain || s.scheme.code !== WIDOWS_WEB) return undefined;
  return widowStage(s) * s.playerCount;
}
/** Black Widow (II) and (III) When Revealed: 2 or 3 threat per player on
 * the main scheme. */
export function blackWidowVillainRevealed(s: GameState): Effect[] {
  if (!widowInPlay(s)) return [];
  const stage = widowStage(s);
  return stage >= 2
    ? [{ type: "threat", target: "main", amount: stage * s.playerCount }]
    : [];
}

// ------------------------------------------------------------- the attack

/** A Preparation the discarded card resolves: its printed one, or the ones
 * Night Vision Goggles and Automated Defenses give each card without one. */
function preparationsOf(s: GameState, p: Piece): string[] {
  if (PREPARATIONS.includes(p.code)) return [p.code];
  const granted: string[] = [];
  if (s.attachments.some((a) => a.code === NIGHT_VISION && active(s, a)))
    granted.push(`granted:${NIGHT_VISION}`);
  if (inPlay(s, AUTOMATED_DEFENSES))
    granted.push(`granted:${AUTOMATED_DEFENSES}`);
  return granted;
}

/** Black Widow's Forced Interrupt when a character a player controls
 * attacks her: she removes 1 threat from the main scheme, then the
 * attacking player discards the top encounter card and resolves its
 * Preparation before the attack. Resolves once per attack; returns what the
 * Preparation did to this packet of it. */
export function blackWidowAttacked(
  s: GameState,
  target: string,
  source: string,
  amount: number,
  token: string | undefined,
  ports: BlackWidowVillainPorts,
): { prevent: boolean; redirect?: string } {
  const st = s.blackWidowVillain;
  if (!st) return { prevent: false };
  // A later packet of an attack whose Forced Interrupt already resolved.
  if (token && st.attack?.token === token)
    return {
      prevent: !!st.attack.prevent,
      redirect: target === s.villain.id ? st.attack.redirect : undefined,
    };
  if (target !== s.villain.id || !widowInPlay(s)) return { prevent: false };
  const attackToken = token || `attack:${s.nextId++}`;
  st.attack = { token: attackToken };
  const attacker =
    source === "hero"
      ? `hero:${s.activePlayerId}`
      : source.startsWith("hero:") ||
          s.players.some((seat) =>
            seatView(s, seat.id).player.inPlay.some((p) => p.id === source),
          )
        ? source
        : `hero:${s.activePlayerId}`;
  const playerId = ownerOf(s, attacker);
  const gauntlets = s.attachments.filter(
    (a) => a.code === GAUNTLET && a.attachedTo === s.villain.id && active(s, a),
  );
  // After the attack: each Gauntlet's Hero Response when no Preparation
  // ability resolved.
  const unprepared = () =>
    gauntlets.length
      ? [E("gauntlets", { ids: gauntlets.map((a) => a.id), playerId })]
      : [];
  if (!ports.removeMainThreat(s)) {
    ports.log(
      s,
      "Black Widow cannot remove threat from the main scheme: no Preparation.",
    );
    ports.queue(s, ...unprepared());
    return { prevent: false };
  }
  ports.log(
    s,
    "Black Widow removes 1 threat from the main scheme and prepares.",
    "bad",
  );
  const { piece } = ports.discardTop(s);
  if (!piece) {
    ports.queue(s, ...unprepared());
    return { prevent: false };
  }
  const preparations = active(s, piece) ? preparationsOf(s, piece) : [];
  if (!preparations.length) {
    ports.log(s, `${name(piece)} has no Preparation.`);
    ports.queue(s, ...unprepared());
    return { prevent: false };
  }
  ports.log(s, `Preparation: ${name(piece)}.`, "bad");
  // Effects that follow the attack; queued first, they resolve after it.
  const after: Effect[] = [];
  let prevent = false;
  let redirect: string | undefined;
  for (const prep of preparations)
    switch (prep) {
      case GAUNTLET:
      case NIGHT_VISION:
        ports.attach(s, piece, s.villain.id);
        break;
      case GRAPPLING_HOOK:
        after.push(E("hook-discard", { playerId, actorId: playerId }));
        break;
      case STUN_NET:
        after.push(E("net", { id: piece.id, target: attacker }));
        break;
      case COMMANDO:
        after.push(E("commando", { id: piece.id, playerId }));
        break;
      case GRUNT:
        // Put into play engaged with you; the attack goes to it instead.
        ports.putMinion(s, piece, playerId);
        if (s.minions.some((m) => m.id === piece.id)) redirect = piece.id;
        break;
      case ATTACROBATICS:
        prevent = true;
        if (s.difficulty === "expert" && amount > 0)
          after.push({
            type: "damage",
            target: attacker,
            amount,
            source: s.villain.id,
          });
        break;
      case COVERT_OPS:
        after.push(
          { type: "threat", target: "main", amount: 1 },
          ...s.sideSchemes.map((q) => ({
            type: "threat",
            target: q.id,
            amount: 1,
          })),
        );
        break;
      case DANCE_OF_DEATH:
        after.push(
          ...ports.characters(s, playerId).map((target) => ({
            type: "damage",
            target,
            amount: 1,
            source: s.villain.id,
          })),
        );
        break;
      case WIDOWS_BITE:
        after.push(E("bite", { target: attacker }));
        break;
      case `granted:${NIGHT_VISION}`: {
        // Prevent all damage from this attack, then discard the Goggles.
        prevent = true;
        const goggles = s.attachments.find(
          (a) => a.code === NIGHT_VISION && active(s, a),
        );
        if (goggles) ports.discardPiece(s, goggles.id);
        break;
      }
      case `granted:${AUTOMATED_DEFENSES}`:
        after.push({
          type: "damage",
          target: attacker,
          amount: 1,
          source: s.villain.id,
        });
        break;
    }
  st.attack = { token: attackToken, prevent, redirect };
  if (prevent) ports.log(s, "All damage from this attack is prevented.", "bad");
  ports.queue(s, ...after);
  return { prevent, redirect };
}
/** Black Widow's Gauntlet: retaliate 1 for each attached. */
export function blackWidowKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword !== "Retaliate" || !s.villain || p.id !== s.villain.id) return 0;
  return s.attachments.filter(
    (a) => a.code === GAUNTLET && a.attachedTo === p.id && active(s, a),
  ).length;
}
/** Stun Net: the attached character cannot attack. */
export function stunNetted(s: GameState, character: string): boolean {
  return s.attachments.some(
    (a) => a.code === STUN_NET && a.attachedTo === character && active(s, a),
  );
}
/** A.I.M. Scientist cannot be attacked while the player it is engaged with
 * is engaged with another minion. */
export function blackWidowAttackForbidden(
  s: GameState,
  targetId: string,
): boolean {
  const m = s.minions.find((q) => q.id === targetId);
  if (!m || m.code !== SCIENTIST || !active(s, m)) return false;
  const engaged = m.engagedWith || s.activePlayerId;
  return s.minions.some(
    (q) => q.id !== m.id && (q.engagedWith || s.activePlayerId) === engaged,
  );
}
/** Mad Science: each A.I.M. minion gains an acceleration icon. */
export function blackWidowAcceleration(s: GameState): number {
  if (!inPlay(s, MAD_SCIENCE)) return 0;
  return s.minions.filter((m) => aim(m) && active(s, m)).length;
}
/** Destroy Evidence: each other encounter card gains incite 1. */
export function blackWidowIncite(s: GameState, p: Piece): number {
  return p.code !== DESTROY_EVIDENCE && inPlay(s, DESTROY_EVIDENCE) ? 1 : 0;
}
/** Grappling Hook's Forced Interrupt when a player plays an event: the
 * Hook that cancels it. */
export function grapplingHook(s: GameState): Piece | undefined {
  return s.attachments.find(
    (a) => a.code === GRAPPLING_HOOK && a.attachedTo === s.villain?.id,
  );
}
/** Attacrobatics: an additional boost card for this attack. */
export function blackWidowAdditionalBoosts(s: GameState): number {
  const st = s.blackWidowVillain;
  const n = st?.extraBoost || 0;
  if (st) delete st.extraBoost;
  return n;
}
/** Abduct Superhumans' Forced Interrupt when an ally leaves play: it is
 * tucked under the scheme, with threat equal to its cost and an
 * acceleration token. */
export function blackWidowAllyLeftPlay(
  s: GameState,
  ally: Piece,
  ownerId: string,
): Effect[] {
  const scheme = abduct(s);
  if (!scheme || !active(s, scheme)) return [];
  return [E("tuck", { id: ally.id, ownerId, scheme: scheme.id })];
}
/** Abduct Superhumans' When Defeated: each tucked ally enters play under
 * its owner's control. */
export function blackWidowSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (p.code !== ABDUCT_SUPERHUMANS || !active(s, p)) return [];
  const tucked = (p.storedCards || []).filter(
    (q) => def(q)?.type_code === "ally",
  );
  return tucked.length
    ? [E("free", { ids: tucked.map((q) => q.id), scheme: p.id })]
    : [];
}

// ----------------------------------------------------------------- actions

export function blackWidowActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.attachments.find((p) => p.id === id && p.code === STUN_NET);
}
/** Stun Net's Hero Action, which any player may trigger: exhaust a
 * character you control to discard it. */
export function blackWidowActions(
  s: GameState,
  p: Piece,
  ports: Pick<BlackWidowVillainPorts, "characters">,
): Option[] {
  if (
    s.phase !== "player" ||
    p.code !== STUN_NET ||
    !active(s, p) ||
    s.player.form !== "hero"
  )
    return [];
  const playerId = s.activePlayerId;
  return ports
    .characters(s, playerId)
    .filter((c) =>
      c.startsWith("hero:")
        ? !s.player.exhausted
        : s.player.inPlay.some((q) => q.id === c && !q.exhausted),
    )
    .map((c) => ({
      id: c.startsWith("hero:") ? "discard" : `discard:${c}`,
      label: c.startsWith("hero:")
        ? "Hero Action · exhaust your hero · discard Stun Net"
        : `Hero Action · exhaust ${name(s.player.inPlay.find((q) => q.id === c)!)} · discard Stun Net`,
      image: p.code,
      effects: [
        { type: "exhaust", id: c.startsWith("hero:") ? "hero" : c },
        { type: "discardPiece", id: p.id },
      ],
    }));
}

// ----------------------------------------------------------------- reveals

export function blackWidowReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  // The attachments: three on Black Widow, Stun Net on your identity.
  if ([GAUNTLET, GRAPPLING_HOOK, NIGHT_VISION].includes(p.code))
    return resolving ? [E("attach", { piece: p })] : [];
  if (p.code === STUN_NET)
    return resolving ? [E("attach-you", { piece: p, playerId })] : [];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case ATTACROBATICS:
      return [E("attacrobatics", { playerId })];
    case COVERT_OPS:
      return [
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: playerId,
        },
        E("activate", { playerId, kind: "scheme" }),
      ];
    case DANCE_OF_DEATH:
      return [E("dance", { playerId, n: 1, used: [] })];
    case WIDOWS_BITE: {
      const stunned = seatView(s, playerId).player.stunned;
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
        {
          type: "damage",
          target: "hero",
          amount: stunned ? 2 : 1,
          source: p.id,
          actorId: playerId,
        },
      ];
    }
    case ABDUCTOR:
      return [E("abductor", { playerId })];
    case NABBED:
      return [E("nabbed", { playerId })];
    case SOLDIER:
      return [E("soldier", { playerId })];
    default:
      return [];
  }
}
/** The attack whose Forced Interrupt resolved has ended. */
export function blackWidowAttackEnded(s: GameState, token: string) {
  const st = s.blackWidowVillain;
  if (st?.attack?.token === token) delete st.attack;
}

// ---------------------------------------------------------------- resolver

export function resolveBlackWidowVillainEffect(
  s: GameState,
  e: Effect,
  ports: BlackWidowVillainPorts,
): boolean {
  if (!e.type.startsWith("bwv:")) return false;
  switch (e.type) {
    case "bwv:setup-minion": {
      // Search the encounter deck for a minion; it engages you. (Shuffle.)
      if (!alive(s, e.playerId)) break;
      const minions = s.encounter.deck.filter(
        (p) => def(p)?.type_code === "minion",
      );
      const choices = minions.filter(
        (p, i) => minions.findIndex((q) => q.code === p.code) === i,
      );
      if (!choices.length) break;
      if (choices.length === 1) {
        ports.queue(
          s,
          E("setup-put", {
            id: choices[0].id,
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        );
        break;
      }
      ports.choose(
        s,
        "The Widow's Web",
        "Search the encounter deck for a minion. It enters play engaged with you.",
        choices.map((p): Option => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [
            E("setup-put", {
              id: p.id,
              playerId: e.playerId,
              actorId: e.playerId,
            }),
          ],
        })),
      );
      break;
    }
    case "bwv:setup-put": {
      const p = s.encounter.deck.find((q) => q.id === e.id);
      if (!p) break;
      ports.putMinion(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "bwv:attach": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "bwv:attach-you": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId))
        ports.attachToCharacter(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "bwv:activate":
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
      });
      break;
    case "bwv:attacrobatics": {
      // In alter-ego form you change to hero form; she attacks you with an
      // additional boost card.
      if (!alive(s, e.playerId) || !widowInPlay(s)) break;
      if (seatView(s, e.playerId).player.form !== "hero")
        ports.changeToHero(s, e.playerId);
      ports.queue(s, E("attacrobatics-attack", { playerId: e.playerId }));
      break;
    }
    case "bwv:attacrobatics-attack": {
      const st = s.blackWidowVillain;
      if (!alive(s, e.playerId) || !st || !widowInPlay(s)) break;
      st.extraBoost = (st.extraBoost || 0) + 1;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: E("clear-boost"),
      });
      break;
    }
    case "bwv:clear-boost":
      if (s.blackWidowVillain) delete s.blackWidowVillain.extraBoost;
      break;
    case "bwv:dance": {
      // 1 damage to a character you control, 2 to a second and 3 to a
      // third, each of your choice.
      if (!alive(s, e.playerId) || Number(e.n) > 3) break;
      const used = (e.used as string[]) || [];
      const open = ports
        .characters(s, e.playerId)
        .filter((c) => !used.includes(c));
      if (!open.length) break;
      const n = Number(e.n);
      const effects = (c: string): Effect[] => [
        { type: "damage", target: c, amount: n, source: s.villain.id },
        E("dance", {
          playerId: e.playerId,
          n: n + 1,
          used: [...used, c],
          actorId: e.playerId,
        }),
      ];
      if (open.length === 1) {
        ports.queue(s, ...effects(open[0]));
        break;
      }
      const view = seatView(s, e.playerId).player;
      ports.choose(
        s,
        name(DANCE_OF_DEATH),
        `Deal ${n} damage to a character you control.`,
        open.map((c): Option => ({
          id: c,
          label: c.startsWith("hero:")
            ? "Your identity"
            : name(view.inPlay.find((q) => q.id === c)!),
          effects: effects(c),
        })),
      );
      break;
    }
    case "bwv:hook-discard": {
      // Grappling Hook's Preparation: discard 1 event card from your hand.
      if (!alive(s, e.playerId)) break;
      const events = seatView(s, e.playerId).player.hand.filter(
        (q) => def(q)?.type_code === "event",
      );
      if (events.length === 1)
        ports.discardFromHand(s, e.playerId, events[0].id);
      else if (events.length)
        ports.choose(
          s,
          name(GRAPPLING_HOOK),
          "Discard an event card from your hand.",
          events.map((q): Option => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              E("hand-discard", {
                playerId: e.playerId,
                id: q.id,
                actorId: e.playerId,
              }),
            ],
          })),
        );
      break;
    }
    case "bwv:hand-discard":
      ports.discardFromHand(s, e.playerId, e.id);
      break;
    case "bwv:net": {
      // Stun Net's Preparation: after this attack, it attaches to the
      // attacking character.
      const p = s.encounter.discard.find((q) => q.id === e.id);
      const target = String(e.target);
      const there = target.startsWith("hero:")
        ? alive(s, target.slice(5))
        : s.players.some((seat) =>
            seatView(s, seat.id).player.inPlay.some((q) => q.id === target),
          );
      if (p && there) ports.attachToCharacter(s, p, target);
      break;
    }
    case "bwv:commando": {
      // A.I.M. Commando's Preparation: after this attack, it engages you.
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (p && alive(s, e.playerId)) ports.putMinion(s, p, e.playerId);
      break;
    }
    case "bwv:bite": {
      // Widow's Bite's Preparation: after this attack, the attacking
      // character is stunned.
      const target = String(e.target);
      if (target.startsWith("hero:")) {
        if (alive(s, target.slice(5)))
          ports.queue(s, {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: target.slice(5),
          });
      } else ports.queue(s, { type: "status", target, status: "stunned" });
      break;
    }
    case "bwv:gauntlets": {
      // Each Gauntlet's Hero Response after an attack without a
      // Preparation: discard it.
      const ids = ((e.ids as string[]) || []).filter((id) =>
        s.attachments.some((a) => a.id === id),
      );
      if (!ids.length || !alive(s, e.playerId)) break;
      const [id, ...rest] = ids;
      ports.choose(
        s,
        name(GAUNTLET),
        "No Preparation resolved: discard Black Widow's Gauntlet?",
        [
          {
            id: "discard",
            label: "Discard Black Widow's Gauntlet",
            image: GAUNTLET,
            effects: [
              { type: "discardPiece", id },
              ...(rest.length
                ? [
                    E("gauntlets", {
                      ids: rest,
                      playerId: e.playerId,
                      actorId: e.playerId,
                    }),
                  ]
                : []),
            ],
          },
          { id: "pass", label: "Keep it", effects: [] },
        ],
      );
      break;
    }
    case "bwv:ensure-abduct": {
      // Find Abduct Superhumans and put it into play, if it is not.
      if (abduct(s)) break;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const p = zone.find((q) => q.code === ABDUCT_SUPERHUMANS);
        if (!p) continue;
        ports.putSideScheme(s, p);
        if (zone === s.encounter.deck) ports.shuffleEncounter(s);
        ports.log(s, "Abduct Superhumans enters play.", "bad");
        break;
      }
      break;
    }
    case "bwv:abductor": {
      // Tuck your ally with the most remaining hit points under Abduct
      // Superhumans; otherwise 2 threat on it.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        E("ensure-abduct"),
        E("abductor-take", { playerId: e.playerId, actorId: e.playerId }),
      );
      break;
    }
    case "bwv:abductor-take": {
      const scheme = abduct(s);
      if (!scheme) break;
      const allies = ports
        .characters(s, e.playerId)
        .filter((c) => !c.startsWith("hero:"));
      if (!allies.length) {
        ports.queue(s, { type: "threat", target: scheme.id, amount: 2 });
        break;
      }
      const best = allies.reduce((a, b) =>
        ports.remainingHP(s, b) > ports.remainingHP(s, a) ? b : a,
      );
      // It leaves play; Abduct Superhumans' Forced Interrupt tucks it.
      ports.allyLeavesPlay(s, best);
      break;
    }
    case "bwv:tuck": {
      // The ally that left play goes under Abduct Superhumans: threat equal
      // to its cost, then an acceleration token.
      const scheme = s.sideSchemes.find((q) => q.id === e.scheme);
      if (!scheme) break;
      const owner = s.players.find((seat) => seat.id === e.ownerId);
      if (!owner || owner.eliminated) break;
      const player = seatView(s, owner.id).player;
      let p: Piece | undefined;
      for (const zone of [player.discard, player.hand, player.deck]) {
        const i = zone.findIndex((q) => q.id === e.id);
        if (i < 0) continue;
        [p] = zone.splice(i, 1);
        break;
      }
      if (!p) break;
      p.ownerId ||= owner.id;
      (scheme.storedCards ||= []).push(p);
      const cost = Math.max(0, Number(def(p)?.cost) || 0);
      ports.log(s, `${name(p)} is tucked under Abduct Superhumans.`, "bad");
      scheme.accelerationTokens = Number(scheme.accelerationTokens || 0) + 1;
      if (cost > 0)
        ports.queue(s, { type: "threat", target: scheme.id, amount: cost });
      break;
    }
    case "bwv:nabbed": {
      // Discard from your deck until an ally, tuck it under Abduct
      // Superhumans with threat equal to its cost and an acceleration token.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        E("ensure-abduct"),
        E("nabbed-dig", { playerId: e.playerId, actorId: e.playerId }),
      );
      break;
    }
    case "bwv:nabbed-dig": {
      const scheme = abduct(s);
      if (!scheme || !alive(s, e.playerId)) break;
      const player = seatView(s, e.playerId).player;
      // Each card of the deck and discard pile at most once: without an
      // ally, the search ends instead of reshuffling forever.
      const limit = player.deck.length + player.discard.length;
      for (let n = 0; n < limit && player.deck.length; n++) {
        const [p] = ports.mill(s, e.playerId, 1);
        if (!p) break;
        if (def(p)?.type_code !== "ally") continue;
        // Discarding the last card reshuffles the discard pile, the ally
        // with it, into a new deck.
        for (const zone of [player.discard, player.deck, player.hand]) {
          const i = zone.findIndex((q) => q.id === p.id);
          if (i >= 0) zone.splice(i, 1);
        }
        p.ownerId ||= e.playerId;
        (scheme.storedCards ||= []).push(p);
        scheme.accelerationTokens = Number(scheme.accelerationTokens || 0) + 1;
        const cost = Math.max(0, Number(def(p)?.cost) || 0);
        ports.log(s, `${name(p)} is tucked under Abduct Superhumans.`, "bad");
        if (cost > 0)
          ports.queue(s, { type: "threat", target: scheme.id, amount: cost });
        break;
      }
      break;
    }
    case "bwv:free": {
      // Each tucked ally enters play under its owner's control.
      for (const id of (e.ids as string[]) || []) {
        for (const seat of s.players) {
          if (seat.eliminated) continue;
          const player = seatView(s, seat.id).player;
          const i = player.discard.findIndex((q) => q.id === id);
          if (i < 0) continue;
          const [p] = player.discard.splice(i, 1);
          ports.putAllyIntoPlay(s, p, seat.id);
          break;
        }
      }
      break;
    }
    case "bwv:soldier": {
      // A.I.M. Scientist enters play engaged with you, or engages you;
      // otherwise 1 threat on the main scheme.
      if (!alive(s, e.playerId)) break;
      const there = s.minions.find((m) => m.code === SCIENTIST);
      if (there) {
        there.engagedWith = e.playerId;
        ports.log(s, "A.I.M. Scientist engages you.", "bad");
        ports.queue(s, { type: "threat", target: "main", amount: 1 });
        break;
      }
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const p = zone.find((q) => q.code === SCIENTIST);
        if (!p) continue;
        ports.putMinion(s, p, e.playerId);
        if (zone === s.encounter.deck) ports.shuffleEncounter(s);
        return true;
      }
      ports.queue(s, { type: "threat", target: "main", amount: 1 });
      break;
    }
    default:
      throw Error(`Unknown Black Widow effect: ${e.type}`);
  }
  return true;
}
