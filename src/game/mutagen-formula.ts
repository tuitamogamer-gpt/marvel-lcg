import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
import { playerOrder } from "./team.js";
import { isTextBlank } from "./card-text.js";
import catalogCards from "../data/catalog-cards.json" with { type: "json" };

const cards = new Map((catalogCards as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const mg = (name: string, args: Record<string, unknown> = {}) =>
  E(`mutagen:${name}`, args);
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const goblin = (p: Piece) =>
  /(?:^|\s)Goblin\./.test(cards.get(p.code)?.traits || "");
const goblinMinion = (p: Piece) =>
  goblin(p) && cards.get(p.code)?.type_code === "minion";
const glider = (p: Piece) => cards.get(p.code)?.name === "Goblin Glider";
const bombs = (p: Piece) => ["02021", "02034"].includes(p.code);
const choice = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });

/** Authored hooks, not an assertion that a host engine has integrated the scenario. */
export const MUTAGEN_FORMULA_SCRIPT_CODES = [
  "02014",
  "02015",
  "02016",
  "02017a",
  "02017b",
  "02018a",
  "02018b",
  "02019",
  "02020",
  "02021",
  "02022",
  "02023",
  "02024",
  "02025",
  "02026",
  "02027",
  "02028",
  "02029",
  "02030",
  "02031",
  "02032",
  "02033",
  "02034",
  "02035",
  "02036",
] as const;

export const MUTAGEN_FORMULA_CONFIG = {
  id: "mutagen_formula",
  name: "Mutagen Formula",
  standardVillains: ["02014", "02015"],
  expertVillains: ["02015", "02016"],
  mainSchemes: ["02017b", "02018b"],
  scenarioSet: "mutagen_formula",
  requiredSets: ["standard"],
  expertSets: ["expert"],
  recommendedModule: "goblin_gimmicks",
  source:
    "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc02_green_goblin_rules_insert.pdf",
} as const;

export interface MutagenEnginePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  /** Native, atomic payment, including generated resources and wild substitution.
   * A cancellation must leave the attachment/boost outcome unchanged. */
  pay(
    s: GameState,
    cost: number,
    requirements: Resource[],
    after: Effect[],
    title: string,
    cancelable: boolean,
  ): void;
  canPay(s: GameState, cost: number, requirements: Resource[]): boolean;
  /** Discard exactly one top card (not draw). Return `emptied` even when its
   * discard immediately resets the deck. An ability stops at that boundary. */
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  /** Move the actual instance from its current encounter zone; put, do not
   * reveal. Resolve engagement/entry abilities, including Quickstrike, normally. */
  putMinion(s: GameState, piece: Piece, playerId: string): void;
  /** Put, do not reveal; initialize printed threat and constant/icon effects. */
  putSideScheme(s: GameState, piece: Piece): void;
  attach(s: GameState, piece: Piece, enemyId: string): void;
  discardPiece(s: GameState, id: string): void;
  /** Retain unique instance and hidden-information/undo guard. Remove from
   * resolving/boost/dealt/discard zones before shuffling, never duplicate it. */
  shuffleIntoEncounter(s: GameState, piece: Piece): void;
  shuffleEncounter(s: GameState): void;
  dealEncounter(s: GameState, playerId: string): void;
  /** `next` cards persist face down until the villain's next activation.
   * `current` appends to the active villain boost queue and is revealed normally. */
  giveBoost(s: GameState, villainId: string, scope: "current" | "next"): void;
  /** Execute the entire native activation, all interrupts/responses and actual
   * outcomes, then queue `after` with performed, damagePlaced, threatPlaced.
   * Modifier is attack/SCH for this activation, not permanent printed stat.
   * omitNormalBoost suppresses ordinary and Hysteria boosts for I See You in
   * alter ego (FFG Alex ruling); boosts already given before this activation remain. */
  activate(s: GameState, request: MutagenActivation): void;
}

