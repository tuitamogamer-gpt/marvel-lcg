import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type { Effect, GameState, Piece } from "./types.js";

export const ZOLA_SCRIPT_CODES = [
  "04109",
  "04110",
  "04111",
  "04112a",
  "04112b",
  "04113a",
  "04113b",
  "04114",
  "04115",
  "04116",
  "04117",
  "04118",
  "04119",
  "04120",
  "04121",
  "04122",
  "04123",
  "04124",
] as const;
export interface ZolaState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}
const definitions = new Map(catalog.map((c) => [c.code, c]));
const Z = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zola:${name}`,
  ...args,
});
const techCodes = ["04117", "04118", "04119"];
const tech = (p: Piece) =>
  definitions.get(p.code)?.type_code === "attachment" &&
  definitions.get(p.code)?.traits?.split(/\.\s*/).includes("Tech");
function attached(s: GameState, p: Piece, code?: string) {
  return s.attachments.filter(
    (a) =>
      a.attachedTo === p.id && (!code || a.code === code) && !isTextBlank(s, a),
  );
}
export function zolaHealth(s: GameState, p: Piece): number {
  return attached(s, p).filter((a) => techCodes.includes(a.code)).length * 2;
}
export function zolaKeyword(s: GameState, p: Piece, name: string): number {
  return name === "Guard"
    ? Number(attached(s, p, "04117").length > 0)
    : name === "Retaliate"
      ? attached(s, p, "04118").length
      : 0;
}
export function zolaAttack(s: GameState, p: Piece): number {
  return p.code === "04114" && !isTextBlank(s, p)
    ? s.attachments.filter(
        (a) =>
          a.attachedTo === p.id &&
          definitions.get(a.code)?.type_code === "attachment",
      ).length
    : 0;
}
export interface ZolaPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  remainingHP(s: GameState, p: Piece): number;
  shufflePlayer(s: GameState, playerId: string): void;
  giveTough(s: GameState): boolean;
}
export function zolaSetup(): Effect[] {
  return [Z("setup-prison")];
}
function searches(s: GameState): Effect[] {
  return playerOrder(s).map((p) =>
    Z("search-minion", { actorId: p.id, playerId: p.id }),
  );
}
export function zolaReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(ZOLA_SCRIPT_CODES as readonly string[]).includes(p.code)) return null;
  if (techCodes.includes(p.code))
    return [Z("attach", { piece: p, actorId: s.firstPlayerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04110":
      return [Z("test-subjects")];
    case "04111":
    case "04113a":
      return searches(s);
    case "04115":
      return [Z("mutate", { id: p.id })];
    case "04120":
      return [
        Z("mind-ray", {
          hero: s.player.form === "hero",
          playerId: s.activePlayerId,
        }),
      ];
    case "04121":
      return [Z("counter")];
    case "04122":
      return [
        ...playerOrder(s).map((seat) =>
          Z("prison-search", { id: p.id, playerId: seat.id, actorId: seat.id }),
        ),
        Z("prison-threat", { id: p.id, actorId: s.activePlayerId }),
        ...playerOrder(s).map((seat) =>
          Z("shuffle-player", { playerId: seat.id, actorId: seat.id }),
        ),
      ];
    default:
      return [];
  }
}
export function zolaBoost(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "04114":
      return [Z("tough")];
    case "04115":
      return [Z("shuffle", { piece: p })];
    case "04116":
      return [Z("berserk")];
    case "04121":
      return [Z("counter")];
    default:
      return null;
  }
}
export function zolaStepOne(s: GameState): Effect[] {
  return s.zola ? [Z("step-one", { actorId: s.firstPlayerId })] : [];
}
export function zolaSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "04122") return [Z("release", { id: p.id })];
  if (p.code === "04123")
    return [
      Z("subjects", { actorId: s.firstPlayerId, playerId: s.firstPlayerId }),
    ];
  return [];
}
/** An explicit attach effect overrides the card's ordinary placement instructions. */
export function zolaMinionEntered(s: GameState, p: Piece): Effect[] {
  return s.sideSchemes
    .filter((q) => q.code === "04124" && !isTextBlank(s, q))
    .map((experiment) =>
      Z("experiment", { id: p.id, sourceId: experiment.id }),
    );
}
function discardUntil(
  s: GameState,
  ports: ZolaPorts,
  predicate: (p: Piece) => boolean,
): Piece | undefined {
  for (let count = 0; count < 1000; count++) {
    const { piece, emptied } = ports.discardTop(s);
    if (!piece) return;
    if (predicate(piece)) return piece;
    if (emptied) return;
  }
  throw Error("Zola discard search exceeded the physical encounter deck.");
}
export function resolveZolaEffect(
  s: GameState,
  e: Effect,
  ports: ZolaPorts,
): boolean {
  if (!e.type.startsWith("zola:")) return false;
  switch (e.type) {
    case "zola:setup-prison": {
      const p = s.encounter.deck.find((p) => p.code === "04122");
      const after = [
        ...playerOrder(s).map((seat) =>
          Z("setup-servant", { playerId: seat.id, actorId: seat.id }),
        ),
        Z("setup-shuffle"),
      ];
      ports.queue(s, ...after);
      if (p) ports.reveal(s, p, s.firstPlayerId);
      break;
    }
    case "zola:setup-servant": {
      const p = s.encounter.deck.find((p) => p.code === "04114");
      if (p) ports.putMinion(s, p, e.playerId);
      break;
    }
    case "zola:setup-shuffle":
      ports.shuffleEncounter(s);
      break;
    case "zola:test-subjects": {
      ports.revealHidden(s);
      const p = [...s.encounter.discard, ...s.encounter.deck].find(
        (p) => p.code === "04123",
      );
      ports.queue(s, Z("setup-shuffle"));
      if (p) ports.reveal(s, p, s.firstPlayerId);
      break;
    }
    case "zola:search-minion": {
      if (!s.players.some((p) => p.id === e.playerId && !p.eliminated)) break;
      ports.revealHidden(s);
      const candidates = [...s.encounter.discard, ...s.encounter.deck].filter(
        (p) => definitions.get(p.code)?.type_code === "minion",
      );
      if (candidates.length)
        ports.choose(
          s,
          "Zola",
          "Search for a minion to reveal.",
          candidates.map((p) => ({
            id: p.id,
            label: definitions.get(p.code)!.name,
            image: p.code,
            effects: [Z("reveal-selected", { id: p.id, playerId: e.playerId })],
          })),
        );
      else ports.shuffleEncounter(s);
      break;
    }
    case "zola:reveal-selected": {
      const p = [...s.encounter.discard, ...s.encounter.deck].find(
        (p) => p.id === e.id,
      );
      ports.queue(s, Z("setup-shuffle"));
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "zola:step-one": {
      if (!s.zola || isTextBlank(s, s.zola.currentMain)) break;
      s.zola.currentMain.counters++;
      if (s.zola.currentMain.counters >= 3) {
        const p = discardUntil(
          s,
          ports,
          (p) => definitions.get(p.code)?.type_code === "minion",
        );
        s.zola.currentMain.counters -= 3;
        if (p) ports.putMinion(s, p, s.firstPlayerId);
      }
      break;
    }
    case "zola:counter":
      if (s.zola) s.zola.currentMain.counters++;
      break;
    case "zola:berserk": {
      if (!s.zola) break;
      const counters = ++s.zola.currentMain.counters;
      const activation = s.scheming || s.attack;
      if (activation?.attacker === s.villain.id)
        activation.modifier = (activation.modifier || 0) + counters;
      break;
    }
    case "zola:tough":
      ports.giveTough(s);
      break;
    case "zola:shuffle":
      ports.revealHidden(s);
      ports.shuffleIntoEncounter(s, e.piece);
      break;
    case "zola:mutate": {
      if (!s.minions.some((p) => p.id === e.id)) break;
      const p = discardUntil(s, ports, tech);
      if (p) ports.attach(s, p, e.id);
      break;
    }
    case "zola:attach": {
      const p = e.piece as Piece;
      const candidates = s.minions.filter(
        (m) =>
          !s.attachments.some(
            (a) => a.attachedTo === m.id && a.code === p.code,
          ),
      );
      const hp = Math.max(...candidates.map((m) => ports.remainingHP(s, m)));
      const tied = candidates.filter((m) => ports.remainingHP(s, m) === hp);
      if (!tied.length)
        ports.queue(s, { type: "surge", sourceId: p.id, sourceCode: p.code });
      else if (tied.length === 1) ports.attach(s, p, tied[0].id);
      else
        ports.choose(
          s,
          definitions.get(p.code)!.name,
          "Choose a minion tied for the most remaining hit points.",
          tied.map((m) => ({
            id: m.id,
            label: definitions.get(m.code)!.name,
            image: m.code,
            effects: [Z("attach-selected", { piece: p, id: m.id })],
          })),
        );
      break;
    }
    case "zola:attach-selected":
      if (s.minions.some((p) => p.id === e.id)) ports.attach(s, e.piece, e.id);
      break;
    case "zola:mind-ray": {
      ports.queue(
        s,
        Z("mind-ray-after", {
          hero: e.hero,
          playerId: e.playerId,
          actorId: e.playerId,
        }),
      );
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.hero ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "zola:mind-ray-after":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: e.hero ? "stunned" : "confused",
          actorId: e.playerId,
        });
      break;
    case "zola:experiment": {
      const minion = s.minions.find((p) => p.id === e.id);
      const source = s.sideSchemes.find((p) => p.id === e.sourceId);
      if (!minion || !source || isTextBlank(s, source)) break;
      const attachment = [...s.encounter.discard].reverse().find(tech);
      if (attachment) ports.attach(s, attachment, minion.id);
      break;
    }
    case "zola:prison-search": {
      const prison = s.sideSchemes.find((p) => p.id === e.id);
      if (!prison) break;
      const view = seatView(s, e.playerId);
      ports.revealHidden(s);
      const candidates = [
        ...view.player.deck,
        ...view.player.discard,
        ...view.player.hand,
      ].filter(
        (p) =>
          definitions.get(p.code)?.type_code === "ally" &&
          definitions.get(p.code)?.set_code === view.heroId,
      );
      if (candidates.length)
        ports.choose(
          s,
          "Hydra Prison",
          "Choose a hero-specific ally to capture.",
          candidates.map((p) => ({
            id: p.id,
            label: definitions.get(p.code)!.name,
            image: p.code,
            effects: [
              Z("capture", {
                id: prison.id,
                allyId: p.id,
                playerId: e.playerId,
              }),
            ],
          })),
        );
      break;
    }
    case "zola:capture": {
      const prison = s.sideSchemes.find((p) => p.id === e.id);
      if (!prison) break;
      const view = seatView(s, e.playerId);
      for (const zone of [
        view.player.deck,
        view.player.discard,
        view.player.hand,
      ]) {
        const i = zone.findIndex((p) => p.id === e.allyId);
        if (i < 0) continue;
        const p = zone.splice(i, 1)[0];
        p.ownerId = e.playerId;
        (prison.captured ||= []).push(p);

        break;
      }
      break;
    }
    case "zola:prison-threat": {
      const prison = s.sideSchemes.find((p) => p.id === e.id);
      if (prison)
        ports.queue(s, {
          type: "threat",
          target: prison.id,
          amount: (prison.captured || []).reduce(
            (n, p) => n + (definitions.get(p.code)?.cost || 0),
            0,
          ),
        });
      break;
    }
    case "zola:shuffle-player":
      ports.shufflePlayer(s, e.playerId);
      break;
    case "zola:release": {
      const prison = s.sideSchemes.find((p) => p.id === e.id);
      if (!prison) break;
      for (const p of prison.captured?.splice(0) || []) {
        const owner = s.players.find((seat) => seat.id === p.ownerId);
        if (owner && !owner.eliminated) seatView(s, owner).player.hand.push(p);
        else s.removed.push(p);
      }
      s.sideSchemes = s.sideSchemes.filter((p) => p.id !== prison.id);
      s.removed.push(prison);
      break;
    }
    case "zola:subjects": {
      const p = discardUntil(
        s,
        ports,
        (p) => definitions.get(p.code)?.type_code === "minion",
      );
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    default:
      throw Error(`Unknown Zola effect: ${e.type}`);
  }
  return true;
}
