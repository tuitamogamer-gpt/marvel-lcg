import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { consumeStatus } from "./keywords.js";
import type { PaymentSource } from "./payment.js";
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
const H = (type: string, args: Record<string, unknown> = {}) =>
  E(`hawkeye:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const definition = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const trait = (p: Piece | string, value: string) =>
  (definition(p)?.traits || "").split(/\.\s*/).includes(value);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const bow = (s: GameState) => s.player.inPlay.find((p) => p.code === "04002");
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
// A printed maximum is shared across all copies and all players. Keep its
// receipt with the player who used it, including after that player is eliminated.
const goliathUsedThisPhase = (s: GameState) =>
  s.players.some(
    (seat) => seatView(s, seat).flags.hawkeyeGoliathPhase === phaseKey(s),
  );
const teamTraining = (p: Piece) => definition(p)?.name === "Team Training";
const skyCycle = (p: Piece) => definition(p)?.name === "Sky Cycle";
const arrows = new Set(["04005", "04006", "04007", "04008", "04009"]);
const arrowEvent = (p: Piece) =>
  definition(p)?.type_code === "event" && trait(p, "Arrow");
const livePlayers = (s: GameState) => playerOrder(s);
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const reset = (p: Piece): Piece => ({
  id: p.id,
  code: p.code,
  ownerId: p.ownerId,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
});

/** The complete Hawkeye half of Rise of Red Skull: 31 distinct faces. */
export const HAWKEYE_CORE_ALIASES = [
  "04018",
  "04019",
  "04023",
  "04024",
  "04025",
] as const;
/** Avengers Tower is already wholly owned by captain-pack.ts. */
export const HAWKEYE_EXISTING_CODES = ["04021"] as const;
/** U.S. Agent's whole text is the generic Retaliate keyword. */
export const HAWKEYE_COMPILED_CODES = ["04014"] as const;
export const HAWKEYE_SCRIPT_CODES = [
  "04001a",
  "04001b",
  "04002",
  "04003",
  "04004",
  "04005",
  "04006",
  "04007",
  "04008",
  "04009",
  "04010",
  "04011",
  "04012",
  "04013",
  "04015",
  "04016",
  "04017",
  "04020",
  "04022",
  "04026",
  "04027",
  "04028",
  "04029",
  "04030",
] as const;
export const HAWKEYE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf";
export const HAWKEYE_STARTER_SOURCE =
  "https://images-cdn.fantasyflightgames.com/filer_public/92/1d/921ddef8-c28c-4096-a9e9-63142230a602/mc10_the_rise_of_red_skull_rules_web.pdf";

export interface HawkeyeTarget {
  id: string;
  label: string;
  code?: string;
}
export interface HawkeyePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  revealHidden(s: GameState): void;
  shufflePlayerDeck(s: GameState): void;
  recyclePlayer(s: GameState): void;
  discardHand(s: GameState, id: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Normal leaves-play cleanup, then move the reset physical card to its OWNER. */
  returnAlly(s: GameState, id: string): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  canChangeForm(s: GameState): boolean;
  flip(s: GameState, counts: boolean): void;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  identityHasTrait(s: GameState, playerId: string, trait: string): boolean;
  characterHasTrait?(s: GameState, id: string, trait: string): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  enemyTargets(s: GameState, attack: boolean): HawkeyeTarget[];
  /** Respect Patrol and threat locks; only crisis is ignored when true. */
  schemeTargets(s: GameState, ignoreCrisis: boolean): HawkeyeTarget[];
  /** Persist on this native attack; applies to its identity, ally and Overkill
   * packets after boost/defender choice, without canceling its other effects. */
  preventAllAttackDamage(s: GameState): void;
  log(s: GameState, message: string): void;
}

export function hawkeyeStats(s: GameState) {
  return { atk: s.player.form === "hero" && !!bow(s) ? 1 : 0 };
}
export function hawkeyeAllyMaxHP(s: GameState, p: Piece): number {
  const seat = controller(s, p.id);
  return seat && definition(p)?.type_code === "ally"
    ? seatView(s, seat).player.inPlay.filter(teamTraining).length
    : 0;
}
export function hawkeyeAllyAttackTraits(p: Piece) {
  return { piercing: p.code === "04012", ranged: p.code === "04020" };
}
export function hawkeyeEnemyAttackTraits(s: GameState, p: Piece) {
  return {
    piercing: p.code === "04027",
    ranged: s.attachments.some(
      (x) => x.code === "04029" && x.attachedTo === p.id,
    ),
  };
}
export function hawkeyeAllyAerial(s: GameState, p: Piece): boolean {
  return allInPlay(s).some((x) => skyCycle(x) && x.attachedTo === p.id);
}
const avengerAlly = (s: GameState, p: Piece, ports: HawkeyePorts) =>
  definition(p)?.type_code === "ally" &&
  (ports.characterHasTrait
    ? ports.characterHasTrait(s, p.id, "Avenger")
    : trait(p, "Avenger"));
const skyCycleTargets = (s: GameState, ports: HawkeyePorts, exclude?: string) =>
  allInPlay(s).filter(
    (p) =>
      avengerAlly(s, p, ports) &&
      !allInPlay(s).some(
        (x) => x.id !== exclude && skyCycle(x) && x.attachedTo === p.id,
      ),
  );
const trainingRecipients = (s: GameState, exclude?: string) =>
  livePlayers(s).filter(
    (seat) =>
      !seatView(s, seat).player.inPlay.some(
        (p) => p.id !== exclude && teamTraining(p),
      ),
  );
const avengers = (s: GameState, ports: HawkeyePorts) => [
  ...(s.player.form === "hero" &&
  ports.identityHasTrait(s, s.activePlayerId, "Avenger")
    ? [{ id: "hero", code: "04001a", exhausted: s.player.exhausted }]
    : []),
  ...s.player.inPlay.filter((p) => avengerAlly(s, p, ports)),
];

export function hawkeyePlayRestriction(
  s: GameState,
  p: Piece,
  ports: HawkeyePorts,
): string | null {
  if (arrows.has(p.code)) {
    if (s.player.form !== "hero") return "Arrow events require hero form.";
    if (!bow(s) || bow(s)!.exhausted)
      return "This Arrow requires a ready Hawkeye's Bow.";
    if (
      ["04005", "04007", "04009"].includes(p.code) &&
      !s.player.stunned &&
      !ports.enemyTargets(s, true).length
    )
      return "There is no legal enemy to attack.";
    if (
      p.code === "04008" &&
      !s.player.confused &&
      !ports.schemeTargets(s, true).length
    )
      return "There is no legal scheme to thwart.";
  }
  if (p.code === "04015" && !skyCycleTargets(s, ports).length)
    return "There is no eligible Avenger ally without Sky Cycle.";
  if (p.code === "04016" && !trainingRecipients(s).length)
    return "Each player already controls Team Training.";
  if (
    p.code === "04017" &&
    (s.player.form !== "hero" ||
      !s.player.inPlay.some(
        (x) => definition(x)?.type_code === "ally" && !x.tough,
      ))
  )
    return "Ready for Action needs a controlled ally without Tough and hero form.";
  if (p.code === "04022") {
    if (s.player.form !== "hero")
      return "Earth's Mightiest Heroes requires hero form.";
    const targets = avengers(s, ports);
    if (
      !targets.some(
        (x) =>
          !x.exhausted &&
          targets.some(
            (y) =>
              y.id !== x.id &&
              y.exhausted &&
              (y.id !== "hero" || ports.canReadyIdentity(s, s.activePlayerId)),
          ),
      )
    )
      return "You need one ready Avenger and another exhausted Avenger you control.";
  }
  return null;
}
export function hawkeyeEvent(s: GameState, p: Piece): Effect[] | null {
  if (arrows.has(p.code)) return [H("arrow", { code: p.code })];
  if (p.code === "04017") return [H("ready-for-action")];
  if (p.code === "04022") return [H("earths-mightiest")];
  return null;
}
export function hawkeyeCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "04003") {
    p.storedCards ||= [];
    return [];
  }
  if (p.code === "04015") return [H("attach-cycle", { id: p.id })];
  if (p.code === "04016") return [H("training-recipient", { id: p.id })];
  return [];
}
/** Quiver's public Arrow faces are playable; its cards are never resources. */
export function hawkeyeStoredPlayable(s: GameState): Piece[] {
  return s.player.inPlay
    .filter((p) => p.code === "04003")
    .flatMap((p) => (p.storedCards || []).filter(arrowEvent));
}
/** Call only AFTER native PLAY legality/cost checks. This removes the exact
 * stored card; the ordinary event lifecycle then owns it through discard. */
export function hawkeyeTakeStoredForPlay(
  s: GameState,
  id: string,
): Piece | undefined {
  for (const quiver of s.player.inPlay.filter((p) => p.code === "04003")) {
    const i = (quiver.storedCards || []).findIndex(
      (p) => p.id === id && arrowEvent(p),
    );
    if (i >= 0) return quiver.storedCards!.splice(i, 1)[0];
  }
  return undefined;
}
export function hawkeyeResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (
    !targetCode ||
    !trait(targetCode, "Arrow") ||
    definition(targetCode)?.type_code !== "event"
  )
    return [];
  return s.player.inPlay
    .filter((p) => p.code === "04010" && !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: definition(p).name,
      kind: "ability",
      resources: ["wild"],
      description: "Exhaust · generate 1 wild resource for an Arrow event",
    }));
}
export function hawkeyeAbilityOptions(
  s: GameState,
  id: string,
  ports: HawkeyePorts,
): Option[] {
  if ((id === "identity" || id === "hero") && s.heroId === "hawkeye") {
    if (s.player.form === "hero")
      return !s.player.exhausted && bow(s)?.exhausted
        ? [
            option(
              "quick-draw",
              "Quick Draw · exhaust Hawkeye, ready Bow",
              [H("quick-draw")],
              "04001a",
            ),
          ]
        : [];
    return s.flags.hawkeyeWeaponPhase !== phaseKey(s) &&
      [...s.player.deck, ...s.player.discard].some((p) => p.code === "04002") &&
      ports.canPay(s, 1, [], undefined, "04001b")
      ? [
          option(
            "weapon-of-choice",
            "Weapon of Choice · spend 1 resource, find Bow",
            [
              E("payRequest", {
                title: "Weapon of Choice",
                cost: 1,
                targetCode: "04001b",
                cancelable: true,
                after: [H("find-bow")],
              }),
            ],
            "04001b",
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (
    p?.code === "04003" &&
    !p.exhausted &&
    s.player.form === "hero" &&
    s.player.deck.length
  )
    return [
      option(
        "quiver",
        "Quiver · search top 5 for an Arrow",
        [H("quiver", { id })],
        p.code,
      ),
    ];
  if (
    p?.code === "04011" &&
    !p.exhausted &&
    s.player.hand.length &&
    ports.enemyTargets(s, false).length
  )
    return [
      option(
        "kate-bishop",
        "Kate Bishop · discard a card, deal its printed resources",
        [H("kate-bishop", { id })],
        p.code,
      ),
    ];
  if (p?.code === "04013" && !goliathUsedThisPhase(s))
    return [
      option(
        "goliath",
        "Goliath · +4 ATK, discard at phase end",
        [H("goliath", { id })],
        p.code,
      ),
    ];
  if (p?.code === "04015" && !p.exhausted) {
    const ally = allInPlay(s).find((x) => x.id === p.attachedTo);
    if (ally?.exhausted)
      return [
        option(
          "sky-cycle",
          "Sky Cycle · ready attached ally",
          [H("cycle-ready", { id, target: ally.id })],
          p.code,
        ),
      ];
  }
  const rifle = s.attachments.find((p) => p.id === id && p.code === "04029");
  if (
    rifle &&
    s.player.form === "hero" &&
    !s.player.exhausted &&
    ports.canPay(s, 1, ["wild"], undefined, rifle.code)
  )
    return [
      option(
        "discard-rifle",
        "Crossfire's Rifle · exhaust hero, spend 1 wild",
        [
          E("payRequest", {
            title: definition(rifle).name,
            cost: 1,
            requirements: ["wild"],
            targetCode: rifle.code,
            cancelable: true,
            after: [H("discard-rifle", { id })],
          }),
        ],
        rifle.code,
      ),
    ];
  return [];
}
export function hawkeyeAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: HawkeyePorts,
): Effect[] | null {
  const choices = hawkeyeAbilityOptions(s, id, ports);
  return (
    (
      choices.find((o) => o.id === action) ||
      (!action && choices.length === 1 ? choices[0] : undefined)
    )?.effects || null
  );
}

/** Interrupt is against THIS controller, in either form, and only the villain.
 * A payment canceled before costs does not return Mockingbird or prevent damage. */
export function hawkeyeAttackInitiatedOptions(
  s: GameState,
  attacker: Piece,
  ports: HawkeyePorts,
): Option[] {
  if (
    attacker.id !== s.villain.id ||
    !s.attack ||
    s.attack.originalPlayerId !== s.activePlayerId ||
    !ports.canPay(s, 1, [], undefined, "04004")
  )
    return [];
  return s.player.inPlay
    .filter((p) => p.code === "04004")
    .map((p) =>
      option(
        p.id,
        "Mockingbird · spend 1 resource, return her to hand, prevent all attack damage",
        [
          E("payRequest", {
            title: "Mockingbird",
            cost: 1,
            targetCode: p.code,
            cancelable: true,
            after: [
              H("mockingbird", {
                id: p.id,
                attacker: attacker.id,
                playerId: s.activePlayerId,
                initiation: Number(s.flags.attacksPerformed || 0),
              }),
            ],
          }),
        ],
        p.code,
      ),
    );
}
export function hawkeyeEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "04026": {
      const owner = livePlayers(s).find((seat) => seat.heroId === "hawkeye");
      return owner ? [H("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "04027":
      return []; // Quickstrike is owned by native minion entry.
    case "04028": {
      const owner = livePlayers(s).find((seat) => seat.heroId === "hawkeye");
      return owner ? [H("marked", { id: p.id, actorId: owner.id })] : [];
    }
    case "04029":
      return [H("attach-rifle", { id: p.id })];
    case "04030":
      return [
        E(s.player.form === "hero" ? "damage" : "threat", {
          target: s.player.form === "hero" ? "hero" : "main",
          amount: 3,
        }),
      ];
    default:
      return null;
  }
}
export function hawkeyeBoost(s: GameState, p: Piece): Effect[] | null {
  return p.code === "04027" ? (s.attack ? [H("crossfire-boost")] : []) : null;
}
/** RRG 1.8 errata returns only this scheme's tucked physical Mockingbird. */
export function hawkeyeSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (p.code !== "04028") return [];
  for (const tucked of p.storedCards || []) {
    const owner = s.players.find((seat) => seat.id === tucked.ownerId);
    if (!owner || owner.eliminated) s.removed.push(reset(tucked));
    else seatView(s, owner).player.hand.push(reset(tucked));
  }
  p.storedCards = [];
  return [];
}
/** Native caller invokes at the actual phase boundary for ALL players, before
 * readying/clearing flags. The physical instance, not a later re-entry, expires. */
export function hawkeyePhaseEnded(
  s: GameState,
  ports: Pick<HawkeyePorts, "discardPiece">,
): void {
  for (const seat of livePlayers(s)) {
    const view = seatView(s, seat);
    for (const key of Object.keys(view.flags))
      if (
        key.startsWith("hawkeyeGoliath:") &&
        view.flags[key] === phaseKey(s)
      ) {
        const p = allInPlay(s).find(
          (x) => x.id === key.slice("hawkeyeGoliath:".length),
        );
        if (p?.code === "04013" && p.used) ports.discardPiece(s, p.id);
        delete view.flags[key];
      }
  }
}
function select(
  s: GameState,
  title: string,
  choices: HawkeyeTarget[],
  action: Effect,
  ports: HawkeyePorts,
) {
  need(choices.length, "There is no eligible target.");
  if (choices.length === 1)
    ports.queue(s, { ...action, target: choices[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose the target for this effect.",
      choices.map((p) =>
        option(p.id, p.label, [{ ...action, target: p.id }], p.code),
      ),
    );
}
function exhaustBow(s: GameState): Piece {
  const p = bow(s);
  need(
    s.player.form === "hero" && p && !p.exhausted,
    "This Arrow needs hero form and a ready Hawkeye's Bow.",
  );
  p!.exhausted = true;
  return p!;
}
export function resolveHawkeyeEffect(
  s: GameState,
  e: Effect,
  ports: HawkeyePorts,
): boolean {
  if (!e.type.startsWith("hawkeye:")) return false;
  switch (e.type) {
    case "hawkeye:quick-draw": {
      need(
        s.heroId === "hawkeye" &&
          s.player.form === "hero" &&
          !s.player.exhausted &&
          bow(s)?.exhausted,
        "Quick Draw needs a ready Hawkeye and exhausted Bow.",
      );
      s.player.exhausted = true;
      bow(s)!.exhausted = false;
      break;
    }
    case "hawkeye:find-bow": {
      need(
        s.heroId === "hawkeye" &&
          s.player.form === "alter" &&
          s.flags.hawkeyeWeaponPhase !== phaseKey(s),
        "Weapon of Choice is unavailable this phase.",
      );
      s.flags.hawkeyeWeaponPhase = phaseKey(s);
      ports.revealHidden(s);
      const zone = [s.player.deck, s.player.discard].find((pile) =>
        pile.some((p) => p.code === "04002"),
      );
      if (zone)
        s.player.hand.push(
          zone.splice(
            zone.findIndex((p) => p.code === "04002"),
            1,
          )[0],
        );
      ports.shufflePlayerDeck(s);
      ports.recyclePlayer(s);
      break;
    }
    case "hawkeye:quiver": {
      const p = own(s, e.id, "04003");
      need(
        p && !p.exhausted && s.player.form === "hero" && s.player.deck.length,
        "Quiver search is unavailable.",
      );
      p!.exhausted = true;
      ports.revealHidden(s);
      const top = s.player.deck.slice(0, 5),
        found = top.filter(arrowEvent);
      ports.choose(
        s,
        "Hawkeye's Quiver",
        "Choose one Arrow from the top 5 or finish without finding one. Shuffle the entire deck afterward.",
        [
          ...found.map((x) =>
            option(
              x.id,
              definition(x).name,
              [
                H("quiver-found", {
                  id: p!.id,
                  target: x.id,
                  searched: top.map((p) => p.id),
                }),
              ],
              x.code,
            ),
          ),
          option("none", "Find no Arrow · shuffle deck", [
            H("quiver-found", { id: p!.id, searched: top.map((p) => p.id) }),
          ]),
        ],
      );
      break;
    }
    case "hawkeye:quiver-found": {
      const p = own(s, e.id, "04003");
      need(p, "The searched Quiver is no longer in play.");
      if (e.target) {
        const i = s.player.deck.findIndex(
          (x) => x.id === e.target && arrowEvent(x),
        );
        need(
          i >= 0 && e.searched.includes(e.target),
          "The card was not an Arrow in this search.",
        );
        const [arrow] = s.player.deck.splice(i, 1);
        arrow.ownerId ||= s.activePlayerId;
        (p!.storedCards ||= []).push(reset(arrow));
      }
      ports.shufflePlayerDeck(s);
      ports.recyclePlayer(s);
      break;
    }
    case "hawkeye:arrow": {
      need(arrows.has(e.code), "Unregistered Arrow event.");
      exhaustBow(s);
      if (["04005", "04007", "04009"].includes(e.code)) {
        if (s.player.stunned) {
          consumeStatus(s.player, "stunned");
          break;
        }
        select(
          s,
          definition(e.code).name,
          ports.enemyTargets(s, true),
          H("arrow-hit", { code: e.code }),
          ports,
        );
      } else if (e.code === "04008") {
        if (s.player.confused) {
          consumeStatus(s.player, "confused");
          break;
        }
        select(
          s,
          "Cable Arrow",
          ports.schemeTargets(s, true),
          E("thwart", {
            amount: 3,
            action: true,
            source: "hero",
            thwartInitiated: true,
            ignoreCrisis: true,
          }),
          ports,
        );
      } else {
        ports.choose(
          s,
          "Explosive Arrow",
          "Choose a player. Deal 3 non-attack damage to the villain and each minion engaged with that player.",
          livePlayers(s).map((seat) =>
            option(
              seat.id,
              definition(
                seat.heroId === "hawkeye"
                  ? "04001a"
                  : [...cards.values()].find(
                      (c) =>
                        c.set_code === seat.heroId && c.type_code === "hero",
                    )?.code || "04001a",
              ).name,
              [H("explosive", { playerId: seat.id })],
            ),
          ),
        );
      }
      break;
    }
    case "hawkeye:arrow-hit": {
      const p = enemy(s, e.target);
      need(
        p && ports.enemyTargets(s, true).some((x) => x.id === e.target),
        "This Arrow has no legal enemy target.",
      );
      const status = e.code === "04005" ? "confused" : "stunned";
      // AND is simultaneous: the damage alternative is evaluated before adding
      // the new status. Steady's first card is not yet an active status.
      const amount = e.code === "04009" ? 6 : p![status] ? 5 : 3;
      const effects =
        e.code === "04009" ? [] : [E("status", { target: p!.id, status })];
      ports.queue(
        s,
        ...effects,
        E("damage", {
          target: p!.id,
          amount,
          attack: true,
          source: "hero",
          attackInitiated: true,
          ranged: !!bow(s),
          piercing: e.code === "04009",
        }),
      );
      break;
    }
    case "hawkeye:explosive": {
      need(
        livePlayers(s).some((p) => p.id === e.playerId),
        "Explosive Arrow's player is unavailable.",
      );
      ports.queue(
        s,
        ...[
          s.villain,
          ...s.minions.filter(
            (p) => (p.engagedWith || s.activePlayerId) === e.playerId,
          ),
        ].map((p) => E("damage", { target: p.id, amount: 3, source: "hero" })),
      );
      break;
    }
    case "hawkeye:kate-bishop": {
      const p = own(s, e.id, "04011");
      need(
        p && !p.exhausted && s.player.hand.length,
        "Kate Bishop needs a ready ally and one card in hand.",
      );
      // Choose both parts of the cost before spending either.
      ports.choose(
        s,
        "Hawkeye · Kate Bishop",
        "Choose a card to discard. Damage equals its PRINTED resources.",
        s.player.hand.map((x) =>
          option(
            x.id,
            `${definition(x).name} · ${printedResources(x)} damage`,
            [H("kate-discard", { id: p!.id, cardId: x.id })],
            x.code,
          ),
        ),
      );
      break;
    }
    case "hawkeye:kate-discard": {
      const p = own(s, e.id, "04011"),
        discarded = s.player.hand.find((x) => x.id === e.cardId);
      need(
        p && !p.exhausted && discarded,
        "Kate Bishop's complete cost is unavailable.",
      );
      const amount = printedResources(discarded!);
      p!.exhausted = true;
      ports.discardHand(s, discarded!.id);
      select(
        s,
        "Kate Bishop",
        ports.enemyTargets(s, false),
        E("damage", { amount, source: p!.id }),
        ports,
      );
      break;
    }
    case "hawkeye:goliath": {
      const p = own(s, e.id, "04013");
      need(p && !goliathUsedThisPhase(s), "Goliath is unavailable this phase.");
      s.flags.hawkeyeGoliathPhase = phaseKey(s);
      s.flags[`hawkeyeGoliath:${p!.id}`] = phaseKey(s);
      // The normal leave-play reset removes this in-play-instance marker. A
      // returned/replayed physical card is therefore not the delayed target.
      p!.used = true;
      p!.bonusAtk = (p!.bonusAtk || 0) + 4;
      break;
    }
    case "hawkeye:attach-cycle": {
      const p = own(s, e.id, "04015");
      need(p, "Sky Cycle is no longer in play.");
      select(
        s,
        "Sky Cycle",
        skyCycleTargets(s, ports, p!.id).map((x) => ({
          id: x.id,
          label: definition(x).name,
          code: x.code,
        })),
        H("cycle-attached", { id: p!.id }),
        ports,
      );
      break;
    }
    case "hawkeye:cycle-attached": {
      const p = own(s, e.id, "04015");
      need(
        p && skyCycleTargets(s, ports, e.id).some((x) => x.id === e.target),
        "Sky Cycle cannot attach to this target.",
      );
      p!.attachedTo = e.target;
      const recipient = controller(s, e.target);
      need(recipient, "The attached ally has no controller.");
      if (recipient!.id !== s.activePlayerId)
        ports.transferControl(s, p!.id, recipient!.id);
      break;
    }
    case "hawkeye:cycle-ready": {
      const p = own(s, e.id, "04015"),
        ally = allInPlay(s).find((x) => x.id === e.target);
      need(
        p &&
          !p.exhausted &&
          !!ally &&
          p.attachedTo === ally.id &&
          ally.exhausted,
        "Sky Cycle cannot ready its attached ally.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: ally!.id }));
      break;
    }
    case "hawkeye:training-recipient": {
      const p = own(s, e.id, "04016");
      need(p, "Team Training is no longer in play.");
      const choices = trainingRecipients(s, p!.id);
      need(choices.length, "Each player already controls Team Training.");
      if (choices.length === 1) {
        if (choices[0].id !== s.activePlayerId)
          ports.transferControl(s, p!.id, choices[0].id);
      } else
        ports.choose(
          s,
          "Team Training",
          "Choose the player who controls this support.",
          choices.map((seat) =>
            option(seat.id, `${seat.id} · ${seat.heroId}`, [
              H("training-transfer", { id: p!.id, playerId: seat.id }),
            ]),
          ),
        );
      break;
    }
    case "hawkeye:training-transfer": {
      need(
        own(s, e.id, "04016") &&
          trainingRecipients(s, e.id).some((seat) => seat.id === e.playerId),
        "This player already controls Team Training.",
      );
      if (e.playerId !== s.activePlayerId)
        ports.transferControl(s, e.id, e.playerId);
      break;
    }
    case "hawkeye:ready-for-action":
      need(s.player.form === "hero", "Ready for Action requires hero form.");
      select(
        s,
        "Ready for Action",
        s.player.inPlay
          .filter((p) => definition(p)?.type_code === "ally" && !p.tough)
          .map((p) => ({ id: p.id, label: definition(p).name, code: p.code })),
        E("status", { status: "tough" }),
        ports,
      );
      break;
    case "hawkeye:earths-mightiest": {
      need(
        s.player.form === "hero",
        "Earth's Mightiest Heroes requires hero form.",
      );
      const choices = avengers(s, ports),
        ready = choices.filter(
          (x) =>
            !x.exhausted &&
            choices.some(
              (y) =>
                y.id !== x.id &&
                y.exhausted &&
                (y.id !== "hero" ||
                  ports.canReadyIdentity(s, s.activePlayerId)),
            ),
        );
      select(
        s,
        "Earth's Mightiest Heroes",
        ready.map((p) => ({
          id: p.id,
          label: p.id === "hero" ? "Your hero" : definition(p.code).name,
          code: p.code,
        })),
        H("earths-cost"),
        ports,
      );
      break;
    }
    case "hawkeye:earths-cost": {
      const source = avengers(s, ports).find((p) => p.id === e.target);
      need(
        source && !source.exhausted,
        "The Avenger exhaustion cost is unavailable.",
      );
      const targets = avengers(s, ports).filter(
        (p) =>
          p.id !== source!.id &&
          p.exhausted &&
          (p.id !== "hero" || ports.canReadyIdentity(s, s.activePlayerId)),
      );
      need(targets.length, "There is no other exhausted Avenger.");
      // Target is selected before committing the exhaustion cost.
      select(
        s,
        "Earth's Mightiest Heroes · ready",
        targets.map((p) => ({
          id: p.id,
          label: p.id === "hero" ? "Your hero" : definition(p.code).name,
          code: p.code,
        })),
        H("earths-ready", { sourceId: source!.id }),
        ports,
      );
      break;
    }
    case "hawkeye:earths-ready": {
      const choices = avengers(s, ports),
        source = choices.find((p) => p.id === e.sourceId),
        target = choices.find((p) => p.id === e.target);
      need(
        source &&
          !source.exhausted &&
          target?.exhausted &&
          target.id !== source.id &&
          (target.id !== "hero" || ports.canReadyIdentity(s, s.activePlayerId)),
        "Earth's Mightiest Heroes no longer has a legal cost and target.",
      );
      if (source!.id === "hero") s.player.exhausted = true;
      else own(s, source!.id)!.exhausted = true;
      ports.queue(s, E("ready", { target: target!.id }));
      break;
    }
    case "hawkeye:mockingbird": {
      need(
        own(s, e.id, "04004") &&
          s.attack?.isVillain &&
          s.attack.attacker === e.attacker &&
          s.attack.originalPlayerId === e.playerId &&
          s.activePlayerId === e.playerId &&
          Number(s.flags.attacksPerformed || 0) === e.initiation,
        "Mockingbird's original attack is no longer resolving.",
      );
      ports.returnAlly(s, e.id);
      ports.preventAllAttackDamage(s);
      break;
    }
    case "hawkeye:obligation": {
      const p = e.piece as Piece;
      need(
        p?.code === "04026" && s.heroId === "hawkeye",
        "Criminal Past must resolve for Clint Barton.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Criminal Past",
          "You may flip to alter-ego before choosing the obligation's cost.",
          [
            option("flip", "Flip to Clint Barton", [
              E("flip", { counts: false }),
              H("obligation-choice", { piece: p }),
            ]),
            option("stay", "Stay in hero form", [
              H("obligation-choice", { piece: p }),
            ]),
          ],
        );
      else ports.queue(s, H("obligation-choice", { piece: p }));
      break;
    }
    case "hawkeye:obligation-choice": {
      const p = e.piece as Piece,
        choices: Option[] = [];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.push(
          option(
            "remove",
            "Exhaust Clint Barton · remove Criminal Past from the game",
            [H("obligation-remove", { piece: p })],
          ),
        );
      // RRG choice: a missing Bow resolves as much as possible. Removing this
      // obligation is still a game-state change; the ready exhaustion alternative
      // remains payable only while Clint Barton is ready in alter-ego form.
      choices.push(
        option(
          "bow",
          "Discard Hawkeye's Bow from play · discard Criminal Past",
          [H("obligation-bow", { piece: p })],
        ),
      );
      ports.choose(
        s,
        "Criminal Past",
        "Choose the obligation's resolution.",
        choices,
      );
      break;
    }
    case "hawkeye:obligation-remove": {
      need(
        s.heroId === "hawkeye" &&
          s.player.form === "alter" &&
          !s.player.exhausted,
        "Clint Barton cannot pay this exhaustion cost.",
      );
      s.player.exhausted = true;
      const p = e.piece as Piece;
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.encounter.discard = s.encounter.discard.filter((x) => x.id !== p.id);
      s.removed.push(reset(p));
      break;
    }
    case "hawkeye:obligation-bow": {
      const p = bow(s);
      if (p) ports.discardPiece(s, p.id);
      break;
    }
    case "hawkeye:marked": {
      const scheme = s.sideSchemes.find(
        (p) => p.id === e.id && p.code === "04028",
      );
      need(
        scheme && s.heroId === "hawkeye",
        "Marked for Death must search Clint Barton's cards.",
      );
      if (!e.searched) ports.revealHidden(s);
      const zones = [
        s.player.hand,
        s.player.deck,
        s.player.discard,
        s.player.inPlay,
      ];
      const found = zones
        .flat()
        .filter((p) => definition(p)?.name === "Mockingbird");
      if (!e.target && found.length > 1) {
        ports.choose(
          s,
          "Marked for Death",
          "Choose the physical Mockingbird to tuck faceup beneath this scheme.",
          found.map((p) =>
            option(
              p.id,
              definition(p).name,
              [H("marked", { id: scheme!.id, target: p.id, searched: true })],
              p.code,
            ),
          ),
        );
        break;
      }
      const zone = zones.find((pile) =>
        pile.some(
          (p) =>
            definition(p)?.name === "Mockingbird" &&
            (!e.target || p.id === e.target),
        ),
      );
      const p = zone?.find(
        (x) =>
          definition(x)?.name === "Mockingbird" &&
          (!e.target || x.id === e.target),
      );
      need(!e.target || p, "The searched Mockingbird is no longer available.");
      if (p) {
        if (zone === s.player.inPlay) {
          // A tucked card leaves play; native discard cleanup removes attachments
          // before moving the same reset physical piece beneath the scheme.
          ports.discardPiece(s, p.id);
          const owner =
            s.players.find((seat) => seat.id === p.ownerId) ||
            s.players.find((seat) => seat.id === s.activePlayerId)!;
          const discard = seatView(s, owner).player.discard,
            index = discard.findIndex((x) => x.id === p.id);
          need(
            index >= 0,
            "Mockingbird could not be tucked after leaving play.",
          );
          (scheme!.storedCards ||= []).push(discard.splice(index, 1)[0]);
        } else {
          const tucked = zone!.splice(zone!.indexOf(p), 1)[0];
          tucked.ownerId ||= s.activePlayerId;
          (scheme!.storedCards ||= []).push(reset(tucked));
        }
      }
      ports.shufflePlayerDeck(s);
      ports.recyclePlayer(s);
      break;
    }
    case "hawkeye:attach-rifle": {
      const rifle = s.attachments.find(
        (p) => p.id === e.id && p.code === "04029",
      );
      need(rifle, "Crossfire's Rifle is no longer entering play.");
      rifle!.attachedTo =
        s.minions.find((p) => p.code === "04027")?.id || s.villain.id;
      break;
    }
    case "hawkeye:discard-rifle": {
      need(
        s.player.form === "hero" &&
          !s.player.exhausted &&
          s.attachments.some((p) => p.id === e.id && p.code === "04029"),
        "The Rifle removal exhaustion cost is unavailable.",
      );
      s.player.exhausted = true;
      ports.discardPiece(s, e.id);
      break;
    }
    case "hawkeye:crossfire-boost":
      // The native dispatcher persists Attack.piercing. A boost's printed keyword
      // never changes the minion instance or a scheming activation.
      if (s.attack) ports.queue(s, E("attackKeyword", { keyword: "piercing" }));
      break;
    default:
      throw Error(`Unimplemented Hawkeye effect: ${e.type}`);
  }
  return true;
}
function printedResources(p: Piece): number {
  const c = definition(p);
  return (
    (c.resource_energy || 0) +
    (c.resource_mental || 0) +
    (c.resource_physical || 0) +
    (c.resource_wild || 0)
  );
}
