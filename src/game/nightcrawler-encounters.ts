import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { playerOrder, seatView } from "./team.js";
import type { Attack, Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const N = (type: string, args: Record<string, unknown> = {}) =>
  E(`nightcrawler-encounter:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const trait = (p: Piece, name: string) =>
  (card(p).traits || "").split(/\.\s*/).includes(name);
const nightcrawler = (s: GameState) =>
  playerOrder(s).find((seat) => seat.heroId === "nightcrawler");
const reset = (p: Piece): Piece => ({
  id: p.id,
  code: p.code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...(p.ownerId ? { ownerId: p.ownerId } : {}),
});

export const NIGHTCRAWLER_ENCOUNTER_CODES = [
  ...Array.from({ length: 5 }, (_, i) => String(48026 + i)),
  ...Array.from({ length: 6 }, (_, i) => String(48033 + i)),
];

export interface NightcrawlerEncounterCharacter {
  id: string;
  label: string;
  code?: string;
  playerId: string;
  remainingHP: number;
}
export interface NightcrawlerEncounterPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  hidden(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  discardHand(s: GameState, id: string): Piece;
  discard(s: GameState, id: string): void;
  discardEncounterControlled(s: GameState, id: string, source?: string): void;
  canDiscard(s: GameState, p: Piece): boolean;
  removeEncounter(s: GameState, id: string): void;
  /** Clean attachments/nested cards and native leave-play state, without defeat. */
  takeMinion(s: GameState, p: Piece): Piece | undefined;
  attach(s: GameState, p: Piece, target: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  canChangeToAlter(s: GameState): boolean;
  random(s: GameState, upper: number): number;
  characters(s: GameState): NightcrawlerEncounterCharacter[];
  /** Existing Azazel retains damage/status; same-player reveal does not re-engage. */
  revealExistingMinion(s: GameState, p: Piece, playerId: string): void;
  discardEncounterTop(s: GameState): Piece | undefined;
}

export function nightcrawlerEncounterInitialize(
  s: GameState,
  make: NightcrawlerEncounterPorts["makePiece"],
) {
  if (s.heroId !== "nightcrawler" || s.flags.nightcrawlerEncounterInitialized)
    return;
  for (const code of ["48027", "48028", "48029", "48030", "48030"])
    (s.player.setAside ||= []).push(make(s, code));
  s.flags.nightcrawlerEncounterInitialized = true;
}

/** RRG1.8 p19: Find excludes facedown dealt/assigned boosts, victory and removed. */
function encounterZones(s: GameState): Piece[][] {
  const zones = [
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.resolving,
    s.encounter.deck,
    s.encounter.discard,
    ...playerOrder(s).flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.setAside || [], p.hand, p.deck, p.discard, p.inPlay];
    }),
  ];
  const visit = (p: Piece) => {
    for (const zone of [p.storedCards, p.captured])
      if (zone) {
        zones.push(zone);
        zone.forEach(visit);
      }
  };
  zones.flat().forEach(visit);
  return zones;
}
function findEncounter(s: GameState, code: string) {
  const known = encounterZones(s)
    .filter((zone) => zone !== s.encounter.deck)
    .flat()
    .find((p) => p.code === code);
  return {
    piece: known || s.encounter.deck.find((p) => p.code === code),
    searchedDeck: !known,
  };
}
function takeEncounter(
  s: GameState,
  id: string,
  ports: NightcrawlerEncounterPorts,
) {
  const minion = s.minions.find((p) => p.id === id);
  const actual = minion ? ports.takeMinion(s, minion) : undefined;
  let found = actual;
  if (!minion)
    for (const zone of encounterZones(s)) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) {
        found = zone.splice(i, 1)[0];
        break;
      }
    }
  if (!found) return;
  ports.removeEncounter(s, id);
  const activation = s.scheming || s.attack;
  if (activation?.boostIds?.includes(id))
    (activation.retainedBoostIds ||= []).push(id);
  s.queue = s.queue.filter((e) => !(e.type === "reveal" && e.piece?.id === id));
  return reset(found);
}
function dealActual(
  s: GameState,
  id: string,
  playerId: string,
  ports: NightcrawlerEncounterPorts,
) {
  const p = takeEncounter(s, id, ports);
  if (!p) return;
  p.dealtTo = playerId;
  s.encounter.dealt.push(p);
}

export function nightcrawlerEncounter(s: GameState, p: Piece): Effect[] | null {
  if (!NIGHTCRAWLER_ENCOUNTER_CODES.includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "48026":
      return [N("obligation", { piece: p })];
    case "48027":
    case "48028":
    case "48033":
      return [];
    case "48029":
      return [N("sword", { piece: p })];
    case "48030":
      return [N("brimstone", { scheme: s.player.form === "alter" })];
    case "48034":
      return [N("queen")];
    case "48035":
      return [N("jester", { source: p.id })];
    case "48036":
      return [N("executioner", { id: p.id })];
    case "48037":
      return [N("tweedledope", { source: p.id })];
    case "48038":
      return [
        N("off-head", { ids: s.minions.map((m) => m.id), activated: false }),
      ];
    default:
      return [];
  }
}
export function nightcrawlerEncounterBoost(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code !== "48027") return null;
  const owner = nightcrawler(s);
  if (!owner) return [];
  const activation = s.scheming || s.attack;
  if (activation) (activation.retainedBoostIds ||= []).push(p.id);
  return [N("azazel-dealt", { id: p.id, playerId: owner.id })];
}
export const nightcrawlerEncounterShadows = (s: GameState): Effect[] | null =>
  s.heroId === "nightcrawler" ? [N("shadows")] : null;
export function nightcrawlerEncounterSchemeDefeated(
  _s: GameState,
  p: Piece,
): Effect[] {
  return p.code === "48028" && !isTextBlank(_s, p) ? [N("dimension")] : [];
}
export function nightcrawlerEncounterMinionSchemed(
  s: GameState,
  minionId: string,
  playerId: string,
): Effect[] {
  const minion = s.minions.find((p) => p.id === minionId);
  return minion &&
    !trait(minion, "Elite") &&
    s.sideSchemes.some((p) => p.code === "48033" && !isTextBlank(s, p))
    ? [N("gang", { id: minionId, playerId })]
    : [];
}
export function nightcrawlerEncounterAttackComplete(
  s: GameState,
  a: Attack,
): Effect[] {
  const playerId = a.targetPlayerId || a.originalPlayerId || s.activePlayerId;
  const view = seatView(s, playerId);
  if (
    view.player.form !== "hero" ||
    deadpoolTriggeredBlocked(view) ||
    !view.player.hand.length
  )
    return [];
  return s.attachments
    .filter(
      (p) =>
        p.code === "48029" && p.attachedTo === a.attacker && !isTextBlank(s, p),
    )
    .map((p) => N("sword-window", { id: p.id, actorId: playerId }));
}
export function nightcrawlerEncounterExecutionerRemoves(
  s: GameState,
  p: Piece,
  source: string,
  enemyAttack: boolean,
) {
  return (
    enemyAttack &&
    !s.minions.some((m) => m.id === p.id) &&
    (card(p).type_code === "ally" || !!p.treatedAsAlly) &&
    s.attack?.attacker === source &&
    s.attack.activationAfter?.type ===
      "nightcrawler-encounter:executioner-after"
  );
}
export function nightcrawlerEncounterCanAttach(
  s: GameState,
  id: string,
  upgrade: Piece,
) {
  const target = s.minions.find((p) => p.id === id);
  return !(
    target?.code === "48027" &&
    !isTextBlank(s, target) &&
    card(upgrade).type_code === "upgrade"
  );
}
export const nightcrawlerEncounterEnemyModifiers = (
  s: GameState,
  id: string,
) => ({
  piercing: s.attachments.some(
    (p) => p.code === "48029" && p.attachedTo === id && !isTextBlank(s, p),
  ),
});

export function resolveNightcrawlerEncounter(
  s: GameState,
  e: Effect,
  ports: NightcrawlerEncounterPorts,
) {
  if (!e.type.startsWith("nightcrawler-encounter:")) return false;
  switch (e.type) {
    case "nightcrawler-encounter:obligation": {
      const owner = nightcrawler(s);
      if (owner && owner.id !== s.activePlayerId) {
        ports.queue(s, { ...e, actorId: owner.id });
        break;
      }
      if (!owner) break;
      if (s.player.form === "hero" && ports.canChangeToAlter(s))
        ports.choose(
          s,
          "Crisis of Faith",
          "You may change to alter-ego form before choosing.",
          [
            O(
              "flip",
              "Change to Kurt Wagner",
              [
                E("flip", { counts: false, target: "alter" }),
                N("obligation-pick", { piece: e.piece }),
              ],
              "48001b",
            ),
            O(
              "stay",
              "Stay in hero form",
              [N("obligation-pick", { piece: e.piece })],
              "48001a",
            ),
          ],
        );
      else ports.queue(s, N("obligation-pick", { piece: e.piece }));
      break;
    }
    case "nightcrawler-encounter:obligation-pick":
      ports.choose(
        s,
        "Crisis of Faith",
        "Choose how to resolve this obligation.",
        [
          ...(s.player.form === "alter" && !s.player.exhausted
            ? [
                O(
                  "settle",
                  "Exhaust Kurt Wagner to remove this obligation",
                  [E("settle", { piece: e.piece })],
                  "48026",
                ),
              ]
            : []),
          O(
            "discard",
            "Discard each Attack and Defense event from your hand",
            [N("faith-discard")],
            "48026",
          ),
        ],
      );
      break;
    case "nightcrawler-encounter:faith-discard":
      for (const p of [...s.player.hand].filter(
        (p) =>
          card(p).type_code === "event" &&
          (trait(p, "Attack") || trait(p, "Defense")),
      ))
        ports.discardHand(s, p.id);
      break;
    case "nightcrawler-encounter:sword": {
      const azazel = s.minions.find((p) => p.code === "48027");
      ports.attach(s, e.piece, azazel?.id || s.villain.id);
      break;
    }
    case "nightcrawler-encounter:sword-window": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "48029");
      if (
        p &&
        !isTextBlank(s, p) &&
        s.player.form === "hero" &&
        !deadpoolTriggeredBlocked(s) &&
        s.player.hand.length &&
        ports.canDiscard(s, p)
      )
        ports.queue(
          s,
          E("optional", {
            title: "Azazel's Sword",
            text: "Discard a random card from hand to discard Azazel's Sword?",
            effects: [N("sword-discard", { id: p.id })],
          }),
        );
      break;
    }
    case "nightcrawler-encounter:sword-discard": {
      const p = s.attachments.find((p) => p.id === e.id && p.code === "48029");
      need(
        p &&
          !isTextBlank(s, p) &&
          s.player.form === "hero" &&
          !deadpoolTriggeredBlocked(s) &&
          s.player.hand.length &&
          ports.canDiscard(s, p),
        "Azazel's Sword requires its actual attachment and a random hand card.",
      );
      ports.hidden(s);
      const random = s.player.hand[ports.random(s, s.player.hand.length)];
      ports.discardHand(s, random.id);
      ports.discard(s, p!.id);
      break;
    }
    case "nightcrawler-encounter:brimstone": {
      const found = findEncounter(s, "48027"),
        p = found.piece;
      if (found.searchedDeck) {
        ports.hidden(s);
        ports.queue(s, N("find-shuffle"));
      }
      if (!p) break;
      // add() prepends: the native reveal/engagement must complete before SCH.
      if (e.scheme) ports.queue(s, N("brimstone-scheme", { id: p.id }));
      const existing = s.minions.find((m) => m.id === p.id);
      if (existing) ports.revealExistingMinion(s, existing, s.activePlayerId);
      else {
        const found = takeEncounter(s, p.id, ports);
        if (found) ports.queue(s, E("reveal", { piece: found }));
      }
      break;
    }
    case "nightcrawler-encounter:find-shuffle":
      ports.shuffleEncounter(s);
      break;
    case "nightcrawler-encounter:brimstone-scheme":
      if (s.minions.some((p) => p.id === e.id))
        ports.queue(s, E("enemyScheme", { id: e.id }));
      break;
    case "nightcrawler-encounter:dimension": {
      const found = findEncounter(s, "48027"),
        p = found.piece;
      if (found.searchedDeck) ports.hidden(s);
      if (p) dealActual(s, p.id, s.activePlayerId, ports);
      if (found.searchedDeck) ports.shuffleEncounter(s);
      break;
    }
    case "nightcrawler-encounter:azazel-dealt":
      dealActual(s, e.id, e.playerId, ports);
      break;
    case "nightcrawler-encounter:queen": {
      ports.hidden(s);
      if (s.sideSchemes.some((p) => p.code === "48033"))
        ports.dealEncounter(s, s.activePlayerId);
      else {
        const p = [...s.encounter.deck, ...s.encounter.discard].find(
          (p) => p.code === "48033",
        );
        if (p) {
          const actual = takeEncounter(s, p.id, ports);
          if (actual) ports.queue(s, E("reveal", { piece: actual }));
        }
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "nightcrawler-encounter:jester":
    case "nightcrawler-encounter:tweedledope": {
      const status = e.type.endsWith("jester") ? "confused" : "stunned";
      const already = s.player[status];
      ports.queue(
        s,
        E("status", { target: "hero", status }),
        ...(already
          ? [
              N("discard-controlled", {
                cardType: status === "confused" ? "support" : "upgrade",
                title: status === "confused" ? "Jester" : "Tweedledope",
                source: e.source,
              }),
            ]
          : []),
      );
      break;
    }
    case "nightcrawler-encounter:discard-controlled": {
      const candidates = s.player.inPlay.filter(
        (p) => card(p).type_code === e.cardType && ports.canDiscard(s, p),
      );
      if (candidates.length)
        ports.choose(
          s,
          e.title,
          `Discard a ${e.cardType} you control.`,
          candidates.map((p) =>
            O(
              p.id,
              card(p).name,
              [
                N("discard-chosen", {
                  id: p.id,
                  cardType: e.cardType,
                  source: e.source,
                }),
              ],
              p.code,
            ),
          ),
        );
      break;
    }
    case "nightcrawler-encounter:discard-chosen": {
      const p = s.player.inPlay.find((p) => p.id === e.id);
      need(
        p && card(p).type_code === e.cardType && ports.canDiscard(s, p),
        "The selected controlled card cannot be discarded.",
      );
      ports.discardEncounterControlled(s, p!.id, e.source);
      break;
    }
    case "nightcrawler-encounter:executioner": {
      if (!s.minions.some((p) => p.id === e.id)) break;
      const candidates = ports.characters(s).filter((p) => p.remainingHP > 0);
      const fewest = Math.min(...candidates.map((p) => p.remainingHP));
      const tied = candidates.filter((p) => p.remainingHP === fewest);
      const effects = (p: NightcrawlerEncounterCharacter) => [
        N("executioner-target", {
          id: e.id,
          target: p.id,
          playerId: p.playerId,
        }),
      ];
      if (tied.length === 1) ports.queue(s, ...effects(tied[0]));
      else if (tied.length > 1)
        ports.choose(
          s,
          "Executioner",
          "Choose a friendly character tied for the fewest remaining hit points.",
          tied.map((p) => O(p.id, p.label, effects(p), p.code)),
        );
      break;
    }
    case "nightcrawler-encounter:executioner-target":
      if (s.minions.some((p) => p.id === e.id))
        ports.queue(
          s,
          E("enemyAttack", {
            id: e.id,
            actorId: e.playerId,
            originalTarget: e.target.startsWith("hero:") ? "hero" : e.target,
            activation: {
              enemyId: e.id,
              playerId: e.playerId,
              kind: "attack",
              after: N("executioner-after"),
            },
          }),
        );
      break;
    case "nightcrawler-encounter:executioner-after":
      break;
    case "nightcrawler-encounter:gang": {
      const minion = s.minions.find((p) => p.id === e.id);
      if (
        !minion ||
        trait(minion, "Elite") ||
        !s.sideSchemes.some((p) => p.code === "48033" && !isTextBlank(s, p))
      )
        break;
      const order = playerOrder(s);
      const current = order.findIndex((seat) => seat.id === e.playerId);
      const recipient =
        order.length > 1
          ? order[(Math.max(current, 0) + 1) % order.length].id
          : e.playerId;
      dealActual(s, minion.id, recipient, ports);
      break;
    }
    case "nightcrawler-encounter:off-head": {
      const ids = e.ids as string[];
      const p = ids
        .map((id) => s.minions.find((m) => m.id === id))
        .find(Boolean);
      if (!p) {
        if (!e.activated)
          ports.queue(
            s,
            N("discard-until-minion", { maximum: s.encounter.deck.length }),
          );
        break;
      }
      const playerId = p.engagedWith || s.activePlayerId;
      const token = `nightcrawlerOffHead:${s.nextId++}`;
      const kind =
        seatView(s, playerId).player.form === "hero" ? "attack" : "scheme";
      ports.queue(
        s,
        E(kind === "attack" ? "enemyAttack" : "enemyScheme", {
          id: p.id,
          actorId: playerId,
          activation: {
            enemyId: p.id,
            playerId,
            kind,
            after: N("off-head-record", { token }),
          },
        }),
        N("off-head-check", {
          token,
          ids: ids.filter((id) => id !== p.id),
          activated: e.activated,
        }),
      );
      break;
    }
    case "nightcrawler-encounter:off-head-record":
      seatView(s, s.firstPlayerId).flags[e.token] = !!e.performed;
      break;
    case "nightcrawler-encounter:off-head-check": {
      const flags = seatView(s, s.firstPlayerId).flags;
      const performed = !!flags[e.token];
      delete flags[e.token];
      ports.queue(
        s,
        N("off-head", { ids: e.ids, activated: e.activated || performed }),
      );
      break;
    }
    case "nightcrawler-encounter:discard-until-minion": {
      const p = e.maximum > 0 ? ports.discardEncounterTop(s) : undefined;
      if (!p) break;
      if (card(p).type_code === "minion") {
        const actual = takeEncounter(s, p.id, ports);
        if (actual) ports.queue(s, E("reveal", { piece: actual }));
      } else
        ports.queue(s, N("discard-until-minion", { maximum: e.maximum - 1 }));
      break;
    }
    case "nightcrawler-encounter:shadows": {
      const reserve = s.player.setAside || [];
      const minion = reserve.find((p) => p.code === "48027");
      const scheme = reserve.find((p) => p.code === "48028");
      const pieces = reserve.filter(
        (p) => card(p).set_code === "nightcrawler_nemesis",
      );
      if (!minion && !scheme) {
        ports.queue(s, E("surge", { sourceCode: "01190" }));
        break;
      }
      const reveal: Effect[] = [];
      for (const p of pieces) {
        reserve.splice(reserve.indexOf(p), 1);
        if (p === minion || p === scheme) {
          if (!s.resolving.some((q) => q.id === p.id)) s.resolving.push(p);
          reveal.push(E("reveal", { piece: p }));
        } else s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...reveal,
        ...(!minion ? [E("surge", { sourceCode: "01190" })] : []),
      );
      s.flags.nemesis = true;
      break;
    }
    default:
      throw Error(`Unknown Nightcrawler encounter effect: ${e.type}`);
  }
  return true;
}