export interface MutagenActivation {
  enemyId: string;
  playerId: string;
  kind: "attack" | "scheme";
  modifier: number;
  omitNormalBoost?: boolean;
  after?: Effect;
}

/** Install at RRG setup step 12a, after building the full encounter deck and
 * before drawing player hands. Expert II's reveal is step 12c, after Thralls. */
export function mutagenSetup(): Effect[] {
  return [mg("setup")];
}

export function mutagenVillainRevealed(
  s: GameState,
  villain: Piece = s.villain,
): Effect[] {
  const amount =
    villain.code === "02015" ? 2 : villain.code === "02016" ? 3 : 0;
  return amount
    ? [
        mg("deal-each-player", {
          remaining: playerOrder(s).map((seat) => seat.id),
          amount,
          actorId: s.firstPlayerId,
        }),
      ]
    : [];
}

export function mutagenSchemeValues(s: GameState) {
  if (s.scheme.code === "02017b")
    return {
      baseThreat: 2 * s.playerCount,
      threshold: 7 * s.playerCount,
      escalation: s.playerCount,
    };
  if (s.scheme.code === "02018b")
    return {
      baseThreat: 4 * s.playerCount,
      threshold: 11 * s.playerCount,
      escalation: [s.villain, ...s.minions].filter(goblin).length,
    };
  return null;
}

/** Replace generic main-scheme advancement. Resolve all When Completed effects
 * before flipping; second-stage completion loses immediately. */
export function mutagenMainCompleted(s: GameState): Effect[] | null {
  if (s.scheme.code === "02017b")
    return [
      ...playerOrder(s).map((seat) =>
        mg("main-completed-player", { actorId: seat.id }),
      ),
      mg("advance-main"),
    ];
  if (s.scheme.code === "02018b") return [mg("loss")];
  return null;
}

/** Add once to enemy base ATK. Includes minion attachments as well as villain
 * attachments; a host that already sums printed attachment ATK must omit that
 * part to avoid double counting. Goblin Nation is dynamic, per copy in play. */
export function mutagenAttackModifiers(s: GameState, enemy: Piece) {
  return {
    attachment: s.attachments.filter(
      (a) => a.attachedTo === enemy.id && glider(a),
    ).length,
    goblinNation: goblin(enemy)
      ? s.sideSchemes.filter((p) => p.code === "02027" && !isTextBlank(s, p))
          .length
      : 0,
  };
}

/** Forced Interrupt only when the actual attack/scheme starts (after statuses
 * and replacements); each attached Hysteria adds one boost for this activation. */
export function mutagenAdditionalBoosts(s: GameState, enemyId: string): number {
  const enemy =
    enemyId === s.villain.id
      ? s.villain
      : s.minions.find((p) => p.id === enemyId);
  return cards.get(enemy?.code || "")?.name === "Green Goblin"
    ? s.attachments.filter(
        (a) =>
          a.code === "02020" && a.attachedTo === enemyId && !isTextBlank(s, a),
      ).length
    : 0;
}

export interface MutagenForcedResponse {
  id: string;
  /** Revalidate that this source remains in play immediately before initiation. */
  sourceId?: string;
  title: string;
  effects: Effect[];
}
export interface MutagenAttackResult {
  attacker: Piece;
  /** The player whose character defended, otherwise original target. */
  playerId: string;
  performed: boolean;
  /** Actual damage to that player's identity from this attack, after Tough and
   * prevention, including overkill; ally damage alone does not qualify. */
  identityDamage: number;
}

/** Present all same-window forced responses to the first player's ordering
 * scheduler; do not silently choose between Goblin, Knight and Pumpkin Bombs.
 * Attacker is last-known instance; it must still be the same in-play character.
 * A same-title villain stage replacement remains that character (RRG p47). */
