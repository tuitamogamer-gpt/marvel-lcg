import raw from "../data/catalog-cards.json" with { type: "json" };
import core from "../data/core-player.json" with { type: "json" };
import { allInPlay, controller, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map(
  ([...raw, ...core] as Card[]).map((c) => [c.code, c]),
);
const card = (p: Pick<Piece, "code">) => definitions.get(p.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`spdr-pack:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const normalize = (s: GameState, id: string) =>
  id === "hero" ? `hero:${s.activePlayerId}` : id;
const alive = (s: GameState, id: string) =>
  s.players.some((p) => p.id === id && !p.eliminated);
const key = (token: string, id: string) => `spdrPackResponse:${token}:${id}`;

export const SPDR_PACK_NATIVE_ALIASES = ["31018"] as const;
export const SPDR_PACK_NATIVE_ALIAS_PAIRS = [["31018", "05017"]] as const;
export const SPDR_PACK_SCRIPT_CODES = [
  "31014",
  "31015",
  "31016",
  "31017",
  "31018",
  "31019",
  "31020",
  "31021",
  "31022",
  "31023",
  "31024",
  "31029",
] as const;

export interface SpdrPackRevealReceipt {
  token: string;
  playerId: string;
  pieceId: string;
}
export interface SpdrPackTreacheryReceipt extends SpdrPackRevealReceipt {
  /** The original revealed physical treachery completed resolution. A When Revealed cancellation still qualifies when another printed keyword
   * actually resolves; cancellation of all effects never qualifies. */
  resolved: boolean;
}
export interface SpdrPackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  traits(s: GameState, p: Piece): string[];
  hasTrait(s: GameState, target: string, trait: string): boolean;
  characterTargets(s: GameState): AntManTarget[];
  controlledTraitCards(s: GameState, trait: string): AntManTarget[];
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  printedHP(s: GameState): number;
  canDiscardControlled(s: GameState, p: Piece): boolean;
  discardControlledCost(s: GameState, id: string, after: Effect): void;
  discardControlled(s: GameState, id: string, after: Effect[]): void;
  attach(s: GameState, id: string, target: string): void;
  canDealDamageCost(s: GameState, target: string, amount: number): boolean;
  /** Complete actual damage, prevention, defeat/leave windows and damage
   * responses, then after with an actual receipt. DEAL costs remain paid through
   * prevention, including Tough. No HP-delta guessing. */
  dealDamageCost(
    s: GameState,
    target: string,
    amount: number,
    sourceId: string,
    after: Effect[],
  ): void;
  /** MOVING damage bypasses Tough and damage prevention. */
  moveDamage(
    s: GameState,
    sourceId: string,
    target: string,
    amount: number,
  ): void;
  /** Native encounter draw, including reshuffle/acceleration, discards the
   * actual card and passes it to after as discardedPiece. No boost-star use. */
  discardEncounterTop(s: GameState, after: Effect): void;
  revealAvailable(s: GameState, receipt: SpdrPackRevealReceipt): boolean;
  revealType(s: GameState, receipt: SpdrPackRevealReceipt): string | undefined;
  /** Cancel ONLY this pending card's When Revealed ability; printed Surge,
   * Incite, other reveal effects and normal physical discard remain. */
  cancelWhenRevealed(s: GameState, receipt: SpdrPackRevealReceipt): void;
  resolvedTreacheryAvailable(
    s: GameState,
    receipt: SpdrPackTreacheryReceipt,
  ): boolean;
  captureResolvedTreachery(
    s: GameState,
    receipt: SpdrPackTreacheryReceipt,
    allyId: string,
  ): void;
  /** Update this same pending native damage occurrence, preserving source,
   * overkill, damage-dealt receipts and all remaining interrupt windows. */
  preventDamage(s: GameState, packet: Effect, amount: number): void;
}

const characters = (s: GameState, ports: SpdrPackPorts) =>
  ports
    .characterTargets(s)
    .filter(
      (t) =>
        t.id === `hero:${s.activePlayerId}` ||
        t.id === "hero" ||
        !!own(s, t.id),
    );
const webWarriors = (s: GameState, ports: SpdrPackPorts) =>
  characters(s, ports).filter((t) => ports.hasTrait(s, t.id, "Web-Warrior"));
const damageTargets = (s: GameState, ports: SpdrPackPorts) =>
  webWarriors(s, ports).filter((t) => ports.canDealDamageCost(s, t.id, 1));
const techs = (s: GameState, ports: SpdrPackPorts) =>
  s.player.inPlay.filter(
    (p) =>
      card(p).type_code === "upgrade" &&
      ports.traits(s, p).includes("Tech") &&
      ports.canDiscardControlled(s, p),
  );
const upgrades = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p).type_code === "upgrade");
function optional(
  s: GameState,
  p: Piece,
  title: string,
  effect: Effect,
): Effect[] {
  const seat = controller(s, p.id);
  return seat && !seat.eliminated
    ? [
        E("optional", {
          title,
          image: p.code,
          actorId: seat.id,
          effects: [{ ...effect, actorId: seat.id }],
        }),
      ]
    : [];
}
function choose(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: SpdrPackPorts,
  after: Effect[] = [],
) {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose an actual legal target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
  else ports.queue(s, ...after);
}

export function spdrPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SpdrPackPorts,
): string | undefined {
  if (["31016", "31017", "31023"].includes(p.code) && s.player.form !== "hero")
    return `${card(p).name} is a Hero Action.`;
  if (p.code === "31016" && !techs(s, ports).length)
    return "Repurpose requires a discardable Tech upgrade you control.";
  if (
    p.code === "31017" &&
    (!damageTargets(s, ports).length || !ports.enemyTargets(s, false).length)
  )
    return "Thwip Thwip! requires a payable Web-Warrior damage cost and an enemy.";
  if (
    ["31021", "31022"].includes(p.code) &&
    !ports.controlledTraitCards(s, "Web-Warrior").length
  )
    return "Control a Web-Warrior card to play this ally.";
  if (["31023", "31024"].includes(p.code) && ports.printedHP(s) < 14)
    return "Your identity needs at least 14 printed hit points.";
  if (
    p.code === "31019" &&
    s.player.inPlay.some((a) => a.code === "31019" && a.id !== p.id)
  )
    return "Forcefield Generator is max 1 per player.";
  if (p.code === "31029" && !spdrPackAttachmentTargets(s, p, ports)?.length)
    return "Clarity of Purpose needs a friendly character without Clarity of Purpose.";
  return undefined;
}
export function spdrPackAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: SpdrPackPorts,
): AntManTarget[] | null {
  return p.code === "31029"
    ? ports
        .characterTargets(s)
        .filter(
          (t) =>
            !allInPlay(s).some(
              (a) =>
                a.code === "31029" &&
                a.id !== p.id &&
                normalize(s, a.attachedTo || "") === normalize(s, t.id),
            ),
        )
    : null;
}
export function spdrPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "31019") p.counters = 6;
  return p.code === "31029" && !p.attachedTo ? [P("attach", { id: p.id })] : [];
}
export function spdrPackAllyEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
  ports: SpdrPackPorts,
): Effect[] | null {
  if (!["31014", "31015", "31021", "31022"].includes(p.code)) return null;
  return p.code === "31022" &&
    fromHand &&
    !ports.isTextBlank(s, p) &&
    upgrades(s).length
    ? optional(s, p, "Spider-Man · Otto Octavius", P("otto", { id: p.id }))
    : [];
}
export function spdrPackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return p.code === "31016"
    ? [P("repurpose-cost", { after })]
    : p.code === "31017"
      ? [P("thwip-cost", { after })]
      : null;
}
export function spdrPackEvent(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "31016") return [P("repurpose")];
  if (p.code === "31017") return [P("thwip")];
  if (p.code === "31023") return [E("ready", { target: "hero" })];
  return null;
}
export function spdrPackAllyStats(
  s: GameState,
  p: Piece,
  ports: SpdrPackPorts,
): { attack: number; thwart: number } | null {
  if (p.code !== "31015") return null;
  const amount = ports.isTextBlank(s, p)
    ? 0
    : Math.min(3, p.storedCards?.length || 0);
  return { attack: amount, thwart: amount };
}
export function spdrPackAllyUsed(
  s: GameState,
  p: Piece,
  _kind: "attack" | "thwart",
  performed: boolean,
  ports: SpdrPackPorts,
): Effect[] {
  return p.code === "31021" && performed && !ports.isTextBlank(s, p)
    ? [
        P("ham", {
          id: p.id,
          actorId: controller(s, p.id)?.id || s.activePlayerId,
        }),
      ]
    : [];
}
export function spdrPackAllyDefended(
  s: GameState,
  p: Piece,
  attacker: string,
  ports: SpdrPackPorts,
): Effect[] {
  return p.code === "31014" &&
    p.damage > 0 &&
    !ports.isTextBlank(s, p) &&
    ports.enemyTargets(s, false).some((t) => t.id === attacker)
    ? optional(
        s,
        p,
        "Daredevil",
        P("daredevil", { id: p.id, target: attacker }),
      )
    : [];
}
export function spdrPackTreacheryResolved(
  s: GameState,
  receipt: SpdrPackTreacheryReceipt,
  ports: SpdrPackPorts,
): Effect[] {
  if (
    !receipt.resolved ||
    !alive(s, receipt.playerId) ||
    !ports.resolvedTreacheryAvailable(s, receipt)
  )
    return [];
  const view = seatView(s, receipt.playerId);
  return view.player.inPlay
    .filter(
      (p) =>
        p.code === "31015" &&
        (p.storedCards?.length || 0) < 3 &&
        !ports.isTextBlank(view, p) &&
        ports
          .controlledTraitCards(view, "Web-Warrior")
          .some((t) => t.id !== p.id) &&
        !view.flags[key(receipt.token, p.id)],
    )
    .flatMap((p) =>
      optional(s, p, "Spider-Man Noir", P("noir", { id: p.id, receipt })),
    );
}
export function spdrPackEncounterRevealOptions(
  s: GameState,
  receipt: SpdrPackRevealReceipt,
  after: Effect[],
  ports: SpdrPackPorts,
): Option[] {
  if (
    !alive(s, receipt.playerId) ||
    !ports.revealAvailable(s, receipt) ||
    !damageTargets(s, ports).length
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "31020" &&
        !ports.isTextBlank(s, p) &&
        !s.flags[key(receipt.token, p.id)],
    )
    .map((p) =>
      O(
        p.id,
        "Spider-Tingle · deal 1 damage before revealing",
        [P("tingle", { id: p.id, receipt, after })],
        p.code,
      ),
    );
}
export function spdrPackForcedDamage(
  s: GameState,
  packet: Effect,
  ports: SpdrPackPorts,
): Effect[] | null {
  if (
    s.player.tough ||
    Number(packet.amount || 0) <= 0 ||
    !["hero", `hero:${s.activePlayerId}`].includes(packet.target)
  )
    return null;
  const p = s.player.inPlay.find(
    (p) =>
      p.code === "31019" &&
      p.counters > 0 &&
      !ports.isTextBlank(s, p) &&
      !(packet.spdrGenerators || []).includes(p.id),
  );
  return p ? [P("generator", { id: p.id, packet })] : null;
}
export function spdrPackCharacterSteady(
  s: GameState,
  target: string,
  ports: Pick<SpdrPackPorts, "isTextBlank">,
): boolean {
  const id =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : undefined;
  return (
    !!id &&
    alive(s, id) &&
    seatView(s, id).player.inPlay.some(
      (p) => p.code === "31024" && !ports.isTextBlank(seatView(s, id), p),
    )
  );
}
export function spdrPackCharacterModifiers(s: GameState, target: string) {
  const id =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : undefined;
  const f = id && alive(s, id) ? seatView(s, id).flags : {};
  return {
    attack: Number(f[`spdrRepurpose:${s.round}:attack`] || 0),
    thwart: Number(f[`spdrRepurpose:${s.round}:thwart`] || 0),
    defense: Number(f[`spdrRepurpose:${s.round}:defense`] || 0),
  };
}
export function spdrPackRoundEnded(s: GameState) {
  for (const seat of s.players)
    for (const k of Object.keys(seatView(s, seat).flags))
      if (k.startsWith("spdrRepurpose:")) delete seatView(s, seat).flags[k];
}
export function spdrPackResourceSources(
  s: GameState,
  ports: Pick<SpdrPackPorts, "isTextBlank" | "canDealDamageCost">,
): PaymentSource[] {
  return s.player.form === "hero"
    ? s.player.inPlay
        .filter(
          (p) =>
            p.code === "31029" &&
            !p.exhausted &&
            !!p.attachedTo &&
            !ports.isTextBlank(s, p) &&
            ports.canDealDamageCost(s, p.attachedTo!, 1),
        )
        .map((p) => ({
          id: p.id,
          name: "Clarity of Purpose",
          code: p.code,
          resources: ["wild"],
          kind: "ability",
          description:
            "Exhaust and deal 1 damage to attached character · generate 1 wild resource",
        }))
    : [];
}
/** Host completes the actual damage cost before allocation/generated-resource
 * responses. The resource remains one wild even if the character is defeated;
 * an eliminated paying player cannot complete the pending payment. */
export function spdrPackResourceSpent(
  s: GameState,
  id: string,
  after: Effect[],
  ports: SpdrPackPorts,
): boolean {
  const p = own(s, id, "31029");
  if (!p) return false;
  need(
    spdrPackResourceSources(s, ports).some((r) => r.id === id),
    "Clarity of Purpose cannot pay its actual damage cost.",
  );
  p.exhausted = true;
  ports.dealDamageCost(s, p.attachedTo!, 1, p.id, after);
  return true;
}

export function resolveSpdrPackEffect(
  s: GameState,
  e: Effect,
  ports: SpdrPackPorts,
): boolean {
  if (!e.type.startsWith("spdr-pack:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "spdr-pack:attach": {
      const p = own(s, e.id, "31029");
      need(p, "The original Clarity of Purpose is unavailable.");
      choose(
        s,
        "Clarity of Purpose",
        spdrPackAttachmentTargets(s, p!, ports) || [],
        P("attach-target", { id: e.id }),
        ports,
      );
      break;
    }
    case "spdr-pack:attach-target": {
      const p = own(s, e.id, "31029");
      need(
        p &&
          spdrPackAttachmentTargets(s, p, ports)?.some(
            (t) => t.id === e.target,
          ),
        "Choose a friendly character without another Clarity of Purpose.",
      );
      ports.attach(s, e.id, normalize(s, e.target));
      break;
    }
    case "spdr-pack:repurpose-cost": {
      need(
        s.player.form === "hero" && techs(s, ports).length,
        "Repurpose needs a discardable Tech upgrade you control.",
      );
      choose(
        s,
        "Repurpose · discard a Tech upgrade",
        techs(s, ports).map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
        P("repurpose-discard", { after }),
        ports,
      );
      break;
    }
    case "spdr-pack:repurpose-discard": {
      const p = own(s, e.target);
      need(
        p && techs(s, ports).some((t) => t.id === p.id),
        "The actual discardable Tech upgrade is unavailable.",
      );
      ports.discardControlledCost(
        s,
        p!.id,
        P("repurpose-paid", { amount: Number(card(p!).cost || 0), after }),
      );
      break;
    }
    case "spdr-pack:repurpose-paid":
      s.flags.spdrRepurposeCost = e.amount;
      ports.queue(s, ...after);
      break;
    case "spdr-pack:repurpose": {
      need(
        typeof s.flags.spdrRepurposeCost === "number",
        "Repurpose must discard its actual Tech upgrade as a cost.",
      );
      const amount = Number(s.flags.spdrRepurposeCost);
      delete s.flags.spdrRepurposeCost;
      ports.queue(s, E("ready", { target: "hero" }));
      ports.choose(
        s,
        "Repurpose",
        "Choose the power that gets the discarded upgrade's printed cost until the end of this round.",
        ["thwart", "attack", "defense"].map((power) =>
          O(
            power,
            `${power === "thwart" ? "THW" : power === "attack" ? "ATK" : "DEF"} +${amount}`,
            [P("repurpose-bonus", { power, amount })],
          ),
        ),
      );
      break;
    }
    case "spdr-pack:repurpose-bonus": {
      need(
        ["attack", "thwart", "defense"].includes(e.power),
        "Choose THW, ATK, or DEF.",
      );
      const k = `spdrRepurpose:${s.round}:${e.power}`;
      s.flags[k] = Number(s.flags[k] || 0) + Number(e.amount);
      break;
    }
    case "spdr-pack:thwip-cost":
      need(
        s.player.form === "hero" && damageTargets(s, ports).length,
        "Thwip Thwip! needs an actual payable Web-Warrior damage cost.",
      );
      choose(
        s,
        "Thwip Thwip! · deal 1 damage",
        damageTargets(s, ports),
        P("thwip-damage", { after }),
        ports,
      );
      break;
    case "spdr-pack:thwip-damage":
      need(
        damageTargets(s, ports).some((t) => t.id === e.target),
        "Choose a Web-Warrior character you control that can pay the damage cost.",
      );
      ports.dealDamageCost(s, e.target, 1, s.currentEventId || "31017", [
        P("thwip-paid", { after }),
      ]);
      break;
    case "spdr-pack:thwip-paid":
      s.flags.spdrThwipCost = true;
      ports.queue(s, ...after);
      break;
    case "spdr-pack:thwip":
      need(
        s.flags.spdrThwipCost,
        "Thwip Thwip! must deal its actual damage cost.",
      );
      delete s.flags.spdrThwipCost;
      choose(
        s,
        "Thwip Thwip! · first stun status card",
        ports.enemyTargets(s, false),
        P("thwip-first"),
        ports,
      );
      break;
    case "spdr-pack:thwip-first":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Choose an actual enemy.",
      );
      ports.queue(
        s,
        E("status", { target: e.target, status: "stunned" }),
        P("thwip-second"),
      );
      break;
    case "spdr-pack:thwip-second":
      choose(
        s,
        "Thwip Thwip! · second stun status card",
        ports.enemyTargets(s, false),
        P("thwip-status"),
        ports,
      );
      break;
    case "spdr-pack:thwip-status":
      need(
        ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Choose an actual enemy.",
      );
      ports.queue(s, E("status", { target: e.target, status: "stunned" }));
      break;
    case "spdr-pack:otto": {
      const p = own(s, e.id, "31022");
      need(
        p && !ports.isTextBlank(s, p),
        "Spider-Man's actual play-from-hand response is unavailable.",
      );
      choose(
        s,
        "Spider-Man · Otto Octavius",
        upgrades(s).map((a) => ({
          id: a.id,
          label: card(a).name,
          code: a.code,
        })),
        P("otto-ready", { id: e.id }),
        ports,
      );
      break;
    }
    case "spdr-pack:otto-ready": {
      const p = own(s, e.id, "31022"),
        a = own(s, e.target);
      need(
        p && !ports.isTextBlank(s, p) && a && card(a).type_code === "upgrade",
        "Ready an upgrade you control while Spider-Man is still in play.",
      );
      a!.exhausted = false;
      if (ports.traits(s, a!).includes("Tech"))
        ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "spdr-pack:ham": {
      const p = own(s, e.id, "31021");
      if (p && !ports.isTextBlank(s, p))
        ports.discardEncounterTop(s, P("ham-damage", { id: p.id }));
      break;
    }
    case "spdr-pack:ham-damage": {
      const p = own(s, e.id, "31021"),
        discarded = e.discardedPiece as Piece | undefined;
      if (p && discarded && !ports.isTextBlank(s, p))
        ports.queue(
          s,
          E("damage", {
            target: p.id,
            amount: Number(card(discarded).boost || 0),
            source: p.id,
          }),
        );
      break;
    }
    case "spdr-pack:daredevil": {
      const p = own(s, e.id, "31014");
      need(
        p &&
          p.damage > 0 &&
          !ports.isTextBlank(s, p) &&
          ports.enemyTargets(s, false).some((t) => t.id === e.target),
        "Daredevil must survive defending and have damage to move to that actual attacker.",
      );
      ports.moveDamage(s, p!.id, e.target, 1);
      break;
    }
    case "spdr-pack:noir": {
      const p = own(s, e.id, "31015"),
        receipt = e.receipt as SpdrPackTreacheryReceipt;
      need(
        p &&
          (p.storedCards?.length || 0) < 3 &&
          !ports.isTextBlank(s, p) &&
          receipt.resolved &&
          receipt.playerId === s.activePlayerId &&
          ports.resolvedTreacheryAvailable(s, receipt) &&
          ports
            .controlledTraitCards(s, "Web-Warrior")
            .some((t) => t.id !== p.id) &&
          !s.flags[key(receipt.token, p.id)],
        "Spider-Man Noir needs another controlled Web-Warrior and this actual resolved treachery, to a maximum of three.",
      );
      s.flags[key(receipt.token, p!.id)] = true;
      ports.captureResolvedTreachery(s, receipt, p!.id);
      break;
    }
    case "spdr-pack:tingle": {
      const p = own(s, e.id, "31020"),
        receipt = e.receipt as SpdrPackRevealReceipt;
      need(
        p &&
          spdrPackEncounterRevealOptions(s, receipt, after, ports).some(
            (o) => o.id === p.id,
          ),
        "Spider-Tingle requires its actual pending reveal window and a payable damage cost.",
      );
      choose(
        s,
        "Spider-Tingle · deal 1 damage",
        damageTargets(s, ports),
        P("tingle-damage", { id: e.id, receipt, after }),
        ports,
      );
      break;
    }
    case "spdr-pack:tingle-damage": {
      const p = own(s, e.id, "31020"),
        receipt = e.receipt as SpdrPackRevealReceipt;
      need(
        p &&
          !ports.isTextBlank(s, p) &&
          ports.revealAvailable(s, receipt) &&
          damageTargets(s, ports).some((t) => t.id === e.target) &&
          !s.flags[key(receipt.token, p.id)],
        "Spider-Tingle needs its original upgrade, hidden card, and actual damage cost.",
      );
      s.flags[key(receipt.token, p!.id)] = true;
      ports.dealDamageCost(s, e.target, 1, p!.id, [
        P("tingle-paid", { id: e.id, receipt, after }),
      ]);
      break;
    }
    case "spdr-pack:tingle-paid": {
      const p = own(s, e.id, "31020"),
        receipt = e.receipt as SpdrPackRevealReceipt;
      if (
        p &&
        !ports.isTextBlank(s, p) &&
        ports.revealAvailable(s, receipt) &&
        ports.revealType(s, receipt) === "treachery"
      ) {
        ports.cancelWhenRevealed(s, receipt);
        ports.discardControlled(s, p.id, after);
      } else ports.queue(s, ...after);
      break;
    }
    case "spdr-pack:generator": {
      const p = own(s, e.id, "31019"),
        packet = e.packet as Effect;
      need(
        p &&
          p.counters > 0 &&
          !ports.isTextBlank(s, p) &&
          Number(packet.amount) > 0,
        "Forcefield Generator needs this actual incoming identity damage packet.",
      );
      const amount = Math.min(p!.counters, Number(packet.amount));
      p!.counters -= amount;
      const resume = {
        ...packet,
        spdrGenerators: [...(packet.spdrGenerators || []), p!.id],
      };
      ports.preventDamage(s, resume, amount);
      if (!p!.counters) ports.discardControlled(s, p!.id, [resume]);
      else ports.queue(s, resume);
      break;
    }
    default:
      throw Error(`Unknown SP//dr player-pool effect: ${e.type}`);
  }
  return true;
}
