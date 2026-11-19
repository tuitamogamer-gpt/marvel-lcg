import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** The Hood scenario pack: The Hood scenario and the alternative Standard II
 * and Expert II encounter sets. */
export const HOOD_SCENARIO_CODES = [
  "24001",
  "24002",
  "24003",
  "24004a",
  "24004b",
  "24005a",
  "24005b",
  "24006a",
  "24006b",
  "24007",
  "24008",
  "24009",
  "24010",
  "24011",
  "24012",
  "24013",
] as const;
/** Shadow of the Past (24053) reprints the core card and keeps its rules. */
export const STANDARD_II_CODES = [
  "24049a",
  "24049b",
  "24050",
  "24051",
  "24052",
  "24054",
] as const;
export const EXPERT_II_CODES = ["24029", "24030", "24031", "24032"] as const;
export const HOOD_SCRIPT_CODES = [
  ...HOOD_SCENARIO_CODES,
  ...STANDARD_II_CODES,
  ...EXPERT_II_CODES,
] as const;

export const HOOD_VILLAINS = ["24001", "24002", "24003"] as const;
export const MAKING_CONNECTIONS = "24004b";
const PROMISED_PROSPERITY_A = "24005a";
const PROMISED_PROSPERITY = "24005b";
const CRIME_STATE_A = "24006a";
const CRIME_STATE = "24006b";
const ESTABLISHED_DOMINANCE = "24007";
const MANTLE = "24008";
const PISTOL = "24009";
const MADAME_MASQUE = "24010";
const UNBRIDLED_AMBITION = "24011";
const FIELD_RECRUITMENT = "24012";
const UPPER_HAND = "24013";
export const FORMIDABLE_FOE = { standard: "24049a", expert: "24049b" };
const DARK_DEALINGS = "24050";
const MOB_MENTALITY = "24051";
const OVERWHELMING_FORCE = "24052";
const TOTAL_ANNIHILATION = "24054";
const CRUEL_INTENTIONS = "24029";
const RUINATION = "24030";
const SEEK_AND_DESTROY = "24031";
const SLUG_IT_OUT = "24032";
/** The Hood set's own cards: Foul Play never deals them. */
const HOOD_SET = "the_hood";

export interface HoodState {
  /** The physical main scheme card in play and the next ones. */
  currentMain: Piece;
  mainDeck: Piece[];
  /** The next villain card. */
  villainDeck: Piece[];
  /** Set-aside modular encounter sets. */
  setAside: Piece[];
  /** Promised Prosperity: the players dealt a card by its Foul Play. */
  tally?: string[];
}