export function mutagenAttackResponses(
  s: GameState,
  result: MutagenAttackResult,
): MutagenForcedResponse[] {
  if (!result.performed) return [];
  const current =
    result.attacker.id === s.villain.id
      ? s.villain
      : s.minions.find((p) => p.id === result.attacker.id);
  if (!current) return [];
  const sameCharacter =
    current.id === s.villain.id
      ? cards.get(current.code)?.name === cards.get(result.attacker.code)?.name
      : current.code === result.attacker.code;
  if (!sameCharacter) return [];
  const responses: MutagenForcedResponse[] = [];
  if (
    ["02014", "02015", "02016"].includes(current.code) &&
    result.identityDamage > 0
  )
    responses.push({
      id: `goblin:${current.id}`,
      sourceId: current.id,
      title: "Green Goblin",
      effects: [
        E("threat", {
          target: "main",
          amount: current.code === "02016" ? 2 : 1,
        }),
      ],
    });
  if (current.code === "02022")
    responses.push({
      id: `knight:${current.id}`,
      sourceId: current.id,
      title: "Goblin Knight",
      effects: [mg("knight", { actorId: result.playerId })],
    });
  if (current.id === s.villain.id)
    for (const p of s.attachments.filter(
      (p) => p.attachedTo === current.id && bombs(p) && !isTextBlank(s, p),
    ))
      responses.push({
        id: p.id,
        sourceId: p.id,
        title: "Pumpkin Bombs",
        effects: [mg("bombs", { id: p.id, actorId: result.playerId })],
      });
  return responses;
}

/** When Defeated is a Forced Interrupt, before leaving play. No ordinary
 * discard/banish may trigger this hook. Ownership must be captured before exit. */
export function mutagenDefeated(s: GameState, piece: Piece): Effect[] | null {
  if (isTextBlank(s, piece))
    return MUTAGEN_FORMULA_SCRIPT_CODES.includes(
      piece.code as (typeof MUTAGEN_FORMULA_SCRIPT_CODES)[number],
    )
      ? []
      : null;
  if (piece.code === "02023")
    return [
      E("damage", {
        target: "hero",
        amount: 1,
        actorId: piece.engagedWith || s.activePlayerId,
        source: "Goblin Soldier",
      }),
    ];
  if (piece.code === "02028")
    return playerOrder(s).map((seat) =>
      mg("overrun-player", { actorId: seat.id }),
    );
  return MUTAGEN_FORMULA_SCRIPT_CODES.includes(
    piece.code as (typeof MUTAGEN_FORMULA_SCRIPT_CODES)[number],
  )
    ? []
    : null;
}

export function mutagenAttachmentActions(s: GameState, piece: Piece): Option[] {
  if (
    s.phase !== "player" ||
    s.player.form !== "hero" ||
    isTextBlank(s, piece) ||
    !s.attachments.some((p) => p.id === piece.id)
  )
    return [];
  const resource: Resource | undefined = glider(piece)
    ? "energy"
    : bombs(piece)
      ? "physical"
      : piece.code === "02020"
        ? "mental"
        : undefined;
  return resource
    ? [
        choice(
          "remove",
          `Spend 2 ${resource} resources · discard ${cards.get(piece.code)?.name}`,
          [mg("remove-cost", { id: piece.id, resource })],
          piece.code,
        ),
      ]
    : [];
}

/** Call after the generic minion/side-scheme reveal entry, or instead of generic
 * attachment/treachery text. Null means this module does not own the card. */
