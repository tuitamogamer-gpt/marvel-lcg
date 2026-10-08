import catalogCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay } from "./team.js";
import type { Card, GameState } from "./types.js";
import { printedCardMetadata } from "./printed-card-metadata.js";

const cards = (catalogCards as unknown as Card[]).map(printedCardMetadata);
const byCode = new Map(cards.map((c) => [c.code, c]));
const normalize = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

interface IdentityNames {
  faces: Card[];
  titles: Set<string>;
  secondary: Set<string>;
}
const identities = new Map<string, IdentityNames>();
const identityFaces = new Map<string, IdentityNames>();
for (const c of cards) {
  if (!["hero", "alter_ego"].includes(c.type_code) || !c.set_code) continue;
  const key = `${c.pack_code}:${c.set_code}`;
  const identity = identities.get(key) || {
    faces: [],
    titles: new Set<string>(),
    secondary: new Set<string>(),
  };
  identity.faces.push(c);
  (c.type_code === "hero" ? identity.titles : identity.secondary).add(
    normalize(c.name),
  );
  identities.set(key, identity);
  identityFaces.set(c.code, identity);
}
for (const [key, identity] of [...identities]) {
  const canonical = identity.faces[0].set_code!;
  if (!identities.has(canonical)) identities.set(canonical, identity);
  // Canonical set IDs and explicit pack:set aliases both identify the same identity.
  identities.set(key, identity);
}
function names(c: Card) {
  if (["hero", "alter_ego"].includes(c.type_code)) {
    const identity =
      identityFaces.get(c.code) ||
      identities.get(`${c.pack_code}:${c.set_code}`);
    if (identity) return identity;
  }
  return {
    titles: new Set([normalize(c.name)]),
    secondary: new Set(c.subname ? [normalize(c.subname)] : []),
  };
}
function overlap(a: Set<string>, b: Set<string>) {
  return [...a].some((name) => b.has(name));
}

/** RRG 1.8: titles alone match only without secondary titles; otherwise a
 * subtitle/alter-ego title must match a title or another secondary title.
 * Typographic apostrophes are equivalent across imported printings. */
export function uniqueMatches(a: Card, b: Card): boolean {
  a = printedCardMetadata(a);
  b = printedCardMetadata(b);
  if (!a.is_unique || !b.is_unique) return false;
  const left = names(a),
    right = names(b);
  return (
    (!left.secondary.size &&
      !right.secondary.size &&
      overlap(left.titles, right.titles)) ||
    overlap(left.secondary, right.titles) ||
    overlap(left.secondary, right.secondary) ||
    overlap(right.secondary, left.titles)
  );
}

/** Deckbuilding compares with the complete identity, regardless of active face. */
export function identityMatch(heroId: string, c: Card): boolean {
  const identity = identities.get(heroId) || identityFaces.get(heroId);
  return !!identity?.faces.some((face) => uniqueMatches(face, c));
}

/** Non-villain cards cannot enter play while a matching unique card is in play.
 * Eliminated identities have left play; villains retain the RRG exception. */
export function uniqueConflict(
  s: GameState,
  c: Card,
  excludeId?: string,
): boolean {
  c = printedCardMetadata(c);
  if (!c.is_unique || c.type_code === "villain") return false;
  if (
    s.players.some((seat) => !seat.eliminated && identityMatch(seat.heroId, c))
  )
    return true;
  return [
    s.villain,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...allInPlay(s),
  ].some((piece) => {
    if (piece.id === excludeId) return false;
    const existing = byCode.get(piece.code);
    return existing && uniqueMatches(c, existing);
  });
}
