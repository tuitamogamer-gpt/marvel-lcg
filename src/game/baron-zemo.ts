import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** Agents of S.H.I.E.L.D.'s fifth scenario: the players gather the evidence
 * that exposes the mole on the S.H.I.E.L.D. Executive Board while Baron Zemo
 * sways its members, then accuse one of them and fight Zemo unmasked. With
 * the S.H.I.E.L.D. modular set and the S.H.I.E.L.D. Executive Board set,
 * which any other scenario can also add. */

export const BARON_ZEMO_CODES = [
  "50165a",
  "50165b",
  "50166a",
  "50166b",
  "50167a",
  "50167b",
  "50168a",
  "50168b",
  "50169a",
  "50169b",
  "50170",
  "50171",
  "50172",
  "50173",
  "50174",
  "50175",
  "50176",
  "50177",
] as const;
export const SHIELD_CODES = ["50178", "50179", "50180"] as const;
export const EXECUTIVE_BOARD_CODES = [
  "50181a",
  "50181b",
  "50182a",
  "50182b",
  "50183a",
  "50183b",
  "50184a",
  "50184b",
  "50184c",
] as const;
export const EVIDENCE_CODES = [
  "50185",
  "50186",
  "50187",
  "50188",
  "50189",
  "50190",
  "50191",
  "50192",
  "50193",
] as const;
/** The S.H.I.E.L.D. modular set; the Executive Board is added on its own. */
export const ZEMO_MODULAR_SETS = ["s.h.i.e.l.d."] as const;
export const EXECUTIVE_BOARD_SET = "s.h.i.e.l.d._executive_board";
/** Arrest Warrant stays in its player's play area. */
export const ZEMO_IN_PLAY_OBLIGATIONS = ["50179"] as const;
const ALL_CODES: readonly string[] = [
  ...BARON_ZEMO_CODES,
  ...SHIELD_CODES,
  ...EXECUTIVE_BOARD_CODES,
  ...EVIDENCE_CODES,
];
/** Every face this module scripts. */
export const ZEMO_CODES = ALL_CODES;

/** Baron Zemo (A1) and (B1), each unmasked on its back. */
const MASKED: Record<string, string> = {
  "50165a": "50165b",
  "50166a": "50166b",
};
const ZEMOS = ["50165a", "50165b", "50166a", "50166b"];
export const MANIPULATIONS = "50167b";
const ACCUSATION_A = "50168a";
const ACCUSATION_B = "50168b";
const FIGHTING_A = "50169a";
export const FIGHTING_B = "50169b";
export const SWORD = "50170";
export const FOE = "50171";
const AGENT = "50172";
const DIVIDED = "50173";
const UNDERMINE = "50174";
const WITS = "50175";
const MIGHT = "50176";
const ENDS = "50177";
const TROOPER = "50178";
export const WARRANT = "50179";
const DISAVOWED = "50180";
/** The Board Member environments, their attachment sides and the resource
 * their Hero Action spends. */
export const BOARD: Record<
  string,
  { back: string; key: "CMO" | "CSO" | "CTO"; cost: Resource }
> = {
  "50181a": { back: "50181b", key: "CMO", cost: "energy" },
  "50182a": { back: "50182b", key: "CSO", cost: "mental" },
  "50183a": { back: "50183b", key: "CTO", cost: "physical" },
};
export const BOARD_BACKS = ["50181b", "50182b", "50183b"];
const INTERFERENCE: Record<string, Resource> = {
  "50184a": "energy",
  "50184b": "mental",
  "50184c": "physical",
};
/** The evidence: means, motives and opportunities. */
export const MEANS = ["50185", "50186", "50187"];
export const MOTIVES = ["50188", "50189", "50190"];
export const OPPORTUNITIES = ["50191", "50192", "50193"];
/** The campaign log's evidence combinations, each implicating one board
 * member: means, motive, opportunity and the board member's environment. */
export const COMBINATIONS: readonly [string, string, string, string][] = [
  ["50185", "50188", "50191", "50181a"],
  ["50185", "50188", "50192", "50181a"],
  ["50185", "50189", "50191", "50181a"],
  ["50185", "50189", "50193", "50181a"],
  ["50185", "50190", "50192", "50181a"],
  ["50186", "50188", "50191", "50181a"],
  ["50186", "50188", "50192", "50181a"],
  ["50186", "50189", "50191", "50181a"],
  ["50187", "50188", "50191", "50181a"],
  ["50185", "50189", "50192", "50182a"],
  ["50186", "50188", "50193", "50182a"],
  ["50186", "50189", "50192", "50182a"],
  ["50186", "50189", "50193", "50182a"],
  ["50186", "50190", "50191", "50182a"],
  ["50186", "50190", "50192", "50182a"],
  ["50187", "50189", "50192", "50182a"],
  ["50187", "50189", "50193", "50182a"],
  ["50187", "50190", "50192", "50182a"],
  ["50185", "50188", "50193", "50183a"],
  ["50185", "50190", "50191", "50183a"],
  ["50185", "50190", "50193", "50183a"],
  ["50186", "50190", "50193", "50183a"],
  ["50187", "50188", "50192", "50183a"],
  ["50187", "50188", "50193", "50183a"],
  ["50187", "50189", "50191", "50183a"],
  ["50187", "50190", "50191", "50183a"],
  ["50187", "50190", "50193", "50183a"],
];

export interface ZemoState {
  currentMain: Piece;
  /** The Accusation and Fighting Zemo, still to come. */
  mainDeck: Piece[];
  /** The A.I.M. envelope: the mole's means, motive and opportunity. */
  aim: Piece[];
  /** The S.H.I.E.L.D. envelope: the other six evidence cards, facedown. */
  shield: Piece[];
  /** The evidence cards the players have gained, faceup. */
  gained: Piece[];
  accusation?: {
    means: string;
    motive: string;
    opportunity: string;
    member: string;
  };
}
/** The S.H.I.E.L.D. Executive Board in play: the board members who have
 * joined the villain, flipped to their attachment sides. They stay attached
 * to whichever villain is in play. */
export interface ExecutiveBoardState {
  joined: Piece[];
}

export interface ZemoPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  heal(s: GameState, target: string, n: number): void;
  characters(s: GameState, playerId: string): string[];
  remainingHP(s: GameState, id: string): number;
  shuffle<T>(s: GameState, items: T[]): T[];
  /** Advance the main scheme to its next stage. */
  advanceMain(s: GameState): void;
  /** Defeat a minion, as by Baron Zemo. */
  defeat(s: GameState, id: string): void;
  makePiece(s: GameState, code: string): Piece;
  /** The heroes in the players' collection, by hero card code. */
  heroCodes(s: GameState): string[];
  endGame(s: GameState, won: boolean, reason: string): void;
  heroName(s: GameState, playerId: string): string;
  /** A friendly character has damage to heal. */
  damaged(s: GameState, id: string): boolean;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const Z = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zemo:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const seats = (s: GameState) => playerOrder(s).filter((x) => !x.eliminated);