export function mutagenEncounterReveal(
  s: GameState,
  piece: Piece,
): Effect[] | null {
  const actorId = s.activePlayerId;
  switch (piece.code) {
    case "02019":
    case "02033":
      return [mg("glider", { piece })];
    case "02020":
    case "02021":
    case "02034":
      return [mg("attach-villain", { piece })];
    case "02022":
    case "02023":
    case "02024":
    case "02027":
    case "02028":
      return [];
    case "02025":
      return [
        s.player.stunned
          ? E("damage", { target: "hero", amount: 2, source: "Monster" })
          : E("status", { target: "hero", status: "stunned" }),
      ];
    case "02026":
      return [
        E("threat", {
          target: piece.id,
          amount: s.minions.filter(goblinMinion).length,
        }),
      ];
    case "02029":
      return [
        mg("activate", {
          playerId: actorId,
          kind: s.player.form === "hero" ? "attack" : "scheme",
          modifier: s.villain.stage,
        }),
      ];
    case "02030":
      return [
        mg("activate", {
          playerId: actorId,
          kind: "attack",
          modifier: 0,
          omitNormalBoost: s.player.form === "alter",
        }),
      ];
    case "02031":
      return [
        mg("activate", {
          playerId: actorId,
          kind: s.player.form === "hero" ? "attack" : "scheme",
          modifier: 0,
          sourceCode: piece.code,
          overconfidence: true,
        }),
      ];
    case "02032":
      return [mg("wicked-step", { remaining: 2 * s.villain.stage, actorId })];
    case "02035":
      return [mg("intimidation")];
    case "02036":
      return [
        mg("heal", {
          amount: 2 * s.villain.stage,
          surgeIfNone: true,
          sourceCode: piece.code,
        }),
      ];
    default:
      return null;
  }
}

export interface MutagenBoostContext {
  attackerId: string;
  playerId: string;
}
export interface MutagenBoostResult {
  effects: Effect[];
  extraIcons: number;
  /** Skip automatic boost discard/finish when moved into play. */
  retainsCard: boolean;
  /** Delayed effect after activation ends, BEFORE ordinary responses. */
  afterActivation: Effect[];
}

export function mutagenBoost(
  s: GameState,
  piece: Piece,
  context: MutagenBoostContext,
): MutagenBoostResult | null {
  const result: MutagenBoostResult = {
    effects: [],
    extraIcons: 0,
    retainsCard: false,
    afterActivation: [],
  };
  switch (piece.code) {
    case "02022":
    case "02025":
      result.afterActivation = [mg("return-boost", { piece })];
      break;
    case "02023":
    case "02024":
      result.retainsCard = true;
      result.effects = [
        mg("put-minion", { piece, playerId: context.playerId }),
      ];
      break;
    case "02027":
      result.retainsCard = true;
      result.effects = [mg("put-scheme", { piece })];
      break;
    case "02030":
      result.extraIcons = s.minions.some(
        (p) =>
          goblinMinion(p) &&
          (!p.engagedWith || p.engagedWith === context.playerId),
      )
        ? 1
        : 0;
      break;
    case "02035":
      if (context.attackerId === s.villain.id)
        result.effects = [mg("boost", { scope: "current" })];
      break;
    case "02036":
      result.effects = [mg("heal", { amount: 2 })];
      break;
    default:
      return null;
  }
  return result;
}

function discardBatch(
  s: GameState,
  amount: number,
  ports: MutagenEnginePorts,
): Piece[] {
  const discarded: Piece[] = [];
  for (let i = 0; i < amount; i++) {
    const { piece, emptied } = ports.discardTop(s);
    if (piece) discarded.push(piece);
    if (!piece || emptied) break;
  }
  return discarded;
}

