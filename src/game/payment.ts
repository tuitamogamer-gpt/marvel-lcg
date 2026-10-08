import { thorResourceSources } from "./thor.js";
import { waspPackResourceSources } from "./wasp-pack.js";
import { quicksilverResourceSources } from "./quicksilver.js";
import { quicksilverPackResourceSources } from "./quicksilver-pack.js";
import { gamoraKeenInstinctsEligible } from "./gamora.js";
import { gamoraPackResourceSources } from "./gamora-pack.js";
import { starLordPackResourceSources } from "./star-lord-pack.js";
import { draxPackResourceSources } from "./drax-pack.js";
import { venomPackResourceSources } from "./venom-pack.js";
import { venomResourceSources } from "./venom.js";
import { spectrumResourceSources } from "./spectrum.js";
import { warlockResourceSources } from "./warlock.js";
import { mtsPlayerPackCardResources } from "./mts-player-pack.js";
import { isTextBlank } from "./card-text.js";
import { hawkeyeResourceSources } from "./hawkeye.js";
import { spiderWomanResourceSources } from "./spider-woman.js";
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
import type { Card, GameState, Piece, Prompt, Resource } from "./types.js";

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

/** TAKE costs require the full damage to reach the identity. Tough prevents
 * that damage, so it cannot be discarded to partially pay Symbiotic Bond. */
export function venomPaymentDamageCostAvailable(s: GameState, amount: number) {
  return amount > 0 && !s.player.tough && s.player.hp >= amount;
}

/** Actual resources generated when spending this physical hand card. */
export function resourcesFor(
  s: GameState,
  p: Piece,
  target?: Card,
): Resource[] {
  return mtsPlayerPackCardResources(s, p) ?? resources(card(p), target);
}

export function paymentSources(
  s: GameState,
  exclude?: string,
  targetCode?: string,
  handOnly = false,
) {
  const target = targetCode ? card(targetCode) : undefined;
  const sources: PaymentSource[] = s.player.hand
    .filter((p) => p.id !== exclude && hulkCanSpendCard(s, p))
    .map((p) => ({
      id: p.id,
      name: card(p).name,
      code: p.code,
      resources: resourcesFor(s, p, target),
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
    if (p.code === "18009" && gamoraKeenInstinctsEligible(s, targetCode))
      sources.push({
        id: p.id,
        name: card(p).name,
        code: p.code,
        resources: ["wild"],
        description:
          "Exhaust · generate 1 wild resource for an Attack or Thwart event",
        kind: "ability",
      });
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
  sources.push(...waspPackResourceSources(s));
  sources.push(...quicksilverResourceSources(s));
  sources.push(...quicksilverPackResourceSources(s, targetCode));
  sources.push(...gamoraPackResourceSources(s));
  sources.push(...starLordPackResourceSources(s));
  sources.push(...draxPackResourceSources(s));
  sources.push(...venomPackResourceSources(s));
  sources.push(
    ...venomResourceSources(s, {
      canTakeDamageCost: venomPaymentDamageCostAvailable,
    }),
  );
  sources.push(...spectrumResourceSources(s, { isTextBlank }));
  sources.push(...warlockResourceSources(s, { isTextBlank }));
  sources.push(...hawkeyeResourceSources(s, targetCode));
  sources.push(...spiderWomanResourceSources(s, targetCode));
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
  return sources.filter(
    (x) =>
      x.resources.length &&
      (!handOnly || x.kind === "card") &&
      (x.kind === "card" || !isTextBlank(s, x.code)),
  );
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

/** Distinct resource multisets allocated to the actual cost. Generated excess
 * is overpayment (RRG 1.8, p13), not a resource paid for that cost. Wilds used
 * for a typed requirement become that type; other wilds use the player's type. */
export function paidResourceAllocations(
  printed: Resource[],
  cost: number,
  requirements: Resource[] = [],
  wildAs: Resource = "energy",
): Resource[][] {
  const types: Resource[] = ["energy", "mental", "physical", "wild"];
  if (cost < requirements.length || printed.length < cost || cost < 0)
    return [];
  let remaining = new Map<string, number[]>();
  const initial = types.map((type) => printed.filter((r) => r === type).length);
  remaining.set(initial.join(":"), initial);
  for (const required of requirements) {
    const next = new Map<string, number[]>();
    for (const counts of remaining.values()) {
      for (const type of new Set<Resource>([required, "wild"])) {
        const index = types.indexOf(type);
        if (!counts[index]) continue;
        const rest = [...counts];
        rest[index]--;
        next.set(rest.join(":"), rest);
      }
    }
    remaining = next;
  }
  const order = (paid: Resource[]) =>
    [...paid].sort((a, b) => types.indexOf(a) - types.indexOf(b));
  const result = new Map<string, Resource[]>();
  for (const counts of remaining.values()) {
    let subsets = new Map<string, Resource[]>([
      [order(requirements).join(":"), order(requirements)],
    ]);
    const generic = types.flatMap((type, index) =>
      Array<Resource>(counts[index]).fill(type === "wild" ? wildAs : type),
    );
    for (const resource of generic) {
      const next = new Map(subsets);
      for (const paid of subsets.values()) {
        if (paid.length >= cost) continue;
        const allocated = order([...paid, resource]);
        next.set(allocated.join(":"), allocated);
      }
      subsets = next;
    }
    for (const paid of subsets.values())
      if (paid.length === cost) result.set(paid.join(":"), paid);
  }
  return [...result.values()].sort((a, b) => {
    const pure = (paid: Resource[]) =>
      paid.length > 0 && paid.every((r) => r === paid[0]);
    return (
      Number(pure(b)) - Number(pure(a)) ||
      a.join(":").localeCompare(b.join(":"))
    );
  });
}
