import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Melee in the Mojo-seum, MojoMania's first scenario. MaGog cannot be
 * defeated: the players win by wowing the crowd as The Challengers before
 * The Champion's fans see MaGog win again. */
export const MAGOG_SCRIPT_CODES = [
  "39001a",
  "39001b",
  "39002a",
  "39002b",
  "39003a",
  "39003b",
  "39004a",
  "39004b",
  "39005",
  "39006",
  "39007",
  "39008",
  "39009",
  "39010",
  "39011",
] as const;

const MAGOG_A = "39001a";
const MAGOG_B = "39001b";
export const MELEE_IN_THE_MOJOSEUM = "39002b";
export const THE_CHAMPION = "39003a";
export const THE_CHAMPION_CHEERING = "39003b";
export const THE_CHALLENGERS = "39004a";
export const THE_CHALLENGERS_CHEERING = "39004b";
const JOLT_OF_ADRENALINE = "39005";
const SURGE_OF_AGGRESSION = "39006";
export const SURPRISE_CONTENDER = "39007";
const PUMP_UP_THE_CROWD = "39008";
const BREAK_A_LEG = "39009";
const DEFEND_THE_TITLE = "39010";
const STAGE_FRIGHT = "39011";

export type MagogCrowd = "champion" | "challengers";

export interface MagogPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  putEnvironment(s: GameState, p: Piece): void;
  makePiece(s: GameState, code: string): Piece;
  endGame(s: GameState, won: boolean, reason: string): void;
  /** Boost: "Reveal this card." The boost card is kept from the discard pile
   * and revealed as an encounter card. */
  revealBoostCard(s: GameState, p: Piece): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `magog:${type}`,
  ...args,
});
const scripted = new Set<string>(MAGOG_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const isMagog = (s: GameState) =>
  !!s.villain && [MAGOG_A, MAGOG_B].includes(s.villain.code);

export const magogScenario = (s: GameState) => s.villainId === "magog";

/** The Champion or The Challengers, on either side. */
export function magogCrowd(s: GameState, side: MagogCrowd): Piece | undefined {
  const codes =
    side === "champion"
      ? [THE_CHAMPION, THE_CHAMPION_CHEERING]
      : [THE_CHALLENGERS, THE_CHALLENGERS_CHEERING];
  return (s.environments || []).find((p) => codes.includes(p.code));
}
/** Whether a crowd is on its Cheering Crowd side. */
export function magogCheering(s: GameState, side: MagogCrowd) {
  const p = magogCrowd(s, side);
  return (
    !!p && [THE_CHAMPION_CHEERING, THE_CHALLENGERS_CHEERING].includes(p.code)
  );
}
export const magogRatings = (s: GameState, side: MagogCrowd) =>
  magogCrowd(s, side)?.counters || 0;
/** A Booing Crowd flips at 5 ratings counters per player. */
export const magogFlipAt = (s: GameState) => 5 * s.playerCount;
/** A Cheering Crowd ends the game at 10 ratings counters per player. */
export const magogFinishAt = (s: GameState) => 10 * s.playerCount;
const challengersLead = (s: GameState) =>
  magogRatings(s, "challengers") > magogRatings(s, "champion");

/** Melee in the Mojo-seum (1A) setup: The Champion and The Challengers
 * enter play with their Booing Crowd sides faceup. */
export function magogSetup(s: GameState, ports: MagogPorts) {
  for (const code of [THE_CHAMPION, THE_CHALLENGERS]) {
    const p = ports.makePiece(s, code);
    p.counters = 0;
    ports.putEnvironment(s, p);
  }
  s.scheme.threat =
    (def(MELEE_IN_THE_MOJOSEUM)?.base_threat || 0) * s.playerCount;
}

/** MaGog's Forced Interrupt: when he would be defeated, his hit points
 * reset to 10 per player instead. Returns null outside this scenario. While
 * his text box is blank nothing resets him, but the players still cannot
 * win by defeating him, so he stays in play with 0 hit points. */
export function magogVillainWouldBeDefeated(s: GameState): Effect[] | null {
  if (!magogScenario(s) || !isMagog(s)) return null;
  if (!active(s, s.villain)) {
    s.villain.hp = Math.max(0, s.villain.hp);
    return [];
  }
  const hp = (def(s.villain.code)?.health || 10) * s.playerCount;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
  s.villain.damage = 0;
  const expert = s.villain.code === MAGOG_B;
  return [
    M("ratings", { side: "challengers", n: (expert ? 2 : 3) * s.playerCount }),
    M("deal-each"),
    // Jolt of Adrenaline and Surge of Aggression: after MaGog's hit points
    // are reset.
    ...s.attachments
      .filter(
        (a) =>
          a.attachedTo === s.villain.id &&
          [JOLT_OF_ADRENALINE, SURGE_OF_AGGRESSION].includes(a.code) &&
          active(s, a),
      )
      .map((a) => M("reset-response", { id: a.id })),
  ];
}

/** Melee in the Mojo-seum's Forced Interrupt: when it would be completed,
 * 2 ratings counters per player go on The Champion and all of its threat is
 * removed instead. */
export function magogMainWouldComplete(s: GameState): Effect[] | null {
  if (!magogScenario(s) || s.scheme.code !== MELEE_IN_THE_MOJOSEUM) return null;
  s.scheme.threat = 0;
  return [M("ratings", { side: "champion", n: 2 * s.playerCount })];
}

/** Jolt of Adrenaline: MaGog gains retaliate 1 and stalwart. */
export function magogKeyword(s: GameState, p: Piece, keyword: string): number {
  if (!s.villain || p.id !== s.villain.id) return 0;
  const jolts = s.attachments.filter(
    (a) =>
      a.attachedTo === p.id && a.code === JOLT_OF_ADRENALINE && active(s, a),
  ).length;
  if (keyword === "Retaliate") return jolts;
  if (keyword === "Stalwart") return Math.min(1, jolts);
  return 0;
}

/** After MaGog or Surprise Contender attacks and damages a character. */
export function magogAttacked(
  s: GameState,
  attackerId: string,
  damaged: boolean,
): Effect[] {
  if (!damaged || over(s) || !magogScenario(s)) return [];
  if (attackerId === s.villain?.id && isMagog(s) && active(s, s.villain))
    return [
      M("ratings", { side: "champion", n: s.villain.code === MAGOG_B ? 2 : 1 }),
    ];
  const m = s.minions.find((q) => q.id === attackerId);
  return m?.code === SURPRISE_CONTENDER && active(s, m)
    ? [M("ratings", { side: "champion", n: 1 })]
    : [];
}

/** Surprise Contender's When Defeated. */
export function magogMinionDefeated(s: GameState, m: Piece): Effect[] {
  return m.code === SURPRISE_CONTENDER && !over(s) && magogScenario(s)
    ? [M("ratings", { side: "challengers", n: 2 * s.playerCount })]
    : [];
}

/** Pump Up the Crowd's When Defeated. */
export function magogSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === PUMP_UP_THE_CROWD && !over(s) && magogScenario(s)
    ? [M("ratings", { side: "challengers", n: s.playerCount })]
    : [];
}

