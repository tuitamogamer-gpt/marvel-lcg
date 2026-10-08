import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const card = (p: Piece) => cards.get(p.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`nova-ironheart-pack:${type}`, {
    ...args,
    type: `nova-ironheart-pack:${type}`,
  });
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const responseKey = (token: string, source: string) =>
  `novaIronheartPackResponse:${token}:${source}`;
const modKey = (target: string, scope: "phase" | "round", stat: string) =>
  `novaIronheartPackMod:${scope}:${target}:${stat}`;
const modExpiry = (target: string, scope: "phase" | "round") =>
  `novaIronheartPackModExpiry:${scope}:${target}`;

export const NOVA_IRONHEART_PACK_CORE_ALIAS_PAIRS = [
  ["28011", "01052"],
  ["28015", "01055"],
  ["29021", "01072"],
  ["29026", "01092"],
] as const;
export const NOVA_IRONHEART_PACK_CORE_ALIASES =
  NOVA_IRONHEART_PACK_CORE_ALIAS_PAIRS.map(([code]) => code);
/** Original IDs retained; these two non-Core reprints use existing native hosts. */
export const NOVA_IRONHEART_PACK_INHERITED_ALIAS_PAIRS = [
  ["29019", "05032"],
  ["29022", "27046"],
] as const;
export const NOVA_IRONHEART_PACK_SCRIPT_CODES = [
  "28010",
  "28012",
  "28013",
  "28014",
  "28016",
  "28017",
  "28018",
  "28019",
  "28020",
  "28026",
  "28027",
  "29014",
  "29015",
  "29016",
  "29017",
  "29018",
  "29019",
  "29020",
  "29022",
  "29023",
  "29024",
  "29025",
  "29027",
  "29033",
  "29034",
  "29035",
] as const;
export const NOVA_IRONHEART_PACK_ORIGINAL_SOURCES = [
  "https://hallofheroeslcg.com/sam-alexander-nova/",
  "https://hallofheroeslcg.com/ironheart-riri-williams/",
] as const;
export const NOVA_IRONHEART_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface NovaIronheartPlayedReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
  traits: string[];
  paid: Resource[];
  fromHand: boolean;
}
export interface NovaIronheartPowerReceipt {
  token: string;
  playerId: string;
  sourceId: string;
  power: "attack" | "thwart";
  performed: boolean;
  hero: boolean;
}
export interface NovaIronheartDamageReceipt {
  target: string;
  damageDealt: number;
  excessDamage: number;
  defeated: boolean;
}
export interface NovaIronheartLeaveReceipt {
  token: string;
  pieceId: string;
  code: string;
  ownerId: string;
  /** Still-in-play actual player card about to go to discard. */
  playerCard: boolean;
  fromPlay: boolean;
  toDiscard: boolean;
}
export interface NovaIronheartPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  identityHasTrait(s: GameState, trait: string): boolean;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  friendlyTargets(s: GameState): AntManTarget[];
  /** Native legal targets: includes Stun/Confuse replacement legality. */
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  /** All enemies for Bombshell's mandatory printed division. */
  allEnemies(s: GameState): AntManTarget[];
  blankableTargets(s: GameState): AntManTarget[];
  shieldSupportTargets(s: GameState): AntManTarget[];
  canReady(s: GameState, target: string): boolean;
  heroStats(s: GameState): { attack: number; thwart: number; defense: number };
  canExhaustIdentity(s: GameState): boolean;
  exhaustIdentity(s: GameState): void;
  /** Actual resource cost for ordinary native PLAY response, requirements kept. */
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  handPlayableCards(s: GameState): Piece[];
  cardCost(s: GameState, p: Piece): number;
  playResponse(s: GameState, id: string, after: Effect[]): void;
  /** Actual SPEND arrow cost, not paying for a card (no Power multiplier). */
  payAbility(
    s: GameState,
    cost: number,
    requirements: Resource[],
    after: Effect[],
  ): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  thwartProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** Finish actual damage/defeat windows before passing damageReceipt to after.
   * Already inside one native attackProgram; do not start another attack. */
  attackDamage(
    s: GameState,
    source: string,
    target: string,
    amount: number,
    after: Effect[],
  ): void;
  /** Native owner-aware mill/reset. Resume with discardedIds in actual order
   * and deckExhausted, observing the old deck before an immediate reset. */
  discardTopPlayer(s: GameState, count: number, after: Effect[]): void;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Remove one actual Uses counter as a COST. The Uses rule discards only
   * after the ability effect resolves, so defer zero-counter cleanup. */
  spendUseCost(s: GameState, id: string, after: Effect[]): void;
  /** Native zero-counter Uses discard/leave windows after the printed effect. */
  finishUse(s: GameState, id: string, after: Effect[]): void;
  /** Remove actual resolving event as an additional cost, keeping PLAY receipt. */
  removeResolvingFromGame(s: GameState, id: string): void;
  /** Owner-aware leave replacement. Still runs leave windows/attachment cleanup.
   * The actual pending physical piece is shuffled, not cloned or replayed. */
  replaceLeaveWithShuffle(
    s: GameState,
    receipt: NovaIronheartLeaveReceipt,
    after: Effect[],
  ): void;
  leaveAvailable(s: GameState, receipt: NovaIronheartLeaveReceipt): boolean;
  revealHidden(s: GameState): void;
  maxHP(s: GameState, playerId: string): number;
}

