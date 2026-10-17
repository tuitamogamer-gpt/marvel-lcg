import { card } from "./card-definitions.js";
import { isTextBlank, defenseEventSources } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

export const ROGUE_SCRIPT_CODES = [
  "38001a",
  "38001b",
  ...Array.from(
    { length: 34 },
    (_, i) => `380${String(i + 2).padStart(2, "0")}`,
  ),
].filter((c) => !["38021", "38022", "38023"].includes(c));
export const REAVERS_SCRIPT_CODES = Array.from(
  { length: 7 },
  (_, i) => `380${i + 29}`,
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const R = (type: string, args: Record<string, unknown> = {}) =>
  E(`rogue:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const active = (s: GameState) => s.heroId === "rogue";
const find = (s: GameState, id: string) =>
  [...allInPlay(s), ...s.minions, ...s.attachments, s.villain].find(
    (p) => p.id === id,
  );
const identity = (s: GameState, id: string) =>
  id === "hero"
    ? s.players.find((p) => p.id === s.activePlayerId)
    : id.startsWith("hero:")
      ? s.players.find((p) => p.id === id.slice(5))
      : undefined;
const normalized = (s: GameState, id: string) =>
  id === "hero" ? `hero:${s.activePlayerId}` : id;
const traits = (text: string | undefined) =>
  (text || "").replace(/\.$/, "").split(/\.\s+/).filter(Boolean);
export interface RoguePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  makePiece(s: GameState, code: string): Piece;
  targets(
    s: GameState,
    kind: "enemy" | "scheme" | "character",
    action?: boolean,
  ): { id: string; label: string; code?: string }[];
  traits(s: GameState, id: string, visited?: string[]): string[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  keyword(s: GameState, name: string): number;
  canPay(s: GameState, p: Piece): boolean;
  playReaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
  ): void;
  discard(s: GameState, id: string): void;
  shufflePlayer(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
  damageCost(s: GameState, id: string, amount: number): boolean;
  claimDefense(s: GameState): void;
  playStored(s: GameState, lab: Piece, p: Piece): void;
  activate(s: GameState, id: string, playerId: string): void;
  discardUntil(s: GameState, trait: string, after: Effect[]): void;
}
export function rogueTouched(s: GameState): Piece | undefined {
  if (!active(s)) return undefined;
  return [
    ...s.player.inPlay,
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...(s.player.setAside || []),
    ...s.resolving,
  ].find((p) => p.code === "38002" && p.ownerId === s.activePlayerId);
}
export function rogueSetAside(s: GameState) {
  const p = rogueTouched(s);
  if (!p) return;
  for (const zone of [
    s.player.inPlay,
    s.player.hand,
    s.player.deck,
    s.player.discard,
    s.player.setAside || [],
    s.resolving,
  ]) {
    const i = zone.findIndex((q) => q.id === p.id);
    if (i >= 0) zone.splice(i, 1);
  }
  delete p.attachedTo;
  (s.player.setAside ||= []).push(p);
}
export function rogueInitialize(
  s: GameState,
  ports: Pick<RoguePorts, "makePiece">,
) {
  if (!active(s)) return;
  for (const code of ["38025", "38026", "38027", "38027", "38027"]) {
    const p = ports.makePiece(s, code);
    p.ownerId = s.activePlayerId;
    (s.player.setAside ||= []).push(p);
  }
}
export const rogueSetup = (s: GameState) => (active(s) ? [R("set-aside")] : []);
export function roguePhaseBegan(s: GameState) {
  if (active(s) && s.player.form === "hero") rogueSetAside(s);
}
export function rogueTouchedTarget(s: GameState) {
  const p = rogueTouched(s);
  if (
    !p?.attachedTo ||
    !s.player.inPlay.some((q) => q.id === p.id) ||
    isTextBlank(s, p)
  )
    return undefined;
  const seat = identity(s, p.attachedTo);
  if (seat && !seat.eliminated)
    return {
      id: `hero:${seat.id}`,
      type: seatView(s, seat).player.form === "hero" ? "hero" : "alter_ego",
      ownerId: seat.id,
      faction: "hero",
      friendly: true,
    };
  const target = find(s, p.attachedTo);
  if (!target) return undefined;
  const c = card(target);
  return {
    id: target.id,
    type: c.type_code,
    ownerId: target.ownerId,
    faction: c.faction_code,
    friendly: c.type_code === "ally",
  };
}
export function rogueTraits(
  s: GameState,
  lookup: (s: GameState, id: string, visited: string[]) => string[],
  visited: string[] = [],
): string[] {
  if (!active(s) || visited.includes(s.activePlayerId)) return [];
  const grants = String(s.flags.rogueTraitTargets || "")
    .split(",")
    .filter(Boolean);
  return Number(s.flags.rogueTraitsRound) === s.round
    ? [
        ...new Set(
          grants.flatMap((id) => lookup(s, id, [...visited, s.activePlayerId])),
        ),
      ]
    : [];
}
/** A lasting trait grant ends when that original target leaves play, even if
 * the same physical card later returns during this round. */
export function rogueCardLeft(s: GameState, id: string) {
  for (const p of [...allInPlay(s), ...s.minions]) {
    if (p.code === "38011" && p.controlTargetId === id)
      delete p.controlTargetId;
  }
  for (const seat of s.players) {
    const view = seatView(s, seat);
    if (view.heroId !== "rogue") continue;
    view.flags.rogueTraitTargets = String(view.flags.rogueTraitTargets || "")
      .split(",")
      .filter((target) => target !== id)
      .join(",");
  }
}
export function rogueModifiers(s: GameState) {
  const t =
    active(s) && s.player.form === "hero" ? rogueTouchedTarget(s) : undefined;
  const jacket =
    !!t &&
    s.player.inPlay.some((p) => p.code === "38004" && !isTextBlank(s, p));
  return {
    attack: Number(jacket && !t!.friendly),
    thwart: Number(jacket && t!.friendly),
    aerial: t?.type === "ally",
    overkill: t?.type === "minion",
    stalwart: t?.type === "hero",
    retaliate: Number(t?.type === "villain"),
  };
}
function touchedTargets(s: GameState, ports: RoguePorts, moving = false) {
  return ports
    .targets(s, "character")
    .filter(
      (t) =>
        normalized(s, t.id) !== `hero:${s.activePlayerId}` &&
        (!moving || normalized(s, t.id) !== rogueTouched(s)?.attachedTo),
    );
}
function attachTouched(s: GameState, target: string) {
  const p = rogueTouched(s);
  need(p, "The original Touched upgrade is unavailable.");
  rogueSetAside(s);
  const i = s.player.setAside!.findIndex((q) => q.id === p!.id);
  s.player.setAside!.splice(i, 1);
  p!.attachedTo = normalized(s, target);
  s.player.inPlay.push(p!);
  if (Number(s.flags.rogueTraitsRound) !== s.round)
    s.flags.rogueTraitTargets = "";
  s.flags.rogueTraitsRound = s.round;
  s.flags.rogueTraitTargets = [
    ...new Set([
      ...String(s.flags.rogueTraitTargets || "")
        .split(",")
        .filter(Boolean),
      p!.attachedTo!,
    ]),
  ].join(",");
}
export function rogueFormChanged(s: GameState, wasMutant: boolean): Effect[] {
  if (active(s) && s.player.form === "alter") rogueSetAside(s);
  if (!wasMutant || s.player.form !== "hero") return [];
  return allInPlay(s)
    .filter((p) => p.code === "38018" && !p.exhausted && !isTextBlank(s, p))
    .map((p) =>
      E("optional", {
        title: "Moira MacTaggert",
        actorId: controller(s, p.id)?.id,
        text: "Exhaust Moira to draw 1 card for the hero who just changed form?",
        effects: [
          E("exhaust", { id: p.id }),
          E("draw", { amount: 1, actorId: s.activePlayerId }),
        ],
      }),
    );
}
function adaptation(s: GameState) {
  const t = rogueTouchedTarget(s);
  if (!t?.friendly || !t.ownerId) return [];
  const aspects = ["aggression", "justice", "leadership", "protection", "pool"];
  if (!["hero", "basic", ...aspects].includes(t.faction)) return [];
  const owner = s.players.find((p) => p.id === t.ownerId && !p.eliminated);
  if (!owner) return [];
  return seatView(s, owner).player.discard.filter(
    (p) =>
      card(p).type_code === "event" &&
      (t.faction === "hero" || t.faction === "basic"
        ? card(p).faction_code === t.faction
        : [
            "aggression",
            "justice",
            "leadership",
            "protection",
            "pool",
          ].includes(card(p).faction_code)),
  );
}
function teamUp(s: GameState) {
  return (
    ["gambit", "rogue"].includes(s.heroId) &&
    s.player.form === "hero" &&
    ["Gambit", "Rogue"].every(
      (name) =>
        playerOrder(s).some(
          (p) =>
            seatView(s, p).player.form === "hero" &&
            p.heroId === name.toLowerCase(),
        ) ||
        allInPlay(s).some(
          (p) => card(p).type_code === "ally" && card(p).name === name,
        ),
    )
  );
}
export function roguePlayRestriction(
  s: GameState,
  p: Piece,
  ports: RoguePorts,
): string | null {
  const c = card(p);
  if (p.code === "38002")
    return "Touched is attached through Skin Contact or Energy Transfer.";
  if (["38008", "38015", "38016"].includes(p.code))
    return "Play this Defense event at its printed interrupt window.";
  if (p.code === "38009" && !adaptation(s).length)
    return "Touched must be attached to a friendly character with a matching event in its owner's discard pile.";
  if (p.code === "38007" && !touchedTargets(s, ports, true).length)
    return "Move Touched to another character.";
  if (p.code === "38012" && !ports.hasTrait(s, "hero", "X-Men"))
    return "Armor requires the X-Men trait.";
  if (
    ["38018", "38019"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Mutant")
  )
    return "This card requires the Mutant trait.";
  if (
    ["38014", "38019", "38028"].includes(p.code) &&
    s.player.inPlay.some((q) => q.code === p.code)
  )
    return "Max 1 per player.";
  if (p.code === "38020" && !teamUp(s))
    return "Gambit and Rogue must both be in play.";
  if (
    c.set_code === "rogue" &&
    c.type_code === "event" &&
    s.player.form !== "hero"
  )
    return "This event is a Hero Action.";
  return null;
}
export function rogueResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (
    !targetCode ||
    card(targetCode)?.type_code !== "event" ||
    card(targetCode).faction_code !== "hero"
  )
    return [];
  return s.player.inPlay
    .filter((p) => p.code === "38019" && !p.exhausted && !isTextBlank(s, p))
    .map((p) => ({
      id: `rogue-gene:${p.id}`,
      code: p.code,
      name: "X-Gene",
      resources: ["wild"],
      kind: "ability",
      description: "Exhaust · wild for an identity-specific event",
    }));
}
export function rogueSpendResource(s: GameState, id: string) {
  if (!id.startsWith("rogue-gene:")) return false;
  const p = s.player.inPlay.find((p) => p.id === id.slice(11));
  need(p && !p.exhausted, "X-Gene is unavailable.");
  p!.exhausted = true;
  return true;
}
export function rogueAbilityOptions(
  s: GameState,
  id: string,
  ports: RoguePorts,
): Option[] {
  if (
    ["hero", "identity"].includes(id) &&
    active(s) &&
    s.player.form === "hero" &&
    s.flags.rogueSkinRound !== s.round &&
    touchedTargets(s, ports).length
  )
    return [O("skin-contact", "Skin Contact · attach Touched", [R("skin")])];
  const p = s.player.inPlay.find((p) => p.id === id);
  if (!p || p.exhausted || isTextBlank(s, p)) return [];
  if (p.code === "38028" && s.player.form === "alter" && p.storedCards?.length)
    return [
      O("med-lab", "Med Lab · play the stored ally exhausted", [
        R("med-play", { id: p.id }),
      ]),
    ];
  return [];
}
export function rogueCardEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
): Effect[] {
  if (p.code === "38003" || p.code === "38010" || p.code === "38014")
    p.counters = 3;
  if (
    p.code === "38011" &&
    fromHand &&
    s.minions.some((m) => !traits(card(m).traits).includes("Elite"))
  )
    return [
      E("optional", {
        title: "Karma",
        text: "Take control of a non-Elite minion while Karma remains in play?",
        effects: [R("karma", { id: p.id })],
      }),
    ];
  return [];
}
export function rogueBeforeAlly(
  s: GameState,
  p: Piece,
  e: Effect,
): Effect[] | null {
  if (
    p.code !== "38003" ||
    e.kind !== "attack" ||
    p.counters < 1 ||
    p.stunned ||
    isTextBlank(s, p) ||
    e.rogueGambitHandled
  )
    return null;
  return [
    E("optional", {
      title: "Gambit",
      text: "Remove 1 charge counter to deal 1 damage to an enemy?",
      effects: [R("gambit", { id: p.id })],
    }),
    { ...e, rogueGambitHandled: true },
  ];
}
export function rogueMinionEngaged(s: GameState, p: Piece): Effect[] {
  const effects: Effect[] = [];
  if (p.code === "38025" && !isTextBlank(s, p))
    effects.push(
      R("misled-search", {
        includeSetAside: true,
        actorId: p.engagedWith || s.activePlayerId,
      }),
    );
  if (
    REAVERS_SCRIPT_CODES.includes(p.code) &&
    card(p).type_code === "minion" &&
    !isTextBlank(s, p)
  )
    effects.push(
      R("reaver-engaged", {
        id: p.id,
        actorId: p.engagedWith || s.activePlayerId,
      }),
    );
  return effects;
}
export function rogueMinionEntered(s: GameState, p: Piece): Effect[] {
  const effects = rogueMinionEngaged(s, p);
  const engaged = effects.find((e) => e.type === "rogue:reaver-engaged");
  if (engaged) engaged.entered = true;
  for (const ice of allInPlay(s).filter(
    (a) => a.code === "38010" && a.counters > 0 && !isTextBlank(s, a),
  ))
    effects.push(
      E("optional", {
        title: "Iceman",
        text: `Remove a freeze counter to stun ${card(p).name}?`,
        actorId: controller(s, ice.id)?.id,
        effects: [R("ice", { id: ice.id, target: p.id })],
      }),
    );
  return effects;
}
export function rogueEvent(_s: GameState, p: Piece): Effect[] | null {
  return [
    "38005",
    "38006",
    "38007",
    "38008",
    "38009",
    "38016",
    "38020",
  ].includes(p.code)
    ? [R("event", { piece: p })]
    : null;
}
export function rogueDefenseOptions(
  s: GameState,
  stage: "attacks" | "defends",
  after: Effect[],
  ports: RoguePorts,
): Option[] {
  const a = s.attack;
  if (!a || s.player.form !== "hero") return [];
  const options: Option[] = [];
  for (const p of defenseEventSources(s)) {
    const eligible =
      stage === "attacks"
        ? p.code === "38008" && rogueTouchedTarget(s)?.id === a.attacker
        : p.code === "38016" &&
          a.defender === "hero" &&
          a.targetPlayerId === s.activePlayerId;
    if (eligible && ports.canPay(s, p))
      options.push(
        O(p.id, card(p).name, [R("defense-pay", { id: p.id, after })], p.code),
      );
  }
  if (
    stage === "defends" &&
    a.defender === "hero" &&
    a.targetPlayerId === s.activePlayerId
  )
    for (const p of s.player.inPlay.filter(
      (p) =>
        p.code === "38014" &&
        p.counters > 0 &&
        !isTextBlank(s, p) &&
        !s.flags[`rogueJudo:${a.id}:${p.id}`],
    ))
      options.push(
        O(
          p.id,
          "Judoka Skill · spend a judo counter for −2 ATK",
          [R("judo", { id: p.id, after })],
          p.code,
        ),
      );
  return options;
}
export function rogueAfterAttack(
  s: GameState,
  snapshot: { attackId?: string; heroDefended?: boolean; heroDamage?: number },
): Effect[] {
  const key = `rogueNotToday:${snapshot.attackId}`;
  const n = Number(s.flags[key] || 0);
  delete s.flags[key];
  delete s.flags[`rogueBelle:${snapshot.attackId}`];
  return n && snapshot.heroDefended && !snapshot.heroDamage
    ? [R("not-today-thwart", { amount: 2 * n })]
    : [];
}
export function rogueAllyDefeated(
  s: GameState,
  p: Piece,
  source: string,
  controllerId?: string,
): Effect[] {
  if (
    source !== "consequential" ||
    !controllerId ||
    card(p).type_code !== "ally"
  )
    return [];
  return allInPlay(s)
    .filter(
      (a) =>
        a.code === "38028" &&
        !a.exhausted &&
        !a.storedCards?.length &&
        !isTextBlank(s, a),
    )
    .map((a) =>
      E("optional", {
        title: "Med Lab",
        text: `Store the defeated ${card(p).name}?`,
        actorId: controller(s, a.id)?.id,
        effects: [R("med-store", { id: a.id, allyId: p.id })],
      }),
    );
}
export function rogueShadows(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  return [R("nemesis")];
}
export function rogueEncounterReveal(_s: GameState, p: Piece): Effect[] | null {
  return ["38024", "38027", "38032", "38033", "38035"].includes(p.code)
    ? [R("encounter", { piece: p })]
    : null;
}
export function rogueSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  return p.code === "38026"
    ? [R("misled-search")]
    : p.code === "38034"
      ? [R("reaver-search")]
      : [];
}
export const rogueProtected = (s: GameState, id: string) =>
  s.attachments.some(
    (p) => p.code === "38035" && p.attachedTo === id && !isTextBlank(s, p),
  );
export const rogueAfterEnemyAttack = (s: GameState, id: string) =>
  s.attachments
    .filter(
      (p) => p.code === "38035" && p.attachedTo === id && !isTextBlank(s, p),
    )
    .map((p) => E("discardPiece", { id: p.id }));
function chooseTarget(
  s: GameState,
  title: string,
  targets: { id: string; label: string; code?: string }[],
  effect: Effect,
  ports: RoguePorts,
) {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a legal target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
function takeEncounter(s: GameState, id: string, includeAside = false) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.resolving,
    ...(includeAside
      ? s.players.map((seat) => seatView(s, seat).player.setAside || [])
      : []),
  ]) {
    const i = zone.findIndex((p) => p.id === id);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
}
export function resolveRogueEffect(s: GameState, e: Effect, ports: RoguePorts) {
  if (!e.type.startsWith("rogue:")) return false;
  switch (e.type) {
    case "rogue:nemesis": {
      const reserved = (s.player.setAside || []).filter(
        (p) => card(p).set_code === "rogue_nemesis",
      );
      s.player.setAside = (s.player.setAside || []).filter(
        (p) => !reserved.includes(p),
      );
      const minion = reserved.find((p) => p.code === "38025"),
        scheme = reserved.find((p) => p.code === "38026");
      s.encounter.deck.push(
        ...reserved.filter((p) => p !== minion && p !== scheme),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...(minion ? [E("reveal", { piece: minion })] : []),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    case "rogue:misled-hand":
      ports.queue(
        s,
        E("threat", { target: "main", amount: 2 }),
        ...(e.after || []),
      );
      break;
    case "rogue:set-aside":
      rogueSetAside(s);
      break;
    case "rogue:skin":
      need(
        s.flags.rogueSkinRound !== s.round,
        "Skin Contact was already used this round.",
      );
      chooseTarget(
        s,
        "Skin Contact",
        touchedTargets(s, ports),
        R("touch", { skin: true }),
        ports,
      );
      break;
    case "rogue:touch":
      attachTouched(s, e.target);
      if (e.skin) s.flags.rogueSkinRound = s.round;
      break;
    case "rogue:gambit": {
      const p = find(s, e.id);
      if (!p || p.counters < 1) break;
      chooseTarget(
        s,
        "Gambit",
        ports.targets(s, "enemy"),
        R("gambit-damage", { id: p.id }),
        ports,
      );
      break;
    }
    case "rogue:gambit-damage": {
      const p = find(s, e.id);
      if (!p || p.counters < 1) break;
      p.counters--;
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 1, source: p.id }),
      );
      break;
    }
    case "rogue:ice": {
      const p = find(s, e.id);
      if (!p || p.counters < 1 || !s.minions.some((m) => m.id === e.target))
        break;
      p.counters--;
      ports.queue(s, E("status", { target: e.target, status: "stunned" }));
      break;
    }
    case "rogue:karma":
      chooseTarget(
        s,
        "Karma",
        s.minions
          .filter((p) => !traits(card(p).traits).includes("Elite"))
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        R("karma-control", { id: e.id }),
        ports,
      );
      break;
    case "rogue:karma-control": {
      const p = find(s, e.id),
        m = s.minions.find((p) => p.id === e.target);
      need(
        p && m && !traits(card(m!).traits).includes("Elite"),
        "Karma requires the original non-Elite minion.",
      );
      p!.controlTargetId = m!.id;
      p!.karmaControllerId = s.activePlayerId;
      p!.controlOrder = s.nextId++;
      break;
    }
    case "rogue:defense-pay": {
      const p = defenseEventSources(s).find((p) => p.id === e.id);
      if (p) ports.playReaction(s, p, rogueEvent(s, p) || [], e.after || []);
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "rogue:judo": {
      const p = find(s, e.id);
      if (
        p &&
        p.counters > 0 &&
        s.attack &&
        !s.flags[`rogueJudo:${s.attack.id}:${p.id}`]
      ) {
        p.counters--;
        s.flags[`rogueJudo:${s.attack.id}:${p.id}`] = true;
        s.attack.modifier = Number(s.attack.modifier || 0) - 2;
        s.attack.base = Math.max(0, s.attack.base - 2);
        if (!p.counters) ports.discard(s, p.id);
      }
      ports.queue(s, ...(e.after || []));
      break;
    }
    case "rogue:event": {
      const p = e.piece as Piece;
      const aerial = ports.hasTrait(s, "hero", "Aerial"),
        retaliate = ports.keyword(s, "Retaliate") > 0,
        stalwart = ports.keyword(s, "Stalwart") > 0;
      if (p.code === "38005")
        chooseTarget(
          s,
          "Goin' Rogue",
          ports.targets(s, "scheme", true),
          R("goin", { amount: 3 + 2 * Number(aerial), retaliate, stalwart }),
          ports,
        );
      if (p.code === "38006")
        chooseTarget(
          s,
          "Southern Cross",
          ports.targets(s, "enemy", true),
          R("southern", {
            amount: 6 + 2 * Number(aerial),
            retaliate,
            stalwart,
          }),
          ports,
        );
      if (p.code === "38007")
        chooseTarget(
          s,
          "Energy Transfer",
          touchedTargets(s, ports, true),
          R("transfer"),
          ports,
        );
      if (p.code === "38008" && s.attack) {
        ports.claimDefense(s);
        s.attack!.preventAllDamage = true;
        s.flags[`rogueBelle:${s.attack!.id}`] = true;
        ports.queue(s, E("status", { target: "hero", status: "tough" }));
      }
      if (p.code === "38009")
        chooseTarget(
          s,
          "Superpower Adaptation",
          adaptation(s).map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
          })),
          R("adapt"),
          ports,
        );
      if (p.code === "38016" && s.attack) {
        s.attack.defense += 2;
        s.attack.defenseBonus = Number(s.attack.defenseBonus || 0) + 2;
        const key = `rogueNotToday:${s.attack.id}`;
        s.flags[key] = Number(s.flags[key] || 0) + 1;
      }
      if (p.code === "38020")
        chooseTarget(
          s,
          "Beauty and the Thief",
          ports.targets(s, "enemy", true),
          R("beauty"),
          ports,
        );
      break;
    }
    case "rogue:goin":
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: e.amount, thwart: true }),
        ...(e.retaliate ? [R("confuse")] : []),
        ...(e.stalwart ? [E("draw", { amount: 1 })] : []),
      );
      break;
    case "rogue:confuse":
      chooseTarget(
        s,
        "Goin' Rogue",
        ports.targets(s, "enemy"),
        E("status", { status: "confused" }),
        ports,
      );
      break;
    case "rogue:southern":
      ports.queue(
        s,
        E("damage", { target: e.target, amount: e.amount, attack: true }),
        ...(e.retaliate
          ? [E("status", { target: e.target, status: "stunned" })]
          : []),
        ...(e.stalwart ? [E("draw", { amount: 1 })] : []),
      );
      break;
    case "rogue:transfer": {
      need(
        rogueTouched(s)?.attachedTo !== normalized(s, e.target),
        "Energy Transfer must move Touched.",
      );
      attachTouched(s, e.target);
      if (ports.damageCost(s, e.target, 2))
        ports.queue(
          s,
          E("heal", { target: "hero", amount: 2 }),
          E("ready", { target: "hero" }),
        );
      break;
    }
    case "rogue:adapt": {
      const p = adaptation(s).find((p) => p.id === e.target);
      need(p, "The original matching event is unavailable.");
      const owner = seatView(s, p!.ownerId!);
      owner.player.discard.splice(owner.player.discard.indexOf(p!), 1);
      s.player.hand.push(p!);
      ports.revealHidden(s);
      break;
    }
    case "rogue:beauty":
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 4, attack: true }),
        R("beauty-thwart"),
      );
      break;
    case "rogue:beauty-thwart":
      chooseTarget(
        s,
        "Beauty and the Thief",
        ports.targets(s, "scheme", true),
        E("thwart", { amount: 4, thwart: true }),
        ports,
      );
      break;
    case "rogue:not-today-thwart":
      chooseTarget(
        s,
        "Not Today!",
        ports.targets(s, "scheme"),
        E("thwart", { amount: e.amount }),
        ports,
      );
      break;
    case "rogue:med-store": {
      const lab = find(s, e.id);
      if (!lab || lab.exhausted || lab.storedCards?.length) break;
      for (const seat of s.players) {
        const view = seatView(s, seat);
        for (const zone of [
          view.player.discard,
          view.player.hand,
          view.player.deck,
          view.player.setAside || [],
        ]) {
          const i = zone.findIndex((p) => p.id === e.allyId);
          if (i >= 0) {
            lab.exhausted = true;
            lab.storedCards = [zone.splice(i, 1)[0]];
            break;
          }
        }
        if (lab.storedCards?.length) break;
      }
      break;
    }
    case "rogue:med-play": {
      const lab = find(s, e.id);
      if (lab && !lab.exhausted && lab.storedCards?.[0])
        ports.playStored(s, lab, lab.storedCards[0]);
      break;
    }
    case "rogue:med-commit": {
      const lab = find(s, e.id);
      if (lab) lab.exhausted = true;
      break;
    }
    case "rogue:med-exhaust": {
      const p = find(s, e.id);
      if (p) p.exhausted = true;
      break;
    }
    case "rogue:misled-search": {
      const zones = [
        s.encounter.deck,
        s.encounter.discard,
        ...(e.includeSetAside
          ? s.players.map((p) => seatView(s, p).player.setAside || [])
          : []),
      ];
      const p = zones.flat().find((p) => p.code === "38027");
      if (p) {
        takeEncounter(s, p.id, true);
        s.player.deck.push(p);
        ports.shufflePlayer(s);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "rogue:encounter": {
      const p = e.piece as Piece;
      if (p.code === "38024") {
        const t = rogueTouchedTarget(s);
        ports.queue(
          s,
          t?.friendly
            ? E("damage", { target: t.id, amount: 2, source: p.id })
            : E("threat", { target: "main", amount: 2 }),
        );
      }
      if (p.code === "38027") {
        takeEncounter(s, p.id);
        s.player.deck.push(p);
        ports.shufflePlayer(s);
        ports.queue(s, E("surge"));
      }
      if (["38032", "38033"].includes(p.code)) {
        const a = [...s.encounter.deck, ...s.encounter.discard].find(
          (q) => q.code === "38035",
        );
        if (a) {
          takeEncounter(s, a.id);
          a.attachedTo = p.id;
          s.attachments.push(a);
        }
        ports.shuffleEncounter(s);
      }
      if (p.code === "38035") {
        if (s.minions.length)
          chooseTarget(
            s,
            "Cybernetic Enhancements",
            s.minions.map((m) => ({
              id: m.id,
              label: card(m).name,
              code: m.code,
            })),
            R("enhance", { piece: p }),
            ports,
          );
        else ports.queue(s, E("surge"));
      }
      break;
    }
    case "rogue:enhance": {
      const p = takeEncounter(s, e.piece.id) || (e.piece as Piece);
      p.attachedTo = e.target;
      if (!s.attachments.some((q) => q.id === p.id)) s.attachments.push(p);
      break;
    }
    case "rogue:reaver-engaged": {
      const p = s.minions.find((p) => p.id === e.id);
      if (!p || isTextBlank(s, p)) break;
      const reavers = s.minions.filter((p) =>
        traits(card(p).traits).includes("Reaver"),
      );
      const mandatory: Effect[] = [];
      if (e.entered && reavers.length > 1)
        mandatory.push(R("reaver-teamwork", { id: p.id }));
      if (p.code === "38029") mandatory.push(R("reaver-top"));
      if (p.code === "38030")
        mandatory.push(
          E("threat", {
            target: "main",
            amount: reavers.filter(
              (p) => (p.engagedWith || s.activePlayerId) === s.activePlayerId,
            ).length,
          }),
        );
      if (p.code === "38031")
        mandatory.push(
          E("indirect", {
            amount: reavers.filter(
              (p) => (p.engagedWith || s.activePlayerId) === s.activePlayerId,
            ).length,
          }),
        );
      if (mandatory.length > 1)
        ports.queue(
          s,
          E("forcedResponses", {
            responses: mandatory.map((effect, index) => ({
              id: `${p.id}:${index}`,
              title: index === 0 ? "Teamwork" : card(p).name,
              effects: [effect],
            })),
          }),
        );
      else ports.queue(s, ...mandatory);
      break;
    }
    case "rogue:reaver-teamwork":
      if (s.minions.some((p) => p.id === e.id))
        ports.activate(s, e.id, s.activePlayerId);
      break;
    case "rogue:reaver-top": {
      const p = [...s.encounter.discard]
        .reverse()
        .find(
          (p) =>
            card(p).type_code === "minion" &&
            traits(card(p).traits).includes("Reaver"),
        );
      if (p) {
        takeEncounter(s, p.id);
        ports.queue(s, E("reveal", { piece: p }));
      }
      break;
    }
    case "rogue:reaver-search":
      ports.discardUntil(s, "Reaver", [R("reaver-found")]);
      break;
    case "rogue:reaver-found": {
      const p = (e.discardedPiece || e.piece) as Piece | undefined;
      if (p) {
        takeEncounter(s, p.id);
        ports.queue(s, E("reveal", { piece: p }));
      }
      break;
    }
    default:
      throw Error(`Unknown Rogue effect ${e.type}`);
  }
  return true;
}
