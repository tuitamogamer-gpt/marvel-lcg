import { card } from "./card-definitions.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { isTextBlank, eventPlaySources } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const B = (type: string, args: Record<string, unknown> = {}) =>
  E(`bishop:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const trait = (p: Piece, value: string) =>
  (card(p).traits || "").split(/\.\s*/).includes(value);
export const bishopPrintedIcons = (p: Piece) =>
  ["energy", "mental", "physical", "wild"].reduce(
    (n, r) =>
      n +
      Number(
        (card(p) as unknown as Record<string, number>)[`resource_${r}`] || 0,
      ),
    0,
  );
const resourceCard = (p: Piece) => card(p).type_code === "resource";
const handResources = (s: GameState) => s.player.hand.filter(resourceCard);
const temporal = (p: Piece) => trait(p, "Temporal");
const reprints = ["45013", "45018", "45019", "45022", "45023", "45024"];
export const BISHOP_SCRIPT_CODES = [
  "45001a",
  "45001b",
  ...Array.from({ length: 28 }, (_, i) => String(45002 + i)),
].filter((code) => !reprints.includes(code));

export interface BishopPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  mill(s: GameState, amount: number, after: Effect): void;
  discardHand(s: GameState, id: string): Piece;
  discard(s: GameState, id: string): void;
  ready(s: GameState, id: string): void;
  canReady(s: GameState, id: string): boolean;
  heal(s: GameState, id: string, amount: number): void;
  maxHP(s: GameState): number;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  hidden(s: GameState): void;
  hasTrait(s: GameState, id: string, value: string): boolean;
  identitySpecific(p: Piece): boolean;
  canPay(s: GameState, p: Piece): boolean;
  reaction(s: GameState, p: Piece, effects: Effect[], after: Effect[]): void;
  declareDefense(s: GameState): void;
  canChangeToAlter(s: GameState): boolean;
  log(s: GameState, text: string): void;
}

export function bishopInitialize(s: GameState, make: BishopPorts["makePiece"]) {
  if (s.heroId !== "bishop") return;
  for (const code of ["45026", "45027", "45028", "45029", "45029"])
    (s.player.setAside ||= []).push(make(s, code));
}
export function bishopDamageResponses(
  s: GameState,
  target: string,
  amount: number,
  fromAttack: boolean,
): Effect[] {
  return !deadpoolTriggeredBlocked(s) &&
    target === "hero" &&
    amount > 0 &&
    s.player.deck.length > 0 &&
    fromAttack &&
    s.heroId === "bishop" &&
    s.player.form === "hero" &&
    !["won", "lost"].includes(s.phase) &&
    !isTextBlank(s, { id: `hero:${s.activePlayerId}`, code: "45001a" })
    ? [optional("Energy Absorption", [B("absorb", { amount })])]
    : [];
}
export function bishopChangedForm(s: GameState): Effect[] {
  return !deadpoolTriggeredBlocked(s) &&
    s.heroId === "bishop" &&
    s.player.form === "alter" &&
    !isTextBlank(s, { id: `hero:${s.activePlayerId}`, code: "45001b" }) &&
    s.player.discard.some(temporal)
    ? [optional("Temporally Displaced", [B("temporal")])]
    : [];
}
type BishopBonusPiece = Piece & {
  bishopBonusPhase?: string;
  bishopPowerBonus?: number;
};
export function bishopCharacterBonus(s: GameState, id: string) {
  if (id !== "hero" && !id.startsWith("hero:")) {
    const p = allInPlay(s).find((p) => p.id === id) as
      BishopBonusPiece | undefined;
    return p?.bishopBonusPhase === phase(s)
      ? Number(p.bishopPowerBonus || 0)
      : 0;
  }
  const target = id === "hero" ? `hero:${s.activePlayerId}` : id;
  return playerOrder(s).reduce(
    (n, seat) =>
      n +
      Number(
        seatView(s, seat).flags[`bishopSideBySide:${phase(s)}:${target}`] || 0,
      ),
    0,
  );
}
export function bishopAllyHP(s: GameState, p: Piece) {
  return (
    allInPlay(s).filter(
      (q) => q.code === "45015" && q.attachedTo === p.id && !isTextBlank(s, q),
    ).length * 2
  );
}
export function bishopAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: Pick<BishopPorts, "hasTrait" | "identitySpecific">,
) {
  if (!["45014", "45015"].includes(p.code)) return null;
  return allInPlay(s)
    .filter(
      (q) =>
        card(q).type_code === "ally" &&
        (p.code === "45014"
          ? ports.hasTrait(s, q.id, "X-Men") ||
            ports.hasTrait(s, q.id, "X-Force")
          : controller(s, q.id)?.id === s.activePlayerId &&
            ports.identitySpecific(q)) &&
        !allInPlay(s).some(
          (a) => a.id !== p.id && a.code === p.code && a.attachedTo === q.id,
        ),
    )
    .map((q) => ({ id: q.id, label: card(q).name, code: q.code }));
}
export const bishopSidekicks = (s: GameState) =>
  live(s, "45015").flatMap((p) => {
    const ally = s.player.inPlay.find(
      (q) => q.id === p.attachedTo && card(q).type_code === "ally",
    );
    return ally ? [ally] : [];
  });
export function bishopRecovered(s: GameState): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  return bishopSidekicks(s)
    .filter((p) => p.damage > 0)
    .map((p) => optional("Sidekick", [E("heal", { target: p.id, amount: 2 })]));
}
export function bishopPlayRestriction(
  s: GameState,
  p: Piece,
  ports: BishopPorts,
): string | null {
  if (p.code === "45009" && !s.attack)
    return "Energy Conversion requires an enemy attack.";
  if (
    p.code === "45016" &&
    !bishopSidekicks(s).some((q) => ports.canReady(s, q.id))
  )
    return "Side-by-Side requires readying your exhausted sidekick.";
  if (
    p.code === "45021" &&
    !ports.hasTrait(s, "hero", "X-Men") &&
    !ports.hasTrait(s, "hero", "X-Force")
  )
    return "Marrow requires an X-Men or X-Force identity.";
  if (
    ["45014", "45015"].includes(p.code) &&
    !bishopAttachmentTargets(s, p, ports)?.length
  )
    return "There is no eligible ally for this upgrade.";
  return null;
}
export function bishopAbilityOptions(
  s: GameState,
  id: string,
  ports: BishopPorts,
): Option[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const p = s.player.inPlay.find((p) => p.id === id && !isTextBlank(s, p));
  if (!p) return [];
  if (
    ["45002", "45003"].includes(p.code) &&
    s.flags[`bishopReady:${p.id}`] !== phase(s) &&
    handResources(s).some(
      (q) =>
        ports.canReady(s, p.id) ||
        (p.damage > 0 &&
          (p.code === "45002"
            ? card(q).resource_physical
            : card(q).resource_energy)),
    )
  )
    return [
      O(
        "resource-ready",
        `${card(p).name} · discard a resource card to ready`,
        [B("ready-ally", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "45004" &&
    s.player.form === "hero" &&
    !p.exhausted &&
    (handResources(s).length || s.player.stunned)
  )
    return [
      O(
        "rifle",
        "Bishop's Rifle · ranged attack",
        [
          E("exhaust", { id }),
          E("target", {
            group: "enemy",
            attack: true,
            title: "Bishop's Rifle",
            action: E("damage", {
              amount: handResources(s).length,
              attack: true,
              ranged: true,
              source: "hero",
            }),
          }),
        ],
        p.code,
      ),
    ];
  if (p.code === "45006" && handResources(s).length)
    return [
      O(
        "charge",
        "Super-Charged · discard a resource card",
        [B("charge", { id })],
        p.code,
      ),
    ];
  return [];
}
export function bishopBasicOptions(s: GameState, packet: Effect): Option[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  if (
    packet.bishopChargedHandled ||
    packet.power !== "attack" ||
    s.player.form !== "hero" ||
    s.player.stunned
  )
    return [];
  return live(s, "45006")
    .filter((p) => p.counters > 0)
    .map((p) =>
      O(
        p.id,
        `Super-Charged · +${Math.min(8, p.counters * 2)} ATK`,
        [
          E("discardPiece", { id: p.id }),
          {
            ...packet,
            amount: Number(packet.amount) + Math.min(8, p.counters * 2),
            bishopChargedHandled: false,
          },
        ],
        p.code,
      ),
    );
}
export function bishopEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "45007":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Concussive Blast",
          action: E("damage", { amount: 6, attack: true }),
        }),
        ...(s.flags[`bishopResourcePaid:${p.id}`] ? [B("ready-bishop")] : []),
      ];
    case "45008":
      return [
        E("target", {
          group: "scheme",
          title: "Command Authority",
          action: E("thwart", { amount: 3, action: true }),
        }),
        ...(s.flags[`bishopResourcePaid:${p.id}`]
          ? [E("draw", { amount: 1 })]
          : []),
      ];
    case "45009":
      return [B("conversion")];
    case "45016":
      return [B("side-by-side", { eventId: p.id })];
    case "45017":
      return [B("suit-up")];
    default:
      return null;
  }
}
export function bishopEntered(s: GameState, p: Piece): Effect[] {
  delete (p as BishopBonusPiece).bishopBonusPhase;
  delete (p as BishopBonusPiece).bishopPowerBonus;
  if (deadpoolTriggeredBlocked(s)) return [];
  return p.code === "45021" && !isTextBlank(s, p)
    ? [
        optional("Marrow", [
          E("target", {
            group: "enemy",
            title: "Marrow",
            action: E("damage", { amount: 2, source: p.id }),
          }),
        ]),
      ]
    : [];
}
export function bishopAllyUsed(s: GameState, p: Piece): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  return s.player.deck.length > 0 && p.code === "45020" && !isTextBlank(s, p)
    ? [optional("Legion", [B("legion", { id: p.id })])]
    : [];
}
export function bishopDefeated(
  s: GameState,
  defeated: Piece,
  source: string,
  minion: boolean,
  attack: boolean,
): Effect[] {
  const ally = allInPlay(s).find(
    (p) => p.id === source && card(p).type_code === "ally",
  );
  if (!ally) return [];
  const actorId = controller(s, ally.id)?.id || s.activePlayerId;
  const view = seatView(s, actorId);
  if (deadpoolTriggeredBlocked(view)) return [];
  return [
    ...(minion && attack && ally.code === "45012" && !isTextBlank(s, ally)
      ? [B("ready-window", { id: ally.id, actorId })]
      : []),
    ...(!minion &&
    ally.code === "45011" &&
    view.flags[`bishopCableThwart:${defeated.id}`] === source &&
    !isTextBlank(s, ally)
      ? [optional("Cable", [E("draw", { amount: 1, actorId })])]
      : []),
    ...allInPlay(s)
      .filter(
        (p) =>
          p.code === "45014" &&
          p.attachedTo === ally.id &&
          !isTextBlank(s, p) &&
          view.player.hand.length,
      )
      .map((p) => B("suit-window", { id: p.id, ally: ally.id, actorId })),
  ];
}
export function bishopDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: BishopPorts,
): Option[] {
  if (
    deadpoolTriggeredBlocked(s) ||
    s.player.form !== "hero" ||
    !s.attack ||
    (s.flags.bishopConversionAttack === s.attack.id &&
      !s.player.discard.some(resourceCard)) ||
    (s.attack.defender &&
      s.attack.defender !== "none" &&
      s.attack.defender !== "hero")
  )
    return [];
  return eventPlaySources(s)
    .filter((p) => p.code === "45009" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Energy Conversion",
        [B("reaction", { id: p.id, after })],
        p.code,
      ),
    );
}
export function bishopLimitAttackDamage(s: GameState, amount: number): number {
  const attackId = s.attack?.id;
  if (!attackId || s.flags.bishopConversionAttack !== attackId) return amount;
  const available = Math.max(
    0,
    3 - Number(s.flags.bishopConversionDamage || 0),
  );
  return Math.min(amount, available);
}
export function bishopRevealSurge(s: GameState, p: Piece): number {
  if (!temporal(p)) return 0;
  const shared = seatView(s, s.firstPlayerId).flags;
  let gained = 0;
  for (const portal of s.sideSchemes.filter(
    (q) => q.code === "45027" && !isTextBlank(s, q),
  )) {
    const key = `bishopPortal:${portal.id}`;
    if (shared[key] !== phase(s)) {
      shared[key] = phase(s);
      gained++;
    }
  }
  return gained;
}
export function bishopEnemyAllyDefeated(
  s: GameState,
  source: string,
): Effect[] {
  const enemy = s.minions.find(
    (p) => p.id === source && p.code === "45026" && !isTextBlank(s, p),
  );
  if (enemy && s.attack?.attacker === source && s.attack.id)
    seatView(s, s.firstPlayerId).flags[`bishopFitzroyDefeat:${s.attack.id}`] =
      true;
  return [];
}
export function bishopEnemyAttackFinished(
  s: GameState,
  attack: NonNullable<GameState["attack"]>,
): Effect[] {
  const flags = seatView(s, s.firstPlayerId).flags,
    key = `bishopFitzroyDefeat:${attack.id}`;
  const triggered = !!flags[key];
  delete flags[key];
  return triggered ? [B("fitzroy-after", { id: attack.attacker })] : [];
}
export function bishopEncounter(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "45025":
      return [B("obligation", { piece: p })];
    case "45026":
    case "45027":
      return [];
    case "45028":
      return [B("portal")];
    case "45029":
      return [B("trickery")];
    default:
      return null;
  }
}
export const bishopShadows = (s: GameState): Effect[] | null =>
  s.heroId === "bishop" ? [B("nemesis")] : null;
export function bishopSuitUpUpgrade(p: Piece) {
  const instruction =
    (card(p).text || "").match(/Attach to ([^.]+)\./i)?.[1] || "";
  return (
    card(p).type_code === "upgrade" &&
    /\b(?:ally|allies|character)\b/i.test(instruction) &&
    (!/\b(?:enemy|minion|villain)\b/i.test(instruction) ||
      /\b(?:ally|allies)\b/i.test(instruction))
  );
}
function take(
  s: GameState,
  id: string,
  zones: Piece[][] = [s.player.discard, s.player.deck],
) {
  for (const zone of zones) {
    const i = zone.findIndex((p) => p.id === id);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
}

export function resolveBishopEffect(
  s: GameState,
  e: Effect,
  ports: BishopPorts,
): boolean {
  if (!e.type.startsWith("bishop:")) return false;
  switch (e.type) {
    case "bishop:absorb":
      ports.mill(s, e.amount, B("collect"));
      break;
    case "bishop:collect": {
      const discarded = e.discarded as Piece[];
      let recovered = 0;
      for (const p of discarded.filter(resourceCard)) {
        const actual = take(s, p.id);
        if (actual) {
          s.player.hand.push(actual);
          recovered++;
        }
      }
      ports.log(
        s,
        `Energy Absorption: discarded ${discarded.length} cards; returned ${recovered} resource cards.`,
      );
      ports.queue(
        s,
        ...live(s, "45005")
          .filter((p) => !p.exhausted && s.player.hp > 0)
          .map((p) => B("uniform-window", { id: p.id })),
      );
      break;
    }
    case "bishop:uniform-window": {
      const p = ports.find(s, e.id);
      if (
        p &&
        !p.exhausted &&
        !isTextBlank(s, p) &&
        s.player.hp < ports.maxHP(s) &&
        handResources(s).length
      )
        ports.queue(
          s,
          optional("Bishop's Uniform", [B("uniform", { id: p.id })]),
        );
      break;
    }
    case "bishop:uniform": {
      const p = ports.find(s, e.id);
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "Bishop's Uniform must be ready.",
      );
      p!.exhausted = true;
      ports.heal(s, "hero", handResources(s).length);
      break;
    }
    case "bishop:temporal":
      ports.choose(
        s,
        "Temporally Displaced",
        "Return a Temporal card from your discard pile.",
        s.player.discard
          .filter(temporal)
          .map((p) => O(p.id, card(p).name, [B("take", { id: p.id })], p.code)),
      );
      break;
    case "bishop:take": {
      const p = take(s, e.id);
      if (p) s.player.hand.push(p);
      break;
    }
    case "bishop:ready-ally":
    case "bishop:charge": {
      const p = ports.find(s, e.id);
      need(p && !isTextBlank(s, p), "The actual Bishop card is unavailable.");
      ports.choose(
        s,
        card(p!).name,
        "Discard an actual resource card from your hand.",
        handResources(s)
          .filter(
            (q) =>
              e.type === "bishop:charge" ||
              ports.canReady(s, p!.id) ||
              (p!.damage > 0 &&
                (p!.code === "45002"
                  ? card(q).resource_physical
                  : card(q).resource_energy)),
          )
          .map((q) =>
            O(
              q.id,
              card(q).name,
              [
                B("resource-cost", {
                  id: e.id,
                  resource: q.id,
                  charge: e.type === "bishop:charge",
                }),
              ],
              q.code,
            ),
          ),
      );
      break;
    }
    case "bishop:resource-cost": {
      const p = ports.find(s, e.id),
        q = s.player.hand.find((q) => q.id === e.resource && resourceCard(q));
      need(
        p && q && !isTextBlank(s, p),
        "The actual resource discard cost is unavailable.",
      );
      if (!e.charge)
        need(
          s.flags[`bishopReady:${p!.id}`] !== phase(s),
          "This ally already used this ability this phase.",
        );
      const spent = ports.discardHand(s, q!.id);
      if (e.charge) p!.counters += bishopPrintedIcons(spent);
      else {
        s.flags[`bishopReady:${p!.id}`] = phase(s);
        ports.ready(s, p!.id);
        if (
          p!.code === "45002"
            ? card(spent).resource_physical
            : card(spent).resource_energy
        )
          ports.heal(s, p!.id, 1);
      }
      break;
    }
    case "bishop:reaction": {
      const p = eventPlaySources(s).find((p) => p.id === e.id);
      need(p, "The physical Energy Conversion event is unavailable.");
      ports.reaction(s, p!, [B("conversion")], e.after || []);
      break;
    }
    case "bishop:conversion": {
      need(s.attack, "Energy Conversion requires a pending attack.");
      ports.declareDefense(s);
      const resources = s.player.discard.filter(resourceCard);
      for (const p of resources) s.player.deck.push(take(s, p.id)!);
      if (resources.length) ports.shuffle(s);
      if (s.flags.bishopConversionAttack !== s.attack!.id)
        s.flags.bishopConversionDamage = 0;
      s.flags.bishopConversionAttack = s.attack!.id!;
      break;
    }
    case "bishop:sidekick-cost": {
      const p = bishopSidekicks(s).find((p) => p.id === e.id);
      need(
        p && ports.canReady(s, p.id),
        "Side-by-Side must ready the actual exhausted sidekick as its additional cost.",
      );
      ports.ready(s, p!.id);
      s.flags[`bishopSidekickCost:${e.eventId}`] = p!.id;
      break;
    }
    case "bishop:side-by-side":
      if (typeof s.flags[`bishopSidekickCost:${e.eventId}`] === "string") {
        ports.queue(
          s,
          B("side-by-side-effect", {
            id: s.flags[`bishopSidekickCost:${e.eventId}`],
          }),
        );
        break;
      }
      ports.choose(
        s,
        "Side-by-Side",
        "Ready your sidekick as the cost.",
        bishopSidekicks(s)
          .filter((p) => ports.canReady(s, p.id))
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [B("side-by-side-paid", { id: p.id })],
              p.code,
            ),
          ),
      );
      break;
    case "bishop:side-by-side-paid": {
      const p = bishopSidekicks(s).find((p) => p.id === e.id);
      need(
        p && ports.canReady(s, p.id),
        "The actual sidekick must be exhausted and readyable.",
      );
      ports.ready(s, p!.id);
      ports.queue(s, B("side-by-side-effect", { id: p!.id }));
      break;
    }
    case "bishop:side-by-side-effect": {
      ports.ready(s, "hero");
      ports.choose(s, "Side-by-Side", "Choose a benefit for both characters.", [
        O("heal", "Heal 1 damage from both characters", [
          E("heal", { target: "hero", amount: 1 }),
          E("heal", { target: e.id, amount: 1 }),
        ]),
        O("boost", "+1 THW and +1 ATK for both this phase", [
          B("side-bonus", { id: e.id }),
        ]),
      ]);
      break;
    }
    case "bishop:side-bonus": {
      const key = `bishopSideBySide:${phase(s)}:hero:${s.activePlayerId}`;
      s.flags[key] = Number(s.flags[key] || 0) + 1;
      const ally = allInPlay(s).find((p) => p.id === e.id) as
        BishopBonusPiece | undefined;
      if (ally) {
        ally.bishopPowerBonus = bishopCharacterBonus(s, ally.id) + 1;
        ally.bishopBonusPhase = phase(s);
      }
      break;
    }
    case "bishop:ready-bishop": {
      const seat = playerOrder(s).find(
        (seat) =>
          seat.heroId === "bishop" && seatView(s, seat).player.form === "hero",
      );
      if (seat)
        ports.queue(s, E("ready", { target: "hero", actorId: seat.id }));
      break;
    }
    case "bishop:fitzroy-after":
      if (
        s.minions.some(
          (p) => p.id === e.id && p.code === "45026" && !isTextBlank(s, p),
        )
      )
        ports.queue(s, B("portal"));
      break;
    case "bishop:suit-up": {
      ports.hidden(s);
      const pool = [...s.player.deck, ...s.player.discard];
      const allies = pool.filter((p) => card(p).type_code === "ally");
      ports.choose(
        s,
        "Suit Up",
        "Search for an ally, then an upgrade that can attach to it.",
        [
          ...allies.map((p) =>
            O(p.id, card(p).name, [B("suit-ally", { id: p.id })], p.code),
          ),
          O("upgrade", "Search only for an upgrade", [B("suit-upgrade")]),
          O("none", "Finish searching", [B("shuffle")]),
        ],
      );
      break;
    }
    case "bishop:suit-ally": {
      const ally = take(s, e.id);
      if (!ally) break;
      s.player.hand.push(ally);
      ports.queue(s, B("suit-upgrade"));
      break;
    }
    case "bishop:suit-upgrade": {
      const upgrades = [...s.player.deck, ...s.player.discard].filter(
        bishopSuitUpUpgrade,
      );
      ports.choose(
        s,
        "Suit Up · upgrade",
        "Find an upgrade with an ally attachment instruction (FFG Suit Up ruling).",
        [
          ...upgrades.map((p) =>
            O(
              p.id,
              card(p).name,
              [B("take", { id: p.id }), B("shuffle")],
              p.code,
            ),
          ),
          O("none", "Finish searching", [B("shuffle")]),
        ],
      );
      break;
    }
    case "bishop:shuffle":
      ports.shuffle(s);
      break;
    case "bishop:legion":
      ports.mill(s, 1, B("legion-result", { id: e.id }));
      break;
    case "bishop:legion-result": {
      const p = (e.discarded as Piece[])[0];
      if (!p) break;
      ports.queue(
        s,
        ...(card(p).resource_energy
          ? [
              E("target", {
                group: "enemy",
                title: "Legion · energy",
                action: E("damage", { amount: 2, source: e.id }),
              }),
            ]
          : []),
        ...(card(p).resource_mental
          ? [
              E("target", {
                group: "scheme",
                title: "Legion · mental",
                action: E("thwart", { amount: 2, source: e.id }),
              }),
            ]
          : []),
        ...(card(p).resource_physical
          ? [E("heal", { target: e.id, amount: 2 })]
          : []),
      );
      break;
    }
    case "bishop:ready-window":
      if (
        ports.canReady(s, e.id) &&
        ports.find(s, e.id) &&
        !isTextBlank(s, ports.find(s, e.id)!)
      )
        ports.queue(s, optional("X-23", [E("ready", { target: e.id })]));
      break;
    case "bishop:suit-window": {
      const p = ports.find(s, e.id),
        ally = ports.find(s, e.ally);
      if (
        p &&
        ally &&
        !isTextBlank(s, p) &&
        ally.damage > 0 &&
        s.player.hand.length
      )
        ports.queue(
          s,
          optional("Advanced Suit", [
            B("suit-discard", { id: p.id, ally: ally.id }),
          ]),
        );
      break;
    }
    case "bishop:suit-discard":
      ports.choose(
        s,
        "Advanced Suit",
        "Discard a card from your hand to heal the attached ally.",
        s.player.hand.map((p) =>
          O(
            p.id,
            card(p).name,
            [B("suit-heal", { id: p.id, ally: e.ally })],
            p.code,
          ),
        ),
      );
      break;
    case "bishop:suit-heal": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(p, "The actual discard cost is unavailable.");
      const amount = bishopPrintedIcons(p!);
      ports.discardHand(s, p!.id);
      ports.heal(s, e.ally, amount);
      break;
    }
    case "bishop:obligation": {
      if (s.player.form === "hero" && ports.canChangeToAlter(s))
        ports.choose(
          s,
          "Fear the Future",
          "You may change to alter-ego form before choosing.",
          [
            O(
              "flip",
              "Change to Lucas Bishop",
              [
                E("flip", { counts: false, target: "alter" }),
                B("obligation-pick", { piece: e.piece }),
              ],
              "45001b",
            ),
            O(
              "stay",
              "Stay in hero form",
              [B("obligation-pick", { piece: e.piece })],
              "45001a",
            ),
          ],
        );
      else ports.queue(s, B("obligation-pick", { piece: e.piece }));
      break;
    }
    case "bishop:obligation-pick": {
      const p = e.piece as Piece;
      ports.choose(
        s,
        "Fear the Future",
        "Choose how to resolve this obligation.",
        [
          ...(s.player.form === "alter" && !s.player.exhausted
            ? [
                O(
                  "settle",
                  "Exhaust Lucas Bishop to remove this obligation",
                  [E("settle", { piece: p })],
                  p.code,
                ),
              ]
            : []),
          O(
            "discard",
            "Discard this obligation and each resource card in your hand",
            [B("fear-discard", { piece: p })],
            p.code,
          ),
        ],
      );
      break;
    }
    case "bishop:fear-discard": {
      const resources = handResources(s);
      for (const p of resources) ports.discardHand(s, p.id);
      if (!resources.length)
        ports.queue(s, E("surge", { sourceCode: "45025" }));
      break;
    }
    case "bishop:portal": {
      const portal = s.sideSchemes.find((p) => p.code === "45027");
      if (portal) ports.queue(s, E("threat", { target: portal.id, amount: 2 }));
      else {
        const zones = [
          s.encounter.deck,
          s.encounter.discard,
          s.resolving,
          ...playerOrder(s).map((p) => seatView(s, p).player.setAside || []),
        ];
        let found: Piece | undefined;
        for (const zone of zones) {
          const i = zone.findIndex((p) => p.code === "45027");
          if (i >= 0) {
            found = zone.splice(i, 1)[0];
            break;
          }
        }
        ports.shuffleEncounter(s);
        if (found) {
          s.queue = s.queue.filter(
            (e) => !(e.type === "reveal" && e.piece?.id === found!.id),
          );
          ports.queue(s, E("reveal", { piece: found }));
        }
      }
      break;
    }
    case "bishop:trickery": {
      const maximum = Math.max(0, ...s.player.hand.map(bishopPrintedIcons));
      const cards = s.player.hand.filter(
        (p) => bishopPrintedIcons(p) === maximum,
      );
      if (cards.length)
        ports.choose(
          s,
          "Temporal Trickery",
          "Discard a card with the most printed resource icons.",
          cards.map((p) =>
            O(p.id, card(p).name, [B("trickery-paid", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "bishop:trickery-paid": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(p, "The actual highest-resource card is unavailable.");
      const amount = bishopPrintedIcons(p!);
      ports.discardHand(s, p!.id);
      ports.queue(
        s,
        ...["main", ...s.sideSchemes.map((p) => p.id)].map((target) =>
          E("threat", { target, amount }),
        ),
      );
      break;
    }
    case "bishop:nemesis": {
      const reserve = s.player.setAside || [],
        minion = reserve.find((p) => p.code === "45026"),
        scheme = reserve.find((p) => p.code === "45027");
      if (!minion && !scheme) {
        ports.queue(s, E("surge"));
        break;
      }
      const introduced = reserve.filter(
        (p) => p.code >= "45026" && p.code <= "45029",
      );
      const reveal: Effect[] = [];
      for (const p of introduced) {
        reserve.splice(reserve.indexOf(p), 1);
        if (p === minion || p === scheme) {
          if (!s.resolving.some((q) => q.id === p.id)) s.resolving.push(p);
          reveal.push(E("reveal", { piece: p }));
        } else s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...reveal);
      s.flags.nemesis = true;
      break;
    }
    default:
      throw Error(`Unknown Bishop effect: ${e.type}`);
  }
  return true;
}
