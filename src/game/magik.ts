import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const M = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`magik:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const identity = (s: GameState) =>
  s.heroId === "magik" &&
  !isTextBlank(s, {
    id: `hero:${s.activePlayerId}`,
    code: s.player.form === "hero" ? "45030a" : "45030b",
  });
const trait = (p: Piece, name: string) =>
  (card(p).traits || "")
    .split(/\.\s*/)
    .some((t) => t.toLowerCase() === name.toLowerCase());
export const MAGIK_SCRIPT_CODES = [
  "45030a",
  "45030b",
  ...Array.from({ length: 28 }, (_, i) => String(45031 + i)),
].filter((c) => c !== "45047");

export interface MagikPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  targets(
    s: GameState,
    group: string,
    action?: boolean,
  ): { id: string; label: string; code?: string }[];
  find(s: GameState, id: string): Piece | undefined;
  hasTrait(s: GameState, id: string, name: string): boolean;
  makePiece(s: GameState, code: string): Piece;
  hidden(s: GameState): void;
  recycle(s: GameState): void;
  mill(s: GameState, amount: number): Piece[];
  discard(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  discardLooked(s: GameState, p: Piece): void;
  shuffleEncounter(s: GameState): void;
  put(s: GameState, p: Piece): void;
  canPut(s: GameState, p: Piece): boolean;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  canActivate(s: GameState, p: Piece): boolean;
  activate(s: GameState, p: Piece, after: Effect): void;
  startingHP(s: GameState): number;
  canHeal(s: GameState, id: string): boolean;
  canDefend(s: GameState): boolean;
  cost(s: GameState, p: Piece): number;
  canPay(s: GameState, cost: number, exclude?: string, code?: string): boolean;
  playReaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
  ): void;
  playAllyReaction(s: GameState, p: Piece, after: Effect[]): void;
  canTakeDamageCost(s: GameState, amount: number): boolean;
  takeDamageCost(s: GameState, amount: number): boolean;
  damageResponses(s: GameState, amount: number): Effect[];
  feedback(s: GameState): Effect[];
  cancelReveal(s: GameState, p: Piece): void;
  drawEncounter(s: GameState): Piece | undefined;
}

/** RRG 1.8 p64: a blanked identity's top card is facedown, including its icons. */
export function magikRevealedTop(s: GameState): Piece | undefined {
  return identity(s) && s.player.form === "hero" ? s.player.deck[0] : undefined;
}
export function magikTopPlayable(s: GameState): Piece | undefined {
  return s.flags.magikTopPhase !== phase(s) &&
    !Object.keys(s.flags).some((k) => k.startsWith("magikPending:")) &&
    ["player", "villain"].includes(s.phase)
    ? magikRevealedTop(s)
    : undefined;
}
export function magikPending(s: GameState, p: { id?: string }) {
  return (
    s.flags[`magikPending:${p.id}`] === phase(s) &&
    s.flags.magikTopPhase !== phase(s) &&
    s.resolving.some((q) => q.id === p.id)
  );
}
export function magikDiscount(s: GameState, p: { id?: string }) {
  if (!p.id) return 0;
  return Number(magikPending(s, p) || magikTopPlayable(s)?.id === p.id);
}
/** Place the card on the table at initiation step 3, before payment. The next
 * top card is now the public source for constants and conditional effects. */
export function magikBeginTopPlay(s: GameState, p: Piece): boolean {
  if (magikPending(s, p)) return true;
  if (magikTopPlayable(s)?.id !== p.id) return false;
  s.player.deck.shift();
  s.resolving.push(p);
  s.flags[`magikPending:${p.id}`] = phase(s);
  return true;
}
export function magikTakePending(s: GameState, id: string): Piece | undefined {
  const i = s.resolving.findIndex((p) => p.id === id && magikPending(s, p));
  if (i < 0) return;
  const p = s.resolving.splice(i, 1)[0];
  need(
    s.flags[`magikPending:${id}`] === phase(s) &&
      s.flags.magikTopPhase !== phase(s),
    "The staged Magik play is no longer in its available phase.",
  );
  s.flags.magikTopPhase = String(s.flags[`magikPending:${id}`]);
  delete s.flags[`magikPending:${id}`];
  return p;
}
export function magikHasPending(s: GameState) {
  return Object.keys(s.flags).some((key) => key.startsWith("magikPending:"));
}
export function magikTopHas(s: GameState, resource: Resource) {
  const p = magikRevealedTop(s);
  return !!p && !!(card(p)[`resource_${resource}`] || card(p).resource_wild);
}
export function magikStats(s: GameState) {
  const hero = s.heroId === "magik" && s.player.form === "hero";
  return {
    attack: Number(
      hero && live(s, "45034").length > 0 && magikTopHas(s, "physical"),
    ),
    thwart: Number(
      hero && live(s, "45033").length > 0 && magikTopHas(s, "mental"),
    ),
    defense: Number(
      hero && live(s, "45035").length > 0 && magikTopHas(s, "energy"),
    ),
    steady: hero && live(s, "45033").length > 0,
    piercing: hero && live(s, "45034").length > 0,
    retaliate: Number(hero && live(s, "45035").length > 0),
  };
}
export function magikInitialize(s: GameState, make: MagikPorts["makePiece"]) {
  if (s.heroId !== "magik" || s.flags.magikInitialized) return;
  for (const code of ["45054", "45055", "45056", "45057", "45058"]) {
    const p = make(s, code);
    p.ownerId = s.activePlayerId;
    (s.player.setAside ||= []).push(p);
  }
  s.flags.magikInitialized = true;
}
export function magikBeforeFlip(
  s: GameState,
  counts: boolean,
  target?: string,
): Effect[] | null {
  if (
    !identity(s) ||
    s.player.form !== "alter" ||
    target === "alter" ||
    s.flags.magikFlipPhase === phase(s)
  )
    return null;
  const spells = s.player.discard.filter((p) => trait(p, "Spell"));
  if (!spells.length) return null;
  return [M("flip-window", { counts, target })];
}
export function magikAbilityOptions(s: GameState, id: string): Option[] {
  const p = s.player.inPlay.find((p) => p.id === id && !isTextBlank(s, p));
  return p?.code === "45032" &&
    !p.exhausted &&
    s.player.hand.length &&
    s.player.deck.length
    ? [
        O(
          "limbo",
          "Limbo · swap a hand card with the top card",
          [M("limbo", { id })],
          p.code,
        ),
      ]
    : [];
}
export function magikResourceSources(
  s: GameState,
  canTake: (s: GameState, n: number) => boolean,
): PaymentSource[] {
  return live(s, "45050")
    .filter((p) => !p.exhausted && canTake(s, 2))
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Bloodgem",
      resources: ["wild"],
      kind: "ability",
      description:
        "Exhaust Bloodgem and take 2 damage to generate a wild resource.",
    }));
}
export function magikResourceSpent(
  s: GameState,
  id: string,
  ports: MagikPorts,
): Effect[] | null {
  const p = s.player.inPlay.find((p) => p.id === id);
  if (p?.code !== "45050") return null;
  need(
    !p.exhausted && !isTextBlank(s, p) && ports.canTakeDamageCost(s, 2),
    "Bloodgem requires its full 2 damage cost.",
  );
  p.exhausted = true;
  need(ports.takeDamageCost(s, 2), "Bloodgem's damage cost was not paid.");
  return ports.damageResponses(s, 2);
}
export function magikPlayRestriction(
  s: GameState,
  p: Piece,
  ports: MagikPorts,
): string | null {
  if (
    ["45042", "45049"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "X-Men")
  )
    return "Your identity must have the X-Men trait.";
  if (
    ["45050", "45051", "45052"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Mystic")
  )
    return "Your identity must have the Mystic trait.";
  if (p.code === "45040") return "Available when an enemy initiates an attack.";
  if (p.code === "45038" && !ports.targets(s, "scheme", true).length)
    return "Exorcism requires a scheme that can be thwarted.";
  if (
    ["45039", "45045"].includes(p.code) &&
    !ports.targets(s, "enemy", true).length
  )
    return "This attack requires a legal enemy.";
  if (
    p.code === "45036" &&
    !s.player.deck.some((q) => q.id !== p.id) &&
    !(magikTopPlayable(s)?.id === p.id && s.player.discard.length)
  )
    return "Scrying requires at least one card remaining in your deck.";
  return null;
}
export function magikEvent(
  s: GameState,
  p: Piece,
  ports: Pick<MagikPorts, "startingHP">,
): Effect[] | null {
  switch (p.code) {
    case "45036":
      return [M("scry")];
    case "45037":
      return [E("ready", { target: "hero" }), M("stepping")];
    case "45038":
      return [
        E("target", {
          group: "scheme",
          thwart: true,
          title: "Exorcism",
          action: M("exorcism"),
        }),
      ];
    case "45039":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Soul Strike",
          action: M("soul-strike"),
        }),
      ];
    case "45045":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Full-Body Charge",
          action: E("damage", {
            amount: 8,
            attack: true,
            attackInitiated: true,
            overkill: s.player.hp < ports.startingHP(s) / 2,
            source: "hero",
          }),
        }),
      ];
    case "45051":
      return [M("basic-spell")];
    default:
      return null;
  }
}
export function magikEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "45049") p.counters = 3;
  return p.code === "45048" ? [M("triage", { id: p.id })] : [];
}
export function magikVillainPhase(s: GameState): Effect[] {
  return playerOrder(s).flatMap((seat) =>
    live(seatView(s, seat), "45032")
      .filter(
        (p) =>
          !p.exhausted &&
          seatView(s, seat).player.hand.length &&
          seatView(s, seat).player.deck.length,
      )
      .map((p) => M("limbo-window", { id: p.id, actorId: seat.id })),
  );
}
export function magikAttackOptions(
  s: GameState,
  stage: "initiated" | "attacks",
  after: Effect[],
  ports: MagikPorts,
): Option[] {
  const a = s.attack;
  if (
    !a ||
    !ports.canDefend(s) ||
    (a.originalPlayerId || a.targetPlayerId || s.activePlayerId) !==
      s.activePlayerId ||
    a.eventDefense ||
    (a.defender && a.defender !== "none") ||
    !ports.targets(s, "enemy").some((t) => t.id === a.attacker)
  )
    return [];
  const top = magikTopPlayable(s);
  return [...s.player.hand, ...(top ? [top] : [])]
    .filter((p) => ["45031", "45040"].includes(p.code))
    .flatMap((p) => {
      if (p.code === "45040" && s.player.form !== "hero") return [];
      if ((p.code === "45040") !== (stage === "initiated")) return [];
      if (p.code === "45031" && !ports.canPut(s, p)) return [];
      if (!ports.canPay(s, ports.cost(s, p), p.id, p.code)) return [];
      return [
        O(
          p.id,
          `Play ${card(p).name}${top?.id === p.id ? " from the top of your deck" : ""}`,
          [M("defense-play", { id: p.id, code: p.code, after })],
          p.code,
        ),
      ];
    });
}
export function magikSchemeOptions(s: GameState, after: Effect[]): Option[] {
  return live(s, "45042").map((p) =>
    O(
      p.id,
      "Discard Tempus · cancel the villain's scheme",
      [M("tempus", { id: p.id, after })],
      p.code,
    ),
  );
}
export function magikRevealOptions(
  s: GameState,
  p: Piece,
  playerId: string,
): Option[] {
  if (card(p).type_code !== "treachery") return [];
  return live(s, "45049")
    .filter((q) => !q.exhausted && q.counters > 0)
    .map((q) =>
      O(
        q.id,
        "Stepford Cuckoos · cancel and reveal another encounter",
        [M("cuckoos", { id: q.id, piece: p, playerId })],
        q.code,
      ),
    );
}
export function magikBasicDefeat(
  s: GameState,
  source: string,
  attack: boolean,
  basic: boolean,
): Effect[] {
  return attack &&
    basic &&
    !s.currentEventId &&
    (source === "hero" || source === `hero:${s.activePlayerId}`)
    ? live(s, "45043")
        .filter((p) => !p.exhausted)
        .map((p) => M("blood-rage-window", { id: p.id, mandatory: false }))
    : [];
}
export function magikAttackPlayed(s: GameState, p: Piece): Effect[] {
  return trait(p, "Attack")
    ? live(s, "45044").map((q) =>
        M("test-window", { id: q.id, mandatory: false }),
      )
    : [];
}
export function magikAllyAttackOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
): Option[] {
  if (
    p.code !== "45041" ||
    isTextBlank(s, p) ||
    p.stunned ||
    packet.magikGoldballsHandled ||
    packet.kind !== "attack"
  )
    return [];
  return Array.from({ length: Math.min(3, s.player.deck.length) + 1 }, (_, n) =>
    O(
      String(n),
      `Discard ${n} cards · +${n} ATK`,
      [M("goldballs", { id: p.id, amount: n, packet })],
      p.code,
    ),
  );
}
export function magikCanRemoveThreat(s: GameState, id: string) {
  return !s.sideSchemes.some(
    (p) =>
      p.id === id &&
      p.code === "45055" &&
      !isTextBlank(s, p) &&
      s.minions.some((m) => m.code === "45054"),
  );
}
export function magikEncounter(_s: GameState, p: Piece): Effect[] | null {
  return ["45053", "45054", "45055", "45056", "45057", "45058"].includes(p.code)
    ? [M("encounter", { piece: p })]
    : null;
}
export function magikBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== "45058") return null;
  const ruler = s.sideSchemes.find((q) => q.code === "45055");
  return ruler ? [E("threat", { target: ruler.id, amount: 2 })] : [];
}
export function magikShadows(s: GameState): Effect[] | null {
  if (s.heroId !== "magik") return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  return [M("shadows")];
}
export function magikActivated(
  s: GameState,
  id: string,
  defeatedAlly = false,
): Effect[] {
  const p = s.minions.find((p) => p.id === id && !isTextBlank(s, p));
  return p?.code === "45054"
    ? [M("belasco")]
    : p?.code === "45057" && defeatedAlly
      ? [M("witchfire")]
      : [];
}
export function magikSideDefeated(_s: GameState, p: Piece): Effect[] {
  if (p.code !== "45055" || isTextBlank(_s, p)) return [];
  const limbo = (p.storedCards || []).filter((q) => q.code === "45032");
  p.storedCards = (p.storedCards || []).filter((q) => q.code !== "45032");
  _s.resolving.push(...limbo);
  return limbo.map((q) => M("free-limbo", { id: q.id, ownerId: q.ownerId }));
}

function chooseTarget(
  s: GameState,
  title: string,
  group: string,
  action: Effect,
  ports: MagikPorts,
  filter: (id: string) => boolean = () => true,
) {
  const opts = ports
    .targets(s, group, group === "enemy" || group === "scheme")
    .filter((t) => filter(t.id))
    .map((t) => O(t.id, t.label, [{ ...action, target: t.id }], t.code));
  if (opts.length) ports.choose(s, title, "Choose a target.", opts);
}
export function resolveMagikEffect(
  s: GameState,
  e: Effect,
  ports: MagikPorts,
): boolean {
  if (!e.type.startsWith("magik:")) return false;
  const q = (...effects: Effect[]) => ports.queue(s, ...effects);
  switch (e.type) {
    case "magik:flip-window": {
      if (
        !identity(s) ||
        s.player.form !== "alter" ||
        s.flags.magikFlipPhase === phase(s)
      ) {
        q(
          E("flip", { counts: e.counts, target: e.target, magikHandled: true }),
        );
        break;
      }
      const spells = s.player.discard.filter((p) => trait(p, "Spell"));
      ports.choose(
        s,
        "Illyana Rasputin",
        "Put a Spell from your discard pile on top before changing form?",
        [
          ...spells.map((p) =>
            O(
              p.id,
              card(p).name,
              [
                M("flip-spell", {
                  id: p.id,
                  counts: e.counts,
                  target: e.target,
                }),
              ],
              p.code,
            ),
          ),
          O("pass", "Change form without the interrupt", [
            E("flip", {
              counts: e.counts,
              target: e.target,
              magikHandled: true,
            }),
          ]),
        ],
      );
      break;
    }
    case "magik:flip-spell": {
      need(
        identity(s) &&
          s.player.form === "alter" &&
          s.flags.magikFlipPhase !== phase(s),
        "Illyana's interrupt is unavailable.",
      );
      const i = s.player.discard.findIndex(
        (p) => p.id === e.id && trait(p, "Spell"),
      );
      need(i >= 0, "The actual Spell is no longer in discard.");
      s.player.deck.unshift(s.player.discard.splice(i, 1)[0]);
      s.flags.magikFlipPhase = phase(s);
      q(
        ...ports.feedback(s),
        E("flip", { counts: e.counts, target: e.target, magikHandled: true }),
      );
      break;
    }
    case "magik:limbo-window":
      if (
        !s.player.inPlay.some(
          (p) =>
            p.id === e.id &&
            p.code === "45032" &&
            !p.exhausted &&
            !isTextBlank(s, p),
        ) ||
        !s.player.hand.length ||
        !s.player.deck.length
      )
        break;
      q(
        E("optional", {
          title: "Limbo",
          text: "Exhaust Limbo to swap a hand card with your top card?",
          effects: [M("limbo", { id: e.id, response: true })],
        }),
      );
      break;
    case "magik:limbo": {
      const p = ports.find(s, e.id);
      need(
        p &&
          p.code === "45032" &&
          !p.exhausted &&
          !isTextBlank(s, p) &&
          s.player.hand.length &&
          s.player.deck.length,
        "Limbo cannot swap these cards.",
      );
      ports.choose(
        s,
        "Limbo",
        "Choose the hand card to swap with the physical top card.",
        s.player.hand.map((c) =>
          O(
            c.id,
            card(c).name,
            [
              M("swap", {
                id: e.id,
                handId: c.id,
                topId: s.player.deck[0].id,
                response: e.response,
              }),
            ],
            c.code,
          ),
        ),
      );
      break;
    }
    case "magik:swap": {
      const p = ports.find(s, e.id),
        i = s.player.hand.findIndex((p) => p.id === e.handId);
      need(
        p &&
          !p.exhausted &&
          !isTextBlank(s, p) &&
          i >= 0 &&
          s.player.deck[0]?.id === e.topId,
        "The selected swap changed.",
      );
      p!.exhausted = true;
      [s.player.hand[i], s.player.deck[0]] = [
        s.player.deck[0],
        s.player.hand[i],
      ];
      ports.hidden(s);
      if (e.response) q(...ports.feedback(s));
      break;
    }
    case "magik:scry": {
      const ids = s.player.deck.slice(0, 3).map((p) => p.id);
      ports.hidden(s);
      q(M("scry-operation", { ids, remaining: ["draw", "discard", "top"] }));
      break;
    }
    case "magik:scry-operation": {
      const ids = (e.ids as string[]).filter((id) =>
        s.player.deck.some((p) => p.id === id),
      );
      if (!ids.length) break;
      const remaining = e.remaining as string[];
      ports.choose(
        s,
        "Scrying",
        ids.length < remaining.length
          ? "Choose which remaining instruction to resolve with these cards."
          : "Assign the next looked-at card.",
        remaining.map((op) =>
          O(
            op,
            op === "draw"
              ? "Draw one"
              : op === "discard"
                ? "Discard one"
                : "Put one back on top",
            [M("scry-card", { ids, remaining, op })],
          ),
        ),
      );
      break;
    }
    case "magik:scry-card": {
      const cards = (e.ids as string[])
        .map((id) => s.player.deck.find((p) => p.id === id))
        .filter((p): p is Piece => !!p);
      ports.choose(
        s,
        "Scrying",
        `Choose a card to ${e.op === "top" ? "put on top" : e.op}.`,
        cards.map((p) =>
          O(
            p.id,
            card(p).name,
            [
              M("scry-move", {
                ids: e.ids,
                remaining: e.remaining,
                op: e.op,
                id: p.id,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "magik:scry-move": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      need(i >= 0, "The looked-at card moved.");
      const p = s.player.deck.splice(i, 1)[0];
      const after = M("scry-operation", {
        ids: (e.ids as string[]).filter((id) => id !== e.id),
        remaining: (e.remaining as string[]).filter((op) => op !== e.op),
      });
      if (e.op === "draw") {
        s.player.deck.unshift(p);
        q(E("draw", { amount: 1 }), after);
      } else {
        if (e.op === "discard") ports.discardLooked(s, p);
        else s.player.deck.unshift(p);
        ports.recycle(s);
        q(after);
      }
      break;
    }
    case "magik:stepping": {
      const cards = s.player.discard.filter(
        (p) => card(p).set_code === "magik" && p.code !== "45037",
      );
      if (cards.length)
        ports.choose(
          s,
          "Stepping Disc",
          "Put a Magik card on top of your deck.",
          cards.map((p) =>
            O(p.id, card(p).name, [M("discard-to-top", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "magik:discard-to-top": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.deck.unshift(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "magik:exorcism":
      q(
        E("thwart", { target: e.target, amount: 4, source: "hero" }),
        M("exorcism-status"),
      );
      break;
    case "magik:exorcism-status":
      if (magikTopHas(s, "mental"))
        q(E("status", { target: s.villain.id, status: "confused" }));
      break;
    case "magik:soul-strike":
      q(
        E("damage", {
          target: e.target,
          amount: 4,
          attack: true,
          attackInitiated: true,
          source: "hero",
        }),
        M("strike-status", { target: e.target }),
      );
      break;
    case "magik:strike-status":
      if (magikTopHas(s, "physical"))
        q(E("status", { target: e.target, status: "stunned" }));
      break;
    case "magik:basic-spell": {
      const heals = ports
        .targets(s, "friendly")
        .filter(
          (t) =>
            (t.id === "hero" || t.id.startsWith("hero:")) &&
            ports.canHeal(s, t.id),
        );
      ports.choose(s, "Basic Spell", "Choose one effect.", [
        ...(heals.length
          ? [O("heal", "Heal 3 damage from an identity", [M("spell-heal")])]
          : []),
        ...(ports.targets(s, "scheme", true).length
          ? [
              O("thwart", "Remove 3 threat from a scheme", [
                E("target", {
                  group: "scheme",
                  title: "Basic Spell",
                  action: E("thwart", { amount: 3, source: "hero" }),
                }),
              ]),
            ]
          : []),
        ...(ports.targets(s, "enemy").length
          ? [
              O("damage", "Deal 3 damage to an enemy", [
                E("target", {
                  group: "enemy",
                  title: "Basic Spell",
                  action: E("damage", { amount: 3, source: "hero" }),
                }),
              ]),
            ]
          : []),
      ]);
      break;
    }
    case "magik:spell-heal":
      chooseTarget(
        s,
        "Basic Spell",
        "friendly",
        E("heal", { amount: 3 }),
        ports,
        (id) =>
          (id === "hero" || id.startsWith("hero:")) && ports.canHeal(s, id),
      );
      break;
    case "magik:triage":
      if (
        !ports
          .targets(s, "friendly")
          .some(
            (t) => ports.hasTrait(s, t.id, "X-Men") && ports.canHeal(s, t.id),
          )
      )
        break;
      q(
        E("optional", {
          title: "Triage",
          text: "Heal 2 damage from an X-Men character?",
          effects: [M("triage-target")],
        }),
      );
      break;
    case "magik:triage-target":
      chooseTarget(
        s,
        "Triage",
        "friendly",
        E("heal", { amount: 2 }),
        ports,
        (id) => ports.hasTrait(s, id, "X-Men") && ports.canHeal(s, id),
      );
      break;
    case "magik:defense-play": {
      const p = s.player.hand.find((p) => p.id === e.id) || magikTopPlayable(s);
      need(
        p && p.id === e.id,
        "The actual defense card is no longer available.",
      );
      if (p!.code === "45031") ports.playAllyReaction(s, p!, e.after || []);
      else ports.playReaction(s, p!, [M("barrier")], e.after || []);
      break;
    }
    case "magik:barrier":
      q(
        E("preventAttack", { amount: 3 }),
        ...(magikTopHas(s, "energy") && s.attack
          ? [
              E("damage", {
                target: s.attack.attacker,
                amount: 3,
                source: "hero",
              }),
            ]
          : []),
      );
      break;
    case "magik:colossus-defender": {
      const p = ports.find(s, e.id);
      if (!p || !s.attack) break;
      s.attack.defender = p.id;
      s.attack.targetPlayerId = s.activePlayerId;
      s.attack.basicDefense = false;
      s.attack.defense = 0;
      s.attack.eventDefense = true;
      s.attack.mutantProtectorsDefender = {
        allyId: p.id,
        playerId: s.activePlayerId,
      };
      q(...ports.feedback(s), ...(e.after || []));
      break;
    }
    case "magik:tempus": {
      if (e.activationToken)
        delete s.flags[`colossusActivation:${e.activationToken}`];
      const p = ports.find(s, e.id);
      need(
        p?.code === "45042" && !isTextBlank(s, p!),
        "Tempus is no longer available.",
      );
      ports.discard(s, e.id);
      q(E("dealEncounter"), ...(e.after || []));
      break;
    }
    case "magik:cuckoos": {
      const p = ports.find(s, e.id);
      need(
        p && !p.exhausted && p.counters > 0 && !isTextBlank(s, p),
        "Stepford Cuckoos cannot pay its costs.",
      );
      p!.exhausted = true;
      p!.counters--;
      ports.cancelReveal(s, e.piece);
      if (!p!.counters) ports.discard(s, p!.id);
      q(M("replacement", { playerId: e.playerId }));
      break;
    }
    case "magik:replacement": {
      const p = ports.drawEncounter(s);
      if (p)
        q(
          E("reveal", {
            piece: p,
            fromEncounterDeck: true,
            actorId: e.playerId,
          }),
        );
      break;
    }
    case "magik:blood-rage-window": {
      const p = ports.find(s, e.id);
      if (
        p &&
        !p.exhausted &&
        !isTextBlank(s, p) &&
        ports.canTakeDamageCost(s, 1)
      )
        q(
          E("optional", {
            title: "Blood Rage",
            text: "Exhaust Blood Rage and take 1 damage to draw 1 card?",
            effects: [M("blood-rage", { id: p.id })],
          }),
        );
      break;
    }
    case "magik:blood-rage": {
      const p = ports.find(s, e.id);
      need(
        p &&
          !p.exhausted &&
          !isTextBlank(s, p) &&
          ports.canTakeDamageCost(s, 1),
        "Blood Rage cannot pay its costs.",
      );
      p!.exhausted = true;
      need(
        ports.takeDamageCost(s, 1),
        "Blood Rage's damage cost was not paid.",
      );
      q(...ports.damageResponses(s, 1), E("draw", { amount: 1 }));
      break;
    }
    case "magik:test-window": {
      const p = ports.find(s, e.id);
      if (p && !isTextBlank(s, p))
        q(
          E("optional", {
            title: "Test the Defense",
            text: "Place 1 test counter? At 5, discard it to deal 5 damage.",
            effects: [M("test", { id: p.id })],
          }),
        );
      break;
    }
    case "magik:test": {
      const p = ports.find(s, e.id);
      if (!p || isTextBlank(s, p)) break;
      p.counters++;
      if (p.counters === 5) {
        ports.discard(s, p.id);
        q(
          E("target", {
            group: "enemy",
            title: "Test the Defense",
            action: E("damage", { amount: 5, source: p.id }),
          }),
        );
      }
      break;
    }
    case "magik:goldballs": {
      const p = ports.find(s, e.id);
      need(
        p &&
          p.code === "45041" &&
          !isTextBlank(s, p) &&
          Number.isInteger(e.amount) &&
          e.amount >= 0 &&
          e.amount <= 3 &&
          s.player.deck.length >= e.amount,
        "Goldballs requires the chosen number of top cards.",
      );
      const cards = ports.mill(s, e.amount);
      q({
        ...e.packet,
        magikGoldballsHandled: true,
        amount: Number(e.packet.amount || 0) + cards.length,
      });
      break;
    }
    case "magik:encounter": {
      const p = e.piece as Piece;
      if (p.code === "45053") q(M("obligation", { piece: p }));
      else if (p.code === "45055") q(M("capture-limbo", { id: p.id }));
      else if (p.code === "45056") q(M("limbo-threat", { amount: 2 }));
      else if (p.code === "45058") {
        const a = s.minions.filter((p) => trait(p, "Limbo"));
        q(
          M("battle-next", {
            ids: a.map((p) => p.id),
            index: 0,
            activated: 0,
            playerId: s.activePlayerId,
          }),
        );
      }
      break;
    }
    case "magik:obligation": {
      ports.choose(
        s,
        "Darkchilde",
        "You may change to alter-ego before choosing its consequence.",
        [
          ...(s.player.form === "hero"
            ? [
                O(
                  "alter",
                  "Change to Illyana Rasputin",
                  [
                    E("flip", { counts: false, target: "alter" }),
                    M("obligation-choose", { piece: e.piece }),
                  ],
                  "45030b",
                ),
              ]
            : []),
          O("stay", "Stay in current form", [
            M("obligation-choose", { piece: e.piece }),
          ]),
        ],
      );
      break;
    }
    case "magik:obligation-choose":
      ports.choose(s, "Darkchilde", "Choose a consequence.", [
        ...(s.player.form === "alter" && !s.player.exhausted
          ? [
              O("remove", "Exhaust Illyana · remove Darkchilde", [
                E("exhaust", { id: "hero" }),
                M("remove-obligation", { id: e.piece.id }),
              ]),
            ]
          : []),
        O("damage", "Deal 1 damage to each character you control", [
          ...ports
            .targets(s, "controlled")
            .map((t) =>
              E("damage", { target: t.id, amount: 1, source: e.piece.id }),
            ),
        ]),
      ]);
      break;
    case "magik:remove-obligation": {
      const i = s.resolving.findIndex((p) => p.id === e.id);
      if (i >= 0) s.removed.push(s.resolving.splice(i, 1)[0]);
      else {
        const d = s.encounter.discard.findIndex((p) => p.id === e.id);
        if (d >= 0) s.removed.push(s.encounter.discard.splice(d, 1)[0]);
      }
      break;
    }
    case "magik:capture-limbo": {
      const ruler = s.sideSchemes.find((p) => p.id === e.id);
      if (!ruler) break;
      const owner = playerOrder(s).find((p) => p.heroId === "magik");
      if (!owner) break;
      const view = seatView(s, owner);
      let limbo: Piece | undefined;
      for (const zone of [
        view.player.inPlay,
        view.player.hand,
        view.player.deck,
        view.player.discard,
      ]) {
        const i = zone.findIndex((p) => p.code === "45032");
        if (i >= 0) {
          limbo = zone.splice(i, 1)[0];
          break;
        }
      }
      if (limbo) {
        limbo.ownerId = owner.id;
        (ruler.storedCards ||= []).push(limbo);
      }
      break;
    }
    case "magik:free-limbo": {
      const i = s.resolving.findIndex((p) => p.id === e.id);
      if (i < 0) break;
      const p = s.resolving.splice(i, 1)[0];
      const view = e.ownerId ? seatView(s, e.ownerId) : s;
      if (ports.canPut(view, p)) ports.put(view, p);
      else view.player.discard.push(p);
      break;
    }
    case "magik:belasco": {
      const ruler = s.sideSchemes.find((p) => p.code === "45055");
      const cards = ports.mill(s, 3);
      if (ruler)
        for (const p of cards) {
          for (const zone of [s.player.discard, s.player.deck]) {
            const i = zone.findIndex((q) => q.id === p.id);
            if (i >= 0) {
              (ruler.storedCards ||= []).push(zone.splice(i, 1)[0]);
              break;
            }
          }
        }
      break;
    }
    case "magik:witchfire":
      q(M("limbo-threat", { amount: 1 }));
      break;
    case "magik:limbo-threat":
      q(
        E("threat", {
          target: s.sideSchemes.find((p) => p.code === "45055")?.id || "main",
          amount: e.amount,
        }),
      );
      break;
    case "magik:battle-next": {
      const ids = e.ids as string[];
      if (e.index >= ids.length) {
        if (!e.activated) q(E("surge", { actorId: e.playerId }));
        break;
      }
      const p = s.minions.find((p) => p.id === ids[e.index]);
      if (!p) {
        q({ ...e, index: e.index + 1 });
        break;
      }
      q(
        M("battle-activate", {
          ids: e.ids,
          index: e.index,
          activated: e.activated,
          playerId: e.playerId,
          id: p.id,
          actorId: p.engagedWith || s.activePlayerId,
        }),
      );
      break;
    }
    case "magik:battle-activate": {
      const p = s.minions.find((p) => p.id === e.id),
        after = M("battle-after", {
          ids: e.ids,
          index: e.index + 1,
          activated: e.activated,
          playerId: e.playerId,
          actorId: e.playerId,
        });
      if (!p || !ports.canActivate(s, p)) q({ ...after, performed: false });
      else ports.activate(s, p, after);
      break;
    }
    case "magik:battle-after":
      q(
        M("battle-next", {
          ids: e.ids,
          index: e.index,
          activated: e.activated + Number(!!e.performed),
          playerId: e.playerId,
          actorId: e.playerId,
        }),
      );
      break;
    case "magik:shadows": {
      const zone = s.player.setAside || [];
      const take = (code: string) => {
        const i = zone.findIndex((p) => p.code === code);
        return i >= 0 ? zone.splice(i, 1)[0] : ports.makePiece(s, code);
      };
      const belasco = take("45054"),
        ruler = take("45055");
      ports.putMinion(s, belasco, s.activePlayerId);
      q(E("reveal", { piece: ruler }));
      s.encounter.deck.push(take("45056"), take("45057"), take("45058"));
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Magik effect ${e.type}`);
  }
  return true;
}
