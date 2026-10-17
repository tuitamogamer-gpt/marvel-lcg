import { rulesCode } from "./rules-code.js";
import raw from "../data/catalog-cards.json" with { type: "json" };
import core from "../data/core-player.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const definitions = new Map(
  ([...raw, ...core] as Card[]).map((c) => [c.code, c]),
);
const card = (p: Pick<Piece, "code">) => definitions.get(p.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`spider-ham-pack:${type}`, { ...args, type: `spider-ham-pack:${type}` });
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
  s.player.inPlay.find((p) => p.id === id && (!code || rulesCode(p) === code));
const normalize = (s: GameState, id: string) =>
  id === "hero" ? `hero:${s.activePlayerId}` : id;
const windowKey = (token: string, id: string) =>
  `spiderHamPackResponse:${token}:${id}`;
const attackKey = (id: string) => `spiderHamPackWarrior:${id}`;
const afterOf = (e: Effect): Effect[] => e.after || [];

export const SPIDER_HAM_PACK_CORE_ALIASES = ["30015"] as const;
export const SPIDER_HAM_PACK_CORE_ALIAS_PAIRS = [["30015", "01061"]] as const;
export const SPIDER_HAM_PACK_SCRIPT_CODES = [
  "30012",
  "30013",
  "30014",
  "30016",
  "30017",
  "30018",
  "30019",
  "30020",
  "30021",
  "30022",
  "30023",
  "30029",
] as const;

/** amount is the actual threat removed, after prevention and remaining threat
 * caps. target is the original physical scheme (or main), even if defeated. */
export interface SpiderHamPackThwartReceipt {
  token: string;
  playerId: string;
  sourceId: string;
  target: string;
  amount: number;
  performed: boolean;
  thwart: boolean;
  basic?: boolean;
  removedAllThreat?: boolean;
}
export interface SpiderHamPackRevealReceipt {
  token: string;
  playerId: string;
  pieceId: string;
}
export interface SpiderHamPackLeaveReceipt {
  token: string;
  playerId: string;
  pieceId: string;
  code: string;
  traits: string[];
  typeCode?: string;
}
export interface SpiderHamPackDefeatReceipt {
  token: string;
  playerId: string;
  consequential: boolean;
  /** Actual damage taken and HP remaining immediately before that packet. */
  amount: number;
  remainingHP: number;
  textBlank: boolean;
}
export interface SpiderHamPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  traits(s: GameState, p: Piece): string[];
  controlledTraitCards(s: GameState, trait: string): AntManTarget[];
  /** Current identity titles and allies, including other surviving players. */
  characterTargets(s: GameState): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  handPlayableCards?(s: GameState): Piece[];
  canPlayWithDiscount(
    s: GameState,
    p: Piece,
    discount: number,
    exhaustId?: string,
  ): boolean;
  playFromHand(
    s: GameState,
    id: string,
    discount: number,
    after: Effect[],
  ): void;
  discardControlled(s: GameState, id: string, after: Effect[]): void;
  attach(s: GameState, id: string, target: string): void;
  /** Unlabelled printed removal: never starts a thwart or Overwatch window. */
  removeThreat(
    s: GameState,
    target: string,
    amount: number,
    source: string,
    after: Effect[],
  ): void;
  /** Simultaneous actual THW removals, then all defeat windows, then after.
   * Resume after records with actual defeatedIds, never infer from zero threat. */
  thwartBatch(
    s: GameState,
    targets: { id: string; amount: number }[],
    sourceId: string,
    after: Effect[],
  ): void;
  /** Mutate this exact resumable basic-thwart packet's amount/modifier. */
  addBasicThwartBonus(s: GameState, packet: Effect, amount: number): void;
  playThwartInterrupt(
    s: GameState,
    id: string,
    packet: Effect,
    after: Effect[],
  ): void;
  revealHidden(s: GameState): void;
  /** Look at the exact still-pending card after type naming; do not remove,
   * clone, reveal its ability, replace it, or predict a subsequent top card. */
  revealAvailable(s: GameState, receipt: SpiderHamPackRevealReceipt): boolean;
  lookEncounter(s: GameState, actualPieceId: string): string;
  revealEncounterFromDeck(s: GameState, id: string, after: Effect[]): void;
  shuffleEncounter(s: GameState, after: Effect[]): void;
  damageAlly(s: GameState, id: string, amount: number, after: Effect[]): void;
  /** Move the exact defeated instance to its original owner's hand. Native
   * cleanup must not subsequently also discard that returned card. */
  returnDefeatedAlly(s: GameState, piece: Piece, ownerId: string): void;
}

