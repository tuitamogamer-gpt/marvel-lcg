import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** NeXt Evolution's third scenario, The Unstoppable Juggernaut: momentum
 * counters drive Juggernaut's ATK, his Helmet keeps him stalwart until the
 * players knock it off, and his main scheme never ends the game but sends
 * him charging at every player. Hope Summers fights beside the first
 * player; with the Black Tom Cassidy modular set, which joins any scenario
 * with modular sets. */

export const JUGGERNAUT_SCRIPT_CODES = [
  "40118",
  "40119",
  "40120",
  "40121a",
  "40121b",
  "40122a",
  "40122b",
  "40123",
  "40124",
  "40125",
  "40126",
  "40127",
  "40128",
  "40129",
] as const;
export const HOPE_SUMMERS_CODES = ["40130", "40131"] as const;
export const BLACK_TOM_CODES = ["40132", "40133", "40134", "40135"] as const;

const STAGES = ["40118", "40119", "40120"];
export const UNSTOPPABLE = "40121b";
export const HELMET = "40122a";
export const EXPOSED = "40122b";
export const HEAD_OF_STEAM = "40123";
export const BUILDING_MOMENTUM = "40124";
const BREAKTHROUGH = "40125";
const FLATTEN = "40126";
const GROUND_POUND = "40127";
const TRAMPLE = "40128";
const CYTTORAKS_EXEMPLAR = "40129";
export const HOPE_SUMMERS = "40130";
export const CAPTIVE_HOPE = "40131";
export const BLACK_TOM = "40132";
export const CREEPING_WILLOW = "40133";
const MAKING_GREEN = "40134";
const A_SOUND_THRASHING = "40135";
const RESOURCE_TYPES: Resource[] = ["energy", "mental", "physical"];

