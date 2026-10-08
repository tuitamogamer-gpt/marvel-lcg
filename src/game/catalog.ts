import packData from "../data/catalog-packs.json" with { type: "json" };
import deckData from "../data/catalog-decks.json" with { type: "json" };
import { CATALOG_CARDS, HEROES, card, deckCodes } from "./cards.js";

export interface Product {
  code: string;
  name: string;
  date_release: string;
  pack_type_code: string;
  typeLabel: string;
  soldSeparately: boolean;
  url: string;
}
export interface CatalogDeck {
  id: string;
  name: string;
  heroCode: string;
  packCode: string;
  aspect: string;
  aspects?: string[];
  cards: Record<string, number>;
  sourceUrl?: string;
  sourceType: string;
  sourceNote?: string;
  /** Permanent cards in the composition begin in play and do not count toward deck size. */
  deckSize?: number;
  setupCards?: Record<string, number>;
  supplementaryCards?: Record<string, number>;
}
export interface CatalogHero {
  id: string;
  code: string;
  alter: string;
  name: string;
  identity: string;
  packCode: string;
  product: Product;
  automated: boolean;
  aspect?: string;
  /** Includes additional identity forms such as Giant-Man and Ironheart's upgrades. */
  identityCodes: string[];
  decks: CatalogDeck[];
}

const labels: Record<string, string> = {
  core: "Core Set",
  hero: "Hero Pack",
  story: "Campaign Expansion",
  scenario: "Scenario Pack",
  encounter: "Free Modular Set",
};
export const PRODUCTS: Product[] = packData.map((p) => ({
  ...p,
  typeLabel:
    p.code === "cw"
      ? "Custom Scenario Expansion"
      : labels[p.pack_type_code] || "Expansion",
  soldSeparately: p.pack_type_code === "hero",
  url: `https://marvelcdb.com/set/${encodeURIComponent(p.code)}`,
}));
const productIndex = new Map(PRODUCTS.map((p) => [p.code, p]));
export function productForCard(code: string): Product | undefined {
  const c = card(code);
  return c?.pack_code ? productIndex.get(c.pack_code) : undefined;
}
/** All products supplying actual printings in this deck, including reprinted basic cards. */
export function productsForDeck(codes: string[]): Product[] {
  const packs = new Set(codes.map((code) => card(code)?.pack_code));
  return PRODUCTS.filter((p) => packs.has(p.code));
}
export function catalogDeckCodes(deck: CatalogDeck): string[] {
  return Object.entries(deck.cards).flatMap(([code, quantity]) =>
    Array(quantity).fill(code),
  );
}
const appStarters: CatalogDeck[] = HEROES.map((hero) => ({
  id: `app-${hero.id}-${hero.aspect}`,
  name: `${hero.name} / ${hero.aspect[0].toUpperCase()}${hero.aspect.slice(1)} starter`,
  heroCode: hero.code,
  packCode: card(hero.code).pack_code || "core",
  aspect: hero.aspect,
  cards: deckCodes(hero.id, hero.aspect).reduce<Record<string, number>>(
    (counts, code) => {
      counts[code] = (counts[code] || 0) + 1;
      return counts;
    },
    {},
  ),
  sourceType: "app-starter",
  ...(hero.id === "spectrum"
    ? { setupCards: { "21002": 1, "21003": 1, "21004": 1 }, deckSize: 40 }
    : {}),
  ...(hero.id === "warlock"
    ? { aspects: ["aggression", "justice", "leadership", "protection"] }
    : {}),
}));
export const STARTER_DECKS: CatalogDeck[] = [
  // JSON inference gives each deck optional keys belonging to other decks;
  // the importer and catalog tests validate actual counts as positive integers.
  ...(deckData as unknown as CatalogDeck[]),
  ...appStarters,
];

// Multi-form heroes represent one playable identity, not several different heroes.
const heroGroups = new Map<string, typeof CATALOG_CARDS>();
for (const c of CATALOG_CARDS) {
  if (!["hero", "alter_ego"].includes(c.type_code) || !c.set_code) continue;
  const key = `${c.pack_code}:${c.set_code}`;
  const group = heroGroups.get(key) || [];
  group.push(c);
  heroGroups.set(key, group);
}
export const CATALOG_HEROES: CatalogHero[] = [...heroGroups.values()]
  .flatMap((group) => {
    const face = group.find((c) => c.type_code === "hero");
    const alter = group.find((c) => c.type_code === "alter_ego");
    const product = face && productForCard(face.code);
    if (!face || !product || !alter) return [];
    const supported = HEROES.find((h) => h.code === face.code);
    const decks = STARTER_DECKS.filter((deck) => deck.heroCode === face.code);
    return [
      {
        id: supported?.id || `${face.pack_code}:${face.set_code}`,
        code: face.code,
        alter: alter.code,
        name: supported?.name || face.name,
        identity: supported?.identity || alter.name,
        packCode: product.code,
        product,
        automated: !!supported,
        aspect: supported?.aspect || decks[0]?.aspect,
        identityCodes: [
          ...new Set(
            group.flatMap((c) =>
              c.back_link && card(c.back_link)
                ? [c.code, c.back_link]
                : [c.code],
            ),
          ),
        ],
        decks,
      },
    ];
  })
  .sort((a, b) => {
    const order =
      PRODUCTS.findIndex((p) => p.code === a.packCode) -
      PRODUCTS.findIndex((p) => p.code === b.packCode);
    return order || a.code.localeCompare(b.code);
  });
export const CATALOG_SUMMARY = {
  products: PRODUCTS.length,
  heroes: CATALOG_HEROES.length,
  cardFaces: CATALOG_CARDS.length,
  heroPacks: PRODUCTS.filter((p) => p.pack_type_code === "hero").length,
  expansions: PRODUCTS.filter((p) => p.pack_type_code === "story").length,
  scenarioPacks: PRODUCTS.filter((p) => p.pack_type_code === "scenario").length,
};
