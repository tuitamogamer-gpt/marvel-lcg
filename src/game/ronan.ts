import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type {
  Attack,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** The Galaxy's Most Wanted: Ronan the Accuser and the Kree Militants modular
 * set. Its required Power Stone and Ship Command sets are registered by the
 * Nebula and Brotherhood of Badoon modules. */
export const RONAN_SCENARIO_CODES = [
  "16103",
  "16104",
  "16105",
  "16106a",
  "16106b",
  "16107a",
  "16107b",
  "16108",
  "16109",
  "16110",
  "16111",
  "16112",
  "16113",
  "16114",
  "16115",
  "16116",
] as const;
export const KREE_MILITANTS_CODES = [
  "16131",
  "16132",
  "16133",
  "16134",
] as const;
export const RONAN_SCRIPT_CODES = [
  ...RONAN_SCENARIO_CODES,
  ...KREE_MILITANTS_CODES,
] as const;
export const RONAN_VILLAINS = ["16103", "16104", "16105"] as const;
export const KREE_COMMAND_SHIP = "16108";
export const UNIVERSAL_WEAPON = "16109";
const FANATICISM = "16110";
const CUT_THE_POWER = "16111";
const SUPERIOR_TACTICS = "16113";
const COMBAT_ARMOR = "16131";
const POWER_STONE = "16149";
const MILANO = "16142";

export interface RonanState {
  currentMain: Piece;
  mainDeck: Piece[];
  villainDeck: Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const R = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ronan:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (RONAN_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const isRonan = (s: GameState) =>
  (RONAN_VILLAINS as readonly string[]).includes(s.villain.code);

export interface RonanPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  giveTough(s: GameState, id: string): boolean;
  canPayWithoutMilano(s: GameState, cost: number): boolean;
  milano(s: GameState): Piece | undefined;
  enemyStat(s: GameState, p: Piece, stat: "attack" | "scheme"): number;
  /** Cosmic Ward's native cancellation: begin the reveal window without its
   * When Revealed text. */
  cancelWhenRevealed(s: GameState, p: Piece, after: Effect[]): void;
  heroName(s: GameState, playerId: string): string;
}

function stone(s: GameState) {
  return s.attachments.find((p) => p.code === POWER_STONE);
}
/** The player whose identity has the Power Stone attached, if any. */
export function ronanStoneController(s: GameState): string | undefined {
  const attachedTo = stone(s)?.attachedTo;
  if (!attachedTo) return undefined;
  if (attachedTo === "hero") return s.activePlayerId;
  return attachedTo.startsWith("hero:") ? attachedTo.slice(5) : undefined;
}
/** Superior Tactics: the Power Stone cannot be unattached from Ronan. */
export function ronanStoneLocked(s: GameState) {
  return (
    stone(s)?.attachedTo === s.villain.id &&
    isRonan(s) &&
    s.sideSchemes.some((p) => p.code === SUPERIOR_TACTICS && !isTextBlank(s, p))
  );
}
/** "Take What Is Mine" (2B): while the Power Stone is attached to Ronan,
 * threat cannot be removed from it. */
export function ronanMainLocked(s: GameState, target: string) {
  return (
    target === "main" &&
    !!s.ronan &&
    s.scheme.code === "16107b" &&
    !isTextBlank(s, s.ronan.currentMain) &&
    stone(s)?.attachedTo === s.villain.id
  );
}
/** Kree Command Ship's hazard icon. */
export function ronanHazard(s: GameState) {
  return (s.environments || []).filter(
    (p) => p.code === KREE_COMMAND_SHIP && !isTextBlank(s, p),
  ).length;
}

/** Granted keywords: Universal Weapon's stalwart and Fanaticism's overkill and
 * piercing while Ronan attacks. */
export function ronanKeyword(s: GameState, p: Piece, keyword: string) {
  if (!s.ronan || p.id !== s.villain.id) return false;
  const attached = (code: string) =>
    s.attachments.some(
      (a) => a.code === code && a.attachedTo === p.id && !isTextBlank(s, a),
    );
  if (keyword === "Stalwart") return attached(UNIVERSAL_WEAPON);
  if (keyword === "Overkill" || keyword === "Piercing")
    return s.attack?.attacker === p.id && attached(FANATICISM);
  return false;
}

/** Kree Combat Armor reduces the damage its enemy takes from each attack by 1. */
export function ronanAttackDamage(
  s: GameState,
  targetId: string,
  amount: number,
  attackKey?: string,
): number {
  if (amount <= 0) return amount;
  const reduction = s.attachments.filter(
    (p) =>
      p.code === COMBAT_ARMOR &&
      p.attachedTo === targetId &&
      !isTextBlank(s, p),
  ).length;
  if (!reduction) return amount;
  const key = attackKey ? `kreeArmor:${attackKey}:${targetId}` : undefined;
  const used = key ? Number(s.flags[key] || 0) : 0;
  const reduced = Math.min(amount, Math.max(0, reduction - used));
  if (key && reduced) s.flags[key] = used + reduced;
  return amount - reduced;
}

/** Ronan's Forced Interrupt: 1 additional boost card when he activates
 * against the player who controls the Power Stone. */
export function ronanActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    !s.ronan ||
    enemyId !== s.villain.id ||
    !isRonan(s) ||
    isTextBlank(s, s.villain) ||
    ronanStoneController(s) !== playerId
  )
    return [];
  return [R("extra-boost", { actorId: playerId })];
}

