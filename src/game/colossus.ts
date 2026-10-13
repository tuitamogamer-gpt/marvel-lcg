import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import { statusCards } from "./keywords.js";
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

const cards = new Map((catalog as unknown as Card[]).map((p) => [p.code, p]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const C = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`colossus:${type}`, args);
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
  ["colossus", "piotr_rasputin"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const signature = (p: Piece) =>
  cards.get(p.code)?.set_code === "colossus" &&
  cards.get(p.code)?.faction_code === "hero";

export const COLOSSUS_SCRIPT_CODES = [
  "32001a",
  "32001b",
  "32002",
  "32003",
  "32004",
  "32005",
  "32006",
  "32007",
  "32008",
  "32009",
  "32010",
  "32025",
  "32026",
  "32027",
  "32028",
  "32029",
] as const;
export const COLOSSUS_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const COLOSSUS_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const COLOSSUS_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/";

export interface ColossusToughDiscardReceipt {
  token: string;
  /** Actual identity's seat, never the seat that initiated the damage. */
  playerId: string;
  targetId: string;
  /** Number actually discarded in this simultaneous batch. */
  count: number;
  wasHero: boolean;
}
export interface ColossusActivationReceipt {
  token: string;
  enemyId: string;
  playerId: string;
  kind: "attack" | "scheme";
  isVillain: boolean;
}
export type ColossusReactionContext =
  | { kind: "basic-attack"; packet: Effect }
  | { kind: "activation"; receipt: ColossusActivationReceipt };
export interface ColossusPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  canDraw?(s: GameState, amount: number): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canChangeForm(s: GameState): boolean;
  /** Native flip, including the identity's form-change responses. */
  flip(s: GameState, counts: boolean, target: "hero" | "alter"): void;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  /** Actual player-controlled allies and every surviving identity, qualified IDs. */
  friendlyTargets(s: GameState): AntManTarget[];
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  revealEncounter(s: GameState, p: Piece): void;
  attach(s: GameState, p: Piece, target: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Batch-mutates ALL targets first, records actual receipts, then offers
   * discard responses before after. Replacements never create fake receipts.
   * Each target ID identifies a real identity or actual ally. */
  discardTough(
    s: GameState,
    targets: { targetId: string; amount: number }[],
    after: Effect[],
  ): void;
  /** Native deck-discard lifecycle including deck exhaustion. Search ends at
   * first actual Colossus card, which is moved to hand; no fabricated copy. */
  discardUntilColossus(s: GameState, after: Effect[]): void;
  /** Actual owned hand/stored playable events. Does not make them resources. */
  reactionEvents?(s: GameState): Piece[];
  canPlayReaction?(
    s: GameState,
    p: Piece,
    context: ColossusReactionContext,
  ): boolean;
  playReaction(
    s: GameState,
    id: string,
    context: ColossusReactionContext,
    after: Effect[],
  ): void;
  /** Resume only after the Made of Rage event's native finishResolution and
   * card-play response windows have completed. */
  resumeBasicAttack(s: GameState, packet: Effect, after: Effect[]): void;
  activationAvailable?(
    s: GameState,
    receipt: ColossusActivationReceipt,
  ): boolean;
}

/** The extra Tough permission is printed only on the hero face. */
export function colossusToughLimit(
  s: GameState,
  ports?: Pick<ColossusPorts, "isIdentityTextBlank">,
): number {
  return active(s) &&
    s.player.form === "hero" &&
    !ports?.isIdentityTextBlank?.(s)
    ? 2
    : 1;
}
export function colossusEnforceToughLimit(
  s: GameState,
  ports: ColossusPorts,
  after: Effect[] = [],
): boolean {
  if (!active(s)) return false;
  const excess = statusCards(s.player, "tough") - colossusToughLimit(s, ports);
  if (excess <= 0) return false;
  ports.discardTough(
    s,
    [{ targetId: `hero:${s.activePlayerId}`, amount: excess }],
    after,
  );
  return true;
}
export function colossusStats(
  s: GameState,
  ports: Pick<ColossusPorts, "isTextBlank">,
) {
  const count = (code: string) =>
    active(s) && s.player.form === "hero"
      ? s.player.inPlay.filter(
          (p) => p.code === code && !ports.isTextBlank(s, p),
        ).length
      : 0;
  return { attack: count("32005"), thwart: count("32004") };
}
export function colossusAllyModifiers(
  s: GameState,
  p: Piece,
  ports: Pick<ColossusPorts, "isTextBlank">,
) {
  const ignores = p.code === "32002" && !ports.isTextBlank(s, p);
  return { ignoreGuard: ignores, ignorePatrol: ignores, ignoreCrisis: ignores };
}
export function colossusResourceSources(
  s: GameState,
  ports: Pick<ColossusPorts, "isTextBlank">,
): PaymentSource[] {
  const count = statusCards(s.player, "tough");
  return active(s) && s.player.form === "hero" && count > 0
    ? s.player.inPlay
        .filter(
          (p) => p.code === "32005" && !p.exhausted && !ports.isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Titanium Muscles",
          kind: "ability",
          resources: Array<Resource>(count).fill("physical"),
          description: `Exhaust Titanium Muscles · generate ${count} physical resources`,
        }))
    : [];
}
export function colossusResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<ColossusPorts, "isTextBlank">,
): boolean {
  const p = own(s, id, "32005");
  if (!p) return false;
  need(
    colossusResourceSources(s, ports).some((source) => source.id === id),
    "Titanium Muscles cannot generate resources now.",
  );
  p.exhausted = true;
  return true;
}
/** RRG1.8 Setup step16: after opening hand and mulligans. */
export function colossusSetup(s: GameState): Effect[] {
  return active(s) && !s.flags.colossusSetup ? [C("setup")] : [];
}
export function colossusFormChangeOptions(
  s: GameState,
  token: string,
  after: Effect[],
  ports: ColossusPorts,
): Option[] {
  if (
    !active(s) ||
    ports.isIdentityTextBlank?.(s) ||
    s.flags[`colossusForm:${token}`]
  )
    return [];
  if (s.player.form === "hero")
    return ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough")
      ? [
          O(
            "steel-skin",
            "Steel Skin · give Colossus a Tough status card",
            [C("steel-skin", { token, after })],
            "32001a",
          ),
        ]
      : [];
  return s.player.discard
    .filter(signature)
    .map((p) =>
      O(
        p.id,
        `Aspiring Artist · shuffle ${cards.get(p.code)!.name} into your deck`,
        [C("artist", { token, id: p.id, after })],
        p.code,
      ),
    );
}
export function colossusFormChanged(
  s: GameState,
  _ports: ColossusPorts,
): Effect[] {
  return active(s)
    ? [
        C("form-window", {
          token: `form:${s.nextId++}`,
          actorId: s.activePlayerId,
        }),
      ]
    : [];
}
const discardKey = (
  receipt: ColossusToughDiscardReceipt,
  sourceId: string,
  ordinal: number,
) => `colossusTough:${receipt.token}:${sourceId}:${ordinal}`;
export function colossusToughDiscardOptions(
  s: GameState,
  receipt: ColossusToughDiscardReceipt,
  after: Effect[],
  ports: ColossusPorts,
): Option[] {
  if (
    !active(s) ||
    receipt.playerId !== s.activePlayerId ||
    !["hero", `hero:${s.activePlayerId}`].includes(receipt.targetId) ||
    !receipt.token ||
    !Number.isInteger(receipt.count) ||
    receipt.count <= 0
  )
    return [];
  return s.player.inPlay.flatMap((p) => {
    if (ports.isTextBlank(s, p)) return [];
    const iron = p.code === "32004" && (ports.canDraw?.(s, 1) ?? true);
    const steel =
      p.code === "32006" &&
      receipt.wasHero &&
      s.player.form === "hero" &&
      !p.exhausted &&
      p.counters > 0 &&
      ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough");
    if (!iron && !steel) return [];
    return Array.from({ length: receipt.count }, (_, ordinal) => ordinal)
      .filter((ordinal) => !s.flags[discardKey(receipt, p.id, ordinal)])
      .map((ordinal) =>
        O(
          `${p.id}:${ordinal}`,
          iron
            ? "Iron Will · draw 1 card"
            : "Organic Steel · exhaust and spend 1 steel counter, gain Tough",
          [
            C(iron ? "iron-will" : "organic-steel", {
              id: p.id,
              ordinal,
              receipt,
              after,
            }),
          ],
          p.code,
        ),
      );
  });
}
/** Actual receipts only, retained through prompts/saves. Batch mutation must
 * finish before entering this window. One ordinal represents one actual card. */