const activation = (s: GameState) => s.scheming || s.attack;
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
const over = (s: GameState) => ["won", "lost"].includes(s.phase);
const permanent = (p: Piece) => {
  const c = def(p) as (Card & { permanent?: boolean }) | undefined;
  return (
    c?.permanent === true ||
    /(?:^|[.\n])\s*Permanent\b/.test((c?.text || "").replace(/<[^>]*>/g, ""))
  );
};
/** The S.H.I.E.L.D. trait holds periods of its own, so it is matched whole. */
const shieldCard = (p: Piece) =>
  (def(p)?.traits || "").includes("S.H.I.E.L.D.");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const zemoInPlay = (s: GameState) =>
  !!s.villain && ZEMOS.includes(s.villain.code) && active(s, s.villain);
const unmasked = (s: GameState) => zemoInPlay(s) && !MASKED[s.villain.code];
/** A Board Member flips with 4 secret counters (3 in Expert). */
const turnsAt = (s: GameState) => (s.difficulty === "expert" ? 3 : 4);
/** The Board Member environments in play. */
export const boardEnvironments = (s: GameState) =>
  (s.environments || []).filter((p) => BOARD[p.code]);
/** The board members who joined the villain. */
export const boardAttachments = (s: GameState) =>
  s.executiveBoard?.joined || [];
const boardCards = (s: GameState) => [
  ...boardEnvironments(s),
  ...boardAttachments(s),
];
/** The combinations evidence has not yet crossed out. */
export function remainingCombinations(s: GameState) {
  const gained = new Set((s.zemo?.gained || []).map((p) => p.code));
  return COMBINATIONS.filter(
    ([a, b, c]) => !gained.has(a) && !gained.has(b) && !gained.has(c),
  );
}
/** The mole: the board member the A.I.M. envelope implicates. */
export function moleCombination(s: GameState) {
  const aim = new Set((s.zemo?.aim || []).map((p) => p.code));
  return COMBINATIONS.find(
    ([a, b, c]) => aim.has(a) && aim.has(b) && aim.has(c),
  );
}
/** The board members the remaining combinations still implicate. */
export function suspects(s: GameState) {
  return [...new Set(remainingCombinations(s).map((c) => c[3]))];
}

// ------------------------------------------------------------- interface

export function zemoCaption(s: GameState) {
  if (!s.zemo || !s.villain || !ZEMOS.includes(s.villain.code)) return "";
  if (MASKED[s.villain.code])
    return "At 0 hit points he resets instead and 3 secret counters come off the board members";
  const n = s.villain.code === "50166b" ? 2 : 1;
  return `When he activates against you: ${plural(n, "secret counter")} on a board member, or another boost card`;
}
export function zemoObjective(s: GameState) {
  if (!s.zemo) return "";
  if (s.scheme.code === FIGHTING_B) return "Defeat Baron Zemo, unmasked";
  const left = remainingCombinations(s).length;
  const members = suspects(s).length;
  return `Expose the mole · ${plural(left, "combination")} left · ${plural(members, "suspect")}`;
}
/** Zemo's Manipulations: the evidence gained and the cards left in the
 * S.H.I.E.L.D. envelope; Fighting Zemo: its completion loses. */
export function zemoMainNote(s: GameState) {
  if (!s.zemo) return "";
  if (s.scheme.code === MANIPULATIONS) {
    const gained = s.zemo.gained.map((p) => name(p));
    return `${gained.length ? `Evidence: ${gained.join(", ")}` : "No evidence yet"} · ${s.zemo.shield.length} in the S.H.I.E.L.D. envelope`;
  }
  if (s.scheme.code === FIGHTING_B) return "Completed: the players lose";
  return "";
}
/** A board member's secret counters, and in Baron Zemo the evidence
 * combinations that still implicate it. */
export function boardCaption(s: GameState, p: Piece) {
  const n = p.counters || 0;
  if (!BOARD[p.code]) return plural(n, "secret counter");
  const left =
    s.zemo && s.scheme.code === MANIPULATIONS
      ? ` · ${plural(remainingCombinations(s).filter((c) => c[3] === p.code).length, "combination")}`
      : "";
  return `${plural(n, "secret counter")} · joins the villain at ${turnsAt(s)}${left}`;
}
/** The advisor accuses once the evidence names a single board member, the
 * S.H.I.E.L.D. envelope is empty or the scheme is about to be completed. */
export function zemoShouldAccuse(s: GameState, threatLimit: number) {
  if (!s.zemo || s.scheme.code !== MANIPULATIONS) return false;
  return (
    suspects(s).length <= 1 ||
    !s.zemo.shield.length ||
    // Escalation, Zemo's scheme and a boost could complete it next round.
    (threatLimit > 0 && s.scheme.threat + 4 * s.playerCount + 4 >= threatLimit)
  );
}

// --------------------------------------------------------------- setup

/** Zemo's Manipulations (1A): prepare the evidence, then each board member
 * enters play with 2 secret counters. */
export function zemoSetup(
  s: GameState,
  ports: Pick<ZemoPorts, "putEnvironment" | "shuffle" | "makePiece">,
) {
  const aim: Piece[] = [];
  const shield: Piece[] = [];
  for (const group of [MEANS, MOTIVES, OPPORTUNITIES]) {
    const [mole, ...rest] = ports.shuffle(
      s,
      group.map((code) => ports.makePiece(s, code)),
    );
    aim.push(mole);
    shield.push(...rest);
  }
  s.zemo = {
    currentMain: ports.makePiece(s, MANIPULATIONS),
    mainDeck: [
      ports.makePiece(s, ACCUSATION_A),
      ports.makePiece(s, FIGHTING_A),
    ],
    aim,
    shield: ports.shuffle(s, shield),
    gained: [],
  };
  boardSetup(s, ports);
  const main = def(MANIPULATIONS);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
  // Baron Zemo's hit points have no per-player value.
  const hp = def(s.villain.code)?.health || 0;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
}
/** The S.H.I.E.L.D. Executive Board: each board member enters play with 2
 * secret counters. Outside Baron Zemo the set does not count as a modular
 * set. */
export function boardSetup(
  s: GameState,
  ports: Pick<ZemoPorts, "putEnvironment" | "makePiece">,
) {
  if (s.executiveBoard) return;
  s.executiveBoard = { joined: [] };
  for (const code of Object.keys(BOARD)) {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    const p =
      i >= 0 ? s.encounter.deck.splice(i, 1)[0] : ports.makePiece(s, code);
    p.counters = 2;
    ports.putEnvironment(s, p);
  }
  s.encounter.deck = s.encounter.deck.filter(
    (p) => !BOARD[p.code] && !BOARD_BACKS.includes(p.code),
  );
}

// ------------------------------------------------------------ the villain

/** Baron Zemo's Forced Interrupt when he would be defeated: masked, his hit
 * points reset to 12 (16 in Expert) instead and 3 secret counters come off
 * the board members. Unmasked, the players win. */
