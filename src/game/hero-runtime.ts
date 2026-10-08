import catalogCards from "../data/catalog-cards.json" with { type: "json" };
import sourceDecks from "../data/catalog-decks.json" with { type: "json" };
import type { Card } from "./types.js";
import { SCRIPTED_HERO_IDS } from "./engine-support.js";
import { identityMatch } from "./unique.js";
import { printedCardMetadata } from "./printed-card-metadata.js";

type ImportedCard = Card & { duplicate_of?: string; permanent?: boolean };
export type HeroAspect =
  "aggression" | "justice" | "leadership" | "protection" | "pool";
export const HERO_ASPECTS: HeroAspect[] = [
  "aggression",
  "justice",
  "leadership",
  "protection",
  "pool",
];
const fourAspects: HeroAspect[] = [
  "aggression",
  "justice",
  "leadership",
  "protection",
];
const cardTypes = new Set([
  "ally",
  "event",
  "resource",
  "support",
  "upgrade",
  "player_side_scheme",
]);
const cards = (catalogCards as unknown as ImportedCard[]).map(
  printedCardMetadata,
) as ImportedCard[];
const byCode = new Map(cards.map((c) => [c.code, c]));
const plain = (s = "") => s.replace(/<[^>]*>/g, "");
export const isPermanent = (c: Card) =>
  (c as ImportedCard).permanent === true ||
  /(?:^|[.\n])\s*Permanent\b/.test(plain(c.text));

export interface HeroStarter {
  id: string;
  heroCode: string;
  cards: Record<string, number>;
  setupCards?: Record<string, number>;
  supplementaryCards?: Record<string, number>;
  aspect: string;
  aspects?: string[];
  deckSize?: number;
  sourceUrl?: string;
}
export interface HeroDeckRule {
  aspects: "one" | "two-equal" | "four-equal-singleton";
  exception?:
    | "six-attack-thwart-events"
    | "x-men-allies"
    | "player-side-schemes"
    | "three-shield-supports"
    | "energy-events";
}
export interface HeroRuntime {
  id: string;
  name: string;
  identity: string;
  code: string;
  alter: string;
  packCode: string;
  aliases: string[];
  identityCodes: string[];
  forms: Card[];
  signatureCards: Record<string, number>;
  setupCards: Record<string, number>;
  supplementaryCards: Record<string, number>;
  setupText: string[];
  obligationCodes: string[];
  nemesisCodes: string[];
  starters: HeroStarter[];
  deckRule: HeroDeckRule;
  /** Importing rules text does not install an executable ability. */
  scripted: boolean;
}

const coreIds = new Set([
  "spider_man",
  "captain_marvel",
  "she_hulk",
  "iron_man",
  "black_panther",
]);
const ruleFor = (id: string): HeroDeckRule => {
  if (id === "spider_woman") return { aspects: "two-equal" };
  if (id === "warlock") return { aspects: "four-equal-singleton" };
  const exceptions: Record<string, HeroDeckRule["exception"]> = {
    gam: "six-attack-thwart-events",
    cyclops: "x-men-allies",
    cable: "player-side-schemes",
    maria_hill: "three-shield-supports",
    wonder_man: "energy-events",
  };
  return {
    aspects: "one",
    ...(exceptions[id] ? { exception: exceptions[id] } : {}),
  };
};

