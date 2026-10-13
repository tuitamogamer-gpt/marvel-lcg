import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const S = (type: string, args: Record<string, unknown> = {}) =>
  E(`shadowcat:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "shadowcat";
const definition = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const massCard = (p: Piece) => ["32031a", "32031b"].includes(p.code);
const mass = (s: GameState) =>
  active(s) ? s.player.inPlay.find(massCard) : undefined;
const completeKey = (token: string) => `shadowcatMass:${token}`;
const ignoreKey = (token: string, id: string) =>
  `shadowcatIgnore:${token}:${id}`;
const textPorts = { isTextBlank };
type TextPorts = Pick<ShadowcatPorts, "isTextBlank">;

export type ShadowcatMassForm = "solid" | "phased";
export const SHADOWCAT_SCRIPT_CODES = [
  "32030a",
  "32030b",
  "32031a",
  "32031b",
  "32032",
  "32033",
  "32034",
  "32035",
  "32036",
  "32037",
  "32038",
  "32039",
  "32040",
  "32055",
  "32056",
  "32057",
  "32058",
  "32059",
] as const;
export const SHADOWCAT_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const SHADOWCAT_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/mutant-genesis/";
export const SHADOWCAT_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/";

export interface ShadowcatCompletionReceipt {
  /** Actual identity attack or completed defense, including events. Nested
   * player attacks complete separately before their enclosing enemy attack. */
  token: string;
  playerId: string;
  kind: "attack" | "defense";
  performed: boolean;
  /** Snapshot AFTER the whole ability/attack, before its responses. */
  massForm?: ShadowcatMassForm;
  massId?: string;
  massTextBlank?: boolean;
}
export interface ShadowcatIgnoreReceipt {
  token: string;
  playerId: string;
  kind: "guard" | "patrol" | "crisis";
  /** Exact physical sources whose restriction was bypassed for this actual
   * villain attack/main-scheme thwart. Never infer from the later board. */
  sourceIds: string[];
  performed: boolean;
}
export interface ShadowcatPorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  cardCost(s: GameState, p: Piece): number;
  maxHeroHP?(s: GameState): number;
  /** Actual damage-DEALT receipt for this attack instance. Taking zero damage
   * still qualifies; redirecting/replacing all damage away from the enemy
   * does not. Keep this receipt through the printed attachment clause. */
  wasDamageDealtTo?(
    s: GameState,
    abilitySource: string,
    target: string,
  ): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
  /** Absolute locks only; identity voluntary-flip budget is unrelated. */
  canChangeMassForm?(s: GameState): boolean;
  massFormChanged?(
    s: GameState,
    from: ShadowcatMassForm,
    to: ShadowcatMassForm,
  ): void;
  formResponseOptions?(s: GameState, after: Effect[]): Option[];
  enemyTargets(
    s: GameState,
    attack: boolean,
    ignoreGuard?: boolean,
  ): AntManTarget[];
  schemeTargets(
    s: GameState,
    thwart: boolean,
    ignoreCrisis?: boolean,
    ignorePatrol?: boolean,
  ): AntManTarget[];
  canDiscardAttachment?(s: GameState, p: Piece): boolean;
  defenseEventSources?(s: GameState): Piece[];
  canPlayDefenseEvent?(s: GameState, p: Piece): boolean;
  /** Ordinary paid PLAY of the actual event; invoke shadowcatDefenseEvent as
   * its ability. Resume after cancellation and preserve the attack window. */
  playDefenseEvent(s: GameState, id: string, after: Effect[]): void;
  /** Declare the actual hero defender BEFORE Quick Shift effects resolve.
   * Defending continues until the enemy attack's native completion. */
  declareDefense(s: GameState, eventId: string): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  /** PUT an actual physical minion; do not reveal or resolve Surge. */
  putMinion(s: GameState, p: Piece, playerId: string): void;
  shuffleEncounter(s: GameState): void;
  /** Synchronous native grant, respecting Steady, Stalwart and immunities. */
  giveStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): void;
}

export function shadowcatMassForm(s: GameState): ShadowcatMassForm | undefined {
  const p = mass(s);
  return p ? (p.code === "32031b" ? "phased" : "solid") : undefined;
}
export function shadowcatMassTextBlank(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  const p = mass(s);
  return !!p && ports.isTextBlank(s, p);
}
export function shadowcatLocked(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return s.player.inPlay.some(
    (p) => p.code === "32055" && !ports.isTextBlank(s, p),
  );
}
export function shadowcatCanAttack(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return !shadowcatLocked(s, ports);
}
export const shadowcatCanDefend = shadowcatCanAttack;
export function shadowcatCanChangeMassForm(
  s: GameState,
  ports: Pick<
    ShadowcatPorts,
    "canChangeMassForm" | "canChangeForm" | "isTextBlank"
  >,
): boolean {
  return (
    active(s) &&
    !!mass(s) &&
    !shadowcatLocked(s, ports) &&
    (ports.canChangeMassForm
      ? ports.canChangeMassForm(s)
      : ports.canChangeForm(s))
  );
}
export function shadowcatIgnoresGuardPatrolCrisis(
  s: GameState,
  ports: Pick<ShadowcatPorts, "isIdentityTextBlank"> = {},
): boolean {
  return (
    active(s) &&
    s.player.form === "hero" &&
    shadowcatMassForm(s) === "phased" &&
    !ports.isIdentityTextBlank?.(s)
  );
}
/** This is a prohibition on TAKING all damage while defending, including
 * nonattack boost/interrupt packets; it is not whole-attack prevention. */
export function shadowcatPreventsDamage(
  s: GameState,
  defending: boolean,
  ports: TextPorts = textPorts,
): boolean {
  return (
    active(s) &&
    s.player.form === "hero" &&
    defending &&
    shadowcatMassForm(s) === "phased" &&
    !shadowcatMassTextBlank(s, ports)
  );
}
export function shadowcatContinuousStatus(
  s: GameState,
  status: "stunned" | "confused",
  ports: TextPorts = textPorts,
): boolean {
  return status === "confused"
    ? s.minions.some(
        (p) =>
          p.code === "32056" &&
          (p.engagedWith || s.activePlayerId) === s.activePlayerId &&
          !ports.isTextBlank(s, p),
      )
    : s.attachments.some(
        (p) =>
          p.code === "32059" &&
          ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
          !ports.isTextBlank(s, p),
      );
}
/** RRG1.8 White Queen FAQ: real status cards immediately replenish up to the
 * native limit, and remain when the source leaves. Refresh around status
 * replacement and source entry/leave/blanking/keyword changes. */
export function shadowcatRefreshContinuousStatuses(
  s: GameState,
  ports: Pick<ShadowcatPorts, "isTextBlank" | "canGiveStatus" | "giveStatus">,
): void {
  for (const status of ["stunned", "confused"] as const) {
    if (!shadowcatContinuousStatus(s, status, ports)) continue;
    const target = `hero:${s.activePlayerId}`;
    for (let n = 0; n < 2 && ports.canGiveStatus(s, target, status); n++)
      ports.giveStatus(s, target, status);
  }
}

export function shadowcatInitializeMass(
  s: GameState,
  ports: Pick<ShadowcatPorts, "makePiece">,
): void {
  if (!active(s)) return;
  const zones = [
    s.player.inPlay,
    s.player.hand,
    s.player.deck,
    s.player.discard,
    s.player.setAside || [],
  ];
  const actual = zones.flatMap((z) => z.filter(massCard));
  need(
    actual.length <= 1,
    "Shadowcat must own one physical mass-form upgrade.",
  );
  if (s.player.inPlay.some(massCard)) return;
  const p = actual[0] || {
    ...ports.makePiece(s, "32031a"),
    ownerId: s.activePlayerId,
  };
  for (const zone of zones) {
    const i = zone.findIndex((a) => a.id === p.id);
    if (i >= 0) zone.splice(i, 1);
  }
  p.code = "32031a";
  (s.player.setAside ||= []).push(p);
  s.flags.shadowcatMassInitialized = true;
}
export function shadowcatSetup(
  s: GameState,
  ports: Pick<ShadowcatPorts, "makePiece">,
): Effect[] {
  if (!active(s) || s.flags.shadowcatSetupResolved) return [];
  shadowcatInitializeMass(s, ports);
  const zone = s.player.setAside || [],
    i = zone.findIndex(massCard);
  if (i >= 0) {
    const p = zone.splice(i, 1)[0];
    p.code = "32031a";
    s.player.inPlay.push(p);
  }
  s.flags.shadowcatSetupResolved = true;
  return [];
}
export function shadowcatInitializeNemesis(
  s: GameState,
  ports: Pick<ShadowcatPorts, "makePiece">,
): void {
  if (!active(s) || s.flags.shadowcatNemesisInitialized) return;
  const existing = s.player.setAside;
  // Initialization belongs to new-game setup. A depleted played reserve is
  // authoritative, including old saves which predate this module's flag.
  if (
    !s.flags.nemesis &&
    !s.flags.shadowcatSetupResolved &&
    (existing === undefined ||
      s.phase === "mulligan" ||
      (s.flags.shadowcatMassInitialized && existing.every(massCard)))
  ) {
    const zone = (s.player.setAside ||= []),
      codes = ["32056", "32057", "32058", "32058", "32059"];
    for (const code of new Set(codes)) {
      const count = zone.filter((p) => p.code === code).length,
        expected = codes.filter((c) => c === code).length;
      need(
        count <= expected,
        "Shadowcat's nemesis reserve contains duplicate cards.",
      );
      for (let n = count; n < expected; n++)
        zone.push(ports.makePiece(s, code));
    }
  }
  s.flags.shadowcatNemesisInitialized = true;
}
export function shadowcatMassChanged(
  s: GameState,
  from: ShadowcatMassForm,
  to: ShadowcatMassForm,
): Effect[] {
  return active(s) && from !== to && shadowcatMassForm(s) === to
    ? [S("form-responses", { actorId: s.activePlayerId })]
    : [];
}
export function shadowcatChangeMassForm(
  s: GameState,
  to: ShadowcatMassForm,
  ports: ShadowcatPorts,
): Effect[] {
  need(
    shadowcatCanChangeMassForm(s, ports),
    "Shadowcat cannot change mass form.",
  );
  const from = shadowcatMassForm(s)!;
  if (from === to) return [];
  mass(s)!.code = to === "solid" ? "32031a" : "32031b";
  ports.massFormChanged?.(s, from, to);
  return shadowcatMassChanged(s, from, to);
}
const receiptApplies = (
  s: GameState,
  r: ShadowcatCompletionReceipt,
  ports: ShadowcatPorts,
) =>
  active(s) &&
  r.playerId === s.activePlayerId &&
  r.performed &&
  !r.massTextBlank &&
  !!mass(s) &&
  mass(s)!.id === r.massId &&
  !s.flags[completeKey(r.token)] &&
  !shadowcatMassTextBlank(s, ports) &&
  shadowcatCanChangeMassForm(s, ports);
/** Resolve this mandatory program BEFORE optional completion responses. */
export function shadowcatAttackDefenseCompletion(
  s: GameState,
  r: ShadowcatCompletionReceipt,
  ports: ShadowcatPorts,
): Effect[] {
  return r.massForm === "phased" && receiptApplies(s, r, ports)
    ? [S("mass-complete", { receipt: r, forced: true, actorId: r.playerId })]
    : [];
}
export function shadowcatAttackDefenseOptions(
  s: GameState,
  r: ShadowcatCompletionReceipt,
  after: Effect[],
  ports: ShadowcatPorts,
): Option[] {
  return r.massForm === "solid" &&
    shadowcatMassForm(s) === "solid" &&
    receiptApplies(s, r, ports)
    ? [
        O(
          `shadowcat-mass:${r.token}`,
          "Solid · flip to Phased",
          [S("mass-complete", { receipt: r, after, actorId: r.playerId })],
          "32031a",
        ),
      ]
    : [];
}
const validIgnoredSource = (
  s: GameState,
  r: ShadowcatIgnoreReceipt,
  id: string,
) =>
  r.kind === "crisis"
    ? s.sideSchemes.some((p) => p.id === id)
    : s.minions.some((p) => p.id === id);
export function shadowcatIgnoredKeywordOptions(
  s: GameState,
  r: ShadowcatIgnoreReceipt,
  after: Effect[],
  ports: ShadowcatPorts,
): Option[] {
  if (
    !r.performed ||
    r.playerId !== s.activePlayerId ||
    s.player.form !== "hero"
  )
    return [];
  const code = r.kind === "crisis" ? "32035" : "32034";
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === code &&
        !p.exhausted &&
        !s.flags[ignoreKey(r.token, p.id)] &&
        !ports.isTextBlank(s, p),
    )
    .flatMap((p) =>
      r.sourceIds
        .filter((id) => validIgnoredSource(s, r, id))
        .map((target) =>
          O(
            `${p.id}:${target}`,
            `${definition(p).name} · ${r.kind === "crisis" ? "remove 2 threat" : "deal 2 damage"}`,
            [S("ignored-response", { id: p.id, target, receipt: r, after })],
            code,
          ),
        ),
    );
}

export function shadowcatResourceSources(
  s: GameState,
  targetCode?: string,
  ports: TextPorts = textPorts,
): PaymentSource[] {
  const p = mass(s),
    target = targetCode ? definition(targetCode) : undefined;
  return s.player.form === "hero" &&
    p?.code === "32031a" &&
    !p.exhausted &&
    !ports.isTextBlank(s, p) &&
    target?.type_code === "event" &&
    /\b(Attack|Defense)\b/.test(target.traits || "")
    ? [
        {
          id: p.id,
          code: p.code,
          name: "Solid",
          resources: ["physical"],
          description:
            "Exhaust Solid · generate 1 physical for an Attack or Defense event",
          kind: "ability",
        },
      ]
    : [];
}
export function shadowcatResourceSpent(
  s: GameState,
  id: string,
  targetCode?: string,
  ports: TextPorts = textPorts,
): boolean {
  const p = own(s, id);
  if (!p || !massCard(p)) return false;
  need(
    shadowcatResourceSources(s, targetCode, ports).some((a) => a.id === id),
    "Solid's resource ability is unavailable for this payment.",
  );
  p.exhausted = true;
  return true;
}
export function shadowcatEventAction(
  _s: GameState,
  p: Piece,
): "attack" | "thwart" | undefined {
  return ["32037", "32038"].includes(p.code)
    ? "attack"
    : p.code === "32039"
      ? "thwart"
      : undefined;
}
export function shadowcatAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: ShadowcatPorts,
): AntManTarget[] | null {
  if (p.code !== "32036") return null;
  return s.player.form === "hero"
    ? ports
        .enemyTargets(s, false)
        .filter(
          (t) =>
            !playerOrder(s).some((seat) =>
              seatView(s, seat).player.inPlay.some(
                (u) => u.code === "32036" && u.attachedTo === t.id,
              ),
            ),
        )
    : [];
}
export function shadowcatPlayRestriction(
  s: GameState,
  p: Piece,
  ports?: ShadowcatPorts,
): string | null {
  if (!["32036", "32037", "32038", "32039", "32040"].includes(p.code))
    return null;
  if (s.player.form !== "hero") return "This card requires hero form.";
  if (["32037", "32038"].includes(p.code) && !shadowcatCanAttack(s, ports))
    return "Permanently Phased prevents attacking.";
  if (p.code === "32040" && !shadowcatCanDefend(s, ports))
    return "Permanently Phased prevents defending.";
  if (!ports) return null;
  const ignore = shadowcatIgnoresGuardPatrolCrisis(s, ports);
  if (
    ["32037", "32038"].includes(p.code) &&
    !s.player.stunned &&
    !shadowcatContinuousStatus(s, "stunned", ports) &&
    !ports.enemyTargets(s, true, ignore).length
  )
    return "This attack requires a legal enemy.";
  if (
    p.code === "32039" &&
    !s.player.confused &&
    !shadowcatContinuousStatus(s, "confused", ports) &&
    !ports.schemeTargets(s, true, ignore, ignore).length
  )
    return "Airwalk requires a legal scheme.";
  if (p.code === "32036" && !shadowcatAttachmentTargets(s, p, ports)?.length)
    return "Phased and Confused requires an enemy without another copy.";
  return null;
}
export function shadowcatEvent(_s: GameState, p: Piece): Effect[] | null {
  return ["32037", "32038", "32039"].includes(p.code)
    ? [S("event", { piece: p })]
    : null;
}
export function shadowcatDefenseEvent(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return p.code === "32040" ? [S("quick-shift", { eventId: p.id })] : null;
}
export function shadowcatDefenseOptions(
  s: GameState,
  used: string[],
  after: Effect[],
  ports: ShadowcatPorts,
): Option[] {
  if (s.player.form !== "hero" || !s.attack || !shadowcatCanDefend(s, ports))
    return [];
  return (ports.defenseEventSources?.(s) || s.player.hand)
    .filter(
      (p) =>
        p.code === "32040" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code) &&
        (!ports.canPlayDefenseEvent || ports.canPlayDefenseEvent(s, p)),
    )
    .map((p) =>
      O(
        p.id,
        `Quick Shift · ${shadowcatMassForm(s) === "solid" ? "change to Phased" : "draw 2 cards"}`,
        [S("quick-shift-play", { id: p.id, used, after })],
        p.code,
      ),
    );
}
export function shadowcatCardEntered(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
): Effect[] {
  return p.code === "32032" && !ports.isTextBlank(s, p) && shadowcatMassForm(s)
    ? [
        E("optional", {
          title: "Lockheed",
          text: "Resolve Lockheed's entry response?",
          effects: [S("lockheed", { id: p.id })],
        }),
      ]
    : [];
}
export function shadowcatAbilityOptions(
  s: GameState,
  id: string,
  ports: ShadowcatPorts,
): Option[] {
  if (["hero", "identity"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      !ports.isIdentityTextBlank?.(s) &&
      s.flags.shadowcatPhaseControlRound !== s.round &&
      shadowcatCanChangeMassForm(s, ports)
      ? [
          O(
            "phase-control",
            "Phase Control · flip mass form",
            [S("phase-control")],
            "32030b",
          ),
        ]
      : [];
  const p = own(s, id) || s.attachments.find((a) => a.id === id);
  if (!p || ports.isTextBlank(s, p)) return [];
  if (
    p.code === "32033" &&
    s.player.form === "alter" &&
    !p.exhausted &&
    shadowcatMassForm(s) &&
    (shadowcatMassForm(s) === "phased" ||
      s.player.hp < (ports.maxHeroHP?.(s) ?? 9))
  )
    return [
      O(
        "room",
        "Exhaust Kitty's Room · heal 2 or draw 1",
        [S("room", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "32055" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted
  )
    return [
      O(
        "remove",
        "Exhaust Kitty Pryde · remove Permanently Phased",
        [S("obligation-remove", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "32059" &&
    ports.canPay(s, 2, ["mental", "mental"], undefined, p.code)
  )
    return [
      O(
        "remove",
        "Spend 2 mental · discard Telepathic Restraint",
        [S("restraint-pay", { id })],
        p.code,
      ),
    ];
  return [];
}
export function shadowcatAbility(
  s: GameState,
  id: string,
  ports: ShadowcatPorts,
  action?: string,
): boolean {
  const opts = shadowcatAbilityOptions(s, id, ports);
  if (!opts.length) return false;
  const chosen = action
    ? opts.find((o) => o.id === action)
    : opts.length === 1
      ? opts[0]
      : undefined;
  if (chosen) ports.queue(s, ...chosen.effects);
  else {
    need(!action, "Shadowcat's action is unavailable.");
    ports.choose(s, "Shadowcat", "Choose an action.", opts);
  }
  return true;
}
/** Forced cancellation REPLACES the attack, including while enemy is Stunned.
 * The host chooses ordinary simultaneous replacement priority; commit only
 * the chosen replacement, leaving other replacement sources untouched. */
export function shadowcatEnemyAttackReplacement(
  s: GameState,
  enemyId: string,
  ports: TextPorts = textPorts,
): Effect[] | null {
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat),
      p = view.player.inPlay.find(
        (a) =>
          a.code === "32036" &&
          a.attachedTo === enemyId &&
          !ports.isTextBlank(view, a),
      );
    if (p)
      return [S("phased-confused", { id: p.id, enemyId, actorId: seat.id })];
  }
  return null;
}
export function shadowcatShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    minion = zone.find((p) => p.code === "32056"),
    scheme = zone.find((p) => p.code === "32057"),
    rest = zone.filter((p) => ["32058", "32059"].includes(p.code));
  return [
    ...[minion, scheme]
      .filter((p): p is Piece => !!p)
      .map((p) => S("reveal-setaside", { id: p.id })),
    S("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!minion ? [E("surge", { sourceCode: "01190" })] : []),
  ];
}
export function shadowcatEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "32055": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [S("obligation", { piece: p, playerId: owner.id })] : [];
    }
    case "32059":
      return [S("restraint", { piece: p, playerId: s.activePlayerId })];
    case "32056":
    case "32057":
    case "32058":
      return [];
    default:
      return null;
  }
}
export function shadowcatBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "32056")
    return [
      E("status", { target: `hero:${s.activePlayerId}`, status: "confused" }),
    ];
  if (p.code === "32058")
    return [S("pawn-boost", { pieceId: p.id, playerId: s.activePlayerId })];
  return ["32055", "32057", "32059"].includes(p.code) ? [] : null;
}
export function shadowcatSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId = s.activePlayerId,
  ports: TextPorts = textPorts,
): Effect[] {
  return p.code === "32057" && !ports.isTextBlank(s, p)
    ? [S("hellfire-search", { actorId: playerId, playerId })]
    : [];
}
const take = (zones: Piece[][], id: string): Piece | undefined => {
  for (const z of zones) {
    const i = z.findIndex((p) => p.id === id);
    if (i >= 0) return z.splice(i, 1)[0];
  }
};
const pawnZones = (s: GameState) => [
  s.encounter.deck,
  s.encounter.discard,
  ...playerOrder(s).map((seat) => seatView(s, seat).player.setAside || []),
];
const eligibleAttachments = (
  s: GameState,
  target: string,
  ports: ShadowcatPorts,
) =>
  s.attachments.filter(
    (p) =>
      p.attachedTo === target &&
      definition(p)?.type_code === "attachment" &&
      /\bHero\s+(Action|Response)\b/.test(
        (definition(p)?.text || "").replace(/<[^>]*>/g, ""),
      ) &&
      (!ports.canDiscardAttachment || ports.canDiscardAttachment(s, p)),
  );

export function resolveShadowcatEffect(
  s: GameState,
  e: Effect,
  ports: ShadowcatPorts,
): boolean {
  if (!e.type.startsWith("shadowcat:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "shadowcat:ignored-window": {
      const receipts: ShadowcatIgnoreReceipt[] = e.receipts || [];
      const resume = S("ignored-window", { receipts, after });
      const choices = receipts.flatMap((r) =>
        shadowcatIgnoredKeywordOptions(s, r, [resume], ports),
      );
      if (choices.length)
        ports.choose(
          s,
          "Shadowcat · ignored restrictions",
          "Resolve a response to an actual ignored restriction?",
          [...choices, O("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:phase-control":
      need(
        shadowcatAbilityOptions(s, "hero", ports).some(
          (o) => o.id === "phase-control",
        ),
        "Phase Control is unavailable.",
      );
      s.flags.shadowcatPhaseControlRound = s.round;
      ports.queue(
        s,
        ...shadowcatChangeMassForm(
          s,
          shadowcatMassForm(s) === "solid" ? "phased" : "solid",
          ports,
        ),
        ...after,
      );
      break;
    case "shadowcat:form-responses": {
      const opts =
        ports.formResponseOptions?.(s, [S("form-responses", { after })]) || [];
      if (opts.length)
        ports.choose(
          s,
          "Shadowcat · form responses",
          "Resolve a response to changing form?",
          [...opts, O("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:mass-complete": {
      const r: ShadowcatCompletionReceipt = e.receipt;
      if (
        receiptApplies(s, r, ports) &&
        (e.forced || shadowcatAttackDefenseOptions(s, r, [], ports).length)
      ) {
        s.flags[completeKey(r.token)] = true;
        ports.queue(
          s,
          ...shadowcatChangeMassForm(
            s,
            shadowcatMassForm(s) === "solid" ? "phased" : "solid",
            ports,
          ),
          ...after,
        );
      } else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:ignored-response": {
      const r: ShadowcatIgnoreReceipt = e.receipt;
      need(
        shadowcatIgnoredKeywordOptions(s, r, [], ports).some(
          (o) => o.id === `${e.id}:${e.target}`,
        ),
        "This response requires the actual ignored source and ready upgrade.",
      );
      own(s, e.id)!.exhausted = true;
      s.flags[ignoreKey(r.token, e.id)] = true;
      ports.queue(
        s,
        r.kind === "crisis"
          ? E("thwart", {
              target: e.target,
              amount: 2,
              source: "hero",
              action: false,
              abilitySource: e.id,
            })
          : E("damage", {
              target: e.target,
              amount: 2,
              source: "hero",
              abilitySource: e.id,
            }),
        ...after,
      );
      break;
    }
    case "shadowcat:room": {
      need(
        shadowcatAbilityOptions(s, e.id, ports).some((o) => o.id === "room"),
        "Kitty's Room is unavailable.",
      );
      own(s, e.id)!.exhausted = true;
      ports.queue(
        s,
        shadowcatMassForm(s) === "solid"
          ? E("heal", { target: "hero", amount: 2 })
          : E("draw", { amount: 1 }),
        ...after,
      );
      break;
    }
    case "shadowcat:lockheed": {
      const p = own(s, e.id, "32032");
      if (!p || ports.isTextBlank(s, p)) {
        ports.queue(s, ...after);
        break;
      }
      const solid = shadowcatMassForm(s) === "solid",
        targets = solid
          ? ports.enemyTargets(s, false)
          : ports.schemeTargets(s, false);
      if (targets.length)
        ports.choose(
          s,
          "Lockheed",
          "Choose a target.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [S("lockheed-target", { id: p.id, target: t.id, solid, after })],
              t.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:lockheed-target": {
      const targets = e.solid
        ? ports.enemyTargets(s, false)
        : ports.schemeTargets(s, false);
      need(
        targets.some((t) => t.id === e.target),
        "Lockheed's target is unavailable.",
      );
      ports.queue(
        s,
        e.solid
          ? E("damage", {
              target: e.target,
              amount: 2,
              source: e.id,
              abilitySource: e.id,
            })
          : E("thwart", {
              target: e.target,
              amount: 2,
              source: e.id,
              action: false,
              ignoreCrisis: true,
              ignorePatrol: true,
              abilitySource: e.id,
            }),
        ...after,
      );
      break;
    }
    case "shadowcat:event": {
      const p: Piece = e.piece;
      need(
        !shadowcatPlayRestriction(s, p, ports),
        "Shadowcat's event is unavailable.",
      );
      const attack = shadowcatEventAction(s, p) === "attack",
        ignore = shadowcatIgnoresGuardPatrolCrisis(s, ports),
        targets = attack
          ? ports.enemyTargets(s, true, ignore)
          : ports.schemeTargets(s, true, ignore, ignore);
      if (targets.length)
        ports.choose(
          s,
          definition(p).name,
          "Choose a target.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [S("event-target", { piece: p, target: t.id, after })],
              t.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:event-target": {
      const p: Piece = e.piece,
        attack = shadowcatEventAction(s, p) === "attack",
        ignore = shadowcatIgnoresGuardPatrolCrisis(s, ports),
        targets = attack
          ? ports.enemyTargets(s, true, ignore)
          : ports.schemeTargets(s, true, ignore, ignore);
      need(
        targets.some((t) => t.id === e.target),
        "Shadowcat's target is unavailable.",
      );
      if (attack)
        ports.attackProgram(
          s,
          [
            E("damage", {
              target: e.target,
              amount: p.code === "32037" ? 3 : 6,
              source: "hero",
              attack: true,
              attackInitiated: true,
              abilitySource: p.id,
              ignoreGuard: ignore,
            }),
            ...(p.code === "32037"
              ? [E("ready", { target: "hero" })]
              : [
                  S("strike-attachment", {
                    target: e.target,
                    abilitySource: p.id,
                  }),
                ]),
          ],
          after,
        );
      else
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: shadowcatMassForm(s) === "phased" ? 4 : 2,
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
    case "shadowcat:strike-attachment": {
      const dealt =
        !ports.wasDamageDealtTo ||
        ports.wasDamageDealtTo(s, e.abilitySource, e.target);
      const choices =
        dealt && shadowcatMassForm(s) === "phased"
          ? eligibleAttachments(s, e.target, ports)
          : [];
      if (choices.length)
        ports.choose(
          s,
          "Phased Strike",
          "You may discard an eligible attachment from that enemy.",
          [
            ...choices.map((p) =>
              O(
                p.id,
                definition(p).name,
                [S("strike-discard", { id: p.id, target: e.target, after })],
                p.code,
              ),
            ),
            O("continue", "Continue", after),
          ],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "shadowcat:strike-discard":
      need(
        eligibleAttachments(s, e.target, ports).some((p) => p.id === e.id),
        "Phased Strike requires the selected attachment on that enemy.",
      );
      ports.discardPiece(s, e.id);
      ports.queue(s, ...after);
      break;
    case "shadowcat:quick-shift-play":
      need(
        shadowcatDefenseOptions(s, e.used || [], [], ports).some(
          (o) => o.id === e.id,
        ),
        "Quick Shift is unavailable in this attack window.",
      );
      ports.playDefenseEvent(s, e.id, after);
      break;
    case "shadowcat:quick-shift": {
      need(
        s.player.form === "hero" && !!s.attack && shadowcatCanDefend(s, ports),
        "Quick Shift requires a legal enemy attack.",
      );
      ports.declareDefense(s, e.eventId);
      const form = shadowcatMassForm(s);
      if (form === "solid" && shadowcatCanChangeMassForm(s, ports))
        ports.queue(
          s,
          ...shadowcatChangeMassForm(s, "phased", ports),
          ...after,
        );
      else
        ports.queue(
          s,
          ...(form === "phased" ? [E("draw", { amount: 2 })] : []),
          ...after,
        );
      break;
    }
    case "shadowcat:phased-confused": {
      const p = own(s, e.id, "32036");
      need(
        p && p.attachedTo === e.enemyId && !ports.isTextBlank(s, p),
        "Phased and Confused requires its actual active upgrade.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("status", { target: e.enemyId, status: "confused" }),
        ...after,
      );
      break;
    }
    case "shadowcat:obligation": {
      const view = seatView(s, e.playerId),
        p = mass(view);
      // Printed instructions resolve in order: flip before the obligation's
      // constant cannot-change rule becomes active in its recipient's area.
      if (p && p.code !== "32031b" && shadowcatCanChangeMassForm(view, ports)) {
        const from = shadowcatMassForm(view)!;
        p.code = "32031b";
        ports.massFormChanged?.(view, from, "phased");
        ports.queue(
          s,
          ...shadowcatMassChanged(view, from, "phased").map((a) => ({
            ...a,
            actorId: e.playerId,
          })),
          ...after,
        );
      } else ports.queue(s, ...after);
      ports.giveObligation(s, e.piece, e.playerId);
      break;
    }
    case "shadowcat:obligation-remove": {
      need(
        shadowcatAbilityOptions(s, e.id, ports).some((o) => o.id === "remove"),
        "Permanently Phased needs ready Kitty Pryde in alter ego.",
      );
      const p = own(s, e.id, "32055")!;
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: p }), ...after);
      break;
    }
    case "shadowcat:restraint": {
      const p: Piece = e.piece;
      p.attachedTo = `hero:${e.playerId}`;
      if (!s.attachments.some((a) => a.id === p.id)) s.attachments.push(p);
      shadowcatRefreshContinuousStatuses(seatView(s, e.playerId), ports);
      ports.queue(s, ...after);
      break;
    }
    case "shadowcat:restraint-pay": {
      const p = s.attachments.find((a) => a.id === e.id && a.code === "32059");
      need(
        p &&
          shadowcatAbilityOptions(s, e.id, ports).some(
            (o) => o.id === "remove",
          ),
        "Telepathic Restraint requires its actual attachment and payable mental resources.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Telepathic Restraint",
          cost: 2,
          requirements: ["mental", "mental"],
          paymentTarget: p!.code,
          abilityCost: true,
          cancelable: true,
          after: [S("restraint-discard", { id: p!.id, after })],
        }),
      );
      break;
    }
    case "shadowcat:restraint-discard": {
      const p = s.attachments.find((a) => a.id === e.id && a.code === "32059");
      need(p, "Telepathic Restraint's actual paid attachment is unavailable.");
      ports.discardPiece(s, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "shadowcat:reveal-setaside": {
      const p = take([s.player.setAside || []], e.id);
      if (p) ports.queue(s, E("reveal", { piece: p }));
      break;
    }
    case "shadowcat:shuffle-nemesis":
      for (const id of e.ids || []) {
        const p = take([s.player.setAside || []], id);
        if (p) s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    case "shadowcat:pawn-boost": {
      const zones = [
        s.encounter.discard,
        s.resolving,
        s.encounter.storedBoosts || [],
        s.attack?.pendingBoosts || [],
        s.scheming?.pendingBoosts || [],
      ];
      const p = take(zones, e.pieceId);
      need(
        p?.code === "32058",
        "Hellfire Pawn's boost must move the actual boost card.",
      );
      ports.putMinion(s, p!, e.playerId);
      ports.queue(s, ...after);
      break;
    }
    case "shadowcat:hellfire-search": {
      ports.revealHidden(s);
      const choices = pawnZones(s).flatMap((z) =>
        z.filter((p) => p.code === "32058"),
      );
      if (choices.length)
        ports.choose(
          s,
          "The Hellfire Club",
          "Choose an actual Hellfire Pawn from the searched zones.",
          choices.map((p) =>
            O(
              p.id,
              definition(p).name,
              [S("hellfire-pawn", { id: p.id, playerId: e.playerId, after })],
              p.code,
            ),
          ),
        );
      else {
        ports.shuffleEncounter(s);
        ports.queue(s, ...after);
      }
      break;
    }
    case "shadowcat:hellfire-pawn": {
      const p = take(pawnZones(s), e.id);
      need(
        p?.code === "32058",
        "The Hellfire Club requires the actual searched Hellfire Pawn.",
      );
      ports.putMinion(s, p!, e.playerId);
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    }
    default:
      throw Error(`Unknown Shadowcat effect: ${e.type}`);
  }
  return true;
}
