import players from "../data/core-player.json" with { type: "json" };
import encounters from "../data/core-encounter.json" with { type: "json" };
import catalog from "../data/catalog-cards.json" with { type: "json" };
import type { Card, Piece } from "./types.js";
import { mechanicalSignature } from "./scripts/compiler.js";

const fingerprint = mechanicalSignature;
const originals = [...players, ...encounters] as Card[];
const originalCodes = new Set(originals.map((card) => card.code));
const fingerprints = new Map(
  originals.map((card) => [fingerprint(card), card.code]),
);
const aliases = new Map<string, string>();
// Exact non-Core reprints share an installed native handler while their
// physical cards retain the actual printing code.
const nativeAliases = new Map<string, string>([
  ["46017", "16043"],
  ["46021", "12024"],
  ["46022", "15031"],
  ["46023", "13024"],
  ["40052", "30014"],
  ["40055", "30019"],
  ["43027", "05023"],
  ["38013", "09020"],
  ["38015", "05014"],
  ["38017", "32018"],
  ["33017", "06032"],
  ["31018", "05017"],
  ["34019", "15014"],
  ["34024", "05033"],
  ["32015", "15030"],
  ["32016", "13033"],
  ["32046", "10015"],
  ["32051", "21022"],
]);
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
  return nativeAliases.get(code) || aliases.get(code) || code;
}
export function hasCoreScript(card: string | Pick<Piece, "code">): boolean {
  return originalCodes.has(rulesCode(card));
}
export const CORE_SCRIPT_REPRINTS = Object.fromEntries(aliases);
export const NATIVE_SCRIPT_REPRINTS = Object.fromEntries(nativeAliases);
