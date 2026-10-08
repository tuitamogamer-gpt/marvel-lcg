import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
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

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const I = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`ironheart:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) =>
  ["ironheart", "riri_williams"].includes(s.heroId);
const definition = (p: Piece) => cards.get(p.code);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const signature = (p: Piece) =>
  definition(p)?.set_code === "ironheart" &&
  definition(p)?.faction_code === "hero" &&
  !["hero", "alter_ego"].includes(definition(p)!.type_code);
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const defaultTextPorts = { isTextBlank };

export const IRONHEART_SCRIPT_CODES = [
  "29001a",
  "29001b",
  "29002a",
  "29002b",
  "29003a",
  "29003b",
  "29004",
  "29005",
  "29006",
  "29007",
  "29008",
  "29009",
  "29010",
  "29011",
  "29012",
  "29013",
  "29028",
  "29029",
  "29030",
  "29031",
  "29032",
] as const;
export const IRONHEART_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/ironheart-riri-williams/";
export const IRONHEART_INSERT_SOURCE =
  "https://hallofheroeslcg.com/wp-content/uploads/2022/04/insert.jpg";
export const IRONHEART_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const IRONHEART_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#ironheart";

export type IronheartVersion = 1 | 2 | 3;
export interface IronheartEventReceipt {
  paid?: Resource[];
  paidForCard?: Resource[];
  playToken?: string;
}
export interface IronheartSpendReceipt {
  /** A unique committed native SPEND instance. Hand discards are not spends. */
  token: string;
  playerId: string;
  piece: Piece;
}
export interface IronheartPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  makePiece(s: GameState, code: string): Piece;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  /** Atomic native ability payment. Commit effects run only once actual costs
   * have been paid, before resource-SPEND response windows. Cancellation pays
   * no cost, uses no Child Prodigy limit, and does not run after. */
  payAbility(
    s: GameState,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    commit?: Effect[],
  ): void;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  /** Native actual initiated attack, all prevention/defeats, then completion
   * with defeatedEnemy from THIS attack. A different effect's later defeat
   * does not qualify. Retain ordinary attack response windows. */
  attack(
    s: GameState,
    target: string,
    amount: number,
    continuation: Effect,
  ): void;
  /** Native actual thwart, then completion with removed and
   * lastThreatRemoved. Last threat must be removed by THIS thwart, not merely
   * absent because another effect removed the scheme. */
  thwart(
    s: GameState,
    target: string,
    amount: number,
    continuation: Effect,
  ): void;
  /** Reveal the actual top count original deck cards without drawing them.
   * The continuation receives ids in original order. Fewer cards is legal;
   * looking does not reset an empty deck or open draw windows. */
  lookPlayerDeck(s: GameState, count: number, continuation: Effect): void;
  /** Actual deck-to-hand addition, not a draw. */
  addDeckCardToHand(s: GameState, id: string): void;
  discardDeckCard(s: GameState, id: string): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  /** Actual minion traits, including continuous gained traits and native
   * synthetic drones, for Cyborg Tech's highest-trait count. */
  enemyTraits(s: GameState, p: Piece): string[];
  attachEncounter(s: GameState, p: Piece, targetId: string): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  discardEncounter(s: GameState, p: Piece): void;
  /** Move this same obligation from its actual controlled/resolving zone into
   * the encounter deck and shuffle once. This is not removal from the game. */
  shuffleObligationIntoEncounter(s: GameState, p: Piece): void;
  dealEncounter(s: GameState, playerId: string): void;
  /** Move this exact boost source from pending boost cleanup to that
   * player's dealt zone; never generate an additional copy. */
  dealBoostCard(s: GameState, p: Piece, playerId: string): void;
  enemyScheme(s: GameState, id: string, continuation: Effect): void;
  placeThreat(s: GameState, target: string, amount: number): void;
  revealEncounter(s: GameState, p: Piece, after: Effect[]): void;
}

export function ironheartVersion(s: GameState): IronheartVersion {
  const code = s.player.ironheartIdentity?.code;
  return code === "29003a"
    ? 3
    : code === "29002a"
      ? 2
      : code === "29001a"
        ? 1
        : Number(s.flags.ironheartVersion) === 3
          ? 3
          : Number(s.flags.ironheartVersion) === 2
            ? 2
            : 1;
}
export function ironheartIdentityCode(
  s: GameState,
  form: "hero" | "alter" = s.player.form,
): string {
  return `2900${ironheartVersion(s)}${form === "hero" ? "a" : "b"}`;
}
export function ironheartIdentityPiece(s: GameState): Piece | undefined {
  return s.player.ironheartIdentity;
}
export function ironheartProgress(s: GameState): number {
  return active(s)
    ? Math.max(0, Number(s.player.ironheartIdentity?.counters || 0))
    : 0;
}
function placeProgress(s: GameState, amount: number): void {
  need(
    active(s) && s.player.ironheartIdentity,
    "Progress counters require the actual Ironheart identity.",
  );
  s.player.ironheartIdentity!.counters = ironheartProgress(s) + amount;
}
function removeProgress(s: GameState, amount: number): void {
  need(
    Number.isInteger(amount) &&
      amount >= 0 &&
      ironheartProgress(s) >= amount &&
      s.player.ironheartIdentity,
    "Ironheart cannot pay this progress-counter cost.",
  );
  s.player.ironheartIdentity!.counters = ironheartProgress(s) - amount;
}

/** Fresh setup allocates three physical linked identity cards, never six
 * faces and never deck cards. Setup/migration must not call this on a save
 * whose reserved physical pieces have already left their original zone. */
export function ironheartInitialize(
  s: GameState,
  ports: Pick<IronheartPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.ironheartInitialized) return;
  s.player.ironheartIdentity ||= ports.makePiece(s, "29001a");
  s.flags.ironheartVersion = ironheartVersion(s);
  const zone = (s.player.setAside ||= []);
  for (const code of ["29002a", "29003a"])
    if (
      !zone.some((p) => p.code === code) &&
      s.player.ironheartIdentity.code !== code
    )
      zone.push(ports.makePiece(s, code));
  for (const [code, count] of Object.entries({
    "29030": 1,
    "29029": 1,
    "29031": 1,
    "29032": 2,
  }))
    for (let n = zone.filter((p) => p.code === code).length; n < count; n++)
      zone.push(ports.makePiece(s, code));
  s.flags.ironheartInitialized = true;
}

/** All existing game elements remain with the same shared identity state.
 * Only the physical current card changes. The old card is actually returned
 * to set-aside and the original next card is taken out; IDs are conserved. */
function swapVersion(s: GameState, expected: IronheartVersion): void {
  const old = s.player.ironheartIdentity;
  const zone = s.player.setAside || [];
  const index = zone.findIndex((p) => p.code === `2900${expected}a`);
  if (!old || index < 0) return;
  const next = zone.splice(index, 1)[0];
  const oldId = old.id;
  const oldCode = old.code;
  const elements = { ...old };
  s.player.ironheartIdentity = {
    ...next,
    ...elements,
    id: next.id,
    code: next.code,
  };
  zone.push({
    id: oldId,
    code: oldCode,
    ownerId: old.ownerId,
    counters: 0,
    damage: 0,
    exhausted: false,
    tough: false,
    stunned: false,
    confused: false,
  });
  for (const p of [...allInPlay(s), ...s.attachments])
    if (p.attachedTo === oldId) p.attachedTo = next.id;
  s.flags.ironheartVersion = expected;
}

export function ironheartSignatureHPBonus(
  s: GameState,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
): number {
  return (
    s.player.inPlay.filter(
      (p) => ["29012", "29013"].includes(p.code) && !ports.isTextBlank(s, p),
    ).length * 2
  );
}
export function ironheartCostReduction(s: GameState, p: Piece): number {
  return active(s) && p.code === "29008" ? ironheartVersion(s) : 0;
}
export function ironheartEncounterTopVisible(s: GameState): boolean {
  return s.flags.ironheartSectorScanRound === s.round;
}

export function ironheartResourceSources(
  s: GameState,
  _targetCode?: string,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "29004" &&
        p.exhausted &&
        !ports.isTextBlank(s, p) &&
        s.flags[`ironheartBrawn:${p.id}`] !== phaseKey(s),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Brawn",
      resources: ["mental"],
      kind: "ability",
      description:
        "Generate 1 mental while Brawn is exhausted · once per phase",
    }));
}
export function ironheartResourceSpent(
  s: GameState,
  id: string,
  _targetCode?: string,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
): boolean {
  const p = own(s, id, "29004");
  if (!p) return false;
  need(
    p.exhausted &&
      !ports.isTextBlank(s, p) &&
      s.flags[`ironheartBrawn:${p.id}`] !== phaseKey(s),
    "Brawn requires an exhausted, unblanked ally and is once per phase.",
  );
  s.flags[`ironheartBrawn:${p.id}`] = phaseKey(s);
  return true;
}
export function ironheartResourceCardSpent(
  s: GameState,
  receipt: IronheartSpendReceipt,
): Effect[] {
  if (
    !active(s) ||
    receipt.playerId !== s.activePlayerId ||
    (receipt.piece.ownerId && receipt.piece.ownerId !== receipt.playerId) ||
    receipt.piece.code !== "29009" ||
    !receipt.token ||
    s.flags[`ironheartStroke:${receipt.token}`]
  )
    return [];
  return [
    E("optional", {
      title: "Stroke of Genius",
      text: "Place 1 progress counter on your identity and draw 1 card?",
      effects: [I("stroke", { receipt })],
    }),
  ];
}

export function ironheartEventAction(
  p: Piece,
): "attack" | "thwart" | undefined {
  return p.code === "29006"
    ? "attack"
    : p.code === "29005"
      ? "thwart"
      : undefined;
}
export function ironheartEvent(
  _s: GameState,
  p: Piece,
  _receipt: IronheartEventReceipt = {},
  target?: string,
): Effect[] | null {
  return ["29005", "29006", "29007", "29008"].includes(p.code)
    ? [I("event", { piece: p, target })]
    : null;
}
export function ironheartPlayRestriction(
  s: GameState,
  p: Piece,
  ports: Pick<
    IronheartPorts,
    "enemyTargets" | "schemeTargets" | "canReadyIdentity" | "canGiveStatus"
  >,
): string | null {
  if (!["29005", "29006", "29007", "29008"].includes(p.code)) return null;
  if (!active(s) || s.player.form !== "hero")
    return "This Ironheart event requires hero form.";
  if (
    p.code === "29005" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Fly Over needs a legal scheme with threat.";
  if (
    p.code === "29006" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "Photon Beam needs a legal enemy.";
  if (
    p.code === "29007" &&
    !s.player.deck.length &&
    !ports.canGiveStatus(s, "hero", "tough") &&
    !ports.canReadyIdentity(s, s.activePlayerId)
  )
    return "New and Improved needs an option that can change the game.";
  return null;
}

const prodigyKey = (s: GameState) =>
  `ironheartProdigy:${s.player.ironheartIdentity?.id || "identity"}`;
export function ironheartAbilityOptions(
  s: GameState,
  id: string,
  ports: IronheartPorts,
): Option[] {
  if (id === "hero") {
    if (
      !active(s) ||
      !s.player.ironheartIdentity ||
      ports.isIdentityTextBlank?.(s)
    )
      return [];
    const version = ironheartVersion(s);
    if (s.player.form === "alter") {
      const affordable =
        version === 1
          ? ports.canPay(s, 1, ["mental"])
          : version === 2
            ? ports.canPay(s, 1, ["mental"]) || ports.canPay(s, 2)
            : ports.canPay(s, 1);
      return affordable && s.flags[prodigyKey(s)] !== s.round
        ? [
            O(
              "ironheart-child-prodigy",
              "Child Prodigy · gain 1 progress",
              [I("prodigy")],
              ironheartIdentityCode(s),
            ),
          ]
        : [];
    }
    if (version < 3)
      return ironheartProgress(s) >= 6 &&
        s.player.setAside?.some((p) => p.code === `2900${version + 1}a`)
        ? [
            O(
              "ironheart-level-up",
              `Level Up! · spend 6 progress for Version ${version + 1}`,
              [I("level-up")],
              ironheartIdentityCode(s),
            ),
          ]
        : [];
    return ironheartProgress(s) >= 1 && ports.enemyTargets(s, false).length
      ? [
          O(
            "ironheart-maximum-efficiency",
            "Maximum Efficiency · spend 1 progress to deal 2 damage",
            [I("maximum")],
            ironheartIdentityCode(s),
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (p.code === "29010" && active(s) && s.player.form === "alter")
    return [
      O(
        "ironheart-ronnie",
        "Ronnie Williams · heal 2 or gain 1 progress",
        [I("ronnie", { id })],
        p.code,
      ),
    ];
  if (p.code === "29011" && s.player.deck.length)
    return [
      O(
        "ironheart-tony",
        "Tony Stark A.I. · look at the top 2 cards",
        [I("tony", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "29012" &&
    active(s) &&
    s.player.form === "hero" &&
    ports.enemyTargets(s, false).length
  )
    return [
      O(
        "ironheart-blasters",
        `Photon Blasters · deal ${ironheartVersion(s)} damage`,
        [I("blasters", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "29013" &&
    active(s) &&
    s.player.form === "hero" &&
    ports.schemeTargets(s, false).length
  )
    return [
      O(
        "ironheart-jets",
        `Propulsion Jets · remove ${ironheartVersion(s)} threat`,
        [I("jets", { id })],
        p.code,
      ),
    ];
  return [];
}
export function ironheartAbility(
  s: GameState,
  id: string,
  ports: IronheartPorts,
): boolean {
  if (
    id !== "hero" &&
    !own(s, id, "29010") &&
    !own(s, id, "29011") &&
    !own(s, id, "29012") &&
    !own(s, id, "29013")
  )
    return false;
  if (id === "hero" && !active(s)) return false;
  const options = ironheartAbilityOptions(s, id, ports);
  need(options.length, "This Ironheart ability is unavailable.");
  ports.queue(s, ...options[0].effects);
  return true;
}

export function ironheartEnemyStats(
  s: GameState,
  p: Piece,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
) {
  const lucia =
    p.code === "29030" && p.tough && !ports.isTextBlank(s, p) ? 1 : 0;
  const tech = s.attachments.filter(
    (a) =>
      a.code === "29031" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
  ).length;
  return { attack: lucia, scheme: lucia, health: tech * 3 };
}
export function ironheartEnemyKeywords(
  s: GameState,
  p: Piece,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
) {
  return {
    retaliate: s.attachments.filter(
      (a) =>
        a.code === "29031" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
    ).length,
  };
}
export function ironheartSchemeIcons(
  s: GameState,
  p: Piece,
  ports: Pick<IronheartPorts, "isTextBlank"> = defaultTextPorts,
) {
  if (p.code !== "29029" || ports.isTextBlank(s, p))
    return { hazard: 0, acceleration: 0 };
  const lucia = s.minions.some((p) => p.code === "29030");
  return { hazard: Number(lucia), acceleration: Number(!lucia) };
}
export function ironheartVillainPhaseEnded(
  s: GameState,
  ports: Pick<IronheartPorts, "isTextBlank" | "canGiveStatus">,
): Effect[] {
  return s.minions
    .filter(
      (p) =>
        p.code === "29030" &&
        !ports.isTextBlank(s, p) &&
        ports.canGiveStatus(s, p.id, "tough"),
    )
    .map((p) => E("status", { target: p.id, status: "tough" }));
}
export function ironheartShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [];
  const minion = zone.find((p) => p.code === "29030");
  const scheme = zone.find((p) => p.code === "29029");
  const rest = zone.filter((p) => ["29031", "29032"].includes(p.code));
  return [
    ...[minion, scheme]
      .filter((p): p is Piece => !!p)
      .map((p) => I("reveal-setaside", { id: p.id })),
    I("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!minion ? [E("surge", { sourceCode: "01190" })] : []),
  ];
}
export function ironheartEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "29028": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner
        ? [I("obligation", { piece: p, actorId: owner.id, playerId: owner.id })]
        : [];
    }
    case "29029":
    case "29030":
      return [];
    case "29031":
      return [I("cyborg-tech", { piece: p })];
    case "29032":
      return [I("political", { piece: p })];
    default:
      return null;
  }
}
export function ironheartBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "29031"
    ? [I("boost-tech", { piece: p })]
    : ["29028", "29029", "29030", "29032"].includes(p.code)
      ? []
      : null;
}

function chooseTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: IronheartPorts,
): void {
  if (!targets.length) {
    ports.queue(s, ...after);
    return;
  }
  if (targets.length === 1) {
    ports.queue(s, { ...effect, target: targets[0].id });
    return;
  }
  ports.choose(
    s,
    title,
    "Choose an eligible target.",
    targets.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
  );
}
function abilityPiece(
  s: GameState,
  id: string,
  code: string,
  ports: IronheartPorts,
): Piece {
  const p = own(s, id, code);
  need(
    p && !p.exhausted && !ports.isTextBlank(s, p),
    "This ability requires the actual ready, unblanked controlled card.",
  );
  return p!;
}

export function resolveIronheartEffect(
  s: GameState,
  e: Effect,
  ports: IronheartPorts,
): boolean {
  if (!e.type.startsWith("ironheart:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "ironheart:prodigy": {
      need(
        ironheartAbilityOptions(s, "hero", ports).some(
          (o) => o.id === "ironheart-child-prodigy",
        ),
        "Child Prodigy is unavailable.",
      );
      const version = ironheartVersion(s);
      const paid = [I("prodigy-gain", { after })];
      const commit = [
        I("prodigy-commit", {
          identityId: s.player.ironheartIdentity!.id,
          version,
        }),
      ];
      if (version !== 2)
        ports.payAbility(s, 1, version === 1 ? ["mental"] : [], paid, commit);
      else
        ports.choose(s, "Child Prodigy", "Choose its resource cost.", [
          ...(ports.canPay(s, 1, ["mental"])
            ? [
                O("mental", "Spend 1 mental resource", [
                  I("prodigy-pay", {
                    cost: 1,
                    requirements: ["mental"],
                    paid,
                    commit,
                  }),
                ]),
              ]
            : []),
          ...(ports.canPay(s, 2)
            ? [
                O("any", "Spend 2 resources of any type", [
                  I("prodigy-pay", { cost: 2, requirements: [], paid, commit }),
                ]),
              ]
            : []),
        ]);
      break;
    }
    case "ironheart:prodigy-pay":
      ports.payAbility(s, e.cost, e.requirements, e.paid, e.commit);
      break;
    case "ironheart:prodigy-commit":
      need(
        s.flags[`ironheartProdigy:${e.identityId}`] !== s.round,
        "Child Prodigy is once per round on this physical identity.",
      );
      s.flags[`ironheartProdigy:${e.identityId}`] = s.round;
      break;
    case "ironheart:prodigy-gain":
      // Form qualifiers were checked at initiation. Resource responses can
      // change form before this effect without canceling its paid ability.
      if (active(s) && s.player.ironheartIdentity) placeProgress(s, 1);
      ports.queue(s, ...after);
      break;
    case "ironheart:level-up": {
      const version = ironheartVersion(s);
      need(
        active(s) &&
          s.player.form === "hero" &&
          !ports.isIdentityTextBlank?.(s) &&
          version < 3 &&
          ironheartProgress(s) >= 6 &&
          s.player.setAside?.some((p) => p.code === `2900${version + 1}a`),
        "Level Up! needs hero form, 6 actual progress counters, and the actual next identity.",
      );
      removeProgress(s, 6);
      ports.queue(
        s,
        ...(ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: "hero" })]
          : []),
        ...(version === 2 && ports.canGiveStatus(s, "hero", "tough")
          ? [E("status", { target: "hero", status: "tough" })]
          : []),
        I("swap-version", { version: version + 1, after }),
      );
      break;
    }
    case "ironheart:swap-version":
      swapVersion(s, e.version);
      ports.queue(s, ...after);
      break;
    case "ironheart:maximum":
      need(
        ironheartAbilityOptions(s, "hero", ports).some(
          (o) => o.id === "ironheart-maximum-efficiency",
        ),
        "Maximum Efficiency is unavailable.",
      );
      removeProgress(s, 1);
      chooseTarget(
        s,
        "Maximum Efficiency",
        ports.enemyTargets(s, false),
        I("nonattack-target", { amount: 2, after }),
        after,
        ports,
      );
      break;
    case "ironheart:nonattack-target":
      if (ports.enemyTargets(s, false).some((t) => t.id === e.target))
        ports.queue(
          s,
          E("damage", { target: e.target, amount: e.amount, source: "hero" }),
          ...after,
        );
      else ports.queue(s, ...after);
      break;
    case "ironheart:stroke": {
      const receipt: IronheartSpendReceipt = e.receipt;
      need(
        active(s) &&
          receipt.playerId === s.activePlayerId &&
          (!receipt.piece.ownerId ||
            receipt.piece.ownerId === receipt.playerId) &&
          receipt.piece.code === "29009" &&
          !!receipt.token &&
          !s.flags[`ironheartStroke:${receipt.token}`],
        "Stroke of Genius needs an actual new spend of this card.",
      );
      s.flags[`ironheartStroke:${receipt.token}`] = true;
      placeProgress(s, 1);
      ports.queue(s, E("draw", { amount: 1 }), ...after);
      break;
    }
    case "ironheart:event": {
      const p: Piece = e.piece;
      // The host validates Hero Action when PLAY starts. Never recheck form
      // after its resource costs and their SPEND responses have resolved.
      if (p.code === "29008") {
        s.flags.ironheartSectorScanRound = s.round;
        ports.queue(s, ...after);
        break;
      }
      if (p.code === "29007") {
        ports.queue(
          s,
          I("improved-choose", {
            remaining: ironheartVersion(s),
            selected: [],
            after,
          }),
        );
        break;
      }
      const action = ironheartEventAction(p);
      if (action === "attack" && s.player.stunned) {
        consumeStatus(s.player, "stunned");
        ports.queue(s, ...after);
        break;
      }
      if (action === "thwart" && s.player.confused) {
        consumeStatus(s.player, "confused");
        ports.queue(s, ...after);
        break;
      }
      const targets =
        action === "attack"
          ? ports.enemyTargets(s, true)
          : ports.schemeTargets(s, true);
      if (e.target && targets.some((t) => t.id === e.target))
        ports.queue(
          s,
          I("event-target", { piece: p, target: e.target, after }),
        );
      else
        chooseTarget(
          s,
          definition(p)!.name,
          targets,
          I("event-target", { piece: p, after }),
          [I("progress", { amount: 1, after })],
          ports,
        );
      break;
    }
    case "ironheart:event-target": {
      const p: Piece = e.piece;
      const action = ironheartEventAction(p);
      const legal = (
        action === "attack"
          ? ports.enemyTargets(s, true)
          : ports.schemeTargets(s, true)
      ).some((t) => t.id === e.target);
      if (!legal) {
        ports.queue(s, I("progress", { amount: 1, after }));
        break;
      }
      if (action === "attack")
        ports.attack(s, e.target, 4, I("photon-complete", { after }));
      else ports.thwart(s, e.target, 3, I("fly-complete", { after }));
      break;
    }
    case "ironheart:photon-complete":
      placeProgress(s, e.defeatedEnemy ? 2 : 1);
      ports.queue(s, ...after);
      break;
    case "ironheart:fly-complete":
      placeProgress(
        s,
        Number(e.removed || 0) > 0 && e.lastThreatRemoved ? 2 : 1,
      );
      ports.queue(s, ...after);
      break;
    case "ironheart:progress":
      if (active(s) && s.player.ironheartIdentity) placeProgress(s, e.amount);
      ports.queue(s, ...after);
      break;
    case "ironheart:improved-choose": {
      const selected: string[] = e.selected || [];
      if (e.remaining <= 0) {
        ports.queue(
          s,
          ...selected.map((kind) => I(`improved-${kind}`)),
          ...after,
        );
        break;
      }
      ports.choose(
        s,
        "New and Improved",
        `Choose ${e.remaining} more different option${e.remaining === 1 ? "" : "s"}.`,
        [
          ["search", "Search your deck for an Ironheart card"],
          ["tough", "Give Ironheart a tough status"],
          ["ready", "Ready Ironheart"],
        ]
          .filter(([kind]) => !selected.includes(kind))
          .map(([kind, label]) =>
            O(kind, label, [
              I("improved-choose", {
                remaining: e.remaining - 1,
                selected: [...selected, kind],
                after,
              }),
            ]),
          ),
      );
      break;
    }
    case "ironheart:improved-search": {
      const eligible = s.player.deck.filter(signature);
      ports.choose(
        s,
        "New and Improved",
        "Search your deck for an Ironheart card, then shuffle.",
        [
          ...eligible.map((p) =>
            O(
              p.id,
              definition(p)!.name,
              [I("improved-add", { id: p.id, after })],
              p.code,
            ),
          ),
          O("no-card", "Finish search without finding a card", [
            I("improved-add", { after }),
          ]),
        ],
      );
      break;
    }
    case "ironheart:improved-add":
      if (e.id && s.player.deck.some((p) => p.id === e.id && signature(p)))
        ports.addDeckCardToHand(s, e.id);
      ports.shufflePlayerDeck(s, after);
      break;
    case "ironheart:improved-tough":
      ports.queue(
        s,
        ...(ports.canGiveStatus(s, "hero", "tough")
          ? [E("status", { target: "hero", status: "tough" })]
          : []),
        ...after,
      );
      break;
    case "ironheart:improved-ready":
      ports.queue(
        s,
        ...(ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: "hero" })]
          : []),
        ...after,
      );
      break;
    case "ironheart:ronnie": {
      need(
        active(s) && s.player.form === "alter",
        "Ronnie Williams requires alter-ego form at initiation.",
      );
      const p = abilityPiece(s, e.id, "29010", ports);
      p.exhausted = true;
      ports.choose(s, "Ronnie Williams", "Choose an effect.", [
        O("heal", "Heal 2 damage from Riri Williams", [
          E("heal", { target: "hero", amount: 2 }),
          ...after,
        ]),
        O("progress", "Place 1 progress counter", [
          I("progress", { amount: 1, after }),
        ]),
      ]);
      break;
    }
    case "ironheart:tony": {
      const p = abilityPiece(s, e.id, "29011", ports);
      need(
        s.player.deck.length,
        "Tony Stark A.I. needs an actual deck card to look at.",
      );
      p.exhausted = true;
      ports.lookPlayerDeck(s, 2, I("tony-looked", { after }));
      break;
    }
    case "ironheart:tony-looked": {
      const ids: string[] = e.ids || [];
      const top = ids.flatMap((id) => s.player.deck.filter((p) => p.id === id));
      if (!top.length) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Tony Stark A.I.",
        "Add one looked-at card to your hand and discard the other.",
        top.map((p) =>
          O(
            p.id,
            definition(p)?.name || p.code,
            [I("tony-take", { id: p.id, ids, after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "ironheart:tony-take":
      need(
        (e.ids || []).includes(e.id) &&
          s.player.deck.some((p) => p.id === e.id),
        "Choose one of the actual looked-at cards.",
      );
      ports.addDeckCardToHand(s, e.id);
      for (const id of e.ids || [])
        if (id !== e.id && s.player.deck.some((p) => p.id === id))
          ports.discardDeckCard(s, id);
      ports.queue(s, ...after);
      break;
    case "ironheart:blasters": {
      need(
        active(s) &&
          s.player.form === "hero" &&
          ports.enemyTargets(s, false).length,
        "Photon Blasters requires hero form and a legal enemy at initiation.",
      );
      abilityPiece(s, e.id, "29012", ports).exhausted = true;
      chooseTarget(
        s,
        "Photon Blasters",
        ports.enemyTargets(s, false),
        I("nonattack-target", { amount: ironheartVersion(s), after }),
        after,
        ports,
      );
      break;
    }
    case "ironheart:jets": {
      need(
        active(s) &&
          s.player.form === "hero" &&
          ports.schemeTargets(s, false).length,
        "Propulsion Jets requires hero form and a legal scheme at initiation.",
      );
      abilityPiece(s, e.id, "29013", ports).exhausted = true;
      chooseTarget(
        s,
        "Propulsion Jets",
        ports.schemeTargets(s, false),
        I("jets-target", { amount: ironheartVersion(s), after }),
        after,
        ports,
      );
      break;
    }
    case "ironheart:jets-target":
      if (ports.schemeTargets(s, false).some((t) => t.id === e.target))
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: e.amount,
            action: false,
            source: "hero",
          }),
          ...after,
        );
      else ports.queue(s, ...after);
      break;
    case "ironheart:obligation": {
      const p: Piece = e.piece;
      ports.giveObligation(s, p, e.playerId || s.activePlayerId);
      if (ironheartProgress(s) > 0) {
        removeProgress(s, 1);
        ports.discardEncounter(s, p);
      } else {
        ports.dealEncounter(s, e.playerId || s.activePlayerId);
        ports.shuffleObligationIntoEncounter(s, p);
      }
      ports.queue(s, ...after);
      break;
    }
    case "ironheart:cyborg-tech": {
      const counts = s.minions.map((p) => ({
        p,
        count: new Set(ports.enemyTraits(s, p).map((t) => t.toLowerCase()))
          .size,
      }));
      const maximum = Math.max(-1, ...counts.map((x) => x.count));
      const targets = counts
        .filter((x) => x.count === maximum)
        .map(({ p }) => ({
          id: p.id,
          label: definition(p)?.name || p.code,
          code: p.code,
        }));
      chooseTarget(
        s,
        "Cyborg Tech",
        targets,
        I("attach-tech", { piece: e.piece, after }),
        [E("surge", { sourceCode: "29031" }), ...after],
        ports,
      );
      break;
    }
    case "ironheart:attach-tech":
      if (s.minions.some((p) => p.id === e.target))
        ports.attachEncounter(s, e.piece, e.target);
      else ports.queue(s, E("surge", { sourceCode: "29031" }));
      ports.queue(s, ...after);
      break;
    case "ironheart:political": {
      const lucia = s.minions.find((p) => p.code === "29030");
      const rule = s.sideSchemes.find((p) => p.code === "29029");
      if (!lucia && !rule) {
        ports.queue(s, E("surge", { sourceCode: "29032" }), ...after);
        break;
      }
      if (lucia)
        ports.enemyScheme(s, lucia.id, I("political-threat", { after }));
      else ports.queue(s, I("political-threat", { after }));
      break;
    }
    case "ironheart:political-threat": {
      const rule = s.sideSchemes.find((p) => p.code === "29029");
      if (rule) ports.placeThreat(s, rule.id, 3);
      ports.queue(s, ...after);
      break;
    }
    case "ironheart:boost-tech":
      ports.dealBoostCard(s, e.piece, s.activePlayerId);
      ports.queue(s, ...after);
      break;
    case "ironheart:reveal-setaside": {
      const zone = s.player.setAside || [];
      const index = zone.findIndex((p) => p.id === e.id);
      if (index >= 0) ports.revealEncounter(s, zone.splice(index, 1)[0], after);
      else ports.queue(s, ...after);
      break;
    }
    case "ironheart:shuffle-nemesis": {
      const ids: string[] = e.ids || [];
      const zone = s.player.setAside || [];
      for (const id of ids) {
        const index = zone.findIndex((p) => p.id === id);
        if (index >= 0) s.encounter.deck.push(zone.splice(index, 1)[0]);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    }
    default:
      return false;
  }
  return true;
}
