import type { Card } from "./types";

export const PRINTED_KEYWORDS = [
  "Alliance",
  "Assault",
  "Form",
  "Guard",
  "Hinder",
  "Incite",
  "Linked",
  "Overkill",
  "Patrol",
  "Peril",
  "Permanent",
  "Piercing",
  "Quickstrike",
  "Ranged",
  "Requirement",
  "Restricted",
  "Retaliate",
  "Setup",
  "Stalwart",
  "Steady",
  "Surge",
  "Team-Up",
  "Teamwork",
  "Temporary",
  "Toughness",
  "Uses",
  "Victory",
  "Villainous",
  "Prerequisite",
  "Vulnerable",
] as const;
export type PrintedKeyword = (typeof PRINTED_KEYWORDS)[number];
export interface KeywordDeclaration {
  name: PrintedKeyword;
  value: number;
  perPlayer: boolean;
  argument?: string;
}
const numbered = new Set<PrintedKeyword>([
  "Hinder",
  "Incite",
  "Retaliate",
  "Victory",
]);
const parameterized = new Set<PrintedKeyword>([
  "Form",
  "Linked",
  "Requirement",
  "Team-Up",
  "Teamwork",
  "Uses",
  "Prerequisite",
]);

function parentheticalEnd(text: string) {
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "(") depth++;
    if (text[index] === ")" && --depth === 0) return index + 1;
  }
  return -1;
}
function keywordPrefix(card: Pick<Card, "text">) {
  const text = (card.text || "")
    .split(/<hr\b[^>]*>/i)[0]
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/&nbsp;|&#160;/g, " ");
  // A timing label quoted in reminder text is not a real ability boundary.
  let depth = 0;
  const outside = text
    .split("")
    .map((character) => {
      if (character === "(") depth++;
      const value = depth ? " " : character;
      if (character === ")") depth = Math.max(0, depth - 1);
      return value;
    })
    .join("");
  const ability =
    /\b(?:(?:Hero|Alter-Ego|Forced)\s+)?(?:Action|Response|Interrupt|Resource|Setup|Special|When Revealed|When Defeated|When Completed|Boost)\s*:/i.exec(
      outside,
    );
  return ability ? text.slice(0, ability.index) : text;
}

/** Whole declarations only: references, grants, reminders and boost effects do not count. */
export function keywordDeclarations(
  card: Pick<Card, "text">,
): KeywordDeclaration[] {
  const prefix = keywordPrefix(card);
  const clauses: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index <= prefix.length; index++) {
    if (prefix[index] === "(") depth++;
    if (prefix[index] === ")") depth = Math.max(0, depth - 1);
    if (index === prefix.length || (!depth && /[.\n]/.test(prefix[index]))) {
      clauses.push(prefix.slice(start, index).trim());
      start = index + 1;
    }
  }
  const declarations: KeywordDeclaration[] = [];
  for (const original of clauses) {
    let clause = original.replace(/^\[star\]\s*/i, "").trim();
    const name = PRINTED_KEYWORDS.find((keyword) =>
      new RegExp(`^${keyword}(?=\\s|\\(|$)`, "i").test(clause),
    );
    if (!name) continue;
    clause = clause.slice(name.length).trim();
    let value = 1;
    let perPlayer = false;
    let argument: string | undefined;
    if (numbered.has(name)) {
      const number = new RegExp(
        `^(${name === "Victory" ? "-?" : ""}\\d+)(\\s*\\[per_hero\\])?(?=\\s|\\(|$)`,
        "i",
      ).exec(clause);
      if (!number) continue;
      value = Number(number[1]);
      perPlayer = !!number[2];
      clause = clause.slice(number[0].length).trim();
    } else if (parameterized.has(name)) {
      if (!clause.startsWith("(")) continue;
      const end = parentheticalEnd(clause);
      if (end < 0) continue;
      argument = clause.slice(1, end - 1).trim();
      if (!argument) continue;
      clause = clause.slice(end).trim();
    }
    // Non-operative reminder text may follow a declaration, but no extra sentence may.
    while (clause.startsWith("(")) {
      const end = parentheticalEnd(clause);
      if (end < 0) break;
      clause = clause.slice(end).trim();
    }
    if (!clause)
      declarations.push({
        name,
        value,
        perPlayer,
        ...(argument ? { argument } : {}),
      });
  }
  return declarations;
}

/** Printed keywords precede triggered abilities; references within abilities
 * do not grant keywords to the card. Conditional grants require their script. */
export function printedKeyword(
  card: Pick<Card, "text">,
  name: PrintedKeyword,
): number {
  const declarations = keywordDeclarations(card).filter(
    (declaration) => declaration.name === name,
  );
  return numbered.has(name)
    ? declarations.reduce((sum, declaration) => sum + declaration.value, 0)
    : Number(declarations.length > 0);
}
export function hasPrintedKeyword(
  card: Pick<Card, "text">,
  name: PrintedKeyword,
) {
  // Victory 0 is still a keyword even though its numeric value is zero.
  return keywordDeclarations(card).some(
    (declaration) => declaration.name === name,
  );
}
export function scaledKeyword(
  card: Pick<Card, "text">,
  name: PrintedKeyword,
  startingPlayers: number,
) {
  return keywordDeclarations(card)
    .filter((declaration) => declaration.name === name)
    .reduce(
      (sum, declaration) =>
        sum + declaration.value * (declaration.perPlayer ? startingPlayers : 1),
      0,
    );
}

