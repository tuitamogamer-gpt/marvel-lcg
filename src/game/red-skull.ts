import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

export const RED_SKULL_SCRIPT_CODES = [
  "04125",
  "04126",
  "04127",
  "04128a",
  "04128b",
  "04129a",
  "04129b",
  "04130",
  "04131",
  "04132",
  "04133",
  "04134",
  "04135",
  "04136",
  "04137",
  "04138",
  "04139",
  "04140",
  "04141",
  "04142",
  "04143",
  "04144",
] as const;
export interface RedSkullState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
  sideDeck: Piece[];
  sideDiscard: Piece[];
  sleeper?: Piece;
  /** The When Revealed ability creates a delayed removal, independent of later blanking. */
  awakened?: string[];
}
const definitions = new Map(catalog.map((c) => [c.code, c]));
const R = (name: string, fields: Record<string, unknown> = {}): Effect => ({
  type: `red-skull:${name}`,
  ...fields,
});
export interface RedSkullPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  shuffle(s: GameState, cards: Piece[]): Piece[];
  reset(p: Piece): Piece;
  giveTough(s: GameState): boolean;
  mill(s: GameState, n: number): Piece[];
  canPutAlly(s: GameState, p: Piece): boolean;
  putAlly(s: GameState, p: Piece): void;
  remove(s: GameState, id: string): void;
  engage(s: GameState, id: string, playerId: string): void;
}
/** All encounter side schemes use this discard, including nemesis cards added later.
 * Player and victory cards never enter the encounter discard in the first place. */
