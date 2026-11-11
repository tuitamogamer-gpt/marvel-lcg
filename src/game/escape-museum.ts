import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

/** The Galaxy's Most Wanted: Escape the Museum (Collector). Its required
 * Galactic Artifacts and Ship Command sets and the default Menagerie Medley
 * modular set are registered by the Collector and Badoon modules. */
export const ESCAPE_SCRIPT_CODES = [
  "16080a",
  "16080b",
  "16081a",
  "16081b",
  "16082a",
  "16082b",
  "16083a",
  "16083b",
  "16084a",
  "16084b",
  "16085a",
  "16085b",
  "16086",
  "16087",
] as const;
/** Collector (A1) for Standard, Collector (B1) for Expert, and their wounded sides. */
const READY_SIDES: Record<string, string> = {
  "16080b": "16080a",
  "16081b": "16081a",
};
const WOUNDED_SIDES: Record<string, string> = {
  "16080a": "16080b",
  "16081a": "16081b",
};
export const LIBRARY_LABYRINTH = "16085a";
export const MUSEUM_SHIP = "16085b";
export const GREAT_ESCAPE = "16084b";
const MILANO = "16142";

export interface EscapeState {
  currentMain: Piece;
  /** Facedown main scheme stages still to come (2A, then 3A). */
  mainDeck: Piece[];
  /** The Ship Command set, set aside during setup. */
  setAside: Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const X = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `escape:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (ESCAPE_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);

export interface EscapePorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  giveTough(s: GameState): boolean;
  /** Indirect damage a player assigns among the characters they control. */
  indirect(s: GameState, playerId: string, amount: number, source: Piece): void;
  /** Player cards a player controls in play that can be discarded. */
  controlledCards(s: GameState, playerId: string): Piece[];
  /** The Milano anywhere in play, under any player's control. */
  milano(s: GameState): Piece | undefined;
  endGame(s: GameState, won: boolean, reason: string): void;
  heroName(s: GameState, playerId: string): string;
}

export function escapeActive(s: GameState) {
  return !!s.escape;
}
/** Collector's wounded side: he cannot be defeated until the round ends. */
export function escapeWounded(s: GameState) {
  return !!s.escape && !!READY_SIDES[s.villain.code];
}
/** The main scheme's current stage number: 1, 2 or 3. */
export function escapeStage(s: GameState) {
  return s.escape ? s.scheme.index + 1 : 0;
}
/** Collector (A1/B1) gets +X SCH and +X ATK, X the main scheme's stage. */
export function escapeVillainStat(s: GameState, p: Piece) {
  return s.escape &&
    p.id === s.villain.id &&
    WOUNDED_SIDES[p.code] &&
    !isTextBlank(s, p)
    ? escapeStage(s)
    : 0;
}

/** Replace a villain defeat. "wound": Collector flips and removes threat;
 * "immune": the wounded side cannot be defeated; "defeated": a blank side. */
export function escapeVillainWouldBeDefeated(
  s: GameState,
): "wound" | "immune" | "defeated" | null {
  if (!s.escape) return null;
  const blank = isTextBlank(s, s.villain);
  if (WOUNDED_SIDES[s.villain.code]) {
    if (blank) return "defeated";
    // Forced Interrupt: remove 3 threat per player from the main scheme and
    // flip this card instead of being defeated.
    s.villain.code = WOUNDED_SIDES[s.villain.code];
    s.villain.hp = 0;
    return "wound";
  }
  if (READY_SIDES[s.villain.code]) {
    if (blank) return "defeated";
    s.villain.hp = Math.max(0, s.villain.hp);
    return "immune";
  }
  return null;
}
export function escapeWoundEffects(s: GameState): Effect[] {
  return [X("wound-threat", { amount: 3 * s.playerCount, id: s.villain.id })];
}

/** Wounded Collector: when the round ends, flip back and restore printed HP. */
export function escapeRoundEnded(s: GameState) {
  if (!s.escape) return;
  const ready = READY_SIDES[s.villain.code];
  if (!ready || isTextBlank(s, s.villain)) return;
  s.villain.code = ready;
  const hp = (definitions.get(ready)?.health || 0) * s.playerCount;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
  s.villain.damage = 0;
}

/** When Revealed abilities of the next main scheme stage's A side. */
export function escapeMainRevealed(s: GameState, p: Piece): Effect[] {
  if (p.code === "16083a") return [X("milano")];
  if (p.code === "16084a") return [X("great-escape")];
  return [];
}

export function escapeReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "16086":
      return [
        X("have-you", {
          playerId: s.activePlayerId,
          hero: s.player.form === "hero",
        }),
      ];
    case "16087":
      return [X("geometry", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

export function escapeBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  return p.code === "16086" ? [X("tough")] : [];
}

/** Museum Ship's Forced Interrupt when the villain phase begins. */
export function escapeVillainPhaseInterrupts(s: GameState): Effect[] {
  return (s.environments || [])
    .filter((p) => p.code === MUSEUM_SHIP && !isTextBlank(s, p))
    .map((p) => X("museum-ship", { id: p.id, actorId: s.firstPlayerId }));
}

/** Library Labyrinth's once-per-round Hero Action. */
export function escapeActions(s: GameState, p: Piece): Option[] {
  if (
    !s.escape ||
    p.code !== LIBRARY_LABYRINTH ||
    !(s.environments || []).some((q) => q.id === p.id) ||
    isTextBlank(s, p) ||
    s.player.form !== "hero" ||
    s.phase !== "player" ||
    s.flags[`escapeLabyrinth:${s.activePlayerId}`] === s.round
  )
    return [];
  return [
    {
      id: "labyrinth",
      label:
        "Hero Action · deal yourself 1 facedown encounter card · remove 5 threat from the main scheme",
      image: p.code,
      effects: [X("labyrinth", { id: p.id, playerId: s.activePlayerId })],
    },
  ];
}
export function escapeActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return (s.environments || []).find(
    (p) => p.id === id && p.code === LIBRARY_LABYRINTH,
  );
}

function assignIndirect(
  s: GameState,
  ports: EscapePorts,
  remaining: number,
  assigned: Record<string, number>,
  sourceId: string,
) {
  const seats = playerOrder(s).filter((seat) => alive(s, seat.id));
  if (!seats.length) return;
  if (remaining <= 0 || seats.length === 1) {
    if (seats.length === 1 && remaining > 0)
      assigned[seats[0].id] = (assigned[seats[0].id] || 0) + remaining;
    ports.queue(
      s,
      ...seats
        .filter((seat) => assigned[seat.id] > 0)
        .map((seat) =>
          X("indirect", {
            playerId: seat.id,
            amount: assigned[seat.id],
            sourceId,
          }),
        ),
    );
    return;
  }
  const hero = (id: string) => ports.heroName(s, id);
  ports.choose(
    s,
    "Museum Ship",
    `Assign ${remaining} more indirect damage among players.`,
    seats.flatMap((seat) => [
      {
        id: `one:${seat.id}`,
        label: `1 to ${hero(seat.id)}`,
        effects: [
          X("assign", {
            remaining: remaining - 1,
            assigned: { ...assigned, [seat.id]: (assigned[seat.id] || 0) + 1 },
            sourceId,
          }),
        ],
      },
      {
        id: `all:${seat.id}`,
        label: `All ${remaining} to ${hero(seat.id)}`,
        effects: [
          X("assign", {
            remaining: 0,
            assigned: {
              ...assigned,
              [seat.id]: (assigned[seat.id] || 0) + remaining,
            },
            sourceId,
          }),
        ],
      },
    ]),
  );
}

export function resolveEscapeEffect(
  s: GameState,
  e: Effect,
  ports: EscapePorts,
): boolean {
  if (!e.type.startsWith("escape:")) return false;
  const milano = ports.milano(s);
  const milanoReady = !!milano && !milano.exhausted && !isTextBlank(s, milano);
  switch (e.type) {
    case "escape:wound-threat":
      ports.queue(s, {
        type: "thwart",
        target: "main",
        amount: e.amount,
        source: e.id,
      });
      break;
    case "escape:main-back": {
      if (!s.escape) break;
      const main = s.escape.currentMain;
      const back = definitions.get(main.code)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = definitions.get(main.code);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      break;
    }
    case "escape:milano": {
      if (!s.escape) break;
      const i = s.escape.setAside.findIndex((p) => p.code === MILANO);
      if (i < 0) break;
      const [p] = s.escape.setAside.splice(i, 1);
      delete p.ownerId;
      const first =
        s.players.find(
          (seat) => seat.id === s.firstPlayerId && !seat.eliminated,
        ) || playerOrder(s).find((seat) => alive(s, seat.id));
      if (first) seatView(s, first).player.inPlay.push(p);
      break;
    }
    case "escape:great-escape": {
      if (!s.escape) break;
      for (const p of s.environments || [])
        if (p.code === LIBRARY_LABYRINTH) p.code = MUSEUM_SHIP;
      s.encounter.acceleration++;
      const rest = s.escape.setAside.splice(0);
      for (const p of rest) s.encounter.deck.push(p);
      if (rest.length) ports.shuffleEncounter(s);
      break;
    }
    case "escape:labyrinth": {
      const p = (s.environments || []).find((q) => q.id === e.id);
      if (!p || p.code !== LIBRARY_LABYRINTH || !alive(s, e.playerId))
        throw Error("Library Labyrinth is no longer in play.");
      if (s.flags[`escapeLabyrinth:${e.playerId}`] === s.round)
        throw Error("Library Labyrinth is limited to once per round.");
      s.flags[`escapeLabyrinth:${e.playerId}`] = s.round;
      ports.dealEncounter(s, e.playerId);
      ports.queue(s, {
        type: "thwart",
        target: "main",
        amount: 5,
        source: p.id,
      });
      break;
    }
    case "escape:museum-ship": {
      const ship = (s.environments || []).find((q) => q.id === e.id);
      if (!ship || isTextBlank(s, ship)) break;
      const options: Option[] = [];
      if (milanoReady)
        options.push({
          id: "milano",
          label: `Exhaust the Milano · assign ${2 * s.playerCount} indirect damage among players`,
          image: MILANO,
          effects: [
            X("exhaust-milano"),
            X("assign", {
              remaining: 2 * s.playerCount,
              assigned: {},
              sourceId: ship.id,
            }),
          ],
        });
      options.push({
        id: "damage",
        label: `Assign ${3 * s.playerCount} indirect damage among players`,
        effects: [
          X("assign", {
            remaining: 3 * s.playerCount,
            assigned: {},
            sourceId: ship.id,
          }),
        ],
      });
      ports.choose(s, "Museum Ship", "Hold on to your butts!", options);
      break;
    }
    case "escape:exhaust-milano":
      if (milanoReady) milano!.exhausted = true;
      break;
    case "escape:assign":
      assignIndirect(s, ports, e.remaining, e.assigned || {}, e.sourceId);
      break;
    case "escape:indirect": {
      if (!alive(s, e.playerId) || e.amount <= 0) break;
      const source = (s.environments || []).find(
        (q) => q.id === e.sourceId,
      ) || {
        id: e.sourceId,
        code: MUSEUM_SHIP,
      };
      ports.indirect(s, e.playerId, e.amount, source as Piece);
      break;
    }
    case "escape:have-you": {
      if (!alive(s, e.playerId)) break;
      if (e.hero)
        ports.queue(
          s,
          {
            type: "status",
            target: `hero:${e.playerId}`,
            status: "stunned",
            actorId: e.playerId,
          },
          X("activate", { playerId: e.playerId, kind: "attack" }),
        );
      else {
        seatView(s, e.playerId).player.exhausted = true;
        ports.queue(s, X("activate", { playerId: e.playerId, kind: "scheme" }));
      }
      break;
    }
    case "escape:activate":
      if (alive(s, e.playerId))
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: 0,
        });
      break;
    case "escape:tough":
      ports.giveTough(s);
      break;
    case "escape:geometry": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      if (!view.player.confused) {
        ports.queue(s, {
          type: "status",
          target: `hero:${e.playerId}`,
          status: "confused",
          actorId: e.playerId,
        });
        break;
      }
      const cards = ports.controlledCards(s, e.playerId);
      if (!cards.length) break;
      ports.choose(
        s,
        "Impossible Geometry",
        "You are already confused. Choose and discard 1 card you control.",
        cards.map((p) => ({
          id: p.id,
          label: `Discard ${name(p)}`,
          image: p.code,
          effects: [{ type: "discardPiece", id: p.id, actorId: e.playerId }],
        })),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}

/** When the last threat is removed from stage 1 or 2, advance; with no
 * threat on The Great Escape the players win. Returns the advanced stage. */
export function escapeLastThreatRemoved(
  s: GameState,
  ports: Pick<EscapePorts, "endGame">,
): Piece | "won" | null {
  if (
    !s.escape ||
    ["won", "lost"].includes(s.phase) ||
    s.pendingMainCompletion ||
    s.scheme.threat > 0 ||
    isTextBlank(s, s.escape.currentMain)
  )
    return null;
  if (s.escape.currentMain.code === GREAT_ESCAPE) {
    ports.endGame(
      s,
      true,
      "There is no threat on The Great Escape. The Milano escapes the museum.",
    );
    return "won";
  }
  if (!["16082b", "16083b"].includes(s.escape.currentMain.code)) return null;
  const next = s.escape.mainDeck.shift();
  return next || null;
}
