import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const L = (type: string, args: Record<string, unknown> = {}) =>
  E(`starlord:${type}`, args);
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
  ["stld", "stl", "star_lord", "star-lord"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const printedTrait = (p: Piece, trait: string) =>
  (definition(p)?.traits || "").split(/\.\s*/).includes(trait);
const textActiveCopies = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p)).length;

export const STAR_LORD_SCRIPT_CODES = [
  "17001a",
  "17001b",
  "17002",
  "17003",
  "17004",
  "17005",
  "17006",
  "17007",
  "17008",
  "17009",
  "17010",
  "17024",
  "17025",
  "17026",
  "17027",
] as const;
export const STAR_LORD_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const STAR_LORD_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface StarLordPorts extends AntManPorts {
  shufflePlayerDeck(s: GameState): void;
  /** Deal the actual encounter card as a cost without revealing it. Return
   * undefined when no encounter card can be dealt, so the ability cannot pay. */
  dealEncounter(s: GameState): Piece | undefined;
  cardCost(s: GameState, p: Piece): number;
  preventDamage(s: GameState, packet: Effect | undefined, amount: number): void;
  /** An explicit defeat, not damage: Tough and damage immunity do not replace it. */
  defeatMinion(s: GameState, id: string): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
}

export function starLordFacedownEncounters(s: GameState): number {
  return s.encounter.dealt.filter(
    (p) => (p.dealtTo || s.activePlayerId) === s.activePlayerId,
  ).length;
}
export function starLordHeroTraits(s: GameState): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    textActiveCopies(s, "17008") > 0
    ? ["Aerial"]
    : [];
}
export function starLordAllyTraits(s: GameState, p: Piece): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    definition(p)?.type_code === "ally" &&
    s.player.inPlay.some((controlled) => controlled.id === p.id)
    ? ["Guardian"]
    : [];
}
export function starLordGuardianThwartBonus(
  s: GameState,
  guardian: boolean,
): number {
  return guardian ? textActiveCopies(s, "17009") : 0;
}
export function starLordStats(s: GameState) {
  return {
    attack: 0,
    thwart: starLordGuardianThwartBonus(
      s,
      active(s) && s.player.form === "hero",
    ),
  };
}
export function starLordAllyThwartBonus(s: GameState, p: Piece): number {
  return starLordGuardianThwartBonus(
    s,
    definition(p)?.type_code === "ally" &&
      s.player.inPlay.some((controlled) => controlled.id === p.id) &&
      (printedTrait(p, "Guardian") || starLordAllyTraits(s, p).length > 0),
  );
}
/** The host rechecks this after each draw while drawing up to hand size. */
export function starLordHandSizeBonus(s: GameState): number {
  return s.player.form === "hero"
    ? textActiveCopies(s, "17010") * Math.min(3, starLordFacedownEncounters(s))
    : 0;
}

export function starLordSetup(s: GameState): Effect[] {
  return active(s) ? [L("setup")] : [];
}
export function starLordRoundEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.starlordSmoothRound;
    delete flags.starlordCostRound;
    delete flags.starlordDiscountCardId;
    delete flags.starlordFirstTreacheryRound;
  }
}
export function starLordHandPlayFinished(s: GameState, id?: string): void {
  if (!id || s.flags.starlordDiscountCardId === id)
    delete s.flags.starlordDiscountCardId;
}
export function starLordCardCostReduction(s: GameState, p: Piece): number {
  return s.flags.starlordDiscountCardId === p.id ? 3 : 0;
}
export function starLordCanReduceHandCost(
  s: GameState,
  p: Piece,
  cost: number,
): boolean {
  return (
    active(s) &&
    s.player.form === "hero" &&
    s.flags.starlordCostRound !== s.round &&
    cost > 0 &&
    s.player.hand.some((inHand) => inHand.id === p.id) &&
    (s.encounter.deck.length > 0 || s.encounter.discard.length > 0)
  );
}
/** Offer before ordinary affordability checks: this interrupt can make a card
 * affordable. The continuation is the original native hand-play operation. */
export function starLordHandPlayOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: StarLordPorts,
): Option[] {
  return starLordCanReduceHandCost(s, p, ports.cardCost(s, p))
    ? [
        option(
          "starlord-discount",
          '"What could go wrong?" · deal yourself 1 encounter card, reduce cost by 3',
          [L("discount", { id: p.id, after })],
          "17001a",
        ),
      ]
    : [];
}

