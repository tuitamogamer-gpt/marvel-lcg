import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

/** The Mad Titan's Shadow: the Ebony Maw scenario and its two default modular
 * sets, Black Order and Armies of Titan. */
export const EBONY_MAW_SCENARIO_CODES = [
  "21071",
  "21072",
  "21073",
  "21074a",
  "21074b",
  "21075a",
  "21075b",
  "21076",
  "21077",
  "21078",
  "21079",
  "21080",
  "21081",
  "21082",
  "21083",
  "21084",
] as const;
export const BLACK_ORDER_CODES = ["21085", "21086", "21087", "21088"] as const;
export const ARMIES_OF_TITAN_CODES = ["21089", "21090", "21091"] as const;
export const EBONY_MAW_SCRIPT_CODES = [
  ...EBONY_MAW_SCENARIO_CODES,
  ...BLACK_ORDER_CODES,
  ...ARMIES_OF_TITAN_CODES,
] as const;
export const EBONY_MAW_VILLAINS = ["21071", "21072", "21073"] as const;
/** Each Spell environment and the invocation counters it enters play with. */
export const EBONY_MAW_SPELLS: Readonly<Record<string, number>> = {
  "21076": 4,
  "21077": 2,
  "21078": 3,
  "21079": 3,
};
const ABJURATION = "21082";
export const RESTRAINED = "21083";
const BLACK_DWARF = "21085";
const SUPERGIANT = "21086";
const THE_BLACK_ORDER = "21087";
const INFANTRY = "21089";
const OUTRIDER = "21090";
const LANDING_CRAFT = "21091";

export interface EbonyMawState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}

/** One friendly character, in player order. */
export interface EbonyMawCharacter {
  id: string;
  label: string;
  code?: string;
  playerId: string;
  type: "hero" | "alter_ego" | "ally";
}

export interface EbonyMawPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  giveTough(s: GameState, id: string): boolean;
  /** Shuffle the encounter discard pile into the encounter deck. */
  shuffleDiscardIntoDeck(s: GameState): void;
  /** Every friendly character of every player, in player order. */
  characters(s: GameState): EbonyMawCharacter[];
  characterAttack(s: GameState, id: string): number;
  exhaustCharacter(s: GameState, id: string): void;
  /** Discard cards at random from the active player's hand. */
  discardRandomHand(s: GameState, count: number): void;
  /** Move the actual instance from its encounter zone into play. */
  putEnvironment(s: GameState, p: Piece): void;
  heroName(s: GameState, playerId: string): string;
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ebony:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (EBONY_MAW_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const isEbonyMaw = (s: GameState) =>
  (EBONY_MAW_VILLAINS as readonly string[]).includes(s.villain.code);
const hasTrait = (p: Piece, trait: string) =>
  (definitions.get(p.code)?.traits || "")
    .split(".")
    .some((t: string) => t.trim() === trait);

export function isEbonyMawSpell(p: Piece | string) {
  return (typeof p === "string" ? p : p.code) in EBONY_MAW_SPELLS;
}
/** The Spell environments in a player's play area. */
export function ebonyMawSpells(s: GameState, playerId: string): Piece[] {
  return (s.environments || []).filter(
    (p) => isEbonyMawSpell(p) && p.playAreaOf === playerId,
  );
}
/** A revealed or put Spell enters its player's play area with its counters. */
export function ebonyMawPutSpell(
  s: GameState,
  p: Piece,
  playerId: string,
  put: (s: GameState, p: Piece) => void,
) {
  put(s, p);
  p.playAreaOf = playerId;
  p.counters = EBONY_MAW_SPELLS[p.code] ?? 0;
}

/** Restrained: the attached character cannot ready. */
export function ebonyMawRestrained(s: GameState, characterId: string) {
  return s.attachments.some(
    (p) =>
      p.code === RESTRAINED &&
      p.attachedTo === characterId &&
      !isTextBlank(s, p),
  );
}
/** The Black Order: threat cannot be removed while a Black Order minion is in
 * play. */
export function ebonyMawSchemeLocked(s: GameState, target: string) {
  const scheme = s.sideSchemes.find((p) => p.id === target);
  return (
    !!scheme &&
    scheme.code === THE_BLACK_ORDER &&
    !isTextBlank(s, scheme) &&
    s.minions.some((m) => hasTrait(m, "Black Order"))
  );
}
/** Black Dwarf's attacks gain overkill. */
export function ebonyMawKeyword(s: GameState, p: Piece, keyword: string) {
  return (
    keyword === "Overkill" &&
    p.code === BLACK_DWARF &&
    s.minions.some((m) => m.id === p.id) &&
    s.attack?.attacker === p.id &&
    !isTextBlank(s, p)
  );
}

/** Abjuration prevents all damage to Ebony Maw. Returns the damage that
 * remains and whether Abjuration must now be discarded: after it prevents 2 or
 * more damage from a single attack. */
export function ebonyMawPreventDamage(
  s: GameState,
  targetId: string,
  amount: number,
  attackKey?: string,
): { amount: number; discardId?: string; prevented: number } {
  if (amount <= 0 || targetId !== s.villain.id || !isEbonyMaw(s))
    return { amount, prevented: 0 };
  const shield = s.attachments.find(
    (p) =>
      p.code === ABJURATION &&
      p.attachedTo === s.villain.id &&
      !isTextBlank(s, p),
  );
  if (!shield) return { amount, prevented: 0 };
  if (!attackKey) return { amount: 0, prevented: amount };
  const key = `abjuration:${attackKey}:${shield.id}`;
  const total = Number(s.flags[key] || 0) + amount;
  s.flags[key] = total;
  return {
    amount: 0,
    prevented: amount,
    discardId: total >= 2 ? shield.id : undefined,
  };
}

/** Ebony Maw's Forced Interrupt: when he activates against you, remove an
 * invocation counter from each Spell in your play area. A stunned or confused
 * Ebony Maw removes the status card instead of activating, so this never
 * triggers then (scenario rules clarification). */
export function ebonyMawActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    !s.ebonyMaw ||
    enemyId !== s.villain.id ||
    !isEbonyMaw(s) ||
    isTextBlank(s, s.villain) ||
    !ebonyMawSpells(s, playerId).length
  )
    return [];
  return [M("invoke", { playerId, actorId: playerId })];
}

