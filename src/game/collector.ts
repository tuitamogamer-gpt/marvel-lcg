import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

/** The Galaxy's Most Wanted: Infiltrate the Museum (Collector), its required
 * Galactic Artifacts set and the Menagerie Medley modular set. Caught Off
 * Guard (16079) is an exact Core reprint and stays a Core alias. */
export const COLLECTOR_SCENARIO_CODES = [
  "16070",
  "16071",
  "16072",
  "16073a",
  "16073b",
  "16074",
  "16075",
  "16076",
  "16077",
  "16078",
] as const;
export const GALACTIC_ARTIFACTS_CODES = [
  "16122",
  "16123",
  "16124",
  "16125",
  "16126",
  "16127",
  "16128",
  "16129",
  "16130",
] as const;
export const MENAGERIE_MEDLEY_CODES = ["16135", "16136", "16137"] as const;
export const COLLECTOR_SCRIPT_CODES = [
  ...COLLECTOR_SCENARIO_CODES,
  ...GALACTIC_ARTIFACTS_CODES,
  ...MENAGERIE_MEDLEY_CODES,
] as const;
/** Galactic Artifacts side schemes have Victory 0. */
export const COLLECTOR_VICTORY_SCHEMES = ["16127", "16128", "16129", "16130"];
const COLLECTORS = ["16070", "16071", "16072"];
const BIOGRAM = "16074";

export interface CollectorState {
  currentMain: Piece;
  villainDeck: Piece[];
  /** Faceup cards (player or encounter) kept by the Collector. */
  collection: Piece[];
}

const definitions = new Map(catalog.map((c) => [c.code, c]));
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const C = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `collector:${type}`,
  ...args,
});
const known = (p: Piece) =>
  (COLLECTOR_SCRIPT_CODES as readonly string[]).includes(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);

export interface CollectorPorts extends MutagenEnginePorts {
  reveal(s: GameState, p: Piece, playerId: string): void;
  revealHidden(s: GameState): void;
  /** Move an actual card in play into The Collection (not a discard). */
  collectFromPlay(s: GameState, id: string): void;
  /** Remove and return the top card of a player's deck, if any. */
  takeTop(s: GameState, playerId: string): Piece | undefined;
  discardFromHand(s: GameState, id: string): void;
  /** Player cards a player controls in play that can leave play. */
  controlledCards(s: GameState, playerId: string): Piece[];
  enemyStat(s: GameState, p: Piece, stat: "attack" | "scheme"): number;
  canPlayWithDiscount(s: GameState, p: Piece, discount: number): boolean;
  /** A card leaving The Collection goes to its owner's discard pile. */
  returnFromCollection(s: GameState, p: Piece): void;
}

/** Collector's Forced Interrupt replaces discards from play while he is in play. */
export function collectorActive(s: GameState) {
  return (
    !!s.collector &&
    COLLECTORS.includes(s.villain.code) &&
    !isTextBlank(s, s.villain)
  );
}
export function collectorLimit(s: GameState) {
  return 5 * s.playerCount;
}
/** The Grand Collection (1B) loses with 5 cards per player in The Collection. */
export function collectorLost(s: GameState) {
  return (
    !!s.collector &&
    s.scheme.code === "16073b" &&
    !isTextBlank(s, s.collector.currentMain) &&
    s.collector.collection.length >= collectorLimit(s)
  );
}
/** Put an actual card that would be discarded from play into The Collection. */
export function collectorCollect(s: GameState, p: Piece): Effect[] {
  s.collector!.collection.push(p);
  return s.villain.code === "16072" && collectorActive(s)
    ? [{ type: "threat", target: "main", amount: 1 }]
    : [];
}
export function collectorBiogram(s: GameState): Piece | undefined {
  if (!s.collector || !COLLECTORS.includes(s.villain.code)) return;
  return s.attachments.find(
    (p) =>
      p.code === BIOGRAM && p.attachedTo === s.villain.id && !isTextBlank(s, p),
  );
}
/** Starshark's attacks deal indirect damage. */
export function collectorIndirectAttack(s: GameState, p: Piece) {
  return p.code === "16137" && !isTextBlank(s, p);
}
/** Obedience Potion: the attached identity gets -1 THW, -1 ATK and -1 DEF. */
export function collectorIdentityStats(s: GameState) {
  const potions = s.attachments.filter(
    (p) =>
      p.code === "16123" &&
      p.attachedTo === `hero:${s.activePlayerId}` &&
      !isTextBlank(s, p),
  ).length;
  return { attack: -potions, thwart: -potions, defense: -potions };
}

