import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece, Prompt } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const N = (kind: string, args: Record<string, unknown> = {}) =>
  E(`nick:${kind}`, { ...args, type: `nick:${kind}` });
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const active = (s: GameState) => s.heroId === "nick_fury";
const hero = (s: GameState) => s.player.form === "hero";
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter(
    (p) =>
      p.code === code && !isTextBlank(s, p) && !deadpoolTriggeredBlocked(s),
  );
const trait = (p: Piece, name: string) =>
  (card(p).traits || "")
    .replace(/\.$/, "")
    .split(/\.\s+/)
    .some((t) => t.toLowerCase() === name.replace(/\.$/, "").toLowerCase());
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const suitCard = (p: Piece) => ["50035a", "50035b"].includes(p.code);
export const NICK_FURY_SCRIPT_CODES = [
  "50024",
  "50034a",
  "50034b",
  "50035a",
  "50035b",
  ...Array.from({ length: 28 }, (_, i) => String(50036 + i)),
];
export interface NickTarget {
  id: string;
  label: string;
  code?: string;
}
export interface NickFuryPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  enemies(s: GameState, attack: boolean): NickTarget[];
  schemes(s: GameState, thwart: boolean): NickTarget[];
  characters(s: GameState): NickTarget[];
  canReady(s: GameState): boolean;
  canStatus(
    s: GameState,
    id: string,
    status: "tough" | "stunned" | "confused",
  ): boolean;
  maxHP(s: GameState): number;
  discard(s: GameState, id: string): void;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  revealHidden(s: GameState): void;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  cancelReveal(s: GameState, p: Piece): void;
  prevent(s: GameState, window: any, amount: number): void;
  preparationsResolved(s: GameState, p: Piece, after: Effect[]): Effect[];
  changeForm(s: GameState, from: string, to: string): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  changeCounters(s: GameState, p: Piece, amount: number): void;
}
export const nickFurySuit = (s: GameState) =>
  active(s) ? s.player.inPlay.find(suitCard) : undefined;
