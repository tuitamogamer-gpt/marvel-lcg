import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** This is a triage inventory, never a natural-language rules interpreter. */
export const AUDIT_SCHEMA_VERSION = 1;
export const RULES_REFERENCE_URL =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf";

export function normalizeRules(text = "") {
  return text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const unique = (items) => [...new Set(items)].sort();
const timingExpression =
  /\b(?:Alter-Ego (?:Action|Response|Interrupt|Resource)|Hero (?:Action|Response|Interrupt|Resource)|Forced (?:Response|Interrupt)|Action|Response|Interrupt|Resource|When Revealed|When Defeated|When Completed|Setup|Special|Boost)\b(?=\s*(?:\([^)]*\)\s*)?:)/g;

export const KEYWORDS = [
  "Alliance",
  "Assault",
  "Form",
  "Guard",
  "Hinder",
  "Incite",
  "Linked",
  "Overkill",
  "Patrol",
  "Peril",
  "Permanent",
  "Piercing",
  "Quickstrike",
  "Ranged",
  "Requirement",
  "Restricted",
  "Retaliate",
  "Setup",
  "Stalwart",
  "Steady",
  "Surge",
  "Team-Up",
  "Teamwork",
  "Temporary",
  "Toughness",
  "Uses",
  "Victory",
  "Villainous",
  // New products additionally define these terms in their own rules inserts.
  "Prerequisite",
  "Vulnerable",
];