export function resolveMutagenEffect(
  s: GameState,
  e: Effect,
  ports: MutagenEnginePorts,
): boolean {
  if (!e.type.startsWith("mutagen:")) return false;
  switch (e.type) {
    case "mutagen:setup": {
      need(
        s.encounter.deck.filter((p) => p.code === "02024").length >=
          playerOrder(s).length,
        "Mutagen Formula setup requires one Goblin Thrall per player.",
      );
      for (const seat of playerOrder(s)) {
        const thrall = s.encounter.deck.find((p) => p.code === "02024");
        need(
          thrall,
          "Mutagen Formula setup requires one Goblin Thrall per player.",
        );
        ports.putMinion(s, thrall!, seat.id);
      }
      ports.shuffleEncounter(s);
      s.scheme = { code: "02017b", index: 0, threat: 2 * s.playerCount };
      ports.queue(s, ...mutagenVillainRevealed(s));
      break;
    }
    case "mutagen:deal":
      for (let i = 0; i < e.amount; i++) ports.dealEncounter(s, e.playerId);
      break;
    case "mutagen:deal-each-player": {
      const remaining = e.remaining.filter((id: string) =>
        s.players.some((seat) => seat.id === id && !seat.eliminated),
      );
      if (!remaining.length) break;
      const next = (id: string) => [
        mg("deal", { playerId: id, amount: e.amount }),
        mg("deal-each-player", {
          remaining: remaining.filter((other: string) => other !== id),
          amount: e.amount,
          actorId: s.firstPlayerId,
        }),
      ];
      if (remaining.length === 1) ports.queue(s, ...next(remaining[0]));
      else
        ports.choose(
          s,
          "Green Goblin · encounter order",
          "The first player chooses which player receives their encounter cards next.",
          remaining.map((id: string) => choice(id, id, next(id))),
        );
      break;
    }
    case "mutagen:main-completed-player": {
      const playerId = e.actorId || s.activePlayerId;
      if (
        !s.minions.some(
          (p) =>
            goblinMinion(p) && (!p.engagedWith || p.engagedWith === playerId),
        )
      ) {
        const first = discardBatch(s, 3, ports).find(goblinMinion);
        if (first) ports.putMinion(s, first, playerId);
      }
      break;
    }
    case "mutagen:advance-main":
      s.scheme = { code: "02018b", index: 1, threat: 4 * s.playerCount };
      break;
    case "mutagen:loss":
      s.phase = "lost";
      s.result = "Green Goblin's mutagen army overruns the city.";
      break;
    case "mutagen:overrun-player":
      for (const p of discardBatch(s, 2, ports).filter(goblinMinion))
        ports.putMinion(s, p, e.actorId || s.activePlayerId);
      break;
    case "mutagen:knight": {
      const p = discardBatch(s, 1, ports)[0];
      if (p && goblinMinion(p))
        ports.putMinion(s, p, e.actorId || s.activePlayerId);
      break;
    }
    case "mutagen:bombs": {
      const p = s.attachments.find((p) => p.id === e.id && bombs(p));
      if (p) {
        ports.discardPiece(s, p.id);
        ports.queue(
          s,
          E("indirect", {
            amount: 2,
            actorId: e.actorId,
            source: "Pumpkin Bombs",
          }),
        );
      }
      break;
    }
    case "mutagen:glider": {
      const eligible = [s.villain, ...s.minions].filter(
        (p) => !s.attachments.some((a) => a.attachedTo === p.id && glider(a)),
      );
      const printedHp = (p: Piece) =>
        (cards.get(p.code)?.health || 0) *
        (cards.get(p.code)?.health_per_hero ? s.playerCount : 1);
      const highest = Math.max(...eligible.map(printedHp));
      const tied = eligible.filter((p) => printedHp(p) === highest);
      if (!tied.length)
        ports.queue(s, E("surge", { sourceCode: e.piece.code }));
      else if (tied.length === 1) ports.attach(s, e.piece, tied[0].id);
      else
        ports.choose(
          s,
          "Goblin Glider",
          "Choose an eligible enemy tied for highest printed hit points.",
          tied.map((p) =>
            choice(
              p.id,
              cards.get(p.code)!.name,
              [
                mg("attach-glider", {
                  piece: e.piece,
                  id: p.id,
                  eligible: tied.map((p) => p.id),
                }),
              ],
              p.code,
            ),
          ),
        );
      break;
    }
    case "mutagen:attach-glider": {
      const enemy = [s.villain, ...s.minions].find((p) => p.id === e.id);
      need(
        enemy &&
          e.eligible.includes(e.id) &&
          !s.attachments.some((a) => a.attachedTo === e.id && glider(a)),
        "Chosen Goblin Glider target is no longer eligible.",
      );
      ports.attach(s, e.piece, e.id);
      break;
    }
    case "mutagen:attach-villain":
      if (
        e.piece.code !== "02020" ||
        cards.get(s.villain.code)?.name === "Green Goblin"
      )
        ports.attach(s, e.piece, s.villain.id);
      break;
    case "mutagen:remove-cost": {
      const p = s.attachments.find((p) => p.id === e.id);
      need(
        p && mutagenAttachmentActions(s, p).length,
        "Attachment's Hero Action is unavailable.",
      );
      const resource = glider(p!)
        ? "energy"
        : bombs(p!)
          ? "physical"
          : "mental";
      need(
        e.resource === resource && ports.canPay(s, 2, [resource, resource]),
        "Spend the two required resources.",
      );
      ports.pay(
        s,
        2,
        [resource, resource],
        [mg("remove-paid", { id: e.id })],
        cards.get(p!.code)!.name,
        true,
      );
      break;
    }
    case "mutagen:remove-paid": {
      const p = s.attachments.find((p) => p.id === e.id);
      need(
        p && mutagenAttachmentActions(s, p).length,
        "Attachment removal is no longer legal.",
      );
      ports.discardPiece(s, e.id);
      break;
    }
    case "mutagen:activate":
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: e.modifier,
        omitNormalBoost: !!e.omitNormalBoost,
        ...(e.overconfidence
          ? {
              after: mg("overconfidence-after", {
                actorId: e.playerId,
                sourceCode: e.sourceCode,
                kind: e.kind,
              }),
            }
          : {}),
      });
      break;
    case "mutagen:overconfidence-after":
      if (
        e.performed &&
        (e.kind === "attack" ? e.damagePlaced : e.threatPlaced) >= 3
      )
        ports.queue(s, E("surge", { sourceCode: e.sourceCode }));
      break;
    case "mutagen:wicked-step": {
      if (e.remaining <= 0) break;
      const { piece, emptied } = ports.discardTop(s);
      if (!piece) break;
      const after = emptied
        ? []
        : [
            mg("wicked-step", {
              remaining: e.remaining - 1,
              actorId: e.actorId,
            }),
          ];
      if (goblinMinion(piece))
        ports.choose(
          s,
          "Wicked Ambitions",
          "Choose for this discarded Goblin minion before discarding the next card.",
          [
            choice("damage", "Take 3 damage", [
              E("damage", {
                target: "hero",
                amount: 3,
                actorId: e.actorId,
                source: "Wicked Ambitions",
              }),
              ...after,
            ]),
            choice(
              "minion",
              `Put ${cards.get(piece.code)!.name} into play engaged with you`,
              [mg("put-minion", { piece, playerId: e.actorId }), ...after],
              piece.code,
            ),
          ],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "mutagen:intimidation":
      ports.choose(
        s,
        "Intimidation",
        "Spend two resources or give the villain a facedown boost card for its next activation.",
        [
          ...(ports.canPay(s, 2, [])
            ? [
                choice("pay", "Spend 2 resources of any type", [
                  mg("intimidation-cost"),
                ]),
              ]
            : []),
          choice("boost", "Give the villain 1 facedown boost card", [
            mg("boost", { scope: "next" }),
          ]),
        ],
      );
      break;
    case "mutagen:intimidation-cost":
      need(ports.canPay(s, 2, []), "Cannot spend two resources.");
      ports.pay(s, 2, [], [], "Intimidation", false);
      break;
    case "mutagen:boost":
      ports.giveBoost(s, s.villain.id, e.scope);
      break;
    case "mutagen:heal": {
      const amount = Math.min(
        Math.max(0, e.amount),
        Math.max(0, s.villain.maxHp - s.villain.hp),
      );
      s.villain.hp += amount;
      if (!amount && e.surgeIfNone)
        ports.queue(s, E("surge", { sourceCode: e.sourceCode }));
      break;
    }
    case "mutagen:put-minion":
      ports.putMinion(s, e.piece, e.playerId);
      break;
    case "mutagen:put-scheme":
      ports.putSideScheme(s, e.piece);
      break;
    case "mutagen:return-boost":
      ports.shuffleIntoEncounter(s, e.piece);
      break;
    default:
      throw Error(`Unregistered Mutagen Formula effect: ${e.type}`);
  }
  return true;
}
