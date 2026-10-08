import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { controller, playerOrder, seatView } from "./team.js";
import { defenseEventSources, isTextBlank } from "./card-text.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("mts-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );
const trait = (c: Card | undefined, name: string) =>
  (c?.traits || "").split(/\.\s*/).includes(name);
const allies = (s: GameState) =>
  s.player.inPlay.filter((p) => cards.get(p.code)?.type_code === "ally");
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const entities = new Set(["21042", "21048", "21054", "21060"]);

export const MTS_PLAYER_PACK_CORE_ALIASES = [
  "21021",
  "21023",
  "21024",
  "21025",
  "21044",
  "21045",
  "21049",
  "21051",
  "21056",
  "21057",
  "21062",
  "21063",
] as const;
export const MTS_PLAYER_PACK_SCRIPT_CODES = [
  "21011",
  "21012",
  "21013",
  "21014",
  "21015",
  "21016",
  "21017",
  "21018",
  "21019",
  "21020",
  "21022",
  "21041",
  "21042",
  "21043",
  "21046",
  "21047",
  "21048",
  "21050",
  "21052",
  "21053",
  "21054",
  "21055",
  "21058",
  "21059",
  "21060",
  "21061",
  "21064",
  "21065",
] as const;
export interface MtsPlayerPackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface MtsPlayerPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  /** Actual current traits, including trait-granting cards and identity forms. */
  characterTraits(s: GameState, target: string): string[];
  enemyTargets(s: GameState, attack?: boolean): MtsPlayerPackTarget[];
  schemeTargets(s: GameState, thwart?: boolean): MtsPlayerPackTarget[];
  friendlyTargets(s: GameState): MtsPlayerPackTarget[];
  heroAttack(s: GameState): number;
  maxHeroHP(s: GameState): number;
  allyAttack(s: GameState, p: Piece): number;
  canReady(s: GameState, target: string): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
    requirements?: Resource[],
    handOnly?: boolean,
  ): boolean;
  discardPlayerTop(s: GameState): { piece?: Piece; emptied: boolean };
  shufflePlayerDeck(s: GameState): void;
  revealHidden(s: GameState): void;
  canPutAlly(s: GameState, p: Piece): boolean;
  /** Put this actual discarded ally into play. Ordinary enter-play responses
   * must wait until the triggering event finishes; no ally was played. */
  putAllyFromDiscard(s: GameState, id: string): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  shuffleResolvingIntoEncounter(s: GameState, id: string): void;
  removeResolvingOwnedToRemoved(s: GameState, id: string): void;
  preventAllAttackDamage(s: GameState, packet: Effect, amount: number): void;
  claimDefense(s: GameState, packet: Effect): void;
}
export function mtsIsCosmicEntity(p: Piece | string) {
  return entities.has(typeof p === "string" ? p : p.code);
}
export function mtsPlayerPackHeroStats(s: GameState) {
  const amount = Number(s.flags.mtsPackMoxie || 0);
  return { attack: amount, thwart: amount, defense: amount };
}
export function mtsPlayerPackModifiers(
  s: GameState,
  target: string,
  ports: Pick<MtsPlayerPackPorts, "hasTrait">,
) {
  if (target === "hero") return mtsPlayerPackHeroStats(s);
  const seat = controller(s, target),
    view = seat ? seatView(s, seat) : s;
  const p = view.player.inPlay.find((p) => p.id === target);
  if (!p || cards.get(p.code)?.type_code !== "ally")
    return { attack: 0, thwart: 0, defense: 0 };
  const mighty = view.player.inPlay.filter(
    (p) => p.code === "21015" && !isTextBlank(view, p),
  ).length;
  const bonus =
    mighty &&
    ["hero", ...allies(view).map((p) => p.id)].every((id) =>
      ports.hasTrait(view, id, "Avenger"),
    )
      ? mighty
      : 0;
  return {
    attack: bonus + Number(view.flags["mtsPackChi:" + target] || 0),
    thwart: bonus,
    defense: 0,
  };
}
export function mtsPlayerPackAllyLimit(
  s: GameState,
  ports: Pick<MtsPlayerPackPorts, "hasTrait">,
) {
  return s.player.inPlay.some(
    (p) => p.code === "21020" && !isTextBlank(s, p),
  ) && allies(s).every((p) => ports.hasTrait(s, p.id, "Avenger"))
    ? 1
    : 0;
}
export function mtsPlayerPackCardCostReduction(
  s: GameState,
  p: Piece | Card,
  ports: Pick<MtsPlayerPackPorts, "hasTrait">,
) {
  let amount =
    p.code === "21011"
      ? ["hero", ...allies(s).map((p) => p.id)].filter((id) =>
          ports.hasTrait(s, id, "Avenger"),
        ).length
      : p.code === "21065" && ports.hasTrait(s, "hero", "Guardian")
        ? 1
        : 0;
  if (
    cards.get(p.code)?.type_code === "ally" &&
    trait(cards.get(p.code), "Avenger") &&
    s.flags.mtsPackTowerPhase === phaseKey(s)
  )
    amount += Number(s.flags.mtsPackTowerDiscount || 0);
  return amount;
}
/** Band Together has no fixed printed icons. Only its controller's allies count. */
export function mtsPlayerPackCardResources(
  s: GameState,
  p: Piece,
): Resource[] | null {
  return p.code === "21018"
    ? Array<Resource>(Math.min(3, allies(s).length)).fill("wild")
    : null;
}
export function mtsPlayerPackCardPlayed(s: GameState, c: Card) {
  if (c.type_code === "ally" && trait(c, "Avenger")) {
    delete s.flags.mtsPackTowerDiscount;
    delete s.flags.mtsPackTowerPhase;
  }
}
export function mtsPlayerPackPhaseEnded(s: GameState) {
  delete s.flags.mtsPackTowerDiscount;
  delete s.flags.mtsPackTowerPhase;
  for (const key of Object.keys(s.flags))
    if (key.startsWith("mtsPackChi:")) delete s.flags[key];
}
export function mtsPlayerPackRoundEnded(s: GameState) {
  delete s.flags.mtsPackMoxie;
}
function teamSeats(s: GameState, id?: string) {
  return playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) => p.id !== id && trait(cards.get(p.code), "Team"),
      ),
  );
}
function rumbleSeats(s: GameState, id?: string) {
  return playerOrder(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) => p.id !== id && p.code === "21022",
      ),
  );
}
/** Each selected ally shares a current trait with the hero. The allies may
 * share different hero traits. They exhaust as a cost and never attack. */