/** Supergiant: after it attacks and damages a character, stun it. */
export function ebonyMawAfterAttack(
  s: GameState,
  receipt: {
    token: string;
    attackerId: string;
    attackerCode: string;
    targetId?: string;
    damageTaken: number;
    performed: boolean;
    textBlank: boolean;
    playerId: string;
  },
): MutagenForcedResponse[] {
  if (
    receipt.attackerCode !== SUPERGIANT ||
    !receipt.performed ||
    receipt.textBlank ||
    !receipt.targetId ||
    receipt.damageTaken <= 0
  )
    return [];
  return [
    {
      id: `${receipt.token}:supergiant`,
      sourceId: receipt.attackerId,
      title: "Supergiant",
      effects: [
        {
          type: "status",
          target: receipt.targetId,
          status: "stunned",
          actorId: receipt.playerId,
        },
      ],
    },
  ];
}

/** Black Order Infantry's When Defeated, in any scenario that uses Armies of
 * Titan. */
export function ebonyMawMinionDefeated(p: Piece): Effect[] {
  return p.code === INFANTRY ? [M("tough")] : [];
}

/** Landing Craft's When Defeated. */
export function ebonyMawSchemeDefeated(
  _s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === LANDING_CRAFT
    ? [M("landing-craft", { playerId, actorId: playerId })]
    : [];
}

/** Every player discards until a Spell, in player order. */
function spellEach(s: GameState, after: Effect[] = []): Effect {
  return M("spell-each", {
    remaining: playerOrder(s).map((seat) => seat.id),
    after,
  });
}