export function colossusToughDiscarded(
  s: GameState,
  receipt: ColossusToughDiscardReceipt,
  ports: ColossusPorts,
): Effect[] {
  return colossusToughDiscardOptions(s, receipt, [], ports).length
    ? [C("tough-window", { receipt, actorId: receipt.playerId })]
    : [];
}
export function colossusAbilityOptions(
  s: GameState,
  id: string,
  ports: ColossusPorts,
): Option[] {
  const p = own(s, id, "32003");
  return active(s) &&
    s.player.form === "alter" &&
    p &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    s.player.deck.length > 0
    ? [
        O(
          "piotr-studio",
          "Piotr's Studio · exhaust and find a Colossus card",
          [C("studio", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function colossusAbility(
  s: GameState,
  id: string,
  ports: ColossusPorts,
  action?: string,
): Effect[] | null {
  const options = colossusAbilityOptions(s, id, ports);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function colossusPlayRestriction(
  s: GameState,
  p: Piece,
  ports: ColossusPorts,
): string | null {
  if (!["32007", "32008", "32009", "32010"].includes(p.code)) return null;
  if (!active(s)) return "This event requires Colossus.";
  if (p.code === "32007")
    return "Made of Rage requires an actual basic attack interrupt.";
  if (p.code === "32010")
    return "Armor Up requires an actual villain activation interrupt.";
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "32008")
    return s.player.stunned || ports.enemyTargets(s, true).length
      ? null
      : "Steel Fist has no legal attack target.";
  if (!statusCards(s.player, "tough"))
    return "Bulletproof Protector requires a Tough status card.";
  return null;
}
/** Official RRG1.8 errata adds the (attack) label absent from raw catalog. */
export function colossusEventAction(p: Piece): "attack" | undefined {
  return p.code === "32008" ? "attack" : undefined;
}
export function colossusAdditionalCost(s: GameState, p: Piece): Effect[] {
  return active(s) && p.code === "32009"
    ? [C("bulletproof-cost", { eventId: p.id })]
    : [];
}
/** Native PLAY/PUT entry, after resetting the actual physical instance. */
export function colossusCardEntered(_s: GameState, p: Piece): Effect[] {
  return p.code === "32006" ? [C("organic-steel-enter", { id: p.id })] : [];
}
export function colossusEvent(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "32008"
    ? [C("steel-fist", { piece: p })]
    : p.code === "32009"
      ? [C("bulletproof", { piece: p })]
      : null;
}
const reactions = (s: GameState, ports: ColossusPorts) =>
  ports.reactionEvents?.(s) ?? s.player.hand;
export function colossusBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: ColossusPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    s.player.stunned ||
    !statusCards(s.player, "tough") ||
    (packet.power && packet.power !== "attack")
  )
    return [];
  const context: ColossusReactionContext = { kind: "basic-attack", packet };
  return reactions(s, ports)
    .filter(
      (p) =>
        p.code === "32007" &&
        !ports.isTextBlank(s, p) &&
        (ports.canPlayReaction?.(s, p, context) ?? true) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Made of Rage · discard Tough, +6 ATK and Overkill",
        [C("play-reaction", { id: p.id, context, after })],
        p.code,
      ),
    );
}
export function colossusActivationOptions(
  s: GameState,
  receipt: ColossusActivationReceipt,
  after: Effect[],
  ports: ColossusPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "alter" ||
    !receipt.isVillain ||
    !ports.canChangeForm(s) ||
    !(ports.activationAvailable?.(s, receipt) ?? true)
  )
    return [];
  const context: ColossusReactionContext = { kind: "activation", receipt };
  return reactions(s, ports)
    .filter(
      (p) =>
        p.code === "32010" &&
        !ports.isTextBlank(s, p) &&
        (ports.canPlayReaction?.(s, p, context) ?? true) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Armor Up · change to hero form before the villain activates",
        [C("play-reaction", { id: p.id, context, after })],
        p.code,
      ),
    );
}
/** Native paid PLAY dispatches this, keeping the retained physical event. */
export function colossusReaction(
  s: GameState,
  p: Piece,
  context: ColossusReactionContext,
): Effect[] {
  need(active(s), "This reaction belongs to Colossus.");
  if (p.code === "32007") {
    if (context.kind !== "basic-attack")
      throw Error("Made of Rage needs an actual basic attack.");
    need(
      s.player.form === "hero" &&
        !s.player.stunned &&
        statusCards(s.player, "tough") > 0,
      "Made of Rage needs an actual basic attack and Tough cost.",
    );
    return [C("rage-cost", { piece: p, packet: context.packet })];
  }
  need(
    p.code === "32010" &&
      context.kind === "activation" &&
      context.receipt.isVillain &&
      s.player.form === "alter",
    "Armor Up needs an actual villain activation.",
  );
  return [
    C("armor-up", {
      receipt: context.kind === "activation" ? context.receipt : undefined,
    }),
  ];
}

