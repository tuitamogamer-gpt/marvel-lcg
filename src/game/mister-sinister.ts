import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { clearStatuses } from "./keywords.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** NeXt Evolution's fourth scenario, Mister Sinister: his main scheme runs
 * through two of three random stage 2 schemes, each giving him a superpower
 * from a set-aside encounter set, before Sinister Ends turns him on Hope
 * Summers. Status cards placed on him only feed his scheme. */

export const MISTER_SINISTER_SCRIPT_CODES = [
  "40136",
  "40137",
  "40138",
  "40139a",
  "40139b",
  "40140a",
  "40140b",
  "40141a",
  "40141b",
  "40142a",
  "40142b",
  "40143a",
  "40143b",
  "40144",
  "40145",
  "40146",
  "40147",
  "40148",
  "40149",
  "40150",
] as const;
export const FLIGHT_CODES = ["40151", "40152", "40153", "40154"] as const;
export const SUPER_STRENGTH_CODES = [
  "40155",
  "40156",
  "40157",
  "40158",
] as const;
export const TELEPATHY_CODES = ["40159", "40160", "40161", "40162"] as const;
/** The superpower sets set aside at setup. */
export const SUPERPOWER_SETS = ["flight", "super_strength", "telepathy"];
/** Telepathy's obligations stay in their player's play area. */
export const SINISTER_IN_PLAY_OBLIGATIONS = ["40160", "40161"] as const;

const STAGES = ["40136", "40137", "40138"];
export const SINISTER_INTENT = "40139b";
export const TAKING_OFF = "40140b";
export const BULKING_UP = "40141b";
export const FOCUSING_IN = "40142b";
export const STAGE_TWO = [TAKING_OFF, BULKING_UP, FOCUSING_IN];
export const SINISTER_ENDS = "40143b";
const SINISTER_ENDS_A = "40143a";
export const SINISTER_DISGUISE = "40144";
export const SINISTER_SOLDIER = "40145";
export const TELEPORTED_AWAY = "40146";
const GENETIC_MASTERY = "40147";
const MOLECULAR_CONTROL = "40148";
const SINISTER_SCHEMES = "40149";
const SINISTER_STRIKE = "40150";
export const FLIGHT = "40151";
export const AERIAL_BOMBARDMENT = "40152";
export const OUT_OF_REACH = "40153";
const HIGH_GROUND = "40154";
export const SUPER_STRENGTH = "40155";
export const IMPERVIOUS = "40156";
export const THROWN_OBJECT = "40157";
const ILL_TAKE_THAT = "40158";
export const TELEPATHY = "40159";
export const MANUFACTURED_DRAMA = "40160";
export const SOWING_DISCORD = "40161";
const ONE_STEP_AHEAD = "40162";
/** Each stage 2 scheme's superpower set and the trait it grants. */
export const POWERS: Record<
  string,
  { set: string; power: string; trait: Trait }
> = {
  [TAKING_OFF]: { set: "flight", power: FLIGHT, trait: "Aerial" },
  [BULKING_UP]: {
    set: "super_strength",
    power: SUPER_STRENGTH,
    trait: "Brute",
  },
  [FOCUSING_IN]: { set: "telepathy", power: TELEPATHY, trait: "Psionic" },
};
type Trait = "Aerial" | "Brute" | "Psionic";

export interface SinisterState {
  /** The superpower sets not yet brought in. */
  setAside: { set: string; pieces: Piece[] }[];
  /** The stage 2 scheme removed from the game at setup. */
  removed?: string;
  /** The stage 2 schemes already revealed. */
  visited: string[];
}

export interface SinisterPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  pick(s: GameState, n: number): number;
  /** Advance the main scheme to this side, with its starting threat. */
  setMain(s: GameState, code: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  heroName(s: GameState, playerId: string): string;
  canStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  allies(s: GameState, playerId: string): Piece[];
  /** Every friendly character with its remaining hit points. */
  friendly(s: GameState): { target: string; playerId: string; hp: number }[];
  /** Upgrades the player controls, with their printed cost. */
  upgrades(s: GameState, playerId: string): { piece: Piece; cost: number }[];
  supports(s: GameState, playerId: string): Piece[];
  discardRandomHand(s: GameState, playerId: string): void;
  heal(s: GameState, target: string, n: number): void;
  endGame(s: GameState, won: boolean, reason: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece | string) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const SN = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sin:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const misterSinister = (s: GameState) =>
  s.villainId === "mister_sinister";
const villainInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code) && active(s, s.villain);
const isVillain = (s: GameState, id: string) => id === s.villain?.id;
const attachedToVillain = (s: GameState, code: string) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === s.villain?.id && active(s, a),
  );