export function zemoWouldBeDefeated(s: GameState): Effect[] | "won" | null {
  if (!s.zemo || !s.villain || !ZEMOS.includes(s.villain.code)) return null;
  if (!MASKED[s.villain.code] || !active(s, s.villain)) return "won";
  const hp = def(s.villain.code)?.health || 0;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
  s.villain.damage = 0;
  return [Z("unsecret", { n: 3, actorId: s.firstPlayerId })];
}
/** Forced Interrupts when an enemy activates: S.H.I.E.L.D. Agent places a
 * secret counter on the board member with the fewest, and unmasked Baron
 * Zemo places 1 (2 in Expert) on a board member or gets another boost card. */
export function zemoActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
  kind: "attack" | "scheme",
): Effect[] {
  if (!alive(s, playerId) || over(s)) return [];
  const agent = s.minions.find((m) => m.id === enemyId);
  if (agent?.code === AGENT && active(s, agent))
    return [Z("secret-fewest", { n: 1, actorId: s.firstPlayerId })];
  if (!s.zemo || enemyId !== s.villain?.id || !unmasked(s)) return [];
  return [Z("unmasked", { playerId, kind, actorId: playerId })];
}
/** Additional boost cards chosen before the attack's boosts are dealt. */
export function zemoAdditionalBoosts(s: GameState) {
  const n = Number(s.flags.zemoExtraBoosts || 0);
  delete s.flags.zemoExtraBoosts;
  return n;
}
/** Baron Zemo's Sword's Forced Response after he attacks and defeats a
 * character. */
export function zemoAttacked(
  s: GameState,
  attackerId: string,
  defeated: boolean,
): Effect[] {
  if (!defeated || attackerId !== s.villain?.id || over(s)) return [];
  return s.attachments.some(
    (a) => a.code === SWORD && a.attachedTo === attackerId && active(s, a),
  )
    ? [Z("secret-fewest", { n: 1, actorId: s.firstPlayerId })]
    : [];
}
/** When defeated: S.H.I.E.L.D. Agent and S.H.I.E.L.D. Trooper. */
export function zemoMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
): Effect[] {
  if (textWasBlank || over(s)) return [];
  if (m.code === AGENT)
    return [Z("secret-fewest", { n: 1, actorId: s.firstPlayerId })];
  if (m.code === TROOPER) {
    const playerId =
      m.engagedWith && alive(s, m.engagedWith)
        ? m.engagedWith
        : s.activePlayerId;
    return [Z("trooper", { playerId, actorId: playerId })];
  }
  return [];
}
/** Reluctant Foe's hero is removed from the game with it when defeated. */
export const zemoRemovedWhenDefeated = (p: Piece) => !!p.reluctantFoe;
/** Reluctant Foe leaves with its hero, removed from the game. */
export function zemoFoeLeaving(s: GameState, p: Piece) {
  const foes = s.attachments.filter(
    (a) => a.code === FOE && a.attachedTo === p.id,
  );
  s.attachments = s.attachments.filter((a) => !foes.includes(a));
  s.removed.push(...foes);
}
/** When Defeated: Divided Loyalties and Undermine Support. */
export function zemoSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if ((p.code !== DIVIDED && p.code !== UNDERMINE) || !active(s, p)) return [];
  return [Z("unsecret", { n: s.playerCount, actorId: s.firstPlayerId })];
}
/** Disavowed: each S.H.I.E.L.D. card costs 1 more to play. */
export function zemoCostIncrease(
  s: GameState,
  c: Pick<Card, "traits">,
): number {
  if (!(c.traits || "").includes("S.H.I.E.L.D.")) return 0;
  return s.sideSchemes.filter((p) => p.code === DISAVOWED && active(s, p))
    .length;
}
/** Divided Loyalties: attacking, thwarting or defending with an ally costs 1
 * more resource. */
export const zemoAllyCost = (s: GameState) =>
  s.sideSchemes.filter((p) => p.code === DIVIDED && active(s, p)).length;
/** Undermine Support: readying a support costs 1 resource. */
export const zemoSupportCost = (s: GameState) =>
  s.sideSchemes.filter((p) => p.code === UNDERMINE && active(s, p)).length;
/** The players lose with all three board members on the villain's side. */
export function zemoCheck(
  s: GameState,
  ports: Pick<ZemoPorts, "endGame">,
): boolean {
  if (over(s) || boardAttachments(s).length < 3) return false;
  ports.endGame(
    s,
    false,
    "All three board members have joined the villain. The heroes stand accused.",
  );
  return true;
}
/** Undermine Support in the ready step: each exhausted support readies only
 * if its player spends 1 resource. */
export function zemoReadySupports(
  s: GameState,
  playerId: string,
  ids: string[],
): Effect[] {
  return ids.length
    ? [Z("ready-support", { ids, playerId, actorId: playerId })]
    : [];
}

// --------------------------------------------------------- main scheme

/** Stage 1B's Response after the player phase ends. */
export function zemoPlayerPhaseEnded(s: GameState): Effect[] {
  return s.zemo && s.scheme.code === MANIPULATIONS && !over(s)
    ? [Z("respond", { actorId: s.firstPlayerId })]
    : [];
}
/** The next main scheme stage's A side, for the engine to put in play. */
export function zemoNextMain(s: GameState): Piece | undefined {
  return s.zemo?.mainDeck.shift();
}
/** When Revealed: The Accusation, then Fighting Zemo. */
export function zemoMainRevealed(s: GameState, p: Piece): Effect[] {
  if (p.code === ACCUSATION_A)
    return [Z("accuse", { step: "means" }), Z("judge")];
  if (p.code === FIGHTING_A) return [Z("unmask"), Z("fight")];
  return [];
}

// ---------------------------------------------------------- Battle of Wits

/** The player whose Battle of Wits made Baron Zemo scheme. */
export function zemoWitsPlayer(s: GameState): string | undefined {
  const after = s.scheming?.activationAfter;
  return after?.type === "zemo:wits-after" ? String(after.playerId) : undefined;
}
/** Battle of Wits: before its scheme's threat is placed on the main scheme,
 * spend mental resources one at a time to prevent it and remove secret
 * counters. */
export function zemoThreatOptions(
  s: GameState,
  e: Effect,
  ports: Pick<ZemoPorts, "canPay">,
): Option[] {
  const playerId = e.zemoWits as string | undefined;
  if (
    !playerId ||
    e.zemoWitsDone ||
    (e.target || "main") !== "main" ||
    !(Number(e.amount) > 0) ||
    !alive(s, playerId) ||
    !ports.canPay(s, 1, ["mental"])
  )
    return [];
  return [
    {
      id: "wits",
      label:
        "Battle of Wits · spend 1 mental · prevent 1 threat and remove 1 secret counter",
      image: WITS,
      effects: [Z("wits-pay", { threat: e, actorId: playerId })],
    },
  ];
}