export function novaIronheartPackRequirements(p: Piece): Resource[] {
  if (p.code === "28013") return ["physical"];
  if (["28017", "29020"].includes(p.code)) return ["mental", "mental"];
  if (p.code === "29017") return ["energy"];
  if (p.code === "29018") return ["mental"];
  return [];
}
export function novaIronheartPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: NovaIronheartPackPorts,
): string | null {
  if (
    ["28010", "29025", "29033", "29034", "29035"].includes(p.code) &&
    !ports.identityHasTrait(s, "Champion")
  )
    return "Your identity needs the Champion trait.";
  if (
    p.code === "28018" &&
    !ports.identityHasTrait(s, "Champion") &&
    !ports.identityHasTrait(s, "Genius")
  )
    return "Moon Girl requires a Champion or Genius identity.";
  if (
    ["28012", "28026"].includes(p.code) &&
    !ports.identityHasTrait(s, "Aerial")
  )
    return "Your identity needs the Aerial trait.";
  if (p.code === "29027" && !ports.identityHasTrait(s, "Genius"))
    return "Ingenuity requires the Genius trait.";
  if (
    ["28017", "29027"].includes(p.code) &&
    s.player.inPlay.some((q) => q.code === p.code)
  )
    return "Max 1 per player.";
  if (["29017", "29018"].includes(p.code) && !ports.canExhaustIdentity(s))
    return "Exhaust your hero as this event's additional cost.";
  return null;
}
/** This printed Interrupt alters every damage amount of the qualifying event.
 * Printed cost, rather than current cost, remains authoritative after discounts. */