export function ebonyMawReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === ABJURATION) return [M("attach-villain", { piece: p })];
  if (p.code === RESTRAINED)
    return [M("restrain", { piece: p, playerId: s.activePlayerId })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "21072":
    case "21073":
    case "21074b":
      return [spellEach(s, p.code === "21074b" ? [M("shuffle-discard")] : [])];
    case "21075a":
      return [M("shuffle-discard"), spellEach(s)];
    case "21080":
      return [
        M("agent", {
          playerId: s.activePlayerId,
          hero: s.player.form === "hero",
        }),
      ];
    case "21081":
      return [M("trance", { playerId: s.activePlayerId })];
    case "21084":
      return [
        M("reactor", {
          id: p.id,
          remaining: playerOrder(s).map((seat) => seat.id),
        }),
      ];
    case "21088":
      return [M("blood", { remaining: playerOrder(s).map((x) => x.id) })];
    case OUTRIDER:
      return [M("random-discard", { actorId: s.activePlayerId })];
    default:
      return [];
  }
}

export function ebonyMawBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case INFANTRY:
      return [M("tough")];
    case OUTRIDER:
      return [M("random-discard", { actorId: s.activePlayerId })];
    default:
      return [];
  }
}

/** Restrained's Hero Action. */
export function ebonyMawActions(
  s: GameState,
  p: Piece,
  ports?: Pick<EbonyMawPorts, "canPay">,
): Option[] {
  if (
    p.code !== RESTRAINED ||
    isTextBlank(s, p) ||
    s.player.form !== "hero" ||
    !s.attachments.some((a) => a.id === p.id) ||
    (ports && !ports.canPay(s, 2, ["energy", "physical"] as Resource[]))
  )
    return [];
  return [
    {
      id: "remove",
      label: "Spend energy and physical · discard Restrained",
      image: p.code,
      effects: [M("restrained-pay", { id: p.id })],
    },
  ];
}

/** Discard the encounter deck from the top until a card matches; stop at the
 * first exhaustion even though the deck is then reshuffled. */
