import raw from "../data/catalog-cards.json" with { type: "json" };
import { consumeStatus } from "./keywords.js";
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

const cards = new Map((raw as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`sinister-player:${type}`, { ...args, type: `sinister-player:${type}` });
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (yes: unknown, text: string) => {
  if (!yes) throw Error(text);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const d = (p: Piece) => cards.get(p.code)!;
const named = (p: Piece, name: string) => d(p)?.name === name;
const eventReceiptKey = (token: string, id: string) =>
  `sinisterPlayerResponse:${token}:${id}`;
const playableHand = (s: GameState, ports: SinisterPlayerPackPorts) =>
  ports.handPlayableCards ? ports.handPlayableCards(s) : s.player.hand;
const located = (s: GameState, id: string) =>
  [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    }),
  ].find((p) => p.id === id);

export const SINISTER_PLAYER_PACK_SCRIPT_CODES = [
  "27010",
  "27011",
  "27012",
  "27013",
  "27014",
  "27015",
  "27016",
  "27017",
  "27018",
  "27019",
  "27023",
  "27024",
  "27040",
  "27041",
  "27042",
  "27043",
  "27044",
  "27046",
  "27047",
  "27048",
  "27049",
  "27050",
  "27054",
  "27055",
  "27190",
  "27191",
] as const;
export const SINISTER_PLAYER_PACK_CORE_ALIASES = [
  "27020",
  "27021",
  "27022",
  "27045",
  "27051",
  "27052",
  "27053",
] as const;
export const SINISTER_PLAYER_PACK_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/sinister-motives/";
export const SINISTER_PLAYER_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface SinisterPlayerPowerReceipt {
  token: string;
  playerId: string;
  allyId: string;
  power: "attack" | "thwart";
  performed: boolean;
  basic: boolean;
}
export interface SinisterPlayerDamageReceipt {
  token: string;
  playerId: string;
  target: string;
  amount: number;
  attack?: boolean;
}
export interface SinisterPlayerConsequentialReceipt {
  token: string;
  allyId: string;
  amount: number;
}
export interface SinisterPlayerRevealReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
}
export interface SinisterPlayerPlayedReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
  traits: string[];
  fromHand: boolean;
}
export interface SinisterPlayerLeaveReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
  traits: string[];
}
export interface SinisterPlayerDeckReceipt {
  token: string;
  playerId?: string;
  encounter: boolean;
  ids: string[];
}

export interface SinisterPlayerPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  traits(s: GameState, p: Piece): string[];
  identityHasTrait(s: GameState, trait: string): boolean;
  /** Printed alter-ego identity name, independent of current face. */
  identityName(s: GameState): string;
  identityMaxHP(s: GameState): number;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canReadyPiece(s: GameState, p: Piece): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused",
  ): boolean;
  controlledTraitCards(
    s: GameState,
    trait: string,
    readyOnly: boolean,
  ): AntManTarget[];
  /** Actual identities/owned allies, including other players; no temporary Piece. */
  characterTargets(
    s: GameState,
    trait: string,
    excludeId?: string,
  ): AntManTarget[];
  /** Atomically validate distinct actual controlled cards/identity references. */
  exhaustCards(s: GameState, ids: string[]): void;
  cardCost(s: GameState, p: Piece): number;
  /** Actual ordinary hand plus event cards with permission to PLAY as if in
   * hand (George storage). Such permission never makes them discard costs or
   * resources. All sources retain their physical ID and original owner. */
  handPlayableCards?(s: GameState): Piece[];
  /** Ordinary PLAY legality after the discount and any named exhaustion cost. */
  canPlayWithDiscount?(
    s: GameState,
    p: Piece,
    discount: number,
    exhaustId?: string,
  ): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** An actual forced villain attack, complete before printed later effects. */
  attackVillain(s: GameState, playerId: string, after: Effect[]): void;
  discardHand(s: GameState, id: string): void;
  discardControlled(s: GameState, id: string): void;
  /** Random discard is a printed COST: actual shared seed/hidden-information
   * updates and owner-aware physical movement; return before benefit. */
  discardRandomHand(s: GameState, after: Effect[]): void;
  revealHidden(s: GameState): void;
  shuffleEncounter(s: GameState, after: Effect[]): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  /** Native encounter exhaustion/cycles; resume with actual discardedIds. */
  discardTopEncounter(s: GameState, count: number, after: Effect[]): void;
  /** Discard until first actual treachery, respecting bounded native encounter
   * resets. Resume with treacheryId (or absent if none can be found). */
  discardUntilTreachery(s: GameState, after: Effect[]): void;
  /** Reveal the same discarded treachery as printed additional COST, including
   * all reveal/Surge/Peril windows before after. No hidden clone. */
  revealDiscardedCost(s: GameState, id: string, after: Effect[]): void;
  /** Count actual IDs through native count interrupts; stars count only when
   * includeStar is true. Resume each after with boostTotal. */
  countEncounterIcons(
    s: GameState,
    ids: string[],
    includeStar: boolean,
    after: Effect[],
  ): void;
  /** Exact native healing additional cost, before the ready benefit. */
  healIdentityCost(s: GameState, amount: number, after: Effect[]): void;
  /** Damage dealt cost remains paid if Tough/prevention prevents taking it;
   * actual ally defeat/leave interrupts run before the retained benefit. */
  damageAllyCost(
    s: GameState,
    id: string,
    amount: number,
    after: Effect[],
  ): void;
  canPutCard(s: GameState, p: Piece): boolean;
  /** PUT the actual own deck/hand/discard piece, native uniqueness/entry/Uses. */
  putCard(s: GameState, id: string, after: Effect[]): void;
  /** Actual paid PLAY from HAND, with source discount kept on cancellation. */
  playFromHand(
    s: GameState,
    id: string,
    discount: number,
    after: Effect[],
  ): void;
  /** Optional ordinary native ability-cost payment by the named actual player;
   * this does not PLAY another card, so payment-for-card resource multipliers
   * do not apply. afterSuccess and afterDecline are serializable records. */
  payRepeat(
    s: GameState,
    playerId: string,
    cost: number,
    afterSuccess: Effect[],
    afterDecline: Effect[],
  ): void;
  /** Bind a bonus only to the specified ongoing actual ally basic-use token. */
  addBasicPowerBonus(
    s: GameState,
    receipt: SinisterPlayerPowerReceipt,
    amount: number,
  ): void;
  /** Actual pending damage/defense port; if attack-associated, native paid
   * defense PLAY sets the actual identity defender before prevention. */
  damageAvailable(s: GameState, receipt: SinisterPlayerDamageReceipt): boolean;
  preventDamage(
    s: GameState,
    receipt: SinisterPlayerDamageReceipt,
    amount: number,
    after: Effect[],
  ): void;
  playJumpFlip(
    s: GameState,
    id: string,
    receipt: SinisterPlayerDamageReceipt,
    after: Effect[],
  ): void;
  consequentialAvailable(
    s: GameState,
    receipt: SinisterPlayerConsequentialReceipt,
  ): boolean;
  preventConsequential(
    s: GameState,
    receipt: SinisterPlayerConsequentialReceipt,
    amount: number,
    after: Effect[],
  ): void;
  /** Look at actual top IDs without removing/recreating them. Resume with
   * deckReceipt; native owner/reset constraints are retained on commit. */
  lookDeck(
    s: GameState,
    playerId: string | undefined,
    encounter: boolean,
    count: number,
    after: Effect[],
  ): void;
  /** Atomic actual-ID discard/top/bottom commit, including native reset windows
   * and correct top/bottom order. No automatic reset merely for looking. */
  arrangeDeck(
    s: GameState,
    receipt: SinisterPlayerDeckReceipt,
    discard: string[],
    top: string[],
    bottom: string[],
    after: Effect[],
  ): void;
}

