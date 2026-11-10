import { PRODUCTS } from "../game/catalog.js";
import { CATALOG_CARDS, card } from "../game/cards.js";
import { copyLimit } from "../game/decks.js";
import { isPermanent } from "../game/hero-runtime.js";
import type { Card } from "../game/types.js";

/** Reprints point at their first printing; the deck builder lists them once. */
export const printingKey = (c: Card) =>
  (c as Card & { duplicate_of?: string }).duplicate_of || c.code;

export interface DeckRow {
  key: string;
  card: Card;
  codes: string[];
}

/** One row per card, merging every reprint of it in the pool. */
export function groupPrintings(options: Card[]): DeckRow[] {
  const rows = new Map<string, DeckRow>();
  for (const c of options) {
    const key = printingKey(c);
    const row = rows.get(key);
    if (!row) rows.set(key, { key, card: c, codes: [c.code] });
    else {
      row.codes.push(c.code);
      if (c.code === key) row.card = c;
    }
  }
  return [...rows.values()];
}

/**
 * Set a row to `count` copies. Printings already in the deck are kept first,
 * so a saved deck does not silently swap its reprints.
 */
export function setRowCount(codes: string[], row: DeckRow, count: number) {
  const inRow = new Set(row.codes);
  const kept = codes.filter((code) => inRow.has(code)).slice(0, count);
  return [
    ...codes.filter((code) => !inRow.has(code)),
    ...kept,
    ...Array<string>(count - kept.length).fill(row.card.code),
  ];
}

export const TYPE_LABELS: Record<string, string> = {
  ally: "Ally",
  event: "Event",
  support: "Support",
  upgrade: "Upgrade",
  resource: "Resource",
  player_side_scheme: "Player side scheme",
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

export type CostBucket = "0" | "1" | "2" | "3" | "4" | "5+" | "X" | "none";
export function costBucket(c: Card): CostBucket {
  if (c.cost === undefined || c.cost === null) return "none";
  if (c.cost < 0) return "X";
  return c.cost >= 5 ? "5+" : (String(c.cost) as CostBucket);
}

export const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const packName = (code?: string) =>
  PRODUCTS.find((p) => p.code === code)?.name || code || "";

export interface DeckSummary {
  curve: Record<Exclude<CostBucket, "none">, number>;
  types: { type: string; label: string; count: number }[];
  resources: { energy: number; mental: number; physical: number; wild: number };
  averageCost: number | null;
}

/** Statistics for the playing deck; Permanent setup cards are left out. */
export function deckSummary(codes: string[]): DeckSummary {
  const curve = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5+": 0, X: 0 };
  const types = new Map<string, number>();
  const resources = { energy: 0, mental: 0, physical: 0, wild: 0 };
  let costTotal = 0;
  let costed = 0;
  for (const code of codes) {
    const c = card(code);
    if (!c || isPermanent(c)) continue;
    types.set(c.type_code, (types.get(c.type_code) || 0) + 1);
    resources.energy += c.resource_energy || 0;
    resources.mental += c.resource_mental || 0;
    resources.physical += c.resource_physical || 0;
    resources.wild += c.resource_wild || 0;
    const bucket = costBucket(c);
    if (bucket === "none") continue;
    curve[bucket]++;
    if (bucket !== "X") {
      costTotal += c.cost!;
      costed++;
    }
  }
  return {
    curve,
    types: [...types]
      .sort(
        ([a], [b]) =>
          (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
      )
      .map(([type, count]) => ({
        type,
        label: TYPE_LABELS[type] || type,
        count,
      })),
    resources,
    averageCost: costed ? costTotal / costed : null,
  };
}

/** Plain-text list: "2x Card Name (Pack)", grouped by card type. */
export function formatDeckList({
  name,
  heading,
  codes,
}: {
  name: string;
  heading: string;
  codes: string[];
}) {
  const rows = new Map<string, { c: Card; count: number }>();
  for (const code of codes) {
    const c = card(code);
    if (!c) continue;
    const key = printingKey(c);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { c: card(key) || c, count: 1 });
  }
  const byType = new Map<string, { c: Card; count: number }[]>();
  for (const row of rows.values()) {
    const type = isPermanent(row.c) ? "permanent" : row.c.type_code;
    byType.set(type, [...(byType.get(type) || []), row]);
  }
  const lines = [name.trim() || "Untitled deck", heading];
  const order = [...TYPE_ORDER, "permanent"];
  for (const type of [...byType.keys()].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  )) {
    const group = byType.get(type)!;
    const total = group.reduce((sum, row) => sum + row.count, 0);
    lines.push(
      "",
      `${type === "permanent" ? "Permanent (starts in play)" : TYPE_LABELS[type] || type} (${total})`,
    );
    for (const { c, count } of group)
      lines.push(`${count}x ${c.name} (${packName(c.pack_code)})`);
  }
  return lines.join("\n");
}

export interface ParsedDeckList {
  /** Chosen (non-fixed) card codes, already within copy limits. */
  codes: string[];
  /** Lines naming fixed hero cards, which stay as they are. */
  fixed: number;
  unknown: string[];
  unavailable: string[];
  limited: string[];
}

const LINE = /^\s*(\d{1,2})\s*[x×]?\s+(.+?)\s*(?:\(([^()]*)\))?\s*$/i;

/**
 * Read a pasted list against the hero's current pool. Lines that are not
 * "<count> <card name>" (headings, blank lines, the hero line) are ignored.
 */
