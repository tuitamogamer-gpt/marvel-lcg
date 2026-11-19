import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Sinister Motives: the Mysterio scenario with its required Personal
 * Nightmare set. Whispers of Paranoia is its recommended modular set. */
export const MYSTERIO_SCENARIO_CODES = [
  "27084",
  "27085",
  "27086",
  "27087a",
  "27087b",
  "27088a",
  "27088b",
  "27089",
  "27090",
  "27091",
  "27092",
  "27093",
] as const;
export const PERSONAL_NIGHTMARE_CODES = [
  "27153",
  "27154",
  "27155",
  "27156",
  "27157",
] as const;
export const WHISPERS_OF_PARANOIA_CODES = [
  "27170",
  "27171",
  "27172",
  "27173",
] as const;
export const MYSTERIO_SCRIPT_CODES = [
  ...MYSTERIO_SCENARIO_CODES,
  ...PERSONAL_NIGHTMARE_CODES,
  ...WHISPERS_OF_PARANOIA_CODES,
] as const;
/** Sinister Motives modular sets selectable in every scenario. */
export const MYSTERIO_MODULAR_SETS = [
  "personal_nightmare",
  "whispers_of_paranoia",
] as const;

const MYSTERIO_VILLAINS = ["27084", "27085", "27086"];
const MAZE = "27087b";
const EDGE = "27088b";
const HALLUCINATION = "27089";
const MIRAGE = "27090";
const APPARITION = "27091";
const DEJA_VU = "27092";
const FEARMONGER = "27093";
const INDUCED_PANIC = "27153";
const DOPPELGANGER = "27154";
const FOOLS_PARADISE = "27155";
const WEAKNESS = "27156";
const DEEPEST_FEARS = "27157";
const COLLUSION = "27170";
const MANIPULATED = "27171";
const OLD_GRUDGE = "27172";
const PARALYSIS = "27173";

export interface MysterioState {
  /** Shifting Apparitions engaged at setup. */
  setup: boolean;
}