export function starLordPlayRestriction(s: GameState, p: Piece): string | null {
  if (!["17003", "17004", "17005"].includes(p.code)) return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  if (
    p.code === "17005" &&
    !s.player.inPlay.some((upgrade) => upgrade.code === "17007")
  )
    return "Sliding Shot requires a controlled Element Gun.";
  if (
    p.code === "17003" &&
    !s.encounter.deck.length &&
    !s.encounter.discard.length
  )
    return "Daring Escape must deal an actual facedown encounter card as its cost.";
  return null;
}
/** This additional ability cost precedes a thwart/attack status replacement. */
export function starLordBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  return p.code === "17003" ? [L("escape-cost", { after })] : after;
}
export function starLordEvent(_s: GameState, p: Piece): Effect[] | null {
  return (
    (
      {
        "17003": [E("ready", { target: "hero" }), E("draw", { amount: 1 })],
        "17004": [L("gutsy")],
        "17005": [L("sliding")],
      } as Record<string, Effect[]>
    )[p.code] || null
  );
}
export function starLordAllyEnter(
  s: GameState,
  p: Piece,
  fromHand: boolean,
): Effect[] | null {
  if (p.code !== "17002") return null;
  if (!fromHand || !s.minions.some((minion) => !printedTrait(minion, "Elite")))
    return [];
  return [
    E("optional", {
      title: "Nova Prime",
      text: "Defeat a non-Elite minion?",
      effects: [L("nova", { id: p.id })],
    }),
  ];
}
export function starLordAbilityOptions(
  s: GameState,
  id: string,
  ports: StarLordPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      s.flags.starlordSmoothRound !== s.round &&
      s.player.hand.length > 0 &&
      s.player.deck.length > 0
      ? [
          option(
            "smooth-talker",
            "Smooth Talker · swap a hand card with the top card of your deck",
            [L("smooth")],
            "17001b",
          ),
        ]
      : [];
  const p = own(s, id, "17007");
  return p &&
    s.player.form === "hero" &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    ports.canPay(s, 1) &&
    ports.enemyTargets(s, true).length > 0
    ? [
        option(
          "element-gun",
          "Element Gun · exhaust and spend 1 resource, attack for 3 with piercing",
          [L("gun-pay", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
export function starLordAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: StarLordPorts,
): Effect[] | null {
  const options = starLordAbilityOptions(s, id, ports);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}
export function starLordDamageOptions(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
  after: Effect[],
  ports: StarLordPorts,
): Option[] {
  if (
    amount <= 0 ||
    s.player.form !== "hero" ||
    s.player.tough ||
    (packet?.target &&
      !["hero", `hero:${s.activePlayerId}`].includes(packet.target))
  )
    return [];
  const options: Option[] = [];
  for (const p of s.player.inPlay) {
    if (ports.isTextBlank(s, p)) continue;
    if (
      p.code === "17008" &&
      active(s) &&
      !p.exhausted &&
      starLordFacedownEncounters(s) > 0
    )
      options.push(
        option(
          p.id,
          `Jet Boots · exhaust, prevent ${starLordFacedownEncounters(s)} damage`,
          [L("boots", { id: p.id, packet, amount, after })],
          p.code,
        ),
      );
    if (
      p.code === "17006" &&
      ["attack", "overkill"].includes(packet?.kind || "") &&
      s.attack?.isVillain
    )
      options.push(
        option(
          p.id,
          "Bad Boy · discard, prevent all damage, change to alter-ego and draw 2",
          [L("bad-boy", { id: p.id, packet, amount, after })],
          p.code,
        ),
      );
  }
  return options;
}

/** Call at the actual reveal moment, before When Revealed text puts new
 * minions in play. Every treachery counts, including one revealed before Knife
 * entered play. Return additional Surge keywords for this saved reveal. */
export function starLordTreacherySurge(s: GameState, p: Piece): number {
  if (s.phase !== "villain" || definition(p)?.type_code !== "treachery")
    return 0;
  if (s.flags.starlordFirstTreacheryRound === s.round) return 0;
  s.flags.starlordFirstTreacheryRound = s.round;
  return s.minions.filter(
    (m) =>
      m.code === "17026" &&
      (m.engagedWith || s.activePlayerId) === s.activePlayerId &&
      !isTextBlank(s, m),
  ).length;
}
export function starLordEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "17024": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [L("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "17025":
    case "17026":
      return [];
    case "17027":
      return [
        E("randomDiscard"),
        E("damage", { target: "hero", amount: 1, source: "17027" }),
        E("threat", { target: "main", amount: 1 }),
      ];
    default:
      return null;
  }
}
export function starLordBoost(_s: GameState, _p: Piece): Effect[] | null {
  return null;
}

function selectTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: StarLordPorts,
) {
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else if (targets.length > 1)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
}
function elementGuns(s: GameState) {
  return s.player.inPlay.filter((p) => p.code === "17007");
}

export function resolveStarLordEffect(
  s: GameState,
  e: Effect,
  ports: StarLordPorts,
): boolean {
  if (!e.type.startsWith("starlord:")) return false;
  switch (e.type) {
    case "starlord:setup": {
      need(active(s), "Peter Quill's setup belongs to Star-Lord.");
      const copies = [...s.player.deck, ...s.player.discard].filter(
        (p) => p.code === "17007",
      );
      if (copies.length)
        selectTarget(
          s,
          "Peter Quill setup",
          copies.map((p) => ({
            id: p.id,
            label: definition(p).name,
            code: p.code,
          })),
          L("setup-gun"),
          ports,
        );
      else ports.shufflePlayerDeck(s);
      break;
    }
    case "starlord:setup-gun": {
      need(active(s), "Peter Quill's setup belongs to Star-Lord.");
      const zone = [s.player.deck, s.player.discard].find((zone) =>
        zone.some((p) => p.id === e.target && p.code === "17007"),
      );
      need(zone, "Choose an actual Element Gun in your deck or discard pile.");
      const p = zone!.splice(
        zone!.findIndex((p) => p.id === e.target),
        1,
      )[0];
      s.player.hand.push(p);
      ports.revealHidden(s);
      ports.shufflePlayerDeck(s);
      break;
    }
    case "starlord:smooth":
      need(
        starLordAbilityOptions(s, "identity", ports).length,
        "Smooth Talker is unavailable.",
      );
      ports.choose(
        s,
        "Smooth Talker",
        "Choose the actual hand card to swap before looking at the deck's top card.",
        s.player.hand.map((p) =>
          option(
            p.id,
            definition(p).name,
            [L("smooth-swap", { id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    case "starlord:smooth-swap": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.starlordSmoothRound !== s.round &&
          i >= 0 &&
          s.player.deck.length > 0,
        "Smooth Talker needs an actual hand card and a top deck card.",
      );
      const hand = s.player.hand[i];
      s.player.hand[i] = s.player.deck[0];
      s.player.deck[0] = hand;
      s.flags.starlordSmoothRound = s.round;
      ports.revealHidden(s);
      break;
    }
    case "starlord:discount": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(
        p && starLordCanReduceHandCost(s, p, ports.cardCost(s, p)),
        '"What could go wrong?" is unavailable for this hand card.',
      );
      need(
        ports.dealEncounter(s),
        "An actual encounter card must be dealt as the cost.",
      );
      s.flags.starlordCostRound = s.round;
      s.flags.starlordDiscountCardId = p!.id;
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "starlord:escape-cost":
      need(s.player.form === "hero", "Daring Escape requires hero form.");
      need(
        ports.dealEncounter(s),
        "Daring Escape must deal an actual encounter card.",
      );
      ports.queue(s, ...(e.after || []));
      break;
    case "starlord:gutsy":
      selectTarget(
        s,
        "Gutsy Move",
        ports.schemeTargets(s, true),
        E("thwart", {
          amount: 2 + 2 * starLordFacedownEncounters(s),
          action: true,
        }),
        ports,
      );
      break;
    case "starlord:sliding":
      need(
        elementGuns(s).length,
        "Sliding Shot requires a controlled Element Gun.",
      );
      selectTarget(
        s,
        "Sliding Shot",
        ports.enemyTargets(s, true),
        E("attackAction", { amount: 5 + 2 * starLordFacedownEncounters(s) }),
        ports,
      );
      break;
    case "starlord:nova":
      selectTarget(
        s,
        "Nova Prime",
        s.minions
          .filter((p) => !ports.hasTrait(s, p.id, "Elite"))
          .map((p) => ({
            id: p.id,
            label:
              ports.enemyTargets(s, false).find((t) => t.id === p.id)?.label ||
              definition(p)?.name ||
              "Enemy",
            code: p.code,
          })),
        L("nova-defeat"),
        ports,
      );
      break;
    case "starlord:nova-defeat": {
      const p = s.minions.find((p) => p.id === e.target);
      need(
        p && !ports.hasTrait(s, p.id, "Elite"),
        "Nova Prime requires a non-Elite minion.",
      );
      ports.defeatMinion(s, p!.id);
      break;
    }
    case "starlord:gun-pay": {
      const p = own(s, e.id, "17007");
      need(
        p && starLordAbilityOptions(s, p.id, ports).length,
        "Element Gun is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("payRequest", {
          title: "Element Gun",
          cost: 1,
          sourceId: p!.id,
          cancelable: false,
          after: [L("gun-attack", { id: p!.id })],
        }),
      );
      break;
    }
    case "starlord:gun-attack":
      selectTarget(
        s,
        "Element Gun",
        ports.enemyTargets(s, true),
        E("attackAction", { amount: 3, source: "hero", piercing: true }),
        ports,
      );
      break;
    case "starlord:boots": {
      const p = own(s, e.id, "17008");
      need(
        p &&
          starLordDamageOptions(s, e.packet, e.amount, [], ports).some(
            (o) => o.id === p.id,
          ),
        "Jet Boots cannot prevent this packet.",
      );
      p!.exhausted = true;
      ports.preventDamage(s, e.packet, starLordFacedownEncounters(s));
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "starlord:bad-boy": {
      const p = own(s, e.id, "17006");
      need(
        p &&
          starLordDamageOptions(s, e.packet, e.amount, [], ports).some(
            (o) => o.id === p.id,
          ),
        "Bad Boy can prevent only identity damage from a villain's attack.",
      );
      ports.discardPiece(s, p!.id);
      ports.preventDamage(s, e.packet, e.amount);
      if (ports.canChangeForm(s)) ports.flip(s, false, "alter");
      ports.queue(s, E("draw", { amount: 2 }), ...(e.after || []));
      break;
    }
    case "starlord:obligation":
      need(
        active(s) && e.piece?.code === "17024",
        "Banishment belongs to Peter Quill.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Banishment",
          "You may flip to alter-ego before choosing.",
          [
            option("flip", "Change to Peter Quill", [
              L("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              L("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, L("obligation-choice", { piece: e.piece }));
      break;
    case "starlord:obligation-flip":
      need(
        s.player.form === "hero" && ports.canChangeForm(s),
        "Peter Quill cannot change form.",
      );
      ports.flip(s, false, "alter");
      ports.queue(s, L("obligation-choice", { piece: e.piece }));
      break;
    case "starlord:obligation-choice": {
      const options: Option[] = [];
      if (s.player.form === "alter" && !s.player.exhausted)
        options.push(
          option("remove", "Exhaust Peter Quill · remove Banishment", [
            L("obligation-remove", { piece: e.piece }),
          ]),
        );
      options.push(
        option(
          "discard",
          "Discard an Element Gun; if you cannot, place 3 threat on the main scheme",
          [L("obligation-discard")],
        ),
      );
      ports.choose(s, "Banishment", "Choose a resolution.", options);
      break;
    }
    case "starlord:obligation-remove": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "17024",
        "Peter Quill must be ready to remove Banishment.",
      );
      s.player.exhausted = true;
      const i = s.resolving.findIndex((p) => p.id === e.piece.id);
      const p = i >= 0 ? s.resolving.splice(i, 1)[0] : e.piece;
      s.encounter.discard = s.encounter.discard.filter(
        (discarded) => discarded.id !== p.id,
      );
      if (!s.removed.some((removed) => removed.id === p.id)) s.removed.push(p);
      break;
    }
    case "starlord:obligation-discard": {
      const guns = elementGuns(s);
      if (!guns.length)
        ports.queue(s, E("threat", { target: "main", amount: 3 }));
      else
        selectTarget(
          s,
          "Banishment",
          guns.map((p) => ({
            id: p.id,
            label: definition(p).name,
            code: p.code,
          })),
          L("obligation-gun"),
          ports,
        );
      break;
    }
    case "starlord:obligation-gun": {
      const p = own(s, e.target, "17007");
      need(p, "Banishment discards an actual controlled Element Gun.");
      ports.discardPiece(s, p!.id);
      break;
    }
    default:
      throw Error(`Unknown Star-Lord effect: ${e.type}`);
  }
  return true;
}