/** A mention is an implementation dependency, not evidence that a card has a keyword. */
export const MECHANICS = [
  {
    id: "attack_damage",
    test: /\battack(?:s|ed|ing)?\b|\bdamage\b/i,
    primitive:
      "attack/damage contexts, attacker/source/target, defeat and excess damage",
    baseline: "Core contexts; expansion modifiers and hooks require scripts",
  },
  {
    id: "thwart_threat",
    test: /\bthwart(?:s|ed|ing)?\b|\bthreat\b/i,
    primitive:
      "thwart and threat contexts with legal targets and actual removed amounts",
    baseline: "Core main and encounter side schemes",
  },
  {
    id: "healing",
    test: /\bheal(?:s|ed|ing)?\b|\bhit points?\b/i,
    primitive:
      "damage healing vs hit-point maximum changes, source and actual amounts",
    baseline: "Core healing and two specific HP upgrades",
  },
  {
    id: "draw_discard",
    test: /\bdraw\b|\bdiscard\b/i,
    primitive:
      "ordered draw/discard, replacement windows, deck exhaustion and ownership",
    baseline:
      "Core operations exist; triggered replacement hooks remain specific",
  },
  {
    id: "ready_exhaust",
    test: /\bready\b|\bexhaust(?:s|ed|ing)?\b/i,
    primitive:
      "ready/exhaust costs, eligible targets and non-exhausting basic powers",
    baseline: "Core operations",
  },
  {
    id: "search_shuffle",
    test: /\bsearch\b|\bshuffle\b/i,
    primitive:
      "filtered searches in specified zones, optional failed search, reveal and shuffle",
    baseline: "Several Core searches; general intentional failed search absent",
  },
  {
    id: "look_reveal",
    test: /\blook at\b|\breveal(?:s|ed|ing)?\b|\bfaceup\b/i,
    primitive: "public/private views, peeking and play/reveal distinction",
    baseline: "Core hidden information boundary and encounter reveal",
  },
  {
    id: "move_zones",
    test: /\breturn\b|\bput .+ into play\b|\bset aside\b|\bremove .+ from the game\b|\bswap\b/i,
    primitive:
      "typed zone transitions, resets, preserve-orientation swaps and ownership",
    baseline: "Core transitions with limited named-card exceptions",
  },
  {
    id: "status_cards",
    test: /\bstun(?:ned)?\b|\bconfus(?:e|ed)\b|\btough\b|\bstatus cards?\b/i,
    primitive:
      "counted statuses, priority, Steady/Stalwart and per-character limits",
    baseline: "Single boolean per status; multiple status cards absent",
  },
  {
    id: "named_counters",
    test: /\bcounters?\b/i,
    primitive:
      "named counters on identities, schemes, supports and attachments; transfers and caps",
    baseline:
      "Single unnamed Piece.counters; identities do not have counter map",
  },
  {
    id: "paid_resources",
    test: /\bpaid\b|\bpaying\b|\bspend\b|\bgenerate\b|\bresources?\b/i,
    primitive:
      "atomic typed costs, paid-resource context, ability resource sources, Alliance",
    baseline:
      "Core payment sources and requirements; named sources are hardcoded",
  },
  {
    id: "cost_modifiers",
    test: /\bcost\b|\bdiscount\b/i,
    primitive:
      "play origin/traits/aspect/form aware discounts and cost replacements",
    baseline: "Single phase discount and Power-of aspect cards",
  },
  {
    id: "continuous_modifiers",
    test: /\bgets? [+-]|\bgains?\b|\bincrease\b|\breduce\b|\bdouble\b/i,
    primitive: "layered derived stats, traits, keywords, limits and blanking",
    baseline: "Core modifiers keyed to individual card codes",
  },
  {
    id: "attachment_targets",
    test: /\battach(?:ed)?\b|\bdetach\b/i,
    primitive:
      "general attachment graph, eligible targets and leave-play cleanup",
    baseline: "Core player/enemy/ally attachment paths",
  },
  {
    id: "choice_distribution",
    test: /\bchoose\b|\bamong\b|\bup to\b|\beach\b/i,
    primitive: "legal target sets, distributions and simultaneous resolution",
    baseline: "Choice/select prompts; some area damage is queued sequentially",
  },
  {
    id: "conditional_effects",
    test: /\bif\b|\bunless\b|\binstead\b|\bthen\b|\botherwise\b/i,
    primitive: "conditions, changed-game checks and then dependencies",
    baseline: "Per-card conditions; no general conditional rules interpreter",
  },
  {
    id: "ability_limits",
    test: /\blimit\b|\bmax\b|\bonce per\b/i,
    primitive:
      "per-instance, per-player and group limits with explicit reset scope",
    baseline: "Core flags and used marker",
  },
  {
    id: "delayed_effects",
    test: /\bat the end\b|\buntil the end\b|\bnext (?:attack|turn|round|phase)\b|\bafter .+ begins\b/i,
    primitive: "scheduled delayed effects and duration expiration",
    baseline: "Named Core end-round effects and phase-reset flags",
  },
  {
    id: "interrupt_replacement",
    test: /\bInterrupt\b|\bwould\b|\binstead\b/i,
    primitive:
      "priority windows, replacement ordering and cancel/replacement restart",
    baseline: "Specific Core interrupts; no general nested trigger stack",
  },
  {
    id: "responses",
    test: /\bResponse\b/i,
    primitive:
      "forced then optional responses in player-chosen order, pass/reopen tracking",
    baseline:
      "Specific Core response prompts; some entrances automatically resolved",
  },
  {
    id: "control_ownership",
    test: /\bcontrol\b|\bowner\b|\bplayer's\b/i,
    primitive: "owner, controller and zone holder as distinct identifiers",
    baseline: "Core ownerId and seat views; transfer paths are specific",
  },
  {
    id: "multiplayer",
    test: /\beach player\b|\bany player\b|\bchoose a player\b|\bother players?\b|\bteam\b|\[per_hero\]/i,
    primitive:
      "1–4 seats, actor/target/controller routing, Peril and collective costs",
    baseline: "Solo and 2–3 hero hotseat; 4 seats currently rejected",
  },
  {
    id: "form_state",
    test: /\bform\b|\bflip\b|\bchange to\b|\bidentit(?:y|ies)\b/i,
    primitive:
      "arbitrary identity and linked form cards, swap and form-trigger windows",
    baseline: "Two forms hero/alter per identity",
  },
  {
    id: "special_decks",
    test: /\b(?:invocation|weather|sense|labor|gift|infinity|state|experimental|crime|evidence)\b[^.]*\bdeck\b|\b(?:deck of|separate deck|other deck)\b/i,
    primitive:
      "named auxiliary decks with bespoke shuffle, ordering and recycling rules",
    baseline: "Player and encounter decks only",
  },
  {
    id: "cards_under",
    test: /\btuck(?:ed)?\b|\bunder (?:here|this|that|[A-Z])\b|\bfacedown .+ (?:here|attached)\b/i,
    primitive:
      "cards-under zones retaining owner, face and visibility plus play-as-hand permission",
    baseline:
      "Core capturedPiece for a single encounter; general tucked zone absent",
  },
  {
    id: "victory_display",
    test: /\bVictory\b|\bvictory display\b/i,
    primitive:
      "global victory display and dependent card counts, removal and persistence",
    baseline: "Absent",
  },
  {
    id: "campaign_state",
    test: /\bcampaign\b|\bcampaign pool\b/i,
    primitive:
      "campaign schema, scenario transitions, deck changes, rewards and consequences",
    baseline: "Absent",
  },
  {
    id: "multiple_villains",
    test: /\beach villain\b|\ball villains\b|\bother villains?\b|\bactive villain\b|\bswap .+ villain\b/i,
    primitive:
      "villain roster, active villain, independent HP/status and activation order",
    baseline: "One GameState.villain",
  },
  {
    id: "multiple_main_schemes",
    test: /\beach main scheme\b|\bother main scheme\b|\ball main schemes\b|\bmain schemes\b/i,
    primitive:
      "main scheme graph with parallel stages, independent threat and failure conditions",
    baseline: "One GameState.scheme",
  },
  {
    id: "leaders_civil_war",
    test: /\bleader\b|\bregistration\b|\bteam's\b/i,
    types: ["leader"],
    primitive: "Civil War teams, leaders and scenario builder rules",
    baseline: "Absent",
  },
  {
    id: "environments",
    types: ["environment"],
    primitive:
      "global environment zone with constant effects and scenario lifecycle",
    baseline: "Environment cards excluded from encounter construction",
  },
  {
    id: "player_side_schemes",
    test: /\bplayer side scheme\b/i,
    types: ["player_side_scheme"],
    primitive:
      "player-owned side schemes, play costs/limits, thwart and victory routing",
    baseline: "Absent",
  },
  {
    id: "evidence",
    test: /\bevidence\b|\bpheromone\b/i,
    types: ["evidence_means", "evidence_motive", "evidence_opportunity"],
    primitive:
      "Fear No Evil evidence decks, types, collection, swapping and case rules",
    baseline: "Absent",
  },
  {
    id: "deck_construction",
    test: /\bdeck-building\b|\binclude .+ (?:aspect|deck)\b|\bper deck\b|\bchosen aspect\b/i,
    primitive:
      "hero-specific deck restrictions, multi-aspect counts, supplementary/Permanent cards",
    baseline: "Core identity + one of four aspects + Basic, 40–50 cards",
  },
  {
    id: "printed_scaling",
    fields: [
      "cost_per_hero",
      "health_per_hero",
      "health_per_group",
      "base_threat_per_group",
      "threat_per_group",
    ],
    primitive:
      "typed scalar expressions bound to starting players or scenario-defined groups",
    baseline:
      "Core villain HP scales by starting player count; group/per-card scaling absent",
  },
  {
    id: "printed_star_stats",
    fields: [
      "attack_star",
      "thwart_star",
      "defense_star",
      "recover_star",
      "health_star",
      "scheme_star",
      "cost_star",
      "base_threat_star",
      "threat_star",
      "escalation_threat_star",
    ],
    primitive:
      "printed star annotations tied to the specific ability that changes a stat",
    baseline: "Core-specific stat functions and code branches",
  },
  {
    id: "structured_deck_rules",
    fields: ["deck_options", "deck_requirements"],
    primitive:
      "declarative deck restrictions with cross-aspect filters, caps and equality checks",
    baseline: "Absent outside Core identity and aspect restrictions",
  },
  {
    id: "scenario_setup",
    test: /\bSetup\b|\bWhen Revealed\b/i,
    types: ["main_scheme"],
    primitive:
      "declarative setup and stage graph, modular constraints and scenario-specific assets",
    baseline: "Three Core villains with fixed setup functions",
  },
  {
    id: "encounter_icons",
    test: /\[(?:acceleration|crisis|hazard|amplify)\]/i,
    fields: [
      "scheme_acceleration",
      "scheme_crisis",
      "scheme_hazard",
      "scheme_amplify",
    ],
    primitive:
      "derived encounter icon totals, suppression, caps and active scheme binding",
    baseline: "Core crisis, acceleration and hazard",
  },
  {
    id: "blanking_immunity",
    test: /\bblank\b|\bimmune\b|\bcannot (?:take|be|leave|attack|thwart|have)\b/i,
    primitive:
      "capability restrictions, immunities, temporary blanking and Permanent exceptions",
    baseline: "Named Core immunity checks",
  },
  {
    id: "copying_play_permissions",
    test: /\bas if\b|\bcopy\b|\bprinted .+ (?:ability|text)\b/i,
    primitive:
      "play origin permissions and copy contexts with source-local state",
    baseline: "Named Core return-ally mechanism; generic copying absent",
  },
  {
    id: "keyword_changes",
    test: /\b(?:gain|gains|lose|loses|ignore|ignores).+\b(?:keyword|overkill|ranged|piercing|retaliate|guard|patrol|stalwart|steady)\b/i,
    primitive: "derived keywords and flags scoped to individual attack/effect",
    baseline: "Core overkill and limited code-specific keyword handling",
  },
  {
    id: "defeat_elimination",
    test: /\bdefeat(?:ed)?\b|\beliminat(?:ed|ion)\b/i,
    primitive:
      "defeat replacements, last-known information, owner elimination cleanup",
    baseline: "Core defeat, stage advance and eliminated-player cleanup",
  },
  {
    id: "player_cards_as_encounters",
    test: /\bfacedown (?:Drone|minion)\b|\b(?:your|player) deck[^.]*\bminion\b|\binsert .+ encounter\b/i,
    primitive:
      "foreign card instances, capture and correct owner discard/return",
    baseline: "Ultron droneCard/capturedPiece implementation",
  },
];

