import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** MojoMania's genre modular sets: Crime, Fantasy and Western. Each one has a
 * Show environment with the Setting trait. */
export const CRIME_CODES = [
  "39035",
  "39036",
  "39037",
  "39038",
  "39039",
  "39040",
] as const;
export const FANTASY_CODES = [
  "39041",
  "39042",
  "39043",
  "39044",
  "39045",
  "39046",
] as const;
export const WESTERN_CODES = [
  "39066",
  "39067",
  "39068",
  "39069",
  "39070",
] as const;
export const MOJO_GENRE_SCRIPT_CODES = [
  ...CRIME_CODES,
  ...FANTASY_CODES,
  ...WESTERN_CODES,
] as const;
export const MOJO_GENRE_SETS = ["crime", "fantasy", "western"] as const;
/** Obligations that stay in their player's play area. */
export const MOJO_GENRE_IN_PLAY_OBLIGATIONS = ["39036"] as const;

const DIAL_M = "39035";
const BUILD_CASE = "39036";
const CRIME_SCENE = "39037";
const LAW_ORDER = "39038";
const DRAGNET = "39039";
const ELEMENTARY = "39040";
const GAME_OF_MOJOS = "39041";
const DRAGON = "39042";
const GOBLIN = "39043";
const TROLL = "39044";
const FETCH_QUEST = "39045";
const MANA_DRAIN = "39046";
const WILD_WILD = "39066";
const DEAD_OR_ALIVE = "39067";
const CARD_SHARK = "39068";
const GUNSLINGER = "39069";
const GAME_OF_CARDS = "39070";
const SHOWS = [DIAL_M, GAME_OF_MOJOS, WILD_WILD];
/** What each Show environment does while it is in play, for the table. */
export const MOJO_GENRE_SHOW_CAPTIONS: Record<string, string> = {
  [DIAL_M]:
    "Other encounter cards gain incite 1 · friendly characters get +1 THW",
  [GAME_OF_MOJOS]: "Each player gets +1 hand size",
  [WILD_WILD]:
    "Enemy attacks gain overkill · each character takes 1 more damage",
};
/** The constant of each crime side scheme, for the table. */
export const MOJO_GENRE_SCHEME_CAPTIONS: Record<string, string> = {
  [CRIME_SCENE]: "Threat cannot be removed from other schemes",
  [LAW_ORDER]: "Each friendly character gets −2 ATK",
  [DRAGNET]: "The villain cannot take damage",
};
/** The crime side schemes and the resource their Hero Action spends. */
const CRIME_ACTIONS: Record<string, "mental" | "energy" | "physical"> = {
  [CRIME_SCENE]: "mental",
  [LAW_ORDER]: "energy",
  [DRAGNET]: "physical",
};
type Resource = "energy" | "mental" | "physical";
const RESOURCES: Resource[] = ["energy", "mental", "physical"];

