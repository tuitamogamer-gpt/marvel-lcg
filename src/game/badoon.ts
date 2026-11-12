import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Attack, Effect, GameState, Option, Piece } from "./types.js";

/** The Galaxy's Most Wanted: Brotherhood of Badoon (Drang), its required
 * Ship Command set and the Band of Badoon modular set. */
export const BADOON_SCENARIO_CODES = [
  "16058",
  "16059",
  "16060",
  "16061a",
  "16061b",
  "16062a",
  "16062b",
  "16063",
  "16064",
  "16065",
  "16066",
  "16067",
  "16068",
  "16069",
] as const;
export const SHIP_COMMAND_CODES = [
  "16142",
  "16143",
  "16144",
  "16145",
  "16146",
  "16147",
  "16148",
] as const;
export const BAND_OF_BADOON_CODES = [
  "16117",
  "16118",
  "16119",
  "16120",
  "16121",
] as const;
export const BADOON_SCRIPT_CODES = [
  ...BADOON_SCENARIO_CODES,
  ...SHIP_COMMAND_CODES,
  ...BAND_OF_BADOON_CODES,
] as const;
export const BADOON_VILLAINS = ["16058", "16059", "16060"] as const;
export const MILANO = "16142";
export const BADOON_SHIP = "16063";
export const ROGUE_VESSEL = "16143";
const SPEAR = "16064";
const ENGINEER = "16065";