export interface JuggernautPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** The encounter cards with this code in the deck (and discard pile). */
  findCode(s: GameState, code: string, discardToo: boolean): Piece[];
  /** Reveal an encounter card found by a search for this player. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  enemyStat(s: GameState, p: Piece, stat: "attack"): number;
  remainingHp(s: GameState, p: Piece): number;
  heroName(s: GameState, playerId: string): string;
  canStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  allies(s: GameState, playerId: string): Piece[];
  /** Upgrades and supports the player controls, with their printed cost. */
  ownCards(s: GameState, playerId: string): { piece: Piece; cost: number }[];
  endGame(s: GameState, won: boolean, reason: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const J = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `jug:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const juggernaut = (s: GameState) => s.villainId === "juggernaut";
/** The scenarios that put Hope Summers into play: The Unstoppable
 * Juggernaut, Mister Sinister's Sinister Intent and Stryfe's Uncontrollable
 * Power. */
export const hopeScenario = (s: GameState) =>
  ["juggernaut", "mister_sinister", "stryfe"].includes(s.villainId);
/** The villain in play is a Juggernaut stage with its text active. */
const juggernautInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code) && active(s, s.villain);
export const isJuggernaut = (s: GameState, id: string) =>
  juggernautInPlay(s) && id === s.villain.id;

/** Momentum counters on Juggernaut. */
export const momentum = (s: GameState) =>
  s.villain && STAGES.includes(s.villain.code) ? s.villain.counters || 0 : 0;
/** Juggernaut's Helmet, on either side. */
export function jugHelmet(s: GameState): Piece | undefined {
  return s.attachments.find(
    (a) =>
      (a.code === HELMET || a.code === EXPOSED) &&
      a.attachedTo === s.villain?.id,
  );
}
const exposed = (s: GameState) => {
  const helmet = jugHelmet(s);
  return !!helmet && helmet.code === EXPOSED;
};
/** Hope Summers and the player controlling her. */
export function jugHope(
  s: GameState,
): { piece: Piece; playerId: string } | undefined {
  for (const seat of s.players) {
    const piece = seatView(s, seat.id).player.inPlay.find(
      (p) => p.code === HOPE_SUMMERS,
    );
    if (piece) return { piece, playerId: seat.id };
  }
  return undefined;
}

// ------------------------------------------------------------------- setup

/** The Unstoppable Juggernaut (1A): Juggernaut's Helmet attaches to
 * Juggernaut and Hope Summers enters play under the first player's control. */
export function jugSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
) {
  const helmet = ports.makePiece(s, HELMET);
  helmet.attachedTo = s.villain.id;
  s.attachments.push(helmet);
  hopeSetup(s, ports);
  const main = def(UNSTOPPABLE);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
}
/** Hope Summers enters play under the first player's control. */
export function hopeSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
) {
  const hope = ports.makePiece(s, HOPE_SUMMERS);
  delete hope.ownerId;
  seatView(s, s.firstPlayerId).player.inPlay.push(hope);
}
/** The deck leaves out the cards that setup puts into play. */
export const jugSetupCard = (code: string) =>
  code === HELMET || code === EXPOSED || code === HOPE_SUMMERS;

// --------------------------------------------------------------- villain

/** Each Juggernaut stage's When Revealed ability. */
export function jugVillainRevealed(s: GameState): Effect[] {
  if (!juggernaut(s) || !juggernautInPlay(s)) return [];
  switch (s.villain.code) {
    case "40118":
      return [
        J("momentum", { n: 1 }),
        { type: "status", target: s.villain.id, status: "tough" },
      ];
    case "40119":
      return [J("momentum", { n: 1 }), J("flip-or-tough")];
    case "40120":
      return [
        J("steam-search", { playerId: s.activePlayerId }),
        J("flip-or-tough"),
      ];
    default:
      return [];
  }
}
/** The Unstoppable Juggernaut (1B): instead of being completed, its threat
 * is removed, Juggernaut Exposed flips, Juggernaut gains a momentum counter
 * and attacks each player in player order, even in alter-ego form. */
export function jugMainCompleted(s: GameState): Effect[] | null {
  if (!juggernaut(s) || s.scheme.code !== UNSTOPPABLE) return null;
  s.scheme.threat = 0;
  return [
    J("flip-exposed"),
    J("momentum", { n: 1 }),
    ...playerOrder(s)
      .filter((seat) => !seat.eliminated)
      .map((seat) => J("charge", { playerId: seat.id })),
  ];
}

// ------------------------------------------------------------ keywords

export function jugKeyword(s: GameState, p: Piece, keyword: string): number {
  if (isJuggernaut(s, p.id)) {
    const helmet = jugHelmet(s);
    // Juggernaut's Helmet: stalwart, and his attacks gain overkill.
    if (
      helmet?.code === HELMET &&
      active(s, helmet) &&
      (keyword === "Stalwart" || keyword === "Overkill")
    )
      return 1;
    // Head of Steam: retaliate X, X being his momentum counters.
    if (keyword === "Retaliate")
      return s.attachments.some(
        (a) =>
          a.code === HEAD_OF_STEAM && a.attachedTo === p.id && active(s, a),
      )
        ? momentum(s)
        : 0;
    return 0;
  }
  return 0;
}
/** The text a revealed card resolves with: Making Green gives each copy of
 * Creeping Willow surge, and Cyttorak's Exemplar gains incite 1 in expert
 * mode. */
export function jugRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (
    p.code === CREEPING_WILLOW &&
    s.sideSchemes.some((q) => q.code === MAKING_GREEN && active(s, q)) &&
    !/^Surge\./m.test(c.text || "")
  )
    return { ...c, text: `Surge.\n${c.text || ""}` };
  if (p.code === CYTTORAKS_EXEMPLAR && s.difficulty === "expert")
    return { ...c, text: `Incite 1.\n${c.text || ""}` };
  return c;
}
/** Juggernaut gets +1 ATK for each momentum counter. */
export function jugAttackBonus(s: GameState, p: Piece): number {
  return isJuggernaut(s, p.id) ? momentum(s) : 0;
}
/** Juggernaut Exposed: 1 additional damage from each card with a printed
 * mental resource. */
export function jugDamage(
  s: GameState,
  target: string,
  n: number,
  source?: Card,
): number {
  if (n <= 0 || !isJuggernaut(s, target)) return n;
  const helmet = jugHelmet(s);
  if (helmet?.code !== EXPOSED || !active(s, helmet)) return n;
  return (source?.resource_mental || 0) > 0 ? n + 1 : n;
}
/** Black Tom Cassidy cannot take damage while Creeping Willow is in play. */
export function jugImmune(s: GameState, target: string): boolean {
  const tom = s.minions.find((m) => m.id === target && m.code === BLACK_TOM);
  return (
    !!tom && active(s, tom) && s.minions.some((m) => m.code === CREEPING_WILLOW)
  );
}
/** Hope Summers does not count against the ally limit. */
export const jugAllyExcluded = (s: GameState, p: Piece) =>
  p.code === HOPE_SUMMERS && active(s, p);
/** Hope Summers' base ATK and THW are those of her controller's hero. */
export function jugHopeBase(
  s: GameState,
  p: Piece,
  kind: "attack" | "thwart",
  hero: (playerId: string) => { attack: number; thwart: number },
): number {
  if (p.code !== HOPE_SUMMERS || !active(s, p)) return 0;
  const hope = jugHope(s);
  return hope?.piece.id === p.id ? hero(hope.playerId)[kind] : 0;
}
/** Captive Hope: Hope Summers cannot ready. */
export const jugCannotReady = (s: GameState, p: Piece) =>
  p.code === HOPE_SUMMERS &&
  s.sideSchemes.some((q) => q.code === CAPTIVE_HOPE && active(s, q));

// ---------------------------------------------------------------- windows

/** Juggernaut Exposed: after Juggernaut schemes, he gains a momentum counter
 * and the Helmet flips back. */
export function jugSchemed(s: GameState, id: string): Effect[] {
  if (!isJuggernaut(s, id)) return [];
  const helmet = jugHelmet(s);
  return helmet?.code === EXPOSED && active(s, helmet)
    ? [J("momentum", { n: 1 }), J("flip", { to: HELMET })]
    : [];
}
/** After an attack resolves: Head of Steam's and Building Momentum's Hero
 * Responses after Juggernaut attacks you, and Creeping Willow's stun. */
export function jugAttacked(
  s: GameState,
  attackerId: string,
  defender: string | undefined,
  damage: number,
  playerId: string,
  damaged: string | undefined,
): Effect[] {
  const effects: Effect[] = [];
  const willow = s.minions.find(
    (m) => m.id === attackerId && m.code === CREEPING_WILLOW,
  );
  if (willow && active(s, willow) && damage > 0 && damaged)
    effects.push(J("stun", { target: damaged, playerId }));
  if (!isJuggernaut(s, attackerId) || !alive(s, playerId)) return effects;
  const steam = s.attachments.find(
    (a) =>
      a.code === HEAD_OF_STEAM && a.attachedTo === attackerId && active(s, a),
  );
  if (steam) effects.push(J("steam-offer", { id: steam.id, damage, playerId }));
  if (defender === "hero")
    for (const q of s.sideSchemes.filter(
      (q) => q.code === BUILDING_MOMENTUM && active(s, q) && q.counters > 0,
    ))
      effects.push(J("momentum-offer", { id: q.id, playerId }));
  return effects;
}

// ---------------------------------------------------------- reveal/boost

export function jugReveal(s: GameState, p: Piece): Effect[] | null {
  const code = p.code;
  if (
    !(JUGGERNAUT_SCRIPT_CODES as readonly string[]).includes(code) &&
    !(HOPE_SUMMERS_CODES as readonly string[]).includes(code) &&
    !(BLACK_TOM_CODES as readonly string[]).includes(code)
  )
    return null;
  const playerId = s.activePlayerId;
  // Head of Steam enters play attached; its When Revealed ability then
  // places the momentum counter.
  if (code === HEAD_OF_STEAM)
    return s.attachments.some((a) => a.id === p.id)
      ? isTextBlank(s, p)
        ? []
        : [J("momentum", { n: 1 })]
      : [J("steam", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (code) {
    case BREAKTHROUGH:
      return [J("breakthrough", { playerId })];
    case FLATTEN:
      return [J("flatten", { playerId })];
    case GROUND_POUND:
      return [J("ground-pound", { playerId })];
    case TRAMPLE:
      return [J("trample", { playerId })];
    case CYTTORAKS_EXEMPLAR:
      return [J("exemplar")];
    case CAPTIVE_HOPE:
      return [J("captive")];
    case BLACK_TOM:
      return [J("willow-put", { playerId })];
    case A_SOUND_THRASHING:
      return [J("thrashing", { playerId })];
    default:
      return [];
  }
}
export function jugBoost(s: GameState, p: Piece): Effect[] | null {
  if (![FLATTEN, GROUND_POUND, TRAMPLE, CREEPING_WILLOW].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case FLATTEN:
      return juggernautInPlay(s)
        ? [{ type: "status", target: s.villain.id, status: "tough" }]
        : [];
    case GROUND_POUND:
      return [J("indirect", { playerId, n: 1, source: GROUND_POUND })];
    case TRAMPLE:
      return [J("ally-damage", { playerId })];
    case CREEPING_WILLOW:
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
      ];
    default:
      return [];
  }
}

// ------------------------------------------------------------ actions

/** Juggernaut's Helmet's Hero Action. */
export function jugActionSource(s: GameState, id: string): Piece | undefined {
  return s.attachments.find((p) => p.id === id && p.code === HELMET);
}
export function jugActions(
  s: GameState,
  p: Piece,
  ports: Pick<JuggernautPorts, "canPay">,
): Option[] {
  if (
    s.phase !== "player" ||
    p.code !== HELMET ||
    !active(s, p) ||
    s.player.form !== "hero"
  )
    return [];
  return RESOURCE_TYPES.filter((r) => ports.canPay(s, 3, [r, r, r])).map(
    (r) => ({
      id: `helmet-${r}`,
      label: `Hero Action · spend 3 ${r} resources · remove Juggernaut's momentum counters and flip the Helmet`,
      image: p.code,
      effects: [J("helmet-pay", { id: p.id, resource: r })],
    }),
  );
}

