import { card } from "./card-definitions.js";
import { eventPlaySource, eventPlaySources, isTextBlank } from "./card-text.js";
import { allInPlay, controlledNPCs, playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const A = (type: string, args: Record<string, unknown> = {}) =>
  E(`angel:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const trait = (p: Piece | Card, name: string) =>
  (card(p.code).traits || "")
    .toLowerCase()
    .split(/\.\s*/)
    .includes(name.toLowerCase());
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
export const ANGEL_SCRIPT_CODES = [
  "42001a",
  "42001b",
  "42001c",
  ...Array.from({ length: 31 }, (_, i) => String(42002 + i)),
];
export type AngelForm = "alter" | "angel" | "archangel";
export interface AngelTarget {
  id: string;
  label: string;
  code?: string;
}
export interface AngelPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  identityBlank(s: GameState): boolean;
  maxHP(s: GameState): number;
  permanent(s: GameState, p: Piece): boolean;
  canReady(s: GameState, id: string): boolean;
  ready(s: GameState, id: string): void;
  exhaust(s: GameState, id: string): void;
  friendly(s: GameState): AngelTarget[];
  controlled(s: GameState): AngelTarget[];
  damage(s: GameState, id: string): number;
  enemies(s: GameState, attack: boolean): AngelTarget[];
  schemes(s: GameState, thwart: boolean, ignore?: boolean): AngelTarget[];
  heal(s: GameState, id: string, amount: number): void;
  discard(s: GameState, id: string): void;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  cost(s: GameState, p: Piece): number;
  canPay(s: GameState, p: Piece): boolean;
  playReaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
  ): void;
  playAction(s: GameState, p: Piece): void;
  canPlayAction(s: GameState, p: Piece): boolean;
  flip(s: GameState, target?: AngelForm): void;
  attack(s: GameState, id: string, after: Effect[], taunt?: boolean): void;
  batch(s: GameState, ids: string[], amount: number, source: string): void;
  attach(s: GameState, p: Piece, id: string): void;
  reveal(s: GameState, p: Piece): void;
  cancelReveal(s: GameState, p: Piece): void;
  discardPlayerCards(s: GameState, count: number): Piece[];
  dealEncounter(s: GameState, playerId: string): void;
}
export function angelForm(s: GameState): AngelForm {
  return s.player.form === "alter" ? "alter" : s.player.angelForm || "angel";
}
const namedForm = (s: GameState, form: AngelForm) =>
  s.heroId === "angel" && angelForm(s) === form;
export function angelIdentityCode(s: GameState) {
  return angelForm(s) === "alter"
    ? "42001b"
    : angelForm(s) === "archangel"
      ? "42001c"
      : "42001a";
}
export function angelAcceleration(s: GameState) {
  return playerOrder(s).filter(
    (seat) =>
      seat.heroId === "angel" && angelForm(seatView(s, seat)) === "archangel",
  ).length;
}
export function angelHazards(s: GameState) {
  return allInPlay(s).filter((p) => p.code === "42024").length;
}
export function angelInitialize(
  s: GameState,
  ports: Pick<AngelPorts, "makePiece">,
) {
  if (s.heroId !== "angel" || s.flags.angelInitialized) return;
  s.flags.angelInitialized = true;
  s.player.angelForm = "angel";
  (s.player.setAside ||= []).push(
    ...["42025", "42026", "42027", "42028", "42028"].map((code) =>
      ports.makePiece(s, code),
    ),
  );
}
export function angelEventAction(s: GameState, p: Piece) {
  return p.code === "42003" && s.heroId === "angel"
    ? angelForm(s) === "archangel"
      ? "attack"
      : "thwart"
    : undefined;
}
export function angelDiscount(s: GameState, p: Piece | Card) {
  return card(p.code).type_code === "event" &&
    trait(p, "Aerial") &&
    s.flags.angelWingsPhase === phase(s)
    ? Number(s.flags.angelWingsDiscount || 0)
    : 0;
}
export function angelCardPlayed(s: GameState, p: Piece) {
  if (card(p).type_code === "event" && trait(p, "Aerial"))
    delete s.flags.angelWingsDiscount;
}
export function angelResourceSpent(
  s: GameState,
  spent: Piece,
  target?: Piece,
): Effect[] {
  return spent.code === "42008" &&
    target &&
    card(target).type_code === "event" &&
    trait(target, "Aerial")
    ? [
        E("optional", {
          title: "Avian Anatomy",
          text: "Return this Aerial event to your hand after its effects resolve?",
          effects: [A("anatomy", { eventId: target.id })],
        }),
      ]
    : [];
}
export function angelEventFinished(
  s: GameState,
  p: Piece,
  ports: AngelPorts,
): Effect[] {
  const effects: Effect[] = [];
  if (s.flags[`angelReturn:${p.id}`]) {
    delete s.flags[`angelReturn:${p.id}`];
    effects.push(A("return-event", { id: p.id }));
  }
  if (
    s.heroId !== "angel" ||
    s.player.form !== "hero" ||
    ports.identityBlank(s) ||
    !trait(p, "Aerial")
  )
    return effects;
  const form = angelForm(s),
    key = form === "angel" ? "angelLifePhase" : "angelDeathPhase";
  if (s.flags[key] === phase(s)) return effects;
  if (
    form === "archangel" &&
    (!(card(p).cost! > 0) || !ports.enemies(s, false).length)
  )
    return effects;
  effects.push(
    E("optional", {
      title: form === "angel" ? "Angel of Life" : "Angel of Death",
      text:
        form === "angel"
          ? "Draw 1 card?"
          : `Deal ${card(p).cost || 0} damage to an enemy?`,
      effects: [
        A("identity-response", { key, form, amount: card(p).cost || 0 }),
      ],
    }),
  );
  return effects;
}
export function angelAbilityOptions(
  s: GameState,
  id: string,
  ports: AngelPorts,
): Option[] {
  if (id === "identity")
    return s.heroId === "angel" &&
      s.player.form === "alter" &&
      !ports.identityBlank(s) &&
      s.player.hp < ports.maxHP(s) &&
      s.flags.angelRegrowthRound !== s.round
      ? [O("regrowth", "Regrowth · heal 1", [A("regrowth")], "42001b")]
      : [];
  const p = own(s, id);
  if (!p || isTextBlank(s, p)) return [];
  if (p.code === "42024" && s.player.form === "alter")
    return [
      O(
        "influence",
        "Deal first player an encounter card · discard",
        [A("discard-obligation", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "42018" &&
    s.player.form === "alter" &&
    p.counters > 0 &&
    s.player.hp < ports.maxHP(s)
  )
    return [
      O("aerie", "Angel's Aerie · heal fatigue", [A("aerie", { id })], p.code),
    ];
  if (p.exhausted) return [];
  if (p.code === "42009" && s.player.discard.some((q) => trait(q, "Aerial")))
    return [
      O(
        "industries",
        "Worthington Industries · recycle Aerial",
        [A("industries", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "42010" &&
    s.heroId === "angel" &&
    s.player.form === "hero" &&
    (angelForm(s) === "archangel" || ports.canReady(s, "hero"))
  )
    return [O("wings", "Techno-Organic Wings", [A("wings", { id })], p.code)];
  return [];
}
const aerialReady = (s: GameState, ports: AngelPorts, all = false) =>
  (all ? ports.friendly(s) : ports.controlled(s)).filter(
    (t) =>
      ports.hasTrait(s, t.id, "Aerial") &&
      (t.id === "hero" || t.id.startsWith("hero:")
        ? !seatView(s, t.id === "hero" ? s.activePlayerId : t.id.slice(5))
            .player.exhausted
        : !ports.find(s, t.id)?.exhausted),
  );
export function angelPlayRestriction(
  s: GameState,
  p: Piece,
  ports: AngelPorts,
): string | null {
  if (p.code === "42003" && s.heroId !== "angel")
    return "Adaptive Plumage requires Angel or Archangel form.";
  if (["42004", "42014"].includes(p.code))
    return "Play this event during its attack interrupt window.";
  if (
    ["42011", "42032"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "X-Force") &&
    !(p.code === "42011" && ports.hasTrait(s, "hero", "X-Men"))
  )
    return "Your identity needs the printed X-Force or X-Men trait.";
  if (p.code === "42015" && !ports.hasTrait(s, "hero", "Aerial"))
    return "Your identity needs Aerial.";
  if (p.code === "42029" && !aerialReady(s, ports).length)
    return "A ready Aerial character is required.";
  if (
    p.code === "42031" &&
    !ports
      .friendly(s)
      .some((t) => ports.hasTrait(s, t.id, "Aerial") && ports.canReady(s, t.id))
  )
    return "An exhausted Aerial character is required.";
  if (
    p.code === "42019" &&
    !s.sideSchemes.some(
      (q) =>
        !ports.permanent(s, q) &&
        !allInPlay(s).some((a) => a.code === p.code && a.attachedTo === q.id),
    )
  )
    return "Choose a non-permanent side scheme without Containment Strategy.";
  if (
    p.code === "42032" &&
    !ports
      .friendly(s)
      .some(
        (t) =>
          !allInPlay(s).some((a) => a.code === p.code && a.attachedTo === t.id),
      )
  )
    return "Each character can have only one X-Force Recruit.";
  return null;
}
export function angelEvent(s: GameState, p: Piece): Effect[] | null {
  const types: Record<string, string> = {
    "42003": "plumage",
    "42004": "agility",
    "42005": "metamorphosis",
    "42006": "flight",
    "42007": "dive",
    "42014": "intervention",
    "42016": "taunt",
    "42029": "bombs",
    "42031": "formation",
  };
  if (p.code === "42015")
    return [
      E("ready", { target: "hero" }),
      E("thwart", {
        target: "main",
        amount: 2,
        source: "hero",
        ignorePatrol: true,
      }),
    ];
  return types[p.code] ? [A(types[p.code], { piece: p })] : null;
}
export function angelCardEntered(_s: GameState, p: Piece): Effect[] {
  return ["42019", "42032"].includes(p.code) && !p.attachedTo
    ? [A("attach-player", { id: p.id })]
    : [];
}
export function angelRecruitBonus(s: GameState, target: string) {
  const id = target === "hero" ? `hero:${s.activePlayerId}` : target;
  return allInPlay(s).filter(
    (p) => p.code === "42032" && p.attachedTo === id && !isTextBlank(s, p),
  ).length;
}
export function angelConsequential(s: GameState, p: Piece, amount: number) {
  return p.code === "42020" && !isTextBlank(s, p)
    ? Math.max(
        0,
        amount - s.player.hand.filter((q) => trait(q, "Aerial")).length,
      )
    : amount;
}
export function angelAllyUsed(
  s: GameState,
  p: Piece,
  attack: boolean,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (
    p.code === "42002" &&
    attack &&
    s.heroId === "angel" &&
    s.player.form === "hero"
  )
    return [
      E("optional", {
        title: "Psylocke",
        text:
          angelForm(s) === "angel"
            ? "Heal 1 damage from Psylocke?"
            : "Ready your hero?",
        effects: [A("psylocke", { id: p.id, form: angelForm(s) })],
      }),
    ];
  if (p.code === "42011")
    return [
      E("optional", {
        title: "Elixir",
        text: "Heal 1 damage from another friendly character?",
        effects: [A("elixir", { id: p.id })],
      }),
    ];
  if (p.code === "42012" && attack)
    return [
      E("optional", {
        title: "Siryn",
        text: "Stun a minion?",
        effects: [A("siryn")],
      }),
    ];
  return [];
}
export function angelBasicOptions(
  s: GameState,
  id: string,
  power: string,
  after: Effect[],
  ports: AngelPorts,
): Option[] {
  if (s.player.form !== "hero" || !ports.hasTrait(s, id, "Aerial")) return [];
  return s.player.inPlay
    .filter((p) => p.code === "42023" && !p.exhausted && !isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        `Soaring Acrobatics · +1 ${power}`,
        [A("acrobatics", { id: p.id, target: id, power, after })],
        p.code,
      ),
    );
}
export function angelDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: AngelPorts,
): Option[] {
  if (
    !s.attack ||
    s.heroId !== "angel" ||
    s.player.form !== "hero" ||
    (s.attack.angelTauntPlayerId &&
      s.attack.angelTauntPlayerId !== s.activePlayerId)
  )
    return [];
  return s.player.hand
    .filter((p) => p.code === "42004" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Aerial Agility",
        [A("pay-reaction", { id: p.id, effects: angelEvent(s, p), after })],
        p.code,
      ),
    );
}
export function angelDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: AngelPorts,
): Option[] {
  if (!(packet.amount > 0) || !aerialReady(s, ports).length) return [];
  return eventPlaySources(s)
    .filter((p) => p.code === "42014" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Aerial Intervention · prevent up to 3",
        [
          A("pay-reaction", {
            id: p.id,
            effects: [A("intervention", { packet })],
            after,
          }),
        ],
        p.code,
      ),
    );
}
export function angelDefenseResponses(
  s: GameState,
  r: Record<string, any>,
  ports: AngelPorts,
): Effect[] {
  const effects: Effect[] = [];
  if (r.heroDefended) {
    const v = seatView(s, r.playerId);
    for (const p of v.player.inPlay.filter(
      (p) => p.code === "42018" && !isTextBlank(s, p),
    ))
      effects.push(
        E("optional", {
          title: "Angel's Aerie",
          text: "Place 1 fatigue counter?",
          actorId: r.playerId,
          effects: [A("fatigue", { id: p.id })],
        }),
      );
    for (const p of allInPlay(s).filter(
      (p) =>
        p.code === "42019" &&
        !isTextBlank(s, p) &&
        s.sideSchemes.some((q) => q.id === p.attachedTo),
    ))
      effects.push(
        E("optional", {
          title: "Containment Strategy",
          text: `Remove ${r.heroDamage ? 1 : 2} threat from attached scheme?`,
          effects: [
            E("thwart", {
              target: p.attachedTo,
              amount: r.heroDamage ? 1 : 2,
              source: p.id,
              ignoreCrisis: true,
              ignorePatrol: true,
            }),
          ],
        }),
      );
  }
  const ally = ports.find(s, r.defender);
  if (ally?.code === "42013" && !isTextBlank(s, ally)) {
    const seat = playerOrder(s).find((q) =>
      seatView(s, q).player.inPlay.some((p) => p.id === ally.id),
    );
    if (seat && seatView(s, seat).player.form === "hero")
      effects.push(
        E("optional", {
          title: "Warpath",
          text: "Play a Hero Action event from your hand, paying its cost?",
          actorId: seat.id,
          effects: [A("warpath")],
        }),
      );
  }
  return effects;
}
export function angelRevealOptions(
  s: GameState,
  p: Piece,
  ports: AngelPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    card(p).type_code !== "minion" ||
    trait(p, "Elite") ||
    !aerialReady(s, ports).length
  )
    return [];
  return s.player.inPlay
    .filter((q) => q.code === "42030" && !isTextBlank(s, q))
    .map((q) =>
      O(
        q.id,
        "Eyes in the Sky · cancel this minion",
        [A("eyes", { id: q.id, piece: p })],
        q.code,
      ),
    );
}
export function angelIndirectExhaust(s: GameState) {
  return s.sideSchemes.some((p) => p.code === "42026" && !isTextBlank(s, p));
}
export function angelIndirectAttack(s: GameState, p: Piece) {
  return angelIndirectExhaust(s) && trait(p, "Brute");
}
export function angelEnemyAttackModifier(
  s: GameState,
  p: Piece,
  ports: Pick<AngelPorts, "hasTrait">,
) {
  if (p.code !== "42025" || isTextBlank(s, p)) return 0;
  const a = s.attack;
  const target =
    a?.attacker === p.id && a.defender && !["none", "hero"].includes(a.defender)
      ? a.defender
      : `hero:${a?.targetPlayerId || p.engagedWith || s.activePlayerId}`;
  return Number(ports.hasTrait(s, target, "Aerial"));
}
export function angelAfterEnemyAttack(s: GameState, id: string): Effect[] {
  return s.attachments
    .filter(
      (p) => p.code === "42027" && p.attachedTo === id && !isTextBlank(s, p),
    )
    .map((p) => A("indirect", { amount: 2, source: p.id }));
}
export function angelEncounter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "42024") return [A("obligation", { piece: p })];
  if (p.code === "42025" || p.code === "42028")
    return [A("mill-event", { source: p.id, surge: p.code === "42028" })];
  if (p.code === "42027") return [A("harpoon", { piece: p })];
  return p.code === "42026" ? [] : null;
}
export function angelBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "42028"
    ? [A("indirect", { amount: 2, source: p.id })]
    : null;
}
export function angelShadows(s: GameState): Effect[] | null {
  return s.heroId === "angel" ? [A("nemesis")] : null;
}
export function angelPlayerSideSchemeDefeated(
  s: GameState,
  p: Piece,
): Effect[] {
  return p.code === "42017"
    ? playerOrder(s).map((seat) =>
        A("medical-aid", { actorId: seat.id, remaining: 5 }),
      )
    : [];
}
function select(
  s: GameState,
  title: string,
  targets: AngelTarget[],
  effect: Effect,
  ports: AngelPorts,
  optional = false,
) {
  if (!targets.length) return;
  ports.choose(s, title, "Choose a character or scheme.", [
    ...targets.map((t) =>
      O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
    ),
    ...(optional ? [O("done", "Done", [])] : []),
  ]);
}
export function resolveAngelEffect(
  s: GameState,
  e: Effect,
  ports: AngelPorts,
): boolean {
  if (!e.type.startsWith("angel:")) return false;
  switch (e.type) {
    case "angel:regrowth":
      need(
        s.flags.angelRegrowthRound !== s.round && s.player.form === "alter",
        "Regrowth is unavailable.",
      );
      s.flags.angelRegrowthRound = s.round;
      ports.heal(s, "hero", 1);
      break;
    case "angel:identity-response":
      s.flags[e.key] = phase(s);
      if (e.form === "angel") ports.queue(s, E("draw", { amount: 1 }));
      else
        select(
          s,
          "Angel of Death",
          ports.enemies(s, false),
          E("damage", { amount: e.amount, source: "hero" }),
          ports,
        );
      break;
    case "angel:anatomy":
      s.flags[`angelReturn:${e.eventId}`] = true;
      break;
    case "angel:return-event": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "angel:industries": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "Worthington Industries is exhausted.");
      select(
        s,
        "Worthington Industries",
        s.player.discard
          .filter((p) => trait(p, "Aerial"))
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        A("industries-take", { id: e.id }),
        ports,
      );
      break;
    }
    case "angel:industries-take": {
      const source = own(s, e.id)!,
        i = s.player.discard.findIndex(
          (p) => p.id === e.target && trait(p, "Aerial"),
        );
      need(
        source && !source.exhausted && i >= 0,
        "The selected physical Aerial card is unavailable.",
      );
      source.exhausted = true;
      s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      ports.shuffle(s);
      if (s.player.form === "alter") ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "angel:wings": {
      const p = own(s, e.id)!;
      need(
        p && !p.exhausted && s.player.form === "hero",
        "Techno-Organic Wings is unavailable.",
      );
      p.exhausted = true;
      if (namedForm(s, "angel")) ports.ready(s, "hero");
      else if (namedForm(s, "archangel")) {
        const previous =
          s.flags.angelWingsPhase === phase(s)
            ? Number(s.flags.angelWingsDiscount || 0)
            : 0;
        s.flags.angelWingsPhase = phase(s);
        s.flags.angelWingsDiscount = previous + 2;
      }
      break;
    }
    case "angel:plumage":
      if (namedForm(s, "archangel"))
        select(
          s,
          "Adaptive Plumage",
          ports.enemies(s, true),
          A("plumage-hit"),
          ports,
        );
      else if (namedForm(s, "angel")) {
        select(
          s,
          "Adaptive Plumage",
          ports.schemes(s, true),
          E("thwart", { amount: 3, source: "hero", thwart: true }),
          ports,
        );
        ports.queue(s, A("confuse"));
      }
      break;
    case "angel:plumage-hit":
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 4,
          attack: true,
          source: "hero",
        }),
        E("status", { target: e.target, status: "stunned" }),
      );
      break;
    case "angel:confuse":
      select(
        s,
        "Adaptive Plumage",
        ports.enemies(s, false),
        E("status", { status: "confused" }),
        ports,
      );
      break;
    case "angel:metamorphosis": {
      if (s.heroId !== "angel") {
        ports.flip(s);
        break;
      }
      const current = angelForm(s);
      ports.choose(
        s,
        "Metamorphosis",
        "Change to a different form.",
        (["alter", "angel", "archangel"] as const)
          .filter((f) => f !== current)
          .map((f) =>
            O(
              f,
              f === "alter"
                ? "Warren Worthington III"
                : f === "angel"
                  ? "Angel"
                  : "Archangel",
              [A("metamorphosis-change", { form: f })],
              f === "alter" ? "42001b" : f === "angel" ? "42001a" : "42001c",
            ),
          ),
      );
      break;
    }
    case "angel:metamorphosis-change":
      ports.flip(s, e.form);
      if (!namedForm(s, e.form)) break;
      if (e.form === "alter") ports.queue(s, E("draw", { amount: 1 }));
      else if (e.form === "angel")
        select(
          s,
          "Metamorphosis",
          ports.schemes(s, false),
          E("thwart", { amount: 2, source: "hero", ignorePatrol: true }),
          ports,
        );
      else
        select(
          s,
          "Metamorphosis",
          ports.enemies(s, false),
          E("damage", { amount: 3, source: "hero" }),
          ports,
        );
      break;
    case "angel:flight":
      select(
        s,
        "Natural Flight",
        ports.schemes(s, true, namedForm(s, "angel")),
        E("thwart", {
          amount: 4,
          source: "hero",
          thwart: true,
          ignoreCrisis: namedForm(s, "angel"),
          ignorePatrol: namedForm(s, "angel"),
        }),
        ports,
      );
      break;
    case "angel:dive":
      select(
        s,
        "Razor Dive",
        ports.enemies(s, true),
        E("damage", {
          amount: 6,
          source: "hero",
          attack: true,
          overkill: namedForm(s, "archangel"),
          piercing: namedForm(s, "archangel"),
        }),
        ports,
      );
      break;
    case "angel:pay-reaction": {
      const p = eventPlaySource(s, e.id);
      need(p, "The reaction event is unavailable to play.");
      ports.playReaction(s, p!, e.effects, e.after || []);
      break;
    }
    case "angel:agility":
      if (s.attack) {
        if (namedForm(s, "angel")) s.attack.angelIgnoreBoosts = true;
        else if (namedForm(s, "archangel")) {
          s.attack.angelRetaliatePlayerId = s.activePlayerId;
          s.attack.angelRetaliate = Number(s.attack.angelRetaliate || 0) + 1;
          ports.queue(s, E("status", { target: "hero", status: "tough" }));
        }
      }
      break;
    case "angel:intervention":
      select(
        s,
        "Aerial Intervention",
        aerialReady(s, ports),
        A("intervention-exhaust", { packet: e.packet }),
        ports,
      );
      break;
    case "angel:intervention-exhaust":
      ports.exhaust(s, e.target);
      if (s.attack && e.packet?.damageWindowId === s.attack.id)
        s.attack.prevented += 3;
      else if (e.packet) {
        const pending = s.queue.find(
          (q) =>
            q.angelDamageHandled && q.angelPacketId === e.packet.angelPacketId,
        );
        if (pending) pending.amount = Math.max(0, pending.amount - 3);
      }
      break;
    case "angel:taunt":
      ports.attack(s, s.villain.id, [E("draw", { amount: 3 })], true);
      break;
    case "angel:psylocke":
      if (e.form === "angel") {
        if (ports.find(s, e.id)) ports.heal(s, e.id, 1);
      } else ports.ready(s, "hero");
      break;
    case "angel:elixir":
      select(
        s,
        "Elixir",
        ports
          .friendly(s)
          .filter((t) => t.id !== e.id && ports.damage(s, t.id) > 0),
        E("heal", { amount: 1 }),
        ports,
      );
      break;
    case "angel:siryn":
      select(
        s,
        "Siryn",
        s.minions.map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        E("status", { status: "stunned" }),
        ports,
      );
      break;
    case "angel:acrobatics": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "Soaring Acrobatics is exhausted.");
      p!.exhausted = true;
      if (e.power === "defense" && s.attack)
        s.attack.defenseBonus = Number(s.attack.defenseBonus || 0) + 1;
      ports.queue(
        s,
        ...(e.after || []).map((q: Effect) =>
          e.power === "defense"
            ? q
            : { ...q, amount: Number(q.amount || 0) + 1 },
        ),
      );
      break;
    }
    case "angel:fatigue": {
      const p = ports.find(s, e.id);
      if (p) p.counters++;
      break;
    }
    case "angel:aerie": {
      const p = own(s, e.id)!;
      const n = p.counters;
      p.counters = 0;
      ports.heal(s, "hero", n);
      break;
    }
    case "angel:warpath": {
      const cards = eventPlaySources(s).filter(
        (p) =>
          card(p).type_code === "event" &&
          /Hero Action/.test(card(p).text || "") &&
          ports.canPlayAction(s, p),
      );
      select(
        s,
        "Warpath",
        cards.map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        A("warpath-play"),
        ports,
        true,
      );
      break;
    }
    case "angel:warpath-play": {
      const p = eventPlaySource(s, e.target);
      if (p) ports.playAction(s, p);
      break;
    }
    case "angel:attach-player": {
      const p = own(s, e.id)!;
      const targets =
        p.code === "42019"
          ? s.sideSchemes
              .filter((q) => !ports.permanent(s, q))
              .map((q) => ({ id: q.id, label: card(q).name, code: q.code }))
          : ports.friendly(s);
      select(
        s,
        card(p).name,
        targets.filter(
          (t) =>
            !allInPlay(s).some(
              (q) => q.code === p.code && q.attachedTo === t.id,
            ),
        ),
        A("attach-player-to", { id: p.id }),
        ports,
      );
      break;
    }
    case "angel:attach-player-to": {
      const p = own(s, e.id)!;
      p.attachedTo =
        e.target === "hero" ? `hero:${s.activePlayerId}` : e.target;
      if (p.code === "42032" && p.attachedTo!.startsWith("hero:"))
        seatView(s, p.attachedTo!.slice(5)).player.hp++;
      break;
    }
    case "angel:bombs":
      select(s, "Bombs Away", aerialReady(s, ports), A("bombs-exhaust"), ports);
      break;
    case "angel:bombs-exhaust":
      ports.exhaust(s, e.target);
      ports.choose(
        s,
        "Bombs Away",
        "Choose a player.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.heroId, [A("bombs-hit", { playerId: seat.id })]),
        ),
      );
      break;
    case "angel:bombs-hit":
      ports.batch(
        s,
        [
          s.villain.id,
          ...s.minions
            .filter((p) => (p.engagedWith || s.activePlayerId) === e.playerId)
            .map((p) => p.id),
        ],
        3,
        "hero",
      );
      break;
    case "angel:formation": {
      const targets = ports
        .friendly(s)
        .filter(
          (t) => ports.hasTrait(s, t.id, "Aerial") && ports.canReady(s, t.id),
        );
      if (e.remaining === 0 || !targets.length) break;
      select(
        s,
        "Flying Formation",
        targets,
        A("formation-ready", { remaining: e.remaining ?? 3 }),
        ports,
        true,
      );
      break;
    }
    case "angel:formation-ready":
      ports.ready(s, e.target);
      ports.queue(s, A("formation", { remaining: e.remaining - 1 }));
      break;
    case "angel:eyes":
      select(
        s,
        "Eyes in the Sky",
        aerialReady(s, ports),
        A("eyes-cancel", { id: e.id, piece: e.piece }),
        ports,
      );
      break;
    case "angel:eyes-cancel":
      ports.exhaust(s, e.target);
      ports.discard(s, e.id);
      ports.cancelReveal(s, e.piece);
      ports.queue(s, E("surge", { sourceCode: "42030" }));
      break;
    case "angel:obligation": {
      const p = e.piece as Piece;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      if (!s.player.inPlay.some((q) => q.id === p.id)) s.player.inPlay.push(p);
      if (angelForm(s) === "archangel")
        ports.queue(s, E("threat", { target: "main", amount: 2 }));
      else ports.flip(s, "archangel");
      break;
    }
    case "angel:discard-obligation":
      ports.dealEncounter(s, s.firstPlayerId);
      ports.discard(s, e.id);
      break;
    case "angel:mill-event": {
      const index = s.player.deck.findIndex(
        (p) => card(p).type_code === "event",
      );
      const discarded = ports.discardPlayerCards(
        s,
        index < 0 ? s.player.deck.length : index + 1,
      );
      const event = discarded.find((p) => card(p).type_code === "event");
      if (event)
        ports.queue(
          s,
          A("indirect", { amount: card(event).cost || 0, source: e.source }),
          ...(e.surge && trait(event, "Aerial")
            ? [E("surge", { sourceCode: "42028" })]
            : []),
        );
      break;
    }
    case "angel:indirect":
      ports.queue(
        s,
        E("indirect", {
          amount: e.amount,
          source: e.source,
          zzzaxBatchId: `angel-indirect:${s.nextId++}`,
          zzzaxBatchOwner: s.activePlayerId,
          exhaustDamaged: angelIndirectExhaust(s),
        }),
      );
      break;
    case "angel:harpoon": {
      const harpoon = s.minions.find((p) => p.code === "42025");
      if (harpoon) ports.attach(s, e.piece, harpoon.id);
      else {
        const zones = [s.encounter.deck, s.encounter.discard],
          p = zones.flat().find((p) => p.code === "42025");
        if (!p) {
          ports.cancelReveal(s, e.piece);
          ports.queue(s, E("surge", { sourceCode: "42027" }));
          break;
        }
        for (const z of zones) {
          const i = z.indexOf(p);
          if (i >= 0) z.splice(i, 1);
        }
        ports.shuffleEncounter(s);
        ports.queue(
          s,
          E("reveal", { piece: p }),
          A("harpoon", { piece: e.piece }),
        );
      }
      break;
    }
    case "angel:nemesis": {
      if (s.flags.nemesis) {
        ports.queue(s, E("surge", { sourceCode: "01190" }));
        break;
      }
      s.flags.nemesis = true;
      const zone = s.player.setAside || [],
        pieces = zone.filter((p) => card(p).set_code === "angel_nemesis");
      s.player.setAside = zone.filter((p) => !pieces.includes(p));
      const minion = pieces.find((p) => p.code === "42025"),
        scheme = pieces.find((p) => p.code === "42026");
      s.encounter.deck.push(
        ...pieces.filter((p) => p !== minion && p !== scheme),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...(minion ? [E("reveal", { piece: minion })] : []),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    case "angel:medical-aid": {
      if (e.remaining <= 0) break;
      const targets = ports
        .controlled(s)
        .filter((t) => ports.damage(s, t.id) > 0);
      select(
        s,
        "Render Medical Aid",
        targets,
        A("medical-heal", { remaining: e.remaining }),
        ports,
      );
      break;
    }
    case "angel:medical-heal":
      ports.heal(s, e.target, 1);
      ports.queue(s, A("medical-aid", { remaining: e.remaining - 1 }));
      break;
    default:
      throw Error(`Unknown Angel effect: ${e.type}`);
  }
  return true;
}
