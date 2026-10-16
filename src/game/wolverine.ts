import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { clearStatuses } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManPorts } from "./ant-man.js";
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
const W = (type: string, args: Record<string, unknown> = {}) =>
  E(`wolverine:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const card = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const active = (s: GameState) => s.heroId === "wolverine";
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const trait = (p: Piece | string, name: string) =>
  (card(p)?.traits || "")
    .split(/\.\s*/)
    .some((t) => t.toLowerCase() === name.toLowerCase());
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const identityAttachments = (s: GameState, code: string) =>
  s.attachments.filter(
    (p) =>
      p.code === code &&
      ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
      !isTextBlank(s, p),
  );
export const WOLVERINE_SCRIPT_CODES = [
  "35001a",
  "35001b",
  ...Array.from(
    { length: 37 },
    (_, n) => `35${String(n + 2).padStart(3, "0")}`,
  ).filter((c) => !["35024", "35025", "35026", "35038"].includes(c)),
];
export const WOLVERINE_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/logan-wolverine/";
export const WOLVERINE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";

export interface WolverinePorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  playMeanSwing(s: GameState, p: Piece, after: Effect[]): void;
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  maxHP(s: GameState): number;
  isIdentityTextBlank(s: GameState): boolean;
  canTakeDamageCost(s: GameState, amount: number): boolean;
  takeDamageCost(s: GameState, amount: number): boolean;
  canPlayIgnoringCost(s: GameState, p: Piece): boolean;
  playIgnoringCost(s: GameState, p: Piece, after: Effect[]): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  discardPlayerTop(s: GameState): { piece?: Piece; emptied: boolean };
  discardEncounterTop(s: GameState): Piece | undefined;
  discardRandomHand(s: GameState): Piece | undefined;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  attach(s: GameState, p: Piece, target: string): void;
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
  ): void;
  hasTrait(s: GameState, target: string, trait: string): boolean;
  hasEnemyKeyword(s: GameState, target: string, keyword: string): boolean;
  namedAttack(s: GameState, name: string): number | undefined;
  defeatEnemy(s: GameState, id: string, source: string): void;
  canDiscardAttachment(s: GameState, p: Piece): boolean;
  transferControl(s: GameState, id: string, playerId: string): void;
}

/** Separate the one physical Permanent before opening hand; preserve actual IDs. */
export function wolverineInitialize(
  s: GameState,
  ports: Pick<WolverinePorts, "makePiece">,
) {
  if (!active(s) || s.flags.wolverineInitialized) return;
  if (s.player.setAside !== undefined && s.phase !== "mulligan") {
    s.flags.wolverineInitialized = true;
    return;
  }
  const zones = [
    s.player.deck,
    s.player.hand,
    s.player.discard,
    s.player.inPlay,
    (s.player.setAside ||= []),
  ];
  const claws = zones.flat().filter((p) => p.code === "35002");
  need(claws.length <= 1, "Wolverine has exactly one physical Claws upgrade.");
  const p = claws[0] || ports.makePiece(s, "35002");
  if (!s.player.inPlay.includes(p)) {
    for (const zone of zones) {
      const index = zone.findIndex((q) => q.id === p.id);
      if (index >= 0) zone.splice(index, 1);
    }
    s.player.setAside.push(p);
  }
  for (const code of ["35028", "35029", "35030", "35030", "35031"])
    s.player.setAside.push(ports.makePiece(s, code));
  s.flags.wolverineInitialized = true;
}
export function wolverineSetup(s: GameState): Effect[] {
  if (!active(s)) return [];
  const zone = s.player.setAside || [],
    index = zone.findIndex((p) => p.code === "35002");
  if (index >= 0) s.player.inPlay.push(zone.splice(index, 1)[0]);
  return [];
}
export function wolverineStats(s: GameState) {
  const count = s.player.inPlay.filter(
    (p) => p.code === "35004" && !isTextBlank(s, p),
  ).length;
  return {
    health: 4 * count,
    attack: s.player.form === "hero" && active(s) ? count : 0,
    piercing: s.player.form === "hero" && active(s) && count > 0,
  };
}
export function wolverinePhaseBegan(
  s: GameState,
  ports: Pick<WolverinePorts, "maxHP" | "isIdentityTextBlank">,
): Effect[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.hp < ports.maxHP(s) &&
    !ports.isIdentityTextBlank(s)
    ? [optional("Healing Factor", [E("heal", { target: "hero", amount: 2 })])]
    : [];
}
export function wolverineFormChanged(s: GameState): Effect[] {
  return s.player.form === "alter"
    ? s.player.inPlay
        .filter((p) => p.code === "35005" && !isTextBlank(s, p))
        .map((p) => E("discardPiece", { id: p.id }))
    : [];
}
export function wolverineAfterEnemyAttack(
  s: GameState,
  receipt: {
    enemyCode: string;
    target: string;
    damage: number;
    identityDamage: number;
    playerId: string;
    targetControllerId?: string;
    targetOwnerId?: string;
    enemyTextBlank?: boolean;
  },
): Effect[] {
  const view = seatView(s, receipt.playerId),
    effects: Effect[] = [];
  if (active(view) && view.player.form === "hero" && receipt.identityDamage > 0)
    for (const p of view.player.inPlay.filter(
      (p) => p.code === "35005" && !isTextBlank(view, p),
    ))
      effects.push({
        ...optional("Berserker Frenzy", [E("draw", { amount: 1 })]),
        actorId: receipt.playerId,
      });
  if (
    receipt.enemyCode === "35034" &&
    !receipt.enemyTextBlank &&
    receipt.damage > 0
  )
    effects.push(
      W("random-discard", {
        actorId:
          receipt.targetOwnerId ||
          receipt.targetControllerId ||
          receipt.playerId,
      }),
    );
  if (
    receipt.enemyCode === "35034" &&
    !receipt.enemyTextBlank &&
    receipt.target !== "hero" &&
    receipt.identityDamage > 0
  )
    effects.push(W("random-discard", { actorId: receipt.playerId }));
  return effects;
}
/** The host opens this optional interrupt only for actual lethal enemy-attack damage. */
export function wolverineDefeatOptions(
  s: GameState,
  after: Effect[],
): Option[] {
  return s.player.inPlay
    .filter((p) => p.code === "35006" && !isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        '"I Got Better" · set HP to 5 and ready',
        [W("better", { id: p.id, after })],
        p.code,
      ),
    );
}
export function wolverineTurnEnded(s: GameState): Effect[] {
  return identityAttachments(s, "35030").map((p) =>
    E("damage", {
      target: "hero",
      amount: 1,
      source: p.id,
      actorId: s.activePlayerId,
    }),
  );
}
export function wolverineRecoverOptions(
  s: GameState,
  after: Effect[],
): Option[] {
  return identityAttachments(s, "35030").map((p) =>
    O(
      p.id,
      "Discard Death Factor instead of healing",
      [E("discardPiece", { id: p.id }), ...after],
      p.code,
    ),
  );
}
export function wolverineCannotDefeat(s: GameState, p: Piece): boolean {
  return (
    p.code === "35028" &&
    s.sideSchemes.some((q) => q.code === "35029" && !isTextBlank(s, q))
  );
}
export function wolverineEnemyAttackStarted(
  s: GameState,
  id: string,
): Effect[] {
  const p = enemy(s, id);
  if (!p) return [];
  if (
    s.attack &&
    s.attachments.some(
      (q) => q.code === "35036" && q.attachedTo === id && !isTextBlank(s, q),
    )
  )
    s.attack.piercing = true;
  return p.code === "35028" && !isTextBlank(s, p)
    ? [
        W("omega-damage", {
          targets: [
            `hero:${s.activePlayerId}`,
            ...s.player.inPlay
              .filter((q) => card(q).type_code === "ally")
              .map((q) => q.id),
          ],
          amount: 1,
          source: p.id,
        }),
      ]
    : [];
}
export function wolverineBasicBonus(
  s: GameState,
  source: string,
  target: string,
): number {
  const matching =
    source === "hero"
      ? active(s) && s.player.form === "hero"
      : ["Wolverine", "Jubilee"].includes(
          card(allInPlay(s).find((p) => p.id === source)?.code || "")?.name,
        );
  return matching
    ? playerOrder(s).reduce(
        (n, seat) =>
          n +
          Number(
            seatView(s, seat).flags[`wolverineJubilee:${phase(s)}:${target}`] ||
              0,
          ),
        0,
      )
    : 0;
}
export function wolverineCostReduction(
  s: GameState,
  p: Piece | Card,
  ports: WolverinePorts,
): number {
  return p.code === "35021" &&
    (ports.hasTrait(s, "hero", "Mutant") || ports.hasTrait(s, "hero", "X-Men"))
    ? 1
    : 0;
}
export function wolverinePlayRestriction(
  s: GameState,
  p: Piece,
  ports: WolverinePorts,
): string | null {
  if (p.code === "35019")
    return "Mean Swing is played during a basic attack interrupt.";
  if (
    ["35008", "35009", "35010", "35011", "35017", "35018", "35023"].includes(
      p.code,
    ) &&
    s.player.form !== "hero"
  )
    return "This event requires hero form.";
  if (
    p.code === "35012" &&
    s.player.hp >= ports.maxHP(s) &&
    !s.player.stunned &&
    !s.player.confused &&
    !s.player.stunCards &&
    !s.player.confuseCards
  )
    return "Regenerative Healing requires damage or a status to discard.";
  if (p.code === "35022" && !ports.hasTrait(s, "hero", "Mutant"))
    return "Weapon X requires the Mutant trait.";
  if (p.code === "35033" && !ports.hasTrait(s, "hero", "X-Men"))
    return "Longshot requires the X-Men trait.";
  if (
    ["35015", "35016", "35032"].includes(p.code) &&
    (p.code === "35015"
      ? !playerOrder(s).some(
          (seat) =>
            !seatView(s, seat).player.inPlay.some((q) => q.code === p.code),
        )
      : s.player.inPlay.some((q) => q.code === p.code))
  )
    return "Max 1 per player.";
  if (
    p.code === "35023" &&
    (ports.namedAttack(s, "Wolverine") === undefined ||
      ports.namedAttack(s, "Colossus") === undefined ||
      !["wolverine", "colossus"].includes(s.heroId))
  )
    return "Fastball Special requires your matching hero and both Colossus and Wolverine in play.";
  return null;
}
export function wolverineEventAction(
  p: Piece,
): "attack" | "thwart" | undefined {
  return ["35008", "35010", "35017", "35018", "35023"].includes(p.code)
    ? "attack"
    : p.code === "35011"
      ? "thwart"
      : undefined;
}
export function wolverineEvent(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "35019") return [];
  return [
    "35008",
    "35009",
    "35010",
    "35011",
    "35012",
    "35017",
    "35018",
    "35023",
  ].includes(p.code)
    ? [W("event", { piece: p, claws: !!s.flags[`wolverineClaws:${p.id}`] })]
    : null;
}
const clawCandidates = (s: GameState, ports: WolverinePorts) =>
  s.player.hand.filter(
    (p) =>
      card(p).type_code === "event" &&
      trait(p, "Attack") &&
      (card(p).cost || 0) >= 0 &&
      ports.canTakeDamageCost(s, card(p).cost || 0) &&
      ports.canPlayIgnoringCost(s, p),
  );
export function wolverineAbilityOptions(
  s: GameState,
  id: string,
  ports: WolverinePorts,
): Option[] {
  const p = own(s, id) || s.attachments.find((q) => q.id === id);
  if (!p || isTextBlank(s, p)) return [];
  if (p.code === "35002" && s.player.form === "hero" && !p.exhausted)
    return clawCandidates(s, ports).map((q) =>
      O(
        q.id,
        `Claws · take ${card(q).cost || 0} damage to play ${card(q).name}`,
        [W("claws", { id: p.id, eventId: q.id })],
        q.code,
      ),
    );
  if (p.code === "35007" && s.player.form === "alter" && !p.exhausted)
    return s.player.discard
      .filter((q) => card(q).set_code === "wolverine")
      .map((q) =>
        O(
          q.id,
          `Shuffle ${card(q).name} into your deck`,
          [W("cabin", { id, target: q.id })],
          q.code,
        ),
      );
  if (
    p.code === "35022" &&
    s.player.form === "alter" &&
    !p.exhausted &&
    s.player.deck.length &&
    ports.canTakeDamageCost(s, 1)
  )
    return [
      O(
        "weapon-x",
        "Weapon X · take 1 damage and search the deck",
        [W("weapon-x", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "35036" &&
    s.player.form === "hero" &&
    ports.canPay(s, 3, ["energy", "mental", "physical"])
  )
    return [
      O(
        "remove",
        "Spend energy, mental and physical · discard",
        [W("upgrades-pay", { id })],
        p.code,
      ),
    ];
  return [];
}
export function wolverineAbility(
  s: GameState,
  id: string,
  action: string,
  ports: WolverinePorts,
): Effect[] | null {
  const p = own(s, id) || s.attachments.find((q) => q.id === id);
  if (!p || !["35002", "35007", "35022", "35036"].includes(p.code)) return null;
  const options = wolverineAbilityOptions(s, id, ports),
    selected =
      action === "special" ? options[0] : options.find((o) => o.id === action);
  need(selected, "This Wolverine pack ability is unavailable.");
  return selected!.effects;
}
export function wolverineCardEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
): Effect[] {
  if (p.code === "35013") p.counters = 2;
  if (p.code === "35016") p.counters = 3;
  if (isTextBlank(s, p)) return [];
  if (p.code === "35003") return [optional("Jubilee", [W("jubilee")])];
  if (p.code === "35014" && fromHand)
    return [W("sunfire-window", { id: p.id })];
  if (p.code === "35015") return [W("control", { id: p.id })];
  return [];
}
export function wolverineAttackOptions(
  s: GameState,
  packet: Effect,
  ports: WolverinePorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.player.stunned ||
    (packet.source && packet.source !== "hero")
  )
    return [];
  const choices: Option[] = [];
  for (const p of s.player.inPlay.filter(
    (p) =>
      p.code === "35016" &&
      p.counters > 0 &&
      !isTextBlank(s, p) &&
      !s.flags[`wolverineWarriorUsed:${packet.wolverineAttackToken}:${p.id}`],
  ))
    choices.push(
      O(
        p.id,
        "Warrior Skill · spend a counter for +1 damage",
        [W("warrior", { id: p.id, packet })],
        p.code,
      ),
    );
  if (packet.basic)
    for (const p of s.player.hand.filter((p) => p.code === "35019"))
      for (const q of s.player.inPlay.filter(
        (q) =>
          card(q).type_code === "upgrade" && trait(q, "Weapon") && !q.exhausted,
      ))
        choices.push(
          O(
            `${p.id}:${q.id}`,
            "Mean Swing · exhaust a Weapon for +3 ATK",
            [W("mean-swing", { id: p.id, weaponId: q.id, packet })],
            p.code,
          ),
        );
  return choices;
}
export function wolverineAllyAttackOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
): Option[] {
  return p.code === "35013" &&
    p.counters > 0 &&
    !p.stunned &&
    !isTextBlank(s, p)
    ? [
        O(
          p.id,
          "Psylocke · spend 1 counter to confuse and deal 1 damage",
          [W("psylocke", { id: p.id, packet })],
          p.code,
        ),
      ]
    : [];
}
export function wolverineAfterAlly(
  s: GameState,
  p: Piece,
  target: string,
  attack: boolean,
  defeatedScheme: boolean,
): Effect[] {
  if (attack && p.code === "35033" && !isTextBlank(s, p)) {
    const targetPiece = s.minions.find((q) => q.id === target);
    if (targetPiece && !trait(targetPiece, "Elite"))
      return [optional("Longshot", [W("longshot", { id: p.id, target })])];
  }
  return !attack && defeatedScheme
    ? playerOrder(s).flatMap((seat) => {
        const view = seatView(s, seat);
        return view.player.inPlay
          .filter(
            (q) => q.code === "35032" && !q.exhausted && !isTextBlank(view, q),
          )
          .map((q) => ({
            ...optional("Command Center", [W("command-center", { id: q.id })]),
            actorId: seat.id,
          }));
      })
    : [];
}
export function wolverineAfterDefeat(
  s: GameState,
  source: string,
  minion: boolean,
  attack: boolean,
): Effect[] {
  return minion &&
    attack &&
    ["hero", `hero:${s.activePlayerId}`].includes(source) &&
    s.player.form === "hero" &&
    s.player.exhausted
    ? s.player.inPlay
        .filter((p) => p.code === "35015" && !isTextBlank(s, p))
        .map((p) => optional("Battle Fury", [W("battle-fury", { id: p.id })]))
    : [];
}
export function wolverineShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    minion = zone.find((p) => p.code === "35028"),
    scheme = zone.find((p) => p.code === "35029");
  return [
    ...(minion ? [W("reveal-reserve", { id: minion.id })] : []),
    ...(scheme ? [W("reveal-reserve", { id: scheme.id })] : []),
    W("shuffle-reserve"),
    ...(!minion ? [E("surge")] : []),
  ];
}
export function wolverineEncounterReveal(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  if (["35028", "35029", "35034"].includes(p.code)) return [];
  if (p.code === "35027") return [W("obligation", { piece: p })];
  if (p.code === "35030") return [W("death-factor", { piece: p })];
  if (p.code === "35031") return [W("tentacle", { source: p.id })];
  if (p.code === "35035") return [W("vengeance")];
  if (p.code === "35036") return [W("upgrades", { piece: p })];
  if (p.code === "35037") return [W("hack", { source: p.id })];
  return null;
}
export function wolverineBoost(s: GameState, p: Piece): Effect[] | null {
  return ["35031", "35037"].includes(p.code)
    ? wolverineEncounterReveal(s, p)
    : null;
}

export function resolveWolverineEffect(
  s: GameState,
  e: Effect,
  ports: WolverinePorts,
): boolean {
  if (!e.type.startsWith("wolverine:")) return false;
  const after: Effect[] = e.after || [];
  const target = (title: string, action: Effect, attack = true) => {
    const targets = ports.enemyTargets(s, attack);
    if (targets.length)
      ports.choose(
        s,
        title,
        "Choose an enemy.",
        targets.map((t) =>
          O(t.id, t.label, [{ ...action, target: t.id }], t.code),
        ),
      );
  };
  switch (e.type) {
    case "wolverine:claws": {
      const p = own(s, e.id, "35002"),
        event = clawCandidates(s, ports).find((q) => q.id === e.eventId);
      need(
        p && !p.exhausted && event && s.player.form === "hero",
        "Claws requires its actual ready upgrade and a playable Attack event.",
      );
      need(
        ports.takeDamageCost(s, card(event!).cost || 0),
        "Claws must pay the full printed damage cost.",
      );
      p!.exhausted = true;
      if (s.player.hp > 0) {
        s.flags[`wolverineClaws:${event!.id}`] = true;
        ports.playIgnoringCost(s, event!, [
          W("claws-clean", { id: event!.id }),
          ...after,
        ]);
      }
      break;
    }
    case "wolverine:claws-clean":
      delete s.flags[`wolverineClaws:${e.id}`];
      delete s.flags[`wolverineClawsAttack:${e.id}`];
      ports.queue(s, ...after);
      break;
    case "wolverine:cabin": {
      const p = own(s, e.id, "35007"),
        index = s.player.discard.findIndex(
          (q) => q.id === e.target && card(q).set_code === "wolverine",
        );
      need(
        p && !p.exhausted && s.player.form === "alter" && index >= 0,
        "Logan's Cabin needs a ready support and an actual Wolverine card in discard.",
      );
      p!.exhausted = true;
      s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "wolverine:better": {
      const p = own(s, e.id, "35006");
      need(p && !isTextBlank(s, p), '"I Got Better" is unavailable.');
      s.player.hp = 5;
      if (ports.canReadyIdentity(s, s.activePlayerId))
        s.player.exhausted = false;
      ports.discardPiece(s, p!.id);
      delete s.flags.wolverineLethalAttack;
      delete s.flags.wolverineDefeatPending;
      ports.queue(s, ...after);
      break;
    }
    case "wolverine:allow-defeat":
      delete s.flags.wolverineDefeatPending;
      s.flags.wolverineDefeatDeclined = true;
      ports.queue(s, ...after);
      break;
    case "wolverine:event": {
      const p = e.piece as Piece;
      if (p.code === "35012") {
        const choices: Option[] = [];
        if (s.player.hp < ports.maxHP(s))
          choices.push(
            O("heal", "Heal 4 damage", [
              E("heal", { target: "hero", amount: 4 }),
            ]),
          );
        if (
          s.player.stunned ||
          s.player.confused ||
          s.player.stunCards ||
          s.player.confuseCards
        )
          choices.push(
            O("statuses", "Discard all Stunned and Confused status cards", [
              W("clear-statuses"),
            ]),
          );
        if (choices.length)
          ports.choose(s, "Regenerative Healing", "Choose one.", choices);
        break;
      }
      if (p.code === "35011") {
        const targets = ports.schemeTargets(s, true);
        if (targets.length)
          ports.choose(
            s,
            "Track by Scent",
            "Choose a scheme.",
            targets.map((t) =>
              O(
                t.id,
                t.label,
                [
                  E("thwart", {
                    target: t.id,
                    amount: 3,
                    action: true,
                    afterResolved: [W("scent-after")],
                  }),
                ],
                t.code,
              ),
            ),
          );
        break;
      }
      if (p.code === "35009") {
        ports.queue(s, W("slice", { piece: p, claws: e.claws, count: 2 }));
        break;
      }
      const amount =
        p.code === "35008"
          ? 4
          : p.code === "35010"
            ? 8
            : p.code === "35017"
              ? 3
              : p.code === "35018"
                ? 2
                : (ports.namedAttack(s, "Colossus") || 0) +
                  (ports.namedAttack(s, "Wolverine") || 0);
      ports.queue(s, W("attack", { piece: p, amount, claws: e.claws }));
      break;
    }
    case "wolverine:clear-statuses":
      clearStatuses(s.player, ["stunned"]);
      clearStatuses(s.player, ["confused"]);
      break;
    case "wolverine:scent-after":
      if (e.lastThreatRemoved && e.removed > 0)
        ports.queue(s, E("draw", { amount: 2 }));
      break;
    case "wolverine:slice": {
      if (e.count <= 0) break;
      if (e.count === 2 && e.claws && s.player.stunned)
        s.flags[`wolverineClawsAttack:${e.piece.id}`] = "replaced";
      ports.attackProgram(
        s,
        [
          E("target", {
            group: "enemy",
            title: "Slice and Dice",
            action: E("damage", {
              amount: 3,
              source: "hero",
              attack: true,
              piercing: !!e.claws && e.count === 2,
            }),
          }),
        ],
        [W("slice", { ...e, type: "wolverine:slice", count: e.count - 1 })],
      );
      break;
    }
    case "wolverine:attack": {
      const p = e.piece as Piece;
      const action = W("attack-target", {
        attack: true,
        piece: p,
        amount: e.amount,
        claws: e.claws,
      });
      ports.queue(
        s,
        E("target", { group: "enemy", title: card(p).name, action }),
      );
      break;
    }
    case "wolverine:attack-target": {
      const p = e.piece as Piece;
      let amount = e.amount;
      if (
        p.code === "35017" &&
        (ports.hasEnemyKeyword(s, e.target, "Guard") ||
          ports.hasEnemyKeyword(s, e.target, "Patrol"))
      )
        amount = 5;
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount,
            source: "hero",
            attack: true,
            piercing: !!e.claws || p.code === "35023",
            overkill: p.code === "35023" || (p.code === "35010" && !!e.claws),
            afterResolved: [W("attack-after", { piece: p, claws: e.claws })],
          }),
        ],
        after,
      );
      break;
    }
    case "wolverine:attack-after": {
      const p = e.piece as Piece;
      if (!e.defeatedEnemy) break;
      if (p.code === "35018")
        ports.queue(s, E("heal", { target: "hero", amount: 2 }));
      if (
        p.code === "35008" &&
        ports.canTakeDamageCost(s, 2) &&
        ports.enemyTargets(s, true).length
      )
        ports.queue(
          s,
          optional("Berserker Barrage", [
            W("barrage-repeat", { piece: p, claws: e.claws }),
          ]),
        );
      break;
    }
    case "wolverine:barrage-repeat":
      need(
        ports.takeDamageCost(s, 2),
        "Berserker Barrage requires taking 2 damage.",
      );
      if (s.player.hp > 0)
        ports.queue(
          s,
          W("attack", { piece: e.piece, amount: 4, claws: false }),
        );
      break;
    case "wolverine:jubilee":
      target("Jubilee", W("jubilee-target"), false);
      break;
    case "wolverine:jubilee-target":
      need(enemy(s, e.target), "Choose a current enemy.");
      s.flags[`wolverineJubilee:${phase(s)}:${e.target}`] =
        Number(s.flags[`wolverineJubilee:${phase(s)}:${e.target}`] || 0) + 2;
      break;
    case "wolverine:weapon-x": {
      const p = own(s, e.id, "35022");
      need(
        p &&
          !p.exhausted &&
          s.player.form === "alter" &&
          s.player.deck.length &&
          ports.takeDamageCost(s, 1),
        "Weapon X cannot pay its full cost.",
      );
      p!.exhausted = true;
      if (s.player.hp > 0) ports.queue(s, W("weapon-x-mill"));
      break;
    }
    case "wolverine:weapon-x-mill": {
      const { piece, emptied } = ports.discardPlayerTop(s);
      if (!piece) break;
      if (
        card(piece).faction_code === "hero" ||
        card(piece).set_code === s.heroId
      )
        ports.queue(s, W("weapon-x-take", { id: piece.id }));
      else if (!emptied) ports.queue(s, W("weapon-x-mill"));
      break;
    }
    case "wolverine:weapon-x-take":
      for (const zone of [s.player.discard, s.player.deck]) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i >= 0) {
          s.player.hand.push(zone.splice(i, 1)[0]);
          break;
        }
      }
      break;
    case "wolverine:sunfire-window": {
      const attachments = s.attachments.filter(
        (p) =>
          /<b>Hero (Action|Response)<\/b>/i.test(card(p).text || "") &&
          ports.canDiscardAttachment(s, p) &&
          !isTextBlank(s, p),
      );
      if (attachments.length && ports.canPay(s, 1, ["energy"]))
        ports.queue(s, optional("Sunfire", [W("sunfire-pay", { id: e.id })]));
      break;
    }
    case "wolverine:sunfire-pay":
      ports.pay(s, "Sunfire", 1, ["energy"], [W("sunfire-discard")]);
      break;
    case "wolverine:sunfire-discard": {
      const attachments = s.attachments.filter(
        (p) =>
          /<b>Hero (Action|Response)<\/b>/i.test(card(p).text || "") &&
          ports.canDiscardAttachment(s, p) &&
          !isTextBlank(s, p),
      );
      if (attachments.length)
        ports.choose(
          s,
          "Sunfire",
          "Choose an attachment to discard.",
          attachments.map((p) =>
            O(p.id, card(p).name, [E("discardPiece", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "wolverine:warrior": {
      const p = own(s, e.id, "35016");
      need(
        p && p.counters > 0 && !isTextBlank(s, p),
        "Warrior Skill has no available counter.",
      );
      p!.counters--;
      if (!p!.counters) ports.discardPiece(s, p!.id);
      s.flags[`wolverineWarriorUsed:${e.packet.wolverineAttackToken}:${e.id}`] =
        true;
      s.flags[`wolverineWarriorBonus:${e.packet.wolverineAttackToken}`] =
        Number(
          s.flags[`wolverineWarriorBonus:${e.packet.wolverineAttackToken}`] ||
            0,
        ) + 1;
      ports.queue(s, { ...e.packet });
      break;
    }
    case "wolverine:mean-swing": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "35019"),
        weapon = own(s, e.weaponId);
      need(
        p &&
          weapon &&
          trait(weapon, "Weapon") &&
          !weapon.exhausted &&
          e.packet.basic,
        "Mean Swing needs an actual ready Weapon and basic attack.",
      );
      weapon!.exhausted = true;
      ports.playMeanSwing(s, p!, [
        { ...e.packet, amount: e.packet.amount + 3 },
      ]);
      break;
    }
    case "wolverine:psylocke": {
      const p = own(s, e.id, "35013");
      need(
        p && p.counters > 0 && !isTextBlank(s, p),
        "Psylocke has no psionic counter.",
      );
      p!.counters--;
      ports.queue(
        s,
        E("status", { target: e.packet.target, status: "confused" }),
        E("damage", { target: e.packet.target, amount: 1, source: p!.id }),
        { ...e.packet, wolverinePsylockeHandled: true },
      );
      break;
    }
    case "wolverine:ally-after": {
      const ally =
        own(s, e.piece.id) || (!e.attack ? (e.piece as Piece) : undefined);
      if (ally)
        ports.queue(
          s,
          ...wolverineAfterAlly(
            s,
            ally,
            e.target,
            e.attack,
            !e.attack &&
              e.target !== "main" &&
              e.before > 0 &&
              !s.sideSchemes.some((p) => p.id === e.target),
          ),
        );
      break;
    }
    case "wolverine:longshot": {
      const p = ports.discardEncounterTop(s);
      if (
        p &&
        card(p).boost_star &&
        s.minions.some((q) => q.id === e.target && !trait(q, "Elite"))
      )
        ports.defeatEnemy(s, e.target, e.id);
      break;
    }
    case "wolverine:command-center": {
      const p = own(s, e.id, "35032");
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "Command Center is unavailable.",
      );
      p!.exhausted = true;
      target(
        "Command Center",
        E("damage", { amount: 2, source: p!.id }),
        false,
      );
      break;
    }
    case "wolverine:battle-fury": {
      const p = own(s, e.id, "35015");
      need(
        p && s.player.form === "hero" && !isTextBlank(s, p),
        "Battle Fury is unavailable.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("damage", { target: "hero", amount: 1, source: p!.id }),
        E("ready", { id: "hero" }),
      );
      break;
    }
    case "wolverine:control": {
      const choices = playerOrder(s).filter(
        (seat) =>
          !seatView(s, seat).player.inPlay.some(
            (p) => p.code === "35015" && p.id !== e.id,
          ),
      );
      ports.choose(
        s,
        "Battle Fury",
        "Choose its controller.",
        choices.map((seat) =>
          O(seat.id, seat.heroId, [
            W("control-set", { id: e.id, playerId: seat.id }),
          ]),
        ),
      );
      break;
    }
    case "wolverine:control-set":
      ports.transferControl(s, e.id, e.playerId);
      break;
    case "wolverine:reveal-reserve": {
      const zone = s.player.setAside || [],
        i = zone.findIndex((p) => p.id === e.id);
      if (i >= 0) ports.queue(s, E("reveal", { piece: zone.splice(i, 1)[0] }));
      break;
    }
    case "wolverine:shuffle-reserve": {
      const zone = s.player.setAside || [],
        pieces = zone.filter((p) => card(p).set_code === "wolverine_nemesis");
      s.player.setAside = zone.filter((p) => !pieces.includes(p));
      s.encounter.deck.push(...pieces);
      ports.shuffleEncounter(s);
      break;
    }
    case "wolverine:death-factor":
      ports.attach(s, e.piece, `hero:${s.activePlayerId}`);
      break;
    case "wolverine:tentacle": {
      const already = s.player.stunned;
      ports.queue(
        s,
        E("status", { target: "hero", status: "stunned" }),
        E("damage", {
          target: "hero",
          amount: already ? 4 : 1,
          source: e.source,
        }),
      );
      break;
    }
    case "wolverine:obligation": {
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(s, "Past Demons", "You may change to alter-ego form.", [
          O("alter", "Change to Logan", [
            E("flip", { target: "alter", counts: false }),
            W("obligation-choice", { piece: e.piece }),
          ]),
          O("stay", "Stay in hero form", [
            W("obligation-choice", { piece: e.piece }),
          ]),
        ]);
      else ports.queue(s, W("obligation-choice", { piece: e.piece }));
      break;
    }
    case "wolverine:obligation-choice": {
      const options = [
        O("statuses", "Become stunned and confused · discard Past Demons", [
          E("status", { target: "hero", status: "stunned" }),
          E("status", { target: "hero", status: "confused" }),
          E("discardEncounter", { piece: e.piece }),
        ]),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        options.unshift(
          O("remove", "Exhaust Logan · remove Past Demons", [
            E("exhaust", { id: "hero" }),
            E("removeEncounter", { piece: e.piece }),
          ]),
        );
      ports.choose(s, "Past Demons", "Choose one.", options);
      break;
    }
    case "wolverine:vengeance": {
      const p = s.minions.find((p) => p.code === "35034");
      if (p)
        ports.queue(
          s,
          E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
            id: p.id,
          }),
        );
      else {
        let found: Piece | undefined;
        for (const zone of [s.encounter.deck, s.encounter.discard]) {
          const i = zone.findIndex((q) => q.code === "35034");
          if (i >= 0) {
            found = zone.splice(i, 1)[0];
            break;
          }
        }
        ports.shuffleEncounter(s);
        if (found) ports.putMinion(s, found, s.activePlayerId);
      }
      break;
    }
    case "wolverine:upgrades": {
      const targets = ports
        .enemyTargets(s, false)
        .filter(
          (t) =>
            !s.attachments.some(
              (p) => p.code === "35036" && p.attachedTo === t.id,
            ),
        );
      if (targets.length)
        ports.choose(
          s,
          "Adamantium Upgrades",
          "Choose an enemy without a copy.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [W("upgrades-attach", { piece: e.piece, target: t.id })],
              t.code,
            ),
          ),
        );
      else ports.queue(s, E("surge"));
      break;
    }
    case "wolverine:upgrades-attach":
      need(
        enemy(s, e.target) &&
          !s.attachments.some(
            (p) => p.code === "35036" && p.attachedTo === e.target,
          ),
        "This enemy already has Adamantium Upgrades.",
      );
      ports.attach(s, e.piece, e.target);
      break;
    case "wolverine:upgrades-pay":
      ports.pay(
        s,
        "Adamantium Upgrades",
        3,
        ["energy", "mental", "physical"],
        [E("discardPiece", { id: e.id })],
      );
      break;
    case "wolverine:hack": {
      const p = ports.discardRandomHand(s);
      if (p)
        ports.queue(
          s,
          E("damage", {
            target: "hero",
            amount: [
              "resource_energy",
              "resource_mental",
              "resource_physical",
              "resource_wild",
            ].reduce((n, key) => n + Number((card(p) as any)[key] || 0), 0),
            source: e.source,
          }),
        );
      break;
    }
    case "wolverine:omega-damage":
      ports.damageBatch(s, e.targets, e.amount, e.source);
      break;
    case "wolverine:random-discard":
      ports.discardRandomHand(s);
      break;
    default:
      throw Error(`Unknown Wolverine effect ${e.type}`);
  }
  return true;
}
