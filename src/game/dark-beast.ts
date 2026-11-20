import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Age of Apocalypse's fourth scenario, Dark Beast: the traitor drags the
 * heroes through time, and each of his stages brings in one of the Savage
 * Land, Genosha and Blue Area of the Moon sets with its Setting
 * environment, whose "Special" ability his attacks and many encounter cards
 * resolve. The three sets join any scenario with modular sets, their
 * Setting starting in play. */

export const DARK_BEAST_SCRIPT_CODES = [
  "45118",
  "45119",
  "45120",
  "45121a",
  "45121b",
  "45122",
  "45123",
  "45124",
  "45125",
  "45126",
] as const;
export const SAVAGE_LAND_CODES = [
  "45127",
  "45128",
  "45129",
  "45130",
  "45131",
  "45132",
] as const;
export const GENOSHA_CODES = [
  "45133",
  "45134",
  "45135",
  "45136",
  "45137",
  "45138",
] as const;
export const BLUE_MOON_CODES = [
  "45139",
  "45140",
  "45141",
  "45142",
  "45143",
  "45144",
  "45145",
  "45146",
] as const;
/** The Savage Land, Genosha and Blue Moon sets join any scenario with
 * modular sets; Dark Beast always uses all three, set aside. */
export const DARK_BEAST_MODULAR_SETS = [
  "savage_land",
  "genosha",
  "blue_moon",
] as const;

/** Dark Beast (I) to (III). */
const STAGES = ["45118", "45119", "45120"];
export const BOGUS_JOURNEY = "45121b";
const GOGGLES = "45122";
const ENHANCEMENT = "45123";
const CRUEL_EXPERIMENT = "45124";
const EVIL_GENIUS = "45125";
const SHENANIGANS = "45126";
export const SAVAGE_LAND = "45127";
const PTEROSAUR = "45128";
const VELOCIRAPTOR = "45129";
const GIANT_APE = "45130";
const LAND_OUT_OF_TIME = "45131";
const VILLAGE = "45132";
export const GENOSHA = "45133";
const MAGISTRATE = "45134";
const UNIBIKE = "45135";
const MECH = "45136";
export const ESCAPED_MUTANT = "45137";
const POLICE_STATE = "45138";
export const BLUE_AREA = "45139";
const GLADIATOR = "45140";
const ORACLE = "45141";
const MANTA = "45142";
const EARTHQUAKE = "45143";
const WARSTAR = "45144";
const GUARDSMAN = "45145";
const TRIAL_BY_COMBAT = "45146";
/** The three Setting environments with a "Special" ability. */
const SETTINGS = [SAVAGE_LAND, GENOSHA, BLUE_AREA];
const SETTING_OF: Record<string, string> = {
  savage_land: SAVAGE_LAND,
  genosha: GENOSHA,
  blue_moon: BLUE_AREA,
};
const ALL_CODES: readonly string[] = [
  ...DARK_BEAST_SCRIPT_CODES,
  ...SAVAGE_LAND_CODES,
  ...GENOSHA_CODES,
  ...BLUE_MOON_CODES,
];

export interface DarkBeastState {
  /** The set-aside Savage Land, Genosha and Blue Moon sets. */
  setAside: { set: string; pieces: Piece[] }[];
}

