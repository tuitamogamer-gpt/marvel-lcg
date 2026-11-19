import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: the Venom scenario with its required Symbiotic
 * Strength set. Down to Earth is its recommended modular set. */
export const VENOM_SCENARIO_CODES = [
  "27073",
  "27074",
  "27075",
  "27076a",
  "27076b",
  "27077a",
  "27077b",
  "27078",
  "27079",
  "27080",
  "27081",
  "27082",
  "27083",
] as const;
export const SYMBIOTIC_STRENGTH_CODES = [
  "27164",
  "27165",
  "27166",
  "27167",
  "27168",
  "27169",
] as const;
export const VENOM_VILLAIN_SCRIPT_CODES = [
  ...VENOM_SCENARIO_CODES,
  ...SYMBIOTIC_STRENGTH_CODES,
] as const;
/** Sinister Motives modular sets selectable in every scenario. */
export const VENOM_MODULAR_SETS = ["symbiotic_strength"] as const;
/** The Bell Tower, Quiet side; its Ringing side is 27077b. */
export const BELL_TOWER = "27077a";
export const RINGING_TOWER = "27077b";

const VENOM_VILLAINS = ["27073", "27074", "27075"];
const LEAVE_US_ALONE = "27076b";
const ANGRY = "27078";
const GUARD_TOWER = "27079";
const LASHING_OUT = "27080";
const TOOTH_AND_NAIL = "27081";
const BITING_RETORT = "27082";
const BELL_TOLLS = "27083";
const IMPROVISED = "27164";
const VIOLENT = "27165";
const WEBBED_UP = "27166";
const ENRAGED = "27167";
const SWINGING = "27168";
const UNSTABLE = "27169";

export interface VenomVillainState {
  /** The facedown boost cards on each identity, by player. */
  boosts: Record<string, Piece[]>;
  /** The turn of the last attack against Venom, for Retribution. */
  attackTurn?: string;
}