export interface HoodPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
  /** Deal this encounter card from the discard pile to the player facedown. */
  dealPiece(s: GameState, p: Piece, playerId: string): void;
  random(s: GameState): number;
  /** Put the player's nemesis minion into play engaged with them. */
  nemesisMinion(s: GameState, playerId: string): boolean;
  cost(p: Piece): number;
  canDiscard(s: GameState, p: Piece): boolean;
  allies(s: GameState, playerId: string): Piece[];
  /** Pay printed resources of exactly these types, then queue `after`. */
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
const typeOf = (p: Piece) => def(p)?.type_code;
const H = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hood:${type}`,
  ...args,
});
const scripted = new Set<string>(HOOD_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
export const isHood = (s: GameState) =>
  (HOOD_VILLAINS as readonly string[]).includes(s.villain.code);
const hoodStage = (s: GameState) =>
  HOOD_VILLAINS.indexOf(s.villain.code as (typeof HOOD_VILLAINS)[number]) + 1;
const foulPlayEach = (s: GameState, tally?: string): Effect[] =>
  playerOrder(s).map((seat) =>
    H("foul-play", { playerId: seat.id, actorId: seat.id, tally }),
  );

// ------------------------------------------------------------- setup

/** Making Connections (1A): set aside the seven modular sets and shuffle one
 * of them at random into the encounter deck. Returns the set-aside cards. */
export function hoodSetAside(
  s: GameState,
  modules: string[],
  random: () => number,
): Piece[] {
  const first = modules[Math.floor(random() * modules.length)];
  const aside = s.encounter.deck.filter(
    (p) =>
      modules.includes(def(p)?.set_code || "") && def(p)?.set_code !== first,
  );
  s.encounter.deck = s.encounter.deck.filter((p) => !aside.includes(p));
  return aside;
}
/** 1B: each player resolves Foul Play. Expert's The Hood (II) first shuffles
 * another set-aside modular set into the encounter deck. */
export function hoodSetupEffects(s: GameState): Effect[] {
  return [
    ...(s.villain.code === HOOD_VILLAINS[1] ? [H("recruit")] : []),
    ...foulPlayEach(s),
  ];
}
/** The modular encounter sets still set aside. */
export function hoodSetAsideSets(s: GameState): string[] {
  return [
    ...new Set((s.hood?.setAside || []).map((p) => def(p)?.set_code || "")),
  ];
}

// ---------------------------------------------------------- villains

/** The Hood (II) and (III): When Revealed, a random set-aside modular set is
 * shuffled into the encounter deck. */
export function hoodVillainRevealed(s: GameState): Effect[] {
  if (!s.hood || isTextBlank(s, s.villain)) return [];
  return [HOOD_VILLAINS[1], HOOD_VILLAINS[2]].includes(s.villain.code as never)
    ? [H("recruit")]
    : [];
}
/** The main scheme's next stage: its A side's When Revealed. */
export function hoodMainRevealed(s: GameState, code: string): Effect[] {
  switch (code) {
    case PROMISED_PROSPERITY_A:
      return [H("recruit"), H("accelerate")];
    case PROMISED_PROSPERITY:
      return [...foulPlayEach(s, "prosperity"), H("prosperity")];
    case CRIME_STATE_A:
      return [H("recruit"), H("accelerate"), ...foulPlayEach(s)];
    default:
      return [];
  }
}
/** Crime State (3B): after step one, each player resolves Foul Play. */
export function hoodStepOne(s: GameState): Effect[] {
  return s.hood && s.scheme.code === CRIME_STATE ? foulPlayEach(s) : [];
}
/** Unbridled Ambition: when the villain phase begins, Foul Play. */
export function hoodVillainPhaseInterrupts(s: GameState): Effect[] {
  return s.sideSchemes
    .filter((p) => p.code === UNBRIDLED_AMBITION && !isTextBlank(s, p))
    .map((p) => H("ambition", { id: p.id }));
}
export function hoodKeyword(s: GameState, p: Piece, keyword: string): number {
  if (keyword === "Retaliate")
    return s.attachments.filter(
      (a) => a.code === MANTLE && a.attachedTo === p.id && !isTextBlank(s, a),
    ).length;
  return 0;
}
/** Steady: The Hood's Mantle, and Formidable Foe (the villain in Standard,
 * each enemy in Expert). */
export function hoodSteady(s: GameState, p: Piece): boolean {
  if (
    s.attachments.some(
      (a) => a.code === MANTLE && a.attachedTo === p.id && !isTextBlank(s, a),
    )
  )
    return true;
  const foes = (s.environments || []).filter(
    (q) =>
      (q.code === FORMIDABLE_FOE.standard ||
        q.code === FORMIDABLE_FOE.expert) &&
      !isTextBlank(s, q),
  );
  if (!foes.length) return false;
  const enemy = p.id === s.villain.id || s.minions.some((m) => m.id === p.id);
  return foes.some((q) =>
    q.code === FORMIDABLE_FOE.expert ? enemy : p.id === s.villain.id,
  );
}
/** Acceleration icons on environments (Formidable Foe in Expert). */
export function hoodAcceleration(s: GameState): number {
  return (s.environments || []).reduce(
    (n, p) =>
      n +
      ((def(p)?.scheme_acceleration as number | undefined) && !isTextBlank(s, p)
        ? Number(def(p)!.scheme_acceleration)
        : 0),
    0,
  );
}
/** Total Annihilation: the villain's attack against you gains overkill. */
export function hoodAttackInitiated(s: GameState, enemyId: string): Effect[] {
  if (s.attack && enemyId === s.villain.id && s.flags.hoodTotalAnnihilation) {
    delete s.flags.hoodTotalAnnihilation;
    s.attack.overkill = true;
  }
  return [];
}

// ------------------------------------------------------- responses

export interface HoodActivationReceipt {
  token: string;
  attackerId: string;
  playerId: string;
}
/** Established Dominance: after The Hood activates against you, resolve his
 * Foul Play. */
export function hoodAfterActivation(
  s: GameState,
  r: HoodActivationReceipt,
): MutagenForcedResponse[] {
  if (!s.hood || r.attackerId !== s.villain.id || !isHood(s)) return [];
  return s.attachments
    .filter(
      (a) =>
        a.code === ESTABLISHED_DOMINANCE &&
        a.attachedTo === `hero:${r.playerId}` &&
        !isTextBlank(s, a),
    )
    .map((a) => ({
      id: `${r.token}:dominance:${a.id}`,
      sourceId: a.id,
      title: name(ESTABLISHED_DOMINANCE),
      effects: [H("foul-play", { playerId: r.playerId, actorId: r.playerId })],
    }));
}
/** Madame Masque: When Defeated, the defeating player resolves Foul Play. */
export function hoodMinionDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === MADAME_MASQUE && s.hood
    ? [H("foul-play", { playerId, actorId: playerId })]
    : [];
}

// --------------------------------------------------------- actions

/** Hero Actions that discard The Hood's attachments; Established
 * Dominance's Alter-Ego Action. */
export function hoodActions(s: GameState, p: Piece): Option[] {
  if (isTextBlank(s, p) || !s.attachments.some((a) => a.id === p.id)) return [];
  if (p.code === MANTLE || p.code === PISTOL) {
    if (s.player.form !== "hero") return [];
    const resources =
      p.code === MANTLE
        ? ["energy", "mental", "physical"]
        : ["mental", "physical"];
    return [
      {
        id: "discard",
        label: `Spend ${resources.join(", ")} · discard ${name(p)}`,
        image: p.code,
        effects: [H("pay-discard", { id: p.id, resources })],
      },
    ];
  }
  if (
    p.code === ESTABLISHED_DOMINANCE &&
    p.attachedTo === `hero:${s.activePlayerId}` &&
    s.player.form === "alter" &&
    !s.player.exhausted
  )
    return [
      {
        id: "discard",
        label: `Exhaust and place 2 threat · discard ${name(p)}`,
        image: p.code,
        effects: [
          { type: "exhaust", id: "hero" },
          { type: "threat", target: "main", amount: 2 },
          { type: "discardPiece", id: p.id },
        ],
      },
    ];
  return [];
}

// ---------------------------------------------------- reveal & boosts

export function hoodReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === ESTABLISHED_DOMINANCE)
    return [H("attach-identity", { piece: p, playerId })];
  if (p.code === MANTLE || p.code === PISTOL)
    return [H("attach-villain", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  switch (p.code) {
    case MADAME_MASQUE:
      return [H("foul-play", { playerId, actorId: playerId })];
    case FIELD_RECRUITMENT:
      return [
        H("recruit"),
        H("foul-play", { playerId, actorId: playerId }),
        H("remove", { id: p.id }),
      ];
    case UPPER_HAND:
      return [
        H("activate", { playerId, kind: hero ? "attack" : "scheme" }),
        H("foul-play", { playerId, actorId: playerId }),
      ];
    case DARK_DEALINGS:
      return [H("activate", { playerId, kind: "scheme", modifier: 1 })];
    case MOB_MENTALITY:
      return hero
        ? [{ type: "surge", sourceCode: p.code }, H("mob", { playerId })]
        : [H("mob-alter", { playerId })];
    case OVERWHELMING_FORCE:
      return [H("overwhelm", { playerId, sourceCode: p.code })];
    case TOTAL_ANNIHILATION:
      return hero ? [H("annihilate", { playerId })] : [];
    case CRUEL_INTENTIONS:
      return [
        ...playerOrder(s).map((seat) => ({
          type: "dealEncounter",
          playerId: seat.id,
        })),
        H("next-boost"),
      ];
    case RUINATION:
      return [H("ruination", { playerId })];
    case SEEK_AND_DESTROY:
      return [H("seek", { playerId })];
    case SLUG_IT_OUT:
      return [
        { type: "exhaust", id: "hero", actorId: playerId },
        {
          type: "damage",
          target: "hero",
          amount: 2,
          source: "encounter",
          actorId: playerId,
        },
      ];
    default:
      return [];
  }
}

export function hoodBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const a = s.attack || s.scheming;
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  const enemyId = a?.attacker;
  switch (p.code) {
    case PISTOL:
      return [H("pistol", { id: p.id, playerId })];
    case FIELD_RECRUITMENT:
      return [H("after-activation", { playerId })];
    case DARK_DEALINGS:
    case OVERWHELMING_FORCE:
      return enemyId === s.villain.id ? [H("more-boost", { enemyId })] : [];
    case TOTAL_ANNIHILATION:
      return s.attack && s.attack.attacker === s.villain.id
        ? [H("overkill")]
        : [];
    case CRUEL_INTENTIONS:
      return [{ type: "dealEncounter", playerId }];
    case SLUG_IT_OUT:
      return [
        H("slug", { playerId }),
        ...(enemyId === s.villain.id ? [H("more-boost", { enemyId })] : []),
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------- resolver

export function resolveHoodEffect(
  s: GameState,
  e: Effect,
  ports: HoodPorts,
): boolean {
  if (!e.type.startsWith("hood:")) return false;
  switch (e.type) {
    case "hood:foul-play":
      foulPlay(s, e.playerId, e.tally, ports);
      break;
    case "hood:prosperity": {
      const dealt = s.hood?.tally || [];
      if (s.hood) delete s.hood.tally;
      const missing = playerOrder(s).filter(
        (seat) => !dealt.includes(seat.id),
      ).length;
      if (missing)
        ports.queue(s, { type: "threat", target: "main", amount: 2 * missing });
      break;
    }
    case "hood:recruit":
      recruit(s, ports);
      break;
    case "hood:accelerate":
      s.encounter.acceleration += 1;
      ports.log(
        s,
        "An acceleration token is placed on the main scheme.",
        "bad",
      );
      break;
    case "hood:ambition":
      if (s.sideSchemes.some((p) => p.id === e.id))
        ports.queue(s, ...foulPlayEach(s));
      break;
    case "hood:attach-identity": {
      const p = e.piece as Piece;
      if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "hood:attach-villain": {
      const p = e.piece as Piece;
      if (isHood(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "hood:remove": {
      // Field Recruitment is removed from the game instead of discarded.
      const i = s.resolving.findIndex((p) => p.id === e.id);
      if (i >= 0) s.removed.push(s.resolving.splice(i, 1)[0]);
      break;
    }
    case "hood:activate":
      if (alive(s, e.playerId) && !over(s))
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: Number(e.modifier) || 0,
        });
      break;
    case "hood:mob": {
      if (!alive(s, e.playerId)) break;
      const minions = s.minions.filter(
        (m) => m.engagedWith === e.playerId || !m.engagedWith,
      );
      ports.queue(
        s,
        H("activate", { playerId: e.playerId, kind: "attack" }),
        ...minions.map((m) =>
          H("minion-attack", { id: m.id, playerId: e.playerId }),
        ),
      );
      break;
    }
    case "hood:minion-attack":
      if (alive(s, e.playerId) && s.minions.some((m) => m.id === e.id))
        ports.activate(s, {
          enemyId: e.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 0,
        });
      break;
    case "hood:mob-alter": {
      if (!alive(s, e.playerId)) break;
      for (let i = 0; i < 7; i++) {
        const last = s.encounter.deck.length <= 1;
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        if (typeOf(piece) === "minion") {
          ports.putMinion(s, piece, e.playerId);
          break;
        }
        if (emptied || last) break;
      }
      break;
    }
    case "hood:overwhelm": {
      if (!alive(s, e.playerId)) break;
      const options = seatView(s, e.playerId).player.inPlay.filter(
        (p) =>
          ["upgrade", "support"].includes(typeOf(p) || "") &&
          ports.canDiscard(s, p),
      );
      if (!options.length) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      const top = Math.max(...options.map((p) => ports.cost(p)));
      const tied = options.filter((p) => ports.cost(p) === top);
      if (tied.length === 1) ports.discardPiece(s, tied[0].id);
      else
        ports.choose(
          s,
          name(OVERWHELMING_FORCE),
          "Discard the highest-cost upgrade or support you control.",
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: [{ type: "discardPiece", id: p.id }],
          })),
        );
      break;
    }
    case "hood:annihilate":
      if (!alive(s, e.playerId)) break;
      seatView(s, e.playerId).flags.hoodTotalAnnihilation = true;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    case "hood:overkill":
      if (s.attack && s.attack.attacker === s.villain.id)
        s.attack.overkill = true;
      break;
    case "hood:more-boost":
      if (
        s.attack?.attacker === e.enemyId ||
        s.scheming?.attacker === e.enemyId
      )
        ports.giveBoost(s, e.enemyId, "current");
      break;
    case "hood:next-boost":
      ports.giveBoost(s, s.villain.id, "next");
      break;
    case "hood:ruination": {
      for (let guard = 0; guard < 200; guard++) {
        const last = s.encounter.deck.length <= 1;
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        if (typeOf(piece) === "side_scheme") {
          ports.queue(s, H("ruin-threat"));
          ports.reveal(s, piece, e.playerId);
          return true;
        }
        if (emptied || last) break;
      }
      ports.queue(s, H("ruin-threat"));
      break;
    }
    case "hood:ruin-threat":
      ports.queue(
        s,
        { type: "threat", target: "main", amount: 2 },
        ...s.sideSchemes.map((p) => ({
          type: "threat",
          target: p.id,
          amount: 2,
        })),
      );
      break;
    case "hood:seek":
      if (alive(s, e.playerId)) {
        ports.nemesisMinion(s, e.playerId);
        ports.shuffleEncounter(s);
      }
      break;
    case "hood:slug": {
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        {
          type: "damage",
          target: "hero",
          amount: 1,
          source: "encounter",
          actorId: e.playerId,
        },
        ...ports.allies(s, e.playerId).map((a) => ({
          type: "damage",
          target: a.id,
          amount: 1,
          source: "encounter",
          actorId: e.playerId,
        })),
      );
      break;
    }
    case "hood:pistol": {
      // The Hood's Pistol boost: reveal this card; it attaches to The Hood
      // instead of being discarded after the activation.
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "hood:after-activation": {
      const activation = s.attack || s.scheming;
      const effect = H("foul-play", {
        playerId: e.playerId,
        actorId: e.playerId,
      });
      if (activation) (activation.afterActivation ||= []).push(effect);
      else ports.queue(s, effect);
      break;
    }
    case "hood:pay-discard": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("This attachment is no longer in play.");
      ports.payResources(s, name(p), e.resources, [
        { type: "discardPiece", id: p.id },
      ]);
      break;
    }
    default:
      return false;
  }
  return true;
}

/** Foul Play by stage: I discards 1 card and deals it unless it belongs to
 * The Hood set; II discards 2 and deals the first such card; III discards 2
 * and deals each. */
function foulPlay(
  s: GameState,
  playerId: string,
  tally: string | undefined,
  ports: HoodPorts,
) {
  if (!alive(s, playerId) || over(s)) return;
  const stage = Math.max(1, hoodStage(s));
  const count = stage === 1 ? 1 : 2;
  const discarded: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const { piece, emptied } = ports.discardTop(s);
    if (!piece) break;
    discarded.push(piece);
    if (emptied) break;
  }
  const eligible = discarded.filter((p) => def(p)?.set_code !== HOOD_SET);
  const dealt = stage === 3 ? eligible : eligible.slice(0, 1);
  for (const p of dealt) ports.dealPiece(s, p, playerId);
  ports.log(
    s,
    `Foul Play: ${ports.heroName(s, playerId)} discards ${discarded.map((p) => name(p)).join(" and ") || "nothing"}${dealt.length ? ` and is dealt ${dealt.length === 1 ? "it" : "them"} facedown` : ""}.`,
    dealt.length ? "bad" : "info",
  );
  if (tally === "prosperity" && dealt.length && s.hood)
    (s.hood.tally ||= []).push(playerId);
}

/** Shuffle a random set-aside modular encounter set into the deck. */
function recruit(s: GameState, ports: HoodPorts) {
  const h = s.hood;
  if (!h || over(s)) return;
  const sets = hoodSetAsideSets(s);
  if (!sets.length) return;
  const set = sets[Math.floor(ports.random(s) * sets.length)];
  const pieces = h.setAside.filter((p) => def(p)?.set_code === set);
  h.setAside = h.setAside.filter((p) => !pieces.includes(p));
  s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, ...pieces]);
  delete s.encounter.knownTop;
  ports.log(
    s,
    `The Hood recruits: a set-aside modular encounter set is shuffled into the encounter deck (${sets.length - 1} remain set aside).`,
    "bad",
  );
}