const pureCandidates = [
  {
    id: "simple_attack_event",
    types: ["event"],
    expression:
      /^Hero Action \(attack\): Deal (\d+) damage to (an enemy|a minion|the villain)\.$/,
  },
  {
    id: "simple_thwart_event",
    types: ["event"],
    expression:
      /^Hero Action \(thwart\): Remove (\d+) threat from (a scheme|the main scheme|a side scheme)\.$/,
  },
  {
    id: "simple_heal_event",
    types: ["event"],
    expression:
      /^(?:Hero |Alter-Ego )?Action: Heal (\d+) damage from (your hero|your identity|any character|a friendly character)\.$/,
  },
  {
    id: "simple_ready_event",
    types: ["event"],
    expression: /^(?:Hero )?Action: Ready (your hero|an ally)\.$/,
  },
  {
    id: "simple_draw_event",
    types: ["event"],
    expression: /^(?:Hero |Alter-Ego )?Action: Draw (\d+) cards?\.$/,
  },
  {
    id: "simple_self_entrance_ally",
    types: ["ally"],
    expression:
      /^(?:Forced )?Response: After ([^,.]+) enters play, (?:remove (\d+) threat from (?:a scheme|the main scheme)|draw (\d+) cards?|confuse the villain|stun an enemy|deal (\d+) damage to (?:an enemy|each enemy)|each player draws (\d+) cards?)\.$/,
    selfSubject: true,
  },
  {
    id: "simple_stat_upgrade",
    types: ["upgrade", "support"],
    expression:
      /^(?:Play under any player's control\. )?(?:Max 1 per player\. )?(?:Your hero gets \+(\d+) (?:ATK|THW|DEF)|Your alter-ego gets \+(\d+) REC|You get \+(\d+) hit points)\.$/,
  },
  {
    id: "simple_ally_hp_support",
    types: ["support"],
    expression:
      /^Play under any player's control\. Max 1 per player\. Each ally you control gets \+(\d+) hit points?\.$/,
  },
  {
    id: "keyword_only_ally",
    types: ["ally"],
    expression:
      /^(?:Toughness\. \(This character enters play with a tough status card\.\)|Toughness\.|Retaliate \d+\.|Ranged\.|)$/,
  },
];

export function candidatePatterns(card) {
  const text = normalizeRules(card.text);
  return pureCandidates
    .filter((pattern) => {
      if (!pattern.types.includes(card.type_code)) return false;
      const match = pattern.expression.exec(text);
      return match && (!pattern.selfSubject || match[1] === card.name);
    })
    .map((pattern) => pattern.id);
}

export function abilityBlocks(card) {
  const text = normalizeRules(card.text);
  const starts = [...text.matchAll(timingExpression)].map(
    (match) => match.index,
  );
  const boundaries = unique([0, ...starts, text.length])
    .map(Number)
    .sort((a, b) => a - b);
  const blocks = boundaries
    .slice(0, -1)
    .map((start, index) => text.slice(start, boundaries[index + 1]).trim())
    .filter(Boolean);
  if (card.boost_text) blocks.push(`Boost: ${normalizeRules(card.boost_text)}`);
  return blocks;
}

export function printedKeywords(card) {
  const text = normalizeRules(card.text);
  const prefix = text.split(timingExpression)[0] || "";
  return KEYWORDS.filter((keyword) =>
    new RegExp(`(?:^|[.!])\\s*(?:\\[star\\]\\s*)?${keyword}\\b`, "i").test(
      prefix,
    ),
  );
}

export function semanticFingerprint(card) {
  // A name/subname or trait difference can change legality even when effects match.
  const fields = [
    "name",
    "subname",
    "type_code",
    "faction_code",
    "traits",
    "cost",
    "cost_per_hero",
    "cost_star",
    "attack",
    "attack_cost",
    "attack_star",
    "thwart",
    "thwart_cost",
    "thwart_star",
    "defense",
    "defense_star",
    "recover",
    "recover_star",
    "health",
    "health_per_hero",
    "health_per_group",
    "health_star",
    "hand_size",
    "scheme",
    "scheme_star",
    "boost",
    "boost_star",
    "stage",
    "base_threat",
    "base_threat_fixed",
    "base_threat_per_group",
    "base_threat_star",
    "threat",
    "threat_fixed",
    "threat_per_group",
    "threat_star",
    "escalation_threat",
    "escalation_threat_fixed",
    "escalation_threat_star",
    "scheme_crisis",
    "scheme_hazard",
    "scheme_acceleration",
    "scheme_amplify",
    "resource_energy",
    "resource_mental",
    "resource_physical",
    "resource_wild",
    "is_unique",
    "deck_limit",
    "deck_options",
    "deck_requirements",
    "permanent",
    "double_sided",
    "back_name",
    "back_text",
  ];
  const setScope =
    card.faction_code === "hero" ||
    card.faction_code === "encounter" ||
    /\bcampaign\b/i.test(card.text || "")
      ? `${card.pack_code}:${card.set_code}`
      : null;
  return hash(
    JSON.stringify({
      ...Object.fromEntries(
        fields.map((field) => [field, card[field] ?? null]),
      ),
      setScope,
      text: normalizeRules(card.text),
      boost_text: normalizeRules(card.boost_text),
    }),
  );
}

function frequencies(records, key) {
  const map = new Map();
  for (const record of records) {
    for (const value of record[key] || []) {
      const list = map.get(value) || [];
      list.push(record.code);
      map.set(value, list);
    }
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, codes]) => ({ id, faces: codes.length, codes }));
}