export interface MysterioPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  /** The top encounter card, taken without revealing it. */
  drawEncounterTop(s: GameState): Piece | undefined;
  /** Shuffle an encounter card into a player's deck. */
  shuffleIntoPlayerDeck(s: GameState, playerId: string, p: Piece): void;
  /** Discard the top cards of a player's deck (Maze of Mirrors applies). */
  millPlayer(s: GameState, playerId: string, count: number): Piece[];
  discardHandCard(s: GameState, playerId: string, id: string): void;
  randomDiscard(s: GameState, playerId: string): void;
  handSize(s: GameState, playerId: string): number;
  /** The player's nemesis card of this type from the encounter deck, its
   * discard pile or the set-aside area, taken out of that zone. */
  takeNemesis(
    s: GameState,
    playerId: string,
    type: "minion" | "side_scheme",
  ): Piece | undefined;
  allies(s: GameState, playerId: string): Piece[];
  cost(p: Piece): number;
  /** A seeded random index below n. */
  pick(s: GameState, n: number): number;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mysterio:${type}`,
  ...args,
});
const scripted = new Set<string>(MYSTERIO_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const isMysterio = (s: GameState, id: string) =>
  !!s.villain &&
  id === s.villain.id &&
  MYSTERIO_VILLAINS.includes(s.villain.code);
const hasTrait = (p: Piece | string, trait: string) =>
  new RegExp(`(^|\\.\\s*)${trait}\\.`).test(def(p)?.traits || "");
/** Identity-specific player cards: those of the hero's own set. */
const identitySpecific = (s: GameState, playerId: string, p: Piece) =>
  def(p)?.faction_code === "hero" &&
  def(p)?.set_code === s.players.find((q) => q.id === playerId)?.heroId;

// ---------------------------------------------------------------- setup

/** Maze of Mirrors (1A): a Shifting Apparition engages each player. */
export function mysterioSetup(s: GameState, ports: MysterioPorts) {
  s.mysterio = { setup: true };
  s.scheme.threat = (def(MAZE)?.base_threat || 0) * s.playerCount;
  for (const seat of playerOrder(s).filter((q) => !q.eliminated)) {
    const p = s.encounter.deck.find((q) => q.code === APPARITION);
    if (p) ports.putMinion(s, p, seat.id);
  }
  ports.shuffleEncounter(s);
}

/** Mysterio (II) and (III) When Revealed. */
export function mysterioVillainRevealed(s: GameState): Effect[] {
  if (!s.villain || isTextBlank(s, s.villain)) return [];
  if (s.villain.code === "27085") return [M("shuffle-each", { count: 1 })];
  if (s.villain.code === "27086") return [M("mill-each", { count: 5 })];
  return [];
}

/** Edge of Reality (2A) When Revealed. */
export function mysterioMainAdvanced(s: GameState): Effect[] {
  return s.scheme.code === EDGE ? [M("shuffle-each", { count: 2 })] : [];
}

// ---------------------------------------------------------- constants

/** Maze of Mirrors and Edge of Reality: an encounter card a player would
 * draw or discard from their deck is dealt to them facedown instead. */
export function mysterioIntercepts(s: GameState, p: Piece): boolean {
  return (
    !!s.mysterio &&
    [MAZE, EDGE].includes(s.scheme.code) &&
    def(p)?.faction_code === "encounter"
  );
}

/** Evil Doppelgänger: +X ATK and SCH for the identity-specific cards in the
 * engaged player's hand. */
export function mysterioEnemyBonus(s: GameState, p: Piece): number {
  if (p.code !== DOPPELGANGER || !active(s, p) || !p.engagedWith) return 0;
  if (!alive(s, p.engagedWith)) return 0;
  return seatView(s, p.engagedWith).player.hand.filter((q) =>
    identitySpecific(s, p.engagedWith!, q),
  ).length;
}

/** Fool's Paradise: each identity gets +2 hand size. */
export function mysterioHandSize(s: GameState): number {
  return s.sideSchemes.some((p) => p.code === FOOLS_PARADISE && active(s, p))
    ? 2
    : 0;
}

/** Delusion of Collusion: you cannot ready allies or Persona supports you
 * control. */
export function mysterioReadyBlocked(s: GameState, p: Piece): boolean {
  const c = def(p);
  if (
    !c ||
    !(
      c.type_code === "ally" ||
      (c.type_code === "support" && hasTrait(p, "Persona"))
    )
  )
    return false;
  const owner = s.players.find((seat) =>
    seatView(s, seat).player.inPlay.some((q) => q.id === p.id),
  );
  return (
    !!owner &&
    s.attachments.some(
      (a) =>
        a.code === COLLUSION &&
        a.attachedTo === `hero:${owner.id}` &&
        active(s, a),
    )
  );
}

// --------------------------------------------------------------- boosts

/** Seeds of Fear, Creeping Fear and Bound by Fear: after an Illusion boost
 * card resolves during Mysterio's activation it goes to the player's discard
 * pile, the bottom or the top of their deck. Returns true when it moved. */
export function mysterioIllusionBoost(s: GameState, id: string): boolean {
  const activation = s.attack || s.scheming;
  if (!s.villain || !activation || !isMysterio(s, activation.attacker))
    return false;
  if (!active(s, s.villain)) return false;
  const i = s.resolving.findIndex((p) => p.id === id);
  if (i < 0 || !hasTrait(s.resolving[i], "Illusion")) return false;
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  if (!alive(s, playerId)) return false;
  const [p] = s.resolving.splice(i, 1);
  const player = seatView(s, playerId).player;
  if (s.villain.code === "27084") player.discard.push(p);
  else if (s.villain.code === "27085") player.deck.push(p);
  else player.deck.unshift(p);
  return true;
}

// --------------------------------------------------------------- damage

/** Masterful Mirage: damage a player would deal to Mysterio discards the
 * top 4 cards of their deck and Masterful Mirage instead. */
export function mysterioDamageReplacement(
  s: GameState,
  target: string,
  amount: number,
  fromPlayer: boolean,
  ports: Pick<MysterioPorts, "discardPiece" | "log">,
): Effect[] | null {
  if (amount <= 0 || !fromPlayer || !isMysterio(s, target)) return null;
  const mirage = s.attachments.find(
    (a) => a.attachedTo === target && a.code === MIRAGE && active(s, a),
  );
  if (!mirage) return null;
  ports.discardPiece(s, mirage.id);
  ports.log(
    s,
    "Masterful Mirage: the top 4 cards of your deck are discarded instead of Mysterio taking damage.",
    "bad",
  );
  return [M("mill", { playerId: s.activePlayerId, count: 4 })];
}

/** Shifting Apparition: defeated with excess damage, the defeating player
 * shuffles the top encounter card into their deck. */
export function mysterioMinionDefeated(
  s: GameState,
  p: Piece,
  excess: number,
  playerId: string,
): Effect[] {
  return p.code === APPARITION && excess > 0 && alive(s, playerId)
    ? [M("shuffle", { playerId, count: 1 })]
    : [];
}

/** Delusion of Collusion's boost: an ally defeated by this attack deals its
 * controller indirect damage equal to its printed cost. */
export function mysterioAllyDefeated(
  s: GameState,
  ally: Piece,
  playerId: string,
  cost: number,
): Effect[] {
  return s.attack?.mysterioCollusion && cost > 0 && alive(s, playerId)
    ? [M("collusion-damage", { playerId, amount: cost })]
    : [];
}

// -------------------------------------------------------------- actions

export function mysterioActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  const p = s.attachments.find(
    (q) =>
      q.id === id && [HALLUCINATION, INDUCED_PANIC, COLLUSION].includes(q.code),
  );
  return p && mysterioActions(s, p).length ? p : undefined;
}

export function mysterioActions(s: GameState, p: Piece): Option[] {
  if (!known(p) || !active(s, p) || !s.attachments.some((q) => q.id === p.id))
    return [];
  const playerId = s.activePlayerId;
  if (p.code === HALLUCINATION && s.player.form === "hero")
    return [
      {
        id: "discard",
        label: `Spend 1 resource · shuffle 2 encounter cards into your deck · discard ${name(p)}`,
        image: p.code,
        effects: [M("hallucination-pay", { id: p.id, playerId })],
      },
    ];
  if (p.attachedTo !== `hero:${playerId}` || s.player.form !== "alter")
    return [];
  if (
    p.code === INDUCED_PANIC &&
    s.player.hand.some((q) => identitySpecific(s, playerId, q))
  )
    return [
      {
        id: "discard",
        label: `Discard a random identity-specific card · discard ${name(p)}`,
        image: p.code,
        effects: [M("panic", { id: p.id, playerId })],
      },
    ];
  if (
    p.code === COLLUSION &&
    s.player.inPlay.some(
      (q) =>
        def(q)?.type_code === "ally" ||
        (def(q)?.type_code === "support" && hasTrait(q, "Persona")),
    )
  )
    return [
      {
        id: "discard",
        label: `Discard an ally or Persona support · discard ${name(p)}`,
        image: p.code,
        effects: [M("collusion", { id: p.id, playerId })],
      },
    ];
  return [];
}

// ----------------------------------------------------------- reveal

export function mysterioReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === HALLUCINATION || p.code === MIRAGE)
    return [M("attach-mysterio", { piece: p })];
  if (p.code === INDUCED_PANIC || p.code === COLLUSION)
    return [M("attach-identity", { piece: p, playerId })];
  if (p.code === MANIPULATED) return [M("manipulate", { piece: p, playerId })];
  if (p.code === OLD_GRUDGE) return [M("grudge", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case DEJA_VU:
      return [M("deja", { playerId, id: p.id })];
    case FEARMONGER:
      return [M("fearmonger", { playerId })];
    case WEAKNESS:
      return [M("weakness", { playerId, id: p.id })];
    case DEEPEST_FEARS:
      return [M("fears", { playerId })];
    case PARALYSIS:
      return [M("paralysis", { playerId, id: p.id })];
    default:
      return [];
  }
}

export function mysterioBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case MIRAGE:
      // "Give Mysterio 1 additional boost card this activation."
      return s.villain &&
        (s.attack?.attacker === s.villain.id ||
          s.scheming?.attacker === s.villain.id)
        ? [M("mirage-boost")]
        : [];
    case DEJA_VU:
      return [M("reveal-boost", { id: p.id, playerId })];
    case FEARMONGER:
      return [M("fearmonger-boost", { id: p.id, playerId })];
    case DOPPELGANGER:
      return [M("doppelganger-boost", { playerId })];
    case COLLUSION:
      return s.attack ? [M("collusion-boost")] : [];
    case OLD_GRUDGE:
      return [M("grudge-boost", { playerId })];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

function shuffleTop(
  s: GameState,
  playerId: string,
  count: number,
  ports: MysterioPorts,
) {
  if (!alive(s, playerId) || over(s)) return;
  let moved = 0;
  for (let i = 0; i < count; i++) {
    const p = ports.drawEncounterTop(s);
    if (!p) break;
    ports.shuffleIntoPlayerDeck(s, playerId, p);
    moved++;
  }
  if (moved)
    ports.log(
      s,
      `${moved} encounter card${moved === 1 ? " is" : "s are"} shuffled into the deck.`,
      "bad",
    );
}

const retain = (s: GameState, id: string) => {
  const activation = s.attack || s.scheming;
  if (activation && !activation.retainedBoostIds?.includes(id))
    (activation.retainedBoostIds ||= []).push(id);
};

export function resolveMysterioEffect(
  s: GameState,
  e: Effect,
  ports: MysterioPorts,
): boolean {
  if (!e.type.startsWith("mysterio:")) return false;
  switch (e.type) {
    case "mysterio:shuffle-each":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        shuffleTop(s, seat.id, e.count, ports);
      break;
    case "mysterio:shuffle":
      shuffleTop(s, e.playerId, e.count, ports);
      break;
    case "mysterio:mill-each":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.millPlayer(s, seat.id, e.count);
      break;
    case "mysterio:mill":
      if (alive(s, e.playerId)) ports.millPlayer(s, e.playerId, e.count);
      break;
    case "mysterio:attach-mysterio": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "mysterio:attach-identity": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "mysterio:hallucination-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("This attachment is no longer in play.");
      ports.pay(
        s,
        1,
        [],
        [
          M("shuffle", { playerId: e.playerId, count: 2 }),
          { type: "discardPiece", id: p.id },
        ],
        name(p),
        true,
      );
      break;
    }
    case "mysterio:panic": {
      const view = seatView(s, e.playerId);
      const cards = view.player.hand.filter((q) =>
        identitySpecific(s, e.playerId, q),
      );
      if (!cards.length) break;
      const pick = cards[ports.pick(s, cards.length)];
      ports.discardHandCard(s, e.playerId, pick.id);
      ports.discardPiece(s, e.id);
      break;
    }
    case "mysterio:collusion": {
      const view = seatView(s, e.playerId);
      const options = view.player.inPlay.filter(
        (q) =>
          def(q)?.type_code === "ally" ||
          (def(q)?.type_code === "support" && hasTrait(q, "Persona")),
      );
      ports.choose(
        s,
        name(COLLUSION),
        "Discard an ally or Persona support you control to discard Delusion of Collusion.",
        options.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            { type: "discardPiece", id: q.id },
            { type: "discardPiece", id: e.id },
          ],
        })),
      );
      break;
    }
    case "mysterio:manipulate": {
      const p = e.piece as Piece;
      // Its entry and its When Revealed text share this resolution.
      if (!s.resolving.some((q) => q.id === p.id)) break;
      const allies = alive(s, e.playerId)
        ? ports.allies(s, e.playerId).filter((q) => !q.treatedAsMinion)
        : [];
      if (!allies.length) {
        ports.discardPiece(s, p.id);
        ports.queue(s, { type: "surge", sourceCode: p.code });
        break;
      }
      const low = Math.min(...allies.map((q) => ports.cost(q)));
      const lowest = allies.filter((q) => ports.cost(q) === low);
      if (lowest.length === 1) {
        ports.queue(
          s,
          M("manipulate-ally", {
            piece: p,
            playerId: e.playerId,
            id: lowest[0].id,
          }),
        );
        break;
      }
      ports.choose(
        s,
        name(MANIPULATED),
        "Attach Manipulated Mind to the ally you control with the lowest cost.",
        lowest.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            M("manipulate-ally", { piece: p, playerId: e.playerId, id: q.id }),
          ],
        })),
      );
      break;
    }
    case "mysterio:manipulate-ally": {
      const p = e.piece as Piece;
      const view = seatView(s, e.playerId);
      const ally = view.player.inPlay.find((q) => q.id === e.id);
      if (!ally) {
        ports.discardPiece(s, p.id);
        break;
      }
      view.player.inPlay.splice(view.player.inPlay.indexOf(ally), 1);
      ally.treatedAsMinion = true;
      ally.mysterioManipulated = true;
      ally.ownerId ||= e.playerId;
      ally.engagedWith = e.playerId;
      s.minions.push(ally);
      ports.attach(s, p, ally.id);
      ports.log(
        s,
        `Manipulated Mind: ${name(ally)} is treated as a minion engaged with its controller.`,
        "bad",
      );
      break;
    }
    case "mysterio:grudge": {
      const p = e.piece as Piece;
      // Its entry and its When Revealed text share this resolution.
      if (!s.resolving.some((q) => q.id === p.id)) break;
      const nemesis = alive(s, e.playerId)
        ? ports.takeNemesis(s, e.playerId, "minion")
        : undefined;
      ports.shuffleEncounter(s);
      if (!nemesis) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.queue(s, M("grudge-attach", { piece: p, id: nemesis.id }));
      ports.reveal(s, nemesis, e.playerId);
      break;
    }
    case "mysterio:grudge-attach": {
      const p = e.piece as Piece;
      if (s.minions.some((q) => q.id === e.id)) ports.attach(s, p, e.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "mysterio:paralysis": {
      const nemesis = alive(s, e.playerId)
        ? ports.takeNemesis(s, e.playerId, "side_scheme")
        : undefined;
      ports.shuffleEncounter(s);
      if (!nemesis) break;
      ports.queue(
        s,
        M("paralysis-threat", { id: e.id, nemesisId: nemesis.id }),
      );
      ports.reveal(s, nemesis, e.playerId);
      break;
    }
    case "mysterio:paralysis-threat": {
      const nemesis = s.sideSchemes.find((q) => q.id === e.nemesisId);
      if (nemesis?.counters)
        ports.queue(s, {
          type: "threat",
          target: e.id,
          amount: nemesis.counters,
        });
      break;
    }
    case "mysterio:deja":
      if (!alive(s, e.playerId)) break;
      ports.choose(s, name(DEJA_VU), "Choose one.", [
        {
          id: "damage",
          label: "Take 1 damage",
          effects: [
            { type: "damage", target: "hero", amount: 1, source: e.id },
            M("deja-shuffle", { id: e.id, playerId: e.playerId }),
          ],
        },
        {
          id: "threat",
          label: "Place 1 threat on the main scheme",
          effects: [
            { type: "threat", target: "main", amount: 1 },
            M("deja-shuffle", { id: e.id, playerId: e.playerId }),
          ],
        },
      ]);
      break;
    case "mysterio:deja-shuffle": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p) break;
      const seats = playerOrder(s).filter((q) => !q.eliminated);
      if (seats.length === 1) {
        s.resolving.splice(s.resolving.indexOf(p), 1);
        ports.shuffleIntoPlayerDeck(s, seats[0].id, p);
        break;
      }
      ports.choose(
        s,
        name(DEJA_VU),
        "Shuffle Déjà Vu into any player's deck.",
        seats.map((seat) => ({
          id: seat.id,
          label: seat.id,
          effects: [M("deja-into", { id: e.id, playerId: seat.id })],
        })),
      );
      break;
    }
    case "mysterio:deja-into": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p) break;
      s.resolving.splice(s.resolving.indexOf(p), 1);
      ports.shuffleIntoPlayerDeck(s, e.playerId, p);
      break;
    }
    case "mysterio:fearmonger": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      for (const q of [...view.player.hand])
        ports.discardHandCard(s, e.playerId, q.id);
      const n = Math.max(
        0,
        ports.handSize(s, e.playerId) -
          seatView(s, e.playerId).player.hand.length,
      );
      if (n) ports.queue(s, { type: "draw", amount: n, actorId: e.playerId });
      break;
    }
    case "mysterio:weakness": {
      const n = alive(s, e.playerId)
        ? seatView(s, e.playerId).player.hand.length
        : 0;
      if (n) ports.queue(s, { type: "threat", target: e.id, amount: n });
      break;
    }
    case "mysterio:fears": {
      if (!alive(s, e.playerId)) break;
      const n = seatView(s, e.playerId).player.hand.length;
      const discarded = n ? ports.millPlayer(s, e.playerId, n) : [];
      if (discarded.some((q) => identitySpecific(s, e.playerId, q)))
        ports.queue(s, { type: "threat", target: "main", amount: 1 });
      else
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 1,
          source: DEEPEST_FEARS,
          actorId: e.playerId,
        });
      break;
    }
    case "mysterio:mirage-boost":
      if (
        s.villain &&
        (s.attack?.attacker === s.villain.id ||
          s.scheming?.attacker === s.villain.id)
      )
        ports.giveBoost(s, s.villain.id, "current");
      break;
    case "mysterio:reveal-boost": {
      retain(s, e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "mysterio:fearmonger-boost": {
      if (!alive(s, e.playerId)) break;
      const deal: Option = {
        id: "deal",
        label: "Deal Fearmonger to yourself facedown",
        effects: [M("fearmonger-deal", { id: e.id, playerId: e.playerId })],
      };
      if (!ports.canPay(s, 2, ["mental", "mental"]))
        ports.queue(s, ...deal.effects);
      else
        ports.choose(s, name(FEARMONGER), "Choose one.", [
          {
            id: "spend",
            label: "Spend 2 mental resources",
            effects: [M("fearmonger-pay", { id: e.id, playerId: e.playerId })],
          },
          deal,
        ]);
      break;
    }
    case "mysterio:fearmonger-pay":
      ports.pay(s, 2, ["mental", "mental"], [], name(FEARMONGER), false);
      break;
    case "mysterio:fearmonger-deal": {
      retain(s, e.id);
      const i = s.resolving.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = s.resolving.splice(i, 1);
      p.dealtTo = e.playerId;
      s.encounter.dealt.push(p);
      break;
    }
    case "mysterio:doppelganger-boost":
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        { type: "draw", amount: 3, actorId: e.playerId },
        M("random-discards", { playerId: e.playerId, count: 3 }),
      );
      break;
    case "mysterio:random-discards":
      for (let i = 0; i < e.count; i++)
        if (seatView(s, e.playerId).player.hand.length)
          ports.randomDiscard(s, e.playerId);
      break;
    case "mysterio:collusion-boost":
      if (s.attack) s.attack.mysterioCollusion = true;
      break;
    case "mysterio:collusion-damage":
      ports.indirect(s, e.playerId, e.amount, COLLUSION, name(COLLUSION));
      break;
    case "mysterio:grudge-boost": {
      if (!alive(s, e.playerId)) break;
      const targets = ["hero", ...ports.allies(s, e.playerId).map((q) => q.id)];
      ports.queue(
        s,
        ...targets.map((target) => ({
          type: "damage",
          target,
          amount: 1,
          source: OLD_GRUDGE,
          actorId: e.playerId,
        })),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
