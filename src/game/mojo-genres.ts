import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** MojoMania's six genre modular sets: Crime, Fantasy, Horror, Sci-Fi,
 * Sitcom and Western. Each one has a Show environment with the Setting
 * trait. */
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
export const HORROR_CODES = [
  "39047",
  "39048",
  "39049",
  "39050",
  "39051",
  "39052",
] as const;
export const SCIFI_CODES = [
  "39053",
  "39054",
  "39055",
  "39056",
  "39057",
  "39058",
  "39059",
] as const;
export const SITCOM_CODES = [
  "39060",
  "39061",
  "39062",
  "39063",
  "39064",
  "39065",
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
  ...HORROR_CODES,
  ...SCIFI_CODES,
  ...SITCOM_CODES,
  ...WESTERN_CODES,
] as const;
export const MOJO_GENRE_SETS = [
  "crime",
  "fantasy",
  "horror",
  "sci-fi",
  "sitcom",
  "western",
] as const;
/** Obligations that stay in their player's play area. */
export const MOJO_GENRE_IN_PLAY_OBLIGATIONS = [
  "39036",
  "39061",
  "39062",
  "39063",
  "39064",
  "39065",
] as const;

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
const MOJO_FILES = "39047";
const BANDOLIER = "39048";
const CULTIST = "39049";
const KRAKEN = "39050";
const VAMPIRE = "39051";
const WEREWOLF_PACK = "39052";
const MOJO_RUNNER = "39053";
const AVALANCHE = "39054";
const BLOB = "39055";
const MAGNETO_26 = "39056";
const PYRO = "39057";
const TOAD = "39058";
const ICE_TEROID = "39059";
const MOJO_MIDDLE = "39060";
const FAMILY_MATTERS = "39061";
const GROWING_PAINS = "39062";
const ODD_COUPLE = "39063";
const BREAKUP = "39064";
const WATCH_ME_PLAY = "39065";
const WILD_WILD = "39066";
const DEAD_OR_ALIVE = "39067";
const CARD_SHARK = "39068";
const GUNSLINGER = "39069";
const GAME_OF_CARDS = "39070";
const SHOWS = [
  DIAL_M,
  GAME_OF_MOJOS,
  MOJO_FILES,
  MOJO_RUNNER,
  MOJO_MIDDLE,
  WILD_WILD,
];
/** What each Show environment does while it is in play, for the table. */
export const MOJO_GENRE_SHOW_CAPTIONS: Record<string, string> = {
  [DIAL_M]:
    "Other encounter cards gain incite 1 · friendly characters get +1 THW",
  [GAME_OF_MOJOS]: "Each player gets +1 hand size",
  [MOJO_FILES]:
    "Each minion gains quickstrike · an ally takes 1 less consequential damage after attacking a minion",
  [MOJO_RUNNER]: "Each minion and ally gains toughness",
  [MOJO_MIDDLE]:
    "Each obligation gains an acceleration icon · discarding an obligation lets that player draw 1 card",
  [WILD_WILD]:
    "Enemy attacks gain overkill · each character takes 1 more damage",
};
/** The constant of each crime side scheme, for the table. */
export const MOJO_GENRE_SCHEME_CAPTIONS: Record<string, string> = {
  [CRIME_SCENE]: "Threat cannot be removed from other schemes",
  [LAW_ORDER]: "Each friendly character gets −2 ATK",
  [DRAGNET]: "The villain cannot take damage",
  [ICE_TEROID]:
    "Each minion gains guard and patrol · at the end of the round a minion engages the first player",
};
/** The constant of each obligation that stays in a player's play area. */
export const MOJO_GENRE_OBLIGATION_CAPTIONS: Record<string, string> = {
  [BUILD_CASE]: "A clue after each side scheme is defeated · discarded at 3",
  [FAMILY_MATTERS]: "Your supports have blank text boxes",
  [GROWING_PAINS]: "Your upgrades cost 2 more",
  [ODD_COUPLE]: "Your ally limit is 2 lower",
  [BREAKUP]: "Each encounter card gains peril",
  [WATCH_ME_PLAY]: "Looking up a rule in the app confuses you",
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
  /** The allies a player controls. */
  allies(s: GameState, playerId: string): Piece[];
  /** A card a player controls leaves play and goes facedown under an
   * enemy, as Werewolf Pack's ally or Toad 2.0's upgrade. */
  moveUnder(s: GameState, playerId: string, id: string, hostId: string): void;
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
  attack: { attack?: boolean; piercing?: boolean } = {},
): number {
  if (n <= 0) return n;
  const m = s.minions.find((q) => q.id === target && active(s, q));
  const resources = printedResources(source);
  if (m?.code === GOBLIN && !resources.includes("physical")) return 0;
  let amount = n;
  if (m?.code === DRAGON && resources.includes("energy")) amount *= 2;
  if (m?.code === TROLL && resources.includes("mental")) amount += 1;
  // Vampire: attacks with piercing deal double damage to it.
  if (m?.code === VAMPIRE && attack.attack && attack.piercing) amount *= 2;
  amount += shows(s, WILD_WILD);
  // Blob 3.14 cannot take more than 2 damage from each attack.
  if (m?.code === BLOB && attack.attack) amount = Math.min(amount, 2);
  return amount;
}
/** The Mojo Files gives each minion quickstrike; ICE-Teroid M gives each
 * minion guard and patrol. */
