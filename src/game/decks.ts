import { ASPECTS, CATALOG_CARDS, HEROES, card, deckCodes } from "./cards.js";
import { identityMatch, uniqueMatches } from "./unique";
import { hasExecutableScript } from "./script-registry";
import { CAPTAIN_AMERICA_SCRIPT_CODES } from "./captain-america";
import type { Aspect, Card } from "./types";

export function countsFor(codes: string[]) {
  return codes.reduce<Record<string, number>>((counts, code) => {
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, Object.create(null));
}
export function copyLimit(c: Card) {
  return c.deck_limit ?? (c.is_unique ? 1 : 3);
}
export function deckOptions(heroId: string, aspect: Aspect) {
  const heroPack = card(
    HEROES.find((h) => h.id === heroId)?.code || "",
  )?.pack_code;
  return CATALOG_CARDS.filter(
    (c) =>
      !identityMatch(heroId, c) &&
      (hasExecutableScript(c) ||
        (CAPTAIN_AMERICA_SCRIPT_CODES as readonly string[]).includes(c.code)) &&
      ["ally", "event", "resource", "support", "upgrade"].includes(
        c.type_code,
      ) &&
      ((c.faction_code === "hero" &&
        c.set_code === heroId &&
        c.pack_code === heroPack) ||
        c.faction_code === aspect ||
        c.faction_code === "basic"),
  );
}
export function deckErrors(
  heroId: string,
  aspect: Aspect,
  codes: unknown,
): string[] {
  if (
    !HEROES.some((h) => h.id === heroId) ||
    !ASPECTS.some((a) => a.id === aspect)
  )
    return ["Choose a valid hero and aspect."];
  if (!Array.isArray(codes) || codes.some((c) => typeof c !== "string"))
    return ["Choose cards for this deck."];
  if (codes.length > 50 || codes.length < 40)
    return ["A deck needs 40–50 cards, including its 15 hero cards."];
  const counts = countsFor(codes);
  const allowed = new Set(deckOptions(heroId, aspect).map((c) => c.code));
  const required = countsFor(
    deckCodes(heroId, aspect).filter(
      (code) => card(code).faction_code === "hero",
    ),
  );
  const errors: string[] = [];
  for (const [code, count] of Object.entries(required)) {
    if (counts[code] !== count)
      errors.push(`Keep all ${count} copies of ${card(code).name}.`);
  }
  for (const [code, count] of Object.entries(counts)) {
    if (!allowed.has(code))
      errors.push(
        "This deck contains a card outside its hero, aspect, or the basic pool.",
      );
    else if (!required[code] && count > copyLimit(card(code)))
      errors.push(
        `${card(code).name}: maximum ${copyLimit(card(code))} copies.`,
      );
  }
  const uniqueCards = codes
    .map((code) => card(code))
    .filter((c) => c?.is_unique);
  for (let i = 0; i < uniqueCards.length; i++)
    if (uniqueCards.slice(i + 1).some((c) => uniqueMatches(uniqueCards[i], c)))
      errors.push(
        `${uniqueCards[i].name}: matching unique cards cannot share a deck.`,
      );
  const names = new Map<string, { count: number; limit: number }>();
  for (const [code, count] of Object.entries(counts)) {
    const c = card(code);
    if (!c || c.faction_code === "hero" || c.is_unique) continue;
    const entry = names.get(c.name) || { count: 0, limit: copyLimit(c) };
    entry.count += count;
    entry.limit = Math.min(entry.limit, copyLimit(c));
    names.set(c.name, entry);
  }
  for (const [name, entry] of names)
    if (entry.count > entry.limit)
      errors.push(
        `${name}: maximum ${entry.limit} copies across all printings.`,
      );
  return [...new Set(errors)];
}
