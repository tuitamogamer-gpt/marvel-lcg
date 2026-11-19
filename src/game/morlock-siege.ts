import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
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

/** NeXt Evolution's first scenario, Morlock Siege: a shuffled villain deck
 * of seven Marauders, three of whom must be routed, the Routed environment
 * and the Morlock allies; with the Military Grade and Mutant Slayers
 * modular sets, which join any scenario. */
const MARAUDER_NAMES = [
  "40070",
  "40071",
  "40072",
  "40073",
  "40074",
  "40075",
  "40076",
] as const;
export const MORLOCK_SIEGE_SCRIPT_CODES = [
  ...MARAUDER_NAMES.flatMap((code) => [`${code}a`, `${code}b`]),
  "40077a",
  "40077b",
  "40078a",
  "40078b",
  "40079",
  "40080",
  "40081a",
  "40081b",
  "40082",
  "40083",
  "40084",
  "40085",
  "40086",
  "40087",
  "40088",
  "40089",
] as const;
export const MILITARY_GRADE_CODES = [
  "40090",
  "40091",
  "40092",
  "40093",
] as const;
export const MUTANT_SLAYERS_CODES = [
  "40094",
  "40095",
  "40096",
  "40097",
  "40098",
  "40099",
  "40100",
  "40101",
  "40102",
] as const;
export const NEXT_MODULAR_SETS = [
  "military_grade",
  "mutant_slayers",
  "nasty_boys",
  "black_tom_cassidy",
  "extreme_measures",
  "mutant_insurrection",
] as const;

export const KNOCK_KNOCK = "40077b";
export const MUTANT_MASSACRE = "40078b";
export const MORLOCK = "40079";
const HIDE = "40080";
export const ROUTED_A = "40081a";
export const ROUTED_B = "40081b";
export const BOLSTERED_BY_WRATH = "40082";
export const PUSHED_TO_THE_LIMIT = "40083";
const ROUTED_SCHEMES = ["40084", "40085", "40086", "40087"];
export const TERRITORIAL_CONTROL = "40087";
const BACK_IN_ACTION = "40088";
const SEEK_THE_WEAK = "40089";
export const HEAVY_ARMAMENT = "40090";
export const TITANIUM_EXOSKELETON = "40091";
export const INHIBITOR_COLLAR = "40092";
const SENATORS_SUPPORT = "40093";
const MARAUDER_MINIONS = [
  "40094",
  "40095",
  "40096",
  "40097",
  "40098",
  "40099",
  "40100",
];
export const MUTANT_SLAYERS = "40101";
const BOUND_BY_BUSINESS = "40102";
/** The villains under Routed that win the game. */
export const ROUTED_TO_WIN = 3;

export interface MorlockSiegeState {
  /** The facedown villain deck; the villain in play is not in it. */
  villainDeck: Piece[];
  /** The defeated villains under Routed, which are not in play. */
  routed: Piece[];
  /** Hide! and the Morlock allies until Mutant Massacre. */
  setAside: Piece[];
  /** Knock counters on Knock, Knock. */
  knocks: number;
}

export interface MorlockPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  makePiece(s: GameState, code: string): Piece;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  putEnvironment(s: GameState, p: Piece): void;
  endGame(s: GameState, won: boolean, reason: string): void;
  resetPiece(p: Piece): Piece;
  /** Put the defeated villain away: discard its attachments and end any of
   * its activations still in progress. */
  retireVillain(s: GameState, villain: Piece): void;
  /** Make this card the villain in play, with its own hit points. */
  installVillain(s: GameState, p: Piece): void;
  /** Advance the main scheme to its next stage. */
  advanceMain(s: GameState): void;
  allyEntered(s: GameState, p: Piece): void;
  /** Each ally a player controls. */
  allies(s: GameState, playerId: string): Piece[];
  characterStat(
    s: GameState,
    playerId: string,
    target: string,
    stat: "attack" | "thwart",
  ): number;
  canStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  /** Cards a player controls that could be discarded, with printed costs. */
  controlledCards(s: GameState, playerId: string): Piece[];
  reveal(s: GameState, p: Piece, playerId: string): void;
  enemyStat(s: GameState, p: Piece, stat: "attack"): number;
  remainingHp(s: GameState, p: Piece): number;
  /** Characters in play with any of these traits. */
  characterTraitsCount(s: GameState, traits: string[]): number;
  heroName(s: GameState, playerId: string): string;
  removeStatus(s: GameState, id: string, status: "stunned" | "confused"): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const cost = (p: Piece) => Number(def(p)?.cost ?? NaN);
