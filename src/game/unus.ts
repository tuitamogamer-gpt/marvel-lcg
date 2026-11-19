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

/** Age of Apocalypse's first scenario, Unus: the prelate and his Infinites
 * grow stronger with the threat on Gene Pool, which gains 3 threat whenever
 * an ally is defeated by anything other than consequential damage; with the
 * Infinites and Dystopian Nightmare modular sets, which join any scenario
 * with modular sets. */

export const UNUS_SCRIPT_CODES = [
  "45059",
  "45060",
  "45061",
  "45062a",
  "45062b",
  "45063",
  "45064",
  "45065",
  "45066",
  "45067",
  "45068",
] as const;
export const INFINITES_CODES = ["45069", "45070", "45071"] as const;
export const DYSTOPIAN_NIGHTMARE_CODES = ["45072", "45073", "45074"] as const;
/** The Age of Apocalypse modular sets imported with Unus. */
export const AOA_MODULAR_SETS = ["infinites", "dystopian_nightmare"] as const;
/** Hunted stays in its player's play area. */
export const UNUS_IN_PLAY_OBLIGATIONS = ["45072"] as const;

const STAGES = ["45059", "45060", "45061"];
export const HUNTING_GENE_TRAITORS = "45062b";
export const PRELATE_SIDEARM = "45063";
export const PRELATE_ARMOR = "45064";
export const INFINITE_HUNTER = "45065";
export const GENETIC_EXPERIMENTS = "45066";
const INFINITE_PRELATE = "45067";
export const ENDLESS_RANKS = "45068";
export const INFINITE_SOLDIER = "45069";
const CULLING_THE_WEAK = "45070";
export const GENE_POOL = "45071";
export const HUNTED = "45072";
const WAR_WEARY = "45073";
export const TARGETED_FOR_EXTERMINATION = "45074";
const ALL_CODES: readonly string[] = [
  ...UNUS_SCRIPT_CODES,
  ...INFINITES_CODES,
  ...DYSTOPIAN_NIGHTMARE_CODES,
];
/** Gene Pool's thresholds: 3, 6 and 9 threat. */
const THRESHOLDS = [3, 6, 9];
/** The Hero Responses of Prelate Sidearm and Prelate Armor. */
const PRELATE_COSTS: [string, Resource[]][] = [
  [PRELATE_SIDEARM, ["energy", "physical"]],
  [PRELATE_ARMOR, ["mental", "physical"]],
];

