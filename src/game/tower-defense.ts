import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

/** The Mad Titan's Shadow, scenario 2: Proxima Midnight and Corvus Glaive
 * attack Avengers Tower together. */
export const TOWER_DEFENSE_SCENARIO_CODES = [
  "21092",
  "21093",
  "21094",
  "21095",
  "21096",
  "21097",
  "21098a",
  "21098b",
  "21099a",
  "21099b",
  "21100a",
  "21100b",
  "21101",
  "21102",
  "21103",
  "21104",
  "21105",
  "21106",
  "21107",
  "21108",
  "21109",
  "21110",
] as const;
export const TOWER_DEFENSE_SCRIPT_CODES = TOWER_DEFENSE_SCENARIO_CODES;
export const PROXIMA_MIDNIGHT = ["21092", "21093", "21094"] as const;
export const CORVUS_GLAIVE = ["21095", "21096", "21097"] as const;
/** Stage 1B, Proxima Midnight's scheme, and stage 2B, Corvus Glaive's. */
export const UNDER_SIEGE = "21098b";
export const ARMIES_OF_THANOS = "21099b";
export const AVENGERS_TOWER = "21100a";
export const DAMAGED_TOWER = "21100b";
export const FOCUSED_DEFENSE = "21101";
export const BESIEGER = "21102";
const SPEAR = "21103";
const GLAIVE = "21104";
const DIRECT_ASSAULT = "21105";
const PROXIMAS_POWER = "21106";
const CORVUS_CUNNING = "21107";
const BOUND_BY_BLOOD = "21108";
const RAIN_FIRE = "21109";
const CITY_UNDER_ATTACK = "21110";
/** Target ID of the main scheme that is not native `s.scheme` right now. */
export const TOWER_OTHER_MAIN = "tower:main";

export type TowerKey = "proxima" | "corvus";
type Villain = GameState["villain"];

/** Both villains and both main schemes are in play at once. The villain in
 * focus occupies native `s.villain`, its main scheme native `s.scheme`; the
 * other pair waits in `other`. Outside a focus window the focus is the active
 * villain, the one whose main scheme has Focused Defense attached. */
export interface TowerDefenseState {
  active: TowerKey;
  focus: TowerKey;
  other: { villain: Villain; scheme: GameState["scheme"] };
  /** Each villain's physical main scheme card (1A/1B, 2A/2B). */
  mains: Record<TowerKey, Piece>;
  /** Each villain's remaining stages. */
  villainDecks: Record<TowerKey, Piece[]>;
  /** Both villains reached 0 hit points: this one is defeated next. */
  defeating?: TowerKey;
}

