import { defenseEventSources, isTextBlank } from "./card-text.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, playerOrder, seatView } from "./team.js";
import { consumeStatus } from "./keywords.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const G = (type: string, args: Record<string, unknown> = {}) =>
  E(`gamora:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["gam", "gamora"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const turnKey = (s: GameState) => `${s.round}:${s.phase}:${s.turnPlayerId}`;
const trait = (c: Card | undefined, name: string) =>
  (c?.traits || "").split(/\.\s*/).includes(name);
const tactical = (p: Piece) => {
  const c = cards.get(p.code);
  return c?.type_code === "event" && (trait(c, "Attack") || trait(c, "Thwart"));
};

export const GAMORA_SCRIPT_CODES = [
  "18001a",
  "18001b",
  "18002",
  "18003",
  "18004",
  "18005",
  "18006",
  "18007",
  "18008",
  "18009",
  "18010",
  "18024",
  "18025",
  "18026",
  "18027",
  "18028",
] as const;
export const GAMORA_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const GAMORA_FAQ_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#gamora";

export interface GamoraPorts extends AntManPorts {
  select(
    s: GameState,
    title: string,
    text: string,
    pieces: Piece[],
    min: number,
    max: number,
    action: Effect,
  ): void;
  shufflePlayerDeck(s: GameState): void;
  cardCost(s: GameState, p: Piece): number;
  heroMaxHP(s: GameState): number;
  preventDamage(s: GameState, packet: Effect | undefined, amount: number): void;
  /** A resolved Defense-labeled interrupt makes this actual player the defender.
   * Call only after status replacement has been checked. */
  claimDefense(s: GameState, packet: Effect | undefined): void;
}

/** In a Bind blanks both identity faces, while preserving their printed traits. */
export function gamoraIdentityBlank(s: GameState): boolean {
  return (
    active(s) &&
    s.attachments.some(
      (p) =>
        p.code === "18027" &&
        !isTextBlank(s, p) &&
        ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || ""),
    )
  );
}
export function gamoraCanRemoveThreat(s: GameState, target: string): boolean {
  return (
    active(s) ||
    !s.sideSchemes.some(
      (p) => p.id === target && p.code === "18025" && !isTextBlank(s, p),
    )
  );
}
function schemes(
  s: GameState,
  thwart: boolean,
  ports: GamoraPorts,
): AntManTarget[] {
  return ports
    .schemeTargets(s, thwart)
    .filter(
      (p) =>
        gamoraCanRemoveThreat(s, p.id) &&
        (p.id !== "main" ||
          !s.sideSchemes.some(
            (scheme) => cards.get(scheme.code)?.scheme_crisis,
          )),
    );
}
/** These records concern events played, even when Stun/Confuse replaces them. */
export function gamoraCardPlayed(s: GameState, c: Card): void {
  if (c.type_code !== "event") return;
  if (trait(c, "Attack")) s.flags.gamoraAttackEventTurn = turnKey(s);
  if (trait(c, "Thwart")) s.flags.gamoraThwartEventTurn = turnKey(s);
}
export function gamoraTurnEnded(
  s: GameState,
  endedPlayerId = s.turnPlayerId,
): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    const key = `${s.round}:${s.phase}:${endedPlayerId}`;
    if (flags.gamoraAttackEventTurn === key) delete flags.gamoraAttackEventTurn;
    if (flags.gamoraThwartEventTurn === key) delete flags.gamoraThwartEventTurn;
  }
}
export function gamoraPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.gamoraFinessePhase;
    delete flags.gamoraPrecisionPhase;
    delete flags.gamoraAttackEventTurn;
    delete flags.gamoraThwartEventTurn;
  }
}
/** RRG 1.8 Labels supersedes the archived one-status ruling: every matching
 * status is removed and the whole multi-label ability is replaced. */
export function gamoraReplaceMultiLabel(
  s: GameState,
  labels: ("attack" | "thwart")[],
): boolean {
  const stun = labels.includes("attack") && s.player.stunned;
  const confuse = labels.includes("thwart") && s.player.confused;
  if (stun) consumeStatus(s.player, "stunned");
  if (confuse) consumeStatus(s.player, "confused");
  return !!(stun || confuse);
}
/** Both actual copies may pay, including reaction events. Neither the basic
 * power nor a triggered ability on a non-event can spend this resource. */
export function gamoraKeenInstinctsEligible(
  s: GameState,
  targetCode?: string,
): boolean {
  const c = targetCode && cards.get(targetCode);
  return (
    !!c && c.type_code === "event" && (trait(c, "Attack") || trait(c, "Thwart"))
  );
}

export function gamoraAbilityOptions(
  s: GameState,
  id: string,
  ports: GamoraPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      !gamoraIdentityBlank(s) &&
      s.flags.gamoraTacticianRound !== s.round &&
      s.player.deck.length > 0
      ? [
          option(
            "skilled-tactician",
            "Skilled Tactician · look at the top card; draw it if it is an Attack or Thwart event",
            [G("tactician")],
            "18001b",
          ),
        ]
      : [];
  const room = own(s, id, "18008");
  return room &&
    active(s) &&
    s.player.form === "alter" &&
    !room.exhausted &&
    !ports.isTextBlank(s, room) &&
    (s.player.discard.some(tactical) || s.player.hp < ports.heroMaxHP(s))
    ? [
        option(
          "conditioning-room",
          "Conditioning Room · return the bottommost Attack/Thwart event and heal 1",
          [G("conditioning-room", { id })],
          room.code,
        ),
      ]
    : [];
}
export function gamoraAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: GamoraPorts,
): Effect[] | null {
  const options = gamoraAbilityOptions(s, id, ports);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function gamoraPlayRestriction(
  s: GameState,
  p: Piece,
  ports: GamoraPorts,
): string | null {
  if (!["18003", "18004", "18005", "18006", "18007"].includes(p.code))
    return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (p.code === "18004")
    return "Crosscounter requires an imminent damage interrupt window.";
  if (
    ["18003", "18006"].includes(p.code) &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "This attack has no legal enemy target.";
  if (
    ["18005", "18007"].includes(p.code) &&
    !s.player.confused &&
    !schemes(s, true, ports).length
  )
    return "This thwart has no legal scheme target.";
  return null;
}
export function gamoraEvent(_s: GameState, p: Piece): Effect[] | null {
  const type = (
    {
      "18003": "acrobatic-move",
      "18005": "set-the-pace",
      "18006": "decisive-blow",
      "18007": "forward-momentum",
    } as Record<string, string>
  )[p.code];
  return type ? [G(type)] : null;
}

function responseOptions(
  s: GameState,
  p: Piece,
  used: string[],
  after: Effect[],
  ports: GamoraPorts,
): Option[] {
  const c = cards.get(p.code);
  if (c?.type_code !== "event") return [];
  const next = (id: string) => [
    G("event-responses", { event: p, used: [...used, id], after }),
  ];
  const options: Option[] = [];
  if (active(s) && s.player.form === "hero" && !gamoraIdentityBlank(s)) {
    if (
      trait(c, "Attack") &&
      s.flags.gamoraFinessePhase !== phaseKey(s) &&
      !used.includes("finesse") &&
      schemes(s, false, ports).length
    )
      options.push(
        option(
          "finesse",
          "Finesse · remove 1 threat from a scheme",
          [G("finesse", { after: next("finesse") })],
          "18001a",
        ),
      );
    if (
      trait(c, "Thwart") &&
      s.flags.gamoraPrecisionPhase !== phaseKey(s) &&
      !used.includes("precision") &&
      ports.enemyTargets(s, false).length
    )
      options.push(
        option(
          "precision",
          "Precision · deal 1 damage to an enemy",
          [G("precision", { after: next("precision") })],
          "18001a",
        ),
      );
  }
  if (trait(c, "Attack") && ports.enemyTargets(s, false).length)
    for (const sword of s.player.inPlay.filter(
      (p) =>
        p.code === "18010" && !used.includes(p.id) && !ports.isTextBlank(s, p),
    ))
      options.push(
        option(
          sword.id,
          "Gamora's Sword · deal 1 damage to an enemy",
          [G("sword", { id: sword.id, after: next(sword.id) })],
          sword.code,
        ),
      );
  return options;
}
/** Invoke after complete resolution/discard, even if the played card has since
 * returned to hand. Each response resolves before remaining options refresh. */
export function gamoraAfterEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: GamoraPorts,
): Effect[] {
  return responseOptions(s, p, [], after, ports).length
    ? [
        G("event-responses", {
          event: { ...p },
          used: [],
          after,
          actorId: s.activePlayerId,
        }),
      ]
    : after;
}
export function gamoraAllyEnter(
  s: GameState,
  p: Piece,
  ports: GamoraPorts,
): Effect[] | null {
  return p.code === "18002" && !ports.isTextBlank(s, p)
    ? [
        E("optional", {
          title: "Nebula",
          text: "Search your deck for an Attack or Thwart event?",
          effects: [G("nebula", { id: p.id })],
        }),
      ]
    : null;
}
export function gamoraDamageOptions(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
  after: Effect[],
  ports: GamoraPorts,
): Option[] {
  const target = packet?.target || "hero";
  if (
    amount <= 0 ||
    s.player.form !== "hero" ||
    s.player.tough ||
    !["hero", `hero:${s.activePlayerId}`].includes(target)
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "18004" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Crosscounter · prevent 3, deal 1 damage, remove 1 threat",
        [G("crosscounter-pay", { id: p.id, packet, amount, after })],
        p.code,
      ),
    );
}
export function gamoraVillainPhaseBegin(
  s: GameState,
  ports: GamoraPorts,
): Effect[] {
  const seat = playerOrder(s).find((seat) => active(seatView(s, seat)));
  return seat
    ? s.sideSchemes
        .filter((p) => p.code === "18025" && !ports.isTextBlank(s, p))
        .map(() => E("dealEncounter", { playerId: seat.id }))
    : [];
}
/** Invoke before any Nebula minion enters play, including put-into-play. */
export function gamoraMinionWillEnter(
  s: GameState,
  p: Piece,
  ports: GamoraPorts,
): void {
  if (p.code !== "18026" || ports.isTextBlank(s, p)) return;
  for (const ally of allInPlay(s).filter(
    (a) =>
      cards.get(a.code)?.type_code === "ally" &&
      cards.get(a.code)?.name === "Nebula",
  ))
    ports.discardPiece(s, ally.id);
}
export function gamoraAttachmentActions(
  s: GameState,
  p: Piece,
  ports: GamoraPorts,
): Option[] {
  const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
  if (
    p.code !== "18027" ||
    !owner ||
    s.player.form !== "hero" ||
    !["hero", `hero:${owner.id}`].includes(p.attachedTo || "") ||
    ports.isTextBlank(s, p)
  )
    return [];
  return s.player.hand
    .filter(
      (event) =>
        cards.get(event.code)?.type_code === "event" &&
        trait(cards.get(event.code), "Attack"),
    )
    .map((event) =>
      option(
        event.id,
        `Discard ${cards.get(event.code)!.name} and deal 1 damage to Gamora · discard In a Bind`,
        [G("remove-bind", { id: p.id, eventId: event.id })],
        event.code,
      ),
    );
}
export function gamoraEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "18024": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [G("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "18025":
    case "18026":
      return [];
    case "18027":
      return [G("bind", { id: p.id })];
    case "18028":
      return [G("waylay")];
    default:
      return null;
  }
}
export function gamoraBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["18024", "18025", "18026", "18027", "18028"].includes(p.code)
    ? []
    : null;
}
function target(
  s: GameState,
  title: string,
  choices: AntManTarget[],
  effect: Effect,
  after: Effect[],
  ports: GamoraPorts,
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

export function resolveGamoraEffect(
  s: GameState,
  e: Effect,
  ports: GamoraPorts,
): boolean {
  if (!e.type.startsWith("gamora:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "gamora:tactician": {
      need(
        gamoraAbilityOptions(s, "hero", ports).length,
        "Skilled Tactician is unavailable.",
      );
      s.flags.gamoraTacticianRound = s.round;
      const top = s.player.deck[0];
      ports.log(s, `Skilled Tactician looks at ${cards.get(top.code)!.name}.`);
      if (tactical(top)) ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "gamora:conditioning-room": {
      need(
        gamoraAbilityOptions(s, e.id, ports).length,
        "Conditioning Room is unavailable.",
      );
      own(s, e.id, "18008")!.exhausted = true;
      const index = s.player.discard.findIndex(tactical);
      if (index >= 0) s.player.hand.push(...s.player.discard.splice(index, 1));
      ports.queue(s, E("heal", { target: "hero", amount: 1 }));
      break;
    }
    case "gamora:nebula": {
      const found = s.player.deck.filter(tactical);
      if (!found.length) {
        ports.shufflePlayerDeck(s);
        break;
      }
      ports.choose(
        s,
        "Nebula",
        "Choose an Attack or Thwart event from your deck, then shuffle.",
        [
          ...found.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [G("nebula-find", { id: p.id })],
              p.code,
            ),
          ),
          option("none", "Find no card · shuffle the deck", [G("nebula-find")]),
        ],
      );
      break;
    }
    case "gamora:nebula-find": {
      if (e.id) {
        const index = s.player.deck.findIndex(
          (p) => p.id === e.id && tactical(p),
        );
        need(index >= 0, "Nebula's searched event is no longer in the deck.");
        s.player.hand.push(...s.player.deck.splice(index, 1));
      }
      ports.shufflePlayerDeck(s);
      break;
    }
    case "gamora:acrobatic-move":
    case "gamora:decisive-blow":
      if (!s.player.stunned || !gamoraReplaceMultiLabel(s, ["attack"]))
        target(
          s,
          e.type === "gamora:acrobatic-move"
            ? "Acrobatic Move"
            : "Decisive Blow",
          ports.enemyTargets(s, true),
          E("damage", {
            amount:
              e.type === "gamora:acrobatic-move"
                ? 2
                : s.flags.gamoraThwartEventTurn === turnKey(s)
                  ? 7
                  : 4,
            source: "hero",
            attack: true,
            attackInitiated: true,
          }),
          after,
          ports,
        );
      break;
    case "gamora:set-the-pace":
    case "gamora:forward-momentum":
      if (!s.player.confused || !gamoraReplaceMultiLabel(s, ["thwart"]))
        target(
          s,
          e.type === "gamora:set-the-pace"
            ? "Set the Pace"
            : "Forward Momentum",
          schemes(s, true, ports),
          E("thwart", {
            amount:
              e.type === "gamora:set-the-pace"
                ? 1
                : s.flags.gamoraAttackEventTurn === turnKey(s)
                  ? 5
                  : 3,
            source: "hero",
            action: true,
            thwartInitiated: true,
          }),
          after,
          ports,
        );
      break;
    case "gamora:event-responses": {
      const choices = responseOptions(s, e.event, e.used || [], after, ports);
      if (choices.length)
        ports.choose(
          s,
          "Gamora · after playing an event",
          "Resolve a response or continue. Finesse and Precision are each limited once per phase.",
          [...choices, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "gamora:finesse":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !gamoraIdentityBlank(s) &&
          s.flags.gamoraFinessePhase !== phaseKey(s),
        "Finesse is unavailable.",
      );
      s.flags.gamoraFinessePhase = phaseKey(s);
      target(
        s,
        "Finesse",
        schemes(s, false, ports),
        E("thwart", {
          amount: 1,
          source: "hero",
          action: false,
          additional: true,
        }),
        after,
        ports,
      );
      break;
    case "gamora:precision":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !gamoraIdentityBlank(s) &&
          s.flags.gamoraPrecisionPhase !== phaseKey(s),
        "Precision is unavailable.",
      );
      s.flags.gamoraPrecisionPhase = phaseKey(s);
      target(
        s,
        "Precision",
        ports.enemyTargets(s, false),
        E("damage", { amount: 1, source: "hero", attack: false }),
        after,
        ports,
      );
      break;
    case "gamora:sword": {
      const sword = own(s, e.id, "18010");
      need(
        sword && !ports.isTextBlank(s, sword),
        "Gamora's Sword is unavailable.",
      );
      target(
        s,
        "Gamora's Sword",
        ports.enemyTargets(s, false),
        E("damage", { amount: 1, source: sword!.id, attack: false }),
        after,
        ports,
      );
      break;
    }
    case "gamora:crosscounter-pay": {
      const p = defenseEventSources(s).find(
        (p) => p.id === e.id && p.code === "18004",
      );
      need(
        p &&
          gamoraDamageOptions(s, e.packet, e.amount, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Crosscounter is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Crosscounter",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [G("crosscounter", { packet: e.packet })],
              continuation: after,
            }),
          ],
        }),
      );
      break;
    }
    case "gamora:crosscounter":
      if (!gamoraReplaceMultiLabel(s, ["attack", "thwart"])) {
        ports.claimDefense(s, e.packet);
        ports.preventDamage(s, e.packet, 3);
        ports.queue(s, G("crosscounter-attack"), G("crosscounter-thwart"));
      }
      break;
    case "gamora:crosscounter-attack":
      target(
        s,
        "Crosscounter · attack",
        ports.enemyTargets(s, true),
        E("damage", {
          amount: 1,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
        [],
        ports,
      );
      break;
    case "gamora:crosscounter-thwart":
      target(
        s,
        "Crosscounter · thwart",
        schemes(s, true, ports),
        E("thwart", {
          amount: 1,
          source: "hero",
          action: true,
          thwartInitiated: true,
        }),
        [],
        ports,
      );
      break;
    case "gamora:bind": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "18027");
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      if (p && owner) p.attachedTo = `hero:${owner.id}`;
      else if (p) ports.discardPiece(s, p.id);
      break;
    }
    case "gamora:remove-bind": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "18027");
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      need(
        p &&
          owner &&
          gamoraAttachmentActions(s, p, ports).some((o) => o.id === e.eventId),
        "In a Bind cannot pay its cost.",
      );
      ports.discardHand(s, e.eventId);
      ports.queue(
        s,
        E("damage", {
          target: owner!.id === s.activePlayerId ? "hero" : `hero:${owner!.id}`,
          amount: 1,
          source: p!.id,
        }),
        G("remove-bind-paid", { id: p!.id }),
      );
      break;
    }
    case "gamora:remove-bind-paid":
      ports.discardPiece(s, e.id);
      break;
    case "gamora:waylay": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      if (!owner) break;
      const hero = seatView(s, owner).player;
      const surge = hero.stunned || hero.confused;
      ports.queue(
        s,
        E("status", { target: `hero:${owner.id}`, status: "stunned" }),
        E("status", { target: `hero:${owner.id}`, status: "confused" }),
        ...(surge ? [E("dealEncounter", { playerId: s.activePlayerId })] : []),
      );
      break;
    }
    case "gamora:obligation":
      need(
        active(s) && e.piece?.code === "18024",
        "Unfulfilled Destiny must resolve for Gamora.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Unfulfilled Destiny",
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
    case "gamora:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Gamora cannot change form.",
      );
      ports.queue(s, G("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "gamora:obligation-choice": {
      const choices: Option[] = [];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.push(
          option(
            "remove",
            "Exhaust Gamora · remove Unfulfilled Destiny from the game",
            [G("obligation-remove", { piece: e.piece })],
          ),
        );
      if (s.player.hand.some((p) => cards.get(p.code)?.type_code === "event"))
        choices.push(
          option(
            "events",
            "Choose and discard 2 events (as many as available)",
            [G("obligation-events")],
          ),
        );
      if (choices.length)
        ports.choose(
          s,
          "Unfulfilled Destiny",
          "Choose the obligation's resolution.",
          choices,
        );
      break;
    }
    case "gamora:obligation-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "18024",
        "Gamora cannot pay Unfulfilled Destiny's exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "gamora:obligation-events": {
      const events = s.player.hand.filter(
        (p) => cards.get(p.code)?.type_code === "event",
      );
      const count = Math.min(2, events.length);
      need(count, "Unfulfilled Destiny has no events to discard.");
      ports.select(
        s,
        "Unfulfilled Destiny",
        `Choose ${count} ${count === 1 ? "event" : "events"} to discard.`,
        events,
        count,
        count,
        G("obligation-discard"),
      );
      break;
    }
    case "gamora:obligation-discard": {
      const ids: string[] = e.ids || [];
      const count = Math.min(
        2,
        s.player.hand.filter((p) => cards.get(p.code)?.type_code === "event")
          .length,
      );
      need(
        count > 0 &&
          ids.length === count &&
          new Set(ids).size === count &&
          ids.every((id) =>
            s.player.hand.some(
              (p) => p.id === id && cards.get(p.code)?.type_code === "event",
            ),
          ),
        "Choose the required distinct events from Gamora's hand.",
      );
      for (const id of ids) ports.discardHand(s, id);
      break;
    }
    default:
      throw Error(`Unknown Gamora effect: ${e.type}`);
  }
  return true;
}
