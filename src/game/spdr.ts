import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { AntManTarget } from "./ant-man.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const D = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`spdr:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => ["spdr", "sp_dr"].includes(s.heroId);
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const interfaceCard = (p: Piece) =>
  !!cards.get(p.code)?.traits?.includes("Interface.");
export const SPDR_SCRIPT_CODES = [
  "31001a",
  "31001b",
  "31002a",
  "31002b",
  "31003",
  "31004",
  "31005",
  "31006",
  "31007",
  "31008",
  "31009",
  "31010",
  "31011",
  "31012",
  "31013",
  "31025",
  "31026",
  "31027",
  "31028",
] as const;
export const SPDR_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export interface SpdrPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  isTextBlank(s: GameState, p: Piece): boolean;
  makePiece(s: GameState, code: string): Piece;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  canChangeForm(s: GameState): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  discardControlledCost(s: GameState, id: string, after: Effect[]): void;
  discardHand(s: GameState, id: string): void;
  mill(s: GameState, count: number, after: Effect[]): void;
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  canPay(s: GameState, amount: number, req?: Resource[]): boolean;
  pay(
    s: GameState,
    title: string,
    amount: number,
    req: Resource[],
    after: Effect[],
  ): void;
  giveObligation(s: GameState, p: Piece): void;
  removeEncounter(s: GameState, p: Piece): void;
  discardEncounter(s: GameState, p: Piece): void;
  revealEncounter(s: GameState, p: Piece): void;
  addDefense(s: GameState, amount: number): void;
}
/** The active identity occupies exactly one zone. Its other physical card is in
 * play, so a JSON save does not duplicate either reversible card. */
export const spdrIdentity = (s: GameState) => s.player.spdrIdentity;
export const spdrSuit = (s: GameState) =>
  [spdrIdentity(s), ...s.player.inPlay].find(
    (p) => p?.id === s.player.spdrSuitId,
  );
export const spdrPilot = (s: GameState) =>
  [spdrIdentity(s), ...s.player.inPlay].find(
    (p) => p?.id === s.player.spdrPilotId,
  );
export function spdrInitialize(
  s: GameState,
  ports: Pick<SpdrPorts, "makePiece">,
) {
  if (!active(s) || spdrIdentity(s)) return;
  const suit = ports.makePiece(s, "31001b"),
    pilot = ports.makePiece(s, "31002a");
  suit.ownerId = pilot.ownerId = s.activePlayerId;
  s.player.spdrSuitId = suit.id;
  s.player.spdrPilotId = pilot.id;
  s.player.spdrIdentity = pilot;
  s.player.inPlay.push(suit);
  if (s.player.form === "hero") spdrChangedForm(s, "alter", "hero");
}
export function spdrSyncIdentity(s: GameState) {
  const p = spdrIdentity(s);
  if (p) p.exhausted = s.player.exhausted;
}
export function spdrChangedForm(s: GameState, from: string, to: string) {
  if (!active(s) || from === to || !spdrIdentity(s)) return;
  const previous = spdrIdentity(s)!;
  previous.exhausted = s.player.exhausted;
  const next = to === "hero" ? spdrSuit(s)! : spdrPilot(s)!;
  need(next, "SP//dr's other physical identity is missing.");
  s.player.inPlay = s.player.inPlay.filter((p) => p.id !== next.id);
  previous.code = to === "hero" ? "31002b" : "31001b";
  next.code = to === "hero" ? "31001a" : "31002a";
  next.counters += previous.counters;
  previous.counters = 0;
  for (const p of [...allInPlay(s), ...s.attachments])
    if (p.attachedTo === previous.id) p.attachedTo = next.id;
  if (to === "hero") previous.attachedTo = next.id;
  else {
    delete previous.attachedTo;
    delete next.attachedTo;
  }
  s.player.inPlay.push(previous);
  s.player.spdrIdentity = next;
  s.player.exhausted = next.exhausted;
}
export function spdrResourceSources(
  s: GameState,
  ports: Pick<SpdrPorts, "isTextBlank"> = { isTextBlank },
): PaymentSource[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !spdrIdentity(s) ||
    ports.isTextBlank(s, spdrIdentity(s)!)
  )
    return [];
  return s.player.inPlay
    .filter((p) => interfaceCard(p) && !p.exhausted)
    .map((p) => {
      const c = cards.get(p.code)!;
      const rs: Resource[] = [
        ...Array(c.resource_energy || 0).fill("energy"),
        ...Array(c.resource_physical || 0).fill("physical"),
        ...Array(c.resource_mental || 0).fill("mental"),
        ...Array(c.resource_wild || 0).fill("wild"),
      ];
      return {
        id: `spdr-sync:${p.id}`,
        name: `Sync Ratio · ${c.name}`,
        code: p.code,
        resources: rs,
        description:
          "Exhaust this actual Interface upgrade · generate its printed resources",
        kind: "ability" as const,
      };
    })
    .filter((p) => p.resources.length);
}
export function spdrResourceSpent(s: GameState, id: string) {
  if (!id.startsWith("spdr-sync:")) return false;
  const source = spdrResourceSources(s).find((p) => p.id === id);
  need(source, "This actual Sync Ratio resource is unavailable.");
  own(s, id.slice("spdr-sync:".length))!.exhausted = true;
  return true;
}
/** RRG1.8 errata: the engaged PLAYER generates resources. An alter ego has no
 * hero for this damage, but hand cards and every resource ability count. */
