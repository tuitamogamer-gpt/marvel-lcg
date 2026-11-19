import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Across the Mojoverse, MojoMania's second scenario. Spiral escapes
 * through Mojo's Shows: while she is Escaped she cannot be hurt, the
 * players search the show deck for Cornered! and must defeat her Cornered
 * side before her teleport counters flip her away again. */
export const SPIRAL_SCRIPT_CODES = [
  "39012a",
  "39012b",
  "39013a",
  "39013b",
  "39014a",
  "39014b",
  "39015a",
  "39015b",
  "39016",
  "39017",
  "39018",
  "39019",
  "39020",
  "39021",
] as const;

export const ACROSS_THE_MOJOVERSE = "39015b";
export const THE_SEARCH_FOR_SPIRAL = "39016";
export const CORNERED = "39017";
export const SPIRALS_SWORDS = "39018";
const ERRATIC_TELEPORTATION = "39019";
const THE_SHOW_MUST_GO_ON = "39020";
const WELL_ARMED = "39021";
/** Escaped side → Cornered side. */
export const SPIRAL_CORNERED: Record<string, string> = {
  "39012a": "39012b",
  "39013a": "39013b",
  "39014a": "39014b",
};
/** Cornered side → Escaped side. */
export const SPIRAL_ESCAPED: Record<string, string> = {
  "39012b": "39012a",
  "39013b": "39013a",
  "39014b": "39014a",
};
/** Teleport counters per player that flip each Cornered side away. */
const TELEPORT_LIMIT: Record<string, number> = {
  "39012b": 3,
  "39013b": 2,
  "39014b": 3,
};