function discardUntil(
  s: GameState,
  ports: EbonyMawPorts,
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

function putSpell(s: GameState, ports: EbonyMawPorts, playerId: string) {
  const spell = discardUntil(s, ports, isEbonyMawSpell);
  if (!spell) return;
  // Put into play, not revealed: Surge does not resolve.
  ebonyMawPutSpell(s, spell, playerId, ports.putEnvironment);
}

function removeInvocations(
  s: GameState,
  ports: EbonyMawPorts,
  playerId: string,
) {
  const spells = ebonyMawSpells(s, playerId).filter((p) => p.counters > 0);
  const fired: Piece[] = [];
  for (const p of spells) {
    p.counters -= 1;
    if (!p.counters) fired.push(p);
  }
  // Forced Response: after the last invocation counter is removed.
  ports.queue(
    s,
    ...fired.map((p) => M("spell-fire", { id: p.id, actorId: playerId })),
  );
}

export function resolveEbonyMawEffect(
  s: GameState,
  e: Effect,
  ports: EbonyMawPorts,
): boolean {
  if (!e.type.startsWith("ebony:")) return false;
  switch (e.type) {
    case "ebony:main-back": {
      if (!s.ebonyMaw) break;
      const main = s.ebonyMaw.currentMain;
      const back = definitions.get(main.code)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = definitions.get(main.code);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      break;
    }
    case "ebony:spell-each": {
      const [playerId, ...rest] = (e.remaining as string[]) || [];
      if (!playerId) {
        ports.queue(s, ...((e.after as Effect[]) || []));
        break;
      }
      if (alive(s, playerId)) putSpell(s, ports, playerId);
      ports.queue(s, M("spell-each", { remaining: rest, after: e.after }));
      break;
    }
    case "ebony:shuffle-discard":
      ports.shuffleDiscardIntoDeck(s);
      break;
    case "ebony:invoke":
      if (alive(s, e.playerId)) removeInvocations(s, ports, e.playerId);
      break;
    case "ebony:spell-fire": {
      const p = (s.environments || []).find((q) => q.id === e.id);
      if (!p || p.counters > 0) break;
      const owner = p.playAreaOf || s.activePlayerId;
      const code = p.code;
      const blank = isTextBlank(s, p);
      ports.discardPiece(s, p.id);
      if (blank || !alive(s, owner)) break;
      switch (code) {
        case "21076":
          ports.queue(s, {
            type: "damage",
            target: "hero",
            amount: 4,
            source: "encounter",
            actorId: owner,
          });
          break;
        case "21077":
          ports.queue(s, M("random-discard", { actorId: owner }), {
            type: "status",
            target: "hero",
            status: "confused",
            actorId: owner,
          });
          break;
        case "21078":
          ports.queue(s, M("pacify", { actorId: owner }), {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: owner,
          });
          break;
        case "21079":
          ports.queue(s, M("rubble", { actorId: owner }));
          break;
      }
      break;
    }
    case "ebony:pacify":
      // Exhaust each upgrade you control.
      for (const p of s.player.inPlay)
        if (definitions.get(p.code)?.type_code === "upgrade")
          p.exhausted = true;
      break;
    case "ebony:rubble":
      for (const c of ports
        .characters(s)
        .filter((c) => c.playerId === s.activePlayerId))
        ports.queue(s, {
          type: "damage",
          target: c.id.startsWith("hero:") ? "hero" : c.id,
          amount: 2,
          source: "encounter",
          actorId: s.activePlayerId,
        });
      break;
    case "ebony:random-discard":
      ports.discardRandomHand(s, 1);
      break;
    case "ebony:agent": {
      if (!alive(s, e.playerId)) break;
      const count = ebonyMawSpells(s, e.playerId).length;
      if (!count) {
        ports.queue(s, {
          type: "surge",
          sourceCode: "21080",
          actorId: e.playerId,
        });
        break;
      }
      ports.queue(
        s,
        e.hero
          ? {
              type: "damage",
              target: "hero",
              amount: count,
              source: "encounter",
              actorId: e.playerId,
            }
          : { type: "threat", target: "main", amount: count },
      );
      break;
    }
    case "ebony:trance":
      if (!alive(s, e.playerId)) break;
      if (ebonyMawSpells(s, e.playerId).length)
        removeInvocations(s, ports, e.playerId);
      else putSpell(s, ports, e.playerId);
      break;
    case "ebony:attach-villain": {
      const p = e.piece as Piece;
      if (isEbonyMaw(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "ebony:restrain": {
      const p = e.piece as Piece;
      const candidates = ports
        .characters(s)
        .filter((c) => c.type !== "alter_ego" && alive(s, c.playerId));
      const value = (c: EbonyMawCharacter) => ports.characterAttack(s, c.id);
      const top = Math.max(...candidates.map(value));
      const tied = candidates.filter((c) => value(c) === top);
      if (!tied.length) {
        // No friendly character has an ATK to attach to.
        ports.discardPiece(s, p.id);
        break;
      }
      if (tied.length === 1)
        ports.queue(s, M("restrain-to", { piece: p, id: tied[0].id }));
      else
        ports.choose(
          s,
          name(p),
          "Choose the friendly character tied for the highest ATK.",
          tied.map((c) => ({
            id: c.id,
            label: `${c.label} · ATK ${value(c)}`,
            image: c.code,
            effects: [M("restrain-to", { piece: p, id: c.id })],
          })),
        );
      break;
    }
    case "ebony:restrain-to": {
      const p = e.piece as Piece;
      if (!ports.characters(s).some((c) => c.id === e.id)) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, e.id);
      ports.exhaustCharacter(s, e.id);
      break;
    }
    case "ebony:restrained-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("Restrained is no longer attached.");
      ports.pay(
        s,
        2,
        ["energy", "physical"],
        [{ type: "discardPiece", id: p.id }],
        "Restrained",
        true,
      );
      break;
    }
    case "ebony:reactor": {
      const [playerId, ...rest] = (e.remaining as string[]) || [];
      if (!playerId) break;
      const next = M("reactor", { id: e.id, remaining: rest });
      const scheme = s.sideSchemes.find((q) => q.id === e.id);
      if (!alive(s, playerId)) {
        ports.queue(s, next);
        break;
      }
      const damage = {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "encounter",
        actorId: playerId,
      };
      if (!scheme) {
        // Without the side scheme, the only choice left is the damage.
        ports.queue(s, damage, next);
        break;
      }
      ports.queue(
        s,
        M("reactor-choice", { id: e.id, playerId, next, actorId: playerId }),
      );
      break;
    }
    case "ebony:reactor-choice": {
      ports.choose(
        s,
        "Reactor Overload",
        `${ports.heroName(s, e.playerId)}: take 2 damage or place 2 threat on Reactor Overload.`,
        [
          {
            id: "damage",
            label: "Take 2 damage",
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: 2,
                source: "encounter",
                actorId: e.playerId,
              },
              e.next,
            ],
          },
          {
            id: "threat",
            label: "Place 2 threat on Reactor Overload",
            image: "21084",
            effects: [{ type: "threat", target: e.id, amount: 2 }, e.next],
          },
        ],
      );
      break;
    }
    case "ebony:tough":
      ports.giveTough(s, s.villain.id);
      break;
    case "ebony:landing-craft": {
      const minion = discardUntil(
        s,
        ports,
        (q) => definitions.get(q.code)?.type_code === "minion",
      );
      if (minion && alive(s, e.playerId))
        ports.putMinion(s, minion, e.playerId);
      break;
    }
    case "ebony:blood": {
      // Each minion engaged with a player activates against that player.
      const activations = (e.remaining as string[])
        .filter((id) => alive(s, id))
        .flatMap((playerId) =>
          s.minions
            .filter((m) => m.engagedWith === playerId)
            .map((m) => ({ minionId: m.id, playerId })),
        );
      ports.queue(
        s,
        M("blood-activate", {
          activations,
          after: M("blood-search", {
            remaining: e.remaining,
            actorId: (e.remaining as string[])[0],
          }),
        }),
      );
      break;
    }
    case "ebony:blood-activate": {
      const [next, ...rest] =
        (e.activations as { minionId: string; playerId: string }[]) || [];
      if (!next) {
        ports.queue(s, e.after);
        break;
      }
      const after = M("blood-activate", { activations: rest, after: e.after });
      const minion = s.minions.find(
        (m) => m.id === next.minionId && m.engagedWith === next.playerId,
      );
      if (!minion || !alive(s, next.playerId)) {
        ports.queue(s, after);
        break;
      }
      ports.activate(s, {
        enemyId: minion.id,
        playerId: next.playerId,
        kind:
          seatView(s, next.playerId).player.form === "hero"
            ? "attack"
            : "scheme",
        modifier: 0,
        after,
      });
      break;
    }
    case "ebony:blood-search": {
      // Each player who is not engaged with a minion searches the encounter
      // deck and discard pile for a Black Order minion.
      const [playerId, ...rest] = (e.remaining as string[]) || [];
      if (!playerId) {
        ports.revealHidden(s);
        ports.shuffleEncounter(s);
        break;
      }
      const next = M("blood-search", {
        remaining: rest,
        actorId: rest[0] || s.firstPlayerId,
      });
      if (
        !alive(s, playerId) ||
        s.minions.some((m) => m.engagedWith === playerId)
      ) {
        ports.queue(s, next);
        break;
      }
      ports.revealHidden(s);
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (q) =>
          definitions.get(q.code)?.type_code === "minion" &&
          hasTrait(q, "Black Order"),
      );
      const distinct = [
        ...new Map(found.map((q) => [q.code, q] as const)).values(),
      ];
      if (!distinct.length) {
        ports.queue(s, next);
        break;
      }
      if (distinct.length === 1) {
        ports.queue(s, next);
        ports.putMinion(s, distinct[0], playerId);
        break;
      }
      ports.choose(
        s,
        "Blood to Spare",
        `${ports.heroName(s, playerId)}: choose a Black Order minion to engage you.`,
        distinct.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [M("blood-put", { id: q.id, playerId, next })],
        })),
      );
      break;
    }
    case "ebony:blood-put": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      ports.queue(s, e.next);
      if (p && alive(s, e.playerId)) ports.putMinion(s, p, e.playerId);
      break;
    }
    default:
      return false;
  }
  return true;
}

/** A defeated player's Spells and Restrained leave play with them. */
export function ebonyMawPlayerEliminated(
  s: GameState,
  playerId: string,
  discard: (s: GameState, id: string) => void,
) {
  for (const p of ebonyMawSpells(s, playerId)) discard(s, p.id);
  for (const p of s.attachments.filter(
    (q) => q.code === RESTRAINED && q.attachedTo === `hero:${playerId}`,
  ))
    discard(s, p.id);
}