export function mojoGenreKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): boolean {
  if (!s.minions.some((m) => m.id === p.id)) return false;
  if (keyword === "Quickstrike") return shows(s, MOJO_FILES) > 0;
  if (keyword === "Guard" || keyword === "Patrol")
    return schemes(s, ICE_TEROID) > 0;
  return false;
}
/** Mojo Runner: each minion and ally gains toughness, so it enters play with
 * a tough status. */
export function mojoGenreToughOnEntry(s: GameState): boolean {
  return shows(s, MOJO_RUNNER) > 0;
}
/** The Mojo Files: an ally takes 1 less consequential damage after attacking
 * a minion, as printed. */
export function mojoGenreConsequentialReduction(
  s: GameState,
  attackedMinion: boolean,
): number {
  return attackedMinion && shows(s, MOJO_FILES) > 0 ? 1 : 0;
}
/** Mojo in the Middle: each obligation in play gains an acceleration icon. */
export function mojoGenreAcceleration(s: GameState): number {
  if (!shows(s, MOJO_MIDDLE)) return 0;
  return s.players
    .filter((seat) => !seat.eliminated)
    .reduce(
      (n, seat) =>
        n +
        seatView(s, seat).player.inPlay.filter(
          (p) => def(p)?.type_code === "obligation",
        ).length,
      0,
    );
}
const owned = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && active(s, p)).length;
/** Growing Pains: each of your upgrades costs 2 more to play. */
export function mojoGenreCostIncrease(s: GameState, c: Card): number {
  return c.type_code === "upgrade" ? 2 * owned(s, GROWING_PAINS) : 0;
}
/** The Odd Couple: your ally limit is 2 lower. */
export function mojoGenreAllyLimit(s: GameState): number {
  return -2 * owned(s, ODD_COUPLE);
}
/** The One with the Breakup: each encounter card gains peril. */
export function mojoGenrePeril(s: GameState): boolean {
  return s.players.some(
    (seat) =>
      !seat.eliminated &&
      seatView(s, seat).player.inPlay.some(
        (p) => p.code === BREAKUP && active(s, p),
      ),
  );
}
/** Watch Me Play: you look up a rule, so you are confused. */
export function mojoGenreLooksUpRule(s: GameState): boolean {
  return owned(s, WATCH_ME_PLAY) > 0;
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
  if (m.code === KRAKEN) out.push(G("kraken-heal"));
  return out;
}
/** Toad 2.0's When Defeated, read before the cards under it leave with it:
 * each returns to its owner's hand. */
export function mojoGenreToadDefeated(s: GameState, m: Piece): Effect[] {
  if (over(s) || m.code !== TOAD || !active(s, m) || !m.captured?.length)
    return [];
  return [G("toad-return", { cards: m.captured.splice(0) })];
}
/** Werewolf Pack's Forced Interrupt replaces its defeat while an ally is
 * under it. */
export function mojoGenreDefeatReplaced(s: GameState, m: Piece): Effect[] {
  if (
    m.code !== WEREWOLF_PACK ||
    !active(s, m) ||
    !s.minions.some((q) => q.id === m.id) ||
    !m.captured?.some((q) => def(q)?.type_code === "ally")
  )
    return [];
  return [G("werewolf-survive", { id: m.id })];
}
/** Forced Responses after a horror or sci-fi minion activates: Cultist and
 * Magneto 2.6 against you, The Kraken in any activation, and Vampire after
 * its attack damages a character. */
