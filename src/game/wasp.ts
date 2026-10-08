import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder } from "./team.js";
import { consumeStatus } from "./keywords.js";
import type { AntManPorts, AntManForm } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const W = (type: string, args: Record<string, unknown> = {}) =>
  E(`wasp:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const definition = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const active = (s: GameState) => ["wsp", "wasp"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const optional = (title: string, text: string, effects: Effect[]) =>
  E("optional", { title, text, effects });

export type WaspForm = AntManForm;
export type WaspPower = "attack" | "thwart" | "defense";
export interface WaspPacket {
  target: string;
  amount: number;
}
export interface WaspDistributionOptions {
  basic: boolean;
  piercing: boolean;
  overkill?: boolean;
  metadata?: Partial<Effect>;
}
export interface WaspPorts extends AntManPorts {
  select(
    s: GameState,
    title: string,
    text: string,
    pieces: Piece[],
    min: number,
    max: number,
    action: Effect,
  ): void;
  cardCost(s: GameState, p: Piece): number;
  heroStat(s: GameState, power: WaspPower): number;
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  /** Commit the entire legal target snapshot simultaneously, then open the
   * native defeat/retaliate windows. Status has already been checked once. */
  attackDistribution(
    s: GameState,
    packets: WaspPacket[],
    options: WaspDistributionOptions,
  ): void;
  /** Reuse the native simultaneous threat-removal/side-scheme defeat path. */
  thwartDistribution(
    s: GameState,
    packets: WaspPacket[],
    metadata?: Partial<Effect>,
  ): void;
  /** Native packet prevention: supports enemy attacks, overkill and direct
   * damage without restarting the packet or bypassing its other interrupts. */
  preventDamage(s: GameState, packet: Effect | undefined, amount: number): void;
  startEnemyAttack(s: GameState, id: string, modifier: number): boolean;
  /** Finish the pending actual defeat, including normal native responses and
   * attachment cleanup. If shuffle, recycle that SAME Beetle into encounter. */
  finishMinionDefeat(
    s: GameState,
    id: string,
    source: string,
    attack: boolean,
    shuffle: boolean,
  ): void;
}
export const WASP_SCRIPT_CODES = [
  "13001a",
  "13001b",
  "13001c",
  "13002",
  "13003",
  "13004",
  "13005",
  "13006",
  "13007",
  "13008",
  "13009",
  "13010",
  "13020",
  "13026",
  "13027",
  "13028",
  "13029",
  "13030",
] as const;
export const WASP_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export function waspForm(s: GameState): WaspForm {
  return s.player.form === "alter" ? "alter" : s.player.heroForm || "tiny";
}
const sizedHero = (s: GameState) =>
  s.player.form === "hero" &&
  (active(s) || ["ant", "ant_man"].includes(s.heroId) || !!s.player.heroForm);
const applicableForm = (s: GameState): WaspForm =>
  sizedHero(s) ? waspForm(s) : "alter";

/** Host passes its text-active view, matching the other native stat adapters. */
export function waspStats(s: GameState) {
  const helmet = s.player.inPlay.filter((p) => p.code === "13010").length;
  return {
    attack: applicableForm(s) === "tiny" ? helmet : 0,
    thwart: applicableForm(s) === "giant" ? helmet : 0,
    defense: 0,
  };
}
export function waspAllyStats(s: GameState, p: Piece) {
  return {
    attack: p.code === "13002" && applicableForm(s) === "giant" ? 1 : 0,
    thwart: p.code === "13002" && applicableForm(s) === "tiny" ? 1 : 0,
  };
}
export function waspAllyTraits(s: GameState, p: Piece): string[] {
  const form = applicableForm(s);
  return p.code === "13002" && form !== "alter"
    ? [form === "giant" ? "Giant" : "Tiny"]
    : [];
}
/** Host supplies the same text-active view used for native stat modifiers. */
export function waspHeroTraits(s: GameState): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "13009")
    ? ["Aerial"]
    : [];
}
export function waspRetaliate(s: GameState): number {
  return applicableForm(s) === "giant"
    ? s.player.inPlay.filter((p) => p.code === "13008").length
    : 0;
}
export function waspBasicPiercing(s: GameState): boolean {
  return (
    applicableForm(s) === "tiny" &&
    s.player.inPlay.some((p) => p.code === "13008")
  );
}
export function waspEnemyHP(s: GameState, p: Piece): number {
  return (
    s.attachments.filter(
      (a) => a.code === "13029" && a.attachedTo === p.id && !isTextBlank(s, a),
    ).length * 4
  );
}
/** Mother's Orders adds a resource cost for every hero, before exhaustion. */
export function waspBasicAttackCost(s: GameState): number {
  return s.sideSchemes.filter((p) => p.code === "13027" && !isTextBlank(s, p))
    .length;
}
export function waspPlayRestriction(
  s: GameState,
  p: Piece,
  ports: WaspPorts,
): string | null {
  if (p.code === "13005")
    return "Rapid Growth can only be played when using a basic ATK, THW, or DEF power.";
  if (!["13003", "13004", "13006"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "13006" && applicableForm(s) === "alter")
    return "Wasp Sting requires Tiny or Giant hero form.";
  if (
    p.code === "13003" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Giant Help has no legal scheme to thwart.";
  if (
    ["13004", "13006"].includes(p.code) &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "This attack has no legal enemy target.";
  return null;
}
export function waspEvent(_s: GameState, p: Piece): Effect[] | null {
  const type = (
    { "13003": "giant-help", "13004": "pinpoint", "13006": "sting" } as Record<
      string,
      string
    >
  )[p.code];
  return type ? [W(type)] : null;
}
export function waspResourceSpent(
  s: GameState,
  p: Piece,
  ports: WaspPorts,
): Effect[] {
  if (p.code !== "13007" || !sizedHero(s) || ports.isTextBlank(s, p)) return [];
  const giant = applicableForm(s) === "giant";
  return [
    optional(
      "Pym Particles",
      giant ? "Heal 2 damage from your hero?" : "Draw 1 card?",
      [E(giant ? "heal" : "draw", { target: "hero", amount: giant ? 2 : 1 })],
    ),
  ];
}

export function waspAbilityOptions(
  s: GameState,
  id: string,
  _ports: WaspPorts,
): Option[] {
  return ["hero", "identity"].includes(id) &&
    active(s) &&
    s.player.form === "alter" &&
    s.flags.waspGirlRound !== s.round &&
    s.player.discard.some((p) => definition(p)?.resource_mental)
    ? [
        option(
          "girl",
          "G.I.R.L. · shuffle up to 2 mental-resource cards into your deck",
          [W("girl")],
          "13001b",
        ),
      ]
    : [];
}
export function waspAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: WaspPorts,
): Effect[] | null {
  const choices = waspAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}

/** Upgrades are extensions of the identity (RRG p49); allies and supports are
 * separate characters/sources. Events must belong to this actual player. */
export function waspDefeated(
  s: GameState,
  kind: "minion" | "side_scheme",
  source: string,
  eventId = s.currentEventId,
  attack = false,
): Effect[] {
  if (!active(s) || waspForm(s) !== "tiny") return [];
  const event = s.resolving.find(
    (p) =>
      p.id === eventId &&
      definition(p)?.type_code === "event" &&
      (!p.ownerId || p.ownerId === s.activePlayerId),
  );
  const extension = allInPlay(s).find(
    (p) =>
      p.id === source &&
      definition(p)?.type_code === "upgrade" &&
      controller(s, p.id)?.id === s.activePlayerId &&
      // RRG p49 excludes another friendly character, not enemies or schemes.
      !(
        s.players.some(
          (seat) =>
            seat.id !== s.activePlayerId && p.attachedTo === `hero:${seat.id}`,
        ) ||
        allInPlay(s).some(
          (target) =>
            target.id === p.attachedTo &&
            definition(target)?.type_code === "ally",
        )
      ),
  );
  const identity =
    (source === "hero" || source === `hero:${s.activePlayerId}`) &&
    (!eventId || !!event);
  const playedEvent =
    !!event &&
    ["hero", `hero:${s.activePlayerId}`, event.id, event.code].includes(source);
  if (!identity && !playedEvent && !extension) return [];
  return [
    {
      ...optional(
        "Small but Mighty",
        `Deal 1 damage to the villain after defeating this ${kind === "minion" ? "minion" : "side scheme"}?`,
        [W("small-mighty")],
      ),
      mandatory: false,
      afterAttack: attack,
    },
  ];
}

/** Host has committed exhaustion and any additional resource cost. */
export function waspBasicPower(
  s: GameState,
  power: "attack" | "thwart",
  bonus = 0,
  options: { overkill?: boolean; metadata?: Partial<Effect> } = {},
): Effect[] | null {
  return active(s) && s.player.form === "hero"
    ? [
        W("basic", {
          power,
          bonus,
          overkill: !!options.overkill,
          metadata: options.metadata,
        }),
      ]
    : null;
}
function rapidOptions(
  s: GameState,
  power: WaspPower,
  after: Effect[],
  used: string[],
  ports: WaspPorts,
): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "13005" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Rapid Growth · change to Giant and get +2 to this basic power",
        [W("rapid-pay", { id: p.id, power, after, used })],
        p.code,
      ),
    );
}
export function waspDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: WaspPorts,
): Option[] {
  return s.attack?.basicDefense &&
    s.attack.defender === "hero" &&
    (!s.attack.targetPlayerId || s.attack.targetPlayerId === s.activePlayerId)
    ? rapidOptions(s, "defense", after, [], ports)
    : [];
}
export function waspDamageOptions(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
  after: Effect[],
  ports: WaspPorts,
): Option[] {
  if (!active(s) || waspForm(s) !== "tiny" || amount <= 0 || s.player.tough)
    return [];
  if (
    packet?.target &&
    !["hero", `hero:${s.activePlayerId}`].includes(packet.target)
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "13009" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      option(
        p.id,
        "Bio-Synthetic Wings · exhaust, prevent 1 damage",
        [W("wings", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}

function select(
  s: GameState,
  title: string,
  targets: ReturnType<WaspPorts["enemyTargets"]>,
  effect: Effect,
  ports: WaspPorts,
) {
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...effect, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
function beginDistribution(
  s: GameState,
  title: string,
  power: "attack" | "thwart",
  amount: number,
  basic: boolean,
  ports: WaspPorts,
  overkill = false,
  metadata?: Partial<Effect>,
) {
  const legal =
    power === "attack"
      ? ports.enemyTargets(s, true)
      : ports.schemeTargets(s, true);
  if (!legal.length || amount <= 0) return;
  ports.queue(
    s,
    W("divide", {
      title,
      power,
      remaining: amount,
      total: amount,
      basic,
      overkill,
      piercing: basic && waspBasicPiercing(s),
      legal,
      packets: [],
      metadata,
    }),
  );
}

export function waspEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "13026": {
      const owner = playerOrder(s).find((seat) =>
        ["wsp", "wasp"].includes(seat.heroId),
      );
      return owner ? [W("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "13027":
    case "13028":
      return [];
    case "13029":
      return [W("armor", { id: p.id })];
    case "13030":
      return [W("mania")];
    default:
      return null;
  }
}
/** Native engine calls this before discarding Beetle, with the defeating actor
 * active. Its erratum requires that player, not the first player, to choose. */
export function waspDefeatInterrupt(
  s: GameState,
  p: Piece,
  source: string,
  attack: boolean,
): Effect[] | null {
  return p.code === "13028" && !isTextBlank(s, p)
    ? [W("beetle-defeat", { id: p.id, source, attack, mandatory: true })]
    : null;
}

export function resolveWaspEffect(
  s: GameState,
  e: Effect,
  ports: WaspPorts,
): boolean {
  if (!e.type.startsWith("wasp:")) return false;
  switch (e.type) {
    case "wasp:girl": {
      need(
        waspAbilityOptions(s, "hero", ports).length,
        "G.I.R.L. is unavailable.",
      );
      ports.select(
        s,
        "G.I.R.L.",
        "Choose up to 2 cards with a printed mental resource to shuffle into your deck.",
        s.player.discard.filter((p) => definition(p)?.resource_mental),
        0,
        2,
        W("girl-selected"),
      );
      break;
    }
    case "wasp:girl-selected": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.waspGirlRound !== s.round,
        "G.I.R.L. is unavailable.",
      );
      const ids = (e.ids || e.selected || []) as string[];
      need(
        ids.length <= 2 &&
          new Set(ids).size === ids.length &&
          ids.every((id) =>
            s.player.discard.some(
              (p) => p.id === id && definition(p)?.resource_mental,
            ),
          ),
        "Choose up to 2 actual discarded cards with a printed mental resource.",
      );
      s.flags.waspGirlRound = s.round;
      for (const id of ids) {
        const index = s.player.discard.findIndex((p) => p.id === id);
        s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      }
      // Shuffle even when zero cards were chosen: this is an initiated action.
      ports.shufflePlayerDeck(s);
      break;
    }
    case "wasp:small-mighty":
      ports.queue(
        s,
        E("damage", { target: s.villain.id, amount: 1, source: "hero" }),
      );
      break;
    case "wasp:basic": {
      need(active(s) && s.player.form === "hero", "Wasp must be in hero form.");
      const power = e.power as "attack" | "thwart";
      if (s.player[power === "attack" ? "stunned" : "confused"]) {
        consumeStatus(s.player, power === "attack" ? "stunned" : "confused");
        break;
      }
      ports.queue(
        s,
        W("basic-window", {
          power,
          bonus: e.bonus || 0,
          overkill: !!e.overkill,
          used: [],
          metadata: e.metadata,
        }),
      );
      break;
    }
    case "wasp:basic-window": {
      const after = [
        W("basic-resolve", {
          power: e.power,
          bonus: e.bonus || 0,
          overkill: !!e.overkill,
          metadata: e.metadata,
        }),
      ];
      const options = rapidOptions(s, e.power, after, e.used || [], ports);
      if (options.length)
        ports.choose(
          s,
          `When using ${e.power === "attack" ? "ATK" : "THW"}`,
          "Play a Rapid Growth interrupt, or continue with this basic power.",
          [...options, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "wasp:basic-resolve": {
      const power = e.power as "attack" | "thwart";
      // Shared basic interrupts (Mean Swing/Teamwork) add to the native packet
      // amount; Rapid Growth contributes its separate, one-use stat bonus.
      const amount =
        ports.heroStat(s, power) + Number(e.bonus || 0) + Number(e.amount || 0);
      if (waspForm(s) === "giant")
        beginDistribution(
          s,
          power === "attack" ? "Basic attack" : "Basic thwart",
          power,
          amount,
          true,
          ports,
          !!e.overkill,
          e.metadata,
        );
      else
        select(
          s,
          power === "attack" ? "Basic attack" : "Basic thwart",
          power === "attack"
            ? ports.enemyTargets(s, true)
            : ports.schemeTargets(s, true),
          E(power === "attack" ? "damage" : "thwart", {
            ...e.metadata,
            amount,
            source: "hero",
            basic: true,
            ...(power === "attack"
              ? {
                  attack: true,
                  attackInitiated: true,
                  piercing: waspBasicPiercing(s),
                  overkill: !!e.overkill,
                }
              : { action: true, thwartInitiated: true }),
          }),
          ports,
        );
      break;
    }
    case "wasp:rapid-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "13005");
      need(
        p &&
          rapidOptions(s, e.power, e.after || [], e.used || [], ports).some(
            (o) => o.id === p.id,
          ),
        "Rapid Growth cannot be played now.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Rapid Growth",
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [W("rapid", { power: e.power })],
              continuation:
                e.power === "defense"
                  ? e.after
                  : [
                      W("basic-window", {
                        power: e.power,
                        bonus: Number(e.after?.[0]?.bonus || 0) + 2,
                        overkill: !!e.after?.[0]?.overkill,
                        metadata: e.after?.[0]?.metadata,
                        used: [...(e.used || []), p!.id],
                      }),
                    ],
            }),
          ],
        }),
      );
      break;
    }
    case "wasp:rapid":
      // No "then": an unsuccessful change (already Giant, or a form lock)
      // does not prevent the independent +2 for this use.
      if (e.power === "defense" && s.attack?.basicDefense)
        s.attack.defenseBonus = Number(s.attack.defenseBonus || 0) + 2;
      if (waspForm(s) !== "giant" && ports.canChangeForm(s))
        ports.flip(s, false, "giant");
      break;
    case "wasp:giant-help":
      if (s.player.confused) consumeStatus(s.player, "confused");
      else if (applicableForm(s) === "giant")
        beginDistribution(s, "Giant Help", "thwart", 4, false, ports);
      else
        select(
          s,
          "Giant Help",
          ports.schemeTargets(s, true),
          E("thwart", {
            amount: 3,
            action: true,
            source: "hero",
            thwartInitiated: true,
          }),
          ports,
        );
      break;
    case "wasp:pinpoint":
      if (s.player.stunned) consumeStatus(s.player, "stunned");
      else
        select(
          s,
          "Pinpoint Strike",
          ports.enemyTargets(s, true),
          E("damage", {
            amount: applicableForm(s) === "tiny" ? 8 : 7,
            attack: true,
            source: "hero",
            attackInitiated: true,
            overkill: applicableForm(s) === "tiny",
          }),
          ports,
        );
      break;
    case "wasp:sting":
      need(
        applicableForm(s) !== "alter",
        "Wasp Sting requires Tiny or Giant form.",
      );
      if (s.player.stunned) consumeStatus(s.player, "stunned");
      else if (applicableForm(s) === "giant")
        beginDistribution(s, "Wasp Sting", "attack", 4, false, ports);
      else
        select(
          s,
          "Wasp Sting",
          ports.enemyTargets(s, true),
          E("damage", {
            amount: 5,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
          ports,
        );
      break;
    case "wasp:divide": {
      const packets = (e.packets || []) as WaspPacket[];
      const legal = e.legal as ReturnType<WaspPorts["enemyTargets"]>;
      const targets = legal.filter(
        (t) => !packets.some((p) => p.target === t.id),
      );
      const commit = (next: WaspPacket[]) =>
        W("division-commit", {
          ...e,
          type: "wasp:division-commit",
          packets: next,
        });
      need(
        targets.length && e.remaining > 0,
        "There are no targets left for this division.",
      );
      if (targets.length === 1)
        ports.queue(
          s,
          commit([...packets, { target: targets[0].id, amount: e.remaining }]),
        );
      else
        ports.choose(
          s,
          e.title,
          `Divide ${e.remaining} remaining ${e.power === "attack" ? "damage" : "threat"} among the chosen targets.`,
          targets.flatMap((t) =>
            Array.from({ length: e.remaining }, (_, i) => {
              const amount = i + 1,
                next = [...packets, { target: t.id, amount }];
              return option(
                `${t.id}:${amount}`,
                `${t.label} · ${amount} ${e.power === "attack" ? "damage" : "threat"}`,
                [
                  amount === e.remaining
                    ? commit(next)
                    : { ...e, packets: next, remaining: e.remaining - amount },
                ],
                t.code,
              );
            }),
          ),
        );
      break;
    }
    case "wasp:division-commit": {
      const packets = e.packets as WaspPacket[];
      const legal =
        e.power === "attack"
          ? ports.enemyTargets(s, true)
          : ports.schemeTargets(s, true);
      need(
        packets.length &&
          new Set(packets.map((p) => p.target)).size === packets.length &&
          packets.reduce((n, p) => n + p.amount, 0) === e.total &&
          packets.every(
            (p) =>
              Number.isInteger(p.amount) &&
              p.amount > 0 &&
              (e.legal as { id: string }[]).some((t) => t.id === p.target) &&
              legal.some((t) => t.id === p.target),
          ),
        "Invalid target division.",
      );
      if (e.power === "attack")
        ports.attackDistribution(s, packets, {
          basic: !!e.basic,
          piercing: !!e.piercing,
          ...(e.overkill ? { overkill: true } : {}),
          ...(e.metadata ? { metadata: e.metadata } : {}),
        });
      else if (e.metadata) ports.thwartDistribution(s, packets, e.metadata);
      else ports.thwartDistribution(s, packets);
      break;
    }
    case "wasp:wings": {
      const p = own(s, e.id, "13009");
      need(
        p &&
          !p.exhausted &&
          active(s) &&
          waspForm(s) === "tiny" &&
          !s.player.tough &&
          e.amount > 0 &&
          !ports.isTextBlank(s, p),
        "Bio-Synthetic Wings cannot prevent this damage.",
      );
      p!.exhausted = true;
      ports.preventDamage(s, e.packet, 1);
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "wasp:obligation":
      need(
        active(s) && e.piece?.code === "13026",
        "Red Dreams must resolve for Nadia Van Dyne.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Red Dreams",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to Nadia Van Dyne", [
              W("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              W("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, W("obligation-choice", { piece: e.piece }));
      break;
    case "wasp:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Nadia cannot change form.",
      );
      ports.queue(s, W("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "wasp:obligation-choice": {
      const choices = [
        option(
          "discard",
          "Discard every printed mental-resource card in hand · take 1 damage",
          [W("obligation-discard")],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust Nadia Van Dyne · remove Red Dreams from the game",
            [W("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Red Dreams",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "wasp:obligation-remove": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "13026",
        "Nadia cannot pay this exhaustion cost.",
      );
      const p = e.piece as Piece;
      s.player.exhausted = true;
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.encounter.discard = s.encounter.discard.filter((x) => x.id !== p.id);
      if (!s.removed.some((x) => x.id === p.id))
        s.removed.push({
          ...p,
          exhausted: false,
          damage: 0,
          counters: 0,
          tough: false,
          stunned: false,
          confused: false,
        });
      break;
    }
    case "wasp:obligation-discard":
      for (const p of [...s.player.hand])
        if (definition(p)?.resource_mental) ports.discardHand(s, p.id);
      ports.queue(
        s,
        E("damage", { target: "hero", amount: 1, source: "13026" }),
      );
      break;
    case "wasp:beetle-defeat": {
      const p = s.minions.find((p) => p.id === e.id && p.code === "13028");
      if (!p) break;
      const choices = [
        option(
          "shuffle",
          "Shuffle Beetle into the encounter deck",
          [
            W("beetle-finish", {
              id: p.id,
              source: e.source,
              attack: e.attack,
              shuffle: true,
            }),
          ],
          p.code,
        ),
      ];
      if (ports.canPay(s, 1, ["physical"]))
        choices.unshift(
          option(
            "pay",
            "Spend 1 physical resource · discard Beetle",
            [W("beetle-pay", { id: p.id, source: e.source, attack: e.attack })],
            p.code,
          ),
        );
      ports.choose(
        s,
        "Beetle",
        "The defeating player must spend a physical resource or shuffle this Beetle into the encounter deck.",
        choices,
      );
      break;
    }
    case "wasp:beetle-pay":
      need(
        s.minions.some((p) => p.id === e.id && p.code === "13028") &&
          ports.canPay(s, 1, ["physical"]),
        "Beetle's physical resource cannot be paid.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Beetle",
          cost: 1,
          requirements: ["physical"],
          cancelable: false,
          after: [
            W("beetle-finish", {
              id: e.id,
              source: e.source,
              attack: e.attack,
              shuffle: false,
            }),
          ],
        }),
      );
      break;
    case "wasp:beetle-finish":
      ports.finishMinionDefeat(s, e.id, e.source, !!e.attack, !!e.shuffle);
      break;
    case "wasp:armor": {
      const beetles = s.minions.filter((p) => p.code === "13028");
      select(
        s,
        "Beetle Armor MK IV",
        (beetles.length ? beetles : [s.villain]).map((p) => ({
          id: p.id,
          label: definition(p)?.name || "Villain",
          code: p.code,
        })),
        W("armor-attach", { id: e.id }),
        ports,
      );
      break;
    }
    case "wasp:armor-attach": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "13029"),
        beetles = s.minions.filter((p) => p.code === "13028");
      need(
        p &&
          (beetles.length
            ? beetles.some((p) => p.id === e.target)
            : e.target === s.villain.id),
        "Beetle Armor MK IV has no legal attachment target.",
      );
      p!.attachedTo = e.target;
      if (e.target === s.villain.id) {
        s.villain.hp += 4;
        s.villain.maxHp += 4;
      }
      break;
    }
    case "wasp:mania": {
      if (s.player.form !== "hero") {
        ports.queue(s, E("surge"));
        break;
      }
      const beetles = s.minions.filter((p) => p.code === "13028");
      if (!beetles.length) ports.queue(s, E("surge"));
      else
        select(
          s,
          "Beetle Mania",
          beetles.map((p) => ({
            id: p.id,
            label: definition(p).name,
            code: p.code,
          })),
          W("mania-attack"),
          ports,
        );
      break;
    }
    case "wasp:mania-attack":
      if (
        !s.minions.some((p) => p.id === e.target && p.code === "13028") ||
        !ports.startEnemyAttack(s, e.target, 1)
      )
        ports.queue(s, E("surge"));
      break;
    default:
      throw Error(`Unknown Wasp effect: ${e.type}`);
  }
  return true;
}
