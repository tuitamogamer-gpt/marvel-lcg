import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const card = (p: Pick<Piece, "code">) => definitions.get(p.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`mutant-genesis-player:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (yes: unknown, message: string) => {
  if (!yes) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) =>
      p.id === id &&
      (!code || p.code === code || (code === "32019" && p.code === "37017")),
  );
const normalize = (s: GameState, id: string) =>
  id === "hero" ? `hero:${s.activePlayerId}` : id;
const responseKey = (token: string, id: string) =>
  `mutantGenesisResponse:${token}:${id}`;
const eventBonusKey = (id: string) => `mutantGenesisEventBonus:${id}`;
const professorKey = (id: string) => `mutantGenesisProfessorRound:${id}`;
const costKey = (id: string) => `mutantGenesisStrikeCost:${id}`;

export const MUTANT_GENESIS_PLAYER_PACK_CORE_ALIAS_PAIRS = [
  ["32022", "01088"],
  ["32023", "01089"],
  ["32024", "01090"],
  ["32052", "01088"],
  ["32053", "01089"],
  ["32054", "01090"],
] as const;
export const MUTANT_GENESIS_PLAYER_PACK_CORE_ALIASES =
  MUTANT_GENESIS_PLAYER_PACK_CORE_ALIAS_PAIRS.map(([code]) => code);
/** These exact mechanical reprints retain their own physical printing code. */
export const MUTANT_GENESIS_PLAYER_PACK_NATIVE_ALIAS_PAIRS = [
  ["32015", "15030"],
  ["32016", "13033"],
  ["32046", "10015"],
  ["32051", "21022"],
] as const;
export const MUTANT_GENESIS_PLAYER_PACK_SCRIPT_CODES = [
  "32011",
  "32012",
  "32013",
  "32014",
  "32015",
  "32016",
  "32017",
  "32018",
  "32019",
  "32020",
  "32021",
  "32041",
  "32042",
  "32043",
  "32044",
  "32045",
  "32046",
  "32047",
  "32048",
  "32049",
  "32050",
  "32051",
] as const;
export const MUTANT_GENESIS_PLAYER_PACK_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const MUTANT_GENESIS_PLAYER_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface MutantGenesisAttackReceipt {
  token: string;
  /** Player originally attacked; interrupt's actor may be another player. */
  playerId: string;
  attackerId: string;
  stage: "initiated" | "attacks";
}
export interface MutantGenesisPaymentReceipt {
  token: string;
  /** Actual spender, whose Hero Interrupt this is. */
  playerId: string;
  eventId: string;
  eventCode: string;
  /** True only for actual PLAY payment; false for an ability's SPEND cost. */
  playing: boolean;
  /** Actual physical hand cards committed to that payment, including surplus. */
  resourceIds: string[];
}
export interface MutantGenesisPlayerPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(
    s: GameState,
    title: string,
    text: string,
    options: Option[],
    cancelable?: boolean,
  ): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  identityHasTrait(s: GameState, trait: string): boolean;
  /** Hero name belonging to the chosen identity, in either form. */
  identityHeroName(s: GameState): string;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  friendlyTargets(s: GameState): AntManTarget[];
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  canReady(s: GameState, target: string): boolean;
  canHeal(s: GameState, target: string): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "tough" | "stunned" | "confused",
  ): boolean;
  canExhaustIdentity(s: GameState): boolean;
  /** Atomically pay actual distinct controlled exhaust costs, including hero. */
  exhaustCards(s: GameState, ids: string[]): void;
  heroAttack(s: GameState): number;
  allyAttack(s: GameState, p: Piece): number;
  /** Sum all once-per-printed-amount modifiers before dividing Team Strike. */
  attackEventTotalBonus?(s: GameState, eventId: string): number;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  handPlayableCards(s: GameState): Piece[];
  canPutAlly(s: GameState, p: Piece): boolean;
  /** PUT this physical hand ally, finish uniqueness/limit/entry/Uses windows,
   * then resume; it is not PLAY and Magik's PLAY response cannot trigger. */
  putAlly(s: GameState, id: string, after: Effect[]): void;
  canDeclareAllyDefender(
    s: GameState,
    receipt: MutantGenesisAttackReceipt,
    id: string,
  ): boolean;
  /** Exhaust actual ready ally and declare its actual controller defender. */
  declareAllyDefender(
    s: GameState,
    receipt: MutantGenesisAttackReceipt,
    id: string,
  ): void;
  /** Same physical ally to owner's hand through native leave/attachment cleanup. */
  returnAllyToHand(s: GameState, id: string, after: Effect[]): void;
  shuffleMinionIntoEncounter(s: GameState, id: string, after: Effect[]): void;
  attach(s: GameState, id: string, target: string): void;
  attackAvailable(s: GameState, receipt: MutantGenesisAttackReceipt): boolean;
  /** Actual paid PLAY with specified effects; cancellation must leave receipt
   * unconsumed and restore the pending interrupt's original continuation. */
  playEvent(
    s: GameState,
    id: string,
    effects: Effect[],
    receipt: MutantGenesisAttackReceipt,
    after: Effect[],
  ): void;
  /** Paid Defense event creates hero defender using native defense rules. */
  claimDefense(s: GameState, receipt: MutantGenesisAttackReceipt): void;
  /** Lasting prevention for this exact enemy attack, including overkill. */
  preventAttack(s: GameState, receipt: MutantGenesisAttackReceipt): void;
  damageAvailable(s: GameState, packet: Effect): boolean;
  /** Update only this native pending damage occurrence; no HP-delta inference. */
  preventDamage(s: GameState, packet: Effect, amount: number): void;
  /** One native hero Attack program, one Stun replacement, simultaneously
   * commit all allocations before defeat/Retaliate/response continuations.
   * Printed X and resource bonus are already included in amounts. */
  simultaneousAttack(
    s: GameState,
    allocations: { target: string; amount: number }[],
    after: Effect[],
  ): void;
}

const xMen = (s: GameState, ports: MutantGenesisPlayerPackPorts) =>
  ports.friendlyTargets(s).filter((t) => ports.hasTrait(s, t.id, "X-Men"));
const readyAllies = (s: GameState, ports: MutantGenesisPlayerPackPorts) =>
  s.player.inPlay.filter(
    (p) =>
      card(p).type_code === "ally" &&
      !p.exhausted &&
      ports.hasTrait(s, p.id, "X-Men"),
  );
const protectorAllies = (
  s: GameState,
  ports: MutantGenesisPlayerPackPorts,
  excludeId?: string,
) =>
  s.player.hand.filter(
    (p) =>
      p.id !== excludeId &&
      card(p).type_code === "ally" &&
      ports.hasTrait(s, p.id, "X-Men") &&
      ports.canPutAlly(s, p),
  );
function magikTargets(s: GameState, ports: MutantGenesisPlayerPackPorts) {
  return s.minions.filter((p) => {
    const seat = s.players.find(
      (seat) =>
        !seat.eliminated && seat.id === (p.engagedWith || s.activePlayerId),
    );
    return (
      !ports.hasTrait(s, p.id, "Elite") &&
      !!seat &&
      seatView(s, seat).player.form === "hero" &&
      ports.identityHasTrait(seatView(s, seat), "X-Men")
    );
  });
}
function teamUpAvailable(s: GameState, ports: MutantGenesisPlayerPackPorts) {
  const name = ports.identityHeroName(s);
  if (!["Colossus", "Shadowcat"].includes(name)) return false;
  const names = new Set([
    ...playerOrder(s).map((seat) => ports.identityHeroName(seatView(s, seat))),
    ...allInPlay(s)
      .filter((p) => card(p).type_code === "ally")
      .map((p) => card(p).name),
  ]);
  return names.has("Colossus") && names.has("Shadowcat");
}
function targetChoice(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: MutantGenesisPlayerPackPorts,
) {
  if (!targets.length) ports.queue(s, ...after);
  else
    ports.choose(
      s,
      title,
      "Choose a legal target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
function optional(
  s: GameState,
  title: string,
  effects: Effect[],
  after: Effect[],
  ports: MutantGenesisPlayerPackPorts,
) {
  ports.choose(s, title, "Resolve this optional response?", [
    O("yes", "Resolve", [...effects, ...after]),
    O("no", "Decline", after),
  ]);
}
export function mutantGenesisPlayerPackCostReduction(
  s: GameState,
  p: Piece,
  ports: Pick<MutantGenesisPlayerPackPorts, "identityHasTrait">,
): number {
  return p.code === "32048" &&
    (ports.identityHasTrait(s, "Mutant") || ports.identityHasTrait(s, "X-Men"))
    ? 1
    : 0;
}
export function mutantGenesisPlayerPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: MutantGenesisPlayerPackPorts,
): string | undefined {
  if (
    ["32017", "32045"].includes(p.code) &&
    !ports.identityHasTrait(s, "X-Men")
  )
    return `${card(p).name} requires an X-Men identity.`;
  if (["32021", "32050"].includes(p.code) && !teamUpAvailable(s, ports))
    return "Shadow and Steel needs your chosen Colossus or Shadowcat identity and both named friendly characters in play.";
  if (
    p.code === "32045" &&
    (s.player.form !== "hero" || !ports.canExhaustIdentity(s))
  )
    return "Team Strike needs a hero that can exhaust as its additional cost.";
  if (
    ["32013", "32043", "32044"].includes(p.code) &&
    !mutantGenesisPlayerPackAttachmentTargets(s, p, ports)?.length
  )
    return `${card(p).name} needs a legal attachment target.`;
  return undefined;
}
export function mutantGenesisPlayerPackAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: MutantGenesisPlayerPackPorts,
): AntManTarget[] | null {
  if (["32013", "32043"].includes(p.code))
    return xMen(s, ports).filter(
      (t) =>
        !t.id.startsWith("hero:") &&
        t.id !== "hero" &&
        !allInPlay(s).some(
          (a) =>
            a.id !== p.id &&
            normalize(s, a.attachedTo || "") === normalize(s, t.id) &&
            ports.hasTrait(s, a.id, "Training"),
        ),
    );
  if (p.code === "32044")
    return s.minions.map((a) => ({
      id: a.id,
      label: card(a)?.name || "Ultron Drone",
      code: a.code,
    }));
  return null;
}
export function mutantGenesisPlayerPackCardEntered(
  _s: GameState,
  p: Piece,
): Effect[] {
  return ["32013", "32043", "32044"].includes(p.code) && !p.attachedTo
    ? [P("attach", { id: p.id })]
    : [];
}
export function mutantGenesisPlayerPackCharacterModifiers(
  s: GameState,
  target: string,
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank">,
) {
  const upgrades = allInPlay(s).filter(
    (p) =>
      p.attachedTo === target &&
      !ports.isTextBlank(seatView(s, controller(s, p.id)!), p),
  );
  return {
    attack: upgrades.filter((p) => p.code === "32043").length,
    health: upgrades.reduce(
      (n, p) => n + (p.code === "32013" ? 3 : p.code === "32043" ? 2 : 0),
      0,
    ),
  };
}
export function mutantGenesisPlayerPackMinionModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank">,
) {
  const copies = allInPlay(s).filter(
    (a) =>
      a.code === "32044" &&
      a.attachedTo === p.id &&
      !ports.isTextBlank(seatView(s, controller(s, a.id)!), a),
  ).length;
  return { health: copies * 2, patrol: copies > 0 };
}
export function mutantGenesisPlayerPackPiercing(
  s: GameState,
  p: Piece,
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank">,
): boolean {
  return p.code === "32041" && !ports.isTextBlank(s, p);
}
export function mutantGenesisPlayerPackAllyEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
  ports: MutantGenesisPlayerPackPorts,
  after: Effect[] = [],
  played = fromHand,
): Effect[] | null {
  if (ports.isTextBlank(s, p)) return null;
  if (p.code === "32012") return [P("polaris-window", { id: p.id, after })];
  if (["32019", "37017"].includes(p.code))
    return [P("professor", { id: p.id, after, mandatory: true, forced: true })];
  if (
    p.code === "32042" &&
    fromHand &&
    played &&
    magikTargets(s, ports).length &&
    ports.canPay(s, 1, ["mental"], undefined, p.code)
  )
    return [P("magik-window", { id: p.id, after })];
  return null;
}
export function mutantGenesisPlayerPackTurnBegan(
  s: GameState,
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank">,
): Effect[] {
  return s.player.inPlay
    .filter(
      (p) => p.code === "32041" && p.damage > 0 && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      E("optional", {
        title: "Wolverine",
        image: p.code,
        actorId: s.activePlayerId,
        effects: [E("heal", { target: p.id, amount: 1 })],
      }),
    );
}
/** Professor's entry ability creates a delayed effect. Later text blanking
 * does not cancel that effect; leaving play ends the physical instance's mark. */
export function mutantGenesisPlayerPackRoundEnded(s: GameState): Effect[] {
  return allInPlay(s).flatMap((p) => {
    const seat = controller(s, p.id)!;
    const v = seatView(s, seat);
    return ["32019", "37017"].includes(p.code) &&
      v.flags[professorKey(p.id)] !== undefined &&
      Number(v.flags[professorKey(p.id)]) <= s.round
      ? [
          P("professor-discard", {
            id: p.id,
            actorId: seat.id,
            mandatory: true,
            forced: true,
          }),
        ]
      : [];
  });
}
export function mutantGenesisPlayerPackCardLeft(
  s: GameState,
  id: string,
): void {
  for (const seat of s.players) {
    const v = seatView(s, seat);
    delete v.flags[professorKey(id)];
    delete v.flags[`mutantGenesisGatekeeperHandled:${id}`];
  }
}
export function mutantGenesisPlayerPackResourceSources(
  s: GameState,
  payerId: string,
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank" | "identityHasTrait">,
): PaymentSource[] {
  const payer = s.players.find(
    (seat) => seat.id === payerId && !seat.eliminated,
  );
  if (!payer || !ports.identityHasTrait(seatView(s, payer), "X-Men")) return [];
  return allInPlay(s)
    .filter(
      (p) =>
        ["32020", "36023"].includes(p.code) &&
        !p.exhausted &&
        !ports.isTextBlank(seatView(s, controller(s, p.id)!), p),
    )
    .map((p) => {
      const seat = controller(s, p.id)!;
      return {
        id: p.id,
        localId: p.id,
        playerId: seat.id,
        name: "The X-Jet",
        code: p.code,
        resources: ["wild"],
        description:
          "Exhaust The X-Jet · generate 1 wild for this X-Men player",
        kind: "ability",
      };
    });
}
/** Invoke after real sources commit, before the event's PLAY effect. This
 * receipt identifies spending physical cards, not mere generated resources. */
export function mutantGenesisPlayerPackPaymentInterrupts(
  s: GameState,
  pieces: Piece[],
  receipt: MutantGenesisPaymentReceipt,
): Effect[] {
  const c = definitions.get(receipt.eventCode);
  if (
    receipt.playerId !== s.activePlayerId ||
    !receipt.playing ||
    s.player.form !== "hero" ||
    c?.type_code !== "event"
  )
    return [];
  const traits = (c.traits || "").split(/\.\s*/).filter(Boolean);
  return pieces
    .filter(
      (p) =>
        receipt.resourceIds.includes(p.id) &&
        ((p.code === "32018" && traits.includes("Defense")) ||
          (["32047", "35020"].includes(p.code) && traits.includes("Attack"))),
    )
    .flatMap((p) =>
      s.flags[responseKey(receipt.token, p.id)]
        ? []
        : [
            E("optional", {
              title: card(p).name,
              image: p.code,
              actorId: receipt.playerId,
              text:
                p.code === "32018"
                  ? "Draw 1 card before this Defense event resolves?"
                  : "This Attack event deals 1 additional damage?",
              effects: [
                P("payment-interrupt", { id: p.id, code: p.code, receipt }),
              ],
            }),
          ],
    );
}
export function mutantGenesisPlayerPackAttackEventBonus(
  s: GameState,
  eventId: string,
): number {
  return s.players.reduce(
    (sum, seat) =>
      sum + Number(seatView(s, seat).flags[eventBonusKey(eventId)] || 0),
    0,
  );
}
export function mutantGenesisPlayerPackEventFinished(
  s: GameState,
  eventId: string,
): void {
  for (const seat of s.players)
    delete seatView(s, seat).flags[eventBonusKey(eventId)];
  delete s.flags[costKey(eventId)];
}
export function mutantGenesisPlayerPackAttackOptions(
  s: GameState,
  receipt: MutantGenesisAttackReceipt,
  after: Effect[],
  ports: MutantGenesisPlayerPackPorts,
): Option[] {
  if (s.player.form !== "hero" || !ports.attackAvailable(s, receipt)) return [];
  return ports
    .handPlayableCards(s)
    .filter((p) => {
      if (s.flags[responseKey(receipt.token, p.id)]) return false;
      if (
        receipt.stage === "initiated"
          ? p.code !== "32014"
          : !["32017", "32021", "32050"].includes(p.code)
      )
        return false;
      if (mutantGenesisPlayerPackPlayRestriction(s, p, ports)) return false;
      return (
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code) &&
        (p.code !== "32017" || protectorAllies(s, ports, p.id).length > 0)
      );
    })
    .map((p) =>
      O(
        p.id,
        `${card(p).name} · play interrupt`,
        [P("attack-play", { id: p.id, code: p.code, receipt, after })],
        p.code,
      ),
    );
}
export function mutantGenesisPlayerPackDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: MutantGenesisPlayerPackPorts,
): Option[] {
  if (
    !packet.attack ||
    packet.amount <= 0 ||
    !ports.damageAvailable(s, packet) ||
    !ports.hasTrait(s, packet.target, "X-Men")
  )
    return [];
  const token = String(
    packet.mutantGenesisDamageToken ||
      packet.damageToken ||
      packet.damageWindowId ||
      `${s.round}:${s.nextId}:${packet.source}:${packet.target}`,
  );
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "32011" &&
        !ports.isTextBlank(s, p) &&
        !s.flags[responseKey(token, p.id)] &&
        ports.canPay(s, 1, ["energy"], undefined, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Nightcrawler · spend Energy and return to hand to prevent all damage",
        [P("nightcrawler-pay", { id: p.id, packet, token, after })],
        p.code,
      ),
    );
}
export function mutantGenesisPlayerPackMinionDefeatOptions(
  s: GameState,
  minionId: string,
  token: string,
  after: Effect[],
  ports: Pick<MutantGenesisPlayerPackPorts, "isTextBlank">,
): Option[] {
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "32044" &&
        p.attachedTo === minionId &&
        !ports.isTextBlank(s, p) &&
        !s.flags[responseKey(token, p.id)],
    )
    .map((p) =>
      O(
        p.id,
        "Gatekeeper · remove 4 threat from the main scheme",
        [P("gatekeeper", { id: p.id, minionId, token, after })],
        p.code,
      ),
    );
}
interface MutantGenesisStrikeCostReceipt {
  ids: string[];
  committed: boolean;
}
function strikeCostReceipt(
  s: GameState,
  id: string,
): MutantGenesisStrikeCostReceipt | undefined {
  const raw = s.flags[costKey(id)];
  return typeof raw === "string"
    ? (JSON.parse(raw) as MutantGenesisStrikeCostReceipt)
    : undefined;
}
/** Selecting extra-cost characters stages physical IDs. Validate every one
 * before native payment mutates even a single selected resource source. */
export function mutantGenesisPlayerPackPaymentPreflight(
  s: GameState,
  p: Piece,
  ports: MutantGenesisPlayerPackPorts,
  selectedResourceIds: string[] = [],
): void {
  if (p.code !== "32045") return;
  const receipt = strikeCostReceipt(s, p.id);
  const hero = `hero:${s.activePlayerId}`;
  const eligible = readyAllies(s, ports);
  need(
    receipt &&
      !receipt.committed &&
      Array.isArray(receipt.ids) &&
      receipt.ids[0] === hero &&
      new Set(receipt.ids).size === receipt.ids.length &&
      s.player.form === "hero" &&
      ports.identityHasTrait(s, "X-Men") &&
      ports.canExhaustIdentity(s) &&
      receipt.ids
        .slice(1)
        .every((id) => eligible.some((ally) => ally.id === id)) &&
      receipt.ids.every((id) => !selectedResourceIds.includes(id)),
    "Team Strike's staged cost needs distinct ready controlled X-Men characters and a ready hero.",
  );
}
/** Native PAY commits this with its resource sources, before spend interrupts
 * or PLAY. The same additional cost also requires a real PAY when cost is 0. */
export function mutantGenesisPlayerPackPaymentCommit(
  s: GameState,
  p: Piece,
): Effect[] {
  return p.code === "32045" && !!strikeCostReceipt(s, p.id)
    ? [P("strike-commit", { id: p.id, code: p.code })]
    : [];
}
export function mutantGenesisPlayerPackBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "32045" && !s.flags[costKey(p.id)]
    ? [P("strike-cost", { id: p.id, after })]
    : null;
}
export function mutantGenesisPlayerPackEvent(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return p.code === "32045" ? [P("strike", { id: p.id })] : null;
}
export function mutantGenesisPlayerPackAbilityOptions(
  s: GameState,
  id: string,
  ports: MutantGenesisPlayerPackPorts,
): Option[] {
  const p = allInPlay(s).find(
    (p) => p.id === id && ["32049", "36025", "37018"].includes(p.code),
  );
  if (
    !p ||
    p.exhausted ||
    ports.isTextBlank(seatView(s, controller(s, p.id)!), p) ||
    s.player.form !== "alter"
  )
    return [];
  if (
    controller(s, p.id)?.id !== s.activePlayerId &&
    !ports.identityHasTrait(s, "Mutant")
  )
    return [];
  const targets = ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        (ports.hasTrait(s, t.id, "Mutant") ||
          ports.hasTrait(s, t.id, "X-Men")) &&
        ports.canHeal(s, t.id),
    );
  return targets.length
    ? [
        O(
          "heal",
          "X-Mansion · exhaust to heal 1 damage",
          [P("mansion", { id })],
          p.code,
        ),
      ]
    : [];
}
export function mutantGenesisPlayerPackAbility(
  s: GameState,
  id: string,
  ports: MutantGenesisPlayerPackPorts,
  action?: string,
): boolean {
  const o = mutantGenesisPlayerPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!o) return false;
  ports.queue(s, ...o.effects);
  return true;
}

export function resolveMutantGenesisPlayerPackEffect(
  s: GameState,
  e: Effect,
  ports: MutantGenesisPlayerPackPorts,
): boolean {
  if (!e.type.startsWith("mutant-genesis-player:")) return false;
  switch (e.type) {
    case "mutant-genesis-player:attach": {
      const p = own(s, e.id);
      need(p, "The actual attachment must remain in play.");
      targetChoice(
        s,
        card(p!).name,
        mutantGenesisPlayerPackAttachmentTargets(s, p!, ports) || [],
        P("attach-to", { id: p!.id }),
        [],
        ports,
      );
      break;
    }
    case "mutant-genesis-player:attach-to": {
      const p = own(s, e.id);
      need(
        p &&
          mutantGenesisPlayerPackAttachmentTargets(s, p, ports)?.some(
            (t) => t.id === e.target,
          ),
        "This actual attachment target is no longer legal.",
      );
      ports.attach(s, e.id, e.target);
      break;
    }
    case "mutant-genesis-player:polaris-window": {
      const p = own(s, e.id, "32012");
      if (
        !p ||
        ports.isTextBlank(s, p) ||
        !xMen(s, ports).some((t) => ports.canGiveStatus(s, t.id, "tough"))
      )
        ports.queue(s, ...(e.after || []));
      else
        optional(
          s,
          "Polaris",
          [P("polaris", { id: p.id })],
          e.after || [],
          ports,
        );
      break;
    }
    case "mutant-genesis-player:polaris": {
      targetChoice(
        s,
        "Polaris",
        xMen(s, ports).filter((t) => ports.canGiveStatus(s, t.id, "tough")),
        E("status", { status: "tough" }),
        [],
        ports,
      );
      break;
    }
    case "mutant-genesis-player:professor": {
      const p = own(s, e.id, "32019");
      if (!p) {
        ports.queue(s, ...(e.after || []));
        break;
      }
      s.flags[professorKey(p.id)] = s.round;
      const options: Option[] = [];
      if (ports.canGiveStatus(s, s.villain.id, "confused"))
        options.push(
          O("confuse", "Confuse the villain", [
            E("status", { target: s.villain.id, status: "confused" }),
            ...(e.after || []),
          ]),
        );
      for (const minion of s.minions)
        if (ports.canGiveStatus(s, minion.id, "stunned"))
          options.push(
            O(
              `stun:${minion.id}`,
              `Stun ${card(minion)?.name || "Ultron Drone"}`,
              [
                E("status", { target: minion.id, status: "stunned" }),
                ...(e.after || []),
              ],
              minion.code,
            ),
          );
      for (const t of xMen(s, ports).filter((t) => ports.canReady(s, t.id)))
        options.push(
          O(
            `ready:${t.id}`,
            `Ready ${t.label}`,
            [E("ready", { target: t.id }), ...(e.after || [])],
            t.code,
          ),
        );
      if (options.length)
        ports.choose(
          s,
          "Professor X",
          "Choose one forced entry effect.",
          options,
        );
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:professor-discard": {
      const p = own(s, e.id, "32019");
      if (p && s.flags[professorKey(p.id)] !== undefined) {
        delete s.flags[professorKey(p.id)];
        ports.queue(s, E("discardPiece", { id: p.id, mandatory: true }));
      }
      break;
    }
    case "mutant-genesis-player:magik-window": {
      const p = own(s, e.id, "32042");
      if (
        !p ||
        ports.isTextBlank(s, p) ||
        !magikTargets(s, ports).length ||
        !ports.canPay(s, 1, ["mental"], undefined, "32042")
      )
        ports.queue(s, ...(e.after || []));
      else
        optional(
          s,
          "Magik",
          [P("magik-pay", { id: p.id, after: [] })],
          e.after || [],
          ports,
        );
      break;
    }
    case "mutant-genesis-player:magik-pay": {
      const p = own(s, e.id, "32042");
      need(
        p &&
          magikTargets(s, ports).length &&
          ports.canPay(s, 1, ["mental"], undefined, p.code),
        "Magik needs an eligible minion and a Mental resource.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Magik",
          cost: 1,
          targetCode: p!.code,
          requirements: ["mental"],
          abilityCost: true,
          cancelable: false,
          after: [P("magik", { id: p!.id, after: e.after || [] })],
        }),
      );
      break;
    }
    case "mutant-genesis-player:magik": {
      targetChoice(
        s,
        "Magik",
        magikTargets(s, ports).map((p) => ({
          id: p.id,
          label: card(p)?.name || "Ultron Drone",
          code: p.code,
        })),
        P("magik-shuffle", { after: e.after || [] }),
        e.after || [],
        ports,
      );
      break;
    }
    case "mutant-genesis-player:magik-shuffle": {
      if (magikTargets(s, ports).some((p) => p.id === e.target))
        ports.shuffleMinionIntoEncounter(s, e.target, e.after || []);
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:attack-play": {
      const p = ports
        .handPlayableCards(s)
        .find((p) => p.id === e.id && p.code === e.code);
      need(
        p &&
          mutantGenesisPlayerPackAttackOptions(
            s,
            e.receipt,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "This enemy-attack interrupt is no longer available.",
      );
      ports.playEvent(
        s,
        p!.id,
        [P("attack-event", { id: p!.id, code: p!.code, receipt: e.receipt })],
        e.receipt,
        e.after || [],
      );
      break;
    }
    case "mutant-genesis-player:attack-paid": {
      s.flags[responseKey(e.receipt.token, e.id)] = true;
      break;
    }
    case "mutant-genesis-player:attack-event": {
      s.flags[responseKey(e.receipt.token, e.id)] = true;
      if (!ports.attackAvailable(s, e.receipt)) break;
      if (e.code === "32017") {
        targetChoice(
          s,
          "Mutant Protectors",
          protectorAllies(s, ports).map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
          })),
          P("protectors-put", { receipt: e.receipt }),
          [],
          ports,
        );
      } else {
        ports.claimDefense(s, e.receipt);
        if (e.code !== "32014") ports.preventAttack(s, e.receipt);
        ports.queue(
          s,
          E("damage", {
            target: e.receipt.attackerId,
            amount: 4,
            source: "hero",
            attack: true,
            attackInitiated: true,
            eventId: e.id,
          }),
        );
      }
      break;
    }
    case "mutant-genesis-player:protectors-put": {
      const p = protectorAllies(s, ports).find((p) => p.id === e.target);
      need(
        p && ports.attackAvailable(s, e.receipt),
        "The actual X-Men ally and enemy attack must remain available.",
      );
      ports.putAlly(s, p!.id, [
        P("protectors-defend", { id: p!.id, receipt: e.receipt }),
      ]);
      break;
    }
    case "mutant-genesis-player:protectors-defend": {
      if (
        ports.attackAvailable(s, e.receipt) &&
        ports.canDeclareAllyDefender(s, e.receipt, e.id)
      )
        ports.declareAllyDefender(s, e.receipt, e.id);
      break;
    }
    case "mutant-genesis-player:nightcrawler-pay": {
      const p = own(s, e.id, "32011");
      need(
        p &&
          mutantGenesisPlayerPackDamageOptions(
            s,
            e.packet,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Nightcrawler's damage interrupt needs a real Energy payment.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Nightcrawler",
          cost: 1,
          targetCode: p!.code,
          requirements: ["energy"],
          abilityCost: true,
          cancelable: false,
          after: [
            P("nightcrawler-return", {
              id: p!.id,
              packet: e.packet,
              token: e.token,
              after: e.after || [],
            }),
          ],
        }),
      );
      break;
    }
    case "mutant-genesis-player:nightcrawler-return": {
      const p = own(s, e.id, "32011");
      need(p, "Returning the same physical Nightcrawler is part of its cost.");
      s.flags[responseKey(e.token, e.id)] = true;
      ports.returnAllyToHand(s, p!.id, [
        P("nightcrawler-prevent", { packet: e.packet, after: e.after || [] }),
      ]);
      break;
    }
    case "mutant-genesis-player:nightcrawler-prevent": {
      if (ports.damageAvailable(s, e.packet))
        ports.preventDamage(s, e.packet, e.packet.amount);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:payment-interrupt": {
      const r = e.receipt as MutantGenesisPaymentReceipt;
      if (s.flags[responseKey(r.token, e.id)]) break;
      need(
        r.playing &&
          r.playerId === s.activePlayerId &&
          r.resourceIds.includes(e.id),
        "This interrupt requires that actual committed event payment.",
      );
      s.flags[responseKey(r.token, e.id)] = true;
      if (e.code === "32018") ports.queue(s, E("draw", { amount: 1 }));
      else if (["32047", "35020"].includes(e.code))
        s.flags[eventBonusKey(r.eventId)] =
          Number(s.flags[eventBonusKey(r.eventId)] || 0) + 1;
      break;
    }
    case "mutant-genesis-player:gatekeeper-window": {
      if (!s.minions.some((p) => p.id === e.minionId)) {
        ports.queue(s, ...(e.after || []));
        break;
      }
      const resume = { ...e, actorId: e.originalActorId };
      const options = playerOrder(s).flatMap((seat) =>
        mutantGenesisPlayerPackMinionDefeatOptions(
          seatView(s, seat),
          e.minionId,
          e.token,
          [resume],
          ports,
        ).map((o) => ({
          ...o,
          id: `${seat.id}:${o.id}`,
          effects: o.effects.map((fx) => ({ ...fx, actorId: seat.id })),
        })),
      );
      if (options.length)
        ports.choose(
          s,
          "Minion defeated",
          "Resolve a Gatekeeper interrupt before this physical minion leaves play?",
          [
            ...options,
            O("continue", "Continue the defeat", [
              P("gatekeeper-finish", {
                ...e,
                type: "mutant-genesis-player:gatekeeper-finish",
                actorId: e.originalActorId,
              }),
            ]),
          ],
        );
      else
        ports.queue(
          s,
          P("gatekeeper-finish", {
            ...e,
            type: "mutant-genesis-player:gatekeeper-finish",
            actorId: e.originalActorId,
          }),
        );
      break;
    }
    case "mutant-genesis-player:gatekeeper-finish": {
      s.flags[`mutantGenesisGatekeeperHandled:${e.minionId}`] = true;
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:gatekeeper": {
      const p = own(s, e.id, "32044");
      if (
        p &&
        p.attachedTo === e.minionId &&
        !ports.isTextBlank(s, p) &&
        !s.flags[responseKey(e.token, p.id)]
      ) {
        s.flags[responseKey(e.token, p.id)] = true;
        ports.queue(
          s,
          E("thwart", {
            target: "main",
            amount: 4,
            source: p.id,
            action: false,
          }),
          ...(e.after || []),
        );
      } else ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:strike-cancel": {
      delete s.flags[costKey(e.id)];
      break;
    }
    case "mutant-genesis-player:strike-cost": {
      need(
        s.player.form === "hero" &&
          ports.identityHasTrait(s, "X-Men") &&
          ports.canExhaustIdentity(s),
        "Team Strike must exhaust your actual hero as its cost.",
      );
      const allies = readyAllies(s, ports);
      const subsets: Piece[][] = [[]];
      for (const p of allies)
        subsets.push(...subsets.map((group) => [...group, p]));
      ports.choose(
        s,
        "Team Strike",
        "Choose your hero and any number of your ready X-Men allies. They exhaust together when payment is completed.",
        subsets.map((group) =>
          O(
            group.map((p) => p.id).join("+") || "hero",
            group.length
              ? `Hero + ${group.map((p) => card(p).name).join(" + ")}`
              : "Hero only",
            [
              P("strike-stage", {
                id: e.id,
                ids: group.map((p) => p.id),
                after: e.after || [],
              }),
            ],
          ),
        ),
        true,
      );
      break;
    }
    case "mutant-genesis-player:strike-stage": {
      const allies = readyAllies(s, ports);
      need(
        Array.isArray(e.ids) &&
          new Set(e.ids).size === e.ids.length &&
          e.ids.every((id: string) => allies.some((p) => p.id === id)) &&
          ports.canExhaustIdentity(s),
        "Team Strike's distinct selected characters must remain ready and controlled.",
      );
      const ids = [`hero:${s.activePlayerId}`, ...e.ids];
      s.flags[costKey(e.id)] = JSON.stringify({ ids, committed: false });
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "mutant-genesis-player:strike-commit": {
      const p = { id: e.id, code: e.code } as Piece;
      mutantGenesisPlayerPackPaymentPreflight(s, p, ports);
      const receipt = strikeCostReceipt(s, p.id)!;
      ports.exhaustCards(s, receipt.ids);
      s.flags[costKey(p.id)] = JSON.stringify({ ...receipt, committed: true });
      break;
    }
    case "mutant-genesis-player:strike": {
      const paid = strikeCostReceipt(s, e.id);
      need(
        paid?.committed,
        "Team Strike's full resource and exhaust cost must be committed first.",
      );
      const ids = paid!.ids;
      const amount =
        ports.heroAttack(s) +
        ids.reduce((sum, id) => {
          const ally = allInPlay(s).find((p) => p.id === id);
          return (
            sum +
            (ally && card(ally).type_code === "ally"
              ? ports.allyAttack(seatView(s, controller(s, ally.id)!), ally)
              : 0)
          );
        }, 0) +
        (ports.attackEventTotalBonus?.(s, e.id) ??
          mutantGenesisPlayerPackAttackEventBonus(s, e.id));
      // Stun replaces the whole labeled Attack after all additional costs.
      if (s.player.stunned) ports.simultaneousAttack(s, [], []);
      else
        ports.queue(
          s,
          P("strike-assign", { id: e.id, remaining: amount, allocations: [] }),
        );
      break;
    }
    case "mutant-genesis-player:strike-assign": {
      const targets = ports
        .enemyTargets(s, true)
        .filter(
          (t) =>
            !e.allocations.some((a: { target: string }) => a.target === t.id),
        );
      if (e.remaining <= 0 || !targets.length) {
        ports.simultaneousAttack(s, e.allocations, []);
        break;
      }
      targetChoice(
        s,
        "Team Strike",
        targets,
        P("strike-amount", {
          id: e.id,
          remaining: e.remaining,
          allocations: e.allocations,
        }),
        [],
        ports,
      );
      break;
    }
    case "mutant-genesis-player:strike-amount": {
      need(
        ports.enemyTargets(s, true).some((t) => t.id === e.target),
        "This enemy remains subject to Team Strike's ordinary Attack legality.",
      );
      const others = ports
        .enemyTargets(s, true)
        .filter(
          (t) =>
            t.id !== e.target &&
            !e.allocations.some((a: { target: string }) => a.target === t.id),
        );
      const amounts = others.length
        ? Array.from({ length: e.remaining }, (_, i) => i + 1)
        : [e.remaining];
      ports.choose(
        s,
        "Team Strike",
        "Assign damage; all chosen packets resolve simultaneously.",
        amounts.map((amount) =>
          O(String(amount), `${amount} damage`, [
            P("strike-assign", {
              id: e.id,
              remaining: e.remaining - amount,
              allocations: [...e.allocations, { target: e.target, amount }],
            }),
          ]),
        ),
      );
      break;
    }
    case "mutant-genesis-player:mansion": {
      need(
        mutantGenesisPlayerPackAbilityOptions(s, e.id, ports).length,
        "X-Mansion requires a legal actor, ready source and damaged Mutant or X-Men character.",
      );
      const p = allInPlay(s).find((p) => p.id === e.id)!;
      p.exhausted = true;
      targetChoice(
        s,
        "X-Mansion",
        ports
          .friendlyTargets(s)
          .filter(
            (t) =>
              (ports.hasTrait(s, t.id, "Mutant") ||
                ports.hasTrait(s, t.id, "X-Men")) &&
              ports.canHeal(s, t.id),
          ),
        E("heal", { amount: 1 }),
        [],
        ports,
      );
      break;
    }
    default:
      throw Error(`Unknown Mutant Genesis player-pool effect: ${e.type}`);
  }
  return true;
}
