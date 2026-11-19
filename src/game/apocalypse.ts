import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Age of Apocalypse's third scenario, Apocalypse: the eternal tyrant grows
 * stronger each time his main scheme is completed and heals instead of
 * being defeated until the heroes fight through his citadel and prove him
 * No Longer Worthy; with his Prelates and the Dark Riders modular set,
 * which joins any scenario with modular sets. */

export const APOCALYPSE_SCRIPT_CODES = [
  "45101a",
  "45101b",
  "45102a",
  "45102b",
  "45103a",
  "45103b",
  "45104a",
  "45104b",
  "45105a",
  "45105b",
  "45106",
  "45107",
  "45108",
  "45109",
  "45110",
  "45111",
] as const;
export const PRELATE_CODES = [
  "45179b",
  "45180b",
  "45181b",
  "45182b",
  "45183b",
] as const;
export const DARK_RIDERS_CODES = [
  "45112",
  "45113",
  "45114",
  "45115",
  "45116",
  "45117",
] as const;
/** The Dark Riders modular set joins any scenario with modular sets. */
export const APOCALYPSE_MODULAR_SETS = ["dark_riders"] as const;

/** Apocalypse (I) to (IV). */
const STAGES = ["45101a", "45101b", "45102a", "45102b"];
export const AGE_OF_APOCALYPSE = "45103b";
export const HEART_OF_THE_EMPIRE = "45104a";
export const TOWERING_CITADEL = "45104b";
export const TYRANTS_THRONE = "45105a";
export const NO_LONGER_WORTHY = "45105b";
const CYBERPATHY = "45106";
const BIOMORPHING = "45107";
const MOLECULAR_CONTROL = "45108";
const THE_FITTEST = "45109";
const WOLF_AMONG_SHEEP = "45110";
const APOCALYPSE_SOLUTION = "45111";
const GAUNTLET = "45112";
const BARRAGE = "45113";
const HARD_DRIVE = "45114";
const TUSK = "45115";
const PSYNAPSE = "45116";
export const DARK_RIDERS_SCHEME = "45117";
const SHADOW_KING = "45180b";
export const ABYSS = "45181b";
const SUGAR_MAN = "45182b";
const RASPUTIN = "45183b";
/** The three side schemes that lead to the Tyrant's Throne. */
const CITADEL_SCHEMES = [HEART_OF_THE_EMPIRE, TOWERING_CITADEL, TYRANTS_THRONE];
const ATTACH_TO_APOCALYPSE = [CYBERPATHY, BIOMORPHING, MOLECULAR_CONTROL];
const ALL_CODES: readonly string[] = [
  ...APOCALYPSE_SCRIPT_CODES,
  ...PRELATE_CODES,
  ...DARK_RIDERS_CODES,
];

export interface ApocalypseState {
  /** The set-aside Prelate minions. */
  prelates: Piece[];
  /** The set-aside Tyrant's Throne. */
  throne?: Piece;
}