export function collectorSetup(s: GameState): Effect[] {
  return playerOrder(s).map((seat) =>
    C("top", { playerId: seat.id, actorId: seat.id }),
  );
}

export function collectorReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (p.code === BIOGRAM) return [C("attach", { piece: p, mode: "villain" })];
  if (p.code === "16122") return [C("attach", { piece: p, mode: "low-atk" })];
  if (p.code === "16124") return [C("attach", { piece: p, mode: "high-sch" })];
  if (p.code === "16126") return [C("attach", { piece: p, mode: "low-sch" })];
  if (p.code === "16123" || p.code === "16125")
    return [
      C("attach", { piece: p, mode: "identity", playerId: s.activePlayerId }),
    ];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case "16071":
      return playerOrder(s).map((seat) =>
        C("top-or-damage", { playerId: seat.id, actorId: seat.id }),
      );
    case "16072":
      return [
        ...playerOrder(s).map((seat) =>
          C("top", { playerId: seat.id, actorId: seat.id }),
        ),
        C("threat-per-card"),
      ];
    case "16076":
      return [C("box", { id: p.id, playerId: s.activePlayerId })];
    case "16077":
      return [C("cosmos", { playerId: s.activePlayerId })];
    case "16078":
      return [
        C("stay", {
          hero: s.player.form === "hero",
          playerId: s.activePlayerId,
        }),
      ];
    case "16135":
      return [C("ghost", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

export function collectorBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  switch (p.code) {
    case BIOGRAM:
      return [C("biogram-boost", { id: p.id })];
    case "16076":
      return s.collector && s.collector.collection.length <= 3 * s.playerCount
        ? [C("top", { playerId: s.activePlayerId })]
        : [];
    case "16135":
      return [C("ghost-enter", { id: p.id, playerId: s.activePlayerId })];
    case "16137":
      return [C("starshark", { playerId: s.activePlayerId })];
    default:
      return [];
  }
}

/** Galactic Artifacts side schemes: rewards for the player who defeated them. */
export function collectorSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports?: Pick<CollectorPorts, "canPlayWithDiscount">,
): Effect[] {
  if (isTextBlank(s, p) || !alive(s, playerId)) return [];
  const optional = (text: string, effects: Effect[]): Effect[] => [
    {
      type: "optional",
      actorId: playerId,
      title: name(p),
      text,
      effects,
    },
  ];
  switch (p.code) {
    case "16127":
      return optional("Ready your identity?", [
        { type: "ready", target: "hero" },
      ]);
    case "16128":
      return optional("Heal 4 damage from your identity?", [
        { type: "heal", target: "hero", amount: 4 },
      ]);
    case "16129":
      return optional("Draw 2 cards?", [{ type: "draw", amount: 2 }]);
    case "16130": {
      const view = seatView(s, playerId);
      const playable = ports
        ? view.player.hand.filter((c) => ports.canPlayWithDiscount(view, c, 3))
        : [];
      return playable.length
        ? [C("crystal-ball", { playerId, actorId: playerId })]
        : [];
    }
    default:
      return [];
  }
}

export function collectorTurnBegan(s: GameState, playerId: string): Effect[] {
  return s.attachments
    .filter(
      (p) =>
        p.code === "16125" &&
        p.attachedTo === `hero:${playerId}` &&
        !isTextBlank(s, p),
    )
    .map((p) => C("poison", { id: p.id, playerId, actorId: playerId }));
}

/** Hero Actions on artifacts and Biogram-free attachments; the main scheme's
 * Hero Action discards a card from The Collection. */
