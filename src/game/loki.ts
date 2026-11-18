import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { printedKeyword } from "./keywords.js";
import { seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** The Mad Titan's Shadow, scenario 5: Loki, who also uses the Infinity
 * Gauntlet set. The Enchantress modular set reprints Valkyrie's nemesis
 * Enchantress, Beguiled and Seduced; those rules live with Valkyrie. */
export const LOKI_SCENARIO_CODES = [
  "21160",
  "21161",
  "21162",
  "21163",
  "21164",
  "21165a",
  "21165b",
  "21166",
  "21167",
  "21168",
  "21169",
  "21170",
  "21171",
  "21172",
  "21173",
  "21174",
  "21175",
  "21176",
] as const;
export const ENCHANTRESS_CODES = ["21177", "21178", "21179"] as const;
export const LOKI_SCRIPT_CODES = [
  ...LOKI_SCENARIO_CODES,
  ...ENCHANTRESS_CODES,
] as const;
/** Five different stage I Lokis; one is in play, the rest are set aside. */
export const LOKI_VILLAINS = [
  "21160",
  "21161",
  "21162",
  "21163",
  "21164",
] as const;
export const ALL_HAIL_KING_LOKI = "21165b";
export const WAR_IN_ASGARD = "21167";
const LOKI_SIDE_SCHEMES = ["21166", "21167", "21168", "21169"];
/** "Loki cannot take damage while a side scheme is in play." */
const UNTOUCHABLE = "21160";
/** "[star] Loki's attacks gain piercing." */
const PIERCING_LOKI = "21164";
const STAFF = "21170";
const CROWN = "21171";
const CAPE = "21172";
const ILLUSIONS = "21173";
const SORCERY = "21174";
const MISCHIEF = "21175";
const TRICKSTER = "21176";

export interface LokiState {
  /** The set-aside Loki villain cards. */
  setAside: Piece[];
  /** Lokis in the victory display needed to win. */
  victoryCondition: number;
  /** The Infinity Stone deck, top first, and its discard pile. */
  stoneDeck: Piece[];
  stoneDiscard: Piece[];
}

export interface LokiPorts extends MutagenEnginePorts {
  /** Reveal an actual encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  giveTough(s: GameState, p: Piece): boolean;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** Put another physical Loki card in the villain's place, carrying its
   * attachments and any activation in progress. */
  replaceVillain(s: GameState, old: Piece, next: Piece): void;
  resetPiece(p: Piece): Piece;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => definitions.get(p.code)?.type_code;
const L = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `loki:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (LOKI_SCENARIO_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const attached = (s: GameState, code: string, hostId = s.villain.id) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === hostId && !isTextBlank(s, a),
  );
export const isLokiCard = (p: Piece | string) =>
  (LOKI_VILLAINS as readonly string[]).includes(
    typeof p === "string" ? p : p.code,
  );

export function isLoki(s: GameState) {
  return !!s.loki && isLokiCard(s.villain);
}
/** The Lokis in the victory display. */
export function lokiVictories(s: GameState) {
  return (s.victoryDisplay || []).filter(isLokiCard).length;
}
/** Lokis to defeat: two in Standard, three in Expert and four in Heroic. */
export function lokiVictoryCondition(
  difficulty: GameState["difficulty"],
  heroic = 0,
) {
  return heroic > 0 ? 4 : difficulty === "expert" ? 3 : 2;
}

/** Take a random set-aside Loki. */
function takeRandom(s: GameState, ports: LokiPorts): Piece | undefined {
  const l = s.loki;
  if (!l || !l.setAside.length) return undefined;
  const [pick] = ports.shuffle(s, [...l.setAside]);
  l.setAside = l.setAside.filter((p) => p.id !== pick.id);
  return pick;
}
/** A Loki who gains stalwart discards his stunned and confused status cards
 * (scenario rules clarification). */
function stalwartClears(s: GameState) {
  const v = s.villain;
  if (!printedKeyword(definitions.get(v.code)!, "Stalwart")) return;
  if (isTextBlank(s, v)) return;
  v.stunned = v.confused = false;
  v.stunCards = v.confuseCards = 0;
}

/** Advance to a random set-aside Loki when Loki is defeated. The engine has
 * already moved the defeated Loki to the victory display. */
export function lokiNextVillain(
  s: GameState,
  ports: LokiPorts,
): Piece | undefined {
  return takeRandom(s, ports);
}
/** After an advance: a Loki who gains stalwart loses stun and confuse. */
export function lokiAdvanced(s: GameState) {
  stalwartClears(s);
}

/** "Swap Loki with a random set-aside Loki villain": the new card takes his
 * place with his damage, status cards and attachments; nothing leaves or
 * enters play and nothing is revealed. */
function swap(s: GameState, ports: LokiPorts): boolean {
  const l = s.loki;
  if (!l || !isLoki(s) || over(s)) return false;
  const next = takeRandom(s, ports);
  if (!next) return false;
  const old = s.villain;
  Object.assign(next, {
    hp: old.hp,
    maxHp: old.maxHp,
    stage: old.stage,
    damage: old.damage,
    exhausted: old.exhausted,
    stunned: old.stunned,
    confused: old.confused,
    tough: old.tough,
    stunCards: old.stunCards,
    confuseCards: old.confuseCards,
    toughCards: old.toughCards,
    counters: old.counters,
  });
  ports.replaceVillain(s, old, next);
  l.setAside.push(ports.resetPiece(old));
  stalwartClears(s);
  ports.log(s, "Loki swaps with another Loki.", "bad");
  // Loki's Cape, Forced Response: after Loki is swapped, he gets a tough
  // status card.
  if (attached(s, CAPE).length) ports.giveTough(s, s.villain);
  return true;
}

/** Loki (21160) cannot take damage while a side scheme is in play. */
export function lokiDamageProhibited(
  s: GameState,
  targetId: string,
): string | undefined {
  if (
    targetId !== s.villain.id ||
    !isLoki(s) ||
    s.villain.code !== UNTOUCHABLE ||
    isTextBlank(s, s.villain) ||
    !s.sideSchemes.length
  )
    return undefined;
  return "Loki cannot take damage while a side scheme is in play.";
}
/** Loki (21164): his attacks gain piercing. */
export function lokiKeyword(s: GameState, p: Piece, keyword: string) {
  return (
    keyword === "Piercing" &&
    p.id === s.villain.id &&
    isLoki(s) &&
    p.code === PIERCING_LOKI &&
    s.attack?.attacker === p.id &&
    !isTextBlank(s, p)
  );
}

/** Master of Illusions, Forced Interrupt: when Loki would take damage from an
 * attack, discard the top card of the encounter deck; a treachery prevents all
 * damage from this attack and discards Master of Illusions. Resolves once per
 * attack. */
export function lokiPreventAttackDamage(
  s: GameState,
  targetId: string,
  amount: number,
  attackKey: string | undefined,
  ports: Pick<LokiPorts, "discardTop" | "log">,
): { amount: number; discardId?: string } {
  if (amount <= 0 || !attackKey || targetId !== s.villain.id || !isLoki(s))
    return { amount };
  const key = `lokiIllusions:${attackKey}`;
  if (s.flags[key] === "prevent") return { amount: 0 };
  if (s.flags[key]) return { amount };
  const illusions = attached(s, ILLUSIONS)[0];
  if (!illusions) return { amount };
  const { piece } = ports.discardTop(s);
  const treachery = !!piece && typeOf(piece) === "treachery";
  s.flags[key] = treachery ? "prevent" : "checked";
  ports.log(
    s,
    piece
      ? `Master of Illusions discards ${name(piece)}${treachery ? ": all damage from this attack is prevented." : "."}`
      : "Master of Illusions finds no encounter card.",
    treachery ? "bad" : "info",
  );
  return treachery ? { amount: 0, discardId: illusions.id } : { amount };
}

/** Hero Responses of Loki's Staff, Crown and Cape after a basic attack
 * against Loki. */
export function lokiAfterBasicAttack(
  s: GameState,
  targetId: string,
  ports?: Pick<LokiPorts, "canPay">,
): Effect[] {
  if (!s.loki || targetId !== s.villain.id || s.player.form !== "hero")
    return [];
  return armorOptions(s, ports).length
    ? [L("basic-response", { actorId: s.activePlayerId, mandatory: false })]
    : [];
}
const COSTS: [string, Resource[]][] = [
  [STAFF, ["energy", "physical"]],
  [CROWN, ["mental", "physical"]],
  [CAPE, ["energy", "mental"]],
];
function armorOptions(
  s: GameState,
  ports?: Pick<LokiPorts, "canPay">,
): Option[] {
  const out: Option[] = [];
  for (const [code, requirements] of COSTS) {
    const p = attached(s, code)[0];
    if (!p || (ports && !ports.canPay(s, 2, requirements))) continue;
    out.push({
      id: p.id,
      label: `Spend ${requirements.join(" and ")} · discard ${name(p)}`,
      image: p.code,
      effects: [L("armor-pay", { id: p.id })],
    });
  }
  return out;
}

/** When Defeated of Loki's side schemes: the top Infinity Stone, then a
 * swap. */
export function lokiSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (!s.loki || !LOKI_SIDE_SCHEMES.includes(p.code)) return [];
  return [{ type: "thanos:stone" }, L("swap")];
}
/** When Defeated of the Loki card just defeated: discard the encounter deck
 * until a side scheme and reveal it. */
export function lokiDefeatedEffects(
  s: GameState,
  old: Piece,
  textBlank: boolean,
): Effect[] {
  if (!s.loki || !isLokiCard(old) || textBlank) return [];
  return [L("defeat-search", { actorId: s.activePlayerId })];
}

/** Setup (1A): after the random Loki, reveal the top Infinity Stone. */
export function lokiSetup(s: GameState): Effect[] {
  return s.loki ? [{ type: "thanos:stone" }] : [];
}

export function lokiReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if ([STAFF, CROWN, CAPE, ILLUSIONS].includes(p.code))
    return [L("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case SORCERY:
      return [
        L("sorcery", {
          playerId: s.activePlayerId,
          hero: s.player.form === "hero",
        }),
      ];
    case MISCHIEF:
      return [L("mischief")];
    case TRICKSTER:
      return [L("trickster", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

export function lokiBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case STAFF:
    case CROWN:
      return [L("boost-attach", { id: p.id })];
    case MISCHIEF:
      // Discard the top Infinity Stone and apply its boost icons.
      return [{ type: "thanos:inevitable" }];
    case TRICKSTER:
      return [L("trickster-boost")];
    default:
      return [];
  }
}

/** Target references to a Loki card that was swapped out or defeated name
 * the Loki now in play. */
export function lokiCanonicalTargets(s: GameState, e: Effect) {
  const l = s.loki;
  if (!l || !isLoki(s)) return;
  const retired = new Set(
    [...l.setAside, ...(s.victoryDisplay || [])]
      .filter(isLokiCard)
      .map((p) => p.id),
  );
  const fields = ["target", "targetId", "enemyId", "attacker"];
  if (
    [
      "enemyAttack",
      "enemyScheme",
      "ghostNativeEnemyAttack",
      "ghostNativeEnemyScheme",
    ].includes(e.type)
  )
    fields.push("id");
  if (e.type === "ms:melee-second") fields.push("firstId");
  if (e.type === "target" && e.group === "enemy") fields.push("exclude");
  for (const key of fields)
    if (typeof e[key] === "string" && retired.has(e[key]))
      e[key] = s.villain.id;
}

/** Discard the encounter deck until a card matches; stop at the first
 * exhaustion even though the deck is then reshuffled. */
function discardUntil(
  s: GameState,
  ports: LokiPorts,
  match: (p: Piece) => boolean,
): Piece | undefined {
  for (
    let remaining = s.encounter.deck.length || s.encounter.discard.length;
    remaining > 0;
    remaining--
  ) {
    const { piece, emptied } = ports.discardTop(s);
    if (!piece) return undefined;
    if (match(piece)) return piece;
    if (emptied) return undefined;
  }
  return undefined;
}

export function resolveLokiEffect(
  s: GameState,
  e: Effect,
  ports: LokiPorts,
): boolean {
  if (!e.type.startsWith("loki:")) return false;
  const l = s.loki;
  switch (e.type) {
    case "loki:swap":
      swap(s, ports);
      break;
    case "loki:defeat-search": {
      if (over(s)) break;
      const scheme = discardUntil(s, ports, (p) => typeOf(p) === "side_scheme");
      if (scheme) {
        s.encounter.discard = s.encounter.discard.filter(
          (p) => p.id !== scheme.id,
        );
        ports.reveal(s, scheme, e.actorId || s.activePlayerId);
      }
      break;
    }
    case "loki:attach": {
      const p = e.piece as Piece;
      if (isLoki(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "loki:boost-attach": {
      const p = [...s.resolving, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (!p || !isLoki(s)) break;
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(p.id))
        (activation.retainedBoostIds ||= []).push(p.id);
      ports.attach(s, p, s.villain.id);
      ports.log(s, `${name(p)} attaches to Loki.`, "bad");
      break;
    }
    case "loki:sorcery": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      if (!view.stunned)
        ports.queue(s, {
          type: "status",
          target: `hero:${e.playerId}`,
          status: "stunned",
        });
      else if (e.hero)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 2,
          source: "encounter",
          actorId: e.playerId,
        });
      else ports.queue(s, { type: "threat", target: "main", amount: 2 });
      break;
    }
    case "loki:mischief": {
      // Shuffle the Infinity Stone discard pile into the deck and reveal the
      // top Stone.
      if (!l) break;
      l.stoneDeck = ports.shuffle(s, [
        ...l.stoneDeck,
        ...l.stoneDiscard.splice(0),
      ]);
      ports.queue(s, { type: "thanos:stone" });
      break;
    }
    case "loki:trickster": {
      swap(s, ports);
      if (!alive(s, e.playerId) || over(s) || !isLoki(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "loki:trickster-boost": {
      // Give Loki an additional boost card and a tough status card.
      const activation = s.attack || s.scheming;
      if (activation && isLoki(s))
        ports.giveBoost(s, activation.attacker, "current");
      if (isLoki(s)) ports.giveTough(s, s.villain);
      break;
    }
    case "loki:basic-response": {
      const options = armorOptions(s, ports);
      if (!options.length) break;
      ports.choose(s, "Loki's armor", "Discard one of Loki's cards?", [
        ...options,
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    }
    case "loki:armor-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error(`${name(e.id)} is no longer attached.`);
      const cost = COSTS.find(([code]) => code === p.code)?.[1];
      if (!cost) throw Error(`${name(p)} has no Hero Response.`);
      ports.pay(
        s,
        2,
        cost,
        [{ type: "discardPiece", id: p.id }],
        name(p),
        true,
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