export interface SpiralPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  putEnvironment(s: GameState, p: Piece): void;
  makePiece(s: GameState, code: string): Piece;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** A Show revealed from the show deck: discard each other Setting
   * environment, without surge. */
  revealShow(s: GameState, p: Piece): void;
  /** Deal an encounter card to a player facedown. */
  dealPiece(s: GameState, p: Piece, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const SP = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `spiral:${type}`,
  ...args,
});
const scripted = new Set<string>(SPIRAL_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const hasTrait = (p: Piece, trait: string) =>
  (def(p)?.traits || "").split(/\.\s*/).includes(trait);

export const spiralScenario = (s: GameState) => !!s.spiral;
export const spiralEscaped = (s: GameState) =>
  !!s.spiral && !!SPIRAL_CORNERED[s.villain?.code || ""];
export const spiralCornered = (s: GameState) =>
  !!s.spiral && !!SPIRAL_ESCAPED[s.villain?.code || ""];
export const spiralTeleportLimit = (s: GameState) =>
  (TELEPORT_LIMIT[s.villain?.code || ""] || 0) * s.playerCount;
export const isShow = (p: Piece) => hasTrait(p, "Show");

/** Across the Mojoverse's own zone: the show deck. */
export interface SpiralState {
  showDeck: Piece[];
}

// ------------------------------------------------------------------ setup

/** Across the Mojoverse (1A): The Search for Spiral and one random Show
 * enter play; the other Shows and Cornered! form the show deck. Spiral
 * starts on her Escaped side. */
export function spiralSetup(s: GameState, ports: SpiralPorts) {
  const take = (code: string) => {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : undefined;
  };
  const search = take(THE_SEARCH_FOR_SPIRAL);
  const cornered = take(CORNERED);
  const shows = s.encounter.deck.filter(isShow);
  s.encounter.deck = s.encounter.deck.filter((p) => !isShow(p));
  const pool = ports.shuffle(s, shows);
  const first = pool.shift();
  s.spiral = {
    showDeck: ports.shuffle(s, [...pool, ...(cornered ? [cornered] : [])]),
  };
  if (search) ports.putSideScheme(s, search);
  if (first) ports.putEnvironment(s, first);
  s.scheme.threat =
    (def(ACROSS_THE_MOJOVERSE)?.base_threat || 0) * s.playerCount;
}

// ------------------------------------------------------------ constants

/** Escaped: Spiral cannot take damage. */
export function spiralVillainImmune(s: GameState, target: string) {
  return spiralEscaped(s) && target === s.villain.id && active(s, s.villain);
}
/** Escaped: Spiral cannot be stunned. */
export function spiralCannotStun(s: GameState, p: Piece) {
  return spiralEscaped(s) && p.id === s.villain.id && active(s, s.villain);
}
/** Escaped: threat cannot be removed from the main scheme. */
export function spiralThwartLocked(s: GameState, target: string) {
  return target === "main" && spiralEscaped(s) && active(s, s.villain);
}
/** Escaped: when Spiral would attack, she schemes instead. */
export function spiralSchemesInstead(s: GameState, enemyId: string) {
  return spiralEscaped(s) && enemyId === s.villain.id && active(s, s.villain);
}
/** Spiral's Swords: +1 ATK for each sword counter. */
export function spiralAttackBonus(s: GameState, p: Piece) {
  if (!s.spiral || p.id !== s.villain.id) return 0;
  return s.attachments
    .filter(
      (a) => a.attachedTo === p.id && a.code === SPIRALS_SWORDS && active(s, a),
    )
    .reduce((n, a) => n + (a.counters || 0), 0);
}

// --------------------------------------------------------------- events

/** When Spiral is defeated, her next stage enters play on the same side as
 * the defeated stage. */
export function spiralNextStageCode(
  s: GameState,
  previous: string,
  next: string,
): string {
  return s.spiral && SPIRAL_ESCAPED[previous] && SPIRAL_CORNERED[next]
    ? SPIRAL_CORNERED[next]
    : next;
}
/** Spiral (III)'s Cornered side: When Revealed, she attacks each player in
 * player order, even in alter-ego form. */
function attackEach(s: GameState): Effect[] {
  return s.villain?.code === "39014b" && active(s, s.villain)
    ? playerOrder(s)
        .filter((seat) => !seat.eliminated)
        .map((seat) => SP("attack-each", { playerId: seat.id }))
    : [];
}
/** A new Spiral stage revealed on her Cornered side. */
export function spiralVillainRevealed(s: GameState): Effect[] {
  return s.spiral ? attackEach(s) : [];
}

/** Cornered: after Spiral activates, she gains a teleport counter. */
export function spiralActivated(s: GameState, enemyId: string): Effect[] {
  return spiralCornered(s) &&
    enemyId === s.villain.id &&
    active(s, s.villain) &&
    !over(s)
    ? [SP("teleport", { n: 1 })]
    : [];
}
/** The Search for Spiral's Forced Interrupt after its last threat is
 * removed: reveal the top card of the show deck and place 3 threat per
 * player here. */
export function spiralSearchEmptied(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] | null {
  if (!s.spiral || p.code !== THE_SEARCH_FOR_SPIRAL || p.counters) return null;
  if (!active(s, p)) return [];
  return [
    SP("reveal-show", { actorId: playerId }),
    SP("search-threat", { id: p.id }),
  ];
}
/** Across the Mojoverse's Forced Interrupt: a Show environment that would
 * be discarded goes to the bottom of the show deck instead. */
export function spiralKeepsShow(s: GameState, p: Piece) {
  return (
    !!s.spiral &&
    s.scheme.code === ACROSS_THE_MOJOVERSE &&
    isShow(p) &&
    (s.environments || []).some((q) => q.id === p.id)
  );
}

// --------------------------------------------------------------- reveal

export function spiralReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === SPIRALS_SWORDS) return [SP("attach", { piece: p })];
  // Cornered! cannot be canceled; its text resolves even when blank text
  // effects would apply to treacheries.
  if (p.code === CORNERED) return [SP("cornered", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const playerId = s.activePlayerId;
  switch (p.code) {
    case ERRATIC_TELEPORTATION:
      return [SP("erratic", { playerId })];
    case THE_SHOW_MUST_GO_ON:
      return [SP("show-must-go-on")];
    case WELL_ARMED:
      return [SP("well-armed", { playerId })];
    default:
      return [];
  }
}
export function spiralBoost(s: GameState, p: Piece): Effect[] | null {
  return known(p) ? [] : null;
}

// -------------------------------------------------------------- actions

/** The cards whose Hero Actions belong to no player: The Search for
 * Spiral and Spiral's Swords. */
export function spiralActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  if (!s.spiral) return undefined;
  return (
    s.sideSchemes.find(
      (p) => p.id === id && p.code === THE_SEARCH_FOR_SPIRAL,
    ) || s.attachments.find((p) => p.id === id && p.code === SPIRALS_SWORDS)
  );
}
export function spiralActions(
  s: GameState,
  p: Piece,
  ports: Pick<SpiralPorts, "canPay">,
): Option[] {
  if (!s.spiral || !known(p) || !active(s, p)) return [];
  if (s.phase !== "player" || s.player.form !== "hero") return [];
  // The Search for Spiral: take 2 damage → remove 3 threat from here.
  if (
    p.code === THE_SEARCH_FOR_SPIRAL &&
    s.sideSchemes.some((q) => q.id === p.id) &&
    p.counters > 0
  )
    return [
      {
        id: "search",
        label: "Hero Action · take 2 damage · remove 3 threat",
        image: p.code,
        effects: [SP("search", { id: p.id, playerId: s.activePlayerId })],
      },
    ];
  // Spiral's Swords: while Spiral is Cornered, spend 2 physical → remove
  // 1 sword counter.
  if (
    p.code === SPIRALS_SWORDS &&
    spiralCornered(s) &&
    p.counters > 0 &&
    ports.canPay(s, 2, ["physical", "physical"])
  )
    return [
      {
        id: "sword",
        label: "Hero Action · spend 2 physical · remove a sword counter",
        image: p.code,
        effects: [SP("sword-pay", { id: p.id })],
      },
    ];
  return [];
}