export const HERO_RUNTIME: HeroRuntime[] = (
  sourceDecks as unknown as HeroStarter[]
).map((sourceStarter) => {
  // Ironheart's insert sets aside two physical, double-sided identity cards.
  // They are neither player-deck cards nor four separate identity faces.
  // https://hallofheroeslcg.com/wp-content/uploads/2022/04/insert.jpg
  const starter: HeroStarter =
    sourceStarter.heroCode === "29001a"
      ? {
          ...sourceStarter,
          supplementaryCards: { "29002a": 1, "29003a": 1 },
        }
      : sourceStarter;
  const front = byCode.get(starter.heroCode)!;
  const id = front.set_code!;
  const forms = cards.filter(
    (c) =>
      c.pack_code === front.pack_code &&
      c.set_code === id &&
      ["hero", "alter_ego"].includes(c.type_code),
  );
  const linked = new Set(forms.map((c) => c.code));
  for (const form of forms)
    if (form.back_link && byCode.has(form.back_link))
      linked.add(form.back_link);
  for (const c of cards)
    if (c.back_link && linked.has(c.back_link)) linked.add(c.code);
  const alter = forms.find((c) => c.type_code === "alter_ego")!;
  const signatureCards = Object.fromEntries(
    Object.entries(starter.cards).filter(
      ([code]) => byCode.get(code)?.set_code === id,
    ),
  );
  return {
    id,
    name: front.name,
    identity: alter.name,
    code: front.code,
    alter: alter.code,
    packCode: front.pack_code!,
    aliases: [`${front.pack_code}:${id}`, ...linked],
    identityCodes: [...linked],
    forms,
    signatureCards,
    setupCards: starter.setupCards || {},
    supplementaryCards: starter.supplementaryCards || {},
    setupText: forms
      .filter((c) => /Setup|begins the game/i.test(c.text || ""))
      .map((c) => plain(c.text)),
    obligationCodes: cards
      .filter((c) => c.type_code === "obligation" && c.set_code === id)
      .map((c) => c.code),
    nemesisCodes: cards
      .filter((c) => c.set_code === `${id}_nemesis`)
      .map((c) => c.code),
    starters: [starter],
    deckRule: ruleFor(id),
    scripted: SCRIPTED_HERO_IDS.has(id),
  };
});
const heroes = new Map(
  HERO_RUNTIME.flatMap((h) =>
    [h.id, ...h.aliases].map((alias) => [alias, h] as const),
  ),
);
export const heroRuntime = (idOrCode: string): HeroRuntime | undefined =>
  heroes.get(idOrCode);
export const heroRequiredCards = (idOrCode: string) =>
  heroRuntime(idOrCode)?.signatureCards || {};
export const heroSetupCards = (idOrCode: string) =>
  heroRuntime(idOrCode)?.setupCards || {};
export const heroSupplementaryCards = (idOrCode: string) =>
  heroRuntime(idOrCode)?.supplementaryCards || {};
export const heroDeckRule = (idOrCode: string) =>
  heroRuntime(idOrCode)?.deckRule;
export const heroStarterCodes = (idOrCode: string) =>
  Object.entries(heroRuntime(idOrCode)?.starters[0].cards || {}).flatMap(
    ([code, quantity]) => Array(quantity).fill(code) as string[],
  );

export function heroStarterAspects(idOrCode: string): HeroAspect[] {
  const hero = heroRuntime(idOrCode);
  if (!hero) return [];
  if (hero.deckRule.aspects === "four-equal-singleton") return [...fourAspects];
  const counts = new Map<HeroAspect, number>();
  for (const code of heroStarterCodes(idOrCode)) {
    const c = byCode.get(code)!;
    if (
      c.set_code === hero.id ||
      !HERO_ASPECTS.includes(c.faction_code as HeroAspect)
    )
      continue;
    const faction = c.faction_code as HeroAspect;
    counts.set(faction, (counts.get(faction) || 0) + 1);
  }
  if (hero.deckRule.aspects === "two-equal")
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([aspect]) => aspect);
  const primary = hero.starters[0].aspect;
  if (HERO_ASPECTS.includes(primary as HeroAspect))
    return [primary as HeroAspect];
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([aspect]) => aspect);
}

/** Chosen aspects come from customizable cards; signature colors are mandatory
 * regardless of the chosen pair. The complete composition proves equality. */
export function heroDeckAspects(
  idOrCode: string,
  codes: string[],
  primary?: string,
): HeroAspect[] {
  const hero = heroRuntime(idOrCode);
  if (hero?.deckRule.aspects === "four-equal-singleton")
    return [...fourAspects];
  if (!hero || hero.deckRule.aspects !== "two-equal")
    return primary && HERO_ASPECTS.includes(primary as HeroAspect)
      ? [primary as HeroAspect]
      : heroStarterAspects(idOrCode);
  const selected = [
    ...new Set(
      codes.flatMap((code) => {
        const c = byCode.get(code);
        return c &&
          c.set_code !== hero.id &&
          HERO_ASPECTS.includes(c.faction_code as HeroAspect)
          ? [c.faction_code as HeroAspect]
          : [];
      }),
    ),
  ];
  if (
    primary &&
    HERO_ASPECTS.includes(primary as HeroAspect) &&
    !selected.includes(primary as HeroAspect)
  )
    selected.unshift(primary as HeroAspect);
  return selected.length ? selected : heroStarterAspects(idOrCode);
}

