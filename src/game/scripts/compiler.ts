import corePlayers from "../../data/core-player.json" with { type: "json" };
import coreEncounters from "../../data/core-encounter.json" with { type: "json" };
import type { Card, Resource } from "../types.js";
import type {
  CardScript,
  ScriptNode,
  ScriptSelector,
  StaticModifier,
} from "./types.js";

/** Formatting only. No operative sentences, costs, qualifiers, reminders or boost text are dropped. */
export function normalizeRules(text = "") {
  return text
    .replace(/<hr\s*\/?>/gi, " | BOOST | ")
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\[lightning\]/g, "[energy]")
    .replace(/\s+/g, " ")
    .trim();
}
const nativeCards = [...corePlayers, ...coreEncounters] as Card[];
const mechanicalFields = [
  "name",
  "subname",
  "type_code",
  "faction_code",
  "cost",
  "attack",
  "thwart",
  "defense",
  "recover",
  "health",
  "hand_size",
  "attack_cost",
  "thwart_cost",
  "scheme",
  "boost",
  "boost_star",
  "stage",
  "base_threat",
  "threat",
  "escalation_threat",
  "scheme_crisis",
  "scheme_hazard",
  "scheme_acceleration",
  "resource_energy",
  "resource_mental",
  "resource_physical",
  "resource_wild",
  "is_unique",
  "deck_limit",
  "base_threat_fixed",
  "threat_fixed",
  "escalation_threat_fixed",
  "attack_star",
  "thwart_star",
  "health_star",
  "scheme_star",
  "double_sided",
  "health_per_hero",
  "health_per_group",
  "cost_per_hero",
  "cost_star",
  "base_threat_per_group",
  "base_threat_star",
  "threat_per_group",
  "threat_star",
  "escalation_threat_star",
  "scheme_amplify",
  "defense_star",
  "recover_star",
  "permanent",
  "deck_options",
  "deck_requirements",
  "back_name",
  "back_text",
];
const canonicalMaps = new WeakMap<readonly Card[], Map<string, string>>();
export function mechanicalSignature(card: Card) {
  const row = card as unknown as Record<string, unknown>;
  return JSON.stringify([
    mechanicalFields.map((key) => row[key] ?? null),
    normalizeRules(card.text),
    normalizeRules(card.traits),
  ]);
}
export function canonicalCoreCode(
  card: Card,
  baseline: readonly Card[] = nativeCards,
) {
  let map = canonicalMaps.get(baseline);
  if (!map) {
    map = new Map(
      baseline.map((candidate) => [
        mechanicalSignature(candidate),
        candidate.code,
      ]),
    );
    canonicalMaps.set(baseline, map);
  }
  return map.get(mechanicalSignature(card));
}
const target = (
  selector: ScriptSelector,
  effects: ScriptNode[],
): ScriptNode => ({ op: "target", selector, effects });
const number = (value: string) => Number(value);
function operation(
  text: string,
  card: Card,
  attack: boolean,
  thwart: boolean,
): ScriptNode[] | null {
  let m;
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. This attack gains (piercing|overkill|ranged)\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [
        { op: "damage", amount: number(m[1]), attack, [m[2]]: true },
      ]),
    ];
  if (
    (m =
      /^(Stun|Confuse) an enemy\. If you paid for this card using a \[(energy|mental|physical)\] resource, deal (\d+) damage to that enemy\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [
        { op: "status", status: m[1] === "Stun" ? "stunned" : "confused" },
        {
          op: "if-paid",
          resource: m[2] as Resource,
          yes: [{ op: "damage", amount: number(m[3]), attack }],
          no: attack ? [{ op: "damage", amount: 0, attack: true }] : [],
        },
      ]),
    ];
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. If you paid for this (?:card|event) using (?:a |only )\[(energy|mental|physical)\] resources?, (stun|confuse) that enemy(?: and draw (\d+) cards?)?\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [
        { op: "damage", amount: number(m[1]), attack },
        {
          op: "if-paid",
          mode: text.includes("using only ") ? "only" : "any",
          resource: m[2] as Resource,
          yes: [
            { op: "status", status: m[3] === "stun" ? "stunned" : "confused" },
            ...(m[4] ? [{ op: "draw" as const, amount: number(m[4]) }] : []),
          ],
        },
      ]),
    ];
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. If you paid for this card using (\d+) different resource types, (stun|confuse) that enemy\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [
        { op: "damage", amount: number(m[1]), attack },
        {
          op: "if-paid-types",
          minimum: number(m[2]),
          yes: [
            { op: "status", status: m[3] === "stun" ? "stunned" : "confused" },
          ],
        },
      ]),
    ];
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. If (?:that enemy is defeated by this attack|this attack defeats that enemy), (.+)$/.exec(
        text,
      ))
  ) {
    const follow = operation(
      m[2][0].toUpperCase() + m[2].slice(1),
      card,
      false,
      false,
    );
    if (follow)
      return [
        target("enemy", [
          { op: "damage", amount: number(m[1]), attack, ifDefeated: follow },
        ]),
      ];
  }
  if (
    (m =
      /^Remove (\d+) threat from a scheme\. If this removes the last threat (?:on|from) that scheme, (.+)$/.exec(
        text,
      ))
  ) {
    const follow = operation(
      m[2][0].toUpperCase() + m[2].slice(1),
      card,
      false,
      false,
    );
    if (follow)
      return [
        target("scheme", [
          {
            op: "thwart",
            amount: number(m[1]),
            action: thwart,
            ifThreatRemoved: follow,
          },
        ]),
      ];
  }
  if (
    (m =
      /^Remove (\d+) threat from a scheme\. If you paid for this card using (\d+) different resource types, (stun|confuse) an enemy\.$/.exec(
        text,
      ))
  )
    return [
      target("scheme", [
        { op: "thwart", amount: number(m[1]), action: thwart },
      ]),
      {
        op: "if-paid-types",
        minimum: number(m[2]),
        yes: [
          target("enemy", [
            { op: "status", status: m[3] === "stun" ? "stunned" : "confused" },
          ]),
        ],
      },
    ];
  if ((m = /^Deal (\d+) damage to an enemy\.$/.exec(text)))
    return [target("enemy", [{ op: "damage", amount: number(m[1]), attack }])];
  if ((m = /^Deal (\d+) damage to a minion\.$/.exec(text)))
    return [target("minion", [{ op: "damage", amount: number(m[1]), attack }])];
  if ((m = /^Deal (\d+) damage to the villain\.$/.exec(text)))
    return [{ op: "damage", target: "villain", amount: number(m[1]), attack }];
  if ((m = /^Deal (\d+) damage to each enemy\.$/.exec(text)))
    return [
      {
        op: "each-enemy",
        effects: [{ op: "damage", amount: number(m[1]), attack }],
      },
    ];
  if ((m = /^Remove (\d+) threat from a scheme\.$/.exec(text)))
    return [
      target("scheme", [
        { op: "thwart", amount: number(m[1]), action: thwart },
      ]),
    ];
  if ((m = /^Remove (\d+) threat from the main scheme\.$/.exec(text)))
    return [
      { op: "thwart", target: "main", amount: number(m[1]), action: thwart },
    ];
  if ((m = /^Draw (\d+) cards?\.$/.exec(text)))
    return [{ op: "draw", amount: number(m[1]) }];
  if (
    (m = /^Heal (\d+) damage from (?:any|a) (friendly )?character\.$/.exec(
      text,
    ))
  )
    return [
      target(m[2] ? "friendly" : "character", [
        { op: "heal", amount: number(m[1]) },
      ]),
    ];
  if ((m = /^Heal (\d+) damage from (?:your identity|your hero)\.$/.exec(text)))
    return [{ op: "heal", target: "hero", amount: number(m[1]) }];
  if (text === "Ready an ally.") return [target("ally", [{ op: "ready" }])];
  if (text === "Ready an ally you control.")
    return [target("controlled-ally", [{ op: "ready" }])];
  if (text === "Ready your hero.") return [{ op: "ready", target: "hero" }];
  if (text === "Stun an enemy.")
    return [target("enemy", [{ op: "status", status: "stunned" }])];
  if (text === "Confuse an enemy.")
    return [target("enemy", [{ op: "status", status: "confused" }])];
  if (text === "Stun and confuse a minion.")
    return [
      target("minion", [
        { op: "status", status: "stunned" },
        { op: "status", status: "confused" },
      ]),
    ];
  if (text === "Stun and confuse an enemy.")
    return [
      target("enemy", [
        { op: "status", status: "stunned" },
        { op: "status", status: "confused" },
      ]),
    ];
  if (text === "Confuse the villain.")
    return [{ op: "status", status: "confused", target: "villain" }];
  if (text === "Give an ally you control a tough status card.")
    return [target("controlled-ally", [{ op: "status", status: "tough" }])];
  if (text === "Give your hero a tough status card.")
    return [{ op: "status", status: "tough", target: "hero" }];
  if ((m = /^Each player draws (\d+) cards?\.$/.exec(text)))
    return [
      { op: "each-player", effects: [{ op: "draw", amount: number(m[1]) }] },
    ];
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. If you paid for this card using a \[(energy|mental|physical)\] resource, draw (\d+) cards?\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [{ op: "damage", amount: number(m[1]), attack }]),
      {
        op: "if-paid",
        resource: m[2] as Resource,
        yes: [{ op: "draw", amount: number(m[3]) }],
      },
    ];
  if (
    (m =
      /^Deal (\d+) damage to an enemy\. If you paid for this card using a \[(energy|mental|physical)\] resource, (stun|confuse) that enemy\.$/.exec(
        text,
      ))
  )
    return [
      target("enemy", [
        { op: "damage", amount: number(m[1]), attack },
        {
          op: "if-paid",
          resource: m[2] as Resource,
          yes: [
            { op: "status", status: m[3] === "stun" ? "stunned" : "confused" },
          ],
        },
      ]),
    ];
  if (
    (m =
      /^Remove (\d+) threat from a scheme \((\d+) threat instead if you paid for this card using (?:a |only )\[(energy|mental|physical)\] resources?\)\.$/.exec(
        text,
      ))
  )
    return [
      {
        op: "if-paid",
        mode: text.includes("using only ") ? "only" : "any",
        resource: m[3] as Resource,
        yes: [
          target("scheme", [
            { op: "thwart", amount: number(m[2]), action: thwart },
          ]),
        ],
        no: [
          target("scheme", [
            { op: "thwart", amount: number(m[1]), action: thwart },
          ]),
        ],
      },
    ];
  if (
    (m =
      /^Choose to either draw (\d+) cards? or heal (\d+) damage from your identity\.$/.exec(
        text,
      ))
  )
    return [
      {
        op: "choice",
        options: [
          {
            label: `Draw ${m[1]} card(s)`,
            effects: [{ op: "draw", amount: number(m[1]) }],
          },
          {
            label: `Heal ${m[2]} damage`,
            effects: [{ op: "heal", target: "hero", amount: number(m[2]) }],
          },
        ],
      },
    ];
  // Full simple conjunctions are parsed only when both complete sentences are understood.
  const parts = text.split(/\. (?:Then, )?/);
  if (parts.length === 2) {
    const left = operation(parts[0] + ".", card, attack, thwart);
    const right = operation(parts[1], card, attack, thwart);
    if (left && right) return [...left, ...right];
  }
  return null;
}
export function compileCardScript(
  card: Card,
  baseline: readonly Card[] = nativeCards,
): CardScript {
  const text = normalizeRules(card.text);
  const script: CardScript = {
    code: card.code,
    name: card.name,
    status: "unsupported",
    normalizedText: text,
    form: "any",
    optional: false,
    costs: {},
    program: [],
    modifiers: [],
    keywords: [],
    constraints: {},
  };
  const coreCode = canonicalCoreCode(card, baseline);
  if (coreCode)
    return {
      ...script,
      status: "supported",
      implementation: "core",
      canonicalCoreCode: coreCode,
      rule: "exact-native-core-alias",
    };
  const supported = (rule: string): CardScript => ({
    ...script,
    status: "supported",
    implementation: "script",
    rule,
  });
  const raw = card as unknown as Record<string, unknown>;
  const unresolved = [
    "cost_star",
    "attack_star",
    "thwart_star",
    "defense_star",
    "recover_star",
    "health_star",
    "scheme_star",
    "boost_star",
    "base_threat_star",
    "threat_star",
    "escalation_threat_star",
    "cost_per_hero",
    "health_per_hero",
    "health_per_group",
    "base_threat_per_group",
    "threat_per_group",
  ];
  if (
    unresolved.some((field) => !!raw[field]) ||
    [
      card.cost,
      card.attack,
      card.thwart,
      card.defense,
      card.recover,
      card.health,
      card.scheme,
    ].some((value) => typeof value === "number" && value < 0)
  )
    return {
      ...script,
      reason:
        "A printed dynamic value or scaling rule needs its dedicated runtime adapter.",
    };
  if (
    !text &&
    ["ally", "support", "upgrade", "minion", "resource"].includes(
      card.type_code,
    )
  )
    return supported("printed-stats-only");
  if (card.type_code === "resource" && /^Max [12] per deck\.$/.test(text))
    return supported("resource-icons-and-deck-limit");
  if (card.type_code === "event") {
    const m = /^(Hero |Alter-Ego )?Action(?: \((attack|thwart)\))?: (.+)$/.exec(
      text,
    );
    if (m) {
      script.form = m[1] === "Hero " ? "hero" : m[1] ? "alter" : "any";
      script.trigger = "event-action";
      script.action = m[2] as "attack" | "thwart" | undefined;
      const program = operation(
        m[3],
        card,
        m[2] === "attack",
        m[2] === "thwart",
      );
      if (program) {
        script.program = program;
        return supported("whole-action-operation");
      }
    }
  }
  const keywordOnly =
    text === "Toughness." ||
    text ===
      "Toughness. (This character enters play with a tough status card.)" ||
    /^Retaliate [1-3]\.$/.test(text) ||
    /^Retaliate ([1-3])\. \(After this character is attacked, deal \1 damage to the attacking character\.\)$/.test(
      text,
    );
  if (["ally", "minion"].includes(card.type_code) && keywordOnly) {
    script.keywords = [
      text.startsWith("Toughness.")
        ? "Toughness"
        : text.match(/^Retaliate [1-3]/)![0],
    ];
    return supported("whole-keyword-only-character");
  }
  if (card.type_code === "ally") {
    const name = card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      new RegExp(`^Response: After you play ${name} from your hand, `).test(
        text,
      )
    )
      return {
        ...script,
        reason:
          "This response requires a hand-play lifecycle adapter; entering play alone does not satisfy its printed trigger.",
      };
    const m = new RegExp(`^Response: After ${name} enters play, (.+)$`).exec(
      text,
    );
    if (m) {
      const program = operation(
        m[1][0].toUpperCase() + m[1].slice(1),
        card,
        false,
        false,
      );
      if (program) {
        script.trigger = "ally-enter";
        script.optional = true;
        script.program = program;
        return supported("whole-ally-entrance-response");
      }
    }
  }
  if (["support", "upgrade", "ally"].includes(card.type_code)) {
    const escaped = card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`^(Hero |Alter-Ego )?Action(?: \((attack|thwart)\))?: Exhaust ${escaped} → (.+)$`,
    ).exec(text);
    if (m) {
      const program = operation(
        m[3][0].toUpperCase() + m[3].slice(1),
        card,
        m[2] === "attack",
        m[2] === "thwart",
      );
      if (program) {
        script.trigger = "activate";
        script.form = m[1] === "Hero " ? "hero" : m[1] ? "alter" : "any";
        script.costs.exhaustSource = true;
        script.program = program;
        return supported("whole-exhaust-action");
      }
    }
    const resource = new RegExp(
      String.raw`^(Hero |Alter-Ego )?Resource: Exhaust ${escaped} → generate a \[(energy|mental|physical|wild)\] resource\.$`,
    ).exec(text);
    if (resource) {
      script.trigger = "resource";
      script.form =
        resource[1] === "Hero " ? "hero" : resource[1] ? "alter" : "any";
      script.costs.exhaustSource = true;
      script.program = [
        { op: "generate-resource", resources: [resource[2] as Resource] },
      ];
      return supported("whole-exhaust-resource");
    }
  }
  let staticText = text;
  if (staticText.startsWith("Play under any player's control. ")) {
    script.constraints.playUnderAnyPlayer = true;
    staticText = staticText.slice("Play under any player's control. ".length);
  }
  if (staticText.startsWith("Max 1 per player. ")) {
    script.constraints.maxPerPlayer = 1;
    staticText = staticText.slice("Max 1 per player. ".length);
  }
  if (["support", "upgrade"].includes(card.type_code)) {
    const modifiers: StaticModifier[] = [];
    let remaining = staticText;
    while (remaining) {
      const m =
        /^(Your hero|You|Each ally you control) (?:gets?|get) \+(\d+) (ATK|THW|DEF|REC|hit points?|hit point|hand size)\.(?: |$)/.exec(
          remaining,
        );
      if (!m) break;
      const stat = (
        {
          ATK: "attack",
          THW: "thwart",
          DEF: "defense",
          REC: "recover",
          "hit points": "health",
          "hit point": "health",
          "hand size": "hand_size",
        } as const
      )[m[3] as "ATK"];
      modifiers.push({
        target: m[1] === "Each ally you control" ? "controlled-allies" : "hero",
        stat,
        amount: number(m[2]),
      });
      remaining = remaining.slice(m[0].length);
    }
    if (modifiers.length && !remaining) {
      script.trigger = "static";
      script.modifiers = modifiers;
      return supported("whole-static-modifiers");
    }
  }
  script.reason = text
    ? "No exact executable rule covers every printed clause and timing on this face."
    : "This card type requires a scenario or identity-specific lifecycle adapter.";
  return script;
}
export function compileScriptRegistry(
  cards: readonly Card[],
  baseline: readonly Card[] = nativeCards,
) {
  return new Map(
    cards.map((card) => [card.code, compileCardScript(card, baseline)]),
  );
}

/** Serializable, exhaustive inventory. Coverage reports never imply unsupported faces execute. */
export function scriptCoverage(
  cards: readonly Card[],
  baseline: readonly Card[] = nativeCards,
) {
  const scripts = [...compileScriptRegistry(cards, baseline).values()];
  const rules: Record<string, number> = {};
  for (const script of scripts)
    rules[script.rule || "unsupported"] =
      (rules[script.rule || "unsupported"] || 0) + 1;
  return {
    total: scripts.length,
    native: scripts.filter((script) => script.implementation === "core").length,
    declarative: scripts.filter((script) => script.implementation === "script")
      .length,
    unsupported: scripts.filter((script) => script.status === "unsupported")
      .length,
    rules,
    faces: scripts.map(
      ({
        code,
        status,
        implementation,
        canonicalCoreCode,
        rule,
        reason,
        trigger,
      }) => ({
        code,
        status,
        implementation,
        canonicalCoreCode,
        rule,
        reason,
        trigger,
      }),
    ),
  };
}