const threat = (n: number): Effect => ({
  type: "threat",
  target: "main",
  amount: n,
});

/** Superpower attachments on the villain. */
export function superpowers(s: GameState): number {
  return s.attachments.filter(
    (a) => a.attachedTo === s.villain?.id && traits(a).includes("Superpower"),
  ).length;
}
/** The villain has this trait from a superpower attachment. */
export function villainHas(s: GameState, trait: Trait): boolean {
  const power =
    trait === "Aerial"
      ? FLIGHT
      : trait === "Brute"
        ? SUPER_STRENGTH
        : TELEPATHY;
  return attachedToVillain(s, power).length > 0;
}

// ------------------------------------------------------------------- setup

/** Sinister Intent (1A): the three superpower sets are set aside. */
export function sinisterSetup(s: GameState) {
  const setAside: SinisterState["setAside"] = [];
  for (const set of SUPERPOWER_SETS) {
    const pieces = s.encounter.deck.filter((p) => def(p)?.set_code === set);
    s.encounter.deck = s.encounter.deck.filter((p) => !pieces.includes(p));
    setAside.push({ set, pieces });
  }
  s.sinister = { setAside, visited: [] };
  s.scheme.threat = 0;
}
/** Sinister Intent (1B) When Revealed: one random stage 2 is removed and
 * the main scheme advances to one of the other two at random. */
export function sinisterSetupEffects(s: GameState): Effect[] {
  return misterSinister(s) ? [SN("intent", { actorId: s.firstPlayerId })] : [];
}
/** The set-aside cards, for physical audits. */
export const sinisterSetAside = (s: GameState) =>
  s.sinister?.setAside.flatMap((g) => g.pieces) || [];

// --------------------------------------------------------------- villain

/** Mister Sinister (II) and (III) When Revealed. */
export function sinisterVillainRevealed(s: GameState): Effect[] {
  if (!misterSinister(s) || !villainInPlay(s)) return [];
  const few = superpowers(s) < 2;
  if (s.villain.code === "40137")
    return [threat((few ? 2 : 1) * s.playerCount)];
  if (s.villain.code === "40138")
    return [threat((few ? 3 : 2) * s.playerCount)];
  return [];
}
/** Each stage's Forced Response after a status card is placed on him. */
export function sinisterStatusPlaced(s: GameState, id: string): Effect[] {
  if (!isVillain(s, id) || !villainInPlay(s)) return [];
  return [threat(STAGES.indexOf(s.villain.code) + 1)];
}
/** A stage 2 scheme completed: the other stage 2A, else stage 3A. */
export function sinisterMainCompleted(s: GameState): Effect[] | null {
  if (!misterSinister(s) || !STAGE_TWO.includes(s.scheme.code)) return null;
  return [SN("next-stage", { actorId: s.firstPlayerId })];
}

// ------------------------------------------------------------ keywords

export function sinisterKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (!isVillain(s, p.id)) return 0;
  // Flight: the villain's attacks gain overkill.
  if (keyword === "Overkill") return attachedToVillain(s, FLIGHT).length;
  // Telepathy: retaliate 1.
  if (keyword === "Retaliate") return attachedToVillain(s, TELEPATHY).length;
  // Thrown Object: the villain's attacks gain ranged.
  if (keyword === "Ranged")
    return attachedToVillain(s, THROWN_OBJECT).length ? 1 : 0;
  return 0;
}
/** Super Strength: the villain gains steady. */
export function sinisterSteady(s: GameState, p: Piece): boolean {
  return isVillain(s, p.id) && attachedToVillain(s, SUPER_STRENGTH).length > 0;
}
/** Sinister Soldier: +1 ATK and SCH for each superpower; Aerial
 * Bombardment: +1 ATK while attacking a non-Aerial character. */
