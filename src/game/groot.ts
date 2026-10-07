import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder } from "./team.js";
import { consumeStatus } from "./keywords.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const G = (type: string, args: Record<string, unknown> = {}) =>
  E(`groot:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "groot";
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));

export type GrootPower = "attack" | "thwart" | "defense" | "recover";
export interface GrootPorts extends AntManPorts {
  friendlyTargets(s: GameState): AntManTarget[];
}
export const GROOT_SCRIPT_CODES = [
  "16001a",
  "16001b",
  "16002",
  "16003",
  "16004",
  "16005",
  "16006",
  "16007",
  "16008",
  "16009",
  "16010",
  "16011",
  "16025",
  "16026",
  "16027",
  "16028",
] as const;
export const GROOT_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const GROOT_FAQ_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#groot";

/** Counters belong to this actual identity and survive changes of form. */
export function grootGrowthCounters(s: GameState): number {
  return active(s)
    ? Math.min(10, Math.max(0, Number(s.flags.grootGrowthCounters || 0)))
    : 0;
}
export function grootAddGrowthCounters(s: GameState, amount: number) {
  need(
    active(s) && Number.isInteger(amount) && amount >= 0,
    "Growth counters belong to Groot and require a nonnegative integer.",
  );
  s.flags.grootGrowthCounters = Math.min(10, grootGrowthCounters(s) + amount);
}
function spend(s: GameState, amount: number) {
  need(
    active(s) &&
      Number.isInteger(amount) &&
      amount >= 0 &&
      grootGrowthCounters(s) >= amount,
    "Groot cannot pay this growth counter cost.",
  );
  s.flags.grootGrowthCounters = grootGrowthCounters(s) - amount;
}

/** Host calls once for each imminent packet, after Tough and before optional
 * interrupts. Pass the recipient's seat view, including during team defense. */
export function grootPreventDamage(
  s: GameState,
  target: string,
  amount: number,
): number {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !["hero", `hero:${s.activePlayerId}`].includes(target) ||
    s.player.tough ||
    amount <= 0
  )
    return 0;
  const prevented = Math.min(Math.floor(amount), grootGrowthCounters(s));
  if (prevented) spend(s, prevented);
  return prevented;
}

export function grootAbilityOptions(
  s: GameState,
  id: string,
  ports: GrootPorts,
): Option[] {
  if (!active(s) || s.player.form !== "alter") return [];
  if (["hero", "identity"].includes(id))
    return s.flags.grootGrowthSpurtRound !== s.round &&
      grootGrowthCounters(s) < 10
      ? [
          option(
            "growth-spurt",
            "Growth Spurt · place 2 growth counters (maximum 10)",
            [G("growth-spurt")],
            "16001b",
          ),
        ]
      : [];
  const p = own(s, id, "16007");
  return p && !p.exhausted && !ports.isTextBlank(s, p)
    ? [
        option(
          "fertile-ground",
          "Fertile Ground · exhaust, place 1 growth counter and draw 1 card",
          [G("fertile-ground", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function grootAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: GrootPorts,
): Effect[] | null {
  const choices = grootAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
const toughTargets = (s: GameState, ports: GrootPorts) =>
  ports.friendlyTargets(s).filter((p) => ports.canGiveStatus(s, p.id, "tough"));
export function grootPlayRestriction(
  s: GameState,
  p: Piece,
  ports: GrootPorts,
): string | null {
  if (!["16002", "16003", "16004", "16005", "16006"].includes(p.code))
    return null;
  if (!active(s)) return "This event requires Groot.";
  if (p.code === "16002")
    return grootGrowthCounters(s) >= 10
      ? "Groot already has the maximum of 10 growth counters."
      : null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "16003" && !s.player.confused) {
    if (!grootGrowthCounters(s))
      return "Groot has no growth counters to thwart.";
    if (!ports.schemeTargets(s, true).length)
      return "This thwart has no legal scheme target.";
  }
  if (["16004", "16005"].includes(p.code) && !s.player.stunned) {
    if (p.code === "16004" && !grootGrowthCounters(s))
      return "Groot has no growth counters to attack.";
    if (!ports.enemyTargets(s, true).length)
      return "This attack has no legal enemy target.";
  }
  if (
    p.code === "16006" &&
    (!grootGrowthCounters(s) || !toughTargets(s, ports).length)
  )
    return '"We Are Groot" needs growth counters and a friendly character that can gain Tough.';
  return null;
}
export function grootEvent(_s: GameState, p: Piece): Effect[] | null {
  const type = (
    {
      "16002": "fruition",
      "16003": "growth-thwart",
      "16004": "growth-attack",
      "16005": "root-stomp",
      "16006": "we-are-groot",
    } as Record<string, string>
  )[p.code];
  return type ? [G(type)] : null;
}

function vines(s: GameState, power: GrootPower, ports: GrootPorts) {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !grootGrowthCounters(s) ||
    (power === "attack" && s.player.stunned) ||
    (power === "thwart" && s.player.confused)
  )
    return [];
  const code =
    power === "attack"
      ? "16011"
      : power === "thwart"
        ? "16008"
        : power === "defense"
          ? "16010"
          : "";
  return s.player.inPlay.filter(
    (p) => p.code === code && !p.exhausted && !ports.isTextBlank(s, p),
  );
}
/** The basic power has been initiated; status replacement is checked before
 * offering these interrupts. The bonus belongs only to this use. */
export function grootBasicOptions(
  s: GameState,
  power: GrootPower,
  after: Effect[],
  ports: GrootPorts,
): Option[] {
  return vines(s, power, ports).map((p) =>
    option(
      p.id,
      `${cards.get(p.code)!.name} · remove 1 growth counter and exhaust, +${power === "defense" ? 3 : 2} ${power === "attack" ? "ATK" : power === "thwart" ? "THW" : "DEF"}`,
      [G("vines", { id: p.id, power, after })],
      p.code,
    ),
  );
}
export function grootDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: GrootPorts,
): Option[] {
  return s.attack?.basicDefense &&
    s.attack.defender === "hero" &&
    (!s.attack.targetPlayerId || s.attack.targetPlayerId === s.activePlayerId)
    ? grootBasicOptions(s, "defense", after, ports)
    : [];
}
export function grootAfterBasicOptions(
  s: GameState,
  power: GrootPower,
  after: Effect[],
  ports: GrootPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !s.player.exhausted ||
    grootGrowthCounters(s) < 2 ||
    !ports.canReadyIdentity(s, s.activePlayerId)
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "16009" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      option(
        p.id,
        "Lashing Vines · remove 2 growth counters and exhaust, ready Groot",
        [G("lashing-vines", { id: p.id, power, after })],
        p.code,
      ),
    );
}
/** Call only after an actual power, never after Stun/Confuse replacement. */
export function grootAfterBasicPower(
  s: GameState,
  power: GrootPower,
  ports: GrootPorts,
): Effect[] {
  return grootAfterBasicOptions(s, power, [], ports).length
    ? [G("basic-response", { power, actorId: s.activePlayerId })]
    : [];
}

const indirectToEachPlayer = (
  s: GameState,
  source: string,
  sourceTitle: string,
) =>
  playerOrder(s).map((seat) =>
    E("indirect", { amount: 2, source, sourceTitle, actorId: seat.id }),
  );
export function grootEnemyActivated(
  s: GameState,
  p: Piece,
  ports: GrootPorts,
): Effect[] {
  return p.code === "16027" &&
    s.minions.some((m) => m.id === p.id) &&
    !ports.isTextBlank(s, p)
    ? indirectToEachPlayer(s, p.id, "Furnax")
    : [];
}
export function grootVillainPhaseBegin(
  s: GameState,
  ports: GrootPorts,
): Effect[] {
  return s.sideSchemes
    .filter((p) => p.code === "16026" && !ports.isTextBlank(s, p))
    .flatMap((p) => indirectToEachPlayer(s, p.id, "Blazing Inferno"));
}
export function grootEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "16025": {
      const owner = playerOrder(s).find((seat) => seat.heroId === "groot");
      return owner ? [G("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "16026":
    case "16027":
      return [];
    case "16028":
      return [G("fan-the-flames", { id: p.id })];
    default:
      return null;
  }
}
export function grootBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["16025", "16026", "16027", "16028"].includes(p.code) ? [] : null;
}

function selectTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: GrootPorts,
) {
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...effect, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      targets.map((p) =>
        option(p.id, p.label, [{ ...effect, target: p.id }], p.code),
      ),
    );
}

export function resolveGrootEffect(
  s: GameState,
  e: Effect,
  ports: GrootPorts,
): boolean {
  if (!e.type.startsWith("groot:")) return false;
  switch (e.type) {
    case "groot:growth-spurt":
      need(
        grootAbilityOptions(s, "hero", ports).length,
        "Growth Spurt is unavailable.",
      );
      s.flags.grootGrowthSpurtRound = s.round;
      grootAddGrowthCounters(s, 2);
      break;
    case "groot:fruition":
      grootAddGrowthCounters(s, 2);
      break;
    case "groot:grow":
      grootAddGrowthCounters(s, Number(e.amount || 0));
      break;
    case "groot:fertile-ground": {
      const p = own(s, e.id, "16007");
      need(
        grootAbilityOptions(s, e.id, ports).length,
        "Fertile Ground is unavailable.",
      );
      p!.exhausted = true;
      grootAddGrowthCounters(s, 1);
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "groot:growth-thwart":
      need(
        active(s) && s.player.form === "hero",
        "Groot must be in hero form.",
      );
      if (s.player.confused) consumeStatus(s.player, "confused");
      else
        selectTarget(
          s,
          '"I am Groot"',
          ports.schemeTargets(s, true),
          E("thwart", {
            amount: grootGrowthCounters(s),
            action: true,
            thwartInitiated: true,
            source: "hero",
          }),
          ports,
        );
      break;
    case "groot:growth-attack":
    case "groot:root-stomp":
      need(
        active(s) && s.player.form === "hero",
        "Groot must be in hero form.",
      );
      if (s.player.stunned) consumeStatus(s.player, "stunned");
      else
        selectTarget(
          s,
          e.type === "groot:root-stomp" ? "Root Stomp" : '"I. AM. GROOT!"',
          ports.enemyTargets(s, true),
          e.type === "groot:root-stomp"
            ? G("root-stomp-target")
            : E("damage", {
                amount: grootGrowthCounters(s),
                attack: true,
                attackInitiated: true,
                source: "hero",
              }),
          ports,
        );
      break;
    case "groot:root-stomp-target": {
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target),
        "Root Stomp has no legal enemy target.",
      );
      const key = `grootRootStomp:${s.nextId++}`;
      ports.attackProgram(
        s,
        [
          E("scriptCheckpoint", { key, target: e.target }),
          E("damage", {
            target: e.target,
            amount: 5,
            attack: true,
            attackInitiated: true,
            source: "hero",
          }),
          E("scriptIfDefeated", { key, effects: [G("grow", { amount: 1 })] }),
        ],
        [],
      );
      break;
    }
    case "groot:we-are-groot": {
      need(
        active(s) && s.player.form === "hero",
        "Groot must be in hero form.",
      );
      const max = Math.min(
        4,
        grootGrowthCounters(s),
        toughTargets(s, ports).length,
      );
      need(max > 0, '"We Are Groot" has no legal cost and target.');
      ports.choose(
        s,
        '"We Are Groot"',
        "Choose how many growth counters to remove, up to 4. Choose that many distinct friendly characters.",
        Array.from({ length: max + 1 }, (_, amount) =>
          option(
            String(amount),
            `Remove ${amount} growth ${amount === 1 ? "counter" : "counters"}`,
            [G("we-are-groot-pay", { amount })],
          ),
        ),
      );
      break;
    }
    case "groot:we-are-groot-pay":
      need(
        s.player.form === "hero" &&
          e.amount <= 4 &&
          e.amount <= toughTargets(s, ports).length,
        '"We Are Groot" requires distinct friendly characters that can gain Tough.',
      );
      spend(s, e.amount);
      if (e.amount)
        ports.queue(
          s,
          G("we-are-groot-targets", { remaining: e.amount, chosen: [] }),
        );
      break;
    case "groot:we-are-groot-targets": {
      const legal = toughTargets(s, ports).filter(
        (p) => !e.chosen.includes(p.id),
      );
      if (!e.remaining || !legal.length) break;
      ports.choose(
        s,
        '"We Are Groot"',
        `Choose ${e.remaining} more ${e.remaining === 1 ? "friendly character" : "distinct friendly characters"} to gain Tough.`,
        legal.map((p) =>
          option(
            p.id,
            p.label,
            [
              G("we-are-groot-status", {
                target: p.id,
                remaining: e.remaining,
                chosen: e.chosen,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "groot:we-are-groot-status":
      need(
        !e.chosen.includes(e.target) &&
          toughTargets(s, ports).some((p) => p.id === e.target),
        "Choose a distinct friendly character that can gain Tough.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "tough" }),
        G("we-are-groot-targets", {
          remaining: e.remaining - 1,
          chosen: [...e.chosen, e.target],
        }),
      );
      break;
    case "groot:vines": {
      const p = vines(s, e.power, ports).find((p) => p.id === e.id);
      need(
        p,
        "This Vines interrupt cannot pay its growth counter and exhaustion costs.",
      );
      if (e.power === "defense")
        need(
          s.attack?.basicDefense &&
            s.attack.defender === "hero" &&
            (!s.attack.targetPlayerId ||
              s.attack.targetPlayerId === s.activePlayerId),
          "Vine Shield requires Groot to be the actual basic defender.",
        );
      spend(s, 1);
      p!.exhausted = true;
      if (e.power === "defense") {
        s.attack!.defenseBonus = Number(s.attack!.defenseBonus || 0) + 3;
        ports.queue(s, ...(e.after || []));
      } else
        ports.queue(
          s,
          ...(e.after || []).map((action: Effect) => ({
            ...action,
            amount: Number(action.amount || 0) + 2,
          })),
        );
      break;
    }
    case "groot:basic-response": {
      const after = e.after || [];
      const choices = grootAfterBasicOptions(s, e.power, after, ports);
      if (choices.length)
        ports.choose(
          s,
          "Lashing Vines",
          "Ready Groot after using a basic power?",
          [...choices, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "groot:lashing-vines": {
      const p = own(s, e.id, "16009");
      need(
        grootAfterBasicOptions(s, e.power, e.after || [], ports).some(
          (o) => o.id === e.id,
        ),
        "Lashing Vines cannot pay its costs or ready Groot.",
      );
      spend(s, 2);
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }), ...(e.after || []));
      break;
    }
    case "groot:obligation":
      need(
        active(s) && e.piece?.code === "16025",
        "Wilt must resolve for Groot.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Wilt",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to alter-ego", [
              G("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              G("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, G("obligation-choice", { piece: e.piece }));
      break;
    case "groot:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Groot cannot change form.",
      );
      ports.queue(s, G("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "groot:obligation-choice": {
      const choices = [
        option(
          "growth",
          "Remove 3 growth counters · surge if none are removed",
          [G("obligation-growth")],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option("remove", "Exhaust Groot · remove Wilt from the game", [
            G("obligation-remove", { piece: e.piece }),
          ]),
        );
      ports.choose(s, "Wilt", "Choose the obligation's resolution.", choices);
      break;
    }
    case "groot:obligation-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "16025",
        "Groot cannot pay Wilt's exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "groot:obligation-growth": {
      need(active(s), "Wilt must resolve for Groot.");
      const amount = Math.min(3, grootGrowthCounters(s));
      spend(s, amount);
      if (!amount)
        ports.queue(s, E("dealEncounter", { playerId: s.activePlayerId }));
      break;
    }
    case "groot:fan-the-flames":
      ports.queue(
        s,
        E("indirect", {
          amount:
            2 +
            Number(s.sideSchemes.some((p) => p.code === "16026")) +
            Number(s.minions.some((p) => p.code === "16027")),
          source: e.id,
          sourceTitle: "Fan the Flames",
        }),
      );
      break;
    default:
      throw Error(`Unknown Groot effect: ${e.type}`);
  }
  return true;
}