export function redSkullSync(s: GameState, shuffle: RedSkullPorts["shuffle"]) {
  const r = s.redSkull;
  if (!r) return;
  const sides = s.encounter.discard.filter(
    (p) =>
      definitions.get(p.code)?.type_code === "side_scheme" &&
      definitions.get(p.code)?.faction_code === "encounter",
  );
  if (sides.length) {
    const ids = new Set(sides.map((p) => p.id));
    s.encounter.discard = s.encounter.discard.filter((p) => !ids.has(p.id));
    r.sideDiscard.push(...sides);
  }
  if (!r.sideDeck.length && r.sideDiscard.length)
    r.sideDeck = shuffle(s, r.sideDiscard.splice(0));
}
export function redSkullProtected(s: GameState): boolean {
  return (
    s.villainId === "red_skull" &&
    s.sideSchemes.some((p) => p.code === "04139" && !isTextBlank(s, p))
  );
}
export function redSkullLocked(s: GameState, p: Piece): boolean {
  return (
    p.code === "04140" &&
    !isTextBlank(s, p) &&
    s.minions.some((m) => m.code === "04130")
  );
}
export function redSkullAttack(s: GameState, p: Piece): number {
  return ["04125", "04126", "04127"].includes(p.code) && !isTextBlank(s, p)
    ? s.sideSchemes.length
    : 0;
}
export function redSkullKeyword(s: GameState, p: Piece, name: string): number {
  if (p.id !== s.villain.id || s.villainId !== "red_skull") return 0;
  const code =
    name === "Retaliate"
      ? "04133"
      : ["Piercing", "Ranged"].includes(name)
        ? "04132"
        : "";
  return s.attachments.filter(
    (a) => a.code === code && a.attachedTo === p.id && !isTextBlank(s, a),
  ).length;
}
/** Trigger only for an actual activation, after stun/confuse/replacements. */
export function redSkullActivation(s: GameState, id: string): Effect[] {
  if (id !== s.villain.id || s.villainId !== "red_skull") return [];
  const p = s.attachments.find(
    (a) => a.code === "04134" && a.attachedTo === id && !isTextBlank(s, a),
  );
  return p ? [R("strategist", { id: p.id, amount: s.sideSchemes.length })] : [];
}
export function redSkullReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(RED_SKULL_SCRIPT_CODES as readonly string[]).includes(p.code))
    return null;
  if (["04132", "04133", "04134"].includes(p.code))
    return [R("attach", { piece: p })];
  if (p.code === "04135")
    return [R("attach-side", { piece: p, actorId: s.firstPlayerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04126":
    case "04127":
      return [R("deal-each")];
    case "04129a":
      return [R("side", { actorId: s.firstPlayerId })];
    case "04130":
      return [R("engage", { id: p.id })];
    case "04136":
      return [R("exhaust", { remaining: s.sideSchemes.length })];
    case "04137":
      return ["main", ...s.sideSchemes.map((q) => q.id)].map((target) => ({
        type: "threat",
        target,
        amount: 2,
      }));
    case "04138":
      return [
        R("tough"),
        R("activate", {
          hero: s.player.form === "hero",
          playerId: s.activePlayerId,
        }),
      ];
    case "04140":
      return [R("sleeper", { id: p.id })];
    case "04144":
      return playerOrder(s).map((seat) =>
        R("chaos", { id: p.id, actorId: seat.id, playerId: seat.id }),
      );
    default:
      return [];
  }
}
export function redSkullBoost(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "04131":
      return [R("tough"), R("boost")];
    case "04132":
      return [R("attach", { piece: p })];
    case "04136":
      return [R("exhaust", { remaining: 1 })];
    case "04137":
      return [R("tough")];
    default:
      return null;
  }
}
export function redSkullStepOne(s: GameState): Effect[] {
  return s.redSkull && !isTextBlank(s, s.redSkull.currentMain)
    ? [R("side", { actorId: s.firstPlayerId })]
    : [];
}
export function redSkullSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "04141":
      return [
        R("prison", { actorId: s.activePlayerId, playerId: s.activePlayerId }),
      ];
    case "04142":
      return playerOrder(s).map((seat) =>
        R("censor", {
          remaining: 3,
          chosen: [],
          actorId: seat.id,
          playerId: seat.id,
        }),
      );
    case "04143":
      return [
        R("reinforcements", {
          actorId: s.activePlayerId,
          playerId: s.activePlayerId,
        }),
      ];
    default:
      return [];
  }
}
export function redSkullDefeatInterrupts(s: GameState, p: Piece): Effect[] {
  return s.attachments
    .filter(
      (a) => a.code === "04135" && a.attachedTo === p.id && !isTextBlank(s, a),
    )
    .map(() => ({
      type: "dealEncounter",
      actorId: s.firstPlayerId,
      playerId: s.firstPlayerId,
    }));
}
export function redSkullActions(s: GameState, p: Piece): Option[] {
  if (
    !["04132", "04133"].includes(p.code) ||
    s.player.form !== "hero" ||
    isTextBlank(s, p) ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  return [
    {
      id: "remove",
      label: `Spend energy + mental + physical · discard ${definitions.get(p.code)!.name}`,
      image: p.code,
      effects: [R("remove-attachment", { id: p.id })],
    },
  ];
}
export function resolveRedSkullEffect(
  s: GameState,
  e: Effect,
  ports: RedSkullPorts,
): boolean {
  if (!e.type.startsWith("red-skull:")) return false;
  switch (e.type) {
    case "red-skull:setup": {
      const p = s.encounter.deck.find((p) => p.code === "04139");
      if (p) ports.putSideScheme(s, p);
      const r = s.redSkull!;
      const i = s.encounter.deck.findIndex((p) => p.code === "04130");
      if (i >= 0) r.sleeper = s.encounter.deck.splice(i, 1)[0];
      r.sideDeck = ports.shuffle(
        s,
        s.encounter.deck.filter(
          (p) => definitions.get(p.code)?.type_code === "side_scheme",
        ),
      );
      const ids = new Set(r.sideDeck.map((p) => p.id));
      s.encounter.deck = s.encounter.deck.filter((p) => !ids.has(p.id));
      break;
    }
    case "red-skull:side": {
      redSkullSync(s, ports.shuffle);
      const p = s.redSkull?.sideDeck.shift();
      if (p) {
        ports.revealHidden(s);
        redSkullSync(s, ports.shuffle);
        ports.reveal(s, p, s.firstPlayerId);
      }
      break;
    }
    case "red-skull:deal-each":
      for (const seat of playerOrder(s)) ports.dealEncounter(s, seat.id);
      break;
    case "red-skull:engage":
      ports.engage(s, e.id, s.firstPlayerId);
      break;
    case "red-skull:sleeper": {
      if (!s.redSkull) break;
      (s.redSkull.awakened ||= []).push(e.id);
      const p = s.redSkull.sleeper;
      if (p) {
        delete s.redSkull.sleeper;
        ports.putMinion(s, p, s.firstPlayerId);
      }
      break;
    }
    case "red-skull:tough":
      ports.giveTough(s);
      break;
    case "red-skull:boost":
      ports.giveBoost(
        s,
        s.villain.id,
        (s.scheming || s.attack)?.attacker === s.villain.id
          ? "current"
          : "next",
      );
      break;
    case "red-skull:strategist":
      if (s.attachments.some((p) => p.id === e.id)) {
        // Both attacks and schemes have an activation object before this interrupt.
        for (let i = 0; i < e.amount; i++)
          ports.giveBoost(s, s.villain.id, "current");
        ports.discardPiece(s, e.id);
      }
      break;
    case "red-skull:attach":
      ports.attach(s, e.piece, s.villain.id);
      break;
    case "red-skull:attach-side": {
      if (!s.sideSchemes.length) break;
      ports.choose(
        s,
        "Twisted Reality",
        "Choose a side scheme.",
        s.sideSchemes.map((p) => ({
          id: p.id,
          label: definitions.get(p.code)!.name,
          image: p.code,
          effects: [R("attach-selected", { piece: e.piece, id: p.id })],
        })),
      );
      break;
    }
    case "red-skull:attach-selected":
      if (s.sideSchemes.some((p) => p.id === e.id))
        ports.attach(s, e.piece, e.id);
      break;
    case "red-skull:remove-attachment": {
      const p = s.attachments.find((p) => p.id === e.id);
      if (!p || isTextBlank(s, p) || s.player.form !== "hero") break;
      ports.pay(
        s,
        3,
        ["energy", "mental", "physical"],
        [R("discard", { id: p.id })],
        definitions.get(p.code)!.name,
        true,
      );
      break;
    }
    case "red-skull:discard":
      ports.discardPiece(s, e.id);
      break;
    case "red-skull:exhaust": {
      if (e.remaining <= 0) break;
      const opts: Option[] = s.player.inPlay
        .filter(
          (p) => definitions.get(p.code)?.type_code === "ally" && !p.exhausted,
        )
        .map((p) => ({
          id: p.id,
          label: definitions.get(p.code)!.name,
          image: p.code,
          effects: [
            R("exhaust-selected", { id: p.id, remaining: e.remaining }),
          ],
        }));
      if (!s.player.exhausted)
        opts.unshift({
          id: "hero",
          label: "Exhaust your identity",
          effects: [
            R("exhaust-selected", { id: "hero", remaining: e.remaining }),
          ],
        });
      if (opts.length)
        ports.choose(
          s,
          "Bitter Rival",
          "Exhaust a character you control.",
          opts,
        );
      break;
    }
    case "red-skull:exhaust-selected": {
      const p =
        e.id === "hero" ? s.player : s.player.inPlay.find((p) => p.id === e.id);
      if (p && !p.exhausted) p.exhausted = true;
      ports.queue(s, R("exhaust", { remaining: e.remaining - 1 }));
      break;
    }
    case "red-skull:activate":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: e.hero ? "attack" : "scheme",
          modifier: 0,
        });
      break;
    case "red-skull:chaos": {
      if (
        !s.players.some((p) => p.id === e.playerId && !p.eliminated) ||
        !s.sideSchemes.some((p) => p.id === e.id)
      )
        break;
      const discarded = ports.mill(s, 5);
      const resources = new Set<string>();
      for (const p of discarded) {
        const c = definitions.get(p.code)!;
        for (const resource of [
          "energy",
          "mental",
          "physical",
          "wild",
        ] as const)
          if (c[`resource_${resource}`]) resources.add(resource);
      }
      ports.queue(s, { type: "threat", target: e.id, amount: resources.size });
      break;
    }
    case "red-skull:prison": {
      ports.revealHidden(s);
      const cards = [...s.player.deck, ...s.player.discard].filter(
        (p) =>
          definitions.get(p.code)?.type_code === "ally" &&
          ports.canPutAlly(s, p),
      );
      ports.queue(s, R("shuffle-player", { playerId: s.activePlayerId }));
      if (cards.length)
        ports.choose(
          s,
          "Prison Camps",
          "Search your deck and discard for an ally to put into play.",
          cards.map((p) => ({
            id: p.id,
            label: definitions.get(p.code)!.name,
            image: p.code,
            effects: [R("prison-selected", { id: p.id })],
          })),
        );
      break;
    }
    case "red-skull:prison-selected": {
      const p = [...s.player.deck, ...s.player.discard].find(
        (p) => p.id === e.id,
      );
      if (!p || !ports.canPutAlly(s, p)) break;
      s.player.deck = s.player.deck.filter((q) => q.id !== p.id);
      s.player.discard = s.player.discard.filter((q) => q.id !== p.id);
      ports.putAlly(s, ports.reset(p));
      break;
    }
    case "red-skull:shuffle-player": {
      const seat = s.players.find((p) => p.id === e.playerId && !p.eliminated);
      if (seat) {
        const view = seatView(s, seat);
        ports.revealHidden(s);
        view.player.deck = ports.shuffle(s, view.player.deck);
      }
      break;
    }
    case "red-skull:censor": {
      if (!s.players.some((p) => p.id === e.playerId && !p.eliminated)) break;
      const chosen: string[] = e.chosen || [];
      const options: Option[] = s.player.discard
        .filter((p) => !chosen.includes(p.id))
        .map((p) => ({
          id: p.id,
          label: definitions.get(p.code)!.name,
          image: p.code,
          effects: [
            R("censor", {
              ...e,
              type: "red-skull:censor",
              remaining: e.remaining - 1,
              chosen: [...chosen, p.id],
            }),
          ],
        }));
      const finish = R("censor-finish", { chosen, playerId: e.playerId });
      if (e.remaining <= 0 || !options.length) ports.queue(s, finish);
      else
        ports.choose(
          s,
          "Censor the Past",
          `Choose up to ${e.remaining} more cards to shuffle into your deck.`,
          [
            ...options,
            { id: "done", label: "Finish selection", effects: [finish] },
          ],
        );
      break;
    }
    case "red-skull:censor-finish": {
      const ids = new Set<string>(e.chosen);
      const cards = s.player.discard.filter((p) => ids.has(p.id));
      s.player.discard = s.player.discard.filter((p) => !ids.has(p.id));
      s.player.deck.push(...cards.map((p) => ports.reset(p)));
      ports.queue(s, R("shuffle-player", { playerId: e.playerId }));
      break;
    }
    case "red-skull:reinforcements": {
      const minions = s.minions.filter(
        (p) => !definitions.get(p.code)?.traits?.includes("Elite."),
      );
      if (minions.length)
        ports.choose(
          s,
          "Hydra Reinforcements",
          "Discard a non-Elite minion.",
          minions.map((p) => ({
            id: p.id,
            label: definitions.get(p.code)!.name,
            image: p.code,
            effects: [R("discard", { id: p.id })],
          })),
        );
      break;
    }
    default:
      throw Error(`Unknown Red Skull effect: ${e.type}`);
  }
  return true;
}
