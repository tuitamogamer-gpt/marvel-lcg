import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { AntManPackTarget } from "./ant-man-pack.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("gamora-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );
const traits = (c?: Card) => (c?.traits || "").split(/\.\s*/);
const attackOrThwart = (p: Piece) =>
  cards.get(p.code)?.type_code === "event" &&
  traits(cards.get(p.code)).some((t) => t === "Attack" || t === "Thwart");

export const GAMORA_PACK_CORE_ALIASES = [
  "18014",
  "18017",
  "18021",
  "18022",
  "18023",
] as const;
export const GAMORA_PACK_SCRIPT_CODES = [
  "18011",
  "18012",
  "18013",
  "18015",
  "18016",
  "18018",
  "18019",
  "18020",
  "18029",
  "18030",
  "18031",
  "18032",
] as const;
export interface GamoraPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  discardPiece(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  attach(s: GameState, upgradeId: string, targetId: string): void;
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  enemyTargets(s: GameState, attack?: boolean): AntManPackTarget[];
  schemeTargets(s: GameState): AntManPackTarget[];
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  heroThwart(s: GameState): number;
  enemyUnique(s: GameState, target: string): boolean;
}
const attached = (s: GameState, p: Piece) =>
  allInPlay(s).filter(
    (a) => a.code === "18030" && a.attachedTo === p.id && !isTextBlank(s, a),
  ).length;
export const gamoraPackAllyHP = (s: GameState, p: Piece) => attached(s, p);
export const gamoraPackAllyThwart = (s: GameState, p: Piece) => attached(s, p);
export function gamoraPackAllyCanAttack(
  s: GameState,
  p: Piece,
  target: string,
) {
  return p.code !== "18019" || isTextBlank(s, p) || target === s.villain.id;
}
/** Call once for every card played from any zone, including paid reaction events.
 * Put-into-play effects do not count; phase changes do not clear this history. */