function chooseTarget(
  s: GameState,
  title: string,
  list: AntManTarget[],
  effect: Effect,
  ports: SpiderHamPackPorts,
  after: Effect[] = [],
) {
  if (list.length)
    ports.choose(
      s,
      title,
      "Choose an actual legal target.",
      list.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
    );
  else ports.queue(s, ...after);
}
function others(s: GameState, id: string, ports: SpiderHamPackPorts) {
  return ports.schemeTargets(s, false).filter((t) => t.id !== id);
}
function maxOneWayUsed(s: GameState) {
  return s.players.some((seat) => {
    const f = seatView(s, seat).flags;
    return (
      f.spiderHamPackOneWayRound === s.round ||
      f.nebulaPackOneWayRound === s.round
    );
  });
}
const hand = (s: GameState, ports: SpiderHamPackPorts) =>
  ports.handPlayableCards?.(s) || s.player.hand;
function matchingHand(s: GameState, support: Piece, ports: SpiderHamPackPorts) {
  return s.player.hand.filter(
    (p) =>
      ports
        .traits(s, p)
        .some((t) => ports.hasTrait(s, `hero:${s.activePlayerId}`, t)) &&
      ports.canPlayWithDiscount(s, p, 1, support.id),
  );
}
function namedAttachments(
  s: GameState,
  target: string,
  name: string,
  exclude?: string,
) {
  return allInPlay(s).filter(
    (p) =>
      p.id !== exclude && p.attachedTo === target && card(p)?.name === name,
  );
}
function trigger(
  s: GameState,
  p: Piece,
  token: string,
  title: string,
  effect: Effect,
): Effect[] {
  const owner = controller(s, p.id);
  if (!owner || seatView(s, owner).flags[windowKey(token, p.id)]) return [];
  return [
    E("optional", {
      title,
      image: p.code,
      actorId: owner.id,
      effects: [{ ...effect, actorId: owner.id }],
    }),
  ];
}

