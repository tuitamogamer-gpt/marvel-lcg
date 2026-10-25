import type { Card } from "./types.js";

type PrintedMetadata = Readonly<
  Partial<
    Pick<
      Card,
      "name" | "attack" | "boost" | "health" | "is_unique" | "subname" | "text"
    >
  >
>;

/** Missing or mistranscribed fields verified against original English scans. These are
 * printing metadata, not text errata. Keep the downloaded catalog unchanged.
 * Each public/cards/catalog/<code>.webp corresponds to the catalog's source:
 * https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/<code>.jpg
 */
const printedMetadata: Readonly<Record<string, PrintedMetadata>> = {
  // public/cards/catalog/04145.webp: one numeric boost triangle plus a star.
  "04145": { boost: 1 },
  // public/cards/catalog/04150.webp: both printed headings are When Revealed.
  "04150": {
    text: "<b>When Revealed (Alter-Ego)</b>: The villain schemes. If they have a [[Weapon]] attachment, this card gains surge.\n<b>When Revealed (Hero)</b>: The villain attacks you. If they have a [[Weapon]] attachment, this card gains surge.",
  },
  // Original scans public/cards/catalog/34028.webp and 34031.webp.
  "34028": {
    text: "Give to the Jean Grey player.\n<b>When Revealed</b>: If you have the [[UNLEASHED]] trait, search the encounter deck, discard pile, and set-aside area for Dark Phoenix and reveal her. Then, remove Burning Hunger from the game. If you have the [[RESTRAINED]] trait, remove 1 power counter from Phoenix Force and this card gains surge. Discard this card.",
  },
  "34031": {
    text: "Peril.\n<b>When Revealed</b>: If Dark Phoenix is in play, she activates against you. If Dark Phoenix is not in play, place 1 threat on Consume the World and this card gains surge.",
  },
  // public/cards/catalog/32153.webp: printed instruction names a magnet counter.
  "32153": {
    text: "<b>When Revealed</b>: Exhaust each upgrade and support you control. Place 1 magnet counter on the main scheme.\n<hr />\n[star] <b>Boost</b>: Exhaust your identity.",
  },
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
  // Original Version 1 hero face has the unique diamond before Ironheart.
  // https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0d.jpg
  "29001a": { is_unique: true },
  // The Wasp-pack ally's printed secondary title is RIRI WILLIAMS.
  // https://hallofheroeslcg.com/wp-content/uploads/2020/12/a8.jpg
  "13018": { subname: "Riri Williams" },
  // Original Mutant Genesis ally has the printed secondary title PIOTR RASPUTIN.
  // public/cards/catalog/32048.webp; the downloaded text omitted this title.
  "32048": { subname: "Piotr Rasputin" },
  "35021": { subname: "Piotr Rasputin" },
  // Original Sentinel III deals to EVERY player, including the first player.
  // public/cards/catalog/32086.webp; the snapshot copied stage II's wording.
  "32086": {
    text: "Stalwart. Toughness.\n<b>When Revealed</b>: The first player searches the encounter deck and discard pile for a copy of the Abduction Protocols side scheme and reveals it. <i>(Shuffle.)</i> Deal each player a facedown encounter card.",
  },
  // public/cards/catalog/32088a.webp: one printed boost triangle.
  "32088a": { boost: 1 },
  // public/cards/catalog/32092.webp: printed Wolfsbane, not Wolfbane.
  "32092": { text: "[star] Wolfsbane's attacks gain piercing." },
  // public/cards/catalog/32106.webp: printed five hit points, not six.
  "32106": { health: 5 },
  // Original 2A scans share this title; the room names appear on their 2B faces.
  "32126a": { name: "Attack on Xavier's" },
  "32127a": { name: "Attack on Xavier's" },
  "32128a": { name: "Attack on Xavier's" },
  "32129a": { name: "Attack on Xavier's" },
};

/** Return a playable face with verified printing fields, without mutating its
 * imported source. Unaffected faces retain their original object identity.
 */
export function printedCardMetadata(c: Card): Card {
  const metadata = printedMetadata[c.code];
  return metadata ? { ...c, ...metadata } : c;
}
