import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: the Sandman scenario with its required City in Chaos
 * set and the recommended Down to Earth modular set. */
export const SANDMAN_SCENARIO_CODES = [
  "27061",
  "27062",
  "27063",
  "27064a",
  "27064b",
  "27065",
  "27066",
  "27067",
  "27068",
  "27069",
  "27070",
  "27071",
  "27072",
] as const;
export const CITY_IN_CHAOS_CODES = [
  "27127",
  "27128",
  "27129",
  "27130",
] as const;
export const DOWN_TO_EARTH_CODES = [
  "27131",
  "27132",
  "27133",
  "27134",
  "27135",
] as const;
export const SANDMAN_SCRIPT_CODES = [
  ...SANDMAN_SCENARIO_CODES,
  ...CITY_IN_CHAOS_CODES,
  ...DOWN_TO_EARTH_CODES,
] as const;
/** Sinister Motives modular sets selectable in every scenario. */
export const SANDMAN_MODULAR_SETS = ["city_in_chaos", "down_to_earth"] as const;
/** Friends and Family stays in play in front of its player until its
 * Alter-Ego Action discards it. */
export const SANDMAN_IN_PLAY_OBLIGATIONS = ["27132"] as const;

const SANDMAN_VILLAINS = ["27061", "27062", "27063"];
const PEDESTRIANS = "27064b";
export const CITY_STREETS = "27065";
const SAND_FORM = "27066";
const SAND_CLONE = "27067";
const DIRT_TRAP = "27068";
const TIDAL_SANDS = "27069";
const SANDSLIDE = "27070";
const SAND_STORM = "27071";
const SAND_SMASH = "27072";
const PANIC = "27127";
const RHINO = "27128";
const CALLING_IN_FAVORS = "27129";
const NOW_OR_NEVER = "27130";
const COMMON_CRIMINAL = "27131";
const FRIENDS_AND_FAMILY = "27132";
const VOLUNTEER_WORK = "27133";
const THREAT_OR_MENACE = "27134";
const LOOSE_ENDS = "27135";
const SANDMAN_SET = "sandman";

export interface SandmanState {
  /** Acceleration tokens already answered by Hapless Pedestrians. */
  acceleration: number;
}