export function collectorActions(
  s: GameState,
  p: Piece,
  ports?: Pick<CollectorPorts, "canPay">,
): Option[] {
  if (!known(p) || isTextBlank(s, p) || s.player.form !== "hero") return [];
  const attached = s.attachments.some((a) => a.id === p.id);
  const pay = (cost: number, requirements: string[]) =>
    !ports || ports.canPay(s, cost, requirements as never);
  const discard = (
    label: string,
    cost: number,
    requirements: string[],
    extra: Effect[] = [],
  ) =>
    pay(cost, requirements)
      ? [
          {
            id: "remove",
            label,
            image: p.code,
            effects: [
              C("artifact-pay", {
                id: p.id,
                cost,
                requirements,
                extra,
                title: name(p),
              }),
            ],
          },
        ]
      : [];
  switch (p.code) {
    case "16122":
      return attached
        ? discard("Spend physical ×3 · discard Cloak of Hercules", 3, [
            "physical",
            "physical",
            "physical",
          ])
        : [];
    case "16123":
      return attached && s.player.hp > 1
        ? discard(
            "Take 1 damage and spend mental ×2 · discard Obedience Potion",
            2,
            ["mental", "mental"],
            [
              {
                type: "damage",
                target: "hero",
                amount: 1,
                source: "encounter",
              },
            ],
          )
        : [];
    case "16124":
      return attached
        ? discard(
            "Place 2 threat and spend 2 resources · discard The Beyonder's Blazer",
            2,
            [],
            [{ type: "threat", target: "main", amount: 2 }],
          )
        : [];
    case "16125":
      return attached
        ? discard("Spend energy + mental + physical · discard The Poison", 3, [
            "energy",
            "mental",
            "physical",
          ])
        : [];
    case "16126":
      return attached
        ? discard("Spend energy ×3 · discard Vandarian Power Stone", 3, [
            "energy",
            "energy",
            "energy",
          ])
        : [];
    case "16073b": {
      if (
        !s.collector ||
        s.collector.currentMain.id !== p.id ||
        !s.collector.collection.length ||
        s.flags[`collectorRelease:${s.activePlayerId}`] === s.round
      )
        return [];
      const options: Option[] = [];
      if (!s.player.exhausted)
        options.push({
          id: "release-exhaust",
          label: "Exhaust your hero · discard 1 card from The Collection",
          image: p.code,
          effects: [C("release-exhaust")],
        });
      if (pay(2, []))
        options.push({
          id: "release-pay",
          label: "Spend 2 resources · discard 1 card from The Collection",
          image: p.code,
          effects: [C("release-pay")],
        });
      return options;
    }
    default:
      return [];
  }
}

function highest(cards: Piece[]) {
  const cost = (p: Piece) => {
    const c = definitions.get(p.code)?.cost;
    return c === undefined || c === null ? -1 : Math.max(0, c);
  };
  const top = Math.max(...cards.map(cost));
  return { top, cards: cards.filter((p) => cost(p) === top), cost };
}