// ----------------------------------------------------------------- actions

/** Hero Actions: each board member's and Baron Zemo's Sword's; Arrest
 * Warrant's Alter-Ego Action. */
export function zemoActions(
  s: GameState,
  p: Piece,
  ports?: Pick<ZemoPorts, "canPay">,
): Option[] {
  if (s.phase !== "player" || !active(s, p)) return [];
  const hero = s.player.form === "hero";
  if (BOARD[p.code] && boardEnvironments(s).some((q) => q.id === p.id)) {
    if (!hero || !(p.counters > 0)) return [];
    const r = BOARD[p.code].cost;
    if (ports && !ports.canPay(s, 2, [r, r])) return [];
    const then =
      BOARD[p.code].key === "CMO"
        ? "heal 1 damage from a friendly character"
        : BOARD[p.code].key === "CSO"
          ? "remove 2 threat from a scheme"
          : "deal 2 damage to an enemy";
    return [
      {
        id: "investigate",
        label: `Hero Action · spend 2 ${r} · remove 1 secret counter, then ${then}`,
        image: p.code,
        effects: [Z("board-pay", { id: p.id, actorId: s.activePlayerId })],
      },
    ];
  }
  if (p.code === SWORD && s.attachments.some((a) => a.id === p.id)) {
    if (!hero || !boardEnvironments(s).some((q) => q.counters > 0)) return [];
    const options: Option[] = [];
    for (const r of ["physical", "energy"] as Resource[])
      if (!ports || ports.canPay(s, 3, [r, r, r]))
        options.push({
          id: `sword-${r}`,
          label: `Hero Action · spend 3 ${r} · remove 1 secret counter and discard Baron Zemo's Sword`,
          image: p.code,
          effects: [
            Z("sword-pay", {
              id: p.id,
              resource: r,
              actorId: s.activePlayerId,
            }),
          ],
        });
    return options;
  }
  if (p.code === WARRANT && s.player.inPlay.some((q) => q.id === p.id)) {
    if (s.player.form !== "alter") return [];
    const options: Option[] = [];
    if (!s.player.exhausted)
      options.push({
        id: "warrant-identity",
        label:
          "Alter-Ego Action · exhaust your identity · reveal a S.H.I.E.L.D. minion and discard Arrest Warrant",
        image: p.code,
        effects: [
          Z("warrant", {
            id: p.id,
            exhaust: "hero",
            playerId: s.activePlayerId,
          }),
        ],
      });
    for (const q of s.player.inPlay.filter(
      (q) => q.id !== p.id && !q.exhausted && shieldCard(q),
    ))
      options.push({
        id: `warrant-${q.id}`,
        label: `Alter-Ego Action · exhaust ${name(q)} · reveal a S.H.I.E.L.D. minion and discard Arrest Warrant`,
        image: p.code,
        effects: [
          Z("warrant", {
            id: p.id,
            exhaust: q.id,
            playerId: s.activePlayerId,
          }),
        ],
      });
    return options;
  }
  return [];
}
export function zemoActionSource(s: GameState, id: string): Piece | undefined {
  return (
    boardEnvironments(s).find((p) => p.id === id) ||
    s.attachments.find((p) => p.id === id && p.code === SWORD) ||
    s.player.inPlay.find((p) => p.id === id && p.code === WARRANT)
  );
}

// ----------------------------------------------------------------- reveals

export function zemoReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (p.code === SWORD)
    return resolving ? [Z("attach-sword", { piece: p })] : [];
  if (p.code === FOE)
    return resolving
      ? [Z("foe", { id: p.id, playerId, actorId: playerId })]
      : [];
  if (isTextBlank(s, p)) return [];
  const hero = seatView(s, playerId).player.form === "hero";
  if (INTERFERENCE[p.code])
    return [
      Z("interference", {
        resource: INTERFERENCE[p.code],
        playerId,
        actorId: playerId,
      }),
    ];
  switch (p.code) {
    case WITS:
      return [Z("wits", { playerId, actorId: playerId })];
    case MIGHT:
      return hero
        ? [Z("might", { playerId, actorId: playerId })]
        : [Z("secret-fewest", { n: 2, actorId: playerId })];
    case ENDS:
      return [Z("ends", { playerId, actorId: playerId })];
    case DISAVOWED:
      return [Z("disavowed", { id: p.id })];
    default:
      return [];
  }
}
export function zemoBoost(s: GameState, p: Piece): Effect[] | null {
  if (!INTERFERENCE[p.code]) return null;
  if (isTextBlank(s, p) || !activation(s)) return [];
  const playerId = boostPlayer(s);
  return [
    Z("interference", {
      resource: INTERFERENCE[p.code],
      playerId,
      actorId: playerId,
    }),
  ];
}

// ---------------------------------------------------------------- resolver

