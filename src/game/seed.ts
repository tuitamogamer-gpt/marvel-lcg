/** Turns any seed text into a positive 32-bit number; digits are used as typed. */
export function parseSeed(text: string): number | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (/^\d{1,10}$/.test(value)) return Number(value) >>> 0 || 1;
  let h = 2166136261;
  for (const ch of value) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}
/** The shared daily seed: everyone who plays the same setup today sees the same shuffles. */
export function dailySeedText(date = new Date()) {
  return `daily-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