// ---------------------------------------------------------------- resolver

export function resolveJuggernautEffect(
  s: GameState,
  e: Effect,
  ports: JuggernautPorts,
): boolean {
  if (!e.type.startsWith("jug:")) return false;
  switch (e.type) {
    case "jug:check":
      // Hope Summers leaving play loses the game.
      if (hopeScenario(s) && !over(s) && !jugHope(s))
        ports.endGame(
          s,
          false,
          "Hope Summers has left play. The mission fails.",
        );
      break;
    case "jug:momentum": {
      if (!juggernautInPlay(s)) break;
      const n = Number(e.n || 1);
      s.villain.counters = (s.villain.counters || 0) + n;
      ports.log(
        s,
        `${name(s.villain)} gains ${n} momentum counter${n === 1 ? "" : "s"} (${s.villain.counters}).`,
        "bad",
      );
      break;
    }
    case "jug:flip": {
      const helmet = jugHelmet(s);
      if (!helmet || helmet.code === e.to) break;
      helmet.code = e.to;
      ports.log(
        s,
        e.to === HELMET
          ? "Juggernaut's Helmet is back on."
          : "Juggernaut's Helmet is knocked off: Juggernaut Exposed.",
        e.to === HELMET ? "bad" : "good",
      );
      break;
    }
    case "jug:flip-exposed":
      if (exposed(s)) ports.queue(s, J("flip", { to: HELMET }));
      break;
    case "jug:flip-or-tough":
      // If Juggernaut Exposed is in play, flip it; otherwise Juggernaut gets
      // a tough status card.
      if (!juggernautInPlay(s)) break;
      ports.queue(
        s,
        exposed(s)
          ? J("flip", { to: HELMET })
          : { type: "status", target: s.villain.id, status: "tough" },
      );
      break;
    case "jug:charge":
      if (!alive(s, e.playerId) || over(s) || !juggernautInPlay(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    case "jug:steam-search": {
      // Juggernaut (III): search the encounter deck and discard pile for
      // Head of Steam and reveal it.
      const [p] = ports.findCode(s, HEAD_OF_STEAM, true);
      if (p) ports.reveal(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "jug:steam": {
      // Head of Steam attaches to Juggernaut.
      const p = e.piece as Piece;
      if (!juggernautInPlay(s)) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "jug:steam-offer": {
      const steam = s.attachments.find((a) => a.id === e.id);
      const cost = Number(e.damage || 0);
      if (!steam || !alive(s, e.playerId) || !ports.canPay(s, cost, [])) break;
      ports.choose(
        s,
        name(HEAD_OF_STEAM),
        `Juggernaut attacked you: spend ${cost} resource${cost === 1 ? "" : "s"} to discard Head of Steam?`,
        [
          {
            id: "discard",
            label: cost
              ? `Spend ${cost} resource${cost === 1 ? "" : "s"} · discard Head of Steam`
              : "Discard Head of Steam",
            image: HEAD_OF_STEAM,
            effects: [J("steam-pay", { id: steam.id, cost })],
          },
          { id: "pass", label: "Do not respond", effects: [] },
        ],
      );
      break;
    }
    case "jug:steam-pay": {
      const cost = Number(e.cost || 0);
      const discard: Effect = { type: "discardPiece", id: e.id };
      if (cost) ports.pay(s, cost, [], [discard], name(HEAD_OF_STEAM), true);
      else ports.queue(s, discard);
      break;
    }
    case "jug:momentum-offer": {
      const scheme = s.sideSchemes.find((q) => q.id === e.id);
      if (!scheme || !scheme.counters || !alive(s, e.playerId)) break;
      ports.choose(
        s,
        name(BUILDING_MOMENTUM),
        "You defended against Juggernaut: remove 1 threat from Building Momentum?",
        [
          {
            id: "thwart",
            label: "Remove 1 threat from Building Momentum",
            image: BUILDING_MOMENTUM,
            effects: [
              {
                type: "thwart",
                target: scheme.id,
                amount: 1,
                source: "hero",
                actorId: e.playerId,
              },
            ],
          },
          { id: "pass", label: "Do not respond", effects: [] },
        ],
      );
      break;
    }
    case "jug:helmet-pay": {
      const helmet = s.attachments.find(
        (a) => a.id === e.id && a.code === HELMET,
      );
      if (!helmet) break;
      const r = e.resource as Resource;
      ports.pay(
        s,
        3,
        [r, r, r],
        [J("helmet-off", { id: helmet.id })],
        name(HELMET),
        true,
      );
      break;
    }
    case "jug:helmet-off":
      if (!juggernautInPlay(s)) break;
      s.villain.counters = 0;
      ports.log(s, "Juggernaut loses each momentum counter.", "good");
      ports.queue(s, J("flip", { to: EXPOSED }));
      break;
    case "jug:breakthrough": {
      if (!alive(s, e.playerId) || !juggernautInPlay(s)) break;
      const atk = ports.enemyStat(s, s.villain, "attack");
      const own = ports.ownCards(s, e.playerId);
      const high = own.length ? Math.max(...own.map((o) => o.cost)) : -1;
      const options: Option[] = [
        {
          id: "damage",
          label: `Take ${atk} damage`,
          effects: [
            {
              type: "damage",
              target: "hero",
              amount: atk,
              source: BREAKTHROUGH,
              actorId: e.playerId,
            },
          ],
        },
        ...own
          .filter((o) => o.cost === high)
          .map((o) => ({
            id: o.piece.id,
            label: `Discard ${name(o.piece)}`,
            image: o.piece.code,
            effects: [{ type: "discardPiece", id: o.piece.id }],
          })),
      ];
      ports.choose(s, name(BREAKTHROUGH), "Choose one.", options);
      break;
    }
    case "jug:flatten": {
      if (!alive(s, e.playerId) || !juggernautInPlay(s)) break;
      const atk = ports.enemyStat(s, s.villain, "attack");
      ports.choose(s, name(FLATTEN), "Choose one.", [
        {
          id: "damage",
          label: `Take ${atk} damage`,
          effects: [
            {
              type: "damage",
              target: "hero",
              amount: atk,
              source: FLATTEN,
              actorId: e.playerId,
            },
          ],
        },
        {
          id: "momentum",
          label: "Place 1 momentum counter on Juggernaut",
          effects: [J("momentum", { n: 1 })],
        },
      ]);
      break;
    }
    case "jug:ground-pound": {
      // The players as a group take indirect damage equal to Juggernaut's
      // ATK; in a multiplayer game they assign each point to a player.
      if (!juggernautInPlay(s)) break;
      const n = ports.enemyStat(s, s.villain, "attack");
      const living = playerOrder(s).filter((seat) => !seat.eliminated);
      if (living.length === 1)
        ports.indirect(s, living[0].id, n, GROUND_POUND, name(GROUND_POUND));
      else ports.queue(s, J("group-indirect", { n, assigned: {} }));
      break;
    }
    case "jug:group-indirect": {
      const assigned = { ...(e.assigned as Record<string, number>) };
      const left =
        Number(e.n) - Object.values(assigned).reduce((a, b) => a + b, 0);
      const living = playerOrder(s).filter((seat) => !seat.eliminated);
      if (left <= 0 || living.length <= 1) {
        for (const [playerId, n] of Object.entries(assigned))
          if (n && alive(s, playerId))
            ports.indirect(s, playerId, n, GROUND_POUND, name(GROUND_POUND));
        break;
      }
      ports.choose(
        s,
        name(GROUND_POUND),
        `Assign the group's indirect damage (${left} left).`,
        living.map((seat) => ({
          id: seat.id,
          label: `${ports.heroName(s, seat.id)} takes 1`,
          effects: [
            J("group-indirect", {
              n: e.n,
              assigned: {
                ...assigned,
                [seat.id]: (assigned[seat.id] || 0) + 1,
              },
            }),
          ],
        })),
      );
      break;
    }
    case "jug:indirect":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, e.n, e.source, name(e.source));
      break;
    case "jug:trample": {
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.form !== "hero") {
        ports.indirect(s, e.playerId, 2, TRAMPLE, name(TRAMPLE));
        break;
      }
      // Juggernaut attacks the ally with the fewest remaining hit points.
      if (!juggernautInPlay(s)) break;
      const allies = s.players
        .filter((seat) => !seat.eliminated)
        .flatMap((seat) =>
          ports.allies(s, seat.id).map((q) => ({ q, playerId: seat.id })),
        );
      if (!allies.length) break;
      const least = Math.min(...allies.map((a) => ports.remainingHp(s, a.q)));
      const tied = allies.filter((a) => ports.remainingHp(s, a.q) === least);
      const attack = (a: { q: Piece; playerId: string }): Effect =>
        J("trample-attack", { allyId: a.q.id, playerId: a.playerId });
      if (tied.length === 1) ports.queue(s, attack(tied[0]));
      else
        ports.choose(
          s,
          name(TRAMPLE),
          "Juggernaut attacks the ally with the fewest remaining hit points.",
          tied.map((a) => ({
            id: a.q.id,
            label: name(a.q),
            image: a.q.code,
            effects: [attack(a)],
          })),
        );
      break;
    }
    case "jug:trample-attack":
      if (!alive(s, e.playerId) || !juggernautInPlay(s)) break;
      ports.queue(s, {
        type: "enemyAttack",
        id: s.villain.id,
        actorId: e.playerId,
        originalTarget: e.allyId,
      });
      break;
    case "jug:ally-damage": {
      // Trample's boost: deal 1 damage to an ally you control.
      if (!alive(s, e.playerId)) break;
      const allies = ports.allies(s, e.playerId);
      const hit = (q: Piece): Effect => ({
        type: "damage",
        target: q.id,
        amount: 1,
        source: TRAMPLE,
      });
      if (allies.length === 1) ports.queue(s, hit(allies[0]));
      else if (allies.length)
        ports.choose(
          s,
          name(TRAMPLE),
          "Deal 1 damage to an ally you control.",
          allies.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [hit(q)],
          })),
        );
      break;
    }
    case "jug:exemplar":
      // If Juggernaut Exposed is in play, flip it and place a momentum
      // counter; otherwise threat equal to Juggernaut's ATK.
      if (!juggernautInPlay(s)) break;
      if (exposed(s))
        ports.queue(s, J("flip", { to: HELMET }), J("momentum", { n: 1 }));
      else
        ports.queue(s, {
          type: "threat",
          target: "main",
          amount: ports.enemyStat(s, s.villain, "attack"),
        });
      break;
    case "jug:captive": {
      const hope = jugHope(s);
      if (hope) ports.queue(s, { type: "exhaust", id: hope.piece.id });
      break;
    }
    case "jug:willow-put": {
      // Black Tom Cassidy: 1 copy of Creeping Willow engages you.
      if (!alive(s, e.playerId)) break;
      const [p] = ports.findCode(s, CREEPING_WILLOW, true);
      if (p) ports.putMinion(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "jug:thrashing": {
      // Each Creeping Willow attacks the player it is engaged with; if you
      // were not attacked this way, a Creeping Willow is revealed.
      const willows = s.minions.filter(
        (m) => m.code === CREEPING_WILLOW && active(s, m),
      );
      const owner = (m: Piece) => m.engagedWith || s.activePlayerId;
      ports.queue(
        s,
        ...willows
          .filter((m) => alive(s, owner(m)))
          .map((m) => J("willow-attack", { id: m.id, playerId: owner(m) })),
        ...(willows.some((m) => owner(m) === e.playerId)
          ? []
          : [J("willow-reveal", { playerId: e.playerId })]),
      );
      break;
    }
    case "jug:willow-attack": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, e.playerId)) break;
      ports.activate(s, {
        enemyId: m.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "jug:willow-reveal": {
      if (!alive(s, e.playerId)) break;
      const [p] = ports.findCode(s, CREEPING_WILLOW, true);
      if (p) ports.reveal(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "jug:stun": {
      const target = String(e.target);
      if (target === "hero" || target.startsWith("hero:")) {
        const playerId = target.startsWith("hero:")
          ? target.slice(5)
          : e.playerId;
        if (
          alive(s, playerId) &&
          ports.canStatus(s, `hero:${playerId}`, "stunned")
        )
          ports.queue(s, {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: playerId,
          });
      } else if (ports.canStatus(s, target, "stunned"))
        ports.queue(s, { type: "status", target, status: "stunned" });
      break;
    }
    default:
      throw Error(`Unknown Juggernaut effect: ${e.type}`);
  }
  return true;
}