function massGroups(s: GameState, ports: MtsPlayerPackPorts): Piece[][] {
  const ready = allies(s).filter((p) => !p.exhausted);
  const traits = ports.characterTraits(s, "hero");
  const groups: Piece[][] = [];
  for (let a = 0; a < ready.length; a++)
    for (let b = a + 1; b < ready.length; b++)
      for (let c = b + 1; c < ready.length; c++) {
        const group = [ready[a], ready[b], ready[c]];
        if (group.every((p) => traits.some((t) => ports.hasTrait(s, p.id, t))))
          groups.push(group);
      }
  return groups;
}
export function mtsPlayerPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: MtsPlayerPackPorts,
): string | null {
  if (["21017", "21061"].includes(p.code))
    return "Available automatically during its printed response or interrupt.";
  if (
    ["21043", "21050", "21055"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Mystic")
  )
    return "Your identity must have the Mystic trait.";
  if (p.code === "21015" && !teamSeats(s).length)
    return "Each player already controls a Team card.";
  if (p.code === "21022" && !rumbleSeats(s).length)
    return "Ready to Rumble is limited to 1 per player.";
  if (p.code === "21016" && !massGroups(s, ports).length)
    return "Mass Attack requires three ready allies sharing a trait with your hero.";
  if (["21043", "21050", "21055"].includes(p.code) && !s.player.deck.length)
    return "This Spell requires actual cards in your deck.";
  if (
    p.code === "21043" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "Magic Attack requires an eligible enemy.";
  if (
    p.code === "21050" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Zone of Silence requires an eligible scheme.";
  return null;
}
export function mtsPlayerPackCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "21012") {
    p.counters = 2;
    // Leaving play ends modifiers on that previous instance. A new instance
    // keeps its physical provenance ID, including when another player puts it
    // into play, but cannot inherit the previous phase's spent-chi bonus.
    for (const seat of s.players)
      delete seatView(s, seat).flags["mtsPackChi:" + p.id];
  }
  return ["21015", "21022"].includes(p.code)
    ? [P("control", { id: p.id })]
    : [];
}
export function mtsPlayerPackAllyEnter(
  s: GameState,
  p: Piece,
  playedFromHand = false,
): Effect[] | null {
  if (
    ![
      "21011",
      "21012",
      "21013",
      "21014",
      "21019",
      "21041",
      "21047",
      "21053",
      "21059",
      "21065",
    ].includes(p.code)
  )
    return null;
  const actorId = controller(s, p.id)?.id;
  if (p.code === "21013" && playedFromHand) {
    const printedStage = String(cards.get(s.villain.code)?.stage || "");
    const amount = Math.min(
      3,
      ({ I: 1, II: 2, III: 3, IV: 4, V: 5 } as Record<string, number>)[
        printedStage
      ] ||
        Number(printedStage) ||
        1,
    );
    return [
      E("optional", {
        actorId,
        title: "White Tiger",
        text: `Draw ${amount} cards after playing White Tiger from hand?`,
        effects: [E("draw", { amount })],
      }),
    ];
  }
  if (p.code === "21014")
    return [
      E("optional", {
        actorId,
        title: "Kaluu",
        text: "Search the top five cards for an event, then shuffle?",
        effects: [P("kaluu", { id: p.id })],
      }),
    ];
  if (p.code === "21047")
    return [
      E("optional", {
        actorId,
        title: "Quasar",
        text: "Remove 1 threat from each scheme?",
        effects: [
          E("thwart", { target: "main", amount: 1, source: p.id }),
          ...s.sideSchemes.map((scheme) =>
            E("thwart", { target: scheme.id, amount: 1, source: p.id }),
          ),
        ],
      }),
    ];
  return [];
}
/** Additional costs resolve before status cards replace an event's ability. */
export function mtsPlayerPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  if (p.code === "21016") return [P("mass-cost", { id: p.id, after })];
  if (["21043", "21050"].includes(p.code))
    return [P("spell-target-cost", { id: p.id, code: p.code, after })];
  if (p.code === "21055") return [P("summon-cost", { id: p.id, after })];
  return after;
}
export function mtsPlayerPackEvent(s: GameState, p: Piece): Effect[] | null {
  if (mtsIsCosmicEntity(p)) return [P("entity-shuffle", { id: p.id })];
  switch (p.code) {
    case "21016":
      return [P("mass", { id: p.id })];
    case "21017":
      return [P("moxie")];
    case "21043":
    case "21050":
      return [P("spell", { id: p.id, code: p.code })];
    case "21055":
      return [P("summon", { id: p.id })];
    case "21061":
      return [];
    default:
      return null;
  }
}
export function mtsPlayerPackEventFinished(s: GameState, p: Piece) {
  delete s.flags["mtsPackEventCost:" + p.id];
}
export function mtsPlayerPackEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (!mtsIsCosmicEntity(p)) return null;
  const effect =
    p.code === "21042"
      ? E("damage", {
          target: s.villain.id,
          amount: 2,
          source: "cosmic-entity",
        })
      : p.code === "21048"
        ? E("thwart", { target: "main", amount: 2, source: "cosmic-entity" })
        : p.code === "21054"
          ? E("draw", { amount: 1 })
          : E("heal", { target: "hero", amount: 2 });
  return [
    { ...effect, mandatory: true, cannotCancel: true },
    P("entity-remove", { id: p.id, mandatory: true, cannotCancel: true }),
  ];
}
export function mtsPlayerPackBoost(_s: GameState, p: Piece): Effect[] | null {
  return mtsIsCosmicEntity(p) ? [] : null;
}