export function sinisterStatBonus(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
  targetAerial?: boolean,
): number {
  let n = 0;
  if (p.code === SINISTER_SOLDIER && s.minions.some((m) => m.id === p.id))
    n += active(s, p) ? superpowers(s) : 0;
  if (
    stat === "attack" &&
    isVillain(s, p.id) &&
    targetAerial === false &&
    s.attack?.attacker === p.id
  )
    n += attachedToVillain(s, AERIAL_BOMBARDMENT).length;
  return n;
}
/** Aerial Bombardment: the villain ignores retaliate while attacking a
 * non-Aerial character. */
export const sinisterIgnoresRetaliate = (
  s: GameState,
  attackerId: string,
  targetAerial: boolean,
) =>
  isVillain(s, attackerId) &&
  !targetAerial &&
  attachedToVillain(s, AERIAL_BOMBARDMENT).length > 0;

// ---------------------------------------------------------------- damage

/** Teleported Away: the villain cannot take damage. Out of Reach: not
 * unless the attacker or attack is Aerial or the attack has ranged. */
export function sinisterImmune(
  s: GameState,
  target: string,
  attack: { aerial: boolean; ranged: boolean },
): boolean {
  if (!isVillain(s, target)) return false;
  if (s.sideSchemes.some((q) => q.code === TELEPORTED_AWAY && active(s, q)))
    return true;
  return (
    attachedToVillain(s, OUT_OF_REACH).length > 0 &&
    !attack.aerial &&
    !attack.ranged
  );
}
/** Impervious: 1 less damage from each attack. */
export const sinisterAttackReduction = (s: GameState, target: string) =>
  isVillain(s, target) ? attachedToVillain(s, IMPERVIOUS).length : 0;
/** Sinister Disguise: the damage a player would deal to the villain waits
 * for that player's choice. */
export function sinisterDisguise(
  s: GameState,
  target: string,
  n: number,
  playerId: string | undefined,
): Effect | null {
  if (n <= 0 || !playerId || !isVillain(s, target)) return null;
  const disguise = attachedToVillain(s, SINISTER_DISGUISE)[0];
  return disguise
    ? SN("disguise", { id: disguise.id, n, playerId, actorId: playerId })
    : null;
}

// ---------------------------------------------------------------- attacks

/** Teleported Away: when the villain would attack, he schemes instead. */
export const sinisterSchemesInstead = (s: GameState, id: string) =>
  isVillain(s, id) &&
  s.sideSchemes.some((q) => q.code === TELEPORTED_AWAY && active(s, q));
/** Sinister Ends (3B): when Mister Sinister attacks, he attacks Hope
 * Summers instead. */
export function sinisterAttackRedirect(
  s: GameState,
  attackerId: string,
  hope: { piece: Piece; playerId: string } | undefined,
): { piece: Piece; playerId: string } | undefined {
  if (
    !misterSinister(s) ||
    s.scheme.code !== SINISTER_ENDS ||
    !isVillain(s, attackerId) ||
    !villainInPlay(s)
  )
    return undefined;
  return hope;
}
/** Thrown Object: after the villain attacks, discard it. */
export function sinisterAttacked(s: GameState, attackerId: string): Effect[] {
  if (!isVillain(s, attackerId)) return [];
  return attachedToVillain(s, THROWN_OBJECT).map((a) => ({
    type: "discardPiece",
    id: a.id,
  }));
}
/** Manufactured Drama: supports you control cannot ready. Sowing Discord:
 * allies you control cannot ready. */
export function sinisterCannotReady(
  s: GameState,
  p: Piece,
  controller: string | undefined,
): boolean {
  if (!controller) return false;
  const inPlay = seatView(s, controller).player.inPlay;
  const type = def(p)?.type_code;
  return (
    (type === "support" &&
      inPlay.some((q) => q.code === MANUFACTURED_DRAMA && active(s, q))) ||
    (type === "ally" &&
      inPlay.some((q) => q.code === SOWING_DISCORD && active(s, q)))
  );
}

// ---------------------------------------------------------- reveal/boost