const MS = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `msg:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const routedCount = (s: GameState) => s.morlockSiege?.routed.length || 0;
export const morlockRouted = routedCount;

const isMarauderVillain = (code: string) =>
  MARAUDER_NAMES.some((c) => code === `${c}a` || code === `${c}b`);
const isMarauderMinion = (code: string) => MARAUDER_MINIONS.includes(code);
const sideB = (code: string) => code.endsWith("b");

/** Each Morlock ally in play. */
export function morlockAllies(s: GameState): Piece[] {
  return s.players.flatMap((seat) =>
    seatView(s, seat.id).player.inPlay.filter((p) => p.code === MORLOCK),
  );
}
function morlocksOf(s: GameState, playerId: string) {
  return seatView(s, playerId).player.inPlay.filter((p) => p.code === MORLOCK);
}

// ------------------------------------------------------------------- setup

/** Knock, Knock (1A): Routed enters play, Hide! and each Morlock ally are
 * set aside, and the villains are shuffled into the villain deck, the top
 * one in play. */
export function morlockSetup(s: GameState, ports: MorlockPorts) {
  const side = s.difficulty === "expert" ? "b" : "a";
  const villains = ports.shuffle(
    s,
    MARAUDER_NAMES.map((code) => ports.makePiece(s, `${code}${side}`)),
  );
  const setAside = s.encounter.deck.filter(
    (p) => p.code === HIDE || p.code === MORLOCK,
  );
  s.encounter.deck = s.encounter.deck.filter((p) => !setAside.includes(p));
  s.morlockSiege = {
    villainDeck: villains.slice(1),
    routed: [],
    setAside,
    knocks: 0,
  };
  ports.installVillain(s, villains[0]);
  const main = def(KNOCK_KNOCK);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
  ports.putEnvironment(
    s,
    ports.makePiece(s, side === "b" ? ROUTED_B : ROUTED_A),
  );
}
const routedCard = (s: GameState) =>
  (s.environments || []).find(
    (p) => p.code === ROUTED_A || p.code === ROUTED_B,
  );

// ------------------------------------------------------- villain and Routed

/** Routed: the defeated villain goes under it and the top villain of the
 * villain deck enters play, discards the minions sharing its title and
 * activates against each player. Three villains under Routed win. */
export function morlockVillainDefeated(s: GameState, ports: MorlockPorts) {
  const st = s.morlockSiege;
  if (!st) return;
  const old = s.villain;
  ports.retireVillain(s, old);
  st.routed.push(ports.resetPiece(old));
  ports.log(
    s,
    `${name(old)} is routed (${st.routed.length} of ${ROUTED_TO_WIN}).`,
    "good",
  );
  if (st.routed.length >= ROUTED_TO_WIN) {
    ports.endGame(
      s,
      true,
      "Three Marauders are routed. The Morlock Tunnels are safe.",
    );
    return;
  }
  const next = st.villainDeck.shift();
  if (!next) {
    ports.endGame(s, true, "Every Marauder is routed.");
    return;
  }
  ports.installVillain(s, next);
  ports.log(s, `${name(next)} takes the lead.`, "bad");
  const routed = routedCard(s);
  if (!routed || !active(s, routed)) return;
  for (const m of s.minions.filter((q) => name(q) === name(next)))
    ports.discardPiece(s, m.id);
  ports.queue(
    s,
    ...playerOrder(s)
      .filter((seat) => !seat.eliminated)
      .map((seat) => MS("activate", { playerId: seat.id, actorId: seat.id })),
  );
}

/** Knock, Knock: after step one of the villain phase, a knock counter. */
export function morlockStepOne(s: GameState): Effect[] {
  return s.morlockSiege && s.scheme.code === KNOCK_KNOCK
    ? [MS("knock", { actorId: s.firstPlayerId })]
    : [];
}
/** Mutant Massacre (2A) When Revealed, after the main scheme advances. */
export function morlockMainAdvanced(s: GameState, byKnocks = false): Effect[] {
  return s.morlockSiege && s.scheme.code === MUTANT_MASSACRE
    ? [MS("massacre", { byKnocks, actorId: s.firstPlayerId })]
    : [];
}
/** Mutant Massacre: the players lose with no Morlock ally in play. */
export function morlockCheck(
  s: GameState,
  ports: Pick<MorlockPorts, "endGame">,
) {
  if (
    !s.morlockSiege ||
    over(s) ||
    s.scheme.code !== MUTANT_MASSACRE ||
    morlockAllies(s).length
  )
    return;
  ports.endGame(
    s,
    false,
    "No Morlock is left standing. The Mutant Massacre is complete.",
  );
}

// ------------------------------------------------------------ keywords

export function morlockKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword === "Retaliate") {
    let n = 0;
    // Routed (expert): retaliate 1 for each villain under it.
    const routed = routedCard(s);
    if (
      p.id === s.villain?.id &&
      routed?.code === ROUTED_B &&
      active(s, routed)
    )
      n += routedCount(s);
    // Heavy Armament: retaliate 2.
    n +=
      2 *
      s.attachments.filter(
        (a) =>
          a.attachedTo === p.id && a.code === HEAVY_ARMAMENT && active(s, a),
      ).length;
    return n;
  }
  if (keyword === "Quickstrike")
    // Mutant Slayers: each Marauder minion gains quickstrike.
    return s.minions.some((m) => m.id === p.id) &&
      def(p)?.traits?.includes("Marauder") &&
      s.sideSchemes.some((q) => q.code === MUTANT_SLAYERS && active(s, q))
      ? 1
      : 0;
  return 0;
}
/** Pushed to the Limit: steady with exactly 1 villain under Routed,
 * stalwart with exactly 2. */
export function morlockStatusModifiers(
  s: GameState,
  p: Piece,
): { steady?: boolean; stalwart?: boolean } {
  if (
    p.id !== s.villain?.id ||
    !s.attachments.some(
      (a) =>
        a.attachedTo === p.id && a.code === PUSHED_TO_THE_LIMIT && active(s, a),
    )
  )
    return {};
  const n = routedCount(s);
  return n === 1 ? { steady: true } : n === 2 ? { stalwart: true } : {};
}
/** Territorial Control has assault. */
export function morlockAssault(s: GameState, id: string): boolean {
  const p = s.sideSchemes.find((q) => q.id === id);
  return !!p && p.code === TERRITORIAL_CONTROL && active(s, p);
}
/** Titanium Exoskeleton: no more than 2 damage from a single attack. */
export function morlockAttackCap(s: GameState, target: string, n: number) {
  return s.attachments.some(
    (a) =>
      a.attachedTo === target &&
      a.code === TITANIUM_EXOSKELETON &&
      active(s, a),
  )
    ? Math.min(n, 2)
    : n;
}
/** Morlocks do not count against the ally limit. */
export const morlockAllyExcluded = (s: GameState, p: Piece) =>
  p.code === MORLOCK && active(s, p);
/** Victory -1: a defeated Morlock enters the victory display. */
export const morlockVictoryAlly = (s: GameState, p: Piece) =>
  p.code === MORLOCK && active(s, p);
/** Inhibitor Collar: -1 ATK for each on the identity. */
export function morlockIdentityAttack(s: GameState, playerId: string): number {
  return -s.attachments.filter(
    (a) =>
      a.code === INHIBITOR_COLLAR &&
      a.attachedTo === `hero:${playerId}` &&
      active(s, a),
  ).length;
}

// ------------------------------------------------------------- attacks

/** The Morlock ally's Forced Interrupt: when an enemy attacks you, it
 * attacks a Morlock you control instead. */
export function morlockAttackRedirect(s: GameState, playerId: string): Piece[] {
  return morlocksOf(s, playerId).filter((p) => active(s, p));
}
/** The Marauders' Forced Interrupts when they attack you or an ally you
 * control, and Seek the Weak's overkill. */
export function morlockAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  if (!s.attack || !alive(s, playerId)) return [];
  const out: Effect[] = [];
  const seek = `msgOverkill:${attackerId}`;
  if (s.flags[seek]) {
    delete s.flags[seek];
    s.attack.overkill = true;
  }
  const p =
    attackerId === s.villain?.id
      ? s.villain
      : s.minions.find((m) => m.id === attackerId);
  if (
    p &&
    (isMarauderVillain(p.code) || isMarauderMinion(p.code)) &&
    active(s, p)
  )
    out.push(MS("marauder", { id: p.id, code: p.code, playerId }));
  return out;
}
/** Additional boost cards given before the attack's boosts were dealt. */
export function morlockAdditionalBoosts(s: GameState): number {
  const n = Number(s.flags.msgExtraBoosts || 0);
  delete s.flags.msgExtraBoosts;
  return n;
}
/** Heavy Armament's Hero Response after you attack the attached enemy. */
export function morlockAfterAttack(
  s: GameState,
  enemyId: string,
  playerId: string,
  ports: Pick<MorlockPorts, "canPay">,
): Effect[] {
  const armament = s.attachments.find(
    (a) =>
      a.attachedTo === enemyId && a.code === HEAVY_ARMAMENT && active(s, a),
  );
  if (!armament || seatView(s, playerId).player.form !== "hero") return [];
  return RESOURCE_TYPES.some((r) => ports.canPay(s, 2, [r, r]))
    ? [MS("armament-offer", { id: armament.id, playerId, actorId: playerId })]
    : [];
}
const RESOURCE_TYPES: Resource[] = ["energy", "mental", "physical"];

// ----------------------------------------------------------- reveal/boost

export function morlockReveal(s: GameState, p: Piece): Effect[] | null {
  const code = p.code;
  if (
    !(MORLOCK_SIEGE_SCRIPT_CODES as readonly string[]).includes(code) &&
    !(MILITARY_GRADE_CODES as readonly string[]).includes(code) &&
    !(MUTANT_SLAYERS_CODES as readonly string[]).includes(code)
  )
    return null;
  const playerId = s.activePlayerId;
  if ([BOLSTERED_BY_WRATH, PUSHED_TO_THE_LIMIT].includes(code))
    return [MS("attach-villain", { piece: p })];
  if (code === HEAVY_ARMAMENT)
    return [MS("attach-enemy", { piece: p, by: "attack" })];
  if (code === TITANIUM_EXOSKELETON)
    return [MS("attach-enemy", { piece: p, by: "hp" })];
  if (code === INHIBITOR_COLLAR)
    return [MS("attach-identity", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  if (ROUTED_SCHEMES.includes(code)) {
    const n = routedCount(s) * s.playerCount;
    return n ? [{ type: "threat", target: p.id, amount: n }] : [];
  }
  switch (code) {
    case HIDE:
      return [MS("hide-tough", { playerId })];
    case BACK_IN_ACTION:
      return [
        { type: "status", target: s.villain.id, status: "tough" },
        ...(routedCount(s)
          ? [{ type: "threat", target: "main", amount: routedCount(s) }]
          : []),
      ];
    case SEEK_THE_WEAK:
      return [MS("seek", { playerId })];
    case MUTANT_SLAYERS:
      return [MS("slayers-threat", { id: p.id })];
    case BOUND_BY_BUSINESS:
      return [MS("bound", { playerId })];
    default:
      return [];
  }
}
export function morlockBoost(s: GameState, p: Piece): Effect[] | null {
  const code = p.code;
  if (![HIDE, BOLSTERED_BY_WRATH, BACK_IN_ACTION, SEEK_THE_WEAK].includes(code))
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (code) {
    case HIDE:
      return [MS("hide-tough", { playerId }), MS("extra-boost")];
    case BOLSTERED_BY_WRATH:
      return [MS("bolstered-boost")];
    case BACK_IN_ACTION:
      return [MS("back-boost", { playerId })];
    case SEEK_THE_WEAK:
      return [MS("seek-boost")];
    default:
      return [];
  }
}
export function morlockSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === SENATORS_SUPPORT && active(s, p)
    ? [MS("senator", { actorId: s.firstPlayerId })]
    : [];
}

// --------------------------------------------------------------- actions

/** Actions on encounter cards: the attachments' Hero Actions, Inhibitor
 * Collar's Action and Mutant Massacre's Action on each Morlock ally. */
export function morlockActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  const a = s.attachments.find(
    (p) =>
      p.id === id &&
      [
        BOLSTERED_BY_WRATH,
        PUSHED_TO_THE_LIMIT,
        TITANIUM_EXOSKELETON,
        INHIBITOR_COLLAR,
      ].includes(p.code),
  );
  if (a) return a;
  return s.morlockSiege && s.scheme.code === MUTANT_MASSACRE
    ? s.player.inPlay.find((p) => p.id === id && p.code === MORLOCK)
    : undefined;
}
export function morlockActions(
  s: GameState,
  p: Piece,
  ports: Pick<MorlockPorts, "canPay" | "allies" | "remainingHp" | "canStatus">,
): Option[] {
  if (s.phase !== "player") return [];
  const exhaustable =
    !s.player.exhausted ||
    ports.allies(s, s.activePlayerId).some((q) => !q.exhausted);
  switch (p.code) {
    case BOLSTERED_BY_WRATH: {
      // Hero Action: exhaust a character you control and spend X
      // resources, X being the villains under Routed.
      const x = routedCount(s);
      if (
        !active(s, p) ||
        s.player.form !== "hero" ||
        !exhaustable ||
        (x && !ports.canPay(s, x, []))
      )
        return [];
      return [
        {
          id: "discard",
          label: `Hero Action · exhaust a character and spend ${x} resource${x === 1 ? "" : "s"} · discard Bolstered by Wrath`,
          image: p.code,
          effects: [MS("bolstered-pay", { id: p.id, x })],
        },
      ];
    }
    case PUSHED_TO_THE_LIMIT:
      if (!active(s, p) || s.player.form !== "hero") return [];
      return [
        {
          id: "discard",
          label:
            "Hero Action · the villain attacks you · discard Pushed to the Limit",
          image: p.code,
          effects: [
            MS("pushed-attack", { playerId: s.activePlayerId }),
            { type: "discardPiece", id: p.id },
          ],
        },
      ];
    case TITANIUM_EXOSKELETON: {
      if (!active(s, p) || s.player.form !== "hero") return [];
      const host =
        p.attachedTo === s.villain?.id
          ? s.villain
          : s.minions.find((m) => m.id === p.attachedTo);
      const out: Option[] = [];
      if (ports.canPay(s, 3, []))
        out.push({
          id: "pay",
          label:
            "Hero Action · spend 3 resources · discard Titanium Exoskeleton",
          image: p.code,
          effects: [MS("titanium-pay", { id: p.id })],
        });
      if (host && (host.stunned || host.confused))
        out.push({
          id: "status",
          label: `Hero Action · remove a status from ${name(host)} · discard Titanium Exoskeleton`,
          image: p.code,
          effects: [MS("titanium-status", { id: p.id, host: host.id })],
        });
      return out;
    }
    case INHIBITOR_COLLAR: {
      // Action (any player): exhaust a character you control or take 3
      // damage → discard.
      const out: Option[] = [];
      if (exhaustable)
        out.push({
          id: "exhaust",
          label:
            "Action · exhaust a character you control · discard Inhibitor Collar",
          image: p.code,
          effects: [MS("collar-exhaust", { id: p.id })],
        });
      out.push({
        id: "damage",
        label: "Action · take 3 damage · discard Inhibitor Collar",
        image: p.code,
        effects: [
          { type: "damage", target: "hero", amount: 3, source: p.id },
          { type: "discardPiece", id: p.id },
        ],
      });
      return active(s, p) ? out : [];
    }
    case MORLOCK: {
      // Mutant Massacre: exhaust a Morlock → shuffle Hide! from the
      // encounter discard pile into the encounter deck.
      if (
        p.exhausted ||
        s.scheme.code !== MUTANT_MASSACRE ||
        !s.encounter.discard.some((q) => q.code === HIDE)
      )
        return [];
      return [
        {
          id: "hide",
          label:
            "Action · exhaust this Morlock · shuffle Hide! into the encounter deck",
          image: MUTANT_MASSACRE,
          effects: [{ type: "exhaust", id: p.id }, MS("hide-back")],
        },
      ];
    }
    default:
      return [];
  }
}

// ----------------------------------------------------- Marauder choices

interface Choice {
  id: string;
  label: string;
  effects: Effect[];
}
function bonus(
  id: string,
  atk: number,
  extra: Record<string, unknown> = {},
): Effect {
  return MS("marauder-bonus", { attacker: id, atk, ...extra });
}
function marauderChoices(
  s: GameState,
  e: Effect,
  ports: MorlockPorts,
): Choice[] {
  const code = e.code as string;
  const playerId = e.playerId as string;
  const b = sideB(code) && isMarauderVillain(code);
  const title = name(code);
  const mine = [
    `hero:${playerId}`,
    ...ports.allies(s, playerId).map((p) => p.id),
  ];
  const label = (target: string) =>
    target.startsWith("hero:")
      ? ports.heroName(s, target.slice(5))
      : name(ports.allies(s, playerId).find((p) => p.id === target)!);
  const highest = (stat: "attack" | "thwart") => {
    const values = mine.map((t) => ({
      t,
      n: ports.characterStat(s, playerId, t, stat),
    }));
    const max = Math.max(...values.map((v) => v.n));
    return values.filter((v) => v.n === max).map((v) => v.t);
  };
  const statusChoices = (
    status: "confused" | "stunned",
    targets: string[],
  ): Choice[] =>
    targets
      .filter((t) => ports.canStatus(s, t, status))
      .map((t) => ({
        id: `${status}:${t}`,
        label: `${status === "confused" ? "Confuse" : "Stun"} ${label(t)}`,
        effects: [{ type: "status", target: t, status }],
      }));
  const plus2 = (extra: Record<string, unknown> = {}, text = "") => ({
    id: "bonus",
    label: `${title} gets +2 ATK for this attack${text}`,
    effects: [bonus(e.id as string, 2, extra)],
  });
  const base = title;
  switch (base) {
    case "Arclight":
      return [
        ...statusChoices("confused", b ? highest("thwart") : mine),
        plus2(),
      ];
    case "Vertigo":
      return [
        ...statusChoices("stunned", b ? highest("attack") : mine),
        plus2(),
      ];
    case "Blockbuster": {
      const out: Choice[] = [];
      if (ports.canStatus(s, e.id as string, "tough"))
        out.push({
          id: "tough",
          label: `Give ${title} a tough status card`,
          effects: [{ type: "status", target: e.id, status: "tough" }],
        });
      out.push(b ? plus2({ overkill: true }, " and overkill") : plus2());
      return out;
    }
    case "Chimera": {
      const n = b ? 2 : 1;
      const out: Choice[] = [];
      if (ports.canPay(s, n, Array(n).fill("mental")))
        out.push({
          id: "mental",
          label: `Spend ${n === 1 ? "a [mental] resource" : "[mental][mental] resources"}`,
          effects: [MS("chimera-pay", { n })],
        });
      out.push(plus2());
      return out;
    }
    case "Greycrow": {
      const cards = ports
        .controlledCards(s, playerId)
        .filter((p) => !Number.isNaN(cost(p)));
      const top = cards.length ? Math.max(...cards.map(cost)) : 0;
      const highestCards = cards.filter((p) => cost(p) === top);
      const out: Choice[] = [];
      if (highestCards.length)
        out.push(
          b
            ? {
                id: "discard",
                label: `Discard each card you control with cost ${top}`,
                effects: highestCards.map((p) => ({
                  type: "discardPiece",
                  id: p.id,
                })),
              }
            : {
                id: "discard",
                label: `Discard the highest-cost card you control (cost ${top})`,
                effects: [
                  MS("greycrow-discard", {
                    ids: highestCards.map((p) => p.id),
                  }),
                ],
              },
        );
      out.push({
        id: "bonus",
        label: `${title} gets +${top} ATK for this attack`,
        effects: [bonus(e.id as string, top)],
      });
      return out;
    }
    case "Harpoon": {
      const n = isMarauderVillain(code) ? (b ? 3 : 2) : 2;
      const out: Choice[] = [
        {
          id: "indirect",
          label: `Take ${n} indirect damage`,
          effects: [MS("indirect", { playerId, n, source: e.id })],
        },
      ];
      if (isMarauderVillain(code))
        out.push({
          id: "bonus",
          label: `Give ${title} 1 additional facedown boost card${b ? " and overkill" : ""}`,
          effects: [
            MS("extra-boost"),
            ...(b ? [bonus(e.id as string, 0, { overkill: true })] : []),
          ],
        });
      else out.push(plus2({ piercing: true }, " and piercing"));
      return out;
    }
    case "Riptide": {
      const n = isMarauderVillain(code) && b ? 3 : 2;
      return [
        {
          id: "threat",
          label: `Place ${n} threat on the main scheme and 1 on each side scheme`,
          effects: [
            { type: "threat", target: "main", amount: n },
            ...s.sideSchemes.map((q) => ({
              type: "threat",
              target: q.id,
              amount: 1,
            })),
          ],
        },
        b
          ? plus2({ piercing: true, ranged: true }, " and ranged and piercing")
          : plus2(),
      ];
    }
    default:
      return [plus2()];
  }
}

// ---------------------------------------------------------------- resolver

export function resolveMorlockEffect(
  s: GameState,
  e: Effect,
  ports: MorlockPorts,
): boolean {
  if (!e.type.startsWith("msg:")) return false;
  const st = s.morlockSiege;
  switch (e.type) {
    case "msg:activate": {
      // Routed: the new villain activates against each player.
      if (!alive(s, e.playerId) || over(s) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "msg:knock": {
      if (!st || s.scheme.code !== KNOCK_KNOCK || over(s)) break;
      st.knocks++;
      ports.log(
        s,
        `A knock counter on Knock, Knock (${st.knocks} of 3).`,
        "bad",
      );
      if (st.knocks < 3) break;
      ports.advanceMain(s);
      ports.queue(s, ...morlockMainAdvanced(s, true));
      break;
    }
    case "msg:massacre": {
      // Mutant Massacre (2A): each player puts a set-aside Morlock ally
      // into play (two in a solo game), and Hide! is shuffled in.
      if (!st) break;
      const order = playerOrder(s).filter((seat) => !seat.eliminated);
      const each = s.playerCount === 1 ? 2 : 1;
      const morlocks: Piece[] = [];
      for (const seat of order)
        for (let i = 0; i < each; i++) {
          const index = st.setAside.findIndex((p) => p.code === MORLOCK);
          if (index < 0) break;
          const [p] = st.setAside.splice(index, 1);
          p.ownerId = undefined;
          seatView(s, seat.id).player.inPlay.push(p);
          morlocks.push(p);
          ports.allyEntered(s, p);
        }
      const hide = st.setAside.findIndex((p) => p.code === HIDE);
      if (hide >= 0) {
        const [p] = st.setAside.splice(hide, 1);
        s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, p]);
        delete s.encounter.knownTop;
      }
      ports.log(
        s,
        `${morlocks.length} Morlock${morlocks.length === 1 ? "" : "s"} join the heroes.`,
        "good",
      );
      if (e.byKnocks)
        ports.queue(
          s,
          ...morlocks.map((p) => ({
            type: "status",
            target: p.id,
            status: "tough",
          })),
        );
      break;
    }
    case "msg:check":
      morlockCheck(s, ports);
      break;
    case "msg:hide-back": {
      const i = s.encounter.discard.findIndex((p) => p.code === HIDE);
      if (i < 0) break;
      const [p] = s.encounter.discard.splice(i, 1);
      s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, p]);
      delete s.encounter.knownTop;
      ports.log(s, "Hide! is shuffled back into the encounter deck.", "good");
      break;
    }
    case "msg:hide-tough": {
      const morlocks = morlockAllies(s).filter(
        (p) => !p.tough && ports.canStatus(s, p.id, "tough"),
      );
      if (morlocks.length === 1)
        ports.queue(s, {
          type: "status",
          target: morlocks[0].id,
          status: "tough",
        });
      else if (morlocks.length)
        ports.choose(
          s,
          name(HIDE),
          "Give 1 Morlock ally a tough status card.",
          morlocks.map((p) => ({
            id: p.id,
            label: `${name(p)} · ${ports.heroName(s, controllerOf(s, p.id) || s.activePlayerId)}`,
            image: p.code,
            effects: [{ type: "status", target: p.id, status: "tough" }],
          })),
        );
      break;
    }
    case "msg:extra-boost":
      // Before the attack's boost cards are dealt, the additional card is
      // dealt with them.
      if (s.attack?.attacker === s.villain?.id && !s.attack?.pendingBoosts)
        s.flags.msgExtraBoosts = Number(s.flags.msgExtraBoosts || 0) + 1;
      else if (
        s.villain &&
        (s.attack?.attacker === s.villain.id ||
          s.scheming?.attacker === s.villain.id)
      )
        ports.giveBoost(s, s.villain.id, "current");
      break;
    case "msg:bolstered-boost": {
      // This card gets +X boost icons, X being the villains under Routed.
      const activation = s.attack || s.scheming;
      if (activation)
        activation.extraBoostIcons =
          (activation.extraBoostIcons || 0) + routedCount(s);
      break;
    }
    case "msg:back-boost": {
      const morlocks = morlocksOf(s, e.playerId);
      if (!morlocks.length || !alive(s, e.playerId)) break;
      const options: Option[] = morlocks.map((p) => ({
        id: `damage:${p.id}`,
        label: `Deal 1 damage to ${name(p)}`,
        image: p.code,
        effects: [
          { type: "damage", target: p.id, amount: 1, source: BACK_IN_ACTION },
        ],
      }));
      if (ports.canPay(s, 1, []))
        options.unshift({
          id: "pay",
          label: "Spend 1 resource of any type",
          effects: [MS("pay", { n: 1, title: name(BACK_IN_ACTION) })],
        });
      ports.choose(s, name(BACK_IN_ACTION), "Choose one.", options);
      break;
    }
    case "msg:pay":
      ports.pay(s, e.n, e.types || [], [], e.title, false);
      break;
    case "msg:seek": {
      // When Revealed (Alter-Ego): surge. (Hero): the villain attacks you,
      // with overkill if a villain is under Routed.
      if (!alive(s, e.playerId) || !s.villain) break;
      if (seatView(s, e.playerId).player.form !== "hero") {
        ports.queue(s, { type: "surge", sourceCode: SEEK_THE_WEAK });
        break;
      }
      if (routedCount(s)) s.flags[`msgOverkill:${s.villain.id}`] = true;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "msg:seek-boost":
      if (s.attack) s.attack.overkill = true;
      break;
    case "msg:attach-villain": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "msg:attach-enemy": {
      // Heavy Armament: the enemy with the highest ATK; Titanium
      // Exoskeleton: the enemy with the fewest remaining hit points.
      const p = e.piece as Piece;
      const enemies = [s.villain, ...s.minions].filter(Boolean) as Piece[];
      const value = (q: Piece) =>
        e.by === "attack"
          ? ports.enemyStat(s, q, "attack")
          : -ports.remainingHp(s, q);
      const best = Math.max(...enemies.map(value));
      const tied = enemies.filter((q) => value(q) === best);
      if (tied.length === 1) ports.attach(s, p, tied[0].id);
      else
        ports.choose(
          s,
          name(p),
          `Attach ${name(p)} to ${e.by === "attack" ? "the enemy with the highest ATK" : "the enemy with the fewest remaining hit points"}.`,
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [MS("attach-to", { piece: p, target: q.id })],
          })),
        );
      break;
    }
    case "msg:attach-to":
      ports.attach(s, e.piece as Piece, e.target);
      break;
    case "msg:attach-identity":
      ports.attach(s, e.piece as Piece, `hero:${e.playerId}`);
      break;
    case "msg:marauder": {
      if (!s.attack || over(s) || !alive(s, e.playerId)) break;
      const choices = marauderChoices(s, e, ports);
      if (choices.length === 1) {
        ports.queue(s, ...choices[0].effects);
        break;
      }
      ports.choose(
        s,
        name(e.code),
        `${name(e.code)} attacks. Choose one.`,
        choices.map((c) => ({ id: c.id, label: c.label, effects: c.effects })),
      );
      break;
    }
    case "msg:marauder-bonus": {
      const a = s.attack;
      if (!a || a.attacker !== e.attacker) break;
      const atk = Number(e.atk || 0);
      a.modifier = (a.modifier || 0) + atk;
      // The initiation window still to come restores the modifier it
      // captured; it carries this bonus too.
      const carry = (q: Effect) => {
        if (
          q.type === "enemyAttackInitiationWindow" &&
          q.attacker === e.attacker &&
          typeof q.modifier === "number"
        )
          q.modifier += atk;
        for (const next of (q.after as Effect[] | undefined) || []) carry(next);
      };
      for (const q of s.queue) carry(q);
      if (e.overkill) a.overkill = true;
      if (e.piercing) a.piercing = true;
      if (e.ranged)
        a.badoonKeywords = [
          ...new Set([...(a.badoonKeywords || []), "Ranged"]),
        ];
      break;
    }
    case "msg:chimera-pay":
      ports.pay(s, e.n, Array(e.n).fill("mental"), [], name("40072a"), false);
      break;
    case "msg:greycrow-discard": {
      const ids = (e.ids as string[]).filter((id) =>
        ports.controlledCards(s, s.activePlayerId).some((p) => p.id === id),
      );
      if (ids.length === 1) ports.discardPiece(s, ids[0]);
      else if (ids.length)
        ports.choose(
          s,
          "Greycrow",
          "Discard the highest-cost card you control.",
          ids.map((id) => {
            const p = ports
              .controlledCards(s, s.activePlayerId)
              .find((q) => q.id === id)!;
            return {
              id,
              label: name(p),
              image: p.code,
              effects: [{ type: "discardPiece", id }],
            };
          }),
        );
      break;
    }
    case "msg:indirect":
      ports.indirect(s, e.playerId, e.n, e.source, "Harpoon");
      break;
    case "msg:bolstered-pay": {
      const then = [
        MS("exhaust-one", { then: [{ type: "discardPiece", id: e.id }] }),
      ];
      if (!e.x) ports.queue(s, ...then);
      else ports.pay(s, e.x, [], then, name(BOLSTERED_BY_WRATH), true);
      break;
    }
    case "msg:exhaust-one":
    case "msg:collar-exhaust": {
      const then: Effect[] =
        e.type === "msg:collar-exhaust"
          ? [{ type: "discardPiece", id: e.id }]
          : (e.then as Effect[]) || [];
      const options: Option[] = [];
      if (!s.player.exhausted)
        options.push({
          id: "hero",
          label: "Exhaust your identity",
          effects: [{ type: "exhaust", id: "hero" }, ...then],
        });
      for (const q of ports
        .allies(s, s.activePlayerId)
        .filter((x) => !x.exhausted))
        options.push({
          id: q.id,
          label: `Exhaust ${name(q)}`,
          image: q.code,
          effects: [{ type: "exhaust", id: q.id }, ...then],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(
          s,
          "Exhaust a character",
          "Exhaust a character you control.",
          options,
        );
      break;
    }
    case "msg:pushed-attack":
      if (!s.villain || !alive(s, e.playerId)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    case "msg:titanium-pay":
      ports.pay(
        s,
        3,
        [],
        [{ type: "discardPiece", id: e.id }],
        name(TITANIUM_EXOSKELETON),
        true,
      );
      break;
    case "msg:titanium-status": {
      const host =
        e.host === s.villain?.id
          ? s.villain
          : s.minions.find((m) => m.id === e.host);
      if (!host) break;
      const statuses = (["stunned", "confused"] as const).filter(
        (k) => host[k],
      );
      const discard = { type: "discardPiece", id: e.id };
      if (statuses.length === 1) {
        ports.removeStatus(s, host.id, statuses[0]);
        ports.queue(s, discard);
      } else if (statuses.length)
        ports.choose(
          s,
          name(TITANIUM_EXOSKELETON),
          `Remove a status card from ${name(host)}.`,
          statuses.map((k) => ({
            id: k,
            label: `Remove ${k}`,
            effects: [
              MS("remove-status", { host: host.id, status: k }),
              discard,
            ],
          })),
        );
      break;
    }
    case "msg:remove-status":
      ports.removeStatus(s, e.host, e.status);
      break;
    case "msg:armament-offer": {
      const armament = s.attachments.find((a) => a.id === e.id);
      if (!armament || !alive(s, e.playerId)) break;
      const types = RESOURCE_TYPES.filter((r) => ports.canPay(s, 2, [r, r]));
      if (!types.length) break;
      ports.choose(
        s,
        name(HEAVY_ARMAMENT),
        "After you attack the attached enemy: spend 2 resources of the same type to discard Heavy Armament?",
        [
          ...types.map((r) => ({
            id: r,
            label: `Spend 2 ${r} resources · discard Heavy Armament`,
            effects: [MS("pay-same", { resource: r, id: e.id })],
          })),
          { id: "pass", label: "Do not respond", effects: [] },
        ],
      );
      break;
    }
    case "msg:pay-same":
      ports.pay(
        s,
        2,
        [e.resource, e.resource] as Resource[],
        [{ type: "discardPiece", id: e.id }],
        name(HEAVY_ARMAMENT),
        true,
      );
      break;
    case "msg:senator": {
      // The first player discards encounter cards until an attachment is
      // discarded, and reveals it.
      const limit = s.encounter.deck.length + s.encounter.discard.length;
      for (let i = 0; i <= limit; i++) {
        const { piece } = ports.discardTop(s);
        if (!piece) break;
        if (def(piece)?.type_code === "attachment") {
          s.encounter.discard = s.encounter.discard.filter(
            (q) => q.id !== piece.id,
          );
          ports.reveal(s, piece, s.firstPlayerId);
          break;
        }
      }
      break;
    }
    case "msg:slayers-threat": {
      const n = ports.characterTraitsCount(s, [
        "Mutant",
        "X-Factor",
        "X-Force",
        "X-Men",
      ]);
      if (n) ports.queue(s, { type: "threat", target: e.id, amount: n });
      break;
    }
    case "msg:bound": {
      // Discard until a Marauder minion that shares no title with a card in
      // play is discarded; it enters play engaged with you.
      if (!alive(s, e.playerId)) break;
      const titles = new Set(
        [
          s.villain,
          ...s.minions,
          ...s.attachments,
          ...s.sideSchemes,
          ...(s.environments || []),
          ...s.players.flatMap((seat) => seatView(s, seat.id).player.inPlay),
        ]
          .filter(Boolean)
          .map((p) => name(p as Piece)),
      );
      const limit = s.encounter.deck.length + s.encounter.discard.length;
      for (let i = 0; i <= limit; i++) {
        const { piece } = ports.discardTop(s);
        if (!piece) break;
        const c = def(piece);
        if (
          c?.type_code === "minion" &&
          c.traits?.includes("Marauder") &&
          !titles.has(c.name)
        ) {
          ports.putMinion(s, piece, e.playerId);
          break;
        }
      }
      break;
    }
    default:
      throw Error(`Unknown Morlock Siege effect: ${e.type}`);
  }
  return true;
}
function controllerOf(s: GameState, id: string) {
  return s.players.find((seat) =>
    seatView(s, seat.id).player.inPlay.some((p) => p.id === id),
  )?.id;
}
