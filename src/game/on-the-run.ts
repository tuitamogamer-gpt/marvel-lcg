import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** NeXt Evolution's second scenario, On the Run: one random Marauder holds
 * Hope with Hope's Captor and must be defeated twice; with the Nasty Boys
 * modular set, which joins any scenario. Mutant Slayers is required. */
export const ON_THE_RUN_SCRIPT_CODES = [
  "40103a",
  "40103b",
  "40104a",
  "40104b",
  "40105a",
  "40105b",
  "40106",
  "40107",
  "40108",
  "40109",
  "40110",
  "40111",
] as const;
export const NASTY_BOYS_CODES = [
  "40112",
  "40113",
  "40114",
  "40115",
  "40116",
  "40117",
] as const;
const MARAUDERS = [
  "40070",
  "40071",
  "40072",
  "40073",
  "40074",
  "40075",
  "40076",
] as const;
export const GOTTA_GET_AWAY = "40103b";
export const ESCAPING_WITH_HOPE = "40104b";
export const CAPTOR_CONFIDENT = "40105a";
export const CAPTOR_DESPERATE = "40105b";
export const HIDDEN_IN_THE_CLUTTER = "40106";
export const FAVORED_WEAPON = "40107";
const BUSHWHACK = "40108";
export const PURE_FORCE = "40109";
const DIZZYING_DEEDS = "40110";
const TAG_TEAM = "40111";
const GORGEOUS_GEORGE = "40112";
const HAIRBAG = "40113";
const RAMROD = "40114";
const RUCKUS = "40115";
export const SLAB = "40116";
const GET_NASTY = "40117";

