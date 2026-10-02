import type { Effect, Piece } from "../types.js";
import type {
  CardScript,
  ScriptContext,
  ScriptNode,
  ScriptTrigger,
  StaticModifier,
} from "./types.js";

const targeted = (
  node: ScriptNode,
  context: ScriptContext,
): string | undefined =>
  "target" in node
    ? node.target === "source"
      ? context.source.id
      : node.target === "villain"
        ? context.state.villain.id
        : node.target
    : undefined;
function effects(
  nodes: readonly ScriptNode[],
  context: ScriptContext,
  path = "program",
): Effect[] {
  return nodes.flatMap((node, index): Effect[] => {
    const key = `${context.source.id}:${path}.${index}`;
    switch (node.op) {
      case "draw":
        return [{ type: "draw", amount: node.amount }];
      case "damage":
        return [
          ...(node.ifDefeated
            ? [
                {
                  type: "scriptCheckpoint",
                  key,
                  target: targeted(node, context),
                  kind: "damage",
                },
              ]
            : []),
          {
            type: "damage",
            amount: node.amount,
            target: targeted(node, context),
            attack: !!node.attack,
            source: node.attack ? "hero" : context.source.id,
            overkill: !!node.overkill,
            piercing: !!node.piercing,
            ranged: !!node.ranged,
          },
          ...(node.ifDefeated
            ? [
                {
                  type: "scriptIfDefeated",
                  key,
                  target: targeted(node, context),
                  effects: effects(
                    node.ifDefeated,
                    context,
                    `${path}.${index}.defeated`,
                  ),
                },
              ]
            : []),
        ];
      case "thwart":
        return [
          ...(node.ifThreatRemoved
            ? [
                {
                  type: "scriptCheckpoint",
                  key,
                  target: node.target,
                  kind: "thwart",
                },
              ]
            : []),
          {
            type: "thwart",
            amount: node.amount,
            target: node.target,
            action: !!node.action,
            source: "hero",
          },
          ...(node.ifThreatRemoved
            ? [
                {
                  type: "scriptIfThreatRemoved",
                  key,
                  target: node.target,
                  effects: effects(
                    node.ifThreatRemoved,
                    context,
                    `${path}.${index}.removed`,
                  ),
                },
              ]
            : []),
        ];
      case "heal":
        return [
          {
            type: "heal",
            amount: node.amount,
            target: targeted(node, context),
          },
        ];
      case "ready":
        return [{ type: "ready", target: targeted(node, context) }];
      case "status":
        return [
          {
            type: "status",
            status: node.status,
            target: targeted(node, context),
          },
        ];
      case "if-paid":
        const paid = context.paid || [];
        return effects(
          (
            node.mode === "only"
              ? paid.length > 0 &&
                paid.every((resource) => resource === node.resource)
              : paid.includes(node.resource)
          )
            ? node.yes
            : node.no || [],
          context,
          `${path}.${index}.paid`,
        );
      case "if-paid-types":
        return effects(
          new Set(context.paid || []).size >= node.minimum
            ? node.yes
            : node.no || [],
          context,
          `${path}.${index}.types`,
        );
      case "target": {
        const inner = effects(node.effects, context, `${path}.${index}.target`);
        const action =
          inner.length === 1
            ? inner[0]
            : {
                type: "scriptSequence",
                effects: inner,
                attack: inner.some((effect) => effect.attack),
                action: inner.some((effect) => effect.action),
                source: inner.find((effect) => effect.source)?.source,
              };
        return [
          {
            type: "target",
            group: node.selector === "controlled-ally" ? "ally" : node.selector,
            title: context.source.code,
            action,
            ...(node.selector === "controlled-ally"
              ? { scriptSelector: { controller: "active", type: "ally" } }
              : {}),
          },
        ];
      }
      case "each-enemy":
        return [context.state.villain, ...context.state.minions].flatMap(
          (piece) =>
            effects(node.effects, context, `${path}.${index}.${piece.id}`).map(
              (effect) => ({
                ...effect,
                target: piece.id,
              }),
            ),
        );
      case "each-player":
        return context.state.players
          .filter((seat) => !seat.eliminated)
          .flatMap((seat) =>
            effects(node.effects, context, `${path}.${index}.${seat.id}`).map(
              (effect) => ({
                ...effect,
                actorId: seat.id,
              }),
            ),
          );
      case "choice":
        return [
          {
            type: "scriptChoice",
            title: context.source.code,
            text: "Choose one printed effect.",
            options: node.options.map((option, index) => ({
              id: `script-option-${index}`,
              label: option.label,
              effects: effects(
                option.effects,
                context,
                `${path}.${index}.option-${index}`,
              ),
            })),
          },
        ];
      case "generate-resource":
        throw Error(
          "Resource abilities must be offered through payment sources, not resolved as free queued effects.",
        );
    }
  });
}
export function checkScriptLegality(
  script: CardScript,
  context: ScriptContext,
): string | null {
  if (script.status !== "supported")
    return script.reason || "This face has no executable script.";
  if (script.implementation === "core") return null; // Existing native handler supplies detailed legality.
  if (script.form === "hero" && context.state.player.form !== "hero")
    return "Change to hero form first.";
  if (script.form === "alter" && context.state.player.form !== "alter")
    return "Change to alter-ego form first.";
  if (script.costs.exhaustSource && context.source.exhausted)
    return "This card is exhausted.";
  if (
    script.constraints.namedIdentity &&
    !context.identityNames?.includes(script.constraints.namedIdentity)
  )
    return "This effect requires its named identity.";
  const pieceAt = (id?: string) =>
    id === "hero"
      ? context.state.player
      : id?.startsWith("hero:")
        ? context.state.players.find((seat) => seat.id === id.slice(5))?.player
        : id === context.state.villain.id
          ? context.state.villain
          : [
              ...context.state.minions,
              ...context.state.attachments,
              ...context.state.players.flatMap((seat) => seat.player.inPlay),
            ].find((piece) => piece.id === id);
  const changes = (nodes: readonly ScriptNode[], selected?: string): boolean =>
    nodes.some((node) => {
      if (node.op === "target") {
        if (!context.targets) return changes(node.effects);
        return context
          .targets(node.selector, {
            attack: script.action === "attack",
            thwart: script.action === "thwart",
          })
          .some((candidate) => changes(node.effects, candidate.id));
      }
      if (node.op === "if-paid") {
        if (context.paid === undefined)
          return (
            changes(node.yes, selected) || changes(node.no || [], selected)
          );
        const paid = context.paid;
        return changes(
          (
            node.mode === "only"
              ? paid.length > 0 &&
                paid.every((resource) => resource === node.resource)
              : paid.includes(node.resource)
          )
            ? node.yes
            : node.no || [],
          selected,
        );
      }
      if (node.op === "if-paid-types")
        return context.paid === undefined
          ? changes(node.yes, selected) || changes(node.no || [], selected)
          : changes(
              new Set(context.paid).size >= node.minimum
                ? node.yes
                : node.no || [],
              selected,
            );
      if (node.op === "choice")
        return node.options.some((option) => changes(option.effects, selected));
      if (node.op === "each-enemy")
        return [context.state.villain, ...context.state.minions].some((piece) =>
          changes(node.effects, piece.id),
        );
      if (node.op === "each-player")
        return (
          context.state.players.some((player) => !player.eliminated) &&
          changes(node.effects, selected)
        );
      const id = targeted(node, context) || selected;
      if (context.canAffect) return context.canAffect(node, id);
      const piece = pieceAt(id);
      if (node.op === "ready") return piece ? piece.exhausted : !id;
      if (node.op === "status") return piece ? !piece[node.status] : !id;
      if (
        node.op === "damage" ||
        node.op === "thwart" ||
        node.op === "heal" ||
        node.op === "draw"
      )
        return node.amount > 0;
      return node.op === "generate-resource" && node.resources.length > 0;
    });
  if (!script.program.length) return null; // Static modifiers/printed stats have their own placement lifecycle.
  return changes(script.program)
    ? null
    : "No printed effect can change the current game state.";
}
export function scriptEffects(
  script: CardScript,
  trigger: ScriptTrigger,
  context: ScriptContext,
): Effect[] {
  if (script.status !== "supported")
    throw Error(script.reason || "This face has no executable script.");
  if (script.implementation === "core")
    throw Error("Execute the exact native Core handler for this alias.");
  if (script.trigger !== trigger) return [];
  const reason = checkScriptLegality(script, context);
  if (reason) {
    if (script.optional) return [];
    throw Error(reason);
  }
  const body = effects(script.program, context);
  const costs: Effect[] = [
    ...(script.costs.exhaustSource
      ? [{ type: "exhaust", id: context.source.id }]
      : []),
    ...(script.costs.discardSource
      ? [{ type: "discardPiece", id: context.source.id }]
      : []),
  ];
  const result = [...costs, ...body];
  const paidResult = script.costs.spend?.length
    ? [
        {
          type: "payRequest",
          title: script.name,
          cost: script.costs.spend.length,
          requirements: [...script.costs.spend],
          piece: context.source,
          targetCode: context.source.code,
          cancelable: true,
          after: result,
        },
      ]
    : result;
  return script.optional
    ? [
        {
          type: "optional",
          title: script.name,
          text: `Use ${script.name}'s printed response?`,
          effects: paidResult,
        },
      ]
    : paidResult;
}
export function resourceAbility(
  script: CardScript,
  piece: Piece,
  form: "hero" | "alter",
) {
  if (
    script.status !== "supported" ||
    script.trigger !== "resource" ||
    piece.exhausted ||
    (script.form !== "any" && script.form !== form)
  )
    return null;
  const node = script.program.find((node) => node.op === "generate-resource");
  return node?.op === "generate-resource"
    ? {
        id: piece.id,
        code: piece.code,
        resources: [...node.resources],
        exhaust: !!script.costs.exhaustSource,
      }
    : null;
}
/** Controller/attachment selection is explicit; unrelated players never receive an aura. */
export function staticModifierValue(
  script: CardScript,
  query: {
    stat: StaticModifier["stat"];
    target: "hero" | "ally";
    targetId?: string;
    source: Piece;
    sourceOwnerId?: string;
    targetOwnerId?: string;
  },
) {
  if (script.status !== "supported") return 0;
  return script.modifiers.reduce((sum, modifier) => {
    if (modifier.stat !== query.stat) return sum;
    const applies =
      modifier.target === "self"
        ? query.targetId === query.source.id
        : modifier.target === "attached-ally"
          ? query.target === "ally" &&
            query.source.attachedTo === query.targetId
          : modifier.target === "controlled-allies"
            ? query.target === "ally" &&
              !!query.sourceOwnerId &&
              query.sourceOwnerId === query.targetOwnerId
            : query.target === "hero" &&
              !!query.sourceOwnerId &&
              query.sourceOwnerId === query.targetOwnerId;
    return sum + (applies ? modifier.amount : 0);
  }, 0);
}