export function mtsPlayerPackAbilityOptions(
  s: GameState,
  id: string,
  _ports: MtsPlayerPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p) return [];
  if (p.code === "21012" && p.counters > 0)
    return Array.from({ length: p.counters }, (_, i) =>
      O(
        "chi-" + (i + 1),
        `Discard ${i + 1} chi · +${2 * (i + 1)} ATK this phase`,
        [P("chi", { id, amount: i + 1 })],
        p.code,
      ),
    );
  if (p.code === "21020" && !p.exhausted)
    return [
      O(
        "tower",
        "Avengers Tower · reduce the next Avenger ally's cost by 1",
        [P("tower", { id })],
        p.code,
      ),
    ];
  return [];
}
export function mtsPlayerPackAbility(
  s: GameState,
  id: string,
  ports: MtsPlayerPackPorts,
  action?: string,
): boolean {
  const option = mtsPlayerPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!option) return false;
  ports.queue(s, ...option.effects);
  return true;
}
/** The same response options participate in identity-form and Spectrum energy-
 * form windows. The host resumes the serialized window after each response. */
export function mtsPlayerPackFormResponseOptions(
  s: GameState,
  after: Effect[],
  ports: MtsPlayerPackPorts,
): Option[] {
  if (s.player.form !== "hero") return [];
  return [
    ...s.player.hand
      .filter(
        (p) =>
          p.code === "21017" &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
      )
      .map((p) =>
        O(
          p.id,
          "Moxie · +1 THW, ATK and DEF this round",
          [P("moxie-pay", { id: p.id, after })],
          p.code,
        ),
      ),
    ...(ports.canReady(s, "hero")
      ? s.player.inPlay
          .filter((p) => p.code === "21022" && !isTextBlank(s, p))
          .map((p) =>
            O(
              p.id,
              "Ready to Rumble · discard to ready your hero",
              [P("rumble", { id: p.id, after })],
              p.code,
            ),
          )
      : []),
  ];
}
/** Resources respond after actually being spent, even as surplus for a zero-
 * cost card. The physical resource remains in the payer's discard pile. */
