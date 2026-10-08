import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { card as nativeCard } from "./cards.js";
import { consumeStatus, statusCards } from "./keywords.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
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
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`valkyrie-pack:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const card = (p: Piece) => cards.get(p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const hasPrintedTrait = (p: Piece, trait: string) =>
  (card(p)?.traits || "").split(/\.\s*/).includes(trait);

export const VALKYRIE_PACK_CORE_ALIASES = [
  "25017",
  "25022",
  "25025",
  "25026",
  "25027",
] as const;
export const VALKYRIE_PACK_SCRIPT_CODES = [
  "25013",
  "25014",
  "25015",
  "25016",
  "25018",
  "25019",
  "25020",
  "25021",
  "25023",
  "25024",
  "25033",
  "25034",
  "25035",
  "25036",
] as const;
export const VALKYRIE_PACK_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const VALKYRIE_PACK_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#valk";

export interface ValkyriePackCharacter extends AntManTarget {
  playerId: string;
  type: "hero" | "alter_ego" | "ally";
  exhausted: boolean;
}
export interface ValkyriePackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  characters(s: GameState): ValkyriePackCharacter[];
  characterThwart(s: GameState, id: string): number;
  exhaustCharacter(s: GameState, id: string): boolean;
  canReady(s: GameState, id: string): boolean;
  canDiscardPiece(s: GameState, p: Piece): boolean;
  discardPiece(s: GameState, id: string): void;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  /** Target-specific ATK bonuses apply only to an actual attack. Smash the
   * Problem and The Best Defense use ordinary ATK with attacking=false. */
  heroAttack(s: GameState, target?: string, attacking?: boolean): number;
  maxHeroHP(s: GameState): number;
  cardCost(s: GameState, p: Piece): number;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
    alliance?: boolean,
  ): boolean;
  revealHidden(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  canPutMinion(s: GameState, p: Piece): boolean;
  /** Native actual-card PUT, not REVEAL; includes engagement and Quickstrike
   * before after. A false result must not move or clone the selected piece. */
  putMinion(
    s: GameState,
    id: string,
    playerId: string,
    after: Effect[],
  ): boolean;
  /** Check actual uniqueness, source restrictions, discounts and affordability
   * for PLAY from the deck, excluding the actual ally from cost resources. */
  canPlayDeckAlly(s: GameState, p: Piece): boolean;
  /** Native paid PLAY from deck, not from hand. Complete after on paid play or
   * payment cancellation so Bifrost's printed shuffle always resolves. */
  playDeckAlly(s: GameState, id: string, after: Effect[]): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  /** One simultaneous thwart attempt against this legal scheme snapshot.
   * Remove every packet before scheme defeats/responses; preserve ordinary
   * Crisis/Patrol limits and hero thwart attribution. Confuse was checked once. */
  thwartBatch(
    s: GameState,
    schemeIds: string[],
    amount: number,
    after: Effect[],
  ): void;
  /** Resolve ONE existing ally attack against these actual minions in order.
   * Preserve one initiating attack and one consequential-damage payment;
   * perform ordered Tough/defeat windows natively, then surviving enemies'
   * Retaliate after this one complete attack (RRG 1.8 p10), before consequence. */
  allyAttackBatch(
    s: GameState,
    allyId: string,
    targetIds: string[],
    after: Effect[],
  ): void;
  /** Persistent for the current attack, recalculated from ordinary ATK after
   * boost effects; do not keep/add DEF-only modifiers or exhaust again. */
  useAttackForDefense(s: GameState): void;
  usesAttackForDefense?(s: GameState): boolean;
  /** Discard exactly one actual status card, including one of two Steady
   * statuses, then synchronize status booleans with native modifiers. */
  discardIdentityStatus(
    s: GameState,
    status: "stunned" | "confused" | "tough",
  ): void;
}

const leadershipEvent = (p: Piece) =>
  card(p)?.type_code === "event" && card(p)?.faction_code === "leadership";
function pairs(
  s: GameState,
  ports: ValkyriePackPorts,
  exhausting: boolean,
): Array<[ValkyriePackCharacter, ValkyriePackCharacter]> {
  const characters = ports
    .characters(s)
    .filter((c) => !exhausting || !c.exhausted);
  return characters
    .filter((c) => ports.hasTrait(s, c.id, "Avenger"))
    .flatMap((a) =>
      characters
        .filter((c) => c.id !== a.id && ports.hasTrait(s, c.id, "Guardian"))
        .map((b) => [a, b] as [ValkyriePackCharacter, ValkyriePackCharacter]),
    );
}

export function valkyriePackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "25016") p.counters = 0;
  if (p.code === "25034") p.counters = 2;
  return [];
}
export function valkyriePackAllyEnter(
  s: GameState,
  p: Piece,
  ports: Pick<ValkyriePackPorts, "isTextBlank"> = { isTextBlank },
): Effect[] | null {
  if (ports.isTextBlank(s, p)) return [];
  if (p.code === "25014")
    return s.minions.some(
      (m) => !m.engagedWith || m.engagedWith === s.activePlayerId,
    )
      ? [
          E("optional", {
            title: "Throg",
            image: p.code,
            text: "Give Throg a tough status card?",
            effects: [P("throg", { id: p.id })],
          }),
        ]
      : [];
  if (p.code === "25015") return [P("angela", { id: p.id })];
  return p.code === "25013" ? [] : null;
}
export function valkyriePackResourcesSpent(
  s: GameState,
  pieces: Piece[],
): Effect[] {
  return s.player.form === "hero"
    ? pieces
        .filter((p) => p.code === "25021")
        .map((p) =>
          E("optional", {
            actorId: s.activePlayerId,
            title: "Audacity",
            image: p.code,
            text: "Deal 1 nonattack damage to the villain?",
            effects: [
              E("damage", {
                target: s.villain.id,
                amount: 1,
                source: "hero",
                abilitySource: p.id,
                sourceCode: p.code,
                attack: false,
              }),
            ],
          }),
        )
    : [];
}
export function valkyriePackMinionDefeated(
  s: GameState,
  sourceIsIdentity: boolean,
  actorId = s.activePlayerId,
  ports: Pick<ValkyriePackPorts, "isTextBlank"> = { isTextBlank },
): Effect[] {
  if (!sourceIsIdentity) return [];
  const view = seatView(s, actorId);
  return view.player.inPlay
    .filter((p) => p.code === "25016" && !ports.isTextBlank(view, p))
    .map((p) =>
      E("optional", {
        actorId,
        title: "Hall of Heroes",
        image: p.code,
        text: "Place 1 glory counter after your identity defeats a minion?",
        effects: [P("glory", { id: p.id, actorId })],
      }),
    );
}

export function valkyriePackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: ValkyriePackPorts,
): string | null {
  const id = `hero:${s.activePlayerId}`;
  if (["25023", "25024"].includes(p.code) && !ports.hasTrait(s, id, "Asgard"))
    return "Your identity must have the Asgard trait.";
  if (p.code === "25020")
    return "The Best Defense is played when your hero defends against an attack.";
  if (
    ["25018", "25019", "25033", "25036"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "This event requires hero form.";
  if (
    p.code === "25018" &&
    !s.player.stunned &&
    !ports.enemyTargets(s, true).length
  )
    return "Quick Strike needs a legal attack target.";
  if (
    p.code === "25019" &&
    (s.player.exhausted ||
      (!s.player.confused &&
        (!ports.schemeTargets(s, true).length ||
          ports.heroAttack(s, undefined, false) <= 0)))
  )
    return "Smash the Problem needs a ready hero and a legal scheme.";
  if (
    p.code === "25033" &&
    (!pairs(s, ports, true).some(
      (pair) =>
        s.player.confused ||
        pair.reduce((n, c) => n + ports.characterThwart(s, c.id), 0) > 0,
    ) ||
      (!s.player.confused && !ports.schemeTargets(s, true).length))
  )
    return "Problem Solvers needs two distinct ready Avenger and Guardian characters and threat.";
  if (
    p.code === "25036" &&
    !pairs(s, ports, false).some((pair) =>
      pair.some((c) => c.exhausted && ports.canReady(s, c.id)),
    )
  )
    return "Cosmic Alliance needs distinct Avenger and Guardian characters, including one that can ready.";
  if (
    p.code === "25024" &&
    s.player.hp >= ports.maxHeroHP(s) &&
    !["stunned", "confused", "tough"].some(
      (status) =>
        statusCards(s.player, status as "stunned" | "confused" | "tough") > 0,
    )
  )
    return "Godlike Stamina needs damage to heal or a status card to discard.";
  return null;
}

export function valkyriePackAbilityOptions(
  s: GameState,
  id: string,
  ports: ValkyriePackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (p.code === "25016" && s.player.form === "alter" && p.counters >= 3)
    return [
      O(
        "hall-of-heroes",
        "Spend 3 glory counters · draw 3",
        [P("hall", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "25034" &&
    s.player.form === "alter" &&
    p.counters > 0 &&
    s.player.discard.some(leadershipEvent)
  )
    return [
      O(
        "leadership-training",
        "Spend 1 training counter · shuffle a Leadership event into deck",
        [P("training", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "25023" &&
    s.player.deck.some(
      (a) =>
        card(a)?.type_code === "ally" &&
        hasPrintedTrait(a, "Asgard") &&
        ports.canPlayDeckAlly(s, a),
    )
  )
    return [
      O(
        "bifrost",
        "Exhaust The Bifrost · search and play an Asgard ally",
        [P("bifrost", { id })],
        p.code,
      ),
    ];
  return [];
}
export function valkyriePackAbility(
  s: GameState,
  id: string,
  ports: ValkyriePackPorts,
  action?: string,
): boolean {
  const choices = valkyriePackAbilityOptions(s, id, ports);
  if (!choices.length) return false;
  const choice = action ? choices.find((o) => o.id === action) : choices[0];
  need(choice, "This supplementary action is unavailable.");
  ports.queue(s, ...choice!.effects);
  return true;
}

export function valkyriePackBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return ["25019", "25033"].includes(p.code)
    ? [P("event-cost", { piece: p, after })]
    : null;
}
export function valkyriePackEvent(
  _s: GameState,
  p: Piece,
  receipt: { amount?: number } = {},
): Effect[] | null {
  if (p.code === "25018") return [P("quick-strike", { id: p.id })];
  if (p.code === "25019") return [P("smash", { amount: receipt.amount || 0 })];
  if (p.code === "25033")
    return [P("problem-solvers", { amount: receipt.amount || 0 })];
  if (p.code === "25036") return [P("cosmic-alliance")];
  if (p.code === "25024")
    return [E("heal", { target: "hero", amount: 2 }), P("stamina")];
  return p.code === "25020" ? [] : null;
}
export function valkyriePackDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: ValkyriePackPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    !s.attack ||
    s.attack.defender !== "hero" ||
    ports.usesAttackForDefense?.(s)
  )
    return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "25020" &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "The Best Defense · use ATK instead of DEF",
        [P("defense-pay", { id: p.id, attacker: s.attack!.attacker, after })],
        p.code,
      ),
    );
}
export function valkyriePackEngagementOptions(
  s: GameState,
  minionId: string,
  after: Effect[],
  ports: ValkyriePackPorts,
): Option[] {
  const id = `hero:${s.activePlayerId}`;
  if (s.player.form !== "hero" || !s.player.exhausted || !ports.canReady(s, id))
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === "25035" &&
        !ports.isTextBlank(s, p) &&
        ports.canDiscardPiece(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Anticipation · discard to ready your hero",
        [P("anticipation", { id: p.id, minionId, after })],
        p.code,
      ),
    );
}
export function valkyriePackAllyAttackOptions(
  s: GameState,
  ally: Piece,
  target: string,
  after: Effect[],
  ports: ValkyriePackPorts,
): Option[] {
  const minion = s.minions.find((p) => p.id === target);
  if (
    ally.code !== "25013" ||
    ports.isTextBlank(s, ally) ||
    !own(s, ally.id) ||
    !minion ||
    !ports.canPay(s, 1, ["energy"])
  )
    return [];
  return [
    O(
      "thor-attack-each",
      "Thor · spend energy to attack every minion engaged with that player",
      [
        P("thor-pay", {
          id: ally.id,
          target,
          playerId: minion.engagedWith || s.activePlayerId,
          after,
        }),
      ],
      ally.code,
    ),
  ];
}

const costReceipt = (after: Effect[], amount: number) =>
  after.map((e) => ({
    ...e,
    valkyriePackCostPaid: true,
    valkyriePackReceipt: { amount },
  }));
function targetChoice(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: ValkyriePackPorts,
) {
  if (!targets.length) {
    ports.queue(s, ...(effect.after || []));
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
  );
}

export function resolveValkyriePackEffect(
  s: GameState,
  e: Effect,
  ports: ValkyriePackPorts,
): boolean {
  if (!e.type.startsWith("valkyrie-pack:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "valkyrie-pack:throg": {
      const p = own(s, e.id, "25014");
      if (
        p &&
        !ports.isTextBlank(s, p) &&
        s.minions.some(
          (m) => !m.engagedWith || m.engagedWith === s.activePlayerId,
        )
      )
        ports.queue(
          s,
          E("status", { target: p.id, status: "tough" }),
          ...after,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "valkyrie-pack:angela": {
      const p = own(s, e.id, "25015");
      if (!p || ports.isTextBlank(s, p)) {
        ports.queue(s, ...after);
        break;
      }
      ports.revealHidden(s);
      const searched = s.encounter.deck.slice(0, 10),
        found = searched.filter(
          (m) => card(m)?.type_code === "minion" && ports.canPutMinion(s, m),
        );
      if (!found.length) {
        ports.shuffleEncounter(s);
        ports.discardPiece(s, p.id);
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Angela",
        "Choose an actual minion in the top 10 cards to put into play.",
        [
          ...found.map((m) =>
            O(
              m.id,
              card(m).name,
              [
                P("angela-minion", {
                  id: p.id,
                  minionId: m.id,
                  searched: searched.map((a) => a.id),
                  after,
                }),
              ],
              m.code,
            ),
          ),
          O("none", "Find no minion; discard Angela", [
            P("angela-none", { id: p.id, after }),
          ]),
        ],
      );
      break;
    }
    case "valkyrie-pack:angela-none":
      ports.shuffleEncounter(s);
      ports.discardPiece(s, e.id);
      ports.queue(s, ...after);
      break;
    case "valkyrie-pack:angela-minion": {
      const p = own(s, e.id, "25015"),
        minion = s.encounter.deck.find(
          (m) =>
            m.id === e.minionId &&
            e.searched.includes(m.id) &&
            card(m)?.type_code === "minion" &&
            ports.canPutMinion(s, m),
        );
      need(p && minion, "Angela needs her actual searched minion.");
      const entered = ports.putMinion(s, minion!.id, s.activePlayerId, after);
      ports.shuffleEncounter(s);
      if (!entered) {
        ports.discardPiece(s, p!.id);
        ports.queue(s, ...after);
      }
      break;
    }
    case "valkyrie-pack:glory": {
      const p = own(s, e.id, "25016");
      if (p && !ports.isTextBlank(s, p)) p.counters++;
      ports.queue(s, ...after);
      break;
    }
    case "valkyrie-pack:hall": {
      need(
        valkyriePackAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "hall-of-heroes",
        ),
        "Hall of Heroes needs ready state, alter-ego and 3 glory counters.",
      );
      const p = own(s, e.id, "25016")!;
      p.exhausted = true;
      p.counters -= 3;
      ports.queue(s, E("draw", { amount: 3 }), ...after);
      break;
    }
    case "valkyrie-pack:training": {
      need(
        valkyriePackAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "leadership-training",
        ),
        "Leadership Training is unavailable.",
      );
      ports.choose(
        s,
        "Leadership Training",
        "Choose an actual Leadership event in your discard pile.",
        s.player.discard
          .filter(leadershipEvent)
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [P("training-card", { id: e.id, cardId: p.id, after })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "valkyrie-pack:training-card": {
      const p = own(s, e.id, "25034"),
        index = s.player.discard.findIndex(
          (p) => p.id === e.cardId && leadershipEvent(p),
        );
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          p.counters > 0 &&
          s.player.form === "alter" &&
          index >= 0,
        "Leadership Training cannot pay its actual cost.",
      );
      p!.exhausted = true;
      p!.counters--;
      const actual = s.player.discard.splice(index, 1)[0];
      if (!p!.counters) ports.discardPiece(s, p!.id);
      s.player.deck.push(actual);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "valkyrie-pack:bifrost": {
      need(
        valkyriePackAbilityOptions(s, e.id, ports).some(
          (o) => o.id === "bifrost",
        ),
        "The Bifrost has no legal payable Asgard ally.",
      );
      const p = own(s, e.id, "25023")!;
      p.exhausted = true;
      ports.revealHidden(s);
      const found = s.player.deck.filter(
        (p) =>
          card(p)?.type_code === "ally" &&
          hasPrintedTrait(p, "Asgard") &&
          ports.canPlayDeckAlly(s, p),
      );
      ports.choose(
        s,
        "The Bifrost",
        "Play an actual searched Asgard ally from your deck, paying its cost.",
        [
          ...found.map((p) =>
            O(
              p.id,
              card(p).name,
              [P("bifrost-card", { id: p.id, after })],
              p.code,
            ),
          ),
          O("none", "Find no ally; shuffle deck", [
            P("shuffle-player", { after }),
          ]),
        ],
      );
      break;
    }
    case "valkyrie-pack:bifrost-card": {
      const p = s.player.deck.find(
        (p) =>
          p.id === e.id &&
          card(p)?.type_code === "ally" &&
          hasPrintedTrait(p, "Asgard") &&
          ports.canPlayDeckAlly(s, p),
      );
      need(p, "The Bifrost needs its actual playable Asgard ally in the deck.");
      ports.playDeckAlly(s, p!.id, [P("shuffle-player", { after })]);
      break;
    }
    case "valkyrie-pack:shuffle-player":
      ports.shufflePlayerDeck(s, after);
      break;
    case "valkyrie-pack:event-cost": {
      const p: Piece = e.piece;
      if (p.code === "25019") {
        need(
          s.player.form === "hero" && !s.player.exhausted,
          "Smash the Problem requires exhausting your ready hero.",
        );
        need(
          ports.exhaustCharacter(s, `hero:${s.activePlayerId}`),
          "Cannot exhaust your hero.",
        );
        const amount = ports.heroAttack(s, undefined, false);
        ports.queue(s, ...costReceipt(after, amount));
      } else if (p.code === "25033") {
        const choices = pairs(s, ports, true).filter(
          (pair) =>
            s.player.confused ||
            pair.reduce((n, c) => n + ports.characterThwart(s, c.id), 0) > 0,
        );
        need(
          s.player.form === "hero" && choices.length,
          "Problem Solvers requires distinct ready Avenger and Guardian characters.",
        );
        ports.choose(
          s,
          "Problem Solvers · additional cost",
          "Exhaust two distinct ready characters. Alliance permits other players to contribute.",
          choices.map(([a, b]) =>
            O(
              `${a.id}|${b.id}`,
              `${a.label} (Avenger) + ${b.label} (Guardian)`,
              [P("problem-cost", { ids: [a.id, b.id], after })],
            ),
          ),
        );
      }
      break;
    }
    case "valkyrie-pack:problem-cost": {
      const pair = pairs(s, ports, true).find(
        ([a, b]) => a.id === e.ids?.[0] && b.id === e.ids?.[1],
      );
      need(
        pair,
        "Problem Solvers needs its two distinct ready cost characters.",
      );
      need(
        ports.exhaustCharacter(s, pair![0].id) &&
          ports.exhaustCharacter(s, pair![1].id),
        "Cannot exhaust both Alliance characters.",
      );
      const amount = pair!.reduce(
        (n, c) => n + ports.characterThwart(s, c.id),
        0,
      );
      ports.queue(s, ...costReceipt(after, amount));
      break;
    }
    case "valkyrie-pack:quick-strike": {
      if (consumeStatus(s.player, "stunned")) {
        ports.queue(s, ...after);
        break;
      }
      targetChoice(
        s,
        "Quick Strike",
        ports.enemyTargets(s, true),
        P("quick-strike-target", { id: e.id, after }),
        ports,
      );
      break;
    }
    case "valkyrie-pack:quick-strike-target": {
      need(
        ports.enemyTargets(s, true).some((t) => t.id === e.target),
        "Quick Strike's attack target is unavailable.",
      );
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: ports.heroAttack(s, e.target, true),
            source: "hero",
            attack: true,
            attackInitiated: true,
            abilitySource: e.id,
          }),
        ],
        after,
      );
      break;
    }
    case "valkyrie-pack:smash": {
      if (consumeStatus(s.player, "confused")) {
        ports.queue(s, ...after);
        break;
      }
      targetChoice(
        s,
        "Smash the Problem",
        ports.schemeTargets(s, true),
        P("smash-target", { amount: e.amount, after }),
        ports,
      );
      break;
    }
    case "valkyrie-pack:smash-target": {
      need(
        ports.schemeTargets(s, true).some((t) => t.id === e.target),
        "Smash the Problem's thwart target is unavailable.",
      );
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: e.amount,
          source: "hero",
          action: true,
          basic: false,
          thwartInitiated: true,
        }),
        ...after,
      );
      break;
    }
    case "valkyrie-pack:problem-solvers": {
      if (consumeStatus(s.player, "confused")) {
        ports.queue(s, ...after);
        break;
      }
      // One actual thwart attempt, removing the snapshotted combined THW from
      // each legal scheme. Crisis/Patrol remain active native target limits.
      const targets = ports.schemeTargets(s, true);
      ports.thwartBatch(
        s,
        targets.map((t) => t.id),
        e.amount,
        after,
      );
      break;
    }
    case "valkyrie-pack:cosmic-alliance": {
      const choices = pairs(s, ports, false).filter((pair) =>
        pair.some((c) => c.exhausted && ports.canReady(s, c.id)),
      );
      if (!choices.length) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        "Cosmic Alliance",
        "Choose distinct Avenger and Guardian characters to ready.",
        choices.map(([a, b]) =>
          O(`${a.id}|${b.id}`, `${a.label} + ${b.label}`, [
            P("cosmic-ready", { ids: [a.id, b.id], after }),
          ]),
        ),
      );
      break;
    }
    case "valkyrie-pack:cosmic-ready": {
      const pair = pairs(s, ports, false).find(
        ([a, b]) => a.id === e.ids?.[0] && b.id === e.ids?.[1],
      );
      need(
        pair,
        "Cosmic Alliance requires its two distinct trait-qualified characters.",
      );
      ports.queue(
        s,
        ...pair!
          .filter((c) => c.exhausted && ports.canReady(s, c.id))
          .map((c) => E("ready", { target: c.id })),
        ...after,
      );
      break;
    }
    case "valkyrie-pack:stamina": {
      const statuses = (["stunned", "confused", "tough"] as const).filter(
        (status) => statusCards(s.player, status) > 0,
      );
      if (statuses.length)
        ports.choose(
          s,
          "Godlike Stamina",
          "You may discard one status card from your identity.",
          [
            ...statuses.map((status) =>
              O(status, `Discard one ${status} status card`, [
                P("stamina-status", { status, after }),
              ]),
            ),
            O("none", "Keep status cards", after),
          ],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "valkyrie-pack:stamina-status":
      need(
        ["stunned", "confused", "tough"].includes(e.status) &&
          statusCards(s.player, e.status) > 0,
        "Choose an actual status card on your identity.",
      );
      ports.discardIdentityStatus(s, e.status);
      ports.queue(s, ...after);
      break;
    case "valkyrie-pack:defense-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "25020");
      need(
        p &&
          valkyriePackDefenseOptions(s, after, ports).some(
            (o) => o.id === p.id,
          ),
        "The Best Defense is unavailable.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "The Best Defense…",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [P("best-defense", { attacker: e.attacker })],
              continuation: after,
            }),
          ],
        }),
      );
      break;
    }
    case "valkyrie-pack:best-defense":
      if (
        s.attack &&
        s.attack.attacker === e.attacker &&
        s.attack.defender === "hero" &&
        s.player.form === "hero"
      )
        ports.useAttackForDefense(s);
      ports.queue(s, ...after);
      break;
    case "valkyrie-pack:anticipation": {
      const p = own(s, e.id, "25035");
      need(
        p &&
          s.player.form === "hero" &&
          s.player.exhausted &&
          ports.canReady(s, `hero:${s.activePlayerId}`) &&
          !ports.isTextBlank(s, p) &&
          ports.canDiscardPiece(s, p),
        "Anticipation cannot pay its discard cost or ready your hero.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        E("ready", { target: `hero:${s.activePlayerId}` }),
        ...after,
      );
      break;
    }
    case "valkyrie-pack:thor-pay": {
      const p = own(s, e.id, "25013");
      need(
        p && !ports.isTextBlank(s, p) && ports.canPay(s, 1, ["energy"]),
        "Thor cannot spend the required energy resource.",
      );
      const ids = s.minions
        .filter((m) => (m.engagedWith || s.activePlayerId) === e.playerId)
        .map((m) => m.id);
      ports.queue(
        s,
        E("payRequest", {
          title: "Thor · attack each engaged minion",
          cost: 1,
          requirements: ["energy"],
          abilityCost: true,
          piece: p,
          targetCode: p!.code,
          cancelable: false,
          after: [
            P("thor-order", { id: p!.id, remaining: ids, ordered: [], after }),
          ],
        }),
      );
      break;
    }
    case "valkyrie-pack:thor-order": {
      const p = own(s, e.id, "25013"),
        remaining: string[] = e.remaining.filter((id: string) =>
          s.minions.some((m) => m.id === id),
        );
      if (!p) {
        ports.queue(s, ...after);
        break;
      }
      if (!remaining.length) {
        ports.allyAttackBatch(s, p.id, e.ordered, after);
        break;
      }
      ports.choose(
        s,
        "Thor · attack order",
        "Choose the next minion for this single attack.",
        remaining.map((id) => {
          const m = s.minions.find((m) => m.id === id)!;
          return O(
            id,
            (cards.get(m.code) || nativeCard(m)).name,
            [
              P("thor-order", {
                id: p.id,
                remaining: remaining.filter((x) => x !== id),
                ordered: [...e.ordered, id],
                after,
              }),
            ],
            m.code,
          );
        }),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}
