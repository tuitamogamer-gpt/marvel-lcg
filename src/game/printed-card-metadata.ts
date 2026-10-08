import type { Card } from "./types.js";

type PrintedMetadata = Readonly<Partial<Pick<Card, "attack" | "boost">>>;

/** Missing fields verified against the original English card scans. These are
 * printing metadata, not text errata. Keep the downloaded catalog unchanged.
 * Each public/cards/catalog/<code>.webp corresponds to the catalog's source:
 * https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/<code>.jpg
 */
const printedMetadata: Readonly<Record<string, PrintedMetadata>> = {
  // public/cards/catalog/19025.webp: two boost triangles, no boost star.
  "19025": { boost: 2 },
  // public/cards/catalog/19026.webp: two boost triangles, no boost star.
  "19026": { boost: 2 },
  // public/cards/catalog/19027.webp: three boost triangles, no boost star.
  "19027": { boost: 3 },
  // public/cards/catalog/19028.webp: one boost triangle; printed +2 ATK icon.
  "19028": { boost: 1, attack: 2 },
  // public/cards/catalog/19029.webp: two boost triangles, no boost star.
  "19029": { boost: 2 },
  // public/cards/catalog/22030.webp: printed +1 ATK icon below the text box.
  "22030": { attack: 1 },
};

/** Return a playable face with verified printing fields, without mutating its
 * imported source. Unaffected faces retain their original object identity.
 */
export function printedCardMetadata(c: Card): Card {
  const metadata = printedMetadata[c.code];
  return metadata ? { ...c, ...metadata } : c;
}
