import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { printedCardMetadata } from "./printed-card-metadata.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** The Mad Titan's Shadow, scenario 4: Hela, with the Legions of Hel and
 * Frost Giants modular sets. Odin's King side (21139b) is used only by the
 * campaign and is not registered. */
export const HELA_SCENARIO_CODES = [
  "21136a",
  "21136b",
  "21137a",
  "21137b",
  "21138a",
  "21138b",
  "21139a",
  "21140",
  "21141",
  "21142",
  "21143",
  "21144",
  "21145",
  "21146",
  "21147",
  "21148",
  "21149",
  "21150",
  "21151",
] as const;
export const LEGIONS_OF_HEL_CODES = [
  "21152",
  "21153",
  "21154",
  "21155",
] as const;
export const FROST_GIANTS_CODES = ["21156", "21157", "21158", "21159"] as const;
export const HELA_SCRIPT_CODES = [
  ...HELA_SCENARIO_CODES,
  ...LEGIONS_OF_HEL_CODES,
  ...FROST_GIANTS_CODES,
] as const;
/** Hela (A) for Standard and Hela (B) for Expert, each a single double-sided
 * card: the Mystic side and, on its back, the Wounded side. */
export const HELA_VILLAINS = ["21136a", "21137a"] as const;
const WOUNDED_SIDES: Record<string, string> = {
  "21136a": "21136b",
  "21137a": "21137b",
};
const MYSTIC_SIDES: Record<string, string> = {
  "21136b": "21136a",
  "21137b": "21137a",
};
/** Hela's Mystic hit point bonus per player for each side scheme in the
 * victory display. */
const HP_BONUS: Record<string, number> = { "21136a": 2, "21137a": 3 };
export const ODINS_TORMENT = "21138b";
export const ODIN = "21139a";
/** Odin's King side, the back of the Odin card: campaign only. */
export const ODIN_KING_SIDE = "21139b";
export const GNIPAHELLIR = "21140";
export const GJALLERBRU = "21141";
export const HALL_OF_NASTROND = "21142";
export const GARM = "21143";
export const SKURGE = "21144";
export const NIDHOGG = "21145";
const NIGHTSWORD = "21146";
const CROWN = "21147";
const CLOAK = "21148";
const DOMAIN = "21149";
const QUEEN = "21150";
const WASTES = "21151";
const DRAUGR = "21152";
export const FALLEN_WARRIOR = "21153";
const NO_PLACE = "21154";
const LEGIONS = "21155";
const LAUFEY = "21156";
const FROST_GIANT = "21157";
export const FROZEN = "21158";
export const UNNATURAL_STORM = "21159";
/** Victory X of the Journey Through Hel side schemes and minions. */
export const HELA_VICTORY: Record<string, number> = {
  [GNIPAHELLIR]: 2,
  [HALL_OF_NASTROND]: 4,
  [GJALLERBRU]: 3,
  [GARM]: 2,
  [SKURGE]: 3,
  [NIDHOGG]: 4,
};
export const HELA_VICTORY_SCHEMES = [
  GNIPAHELLIR,
  GJALLERBRU,
  HALL_OF_NASTROND,
] as const;
/** Garm, Skurge and Nidhogg: threat cannot be removed from their scheme. */
const LOCKS: Record<string, string> = {
  [GARM]: GNIPAHELLIR,
  [SKURGE]: GJALLERBRU,
  [NIDHOGG]: HALL_OF_NASTROND,
};
/** The Journey Through Hel, in order: each side scheme with its minion. */
export const HELA_JOURNEY = [
  { scheme: GNIPAHELLIR, minion: GARM },
  { scheme: GJALLERBRU, minion: SKURGE },
  { scheme: HALL_OF_NASTROND, minion: NIDHOGG },
] as const;

export interface HelaState {
  /** The physical Odin card: attached to the main scheme, then an ally. */
  odinId: string;
  /** Gjallerbru, Skurge, Hall of Nastrond and Nidhogg, set aside. */
  setAside: Piece[];
  /** Victory-display side schemes counted in Mystic Hela's hit points. */
  counted: number;
}

