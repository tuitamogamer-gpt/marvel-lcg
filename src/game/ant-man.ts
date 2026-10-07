import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, playerOrder, seatView } from "./team.js";
import { consumeStatus } from "./keywords.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const A = (type: string, args: Record<string, unknown> = {}) =>
  E(`antman:${type}`, args);
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
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const active = (s: GameState) => ["ant", "ant_man"].includes(s.heroId);
const turnKey = (s: GameState) => `${s.round}:${s.phase}:${s.turnPlayerId}`;
const optional = (title: string, text: string, effects: Effect[]) =>
  E("optional", { title, text, effects });

export type AntManForm = "alter" | "tiny" | "giant";
export const ANT_MAN_SCRIPT_CODES = [
  "12001a",
  "12001b",
  "12001c",
  "12002",
  "12003",
  "12004",
  "12005",
  "12006",
  "12007",
  "12008",
  "12009",
  "12010",
  "12020",
  "12025",
  "12026",
  "12027",
  "12028",
  "12029",
] as const;
export const ANT_MAN_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf";
export const ANT_MAN_STARTER_SOURCE =
  "https://images-cdn.fantasyflightgames.com/filer_public/f7/9a/f79a7553-b16f-4d5a-aea4-d828d798bc41/mc12_ant-man_rulesheet.pdf";

export interface AntManTarget {
  id: string;
  label: string;
  code?: string;
}
export interface AntManPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  canChangeForm(s: GameState): boolean;
  flip(s: GameState, counts: boolean, target?: AntManForm): void;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  /** false means non-thwart removal, which ignores Crisis and Patrol. */
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  isTextBlank(s: GameState, p: Piece): boolean;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  revealHidden(s: GameState): void;
  recycleEncounter(s: GameState): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  log(s: GameState, text: string): void;
}

/** Hero-to-hero changes preserve the public hero/alter form discriminator. */
export function antManForm(s: GameState): AntManForm {
  return s.player.form === "alter" ? "alter" : s.player.heroForm || "tiny";
}
/** An ordinary hero does not acquire a size from Ant-Man's default. */
const sizedHero = (s: GameState) =>
  s.player.form === "hero" && (active(s) || !!s.player.heroForm);
const applicableForm = (s: GameState): AntManForm =>
  sizedHero(s) ? antManForm(s) : "alter";
export function antManCanChangeForm(s: GameState): boolean {
  return !s.flags.antManCannotChangeUntilTurnEnd;
}
const canChange = (s: GameState, ports: AntManPorts) =>
  antManCanChangeForm(s) && ports.canChangeForm(s);
