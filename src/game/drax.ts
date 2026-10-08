import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const D = (type: string, args: Record<string, unknown> = {}) =>
  E(`drax:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "drax";
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));

export const DRAX_SCRIPT_CODES = [
  "19001a",
  "19001b",
  "19002",
  "19003",
  "19004",
  "19005",
  "19006",
  "19007",
  "19008",
  "19009",
  "19010",
  "19011",
  "19025",
  "19026",
  "19027",
  "19028",
  "19029",
] as const;
export const DRAX_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const DRAX_FAQ_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#drax";
export const DRAX_LATEST_FAQ_SOURCE =
  "https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/";
/** Original scans contain these printed icons omitted by the imported JSON. */
export const DRAX_ENCOUNTER_BOOSTS = {
  "19025": 2,
  "19026": 2,
  "19027": 3,
  "19028": 1,
  "19029": 2,
} as const;

export interface DraxPorts extends AntManPorts {
  /** Friendly identities with damage that can currently be healed. */
  identityTargets(s: GameState): AntManTarget[];
  heroAttack(s: GameState): number;
  enemyAttack(s: GameState, p: Piece): number;
  cardCost(s: GameState, p: Piece): number;
  preventDamage(s: GameState, packet: Effect | undefined, amount: number): void;
  claimDefense(s: GameState, packet: Effect | undefined): void;
  /** Remove the actual owned player card, rather than triggering a discard. */
  removePlayerCard(s: GameState, id: string): void;
  /** Finish activation and its choices before the saved continuation. An absent,
   * status-replaced or aborted attack still resumes that continuation. */
  startEnemyAttack(
    s: GameState,
    id: string,
    modifier: number,
    after: Effect[],
  ): void;
  /** Completed actual attacks by this physical attacker, across defending seats. */
  enemyAttackCount(s: GameState, id: string): number;
}
type TextPorts = Pick<DraxPorts, "isTextBlank">;
const blank = (s: GameState, p: Piece, ports?: TextPorts) =>
  ports ? ports.isTextBlank(s, p) : isTextBlank(s, p);

/** The identity response's maximum of three is local to that ability. External
 * card effects can add more counters; ATK and alter-ego healing use them all. */
export function draxVengeanceCounters(s: GameState): number {
  return active(s)
    ? Math.max(0, Math.floor(Number(s.flags.draxVengeanceCounters || 0)))
    : 0;
}
export function draxAddVengeanceCounters(s: GameState, amount: number): void {
  need(
    active(s) && Number.isInteger(amount) && amount >= 0,
    "Vengeance counters require Drax and a nonnegative integer.",
  );
  s.flags.draxVengeanceCounters = draxVengeanceCounters(s) + amount;
}
export function draxStats(
  s: GameState,
  ports?: TextPorts,
): { attack: number; retaliate: number } {
  if (!active(s) || s.player.form !== "hero")
    return { attack: 0, retaliate: 0 };
  return {
    attack:
      draxVengeanceCounters(s) +
      s.player.inPlay.filter((p) => p.code === "19008" && !blank(s, p, ports))
        .length,
    retaliate: s.player.inPlay.filter(
      (p) => p.code === "19009" && !blank(s, p, ports),
    ).length,
  };
}
export function draxEnemyStats(
  s: GameState,
  p: Piece,
  ports?: TextPorts,
): { attack: number } {
  return {
    attack:
      2 *
      s.sideSchemes.filter((p) => p.code === "19026" && !blank(s, p, ports))
        .length,
  };
}
export function draxCardCostReduction(s: GameState, p: Piece | Card): number {
  return p.code === "19005" && active(s) ? draxVengeanceCounters(s) : 0;
}
/** Invoke once after an actual change to alter-ego, including obligations and
 * defeat replacements. Merely starting setup in that form is not a change. */
export function draxChangedForm(
  s: GameState,
  from: "hero" | "alter",
): Effect[] {
  return active(s) && from !== s.player.form && s.player.form === "alter"
    ? [D("alter-ego-response", { actorId: s.activePlayerId, mandatory: true })]
    : [];
}
function healingIdentities(s: GameState, ports: DraxPorts): AntManTarget[] {
  return ports
    .identityTargets(s)
    .filter((p) => p.id === "hero" || p.id.startsWith("hero:"));
}
export function draxAbilityOptions(
  s: GameState,
  id: string,
  ports: DraxPorts,
): Option[] {
  const p = own(s, id, "19002");
  return p &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    healingIdentities(s, ports).length
    ? [
        option(
          "mantis",
          "Mantis · exhaust and deal 1 damage to her, heal 3 damage from an identity",
          [D("mantis", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function draxAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: DraxPorts,
): Effect[] | null {
  const choices = draxAbilityOptions(s, id, ports);
  return (
    (
      choices.find((p) => p.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function draxPlayRestriction(
  s: GameState,
  p: Piece,
  ports: DraxPorts,
): string | null {
  if (!["19003", "19004", "19005", "19006", "19007"].includes(p.code))
    return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (["19005", "19006", "19007"].includes(p.code))
    return "This event requires its native interrupt or response window.";
  if (
    p.code === "19004" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Intimidation has no legal scheme target.";
  return null;
}
export function draxEvent(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "19003")
    return [
      E("ready", { target: "hero" }),
      E("draw", { amount: 1 }),
      D("fight-me-attack"),
    ];
  if (p.code === "19004") return [D("intimidation")];
  return null;
}

export function draxBasicAttackOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: DraxPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !packet.basic ||
    s.player.stunned
  )
    return [];
  const used: string[] = packet.draxKnifeLeaps || [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "19005" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Knife Leap · +5 ATK, overkill and piercing for this basic attack",
        [D("knife-leap-pay", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
/** The host calls only after a real basic attack, even if Tough prevented its
 * damage. A Stun replacement does not make a basic attack. */
export function draxAfterBasicAttack(s: GameState, ports: DraxPorts): Effect[] {
  return active(s) && s.player.form === "hero"
    ? s.player.inPlay
        .filter((p) => p.code === "19010" && !ports.isTextBlank(s, p))
        .map((p) =>
          E("optional", {
            title: "DWI Theet Mastery",
            text: "Draw 1 card after Drax's basic attack?",
            effects: [E("draw", { amount: 1 })],
            sourceId: p.id,
          }),
        )
    : [];
}
export function draxDamageOptions(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
  after: Effect[],
  ports: DraxPorts,
): Option[] {
  if (
    amount <= 0 ||
    s.player.form !== "hero" ||
    s.player.tough ||
    !["hero", `hero:${s.activePlayerId}`].includes(packet?.target || "hero") ||
    ports.heroAttack(s) <= 0
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "19006" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        `Parry · prevent ${2 * ports.heroAttack(s)} damage`,
        [D("parry-pay", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
export interface DraxVillainAttackSnapshot {
  attacker: string;
  isVillain: boolean;
  /** Actual player attacked; their own ally may have taken the damage. */
  playerId: string;
  /** The named Drax identity was the attacked character. */
  identityAttacked: boolean;
}
function responseOptions(
  s: GameState,
  snapshot: DraxVillainAttackSnapshot,
  used: string[],
  after: Effect[],
  ports: DraxPorts,
  resume?: (used: string[]) => Effect[],
): Option[] {
  if (
    !snapshot.isVillain ||
    snapshot.playerId !== s.activePlayerId ||
    s.player.form !== "hero"
  )
    return [];
  const options: Option[] = [];
  const next = (id: string) =>
    resume
      ? resume([...used, id])
      : [
          D("villain-attack-responses", {
            snapshot,
            used: [...used, id],
            after,
          }),
        ];
  if (active(s) && snapshot.identityAttacked && !used.includes("vengeance"))
    options.push(
      option(
        "vengeance",
        draxVengeanceCounters(s) < 3
          ? "Vengeance · place 1 counter"
          : "Vengeance · cannot place a counter, draw 1 card",
        [D("vengeance-response", { after: next("vengeance") })],
        "19001a",
      ),
    );
  if (
    s.player.stunned ||
    ports.enemyTargets(s, true).some((p) => p.id === snapshot.attacker)
  )
    for (const p of s.player.hand.filter(
      (p) =>
        p.code === "19007" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    ))
      options.push(
        option(
          p.id,
          "Payback · attack the villain for your current ATK",
          [
            D("payback-pay", {
              id: p.id,
              target: snapshot.attacker,
              after: next(p.id),
            }),
          ],
          p.code,
        ),
      );
  return options;
}
/** Compose with other optional responses to the same completed attack. The
 * serialized continuation remembers only Drax's used abilities and refreshes
 * the shared host window after each response. */
export function draxVillainAttackResponseOptions(
  s: GameState,
  snapshot: DraxVillainAttackSnapshot,
  used: string[],
  after: Effect[],
  ports: DraxPorts,
): Option[] {
  return responseOptions(s, snapshot, used, after, ports, (draxUsed) =>
    after.map((e) => ({ ...e, draxUsed })),
  );
}
export function draxAfterVillainAttack(
  s: GameState,
  snapshot: DraxVillainAttackSnapshot,
  after: Effect[],
  ports: DraxPorts,
): Effect[] {
  return responseOptions(s, snapshot, [], after, ports).length
    ? [
        D("villain-attack-responses", {
          snapshot,
          used: [],
          after,
          actorId: s.activePlayerId,
        }),
      ]
    : after;
}
export function draxDefeatOptions(
  s: GameState,
  after: Effect[],
  ports: DraxPorts,
): Option[] {
  return active(s) && s.player.form === "hero" && s.player.hp <= 0
    ? s.player.inPlay
        .filter((p) => p.code === "19011" && !ports.isTextBlank(s, p))
        .map((p) =>
          option(
            p.id,
            "Too Stubborn to Die · set HP to 4, change to alter-ego and remove this card",
            [D("stubborn", { id: p.id, after })],
            p.code,
          ),
        )
    : [];
}
export interface DraxDamageSnapshot {
  target: string;
  attack: boolean;
  sourceIsDrax: boolean;
  /** Damage dealt by this single attack, distinct from HP actually taken. */
  damageDealt: number;
}
export function draxDamageDealt(
  s: GameState,
  snapshot: DraxDamageSnapshot,
  ports: DraxPorts,
): Effect[] {
  return snapshot.attack && snapshot.sourceIsDrax && snapshot.damageDealt >= 4
    ? s.attachments
        .filter(
          (p) =>
            p.code === "19028" &&
            p.attachedTo === snapshot.target &&
            !ports.isTextBlank(s, p),
        )
        .map((p) =>
          E("discardPiece", {
            id: p.id,
            mandatory: true,
            title: "Challenge Accepted",
          }),
        )
    : [];
}
export function draxEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "19025": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [D("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "19026":
    case "19027":
      return [];
    case "19028":
      return [D("challenge", { id: p.id })];
    case "19029":
      return [D("destroy")];
    default:
      return null;
  }
}
export function draxBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code in DRAX_ENCOUNTER_BOOSTS ? [] : null;
}
function target(
  s: GameState,
  title: string,
  choices: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: DraxPorts,
) {
  if (!choices.length) {
    ports.queue(s, ...after);
    return;
  }
  if (choices.length === 1)
    ports.queue(s, { ...effect, target: choices[0].id }, ...after);
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      choices.map((p) =>
        option(p.id, p.label, [{ ...effect, target: p.id }, ...after], p.code),
      ),
    );
}

export function resolveDraxEffect(
  s: GameState,
  e: Effect,
  ports: DraxPorts,
): boolean {
  if (!e.type.startsWith("drax:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "drax:alter-ego-response": {
      need(
        active(s) && s.player.form === "alter",
        "Drax's forced healing requires alter-ego form.",
      );
      const counters = draxVengeanceCounters(s);
      s.flags.draxVengeanceCounters = 0;
      if (counters)
        ports.queue(
          s,
          E("heal", { target: "hero", amount: counters * 2, mandatory: true }),
        );
      break;
    }
    case "drax:mantis":
      need(
        draxAbilityOptions(s, e.id, ports).length,
        "Mantis cannot pay her cost or heal an identity.",
      );
      target(
        s,
        "Mantis",
        healingIdentities(s, ports),
        D("mantis-pay", { id: e.id }),
        [],
        ports,
      );
      break;
    case "drax:mantis-pay": {
      const p = own(s, e.id, "19002");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          healingIdentities(s, ports).some((p) => p.id === e.target),
        "Mantis's chosen identity or cost is no longer available.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("damage", { target: p!.id, amount: 1, source: "cost" }),
        E("heal", { target: e.target, amount: 3 }),
      );
      break;
    }
    case "drax:fight-me-attack":
      ports.startEnemyAttack(s, s.villain.id, 0, after);
      break;
    case "drax:intimidation":
      if (s.player.confused) consumeStatus(s.player, "confused");
      else
        target(
          s,
          "Intimidation",
          ports.schemeTargets(s, true),
          E("thwart", {
            amount: ports.heroAttack(s),
            source: "hero",
            action: true,
            thwartInitiated: true,
          }),
          after,
          ports,
        );
      break;
    case "drax:knife-leap-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "19005");
      need(
        p &&
          draxBasicAttackOptions(s, e.packet, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Knife Leap is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Knife Leap",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [],
              continuation: [
                D("knife-leap", { id: p!.id, packet: e.packet, after }),
              ],
            }),
          ],
        }),
      );
      break;
    }
    case "drax:knife-leap":
      ports.queue(
        s,
        {
          ...e.packet,
          amount: Number(e.packet.amount || 0) + 5,
          gmwBasicBonus: Number(e.packet.gmwBasicBonus || 0) + 5,
          piercing: true,
          overkill: true,
          draxKnifeLeaps: [...(e.packet.draxKnifeLeaps || []), e.id],
        },
        ...after,
      );
      break;
    case "drax:parry-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "19006");
      need(
        p &&
          draxDamageOptions(s, e.packet, e.amount, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Parry is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Parry",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [D("parry", { packet: e.packet })],
              continuation: after,
            }),
          ],
        }),
      );
      break;
    }
    case "drax:parry":
      ports.claimDefense(s, e.packet);
      ports.preventDamage(s, e.packet, 2 * ports.heroAttack(s));
      break;
    case "drax:villain-attack-responses": {
      const options = responseOptions(
        s,
        e.snapshot,
        e.used || [],
        after,
        ports,
      );
      if (options.length)
        ports.choose(
          s,
          "Drax · after the villain attacks",
          "Resolve responses in your chosen order, or continue.",
          [...options, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "drax:vengeance-response":
      need(
        active(s) && s.player.form === "hero",
        "Vengeance belongs to Drax's hero form.",
      );
      if (draxVengeanceCounters(s) < 3) {
        draxAddVengeanceCounters(s, 1);
        ports.queue(s, ...after);
      } else ports.queue(s, E("draw", { amount: 1 }), ...after);
      break;
    case "drax:payback-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "19007");
      need(
        p &&
          s.player.form === "hero" &&
          ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code) &&
          (s.player.stunned ||
            ports.enemyTargets(s, true).some((p) => p.id === e.target)),
        "Payback has no legal cost or villain target.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Payback",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [D("payback", { target: e.target })],
              continuation: after,
            }),
          ],
        }),
      );
      break;
    }
    case "drax:payback":
      if (s.player.stunned) consumeStatus(s.player, "stunned");
      else if (ports.enemyTargets(s, true).some((p) => p.id === e.target))
        ports.queue(
          s,
          E("damage", {
            target: e.target,
            amount: ports.heroAttack(s),
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
        );
      break;
    case "drax:stubborn": {
      const p = own(s, e.id, "19011");
      need(
        p && draxDefeatOptions(s, after, ports).some((o) => o.id === p.id),
        "Too Stubborn to Die is unavailable.",
      );
      s.player.hp = 4;
      const oldForm = s.player.form;
      ports.queue(s, D("stubborn-remove", { id: p!.id }), ...after);
      if (ports.canChangeForm(s)) ports.flip(s, false, "alter");
      // The host normally dispatches ChangedForm from its actual flip. The
      // continuation must follow that forced response; do not invoke it twice.
      ports.log(
        s,
        `Too Stubborn to Die sets Drax's HP to 4${oldForm !== s.player.form ? " and changes him to alter-ego" : ""}.`,
      );
      break;
    }
    case "drax:stubborn-remove":
      ports.removePlayerCard(s, e.id);
      break;
    case "drax:challenge": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "19028");
      if (!p) break;
      const enemies: Piece[] = [s.villain, ...s.minions];
      const highest = Math.max(...enemies.map((p) => ports.enemyAttack(s, p)));
      const choices = enemies
        .filter((p) => ports.enemyAttack(s, p) === highest)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        }));
      target(
        s,
        "Challenge Accepted",
        choices,
        D("challenge-attach", { id: p.id }),
        [],
        ports,
      );
      break;
    }
    case "drax:challenge-attach": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "19028");
      const enemies = [s.villain, ...s.minions];
      const enemy = enemies.find((p) => p.id === e.target);
      need(
        p &&
          enemy &&
          ports.enemyAttack(s, enemy) >=
            Math.max(...enemies.map((p) => ports.enemyAttack(s, p))),
        "Challenge Accepted requires an enemy with the highest ATK.",
      );
      p!.attachedTo = e.target;
      break;
    }
    case "drax:destroy": {
      if (s.player.form === "alter") {
        ports.queue(s, E("dealEncounter", { playerId: s.activePlayerId }));
        break;
      }
      const yotat = s.minions.find((p) => p.code === "19027");
      if (!yotat) ports.startEnemyAttack(s, s.villain.id, 0, []);
      else
        ports.startEnemyAttack(s, yotat.id, 1, [
          D("destroy-after", {
            id: yotat.id,
            before: ports.enemyAttackCount(s, yotat.id),
          }),
        ]);
      break;
    }
    case "drax:destroy-after":
      if (ports.enemyAttackCount(s, e.id) === e.before)
        ports.startEnemyAttack(s, s.villain.id, 0, []);
      break;
    case "drax:obligation":
      need(
        active(s) && e.piece?.code === "19025",
        "Memories of Another Life must resolve for Drax.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Memories of Another Life",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to alter-ego", [
              D("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              D("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, D("obligation-choice", { piece: e.piece }));
      break;
    case "drax:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Drax cannot change form.",
      );
      ports.queue(s, D("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "drax:obligation-choice": {
      const choices = [
        option("stun", "Become Stunned · surge if already Stunned", [
          D("obligation-stun"),
        ]),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust Drax · remove Memories of Another Life from the game",
            [D("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Memories of Another Life",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "drax:obligation-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "19025",
        "Drax cannot pay the obligation's exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "drax:obligation-stun": {
      const surge = s.player.stunned;
      ports.queue(
        s,
        E("status", { target: "hero", status: "stunned" }),
        ...(surge ? [E("dealEncounter", { playerId: s.activePlayerId })] : []),
      );
      break;
    }
    default:
      throw Error(`Unknown Drax effect: ${e.type}`);
  }
  return true;
}
