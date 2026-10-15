import catalog from "../data/catalog-cards.json" with { type: "json" };
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mansion:${name}`,
  ...args,
});
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const villainFronts = ["32121a", "32122a", "32123a", "32124a"];
const villainCodes = villainFronts.flatMap((c) => [c, `${c.slice(0, -1)}b`]);
const roomFronts = ["32126a", "32127a", "32128a", "32129a"];
const roomBacks = roomFronts.map((c) => `${c.slice(0, -1)}b`);
const namedTreachery: Record<string, string> = {
  "32132": "Avalanche",
  "32133": "Blob",
  "32134": "Pyro",
  "32135": "Toad",
};

export const MANSION_ATTACK_SET = "mansion_attack";
export const MANSION_ATTACK_SCRIPT_CODES = [
  "32121a",
  "32121b",
  "32122a",
  "32122b",
  "32123a",
  "32123b",
  "32124a",
  "32124b",
  "32125a",
  "32125b",
  "32126a",
  "32126b",
  "32127a",
  "32127b",
  "32128a",
  "32128b",
  "32129a",
  "32129b",
  "32130",
  "32131",
  "32132",
  "32133",
  "32134",
  "32135",
  "32136",
  "32137",
] as const;

/** These arrays own actual set-aside cards. currentMain owns the physical
 * active main scheme; native s.scheme contains only its public counters.
 * The active villain lives solely in native s.villain, never in villainDeck. */
export interface MansionAttackState {
  villainDeck: Piece[];
  mainDeck: Piece[];
  currentMain?: Piece;
  winTarget: number;
  /** Required native villain view has retired; victoryDisplay owns its piece. */
  activeVillainRetired?: boolean;
  /** Native continuation tags of attacks/schemes ended by villain defeat. */
  cancelledActivations?: string[];
  setupIds?: string[];
  handledVillainDefeats: string[];
  handledMainCompletions: string[];
  handledAttackResponses: string[];
}
export type MansionAttackGameState = GameState & {
  mansionAttack?: MansionAttackState;
};
export interface MansionAttackSetupPieces {
  villains: Piece[];
  rooms: Piece[];
  opening: Piece;
  saveSchool: Piece;
}
export interface MansionAttackVillainDefeatReceipt {
  token: string;
  /** Exact physical defeated villain, captured at the actual defeat window. */
  piece: Piece;
}
export interface MansionAttackMainCompletionReceipt {
  token: string;
  schemeCode: string;
}
export interface MansionAttackEnemyAttackReceipt {
  token: string;
  enemyId: string;
  enemyCode: string;
  /** Final target player after any other player defends the attack. */
  playerId: string;
  performed: boolean;
  /** Only actual attack damage (including Overkill) after prevention. Actor
   * ownership is captured at the damage window, even when an ally is defeated. */
  damagedTargets: {
    targetId: string;
    actualDamage: number;
    playerId?: string;
  }[];
}
export interface MansionAttackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Pick<Piece, "code"> & { id?: string }): boolean;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  isEngagedWith(s: GameState, minion: Piece, playerId: string): boolean;
  randomIndex(s: GameState, length: number): number;
  putEnvironment(s: GameState, piece: Piece): void;
  /** Native same-ID reveal; resolve entry toughness before after. */
  revealVillain(s: GameState, piece: Piece, after: Effect[]): void;
  /** Native same-ID A reveal then B reveal with starting threat. currentMain
   * is the physical owner; this port updates its face and native s.scheme. */
  revealMain(s: GameState, piece: Piece, after: Effect[]): void;
  /** Retire the actual piece from its live zone; never copy it. */
  addToVictory(s: GameState, piece: Piece): void;
  /** A defeated villain whose Victory keyword was blanked leaves play into
   * the removed zone, never the shuffled encounter deck. */
  removeDefeatedVillain(s: GameState, piece: Piece): void;
  dealEncounter(s: GameState, playerId: string): void;
  win(s: GameState, reason: string): void;
  lose(s: GameState, reason: string): void;
  discardPiece(s: GameState, id: string): void;
  activateEnemy(
    s: GameState,
    enemyId: string,
    playerId: string,
    kind: "attack" | "scheme",
    sourceId: string,
  ): void;
  /** Search actual encounter deck/discard; choose and REVEAL a same-ID named
   * minion, resolving reveal windows and shuffling through native search. */
  searchAndRevealMinion(
    s: GameState,
    name: string,
    playerId: string,
    after: Effect[],
  ): void;
  additionalBoost(s: GameState): void;
  exhaustIdentity(s: GameState, playerId: string): void;
  stun(s: GameState, targetId: string, sourceId: string): void;
  indirectDamage(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
  ): void;
  discardRandomHand(s: GameState, playerId: string, sourceId: string): void;
  exhaustAlly(s: GameState, id: string): void;
  /** Discard up to count actual player-deck cards, resolving native deck
   * exhaustion. Augment each after effect with printedResourceIcons:number,
   * the sum of printed icons on the cards ACTUALLY discarded by this effect. */
  discardPlayerTop(
    s: GameState,
    playerId: string,
    count: number,
    after: Effect[],
  ): void;
  /** Native optional search of this player's actual deck/discard for an ally,
   * add to their hand, and shuffle their deck. */
  searchPlayerAlly(s: GameState, playerId: string, sourceId: string): void;
  addSideThreat(
    s: GameState,
    id: string,
    amount: number,
    sourceId: string,
  ): void;
}

type TextPorts = Pick<MansionAttackPorts, "isTextBlank">;
const saved = (s: GameState) => (s as MansionAttackGameState).mansionAttack;
const active = (s: GameState) => s.villainId === MANSION_ATTACK_SET;
const firstPlayer = (s: GameState) => playerOrder(s)[0]?.id;
const known = (p: Pick<Piece, "code">) =>
  (MANSION_ATTACK_SCRIPT_CODES as readonly string[]).includes(p.code);
const school = (s: GameState) =>
  s.environments?.find((p) => p.code === "32130");
const mainCount = (s: GameState) =>
  (s.victoryDisplay || []).filter(
    (p) => cards.get(p.code)?.type_code === "main_scheme",
  ).length;
const controlledAllies = (s: GameState, playerId: string) =>
  seatView(s, playerId).player.inPlay.filter(
    (p) =>
      ["ally", "minion"].includes(cards.get(p.code)?.type_code || "") &&
      !p.treatedAsMinion,
  );
const villainCount = (s: GameState) =>
  (s.victoryDisplay || []).filter(
    (p) => cards.get(p.code)?.type_code === "villain",
  ).length;

export function mansionAttackInitialize(s: GameState): MansionAttackState {
  const state = saved(s);
  need(state, "Mansion Attack requires its physical setup cards.");
  state!.handledVillainDefeats ||= [];
  state!.handledMainCompletions ||= [];
  state!.handledAttackResponses ||= [];
  return state!;
}
function shuffled(
  s: GameState,
  pieces: Piece[],
  ports: Pick<MansionAttackPorts, "randomIndex">,
) {
  const result = [...pieces];
  for (let i = result.length - 1; i > 0; i--) {
    const j = ports.randomIndex(s, i + 1);
    need(
      Number.isInteger(j) && j >= 0 && j <= i,
      "Invalid Mansion Attack shuffle result.",
    );
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Every input has already been extracted from its original source zone. */
export function mansionAttackSetup(
  s: GameState,
  pieces: MansionAttackSetupPieces,
  ports: MansionAttackPorts,
  winTarget = s.difficulty === "expert" ? 3 : 2,
): void {
  need(active(s), "Mansion Attack setup requires its native scenario.");
  const all = [
    ...pieces.villains,
    ...pieces.rooms,
    pieces.opening,
    pieces.saveSchool,
  ];
  const ids = all.map((p) => p.id);
  if (saved(s)?.setupIds) {
    need(
      ids.length === saved(s)!.setupIds!.length &&
        ids.every((id) => saved(s)!.setupIds!.includes(id)),
      "Mansion Attack setup already has different physical cards.",
    );
    return;
  }
  need(
    new Set(ids).size === 10,
    "Mansion Attack setup requires ten distinct original pieces.",
  );
  need(
    pieces.villains.length === 4 &&
      villainFronts.every((c) =>
        pieces.villains.some(
          (p) => p.code === c || p.code === `${c.slice(0, -1)}b`,
        ),
      ),
    "Mansion Attack requires all four original double-sided villains.",
  );
  need(
    pieces.rooms.length === 4 &&
      roomFronts.every((c) => pieces.rooms.some((p) => p.code === c)),
    "Mansion Attack requires all four original room fronts.",
  );
  need(
    pieces.opening.code === "32125a" && pieces.saveSchool.code === "32130",
    "Mansion Attack requires its original opening scheme and Save the School.",
  );
  need(
    Number.isInteger(winTarget) && winTarget >= 1 && winTarget <= 4,
    "Mansion Attack's victory target must be from 1 to 4 villains.",
  );
  for (const p of pieces.villains)
    p.code = `${p.code.slice(0, -1)}${s.difficulty === "expert" ? "b" : "a"}`;
  const state: MansionAttackState = {
    villainDeck: shuffled(s, pieces.villains, ports),
    mainDeck: shuffled(s, pieces.rooms, ports),
    currentMain: pieces.opening,
    winTarget,
    setupIds: ids,
    handledVillainDefeats: [],
    handledMainCompletions: [],
    handledAttackResponses: [],
  };
  (s as MansionAttackGameState).mansionAttack = state;
  ports.putEnvironment(s, pieces.saveSchool);
  const villain = state.villainDeck.shift()!;
  ports.revealVillain(s, villain, [
    M("setup-main", { actorId: firstPlayer(s) }),
  ]);
}

export function mansionAttackMainThreatLimit(s: GameState): number | undefined {
  return roomBacks.includes(s.scheme.code)
    ? 7 * s.playerCount
    : s.scheme.code === "32125b"
      ? 0
      : undefined;
}
export function mansionAttackSideSchemeBaseThreat(
  _s: GameState,
  p: Pick<Piece, "code">,
): number | undefined {
  return p.code === "32136" ? 2 : p.code === "32137" ? 0 : undefined;
}
/** Continuous room rules apply only while the actual room's text is active.
 * The host calls this for actual characters (including identities). Toughness
 * is an entry keyword: changing rooms never retroactively gives tough. */
export function mansionAttackModifiers(
  s: GameState,
  p:
    (Pick<Piece, "code"> & { id?: string; treatedAsMinion?: boolean }) | string,
  ports: TextPorts,
) {
  const live =
    active(s) &&
    roomBacks.includes(s.scheme.code) &&
    !ports.isTextBlank(s, {
      code: s.scheme.code,
      id: saved(s)?.currentMain?.id || "main",
    });
  const type =
    typeof p === "string"
      ? p === "hero" || p.startsWith("hero:")
        ? "hero"
        : undefined
      : p.treatedAsMinion
        ? "minion"
        : cards.get(p.code)?.type_code;
  return {
    steady: !!live && s.scheme.code === "32126b",
    retaliate: live && s.scheme.code === "32127b" ? 1 : 0,
    toughness:
      !!live &&
      s.scheme.code === "32128b" &&
      ["ally", "minion"].includes(type || ""),
    attack: live && s.scheme.code === "32129b" ? 1 : 0,
  };
}

export function mansionAttackReveal(
  s: GameState,
  p: Piece,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  if (ports.isTextBlank(s, p)) return [];
  const actorId = s.activePlayerId;
  if (p.code === "32125b")
    return [M("opening", { sourceId: p.id, actorId: firstPlayer(s) })];
  if (p.code === "32131")
    return [M("beatdown", { sourceId: p.id, playerId: actorId, actorId })];
  if (namedTreachery[p.code])
    return [
      M("named-activation", {
        sourceId: p.id,
        name: namedTreachery[p.code],
        playerId: actorId,
        actorId,
      }),
    ];
  if (p.code === "32137") return [M("siege", { sourceId: p.id, actorId })];
  return [];
}
export function mansionAttackBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  return namedTreachery[p.code]
    ? [
        M("named-boost", {
          name: namedTreachery[p.code],
          actorId: s.activePlayerId,
        }),
      ]
    : [];
}
export function mansionAttackSideSchemeDefeated(
  _s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts,
): Effect[] | null {
  if (!known(p)) return null;
  return p.code === "32136" && !ports.isTextBlank(_s, p)
    ? [M("students", { sourceId: p.id, playerId, actorId: playerId })]
    : [];
}
export function mansionAttackMainCompleted(
  s: GameState,
  receipt: MansionAttackMainCompletionReceipt,
  ports: TextPorts,
): Effect[] {
  if (
    !active(s) ||
    !receipt.token ||
    receipt.schemeCode !== s.scheme.code ||
    !roomBacks.includes(receipt.schemeCode) ||
    ports.isTextBlank(s, {
      code: s.scheme.code,
      id: saved(s)?.currentMain?.id || "main",
    }) ||
    saved(s)?.handledMainCompletions.includes(receipt.token)
  )
    return [];
  return [
    M("complete-main", {
      receipt,
      actorId: firstPlayer(s),
      mandatory: true,
      forced: true,
    }),
  ];
}
/** Alternate printed win/loss conditions remain active independently of text
 * blanking. Triggered dealing, reveal and main progression are ordinary text. */
export function mansionAttackCheckOutcome(
  s: GameState,
  ports: Pick<MansionAttackPorts, "win" | "lose">,
): boolean {
  if (!active(s) || !saved(s)) return false;
  if (s.phase === "won" || s.phase === "lost") return true;
  if (mainCount(s) >= 3) {
    ports.lose(s, "Three main schemes are in the victory display.");
    return true;
  }
  if (villainCount(s) >= saved(s)!.winTarget) {
    ports.win(
      s,
      "The required Brotherhood villains are in the victory display.",
    );
    return true;
  }
  return false;
}
export function mansionAttackVillainDefeated(
  s: GameState,
  receipt: MansionAttackVillainDefeatReceipt,
  ports: TextPorts,
): Effect[] {
  const env = school(s);
  if (
    !active(s) ||
    !receipt.token ||
    !villainCodes.includes(receipt.piece.code) ||
    receipt.piece.id !== s.villain.id ||
    saved(s)?.handledVillainDefeats.includes(receipt.token)
  )
    return [];
  return [
    M("villain-defeated", {
      receipt,
      sourceId: env?.id,
      victory: !ports.isTextBlank(s, receipt.piece),
      progress: !!env && !ports.isTextBlank(s, env),
      actorId: firstPlayer(s),
      mandatory: true,
      forced: true,
    }),
  ];
}
export function mansionAttackAfterEnemyAttack(
  s: GameState,
  receipt: MansionAttackEnemyAttackReceipt,
  ports: TextPorts,
): Effect[] {
  if (
    !active(s) ||
    !receipt.token ||
    !receipt.performed ||
    saved(s)?.activeVillainRetired ||
    s.villain.pendingDefeat ||
    !villainCodes.includes(receipt.enemyCode) ||
    receipt.enemyId !== s.villain.id ||
    receipt.enemyCode !== s.villain.code ||
    ports.isTextBlank(s, s.villain) ||
    saved(s)?.handledAttackResponses.includes(receipt.token)
  )
    return [];
  const name = cards.get(receipt.enemyCode)?.name;
  if (
    name === "Blob" &&
    !receipt.damagedTargets.some((t) => t.actualDamage > 0)
  )
    return [];
  if (
    name === "Toad" &&
    !receipt.damagedTargets.some(
      (t) => t.actualDamage > 0 && t.playerId === receipt.playerId,
    )
  )
    return [];
  return [
    M("attack-response", {
      receipt,
      name,
      actorId: receipt.playerId,
      mandatory: true,
      forced: true,
    }),
  ];
}

export function resolveMansionAttackEffect(
  s: GameState,
  e: Effect,
  ports: MansionAttackPorts,
): boolean {
  if (!e.type.startsWith("mansion:")) return false;
  switch (e.type) {
    case "mansion:setup-main": {
      const p = mansionAttackInitialize(s).currentMain;
      if (p) ports.revealMain(s, p, []);
      break;
    }
    case "mansion:opening":
      for (const player of playerOrder(s)) ports.dealEncounter(s, player.id);
      ports.queue(
        s,
        M("advance-main", { sourceId: e.sourceId, actorId: firstPlayer(s) }),
      );
      break;
    case "mansion:complete-main": {
      const receipt = e.receipt as MansionAttackMainCompletionReceipt;
      const state = mansionAttackInitialize(s);
      if (state.handledMainCompletions.includes(receipt.token)) break;
      state.handledMainCompletions.push(receipt.token);
      ports.queue(s, M("advance-main", { actorId: firstPlayer(s) }));
      break;
    }
    case "mansion:advance-main": {
      const state = mansionAttackInitialize(s);
      const previous = state.currentMain;
      if (previous) {
        delete state.currentMain;
        ports.addToVictory(s, previous);
      }
      if (mansionAttackCheckOutcome(s, ports)) break;
      const next = state.mainDeck.shift();
      need(next, "Mansion Attack has no next physical main scheme.");
      state.currentMain = next;
      ports.revealMain(s, next!, []);
      break;
    }
    case "mansion:villain-defeated": {
      const receipt = e.receipt as MansionAttackVillainDefeatReceipt;
      const state = mansionAttackInitialize(s);
      if (state.handledVillainDefeats.includes(receipt.token)) break;
      state.handledVillainDefeats.push(receipt.token);
      if (e.victory !== false) ports.addToVictory(s, receipt.piece);
      else ports.removeDefeatedVillain(s, receipt.piece);
      if (!mansionAttackCheckOutcome(s, ports) && e.progress !== false) {
        for (const player of playerOrder(s)) ports.dealEncounter(s, player.id);
        ports.queue(
          s,
          M("next-villain", { sourceId: e.sourceId, actorId: firstPlayer(s) }),
        );
      }
      break;
    }
    case "mansion:next-villain": {
      const next = mansionAttackInitialize(s).villainDeck.shift();
      need(next, "Mansion Attack has no next physical villain.");
      ports.revealVillain(s, next!, [
        M("matching-minions", {
          sourceId: e.sourceId,
          actorId: firstPlayer(s),
        }),
      ]);
      break;
    }
    case "mansion:matching-minions": {
      const name = cards.get(s.villain.code)?.name;
      const matches = s.minions.filter((p) => cards.get(p.code)?.name === name);
      ports.queue(
        s,
        ...playerOrder(s).flatMap((player) =>
          matches
            .filter((p) => ports.isEngagedWith(s, p, player.id))
            .map((p) =>
              M("replace-minion", {
                id: p.id,
                playerId: player.id,
                sourceId: e.sourceId,
                actorId: player.id,
              }),
            ),
        ),
      );
      break;
    }
    case "mansion:replace-minion": {
      if (
        !s.minions.some(
          (p) =>
            p.id === e.id &&
            cards.get(p.code)?.name === cards.get(s.villain.code)?.name,
        )
      )
        break;
      ports.discardPiece(s, e.id);
      const seat = s.players.find((p) => p.id === e.playerId && !p.eliminated);
      if (seat)
        ports.activateEnemy(
          s,
          s.villain.id,
          seat.id,
          seatView(s, seat).player.form === "hero" ? "attack" : "scheme",
          e.sourceId,
        );
      break;
    }
    case "mansion:named-activation": {
      const enemy = [s.villain, ...s.minions].find(
        (p) => cards.get(p.code)?.name === e.name,
      );
      const seat = s.players.find((p) => p.id === e.playerId && !p.eliminated);
      if (!seat) break;
      if (enemy)
        ports.activateEnemy(
          s,
          enemy.id,
          seat.id,
          seatView(s, seat).player.form === "hero" ? "attack" : "scheme",
          e.sourceId,
        );
      else ports.searchAndRevealMinion(s, e.name, e.playerId, []);
      break;
    }
    case "mansion:named-boost":
      if (cards.get(s.villain.code)?.name === e.name) ports.additionalBoost(s);
      break;
    case "mansion:beatdown": {
      const names = new Set(
        [s.villain, ...s.minions].map((p) => cards.get(p.code)?.name),
      );
      const effects: Effect[] = [];
      for (const name of ["Avalanche", "Blob", "Pyro", "Toad"])
        if (names.has(name))
          effects.push(
            M("beatdown-enemy", { ...e, type: "mansion:beatdown-enemy", name }),
          );
      ports.queue(s, ...effects);
      break;
    }
    case "mansion:beatdown-enemy":
      if (e.name === "Avalanche") ports.exhaustIdentity(s, e.playerId);
      if (e.name === "Blob") ports.stun(s, `hero:${e.playerId}`, e.sourceId);
      if (e.name === "Pyro") ports.indirectDamage(s, e.playerId, 2, e.sourceId);
      if (e.name === "Toad") ports.discardRandomHand(s, e.playerId, e.sourceId);
      break;
    case "mansion:siege": {
      const ids = [
        s.villain.id,
        ...s.minions.map((p) => p.id),
        ...playerOrder(s).flatMap((p) => [
          `hero:${p.id}`,
          ...controlledAllies(s, p.id).map((a) => a.id),
        ]),
      ];
      const count = ids.filter((id) =>
        ports.hasTrait(s, id, "Brotherhood of Mutants"),
      ).length;
      ports.addSideThreat(s, e.sourceId, 3 * count, e.sourceId);
      break;
    }
    case "mansion:students":
      ports.searchPlayerAlly(s, e.playerId, e.sourceId);
      break;
    case "mansion:attack-response": {
      const receipt = e.receipt as MansionAttackEnemyAttackReceipt;
      const state = mansionAttackInitialize(s);
      if (
        state.handledAttackResponses.includes(receipt.token) ||
        state.activeVillainRetired ||
        s.villain.pendingDefeat ||
        s.villain.id !== receipt.enemyId ||
        s.villain.code !== receipt.enemyCode ||
        ports.isTextBlank(s, s.villain)
      )
        break;
      state.handledAttackResponses.push(receipt.token);
      if (e.name === "Avalanche") {
        const allies = controlledAllies(s, receipt.playerId).filter(
          (p) => !p.exhausted,
        );
        if (allies.length === 1) ports.exhaustAlly(s, allies[0].id);
        else if (allies.length > 1)
          ports.choose(
            s,
            "Avalanche",
            "Exhaust an ally you control.",
            allies.map((p) => ({
              id: p.id,
              label: cards.get(p.code)?.name || p.code,
              image: p.code,
              effects: [
                M("exhaust-ally", {
                  id: p.id,
                  playerId: receipt.playerId,
                  actorId: receipt.playerId,
                }),
              ],
            })),
          );
      }
      if (e.name === "Blob")
        for (const targetId of new Set(
          receipt.damagedTargets
            .filter((t) => t.actualDamage > 0)
            .map((t) => t.targetId),
        ))
          ports.stun(s, targetId, receipt.enemyId);
      if (e.name === "Pyro")
        ports.discardPlayerTop(s, receipt.playerId, 2, [
          M("pyro-indirect", {
            sourceId: receipt.enemyId,
            playerId: receipt.playerId,
            actorId: receipt.playerId,
          }),
        ]);
      if (e.name === "Toad")
        ports.discardRandomHand(s, receipt.playerId, receipt.enemyId);
      break;
    }
    case "mansion:exhaust-ally": {
      const p = controlledAllies(s, e.playerId).find(
        (p) => p.id === e.id && !p.exhausted,
      );
      if (p) ports.exhaustAlly(s, p.id);
      break;
    }
    case "mansion:pyro-indirect":
      if (Number(e.printedResourceIcons) > 0)
        ports.indirectDamage(
          s,
          e.playerId,
          Number(e.printedResourceIcons),
          e.sourceId,
        );
      break;
  }
  return true;
}
