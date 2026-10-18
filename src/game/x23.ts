import { card } from "./card-definitions.js";
import { isTextBlank, eventPlaySources } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const X = (type: string, args: Record<string, unknown> = {}) =>
  E(`x23:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const turn = (s: GameState) => `${s.round}:${s.phase}:${s.turnPlayerId}`;
const active = (s: GameState) => s.heroId === "x23";
const hero = (s: GameState) => active(s) && s.player.form === "hero";
const badger = (s: GameState) => allInPlay(s).find((p) => p.code === "43003");
const names = ["43034", "43035", "43036", "43037"];
const icons = (p: Piece) =>
  ["energy", "mental", "physical", "wild"].reduce(
    (n, r) =>
      n +
      Number(
        (card(p) as unknown as Record<string, number>)[`resource_${r}`] || 0,
      ),
    0,
  );
export const X23_SCRIPT_CODES = [
  "43001a",
  "43001b",
  ...Array.from({ length: 39 }, (_, i) => String(43002 + i)),
];
export interface X23Ports {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  makePiece(s: GameState, code: string): Piece;
  find(s: GameState, id: string): Piece | undefined;
  canReady(s: GameState): boolean;
  ready(s: GameState): void;
  maxHP(s: GameState): number;
  stats(s: GameState): {
    attack: number;
    thwart: number;
    defense: number;
    recover: number;
  };
  allyStat(s: GameState, p: Piece, power: "attack" | "thwart"): number;
  allyHP(s: GameState, p: Piece): number;
  canTakeDamageCost(s: GameState, amount: number): boolean;
  takeDamageCost(s: GameState, amount: number): boolean;
  damageCostResponses(s: GameState, amount: number): Effect[];
  canPay(s: GameState, p: Piece): boolean;
  reaction(s: GameState, p: Piece, effects: Effect[], after: Effect[]): void;
  discard(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  discardEncounterTop(s: GameState): Piece | undefined;
  randomDiscard(s: GameState): Piece | undefined;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  hidden(s: GameState): void;
  attach(s: GameState, p: Piece, target: string): void;
  keepObligation(s: GameState, p: Piece): void;
  putMinion(s: GameState, p: Piece): void;
  indirect(s: GameState, amount: number, source: string): void;
  heal(s: GameState, id: string, amount: number): void;
  batch(s: GameState, ids: string[], amount: number, source: string): void;
  canStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  cancelReveal(s: GameState, p: Piece): void;
  declareDefense(s: GameState): void;
  permanent(s: GameState, p: Piece): boolean;
}
export function x23Initialize(
  s: GameState,
  ports: Pick<X23Ports, "makePiece">,
) {
  if (s.flags.x23Initialized) return;
  if (s.player.deck.some((p) => p.code === "43021"))
    for (const code of names)
      (s.player.setAside ||= []).push(ports.makePiece(s, code));
  if (!active(s)) return;
  const i = s.player.deck.findIndex((p) => p.code === "43002");
  const claws =
    i >= 0 ? s.player.deck.splice(i, 1)[0] : ports.makePiece(s, "43002");
  claws.ownerId = s.activePlayerId;
  (s.player.setAside ||= []).push(claws);
  for (const code of ["43029", "43030", "43031", "43032", "43033"])
    s.player.setAside.push(ports.makePiece(s, code));
  s.flags.x23Initialized = true;
}
export function x23Setup(s: GameState): Effect[] {
  if (!active(s)) return [];
  const zone = s.player.setAside || [];
  const i = zone.findIndex((p) => p.code === "43002");
  if (i >= 0) s.player.inPlay.push(zone.splice(i, 1)[0]);
  return [];
}
export function x23Stats(s: GameState) {
  return {
    attack:
      (hero(s)
        ? Number(s.flags.x23ClawBonus || 0) +
          Number(s.flags.x23MasteryBonus || 0)
        : 0) + (s.player.form === "hero" ? live(s, "43034").length : 0),
    thwart: s.player.form === "hero" ? live(s, "43037").length : 0,
    defense: s.player.form === "hero" ? live(s, "43035").length : 0,
    health: live(s, "43009").length * 2 + live(s, "43036").length * 4,
    piercing:
      hero(s) &&
      allInPlay(s).some((p) => p.code === "43009" && !isTextBlank(s, p)),
    retaliate: hero(s)
      ? allInPlay(s).filter((p) => p.code === "43009" && !isTextBlank(s, p))
          .length
      : 0,
    overkill: hero(s) && !!s.flags.x23MasteryBonus && !!badger(s),
  };
}
export function x23Mad(s: GameState, startingHP: number) {
  return s.player.form === "hero" && s.player.hp < startingHP / 2
    ? live(s, "43019").length
    : 0;
}
export function x23ResourceSources(s: GameState): PaymentSource[] {
  return live(s, "43010")
    .filter((p) => !p.exhausted && s.player.hp >= 1 && !s.player.tough)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      resources: ["wild"],
      kind: "ability",
      description: "Exhaust and take 1 damage to generate a wild resource.",
    }));
}
export function x23ResourceSpent(
  s: GameState,
  id: string,
  ports: X23Ports,
): Effect[] | null {
  const p = own(s, id);
  if (p?.code !== "43010") return null;
  need(
    !p.exhausted && !isTextBlank(s, p) && ports.canTakeDamageCost(s, 1),
    "Grim Resolve requires taking its full damage cost.",
  );
  p.exhausted = true;
  ports.takeDamageCost(s, 1);
  return [
    ...ports.damageCostResponses(s, 1),
    ...x23Damaged(s, "hero", 1, false, ports),
  ];
}
export function x23Damaged(
  s: GameState,
  target: string,
  amount: number,
  enemyAttack: boolean,
  ports: X23Ports,
): Effect[] {
  if (amount <= 0 || ["won", "lost"].includes(s.phase)) return [];
  const effects: Effect[] = [];
  if (target === "hero") {
    if (
      hero(s) &&
      !isTextBlank(s, { code: "43001a", id: `hero:${s.activePlayerId}` }) &&
      s.flags.x23LivingPhase !== phase(s) &&
      ports.canReady(s)
    )
      effects.push(
        X("ready-window", {
          living: true,
          actorId: s.activePlayerId,
          mandatory: false,
        }),
      );
    if (enemyAttack) effects.push(...specialist(s, "43036"));
  } else {
    // Defeated Honey Badger has left play before this response window (RRG1.8 p64).
    const p = allInPlay(s).find(
      (q) =>
        q.id === target &&
        q.code === "43003" &&
        !isTextBlank(s, q) &&
        q.damage < ports.allyHP(s, q),
    );
    const owner = p && controller(s, p.id);
    if (p && owner && seatView(s, owner).player.form === "hero")
      for (const seat of playerOrder(s)) {
        const view = seatView(s, seat);
        if (hero(view) && ports.canReady(view))
          effects.push(
            X("ready-window", {
              badgerId: p.id,
              actorId: seat.id,
              mandatory: false,
            }),
          );
      }
  }
  return effects;
}
function specialist(s: GameState, code: string) {
  return live(s, code)
    .filter((p) => !p.exhausted)
    .map((p) =>
      X("specialist-window", {
        id: p.id,
        actorId: s.activePlayerId,
        mandatory: false,
      }),
    );
}
export function x23BasicUsed(s: GameState, power: string) {
  return s.player.form === "hero"
    ? specialist(
        s,
        power === "attack" ? "43034" : power === "defense" ? "43035" : "43037",
      )
    : [];
}
export function x23AbilityOptions(
  s: GameState,
  id: string,
  ports: X23Ports,
): Option[] {
  if (["identity", "hero"].includes(id))
    return active(s) &&
      s.player.form === "alter" &&
      !isTextBlank(s, "43001b") &&
      s.flags.x23LauraRound !== s.round &&
      s.player.discard.some((p) => ["43003", "43007"].includes(p.code))
      ? [
          O(
            "family",
            "Shuffle Honey Badger or Sisterly Bond · draw 1",
            [X("family")],
            "43001b",
          ),
        ]
      : [];
  const p = own(s, id);
  if (!p || p.exhausted || isTextBlank(s, p)) return [];
  if (p.code === "43002" && hero(s) && ports.canTakeDamageCost(s, 2))
    return [
      O(
        "claws",
        "X-23's Claws · take 2 damage, +2 ATK",
        [X("claws", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "43008" &&
    s.player.hand.some((q) => card(q).set_code === "x23") &&
    [...s.player.deck, ...s.player.discard].some((q) => q.code === "43003")
  )
    return [
      O(
        "sisterhood",
        "Discard an X-23 card · find Honey Badger",
        [X("sisterhood", { id })],
        p.code,
      ),
    ];
  if (p.code === "43013")
    return [
      O(
        "boom",
        "Add a boom counter · optionally detonate",
        [X("boom", { id })],
        p.code,
      ),
    ];
  return [];
}
export function x23Played(s: GameState, p: Piece): Effect[] {
  return card(p).set_code === "x23"
    ? [X("pain-played", { actorId: s.activePlayerId, mandatory: false })]
    : [];
}
const attacked = (s: GameState, id: string) =>
  s.flags[`x23Attacked:${id}`] === turn(s);
export function x23PlayRestriction(
  s: GameState,
  p: Piece,
  ports: X23Ports,
  response = false,
): string | undefined {
  if (
    !response &&
    ["43004", "43007", "43016", "43017", "43038", "43040"].includes(p.code)
  )
    return "Play this event in its printed interrupt or response window.";
  if (
    p.code === "43005" &&
    !playerOrder(s).some((seat) => hero(seatView(s, seat)))
  )
    return "X-23 must be in hero form to gain this ATK bonus.";
  if (p.code === "43005" && s.flags.x23MasteryRound === s.round)
    return "Claw Mastery is limited to one per round.";
  if (p.code === "43006" && s.player.hp >= ports.maxHP(s) && !badger(s)?.damage)
    return "There is no damage to heal.";
  if (
    p.code === "43012" &&
    ![s.villain, ...s.minions].some((q) => attacked(s, q.id))
  )
    return "X-23 or Honey Badger must have attacked an enemy this turn.";
  if (
    p.code === "43020" &&
    !s.sideSchemes.some(
      (q) =>
        !ports.permanent(s, q) &&
        !allInPlay(s).some((a) => a.code === "43020" && a.attachedTo === q.id),
    )
  )
    return "A non-permanent side scheme without The Direct Approach is required.";
  if (
    ["43016", "43038", "43040"].includes(p.code) &&
    !(s.victoryDisplay || []).some((q) =>
      ["side_scheme", "player_side_scheme"].includes(card(q).type_code),
    )
  )
    return "A side scheme must be in the victory display.";
  return undefined;
}
export function x23Event(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "43005") return [X("mastery")];
  if (p.code === "43006") return [X("heal-sisters", { remaining: 4 })];
  if (["43004", "43007", "43016", "43017", "43038", "43040"].includes(p.code))
    return [];
  return null;
}
export function x23Entered(s: GameState, p: Piece): Effect[] {
  if (p.code === "43012") {
    if (p.attachedTo) {
      need(
        attacked(s, p.attachedTo),
        "Puncture Wound requires an enemy attacked this turn.",
      );
      return [];
    }
    return [X("attach-wound", { id: p.id })];
  }
  if (p.code === "43020") return [X("attach-assault", { id: p.id })];
  return [];
}
function reactions(
  s: GameState,
  code: string,
  action: Effect,
  after: Effect[],
  ports: X23Ports,
): Option[] {
  if (s.player.form !== "hero") return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === code &&
        ports.canPay(s, p) &&
        !x23PlayRestriction(s, p, ports, true),
    )
    .map((p) =>
      O(
        p.id,
        `Play ${card(p).name}`,
        [X("reaction", { id: p.id, action, after })],
        p.code,
      ),
    );
}
export function x23BasicOptions(
  s: GameState,
  packet: Effect,
  ports: X23Ports,
): Option[] {
  if (
    !hero(s) ||
    packet.power !== "thwart" ||
    packet.x23Handled ||
    s.player.confused
  )
    return [];
  return reactions(
    s,
    "43004",
    X("animal", { packet: { ...packet, x23Handled: false } }),
    [],
    ports,
  );
}
export function x23AllyOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
  ports: X23Ports,
): Option[] {
  if (
    p.code !== "43003" ||
    packet.x23Handled ||
    (packet.kind === "attack" ? p.stunned : p.confused)
  )
    return [];
  const xseat = playerOrder(s).find((seat) => hero(seatView(s, seat)));
  if (!xseat) return [];
  return reactions(
    s,
    "43007",
    X("bond", {
      packet: { ...packet, x23Handled: false },
      x23PlayerId: xseat.id,
    }),
    [],
    ports,
  );
}
export function x23Shatterstar(
  s: GameState,
  p: Piece,
  packet: Effect,
  ports: X23Ports,
): boolean {
  if (
    p.code !== "43015" ||
    packet.kind !== "attack" ||
    packet.x23ShatterstarHandled ||
    p.stunned ||
    isTextBlank(s, p) ||
    !s.minions.some((m) => m.id === packet.target)
  )
    return false;
  const after = { ...packet, x23ShatterstarHandled: true };
  ports.choose(
    s,
    "Shatterstar",
    "Engage the minion, or gain +1 ATK if already engaged?",
    [
      O(
        "yes",
        "Use Shatterstar",
        [X("shatterstar", { packet: after })],
        p.code,
      ),
      O("continue", "Continue without the interrupt", [after]),
    ],
  );
  return true;
}
export function x23AllyUsed(
  s: GameState,
  p: Piece,
  target: string,
  attack: boolean,
): Effect[] {
  if (attack && p.code === "43003")
    for (const seat of playerOrder(s))
      seatView(s, seat).flags[`x23Attacked:${target}`] = turn(s);
  return attack && p.code === "43014" && !isTextBlank(s, p)
    ? [optional("Rictor", [X("rictor")])]
    : [];
}
export function x23HeroAttack(
  s: GameState,
  packet: Effect,
  ports: X23Ports,
): Effect[] {
  if (hero(s))
    for (const seat of playerOrder(s))
      seatView(s, seat).flags[`x23Attacked:${packet.target}`] = turn(s);
  const options =
    ports.find(s, packet.target) && ports.canStatus(s, packet.target, "stunned")
      ? reactions(
          s,
          "43016",
          E("status", { target: packet.target, status: "stunned" }),
          [],
          ports,
        )
      : [];
  if (
    packet.excessDamage > 0 &&
    (!ports.find(s, packet.target) ||
      ports.find(s, packet.target)?.code !== packet.defeatedCode) &&
    s.player.hp < ports.maxHP(s)
  )
    options.push(
      ...reactions(
        s,
        "43017",
        E("heal", { target: "hero", amount: packet.excessDamage }),
        [],
        ports,
      ),
    );
  return options.length
    ? [X("response-choice", { title: "After attacking", options })]
    : [];
}
export function x23Assault(s: GameState, id: string) {
  const p = s.sideSchemes.find((q) => q.id === id);
  return (
    !!p &&
    ((p.code === "43018" && !isTextBlank(s, p)) ||
      allInPlay(s).some(
        (a) => a.code === "43020" && a.attachedTo === id && !isTextBlank(s, a),
      ))
  );
}
export function x23SchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (p.code === "43018")
    return [
      E("thwart", {
        target: "main",
        amount: 5 * s.playerCount,
        ignoreCrisis: true,
      }),
    ];
  if (p.code === "43039")
    return allInPlay(s)
      .filter((q) => card(q).type_code === "ally")
      .map((q) => E("heal", { target: q.id, amount: 2 }));
  if (p.code === "43021")
    return playerOrder(s).map((seat) => X("specialize", { actorId: seat.id }));
  return [];
}
export function x23RevealOptions(
  s: GameState,
  p: Piece,
  fromDeck: boolean,
  after: Effect[],
  ports: X23Ports,
) {
  return fromDeck &&
    card(p).type_code === "treachery" &&
    /When Revealed/i.test(card(p).text || "") &&
    !/cannot be cancel(?:ed|led)/i.test(card(p).text || "")
    ? reactions(
        s,
        "43038",
        X("cancel", {
          piece: p,
          playerId:
            after.find((e) => e.type === "reveal")?.actorId || s.activePlayerId,
        }),
        after,
        ports,
      )
    : [];
}
export function x23DefenseOptions(
  s: GameState,
  after: Effect[],
  ports: X23Ports,
) {
  return ports.canStatus(s, "hero", "tough")
    ? reactions(s, "43040", X("anticipated"), after, ports)
    : [];
}
export function x23EnemyAttackModifier(s: GameState, id: string) {
  return -allInPlay(s).filter(
    (p) => p.code === "43012" && p.attachedTo === id && !isTextBlank(s, p),
  ).length;
}
export function x23EnemyRetaliate(s: GameState) {
  return s.sideSchemes.filter((p) => p.code === "43030" && !isTextBlank(s, p))
    .length;
}
export function x23PhaseStart(s: GameState): Effect[] {
  return allInPlay(s)
    .filter((p) => p.code === "43012" && !isTextBlank(s, p))
    .flatMap((p) => [
      E("discardPiece", { id: p.id, actorId: p.ownerId }),
      E("damage", {
        target: p.attachedTo,
        amount: 3,
        source: p.id,
        actorId: p.ownerId,
      }),
    ]);
}
export function x23TurnEnd(s: GameState): Effect[] {
  for (const seat of playerOrder(s))
    for (const key of Object.keys(seatView(s, seat).flags))
      if (key.startsWith("x23Attacked:")) delete seatView(s, seat).flags[key];
  return s.attachments
    .filter(
      (p) =>
        p.code === "43032" &&
        ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
        !isTextBlank(s, p),
    )
    .flatMap((p) => [
      E("discardPiece", { id: p.id }),
      E("damage", { target: "hero", amount: 4, source: p.id }),
    ]);
}
export function x23Recovered(s: GameState): Effect[] {
  return live(s, "43028").map((p) =>
    optional("Self-Isolation", [E("discardPiece", { id: p.id })]),
  );
}
export function x23Defeated(s: GameState, p: Piece): Effect[] {
  return p.code === "43029" && !isTextBlank(s, p)
    ? [X("deathstrike", { source: p.id })]
    : [];
}
export function x23Cybermods(
  s: GameState,
  p: Piece,
  ports: Pick<X23Ports, "discard" | "shuffleEncounter">,
): boolean {
  const a = s.attachments.find(
    (q) => q.code === "43031" && q.attachedTo === p.id && !isTextBlank(s, q),
  );
  if (!a) return false;
  ports.discard(s, a.id);
  // Once the replacement attachment is gone, the ordinary leaving-play path
  // clears every attached/stored card and status while preserving this ID.
  ports.discard(s, p.id);
  const i = s.encounter.discard.findIndex((q) => q.id === p.id);
  if (i >= 0) s.encounter.deck.push(s.encounter.discard.splice(i, 1)[0]);
  ports.shuffleEncounter(s);
  return true;
}
export function x23Encounter(s: GameState, p: Piece): Effect[] | null {
  if (isTextBlank(s, p) && X23_SCRIPT_CODES.includes(p.code)) return [];
  switch (p.code) {
    case "43028":
      return [X("isolation", { piece: p })];
    case "43029":
    case "43030":
      return [];
    case "43031":
      return [X("cybermods", { piece: p })];
    case "43032":
      return [X("critical", { piece: p })];
    case "43033":
      return [X("hack")];
    default:
      return null;
  }
}
export const x23Boost = (p: Piece): Effect[] | null =>
  p.code === "43033" ? [X("hack")] : null;
export function x23Shadows(s: GameState): Effect[] | null {
  return active(s) ? [X("shadows")] : null;
}
export function resolveX23Effect(
  s: GameState,
  e: Effect,
  ports: X23Ports,
): boolean {
  if (!e.type.startsWith("x23:")) return false;
  const p = e.id ? ports.find(s, e.id) : undefined;
  switch (e.type.slice(4)) {
    case "ready-window": {
      if (
        !hero(s) ||
        !ports.canReady(s) ||
        (e.living &&
          (s.flags.x23LivingPhase === phase(s) || isTextBlank(s, "43001a"))) ||
        (e.badgerId &&
          !allInPlay(s).some((q) => q.id === e.badgerId && !isTextBlank(s, q)))
      )
        break;
      ports.queue(
        s,
        optional(e.living ? "Living Weapon" : "Honey Badger", [
          X("ready", { living: e.living, badgerId: e.badgerId }),
        ]),
      );
      break;
    }
    case "ready":
      if (
        ports.canReady(s) &&
        (!e.living || s.flags.x23LivingPhase !== phase(s))
      ) {
        if (e.living) s.flags.x23LivingPhase = phase(s);
        ports.ready(s);
      }
      break;
    case "claws":
      need(
        p && x23AbilityOptions(s, p.id, ports).some((o) => o.id === "claws"),
        "X-23's Claws is unavailable.",
      );
      p!.exhausted = true;
      ports.takeDamageCost(s, 2);
      s.flags.x23ClawBonus = Number(s.flags.x23ClawBonus || 0) + 2;
      ports.queue(s, ...x23Damaged(s, "hero", 2, false, ports));
      break;
    case "family":
      ports.choose(
        s,
        "Laura Kinney",
        "Shuffle a card into your deck and draw 1.",
        s.player.discard
          .filter((q) => ["43003", "43007"].includes(q.code))
          .map((q) =>
            O(q.id, card(q).name, [X("family-card", { id: q.id })], q.code),
          ),
      );
      break;
    case "family-card": {
      need(
        s.flags.x23LauraRound !== s.round && s.player.form === "alter",
        "Laura's action is unavailable.",
      );
      const i = s.player.discard.findIndex(
        (q) => q.id === e.id && ["43003", "43007"].includes(q.code),
      );
      need(i >= 0, "The selected family card is no longer discarded.");
      s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      s.flags.x23LauraRound = s.round;
      ports.shuffle(s);
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "mastery":
      need(
        s.flags.x23MasteryRound !== s.round,
        "Max 1 Claw Mastery per round.",
      );
      s.flags.x23MasteryRound = s.round;
      for (const seat of playerOrder(s))
        if (hero(seatView(s, seat)))
          seatView(s, seat).flags.x23MasteryBonus = 2;
      break;
    case "heal-sisters": {
      if (!e.remaining) break;
      const b = badger(s);
      const opts = [];
      if (s.player.hp < ports.maxHP(s))
        opts.push(
          O("hero", "Heal your identity 1", [
            E("heal", { target: "hero", amount: 1 }),
            X("heal-sisters", { remaining: e.remaining - 1 }),
          ]),
        );
      if (b?.damage)
        opts.push(
          O(
            b.id,
            "Heal Honey Badger 1",
            [
              E("heal", { target: b.id, amount: 1 }),
              X("heal-sisters", { remaining: e.remaining - 1 }),
            ],
            b.code,
          ),
        );
      if (opts.length)
        ports.choose(
          s,
          "Regenerative Longevity",
          `Distribute ${e.remaining} remaining healing.`,
          opts,
        );
      break;
    }
    case "sisterhood":
      ports.choose(
        s,
        "Sisterhood",
        "Discard an X-23 card from your hand.",
        s.player.hand
          .filter((q) => card(q).set_code === "x23")
          .map((q) =>
            O(
              q.id,
              card(q).name,
              [X("sisterhood-pay", { id: e.id, cardId: q.id })],
              q.code,
            ),
          ),
      );
      break;
    case "sisterhood-pay": {
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "Sisterhood is unavailable.",
      );
      need(
        s.player.hand.some(
          (q) => q.id === e.cardId && card(q).set_code === "x23",
        ),
        "Discard an X-23 card.",
      );
      p!.exhausted = true;
      ports.discardHand(s, e.cardId);
      for (const z of [s.player.deck, s.player.discard]) {
        const i = z.findIndex((q) => q.code === "43003");
        if (i >= 0) {
          s.player.hand.push(z.splice(i, 1)[0]);
          break;
        }
      }
      ports.shuffle(s);
      break;
    }
    case "pain-played":
      ports.queue(
        s,
        ...live(s, "43011").map((q) =>
          X("pain-window", { id: q.id, mandatory: false }),
        ),
      );
      break;
    case "pain-window":
      if (p && !isTextBlank(s, p) && s.player.hp < ports.maxHP(s))
        ports.queue(
          s,
          optional("Pain Tolerance", [
            E("heal", { target: "hero", amount: 1 }),
          ]),
        );
      break;
    case "specialist-window":
      if (p && !p.exhausted && !isTextBlank(s, p))
        ports.queue(
          s,
          optional(card(p).name, [X("specialist-draw", { id: p.id })]),
        );
      break;
    case "specialist-draw":
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "This specialization is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    case "boom":
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "Boom Boom is unavailable.",
      );
      p!.exhausted = true;
      p!.counters++;
      ports.queue(s, optional("Boom Boom", [X("detonate", { id: e.id })]));
      break;
    case "detonate":
      if (p) {
        const amount = p.counters;
        ports.discard(s, p.id);
        ports.batch(
          s,
          [s.villain.id, ...s.minions.map((q) => q.id)],
          amount,
          e.id,
        );
      }
      break;
    case "shatterstar": {
      const ally = ports.find(s, e.packet.id),
        minion = s.minions.find((q) => q.id === e.packet.target);
      if (ally && minion) {
        if ((minion.engagedWith || s.activePlayerId) === s.activePlayerId)
          e.packet.amount =
            (e.packet.amount ?? ports.allyStat(s, ally, "attack")) + 1;
        else minion.engagedWith = s.activePlayerId;
      }
      ports.queue(s, e.packet);
      break;
    }
    case "rictor": {
      const top = ports.discardTop(s).piece;
      if (top)
        ports.batch(
          s,
          s.minions
            .filter(
              (q) => (q.engagedWith || s.activePlayerId) === s.activePlayerId,
            )
            .map((q) => q.id),
          icons(top),
          "Rictor",
        );
      break;
    }
    case "reaction": {
      const q = eventPlaySources(s).find((q) => q.id === e.id);
      need(q && ports.canPay(s, q), "This response is unavailable.");
      ports.reaction(s, q!, [e.action], e.after || []);
      break;
    }
    case "animal":
      ports.queue(s, {
        ...e.packet,
        amount:
          (e.packet.amount ?? ports.stats(s).thwart) + ports.stats(s).attack,
        x23AnimalBonus: (e.packet.x23AnimalBonus || 0) + ports.stats(s).attack,
      });
      break;
    case "bond": {
      const q = ports.find(s, e.packet.id);
      if (q)
        ports.queue(s, {
          ...e.packet,
          amount:
            (e.packet.amount ?? ports.allyStat(s, q, e.packet.kind)) +
            (e.packet.kind === "thwart" && x23Assault(s, e.packet.target)
              ? 0
              : ports.stats(seatView(s, e.x23PlayerId))[
                  e.packet.kind as "attack" | "thwart"
                ]),
        });
      break;
    }
    case "response-choice":
      ports.choose(s, e.title, "Choose a response or continue.", [
        ...e.options,
        O("continue", "Continue", []),
      ]);
      break;
    case "attach-wound":
      if (p)
        ports.choose(
          s,
          "Puncture Wound",
          "Choose an enemy X-23 or Honey Badger attacked this turn.",
          [s.villain, ...s.minions]
            .filter((q) => attacked(s, q.id))
            .map((q) =>
              O(
                q.id,
                card(q).name,
                [X("attach-player", { id: p.id, target: q.id, wound: true })],
                q.code,
              ),
            ),
        );
      break;
    case "attach-assault":
      if (p)
        ports.choose(
          s,
          "The Direct Approach",
          "Choose a non-permanent side scheme.",
          s.sideSchemes
            .filter(
              (q) =>
                !ports.permanent(s, q) &&
                !allInPlay(s).some(
                  (a) => a.code === "43020" && a.attachedTo === q.id,
                ),
            )
            .map((q) =>
              O(
                q.id,
                card(q).name,
                [X("attach-player", { id: p.id, target: q.id })],
                q.code,
              ),
            ),
        );
      break;
    case "attach-player":
      if (p) {
        need(
          !e.wound || attacked(s, e.target),
          "The enemy was not attacked this turn.",
        );
        p.attachedTo = e.target;
      }
      break;
    case "specialize": {
      if (
        s.player.inPlay.some((q) => card(q).traits?.includes("Specialization."))
      )
        break;
      const options = playerOrder(s).flatMap((seat) =>
        (seatView(s, seat).player.setAside || [])
          .filter((q) => names.includes(q.code))
          .filter((q) => !allInPlay(s).some((a) => a.code === q.code))
          .map((q) =>
            O(
              q.id,
              card(q).name,
              [X("specialize-pick", { id: q.id, owner: seat.id })],
              q.code,
            ),
          ),
      );
      if (options.length)
        ports.choose(
          s,
          "Specialized Training",
          "Choose a set-aside Specialization upgrade.",
          options,
        );
      break;
    }
    case "specialize-pick": {
      const z = seatView(s, e.owner).player.setAside || [],
        i = z.findIndex((q) => q.id === e.id);
      need(
        i >= 0 &&
          !s.player.inPlay.some((q) =>
            card(q).traits?.includes("Specialization."),
          ),
        "This specialization is unavailable.",
      );
      const q = z.splice(i, 1)[0];
      q.ownerId = s.activePlayerId;
      s.player.inPlay.push(q);
      if (q.code === "43036") s.player.hp += 4;
      break;
    }
    case "anticipated":
      ports.declareDefense(s);
      ports.queue(s, E("status", { target: "hero", status: "tough" }));
      break;
    case "cancel":
      seatView(s, e.playerId).flags[`ghostCancelReveal:${e.piece.id}`] = true;
      break;
    case "isolation": {
      const seat = playerOrder(s).find((q) => q.heroId === "x23");
      if (!seat) break;
      if (seat.id !== s.activePlayerId) {
        ports.queue(s, { ...e, actorId: seat.id });
        break;
      }
      let b: Piece | undefined;
      for (const zone of [
        s.player.hand,
        s.player.deck,
        s.player.discard,
        s.player.inPlay,
      ]) {
        const i = zone.findIndex((q) => q.code === "43003");
        if (i >= 0) {
          b = zone[i];
          if (zone === s.player.inPlay) {
            ports.discard(s, b.id);
            const j = s.player.discard.findIndex((q) => q.id === b!.id);
            if (j >= 0) s.player.discard.splice(j, 1);
          } else zone.splice(i, 1);
          break;
        }
      }
      ports.shuffle(s);
      if (b) {
        e.piece.storedCards = [b];
        ports.keepObligation(s, e.piece);
      } else ports.queue(s, E("dealEncounter"));
      break;
    }
    case "deathstrike": {
      const q = ports.discardEncounterTop(s);
      if (q && card(q).boost) ports.indirect(s, card(q).boost!, e.source);
      break;
    }
    case "cybermods": {
      let minion = s.minions.find((q) => q.code === "43029");
      if (!minion) {
        const limit = s.encounter.deck.length + s.encounter.discard.length;
        for (let n = 0; n < limit; n++) {
          const q = ports.discardEncounterTop(s);
          if (q && card(q).type_code === "minion") {
            minion = q;
            ports.putMinion(s, q);
            break;
          }
        }
      }
      if (minion) ports.attach(s, e.piece, minion.id);
      break;
    }
    case "critical":
      ports.attach(s, e.piece, `hero:${s.activePlayerId}`);
      break;
    case "hack": {
      const q = ports.randomDiscard(s);
      if (q)
        ports.queue(
          s,
          E("damage", {
            target: "hero",
            amount: icons(q),
            source: "Hack 'n' Slash",
          }),
        );
      break;
    }
    case "shadows": {
      const z = s.player.setAside || [],
        minion = z.find((q) => q.code === "43029"),
        scheme = z.find((q) => q.code === "43030");
      if (!minion) {
        ports.queue(s, E("surge"));
        break;
      }
      for (const q of [...z].filter((q) =>
        ["43029", "43030", "43031", "43032", "43033"].includes(q.code),
      )) {
        z.splice(z.indexOf(q), 1);
        if (q === minion || q === scheme)
          ports.queue(s, E("reveal", { piece: q }));
        else s.encounter.deck.push(q);
      }
      s.flags.nemesis = true;
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown X-23 effect ${e.type}`);
  }
  return true;
}
