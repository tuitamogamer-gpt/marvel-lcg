import { magikTopPlayable } from "./magik.js";
import { card, CATALOG_CARDS } from "./card-definitions.js";
import { eventPlaySource, eventPlaySources, isTextBlank } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const M = (type: string, args: Record<string, unknown> = {}) =>
  E(`magnetoHero:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const blocked = (s: GameState) => deadpoolTriggeredBlocked(s);
const trait = (p: Piece, value: string) =>
  (card(p).traits || "")
    .toLowerCase()
    .split(/\.\s*/)
    .includes(value.toLowerCase());
const identity = (s: GameState) =>
  s.heroId === "magneto" &&
  !isTextBlank(s, {
    code: s.player.form === "hero" ? "49001a" : "49001b",
    id: `hero:${s.activePlayerId}`,
  });
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const target = (title: string, group: string, action: Effect) =>
  E("target", { title, group, action });
const allies = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p).type_code === "ally");
const globalFlags = (s: GameState) => seatView(s, s.firstPlayerId).flags;
export const MAGNETO_HERO_SCRIPT_CODES = [
  "49001a",
  "49001b",
  ...Array.from({ length: 41 }, (_, i) => String(49002 + i)),
];
export const MAGNETO_HERO_NEW_ALLIES = ["49033", "49034", "49035", "49036"];

export interface MagnetoHeroPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  targets(
    s: GameState,
    group: string,
    action?: boolean,
  ): { id: string; label: string; code?: string }[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  discard(s: GameState, id: string): void;
  discardEncounterControlled(s: GameState, id: string, source: string): void;
  canDiscard(s: GameState, p: Piece): boolean;
  discardCost(s: GameState, id: string, after: Effect[]): void;
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  mill(s: GameState, n: number): Piece[];
  takeDiscarded(s: GameState, id: string): Piece | undefined;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  hidden(s: GameState): void;
  feedback(s: GameState): Effect[];
  canReady(s: GameState): boolean;
  ready(s: GameState): void;
  maxHP(s: GameState, p: Piece): number;
  heroMaxHP(s: GameState): number;
  allyPower(s: GameState, p: Piece, kind: "attack" | "thwart"): number;
  canPay(
    s: GameState,
    cost: number,
    req?: Resource[],
    exclude?: string,
    code?: string,
  ): boolean;
  cost(s: GameState, p: Piece): number;
  pay(
    s: GameState,
    title: string,
    cost: number,
    req: Resource[],
    after: Effect[],
  ): void;
  reaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
    commit?: Effect[],
  ): void;
  canPlayAlly(s: GameState, p: Piece, discount: number): boolean;
  playAlly(s: GameState, p: Piece, discount: number): void;
  putMinion(s: GameState, p: Piece, playerId: string, after: Effect[]): void;
  defeat(s: GameState, id: string, source: string): void;
  keepObligation(s: GameState, p: Piece): void;
  reveal(s: GameState, p: Piece): void;
  revealNemesis(s: GameState, p: Piece, after: Effect[]): void;
  activate(
    s: GameState,
    id: string,
    playerId: string,
    after?: Effect,
    omitBoost?: boolean,
  ): void;
  canActivate(s: GameState, p: Piece): boolean;
  assignBoost(s: GameState, id: string, p?: Piece): void;
  repeatActivation(s: GameState, after: Effect): void;
  batch(s: GameState, ids: string[], amount: number, source: string): void;
}

export function magnetoHeroInitialize(
  s: GameState,
  make: MagnetoHeroPorts["makePiece"],
) {
  if (s.flags.magnetoHeroInitialized) return;
  if (s.heroId === "magneto")
    for (const code of ["49028", "49029", "49030", "49031", "49032"])
      (s.player.setAside ||= []).push(make(s, code));
  if (s.player.deck.some((p) => p.code === "49020"))
    for (const code of MAGNETO_HERO_NEW_ALLIES)
      (s.player.setAside ||= []).push(make(s, code));
  s.flags.magnetoHeroInitialized = true;
}
export function magnetoHeroStats(s: GameState) {
  const hero = s.heroId === "magneto" && s.player.form === "hero";
  return {
    attack: hero ? Number(s.flags.magnetoHeroArmorAttack || 0) : 0,
    thwart: hero ? Number(s.flags.magnetoHeroArmorThwart || 0) : 0,
    defense: hero ? Number(s.flags.magnetoHeroArmorDefense || 0) : 0,
    steady: hero && live(s, "49003").length > 0,
    aerial: hero && live(s, "49005").length > 0,
    retaliate: hero ? live(s, "49006").length : 0,
  };
}
export function magnetoHeroResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (
    blocked(s) ||
    !targetCode ||
    !(card(targetCode).traits || "").split(/\.\s*/).includes("Magnetic")
  )
    return [];
  return live(s, "49003")
    .filter((p) => !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      resources: ["wild"],
      kind: "ability",
      description: "Exhaust Magneto's Helmet for a Magnetic card.",
    }));
}
export function magnetoHeroResourceSpent(s: GameState, id: string) {
  const p = live(s, "49003").find((p) => p.id === id);
  if (!p) return false;
  need(!p.exhausted && !blocked(s), "Magneto's Helmet is unavailable.");
  p.exhausted = true;
  return true;
}
export function magnetoHeroBubble(
  s: GameState,
  target: string,
  amount: number,
  ports: Pick<MagnetoHeroPorts, "discard" | "queue" | "feedback">,
) {
  if (target !== "hero" || amount <= 0 || blocked(s)) return false;
  const p = live(s, "49006")[0];
  if (!p) return false;
  p.damage += amount;
  if (p.damage >= 6) ports.discard(s, p.id);
  ports.queue(s, ...ports.feedback(s));
  return true;
}
export function magnetoHeroDamageCostAvailable(s: GameState) {
  return blocked(s) || live(s, "49006").length === 0;
}
const allyPlaySources = (s: GameState) =>
  [
    ...s.player.hand,
    ...[magikTopPlayable(s)].filter((p): p is Piece => !!p),
  ].filter((p) => card(p).type_code === "ally");
export function magnetoHeroWrapped(s: GameState, id: string) {
  return allInPlay(s).some(
    (p) => p.code === "49007" && p.attachedTo === id && !isTextBlank(s, p),
  );
}
export function magnetoHeroNewModifiers(
  s: GameState,
  p: Piece,
  hasTrait: MagnetoHeroPorts["hasTrait"],
) {
  const seat = controller(s, p.id);
  const view = seat ? seatView(s, seat) : s;
  const active =
    !isTextBlank(s, p) &&
    (hasTrait(view, "hero", "Mutant") || hasTrait(view, "hero", "X-Men"));
  return {
    attack: active && p.code === "49033" ? 1 : 0,
    thwart: active && p.code === "49034" ? 1 : 0,
    health: active && p.code === "49036" ? 2 : 0,
    toughness: active && p.code === "49035",
    excluded: active && MAGNETO_HERO_NEW_ALLIES.includes(p.code),
  };
}
export function magnetoHeroGrantedTrait(
  s: GameState,
  id: string,
  value: string,
  printed: (s: GameState, id: string, trait: string) => boolean,
) {
  if (!["x-factor", "x-force", "x-men"].includes(value.toLowerCase()))
    return false;
  const seat =
    id === "hero"
      ? s.players.find((p) => p.id === s.activePlayerId)
      : id.startsWith("hero:")
        ? s.players.find((p) => p.id === id.slice(5))
        : controller(s, id);
  if (!seat) return false;
  const view = seatView(s, seat);
  return (
    live(view, "49037").length > 0 &&
    ["X-Factor", "X-Force", "X-Men"].some((t) =>
      printed(view, id === `hero:${seat.id}` ? "hero" : id, t),
    )
  );
}
export function magnetoHeroAttackBonus(s: GameState, id: string) {
  return Number(globalFlags(s)[`magnetoHeroCyclops:${phase(s)}:${id}`] || 0);
}
export function magnetoHeroCanAttack(
  s: GameState,
  id: string,
  source = "hero",
) {
  if (globalFlags(s)[`magnetoHeroShaw:${id}`] === phase(s)) return false;
  const enemy = s.minions.find((p) => p.id === id);
  if (
    enemy?.code === "49039" &&
    !isTextBlank(s, enemy) &&
    allInPlay(s).some((p) => p.id === source && card(p).type_code === "ally")
  )
    return false;
  return !(
    id === s.villain.id &&
    ["hero", `hero:${s.activePlayerId}`].includes(source) &&
    s.flags.magnetoHeroFacePastPhase === phase(s)
  );
}
export function magnetoHeroEnemyLeft(s: GameState, id: string) {
  const flags = globalFlags(s);
  delete flags[`magnetoHeroShaw:${id}`];
  for (const key of Object.keys(flags))
    if (key.startsWith("magnetoHeroCyclops:") && key.endsWith(`:${id}`))
      delete flags[key];
}
export function magnetoHeroEnemyAttacked(s: GameState, id: string): Effect[] {
  const p = s.minions.find(
    (p) => p.id === id && p.code === "49038" && !isTextBlank(s, p),
  );
  return p ? [M("shaw", { id })] : [];
}
export function magnetoHeroEnemyAttackFinished(
  s: GameState,
  p: Piece | undefined,
  playerId: string,
  total: number,
): Effect[] {
  if (!p || isTextBlank(s, p)) return [];
  return p.code === "49028"
    ? [E("mill", { amount: total, actorId: playerId })]
    : p.code === "49031"
      ? [E("mill", { amount: 2, actorId: playerId })]
      : [];
}
export function magnetoHeroDefeated(s: GameState, p: Piece): Effect[] {
  return !isTextBlank(s, p) && p.code === "49030"
    ? [E("mill", { amount: 4, actorId: s.activePlayerId })]
    : [];
}
export function magnetoHeroSideDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  return p.code === "49029"
    ? [E("mill", { amount: 9, actorId: s.activePlayerId })]
    : p.code === "49020"
      ? [M("recruits", { players: playerOrder(s).map((p) => p.id) })]
      : [];
}
export function magnetoHeroFormChanged(s: GameState): Effect[] {
  return identity(s) &&
    s.player.form === "alter" &&
    !blocked(s) &&
    s.player.discard.length
    ? [optional("Survivor", [M("survivor")])]
    : [];
}
export function magnetoHeroAbilityOptions(
  s: GameState,
  id: string,
  ports: MagnetoHeroPorts,
): Option[] {
  if (blocked(s)) return [];
  if (
    ["hero", "identity"].includes(id) &&
    identity(s) &&
    s.player.form === "hero" &&
    s.flags.magnetoHeroPullRound !== s.round &&
    s.player.deck.length
  )
    return [
      O("pull", "Magnetic Pull · discard until a Magnetic card", [M("pull")]),
    ];
  const p = s.player.inPlay.find((p) => p.id === id && !isTextBlank(s, p));
  if (!p) return [];
  if (p.code === "49027" && s.player.form === "alter" && !s.player.exhausted)
    return [
      O("remove", "Exhaust Erik Lehnsherr · discard Old Grievances", [
        M("obligation-remove", { id: p.id }),
      ]),
    ];
  if (
    p.code === "49002" &&
    s.player.form === "alter" &&
    !p.exhausted &&
    (s.player.discard.some((p) => trait(p, "Magnetic")) ||
      s.player.hp < ports.heroMaxHP(s))
  )
    return [
      O("asteroid", "Asteroid M · recycle a Magnetic card and heal 1", [
        M("asteroid", { id }),
      ]),
    ];
  if (
    p.code === "49016" &&
    s.player.form === "alter" &&
    s.player.discard.some(
      (p) =>
        card(p).type_code === "ally" &&
        (trait(p, "X-Men") || trait(p, "X-Force")),
    )
  )
    return [
      O("return", "Won't Stay Down · return an ally", [M("stay", { id })]),
    ];
  return [];
}
export function magnetoHeroPlayRestriction(
  s: GameState,
  p: Piece,
  ports: MagnetoHeroPorts,
) {
  const c = card(p);
  if (
    ["49016", "49021"].includes(p.code) &&
    !["X-Men", "X-Force"].some((t) => ports.hasTrait(s, "hero", t))
  )
    return "Your identity must have the X-Men or X-Force trait.";
  if (p.code === "49020" && !ports.hasTrait(s, "hero", "X-Men"))
    return "Your identity must have the X-Men trait.";
  if (
    p.code === "49007" &&
    !s.minions.some((p) => !ports.hasTrait(s, p.id, "Elite"))
  )
    return "Wrapped in Metal needs a non-Elite minion.";
  if (p.code === "49010" && !s.minions.some((p) => magnetoHeroWrapped(s, p.id)))
    return "Magnetic Missile needs a minion with Wrapped in Metal attached.";
  if (
    p.code === "49017" &&
    !allyPlaySources(s).some(
      (ally) =>
        card(ally).type_code === "ally" &&
        ports.canPlayAlly(
          {
            ...s,
            player: {
              ...s.player,
              hand: s.player.hand.filter((q) => q.id !== p.id),
            },
          },
          ally,
          3,
        ),
    )
  )
    return "Squared Off needs a playable ally in your hand.";
  if (p.code === "49018" && !allies(s).length)
    return "Noble Sacrifice needs an ally you control.";
  if (p.code === "49022" && !nemesis(s).length)
    return "Your nemesis minion is not available to reveal.";
  if (p.code === "49019")
    return "Play in the response window after exhausting your hero for a basic attack or thwart.";
  if (
    c.type_code === "event" &&
    /\(attack\)/i.test(c.text || "") &&
    s.flags.magnetoHeroFacePastPhase === phase(s) &&
    !ports.targets(s, "enemy", true).some((p) => p.id !== s.villain.id)
  )
    return "Face the Past prevents attacking the villain this phase.";
  return null;
}
const nemesis = (s: GameState) => {
  const codes = CATALOG_CARDS.filter(
    (c) => c.set_code === `${s.heroId}_nemesis`,
  ).map((c) => c.code);
  return [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...(s.player.setAside || []),
  ].filter(
    (p) =>
      codes.includes(p.code) &&
      card(p).type_code === "minion" &&
      /nemesis minion/i.test(card(p).text || ""),
  );
};
export function magnetoHeroBasicOptions(
  s: GameState,
  packet: Effect,
  kind: "attack" | "thwart",
  ports: MagnetoHeroPorts,
): Option[] {
  if (
    packet.magnetoHeroYouGotHandled ||
    s.player.form !== "hero" ||
    blocked(s) ||
    !allies(s).length
  )
    return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === "49019" &&
        ports.canPay(s, ports.cost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        '"You Got This!" · discard an ally and ready your hero',
        [M("you-got-cost", { id: p.id, packet, kind })],
        p.code,
      ),
    );
}
export function magnetoHeroEntered(
  s: GameState,
  p: Piece,
  ports: MagnetoHeroPorts,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "49007") return [M("wrap-choice", { id: p.id })];
  if (p.code === "49037" && s.playerCount > 1)
    return [M("children-choice", { id: p.id })];
  if (magnetoHeroNewModifiers(s, p, ports.hasTrait).toughness)
    return [E("status", { target: p.id, status: "tough" })];
  if (blocked(s)) return [];
  if (["49012", "49013", "49014", "49015", "49021"].includes(p.code))
    return [optional(card(p).name, [M("entered", { id: p.id })])];
  return [];
}
export function magnetoHeroBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] {
  if (p.code === "49017" && s.flags[`nightcrawlerMinionCostPaid:${p.id}`])
    return after;
  return ["49017", "49018", "49022"].includes(p.code)
    ? [M("event-cost", { piece: p, after })]
    : after;
}
export function magnetoHeroEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "49008":
      return [
        target(
          card(p).name,
          "scheme",
          M("blast", { source: p.id, action: true }),
        ),
      ];
    case "49009":
      return [
        target(
          card(p).name,
          "enemy",
          M("shards", { source: p.id, attack: true }),
        ),
      ];
    case "49010":
      return [M("missile-cost")];
    case "49017":
      return s.flags[`nightcrawlerMinionCostPaid:${p.id}`] ||
        s.flags[`magnetoHeroCost:${p.id}`]
        ? [M("squared-ally")]
        : [];
    case "49018":
      return s.flags[`magnetoHeroCost:${p.id}`]
        ? [
            E("heal", {
              target: "hero",
              amount: Number(s.flags[`magnetoHeroCost:${p.id}`]),
            }),
            E("status", { target: "hero", status: "tough" }),
          ]
        : [];
    case "49022":
      return s.flags[`magnetoHeroCost:${p.id}`]
        ? [M("past-after", { id: p.id })]
        : [];
    default:
      return null;
  }
}
export function magnetoHeroEncounter(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "49027":
      return [M("obligation", { piece: p })];
    case "49032":
      return [
        M("acolytes", {
          entries: s.minions
            .filter((p) => trait(p, "Acolyte"))
            .map((p) => ({
              id: p.id,
              player: p.engagedWith || s.activePlayerId,
            })),
          activated: 0,
          original: s.activePlayerId,
        }),
      ];
    case "49041":
      return [
        E("threat", {
          target: p.id,
          amount:
            2 *
            [
              s.villain,
              ...s.minions,
              ...s.sideSchemes,
              ...s.attachments,
            ].filter((p) => trait(p, "Hellfire")).length,
        }),
      ];
    case "49042":
      return [
        E("status", { target: s.villain.id, status: "tough" }),
        M("decadence", { piece: p }),
      ];
    case "49028":
    case "49029":
    case "49030":
    case "49031":
    case "49038":
    case "49039":
    case "49040":
      return [];
    default:
      return null;
  }
}
export function magnetoHeroBoost(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "49030":
    case "49031":
      return [E("mill", { amount: 4 })];
    case "49039":
      return [M("selene-boost", { source: p.id })];
    case "49040":
      return [M("pawn-boost", { piece: p })];
    case "49042":
      return [M("repeat-boost")];
    default:
      return null;
  }
}
export function magnetoHeroShadows(s: GameState): Effect[] | null {
  return s.heroId === "magneto" ? [M("shadows")] : null;
}
export function resolveMagnetoHeroEffect(
  s: GameState,
  e: Effect,
  ports: MagnetoHeroPorts,
): boolean {
  if (!e.type.startsWith("magnetoHero:")) return false;
  const q = (...effects: Effect[]) => ports.queue(s, ...effects);
  const choose = (title: string, text: string, options: Option[]) =>
    ports.choose(s, title, text, options);
  const pick = (title: string, pieces: Piece[], next: Effect) => {
    if (pieces.length)
      choose(
        title,
        "Choose an actual card.",
        pieces.map((p) =>
          O(p.id, card(p).name, [{ ...next, id: p.id }], p.code),
        ),
      );
  };
  switch (e.type) {
    case "magnetoHero:wrap-choice": {
      const p = ports.find(s, e.id);
      if (!p) break;
      const opts = s.minions
        .filter((m) => !ports.hasTrait(s, m.id, "Elite"))
        .map((m) =>
          O(
            m.id,
            card(m).name,
            [M("wrap", { id: p.id, target: m.id })],
            m.code,
          ),
        );
      if (opts.length)
        choose("Wrapped in Metal", "Choose a non-Elite minion.", opts);
      break;
    }
    case "magnetoHero:wrap": {
      const p = ports.find(s, e.id),
        m = s.minions.find((p) => p.id === e.target);
      need(
        p && m && !ports.hasTrait(s, m.id, "Elite"),
        "Wrapped in Metal needs a non-Elite minion.",
      );
      p!.attachedTo = m!.id;
      break;
    }
    case "magnetoHero:children-choice": {
      const options = playerOrder(s)
        .filter(
          (seat) =>
            !seatView(s, seat).player.inPlay.some(
              (p) => p.code === "49037" && p.id !== e.id,
            ),
        )
        .map((seat) =>
          O(seat.id, seat.heroId, [
            M("children-transfer", { id: e.id, player: seat.id }),
          ]),
        );
      choose("Children of the Atom", "Choose a player's control.", options);
      break;
    }
    case "magnetoHero:children-transfer": {
      const seat = controller(s, e.id);
      need(seat, "The support moved.");
      const from = seatView(s, seat!).player.inPlay;
      const i = from.findIndex((p) => p.id === e.id);
      seatView(s, e.player).player.inPlay.push(from.splice(i, 1)[0]);
      break;
    }
    case "magnetoHero:continue":
      q(...(e.after || []));
      break;
    case "magnetoHero:event-cost": {
      const p = e.piece as Piece;
      if (p.code === "49018")
        pick(
          "Noble Sacrifice",
          allies(s),
          M("event-cost-discard", {
            event: p.id,
            after: e.after,
            health: true,
          }),
        );
      if (p.code === "49017") {
        let found: Piece | undefined;
        while (s.encounter.deck.length) {
          const r = ports.discardEncounterTop(s);
          if (!r.piece) break;
          if (card(r.piece).type_code === "minion") {
            found = r.piece;
            break;
          }
          if (r.emptied) break;
        }
        if (found)
          ports.putMinion(s, found, s.activePlayerId, [
            M("event-cost-done", { event: p.id, after: e.after, value: true }),
          ]);
        else q(...(e.after || []));
      }
      if (p.code === "49022")
        pick(
          "Face the Past",
          nemesis(s),
          M("event-cost-nemesis", { event: p.id, after: e.after }),
        );
      break;
    }
    case "magnetoHero:event-cost-discard": {
      const p = ports.find(s, e.id);
      need(p, "The cost card moved.");
      ports.discardCost(s, p!.id, [
        M("event-cost-done", {
          event: e.event,
          after: e.after,
          value: e.health ? card(p!).health || 0 : true,
        }),
      ]);
      break;
    }
    case "magnetoHero:event-cost-nemesis": {
      const p = nemesis(s).find((p) => p.id === e.id);
      need(p, "The nemesis minion moved.");
      ports.revealNemesis(s, p!, [
        M("event-cost-done", { event: e.event, after: e.after, value: true }),
      ]);
      break;
    }
    case "magnetoHero:event-cost-done":
      s.flags[`magnetoHeroCost:${e.event}`] = e.value;
      q(...(e.after || []));
      break;
    case "magnetoHero:pull": {
      need(
        identity(s) &&
          s.player.form === "hero" &&
          !blocked(s) &&
          s.flags.magnetoHeroPullRound !== s.round,
        "Magnetic Pull is unavailable.",
      );
      s.flags.magnetoHeroPullRound = s.round;
      const discarded: Piece[] = [];
      let found: Piece | undefined;
      while (s.player.deck.length) {
        const result = ports.discardTop(s);
        if (!result.piece) break;
        discarded.push(result.piece);
        if (trait(result.piece, "Magnetic")) {
          found = result.piece;
          break;
        }
        if (result.emptied) break;
      }
      if (found) {
        const actual = ports.takeDiscarded(s, found.id);
        if (actual) s.player.hand.push(actual);
      }
      const icons = ["mental", "physical", "energy"].filter((r) =>
        discarded.some(
          (p) => Number(card(p)[`resource_${r}` as "resource_mental"]) > 0,
        ),
      );
      const obligations = live(s, "49027");
      q(
        ...obligations.map((p) =>
          E("damage", {
            target: "hero",
            amount: discarded.length,
            source: p.id,
          }),
        ),
        ...(found ? [M("pull-responses", { icons, used: [] })] : []),
      );
      break;
    }
    case "magnetoHero:pull-responses": {
      if (blocked(s)) break;
      const opts: Option[] = [];
      const used: string[] = e.used || [];
      for (const p of [...live(s, "49004"), ...live(s, "49005")].filter(
        (p) => !used.includes(p.id),
      )) {
        if (p.code === "49004" && e.icons.length)
          opts.push(
            O(
              p.id,
              "Magneto's Armor · gain the discarded icons' bonuses",
              [
                M("armor", { id: p.id, icons: e.icons }),
                { ...e, used: [...used, p.id] },
              ],
              p.code,
            ),
          );
        if (p.code === "49005" && !p.exhausted && ports.canReady(s))
          opts.push(
            O(
              p.id,
              "Magneto's Cape · exhaust to ready Magneto",
              [M("cape", { id: p.id }), { ...e, used: [...used, p.id] }],
              p.code,
            ),
          );
      }
      if (opts.length)
        choose("Magnetic Pull responses", "Choose a response or continue.", [
          ...opts,
          O("continue", "Continue", []),
        ]);
      break;
    }
    case "magnetoHero:armor": {
      const p = live(s, "49004").find((p) => p.id === e.id);
      need(p && !blocked(s), "Magneto's Armor is unavailable.");
      for (const [resource, key] of [
        ["mental", "Thwart"],
        ["physical", "Attack"],
        ["energy", "Defense"],
      ])
        if (e.icons.includes(resource))
          s.flags[`magnetoHeroArmor${key}`] =
            Number(s.flags[`magnetoHeroArmor${key}`] || 0) + 1;
      q(...ports.feedback(s));
      break;
    }
    case "magnetoHero:cape": {
      const p = live(s, "49005").find((p) => p.id === e.id);
      need(p && !p.exhausted && !blocked(s), "Magneto's Cape is unavailable.");
      p!.exhausted = true;
      ports.ready(s);
      q(...ports.feedback(s));
      break;
    }
    case "magnetoHero:survivor": {
      need(
        identity(s) && s.player.form === "alter" && !blocked(s),
        "Survivor is unavailable.",
      );
      const cards = s.player.discard.splice(
        Math.max(0, s.player.discard.length - 3),
      );
      s.player.deck.push(...cards);
      ports.shuffle(s);
      q(...ports.feedback(s));
      break;
    }
    case "magnetoHero:asteroid": {
      const p = live(s, "49002").find((p) => p.id === e.id);
      need(
        p && !p.exhausted && s.player.form === "alter" && !blocked(s),
        "Asteroid M is unavailable.",
      );
      p!.exhausted = true;
      const found = [...s.player.discard]
        .reverse()
        .find((p) => trait(p, "Magnetic"));
      if (found) {
        s.player.discard.splice(s.player.discard.indexOf(found), 1);
        s.player.deck.push(found);
        ports.shuffle(s);
      }
      q(E("heal", { target: "hero", amount: 1 }));
      break;
    }
    case "magnetoHero:stay": {
      need(
        live(s, "49016").some((p) => p.id === e.id) &&
          s.player.form === "alter" &&
          !blocked(s),
        "Won't Stay Down is unavailable.",
      );
      ports.discardCost(s, e.id, [M("stay-target")]);
      break;
    }
    case "magnetoHero:stay-target":
      pick(
        "Won't Stay Down",
        s.player.discard.filter(
          (p) =>
            card(p).type_code === "ally" &&
            (trait(p, "X-Men") || trait(p, "X-Force")),
        ),
        M("stay-take"),
      );
      break;
    case "magnetoHero:stay-take": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      need(i >= 0, "The chosen discarded ally moved.");
      s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "magnetoHero:blast": {
      const before =
        e.target === "main"
          ? s.scheme.threat
          : ports.find(s, e.target)?.counters || 0;
      q(
        E("thwart", {
          target: e.target,
          amount: 3,
          action: true,
          source: "hero",
        }),
        M("blast-after", { target: e.target, before }),
      );
      break;
    }
    case "magnetoHero:blast-after": {
      const remaining =
        e.target === "main"
          ? s.scheme.threat
          : ports.find(s, e.target)?.counters || 0;
      if (e.before > 0 && remaining === 0) {
        const pieces = [...s.attachments, ...allInPlay(s)].filter(
          (p) =>
            card(p).type_code === "attachment" &&
            /Hero (Action|Response)/.test(card(p).text || "") &&
            ports.canDiscard(s, p),
        );
        if (pieces.length)
          q(
            optional("Electromagnetic Blast", [
              M("blast-discard-choice", { ids: pieces.map((p) => p.id) }),
            ]),
          );
      }
      break;
    }
    case "magnetoHero:blast-discard-choice":
      pick(
        "Electromagnetic Blast",
        (e.ids as string[])
          .map((id) => ports.find(s, id))
          .filter((p): p is Piece => !!p),
        M("discard"),
      );
      break;
    case "magnetoHero:discard":
      if (e.encounter) ports.discardEncounterControlled(s, e.id, e.source);
      else ports.discard(s, e.id);
      break;
    case "magnetoHero:shards": {
      const p = ports.find(s, e.target);
      const stage = e.target === s.villain.id ? s.villain.stage : undefined;
      q(
        E("damage", {
          target: e.target,
          amount: 7,
          attack: true,
          source: "hero",
        }),
        M("shards-after", { target: e.target, stage, code: p?.code }),
      );
      break;
    }
    case "magnetoHero:shards-after":
      if (
        (e.stage !== undefined && s.villain.stage !== e.stage) ||
        (!s.minions.some((p) => p.id === e.target) && e.target !== s.villain.id)
      )
        q(E("status", { target: "hero", status: "tough" }));
      break;
    case "magnetoHero:missile-cost":
      pick(
        "Magnetic Missile",
        s.minions.filter((p) => magnetoHeroWrapped(s, p.id)),
        M("missile-discard"),
      );
      break;
    case "magnetoHero:missile-discard": {
      need(
        s.minions.some((p) => p.id === e.id && magnetoHeroWrapped(s, p.id)),
        "Wrapped minion is unavailable.",
      );
      ports.discardCost(s, e.id, [
        target("Magnetic Missile", "enemy", M("missile")),
      ]);
      break;
    }
    case "magnetoHero:missile":
      q(
        E("damage", { target: e.target, amount: 5, source: "hero" }),
        E("status", { target: e.target, status: "stunned" }),
      );
      break;
    case "magnetoHero:entered": {
      const p = ports.find(s, e.id);
      if (!p || isTextBlank(s, p) || blocked(s)) break;
      if (p.code === "49012")
        pick(
          "M",
          s.minions.filter(
            (m) => ports.maxHP(s, m) - m.damage < ports.maxHP(s, p) - p.damage,
          ),
          M("m-defeat", { source: p.id }),
        );
      if (p.code === "49013") {
        const options: Option[] = [];
        if (ports.canPay(s, 1, ["energy"]))
          options.push(
            O("energy", "Spend Energy · deal 1 to every enemy", [
              M("omega-pay", { kind: "energy", source: p.id }),
            ]),
          );
        if (ports.canPay(s, 1, ["mental"]))
          options.push(
            O("mental", "Spend Mental · remove 1 from every scheme", [
              M("omega-pay", { kind: "mental", source: p.id }),
            ]),
          );
        if (options.length) choose("Kid Omega", "Choose a response.", options);
      }
      if (p.code === "49014")
        pick(
          "Phoenix",
          allInPlay(s).filter(
            (a) =>
              card(a).type_code === "ally" &&
              ports.hasTrait(s, a.id, "X-Men") &&
              (a.exhausted || a.damage > 0),
          ),
          M("phoenix"),
        );
      if (p.code === "49015")
        pick("Cyclops", [s.villain, ...s.minions], M("cyclops"));
      if (p.code === "49021") {
        const chars = [
          ...playerOrder(s).map((seat) => ({
            id: `hero:${seat.id}`,
            code: seatView(s, seat).heroId,
          })),
          ...allInPlay(s),
          s.villain,
          ...s.minions,
        ];
        const opts: Option[] = [];
        for (const c of chars) {
          const actual = c.id.startsWith("hero:")
            ? seatView(s, c.id.slice(5)).player
            : ports.find(s, c.id);
          for (const status of ["stunned", "confused", "tough"] as const)
            if (actual?.[status])
              opts.push(
                O(
                  `${c.id}:${status}`,
                  `${c.id.startsWith("hero:") ? "Identity" : card(c as Piece).name} · remove ${status}`,
                  [M("white", { target: c.id, status })],
                ),
              );
        }
        if (opts.length) choose("White Queen", "Discard a status card.", opts);
      }
      break;
    }
    case "magnetoHero:m-defeat":
      ports.defeat(s, e.id, e.source);
      break;
    case "magnetoHero:omega-pay":
      ports.pay(
        s,
        "Kid Omega",
        1,
        [e.kind],
        [M("omega", { kind: e.kind, source: e.source })],
      );
      break;
    case "magnetoHero:omega":
      if (e.kind === "energy")
        ports.batch(
          s,
          [s.villain, ...s.minions].map((p) => p.id),
          1,
          e.source,
        );
      else
        q(
          ...ports
            .targets(s, "scheme", false)
            .map((p) =>
              E("thwart", { target: p.id, amount: 1, source: e.source }),
            ),
        );
      break;
    case "magnetoHero:phoenix": {
      const p = ports.find(s, e.id);
      if (p) {
        p.exhausted = false;
        q(E("heal", { target: p.id, amount: 1 }));
      }
      break;
    }
    case "magnetoHero:cyclops":
      globalFlags(s)[`magnetoHeroCyclops:${phase(s)}:${e.id}`] =
        Number(globalFlags(s)[`magnetoHeroCyclops:${phase(s)}:${e.id}`] || 0) +
        1;
      break;
    case "magnetoHero:white": {
      const p = e.target.startsWith("hero:")
        ? seatView(s, e.target.slice(5)).player
        : ports.find(s, e.target);
      if (p) {
        const key =
          e.status === "stunned"
            ? "stunCards"
            : e.status === "confused"
              ? "confuseCards"
              : "toughCards";
        const n = Math.max(
          0,
          Number(p[key as keyof typeof p] || Number(p[e.status as "stunned"])) -
            1,
        );
        (p as unknown as Record<string, unknown>)[key] = n;
        (p as unknown as Record<string, unknown>)[e.status] = n > 0;
      }
      break;
    }
    case "magnetoHero:squared-ally":
      pick(
        "Squared Off",
        allyPlaySources(s).filter((p) => ports.canPlayAlly(s, p, 3)),
        M("squared-play"),
      );
      break;
    case "magnetoHero:squared-play": {
      const p = allyPlaySources(s).find((p) => p.id === e.id);
      need(
        p && ports.canPlayAlly(s, p, 3),
        "The chosen ally cannot be played.",
      );
      ports.playAlly(s, p!, 3);
      break;
    }
    case "magnetoHero:you-got-cost": {
      const p = eventPlaySource(s, e.id);
      need(
        p && p.code === "49019" && !blocked(s),
        "You Got This is unavailable.",
      );
      pick(
        '"You Got This!"',
        allies(s),
        M("you-got-pay", { event: p!.id, packet: e.packet, kind: e.kind }),
      );
      break;
    }
    case "magnetoHero:you-got-pay": {
      const p = eventPlaySource(s, e.event),
        ally = allies(s).find((p) => p.id === e.id);
      need(p && ally, "The event or ally moved.");
      const token = `magnetoHeroYouGot:${p!.id}:${s.nextId++}`;
      ports.reaction(
        s,
        p!,
        [
          M("you-got-bonus", {
            token,
            bonus: Number(card(ally!)[e.kind as "attack" | "thwart"] || 0),
          }),
        ],
        [M("you-got-resume", { token, packet: e.packet })],
        [E("discardPiece", { id: ally!.id })],
      );
      break;
    }
    case "magnetoHero:you-got-bonus":
      s.flags[e.token] = e.bonus;
      ports.ready(s);
      break;
    case "magnetoHero:you-got-resume": {
      const bonus = Number(s.flags[e.token] || 0);
      delete s.flags[e.token];
      q({
        ...e.packet,
        amount: Number(e.packet.amount || 0) + bonus,
        magnetoHeroYouGotHandled: false,
      });
      break;
    }
    case "magnetoHero:recruits": {
      const players: string[] = e.players || [];
      if (!players.length) break;
      const seat = players[0],
        view = seatView(s, seat);
      const choices = playerOrder(s)
        .flatMap((seat) => seatView(s, seat).player.setAside || [])
        .filter((p) => MAGNETO_HERO_NEW_ALLIES.includes(p.code));
      if (choices.length)
        ports.queue(s, M("recruit-choice", { actorId: seat, players }));
      else q({ ...e, players: players.slice(1) });
      break;
    }
    case "magnetoHero:recruit-choice":
      pick(
        "New Recruits",
        playerOrder(s)
          .flatMap((seat) => seatView(s, seat).player.setAside || [])
          .filter((p) => MAGNETO_HERO_NEW_ALLIES.includes(p.code)),
        M("recruit-take", { players: e.players }),
      );
      break;
    case "magnetoHero:recruit-take": {
      const owner = playerOrder(s).find((seat) =>
        (seatView(s, seat).player.setAside || []).some((p) => p.id === e.id),
      );
      need(owner, "The New ally moved.");
      const reserve = seatView(s, owner!).player.setAside!;
      const i = reserve.findIndex((p) => p.id === e.id);
      const p = reserve.splice(i, 1)[0];
      p.ownerId = s.activePlayerId;
      s.player.hand.push(p);
      q(M("recruits", { players: (e.players as string[]).slice(1) }));
      break;
    }
    case "magnetoHero:past-after": {
      s.flags.magnetoHeroFacePastPhase = phase(s);
      const zones = [s.resolving, s.player.discard];
      for (const z of zones) {
        const i = z.findIndex((p) => p.id === e.id);
        if (i >= 0) {
          s.removed.push(z.splice(i, 1)[0]);
          break;
        }
      }
      ports.ready(s);
      q(E("draw", { amount: 3 }));
      break;
    }
    case "magnetoHero:obligation":
      ports.keepObligation(s, e.piece);
      break;
    case "magnetoHero:obligation-remove":
      need(
        s.heroId === "magneto" &&
          s.player.form === "alter" &&
          !s.player.exhausted,
        "Exhaust Erik Lehnsherr in alter ego.",
      );
      s.player.exhausted = true;
      ports.discard(s, e.id);
      break;
    case "magnetoHero:shaw": {
      const p = s.minions.find((p) => p.id === e.id && p.code === "49038");
      if (p && !isTextBlank(s, p)) {
        ports.assignBoost(s, p.id);
        globalFlags(s)[`magnetoHeroShaw:${p.id}`] = phase(s);
      }
      break;
    }
    case "magnetoHero:decadence":
      ports.assignBoost(s, s.villain.id, e.piece);
      break;
    case "magnetoHero:selene-boost":
      pick(
        "Selene",
        allies(s),
        M("discard", { encounter: true, source: e.source }),
      );
      break;
    case "magnetoHero:pawn-boost":
      ports.putMinion(s, e.piece, s.activePlayerId, []);
      break;
    case "magnetoHero:repeat-boost":
      ports.repeatActivation(s, M("repeat"));
      break;
    case "magnetoHero:repeat":
      ports.activate(s, e.enemy, e.player, e.after, true);
      break;
    case "magnetoHero:acolytes": {
      const entries: { id: string; player: string }[] = e.entries || [];
      if (!entries.length) {
        if (!e.activated) {
          let found: Piece | undefined;
          while (s.encounter.deck.length) {
            const r = ports.discardEncounterTop(s);
            if (!r.piece) break;
            if (
              card(r.piece).type_code === "minion" &&
              trait(r.piece, "Acolyte")
            ) {
              found = r.piece;
              break;
            }
            if (r.emptied) break;
          }
          if (found) ports.reveal(s, found);
        }
        break;
      }
      const [first, ...rest] = entries,
        p = s.minions.find((p) => p.id === first.id);
      const next = M("acolyte-after", {
        entries: rest,
        activated: e.activated,
        original: e.original,
      });
      if (p && ports.canActivate(s, p))
        ports.activate(s, p.id, first.player, next);
      else q({ ...next, performed: false });
      break;
    }
    case "magnetoHero:acolyte-after":
      q(
        M("acolytes", {
          entries: e.entries,
          activated: Number(e.activated || 0) + Number(!!e.performed),
          original: e.original,
          actorId: e.original,
        }),
      );
      break;
    case "magnetoHero:shadows": {
      if (s.flags.nemesis) {
        q(E("surge"));
        break;
      }
      s.flags.nemesis = true;
      const reserve = s.player.setAside || [];
      const take = (code: string) => {
        const i = reserve.findIndex((p) => p.code === code);
        return i >= 0 ? reserve.splice(i, 1)[0] : undefined;
      };
      const m = take("49028"),
        scheme = take("49029");
      for (const code of ["49030", "49031", "49032"]) {
        const p = take(code);
        if (p) s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      if (m)
        ports.putMinion(
          s,
          m,
          s.activePlayerId,
          scheme ? [M("reveal", { piece: scheme })] : [],
        );
      else if (scheme) ports.reveal(s, scheme);
      break;
    }
    case "magnetoHero:reveal":
      ports.reveal(s, e.piece);
      break;
    default:
      throw Error(`Unknown Magneto hero effect: ${e.type}`);
  }
  return true;
}