export interface UnusPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** The allies the player controls. */
  allies(s: GameState, playerId: string): Piece[];
  heal(s: GameState, target: string, n: number): void;
  /** Move this activation's boost card into play attached to the minion;
   * the activation does not discard it with its other boost cards. */
  attachBoost(s: GameState, id: string, minionId: string): void;
  /** Discard a card from the player's hand. */
  discardFromHand(s: GameState, playerId: string, id: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const U = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `unus:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const unus = (s: GameState) => s.villainId === "unus";
const unusInPlay = (s: GameState) =>
  unus(s) &&
  !!s.villain &&
  STAGES.includes(s.villain.code) &&
  active(s, s.villain);
const isUnus = (s: GameState, id: string | undefined) =>
  !!id && unusInPlay(s) && id === s.villain.id;
const attachedToUnus = (s: GameState, code: string) =>
  unusInPlay(s)
    ? s.attachments.filter(
        (a) => a.code === code && a.attachedTo === s.villain.id && active(s, a),
      )
    : [];
const minionPiece = (s: GameState, id: string) =>
  s.minions.find((m) => m.id === id);
const resolving = (s: GameState, id: string) =>
  s.resolving.some((q) => q.id === id);

// ---------------------------------------------------------------- Gene Pool

/** Gene Pool, which is permanent once it is in play. */
export const genePool = (s: GameState) =>
  s.sideSchemes.find((q) => q.code === GENE_POOL);
/** The threat on Gene Pool. */
export const genePoolThreat = (s: GameState) => genePool(s)?.counters || 0;
/** How many of Gene Pool's thresholds (3, 6 and 9 threat) are reached. */
export const genePoolLevel = (s: GameState) =>
  THRESHOLDS.filter((n) => genePoolThreat(s) >= n).length;
/** What Gene Pool's threat gives Unus. */
export const unusGains = (s: GameState) =>
  unus(s)
    ? ["retaliate 1", "stalwart", "an amplify icon"].slice(0, genePoolLevel(s))
    : [];
/** The villain caption: what Gene Pool gives Unus and the next threshold. */
export function unusCaption(s: GameState): string {
  const gains = unusGains(s);
  const next = ["retaliate 1 at 3", "stalwart at 6", "an amplify icon at 9"][
    gains.length
  ];
  const text = [gains.join(" · "), next ? `next: ${next}` : ""]
    .filter(Boolean)
    .join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
/** What Gene Pool's threat gives each Infinite Soldier. */
export const soldierGains = (s: GameState) =>
  ["quickstrike", "surge", "+3 hit points"].slice(0, genePoolLevel(s));

// -------------------------------------------------------------------- setup

/** Gene Pool (Setup) begins the game in play, out of the encounter deck. */
export const unusSetupCard = (code: string) => code === GENE_POOL;
/** Gene Pool begins the game in play with its starting threat whenever the
 * Infinites set is in the encounter deck; Hunting Gene Traitors (1A)
 * reveals it. */
export function genePoolSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
): void {
  if (genePool(s)) return;
  const p = ports.makePiece(s, GENE_POOL);
  const c = def(GENE_POOL);
  p.counters =
    (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
}
/** Hunting Gene Traitors (1A): in expert mode, each player is dealt a
 * facedown encounter card. */
export function unusSetupEffects(s: GameState): Effect[] {
  if (!unus(s) || s.difficulty !== "expert") return [];
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .map((seat) => U("deal", { playerId: seat.id }));
}

// ----------------------------------------------------------------- keywords

/** Unus: retaliate 1 with 3 threat on Gene Pool and stalwart with 6;
 * Infinite Soldier: quickstrike with 3 and surge with 6. */
export function unusKeyword(s: GameState, p: Piece, keyword: string): number {
  const level = genePoolLevel(s);
  if (!level) return 0;
  if (isUnus(s, p.id)) {
    if (keyword === "Retaliate") return 1;
    if (keyword === "Stalwart") return level >= 2 ? 1 : 0;
    return 0;
  }
  const m = minionPiece(s, p.id);
  if (m?.code === INFINITE_SOLDIER && active(s, m)) {
    if (keyword === "Quickstrike") return 1;
    if (keyword === "Surge") return level >= 2 ? 1 : 0;
  }
  return 0;
}
/** Unus gains an amplify icon with 9 threat on Gene Pool. */
export const unusAmplify = (s: GameState) =>
  unusInPlay(s) && genePoolLevel(s) >= 3 ? 1 : 0;
/** Genetic Experiments: +2 hit points; Infinite Soldier: +3 hit points with
 * 9 threat on Gene Pool. */
export function unusHealth(s: GameState, p: Piece): number {
  let n =
    2 *
    s.attachments.filter(
      (a) =>
        a.code === GENETIC_EXPERIMENTS && a.attachedTo === p.id && active(s, a),
    ).length;
  if (
    p.code === INFINITE_SOLDIER &&
    genePoolLevel(s) >= 3 &&
    s.minions.some((m) => m.id === p.id) &&
    active(s, p)
  )
    n += 3;
  return n;
}
/** Infinite Soldier gains surge while Gene Pool has at least 6 threat. */
export function unusRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (
    p.code === INFINITE_SOLDIER &&
    genePoolLevel(s) >= 2 &&
    !/^Surge\./m.test(c.text || "")
  )
    return { ...c, text: `Surge.\n${c.text || ""}` };
  return c;
}
/** Hunted's hazard icon counts while it is in a play area. */
export function unusHazard(s: GameState): number {
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .reduce(
      (n, seat) =>
        n +
        seatView(s, seat.id).player.inPlay.filter(
          (q) => q.code === HUNTED && active(s, q),
        ).length,
      0,
    );
}

// ------------------------------------------------------------------ reveals

export function unusReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  // The attachments enter play attached. The When Revealed pass of the same
  // reveal finds them no longer resolving.
  if (p.code === PRELATE_SIDEARM || p.code === PRELATE_ARMOR)
    return resolving(s, p.id) ? [U("attach", { piece: p })] : [];
  if (p.code === GENETIC_EXPERIMENTS)
    return resolving(s, p.id)
      ? [U("genetic", { piece: p, id: p.id, playerId })]
      : [];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case INFINITE_HUNTER:
      return [U("hunter", { id: p.id, playerId })];
    case INFINITE_PRELATE: {
      // Unus activates against you; the thresholds are read as it resolves.
      const level = genePoolLevel(s);
      return [
        U("prelate", { playerId, extraBoost: level >= 3 }),
        ...(level >= 1 ? [U("tough")] : []),
        ...(level >= 2 ? [U("heal", { n: 3 })] : []),
      ];
    }
    case CULLING_THE_WEAK:
      return [U("pool", { n: 4, source: p.code })];
    case WAR_WEARY:
      return [U("war-weary", { playerId, source: p.code })];
    default:
      return [];
  }
}
export function unusBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      INFINITE_HUNTER,
      GENETIC_EXPERIMENTS,
      CULLING_THE_WEAK,
      WAR_WEARY,
    ].includes(p.code)
  )
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case INFINITE_HUNTER:
      return [U("hunter-boost", { playerId })];
    case GENETIC_EXPERIMENTS:
      return [U("genetic", { id: p.id, playerId, boost: true })];
    case CULLING_THE_WEAK:
      return [U("pool", { n: 2, source: p.code })];
    case WAR_WEARY:
      return [U("war-weary", { playerId, source: p.code })];
    default:
      return [];
  }
}

// ------------------------------------------------------------------ windows

/** Hunting Gene Traitors: after step one of the villain phase, place 1
 * threat on Gene Pool. */
export function unusStepOne(s: GameState): Effect[] {
  return unus(s) && s.scheme.code === HUNTING_GENE_TRAITORS && genePool(s)
    ? [U("pool", { n: 1, source: HUNTING_GENE_TRAITORS })]
    : [];
}
/** Prelate Armor: after Unus schemes, he gets a tough status card. */
export function unusSchemed(s: GameState, id: string): Effect[] {
  return isUnus(s, id) && attachedToUnus(s, PRELATE_ARMOR).length
    ? [U("tough")]
    : [];
}
/** Gene Pool: 3 threat after an ally is defeated by anything other than
 * consequential damage. Prelate Sidearm: 1 more after Unus attacks and
 * defeats an ally. */
export function unusAllyDefeated(
  s: GameState,
  source: string,
  enemyAttack: boolean,
): Effect[] {
  if (!genePool(s)) return [];
  return [
    ...(source !== "consequential"
      ? [U("pool", { n: 3, source: GENE_POOL })]
      : []),
    ...(enemyAttack &&
    isUnus(s, source) &&
    attachedToUnus(s, PRELATE_SIDEARM).length
      ? [U("pool", { n: 1, source: PRELATE_SIDEARM })]
      : []),
  ];
}
/** Genetic Experiments: 2 threat on Gene Pool when its minion is defeated.
 * Read before the minion leaves play with its attachments. */
export function unusMinionDefeating(s: GameState, m: Piece): Effect[] {
  const n = s.attachments.filter(
    (a) =>
      a.code === GENETIC_EXPERIMENTS && a.attachedTo === m.id && active(s, a),
  ).length;
  return n ? [U("pool", { n: 2 * n, source: GENETIC_EXPERIMENTS })] : [];
}
/** When Defeated: Endless Ranks places 3 threat on Gene Pool, and the
 * player who defeated Targeted for Extermination confuses their identity. */
export function unusSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (p.code === ENDLESS_RANKS)
    return [U("pool", { n: 3, source: ENDLESS_RANKS })];
  if (p.code === TARGETED_FOR_EXTERMINATION && alive(s, playerId))
    return [
      { type: "status", target: "hero", status: "confused", actorId: playerId },
    ];
  return [];
}
/** Prelate Sidearm and Prelate Armor: Hero Responses after you make a basic
 * attack against Unus. */
export function unusAfterBasicAttack(
  s: GameState,
  targetId: string,
  ports?: Pick<UnusPorts, "canPay">,
): Effect[] {
  if (!isUnus(s, targetId) || s.player.form !== "hero") return [];
  return prelateOptions(s, ports).length
    ? [U("basic-response", { actorId: s.activePlayerId, mandatory: false })]
    : [];
}
function prelateOptions(
  s: GameState,
  ports?: Pick<UnusPorts, "canPay">,
): Option[] {
  const out: Option[] = [];
  for (const [code, requirements] of PRELATE_COSTS) {
    const p = attachedToUnus(s, code)[0];
    if (!p || (ports && !ports.canPay(s, 2, requirements))) continue;
    out.push({
      id: p.id,
      label: `Spend ${requirements.join(" and ")} resources · discard ${name(p)}`,
      image: p.code,
      effects: [U("prelate-pay", { id: p.id })],
    });
  }
  return out;
}

// ------------------------------------------------------------------ actions

export function unusActionSource(s: GameState, id: string): Piece | undefined {
  return s.player.inPlay.find((p) => p.id === id && p.code === HUNTED);
}
/** Hunted's Alter-Ego Action: discard a card from your hand → discard it. */
export function unusActions(s: GameState, p: Piece): Option[] {
  if (s.phase !== "player" || p.code !== HUNTED || !active(s, p)) return [];
  if (
    s.player.form !== "alter" ||
    !s.player.inPlay.some((q) => q.id === p.id) ||
    !s.player.hand.length
  )
    return [];
  return [
    {
      id: "discard",
      label:
        "Alter-Ego Action · discard a card from your hand · discard Hunted",
      image: p.code,
      effects: [U("hunted", { id: p.id, playerId: s.activePlayerId })],
    },
  ];
}

// ---------------------------------------------------------------- resolver

export function resolveUnusEffect(
  s: GameState,
  e: Effect,
  ports: UnusPorts,
): boolean {
  if (!e.type.startsWith("unus:")) return false;
  switch (e.type) {
    case "unus:deal":
      // Hunting Gene Traitors (1A), expert mode.
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      break;
    case "unus:pool": {
      const pool = genePool(s);
      const n = Number(e.n);
      if (!pool || over(s) || n <= 0) break;
      ports.log(s, `${name(e.source)}: place ${n} threat on Gene Pool.`, "bad");
      ports.queue(s, { type: "threat", target: pool.id, amount: n });
      break;
    }
    case "unus:attach": {
      // Prelate Sidearm and Prelate Armor attach to Unus.
      const p = e.piece as Piece;
      if (unusInPlay(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "unus:genetic": {
      // Attach to an Infinite minion. Otherwise, this card gains surge; as a
      // boost, nothing happens without an Infinite minion.
      const targets = s.minions.filter((m) => traits(m).includes("Infinite"));
      if (!targets.length) {
        if (!e.boost) {
          ports.queue(s, {
            type: "surge",
            sourceCode: GENETIC_EXPERIMENTS,
            sourceId: e.id,
          });
          ports.discardPiece(s, e.id);
        }
        break;
      }
      const attach = (m: Piece): Effect =>
        U("genetic-attach", {
          id: e.id,
          piece: e.piece,
          target: m.id,
          boost: !!e.boost,
        });
      if (targets.length === 1) ports.queue(s, attach(targets[0]));
      else
        ports.choose(
          s,
          name(GENETIC_EXPERIMENTS),
          "Attach Genetic Experiments to an Infinite minion.",
          targets.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [attach(m)],
          })),
        );
      break;
    }
    case "unus:genetic-attach": {
      const m = minionPiece(s, e.target);
      if (e.boost) {
        if (m) ports.attachBoost(s, e.id, m.id);
        break;
      }
      const p = e.piece as Piece;
      if (m) ports.attach(s, p, m.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "unus:hunter": {
      // Infinite Hunter: deal 3 damage to an ally you control.
      if (!alive(s, e.playerId)) break;
      const allies = ports.allies(s, e.playerId);
      const damage = (q: Piece): Effect => ({
        type: "damage",
        target: q.id,
        amount: 3,
        source: e.id,
        actorId: e.playerId,
      });
      if (allies.length === 1) ports.queue(s, damage(allies[0]));
      else if (allies.length)
        ports.choose(
          s,
          name(INFINITE_HUNTER),
          "Deal 3 damage to an ally you control.",
          allies.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [damage(q)],
          })),
        );
      break;
    }
    case "unus:hunter-boost": {
      // Infinite Hunter's boost: 2 threat on Gene Pool, or +2 SCH and +2 ATK
      // for this activation.
      const options: Option[] = [];
      if (genePool(s))
        options.push({
          id: "pool",
          label: "Place 2 threat on Gene Pool",
          image: GENE_POOL,
          effects: [U("pool", { n: 2, source: INFINITE_HUNTER })],
        });
      if (s.attack || s.scheming)
        options.push({
          id: "stats",
          label:
            "The activating enemy gets +2 SCH and +2 ATK for this activation",
          image: INFINITE_HUNTER,
          effects: [U("boost-stats", { n: 2 })],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(s, name(INFINITE_HUNTER), "Choose one.", options);
      break;
    }
    case "unus:boost-stats": {
      const n = Number(e.n);
      if (s.attack) s.attack.modifier = (s.attack.modifier || 0) + n;
      else if (s.scheming) s.scheming.modifier = (s.scheming.modifier || 0) + n;
      break;
    }
    case "unus:prelate":
      // Infinite Prelate: Unus activates against you, with an additional
      // boost card with 9 threat on Gene Pool.
      if (!alive(s, e.playerId) || !unusInPlay(s) || over(s)) break;
      if (e.extraBoost) ports.giveBoost(s, s.villain.id, "next");
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    case "unus:tough":
      if (unusInPlay(s) && !over(s))
        ports.queue(s, {
          type: "status",
          target: s.villain.id,
          status: "tough",
        });
      break;
    case "unus:heal":
      if (unusInPlay(s) && !over(s)) ports.heal(s, s.villain.id, Number(e.n));
      break;
    case "unus:war-weary":
      // You are stunned. If you were already stunned, take 2 damage instead.
      if (!alive(s, e.playerId) || over(s)) break;
      if (seatView(s, e.playerId).player.stunned)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 2,
          source: e.source,
          actorId: e.playerId,
        });
      else
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: e.playerId,
        });
      break;
    case "unus:basic-response": {
      const options = prelateOptions(s, ports);
      if (!options.length) break;
      ports.choose(s, name(s.villain), "Discard a Prelate attachment?", [
        ...options,
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    }
    case "unus:prelate-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      const cost = PRELATE_COSTS.find(([code]) => code === p.code);
      if (!cost) break;
      ports.pay(
        s,
        2,
        cost[1],
        [{ type: "discardPiece", id: p.id }],
        name(p),
        true,
      );
      break;
    }
    case "unus:hunted": {
      // Hunted's Alter-Ego Action: discard a card from your hand.
      if (!alive(s, e.playerId)) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length) break;
      ports.choose(
        s,
        name(HUNTED),
        "Discard a card from your hand to discard Hunted.",
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            U("hunted-discard", {
              id: e.id,
              cardId: q.id,
              playerId: e.playerId,
            }),
          ],
        })),
      );
      break;
    }
    case "unus:hunted-discard":
      if (!seatView(s, e.playerId).player.hand.some((q) => q.id === e.cardId))
        break;
      ports.discardFromHand(s, e.playerId, e.cardId);
      ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Unus effect: ${e.type}`);
  }
  return true;
}