/** Printed copy limit; unique cards match by title and subtitle under RRG1.8. */
export function heroCardCopyLimit(c: Card): number {
  const printed = /Max\s+(\d+)\s+per deck/i.exec(plain(c.text));
  return Math.min(
    c.deck_limit ?? 3,
    printed ? Number(printed[1]) : 3,
    c.is_unique ? 1 : Infinity,
  );
}
const matchingKey = (c: Card) =>
  c.is_unique ? `${c.name}\u0000${c.subname || ""}` : c.name;
const hasTrait = (c: Card, trait: string) =>
  (c.traits || "")
    .replace(/\.$/, "")
    .split(/\.\s+/)
    .some((s) => s.trim().toLowerCase() === trait.toLowerCase());

/** Gamora's exception changes eligible events, not the chosen aspect count. */
export function heroAllowsOffAspectEvent(idOrCode: string, c: Card): boolean {
  return (
    heroDeckRule(idOrCode)?.exception === "six-attack-thwart-events" &&
    HERO_ASPECTS.includes(c.faction_code as HeroAspect) &&
    c.type_code === "event" &&
    (hasTrait(c, "Attack") || hasTrait(c, "Thwart"))
  );
}

export interface HeroDeckValidation {
  valid: boolean;
  heroId?: string;
  deckSize: number;
  compositionSize: number;
  aspects: HeroAspect[];
  errors: string[];
}
export function validateHeroDeck(
  idOrCode: string,
  selectedAspects: string[],
  input: unknown,
): HeroDeckValidation {
  const hero = heroRuntime(idOrCode);
  const errors: string[] = [];
  const codes =
    Array.isArray(input) && input.every((c) => typeof c === "string")
      ? (input as string[])
      : [];
  if (!Array.isArray(input) || !input.every((c) => typeof c === "string"))
    errors.push("The deck must be a list of card codes.");
  const aspects = selectedAspects.filter((a): a is HeroAspect =>
    HERO_ASPECTS.includes(a as HeroAspect),
  );
  if (!hero) errors.push("Unknown hero identity.");
  if (
    aspects.length !== selectedAspects.length ||
    new Set(aspects).size !== aspects.length
  )
    errors.push("Choose distinct supported aspects.");
  const known = codes.map((code) => byCode.get(code));
  const deckSize = known.reduce(
    (n, c) => n + (c && !isPermanent(c) ? 1 : 0),
    0,
  );
  if (deckSize < 40 || deckSize > 50)
    errors.push(
      `A hero deck needs 40–50 cards, excluding Permanent cards (currently ${deckSize}).`,
    );
  if (!hero)
    return {
      valid: false,
      deckSize,
      compositionSize: codes.length,
      aspects,
      errors,
    };
  const rule = hero.deckRule;
  if (rule.aspects === "one" && aspects.length !== 1)
    errors.push("Choose exactly one aspect for this hero.");
  if (rule.aspects === "two-equal" && aspects.length !== 2)
    errors.push("Spider-Woman must choose exactly two aspects.");
  if (
    rule.aspects === "four-equal-singleton" &&
    (aspects.length !== 4 || !fourAspects.every((a) => aspects.includes(a)))
  )
    errors.push("Adam Warlock must use all four standard aspects.");

  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) || 0) + 1);
  for (const [code, quantity] of Object.entries(hero.signatureCards)) {
    if (counts.get(code) !== quantity)
      errors.push(
        `Include exactly ${quantity} ${byCode.get(code)?.name || code} from the hero’s signature set.`,
      );
  }
  const names = new Map<string, { count: number; card: Card; limit: number }>();
  let offAspectEvents = 0;
  const shieldSupports = new Set<string>();
  const aspectCounts = Object.fromEntries(aspects.map((a) => [a, 0])) as Record<
    string,
    number
  >;
  for (const [index, code] of codes.entries()) {
    const c = known[index];
    if (!c) {
      errors.push(`Unknown card ${code}.`);
      continue;
    }
    const signature =
      c.set_code === hero.id && Object.hasOwn(hero.signatureCards, code);
    const key = matchingKey(c);
    const previous = names.get(key);
    const signatureLimit = Object.entries(hero.signatureCards).reduce(
      (n, [signatureCode, quantity]) =>
        n + (matchingKey(byCode.get(signatureCode)!) === key ? quantity : 0),
      0,
    );
    names.set(key, {
      card: c,
      count: (previous?.count || 0) + 1,
      limit: Math.min(
        previous?.limit ?? Infinity,
        signature ? signatureLimit : heroCardCopyLimit(c),
        rule.aspects === "four-equal-singleton" && !signature ? 1 : Infinity,
      ),
    });
    if (signature) {
      // Jessica's colored signatures belong to their printed aspect when
      // counting the two chosen colors, even though they are required in every deck.
      if (
        rule.aspects === "two-equal" &&
        aspects.includes(c.faction_code as HeroAspect)
      )
        aspectCounts[c.faction_code]++;
      continue;
    }
    if (
      !cardTypes.has(c.type_code) ||
      !["basic", ...HERO_ASPECTS].includes(c.faction_code)
    ) {
      errors.push(
        `${c.name} is not a customizable player card for this identity.`,
      );
      continue;
    }
    const teamUp = /Team-Up\s*\(([^)]+)\)/i.exec(plain(c.text));
    if (
      teamUp &&
      !teamUp[1].split(/\s+and\s+/i).some((name) => {
        const [title, alterName] = name.split("/");
        return (
          hero.forms.some(
            (f) => f.name.toLowerCase() === title.toLowerCase(),
          ) &&
          (!alterName ||
            alterName.toLowerCase() === hero.identity.toLowerCase())
        );
      })
    )
      errors.push(`${c.name} requires a named Team-Up identity.`);
    if (identityMatch(hero.id, c))
      errors.push(
        `${c.name} matches this identity and cannot be included as an ally.`,
      );
    if (c.faction_code === "basic") continue;
    if (aspects.includes(c.faction_code as HeroAspect)) {
      aspectCounts[c.faction_code]++;
      continue;
    }
    let allowed = false;
    switch (rule.exception) {
      case "six-attack-thwart-events":
        allowed = heroAllowsOffAspectEvent(hero.id, c);
        if (allowed) offAspectEvents++;
        break;
      case "x-men-allies":
        allowed = c.type_code === "ally" && hasTrait(c, "X-Men");
        break;
      case "player-side-schemes":
        allowed = c.type_code === "player_side_scheme";
        break;
      case "three-shield-supports":
        allowed = c.type_code === "support" && hasTrait(c, "S.H.I.E.L.D");
        if (allowed) shieldSupports.add(c.name);
        break;
      case "energy-events":
        allowed = c.type_code === "event" && Number(c.resource_energy || 0) > 0;
        break;
    }
    if (!allowed)
      errors.push(`${c.name} is outside this hero’s chosen aspects.`);
  }
  for (const { count, card, limit } of names.values())
    if (count > limit)
      errors.push(
        `${card.name} has ${count} copies; its deck limit is ${limit}.`,
      );
  if (offAspectEvents > 6)
    errors.push(
      "Gamora may include at most 6 off-aspect Attack/Thwart events.",
    );
  if (shieldSupports.size > 3)
    errors.push(
      "Maria Hill may include at most 3 different off-aspect S.H.I.E.L.D. supports.",
    );
  if (
    ["two-equal", "four-equal-singleton"].includes(rule.aspects) &&
    new Set(Object.values(aspectCounts)).size > 1
  )
    errors.push(
      rule.aspects === "two-equal"
        ? "Spider-Woman requires an equal number of cards from each chosen aspect, including signature cards of those colors."
        : "This identity requires an equal number of non-signature cards from each chosen aspect.",
    );
  return {
    valid: errors.length === 0,
    heroId: hero.id,
    deckSize,
    compositionSize: codes.length,
    aspects,
    errors: [...new Set(errors)],
  };
}