export function auditCatalog({
  cards,
  coreCards,
  packs,
  sets,
  decks,
  engineSource = "",
}) {
  const nativeCodes = new Set(coreCards.map((card) => card.code));
  const abilityMap = new Map();
  const semantics = new Map();
  const records = cards.map((card) => {
    const text = normalizeRules(card.text);
    const abilities = abilityBlocks(card).map((block) => {
      const id = hash(block);
      const existing = abilityMap.get(id) || {
        id,
        normalizedText: block,
        codes: [],
      };
      existing.codes.push(card.code);
      abilityMap.set(id, existing);
      return id;
    });
    const fingerprint = semanticFingerprint(card);
    const identical = semantics.get(fingerprint) || [];
    identical.push(card.code);
    semantics.set(fingerprint, identical);
    const mechanics = MECHANICS.filter(
      (mechanic) =>
        mechanic.test?.test(text) ||
        mechanic.types?.includes(card.type_code) ||
        mechanic.fields?.some((field) => !!card[field]),
    ).map(({ id }) => id);
    return {
      code: card.code,
      name: card.name,
      type: card.type_code,
      pack: card.pack_code,
      set: card.set_code,
      baseline: nativeCodes.has(card.code)
        ? "native_core_baseline"
        : "imported_requires_implementation",
      // Neither field confers eligibility to the automated engine.
      candidatePatterns: candidatePatterns(card),
      semanticFingerprint: fingerprint,
      abilityIds: unique(abilities),
      timings: unique(
        [...text.matchAll(timingExpression)].map((match) => match[0]),
      ),
      printedKeywords: printedKeywords(card),
      keywordMentions: KEYWORDS.filter((keyword) =>
        new RegExp(`\\b${keyword}\\b`, "i").test(text),
      ),
      mechanics,
    };
  });
  const byCode = new Map(records.map((record) => [record.code, record]));
  const heroGroups = new Map();
  for (const card of cards.filter((card) =>
    ["hero", "alter_ego"].includes(card.type_code),
  )) {
    const key = `${card.pack_code}:${card.set_code}`;
    const group = heroGroups.get(key) || [];
    group.push(card);
    heroGroups.set(key, group);
  }
  const heroes = [...heroGroups].map(([id, identities]) => {
    const allSetCards = records.filter(
      (record) =>
        record.pack === identities[0].pack_code &&
        record.set === identities[0].set_code,
    );
    const starter = decks.find((deck) =>
      identities.some((card) => card.code === deck.heroCode),
    );
    const identityCodeSet = new Set(identities.map((card) => card.code));
    const links = identities.flatMap((card) =>
      card.back_link && !identityCodeSet.has(card.back_link)
        ? [card.back_link]
        : [],
    );
    const dependencyCodes = unique([
      ...allSetCards.map((record) => record.code),
      ...links,
      ...Object.keys(starter?.cards || {}),
      ...Object.keys(starter?.setupCards || {}),
      ...Object.keys(starter?.supplementaryCards || {}),
    ]);
    return {
      id,
      name: identities.find((card) => card.type_code === "hero")?.name,
      identityCodes: identities.map((card) => card.code),
      linkedSetupCodes: unique(links),
      setCardCodes: allSetCards.map((record) => record.code),
      starterId: starter?.id,
      starterDependencyCodes: dependencyCodes,
      importedDependencies: dependencyCodes.filter(
        (code) => byCode.get(code)?.baseline !== "native_core_baseline",
      ),
      requiredMechanics: unique(
        dependencyCodes.flatMap((code) => byCode.get(code)?.mechanics || []),
      ),
      baseline: identities.every((card) => nativeCodes.has(card.code))
        ? "native_core_baseline"
        : "imported_requires_implementation",
    };
  });
  const typeCounts = Object.fromEntries(
    unique(records.map((record) => record.type)).map((type) => [
      type,
      records.filter((record) => record.type === type).length,
    ]),
  );
  const candidateFrequency = frequencies(records, "candidatePatterns");
  const engineCases = unique(
    [...engineSource.matchAll(/case\s+"([^"]+)"/g)].map((match) => match[1]),
  );
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    rulesReference: { version: "1.8", url: RULES_REFERENCE_URL },
    interpretation: {
      inventoryOnly: true,
      capabilityInference:
        "A mechanic/keyword mention or exact candidate match is not an implemented ability. Native Core membership records the existing baseline, including its documented exceptions. Hero eligibility requires all setup, identity, card, nemesis, obligation, scenario and timing dependencies plus integration validation.",
      semanticReprints:
        "Conservative equality includes name, subname, traits, type, faction, printed statistics/scaling/star fields, resources, deck metadata, linked-face text and normalized rules. Hero/encounter/campaign cards also retain set/product scope. Printing, image and quantity are otherwise excluded. This inventory fingerprint does not itself authorize script aliases.",
      abilityGrouping:
        "Timing labels divide normalized printed rules into inventory blocks; these are text fingerprints, not formally parsed game effects.",
      coverageScope:
        "Keyword/primitive detection is lexical triage. Unmatched or missing text remains present in the inventory and requires review. No completeness or perfect-play certification is implied.",
    },
    summary: {
      faces: cards.length,
      products: packs.length,
      sets: sets.length,
      heroes: heroes.length,
      publishedStarterLists: decks.length,
      types: typeCounts,
      nativeCoreFaces: records.filter(
        (record) => record.baseline === "native_core_baseline",
      ).length,
      importedFacesRequiringImplementation: records.filter(
        (record) => record.baseline !== "native_core_baseline",
      ).length,
      uniqueAbilityBlocks: abilityMap.size,
      uniqueRulesTexts: new Set(cards.map((card) => normalizeRules(card.text)))
        .size,
      uniqueMechanicalCards: semantics.size,
      semanticReprintGroups: [...semantics.values()].filter(
        (codes) => codes.length > 1,
      ).length,
      purePatternCandidateFaces: records.filter(
        (record) => record.candidatePatterns.length,
      ).length,
      emptyRulesFaces: cards
        .filter((card) => !normalizeRules(card.text) && !card.boost_text)
        .map((card) => card.code),
    },
    engineBaseline: {
      codeSpecificCases: engineCases.filter((name) => /^\d/.test(name)),
      effectCases: engineCases.filter((name) => !/^\d/.test(name)),
      note: "Switch-case inventory is a diagnostic snapshot only; handler presence does not prove full card support or rule correctness.",
    },
    mechanics: MECHANICS.map(({ id, primitive, baseline }) => ({
      id,
      primitive,
      baseline,
      ...frequencies(records, "mechanics").find((item) => item.id === id),
    })),
    timings: frequencies(records, "timings"),
    printedKeywords: frequencies(records, "printedKeywords"),
    keywordMentions: frequencies(records, "keywordMentions"),
    exactCandidatePatterns: candidateFrequency.map((item) => ({
      ...item,
      uniqueTexts: new Set(
        item.codes.map((code) =>
          normalizeRules(cards.find((card) => card.code === code).text),
        ),
      ).size,
    })),
    semanticReprints: [...semantics]
      .filter(([, codes]) => codes.length > 1)
      .map(([fingerprint, codes]) => ({ fingerprint, codes })),
    heroes,
    scenarioSets: sets
      .filter((set) => set.card_set_type_code === "villain")
      .map((set) => {
        const members = records.filter((record) => record.set === set.code);
        return {
          id: set.code,
          name: set.name,
          packCodes: unique(members.map((record) => record.pack)),
          faceCodes: members.map((record) => record.code),
          types: unique(members.map((record) => record.type)),
          requiredMechanics: unique(
            members.flatMap((record) => record.mechanics),
          ),
          baseline:
            members.length &&
            members.every(
              (record) => record.baseline === "native_core_baseline",
            )
              ? "native_core_baseline"
              : "imported_requires_implementation",
          note: "Encounter-set grouping is not a playable-scenario definition. Rulebook setup, mandatory modular sets, special assets, alternate modes and stage transitions require separate authored metadata.",
        };
      }),
    campaignProducts: packs
      .filter((pack) => pack.pack_type_code === "story" && pack.code !== "cw")
      .map((pack) => ({
        code: pack.code,
        name: pack.name,
        status: "requires_campaign_rules_and_state",
        note: "Card import does not encode the campaign rulebook, log, transition rewards or loss consequences.",
      })),
    cards: records,
    abilityBlocks: [...abilityMap.values()]
      .map((block) => ({ ...block, codes: unique(block.codes) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export async function generateAudit(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const files = [
    "src/data/catalog-cards.json",
    "src/data/catalog-packs.json",
    "src/data/catalog-sets.json",
    "src/data/catalog-decks.json",
    "src/data/core-player.json",
    "src/data/core-encounter.json",
    "src/game/engine.ts",
    "src/data/catalog-provenance.json",
  ];
  const source = await Promise.all(
    files.map((file) => readFile(path.join(root, file), "utf8")),
  );
  const [cards, packs, sets, decks, players, encounters] = source
    .slice(0, 6)
    .map(JSON.parse);
  const audit = auditCatalog({
    cards,
    coreCards: [...players, ...encounters],
    packs,
    sets,
    decks,
    engineSource: source[6],
  });
  const provenance = JSON.parse(source[7]);
  audit.importSnapshot = {
    asOf: provenance.asOf,
    importedAt: provenance.importedAt,
    provenanceFile: "src/data/catalog-provenance.json",
  };
  audit.sourceHashes = Object.fromEntries(
    files.map((file, index) => [file, hash(source[index])]),
  );
  // Compile the local, reviewed registry itself instead of inferring support
  // from inventory regexes. This audit operation does not execute game effects.
  const { build } = await import("esbuild");
  const bundle = await build({
    stdin: {
      contents:
        'export { scriptCoverage } from "./src/game/scripts/compiler.ts"; export { hasExecutableScript } from "./src/game/script-registry.ts"; export { EXPLICIT_CARD_SCRIPTS, SCRIPTED_HERO_IDS } from "./src/game/engine-support.ts"; export { CARDS, CATALOG_CARDS, HEROES, VILLAINS } from "./src/game/cards.ts";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const {
    scriptCoverage,
    hasExecutableScript,
    EXPLICIT_CARD_SCRIPTS,
    SCRIPTED_HERO_IDS,
    CARDS,
    CATALOG_CARDS,
    HEROES,
    VILLAINS,
  } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  // Printed-text triage above retains the immutable import. Compiler results
  // below use the same corrected database as actual engine commands.
  const runtimeCards = new Map(CATALOG_CARDS.map((card) => [card.code, card]));
  const coverage = scriptCoverage([...runtimeCards.values()], CARDS);
  audit.runtimeRuleCorrections = cards.flatMap((imported) => {
    const runtime = runtimeCards.get(imported.code);
    if (
      !runtime ||
      normalizeRules(imported.text) === normalizeRules(runtime.text)
    )
      return [];
    return [
      {
        code: imported.code,
        importedText: normalizeRules(imported.text),
        runtimeText: normalizeRules(runtime.text),
        reference: runtime.errata?.reference,
        url: runtime.errata?.url,
      },
    ];
  });
  audit.compilerCoverage = {
    ...coverage,
    scope:
      "Compiler recognition only. Dedicated hero/scenario modules and engine adapter integration are separate evidence. Neither compiled-card closure nor unsupported status here certifies whole-game behavior.",
  };
  const scriptIndex = new Map(coverage.faces.map((face) => [face.code, face]));
  const installedFaces = cards.map((card) => ({
    code: card.code,
    executable: hasExecutableScript(card.code),
    mechanism: EXPLICIT_CARD_SCRIPTS.has(card.code)
      ? "dedicated-module"
      : scriptIndex.get(card.code)?.status === "supported"
        ? scriptIndex.get(card.code).implementation === "core"
          ? "core-equivalent"
          : "declarative"
        : "unsupported",
    compilerStatus: scriptIndex.get(card.code)?.status,
  }));
  const installedIndex = new Map(
    installedFaces.map((face) => [face.code, face]),
  );
  audit.installedRegistryCoverage = {
    total: installedFaces.length,
    executableFaces: installedFaces.filter((face) => face.executable).length,
    unsupportedFaces: installedFaces.filter((face) => !face.executable).length,
    dedicatedFaces: installedFaces.filter(
      (face) => face.mechanism === "dedicated-module",
    ).length,
    dedicatedCodes: [...EXPLICIT_CARD_SCRIPTS].sort(),
    registeredHeroIds: [...SCRIPTED_HERO_IDS].sort(),
    registeredScenarioIds: VILLAINS.map((scenario) => scenario.id).sort(),
    registeredHeroes: HEROES.filter((hero) =>
      SCRIPTED_HERO_IDS.has(hero.id),
    ).map(({ id, code, alter }) => ({ id, code, alter })),
    registeredScenarios: VILLAINS.map(({ id, codes, schemes, module }) => ({
      id,
      codes,
      schemes,
      defaultModule: module,
    })),
    campaignSupport: [],
    products: packs.map((pack) => {
      const productCards = cards.filter((card) => card.pack_code === pack.code);
      const unsupportedFaceCodes = productCards
        .filter((card) => !installedIndex.get(card.code)?.executable)
        .map((card) => card.code)
        .sort();
      return {
        code: pack.code,
        name: pack.name,
        faceCount: productCards.length,
        executableFaces: productCards.length - unsupportedFaceCodes.length,
        unsupportedFaceCodes,
        installedCardClosure:
          productCards.length > 0 && unsupportedFaceCodes.length === 0,
        automationCertification:
          "registration_closure_only_requires_rules_and_native_integration_evidence",
      };
    }),
    scope:
      "Live hasExecutableScript registration including dedicated modules, separate from compiler recognition. Registered identities/scenarios still require legal deck/modular dependency closure and actual native mission tests. This does not certify the full imported collection, arbitrary interactions, or perfect rules behavior. No automated campaigns are installed.",
    faces: installedFaces,
  };
  for (const record of audit.cards) {
    record.compiler = scriptIndex.get(record.code);
    record.installedRegistry = installedIndex.get(record.code);
  }
  for (const hero of audit.heroes) {
    const allDependencies = unique([
      ...hero.starterDependencyCodes,
      ...cards
        .filter(
          (card) =>
            card.pack_code === hero.id.split(":")[0] &&
            card.set_code === `${hero.id.split(":")[1]}_nemesis`,
        )
        .map((card) => card.code),
    ]);
    hero.nemesisCodes = allDependencies.filter(
      (code) => !hero.starterDependencyCodes.includes(code),
    );
    hero.compilerUnsupportedDependencies = allDependencies.filter(
      (code) => scriptIndex.get(code)?.status !== "supported",
    );
    hero.compiledCardClosure =
      hero.compilerUnsupportedDependencies.length === 0;
    hero.automationCertification =
      "requires_dedicated_rules_and_integration_evidence";
    hero.registeredHeroIds = audit.installedRegistryCoverage.registeredHeroes
      .filter((registered) => hero.identityCodes.includes(registered.code))
      .map((registered) => registered.id);
    hero.installedUnsupportedDependencies = allDependencies.filter(
      (code) => !installedIndex.get(code)?.executable,
    );
    hero.installedCardClosure =
      hero.installedUnsupportedDependencies.length === 0;
  }
  for (const scenario of audit.scenarioSets) {
    scenario.registered =
      audit.installedRegistryCoverage.registeredScenarioIds.includes(
        scenario.id,
      );
    scenario.installedUnsupportedSetFaces = scenario.faceCodes.filter(
      (code) => !installedIndex.get(code)?.executable,
    );
    scenario.installedSetCardClosure =
      scenario.installedUnsupportedSetFaces.length === 0;
    scenario.automationCertification =
      "requires_full_scenario_dependency_graph_and_native_mission_evidence";
  }
  for (const file of [
    "src/game/scripts/compiler.ts",
    "src/game/scripts/runtime.ts",
    "src/game/scripts/types.ts",
    "src/game/script-registry.ts",
    "src/game/keywords.ts",
    "src/game/engine-support.ts",
    "src/game/engine.ts",
    "src/game/cards.ts",
    "src/game/captain-america.ts",
    "src/game/captain-pack.ts",
    "src/game/hulk.ts",
    "src/game/hulk-pack.ts",
    "src/game/mutagen-formula.ts",
    "src/game/thor.ts",
    "src/game/ms-marvel.ts",
    "src/game/risky-business.ts",
    "src/game/goblin-modules.ts",
    "src/game/reveal-window.ts",
    "src/game/black-widow.ts",
    "src/game/doctor-strange.ts",
    "src/game/hawkeye.ts",
    "src/game/spider-woman.ts",
    "src/game/ant-man.ts",
    "src/game/ant-man-pack.ts",
    "src/game/card-text.ts",
    "src/game/expansion-errata.ts",
    "src/game/types.ts",
    "src/game/payment.ts",
    "src/game/team.ts",
    "src/game/review.ts",
    "src/game/lookahead.ts",
    "src/game/advisor.ts",
    "src/game/decks.ts",
    "src/game/hero-runtime.ts",
    "src/game/rules-code.ts",
    "src/game/unique.ts",
    "src/data/core-errata.json",
  ]) {
    audit.sourceHashes[file] = hash(
      await readFile(path.join(root, file), "utf8"),
    );
  }
  return audit;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await generateAudit();
  const output = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../docs/engine-expansion-inventory.json",
  );
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ output, ...result.summary }, null, 2));
}