export interface HelaPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  /** Reveal an actual encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** Indirect damage a player assigns among the characters they control. */
  indirect(s: GameState, playerId: string, amount: number, source: Piece): void;
  /** Discard a player's deck from the top until an ally is discarded; stop at
   * the first exhaustion. Returns that ally, taken out of its zone. */
  discardUntilAlly(s: GameState, playerId: string): Piece | undefined;
  /** The ally enters play as an Undead minion engaged with the player, with
   * Fallen Warrior attached. */
  putFallen(s: GameState, ally: Piece, fallen: Piece, playerId: string): void;
  /** Odin enters play under the first player's control. */
  putOdin(s: GameState, odin: Piece, playerId: string): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  /** Every ally in play under a player's control. */
  allies(s: GameState): Piece[];
  /** Mystic Hela's hit points beyond her printed and Victory values. */
  villainHpModifiers(s: GameState): number;
  isPermanent(p: Piece): boolean;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
}

// Printed corrections apply: the catalog swapped Gjallerbru and Hall of
// Nastrond, whose original numbers are 21141 and 21142.
const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, printedCardMetadata(c)]),
);
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => definitions.get(p.code)?.type_code;
const H = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hela:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (HELA_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const hasTrait = (p: Piece, trait: string) =>
  (definitions.get(p.code)?.traits || "")
    .split(".")
    .some((t: string) => t.trim() === trait);
const attached = (s: GameState, code: string, hostId = s.villain.id) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === hostId && !isTextBlank(s, a),
  );
const firstPlayer = (s: GameState) =>
  s.players.find((seat) => seat.id === s.firstPlayerId && !seat.eliminated) ||
  playerOrder(s).find((seat) => alive(s, seat.id));

export function isHela(s: GameState) {
  return (
    !!s.hela &&
    (!!WOUNDED_SIDES[s.villain.code] || !!MYSTIC_SIDES[s.villain.code])
  );
}
/** Hela's Mystic side: printed hit points, flipped by Odin's Torment. */
export function helaMystic(s: GameState) {
  return !!s.hela && !!WOUNDED_SIDES[s.villain.code];
}
/** Hela's Wounded side: infinite hit points; she cannot be defeated. */
export function helaWounded(s: GameState) {
  return !!s.hela && !!MYSTIC_SIDES[s.villain.code];
}

/** Side schemes in the victory display. */
export function helaVictorySideSchemes(s: GameState) {
  return (s.victoryDisplay || []).filter((p) =>
    ["side_scheme", "player_side_scheme"].includes(typeOf(p) || ""),
  ).length;
}

/** [star] Mystic Hela gets +1 SCH and +1 ATK for each side scheme in the
 * victory display. */
export function helaVillainStat(s: GameState, p: Piece) {
  return p.id === s.villain.id && helaMystic(s) && !isTextBlank(s, p)
    ? helaVictorySideSchemes(s)
    : 0;
}

/** Mystic Hela's printed hit points with her Victory bonus. */
export function helaMysticHp(s: GameState, code = s.villain.code) {
  const mystic = MYSTIC_SIDES[code] || code;
  const printed = definitions.get(mystic)?.health || 0;
  const bonus = isTextBlank(s, { code: mystic, id: s.villain.id })
    ? 0
    : (HP_BONUS[mystic] || 0) * helaVictorySideSchemes(s);
  return (printed + bonus) * s.playerCount;
}

/** Keep Mystic Hela's hit points in step with the victory display. Returns
 * whether her hit points decreased. */
export function helaSyncHitPoints(s: GameState): boolean {
  const h = s.hela;
  if (!h || !helaMystic(s)) return false;
  const n = isTextBlank(s, s.villain) ? 0 : helaVictorySideSchemes(s);
  if (n === h.counted) return false;
  const change =
    (n - h.counted) * (HP_BONUS[s.villain.code] || 0) * s.playerCount;
  h.counted = n;
  s.villain.maxHp += change;
  s.villain.hp += change;
  return change < 0;
}

/** Infinite hit points: Wounded Hela takes damage but is never defeated by
 * it, and no damage is excess. */