export function antManStats(s: GameState) {
  return {
    attack:
      s.player.form === "hero" && s.flags.antManStrengthTurn === turnKey(s)
        ? Number(s.flags.antManStrengthAmount || 0)
        : 0,
  };
}
function engagedForm(s: GameState, p: Piece): AntManForm | undefined {
  const seat = s.players.find(
    (seat) => seat.id === (p.engagedWith || s.activePlayerId),
  );
  if (!seat) return undefined;
  const view = seatView(s, seat);
  return view.player.form === "hero" && (view.player.heroForm || active(view))
    ? antManForm(view)
    : undefined;
}
export function antManEnemyStats(s: GameState, p: Piece) {
  const increase =
    s.attachments.filter(
      (a) => a.code === "12028" && a.attachedTo === p.id && a.counters > 0,
    ).length * 2;
  return {
    attack:
      increase + (p.code === "12027" && engagedForm(s, p) === "tiny" ? 1 : 0),
    scheme: increase,
  };
}
export function antManEnemyTraits(s: GameState, p: Piece): string[] {
  const form = p.code === "12027" ? engagedForm(s, p) : undefined;
  return form === "giant" ? ["Giant"] : form === "tiny" ? ["Tiny"] : [];
}
export function antManEnemyRetaliate(s: GameState, p: Piece): number {
  return p.code === "12027" && engagedForm(s, p) === "giant" ? 1 : 0;
}
export function antManEnemyActivated(s: GameState, id: string): Effect[] {
  return s.attachments
    .filter((p) => p.code === "12028" && p.attachedTo === id && p.counters > 0)
    .map((p) => A("increase-used", { id: p.id, enemyId: id }));
}
/** Call at every player's turn boundary, before changing turnPlayerId. */
export function antManTurnEnded(
  s: GameState,
  endedPlayerId = s.turnPlayerId,
): void {
  for (const seat of s.players) {
    const view = seatView(s, seat);
    if (
      view.flags.antManStrengthTurn === `${s.round}:${s.phase}:${endedPlayerId}`
    ) {
      delete view.flags.antManStrengthTurn;
      delete view.flags.antManStrengthAmount;
    }
    if (
      seat.id === endedPlayerId &&
      s.round >= Number(view.flags.antManCannotChangeUntilTurnEnd || Infinity)
    )
      delete view.flags.antManCannotChangeUntilTurnEnd;
  }
}
/** A duration established outside a player turn expires with that phase. */
export function antManPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.antManStrengthTurn;
    delete flags.antManStrengthAmount;
  }
}
function teamUp(s: GameState): boolean {
  if (!["ant", "ant_man", "wsp", "wasp"].includes(s.heroId)) return false;
  const names = new Set(
    allInPlay(s)
      .filter((p) => definition(p)?.type_code === "ally")
      .map((p) => definition(p).name),
  );
  for (const seat of playerOrder(s))
    if (seatView(s, seat).player.form === "hero") {
      if (["ant", "ant_man"].includes(seat.heroId)) names.add("Ant-Man");
      if (["wsp", "wasp"].includes(seat.heroId)) names.add("Wasp");
    }
  return names.has("Ant-Man") && names.has("Wasp");
}
export function antManPlayRestriction(
  s: GameState,
  p: Piece,
  ports: AntManPorts,
): string | null {
  const form = applicableForm(s);
  if (p.code === "12003" && form !== "giant")
    return "Giant Stomp requires Giant hero form.";
  if (p.code === "12004" && form !== "tiny")
    return "Hive Mind requires Tiny hero form.";
  if (
    p.code === "12004" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "Hive Mind has no legal scheme to thwart.";
  if (["12005", "12020"].includes(p.code)) {
    if (form === "alter") return "This event requires hero form.";
    if (!canChange(s, ports)) return "Your identity cannot change form.";
  }
  if (p.code === "12020" && !teamUp(s))
    return "Swarm Tactics requires Ant-Man and Wasp in play and one as your identity.";
  return null;
}
export function antManEvent(s: GameState, p: Piece): Effect[] | null {
  const type = (
    {
      "12003": "stomp",
      "12004": "hive-mind",
      "12005": "resize",
      "12020": "swarm",
    } as Record<string, string>
  )[p.code];
  return type ? [A(type)] : null;
}
export function antManCardEntered(
  s: GameState,
  p: Piece,
  ports: AntManPorts,
): Effect[] {
  if (p.code !== "12002" || !sizedHero(s) || ports.isTextBlank(s, p)) return [];
  const form = applicableForm(s);
  const choices =
    form === "giant"
      ? ports.enemyTargets(s, false)
      : ports.schemeTargets(s, false);
  return choices.length
    ? [
        optional(
          "Wasp",
          form === "giant"
            ? "Deal 2 damage to an enemy?"
            : "Remove 2 threat from a scheme?",
          [A("wasp", { form })],
        ),
      ]
    : [];
}
export function antManResourceSpent(
  s: GameState,
  p: Piece,
  ports: AntManPorts,
): Effect[] {
  if (p.code !== "12006" || !sizedHero(s) || ports.isTextBlank(s, p)) return [];
  const form = applicableForm(s);
  return [
    optional(
      "Pym Particles",
      form === "giant" ? "Heal 2 damage from your hero?" : "Draw 1 card?",
      [
        E(form === "giant" ? "heal" : "draw", {
          target: "hero",
          amount: form === "giant" ? 2 : 1,
        }),
      ],
    ),
  ];
}
export function antManFormChanged(s: GameState, ports: AntManPorts): Effect[] {
  const form = applicableForm(s),
    effects: Effect[] = [];
  if (active(s)) {
    if (form === "alter")
      effects.push(
        optional("Time to Unwind", "Heal 1 damage from Scott Lang?", [
          A("unwind"),
        ]),
      );
    if (form === "tiny" && ports.schemeTargets(s, false).length)
      effects.push(
        optional("Puny Pest", "Remove 1 threat from a scheme?", [
          A("puny-pest"),
        ]),
      );
    if (form === "giant" && ports.enemyTargets(s, false).length)
      effects.push(
        optional("Giant Nuisance", "Deal 1 damage to an enemy?", [
          A("giant-nuisance"),
        ]),
      );
  }
  if (form !== "alter")
    for (const p of s.player.inPlay.filter((p) => !ports.isTextBlank(s, p))) {
      if (p.code === "12008")
        effects.push(
          optional(
            "Ant-Man's Helmet",
            form === "giant" ? "Heal 2 damage from your hero?" : "Draw 1 card?",
            [A("helmet", { id: p.id, form })],
          ),
        );
      if (p.code === "12009" && form === "giant")
        effects.push(
          optional("Giant Strength", "Get +1 ATK until this turn ends?", [
            A("strength", { id: p.id, turn: turnKey(s) }),
          ]),
        );
    }
  return effects;
}
export function antManAbilityOptions(
  s: GameState,
  id: string,
  ports: AntManPorts,
): Option[] {
  const p = own(s, id),
    form = applicableForm(s);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "12007" &&
    form === "tiny" &&
    ports.enemyTargets(s, false).length
  )
    return [
      option(
        "army-of-ants",
        "Army of Ants · exhaust, deal 1 damage",
        [A("army", { id })],
        p.code,
      ),
    ];
  if (p.code === "12010" && form !== "alter") {
    const status = form === "giant" ? "stunned" : "confused",
      requirements: Resource[] =
        form === "giant" ? ["physical", "physical"] : ["energy", "energy"];
    if (
      ports
        .enemyTargets(s, false)
        .some((t) => ports.canGiveStatus(s, t.id, status)) &&
      ports.canPay(s, 2, requirements, undefined, p.code)
    )
      return [
        option(
          "wrist-gauntlets",
          `Wrist Gauntlets · exhaust, spend 2 ${requirements[0]} resources, ${status === "stunned" ? "stun" : "confuse"} an enemy`,
          [A("gauntlets", { id })],
          p.code,
        ),
      ];
  }
  return [];
}
export function antManAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: AntManPorts,
): Effect[] | null {
  const choices = antManAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}
