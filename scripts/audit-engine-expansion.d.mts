export const AUDIT_SCHEMA_VERSION: number;
export const RULES_REFERENCE_URL: string;
export const KEYWORDS: string[];
export const MECHANICS: {
  id: string;
  test?: RegExp;
  types?: string[];
  fields?: string[];
  primitive: string;
  baseline: string;
}[];
export function normalizeRules(text?: string): string;
export function candidatePatterns(card: object): string[];
export function abilityBlocks(card: object): string[];
export function printedKeywords(card: object): string[];
export function semanticFingerprint(card: object): string;
export function auditCatalog(input: {
  cards: object[];
  coreCards: object[];
  packs: object[];
  sets: object[];
  decks: object[];
  engineSource?: string;
}): Record<string, unknown>;
export function generateAudit(root?: string): Promise<Record<string, unknown>>;