export function novaIronheartPackAttackEventBonus(
  s: GameState,
  p: Piece,
  paid: Resource[],
  ports: Pick<NovaIronheartPackPorts, "isTextBlank">,
): number {
  return card(p)?.faction_code === "aggression" &&
    (card(p)?.traits || "").split(/\.\s*/).includes("Attack") &&
    paid.includes("mental") &&
    s.player.inPlay.some((q) => q.code === "28017" && !ports.isTextBlank(s, q))
    ? Number(card(p).cost || 0)
    : 0;
}
export function novaIronheartPackCardEntered(
  _s: GameState,
  p: Piece,
): Effect[] {
  if (p.code === "29020") p.counters = 3;
  if (p.code === "29023") p.counters = 0;
  return [];
}
export function novaIronheartPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  if (["29017", "29018"].includes(p.code))
    return [P("exhaust-hero-cost", { id: p.id, after })];
  if (p.code === "29025")
    return [P("champions-remove-cost", { id: p.id, after })];
  return null;
}
export function novaIronheartPackEvent(
  _s: GameState,
  p: Piece,
  _paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "28012":
      return [P("attack", { id: p.id, amount: 4 })];
    case "28013":
      return [P("attack", { id: p.id, amount: 4, excess: true })];
    case "28014":
      return [P("attack", { id: p.id, amount: 2, second: true })];
    case "28026":
      return [P("thwart", { id: p.id, amount: 3 })];
    case "29017":
      return [P("attack", { id: p.id, totalStats: true })];
    case "29018":
      return [P("thwart", { id: p.id, totalStats: true })];
    case "29019":
      return [P("morale")];
    case "29025":
      return [P("champions")];
    default:
      return null;
  }
}
function chooseTargets(
  s: GameState,
  title: string,
  list: AntManTarget[],
  effect: Effect,
  ports: NovaIronheartPackPorts,
) {
  if (!list.length) {
    ports.queue(s, ...(effect.after || []));
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    list.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
  );
}
function optional(
  s: GameState,
  title: string,
  effects: Effect[],
  after: Effect[],
  ports: NovaIronheartPackPorts,
) {
  ports.choose(s, title, "Optional printed response.", [
    O("yes", "Resolve", [...effects, ...after]),
    O("no", "Decline", after),
  ]);
}
function addModifier(
  s: GameState,
  target: string,
  scope: "phase" | "round",
  stats: string[],
  amount: number,
) {
  target = target === "hero" ? `hero:${s.activePlayerId}` : target;
  const expiry = scope === "phase" ? phaseKey(s) : String(s.round);
  if (s.flags[modExpiry(target, scope)] !== expiry)
    for (const stat of ["attack", "thwart", "defense"])
      delete s.flags[modKey(target, scope, stat)];
  s.flags[modExpiry(target, scope)] = expiry;
  for (const stat of stats)
    s.flags[modKey(target, scope, stat)] =
      Number(s.flags[modKey(target, scope, stat)] || 0) + amount;
}
export function novaIronheartPackCharacterModifiers(
  s: GameState,
  target: string,
  ports: Pick<NovaIronheartPackPorts, "hasTrait" | "isTextBlank">,
) {
  target = target === "hero" ? `hero:${s.activePlayerId}` : target;
  const out = {
    attack: 0,
    thwart: 0,
    defense: 0,
    health: 0,
    overkill: false,
    retaliate: 0,
    aerial: false,
  };
  for (const seat of s.players) {
    const v = seatView(s, seat);
    for (const scope of ["phase", "round"] as const) {
      if (
        v.flags[modExpiry(target, scope)] !==
        (scope === "phase" ? phaseKey(s) : String(s.round))
      )
        continue;
      for (const stat of ["attack", "thwart", "defense"] as const)
        out[stat] += Number(v.flags[modKey(target, scope, stat)] || 0);
    }
    const controlled =
      target === `hero:${seat.id}` ||
      (target === "hero" && seat.id === s.activePlayerId) ||
      v.player.inPlay.some((p) => p.id === target);
    if (
      controlled &&
      v.flags.novaIronheartPackCloudExpiry === phaseKey(s) &&
      ports.hasTrait(s, target, "Aerial")
    )
      out.thwart += Number(v.flags.novaIronheartPackCloud || 0);
  }
  const p = allInPlay(s).find((q) => q.id === target);
  if (p?.code === "29023" && !ports.isTextBlank(s, p)) {
    if (p.counters === 1) {
      out.attack += 3;
      out.overkill = true;
    }
    if (p.counters === 2) {
      out.thwart += 3;
      out.aerial = true;
    }
    if (p.counters === 3) {
      out.health += 5;
      out.retaliate = 1;
    }
  }
  return out;
}
export function novaIronheartPackCardLeftPlay(s: GameState, p: Piece) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    for (const key of Object.keys(flags))
      if (
        (key.startsWith("novaIronheartPackMod:") &&
          key.includes(`:${p.id}:`)) ||
        key === modExpiry(p.id, "phase") ||
        key === modExpiry(p.id, "round") ||
        key === `novaIronheartPackBlank:${p.id}`
      )
        delete flags[key];
  }
}
export function novaIronheartPackPhaseEnded(s: GameState) {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    for (const key of Object.keys(flags))
      if (
        key.startsWith("novaIronheartPackMod:phase:") ||
        key.startsWith("novaIronheartPackModExpiry:phase:") ||
        key.startsWith("novaIronheartPackCloud")
      )
        delete flags[key];
  }
}
export function novaIronheartPackRoundEnded(s: GameState) {
  novaIronheartPackPhaseEnded(s);
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    for (const key of Object.keys(flags))
      if (
        key.startsWith("novaIronheartPackMod:round:") ||
        key.startsWith("novaIronheartPackModExpiry:round:") ||
        key.startsWith("novaIronheartPackBlank:") ||
        key === "novaIronheartPackChampions"
      )
        delete flags[key];
  }
}
export function novaIronheartPackTextBlank(
  s: GameState,
  p: Pick<Piece, "id">,
): boolean {
  return s.players.some(
    (seat) =>
      seatView(s, seat).flags[`novaIronheartPackBlank:${p.id}`] === s.round,
  );
}
export function novaIronheartPackCannotTakeDamage(
  s: GameState,
  target: string,
  ports: Pick<NovaIronheartPackPorts, "hasTrait">,
): boolean {
  return (
    s.players.some(
      (seat) => seatView(s, seat).flags.novaIronheartPackChampions === s.round,
    ) && ports.hasTrait(s, target, "Champion")
  );
}
export function novaIronheartPackAttackDamageReduction(
  s: GameState,
  target: string,
  ports: Pick<NovaIronheartPackPorts, "identityHasTrait" | "isTextBlank">,
): number {
  if (target !== "hero" && target !== `hero:${s.activePlayerId}`) return 0;
  return ports.identityHasTrait(s, "Aerial")
    ? s.player.inPlay.filter(
        (p) => p.code === "28027" && !ports.isTextBlank(s, p),
      ).length
    : 0;
}
export function novaIronheartPackTurnBegan(
  s: GameState,
  playerId: string,
): Effect[] {
  return seatView(s, playerId)
    .player.inPlay.filter((p) => p.code === "28027")
    .map((p) => P("height-discard", { id: p.id, actorId: playerId }));
}
export function novaIronheartPackAllyEntered(
  s: GameState,
  p: Piece,
  ports: NovaIronheartPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (ports.isTextBlank(s, p)) return null;
  if (
    p.code === "28010" &&
    s.player.form === "hero" &&
    s.player.discard.some(
      (q) =>
        card(q)?.faction_code === "aggression" &&
        card(q)?.type_code === "event",
    )
  )
    return [P("locust-window", { id: p.id, after })];
  if (
    p.code === "29016" &&
    s.player.form === "hero" &&
    ports.friendlyTargets(s).some((t) => ports.hasTrait(s, t.id, "Champion"))
  )
    return [P("patriot-window", { id: p.id, after })];
  if (p.code === "29023") return [P("snowguard-window", { id: p.id, after })];
  if (
    p.code === "29024" &&
    s.player.form === "hero" &&
    ports.blankableTargets(s).length
  )
    return [P("vivian-window", { id: p.id, after })];
  return null;
}
export function novaIronheartPackCardPlayed(
  s: GameState,
  receipt: NovaIronheartPlayedReceipt,
  ports: NovaIronheartPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (receipt.playerId !== s.activePlayerId) return null;
  if (
    receipt.code === "28018" &&
    receipt.fromHand &&
    receipt.paid.includes("mental") &&
    own(s, receipt.pieceId, "28018") &&
    !ports.isTextBlank(s, own(s, receipt.pieceId, "28018")!)
  )
    return [P("moon-window", { receipt, after })];
  if (
    s.player.form === "hero" &&
    receipt.traits.includes("Attack") &&
    cards.get(receipt.code)?.type_code === "event" &&
    s.player.inPlay.some(
      (p) => p.code === "28016" && !p.exhausted && !ports.isTextBlank(s, p),
    ) &&
    !s.flags[responseKey(receipt.token, "fluid-max")]
  )
    return [P("fluid-window", { receipt, after })];
  return null;
}
export function novaIronheartPackPowerResponses(
  s: GameState,
  receipt: NovaIronheartPowerReceipt,
  ports: NovaIronheartPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (!receipt.performed || receipt.playerId !== s.activePlayerId) return null;
  const agent = own(s, receipt.sourceId, "29022");
  if (
    agent &&
    !ports.isTextBlank(s, agent) &&
    ports.shieldSupportTargets(s).length
  )
    return [P("agent-window", { receipt, after })];
  const p = own(s, receipt.sourceId, "29015");
  if (
    p &&
    s.player.form === "hero" &&
    !ports.isTextBlank(s, p) &&
    readyChampions(s, p.id, ports).length &&
    ports.canPay(s, 1, ["energy"])
  )
    return [P("falcon-window", { receipt, after })];
  if (
    receipt.hero &&
    s.player.form === "hero" &&
    ports.identityHasTrait(s, "Aerial")
  ) {
    const code = receipt.power === "attack" ? "28012" : "28026";
    if (responseSources(s, code, ports).length)
      return [P("aerial-window", { receipt, code, after })];
  }
  return null;
}
function responseSources(
  s: GameState,
  code: string,
  ports: NovaIronheartPackPorts,
) {
  return ports
    .handPlayableCards(s)
    .filter(
      (p) =>
        p.code === code &&
        ports.canPay(
          s,
          ports.cardCost(s, p),
          novaIronheartPackRequirements(p),
          p.id,
          p.code,
        ),
    );
}
function readyChampions(
  s: GameState,
  exclude: string,
  ports: NovaIronheartPackPorts,
) {
  return ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        t.id !== exclude &&
        (t.id === "hero" ||
          t.id === `hero:${s.activePlayerId}` ||
          s.player.inPlay.some((p) => p.id === t.id)) &&
        ports.hasTrait(s, t.id, "Champion") &&
        ports.canReady(s, t.id),
    );
}
function heroTargets(
  s: GameState,
  ports: NovaIronheartPackPorts,
): AntManTarget[] {
  return ports
    .friendlyTargets(s)
    .filter((t) =>
      t.id === "hero"
        ? s.player.form === "hero"
        : t.id.startsWith("hero:") &&
          seatView(s, t.id.slice(5)).player.form === "hero",
    );
}
export function novaIronheartPackResourcesSpent(
  s: GameState,
  pieces: Piece[],
  beneficiaryId: string,
  ports: Pick<NovaIronheartPackPorts, "identityHasTrait" | "maxHP">,
): Effect[] {
  const v = seatView(s, beneficiaryId);
  return ports.identityHasTrait(s, "Civilian") &&
    v.player.hp < ports.maxHP(s, beneficiaryId)
    ? pieces
        .filter((p) => p.code === "28019")
        .map((p) =>
          E("optional", {
            title: "Everyday Hero",
            image: p.code,
            text: "Heal 1 damage from the identity you paid for?",
            effects: [
              E("heal", {
                target: `hero:${beneficiaryId}`,
                amount: 1,
                source: p.id,
              }),
            ],
          }),
        )
    : [];
}
export function novaIronheartPackCanShareResource(
  s: GameState,
  p: Piece,
  ports: Pick<NovaIronheartPackPorts, "identityHasTrait">,
): boolean {
  return p.code === "28019" && ports.identityHasTrait(s, "Civilian");
}
export function novaIronheartPackResourceSources(
  s: GameState,
  ports: Pick<NovaIronheartPackPorts, "isTextBlank">,
) {
  return s.player.inPlay
    .filter(
      (p) => p.code === "29027" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Ingenuity",
      resources: ["mental"] as Resource[],
      description: "Exhaust Ingenuity · generate 1 mental",
      kind: "ability" as const,
    }));
}
export function novaIronheartPackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<NovaIronheartPackPorts, "isTextBlank">,
): boolean {
  const p = own(s, id, "29027");
  if (!p) return false;
  need(!p.exhausted && !ports.isTextBlank(s, p), "Ingenuity is unavailable.");
  p.exhausted = true;
  return true;
}
export function novaIronheartPackAbilityOptions(
  s: GameState,
  id: string,
  ports: NovaIronheartPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p) || s.player.form !== "hero")
    return [];
  if (
    p.code === "28020" &&
    playerOrder(s).some((seat) =>
      ports.identityHasTrait(seatView(s, seat), "Champion"),
    )
  )
    return [
      O(
        "bunker",
        "Exhaust · a Champion player may draw 2, then discard 2",
        [P("bunker", { id })],
        p.code,
      ),
    ];
  if (p.code === "29014")
    return [
      O(
        "cloud",
        "Exhaust · a player's Aerial characters get +1 THW this phase",
        [P("cloud", { id })],
        p.code,
      ),
    ];
  if (p.code === "29020" && p.counters > 0 && ports.friendlyTargets(s).length)
    return [
      O(
        "research",
        "Exhaust, remove 1 research counter · a friendly character gets +1 THW and ATK",
        [P("research", { id })],
        p.code,
      ),
    ];
  return [];
}
export function novaIronheartPackAbility(
  s: GameState,
  id: string,
  ability: string,
  ports: NovaIronheartPackPorts,
): Effect[] | null {
  const p = own(s, id);
  if (!p || !["28020", "29014", "29020"].includes(p.code)) return null;
  // An ally retains its ordinary basic powers beside its printed Action.
  if (p.code === "29014" && ["attack", "thwart"].includes(ability)) return null;
  need(
    novaIronheartPackAbilityOptions(s, id, ports).some((o) => o.id === ability),
    "This printed ability is unavailable.",
  );
  return [P(ability, { id })];
}
export function novaIronheartPackLeaveInterrupt(
  s: GameState,
  receipt: NovaIronheartLeaveReceipt,
  ports: NovaIronheartPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (
    s.player.form !== "hero" ||
    !receipt.playerCard ||
    !receipt.fromPlay ||
    !receipt.toDiscard ||
    !ports.leaveAvailable(s, receipt)
  )
    return null;
  const ids = s.player.inPlay
    .filter(
      (p) =>
        p.code === "29035" &&
        !p.exhausted &&
        !ports.isTextBlank(s, p) &&
        !s.flags[responseKey(receipt.token, p.id)],
    )
    .map((p) => p.id);
  return ids.length ? [P("pinpoint-window", { receipt, ids, after })] : null;
}
export function novaIronheartPackWaspIgnores(
  s: GameState,
  p: Piece,
  ports: Pick<NovaIronheartPackPorts, "isTextBlank">,
): boolean {
  return p.code === "29034" && !ports.isTextBlank(s, p);
}
/** Every enemy gets floor(total/count); the controller assigns the remainder.
 * The native host still performs one attack and one consequential payment. */