export function spiderHamPackRequirements(p: Piece): Resource[] {
  return rulesCode(p) === "30014" ? ["energy"] : [];
}
export function spiderHamPackCostReduction(
  s: GameState,
  p: Piece,
  ports: SpiderHamPackPorts,
) {
  return p.code === "30023" &&
    ports.hasTrait(s, `hero:${s.activePlayerId}`, "Web-Warrior")
    ? Number(card(p).cost || 0)
    : 0;
}
export function spiderHamPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SpiderHamPackPorts,
): string | null {
  if (
    ["30020", "30021"].includes(p.code) &&
    !ports.controlledTraitCards(s, "Web-Warrior").length
  )
    return "Control a Web-Warrior card to play this ally.";
  if (
    p.code === "30017" &&
    (s.player.form !== "hero" ||
      maxOneWayUsed(s) ||
      !s.encounter.deck.some((p) => card(p)?.type_code === "side_scheme"))
  )
    return "One Way or Another needs hero form, an unused maximum and a side scheme in the encounter deck.";
  if (
    rulesCode(p) === "30014" &&
    (s.player.form !== "hero" ||
      !ports
        .schemeTargets(s, true)
        .some((t) => s.sideSchemes.some((p) => p.id === t.id)))
  )
    return "Even the Odds needs hero form and a side scheme you can thwart.";
  if (p.code === "30016")
    return "Making an Entrance is played in a native basic thwart interrupt.";
  if (
    ["30018", "30019", "30029"].includes(rulesCode(p)) &&
    !spiderHamPackAttachmentTargets(s, p, ports)?.length
  )
    return "This upgrade needs a legal attachment target without another copy.";
  return null;
}
export function spiderHamPackAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: SpiderHamPackPorts,
): AntManTarget[] | null {
  if (p.code === "30029")
    return ports
      .characterTargets(s)
      .filter(
        (t) =>
          t.label.includes("Spider") &&
          !namedAttachments(s, normalize(s, t.id), card(p).name, p.id).length,
      );
  if (p.code === "30018")
    return s.sideSchemes
      .filter((t) => !namedAttachments(s, t.id, card(p).name, p.id).length)
      .map((t) => ({ id: t.id, label: card(t).name, code: t.code }));
  if (rulesCode(p) === "30019")
    return [
      {
        id: "main",
        label: card({ code: s.scheme.code }).name,
        code: s.scheme.code,
      },
      ...s.sideSchemes.map((t) => ({
        id: t.id,
        label: card(t).name,
        code: t.code,
      })),
    ].filter((t) => !namedAttachments(s, t.id, card(p).name, p.id).length);
  return null;
}
export function spiderHamPackCardEntered(_s: GameState, p: Piece): Effect[] {
  return ["30018", "30019", "30029"].includes(rulesCode(p)) && !p.attachedTo
    ? [P("attach", { id: p.id })]
    : [];
}
export function spiderHamPackCardPlayed(s: GameState, p: Piece) {
  if (p.code === "30017") {
    s.flags.spiderHamPackOneWayRound = s.round;
    s.flags.nebulaPackOneWayRound = s.round;
  }
}
export function spiderHamPackAllyEntered(
  s: GameState,
  p: Piece,
  ports: SpiderHamPackPorts,
): Effect[] | null {
  if (!["30012", "30013", "30020", "30021"].includes(p.code)) return null;
  return p.code === "30013" &&
    !ports.isTextBlank(s, p) &&
    ports.schemeTargets(s, false).length
    ? [
        E("optional", {
          title: "Spider-Man · Pavitr Prabhakar",
          image: p.code,
          effects: [P("pavitr", { id: p.id, actorId: s.activePlayerId })],
        }),
      ]
    : [];
}
export function spiderHamPackAllyThwarted(
  s: GameState,
  receipt: SpiderHamPackThwartReceipt,
  ports: SpiderHamPackPorts,
): Effect[] {
  const p = allInPlay(s).find(
      (p) => p.id === receipt.sourceId && p.code === "30012",
    ),
    seat = p && controller(s, p.id),
    view = seat && seatView(s, seat);
  return p &&
    view &&
    receipt.performed &&
    receipt.thwart &&
    receipt.amount > 0 &&
    !ports.isTextBlank(s, p) &&
    ports
      .controlledTraitCards(view, "Web-Warrior")
      .some((t) => t.id !== p.id) &&
    others(view, receipt.target, ports).length
    ? trigger(
        s,
        p,
        receipt.token,
        "Lady Spider",
        P("lady", { id: p.id, receipt }),
      )
    : [];
}
export function spiderHamPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "30017" ? [P("one-way-cost", { after })] : null;
}
export function spiderHamPackEvent(_s: GameState, p: Piece): Effect[] | null {
  if (rulesCode(p) === "30014") return [P("odds", { id: p.id })];
  if (p.code === "30017") return [E("draw", { amount: 3 }), P("shuffle")];
  return null;
}
export function spiderHamPackBasicThwartOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: SpiderHamPackPorts,
): Option[] {
  if (s.player.form !== "hero" || s.player.confused || !packet.basic) return [];
  return hand(s, ports)
    .filter(
      (p) =>
        p.code === "30016" &&
        !(packet.spiderHamPackEntrances || []).includes(p.id) &&
        !ports.isTextBlank(s, p) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Making an Entrance · +2 THW and conditional healing",
        [P("entrance", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
export function spiderHamPackBasicThwartEnded(
  _s: GameState,
  packet: Effect,
  removedAllThreat: boolean,
): Effect[] {
  return removedAllThreat && packet.spiderHamPackEntrances?.length
    ? packet.spiderHamPackEntrances.map(() =>
        E("heal", { target: "hero", amount: 2 }),
      )
    : [];
}
export function spiderHamPackSchemeDefeating(
  s: GameState,
  p: Piece,
  ports: SpiderHamPackPorts,
): Effect[] {
  return allInPlay(s)
    .filter(
      (a) =>
        a.code === "30018" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
    )
    .map((a) =>
      E("optional", {
        title: "Followed",
        image: a.code,
        actorId: controller(s, a.id)?.id || a.ownerId,
        effects: [
          P("followed", {
            id: a.id,
            actorId: controller(s, a.id)?.id || a.ownerId,
          }),
        ],
      }),
    );
}
export function spiderHamPackSchemeThwarting(
  s: GameState,
  receipt: SpiderHamPackThwartReceipt,
  ports: SpiderHamPackPorts,
): Effect[] {
  if (!receipt.performed || !receipt.thwart || receipt.amount <= 0) return [];
  return allInPlay(s)
    .filter(
      (p) =>
        rulesCode(p) === "30019" &&
        p.attachedTo === receipt.target &&
        !ports.isTextBlank(s, p),
    )
    .flatMap((p) => {
      const seat = controller(s, p.id),
        view = seat && seatView(s, seat);
      return view &&
        view.player.form === "hero" &&
        others(view, receipt.target, ports).length
        ? trigger(
            s,
            p,
            receipt.token,
            "Overwatch",
            P("overwatch", { id: p.id, receipt }),
          )
        : [];
    });
}
export function spiderHamPackEncounterRevealOptions(
  s: GameState,
  receipt: SpiderHamPackRevealReceipt,
  after: Effect[],
  ports: SpiderHamPackPorts,
): Option[] {
  if (
    receipt.playerId !== s.activePlayerId ||
    !ports.revealAvailable(s, receipt)
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "30020" &&
        !ports.isTextBlank(s, p) &&
        !s.flags[windowKey(receipt.token, p.id)],
    )
    .map((p) =>
      O(
        p.id,
        "Scarlet Spider · name a card type before looking",
        [P("scarlet-name", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
export function spiderHamPackAllyDefeated(
  _s: GameState,
  p: Piece,
  receipt: SpiderHamPackDefeatReceipt,
): Effect[] {
  return p.code === "30021" &&
    !receipt.textBlank &&
    receipt.consequential &&
    receipt.amount > receipt.remainingHP &&
    receipt.remainingHP > 0
    ? [
        P("spdr-return", {
          piece: p,
          token: receipt.token,
          ownerId: p.ownerId || receipt.playerId,
          actorId: p.ownerId || receipt.playerId,
        }),
      ]
    : [];
}
export function spiderHamPackAllyLeftPlay(
  s: GameState,
  receipt: SpiderHamPackLeaveReceipt,
  ports: SpiderHamPackPorts,
): Effect[] {
  if (
    (receipt.typeCode || card({ code: receipt.code })?.type_code) !== "ally" ||
    !receipt.traits.includes("Web-Warrior")
  )
    return [];
  return allInPlay(s)
    .filter(
      (p) => ["30023", "30029"].includes(p.code) && !ports.isTextBlank(s, p),
    )
    .flatMap((p) =>
      trigger(
        s,
        p,
        receipt.token,
        card(p).name,
        P(p.code === "30023" ? "web-life" : "warrior", { id: p.id, receipt }),
      ),
    );
}
export function spiderHamPackCharacterTraits(
  s: GameState,
  target: string,
  ports: Pick<SpiderHamPackPorts, "isTextBlank">,
): string[] {
  return allInPlay(s).some(
    (p) =>
      p.code === "30029" &&
      p.attachedTo === normalize(s, target) &&
      !ports.isTextBlank(s, p),
  )
    ? ["Web-Warrior"]
    : [];
}
export function spiderHamPackCharacterModifiers(s: GameState, target: string) {
  const id = normalize(s, target);
  return {
    attack: s.players.reduce(
      (n, seat) => n + Number(seatView(s, seat).flags[attackKey(id)] || 0),
      0,
    ),
  };
}
export function spiderHamPackPhaseEnded(s: GameState) {
  for (const seat of s.players) {
    const f = seatView(s, seat).flags;
    for (const key of Object.keys(f))
      if (key.startsWith("spiderHamPackWarrior:")) delete f[key];
  }
}
export function spiderHamPackCardLeftPlay(s: GameState, p: Piece) {
  for (const seat of s.players) delete seatView(s, seat).flags[attackKey(p.id)];
}
export function spiderHamPackAbilityOptions(
  s: GameState,
  id: string,
  ports: SpiderHamPackPorts,
): Option[] {
  const p = own(s, id, "30022");
  return p &&
    s.phase === "player" &&
    s.player.form === "hero" &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    matchingHand(s, p, ports).length
    ? [
        O(
          "team-building",
          "Team-Building Exercise · play a matching hand card for 1 less",
          [P("team-building", { id })],
          p.code,
        ),
      ]
    : [];
}
export function spiderHamPackAbility(
  s: GameState,
  id: string,
  ports: SpiderHamPackPorts,
  action?: string,
): boolean {
  const o = spiderHamPackAbilityOptions(s, id, ports).find(
    (o) => !action || o.id === action,
  );
  if (!o) return false;
  ports.queue(s, ...o.effects);
  return true;
}

export function resolveSpiderHamPackEffect(
  s: GameState,
  e: Effect,
  ports: SpiderHamPackPorts,
): boolean {
  if (!e.type.startsWith("spider-ham-pack:")) return false;
  // Serializable original-ID continuations; native ports retain timing,
  // physical ownership, actual payment and post-prevention receipts.
  const after = afterOf(e);
  switch (e.type) {
    case "spider-ham-pack:attach": {
      const p = own(s, e.id);
      need(
        p && ["30018", "30019", "30029"].includes(rulesCode(p)),
        "The actual attachment is unavailable.",
      );
      chooseTarget(
        s,
        card(p!).name,
        spiderHamPackAttachmentTargets(s, p!, ports) || [],
        P("attach-target", { id: p!.id }),
        ports,
      );
      break;
    }
    case "spider-ham-pack:attach-target": {
      const p = own(s, e.id);
      need(
        p &&
          spiderHamPackAttachmentTargets(s, p, ports)?.some(
            (t) => t.id === e.target,
          ),
        "Choose an eligible actual attachment target.",
      );
      ports.attach(s, p!.id, normalize(s, e.target));
      break;
    }
    case "spider-ham-pack:pavitr": {
      const p = own(s, e.id, "30013");
      need(
        p && !ports.isTextBlank(s, p),
        "Spider-Man's entry response is unavailable.",
      );
      const amount = ports.controlledTraitCards(s, "Web-Warrior").length;
      if (amount > 0)
        chooseTarget(
          s,
          "Spider-Man · Pavitr Prabhakar",
          ports.schemeTargets(s, false),
          P("remove", { id: p!.id, amount, after }),
          ports,
          after,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spider-ham-pack:lady": {
      const p = own(s, e.id, "30012"),
        receipt = e.receipt as SpiderHamPackThwartReceipt;
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          receipt.performed &&
          receipt.thwart &&
          receipt.amount > 0 &&
          ports
            .controlledTraitCards(s, "Web-Warrior")
            .some((t) => t.id !== p.id),
        "Lady Spider requires her actual thwart and another controlled Web-Warrior card.",
      );
      const key = windowKey(receipt.token, p!.id);
      need(
        !s.flags[key],
        "Lady Spider already responded to this actual thwart.",
      );
      s.flags[key] = true;
      chooseTarget(
        s,
        "Lady Spider",
        others(s, receipt.target, ports),
        P("remove", {
          id: p!.id,
          amount: receipt.amount,
          originalTarget: receipt.target,
          after,
        }),
        ports,
        after,
      );
      break;
    }
    case "spider-ham-pack:remove":
      need(
        ports.schemeTargets(s, false).some((t) => t.id === e.target) &&
          e.target !== e.originalTarget,
        "Choose a different legal scheme for the actual removal.",
      );
      ports.removeThreat(s, e.target, e.amount, e.id, after);
      break;
    case "spider-ham-pack:one-way-cost": {
      need(
        !maxOneWayUsed(s),
        "One Way or Another has already reached its maximum this round.",
      );
      const sides = s.encounter.deck.filter(
        (p) => card(p)?.type_code === "side_scheme",
      );
      need(
        sides.length,
        "One Way or Another requires an actual side scheme in the encounter deck.",
      );
      ports.revealHidden(s);
      ports.choose(
        s,
        "One Way or Another",
        "Choose the actual side scheme to reveal as the additional cost.",
        sides.map((p) =>
          O(
            p.id,
            card(p).name,
            [P("one-way-reveal", { id: p.id, after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "spider-ham-pack:one-way-reveal":
      need(
        s.encounter.deck.some(
          (p) => p.id === e.id && card(p)?.type_code === "side_scheme",
        ),
        "The actual side scheme is no longer in the encounter deck.",
      );
      s.flags.spiderHamPackOneWayRound = s.round;
      s.flags.nebulaPackOneWayRound = s.round;
      ports.revealEncounterFromDeck(s, e.id, after);
      break;
    case "spider-ham-pack:shuffle":
      ports.shuffleEncounter(s, after);
      break;
    case "spider-ham-pack:odds": {
      const legal = new Set(ports.schemeTargets(s, true).map((t) => t.id));
      const targets = s.sideSchemes
        .filter((p) => legal.has(p.id))
        .map((p) => ({ id: p.id, amount: s.playerCount }));
      if (targets.length)
        ports.thwartBatch(s, targets, e.id, [
          P("odds-after", {
            id: e.id,
            targetIds: targets.map((t) => t.id),
            after,
            actorId: s.activePlayerId,
          }),
        ]);
      else ports.queue(s, ...after);
      break;
    }
    case "spider-ham-pack:odds-after": {
      need(
        Array.isArray(e.defeatedIds),
        "Even the Odds requires the actual completed defeat receipt.",
      );
      const amount = new Set(
        (e.defeatedIds as string[]).filter((id) =>
          (e.targetIds as string[]).includes(id),
        ),
      ).size;
      ports.queue(
        s,
        ...(amount
          ? [
              E("damage", {
                target: s.villain.id,
                amount,
                source: e.id,
                attack: false,
              }),
            ]
          : []),
        ...after,
      );
      break;
    }
    case "spider-ham-pack:entrance": {
      const p = hand(s, ports).find((p) => p.id === e.id && p.code === "30016");
      need(
        p &&
          spiderHamPackBasicThwartOptions(s, e.packet, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Making an Entrance requires an actual basic thwart interrupt.",
      );
      ports.playThwartInterrupt(s, p!.id, e.packet, [
        P("entrance-paid", { id: p!.id, packet: e.packet, after }),
      ]);
      break;
    }
    case "spider-ham-pack:entrance-paid": {
      const packet = {
        ...e.packet,
        spiderHamPackEntrances: [
          ...(e.packet.spiderHamPackEntrances || []),
          e.id,
        ],
      };
      ports.addBasicThwartBonus(s, packet, 2);
      ports.queue(s, packet, ...after);
      break;
    }
    case "spider-ham-pack:followed": {
      const p = own(s, e.id, "30018");
      need(
        p && !ports.isTextBlank(s, p),
        "Followed's actual attached source is unavailable.",
      );
      chooseTarget(
        s,
        "Followed",
        ports.enemyTargets(s, false),
        P("followed-damage", { id: p!.id, after }),
        ports,
        after,
      );
      break;
    }
    case "spider-ham-pack:followed-damage":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Followed needs an actual enemy.",
      );
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 4,
          source: e.id,
          attack: false,
        }),
        ...after,
      );
      break;
    case "spider-ham-pack:overwatch": {
      const p = own(s, e.id, "30019"),
        receipt = e.receipt as SpiderHamPackThwartReceipt;
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "hero" &&
          p.attachedTo === receipt.target &&
          receipt.performed &&
          receipt.thwart &&
          receipt.amount > 0 &&
          others(s, receipt.target, ports).length,
        "Overwatch requires its actual thwart-removal interrupt.",
      );
      const key = windowKey(receipt.token, p!.id);
      need(!s.flags[key], "Overwatch already interrupted this actual removal.");
      s.flags[key] = true;
      ports.discardControlled(s, p!.id, [
        P("overwatch-target", {
          id: p!.id,
          receipt,
          after,
          actorId: s.activePlayerId,
        }),
      ]);
      break;
    }
    case "spider-ham-pack:overwatch-target":
      chooseTarget(
        s,
        "Overwatch",
        others(s, e.receipt.target, ports),
        P("remove", {
          id: e.id,
          amount: e.receipt.amount,
          originalTarget: e.receipt.target,
          after,
        }),
        ports,
        after,
      );
      break;
    case "spider-ham-pack:scarlet-name": {
      const p = own(s, e.id, "30020"),
        receipt = e.receipt as SpiderHamPackRevealReceipt;
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          ports.revealAvailable(s, receipt) &&
          receipt.playerId === s.activePlayerId &&
          !s.flags[windowKey(receipt.token, p.id)],
        "Scarlet Spider requires the actual pending encounter reveal.",
      );
      s.flags[windowKey(receipt.token, p!.id)] = true;
      const types = [
        "ally",
        "alter_ego",
        "attachment",
        "environment",
        "event",
        "hero",
        "main_scheme",
        "minion",
        "obligation",
        "resource",
        "side_scheme",
        "support",
        "treachery",
        "upgrade",
        "villain",
      ];
      ports.choose(
        s,
        "Scarlet Spider · name a card type",
        "Name a card type before looking at the actual encounter card.",
        types.map((type) =>
          O(type, type.replaceAll("_", " "), [
            P("scarlet-look", { id: p!.id, receipt, namedType: type, after }),
          ]),
        ),
      );
      break;
    }
    case "spider-ham-pack:scarlet-look": {
      const p = own(s, e.id, "30020"),
        receipt = e.receipt as SpiderHamPackRevealReceipt;
      need(
        p && ports.revealAvailable(s, receipt),
        "Scarlet Spider lost the actual still-pending encounter card.",
      );
      const type = ports.lookEncounter(s, receipt.pieceId);
      if (type === e.namedType)
        ports.damageAlly(s, p!.id, 1, [
          E("draw", { amount: 1, actorId: receipt.playerId }),
          ...after,
        ]);
      else ports.queue(s, ...after);
      break;
    }
    case "spider-ham-pack:spdr-return": {
      const key = windowKey(e.token, e.piece.id);
      if (!s.flags[key]) {
        s.flags[key] = true;
        ports.returnDefeatedAlly(s, e.piece, e.ownerId);
      }
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham-pack:web-life": {
      const p = own(s, e.id, "30023");
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          !s.flags[windowKey(e.receipt.token, p.id)],
        "Web of Life and Destiny's response is unavailable.",
      );
      s.flags[windowKey(e.receipt.token, p!.id)] = true;
      ports.choose(
        s,
        "Web of Life and Destiny",
        "Choose a surviving player to draw one card.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.id, [
            E("draw", { amount: 1, actorId: seat.id }),
            ...after,
          ]),
        ),
      );
      break;
    }
    case "spider-ham-pack:warrior": {
      const p = own(s, e.id, "30029");
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          p.attachedTo &&
          !s.flags[windowKey(e.receipt.token, p.id)],
        "Warrior of the Great Web's actual attached response is unavailable.",
      );
      s.flags[windowKey(e.receipt.token, p!.id)] = true;
      const target = p!.attachedTo!;
      if (ports.characterTargets(s).some((t) => normalize(s, t.id) === target))
        s.flags[attackKey(target)] =
          Number(s.flags[attackKey(target)] || 0) + 1;
      ports.queue(s, ...after);
      break;
    }
    case "spider-ham-pack:team-building": {
      const p = own(s, e.id, "30022");
      need(
        p && spiderHamPackAbilityOptions(s, p.id, ports).length,
        "Team-Building Exercise is unavailable.",
      );
      chooseTarget(
        s,
        "Team-Building Exercise",
        matchingHand(s, p!, ports).map((c) => ({
          id: c.id,
          label: card(c).name,
          code: c.code,
        })),
        P("team-play", { id: p!.id, after }),
        ports,
        after,
      );
      break;
    }
    case "spider-ham-pack:team-play": {
      const p = own(s, e.id, "30022"),
        candidate = s.player.hand.find((p) => p.id === e.target);
      need(
        p &&
          candidate &&
          spiderHamPackAbilityOptions(s, p.id, ports).length &&
          matchingHand(s, p, ports).some((p) => p.id === candidate.id),
        "Choose a playable actual hand card sharing a trait with your hero.",
      );
      p!.exhausted = true;
      ports.playFromHand(s, candidate!.id, 1, after);
      break;
    }
    default:
      throw Error(`Unknown Spider-Ham player-pack effect: ${e.type}`);
  }
  return true;
}