export interface TowerDefensePorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  giveTough(s: GameState, p: Piece): boolean;
  /** The current ATK or SCH of an enemy, as for its own activation. */
  villainStat(
    s: GameState,
    p: Piece,
    kind: "attack" | "scheme",
    playerId: string,
  ): number;
  advanceVillain(s: GameState): void;
  endGame(s: GameState, won: boolean, text: string): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
  /** Avengers Tower support cards in play, which the Damaged side discards. */
  avengersTowerSupports(s: GameState): Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const T = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `tower:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (TOWER_DEFENSE_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";

export function towerKeyOf(p?: Piece | string): TowerKey | undefined {
  const code = typeof p === "string" ? p : p?.code;
  if (!code) return undefined;
  if ((PROXIMA_MIDNIGHT as readonly string[]).includes(code)) return "proxima";
  if ((CORVUS_GLAIVE as readonly string[]).includes(code)) return "corvus";
  return undefined;
}
export const otherTowerKey = (key: TowerKey): TowerKey =>
  key === "proxima" ? "corvus" : "proxima";

/** The live villain piece of one side, wherever the focus is. */
export function towerVillain(s: GameState, key: TowerKey): Villain | undefined {
  const td = s.towerDefense;
  if (!td) return undefined;
  return td.focus === key ? s.villain : td.other.villain;
}
/** The public threat view of one side's main scheme. */
export function towerScheme(
  s: GameState,
  key: TowerKey,
): GameState["scheme"] | undefined {
  const td = s.towerDefense;
  if (!td) return undefined;
  return td.focus === key ? s.scheme : td.other.scheme;
}
export function towerDefenseActiveVillain(s: GameState) {
  return s.towerDefense ? towerVillain(s, s.towerDefense.active) : undefined;
}
export function towerDefenseTower(s: GameState): Piece | undefined {
  return (s.environments || []).find(
    (p) => p.code === AVENGERS_TOWER || p.code === DAMAGED_TOWER,
  );
}
export function towerDefenseTowerLimit(s: GameState) {
  return 9 * s.playerCount;
}
export function towerDefenseSchemeLimit(s: GameState, code: string) {
  const c = definitions.get(code);
  return (c?.threat || 0) * (c?.threat_fixed ? 1 : s.playerCount);
}

/** Swap the pairs so that `key`'s villain and main scheme are native. */
export function towerDefenseFocus(s: GameState, key: TowerKey) {
  const td = s.towerDefense;
  if (!td || td.focus === key) return;
  const villain = s.villain;
  const scheme = s.scheme;
  s.villain = td.other.villain;
  s.scheme = td.other.scheme;
  td.other = { villain, scheme };
  td.focus = key;
}
/** Run synchronous engine code with `key` in focus, then restore. */
export function withTowerFocus<R>(s: GameState, key: TowerKey, fn: () => R): R {
  const td = s.towerDefense;
  if (!td || td.focus === key) return fn();
  const previous = td.focus;
  towerDefenseFocus(s, key);
  try {
    return fn();
  } finally {
    if (s.towerDefense) towerDefenseFocus(s, previous);
  }
}

const focusFields = ["target", "targetId", "enemyId"];
const activationTypes = [
  "enemyAttack",
  "enemyScheme",
  "ghostNativeEnemyAttack",
  "ghostNativeEnemyScheme",
];
/** An effect that names the villain or main scheme out of focus resolves
 * inside a focus window: focus that pair, resolve the effect and everything
 * it causes, then return to the previous focus. */
export function towerDefenseFocusWrap(
  s: GameState,
  e: Effect,
): Effect[] | null {
  const td = s.towerDefense;
  if (!td || e.type.startsWith("tower:")) return null;
  const otherId = td.other.villain.id;
  const fields = activationTypes.includes(e.type)
    ? [...focusFields, "id"]
    : focusFields;
  const villain = fields.some((field) => e[field] === otherId);
  const scheme = e.target === TOWER_OTHER_MAIN;
  if (!villain && !scheme) return null;
  const window = { mandatory: true, responseGroup: undefined };
  // Inside the window the pairs are swapped, so the two main scheme IDs swap
  // meaning: rename them in every top-level field, e.g. a target and the
  // original target it must differ from.
  const renamed: Effect = { ...e, responseGroup: undefined };
  for (const [field, value] of Object.entries(e))
    if (value === "main") renamed[field] = TOWER_OTHER_MAIN;
    else if (value === TOWER_OTHER_MAIN) renamed[field] = "main";
  return [
    T("focus", { key: otherTowerKey(td.focus), ...window }),
    renamed,
    T("focus", { key: td.focus, ...window }),
  ];
}
/** Effects that name a defeated stage of either villain name its current one. */
export function towerDefenseCanonicalTargets(s: GameState, e: Effect) {
  const td = s.towerDefense;
  if (!td) return;
  const fields = activationTypes.includes(e.type)
    ? [...focusFields, "attacker", "id"]
    : [...focusFields, "attacker"];
  for (const field of fields) {
    const id = e[field];
    if (typeof id !== "string") continue;
    const retired = s.removed.find((p) => p.id === id);
    const key = retired && towerKeyOf(retired);
    if (key) e[field] = towerVillain(s, key)!.id;
  }
}

/** The villain and main scheme out of focus are also legal targets. */
export function towerDefenseEnemyTarget(s: GameState) {
  const td = s.towerDefense;
  if (!td) return [];
  const v = td.other.villain;
  return [{ id: v.id, label: name(v), code: v.code }];
}
export function towerDefenseSchemeTarget(s: GameState) {
  const td = s.towerDefense;
  if (!td || td.other.scheme.threat <= 0) return [];
  return [
    {
      id: TOWER_OTHER_MAIN,
      label: name(td.other.scheme.code),
      code: td.other.scheme.code,
    },
  ];
}
export function towerDefenseOtherThreat(s: GameState) {
  return s.towerDefense?.other.scheme.threat || 0;
}

/** Each villain cannot be defeated while the other has hit points remaining,
 * so both are defeated together once both reach 0. */
export function towerDefenseDefeatCheck(
  s: GameState,
): "immune" | "both" | "alone" | null {
  const td = s.towerDefense;
  if (!td) return null;
  if (td.defeating === td.focus) return "alone";
  return td.other.villain.hp > 0 ? "immune" : "both";
}
/** Queue the simultaneous defeat of the villain out of focus. */
export function towerDefenseDefeatOther(s: GameState): Effect[] {
  const td = s.towerDefense;
  if (!td) return [];
  const other = otherTowerKey(td.focus);
  if (td.defeating === other) return [];
  td.defeating = other;
  return [
    T("focus", { key: other, mandatory: true }),
    T("defeat-focused", { mandatory: true }),
    T("focus", { key: td.focus, mandatory: true }),
  ];
}
/** The next stage of the villain in focus, or undefined after its last. */
export function towerDefenseNextStage(s: GameState): Piece | undefined {
  const td = s.towerDefense;
  if (!td) return undefined;
  if (td.defeating === td.focus) delete td.defeating;
  return td.villainDecks[td.focus].shift();
}
export function towerDefenseFinalDefeat(s: GameState) {
  const td = s.towerDefense;
  return !!td && !td.villainDecks[otherTowerKey(td.focus)].length;
}

/** Proxima's Spear, Corvus's Glaive and Direct Assault. */
export function towerDefenseKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  const td = s.towerDefense;
  if (!td) return 0;
  const key = towerKeyOf(p);
  if (!key || towerVillain(s, key)?.id !== p.id) return 0;
  const attached = (code: string) =>
    s.attachments.filter(
      (a) => a.code === code && a.attachedTo === p.id && !isTextBlank(s, a),
    ).length;
  const attacking = s.attack?.attacker === p.id;
  switch (keyword) {
    case "Overkill":
    case "Piercing":
      return key === "proxima" && attacking && attached(SPEAR) ? 1 : 0;
    case "Ranged":
      return attacking && attached(DIRECT_ASSAULT) ? 1 : 0;
    case "Retaliate":
      return key === "corvus" ? attached(GLAIVE) : 0;
    default:
      return 0;
  }
}

/** Proxima Midnight's Forced Interrupt when she attacks you. */
export function towerDefenseAttackInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    !s.towerDefense ||
    enemyId !== s.villain.id ||
    towerKeyOf(s.villain) !== "proxima" ||
    isTextBlank(s, s.villain) ||
    !towerDefenseTower(s)
  )
    return [];
  return [T("proxima-choice", { playerId, actorId: playerId })];
}

export interface TowerDefenseAttackReceipt {
  token: string;
  attackerId: string;
  attackerCode: string;
  playerId: string;
  performed: boolean;
  textBlank: boolean;
  undefended: boolean;
  defeatedAlly: boolean;
  boostCodes: string[];
}
/** Corvus Glaive's undefended attacks, Direct Assault and Rain Fire. */
export function towerDefenseAttackResponses(
  s: GameState,
  receipt: TowerDefenseAttackReceipt,
): MutagenForcedResponse[] {
  if (!s.towerDefense) return [];
  const responses: MutagenForcedResponse[] = [];
  const key = towerKeyOf(receipt.attackerCode);
  if (
    key === "corvus" &&
    receipt.performed &&
    receipt.undefended &&
    !receipt.textBlank
  )
    responses.push({
      id: `${receipt.token}:corvus`,
      title: "Corvus Glaive",
      effects: [T("corvus-discard", { actorId: receipt.playerId })],
    });
  const assaults = s.attachments.filter(
    (a) => a.code === DIRECT_ASSAULT && a.attachedTo === receipt.attackerId,
  );
  if (assaults.length)
    responses.push({
      id: `${receipt.token}:direct-assault`,
      title: "Direct Assault",
      effects: [
        T("direct-assault-end", {
          ids: assaults.map((a) => a.id),
          tower: receipt.defeatedAlly
            ? assaults.filter((a) => !isTextBlank(s, a)).length * 3
            : 0,
          actorId: receipt.playerId,
        }),
      ],
    });
  const rain = receipt.boostCodes.filter((code) => code === RAIN_FIRE).length;
  if (rain && receipt.defeatedAlly)
    responses.push({
      id: `${receipt.token}:rain-fire`,
      title: "Rain Fire",
      effects: [T("damage", { amount: 3 * rain, actorId: receipt.playerId })],
    });
  return responses;
}

/** Black Order Besieger: after it engages you. */
export function towerDefenseMinionEngaged(s: GameState, p: Piece): Effect[] {
  if (p.code !== BESIEGER || !s.towerDefense || isTextBlank(s, p)) return [];
  const playerId = p.engagedWith || s.activePlayerId;
  return [T("besieger", { id: p.id, playerId, actorId: playerId })];
}

/** City Under Attack's When Defeated. */
export function towerDefenseSchemeDefeated(
  _s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === CITY_UNDER_ATTACK
    ? [{ type: "draw", amount: 1, actorId: playerId }]
    : [];
}

/** Setup: stage 2A's When Revealed. Avengers Tower and Focused Defense are put
 * into play by the engine; each player then searches the encounter deck for a
 * Black Order Besieger, which engages them. */
export function towerDefenseSetup(s: GameState): Effect[] {
  return [
    T("besieger-search", {
      remaining: playerOrder(s).map((seat) => seat.id),
    }),
  ];
}

/** After the player phase ends, Focused Defense moves to the other main
 * scheme and that scheme's villain becomes the active villain. */
export function towerDefensePlayerPhaseEnded(s: GameState): Effect[] {
  return s.towerDefense ? [T("focused-defense", { mandatory: true })] : [];
}
/** Each main scheme gains threat during step 1 of the villain phase. */
export function towerDefenseStepOne(s: GameState): Effect[] {
  const td = s.towerDefense;
  if (!td) return [];
  return [
    T("focus", { key: otherTowerKey(td.focus), mandatory: true }),
    { type: "villainStepOne", towerSecond: true },
    T("focus", { key: td.focus, mandatory: true }),
  ];
}
/** A main scheme would be completed: remove all its threat instead. */
export function towerDefenseMainCompleted(s: GameState): Effect[] {
  const td = s.towerDefense;
  if (!td) return [];
  s.scheme.threat = 0;
  return td.focus === "proxima"
    ? [T("damage", { amount: 6 * s.playerCount, source: UNDER_SIEGE })]
    : [
        T("deal-each", {
          remaining: playerOrder(s).map((seat) => seat.id),
        }),
      ];
}

export function towerDefenseReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === SPEAR) return [T("attach", { piece: p, key: "proxima" })];
  if (p.code === GLAIVE) return [T("attach", { piece: p, key: "corvus" })];
  if (p.code === DIRECT_ASSAULT)
    return [T("attach", { piece: p, inactive: true })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case PROXIMAS_POWER:
      return [T("activate", { key: "proxima", playerId: s.activePlayerId })];
    case CORVUS_CUNNING:
      return [T("activate", { key: "corvus", playerId: s.activePlayerId })];
    case BOUND_BY_BLOOD:
      return [T("bound", { keys: ["proxima", "corvus"] })];
    case RAIN_FIRE:
      return [T("damage", { amount: 3, source: p.id })];
    default:
      return [];
  }
}

export function towerDefenseBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case PROXIMAS_POWER:
    case CORVUS_CUNNING:
      return [T("borrow")];
    case BOUND_BY_BLOOD:
      return s.towerDefense
        ? [T("bound", { keys: [s.towerDefense.active] })]
        : [];
    default:
      // Rain Fire's boost resolves after the attack, from its boost codes.
      return [];
  }
}

/** Hero Actions of Proxima's Spear and Corvus's Glaive. */
export function towerDefenseActions(
  s: GameState,
  p: Piece,
  ports?: Pick<TowerDefensePorts, "canPay">,
): Option[] {
  if (
    (p.code !== SPEAR && p.code !== GLAIVE) ||
    isTextBlank(s, p) ||
    s.player.form !== "hero" ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  const requirements: Resource[] =
    p.code === SPEAR ? ["energy", "mental"] : ["energy", "physical"];
  if (ports && !ports.canPay(s, 2, requirements)) return [];
  return [
    {
      id: "remove",
      label: `Take 1 damage, spend ${requirements.join(" and ")} · discard ${name(p)}`,
      image: p.code,
      effects: [T("weapon-pay", { id: p.id })],
    },
  ];
}

function damageTower(s: GameState, ports: TowerDefensePorts, amount: number) {
  const tower = towerDefenseTower(s);
  if (!tower || amount <= 0 || over(s)) return;
  tower.damage = (tower.damage || 0) + amount;
  const limit = towerDefenseTowerLimit(s);
  ports.log(
    s,
    `Avengers Tower takes ${amount} damage (${tower.damage}/${limit}).`,
    "bad",
  );
  if (tower.damage < limit) return;
  if (tower.code === AVENGERS_TOWER) {
    // Forced Response: remove all of it, then flip Avengers Tower over.
    tower.damage = 0;
    tower.code = DAMAGED_TOWER;
    ports.log(s, "Avengers Tower is damaged and flips over.", "bad");
    // When Revealed: discard each other Avengers Tower from play.
    for (const p of ports.avengersTowerSupports(s)) ports.discardPiece(s, p.id);
    return;
  }
  ports.endGame(
    s,
    false,
    "Avengers Tower falls. The Black Order seizes the Reality Stone.",
  );
}

export function resolveTowerDefenseEffect(
  s: GameState,
  e: Effect,
  ports: TowerDefensePorts,
): boolean {
  if (!e.type.startsWith("tower:")) return false;
  const td = s.towerDefense;
  switch (e.type) {
    case "tower:focus":
      towerDefenseFocus(s, e.key);
      break;
    case "tower:focused-defense": {
      if (!td) break;
      towerDefenseFocus(s, td.active);
      td.active = otherTowerKey(td.active);
      towerDefenseFocus(s, td.active);
      const fd = s.attachments.find((p) => p.code === FOCUSED_DEFENSE);
      if (fd) fd.attachedTo = `main:${s.scheme.code}`;
      ports.log(
        s,
        `Focused Defense moves to ${name(s.scheme.code)}: ${name(s.villain)} is the active villain.`,
      );
      break;
    }
    case "tower:defeat-focused":
      if (td && !over(s) && td.defeating === td.focus) ports.advanceVillain(s);
      break;
    case "tower:damage":
      damageTower(s, ports, Number(e.amount) || 0);
      break;
    case "tower:besieger-search": {
      const [playerId, ...rest] = (e.remaining as string[]) || [];
      if (!playerId) {
        ports.revealHidden(s);
        ports.shuffleEncounter(s);
        break;
      }
      ports.queue(s, T("besieger-search", { remaining: rest }));
      if (!alive(s, playerId)) break;
      ports.revealHidden(s);
      const p = s.encounter.deck.find((q) => q.code === BESIEGER);
      if (p) ports.putMinion(s, p, playerId);
      break;
    }
    case "tower:besieger": {
      if (!alive(s, e.playerId) || over(s)) break;
      const damage: Effect = {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "encounter",
        actorId: e.playerId,
      };
      if (!towerDefenseTower(s)) {
        ports.queue(s, damage);
        break;
      }
      ports.choose(
        s,
        "Black Order Besieger",
        `${ports.heroName(s, e.playerId)}: deal 1 damage to Avengers Tower or 2 damage to your identity.`,
        [
          {
            id: "tower",
            label: "Deal 1 damage to Avengers Tower",
            image: AVENGERS_TOWER,
            effects: [T("damage", { amount: 1, actorId: e.playerId })],
          },
          {
            id: "identity",
            label: "Deal 2 damage to your identity",
            effects: [damage],
          },
        ],
      );
      break;
    }
    case "tower:proxima-choice": {
      if (!alive(s, e.playerId) || over(s)) break;
      ports.choose(
        s,
        "Proxima Midnight",
        `${ports.heroName(s, e.playerId)}: deal 1 damage to Avengers Tower, or Proxima Midnight gets +2 ATK for this attack.`,
        [
          {
            id: "tower",
            label: "Deal 1 damage to Avengers Tower",
            image: AVENGERS_TOWER,
            effects: [T("damage", { amount: 1, actorId: e.playerId })],
          },
          {
            id: "attack",
            label: "Proxima Midnight gets +2 ATK for this attack",
            image: s.villain.code,
            effects: [T("proxima-attack")],
          },
        ],
      );
      break;
    }
    case "tower:proxima-attack": {
      const a = s.attack;
      if (!a || a.attacker !== s.villain.id) break;
      if (towerKeyOf(s.villain) !== "proxima") break;
      a.modifier = (a.modifier || 0) + 2;
      // The attack's initiation window carries its modifier forward.
      for (const q of s.queue)
        if (
          q.type === "enemyAttackInitiationWindow" &&
          q.attacker === a.attacker
        )
          q.modifier = (Number(q.modifier) || 0) + 2;
      break;
    }
    case "tower:corvus-discard": {
      const { piece } = ports.discardTop(s);
      if (!piece) break;
      const icons = definitions.get(piece.code)?.boost || 0;
      ports.log(
        s,
        `Corvus Glaive discards ${name(piece)} (${icons} boost icon${icons === 1 ? "" : "s"}).`,
        "bad",
      );
      damageTower(s, ports, icons);
      break;
    }
    case "tower:direct-assault-end":
      damageTower(s, ports, Number(e.tower) || 0);
      for (const id of (e.ids as string[]) || [])
        if (s.attachments.some((a) => a.id === id)) ports.discardPiece(s, id);
      break;
    case "tower:activate": {
      if (!td || !alive(s, e.playerId) || over(s)) break;
      ports.queue(
        s,
        T("focus", { key: e.key, mandatory: true }),
        T("activate-focused", { playerId: e.playerId, actorId: e.playerId }),
        T("focus", { key: td.focus, mandatory: true }),
      );
      break;
    }
    case "tower:activate-focused":
      if (!alive(s, e.playerId) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    case "tower:borrow": {
      // Add the other villain's SCH and ATK for this activation.
      if (!td) break;
      const activation = s.attack || s.scheming;
      if (!activation || activation.attacker !== s.villain.id) break;
      if (!towerKeyOf(s.villain)) break;
      const kind = s.attack ? "attack" : "scheme";
      const bonus = ports.villainStat(
        s,
        td.other.villain,
        kind,
        s.activePlayerId,
      );
      activation.modifier = (activation.modifier || 0) + bonus;
      ports.log(
        s,
        `${name(s.villain)} adds ${name(td.other.villain)}'s ${kind === "attack" ? "ATK" : "SCH"} (+${bonus}).`,
        "bad",
      );
      break;
    }
    case "tower:bound": {
      for (const key of (e.keys as TowerKey[]) || []) {
        const v = towerVillain(s, key);
        if (!v) continue;
        const healed = Math.max(0, Math.min(2, v.maxHp - v.hp));
        v.hp += healed;
        if (healed) ports.log(s, `${name(v)} heals ${healed}.`, "bad");
        ports.giveTough(s, v);
      }
      break;
    }
    case "tower:attach": {
      const p = e.piece as Piece;
      const key: TowerKey | undefined = !td
        ? undefined
        : e.inactive
          ? otherTowerKey(td.active)
          : e.key;
      const host = key && towerVillain(s, key);
      if (host) ports.attach(s, p, host.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "tower:weapon-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error(`${name(e.id)} is no longer attached.`);
      ports.pay(
        s,
        2,
        p.code === SPEAR ? ["energy", "mental"] : ["energy", "physical"],
        [
          { type: "damage", target: "hero", amount: 1 },
          { type: "discardPiece", id: p.id },
        ],
        name(p),
        true,
      );
      break;
    }
    case "tower:deal-each": {
      // Deal each player 1 facedown encounter card, in player order.
      for (const playerId of (e.remaining as string[]) || [])
        if (alive(s, playerId)) ports.dealEncounter(s, playerId);
      break;
    }
    default:
      return false;
  }
  return true;
}