export function mojoGenreActivated(
  s: GameState,
  a: {
    enemyId: string;
    playerId: string;
    attack: boolean;
    againstPlayer: boolean;
    damagedTarget?: string;
  },
): Effect[] {
  if (over(s)) return [];
  const m = s.minions.find((q) => q.id === a.enemyId);
  if (!m || !active(s, m)) return [];
  const you = a.againstPlayer && alive(s, a.playerId);
  switch (m.code) {
    case CULTIST:
      return you ? [G("cultist", { id: m.id, playerId: a.playerId })] : [];
    case KRAKEN:
      return [G("kraken", { id: m.id })];
    case MAGNETO_26:
      return you ? [G("magneto", { id: m.id, playerId: a.playerId })] : [];
    case VAMPIRE:
      return a.attack && a.damagedTarget ? [G("vampire", { id: m.id })] : [];
    default:
      return [];
  }
}
/** Forced Responses after Avalanche 9.0 or Toad 2.0 engages you. */
export function mojoGenreEngageResponses(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (!active(s, p) || !alive(s, playerId)) return [];
  if (p.code === AVALANCHE) return [G("avalanche", { id: p.id, playerId })];
  if (p.code === TOAD) return [G("toad", { id: p.id, playerId })];
  return [];
}
/** Pyro 4.0's Forced Interrupt when it attacks you. */
export function mojoGenreAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  return m?.code === PYRO && active(s, m) && alive(s, playerId)
    ? [G("pyro", { playerId, id: m.id })]
    : [];
}
/** ICE-Teroid M's Forced Interrupt at the end of the round, after the first
 * player token is passed. */