/** Fanaticism: at the end of Ronan's attack, remove 1 fury counter. */
export function ronanAttackResponses(
  s: GameState,
  a: Attack,
): MutagenForcedResponse[] {
  if (!s.ronan || a.attacker !== s.villain.id) return [];
  const fanaticism = s.attachments.filter(
    (p) =>
      p.code === FANATICISM &&
      p.attachedTo === s.villain.id &&
      !isTextBlank(s, p),
  );
  return fanaticism.length
    ? [
        {
          id: `${a.id}:fanaticism`,
          sourceId: fanaticism[0].id,
          title: "Fanaticism",
          effects: [R("fury", { ids: fanaticism.map((p) => p.id) })],
        },
      ]
    : [];
}

export function ronanReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === UNIVERSAL_WEAPON)
    return [R("attach", { piece: p, to: "villain" })];
  if (p.code === FANATICISM)
    return [R("attach", { piece: p, to: "villain", fury: true })];
  if (p.code === COMBAT_ARMOR)
    return [R("attach", { piece: p, to: "high-atk" })];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "16104":
      return [
        R("seek-scheme", { code: CUT_THE_POWER, playerId: s.activePlayerId }),
      ];
    case "16105":
      return [
        R("seek-scheme", {
          code: SUPERIOR_TACTICS,
          playerId: s.activePlayerId,
        }),
      ];
    case "16107a":
      return [R("take-what-is-mine")];
    case SUPERIOR_TACTICS:
      return [R("tactics", { id: p.id })];
    case "16114":
      return [R("fury-attack", { playerId: s.activePlayerId })];
    case "16115":
      return [R("physiology", { playerId: s.activePlayerId })];
    case "16116":
      return [
        R("accused", {
          playerId: s.activePlayerId,
          kind: s.player.form === "hero" ? "attack" : "scheme",
        }),
      ];
    default:
      return [];
  }
}

export function ronanBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const attack = !!s.attack && (s.attack || s.scheming) === s.attack;
  switch (p.code) {
    case UNIVERSAL_WEAPON:
      return [R("weapon-boost", { id: p.id })];
    case CUT_THE_POWER:
      return [R("cut-boost")];
    case "16114":
      return [R("stone-to-ronan")];
    case "16116":
      return [R("extra-boost")];
    case "16132":
      return attack ? [R("attack-keyword", { keyword: "Piercing" })] : [];
    case "16133":
      return attack ? [R("icons", { amount: 3 })] : [];
    case "16134":
      return attack ? [R("attack-keyword", { keyword: "Overkill" })] : [];
    default:
      return [];
  }
}

/** Kree Command Ship's First Player Interrupt for a treachery revealed from
 * the encounter deck. */
export function ronanRevealInterrupts(
  s: GameState,
  p: Piece,
  fromEncounterDeck: boolean,
  revealingId: string,
  ports: Pick<RonanPorts, "canPayWithoutMilano" | "milano">,
): Option[] {
  const ship = (s.environments || []).find(
    (q) => q.code === KREE_COMMAND_SHIP && !isTextBlank(s, q),
  );
  const milano = ports.milano(s);
  if (
    !ship ||
    !fromEncounterDeck ||
    definitions.get(p.code)?.type_code !== "treachery" ||
    !milano ||
    milano.exhausted ||
    isTextBlank(s, milano) ||
    /cannot be cancel(?:ed|led)/i.test(definitions.get(p.code)?.text || "") ||
    !alive(s, s.firstPlayerId) ||
    !ports.canPayWithoutMilano(seatView(s, s.firstPlayerId), 1)
  )
    return [];
  return [
    {
      id: "kree-command-ship",
      label:
        "Kree Command Ship · exhaust the Milano and spend 1 resource · cancel When Revealed",
      image: ship.code,
      effects: [
        R("ship-cancel", {
          piece: p,
          playerId: revealingId,
          actorId: s.firstPlayerId,
        }),
      ],
    },
  ];
}