export function antManEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "12025": {
      const owner = playerOrder(s).find((seat) =>
        ["ant", "ant_man"].includes(seat.heroId),
      );
      return owner ? [A("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "12026":
    case "12027":
      return [];
    case "12028":
      return [A("attach-increase", { id: p.id })];
    case "12029":
      return [A("plan")];
    default:
      return null;
  }
}
function select(
  s: GameState,
  title: string,
  choices: AntManTarget[],
  effect: Effect,
  ports: AntManPorts,
): void {
  if (!choices.length) return;
  if (choices.length === 1)
    ports.queue(s, { ...effect, target: choices[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      choices.map((t) =>
        option(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
export function resolveAntManEffect(
  s: GameState,
  e: Effect,
  ports: AntManPorts,
): boolean {
  if (!e.type.startsWith("antman:")) return false;
  switch (e.type) {
    case "antman:resize":
    case "antman:swarm": {
      const form = applicableForm(s);
      need(
        form !== "alter" && canChange(s, ports),
        "Your hero cannot change to its other hero form.",
      );
      if (e.type === "antman:swarm")
        need(teamUp(s), "Swarm Tactics requires Ant-Man and Wasp in play.");
      // Queue the trailing sentence first: native flip prepends its complete
      // form-change response window before drawing/readying resumes.
      ports.queue(
        s,
        E(e.type === "antman:resize" ? "draw" : "ready", {
          target: "hero",
          amount: 1,
        }),
      );
      ports.flip(s, false, form === "tiny" ? "giant" : "tiny");
      break;
    }
    case "antman:stomp": {
      need(
        applicableForm(s) === "giant",
        "Giant Stomp requires Giant hero form.",
      );
      if (s.player.stunned) {
        consumeStatus(s.player, "stunned");
        break;
      }
      ports.attackProgram(
        s,
        [
          ...s.minions.map((p) =>
            E("damage", {
              target: p.id,
              amount: 1,
              attack: true,
              source: "hero",
              attackInitiated: true,
            }),
          ),
          A("stomp-target"),
        ],
        [],
      );
      break;
    }
    case "antman:stomp-target":
      select(
        s,
        "Giant Stomp",
        ports.enemyTargets(s, true),
        A("stomp-hit"),
        ports,
      );
      break;
    case "antman:stomp-hit":
      need(
        ports.enemyTargets(s, true).some((p) => p.id === e.target),
        "Giant Stomp's enemy is no longer a legal attack target.",
      );
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 8,
          attack: true,
          source: "hero",
          attackInitiated: true,
        }),
      );
      break;
    case "antman:hive-mind": {
      need(applicableForm(s) === "tiny", "Hive Mind requires Tiny hero form.");
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        break;
      }
      const amount =
        2 + s.player.inPlay.filter((p) => p.code === "12007").length;
      select(
        s,
        "Hive Mind",
        ports.schemeTargets(s, true),
        E("thwart", {
          amount,
          action: true,
          source: "hero",
          thwartInitiated: true,
        }),
        ports,
      );
      break;
    }
    case "antman:puny-pest":
      select(
        s,
        "Puny Pest",
        ports.schemeTargets(s, false),
        E("thwart", {
          amount: 1,
          action: false,
          source: "hero",
          ignoreCrisis: true,
        }),
        ports,
      );
      break;
    case "antman:giant-nuisance":
      select(
        s,
        "Giant Nuisance",
        ports.enemyTargets(s, false),
        E("damage", { amount: 1, source: "hero" }),
        ports,
      );
      break;
    case "antman:unwind":
      ports.queue(s, E("heal", { target: "hero", amount: 1 }));
      break;
    case "antman:helmet": {
      const p = own(s, e.id, "12008");
      if (p && !ports.isTextBlank(s, p))
        ports.queue(
          s,
          E(e.form === "giant" ? "heal" : "draw", {
            target: "hero",
            amount: e.form === "giant" ? 2 : 1,
          }),
        );
      break;
    }
    case "antman:strength": {
      const p = own(s, e.id, "12009");
      if (!p || ports.isTextBlank(s, p) || turnKey(s) !== e.turn) break;
      if (s.flags.antManStrengthTurn !== e.turn)
        s.flags.antManStrengthAmount = 0;
      s.flags.antManStrengthTurn = e.turn;
      s.flags.antManStrengthAmount =
        Number(s.flags.antManStrengthAmount || 0) + 1;
      break;
    }
    case "antman:wasp":
      select(
        s,
        "Wasp",
        e.form === "giant"
          ? ports.enemyTargets(s, false)
          : ports.schemeTargets(s, false),
        E(e.form === "giant" ? "damage" : "thwart", {
          amount: 2,
          action: false,
          source: "hero",
          ignoreCrisis: true,
        }),
        ports,
      );
      break;
    case "antman:army": {
      const p = own(s, e.id, "12007");
      need(
        p &&
          !p.exhausted &&
          applicableForm(s) === "tiny" &&
          !ports.isTextBlank(s, p),
        "Army of Ants requires Tiny form and a ready support with its text.",
      );
      select(
        s,
        "Army of Ants",
        ports.enemyTargets(s, false),
        A("army-hit", { id: e.id }),
        ports,
      );
      break;
    }
    case "antman:army-hit": {
      const p = own(s, e.id, "12007");
      need(
        p &&
          !p.exhausted &&
          applicableForm(s) === "tiny" &&
          !ports.isTextBlank(s, p) &&
          ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Army of Ants no longer has a legal cost and target.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 1, source: p!.id }),
      );
      break;
    }
    case "antman:gauntlets": {
      need(
        antManAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "wrist-gauntlets",
        ),
        "Wrist Gauntlets is unavailable.",
      );
      const form = applicableForm(s),
        status = form === "giant" ? "stunned" : "confused";
      select(
        s,
        "Wrist Gauntlets",
        ports
          .enemyTargets(s, false)
          .filter((t) => ports.canGiveStatus(s, t.id, status)),
        A("gauntlets-pay", { id: e.id, form, status }),
        ports,
      );
      break;
    }
    case "antman:gauntlets-pay": {
      const p = own(s, e.id, "12010");
      need(
        p &&
          !p.exhausted &&
          applicableForm(s) === e.form &&
          !ports.isTextBlank(s, p) &&
          ports.canGiveStatus(s, e.target, e.status),
        "Wrist Gauntlets no longer has a legal cost and target.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Wrist Gauntlets",
          cost: 2,
          requirements:
            e.form === "giant"
              ? ["physical", "physical"]
              : ["energy", "energy"],
          targetCode: "12010",
          cancelable: true,
          commit: [E("exhaust", { id: p!.id })],
          after: [
            A("gauntlets-paid", {
              id: e.id,
              form: e.form,
              status: e.status,
              target: e.target,
            }),
          ],
        }),
      );
      break;
    }
    case "antman:gauntlets-paid": {
      const p = own(s, e.id, "12010");
      need(
        p &&
          applicableForm(s) === e.form &&
          !ports.isTextBlank(s, p) &&
          ports.canGiveStatus(s, e.target, e.status),
        "Wrist Gauntlets no longer has a legal cost and target.",
      );
      ports.queue(s, E("status", { target: e.target, status: e.status }));
      break;
    }
    case "antman:obligation": {
      need(
        active(s) && e.piece?.code === "12025",
        "Care for Cassie must resolve for Scott Lang.",
      );
      if (s.player.form === "hero" && canChange(s, ports))
        ports.choose(
          s,
          "Care for Cassie",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to Scott Lang", [
              A("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              A("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, A("obligation-choice", { piece: e.piece }));
      break;
    }
    case "antman:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && canChange(s, ports),
        "Scott Lang cannot change form.",
      );
      ports.queue(s, A("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "antman:obligation-choice": {
      const choices = [
        option(
          "discard",
          "Discard 1 card · cannot change form until your next turn ends",
          [A("obligation-discard")],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust Scott Lang · remove Care for Cassie from the game",
            [A("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Care for Cassie",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "antman:obligation-remove": {
      need(
        active(s) && s.player.form === "alter" && !s.player.exhausted,
        "Scott Lang cannot pay the exhaustion cost.",
      );
      const p = e.piece as Piece;
      need(p?.code === "12025", "This is not Care for Cassie.");
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
    case "antman:obligation-discard":
      if (s.player.hand.length)
        ports.choose(
          s,
          "Care for Cassie",
          "Choose 1 card to discard. Your form is then locked until your next turn ends.",
          s.player.hand.map((p) =>
            option(
              p.id,
              definition(p).name,
              [A("obligation-lock", { cardId: p.id })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, A("obligation-lock"));
      break;
    case "antman:obligation-lock":
      if (e.cardId) {
        need(
          s.player.hand.some((p) => p.id === e.cardId),
          "The chosen card is no longer in your hand.",
        );
        ports.discardHand(s, e.cardId);
      }
      s.flags.antManCannotChangeUntilTurnEnd = s.round + 1;
      break;
    case "antman:attach-increase": {
      const yellowjackets = s.minions.filter((p) => p.code === "12027");
      select(
        s,
        "Size Increase",
        (yellowjackets.length ? yellowjackets : [s.villain]).map((p) => ({
          id: p.id,
          label: definition(p)?.name || "Villain",
          code: p.code,
        })),
        A("increase-attached", { id: e.id }),
        ports,
      );
      break;
    }
    case "antman:increase-attached": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "12028");
      const yellowjackets = s.minions.filter((p) => p.code === "12027");
      need(
        p &&
          (yellowjackets.length
            ? yellowjackets.some((y) => y.id === e.target)
            : e.target === s.villain.id),
        "Size Increase has no legal attachment target.",
      );
      p!.attachedTo = e.target;
      p!.counters = 3;
      break;
    }
    case "antman:increase-used": {
      const p = s.attachments.find(
        (p) =>
          p.id === e.id && p.code === "12028" && p.attachedTo === e.enemyId,
      );
      if (p && p.counters > 0 && --p.counters === 0)
        ports.discardPiece(s, p.id);
      break;
    }
    case "antman:plan": {
      // This discard-until effect stops at the original deck boundary. Move a
      // found physical card out of discard BEFORE recycling the emptied deck.
      while (s.encounter.deck.length) {
        const p = s.encounter.deck.shift()!;
        delete s.encounter.knownTop;
        ports.revealHidden(s);
        s.encounter.discard.push(p);
        if (definition(p)?.set_code === "ant_nemesis") {
          s.encounter.discard.splice(s.encounter.discard.indexOf(p), 1);
          ports.recycleEncounter(s);
          ports.queue(s, E("reveal", { piece: p }));
          return true;
        }
      }
      ports.recycleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Ant-Man effect: ${e.type}`);
  }
  return true;
}