export interface StatusState {
  stunned: boolean;
  confused: boolean;
  tough: boolean;
  stunCards?: number;
  confuseCards?: number;
  toughCards?: number;
}
export type StatusKind = "stunned" | "confused" | "tough";
/** Derived grants/removals are supplied by the engine, rather than guessed from text. */
export interface StatusModifiers {
  steady?: boolean;
  stalwart?: boolean;
  toughLimit?: number;
  cannotStun?: boolean;
  cannotConfuse?: boolean;
}
const statusKey = (kind: StatusKind) =>
  kind === "stunned"
    ? "stunCards"
    : kind === "confused"
      ? "confuseCards"
      : "toughCards";
const wholeCount = (count: number) =>
  Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
const isSteady = (card: Pick<Card, "text">, modifiers: StatusModifiers) =>
  modifiers.steady ?? !!printedKeyword(card, "Steady");
const isStalwart = (card: Pick<Card, "text">, modifiers: StatusModifiers) =>
  modifiers.stalwart ?? !!printedKeyword(card, "Stalwart");
export function statusCards(
  piece: StatusState,
  kind: StatusKind,
  card?: Pick<Card, "text">,
  modifiers: StatusModifiers = {},
) {
  const count = piece[statusKey(kind)];
  if (count !== undefined) return wholeCount(count);
  // Legacy saves have only the effective boolean. Preserve an already-canceling
  // Steady status by migrating true to its threshold of two cards.
  return piece[kind]
    ? kind !== "tough" && card && isSteady(card, modifiers)
      ? 2
      : 1
    : 0;
}
export function syncStatuses(
  piece: StatusState,
  card: Pick<Card, "text">,
  modifiers: StatusModifiers = {},
) {
  const threshold = isSteady(card, modifiers) ? 2 : 1;
  const stalwart = isStalwart(card, modifiers);
  for (const kind of ["stunned", "confused", "tough"] as const) {
    const count =
      kind !== "tough" &&
      (stalwart ||
        (kind === "stunned" ? modifiers.cannotStun : modifiers.cannotConfuse))
        ? 0
        : statusCards(piece, kind, card, modifiers);
    piece[statusKey(kind)] = count;
    piece[kind] = count >= (kind === "tough" ? 1 : threshold);
  }
  return piece;
}
export function giveStatus(
  piece: StatusState,
  card: Pick<Card, "text">,
  kind: StatusKind,
  modifiers: StatusModifiers = {},
): boolean {
  syncStatuses(piece, card, modifiers);
  if (
    kind !== "tough" &&
    (isStalwart(card, modifiers) ||
      (kind === "stunned" ? modifiers.cannotStun : modifiers.cannotConfuse))
  )
    return false;
  const limit =
    kind === "tough"
      ? (modifiers.toughLimit ?? 1)
      : isSteady(card, modifiers)
        ? 2
        : 1;
  const before = statusCards(piece, kind);
  if (before >= limit) return false;
  piece[statusKey(kind)] = before + 1;
  syncStatuses(piece, card, modifiers);
  return true;
}
export function consumeStatus(
  piece: StatusState,
  kind: "stunned" | "confused",
  card?: Pick<Card, "text">,
  modifiers: StatusModifiers = {},
) {
  if (card) syncStatuses(piece, card, modifiers);
  if (!piece[kind] || !statusCards(piece, kind)) return false;
  piece[kind] = false;
  piece[statusKey(kind)] = 0;
  return true;
}
export function clearStatuses(
  piece: StatusState,
  kinds: readonly StatusKind[] = ["stunned", "confused", "tough"],
) {
  for (const kind of kinds) {
    piece[kind] = false;
    piece[statusKey(kind)] = 0;
  }
}
/** Each damage instance consumes one Tough; Piercing instead discards all. */
export function consumeTough(piece: StatusState) {
  const before = statusCards(piece, "tough");
  if (!before) return false;
  piece.toughCards = before - 1;
  piece.tough = piece.toughCards > 0;
  return true;
}
export function discardToughForPiercing(
  piece: StatusState,
  damageBeforeTough: number,
  piercing: boolean,
) {
  if (!piercing || !(damageBeforeTough > 0)) return 0;
  const discarded = statusCards(piece, "tough");
  clearStatuses(piece, ["tough"]);
  return discarded;
}
/** RRG1.8: an attacked character must remain in play to retaliate. Actual
 * damage may be zero; a canceled attack never produces this response window. */
export function retaliateAmount(
  value: number,
  context: { attackResolved: boolean; sourceInPlay: boolean; ranged?: boolean },
) {
  return context.attackResolved && context.sourceInPlay && !context.ranged
    ? wholeCount(value)
    : 0;
}
export function patrolBlocksMainScheme(context: {
  engagedPatrol: boolean;
  thwart: boolean;
  ignorePatrol?: boolean;
}) {
  return context.engagedPatrol && context.thwart && !context.ignorePatrol;
}