export function colossusInitializeNemesis(
  s: GameState,
  ports: Pick<ColossusPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.colossusNemesisInitialized) return;
  const required = ["32026", "32027", "32028", "32028", "32029"],
    zone = (s.player.setAside ||= []);
  for (const code of new Set(required)) {
    const count = required.filter((c) => c === code).length,
      have = zone.filter((p) => p.code === code).length;
    need(
      have <= count,
      "Colossus's nemesis reserve has duplicate physical cards.",
    );
    for (let index = have; index < count; index++) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      zone.push(p);
    }
  }
  s.flags.colossusNemesisInitialized = true;
}
export function colossusShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    shown = ["32026", "32027"].flatMap((code) =>
      zone.filter((p) => p.code === code),
    ),
    rest = zone.filter((p) => ["32028", "32029"].includes(p.code));
  return [
    ...shown.map((p) => C("reveal-setaside", { id: p.id })),
    C("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!shown.some((p) => p.code === "32026")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function colossusEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (!["32025", "32026", "32027", "32028", "32029"].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "32025") {
    const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
    return owner ? [C("obligation", { piece: p, actorId: owner.id })] : [];
  }
  return p.code === "32027"
    ? [C("rampage", { id: p.id })]
    : p.code === "32028"
      ? [C("unstoppable", { piece: p })]
      : p.code === "32029"
        ? [C("slammed", { piece: p })]
        : [];
}
export function colossusBoost(s: GameState, p: Piece): Effect[] | null {
  if (!["32025", "32026", "32027", "32028", "32029"].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "32026")
    return s.attack && !s.scheming ? [C("juggernaut-boost")] : [];
  if (p.code === "32029") return [C("reveal-boost", { piece: p })];
  return [];
}
export function colossusEnemyStats(
  s: GameState,
  p: Piece,
  ports: Pick<ColossusPorts, "isTextBlank">,
) {
  return {
    attack:
      2 *
      s.attachments.filter(
        (a) =>
          a.code === "32028" &&
          a.attachedTo === p.id &&
          !ports.isTextBlank(s, a),
      ).length,
    scheme: 0,
  };
}
/** Forced Interrupt, after status replacement, on the ACTUAL attack instance. */
export function colossusEnemyAttackStarted(
  s: GameState,
  enemyId: string,
  ports: Pick<ColossusPorts, "isTextBlank">,
): Effect[] {
  return s.attachments
    .filter(
      (p) =>
        p.code === "32028" &&
        p.attachedTo === enemyId &&
        !ports.isTextBlank(s, p),
    )
    .map((p) => C("unstoppable-attack", { id: p.id, enemyId }));
}
export function colossusEnemyAttackEnded(s: GameState): Effect[] {
  return (s.attack?.afterActivation || []).filter(
    (effect) => effect.type === "colossus:unstoppable-discard",
  );
}

