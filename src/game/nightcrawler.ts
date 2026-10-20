import { card, CATALOG_CARDS } from "./card-definitions.js";
import { isTextBlank, eventPlaySources } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const N = (type: string, args: Record<string, unknown> = {}) =>
  E(`nightcrawler:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, text: string) => {
  if (!ok) throw Error(text);
};
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const optional = (title: string, effects: Effect[], image?: string) =>
  E("optional", { title, text: `Use ${title}?`, effects, image });
const bamfs = (s: GameState, target?: string) =>
  allInPlay(s).filter(
    (p) => p.code === "48006" && (!target || p.attachedTo === target),
  );
const key = (id: string) => `nightcrawlerCost:${id}`;
const hero = (s: GameState) =>
  s.heroId === "nightcrawler" && s.player.form === "hero";
const identityCard = (s: GameState) =>
  CATALOG_CARDS.find(
    (c) =>
      c.set_code === s.heroId &&
      c.type_code === (s.player.form === "hero" ? "hero" : "alter_ego"),
  )!;
type RoguePiece = Piece & {
  nightcrawlerRogueTarget?: string;
  nightcrawlerRogueRound?: number;
};

export const NIGHTCRAWLER_SCRIPT_CODES = [
  "48001a",
  "48001b",
  ...Array.from({ length: 20 }, (_, i) => String(48002 + i)),
  "48031",
  "48032",
].filter((c) => !["48017", "48019"].includes(c));
export interface NightcrawlerPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(
    s: GameState,
    title: string,
    text: string,
    options: Option[],
    cancelable?: boolean,
  ): void;
  find(s: GameState, id: string): Piece | undefined;
  enemies(
    s: GameState,
    attack: boolean,
  ): { id: string; label: string; code?: string }[];
  schemes(
    s: GameState,
    thwart: boolean,
  ): { id: string; label: string; code?: string }[];
  characters(s: GameState): {
    id: string;
    label: string;
    code?: string;
    playerId: string;
    exhausted: boolean;
  }[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  characterThwart(s: GameState, id: string): number;
  exhaust(s: GameState, id: string): boolean;
  canPay(s: GameState, p: Piece): boolean;
  canDiscard(s: GameState, p: Piece): boolean;
  canAttach(s: GameState, p: Piece, target: string): boolean;
  discard(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): Piece;
  shuffle(s: GameState): void;
  hidden(s: GameState): void;
  reaction(s: GameState, p: Piece, effects: Effect[], after: Effect[]): void;
  pay(s: GameState, title: string, cost: number, after: Effect[]): void;
  canDefend(s: GameState): boolean;
  bamfDefend(s: GameState, after: Effect[]): void;
  cancelBoost(s: GameState, id: string): void;
  numericBoost(s: GameState, id: string): number;
  canDamageCost(s: GameState, id: string): boolean;
  damageCost(s: GameState, id: string, after: Effect[]): void;
  canChange(s: GameState): boolean;
  canReady(s: GameState): boolean;
  ready(s: GameState): void;
  discardEncounterTop(s: GameState): Piece | undefined;
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  distributeThwart(
    s: GameState,
    packets: { target: string; amount: number }[],
    after: Effect[],
  ): void;
  distributeDamage(
    s: GameState,
    packets: { target: string; amount: number }[],
  ): void;
}

export function nightcrawlerStats(s: GameState) {
  const cutlasses = hero(s) ? live(s, "48004").length : 0;
  return {
    attack: cutlasses,
    defense: cutlasses,
    retaliate: cutlasses,
    recover:
      s.heroId === "nightcrawler" && s.player.form === "alter"
        ? live(s, "48003").length
        : 0,
    restricted: live(s, "48005").length,
  };
}
function rogueTarget(s: GameState, p: RoguePiece) {
  if (
    p.code !== "48012" ||
    p.nightcrawlerRogueRound !== s.round ||
    isTextBlank(s, p)
  )
    return;
  const id = p.nightcrawlerRogueTarget;
  if (!id) return;
  if (id.startsWith("hero:")) {
    const seat = s.players.find((q) => q.id === id.slice(5) && !q.eliminated);
    return seat ? identityCard(seatView(s, seat)) : undefined;
  }
  const target = allInPlay(s).find((q) => q.id === id);
  if (!target) return;
  const printed = card(target);
  return target.code === "48021"
    ? {
        ...printed,
        attack: isTextBlank(s, target)
          ? 0
          : card(target.storedCards?.[0] || "48021").boost || 0,
        thwart: isTextBlank(s, target)
          ? 0
          : card(target.storedCards?.[0] || "48021").boost || 0,
      }
    : printed;
}
export function nightcrawlerAllyBonus(
  s: GameState,
  p: Piece,
  power: "attack" | "thwart",
) {
  if (p.code === "48021")
    return isTextBlank(s, p)
      ? 0
      : 1 + Math.max(0, card(p.storedCards?.[0] || "48021").boost || 0);
  return Math.max(0, Number(rogueTarget(s, p)?.[power] || 0));
}
export function nightcrawlerHasTrait(
  s: GameState,
  id: string,
  trait: string,
  currentTrait?: (id: string, trait: string) => boolean,
) {
  const p = allInPlay(s).find((p) => p.id === id);
  const target =
    p && rogueTarget(s, p) && (p as RoguePiece).nightcrawlerRogueTarget;
  return (
    !!target &&
    (currentTrait
      ? currentTrait(target, trait)
      : (rogueTarget(s, p!)?.traits || "").split(/\.\s*/).includes(trait))
  );
}
export function nightcrawlerResourceSources(
  s: GameState,
  code?: string,
): PaymentSource[] {
  if (
    !code ||
    card(code).type_code !== "event" ||
    s.prompt?.abilityCost ||
    deadpoolTriggeredBlocked(s)
  )
    return [];
  return live(s, "48005")
    .filter((p) => !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      kind: "ability",
      resources: ["wild"],
      description: "Exhaust Prehensile Tail to pay an event's resource cost.",
    }));
}
export function nightcrawlerSpendResource(s: GameState, id: string) {
  const p = live(s, "48005").find((p) => p.id === id && !p.exhausted);
  if (!p || deadpoolTriggeredBlocked(s)) return false;
  p.exhausted = true;
  return true;
}
export function nightcrawlerAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: NightcrawlerPorts,
) {
  if (!["48006", "48015"].includes(p.code)) return null;
  return ports
    .enemies(s, false)
    .filter(
      (t) =>
        ports.canAttach(s, p, t.id) &&
        (p.code !== "48015" || s.minions.some((m) => m.id === t.id)) &&
        !allInPlay(s).some((q) => q.code === p.code && q.attachedTo === t.id),
    );
}
function pairs(s: GameState, ports: NightcrawlerPorts) {
  const chars = ports.characters(s).filter((p) => !p.exhausted);
  return chars
    .filter((p) => ports.hasTrait(s, p.id, "X-Force"))
    .flatMap((first) =>
      chars
        .filter(
          (second) =>
            second.id !== first.id && ports.hasTrait(s, second.id, "X-Men"),
        )
        .map((second) => ({ first, second })),
    );
}
export function nightcrawlerAdditionalCostOptions(
  s: GameState,
  p: Piece,
  ports: NightcrawlerPorts,
): Option[] | null {
  if (
    s.flags[key(p.id)] !== undefined ||
    !["48008", "48010", "48031", "48032"].includes(p.code)
  )
    return null;
  if (p.code === "48008")
    return ports.enemies(s, true).flatMap((t) =>
      bamfs(s, t.id)
        .filter((q) => ports.canDiscard(s, q))
        .map((q) =>
          O(
            q.id,
            `${card(q).name} on ${t.label}`,
            [
              N("cost", {
                eventId: p.id,
                code: p.code,
                id: q.id,
                target: t.id,
              }),
            ],
            q.code,
          ),
        ),
    );
  if (p.code === "48010")
    return s.player.hand
      .filter((q) => q.code === "48006")
      .map((q) =>
        O(
          q.id,
          "Discard Bamf! from hand",
          [N("cost", { eventId: p.id, code: p.code, id: q.id })],
          q.code,
        ),
      );
  return pairs(s, ports).map(({ first, second }) =>
    O(`${first.id}|${second.id}`, `${first.label} and ${second.label}`, [
      N("cost", {
        eventId: p.id,
        code: p.code,
        first: first.id,
        second: second.id,
      }),
    ]),
  );
}
export function nightcrawlerPlayRestriction(
  s: GameState,
  p: Piece,
  ports: NightcrawlerPorts,
): string | null {
  if (["48011", "48018"].includes(p.code))
    return "Play this Defense event in its actual attack response window.";
  const additional = nightcrawlerAdditionalCostOptions(s, p, ports);
  if (additional && !additional.length)
    return "This event requires its actual additional cost.";
  if (p.code === "48010" && !ports.canChange(s) && !ports.canReady(s))
    return "Neither changing forms nor readying can change the game state.";
  if (
    p.code === "48031" &&
    !ports
      .enemies(s, false)
      .some(
        (t) =>
          s.minions.some((m) => m.id === t.id) &&
          !ports.hasTrait(s, t.id, "Elite"),
      )
  )
    return "Combine Forces requires a non-Elite minion.";
  if (
    ["48006", "48015"].includes(p.code) &&
    !nightcrawlerAttachmentTargets(s, p, ports)?.length
  )
    return "There is no legal enemy for this upgrade.";
  return null;
}
export function nightcrawlerAbilityOptions(
  s: GameState,
  id: string,
  ports: NightcrawlerPorts,
): Option[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  if (
    ["hero", "identity"].includes(id) &&
    s.heroId === "nightcrawler" &&
    !isTextBlank(s, identityCard(s).code)
  ) {
    if (
      s.player.form === "alter" &&
      s.flags.nightcrawlerSearchRound !== s.round &&
      s.player.deck.some((p) => p.code === "48006")
    )
      return [O("find-bamf", "Search the deck for Bamf!", [N("search")])];
    if (
      hero(s) &&
      s.flags.nightcrawlerRapidPhase !== phase(s) &&
      s.player.discard.some((p) => p.code === "48006")
    )
      return [
        O("rapid-teleportation", "Spend 1 resource to recover Bamf!", [
          N("rapid-pay"),
        ]),
      ];
  }
  const p = allInPlay(s).find((q) => q.id === id) as RoguePiece | undefined;
  if (
    p?.code === "48012" &&
    !isTextBlank(s, p) &&
    p.nightcrawlerRogueRound !== s.round &&
    ports
      .characters(s)
      .some((t) => t.id !== p.id && ports.canDamageCost(s, t.id))
  )
    return [
      O("absorb", "Deal 1 damage to another friendly character", [
        N("rogue-target", { id }),
      ]),
    ];
  return [];
}
export function nightcrawlerEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "48012") {
    delete (p as RoguePiece).nightcrawlerRogueTarget;
    delete (p as RoguePiece).nightcrawlerRogueRound;
  }
  if (p.code === "48002" && !isTextBlank(s, p))
    return [optional("Daytripper", [N("daytripper", { id: p.id })], p.code)];
  if (p.code === "48021" && !isTextBlank(s, p))
    return [optional("Gambit", [N("gambit", { id: p.id })], p.code)];
  if (p.code === "48014") return [N("control", { id: p.id })];
  return [];
}
export function nightcrawlerEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "48007":
      return [
        E("target", {
          group: "enemy",
          title: card(p).name,
          attack: true,
          action: E("damage", { amount: 3, source: "hero", attack: true }),
        }),
        N("port-punch"),
      ];
    case "48008":
      return [N("drop", { eventId: p.id })];
    case "48009":
      return [
        E("target", {
          group: "scheme",
          title: card(p).name,
          thwart: true,
          action: N("scout", { amount: 3 }),
        }),
      ];
    case "48010":
      return [E("flip", { counts: false }), N("ready")];
    case "48016":
      return [
        E("heal", { target: "hero", amount: 3 }),
        E("status", { target: "hero", status: "tough" }),
      ];
    case "48031":
      return [N("combine")];
    case "48032":
      return [N("gunboat", { eventId: p.id })];
    default:
      return null;
  }
}
export function nightcrawlerBamfOptions(
  s: GameState,
  after: Effect[],
  ports: NightcrawlerPorts,
): Option[] {
  const a = s.attack;
  if (
    !a ||
    !hero(s) ||
    deadpoolTriggeredBlocked(s) ||
    !ports.canDefend(s) ||
    (a.angelTauntPlayerId && a.angelTauntPlayerId !== s.activePlayerId) ||
    (a.defender && a.defender !== "none")
  )
    return [];
  return live(s, "48006")
    .filter((p) => p.attachedTo === a.attacker && ports.canDiscard(s, p))
    .map((p) =>
      O(
        `bamf:${p.id}`,
        "Bamf! · defend without exhausting",
        [N("bamf", { id: p.id, attackId: a.id, after })],
        p.code,
      ),
    );
}
export function nightcrawlerRiposteOptions(
  s: GameState,
  after: Effect[],
  ports: NightcrawlerPorts,
): Option[] {
  if (
    !s.attack ||
    s.attack.defender !== "hero" ||
    s.attack.targetPlayerId !== s.activePlayerId ||
    s.player.form !== "hero" ||
    deadpoolTriggeredBlocked(s)
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "48018" &&
        ports.canPay(s, p) &&
        !s.flags[`nightcrawlerRiposte:${s.attack!.id}:${p.id}`],
    )
    .map((p) =>
      O(
        p.id,
        "Riposte · +2 DEF and delayed damage",
        [N("riposte-play", { id: p.id, attackId: s.attack!.id, after })],
        p.code,
      ),
    );
}
export function nightcrawlerBoostOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: NightcrawlerPorts,
): Option[] {
  if (
    !s.attack ||
    deadpoolTriggeredBlocked(s) ||
    ports.numericBoost(s, p.id) <= 0
  )
    return [];
  return live(s, "48013")
    .filter((q) => ports.canDamageCost(s, q.id))
    .map((q) =>
      O(
        `northstar:${q.id}`,
        "Northstar · deal 1 damage to Northstar to cancel boost icons",
        [N("northstar", { id: q.id, boostId: p.id }), ...after],
        q.code,
      ),
    );
}
export function nightcrawlerRecovered(s: GameState): Effect[] {
  if (s.player.form !== "alter" || deadpoolTriggeredBlocked(s)) return [];
  return live(s, "48003")
    .filter((p) => !p.exhausted)
    .map((p) => optional("Kurt's Chapel", [N("chapel", { id: p.id })], p.code));
}
export function nightcrawlerDefeated(s: GameState, source: string): Effect[] {
  if (s.phase !== "villain") return [];
  const seat = source.startsWith("hero:")
    ? s.players.find((p) => p.id === source.slice(5))
    : source === "hero"
      ? s.players.find((p) => p.id === s.activePlayerId)
      : controller(s, source);
  if (!seat) return [];
  const view = seatView(s, seat);
  if (deadpoolTriggeredBlocked(view)) return [];
  return live(view, "48014")
    .filter((p) => !p.exhausted)
    .map((p) => ({
      ...optional("Change of Fortune", [N("fortune", { id: p.id })], p.code),
      actorId: seat.id,
    }));
}
export function nightcrawlerDefenseFinished(
  s: GameState,
  snapshot: Effect,
  ports: NightcrawlerPorts,
): Effect[] {
  if (
    !snapshot.defender ||
    snapshot.defender === "none" ||
    Number(snapshot.defenderDamage || 0) !== 0
  )
    return [];
  const effects: Effect[] = [];
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (deadpoolTriggeredBlocked(view)) continue;
    if (snapshot.heroDefended)
      for (const p of live(view, "48015").filter(
        (p) => p.attachedTo === snapshot.attacker,
      ))
        effects.push({
          ...optional(
            "Under Control",
            [N("under-control", { id: p.id, target: snapshot.attacker })],
            p.code,
          ),
          actorId: seat.id,
        });
  }
  const target =
    snapshot.defender === "hero"
      ? `hero:${snapshot.playerId}`
      : snapshot.defender;
  if (ports.hasTrait(s, target, "X-Men"))
    for (const scheme of s.sideSchemes.filter(
      (p) => p.code === "48020" && !isTextBlank(s, p),
    )) {
      const actorId =
        scheme.playerSideSchemeController || scheme.ownerId || s.activePlayerId;
      if (!deadpoolTriggeredBlocked(seatView(s, actorId)))
        effects.push({
          ...optional(
            "Astonishing X-Men",
            [E("thwart", { target: scheme.id, amount: 1, source: scheme.id })],
            scheme.code,
          ),
          actorId,
        });
    }
  return effects;
}
export function nightcrawlerDelayedResponses(
  s: GameState,
  a: NonNullable<GameState["attack"]>,
) {
  const view = seatView(s, a.targetPlayerId || s.activePlayerId);
  const ids = JSON.parse(
    String(view.flags[`nightcrawlerRipostes:${a.id}`] || "[]"),
  ) as string[];
  delete view.flags[`nightcrawlerRipostes:${a.id}`];
  return a.defender === "hero" && !a.identityDamage
    ? ids.map((id) => ({
        id: `riposte:${id}`,
        title: "Riposte",
        effects: [
          E("damage", {
            target: a.attacker,
            amount: 3,
            source: "hero",
            actorId: a.targetPlayerId,
          }),
        ],
      }))
    : [];
}
export function nightcrawlerSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === "48020" && !isTextBlank(s, p) ? [N("astonishing")] : [];
}
function takePlayerCard(s: GameState, id: string) {
  for (const zone of [s.player.deck, s.player.discard, s.player.hand]) {
    const i = zone.findIndex((p) => p.id === id);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
}

export function resolveNightcrawlerEffect(
  s: GameState,
  e: Effect,
  ports: NightcrawlerPorts,
): boolean {
  if (!e.type.startsWith("nightcrawler:")) return false;
  switch (e.type) {
    case "nightcrawler:search":
      need(
        s.flags.nightcrawlerSearchRound !== s.round,
        "Kurt's search was already used this round.",
      );
      ports.hidden(s);
      ports.choose(
        s,
        "Kurt Wagner",
        "Find a copy of Bamf!.",
        s.player.deck
          .filter((p) => p.code === "48006")
          .map((p) =>
            O(p.id, card(p).name, [N("searched", { id: p.id })], p.code),
          ),
      );
      break;
    case "nightcrawler:searched": {
      const i = s.player.deck.findIndex(
        (p) => p.id === e.id && p.code === "48006",
      );
      need(i >= 0, "The actual Bamf! must remain in the deck.");
      s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      s.flags.nightcrawlerSearchRound = s.round;
      ports.shuffle(s);
      break;
    }
    case "nightcrawler:rapid-pay":
      ports.pay(s, "Rapid Teleportation", 1, [N("rapid")]);
      break;
    case "nightcrawler:rapid":
      need(
        s.flags.nightcrawlerRapidPhase !== phase(s),
        "Rapid Teleportation was already used this phase.",
      );
      s.flags.nightcrawlerRapidPhase = phase(s);
      if (s.player.discard.some((p) => p.code === "48006"))
        ports.choose(
          s,
          "Rapid Teleportation",
          "Return an actual discarded Bamf!.",
          s.player.discard
            .filter((p) => p.code === "48006")
            .map((p) =>
              O(p.id, card(p).name, [N("return-bamf", { id: p.id })], p.code),
            ),
        );
      break;
    case "nightcrawler:return-bamf": {
      const i = s.player.discard.findIndex(
        (p) => p.id === e.id && p.code === "48006",
      );
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "nightcrawler:cost": {
      const fake = { id: e.eventId, code: e.code } as Piece;
      const opts = nightcrawlerAdditionalCostOptions(s, fake, ports) || [];
      need(
        opts.some((o) =>
          o.effects.some(
            (q) =>
              q.id === e.id &&
              q.target === e.target &&
              q.first === e.first &&
              q.second === e.second,
          ),
        ),
        "The actual additional cost is no longer payable.",
      );
      if (e.code === "48008") {
        ports.discard(s, e.id);
        s.flags[key(e.eventId)] = e.target;
      } else if (e.code === "48010") {
        ports.discardHand(s, e.id);
        s.flags[key(e.eventId)] = true;
      } else {
        const amount =
          ports.characterThwart(s, e.first) +
          ports.characterThwart(s, e.second);
        need(
          ports.exhaust(s, e.first) && ports.exhaust(s, e.second),
          "Both distinct characters must exhaust.",
        );
        s.flags[key(e.eventId)] = amount;
      }
      break;
    }
    case "nightcrawler:drop":
      ports.queue(
        s,
        E("damage", {
          target: s.flags[key(e.eventId)],
          amount: 8,
          source: "hero",
          attack: true,
        }),
        E("status", { target: s.flags[key(e.eventId)], status: "stunned" }),
      );
      break;
    case "nightcrawler:port-punch":
      ports.queue(
        s,
        ...ports
          .enemies(s, true)
          .filter((t) => bamfs(s, t.id).length)
          .map((t) =>
            E("damage", {
              target: t.id,
              amount: 3,
              source: "hero",
              attack: true,
            }),
          ),
      );
      break;
    case "nightcrawler:scout":
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: 3, source: "hero" }),
        N("scout-window", { first: e.target }),
      );
      break;
    case "nightcrawler:scout-window":
      if (
        s.player.hand.some((p) => p.code === "48006") &&
        ports.schemes(s, true).some((t) => t.id !== e.first)
      )
        ports.queue(
          s,
          optional(
            "Scout Ahead",
            [N("scout-discard", { first: e.first })],
            "48009",
          ),
        );
      break;
    case "nightcrawler:scout-discard":
      ports.choose(
        s,
        "Scout Ahead",
        "Discard Bamf! to thwart another scheme.",
        s.player.hand
          .filter((p) => p.code === "48006")
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [N("scout-paid", { id: p.id, first: e.first })],
              p.code,
            ),
          ),
      );
      break;
    case "nightcrawler:scout-paid":
      ports.discardHand(s, e.id);
      ports.choose(
        s,
        "Scout Ahead",
        "Choose another scheme.",
        ports
          .schemes(s, true)
          .filter((t) => t.id !== e.first)
          .map((t) =>
            O(
              t.id,
              t.label,
              [E("thwart", { target: t.id, amount: 3, source: "hero" })],
              t.code,
            ),
          ),
      );
      break;
    case "nightcrawler:ready":
      if (ports.canReady(s)) ports.ready(s);
      break;
    case "nightcrawler:bamf": {
      const a = s.attack,
        p = ports.find(s, e.id);
      need(
        a &&
          a.id === e.attackId &&
          p?.code === "48006" &&
          p.attachedTo === a.attacker &&
          ports.canDiscard(s, p) &&
          ports.canDefend(s) &&
          hero(s),
        "Bamf!'s actual attack or discard cost is unavailable.",
      );
      ports.discard(s, p!.id);
      ports.bamfDefend(s, [
        N("tally-window", {
          id: p!.id,
          attackId: a!.id,
          attacker: a!.attacker,
        }),
        ...(e.after || []),
      ]);
      break;
    }
    case "nightcrawler:tally-window": {
      if (s.attack?.id !== e.attackId || deadpoolTriggeredBlocked(s)) break;
      const opts = eventPlaySources(s)
        .filter((p) => p.code === "48011" && ports.canPay(s, p))
        .map((p) =>
          O(
            p.id,
            "Tally Ho! · return this Bamf! and deal 3 damage",
            [
              N("tally-play", {
                id: p.id,
                bamfId: e.id,
                attacker: e.attacker,
                attackId: e.attackId,
              }),
            ],
            p.code,
          ),
        );
      if (opts.length)
        ports.choose(
          s,
          "After Bamf! declares Nightcrawler",
          "Play Tally Ho!?",
          [...opts, O("continue", "Continue without Tally Ho!", [])],
        );
      break;
    }
    case "nightcrawler:tally-play": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "48011",
      );
      need(
        p && s.attack?.id === e.attackId,
        "Tally Ho! requires the actual Bamf! defense window.",
      );
      ports.reaction(
        s,
        p!,
        [
          N("return-bamf", { id: e.bamfId }),
          E("damage", { target: e.attacker, amount: 3, source: "hero" }),
        ],
        [],
      );
      break;
    }
    case "nightcrawler:riposte-play": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "48018",
      );
      need(
        p && s.attack?.id === e.attackId,
        "Riposte requires the same defended attack.",
      );
      ports.reaction(
        s,
        p!,
        [N("riposte", { id: e.id, attackId: e.attackId })],
        e.after || [],
      );
      break;
    }
    case "nightcrawler:riposte":
      if (s.attack && s.attack.id === e.attackId) {
        s.attack.defenseBonus = Number(s.attack.defenseBonus || 0) + 2;
        s.attack.defense += 2;
        s.flags[`nightcrawlerRiposte:${e.attackId}:${e.id}`] = true;
        const k = `nightcrawlerRipostes:${e.attackId}`;
        s.flags[k] = JSON.stringify([
          ...JSON.parse(String(s.flags[k] || "[]")),
          e.id,
        ]);
      }
      break;
    case "nightcrawler:northstar": {
      const p = ports.find(s, e.id);
      need(
        p?.code === "48013" &&
          !isTextBlank(s, p) &&
          ports.canDamageCost(s, e.id),
        "Northstar cannot pay its damage cost.",
      );
      ports.damageCost(s, e.id, [N("northstar-paid", { boostId: e.boostId })]);
      break;
    }
    case "nightcrawler:northstar-paid":
      ports.cancelBoost(s, e.boostId);
      break;
    case "nightcrawler:rogue-target":
      ports.choose(
        s,
        "Rogue",
        "Deal 1 damage to another friendly character.",
        ports
          .characters(s)
          .filter((t) => t.id !== e.id && ports.canDamageCost(s, t.id))
          .map((t) =>
            O(t.id, t.label, [N("rogue", { id: e.id, target: t.id })], t.code),
          ),
      );
      break;
    case "nightcrawler:rogue": {
      const p = ports.find(s, e.id) as RoguePiece | undefined;
      need(
        p &&
          p.nightcrawlerRogueRound !== s.round &&
          ports.canDamageCost(s, e.target),
        "Rogue's actual damage cost is unavailable.",
      );
      ports.damageCost(s, e.target, [
        N("rogue-paid", { id: e.id, target: e.target }),
      ]);
      break;
    }
    case "nightcrawler:rogue-paid": {
      const p = ports.find(s, e.id) as RoguePiece | undefined;
      if (p) {
        p.nightcrawlerRogueTarget = e.target;
        p.nightcrawlerRogueRound = s.round;
      }
      break;
    }
    case "nightcrawler:chapel": {
      const p = ports.find(s, e.id);
      if (!p || p.exhausted || isTextBlank(s, p) || s.player.form !== "alter")
        break;
      p.exhausted = true;
      ports.choose(
        s,
        "Kurt's Chapel",
        "Choose a player to draw 1 card.",
        playerOrder(s).map((seat) =>
          O(seat.id, identityCard(seatView(s, seat)).name, [
            E("draw", { amount: 1, actorId: seat.id }),
          ]),
        ),
      );
      break;
    }
    case "nightcrawler:fortune": {
      const p = ports.find(s, e.id);
      if (p && !p.exhausted && !isTextBlank(s, p)) {
        p.exhausted = true;
        ports.queue(s, E("draw", { amount: 2 }));
      }
      break;
    }
    case "nightcrawler:under-control": {
      const p = ports.find(s, e.id);
      if (p && !isTextBlank(s, p) && p.attachedTo === e.target)
        ports.queue(
          s,
          E("damage", { target: e.target, amount: 4, source: p.id }),
        );
      break;
    }
    case "nightcrawler:astonishing":
      ports.queue(
        s,
        ...ports
          .enemies(s, false)
          .flatMap((t) => [
            E("status", { target: t.id, status: "stunned" }),
            E("status", { target: t.id, status: "confused" }),
          ]),
      );
      break;
    case "nightcrawler:control":
      ports.choose(
        s,
        "Change of Fortune",
        "Choose its controller.",
        playerOrder(s)
          .filter(
            (seat) =>
              !seatView(s, seat).player.inPlay.some(
                (p) => p.code === "48014" && p.id !== e.id,
              ),
          )
          .map((seat) =>
            O(seat.id, identityCard(seatView(s, seat)).name, [
              N("controlled", { id: e.id, playerId: seat.id }),
            ]),
          ),
      );
      break;
    case "nightcrawler:controlled": {
      const seat = controller(s, e.id),
        p = ports.find(s, e.id);
      if (seat && p && seat.id !== e.playerId) {
        const view = seatView(s, seat);
        view.player.inPlay.splice(view.player.inPlay.indexOf(p), 1);
        seatView(s, e.playerId).player.inPlay.push(p);
      }
      break;
    }
    case "nightcrawler:daytripper": {
      const legal = ports
        .enemies(s, false)
        .filter(
          (t) =>
            ports.canAttach(s, { code: "48006" } as Piece, t.id) &&
            !bamfs(s, t.id).length,
        );
      const cards = [...s.player.deck, ...s.player.discard].filter(
        (p) => p.code === "48006",
      );
      if (!legal.length || !cards.length) {
        ports.shuffle(s);
        ports.queue(s, N("daytripper-damage", { source: e.id }));
        break;
      }
      ports.hidden(s);
      ports.choose(
        s,
        "Daytripper",
        "Find an actual Bamf! to attach.",
        cards.map((p) =>
          O(
            p.id,
            card(p).name,
            [N("daytripper-card", { id: p.id, source: e.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nightcrawler:daytripper-card":
      ports.choose(
        s,
        "Daytripper",
        "Attach Bamf! to an enemy.",
        ports
          .enemies(s, false)
          .filter(
            (t) =>
              ports.canAttach(s, { code: "48006" } as Piece, t.id) &&
              !bamfs(s, t.id).length,
          )
          .map((t) =>
            O(
              t.id,
              t.label,
              [
                N("daytripper-attach", {
                  id: e.id,
                  target: t.id,
                  source: e.source,
                }),
              ],
              t.code,
            ),
          ),
      );
      break;
    case "nightcrawler:daytripper-attach": {
      const p = takePlayerCard(s, e.id);
      if (p) {
        p.attachedTo = e.target;
        s.player.inPlay.push(p);
      }
      ports.shuffle(s);
      ports.queue(s, N("daytripper-damage", { source: e.source }));
      break;
    }
    case "nightcrawler:daytripper-damage":
      ports.damageBatch(
        s,
        ports
          .enemies(s, false)
          .filter((t) => bamfs(s, t.id).length)
          .map((t) => t.id),
        1,
        e.source || "hero",
      );
      break;
    case "nightcrawler:gambit": {
      const p = ports.find(s, e.id);
      if (!p || isTextBlank(s, p)) break;
      ports.hidden(s);
      const cards = s.encounter.deck.slice(0, 3);
      if (cards.length)
        ports.choose(
          s,
          "Gambit",
          "Tuck one boost card; return the rest in any order.",
          cards.map((q) =>
            O(
              q.id,
              card(q).name,
              [N("gambit-tuck", { id: e.id, cardId: q.id, cards })],
              q.code,
            ),
          ),
        );
      break;
    }
    case "nightcrawler:gambit-tuck": {
      const p = ports.find(s, e.id),
        cards = e.cards as Piece[],
        chosen = cards.find((q) => q.id === e.cardId);
      if (p && chosen) {
        const i = s.encounter.deck.findIndex((q) => q.id === chosen.id);
        if (i >= 0) s.encounter.deck.splice(i, 1);
        (p.storedCards ||= []).push(chosen);
      }
      ports.queue(
        s,
        N("gambit-order", { cards: cards.filter((q) => q.id !== e.cardId) }),
      );
      break;
    }
    case "nightcrawler:gambit-order": {
      const cards = e.cards as Piece[];
      if (!cards.length) break;
      ports.choose(
        s,
        "Gambit",
        "Choose the next card to return to the top (last chosen is topmost).",
        cards.map((p) =>
          O(
            p.id,
            card(p).name,
            [
              N("gambit-return", { id: p.id }),
              N("gambit-order", { cards: cards.filter((q) => q.id !== p.id) }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nightcrawler:gambit-return": {
      const i = s.encounter.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.encounter.deck.unshift(s.encounter.deck.splice(i, 1)[0]);
      break;
    }
    case "nightcrawler:combine":
      ports.choose(
        s,
        "Combine Forces",
        "Defeat a non-Elite minion.",
        ports
          .enemies(s, false)
          .filter(
            (t) =>
              s.minions.some((p) => p.id === t.id) &&
              !ports.hasTrait(s, t.id, "Elite"),
          )
          .map((t) =>
            O(t.id, t.label, [N("combine-target", { target: t.id })], t.code),
          ),
      );
      break;
    case "nightcrawler:combine-target":
      need(
        s.minions.some((p) => p.id === e.target) &&
          !ports.hasTrait(s, e.target, "Elite"),
        "Combine Forces must defeat a non-Elite minion.",
      );
      ports.queue(
        s,
        E("nightcrawlerDefeat", { target: e.target, source: "hero" }),
      );
      break;
    case "nightcrawler:gunboat":
      ports.queue(
        s,
        N("distribute", {
          kind: "thwart",
          amount: Number(s.flags[key(e.eventId)] || 0),
          remaining: Number(s.flags[key(e.eventId)] || 0),
          packets: [],
        }),
      );
      break;
    case "nightcrawler:distribute": {
      const packets = e.packets as { target: string; amount: number }[];
      const targets = (
        e.kind === "thwart" ? ports.schemes(s, true) : ports.enemies(s, true)
      ).filter(
        (t) =>
          e.kind !== "thwart" ||
          (t.id === "main"
            ? s.scheme.threat
            : s.sideSchemes.find((p) => p.id === t.id)?.counters || 0) >
            (packets.find((p) => p.target === t.id)?.amount || 0),
      );
      if (!e.remaining || !targets.length) {
        if (e.kind === "thwart")
          ports.distributeThwart(s, packets, [
            N("distribute", {
              kind: "damage",
              amount: e.amount,
              remaining: e.amount,
              packets: [],
            }),
          ]);
        else ports.distributeDamage(s, packets);
        break;
      }
      ports.choose(
        s,
        "Gunboat Diplomacy",
        `Allocate ${e.remaining} remaining ${e.kind === "thwart" ? "threat removal" : "damage"}.`,
        targets.map((t) =>
          O(
            t.id,
            t.label,
            [
              N("distribute", {
                kind: e.kind,
                amount: e.amount,
                remaining: e.remaining - 1,
                packets: [
                  ...packets.filter((p) => p.target !== t.id),
                  {
                    target: t.id,
                    amount:
                      (packets.find((p) => p.target === t.id)?.amount || 0) + 1,
                  },
                ],
              }),
            ],
            t.code,
          ),
        ),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
