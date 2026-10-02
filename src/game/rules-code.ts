import players from "../data/core-player.json" with { type: "json" };
import encounters from "../data/core-encounter.json" with { type: "json" };
import catalog from "../data/catalog-cards.json" with { type: "json" };
import type { Card, Piece } from "./types";
import { mechanicalSignature } from "./scripts/compiler";

const fingerprint = mechanicalSignature;
const originals = [...players, ...encounters] as Card[];
const originalCodes = new Set(originals.map((card) => card.code));
const fingerprints = new Map(
  originals.map((card) => [fingerprint(card), card.code]),
);
const aliases = new Map<string, string>();
for (const card of catalog as Card[]) {
  const canonical = fingerprints.get(fingerprint(card));
  if (canonical && !originalCodes.has(card.code))
    aliases.set(card.code, canonical);
}
/** Rules identity only. A piece always retains its actual printing's code. */
export function rulesCode(
  card: string | Pick<Piece, "code"> | null | undefined,
): string {
  const code = typeof card === "string" ? card : card?.code || "";
  return aliases.get(code) || code;
}
export function hasCoreScript(card: string | Pick<Piece, "code">): boolean {
  return originalCodes.has(rulesCode(card));
}
export const CORE_SCRIPT_REPRINTS = Object.fromEntries(aliases);