export function helaInfiniteHp(s: GameState, targetId = s.villain.id) {
  return targetId === s.villain.id && helaWounded(s);
}

/** Odin, attached to the main scheme or in play as an ally. */
export function helaOdin(s: GameState): Piece | undefined {
  const id = s.hela?.odinId;
  if (!id) return undefined;
  return (
    s.attachments.find((p) => p.id === id) ||
    s.minions.find((p) => p.id === id) ||
    s.players
      .flatMap((seat) => seatView(s, seat).player.inPlay)
      .find((p) => p.id === id)
  );
}
/** Odin is a Captive attached to the main scheme. */
export function helaOdinCaptive(s: GameState) {
  const odin = helaOdin(s);
  return !!odin && (odin.attachedTo || "").startsWith("main");
}
/** "If Odin leaves play, the players lose the game." */
export function helaOdinLost(s: GameState) {
  return !!s.hela && !over(s) && !helaOdin(s);
}
/** Odin, once rescued, does not count against the ally limit. */
export function helaOdinCountsAgainstAllyLimit(s: GameState, p: Piece) {
  return p.id !== s.hela?.odinId || isTextBlank(s, p);
}
/** Odin, once rescued, cannot have cards attached. */
export function helaCanAttach(s: GameState, targetId: string) {
  const odin = helaOdin(s);
  return (
    !odin || odin.id !== targetId || helaOdinCaptive(s) || isTextBlank(s, odin)
  );
}
/** "The first player gains control of Odin": Odin follows the token. */
export function helaFirstPlayerChanged(
  s: GameState,
  ports: Pick<HelaPorts, "transferControl">,
) {
  const odin = helaOdin(s);
  const first = firstPlayer(s);
  if (!odin || !first || helaOdinCaptive(s) || isTextBlank(s, odin)) return;
  const holder = s.players.find((seat) =>
    seatView(s, seat).player.inPlay.some((p) => p.id === odin.id),
  );
  if (holder && holder.id !== first.id)
    ports.transferControl(s, odin.id, first.id);
}

/** Garm, Skurge and Nidhogg engage the first player. */
export function helaSyncEngagement(s: GameState) {
  if (!s.firstPlayerId) return;
  for (const m of s.minions)
    if (LOCKS[m.code] && !isTextBlank(s, m)) m.engagedWith = s.firstPlayerId;
}

/** Threat cannot be removed from Gnipahellir, Gjallerbru or Hall of Nastrond
 * while Garm, Skurge or Nidhogg is in play. */
export function helaSchemeLocked(s: GameState, target: string) {
  const scheme = s.sideSchemes.find((p) => p.id === target);
  return (
    !!scheme &&
    s.minions.some((m) => LOCKS[m.code] === scheme.code && !isTextBlank(s, m))
  );
}

/** Granted keywords: Skurge's piercing, Nidhogg's overkill, Nightsword's
 * piercing and Hela's Cloak's stalwart. */
export function helaKeyword(s: GameState, p: Piece, keyword: string) {
  const attacking = s.attack?.attacker === p.id;
  if (s.minions.some((m) => m.id === p.id) && !isTextBlank(s, p)) {
    if (keyword === "Piercing") return attacking && p.code === SKURGE;
    if (keyword === "Overkill") return attacking && p.code === NIDHOGG;
    return false;
  }
  if (p.id !== s.villain.id || !isHela(s)) return false;
  if (keyword === "Piercing")
    return attacking && attached(s, NIGHTSWORD).length > 0;
  if (keyword === "Stalwart") return attached(s, CLOAK).length > 0;
  return false;
}

/** Garm, Skurge and Nidhogg go to the victory display when defeated. */
export function helaVictoryMinion(p: Piece) {
  return [GARM, SKURGE, NIDHOGG].includes(p.code);
}

/** Frozen: the attached identity cannot ready. Unnatural Storm: heroes and
 * allies cannot be readied by player card effects (the ready step is the
 * game's own rule, not a player card effect). */