const ALL_CODES: readonly string[] = [
  ...MISTER_SINISTER_SCRIPT_CODES,
  ...FLIGHT_CODES,
  ...SUPER_STRENGTH_CODES,
  ...TELEPATHY_CODES,
];
const ATTACH_TO_VILLAIN = [
  SINISTER_DISGUISE,
  AERIAL_BOMBARDMENT,
  OUT_OF_REACH,
  IMPERVIOUS,
  THROWN_OBJECT,
];
export function sinisterReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  if (ATTACH_TO_VILLAIN.includes(p.code)) return [SN("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case GENETIC_MASTERY:
      return [SN("genetic", { playerId })];
    case MOLECULAR_CONTROL:
      return villainInPlay(s)
        ? [
            { type: "status", target: s.villain.id, status: "tough" },
            ...(villainHas(s, "Brute") ? [SN("heal", { n: 4 })] : []),
          ]
        : [];
    case SINISTER_SCHEMES:
      return [SN("schemes", { playerId })];
    case SINISTER_STRIKE:
      return [SN("strike", { playerId, code: p.code })];
    case HIGH_GROUND:
      return [SN("high-ground", { playerId })];
    case ILL_TAKE_THAT:
      return [SN("take-that", { playerId, code: p.code })];
    case MANUFACTURED_DRAMA:
      return [SN("drama", { playerId, code: p.code })];
    case SOWING_DISCORD:
      return [SN("discord", { playerId, code: p.code })];
    case ONE_STEP_AHEAD:
      return [
        SN("random-discard", {
          playerId,
          n: villainHas(s, "Aerial") ? 2 : 1,
        }),
      ];
    default:
      return [];
  }
}
export function sinisterBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      SINISTER_SOLDIER,
      MOLECULAR_CONTROL,
      SINISTER_SCHEMES,
      SINISTER_STRIKE,
      HIGH_GROUND,
      ONE_STEP_AHEAD,
    ].includes(p.code)
  )
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  const status = (kind: "stunned" | "confused"): Effect => ({
    type: "status",
    target: "hero",
    status: kind,
    actorId: playerId,
  });
  const villainAttacking = !!s.attack && s.attack.attacker === s.villain?.id;
  switch (p.code) {
    case SINISTER_SOLDIER:
      return [SN("soldier-boost")];
    case MOLECULAR_CONTROL:
      return villainInPlay(s)
        ? [{ type: "status", target: s.villain.id, status: "tough" }]
        : [];
    case SINISTER_SCHEMES:
      return [status("confused")];
    case SINISTER_STRIKE:
      return [status("stunned")];
    case HIGH_GROUND:
      return villainAttacking ? [SN("keyword", { keyword: "piercing" })] : [];
    case ONE_STEP_AHEAD:
      return villainAttacking ? [SN("keyword", { keyword: "overkill" })] : [];
    default:
      return [];
  }
}

// ------------------------------------------------------------ actions

const ACTION_CODES = [
  AERIAL_BOMBARDMENT,
  OUT_OF_REACH,
  IMPERVIOUS,
  MANUFACTURED_DRAMA,
  SOWING_DISCORD,
];
export function sinisterActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return (
    s.attachments.find((p) => p.id === id && ACTION_CODES.includes(p.code)) ||
    s.player.inPlay.find(
      (p) =>
        p.id === id &&
        (p.code === MANUFACTURED_DRAMA || p.code === SOWING_DISCORD),
    )
  );
}
export function sinisterActions(
  s: GameState,
  p: Piece,
  ports: Pick<SinisterPorts, "canPay" | "supports">,
): Option[] {
  if (s.phase !== "player" || !active(s, p)) return [];
  const hero = s.player.form === "hero";
  const discard: Effect = { type: "discardPiece", id: p.id };
  const option = (label: string, effects: Effect[]): Option[] => [
    { id: "discard", label, image: p.code, effects },
  ];
  switch (p.code) {
    case AERIAL_BOMBARDMENT:
      if (
        !hero ||
        s.player.exhausted ||
        !ports.canPay(s, 2, ["mental", "mental"])
      )
        return [];
      return option(
        "Hero Action · exhaust your hero and spend 2 mental resources · discard Aerial Bombardment",
        [
          SN("pay", {
            id: p.id,
            resources: ["mental", "mental"],
            exhaust: true,
          }),
        ],
      );
    case OUT_OF_REACH:
      if (
        !hero ||
        s.player.exhausted ||
        !ports.canPay(s, 2, ["energy", "energy"])
      )
        return [];
      return option(
        "Hero Action · exhaust your hero and spend 2 energy resources · discard Out of Reach",
        [
          SN("pay", {
            id: p.id,
            resources: ["energy", "energy"],
            exhaust: true,
          }),
        ],
      );
    case IMPERVIOUS:
      if (!hero || !ports.canPay(s, 2, ["physical", "physical"])) return [];
      return option(
        "Hero Action · spend 2 physical resources · give the villain a tough status card and discard Impervious",
        [
          SN("pay", {
            id: p.id,
            resources: ["physical", "physical"],
            tough: true,
          }),
        ],
      );
    case MANUFACTURED_DRAMA: {
      if (
        s.player.form !== "alter" ||
        s.player.exhausted ||
        !s.player.inPlay.some((q) => q.id === p.id)
      )
        return [];
      const n = ports.supports(s, s.activePlayerId).length;
      return option(
        `Alter-Ego Action · exhaust your identity and discard ${n} card${n === 1 ? "" : "s"} from your deck · discard Manufactured Drama`,
        [
          { type: "exhaust", id: "hero" },
          ...(n ? [{ type: "mill", amount: n }] : []),
          discard,
        ],
      );
    }
    case SOWING_DISCORD:
      if (
        s.player.form !== "alter" ||
        !s.player.inPlay.some((q) => q.id === p.id) ||
        !ports.canPay(s, 2, ["mental", "mental"])
      )
        return [];
      return option(
        "Alter-Ego Action · spend 2 mental resources · discard Sowing Discord",
        [SN("pay", { id: p.id, resources: ["mental", "mental"] })],
      );
    default:
      return [];
  }
}