export function mtsPlayerPackResourcesSpent(
  s: GameState,
  pieces: Piece[],
  ports: MtsPlayerPackPorts,
): Effect[] {
  if (s.player.form !== "hero") return [];
  return pieces.flatMap((p) => {
    let effects: Effect[];
    if (p.code === "21046")
      effects = [
        E("damage", { target: s.villain.id, amount: 1, source: "audacity" }),
      ];
    else if (p.code === "21052")
      effects = [
        E("thwart", { target: "main", amount: 1, source: "determination" }),
      ];
    else if (p.code === "21058" && allies(s).some((p) => p.damage > 0))
      effects = [P("innovation")];
    else if (p.code === "21064" && s.player.hp < ports.maxHeroHP(s))
      effects = [E("heal", { target: "hero", amount: 1 })];
    else return [];
    return [
      E("optional", {
        actorId: s.activePlayerId,
        title: cards.get(p.code)!.name,
        text: "Resolve this spent resource's Hero Response?",
        effects,
      }),
    ];
  });
}
export function mtsPlayerPackAfterAllyBasic(s: GameState, p: Piece): Effect[] {
  return p.code === "21019" && !isTextBlank(s, p)
    ? [
        P("blade", {
          id: p.id,
          actorId: controller(s, p.id)?.id,
          mandatory: true,
          forced: true,
        }),
      ]
    : [];
}
/** Optional actual ally-attack interrupt, before damage. Spending the resource
 * pays an ability on the Aggression card, so Power of Aggression can double. */
export function mtsPlayerPackAllyBasicOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
  after: Effect[],
  ports: MtsPlayerPackPorts,
): Option[] {
  return p.code === "21041" &&
    !isTextBlank(s, p) &&
    !p.stunned &&
    (packet.action === "attack" || packet.kind === "attack") &&
    !packet.mtsMarvelBoyHandled &&
    ports.canPay(s, 1, "", p.code, ["physical"])
    ? [
        O(
          p.id,
          "Marvel Boy · spend a physical resource for piercing and ranged",
          [P("marvel-boy", { id: p.id, packet, after })],
          p.code,
        ),
      ]
    : [];
}
/** This is a defeat interrupt, not a discard/leave-play response. The host
 * keeps the actual pending defeat continuation until the selected ready ends. */
export function mtsPlayerPackAllyDefeatOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: MtsPlayerPackPorts,
): Option[] {
  if (p.code !== "21053" || isTextBlank(s, p)) return [];
  return ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        t.id !== p.id &&
        ports.hasTrait(s, t.id, "Guardian") &&
        ports.canReady(s, t.id),
    )
    .map((t) =>
      O(
        t.id,
        "Major Victory · ready " + t.label,
        [E("ready", { target: t.id }), ...after],
        t.code,
      ),
    );
}
const ownHeroTarget = (s: GameState, target: string) =>
  target === "hero" ||
  target === "hero:" + s.activePlayerId ||
  target === s.activePlayerId;