export interface VenomPorts extends MutagenEnginePorts {
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
  /** The top encounter card, taken facedown without revealing it. */
  drawFacedown(s: GameState): Piece | undefined;
  changeForm(s: GameState, playerId: string): void;
  payResources(
    s: GameState,
    title: string,
    resources: string[],
    after: Effect[],
  ): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `venomv:${type}`,
  ...args,
});
const scripted = new Set<string>(VENOM_VILLAIN_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const isVenom = (s: GameState, id: string) =>
  !!s.villain && id === s.villain.id && VENOM_VILLAINS.includes(s.villain.code);
const isIdentity = (target: string) =>
  target === "hero" || target.startsWith("hero:");
export const bellTower = (s: GameState) =>
  (s.environments || []).find((p) =>
    [BELL_TOWER, RINGING_TOWER].includes(p.code),
  );
const towerActive = (s: GameState) => {
  const tower = bellTower(s);
  return tower && active(s, tower) ? tower : undefined;
};
/** The facedown boost cards on a player's identity. */
export const identityBoosts = (s: GameState, playerId: string) =>
  s.venomVillain?.boosts[playerId] || [];
/** Every facedown boost card on an identity, for physical-card audits. */
export const venomStoredPieces = (s: GameState) =>
  Object.values(s.venomVillain?.boosts || {}).flat();

// ---------------------------------------------------------------- setup

/** "Leave Us Alone!" (1A): the Bell Tower enters play, Quiet side faceup. */
export function venomSetup(s: GameState, ports: VenomPorts) {
  s.venomVillain = { boosts: {} };
  // "Leave Us Alone!" (1B) starts with 2 threat per player.
  s.scheme.threat = (def(LEAVE_US_ALONE)?.base_threat || 0) * s.playerCount;
  const i = s.encounter.deck.findIndex((p) => p.code === BELL_TOWER);
  if (i < 0) return;
  const [tower] = s.encounter.deck.splice(i, 1);
  ports.putEnvironment(s, tower);
  tower.counters = 0;
}

/** Venom (II) and (III) When Revealed. */
export function venomVillainRevealed(s: GameState): Effect[] {
  if (!s.villain || isTextBlank(s, s.villain)) return [];
  if (s.villain.code === "27074") return [V("tooth-and-nail")];
  if (s.villain.code === "27075") return [V("boosts-each", { amount: 2 })];
  return [];
}

// ---------------------------------------------------------- constants

export function venomKeyword(s: GameState, p: Piece, keyword: string): number {
  const attacking = s.attack?.attacker === p.id;
  if (!attacking) return 0;
  // "Now We're Angry!": Venom's attacks gain overkill.
  if (
    keyword === "Overkill" &&
    isVenom(s, p.id) &&
    s.attachments.some(
      (a) => a.code === ANGRY && a.attachedTo === p.id && active(s, a),
    )
  )
    return 1;
  // Tooth and Nail's boost: this attack gains piercing.
  if (keyword === "Piercing" && s.attack?.venomPiercing) return 1;
  return 0;
}

/** The Bell Tower (Ringing): increase all damage Venom takes by 1. */
export function venomIncreaseDamage(
  s: GameState,
  target: string,
  n: number,
): number {
  const tower = towerActive(s);
  return n > 0 && tower?.code === RINGING_TOWER && isVenom(s, target)
    ? n + 1
    : n;
}

/** The Bell Tower (Ringing): when Venom's attack would damage an identity,
 * remove that many chime counters to prevent 1 damage for each. */
export function venomRingingPrevention(
  s: GameState,
  target: string,
  n: number,
  source: string,
  ports: Pick<VenomPorts, "log">,
): number {
  const tower = towerActive(s);
  if (
    n <= 0 ||
    tower?.code !== RINGING_TOWER ||
    !isIdentity(target) ||
    !isVenom(s, source)
  )
    return n;
  const removed = Math.min(n, tower.counters || 0);
  if (!removed) return n;
  tower.counters -= removed;
  ports.log(
    s,
    `The Bell Tower: ${removed} chime counter${removed === 1 ? "" : "s"} removed to prevent ${removed} damage.`,
    "good",
  );
  return n - removed;
}

/** The Bell Tower (Quiet): the amount of chime counters an attack may place
 * instead of damaging Venom, or 0. */
export function venomChimeAmount(
  s: GameState,
  target: string,
  amount: number,
): number {
  const tower = towerActive(s);
  return amount > 0 && tower?.code === BELL_TOWER && isVenom(s, target)
    ? amount
    : 0;
}

/** Biting Retort: each boost card turned faceup during its activation gets
 * +1 boost icon. */
export function venomRetortIcons(
  s: GameState,
  activation: { attacker: string; boostCodes: string[] },
): number {
  return s.flags.venomRetort && isVenom(s, activation.attacker)
    ? activation.boostCodes.length
    : 0;
}

/** "Leave Us Alone!": when Venom activates against you, the facedown boost
 * cards on your identity move to Venom for that activation. */
export function venomActivationBoosts(
  s: GameState,
  attackerId: string,
  playerId: string,
  ports: Pick<VenomPorts, "log">,
): Piece[] {
  const st = s.venomVillain;
  if (
    !st ||
    s.scheme.code !== LEAVE_US_ALONE ||
    !isVenom(s, attackerId) ||
    !st.boosts[playerId]?.length
  )
    return [];
  const moved = st.boosts[playerId].splice(0);
  ports.log(
    s,
    `"Leave Us Alone!": ${moved.length} facedown boost card${moved.length === 1 ? "" : "s"} move${moved.length === 1 ? "s" : ""} from the identity to Venom.`,
    "bad",
  );
  return moved;
}

/** The Bell Tower flips at 3 chime counters per player (Quiet) or when it
 * has none (Ringing). */
export function venomCheck(s: GameState, ports: Pick<VenomPorts, "log">) {
  if (!s.venomVillain || over(s)) return;
  const tower = towerActive(s);
  if (!tower) return;
  if (tower.code === BELL_TOWER && (tower.counters || 0) >= 3 * s.playerCount) {
    tower.code = RINGING_TOWER;
    ports.log(s, "The Bell Tower flips to its Ringing side.", "good");
  } else if (tower.code === RINGING_TOWER && (tower.counters || 0) <= 0) {
    tower.counters = 0;
    tower.code = BELL_TOWER;
    ports.log(s, "The Bell Tower falls Quiet again.", "bad");
  }
}

// ------------------------------------------------------- interrupts

/** Webbed Up is attached to this player's identity and active. */
export function venomHasWebbedUp(s: GameState, playerId: string): boolean {
  return s.attachments.some(
    (a) =>
      a.code === WEBBED_UP &&
      a.attachedTo === `hero:${playerId}` &&
      active(s, a),
  );
}

/** Webbed Up: when your hero would attack, discard Webbed Up instead; then
 * you are stunned. Returns true when the attack is replaced. */
export function venomWebbedUp(
  s: GameState,
  playerId: string,
  ports: Pick<VenomPorts, "discardPiece" | "queue" | "log">,
): boolean {
  const web = s.attachments.find(
    (a) =>
      a.code === WEBBED_UP &&
      a.attachedTo === `hero:${playerId}` &&
      active(s, a),
  );
  if (!web) return false;
  ports.discardPiece(s, web.id);
  ports.log(s, "Webbed Up is discarded instead of attacking.", "bad");
  ports.queue(s, {
    type: "status",
    target: "hero",
    status: "stunned",
    actorId: playerId,
  });
  return true;
}

// ------------------------------------------------------------ responses

/** After a character attacks Venom: Vengeance and Retribution, "Now We're
 * Angry!", Lashing Out, Tooth and Nail and Violent Tendencies. */
export function venomEnemyAttacked(
  s: GameState,
  target: string,
  damage: number,
  playerId: string,
): Effect[] {
  if (!s.villain || target !== s.villain.id) return [];
  const effects: Effect[] = [];
  const st = s.venomVillain;
  if (st && isVenom(s, target)) {
    const turn = `${s.round}:${s.turnPlayerId}`;
    const first = st.attackTurn !== turn;
    st.attackTurn = turn;
    if (damage > 0 && active(s, s.villain) && alive(s, playerId))
      effects.push(
        V("boost-identity", {
          playerId,
          amount: s.villain.code === "27075" && first ? 2 : 1,
        }),
      );
  }
  if (damage <= 0) return effects;
  for (const a of s.attachments.filter(
    (q) => q.attachedTo === target && active(s, q),
  )) {
    if (a.code === ANGRY && isVenom(s, target))
      effects.push(V("rage", { id: a.id }));
    if (a.code === VIOLENT)
      effects.push(V("violent", { id: a.id, discard: damage >= 3 }));
  }
  if (isVenom(s, target))
    for (const q of s.sideSchemes.filter(
      (q) => [LASHING_OUT, TOOTH_AND_NAIL].includes(q.code) && active(s, q),
    ))
      effects.push(V("lash", { id: q.id, amount: damage }));
  return effects;
}

// -------------------------------------------------------------- actions

/** The card whose action an ABILITY command names, if this module owns it. */
export function venomActionSource(s: GameState, id: string): Piece | undefined {
  const p = s.attachments.find((q) => q.id === id && q.code === IMPROVISED);
  return p && venomActions(s, p).length ? p : undefined;
}

export function venomActions(s: GameState, p: Piece): Option[] {
  if (!known(p) || !active(s, p)) return [];
  if (
    p.code === IMPROVISED &&
    s.attachments.some((q) => q.id === p.id) &&
    s.player.form === "hero"
  )
    return [
      {
        id: "discard",
        label: `Spend mental, physical, energy · discard ${name(p)}`,
        image: p.code,
        effects: [
          V("pay-discard", {
            id: p.id,
            resources: ["mental", "physical", "energy"],
          }),
        ],
      },
    ];
  return [];
}

// ----------------------------------------------------------- reveal

export function venomReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === ANGRY) return [V("attach-venom", { piece: p })];
  if (p.code === IMPROVISED || p.code === VIOLENT)
    return [V("attach-villain", { piece: p })];
  if (p.code === WEBBED_UP)
    return [V("attach-identity", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  switch (p.code) {
    case GUARD_TOWER:
      return [V("guard-tower")];
    case BITING_RETORT:
      return [V("retort", { playerId })];
    case BELL_TOLLS:
      return [V("tolls", { playerId, id: p.id })];
    case SWINGING:
      return hero
        ? [V("swing", { playerId })]
        : [V("swing-alter", { playerId })];
    case UNSTABLE:
      return [V("unstable")];
    default:
      return [];
  }
}

export function venomBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case ANGRY:
      return [V("angry-boost", { id: p.id, playerId })];
    case LASHING_OUT:
      return s.attack ? [V("lash-boost", { playerId, id: p.id })] : [];
    case TOOTH_AND_NAIL:
      return s.attack ? [V("tooth-boost")] : [];
    case BITING_RETORT:
      return [V("chime-remove", { amount: 1 })];
    case BELL_TOLLS:
      return [V("tolls", { playerId, id: p.id })];
    case WEBBED_UP:
      return [V("webbed-boost", { playerId })];
    case ENRAGED:
      return [V("enraged-boost", { id: p.id, playerId })];
    case UNSTABLE:
      return s.attack ? [V("unstable-boost")] : [];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

function placeBoosts(
  s: GameState,
  playerId: string,
  amount: number,
  ports: VenomPorts,
) {
  const st = s.venomVillain;
  if (!st || !alive(s, playerId) || over(s)) return;
  let placed = 0;
  for (let i = 0; i < amount; i++) {
    const p = ports.drawFacedown(s);
    if (!p) break;
    (st.boosts[playerId] ||= []).push(p);
    placed++;
  }
  if (placed)
    ports.log(
      s,
      `${placed} facedown boost card${placed === 1 ? " is" : "s are"} placed on the identity (${st.boosts[playerId].length} in all).`,
      "bad",
    );
}

function activateVenom(
  s: GameState,
  playerId: string,
  ports: VenomPorts,
  kind?: "attack" | "scheme",
  after?: Effect,
) {
  if (!s.villain || !alive(s, playerId) || over(s)) return;
  ports.activate(s, {
    enemyId: s.villain.id,
    playerId,
    kind:
      kind ||
      (seatView(s, playerId).player.form === "hero" ? "attack" : "scheme"),
    modifier: 0,
    ...(after ? { after } : {}),
  });
}

export function resolveVenomEffect(
  s: GameState,
  e: Effect,
  ports: VenomPorts,
): boolean {
  if (!e.type.startsWith("venomv:")) return false;
  switch (e.type) {
    case "venomv:tooth-and-nail": {
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const p = zone.find((q) => q.code === TOOTH_AND_NAIL);
        if (p) {
          ports.putSideScheme(s, p);
          break;
        }
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "venomv:boosts-each":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        placeBoosts(s, seat.id, e.amount, ports);
      break;
    case "venomv:boost-identity":
      placeBoosts(s, e.playerId, e.amount, ports);
      break;
    case "venomv:attach-venom": {
      const p = e.piece as Piece;
      if (s.villain) {
        ports.attach(s, p, s.villain.id);
        p.counters = 2;
      } else ports.discardPiece(s, p.id);
      break;
    }
    case "venomv:attach-villain": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "venomv:attach-identity": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "venomv:chime": {
      const tower = towerActive(s);
      if (!tower) break;
      tower.counters = (tower.counters || 0) + e.amount;
      ports.log(
        s,
        `The Bell Tower gets ${e.amount} chime counter${e.amount === 1 ? "" : "s"} instead of Venom taking that damage.`,
        "good",
      );
      break;
    }
    case "venomv:chime-remove": {
      const tower = bellTower(s);
      if (!tower || !tower.counters) break;
      const removed = Math.min(tower.counters, e.amount);
      tower.counters -= removed;
      ports.log(
        s,
        `${removed} chime counter${removed === 1 ? " is" : "s are"} removed from the Bell Tower.`,
        "bad",
      );
      break;
    }
    case "venomv:tolls": {
      const tower = bellTower(s);
      if (!tower) break;
      tower.counters = Math.max(0, (tower.counters || 0) - 2);
      venomCheck(s, ports);
      if (tower.code === BELL_TOWER) {
        if (alive(s, e.playerId))
          ports.queue(s, {
            type: "damage",
            target: "hero",
            amount: 1,
            source: e.id,
            actorId: e.playerId,
          });
      } else
        ports.queue(s, {
          type: "thwart",
          target: "main",
          amount: 1,
          source: e.id,
        });
      break;
    }
    case "venomv:guard-tower": {
      const tower = bellTower(s);
      if (!tower) break;
      tower.counters = 0;
      tower.code = BELL_TOWER;
      ports.log(
        s,
        "Guard the Bell Tower: the chime counters are removed and the Bell Tower falls Quiet.",
        "bad",
      );
      break;
    }
    case "venomv:retort":
      s.flags.venomRetort = true;
      activateVenom(s, e.playerId, ports, undefined, V("retort-end"));
      break;
    case "venomv:retort-end":
      for (const seat of s.players) delete seatView(s, seat).flags.venomRetort;
      break;
    case "venomv:rage": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      p.counters = Math.max(0, (p.counters || 0) - 1);
      if (!p.counters) ports.discardPiece(s, p.id);
      break;
    }
    case "venomv:violent":
      if (s.villain) ports.giveBoost(s, s.villain.id, "next");
      if (e.discard && s.attachments.some((q) => q.id === e.id))
        ports.discardPiece(s, e.id);
      break;
    case "venomv:lash": {
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p || !p.counters) break;
      ports.queue(s, {
        type: "thwart",
        target: p.id,
        amount: Math.min(p.counters, e.amount),
        source: p.id,
      });
      break;
    }
    case "venomv:pay-discard": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("This attachment is no longer in play.");
      ports.payResources(s, name(p), e.resources, [
        { type: "discardPiece", id: p.id },
      ]);
      break;
    }
    case "venomv:angry-boost": {
      // "Now We're Angry!" as a boost: reveal this card; it attaches.
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "venomv:lash-boost":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, 2, e.id, name(LASHING_OUT));
      break;
    case "venomv:tooth-boost":
      if (s.attack) s.attack.venomPiercing = true;
      break;
    case "venomv:webbed-boost": {
      if (!alive(s, e.playerId)) break;
      const stunned = seatView(s, e.playerId).player.stunned;
      ports.queue(
        s,
        stunned
          ? {
              type: "damage",
              target: "hero",
              amount: 2,
              source: WEBBED_UP,
              actorId: e.playerId,
            }
          : {
              type: "status",
              target: "hero",
              status: "stunned",
              actorId: e.playerId,
            },
      );
      break;
    }
    case "venomv:enraged-boost": {
      // Enraged Symbiote as a boost: it enters play engaged with you.
      const activation = s.attack || s.scheming;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      ports.putMinion(s, p, e.playerId);
      break;
    }
    case "venomv:unstable":
      if (s.villain) ports.giveBoost(s, s.villain.id, "next");
      break;
    case "venomv:unstable-boost":
      if (s.attack) {
        s.attack.extraBoostIcons = (s.attack.extraBoostIcons || 0) + 2;
        s.attack.overkill = true;
      }
      break;
    case "venomv:swing-alter":
      if (!alive(s, e.playerId)) break;
      ports.changeForm(s, e.playerId);
      ports.queue(s, V("swing-attack", { playerId: e.playerId }));
      break;
    case "venomv:swing":
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.giveBoost(s, s.villain.id, "next");
      activateVenom(s, e.playerId, ports, "attack");
      break;
    case "venomv:swing-attack":
      activateVenom(s, e.playerId, ports, "attack");
      break;
    default:
      return false;
  }
  return true;
}