export interface MojoGenrePorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  putEnvironment(s: GameState, p: Piece): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  /** Discard the top cards of a player's deck and return them. */
  millPlayer(s: GameState, playerId: string, count: number): Piece[];
  discardHandCard(s: GameState, playerId: string, id: string): void;
  /** Cards a player controls in play that can be discarded. */
  controlled(s: GameState, playerId: string): Piece[];
  payResources(
    s: GameState,
    title: string,
    resources: Resource[],
    after: Effect[],
  ): void;
  /** Put an ally from the active player's discard pile into play. */
  putAllyFromDiscard(s: GameState, playerId: string, id: string): void;
  /** A card in a player's deck that they could play now, ignoring its
   * resource cost. */
  canPlayFromDeck(s: GameState, playerId: string, p: Piece): boolean;
  /** Play a card from a player's deck, ignoring its resource cost. */
  playFromDeck(
    s: GameState,
    playerId: string,
    id: string,
    after: Effect[],
  ): void;
  shuffleDeck(s: GameState, playerId: string): void;
  heroAttack(s: GameState, playerId: string): number;
  /** Reveal an encounter card. */
  reveal(s: GameState, p: Piece, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mgen:${type}`,
  ...args,
});
const scripted = new Set<string>(MOJO_GENRE_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const hasTrait = (p: Piece, trait: string) =>
  (def(p)?.traits || "").split(/\.\s*/).includes(trait);
const shows = (s: GameState, code: string) =>
  (s.environments || []).filter((p) => p.code === code && active(s, p)).length;
const schemes = (s: GameState, code: string) =>
  s.sideSchemes.filter((p) => p.code === code && active(s, p)).length;
/** The printed resource types of a card. */
export function printedResources(c?: Card): string[] {
  if (!c) return [];
  return (["energy", "mental", "physical", "wild"] as const).filter(
    (r) => Number(c[`resource_${r}` as keyof Card] || 0) > 0,
  );
}

// -------------------------------------------------------------- constants

/** Dial M for Mojo's +1 THW and Law & Order's -2 ATK for each friendly
 * character. */
export function mojoGenreGlobal(s: GameState) {
  return {
    attack: -2 * schemes(s, LAW_ORDER),
    thwart: shows(s, DIAL_M),
  };
}
/** A Game of Mojo's: each player gets +1 hand size. */
export function mojoGenreHandSize(s: GameState): number {
  return shows(s, GAME_OF_MOJOS);
}
/** Dial M for Mojo: each other encounter card gains incite 1. */
export function mojoGenreRevealIncite(s: GameState, p: Piece): Effect[] {
  if (p.code === DIAL_M || def(p)?.faction_code !== "encounter") return [];
  const n = shows(s, DIAL_M);
  return n ? [{ type: "threat", target: "main", amount: n }] : [];
}
/** Dragnet: the villain cannot take damage. Crime Scene Investigation:
 * threat cannot be removed from other schemes. */
export function mojoGenreVillainImmune(s: GameState, target: string) {
  return !!s.villain && target === s.villain.id && schemes(s, DRAGNET) > 0;
}
export function mojoGenreThwartLocked(s: GameState, target: string): boolean {
  return s.sideSchemes.some(
    (q) => q.code === CRIME_SCENE && q.id !== target && active(s, q),
  );
}
/** Wild Wild Mojo: each enemy attack gains overkill. */
export function mojoGenreOverkill(s: GameState, p: Piece): boolean {
  if (!shows(s, WILD_WILD)) return false;
  return (
    (!!s.villain && p.id === s.villain.id) ||
    s.minions.some((m) => m.id === p.id)
  );
}
/** Damage a character takes: Wild Wild Mojo adds 1, and the fantasy
 * minions read the printed resources of the card dealing it. */
export function mojoGenreDamage(
  s: GameState,
  target: string,
  n: number,
  source?: Card,
): number {
  if (n <= 0) return n;
  const m = s.minions.find((q) => q.id === target && active(s, q));
  const resources = printedResources(source);
  if (m?.code === GOBLIN && !resources.includes("physical")) return 0;
  let amount = n;
  if (m?.code === DRAGON && resources.includes("energy")) amount *= 2;
  if (m?.code === TROLL && resources.includes("mental")) amount += 1;
  return amount + shows(s, WILD_WILD);
}
/** Dead or Alive: +3 hit points per player for the attached minion. */
export function mojoGenreHealth(s: GameState, p: Piece): number {
  return (
    s.attachments.filter(
      (a) => a.code === DEAD_OR_ALIVE && a.attachedTo === p.id && active(s, a),
    ).length *
    3 *
    s.playerCount
  );
}

// -------------------------------------------------------------- responses

/** A minion with a When Defeated ability or Dead or Alive is defeated. */
export function mojoGenreMinionDefeated(
  s: GameState,
  m: Piece,
  playerId: string,
): Effect[] {
  if (over(s)) return [];
  const out: Effect[] = [];
  if (isTextBlank(s, m)) return out;
  if (m.code === DRAGON) out.push(G("dragon"));
  if (m.code === GOBLIN) out.push(G("goblin", { playerId }));
  if (m.code === TROLL && alive(s, playerId))
    out.push(G("troll", { playerId }));
  return out;
}
/** Dead or Alive's Forced Interrupt when its minion is defeated, read
 * before the minion and its attachments leave play. */
export function mojoGenreDeadOrAlive(s: GameState, m: Piece): Effect[] {
  if (over(s)) return [];
  return s.attachments
    .filter(
      (q) => q.code === DEAD_OR_ALIVE && q.attachedTo === m.id && active(s, q),
    )
    .map((a) => G("dead-or-alive", { id: a.id }));
}
/** A side scheme is defeated: Build the Case gains a clue counter. */
export function mojoGenreSchemeDefeated(s: GameState, p: Piece): Effect[] {
  const out: Effect[] = [];
  for (const seat of s.players)
    for (const q of seatView(s, seat).player.inPlay.filter(
      (x) => x.code === BUILD_CASE && active(s, x),
    ))
      out.push(G("clue", { id: q.id, playerId: seat.id }));
  if (p.code === FETCH_QUEST && active(s, p)) out.push(G("fetch"));
  return out;
}
/** Card Shark's Forced Response after it attacks you. */
export function mojoGenreAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  return m?.code === CARD_SHARK && active(s, m) && alive(s, playerId)
    ? [G("card-shark", { playerId, id: m.id })]
    : [];
}
/** Gunslinger engages you: you may spend 2 energy resources to deal it
 * damage equal to your hero's ATK. */
export function mojoGenreEngaged(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === GUNSLINGER && active(s, p) && alive(s, playerId)
    ? [G("gunslinger", { id: p.id, playerId })]
    : [];
}

// ---------------------------------------------------------------- actions

/** The crime side scheme whose Hero Action a command names. */
export function mojoGenreActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.sideSchemes.find((p) => p.id === id && !!CRIME_ACTIONS[p.code]);
}
export function mojoGenreActions(
  s: GameState,
  p: Piece,
  ports: Pick<MojoGenrePorts, "canPay">,
): Option[] {
  if (!known(p) || !active(s, p)) return [];
  const resource = CRIME_ACTIONS[p.code];
  if (
    resource &&
    s.phase === "player" &&
    s.player.form === "hero" &&
    s.sideSchemes.some((q) => q.id === p.id) &&
    p.counters > 0 &&
    ports.canPay(s, 1, [resource])
  )
    return [
      {
        id: "remove",
        label: `Hero Action · spend X ${resource} resources · remove X threat`,
        image: p.code,
        effects: [G("crime-x", { id: p.id, resource })],
      },
    ];
  return [];
}

// ----------------------------------------------------------------- reveal

export function mojoGenreReveal(
  s: GameState,
  p: Piece,
  fromEncounterDeck = true,
): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (SHOWS.includes(p.code))
    return [
      G("show", { piece: p }),
      ...(fromEncounterDeck ? [{ type: "surge", sourceCode: p.code }] : []),
    ];
  if (p.code === DEAD_OR_ALIVE)
    return [G("dead-or-alive-attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case ELEMENTARY:
      return [G("elementary", { playerId })];
    case MANA_DRAIN:
      return [G("mana-drain")];
    case GAME_OF_CARDS:
      return [G("game-of-cards", { playerId })];
    default:
      return [];
  }
}

export function mojoGenreBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case FETCH_QUEST:
      return [G("fetch-boost", { id: p.id })];
    case MANA_DRAIN:
      return [G("discard-one", { playerId })];
    default:
      return [];
  }
}

function retain(s: GameState, id: string) {
  const activation = s.attack || s.scheming;
  if (activation && !activation.retainedBoostIds?.includes(id))
    (activation.retainedBoostIds ||= []).push(id);
}

// --------------------------------------------------------------- resolver

export function resolveMojoGenreEffect(
  s: GameState,
  e: Effect,
  ports: MojoGenrePorts,
): boolean {
  if (!e.type.startsWith("mgen:")) return false;
  switch (e.type) {
    case "mgen:show": {
      const p = e.piece as Piece;
      // Discard each other Setting environment in play.
      for (const q of [...(s.environments || [])])
        if (q.id !== p.id && hasTrait(q, "Setting"))
          ports.discardPiece(s, q.id);
      ports.putEnvironment(s, p);
      break;
    }
    case "mgen:clue": {
      const q = seatView(s, e.playerId).player.inPlay.find(
        (x) => x.id === e.id,
      );
      if (!q) break;
      q.counters = (q.counters || 0) + 1;
      if (q.counters >= 3) ports.discardPiece(s, q.id);
      break;
    }
    case "mgen:crime-x": {
      // Spend X resources of the printed type: X is chosen when paying, up
      // to the threat on the scheme and what the player can pay.
      const q = s.sideSchemes.find((x) => x.id === e.id);
      if (!q) break;
      const payable = Array.from(
        { length: q.counters },
        (_, i) => i + 1,
      ).filter((x) => ports.canPay(s, x, Array(x).fill(e.resource)));
      if (!payable.length) break;
      if (payable.length === 1) {
        ports.queue(
          s,
          G("crime-pay", { id: q.id, resource: e.resource, x: 1 }),
        );
        break;
      }
      ports.choose(
        s,
        name(q),
        `Choose X: spend X ${e.resource} resources to remove X threat from this scheme.`,
        payable.map((x) => ({
          id: `x${x}`,
          label: `X = ${x} · spend ${x} ${e.resource} · remove ${x} threat`,
          image: q.code,
          effects: [G("crime-pay", { id: q.id, resource: e.resource, x })],
        })),
      );
      break;
    }
    case "mgen:crime-pay": {
      const q = s.sideSchemes.find((x) => x.id === e.id);
      if (!q) break;
      const x = Math.max(1, Number(e.x) || 1);
      ports.payResources(s, name(q), Array(x).fill(e.resource), [
        { type: "thwart", target: q.id, amount: x, source: q.id },
      ]);
      break;
    }
    case "mgen:elementary": {
      // Moving threat removes it: Crime Scene Investigation keeps threat on
      // every other scheme.
      const sides = s.sideSchemes.filter(
        (q) => q.counters > 0 && !mojoGenreThwartLocked(s, q.id),
      );
      const options: Option[] = sides.map((q) => ({
        id: q.id,
        label: `Move all threat from ${name(q)} to the main scheme`,
        image: q.code,
        effects: [G("move-all", { id: q.id })],
      }));
      options.push({
        id: "dig",
        label: "Discard encounter cards until a side scheme, and reveal it",
        effects: [G("dig-side", { playerId: e.playerId })],
      });
      ports.choose(s, name(ELEMENTARY), "Choose one.", options);
      break;
    }
    case "mgen:move-all": {
      const q = s.sideSchemes.find((x) => x.id === e.id);
      if (!q || mojoGenreThwartLocked(s, q.id)) break;
      const amount = q.counters;
      ports.queue(
        s,
        { type: "thwart", target: q.id, amount, source: "encounter" },
        { type: "threat", target: "main", amount },
      );
      break;
    }
    case "mgen:dig-side": {
      for (let n = 0; n < 60; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && def(piece)?.type_code === "side_scheme") {
          s.encounter.discard = s.encounter.discard.filter(
            (q) => q.id !== piece.id,
          );
          ports.reveal(s, piece, e.playerId);
          break;
        }
        if (!piece || emptied) break;
      }
      break;
    }
    case "mgen:dragon":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.queue(s, { type: "draw", amount: 4, actorId: seat.id });
      break;
    case "mgen:goblin": {
      // Crime Scene Investigation keeps threat on every other scheme.
      const options: Option[] = [
        ...(s.scheme.threat > 0 && !mojoGenreThwartLocked(s, "main")
          ? [
              {
                id: "main",
                label: "The main scheme",
                effects: [
                  {
                    type: "thwart",
                    target: "main",
                    amount: 2,
                    source: "encounter",
                  },
                ],
              },
            ]
          : []),
        ...s.sideSchemes
          .filter((q) => q.counters > 0 && !mojoGenreThwartLocked(s, q.id))
          .map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              { type: "thwart", target: q.id, amount: 2, source: "encounter" },
            ],
          })),
      ];
      if (options.length)
        ports.choose(
          s,
          name(GOBLIN),
          "Remove 2 threat from a scheme.",
          options,
        );
      break;
    }
    case "mgen:troll": {
      const view = seatView(s, e.playerId);
      const allies = view.player.discard.filter(
        (q) => def(q)?.type_code === "ally",
      );
      if (!allies.length) break;
      ports.choose(
        s,
        name(TROLL),
        "You may put 1 ally from your discard pile into play.",
        [
          ...allies.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              G("ally-from-discard", { playerId: e.playerId, id: q.id }),
            ],
          })),
          { id: "pass", label: "Put no ally into play", effects: [] },
        ],
      );
      break;
    }
    case "mgen:ally-from-discard":
      if (alive(s, e.playerId)) ports.putAllyFromDiscard(s, e.playerId, e.id);
      break;
    case "mgen:fetch":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.queue(s, G("fetch-one", { playerId: seat.id }));
      break;
    case "mgen:fetch-one": {
      // Search your deck for a card and play it, ignoring its resource
      // cost; one offer per printing, then shuffle.
      if (!alive(s, e.playerId)) break;
      const seen = new Set<string>();
      const offers = seatView(s, e.playerId).player.deck.filter((q) => {
        if (seen.has(q.code) || !ports.canPlayFromDeck(s, e.playerId, q))
          return false;
        seen.add(q.code);
        return true;
      });
      const shuffle = G("shuffle", {
        playerId: e.playerId,
        actorId: e.playerId,
      });
      if (!offers.length) {
        ports.shuffleDeck(s, e.playerId);
        break;
      }
      ports.choose(
        s,
        name(FETCH_QUEST),
        "You may search your deck for a card and play it, ignoring its resource cost.",
        [
          ...offers.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              G("from-deck", {
                playerId: e.playerId,
                id: q.id,
                actorId: e.playerId,
              }),
            ],
          })),
          { id: "pass", label: "Play nothing", effects: [shuffle] },
        ],
      );
      break;
    }
    case "mgen:from-deck":
      if (alive(s, e.playerId))
        ports.playFromDeck(s, e.playerId, e.id, [
          G("shuffle", { playerId: e.playerId, actorId: e.playerId }),
        ]);
      break;
    case "mgen:shuffle":
      if (alive(s, e.playerId)) ports.shuffleDeck(s, e.playerId);
      break;
    case "mgen:fetch-boost": {
      retain(s, e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.putSideScheme(s, p);
      break;
    }
    case "mgen:mana-drain":
      ports.choose(
        s,
        name(MANA_DRAIN),
        "Choose a resource type. Each player draws 2 cards, then discards each card with that printed resource.",
        RESOURCES.map((r) => ({
          id: r,
          label: r[0].toUpperCase() + r.slice(1),
          effects: [
            ...playerOrder(s)
              .filter((q) => !q.eliminated)
              .map((q) => ({ type: "draw", amount: 2, actorId: q.id })),
            G("drain", { resource: r }),
          ],
        })),
      );
      break;
    case "mgen:drain":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated)) {
        const hand = seatView(s, seat.id).player.hand.filter((q) =>
          printedResources(def(q)).includes(e.resource),
        );
        for (const q of hand) ports.discardHandCard(s, seat.id, q.id);
      }
      break;
    case "mgen:discard-one": {
      if (!alive(s, e.playerId)) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (hand.length)
        ports.choose(
          s,
          name(MANA_DRAIN),
          "Discard 1 card from your hand.",
          hand.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [G("hand-discard", { playerId: e.playerId, id: q.id })],
          })),
        );
      break;
    }
    case "mgen:hand-discard":
      if (seatView(s, e.playerId).player.hand.some((q) => q.id === e.id))
        ports.discardHandCard(s, e.playerId, e.id);
      break;
    case "mgen:dead-or-alive-attach": {
      const p = e.piece as Piece;
      const minions = s.minions;
      if (!minions.length) {
        ports.discardPiece(s, p.id);
        ports.queue(s, { type: "surge", sourceCode: p.code });
        break;
      }
      const max = Math.max(...minions.map((m) => Number(def(m)?.health || 0)));
      const top = minions.filter((m) => Number(def(m)?.health || 0) === max);
      if (top.length === 1) ports.attach(s, p, top[0].id);
      else
        ports.choose(
          s,
          name(DEAD_OR_ALIVE),
          "Choose the minion with the highest printed hit points.",
          top.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [G("attach-to", { piece: p, id: m.id })],
          })),
        );
      break;
    }
    case "mgen:attach-to":
      if (s.minions.some((m) => m.id === e.id))
        ports.attach(s, e.piece as Piece, e.id);
      else ports.discardPiece(s, (e.piece as Piece).id);
      break;
    case "mgen:dead-or-alive":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.queue(s, G("recover-one", { playerId: seat.id }));
      break;
    case "mgen:recover-one": {
      const view = seatView(s, e.playerId);
      if (!view.player.discard.length) break;
      ports.choose(
        s,
        name(DEAD_OR_ALIVE),
        "Add 1 card from your discard pile to your hand.",
        view.player.discard.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [G("to-hand", { playerId: e.playerId, id: q.id })],
        })),
      );
      break;
    }
    case "mgen:to-hand": {
      const view = seatView(s, e.playerId);
      const i = view.player.discard.findIndex((q) => q.id === e.id);
      if (i >= 0) view.player.hand.push(view.player.discard.splice(i, 1)[0]);
      break;
    }
    case "mgen:card-shark": {
      if (!alive(s, e.playerId)) break;
      const discarded = ports.millPlayer(s, e.playerId, 3);
      const types = new Set(discarded.flatMap((q) => printedResources(def(q))));
      if (types.size)
        ports.indirect(s, e.playerId, types.size, e.id, name(CARD_SHARK));
      break;
    }
    case "mgen:gunslinger": {
      const m = s.minions.find((q) => q.id === e.id);
      if (
        !m ||
        !alive(s, e.playerId) ||
        !ports.canPay(s, 2, ["energy", "energy"])
      )
        break;
      ports.choose(
        s,
        name(GUNSLINGER),
        "You may spend 2 energy resources to deal this minion damage equal to your hero's ATK.",
        [
          {
            id: "pay",
            label: "Spend 2 energy resources",
            effects: [G("gunslinger-pay", { id: m.id, playerId: e.playerId })],
          },
          { id: "pass", label: "Do not spend", effects: [] },
        ],
      );
      break;
    }
    case "mgen:gunslinger-pay":
      ports.payResources(
        s,
        name(GUNSLINGER),
        ["energy", "energy"],
        [G("gunslinger-hit", { id: e.id, playerId: e.playerId })],
      );
      break;
    case "mgen:gunslinger-hit":
      if (s.minions.some((q) => q.id === e.id))
        ports.queue(s, {
          type: "damage",
          target: e.id,
          amount: ports.heroAttack(s, e.playerId),
          source: `hero:${e.playerId}`,
          actorId: e.playerId,
        });
      break;
    case "mgen:game-of-cards":
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        { type: "draw", amount: 5, actorId: e.playerId },
        G("discard-five", { playerId: e.playerId, left: 5, types: [] }),
      );
      break;
    case "mgen:discard-five": {
      const hand = seatView(s, e.playerId).player.hand;
      const types = e.types as string[];
      if (!e.left || !hand.length) {
        if (types.length)
          ports.queue(
            s,
            G("lose-cards", { playerId: e.playerId, left: types.length }),
          );
        break;
      }
      ports.choose(
        s,
        name(GAME_OF_CARDS),
        `Choose and discard ${e.left} more card${e.left === 1 ? "" : "s"} from your hand.`,
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            G("hand-discard", { playerId: e.playerId, id: q.id }),
            G("discard-five", {
              playerId: e.playerId,
              left: e.left - 1,
              types: [...new Set([...types, ...printedResources(def(q))])],
            }),
          ],
        })),
      );
      break;
    }
    case "mgen:lose-cards": {
      const cards = ports
        .controlled(s, e.playerId)
        .filter((q) =>
          ["upgrade", "support"].includes(def(q)?.type_code || ""),
        );
      if (!e.left || !cards.length) break;
      ports.choose(
        s,
        name(GAME_OF_CARDS),
        `Discard an upgrade or support you control (${e.left} left).`,
        cards.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            { type: "discardPiece", id: q.id },
            G("lose-cards", { playerId: e.playerId, left: e.left - 1 }),
          ],
        })),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