export function mojoGenreRoundEnded(s: GameState): Effect[] {
  if (over(s)) return [];
  return s.sideSchemes
    .filter((q) => q.code === ICE_TEROID && active(s, q))
    .map(() => G("ice-teroid", { playerId: s.firstPlayerId }));
}
/** Mojo in the Middle's Response after a player discards an obligation. */
export function mojoGenreObligationDiscarded(
  s: GameState,
  playerId: string,
): Effect[] {
  if (over(s) || !alive(s, playerId)) return [];
  return Array.from({ length: shows(s, MOJO_MIDDLE) }, () =>
    G("middle-draw", { playerId }),
  );
}
/** Bandolier of Stakes' Hero Interrupt when your hero makes a basic attack. */
export function mojoGenreBasicAttackOptions(
  s: GameState,
  packet: Effect,
): Option[] {
  const b = s.attachments.find(
    (a) =>
      a.code === BANDOLIER &&
      a.attachedTo === `hero:${s.activePlayerId}` &&
      a.counters > 0 &&
      active(s, a),
  );
  if (!b) return [];
  return [
    {
      id: "stake",
      label: "Remove a stake counter · +1 ATK and piercing for this attack",
      image: b.code,
      effects: [
        G("stake", { id: b.id }),
        {
          ...packet,
          amount: Number(packet.amount || 0) + 1,
          piercing: true,
        },
      ],
    },
  ];
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
  ports: Pick<MojoGenrePorts, "canPay" | "allies" | "controlled">,
): Option[] {
  if (!known(p) || !active(s, p)) return [];
  const sitcom = sitcomActions(s, p, ports);
  if (sitcom) return sitcom;
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

const upgrade = (p: Piece) => def(p)?.type_code === "upgrade";
const permanent = (p: Piece) => /\bPermanent\b/.test(def(p)?.text || "");
/** The sitcom obligations' Alter-Ego Actions, or undefined for another
 * card. */
function sitcomActions(
  s: GameState,
  p: Piece,
  ports: Pick<MojoGenrePorts, "allies" | "controlled">,
): Option[] | undefined {
  if (
    ![
      FAMILY_MATTERS,
      GROWING_PAINS,
      ODD_COUPLE,
      BREAKUP,
      WATCH_ME_PLAY,
    ].includes(p.code)
  )
    return undefined;
  if (
    s.phase !== "player" ||
    s.player.form !== "alter" ||
    !s.player.inPlay.some((q) => q.id === p.id)
  )
    return [];
  const playerId = s.activePlayerId;
  const action = (label: string, effects: Effect[]): Option[] => [
    {
      id: "discard",
      label: `Alter-Ego Action · ${label}`,
      image: p.code,
      effects,
    },
  ];
  const discard = G("discard-obligation", { id: p.id, playerId });
  switch (p.code) {
    case FAMILY_MATTERS: {
      const supports = s.player.inPlay.filter(
        (q) => def(q)?.type_code === "support",
      );
      if (s.player.exhausted || supports.some((q) => q.exhausted)) return [];
      return action("exhaust your identity and each support · discard", [
        { type: "exhaust", id: "hero" },
        ...supports.map((q) => ({ type: "exhaust", id: q.id })),
        discard,
      ]);
    }
    case GROWING_PAINS:
      if (
        !ports.controlled(s, playerId).some(upgrade) &&
        !s.player.hand.some(upgrade)
      )
        return [];
      return action("discard an upgrade", [
        G("growing-pains", { id: p.id, playerId }),
      ]);
    case ODD_COUPLE: {
      const ready =
        Number(!s.player.exhausted) +
        ports.allies(s, playerId).filter((q) => !q.exhausted).length;
      if (ready < 2) return [];
      return action(
        "exhaust 2 characters · shuffle an ally from your discard pile into your deck · discard",
        [G("odd-couple", { id: p.id, playerId, left: 2 })],
      );
    }
    case BREAKUP:
      if (s.player.hand.length < 3) return [];
      return action("discard 3 cards · a player draws 1 card · discard", [
        G("breakup", { id: p.id, playerId, left: 3 }),
      ]);
    case WATCH_ME_PLAY:
      if (s.player.exhausted || !s.player.confused) return [];
      return action(
        "exhaust your identity and discard a confused status card · discard",
        [
          { type: "exhaust", id: "hero" },
          G("unconfuse", { playerId }),
          discard,
        ],
      );
    default:
      return [];
  }
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
  // Bandolier of Stakes is an attachment with When Revealed text: it
  // resolves once, in its reveal window's text step.
  if (p.code === BANDOLIER)
    return s.currentRevealWindowId === p.id
      ? [G("bandolier", { piece: p, playerId })]
      : [];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case WEREWOLF_PACK:
      return [G("werewolf", { id: p.id, playerId })];
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
    case AVALANCHE:
      return [G("exhaust-one", { playerId })];
    case BLOB:
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
      ];
    case PYRO:
      return [G("pyro", { playerId, id: p.id })];
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
    // ------------------------------------------------------------ horror
    case "mgen:bandolier": {
      const p = e.piece as Piece;
      if (!alive(s, e.playerId) || !ports.canPay(s, 1, [])) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.choose(
        s,
        name(BANDOLIER),
        "You may spend 1 resource of any type to attach this card to your identity. Otherwise, discard it.",
        [
          {
            id: "attach",
            label: "Spend 1 resource · attach it to your identity",
            image: p.code,
            effects: [G("bandolier-pay", { piece: p, playerId: e.playerId })],
          },
          {
            id: "pass",
            label: "Discard Bandolier of Stakes",
            effects: [{ type: "discardPiece", id: p.id }],
          },
        ],
      );
      break;
    }
    case "mgen:bandolier-pay":
      ports.pay(
        s,
        1,
        [],
        [G("bandolier-attach", { piece: e.piece, playerId: e.playerId })],
        name(BANDOLIER),
        false,
      );
      break;
    case "mgen:bandolier-attach": {
      const p = e.piece as Piece;
      ports.attach(s, p, `hero:${e.playerId}`);
      const attached = s.attachments.find((q) => q.id === p.id);
      // Uses (3 stake counters).
      if (attached) attached.counters = 3;
      break;
    }
    case "mgen:stake": {
      const b = s.attachments.find((q) => q.id === e.id);
      if (!b) break;
      b.counters = Math.max(0, b.counters - 1);
      // A card with uses is discarded once its last counter is spent.
      if (!b.counters) ports.discardPiece(s, b.id);
      break;
    }
    case "mgen:cultist": {
      const cultist = s.minions.find((q) => q.id === e.id);
      const kraken = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.code === KRAKEN,
      );
      if (kraken && alive(s, e.playerId))
        ports.putMinion(s, kraken, e.playerId);
      ports.shuffleEncounter(s);
      if (cultist) ports.discardPiece(s, cultist.id);
      break;
    }
    case "mgen:kraken": {
      const kraken = s.minions.find((q) => q.id === e.id);
      if (!kraken) break;
      // Each other character takes 1 damage: the villain, the other
      // minions, each identity and each ally.
      const hit = (target: string, actorId?: string): Effect => ({
        type: "damage",
        target,
        amount: 1,
        source: kraken.id,
        ...(actorId ? { actorId } : {}),
      });
      ports.queue(
        s,
        ...(s.villain ? [hit(s.villain.id)] : []),
        ...s.minions.filter((q) => q.id !== kraken.id).map((q) => hit(q.id)),
        ...playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .flatMap((seat) => [
            hit("hero", seat.id),
            ...ports.allies(s, seat.id).map((q) => hit(q.id, seat.id)),
          ]),
      );
      break;
    }
    case "mgen:kraken-heal":
      ports.queue(
        s,
        ...playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .flatMap((seat) => [
            { type: "heal", target: "hero", amount: 1, actorId: seat.id },
            ...ports.allies(s, seat.id).map((q) => ({
              type: "heal",
              target: q.id,
              amount: 1,
              actorId: seat.id,
            })),
          ]),
      );
      break;
    case "mgen:vampire": {
      const v = s.minions.find((q) => q.id === e.id);
      if (!v) break;
      if (v.damage > 0)
        ports.queue(s, { type: "heal", target: v.id, amount: v.damage });
      else ports.queue(s, { type: "status", target: v.id, status: "tough" });
      break;
    }
    case "mgen:werewolf": {
      const pack = s.minions.find((q) => q.id === e.id);
      const allies = alive(s, e.playerId) ? ports.allies(s, e.playerId) : [];
      if (!pack || !allies.length) break;
      ports.choose(
        s,
        name(WEREWOLF_PACK),
        "Defeat an ally you control and place it facedown under Werewolf Pack.",
        allies.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            G("werewolf-take", {
              id: pack.id,
              allyId: q.id,
              playerId: e.playerId,
            }),
          ],
        })),
      );
      break;
    }
    case "mgen:werewolf-take":
      if (s.minions.some((q) => q.id === e.id))
        ports.moveUnder(s, e.playerId, e.allyId, e.id);
      break;
    case "mgen:werewolf-survive": {
      const pack = s.minions.find((q) => q.id === e.id);
      const under = (pack?.captured || []).filter(
        (q) => def(q)?.type_code === "ally",
      );
      if (!pack || !under.length) break;
      if (under.length === 1) {
        ports.queue(
          s,
          G("werewolf-discard", { id: pack.id, allyId: under[0].id }),
        );
        break;
      }
      ports.choose(
        s,
        name(WEREWOLF_PACK),
        "Discard an ally from under Werewolf Pack instead of defeating it.",
        under.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [G("werewolf-discard", { id: pack.id, allyId: q.id })],
        })),
      );
      break;
    }
    case "mgen:werewolf-discard": {
      const pack = s.minions.find((q) => q.id === e.id);
      const i = pack?.captured?.findIndex((q) => q.id === e.allyId) ?? -1;
      if (!pack || i < 0) break;
      const [ally] = pack.captured!.splice(i, 1);
      const owner = s.players.find(
        (seat) => seat.id === ally.ownerId && !seat.eliminated,
      );
      if (owner) seatView(s, owner.id).player.discard.push(ally);
      else s.removed.push(ally);
      ports.log(
        s,
        `${name(WEREWOLF_PACK)} discards ${name(ally)} from under it instead of being defeated.`,
        "bad",
      );
      pack.damage = 0;
      break;
    }
    // ------------------------------------------------------------ sci-fi
    case "mgen:avalanche":
    case "mgen:exhaust-one": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const damage = e.type === "mgen:avalanche";
      const options: Option[] = [
        ...(!view.exhausted
          ? [
              {
                id: "hero",
                label: "Your identity",
                effects: [
                  { type: "exhaust", id: "hero", actorId: e.playerId },
                  ...(damage
                    ? [
                        {
                          type: "damage",
                          target: "hero",
                          amount: 1,
                          source: e.id,
                          actorId: e.playerId,
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
        ...ports
          .allies(s, e.playerId)
          .filter((q) => !q.exhausted)
          .map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              { type: "exhaust", id: q.id, actorId: e.playerId },
              ...(damage
                ? [{ type: "damage", target: q.id, amount: 1, source: e.id }]
                : []),
            ],
          })),
      ];
      if (options.length)
        ports.choose(
          s,
          name(AVALANCHE),
          damage
            ? "Exhaust a character you control and deal 1 damage to it."
            : "Exhaust a character you control.",
          options,
        );
      break;
    }
    case "mgen:magneto": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m) break;
      // A magnetic counter, then one discard for each counter.
      m.counters = (m.counters || 0) + 1;
      ports.queue(
        s,
        G("discard-n", {
          playerId: e.playerId,
          left: m.counters,
          title: name(MAGNETO_26),
        }),
      );
      break;
    }
    case "mgen:discard-n": {
      if (!alive(s, e.playerId) || !e.left) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length) break;
      ports.choose(
        s,
        e.title,
        `Choose and discard ${e.left} more card${e.left === 1 ? "" : "s"} from your hand.`,
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            G("hand-discard", { playerId: e.playerId, id: q.id }),
            G("discard-n", {
              playerId: e.playerId,
              left: e.left - 1,
              title: e.title,
            }),
          ],
        })),
      );
      break;
    }
    case "mgen:pyro":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, 2, e.id || PYRO, name(PYRO));
      break;
    case "mgen:toad": {
      const toad = s.minions.find((q) => q.id === e.id);
      // Placing a card under Toad 2.0 is not a discard: any upgrade that
      // can leave play qualifies.
      const upgrades = alive(s, e.playerId)
        ? seatView(s, e.playerId).player.inPlay.filter(
            (q) => upgrade(q) && !permanent(q),
          )
        : [];
      if (!toad || !upgrades.length) break;
      ports.choose(
        s,
        name(TOAD),
        "Place 1 upgrade you control facedown under Toad 2.0.",
        upgrades.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            G("toad-take", {
              id: toad.id,
              upgradeId: q.id,
              playerId: e.playerId,
            }),
          ],
        })),
      );
      break;
    }
    case "mgen:toad-take":
      if (s.minions.some((q) => q.id === e.id))
        ports.moveUnder(s, e.playerId, e.upgradeId, e.id);
      break;
    case "mgen:toad-return":
      for (const q of e.cards as Piece[]) {
        const owner = s.players.find(
          (seat) => seat.id === q.ownerId && !seat.eliminated,
        );
        if (owner) seatView(s, owner.id).player.hand.push(q);
        else s.removed.push(q);
      }
      break;
    case "mgen:ice-teroid": {
      if (!alive(s, e.playerId)) break;
      const seen = new Set<string>();
      const minions = [...s.encounter.deck, ...s.encounter.discard].filter(
        (q) => {
          if (def(q)?.type_code !== "minion" || seen.has(q.code)) return false;
          seen.add(q.code);
          return true;
        },
      );
      if (!minions.length) {
        ports.shuffleEncounter(s);
        break;
      }
      ports.choose(
        s,
        name(ICE_TEROID),
        "Search the encounter deck and discard pile for a minion and put it into play engaged with the first player.",
        minions.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [G("ice-teroid-minion", { id: q.id, playerId: e.playerId })],
        })),
      );
      break;
    }
    case "mgen:ice-teroid-minion": {
      const q = [...s.encounter.deck, ...s.encounter.discard].find(
        (x) => x.id === e.id,
      );
      if (q && alive(s, e.playerId)) ports.putMinion(s, q, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    // ------------------------------------------------------------ sitcom
    case "mgen:middle-draw":
      if (!alive(s, e.playerId)) break;
      ports.choose(
        s,
        name(MOJO_MIDDLE),
        "You discarded an obligation. You may draw 1 card.",
        [
          {
            id: "draw",
            label: "Draw 1 card",
            effects: [{ type: "draw", amount: 1, actorId: e.playerId }],
          },
          { id: "pass", label: "Do not draw", effects: [] },
        ],
      );
      break;
    case "mgen:discard-obligation":
      if (seatView(s, e.playerId).player.inPlay.some((q) => q.id === e.id))
        ports.discardPiece(s, e.id);
      break;
    case "mgen:growing-pains": {
      const view = seatView(s, e.playerId).player;
      const options: Option[] = [
        ...ports
          .controlled(s, e.playerId)
          .filter(upgrade)
          .map((q) => ({
            id: q.id,
            label: `${name(q)} · in play`,
            image: q.code,
            effects: [
              { type: "discardPiece", id: q.id },
              G("growing-check", { id: e.id, playerId: e.playerId }),
            ],
          })),
        ...view.hand.filter(upgrade).map((q) => ({
          id: q.id,
          label: `${name(q)} · from your hand`,
          image: q.code,
          effects: [
            G("hand-discard", { playerId: e.playerId, id: q.id }),
            G("growing-check", { id: e.id, playerId: e.playerId }),
          ],
        })),
      ];
      if (options.length)
        ports.choose(
          s,
          name(GROWING_PAINS),
          "Discard an upgrade you control or an upgrade from your hand.",
          options,
        );
      break;
    }
    case "mgen:growing-check": {
      const view = seatView(s, e.playerId).player;
      // More upgrades in your discard pile than in play discards it.
      if (
        view.discard.filter(upgrade).length > view.inPlay.filter(upgrade).length
      )
        ports.queue(
          s,
          G("discard-obligation", { id: e.id, playerId: e.playerId }),
        );
      break;
    }
    case "mgen:odd-couple": {
      if (!e.left) {
        ports.queue(
          s,
          G("odd-couple-ally", { id: e.id, playerId: e.playerId }),
        );
        break;
      }
      const view = seatView(s, e.playerId).player;
      const options: Option[] = [
        ...(!view.exhausted
          ? [
              {
                id: "hero",
                label: "Your identity",
                effects: [
                  { type: "exhaust", id: "hero", actorId: e.playerId },
                  G("odd-couple", {
                    id: e.id,
                    playerId: e.playerId,
                    left: e.left - 1,
                  }),
                ],
              },
            ]
          : []),
        ...ports
          .allies(s, e.playerId)
          .filter((q) => !q.exhausted)
          .map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              { type: "exhaust", id: q.id, actorId: e.playerId },
              G("odd-couple", {
                id: e.id,
                playerId: e.playerId,
                left: e.left - 1,
              }),
            ],
          })),
      ];
      if (options.length)
        ports.choose(
          s,
          name(ODD_COUPLE),
          `Exhaust a character you control (${e.left} left).`,
          options,
        );
      break;
    }
    case "mgen:odd-couple-ally": {
      const view = seatView(s, e.playerId).player;
      const allies = view.discard.filter((q) => def(q)?.type_code === "ally");
      const done = G("discard-obligation", { id: e.id, playerId: e.playerId });
      if (!allies.length) {
        ports.queue(s, done);
        break;
      }
      ports.choose(
        s,
        name(ODD_COUPLE),
        "Shuffle an ally from your discard pile into your deck.",
        allies.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [G("shuffle-in", { playerId: e.playerId, id: q.id }), done],
        })),
      );
      break;
    }
    case "mgen:shuffle-in": {
      const view = seatView(s, e.playerId).player;
      const i = view.discard.findIndex((q) => q.id === e.id);
      if (i >= 0) view.deck.push(view.discard.splice(i, 1)[0]);
      ports.shuffleDeck(s, e.playerId);
      break;
    }
    case "mgen:breakup": {
      const hand = seatView(s, e.playerId).player.hand;
      if (!e.left) {
        const seats = playerOrder(s).filter((q) => !q.eliminated);
        const finish = (playerId: string): Effect[] => [
          { type: "draw", amount: 1, actorId: playerId },
          G("discard-obligation", { id: e.id, playerId: e.playerId }),
        ];
        if (seats.length === 1) {
          ports.queue(s, ...finish(seats[0].id));
          break;
        }
        ports.choose(
          s,
          name(BREAKUP),
          "Choose a player. That player draws 1 card.",
          seats.map((seat) => ({
            id: seat.id,
            label: `${seat.heroId.replace(/_/g, " ")} draws 1 card`,
            effects: finish(seat.id),
          })),
        );
        break;
      }
      if (!hand.length) break;
      ports.choose(
        s,
        name(BREAKUP),
        `Discard ${e.left} more card${e.left === 1 ? "" : "s"} from your hand.`,
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            G("hand-discard", { playerId: e.playerId, id: q.id }),
            G("breakup", { id: e.id, playerId: e.playerId, left: e.left - 1 }),
          ],
        })),
      );
      break;
    }
    case "mgen:unconfuse": {
      // Discard one confused status card from your identity.
      const view = seatView(s, e.playerId).player;
      const cards = Number(view.confuseCards || (view.confused ? 1 : 0));
      view.confuseCards = Math.max(0, cards - 1);
      view.confused = view.confuseCards > 0;
      break;
    }
    default:
      return false;
  }
  return true;
}
