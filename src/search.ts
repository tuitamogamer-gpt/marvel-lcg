/** Match names, card codes and traits without requiring printed punctuation. */
export function searchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’./]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchTerms(query: string): string[] {
  return searchText(query).split(/\s+/).filter(Boolean);
}

/** A term also matches across word breaks, so "spiderman" finds Spider-Man. */
export function matchesSearch(text: string, terms: string[]): boolean {
  let compact: string | undefined;
  return terms.every(
    (term) =>
      text.includes(term) ||
      (compact ??= text.replace(/ /g, "")).includes(term),
  );
}
