import { isTextBlank } from "./card-text.js";
import type { Effect, GameState, Piece } from "./types.js";
import type { StatusModifiers } from "./keywords.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };

export const ARMADILLO_SCRIPT_CODES = [
  "28028",
  "28029",
  "28030",
  "28031",
  "28032",
] as const;
const names = new Map(catalog.map((c) => [c.code, c.name]));
const A = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `armadillo:${name}`,
  ...args,
});
export interface ArmadilloPorts extends Pick<
  MutagenEnginePorts,
  "queue" | "choose" | "putMinion" | "attach" | "shuffleEncounter" | "activate"
> {
  /** True only when an actual new status card was given. */
  giveTough(s: GameState, id: string): boolean;
}

/** Existing Tough cards remain on a blanked Armadillo; only new grants use
 * the normal one-card ceiling while his printed permission is inactive. */
export function armadilloStatusModifiers(
  s: GameState,
  p: Piece,
): StatusModifiers {
  return p.code === "28029" && !isTextBlank(s, p)
    ? { toughLimit: Number.MAX_SAFE_INTEGER }
    : {};
}
export function armadilloAttackBonus(s: GameState, p: Piece): number {
  return p.tough
    ? 3 *
        s.sideSchemes.filter((x) => x.code === "28028" && !isTextBlank(s, x))
          .length
    : 0;
}
/** The attachment's printed +2 ATK is handled by ordinary numeric metadata;
 * blanking its text removes this restriction without removing that stat. */
export function armadilloDefenseBlocked(
  s: GameState,
  enemyId: string,
): boolean {
  const p = s.minions.find((x) => x.id === enemyId && x.code === "28029");
  return (
    !!p?.tough &&
    s.attachments.some(
      (x) => x.code === "28030" && x.attachedTo === p.id && !isTextBlank(s, x),
    )
  );
}
export function armadilloActivationResponses(
  s: GameState,
  enemyId: string,
): MutagenForcedResponse[] {
  const p = s.minions.find((x) => x.id === enemyId && x.code === "28029");
  return p && !isTextBlank(s, p)
    ? [
        {
          id: `${p.id}:armadillo-tough`,
          sourceId: p.id,
          title: "Armadillo",
          effects: [A("activated", { id: p.id })],
        },
      ]
    : [];
}
export function armadilloReveal(s: GameState, p: Piece): Effect[] | null {
  const actorId = s.activePlayerId;
  switch (p.code) {
    case "28028":
    case "28029":
      return [];
    case "28030":
      return [A("rollin", { piece: p, actorId })];
    case "28031":
      return [
        A("tumble", {
          actorId,
          playerId: actorId,
          done: [],
          performed: false,
          kind: s.player.form === "hero" ? "attack" : "scheme",
        }),
      ];
    case "28032":
      return [A("tough-it-out", { actorId })];
    default:
      return null;
  }
}
export function resolveArmadilloEffect(
  s: GameState,
  e: Effect,
  ports: ArmadilloPorts,
): boolean {
  if (!e.type.startsWith("armadillo:")) return false;
  switch (e.type) {
    case "armadillo:activated": {
      const p = s.minions.find((x) => x.id === e.id && x.code === "28029");
      if (p && !isTextBlank(s, p)) ports.giveTough(s, p.id);
      break;
    }
    case "armadillo:rollin": {
      let p = s.minions.find((x) => x.code === "28029");
      if (!p) {
        p = [...s.encounter.deck, ...s.encounter.discard].find(
          (x) => x.code === "28029",
        );
        if (p) ports.putMinion(s, p, s.activePlayerId);
        ports.shuffleEncounter(s);
        p = s.minions.find((x) => x.code === "28029");
      }
      if (p) ports.attach(s, e.piece, p.id);
      break;
    }
    case "armadillo:tough-it-out": {
      let given = Number(ports.giveTough(s, s.villain.id));
      const p = s.minions.find((x) => x.code === "28029");
      if (p) given += Number(ports.giveTough(s, p.id));
      if (given <= 1)
        ports.queue(s, { type: "surge", actorId: s.activePlayerId });
      break;
    }
    case "armadillo:tumble": {
      if (!s.players.some((x) => x.id === e.playerId && !x.eliminated)) break;
      const enemies = [s.villain, ...s.minions].filter(
        (p) => p.tough && !e.done.includes(p.id),
      );
      if (!enemies.length) {
        if (!e.performed)
          ports.queue(s, { type: "surge", actorId: e.playerId });
        break;
      }
      const options = enemies.map((p) => ({
        id: p.id,
        label: names.get(p.code) || p.code,
        image: p.code,
        effects: [
          A("tumble-activate", {
            enemyId: p.id,
            playerId: e.playerId,
            kind: e.kind,
            done: [...e.done, p.id],
            priorPerformed: e.performed,
            actorId: e.playerId,
          }),
        ],
      }));
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else
        ports.choose(
          s,
          "Tough and Tumble · enemy order",
          "Choose the next enemy with Tough. Finish its whole activation before the next.",
          options,
        );
      break;
    }
    case "armadillo:tumble-activate": {
      const after = { ...e, type: "armadillo:tumble-after" };
      if (![s.villain, ...s.minions].some((p) => p.id === e.enemyId && p.tough))
        ports.queue(s, { ...after, performed: false });
      else
        ports.activate(s, {
          enemyId: e.enemyId,
          playerId: e.playerId,
          kind: e.kind,
          modifier: 0,
          after,
        });
      break;
    }
    case "armadillo:tumble-after":
      ports.queue(
        s,
        A("tumble", {
          playerId: e.playerId,
          kind: e.kind,
          done: e.done,
          performed: !!e.priorPerformed || !!e.performed,
          actorId: e.playerId,
        }),
      );
      break;
    default:
      throw Error(`Unknown Armadillo effect: ${e.type}`);
  }
  return true;
}