// ------------------------------------------------------------- resolver

export function resolveSpiralEffect(
  s: GameState,
  e: Effect,
  ports: SpiralPorts,
): boolean {
  if (!e.type.startsWith("spiral:")) return false;
  const st = s.spiral;
  switch (e.type) {
    case "spiral:teleport": {
      if (!spiralCornered(s) || over(s)) break;
      s.villain.counters = (s.villain.counters || 0) + e.n;
      ports.log(
        s,
        `Spiral gains ${e.n} teleport counter${e.n === 1 ? "" : "s"} (${s.villain.counters}).`,
        "bad",
      );
      // At the limit she removes them all and flips to her Escaped side.
      if (s.villain.counters >= spiralTeleportLimit(s)) {
        s.villain.counters = 0;
        s.villain.code = SPIRAL_ESCAPED[s.villain.code];
        ports.log(s, "Spiral teleports away: she is Escaped again.", "bad");
      }
      break;
    }
    case "spiral:reveal-show": {
      const p = st?.showDeck.shift();
      if (!p) {
        ports.log(s, "The show deck is empty.");
        break;
      }
      ports.log(s, `${name(p)} is revealed from the show deck.`);
      if (p.code === CORNERED) ports.queue(s, SP("cornered", { piece: p }));
      else ports.revealShow(s, p);
      break;
    }
    case "spiral:search-threat": {
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (p)
        ports.queue(s, {
          type: "threat",
          target: p.id,
          amount: 3 * s.playerCount,
        });
      break;
    }
    case "spiral:cornered": {
      const p = e.piece as Piece;
      // Flip Spiral to her Cornered side; her When Revealed text resolves.
      const attacks: Effect[] = [];
      if (spiralEscaped(s)) {
        s.villain.code = SPIRAL_CORNERED[s.villain.code];
        ports.log(s, "Cornered! Spiral can be damaged.", "good");
        // Teleport counters she kept from an earlier stage count at once.
        if (s.villain.counters >= spiralTeleportLimit(s)) {
          s.villain.counters = 0;
          s.villain.code = SPIRAL_ESCAPED[s.villain.code];
          ports.log(s, "Spiral teleports away: she is Escaped again.", "bad");
        } else attacks.push(...attackEach(s));
      }
      ports.queue(
        s,
        ...attacks,
        SP("reveal-show"),
        SP("shuffle-cornered", { piece: p }),
      );
      break;
    }
    case "spiral:shuffle-cornered": {
      const p = e.piece as Piece;
      if (!st) break;
      // Remove the card from wherever its reveal left it, then shuffle it
      // into the show deck.
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      s.encounter.discard = s.encounter.discard.filter((q) => q.id !== p.id);
      st.showDeck = ports.shuffle(s, [...st.showDeck, p]);
      break;
    }
    case "spiral:attack-each":
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    case "spiral:attach": {
      const p = e.piece as Piece;
      if (!s.villain) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, s.villain.id);
      const a = s.attachments.find((q) => q.id === p.id);
      // Uses (3 sword counters).
      if (a) a.counters = 3;
      break;
    }
    case "spiral:search": {
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      ports.queue(
        s,
        {
          type: "damage",
          target: "hero",
          amount: 2,
          source: p.id,
          actorId: e.playerId,
        },
        {
          type: "thwart",
          target: p.id,
          amount: 3,
          source: "hero",
          actorId: e.playerId,
        },
      );
      break;
    }
    case "spiral:sword-pay":
      ports.pay(
        s,
        2,
        ["physical", "physical"],
        [SP("sword", { id: e.id })],
        name(SPIRALS_SWORDS),
        true,
      );
      break;
    case "spiral:sword": {
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a) break;
      a.counters = Math.max(0, (a.counters || 0) - 1);
      // A card with uses is discarded with its last counter.
      if (!a.counters) ports.discardPiece(s, a.id);
      break;
    }
    case "spiral:erratic":
      if (spiralCornered(s)) {
        ports.queue(s, SP("teleport", { n: 1 }));
        break;
      }
      if (
        spiralEscaped(s) &&
        st?.showDeck.length &&
        alive(s, e.playerId) &&
        ports.canPay(s, 1, ["mental"])
      )
        ports.choose(
          s,
          name(ERRATIC_TELEPORTATION),
          "Spend a mental resource to look at the top card of the show deck?",
          [
            {
              id: "look",
              label: "Spend a mental resource · look at the show deck",
              effects: [SP("erratic-pay")],
            },
            { id: "pass", label: "Do not look", effects: [] },
          ],
        );
      break;
    case "spiral:erratic-pay":
      ports.pay(
        s,
        1,
        ["mental"],
        [SP("erratic-look")],
        name(ERRATIC_TELEPORTATION),
        true,
      );
      break;
    case "spiral:erratic-look": {
      const top = st?.showDeck[0];
      if (!top) break;
      ports.choose(
        s,
        name(ERRATIC_TELEPORTATION),
        `The top card of the show deck is ${name(top)}.`,
        [
          {
            id: "top",
            label: `Leave ${name(top)} on top`,
            image: top.code,
            effects: [],
          },
          {
            id: "bottom",
            label: `Put ${name(top)} on the bottom`,
            image: top.code,
            effects: [SP("bottom")],
          },
        ],
      );
      break;
    }
    case "spiral:bottom":
      if (st?.showDeck.length) st.showDeck.push(st.showDeck.shift()!);
      break;
    case "spiral:show-must-go-on": {
      const show = (s.environments || []).find(isShow);
      const set = show && def(show)?.set_code;
      if (!set) break;
      for (const seat of playerOrder(s).filter((q) => !q.eliminated)) {
        const found = [...s.encounter.deck, ...s.encounter.discard].find(
          (q) => def(q)?.set_code === set,
        );
        if (found) ports.dealPiece(s, found, seat.id);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "spiral:well-armed": {
      const sword = s.attachments.find(
        (q) => q.attachedTo === s.villain?.id && q.code === SPIRALS_SWORDS,
      );
      if (sword) {
        if (alive(s, e.playerId))
          ports.activate(s, {
            enemyId: s.villain.id,
            playerId: e.playerId,
            kind: "attack",
            modifier: 0,
          });
        break;
      }
      const found = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.code === SPIRALS_SWORDS,
      );
      if (found) ports.queue(s, SP("attach", { piece: found }));
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Spiral effect: ${e.type}`);
  }
  return true;
}