// ---------------------------------------------------------------- resolver

export function resolveSinisterEffect(
  s: GameState,
  e: Effect,
  ports: SinisterPorts,
): boolean {
  if (!e.type.startsWith("sin:")) return false;
  const st = s.sinister;
  switch (e.type) {
    case "sin:intent": {
      // Remove 1 random stage 2, then advance to a random stage 2A.
      if (!st || over(s)) break;
      const pool = STAGE_TWO.filter((c) => c !== st.removed);
      st.removed = pool.splice(ports.pick(s, pool.length), 1)[0];
      ports.log(s, `${name(st.removed)} is removed from the game.`, "info");
      const next = pool[ports.pick(s, pool.length)];
      ports.queue(s, SN("stage", { code: next }));
      break;
    }
    case "sin:next-stage": {
      // Advance to the other stage 2A; if you cannot, to stage 3A.
      if (!st || over(s)) break;
      const next = STAGE_TWO.find(
        (c) => c !== st.removed && !st.visited.includes(c),
      );
      if (next) ports.queue(s, SN("stage", { code: next }));
      else {
        ports.setMain(s, SINISTER_ENDS);
        // Sinister Ends (3A) When Revealed: each player is dealt a facedown
        // encounter card.
        ports.log(
          s,
          `${name(SINISTER_ENDS_A)}: each player is dealt an encounter card.`,
          "bad",
        );
        for (const seat of playerOrder(s).filter((q) => !q.eliminated))
          ports.dealEncounter(s, seat.id);
      }
      break;
    }
    case "sin:stage": {
      // Stage 2B When Revealed: the superpower attaches to the villain and
      // the rest of its set is shuffled into the encounter deck.
      if (!st) break;
      const code = String(e.code);
      st.visited.push(code);
      ports.setMain(s, code);
      const { set, power } = POWERS[code];
      const group = st.setAside.find((g) => g.set === set);
      if (!group) break;
      st.setAside = st.setAside.filter((g) => g !== group);
      const attachment = group.pieces.find((p) => p.code === power);
      const rest = group.pieces.filter((p) => p !== attachment);
      if (attachment && s.villain) {
        attachment.attachedTo = s.villain.id;
        s.attachments.push(attachment);
        ports.log(s, `${name(power)} attaches to ${name(s.villain)}.`, "bad");
      }
      s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, ...rest]);
      delete s.encounter.knownTop;
      break;
    }
    case "sin:attach": {
      const p = e.piece as Piece;
      if (!s.villain) ports.discardPiece(s, p.id);
      else ports.attach(s, p, s.villain.id);
      break;
    }
    case "sin:disguise": {
      // Sinister Disguise: spend 2 mental resources, or the damage goes to
      // the friendly character with the fewest remaining hit points; the
      // Disguise is discarded either way.
      const disguise = s.attachments.find((a) => a.id === e.id);
      if (!disguise) break;
      const n = Number(e.n);
      const options: Option[] = [];
      if (ports.canPay(s, 2, ["mental", "mental"]))
        options.push({
          id: "pay",
          label: `Spend 2 mental resources · deal ${n} damage to ${name(s.villain)}`,
          effects: [SN("disguise-pay", { id: disguise.id, n })],
        });
      options.push({
        id: "redirect",
        label: `Deal ${n} damage to the friendly character with the fewest remaining hit points`,
        effects: [
          { type: "discardPiece", id: disguise.id },
          SN("disguise-redirect", { n, playerId: e.playerId }),
        ],
      });
      ports.choose(
        s,
        name(SINISTER_DISGUISE),
        `${ports.heroName(s, e.playerId)} would deal ${n} damage to ${name(s.villain)}.`,
        options,
      );
      break;
    }
    case "sin:disguise-pay":
      ports.pay(
        s,
        2,
        ["mental", "mental"],
        [
          { type: "discardPiece", id: e.id },
          { type: "damage", target: s.villain.id, amount: e.n, source: "hero" },
        ],
        name(SINISTER_DISGUISE),
        false,
      );
      break;
    case "sin:disguise-redirect": {
      const all = ports.friendly(s);
      if (!all.length) break;
      const least = Math.min(...all.map((f) => f.hp));
      const tied = all.filter((f) => f.hp === least);
      const hit = (f: (typeof all)[number]): Effect =>
        f.target === "hero"
          ? {
              type: "damage",
              target: "hero",
              amount: e.n,
              source: SINISTER_DISGUISE,
              actorId: f.playerId,
            }
          : {
              type: "damage",
              target: f.target,
              amount: e.n,
              source: SINISTER_DISGUISE,
            };
      if (tied.length === 1) ports.queue(s, hit(tied[0]));
      else
        ports.choose(
          s,
          name(SINISTER_DISGUISE),
          "Deal the damage to the friendly character with the fewest remaining hit points.",
          tied.map((f) => ({
            id: `${f.playerId}:${f.target}`,
            label:
              f.target === "hero"
                ? ports.heroName(s, f.playerId)
                : name(
                    ports.allies(s, f.playerId).find((q) => q.id === f.target)!,
                  ),
            effects: [hit(f)],
          })),
        );
      break;
    }
    case "sin:heal":
      if (villainInPlay(s)) ports.heal(s, s.villain.id, Number(e.n));
      break;
    case "sin:genetic": {
      // Genetic Mastery: by the villain's traits.
      if (!alive(s, e.playerId)) break;
      const then: Effect[] = [];
      if (villainHas(s, "Aerial"))
        then.push(
          SN("indirect", {
            playerId: e.playerId,
            n: 2,
            source: GENETIC_MASTERY,
          }),
        );
      if (villainHas(s, "Brute"))
        then.push({ type: "exhaust", id: "hero", actorId: e.playerId });
      if (villainHas(s, "Psionic")) then.push(threat(2));
      ports.queue(s, ...then);
      break;
    }
    case "sin:indirect":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, e.n, e.source, name(e.source));
      break;
    case "sin:schemes":
      // Sinister Schemes: Mister Sinister schemes; Psionic confuses you.
      if (!alive(s, e.playerId) || !villainInPlay(s)) break;
      if (villainHas(s, "Psionic"))
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: e.playerId,
        });
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "scheme",
        modifier: 0,
      });
      break;
    case "sin:strike": {
      // Sinister Strike: surge in alter-ego form; in hero form Mister
      // Sinister attacks you, and Aerial stuns you.
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.form !== "hero") {
        ports.queue(s, { type: "surge", sourceCode: e.code });
        break;
      }
      if (!villainInPlay(s)) break;
      if (villainHas(s, "Aerial"))
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: e.playerId,
        });
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "sin:high-ground": {
      // Discard each tough status card from each friendly character; the
      // players as a group take 2 indirect damage (4 if Brute).
      for (const seat of playerOrder(s).filter((q) => !q.eliminated)) {
        clearStatuses(seatView(s, seat.id).player, ["tough"]);
        for (const q of ports.allies(s, seat.id)) clearStatuses(q, ["tough"]);
      }
      const n = villainHas(s, "Brute") ? 4 : 2;
      ports.queue(s, SN("group-indirect", { n, assigned: {} }));
      break;
    }
    case "sin:group-indirect": {
      const assigned = { ...(e.assigned as Record<string, number>) };
      const left =
        Number(e.n) - Object.values(assigned).reduce((a, b) => a + b, 0);
      const living = playerOrder(s).filter((seat) => !seat.eliminated);
      if (living.length === 1) {
        ports.indirect(
          s,
          living[0].id,
          Number(e.n),
          HIGH_GROUND,
          name(HIGH_GROUND),
        );
        break;
      }
      if (left <= 0) {
        for (const [playerId, n] of Object.entries(assigned))
          if (n && alive(s, playerId))
            ports.indirect(s, playerId, n, HIGH_GROUND, name(HIGH_GROUND));
        break;
      }
      ports.choose(
        s,
        name(HIGH_GROUND),
        `Assign the group's indirect damage (${left} left).`,
        living.map((seat) => ({
          id: seat.id,
          label: `${ports.heroName(s, seat.id)} takes 1`,
          effects: [
            SN("group-indirect", {
              n: e.n,
              assigned: {
                ...assigned,
                [seat.id]: (assigned[seat.id] || 0) + 1,
              },
            }),
          ],
        })),
      );
      break;
    }
    case "sin:take-that": {
      // Discard your lowest-cost upgrade (highest if Psionic); surge if none.
      if (!alive(s, e.playerId)) break;
      const own = ports.upgrades(s, e.playerId);
      if (!own.length) {
        ports.queue(s, { type: "surge", sourceCode: e.code });
        break;
      }
      const costs = own.map((o) => o.cost);
      const want = villainHas(s, "Psionic")
        ? Math.max(...costs)
        : Math.min(...costs);
      const tied = own.filter((o) => o.cost === want);
      if (tied.length === 1)
        ports.queue(s, { type: "discardPiece", id: tied[0].piece.id });
      else
        ports.choose(
          s,
          name(ILL_TAKE_THAT),
          "Discard one of your upgrades.",
          tied.map((o) => ({
            id: o.piece.id,
            label: `Discard ${name(o.piece)}`,
            image: o.piece.code,
            effects: [{ type: "discardPiece", id: o.piece.id }],
          })),
        );
      break;
    }
    case "sin:drama": {
      // Manufactured Drama: exhaust each support you control; surge if none.
      const supports = ports
        .supports(s, e.playerId)
        .filter((q) => !q.exhausted);
      if (!supports.length)
        ports.queue(s, { type: "surge", sourceCode: e.code });
      else
        ports.queue(s, ...supports.map((q) => ({ type: "exhaust", id: q.id })));
      break;
    }
    case "sin:discord": {
      // Sowing Discord: exhaust each ally you control; surge if none.
      const allies = ports.allies(s, e.playerId).filter((q) => !q.exhausted);
      if (!allies.length) ports.queue(s, { type: "surge", sourceCode: e.code });
      else
        ports.queue(s, ...allies.map((q) => ({ type: "exhaust", id: q.id })));
      break;
    }
    case "sin:random-discard":
      for (let i = 0; i < Number(e.n); i++)
        ports.discardRandomHand(s, e.playerId);
      break;
    case "sin:soldier-boost": {
      // Sinister Soldier's boost: for this activation, +1 SCH and +1 ATK for
      // each superpower.
      const n = superpowers(s);
      if (!n) break;
      if (s.attack && s.attack.attacker === s.villain?.id)
        s.attack.modifier = (s.attack.modifier || 0) + n;
      else if (s.scheming) s.scheming.modifier = (s.scheming.modifier || 0) + n;
      break;
    }
    case "sin:keyword":
      if (s.attack) {
        if (e.keyword === "piercing") s.attack.piercing = true;
        if (e.keyword === "overkill") s.attack.overkill = true;
      }
      break;
    case "sin:pay": {
      const p =
        s.attachments.find((a) => a.id === e.id) ||
        s.player.inPlay.find((q) => q.id === e.id);
      if (!p) break;
      const after: Effect[] = [
        ...(e.exhaust ? [{ type: "exhaust", id: "hero" }] : []),
        ...(e.tough && s.villain
          ? [{ type: "status", target: s.villain.id, status: "tough" }]
          : []),
        { type: "discardPiece", id: p.id },
      ];
      ports.pay(s, 2, e.resources as Resource[], after, name(p), true);
      break;
    }
    default:
      throw Error(`Unknown Mister Sinister effect: ${e.type}`);
  }
  return true;
}
