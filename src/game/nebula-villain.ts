import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Attack, Effect, GameState, Option, Piece } from "./types.js";

/** The Galaxy's Most Wanted: the Nebula scenario, its required Power Stone set
 * and the Space Pirates modular set. Ship Command is registered by the
 * Brotherhood of Badoon module. */
export const NEBULA_SCENARIO_CODES = [
  "16088",
  "16089",
  "16090",
  "16091a",
  "16091b",
  "16092a",
  "16092b",
  "16093",
  "16094",
  "16095",
  "16096",
  "16097",
  "16098",
  "16099",
  "16100",
  "16101",
  "16102",
] as const;
export const POWER_STONE = "16149";
export const SPACE_PIRATES_CODES = [
  "16138",
  "16139",
  "16140",
  "16141",
] as const;
export const NEBULA_VILLAIN_SCRIPT_CODES = [
  ...NEBULA_SCENARIO_CODES,
  POWER_STONE,
  ...SPACE_PIRATES_CODES,
] as const;
export const NEBULA_VILLAINS = ["16088", "16089", "16090"] as const;
export const NEBULA_SHIP = "16093";
export const TECHNIQUES = ["16094", "16095", "16096", "16097", "16098"];
const SOUND_THE_ALARMS = "16140";

export interface NebulaVillainState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `nebula-villain:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (NEBULA_VILLAIN_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const isNebula = (s: GameState) =>
  (NEBULA_VILLAINS as readonly string[]).includes(s.villain.code);

export interface NebulaVillainPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  giveTough(s: GameState, id: string): boolean;
  /** Whether a payment is possible while the Milano is exhausted as a cost. */
  canPayWithoutMilano(s: GameState, cost: number): boolean;
  milano(s: GameState): Piece | undefined;
  /** Remove the top card of a player's deck from the game. */
  removeTop(s: GameState, playerId: string): void;
  /** Remove a random card in a player's hand from the game. */
  removeRandomHand(s: GameState, playerId: string): void;
}

export function nebulaShip(s: GameState): Piece | undefined {
  return (s.environments || []).find((p) => p.code === NEBULA_SHIP);
}
export function nebulaEvasion(s: GameState) {
  return nebulaShip(s)?.counters || 0;
}
function attachedTechniques(s: GameState) {
  return s.attachments.filter(
    (p) =>
      TECHNIQUES.includes(p.code) &&
      p.attachedTo === s.villain.id &&
      !isTextBlank(s, p),
  );
}
function attached(s: GameState, code: string, id: string) {
  return s.attachments.filter(
    (p) => p.code === code && p.attachedTo === id && !isTextBlank(s, p),
  ).length;
}

/** "X is equal to the number of evasion counters on Nebula's Ship" (per player). */
export function nebulaEscalation(s: GameState): number | undefined {
  if (
    !s.nebulaVillain ||
    !["16091b", "16092b"].includes(s.scheme.code) ||
    isTextBlank(s, s.nebulaVillain.currentMain)
  )
    return undefined;
  return nebulaEvasion(s) * s.playerCount;
}

/** Granted keywords: Stalwart (Evasive Maneuvering, Unyielding Persistence)
 * and Retaliate 1 for each Weapon Mastery attached to Nebula. */
export function nebulaVillainKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (!s.nebulaVillain || p.id !== s.villain.id) return 0;
  if (keyword === "Stalwart")
    return attached(s, "16095", p.id) + attached(s, "16096", p.id) ? 1 : 0;
  if (keyword === "Retaliate") return attached(s, "16097", p.id);
  return 0;
}

/** Sound the Alarms: each enemy gets +1 ATK. */
export function nebulaEnemyAttack(s: GameState, p: Piece) {
  const enemy = p.id === s.villain.id || s.minions.some((m) => m.id === p.id);
  return enemy
    ? s.sideSchemes.filter(
        (q) => q.code === SOUND_THE_ALARMS && !isTextBlank(s, q),
      ).length
    : 0;
}

/** Wide Stance reduces each attack's damage to Nebula by 1, and with Cutthroat
 * Ambition she cannot take more than 5 damage from a single attack. Packets
 * of the same attack share both allowances through `flags`. */
export function nebulaAttackDamage(
  s: GameState,
  targetId: string,
  amount: number,
  attackKey?: string,
): number {
  if (!s.nebulaVillain || targetId !== s.villain.id || amount <= 0)
    return amount;
  const reduction = attached(s, "16098", targetId);
  const usedKey = attackKey ? `nebulaStance:${attackKey}` : undefined;
  const used = usedKey ? Number(s.flags[usedKey] || 0) : 0;
  const reduced = Math.min(amount, Math.max(0, reduction - used));
  if (usedKey && reduced) s.flags[usedKey] = used + reduced;
  let n = amount - reduced;
  if (attached(s, "16094", targetId) && n > 0) {
    const takenKey = attackKey ? `nebulaCutthroat:${attackKey}` : undefined;
    const taken = takenKey ? Number(s.flags[takenKey] || 0) : 0;
    n = Math.min(n, Math.max(0, 5 - taken));
    if (takenKey) s.flags[takenKey] = taken + n;
  }
  return n;
}

/** Power Stone: a hero dealing 3 or more damage to the villain with a single
 * attack takes it. */
export function nebulaDamaged(
  s: GameState,
  targetId: string,
  source: string,
  amount: number,
  attack: boolean,
): Effect[] {
  if (!attack || amount < 3 || targetId !== s.villain.id) return [];
  const stone = s.attachments.find(
    (p) => p.code === POWER_STONE && p.attachedTo === targetId,
  );
  if (!stone || isTextBlank(s, stone)) return [];
  const playerId =
    source === "hero"
      ? s.activePlayerId
      : source.startsWith("hero:")
        ? source.slice(5)
        : undefined;
  return playerId ? [V("stone", { id: stone.id, to: `hero:${playerId}` })] : [];
}

export function nebulaAttackResponses(
  s: GameState,
  a: Attack,
  recipientId: string,
): MutagenForcedResponse[] {
  const damaged = (a.identityDamage || 0) > 0;
  const responses: MutagenForcedResponse[] = [];
  const minion = s.minions.find((p) => p.id === a.attacker);
  if (
    minion &&
    ["16138", "16139"].includes(minion.code) &&
    !isTextBlank(s, minion) &&
    damaged &&
    alive(s, recipientId)
  )
    responses.push({
      id: `${a.id}:space-pirate`,
      sourceId: minion.id,
      title: name(minion),
      effects: [
        V(minion.code === "16138" ? "remove-hand" : "remove-top", {
          playerId: recipientId,
        }),
      ],
    });
  const stone = s.attachments.find(
    (p) => p.code === POWER_STONE && p.attachedTo === `hero:${recipientId}`,
  );
  if (
    stone &&
    !isTextBlank(s, stone) &&
    a.attacker === s.villain.id &&
    (a.identityDamage || 0) >= 3
  )
    responses.push({
      id: `${a.id}:power-stone`,
      sourceId: stone.id,
      title: "Power Stone",
      effects: [V("stone", { id: stone.id, to: s.villain.id })],
    });
  return responses;
}

export function nebulaReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (TECHNIQUES.includes(p.code))
    return [V("revealed-technique", { piece: p, playerId: s.activePlayerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "16092a":
      return [V("warp")];
    case "16099":
      return [V("seek", { playerId: s.activePlayerId })];
    case "16100":
      return [V("evasion", { amount: 1 })];
    case "16101":
      return [V("seek", { playerId: s.activePlayerId, special: true })];
    case "16102":
      return [
        V("ruthless", {
          playerId: s.activePlayerId,
          kind: s.player.form === "hero" ? "attack" : "scheme",
        }),
      ];
    case "16141":
      return [V("honor", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

export function nebulaBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (TECHNIQUES.includes(p.code))
    return [V("technique-boost", { id: p.id, playerId: s.activePlayerId })];
  switch (p.code) {
    case "16100":
      return [V("evasion", { amount: 1 })];
    case "16138":
    case "16139":
      return [V("extra-boost")];
    case SOUND_THE_ALARMS:
      return [V("alarms", { id: p.id })];
    default:
      return [];
  }
}

/** Nebula's Forced Interrupt when she initiates an activation against you. */
export function nebulaActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    !s.nebulaVillain ||
    enemyId !== s.villain.id ||
    !isNebula(s) ||
    isTextBlank(s, s.villain)
  )
    return [];
  const techniques = attachedTechniques(s);
  if (!techniques.length) return [];
  return [
    ...techniques.map((p) =>
      V("special", { code: p.code, playerId, actorId: playerId }),
    ),
    V("after-specials", {
      ids: techniques.map((p) => p.id),
      playerId,
      stage: s.villain.code,
      actorId: playerId,
    }),
  ];
}

/** Nebula's Ship: place 1 evasion counter when the villain phase begins. */
export function nebulaVillainPhaseInterrupts(s: GameState): Effect[] {
  const ship = nebulaShip(s);
  return ship && !isTextBlank(s, ship)
    ? [V("ship-phase", { id: ship.id, actorId: s.firstPlayerId })]
    : [];
}

/** Nebula's Ship "Shoot the Thrusters!" First Player Action. */
export function nebulaActions(
  s: GameState,
  p: Piece,
  ports?: Pick<NebulaVillainPorts, "canPayWithoutMilano" | "milano">,
): Option[] {
  if (
    p.code !== NEBULA_SHIP ||
    !(s.environments || []).some((q) => q.id === p.id) ||
    isTextBlank(s, p) ||
    s.activePlayerId !== s.firstPlayerId ||
    s.phase !== "player" ||
    !p.counters
  )
    return [];
  const milano = ports?.milano(s);
  if (ports && (!milano || milano.exhausted || isTextBlank(s, milano)))
    return [];
  return [1, 2]
    .filter(
      (n) => n <= p.counters && (!ports || ports.canPayWithoutMilano(s, n)),
    )
    .map((n) => ({
      id: `thrusters-${n}`,
      label: `First Player Action · exhaust the Milano and spend ${n} resource${n === 1 ? "" : "s"} · remove ${n} evasion counter${n === 1 ? "" : "s"}`,
      image: p.code,
      effects: [V("thrusters", { id: p.id, amount: n })],
    }));
}
export function nebulaActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return (s.environments || []).find(
    (p) => p.id === id && p.code === NEBULA_SHIP,
  );
}

/** A Special resolved during Nebula's activation boosts it; one resolved
 * after an activation ended (a Technique boost) or outside any activation
 * gives the facedown boost card to her next activation. */
function boostScope(s: GameState, later = false): "current" | "next" {
  return !later &&
    (s.attack?.attacker === s.villain.id ||
      s.scheming?.attacker === s.villain.id)
    ? "current"
    : "next";
}

/** Discard from the encounter deck until a card matching `match` is discarded;
 * the ability stops at the deck's reset boundary. */
function discardUntil(
  s: GameState,
  ports: NebulaVillainPorts,
  match: (p: Piece) => boolean,
): Piece | undefined {
  for (let n = 0; n < 200; n++) {
    const { piece, emptied } = ports.discardTop(s);
    if (piece && match(piece)) return piece;
    if (!piece || emptied) return undefined;
  }
  return undefined;
}

export function resolveNebulaVillainEffect(
  s: GameState,
  e: Effect,
  ports: NebulaVillainPorts,
): boolean {
  if (!e.type.startsWith("nebula-villain:")) return false;
  switch (e.type) {
    case "nebula-villain:revealed-technique": {
      const p = e.piece as Piece;
      if (!isNebula(s)) break;
      ports.attach(s, p, s.villain.id);
      const flag = "nebulaTechniqueSurge";
      if (
        s.flags[flag] !== s.round &&
        !isTextBlank(s, s.villain) &&
        !isTextBlank(s, p)
      ) {
        // The first Technique attachment revealed each round gains surge.
        s.flags[flag] = s.round;
        ports.queue(s, {
          type: "surge",
          sourceCode: p.code,
          actorId: e.playerId,
        });
      }
      if (e.special)
        ports.queue(
          s,
          V("special", {
            code: p.code,
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        );
      break;
    }
    case "nebula-villain:special": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      switch (e.code) {
        case "16094":
          ports.queue(s, { type: "threat", target: "main", amount: 1 });
          break;
        case "16095":
          if (view.player.stunned)
            ports.giveBoost(s, s.villain.id, boostScope(s, !!e.later));
          else
            ports.queue(s, {
              type: "status",
              target: `hero:${e.playerId}`,
              status: "stunned",
              actorId: e.playerId,
            });
          break;
        case "16096":
          if (s.villain.tough)
            ports.giveBoost(s, s.villain.id, boostScope(s, !!e.later));
          else ports.giveTough(s, s.villain.id);
          break;
        case "16097":
          ports.queue(s, {
            type: "damage",
            target: "hero",
            amount: 1,
            source: "encounter",
            actorId: e.playerId,
          });
          break;
        case "16098":
          ports.queue(s, { type: "randomDiscard", actorId: e.playerId });
          break;
      }
      break;
    }
    case "nebula-villain:after-specials": {
      const pieces = (e.ids as string[])
        .map((id) => s.attachments.find((p) => p.id === id))
        .filter((p): p is Piece => !!p);
      if (!pieces.length) break;
      const discard = (p: Piece) => V("discard", { id: p.id });
      const options = pieces.map((p) => ({
        id: p.id,
        label: `Discard ${name(p)}`,
        image: p.code,
        effects: [discard(p)],
      }));
      if (e.stage === "16088") {
        for (const p of pieces) ports.discardPiece(s, p.id);
      } else if (e.stage === "16089") {
        if (pieces.length === 1) ports.discardPiece(s, pieces[0].id);
        else
          ports.choose(
            s,
            "Nebula",
            "Choose and discard 1 Technique attachment.",
            options,
          );
      } else if (alive(s, e.playerId)) {
        const deck = seatView(s, e.playerId).player.deck;
        if (!deck.length) break;
        ports.choose(
          s,
          "Nebula",
          "You may remove the top card of your deck from the game to choose and discard 1 Technique attachment.",
          [
            ...options.map((o) => ({
              ...o,
              label: `Remove your top card · ${o.label.toLowerCase()}`,
              effects: [
                V("remove-top", { playerId: e.playerId }),
                ...o.effects,
              ],
            })),
            { id: "skip", label: "Keep every Technique", effects: [] },
          ],
        );
      }
      break;
    }
    case "nebula-villain:discard":
      if (s.attachments.some((p) => p.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "nebula-villain:technique-boost": {
      const activation = s.attack || s.scheming;
      if (!activation) break;
      (activation.retainedBoostIds ||= []).push(e.id);
      (activation.afterActivation ||= []).push(
        V("technique-attach", { id: e.id, playerId: e.playerId }),
      );
      break;
    }
    case "nebula-villain:technique-attach": {
      // After this activation ends, attach this card to Nebula and resolve
      // its "Special" ability.
      const p = [...s.encounter.discard, ...s.resolving].find(
        (q) => q.id === e.id,
      );
      if (!p || !isNebula(s)) break;
      ports.attach(s, p, s.villain.id);
      if (alive(s, e.playerId))
        ports.queue(
          s,
          V("special", {
            code: p.code,
            playerId: e.playerId,
            actorId: e.playerId,
            later: true,
          }),
        );
      break;
    }
    case "nebula-villain:seek": {
      ports.revealHidden(s);
      const p = discardUntil(s, ports, (q) => TECHNIQUES.includes(q.code));
      if (p)
        ports.queue(
          s,
          V("revealed-technique", {
            piece: p,
            playerId: e.playerId,
            special: !!e.special,
          }),
        );
      break;
    }
    case "nebula-villain:evasion": {
      const ship = nebulaShip(s);
      if (ship) ship.counters += e.amount;
      break;
    }
    case "nebula-villain:ship-phase": {
      const ship = (s.environments || []).find((q) => q.id === e.id);
      if (ship && !isTextBlank(s, ship)) ship.counters += 1;
      break;
    }
    case "nebula-villain:thrusters": {
      const ship = (s.environments || []).find((q) => q.id === e.id);
      const milano = ports.milano(s);
      if (!ship || !milano || milano.exhausted)
        throw Error("The first player needs the ready Milano for this action.");
      milano.exhausted = true;
      ports.pay(
        s,
        e.amount,
        [],
        [V("thrusters-remove", { id: ship.id, amount: e.amount })],
        "Shoot the Thrusters!",
        false,
      );
      break;
    }
    case "nebula-villain:thrusters-remove": {
      const ship = (s.environments || []).find((q) => q.id === e.id);
      if (ship) ship.counters = Math.max(0, ship.counters - e.amount);
      break;
    }
    case "nebula-villain:warp": {
      // Warp Drive Initiated (2A): place 2 evasion counters, then for each
      // evasion counter discard the top 2 cards of each player deck and the
      // encounter deck.
      const ship = nebulaShip(s);
      if (ship) ship.counters += 2;
      const amount = 2 * nebulaEvasion(s);
      if (!amount) break;
      ports.queue(
        s,
        ...playerOrder(s).map((seat) => ({
          type: "mill",
          amount,
          actorId: seat.id,
        })),
        V("warp-encounter", { amount }),
      );
      break;
    }
    case "nebula-villain:warp-encounter":
      ports.revealHidden(s);
      for (let i = 0; i < e.amount; i++) ports.discardTop(s);
      break;
    case "nebula-villain:main-back": {
      if (!s.nebulaVillain) break;
      const main = s.nebulaVillain.currentMain;
      const back = definitions.get(main.code)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = definitions.get(main.code);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      break;
    }
    case "nebula-villain:ruthless":
      if (!alive(s, e.playerId)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
        after: V("ruthless-after", { kind: e.kind }),
      });
      break;
    case "nebula-villain:ruthless-after": {
      const placed =
        e.kind === "attack"
          ? Number(e.damagePlaced || 0) > 0
          : Number(e.threatPlaced || 0) > 0;
      if (placed) ports.queue(s, V("evasion", { amount: 1 }));
      break;
    }
    case "nebula-villain:honor": {
      ports.revealHidden(s);
      const p = discardUntil(
        s,
        ports,
        (q) =>
          definitions.get(q.code)?.type_code === "minion" &&
          !!definitions.get(q.code)?.traits?.includes("Criminal."),
      );
      if (!p || !alive(s, e.playerId)) break;
      // Queue first: revealing puts its own effects ahead of this one.
      ports.queue(s, V("honor-after", { id: p.id }));
      ports.reveal(s, p, e.playerId);
      break;
    }
    case "nebula-villain:honor-after":
      if (s.minions.some((p) => p.id === e.id)) ports.giveTough(s, e.id);
      ports.giveBoost(s, s.villain.id, "next");
      break;
    case "nebula-villain:extra-boost":
      // "Give the villain 1 additional boost card for this activation": only
      // while the villain itself is activating.
      if (
        s.attack?.attacker === s.villain.id ||
        s.scheming?.attacker === s.villain.id
      )
        ports.giveBoost(s, s.villain.id, "current");
      break;
    case "nebula-villain:alarms": {
      const activation = s.attack || s.scheming;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!activation || !p) break;
      (activation.retainedBoostIds ||= []).push(e.id);
      ports.putSideScheme(s, p);
      break;
    }
    case "nebula-villain:remove-top":
      if (alive(s, e.playerId)) ports.removeTop(s, e.playerId);
      break;
    case "nebula-villain:remove-hand":
      if (alive(s, e.playerId)) ports.removeRandomHand(s, e.playerId);
      break;
    case "nebula-villain:stone": {
      const stone = s.attachments.find((p) => p.id === e.id);
      if (!stone) break;
      if (e.to === s.villain.id || alive(s, String(e.to).replace(/^hero:/, "")))
        stone.attachedTo = e.to;
      break;
    }
    default:
      return false;
  }
  return true;
}
