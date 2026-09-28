import { CARDS, card, heroCard, resources } from "./cards";
import { allInPlay } from "./team";
import type { GameState, Prompt, Resource } from "./types";

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
    .filter((p) => p.id !== exclude)
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
    if (p.code === "01008" && p.counters > 0 && s.player.form === "hero")
      sources.push({
        id: p.id,
        name: "Web-Shooter",
        code: p.code,
        resources: ["wild"],
        description: `Exhaust · spend 1 of ${p.counters} web counters${p.counters === 1 ? " · then discard" : ""}`,
        kind: "ability",
      });
    if (p.code === "01033" && s.player.discard.length)
      sources.push({
        id: p.id,
        name: "Pepper Potts",
        code: p.code,
        resources: resources(card(s.player.discard.at(-1)!)),
        description: `Exhaust · copy ${card(s.player.discard.at(-1)!).name}`,
        kind: "ability",
      });
  }
  return sources.filter((x) => x.resources.length);
}

/**
 * Proposes a payment: cheapest sources first (by `rank`, lower spends first),
 * typed requirements satisfied before the total, then any overpayment trimmed.
 * Returns null when the available sources cannot pay.
 */
export function suggestPayment(
  sources: PaymentSource[],
  cost: number,
  requirements: Resource[] = [],
  rank: (source: PaymentSource) => number = () => 0,
) {
  const ordered = [...sources].sort((a, b) => rank(a) - rank(b));
  const chosen: string[] = [];
  const status = () => paymentStatus(sources, chosen, cost, requirements);
  for (let guard = 0; guard < 32 && !status().ready; guard++) {
    const missing = status().missing;
    const next = ordered.find(
      (x) =>
        !chosen.includes(x.id) &&
        (!missing.length ||
          x.resources.some((r) => r === "wild" || missing.includes(r))),
    );
    if (!next) break;
    chosen.push(next.id);
  }
  if (!status().ready) return null;
  // Drop the most valuable selections that are not needed for the total.
  for (const id of [...chosen].reverse()) {
    const trial = chosen.filter((x) => x !== id);
    if (paymentStatus(sources, trial, cost, requirements).ready)
      chosen.splice(chosen.indexOf(id), 1);
  }
  return chosen;
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