export function parseDeckList(
  text: string,
  {
    heroId,
    options,
    fixed,
  }: { heroId: string; options: Card[]; fixed: Record<string, number> },
): ParsedDeckList {
  const rows = groupPrintings(options);
  const result = emptyResult();
  const chosen = new Map<DeckRow, number>();
  for (const raw of text.split(/\r?\n/)) {
    const match = LINE.exec(raw);
    if (!match) continue;
    const count = Number(match[1]);
    const name = normalizeName(match[2]);
    const pack = normalizeName(match[3] || "");
    if (!count || !name) continue;
    const named = rows.filter(
      (row) =>
        normalizeName(row.card.name) === name ||
        (row.card.subname &&
          normalizeName(`${row.card.name} ${row.card.subname}`) === name),
    );
    const row =
      named.find((row) =>
        row.codes.some((code) => {
          const p = card(code)?.pack_code;
          return pack && (normalizeName(packName(p)) === pack || p === pack);
        }),
      ) || named[0];
    const label = match[2].trim();
    if (!row) {
      const exists = CATALOG_CARDS.some((c) => normalizeName(c.name) === name);
      (exists ? result.unavailable : result.unknown).push(label);
      continue;
    }
    if (row.codes.some((code) => Object.hasOwn(fixed, code))) {
      result.fixed++;
      continue;
    }
    chosen.set(row, (chosen.get(row) || 0) + count);
  }
  return finish(chosen, heroId, result);
}

const emptyResult = (): ParsedDeckList => ({
  codes: [],
  fixed: 0,
  unknown: [],
  unavailable: [],
  limited: [],
});

function finish(
  chosen: Map<DeckRow, number>,
  heroId: string,
  result: ParsedDeckList,
) {
  for (const [row, count] of chosen) {
    const limit = copyLimit(row.card, heroId);
    if (count > limit) result.limited.push(`${row.card.name} (max ${limit})`);
    result.codes.push(
      ...Array<string>(Math.min(count, limit)).fill(row.card.code),
    );
  }
  return result;
}

/** Card codes and quantities (MarvelCDB "slots") read against a hero's pool. */
export function importSlots(
  slots: Record<string, number>,
  {
    heroId,
    options,
    fixed,
  }: { heroId: string; options: Card[]; fixed: Record<string, number> },
): ParsedDeckList {
  const rows = groupPrintings(options);
  const result = emptyResult();
  const chosen = new Map<DeckRow, number>();
  for (const [code, count] of Object.entries(slots)) {
    const printed = card(code);
    if (!printed) {
      result.unknown.push(code);
      continue;
    }
    const key = printingKey(printed);
    const row =
      rows.find((r) => r.codes.includes(code)) ||
      rows.find((r) => r.key === key);
    if (
      Object.hasOwn(fixed, code) ||
      row?.codes.some((c) => Object.hasOwn(fixed, c))
    ) {
      result.fixed++;
      continue;
    }
    if (!row) {
      result.unavailable.push(printed.name);
      continue;
    }
    chosen.set(row, (chosen.get(row) || 0) + count);
  }
  return finish(chosen, heroId, result);
}

export interface MarvelCdbLink {
  kind: "decklist" | "deck";
  id: string;
}

/** A published decklist or a shared deck link from marvelcdb.com. */
export function marvelCdbLink(text: string): MarvelCdbLink | null {
  const match = /marvelcdb\.com\/(decklist|deck)\/(?:view\/)?(\d+)/i.exec(text);
  return match
    ? { kind: match[1].toLowerCase() as MarvelCdbLink["kind"], id: match[2] }
    : null;
}

export interface MarvelCdbDeck {
  name: string;
  heroCode: string;
  heroName: string;
  aspects: string[];
  slots: Record<string, number>;
}

export async function fetchMarvelCdbDeck(
  link: MarvelCdbLink,
  fetcher: typeof fetch = fetch,
): Promise<MarvelCdbDeck> {
  let response: Response;
  try {
    response = await fetcher(
      `https://marvelcdb.com/api/public/${link.kind}/${link.id}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    // A missing deck's page carries no CORS header, so the browser reports
    // it as a network failure too.
    throw Error(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "MarvelCDB could not be reached while offline."
        : "MarvelCDB has no public deck at this link, or it could not be reached.",
    );
  }
  // Missing or private decks answer with an HTML page rather than JSON.
  if (
    !response.ok ||
    !(response.headers.get("content-type") || "").includes("json")
  )
    throw Error("MarvelCDB has no public deck at this link.");
  const data = (await response.json().catch(() => null)) as {
    name?: unknown;
    hero_code?: unknown;
    hero_name?: unknown;
    meta?: unknown;
    slots?: unknown;
  } | null;
  if (
    !data ||
    typeof data.hero_code !== "string" ||
    !data.slots ||
    typeof data.slots !== "object"
  )
    throw Error("MarvelCDB returned a deck this table cannot read.");
  let meta: Record<string, unknown> = {};
  try {
    meta =
      typeof data.meta === "string"
        ? JSON.parse(data.meta)
        : (data.meta as Record<string, unknown>) || {};
  } catch {
    // Older decks have no aspect metadata; the cards decide.
  }
  return {
    name: typeof data.name === "string" ? data.name.slice(0, 60) : "",
    heroCode: data.hero_code,
    heroName:
      typeof data.hero_name === "string" ? data.hero_name : data.hero_code,
    aspects: [meta?.aspect, meta?.aspect2].filter(
      (a): a is string => typeof a === "string",
    ),
    slots: Object.fromEntries(
      Object.entries(data.slots as Record<string, unknown>).filter(
        (entry): entry is [string, number] =>
          Number.isInteger(entry[1]) &&
          (entry[1] as number) > 0 &&
          (entry[1] as number) < 100,
      ),
    ),
  };
}