export function helaCanReadyIdentity(s: GameState, playerId: string) {
  if (attached(s, FROZEN, `hero:${playerId}`).length) return false;
  return !stormLocks(s);
}
export function helaCanReadyPiece(s: GameState, p: Piece) {
  return !(stormLocks(s) && typeOf(p) === "ally" && !p.treatedAsMinion);
}
function stormLocks(s: GameState) {
  return (
    !s.flags.helaReadyStep &&
    s.sideSchemes.some((p) => p.code === UNNATURAL_STORM && !isTextBlank(s, p))
  );
}
/** Fallen Warrior is attached to this ally-turned-minion. */
export function helaFallenAttached(s: GameState, p: Piece) {
  return s.attachments.some(
    (a) =>
      a.code === FALLEN_WARRIOR && a.attachedTo === p.id && !isTextBlank(s, a),
  );
}
function undead(s: GameState, p: Piece) {
  return (
    (p.treatedAsMinion && p.helaUndead && helaFallenAttached(s, p)) ||
    (!p.treatedAsMinion && hasTrait(p, "Undead"))
  );
}

/** Replace a defeat of Hela. "wound": Odin's Torment flips her to her
 * Wounded side instead; "immune": the Wounded side cannot be defeated;
 * "defeated": Odin is free, so the players win. */
export function helaVillainWouldBeDefeated(
  s: GameState,
  ports: Pick<HelaPorts, "discardPiece" | "isPermanent" | "log">,
): "wound" | "immune" | "defeated" | null {
  const h = s.hela;
  if (!h || !isHela(s)) return null;
  if (helaWounded(s)) {
    s.villain.hp = 0;
    return "immune";
  }
  if (!helaOdinCaptive(s)) return "defeated";
  // Odin's Torment (1B), Forced Interrupt: discard each attachment from Hela
  // and flip her to her Wounded side instead. Status cards remain.
  // Encounter attachments and player cards attached to her alike.
  const onHela = () =>
    [
      ...s.attachments,
      ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
    ].filter((a) => a.attachedTo === s.villain.id && !ports.isPermanent(a));
  for (const p of onHela())
    if (onHela().some((a) => a.id === p.id)) ports.discardPiece(s, p.id);
  s.villain.code = WOUNDED_SIDES[s.villain.code];
  s.villain.hp = 0;
  s.villain.maxHp = 0;
  s.villain.damage = 0;
  h.counted = 0;
  ports.log(
    s,
    "Odin's Torment: Hela flips to her Wounded side instead of being defeated.",
    "bad",
  );
  return "wound";
}

/** Setup (1A): attach Odin, then reveal Gnipahellir and Garm. */
export function helaSetup(
  s: GameState,
  gnipahellir: Piece,
  garm: Piece,
): Effect[] {
  if (!s.hela) return [];
  return [H("reveal", { piece: gnipahellir }), H("reveal", { piece: garm })];
}

export interface HelaAttackReceipt {
  token: string;
  attackerId: string;
  attackerCode: string;
  /** "hero:<id>" or the defending character's id. */
  targetId: string;
  damageTaken: number;
  textBlank: boolean;
  defeatedAlly: boolean;
  boostCodes: string[];
}
/** After an attack: Hela's Domain and Frost Giant boosts, and Laufey. */
export function helaAfterAttack(
  s: GameState,
  receipt: HelaAttackReceipt,
): MutagenForcedResponse[] {
  const responses: MutagenForcedResponse[] = [];
  const domains = receipt.boostCodes.filter((c) => c === DOMAIN).length;
  if (domains && receipt.defeatedAlly)
    responses.push({
      id: `${receipt.token}:hela-domain`,
      title: "Hela's Domain",
      effects: Array.from({ length: domains }, () => ({
        type: "threat",
        target: "main",
        amount: 2,
      })),
    });
  const damaged = receipt.damageTaken > 0 && !!receipt.targetId;
  if (
    damaged &&
    receipt.attackerCode === LAUFEY &&
    !receipt.textBlank &&
    s.minions.some((m) => m.id === receipt.attackerId)
  )
    responses.push({
      id: `${receipt.token}:laufey`,
      sourceId: receipt.attackerId,
      title: "Laufey",
      effects: [H("stun", { target: receipt.targetId })],
    });
  if (
    damaged &&
    receipt.attackerId === s.villain.id &&
    receipt.boostCodes.includes(FROST_GIANT)
  )
    responses.push({
      id: `${receipt.token}:frost-giant`,
      title: "Frost Giant",
      effects: [H("stun", { target: receipt.targetId })],
    });
  return responses;
}

