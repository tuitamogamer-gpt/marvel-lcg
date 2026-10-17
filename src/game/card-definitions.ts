// Pure card definitions and physical type overlays: no rules or registry imports.
import { expansionErrata } from "./expansion-errata.js";
import { printedCardMetadata } from "./printed-card-metadata.js";
import playerData from "../data/core-player.json" with { type: "json" };
import encounterData from "../data/core-encounter.json" with { type: "json" };
import errata from "../data/core-errata.json" with { type: "json" };
import catalogData from "../data/catalog-cards.json" with { type: "json" };
import type { Card, Piece } from "./types.js";

// Keep the downloaded snapshots intact; official corrections survive data syncs.
export const CARDS = ([...playerData, ...encounterData] as Card[]).map((c) => {
  const correction = errata.find((e) => e.code === c.code);
  if (correction)
    return {
      ...c,
      text: correction.text,
      errata: { reference: correction.reference, url: correction.url },
    };
  const text = c.text?.replace(
    /(Surge\.? )<i>\([^<]*additional encounter card[^<]*\)<\/i>/,
    "$1<i>(When revealed, deal yourself 1 facedown encounter card.)</i>",
  );
  return text !== c.text
    ? {
        ...c,
        text,
        errata: {
          reference: "FFG Rules Reference 1.8, p. 42",
          url: errata[0].url.replace("#page=65", "#page=42"),
        },
      }
    : c;
});
/** Read-only collection: imported cards do not gain rules handlers by being in the database. */
export const CATALOG_CARDS = [
  ...CARDS,
  ...(catalogData as Card[])
    .map(printedCardMetadata)
    .map(expansionErrata)
    .filter((c) => !CARDS.some((core) => core.code === c.code)),
];
export const DB = Object.fromEntries(
  CATALOG_CARDS.map((c) => [c.code, c]),
) as Record<string, Card>;
DB.drone = {
  code: "drone",
  name: "Ultron Drone",
  type_code: "minion",
  faction_code: "encounter",
  quantity: 1,
  position: 0,
  attack: 1,
  scheme: 1,
  health: 1,
  traits: "Drone.",
  text: "Facedown card from your deck. When defeated, return it to your discard pile.",
};
export const card = (piece: Piece | string): Card => {
  const printed = DB[typeof piece === "string" ? piece : piece.code];
  if (typeof piece !== "string" && piece.treatedAsAlly)
    return {
      ...printed,
      type_code: "ally",
      text: "",
      traits: `${printed.traits || ""} Controlled.`,
      thwart: printed.scheme || 0,
      attack_cost: piece.controlConsequential || 1,
      thwart_cost: piece.controlConsequential || 1,
    };
  return typeof piece !== "string" && piece.treatedAsMinion
    ? {
        ...printed,
        type_code: "minion",
        text: "",
        scheme: printed.thwart || 0,
        traits: `${printed.traits || ""} ${piece.deadpoolMinion ? "Pool" : piece.stormControlled ? "Controlled" : "Enthralled"}.`,
      }
    : printed;
};