export function sinisterPlayerPackRequirements(p: Piece): Resource[] {
  return p.code === "27016"
    ? ["physical"]
    : p.code === "27049"
      ? ["energy", "mental", "physical"]
      : [];
}
export function sinisterPlayerPackCostReduction(
  s: GameState,
  p: Piece,
  ports: SinisterPlayerPackPorts,
): number {
  if (p.code === "27023" && ports.identityHasTrait(s, "Web-Warrior"))
    return d(p).cost || 0;
  if (p.code === "27041")
    return (
      s.minions.filter((p) => p.confused).length + (s.villain.confused ? 1 : 0)
    );
  return 0;
}
export function sinisterPlayerPackIdentityModifiers(
  s: GameState,
  ports: Pick<SinisterPlayerPackPorts, "isTextBlank">,
) {
  const n = s.player.inPlay.filter(
    (p) => p.code === "27191" && !ports.isTextBlank(s, p),
  ).length;
  return {
    attack: n,
    thwart: n,
    defense: n,
    recover: n,
    handSize: n,
    health: n * 10,
  };
}
/** Hazard is the printed icon, outside ability text. The common hazard step
 * deals additional cards in player order, not specifically to this controller. */
export function sinisterPlayerPackHazards(s: GameState): number {
  return allInPlay(s).filter((p) => ["27190", "27191"].includes(p.code)).length;
}
export function sinisterPlayerPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SinisterPlayerPackPorts,
): string | null {
  if (
    p.code === "27015" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).some((t) => t.id === s.villain.id)
  )
    return "Return the Favor needs a legal villain attack target.";
  if (
    p.code === "27024" &&
    playerOrder(s).every((seat) =>
      seatView(s, seat).player.inPlay.some((a) => a.code === "27024"),
    )
  )
    return "Every player already controls Plan B (max 1 per player).";
  if (
    ["27017", "27048"].includes(p.code) &&
    !ports.controlledTraitCards(s, "Web-Warrior", false).length
  )
    return "Control a Web-Warrior card to play this ally.";
  if (
    p.code === "27016" &&
    (ports.identityMaxHP(s) - s.player.hp < 2 ||
      !s.player.exhausted ||
      !ports.canReadyIdentity(s, s.activePlayerId))
  )
    return "What Doesn't Kill Me requires healing exactly 2 damage as its cost and an identity that can ready.";
  if (
    p.code === "27018" &&
    (!ports.controlledTraitCards(s, "Web-Warrior", true).length ||
      !s.player.discard.some(
        (p) =>
          d(p)?.type_code === "ally" &&
          ports.traits(s, p).includes("Web-Warrior") &&
          ports.canPutCard(s, p),
      ))
  )
    return "Across the Spider-Verse needs a ready controlled Web-Warrior and an actual playable discard ally.";
  if (
    ["27042", "27043"].includes(p.code) &&
    !ports.controlledTraitCards(s, "S.H.I.E.L.D.", true).length
  )
    return "Exhaust a ready controlled S.H.I.E.L.D. card.";
  if (p.code === "27042" && !ports.schemeTargets(s, false).length)
    return "Homeland Intervention needs a scheme with threat to remove.";
  if (["27019", "27050"].includes(p.code)) {
    if (s.player.form !== "alter") return "Young Love requires alter-ego form.";
    if (!["Gwen Stacy", "Miles Morales"].includes(ports.identityName(s)))
      return "Young Love requires your chosen identity to be Gwen Stacy or Miles Morales.";
    const allies = allInPlay(s).filter((p) => d(p)?.type_code === "ally");
    const names = new Set([
      ...playerOrder(s).map((seat) => ports.identityName(seatView(s, seat))),
      ...allies.map((p) => d(p)?.subname),
    ]);
    if (!names.has("Gwen Stacy") || !names.has("Miles Morales"))
      return "Young Love needs both named friendly characters and a matching chosen identity.";
    const injuredIdentity = playerOrder(s).some((seat) => {
      const v = seatView(s, seat);
      return (
        ["Gwen Stacy", "Miles Morales"].includes(ports.identityName(v)) &&
        v.player.hp < ports.identityMaxHP(v)
      );
    });
    if (
      !injuredIdentity &&
      !allies.some(
        (a) =>
          ["Gwen Stacy", "Miles Morales"].includes(d(a)?.subname || "") &&
          a.damage > 0,
      )
    )
      return "Young Love needs at least one named character with damage to heal.";
  }
  return null;
}
export function sinisterPlayerPackCardEntered(
  _s: GameState,
  p: Piece,
): Effect[] {
  if (p.code === "27044") p.counters = 3;
  if (p.code === "27024")
    return [P("plan-controller", { id: p.id, actorId: _s.activePlayerId })];
  return [];
}
export function sinisterPlayerPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "27015"
    ? [P("favor-cost", { id: p.id, after })]
    : p.code === "27016"
      ? [P("heal-cost", { id: p.id, after })]
      : null;
}
export function sinisterPlayerPackEvent(
  _s: GameState,
  p: Piece,
  paid: Resource[] = [],
  damage?: SinisterPlayerDamageReceipt,
): Effect[] | null {
  switch (p.code) {
    case "27013":
      return [P("bait", { id: p.id })];
    case "27014":
      return damage
        ? [
            P("jump", {
              id: p.id,
              receipt: damage,
              energy: paid.includes("energy"),
            }),
          ]
        : [];
    case "27015":
      return [P("favor", { id: p.id })];
    case "27016":
      return [P("ready-healed", { id: p.id })];
    case "27018":
      return [P("spider-verse", { id: p.id })];
    case "27019":
    case "27050":
      return [P("young-love")];
    case "27042":
      return [P("homeland", { id: p.id })];
    case "27043":
      return [P("logistics", { id: p.id })];
    default:
      return null;
  }
}
function response(
  s: GameState,
  title: string,
  effects: Effect[],
  after: Effect[],
  ports: SinisterPlayerPackPorts,
) {
  ports.choose(s, title, "Optional printed response.", [
    O("yes", "Resolve", [...effects, ...after]),
    O("no", "Decline", after),
  ]);
}
function targets(
  s: GameState,
  title: string,
  list: AntManTarget[],
  effect: Effect,
  ports: SinisterPlayerPackPorts,
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

export function sinisterPlayerPackAllyEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (ports.isTextBlank(s, p)) return null;
  if (
    p.code === "27010" &&
    fromHand &&
    ports
      .controlledTraitCards(s, "Web-Warrior", false)
      .some((t) => t.id !== p.id)
  )
    return [P("silk-window", { id: p.id, after })];
  if (
    p.code === "27011" &&
    fromHand &&
    ports.controlledTraitCards(s, "Web-Warrior", false).length >= 3
  )
    return [P("miles-window", { id: p.id, after })];
  if (p.code === "27040") return [P("monica-window", { id: p.id, after })];
  return null;
}
export function sinisterPlayerPackBasicPowerInterrupt(
  s: GameState,
  receipt: SinisterPlayerPowerReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  const p = own(s, receipt.allyId, "27047");
  return p && receipt.basic && !ports.isTextBlank(s, p)
    ? [P("dugan-window", { receipt, after })]
    : null;
}
export function sinisterPlayerPackAllyPowerResponses(
  s: GameState,
  receipt: SinisterPlayerPowerReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  const p = own(s, receipt.allyId);
  if (!p || !receipt.performed || ports.isTextBlank(s, p)) return null;
  if (p.code === "27046") return [P("agent-window", { id: p.id, after })];
  if (p.code === "27049") return [P("parker-window", { id: p.id, after })];
  return null;
}
export function sinisterPlayerPackAllyDefenseInterrupt(
  s: GameState,
  allyId: string,
  attackerId: string,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  const p = own(s, allyId, "27012");
  return p &&
    !ports.isTextBlank(s, p) &&
    ports.enemyTargets(s, false).some((t) => t.id === attackerId)
    ? [P("uk-window", { id: allyId, attackerId, after })]
    : null;
}
export function sinisterPlayerPackAllyLeaveInterrupt(
  s: GameState,
  receipt: SinisterPlayerLeaveReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  const p = own(s, receipt.pieceId);
  if (!p || ports.isTextBlank(s, p)) return null;
  return p.code === "27017"
    ? [P("hobie-window", { id: p.id, after })]
    : p.code === "27048"
      ? [P("gwen-window", { id: p.id, after })]
      : null;
}
export function sinisterPlayerPackAllyLeftPlay(
  s: GameState,
  receipt: SinisterPlayerLeaveReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (!receipt.traits.includes("Web-Warrior")) return null;
  const ids = s.player.inPlay
    .filter((p) => p.code === "27023" && !ports.isTextBlank(s, p))
    .map((p) => p.id);
  return ids.length
    ? [P("web-life-window", { receipt, ids, used: [], after })]
    : null;
}
export function sinisterPlayerPackCardPlayed(
  s: GameState,
  receipt: SinisterPlayerPlayedReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (
    receipt.playerId !== s.activePlayerId ||
    !receipt.traits.includes("S.H.I.E.L.D.")
  )
    return null;
  const ids = s.player.inPlay
    .filter((p) => p.code === "27055" && !ports.isTextBlank(s, p))
    .map((p) => p.id);
  return ids.length ? [P("sky-window", { receipt, ids, after })] : null;
}
export function sinisterPlayerPackEncounterRevealed(
  s: GameState,
  receipt: SinisterPlayerRevealReceipt,
  ports: SinisterPlayerPackPorts,
  after: Effect[] = [],
): Effect[] | null {
  if (receipt.playerId !== s.activePlayerId) return null;
  const ids = s.player.inPlay
    .filter((p) => p.code === "27190" && !ports.isTextBlank(s, p))
    .map((p) => p.id);
  return ids.length ? [P("venom-window", { receipt, ids, after })] : null;
}
export function sinisterPlayerPackJumpFlipOptions(
  s: GameState,
  receipt: SinisterPlayerDamageReceipt,
  after: Effect[],
  ports: SinisterPlayerPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    receipt.playerId !== s.activePlayerId ||
    receipt.target !== `hero:${s.activePlayerId}` ||
    receipt.amount <= 0 ||
    !ports.damageAvailable(s, receipt)
  )
    return [];
  return playableHand(s, ports)
    .filter(
      (p) =>
        p.code === "27014" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Jump Flip · prevent 2 damage",
        [P("play-jump", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
export function sinisterPlayerPackConsequentialOptions(
  s: GameState,
  receipt: SinisterPlayerConsequentialReceipt,
  after: Effect[],
  ports: SinisterPlayerPackPorts,
): Option[] {
  const ally = allInPlay(s).find((p) => p.id === receipt.allyId);
  if (
    s.player.form !== "hero" ||
    receipt.amount <= 0 ||
    !ally ||
    !ports.traits(s, ally).includes("S.H.I.E.L.D.") ||
    !ports.consequentialAvailable(s, receipt)
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "27044" &&
        !p.exhausted &&
        p.counters > 0 &&
        !ports.isTextBlank(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Field Agent · prevent 1 consequential damage",
        [P("field-agent", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
function governmentPlayable(
  s: GameState,
  p: Piece,
  ports: SinisterPlayerPackPorts,
  exhaustId?: string,
): boolean {
  return (
    ports.traits(s, p).includes("S.H.I.E.L.D.") &&
    ports.canPay(
      s,
      Math.max(0, ports.cardCost(s, p) - 1),
      sinisterPlayerPackRequirements(p),
      p.id,
      p.code,
    ) &&
    (!ports.canPlayWithDiscount ||
      ports.canPlayWithDiscount(s, p, 1, exhaustId))
  );
}
export function sinisterPlayerPackAbilityOptions(
  s: GameState,
  id: string,
  ports: SinisterPlayerPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "27024" &&
    s.player.form === "hero" &&
    s.player.hand.length &&
    ports.enemyTargets(s, false).length
  )
    return [
      O(
        "plan-b",
        "Exhaust Plan B · discard a random hand card",
        [P("plan-b", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "27054" &&
    s.player.form === "hero" &&
    playableHand(s, ports).some((card) =>
      governmentPlayable(s, card, ports, p.id),
    )
  )
    return [
      O(
        "government-liaison",
        "Exhaust Government Liaison · play a S.H.I.E.L.D. card for 1 less",
        [P("government", { id })],
        p.code,
      ),
    ];
  return [];
}
export function sinisterPlayerPackAbility(
  s: GameState,
  id: string,
  ports: SinisterPlayerPackPorts,
  action?: string,
): boolean {
  const options = sinisterPlayerPackAbilityOptions(s, id, ports);
  if (!options.length) return false;
  const o = action ? options.find((o) => o.id === action) : options[0];
  need(o, "This Sinister player-card action is unavailable.");
  ports.queue(s, ...o!.effects);
  return true;
}

function eligibleShield(
  s: GameState,
  ports: SinisterPlayerPackPorts,
  ids: string[] = [],
) {
  return ports
    .controlledTraitCards(s, "S.H.I.E.L.D.", true)
    .filter((t) => !ids.includes(t.id));
}
function wwDiscard(s: GameState, ports: SinisterPlayerPackPorts) {
  return s.player.discard.filter(
    (p) =>
      d(p)?.type_code === "ally" &&
      ports.traits(s, p).includes("Web-Warrior") &&
      ports.canPutCard(s, p),
  );
}
function surveillance(s: GameState) {
  return s.player.inPlay.filter((p) => named(p, "Surveillance Team"));
}
function powerOptions(
  s: GameState,
  trait: string,
  ports: SinisterPlayerPackPorts,
) {
  return allInPlay(s)
    .filter(
      (p) =>
        d(p)?.type_code === "support" &&
        p.exhausted &&
        ports.traits(s, p).includes(trait) &&
        ports.canReadyPiece(s, p),
    )
    .map((p) => ({ id: p.id, label: d(p).name, code: p.code }));
}
export function resolveSinisterPlayerPackEffect(
  s: GameState,
  e: Effect,
  ports: SinisterPlayerPackPorts,
): boolean {
  if (!e.type.startsWith("sinister-player:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "sinister-player:plan-controller": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "27024");
      need(p, "Plan B must be its actual entered source.");
      const seats = playerOrder(s).filter(
        (seat) =>
          !seatView(s, seat).player.inPlay.some(
            (a) => a.code === "27024" && a.id !== p!.id,
          ),
      );
      need(seats.length, "Plan B max 1 per player leaves no legal controller.");
      ports.choose(
        s,
        "Plan B · controller",
        "Play under any eligible player's control.",
        seats.map((seat) =>
          O(seat.id, ports.identityName(seatView(s, seat)), [
            P("plan-transfer", { id: p!.id, playerId: seat.id, after }),
          ]),
        ),
      );
      break;
    }
    case "sinister-player:plan-transfer": {
      const source = s.players.find((seat) =>
        seatView(s, seat).player.inPlay.some(
          (p) => p.id === e.id && p.code === "27024",
        ),
      );
      const destination = seatView(s, e.playerId);
      need(
        source &&
          !destination.player.inPlay.some(
            (p) => p.code === "27024" && p.id !== e.id,
          ),
        "Plan B needs its actual source and an eligible controller.",
      );
      const zone = seatView(s, source!).player.inPlay,
        i = zone.findIndex((p) => p.id === e.id);
      destination.player.inPlay.push(zone.splice(i, 1)[0]);
      ports.queue(s, ...after);
      break;
    }
    case "sinister-player:bait":
      if (consumeStatus(s.player, "confused")) {
        ports.queue(s, ...after);
        break;
      }
      ports.attackVillain(s, s.activePlayerId, [
        P("bait-thwart", { id: e.id, after }),
      ]);
      break;
    case "sinister-player:bait-thwart":
      ports.queue(
        s,
        E("thwart", {
          target: "main",
          amount: 4,
          source: "hero",
          action: true,
          basic: false,
          thwartInitiated: true,
          abilitySource: e.id,
        }),
        ...after,
      );
      break;
    case "sinister-player:favor-cost":
      delete s.flags[`sinisterFavorPaid:${e.id}`];
      ports.discardUntilTreachery(s, [P("favor-reveal", { id: e.id, after })]);
      break;
    case "sinister-player:favor-reveal":
      need(
        e.treacheryId,
        "Return the Favor cannot pay its reveal cost without an actual treachery.",
      );
      ports.revealDiscardedCost(s, e.treacheryId, [
        P("favor-paid", { id: e.id, after }),
      ]);
      break;
    case "sinister-player:favor-paid":
      s.flags[`sinisterFavorPaid:${e.id}`] = true;
      ports.queue(s, ...after);
      break;
    case "sinister-player:favor": {
      need(
        s.flags[`sinisterFavorPaid:${e.id}`],
        "Return the Favor requires its actual completed reveal cost.",
      );
      delete s.flags[`sinisterFavorPaid:${e.id}`];
      if (consumeStatus(s.player, "stunned")) {
        ports.queue(s, ...after);
        break;
      }
      // Hero Action form requirements were checked before the reveal cost
      // (RRG p24–25); an already-initiated event still resolves after a flip.
      if (!ports.enemyTargets(s, true).some((t) => t.id === s.villain.id)) {
        ports.queue(s, ...after);
        break;
      }
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: s.villain.id,
            amount: 5,
            source: "hero",
            attack: true,
            attackInitiated: true,
            abilitySource: e.id,
          }),
        ],
        after,
      );
      break;
    }
    case "sinister-player:heal-cost":
      need(
        s.player.form === "hero" &&
          ports.identityMaxHP(s) - s.player.hp >= 2 &&
          s.player.exhausted &&
          ports.canReadyIdentity(s, s.activePlayerId),
        "Heal exactly 2 damage and be able to ready.",
      );
      delete s.flags[`sinisterHealPaid:${e.id}`];
      ports.healIdentityCost(s, 2, [P("heal-paid", { id: e.id, after })]);
      break;
    case "sinister-player:heal-paid":
      s.flags[`sinisterHealPaid:${e.id}`] = true;
      ports.queue(s, ...after);
      break;
    case "sinister-player:ready-healed":
      need(
        s.flags[`sinisterHealPaid:${e.id}`],
        "What Doesn't Kill Me requires its healing cost.",
      );
      delete s.flags[`sinisterHealPaid:${e.id}`];
      ports.queue(
        s,
        ...(s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: `hero:${s.activePlayerId}` })]
          : []),
        ...after,
      );
      break;
    case "sinister-player:play-jump":
      need(
        sinisterPlayerPackJumpFlipOptions(s, e.receipt, [], ports).some(
          (o) => o.id === e.id,
        ),
        "Jump Flip's actual damage window is unavailable.",
      );
      ports.playJumpFlip(s, e.id, e.receipt, after);
      break;
    case "sinister-player:jump":
      need(
        ports.damageAvailable(s, e.receipt),
        "Jump Flip needs the actual pending damage.",
      );
      ports.preventDamage(s, e.receipt, 2, [
        P("jump-threat", { energy: e.energy, id: e.id, after }),
      ]);
      break;
    case "sinister-player:jump-threat":
      ports.queue(
        s,
        ...(e.energy
          ? [E("thwart", { target: "main", amount: 2, source: e.id })]
          : []),
        ...after,
      );
      break;
    case "sinister-player:silk-window": {
      const p = own(s, e.id, "27010");
      if (p && !ports.isTextBlank(s, p))
        response(s, "Silk", [P("silk-search", { id: p.id })], after, ports);
      else ports.queue(s, ...after);
      break;
    }
    case "sinister-player:silk-search": {
      ports.revealHidden(s);
      const found = s.encounter.deck.filter(
        (p) => d(p)?.type_code === "treachery",
      );
      if (found.length)
        targets(
          s,
          "Silk · discard a treachery",
          found.map((p) => ({ id: p.id, label: d(p).name, code: p.code })),
          P("silk-discard", { after }),
          ports,
        );
      else ports.shuffleEncounter(s, after);
      break;
    }
    case "sinister-player:silk-discard": {
      const i = s.encounter.deck.findIndex(
        (p) => p.id === e.target && d(p)?.type_code === "treachery",
      );
      need(i >= 0, "Silk needs the actual selected deck treachery.");
      s.encounter.discard.push(s.encounter.deck.splice(i, 1)[0]);
      ports.shuffleEncounter(s, after);
      break;
    }
    case "sinister-player:miles-window":
      response(
        s,
        "Spider-Man · Miles Morales",
        [P("miles-status", { id: e.id })],
        after,
        ports,
      );
      break;
    case "sinister-player:miles-status":
      targets(
        s,
        "Spider-Man · stun and confuse",
        ports
          .enemyTargets(s, false)
          .filter(
            (t) =>
              ports.canGiveStatus(s, t.id, "stunned") ||
              ports.canGiveStatus(s, t.id, "confused"),
          ),
        P("miles-status-target", { after }),
        ports,
      );
      break;
    case "sinister-player:miles-status-target":
      ports.queue(
        s,
        ...["stunned", "confused"]
          .filter((status) =>
            ports.canGiveStatus(s, e.target, status as "stunned"),
          )
          .map((status) => E("status", { target: e.target, status })),
        ...after,
      );
      break;
    case "sinister-player:uk-window": {
      const p = own(s, e.id, "27012");
      if (p && !ports.isTextBlank(s, p))
        response(
          s,
          "Spider-UK · defend interrupt",
          [P("uk-damage", { id: p.id, attackerId: e.attackerId })],
          after,
          ports,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "sinister-player:uk-damage":
      ports.queue(
        s,
        E("damage", {
          target: e.attackerId,
          amount: ports.controlledTraitCards(s, "Web-Warrior", false).length,
          source: e.id,
          attack: false,
        }),
        ...after,
      );
      break;
    case "sinister-player:monica-window":
      response(s, "Monica Chang", [P("monica-search")], after, ports);
      break;
    case "sinister-player:monica-search": {
      ports.revealHidden(s);
      const found = [
        ...s.player.deck,
        ...s.player.hand,
        ...s.player.discard,
      ].filter((p) => named(p, "Surveillance Team") && ports.canPutCard(s, p));
      if (found.length)
        targets(
          s,
          "Monica Chang · put Surveillance Team into play",
          found.map((p) => ({ id: p.id, label: d(p).name, code: p.code })),
          P("monica-put", { after }),
          ports,
        );
      else ports.shufflePlayerDeck(s, [P("monica-counters", { after })]);
      break;
    }
    case "sinister-player:monica-put":
      ports.putCard(s, e.target, [P("monica-shuffle", { after })]);
      break;
    case "sinister-player:monica-shuffle":
      ports.shufflePlayerDeck(s, [P("monica-counters", { after })]);
      break;
    case "sinister-player:monica-counters":
      for (const p of surveillance(s)) p.counters++;
      ports.queue(s, ...after);
      break;
    case "sinister-player:dugan-window":
      response(
        s,
        "Dum Dum Dugan · basic power interrupt",
        [P("dugan-select", { receipt: e.receipt, ids: [] })],
        after,
        ports,
      );
      break;
    case "sinister-player:dugan-select": {
      const ids: string[] = e.ids || [],
        list = eligibleShield(s, ports, ids);
      const options = list.map((t) =>
        O(
          t.id,
          t.label,
          [P("dugan-select", { ...e, type: undefined, ids: [...ids, t.id] })],
          t.code,
        ),
      );
      if (ids.length || !list.length)
        options.push(
          O("done", `Exhaust ${ids.length} and get +${ids.length}`, [
            P("dugan-commit", { receipt: e.receipt, ids, after }),
          ]),
        );
      if (ids.length >= 3)
        ports.queue(s, P("dugan-commit", { receipt: e.receipt, ids, after }));
      else
        ports.choose(
          s,
          "Dum Dum Dugan",
          "Choose up to 3 distinct ready S.H.I.E.L.D. cards.",
          options.length ? options : [O("done", "No cards", after)],
        );
      break;
    }
    case "sinister-player:dugan-commit": {
      const ids: string[] = e.ids || [];
      need(
        new Set(ids).size === ids.length &&
          ids.length <= 3 &&
          ids.every((id) => eligibleShield(s, ports).some((t) => t.id === id)),
        "Dugan needs distinct ready controlled S.H.I.E.L.D. cards.",
      );
      ports.exhaustCards(s, ids);
      ports.addBasicPowerBonus(s, e.receipt, ids.length);
      ports.queue(s, ...after);
      break;
    }
    case "sinister-player:agent-window":
      targets(
        s,
        "Agent 13 · ready a S.H.I.E.L.D. support",
        powerOptions(s, "S.H.I.E.L.D.", ports),
        P("ready-card", { after }),
        ports,
      );
      break;
    case "sinister-player:parker-window":
      targets(
        s,
        "Spider-Man · ready another Web-Warrior",
        ports.characterTargets(s, "Web-Warrior", e.id),
        P("ready-character", { after }),
        ports,
      );
      break;
    case "sinister-player:ready-card": {
      const p = allInPlay(s).find((p) => p.id === e.target);
      need(
        p && p.exhausted && ports.canReadyPiece(s, p),
        "Ready the actual legal exhausted card.",
      );
      ports.queue(s, E("ready", { target: p!.id }), ...after);
      break;
    }
    case "sinister-player:ready-character":
      need(
        ports.characterTargets(s, "Web-Warrior").some((t) => t.id === e.target),
        "Ready an actual exhausted Web-Warrior character.",
      );
      ports.queue(s, E("ready", { target: e.target }), ...after);
      break;
    case "sinister-player:field-agent": {
      const p = own(s, e.id, "27044");
      need(
        p &&
          sinisterPlayerPackConsequentialOptions(s, e.receipt, [], ports).some(
            (o) => o.id === p.id,
          ),
        "Field Agent needs this actual consequential window.",
      );
      p!.exhausted = true;
      p!.counters--;
      ports.preventConsequential(s, e.receipt, 1, [
        P("field-cleanup", { id: p!.id, after }),
      ]);
      break;
    }
    case "sinister-player:field-cleanup": {
      const p = own(s, e.id, "27044");
      if (p && p.counters <= 0) ports.discardControlled(s, p.id);
      ports.queue(s, ...after);
      break;
    }
    case "sinister-player:hobie-window":
      response(
        s,
        "Spider-Man · Hobie Brown leaves play",
        [P("hobie-discard", { id: e.id })],
        after,
        ports,
      );
      break;
    case "sinister-player:hobie-discard":
      ports.discardTopEncounter(s, 3, [P("hobie-count", { id: e.id, after })]);
      break;
    case "sinister-player:hobie-count":
      ports.countEncounterIcons(s, e.discardedIds || [], false, [
        P("hobie-damage", { id: e.id, after }),
      ]);
      break;
    case "sinister-player:hobie-damage":
      ports.queue(
        s,
        E("damage", {
          target: s.villain.id,
          amount: Number(e.boostTotal || 0),
          source: e.id,
          attack: false,
        }),
        ...after,
      );
      break;
    case "sinister-player:gwen-window":
      response(
        s,
        "Ghost-Spider ally · leave interrupt",
        [P("gwen-search")],
        after,
        ports,
      );
      break;
    case "sinister-player:gwen-search": {
      ports.revealHidden(s);
      const found = s.player.deck.filter(
        (p) => d(p)?.faction_code === "hero" && d(p)?.type_code === "event",
      );
      if (found.length)
        targets(
          s,
          "Ghost-Spider · find identity event",
          found.map((p) => ({ id: p.id, label: d(p).name, code: p.code })),
          P("gwen-take", { after }),
          ports,
        );
      else ports.shufflePlayerDeck(s, after);
      break;
    }
    case "sinister-player:gwen-take": {
      const i = s.player.deck.findIndex(
        (p) =>
          p.id === e.target &&
          d(p)?.faction_code === "hero" &&
          d(p)?.type_code === "event",
      );
      need(i >= 0, "Find the actual identity-specific deck event.");
      s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "sinister-player:web-life-window": {
      const choices = (e.ids as string[])
        .filter(
          (id) =>
            !e.used.includes(id) &&
            own(s, id, "27023") &&
            !ports.isTextBlank(s, own(s, id)!),
        )
        .map((id) =>
          O(
            id,
            "Web of Life and Destiny · choose who draws 1",
            [P("web-life-player", { ...e, type: undefined, id })],
            "27023",
          ),
        );
      if (choices.length)
        ports.choose(
          s,
          "Web of Life and Destiny",
          "After the actual Web-Warrior ally left play.",
          [...choices, O("pass", "Pass", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "sinister-player:web-life-player":
      ports.choose(
        s,
        "Web of Life and Destiny",
        "Choose a player.",
        playerOrder(s).map((seat) =>
          O(seat.id, ports.identityName(seatView(s, seat)), [
            E("draw", { amount: 1, actorId: seat.id }),
            P("web-life-window", {
              ...e,
              type: undefined,
              used: [...e.used, e.id],
              actorId: s.activePlayerId,
            }),
          ]),
        ),
      );
      break;
    case "sinister-player:sky-window": {
      const choices = (e.ids as string[])
        .filter((id) => {
          const p = own(s, id, "27055");
          return (
            p &&
            !p.exhausted &&
            !ports.isTextBlank(s, p) &&
            !s.flags[eventReceiptKey(e.receipt.token, id)] &&
            ports.enemyTargets(s, false).length
          );
        })
        .map((id) =>
          O(
            id,
            "Sky-Destroyer · exhaust to deal 2",
            [P("sky-target", { ...e, type: undefined, id })],
            "27055",
          ),
        );
      if (choices.length)
        ports.choose(
          s,
          "Sky-Destroyer",
          "After actual S.H.I.E.L.D. PLAY, once per source for this trigger.",
          [...choices, O("pass", "Pass", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "sinister-player:sky-target":
      targets(
        s,
        "Sky-Destroyer",
        ports.enemyTargets(s, false),
        P("sky-damage", { ...e, type: undefined }),
        ports,
      );
      break;
    case "sinister-player:sky-damage": {
      const p = own(s, e.id, "27055");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          !s.flags[eventReceiptKey(e.receipt.token, p.id)] &&
          ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Sky-Destroyer requires its actual available trigger and enemy.",
      );
      p!.exhausted = true;
      s.flags[eventReceiptKey(e.receipt.token, p!.id)] = true;
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 2,
          source: p!.id,
          attack: false,
        }),
        P("sky-window", { ...e, type: undefined }),
      );
      break;
    }
    case "sinister-player:venom-window": {
      const choices = (e.ids as string[])
        .filter(
          (id) =>
            own(s, id, "27190") &&
            !ports.isTextBlank(s, own(s, id)!) &&
            !s.flags[eventReceiptKey(e.receipt.token, id)],
        )
        .map((id) =>
          O(
            id,
            "Venom · deal 1 damage to him to respond",
            [P("venom-target", { ...e, type: undefined, id })],
            "27190",
          ),
        );
      if (choices.length)
        ports.choose(
          s,
          "Venom · revealed encounter response",
          "Numeric boost AND star icons count.",
          [...choices, O("pass", "Pass", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "sinister-player:venom-target":
      targets(
        s,
        "Venom · enemy",
        ports.enemyTargets(s, false),
        P("venom-cost", { ...e, type: undefined }),
        ports,
      );
      break;
    case "sinister-player:venom-cost": {
      const p = own(s, e.id, "27190");
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          !s.flags[eventReceiptKey(e.receipt.token, p.id)],
        "Venom can respond once to this actual reveal.",
      );
      s.flags[eventReceiptKey(e.receipt.token, p!.id)] = true;
      ports.damageAllyCost(s, p!.id, 1, [
        P("venom-count", { ...e, type: undefined }),
      ]);
      break;
    }
    case "sinister-player:venom-count":
      ports.countEncounterIcons(s, [e.receipt.pieceId], true, [
        P("venom-damage", { ...e, type: undefined }),
      ]);
      break;
    case "sinister-player:venom-damage":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: Number(e.boostTotal || 0),
          source: e.id,
          attack: false,
        }),
        P("venom-window", { ...e, type: undefined }),
      );
      break;
    case "sinister-player:spider-verse": {
      const sources = ports.controlledTraitCards(s, "Web-Warrior", true);
      need(
        (e.repeat || s.player.form === "hero") &&
          sources.length &&
          wwDiscard(s, ports).length,
        "Across the Spider-Verse needs its actual exhaust cost and discard ally.",
      );
      targets(
        s,
        "Across the Spider-Verse · exhaust a card",
        sources,
        P("verse-exhaust", {
          id: e.id,
          returnPlayerId: e.returnPlayerId || s.activePlayerId,
          after,
        }),
        ports,
      );
      break;
    }
    case "sinister-player:verse-exhaust":
      need(
        ports
          .controlledTraitCards(s, "Web-Warrior", true)
          .some((t) => t.id === e.target),
        "Exhaust an actual ready controlled Web-Warrior.",
      );
      ports.exhaustCards(s, [e.target]);
      targets(
        s,
        "Across the Spider-Verse · put ally into play",
        wwDiscard(s, ports).map((p) => ({
          id: p.id,
          label: d(p).name,
          code: p.code,
        })),
        P("verse-put", { id: e.id, returnPlayerId: e.returnPlayerId, after }),
        ports,
      );
      break;
    case "sinister-player:verse-put":
      ports.putCard(s, e.target, [
        P("verse-repeat-player", {
          id: e.id,
          returnPlayerId: e.returnPlayerId,
          after,
        }),
      ]);
      break;
    case "sinister-player:verse-repeat-player":
      ports.choose(
        s,
        "Across the Spider-Verse",
        "Choose a player who may pay 3 to repeat; passing ends the chain.",
        [
          ...playerOrder(s).map((seat) =>
            O(seat.id, ports.identityName(seatView(s, seat)), [
              P("verse-repeat", {
                id: e.id,
                playerId: seat.id,
                returnPlayerId: e.returnPlayerId,
                after,
              }),
            ]),
          ),
          O("pass", "End repetitions", [
            P("resume", { actorId: e.returnPlayerId, after }),
          ]),
        ],
      );
      break;
    case "sinister-player:verse-repeat": {
      const v = seatView(s, e.playerId);
      if (
        !ports.controlledTraitCards(v, "Web-Warrior", true).length ||
        !wwDiscard(v, ports).length ||
        !ports.canPay(v, 3)
      ) {
        ports.queue(s, P("resume", { actorId: e.returnPlayerId, after }));
        break;
      }
      ports.payRepeat(
        s,
        e.playerId,
        3,
        [
          P("spider-verse", {
            id: e.id,
            repeat: true,
            returnPlayerId: e.returnPlayerId,
            after,
            actorId: e.playerId,
          }),
        ],
        [P("resume", { actorId: e.returnPlayerId, after })],
      );
      break;
    }
    case "sinister-player:young-love": {
      const ids = new Set<string>();
      for (const seat of playerOrder(s))
        if (
          ["Gwen Stacy", "Miles Morales"].includes(
            ports.identityName(seatView(s, seat)),
          )
        )
          ids.add(`hero:${seat.id}`);
      for (const p of allInPlay(s))
        if (
          d(p)?.type_code === "ally" &&
          ["Gwen Stacy", "Miles Morales"].includes(d(p)?.subname || "")
        )
          ids.add(p.id);
      ports.queue(
        s,
        ...[...ids].map((target) => E("heal", { target, amount: 3 })),
        ...after,
      );
      break;
    }
    case "sinister-player:homeland":
      need(
        eligibleShield(s, ports).length && ports.schemeTargets(s, false).length,
        "Homeland Intervention needs an exhaustable card and legal scheme.",
      );
      ports.queue(s, P("homeland-select", { id: e.id, ids: [], after }));
      break;
    case "sinister-player:homeland-select": {
      const ids: string[] = e.ids || [],
        list = eligibleShield(s, ports, ids);
      if (ids.length >= 3) {
        ports.queue(s, P("homeland-target", { id: e.id, ids, after }));
        break;
      }
      const choices = list.map((t) =>
        O(
          t.id,
          t.label,
          [P("homeland-select", { id: e.id, ids: [...ids, t.id], after })],
          t.code,
        ),
      );
      if (ids.length)
        choices.push(
          O("done", `Use ${ids.length} cards`, [
            P("homeland-target", { id: e.id, ids, after }),
          ]),
        );
      ports.choose(
        s,
        "Homeland Intervention",
        "Choose up to 3 distinct ready S.H.I.E.L.D. cards.",
        choices,
      );
      break;
    }
    case "sinister-player:homeland-target":
      targets(
        s,
        "Homeland Intervention · scheme",
        ports.schemeTargets(s, false),
        P("homeland-commit", { id: e.id, ids: e.ids, after }),
        ports,
      );
      break;
    case "sinister-player:homeland-commit":
      need(
        e.ids.length > 0 &&
          e.ids.length <= 3 &&
          new Set(e.ids).size === e.ids.length &&
          e.ids.every((id: string) =>
            eligibleShield(s, ports).some((t) => t.id === id),
          ) &&
          ports.schemeTargets(s, false).some((t) => t.id === e.target),
        "Homeland Intervention needs actual distinct exhaust costs and its chosen scheme.",
      );
      ports.exhaustCards(s, e.ids);
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 2 * e.ids.length,
          source: e.id,
        }),
        ...after,
      );
      break;
    case "sinister-player:logistics":
      targets(
        s,
        "Global Logistics · exhaust S.H.I.E.L.D.",
        eligibleShield(s, ports),
        P("logistics-exhaust", { id: e.id, after }),
        ports,
      );
      break;
    case "sinister-player:logistics-exhaust":
      need(
        eligibleShield(s, ports).some((t) => t.id === e.target),
        "Global Logistics requires its actual controlled ready cost.",
      );
      ports.exhaustCards(s, [e.target]);
      ports.choose(
        s,
        "Global Logistics",
        "Choose the actual deck to inspect.",
        [
          ...playerOrder(s)
            .filter((seat) => seatView(s, seat).player.deck.length)
            .map((seat) =>
              O(seat.id, ports.identityName(seatView(s, seat)), [
                P("logistics-look", {
                  playerId: seat.id,
                  encounter: false,
                  after,
                }),
              ]),
            ),
          ...(s.encounter.deck.length
            ? [
                O("encounter", "Encounter deck", [
                  P("logistics-look", { encounter: true, after }),
                ]),
              ]
            : []),
        ],
      );
      break;
    case "sinister-player:logistics-look":
      ports.lookDeck(s, e.playerId, e.encounter, 4, [
        P("logistics-layout", {
          index: 0,
          discard: [],
          top: [],
          bottom: [],
          after,
        }),
      ]);
      break;
    case "sinister-player:logistics-layout": {
      const receipt: SinisterPlayerDeckReceipt = e.deckReceipt;
      if (e.index >= receipt.ids.length) {
        ports.queue(
          s,
          P("logistics-order", {
            receipt,
            discard: e.discard,
            top: e.top,
            bottom: e.bottom,
            section: "top",
            orderedTop: [],
            orderedBottom: [],
            after,
          }),
        );
        break;
      }
      const id = receipt.ids[e.index];
      const p = located(s, id);
      ports.choose(
        s,
        "Global Logistics · destinations",
        `Choose where ${p ? d(p).name : "this card"} goes.`,
        ["discard", "top", "bottom"].map((where) =>
          O(
            where,
            where,
            [
              P("logistics-layout", {
                ...e,
                type: undefined,
                index: e.index + 1,
                [where]: [...e[where], id],
              }),
            ],
            p?.code,
          ),
        ),
      );
      break;
    }
    case "sinister-player:logistics-order": {
      const section = e.section,
        list: string[] = e[section],
        ordered: string[] = section === "top" ? e.orderedTop : e.orderedBottom,
        pending = list.filter((id) => !ordered.includes(id));
      if (!pending.length) {
        if (section === "top")
          ports.queue(
            s,
            P("logistics-order", { ...e, type: undefined, section: "bottom" }),
          );
        else
          ports.arrangeDeck(
            s,
            e.receipt,
            e.discard,
            e.orderedTop,
            e.orderedBottom,
            after,
          );
        break;
      }
      ports.choose(
        s,
        "Global Logistics · order",
        `Order ${section} cards from nearest the top of the deck to nearest the bottom.`,
        pending.map((id) =>
          O(
            id,
            located(s, id) ? d(located(s, id)!).name : "Looked-at card",
            [
              P("logistics-order", {
                ...e,
                type: undefined,
                [section === "top" ? "orderedTop" : "orderedBottom"]: [
                  ...ordered,
                  id,
                ],
              }),
            ],
            located(s, id)?.code,
          ),
        ),
      );
      break;
    }
    case "sinister-player:plan-b": {
      const p = own(s, e.id, "27024");
      need(
        p && sinisterPlayerPackAbilityOptions(s, p.id, ports).length,
        "Plan B requires its actual ready source and random hand cost.",
      );
      p!.exhausted = true;
      ports.discardRandomHand(s, [P("plan-b-target", { id: p!.id, after })]);
      break;
    }
    case "sinister-player:plan-b-target":
      targets(
        s,
        "Plan B · enemy",
        ports.enemyTargets(s, false),
        P("plan-b-damage", { id: e.id, after }),
        ports,
      );
      break;
    case "sinister-player:plan-b-damage":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 2,
          source: e.id,
          attack: false,
        }),
        ...after,
      );
      break;
    case "sinister-player:government": {
      const p = own(s, e.id, "27054");
      need(
        p && sinisterPlayerPackAbilityOptions(s, p.id, ports).length,
        "Government Liaison is unavailable.",
      );
      p!.exhausted = true;
      targets(
        s,
        "Government Liaison · actual S.H.I.E.L.D. hand PLAY",
        playableHand(s, ports)
          .filter((p) => governmentPlayable(s, p, ports))
          .map((p) => ({ id: p.id, label: d(p).name, code: p.code })),
        P("government-play", { after }),
        ports,
      );
      break;
    }
    case "sinister-player:government-play": {
      const p = playableHand(s, ports).find((p) => p.id === e.target);
      need(
        p && governmentPlayable(s, p, ports),
        "Government Liaison needs its actual playable S.H.I.E.L.D. hand card.",
      );
      ports.playFromHand(s, p!.id, 1, after);
      break;
    }
    case "sinister-player:resume":
      ports.queue(s, ...after);
      break;
    default:
      return false;
  }
  return true;
}
