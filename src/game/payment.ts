import { thorResourceSources } from "./thor.js";
import { blackWidowResourceSources } from "./black-widow.js";
import { doctorStrangeResourceSources } from "./doctor-strange.js";
import { msMarvelResourceSources } from "./ms-marvel.js";
import { rulesCode } from "./rules-code.js";
import { CARDS, card, heroCard, resources } from "./cards.js";
import { allInPlay } from "./team.js";
import { captainResourceSources } from "./captain-america.js";
import { hulkResourceSources, hulkCanSpendCard } from "./hulk.js";
import { hulkPackResourceSources } from "./hulk-pack.js";
import { captainPackResourceSources } from "./captain-pack.js";
import { cardScript } from "./script-registry.js";
import { resourceAbility } from "./scripts/runtime.js";
import type { GameState, Prompt, Resource } from "./types.js";

export function paymentSubject(s: GameState, prompt: Prompt) {
  return (
    prompt.card?.code ||
    prompt.paymentTarget ||
    CARDS.find((c) => c.name === prompt.title)?.code ||
    [...allInPlay(s), ...s.attachments].find((p) =>
      prompt.after?.some((e) => e.id === p.id),
    )?.code
  );
}

export interface PaymentSource {
  id: string;
  name: string;
  code: string;
  resources: Resource[];
  description: string;
  kind: "card" | "ability";
}

export function paymentSources(
  s: GameState,
  exclude?: string,
  targetCode?: string,
) {
  const target = targetCode ? card(targetCode) : undefined;
  const sources: PaymentSource[] = s.player.hand
    .filter((p) => p.id !== exclude && hulkCanSpendCard(s, p))
    .map((p) => ({
      id: p.id,
      name: card(p).name,
      code: p.code,
      resources: resources(card(p), target),
      description: "Discard from hand",
      kind: "card",
    }));
  if (
    s.heroId === "spider_man" &&
    s.player.form === "alter" &&
    !s.flags.scientist
  )
    sources.push({
      id: "scientist",
      name: "Scientist",
      code: heroCard(s).code,
      resources: ["mental"],
      description: "Generate 1 mental resource · once per round · no exhaust",
      kind: "ability",
    });
  for (const p of s.player.inPlay.filter((p) => !p.exhausted)) {
    if (rulesCode(p) === "01008" && p.counters > 0 && s.player.form === "hero")
      sources.push({
        id: p.id,
        name: "Web-Shooter",
        code: p.code,
        resources: ["wild"],
        description: `Exhaust · spend 1 of ${p.counters} web counters${p.counters === 1 ? " · then discard" : ""}`,
        kind: "ability",
      });
    if (rulesCode(p) === "01033" && s.player.discard.length)
      sources.push({
        id: p.id,
        name: "Pepper Potts",
        code: p.code,
        resources: resources(card(s.player.discard.at(-1)!)),
        description: `Exhaust · copy ${card(s.player.discard.at(-1)!).name}`,
        kind: "ability",
      });
  }
  sources.push(...thorResourceSources(s));
  sources.push(...blackWidowResourceSources(s, targetCode));
  sources.push(...doctorStrangeResourceSources(s));
  sources.push(...msMarvelResourceSources(s, targetCode));
  sources.push(...captainResourceSources(s));
  sources.push(...hulkResourceSources(s));
  sources.push(
    ...captainPackResourceSources(s),
    ...hulkPackResourceSources(s, targetCode),
  );
  for (const piece of s.player.inPlay) {
    const script = cardScript(piece);
    if (!script || script.implementation !== "script") continue;
    const ability = resourceAbility(script, piece, s.player.form);
    if (ability && !sources.some((source) => source.id === piece.id))
      sources.push({
        ...ability,
        name: card(piece).name,
        description: "Exhaust · generate printed resources",
        kind: "ability",
      });
  }
  return sources.filter((x) => x.resources.length);
}

/**
 * Proposes a payment with the least overpayment, then the lowest total `rank`,
 * then the fewest sources. Printed types and wilds satisfy the requirements.
 * Returns null when the available sources cannot pay.
 */
export function suggestPayment(
  sources: PaymentSource[],
  cost: number,
  requirements: Resource[] = [],
  rank: (source: PaymentSource) => number = () => 0,
) {
  type Selection = { ids: string[]; printed: Resource[]; value: number };
  const types: Resource[] = ["energy", "mental", "physical", "wild"];
  const caps = types.map((type) =>
    type === "wild"
      ? requirements.length
      : requirements.filter((r) => r === type).length,
  );
  // Keep one cheapest selection for each total and relevant resource mix.
  // Capping typed counts avoids enumerating every subset of a large hand.
  const key = (printed: Resource[]) =>
    [
      printed.length,
      ...types.map((type, i) =>
        Math.min(caps[i], printed.filter((r) => r === type).length),
      ),
    ].join(":");
  const cheaper = (a: Selection, b: Selection) =>
    a.value < b.value || (a.value === b.value && a.ids.length < b.ids.length);
  const states = new Map<string, Selection>([
    [key([]), { ids: [], printed: [], value: 0 }],
  ]);
  for (const source of sources) {
    for (const current of [...states.values()]) {
      const next = {
        ids: [...current.ids, source.id],
        printed: [...current.printed, ...source.resources],
        value: current.value + rank(source),
      };
      const k = key(next.printed);
      const previous = states.get(k);
      if (!previous || cheaper(next, previous)) states.set(k, next);
    }
  }
  let best: Selection | undefined;
  for (const selection of states.values()) {
    if (!paymentStatus(sources, selection.ids, cost, requirements).ready)
      continue;
    if (
      !best ||
      selection.printed.length < best.printed.length ||
      (selection.printed.length === best.printed.length &&
        cheaper(selection, best))
    )
      best = selection;
  }
  return best?.ids ?? null;
}

/** Shared by the engine and the payment preview; each wild covers one requirement. */
export function paymentStatus(
  sources: PaymentSource[],
  ids: string[],
  cost: number,
  requirements: Resource[] = [],
) {
  const selected = sources.filter((s) => ids.includes(s.id));
  const printed = selected.flatMap((s) => s.resources);
  const available = [...printed];
  const missing: Resource[] = [];
  for (const resource of requirements) {
    let index = available.indexOf(resource);
    if (index < 0) index = available.indexOf("wild");
    if (index < 0) missing.push(resource);
    else available.splice(index, 1);
  }
  return {
    selected,
    printed,
    total: printed.length,
    missing,
    ready: printed.length >= cost && !missing.length,
  };
}