export function resolveCollectorEffect(
  s: GameState,
  e: Effect,
  ports: CollectorPorts,
): boolean {
  if (!e.type.startsWith("collector:")) return false;
  const collection = s.collector?.collection;
  switch (e.type) {
    case "collector:top": {
      if (!collection || !alive(s, e.playerId)) break;
      const p = ports.takeTop(s, e.playerId);
      if (p) collection.push(p);
      break;
    }
    case "collector:top-or-damage": {
      if (!collection || !alive(s, e.playerId)) break;
      ports.choose(
        s,
        "Collector",
        "Put the top card of your deck into The Collection, or take 3 damage.",
        [
          {
            id: "collect",
            label: "Put the top card of your deck into The Collection",
            effects: [C("top", { playerId: e.playerId })],
          },
          {
            id: "damage",
            label: "Take 3 damage",
            effects: [
              {
                type: "damage",
                target: "hero",
                amount: 3,
                source: "encounter",
              },
            ],
          },
        ],
      );
      break;
    }
    case "collector:threat-per-card":
      if (collection?.length)
        ports.queue(s, {
          type: "threat",
          target: "main",
          amount: collection.length,
        });
      break;
    case "collector:attach": {
      const p = e.piece as Piece;
      if (e.mode === "villain") {
        if (COLLECTORS.includes(s.villain.code))
          ports.attach(s, p, s.villain.id);
        break;
      }
      if (e.mode === "identity") {
        if (alive(s, e.playerId)) ports.attach(s, p, `hero:${e.playerId}`);
        break;
      }
      const stat = e.mode === "low-atk" ? "attack" : "scheme";
      const enemies = [s.villain, ...s.minions];
      const value = (q: Piece) => ports.enemyStat(s, q, stat);
      const target =
        e.mode === "high-sch"
          ? Math.max(...enemies.map(value))
          : Math.min(...enemies.map(value));
      const tied = enemies.filter((q) => value(q) === target);
      if (tied.length === 1) ports.attach(s, p, tied[0].id);
      else
        ports.choose(
          s,
          name(p),
          `Choose the enemy tied for the ${e.mode === "high-sch" ? "highest SCH" : e.mode === "low-sch" ? "lowest SCH" : "lowest ATK"}.`,
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [C("attach-to", { piece: p, id: q.id })],
          })),
        );
      break;
    }
    case "collector:attach-to":
      if ([s.villain, ...s.minions].some((q) => q.id === e.id))
        ports.attach(s, e.piece, e.id);
      break;
    case "collector:box": {
      if (!alive(s, e.playerId)) break;
      const controlled = ports.controlledCards(s, e.playerId);
      if (!controlled.length) {
        ports.queue(s, { type: "surge", sourceId: e.id, sourceCode: "16076" });
        break;
      }
      const lowest = Math.min(
        ...controlled.map((p) =>
          Math.max(0, definitions.get(p.code)?.cost ?? 0),
        ),
      );
      const tied = controlled.filter(
        (p) => Math.max(0, definitions.get(p.code)?.cost ?? 0) === lowest,
      );
      if (tied.length === 1) ports.collectFromPlay(s, tied[0].id);
      else
        ports.choose(
          s,
          "Inconspicuous Box",
          "Put the lowest cost card you control into The Collection.",
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: [C("collect-from-play", { id: p.id })],
          })),
        );
      break;
    }
    case "collector:collect-from-play":
      ports.collectFromPlay(s, e.id);
      break;
    case "collector:cosmos": {
      if (!alive(s, e.playerId) || !s.player.hand.length) break;
      const { cards, cost } = highest(s.player.hand);
      const options: Option[] = [];
      for (const p of cards) {
        options.push({
          id: `collect:${p.id}`,
          label: `Put ${name(p)} into The Collection`,
          image: p.code,
          effects: [C("hand-to-collection", { id: p.id })],
        });
        options.push({
          id: `discard:${p.id}`,
          label: `Discard ${name(p)} · place ${Math.max(0, cost(p))} threat`,
          image: p.code,
          effects: [
            C("hand-discard", { id: p.id }),
            ...(cost(p) > 0
              ? [{ type: "threat", target: "main", amount: cost(p) }]
              : []),
          ],
        });
      }
      ports.choose(
        s,
        "View the Cosmos",
        "Choose one for your highest cost card.",
        options,
      );
      break;
    }
    case "collector:hand-to-collection": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      if (i >= 0 && collection) collection.push(s.player.hand.splice(i, 1)[0]);
      break;
    }
    case "collector:hand-discard":
      if (s.player.hand.some((p) => p.id === e.id))
        ports.discardFromHand(s, e.id);
      break;
    case "collector:stay": {
      if (!alive(s, e.playerId)) break;
      if (e.hero) {
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 1,
          after: C("stay-after", { playerId: e.playerId }),
        });
        break;
      }
      const options: Option[] = [];
      if (ports.canPay(s, 2, ["physical", "physical"]))
        options.push({
          id: "pay",
          label: "Spend physical + physical",
          effects: [
            C("pay", {
              cost: 2,
              requirements: ["physical", "physical"],
              title: "Stay Awhile",
            }),
          ],
        });
      options.push({
        id: "collect",
        label: "Put the top card of your deck into The Collection",
        effects: [C("top", { playerId: e.playerId })],
      });
      ports.choose(s, "Stay Awhile", "Choose one.", options);
      break;
    }
    case "collector:stay-after":
      if (Number(e.identityDamage ?? e.damagePlaced ?? 0) > 0)
        ports.queue(s, C("top", { playerId: e.playerId }));
      break;
    case "collector:pay":
      ports.pay(s, e.cost, e.requirements, [], e.title, false);
      break;
    case "collector:biogram-boost": {
      const activation = s.attack || s.scheming;
      if (!activation) break;
      (activation.retainedBoostIds ||= []).push(e.id);
      (activation.afterActivation ||= []).push(C("reveal", { id: e.id }));
      break;
    }
    case "collector:reveal": {
      const p = [...s.encounter.discard, ...s.resolving].find(
        (q) => q.id === e.id,
      );
      if (p) ports.reveal(s, p, s.activePlayerId);
      break;
    }
    case "collector:ghost":
      if (!alive(s, e.playerId)) break;
      if (s.player.confused)
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: 1,
          source: "encounter",
        });
      ports.queue(s, { type: "status", target: "hero", status: "confused" });
      break;
    case "collector:ghost-enter": {
      const p = [...s.encounter.discard, ...s.resolving].find(
        (q) => q.id === e.id,
      );
      const activation = s.attack || s.scheming;
      if (activation) (activation.retainedBoostIds ||= []).push(e.id);
      if (p && alive(s, e.playerId)) ports.putMinion(s, p, e.playerId);
      break;
    }
    case "collector:starshark":
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        { type: "damage", target: "hero", amount: 1, source: "encounter" },
        ...s.player.inPlay
          .filter((p) => definitions.get(p.code)?.type_code === "ally")
          .map((p) => ({
            type: "damage",
            target: p.id,
            amount: 1,
            source: "encounter",
          })),
      );
      break;
    case "collector:poison": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      p.counters++;
      ports.queue(s, {
        type: "damage",
        target: "hero",
        amount: p.counters,
        source: "encounter",
      });
      break;
    }
    case "collector:artifact-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || !collectorActions(s, p).length)
        throw Error(
          "This Hero Action needs hero form and the attached artifact.",
        );
      ports.pay(
        s,
        e.cost,
        e.requirements,
        [...(e.extra || []), { type: "discardPiece", id: p.id }],
        e.title,
        true,
      );
      break;
    }
    case "collector:release-exhaust":
      if (s.player.exhausted || !collection?.length)
        throw Error("Your ready hero must exhaust for this Hero Action.");
      s.flags[`collectorRelease:${s.activePlayerId}`] = s.round;
      s.player.exhausted = true;
      ports.queue(s, C("release-choose"));
      break;
    case "collector:release-pay":
      if (!collection?.length) throw Error("The Collection is empty.");
      ports.pay(
        s,
        2,
        [],
        [
          {
            type: "flag",
            key: `collectorRelease:${s.activePlayerId}`,
            value: s.round,
          },
          C("release-choose"),
        ],
        "The Grand Collection",
        true,
      );
      break;
    case "collector:release-choose": {
      if (!collection?.length) break;
      if (collection.length === 1) {
        ports.queue(s, C("release", { id: collection[0].id }));
        break;
      }
      ports.choose(
        s,
        "The Grand Collection",
        "Discard 1 card from The Collection to its owner's discard pile.",
        collection.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [C("release", { id: p.id })],
        })),
      );
      break;
    }
    case "collector:release": {
      const i = collection?.findIndex((p) => p.id === e.id) ?? -1;
      if (i >= 0) ports.returnFromCollection(s, collection!.splice(i, 1)[0]);
      break;
    }
    case "collector:crystal-ball": {
      const playable = s.player.hand.filter((p) =>
        ports.canPlayWithDiscount(s, p, 3),
      );
      if (!playable.length) break;
      ports.choose(
        s,
        "Crystal Ball",
        "You may play a card from your hand, reducing its cost by 3.",
        [
          ...playable.map((p) => ({
            id: p.id,
            label: `Play ${name(p)} for 3 less`,
            image: p.code,
            effects: [
              { type: "visionPackMeditationPlay", id: p.id, discount: 3 },
            ],
          })),
          { id: "skip", label: "Do not play a card", effects: [] },
        ],
      );
      break;
    }
    default:
      throw Error(`Unknown Collector effect: ${e.type}`);
  }
  return true;
}
