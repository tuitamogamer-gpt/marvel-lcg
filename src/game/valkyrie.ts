import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts } from "./ant-man.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const V = (type: string, args: Record<string, unknown> = {}) =>
  E(`valkyrie:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["valk", "valkyrie"].includes(s.heroId);
const definition = (p: Piece) => cards.get(p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const signature = (p: Piece) =>
  definition(p)?.set_code === "valk" && definition(p)?.faction_code === "hero";

export const VALKYRIE_SCRIPT_CODES = [
  "25001a",
  "25001b",
  "25002",
  "25003",
  "25004",
  "25005",
  "25006",
  "25007",
  "25008",
  "25009",
  "25010",
  "25011",
  "25012",
  "25028",
  "25029",
  "25030",
  "25031",
  "25032",
] as const;
export const VALKYRIE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const VALKYRIE_ORIGINAL_SOURCE = "https://hallofheroeslcg.com/valkyrie/";
export const VALKYRIE_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#valk";

export interface ValkyriePorts extends AntManPorts {
  cardCost(s: GameState, p: Piece): number;
  makePiece(s: GameState, code: string): Piece;
  shuffleEncounter(s: GameState): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  canPutMinion(s: GameState, p: Piece): boolean;
  /** Move the selected actual encounter card into play, NOT reveal it. Run
   * ordinary engagement/Quickstrike and entry windows before saved after. */
  putMinion(
    s: GameState,
    id: string,
    playerId: string,
    after: Effect[],
  ): boolean;
  /** Normal native PLAY from setAside: physical cost/discounts, target choice,
   * entry and play windows, cancellation restoring this actual source zone.
   * Death-Glow is not a free put-into-play effect and is not Permanent. */
  playSetAside(s: GameState, id: string, after: Effect[]): void;
  /** Native leave-play cleanup directly into this controller's setAside zone,
   * retaining ID/owner and discarding attached/tucked cards and tokens. Never
   * visit the discard pile or emit a false discard/defeat window. */
  setAsideOwnedPiece(s: GameState, id: string): boolean;
  /** Native declaration restrictions still apply, but readiness is not one of
   * them: Shieldmaiden may declare an already exhausted Valkyrie. */
  canDeclareIdentityDefender(s: GameState, playerId: string): boolean;
  /** Paid Shieldmaiden: replace the defender with this identity, do not exhaust
   * it, use its DEF including Spear and +bonus for this attack, and mark that
   * it defended. Resume native defense/attack windows before saved after. */
  declareIdentityDefender(
    s: GameState,
    playerId: string,
    bonus: number,
    after: Effect[],
  ): void;
  isIdentityTextBlank?(s: GameState): boolean;
}
type TextPorts = Pick<ValkyriePorts, "isTextBlank">;
const textPorts: TextPorts = { isTextBlank };
const count = (s: GameState, code: string, ports: TextPorts) =>
  s.player.inPlay.filter((p) => p.code === code && !ports.isTextBlank(s, p))
    .length;
const heroCount = (s: GameState, code: string, ports: TextPorts) =>
  active(s) && s.player.form === "hero" ? count(s, code, ports) : 0;

/** Unconditional +1 only; the selected enemy supplies the second +1 separately. */
export function valkyrieStats(s: GameState, ports: TextPorts = textPorts) {
  return {
    attack: heroCount(s, "25006", ports),
    thwart: 0,
    defense: heroCount(s, "25005", ports),
  };
}
/** RRG 1.8 p67: Aragorn says YOU, so both bonuses survive alter-ego. */
export function valkyrieHPBonus(
  s: GameState,
  ports: TextPorts = textPorts,
): number {
  return 4 * count(s, "25007", ports);
}
export function valkyrieTraits(
  s: GameState,
  ports: TextPorts = textPorts,
): string[] {
  return count(s, "25007", ports) ? ["Aerial"] : [];
}
function controlledGlow(s: GameState) {
  return s.player.inPlay.find((p) => p.code === "25002" && p.attachedTo);
}
export function valkyrieDeathGlowTarget(s: GameState): string | undefined {
  return s.player.inPlay.find((p) => p.code === "25002" && p.attachedTo)
    ?.attachedTo;
}
export function valkyrieAttackBonusForTarget(
  s: GameState,
  target: string,
  ports: TextPorts = textPorts,
): number {
  return valkyrieDeathGlowTarget(s) === target
    ? heroCount(s, "25006", ports)
    : 0;
}
export function valkyrieDefenseBonusForAttacker(
  s: GameState,
  attacker: string,
  ports: TextPorts = textPorts,
): number {
  return valkyrieDeathGlowTarget(s) === attacker
    ? heroCount(s, "25005", ports)
    : 0;
}
function onIdentity(s: GameState, p: Piece, id = s.activePlayerId) {
  return (
    p.attachedTo === `hero:${id}` ||
    (p.attachedTo === "hero" && id === s.activePlayerId)
  );
}
export function valkyrieCannotBasicAttack(
  s: GameState,
  ports: TextPorts = textPorts,
): boolean {
  return s.attachments.some(
    (p) => p.code === "25032" && onIdentity(s, p) && !ports.isTextBlank(s, p),
  );
}
export function valkyrieCanAttackTarget(
  s: GameState,
  target: string,
  ports: TextPorts = textPorts,
): boolean {
  return !(
    active(s) &&
    s.player.form === "hero" &&
    target === valkyrieDeathGlowTarget(s) &&
    s.player.inPlay.some((p) => p.code === "25028" && !ports.isTextBlank(s, p))
  );
}
export function valkyrieCanDiscardAttachment(
  s: GameState,
  p: Piece,
  ports: TextPorts = textPorts,
): boolean {
  if (
    !s.sideSchemes.some((p) => p.code === "25030" && !ports.isTextBlank(s, p))
  )
    return true;
  return !playerOrder(s).some((seat) => {
    const view = seatView(s, seat);
    return (
      onIdentity(s, p, seat.id) ||
      view.player.inPlay.some(
        (a) => a.id === p.attachedTo && definition(a)?.type_code === "ally",
      )
    );
  });
}

/** Before opening hands/scenario setup, set aside the ORIGINAL owned card.
 * It counts toward the constructed 40..50 cards; the imported starter is 41,
 * leaving 40 draw-pile cards and this one actual set-aside signature. */
export function valkyrieSetup(s: GameState): void {
  if (!active(s) || s.flags.valkyrieSetupComplete) return;
  s.player.setAside ||= [];
  if (!s.player.setAside.some((p) => p.code === "25002")) {
    const zone = [s.player.deck, s.player.hand, s.player.discard].find((z) =>
      z.some((p) => p.code === "25002"),
    );
    need(
      zone,
      "Valkyrie's setup requires her actual Death-Glow signature card.",
    );
    const p = zone!.splice(
      zone!.findIndex((p) => p.code === "25002"),
      1,
    )[0];
    delete p.attachedTo;
    s.player.setAside.push(p);
  }
  s.flags.valkyrieSetupComplete = true;
}
export function valkyrieInitializeNemesis(
  s: GameState,
  ports: Pick<ValkyriePorts, "makePiece">,
): void {
  if (!active(s) || s.flags.valkyrieNemesisSetupComplete) return;
  s.player.setAside ||= [];
  s.player.setAside.push(
    ...["25029", "25030", "25031", "25032", "25032"].map((code) =>
      ports.makePiece(s, code),
    ),
  );
  s.flags.valkyrieNemesisSetupComplete = true;
}
export function valkyrieShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    chosen = zone.filter((p) => ["25029", "25030"].includes(p.code)),
    rest = zone.filter((p) => ["25031", "25032"].includes(p.code));
  return [
    ...chosen.map((p) => V("reveal-setaside", { id: p.id })),
    V("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!chosen.some((p) => p.code === "25029")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}

export function valkyriePlayRestriction(
  s: GameState,
  p: Piece,
  ports: ValkyriePorts,
): string | null {
  const c = definition(p);
  if (
    c?.type_code === "event" &&
    (c.traits || "").split(/\.\s*/).includes("Attack") &&
    valkyrieCannotBasicAttack(s, ports)
  )
    return "Seduced prevents playing Attack events.";
  if (p.code === "25002" && !ports.enemyTargets(s, false).length)
    return "Death-Glow needs an enemy to attach to.";
  if (
    ["25010", "25012"].includes(p.code) &&
    (!active(s) || s.player.form !== "hero")
  )
    return "This Valkyrie event requires hero form.";
  if (p.code === "25009" && s.player.form !== "alter")
    return "Visit Valhalla requires alter-ego form.";
  if (p.code === "25009" && !s.player.discard.some(signature))
    return "Visit Valhalla needs a Valkyrie card in your discard pile.";
  if (
    p.code === "25012" &&
    !s.player.stunned &&
    !ports
      .enemyTargets(s, true)
      .some((t) => valkyrieCanAttackTarget(s, t.id, ports))
  )
    return "Have at Thee! needs a legal attack target.";
  if (p.code === "25011")
    return "Shieldmaiden is played when the enemy with Death-Glow initiates an attack.";
  return null;
}
export function valkyrieCardEntered(_s: GameState, p: Piece): Effect[] {
  return p.code === "25002" ? [V("attach-glow", { id: p.id })] : [];
}
export function valkyrieEvent(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "25009") return [V("visit")];
  if (p.code === "25010") return [V("chooser")];
  if (p.code === "25012") return [V("have-at-thee", { id: p.id })];
  return p.code === "25011" ? [] : null;
}
export function valkyrieAbilityOptions(
  s: GameState,
  id: string,
  ports: ValkyriePorts,
): Option[] {
  if (["hero", "identity"].includes(id)) {
    if (!active(s) || ports.isIdentityTextBlank?.(s)) return [];
    if (
      s.player.form === "alter" &&
      s.player.inPlay.some((p) => p.code === "25002" && p.attachedTo)
    )
      return [
        option(
          "detach-death-glow",
          "Detach Death-Glow and set it aside",
          [V("detach-glow")],
          "25001b",
        ),
      ];
    const p = s.player.setAside?.find((p) => p.code === "25002");
    return s.player.form === "hero" &&
      p &&
      ports.enemyTargets(s, false).length &&
      ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code)
      ? [
          option(
            "play-death-glow",
            "Play Death-Glow from its set-aside area",
            [V("play-glow", { id: p.id })],
            "25001a",
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (
    p?.code === "25003" &&
    s.player.form === "alter" &&
    !p.exhausted &&
    s.player.deck.length &&
    !ports.isTextBlank(s, p)
  )
    return [
      option(
        "annabelle-search",
        "Exhaust Annabelle Riggs · search your top 5 cards",
        [V("annabelle", { id })],
        p.code,
      ),
    ];
  if (
    p?.code === "25028" &&
    s.player.form === "alter" &&
    !ports.isTextBlank(s, p) &&
    ports.canPay(s, 2, ["energy", "mental"], undefined, p.code)
  )
    return [
      option(
        "remove-trouble",
        "Spend energy and mental · remove Trouble in Otherworld",
        [V("remove-payment", { id, code: p.code })],
        p.code,
      ),
    ];
  return [];
}
export function valkyrieAbility(
  s: GameState,
  id: string,
  ports: ValkyriePorts,
  action?: string,
): boolean {
  const options = valkyrieAbilityOptions(s, id, ports);
  if (!options.length) return false;
  const chosen = action
    ? options.find((o) => o.id === action)
    : options.length === 1
      ? options[0]
      : undefined;
  need(!action || chosen, "Valkyrie's action is unavailable.");
  if (chosen) ports.queue(s, ...chosen.effects);
  else ports.choose(s, "Valkyrie", "Choose an action.", options);
  return true;
}
export function valkyrieAttachmentActions(
  s: GameState,
  p: Piece,
  ports: ValkyriePorts,
): Option[] {
  return p.code === "25032" &&
    onIdentity(s, p) &&
    s.player.form === "alter" &&
    !ports.isTextBlank(s, p) &&
    valkyrieCanDiscardAttachment(s, p, ports) &&
    ports.canPay(s, 2, ["energy", "mental"], undefined, p.code)
    ? [
        option(
          "remove-seduced",
          "Spend energy and mental · discard Seduced",
          [V("remove-payment", { id: p.id, code: p.code })],
          p.code,
        ),
      ]
    : [];
}
export function valkyrieAttackInitiationOptions(
  s: GameState,
  attacker: string,
  after: Effect[],
  ports: ValkyriePorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    valkyrieDeathGlowTarget(s) !== attacker ||
    !ports.canDeclareIdentityDefender(s, s.activePlayerId)
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "25011" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      option(
        p.id,
        "Shieldmaiden · defend without exhausting, +2 DEF",
        [
          V("shieldmaiden-pay", {
            id: p.id,
            attacker,
            after,
            actorId: s.activePlayerId,
          }),
        ],
        p.code,
      ),
    );
}

export interface ValkyrieDefeatReceipt {
  enemyId: string;
  glowId: string;
  playerId: string;
  defeatedByValkyrie: boolean;
  attack: boolean;
  responses: { id: string; code: string; playerId: string }[];
}
/** Capture BEFORE forced interrupt/attachment cleanup. The host calls the
 * response only after an ACTUAL defeat, never after a discard or replacement. */
export function valkyrieDefeatReceipt(
  s: GameState,
  enemyId: string,
  context: { identityId?: string; attack: boolean },
  ports: TextPorts = textPorts,
): ValkyrieDefeatReceipt[] {
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat),
      // Valhalla and Flight inspect the attached physical card, even while
      // Death-Glow's own text is blank. Its forced interrupt checks blanking
      // separately when the captured receipt commits.
      glow = controlledGlow(view);
    if (!glow || glow.attachedTo !== enemyId) return [];
    const defeatedByValkyrie =
      active(view) &&
      view.player.form === "hero" &&
      context.identityId === `hero:${seat.id}`;
    return [
      {
        enemyId,
        glowId: glow.id,
        playerId: seat.id,
        defeatedByValkyrie,
        attack: context.attack,
        responses: playerOrder(s).flatMap((controller) => {
          const controllerView = seatView(s, controller);
          return controllerView.player.inPlay
            .filter(
              (p) =>
                (p.code === "25008" ||
                  (p.code === "25004" &&
                    defeatedByValkyrie &&
                    context.attack)) &&
                !ports.isTextBlank(controllerView, p),
            )
            .map((p) => ({ id: p.id, code: p.code, playerId: controller.id }));
        }),
      },
    ];
  });
}
export function valkyrieEnemyDefeatInterrupt(
  s: GameState,
  receipt: ValkyrieDefeatReceipt,
): Effect[] {
  return [
    V("death-glow", {
      receipt,
      actorId: receipt.playerId,
      resumeActorId: s.activePlayerId,
    }),
  ];
}
export function valkyrieEnemyDefeated(
  s: GameState,
  receipt: ValkyrieDefeatReceipt,
): Effect[] {
  return receipt.responses.length
    ? [
        V("defeat-responses", {
          receipt,
          used: [],
          actorId: s.activePlayerId,
          resumeActorId: s.activePlayerId,
        }),
      ]
    : [];
}

function allies(s: GameState) {
  return playerOrder(s).flatMap((seat) =>
    seatView(s, seat)
      .player.inPlay.filter((p) => definition(p)?.type_code === "ally")
      .map((p) => ({ p, playerId: seat.id })),
  );
}
const beguiledControllerKey = (id: string) =>
  `valkyrieBeguiledController:${id}`;
function beguiledController(s: GameState, id: string): string | undefined {
  for (const seat of s.players) {
    const value = seatView(s, seat).flags[beguiledControllerKey(id)];
    if (typeof value === "string") return value;
  }
  return undefined;
}
export function valkyrieBeguiledEnemy(s: GameState, p: Piece): boolean {
  return (
    definition(p)?.type_code === "ally" &&
    s.attachments.some((a) => a.code === "25031" && a.attachedTo === p.id)
  );
}
export function valkyrieEnemyStats(
  s: GameState,
  p: Piece,
): { schemeOverride?: number } {
  return valkyrieBeguiledEnemy(s, p)
    ? { schemeOverride: definition(p).thwart || 0 }
    : {};
}
export function valkyrieEnemyTraits(s: GameState, p: Piece): string[] {
  return valkyrieBeguiledEnemy(s, p) ? ["Enthralled"] : [];
}
export function valkyrieEnemyTextBlank(s: GameState, p: Piece): boolean {
  return valkyrieBeguiledEnemy(s, p);
}
/** On actual attachment removal, restore a surviving original ally. A defeated
 * ally-turned-minion is already gone and must stay in its OWNER'S discard pile. */
export function valkyrieAttachmentDiscarded(
  s: GameState,
  attachment: Piece,
): Effect[] {
  return attachment.code === "25031" && attachment.attachedTo
    ? [
        V("restore-ally", {
          id: attachment.attachedTo,
          playerId: beguiledController(s, attachment.attachedTo),
        }),
      ]
    : [];
}
export function valkyrieEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "25028") {
    const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
    return owner ? [V("obligation", { id: p.id, actorId: owner.id })] : [];
  }
  if (p.code === "25029") return [V("enchantress")];
  if (p.code === "25030") return [];
  if (p.code === "25031") return [V("beguiled", { id: p.id })];
  if (p.code === "25032") return [V("seduced", { id: p.id })];
  return null;
}
export function valkyrieBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["25028", "25029", "25030", "25031", "25032"].includes(p.code)
    ? []
    : null;
}

function chooseTarget(
  s: GameState,
  title: string,
  targets: { id: string; label: string; code?: string }[],
  effect: Effect,
  ports: ValkyriePorts,
) {
  if (!targets.length) return;
  if (targets.length === 1)
    ports.queue(s, { ...effect, target: targets[0].id });
  else
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
function takeActual(zones: Piece[][], id: string): Piece | undefined {
  const zone = zones.find((z) => z.some((p) => p.id === id));
  return zone?.splice(
    zone.findIndex((p) => p.id === id),
    1,
  )[0];
}
const resumeDefeatResponses = (e: Effect, used: string[]) =>
  V("defeat-responses", {
    receipt: e.receipt,
    used,
    after: e.after || [],
    resumeActorId: e.resumeActorId,
    actorId: e.resumeActorId,
  });
export function resolveValkyrieEffect(
  s: GameState,
  e: Effect,
  ports: ValkyriePorts,
): boolean {
  if (!e.type.startsWith("valkyrie:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "valkyrie:play-glow": {
      const p = s.player.setAside?.find(
        (p) => p.id === e.id && p.code === "25002",
      );
      need(
        p &&
          active(s) &&
          s.player.form === "hero" &&
          !ports.isIdentityTextBlank?.(s),
        "Death Perception needs Valkyrie's actual set-aside Death-Glow.",
      );
      ports.playSetAside(s, p!.id, after);
      break;
    }
    case "valkyrie:detach-glow": {
      need(
        active(s) &&
          s.player.form === "alter" &&
          !ports.isIdentityTextBlank?.(s),
        "Not This Day requires Brunnhilde.",
      );
      const p = s.player.inPlay.find((p) => p.code === "25002" && p.attachedTo);
      need(p, "Death-Glow is not attached.");
      ports.setAsideOwnedPiece(s, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "valkyrie:attach-glow": {
      const p = own(s, e.id, "25002");
      if (!p) break;
      chooseTarget(
        s,
        "Death-Glow",
        ports.enemyTargets(s, false),
        V("glow-target", { id: p.id, after }),
        ports,
      );
      break;
    }
    case "valkyrie:glow-target": {
      const p = own(s, e.id, "25002");
      need(
        p && ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Death-Glow requires an actual enemy.",
      );
      p!.attachedTo = e.target;
      ports.queue(s, ...after);
      break;
    }
    case "valkyrie:annabelle": {
      const p = own(s, e.id, "25003");
      need(
        p &&
          s.player.form === "alter" &&
          !p.exhausted &&
          !ports.isTextBlank(s, p),
        "Annabelle Riggs cannot search now.",
      );
      p!.exhausted = true;
      ports.revealHidden(s);
      const found = s.player.deck.slice(0, 5).filter(signature);
      if (found.length)
        ports.choose(
          s,
          "Annabelle Riggs",
          "Choose a Valkyrie card among your top 5.",
          [
            ...found.map((p) =>
              option(
                p.id,
                definition(p).name,
                [
                  V("annabelle-card", {
                    id: p.id,
                    searched: s.player.deck.slice(0, 5).map((p) => p.id),
                    after,
                  }),
                ],
                p.code,
              ),
            ),
            option("none", "Take no card", [V("shuffle-player", { after })]),
          ],
        );
      else ports.shufflePlayerDeck(s, after);
      break;
    }
    case "valkyrie:annabelle-card": {
      const p = s.player.deck.find((p) => p.id === e.id && signature(p));
      need(
        p && e.searched.includes(p.id),
        "Annabelle must take an actual searched Valkyrie card.",
      );
      s.player.hand.push(takeActual([s.player.deck], p!.id)!);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "valkyrie:shuffle-player":
      ports.shufflePlayerDeck(s, after);
      break;
    case "valkyrie:visit": {
      need(s.player.form === "alter", "Visit Valhalla requires alter-ego.");
      const found = s.player.discard.filter(signature);
      if (found.length)
        ports.choose(
          s,
          "Visit Valhalla",
          "Choose an actual Valkyrie card in your discard pile.",
          found.map((p) =>
            option(
              p.id,
              definition(p).name,
              [V("visit-card", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "valkyrie:visit-card": {
      const p = s.player.discard.find((p) => p.id === e.id && signature(p));
      need(p, "Visit Valhalla needs an actual discarded Valkyrie card.");
      s.player.hand.push(takeActual([s.player.discard], p!.id)!);
      ports.queue(s, ...after);
      break;
    }
    case "valkyrie:chooser": {
      need(
        active(s) && s.player.form === "hero",
        "Chooser of the Slain requires Valkyrie.",
      );
      ports.revealHidden(s);
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) =>
          definition(p)?.type_code === "minion" && ports.canPutMinion(s, p),
      );
      if (found.length)
        ports.choose(
          s,
          "Chooser of the Slain",
          "Put a minion into play engaged with you to draw 2 cards.",
          [
            ...found.map((p) =>
              option(
                p.id,
                definition(p).name,
                [V("chooser-minion", { id: p.id, after })],
                p.code,
              ),
            ),
            option("none", "Find no minion", [V("chooser-none", { after })]),
          ],
        );
      else {
        ports.shuffleEncounter(s);
        ports.queue(s, ...after);
      }
      break;
    }
    case "valkyrie:chooser-minion": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) =>
          p.id === e.id &&
          definition(p)?.type_code === "minion" &&
          ports.canPutMinion(s, p),
      );
      need(p, "Chooser of the Slain needs the actual legal minion.");
      const entered = ports.putMinion(s, p!.id, s.activePlayerId, [
        E("draw", { amount: 2, actorId: s.activePlayerId }),
        ...after,
      ]);
      ports.shuffleEncounter(s);
      if (!entered) ports.queue(s, ...after);
      break;
    }
    case "valkyrie:chooser-none":
      ports.shuffleEncounter(s);
      ports.queue(s, ...after);
      break;
    case "valkyrie:have-at-thee": {
      need(
        active(s) && s.player.form === "hero",
        "Have at Thee! requires Valkyrie.",
      );
      if (consumeStatus(s.player, "stunned")) {
        ports.log(s, "Stun replaces Have at Thee!'s attack.");
        ports.queue(s, ...after);
        break;
      }
      chooseTarget(
        s,
        "Have at Thee!",
        ports
          .enemyTargets(s, true)
          .filter((t) => valkyrieCanAttackTarget(s, t.id, ports)),
        V("have-at-thee-target", { id: e.id, after }),
        ports,
      );
      break;
    }
    case "valkyrie:have-at-thee-target": {
      need(
        ports.enemyTargets(s, true).some((t) => t.id === e.target) &&
          valkyrieCanAttackTarget(s, e.target, ports),
        "Have at Thee!'s enemy is unavailable.",
      );
      // Official alteration ruling: snapshot Death-Glow BEFORE any damage or defeat.
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 7,
            source: "hero",
            attack: true,
            attackInitiated: true,
            abilitySource: e.id,
            overkill: valkyrieDeathGlowTarget(s) === e.target,
          }),
          ...after,
        ],
        [],
      );
      break;
    }
    case "valkyrie:shieldmaiden-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "25011");
      need(
        p &&
          valkyrieAttackInitiationOptions(s, e.attacker, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Shieldmaiden is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Shieldmaiden",
          cost: ports.cardCost(s, p!),
          piece: p!,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [
                V("shieldmaiden", {
                  attacker: e.attacker,
                  playerId: s.activePlayerId,
                }),
              ],
              continuation: after,
            }),
          ],
        }),
      );
      break;
    }
    case "valkyrie:shieldmaiden": {
      if (
        s.attack?.attacker === e.attacker &&
        ports.canDeclareIdentityDefender(s, e.playerId)
      )
        ports.declareIdentityDefender(s, e.playerId, 2, after);
      else ports.queue(s, ...after);
      break;
    }
    case "valkyrie:death-glow": {
      const r: ValkyrieDefeatReceipt = e.receipt,
        p = own(s, r.glowId, "25002");
      // The physical source is the commit receipt: duplicate/reloaded effects
      // cannot set it aside or ready the identity a second time.
      const ready =
        p?.attachedTo === r.enemyId &&
        !ports.isTextBlank(s, p) &&
        ports.setAsideOwnedPiece(s, p.id) &&
        r.defeatedByValkyrie;
      ports.queue(
        s,
        ...(ready ? [E("ready", { target: `hero:${r.playerId}` })] : []),
        V("resume", { actorId: e.resumeActorId }),
      );
      break;
    }
    case "valkyrie:defeat-responses": {
      const r: ValkyrieDefeatReceipt = e.receipt,
        used: string[] = e.used || [],
        choices: Option[] = [];
      for (const entry of r.responses) {
        const seat = s.players.find(
          (seat) => seat.id === entry.playerId && !seat.eliminated,
        );
        if (!seat || used.includes(entry.id)) continue;
        const view = seatView(s, seat),
          p = own(view, entry.id, entry.code);
        if (!p || ports.isTextBlank(view, p)) continue;
        if (
          p.code === "25004" &&
          !p.exhausted &&
          r.attack &&
          r.defeatedByValkyrie
        )
          choices.push(
            option(
              p.id,
              "Valhalla · exhaust, draw 1 and heal Valkyrie 1",
              [
                V("valhalla", {
                  id: p.id,
                  receipt: r,
                  used,
                  after,
                  resumeActorId: e.resumeActorId,
                  actorId: entry.playerId,
                }),
              ],
              p.code,
            ),
          );
        if (p.code === "25008" && ports.schemeTargets(view, false).length)
          choices.push(
            option(
              p.id,
              "Flight of the Valkyrior · discard, remove 5 threat",
              [
                V("flight", {
                  id: p.id,
                  receipt: r,
                  used,
                  after,
                  resumeActorId: e.resumeActorId,
                  actorId: entry.playerId,
                }),
              ],
              p.code,
            ),
          );
      }
      if (choices.length)
        ports.choose(
          s,
          "Death-Glow defeat responses",
          "Choose a response. Each physical source can respond once.",
          [
            ...choices,
            option("pass", "Pass remaining responses", [
              V("resume", { actorId: e.resumeActorId, after }),
            ]),
          ],
        );
      else ports.queue(s, V("resume", { actorId: e.resumeActorId, after }));
      break;
    }
    case "valkyrie:valhalla": {
      const p = own(s, e.id, "25004"),
        r: ValkyrieDefeatReceipt = e.receipt;
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          r.attack &&
          r.defeatedByValkyrie &&
          !e.used.includes(p.id),
        "Valhalla cannot respond now.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("draw", { amount: 1 }),
        E("heal", { target: `hero:${r.playerId}`, amount: 1 }),
        resumeDefeatResponses(e, [...e.used, p!.id]),
      );
      break;
    }
    case "valkyrie:flight": {
      const p = own(s, e.id, "25008");
      need(
        p && !ports.isTextBlank(s, p) && !e.used.includes(p.id),
        "Flight of the Valkyrior cannot respond now.",
      );
      const targets = ports.schemeTargets(s, false);
      need(
        targets.length,
        "Flight of the Valkyrior needs a scheme with threat.",
      );
      ports.discardPiece(s, p!.id);
      chooseTarget(
        s,
        "Flight of the Valkyrior",
        targets,
        V("flight-target", {
          sourceId: p!.id,
          receipt: e.receipt,
          used: [...e.used, p!.id],
          after,
          resumeActorId: e.resumeActorId,
        }),
        ports,
      );
      break;
    }
    case "valkyrie:flight-target": {
      if (ports.schemeTargets(s, false).some((t) => t.id === e.target))
        ports.queue(
          s,
          E("thwart", { target: e.target, amount: 5, source: e.sourceId }),
          resumeDefeatResponses(e, e.used),
        );
      else ports.queue(s, resumeDefeatResponses(e, e.used));
      break;
    }
    case "valkyrie:resume":
      ports.queue(s, ...after);
      break;
    case "valkyrie:obligation": {
      need(active(s), "Trouble in Otherworld belongs to Brunnhilde.");
      if (!own(s, e.id, "25028")) {
        const p = takeActual(
          [s.resolving, s.encounter.dealt, s.encounter.discard],
          e.id,
        );
        need(
          p?.code === "25028",
          "Trouble in Otherworld needs its actual revealed card.",
        );
        s.player.inPlay.push(p!);
      }
      break;
    }
    case "valkyrie:remove-payment": {
      const p =
        e.code === "25028"
          ? own(s, e.id, e.code)
          : s.attachments.find(
              (p) => p.id === e.id && p.code === "25032" && onIdentity(s, p),
            );
      need(
        p &&
          s.player.form === "alter" &&
          !ports.isTextBlank(s, p) &&
          (p.code !== "25032" || valkyrieCanDiscardAttachment(s, p, ports)) &&
          ports.canPay(s, 2, ["energy", "mental"], undefined, p.code),
        "This alter-ego attachment action cannot be paid.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: definition(p!).name,
          cost: 2,
          requirements: ["energy", "mental"],
          piece: p,
          targetCode: p!.code,
          abilityCost: true,
          cancelable: true,
          after: [V("remove-condition", { id: p!.id, code: p!.code })],
        }),
      );
      break;
    }
    case "valkyrie:remove-condition": {
      if (e.code === "25028") {
        const p = takeActual([s.player.inPlay], e.id);
        if (p) s.removed.push(p);
      } else {
        const p = s.attachments.find(
          (p) => p.id === e.id && p.code === "25032",
        );
        if (p && valkyrieCanDiscardAttachment(s, p, ports))
          ports.discardPiece(s, p.id);
      }
      ports.queue(s, ...after);
      break;
    }
    case "valkyrie:seduced": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "25032");
      if (p) p.attachedTo = `hero:${s.activePlayerId}`;
      break;
    }
    case "valkyrie:enchantress": {
      ports.revealHidden(s);
      const zones = [
          s.encounter.deck,
          s.encounter.discard,
          ...playerOrder(s).map(
            (seat) => seatView(s, seat).player.setAside || [],
          ),
        ],
        p = zones.flat().find((p) => p.code === "25032");
      if (p) {
        const actual = takeActual(zones, p.id)!;
        actual.attachedTo = `hero:${s.activePlayerId}`;
        s.attachments.push(actual);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "valkyrie:beguiled": {
      const existing = new Set(
          s.attachments
            .filter((p) => p.code === "25031" && p.attachedTo)
            .map((p) => p.attachedTo),
        ),
        available = allies(s).filter(({ p }) => !existing.has(p.id));
      const highest = Math.max(
          -1,
          ...available.map(({ p }) => definition(p).cost || 0),
        ),
        found = available.filter(
          ({ p }) => (definition(p).cost || 0) === highest,
        );
      if (found.length)
        ports.choose(
          s,
          "Beguiled",
          "Choose an eligible ally with the highest printed cost.",
          found.map(({ p, playerId }) =>
            option(
              p.id,
              definition(p).name,
              [V("beguiled-ally", { id: e.id, target: p.id, playerId })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, E("surge", { sourceCode: "25031" }));
      break;
    }
    case "valkyrie:beguiled-ally": {
      const a = s.attachments.find((p) => p.id === e.id && p.code === "25031"),
        seat = s.players.find((p) => p.id === e.playerId),
        view = seat && seatView(s, seat),
        p = view?.player.inPlay.find(
          (p) => p.id === e.target && definition(p)?.type_code === "ally",
        );
      need(
        a &&
          p &&
          !s.attachments.some(
            (a) => a.code === "25031" && a.attachedTo === p.id,
          ),
        "Beguiled needs the actual selected ally.",
      );
      a!.attachedTo = p!.id;
      const actual = takeActual([view!.player.inPlay], p!.id)!;
      view!.flags[beguiledControllerKey(actual.id)] = e.playerId;
      actual.engagedWith = e.playerId;
      s.minions.push(actual);
      break;
    }
    case "valkyrie:restore-ally": {
      const p = s.minions.find(
        (p) => p.id === e.id && definition(p)?.type_code === "ally",
      );
      if (p && valkyrieBeguiledEnemy(s, p)) break;
      const controller =
        e.playerId || beguiledController(s, e.id) || p?.engagedWith;
      for (const seat of s.players)
        delete seatView(s, seat).flags[beguiledControllerKey(e.id)];
      if (!p) break;
      const seat = s.players.find(
        (seat) => seat.id === controller && !seat.eliminated,
      );
      if (!seat) break;
      const actual = takeActual([s.minions], p.id)!;
      delete actual.engagedWith;
      seatView(s, seat).player.inPlay.push(actual);
      break;
    }
    case "valkyrie:reveal-setaside": {
      const p = takeActual([s.player.setAside || []], e.id);
      if (p) ports.queue(s, E("reveal", { piece: p }));
      break;
    }
    case "valkyrie:shuffle-nemesis": {
      const actual = (s.player.setAside || []).filter((p) =>
        e.ids.includes(p.id),
      );
      for (const p of actual)
        s.encounter.deck.push(takeActual([s.player.setAside || []], p.id)!);
      ports.shuffleEncounter(s);
      break;
    }
    default:
      return false;
  }
  return true;
}
