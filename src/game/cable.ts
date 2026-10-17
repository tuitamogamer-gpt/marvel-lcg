import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, playerOrder, seatView, controller } from "./team.js";
import { enterPlayerSideScheme } from "./player-side-schemes.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const C = (type: string, args: Record<string, unknown> = {}) =>
  E(`cable:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const own = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const trait = (p: Piece, name: string) =>
  (card(p).traits || "").split(/\.\s*/).includes(name);
const need = (v: unknown, message: string) => {
  if (!v) throw Error(message);
};
export const CABLE_SCRIPT_CODES = [
  "40001a",
  "40001b",
  ...Array.from({ length: 35 }, (_, i) => String(40002 + i)),
];
export interface CablePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  discardDeck(s: GameState, amount: number): Piece[];
  discard(s: GameState, id: string): void;
  flip(s: GameState): void;
  ready(s: GameState, id: string): void;
  canReady(s: GameState, id: string): boolean;
  hasTrait(s: GameState, id: string, name: string): boolean;
  canPay(s: GameState, amount: number, req?: Resource[]): boolean;
  thw(s: GameState): number;
  friendly(s: GameState): { id: string; label: string; code?: string }[];
  enemies(
    s: GameState,
    attack: boolean,
  ): { id: string; label: string; code?: string }[];
  schemes(
    s: GameState,
    thwart: boolean,
  ): { id: string; label: string; code?: string }[];
  canPut(s: GameState, p: Piece): boolean;
  put(s: GameState, p: Piece, target?: string): void;
  attachmentTargets(
    s: GameState,
    p: Piece,
  ): { id: string; label: string; code?: string }[];
  heal(s: GameState, id: string, amount: number): void;
  attach(s: GameState, p: Piece, id: string): void;
  removeEncounter(s: GameState, id: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  damage(s: GameState, target: string): number;
}
export const cableVictoryCount = (s: GameState) =>
  (s.victoryDisplay || []).filter((p) =>
    ["side_scheme", "player_side_scheme"].includes(card(p).type_code),
  ).length;
export const cablePurged = (s: GameState) =>
  s.heroId === "cable" && !!s.victoryDisplay?.some((p) => p.code === "40006");
export const cableStatBonus = (s: GameState) => Number(cablePurged(s));
export const cableTraits = (s: GameState) =>
  cablePurged(s) ? ["Psionic"] : [];
export function cableInitialize(
  s: GameState,
  ports: Pick<CablePorts, "makePiece">,
) {
  if (s.heroId !== "cable" || s.flags.cableInitialized) return;
  s.flags.cableInitialized = true;
  (s.player.setAside ||= []).push(
    ...["40032", "40033", "40034", "40035", "40036"].map((code) =>
      ports.makePiece(s, code),
    ),
  );
}
export const cableSetup = (s: GameState): Effect[] =>
  s.heroId === "cable"
    ? [
        C("search", {
          title: "Soldier X",
          kind: "scheme",
          put: true,
          setup: true,
        }),
      ]
    : [];
export function cableResourceSources(s: GameState): PaymentSource[] {
  return own(s, "40007")
    .filter((p) => !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Graymalkin",
      resources: ["energy"],
      kind: "ability",
      description: "Exhaust Graymalkin to generate an energy resource.",
    }));
}
export function cableSpendResource(s: GameState, id: string) {
  const p = own(s, "40007").find((p) => p.id === id);
  if (!p) return false;
  need(!p.exhausted, "Graymalkin is exhausted.");
  p.exhausted = true;
  return true;
}
export function cableCanRemoveThreat(
  s: GameState,
  target: string,
  source = "hero",
) {
  const back = s.sideSchemes.find(
    (p) => p.code === "40033" && !isTextBlank(s, p),
  );
  if (back && (s.heroId === "cable" ? target !== back.id : target === back.id))
    return false;
  const purge = s.sideSchemes.find(
    (p) => p.id === target && p.code === "40006" && !isTextBlank(s, p),
  );
  if (!purge) return true;
  const p = [...allInPlay(s), ...s.resolving].find((p) => p.id === source);
  // Supports are independent game elements, not extensions of their identity.
  if (p && card(p).type_code === "support") return true;
  if (p && card(p).type_code === "ally") return false;
  return s.heroId === "cable" && s.player.form === "hero";
}
export function cableCanDamage(s: GameState, target: string) {
  if (!s.sideSchemes.some((p) => p.code === "40033" && !isTextBlank(s, p)))
    return true;
  const cableSeat = playerOrder(s).find((p) => p.heroId === "cable");
  const m = s.minions.find((p) => p.id === target);
  return s.heroId === "cable"
    ? !!m && (m.engagedWith || s.activePlayerId) === s.activePlayerId
    : !m || m.engagedWith !== cableSeat?.id;
}
export function cableDiscount(
  s: GameState,
  p: Piece | { code: string },
  ports: Pick<CablePorts, "hasTrait">,
) {
  return p.code === "40023" && ports.hasTrait(s, "hero", "Soldier") ? 1 : 0;
}
export function cablePlayRestriction(s: GameState, p: Piece) {
  if (p.code === "40004" && !cableVictoryCount(s))
    return "Precognition requires a side scheme in the victory display.";
  if (p.code === "40017" && !cableVictoryCount(s))
    return "Mission Planning requires a side scheme in the victory display.";
  if (p.code === "40021" && !allInPlay(s).some((p) => p.code === "40015"))
    return "E.V.A. requires Fantomex in play.";
  if (
    p.code === "40022" &&
    s.playerCount === 1 &&
    s.player.inPlay.some((p) => trait(p, "Team"))
  )
    return "Only one Team card is allowed per player.";
  return null;
}
export function cableEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "40002":
      return [C("bodyslide")];
    case "40003":
      return [
        E("target", {
          group: "scheme",
          title: "Mind Scan",
          action: E("thwart", {
            amount: 3 + cableVictoryCount(s),
            action: true,
          }),
        }),
      ];
    case "40004":
      return [C("precognition")];
    case "40005":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Telekinetic Blast",
          action: E("damage", {
            amount: 6 + cableVictoryCount(s),
            attack: true,
          }),
        }),
      ];
    case "40017":
      return [E("flag", { key: "cableMissionPhase", value: phase(s) })];
    case "40026":
      return [C("frenemies")];
    default:
      return null;
  }
}
export function cableAbilityOptions(
  s: GameState,
  id: string,
  ports: CablePorts,
): Option[] {
  const p = s.player.inPlay.find(
    (p) => p.id === id && !p.exhausted && !isTextBlank(s, p),
  );
  if (!p) return [];
  if (p.code === "40008" && s.player.form === "alter")
    return [
      O(
        "professor",
        "Professor · draw or find a player side scheme",
        [C("professor", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "40011" &&
    s.player.form === "hero" &&
    cableVictoryCount(s) &&
    ports.canPay(s, 1, ["energy"]) &&
    ports.enemies(s, true).length
  )
    return [
      O(
        "plasma",
        "Plasma Rifle · ranged attack",
        [C("pay", { id, kind: "rifle" })],
        p.code,
      ),
    ];
  if (p.code === "40021")
    return [
      O("eva", "E.V.A. · thwart, damage or heal", [C("eva", { id })], p.code),
    ];
  return [];
}
export function cableCardEntered(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
  fromHand = false,
): Effect[] {
  if (["40014", "40015", "40025"].includes(p.code))
    return [optional(card(p).name, [C("enter", { id: p.id })])];
  if (p.code === "40016" && fromHand && paid.includes("energy"))
    return [
      optional("Sunspot", [
        C("sunspot", { amount: paid.filter((r) => r === "energy").length }),
      ]),
    ];
  return [];
}
export function cablePlayed(s: GameState, p: Piece): Effect[] {
  if (s.player.form !== "hero" || !trait(p, "Psionic")) return [];
  return own(s, "40029")
    .filter((q) => q.id !== p.id && !q.exhausted)
    .map((q) => C("psimitar-window", { id: q.id }));
}
export function cableSideDefeated(
  s: GameState,
  p: Piece,
  source: string,
): Effect[] {
  const result: Effect[] = [];
  for (const seat of playerOrder(s)) {
    const v = seatView(s, seat);
    if (
      seat.id === s.activePlayerId &&
      v.heroId === "cable" &&
      v.player.form === "hero" &&
      !isTextBlank(v, "40001a") &&
      (source === "hero" ||
        source === `hero:${seat.id}` ||
        !allInPlay(s).some(
          (q) =>
            q.id === source && ["ally", "support"].includes(card(q).type_code),
        ))
    )
      result.push(C("ready-window", { actorId: seat.id }));
    for (const q of own(v, "40007"))
      result.push(C("gray-window", { id: q.id, actorId: seat.id }));
    if (v.player.form === "hero") {
      for (const q of own(v, "40023"))
        result.push(C("leader-window", { id: q.id, actorId: seat.id }));
      for (const q of own(v, "40010"))
        result.push(
          C("amnesia-window", { id: q.id, scheme: p.id, actorId: seat.id }),
        );
    }
  }
  return result;
}
export function cableSideReward(s: GameState, p: Piece): Effect[] {
  if (p.code === "40020")
    return playerOrder(s).map((seat) =>
      E("status", { target: `hero:${seat.id}`, status: "tough" }),
    );
  const kind =
    p.code === "40018"
      ? "ally"
      : p.code === "40019"
        ? "weapon"
        : p.code === "40027"
          ? "support"
          : undefined;
  return kind
    ? playerOrder(s)
        .map((seat) =>
          optional(card(p).name, [
            C("search", { kind, put: true, title: card(p).name }),
          ]),
        )
        .map((e, i) => ({ ...e, actorId: playerOrder(s)[i].id }))
    : [];
}
export function cableDefenseResponses(
  s: GameState,
  snapshot: Record<string, unknown>,
  ports: CablePorts,
): Effect[] {
  if (
    !snapshot.heroDefended ||
    s.player.form !== "hero" ||
    !ports.canPay(s, 1, ["energy"])
  )
    return [];
  return own(s, "40009")
    .filter((p) => !p.exhausted)
    .map((p) =>
      optional("Askani'son", [C("pay", { id: p.id, kind: "askani" })]),
    );
}
export function cableXForceTeam(
  s: GameState,
  ports: Pick<CablePorts, "hasTrait">,
) {
  return (
    own(s, "40022").length > 0 &&
    ports.hasTrait(s, "hero", "X-Force") &&
    s.player.inPlay
      .filter((p) => card(p).type_code === "ally")
      .every((p) => ports.hasTrait(s, p.id, "X-Force"))
  );
}
export function cableConsequential(
  s: GameState,
  p: Piece,
  e: Effect,
  amount: number,
  ports: CablePorts,
) {
  const seat = controller(s, p.id),
    v = seat ? seatView(s, seat) : s;
  if (v.flags.cableMissionPhase === phase(s)) return 0;
  return Math.max(
    0,
    amount -
      Number(
        !e.attack &&
          e.wideawakeTargetCode &&
          ["side_scheme", "player_side_scheme"].includes(
            card(e.wideawakeTargetCode)?.type_code,
          ) &&
          cableXForceTeam(v, ports),
      ),
  );
}
export function cableDeadpool(
  s: GameState,
  p: Piece,
  amount: number,
  source: string,
  hp: number,
) {
  if (
    p.code !== "40024" ||
    isTextBlank(s, p) ||
    source !== "consequential" ||
    p.damage + amount < hp
  )
    return false;
  p.damage = Math.max(0, p.damage + amount - 3);
  s.encounter.acceleration++;
  return true;
}
export function cableDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: CablePorts,
): Option[] {
  if (!(packet.amount > 0) || s.player.form !== "hero") return [];
  const target =
    packet.target === "hero"
      ? `hero:${packet.actorId || s.activePlayerId}`
      : packet.target;
  if (
    !ports
      .friendly(s)
      .some(
        (t) => (t.id === "hero" ? `hero:${s.activePlayerId}` : t.id) === target,
      )
  )
    return [];
  return own(s, "40012").map((p) =>
    O(
      p.id,
      "Telekinetic Force Field · prevent all damage",
      [
        C("field", { id: p.id }),
        ...(packet.type === "attackDamage"
          ? [E("preventAttack", { amount: packet.amount }), ...after]
          : after.map((e) => ({ ...e, amount: 0, cableFieldHandled: true }))),
      ],
      p.code,
    ),
  );
}
export function cableForcedDamage(
  s: GameState,
  target: string,
  amount: number,
  ports: Pick<CablePorts, "discard">,
) {
  const p = s.attachments.find(
    (p) => p.code === "40034" && p.attachedTo === target && !isTextBlank(s, p),
  );
  if (!p || amount <= 0) return false;
  if (amount >= 2) ports.discard(s, p.id);
  return true;
}
export function cableTemporalOptions(s: GameState, after: Effect[]): Option[] {
  if (
    s.player.form !== "hero" ||
    !cableVictoryCount(s) ||
    s.sideSchemes.some((p) => card(p).scheme_crisis && !isTextBlank(s, p))
  )
    return [];
  return own(s, "40013").map((p) =>
    O(
      p.id,
      "Temporal Leap · move 4 threat",
      [C("temporal", { id: p.id, after })],
      p.code,
    ),
  );
}
export function cableEncounter(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "40031") return [C("obligation", { piece: p })];
  if (p.code === "40034") return [C("attach-field", { piece: p })];
  if (p.code === "40035")
    return [E("threat", { target: "main", amount: 2 + cableVictoryCount(s) })];
  if (p.code === "40036")
    return [
      E("damage", {
        target: "hero",
        amount: 2 + cableVictoryCount(s),
        source: p.id,
      }),
    ];
  return ["40032", "40033"].includes(p.code) ? [] : null;
}
export function cableBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code === "40034")
    return [
      C("attach-field", {
        piece: p,
        target: s.attack?.attacker || s.scheming?.attacker,
      }),
    ];
  if (["40035", "40036"].includes(p.code))
    return [
      E("status", {
        target: "hero",
        status: p.code === "40035" ? "confused" : "stunned",
      }),
    ];
  return null;
}
export function cableShadows(s: GameState): Effect[] | null {
  return s.heroId === "cable" ? [C("nemesis")] : null;
}
function searchMatches(p: Piece, kind: string) {
  const c = card(p);
  return kind === "scheme"
    ? c.type_code === "player_side_scheme"
    : kind === "weapon"
      ? c.type_code === "upgrade" &&
        trait(p, "Weapon") &&
        Number(c.cost || 0) <= 3
      : kind === "support"
        ? c.type_code === "support" && Number(c.cost || 0) <= 3
        : kind === "eva"
          ? p.code === "40021"
          : c.type_code === "ally";
}
function take(
  s: GameState,
  id: string,
  zones: Piece[][] = [s.player.deck, s.player.discard],
) {
  for (const zone of zones) {
    const i = zone.findIndex((p) => p.id === id);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  return undefined;
}
export function resolveCableEffect(s: GameState, e: Effect, ports: CablePorts) {
  if (!e.type.startsWith("cable:")) return false;
  switch (e.type) {
    case "cable:search": {
      const cards = [...s.player.deck, ...s.player.discard].filter(
        (p) => searchMatches(p, e.kind) && (!e.put || ports.canPut(s, p)),
      );
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      ports.choose(
        s,
        e.title,
        "Choose an actual card from your deck or discard pile; then shuffle your deck.",
        [
          ...cards.map((p) =>
            O(
              p.id,
              card(p).name,
              [C("search-take", { id: p.id, put: !!e.put, title: e.title })],
              p.code,
            ),
          ),
          O("none", "Finish search without finding a card", [C("shuffle")]),
        ],
      );
      break;
    }
    case "cable:shuffle":
      ports.shuffle(s);
      break;
    case "cable:search-take": {
      const p = take(s, e.id);
      need(p, "The searched card is no longer available.");
      ports.shuffle(s);
      if (e.put && card(p!).type_code === "player_side_scheme")
        ports.queue(
          s,
          ...enterPlayerSideScheme(s, p!),
          E("playerSideSchemeLimit", { playerId: s.firstPlayerId }),
        );
      else if (e.put) ports.put(s, p!);
      else s.player.hand.push(p!);
      break;
    }
    case "cable:professor": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "Professor must be ready.");
      p!.exhausted = true;
      ports.choose(
        s,
        "Professor",
        "Draw a card or search for a player side scheme.",
        [
          O("draw", "Draw 1 card", [E("draw", { amount: 1 })]),
          O("search", "Find a player side scheme", [
            C("search", { kind: "scheme", title: "Professor" }),
          ]),
        ],
      );
      break;
    }
    case "cable:bodyslide":
      ports.flip(s);
      ports.queue(s, C("bodyslide-others", { form: s.player.form }));
      break;
    case "cable:bodyslide-others":
      ports.queue(
        s,
        ...playerOrder(s)
          .filter((p) => p.id !== s.activePlayerId)
          .map((p) => ({
            ...optional("Bodyslide", [C("change-form", { form: e.form })]),
            actorId: p.id,
          })),
      );
      break;
    case "cable:change-form": {
      const forms =
        e.form === "alter"
          ? ["alter"]
          : ["ant", "wsp"].includes(s.heroId)
            ? ["tiny", "giant"]
            : s.heroId === "angel"
              ? ["angel", "archangel"]
              : ["hero"];
      const current =
        s.player.form === "alter"
          ? "alter"
          : ["ant", "wsp"].includes(s.heroId)
            ? s.player.heroForm
            : s.heroId === "angel"
              ? s.player.angelForm || "angel"
              : "hero";
      const choices = forms.filter((f) => f !== current);
      if (choices.length)
        ports.choose(
          s,
          "Bodyslide",
          "Choose the matching form.",
          choices.map((form) => O(form, form, [E("flip", { target: form })])),
        );
      break;
    }
    case "cable:precognition": {
      const cards = s.encounter.deck.slice(0, cableVictoryCount(s));
      if (!cards.length) break;
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      ports.choose(
        s,
        "Precognition",
        "You may discard one of these encounter cards.",
        [
          ...cards.map((p) =>
            O(
              p.id,
              `Discard ${card(p).name}`,
              [
                C("precognition-discard", {
                  id: p.id,
                  ids: cards.map((p) => p.id),
                }),
              ],
              p.code,
            ),
          ),
          O("none", "Keep every card", [
            C("order", { ids: cards.map((p) => p.id), ordered: [] }),
          ]),
        ],
      );
      break;
    }
    case "cable:precognition-discard": {
      const p = take(s, e.id, [s.encounter.deck]);
      if (p) s.encounter.discard.push(p);
      ports.queue(
        s,
        C("order", {
          ids: e.ids.filter((id: string) => id !== e.id),
          ordered: [],
        }),
      );
      break;
    }
    case "cable:order": {
      if (!e.ids.length) {
        const ps = e.ordered
          .map((id: string) => take(s, id, [s.encounter.deck]))
          .filter(Boolean);
        s.encounter.deck.unshift(...ps);
        break;
      }
      ports.choose(
        s,
        "Precognition",
        "Choose the next card from the top of the encounter deck.",
        e.ids.map((id: string) => {
          const p = s.encounter.deck.find((p) => p.id === id)!;
          return O(
            id,
            card(p).name,
            [
              C("order", {
                ids: e.ids.filter((q: string) => q !== id),
                ordered: [...e.ordered, id],
              }),
            ],
            p.code,
          );
        }),
      );
      break;
    }
    case "cable:pay": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "The upgrade must be ready.");
      ports.queue(
        s,
        E("payRequest", {
          title: card(p!).name,
          cost: 1,
          requirements: ["energy"],
          abilityCost: true,
          cancelable: true,
          after: [C("paid", { id: e.id, kind: e.kind })],
        }),
      );
      break;
    }
    case "cable:paid": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "The upgrade must still be ready.");
      p!.exhausted = true;
      if (e.kind === "rifle")
        ports.queue(
          s,
          E("target", {
            group: "enemy",
            attack: true,
            title: "Plasma Rifle",
            action: E("damage", {
              amount: Math.min(4, cableVictoryCount(s)),
              attack: true,
              ranged: true,
              source: "hero",
            }),
          }),
        );
      else
        ports.queue(
          s,
          E("target", {
            group: "scheme",
            title: "Askani'son",
            action: E("thwart", {
              amount: ports.thw(s),
              action: true,
              source: "hero",
            }),
          }),
        );
      break;
    }
    case "cable:ready-window":
      if (s.flags.cableReadyPhase !== phase(s) && ports.canReady(s, "hero"))
        ports.queue(s, optional("Cable", [C("ready")]));
      break;
    case "cable:ready":
      need(
        s.flags.cableReadyPhase !== phase(s),
        "Cable already used this response this phase.",
      );
      s.flags.cableReadyPhase = phase(s);
      ports.ready(s, "hero");
      break;
    case "cable:gray-window": {
      const p = ports.find(s, e.id);
      if (p?.exhausted && !isTextBlank(s, p))
        ports.queue(s, optional("Graymalkin", [C("gray", { id: p.id })]));
      break;
    }
    case "cable:gray":
      ports.ready(s, e.id);
      break;
    case "cable:leader-window": {
      const p = ports.find(s, e.id);
      if (p && !p.exhausted && !isTextBlank(s, p) && s.player.form === "hero")
        ports.queue(s, optional("Mission Leader", [C("leader", { id: p.id })]));
      break;
    }
    case "cable:leader": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "Mission Leader must be ready.");
      p!.exhausted = true;
      ports.queue(
        s,
        ...playerOrder(s).map((p) => E("draw", { actorId: p.id, amount: 1 })),
      );
      break;
    }
    case "cable:amnesia-window": {
      const p = ports.find(s, e.id);
      const scheme = [
        ...s.encounter.discard,
        ...playerOrder(s).flatMap((p) => seatView(s, p).player.discard),
        ...(s.victoryDisplay || []),
      ].find((p) => p.id === e.scheme);
      if (p && scheme && s.player.form === "hero" && !isTextBlank(s, p))
        ports.queue(
          s,
          optional("Forced Amnesia", [
            C("amnesia", { id: p.id, scheme: e.scheme }),
          ]),
        );
      break;
    }
    case "cable:amnesia": {
      const p = s.player.inPlay.find((p) => p.id === e.id);
      if (!p) break;
      const scheme = take(s, e.scheme, [
        s.encounter.discard,
        ...playerOrder(s).map((p) => seatView(s, p).player.discard),
      ]);
      s.player.inPlay.splice(s.player.inPlay.indexOf(p), 1);
      (s.victoryDisplay ||= []).push(p);
      if (scheme) s.victoryDisplay.push(scheme);
      break;
    }
    case "cable:psimitar-window": {
      const p = ports.find(s, e.id);
      if (
        p &&
        !p.exhausted &&
        !isTextBlank(s, p) &&
        s.player.form === "hero" &&
        ports.enemies(s, true).length
      )
        ports.queue(s, optional("Psimitar", [C("psimitar", { id: p.id })]));
      break;
    }
    case "cable:psimitar": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "Psimitar must be ready.");
      p!.exhausted = true;
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          attack: true,
          title: "Psimitar",
          action: E("damage", { amount: 2, attack: true, source: "hero" }),
        }),
      );
      break;
    }
    case "cable:enter": {
      const p = ports.find(s, e.id);
      if (!p) break;
      if (p.code === "40014") {
        const index = s.player.deck.findIndex(
          (q) =>
            card(q).type_code === "ally" &&
            ["X-Factor", "X-Force", "X-Men"].some((t) => trait(q, t)),
        );
        const discarded = ports.discardDeck(
          s,
          index < 0 ? s.player.deck.length : index + 1,
        );
        const found = index < 0 ? undefined : discarded.at(-1);
        if (found) {
          const actual = take(s, found.id);
          if (actual) s.player.hand.push(actual);
        }
      } else if (p.code === "40015")
        ports.queue(
          s,
          C("search", { kind: "eva", put: true, title: "Fantomex" }),
        );
      else if (s.player.form === "hero") {
        const upgrades = playerOrder(s)
          .flatMap((seat) => seatView(s, seat).player.discard)
          .filter(
            (q) =>
              card(q).type_code === "upgrade" &&
              Number(card(q).cost || 0) <= 1 &&
              ports.attachmentTargets(s, q).some((t) => t.id === p.id),
          );
        if (upgrades.length)
          ports.choose(
            s,
            "Deathlok",
            "Attach an eligible upgrade from any player's discard pile.",
            [
              ...upgrades.map((q) =>
                O(
                  q.id,
                  card(q).name,
                  [C("deathlok", { id: q.id, target: p.id })],
                  q.code,
                ),
              ),
              O("none", "Decline", []),
            ],
          );
      }
      break;
    }
    case "cable:deathlok": {
      const p = take(
        s,
        e.id,
        playerOrder(s).map((p) => seatView(s, p).player.discard),
      );
      if (p) ports.put(s, p, e.target);
      break;
    }
    case "cable:sunspot":
      ports.choose(
        s,
        "Sunspot",
        "Choose a player.",
        playerOrder(s).map((p) =>
          O(p.id, p.heroId, [
            C("sunspot-damage", { playerId: p.id, amount: e.amount }),
          ]),
        ),
      );
      break;
    case "cable:sunspot-damage":
      ports.queue(
        s,
        ...[
          s.villain.id,
          ...s.minions
            .filter((p) => (p.engagedWith || s.activePlayerId) === e.playerId)
            .map((p) => p.id),
        ].map((target) =>
          E("damage", { target, amount: e.amount, source: "Sunspot" }),
        ),
      );
      break;
    case "cable:eva": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "E.V.A. must be ready.");
      const phantom = allInPlay(s).find((p) => p.code === "40015");
      const opts: Option[] = [];
      if (ports.schemes(s, false).length)
        opts.push(
          O("thwart", "Remove 1 threat", [
            C("eva-commit", { id: e.id }),
            E("target", {
              group: "scheme",
              thwart: false,
              title: "E.V.A.",
              action: E("thwart", { amount: 1, source: e.id, thwart: false }),
            }),
          ]),
        );
      if (ports.enemies(s, false).length)
        opts.push(
          O("damage", "Deal 1 damage", [
            C("eva-commit", { id: e.id }),
            E("target", {
              group: "enemy",
              title: "E.V.A.",
              action: E("damage", { amount: 1, source: e.id }),
            }),
          ]),
        );
      if (phantom?.damage)
        opts.push(
          O("heal", "Heal Fantomex", [
            C("eva-commit", { id: e.id }),
            E("heal", { target: phantom.id, amount: 1 }),
          ]),
        );
      if (opts.length) ports.choose(s, "E.V.A.", "Choose an effect.", opts);
      break;
    }
    case "cable:eva-commit": {
      const p = ports.find(s, e.id);
      need(p && !p.exhausted, "E.V.A. must be ready.");
      p!.exhausted = true;
      break;
    }
    case "cable:frenemies": {
      const cable = ports
          .friendly(s)
          .find((t) => t.code && card(t.code).name === "Cable"),
        deadpool = ports
          .friendly(s)
          .find((t) => t.code && card(t.code).name === "Deadpool");
      if (cable) ports.queue(s, E("damage", { target: cable.id, amount: 1 }));
      if (deadpool)
        ports.queue(s, E("damage", { target: deadpool.id, amount: 1 }));
      ports.queue(s, C("frenemies-thwart"));
      break;
    }
    case "cable:frenemies-thwart": {
      const targets = ports.schemes(s, true).filter((t) => t.id !== e.previous);
      if (targets.length)
        ports.choose(
          s,
          "Frenemies",
          "Remove 3 threat from a scheme.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                E("thwart", { target: t.id, amount: 3 }),
                ...(!e.previous
                  ? [C("frenemies-thwart", { previous: t.id })]
                  : []),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "cable:field":
      ports.discard(s, e.id);
      break;
    case "cable:temporal": {
      const schemes = (s.victoryDisplay || []).filter((p) =>
        ["side_scheme", "player_side_scheme"].includes(card(p).type_code),
      );
      ports.choose(
        s,
        "Temporal Leap",
        "Choose a side scheme from the victory display.",
        schemes.map((p) =>
          O(
            p.id,
            card(p).name,
            [C("temporal-commit", { id: e.id, scheme: p.id, after: e.after })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "cable:temporal-commit": {
      const p = take(s, e.id, [s.player.inPlay]);
      const scheme = take(s, e.scheme, [s.victoryDisplay || []]);
      need(p && scheme, "Temporal Leap requires both original cards.");
      s.removed.push(p!);
      scheme!.counters =
        (card(scheme!).base_threat || 0) *
        (card(scheme!).base_threat_fixed ? 1 : s.playerCount);
      delete scheme!.pendingDefeat;
      s.sideSchemes.push(scheme!);
      if (card(scheme!).type_code === "player_side_scheme")
        scheme!.playerSideSchemeController = scheme!.ownerId;
      const moved = s.sideSchemes.some(
        (p) => card(p).scheme_crisis && !isTextBlank(s, p),
      )
        ? 0
        : Math.min(4, s.scheme.threat);
      s.scheme.threat -= moved;
      scheme!.counters += moved;
      ports.queue(
        s,
        E("playerSideSchemeLimit", { playerId: s.firstPlayerId }),
        ...e.after,
      );
      break;
    }
    case "cable:obligation": {
      const owner = playerOrder(s).find((p) => p.heroId === "cable");
      if (!owner) {
        ports.removeEncounter(s, e.piece.id);
        s.encounter.discard.push(e.piece);
        ports.dealEncounter(s, s.activePlayerId);
        break;
      }
      if (owner.id !== s.activePlayerId) {
        ports.queue(s, { ...e, actorId: owner.id });
        break;
      }
      const zones = [
          s.player.deck,
          s.player.discard,
          s.player.hand,
          s.victoryDisplay || [],
        ],
        p = zones.flat().find((p) => p.code === "40006");
      if (!p) {
        ports.removeEncounter(s, e.piece.id);
        s.encounter.discard.push(e.piece);
        ports.dealEncounter(s, s.activePlayerId);
        break;
      }
      take(s, p.id, zones);
      ports.shuffle(s);
      p.counters = 5;
      s.sideSchemes.push(p);
      p.playerSideSchemeController = p.ownerId;
      ports.queue(
        s,
        E("playerSideSchemeLimit", { playerId: s.firstPlayerId }),
        C("obligation-attach", { piece: e.piece, target: p.id }),
      );
      break;
    }
    case "cable:obligation-attach":
      if (s.sideSchemes.some((p) => p.id === e.target))
        ports.attach(s, e.piece, e.target);
      else {
        ports.removeEncounter(s, e.piece.id);
        s.encounter.discard.push(e.piece);
        ports.dealEncounter(s, s.activePlayerId);
      }
      break;
    case "cable:attach-field":
      ports.attach(
        s,
        e.piece,
        e.target ||
          s.minions.find((p) => p.code === "40032")?.id ||
          s.villain.id,
      );
      break;
    case "cable:nemesis": {
      const reserve = s.player.setAside || [],
        minion = reserve.find((p) => p.code === "40032"),
        scheme = reserve.find((p) => p.code === "40033");
      if (!minion && !scheme) {
        ports.queue(s, E("surge"));
        break;
      }
      const introduced = reserve.filter(
        (p) => p.code >= "40032" && p.code <= "40036",
      );
      for (const p of introduced) {
        reserve.splice(reserve.indexOf(p), 1);
        if (p === minion || p === scheme)
          ports.queue(s, E("reveal", { piece: p }));
        else s.encounter.deck.push(p);
      }
      ports.shuffleEncounter(s);
      s.flags.nemesis = true;
      break;
    }
  }
  return true;
}
