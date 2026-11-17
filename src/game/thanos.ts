import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

/** The Mad Titan's Shadow, scenario 3: Thanos, with his Infinity Gauntlet
 * set and the Children of Thanos modular set. */
export const THANOS_SCENARIO_CODES = [
  "21111",
  "21112",
  "21113",
  "21114a",
  "21114b",
  "21115a",
  "21115b",
  "21116",
  "21117",
  "21118",
  "21119",
  "21120",
  "21121",
  "21122",
  "21123",
  "21124",
] as const;
export const CHILDREN_OF_THANOS_CODES = [
  "21125",
  "21126",
  "21127",
  "21128",
] as const;
export const INFINITY_GAUNTLET_CODES = [
  "21129",
  "21130",
  "21131",
  "21132",
  "21133",
  "21134",
  "21135",
] as const;
export const THANOS_SCRIPT_CODES = [
  ...THANOS_SCENARIO_CODES,
  ...CHILDREN_OF_THANOS_CODES,
  ...INFINITY_GAUNTLET_CODES,
] as const;
export const THANOS_VILLAINS = ["21111", "21112", "21113"] as const;
export const THE_INFINITY_STONES = "21114b";
export const BALANCE_THE_SCALES = "21115a";
export const SANCTUARY = "21116";
/** Side schemes with Victory 1. */
export const THANOS_VICTORY_SCHEMES = ["21116"] as const;
const ARMOR = "21117";
const HELMET = "21118";
const MASTER = "21119";
const AVATAR = "21120";
const DEVIANT = "21121";
const INEVITABLE = "21122";
const MAD_TITAN = "21123";
const THRONE = "21124";
const CORVUS = "21125";
const PROXIMA = "21126";
const EBONY = "21127";
const TRIBUTE = "21128";
export const INFINITY_GAUNTLET = "21129";
export const INFINITY_STONES = [
  "21130",
  "21131",
  "21132",
  "21133",
  "21134",
  "21135",
] as const;
const MIND = "21130";
const POWER = "21131";
const REALITY = "21132";
const SOUL = "21133";
const SPACE = "21134";
const TIME = "21135";

export interface ThanosState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
  /** The Infinity Stone deck, top first, and its own discard pile. */
  stoneDeck: Piece[];
  stoneDiscard: Piece[];
}