export interface ApocalypsePorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  pick(s: GameState, n: number): number;
  /** Reveal an encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** Discard the top cards of the encounter deck. */
  discardEncounter(s: GameState, n: number): void;
  /** Upgrades the player controls that can be discarded. */
  upgrades(s: GameState, playerId: string): Piece[];
  /** The player's identity and the allies they control. */
  characters(s: GameState, playerId: string): string[];
  allies(s: GameState, playerId: string): Piece[];
  /** An ally's current THW. */
  thwart(s: GameState, id: string): number;
  /** Take the top card of the player's deck, or nothing if it is empty. */
  takeTop(s: GameState, playerId: string): Piece | undefined;
  heal(s: GameState, target: string, n: number): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const A = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `apoc:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const apocalypse = (s: GameState) => !!s.apocalypse;
const apocalypseInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code);
const isApocalypse = (s: GameState, id: string | undefined) =>
  !!id && apocalypseInPlay(s) && s.villain.id === id;
/** The Prelate minions in play. */
export const prelates = (s: GameState) =>
  s.minions.filter((m) => traits(m).includes("Prelate"));
const darkRider = (p: Piece) => traits(p).includes("Dark Riders");
const others = (s: GameState, playerId: string) =>
  playerOrder(s)
    .filter((seat) => !seat.eliminated && seat.id !== playerId)
    .map((seat) => seat.id);
const nlw = (s: GameState) =>
  s.attachments.find(
    (a) =>
      a.code === NO_LONGER_WORTHY &&
      apocalypseInPlay(s) &&
      a.attachedTo === s.villain.id &&
      active(s, a),
  );

// ------------------------------------------------------------------ stages

/** Apocalypse's stage, I to IV. */
export const apocalypseStage = (s: GameState) =>
  apocalypseInPlay(s) ? STAGES.indexOf(s.villain.code) + 1 : 0;
/** X: the numeral in Apocalypse's printed hit point value. */
export const apocalypseX = (s: GameState) =>
  apocalypseInPlay(s) ? def(s.villain)?.health || 0 : 0;
/** The Age of Apocalypse (1B): X threat per player. */
export function apocalypseMainLimit(s: GameState): number | undefined {
  if (!s.apocalypse || s.scheme.code !== AGE_OF_APOCALYPSE) return undefined;
  return apocalypseX(s) * s.playerCount;
}
/** When Apocalypse would be defeated: the players win with No Longer
 * Worthy attached; otherwise The Age of Apocalypse heals him instead. */
export function apocalypseWouldBeDefeated(
  s: GameState,
): "won" | "reset" | null {
  if (!s.apocalypse || !apocalypseInPlay(s)) return null;
  if (nlw(s)) return "won";
  return s.scheme.code === AGE_OF_APOCALYPSE ? "reset" : null;
}
/** Apocalypse's Forced Interrupt when the main scheme is completed: its
 * threat is removed and the next Apocalypse is revealed. */
export function apocalypseMainCompleted(s: GameState): Effect[] | null {
  if (!s.apocalypse || !apocalypseInPlay(s) || !active(s, s.villain))
    return null;
  return apocalypseStage(s) < 4 ? [A("advance")] : null;
}
/** Apocalypse (IV): when the main scheme is completed, the players lose. */
export const apocalypseMainLoses = (s: GameState) =>
  !!s.apocalypse && apocalypseStage(s) === 4;

// ------------------------------------------------------------- interface

/** A stage of Apocalypse as a roman numeral. */
export const apocalypseRoman = (stage: number) =>
  ["I", "II", "III", "IV"][stage - 1] || "";
/** No Longer Worthy is attached to Apocalypse. */
export const noLongerWorthy = (s: GameState) => !!nlw(s);
/** How many of the citadel's three side schemes the players have cleared. */
export function apocalypseCitadel(s: GameState): number {
  const codes = [...s.sideSchemes, ...s.attachments].map((q) => q.code);
  if (codes.includes(NO_LONGER_WORTHY)) return 3;
  if (codes.includes(TYRANTS_THRONE)) return 2;
  if (codes.includes(TOWERING_CITADEL)) return 1;
  if (codes.includes(HEART_OF_THE_EMPIRE)) return 0;
  return s.apocalypse?.throne ? 1 : 3;
}
/** The line under Apocalypse's stats. */
export function apocalypseCaption(s: GameState): string {
  if (!noLongerWorthy(s))
    return `At 0 he heals and the main scheme loses ${apocalypseX(s)} threat`;
  return prelates(s).length
    ? "No Longer Worthy · no damage while a Prelate is in play"
    : "No Longer Worthy · defeat him to win";
}
/** What each of the citadel's side schemes leads to. */
export const CITADEL_NEXT: Record<string, string> = {
  [HEART_OF_THE_EMPIRE]: "The Towering Citadel",
  [TOWERING_CITADEL]: "The Tyrant's Throne",
  [TYRANTS_THRONE]: "No Longer Worthy",
};

// --------------------------------------------------------------- setup

/** The cards that start out of the encounter deck: the citadel's side
 * schemes, No Longer Worthy and the Prelates. */
export const apocalypseSetupCard = (code: string) =>
  [
    HEART_OF_THE_EMPIRE,
    TOWERING_CITADEL,
    TYRANTS_THRONE,
    NO_LONGER_WORTHY,
  ].includes(code) || (PRELATE_CODES as readonly string[]).includes(code);
/** The Age of Apocalypse (1A): set aside the Prelates and The Tyrant's
 * Throne, and reveal Heart of the Empire. */
export function apocalypseSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
): void {
  const heart = ports.makePiece(s, HEART_OF_THE_EMPIRE);
  heart.counters = def(HEART_OF_THE_EMPIRE)?.base_threat || 0;
  s.sideSchemes.push(heart);
  s.apocalypse = {
    prelates: PRELATE_CODES.map((code) => ports.makePiece(s, code)),
    throne: ports.makePiece(s, TYRANTS_THRONE),
  };
  s.villain.stage = apocalypseStage(s);
  s.scheme.threat = (def(AGE_OF_APOCALYPSE)?.base_threat || 0) * s.playerCount;
}
/** The first player reveals a random set-aside Prelate. */
export function apocalypseSetupEffects(s: GameState): Effect[] {
  return s.apocalypse ? [A("prelate", { actorId: s.firstPlayerId })] : [];
}

// ------------------------------------------------------------ modifiers

/** The Fittest: +5 hit points. Abyss: +2 for each facedown card. */
export function apocalypseHealth(s: GameState, p: Piece): number {
  let n =
    5 *
    s.attachments.filter(
      (a) => a.code === THE_FITTEST && a.attachedTo === p.id && active(s, a),
    ).length;
  if (p.code === ABYSS && s.minions.some((m) => m.id === p.id) && active(s, p))
    n += 2 * (p.storedCards?.length || 0);
  return n;
}
/** Molecular Control: retaliate 1 and stalwart. The Dark Riders: each Dark
 * Riders minion gains toughness. */
export function apocalypseKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (
    isApocalypse(s, p.id) &&
    (keyword === "Retaliate" || keyword === "Stalwart")
  )
    return s.attachments.some(
      (a) =>
        a.code === MOLECULAR_CONTROL && a.attachedTo === p.id && active(s, a),
    )
      ? 1
      : 0;
  if (
    keyword === "Toughness" &&
    darkRider(p) &&
    s.minions.some((m) => m.id === p.id) &&
    s.sideSchemes.some((q) => q.code === DARK_RIDERS_SCHEME && active(s, q))
  )
    return 1;
  return 0;
}
/** No Longer Worthy: Apocalypse cannot take damage while a Prelate minion
 * is in play. */
export const apocalypseImmune = (s: GameState, target: string) =>
  isApocalypse(s, target) && !!nlw(s) && prelates(s).length > 0;
/** Heart of the Empire, The Towering Citadel and The Tyrant's Throne:
 * threat cannot be removed while a Prelate minion is in play. */
export function apocalypseThwartLocked(s: GameState, target: string) {
  const p = s.sideSchemes.find((q) => q.id === target);
  return (
    !!p &&
    CITADEL_SCHEMES.includes(p.code) &&
    active(s, p) &&
    prelates(s).length > 0
  );
}
/** Prelates go to the victory display (Victory 3). */
export const apocalypseVictoryMinion = (p: Piece) =>
  (PRELATE_CODES as readonly string[]).includes(p.code);

// ----------------------------------------------------------------- reveals

export function apocalypseReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (ATTACH_TO_APOCALYPSE.includes(p.code))
    return resolving ? [A("attach", { piece: p })] : [];
  if (p.code === THE_FITTEST)
    return resolving ? [A("fittest", { piece: p, id: p.id })] : [];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case WOLF_AMONG_SHEEP:
      return [A("wolf", { playerId })];
    case DARK_RIDERS_SCHEME:
      return [A("dark-riders", { playerId })];
    default:
      return [];
  }
}
export function apocalypseBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![...ATTACH_TO_APOCALYPSE, WOLF_AMONG_SHEEP, TUSK, PSYNAPSE].includes(
      p.code,
    )
  )
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  if (ATTACH_TO_APOCALYPSE.includes(p.code))
    return apocalypseInPlay(s) ? [A("attach-boost", { id: p.id })] : [];
  switch (p.code) {
    case WOLF_AMONG_SHEEP: {
      // A tough status card for the Prelate minion, otherwise Apocalypse.
      const prelate = prelates(s)[0];
      const target = prelate?.id || (apocalypseInPlay(s) && s.villain.id);
      return target ? [{ type: "status", target, status: "tough" }] : [];
    }
    case TUSK:
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
      ];
    case PSYNAPSE:
      return [
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: playerId,
        },
      ];
    default:
      return [];
  }
}

// ----------------------------------------------------------------- windows

/** Cyberpathy: after Apocalypse schemes, 1 threat on each side scheme. */
export function apocalypseSchemed(s: GameState, id: string): Effect[] {
  if (
    !isApocalypse(s, id) ||
    !s.attachments.some(
      (a) => a.code === CYBERPATHY && a.attachedTo === id && active(s, a),
    )
  )
    return [];
  return s.sideSchemes.map((q) => ({
    type: "threat",
    target: q.id,
    amount: 1,
  }));
}
/** Biomorphing and Apocalypse (IV): his attacks gain overkill. Sugar Man:
 * piercing. Mikhail Rasputin: 1 damage to your identity. */
export function apocalypseAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const a = s.attack;
  if (!a) return [];
  if (
    isApocalypse(s, attackerId) &&
    (s.attachments.some(
      (q) =>
        q.code === BIOMORPHING && q.attachedTo === attackerId && active(s, q),
    ) ||
      (s.villain.code === "45102b" && active(s, s.villain)))
  )
    a.overkill = true;
  const m = s.minions.find((q) => q.id === attackerId);
  if (!m || !active(s, m)) return [];
  if (m.code === SUGAR_MAN) {
    a.piercing = true;
    return [];
  }
  if (m.code === RASPUTIN && alive(s, playerId))
    return [
      {
        type: "damage",
        target: "hero",
        amount: 1,
        source: m.id,
        actorId: playerId,
      },
    ];
  return [];
}
/** Forced Responses after an enemy attacks you: the Dark Riders, The
 * Shadow King and Sugar Man. */
export function apocalypseAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
  defeatedCharacter: boolean,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  if (!m || !active(s, m) || !alive(s, playerId)) return [];
  switch (m.code) {
    case GAUNTLET:
      return [A("gauntlet", { playerId, actorId: playerId })];
    case BARRAGE:
      return [A("barrage", { playerId })];
    case HARD_DRIVE:
      return [
        { type: "threat", target: "main", amount: 1 },
        ...s.sideSchemes.map((q) => ({
          type: "threat",
          target: q.id,
          amount: 1,
        })),
      ];
    case TUSK:
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
      ];
    case PSYNAPSE:
      return [
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: playerId,
        },
      ];
    case SHADOW_KING:
      return [A("shadow-king", { playerId, actorId: playerId })];
    case SUGAR_MAN:
      return defeatedCharacter ? [A("sugar-heal", { id: m.id })] : [];
    default:
      return [];
  }
}
/** Abyss: after he activates against you, the top card of your deck is
 * attached to him facedown. */
export function apocalypseActivated(
  s: GameState,
  id: string,
  playerId: string,
): Effect[] {
  const m = s.minions.find((q) => q.id === id);
  return m?.code === ABYSS && active(s, m) && alive(s, playerId)
    ? [A("abyss", { id: m.id, playerId })]
    : [];
}
/** Teamwork (Dark Riders): the entrant activates if another Dark Rider is
 * in play. */
export function apocalypseEngaged(s: GameState, p: Piece): Effect[] {
  if (!darkRider(p) || !active(s, p)) return [];
  return [A("teamwork", { id: p.id })];
}
/** When Defeated: the citadel's side schemes and The Apocalypse Solution. */
export function apocalypseSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (!s.apocalypse && p.code !== APOCALYPSE_SOLUTION) return [];
  switch (p.code) {
    case HEART_OF_THE_EMPIRE:
    case TOWERING_CITADEL:
    case TYRANTS_THRONE:
      return [
        A("prelate", { actorId: s.firstPlayerId }),
        ...others(s, s.firstPlayerId).map((playerId) =>
          A("deal", { playerId }),
        ),
        A("citadel", { id: p.id, code: p.code }),
      ];
    case APOCALYPSE_SOLUTION:
      return apocalypseX(s) > 0 ? [A("solution", { n: apocalypseX(s) })] : [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------- resolver

/** Move a defeated citadel card out of whichever zone it went to. */
function recover(s: GameState, id: string): Piece | undefined {
  for (const zone of [
    s.encounter.discard,
    s.removed,
    s.victoryDisplay || [],
    s.resolving,
  ]) {
    const i = zone.findIndex((q) => q.id === id);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  return undefined;
}
function enterScheme(s: GameState, p: Piece, code: string) {
  p.code = code;
  p.counters = def(code)?.base_threat || 0;
  p.exhausted = false;
  p.damage = 0;
  s.sideSchemes.push(p);
}

export function resolveApocalypseEffect(
  s: GameState,
  e: Effect,
  ports: ApocalypsePorts,
): boolean {
  if (!e.type.startsWith("apoc:")) return false;
  const st = s.apocalypse;
  switch (e.type) {
    case "apoc:advance": {
      // Remove all threat from the main scheme and reveal the next
      // Apocalypse.
      if (!apocalypseInPlay(s) || over(s)) break;
      const i = STAGES.indexOf(s.villain.code);
      if (i < 0 || i >= STAGES.length - 1) break;
      s.scheme.threat = 0;
      const code = STAGES[i + 1];
      s.villain.code = code;
      s.villain.stage = i + 2;
      s.villain.maxHp = (def(code)?.health || 0) * s.playerCount;
      s.villain.hp = s.villain.maxHp;
      ports.log(
        s,
        `The Age of Apocalypse is complete: ${name(code)} (${["I", "II", "III", "IV"][i + 1]}) rises.`,
        "bad",
      );
      // Toughness.
      ports.queue(s, { type: "status", target: s.villain.id, status: "tough" });
      break;
    }
    case "apoc:prelate": {
      // The first player reveals a random set-aside Prelate.
      if (!st || !st.prelates.length || over(s)) break;
      const i = ports.pick(s, st.prelates.length);
      const p = st.prelates.splice(i, 1)[0];
      ports.reveal(s, p, s.firstPlayerId);
      break;
    }
    case "apoc:deal":
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      break;
    case "apoc:citadel": {
      // Heart of the Empire flips to The Towering Citadel; the Citadel
      // reveals The Tyrant's Throne; the Throne flips to No Longer Worthy.
      const p = recover(s, e.id);
      if (!st) break;
      if (e.code === HEART_OF_THE_EMPIRE && p) {
        enterScheme(s, p, TOWERING_CITADEL);
        ports.log(s, "Heart of the Empire flips: The Towering Citadel.", "bad");
      } else if (e.code === TOWERING_CITADEL) {
        if (p) s.removed.push(p);
        const throne = st.throne;
        if (throne) {
          delete st.throne;
          enterScheme(s, throne, TYRANTS_THRONE);
          ports.log(s, "The Tyrant's Throne is revealed.", "bad");
        }
      } else if (e.code === TYRANTS_THRONE && p) {
        // No Longer Worthy attaches to Apocalypse and heals him.
        p.code = NO_LONGER_WORTHY;
        p.counters = 0;
        if (apocalypseInPlay(s)) {
          ports.attach(s, p, s.villain.id);
          ports.heal(s, s.villain.id, 5 * s.playerCount);
          ports.log(s, "No Longer Worthy attaches to Apocalypse.", "good");
        } else s.encounter.discard.push(p);
      }
      break;
    }
    case "apoc:attach": {
      const p = e.piece as Piece;
      if (apocalypseInPlay(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "apoc:attach-boost": {
      // A Superpower boost attaches to Apocalypse; the activation keeps it.
      const activation = s.scheming || s.attack;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p || !activation || !apocalypseInPlay(s)) break;
      if (!activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "apoc:fittest": {
      // The minion with the highest printed hit points, and a tough status
      // card; otherwise surge.
      const p = e.piece as Piece;
      if (!s.minions.length) {
        ports.queue(s, {
          type: "surge",
          sourceCode: THE_FITTEST,
          sourceId: e.id,
        });
        ports.discardPiece(s, e.id);
        break;
      }
      const printed = (m: Piece) => def(m)?.health || 0;
      const top = Math.max(...s.minions.map(printed));
      const targets = s.minions.filter((m) => printed(m) === top);
      const attach = (m: Piece): Effect[] => [
        A("fittest-attach", { piece: p, target: m.id }),
        { type: "status", target: m.id, status: "tough" },
      ];
      if (targets.length === 1) ports.queue(s, ...attach(targets[0]));
      else
        ports.choose(
          s,
          name(THE_FITTEST),
          "Attach The Fittest to the minion with the highest printed hit points.",
          targets.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: attach(m),
          })),
        );
      break;
    }
    case "apoc:fittest-attach":
      if (s.minions.some((m) => m.id === e.target))
        ports.attach(s, e.piece as Piece, e.target);
      else ports.discardPiece(s, (e.piece as Piece).id);
      break;
    case "apoc:wolf": {
      // The Prelate minion activates against you; otherwise Apocalypse.
      if (!alive(s, e.playerId) || over(s)) break;
      const kind =
        seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme";
      const list = prelates(s);
      const go = (id: string): Effect => ({
        type: kind === "attack" ? "enemyAttack" : "enemyScheme",
        id,
        actorId: e.playerId,
      });
      if (list.length === 1) ports.queue(s, go(list[0].id));
      else if (list.length)
        ports.choose(
          s,
          name(WOLF_AMONG_SHEEP),
          "Choose the Prelate minion that activates against you.",
          list.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [go(m.id)],
          })),
        );
      else if (apocalypseInPlay(s)) ports.queue(s, go(s.villain.id));
      break;
    }
    case "apoc:solution":
      // The Apocalypse Solution: discard the top X encounter cards.
      ports.discardEncounter(s, Number(e.n));
      break;
    case "apoc:dark-riders":
      // The Dark Riders: discard cards from the encounter deck until a
      // Dark Riders minion is discarded, and reveal it.
      if (!alive(s, e.playerId)) break;
      for (let n = 0; n < 200; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && darkRider(piece) && def(piece)?.type_code === "minion") {
          ports.reveal(s, piece, e.playerId);
          break;
        }
        if (!piece || emptied) break;
      }
      break;
    case "apoc:teamwork": {
      const live = s.minions.filter((m) => !m.pendingDefeat && darkRider(m));
      const entered = live.find((m) => m.id === e.id);
      if (!entered || !active(s, entered) || live.length < 2) break;
      const playerId = entered.engagedWith || s.activePlayerId;
      if (!alive(s, playerId)) break;
      ports.activate(s, {
        enemyId: entered.id,
        playerId,
        kind:
          seatView(s, playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "apoc:gauntlet": {
      // Discard an upgrade you control.
      if (!alive(s, e.playerId)) break;
      const cards = ports.upgrades(s, e.playerId);
      if (cards.length === 1)
        ports.queue(s, { type: "discardPiece", id: cards[0].id });
      else if (cards.length)
        ports.choose(
          s,
          name(GAUNTLET),
          "Discard an upgrade you control.",
          cards.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [{ type: "discardPiece", id: q.id }],
          })),
        );
      break;
    }
    case "apoc:barrage":
      // 1 damage to each character you control.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        ...ports.characters(s, e.playerId).map((target) => ({
          type: "damage",
          target,
          amount: 1,
          source: BARRAGE,
          actorId: e.playerId,
        })),
      );
      break;
    case "apoc:shadow-king": {
      // The ally you control with the highest THW: discard it, or place
      // threat on the main scheme equal to its THW.
      if (!alive(s, e.playerId)) break;
      const allies = ports.allies(s, e.playerId);
      if (!allies.length) break;
      const top = Math.max(...allies.map((q) => ports.thwart(s, q.id)));
      const options: Option[] = allies
        .filter((q) => ports.thwart(s, q.id) === top)
        .flatMap((q) => [
          {
            id: `${q.id}:discard`,
            label: `Discard ${name(q)}`,
            image: q.code,
            effects: [{ type: "discardPiece", id: q.id }],
          },
          {
            id: `${q.id}:threat`,
            label: `Place ${top} threat on the main scheme`,
            image: q.code,
            effects:
              top > 0 ? [{ type: "threat", target: "main", amount: top }] : [],
          },
        ]);
      ports.choose(s, name(SHADOW_KING), "Choose one.", options);
      break;
    }
    case "apoc:sugar-heal":
      if (s.minions.some((m) => m.id === e.id)) ports.heal(s, e.id, 5);
      break;
    case "apoc:abyss": {
      // The top card of your deck is attached to Abyss facedown.
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, e.playerId)) break;
      const p = ports.takeTop(s, e.playerId);
      if (p) (m.storedCards ||= []).push(p);
      break;
    }
    default:
      throw Error(`Unknown Apocalypse effect: ${e.type}`);
  }
  return true;
}