function toughCount(s: GameState, id: string): number {
  if (id === "hero") return statusCards(s.player, "tough");
  if (id.startsWith("hero:"))
    return statusCards(seatView(s, id.slice(5)).player, "tough");
  const p = s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.id === id);
  return p ? statusCards(p, "tough") : 0;
}
function unstoppableTargets(s: GameState): Piece[] {
  const legal = [s.villain, ...s.minions].filter(
    (p) =>
      !s.attachments.some((a) => a.code === "32028" && a.attachedTo === p.id),
  );
  const highest = Math.max(
    ...legal.map((p) => Number(cards.get(p.code)?.attack || 0)),
  );
  return legal.filter(
    (p) => Number(cards.get(p.code)?.attack || 0) === highest,
  );
}
export function resolveColossusEffect(
  s: GameState,
  e: Effect,
  ports: ColossusPorts,
): boolean {
  if (!e.type.startsWith("colossus:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "colossus:organic-steel-enter": {
      const source = own(s, e.id, "32006");
      need(
        source,
        "Organic Steel's Uses counters require the actual entering upgrade.",
      );
      if (!ports.isTextBlank(s, source!)) source!.counters = 2;
      ports.queue(s, ...after);
      break;
    }
    case "colossus:setup": {
      need(
        active(s) && !s.flags.colossusSetup,
        "Colossus setup has already resolved.",
      );
      s.flags.colossusSetup = true;
      const found = s.player.deck.filter((p) => p.code === "32006");
      if (!found.length) ports.shufflePlayerDeck(s, after);
      else
        ports.choose(
          s,
          "Piotr Rasputin setup",
          "Search your deck for one actual Organic Steel and add it to your hand.",
          found.map((p) =>
            O(
              p.id,
              "Organic Steel",
              [C("setup-found", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "colossus:setup-found": {
      const index = s.player.deck.findIndex(
        (p) => p.id === e.id && p.code === "32006",
      );
      need(
        active(s) && index >= 0,
        "Setup needs the actual Organic Steel in your deck.",
      );
      s.player.hand.push(s.player.deck.splice(index, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "colossus:form-window": {
      if (
        !e.limitHandled &&
        colossusEnforceToughLimit(s, ports, [{ ...e, limitHandled: true }])
      )
        break;
      const choices = colossusFormChangeOptions(s, e.token, after, ports);
      if (choices.length)
        ports.choose(
          s,
          s.player.form === "hero" ? "Steel Skin" : "Aspiring Artist",
          "Use the response to your actual change of form?",
          [...choices, O("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:steel-skin":
      need(
        colossusFormChangeOptions(s, e.token, after, ports).some(
          (o) => o.id === "steel-skin",
        ),
        "Steel Skin is unavailable.",
      );
      s.flags[`colossusForm:${e.token}`] = true;
      ports.queue(
        s,
        E("status", { target: `hero:${s.activePlayerId}`, status: "tough" }),
        ...after,
      );
      break;
    case "colossus:artist": {
      need(
        colossusFormChangeOptions(s, e.token, after, ports).some(
          (o) => o.id === e.id,
        ),
        "Aspiring Artist needs an actual discarded Colossus card.",
      );
      s.flags[`colossusForm:${e.token}`] = true;
      const index = s.player.discard.findIndex(
        (p) => p.id === e.id && signature(p),
      );
      s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "colossus:tough-window": {
      const choices = colossusToughDiscardOptions(
        s,
        e.receipt,
        [C("tough-window", { receipt: e.receipt, after })],
        ports,
      );
      if (choices.length)
        ports.choose(
          s,
          "Colossus Tough responses",
          "Respond to the actual discarded Tough status card(s)?",
          [...choices, O("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:iron-will":
    case "colossus:organic-steel": {
      need(
        colossusToughDiscardOptions(s, e.receipt, after, ports).some(
          (o) => o.id === `${e.id}:${e.ordinal}`,
        ),
        "This response to a discarded Tough card is unavailable.",
      );
      const p = own(s, e.id)!;
      need(
        p.code === (e.type === "colossus:iron-will" ? "32004" : "32006"),
        "The actual response source has changed.",
      );
      s.flags[discardKey(e.receipt, p.id, e.ordinal)] = true;
      if (p.code === "32004")
        ports.queue(s, E("draw", { amount: 1 }), ...after);
      else {
        p.exhausted = true;
        p.counters--;
        ports.queue(
          s,
          E("status", { target: `hero:${s.activePlayerId}`, status: "tough" }),
          ...after,
        );
        if (!p.counters) ports.discardPiece(s, p.id);
      }
      break;
    }
    case "colossus:studio": {
      need(
        colossusAbilityOptions(s, e.id, ports).length,
        "Piotr's Studio cannot pay its exhaustion cost.",
      );
      own(s, e.id)!.exhausted = true;
      ports.discardUntilColossus(s, after);
      break;
    }
    case "colossus:bulletproof-cost":
      need(
        active(s) &&
          s.player.form === "hero" &&
          statusCards(s.player, "tough") > 0,
        "Bulletproof Protector must discard an actual Tough card as its cost.",
      );
      ports.discardTough(
        s,
        [{ targetId: `hero:${s.activePlayerId}`, amount: 1 }],
        after,
      );
      break;
    case "colossus:bulletproof": {
      need(
        active(s) && s.player.form === "hero",
        "Bulletproof Protector requires hero form.",
      );
      const choices: Option[] = [];
      if (ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough"))
        choices.push(
          O(
            "tough",
            "Give your hero 2 Tough status cards",
            [C("bulletproof-tough", { after })],
            "32009",
          ),
        );
      if (s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId))
        choices.push(
          O(
            "ready",
            "Ready your hero",
            [E("ready", { target: "hero" }), ...after],
            "32009",
          ),
        );
      if (choices.length)
        ports.choose(
          s,
          "Bulletproof Protector",
          "Choose the event's effect after paying its Tough cost.",
          choices,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:bulletproof-tough":
      need(
        active(s) && s.player.form === "hero",
        "Bulletproof Protector requires hero form.",
      );
      ports.queue(
        s,
        E("status", { target: "hero", status: "tough" }),
        E("status", { target: "hero", status: "tough" }),
        ...after,
      );
      break;
    case "colossus:steel-fist": {
      need(
        active(s) && s.player.form === "hero",
        "Steel Fist requires hero form.",
      );
      const targets = ports.enemyTargets(s, true);
      if (targets.length)
        ports.choose(
          s,
          "Steel Fist",
          "Choose an enemy for this attack.",
          targets.map((p) =>
            O(
              p.id,
              p.label,
              [C("steel-fist-target", { piece: e.piece, target: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:steel-fist-target":
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target),
        "Steel Fist needs its actual legal attack target.",
      );
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 5,
            source: "hero",
            abilitySource: e.piece.id,
            attack: true,
            attackInitiated: true,
            eventCode: "32008",
          }),
          C("steel-fist-status", { target: e.target }),
        ],
        after,
      );
      break;
    case "colossus:steel-fist-status": {
      const canStatus =
        ports.canGiveStatus(s, e.target, "stunned") ||
        ports.canGiveStatus(s, e.target, "confused");
      if (
        s.player.form === "hero" &&
        statusCards(s.player, "tough") > 0 &&
        canStatus
      )
        ports.choose(
          s,
          "Steel Fist",
          "Discard a Tough status card to stun and confuse that enemy?",
          [
            O("discard", "Discard Tough · stun and confuse", [
              C("steel-fist-pay", { target: e.target, after }),
            ]),
            O("continue", "Continue", after),
          ],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:steel-fist-pay":
      need(
        s.player.form === "hero" &&
          statusCards(s.player, "tough") > 0 &&
          (ports.canGiveStatus(s, e.target, "stunned") ||
            ports.canGiveStatus(s, e.target, "confused")),
        "Steel Fist's optional payment needs a Tough card and a status effect that can resolve.",
      );
      ports.discardTough(
        s,
        [{ targetId: `hero:${s.activePlayerId}`, amount: 1 }],
        [
          E("status", { target: e.target, status: "stunned" }),
          E("status", { target: e.target, status: "confused" }),
          ...after,
        ],
      );
      break;
    case "colossus:play-reaction": {
      const context: ColossusReactionContext = e.context;
      const choices =
        context.kind === "basic-attack"
          ? colossusBasicAttackOptions(s, context.packet, after, ports)
          : colossusActivationOptions(s, context.receipt, after, ports);
      need(
        choices.some((o) => o.id === e.id),
        "The actual Colossus reaction event cannot be played.",
      );
      ports.playReaction(s, e.id, context, after);
      break;
    }
    case "colossus:rage-cost":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !s.player.stunned &&
          statusCards(s.player, "tough") > 0,
        "Made of Rage needs its actual attack and Tough cost.",
      );
      ports.discardTough(
        s,
        [{ targetId: `hero:${s.activePlayerId}`, amount: 1 }],
        [C("rage", { packet: e.packet, after })],
      );
      break;
    case "colossus:rage":
      ports.resumeBasicAttack(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 6,
          overkill: true,
          colossusRageHandled: false,
        },
        after,
      );
      break;
    case "colossus:armor-up":
      need(
        active(s) &&
          s.player.form === "alter" &&
          ports.canChangeForm(s) &&
          (ports.activationAvailable?.(s, e.receipt) ?? true),
        "Armor Up requires this actual pending villain activation.",
      );
      ports.queue(s, ...after);
      ports.flip(s, false, "hero");
      break;
    case "colossus:reveal-setaside": {
      const index = s.player.setAside?.findIndex((p) => p.id === e.id) ?? -1;
      if (index >= 0)
        ports.revealEncounter(s, s.player.setAside!.splice(index, 1)[0]);
      break;
    }
    case "colossus:shuffle-nemesis":
      for (const id of e.ids as string[]) {
        const index = s.player.setAside?.findIndex((p) => p.id === id) ?? -1;
        if (index >= 0)
          s.encounter.deck.push(s.player.setAside!.splice(index, 1)[0]);
      }
      ports.shuffleEncounter(s);
      break;
    case "colossus:rampage": {
      const source = s.sideSchemes.find(
        (p) => p.id === e.id && p.code === "32027",
      );
      if (!source || ports.isTextBlank(s, source)) {
        ports.queue(s, ...after);
        break;
      }
      const targets = ports
        .friendlyTargets(s)
        .map((target) => ({
          targetId: target.id,
          amount: toughCount(s, target.id),
        }))
        .filter((target) => target.amount > 0);
      const count = targets.reduce((n, target) => n + target.amount, 0);
      ports.discardTough(s, targets, [
        C("rampage-threat", { id: source.id, count }),
        ...after,
      ]);
      break;
    }
    case "colossus:rampage-threat": {
      const source = s.sideSchemes.find(
        (p) => p.id === e.id && p.code === "32027",
      );
      if (source && e.count > 0)
        ports.queue(
          s,
          E("threat", { target: source.id, amount: 2 * e.count }),
          ...after,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "colossus:unstoppable": {
      const targets = unstoppableTargets(s);
      if (targets.length)
        ports.choose(
          s,
          "Unstoppable",
          "Attach to an enemy with the highest printed ATK without Unstoppable.",
          targets.map((p) =>
            O(
              p.id,
              cards.get(p.code)?.name || p.code,
              [
                C("unstoppable-attach", {
                  piece: e.piece,
                  target: p.id,
                  after,
                }),
              ],
              p.code,
            ),
          ),
        );
      else
        ports.queue(
          s,
          E("surge", { source: e.piece.id, sourceCode: "32028" }),
          ...after,
        );
      break;
    }
    case "colossus:unstoppable-attach":
      need(
        unstoppableTargets(s).some((p) => p.id === e.target),
        "Unstoppable needs its actual highest printed ATK target.",
      );
      ports.attach(s, e.piece, e.target);
      ports.queue(s, ...after);
      break;
    case "colossus:unstoppable-attack": {
      const source = s.attachments.find(
        (p) =>
          p.id === e.id && p.code === "32028" && p.attachedTo === e.enemyId,
      );
      need(
        source &&
          s.attack?.attacker === e.enemyId &&
          !ports.isTextBlank(s, source),
        "Unstoppable needs the actual attached enemy's attack.",
      );
      s.attack!.overkill = true;
      s.attack!.piercing = true;
      s.flags[`colossusUnstoppable:${e.id}`] = true;
      if (
        !s.attack!.afterActivation?.some(
          (effect) =>
            effect.type === "colossus:unstoppable-discard" &&
            effect.id === e.id,
        )
      )
        (s.attack!.afterActivation ||= []).push(
          C("unstoppable-discard", { id: e.id, actorId: s.activePlayerId }),
        );
      ports.queue(s, ...after);
      break;
    }
    case "colossus:unstoppable-discard":
      need(
        s.flags[`colossusUnstoppable:${e.id}`],
        "This Unstoppable did not modify the completed attack.",
      );
      delete s.flags[`colossusUnstoppable:${e.id}`];
      ports.discardPiece(s, e.id);
      ports.queue(s, ...after);
      break;
    case "colossus:juggernaut-boost":
      need(s.attack, "Juggernaut's boost requires an attack activation.");
      s.attack!.overkill = true;
      s.attack!.piercing = true;
      ports.queue(s, ...after);
      break;
    case "colossus:reveal-boost":
      ports.revealEncounter(s, e.piece);
      break;
    case "colossus:slammed":
      ports.queue(
        s,
        s.player.stunned
          ? E("damage", { target: "hero", amount: 2, source: e.piece.id })
          : E("status", { target: "hero", status: "stunned" }),
        ...after,
      );
      break;
    case "colossus:obligation":
      need(active(s), "Homesick belongs to Piotr Rasputin.");
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Homesick",
          "You may change to alter-ego form before choosing a resolution.",
          [
            O("alter", "Change to alter-ego", [
              E("flip", { counts: false, target: "alter" }),
              C("obligation-choice", { piece: e.piece, after }),
            ]),
            O("stay", "Stay in hero form", [
              C("obligation-choice", { piece: e.piece, after }),
            ]),
          ],
        );
      else ports.queue(s, C("obligation-choice", { piece: e.piece, after }));
      break;
    case "colossus:obligation-choice": {
      const choices = [
        O(
          "discard",
          "Discard Homesick and each Tough status card · Surge if none discarded",
          [C("obligation-discard", { piece: e.piece, after })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          O(
            "remove",
            "Exhaust Piotr Rasputin · remove Homesick from the game",
            [C("obligation-remove", { piece: e.piece, after })],
          ),
        );
      ports.choose(
        s,
        "Homesick",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "colossus:obligation-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "32025",
        "Homesick's remove option requires ready Piotr Rasputin.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }), ...after);
      break;
    case "colossus:obligation-discard": {
      need(
        active(s) && e.piece?.code === "32025",
        "Homesick requires the actual obligation.",
      );
      const count = statusCards(s.player, "tough");
      // Complete both parts of the printed simultaneous discard before the
      // Tough response window. The obligation must already be out of play.
      ports.queue(
        s,
        E("discardEncounter", { piece: e.piece }),
        C("obligation-tough", { count, after }),
      );
      break;
    }
    case "colossus:obligation-tough": {
      const count = Number(e.count);
      need(
        active(s) && Number.isInteger(count) && count >= 0,
        "Homesick needs its actual Tough discard batch.",
      );
      ports.discardTough(
        s,
        [{ targetId: `hero:${s.activePlayerId}`, amount: count }],
        [...(!count ? [E("surge", { sourceCode: "32025" })] : []), ...after],
      );
      break;
    }
    default:
      throw Error(`Unknown Colossus effect: ${e.type}`);
  }
  return true;
}