export interface DarkBeastPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  pick(s: GameState, n: number): number;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** Reveal an encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  /** Discard the top cards of the player's deck and return them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  /** Deal a specific encounter card to the player, facedown. */
  dealFacedown(s: GameState, p: Piece, playerId: string): void;
  /** Exhaust the player's identity; false when it was already exhausted. */
  exhaustIdentity(s: GameState, playerId: string): boolean;
  /** Attach a card to the player's identity. */
  attachToIdentity(s: GameState, p: Piece, playerId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
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
const D = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `db:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const darkBeast = (s: GameState) => !!s.darkBeast;
const darkBeastInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code);
/** The Setting environment in play with a "Special" ability. */
export const darkBeastSetting = (s: GameState) =>
  (s.environments || []).find((p) => SETTINGS.includes(p.code) && active(s, p));
const settingIs = (s: GameState, code: string) =>
  darkBeastSetting(s)?.code === code;
const isMinion = (s: GameState, p: Piece) =>
  s.minions.some((m) => m.id === p.id);
const attachedTo = (s: GameState, code: string, id: string) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === id && active(s, a),
  );
/** The player with Escaped Mutant attached to their identity, if any. */
export function escapedMutantHolder(s: GameState): string | undefined {
  const a = s.attachments.find(
    (q) =>
      q.code === ESCAPED_MUTANT &&
      q.attachedTo?.startsWith("hero:") &&
      active(s, q),
  );
  const holder = a?.attachedTo?.slice(5);
  return holder && alive(s, holder) ? holder : undefined;
}

// ------------------------------------------------------------- interface

/** Each Setting's constant ability and Special, for its caption. */
export const DARK_BEAST_SETTING_CAPTIONS: Record<string, string> = {
  [SAVAGE_LAND]: "The villain gains retaliate 1 · Special: discard your top 3",
  [GENOSHA]: "The villain gains steady · Special: 1 threat on the main scheme",
  [BLUE_AREA]: "Each minion gains guard · Special: 1 damage to your identity",
};
const SETTING_LABELS: Record<string, string> = {
  [SAVAGE_LAND]: "SAVAGE LAND",
  [GENOSHA]: "GENOSHA",
  [BLUE_AREA]: "BLUE MOON",
};
const SPECIALS: Record<string, string> = {
  [SAVAGE_LAND]: "you discard your top 3 cards",
  [GENOSHA]: "1 threat on the main scheme",
  [BLUE_AREA]: "1 damage to your identity",
};
/** The Setting in play, for the villain label. */
export const darkBeastSettingLabel = (s: GameState) =>
  SETTING_LABELS[darkBeastSetting(s)?.code || ""] || "NO SETTING";
/** The line under Dark Beast's stats. */
export function darkBeastCaption(s: GameState): string {
  const setting = darkBeastSetting(s);
  return setting
    ? `When he attacks you, the Special: ${SPECIALS[setting.code]}`
    : "No Setting in play: his Special does nothing";
}

// --------------------------------------------------------------- setup

/** Dark Beast's Bogus Journey (1A): the three sets are set aside with their
 * Setting environments. */
export function darkBeastSetup(s: GameState) {
  const setAside: DarkBeastState["setAside"] = [];
  for (const set of DARK_BEAST_MODULAR_SETS) {
    const pieces = s.encounter.deck.filter((p) => def(p)?.set_code === set);
    s.encounter.deck = s.encounter.deck.filter((p) => !pieces.includes(p));
    setAside.push({ set, pieces });
  }
  s.darkBeast = { setAside };
  s.scheme.threat = (def(BOGUS_JOURNEY)?.base_threat || 0) * s.playerCount;
}
/** Setup: a Setting in the encounter deck begins the game in play (in other
 * scenarios; a set-aside set keeps its Setting). Expert Dark Beast: High-Tech
 * Goggles attaches to Dark Beast. */
export function darkBeastSetupEffects(s: GameState): Effect[] {
  return [
    ...(s.encounter.deck.some((p) => SETTINGS.includes(p.code))
      ? [D("settings")]
      : []),
    ...(s.darkBeast && s.difficulty === "expert" ? [D("goggles")] : []),
  ];
}
/** The set-aside cards, for physical audits. */
export const darkBeastSetAside = (s: GameState) =>
  s.darkBeast?.setAside.flatMap((g) => g.pieces) || [];

// ------------------------------------------------------------ modifiers

/** The Savage Land: the villain gains retaliate 1. Blue Area of the Moon:
 * each minion gains guard. Cruel Experiment: guard. Escaped Mutant: each
 * Genosha minion that engages its holder gains quickstrike. */
export function darkBeastKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword === "Retaliate" && s.villain && p.id === s.villain.id)
    return settingIs(s, SAVAGE_LAND) ? 1 : 0;
  if (!isMinion(s, p)) return 0;
  if (keyword === "Guard")
    return settingIs(s, BLUE_AREA) ||
      attachedTo(s, CRUEL_EXPERIMENT, p.id).length
      ? 1
      : 0;
  if (keyword === "Quickstrike" && traits(p).includes("Genosha")) {
    const holder = escapedMutantHolder(s);
    return holder && p.engagedWith === holder ? 1 : 0;
  }
  return 0;
}
/** Genosha: the villain gains steady. */
export const darkBeastSteady = (s: GameState, p: Piece) =>
  !!s.villain && p.id === s.villain.id && settingIs(s, GENOSHA);
/** Cruel Experiment: +2 hit points. Imperial Guardsman: +4. */
export function darkBeastHealth(s: GameState, p: Piece): number {
  return (
    2 * attachedTo(s, CRUEL_EXPERIMENT, p.id).length +
    4 * attachedTo(s, GUARDSMAN, p.id).length
  );
}
/** Imperial Guardsman: the attached minion gains the Imperial Guard trait. */
export const darkBeastTrait = (s: GameState, id: string, trait: string) =>
  trait === "Imperial Guard" && attachedTo(s, GUARDSMAN, id).length > 0;
/** Gladiator cannot take damage while Trial by Combat is in play. */
export function darkBeastImmune(s: GameState, target: string) {
  const m = s.minions.find((q) => q.id === target);
  return (
    !!m &&
    m.code === GLADIATOR &&
    active(s, m) &&
    s.sideSchemes.some((q) => q.code === TRIAL_BY_COMBAT && active(s, q))
  );
}

// ------------------------------------------------------------- villain

/** Dark Beast's When Revealed: a random set-aside environment is revealed
 * and the rest of its set shuffled into the encounter deck; (II) and (III)
 * also deal each player an encounter card. */
export function darkBeastVillainRevealed(s: GameState): Effect[] {
  if (!s.darkBeast || !darkBeastInPlay(s) || !active(s, s.villain)) return [];
  return [
    D("environment", { actorId: s.firstPlayerId }),
    ...(s.villain.code === STAGES[0]
      ? []
      : playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .map((seat) => D("deal", { playerId: seat.id }))),
  ];
}
/** Dark Beast's Forced Interrupt when he attacks you: the Setting's
 * "Special" ability, for you. */
export function darkBeastAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  if (
    !darkBeastInPlay(s) ||
    s.villain.id !== attackerId ||
    !active(s, s.villain) ||
    !alive(s, playerId)
  )
    return [];
  return [D("special", { playerId })];
}

// ----------------------------------------------------------------- reveals

export function darkBeastReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (p.code === GOGGLES || p.code === ENHANCEMENT)
    return resolving ? [D("attach", { piece: p })] : [];
  if (p.code === GUARDSMAN)
    return resolving ? [D("guardsman", { piece: p, id: p.id })] : [];
  if (p.code === ESCAPED_MUTANT)
    return resolving ? [D("mutant-attach", { piece: p, playerId })] : [];
  if (p.code === CRUEL_EXPERIMENT)
    return resolving && active(s, p)
      ? [D("cruel", { id: p.id, playerId })]
      : resolving
        ? [{ type: "discardPiece", id: p.id }]
        : [];
  if (SETTINGS.includes(p.code)) return [D("setting", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case EVIL_GENIUS:
      return [D("evil-genius", { playerId })];
    case PTEROSAUR:
      return [D("special", { playerId })];
    case LAND_OUT_OF_TIME:
      return [D("land-out-of-time", { id: p.id, playerId })];
    case ORACLE:
    case MANTA:
    case EARTHQUAKE:
      return [D("imperial", { code: p.code, playerId })];
    case WARSTAR:
      return [D("warstar", { playerId })];
    default:
      return [];
  }
}

export function darkBeastBoost(s: GameState, p: Piece): Effect[] | null {
  if (![GOGGLES, ENHANCEMENT, PTEROSAUR, GLADIATOR].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case GOGGLES:
    case ENHANCEMENT:
      return darkBeastInPlay(s) ? [D("attach-boost", { id: p.id })] : [];
    case PTEROSAUR:
      // If The Savage Land is in play, deal it to yourself facedown.
      return (s.environments || []).some(
        (q) => q.code === SAVAGE_LAND && active(s, q),
      )
        ? [D("facedown", { id: p.id, playerId })]
        : [];
    case GLADIATOR:
      // If Trial by Combat is in play, deal it to yourself facedown.
      return s.sideSchemes.some(
        (q) => q.code === TRIAL_BY_COMBAT && active(s, q),
      )
        ? [D("facedown", { id: p.id, playerId })]
        : [];
    default:
      return [];
  }
}
/** Evil Genius: an additional boost card for Dark Beast's attack. */
export function darkBeastAdditionalBoosts(s: GameState): number {
  const n = Number(s.flags.darkBeastExtraBoost || 0);
  delete s.flags.darkBeastExtraBoost;
  return n;
}
/** Magistrate's boost: three more boost icons while Escaped Mutant is
 * attached to your identity. */
export function darkBeastBoostIcons(s: GameState, p: Piece): number {
  if (p.code !== MAGISTRATE || !active(s, p)) return 0;
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  return escapedMutantHolder(s) === playerId ? 3 : 0;
}

// ----------------------------------------------------------------- windows

/** Velociraptor's Forced Interrupt when it attacks you: the top card of
 * your deck is discarded, +1 ATK for each resource icon on it. */
export function darkBeastMinionAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  if (!m || !active(s, m) || !alive(s, playerId)) return [];
  return m.code === VELOCIRAPTOR ? [D("velociraptor", { playerId })] : [];
}
/** After an enemy attacks: Armored Unibike's "Special"; Genoshan Mech's two
 * after it defeats one of your allies. */
export function darkBeastAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
  defeatedAlly: boolean,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  if (!m || !active(s, m) || !alive(s, playerId)) return [];
  if (m.code === UNIBIKE) return [D("special", { playerId })];
  if (m.code === MECH && defeatedAlly)
    return [D("special", { playerId }), D("special", { playerId })];
  return [];
}
/** Teamwork (Imperial Guard): the entrant activates if another Imperial
 * Guard minion is in play. Armored Unibike engages the Escaped Mutant's
 * holder. */
export function darkBeastEngaged(s: GameState, p: Piece): Effect[] {
  if (!active(s, p)) return [];
  if (p.code === UNIBIKE) {
    const holder = escapedMutantHolder(s);
    if (holder && p.engagedWith !== holder)
      return [D("unibike", { id: p.id, playerId: holder })];
  }
  return traits(p).includes("Imperial Guard") &&
    [GLADIATOR, ORACLE, MANTA, EARTHQUAKE, WARSTAR].includes(p.code)
    ? [D("teamwork", { id: p.id })]
    : [];
}
/** When Defeated: Giant Ape and Magistrate; Imperial Guardsman's Forced
 * Interrupt. Read before the minion and its attachments leave play. */
export function darkBeastMinionDefeating(
  s: GameState,
  m: Piece,
  playerId: string,
): Effect[] {
  const out: Effect[] = [];
  if (active(s, m) && alive(s, playerId)) {
    if (m.code === GIANT_APE) out.push(D("special", { playerId }));
    if (m.code === MAGISTRATE) out.push(D("escaped-mutant", { playerId }));
  }
  for (const a of attachedTo(s, GUARDSMAN, m.id))
    if (alive(s, playerId)) out.push(D("special", { playerId, source: a.id }));
  return out;
}
/** When Defeated: Time-Travel Shenanigans, Village Under Attack, Police
 * State and Trial by Combat. */
export function darkBeastSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (!active(s, p)) return [];
  switch (p.code) {
    case SHENANIGANS:
      return alive(s, playerId) ? [D("shenanigans", { playerId })] : [];
    case VILLAGE:
      return playerOrder(s)
        .filter((seat) => !seat.eliminated)
        .map((seat) => D("special", { playerId: seat.id }));
    case POLICE_STATE:
      return alive(s, playerId)
        ? [D("escaped-mutant", { playerId, reveal: true })]
        : [];
    case TRIAL_BY_COMBAT:
      return [D("trial")];
    default:
      return [];
  }
}

// ----------------------------------------------------------------- actions

/** The card whose action a command names. */
export function darkBeastActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.attachments.find(
    (p) =>
      p.id === id && [GOGGLES, ENHANCEMENT, ESCAPED_MUTANT].includes(p.code),
  );
}
/** High-Tech Goggles and Genetic Enhancement: Hero Action, exhaust your hero
 * and resolve the Setting's "Special" ability, then discard the card.
 * Escaped Mutant: Alter-Ego Action, the same without exhausting. */
export function darkBeastActions(s: GameState, p: Piece): Option[] {
  if (s.phase !== "player" || !active(s, p)) return [];
  const playerId = s.activePlayerId;
  if (
    (p.code === GOGGLES || p.code === ENHANCEMENT) &&
    darkBeastInPlay(s) &&
    p.attachedTo === s.villain.id &&
    s.player.form === "hero" &&
    !s.player.exhausted
  )
    return [
      {
        id: "special",
        label: `Hero Action · exhaust your hero · Special · discard ${name(p)}`,
        image: p.code,
        effects: [D("hero-action", { id: p.id, playerId })],
      },
    ];
  if (
    p.code === ESCAPED_MUTANT &&
    p.attachedTo === `hero:${playerId}` &&
    s.player.form === "alter"
  )
    return [
      {
        id: "special",
        label: "Alter-Ego Action · Special · discard Escaped Mutant",
        image: p.code,
        effects: [D("mutant-action", { id: p.id, playerId })],
      },
    ];
  return [];
}

// ---------------------------------------------------------------- resolver

const resourceIcons = (p: Piece) => {
  const c = def(p);
  return (
    Number(c?.resource_energy || 0) +
    Number(c?.resource_mental || 0) +
    Number(c?.resource_physical || 0) +
    Number(c?.resource_wild || 0)
  );
};

export function resolveDarkBeastEffect(
  s: GameState,
  e: Effect,
  ports: DarkBeastPorts,
): boolean {
  if (!e.type.startsWith("db:")) return false;
  const st = s.darkBeast;
  switch (e.type) {
    case "db:environment": {
      // A random set-aside environment is revealed and the rest of its set
      // shuffled into the encounter deck.
      if (!st || !st.setAside.length) break;
      const group = st.setAside.splice(ports.pick(s, st.setAside.length), 1)[0];
      const setting = group.pieces.find(
        (p) => p.code === SETTING_OF[group.set],
      );
      const rest = group.pieces.filter((p) => p !== setting);
      s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, ...rest]);
      delete s.encounter.knownTop;
      if (setting)
        ports.reveal(s, setting, String(e.actorId || s.firstPlayerId));
      break;
    }
    case "db:deal":
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      break;
    case "db:setting": {
      // When Revealed: discard each other Setting environment in play.
      const p = e.piece as Piece;
      for (const q of [...(s.environments || [])])
        if (q.id !== p.id && traits(q).includes("Setting"))
          ports.discardPiece(s, q.id);
      if (!(s.environments || []).some((q) => q.id === p.id))
        ports.putEnvironment(s, p);
      break;
    }
    case "db:mutant-attach": {
      // Escaped Mutant attaches to the revealing player's identity.
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attachToIdentity(s, p, e.playerId);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "db:special": {
      // The Setting's "Special" ability, for this player.
      const setting = darkBeastSetting(s);
      if (!setting || !alive(s, e.playerId)) break;
      if (setting.code === SAVAGE_LAND) {
        const milled = ports.mill(s, e.playerId, 3);
        if (e.indirect) {
          const n = milled.reduce((sum, p) => sum + resourceIcons(p), 0);
          if (n > 0)
            ports.indirect(
              s,
              e.playerId,
              n,
              String(e.source || setting.id),
              name(LAND_OUT_OF_TIME),
            );
        }
      } else if (setting.code === GENOSHA)
        ports.queue(s, { type: "threat", target: "main", amount: 1 });
      else if (setting.code === BLUE_AREA)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 1,
          source: setting.id,
          actorId: e.playerId,
        });
      break;
    }
    case "db:settings":
      // Setup: each Setting in the encounter deck begins the game in play.
      for (const p of s.encounter.deck.filter((q) =>
        SETTINGS.includes(q.code),
      )) {
        s.encounter.deck = s.encounter.deck.filter((q) => q.id !== p.id);
        delete s.encounter.knownTop;
        ports.putEnvironment(s, p);
      }
      break;
    case "db:goggles": {
      // Expert: High-Tech Goggles attaches to Dark Beast.
      if (!darkBeastInPlay(s)) break;
      const i = s.encounter.deck.findIndex((p) => p.code === GOGGLES);
      if (i < 0) break;
      const [p] = s.encounter.deck.splice(i, 1);
      delete s.encounter.knownTop;
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "db:attach": {
      const p = e.piece as Piece;
      if (darkBeastInPlay(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "db:attach-boost": {
      // A boost attaches to Dark Beast; the activation keeps it.
      const activation = s.scheming || s.attack;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p || !activation || !darkBeastInPlay(s)) break;
      if (!activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "db:guardsman": {
      // Imperial Guardsman: attach to a minion, otherwise surge.
      const p = e.piece as Piece;
      if (!s.minions.length) {
        ports.queue(s, {
          type: "surge",
          sourceCode: GUARDSMAN,
          sourceId: e.id,
        });
        ports.discardPiece(s, e.id);
        break;
      }
      if (s.minions.length === 1) ports.attach(s, p, s.minions[0].id);
      else
        ports.choose(
          s,
          name(GUARDSMAN),
          "Attach Imperial Guardsman to a minion.",
          s.minions.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [D("attach-to", { piece: p, target: m.id })],
          })),
        );
      break;
    }
    case "db:attach-to": {
      const p = e.piece as Piece;
      if (s.minions.some((m) => m.id === e.target))
        ports.attach(s, p, e.target);
      else if (s.resolving.some((q) => q.id === p.id))
        ports.discardPiece(s, p.id);
      else s.encounter.discard.push(p);
      break;
    }
    case "db:cruel": {
      // Discard until a minion is discarded, reveal it and attach Cruel
      // Experiment to it.
      const cruel = s.resolving.find((q) => q.id === e.id);
      if (!cruel) break;
      s.resolving = s.resolving.filter((q) => q.id !== e.id);
      let found: Piece | undefined;
      for (let n = 0; n < 200; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && def(piece)?.type_code === "minion") {
          found = piece;
          break;
        }
        if (!piece || emptied) break;
      }
      if (!found) {
        s.encounter.discard.push(cruel);
        break;
      }
      // The minion is revealed first, then Cruel Experiment attaches.
      ports.queue(s, D("attach-to", { piece: cruel, target: found.id }));
      ports.reveal(s, found, e.playerId);
      break;
    }
    case "db:evil-genius": {
      // Alter-ego: Dark Beast schemes and gets a tough status card. Hero:
      // he attacks you with an additional boost card.
      if (!alive(s, e.playerId) || !darkBeastInPlay(s)) break;
      const hero = seatView(s, e.playerId).player.form === "hero";
      if (hero)
        s.flags.darkBeastExtraBoost =
          Number(s.flags.darkBeastExtraBoost || 0) + 1;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: hero ? "attack" : "scheme",
        modifier: 0,
        ...(hero ? { after: D("clear-boost") } : {}),
      });
      if (!hero)
        ports.queue(s, {
          type: "status",
          target: s.villain.id,
          status: "tough",
        });
      break;
    }
    case "db:clear-boost":
      // An unused additional boost card does not carry over.
      delete s.flags.darkBeastExtraBoost;
      break;
    case "db:land-out-of-time":
      // With The Savage Land: its Special, with indirect damage for each
      // resource icon; otherwise find The Savage Land and reveal it.
      if (
        (s.environments || []).some(
          (q) => q.code === SAVAGE_LAND && active(s, q),
        )
      )
        ports.queue(
          s,
          D("special", { playerId: e.playerId, indirect: true, source: e.id }),
        );
      else {
        for (const zone of [s.encounter.deck, s.encounter.discard]) {
          const i = zone.findIndex((p) => p.code === SAVAGE_LAND);
          if (i < 0) continue;
          const [p] = zone.splice(i, 1);
          delete s.encounter.knownTop;
          ports.reveal(s, p, e.playerId);
          break;
        }
      }
      break;
    case "db:imperial": {
      // Oracle confuses, Manta stuns and Earthquake exhausts you; if you
      // already were, the Setting's Special.
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const already =
        e.code === ORACLE
          ? !!view.confused
          : e.code === MANTA
            ? !!view.stunned
            : !ports.exhaustIdentity(s, e.playerId);
      // "You are confused" always applies (a steady identity can take a
      // second card); the Special follows if you already were.
      if (e.code !== EARTHQUAKE)
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: e.code === ORACLE ? "confused" : "stunned",
          actorId: e.playerId,
        });
      if (already) ports.queue(s, D("special", { playerId: e.playerId }));
      break;
    }
    case "db:warstar": {
      // The top encounter card: an Imperial Guard minion is revealed,
      // otherwise the Setting's Special.
      const { piece } = ports.discardTop(s);
      if (
        piece &&
        def(piece)?.type_code === "minion" &&
        traits(piece).includes("Imperial Guard")
      )
        ports.reveal(s, piece, e.playerId);
      else ports.queue(s, D("special", { playerId: e.playerId }));
      break;
    }
    case "db:facedown": {
      // Pterosaur's and Gladiator's boosts: dealt to you facedown instead
      // of being discarded.
      const activation = s.scheming || s.attack;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      s.resolving = s.resolving.filter((q) => q.id !== e.id);
      ports.dealFacedown(s, p, e.playerId);
      break;
    }
    case "db:velociraptor": {
      // The top card of your deck is discarded: +1 ATK for each resource
      // icon on it, for this attack.
      if (!alive(s, e.playerId) || !s.attack) break;
      const a = s.attack;
      const [p] = ports.mill(s, e.playerId, 1);
      const n = p ? resourceIcons(p) : 0;
      if (n <= 0) break;
      a.modifier = (a.modifier || 0) + n;
      const carry = (q: Effect) => {
        if (
          q.type === "enemyAttackInitiationWindow" &&
          q.attacker === a.attacker &&
          typeof q.modifier === "number"
        )
          q.modifier += n;
        for (const next of (q.after as Effect[] | undefined) || []) carry(next);
      };
      for (const q of s.queue) carry(q);
      break;
    }
    case "db:unibike": {
      // Armored Unibike engages the player with Escaped Mutant attached.
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, e.playerId)) break;
      m.engagedWith = e.playerId;
      ports.log(s, `${name(m)} engages the Escaped Mutant's holder.`, "bad");
      break;
    }
    case "db:teamwork": {
      // Teamwork (Imperial Guard).
      const live = s.minions.filter(
        (m) =>
          !m.pendingDefeat &&
          (traits(m).includes("Imperial Guard") ||
            darkBeastTrait(s, m.id, "Imperial Guard")),
      );
      const entered = live.find((m) => m.id === e.id);
      if (!entered || !active(s, entered) || live.length < 2) break;
      const playerId = entered.engagedWith || s.activePlayerId;
      if (!alive(s, playerId)) break;
      ports.activate(s, {
        enemyId: entered.id,
        playerId,
        kind:
          seatView(s, playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "db:escaped-mutant": {
      // Find Escaped Mutant: Magistrate attaches it to the defeating
      // player's identity; Police State reveals it.
      if (!alive(s, e.playerId)) break;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((p) => p.code === ESCAPED_MUTANT);
        if (i < 0) continue;
        const [p] = zone.splice(i, 1);
        delete s.encounter.knownTop;
        if (e.reveal) ports.reveal(s, p, e.playerId);
        else ports.attachToIdentity(s, p, e.playerId);
        break;
      }
      break;
    }
    case "db:shenanigans": {
      // Discard until a card from the Setting's encounter set is
      // discarded, and reveal it.
      const setting = darkBeastSetting(s);
      const set = setting && def(setting)?.set_code;
      if (!set || !alive(s, e.playerId)) break;
      for (let n = 0; n < 200; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && def(piece)?.set_code === set) {
          ports.reveal(s, piece, e.playerId);
          break;
        }
        if (!piece || emptied) break;
      }
      break;
    }
    case "db:trial": {
      // Each Imperial Guard minion in the encounter discard pile is
      // shuffled into the encounter deck.
      const guards = s.encounter.discard.filter(
        (p) =>
          def(p)?.type_code === "minion" &&
          traits(p).includes("Imperial Guard"),
      );
      for (const p of guards) ports.shuffleIntoEncounter(s, p);
      break;
    }
    case "db:hero-action": {
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      ports.queue(
        s,
        { type: "exhaust", id: "hero", actorId: e.playerId },
        D("special", { playerId: e.playerId }),
        { type: "discardPiece", id: a.id },
      );
      break;
    }
    case "db:mutant-action": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      ports.queue(s, D("special", { playerId: e.playerId }), {
        type: "discardPiece",
        id: p.id,
      });
      break;
    }
    default:
      throw Error(`Unknown Dark Beast effect: ${e.type}`);
  }
  return true;
}