/** Hela's Crown: after Hela schemes, give her a facedown boost card. */
export function helaSchemed(s: GameState, enemyId: string): Effect[] {
  if (!s.hela || enemyId !== s.villain.id || !isHela(s)) return [];
  return attached(s, CROWN).map(() => H("facedown-boost"));
}

/** When Defeated of the Journey Through Hel side schemes. */
export function helaSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (!s.hela) return [];
  switch (p.code) {
    case GNIPAHELLIR:
      return [
        H("journey", { codes: [GJALLERBRU, SKURGE], actorId: s.firstPlayerId }),
        H("deal", { others: true, actorId: playerId }),
      ];
    case GJALLERBRU:
      return [
        H("journey", {
          codes: [HALL_OF_NASTROND, NIDHOGG],
          actorId: s.firstPlayerId,
        }),
        H("deal", { others: true, actorId: playerId }),
      ];
    case HALL_OF_NASTROND:
      return [
        H("free-odin", { actorId: s.firstPlayerId }),
        H("deal", { others: false, actorId: playerId }),
      ];
    default:
      return [];
  }
}
/** Wounded Hela, Forced Response: after a side scheme is defeated, flip her
 * to her Mystic side. */
export function helaSideSchemeDefeated(s: GameState): Effect[] {
  return helaWounded(s) && !isTextBlank(s, s.villain) ? [H("mystic")] : [];
}

export function helaReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === NIGHTSWORD || p.code === CROWN || p.code === CLOAK)
    return [H("attach", { piece: p })];
  if (p.code === FROZEN)
    return [H("frozen", { piece: p, playerId: s.activePlayerId })];
  // Fallen Warrior's When Revealed resolves in its reveal window; its
  // attachment entry does nothing on its own.
  if (p.code === FALLEN_WARRIOR)
    return s.currentRevealWindowId === p.id
      ? [H("fallen", { piece: p, playerId: s.activePlayerId })]
      : [];
  if (isTextBlank(s, p)) return [];
  const vd = helaVictorySideSchemes(s);
  switch (p.code) {
    case DOMAIN:
      return [{ type: "threat", target: "main", amount: 1 + vd }];
    case QUEEN:
      return [
        H("queen", {
          playerId: s.activePlayerId,
          hero: s.player.form === "hero",
        }),
      ];
    case WASTES:
      return [
        H("wastes", {
          playerId: s.activePlayerId,
          amount: 1 + vd,
          id: p.id,
          code: p.code,
        }),
      ];
    case DRAUGR:
      return [H("draugr", { playerId: s.activePlayerId, id: p.id })];
    case NO_PLACE:
      return [H("no-place", { id: p.id })];
    case LEGIONS:
      return [H("legions", { id: p.id, playerId: s.activePlayerId })];
    case UNNATURAL_STORM:
      return [H("storm")];
    default:
      return [];
  }
}

export function helaBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case NIGHTSWORD:
    case CROWN:
    case CLOAK:
      return [H("boost-attach", { id: p.id })];
    case WASTES:
      return [H("wastes-icons")];
    default:
      // Hela's Domain and Frost Giant resolve after the attack, from its
      // boost codes.
      return [];
  }
}

/** Frozen: Alter-Ego Action, spend [energy][physical] to discard it. */
export function helaActions(
  s: GameState,
  p: Piece,
  ports?: Pick<HelaPorts, "canPay">,
): Option[] {
  if (
    p.code !== FROZEN ||
    isTextBlank(s, p) ||
    s.player.form !== "alter" ||
    p.attachedTo !== `hero:${s.activePlayerId}` ||
    !s.attachments.some((a) => a.id === p.id) ||
    (ports && !ports.canPay(s, 2, ["energy", "physical"] as Resource[]))
  )
    return [];
  return [
    {
      id: "remove",
      label: "Spend energy and physical · discard Frozen",
      image: p.code,
      effects: [H("frozen-pay", { id: p.id })],
    },
  ];
}

