import { ASPECTS, CATALOG_CARDS, HEROES, card, deckCodes } from "./cards.js";
import { identityMatch, uniqueMatches } from "./unique.js";
import { hasExecutableScript } from "./script-registry.js";
import { CAPTAIN_AMERICA_SCRIPT_CODES } from "./captain-america.js";
import {
  heroDeckAspects,
  heroRequiredCards,
  heroAllowsOffAspectEvent,
  heroDeckRule,
  isPermanent,
  validateHeroDeck,
} from "./hero-runtime.js";
import type { Aspect, Card } from "./types.js";

export function countsFor(codes: string[]) {
  return codes.reduce<Record<string, number>>((counts, code) => {
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, Object.create(null));
}
export function copyLimit(c: Card, heroId?: string) {
  return Math.min(
    c.deck_limit ?? (c.is_unique ? 1 : 3),
    heroId &&
      heroDeckRule(heroId)?.aspects === "four-equal-singleton" &&
      !Object.hasOwn(heroRequiredCards(heroId), c.code)
      ? 1
      : Infinity,
  );
}
/** Physical setup cards belong to the composition, outside the playing deck. */
export function deckSizeFor(codes: string[]) {
  return codes.filter((code) => !card(code) || !isPermanent(card(code))).length;
}
export function deckOptions(
  heroId: string,
  aspect: Aspect,
  chosenAspects?: Aspect[],
) {
  const heroPack = card(
    HEROES.find((h) => h.id === heroId)?.code || "",
  )?.pack_code;
  const selectedAspects =
    chosenAspects || heroDeckAspects(heroId, deckCodes(heroId, aspect), aspect);
  return CATALOG_CARDS.filter(
    (c) =>
      c.code !== "26002b" &&
      !identityMatch(heroId, c) &&
      (hasExecutableScript(c) ||
        (CAPTAIN_AMERICA_SCRIPT_CODES as readonly string[]).includes(c.code)) &&
      ["ally", "event", "resource", "support", "upgrade"].includes(
        c.type_code,
      ) &&
      (((c.faction_code === "hero" ||
        Object.hasOwn(heroRequiredCards(heroId), c.code)) &&
        c.set_code === heroId &&
        c.pack_code === heroPack) ||
        selectedAspects.includes(c.faction_code as Aspect) ||
        heroAllowsOffAspectEvent(heroId, c) ||
        c.faction_code === "basic"),
  );
}
export function deckErrors(
  heroId: string,
  aspect: Aspect,
  codes: unknown,
  chosenAspects?: Aspect[],
): string[] {
  if (
    !HEROES.some((h) => h.id === heroId) ||
    !ASPECTS.some((a) => a.id === aspect)
  )
    return ["Choose a valid hero and aspect."];
  if (!Array.isArray(codes) || codes.some((c) => typeof c !== "string"))
    return ["Choose cards for this deck."];
  if (
    chosenAspects &&
    (!Array.isArray(chosenAspects) ||
      chosenAspects.length !==
        (heroDeckRule(heroId)?.aspects === "four-equal-singleton"
          ? 4
          : heroId === "spider_woman"
            ? 2
            : 1) ||
      new Set(chosenAspects).size !== chosenAspects.length ||
      !chosenAspects.includes(aspect) ||
      chosenAspects.some((a) => !ASPECTS.some((option) => option.id === a)))
  )
    return ["Choose distinct supported aspects, including the primary aspect."];
  if (
    [
      "spider_woman",
      "hawkeye",
      "gam",
      "spectrum",
      "warlock",
      "nebu",
      "warm",
      "valk",
      "vision",
      "ghost_spider",
      "spider_man_morales",
      "nova",
      "ironheart",
    ].includes(heroId)
  ) {
    const selected = chosenAspects || heroDeckAspects(heroId, codes, aspect);
    const errors = validateHeroDeck(heroId, selected, codes).errors;
    for (const code of codes)
      if (!hasExecutableScript(code))
        errors.push(
          `${card(code)?.name || code} does not have complete automated rules support.`,
        );
    return [...new Set(errors)];
  }
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