export interface SandmanPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  attackOf(s: GameState, id: string): number;
  randomDiscard(s: GameState, playerId: string): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  allies(s: GameState, playerId: string): Piece[];
  canDiscard(s: GameState, p: Piece): boolean;
  recover(s: GameState, playerId: string): number;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  /** The hero's own obligation, wherever it is outside the player's cards. */
  findObligation(s: GameState, playerId: string): Piece | undefined;
  changeForm(s: GameState, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => def(p)?.type_code;
const S = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sandman:${type}`,
  ...args,
});
const scripted = new Set<string>(SANDMAN_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const cityStreets = (s: GameState) =>
  (s.environments || []).find((p) => p.code === CITY_STREETS);
export const sandCounters = (s: GameState) => cityStreets(s)?.counters || 0;
const isSandman = (s: GameState, id: string) =>
  id === s.villain?.id && SANDMAN_VILLAINS.includes(s.villain.code);

// ---------------------------------------------------------------- setup

/** Hapless Pedestrians (1A): City Streets enters play with 4 sand counters. */
export function sandmanSetup(s: GameState, ports: SandmanPorts) {
  s.sandman = { acceleration: s.encounter.acceleration };
  // Hapless Pedestrians (1B) starts with 2 threat per player.
  s.scheme.threat = (def(PEDESTRIANS)?.base_threat || 0) * s.playerCount;
  const i = s.encounter.deck.findIndex((p) => p.code === CITY_STREETS);
  if (i < 0) return;
  const [streets] = s.encounter.deck.splice(i, 1);
  ports.putEnvironment(s, streets);
  streets.counters = 4;
}

/** Sandman (II) and (III) When Revealed. */
export function sandmanVillainRevealed(s: GameState): Effect[] {
  if (!s.villain || isTextBlank(s, s.villain)) return [];
  if (s.villain.code === "27062") return [S("surging")];
  if (s.villain.code === "27063")
    return [S("sand", { amount: 1 }), S("surging")];
  return [];
}

// ---------------------------------------------------------- constants

/** Sand Blast: Sandman (I) and (II)'s attacks deal indirect damage. */
export function sandmanIndirectAttack(s: GameState, attackerId: string) {
  return (
    isSandman(s, attackerId) &&
    ["27061", "27062"].includes(s.villain.code) &&
    active(s, s.villain)
  );
}

export function sandmanKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  const attacking = s.attack?.attacker === p.id;
  if (!attacking || !active(s, p)) return 0;
  // Sand Wave: Sandman (III)'s attacks gain overkill.
  if (keyword === "Overkill" && p.code === "27063" && isSandman(s, p.id))
    return 1;
  // Rhino's attacks gain overkill and piercing.
  if ((keyword === "Overkill" || keyword === "Piercing") && p.code === RHINO)
    return 1;
  return 0;
}

/** Sand Clone: ATK X, the sand counters on City Streets. */
export function sandmanEnemyAttack(s: GameState, p: Piece): number {
  if (p.code !== SAND_CLONE || !active(s, p)) return 0;
  return sandCounters(s) - Number(def(p)?.attack || 0);
}

/** Friends and Family: in hero form, each event costs 1 more. */
export function sandmanCostIncrease(s: GameState, c: Card): number {
  if (c.type_code !== "event" || s.player.form !== "hero") return 0;
  return s.player.inPlay.filter(
    (p) => p.code === FRIENDS_AND_FAMILY && active(s, p),
  ).length;
}

/** "Threat or Menace?": no form change during the player's next turn. */
export function sandmanFormLocked(s: GameState): boolean {
  return Number(s.flags.sandmanFormLock || 0) > 0;
}

/** Volunteer Work cannot be thwarted. */
export function sandmanCannotThwart(s: GameState, schemeId: string): boolean {
  return s.sideSchemes.some(
    (p) => p.id === schemeId && p.code === VOLUNTEER_WORK && active(s, p),
  );
}

/** Panic in the Streets: Location and Persona supports have blank text. */
export function sandmanPanic(s: GameState) {
  return s.sideSchemes.some((p) => p.code === PANIC);
}

// --------------------------------------------------------------- damage

/** Sand Form: damage a player would deal to Sandman discards Sand Form
 * instead and resolves Surging Sands. */
export function sandmanDamageReplacement(
  s: GameState,
  target: string,
  amount: number,
  fromPlayer: boolean,
  ports: Pick<SandmanPorts, "discardPiece" | "log">,
): Effect[] | null {
  if (amount <= 0 || !fromPlayer || !isSandman(s, target)) return null;
  const form = s.attachments.find(
    (a) => a.attachedTo === target && a.code === SAND_FORM && active(s, a),
  );
  if (!form) return null;
  ports.discardPiece(s, form.id);
  ports.log(
    s,
    "Sand Form is discarded instead of Sandman taking damage.",
    "bad",
  );
  return [S("surging")];
}

// ------------------------------------------------------------ responses

/** Sand Blast and Sand Wave: when Sandman's attack damages your identity,
 * resolve Surging Sands. */
export function sandmanAttackResponses(
  s: GameState,
  r: {
    token: string;
    attackerId: string;
    playerId: string;
    identityDamaged: boolean;
  },
): MutagenForcedResponse[] {
  if (
    !r.identityDamaged ||
    !isSandman(s, r.attackerId) ||
    !active(s, s.villain)
  )
    return [];
  return [
    {
      id: `${r.token}:sandman`,
      title: name(s.villain),
      effects: [S("surging", { playerId: r.playerId })],
    },
  ];
}

/** Dirt Trap: When Defeated, resolve Surging Sands twice. */
export function sandmanSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === DIRT_TRAP && active(s, p)
    ? [S("surging"), S("surging")]
    : [];
}

/** Sand Clone: When Defeated, resolve Surging Sands. */
export function sandmanMinionDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === SAND_CLONE ? [S("surging")] : [];
}

/** Hapless Pedestrians: after an acceleration token is placed on it, deal 3
 * indirect damage to the first player. */
export function sandmanCheck(s: GameState): Effect[] {
  const st = s.sandman;
  if (!st || over(s)) return [];
  const placed = s.encounter.acceleration - st.acceleration;
  st.acceleration = s.encounter.acceleration;
  if (placed <= 0 || s.scheme.code !== PEDESTRIANS) return [];
  return Array.from({ length: placed }, () =>
    S("pedestrians", { playerId: s.firstPlayerId, actorId: s.firstPlayerId }),
  );
}

/** A player's turn ends: release "Threat or Menace?". */
export function sandmanTurnEnded(s: GameState) {
  const lock = Number(s.flags.sandmanFormLock || 0);
  if (lock > 0) s.flags.sandmanFormLock = lock - 1;
}

// -------------------------------------------------------------- actions

/** The card whose action an ABILITY command names, if this module owns it. */
export function sandmanActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  const p =
    (s.environments || []).find(
      (q) => q.id === id && q.code === CITY_STREETS,
    ) ||
    s.minions.find((q) => q.id === id && q.code === COMMON_CRIMINAL) ||
    s.sideSchemes.find((q) => q.id === id && q.code === VOLUNTEER_WORK) ||
    s.player.inPlay.find((q) => q.id === id && q.code === FRIENDS_AND_FAMILY);
  return p && sandmanActions(s, p).length ? p : undefined;
}

export function sandmanActions(s: GameState, p: Piece): Option[] {
  if (!known(p) || !active(s, p)) return [];
  const playerId = s.activePlayerId;
  if (p.code === CITY_STREETS) {
    if (s.player.form !== "hero" && !s.player.inPlay.length) return [];
    const key = `sandmanStreets:${s.round}`;
    if (seatView(s, playerId).flags[key]) return [];
    return [
      {
        id: "streets",
        label: "Exhaust a character · remove sand counters equal to its ATK",
        image: p.code,
        effects: [S("streets", { playerId })],
      },
    ];
  }
  if (s.player.form !== "alter") return [];
  if (p.code === COMMON_CRIMINAL && s.minions.some((m) => m.id === p.id))
    return [
      {
        id: "criminal",
        label: "Spend a physical resource · deal 3 damage to Common Criminal",
        image: p.code,
        effects: [S("criminal-pay", { id: p.id, playerId })],
      },
    ];
  if (
    p.code === FRIENDS_AND_FAMILY &&
    s.player.inPlay.some((q) => q.id === p.id) &&
    s.player.hand.some((q) => def(q)?.faction_code === "hero")
  )
    return [
      {
        id: "family",
        label: "Discard an identity-specific card · discard Friends and Family",
        image: p.code,
        effects: [S("family", { id: p.id, playerId })],
      },
    ];
  if (p.code === VOLUNTEER_WORK && s.sideSchemes.some((q) => q.id === p.id))
    return [
      {
        id: "volunteer",
        label: "Spend 2 resources · remove threat equal to your REC",
        image: p.code,
        effects: [S("volunteer-pay", { id: p.id, playerId })],
      },
    ];
  return [];
}

// ----------------------------------------------------------- reveal

export function sandmanReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === SAND_FORM) return [S("attach-sandman", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  switch (p.code) {
    case TIDAL_SANDS:
      return sandCounters(s)
        ? [{ type: "threat", target: p.id, amount: sandCounters(s) }]
        : [];
    case SANDSLIDE:
      return [S("sandslide", { playerId })];
    case SAND_STORM:
      return [S("storm", { playerId, id: p.id })];
    case SAND_SMASH:
      return hero
        ? [S("smash", { playerId })]
        : [S("surging", { playerId }), { type: "surge", sourceCode: p.code }];
    case CALLING_IN_FAVORS:
      return [S("favors", { playerId, sourceCode: p.code })];
    case NOW_OR_NEVER:
      return [S("now-or-never", { playerId })];
    case THREAT_OR_MENACE:
      return [S("menace", { playerId })];
    case LOOSE_ENDS:
      return [S("loose-ends", { playerId, sourceCode: p.code })];
    default:
      return [];
  }
}

export function sandmanBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case SAND_FORM:
      return [S("form-boost", { id: p.id, playerId })];
    case SANDSLIDE:
      return [S("sandslide", { playerId })];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

/** Surging Sands: place 1 sand counter, then discard that many encounter
 * cards. Returns the discarded cards. */
function surgingSands(s: GameState, ports: SandmanPorts): Piece[] {
  const streets = cityStreets(s);
  if (!streets || over(s)) return [];
  streets.counters = (streets.counters || 0) + 1;
  const discarded: Piece[] = [];
  for (let i = 0; i < streets.counters; i++) {
    const { piece } = ports.discardTop(s);
    if (!piece) break;
    discarded.push(piece);
  }
  ports.log(
    s,
    `Surging Sands: City Streets has ${streets.counters} sand counter${streets.counters === 1 ? "" : "s"} and discards ${discarded.length} encounter card${discarded.length === 1 ? "" : "s"}.`,
    "bad",
  );
  return discarded;
}

export function resolveSandmanEffect(
  s: GameState,
  e: Effect,
  ports: SandmanPorts,
): boolean {
  if (!e.type.startsWith("sandman:")) return false;
  switch (e.type) {
    case "sandman:surging":
      surgingSands(s, ports);
      break;
    case "sandman:sand": {
      const streets = cityStreets(s);
      if (streets) streets.counters = (streets.counters || 0) + e.amount;
      break;
    }
    case "sandman:attach-sandman": {
      const p = e.piece as Piece;
      if (s.villain && SANDMAN_VILLAINS.includes(s.villain.code))
        ports.attach(s, p, s.villain.id);
      break;
    }
    case "sandman:form-boost": {
      // Sand Form's boost: reveal this card; it attaches to Sandman.
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "sandman:sandslide": {
      const streets = cityStreets(s);
      if (!streets) break;
      streets.counters = (streets.counters || 0) + 2;
      const discarded = surgingSands(s, ports);
      if (
        discarded.some((p) => def(p)?.set_code === SANDMAN_SET) &&
        alive(s, e.playerId)
      )
        ports.queue(s, {
          type: "status",
          target: `hero:${e.playerId}`,
          status: "stunned",
          actorId: e.playerId,
        });
      break;
    }
    case "sandman:storm": {
      const x = sandCounters(s);
      const streets = cityStreets(s);
      if (!x) {
        if (streets) streets.counters = 3;
        const p = s.resolving.find((q) => q.id === e.id);
        if (p) ports.shuffleIntoEncounter(s, p);
        break;
      }
      const seats = playerOrder(s).filter((seat) => !seat.eliminated);
      if (seats.length === 1) {
        ports.indirect(s, seats[0].id, x, e.id, name(SAND_STORM));
        break;
      }
      ports.queue(
        s,
        S("storm-divide", { playerId: e.playerId, left: x, shares: {} }),
      );
      break;
    }
    case "sandman:storm-divide": {
      const shares = { ...(e.shares as Record<string, number>) };
      if (e.left <= 0) {
        for (const [playerId, amount] of Object.entries(shares))
          if (amount > 0 && alive(s, playerId))
            ports.indirect(s, playerId, amount, SAND_STORM, name(SAND_STORM));
        break;
      }
      ports.choose(
        s,
        name(SAND_STORM),
        `Divide the indirect damage among players: ${e.left} left. Choose the player who takes the next 1.`,
        playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .map((seat) => ({
            id: seat.id,
            label: `${seat.id}${shares[seat.id] ? ` (${shares[seat.id]})` : ""}`,
            effects: [
              S("storm-divide", {
                playerId: e.playerId,
                left: e.left - 1,
                shares: { ...shares, [seat.id]: (shares[seat.id] || 0) + 1 },
              }),
            ],
          })),
      );
      break;
    }
    case "sandman:smash":
      if (alive(s, e.playerId) && s.villain)
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 1,
        });
      break;
    case "sandman:pedestrians":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, 3, PEDESTRIANS, name(PEDESTRIANS));
      break;
    case "sandman:favors": {
      const rhino = s.minions.find((m) => m.code === RHINO);
      if (rhino) {
        ports.activate(s, {
          enemyId: rhino.id,
          playerId: rhino.engagedWith || e.playerId,
          kind: "scheme",
          modifier: 2,
        });
        break;
      }
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const p = zone.find((q) => q.code === RHINO);
        if (p && alive(s, e.playerId)) {
          ports.putMinion(s, p, e.playerId);
          break;
        }
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "sandman:now-or-never": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      const ready = [
        ...(view.player.exhausted ? [] : [`hero:${e.playerId}`]),
        ...ports
          .allies(s, e.playerId)
          .filter((a) => !a.exhausted)
          .map((a) => a.id),
      ];
      const accelerate: Option = {
        id: "accelerate",
        label: "Place 1 acceleration token on the main scheme",
        effects: [{ type: "accelerate" }],
      };
      if (!ready.length || !ports.canPay(s, 1, []))
        ports.queue(s, ...accelerate.effects);
      else
        ports.choose(s, name(NOW_OR_NEVER), "Choose one.", [
          accelerate,
          ...ready.map((id) => ({
            id: `exhaust:${id}`,
            label: `Exhaust ${id.startsWith("hero:") ? "your identity" : name(ports.allies(s, e.playerId).find((a) => a.id === id)!)} and spend 1 resource`,
            effects: [S("now-pay", { playerId: e.playerId, id })],
          })),
        ]);
      break;
    }
    case "sandman:now-pay":
      ports.pay(
        s,
        1,
        [],
        [
          {
            type: "exhaust",
            id: e.id.startsWith("hero:") ? "hero" : e.id,
            actorId: e.playerId,
          },
        ],
        name(NOW_OR_NEVER),
        false,
      );
      break;
    case "sandman:streets": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      const ready = [
        ...(view.player.exhausted ? [] : [`hero:${e.playerId}`]),
        ...ports
          .allies(s, e.playerId)
          .filter((a) => !a.exhausted)
          .map((a) => a.id),
      ];
      if (!ready.length) throw Error("No character you control can exhaust.");
      view.flags[`sandmanStreets:${s.round}`] = true;
      ports.choose(
        s,
        "City Streets",
        "Exhaust a character you control to remove sand counters equal to its ATK.",
        ready.map((id) => ({
          id,
          label: `${id.startsWith("hero:") ? "Your identity" : name(ports.allies(s, e.playerId).find((a) => a.id === id)!)} · ATK ${ports.attackOf(s, id)}`,
          effects: [S("streets-exhaust", { playerId: e.playerId, id })],
        })),
      );
      break;
    }
    case "sandman:streets-exhaust": {
      const streets = cityStreets(s);
      const atk = Math.max(0, ports.attackOf(s, e.id));
      ports.queue(s, {
        type: "exhaust",
        id: e.id.startsWith("hero:") ? "hero" : e.id,
        actorId: e.playerId,
      });
      if (streets)
        streets.counters = Math.max(0, (streets.counters || 0) - atk);
      ports.log(
        s,
        `City Streets: ${atk} sand counter${atk === 1 ? "" : "s"} removed.`,
        "good",
      );
      break;
    }
    case "sandman:criminal-pay":
      ports.pay(
        s,
        1,
        ["physical"],
        [S("criminal", { id: e.id, playerId: e.playerId })],
        name(COMMON_CRIMINAL),
        true,
      );
      break;
    case "sandman:criminal": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p) break;
      ports.queue(
        s,
        {
          type: "damage",
          target: p.id,
          amount: 3,
          source: "hero",
          actorId: e.playerId,
        },
        S("criminal-reward", { id: p.id, playerId: e.playerId }),
      );
      break;
    }
    case "sandman:criminal-reward": {
      if (s.minions.some((m) => m.id === e.id)) break;
      const schemes = s.sideSchemes.filter((p) => p.counters > 0);
      ports.choose(
        s,
        name(COMMON_CRIMINAL),
        "Common Criminal is defeated. Choose one.",
        [
          {
            id: "draw",
            label: "Draw 1 card",
            effects: [{ type: "draw", amount: 1, actorId: e.playerId }],
          },
          ...schemes.map((p) => ({
            id: p.id,
            label: `Remove 3 threat from ${name(p)}`,
            image: p.code,
            effects: [S("remove", { id: p.id, amount: 3 })],
          })),
        ],
      );
      break;
    }
    case "sandman:family": {
      const view = seatView(s, e.playerId);
      const cards = view.player.hand.filter(
        (q) => def(q)?.faction_code === "hero",
      );
      ports.choose(
        s,
        name(FRIENDS_AND_FAMILY),
        "Discard an identity-specific card from your hand to discard Friends and Family.",
        cards.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            S("hand-discard", { playerId: e.playerId, id: q.id }),
            { type: "discardPiece", id: e.id },
          ],
        })),
      );
      break;
    }
    case "sandman:remove": {
      // Removing threat by an ability, not a thwart.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p) break;
      const removed = Math.min(p.counters, Math.max(0, e.amount));
      p.counters -= removed;
      ports.log(s, `${removed} threat is removed from ${name(p)}.`, "good");
      if (removed && !p.counters)
        ports.queue(s, { type: "defeatScheme", id: p.id, source: "hero" });
      break;
    }
    case "sandman:hand-discard":
      if (seatView(s, e.playerId).player.hand.some((q) => q.id === e.id))
        ports.discardHandCard(s, e.playerId, e.id);
      break;
    case "sandman:volunteer-pay":
      ports.pay(
        s,
        2,
        [],
        [S("volunteer", { id: e.id, playerId: e.playerId })],
        name(VOLUNTEER_WORK),
        true,
      );
      break;
    case "sandman:volunteer": {
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p) break;
      const rec = ports.recover(s, e.playerId);
      ports.queue(s, S("remove", { id: p.id, amount: rec }));
      if (ports.hasTrait(s, `hero:${e.playerId}`, "Civilian"))
        ports.queue(s, { type: "draw", amount: 1, actorId: e.playerId });
      break;
    }
    case "sandman:menace": {
      if (!alive(s, e.playerId)) break;
      ports.choose(s, name(THREAT_OR_MENACE), "You may change form.", [
        {
          id: "change",
          label: "Change form",
          effects: [S("menace-change", { playerId: e.playerId })],
        },
        {
          id: "stay",
          label: "Stay in this form",
          effects: [S("menace-result", { playerId: e.playerId })],
        },
      ]);
      break;
    }
    case "sandman:menace-change":
      ports.changeForm(s, e.playerId);
      ports.queue(s, S("menace-result", { playerId: e.playerId }));
      break;
    case "sandman:menace-result":
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.form === "hero")
        ports.queue(s, { type: "threat", target: "main", amount: 2 });
      // Revealed during the player's own turn, it lasts through their next
      // turn as well.
      else
        seatView(s, e.playerId).flags.sandmanFormLock =
          s.phase === "player" ? 2 : 1;
      break;
    case "sandman:loose-ends": {
      const obligation = ports.findObligation(s, e.playerId);
      if (!obligation || !alive(s, e.playerId)) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      const view = seatView(s, e.playerId);
      const before = view.player.form;
      // The reveal takes it from the encounter deck or discard pile; it may
      // also wait in the set-aside or removed-from-game area.
      for (const zone of [view.player.setAside || [], s.removed]) {
        const i = zone.findIndex((q) => q.id === obligation.id);
        if (i >= 0) zone.splice(i, 1);
      }
      ports.queue(s, S("loose-ends-after", { playerId: e.playerId, before }));
      ports.reveal(s, obligation, e.playerId);
      break;
    }
    case "sandman:loose-ends-after":
      if (
        e.before === "hero" &&
        alive(s, e.playerId) &&
        seatView(s, e.playerId).player.form === "alter"
      )
        ports.randomDiscard(s, e.playerId);
      break;
    default:
      return false;
  }
  return true;
}
