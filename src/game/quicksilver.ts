import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const Q = (type: string, args: Record<string, unknown> = {}) =>
  E(`qsv:${type}`, args);
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
const active = (s: GameState) => ["qsv", "quicksilver"].includes(s.heroId);
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const optional = (title: string, text: string, effects: Effect[]) =>
  E("optional", { title, text, effects });

export type QuicksilverPower = "attack" | "thwart" | "defense";
export interface QuicksilverPorts extends AntManPorts {
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
  /** Discard the actual top card, reveal hidden information, and immediately
   * recycle an exhausted encounter deck. No boost ability is resolved. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
}
export const QUICKSILVER_SCRIPT_CODES = [
  "14001a",
  "14001b",
  "14002",
  "14003",
  "14004",
  "14005",
  "14006",
  "14007",
  "14008",
  "14009",
  "14010",
  "14011",
  "14024",
  "14025",
  "14026",
  "14027",
  "14028",
] as const;
export const QUICKSILVER_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

/** The host passes its text-active view for constant upgrade modifiers. */
export function quicksilverStats(s: GameState) {
  const velocity =
    s.player.form === "hero" && s.flags.qsvVelocityRound === s.round
      ? Number(s.flags.qsvVelocityAmount || 0)
      : 0;
  const copies = (code: string) =>
    active(s) && s.player.form === "hero"
      ? s.player.inPlay.filter((p) => p.code === code).length
      : 0;
  return {
    attack: velocity + copies("14011"),
    thwart: velocity + copies("14010"),
    defense: velocity + copies("14008"),
  };
}
export function quicksilverResourceSources(s: GameState): PaymentSource[] {
  return s.player.inPlay
    .filter((p) => p.code === "14009" && !p.exhausted && !isTextBlank(s, p))
    .map((p) => ({
      id: p.id,
      name: "Friction Resistance",
      code: p.code,
      resources: ["physical"],
      description: "Exhaust · generate 1 physical resource",
      kind: "ability",
    }));
}
export function quicksilverCanReady(s: GameState): boolean {
  return !s.flags.qsvCannotReadyUntilTurnEnd;
}
export function quicksilverTurnEnded(
  s: GameState,
  endedPlayerId = s.turnPlayerId,
): void {
  const seat = s.players.find((p) => p.id === endedPlayerId);
  if (!seat) return;
  const flags = seatView(s, seat).flags;
  if (s.round >= Number(flags.qsvCannotReadyUntilTurnEnd || Infinity))
    delete flags.qsvCannotReadyUntilTurnEnd;
}
export function quicksilverPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.qsvSuperSpeedPhase;
    delete flags.qsvMaximumVelocityPhase;
  }
}
export function quicksilverRoundEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.qsvVelocityRound;
    delete flags.qsvVelocityAmount;
  }
}

/** Call only after the actual basic power completes. Stunned/confused attempts
 * are not uses (the explicit Quicksilver FAQ in Rules Reference 1.8). Basic DEF
 * completes when the entire enemy attack ends, including early termination. */
export function quicksilverBasicUsed(
  s: GameState,
  power: QuicksilverPower,
): Effect[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.exhausted &&
    s.flags.qsvSuperSpeedPhase !== phaseKey(s)
    ? [Q("speed-window", { power, phase: phaseKey(s) })]
    : [];
}
/** The native ready adapter calls this only for an actual exhausted→ready
 * transition of Quicksilver. Each Hero Response belongs to its controller. */
export function quicksilverReadied(s: GameState): Effect[] {
  if (!active(s) || s.player.form !== "hero") return [];
  return allInPlay(s)
    .filter((p) => p.code === "14009" && p.exhausted && !isTextBlank(s, p))
    .flatMap((p) => {
      const seat = controller(s, p.id);
      return seat &&
        !seat.eliminated &&
        seatView(s, seat).player.form === "hero"
        ? [Q("friction-window", { id: p.id, actorId: seat.id })]
        : [];
    });
}
function wandaInPlay(s: GameState): boolean {
  return (
    allInPlay(s).some(
      (p) =>
        definition(p)?.name === "Wanda Maximoff" ||
        definition(p)?.subname === "Wanda Maximoff",
    ) ||
    playerOrder(s).some(
      (seat) =>
        ["scw", "scarlet_witch", "scarlet-witch"].includes(seat.heroId) &&
        seatView(s, seat).player.form === "alter",
    )
  );
}
const servalCards = (s: GameState) =>
  s.player.discard.filter(
    (p) =>
      definition(p)?.set_code === "qsv" &&
      definition(p)?.faction_code === "hero",
  );