/** Upgrades and supports a player controls. */
function upgradesAndSupports(s: GameState, playerId: string): Piece[] {
  return seatView(s, playerId).player.inPlay.filter(
    (p) =>
      ["upgrade", "support"].includes(typeOf(p) || "") &&
      p.ownerId !== undefined,
  );
}

export function resolveHelaEffect(
  s: GameState,
  e: Effect,
  ports: HelaPorts,
): boolean {
  if (!e.type.startsWith("hela:")) return false;
  const h = s.hela;
  switch (e.type) {
    case "hela:reveal": {
      const p = e.piece as Piece;
      ports.reveal(s, p, e.actorId || s.firstPlayerId);
      break;
    }
    case "hela:journey": {
      // The first player reveals the next side scheme and its minion, and
      // puts them into play. Each card stays set aside until it is revealed.
      if (!h || over(s)) break;
      const first = firstPlayer(s);
      if (!first) break;
      ports.queue(
        s,
        ...((e.codes as string[]) || []).map((code) =>
          H("reveal-aside", { code, actorId: first.id }),
        ),
      );
      break;
    }
    case "hela:reveal-aside": {
      if (!h || over(s)) break;
      const i = h.setAside.findIndex((p) => p.code === e.code);
      if (i < 0) break;
      const [piece] = h.setAside.splice(i, 1);
      ports.reveal(s, piece, e.actorId || s.firstPlayerId);
      break;
    }
    case "hela:deal": {
      for (const seat of playerOrder(s))
        if (!(e.others && seat.id === s.firstPlayerId) && alive(s, seat.id))
          ports.dealEncounter(s, seat.id);
      break;
    }
    case "hela:free-odin": {
      // The first player detaches Odin from the main scheme and takes
      // control of him.
      const odin = helaOdin(s);
      const first = firstPlayer(s);
      if (!odin || !first || !helaOdinCaptive(s)) break;
      s.attachments = s.attachments.filter((p) => p.id !== odin.id);
      delete odin.attachedTo;
      ports.putOdin(s, odin, first.id);
      ports.log(
        s,
        `Odin is free. ${ports.heroName(s, first.id)} takes control of the All-Father.`,
        "good",
      );
      break;
    }
    case "hela:mystic": {
      if (!h || !helaWounded(s) || isTextBlank(s, s.villain) || over(s)) break;
      s.villain.code = MYSTIC_SIDES[s.villain.code];
      s.villain.damage = 0;
      h.counted = helaVictorySideSchemes(s);
      const hp = helaMysticHp(s) + ports.villainHpModifiers(s);
      s.villain.hp = hp;
      s.villain.maxHp = hp;
      ports.log(s, "Hela flips to her Mystic side.", "bad");
      break;
    }
    case "hela:attach": {
      const p = e.piece as Piece;
      if (isHela(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "hela:boost-attach": {
      const p = [...s.resolving, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (!p || !isHela(s)) break;
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(p.id))
        (activation.retainedBoostIds ||= []).push(p.id);
      ports.attach(s, p, s.villain.id);
      ports.log(s, `${name(p)} attaches to Hela.`, "bad");
      break;
    }
    case "hela:facedown-boost":
      if (isHela(s)) ports.giveBoost(s, s.villain.id, "next");
      break;
    case "hela:queen": {
      if (!alive(s, e.playerId) || over(s)) {
        ports.queue(s, H("queen-threat"));
        break;
      }
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
        after: H("queen-threat"),
      });
      break;
    }
    case "hela:queen-threat":
      ports.queue(
        s,
        ...s.sideSchemes.map((p) => ({
          type: "threat",
          target: p.id,
          amount: 1,
        })),
      );
      break;
    case "hela:wastes": {
      if (!alive(s, e.playerId)) break;
      const source =
        s.resolving.find((p) => p.id === e.id) ||
        ({ id: e.id, code: e.code } as Piece);
      ports.indirect(s, e.playerId, Number(e.amount) || 0, source);
      break;
    }
    case "hela:wastes-icons": {
      const activation = s.attack || s.scheming;
      const icons = helaVictorySideSchemes(s);
      if (activation && icons)
        activation.extraBoostIcons = (activation.extraBoostIcons || 0) + icons;
      break;
    }
    case "hela:stun": {
      const target = String(e.target || "");
      if (target.startsWith("hero:")) {
        const playerId = target.slice(5);
        if (alive(s, playerId))
          ports.queue(s, {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: playerId,
          });
      } else if (ports.allies(s).some((p) => p.id === target))
        ports.queue(s, { type: "status", target, status: "stunned" });
      break;
    }
    case "hela:draugr": {
      if (!alive(s, e.playerId)) break;
      ports.choose(
        s,
        "Draugr",
        `${ports.heroName(s, e.playerId)}: take 1 damage or place 1 threat on the main scheme.`,
        [
          {
            id: "damage",
            label: "Take 1 damage",
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: 1,
                source: e.id,
                actorId: e.playerId,
              },
            ],
          },
          {
            id: "threat",
            label: "Place 1 threat on the main scheme",
            effects: [{ type: "threat", target: "main", amount: 1 }],
          },
        ],
      );
      break;
    }
    case "hela:fallen": {
      const fallen = e.piece as Piece;
      const ally = alive(s, e.playerId)
        ? ports.discardUntilAlly(s, e.playerId)
        : undefined;
      if (!ally) {
        // The card stays resolving and is discarded when its reveal ends.
        ports.log(s, "Fallen Warrior finds no ally.");
        break;
      }
      ports.putFallen(s, ally, fallen, e.playerId);
      ports.log(
        s,
        `${name(ally)} rises as an Undead minion engaged with ${ports.heroName(s, e.playerId)}.`,
        "bad",
      );
      break;
    }
    case "hela:no-place": {
      // Each player chooses: discard their highest-cost upgrade or support,
      // or take damage equal to the upgrades and supports they control.
      const remaining: string[] =
        e.remaining ?? playerOrder(s).map((seat) => seat.id);
      const [playerId, ...rest] = remaining;
      if (!playerId) break;
      const next = H("no-place", {
        id: e.id,
        remaining: rest,
        actorId: rest[0],
      });
      const cards = alive(s, playerId) ? upgradesAndSupports(s, playerId) : [];
      if (!cards.length) {
        ports.queue(s, next);
        break;
      }
      const cost = (p: Piece) => definitions.get(p.code)?.cost || 0;
      const highest = Math.max(...cards.map(cost));
      const discardable = cards.filter(
        (p) => cost(p) === highest && !ports.isPermanent(p),
      );
      ports.queue(s, next);
      ports.choose(
        s,
        "No Place for the Living",
        `${ports.heroName(s, playerId)}: discard your highest-cost upgrade or support, or take ${cards.length} damage.`,
        [
          ...discardable.map((p) => ({
            id: p.id,
            label: `Discard ${name(p)}`,
            image: p.code,
            effects: [{ type: "discardPiece", id: p.id, actorId: playerId }],
          })),
          {
            id: "damage",
            label: `Take ${cards.length} damage`,
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: cards.length,
                source: e.id,
                actorId: playerId,
              },
            ],
          },
        ],
      );
      break;
    }
    case "hela:legions": {
      const count = s.minions.filter((m) => undead(s, m)).length;
      if (!count) {
        ports.queue(s, {
          type: "surge",
          sourceId: e.id,
          sourceCode: LEGIONS,
          actorId: e.playerId || s.activePlayerId,
        });
        break;
      }
      if (s.sideSchemes.some((p) => p.id === e.id))
        ports.queue(s, { type: "threat", target: e.id, amount: 2 * count });
      break;
    }
    case "hela:storm":
      // Exhaust each ally in play.
      for (const p of ports.allies(s)) p.exhausted = true;
      break;
    case "hela:frozen": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "hela:frozen-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("Frozen is no longer attached.");
      ports.pay(
        s,
        2,
        ["energy", "physical"],
        [{ type: "discardPiece", id: p.id }],
        "Frozen",
        true,
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