export function spdrResourcesGenerated(s: GameState, amount: number): Effect[] {
  if (amount <= 0 || s.player.form !== "hero") return [];
  return s.minions
    .filter(
      (p) =>
        p.code === "31027" &&
        (p.engagedWith || s.activePlayerId) === s.activePlayerId &&
        !isTextBlank(s, p),
    )
    .map((p) => E("damage", { target: "hero", amount, source: p.id }));
}
export function spdrPlayRestriction(
  s: GameState,
  p: Piece,
  ports: SpdrPorts,
): string | undefined {
  if (["31004", "31005", "31006"].includes(p.code) && s.player.form !== "hero")
    return "Hero form required.";
  if (
    p.code === "31004" &&
    !s.player.inPlay.some((p) => interfaceCard(p) && p.exhausted) &&
    ![...s.player.deck, ...s.player.discard].some(interfaceCard)
  )
    return "There is no Interface upgrade to ready or find.";
  if (p.code === "31008" && !active(s))
    return "Ejection Protocol requires SP//dr's identity.";
  return undefined;
}
export function spdrEvent(
  _s: GameState,
  p: Piece,
  receipt: { syncPaid?: number } = {},
): Effect[] | null {
  return ["31004", "31005", "31006"].includes(p.code)
    ? [D("event", { piece: p, syncPaid: receipt.syncPaid || 0 })]
    : null;
}
export function spdrAllyEntered(
  s: GameState,
  p: Piece,
  receipt: { syncPaid?: number } = {},
): Effect[] | null {
  if (p.code !== "31003") return null;
  return s.player.form === "hero" && (receipt.syncPaid || 0) > 0
    ? [
        E("optional", {
          title: "VEN#m",
          text: `Place ${receipt.syncPaid} sym counters from resources actually paid with Sync Ratio?`,
          effects: [D("venom", { id: p.id, amount: receipt.syncPaid })],
        }),
      ]
    : [];
}
export function spdrAbilityOptions(
  s: GameState,
  id: string,
  ports: SpdrPorts,
): Option[] {
  if (
    id === "identity" &&
    active(s) &&
    s.player.form === "alter" &&
    spdrSuit(s) &&
    !spdrSuit(s)!.exhausted &&
    !ports.isTextBlank(s, spdrIdentity(s)!)
  )
    return [
      O(
        "maintenance",
        "Maintenance · exhaust SP//dr Suit, draw 2 cards",
        [D("maintenance")],
        "31002a",
      ),
    ];
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (p.code === "31007")
    return [
      O(
        "aunt-may",
        "Aunt May & Uncle Ben · exhaust, discard top cards and recover SP//dr cards",
        [D("aunt-may", { id })],
        p.code,
      ),
    ];
  if (s.player.form !== "hero") return [];
  if (p.code === "31008" && active(s) && ports.canChangeForm(s))
    return [
      O(
        "ejection-protocol",
        "Ejection Protocol · discard, exhaust Interfaces, set HP to 6, gain tough and flip",
        [D("ejection", { id })],
        p.code,
      ),
    ];
  if (p.code === "31009")
    return [
      ...(s.player.inPlay.some((p) => interfaceCard(p) && !p.exhausted)
        ? [
            O(
              "command-draw",
              "SP//dr Command · exhaust an Interface, draw 1 card",
              [D("command-draw", { id })],
              p.code,
            ),
          ]
        : []),
      ...(s.player.hand.length &&
      s.player.inPlay.some((p) => interfaceCard(p) && p.exhausted)
        ? [
            O(
              "command-ready",
              "SP//dr Command · discard a card, ready an Interface",
              [D("command-ready", { id })],
              p.code,
            ),
          ]
        : []),
    ];
  if (
    p.code === "31010" &&
    active(s) &&
    spdrSuit(s)?.exhausted &&
    ports.canReadyIdentity(s, s.activePlayerId)
  )
    return [
      O(
        "host-spider",
        "Host Spider · exhaust, ready SP//dr Suit",
        [D("host", { id })],
        p.code,
      ),
    ];
  return [];
}
export function spdrAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: SpdrPorts,
): Effect[] | null {
  const os = spdrAbilityOptions(s, id, ports);
  return (
    (
      os.find((o) => o.id === action) ||
      (!action && os.length === 1 ? os[0] : undefined)
    )?.effects || null
  );
}
export function spdrBasicOptions(
  s: GameState,
  power: "attack" | "thwart",
  packet: Effect,
  ports: SpdrPorts,
): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  const code = power === "attack" ? "31013" : "31011";
  return s.player.inPlay
    .filter((p) => p.code === code && !p.exhausted && !ports.isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        `${cards.get(code)!.name} · exhaust, +2 ${power === "attack" ? "ATK" : "THW"} for this basic power`,
        [D("basic", { id: p.id, packet })],
        code,
      ),
    );
}
export function spdrDefenseOptions(s: GameState, ports: SpdrPorts): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "31012" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Speed-Metal Alloy · exhaust, +2 DEF for this defense",
        [D("defense", { id: p.id })],
        p.code,
      ),
    );
}
export function spdrInitializeNemesis(
  s: GameState,
  ports: Pick<SpdrPorts, "makePiece">,
) {
  if (!active(s) || s.flags.spdrNemesisInitialized) return;
  const zone = (s.player.setAside ||= []);
  for (const code of ["31026", "31027", "31028", "31028", "31028"]) {
    const p = ports.makePiece(s, code);
    p.ownerId = s.activePlayerId;
    zone.push(p);
  }
  s.flags.spdrNemesisInitialized = true;
}
export function spdrShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [];
  return [
    ...["31027", "31026"].flatMap((code) =>
      zone
        .filter((p) => p.code === code)
        .map((p) => D("reveal-setaside", { id: p.id })),
    ),
    D("shuffle-nemesis", {
      ids: zone.filter((p) => p.code === "31028").map((p) => p.id),
    }),
    ...(!zone.some((p) => p.code === "31027")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function spdrEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  if (!["31025", "31026", "31027", "31028"].includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "31025") {
    const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
    return owner ? [D("obligation", { piece: p, actorId: owner.id })] : [];
  }
  if (p.code === "31028") return [D("drain", { piece: p })];
  return [];
}
export function resolveSpdrEffect(
  s: GameState,
  e: Effect,
  ports: SpdrPorts,
): boolean {
  if (!e.type.startsWith("spdr:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "spdr:maintenance":
      need(
        s.player.form === "alter" && spdrSuit(s) && !spdrSuit(s)!.exhausted,
        "Maintenance needs the ready actual suit.",
      );
      spdrSuit(s)!.exhausted = true;
      ports.queue(s, E("draw", { amount: 2 }));
      break;
    case "spdr:host": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && !ports.isTextBlank(s, p),
        "Host Spider is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "spdr:basic": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && !ports.isTextBlank(s, p),
        "The actual Interface is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, {
        ...e.packet,
        spdrBasicHandled: true,
        amount: e.packet.amount + 2,
      });
      break;
    }
    case "spdr:defense": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && !ports.isTextBlank(s, p),
        "Speed-Metal Alloy is unavailable.",
      );
      p!.exhausted = true;
      ports.addDefense(s, 2);
      break;
    }
    case "spdr:venom": {
      const p = own(s, e.id);
      if (p && !ports.isTextBlank(s, p)) p.counters += e.amount;
      break;
    }
    case "spdr:event": {
      const p: Piece = e.piece;
      if (p.code === "31004") {
        const opts = [
          ...(s.player.inPlay.some((p) => interfaceCard(p) && p.exhausted)
            ? [
                O("ready", "Ready each Interface upgrade", [
                  D("ready-interfaces"),
                ]),
              ]
            : []),
          ...([...s.player.deck, ...s.player.discard].some(interfaceCard)
            ? [
                O(
                  "search",
                  "Search deck and discard for an Interface upgrade",
                  [D("search")],
                ),
              ]
            : []),
        ];
        ports.choose(s, "All Systems Go!", "Choose one printed effect.", opts);
      } else if (p.code === "31005")
        ports.queue(s, D("rapid", { remaining: e.syncPaid > 0 ? 2 : 1 }));
      else if (p.code === "31006")
        ports.choose(
          s,
          "Web-Trap",
          "Choose an enemy.",
          ports.enemyTargets(s, true).map((t) =>
            O(
              t.id,
              t.label,
              [
                E("damage", {
                  target: t.id,
                  amount: 5,
                  source: "hero",
                  attack: true,
                  attackInitiated: true,
                  afterResolved:
                    e.syncPaid > 0
                      ? [E("status", { target: t.id, status: "stunned" })]
                      : [],
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "spdr:ready-interfaces":
      for (const p of s.player.inPlay.filter(interfaceCard))
        p.exhausted = false;
      break;
    case "spdr:search": {
      const ps = [...s.player.deck, ...s.player.discard].filter(interfaceCard);
      ports.choose(
        s,
        "All Systems Go!",
        "Choose an actual Interface upgrade.",
        ps.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [D("search-take", { id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "spdr:search-take": {
      const zone = s.player.deck.some((p) => p.id === e.id)
        ? s.player.deck
        : s.player.discard;
      const i = zone.findIndex((p) => p.id === e.id && interfaceCard(p));
      need(i >= 0, "The chosen Interface is missing.");
      s.player.hand.push(zone.splice(i, 1)[0]);
      ports.shufflePlayerDeck(s, []);
      break;
    }
    case "spdr:rapid": {
      const ts = ports.schemeTargets(s, true);
      if (ts.length)
        ports.choose(
          s,
          "Rapid Deployment",
          `Remove 3 threat (${e.remaining} removal${e.remaining === 1 ? "" : "s"} remaining).`,
          ts.map((t) =>
            O(
              t.id,
              t.label,
              [
                E("thwart", {
                  target: t.id,
                  amount: 3,
                  action: true,
                  initiated: true,
                  statusChecked: true,
                }),
                ...(e.remaining > 1
                  ? [D("rapid", { remaining: e.remaining - 1 })]
                  : []),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "spdr:aunt-may": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "Aunt May & Uncle Ben are unavailable.");
      p!.exhausted = true;
      ports.mill(s, s.player.form === "alter" ? 3 : 2, [D("aunt-return")]);
      break;
    }
    case "spdr:aunt-return":
      for (const id of e.discardedIds || []) {
        for (const zone of [s.player.discard, s.player.deck]) {
          const i = zone.findIndex(
            (p) =>
              p.id === id &&
              cards.get(p.code)?.set_code === "spdr" &&
              cards.get(p.code)?.faction_code === "hero",
          );
          if (i >= 0) {
            s.player.hand.push(zone.splice(i, 1)[0]);
            break;
          }
        }
      }
      break;
    case "spdr:ejection":
      ports.discardControlledCost(s, e.id, [D("ejection-resolve")]);
      break;
    case "spdr:ejection-resolve":
      for (const p of s.player.inPlay.filter(interfaceCard)) p.exhausted = true;
      s.player.hp = 6;
      ports.queue(
        s,
        E("status", { target: "hero", status: "tough" }),
        E("flip", { counts: false }),
      );
      break;
    case "spdr:command-draw": {
      const ps = s.player.inPlay.filter(
        (p) => interfaceCard(p) && !p.exhausted,
      );
      ports.choose(
        s,
        "SP//dr Command",
        "Choose an Interface to exhaust as the cost.",
        ps.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [D("command-draw-cost", { commandId: e.id, id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "spdr:command-draw-cost": {
      const p = own(s, e.id),
        command = own(s, e.commandId);
      need(
        p && !p.exhausted && command && !command.exhausted,
        "Both actual exhaust costs must be available.",
      );
      p!.exhausted = command!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1 }));
      break;
    }
    case "spdr:command-ready":
      ports.choose(
        s,
        "SP//dr Command",
        "Choose an actual card to discard as a cost.",
        s.player.hand.map((p) =>
          O(
            p.id,
            cards.get(p.code)!.name,
            [D("command-discard", { commandId: e.id, id: p.id })],
            p.code,
          ),
        ),
      );
      break;
    case "spdr:command-discard": {
      const p = own(s, e.commandId);
      need(
        p && !p.exhausted,
        "The actual Command exhaust cost is unavailable.",
      );
      p!.exhausted = true;
      ports.discardHand(s, e.id);
      ports.queue(s, D("command-ready-target"));
      break;
    }
    case "spdr:command-ready-target":
      ports.choose(
        s,
        "SP//dr Command",
        "Choose an exhausted Interface to ready.",
        s.player.inPlay
          .filter((p) => interfaceCard(p) && p.exhausted)
          .map((p) =>
            O(
              p.id,
              cards.get(p.code)!.name,
              [E("ready", { target: p.id })],
              p.code,
            ),
          ),
      );
      break;
    case "spdr:drain": {
      const req: Resource[] = ["energy", "energy"];
      const hero = s.player.form === "hero";
      ports.choose(
        s,
        "Energy Drain",
        "Spend two Energy resources or resolve the other printed effect.",
        [
          ...(ports.canPay(s, 2, req)
            ? [
                O("pay", "Spend 2 Energy resources", [
                  D("drain-pay", { piece: e.piece }),
                ]),
              ]
            : []),
          O("other", hero ? "Take 3 damage" : "Exhaust your identity", [
            hero
              ? E("damage", { target: "hero", amount: 3, source: e.piece.id })
              : E("exhaust", { id: "hero" }),
          ]),
        ],
      );
      break;
    }
    case "spdr:drain-pay":
      ports.pay(s, "Energy Drain", 2, ["energy", "energy"], []);
      break;
    case "spdr:obligation":
      ports.giveObligation(s, e.piece);
      ports.choose(s, "Inherited Burden", "You may flip to alter-ego form.", [
        ...(s.player.form === "hero" && ports.canChangeForm(s)
          ? [
              O("flip", "Flip to Peni Parker", [
                E("flip", { counts: false }),
                D("obligation-choice", { piece: e.piece }),
              ]),
            ]
          : []),
        O("continue", "Continue in this form", [
          D("obligation-choice", { piece: e.piece }),
        ]),
      ]);
      break;
    case "spdr:obligation-choice": {
      const ps = s.player.inPlay.filter(
        (p) =>
          interfaceCard(p) && !cards.get(p.code)?.text?.includes("Permanent."),
      );
      const os = [
        ...(s.player.form === "alter" && !s.player.exhausted
          ? [
              O(
                "remove",
                "Exhaust Peni Parker, remove Inherited Burden from game",
                [
                  E("exhaust", { id: "hero" }),
                  D("obligation-remove", { piece: e.piece }),
                ],
              ),
            ]
          : []),
        ...ps.map((p) =>
          O(
            p.id,
            `Discard ${cards.get(p.code)!.name}, discard Inherited Burden`,
            [D("obligation-discard", { id: p.id, piece: e.piece })],
            p.code,
          ),
        ),
      ];
      if (os.length)
        ports.choose(
          s,
          "Inherited Burden",
          "Choose a payable printed option.",
          os,
        );
      else ports.discardEncounter(s, e.piece);
      break;
    }
    case "spdr:obligation-remove":
      ports.removeEncounter(s, e.piece);
      break;
    case "spdr:obligation-discard":
      ports.discardControlledCost(s, e.id, [
        D("obligation-finish", { piece: e.piece }),
      ]);
      break;
    case "spdr:obligation-finish":
      ports.discardEncounter(s, e.piece);
      break;
    case "spdr:reveal-setaside": {
      const zone = s.player.setAside || [];
      const i = zone.findIndex((p) => p.id === e.id);
      if (i >= 0) ports.revealEncounter(s, zone.splice(i, 1)[0]);
      break;
    }
    case "spdr:shuffle-nemesis": {
      const zone = s.player.setAside || [];
      for (const id of e.ids || []) {
        const i = zone.findIndex((p) => p.id === id);
        if (i >= 0) s.encounter.deck.push(zone.splice(i, 1)[0]);
      }
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unhandled SP//dr effect: ${e.type}`);
  }
  if (after.length) ports.queue(s, ...after);
  return true;
}