export interface OnTheRunPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** The minions with this trait in the encounter deck (and discard). */
  findMinions(s: GameState, trait: string, discardToo: boolean): Piece[];
  /** Put the found minion into play engaged with the player (or reveal
   * it), then shuffle the encounter deck. */
  putFound(
    s: GameState,
    p: Piece | undefined,
    playerId: string,
    reveal: boolean,
  ): void;
  /** Advance the main scheme to its next stage. */
  advanceMain(s: GameState): void;
  allies(s: GameState, playerId: string): Piece[];
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
  endGame(s: GameState, won: boolean, reason: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece | string) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const OT = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `otr:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const onTheRun = (s: GameState) => s.villainId === "on_the_run";
const marauderMinion = (p: Piece) => traits(p).includes("Marauder");
const nastyBoy = (p: Piece) => traits(p).includes("Nasty Boy");
const enemies = (s: GameState) =>
  [s.villain, ...s.minions].filter(Boolean) as Piece[];
const enemyNamed = (s: GameState, title: string) =>
  enemies(s).some((p) => name(p) === title);

/** Hope's Captor attached to the villain, on either side. */
export function otrCaptor(s: GameState): Piece | undefined {
  return s.attachments.find(
    (a) =>
      (a.code === CAPTOR_CONFIDENT || a.code === CAPTOR_DESPERATE) &&
      a.attachedTo === s.villain?.id,
  );
}

// ------------------------------------------------------------------- setup

/** Gotta Get Away (1A): one random Marauder is the villain, the minion with
 * its title leaves the game, and Hope's Captor attaches Confident side up. */
export function otrSetup(
  s: GameState,
  ports: Pick<OnTheRunPorts, "shuffle"> & {
    makePiece(s: GameState, code: string): Piece;
    installVillain(s: GameState, p: Piece): void;
    pick(s: GameState, n: number): number;
  },
) {
  const side = s.difficulty === "expert" ? "b" : "a";
  const code = `${MARAUDERS[ports.pick(s, MARAUDERS.length)]}${side}`;
  ports.installVillain(s, ports.makePiece(s, code));
  const twin = s.encounter.deck.find(
    (p) => def(p)?.type_code === "minion" && name(p) === name(code),
  );
  if (twin) {
    s.encounter.deck = s.encounter.deck.filter((p) => p !== twin);
    s.removed.push(twin);
  }
  const captor = ports.makePiece(s, CAPTOR_CONFIDENT);
  captor.attachedTo = s.villain.id;
  s.attachments.push(captor);
  const main = def(GOTTA_GET_AWAY);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
}
/** Gotta Get Away (1B) When Revealed: each player searches the encounter
 * deck for a Marauder minion. */
export function otrSetupEffects(s: GameState): Effect[] {
  return onTheRun(s)
    ? playerOrder(s).map((seat) =>
        OT("search", { playerId: seat.id, actorId: seat.id }),
      )
    : [];
}

// --------------------------------------------------------------- villain

/** Hope's Captor (Confident): instead of being defeated, the villain's hit
 * points reset and the Captor flips to Desperate, advancing the main
 * scheme. Escaping with Hope: defeating the villain wins. */
export function otrVillainWouldBeDefeated(
  s: GameState,
): "reset" | "won" | null {
  if (!onTheRun(s)) return null;
  const captor = otrCaptor(s);
  if (captor?.code === CAPTOR_CONFIDENT && active(s, captor)) return "reset";
  return "won";
}
export function otrResetEffects(s: GameState): Effect[] {
  const captor = otrCaptor(s);
  if (!captor) return [];
  // Reset to the printed hit points, then flip and reveal Desperate.
  const printed = (def(s.villain)?.health || 0) * s.playerCount;
  s.villain.hp = printed;
  s.villain.maxHp = printed;
  captor.code = CAPTOR_DESPERATE;
  // Desperate: the villain gets +6 hit points per player.
  s.villain.maxHp += 6 * s.playerCount;
  s.villain.hp += 6 * s.playerCount;
  return [OT("desperate", { actorId: s.firstPlayerId })];
}
/** Hope's Captor: when the villain would attack you while a Marauder
 * minion is engaged with you, it schemes instead. */
export function otrSchemesInstead(s: GameState, enemyId: string): boolean {
  const captor = otrCaptor(s);
  if (!captor || enemyId !== s.villain?.id || !active(s, captor)) return false;
  return s.minions.some(
    (m) =>
      marauderMinion(m) &&
      (m.engagedWith || s.activePlayerId) === s.activePlayerId,
  );
}
/** Gotta Get Away is lost when completed. */
export const otrMainLoses = (s: GameState) =>
  onTheRun(s) && s.scheme.code === GOTTA_GET_AWAY;

// ------------------------------------------------------------ keywords

export function otrKeyword(s: GameState, p: Piece, keyword: string): number {
  const minion = s.minions.some((m) => m.id === p.id);
  // Escaping with Hope: each Marauder minion gains guard.
  if (
    keyword === "Guard" &&
    minion &&
    marauderMinion(p) &&
    onTheRun(s) &&
    s.scheme.code === ESCAPING_WITH_HOPE
  )
    return 1;
  // Favored Weapon: overkill, piercing and ranged.
  if (
    ["Overkill", "Piercing", "Ranged"].includes(keyword) &&
    s.attachments.some(
      (a) => a.attachedTo === p.id && a.code === FAVORED_WEAPON && active(s, a),
    )
  )
    return 1;
  // Ramrod's attacks gain piercing.
  if (keyword === "Piercing" && p.code === RAMROD && minion && active(s, p))
    return 1;
  return 0;
}
/** Steady for each Marauder minion on both main schemes, and for the
 * villain in expert mode on Escaping with Hope. */
export function otrStatusModifiers(
  s: GameState,
  p: Piece,
): { steady?: boolean } {
  if (!onTheRun(s)) return {};
  const minion = s.minions.some((m) => m.id === p.id);
  if (
    minion &&
    marauderMinion(p) &&
    [GOTTA_GET_AWAY, ESCAPING_WITH_HOPE].includes(s.scheme.code)
  )
    return { steady: true };
  if (
    p.id === s.villain?.id &&
    s.difficulty === "expert" &&
    s.scheme.code === ESCAPING_WITH_HOPE
  )
    return { steady: true };
  return {};
}
/** Get Nasty: each minion gets +1 ATK. */
export function otrAttackBonus(s: GameState, p: Piece): number {
  if (!s.minions.some((m) => m.id === p.id)) return 0;
  return s.sideSchemes.filter((q) => q.code === GET_NASTY && active(s, q))
    .length;
}
/** Pure Force gains crisis while Blockbuster is in play and amplify while
 * Chimera is. */
export function otrSchemeIcon(
  s: GameState,
  p: Piece,
  icon: "scheme_crisis" | "scheme_amplify",
): number {
  if (p.code !== PURE_FORCE || !active(s, p)) return 0;
  return enemyNamed(s, icon === "scheme_crisis" ? "Blockbuster" : "Chimera")
    ? 1
    : 0;
}
export const otrAmplify = (s: GameState) =>
  s.sideSchemes.reduce((n, p) => n + otrSchemeIcon(s, p, "scheme_amplify"), 0);

/** Hidden in the Clutter takes the damage that would be dealt to the
 * attached enemy; at 3 the enemy attacks the player who dealt it. */
export function otrDamageReplaced(
  s: GameState,
  target: string,
  n: number,
  playerId: string,
): { amount: number; effects: Effect[] } {
  const clutter = s.attachments.find(
    (a) =>
      a.attachedTo === target &&
      a.code === HIDDEN_IN_THE_CLUTTER &&
      active(s, a),
  );
  if (!clutter || n <= 0) return { amount: n, effects: [] };
  clutter.damage = (clutter.damage || 0) + n;
  return {
    amount: 0,
    effects:
      clutter.damage >= 3
        ? [
            OT("clutter-attack", { enemyId: target, playerId }),
            { type: "discardPiece", id: clutter.id },
          ]
        : [],
  };
}
/** Teamwork (Nasty Boy): the entrant activates if another Nasty Boy is in
 * play (RRG 1.8). */
export function otrEngaged(s: GameState, p: Piece): Effect[] {
  if (!nastyBoy(p) || !active(s, p)) return [];
  return [OT("teamwork", { id: p.id })];
}
/** Gorgeous George and Slab's Forced Interrupts when they attack. */
export function otrAttackInitiated(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === attackerId);
  if (!p || !active(s, p) || !s.attack) return [];
  if (p.code === GORGEOUS_GEORGE)
    return [OT("exhaust-one", { playerId, actorId: playerId })];
  if (p.code === SLAB) return [OT("slab", { id: p.id })];
  return [];
}
/** Favored Weapon's Hero Response: after your hero defends against an
 * attack from the attached enemy and takes no damage. */
export function otrAttacked(
  s: GameState,
  attackerId: string,
  defendedByHero: boolean,
  damage: number,
  playerId: string,
): Effect[] {
  if (!defendedByHero || damage > 0) return [];
  const weapon = s.attachments.find(
    (a) =>
      a.attachedTo === attackerId && a.code === FAVORED_WEAPON && active(s, a),
  );
  return weapon
    ? [OT("weapon-offer", { id: weapon.id, playerId, actorId: playerId })]
    : [];
}
export function otrSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === BUSHWHACK && active(s, p)
    ? [
        OT("search", {
          playerId: s.activePlayerId,
          discardToo: true,
          actorId: s.activePlayerId,
        }),
      ]
    : [];
}

// ---------------------------------------------------------- reveal/boost

export function otrReveal(s: GameState, p: Piece): Effect[] | null {
  const code = p.code;
  if (
    !(ON_THE_RUN_SCRIPT_CODES as readonly string[]).includes(code) &&
    !(NASTY_BOYS_CODES as readonly string[]).includes(code)
  )
    return null;
  const playerId = s.activePlayerId;
  if (code === HIDDEN_IN_THE_CLUTTER)
    return [OT("attach-weakest", { piece: p })];
  if (code === FAVORED_WEAPON) return [OT("attach-weapon", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (code) {
    case DIZZYING_DEEDS:
      return [OT("dizzying", { playerId })];
    case TAG_TEAM:
      return [OT("tag-team", { playerId })];
    case RUCKUS:
      return [OT("ruckus", { playerId })];
    case GET_NASTY:
      return [OT("get-nasty", { id: p.id, playerId })];
    default:
      return [];
  }
}
export function otrBoost(s: GameState, p: Piece): Effect[] | null {
  if (![GORGEOUS_GEORGE, HAIRBAG, RAMROD, RUCKUS].includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case GORGEOUS_GEORGE:
      return [OT("exhaust-one", { playerId, actorId: playerId })];
    case HAIRBAG:
      return [OT("hairbag", { id: p.id })];
    case RAMROD:
      return s.attack && s.attack.attacker === s.villain?.id
        ? [OT("piercing")]
        : [];
    case RUCKUS:
      return [
        { type: "status", target: `hero:${playerId}`, status: "stunned" },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------- resolver

export function resolveOnTheRunEffect(
  s: GameState,
  e: Effect,
  ports: OnTheRunPorts,
): boolean {
  if (!e.type.startsWith("otr:")) return false;
  switch (e.type) {
    case "otr:search":
    case "otr:nasty-search": {
      if (!alive(s, e.playerId) || over(s)) break;
      const nasty = e.type === "otr:nasty-search";
      const found = ports.findMinions(
        s,
        nasty ? "Nasty Boy" : "Marauder",
        nasty || !!e.discardToo,
      );
      const titles = [...new Map(found.map((p) => [p.code, p])).values()];
      if (titles.length <= 1) ports.putFound(s, titles[0], e.playerId, nasty);
      else
        ports.choose(
          s,
          nasty ? name(GET_NASTY) : "Search the encounter deck",
          `Choose the ${nasty ? "Nasty Boy" : "Marauder"} minion.`,
          titles.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: [
              OT("put", { id: p.id, playerId: e.playerId, reveal: nasty }),
            ],
          })),
        );
      break;
    }
    case "otr:put": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      ports.putFound(s, p, e.playerId, !!e.reveal);
      break;
    }
    case "otr:desperate": {
      // Desperate When Revealed: advance the main scheme to stage 2A.
      ports.log(
        s,
        `${name(s.villain)} would be defeated: Hope's Captor turns Desperate.`,
        "good",
      );
      if (s.scheme.code !== GOTTA_GET_AWAY) break;
      ports.advanceMain(s);
      ports.queue(s, OT("escaping", { actorId: s.firstPlayerId }));
      break;
    }
    case "otr:escaping": {
      // Escaping with Hope (2A): each player finds a Marauder minion, then
      // each Marauder enemy gets a tough status card.
      ports.queue(
        s,
        ...playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .map((seat) =>
            OT("search", {
              playerId: seat.id,
              discardToo: true,
              actorId: seat.id,
            }),
          ),
        OT("tough-marauders"),
      );
      break;
    }
    case "otr:tough-marauders":
      ports.queue(
        s,
        ...enemies(s)
          .filter(
            (p) =>
              (p.id === s.villain?.id || marauderMinion(p)) &&
              ports.canStatus(s, p.id, "tough"),
          )
          .map((p) => ({ type: "status", target: p.id, status: "tough" })),
      );
      break;
    case "otr:attach-weakest": {
      const p = e.piece as Piece;
      const all = enemies(s);
      const least = Math.min(...all.map((q) => ports.remainingHp(s, q)));
      const tied = all.filter((q) => ports.remainingHp(s, q) === least);
      if (tied.length === 1) ports.attach(s, p, tied[0].id);
      else
        ports.choose(
          s,
          name(p),
          "Attach to the enemy with the fewest remaining hit points.",
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [OT("attach-to", { piece: p, target: q.id })],
          })),
        );
      break;
    }
    case "otr:attach-weapon": {
      // Greycrow or Harpoon, otherwise the Marauder enemy with the lowest
      // ATK.
      const p = e.piece as Piece;
      const named = enemies(s).filter((q) =>
        ["Greycrow", "Harpoon"].includes(name(q)),
      );
      const marauders = enemies(s).filter((q) =>
        traits(q).includes("Marauder"),
      );
      let pool = named;
      if (!pool.length && marauders.length) {
        const low = Math.min(
          ...marauders.map((q) => ports.enemyStat(s, q, "attack")),
        );
        pool = marauders.filter((q) => ports.enemyStat(s, q, "attack") === low);
      }
      if (!pool.length) {
        ports.discardPiece(s, p.id);
        break;
      }
      if (pool.length === 1) ports.attach(s, p, pool[0].id);
      else
        ports.choose(
          s,
          name(p),
          "Choose the enemy Favored Weapon attaches to.",
          pool.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [OT("attach-to", { piece: p, target: q.id })],
          })),
        );
      break;
    }
    case "otr:attach-to":
      ports.attach(s, e.piece as Piece, e.target);
      break;
    case "otr:clutter-attack": {
      if (!alive(s, e.playerId) || over(s)) break;
      if (!enemies(s).some((q) => q.id === e.enemyId)) break;
      ports.activate(s, {
        enemyId: e.enemyId,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "otr:weapon-offer":
      if (!s.attachments.some((a) => a.id === e.id)) break;
      ports.choose(
        s,
        name(FAVORED_WEAPON),
        "Your hero defended and took no damage: discard Favored Weapon?",
        [
          {
            id: "discard",
            label: "Discard Favored Weapon",
            effects: [{ type: "discardPiece", id: e.id }],
          },
          { id: "pass", label: "Do not respond", effects: [] },
        ],
      );
      break;
    case "otr:dizzying": {
      // Exhaust a character you control; then the named enemies' effects.
      if (!alive(s, e.playerId)) break;
      const then: Effect[] = [];
      if (enemyNamed(s, "Arclight"))
        then.push(
          OT("status-one", { playerId: e.playerId, status: "stunned" }),
        );
      if (enemyNamed(s, "Riptide"))
        then.push(OT("indirect", { playerId: e.playerId, n: 3 }));
      if (enemyNamed(s, "Vertigo"))
        then.push(
          OT("status-one", { playerId: e.playerId, status: "confused" }),
        );
      ports.queue(s, OT("exhaust-one", { playerId: e.playerId }), ...then);
      break;
    }
    case "otr:exhaust-one": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      const options: Option[] = [];
      if (!view.player.exhausted)
        options.push({
          id: "hero",
          label: `Exhaust ${ports.heroName(s, e.playerId)}`,
          effects: [{ type: "exhaust", id: "hero", actorId: e.playerId }],
        });
      for (const q of ports.allies(s, e.playerId).filter((x) => !x.exhausted))
        options.push({
          id: q.id,
          label: `Exhaust ${name(q)}`,
          image: q.code,
          effects: [{ type: "exhaust", id: q.id }],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(
          s,
          "Exhaust a character",
          "Exhaust a character you control.",
          options,
        );
      break;
    }
    case "otr:status-one": {
      if (!alive(s, e.playerId)) break;
      const targets = [
        `hero:${e.playerId}`,
        ...ports.allies(s, e.playerId).map((p) => p.id),
      ].filter((t) => ports.canStatus(s, t, e.status));
      const status = { type: "status", status: e.status };
      if (targets.length === 1)
        ports.queue(s, { ...status, target: targets[0] });
      else if (targets.length)
        ports.choose(
          s,
          name(DIZZYING_DEEDS),
          `${e.status === "stunned" ? "Stun" : "Confuse"} a character you control.`,
          targets.map((t) => ({
            id: t,
            label: t.startsWith("hero:")
              ? ports.heroName(s, t.slice(5))
              : name(ports.allies(s, e.playerId).find((p) => p.id === t)!),
            effects: [{ ...status, target: t }],
          })),
        );
      break;
    }
    case "otr:indirect":
      ports.indirect(s, e.playerId, e.n, DIZZYING_DEEDS, name(DIZZYING_DEEDS));
      break;
    case "otr:tag-team": {
      if (!alive(s, e.playerId)) break;
      const engaged = s.minions.filter(
        (m) =>
          marauderMinion(m) &&
          (m.engagedWith || s.activePlayerId) === e.playerId,
      );
      ports.choose(s, name(TAG_TEAM), "Choose one.", [
        {
          id: "activate",
          label: `Each Marauder minion engaged with you activates (${engaged.length})`,
          effects: engaged.map((m) =>
            OT("activate", { id: m.id, playerId: e.playerId }),
          ),
        },
        {
          id: "discard",
          label:
            "Discard 7 encounter cards; the topmost Marauder minion in the discard pile engages you",
          effects: [OT("tag-discard", { playerId: e.playerId })],
        },
      ]);
      break;
    }
    case "otr:activate": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, e.playerId)) break;
      ports.activate(s, {
        enemyId: m.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "otr:tag-discard": {
      for (let i = 0; i < 7; i++) {
        const { emptied } = ports.discardTop(s);
        if (emptied) break;
      }
      const discard = s.encounter.discard;
      for (let i = discard.length - 1; i >= 0; i--)
        if (
          def(discard[i])?.type_code === "minion" &&
          marauderMinion(discard[i])
        ) {
          ports.putMinion(s, discard[i], e.playerId);
          break;
        }
      break;
    }
    case "otr:ruckus": {
      // Ruckus When Revealed: stun each character you control.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        ...[
          `hero:${e.playerId}`,
          ...ports.allies(s, e.playerId).map((p) => p.id),
        ]
          .filter((t) => ports.canStatus(s, t, "stunned"))
          .map((t) => ({ type: "status", target: t, status: "stunned" })),
      );
      break;
    }
    case "otr:get-nasty": {
      // Get Nasty When Revealed: 1 threat for each minion (2 for each
      // Nasty Boy), then a Nasty Boy is revealed.
      const n = s.minions.reduce((sum, m) => sum + (nastyBoy(m) ? 2 : 1), 0);
      if (n) ports.queue(s, { type: "threat", target: e.id, amount: n });
      ports.queue(s, OT("nasty-search", { playerId: e.playerId }));
      break;
    }
    case "otr:teamwork": {
      const live = s.minions.filter((m) => !m.pendingDefeat && nastyBoy(m));
      const entered = live.find((m) => m.id === e.id);
      if (!entered || !active(s, entered) || live.length < 2) break;
      ports.queue(
        s,
        OT("activate", {
          id: entered.id,
          playerId: entered.engagedWith || s.activePlayerId,
        }),
      );
      break;
    }
    case "otr:slab": {
      // Slab: a growth counter, then +1 ATK for each for this attack.
      const p = s.minions.find((m) => m.id === e.id);
      const a = s.attack;
      if (!p || !a || a.attacker !== p.id) break;
      p.counters = (p.counters || 0) + 1;
      const atk = p.counters;
      a.modifier = (a.modifier || 0) + atk;
      const carry = (q: Effect) => {
        if (
          q.type === "enemyAttackInitiationWindow" &&
          q.attacker === p.id &&
          typeof q.modifier === "number"
        )
          q.modifier += atk;
        for (const next of (q.after as Effect[] | undefined) || []) carry(next);
      };
      for (const q of s.queue) carry(q);
      break;
    }
    case "otr:hairbag": {
      // After this activation, shuffle Hairbag into the encounter deck.
      const activation = s.attack || s.scheming;
      if (activation)
        (activation.afterActivation ||= []).push(
          OT("hairbag-shuffle", { id: e.id }),
        );
      break;
    }
    case "otr:hairbag-shuffle": {
      const zones = [s.resolving, s.encounter.discard];
      for (const zone of zones) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i < 0) continue;
        const [p] = zone.splice(i, 1);
        s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, p]);
        delete s.encounter.knownTop;
        ports.log(s, "Hairbag is shuffled into the encounter deck.", "bad");
        break;
      }
      break;
    }
    case "otr:piercing":
      if (s.attack) s.attack.piercing = true;
      break;
    default:
      throw Error(`Unknown On the Run effect: ${e.type}`);
  }
  return true;
}