const doubleSchemes = (s: GameState, ports: QuicksilverPorts) =>
  ports
    .schemeTargets(s, false)
    .filter(
      (target) =>
        target.id !== "main" ||
        !s.sideSchemes.some((p) => definition(p)?.scheme_crisis),
    );
export function quicksilverAbilityOptions(
  s: GameState,
  id: string,
  ports: QuicksilverPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.qsvSiblingsRound !== s.round &&
      s.player.hand.length >= 2
      ? [
          option(
            "siblings",
            "Superpowered Siblings · discard 2 cards, draw 2 (3 with Wanda)",
            [Q("siblings")],
            "14001b",
          ),
        ]
      : [];
  const p = own(s, id, "14007");
  return p &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    s.player.form === "alter" &&
    servalCards(s).length
    ? [
        option(
          "serval",
          "Serval Industries · exhaust, shuffle 2 Quicksilver cards into your deck",
          [Q("serval", { id })],
          p.code,
        ),
      ]
    : [];
}
export function quicksilverAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: QuicksilverPorts,
): Effect[] | null {
  const choices = quicksilverAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function quicksilverPlayRestriction(
  s: GameState,
  p: Piece,
  ports: QuicksilverPorts,
): string | null {
  if (!["14003", "14004", "14005", "14006"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "14003") {
    const seat = playerOrder(s).find(
      (seat) =>
        active(seatView(s, seat)) && seatView(s, seat).player.form === "hero",
    );
    if (
      !seat ||
      !seatView(s, seat).player.exhausted ||
      !quicksilverCanReady(seatView(s, seat)) ||
      !ports.canReadyIdentity(s, seat.id)
    )
      return "Quicksilver cannot be readied.";
  }
  if (
    p.code === "14004" &&
    !ports.enemyTargets(s, false).length &&
    !doubleSchemes(s, ports).length
  )
    return "Double Time has no legal damage or threat-removal target.";
  if (p.code === "14005" && s.flags.qsvMaximumVelocityPhase === phaseKey(s))
    return "Maximum Velocity is max 1 per phase.";
  if (
    p.code === "14006" &&
    !ports
      .enemyTargets(s, false)
      .some((t) => ports.canGiveStatus(s, t.id, "stunned"))
  )
    return "Speed Cyclone has no enemy that can receive a stun card.";
  return null;
}
export function quicksilverEvent(
  _s: GameState,
  p: Piece,
  cycloneX?: number,
): Effect[] | null {
  switch (p.code) {
    case "14003":
      return [Q("running")];
    case "14004":
      return [Q("double", { remaining: 2 })];
    case "14005":
      return [Q("velocity")];
    case "14006":
      need(
        Number.isInteger(cycloneX) && Number(cycloneX) > 0,
        "Choose a positive X for Speed Cyclone before paying.",
      );
      return [Q("cyclone", { amount: cycloneX })];
    default:
      return null;
  }
}
/** Choose X before one atomic native payment; excess payment never increases X. */
export function quicksilverCyclonePaymentOptions(
  s: GameState,
  p: Piece,
  ports: QuicksilverPorts,
): Option[] {
  if (p.code !== "14006" || s.player.form !== "hero") return [];
  const available = ports
    .enemyTargets(s, false)
    .filter((t) => ports.canGiveStatus(s, t.id, "stunned"));
  const options: Option[] = [];
  for (let x = 1; x <= available.length; x++) {
    if (!ports.canPay(s, x, [], p.id, p.code)) continue;
    options.push(
      option(
        String(x),
        `X = ${x} · stun ${x} ${x === 1 ? "enemy" : "enemies"}`,
        [
          E("payRequest", {
            title: "Speed Cyclone",
            cost: x,
            piece: p,
            targetCode: p.code,
            cancelable: true,
            after: [E("play", { piece: p, cycloneX: x })],
          }),
        ],
        p.code,
      ),
    );
  }
  return options;
}

/** The host passes the selected-target basic continuation. Only printed dots
 * modify this one power: star abilities and Amplify are not counted. */
export function quicksilverBeforeAllyBasic(
  s: GameState,
  p: Piece,
  power: "attack" | "thwart",
  after: Effect[],
  ports: QuicksilverPorts,
): Effect[] | null {
  return p.code === "14002" &&
    !ports.isTextBlank(s, p) &&
    !p[power === "attack" ? "stunned" : "confused"]
    ? [Q("scarlet-window", { id: p.id, power, after })]
    : null;
}
export function quicksilverAttackReduction(
  s: GameState,
  target: string,
): number {
  return s.attachments.filter(
    (p) => p.code === "14027" && p.attachedTo === target,
  ).length;
}
export function quicksilverAttachmentActions(
  s: GameState,
  p: Piece,
  ports: QuicksilverPorts,
): Option[] {
  return p.code === "14027" &&
    s.player.form === "hero" &&
    !s.player.exhausted &&
    !ports.isTextBlank(s, p)
    ? [
        option(
          "remove",
          "Exhaust your hero · discard Vibration Resistance",
          [Q("vibration-remove", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function quicksilverEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "14024": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [Q("obligation", { piece: p, actorId: owner.id })] : [];
    }
    // Printed Incite is resolved once by the shared reveal-keyword path.
    case "14025":
      return [];
    case "14026":
      return playerOrder(s).map((seat) =>
        Q("avalanche", { actorId: seat.id, enemyId: p.id }),
      );
    case "14027":
      return [Q("vibration", { id: p.id })];
    case "14028":
      return [Q("earthquake")];
    default:
      return null;
  }
}
export function quicksilverBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "14028" ? [Q("earthquake-boost")] : null;
}
function selectTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: QuicksilverPorts,
): void {
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
}
export function resolveQuicksilverEffect(
  s: GameState,
  e: Effect,
  ports: QuicksilverPorts,
): boolean {
  if (!e.type.startsWith("qsv:")) return false;
  switch (e.type) {
    case "qsv:basic-used":
      ports.queue(s, ...quicksilverBasicUsed(s, e.power));
      break;
    case "qsv:speed-window":
      if (
        active(s) &&
        s.player.form === "hero" &&
        s.player.exhausted &&
        s.flags.qsvSuperSpeedPhase !== e.phase &&
        phaseKey(s) === e.phase &&
        quicksilverCanReady(s) &&
        ports.canReadyIdentity(s, s.activePlayerId)
      )
        ports.queue(
          s,
          optional(
            "Super Speed",
            "Ready Quicksilver? (Limit once per phase.)",
            [Q("speed-ready", { phase: e.phase })],
          ),
        );
      break;
    case "qsv:speed-ready":
      need(
        active(s) &&
          s.player.form === "hero" &&
          s.player.exhausted &&
          s.flags.qsvSuperSpeedPhase !== e.phase &&
          phaseKey(s) === e.phase &&
          quicksilverCanReady(s) &&
          ports.canReadyIdentity(s, s.activePlayerId),
        "Super Speed is unavailable.",
      );
      s.flags.qsvSuperSpeedPhase = e.phase;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    case "qsv:friction-window": {
      const p = own(s, e.id, "14009");
      if (p?.exhausted && s.player.form === "hero" && !ports.isTextBlank(s, p))
        ports.queue(
          s,
          optional("Friction Resistance", "Ready Friction Resistance?", [
            Q("friction-ready", { id: p.id }),
          ]),
        );
      break;
    }
    case "qsv:friction-ready": {
      const p = own(s, e.id, "14009");
      if (p?.exhausted && s.player.form === "hero" && !ports.isTextBlank(s, p))
        ports.queue(s, E("ready", { target: p.id }));
      break;
    }
    case "qsv:siblings":
      need(
        quicksilverAbilityOptions(s, "identity", ports).length,
        "Superpowered Siblings is unavailable.",
      );
      ports.select(
        s,
        "Superpowered Siblings",
        "Discard exactly 2 cards from your hand as the cost.",
        s.player.hand,
        2,
        2,
        Q("siblings-discard"),
      );
      break;
    case "qsv:siblings-discard": {
      const ids = (e.ids || e.selected || []) as string[];
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.qsvSiblingsRound !== s.round &&
          ids.length === 2 &&
          new Set(ids).size === 2 &&
          ids.every((id) => s.player.hand.some((p) => p.id === id)),
        "Discard 2 distinct actual hand cards for Superpowered Siblings.",
      );
      for (const id of ids) ports.discardHand(s, id);
      s.flags.qsvSiblingsRound = s.round;
      ports.queue(s, E("draw", { amount: wandaInPlay(s) ? 3 : 2 }));
      break;
    }
    case "qsv:serval": {
      const p = own(s, e.id, "14007"),
        eligible = servalCards(s);
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "alter" &&
          eligible.length,
        "Serval Industries is unavailable.",
      );
      // Exhaustion is the cost; shuffling is an effect and does as much as
      // possible if only one matching card is present (Rules Reference, Effect).
      p!.exhausted = true;
      const amount = Math.min(2, eligible.length);
      ports.select(
        s,
        "Serval Industries",
        `Choose ${amount} discarded Quicksilver ${amount === 1 ? "card" : "cards"} to shuffle into your deck.`,
        eligible,
        amount,
        amount,
        Q("serval-shuffle", { id: p!.id, amount }),
      );
      break;
    }
    case "qsv:serval-shuffle": {
      const p = own(s, e.id, "14007"),
        ids = (e.ids || e.selected || []) as string[];
      need(
        p &&
          p.exhausted &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "alter" &&
          ids.length === e.amount &&
          new Set(ids).size === ids.length &&
          ids.every((id) => servalCards(s).some((p) => p.id === id)),
        "Choose the actual discarded Quicksilver cards for Serval Industries.",
      );
      for (const id of ids)
        s.player.deck.push(
          s.player.discard.splice(
            s.player.discard.findIndex((p) => p.id === id),
            1,
          )[0],
        );
      ports.shufflePlayerDeck(s);
      break;
    }
    case "qsv:running": {
      need(s.player.form === "hero", "Always Be Running requires hero form.");
      const seat = playerOrder(s).find(
        (seat) =>
          active(seatView(s, seat)) && seatView(s, seat).player.form === "hero",
      );
      need(
        seat &&
          seatView(s, seat).player.exhausted &&
          quicksilverCanReady(seatView(s, seat)) &&
          ports.canReadyIdentity(s, seat.id),
        "Quicksilver cannot be readied.",
      );
      ports.queue(s, E("ready", { target: "hero", actorId: seat!.id }));
      break;
    }
    case "qsv:double": {
      need(s.player.form === "hero", "Double Time requires hero form.");
      if (e.remaining <= 0) break;
      const choices: Option[] = [];
      if (ports.enemyTargets(s, false).length)
        choices.push(
          option("damage", "Deal 2 damage to an enemy", [
            Q("double-target", { kind: "damage", remaining: e.remaining }),
          ]),
        );
      if (doubleSchemes(s, ports).length)
        choices.push(
          option("thwart", "Remove 2 threat from a scheme", [
            Q("double-target", { kind: "thwart", remaining: e.remaining }),
          ]),
        );
      if (choices.length)
        ports.choose(
          s,
          "Double Time",
          `Choose an effect (${e.remaining} remaining). You may choose the same effect twice.`,
          choices,
        );
      break;
    }
    case "qsv:double-target":
      selectTarget(
        s,
        "Double Time",
        e.kind === "damage"
          ? ports.enemyTargets(s, false)
          : doubleSchemes(s, ports),
        Q("double-resolve", { kind: e.kind, remaining: e.remaining }),
        ports,
      );
      break;
    case "qsv:double-resolve": {
      const targets =
        e.kind === "damage"
          ? ports.enemyTargets(s, false)
          : doubleSchemes(s, ports);
      need(
        targets.some((t) => t.id === e.target),
        "Double Time's target is no longer eligible.",
      );
      ports.queue(
        s,
        E(e.kind, {
          target: e.target,
          amount: 2,
          source: "hero",
          action: false,
          ignoreCrisis: false,
        }),
        Q("double", { remaining: e.remaining - 1 }),
      );
      break;
    }
    case "qsv:velocity":
      need(
        s.player.form === "hero" &&
          s.flags.qsvMaximumVelocityPhase !== phaseKey(s),
        "Maximum Velocity is max 1 per phase in hero form.",
      );
      s.flags.qsvMaximumVelocityPhase = phaseKey(s);
      if (s.flags.qsvVelocityRound !== s.round) s.flags.qsvVelocityAmount = 0;
      s.flags.qsvVelocityRound = s.round;
      s.flags.qsvVelocityAmount = Number(s.flags.qsvVelocityAmount || 0) + 2;
      break;
    case "qsv:cyclone": {
      need(
        s.player.form === "hero" && Number.isInteger(e.amount) && e.amount > 0,
        "Speed Cyclone requires a positive chosen X in hero form.",
      );
      const eligible = ports
        .enemyTargets(s, false)
        .filter((t) => ports.canGiveStatus(s, t.id, "stunned"));
      const pieces = eligible.flatMap((t) =>
        t.id === s.villain.id
          ? [s.villain]
          : s.minions.filter((p) => p.id === t.id),
      );
      const amount = Math.min(e.amount, pieces.length);
      if (amount)
        ports.select(
          s,
          "Speed Cyclone",
          `Choose ${amount} different enemies to stun.`,
          pieces,
          amount,
          amount,
          Q("cyclone-stun", { amount }),
        );
      break;
    }
    case "qsv:cyclone-stun": {
      const ids = (e.ids || e.selected || []) as string[];
      need(
        ids.length === e.amount &&
          new Set(ids).size === ids.length &&
          ids.every(
            (id) =>
              ports.enemyTargets(s, false).some((t) => t.id === id) &&
              ports.canGiveStatus(s, id, "stunned"),
          ),
        "Choose distinct enemies that can receive a stun card.",
      );
      ports.queue(
        s,
        ...ids.map((target) => E("status", { target, status: "stunned" })),
      );
      break;
    }
    case "qsv:scarlet-window": {
      const p = own(s, e.id, "14002");
      if (
        !p ||
        ports.isTextBlank(s, p) ||
        p[e.power === "attack" ? "stunned" : "confused"]
      ) {
        ports.queue(s, ...e.after);
        break;
      }
      ports.choose(
        s,
        "Scarlet Witch",
        "Discard the top encounter card to add its printed boost icons to this basic power?",
        [
          option("yes", "Use Scarlet Witch's interrupt", [
            Q("scarlet", { id: p.id, power: e.power, after: e.after }),
          ]),
          option("skip", "Pass", e.after),
        ],
      );
      break;
    }
    case "qsv:scarlet": {
      const p = own(s, e.id, "14002");
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          !p[e.power === "attack" ? "stunned" : "confused"],
        "Scarlet Witch's basic interrupt is unavailable.",
      );
      const discarded = ports.discardEncounterTop(s).piece;
      const bonus = discarded ? definition(discarded)?.boost || 0 : 0;
      ports.queue(
        s,
        ...e.after.map((action: Effect) => ({
          ...action,
          amount: Number(action.amount || 0) + bonus,
        })),
      );
      break;
    }
    case "qsv:obligation":
      need(
        active(s) && e.piece?.code === "14024",
        "Need for Speed must resolve for Pietro Maximoff.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Need for Speed",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to Pietro Maximoff", [
              Q("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              Q("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, Q("obligation-choice", { piece: e.piece }));
      break;
    case "qsv:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Pietro Maximoff cannot change form.",
      );
      ports.queue(s, Q("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "qsv:obligation-choice": {
      const choices = [
        option(
          "lock",
          "Exhaust your identity · cannot ready until your next turn ends",
          [Q("obligation-lock", { piece: e.piece })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust Pietro Maximoff · remove Need for Speed from the game",
            [Q("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Need for Speed",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "qsv:obligation-remove": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "14024",
        "Pietro Maximoff cannot pay the exhaustion cost.",
      );
      s.player.exhausted = true;
      const p = e.piece as Piece;
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.encounter.discard = s.encounter.discard.filter((x) => x.id !== p.id);
      if (!s.removed.some((x) => x.id === p.id))
        s.removed.push({
          ...p,
          exhausted: false,
          damage: 0,
          counters: 0,
          tough: false,
          stunned: false,
          confused: false,
        });
      break;
    }
    case "qsv:obligation-lock": {
      need(active(s), "Need for Speed must resolve for Pietro Maximoff.");
      s.player.exhausted = true;
      const seat = s.players.find((p) => p.id === s.activePlayerId);
      // If this player's upcoming turn has not begun, that later turn in the
      // current player phase is their next turn. Otherwise it is next round.
      s.flags.qsvCannotReadyUntilTurnEnd =
        s.round +
        (s.phase === "player" &&
        seat &&
        !seat.ended &&
        s.turnPlayerId !== seat.id
          ? 0
          : 1);
      break;
    }
    case "qsv:avalanche": {
      const choices = [
        option("damage", "Take 2 indirect damage", [
          E("indirect", {
            amount: 2,
            source: e.enemyId,
            sourceTitle: "Avalanche",
          }),
        ]),
      ];
      if (!s.player.exhausted)
        choices.push(
          option("exhaust", "Exhaust your identity", [
            E("exhaust", { id: "hero" }),
          ]),
        );
      ports.choose(
        s,
        "Avalanche",
        "Choose how this player resolves Avalanche.",
        choices,
      );
      break;
    }
    case "qsv:vibration": {
      const avalanche = s.minions.filter((p) => p.code === "14026");
      selectTarget(
        s,
        "Vibration Resistance",
        (avalanche.length ? avalanche : [s.villain]).map((p) => ({
          id: p.id,
          code: p.code,
          label: definition(p)?.name || "Villain",
        })),
        Q("vibration-attach", { id: e.id }),
        ports,
      );
      break;
    }
    case "qsv:vibration-attach": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "14027"),
        avalanche = s.minions.filter((p) => p.code === "14026");
      need(
        p &&
          (avalanche.length
            ? avalanche.some((p) => p.id === e.target)
            : e.target === s.villain.id),
        "Vibration Resistance has no eligible attachment target.",
      );
      p!.attachedTo = e.target;
      break;
    }
    case "qsv:vibration-remove": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "14027");
      need(
        p &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          !ports.isTextBlank(s, p),
        "Your hero cannot pay Vibration Resistance's exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.discardPiece(s, p!.id);
      break;
    }
    case "qsv:earthquake": {
      s.player.exhausted = true;
      const amount = Math.min(2, s.player.hand.length);
      if (amount)
        ports.select(
          s,
          "Earthquake",
          `Discard ${amount} ${amount === 1 ? "card" : "cards"} from your hand.`,
          s.player.hand,
          amount,
          amount,
          Q("earthquake-discard", { amount }),
        );
      break;
    }
    case "qsv:earthquake-discard": {
      const ids = (e.ids || e.selected || []) as string[];
      need(
        ids.length === e.amount &&
          new Set(ids).size === ids.length &&
          ids.every((id) => s.player.hand.some((p) => p.id === id)),
        "Choose the actual hand cards to discard for Earthquake.",
      );
      for (const id of ids) ports.discardHand(s, id);
      break;
    }
    case "qsv:earthquake-boost": {
      const choices: Option[] = s.player.exhausted
        ? []
        : [
            option("exhaust", "Exhaust your identity", [
              E("exhaust", { id: "hero" }),
            ]),
          ];
      if (ports.canPay(s, 2, ["physical", "physical"]))
        choices.unshift(
          option("pay", "Spend 2 physical resources", [
            E("payRequest", {
              title: "Earthquake · boost",
              cost: 2,
              requirements: ["physical", "physical"],
              targetCode: "14028",
              cancelable: false,
              after: [],
            }),
          ]),
        );
      if (choices.length)
        ports.choose(
          s,
          "Earthquake · boost",
          "Spend 2 physical resources or exhaust your identity.",
          choices,
        );
      break;
    }
    default:
      throw Error(`Unknown Quicksilver effect: ${e.type}`);
  }
  return true;
}
