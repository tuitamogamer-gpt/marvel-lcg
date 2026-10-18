import { card, CATALOG_CARDS } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const D = (type: string, args: Record<string, unknown> = {}) =>
  E(`deadpool:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, text: string) => {
  if (!ok) throw Error(text);
};
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const trait = (p: Piece | Card, name: string) =>
  !!card(p.code).traits?.split(/\.\s*/).includes(name);
const find = (s: GameState, id: string) =>
  [...allInPlay(s), ...s.minions, ...s.attachments, ...s.sideSchemes].find(
    (p) => p.id === id,
  );
export const DEADPOOL_SCRIPT_CODES = [
  "44001a",
  "44001b",
  ...Array.from({ length: 57 }, (_, i) => String(44002 + i)),
];
export const DREADPOOL_CODES = [
  "44037",
  "44038",
  "44039",
  "44040",
  "44041",
  "44041",
  "44042",
];
export interface DeadpoolTarget {
  id: string;
  label: string;
  code?: string;
}
export interface DeadpoolPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  enemies(s: GameState, attack: boolean): DeadpoolTarget[];
  schemes(s: GameState, thwart: boolean, ignore?: boolean): DeadpoolTarget[];
  friendly(s: GameState): DeadpoolTarget[];
  makePiece(s: GameState, code: string): Piece;
  maxHP(s: GameState): number;
  handSize(s: GameState): number;
  canReady(s: GameState, id: string): boolean;
  ready(s: GameState, id: string): void;
  heal(s: GameState, id: string, n: number): number;
  moveThreat(
    s: GameState,
    id: string,
    amount?: number,
    ignore?: boolean,
  ): number;
  damage(s: GameState, id: string, n: number, source: string): number;
  discard(s: GameState, id: string): void;
  remove(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  drawEncounter(s: GameState): Piece | undefined;
  discardPlayerTop(s: GameState): Piece | undefined;
  dealEncounter(s: GameState, id: string): void;
  attach(s: GameState, p: Piece, id: string): void;
  reveal(s: GameState, p: Piece): void;
  cancelReveal(s: GameState, p: Piece, onlyWhenRevealed: boolean): void;
  pay(
    s: GameState,
    title: string,
    cost: number,
    after: Effect[],
    requirements?: Resource[],
    commit?: Effect[],
  ): void;
  canPay(s: GameState, p: Piece): boolean;
  reaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
    cancelAfter?: Effect[],
  ): void;
  putAlly(s: GameState, p: Piece): void;
  collectionWeapons(s: GameState): Card[];
  canEnter(s: GameState, p: Piece): boolean;
  enterWeapon(s: GameState, p: Piece): void;
  defeat(s: GameState, id: string): void;
  hasTrait(s: GameState, id: string, name: string): boolean;
  attackEnemy(s: GameState, attacker: string, target: string): void;
}
export function deadpoolInitialize(
  s: GameState,
  make: DeadpoolPorts["makePiece"],
) {
  if (s.heroId !== "deadpool" || s.flags.deadpoolInitialized) return;
  s.flags.deadpoolInitialized = true;
  (s.player.setAside ||= []).push(
    ...["44033", "44034", "44035", "44036", "44036"].map((code) => {
      const p = make(s, code);
      p.ownerId = s.activePlayerId;
      return p;
    }),
  );
}
/** One shared Crisis/Dreadpool set if any player chooses Pool; borrowing pink cards does not choose it. */
export function deadpoolSetupPool(
  s: GameState,
  make: DeadpoolPorts["makePiece"],
) {
  const seats = playerOrder(s).filter((seat) =>
    (seat.deckAspects || [seat.aspect]).some((a) => String(a) === "pool"),
  );
  if (!seats.length || s.deadpool?.initializedPoolSeats.length) return;
  const state = (s.deadpool ||= { poolSetAside: [], initializedPoolSeats: [] });
  state.initializedPoolSeats = seats.map((seat) => seat.id);
  const cards = DREADPOOL_CODES.map((code) => make(s, code));
  s.encounter.deck.push(cards[0]);
  state.poolSetAside.push(...cards.slice(1));
}
export function deadpoolIcons(s: GameState) {
  const cards = [
    card(s.scheme.code),
    ...new Map(
      [
        s.villain,
        ...s.minions,
        ...s.sideSchemes,
        ...s.attachments,
        ...(s.environments || []),
        ...allInPlay(s),
      ].map((p) => [p.id, card(p)]),
    ).values(),
  ];
  const count = (key: keyof Card) =>
    cards.reduce((n, c) => n + Number(c[key] || 0), 0);
  return {
    crisis: count("scheme_crisis"),
    acceleration: count("scheme_acceleration"),
    amplify: count("scheme_amplify"),
    hazard: count("scheme_hazard"),
  };
}
export const deadpoolIconCount = (s: GameState) =>
  Object.values(deadpoolIcons(s)).reduce((a, b) => a + b, 0);
export function deadpoolPlayerIcons(
  s: GameState,
  key:
    | "scheme_crisis"
    | "scheme_acceleration"
    | "scheme_amplify"
    | "scheme_hazard",
) {
  return allInPlay(s).reduce((n, p) => n + Number(card(p)[key] || 0), 0);
}
export function deadpoolResources(
  s: GameState,
  p: Piece,
  maxHP: number,
): Resource[] | undefined {
  if (p.code === "44007")
    return Array(1 + Math.min(3, s.encounter.acceleration)).fill("wild");
  const r: Record<string, Resource> = {
    "44025": "physical",
    "44026": "mental",
    "44027": "energy",
  };
  if (r[p.code])
    return Array(
      maxHP - s.player.hp === 0 ? 3 : maxHP - s.player.hp < 5 ? 2 : 1,
    ).fill(r[p.code]);
}
export function deadpoolAllyBonus(s: GameState, p: Piece) {
  return p.code === "44002" && !isTextBlank(s, p)
    ? Math.min(3, s.encounter.acceleration)
    : 0;
}
export function deadpoolAttackBonus(s: GameState) {
  return live(s, "44055").length * Math.min(4, deadpoolIconCount(s));
}
export function deadpoolHandBonus(s: GameState) {
  return s.sideSchemes.some((p) => p.code === "44024" && !isTextBlank(s, p))
    ? 2
    : 0;
}
export function deadpoolSchemeBonus(s: GameState) {
  return (
    allInPlay(s).filter(
      (p) =>
        p.code === "44011" &&
        ["main", `main:${s.scheme.code}`].includes(p.attachedTo || "") &&
        !isTextBlank(s, p),
    ).length *
    2 *
    s.encounter.acceleration
  );
}
export function deadpoolDiscount(s: GameState, p: Piece | Card) {
  return p.code === "44028" && s.flags.deadpoolPreviousWon === false ? 2 : 0;
}
export function deadpoolCardPlayed(s: GameState) {
  s.flags.deadpoolPlayedPhase = phase(s);
}
export function deadpoolPlayRestriction(s: GameState, p: Piece) {
  if (p.code === "44031") {
    const identities = playerOrder(s)
      .filter((seat) => seatView(s, seat).player.form === "hero")
      .map(
        (seat) =>
          CATALOG_CARDS.find(
            (c) => c.type_code === "hero" && c.set_code === seat.heroId,
          )?.name,
      );
    const names = [
      ...identities,
      ...allInPlay(s)
        .filter((q) => card(q).type_code === "ally")
        .map((q) => card(q).name),
    ];
    if (
      !["deadpool", "cable"].includes(s.heroId) ||
      !["Deadpool", "Cable"].every((name) => names.includes(name))
    )
      return "Frenemies requires Cable and Deadpool in play and one as your identity.";
  }
  if (
    p.code === "44051" &&
    !s.sideSchemes.some(
      (q) =>
        !allInPlay(s).some((a) => a.code === "44051" && a.attachedTo === q.id),
    )
  )
    return "Ambush requires a side scheme without another Ambush.";
  if (
    p.code === "44054" &&
    !s.minions.some(
      (q) =>
        !trait(q, "Elite") &&
        !allInPlay(s).some((a) => a.code === "44054" && a.attachedTo === q.id),
    )
  )
    return "Distraction requires a non-Elite minion without another Distraction.";

  if (p.code === "44048" && s.flags.deadpoolPlayedPhase === phase(s))
    return "Mulligan cannot be played after another card this phase.";
  if (p.code === "44028" && typeof s.flags.deadpoolPreviousWon !== "boolean")
    return "Report your previous game's result with the identity's Game history action before playing Git Gud.";
  if (["44004", "44006"].includes(p.code) && s.player.tough)
    return "Taking damage is a cost; Tough prevents that cost.";
  return undefined;
}
export function deadpoolTriggeredBlocked(s: GameState) {
  if (s.phase !== "player") return false;
  const turn = s.players.find(
    (p) => p.id === s.turnPlayerId && !p.ended && !p.eliminated,
  );
  return (
    !!turn &&
    turn.id !== s.activePlayerId &&
    seatView(s, turn).player.inPlay.some(
      (p) => p.code === "44032" && !isTextBlank(s, p),
    )
  );
}
export function deadpoolCanReady(s: GameState, p: Piece) {
  const owner = controller(s, p.id);
  return (
    card(p).type_code !== "ally" ||
    !owner ||
    !live(seatView(s, owner), "44032").length
  );
}
export function deadpoolRescue(
  s: GameState,
  ports: Pick<DeadpoolPorts, "remove" | "queue">,
) {
  if (s.player.hp > 0) return false;
  if (s.flags.deadpoolRescuePending) return true;
  const regenerate =
    s.heroId === "deadpool" &&
    s.player.form === "hero" &&
    !isTextBlank(s, { code: "44001a", id: `hero:${s.activePlayerId}` });
  const git = allInPlay(s).find(
    (p) => p.code === "44028" && !isTextBlank(s, p),
  );
  if (regenerate && git) {
    s.flags.deadpoolRescuePending = true;
    ports.queue(
      s,
      D("rescue-choice", { actorId: s.activePlayerId, gitId: git.id }),
    );
    return true;
  }
  if (regenerate) {
    s.player.hp = 1;
    s.player.form = "alter";
    s.encounter.acceleration++;
    return true;
  }
  if (git) {
    s.player.hp = 1;
    s.player.form = "alter";
    ports.remove(s, git.id);
    return true;
  }
  return false;
}

export function deadpoolDamageTaken(s: GameState) {
  if (s.heroId !== "deadpool" || s.player.form !== "hero") return;
  for (const p of [...s.sideSchemes].filter(
    (p) => p.code === "44034" && !isTextBlank(s, p),
  )) {
    p.counters++;
    if (p.counters >= 10) {
      s.sideSchemes.splice(s.sideSchemes.indexOf(p), 1);
      s.removed.push(p);
    }
  }
}
export function deadpoolAbilityOptions(
  s: GameState,
  id: string,
  ports: DeadpoolPorts,
): Option[] {
  if (id === "identity") {
    const out: Option[] = [];
    if (
      s.heroId === "deadpool" &&
      s.player.form === "alter" &&
      s.player.hand.length &&
      s.flags.deadpoolFourthRound !== s.round &&
      !isTextBlank(s, { code: "44001b", id: `hero:${s.activePlayerId}` })
    )
      out.push(
        O(
          "fourth-wall",
          "Break the Fourth Wall · discard and search",
          [D("fourth")],
          "44001b",
        ),
      );
    if (
      s.player.hand.some((p) => p.code === "44028") &&
      typeof s.flags.deadpoolPreviousWon !== "boolean"
    )
      out.push(
        O(
          "game-history",
          "Game history · report previous result",
          [D("history")],
          "44028",
        ),
      );
    return out;
  }
  const p = find(s, id);
  if (!p || isTextBlank(s, p)) return [];
  if (p.code === "44035" && s.player.form === "alter")
    return [
      O(
        "tabula",
        "Spend 2 mental · discard Tabula Rasa 16",
        [
          D("pay", {
            id,
            cost: 2,
            requirements: ["mental", "mental"],
            after: [E("discardPiece", { id })],
          }),
        ],
        p.code,
      ),
    ];
  if (p.code === "44040" && s.player.form === "hero")
    return [
      O(
        "ray",
        "Spend energy, mental, physical · attach to identity",
        [
          D("pay", {
            id,
            cost: 3,
            requirements: ["energy", "mental", "physical"],
            after: [D("ray-identity", { id })],
          }),
        ],
        p.code,
      ),
    ];
  if (p.code === "44050" && !p.exhausted)
    return [
      O(
        "plot",
        "Plot Convenience · store or retrieve aspect card",
        [D("plot", { id })],
        p.code,
      ),
    ];
  if (!s.player.inPlay.some((q) => q.id === id)) return [];
  if (p.code === "44053" || p.code === "44057")
    return s.player.form === "hero"
      ? [
          O(
            "metagame",
            `${card(p).name} · choose board space`,
            [D("board", { id })],
            p.code,
          ),
        ]
      : [];
  if (p.exhausted && p.code !== "44052") return [];
  const actions: Record<string, string> = {
    "44009": "swap",
    "44010": "katana",
    "44030": "stick",
    "44049": "ship",
    "44052": "bazooka",
    "44056": "rps",
    "44058": "war",
  };
  if (
    !actions[p.code] ||
    (["44010", "44030", "44052", "44056", "44058"].includes(p.code) &&
      s.player.form !== "hero")
  )
    return [];
  if (p.code === "44010" && (s.player.tough || s.player.hp < 1)) return [];
  if (
    p.code === "44049" &&
    !s.player.hand.some(
      (q) =>
        card(q).type_code === "ally" &&
        card(q).faction_code === "pool" &&
        ports.canEnter(s, q),
    )
  )
    return [];
  if (p.code === "44056" && !s.player.hand.length) return [];
  return [
    O(actions[p.code], card(p).name, [D(actions[p.code], { id })], p.code),
  ];
}
export function deadpoolEvent(s: GameState, p: Piece): Effect[] | null {
  const actions: Record<string, string> = {
    "44003": "personality",
    "44004": "maximum",
    "44006": "yoohoo",
    "44012": "fire",
    "44018": "cutupper",
    "44019": "bomb",
    "44020": "rage",
    "44021": "got-this",
    "44023": "inspection",
    "44031": "frenemies",
    "44046": "break",
    "44048": "mulligan",
  };
  return actions[p.code] ? [D(actions[p.code], { piece: p })] : null;
}
export function deadpoolCardEntered(_s: GameState, p: Piece): Effect[] {
  return ["44009", "44011", "44043", "44051", "44054"].includes(p.code)
    ? [D("entered", { id: p.id })]
    : [];
}
export function deadpoolTurnEnded(s: GameState): Effect[] {
  return s.player.hand
    .filter((p) => p.code === "44012")
    .map((p) => E("damage", { target: "hero", amount: 1, source: p.id }));
}
export function deadpoolPhaseEnded(s: GameState): Effect[] {
  return playerOrder(s).flatMap((seat) =>
    live(seatView(s, seat), "44032").map((p) =>
      D("speech", { id: p.id, actorId: seat.id }),
    ),
  );
}
export function deadpoolPhaseBegan(s: GameState): Effect[] {
  return live(s, "44029")
    .filter((p) => !p.exhausted)
    .map((p) =>
      E("optional", {
        title: "Healing Factor",
        text: "Exhaust Healing Factor to heal 2 damage?",
        effects: [D("healing", { id: p.id })],
      }),
    );
}
export function deadpoolRecovered(s: GameState): Effect[] {
  return playerOrder(s).flatMap((seat) =>
    live(seatView(s, seat), "44008")
      .filter((p) => !p.exhausted)
      .map((p) =>
        E("optional", {
          title: "Chimichanga Truck",
          text: "Exhaust the truck to ready the identity that just recovered?",
          actorId: seat.id,
          effects: [
            D("truck", {
              id: p.id,
              target: `hero:${s.activePlayerId}`,
              actorId: seat.id,
            }),
          ],
        }),
      ),
  );
}
export function deadpoolDefeated(
  s: GameState,
  p: Piece,
  source: string,
  owner?: string,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "44038")
    return [
      D("dreadpool-dealt", {
        piece: p,
        playerId: source.startsWith("hero:")
          ? source.slice(5)
          : controller(s, source)?.id || s.activePlayerId,
      }),
    ];
  return p.code === "44013"
    ? [D("dog", { actorId: owner || s.activePlayerId })]
    : p.code === "44016"
      ? [D("lady", { actorId: owner || s.activePlayerId })]
      : [];
}
export function deadpoolSchemeDefeating(s: GameState, p: Piece): Effect[] {
  return allInPlay(s)
    .filter(
      (q) => q.code === "44051" && q.attachedTo === p.id && !isTextBlank(s, q),
    )
    .map((q) =>
      D("ambush", { actorId: controller(s, q.id)?.id || s.activePlayerId }),
    );
}
export function deadpoolEncounter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "44032") return [D("obligation", { piece: p })];
  if (p.code === "44033" || p.code === "44034" || p.code === "44036") return [];
  return [
    "44035",
    "44037",
    "44038",
    "44039",
    "44040",
    "44041",
    "44042",
  ].includes(p.code)
    ? [D(`encounter-${p.code}`, { piece: p })]
    : null;
}
export function deadpoolBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "44033"
    ? [E("status", { target: "hero", status: "confused" })]
    : p.code === "44035"
      ? [D("encounter-44035", { piece: p })]
      : null;
}
export function deadpoolShadows(s: GameState): Effect[] | null {
  return s.heroId === "deadpool" ? [D("nemesis")] : null;
}
export function deadpoolRevealOptions(
  s: GameState,
  p: Piece,
  fromEncounterDeck: boolean,
  ports: DeadpoolPorts,
): Option[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const out: Option[] = [];
  if (s.player.form === "hero")
    for (const q of s.player.hand.filter(
      (q) =>
        ((q.code === "44005" &&
          !["villain", "main_scheme"].includes(card(p).type_code)) ||
          (q.code === "44047" &&
            fromEncounterDeck &&
            card(p).type_code === "treachery")) &&
        ports.canPay(s, q),
    ))
      out.push(
        O(
          q.id,
          card(q).name,
          [D("reveal-pay", { id: q.id, piece: p })],
          q.code,
        ),
      );
  if (card(p).type_code === "treachery")
    for (const q of live(s, "44044"))
      out.push(
        O(
          q.id,
          "Negasonic Teenage Warhead · cancel When Revealed",
          [D("negasonic", { id: q.id, piece: p })],
          q.code,
        ),
      );
  return out;
}
export function deadpoolDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: DeadpoolPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !packet.attack ||
    !(
      packet.target === "hero" || packet.target === `hero:${s.activePlayerId}`
    ) ||
    !deadpoolIconCount(s) ||
    deadpoolTriggeredBlocked(s)
  )
    return [];
  return s.player.hand
    .filter((p) => p.code === "44017" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Barely a Scratch",
        [D("damage-pay", { id: p.id, packet, after })],
        p.code,
      ),
    );
}
export function deadpoolThreatOptions(
  s: GameState,
  packet: Effect,
  ports: DeadpoolPorts,
): Option[] {
  if (!(packet.amount > 0) || deadpoolTriggeredBlocked(s)) return [];
  return s.player.hand
    .filter((p) => p.code === "44022" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Not my Responsibility",
        [D("threat-pay", { id: p.id, packet })],
        p.code,
      ),
    );
}
function select(
  s: GameState,
  title: string,
  targets: DeadpoolTarget[],
  effect: Effect,
  ports: DeadpoolPorts,
) {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...effect, target: t.id }], t.code),
      ),
    );
}
const attack = (amount: number, extra: Record<string, unknown> = {}) =>
  E("damage", { amount, source: "hero", attack: true, ...extra });
const target = (
  title: string,
  group: string,
  action: Effect,
  extra: Record<string, unknown> = {},
) => E("target", { title, group, action, ...extra });
export const DEADPOOL_BLACKOUT_SPACES: Resource[] = [
  "energy",
  "energy",
  "mental",
  "mental",
  "physical",
  "physical",
];
export const DEADPOOL_TICTACTOE_SPACES: Resource[] = [
  "energy",
  "energy",
  "energy",
  "mental",
  "mental",
  "mental",
  "physical",
  "physical",
  "physical",
];
export function deadpoolBoardWon(spaces: number[]) {
  return [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ].some((line) => line.every((i) => spaces.includes(i)));
}
export function deadpoolRPS(chosen: Card, discarded: Card) {
  const beats: Record<Resource, Resource[]> = {
    energy: ["mental"],
    mental: ["physical"],
    physical: ["energy"],
    wild: ["energy", "mental", "physical"],
  };
  return (Object.keys(beats) as Resource[]).some(
    (r) =>
      !!chosen[`resource_${r}`] &&
      beats[r].some((q) => !!discarded[`resource_${q}`]),
  );
}
export function resolveDeadpoolEffect(
  s: GameState,
  e: Effect,
  ports: DeadpoolPorts,
): boolean {
  if (!e.type.startsWith("deadpool:")) return false;
  const p = e.id ? find(s, e.id) : undefined;
  switch (e.type) {
    case "deadpool:ray-end":
      delete s.flags[`deadpoolRay:${e.target}`];
      break;
    case "deadpool:rescue-choice":
      ports.choose(
        s,
        "Forced defeat replacements",
        "Choose which forced replacement resolves first.",
        [
          O("regenerate", "Regenerate · add acceleration", [
            D("rescue", { kind: "regenerate" }),
          ]),
          O("git-gud", "Git Gud · remove upgrade", [
            D("rescue", { kind: "git", id: e.gitId }),
          ]),
        ],
      );
      break;
    case "deadpool:rescue":
      delete s.flags.deadpoolRescuePending;
      s.player.hp = 1;
      s.player.form = "alter";
      if (e.kind === "regenerate") s.encounter.acceleration++;
      else if (p) ports.remove(s, p.id);
      break;
    case "deadpool:remove-threat":
      ports.moveThreat(s, e.target, e.amount);
      break;
    case "deadpool:history":
      ports.choose(
        s,
        "Git Gud · previous game",
        "Did you win your previous game of Marvel Champions? Your answer controls this card's printed discount.",
        [
          O("won", "I won my previous game", [D("history-set", { won: true })]),
          O("unknown", "First game or previous result unknown", [
            D("history-set", { won: false }),
          ]),
          O("not-won", "I did not win my previous game", [
            D("history-set", { won: false }),
          ]),
        ],
      );
      break;
    case "deadpool:history-set":
      s.flags.deadpoolPreviousWon = !!e.won;
      break;
    case "deadpool:fourth":
      select(
        s,
        "Break the Fourth Wall",
        s.player.hand.map((q) => ({
          id: q.id,
          label: card(q).name,
          code: q.code,
        })),
        D("fourth-discard"),
        ports,
      );
      break;
    case "deadpool:fourth-discard":
      need(
        s.player.form === "alter" && s.flags.deadpoolFourthRound !== s.round,
        "Break the Fourth Wall is unavailable.",
      );
      ports.discardHand(s, e.target);
      s.flags.deadpoolFourthRound = s.round;
      select(
        s,
        "Search for a Deadpool event",
        s.player.deck
          .filter(
            (q) =>
              card(q).set_code === "deadpool" && card(q).type_code === "event",
          )
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        D("fourth-find"),
        ports,
      );
      if (!s.prompt) ports.shuffle(s);
      break;
    case "deadpool:fourth-find": {
      const i = s.player.deck.findIndex((q) => q.id === e.target);
      need(i >= 0, "The searched event left the deck.");
      s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shuffle(s);
      break;
    }
    case "deadpool:personality":
      ports.choose(s, "Exhausting Personality", "Choose an effect.", [
        O("acceleration", "Add acceleration · stun and confuse villain", [
          E("accelerate"),
          E("status", { target: s.villain.id, status: "stunned" }),
          E("status", { target: s.villain.id, status: "confused" }),
        ]),
        ...playerOrder(s)
          .filter((seat) => !seatView(s, seat).player.exhausted)
          .map((seat) =>
            O(
              seat.id,
              `Exhaust ${card(seatView(s, seat).player.form === "hero" ? CATALOG_CARDS.find((c) => c.type_code === "hero" && c.set_code === seat.heroId)?.code || "44001a" : "44001b").name} · draw ${s.encounter.acceleration}`,
              [D("personality-exhaust", { playerId: seat.id })],
            ),
          ),
      ]);
      break;
    case "deadpool:personality-exhaust": {
      const v = seatView(s, e.playerId);
      need(!v.player.exhausted, "Choose a ready identity.");
      v.player.exhausted = true;
      ports.queue(
        s,
        E("draw", { amount: s.encounter.acceleration, actorId: e.playerId }),
      );
      break;
    }
    case "deadpool:maximum":
    case "deadpool:yoohoo":
      ports.choose(
        s,
        card(e.piece).name,
        "Choose the exact damage you will take as the cost.",
        Array.from({ length: s.player.hp }, (_, i) =>
          O(String(i + 1), `Take ${i + 1} damage`, [
            D("take-cost", {
              amount: i + 1,
              thwart: e.type === "deadpool:yoohoo",
            }),
          ]),
        ),
      );
      break;
    case "deadpool:take-cost":
      need(
        !s.player.tough && s.player.hp >= e.amount,
        "Take the full damage cost.",
      );
      ports.damage(s, "hero", e.amount, "hero");
      ports.queue(
        s,
        target(
          e.thwart ? '"Yoo-Hoo!"' : "Maximum Effort",
          e.thwart ? "scheme" : "enemy",
          e.thwart
            ? E("thwart", { amount: e.amount, source: "hero" })
            : attack(e.amount),
          e.thwart ? { thwarting: true } : { attack: true },
        ),
      );
      break;
    case "deadpool:fire":
      ports.queue(
        s,
        target(
          "This Card is Fire",
          "enemy",
          attack(ports.maxHP(s) - s.player.hp),
          { attack: true },
        ),
      );
      break;
    case "deadpool:cutupper":
      select(s, "Cutupper", ports.enemies(s, true), D("cutupper-hit"), ports);
      break;
    case "deadpool:cutupper-hit":
      ports.queue(
        s,
        attack(5, { target: e.target }),
        E("status", { target: e.target, status: "stunned" }),
      );
      break;
    case "deadpool:bomb":
      ports.queue(
        s,
        E("damage", { target: s.villain.id, amount: 10, source: "hero" }),
        D("bomb-rest"),
      );
      break;
    case "deadpool:bomb-rest": {
      const n = deadpoolIconCount(s);
      ports.queue(
        s,
        ...[
          ...ports.enemies(s, false).map((t) => t.id),
          ...playerOrder(s)
            .filter((seat) => seatView(s, seat).player.form === "hero")
            .map((seat) => `hero:${seat.id}`),
        ].map((id) => E("damage", { target: id, amount: n, source: "hero" })),
      );
      break;
    }
    case "deadpool:rage":
      select(
        s,
        "Get Rage-y",
        allInPlay(s)
          .filter(
            (q) => card(q).type_code === "ally" && ports.canReady(s, q.id),
          )
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        D("rage-ready"),
        ports,
      );
      break;
    case "deadpool:rage-ready": {
      const q = find(s, e.target);
      if (q) {
        ports.ready(s, q.id);
        q.bonusAtk = (q.bonusAtk || 0) + 1;
      }
      break;
    }
    case "deadpool:got-this": {
      const icons = deadpoolIcons(s);
      ports.queue(
        s,
        ...(icons.crisis
          ? [
              target(
                '"I Got This"',
                "enemy",
                E("damage", { amount: 3, source: "hero" }),
              ),
            ]
          : []),
        ...(icons.acceleration
          ? [
              target(
                '"I Got This"',
                "scheme",
                D("remove-threat", { amount: 2 }),
              ),
            ]
          : []),
        ...(icons.amplify ? [D("got-ready")] : []),
        ...(icons.hazard ? [E("draw", { amount: 1 })] : []),
      );
      break;
    }
    case "deadpool:got-ready":
      select(
        s,
        '"I Got This"',
        s.player.inPlay
          .filter(
            (q) => card(q).type_code === "ally" && ports.canReady(s, q.id),
          )
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        E("ready"),
        ports,
      );
      break;
    case "deadpool:inspection":
      ports.queue(
        s,
        E("thwart", {
          target: "main",
          amount: 5,
          source: "hero",
          ignoreCrisis: true,
        }),
        D("inspection-rest"),
      );
      break;
    case "deadpool:inspection-rest": {
      const n = deadpoolIconCount(s);
      ports.queue(
        s,
        ...ports
          .schemes(s, false, true)
          .map((t) => D("remove-threat", { target: t.id, amount: n })),
      );
      break;
    }
    case "deadpool:frenemies": {
      const characters = [
        ...ports.friendly(s),
        ...ports.enemies(s, false),
      ].filter((t) =>
        ["Cable", "Deadpool"].includes(t.code ? card(t.code).name : ""),
      );
      ports.queue(
        s,
        ...characters.map((t) =>
          E("damage", { target: t.id, amount: 1, source: "hero" }),
        ),
        D("frenemies-thwart"),
      );
      break;
    }
    case "deadpool:frenemies-thwart":
      select(
        s,
        "Frenemies",
        ports.schemes(s, true).filter((t) => t.id !== e.exclude),
        D("frenemies-target", { second: !!e.exclude }),
        ports,
      );
      break;
    case "deadpool:frenemies-target":
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: 3, source: "hero" }),
        ...(e.second ? [] : [D("frenemies-thwart", { exclude: e.target })]),
      );
      break;
    case "deadpool:break":
      s.flags.deadpoolBreakStarted = Date.now();
      ports.choose(
        s,
        "Break Time",
        "Take a group break and leave the game. Return when everyone is back; elapsed full minutes are measured and saved.",
        [
          O("return", "Everyone has returned from the group break", [
            D("break-return"),
          ]),
        ],
      );
      break;
    case "deadpool:break-return": {
      const n = Math.max(
        0,
        Math.floor(
          (Date.now() - Number(s.flags.deadpoolBreakStarted || Date.now())) /
            60000,
        ),
      );
      delete s.flags.deadpoolBreakStarted;
      for (const seat of playerOrder(s)) ports.heal(s, `hero:${seat.id}`, n);
      break;
    }
    case "deadpool:mulligan":
      for (const q of [...s.player.hand]) ports.discardHand(s, q.id);
      ports.queue(s, E("draw", { amount: ports.handSize(s) }));
      break;
    case "deadpool:entered": {
      if (!p) break;
      if (p.code === "44011") p.attachedTo = `main:${s.scheme.code}`;
      if (p.code === "44009")
        ports.queue(
          s,
          E("optional", {
            title: "Armed to the Teeth",
            text: "Choose a Weapon upgrade from your collection to store facedown?",
            effects: [D("collection", { id: p.id })],
          }),
        );
      if (p.code === "44043")
        ports.choose(s, "Bob, Agent of Hydra", "Choose a response.", [
          O("damage", "Deal 2 damage", [
            target(
              "Bob, Agent of Hydra",
              "enemy",
              E("damage", { amount: 2, source: p.id }),
            ),
          ]),
          O("threat", "Remove 1 threat", [
            target(
              "Bob, Agent of Hydra",
              "scheme",
              D("remove-threat", { amount: 1 }),
            ),
          ]),
          O("skip", "Skip response", []),
        ]);
      if (p.code === "44051")
        select(
          s,
          "Ambush",
          s.sideSchemes
            .filter(
              (q) =>
                !allInPlay(s).some(
                  (a) => a.code === "44051" && a.attachedTo === q.id,
                ),
            )
            .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
          D("attach", { id: p.id }),
          ports,
        );
      if (p.code === "44054")
        select(
          s,
          "Distraction",
          s.minions
            .filter(
              (q) =>
                !ports.hasTrait(s, q.id, "Elite") &&
                !allInPlay(s).some(
                  (a) => a.code === "44054" && a.attachedTo === q.id,
                ),
            )
            .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
          D("attach", { id: p.id }),
          ports,
        );
      break;
    }
    case "deadpool:attach":
      if (p) p.attachedTo = e.target;
      break;
    case "deadpool:collection":
      select(
        s,
        "Armed to the Teeth · collection",
        ports
          .collectionWeapons(s)
          .map((c) => ({ id: c.code, label: c.name, code: c.code })),
        D("store-weapon", { id: e.id }),
        ports,
      );
      break;
    case "deadpool:store-weapon":
      need(
        p && ports.collectionWeapons(s).some((c) => c.code === e.target),
        "Choose a Weapon still in your collection.",
      );
      {
        const q = ports.makePiece(s, e.target);
        q.ownerId = s.activePlayerId;
        p!.storedCards = [q];
      }
      break;
    case "deadpool:swap":
      if (p?.storedCards?.length)
        select(
          s,
          "Armed to the Teeth",
          s.player.inPlay
            .filter(
              (q) =>
                q.id !== p.id &&
                trait(q, "Weapon") &&
                ports.canEnter(s, p.storedCards![0]),
            )
            .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
          D("swap-commit", { id: p.id }),
          ports,
        );
      break;
    case "deadpool:swap-commit": {
      const q = find(s, e.target),
        incoming = p?.storedCards?.[0];
      need(
        p && !p.exhausted && q && incoming && ports.canEnter(s, incoming),
        "This Weapon swap is no longer legal.",
      );
      const i = s.player.inPlay.findIndex((a) => a.id === q!.id);
      need(i >= 0, "Choose a controlled Weapon.");
      p!.exhausted = true;
      incoming!.exhausted = false;
      incoming!.attachedTo = q!.attachedTo;
      delete q!.attachedTo;
      q!.counters = 0;
      q!.damage = 0;
      q!.exhausted = false;
      s.player.inPlay[i] = incoming!;
      ports.enterWeapon(s, incoming!);
      p!.storedCards = [q!];
      break;
    }
    case "deadpool:katana":
      need(
        p && !p.exhausted && !s.player.tough && s.player.hp >= 1,
        "Pay the full Katana cost.",
      );
      p!.exhausted = true;
      ports.damage(s, "hero", 1, p!.id);
      ports.queue(
        s,
        target("Deadpool's Katana", "enemy", attack(2, { piercing: true }), {
          attack: true,
        }),
      );
      break;
    case "deadpool:bazooka": {
      const n = deadpoolIconCount(s);
      need(p, "Bazooka left play.");
      ports.discard(s, p!.id);
      ports.queue(
        s,
        target("Bazooka", "enemy", attack(n, { ranged: true }), {
          attack: true,
        }),
      );
      break;
    }
    case "deadpool:stick":
      ports.pay(
        s,
        "Stick-To-Itiveness",
        1,
        [E("ready", { target: "hero" })],
        ["physical"],
        [D("exhaust", { id: e.id })],
      );
      break;
    case "deadpool:exhaust":
      need(p && !p.exhausted, "The source must be ready.");
      p!.exhausted = true;
      break;
    case "deadpool:healing":
      need(p && !p.exhausted, "Healing Factor must be ready.");
      p!.exhausted = true;
      ports.heal(s, "hero", 2);
      break;
    case "deadpool:truck":
      need(p && !p.exhausted, "Chimichanga Truck must be ready.");
      p!.exhausted = true;
      ports.ready(s, e.target);
      break;
    case "deadpool:ship":
      select(
        s,
        "Deadpool Corps Ship",
        s.player.hand
          .filter(
            (q) =>
              card(q).type_code === "ally" &&
              card(q).faction_code === "pool" &&
              ports.canEnter(s, q),
          )
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        D("ship-put", { id: e.id }),
        ports,
      );
      break;
    case "deadpool:ship-put": {
      const q = s.player.hand.find((q) => q.id === e.target);
      need(
        p && !p.exhausted && q && ports.canEnter(s, q),
        "The ship needs a ready source and legal Pool ally.",
      );
      p!.exhausted = true;
      ports.dealEncounter(s, s.activePlayerId);
      s.player.hand.splice(s.player.hand.indexOf(q!), 1);
      ports.putAlly(s, q!);
      break;
    }
    case "deadpool:plot":
      if (p)
        ports.choose(
          s,
          "Plot Convenience",
          "Choose a facedown storage action.",
          [
            ...((p.storedCards?.length || 0) < 3
              ? s.player.hand
                  .filter(
                    (q) =>
                      !["hero", "basic", "encounter"].includes(
                        card(q).faction_code,
                      ),
                  )
                  .map((q) =>
                    O(
                      `store:${q.id}`,
                      `Store ${card(q).name}`,
                      [D("plot-store", { id: p.id, cardId: q.id })],
                      q.code,
                    ),
                  )
              : []),
            ...(p.storedCards || []).map((q) =>
              O(
                `take:${q.id}`,
                `Take ${card(q).name}`,
                [D("plot-take", { id: p.id, cardId: q.id })],
                q.code,
              ),
            ),
          ],
        );
      break;
    case "deadpool:plot-store": {
      const i = s.player.hand.findIndex((q) => q.id === e.cardId);
      need(
        p && !p.exhausted && i >= 0 && (p.storedCards?.length || 0) < 3,
        "Plot Convenience storage is unavailable.",
      );
      p!.exhausted = true;
      (p!.storedCards ||= []).push(s.player.hand.splice(i, 1)[0]);
      break;
    }
    case "deadpool:plot-take": {
      const i = p?.storedCards?.findIndex((q) => q.id === e.cardId) ?? -1;
      need(p && !p.exhausted && i >= 0, "The stored card is unavailable.");
      p!.exhausted = true;
      s.player.hand.push(p!.storedCards!.splice(i, 1)[0]);
      break;
    }
    case "deadpool:rps":
      select(
        s,
        "Rock, Paper, Scissors · choose a hand card",
        s.player.hand.map((q) => ({
          id: q.id,
          label: card(q).name,
          code: q.code,
        })),
        D("rps-play", { id: e.id }),
        ports,
      );
      break;
    case "deadpool:rps-play": {
      const chosen = s.player.hand.find((q) => q.id === e.target);
      need(
        p && !p.exhausted && chosen,
        "Choose an actual hand card before the discard.",
      );
      p!.exhausted = true;
      const q = ports.discardPlayerTop(s);
      if (q && deadpoolRPS(card(chosen!), card(q))) {
        const zone = s.player.discard.some((a) => a.id === q.id)
          ? s.player.discard
          : s.player.deck;
        const i = zone.findIndex((a) => a.id === q.id);
        if (i >= 0) s.player.hand.push(zone.splice(i, 1)[0]);
      }
      break;
    }
    case "deadpool:war":
      need(p && !p.exhausted, "War must be ready.");
      p!.exhausted = true;
      {
        const q = ports.drawEncounter(s);
        if (q) {
          s.encounter.discard.push(q);
          ports.queue(
            s,
            E("damage", {
              target: "hero",
              amount: (card(q).boost || 0) + Number(!!card(q).boost_star),
              source: p!.id,
            }),
            D("war-player"),
          );
        }
      }
      break;
    case "deadpool:war-player": {
      const q = ports.discardPlayerTop(s);
      if (q)
        ports.queue(
          s,
          target(
            "War",
            "enemy",
            E("damage", {
              amount: Math.max(0, card(q).cost || 0),
              source: "hero",
            }),
          ),
        );
      break;
    }
    case "deadpool:board":
      if (p) {
        const slots =
          p.code === "44053"
            ? DEADPOOL_BLACKOUT_SPACES
            : DEADPOOL_TICTACTOE_SPACES;
        ports.choose(
          s,
          card(p).name,
          "Choose an empty printed resource space. Wild resources may pay any matching type.",
          slots.flatMap((r, i) =>
            (p.deadpoolSpaces || []).includes(i)
              ? []
              : [
                  O(
                    String(i),
                    `${p.code === "44057" ? `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}` : `Space ${i + 1}`} · ${r}`,
                    [D("board-pay", { id: p.id, space: i, resource: r })],
                  ),
                ],
          ),
        );
      }
      break;
    case "deadpool:board-pay":
      ports.pay(
        s,
        p ? card(p).name : "Metagame",
        1,
        [D("board-target", { id: e.id, space: e.space })],
        [e.resource],
      );
      break;
    case "deadpool:board-target":
      if (p)
        select(
          s,
          card(p).name,
          p.code === "44053"
            ? ports
                .schemes(s, false)
                .filter((t) =>
                  t.id === "main"
                    ? s.scheme.threat > 0
                    : (find(s, t.id)?.counters || 0) > 0,
                )
            : [...ports.friendly(s), ...ports.enemies(s, false)].filter((t) =>
                t.id === "hero"
                  ? s.player.hp < ports.maxHP(s)
                  : t.id.startsWith("hero:")
                    ? seatView(s, t.id.slice(5)).player.hp <
                      ports.maxHP(seatView(s, t.id.slice(5)))
                    : t.id === s.villain.id
                      ? s.villain.hp < s.villain.maxHp
                      : (find(s, t.id)?.damage || 0) > 0,
              ),
          D("board-move", { id: p.id, space: e.space }),
          ports,
        );
      break;
    case "deadpool:board-move":
      if (p) {
        need(
          !(p.deadpoolSpaces || []).includes(e.space),
          "The board space is already occupied.",
        );
        const moved =
          p.code === "44053"
            ? ports.moveThreat(s, e.target)
            : ports.heal(s, e.target, 1);
        if (!moved) break;
        (p.deadpoolSpaces ||= []).push(e.space);
        p.counters = p.deadpoolSpaces.length;
        if (p.code === "44053" && p.counters === 6) {
          ports.discard(s, p.id);
          ports.queue(
            s,
            E("status", { target: s.villain.id, status: "confused" }),
          );
        } else if (p.code === "44057" && deadpoolBoardWon(p.deadpoolSpaces)) {
          const n = p.counters;
          ports.queue(
            s,
            target(
              "Tic-Tac-Toe",
              "enemy",
              E("damage", { amount: n, source: p.id }),
            ),
            E("discardPiece", { id: p.id }),
          );
        }
      }
      break;
    case "deadpool:dog":
      ports.queue(
        s,
        target("Dogpool", "enemy", E("damage", { amount: 1, source: "hero" })),
      );
      break;
    case "deadpool:lady":
    case "deadpool:ambush":
      select(
        s,
        e.type === "deadpool:lady" ? "Lady Deadpool" : "Ambush",
        s.minions
          .filter((q) => !ports.hasTrait(s, q.id, "Elite"))
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        D(e.type === "deadpool:lady" ? "defeat-minion" : "discard-minion"),
        ports,
      );
      break;
    case "deadpool:defeat-minion":
      ports.defeat(s, e.target);
      break;
    case "deadpool:discard-minion":
      ports.discard(s, e.target);
      break;
    case "deadpool:pay":
      ports.pay(
        s,
        p ? card(p).name : "Deadpool",
        e.cost,
        e.after,
        e.requirements,
      );
      break;
    case "deadpool:ray-identity":
      if (p) p.attachedTo = `hero:${s.activePlayerId}`;
      break;
    case "deadpool:obligation": {
      const owner = playerOrder(s).find((seat) => seat.heroId === "deadpool");
      if (!owner) {
        s.encounter.discard.push(e.piece);
        break;
      }
      s.resolving = s.resolving.filter((q) => q.id !== e.piece.id);
      const v = seatView(s, owner);
      v.player.inPlay.push(e.piece);
      for (const q of v.player.inPlay.filter(
        (q) => card(q).type_code === "ally",
      ))
        q.exhausted = true;
      break;
    }
    case "deadpool:speech":
      if (p)
        ports.choose(
          s,
          "The Merc with the Mouth",
          "Report honestly whether you talked during this player phase. This physical-table condition cannot be inferred from game commands.",
          [
            O("silent", "I have not talked this phase · discard obligation", [
              E("discardPiece", { id: p.id }),
            ]),
            O("talked", "I talked this phase · keep obligation", []),
          ],
        );
      break;
    case "deadpool:encounter-44035":
      ports.attach(s, e.piece, `hero:${s.activePlayerId}`);
      break;
    case "deadpool:encounter-44037": {
      const state = s.deadpool;
      const reserve = state?.poolSetAside || [];
      const owner = e.piece.ownerId;
      const cards = reserve.filter((q) => !owner || q.ownerId === owner);
      if (state)
        state.poolSetAside = reserve.filter(
          (q) => !cards.some((a) => a.id === q.id),
        );
      s.resolving = s.resolving.filter((q) => q.id !== e.piece.id);
      s.removed.push(e.piece);
      const minion = cards.find((q) => q.code === "44038"),
        scheme = cards.find((q) => q.code === "44039");
      s.encounter.deck.push(
        ...cards.filter((q) => q !== minion && q !== scheme),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...(minion ? [E("reveal", { piece: minion })] : []),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    case "deadpool:encounter-44038": {
      const q = s.minions.find((q) => q.id === e.piece.id);
      if (q) q.engagedWith = s.firstPlayerId;
      break;
    }
    case "deadpool:encounter-44039": {
      const q = s.sideSchemes.find((q) => q.id === e.piece.id);
      if (q)
        q.counters +=
          2 *
          playerOrder(s).filter(
            (seat) =>
              seatView(s, seat).player.inPlay.some(
                (a) => card(a).faction_code === "pool",
              ) ||
              s.sideSchemes.some(
                (a) =>
                  a.playerSideSchemeController === seat.id &&
                  card(a).faction_code === "pool",
              ),
          ).length;
      break;
    }
    case "deadpool:encounter-44040":
      ports.attach(
        s,
        e.piece,
        s.minions.find((q) => q.code === "44038")?.id || s.villain.id,
      );
      break;
    case "deadpool:encounter-44041": {
      const allies = allInPlay(s).filter(
        (q) =>
          card(q).type_code === "ally" &&
          !s.attachments.some(
            (a) => a.code === "44041" && a.attachedTo === q.id,
          ),
      );
      const max = Math.max(...allies.map((q) => card(q).cost || 0));
      if (!allies.length) {
        ports.discard(s, e.piece.id);
        ports.queue(s, E("surge"));
      } else
        select(
          s,
          "'Pool-ized",
          allies
            .filter((q) => (card(q).cost || 0) === max)
            .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
          D("poolize", { piece: e.piece }),
          ports,
        );
      break;
    }
    case "deadpool:poolize": {
      const q = find(s, e.target),
        owner = controller(s, e.target);
      need(q && owner, "Choose an ally still in play.");
      ports.attach(s, e.piece, q!.id);
      e.piece.controlOrder = s.nextId++;
      q!.deadpoolController = owner!.id;
      q!.treatedAsMinion = true;
      q!.deadpoolMinion = true;
      const v = seatView(s, owner!);
      v.player.inPlay.splice(v.player.inPlay.indexOf(q!), 1);
      q!.engagedWith = owner!.id;
      s.minions.push(q!);
      break;
    }
    case "deadpool:encounter-44042": {
      const amount = s.minions.some((q) => q.code === "44038") ? 3 : 2;
      const ids = [...ports.friendly(s), ...ports.enemies(s, false)]
        .filter((t) => ports.hasTrait(s, t.id, "Deadpool Corps"))
        .map((t) => t.id);
      let dealt = 0;
      for (const id of ids) dealt += ports.damage(s, id, amount, e.piece.id);
      if (!dealt) s.encounter.acceleration++;
      break;
    }
    case "deadpool:dreadpool-dealt": {
      const i = s.encounter.discard.findIndex((q) => q.id === e.piece.id);
      if (i >= 0) {
        const q = s.encounter.discard.splice(i, 1)[0];
        q.damage = 0;
        q.dealtTo = e.playerId;
        s.encounter.dealt.push(q);
      }
      break;
    }
    case "deadpool:nemesis": {
      const reserve = s.player.setAside || [],
        minion = reserve.find((q) => q.code === "44033"),
        scheme = reserve.find((q) => q.code === "44034");
      if (!minion) {
        ports.queue(s, E("surge"));
        break;
      }
      const cards = reserve.filter((q) =>
        ["44033", "44034", "44035", "44036"].includes(q.code),
      );
      s.player.setAside = reserve.filter((q) => !cards.includes(q));
      s.encounter.deck.push(
        ...cards.filter((q) => q !== minion && q !== scheme),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        E("reveal", { piece: minion }),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    case "deadpool:reveal-pay": {
      const q = s.player.hand.find((q) => q.id === e.id);
      need(q, "The interrupt event is unavailable.");
      ports.reaction(
        s,
        q!,
        [D("reveal-cancel", { piece: e.piece, code: q!.code })],
        [],
        [E("reveal", { piece: e.piece, skip: true })],
      );
      break;
    }
    case "deadpool:reveal-cancel":
      ports.cancelReveal(s, e.piece, e.code !== "44005");
      if (e.code === "44005")
        ports.queue(
          s,
          E("damage", {
            target: "hero",
            amount:
              (card(e.piece).boost || 0) + Number(!!card(e.piece).boost_star),
            source: "hero",
          }),
        );
      else {
        for (const key of Object.keys(s.flags))
          if (key.startsWith("deadpoolFront:")) delete s.flags[key];
        delete s.flags.deadpoolOtherDefended;
        const key = `deadpoolFront:${s.nextId++}`;
        s.flags[key] = true;
        s.flags.deadpoolFrontAwaiting = true;
        delete s.flags.deadpoolFrontAttackId;
        ports.queue(
          s,
          E("enemyAttack", { id: s.villain.id }),
          D("front-draw", { playerId: s.activePlayerId }),
        );
      }
      break;
    case "deadpool:negasonic":
      need(p, "Negasonic must still be in play to pay her damage cost.");
      ports.damage(s, p!.id, 2, p!.id);
      ports.cancelReveal(s, e.piece, true);
      break;
    case "deadpool:front-draw":
      delete s.flags.deadpoolFrontAwaiting;
      delete s.flags.deadpoolFrontAttackId;
      for (const key of Object.keys(s.flags))
        if (key.startsWith("deadpoolFront:")) delete s.flags[key];
      if (s.flags.deadpoolOtherDefended) {
        delete s.flags.deadpoolOtherDefended;
        ports.queue(s, E("draw", { amount: 1, actorId: e.playerId }));
      }
      break;
    case "deadpool:damage-pay": {
      const q = s.player.hand.find((q) => q.id === e.id);
      if (q)
        ports.reaction(
          s,
          q,
          e.packet.attackWindow
            ? [
                D("prevent-attack", { amount: deadpoolIconCount(s) }),
                ...e.after,
              ]
            : [
                {
                  ...e.packet,
                  amount: Math.max(0, e.packet.amount - deadpoolIconCount(s)),
                  deadpoolHandled: true,
                },
              ],
          [],
          e.after,
        );
      break;
    }
    case "deadpool:prevent-attack":
      if (s.attack) s.attack.prevented += e.amount;
      break;
    case "deadpool:headpool":
      select(
        s,
        "Headpool",
        ports.enemies(s, false).filter((q) => q.id !== e.id),
        D("headpool-attack", { id: e.id }),
        ports,
      );
      break;
    case "deadpool:headpool-attack":
      ports.attackEnemy(s, e.id, e.target);
      break;
    case "deadpool:threat-pay": {
      const q = s.player.hand.find((q) => q.id === e.id);
      if (q)
        ports.reaction(
          s,
          q,
          [D("threat-target", { packet: e.packet })],
          [],
          [e.packet],
        );
      break;
    }
    case "deadpool:threat-target":
      select(
        s,
        "Not my Responsibility",
        [
          { id: "hero", label: "Your identity" },
          ...s.player.inPlay
            .filter((q) => card(q).type_code === "ally")
            .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        ],
        E("damage", { amount: e.packet.amount, source: "hero" }),
        ports,
      );
      break;
    default:
      throw Error(`Unhandled Deadpool effect: ${e.type}`);
  }
  return true;
}