export function gamoraPackCardPlayed(s: GameState, p: Piece) {
  if (s.flags.gamoraPackPlayedRound !== s.round) {
    s.flags.gamoraPackPlayedRound = s.round;
    s.flags.gamoraPackFirstPlayed = p.id;
    s.flags.gamoraPackPlayedCount = 0;
  }
  s.flags.gamoraPackPlayedCount =
    Number(s.flags.gamoraPackPlayedCount || 0) + 1;
  s.flags["gamoraPackPlay:" + p.id] = s.flags.gamoraPackPlayedCount;
}
export function gamoraPackResourceSources(s: GameState): PaymentSource[] {
  return s.player.form !== "hero"
    ? []
    : s.player.inPlay
        .filter(
          (p) =>
            p.code === "18032" &&
            !p.exhausted &&
            p.counters > 0 &&
            !isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Enhanced Reflexes",
          resources: ["energy"],
          kind: "ability",
          description:
            "Exhaust · spend 1 energy counter · generate 1 energy resource",
        }));
}
export function gamoraPackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<GamoraPackPorts, "discardPiece">,
) {
  const p = own(s, id, "18032");
  if (!p) return false;
  need(
    s.player.form === "hero" && !p.exhausted && p.counters > 0,
    "Enhanced Reflexes is unavailable.",
  );
  p.exhausted = true;
  if (!--p.counters) ports.discardPiece(s, p.id);
  return true;
}
export function gamoraPackAttachmentTargets(
  s: GameState,
  ports: Pick<GamoraPackPorts, "hasTrait">,
) {
  return allInPlay(s).filter(
    (p) =>
      cards.get(p.code)?.type_code === "ally" &&
      ports.hasTrait(s, p.id, "Guardian") &&
      !allInPlay(s).some((a) => a.code === "18030" && a.attachedTo === p.id),
  );
}
export function gamoraPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: GamoraPackPorts,
): string | null {
  if (p.code === "18019" && !ports.hasTrait(s, "hero", "Guardian"))
    return "Your identity must have the Guardian trait.";
  if (p.code === "18030" && !gamoraPackAttachmentTargets(s, ports).length)
    return "Comms Implant requires a Guardian ally without another Comms Implant.";
  if (p.code === "18031")
    return "Available after your hero defends against an enemy attack.";
  return null;
}
export function gamoraPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "18032") p.counters = 3;
  return p.code === "18030" && !p.attachedTo ? [P("attach", { id: p.id })] : [];
}
export function gamoraPackAllyEnter(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "18011") return [P("angela", { id: p.id })];
  return p.code === "18019" ? [] : null;
}
export function gamoraPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "18012":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Clobber",
          action: E("damage", {
            amount: 3,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        }),
        P("return-first", {
          id: p.id,
          playOccurrence: Number(s.flags["gamoraPackPlay:" + p.id] || 0),
        }),
      ];
    case "18013":
      return [P("plan", { count: s.player.form === "alter" ? 7 : 4 })];
    case "18015":
      return [
        E("damage", {
          target: s.villain.id,
          amount: 2,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
      ];
    case "18016":
      return [
        E("thwart", {
          target: "main",
          amount: 3,
          source: "hero",
          action: true,
        }),
        P("return-first", {
          id: p.id,
          playOccurrence: Number(s.flags["gamoraPackPlay:" + p.id] || 0),
        }),
      ];
    case "18020":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Hit and Run",
          action: E("damage", {
            amount: 2,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        }),
        E("target", {
          group: "scheme",
          thwart: true,
          title: "Hit and Run",
          action: E("thwart", {
            amount: 2,
            source: "hero",
            action: true,
            thwartInitiated: true,
          }),
        }),
      ];
    case "18029":
      return [
        E("damage", {
          target: s.villain.id,
          amount: s.scheme.threat === 0 ? 5 : 2,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
      ];
    case "18031":
      return [];
    default:
      return null;
  }
}
export function gamoraPackBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: GamoraPackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.player.stunned ||
    !packet.basic ||
    !ports.enemyUnique(s, packet.target)
  )
    return [];
  const used: string[] = packet.gamoraPackGodslayers || [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "18018" &&
        !p.exhausted &&
        !used.includes(p.id) &&
        !isTextBlank(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Godslayer · +2 ATK against this unique enemy",
        [P("godslayer", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
export function gamoraPackFirstHitOptions(
  s: GameState,
  minion: Piece,
  after: Effect[],
  ports: GamoraPackPorts,
): Option[] {
  if (s.player.form !== "hero" || !s.minions.some((p) => p.id === minion.id))
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "18015" &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "First Hit · attack this minion for 2",
        [P("first-hit-pay", { id: p.id, minionId: minion.id, after })],
        p.code,
      ),
    );
}
export interface GamoraPackDefenseSnapshot {
  heroDefended: boolean;
  playerId: string;
}
export function gamoraPackAfterDefenseOptions(
  s: GameState,
  snapshot: GamoraPackDefenseSnapshot,
  after: Effect[],
  ports: GamoraPackPorts,
): Option[] {
  if (
    !snapshot.heroDefended ||
    snapshot.playerId !== s.activePlayerId ||
    s.player.form !== "hero"
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "18031" &&
        (s.player.confused || ports.schemeTargets(s).length > 0) &&
        ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "True Grit · remove threat equal to your hero's THW",
        [P("grit-pay", { id: p.id, after })],
        p.code,
      ),
    );
}
export function resolveGamoraPackEffect(
  s: GameState,
  e: Effect,
  ports: GamoraPackPorts,
): boolean {
  if (!e.type.startsWith("gamora-pack:")) return false;
  switch (e.type) {
    case "gamora-pack:attach": {
      const p = own(s, e.id, "18030");
      if (!p) break;
      const targets = gamoraPackAttachmentTargets(s, ports);
      need(targets.length, "Comms Implant requires a Guardian ally.");
      ports.choose(
        s,
        "Comms Implant",
        "Choose a Guardian ally.",
        targets.map((t) =>
          O(
            t.id,
            cards.get(t.code)!.name,
            [P("attach-to", { id: p.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "gamora-pack:attach-to":
      need(
        gamoraPackAttachmentTargets(s, ports).some((p) => p.id === e.target),
        "That ally cannot receive Comms Implant.",
      );
      ports.attach(s, e.id, e.target);
      break;
    case "gamora-pack:angela": {
      const p = own(s, e.id, "18011");
      if (!p) break;
      const minions = s.encounter.deck
        .slice(0, 10)
        .filter((p) => cards.get(p.code)?.type_code === "minion");
      if (!minions.length) {
        ports.shuffleEncounter(s);
        ports.discardPiece(s, p.id);
        break;
      }
      ports.choose(
        s,
        "Angela",
        "Choose a minion from the top 10 encounter cards to put into play engaged with you.",
        minions.map((m) =>
          O(
            m.id,
            cards.get(m.code)!.name,
            [P("angela-minion", { id: p.id, minionId: m.id })],
            m.code,
          ),
        ),
      );
      break;
    }
    case "gamora-pack:angela-minion": {
      const p = own(s, e.id, "18011"),
        index = s.encounter.deck.findIndex(
          (m, i) =>
            i < 10 &&
            m.id === e.minionId &&
            cards.get(m.code)?.type_code === "minion",
        );
      need(p && index >= 0, "Angela's selected minion is unavailable.");
      const [m] = s.encounter.deck.splice(index, 1);
      ports.shuffleEncounter(s);
      ports.putMinion(s, m, s.activePlayerId);
      break;
    }
    case "gamora-pack:plan": {
      const events = s.player.deck
        .slice(0, e.count)
        .filter(
          (p) =>
            cards.get(p.code)?.type_code === "event" &&
            traits(cards.get(p.code)).includes("Attack"),
        );
      const finish = O("fail", "Finish the search without taking a card", [
        P("plan-finish"),
      ]);
      if (!events.length) ports.queue(s, ...finish.effects);
      else
        ports.choose(
          s,
          "Plan of Attack",
          `Search the top ${e.count} cards for an Attack event.`,
          [
            ...events.map((p) =>
              O(
                p.id,
                cards.get(p.code)!.name,
                [P("plan-take", { id: p.id, count: e.count })],
                p.code,
              ),
            ),
            finish,
          ],
        );
      break;
    }
    case "gamora-pack:plan-take": {
      const index = s.player.deck.findIndex(
        (p, i) =>
          i < e.count &&
          p.id === e.id &&
          cards.get(p.code)?.type_code === "event" &&
          traits(cards.get(p.code)).includes("Attack"),
      );
      need(index >= 0, "Plan of Attack's selected event is unavailable.");
      s.player.hand.push(...s.player.deck.splice(index, 1));
      ports.shufflePlayerDeck(s);
      break;
    }
    case "gamora-pack:plan-finish":
      ports.shufflePlayerDeck(s);
      break;
    case "gamora-pack:return-first": {
      if (
        s.flags.gamoraPackPlayedRound !== s.round ||
        s.flags.gamoraPackFirstPlayed !== e.id ||
        Number(e.playOccurrence ?? s.flags["gamoraPackPlay:" + e.id] ?? 0) !== 1
      )
        break;
      const index = s.resolving.findIndex((p) => p.id === e.id);
      if (index >= 0) s.player.hand.push(...s.resolving.splice(index, 1));
      break;
    }
    case "gamora-pack:godslayer": {
      const p = own(s, e.id, "18018");
      need(
        p &&
          gamoraPackBasicAttackOptions(s, e.packet, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Godslayer requires a basic attack against a unique enemy.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 2,
          gamoraPackGodslayers: [
            ...(e.packet.gamoraPackGodslayers || []),
            p!.id,
          ],
          gmwBasicBonus: Number(e.packet.gmwBasicBonus || 0) + 2,
        },
        ...(e.after || []),
      );
      break;
    }
    case "gamora-pack:first-hit-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "18015"),
        minion = s.minions.find((m) => m.id === e.minionId);
      need(
        p &&
          minion &&
          gamoraPackFirstHitOptions(s, minion, e.after || [], ports).some(
            (o) => o.id === p.id,
          ),
        "First Hit requires an initiating minion attack.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "First Hit",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [
                E("damage", {
                  target: minion!.id,
                  amount: 2,
                  source: "hero",
                  attack: true,
                  attackInitiated: true,
                }),
              ],
              continuation: e.after || [],
            }),
          ],
        }),
      );
      break;
    }
    case "gamora-pack:grit-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "18031");
      need(
        p &&
          s.player.form === "hero" &&
          ports.canPay(s, ports.cardCost(s, p), p.id, p.code),
        "True Grit is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "True Grit",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [P("grit")],
              continuation: e.after || [],
            }),
          ],
        }),
      );
      break;
    }
    case "gamora-pack:grit":
      ports.queue(
        s,
        E("target", {
          group: "scheme",
          thwart: true,
          title: "True Grit",
          action: E("thwart", {
            amount: ports.heroThwart(s),
            source: "hero",
            action: true,
            thwartInitiated: true,
          }),
        }),
      );
      break;
    default:
      throw Error("Unknown Gamora player-pack effect: " + e.type);
  }
  return true;
}