export interface BadoonState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece) => definitions.get(p.code)?.name || p.code;
const B = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `badoon:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (BADOON_SCRIPT_CODES as readonly string[]).includes(p.code);
/** Side schemes and main stages whose First Player Action removes 3 threat,
 * including Escape the Museum's The Great Escape (3B). */
const MILANO_SCHEMES = [
  "16061b",
  "16062b",
  "16084b",
  "16106b",
  "16112",
  "16066",
  "16067",
  "16068",
  "16069",
  "16144",
];

export interface BadoonPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  indirect(s: GameState, playerId: string, amount: number, source: Piece): void;
  giveTough(s: GameState): boolean;
  /** Whether a payment is possible while the Milano is exhausted as a cost. */
  canPayWithoutMilano(s: GameState, cost: number): boolean;
}

/** The scenario's actual Milano support, wherever control currently places it. */
export function badoonMilano(s: GameState): Piece | undefined {
  return allInPlay(s).find((p) => p.code === MILANO);
}
function milanoReady(s: GameState) {
  const milano = badoonMilano(s);
  return !!milano && !milano.exhausted && !isTextBlank(s, milano);
}
export function badoonShip(s: GameState): Piece | undefined {
  return (s.environments || []).find((p) => p.code === BADOON_SHIP);
}
const isDrang = (s: GameState) =>
  (BADOON_VILLAINS as readonly string[]).includes(s.villain.code);
function spear(s: GameState) {
  return s.attachments.find(
    (p) => p.code === SPEAR && p.attachedTo === s.villain.id,
  );
}

/** A Milano resource ability may generate a wild resource for any player. */
export function badoonMilanoSource(s: GameState) {
  const milano = badoonMilano(s);
  if (!milano || milano.exhausted || isTextBlank(s, milano)) return undefined;
  return { piece: milano, controllerId: controller(s, milano.id)?.id };
}

export function badoonReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === SPEAR) return [B("attach-spear", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "16059":
      return [B("spear")];
    case "16060":
      return [B("drang-discard", { remaining: 4 * s.playerCount })];
    case "16062a":
      return [B("charge", { sourceId: p.id })];
    case "16145":
    case "16146":
    case "16147":
      return [B("peril", { code: p.code, playerId: s.activePlayerId })];
    case "16148":
      return [
        B("delivery", {
          hero: s.player.form === "hero",
          playerId: s.activePlayerId,
        }),
      ];
    default:
      return [];
  }
}

export function badoonBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const activation = s.attack || s.scheming;
  const attack = !!s.attack && activation === s.attack;
  switch (p.code) {
    case ENGINEER:
      return [B("charge", { sourceId: p.id })];
    case "16117":
      return attack ? [B("attack-keywords")] : [];
    case "16118":
      return [B("grunt-enter", { id: p.id, playerId: s.activePlayerId })];
    case "16119":
      return activation && !attack ? [B("icons", { amount: 2 })] : [];
    case "16120":
      return [B("sentry")];
    case "16121":
      return attack ? [B("icons", { amount: 2 })] : [];
    default:
      return [];
  }
}

/** Main stages 1B/2B and Bombardment respond after villain phase step one. */
export function badoonStepOne(s: GameState): Effect[] {
  if (!s.badoon) return [];
  const main = s.badoon.currentMain;
  const count =
    Number(
      ["16061b", "16062b"].includes(s.scheme.code) && !isTextBlank(s, main),
    ) +
    s.sideSchemes.filter((p) => p.code === "16067" && !isTextBlank(s, p))
      .length;
  return Array.from({ length: count }, () => B("charge"));
}

/** Drang I/II after scheming, Drang III and Badoon Engineer after activating. */
export function badoonSchemed(s: GameState, enemyId: string): Effect[] {
  if (enemyId === s.villain.id)
    return isDrang(s) && !isTextBlank(s, s.villain)
      ? [B("charge", { sourceId: s.villain.id })]
      : [];
  const p = s.minions.find((m) => m.id === enemyId);
  return p?.code === ENGINEER && !isTextBlank(s, p)
    ? [B("charge", { sourceId: p.id })]
    : [];
}
export function badoonAttackResponses(
  s: GameState,
  a: Attack,
): MutagenForcedResponse[] {
  if (
    a.attacker === s.villain.id &&
    s.villain.code === "16060" &&
    !isTextBlank(s, s.villain)
  )
    return [
      {
        id: `${a.id}:badoon-charge`,
        sourceId: s.villain.id,
        title: "Drang",
        effects: [B("charge", { sourceId: s.villain.id })],
      },
    ];
  const p = s.minions.find((m) => m.id === a.attacker);
  return p?.code === ENGINEER && !isTextBlank(s, p)
    ? [
        {
          id: `${a.id}:badoon-charge`,
          sourceId: p.id,
          title: "Badoon Engineer",
          effects: [B("charge", { sourceId: p.id })],
        },
      ]
    : [];
}

export function badoonMinionEngaged(s: GameState, p: Piece): Effect[] {
  if (!known(p) || isTextBlank(s, p)) return [];
  if (p.code === ENGINEER) return [B("charge", { sourceId: p.id })];
  if (p.code === "16117" && s.player.form === "hero")
    return [B("assassin", { id: p.id, playerId: s.activePlayerId })];
  if (
    p.code === "16118" &&
    !s.minions.some((m) => m.id !== p.id && m.engagedWith === p.engagedWith)
  )
    return [B("grunt-deal", { playerId: s.activePlayerId })];
  return [];
}

export function badoonKeyword(s: GameState, p: Piece, keyword: string) {
  const attached = spear(s);
  if (
    keyword === "Stalwart" &&
    p.id === s.villain.id &&
    isDrang(s) &&
    attached &&
    !isTextBlank(s, attached)
  )
    return true;
  if (keyword === "Overkill" && p.code === "16121" && !isTextBlank(s, p))
    return true;
  return (
    s.attack?.attacker === p.id && !!s.attack.badoonKeywords?.includes(keyword)
  );
}

/** First Player Actions and Drang's Spear's Hero Action for a source piece. */
export function badoonActions(
  s: GameState,
  p: Piece,
  ports?: Pick<BadoonPorts, "canPay" | "canPayWithoutMilano">,
): Option[] {
  if ((!known(p) && !MILANO_SCHEMES.includes(p.code)) || isTextBlank(s, p))
    return [];
  if (p.code === SPEAR) {
    if (
      s.player.form !== "hero" ||
      !s.attachments.some((a) => a.id === p.id) ||
      (ports && !ports.canPay(s, 3, ["mental", "physical", "physical"]))
    )
      return [];
    return [
      {
        id: "remove",
        label: "Spend mental + physical + physical · discard Drang's Spear",
        image: p.code,
        effects: [B("spear-remove", { id: p.id })],
      },
    ];
  }
  const first = s.activePlayerId === s.firstPlayerId && s.phase === "player";
  if (!first || !milanoReady(s)) return [];
  const inPlay =
    s.sideSchemes.some((q) => q.id === p.id) ||
    s.badoon?.currentMain.id === p.id ||
    s.escape?.currentMain.id === p.id ||
    s.ronan?.currentMain.id === p.id ||
    (s.environments || []).some((q) => q.id === p.id);
  if (!inPlay) return [];
  if (p.code === ROGUE_VESSEL)
    return !ports || ports.canPayWithoutMilano(s, 2)
      ? [
          {
            id: "milano",
            label:
              "First Player Action · exhaust the Milano and spend 2 resources · discard Rogue Vessel",
            image: p.code,
            effects: [B("vessel", { id: p.id })],
          },
        ]
      : [];
  if (!MILANO_SCHEMES.includes(p.code)) return [];
  const main =
    s.badoon?.currentMain.id === p.id ||
    s.escape?.currentMain.id === p.id ||
    s.ronan?.currentMain.id === p.id;
  const options: Option[] = [
    {
      id: "milano",
      label: "First Player Action · exhaust the Milano · remove 3 threat",
      image: p.code,
      effects: [B("remove-threat", { id: p.id, main })],
    },
  ];
  if (p.code === "16062b" && s.minions.length)
    options.push({
      id: "milano-minion",
      label:
        "First Player Action · exhaust the Milano · deal 3 damage to a minion",
      image: p.code,
      effects: [B("milano-damage")],
    });
  return options;
}

/** Scheme and environment pieces whose printed First Player Action is offered. */
export function badoonActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  if (s.badoon?.currentMain.id === id) return s.badoon.currentMain;
  if (s.escape?.currentMain.id === id) return s.escape.currentMain;
  if (s.ronan?.currentMain.id === id) return s.ronan.currentMain;
  return [...s.sideSchemes, ...(s.environments || [])].find(
    (p) =>
      p.id === id &&
      (MILANO_SCHEMES.includes(p.code) || p.code === ROGUE_VESSEL),
  );
}

function exhaustMilano(s: GameState): Piece | undefined {
  const milano = badoonMilano(s);
  if (!milano || milano.exhausted || isTextBlank(s, milano)) return undefined;
  milano.exhausted = true;
  return milano;
}

function fewestEngaged(s: GameState) {
  const seats = playerOrder(s);
  const count = (id: string) =>
    s.minions.filter((m) => m.engagedWith === id).length;
  const least = Math.min(...seats.map((seat) => count(seat.id)));
  return seats.filter((seat) => count(seat.id) === least);
}

export function resolveBadoonEffect(
  s: GameState,
  e: Effect,
  ports: BadoonPorts,
): boolean {
  if (!e.type.startsWith("badoon:")) return false;
  switch (e.type) {
    case "badoon:charge": {
      const ship = badoonShip(s);
      if (!ship || isTextBlank(s, ship)) break;
      ship.counters++;
      if (ship.counters >= 4) {
        ship.counters = 0;
        ports.queue(
          s,
          ...playerOrder(s).map((seat) =>
            B("indirect", { playerId: seat.id, amount: 2, actorId: seat.id }),
          ),
        );
      }
      break;
    }
    case "badoon:indirect": {
      const ship = badoonShip(s);
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated) && ship)
        ports.indirect(s, e.playerId, e.amount, ship);
      break;
    }
    case "badoon:attach-spear":
      if (isDrang(s)) ports.attach(s, e.piece, s.villain.id);
      break;
    case "badoon:spear": {
      if (!isDrang(s)) break;
      if (spear(s)) {
        ports.giveBoost(s, s.villain.id, "next");
        break;
      }
      let p = s.encounter.discard.find((q) => q.code === SPEAR);
      const searchedDeck = !p;
      if (!p) {
        ports.revealHidden(s);
        p = s.encounter.deck.find((q) => q.code === SPEAR);
      }
      // The deck is shuffled after the search; the discard pile is public.
      ports.queue(s, B("shuffle"));
      if (p) ports.reveal(s, p, s.firstPlayerId);
      else if (!searchedDeck) ports.revealHidden(s);
      break;
    }
    case "badoon:shuffle":
      ports.revealHidden(s);
      ports.shuffleEncounter(s);
      break;
    case "badoon:drang-discard": {
      if (!e.remaining || e.remaining <= 0) break;
      const { piece } = ports.discardTop(s);
      if (!piece) break;
      const next =
        e.remaining > 1
          ? [B("drang-discard", { remaining: e.remaining - 1 })]
          : [];
      if (definitions.get(piece.code)?.type_code !== "minion") {
        ports.queue(s, ...next);
        break;
      }
      const tied = fewestEngaged(s);
      if (tied.length === 1) {
        ports.queue(s, ...next);
        ports.putMinion(s, piece, tied[0].id);
      } else
        ports.choose(
          s,
          "Drang",
          `Choose a player engaged with the fewest minions to engage ${name(piece)}.`,
          tied.map((seat) => ({
            id: seat.id,
            label: seat.heroId.replace(/_/g, " "),
            image: piece.code,
            effects: [
              B("drang-place", { id: piece.id, playerId: seat.id }),
              ...next,
            ],
          })),
        );
      break;
    }
    case "badoon:drang-place": {
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (
        p &&
        s.players.some((seat) => seat.id === e.playerId && !seat.eliminated)
      )
        ports.putMinion(s, p, e.playerId);
      break;
    }
    case "badoon:peril": {
      const typed =
        e.code === "16145"
          ? (["physical", "physical"] as const)
          : e.code === "16146"
            ? (["mental", "mental"] as const)
            : (["energy", "energy"] as const);
      const options: Option[] = [];
      if (milanoReady(s))
        options.push({
          id: "milano",
          label: "Exhaust the Milano",
          image: MILANO,
          effects: [B("exhaust-milano")],
        });
      if (ports.canPay(s, 2, [...typed]))
        options.push({
          id: "pay",
          label: `Spend ${typed.join(" + ")} resources`,
          effects: [B("pay", { requirements: [...typed], code: e.code })],
        });
      const first = s.firstPlayerId;
      options.push(
        e.code === "16145"
          ? {
              id: "first",
              label: "Stun the first player",
              effects: [
                {
                  type: "status",
                  target: `hero:${first}`,
                  status: "stunned",
                },
              ],
            }
          : e.code === "16146"
            ? {
                id: "first",
                label: "Deal 3 damage to the first player",
                effects: [
                  {
                    type: "damage",
                    target: "hero",
                    amount: 3,
                    actorId: first,
                    source: "encounter",
                  },
                ],
              }
            : {
                id: "first",
                label: "Discard 1 card at random from the first player's hand",
                effects: [{ type: "randomDiscard", actorId: first }],
              },
      );
      ports.choose(
        s,
        definitions.get(e.code)!.name,
        "Peril · choose one. Other players cannot help you.",
        options,
      );
      break;
    }
    case "badoon:pay":
      ports.pay(s, 2, e.requirements, [], definitions.get(e.code)!.name, false);
      break;
    case "badoon:exhaust-milano":
      exhaustMilano(s);
      break;
    case "badoon:delivery": {
      if (!s.players.some((p) => p.id === e.playerId && !p.eliminated)) break;
      const options: Option[] = [];
      if (milanoReady(s))
        options.push({
          id: "milano",
          label: "Exhaust the Milano",
          image: MILANO,
          effects: [B("exhaust-milano")],
        });
      options.push({
        id: "villain",
        label: e.hero
          ? "Do not exhaust · the villain attacks you with +1 ATK"
          : "Do not exhaust · the villain schemes with +1 SCH",
        effects: [
          B("activate", {
            playerId: e.playerId,
            kind: e.hero ? "attack" : "scheme",
            modifier: 1,
          }),
        ],
      });
      ports.choose(
        s,
        "Special Delivery",
        "You may exhaust the Milano.",
        options,
      );
      break;
    }
    case "badoon:activate":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.activate(s, {
          enemyId: e.enemyId || s.villain.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: e.modifier || 0,
        });
      break;
    case "badoon:assassin":
      if (
        s.minions.some((m) => m.id === e.id) &&
        s.players.some((p) => p.id === e.playerId && !p.eliminated)
      )
        ports.activate(s, {
          enemyId: e.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 2,
        });
      break;
    case "badoon:grunt-deal":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        ports.dealEncounter(s, e.playerId);
      break;
    case "badoon:grunt-enter": {
      const p = [...s.encounter.discard, ...s.resolving].find(
        (q) => q.id === e.id,
      );
      const activation = s.attack || s.scheming;
      if (activation) (activation.retainedBoostIds ||= []).push(e.id);
      if (p) ports.putMinion(s, p, e.playerId);
      break;
    }
    case "badoon:attack-keywords":
      if (s.attack)
        s.attack.badoonKeywords = ["Overkill", "Piercing", "Ranged"];
      break;
    case "badoon:icons": {
      const activation = s.attack || s.scheming;
      if (activation)
        activation.extraBoostIcons =
          (activation.extraBoostIcons || 0) + Number(e.amount || 0);
      break;
    }
    case "badoon:sentry": {
      if (s.villain.tough) {
        const activation = s.attack || s.scheming;
        if (activation)
          activation.extraBoostIcons = (activation.extraBoostIcons || 0) + 2;
      } else ports.giveTough(s);
      break;
    }
    case "badoon:spear-remove": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || !badoonActions(s, p).length)
        throw Error("Drang's Spear can only be discarded in hero form.");
      ports.pay(
        s,
        3,
        ["mental", "physical", "physical"],
        [B("spear-discard", { id: p.id })],
        "Drang's Spear",
        true,
      );
      break;
    }
    case "badoon:spear-discard":
      if (s.attachments.some((q) => q.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "badoon:remove-threat": {
      if (!exhaustMilano(s))
        throw Error("The first player needs the ready Milano for this action.");
      const target = e.main
        ? "main"
        : s.sideSchemes.some((q) => q.id === e.id)
          ? e.id
          : undefined;
      if (target)
        ports.queue(s, {
          type: "thwart",
          target,
          amount: 3,
          source: badoonMilano(s)?.id,
        });
      break;
    }
    case "badoon:milano-damage": {
      if (!exhaustMilano(s))
        throw Error("The first player needs the ready Milano for this action.");
      const milano = badoonMilano(s);
      const minions = [...s.minions];
      if (minions.length === 1)
        ports.queue(s, {
          type: "damage",
          target: minions[0].id,
          amount: 3,
          source: milano?.id,
        });
      else if (minions.length)
        ports.choose(
          s,
          "Protect the Planet",
          "Deal 3 damage to a minion.",
          minions.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [
              { type: "damage", target: m.id, amount: 3, source: milano?.id },
            ],
          })),
        );
      break;
    }
    case "badoon:vessel": {
      const p = (s.environments || []).find((q) => q.id === e.id);
      if (!p || !exhaustMilano(s))
        throw Error("The first player needs the ready Milano for this action.");
      ports.pay(
        s,
        2,
        [],
        [B("vessel-discard", { id: p.id })],
        "Rogue Vessel",
        false,
      );
      break;
    }
    case "badoon:vessel-discard":
      if ((s.environments || []).some((q) => q.id === e.id))
        ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Brotherhood of Badoon effect: ${e.type}`);
  }
  return true;
}

/** Rogue Vessel: deal 1 damage to each player when the villain phase ends. */
export function badoonVillainPhaseEnds(s: GameState): Effect[] {
  return (s.environments || [])
    .filter((p) => p.code === ROGUE_VESSEL && !isTextBlank(s, p))
    .flatMap(() =>
      playerOrder(s).map((seat) => ({
        type: "damage",
        target: "hero",
        amount: 1,
        actorId: seat.id,
        source: "encounter",
      })),
    );
}