export interface ThanosPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  /** Reveal an actual encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  giveTough(s: GameState, p: Piece): boolean;
  healVillain(s: GameState, amount: number): void;
  /** Discard cards from the top of a player's deck through the native
   * exhaustion flow; returns the cards discarded. */
  discardPlayerTop(s: GameState, playerId: string, count: number): Piece[];
  discardRandomHand(s: GameState, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** The printed resources of a card, wild included. */
  resources(s: GameState, p: Piece): Resource[];
  amplify(s: GameState): number;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => definitions.get(p.code)?.type_code;
const T = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `thanos:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (THANOS_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
export const isInfinityStone = (p: Piece | string) =>
  (INFINITY_STONES as readonly string[]).includes(
    typeof p === "string" ? p : p.code,
  );
const isThanos = (s: GameState) =>
  (THANOS_VILLAINS as readonly string[]).includes(s.villain.code);
const attached = (s: GameState, code: string, hostId = s.villain.id) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === hostId && !isTextBlank(s, a),
  );

/** The Infinity Stones in play, in the order they entered. */
export function thanosStonesInPlay(s: GameState): Piece[] {
  return (s.environments || []).filter(isInfinityStone);
}

/** Take the top Infinity Stone. An empty deck reshuffles its discard pile;
 * whenever the deck runs out, Thanos's Forced Response gives him a facedown
 * boost card. */
function takeStone(s: GameState, ports: ThanosPorts): Piece | undefined {
  const th = s.thanos;
  if (!th) return undefined;
  if (!th.stoneDeck.length && th.stoneDiscard.length)
    th.stoneDeck = ports.shuffle(s, th.stoneDiscard.splice(0));
  const p = th.stoneDeck.shift();
  if (p && !th.stoneDeck.length) {
    if (th.stoneDiscard.length)
      th.stoneDeck = ports.shuffle(s, th.stoneDiscard.splice(0));
    if (isThanos(s) && !isTextBlank(s, s.villain)) {
      ports.log(s, "The Infinity Stone deck runs out.", "bad");
      ports.queue(s, T("facedown-boost"));
    }
  }
  return p;
}
function stoneIntoPlay(s: GameState, ports: ThanosPorts) {
  const p = takeStone(s, ports);
  if (!p) return;
  ports.putEnvironment(s, p);
  ports.log(s, `${name(p)} enters play.`, "bad");
}
function discardStone(s: GameState, ports: ThanosPorts, id: string) {
  const th = s.thanos;
  const p = (s.environments || []).find((q) => q.id === id);
  if (!th || !p) return;
  s.environments = (s.environments || []).filter((q) => q.id !== id);
  p.counters = 0;
  p.damage = 0;
  th.stoneDiscard.push(p);
}

/** Thanos's Helmet: Thanos gains retaliate 1. */
export function thanosRetaliate(s: GameState, p: Piece): number {
  if (!s.thanos || p.id !== s.villain.id || !isThanos(s)) return 0;
  return attached(s, HELMET).length;
}
/** Thanos's Armor: when Thanos would take damage, reduce it by 1. */
export function thanosReduceDamage(
  s: GameState,
  targetId: string,
  amount: number,
): number {
  if (!s.thanos || amount <= 0 || targetId !== s.villain.id || !isThanos(s))
    return amount;
  return Math.max(0, amount - attached(s, ARMOR).length);
}
/** Sanctuary: Thanos cannot take damage from player cards. */
export function thanosDamageProhibited(
  s: GameState,
  targetId: string,
  fromPlayerCard: boolean,
): string | undefined {
  if (
    !s.thanos ||
    !fromPlayerCard ||
    targetId !== s.villain.id ||
    !isThanos(s) ||
    !s.sideSchemes.some((p) => p.code === SANCTUARY && !isTextBlank(s, p))
  )
    return undefined;
  return "Sanctuary: Thanos cannot take damage from player cards.";
}

/** Master of the Stones: when Thanos activates. */
export function thanosActivationInitiated(
  s: GameState,
  enemyId: string,
): Effect[] {
  if (!s.thanos || enemyId !== s.villain.id || !isThanos(s)) return [];
  return attached(s, MASTER).map((p) => T("master", { id: p.id }));
}

export interface ThanosActivationReceipt {
  token: string;
  attackerId: string;
  playerId: string;
  performed: boolean;
  defeatedAlly: boolean;
  boostCodes: string[];
}
/** After an activation: Master of the Stones leaves, The Mad Titan's boost
 * and the Infinity Gauntlet's Forced Response. */
export function thanosAfterActivation(
  s: GameState,
  receipt: ThanosActivationReceipt,
): MutagenForcedResponse[] {
  if (!s.thanos || receipt.attackerId !== s.villain.id) return [];
  const responses: MutagenForcedResponse[] = [];
  const masters = s.attachments.filter(
    (a) => a.code === MASTER && a.attachedTo === receipt.attackerId,
  );
  if (masters.length)
    responses.push({
      id: `${receipt.token}:master`,
      title: "Master of the Stones",
      effects: [T("master-end", { ids: masters.map((p) => p.id) })],
    });
  const titans = receipt.boostCodes.filter((c) => c === MAD_TITAN).length;
  if (titans && receipt.defeatedAlly)
    responses.push({
      id: `${receipt.token}:mad-titan`,
      title: "The Mad Titan",
      effects: Array.from({ length: titans }, () => T("stone")),
    });
  const gauntlet = s.attachments.find(
    (a) =>
      a.code === INFINITY_GAUNTLET &&
      a.attachedTo === receipt.attackerId &&
      !isTextBlank(s, a),
  );
  if (gauntlet && receipt.performed && alive(s, receipt.playerId))
    responses.push({
      id: `${receipt.token}:gauntlet`,
      sourceId: gauntlet.id,
      title: "Infinity Gauntlet",
      effects: [
        T("gauntlet", {
          playerId: receipt.playerId,
          actorId: receipt.playerId,
        }),
      ],
    });
  return responses;
}

/** Hero Responses of Thanos's Armor and Helmet after a basic attack against
 * Thanos. */
export function thanosAfterBasicAttack(
  s: GameState,
  targetId: string,
  ports?: Pick<ThanosPorts, "canPay">,
): Effect[] {
  if (!s.thanos || targetId !== s.villain.id || s.player.form !== "hero")
    return [];
  const options = thanosArmorOptions(s, ports);
  return options.length
    ? [T("basic-response", { actorId: s.activePlayerId, mandatory: false })]
    : [];
}
function thanosArmorOptions(
  s: GameState,
  ports?: Pick<ThanosPorts, "canPay">,
): Option[] {
  const out: Option[] = [];
  for (const [code, requirements] of [
    [ARMOR, ["energy", "physical"]],
    [HELMET, ["mental", "physical"]],
  ] as [string, Resource[]][]) {
    const p = attached(s, code)[0];
    if (!p || (ports && !ports.canPay(s, 2, requirements))) continue;
    out.push({
      id: p.id,
      label: `Spend ${requirements.join(" and ")} · discard ${name(p)}`,
      image: p.code,
      effects: [T("armor-pay", { id: p.id })],
    });
  }
  return out;
}

/** Tribute's When Defeated. */
export function thanosSchemeDefeated(
  _s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (p.code === TRIBUTE) return [T("deal", { playerId, actorId: playerId })];
  if (p.code === SANCTUARY)
    return [T("sanctuary", { remaining: undefined, actorId: playerId })];
  return [];
}

/** Setup: the stage I or II villain, then The Infinity Stones (1B). */
export function thanosSetup(s: GameState): Effect[] {
  if (!s.thanos) return [];
  return [
    ...(thanosReveal(s, s.villain) || []),
    ...(thanosReveal(s, s.thanos.currentMain) || []),
  ];
}

export function thanosReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === ARMOR || p.code === HELMET || p.code === MASTER)
    return [T("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "21112":
    case "21113":
      return [T("search", { code: HELMET, discard: true })];
    case THE_INFINITY_STONES:
      return [T("stone"), T("search", { code: SANCTUARY, discard: false })];
    case "21115b":
      return [T("balance")];
    case AVATAR:
      return [
        T("avatar", {
          playerId: s.activePlayerId,
          hero: s.player.form === "hero",
        }),
      ];
    case DEVIANT:
      return [T("deviant")];
    case INEVITABLE:
      return [T("facedown-boost")];
    case MAD_TITAN:
      return [T("stone")];
    case THRONE:
      return [T("throne", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

export function thanosBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case DEVIANT:
      return [T("tough")];
    case INEVITABLE:
      return [T("inevitable")];
    case CORVUS:
      return [
        T("discard-own", {
          types: ["ally", "support"],
          playerId: s.activePlayerId,
          title: "Corvus Glaive",
        }),
      ];
    case PROXIMA:
      return [
        T("discard-own", {
          types: ["ally", "upgrade"],
          playerId: s.activePlayerId,
          title: "Proxima Midnight",
        }),
      ];
    case EBONY:
      return [T("extra-boost")];
    default:
      // The Mad Titan's boost resolves after the attack, from its boost codes.
      return [];
  }
}

/** Proxima Midnight (Children of Thanos): her attacks gain piercing. */
export function thanosKeyword(s: GameState, p: Piece, keyword: string) {
  return (
    keyword === "Piercing" &&
    p.code === PROXIMA &&
    s.minions.some((m) => m.id === p.id) &&
    s.attack?.attacker === p.id &&
    !isTextBlank(s, p)
  );
}

/** Each player who controls cards of these types. */
function ownCards(s: GameState, playerId: string, types: string[]): Piece[] {
  return seatView(s, playerId).player.inPlay.filter(
    (p) =>
      types.includes(typeOf(p) || "") &&
      !definitions.get(p.code)?.permanent &&
      p.ownerId !== undefined,
  );
}

/** Discard the encounter deck until a card matches; stop at the first
 * exhaustion even though the deck is then reshuffled. */
function discardUntil(
  s: GameState,
  ports: ThanosPorts,
  match: (p: Piece) => boolean,
): Piece | undefined {
  for (
    let remaining = s.encounter.deck.length || s.encounter.discard.length;
    remaining > 0;
    remaining--
  ) {
    const { piece, emptied } = ports.discardTop(s);
    if (!piece) return undefined;
    if (match(piece)) return piece;
    if (emptied) return undefined;
  }
  return undefined;
}

function special(
  s: GameState,
  ports: ThanosPorts,
  stone: Piece,
  playerId: string,
) {
  const view = seatView(s, playerId);
  const status = (kind: "stunned" | "confused"): Effect => ({
    type: "status",
    target: "hero",
    status: kind,
    actorId: playerId,
  });
  switch (stone.code) {
    case MIND:
      if (view.player.confused) ports.discardRandomHand(s, playerId);
      else ports.queue(s, status("confused"));
      break;
    case POWER:
      if (view.player.stunned)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 3,
          source: "encounter",
          actorId: playerId,
        });
      else ports.queue(s, status("stunned"));
      break;
    case REALITY:
      ports.queue(
        s,
        T("discard-own", {
          types: ["ally", "upgrade", "support"],
          playerId,
          title: "Reality Stone",
          actorId: playerId,
        }),
      );
      break;
    case SOUL:
      ports.healVillain(s, 3);
      ports.giveBoost(s, s.villain.id, "next");
      break;
    case SPACE: {
      const minion = discardUntil(s, ports, (q) => typeOf(q) === "minion");
      if (minion) ports.putMinion(s, minion, playerId);
      break;
    }
    case TIME: {
      const cards = ports.discardPlayerTop(s, playerId, 4);
      const types = new Set(cards.map((q) => typeOf(q) || ""));
      types.delete("");
      if (types.size)
        ports.queue(s, { type: "threat", target: "main", amount: types.size });
      break;
    }
  }
}

export function resolveThanosEffect(
  s: GameState,
  e: Effect,
  ports: ThanosPorts,
): boolean {
  if (!e.type.startsWith("thanos:")) return false;
  const th = s.thanos;
  switch (e.type) {
    case "thanos:main-back": {
      if (!th) break;
      const main = th.currentMain;
      const back = definitions.get(main.code)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = definitions.get(main.code);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      ports.queue(s, ...(thanosReveal(s, main) || []));
      break;
    }
    case "thanos:stone":
      if (!over(s)) stoneIntoPlay(s, ports);
      break;
    case "thanos:facedown-boost":
      if (isThanos(s)) ports.giveBoost(s, s.villain.id, "next");
      break;
    case "thanos:search": {
      ports.revealHidden(s);
      const zones = e.discard
        ? [s.encounter.deck, s.encounter.discard]
        : [s.encounter.deck];
      let found: Piece | undefined;
      for (const zone of zones) {
        const i = zone.findIndex((q) => q.code === e.code);
        if (i >= 0) {
          found = zone.splice(i, 1)[0];
          break;
        }
      }
      ports.shuffleEncounter(s);
      if (found) ports.reveal(s, found, e.actorId || s.activePlayerId);
      break;
    }
    case "thanos:attach": {
      const p = e.piece as Piece;
      if (isThanos(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "thanos:master": {
      // Forced Interrupt: put the top Infinity Stone into play.
      if (s.attachments.some((a) => a.id === e.id)) stoneIntoPlay(s, ports);
      break;
    }
    case "thanos:master-end":
      for (const id of (e.ids as string[]) || [])
        if (s.attachments.some((a) => a.id === id)) ports.discardPiece(s, id);
      break;
    case "thanos:gauntlet": {
      if (over(s) || !alive(s, e.playerId)) break;
      const stones = thanosStonesInPlay(s);
      if (!stones.length) {
        stoneIntoPlay(s, ports);
        break;
      }
      ports.queue(
        s,
        ...stones.map((p) =>
          T("special", { id: p.id, playerId: e.playerId, actorId: e.playerId }),
        ),
      );
      break;
    }
    case "thanos:special": {
      const stone = (s.environments || []).find((q) => q.id === e.id);
      if (!stone || over(s)) break;
      const blank = isTextBlank(s, stone);
      // Place this card in the Infinity Stone deck discard pile.
      discardStone(s, ports, stone.id);
      if (!blank && alive(s, e.playerId)) {
        ports.log(s, `${name(stone)} resolves its Special ability.`, "bad");
        special(s, ports, stone, e.playerId);
      }
      break;
    }
    case "thanos:throne": {
      const stones = thanosStonesInPlay(s);
      if (!stones.length) break;
      if (stones.length === 1) {
        discardStone(s, ports, stones[0].id);
        break;
      }
      ports.choose(
        s,
        "The Titan's Throne",
        "Choose an Infinity Stone in play to discard.",
        stones.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [T("discard-stone", { id: p.id })],
        })),
      );
      break;
    }
    case "thanos:discard-stone":
      discardStone(s, ports, e.id);
      break;
    case "thanos:avatar": {
      if (!alive(s, e.playerId) || over(s)) break;
      const before = s.attack?.id;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      // That attack gains overkill and piercing.
      if (
        s.attack &&
        s.attack.attacker === s.villain.id &&
        s.attack.id !== before
      ) {
        s.attack.overkill = true;
        s.attack.piercing = true;
      }
      break;
    }
    case "thanos:deviant": {
      if (!isThanos(s)) break;
      if (!s.villain.tough && ports.giveTough(s, s.villain)) break;
      ports.queue(s, { type: "threat", target: "main", amount: 2 });
      break;
    }
    case "thanos:tough":
      if (isThanos(s)) ports.giveTough(s, s.villain);
      break;
    case "thanos:inevitable": {
      // Discard the top Infinity Stone; apply its boost icons as if it were a
      // boost card for this activation.
      const activation = s.attack || s.scheming;
      const p = takeStone(s, ports);
      if (!p || !th) break;
      th.stoneDiscard.push(p);
      const icons = (definitions.get(p.code)?.boost || 0) + ports.amplify(s);
      ports.log(
        s,
        `"I Am Inevitable" discards ${name(p)}: +${icons} boost icon${icons === 1 ? "" : "s"}.`,
        "bad",
      );
      if (activation)
        activation.extraBoostIcons = (activation.extraBoostIcons || 0) + icons;
      break;
    }
    case "thanos:extra-boost": {
      const activation = s.attack || s.scheming;
      if (activation) ports.giveBoost(s, activation.attacker, "current");
      break;
    }
    case "thanos:discard-own": {
      if (!alive(s, e.playerId)) break;
      const cards = ownCards(s, e.playerId, e.types as string[]);
      if (!cards.length) break;
      if (cards.length === 1) {
        ports.discardPiece(s, cards[0].id);
        break;
      }
      ports.choose(
        s,
        String(e.title || "Discard"),
        `${ports.heroName(s, e.playerId)}: choose a card you control to discard.`,
        cards.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [{ type: "discardPiece", id: p.id, actorId: e.playerId }],
        })),
      );
      break;
    }
    case "thanos:balance": {
      // Each player shuffles their discard pile into their deck, then removes
      // the top half of their deck (rounded down) from the game.
      ports.revealHidden(s);
      for (const seat of playerOrder(s)) {
        const p = seatView(s, seat).player;
        p.deck = ports.shuffle(s, [...p.deck, ...p.discard.splice(0)]);
        const removed = p.deck.splice(0, Math.floor(p.deck.length / 2));
        s.removed.push(...removed);
        ports.log(
          s,
          `${ports.heroName(s, seat.id)} removes ${removed.length} cards from the game.`,
          "bad",
        );
      }
      break;
    }
    case "thanos:deal":
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      break;
    case "thanos:sanctuary": {
      // When Defeated: each player may spend up to 3 physical resources from
      // their hand; 2 damage to Thanos for each, ignoring tough.
      const remaining: string[] =
        e.remaining ?? playerOrder(s).map((seat) => seat.id);
      const [playerId, ...rest] = remaining;
      if (!playerId) break;
      const next = T("sanctuary", { remaining: rest, actorId: rest[0] });
      if (!alive(s, playerId) || !isThanos(s)) {
        ports.queue(s, next);
        break;
      }
      ports.queue(
        s,
        T("sanctuary-spend", { playerId, spent: 0, next, actorId: playerId }),
      );
      break;
    }
    case "thanos:sanctuary-spend": {
      const spent = Number(e.spent) || 0;
      const physical = (p: Piece) =>
        ports.resources(s, p).filter((r) => r === "physical" || r === "wild")
          .length;
      const hand = seatView(s, e.playerId).player.hand.filter(
        (p) => physical(p) > 0,
      );
      const finish = [
        ...(spent && isThanos(s)
          ? [
              {
                type: "damage",
                target: s.villain.id,
                amount: 2 * spent,
                source: SANCTUARY,
                ignoreTough: true,
                actorId: e.playerId,
              },
            ]
          : []),
        e.next,
      ];
      if (spent >= 3 || !hand.length || !isThanos(s)) {
        ports.queue(s, ...finish);
        break;
      }
      ports.choose(
        s,
        "Sanctuary",
        `${ports.heroName(s, e.playerId)}: spend up to ${3 - spent} more physical resource${3 - spent === 1 ? "" : "s"} from your hand. Thanos takes 2 damage for each.`,
        [
          ...hand.map((p) => ({
            id: p.id,
            label: `Spend ${name(p)} · ${physical(p)} physical`,
            image: p.code,
            effects: [
              T("sanctuary-card", {
                id: p.id,
                playerId: e.playerId,
                spent,
                next: e.next,
                actorId: e.playerId,
              }),
            ],
          })),
          {
            id: "done",
            label: spent
              ? `Done · ${2 * spent} damage to Thanos`
              : "Spend nothing",
            effects: finish,
          },
        ],
      );
      break;
    }
    case "thanos:sanctuary-card": {
      const view = seatView(s, e.playerId).player;
      const i = view.hand.findIndex((p) => p.id === e.id);
      if (i < 0) break;
      const [p] = view.hand.splice(i, 1);
      view.discard.push(p);
      const count = ports
        .resources(s, p)
        .filter((r) => r === "physical" || r === "wild").length;
      ports.queue(
        s,
        T("sanctuary-spend", {
          playerId: e.playerId,
          spent: Math.min(3, (Number(e.spent) || 0) + count),
          next: e.next,
          actorId: e.playerId,
        }),
      );
      break;
    }
    case "thanos:basic-response": {
      const options = thanosArmorOptions(s, ports);
      if (!options.length) break;
      ports.choose(s, "Thanos's armor", "Discard a piece of Thanos's armor?", [
        ...options,
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    }
    case "thanos:armor-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error(`${name(e.id)} is no longer attached.`);
      ports.pay(
        s,
        2,
        p.code === ARMOR ? ["energy", "physical"] : ["mental", "physical"],
        [{ type: "discardPiece", id: p.id }],
        name(p),
        true,
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