export function magogReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === JOLT_OF_ADRENALINE || p.code === SURGE_OF_AGGRESSION)
    return [M("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const playerId = s.activePlayerId;
  switch (p.code) {
    case PUMP_UP_THE_CROWD:
      return [M("pump-up", { id: p.id })];
    case BREAK_A_LEG:
      return [M("break-a-leg", { playerId, id: p.id })];
    case DEFEND_THE_TITLE:
      return [M("defend-title", { playerId })];
    case STAGE_FRIGHT:
      return [M("stage-fright", { playerId })];
    default:
      return [];
  }
}

export function magogBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    // Boost: Reveal this card.
    case JOLT_OF_ADRENALINE:
    case SURGE_OF_AGGRESSION:
      return [M("boost-reveal", { id: p.id })];
    // Boost: You are confused.
    case STAGE_FRIGHT:
      return [
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: playerId,
        },
      ];
    default:
      return [];
  }
}

// --------------------------------------------------------------- resolver

export function resolveMagogEffect(
  s: GameState,
  e: Effect,
  ports: MagogPorts,
): boolean {
  if (!e.type.startsWith("magog:")) return false;
  switch (e.type) {
    case "magog:ratings": {
      const crowd = magogCrowd(s, e.side);
      if (over(s) || !crowd || !(e.n > 0)) break;
      crowd.counters = (crowd.counters || 0) + e.n;
      ports.log(
        s,
        `${e.n} ratings counter${e.n === 1 ? "" : "s"} on ${name(crowd)} (${crowd.counters}).`,
        e.side === "challengers" ? "good" : "bad",
      );
      const cheering = magogCheering(s, e.side);
      // A Booing Crowd flips at 5 per player, keeping its counters.
      if (!cheering && crowd.counters >= magogFlipAt(s)) {
        crowd.code =
          e.side === "champion"
            ? THE_CHAMPION_CHEERING
            : THE_CHALLENGERS_CHEERING;
        ports.log(
          s,
          `${name(crowd)} flips to its Cheering Crowd side.`,
          e.side === "challengers" ? "good" : "bad",
        );
      }
      // A Cheering Crowd ends the game at 10 per player.
      if (magogCheering(s, e.side) && crowd.counters >= magogFinishAt(s)) {
        if (e.side === "challengers")
          ports.endGame(
            s,
            true,
            "You wow the crowd as The Challengers. The players win the game.",
          );
        else
          ports.endGame(
            s,
            false,
            "The Champion's crowd cheers: MaGog wins again and the players lose the game.",
          );
        break;
      }
      if (!cheering && magogCheering(s, e.side))
        ports.queue(
          s,
          e.side === "champion"
            ? // Underdogs: each player draws 1 card.
              M("underdogs")
            : // Tag Team: Surprise Contender joins the fight.
              M("tag-team"),
        );
      break;
    }
    case "magog:underdogs":
      ports.queue(
        s,
        ...playerOrder(s)
          .filter((seat) => !seat.eliminated)
          .map((seat) => ({ type: "draw", amount: 1, actorId: seat.id })),
      );
      break;
    case "magog:tag-team": {
      const contender = s.minions.find((q) => q.code === SURPRISE_CONTENDER);
      if (contender) {
        ports.queue(s, {
          type: "status",
          target: contender.id,
          status: "tough",
        });
        break;
      }
      const found = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.code === SURPRISE_CONTENDER,
      );
      if (found && alive(s, s.firstPlayerId))
        ports.putMinion(s, found, s.firstPlayerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "magog:deal-each":
      for (const seat of playerOrder(s).filter((q) => !q.eliminated))
        ports.dealEncounter(s, seat.id);
      break;
    case "magog:reset-response": {
      const a = s.attachments.find(
        (q) => q.id === e.id && q.attachedTo === s.villain?.id,
      );
      if (!a || over(s)) break;
      ports.queue(s, M("ratings", { side: "challengers", n: s.playerCount }), {
        type: "discardPiece",
        id: a.id,
      });
      break;
    }
    case "magog:attach": {
      const p = e.piece as Piece;
      if (isMagog(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "magog:boost-reveal": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.revealBoostCard(s, p);
      break;
    }
    case "magog:pump-up": {
      const p = s.sideSchemes.find((q) => q.id === e.id);
      // An additional 1 threat per player while The Champion is cheering.
      if (p && magogCheering(s, "champion"))
        ports.queue(s, {
          type: "threat",
          target: p.id,
          amount: s.playerCount,
        });
      break;
    }
    case "magog:break-a-leg":
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: e.playerId,
        },
        M("break-damage", {
          playerId: e.playerId,
          id: e.id,
          actorId: e.playerId,
        }),
      );
      break;
    case "magog:break-damage": {
      if (!alive(s, e.playerId) || over(s)) break;
      const amount = challengersLead(s) ? 4 : 2;
      const take = (n: number): Effect[] =>
        n
          ? [
              {
                type: "damage",
                target: "hero",
                amount: n,
                source: e.id,
                actorId: e.playerId,
              },
            ]
          : [];
      if (!magogCrowd(s, "champion")) {
        ports.queue(s, ...take(amount));
        break;
      }
      // You may place ratings counters on The Champion to reduce the damage
      // by 1 for each.
      const options: Option[] = Array.from({ length: amount + 1 }, (_, k) => ({
        id: `ratings-${k}`,
        label: k
          ? `Place ${k} ratings counter${k === 1 ? "" : "s"} on The Champion · take ${amount - k} damage`
          : `Take ${amount} damage`,
        effects: [
          ...(k ? [M("ratings", { side: "champion", n: k })] : []),
          ...take(amount - k),
        ],
      }));
      ports.choose(
        s,
        name(BREAK_A_LEG),
        `You take ${amount} damage. Place ratings counters on The Champion to reduce it by 1 each?`,
        options,
      );
      break;
    }
    case "magog:defend-title": {
      if (!alive(s, e.playerId)) break;
      // When Revealed (Alter-Ego): 2 ratings counters on The Champion.
      if (seatView(s, e.playerId).player.form !== "hero") {
        ports.queue(s, M("ratings", { side: "champion", n: 2 }));
        break;
      }
      // When Revealed (Hero): MaGog attacks you.
      if (!isMagog(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: "attack",
        modifier: 0,
        after: M("title-after", { playerId: e.playerId }),
      });
      break;
    }
    case "magog:title-after":
      // If a hero defended against this attack and took no damage.
      if (e.performed && e.defendedByHero && !e.damageToHero)
        ports.queue(s, M("ratings", { side: "challengers", n: 2 }));
      break;
    case "magog:stage-fright":
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: e.playerId,
        },
        M("fright-threat"),
      );
      break;
    case "magog:fright-threat":
      ports.queue(s, {
        type: "threat",
        target: "main",
        amount: challengersLead(s) ? 4 : 2,
      });
      break;
    default:
      throw Error(`Unknown MaGog effect: ${e.type}`);
  }
  return true;
}