export function resolveZemoEffect(
  s: GameState,
  e: Effect,
  ports: ZemoPorts,
): boolean {
  if (!e.type.startsWith("zemo:")) return false;
  const st = s.zemo;
  const find = (id: string) => boardCards(s).find((p) => p.id === id);
  const friendly = () =>
    seats(s).flatMap((seat) =>
      ports.characters(s, seat.id).map((id) => ({
        id,
        hp: id.startsWith("hero:")
          ? seatView(s, id.slice(5)).player.hp
          : ports.remainingHP(s, id),
        label: id.startsWith("hero:")
          ? ports.heroName(s, id.slice(5))
          : name(
              seatView(s, seat.id).player.inPlay.find((q) => q.id === id) || id,
            ),
      })),
    );
  switch (e.type) {
    case "zemo:secret": {
      // Secret counters on a board member: an environment joins the villain
      // at 4 (3 in Expert); a joined board member's Forced Response follows.
      const p = find(String(e.id));
      const n = Number(e.n) || 0;
      if (!p || n <= 0 || over(s)) break;
      p.counters = (p.counters || 0) + n;
      ports.log(
        s,
        `${n} secret counter${n === 1 ? " goes" : "s go"} on ${name(p)}.`,
        "bad",
      );
      if (BOARD[p.code]) {
        if (p.counters >= turnsAt(s)) flipBoard(s, p, ports);
      } else if (active(s, p)) ports.queue(s, Z("aid", { id: p.id }));
      break;
    }
    case "zemo:secret-each":
      ports.queue(
        s,
        ...boardCards(s).map((p) => Z("secret", { id: p.id, n: e.n })),
      );
      break;
    case "zemo:secret-fewest": {
      const envs = boardEnvironments(s);
      if (!envs.length || over(s)) break;
      const least = Math.min(...envs.map((p) => p.counters || 0));
      const tied = envs.filter((p) => (p.counters || 0) === least);
      if (tied.length === 1) {
        ports.queue(s, Z("secret", { id: tied[0].id, n: e.n }));
        break;
      }
      ports.choose(
        s,
        "Board Members",
        `Place ${plural(Number(e.n) || 0, "secret counter")} on the board member with the fewest.`,
        tied.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [Z("secret", { id: p.id, n: e.n })],
        })),
      );
      break;
    }
    case "zemo:unsecret": {
      // Remove secret counters from among the board member environments,
      // one at a time.
      const n = Number(e.n) || 0;
      const envs = boardEnvironments(s).filter((p) => (p.counters || 0) > 0);
      if (n <= 0 || !envs.length) break;
      const take = (p: Piece): Effect[] => [
        Z("unsecret-one", { id: p.id }),
        Z("unsecret", { n: n - 1, actorId: e.actorId }),
      ];
      if (envs.length === 1) ports.queue(s, ...take(envs[0]));
      else
        ports.choose(
          s,
          "Board Members",
          `Remove a secret counter from a board member (${n} to remove).`,
          envs.map((p) => ({
            id: p.id,
            label: `${name(p)} · ${plural(p.counters, "secret counter")}`,
            image: p.code,
            effects: take(p),
          })),
        );
      break;
    }
    case "zemo:unsecret-one": {
      const p = boardEnvironments(s).find((q) => q.id === e.id);
      if (!p || !(p.counters > 0)) break;
      p.counters -= 1;
      ports.log(s, `A secret counter comes off ${name(p)}.`, "good");
      break;
    }
    case "zemo:aid": {
      // The board members on the villain's side: their Forced Responses
      // after a secret counter is placed on them.
      const p = boardAttachments(s).find((q) => q.id === e.id);
      if (!p || over(s)) break;
      if (p.code === "50182b") {
        ports.queue(s, { type: "threat", target: "main", amount: 2 });
        break;
      }
      const friends = friendly();
      if (!friends.length) {
        if (p.code === "50181b") ports.queue(s, Z("heal-villain", { n: 2 }));
        break;
      }
      const hit = (id: string, n: number): Effect => ({
        type: "damage",
        target: id,
        amount: n,
        source: p.code,
      });
      if (p.code === "50183b") {
        if (friends.length === 1) ports.queue(s, hit(friends[0].id, 2));
        else
          ports.choose(
            s,
            name(p),
            "Deal 2 damage to a friendly character.",
            friends.map((c) => ({
              id: c.id,
              label: c.label,
              effects: [hit(c.id, 2)],
            })),
          );
        break;
      }
      const least = Math.min(...friends.map((c) => c.hp));
      ports.choose(s, name(p), "Choose one.", [
        {
          id: "heal",
          label: "Heal 2 damage from the villain",
          effects: [Z("heal-villain", { n: 2 })],
        },
        ...friends
          .filter((c) => c.hp === least)
          .map((c) => ({
            id: `hit:${c.id}`,
            label: `Deal 1 damage to ${c.label}`,
            effects: [hit(c.id, 1)],
          })),
      ]);
      break;
    }
    case "zemo:heal-villain":
      if (s.villain) ports.heal(s, s.villain.id, Number(e.n) || 0);
      break;
    case "zemo:board-pay": {
      const p = boardEnvironments(s).find((q) => q.id === e.id);
      if (!p) break;
      const r = BOARD[p.code].cost;
      ports.pay(
        s,
        2,
        [r, r],
        [Z("board-use", { id: p.id, actorId: e.actorId || s.activePlayerId })],
        `${name(p)} · remove a secret counter`,
        true,
      );
      break;
    }
    case "zemo:board-use": {
      const p = boardEnvironments(s).find((q) => q.id === e.id);
      if (!p || !(p.counters > 0)) break;
      p.counters -= 1;
      ports.log(s, `A secret counter comes off ${name(p)}.`, "good");
      const key = BOARD[p.code].key;
      if (key === "CMO") {
        const options = seats(s).flatMap((seat) =>
          ports
            .characters(s, seat.id)
            .filter((id) => ports.damaged(s, id))
            .map((id) => ({
              id,
              label: id.startsWith("hero:")
                ? ports.heroName(s, id.slice(5))
                : name(
                    seatView(s, seat.id).player.inPlay.find(
                      (q) => q.id === id,
                    ) || id,
                  ),
              effects: [Z("heal-friend", { target: id })],
            })),
        );
        if (options.length === 1) ports.queue(s, ...options[0].effects);
        else if (options.length)
          ports.choose(
            s,
            name(p),
            "Heal 1 damage from a friendly character.",
            options,
          );
      } else if (key === "CSO") {
        const schemes = [
          ...(s.scheme.threat > 0
            ? [{ id: "main", label: name(s.scheme.code) }]
            : []),
          ...s.sideSchemes
            .filter((q) => q.counters > 0)
            .map((q) => ({ id: q.id, label: name(q) })),
        ];
        const remove = (id: string): Effect => ({
          type: "thwart",
          target: id,
          amount: 2,
          source: p.code,
        });
        if (schemes.length === 1) ports.queue(s, remove(schemes[0].id));
        else if (schemes.length)
          ports.choose(
            s,
            name(p),
            "Remove 2 threat from a scheme.",
            schemes.map((c) => ({
              id: c.id,
              label: `Remove 2 threat from ${c.label}`,
              effects: [remove(c.id)],
            })),
          );
      } else {
        const enemies = [s.villain, ...s.minions].filter(
          (q): q is Piece => !!q,
        );
        const hit = (id: string): Effect => ({
          type: "damage",
          target: id,
          amount: 2,
          source: p.code,
        });
        if (enemies.length === 1) ports.queue(s, hit(enemies[0].id));
        else if (enemies.length)
          ports.choose(
            s,
            name(p),
            "Deal 2 damage to an enemy.",
            enemies.map((q) => ({
              id: q.id,
              label: `Deal 2 damage to ${name(q)}`,
              image: q.code,
              effects: [hit(q.id)],
            })),
          );
      }
      break;
    }
    case "zemo:heal-friend":
      ports.heal(s, String(e.target), 1);
      break;
    case "zemo:attach-sword": {
      const p = e.piece as Piece;
      if (s.villain && ZEMOS.includes(s.villain.code))
        ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "zemo:sword-pay": {
      const sword = s.attachments.find((q) => q.id === e.id);
      if (!sword) break;
      const r = e.resource as Resource;
      ports.pay(
        s,
        3,
        [r, r, r],
        [
          Z("unsecret", { n: 1, actorId: e.actorId }),
          Z("discard", { id: sword.id }),
        ],
        "Baron Zemo's Sword · remove a secret counter",
        true,
      );
      break;
    }
    case "zemo:discard":
      if (
        s.attachments.some((q) => q.id === e.id) ||
        s.players.some((seat) =>
          seatView(s, seat).player.inPlay.some((q) => q.id === e.id),
        )
      )
        ports.discardPiece(s, String(e.id));
      break;
    case "zemo:unmasked": {
      // Unmasked Zemo: secret counters on a board member, or another boost
      // card for this activation.
      if (!s.villain || over(s)) break;
      const n = s.villain.code === "50166b" ? 2 : 1;
      const boost: Effect =
        e.kind === "attack"
          ? Z("extra-boost-attack")
          : Z("extra-boost-scheme", { enemyId: s.villain.id });
      ports.choose(s, name(s.villain.code), "Choose one.", [
        {
          id: "boost",
          label: "Baron Zemo gets an additional boost card",
          effects: [boost],
        },
        ...boardCards(s).map((p) => ({
          id: p.id,
          label: `Place ${plural(n, "secret counter")} on ${name(p)}`,
          image: p.code,
          effects: [Z("secret", { id: p.id, n })],
        })),
      ]);
      break;
    }
    case "zemo:extra-boost-attack":
      s.flags.zemoExtraBoosts = Number(s.flags.zemoExtraBoosts || 0) + 1;
      break;
    case "zemo:extra-boost-scheme":
      if (s.scheming?.attacker === e.enemyId)
        ports.giveBoost(s, String(e.enemyId), "current");
      break;
    case "zemo:respond": {
      // Zemo's Manipulations: 2 secret counters on a board member without
      // any gain 2 evidence cards; then the players may accuse.
      if (!st || s.scheme.code !== MANIPULATIONS || over(s)) break;
      const options: Option[] = [];
      if (st.shield.length)
        for (const p of boardEnvironments(s).filter((q) => !(q.counters > 0)))
          options.push({
            id: `evidence:${p.id}`,
            label: `Place 2 secret counters on ${name(p)} · gain ${plural(Math.min(2, st.shield.length), "evidence card")}`,
            image: p.code,
            effects: [
              Z("secret", { id: p.id, n: 2 }),
              Z("gain", { n: 2 }),
              Z("accuse-offer", { actorId: s.firstPlayerId }),
            ],
          });
      options.push(
        {
          id: "accuse",
          label: "Advance to The Accusation",
          effects: [Z("advance")],
        },
        { id: "pass", label: "Not yet", effects: [] },
      );
      ports.choose(
        s,
        name(MANIPULATIONS),
        "After the player phase: gain evidence, or advance to make your accusation.",
        options,
      );
      break;
    }
    case "zemo:accuse-offer":
      if (!st || s.scheme.code !== MANIPULATIONS || over(s)) break;
      ports.choose(s, name(MANIPULATIONS), "Make your accusation now?", [
        {
          id: "accuse",
          label: "Advance to The Accusation",
          effects: [Z("advance")],
        },
        { id: "pass", label: "Not yet", effects: [] },
      ]);
      break;
    case "zemo:gain": {
      if (!st) break;
      const got = st.shield.splice(0, Number(e.n) || 0);
      st.gained.push(...got);
      if (got.length)
        ports.log(
          s,
          `Evidence gained: ${got.map((p) => name(p)).join(", ")}. ${plural(remainingCombinations(s).length, "combination")} left.`,
          "good",
        );
      break;
    }
    case "zemo:advance":
      if (!over(s)) ports.advanceMain(s);
      break;
    case "zemo:accuse": {
      // The Accusation (2A): guess a means, a motive and an opportunity
      // among the combinations not crossed out; the board member listed
      // with that combination is the accused.
      if (!st) break;
      const index = e.step === "means" ? 0 : e.step === "motive" ? 1 : 2;
      const pool = remainingCombinations(s).filter(
        ([a, b]) =>
          (!e.means || a === e.means) && (!e.motive || b === e.motive),
      );
      const picks = [...new Set(pool.map((c) => c[index]))];
      const next = (code: string): Effect =>
        index === 2
          ? Z("accused", {
              means: e.means,
              motive: e.motive,
              opportunity: code,
            })
          : Z("accuse", {
              step: index === 0 ? "motive" : "opportunity",
              means: index === 0 ? code : e.means,
              motive: index === 1 ? code : e.motive,
            });
      if (!picks.length) break;
      if (picks.length === 1) {
        ports.queue(s, next(picks[0]));
        break;
      }
      ports.choose(
        s,
        name(ACCUSATION_A),
        `Guess the mole's ${e.step}.`,
        picks.map((code) => ({
          id: code,
          label: `${name(code)}${
            index === 2
              ? ` · accuses ${name(pool.find((c) => c[2] === code)![3])}`
              : ""
          }`,
          image: code,
          effects: [next(code)],
        })),
      );
      break;
    }
    case "zemo:accused": {
      if (!st) break;
      const combo = COMBINATIONS.find(
        ([a, b, c]) => a === e.means && b === e.motive && c === e.opportunity,
      );
      if (!combo) break;
      st.accusation = {
        means: combo[0],
        motive: combo[1],
        opportunity: combo[2],
        member: combo[3],
      };
      ports.log(
        s,
        `The players accuse ${name(combo[3])}: ${name(combo[0])}, ${name(combo[1])} and ${name(combo[2])}.`,
      );
      break;
    }
    case "zemo:judge": {
      // The Accusation (2B): the A.I.M. envelope names the mole; for each
      // wrong guess a secret counter goes on each board member, and 3 more
      // on the accused if the players accused the wrong one. Then Fighting
      // Zemo.
      if (!st || over(s)) break;
      st.currentMain.code = ACCUSATION_B;
      s.scheme.code = ACCUSATION_B;
      const mole = moleCombination(s);
      const guess = st.accusation;
      if (!mole || !guess) {
        ports.queue(s, Z("advance"));
        break;
      }
      const wrong =
        (guess.means !== mole[0] ? 1 : 0) +
        (guess.motive !== mole[1] ? 1 : 0) +
        (guess.opportunity !== mole[2] ? 1 : 0) +
        (guess.member !== mole[3] ? 1 : 0);
      ports.log(
        s,
        `The A.I.M. envelope holds ${name(mole[0])}, ${name(mole[1])} and ${name(mole[2])}: the mole is ${name(mole[3])}.${wrong ? ` ${plural(wrong, "guess")} wrong.` : " The accusation is correct!"}`,
        wrong ? "bad" : "good",
      );
      const accused = boardCards(s).find(
        (p) => p.code === guess.member || p.code === BOARD[guess.member]?.back,
      );
      ports.queue(
        s,
        ...Array.from({ length: wrong }, () => Z("secret-each", { n: 1 })),
        ...(guess.member !== mole[3] && accused
          ? [Z("secret", { id: accused.id, n: 3 })]
          : []),
        Z("advance"),
      );
      break;
    }
    case "zemo:unmask": {
      // Fighting Zemo (3A): Zemo flips to his Unmasked side with his
      // printed hit points, and his Sword attaches to him.
      if (!s.villain || !MASKED[s.villain.code]) break;
      s.villain.code = MASKED[s.villain.code];
      const c = def(s.villain.code);
      const hp = (c?.health || 0) * (c?.health_per_hero ? s.playerCount : 1);
      s.villain.hp = hp;
      s.villain.maxHp = hp;
      s.villain.damage = 0;
      ports.log(s, "Baron Zemo is unmasked.", "bad");
      if (
        s.attachments.some(
          (a) => a.code === SWORD && a.attachedTo === s.villain.id,
        )
      )
        break;
      const sword =
        s.encounter.deck.find((q) => q.code === SWORD) ||
        s.encounter.discard.find((q) => q.code === SWORD) ||
        s.attachments.find((q) => q.code === SWORD);
      if (!sword) break;
      const fromDeck = s.encounter.deck.some((q) => q.id === sword.id);
      s.attachments = s.attachments.filter((q) => q.id !== sword.id);
      ports.attach(s, sword, s.villain.id);
      if (fromDeck) ports.shuffleEncounter(s);
      break;
    }
    case "zemo:fight": {
      // Fighting Zemo (3B): the mole joins Zemo, then 1 threat per player
      // for each secret counter on the board members at his side.
      if (!st || over(s)) break;
      st.currentMain.code = FIGHTING_B;
      s.scheme.code = FIGHTING_B;
      const main = def(FIGHTING_B);
      s.scheme.threat =
        (main?.base_threat || 0) *
        (main?.base_threat_fixed ? 1 : s.playerCount);
      const mole = moleCombination(s);
      const env = mole && boardEnvironments(s).find((p) => p.code === mole[3]);
      if (env) flipBoard(s, env, ports);
      const counters = boardAttachments(s).reduce(
        (n, p) => n + (p.counters || 0),
        0,
      );
      if (counters > 0)
        ports.queue(s, {
          type: "threat",
          target: "main",
          amount: counters * s.playerCount,
        });
      break;
    }
    case "zemo:foe": {
      // Reluctant Foe: a hero from the players' collection whose title
      // matches no character in play enters play engaged with you as an
      // Elite minion, with Reluctant Foe attached.
      const foe = s.resolving.find((q) => q.id === e.id);
      if (!foe) break;
      const titles = new Set(
        [
          s.villain,
          ...s.minions,
          ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
        ]
          .filter((q): q is Piece => !!q)
          .map((q) => name(q))
          .concat(s.players.map((seat) => ports.heroName(s, seat.id))),
      );
      const heroes = alive(s, e.playerId)
        ? ports.heroCodes(s).filter((code) => !titles.has(name(code)))
        : [];
      if (!heroes.length) {
        ports.discardPiece(s, foe.id);
        break;
      }
      ports.choose(
        s,
        name(FOE),
        "Search your collection for a hero to put into play as an Elite minion engaged with you.",
        heroes.map((code) => ({
          id: code,
          label: `${name(code)} · ${def(code)?.health || 0} hit points, ${def(code)?.attack || 0} ATK, ${def(code)?.thwart || 0} SCH`,
          image: code,
          effects: [Z("foe-put", { code, foe: foe.id, playerId: e.playerId })],
        })),
      );
      break;
    }
    case "zemo:foe-put": {
      const foe = s.resolving.find((q) => q.id === e.foe);
      if (!foe) break;
      if (!alive(s, e.playerId)) {
        ports.discardPiece(s, foe.id);
        break;
      }
      const hero = ports.makePiece(s, String(e.code));
      hero.reluctantFoe = true;
      ports.putMinion(s, hero, e.playerId);
      if (s.minions.some((m) => m.id === hero.id))
        ports.attach(s, foe, hero.id);
      else ports.discardPiece(s, foe.id);
      ports.log(
        s,
        `${name(hero)} enters play as a Reluctant Foe engaged with ${ports.heroName(s, e.playerId)}.`,
        "bad",
      );
      break;
    }
    case "zemo:wits":
      // Battle of Wits: Baron Zemo schemes; its threat window lets you spend
      // mental resources against it.
      if (!alive(s, e.playerId) || !zemoInPlay(s) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "scheme",
        modifier: 0,
        after: Z("wits-after", { playerId: e.playerId }),
      });
      break;
    case "zemo:wits-after":
      break;
    case "zemo:wits-pay": {
      const threat = e.threat as Effect;
      ports.pay(
        s,
        1,
        ["mental"],
        [
          Z("unsecret", { n: 1, actorId: e.actorId }),
          { ...threat, amount: Number(threat.amount) - 1 },
        ],
        "Battle of Wits · prevent 1 threat",
        false,
      );
      break;
    }
    case "zemo:might":
      // Might Makes Right (hero): Baron Zemo attacks you; if no character
      // takes damage, 3 secret counters come off.
      if (!alive(s, e.playerId) || !zemoInPlay(s) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: Z("might-after", { playerId: e.playerId }),
      });
      break;
    case "zemo:might-after":
      if (!(Number(e.damagePlaced) > 0) && !over(s))
        ports.queue(s, Z("unsecret", { n: 3, actorId: e.playerId }));
      break;
    case "zemo:ends": {
      // The Ends Justify the Means: Zemo defeats the minion with the fewest
      // remaining hit points and schemes; or discard an ally or support you
      // control to remove secret counters equal to its printed cost.
      if (!alive(s, e.playerId) || over(s)) break;
      const own = seatView(s, e.playerId).player.inPlay.filter(
        (q) =>
          ["ally", "support"].includes(def(q)?.type_code || "") &&
          !permanent(q),
      );
      const options: Option[] = [
        {
          id: "defeat",
          label:
            "Baron Zemo defeats the minion with the fewest remaining hit points, then schemes",
          effects: [Z("ends-defeat", { playerId: e.playerId })],
        },
        ...own.map((q) => {
          const cost = Number(def(q)?.cost) || 0;
          return {
            id: q.id,
            label: `Discard ${name(q)} · remove ${plural(cost, "secret counter")}`,
            image: q.code,
            effects: [
              Z("discard", { id: q.id }),
              Z("unsecret", { n: cost, actorId: e.playerId }),
            ],
          };
        }),
      ];
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else ports.choose(s, name(ENDS), "Choose one.", options);
      break;
    }
    case "zemo:ends-defeat": {
      const minions = s.minions.filter((m) => !m.thunderboltBackup);
      const scheme = Z("activate", { playerId: e.playerId, kind: "scheme" });
      if (!minions.length) {
        ports.queue(s, scheme);
        break;
      }
      const least = Math.min(...minions.map((m) => ports.remainingHP(s, m.id)));
      const tied = minions.filter((m) => ports.remainingHP(s, m.id) === least);
      const defeat = (m: Piece): Effect[] => [
        Z("defeat", { id: m.id }),
        scheme,
      ];
      if (tied.length === 1) ports.queue(s, ...defeat(tied[0]));
      else
        ports.choose(
          s,
          name(ENDS),
          "Baron Zemo defeats the minion with the fewest remaining hit points.",
          tied.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: defeat(m),
          })),
        );
      break;
    }
    case "zemo:defeat":
      if (s.minions.some((m) => m.id === e.id) && !over(s))
        ports.defeat(s, String(e.id));
      break;
    case "zemo:activate":
      if (!alive(s, e.playerId) || !zemoInPlay(s) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
      });
      break;
    case "zemo:disavowed": {
      // Disavowed: 1 threat for each S.H.I.E.L.D. card in play.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p) break;
      const pieces = [
        s.villain,
        ...s.minions,
        ...s.sideSchemes,
        ...s.attachments,
        ...(s.environments || []),
        ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
      ].filter((q): q is Piece => !!q);
      const n = pieces.filter((q) => shieldCard(q)).length;
      if (n > 0) {
        p.counters += n;
        ports.log(s, `+${n} threat on Disavowed.`, "bad");
      }
      break;
    }
    case "zemo:trooper": {
      // S.H.I.E.L.D. Trooper: the engaged player discards a S.H.I.E.L.D.
      // ally or support; otherwise 2 threat on the main scheme.
      const pool = alive(s, e.playerId)
        ? seatView(s, e.playerId).player.inPlay.filter(
            (q) =>
              ["ally", "support"].includes(def(q)?.type_code || "") &&
              shieldCard(q) &&
              !permanent(q),
          )
        : [];
      if (!pool.length) {
        ports.queue(s, { type: "threat", target: "main", amount: 2 });
        break;
      }
      if (pool.length === 1) {
        ports.discardPiece(s, pool[0].id);
        break;
      }
      ports.choose(
        s,
        name(TROOPER),
        "Discard a S.H.I.E.L.D. ally or support you control.",
        pool.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [Z("discard", { id: q.id })],
        })),
      );
      break;
    }
    case "zemo:warrant": {
      // Arrest Warrant: exhaust your identity or a S.H.I.E.L.D. card, reveal
      // a S.H.I.E.L.D. minion from the encounter deck or discard pile, and
      // discard Arrest Warrant.
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const warrant = view.inPlay.find((q) => q.id === e.id);
      if (!warrant) break;
      if (e.exhaust === "hero") view.exhausted = true;
      else {
        const q = view.inPlay.find((x) => x.id === e.exhaust);
        if (q) q.exhausted = true;
      }
      ports.discardPiece(s, warrant.id);
      const shieldMinion = (q: Piece) =>
        def(q)?.type_code === "minion" && shieldCard(q);
      const minion =
        s.encounter.deck.find(shieldMinion) ||
        s.encounter.discard.find(shieldMinion);
      const fromDeck = !!minion && s.encounter.deck.includes(minion);
      if (minion) ports.reveal(s, minion, e.playerId);
      if (fromDeck || !minion) ports.shuffleEncounter(s);
      break;
    }
    case "zemo:interference":
      // A.I.M. Interference: a secret counter on each board member; you may
      // spend resources of its type to prevent them.
      ports.queue(
        s,
        Z("interference-step", {
          ids: boardCards(s).map((p) => p.id),
          resource: e.resource,
          playerId: e.playerId,
          actorId: e.playerId,
        }),
      );
      break;
    case "zemo:interference-step": {
      const [id, ...rest] = (e.ids as string[]) || [];
      if (!id || over(s)) break;
      const p = find(id);
      const next = Z("interference-step", {
        ids: rest,
        resource: e.resource,
        playerId: e.playerId,
        actorId: e.playerId,
      });
      if (!p) {
        ports.queue(s, next);
        break;
      }
      const r = e.resource as Resource;
      if (!alive(s, e.playerId) || !ports.canPay(s, 1, [r])) {
        ports.queue(s, Z("secret", { id: p.id, n: 1 }), next);
        break;
      }
      const place: Option = {
        id: "place",
        label: `Place it on ${name(p)}`,
        effects: [Z("secret", { id: p.id, n: 1 }), next],
      };
      const prevent: Option = {
        id: "prevent",
        label: `Spend 1 ${r} to prevent it`,
        effects: [Z("interference-pay", { resource: r, next })],
      };
      // Preventing comes first when the counter would turn the board member
      // or trigger a joined one's Forced Response.
      const dangerous = !BOARD[p.code] || (p.counters || 0) + 1 >= turnsAt(s);
      ports.choose(
        s,
        "A.I.M. Interference",
        `A secret counter goes on ${name(p)}${dangerous ? (BOARD[p.code] ? ", which would join the villain" : ", triggering its Forced Response") : ""}.`,
        dangerous ? [prevent, place] : [place, prevent],
      );
      break;
    }
    case "zemo:interference-pay":
      ports.pay(
        s,
        1,
        [e.resource as Resource],
        [e.next as Effect],
        "A.I.M. Interference · prevent a secret counter",
        false,
      );
      break;
    case "zemo:defend-pay":
      // Divided Loyalties: 1 resource to defend with an ally.
      ports.pay(
        s,
        Number(e.cost) || 1,
        [],
        (e.effects as Effect[]) || [],
        "Divided Loyalties · defend with an ally",
        false,
      );
      break;
    case "zemo:ready-support": {
      // Undermine Support: spend 1 resource to ready each exhausted support.
      const [id, ...rest] = (e.ids as string[]) || [];
      if (!id || !alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const p = view.inPlay.find((q) => q.id === id && q.exhausted);
      const next = Z("ready-support", {
        ids: rest,
        playerId: e.playerId,
        actorId: e.playerId,
      });
      const cost = zemoSupportCost(s);
      if (!p || !cost) {
        if (p && !cost) p.exhausted = false;
        ports.queue(s, next);
        break;
      }
      if (!ports.canPay(s, cost, [])) {
        ports.log(s, `${name(p)} stays exhausted: Undermine Support.`);
        ports.queue(s, next);
        break;
      }
      ports.choose(
        s,
        name(UNDERMINE),
        `Spend ${plural(cost, "resource")} to ready ${name(p)}?`,
        [
          {
            id: "ready",
            label: `Spend ${plural(cost, "resource")} · ready ${name(p)}`,
            image: p.code,
            effects: [
              Z("ready-pay", { id: p.id, cost, next, actorId: e.playerId }),
            ],
          },
          {
            id: "leave",
            label: `Leave ${name(p)} exhausted`,
            effects: [next],
          },
        ],
      );
      break;
    }
    case "zemo:ready-pay":
      ports.pay(
        s,
        Number(e.cost) || 1,
        [],
        [Z("ready-one", { id: e.id, actorId: e.actorId }), e.next as Effect],
        "Undermine Support · ready a support",
        false,
      );
      break;
    case "zemo:ready-one": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (p) p.exhausted = false;
      break;
    }
    default:
      throw Error(`Unknown Baron Zemo effect: ${e.type}`);
  }
  return true;
}
/** A board member joins the villain: it flips to its attachment side with
 * its secret counters. */
function flipBoard(s: GameState, p: Piece, ports: Pick<ZemoPorts, "log">) {
  const back = BOARD[p.code]?.back;
  if (!back) return;
  s.environments = (s.environments || []).filter((q) => q.id !== p.id);
  p.code = back;
  p.attachedTo = s.villain?.id;
  (s.executiveBoard ||= { joined: [] }).joined.push(p);
  ports.log(s, `${name(back)}: the board member joins the villain.`, "bad");
}
