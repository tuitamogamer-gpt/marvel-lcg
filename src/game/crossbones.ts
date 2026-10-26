import { isTextBlank } from "./card-text.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

export const CROSSBONES_SCRIPT_CODES = [
  "04058",
  "04059",
  "04060",
  "04061a",
  "04061b",
  "04062a",
  "04062b",
  "04063a",
  "04063b",
  "04064",
  "04065",
  "04066",
  "04067",
  "04068",
  "04069",
  "04070",
  "04071",
] as const;
/** Every pile contains the original physical pieces, not copies of their faces. */
export interface CrossbonesState {
  weaponDeck: Piece[];
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}
const C = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `crossbones:${name}`,
  ...args,
});
export interface CrossbonesPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  card(p: Piece | string): Card;
  attach(s: GameState, p: Piece, targetId: string): void;
  discardPiece(s: GameState, id: string): void;
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  giveTough(s: GameState): boolean;
  enemyAttack(s: GameState): number;
  /** Native per-card numerical count windows; continuations receive boostTotal.
   * A discarded card is not an activation boost card: no Amplify or boost text. */
  countBoostIcons(
    s: GameState,
    pieces: Piece[],
    after: Effect[],
    title: string,
  ): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    source: Piece,
    after?: Effect[],
  ): void;
  activate(s: GameState, playerId: string, sourceId: string): void;
}
export function crossbonesArmor(s: GameState): Piece | undefined {
  return s.attachments.find(
    (p) =>
      p.code === "04065" && p.attachedTo === s.villain.id && !isTextBlank(s, p),
  );
}
export function crossbonesPiercing(
  s: GameState,
  enemyId: string,
  card: CrossbonesPorts["card"],
): boolean {
  return (
    enemyId === s.villain.id &&
    ["04058", "04059", "04060"].includes(s.villain.code) &&
    !isTextBlank(s, s.villain) &&
    s.attachments.some(
      (p) =>
        p.attachedTo === enemyId &&
        card(p)
          .traits?.split(".")
          .some((t) => t.trim() === "Weapon"),
    )
  );
}
export function crossbonesAttackStarted(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    enemyId !== s.villain.id ||
    !["04058", "04059", "04060"].includes(s.villain.code)
  )
    return [];
  return s.attachments
    .filter(
      (p) =>
        p.code === "04064" &&
        p.attachedTo === enemyId &&
        p.counters > 0 &&
        !isTextBlank(s, p),
    )
    .map((p) =>
      C("gun", {
        id: p.id,
        playerId,
        actorId: playerId,
        attackId: s.attack?.id,
      }),
    );
}
export function crossbonesReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(CROSSBONES_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  if (["04064", "04065"].includes(p.code)) return [C("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04059":
      return [C("find-gun")];
    case "04060":
    case "04061b":
    case "04062b":
    case "04063b":
      return [C("weapon", { actorId: s.firstPlayerId })];
    case "04066":
      return [C("bomber", { sourceId: p.id })];
    case "04067":
      return s.player.form === "alter"
        ? [{ type: "surge", sourceCode: p.code, sourceId: p.id }]
        : [C("full-auto", { piece: p, playerId: s.activePlayerId })];
    case "04068":
      return [C("tough")];
    case "04069":
      return [C("raid", { sourceId: p.id })];
    case "04071":
      return [C("staff", { id: p.id })];
    default:
      return [];
  }
}
export function crossbonesBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "04068" ? [C("tough")] : null;
}
export function crossbonesSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === "04070" && !isTextBlank(s, p)
    ? [C("activate", { playerId, sourceId: p.id, actorId: playerId })]
    : [];
}
export function resolveCrossbonesEffect(
  s: GameState,
  e: Effect,
  ports: CrossbonesPorts,
): boolean {
  if (!e.type.startsWith("crossbones:")) return false;
  switch (e.type) {
    case "crossbones:after":
      ports.queue(s, ...(e.effects || []));
      break;
    case "crossbones:weapon": {
      const p = s.crossbones?.weaponDeck.shift();
      if (p) {
        ports.revealHidden(s);
        ports.reveal(s, p, s.firstPlayerId);
      }
      break;
    }
    case "crossbones:attach": {
      const p = e.piece as Piece;
      // These cards name Crossbones, not an arbitrary villain.
      if (!["04058", "04059", "04060"].includes(s.villain.code)) break;
      p.damage = 0;
      p.counters = p.code === "04064" ? 2 * s.playerCount : 0;
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "crossbones:find-gun": {
      let found: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((p) => p.code === "04064");
        if (i >= 0) {
          found = zone.splice(i, 1)[0];
          break;
        }
      }
      ports.revealHidden(s);
      ports.shuffleEncounter(s);
      if (found) ports.queue(s, C("attach", { piece: found }));
      break;
    }
    case "crossbones:gun": {
      const gun = s.attachments.find((p) => p.id === e.id);
      if (
        !gun ||
        gun.counters <= 0 ||
        isTextBlank(s, gun) ||
        s.attack?.id !== e.attackId ||
        !s.players.some((p) => p.id === e.playerId && !p.eliminated) ||
        (!s.encounter.deck.length && !s.encounter.discard.length)
      )
        break;
      gun.counters--;
      const discarded = ports.discardTop(s).piece;
      const after = gun.counters === 0 ? [C("empty-gun", { id: gun.id })] : [];
      ports.countBoostIcons(
        s,
        discarded ? [discarded] : [],
        [
          C("indirect-counted", {
            piece: gun,
            playerId: e.playerId,
            actorId: e.playerId,
            after,
          }),
        ],
        ports.card(gun).name,
      );
      break;
    }
    case "crossbones:indirect-counted":
      // This is ability damage during an attack; it is not attack damage.
      // Keep the original attacked/revealing player even when a teammate's
      // Chaos Control or Crest changes an individual discarded-card count.
      ports.indirect(
        s,
        e.playerId,
        Number(e.boostTotal || 0),
        e.piece,
        e.after || [],
      );
      break;
    case "crossbones:empty-gun": {
      const gun = s.attachments.find((p) => p.id === e.id);
      if (gun?.counters === 0) ports.discardPiece(s, gun.id);
      break;
    }
    case "crossbones:bomber":
      ports.choose(s, "Hydra Bomber", "Choose one effect.", [
        {
          id: "damage",
          label: "Take 2 damage",
          effects: [
            { type: "damage", target: "hero", amount: 2, source: e.sourceId },
          ],
        },
        {
          id: "threat",
          label: "Place 1 threat on the main scheme",
          effects: [{ type: "threat", target: "main", amount: 1 }],
        },
      ]);
      break;
    case "crossbones:full-auto": {
      const count = Math.max(0, ports.enemyAttack(s));
      const discarded: Piece[] = [];
      for (let i = 0; i < count; i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        discarded.push(piece);
        if (emptied) break;
      }
      ports.countBoostIcons(
        s,
        discarded,
        [
          C("indirect-counted", {
            piece: e.piece,
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        ],
        ports.card(e.piece).name,
      );
      break;
    }
    case "crossbones:tough":
      if (!ports.giveTough(s))
        ports.queue(s, { type: "heal", target: s.villain.id, amount: 3 });
      break;
    case "crossbones:raid": {
      // A discard-until search stops at the first exhaustion, even though
      // native recycling immediately creates the next encounter deck.
      for (
        let remaining = s.encounter.deck.length || s.encounter.discard.length;
        remaining > 0;
        remaining--
      ) {
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        const card = ports.card(piece);
        if (
          card.type_code === "attachment" &&
          card.traits?.split(".").some((t) => t.trim() === "Weapon")
        ) {
          ports.reveal(s, piece, s.activePlayerId);
          break;
        }
        if (emptied) break;
      }
      break;
    }
    case "crossbones:staff": {
      const discarded: Piece[] = [];
      for (let i = 0; i < s.playerCount; i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        discarded.push(piece);
        if (emptied) break;
      }
      ports.countBoostIcons(
        s,
        discarded,
        [C("staff-counted", { id: e.id, actorId: s.activePlayerId })],
        "Cornered Staff",
      );
      break;
    }
    case "crossbones:staff-counted":
      if (s.sideSchemes.some((p) => p.id === e.id))
        ports.queue(s, {
          type: "threat",
          target: e.id,
          amount: Number(e.boostTotal || 0),
        });
      break;
    case "crossbones:activate":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.activate(s, e.playerId, e.sourceId);
      break;
  }
  return true;
}