export function mtsPlayerPackDamageOptions(
  s: GameState,
  packet: Effect,
  amount: number,
  after: Effect[],
  ports: MtsPlayerPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !ownHeroTarget(s, packet.target) ||
    !packet.attack ||
    amount <= 0 ||
    s.player.deck.length < amount ||
    !ports.hasTrait(s, "hero", "Mystic")
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "21061" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        `Shield Spell · discard ${amount} cards to prevent all attack damage`,
        [P("shield-pay", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
function pay(
  s: GameState,
  p: Piece,
  effects: Effect[] | undefined,
  continuation: Effect[],
  ports: MtsPlayerPackPorts,
) {
  ports.queue(
    s,
    E("payRequest", {
      title: cards.get(p.code)!.name,
      cost: ports.cardCost(s, p),
      piece: p,
      cancelable: false,
      after: [
        E("resolveHandEvent", {
          id: p.id,
          ...(effects === undefined ? {} : { after: effects }),
          continuation,
        }),
      ],
    }),
  );
}
function storedCost(
  s: GameState,
  id: string,
): { ids?: string[]; target?: string; amount?: number; allyId?: string } {
  const value = s.flags["mtsPackEventCost:" + id];
  return typeof value === "string" ? JSON.parse(value) : {};
}
function saveCost(s: GameState, id: string, data: Record<string, unknown>) {
  s.flags["mtsPackEventCost:" + id] = JSON.stringify(data);
}
function discardFixed(
  s: GameState,
  amount: number,
  ports: MtsPlayerPackPorts,
): number {
  let discarded = 0;
  for (let i = 0; i < amount && s.player.deck.length; i++) {
    const result = ports.discardPlayerTop(s);
    if (result.piece) discarded++;
    if (result.emptied || !result.piece) break;
  }
  return discarded;
}
export function resolveMtsPlayerPackEffect(
  s: GameState,
  e: Effect,
  ports: MtsPlayerPackPorts,
): boolean {
  if (!e.type.startsWith("mts-pack:")) return false;
  switch (e.type) {
    case "mts-pack:control": {
      const p = own(s, e.id);
      if (!p) break;
      const seats =
        p.code === "21015" ? teamSeats(s, p.id) : rumbleSeats(s, p.id);
      need(seats.length, "No player can control this card.");
      if (seats.length === 1) ports.transferControl(s, p.id, seats[0].id);
      else
        ports.choose(
          s,
          cards.get(p.code)!.name,
          "Choose a player to control this card.",
          seats.map((seat) =>
            O(seat.id, seat.heroId, [
              P("control-to", { id: p.id, playerId: seat.id }),
            ]),
          ),
        );
      break;
    }
    case "mts-pack:control-to": {
      const p = own(s, e.id);
      const seats =
        p?.code === "21015" ? teamSeats(s, p?.id) : rumbleSeats(s, p?.id);
      need(
        p && seats.some((seat) => seat.id === e.playerId),
        "That player cannot control another copy of this card.",
      );
      ports.transferControl(s, p!.id, e.playerId);
      break;
    }
    case "mts-pack:chi": {
      const p = own(s, e.id, "21012");
      need(
        p &&
          Number.isInteger(e.amount) &&
          e.amount > 0 &&
          e.amount <= p.counters,
        "Power Man needs the selected chi counters.",
      );
      p!.counters -= e.amount;
      s.flags["mtsPackChi:" + p!.id] =
        Number(s.flags["mtsPackChi:" + p!.id] || 0) + 2 * e.amount;
      break;
    }
    case "mts-pack:tower": {
      const p = own(s, e.id, "21020");
      need(p && !p.exhausted, "Avengers Tower must be ready.");
      p!.exhausted = true;
      s.flags.mtsPackTowerPhase = phaseKey(s);
      s.flags.mtsPackTowerDiscount =
        Number(s.flags.mtsPackTowerDiscount || 0) + 1;
      break;
    }
    case "mts-pack:kaluu": {
      if (!own(s, e.id, "21014")) break;
      ports.revealHidden(s);
      const events = s.player.deck
        .slice(0, 5)
        .filter((p) => cards.get(p.code)?.type_code === "event");
      if (!events.length) ports.shufflePlayerDeck(s);
      else
        ports.choose(
          s,
          "Kaluu",
          "Choose an event among the top five cards, then shuffle your deck.",
          events.map((p) =>
            O(
              p.id,
              cards.get(p.code)!.name,
              [P("kaluu-take", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "mts-pack:kaluu-take": {
      const i = s.player.deck
        .slice(0, 5)
        .findIndex(
          (p) => p.id === e.id && cards.get(p.code)?.type_code === "event",
        );
      need(i >= 0, "Kaluu can only find an event among the searched top five.");
      s.player.hand.push(...s.player.deck.splice(i, 1));
      ports.shufflePlayerDeck(s);
      break;
    }
    case "mts-pack:mass-cost": {
      const groups = massGroups(s, ports);
      need(
        groups.length,
        "Mass Attack requires three ready allies sharing a trait with your hero.",
      );
      ports.choose(
        s,
        "Mass Attack",
        "Choose three allies to exhaust as an additional cost.",
        groups.map((group) =>
          O(
            group.map((p) => p.id).join("+"),
            group.map((p) => cards.get(p.code)!.name).join(" + "),
            [
              P("mass-exhaust", {
                id: e.id,
                ids: group.map((p) => p.id),
                after: e.after || [],
              }),
            ],
          ),
        ),
      );
      break;
    }
    case "mts-pack:mass-exhaust": {
      const group = massGroups(s, ports).find(
        (group) =>
          group.every((p) => e.ids.includes(p.id)) && e.ids.length === 3,
      );
      need(
        group,
        "Mass Attack's selected allies must remain ready and share a hero trait.",
      );
      group!.forEach((p) => {
        p.exhausted = true;
      });
      saveCost(s, e.id, { ids: e.ids });
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mts-pack:mass": {
      const ids = storedCost(s, e.id).ids || [];
      const amount =
        ports.heroAttack(s) +
        ids.reduce((sum, id) => {
          const p = s.player.inPlay.find((p) => p.id === id);
          return sum + (p ? ports.allyAttack(s, p) : 0);
        }, 0);
      need(ids.length === 3, "Mass Attack's exhaust cost must be paid first.");
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Mass Attack",
          action: E("damage", {
            amount,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        }),
      );
      break;
    }
    case "mts-pack:spell-target-cost": {
      const attack = e.code === "21043";
      const targets = attack
        ? ports.enemyTargets(s, !s.player.stunned)
        : ports.schemeTargets(s, !s.player.confused);
      // The discard is a cost; an unavailable effect target is irrelevant
      // when Stun/Confuse will replace that attack/thwart after the cost.
      if (!targets.length && (attack ? s.player.stunned : s.player.confused)) {
        ports.queue(
          s,
          P("spell-count-cost", {
            id: e.id,
            code: e.code,
            after: e.after || [],
          }),
        );
        break;
      }
      need(targets.length, "This Spell needs an eligible target.");
      ports.choose(
        s,
        cards.get(e.code)!.name,
        "Choose a target before discarding the additional cost.",
        targets.map((t) =>
          O(
            t.id,
            t.label,
            [
              P("spell-count-cost", {
                id: e.id,
                code: e.code,
                target: t.id,
                after: e.after || [],
              }),
            ],
            t.code,
          ),
        ),
      );
      break;
    }
    case "mts-pack:spell-count-cost": {
      const maximum = Math.min(
        e.code === "21043" ? 5 : 4,
        s.player.deck.length,
      );
      need(
        maximum > 0,
        "This Spell must discard at least one actual deck card.",
      );
      ports.choose(
        s,
        cards.get(e.code)!.name,
        "Choose how many cards to discard from the top of your deck as a cost.",
        Array.from({ length: maximum }, (_, index) =>
          O(String(index + 1), `Discard ${index + 1} cards`, [
            P("spell-discard-cost", {
              id: e.id,
              code: e.code,
              target: e.target,
              amount: index + 1,
              after: e.after || [],
            }),
          ]),
        ),
      );
      break;
    }
    case "mts-pack:spell-discard-cost": {
      need(
        Number.isInteger(e.amount) &&
          e.amount >= 1 &&
          e.amount <= (e.code === "21043" ? 5 : 4) &&
          e.amount <= s.player.deck.length,
        "The selected Spell cost is unavailable.",
      );
      const amount = discardFixed(s, e.amount, ports);
      need(
        amount === e.amount,
        "The complete selected Spell cost must be paid.",
      );
      saveCost(s, e.id, { target: e.target, amount });
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mts-pack:spell": {
      const { target, amount } = storedCost(s, e.id);
      need(
        target && amount !== undefined,
        "This Spell's target and additional cost must be chosen first.",
      );
      if (e.code === "21043")
        ports.queue(
          s,
          E("damage", {
            target,
            amount,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        );
      else
        ports.queue(
          s,
          E("thwart", { target, amount, source: "hero", action: true }),
        );
      break;
    }
    case "mts-pack:summon-cost": {
      let allyId: string | undefined;
      while (s.player.deck.length) {
        const result = ports.discardPlayerTop(s);
        if (
          result.piece &&
          cards.get(result.piece.code)?.type_code === "ally"
        ) {
          allyId = result.piece.id;
          // The last original card may have recycled immediately. Preserve
          // its exact physical identity and put it back in the discard area.
          const i = s.player.deck.findIndex((p) => p.id === allyId);
          if (i >= 0) s.player.discard.push(...s.player.deck.splice(i, 1));
          break;
        }
        if (result.emptied || !result.piece) break;
      }
      saveCost(s, e.id, { allyId });
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mts-pack:summon": {
      const allyId = storedCost(s, e.id).allyId;
      const p = s.player.discard.find((p) => p.id === allyId);
      if (p && ports.canPutAlly(s, p)) ports.putAllyFromDiscard(s, p.id);
      break;
    }
    case "mts-pack:moxie-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "21017");
      need(
        p &&
          mtsPlayerPackFormResponseOptions(s, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Moxie requires a hero form-change response window.",
      );
      pay(s, p!, undefined, e.after || [], ports);
      break;
    }
    case "mts-pack:moxie":
      s.flags.mtsPackMoxie = Number(s.flags.mtsPackMoxie || 0) + 1;
      break;
    case "mts-pack:rumble": {
      const p = own(s, e.id, "21022");
      need(
        p && s.player.form === "hero" && ports.canReady(s, "hero"),
        "Ready to Rumble requires a hero that can ready after changing form.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(s, E("ready", { target: "hero" }), ...(e.after || []));
      break;
    }
    case "mts-pack:blade": {
      const p = own(s, e.id, "21019");
      if (!p) break;
      const discard = O(
        "discard",
        "Discard Blade",
        [E("discardPiece", { id: p.id, mandatory: true })],
        p.code,
      );
      if (ports.canPay(s, 1, "", p.code, ["physical"], true))
        ports.choose(
          s,
          "Blade",
          "Spend a physical resource from your hand or discard Blade.",
          [
            O(
              "pay",
              "Spend a physical resource from hand",
              [P("blade-pay", { id: p.id })],
              p.code,
            ),
            discard,
          ],
        );
      else ports.queue(s, ...discard.effects);
      break;
    }
    case "mts-pack:blade-pay": {
      const p = own(s, e.id, "21019");
      need(
        p && ports.canPay(s, 1, "", p.code, ["physical"], true),
        "Blade needs a physical resource from your hand.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Blade",
          cost: 1,
          targetCode: p!.code,
          requirements: ["physical"],
          handOnly: true,
          cancelable: false,
          after: [],
        }),
      );
      break;
    }
    case "mts-pack:marvel-boy": {
      const p = own(s, e.id, "21041");
      need(
        p &&
          mtsPlayerPackAllyBasicOptions(s, p, e.packet, e.after || [], ports)
            .length,
        "Marvel Boy's attack interrupt is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Marvel Boy",
          cost: 1,
          targetCode: p!.code,
          requirements: ["physical"],
          cancelable: false,
          after: [
            {
              ...e.packet,
              piercing: true,
              ranged: true,
              mtsMarvelBoyHandled: true,
            },
            ...(e.after || []),
          ],
        }),
      );
      break;
    }
    case "mts-pack:innovation": {
      const targets = allies(s).filter((p) => p.damage > 0);
      if (targets.length)
        ports.choose(
          s,
          "Innovation",
          "Choose an ally you control to heal 1 damage.",
          targets.map((p) =>
            O(
              p.id,
              cards.get(p.code)!.name,
              [E("heal", { target: p.id, amount: 1 })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "mts-pack:shield-pay": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "21061",
      );
      need(
        p &&
          mtsPlayerPackDamageOptions(
            s,
            e.packet,
            e.amount,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Shield Spell requires the full discard cost and a Mystic hero taking attack damage.",
      );
      pay(
        s,
        p!,
        [P("shield", { packet: e.packet, amount: e.amount })],
        e.after || [],
        ports,
      );
      break;
    }
    case "mts-pack:shield": {
      need(
        e.amount > 0 && s.player.deck.length >= e.amount,
        "Shield Spell must discard its full attack-damage cost.",
      );
      const discarded = discardFixed(s, e.amount, ports);
      need(
        discarded === e.amount,
        "Shield Spell must pay the complete discard cost.",
      );
      ports.claimDefense(s, e.packet);
      ports.preventAllAttackDamage(s, e.packet, e.amount);
      break;
    }
    case "mts-pack:entity-shuffle":
      ports.shuffleResolvingIntoEncounter(s, e.id);
      break;
    case "mts-pack:entity-remove":
      ports.removeResolvingOwnedToRemoved(s, e.id);
      break;
    default:
      throw Error("Unknown Mad Titan player-pool effect: " + e.type);
  }
  return true;
}
