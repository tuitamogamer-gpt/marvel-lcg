import importedCards from "../data/catalog-cards.json" with { type: "json" };
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { isTextBlank } from "./card-text.js";
import type { AntManPackPorts, AntManPackTarget } from "./ant-man-pack.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map(
  (importedCards as unknown as Card[]).map((c) => [c.code, c]),
);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E("star-pack:" + type, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find(
    (p) => p.id === id && (!code || p.code === code) && !isTextBlank(s, p),
  );
const printedTrait = (c: Card | undefined, trait: string) =>
  (c?.traits || "").split(/\.\s*/).includes(trait);
const identityName = (s: GameState, id: string) => {
  const view = seatView(s, id);
  return (
    [...cards.values()].find(
      (c) =>
        c.type_code === (view.player.form === "hero" ? "hero" : "alter_ego") &&
        c.set_code === view.heroId,
    )?.name || view.heroId
  );
};

export const STAR_LORD_PACK_CORE_ALIASES = ["17016", "17018"] as const;
export const STAR_LORD_PACK_SCRIPT_CODES = [
  "17011",
  "17012",
  "17013",
  "17014",
  "17015",
  "17017",
  "17019",
  "17020",
  "17021",
  "17022",
  "17023",
  "17028",
  "17029",
  "17030",
  "17031",
] as const;

export interface StarLordPackPorts extends AntManPackPorts {
  discardPiece(s: GameState, id: string): void;
  enemyTargets(s: GameState, attack?: boolean): AntManPackTarget[];
  minionTargets(s: GameState): AntManPackTarget[];
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  randomIndex(s: GameState, length: number): number;
  /** Discard one actual top card, with normal exhausted-deck handling. */
  discardEncounterTop(s: GameState): { piece?: Piece; emptied: boolean };
  discardPlayerTop(s: GameState, playerId: string): Piece | undefined;
  attackProgram(s: GameState, effects: Effect[], after?: Effect[]): void;
  damageDistribution(
    s: GameState,
    packets: { target: string; amount: number }[],
    options: { source: string },
  ): void;
  threatDistribution(
    s: GameState,
    packets: { target: string; amount: number }[],
  ): void;
  canReady?(s: GameState, target: string): boolean;
}

/** Pure continuous-effect fallback; host trait queries may include further grants. */
function hasTrait(
  s: GameState,
  target: string,
  trait: string,
  ports?: Pick<StarLordPackPorts, "hasTrait">,
) {
  if (ports) return ports.hasTrait(s, target, trait);
  if (target === "hero" || target.startsWith("hero:")) {
    const view = target === "hero" ? s : seatView(s, target.slice(5));
    const c = [...cards.values()].find(
      (c) =>
        c.type_code === (view.player.form === "hero" ? "hero" : "alter_ego") &&
        c.set_code === view.heroId,
    );
    return printedTrait(c, trait);
  }
  const p = allInPlay(s).find((p) => p.id === target),
    seat = p && controller(s, p.id);
  return (
    printedTrait(p && cards.get(p.code), trait) ||
    (trait === "Guardian" &&
      !!seat &&
      seat.heroId === "stld" &&
      seatView(s, seat).player.form === "hero" &&
      cards.get(p!.code)?.type_code === "ally")
  );
}
const attached = (s: GameState, id: string, code: string) =>
  allInPlay(s).filter(
    (p) => p.attachedTo === id && p.code === code && !isTextBlank(s, p),
  );
function blazeActive(s: GameState) {
  return playerOrder(s).some(
    (seat) => seatView(s, seat).flags.starPackBlazePhase === s.phase,
  );
}
export function starLordPackModifiers(
  s: GameState,
  target: string,
  ports?: Pick<StarLordPackPorts, "hasTrait">,
) {
  const p = allInPlay(s).find((p) => p.id === target),
    laser = attached(s, target, "17019").length;
  const blaze =
    blazeActive(s) && hasTrait(s, target, "Guardian", ports) ? 2 : 0;
  return {
    attack: laser + blaze,
    thwart: blaze,
    overkill: laser > 0,
    ranged: p?.code === "17013" && !isTextBlank(s, p),
  };
}
export function starLordPackAllyLimit(s: GameState) {
  return s.player.inPlay.filter((p) => p.code === "17022" && !isTextBlank(s, p))
    .length;
}
/** Call once before changing the phase; damage sees current Guardian traits. */
export function starLordPackPhaseEnded(
  s: GameState,
  ports: Pick<StarLordPackPorts, "hasTrait">,
): Effect[] {
  const active = blazeActive(s);
  for (const seat of playerOrder(s))
    delete seatView(s, seat).flags.starPackBlazePhase;
  if (!active) return [];
  return [
    ...playerOrder(s)
      .filter((seat) => ports.hasTrait(s, "hero:" + seat.id, "Guardian"))
      .map((seat) =>
        E("damage", {
          target: "hero:" + seat.id,
          amount: 1,
          source: "blaze-of-glory",
        }),
      ),
    ...allInPlay(s)
      .filter(
        (p) =>
          cards.get(p.code)?.type_code === "ally" &&
          ports.hasTrait(s, p.id, "Guardian"),
      )
      .map((p) =>
        E("damage", { target: p.id, amount: 1, source: "blaze-of-glory" }),
      ),
  ];
}
export function starLordPackResourceSources(s: GameState): PaymentSource[] {
  return s.player.form !== "hero"
    ? []
    : s.player.inPlay
        .filter(
          (p) =>
            p.code === "17031" &&
            !p.exhausted &&
            p.counters > 0 &&
            !isTextBlank(s, p),
        )
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Enhanced Awareness",
          resources: ["mental"],
          kind: "ability",
          description:
            "Exhaust · spend 1 mental counter · generate 1 mental resource",
        }));
}
export function starLordPackResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<StarLordPackPorts, "discardPiece">,
) {
  const p = own(s, id, "17031");
  if (!p) return false;
  need(
    s.player.form === "hero" && !p.exhausted && p.counters > 0,
    "Enhanced Awareness is unavailable.",
  );
  p.exhausted = true;
  if (!--p.counters) ports.discardPiece(s, p.id);
  return true;
}
export function starLordPackAttachmentTargets(
  s: GameState,
  code: string,
  ports: Pick<StarLordPackPorts, "hasTrait">,
) {
  return allInPlay(s).filter(
    (p) =>
      cards.get(p.code)?.type_code === "ally" &&
      ports.hasTrait(s, p.id, "Guardian") &&
      !allInPlay(s).some((a) => a.attachedTo === p.id && a.code === code),
  );
}
export function starLordPackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: StarLordPackPorts,
): string | null {
  if (
    p.code === "17019" &&
    !starLordPackAttachmentTargets(s, p.code, ports).length
  )
    return "Laser Blaster requires a Guardian ally without another Laser Blaster.";
  if (p.code === "17022" && !ports.hasTrait(s, "hero", "Guardian"))
    return "Your identity must have the Guardian trait.";
  if (
    ["17028", "17029", "17030"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Aerial")
  )
    return "Your identity must have the Aerial trait.";
  if (
    p.code === "17015" &&
    playerOrder(s).some(
      (seat) => seatView(s, seat).flags.starPackBlazeRound === s.round,
    )
  )
    return "Blaze of Glory is limited to 1 per round.";
  if (p.code === "17014" && !aerialCount(s, ports))
    return "Air Supremacy requires an Aerial character you control.";
  return null;
}
export function starLordPackAllyEnter(
  _s: GameState,
  p: Piece,
): Effect[] | null {
  return ["17011", "17012", "17013", "17020"].includes(p.code) ? [] : null;
}
export function starLordPackCardEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "17031") p.counters = 3;
  return p.code === "17019" && !p.attachedTo ? [P("attach", { id: p.id })] : [];
}
function aerialCount(s: GameState, ports: Pick<StarLordPackPorts, "hasTrait">) {
  return (
    Number(ports.hasTrait(s, "hero", "Aerial")) +
    s.player.inPlay.filter(
      (p) =>
        cards.get(p.code)?.type_code === "ally" &&
        ports.hasTrait(s, p.id, "Aerial"),
    ).length
  );
}
export function starLordPackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "17014":
      return [P("air", { selected: [] })];
    case "17015":
      return [P("blaze")];
    case "17028":
      return [
        E("target", {
          group: "enemy",
          attack: true,
          title: "Dive Bomb",
          action: P("dive", { attack: true }),
        }),
      ];
    case "17029":
      return [P("flight", { packets: [], remaining: 5 })];
    case "17030":
      return [
        E("ready", { target: "hero" }),
        E("thwart", {
          target: "main",
          amount: 2,
          source: "hero",
          ignorePatrol: true,
        }),
      ];
    default:
      return null;
  }
}
function readyGuardians(s: GameState, ports: StarLordPackPorts) {
  return ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        ports.hasTrait(s, t.id, "Guardian") &&
        (ports.canReady?.(s, t.id) ?? true) &&
        (t.id === "hero" || t.id.startsWith("hero:")
          ? seatView(s, t.id === "hero" ? s.activePlayerId : t.id.slice(5))
              .player.exhausted
          : allInPlay(s).find((p) => p.id === t.id)?.exhausted),
    );
}
export function starLordPackAbilityOptions(
  s: GameState,
  id: string,
  ports: StarLordPackPorts,
): Option[] {
  const p = own(s, id);
  if (!p || s.player.form !== "hero") return [];
  if (
    p.code === "17021" &&
    !p.exhausted &&
    readyGuardians(s, ports).length &&
    ports.canPay(s, 2, "", "")
  )
    return [
      O(
        "ready-guardian",
        "Spend 2 resources · ready a Guardian character",
        [P("citt-pay", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "17023" &&
    (s.player.stunned || ports.enemyTargets(s, true).length)
  )
    return [
      O(
        "grenade",
        "Discard Pulse Grenade · attack an enemy",
        [P("grenade", { id })],
        p.code,
      ),
    ];
  return [];
}
export function starLordPackAbility(
  s: GameState,
  id: string,
  ports: StarLordPackPorts,
  action?: string,
): boolean {
  const options = starLordPackAbilityOptions(s, id, ports),
    choice = options.find((o) => !action || o.id === action);
  if (!choice) return false;
  ports.queue(s, ...choice.effects);
  return true;
}
/** Trigger after an actual play from any zone, not after putting an ally into play. */
export function starLordPackAllyPlayed(
  s: GameState,
  p: Piece,
  playedPlayerId: string,
  ports: Pick<StarLordPackPorts, "hasTrait">,
): Effect[] {
  if (!ports.hasTrait(s, p.id, "Guardian")) return [];
  return allInPlay(s)
    .filter((k) => k.code === "17022" && !k.exhausted && !isTextBlank(s, k))
    .map((k) =>
      E("optional", {
        actorId: controller(s, k.id)?.id,
        title: "Knowhere",
        text: "Exhaust Knowhere so the player who played this Guardian ally draws 1 card?",
        effects: [P("knowhere", { id: k.id, playedPlayerId })],
      }),
    );
}
/** Ally action continuation retains the physical ally, target and printed use. */
export function starLordPackBeforeAllyBasicOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
  after: Effect[],
  _ports: StarLordPackPorts,
): Option[] {
  if (packet.kind === "attack" ? p.stunned : p.confused) return [];
  const result: Option[] = [];
  if (p.code === "17020" && !isTextBlank(s, p) && !packet.starPackCosmoHandled)
    result.push(
      O(
        "cosmo:" + p.id,
        "Cosmo · name a card type",
        [P("cosmo-type", { id: p.id, packet, after })],
        p.code,
      ),
    );
  if (
    packet.kind === "attack" &&
    !packet.starPackTargetPracticeHandled &&
    allInPlay(s).some(
      (a) =>
        a.attachedTo === p.id &&
        cards.get(a.code)?.type_code === "upgrade" &&
        printedTrait(cards.get(a.code), "Weapon"),
    )
  )
    for (const support of allInPlay(s).filter(
      (k) => k.code === "17017" && !isTextBlank(s, k),
    ))
      result.push(
        O(
          support.id,
          "Discard Target Practice · +2 ATK",
          [
            P("practice", {
              actorId: controller(s, support.id)?.id,
              id: support.id,
              allyId: p.id,
              packet,
              after,
            }),
          ],
          support.code,
        ),
      );
  return result;
}
export interface StarLordPackAllySnapshot {
  attack: boolean;
  defeatedMinion?: boolean;
}
export function starLordPackAfterAllyBasic(
  s: GameState,
  p: Piece,
  snapshot: StarLordPackAllySnapshot,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "17011" && s.player.hand.length)
    return [
      E("optional", {
        title: "Adam Warlock",
        text: "Discard 1 random card from your hand and resolve its printed resource?",
        effects: [P("adam", { id: p.id })],
      }),
    ];
  if (p.code === "17012" && snapshot.attack && snapshot.defeatedMinion)
    return [
      E("optional", {
        title: "Beta Ray Bill",
        text: "Remove 2 threat from the main scheme?",
        effects: [
          E("thwart", {
            target: "main",
            amount: 2,
            source: p.id,
            ignorePatrol: true,
          }),
        ],
      }),
    ];
  return [];
}
/** Consequential replacement belongs only to the just-resolved Cosmo use. */
export function starLordPackConsequentialDamage(
  packet: Effect,
  printed: number,
) {
  return packet.starPackCosmoSafe ? 0 : printed;
}

export function resolveStarLordPackEffect(
  s: GameState,
  e: Effect,
  ports: StarLordPackPorts,
): boolean {
  if (!e.type.startsWith("star-pack:")) return false;
  switch (e.type) {
    case "star-pack:attach": {
      const p = own(s, e.id, "17019");
      if (!p) break;
      const targets = starLordPackAttachmentTargets(s, p.code, ports);
      need(targets.length, "Laser Blaster requires a Guardian ally.");
      ports.choose(
        s,
        "Laser Blaster",
        "Choose a Guardian ally.",
        targets.map((t) =>
          O(
            t.id,
            cards.get(t.code)!.name,
            [P("attach-to", { id: p.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "star-pack:attach-to": {
      need(
        starLordPackAttachmentTargets(s, "17019", ports).some(
          (p) => p.id === e.target,
        ),
        "That ally cannot receive Laser Blaster.",
      );
      ports.attach(s, e.id, e.target);
      break;
    }
    case "star-pack:blaze":
      need(
        !playerOrder(s).some(
          (seat) => seatView(s, seat).flags.starPackBlazeRound === s.round,
        ),
        "Blaze of Glory is limited to 1 per round.",
      );
      s.flags.starPackBlazeRound = s.round;
      s.flags.starPackBlazePhase = s.phase;
      break;
    case "star-pack:air": {
      const selected: string[] = e.selected || [],
        maximum = aerialCount(s, ports);
      const options = ports
        .enemyTargets(s)
        .filter((t) => !selected.includes(t.id))
        .map((t) =>
          O(
            t.id,
            t.label,
            [P("air", { selected: [...selected, t.id] })],
            t.code,
          ),
        );
      const finish = O(
        "finish",
        `Deal 3 damage to ${selected.length} chosen enemies`,
        [P("air-damage", { selected })],
      );
      if (selected.length >= maximum || !options.length)
        ports.queue(s, ...finish.effects);
      else
        ports.choose(
          s,
          "Air Supremacy",
          `Choose up to ${maximum} different enemies.`,
          [...options, finish],
        );
      break;
    }
    case "star-pack:air-damage":
      ports.damageDistribution(
        s,
        (e.selected || []).map((target: string) => ({ target, amount: 3 })),
        { source: s.currentEventId || "hero" },
      );
      break;
    case "star-pack:dive": {
      const target = e.target;
      ports.attackProgram(s, [
        E("damage", {
          target,
          amount: 7,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
        P("dive-others", { target }),
      ]);
      break;
    }
    case "star-pack:dive-others":
      ports.damageDistribution(
        s,
        ports
          .enemyTargets(s)
          .filter((t) => t.id !== e.target)
          .map((t) => ({ target: t.id, amount: 1 })),
        { source: s.currentEventId || "hero" },
      );
      break;
    case "star-pack:flight": {
      const packets: { target: string; amount: number }[] = e.packets || [],
        remaining = Number(e.remaining);
      const options = ports.schemeTargets(s).flatMap((t) => {
        const available =
          (t.id === "main"
            ? s.scheme.threat
            : s.sideSchemes.find((p) => p.id === t.id)?.counters || 0) -
          packets
            .filter((p) => p.target === t.id)
            .reduce((n, p) => n + p.amount, 0);
        return Array.from({ length: Math.min(remaining, available) }, (_, i) =>
          O(
            `${t.id}:${i + 1}`,
            `${t.label} · remove ${i + 1} threat`,
            [
              P("flight", {
                packets: [...packets, { target: t.id, amount: i + 1 }],
                remaining: remaining - i - 1,
              }),
            ],
            t.code,
          ),
        );
      });
      const finish = O("finish", "Remove the allocated threat", [
        P("flight-remove", { packets }),
      ]);
      if (!remaining || !options.length) ports.queue(s, ...finish.effects);
      else
        ports.choose(
          s,
          "Agile Flight",
          `Allocate up to ${remaining} more threat.`,
          [...options, finish],
        );
      break;
    }
    case "star-pack:flight-remove":
      ports.threatDistribution(s, e.packets || []);
      break;
    case "star-pack:citt-pay": {
      const p = own(s, e.id, "17021");
      need(
        p &&
          !p.exhausted &&
          readyGuardians(s, ports).length &&
          ports.canPay(s, 2, "", ""),
        "C.I.T.T. is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("payRequest", {
          title: "C.I.T.T.",
          cost: 2,
          cancelable: false,
          after: [P("citt-ready", { id: p!.id })],
        }),
      );
      break;
    }
    case "star-pack:citt-ready": {
      const targets = readyGuardians(s, ports);
      if (targets.length)
        ports.choose(
          s,
          "C.I.T.T.",
          "Choose a Guardian character to ready.",
          targets.map((t) =>
            O(t.id, t.label, [E("ready", { target: t.id })], t.code),
          ),
        );
      break;
    }
    case "star-pack:grenade": {
      const p = own(s, e.id, "17023");
      need(p && s.player.form === "hero", "Pulse Grenade is unavailable.");
      ports.discardPiece(s, p!.id);
      if (s.player.stunned) {
        ports.queue(
          s,
          E("damage", {
            target: s.villain.id,
            amount: 0,
            source: "hero",
            attack: true,
          }),
        );
        break;
      }
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          attack: true,
          title: "Pulse Grenade",
          action: P("grenade-count", { source: p!.id, attack: true }),
        }),
      );
      break;
    }
    case "star-pack:grenade-count": {
      let amount = 0;
      for (let i = 0; i < 2; i++) {
        const result = ports.discardEncounterTop(s);
        amount += Number(cards.get(result.piece?.code || "")?.boost || 0);
        if (result.emptied) break;
      }
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount,
          source: "hero",
          attack: true,
          attackInitiated: true,
        }),
      );
      break;
    }
    case "star-pack:knowhere": {
      const p = own(s, e.id, "17022");
      need(p && !p.exhausted, "Knowhere is unavailable.");
      p!.exhausted = true;
      ports.queue(s, E("draw", { amount: 1, actorId: e.playedPlayerId }));
      break;
    }
    case "star-pack:practice": {
      const p = own(s, e.id, "17017"),
        ally = allInPlay(s).find((a) => a.id === e.allyId);
      need(
        p &&
          ally &&
          starLordPackBeforeAllyBasicOptions(
            s,
            ally,
            e.packet,
            e.after || [],
            ports,
          ).some((o) => o.id === p.id),
        "Target Practice is unavailable.",
      );
      ports.discardPiece(s, p!.id);
      ports.queue(
        s,
        {
          ...e.packet,
          actorId: controller(s, ally!.id)?.id,
          amount: Number(e.packet.amount || 0) + 2,
        },
        ...(e.after || []),
      );
      break;
    }
    case "star-pack:cosmo-type": {
      need(own(s, e.id, "17020"), "Cosmo is no longer in play.");
      const types = [
        "ally",
        "event",
        "support",
        "upgrade",
        "resource",
        "minion",
        "side_scheme",
        "main_scheme",
        "treachery",
        "attachment",
        "environment",
        "obligation",
        "hero",
        "alter_ego",
      ];
      ports.choose(
        s,
        "Cosmo",
        "Name a card type before choosing a player deck or the encounter deck.",
        types.map((type) =>
          O(type, type.replaceAll("_", " "), [
            P("cosmo-deck", {
              ...e,
              type: "star-pack:cosmo-deck",
              named: type,
            }),
          ]),
        ),
      );
      break;
    }
    case "star-pack:cosmo-deck": {
      const decks = [
        ...playerOrder(s)
          .filter((seat) => seatView(s, seat).player.deck.length)
          .map((seat) => ({
            id: seat.id,
            label: identityName(s, seat.id) + "'s player deck",
          })),
        ...(s.encounter.deck.length
          ? [{ id: "encounter", label: "Encounter deck" }]
          : []),
      ];
      if (!decks.length) {
        ports.queue(
          s,
          { ...e.packet, starPackCosmoHandled: true },
          ...(e.after || []),
        );
        break;
      }
      ports.choose(
        s,
        "Cosmo",
        "Choose a player deck or the encounter deck.",
        decks.map((deck) =>
          O(deck.id, deck.label, [
            P("cosmo-discard", {
              ...e,
              type: "star-pack:cosmo-discard",
              deck: deck.id,
            }),
          ]),
        ),
      );
      break;
    }
    case "star-pack:cosmo-discard": {
      const p =
        e.deck === "encounter"
          ? ports.discardEncounterTop(s).piece
          : ports.discardPlayerTop(s, e.deck);
      ports.queue(
        s,
        {
          ...e.packet,
          starPackCosmoHandled: true,
          starPackCosmoSafe: !!p && cards.get(p.code)?.type_code === e.named,
        },
        ...(e.after || []),
      );
      break;
    }
    case "star-pack:adam": {
      need(own(s, e.id, "17011"), "Adam Warlock is unavailable.");
      if (!s.player.hand.length) break;
      const index = ports.randomIndex(s, s.player.hand.length),
        [p] = s.player.hand.splice(index, 1);
      s.player.discard.push(p);
      const c = cards.get(p.code)!,
        kinds = [
          c.resource_physical && "physical",
          c.resource_energy && "energy",
          c.resource_mental && "mental",
        ].filter(Boolean) as string[];
      const effects = kinds.map((kind) =>
        P("adam-resource", { kind, source: e.id }),
      );
      if (c.resource_wild) effects.push(P("adam-wild", { source: e.id }));
      ports.queue(s, ...effects);
      break;
    }
    case "star-pack:adam-wild":
      ports.choose(
        s,
        "Adam Warlock",
        "Choose an effect for the discarded card's wild resource.",
        [
          O("physical", "Remove 3 threat", [
            P("adam-resource", { kind: "physical", source: e.source }),
          ]),
          O("energy", "Heal 3 damage from an identity", [
            P("adam-resource", { kind: "energy", source: e.source }),
          ]),
          O("mental", "Deal 3 damage", [
            P("adam-resource", { kind: "mental", source: e.source }),
          ]),
        ],
      );
      break;
    case "star-pack:adam-resource": {
      if (e.kind === "energy") {
        const options = playerOrder(s)
          .filter(
            (seat) =>
              seatView(s, seat).player.hp < ports.maxHeroHP(seatView(s, seat)),
          )
          .map((seat) =>
            O(seat.id, identityName(s, seat.id), [
              E("heal", { target: "hero:" + seat.id, amount: 3 }),
            ]),
          );
        if (options.length)
          ports.choose(
            s,
            "Adam Warlock",
            "Choose an identity to heal.",
            options,
          );
      } else
        ports.queue(
          s,
          E("target", {
            group: e.kind === "physical" ? "scheme" : "enemy",
            title: "Adam Warlock",
            action: E(e.kind === "physical" ? "thwart" : "damage", {
              amount: 3,
              source: e.source,
              ignorePatrol: true,
            }),
          }),
        );
      break;
    }
    default:
      throw Error("Unknown Star-Lord player-pack effect: " + e.type);
  }
  return true;
}
