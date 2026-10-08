import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManPorts } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const N = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`nebula:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["nebu", "nebula"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const technique = (p: Piece) =>
  cards.get(p.code)?.type_code === "upgrade" &&
  (cards.get(p.code)?.traits || "").split(/\.\s*/).includes("Technique");
const techniques = (s: GameState) => s.player.inPlay.filter(technique);

export const NEBULA_SCRIPT_CODES = [
  "22001a",
  "22001b",
  "22002",
  "22003",
  "22004",
  "22005",
  "22006",
  "22007",
  "22008",
  "22009",
  "22010",
  "22027",
  "22028",
  "22029",
  "22030",
  "22031",
] as const;
export const NEBULA_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const NEBULA_ORIGINAL_SOURCE = "https://hallofheroeslcg.com/nebula/";
export const NEBULA_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#nebula";

export interface NebulaAttackSource {
  kind: "enemy" | "hero" | "ally";
  id: string;
  playerId?: string;
  code: string;
}
export interface NebulaPorts extends AntManPorts {
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
  /** Discard from the ORIGINAL deck until a Technique is discarded. Perform
   * normal deck-exhaustion handling; never mill the newly reset deck.
   * Queue continuation with its actual found ID (or no ID) AFTER any deck
   * exhaustion windows. No callbacks: continuation is a saved Effect. */
  discardUntilTechnique(s: GameState, continuation: Effect): void;
  /** Move the actual discarded Technique into play, retaining its ID/owner.
   * If it was the last deck card, immediate reset may have put it back into
   * that player's deck: retrieve the SAME physical card there. Run ordinary
   * entry handling before after. This is NOT playing it. */
  putDiscardedTechnique(s: GameState, id: string, after: Effect[]): boolean;
  canDiscardUpgrade(s: GameState, p: Piece): boolean;
  /** A native attack, not direct damage. Player Gamora does not exhaust;
   * allow attack responses and actual ally consequential damage. Queue the
   * continuation with performed:boolean AFTER the actual attack. Return false
   * if startup cannot initiate an attack. Stun/cancel must report performed:false
   * through the continuation, rather than silently skipping it. */
  gamoraAttack(
    s: GameState,
    source: NebulaAttackSource,
    playerId: string,
    continuation: Effect,
  ): boolean;
  isIdentityTextBlank?(s: GameState): boolean;
}
type TextPorts = Pick<NebulaPorts, "isTextBlank">;
const textPorts: TextPorts = { isTextBlank };
const count = (s: GameState, code: string, ports: TextPorts = textPorts) =>
  active(s) && s.player.form === "hero"
    ? s.player.inPlay.filter((p) => p.code === code && !ports.isTextBlank(s, p))
        .length
    : 0;

/** Technique bonuses only. Apply named-character modifiers separately to all
 * heroes, allies and enemies so Self-Preservation cannot count twice. */
export function nebulaStats(s: GameState, ports: TextPorts = textPorts) {
  const bonus = count(s, "22006", ports);
  return { attack: bonus, thwart: bonus, defense: 0 };
}
export function nebulaAttackKeywords(
  s: GameState,
  ports: TextPorts = textPorts,
) {
  const cutthroat = count(s, "22004", ports) > 0;
  return {
    piercing: cutthroat,
    overkill: cutthroat,
    stalwart: count(s, "22006", ports) > 0,
  };
}
export function nebulaIgnoresRestrictions(
  s: GameState,
  ports: TextPorts = textPorts,
) {
  const ignores = count(s, "22005", ports) > 0;
  return { guard: ignores, patrol: ignores, crisis: ignores };
}
export function nebulaRetaliate(
  s: GameState,
  ports: TextPorts = textPorts,
): number {
  return count(s, "22007", ports);
}
/** Only damage TAKEN by Nebula from attacks; do not reduce non-attack damage,
 * an ally's damage, or the same attack twice. Apply before Tough/prevention. */
export function nebulaAttackDamageReduction(
  s: GameState,
  ports: TextPorts = textPorts,
): number {
  return count(s, "22008", ports);
}
export function nebulaNamedCharacterModifiers(
  s: GameState,
  name: string,
  ports: TextPorts = textPorts,
) {
  const schemes = s.sideSchemes.filter(
    (p) => p.code === "22029" && !ports.isTextBlank(s, p),
  ).length;
  return {
    attack: name === "Nebula" ? -schemes : name === "Gamora" ? schemes : 0,
    thwart: name === "Nebula" ? -schemes : 0,
    defense: name === "Nebula" ? -schemes : 0,
    piercing: name === "Gamora" && schemes > 0,
  };
}
export function nebulaResourceSources(
  s: GameState,
  ports: TextPorts = textPorts,
): PaymentSource[] {
  return s.player.inPlay
    .filter(
      (p) => p.code === "22003" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Nebula’s Ship",
      resources: ["wild"],
      description: "Exhaust Nebula’s Ship · generate 1 wild resource",
      kind: "ability",
    }));
}
export function nebulaResourceSpent(
  s: GameState,
  id: string,
  ports: TextPorts = textPorts,
): boolean {
  const p = own(s, id, "22003");
  if (!p) return false;
  need(
    !p.exhausted && !ports.isTextBlank(s, p),
    "Nebula’s Ship is unavailable.",
  );
  p.exhausted = true;
  return true;
}

/** Capture exactly the Techniques controlled when the forced response starts.
 * Successful Specials stay in play until ALL captured Specials finish. */
export function nebulaTurnBegan(
  s: GameState,
  playerId = s.turnPlayerId,
  ports?: Pick<NebulaPorts, "isIdentityTextBlank">,
): Effect[] {
  if (
    !active(s) ||
    s.activePlayerId !== playerId ||
    s.player.form !== "hero" ||
    ports?.isIdentityTextBlank?.(s)
  )
    return [];
  const ids = techniques(s).map((p) => p.id);
  return ids.length
    ? [
        N("protocols", {
          remaining: ids,
          resolved: [],
          actorId: s.activePlayerId,
        }),
      ]
    : [];
}
/** Call only after PLAY, never after Combat Ready/other put-into-play effects. */
export function nebulaCardPlayed(
  s: GameState,
  p: Piece,
  ports?: Pick<NebulaPorts, "isIdentityTextBlank">,
): Effect[] {
  return active(s) &&
    s.player.form === "alter" &&
    technique(p) &&
    !ports?.isIdentityTextBlank?.(s) &&
    s.flags.nebulaCyberneticRound !== s.round
    ? [
        E("optional", {
          title: "Cybernetic Upgrades",
          text: "Draw 2 cards after playing a Technique?",
          effects: [N("cybernetic", { actorId: s.activePlayerId })],
        }),
      ]
    : [];
}
export function nebulaAllyPlayed(
  s: GameState,
  p: Piece,
  ports: NebulaPorts,
): Effect[] | null {
  return p.code === "22002" &&
    !ports.isTextBlank(s, p) &&
    techniques(s).some((t) => nebulaSpecialAvailable(s, t, ports))
    ? [
        E("optional", {
          title: "Gamora",
          text: "Resolve a controlled Technique’s Special?",
          effects: [N("gamora-special", { actorId: s.activePlayerId })],
        }),
      ]
    : p.code === "22002"
      ? []
      : null;
}
export function nebulaPlayRestriction(
  s: GameState,
  p: Piece,
  ports: NebulaPorts,
): string | null {
  if (p.code === "22009" && s.player.form !== "alter")
    return "Combat Ready requires alter-ego form.";
  if (p.code === "22010" && s.player.form !== "hero")
    return "Lethal Intent requires hero form.";
  if (
    p.code === "22009" &&
    !s.player.deck.length &&
    !s.player.discard.some(technique)
  )
    return "Combat Ready has no cards to affect.";
  if (
    p.code === "22010" &&
    !techniques(s).some((t) => nebulaSpecialAvailable(s, t, ports))
  )
    return "Lethal Intent has no Technique Special to resolve.";
  return null;
}
export function nebulaEvent(
  _s: GameState,
  p: Piece,
  paidX = 0,
): Effect[] | null {
  if (p.code === "22009") return [N("combat-ready")];
  if (p.code === "22010") {
    need(
      Number.isInteger(paidX) && paidX >= 0,
      "Lethal Intent requires a nonnegative paid X.",
    );
    return [N("lethal-intent", { limit: paidX })];
  }
  return null;
}
export function nebulaSpecialAvailable(
  s: GameState,
  p: Piece,
  ports: NebulaPorts,
): boolean {
  if (!own(s, p.id) || !technique(p) || ports.isTextBlank(s, p)) return false;
  switch (p.code) {
    case "22004":
      return !!s.player.confused || ports.schemeTargets(s, true).length > 0;
    case "22005":
      return ports
        .enemyTargets(s, false)
        .some(
          (t) =>
            ports.canGiveStatus(s, t.id, "stunned") ||
            ports.canGiveStatus(s, t.id, "confused"),
        );
    case "22006":
      return ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough");
    case "22007":
      return !!s.player.stunned || ports.enemyTargets(s, true).length > 0;
    case "22008":
      return s.encounter.deck.length > 0;
    default:
      return false;
  }
}
export function nebulaMinionWillEnter(
  s: GameState,
  p: Piece,
  ports: NebulaPorts,
): void {
  if (p.code !== "22028" || ports.isTextBlank(s, p)) return;
  for (const ally of allInPlay(s).filter(
    (a) =>
      cards.get(a.code)?.type_code === "ally" &&
      cards.get(a.code)?.name === "Gamora",
  ))
    ports.discardPiece(s, ally.id);
}
export function nebulaGamoraAttackEnded(
  s: GameState,
  source: Piece,
  playerId: string,
  identityDamageTaken: number,
  ports: NebulaPorts,
): Effect[] {
  if (
    source.code !== "22028" ||
    !s.minions.some((p) => p.id === source.id && p.code === "22028") ||
    !playerOrder(s).some((seat) => seat.id === playerId) ||
    identityDamageTaken <= 0 ||
    ports.isTextBlank(s, source)
  )
    return [];
  return [N("gamora-discard", { actorId: playerId })];
}
function upgrades(s: GameState, ports: NebulaPorts): Piece[] {
  return s.player.inPlay.filter(
    (p) =>
      cards.get(p.code)?.type_code === "upgrade" &&
      ports.canDiscardUpgrade(s, p),
  );
}
export function nebulaAttachmentActions(
  s: GameState,
  p: Piece,
  ports: NebulaPorts,
): Option[] {
  return p.code === "22030" &&
    s.player.form === "hero" &&
    !ports.isTextBlank(s, p) &&
    upgrades(s, ports).length
    ? [
        option(
          "lethal-weapon",
          "Discard an upgrade · discard Lethal Weapon",
          [N("remove-weapon", { id: p.id })],
          p.code,
        ),
      ]
    : [];
}
function gamoras(s: GameState, requireHeroForm = true): NebulaAttackSource[] {
  const enemies = s.minions
    .filter((p) => cards.get(p.code)?.name === "Gamora")
    .map((p): NebulaAttackSource => ({
      kind: "enemy",
      id: p.id,
      code: p.code,
    }));
  const heroes = playerOrder(s)
    .filter(
      (seat) =>
        ["gam", "gamora"].includes(seat.heroId) &&
        (!requireHeroForm || seatView(s, seat).player.form === "hero"),
    )
    .map((seat): NebulaAttackSource => ({
      kind: "hero",
      id: `hero:${seat.id}`,
      playerId: seat.id,
      code: seatView(s, seat).player.form === "hero" ? "18001a" : "18001b",
    }));
  const allies = playerOrder(s).flatMap((seat) =>
    seatView(s, seat)
      .player.inPlay.filter(
        (p) =>
          cards.get(p.code)?.type_code === "ally" &&
          cards.get(p.code)?.name === "Gamora",
      )
      .map((p): NebulaAttackSource => ({
        kind: "ally",
        id: p.id,
        playerId: seat.id,
        code: p.code,
      })),
  );
  return [...enemies, ...heroes, ...allies];
}
export function nebulaEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "22027": {
      const seat = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return seat ? [N("obligation", { piece: p, actorId: seat.id })] : [];
    }
    case "22028":
    case "22029":
      return [];
    case "22030":
      return [N("weapon", { id: p.id })];
    case "22031":
      return [N("old-rivals", { playerId: s.activePlayerId })];
    default:
      return null;
  }
}
export function nebulaBoost(_s: GameState, p: Piece): Effect[] | null {
  return ["22027", "22028", "22029", "22030", "22031"].includes(p.code)
    ? []
    : null;
}

const continueWith = (s: GameState, effects: Effect[], ports: NebulaPorts) =>
  ports.queue(s, ...effects);
function special(
  s: GameState,
  p: Piece | undefined,
  success: Effect[],
  failure: Effect[],
  ports: NebulaPorts,
): void {
  if (!p || !nebulaSpecialAvailable(s, p, ports)) {
    continueWith(s, failure, ports);
    return;
  }
  if (
    (p.code === "22004" && s.player.confused) ||
    (p.code === "22007" && s.player.stunned)
  ) {
    consumeStatus(s.player, p.code === "22004" ? "confused" : "stunned");
    continueWith(s, success, ports);
    return;
  }
  const args = { id: p.id, after: success };
  switch (p.code) {
    case "22004":
    case "22007": {
      const targets =
        p.code === "22004"
          ? ports.schemeTargets(s, true)
          : ports.enemyTargets(s, true);
      ports.choose(
        s,
        cards.get(p.code)!.name,
        "Choose a target for this Special.",
        targets.map((t) =>
          option(
            t.id,
            t.label,
            [N("special-target", { ...args, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "22005": {
      const choices = ports
        .enemyTargets(s, false)
        .flatMap((t) =>
          (["stunned", "confused"] as const)
            .filter((status) => ports.canGiveStatus(s, t.id, status))
            .map((status) =>
              option(
                `${t.id}:${status}`,
                `${status === "stunned" ? "Stun" : "Confuse"} ${t.label}`,
                [N("special-target", { ...args, target: t.id, status })],
                t.code,
              ),
            ),
        );
      ports.choose(
        s,
        "Evasive Maneuvering",
        "Choose either stun or confuse and an enemy.",
        choices,
      );
      break;
    }
    case "22006":
      ports.queue(
        s,
        E("status", { target: `hero:${s.activePlayerId}`, status: "tough" }),
        ...success,
      );
      break;
    case "22008": {
      const looked = s.encounter.deck.slice(0, 3).map((p) => p.id);
      ports.revealHidden(s);
      ports.choose(
        s,
        "Wide Stance",
        "Discard 1 of the top encounter cards, then reorder the others.",
        s.encounter.deck
          .slice(0, 3)
          .map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [N("wide-discard", { ...args, looked, discardId: p.id })],
              p.code,
            ),
          ),
      );
      break;
    }
  }
}
/** Every pending choice and continuation contains only serializable physical
 * IDs/receipts. No closures or cards reconstructed from printing codes. */
export function resolveNebulaEffect(
  s: GameState,
  e: Effect,
  ports: NebulaPorts,
): boolean {
  if (!e.type.startsWith("nebula:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "nebula:cybernetic":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.nebulaCyberneticRound !== s.round &&
          !ports.isIdentityTextBlank?.(s),
        "Cybernetic Upgrades is unavailable.",
      );
      s.flags.nebulaCyberneticRound = s.round;
      ports.queue(s, E("draw", { amount: 2 }), ...after);
      break;
    case "nebula:protocols": {
      const remaining: string[] = e.remaining || [];
      const resolved: string[] = e.resolved || [];
      need(
        new Set(remaining).size === remaining.length &&
          new Set(resolved).size === resolved.length,
        "Technique receipts must be distinct physical cards.",
      );
      const pending = remaining
        .map((id) => own(s, id))
        .filter((p): p is Piece => !!p && technique(p));
      if (!pending.length) {
        ports.queue(s, N("protocol-discard", { ids: resolved }), ...after);
        break;
      }
      ports.choose(
        s,
        "Combat Protocols",
        "Resolve each Technique’s Special in your chosen order. Discard resolved Techniques after all Specials finish.",
        pending.map((p) => {
          const next = {
            remaining: remaining.filter((id) => id !== p.id),
            resolved,
            after,
          };
          return option(
            p.id,
            cards.get(p.code)!.name,
            [
              N("special", {
                id: p.id,
                after: [N("protocols", next)],
                successAfter: [
                  N("protocols", { ...next, resolved: [...resolved, p.id] }),
                ],
              }),
            ],
            p.code,
          );
        }),
      );
      break;
    }
    case "nebula:protocol-discard": {
      const ids: string[] = e.ids || [];
      need(
        new Set(ids).size === ids.length,
        "Technique discard receipts must be distinct.",
      );
      for (const id of ids)
        if (own(s, id) && technique(own(s, id)!)) ports.discardPiece(s, id);
      ports.queue(s, ...after);
      break;
    }
    case "nebula:special":
      special(s, own(s, e.id), e.successAfter || after, after, ports);
      break;
    case "nebula:special-target": {
      const p = own(s, e.id);
      need(
        p && !ports.isTextBlank(s, p),
        "The chosen Technique is unavailable.",
      );
      if (p!.code === "22004") {
        need(
          ports.schemeTargets(s, true).some((t) => t.id === e.target),
          "Choose a legal thwart target.",
        );
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: 3,
            source: "hero",
            action: true,
            thwartInitiated: true,
            abilitySource: p!.id,
          }),
          ...after,
        );
      } else if (p!.code === "22007") {
        need(
          ports.enemyTargets(s, true).some((t) => t.id === e.target),
          "Choose a legal attack target.",
        );
        ports.queue(
          s,
          E("damage", {
            target: e.target,
            amount: 4,
            source: "hero",
            attack: true,
            attackInitiated: true,
            abilitySource: p!.id,
            ...nebulaAttackKeywords(s, ports),
          }),
          ...after,
        );
      } else {
        need(
          p!.code === "22005" &&
            ["stunned", "confused"].includes(e.status) &&
            ports.enemyTargets(s, false).some((t) => t.id === e.target) &&
            ports.canGiveStatus(s, e.target, e.status),
          "Choose an enemy which can receive that status.",
        );
        ports.queue(
          s,
          E("status", { target: e.target, status: e.status }),
          ...after,
        );
      }
      break;
    }
    case "nebula:wide-discard": {
      const looked: string[] = e.looked || [];
      need(
        looked.length > 0 &&
          looked.length <= 3 &&
          new Set(looked).size === looked.length &&
          looked.includes(e.discardId) &&
          looked.every((id, i) => s.encounter.deck[i]?.id === id),
        "Wide Stance must use the actual looked-at top cards.",
      );
      const index = s.encounter.deck.findIndex((p) => p.id === e.discardId);
      s.encounter.discard.push(...s.encounter.deck.splice(index, 1));
      const remaining = looked.filter((id) => id !== e.discardId);
      if (!s.encounter.deck.length) ports.recycleEncounter(s);
      if (remaining.length < 2) ports.queue(s, ...after);
      else
        ports.choose(
          s,
          "Wide Stance",
          "Choose which remaining card is on top.",
          remaining.map((id) => {
            const p = s.encounter.deck.find((p) => p.id === id)!;
            return option(
              id,
              cards.get(p.code)!.name,
              [
                N("wide-order", {
                  ids: [id, ...remaining.filter((other) => other !== id)],
                  after,
                }),
              ],
              p.code,
            );
          }),
        );
      break;
    }
    case "nebula:wide-order": {
      const ids: string[] = e.ids || [];
      need(
        ids.length === 2 &&
          new Set(ids).size === 2 &&
          ids.every((id) =>
            s.encounter.deck.slice(0, 2).some((p) => p.id === id),
          ),
        "Reorder only the two remaining physical cards.",
      );
      const top = s.encounter.deck.splice(0, 2);
      s.encounter.deck.unshift(
        ...ids.map((id) => top.find((p) => p.id === id)!),
      );
      ports.queue(s, ...after);
      break;
    }
    case "nebula:gamora-special": {
      const choices = techniques(s).filter((p) =>
        nebulaSpecialAvailable(s, p, ports),
      );
      if (!choices.length) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Gamora",
        "Resolve 1 controlled Technique’s Special. It stays in play.",
        choices.map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [N("special", { id: p.id, after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nebula:lethal-intent": {
      need(
        Number.isInteger(e.limit) && e.limit >= 0,
        "Lethal Intent requires its actual paid X.",
      );
      const available = techniques(s);
      ports.select(
        s,
        "Lethal Intent",
        `Choose up to ${Math.min(e.limit, available.length)} distinct Techniques.`,
        available,
        0,
        Math.min(e.limit, available.length),
        N("lethal-selected", { limit: e.limit, after }),
      );
      break;
    }
    case "nebula:lethal-selected": {
      const ids: string[] = e.ids || [];
      need(
        ids.length <= e.limit &&
          new Set(ids).size === ids.length &&
          ids.every((id) => own(s, id) && technique(own(s, id)!)),
        "Choose distinct controlled Techniques within paid X.",
      );
      ports.queue(s, N("lethal-order", { remaining: ids, after }));
      break;
    }
    case "nebula:lethal-order": {
      const remaining: string[] = e.remaining || [];
      const pending = remaining
        .map((id) => own(s, id))
        .filter((p): p is Piece => !!p && technique(p));
      if (!pending.length) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Lethal Intent",
        "Choose the next Special to resolve. These Techniques stay in play.",
        pending.map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [
              N("special", {
                id: p.id,
                after: [
                  N("lethal-order", {
                    remaining: remaining.filter((id) => id !== p.id),
                    after,
                  }),
                ],
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nebula:combat-ready": {
      const choices: Option[] = s.player.discard.some(technique)
        ? [
            option(
              "recover",
              "Shuffle up to 2 discarded Techniques into your deck",
              [N("combat-recover", { after })],
            ),
          ]
        : [];
      if (s.player.deck.length)
        choices.push(
          option(
            "find",
            "Discard until a Technique · put it into play and resolve its Special",
            [N("combat-find", { after })],
          ),
        );
      if (choices.length)
        ports.choose(s, "Combat Ready", "Choose one effect.", choices);
      else ports.queue(s, ...after);
      break;
    }
    case "nebula:combat-recover": {
      const available = s.player.discard.filter(technique);
      ports.select(
        s,
        "Combat Ready",
        "Shuffle up to 2 actual Techniques from discard into your deck.",
        available,
        0,
        Math.min(2, available.length),
        N("combat-recovered", { after }),
      );
      break;
    }
    case "nebula:combat-recovered": {
      const ids: string[] = e.ids || [];
      need(
        ids.length <= 2 &&
          new Set(ids).size === ids.length &&
          ids.every((id) =>
            s.player.discard.some((p) => p.id === id && technique(p)),
          ),
        "Choose distinct Techniques from the actual discard pile.",
      );
      for (const id of ids)
        s.player.deck.push(
          ...s.player.discard.splice(
            s.player.discard.findIndex((p) => p.id === id),
            1,
          ),
        );
      if (ids.length) ports.shufflePlayerDeck(s);
      ports.queue(s, ...after);
      break;
    }
    case "nebula:combat-find": {
      ports.discardUntilTechnique(s, N("combat-put", { after }));
      break;
    }
    case "nebula:combat-put":
      if (
        e.id &&
        [...s.player.discard, ...s.player.deck].some(
          (p) => p.id === e.id && technique(p),
        ) &&
        ports.putDiscardedTechnique(s, e.id, [
          N("special", { id: e.id, after }),
        ])
      )
        break;
      else ports.queue(s, ...after);
      break;
    case "nebula:gamora-discard": {
      const available = upgrades(s, ports);
      if (available.length)
        ports.choose(
          s,
          "Gamora",
          "Discard an upgrade you control after taking attack damage.",
          available.map((p) =>
            option(
              p.id,
              cards.get(p.code)!.name,
              [N("discard-upgrade", { upgradeId: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "nebula:discard-upgrade": {
      const p = upgrades(s, ports).find((p) => p.id === e.upgradeId);
      need(p, "Choose a discardable upgrade you control.");
      ports.discardPiece(s, p!.id);
      if (e.attachmentId) {
        const attachment = s.attachments.find(
          (p) => p.id === e.attachmentId && p.code === "22030",
        );
        if (attachment) ports.discardPiece(s, attachment.id);
      }
      ports.queue(s, ...after);
      break;
    }
    case "nebula:remove-weapon": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "22030");
      need(
        p && nebulaAttachmentActions(s, p, ports).length,
        "Lethal Weapon cannot be removed.",
      );
      ports.choose(
        s,
        "Lethal Weapon",
        "Choose an upgrade you control to discard as the cost.",
        upgrades(s, ports).map((p) =>
          option(
            p.id,
            cards.get(p.code)!.name,
            [
              N("discard-upgrade", {
                upgradeId: p.id,
                attachmentId: e.id,
                after,
              }),
            ],
            p.code,
          ),
        ),
      );
      break;
    }
    case "nebula:weapon": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "22030");
      if (p) p.attachedTo = gamoras(s, false)[0]?.id || s.villain.id;
      ports.queue(s, ...after);
      break;
    }
    case "nebula:old-rivals": {
      const source = gamoras(s)[0];
      const playerId = e.playerId || s.activePlayerId;
      const continuation = N("old-rivals-ended", { actorId: playerId, after });
      if (!source || !ports.gamoraAttack(s, source, playerId, continuation))
        ports.queue(s, { ...continuation, performed: false });
      break;
    }
    case "nebula:old-rivals-ended":
      ports.queue(
        s,
        ...(!e.performed ? [E("surge", { sourceCode: "22031" })] : []),
        ...after,
      );
      break;
    case "nebula:obligation":
      need(
        active(s) && e.piece?.code === "22027",
        "Inferiority Complex belongs to Nebula.",
      );
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Inferiority Complex",
          "You may change to alter-ego before choosing a resolution.",
          [
            option("flip", "Change to alter-ego", [
              N("obligation-flip", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              N("obligation-choice", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, N("obligation-choice", { piece: e.piece }));
      break;
    case "nebula:obligation-flip":
      need(
        active(s) && s.player.form === "hero" && ports.canChangeForm(s),
        "Nebula cannot change form.",
      );
      ports.queue(s, N("obligation-choice", { piece: e.piece }));
      ports.flip(s, false, "alter");
      break;
    case "nebula:obligation-choice": {
      const choices = [
        option(
          "techniques",
          "Discard 2 Techniques (as many as available) · surge if none discarded",
          [N("obligation-techniques", { piece: e.piece })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option("remove", "Exhaust Nebula · remove Inferiority Complex", [
            N("obligation-remove", { piece: e.piece }),
          ]),
        );
      ports.choose(
        s,
        "Inferiority Complex",
        "Choose the obligation’s resolution.",
        choices,
      );
      break;
    }
    case "nebula:obligation-remove":
      need(
        active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted &&
          e.piece?.code === "22027",
        "Nebula cannot pay Inferiority Complex’s exhaustion cost.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }), ...after);
      break;
    case "nebula:obligation-techniques": {
      const available = techniques(s).filter((p) =>
        ports.canDiscardUpgrade(s, p),
      );
      const amount = Math.min(2, available.length);
      if (amount)
        ports.select(
          s,
          "Inferiority Complex",
          `Choose ${amount} controlled ${amount === 1 ? "Technique" : "Techniques"} to discard.`,
          available,
          amount,
          amount,
          N("obligation-discard", { count: amount, piece: e.piece, after }),
        );
      else
        ports.queue(
          s,
          N("obligation-discard", { ids: [], count: 0, piece: e.piece, after }),
        );
      break;
    }
    case "nebula:obligation-discard": {
      const ids: string[] = e.ids || [];
      need(
        ids.length === e.count &&
          ids.length <= 2 &&
          new Set(ids).size === ids.length &&
          ids.every((id) => {
            const p = own(s, id);
            return p && technique(p) && ports.canDiscardUpgrade(s, p);
          }),
        "Discard the required distinct controlled Techniques.",
      );
      for (const id of ids) ports.discardPiece(s, id);
      ports.queue(
        s,
        ...(!ids.length ? [E("surge", { sourceCode: "22027" })] : []),
        ...after,
      );
      break;
    }
    default:
      throw Error(`Unknown Nebula effect: ${e.type}`);
  }
  return true;
}
