import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const R = (type: string, args: Record<string, unknown> = {}) =>
  E(`rocket:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const definition = (p: Piece) => cards.get(p.code)!;
const active = (s: GameState) =>
  ["rocket", "rocket_raccoon"].includes(s.heroId);
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const turnKey = (s: GameState) => `${s.round}:${s.phase}:${s.turnPlayerId}`;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const tech = (p: Piece) =>
  definition(p)?.type_code === "upgrade" &&
  (definition(p).traits || "").split(/\.\s*/).includes("Tech");
const techUpgrades = (s: GameState) => s.player.inPlay.filter(tech);
const optional = (title: string, text: string, effects: Effect[]) =>
  E("optional", { title, text, effects });

export const ROCKET_SCRIPT_CODES = [
  "16029a",
  "16029b",
  "16030",
  "16031",
  "16032",
  "16033",
  "16034",
  "16035",
  "16036",
  "16037",
  "16038",
  "16039",
  "16053",
  "16054",
  "16055",
  "16056",
  "16057",
] as const;
export const ROCKET_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const ROCKET_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface RocketPorts extends AntManPorts {
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
  /** Resolve one simultaneous nonattack packet against this saved enemy
   * snapshot. Commit damage to every enemy before defeating any of them or
   * offering their damage responses. */
  damageBatch(
    s: GameState,
    targets: string[],
    amount: number,
    source: string,
  ): void;
  /** Discard the real top encounter card and recycle immediately if empty;
   * the saved emptied flag ends this discard-until effect. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
}

export function rocketStats(s: GameState) {
  const copies = (code: string) =>
    active(s) && s.player.form === "hero"
      ? s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p))
          .length
      : 0;
  return {
    attack: copies("16035"),
    thwart:
      copies("16039") +
      (active(s) &&
      s.player.form === "hero" &&
      s.flags.rocketPlanPhase === phaseKey(s)
        ? Number(s.flags.rocketPlanAmount || 0)
        : 0),
  };
}
export function rocketMaxHpBonus(s: GameState): number {
  return active(s)
    ? s.player.inPlay.filter((p) => p.code === "16035" && !isTextBlank(s, p))
        .length * 3
    : 0;
}
export function rocketHeroTraits(s: GameState): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "16039" && !isTextBlank(s, p))
    ? ["Aerial"]
    : [];
}
export function rocketEnemyStats(s: GameState, p: Piece) {
  // The printed +2 ATK icon is present on the official face, but omitted by
  // this catalog's transcription of Blackjack's Bazooka.
  return {
    attack:
      s.attachments.filter((a) => a.code === "16056" && a.attachedTo === p.id)
        .length * 2,
  };
}
export function rocketPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.rocketPlanPhase;
    delete flags.rocketPlanAmount;
    delete flags.rocketSchadenTurn;
    delete flags.rocketSchadenAmount;
  }
}
export function rocketTurnEnded(
  s: GameState,
  endedPlayerId = s.turnPlayerId,
): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    if (flags.rocketSchadenTurn === `${s.round}:${s.phase}:${endedPlayerId}`) {
      delete flags.rocketSchadenTurn;
      delete flags.rocketSchadenAmount;
    }
  }
}
export function rocketRoundEnded(s: GameState): void {
  for (const seat of s.players)
    delete seatView(s, seat).flags.rocketTinkerRound;
}

export function rocketEnterPlay(s: GameState, p: Piece): Effect[] | null {
  const counters = (
    { "16034": 2, "16036": 2, "16037": 2, "16038": 3 } as Record<string, number>
  )[p.code];
  if (counters === undefined) return null;
  if (!isTextBlank(s, p)) p.counters = counters;
  return [];
}
export function rocketPlayRestriction(s: GameState, p: Piece): string | null {
  if (p.code === "16030")
    return "I've Got a Plan is a response to an actual basic thwart.";
  if (!["16031", "16032"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  return p.code === "16031" && !techUpgrades(s).some((p) => p.exhausted)
    ? "There is no exhausted Tech upgrade to ready."
    : null;
}
export function rocketEvent(_s: GameState, p: Piece): Effect[] | null {
  return (
    (
      {
        "16030": [R("plan")],
        "16031": [R("reload")],
        "16032": [R("schadenfreude")],
      } as Record<string, Effect[]>
    )[p.code] || null
  );
}
export function rocketAbilityOptions(
  s: GameState,
  id: string,
  ports: RocketPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.rocketTinkerRound !== s.round &&
      techUpgrades(s).length
      ? [
          option(
            "tinkering",
            "Tinkering · discard a Tech upgrade, draw 2",
            [R("tinker")],
            "16029b",
          ),
        ]
      : [];
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p) || p.counters < 1) return [];
  if (p.code === "16034")
    return techUpgrades(s).some((t) => t.id !== id)
      ? [
          option(
            "battery",
            "Battery Pack · move 1 charge counter to another Tech upgrade",
            [R("battery", { id })],
            p.code,
          ),
        ]
      : [];
  if (s.player.form !== "hero") return [];
  if (["16036", "16038"].includes(p.code) && ports.enemyTargets(s, true).length)
    return [
      option(
        "weapon",
        `${definition(p).name} · exhaust and spend 1 charge counter`,
        [R("weapon", { id })],
        p.code,
      ),
    ];
  return p.code === "16037"
    ? [
        option(
          "launcher",
          "Rocket Launcher · damage the villain and one player's minions",
          [R("launcher", { id })],
          p.code,
        ),
      ]
    : [];
}
export function rocketAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: RocketPorts,
): Effect[] | null {
  const choices = rocketAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}

export function rocketAfterBasicThwart(
  s: GameState,
  after: Effect[],
  ports: RocketPorts,
): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "16030" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "I've Got a Plan · ready Rocket and get +1 THW this phase",
        [R("plan-pay", { id: p.id, after })],
        p.code,
      ),
    );
}
export function rocketResourceSpent(s: GameState, p: Piece): Effect[] {
  return p.code === "16033" && s.player.discard.some(tech)
    ? [
        optional(
          "Salvage",
          "Put a Tech upgrade from your discard pile on top of your deck?",
          [R("salvage")],
        ),
      ]
    : [];
}

export interface RocketDamageSnapshot {
  target?: string;
  code?: string;
  stage?: number;
  playerId?: string;
  actualDamage: number;
  /** Saves before the dealt/taken split fall back to actualDamage. */
  damageDealt?: number;
  excessDamage: number;
  /** Allies and supports remain separate sources. Controlled upgrades and
   * events dealing damage on behalf of the player are identity sources. */
  sourceIsIdentity: boolean;
  wasHero?: boolean;
}
/** The host calls once for each actual enemy damage packet, including damage
 * dealt by overkill. No attack requirement or once-per-round limit applies. */
export function rocketDamageResolved(
  s: GameState,
  snapshot: RocketDamageSnapshot,
): Effect[] {
  if (
    !active(s) ||
    !snapshot.sourceIsIdentity ||
    (snapshot.damageDealt ?? snapshot.actualDamage) <= 0 ||
    (snapshot.playerId && snapshot.playerId !== s.activePlayerId)
  )
    return [];
  const effects: Effect[] = [];
  if (s.flags.rocketSchadenTurn === turnKey(s))
    effects.push(
      E("heal", {
        target: "hero",
        amount: 2 * Number(s.flags.rocketSchadenAmount || 1),
        title: "Schadenfreude",
        mandatory: true,
      }),
    );
  if (
    snapshot.excessDamage > 0 &&
    snapshot.wasHero !== false &&
    s.player.form === "hero"
  )
    effects.push({
      ...optional(
        '"Murdered You!"',
        "Draw 1 card after dealing excess damage?",
        [E("draw", { amount: 1 })],
      ),
      mandatory: false,
    });
  return effects;
}
/** Useful to the host's source classification before the damage packet moves
 * any physical upgrade or event out of play. */
export function rocketIsIdentitySource(
  s: GameState,
  source: string,
  eventId = s.currentEventId,
): boolean {
  const event = s.resolving.find(
    (p) =>
      p.id === eventId &&
      definition(p)?.type_code === "event" &&
      (!p.ownerId || p.ownerId === s.activePlayerId),
  );
  if (["hero", `hero:${s.activePlayerId}`].includes(source))
    return !eventId || !!event;
  if (event && [event.id, event.code].includes(source)) return true;
  const upgrade = allInPlay(s).find(
    (p) =>
      p.id === source &&
      definition(p)?.type_code === "upgrade" &&
      controller(s, p.id)?.id === s.activePlayerId,
  );
  return (
    !!upgrade &&
    !allInPlay(s).some(
      (p) => p.id === upgrade.attachedTo && definition(p)?.type_code === "ally",
    ) &&
    !s.players.some(
      (seat) =>
        seat.id !== s.activePlayerId &&
        upgrade.attachedTo === `hero:${seat.id}`,
    )
  );
}
export function rocketAttachmentActions(
  s: GameState,
  p: Piece,
  ports: RocketPorts,
): Option[] {
  return p.code === "16056" &&
    s.player.form === "hero" &&
    !ports.isTextBlank(s, p) &&
    ports.canPay(s, 3, ["mental", "mental", "mental"], undefined, p.code)
    ? [
        option(
          "remove",
          "Spend 3 mental resources · discard Blackjack's Bazooka",
          [R("bazooka-pay", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function rocketEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "16053": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [R("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "16054":
    case "16055":
      return [];
    case "16056":
      return [R("bazooka", { id: p.id })];
    case "16057":
      return [R("invasion")];
    default:
      return null;
  }
}
export function rocketBoost(_s: GameState, _p: Piece): Effect[] | null {
  return null;
}

function selectTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: RocketPorts,
) {
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
}
function highestUpgrades(s: GameState) {
  const upgrades = s.player.inPlay.filter(
    (p) => definition(p)?.type_code === "upgrade",
  );
  const highest = Math.max(
    ...upgrades.map((p) => Number(definition(p).cost || 0)),
  );
  return upgrades.filter((p) => Number(definition(p).cost || 0) === highest);
}

export function resolveRocketEffect(
  s: GameState,
  e: Effect,
  ports: RocketPorts,
): boolean {
  if (!e.type.startsWith("rocket:")) return false;
  switch (e.type) {
    case "rocket:tinker":
      need(
        rocketAbilityOptions(s, "identity", ports).length,
        "Tinkering is unavailable.",
      );
      ports.select(
        s,
        "Tinkering",
        "Discard 1 Tech upgrade you control as the cost.",
        techUpgrades(s),
        1,
        1,
        R("tinker-discard"),
      );
      break;
    case "rocket:tinker-discard": {
      const ids = (e.ids || e.selected || []) as string[];
      const p = ids.length === 1 ? own(s, ids[0]) : undefined;
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.rocketTinkerRound !== s.round &&
          p &&
          tech(p),
        "Choose an actual controlled Tech upgrade for Tinkering.",
      );
      ports.discardPiece(s, p!.id);
      s.flags.rocketTinkerRound = s.round;
      ports.queue(s, E("draw", { amount: 2 }));
      break;
    }
    case "rocket:battery": {
      const p = own(s, e.id, "16034");
      need(
        p &&
          rocketAbilityOptions(s, e.id, ports).some((o) => o.id === "battery"),
        "Battery Pack is unavailable.",
      );
      p!.exhausted = true;
      selectTarget(
        s,
        "Battery Pack",
        techUpgrades(s)
          .filter((t) => t.id !== e.id)
          .map((t) => ({ id: t.id, label: definition(t).name, code: t.code })),
        R("battery-move", { id: e.id }),
        ports,
      );
      break;
    }
    case "rocket:battery-move": {
      const p = own(s, e.id, "16034"),
        target = own(s, e.target);
      need(
        p &&
          p.exhausted &&
          p.counters > 0 &&
          target &&
          target.id !== p.id &&
          tech(target),
        "Choose another controlled Tech upgrade for the charge counter.",
      );
      p!.counters--;
      target!.counters++;
      break;
    }
    case "rocket:weapon": {
      const p = own(s, e.id);
      need(
        p &&
          rocketAbilityOptions(s, e.id, ports).some((o) => o.id === "weapon"),
        "This charged weapon is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      selectTarget(
        s,
        definition(p!).name,
        ports.enemyTargets(s, true),
        E("attackAction", {
          amount: p!.code === "16036" ? 4 : 2,
          source: "hero",
          ...(p!.code === "16036" ? { overkill: true, ranged: true } : {}),
        }),
        ports,
      );
      break;
    }
    case "rocket:launcher": {
      const p = own(s, e.id, "16037");
      need(
        p &&
          rocketAbilityOptions(s, e.id, ports).some((o) => o.id === "launcher"),
        "Rocket Launcher is unavailable.",
      );
      p!.exhausted = true;
      p!.counters--;
      const seats = playerOrder(s);
      if (seats.length === 1)
        ports.queue(s, R("launcher-damage", { playerId: seats[0].id }));
      else
        ports.choose(
          s,
          "Rocket Launcher",
          "Choose a player whose engaged minions take damage.",
          seats.map((seat) =>
            option(
              seat.id,
              cards.get(
                seat.heroId === "rocket"
                  ? "16029a"
                  : seat.heroId === "groot"
                    ? "16001a"
                    : "",
              )?.name || seat.id,
              [R("launcher-damage", { playerId: seat.id })],
            ),
          ),
        );
      break;
    }
    case "rocket:launcher-damage":
      need(
        s.players.some((seat) => seat.id === e.playerId && !seat.eliminated),
        "Choose an active player.",
      );
      ports.damageBatch(
        s,
        [
          s.villain.id,
          ...s.minions
            .filter((p) => (p.engagedWith || s.activePlayerId) === e.playerId)
            .map((p) => p.id),
        ],
        2,
        "hero",
      );
      break;
    case "rocket:reload":
      need(s.player.form === "hero", "Reload requires hero form.");
      ports.queue(
        s,
        ...techUpgrades(s)
          .filter((p) => p.exhausted)
          .map((p) => E("ready", { target: p.id })),
      );
      break;
    case "rocket:schadenfreude":
      need(s.player.form === "hero", "Schadenfreude requires hero form.");
      if (s.flags.rocketSchadenTurn !== turnKey(s))
        s.flags.rocketSchadenAmount = 0;
      s.flags.rocketSchadenTurn = turnKey(s);
      s.flags.rocketSchadenAmount =
        Number(s.flags.rocketSchadenAmount || 0) + 1;
      break;
    case "rocket:plan-window": {
      const choices = rocketAfterBasicThwart(s, e.after || [], ports);
      if (choices.length)
        ports.choose(
          s,
          "Basic thwart response",
          "Play I've Got a Plan, or continue.",
          [...choices, option("continue", "Continue", e.after || [])],
        );
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "rocket:plan-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "16030");
      need(
        p &&
          rocketAfterBasicThwart(s, e.after || [], ports).some(
            (o) => o.id === e.id,
          ),
        "I've Got a Plan is unavailable for this basic thwart.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "I've Got a Plan",
          piece: p,
          cost: ports.cardCost(s, p!),
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [R("plan")],
              continuation: [R("plan-window", { after: e.after || [] })],
            }),
          ],
        }),
      );
      break;
    }
    case "rocket:plan":
      need(
        active(s) && s.player.form === "hero",
        "I've Got a Plan requires Rocket's hero form.",
      );
      if (s.flags.rocketPlanPhase !== phaseKey(s)) s.flags.rocketPlanAmount = 0;
      s.flags.rocketPlanPhase = phaseKey(s);
      s.flags.rocketPlanAmount = Number(s.flags.rocketPlanAmount || 0) + 1;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    case "rocket:salvage": {
      const eligible = s.player.discard.filter(tech);
      if (eligible.length)
        ports.choose(
          s,
          "Salvage",
          "Put a discarded Tech upgrade on top of your deck.",
          eligible.map((p) =>
            option(
              p.id,
              definition(p).name,
              [R("salvage-top", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "rocket:salvage-top": {
      const i = s.player.discard.findIndex((p) => p.id === e.id && tech(p));
      need(i >= 0, "Salvage requires an actual discarded Tech upgrade.");
      s.player.deck.unshift(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "rocket:obligation":
      need(
        active(s) && e.piece?.code === "16053",
        "Crisis on Halfworld belongs to Rocket Raccoon.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Crisis on Halfworld",
          "You may flip to alter-ego before choosing.",
          [
            option("flip", "Change to alter-ego", [
              R("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              R("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, R("obligation-choice", { piece: e.piece }));
      break;
    case "rocket:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Rocket cannot change form.",
      );
      ports.queue(s, R("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "rocket:obligation-choice": {
      const choices = [
        option("discard", "Discard your highest cost upgrade (surge if none)", [
          R("obligation-discard", { piece: e.piece }),
        ]),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option(
            "remove",
            "Exhaust your alter-ego · remove Crisis on Halfworld from the game",
            [R("obligation-remove", { piece: e.piece })],
          ),
        );
      ports.choose(
        s,
        "Crisis on Halfworld",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "rocket:obligation-remove": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "16053",
        "Rocket cannot pay the exhaustion cost.",
      );
      s.player.exhausted = true;
      const p = e.piece as Piece;
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
    case "rocket:obligation-discard": {
      const eligible = highestUpgrades(s);
      if (!eligible.length) ports.queue(s, E("surge", { sourceCode: "16053" }));
      else
        selectTarget(
          s,
          "Crisis on Halfworld",
          eligible.map((p) => ({
            id: p.id,
            label: definition(p).name,
            code: p.code,
          })),
          R("obligation-upgrade"),
          ports,
        );
      break;
    }
    case "rocket:obligation-upgrade":
      need(
        highestUpgrades(s).some((p) => p.id === e.target),
        "Discard one of your highest cost upgrades.",
      );
      ports.discardPiece(s, e.target);
      break;
    case "rocket:bazooka": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "16056");
      if (p)
        p.attachedTo =
          s.minions.find((p) => p.code === "16055")?.id || s.villain.id;
      break;
    }
    case "rocket:bazooka-pay": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "16056");
      need(
        p && rocketAttachmentActions(s, p, ports).length,
        "Blackjack's Bazooka cannot be discarded.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Blackjack's Bazooka",
          cost: 3,
          requirements: ["mental", "mental", "mental"],
          targetCode: p!.code,
          cancelable: true,
          after: [R("bazooka-discard", { id: p!.id })],
        }),
      );
      break;
    }
    case "rocket:bazooka-discard":
      ports.discardPiece(s, e.id);
      break;
    case "rocket:invasion": {
      let minion: Piece | undefined;
      for (
        let remaining = s.encounter.deck.length || s.encounter.discard.length;
        remaining > 0;
        remaining--
      ) {
        const discarded = ports.discardEncounterTop(s);
        if (
          discarded.piece &&
          definition(discarded.piece)?.type_code === "minion"
        ) {
          minion = discarded.piece;
          break;
        }
        if (!discarded.piece || discarded.emptied) break;
      }
      if (minion) {
        // If exhaustion recycled the deck, remove the selected physical card
        // from that new deck too. It is revealed from the discard search.
        s.encounter.deck = s.encounter.deck.filter((p) => p.id !== minion!.id);
        s.encounter.discard = s.encounter.discard.filter(
          (p) => p.id !== minion!.id,
        );
        ports.queue(
          s,
          E("reveal", { piece: minion, fromEncounterDeck: false }),
          R("invasion-tough", { id: minion.id }),
        );
      }
      break;
    }
    case "rocket:invasion-tough":
      if (s.minions.some((p) => p.id === e.id))
        ports.queue(s, E("status", { target: e.id, status: "tough" }));
      break;
    default:
      throw Error(`Unknown Rocket effect: ${e.type}`);
  }
  return true;
}
