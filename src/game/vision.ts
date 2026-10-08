import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const V = (type: string, args: Record<string, unknown> = {}) =>
  E(`vision:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "vision";
const definition = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const massCard = (p: Piece) => ["26002", "26002b"].includes(p.code);
const mass = (s: GameState) =>
  active(s) ? s.player.inPlay.find(massCard) : undefined;
const visionEventCard = (p: Piece) =>
  definition(p)?.set_code === "vision" && definition(p)?.type_code === "event";
const androidAlly = (p: Piece) =>
  definition(p)?.type_code === "ally" &&
  (definition(p)?.traits || "").split(/\.\s*/).includes("Android");
type TextPorts = Pick<VisionPorts, "isTextBlank">;
const textPorts: TextPorts = { isTextBlank };

export type VisionMassForm = "intangible" | "dense";
export const VISION_SCRIPT_CODES = [
  "26001a",
  "26001b",
  "26002",
  "26002b",
  "26003",
  "26004",
  "26005",
  "26006",
  "26007",
  "26008",
  "26009",
  "26010",
  "26011",
  "26012",
  "26028",
  "26029",
  "26030",
  "26031",
  "26032",
] as const;
export const VISION_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const VISION_ORIGINAL_SOURCE = "https://hallofheroeslcg.com/vision/";
export const VISION_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#vision";

export interface VisionPorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  cardCost(s: GameState, p: Piece): number;
  isIdentityTextBlank?(s: GameState): boolean;
  /** Only absolute form locks. The Hero/AE voluntary-flip budget is separate. */
  canChangeMassForm?(s: GameState): boolean;
  /** Notify the ordinary form machinery and update pending basic DEF after
   * the physical mass card changes face; do not resolve optional responses. */
  massFormChanged?(
    s: GameState,
    from: VisionMassForm,
    to: VisionMassForm,
  ): void;
  /** Generic form responses, retaining an effect-based continuation. */
  formResponseOptions?(s: GameState, after: Effect[]): Option[];
  schemeTargets(
    s: GameState,
    thwart: boolean,
    ignoreCrisis?: boolean,
    ignorePatrol?: boolean,
  ): ReturnType<AntManPorts["schemeTargets"]>;
  /** Shuffle the actual player deck once after a search, even a failed search.
   * Resume only after ordinary deck exhaustion/reset responses. */
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  canDiscardAttachment?(s: GameState, p: Piece): boolean;
  canDiscardUpgrade?(s: GameState, p: Piece): boolean;
  /** Actual held and permitted stored Defense events (e.g. Jocasta). The host
   * retains each nested instance until its ordinary paid PLAY commits. Stored
   * cards are not hand cards and cannot generate hand resources. */
  defenseEventSources?(s: GameState): Piece[];
  preventAllAttackDamage(s: GameState): void;
  /** Delayed lasting effect runs after THIS attack resolves, before optional
   * after-attack responses. It must survive a serialized save/reload. */
  afterAttack(s: GameState, effects: Effect[]): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  /** PUT the actual searched environment in play; never reveal or clone it. */
  putEnvironment(s: GameState, p: Piece): void;
  /** Exactly count random discards using the shared RNG, actual owning hand,
   * SPEND/DISCARD distinction, and hidden-information boundary. */
  discardRandomHand(s: GameState, count: number): void;
}

/** The public form is the FACE of one actual reversible Permanent. */
export function visionMassForm(s: GameState): VisionMassForm | undefined {
  const p = mass(s);
  return p ? (p.code === "26002b" ? "dense" : "intangible") : undefined;
}
export function visionMassTextBlank(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  const p = mass(s);
  return (
    !!p &&
    (ports.isTextBlank(s, p) ||
      s.player.inPlay.some(
        (o) => o.code === "26028" && !ports.isTextBlank(s, o),
      ))
  );
}
export function visionStats(s: GameState, ports: TextPorts = textPorts) {
  return active(s) &&
    s.player.form === "hero" &&
    visionMassForm(s) === "dense" &&
    !visionMassTextBlank(s, ports)
    ? { attack: 2, thwart: 0, defense: 2 }
    : { attack: 0, thwart: 0, defense: 0 };
}
/** These bonuses are printed on the AE identity, not the mass upgrade. An
 * obligation blanking the mass card does not remove AE REC/hand-size bonuses. */
export function visionAlterStats(
  s: GameState,
  ports?: Pick<VisionPorts, "isIdentityTextBlank">,
) {
  const applies =
    active(s) && s.player.form === "alter" && !ports?.isIdentityTextBlank?.(s);
  return {
    recover: applies && visionMassForm(s) === "dense" ? 2 : 0,
    handSize: applies && visionMassForm(s) === "intangible" ? 1 : 0,
  };
}
export function visionCanAttack(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return (
    !active(s) ||
    visionMassForm(s) !== "intangible" ||
    visionMassTextBlank(s, ports)
  );
}
export const visionCanDefend = visionCanAttack;
/** RRG 1.8 Appendix IV p57: constant damage-taken reductions precede Tough.
 * Host applies once per native attack to Vision's primary/overkill packet;
 * never reduce a defending ally's damage or nonattack damage. */
export function visionAttackDamageReduction(
  s: GameState,
  ports: TextPorts = textPorts,
): number {
  return active(s) &&
    visionMassForm(s) === "intangible" &&
    !visionMassTextBlank(s, ports)
    ? 2
    : 0;
}
const cape = (s: GameState, ports: TextPorts) =>
  active(s) &&
  s.player.inPlay.some((p) => p.code === "26006" && !ports.isTextBlank(s, p));
export function visionRetaliate(
  s: GameState,
  ports: TextPorts = textPorts,
): number {
  return cape(s, ports) && visionMassForm(s) === "dense" ? 1 : 0;
}
export function visionStalwart(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return !!cape(s, ports) && visionMassForm(s) === "intangible";
}
export function visionTraits(
  s: GameState,
  ports: TextPorts = textPorts,
): string[] {
  return active(s) &&
    s.player.inPlay.some((p) => p.code === "26005" && !ports.isTextBlank(s, p))
    ? ["Aerial"]
    : [];
}
export function visionAllyStats(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
) {
  const on = p.code === "26003" && !ports.isTextBlank(s, p);
  return {
    attack: on && visionMassForm(s) === "dense" ? 2 : 0,
    thwart: on && visionMassForm(s) === "intangible" ? 2 : 0,
  };
}
export function visionResourceSources(
  s: GameState,
  ports: TextPorts = textPorts,
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) => p.code === "26005" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Solar Gem",
      resources: ["wild"],
      description: "Exhaust Solar Gem · generate 1 wild resource",
      kind: "ability",
    }));
}
export function visionResourceSpent(
  s: GameState,
  id: string,
  ports: TextPorts = textPorts,
): boolean {
  const p = own(s, id, "26005");
  if (!p) return false;
  need(!p.exhausted && !ports.isTextBlank(s, p), "Solar Gem is unavailable.");
  p.exhausted = true;
  return true;
}

/** Before opening draw: remove the actual Permanent from draw zones and hold
 * it aside. It lacks Setup keyword and is placed by AE Setup AFTER mulligan.
 * The original playable deck is 40 cards plus this one physical Permanent. */
export function visionInitializeMass(
  s: GameState,
  ports: Pick<VisionPorts, "makePiece">,
) {
  if (!active(s)) return;
  const inPlay = s.player.inPlay.filter(massCard);
  const zones = [
    s.player.hand,
    s.player.deck,
    s.player.discard,
    (s.player.setAside ||= []),
  ];
  const held = zones.flatMap((z) => z.filter(massCard));
  need(
    inPlay.length + held.length <= 1,
    "Vision must own exactly one physical mass-form upgrade.",
  );
  if (inPlay.length) return;
  const p = held[0] || {
    ...ports.makePiece(s, "26002"),
    ownerId: s.activePlayerId,
  };
  for (const z of zones) {
    const i = z.findIndex((x) => x.id === p.id);
    if (i >= 0) z.splice(i, 1);
  }
  p.code = "26002";
  s.player.setAside!.push(p);
}
export function visionSetup(
  s: GameState,
  ports: Pick<VisionPorts, "makePiece">,
): Effect[] {
  if (!active(s) || s.flags.visionSetupResolved) return [];
  visionInitializeMass(s, ports);
  const zone = s.player.setAside || [],
    i = zone.findIndex(massCard);
  if (i >= 0) {
    const p = zone.splice(i, 1)[0];
    p.code = "26002";
    s.player.inPlay.push(p);
  }
  s.flags.visionSetupResolved = true;
  return [];
}
export function visionInitializeNemesis(
  s: GameState,
  ports: Pick<VisionPorts, "makePiece">,
) {
  if (!active(s) || s.flags.visionNemesisInitialized) return;
  const zone = (s.player.setAside ||= []);
  const physicalCodes = ["26029", "26030", "26031", "26032", "26032"];
  for (const code of new Set(physicalCodes)) {
    const existing = zone.filter((p) => p.code === code).length;
    const required = physicalCodes.filter((c) => c === code).length;
    need(
      existing <= required,
      "Vision's physical nemesis reserve has duplicate cards.",
    );
    for (let n = existing; n < required; n++)
      zone.push(ports.makePiece(s, code));
  }
  s.flags.visionNemesisInitialized = true;
}
export function visionCanChangeMassForm(
  s: GameState,
  ports: Pick<VisionPorts, "canChangeForm" | "canChangeMassForm">,
) {
  return (
    active(s) &&
    !!mass(s) &&
    (ports.canChangeMassForm
      ? ports.canChangeMassForm(s)
      : ports.canChangeForm(s))
  );
}
export function visionMassChanged(
  s: GameState,
  from: VisionMassForm,
  to: VisionMassForm,
): Effect[] {
  if (!active(s) || from === to || visionMassForm(s) !== to) return [];
  return [
    V("mass-responses", {
      from,
      to,
      massId: mass(s)!.id,
      used: [],
      actorId: s.activePlayerId,
    }),
  ];
}
export function visionChangeMassForm(
  s: GameState,
  to: VisionMassForm,
  ports: VisionPorts,
): Effect[] {
  need(visionCanChangeMassForm(s, ports), "Vision cannot change mass form.");
  const from = visionMassForm(s)!;
  if (from === to) return [];
  mass(s)!.code = to === "dense" ? "26002b" : "26002";
  ports.massFormChanged?.(s, from, to);
  return visionMassChanged(s, from, to);
}
export function visionAbilityOptions(
  s: GameState,
  id: string,
  ports: VisionPorts,
): Option[] {
  if (["hero", "identity"].includes(id)) {
    return active(s) &&
      s.player.form === "hero" &&
      !ports.isIdentityTextBlank?.(s) &&
      s.flags.visionDensityRound !== s.round &&
      visionCanChangeMassForm(s, ports)
      ? [
          option(
            "density",
            "Density Manipulation · change mass form",
            [V("density")],
            "26001a",
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "26004" &&
    active(s) &&
    s.player.form === "alter" &&
    !p.exhausted
  )
    return [
      option(
        "search",
        "Exhaust 616 Hickory Branch Lane · search for an Android ally",
        [V("lane", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "26028" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted
  )
    return [
      option(
        "remove",
        "Exhaust Vision · remove Corrupted Programming",
        [V("obligation-remove", { id })],
        p.code,
      ),
    ];
  return [];
}
export function visionAbility(
  s: GameState,
  id: string,
  ports: VisionPorts,
  action?: string,
): boolean {
  const choices = visionAbilityOptions(s, id, ports);
  if (!choices.length) return false;
  const chosen = action
    ? choices.find((o) => o.id === action)
    : choices.length === 1
      ? choices[0]
      : undefined;
  if (chosen) ports.queue(s, ...chosen.effects);
  else {
    need(!action, "Vision's action is unavailable.");
    ports.choose(s, "Vision", "Choose an action.", choices);
  }
  return true;
}

/** The dual-trait Solar Beam has exactly ONE active action. Host must use this
 * discriminator BEFORE ordinary Stun/Confuse replacement, never both traits. */
export function visionEventAction(
  s: GameState,
  p: Piece,
): "attack" | "thwart" | undefined {
  if (p.code === "26008")
    return visionMassForm(s) === "dense"
      ? "attack"
      : visionMassForm(s) === "intangible"
        ? "thwart"
        : undefined;
  if (p.code === "26009") return "attack";
  if (p.code === "26010") return "thwart";
  return undefined;
}
const disruptionAttachments = (
  s: GameState,
  target: string,
  ports: VisionPorts,
) =>
  s.attachments.filter(
    (p) =>
      p.attachedTo === target &&
      /\bHero\s+(Action|Response)\b/.test(
        (definition(p)?.text || "").replace(/<[^>]*>/g, ""),
      ) &&
      (!ports.canDiscardAttachment || ports.canDiscardAttachment(s, p)),
  );
export function visionPlayRestriction(
  s: GameState,
  p: Piece,
  ports?: VisionPorts,
): string | null {
  if (!["26008", "26009", "26010", "26011", "26012"].includes(p.code))
    return null;
  if (s.player.form !== "hero") return "This event requires hero form.";
  const form = visionMassForm(s);
  if (!form) return "Vision's physical mass-form upgrade is unavailable.";
  if (["26009", "26012"].includes(p.code) && form !== "dense")
    return "Vision must be in Dense mass form.";
  if (["26010", "26011"].includes(p.code) && form !== "intangible")
    return "Vision must be in Intangible mass form.";
  if (visionEventAction(s, p) === "attack" && !visionCanAttack(s, ports))
    return "Vision cannot attack in Intangible mass form.";
  const action = visionEventAction(s, p);
  if (
    ports &&
    action === "attack" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "This attack needs an actual legal enemy.";
  if (
    ports &&
    action === "thwart" &&
    !s.player.confused &&
    !ports.schemeTargets(s, true, p.code === "26010", p.code === "26010").length
  )
    return "This thwart needs an actual legal scheme with threat.";
  if (
    p.code === "26011" &&
    ports &&
    !ports
      .enemyTargets(s, false)
      .some(
        (t) =>
          ports.canGiveStatus(s, t.id, "confused") ||
          disruptionAttachments(s, t.id, ports).length,
      )
  )
    return "Phase Disruption needs an enemy it can confuse or an eligible attachment.";
  return null;
}
export function visionEvent(s: GameState, p: Piece): Effect[] | null {
  return ["26008", "26009", "26010", "26011"].includes(p.code)
    ? [V("event", { piece: p, action: visionEventAction(s, p) })]
    : null;
}
function isDefending(s: GameState) {
  return (
    active(s) &&
    s.player.form === "hero" &&
    !!s.attack &&
    (s.attack.defender === `hero:${s.activePlayerId}` ||
      (s.attack.defender === "hero" &&
        (s.attack.targetPlayerId || s.activePlayerId) === s.activePlayerId))
  );
}
export function visionDefenseOptions(
  s: GameState,
  used: string[],
  after: Effect[],
  ports: VisionPorts,
): Option[] {
  if (
    !isDefending(s) ||
    visionMassForm(s) !== "dense" ||
    !visionCanDefend(s, ports)
  )
    return [];
  return (ports.defenseEventSources?.(s) || s.player.hand)
    .filter(
      (p) =>
        p.code === "26012" &&
        !used.includes(p.id) &&
        (!s.attack!.preventAllDamage ||
          ports.canGiveStatus(s, s.attack!.attacker, "stunned")) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Mass Increase · prevent all attack damage and stun afterward",
        [V("mass-increase-pay", { id: p.id, used, after })],
        p.code,
      ),
    );
}

const droneEnvironment = (p: Piece) => definition(p)?.name === "Ultron Drones";
const dronesInPlay = (s: GameState) =>
  (s.environments || []).some(droneEnvironment);
export function visionDroneStats(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
) {
  return p.code === "drone" &&
    !!p.droneCard &&
    (s.environments || []).some(
      (p) => droneEnvironment(p) && !ports.isTextBlank(s, p),
    )
    ? { attack: 1, scheme: 1, health: 1 }
    : null;
}
/** Forced interrupt at actual attack initiation. No drone for scheming, or an
 * attack replaced by Stun before initiation. Use the actual attacked seat. */
export function visionEnemyAttackInitiated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts = textPorts,
): Effect[] {
  return p.code === "26029" && !ports.isTextBlank(s, p) && dronesInPlay(s)
    ? [E("drone", { actorId: playerId })]
    : [];
}
export function visionShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    shown = zone.filter((p) => ["26029", "26030"].includes(p.code)),
    rest = zone.filter((p) => ["26031", "26032"].includes(p.code));
  return [
    ...shown.map((p) => V("reveal-setaside", { id: p.id })),
    V("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!shown.some((p) => p.code === "26029")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function visionEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "26028": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [V("obligation", { piece: p, playerId: owner.id })] : [];
    }
    case "26030":
      return [V("unleashed")];
    case "26032":
      return [V("relentless")];
    case "26029":
    case "26031":
      return [];
    default:
      return null;
  }
}
export function visionBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["26028", "26029", "26030", "26031", "26032"].includes(p.code)
    ? []
    : null;
}

export function resolveVisionEffect(
  s: GameState,
  e: Effect,
  ports: VisionPorts,
): boolean {
  if (!e.type.startsWith("vision:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "vision:density": {
      need(
        visionAbilityOptions(s, "hero", ports).length,
        "Density Manipulation is unavailable.",
      );
      s.flags.visionDensityRound = s.round;
      ports.queue(
        s,
        ...visionChangeMassForm(
          s,
          visionMassForm(s) === "dense" ? "intangible" : "dense",
          ports,
        ),
      );
      break;
    }
    case "vision:mass-responses": {
      const used: string[] = e.used || [];
      const continuation = (id?: string) => ({
        ...e,
        type: "vision:mass-responses",
        used: id ? [...used, id] : used,
      });
      const choices: Option[] = [];
      const physical = own(s, e.massId);
      if (
        e.to === "dense" &&
        physical &&
        physical.code === "26002b" &&
        !used.includes(e.massId) &&
        !visionMassTextBlank(s, ports)
      )
        choices.push(
          option(
            e.massId,
            "Dense · draw 1 card",
            [E("draw", { amount: 1 }), continuation(e.massId)],
            physical.code,
          ),
        );
      if (s.player.form === "hero" && s.player.discard.some(visionEventCard))
        for (const p of s.player.inPlay.filter(
          (p) =>
            p.code === "26007" &&
            !ports.isTextBlank(s, p) &&
            (!ports.canDiscardUpgrade || ports.canDiscardUpgrade(s, p)) &&
            !used.includes(p.id),
        ))
          choices.push(
            option(
              p.id,
              "Density Control · discard and retrieve a Vision event",
              [V("control", { id: p.id, after: [continuation(p.id)] })],
              p.code,
            ),
          );
      choices.push(...(ports.formResponseOptions?.(s, [continuation()]) || []));
      if (choices.length)
        ports.choose(
          s,
          "Vision · mass-form responses",
          "Resolve responses in your chosen order.",
          [...choices, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "vision:mass-generic-responses": {
      const choices = ports.formResponseOptions?.(s, after) || [];
      if (choices.length)
        ports.choose(
          s,
          "Vision · form responses",
          "Resolve another form response?",
          [...choices, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "vision:control": {
      const p = own(s, e.id, "26007");
      need(
        p &&
          s.player.form === "hero" &&
          !ports.isTextBlank(s, p) &&
          (!ports.canDiscardUpgrade || ports.canDiscardUpgrade(s, p)),
        "Density Control requires its actual unblanked upgrade in hero form.",
      );
      const choices = s.player.discard.filter(visionEventCard);
      need(
        choices.length,
        "Density Control needs an actual discarded Vision event.",
      );
      ports.choose(
        s,
        "Density Control",
        "Choose a physical Vision event, then discard Density Control as its cost.",
        choices.map((p) =>
          option(
            p.id,
            definition(p).name,
            [V("control-card", { source: e.id, id: p.id, after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "vision:control-card": {
      const source = own(s, e.source, "26007"),
        i = s.player.discard.findIndex(
          (p) => p.id === e.id && visionEventCard(p),
        );
      need(
        source &&
          !ports.isTextBlank(s, source) &&
          (!ports.canDiscardUpgrade || ports.canDiscardUpgrade(s, source)) &&
          s.player.form === "hero" &&
          i >= 0,
        "Density Control needs the original source and discarded event.",
      );
      const target = s.player.discard[i];
      ports.discardPiece(s, source!.id);
      const j = s.player.discard.findIndex((p) => p.id === target.id);
      need(j >= 0, "Density Control's physical target moved during its cost.");
      s.player.hand.push(s.player.discard.splice(j, 1)[0]);
      ports.queue(s, ...after);
      break;
    }
    case "vision:lane": {
      need(
        visionAbilityOptions(s, e.id, ports).some((o) => o.id === "search"),
        "616 Hickory Branch Lane is unavailable.",
      );
      own(s, e.id)!.exhausted = true;
      const choices = [...s.player.deck, ...s.player.discard].filter(
        androidAlly,
      );
      ports.revealHidden(s);
      if (choices.length)
        ports.choose(
          s,
          "616 Hickory Branch Lane",
          "Choose an actual Android ally in deck or discard.",
          choices.map((p) =>
            option(
              p.id,
              definition(p).name,
              [V("lane-card", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.shufflePlayerDeck(s, after);
      break;
    }
    case "vision:lane-card": {
      const zone = [s.player.deck, s.player.discard].find((z) =>
        z.some((p) => p.id === e.id && androidAlly(p)),
      );
      need(zone, "Choose the actual searched Android ally.");
      s.player.hand.push(
        zone!.splice(
          zone!.findIndex((p) => p.id === e.id),
          1,
        )[0],
      );
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "vision:event": {
      const p: Piece = e.piece,
        action = e.action || visionEventAction(s, p);
      need(
        !visionPlayRestriction(s, p, ports),
        "Vision's event has an unavailable mass form or target.",
      );
      if (p.code === "26011") {
        const targets = ports
          .enemyTargets(s, false)
          .filter(
            (t) =>
              ports.canGiveStatus(s, t.id, "confused") ||
              disruptionAttachments(s, t.id, ports).length,
          );
        need(
          targets.length,
          "Phase Disruption needs an actual eligible enemy.",
        );
        ports.choose(
          s,
          definition(p).name,
          "Choose an enemy to confuse and discard one eligible attachment from.",
          targets.map((t) =>
            option(
              t.id,
              t.label,
              [V("disrupt", { target: t.id, after })],
              t.code,
            ),
          ),
        );
        break;
      }
      const ignore = p.code === "26010",
        targets =
          action === "attack"
            ? ports.enemyTargets(s, true)
            : ports.schemeTargets(s, true, ignore, ignore);
      if (targets.length)
        ports.choose(
          s,
          definition(p).name,
          "Choose a target.",
          targets.map((t) =>
            option(
              t.id,
              t.label,
              [V("event-target", { piece: p, action, target: t.id, after })],
              t.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "vision:event-target": {
      const p: Piece = e.piece,
        attack = e.action === "attack",
        ignore = p.code === "26010";
      const targets = attack
        ? ports.enemyTargets(s, true)
        : ports.schemeTargets(s, true, ignore, ignore);
      need(
        targets.some((t) => t.id === e.target),
        "Vision's target is unavailable.",
      );
      if (attack)
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount: p.code === "26008" ? 7 : 5,
              source: "hero",
              attack: true,
              attackInitiated: true,
              abilitySource: p.id,
              piercing: p.code === "26009",
            }),
          ],
          after,
        );
      else
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: p.code === "26008" ? 5 : 3,
            source: "hero",
            action: true,
            thwartInitiated: true,
            abilitySource: p.id,
            ignoreCrisis: ignore,
            ignorePatrol: ignore,
          }),
          ...after,
        );
      break;
    }
    case "vision:disrupt":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Phase Disruption's enemy is unavailable.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "confused" }),
        V("disrupt-attachment", { target: e.target, after }),
      );
      break;
    case "vision:disrupt-attachment": {
      const choices = disruptionAttachments(s, e.target, ports);
      if (choices.length)
        ports.choose(
          s,
          "Phase Disruption",
          "Discard one attachment with printed Hero Action or Hero Response text.",
          choices.map((p) =>
            option(
              p.id,
              definition(p).name,
              [V("discard-attachment", { id: p.id, target: e.target, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "vision:discard-attachment": {
      const p = disruptionAttachments(s, e.target, ports).find(
        (p) => p.id === e.id,
      );
      need(
        p,
        "Phase Disruption needs an eligible attachment on the chosen enemy.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "vision:mass-increase-pay": {
      const p = (ports.defenseEventSources?.(s) || s.player.hand).find(
        (p) => p.id === e.id && p.code === "26012",
      );
      need(
        p &&
          visionDefenseOptions(s, e.used || [], after, ports).some(
            (o) => o.id === e.id,
          ),
        "Mass Increase requires Vision's actual defense and a payable event.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Mass Increase",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [V("mass-increase")],
              continuation: [
                V("defense-window", {
                  used: [...(e.used || []), p!.id],
                  after,
                }),
              ],
            }),
          ],
        }),
      );
      break;
    }
    case "vision:mass-increase":
      need(
        isDefending(s) && visionMassForm(s) === "dense",
        "Mass Increase requires Vision defending in Dense mass form.",
      );
      ports.preventAllAttackDamage(s);
      ports.afterAttack(s, [
        V("stun-after", {
          target: s.attack!.attacker,
          actorId: s.activePlayerId,
        }),
      ]);
      break;
    case "vision:stun-after":
      if (ports.enemyTargets(s, false).some((t) => t.id === e.target))
        ports.queue(s, E("status", { target: e.target, status: "stunned" }));
      break;
    case "vision:defense-window": {
      const choices = visionDefenseOptions(s, e.used || [], after, ports);
      if (choices.length)
        ports.choose(s, "Vision defense interrupts", "Play Mass Increase?", [
          ...choices,
          option("continue", "Continue", after),
        ]);
      else ports.queue(s, ...after);
      break;
    }
    case "vision:obligation":
      ports.giveObligation(s, e.piece, e.playerId);
      break;
    case "vision:obligation-remove": {
      need(
        visionAbilityOptions(s, e.id, ports).some((o) => o.id === "remove"),
        "Corrupted Programming needs ready Vision in alter-ego form.",
      );
      const p = own(s, e.id, "26028")!;
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: p }));
      break;
    }
    case "vision:reveal-setaside": {
      const zone = s.player.setAside || [],
        i = zone.findIndex((p) => p.id === e.id);
      if (i >= 0) ports.queue(s, E("reveal", { piece: zone.splice(i, 1)[0] }));
      break;
    }
    case "vision:shuffle-nemesis":
      for (const id of e.ids || []) {
        const zone = s.player.setAside || [],
          i = zone.findIndex((p) => p.id === id);
        if (i >= 0) s.encounter.deck.push(zone.splice(i, 1)[0]);
      }
      ports.shuffleEncounter(s);
      break;
    case "vision:unleashed": {
      const zones = [
        s.encounter.deck,
        s.encounter.discard,
        ...playerOrder(s).map(
          (seat) => seatView(s, seat).player.setAside || [],
        ),
      ];
      const choices = zones.flatMap((z) => z.filter(droneEnvironment));
      if (choices.length > 1)
        ports.choose(
          s,
          "Ultron Unleashed",
          "Choose the actual Ultron Drones environment from the searched zones.",
          choices.map((p) =>
            option(
              p.id,
              `${definition(p).name} · ${p.code}`,
              [V("unleashed-environment", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else if (choices.length)
        ports.queue(
          s,
          V("unleashed-environment", { id: choices[0].id, after }),
        );
      else ports.queue(s, V("unleashed-finish", { after }));
      break;
    }
    case "vision:unleashed-environment": {
      const zones = [
        s.encounter.deck,
        s.encounter.discard,
        ...playerOrder(s).map(
          (seat) => seatView(s, seat).player.setAside || [],
        ),
      ];
      const zone = zones.find((z) =>
        z.some((p) => p.id === e.id && droneEnvironment(p)),
      );
      need(zone, "Ultron Unleashed needs the original searched environment.");
      const p = zone!.splice(
        zone!.findIndex((p) => p.id === e.id),
        1,
      )[0];
      ports.putEnvironment(s, p);
      ports.queue(s, V("unleashed-finish", { after }));
      break;
    }
    case "vision:unleashed-finish": {
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...playerOrder(s).map((seat) => E("drone", { actorId: seat.id })),
        ...after,
      );
      break;
    }
    case "vision:relentless":
      if (dronesInPlay(s))
        ports.queue(
          s,
          E("drone", { actorId: s.activePlayerId }),
          E("drone", { actorId: s.activePlayerId }),
          ...after,
        );
      else {
        ports.discardRandomHand(s, 2);
        ports.queue(s, ...after);
      }
      break;
    default:
      throw Error(`Unknown Vision effect: ${e.type}`);
  }
  return true;
}