export function nickFuryInitialize(
  s: GameState,
  make: NickFuryPorts["makePiece"],
) {
  if (!active(s) || s.flags.nickInitialized) return;
  let suit = s.player.deck.find(suitCard);
  if (suit) s.player.deck.splice(s.player.deck.indexOf(suit), 1);
  else suit = make(s, "50035a");
  suit.ownerId = s.activePlayerId;
  suit.code = "50035a";
  s.player.inPlay.push(suit);
  for (const code of ["50060", "50061", "50062", "50062", "50063"])
    (s.player.setAside ||= []).push(make(s, code));
  s.flags.nickInitialized = true;
}
export function nickFuryChangeSuit(
  s: GameState,
  form: "assault" | "stealth",
  ports: NickFuryPorts,
) {
  const p = nickFurySuit(s);
  need(p, "Nick Fury's physical suit is not in play.");
  const code = form === "assault" ? "50035a" : "50035b";
  if (p!.code === code) return;
  const from = p!.code;
  p!.code = code;
  ports.changeForm(s, from, code);
}
export function nickFuryAerial(s: GameState) {
  return active(s) && s.flags.nickAerialRound === s.round;
}
export function nickFuryCostReduction(
  s: GameState,
  p: Piece | { code: string },
  hasTrait: NickFuryPorts["hasTrait"],
) {
  return ["50055", "50056"].includes(p.code) &&
    hasTrait(s, "hero", "S.H.I.E.L.D.")
    ? 2
    : 0;
}
export function nickFuryResourceSources(
  s: GameState,
  target?: string,
): PaymentSource[] {
  const out: PaymentSource[] = [];
  const suit = nickFurySuit(s);
  for (const p of live(s, "50044").filter((p) => !p.exhausted)) {
    const count = Math.min(suit?.counters || 0, 2);
    const chosen =
      s.prompt?.kind === "payment"
        ? s.prompt.nickWatchSelections?.[p.id]
        : undefined;
    if (count)
      out.push({
        id: p.id,
        code: p.code,
        name: card(p).name,
        kind: "ability",
        resources: Array(chosen ?? count).fill("mental"),
        description: "Exhaust and remove up to 2 suit threat · 1 mental each",
      });
  }
  if (target && (card(target).traits || "").split(/\.\s*/).includes("Tech"))
    for (const p of live(s, "50055").filter((p) => !p.exhausted))
      out.push({
        id: p.id,
        code: p.code,
        name: card(p).name,
        kind: "ability",
        resources: ["mental"],
        description: "Exhaust · 1 mental for a Tech card",
      });
  return out;
}
export function nickFuryWatchPreflight(
  s: GameState,
  p: Prompt,
  ids: string[],
  wildAs: string,
  ports: NickFuryPorts,
) {
  const watch = live(s, "50044").find(
    (q) =>
      ids.includes(q.id) &&
      !q.exhausted &&
      (nickFurySuit(s)?.counters || 0) > 0 &&
      p.nickWatchSelections?.[q.id] === undefined,
  );
  if (!watch) return false;
  const count = Math.min(2, nickFurySuit(s)?.counters || 0);
  ports.choose(
    s,
    "Fury's Watch",
    "Choose how much suit threat to remove when this payment commits.",
    Array.from({ length: count }, (_, i) =>
      O(
        String(i + 1),
        `Remove ${i + 1} threat · ${i + 1} mental`,
        [
          E("commitPaymentAllocation", {
            payment: {
              ...p,
              nickWatchSelections: {
                ...p.nickWatchSelections,
                [watch.id]: i + 1,
              },
            },
            ids,
            wildAs,
          }),
        ],
        watch.code,
      ),
    ),
  );
  if (s.prompt) {
    s.prompt.cancelable = true;
    s.prompt.cancellationQueue = [
      E("restorePaymentPrompt", { payment: p, queue: [...s.queue] }),
    ];
  }
  return true;
}
export function nickFurySpendResource(s: GameState, id: string) {
  const p = own(s, id);
  if (!p || !["50044", "50055"].includes(p.code)) return false;
  need(
    !p.exhausted && !isTextBlank(s, p),
    "This resource source must remain ready and unblanked.",
  );
  if (p.code === "50044") {
    const suit = nickFurySuit(s),
      count =
        s.prompt?.nickWatchSelections?.[id] ?? Math.min(2, suit?.counters || 0);
    need(
      suit && count > 0 && suit.counters >= count,
      "Fury's Watch requires that much actual suit threat.",
    );
    suit!.counters -= count;
  }
  p.exhausted = true;
  return true;
}
export function nickFuryAbilityOptions(
  s: GameState,
  id: string,
  ports: NickFuryPorts,
): Option[] {
  const suit = nickFurySuit(s);
  if (["identity", "hero"].includes(id))
    return active(s) &&
      !hero(s) &&
      suit?.code !== "50035b" &&
      !isTextBlank(s, "50034b")
      ? [
          O(
            "infiltrate",
            "Infiltrate · change to Stealth suit",
            [N("form", { form: "stealth" })],
            "50034b",
          ),
        ]
      : [];
  const p = own(s, id);
  if (!p || p.exhausted || isTextBlank(s, p)) return [];
  if (
    p.code === "50040" &&
    hero(s) &&
    s.player.exhausted &&
    ports.canReady(s) &&
    suit?.counters
  )
    return [
      O(
        "flying-car",
        "Fury's Flying Car · remove 1 suit threat and ready Nick Fury",
        [N("car", { id })],
        p.code,
      ),
    ];
  if (p.code === "50041" && !hero(s) && (s.player.hp < ports.maxHP(s) || suit))
    return [
      O(
        "safe-house",
        "Safe House #221 · heal or add suit threat",
        [N("safe", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "50056" &&
    !hero(s) &&
    s.player.deck.some((p) => trait(p, "Tech"))
  )
    return [
      O(
        "leo-fitz",
        "Leo Fitz · search the deck for Tech",
        [N("fitz", { id })],
        p.code,
      ),
    ];
  return [];
}
export function nickFuryAttackWindow(
  s: GameState,
  packet: Effect,
  ports: NickFuryPorts,
): Effect[] | null {
  if (
    !active(s) ||
    packet.nickAssaultHandled ||
    s.player.stunned ||
    (packet.source &&
      !["hero", `hero:${s.activePlayerId}`].includes(packet.source))
  )
    return null;
  const suit = nickFurySuit(s);
  if (!suit) return null;
  const continuation: Effect = { ...packet, nickAssaultHandled: true };
  if (
    hero(s) &&
    !isTextBlank(s, "50034a") &&
    !deadpoolTriggeredBlocked(s) &&
    !packet.nickBreakCoverHandled &&
    suit.code !== "50035a"
  ) {
    const before = new Set(s.queue);
    nickFuryChangeSuit(s, "assault", ports);
    const responses = s.queue.filter((e) => !before.has(e));
    s.queue = s.queue.filter((e) => before.has(e));
    return [...responses, { ...packet, nickBreakCoverHandled: true }];
  }
  if (
    suit.code !== "50035a" ||
    isTextBlank(s, suit) ||
    deadpoolTriggeredBlocked(s) ||
    suit.counters <= 0
  )
    return [continuation];
  const token =
    s.currentAttackProgramId ||
    s.currentEventId ||
    packet.nickAttackToken ||
    `nick-attack:${s.nextId++}`;
  if (s.flags[`nickAssault:${token}`] !== undefined)
    return [
      {
        ...continuation,
        amount:
          Number(continuation.amount || 0) +
          Number(s.flags[`nickAssault:${token}`]),
        nickAssaultBonus: true,
      },
    ];
  return [N("assault", { packet: continuation, token })];
}
export function nickFuryGatherOptions(s: GameState, snapshot: any): Option[] {
  return active(s) &&
    hero(s) &&
    !deadpoolTriggeredBlocked(s) &&
    snapshot.basic &&
    !isTextBlank(s, "50034a") &&
    nickFurySuit(s)
    ? [
        O(
          "gather-intel",
          "Gather Intel · place 1 threat on your suit",
          [N("add-threat", { amount: 1 })],
          "50034a",
        ),
      ]
    : [];
}
export function nickFuryStealth(s: GameState) {
  const p = nickFurySuit(s);
  return (
    hero(s) &&
    p?.code === "50035b" &&
    !isTextBlank(s, p) &&
    !deadpoolTriggeredBlocked(s)
  );
}
export function nickFuryPlayRestriction(
  s: GameState,
  p: Piece,
  ports: NickFuryPorts,
): string | null {
  if (
    ["50050", "50051", "50052", "50058"].includes(p.code) &&
    s.player.inPlay.some((q) => q.code === p.code)
  )
    return "Max 1 per player.";
  if (p.code === "50024") {
    const names = playerOrder(s).map((seat) => ({
      heroId: seat.heroId,
      form: seatView(s, seat).player.form,
    }));
    const allies = allInPlay(s)
      .filter((q) => card(q).type_code === "ally")
      .map((q) => card(q).name);
    if (
      !["maria_hill", "nick_fury"].every(
        (h) =>
          names.some((x) => x.heroId === h) ||
          allies.includes(h === "maria_hill" ? "Maria Hill" : "Nick Fury"),
      ) ||
      !(
        ["maria_hill", "nick_fury"].includes(s.heroId) ||
        s.player.inPlay.some((q) =>
          ["Maria Hill", "Nick Fury"].includes(card(q).name),
        )
      )
    )
      return "Super Spies requires Maria Hill and Nick Fury in play, and you must control one.";
    if (
      !allInPlay(s).some(
        (p) =>
          suitCard(p) ||
          (card(p).type_code === "support" &&
            ports.hasTrait(s, p.id, "S.H.I.E.L.D.")),
      )
    )
      return "Super Spies needs a S.H.I.E.L.D. support or suit form upgrade.";
  }
  return null;
}
export function nickFuryEvent(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "50024") return [N("super-spies", { remaining: 3 })];
  if (p.code === "50037")
    return [
      E("target", {
        title: "Concentrated Fire",
        group: "enemy",
        action: N("concentrated", { attack: true, source: "hero" }),
      }),
    ];
  if (p.code === "50038")
    return [
      E("target", {
        title: "Covert Surveillance",
        group: "scheme",
        action: E("thwart", {
          amount: 2,
          action: true,
          source: "hero",
          afterResolved: [
            N("covert", { wasStealth: nickFurySuit(s)?.code === "50035b" }),
          ],
        }),
      }),
    ];
  if (p.code === "50039") return [N("spray-player")];
  return null;
}
const prepOption = (
  p: Piece,
  kind: string,
  args: Record<string, unknown>,
  after: Effect[] = [],
) =>
  O(
    p.id,
    card(p).name,
    [N("prep", { id: p.id, kind, ...args, after })],
    p.code,
  );
export function nickFuryDamageOptions(
  s: GameState,
  window: any,
  after: Effect[],
): Option[] {
  return window.amount > 0 && window.attack === true && !s.player.tough
    ? live(s, "50042").map((p) => prepOption(p, "em", { window }, after))
    : [];
}
export function nickFuryThreatOptions(s: GameState, packet: Effect): Option[] {
  return hero(s) &&
    packet.target === "main" &&
    packet.amount > 0 &&
    nickFurySuit(s)
    ? live(s, "50043").map((p) => prepOption(p, "camera", { packet }, []))
    : [];
}
export function nickFuryRevealOptions(s: GameState, p: Piece): Option[] {
  return card(p).type_code === "treachery" &&
    (nickFurySuit(s)?.counters || 0) > 0
    ? live(s, "50045").map((q) => prepOption(q, "analysis", { piece: p }, []))
    : [];
}
export function nickFuryMinionOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: NickFuryPorts,
): Option[] {
  return hero(s) && ports.enemies(s, true).some((t) => t.id === p.id)
    ? live(s, "50052").map((q) =>
        prepOption(q, "prism", { target: p.id }, after),
      )
    : [];
}
export function nickFurySchemeOptions(
  s: GameState,
  id: string,
  after: Effect[],
): Option[] {
  return s.minions.some((p) => p.id === id)
    ? live(s, "50050").map((p) =>
        prepOption(p, "informant", { target: id }, after),
      )
    : [];
}
export function nickFuryDealt(s: GameState): Effect[] {
  return playerOrder(s).flatMap((seat) =>
    live(seatView(s, seat), "50051")
      .filter(() => !deadpoolTriggeredBlocked(seatView(s, seat)))
      .map((p) =>
        E("optional", {
          actorId: seat.id,
          nickDealtResponse: true,
          title: "Intelligence",
          text: "Discard Intelligence to inspect and swap dealt encounters and the encounter deck's top card?",
          effects: [N("prep", { id: p.id, kind: "intelligence", after: [] })],
        }),
      ),
  );
}
export function nickFuryPreparationResolved(
  s: GameState,
  p: Piece,
  after: Effect[] = [],
): Effect[] {
  return trait(p, "Preparation")
    ? [N("after-prep", { after, used: [] })]
    : after;
}
export function nickFuryPracticedPlan(
  s: GameState,
  p: Piece,
  after: Effect[] = [],
): Effect[] {
  return trait(p, "Preparation") &&
    p.ownerId === s.activePlayerId &&
    s.player.discard.some((q) => q.id === p.id)
    ? [N("practiced", { discarded: p.id, after })]
    : after;
}
export function nickFuryAllyEntered(
  s: GameState,
  p: Piece,
  ports: NickFuryPorts,
): Effect[] | null {
  if (p.code !== "50054") return null;
  if (deadpoolTriggeredBlocked(s)) return [];
  return [N("senior", { id: p.id })];
}
export function nickFuryRoundEnded(s: GameState): Effect[] {
  return live(s, "50054").map((p) => E("discardPiece", { id: p.id }));
}
export function nickFuryDamaged(
  s: GameState,
  p: Piece | undefined,
  actual: number,
  target: string,
): Effect[] {
  if (actual <= 0) return [];
  const out: Effect[] = [];
  if (p?.code === "50060" && !isTextBlank(s, p))
    out.push(E("status", { target: p.id, status: "tough" }));
  if (
    target === "hero" &&
    active(s) &&
    s.sideSchemes.some((q) => q.code === "50061" && !isTextBlank(s, q))
  )
    out.push(N("formula"));
  return out;
}
export function nickFuryEncounter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "50059") return [N("discovered", { piece: p })];
  if (p.code === "50063") return [N("cold", { piece: p })];
  return ["50060", "50061", "50062"].includes(p.code) ? [] : null;
}
export function nickFuryShadows(s: GameState): Effect[] | null {
  return active(s) ? [N("shadows")] : null;
}
export function resolveNickFuryEffect(
  s: GameState,
  e: Effect,
  ports: NickFuryPorts,
): boolean {
  if (!e.type.startsWith("nick:")) return false;
  const kind = e.type.slice(5);
  switch (kind) {
    case "form":
      nickFuryChangeSuit(s, e.form, ports);
      break;
    case "add-threat": {
      const p = nickFurySuit(s);
      if (p) p.counters += e.amount;
      break;
    }
    case "assault": {
      const p = nickFurySuit(s);
      const count = Math.min(3, p?.counters || 0);
      ports.choose(
        s,
        "Assault",
        "Remove up to 3 suit threat to increase this attack's damage.",
        Array.from({ length: count + 1 }, (_, i) =>
          O(
            String(i),
            `Remove ${i} threat · +${i} damage`,
            [N("assault-paid", { ...e, type: undefined, count: i })],
            "50035a",
          ),
        ),
      );
      break;
    }
    case "assault-paid": {
      const p = nickFurySuit(s);
      need(
        p && p.code === "50035a" && p.counters >= e.count,
        "This Assault cost is unavailable.",
      );
      p!.counters -= e.count;
      s.flags[`nickAssault:${e.token}`] = e.count;
      ports.queue(s, {
        ...e.packet,
        amount: Number(e.packet.amount || 0) + e.count,
        nickAssaultBonus: true,
      });
      break;
    }
    case "car": {
      const p = own(s, e.id, "50040"),
        suit = nickFurySuit(s);
      need(
        p &&
          !p.exhausted &&
          suit &&
          suit.counters > 0 &&
          s.player.exhausted &&
          ports.canReady(s),
        "The Flying Car requires suit threat and an exhausted Nick Fury.",
      );
      p!.exhausted = true;
      suit!.counters--;
      s.flags.nickAerialRound = s.round;
      ports.queue(s, E("ready", { id: "hero" }));
      break;
    }
    case "safe": {
      const p = own(s, e.id, "50041");
      need(
        p && !p.exhausted && !hero(s),
        "Safe House requires alter-ego form and must be ready.",
      );
      p!.exhausted = true;
      ports.choose(s, "Safe House #221", "Choose one.", [
        ...(s.player.hp < ports.maxHP(s)
          ? [
              O("heal", "Heal 2 damage", [
                E("heal", { target: "hero", amount: 2 }),
              ]),
            ]
          : []),
        ...(nickFurySuit(s)
          ? [
              O("threat", "Place 1 suit threat", [
                N("add-threat", { amount: 1 }),
              ]),
            ]
          : []),
      ]);
      break;
    }
    case "fitz": {
      const p = own(s, e.id, "50056");
      need(
        p && !p.exhausted && !hero(s),
        "Leo Fitz requires alter-ego form and must be ready.",
      );
      p!.exhausted = true;
      ports.queue(s, N("search-tech"));
      break;
    }
    case "search-tech":
      ports.choose(s, "Leo Fitz", "Search your deck for a Tech card.", [
        ...s.player.deck
          .filter((p) => trait(p, "Tech"))
          .map((p) =>
            O(p.id, card(p).name, [N("take-tech", { id: p.id })], p.code),
          ),
        O("none", "Finish the search", [N("shuffle")]),
      ]);
      break;
    case "take-tech": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shuffle(s);
      break;
    }
    case "shuffle":
      ports.shuffle(s);
      break;
    case "concentrated": {
      const p = ports.find(s, e.target);
      if (!p) break;
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: 4,
          attack: true,
          source: "hero",
          ranged: true,
          afterResolved: [
            N("concentrated-after", {
              target: e.target,
              printedSCH: card(p).scheme || 0,
              code: p.code,
              stage: e.target === s.villain.id ? s.villain.stage : undefined,
            }),
          ],
        }),
      );
      break;
    }
    case "concentrated-after": {
      const p = ports.find(s, e.target);
      if (
        p &&
        p.code === e.code &&
        (e.stage === undefined || e.stage === s.villain.stage)
      )
        break;
      ports.choose(
        s,
        "Concentrated Fire",
        "The attack defeated its enemy. Choose one.",
        [
          O("threat", `Place ${e.printedSCH} suit threat`, [
            N("add-threat", { amount: e.printedSCH }),
          ]),
          O("stealth", "Change to Stealth suit", [
            N("form", { form: "stealth" }),
          ]),
        ],
      );
      break;
    }
    case "covert":
      if (e.wasStealth && e.removed > 0)
        ports.choose(
          s,
          "Covert Surveillance",
          `Place the ${e.removed} removed threat on your suit?`,
          [
            O("yes", "Place removed threat on suit", [
              N("add-threat", { amount: e.removed }),
            ]),
            O("no", "Do not place threat", []),
          ],
        );
      else if (!e.wasStealth)
        ports.choose(s, "Covert Surveillance", "Change to Stealth suit?", [
          O("yes", "Change to Stealth", [N("form", { form: "stealth" })]),
          O("no", "Keep Assault", []),
        ]);
      break;
    case "spray-player":
      ports.choose(
        s,
        "Spray Fire",
        "Choose a player.",
        playerOrder(s).map((p) =>
          O(p.id, p.heroId, [N("spray", { playerId: p.id })]),
        ),
      );
      break;
    case "spray": {
      const ids = ports
        .enemies(s, true)
        .filter(
          (t) =>
            t.id === s.villain.id ||
            s.minions.some(
              (p) =>
                p.id === t.id &&
                (p.engagedWith || s.activePlayerId) === e.playerId,
            ),
        )
        .map((t) => t.id);
      ports.queue(
        s,
        ...ids.map((target) =>
          E("damage", {
            target,
            amount: 3,
            attack: true,
            ranged: true,
            source: "hero",
          }),
        ),
      );
      break;
    }
    case "super-spies": {
      if (e.remaining <= 0) break;
      const supports = allInPlay(s).filter(
        (p) =>
          card(p).type_code === "support" &&
          ports.hasTrait(s, p.id, "S.H.I.E.L.D."),
      );
      const suits = allInPlay(s).filter(suitCard);
      ports.choose(
        s,
        "Super Spies",
        `Place ${e.remaining} more counters or threat tokens.`,
        [
          ...supports.flatMap((p) => [
            O(
              `${p.id}:counter`,
              `${card(p).name} · all-purpose counter`,
              [
                N("spy-place", {
                  id: p.id,
                  counter: true,
                  remaining: e.remaining,
                }),
              ],
              p.code,
            ),
            O(
              `${p.id}:threat`,
              `${card(p).name} · threat token`,
              [
                N("spy-place", {
                  id: p.id,
                  counter: false,
                  remaining: e.remaining,
                }),
              ],
              p.code,
            ),
          ]),
          ...suits.flatMap((p) => [
            O(
              `${p.id}:threat`,
              `${card(p).name} · threat token`,
              [
                N("spy-place", {
                  id: p.id,
                  counter: false,
                  remaining: e.remaining,
                }),
              ],
              p.code,
            ),
            O(
              `${p.id}:counter`,
              `${card(p).name} · all-purpose counter`,
              [
                N("spy-place", {
                  id: p.id,
                  counter: true,
                  remaining: e.remaining,
                }),
              ],
              p.code,
            ),
          ]),
        ],
      );
      break;
    }
    case "spy-place": {
      const p = ports.find(s, e.id);
      need(p, "The selected physical target is no longer in play.");
      if (suitCard(p!)) {
        if (e.counter)
          p!.nickAllPurposeCounters = (p!.nickAllPurposeCounters || 0) + 1;
        else p!.counters++;
      } else if (e.counter) ports.changeCounters(s, p!, 1);
      else p!.nickThreatTokens = (p!.nickThreatTokens || 0) + 1;
      ports.queue(s, N("super-spies", { remaining: e.remaining - 1 }));
      break;
    }
    case "prep": {
      const p = own(s, e.id);
      need(p && !isTextBlank(s, p), "The actual Preparation is unavailable.");
      if (e.kind === "analysis") {
        const suit = nickFurySuit(s);
        need(
          suit && suit.counters > 0,
          "Intelligence Analysis requires suit threat.",
        );
        suit!.counters--;
      }
      const before = new Set(s.queue);
      ports.discard(s, p!.id);
      const generated = s.queue.filter((q) => !before.has(q));
      s.queue = s.queue.filter((q) => before.has(q));
      ports.queue(
        s,
        ...generated,
        ...nickFuryPracticedPlan(s, p!, [
          N("prep-effect", { ...e, type: undefined, preparation: { ...p! } }),
        ]),
      );
      break;
    }
    case "prep-effect": {
      if (e.kind === "prism" && s.player.stunned) {
        consumeStatus(s.player, "stunned");
        ports.queue(s, ...(e.after || []));
        break;
      }
      const complete = N("prep-complete", {
        piece: e.preparation,
        after: e.after || [],
      });
      switch (e.kind) {
        case "em":
          ports.prevent(s, e.window, e.window.amount);
          ports.queue(s, complete);
          break;
        case "camera": {
          const maximum = Math.min(3, e.packet.amount);
          ports.choose(
            s,
            "Eyepatch Camera",
            "Place up to 3 of this threat on your suit instead.",
            Array.from({ length: maximum + 1 }, (_, n) =>
              O(String(n), `Move ${n} threat to suit`, [
                N("add-threat", { amount: n }),
                {
                  ...e.packet,
                  amount: e.packet.amount - n,
                  nickCameraHandled: true,
                },
                complete,
              ]),
            ),
          );
          break;
        }
        case "analysis":
          ports.cancelReveal(s, e.piece);
          ports.queue(s, complete);
          break;
        case "informant":
          s.flags[`nickInformant:${e.target}`] = true;
          ports.queue(s, complete);
          break;
        case "prism":
          ports.attackProgram(
            s,
            [
              N("prism-attack", {
                target: e.target,
                amount: 2,
                source: "hero",
              }),
            ],
            [complete],
          );
          break;
        case "intelligence":
          ports.revealHidden(s);
          ports.queue(s, N("intelligence", { after: [complete] }));
          break;
      }
      break;
    }
    case "prism-attack": {
      e.psylockeConfusedAtInitiation ??= !!ports.find(s, e.target)?.confused;
      const before = nickFuryAttackWindow(s, e, ports);
      if (before) {
        ports.queue(s, ...before);
        break;
      }
      ports.queue(
        s,
        E("status", { target: e.target, status: "confused" }),
        E("damage", {
          target: e.target,
          amount: e.amount,
          source: "hero",
          attack: true,
          nickAssaultHandled: true,
          psylockeConfusedAtInitiation: e.psylockeConfusedAtInitiation,
        }),
      );
      break;
    }
    case "prep-complete":
      ports.queue(s, ...ports.preparationsResolved(s, e.piece, e.after || []));
      break;
    case "practiced": {
      const plans = live(s, "50058").filter((p) => p.id !== e.discarded);
      if (
        !s.player.discard.some((p) => p.id === e.discarded) ||
        !plans.length
      ) {
        ports.queue(s, ...(e.after || []));
        break;
      }
      ports.choose(
        s,
        "Practiced Plan",
        "Discard Practiced Plan to return the discarded Preparation to your hand?",
        [
          ...plans.map((p) =>
            O(
              p.id,
              "Return the Preparation",
              [
                N("practiced-pay", {
                  id: p.id,
                  discarded: e.discarded,
                  after: e.after,
                }),
              ],
              p.code,
            ),
          ),
          O("no", "Do not return it", e.after || []),
        ],
      );
      break;
    }
    case "practiced-pay": {
      const p = own(s, e.id, "50058");
      need(p && !isTextBlank(s, p), "Practiced Plan is unavailable.");
      ports.discard(s, p!.id);
      const i = s.player.discard.findIndex((p) => p.id === e.discarded);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      ports.queue(s, ...ports.preparationsResolved(s, p!, e.after || []));
      break;
    }
    case "after-prep": {
      const choices =
        hero(s) && nickFurySuit(s)
          ? live(s, "50046")
              .filter((p) => !e.used.includes(p.id))
              .flatMap((p) =>
                ports.schemes(s, false).map((t) =>
                  O(
                    `${p.id}:${t.id}`,
                    `Secret Agent · move 1 threat from ${t.label}`,
                    [
                      E("thwart", {
                        target: t.id,
                        amount: 1,
                        source: p.id,
                        afterResolved: [N("secret-moved")],
                      }),
                      N("after-prep", {
                        after: e.after,
                        used: [...e.used, p.id],
                      }),
                    ],
                    p.code,
                  ),
                ),
              )
          : [];
      if (choices.length)
        ports.choose(
          s,
          "After your Preparation resolves",
          "Move threat with each Secret Agent once, or continue.",
          [...choices, O("continue", "Continue", e.after || [])],
        );
      else ports.queue(s, ...(e.after || []));
      break;
    }
    case "secret-moved":
      if (e.removed > 0) ports.queue(s, N("add-threat", { amount: e.removed }));
      break;
    case "intelligence": {
      const pieces = [
        ...(s.encounter.deck.length ? [s.encounter.deck[0]] : []),
        ...s.encounter.dealt,
      ];
      const offset = Number(s.encounter.deck.length > 0);
      ports.choose(s, "Intelligence", "Choose a card to swap, or finish.", [
        ...pieces.map((p, i) =>
          O(
            String(i),
            `${i < offset ? "Encounter deck top" : `Dealt to ${p.dealtTo}`} · ${card(p).name}`,
            [N("intelligence-to", { index: i, offset, after: e.after })],
            p.code,
          ),
        ),
        O("done", "Finish looking", e.after || []),
      ]);
      break;
    }
    case "intelligence-to": {
      const pieces = [
        ...(e.offset ? [s.encounter.deck[0]] : []),
        ...s.encounter.dealt,
      ];
      ports.choose(
        s,
        "Intelligence",
        "Choose the destination card.",
        pieces.map((p, i) =>
          O(
            String(i),
            card(p).name,
            [N("intelligence-swap", { ...e, type: undefined, to: i })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "intelligence-swap": {
      const get = (i: number) =>
        i < e.offset ? s.encounter.deck[0] : s.encounter.dealt[i - e.offset];
      const a = get(e.index),
        b = get(e.to),
        ad = a.dealtTo,
        bd = b.dealtTo;
      const set = (i: number, p: Piece, recipient: string | undefined) => {
        if (recipient) p.dealtTo = recipient;
        else delete p.dealtTo;
        if (i < e.offset) s.encounter.deck[0] = p;
        else s.encounter.dealt[i - e.offset] = p;
      };
      set(e.index, b, ad);
      set(e.to, a, bd);
      ports.queue(s, N("intelligence", { after: e.after }));
      break;
    }
    case "senior": {
      const options: Option[] = [
        O("draw", "Draw 2 cards", [E("draw", { amount: 2 })]),
      ];
      if (ports.schemes(s, false).length)
        options.push(
          O("thwart", "Remove 3 threat", [
            E("target", {
              title: "Nick Fury, Sr.",
              group: "scheme",
              action: E("thwart", { amount: 3, source: e.id }),
            }),
          ]),
        );
      const characters = ports
        .characters(s)
        .filter(
          (t) =>
            ports.hasTrait(s, t.id, "S.H.I.E.L.D.") &&
            ports.canStatus(s, t.id, "tough"),
        );
      if (characters.length)
        options.push(
          O("tough", "Give a S.H.I.E.L.D. character Tough", [
            N("senior-tough"),
          ]),
        );
      ports.choose(s, "Nick Fury, Sr.", "Choose one forced response.", options);
      break;
    }
    case "senior-tough":
      ports.choose(
        s,
        "Nick Fury, Sr.",
        "Choose a S.H.I.E.L.D. character.",
        ports
          .characters(s)
          .filter(
            (t) =>
              ports.hasTrait(s, t.id, "S.H.I.E.L.D.") &&
              ports.canStatus(s, t.id, "tough"),
          )
          .map((t) =>
            O(
              t.id,
              t.label,
              [E("status", { target: t.id, status: "tough" })],
              t.code,
            ),
          ),
      );
      break;
    case "discovered": {
      const holder = s.players.find((seat) => seat.heroId === "nick_fury");
      if (!holder) break;
      if (holder.id !== s.activePlayerId) {
        ports.queue(s, { ...e, actorId: holder.id });
        break;
      }
      nickFuryChangeSuit(s, "assault", ports);
      const count = nickFurySuit(s)?.counters || 0;
      if (!count) ports.queue(s, E("surge"));
      else
        ports.choose(
          s,
          "Discovered",
          "Take damage equal to suit threat, or remove all suit threat.",
          [
            O("damage", `Take ${count} damage`, [
              E("damage", {
                target: "hero",
                amount: count,
                source: e.piece.id,
              }),
            ]),
            O("remove", `Remove ${count} suit threat`, [N("clear-suit")]),
          ],
        );
      break;
    }
    case "clear-suit": {
      const p = nickFurySuit(s);
      if (p) p.counters = 0;
      break;
    }
    case "formula": {
      let p = [...s.minions, ...allInPlay(s)].find((p) => p.code === "50060");
      if (p) ports.queue(s, E("status", { target: p.id, status: "tough" }));
      else {
        p = takeEncounter(s, (p) => p.code === "50060");
        ports.shuffleEncounter(s);
        if (p) ports.putMinion(s, p, s.activePlayerId);
      }
      break;
    }
    case "cold": {
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) => card(p).type_code === "minion" && trait(p, "Leviathan"),
      );
      if (!found.length) {
        ports.shuffleEncounter(s);
        ports.queue(
          s,
          E("damage", { target: "hero", amount: 2, source: e.piece.id }),
        );
      } else
        ports.choose(
          s,
          "Cold Storage",
          "Choose a Leviathan minion to put into play.",
          found.map((p) =>
            O(p.id, card(p).name, [N("cold-put", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "cold-put": {
      const p = takeEncounter(s, (p) => p.id === e.id);
      if (p) ports.putMinion(s, p, s.activePlayerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "shadows": {
      const zone = s.player.setAside || [];
      const p = zone.find((p) => p.code === "50060"),
        scheme = zone.find((p) => p.code === "50061");
      const cards = zone.filter((p) =>
        ["50060", "50061", "50062", "50063"].includes(p.code),
      );
      for (const q of cards) zone.splice(zone.indexOf(q), 1);
      s.encounter.deck.push(...cards.filter((q) => q !== p && q !== scheme));
      ports.shuffleEncounter(s);
      s.flags.nemesis = true;
      ports.queue(
        s,
        ...(p ? [E("reveal", { piece: p })] : []),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
        ...(!p ? [E("surge")] : []),
      );
      break;
    }
    default:
      throw Error(`Unknown Nick Fury effect ${kind}`);
  }
  return true;
}
function takeEncounter(
  s: GameState,
  predicate: (p: Piece) => boolean,
): Piece | undefined {
  for (const z of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    ...playerOrder(s).map((seat) => seatView(s, seat).player.setAside || []),
  ]) {
    const i = z.findIndex(predicate);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  return undefined;
}
