import catalog from "../data/catalog-cards.json" with { type: "json" };
import { consumeStatus } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
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
const M = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`miles:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) =>
  ["spider_man_morales", "miles_morales", "miles"].includes(s.heroId);
// Native Ultron drones have a physical piece but no imported catalog face.
// Keep their printed stats here: importing cards.js would cycle through the
// static script registry before this module's closure is initialized.
const nativeDrone: Card = {
  code: "drone",
  name: "Ultron Drone",
  type_code: "minion",
  faction_code: "encounter",
  quantity: 1,
  position: 0,
  attack: 1,
  scheme: 1,
  health: 1,
  traits: "Drone.",
  text: "Facedown card from your deck. When defeated, return it to your discard pile.",
};
const definition = (p: Piece) =>
  cards.get(p.code) || (p.code === "drone" ? nativeDrone : undefined)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const signature = (p: Piece) =>
  definition(p)?.set_code === "spider_man_morales" &&
  definition(p)?.faction_code === "hero" &&
  !["hero", "alter_ego"].includes(definition(p).type_code);
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);

export const MILES_MORALES_SCRIPT_CODES = [
  "27030a",
  "27030b",
  "27031",
  "27032",
  "27033",
  "27034",
  "27035",
  "27036",
  "27037",
  "27038",
  "27039",
  "27056",
  "27057",
  "27058",
  "27059",
  "27060",
] as const;
export const MILES_MORALES_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const MILES_MORALES_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/sinister-motives/";
export const MILES_MORALES_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export type MilesSpecial = "venom-blast" | "spider-camouflage";
export interface MilesPaymentReceipt {
  /** Unique native PLAY instance used for Double Life's global maximum. */
  playToken?: string;
  /** Typed resources allocated to the printed cost, excluding overpayment.
   * Converted wilds have the actual allocated type. */
  paidForCard?: Resource[];
  /** Compatibility receipt when the host has no separate allocation list. */
  paid?: Resource[];
}
export interface MilesBasicReceipt {
  token: string;
  playerId: string;
  power: "attack" | "thwart" | "defense" | "recover";
  performed: boolean;
  wasHero: boolean;
}
export interface MilesFormReceipt {
  token: string;
  playerId: string;
  from: "hero" | "alter";
  to: "hero" | "alter";
}
export interface MilesEnemyAttackReceipt {
  performed: boolean;
  /** Defeat caused by THIS attack, including defending allies and identities.
   * Unrelated boost damage/Retaliate defeats do not satisfy this condition. */
  defeatedCharacter: boolean;
}
export interface MilesMoralesPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  /** False is non-thwart threat removal: ignore Patrol, still respect Crisis. */
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  canGiveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canChangeForm(s: GameState): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  cardCost(s: GameState, p: Piece): number;
  canDraw?(s: GameState, amount: number): boolean;
  canDiscardPiece?(s: GameState, p: Piece): boolean;
  discardPiece(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  /** Actual change and all ordinary/Miles form response windows finish before
   * after. Effect changes do not use the voluntary Hero/AE flip budget. */
  flip(
    s: GameState,
    counts: boolean,
    after: Effect[],
    target?: "hero" | "alter",
  ): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  /** Native actual attack/keywords/responses, then the separate printed clause.
   * Venom Blast is never inserted into the attack's damage program. */
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** Native attack against the actual target, including alter ego when allowed.
   * Append performed/defeatedCharacter to continuation only after that attack.
   * Stun/cancel reports performed:false. Return false if no attack can start. */
  enemyAttack(
    s: GameState,
    enemyId: string,
    playerId: string,
    allowAlter: boolean,
    continuation: Effect,
  ): boolean;
  /** One physical acceleration token ON the actual side scheme. It contributes
   * to main-scheme acceleration while that card remains in play, independently
   * of its printed icon and of text blanking; it leaves with the side scheme. */
  placeAccelerationToken(s: GameState, schemeId: string, amount: number): void;
  attachEncounter(s: GameState, p: Piece, targetId: string): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  removeEncounter(s: GameState, p: Piece): void;
  discardEncounter(s: GameState, p: Piece): void;
}

const paid = (receipt: MilesPaymentReceipt, type: Resource) =>
  (receipt.paidForCard ?? receipt.paid ?? []).includes(type);
const doubleLifeUsed = (s: GameState) =>
  s.players.some(
    (seat) => seatView(s, seat).flags.milesDoubleLifeRound === s.round,
  );
/** Call at actual PLAY commit, even when the card's ability is canceled. UI
 * cancellation before PLAY commit does not count. The receipt is retained with
 * its actual player even after elimination; all copies/all players share Max. */
export function milesCardPlayCommitted(
  s: GameState,
  p: Piece,
  playToken: string,
): void {
  if (p.code !== "27032") return;
  need(!!playToken, "Double Life requires an actual PLAY token.");
  const samePlay =
    s.flags.milesDoubleLifeRound === s.round &&
    s.flags.milesDoubleLifePlayToken === playToken;
  need(
    !doubleLifeUsed(s) || samePlay,
    "Double Life is max 1 per round across all players.",
  );
  s.flags.milesDoubleLifeRound = s.round;
  s.flags.milesDoubleLifePlayToken = playToken;
}
const milesHero = (
  s: GameState,
  ports: Pick<MilesMoralesPorts, "isIdentityTextBlank">,
) =>
  playerOrder(s).find((seat) => {
    const v = seatView(s, seat);
    return (
      active(v) && v.player.form === "hero" && !ports.isIdentityTextBlank?.(v)
    );
  });
const selectable = (
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  after: Effect[],
  ports: MilesMoralesPorts,
) => {
  if (!targets.length) {
    ports.queue(s, ...after);
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) => O(t.id, t.label, [{ ...action, target: t.id }], t.code)),
  );
};

/** Specials have no free manual identity action; another printed ability must
 * explicitly instruct the host to resolve them. Neither has an attack tag. */
export function milesSpecialAvailable(
  s: GameState,
  special: MilesSpecial,
  ports: MilesMoralesPorts,
): boolean {
  const subject = milesHero(s, ports);
  if (!subject) return false;
  return special === "venom-blast"
    ? ports.enemyTargets(s, false).length > 0
    : ports.canGiveStatus(s, `hero:${subject.id}`, "tough") ||
        ports
          .enemyTargets(s, false)
          .some((t) => ports.canGiveStatus(s, t.id, "confused"));
}
export function milesSpecialEffects(
  _s: GameState,
  special: MilesSpecial,
  after: Effect[] = [],
): Effect[] {
  return [M("special", { special, after })];
}
export function milesEventAction(p: Piece): "attack" | "thwart" | undefined {
  return ["27031", "27034"].includes(p.code)
    ? "attack"
    : p.code === "27033"
      ? "thwart"
      : undefined;
}
export function milesPlayRestriction(
  s: GameState,
  p: Piece,
  ports?: MilesMoralesPorts,
): string | null {
  if (!["27031", "27032", "27033", "27034"].includes(p.code)) return null;
  const action = milesEventAction(p);
  if (action && s.player.form !== "hero")
    return "This event requires hero form.";
  if (
    action === "attack" &&
    ports &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "This attack needs a legal enemy.";
  if (
    action === "thwart" &&
    ports &&
    !s.player.confused &&
    !ports.schemeTargets(s, true).length
  )
    return "This thwart needs a legal scheme with threat.";
  if (p.code === "27032") {
    if (doubleLifeUsed(s)) return "Double Life is max 1 per round.";
    if (
      ports &&
      !ports.canChangeForm(s) &&
      !(
        s.player.exhausted &&
        ports.canReadyIdentity(s, s.activePlayerId) &&
        ports.canPay(s, ports.cardCost(s, p), ["physical"], p.id, p.code)
      )
    )
      return "Double Life cannot change form or ready your identity.";
  }
  return null;
}
/** Recheck the concrete allocated payment before spending it. Under an
 * absolute form lock, Double Life can resolve only its independent ready
 * clause, so an allocation without Physical cannot initiate that ability. */
export function milesPaymentAllowed(
  s: GameState,
  p: Piece,
  receipt: MilesPaymentReceipt,
  ports: MilesMoralesPorts,
): boolean {
  return (
    p.code !== "27032" ||
    ports.canChangeForm(s) ||
    (paid(receipt, "physical") &&
      s.player.exhausted &&
      ports.canReadyIdentity(s, s.activePlayerId))
  );
}
/** Call after actual ordinary payment. Native event status replacement must
 * cancel the WHOLE attack/thwart ability, including its conditional Special. */
export function milesEvent(
  _s: GameState,
  p: Piece,
  receipt: MilesPaymentReceipt = {},
): Effect[] | null {
  switch (p.code) {
    case "27031":
      return [M("arachnobatics", { piece: p })];
    case "27032":
      return [
        M("double-life", {
          piece: p,
          physical: paid(receipt, "physical"),
          playToken: receipt.playToken,
        }),
      ];
    case "27033":
      return [M("swing-in", { piece: p, mental: paid(receipt, "mental") })];
    case "27034":
      return [M("web-shot", { piece: p, energy: paid(receipt, "energy") })];
    default:
      return null;
  }
}

export function milesCardEntered(_s: GameState, p: Piece): void {
  if (p.code === "27039") p.counters = 3;
}
export function milesResourceSources(
  s: GameState,
  ports: Pick<MilesMoralesPorts, "isTextBlank">,
): PaymentSource[] {
  return s.player.form === "hero"
    ? s.player.inPlay
        .filter(
          (p) =>
            p.code === "27039" &&
            !p.exhausted &&
            p.counters > 0 &&
            !ports.isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Web-Shooter",
          resources: ["wild"],
          kind: "ability",
          description:
            "Exhaust Web-Shooter and remove 1 web counter · generate 1 wild resource",
        }))
    : [];
}
export function milesResourceSpent(
  s: GameState,
  id: string,
  ports: MilesMoralesPorts,
): boolean {
  const p = own(s, id, "27039");
  if (!p) return false;
  need(
    milesResourceSources(s, ports).some((q) => q.id === id),
    "Web-Shooter is unavailable.",
  );
  p.exhausted = true;
  p.counters--;
  if (!p.counters) ports.discardPiece(s, p.id);
  return true;
}
function leastSchemes(s: GameState, ports: MilesMoralesPorts): AntManTarget[] {
  const threats = [
    { id: "main", amount: s.scheme.threat },
    ...s.sideSchemes.map((p) => ({ id: p.id, amount: p.counters })),
  ];
  const minimum = Math.min(...threats.map((p) => p.amount));
  return minimum > 0
    ? ports
        .schemeTargets(s, false)
        .filter((t) =>
          threats.some((p) => p.id === t.id && p.amount === minimum),
        )
    : [];
}
export function milesAbilityOptions(
  s: GameState,
  id: string,
  ports: MilesMoralesPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "27035" &&
    ((ports.canDraw?.(s, 1) ??
      s.player.deck.length + s.player.discard.length > 0) ||
      (s.player.form === "hero" && s.player.hand.length))
  )
    return [
      O(
        "draw",
        "Ganke Lee · draw 1, discard 1 in hero form",
        [M("ganke", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "27036" &&
    s.player.form === "alter" &&
    leastSchemes(s, ports).length
  )
    return [
      O(
        "threat",
        "Jefferson Davis · remove 1 from the scheme with least threat",
        [M("jefferson", { id })],
        p.code,
      ),
    ];
  return [];
}
export function milesAbility(
  s: GameState,
  id: string,
  ports: MilesMoralesPorts,
  action?: string,
): boolean {
  const p = own(s, id);
  if (!p || !["27035", "27036"].includes(p.code)) return false;
  const options = milesAbilityOptions(s, id, ports),
    choice = action ? options.find((o) => o.id === action) : options[0];
  need(choice, "This Miles Morales support ability is unavailable.");
  ports.queue(s, ...choice!.effects);
  return true;
}
const basicFlag = (receipt: MilesBasicReceipt, id: string) =>
  `milesBasic:${receipt.token}:${id}`;
export function milesBasicPowerOptions(
  s: GameState,
  receipt: MilesBasicReceipt,
  after: Effect[],
  ports: MilesMoralesPorts,
): Option[] {
  if (
    !receipt.token ||
    receipt.playerId !== s.activePlayerId ||
    !receipt.performed ||
    !receipt.wasHero ||
    s.player.form !== "hero" ||
    receipt.power === "recover"
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        ["27037", "27038"].includes(p.code) &&
        !ports.isTextBlank(s, p) &&
        !s.flags[basicFlag(receipt, p.id)] &&
        (!ports.canDiscardPiece || ports.canDiscardPiece(s, p)) &&
        milesSpecialAvailable(
          s,
          p.code === "27037" ? "venom-blast" : "spider-camouflage",
          ports,
        ),
    )
    .map((p) =>
      O(
        p.id,
        `${definition(p).name} · discard to resolve ${p.code === "27037" ? "Venom Blast" : "Spider Camouflage"}`,
        [M("basic-response", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
export function milesAfterBasicPower(
  s: GameState,
  receipt: MilesBasicReceipt,
  ports: MilesMoralesPorts,
): Effect[] {
  return milesBasicPowerOptions(s, receipt, [], ports).length
    ? [M("basic-window", { receipt, after: [] })]
    : [];
}
const formFlag = (receipt: MilesFormReceipt) => `milesForm:${receipt.token}`;
export function milesFormResponseOptions(
  s: GameState,
  receipt: MilesFormReceipt,
  after: Effect[],
  ports: Pick<MilesMoralesPorts, "isIdentityTextBlank">,
): Option[] {
  return active(s) &&
    !!receipt.token &&
    receipt.playerId === s.activePlayerId &&
    receipt.from !== receipt.to &&
    receipt.to === "alter" &&
    s.player.form === "alter" &&
    !ports.isIdentityTextBlank?.(s) &&
    !s.flags[formFlag(receipt)] &&
    s.player.discard.some(signature)
    ? [
        O(
          "miles-shuffle",
          "Miles Morales · shuffle 1 signature card from discard",
          [M("shuffle-choice", { receipt, after })],
          "27030b",
        ),
      ]
    : [];
}
export function milesFormChanged(
  s: GameState,
  receipt: MilesFormReceipt,
  ports: Pick<MilesMoralesPorts, "isIdentityTextBlank">,
): Effect[] {
  return milesFormResponseOptions(s, receipt, [], ports).length
    ? [
        E("optional", {
          title: "Miles Morales",
          text: "Shuffle 1 Spider-Man card from your discard pile into your deck?",
          effects: [M("shuffle-choice", { receipt, after: [] })],
          image: "27030b",
        }),
      ]
    : [];
}

export function milesInitializeNemesis(
  s: GameState,
  ports: Pick<MilesMoralesPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.milesNemesisInitialized) return;
  const required = ["27057", "27058", "27059", "27060", "27060"],
    zone = (s.player.setAside ||= []);
  for (const code of new Set(required)) {
    const have = zone.filter((p) => p.code === code).length,
      count = required.filter((c) => c === code).length;
    need(
      have <= count,
      "Miles Morales nemesis reserve has duplicate physical cards.",
    );
    for (let i = have; i < count; i++) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      zone.push(p);
    }
  }
  s.flags.milesNemesisInitialized = true;
}
export function milesShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    shown = ["27058", "27057"].flatMap((code) =>
      zone.filter((p) => p.code === code),
    ),
    rest = zone.filter((p) => ["27059", "27060"].includes(p.code));
  return [
    ...shown.map((p) => M("reveal-setaside", { id: p.id })),
    M("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!shown.some((p) => p.code === "27058")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
/** Native printed +2 ATK on Razor Claws is already a normal attachment stat.
 * This provider adds only the nonnumeric printed attack keyword. */
export function milesEnemyAttackKeywords(
  s: GameState,
  p: Piece,
  ports: Pick<MilesMoralesPorts, "isTextBlank">,
) {
  return {
    piercing: s.attachments.some(
      (a) =>
        a.code === "27059" && a.attachedTo === p.id && !ports.isTextBlank(s, a),
    ),
  };
}
export function milesEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "27056": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [M("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "27057":
      return [M("tracking", { id: p.id, revealPlayerId: s.activePlayerId })];
    case "27058":
      return [M("prowler", { id: p.id, revealPlayerId: s.activePlayerId })];
    case "27059":
      return [M("razor", { piece: p, actorId: s.firstPlayerId })];
    case "27060":
      return [M("slice", { actorId: s.firstPlayerId })];
    default:
      return null;
  }
}
export function milesBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["27056", "27057", "27058", "27059", "27060"].includes(p.code)
    ? []
    : null;
}

export function resolveMilesMoralesEffect(
  s: GameState,
  e: Effect,
  ports: MilesMoralesPorts,
): boolean {
  if (!e.type.startsWith("miles:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "miles:special": {
      const special = e.special as MilesSpecial;
      need(
        ["venom-blast", "spider-camouflage"].includes(special),
        "Unknown Spider-Man Special.",
      );
      if (!milesSpecialAvailable(s, special, ports)) {
        ports.queue(s, ...after);
        break;
      }
      if (special === "venom-blast")
        selectable(
          s,
          "Venom Blast",
          ports.enemyTargets(s, false),
          M("venom-hit", { after }),
          after,
          ports,
        );
      else {
        const subject = milesHero(s, ports)!;
        ports.queue(
          s,
          ...(ports.canGiveStatus(s, `hero:${subject.id}`, "tough")
            ? [E("status", { target: `hero:${subject.id}`, status: "tough" })]
            : []),
          M("camouflage-confuse", { after }),
        );
      }
      break;
    }
    case "miles:venom-hit":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Venom Blast needs an actual enemy.",
      );
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 2,
          source: "hero",
          attack: false,
        }),
        M("venom-stun", { target: e.target, after }),
      );
      break;
    case "miles:venom-stun":
      ports.queue(
        s,
        ...(enemy(s, e.target) && ports.canGiveStatus(s, e.target, "stunned")
          ? [E("status", { target: e.target, status: "stunned" })]
          : []),
        ...after,
      );
      break;
    case "miles:camouflage-confuse":
      selectable(
        s,
        "Spider Camouflage",
        ports
          .enemyTargets(s, false)
          .filter((t) => ports.canGiveStatus(s, t.id, "confused")),
        M("camouflage-target", { after }),
        after,
        ports,
      );
      break;
    case "miles:camouflage-target":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target) &&
          ports.canGiveStatus(s, e.target, "confused"),
        "Spider Camouflage needs an eligible enemy.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "confused" }),
        ...after,
      );
      break;
    case "miles:arachnobatics":
    case "miles:web-shot":
    case "miles:swing-in": {
      const p: Piece = e.piece,
        action = milesEventAction(p);
      need(s.player.form === "hero", "This event requires hero form.");
      if (action === "attack" && s.player.stunned) {
        consumeStatus(s.player, "stunned");
        ports.queue(s, ...after);
        break;
      }
      if (action === "thwart" && s.player.confused) {
        consumeStatus(s.player, "confused");
        ports.queue(s, ...after);
        break;
      }
      selectable(
        s,
        definition(p).name,
        action === "attack"
          ? ports.enemyTargets(s, true)
          : ports.schemeTargets(s, true),
        M("event-target", {
          piece: p,
          energy: e.energy,
          mental: e.mental,
          after,
        }),
        after,
        ports,
      );
      break;
    }
    case "miles:event-target": {
      const p: Piece = e.piece,
        action = milesEventAction(p),
        targets =
          action === "attack"
            ? ports.enemyTargets(s, true)
            : ports.schemeTargets(s, true);
      need(
        targets.some((t) => t.id === e.target),
        "This event's actual target is unavailable.",
      );
      if (p.code === "27033")
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: 4,
            action: true,
            source: "hero",
            thwartInitiated: true,
          }),
          ...(e.mental
            ? milesSpecialEffects(s, "spider-camouflage", after)
            : after),
        );
      else {
        const target = enemy(s, e.target)!;
        const amount =
          p.code === "27031"
            ? 2 +
              (Number(target.stunCards ?? Number(target.stunned)) > 0 ? 3 : 0) +
              (Number(target.confuseCards ?? Number(target.confused)) > 0
                ? 3
                : 0)
            : 4;
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount,
              source: "hero",
              attack: true,
              attackInitiated: true,
            }),
          ],
          p.code === "27034" && e.energy
            ? milesSpecialEffects(s, "venom-blast", after)
            : after,
        );
      }
      break;
    }
    case "miles:double-life": {
      const p: Piece = e.piece;
      const token =
        e.playToken || `legacy:${s.round}:${s.activePlayerId}:${p.id}`;
      milesCardPlayCommitted(s, p, token);
      need(
        s.flags.milesDoubleLifeResolvedToken !== token,
        "This actual Double Life PLAY has already resolved.",
      );
      s.flags.milesDoubleLifeResolvedToken = token;
      const next = [M("double-life-ready", { physical: e.physical, after })];
      if (ports.canChangeForm(s)) ports.flip(s, false, next);
      else ports.queue(s, ...next);
      break;
    }
    case "miles:double-life-ready":
      ports.queue(
        s,
        ...(e.physical &&
        s.player.exhausted &&
        ports.canReadyIdentity(s, s.activePlayerId)
          ? [E("ready", { target: `hero:${s.activePlayerId}` })]
          : []),
        ...after,
      );
      break;
    case "miles:ganke": {
      const p = own(s, e.id, "27035");
      need(
        p && milesAbilityOptions(s, p.id, ports).some((o) => o.id === "draw"),
        "Ganke Lee is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1 }), M("ganke-discard", { after }));
      break;
    }
    case "miles:ganke-discard":
      if (s.player.form !== "hero" || !s.player.hand.length)
        ports.queue(s, ...after);
      else
        ports.choose(
          s,
          "Ganke Lee",
          "Choose and discard 1 actual card from your hand.",
          s.player.hand.map((p) =>
            O(
              p.id,
              definition(p).name,
              [M("discard-hand", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      break;
    case "miles:discard-hand":
      need(
        s.player.hand.some((p) => p.id === e.id),
        "Ganke Lee needs an actual hand card to discard.",
      );
      ports.discardHand(s, e.id);
      ports.queue(s, ...after);
      break;
    case "miles:jefferson": {
      const p = own(s, e.id, "27036");
      need(
        p && milesAbilityOptions(s, p.id, ports).some((o) => o.id === "threat"),
        "Jefferson Davis is unavailable.",
      );
      p!.exhausted = true;
      selectable(
        s,
        "Jefferson Davis",
        leastSchemes(s, ports),
        M("least-threat", { after }),
        after,
        ports,
      );
      break;
    }
    case "miles:least-threat":
      need(
        leastSchemes(s, ports).some((p) => p.id === e.target),
        "Choose a scheme with the least actual threat.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 1,
          action: false,
          source: "hero",
          ignorePatrol: true,
        }),
        ...after,
      );
      break;
    case "miles:basic-window": {
      const next = [{ ...e, type: "miles:basic-window" }],
        options = milesBasicPowerOptions(s, e.receipt, next, ports);
      if (options.length)
        ports.choose(
          s,
          "Spider-Man · basic power responses",
          "Resolve responses in your chosen order.",
          [...options, O("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "miles:basic-response": {
      const receipt: MilesBasicReceipt = e.receipt,
        p = own(s, e.id);
      need(
        p &&
          milesBasicPowerOptions(s, receipt, after, ports).some(
            (o) => o.id === p.id,
          ),
        "This basic-power response or discard cost is unavailable.",
      );
      s.flags[basicFlag(receipt, p!.id)] = true;
      ports.discardPiece(s, p!.id);
      need(!own(s, p!.id), "The actual upgrade discard cost was not paid.");
      ports.queue(
        s,
        ...milesSpecialEffects(
          s,
          p!.code === "27037" ? "venom-blast" : "spider-camouflage",
          after,
        ),
      );
      break;
    }
    case "miles:shuffle-choice": {
      need(
        milesFormResponseOptions(s, e.receipt, after, ports).length,
        "Miles Morales's alter-ego response is unavailable.",
      );
      ports.choose(
        s,
        "Miles Morales",
        "Choose 1 actual Spider-Man signature card in your discard pile.",
        s.player.discard
          .filter(signature)
          .map((p) =>
            O(
              p.id,
              definition(p).name,
              [M("shuffle-card", { id: p.id, receipt: e.receipt, after })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "miles:shuffle-card": {
      const i = s.player.discard.findIndex(
        (p) => p.id === e.id && signature(p),
      );
      need(
        i >= 0 && milesFormResponseOptions(s, e.receipt, after, ports).length,
        "Choose an actual discarded Spider-Man signature card.",
      );
      s.flags[formFlag(e.receipt)] = true;
      s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "miles:tracking": {
      const p = s.sideSchemes.find((p) => p.id === e.id && p.code === "27057");
      if (
        p &&
        !ports.isTextBlank(s, p) &&
        seatView(s, e.revealPlayerId).player.form === "alter"
      )
        ports.placeAccelerationToken(s, p.id, 1);
      ports.queue(s, ...after);
      break;
    }
    case "miles:prowler": {
      const p = s.minions.find((p) => p.id === e.id && p.code === "27058");
      ports.queue(
        s,
        ...(p &&
        !ports.isTextBlank(s, p) &&
        seatView(s, e.revealPlayerId).player.form === "alter" &&
        ports.canGiveStatus(s, p.id, "tough")
          ? [E("status", { target: p.id, status: "tough" })]
          : []),
        ...after,
      );
      break;
    }
    case "miles:razor": {
      const highest = Math.max(
        ...s.minions.map((p) => definition(p).health || 0),
      );
      const targets = s.minions
        .filter((p) => (definition(p).health || 0) === highest)
        .map((p) => ({ id: p.id, label: definition(p).name, code: p.code }));
      if (!targets.length)
        ports.queue(s, E("surge", { sourceCode: "27059" }), ...after);
      else
        selectable(
          s,
          "Razor Claws",
          targets,
          M("attach-claws", { piece: e.piece, after }),
          after,
          ports,
        );
      break;
    }
    case "miles:attach-claws": {
      const p = s.minions.find((p) => p.id === e.target),
        highest = Math.max(...s.minions.map((p) => definition(p).health || 0));
      need(
        p && (definition(p).health || 0) === highest,
        "Razor Claws needs a minion with highest printed hit points.",
      );
      ports.attachEncounter(s, e.piece, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "miles:slice": {
      const prowler = s.minions.find((p) => definition(p).name === "Prowler"),
        seats = playerOrder(s),
        minimum = Math.min(...seats.map((seat) => seatView(s, seat).player.hp));
      const targets = seats.filter(
        (seat) => seatView(s, seat).player.hp === minimum,
      );
      if (!prowler || !targets.length) {
        ports.queue(s, E("surge", { sourceCode: "27060" }), ...after);
        break;
      }
      const action = (id: string) =>
        M("slice-attack", { enemyId: prowler.id, playerId: id, after });
      if (targets.length === 1) ports.queue(s, action(targets[0].id));
      else
        ports.choose(
          s,
          "Slice and Dice",
          "Choose among players with the fewest remaining hit points.",
          targets.map((seat) =>
            O(seat.id, `${seat.id} · ${seatView(s, seat).player.hp} HP`, [
              action(seat.id),
            ]),
          ),
        );
      break;
    }
    case "miles:slice-attack": {
      const p = s.minions.find(
          (p) => p.id === e.enemyId && definition(p).name === "Prowler",
        ),
        v = s.players.find(
          (seat) => seat.id === e.playerId && !seat.eliminated,
        );
      if (
        !p ||
        !v ||
        !ports.enemyAttack(s, p.id, v.id, true, M("slice-after", { after }))
      )
        ports.queue(s, E("surge", { sourceCode: "27060" }), ...after);
      break;
    }
    case "miles:slice-after":
      ports.queue(
        s,
        ...(!e.performed || e.defeatedCharacter
          ? [E("surge", { sourceCode: "27060" })]
          : []),
        ...after,
      );
      break;
    case "miles:reveal-setaside": {
      const z = s.player.setAside || [],
        i = z.findIndex((p) => p.id === e.id);
      need(
        i >= 0,
        "Miles Morales's actual nemesis reserve card is unavailable.",
      );
      ports.queue(s, E("reveal", { piece: z.splice(i, 1)[0] }), ...after);
      break;
    }
    case "miles:shuffle-nemesis": {
      const ids: string[] = e.ids || [];
      need(
        new Set(ids).size === ids.length,
        "Nemesis shuffle requires distinct physical IDs.",
      );
      const z = s.player.setAside || [];
      for (const id of ids) {
        const i = z.findIndex((p) => p.id === id);
        need(i >= 0, "The actual nemesis card is unavailable.");
        s.encounter.deck.push(z.splice(i, 1)[0]);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    }
    case "miles:obligation":
      need(
        active(s),
        "Keeping Secrets belongs to the actual Miles Morales player.",
      );
      ports.giveObligation(s, e.piece, s.activePlayerId);
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Keeping Secrets",
          "You may flip to alter ego before choosing.",
          [
            O("flip", "Flip to Miles Morales", [
              M("obligation-flip", { piece: e.piece, after }),
            ]),
            O("stay", "Stay in hero form", [
              M("obligation-choice", { piece: e.piece, after }),
            ]),
          ],
        );
      else ports.queue(s, M("obligation-choice", { piece: e.piece, after }));
      break;
    case "miles:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Miles Morales cannot change form.",
      );
      ports.flip(
        s,
        false,
        [M("obligation-choice", { piece: e.piece, after })],
        "alter",
      );
      break;
    case "miles:obligation-choice": {
      const options = [
        O(
          "discard",
          "Discard Ganke Lee and Jefferson Davis · surge if neither is discarded",
          [M("obligation-discard", { piece: e.piece, after })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        options.unshift(
          O(
            "remove",
            "Exhaust Miles Morales · remove Keeping Secrets from the game",
            [M("obligation-remove", { piece: e.piece, after })],
          ),
        );
      ports.choose(
        s,
        "Keeping Secrets",
        "Choose the obligation's resolution.",
        options,
      );
      break;
    }
    case "miles:obligation-remove":
      need(
        active(s) && s.player.form === "alter" && !s.player.exhausted,
        "Miles Morales cannot pay this exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.removeEncounter(s, e.piece);
      ports.queue(s, ...after);
      break;
    case "miles:obligation-discard": {
      let discarded = 0;
      for (const p of allInPlay(s).filter((p) =>
        ["Ganke Lee", "Jefferson Davis"].includes(definition(p).name),
      )) {
        if (ports.canDiscardPiece && !ports.canDiscardPiece(s, p)) continue;
        ports.discardPiece(s, p.id);
        if (!allInPlay(s).some((q) => q.id === p.id)) discarded++;
      }
      ports.discardEncounter(s, e.piece);
      ports.queue(
        s,
        ...(!discarded ? [E("surge", { sourceCode: "27056" })] : []),
        ...after,
      );
      break;
    }
    default:
      throw Error(`Unknown Miles Morales effect: ${e.type}`);
  }
  return true;
}