/** Hero Actions: Universal Weapon and Kree Combat Armor. */
export function ronanActions(
  s: GameState,
  p: Piece,
  ports?: Pick<RonanPorts, "canPay">,
): Option[] {
  if (
    !known(p) ||
    isTextBlank(s, p) ||
    s.player.form !== "hero" ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  if (p.code === UNIVERSAL_WEAPON)
    return s.player.hp > 2
      ? [
          {
            id: "remove",
            label:
              "Take 2 damage and deal yourself a facedown encounter card · shuffle Universal Weapon into the encounter deck",
            image: p.code,
            effects: [
              R("weapon-remove", { id: p.id, playerId: s.activePlayerId }),
            ],
          },
        ]
      : [];
  if (p.code === COMBAT_ARMOR)
    return (["energy", "mental", "physical"] as Resource[])
      .filter((t) => !ports || ports.canPay(s, 3, [t, t, t]))
      .map((t) => ({
        id: `remove-${t}`,
        label: `Spend ${t} ×3 · discard Kree Combat Armor`,
        image: p.code,
        effects: [R("armor-pay", { id: p.id, resource: t })],
      }));
  return [];
}

export function resolveRonanEffect(
  s: GameState,
  e: Effect,
  ports: RonanPorts,
): boolean {
  if (!e.type.startsWith("ronan:")) return false;
  const milano = ports.milano(s);
  const milanoReady = !!milano && !milano.exhausted && !isTextBlank(s, milano);
  switch (e.type) {
    case "ronan:attach": {
      const p = e.piece as Piece;
      if (e.to === "villain") {
        if (!isRonan(s)) break;
        ports.attach(s, p, s.villain.id);
        // Uses (1 fury counter, plus 1 per player additional fury counters).
        if (e.fury) p.counters = 1 + s.playerCount;
        break;
      }
      const enemies = [s.villain, ...s.minions];
      const value = (q: Piece) => ports.enemyStat(s, q, "attack");
      const top = Math.max(...enemies.map(value));
      const tied = enemies.filter((q) => value(q) === top);
      if (tied.length === 1) ports.attach(s, p, tied[0].id);
      else
        ports.choose(
          s,
          name(p),
          "Choose the enemy tied for the highest ATK.",
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [R("attach-to", { piece: p, id: q.id })],
          })),
        );
      break;
    }
    case "ronan:main-back": {
      if (!s.ronan) break;
      const main = s.ronan.currentMain;
      const back = definitions.get(main.code)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = definitions.get(main.code);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      break;
    }
    case "ronan:attach-to":
      if ([s.villain, ...s.minions].some((q) => q.id === e.id))
        ports.attach(s, e.piece, e.id);
      break;
    case "ronan:extra-boost":
      if (
        s.attack?.attacker === s.villain.id ||
        s.scheming?.attacker === s.villain.id
      )
        ports.giveBoost(s, s.villain.id, "current");
      break;
    case "ronan:fury": {
      for (const id of e.ids as string[]) {
        const p = s.attachments.find((q) => q.id === id);
        if (!p) continue;
        p.counters = Math.max(0, p.counters - 1);
        if (!p.counters) ports.discardPiece(s, p.id);
      }
      break;
    }
    case "ronan:seek-scheme": {
      // Search the encounter deck and discard pile, reveal it, then shuffle.
      ports.revealHidden(s);
      const zones = [s.encounter.deck, s.encounter.discard];
      const zone = zones.find((z) => z.some((q) => q.code === e.code));
      const p = zone?.find((q) => q.code === e.code);
      ports.shuffleEncounter(s);
      if (p) ports.reveal(s, p, e.playerId);
      break;
    }
    case "ronan:take-what-is-mine": {
      const p = stone(s);
      if (!p || !isRonan(s)) break;
      if (p.attachedTo === s.villain.id)
        ports.giveBoost(s, s.villain.id, "next");
      else p.attachedTo = s.villain.id;
      break;
    }
    case "ronan:tactics": {
      const p = stone(s);
      if (!p || !isRonan(s)) break;
      if (p.attachedTo === s.villain.id) {
        const scheme = s.sideSchemes.find((q) => q.id === e.id);
        if (scheme)
          ports.queue(s, {
            type: "threat",
            target: scheme.id,
            amount: s.playerCount,
          });
      } else p.attachedTo = s.villain.id;
      break;
    }
    case "ronan:stone-to-ronan": {
      const p = stone(s);
      if (p && isRonan(s)) p.attachedTo = s.villain.id;
      break;
    }
    case "ronan:fury-attack": {
      // Ronan attacks the player who controls the Power Stone, even in
      // alter-ego form; without an attack this card gains surge.
      const target = ronanStoneController(s);
      if (!target || !alive(s, target) || !isRonan(s)) {
        ports.queue(s, {
          type: "surge",
          sourceCode: "16114",
          actorId: e.playerId,
        });
        break;
      }
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: target,
        kind: "attack",
        modifier: 0,
        after: R("fury-after", { playerId: e.playerId }),
      });
      break;
    }
    case "ronan:fury-after":
      if (!e.performed)
        ports.queue(s, {
          type: "surge",
          sourceCode: "16114",
          actorId: e.playerId,
        });
      break;
    case "ronan:physiology":
      if (s.villain.tough)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 1,
          source: "encounter",
          actorId: e.playerId,
        });
      else ports.giveTough(s, s.villain.id);
      break;
    case "ronan:accused":
      if (alive(s, e.playerId))
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: 1,
        });
      break;
    case "ronan:weapon-boost": {
      const activation = s.attack || s.scheming;
      const p = s.resolving.find((q) => q.id === e.id);
      if (!activation || !p || !isRonan(s)) break;
      (activation.retainedBoostIds ||= []).push(e.id);
      ports.attach(s, p, s.villain.id);
      break;
    }
    case "ronan:cut-boost": {
      const options: Option[] = [];
      if (milanoReady)
        options.push({
          id: "milano",
          label: "Exhaust the Milano",
          image: MILANO,
          effects: [R("exhaust-milano")],
        });
      options.push({
        id: "threat",
        label: "Place 2 threat on the main scheme",
        effects: [{ type: "threat", target: "main", amount: 2 }],
      });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else ports.choose(s, "Cut the Power", "Choose one.", options);
      break;
    }
    case "ronan:exhaust-milano":
      if (milanoReady) milano!.exhausted = true;
      break;
    case "ronan:attack-keyword":
      // Shares the attack's granted-keyword list with Band of Badoon.
      if (s.attack)
        s.attack.badoonKeywords = [
          ...new Set([...(s.attack.badoonKeywords || []), e.keyword as string]),
        ];
      break;
    case "ronan:icons": {
      const activation = s.attack || s.scheming;
      if (activation)
        activation.extraBoostIcons =
          (activation.extraBoostIcons || 0) + Number(e.amount || 0);
      break;
    }
    case "ronan:ship-cancel": {
      const p = e.piece as Piece;
      if (!milanoReady || !s.resolving.some((q) => q.id === p.id))
        throw Error(
          "Kree Command Ship needs the ready Milano and the revealed treachery.",
        );
      milano!.exhausted = true;
      ports.pay(
        s,
        1,
        [],
        // The revealing player stays the reveal window's player.
        [R("ship-cancelled", { piece: p, actorId: e.playerId })],
        "Kree Command Ship",
        false,
      );
      break;
    }
    case "ronan:ship-cancelled":
      ports.cancelWhenRevealed(s, e.piece, []);
      break;
    case "ronan:weapon-remove": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId))
        throw Error("Universal Weapon is no longer attached.");
      ports.queue(
        s,
        {
          type: "damage",
          target: "hero",
          amount: 2,
          source: "encounter",
          actorId: e.playerId,
        },
        R("weapon-shuffle", { id: p.id, playerId: e.playerId }),
      );
      break;
    }
    case "ronan:weapon-shuffle": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      s.attachments = s.attachments.filter((q) => q.id !== p.id);
      delete p.attachedTo;
      ports.shuffleIntoEncounter(s, p);
      break;
    }
    case "ronan:armor-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error("Kree Combat Armor is no longer attached.");
      const t = e.resource as Resource;
      ports.pay(
        s,
        3,
        [t, t, t],
        [{ type: "discardPiece", id: p.id }],
        "Kree Combat Armor",
        true,
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