export function novaIronheartPackBombshellDivisions(
  total: number,
  enemies: string[],
): { id: string; allocations: { target: string; amount: number }[] }[] {
  if (!enemies.length) return [];
  const amount = Math.max(0, total),
    base = Math.floor(amount / enemies.length),
    remainder = amount % enemies.length;
  const out: {
    id: string;
    allocations: { target: string; amount: number }[];
  }[] = [];
  function choose(index: number, chosen: string[]) {
    if (chosen.length === remainder) {
      out.push({
        id: chosen.join(",") || "even",
        allocations: enemies.map((target) => ({
          target,
          amount: base + Number(chosen.includes(target)),
        })),
      });
      return;
    }
    for (let i = index; i <= enemies.length - (remainder - chosen.length); i++)
      choose(i + 1, [...chosen, enemies[i]]);
  }
  choose(0, []);
  return out;
}

export function resolveNovaIronheartPackEffect(
  s: GameState,
  e: Effect,
  ports: NovaIronheartPackPorts,
): boolean {
  if (!e.type.startsWith("nova-ironheart-pack:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "nova-ironheart-pack:exhaust-hero-cost":
      need(
        ports.canExhaustIdentity(s),
        "Exhaust your actual ready hero as the additional cost.",
      );
      ports.exhaustIdentity(s);
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:champions-remove-cost":
      ports.removeResolvingFromGame(s, e.id);
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:attack": {
      const amount = e.totalStats
        ? Object.values(ports.heroStats(s)).reduce((sum, n) => sum + n, 0)
        : e.amount;
      ports.attackProgram(
        s,
        [P("attack-target", { ...e, type: undefined, amount, after: [] })],
        after,
      );
      break;
    }
    case "nova-ironheart-pack:attack-target":
      chooseTargets(
        s,
        cards.get(locatedCode(s, e.id))?.name || "Attack event",
        ports.enemyTargets(s, true),
        P("attack-commit", { ...e, type: undefined }),
        ports,
      );
      break;
    case "nova-ironheart-pack:attack-commit":
      need(
        ports.enemyTargets(s, true).some((t) => t.id === e.target),
        "Choose an actual legal attack target.",
      );
      ports.attackDamage(s, e.id, e.target, e.amount, [
        P("attack-result", { ...e, type: undefined }),
      ]);
      break;
    case "nova-ironheart-pack:attack-result": {
      const receipt: NovaIronheartDamageReceipt = e.damageReceipt;
      if (e.excess && receipt?.excessDamage > 0)
        ports.queue(
          s,
          P("quarter-mill-step", {
            id: e.id,
            remaining: receipt.excessDamage,
            after,
          }),
        );
      else if (e.second && receipt?.defeated)
        ports.queue(
          s,
          P("attack-target", { id: e.id, amount: e.amount, after }),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:quarter-mill-step":
      ports.discardTopPlayer(s, 1, [
        P("quarter-recover-step", { id: e.id, remaining: e.remaining, after }),
      ]);
      break;
    case "nova-ironheart-pack:quarter-recover-step": {
      const ids = new Set<string>(e.discardedIds || []);
      for (let i = 0; i < s.player.discard.length;) {
        const p = s.player.discard[i];
        if (ids.has(p.id) && card(p)?.faction_code === "aggression")
          s.player.hand.push(s.player.discard.splice(i, 1)[0]);
        else i++;
      }
      if (!e.deckExhausted && e.remaining > 1)
        ports.queue(
          s,
          P("quarter-mill-step", {
            id: e.id,
            remaining: e.remaining - 1,
            after,
          }),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:thwart": {
      const amount = e.totalStats
        ? Object.values(ports.heroStats(s)).reduce((sum, n) => sum + n, 0)
        : e.amount;
      ports.thwartProgram(s, [P("thwart-target", { id: e.id, amount })], after);
      break;
    }
    case "nova-ironheart-pack:thwart-target":
      chooseTargets(
        s,
        "Thwart event",
        ports.schemeTargets(s, true),
        P("thwart-commit", { ...e, type: undefined }),
        ports,
      );
      break;
    case "nova-ironheart-pack:thwart-commit":
      need(
        ports.schemeTargets(s, true).some((t) => t.id === e.target),
        "Choose an actual legal thwart target.",
      );
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: e.amount, source: e.id }),
        ...after,
      );
      break;
    case "nova-ironheart-pack:locust-window":
      optional(s, "The Locust", [P("locust", { id: e.id })], after, ports);
      break;
    case "nova-ironheart-pack:locust": {
      const list = s.player.discard.filter(
        (p) =>
          card(p)?.type_code === "event" &&
          card(p)?.faction_code === "aggression",
      );
      chooseTargets(
        s,
        "The Locust · discarded Aggression event",
        list.map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        P("locust-take", { after }),
        ports,
      );
      break;
    }
    case "nova-ironheart-pack:locust-take": {
      const index = s.player.discard.findIndex(
        (p) =>
          p.id === e.target &&
          card(p)?.type_code === "event" &&
          card(p)?.faction_code === "aggression",
      );
      need(index >= 0, "Recover an actual discarded Aggression event.");
      s.player.hand.push(s.player.discard.splice(index, 1)[0]);
      ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:moon-window":
      optional(
        s,
        "Moon Girl",
        [
          E("draw", {
            amount: (e.receipt.paid as Resource[]).filter((r) => r === "mental")
              .length,
          }),
        ],
        after,
        ports,
      );
      break;
    case "nova-ironheart-pack:fluid-window": {
      const ids = s.player.inPlay.filter(
        (p) => p.code === "28016" && !p.exhausted && !ports.isTextBlank(s, p),
      );
      if (s.flags[responseKey(e.receipt.token, "fluid-max")]) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Fluid Motion",
        "Max 1 response across all copies for this actual Attack event.",
        [
          ...ids.map((p) =>
            O(
              p.id,
              "Exhaust · your hero gets +1 ATK this phase",
              [P("fluid", { id: p.id, receipt: e.receipt, after })],
              p.code,
            ),
          ),
          O("pass", "Pass", after),
        ],
      );
      break;
    }
    case "nova-ironheart-pack:fluid": {
      const p = own(s, e.id, "28016");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          !s.flags[responseKey(e.receipt.token, "fluid-max")],
        "Fluid Motion can respond once to this actual Attack event.",
      );
      p!.exhausted = true;
      s.flags[responseKey(e.receipt.token, "fluid-max")] = true;
      addModifier(s, `hero:${s.activePlayerId}`, "phase", ["attack"], 1);
      ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:aerial-window": {
      const sources = responseSources(s, e.code, ports).filter(
        (p) => !s.flags[responseKey(e.receipt.token, p.id)],
      );
      ports.choose(
        s,
        e.code === "28012" ? "Pitchback" : "Yaw and Roll",
        "Play a response to your hero's actual completed power?",
        [
          ...sources.map((p) =>
            O(
              p.id,
              `Play ${card(p).name}`,
              [
                P("aerial-play", {
                  id: p.id,
                  code: e.code,
                  receipt: e.receipt,
                  after,
                }),
              ],
              p.code,
            ),
          ),
          O("pass", "Pass", after),
        ],
      );
      break;
    }
    case "nova-ironheart-pack:aerial-play": {
      const p = responseSources(s, e.code, ports).find((p) => p.id === e.id);
      need(
        p &&
          !s.flags[responseKey(e.receipt.token, e.id)] &&
          ports.identityHasTrait(s, "Aerial"),
        "Use this actual hero-power response once.",
      );
      ports.playResponse(s, p!.id, [
        P("aerial-played", {
          id: p!.id,
          code: e.code,
          receipt: e.receipt,
          after,
        }),
      ]);
      break;
    }
    case "nova-ironheart-pack:aerial-played":
      s.flags[responseKey(e.receipt.token, e.id)] = true;
      ports.queue(
        s,
        P("aerial-window", { receipt: e.receipt, code: e.code, after }),
      );
      break;
    case "nova-ironheart-pack:agent-window":
      optional(
        s,
        "Agent 13 · ready a S.H.I.E.L.D. support",
        [P("agent-target", { receipt: e.receipt })],
        after,
        ports,
      );
      break;
    case "nova-ironheart-pack:agent-target":
      chooseTargets(
        s,
        "Agent 13 · S.H.I.E.L.D. support",
        ports.shieldSupportTargets(s),
        P("agent-ready", { receipt: e.receipt, after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:agent-ready":
      need(
        ports.shieldSupportTargets(s).some((t) => t.id === e.target),
        "Ready an actual S.H.I.E.L.D. support.",
      );
      ports.queue(s, E("ready", { target: e.target }), ...after);
      break;
    case "nova-ironheart-pack:falcon-window":
      optional(
        s,
        "Falcon · spend 1 energy",
        [P("falcon-pay", { receipt: e.receipt })],
        after,
        ports,
      );
      break;
    case "nova-ironheart-pack:falcon-pay":
      need(
        own(s, e.receipt.sourceId, "29015") &&
          readyChampions(s, e.receipt.sourceId, ports).length,
        "Falcon needs another readyable controlled Champion.",
      );
      ports.payAbility(
        s,
        1,
        ["energy"],
        [P("falcon-target", { receipt: e.receipt, after })],
      );
      break;
    case "nova-ironheart-pack:falcon-target":
      chooseTargets(
        s,
        "Falcon · ready another Champion",
        readyChampions(s, e.receipt.sourceId, ports),
        P("falcon-ready", { receipt: e.receipt, after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:falcon-ready":
      need(
        readyChampions(s, e.receipt.sourceId, ports).some(
          (t) => t.id === e.target,
        ),
        "Ready an actual different controlled Champion.",
      );
      ports.queue(s, E("ready", { target: e.target }), ...after);
      break;
    case "nova-ironheart-pack:patriot-window":
      optional(s, "Patriot", [P("patriot", { id: e.id })], after, ports);
      break;
    case "nova-ironheart-pack:patriot":
      chooseTargets(
        s,
        "Patriot · Champion character",
        ports
          .friendlyTargets(s)
          .filter((t) => ports.hasTrait(s, t.id, "Champion")),
        P("patriot-mod", { after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:patriot-mod":
      need(
        ports
          .friendlyTargets(s)
          .some(
            (t) => t.id === e.target && ports.hasTrait(s, t.id, "Champion"),
          ),
        "Choose an actual Champion character.",
      );
      addModifier(s, e.target, "round", ["attack", "thwart", "defense"], 1);
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:morale":
      chooseTargets(
        s,
        "Morale Boost · hero",
        heroTargets(s, ports),
        P("morale-mod", { after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:morale-mod":
      need(
        heroTargets(s, ports).some((t) => t.id === e.target),
        "Choose an actual hero in hero form.",
      );
      addModifier(s, e.target, "round", ["attack", "thwart", "defense"], 1);
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:snowguard-window":
      ports.choose(
        s,
        "Snowguard",
        "Place up to 3 shift counters as this entry response.",
        [0, 1, 2, 3].map((amount) =>
          O(
            String(amount),
            `${amount} shift counters`,
            [P("snowguard-shift", { id: e.id, amount, after })],
            "29023",
          ),
        ),
      );
      break;
    case "nova-ironheart-pack:snowguard-shift": {
      const p = own(s, e.id, "29023");
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          Number.isInteger(e.amount) &&
          e.amount >= 0 &&
          e.amount <= 3,
        "Place 0–3 counters on the actual entering Snowguard.",
      );
      p!.counters += e.amount;
      ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:vivian-window":
      optional(s, "Vivian", [P("vivian", { id: e.id })], after, ports);
      break;
    case "nova-ironheart-pack:vivian":
      chooseTargets(
        s,
        "Vivian · blank printed text",
        ports.blankableTargets(s),
        P("vivian-blank", { after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:vivian-blank":
      need(
        ports.blankableTargets(s).some((t) => t.id === e.target),
        "Choose an attachment, non-Elite minion or non-permanent side scheme.",
      );
      s.flags[`novaIronheartPackBlank:${e.target}`] = s.round;
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:champions":
      s.flags.novaIronheartPackChampions = s.round;
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:height-discard": {
      const p = own(s, e.id, "28027");
      if (p && !ports.isTextBlank(s, p)) ports.discardPiece(s, p.id);
      ports.queue(s, ...after);
      break;
    }
    case "nova-ironheart-pack:bunker": {
      const p = own(s, e.id, "28020");
      need(
        p && novaIronheartPackAbilityOptions(s, p.id, ports).length,
        "Champions Mobile Bunker is unavailable.",
      );
      p!.exhausted = true;
      ports.choose(
        s,
        "Champions Mobile Bunker",
        "Choose a Champion identity.",
        playerOrder(s)
          .filter((seat) =>
            ports.identityHasTrait(seatView(s, seat), "Champion"),
          )
          .map((seat) =>
            O(seat.id, seat.id, [
              P("bunker-offer", { actorId: seat.id, after }),
            ]),
          ),
      );
      break;
    }
    case "nova-ironheart-pack:bunker-offer":
      optional(
        s,
        "Champions Mobile Bunker",
        [E("draw", { amount: 2 }), P("bunker-discard", { remaining: 2 })],
        after,
        ports,
      );
      break;
    case "nova-ironheart-pack:bunker-discard": {
      const remaining = Math.min(e.remaining, s.player.hand.length);
      if (!remaining) {
        ports.queue(s, ...after);
        break;
      }
      chooseTargets(
        s,
        "Champions Mobile Bunker · discard",
        s.player.hand.map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
        P("bunker-discard-one", { remaining, after }),
        ports,
      );
      break;
    }
    case "nova-ironheart-pack:bunker-discard-one":
      need(
        s.player.hand.some((p) => p.id === e.target),
        "Discard an actual card from that player's hand.",
      );
      ports.discardHand(s, e.target);
      ports.queue(
        s,
        P("bunker-discard", { remaining: e.remaining - 1, after }),
      );
      break;
    case "nova-ironheart-pack:cloud": {
      const p = own(s, e.id, "29014");
      need(
        p && novaIronheartPackAbilityOptions(s, p.id, ports).length,
        "Cloud 9 is unavailable.",
      );
      p!.exhausted = true;
      ports.choose(
        s,
        "Cloud 9",
        "Choose a player.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.id, [P("cloud-mod", { actorId: seat.id, after })]),
        ),
      );
      break;
    }
    case "nova-ironheart-pack:cloud-mod":
      if (s.flags.novaIronheartPackCloudExpiry !== phaseKey(s))
        s.flags.novaIronheartPackCloud = 0;
      s.flags.novaIronheartPackCloudExpiry = phaseKey(s);
      s.flags.novaIronheartPackCloud =
        Number(s.flags.novaIronheartPackCloud || 0) + 1;
      ports.queue(s, ...after);
      break;
    case "nova-ironheart-pack:research": {
      const p = own(s, e.id, "29020");
      need(
        p && novaIronheartPackAbilityOptions(s, p.id, ports).length,
        "R&D Facility is unavailable.",
      );
      p!.exhausted = true;
      ports.spendUseCost(s, p!.id, [
        P("research-target", { id: p!.id, after }),
      ]);
      break;
    }
    case "nova-ironheart-pack:research-target":
      chooseTargets(
        s,
        "R&D Facility · friendly character",
        ports.friendlyTargets(s),
        P("research-mod", { id: e.id, after }),
        ports,
      );
      break;
    case "nova-ironheart-pack:research-mod":
      need(
        ports.friendlyTargets(s).some((t) => t.id === e.target),
        "Choose an actual friendly character.",
      );
      addModifier(
        s,
        e.target === "hero" ? `hero:${s.activePlayerId}` : e.target,
        "phase",
        ["attack", "thwart"],
        1,
      );
      ports.finishUse(s, e.id, after);
      break;
    case "nova-ironheart-pack:pinpoint-window": {
      if (!ports.leaveAvailable(s, e.receipt)) {
        ports.queue(s, ...after);
        break;
      }
      const ids: string[] = e.ids || [];
      const valid = ids
        .map((id) => own(s, id, "29035"))
        .filter(
          (p): p is Piece =>
            !!p &&
            !p.exhausted &&
            !ports.isTextBlank(s, p) &&
            !s.flags[responseKey(e.receipt.token, p.id)],
        );
      ports.choose(
        s,
        "Pinpoint",
        "Shuffle the actual leaving player card into its owner's deck instead?",
        [
          ...valid.map((p) =>
            O(
              p.id,
              "Exhaust Pinpoint · shuffle into owner's deck",
              [P("pinpoint", { id: p.id, receipt: e.receipt, after })],
              p.code,
            ),
          ),
          O("pass", "Pass", after),
        ],
      );
      break;
    }
    case "nova-ironheart-pack:pinpoint": {
      const p = own(s, e.id, "29035");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          ports.leaveAvailable(s, e.receipt) &&
          !s.flags[responseKey(e.receipt.token, p.id)],
        "Pinpoint needs this actual pending leave-to-discard window.",
      );
      p!.exhausted = true;
      s.flags[responseKey(e.receipt.token, p!.id)] = true;
      ports.replaceLeaveWithShuffle(s, e.receipt, after);
      break;
    }
    default:
      return false;
  }
  return true;
}
function locatedCode(s: GameState, id: string): string {
  return (
    [
      ...s.resolving,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ].find((p) => p.id === id)?.code || ""
  );
}
