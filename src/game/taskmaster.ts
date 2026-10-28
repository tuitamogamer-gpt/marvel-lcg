import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { controller, playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

export const TASKMASTER_SCRIPT_CODES = [
  "04093",
  "04094",
  "04095",
  "04096a",
  "04096b",
  "04097",
  "04098",
  "04099",
  "04100",
  "04101",
  "04102",
  "04103",
  "04104",
  "04105",
  "04106",
  "04107",
  "04108",
] as const;
export const TASKMASTER_CAPTIVES = ["04097", "04098", "04099", "04100"];
export interface TaskmasterState {
  currentMain: Piece;
  villainDeck: Piece[];
  captives: Piece[];
  revealedCaptures?: string[];
}
const definitions = new Map(catalog.map((c) => [c.code, c]));
const T = (name: string, fields: Record<string, unknown> = {}): Effect => ({
  type: `taskmaster:${name}`,
  ...fields,
});
const active = (s: GameState) =>
  ["04093", "04094", "04095"].includes(s.villain.code);
export interface TaskmasterPorts extends MutagenEnginePorts {
  random(s: GameState): number;
  revealHidden(s: GameState): void;
  mill(s: GameState, n: number): Piece[];
  countBoostIcons(
    s: GameState,
    p: Piece[],
    after: Effect[],
    title: string,
  ): void;
}
export function taskmasterKeyword(
  s: GameState,
  p: Piece,
  name: string,
): number {
  if (
    p.code === "04101" &&
    !isTextBlank(s, p) &&
    ["Piercing", "Ranged"].includes(name)
  )
    return 1;
  if (p.id !== s.villain.id || !active(s)) return 0;
  const code =
    name === "Piercing" ? "04102" : name === "Retaliate" ? "04103" : "";
  return s.attachments.filter(
    (a) => a.code === code && a.attachedTo === p.id && !isTextBlank(s, a),
  ).length;
}
export function taskmasterReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(TASKMASTER_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  if (["04102", "04103", "04104"].includes(p.code))
    return [T("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04094":
    case "04095":
      return [T("deal-each")];
    case "04105":
      return [T("mimicry", { hero: s.player.form === "hero" })];
    case "04106":
      return playerOrder(s)
        .filter((p) => seatView(s, p).player.form === "hero")
        .flatMap((p) => [
          {
            type: "damage",
            target: "hero",
            amount: 1,
            source: p.id,
            actorId: p.id,
          },
          { type: "randomDiscard", actorId: p.id },
        ]);
    case "04107":
      return [T("capture", { id: p.id })];
    default:
      return [];
  }
}
export function taskmasterBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== "04101") return null;
  return s.player.form === "hero"
    ? [{ type: "damage", target: "hero", amount: 1, source: p.id }]
    : [{ type: "threat", target: "main", amount: 1 }];
}
export function taskmasterFormChanged(s: GameState): Effect[] {
  return active(s) && s.player.form === "hero" && !isTextBlank(s, s.villain)
    ? [T("form", { playerId: s.activePlayerId })]
    : [];
}
export function taskmasterStepOne(s: GameState): Effect[] {
  if (!s.taskmaster || isTextBlank(s, s.taskmaster.currentMain)) return [];
  return playerOrder(s)
    .filter((p) => seatView(s, p).player.form === "hero")
    .map((p) => T("step-one", { actorId: p.id }));
}
export function taskmasterAllyEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
): Effect[] | null {
  if (!TASKMASTER_CAPTIVES.includes(p.code)) return null;
  return fromHand && !isTextBlank(s, p)
    ? [T("ally-response", { code: p.code, id: p.id })]
    : [];
}
export function taskmasterActions(s: GameState, p: Piece): Option[] {
  if (
    !["04102", "04103"].includes(p.code) ||
    s.player.form !== "hero" ||
    s.player.exhausted ||
    isTextBlank(s, p) ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  return [
    {
      id: "remove",
      label: `Exhaust hero and spend mental + physical · discard ${definitions.get(p.code)!.name}`,
      image: p.code,
      effects: [T("remove", { id: p.id })],
    },
  ];
}
/** The delayed rescue is installed by When Revealed and survives later blanking. */
export function taskmasterSchemeDefeated(s: GameState, p: Piece): boolean {
  if (p.code !== "04107" || !s.taskmaster?.revealedCaptures?.includes(p.id))
    return false;
  s.taskmaster!.revealedCaptures = s.taskmaster!.revealedCaptures!.filter(
    (id) => id !== p.id,
  );
  const seat = seatView(s, s.activePlayerId);
  for (const ally of p.captured?.splice(0) || []) {
    ally.ownerId = s.activePlayerId;
    seat.player.hand.push(ally);
  }
  s.sideSchemes = s.sideSchemes.filter((q) => q.id !== p.id);
  s.removed.push(p);
  return true;
}
/** A single attachment handles all packets of one attack, even after discarding.
 * A second copy cannot trigger for another packet of that same attack. */
export function taskmasterReflect(
  s: GameState,
  target: string,
  attack: boolean,
  source: string,
): string | undefined {
  if (target !== s.villain.id || !active(s)) return;
  // Redirecting an enemy attack does not make it a player attack. A player
  // controlled ally still qualifies when it uses the same native machinery.
  if (
    s.attack?.attacker === source &&
    s.attack.originalTarget === target &&
    !controller(s, source)
  )
    return;
  const token = s.currentAttackProgramId || s.currentEventId;
  if (
    !attack &&
    (!token || s.flags[`taskmasterAttackSource:${token}`] !== source)
  )
    return;
  const key = token ? `taskmasterReflex:${token}` : undefined;
  if (key && typeof s.flags[key] === "string") return s.flags[key] as string;
  const p = s.attachments.find(
    (p) => p.code === "04104" && p.attachedTo === target && !isTextBlank(s, p),
  );
  if (p && key) s.flags[key] = p.id;
  return p?.id;
}
export function resolveTaskmasterEffect(
  s: GameState,
  e: Effect,
  ports: TaskmasterPorts,
): boolean {
  if (!e.type.startsWith("taskmaster:")) return false;
  switch (e.type) {
    case "taskmaster:deal-each":
      for (const p of playerOrder(s)) ports.dealEncounter(s, p.id);
      break;
    case "taskmaster:attach":
      if (active(s)) ports.attach(s, e.piece, s.villain.id);
      break;
    case "taskmaster:form": {
      const p = ports.discardTop(s).piece;
      ports.countBoostIcons(
        s,
        p ? [p] : [],
        [T("form-damage", { playerId: e.playerId, actorId: e.playerId })],
        "Taskmaster",
      );
      break;
    }
    case "taskmaster:form-damage":
      ports.queue(s, {
        type: "damage",
        target: "hero",
        amount: e.boostTotal || 0,
        source: s.villain.id,
        actorId: e.playerId,
      });
      break;
    case "taskmaster:step-one":
      ports.choose(
        s,
        "Hunting Down Heroes",
        "Place 1 threat on the main scheme or take 1 damage.",
        [
          {
            id: "threat",
            label: "Place 1 threat",
            effects: [{ type: "threat", target: "main", amount: 1 }],
          },
          {
            id: "damage",
            label: "Take 1 damage",
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: 1,
                source: s.taskmaster!.currentMain.id,
              },
            ],
          },
        ],
      );
      break;
    case "taskmaster:mimicry": {
      const discarded = ports.mill(s, 5);
      if (
        discarded.some((p) =>
          definitions
            .get(p.code)
            ?.traits?.split(/\.\s*/)
            .includes(e.hero ? "Attack" : "Thwart"),
        )
      )
        ports.queue(
          s,
          T("activate", { hero: e.hero, playerId: s.activePlayerId }),
        );
      break;
    }
    case "taskmaster:activate":
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.hero ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    case "taskmaster:capture": {
      const p = s.sideSchemes.find((p) => p.id === e.id);
      if (!p) break;
      if (
        s.taskmaster &&
        !(s.taskmaster.revealedCaptures ||= []).includes(p.id)
      )
        s.taskmaster.revealedCaptures.push(p.id);
      const cards = s.taskmaster?.captives;
      if (cards?.length) {
        ports.revealHidden(s);
        (p.captured ||= []).push(
          cards.splice(Math.floor(ports.random(s) * cards.length), 1)[0],
        );
      }
      break;
    }
    case "taskmaster:remove": {
      const p = s.attachments.find((p) => p.id === e.id);
      if (
        !p ||
        !taskmasterActions(s, p).length ||
        !ports.canPay(s, 2, ["mental", "physical"])
      )
        throw Error(
          "Exhaust a ready hero and spend mental and physical resources.",
        );
      ports.pay(
        s,
        2,
        ["mental", "physical"],
        [T("remove-paid", { id: p.id })],
        definitions.get(p.code)!.name,
        true,
      );
      break;
    }
    case "taskmaster:remove-paid":
      s.player.exhausted = true;
      ports.discardPiece(s, e.id);
      break;
    case "taskmaster:ally-response": {
      const requirements: Record<string, Resource> = {
        "04097": "wild",
        "04098": "energy",
        "04099": "mental",
        "04100": "physical",
      };
      const requirement = requirements[e.code];
      if (!ports.canPay(s, 1, [requirement])) break;
      ports.choose(
        s,
        definitions.get(e.code)!.name,
        `Spend a ${requirement} resource to use the response?`,
        [
          {
            id: "use",
            label: `Spend ${requirement}`,
            effects: [T("ally-pay", { code: e.code, id: e.id, requirement })],
          },
          { id: "pass", label: "Continue without the response", effects: [] },
        ],
      );
      break;
    }
    case "taskmaster:ally-pay": {
      const effect: Effect =
        e.code === "04097"
          ? { type: "draw", amount: 2 }
          : e.code === "04098"
            ? {
                type: "target",
                group: "enemy",
                title: "Shang-Chi",
                action: { type: "status", status: "stunned" },
              }
            : e.code === "04099"
              ? {
                  type: "target",
                  group: "scheme",
                  title: "White Tiger",
                  action: { type: "thwart", amount: 3, source: e.id },
                }
              : {
                  type: "target",
                  group: "enemy",
                  title: "Elektra",
                  action: { type: "damage", amount: 3, source: e.id },
                };
      ports.pay(
        s,
        1,
        [e.requirement],
        [effect],
        definitions.get(e.code)!.name,
        true,
      );
      break;
    }
    default:
      throw Error(`Unknown Taskmaster effect: ${e.type}`);
  }
  return true;
}
