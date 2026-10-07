import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const W = (type: string, args: Record<string, unknown> = {}) =>
  E(`scw:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const definition = (p: Piece) => cards.get(p.code)!;
const active = (s: GameState) =>
  ["scw", "scarlet_witch", "scarlet-witch"].includes(s.heroId);
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));

export const SCARLET_WITCH_SCRIPT_CODES = [
  "15001a",
  "15001b",
  "15002",
  "15003",
  "15004",
  "15005",
  "15006",
  "15007",
  "15008",
  "15009",
  "15023",
  "15024",
  "15025",
  "15026",
  "15027",
] as const;
export const SCARLET_WITCH_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const SCARLET_WITCH_STARTER_SOURCE =
  "https://images-cdn.fantasyflightgames.com/filer_public/92/cd/92cdc983-81ec-40a6-801d-f1377bc17241/mc15_scarlet_witch_rulesheet.pdf";

export interface ScarletWitchPorts extends AntManPorts {
  select(
    s: GameState,
    title: string,
    text: string,
    pieces: Piece[],
    min: number,
    max: number,
    action: Effect,
  ): void;
  shufflePlayerDeck(s: GameState): void;
  /** Discard the actual top card and immediately recycle an exhausted deck. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  friendlyTargets(s: GameState): AntManTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPlayIgnoringCost(s: GameState, p: Piece): boolean;
  /** Complete the nested ordinary hand play, including its decisions, before after. */
  playIgnoringCost(s: GameState, p: Piece, after: Effect[]): void;
  preventDamage(s: GameState, packet: Effect | undefined, amount: number): void;
  /** Search actual deck/discard copies, reveal and shuffle the encounter deck. */
  searchEncounter(s: GameState, code: string): Piece | undefined;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  /** Cancel the entire reveal, including entry, keywords and all text; discard once. */
  cancelEncounter(s: GameState, p: Piece): void;
}

function nextEvolution(s: GameState, ports: ScarletWitchPorts): number {
  return s.sideSchemes.filter(
    (p) => p.code === "15024" && !ports.isTextBlank(s, p),
  ).length;
}
/** The native host supplies its text-active view for prospective legality. */
export function scarletWitchBoostIconBonus(s: GameState): number {
  return s.sideSchemes.filter((p) => p.code === "15024" && !isTextBlank(s, p))
    .length;
}
function eligibleChaos(s: GameState) {
  return playerOrder(s).filter((seat) => {
    const view = seatView(s, seat);
    return (
      active(view) &&
      view.player.form === "hero" &&
      view.flags.scwChaosControlPhase !== phaseKey(s)
    );
  });
}
function eligibleCrests(s: GameState, ports: ScarletWitchPorts) {
  return allInPlay(s).filter((p) => {
    const seat = controller(s, p.id);
    return (
      p.code === "15009" &&
      !p.exhausted &&
      seat &&
      !seat.eliminated &&
      !ports.isTextBlank(seatView(s, seat), p)
    );
  });
}

/** A serializable interrupt window for any exact numerical encounter-card count.
 * The original physical cards remain unchanged. Replacement modifies only the
 * count: their boost abilities and disposal still belong to the native host.
 * Only actual activation boost counts receive Amplify. A replacement is a
 * discarded encounter card, so it loses that boost-card-only modifier. */
export function scarletWitchCountBoosts(
  _s: GameState,
  pieces: Piece[],
  after: Effect[],
  options: {
    sourceTitle?: string;
    numericOverrides?: (number | undefined)[];
    amplify?: number;
  } = {},
): Effect[] {
  return [
    W("count-window", {
      pieces: pieces.map((p) => ({ ...p })),
      index: 0,
      boostCounts: [],
      after,
      ...options,
    }),
  ];
}
export function scarletWitchPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.scwChaosControlPhase;
    for (const key of Object.keys(flags))
      if (key.startsWith("scwQuicksilverReady:")) delete flags[key];
  }
}
export function scarletWitchCardCostBonus(s: GameState): number {
  return s.attachments.filter(
    (p) =>
      p.code === "15026" &&
      !isTextBlank(s, p) &&
      ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || ""),
  ).length;
}
function pietroInPlay(s: GameState): boolean {
  return (
    allInPlay(s).some(
      (p) =>
        definition(p)?.name === "Pietro Maximoff" ||
        definition(p)?.subname === "Pietro Maximoff",
    ) ||
    playerOrder(s).some(
      (seat) =>
        ["qsv", "quicksilver"].includes(seat.heroId) &&
        seatView(s, seat).player.form === "alter",
    )
  );
}
export function scarletWitchAbilityOptions(
  s: GameState,
  id: string,
  ports: ScarletWitchPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.scwSiblingsRound !== s.round &&
      s.player.hand.length >= 2
      ? [
          option(
            "siblings",
            "Superpowered Siblings · discard 2 cards, draw 2 (3 with Pietro)",
            [W("siblings")],
            "15001b",
          ),
        ]
      : [];
  const p = own(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "15002" &&
    p.exhausted &&
    s.flags[`scwQuicksilverReady:${p.id}`] !== phaseKey(s)
  )
    return [
      option(
        "ready",
        "Ready Quicksilver (once per phase)",
        [W("quicksilver-ready", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "15007" &&
    !p.exhausted &&
    s.player.form === "alter" &&
    s.player.deck.length
  )
    return [
      option(
        "agatha",
        "Agatha Harkness · exhaust, look at your top 3 cards",
        [W("agatha", { id })],
        p.code,
      ),
    ];
  return [];
}
export function scarletWitchAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: ScarletWitchPorts,
): Effect[] | null {
  const choices = scarletWitchAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function scarletWitchAttachmentActions(
  s: GameState,
  p: Piece,
  ports: ScarletWitchPorts,
): Option[] {
  return p.code === "15026" &&
    ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
    s.player.form === "hero" &&
    !s.player.exhausted &&
    !ports.isTextBlank(s, p)
    ? [
        option(
          "remove",
          "Exhaust your hero · discard Magical Suspension",
          [W("suspension-remove", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function scarletWitchPlayRestriction(
  s: GameState,
  p: Piece,
  ports: ScarletWitchPorts,
): string | null {
  if (!["15003", "15004", "15005", "15006"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "15006")
    return "Warp Reality is an encounter-card reveal interrupt.";
  if (
    p.code === "15003" &&
    !s.player.hand.some(
      (other) =>
        other.id !== p.id &&
        ports.canPlayIgnoringCost(
          {
            ...s,
            player: {
              ...s.player,
              hand: s.player.hand.filter((candidate) => candidate.id !== p.id),
            },
          },
          other,
        ),
    )
  )
    return "Chaos Magic has no legal card to play from your hand.";
  if (p.code === "15005" && !ports.enemyTargets(s, true).length)
    return "Molecular Decay has no legal attack target.";
  return null;
}
export function scarletWitchEvent(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "15003":
      return [W("chaos-magic")];
    case "15004":
      return [W("hex")];
    case "15005":
      return [W("molecular")];
    default:
      return null;
  }
}
export function scarletWitchDamageOptions(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
  after: Effect[],
  ports: ScarletWitchPorts,
): Option[] {
  if (amount <= 0) return [];
  const target = packet?.target || "hero";
  if (
    !ports
      .friendlyTargets(s)
      .some(
        (p) =>
          p.id === target ||
          (target === "hero" && p.id === `hero:${s.activePlayerId}`),
      )
  )
    return [];
  return allInPlay(s)
    .filter((p) => {
      const seat = controller(s, p.id);
      return (
        p.code === "15008" &&
        seat &&
        !seat.eliminated &&
        seatView(s, seat).player.form === "hero" &&
        !ports.isTextBlank(seatView(s, seat), p)
      );
    })
    .map((p) =>
      option(
        p.id,
        "Magic Shield · discard, prevent 3 damage",
        [W("shield", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
export function scarletWitchRevealOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: ScarletWitchPorts,
  fromEncounterDeck = true,
): Option[] {
  return fromEncounterDeck && s.player.form === "hero"
    ? s.player.hand
        .filter(
          (event) =>
            event.code === "15006" &&
            ports.canPay(s, ports.cardCost(s, event), [], event.id, event.code),
        )
        .map((event) =>
          option(
            event.id,
            "Warp Reality · cancel all encounter-card effects",
            [W("warp-pay", { id: event.id, piece: { ...p }, after })],
            event.code,
          ),
        )
    : [];
}
export function scarletWitchEnemyActivated(_s: GameState, p: Piece): Effect[] {
  return p.code === "15025" ? [W("luminous", { id: p.id })] : [];
}
export function scarletWitchEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "15023": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [W("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "15024":
    case "15025":
      return [];
    case "15026":
      return [W("suspension", { id: p.id })];
    case "15027":
      return [W("manipulation")];
    default:
      return null;
  }
}
export function scarletWitchBoost(_s: GameState, p: Piece): Effect[] | null {
  return SCARLET_WITCH_SCRIPT_CODES.includes(
    p.code as (typeof SCARLET_WITCH_SCRIPT_CODES)[number],
  )
    ? []
    : null;
}
function discardBatch(
  s: GameState,
  amount: number,
  ports: ScarletWitchPorts,
): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < amount; i++) {
    const result = ports.discardEncounterTop(s);
    if (result.piece) pieces.push({ ...result.piece });
    if (!result.piece || result.emptied) break;
  }
  return pieces;
}
function chooseTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: ScarletWitchPorts,
): void {
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else if (targets.length)
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      targets.map((p) =>
        option(p.id, p.label, [{ ...action, target: p.id }], p.code),
      ),
    );
}
const hexSchemes = (s: GameState, ports: ScarletWitchPorts) =>
  ports
    .schemeTargets(s, false)
    .filter(
      (p) =>
        p.id !== "main" ||
        !s.sideSchemes.some((scheme) => definition(scheme)?.scheme_crisis),
    );
function hexStatuses(s: GameState, ports: ScarletWitchPorts) {
  const characters = [
    ...ports.enemyTargets(s, false),
    ...ports.friendlyTargets(s),
  ];
  return characters.flatMap((p) =>
    (["stunned", "confused", "tough"] as const)
      .filter((status) => ports.canGiveStatus(s, p.id, status))
      .map((status) => ({ ...p, status })),
  );
}

export function resolveScarletWitchEffect(
  s: GameState,
  e: Effect,
  ports: ScarletWitchPorts,
): boolean {
  if (!e.type.startsWith("scw:")) return false;
  switch (e.type) {
    case "scw:count-window": {
      if (e.index >= e.pieces.length) {
        const boostCounts = e.boostCounts as number[];
        ports.queue(
          s,
          ...e.after.map((after: Effect) => ({
            ...after,
            boostCounts,
            boostTotal: boostCounts.reduce((sum, n) => sum + n, 0),
          })),
        );
        break;
      }
      const p = e.countPiece || (e.pieces[e.index] as Piece);
      const choices = eligibleChaos(s).map((seat) =>
        option(
          `chaos:${seat.id}`,
          "Chaos Control · discard the top encounter card and count it instead",
          [
            W("count-chaos", {
              ...e,
              type: "scw:count-chaos",
              playerId: seat.id,
              countPiece: p,
            }),
          ],
          "15001a",
        ),
      );
      if (choices.length)
        ports.choose(
          s,
          e.sourceTitle || "Boost icons",
          "Before counting this card's boost icons, replace the count with Chaos Control?",
          [
            ...choices,
            option(
              "continue",
              "Count this card's boost icons",
              [
                W("count-crest", {
                  ...e,
                  type: "scw:count-crest",
                  countPiece: p,
                }),
              ],
              p.code,
            ),
          ],
        );
      else
        ports.queue(
          s,
          W("count-crest", { ...e, type: "scw:count-crest", countPiece: p }),
        );
      break;
    }
    case "scw:count-chaos": {
      const seat = eligibleChaos(s).find((seat) => seat.id === e.playerId);
      need(seat, "Chaos Control is unavailable for this phase.");
      seatView(s, seat!).flags.scwChaosControlPhase = phaseKey(s);
      const replacement = ports.discardEncounterTop(s).piece;
      ports.queue(
        s,
        W("count-window", {
          ...e,
          type: "scw:count-window",
          countPiece: replacement ? { ...replacement } : undefined,
          replacementEmpty: !replacement,
          replaced: true,
        }),
      );
      break;
    }
    case "scw:count-crest": {
      const p = e.countPiece as Piece;
      const original = e.numericOverrides?.[e.index];
      const raw = e.replacementEmpty
        ? 0
        : !e.replaced && original !== undefined
          ? Number(original)
          : Number(definition(p)?.boost || 0);
      const amount =
        e.countAmount === undefined
          ? Math.max(
              0,
              raw +
                (e.replacementEmpty ? 0 : nextEvolution(s, ports)) +
                (!e.replaced ? Number(e.amplify || 0) : 0),
            )
          : Number(e.countAmount);
      const choices = eligibleCrests(s, ports).flatMap((crest) =>
        [1, -1]
          .filter((delta) => amount + delta >= 0 && amount + delta !== amount)
          .map((delta) =>
            option(
              `crest:${crest.id}:${delta > 0 ? "+1" : "-1"}`,
              `Scarlet Witch's Crest · exhaust, ${delta > 0 ? "+1" : "−1"} boost icon`,
              [
                W("count-modify", {
                  ...e,
                  type: "scw:count-modify",
                  id: crest.id,
                  delta,
                  countAmount: amount,
                }),
              ],
              crest.code,
            ),
          ),
      );
      const done = W("count-done", {
        ...e,
        type: "scw:count-done",
        countAmount: amount,
      });
      if (choices.length)
        ports.choose(
          s,
          e.sourceTitle || "Boost icons",
          `This count is ${amount}. Modify it with Scarlet Witch's Crest?`,
          [
            ...choices,
            option(
              "continue",
              `Use ${amount} boost ${amount === 1 ? "icon" : "icons"}`,
              [done],
              p?.code,
            ),
          ],
        );
      else ports.queue(s, done);
      break;
    }
    case "scw:count-modify": {
      const crest = eligibleCrests(s, ports).find((p) => p.id === e.id);
      need(
        crest && [-1, 1].includes(e.delta) && e.countAmount + e.delta >= 0,
        "Scarlet Witch's Crest cannot modify this count.",
      );
      crest!.exhausted = true;
      ports.queue(
        s,
        W("count-crest", {
          ...e,
          type: "scw:count-crest",
          countAmount: e.countAmount + e.delta,
        }),
      );
      break;
    }
    case "scw:count-done":
      ports.queue(
        s,
        W("count-window", {
          ...e,
          type: "scw:count-window",
          index: e.index + 1,
          boostCounts: [...e.boostCounts, e.countAmount],
          countPiece: undefined,
          countAmount: undefined,
          replaced: false,
          replacementEmpty: false,
        }),
      );
      break;
    case "scw:siblings":
      need(
        scarletWitchAbilityOptions(s, "identity", ports).length,
        "Superpowered Siblings is unavailable.",
      );
      ports.select(
        s,
        "Superpowered Siblings",
        "Discard exactly 2 cards from your hand as the cost.",
        s.player.hand,
        2,
        2,
        W("siblings-discard"),
      );
      break;
    case "scw:siblings-discard": {
      const ids = (e.ids || e.selected || []) as string[];
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.scwSiblingsRound !== s.round &&
          ids.length === 2 &&
          new Set(ids).size === 2 &&
          ids.every((id) => s.player.hand.some((p) => p.id === id)),
        "Discard 2 distinct actual hand cards for Superpowered Siblings.",
      );
      for (const id of ids) ports.discardHand(s, id);
      s.flags.scwSiblingsRound = s.round;
      ports.queue(s, E("draw", { amount: pietroInPlay(s) ? 3 : 2 }));
      break;
    }
    case "scw:quicksilver-ready": {
      const p = own(s, e.id, "15002");
      need(
        p && scarletWitchAbilityOptions(s, e.id, ports).length,
        "Quicksilver cannot ready this phase.",
      );
      s.flags[`scwQuicksilverReady:${p!.id}`] = phaseKey(s);
      ports.queue(s, E("ready", { target: p!.id }));
      break;
    }
    case "scw:agatha": {
      const p = own(s, e.id, "15007");
      need(
        p && scarletWitchAbilityOptions(s, e.id, ports).length,
        "Agatha Harkness is unavailable.",
      );
      p!.exhausted = true;
      ports.revealHidden(s);
      const pieces = s.player.deck.slice(0, 3);
      ports.choose(
        s,
        "Agatha Harkness",
        "Choose 1 of your top cards to add to your hand.",
        pieces.map((p) =>
          option(
            p.id,
            definition(p).name,
            [W("agatha-add", { ids: pieces.map((p) => p.id), id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "scw:agatha-add": {
      const ids = e.ids as string[];
      need(
        ids.length &&
          ids.length <= 3 &&
          ids.includes(e.id) &&
          ids.every((id, index) => s.player.deck[index]?.id === id),
        "Agatha Harkness's looked-at cards have changed.",
      );
      const pieces = s.player.deck.splice(0, ids.length);
      s.player.hand.push(
        pieces.splice(
          pieces.findIndex((p) => p.id === e.id),
          1,
        )[0],
      );
      ports.queue(s, W("agatha-bottom", { pieces }));
      break;
    }
    case "scw:agatha-bottom": {
      const pieces = e.pieces as Piece[];
      if (pieces.length === 1) s.player.deck.push(pieces[0]);
      else if (pieces.length)
        ports.choose(
          s,
          "Agatha Harkness",
          "Choose the card to place next on the bottom of your deck.",
          pieces.map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("agatha-order", { pieces, id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "scw:agatha-order": {
      const pieces = e.pieces as Piece[],
        p = pieces.find((p) => p.id === e.id);
      need(p, "Choose an actual looked-at Agatha Harkness card.");
      s.player.deck.push(p!);
      ports.queue(
        s,
        W("agatha-bottom", { pieces: pieces.filter((p) => p.id !== e.id) }),
      );
      break;
    }
    case "scw:chaos-magic": {
      const pieces = s.player.hand.filter((p) =>
        ports.canPlayIgnoringCost(s, p),
      );
      if (pieces.length)
        ports.choose(
          s,
          "Chaos Magic",
          "Play a card from your hand, ignoring only its resource cost.",
          pieces.map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("chaos-play", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "scw:chaos-play": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && s.player.form === "hero" && ports.canPlayIgnoringCost(s, p),
        "Chaos Magic requires a legal actual hand card.",
      );
      ports.playIgnoringCost(s, p!, [
        W("discard-batch", {
          amount: Math.max(0, Number(definition(p!)?.cost || 0)),
        }),
      ]);
      break;
    }
    case "scw:discard-batch":
      discardBatch(s, e.amount, ports);
      break;
    case "scw:hex": {
      const pieces = discardBatch(s, 3, ports);
      ports.queue(
        s,
        ...scarletWitchCountBoosts(
          s,
          pieces,
          [
            W("hex-order", {
              pieces,
              remaining: pieces.map((_, index) => index),
            }),
          ],
          { sourceTitle: "Hex Bolt" },
        ),
      );
      break;
    }
    case "scw:hex-order": {
      const remaining = e.remaining as number[];
      if (!remaining.length) break;
      const choice = (index: number) =>
        W("hex-resolve", {
          ...e,
          type: "scw:hex-resolve",
          index,
          remaining: remaining.filter((i) => i !== index),
        });
      if (remaining.length === 1) ports.queue(s, choice(remaining[0]));
      else
        ports.choose(
          s,
          "Hex Bolt",
          "Resolve the discarded cards in any order.",
          remaining.map((index) => {
            const n = e.boostCounts[index] as number;
            const text =
              n === 0
                ? "Deal 2 damage"
                : n === 1
                  ? "Remove 2 threat"
                  : n === 2
                    ? "Draw 1 card"
                    : "Place a status card";
            return option(
              String(index),
              `${definition(e.pieces[index]).name} · ${n} boost icons · ${text}`,
              [choice(index)],
              e.pieces[index].code,
            );
          }),
        );
      break;
    }
    case "scw:hex-resolve": {
      const n = e.boostCounts[e.index] as number;
      const after = W("hex-order", { ...e, type: "scw:hex-order" });
      if (n === 2) ports.queue(s, E("draw", { amount: 1 }), after);
      else if (n >= 3) {
        const targets = hexStatuses(s, ports);
        if (targets.length)
          ports.choose(
            s,
            "Hex Bolt",
            "Place a status card on a character.",
            targets.map((p) =>
              option(
                `${p.id}:${p.status}`,
                `${p.label} · ${p.status}`,
                [E("status", { target: p.id, status: p.status }), after],
                p.code,
              ),
            ),
          );
        else ports.queue(s, after);
      } else {
        const targets =
          n === 0 ? ports.enemyTargets(s, false) : hexSchemes(s, ports);
        if (targets.length)
          chooseTarget(
            s,
            "Hex Bolt",
            targets,
            W("hex-target", {
              ...e,
              type: "scw:hex-target",
              kind: n === 0 ? "damage" : "thwart",
            }),
            ports,
          );
        else ports.queue(s, after);
      }
      break;
    }
    case "scw:hex-target":
      ports.queue(
        s,
        E(e.kind, {
          target: e.target,
          amount: 2,
          source: "hero",
          action: false,
          ignoreCrisis: false,
        }),
        W("hex-order", { ...e, type: "scw:hex-order" }),
      );
      break;
    case "scw:molecular":
      chooseTarget(
        s,
        "Molecular Decay",
        ports.enemyTargets(s, true),
        W("molecular-discard"),
        ports,
      );
      break;
    case "scw:molecular-discard": {
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target),
        "Molecular Decay's attack target is no longer legal.",
      );
      const pieces = discardBatch(s, 2, ports);
      ports.queue(
        s,
        ...scarletWitchCountBoosts(
          s,
          pieces,
          [W("molecular-damage", { target: e.target })],
          { sourceTitle: "Molecular Decay" },
        ),
      );
      break;
    }
    case "scw:molecular-damage":
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 5 + e.boostTotal,
            source: "hero",
            attack: true,
          }),
        ],
        [],
      );
      break;
    case "scw:shield": {
      const p = allInPlay(s).find((p) => p.id === e.id && p.code === "15008"),
        seat = p && controller(s, p.id);
      need(
        p &&
          seat &&
          seatView(s, seat).player.form === "hero" &&
          !ports.isTextBlank(seatView(s, seat), p) &&
          scarletWitchDamageOptions(
            s,
            e.packet,
            e.amount,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Magic Shield is unavailable.",
      );
      ports.discardPiece(s, p!.id);
      ports.preventDamage(s, e.packet, 3);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "scw:warp-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "15006");
      need(
        p &&
          s.player.form === "hero" &&
          ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
        "Warp Reality is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Warp Reality",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [W("warp", { piece: e.piece })],
              continuation: (e.after || []).filter(
                (e: Effect) =>
                  ![
                    "reveal",
                    "treacheryText",
                    "repeatWhenRevealed",
                    "finishResolution",
                  ].includes(e.type),
              ),
            }),
          ],
        }),
      );
      break;
    }
    case "scw:warp":
      ports.cancelEncounter(s, e.piece);
      ports.queue(
        s,
        ...scarletWitchCountBoosts(s, [e.piece], [W("warp-discard")], {
          sourceTitle: "Warp Reality",
        }),
      );
      break;
    case "scw:warp-discard":
      discardBatch(s, e.boostTotal, ports);
      break;
    case "scw:obligation":
      need(
        active(s) && e.piece?.code === "15023",
        "Slipping Sanity must resolve for Wanda Maximoff.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Slipping Sanity",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to Wanda Maximoff", [
              W("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              W("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, W("obligation-choice", { piece: e.piece }));
      break;
    case "scw:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Wanda Maximoff cannot change form.",
      );
      ports.queue(s, W("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "scw:obligation-choice": {
      const choices = [
        option(
          "discard",
          "Discard up to 5 encounter cards · place threat for each star",
          [W("obligation-discard", { piece: e.piece })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust Wanda Maximoff · remove Slipping Sanity from the game",
            [W("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Slipping Sanity",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "scw:obligation-remove": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "15023",
        "Wanda Maximoff cannot pay the exhaustion cost.",
      );
      s.player.exhausted = true;
      s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
      s.encounter.discard = s.encounter.discard.filter(
        (p) => p.id !== e.piece.id,
      );
      if (!s.removed.some((p) => p.id === e.piece.id))
        s.removed.push({ ...e.piece });
      break;
    }
    case "scw:obligation-discard": {
      const pieces = discardBatch(s, 5, ports),
        amount = pieces.filter((p) => definition(p)?.boost_star).length;
      if (amount) ports.queue(s, E("threat", { target: "main", amount }));
      break;
    }
    case "scw:suspension": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "15026");
      need(p, "Magical Suspension's actual attachment is missing.");
      p!.attachedTo = `hero:${s.activePlayerId}`;
      break;
    }
    case "scw:suspension-remove": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "15026");
      need(
        p &&
          ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          !ports.isTextBlank(s, p),
        "Your hero cannot remove Magical Suspension.",
      );
      s.player.exhausted = true;
      ports.discardPiece(s, p!.id);
      break;
    }
    case "scw:luminous": {
      const p = s.minions.find((p) => p.id === e.id && p.code === "15025");
      if (!p || ports.isTextBlank(s, p)) break;
      const discarded = ports.discardEncounterTop(s).piece;
      ports.queue(
        s,
        ...scarletWitchCountBoosts(
          s,
          discarded ? [discarded] : [],
          [W("luminous-count")],
          { sourceTitle: "Luminous" },
        ),
      );
      break;
    }
    case "scw:luminous-count":
      if (e.boostTotal >= 2) ports.queue(s, E("dealEncounter"));
      break;
    case "scw:manipulation": {
      const p = ports.searchEncounter(s, "15025");
      if (p) ports.putMinion(s, p, s.activePlayerId);
      const luminous = s.minions.find((p) => p.code === "15025");
      const discarded = ports.discardEncounterTop(s).piece;
      ports.queue(
        s,
        ...scarletWitchCountBoosts(
          s,
          discarded ? [discarded] : [],
          [
            W("manipulation-count", {
              id: luminous?.id,
              playerId: s.activePlayerId,
            }),
          ],
          { sourceTitle: "Chaos Manipulation" },
        ),
      );
      break;
    }
    case "scw:manipulation-count":
      if (e.boostTotal >= 2 && e.id && s.minions.some((p) => p.id === e.id))
        ports.queue(s, E("minionActivate", { id: e.id, playerId: e.playerId }));
      break;
    default:
      throw Error(`Unknown Scarlet Witch effect: ${e.type}`);
  }
  return true;
}
