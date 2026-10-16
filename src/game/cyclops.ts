import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const card = (p: Pick<Piece, "code">) => definitions.get(p?.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const C = (type: string, args: Record<string, unknown> = {}) =>
  E(`cyclops:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (yes: unknown, message: string) => {
  if (!yes) throw Error(message);
};
const active = (s: GameState) => s.heroId === "cyclops";
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const signature = (p: Piece) =>
  card(p)?.set_code === "cyclops" && card(p)?.faction_code === "hero";
const trait = (p: Piece, t: string) =>
  (card(p)?.traits || "").split(/\.\s*/).includes(t);
const tactics = ["33005", "33006", "33007"];
const attachedUpgrades = [
  "33005",
  "33006",
  "33007",
  "33015",
  "33016",
  "33032",
  "33033",
  "33034",
  "33035",
];
const live = (s: GameState, code: string, target?: string) =>
  allInPlay(s).filter(
    (p) =>
      p.code === code &&
      (!target || p.attachedTo === target) &&
      !isTextBlank(s, p),
  );
const anyUpgrade = (s: GameState, id: string) =>
  allInPlay(s).some(
    (p) => p.attachedTo === id && card(p)?.type_code === "upgrade",
  );
const friendly = (s: GameState) =>
  allInPlay(s).filter((p) => card(p)?.type_code === "ally");
export const CYCLOPS_CORE_ALIASES = ["33024", "33025", "33026"] as const;
export const CYCLOPS_SCRIPT_CODES = [
  "33001a",
  "33001b",
  ...Array.from({ length: 34 }, (_, i) => String(33002 + i)),
].filter((c) => !(CYCLOPS_CORE_ALIASES as readonly string[]).includes(c));
/** Same printed Team-Up in Phoenix's retail pack; one physical event at a time. */
export const CYCLOPS_SHARED_SCRIPT_CODES = ["34023"] as const;
export const CYCLOPS_SOURCE =
  "https://hallofheroeslcg.com/scott-summers-cyclops/";
export interface CyclopsPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  friendlyTargets(s: GameState): AntManTarget[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  canReady(s: GameState, id: string): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    exclude?: string,
    targetCode?: string,
  ): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    after: Effect[],
    targetCode?: string,
  ): void;
  cardCost(s: GameState, p: Piece): number;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  playReaction(
    s: GameState,
    id: string,
    effects: Effect[],
    after: Effect[],
  ): void;
  reactionEvents(s: GameState): Piece[];
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  makePiece(s: GameState, code: string): Piece;
  discardPiece(s: GameState, id: string): void;
  attach(s: GameState, id: string, target: string): void;
  revealEncounter(s: GameState, p: Piece): void;
  attachEncounter(s: GameState, p: Piece, target: string): void;
  keepObligation(s: GameState, p: Piece): void;
  removeEncounter(s: GameState, p: Piece): void;
  revealHidden(s: GameState): void;
}
export function cyclopsCanAttack(s: GameState): boolean {
  return (
    !active(s) ||
    !s.player.inPlay.some((p) => p.code === "33027" && !isTextBlank(s, p))
  );
}
export function cyclopsFirstTurn(s: GameState): string {
  return (
    playerOrder(s).find((seat) =>
      seatView(s, seat).player.inPlay.some(
        (p) => p.code === "33004" && !isTextBlank(seatView(s, seat), p),
      ),
    )?.id || s.firstPlayerId
  );
}
export function cyclopsResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  return active(s) && s.player.form === "hero" && targetCode === "33001a"
    ? live(s, "33003")
        .filter((p) => own(s, p.id) && !p.exhausted)
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: "Ruby Quartz Visor",
          resources: ["energy"],
          kind: "ability",
          description: "Exhaust · Optic Blast gains piercing and ranged",
        }))
    : [];
}
export function cyclopsResourceSpent(
  s: GameState,
  id: string,
  targetCode?: string,
): boolean {
  const p = own(s, id);
  if (p?.code !== "33003") return false;
  need(
    cyclopsResourceSources(s, targetCode).some((p) => p.id === id),
    "Ruby Quartz Visor can only pay for Optic Blast.",
  );
  p.exhausted = true;
  s.flags.cyclopsOpticVisor = true;
  return true;
}
export function cyclopsAbilityOptions(
  s: GameState,
  id: string,
  ports: CyclopsPorts,
): Option[] {
  if (
    id === "identity" &&
    active(s) &&
    !isTextBlank(s, {
      id: `hero:${s.activePlayerId}`,
      code: s.player.form === "hero" ? "33001a" : "33001b",
    })
  ) {
    if (
      s.player.form === "alter" &&
      s.flags.cyclopsTrainingRound !== s.round &&
      s.player.deck.some(
        (p) => trait(p, "Tactic") && card(p).type_code === "upgrade",
      )
    )
      return [
        O(
          "constant-training",
          "Constant Training · find a Tactic upgrade",
          [C("training")],
          "33001b",
        ),
      ];
    if (
      s.player.form === "hero" &&
      cyclopsCanAttack(s) &&
      s.flags.cyclopsOpticRound !== s.round &&
      ports.enemyTargets(s, true).some((p) => anyUpgrade(s, p.id)) &&
      ports.canPay(s, 1, [], undefined, "33001a")
    )
      return [
        O(
          "optic-blast",
          "Optic Blast · spend 1 resource, deal 3 damage",
          [C("optic")],
          "33001a",
        ),
      ];
  }
  const p = own(s, id);
  if (
    p?.code === "33027" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted &&
    !isTextBlank(s, p)
  )
    return [
      O(
        "recover-visor",
        "Lost Visor · exhaust Scott, recover Visor",
        [C("recover-visor", { id })],
        p.code,
      ),
    ];
  return [];
}
export function cyclopsAbility(
  s: GameState,
  id: string,
  ports: CyclopsPorts,
  action?: string,
): Effect[] | null {
  const options = cyclopsAbilityOptions(s, id, ports);
  return (
    (options.find((o) => o.id === action) || (!action ? options[0] : undefined))
      ?.effects || null
  );
}
export function cyclopsAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: CyclopsPorts,
): AntManTarget[] | null {
  if (!attachedUpgrades.includes(p.code)) return null;
  const noCopy = (id: string) =>
    !allInPlay(s).some(
      (q) => q.id !== p.id && q.code === p.code && q.attachedTo === id,
    );
  if (tactics.includes(p.code))
    return ports.enemyTargets(s, false).filter((t) => noCopy(t.id));
  if (["33016", "33032", "33033", "33034"].includes(p.code))
    return s.minions
      .filter((p) => noCopy(p.id))
      .map((p) => ({
        id: p.id,
        code: p.code,
        label: card(p)?.name || "Minion",
      }));
  if (p.code === "33035")
    return ports.friendlyTargets(s).filter((t) => noCopy(t.id));
  return ports
    .friendlyTargets(s)
    .filter(
      (t) =>
        friendly(s).some((p) => p.id === t.id) &&
        ports.hasTrait(s, t.id, "X-Men") &&
        !allInPlay(s).some(
          (q) => q.id !== p.id && q.attachedTo === t.id && trait(q, "Training"),
        ),
    );
}
function rapportCharacters(s: GameState, ports: CyclopsPorts) {
  return ports.friendlyTargets(s).filter((t) => {
    const seat = t.id.startsWith("hero:")
      ? s.players.find((p) => p.id === t.id.slice(5))
      : undefined;
    return seat
      ? ["cyclops", "phoenix"].includes(seat.heroId) &&
          seat.player.form === "hero"
      : ["Cyclops", "Phoenix"].includes(
          card(allInPlay(s).find((p) => p.id === t.id)!)?.name,
        );
  });
}
export function cyclopsPlayRestriction(
  s: GameState,
  p: Piece,
  ports: CyclopsPorts,
): string | undefined {
  if (p.code === "33008")
    return "Full Blast requires an actual Optic Blast interrupt.";
  if (
    ["33009", "33010", "33022", "33023", "34023"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "Hero form required.";
  if (p.code === "33009" && !cyclopsCanAttack(s))
    return "Lost Visor prevents Cyclops from attacking.";
  if (
    attachedUpgrades.includes(p.code) &&
    !cyclopsAttachmentTargets(s, p, ports)?.length
  )
    return "No legal attachment target.";
  if (
    p.code === "33035" &&
    !ports.hasTrait(s, `hero:${s.activePlayerId}`, "X-Men")
  )
    return "Honorary X-Men requires an X-Men identity.";
  if (
    p.code === "33022" &&
    !friendly(s).some((a) =>
      allInPlay(s).some((t) => t.attachedTo === a.id && trait(t, "Training")),
    )
  )
    return "Game Time requires an ally with a Training upgrade.";
  if (["33023", "34023"].includes(p.code)) {
    const names = rapportCharacters(s, ports).map((t) =>
      t.id.startsWith("hero:")
        ? s.players.find((p) => p.id === t.id.slice(5))!.heroId
        : card(allInPlay(s).find((p) => p.id === t.id)!).name.toLowerCase(),
    );
    if (
      !["cyclops", "phoenix"].includes(s.heroId) ||
      !names.includes("cyclops") ||
      !names.includes("phoenix")
    )
      return "Psychic Rapport requires your Cyclops or Phoenix identity and both characters in play.";
  }
  return undefined;
}
export function cyclopsEvent(_s: GameState, p: Piece): Effect[] | null {
  return ["33009", "33010", "33022", "33023", "34023"].includes(p.code)
    ? [C("event", { piece: p })]
    : null;
}
export function cyclopsCardEntered(_s: GameState, p: Piece): Effect[] {
  return attachedUpgrades.includes(p.code) && !p.attachedTo
    ? [C("attach", { id: p.id })]
    : [];
}
export function cyclopsCharacterModifiers(s: GameState, target: string) {
  if (target === "hero") target = `hero:${s.activePlayerId}`;
  const n = live(s, "33015", target).length;
  return {
    attack: n,
    thwart: n,
    health: n + live(s, "33035", target).length,
    xmen: live(s, "33035", target).length > 0,
  };
}
export function cyclopsAllyLimit(
  s: GameState,
  hasTrait: (s: GameState, id: string, trait: string) => boolean,
): number {
  return s.player.inPlay.some(
    (p) => ["33020", "36024"].includes(p.code) && !isTextBlank(s, p),
  ) &&
    s.player.inPlay
      .filter((p) => card(p)?.type_code === "ally")
      .every((p) => hasTrait(s, p.id, "X-Men"))
    ? 1
    : 0;
}
export function cyclopsEnemyAttackModifier(s: GameState, id: string) {
  return -live(s, "33006", id).length - 2 * live(s, "33034", id).length;
}
export function cyclopsAttackModifiers(s: GameState, id: string) {
  return {
    damage: live(s, "33005", id).length,
    overkill: live(s, "33032", id).length > 0,
    befuddle: live(s, "33033", id).length > 0,
    consequence: live(s, "33016", id).length,
  };
}
export function cyclopsRoundEnded(s: GameState): Effect[] {
  return allInPlay(s)
    .filter(
      (p) =>
        tactics.includes(p.code) &&
        !isTextBlank(s, p) &&
        !(
          s.minions.some((m) => m.id === p.attachedTo) &&
          playerOrder(s).some((seat) =>
            seatView(s, seat).player.inPlay.some(
              (f) => f.code === "33004" && !isTextBlank(s, f),
            ),
          )
        ),
    )
    .map((p) => E("discardPiece", { id: p.id }));
}
export function cyclopsPriorityTarget(
  s: GameState,
  id: string,
  playerId: string,
): Effect[] {
  return live(s, "33007", id).map((p) =>
    E("optional", {
      title: "Priority Target",
      text: "The player who defeated this enemy draws 2 cards?",
      image: p.code,
      effects: [E("draw", { amount: 2, actorId: playerId })],
      actorId: controller(s, p.id)?.id || playerId,
    }),
  );
}
export function cyclopsCardLeft(s: GameState, p: Piece) {
  for (const seat of s.players)
    delete seatView(s, seat).flags[`cyclopsPriority:${p.id}`];
}
export function cyclopsResourceCardSpent(
  s: GameState,
  p: Piece,
  played: Piece | undefined,
  playing: boolean,
): Effect[] {
  return ["33018", "36021"].includes(p.code) &&
    playing &&
    played &&
    card(played)?.type_code === "ally"
    ? [
        E("optional", {
          title: "Effective Leadership",
          text: "Give the entering ally +1 ATK and +1 THW this phase?",
          image: p.code,
          effects: [C("leadership", { id: played.id })],
        }),
      ]
    : [];
}
export function cyclopsEffectiveLeadership(s: GameState, p: Piece) {
  const n = Number(s.flags[`cyclopsLeadership:${p.id}`] || 0);
  if (n) {
    p.bonusAtk = (p.bonusAtk || 0) + n;
    p.bonusThw = (p.bonusThw || 0) + n;
    delete s.flags[`cyclopsLeadership:${p.id}`];
  }
}
/** Single saved response window: one ally enters, every eligible support owner
 * and every Mutant alter ego may respond without losing physical control. */
export function cyclopsAllyEntered(s: GameState, p: Piece): Effect[] {
  return [
    C("ally-window", {
      id: p.id,
      token: `cyclops-entry:${s.nextId++}`,
      origin: s.activePlayerId,
    }),
  ];
}
function entryOptions(s: GameState, e: Effect, ports: CyclopsPorts): Option[] {
  const ally = friendly(s).find((p) => p.id === e.id);
  if (!ally) return [];
  const options: Option[] = [];
  const sourceView = seatView(s, controller(s, ally.id)!);
  if (!isTextBlank(s, ally) && !sourceView.flags[`${e.token}:${ally.id}`]) {
    if (ally.code === "33002" && sourceView.player.discard.some(signature))
      options.push(
        O(
          ally.id,
          "Phoenix · recover a Cyclops card",
          [
            C("entry-own", {
              ...e,
              type: "cyclops:entry-own",
              actorId: sourceView.activePlayerId,
            }),
          ],
          ally.code,
        ),
      );
    if (
      ally.code === "33011" &&
      [...sourceView.player.deck, ...sourceView.player.discard].some(
        (p) => card(p).type_code === "resource",
      )
    )
      options.push(
        O(
          ally.id,
          "Beast · find a resource card",
          [
            C("entry-own", {
              ...e,
              type: "cyclops:entry-own",
              actorId: sourceView.activePlayerId,
            }),
          ],
          ally.code,
        ),
      );
    if (ally.code === "33014" && s.encounter.deck.length)
      options.push(
        O(
          ally.id,
          "Blindfold · inspect the top 5 encounter cards",
          [
            C("entry-own", {
              ...e,
              type: "cyclops:entry-own",
              actorId: sourceView.activePlayerId,
            }),
          ],
          ally.code,
        ),
      );
  }
  if (!ports.hasTrait(s, ally.id, "X-Men")) return options;
  for (const seat of playerOrder(s)) {
    const v = seatView(s, seat);
    for (const p of v.player.inPlay.filter(
      (p) =>
        ["33020", "36024", "33021"].includes(p.code) &&
        !p.exhausted &&
        !isTextBlank(v, p),
    )) {
      if (p.code !== "33021") {
        if (
          ports
            .friendlyTargets(s)
            .some(
              (t) =>
                ports.hasTrait(s, t.id, "X-Men") && ports.canReady(s, t.id),
            )
        )
          options.push(
            O(
              p.id,
              "Utopia · ready an X-Men character",
              [
                C("utopia", {
                  ...e,
                  type: "cyclops:utopia",
                  support: p.id,
                  actorId: seat.id,
                }),
              ],
              p.code,
            ),
          );
      } else if (
        !allInPlay(s).some(
          (t) => t.attachedTo === ally.id && trait(t, "Training"),
        )
      ) {
        for (const actor of playerOrder(s)) {
          const av = seatView(s, actor);
          if (
            av.player.form === "alter" &&
            (actor.id === seat.id ||
              ports.hasTrait(av, `hero:${actor.id}`, "Mutant")) &&
            [...av.player.deck, ...av.player.discard].some((p) =>
              trait(p, "Training"),
            )
          )
            options.push(
              O(
                `${p.id}:${actor.id}`,
                `Danger Room · ${card({ code: heroCode(av) })?.name || actor.heroId} finds Training`,
                [
                  C("danger", {
                    ...e,
                    type: "cyclops:danger",
                    support: p.id,
                    actorId: actor.id,
                  }),
                ],
                p.code,
              ),
            );
        }
      }
    }
  }
  return options;
}
const heroCode = (s: GameState) =>
  (catalog as unknown as Card[]).find(
    (c) =>
      c.set_code === s.heroId &&
      c.type_code === (s.player.form === "hero" ? "hero" : "alter_ego"),
  )?.code || "33001a";
export function cyclopsInitializeNemesis(
  s: GameState,
  ports: Pick<CyclopsPorts, "makePiece">,
) {
  if (!active(s) || s.flags.cyclopsNemesisInitialized) return;
  const zone = (s.player.setAside ||= []);
  for (const code of ["33028", "33029", "33030", "33031"])
    for (
      let n = zone.filter((p) => p.code === code).length;
      n < (code === "33030" ? 2 : 1);
      n++
    ) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      zone.push(p);
    }
  s.flags.cyclopsNemesisInitialized = true;
}
export function cyclopsShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [];
  return [
    ...zone
      .filter((p) => ["33028", "33029"].includes(p.code))
      .map((p) => C("reveal-setaside", { id: p.id })),
    C("shuffle-nemesis", {
      ids: zone
        .filter((p) => ["33030", "33031"].includes(p.code))
        .map((p) => p.id),
    }),
  ];
}
export function cyclopsEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (!["33027", "33028", "33029", "33030", "33031"].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "33027") {
    const seat = playerOrder(s).find((p) => p.heroId === "cyclops");
    return seat ? [C("lost-visor", { piece: p, actorId: seat.id })] : [];
  }
  if (p.code === "33030") return [C("gene-therapy", { piece: p })];
  if (p.code === "33031") {
    const sinister = s.minions.find((p) => p.code === "33028");
    return [
      sinister
        ? E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
            id: sinister.id,
          })
        : s.player.form === "hero"
          ? E("damage", { target: "hero", amount: 2, source: p.id })
          : E("threat", { amount: 2, target: "main" }),
    ];
  }
  return [];
}
export function cyclopsBoost(s: GameState, p: Piece): Effect[] | null {
  if (!["33027", "33028", "33029", "33030", "33031"].includes(p.code))
    return null;
  return p.code === "33028" && !isTextBlank(s, p)
    ? [
        s.player.stunned
          ? E("damage", { target: "hero", amount: 2, source: p.id })
          : E("status", { target: "hero", status: "stunned" }),
      ]
    : [];
}
export function cyclopsSideSchemeDefeated(_s: GameState, p: Piece): Effect[] {
  return p.code === "33029" ? [C("genetics")] : [];
}
export function cyclopsEnemyAttackStarted(s: GameState, id: string): Effect[] {
  return s.attachments
    .filter(
      (p) => p.code === "33030" && p.attachedTo === id && !isTextBlank(s, p),
    )
    .map((p) => C("gene-attack", { id: p.id }));
}
function search(
  s: GameState,
  ports: CyclopsPorts,
  title: string,
  pieces: Piece[],
  after: Effect[],
  shuffle: boolean,
  attachTo?: string,
) {
  if (!pieces.length) {
    if (shuffle) ports.shufflePlayerDeck(s, after);
    else ports.queue(s, ...after);
    return;
  }
  ports.choose(s, title, "Choose an actual card.", [
    ...pieces.map((p) =>
      O(
        p.id,
        card(p).name,
        [C("searched", { id: p.id, after, shuffle, attachTo })],
        p.code,
      ),
    ),
    ...(shuffle
      ? [
          O("fail", "Finish search without a card", [
            C("searched", { after, shuffle: true }),
          ]),
        ]
      : []),
  ]);
}
export function resolveCyclopsEffect(
  s: GameState,
  e: Effect,
  ports: CyclopsPorts,
): boolean {
  if (!e.type.startsWith("cyclops:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "cyclops:training":
      need(
        active(s) &&
          s.player.form === "alter" &&
          s.flags.cyclopsTrainingRound !== s.round,
        "Constant Training is unavailable.",
      );
      s.flags.cyclopsTrainingRound = s.round;
      search(
        s,
        ports,
        "Constant Training",
        s.player.deck.filter(
          (p) => trait(p, "Tactic") && card(p).type_code === "upgrade",
        ),
        after,
        true,
      );
      break;
    case "cyclops:searched": {
      const zones = [s.player.deck, s.player.discard],
        zone = zones.find((z) => z.some((p) => p.id === e.id));
      if (e.id) need(zone, "The actual searched card is unavailable.");
      if (zone) {
        const p = zone.splice(
          zone.findIndex((p) => p.id === e.id),
          1,
        )[0];
        if (e.attachTo) {
          p.exhausted = false;
          p.damage = 0;
          p.counters = 0;
          s.player.inPlay.push(p);
          ports.attach(s, p.id, e.attachTo);
        } else s.player.hand.push(p);
      }
      if (e.shuffle) ports.shufflePlayerDeck(s, after);
      else ports.queue(s, ...after);
      break;
    }
    case "cyclops:optic": {
      need(
        cyclopsAbilityOptions(s, "identity", ports).some(
          (o) => o.id === "optic-blast",
        ),
        "Optic Blast is unavailable.",
      );
      ports.choose(
        s,
        "Optic Blast",
        "Choose an enemy with an upgrade attached.",
        ports
          .enemyTargets(s, true)
          .filter((t) => anyUpgrade(s, t.id))
          .map((t) =>
            O(t.id, t.label, [C("optic-pay", { target: t.id })], t.code),
          ),
      );
      break;
    }
    case "cyclops:optic-pay":
      need(
        cyclopsAbilityOptions(s, "identity", ports).some(
          (o) => o.id === "optic-blast",
        ) &&
          ports.enemyTargets(s, true).some((t) => t.id === e.target) &&
          anyUpgrade(s, e.target),
        "Optic Blast target is unavailable.",
      );
      delete s.flags.cyclopsOpticVisor;
      delete s.flags.cyclopsFullBlast;
      ports.pay(
        s,
        "Optic Blast",
        1,
        [C("optic-paid", { target: e.target })],
        "33001a",
      );
      break;
    case "cyclops:optic-paid": {
      s.flags.cyclopsOpticRound = s.round;
      const opts =
        !s.player.exhausted && !s.player.stunned
          ? ports
              .reactionEvents(s)
              .filter(
                (p) =>
                  p.code === "33008" &&
                  !isTextBlank(s, p) &&
                  ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
              )
              .map((p) =>
                O(
                  p.id,
                  "Full Blast · exhaust Cyclops, +8 damage and overkill",
                  [C("fullblast-play", { id: p.id, target: e.target })],
                  p.code,
                ),
              )
          : [];
      if (opts.length)
        ports.choose(s, "Optic Blast", "Use Full Blast before this attack?", [
          ...opts,
          O("continue", "Continue with Optic Blast", [
            C("optic-hit", { target: e.target }),
          ]),
        ]);
      else ports.queue(s, C("optic-hit", { target: e.target }));
      break;
    }
    case "cyclops:fullblast-play":
      need(
        !s.player.exhausted && s.player.form === "hero" && active(s),
        "Full Blast needs ready Cyclops.",
      );
      ports.playReaction(
        s,
        e.id,
        [C("fullblast-cost")],
        [C("optic-hit", { target: e.target })],
      );
      break;
    case "cyclops:fullblast-cost":
      need(!s.player.exhausted, "Cyclops cannot exhaust.");
      s.player.exhausted = true;
      s.flags.cyclopsFullBlast = true;
      break;
    case "cyclops:optic-hit": {
      const full = !!s.flags.cyclopsFullBlast,
        visor = !!s.flags.cyclopsOpticVisor;
      delete s.flags.cyclopsFullBlast;
      delete s.flags.cyclopsOpticVisor;
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: full ? 11 : 3,
            attack: true,
            attackInitiated: true,
            source: "hero",
            piercing: visor,
            ranged: visor,
            overkill: full,
          }),
        ],
        after,
      );
      break;
    }
    case "cyclops:attach": {
      const p = own(s, e.id);
      if (!p || p.attachedTo) break;
      const opts = cyclopsAttachmentTargets(s, p, ports) || [];
      if (opts.length)
        ports.choose(
          s,
          card(p).name,
          "Choose a legal attachment target.",
          opts.map((t) =>
            O(
              t.id,
              t.label,
              [C("attach-to", { id: p.id, target: t.id })],
              t.code,
            ),
          ),
        );
      break;
    }
    case "cyclops:attach-to": {
      const p = own(s, e.id);
      need(
        p &&
          cyclopsAttachmentTargets(s, p!, ports)?.some(
            (t) => t.id === e.target,
          ),
        "Attachment target is unavailable.",
      );
      ports.attach(s, e.id, e.target);
      break;
    }
    case "cyclops:event": {
      const p: Piece = e.piece;
      if (p.code === "33009")
        ports.attackProgram(
          s,
          [
            C("beam", { ordinal: 1, piece: p }),
            C("beam", { ordinal: 2, piece: p }),
          ],
          after,
        );
      else if (p.code === "33010")
        ports.queue(
          s,
          E("target", {
            group: "scheme",
            title: "Tactical Brilliance",
            action: E("thwart", { amount: 3, thwart: true, source: "hero" }),
          }),
          C("brilliance"),
          ...after,
        );
      else if (p.code === "33022") {
        const opts = friendly(s).filter((p) =>
          allInPlay(s).some(
            (t) => t.attachedTo === p.id && trait(t, "Training"),
          ),
        );
        ports.choose(
          s,
          "Game Time",
          "Choose an ally with Training.",
          opts.map((a) =>
            O(
              a.id,
              card(a).name,
              [
                E("ready", { target: a.id }),
                E("heal", { target: a.id, amount: 1 }),
                ...after,
              ],
              a.code,
            ),
          ),
        );
      } else {
        ports.queue(
          s,
          ...rapportCharacters(s, ports).map((t) =>
            E("ready", { target: t.id }),
          ),
          C("rapport-choice"),
          ...after,
        );
      }
      break;
    }
    case "cyclops:beam": {
      const opts = ports
        .enemyTargets(s, true)
        .filter((t) => e.ordinal === 1 || anyUpgrade(s, t.id));
      if (opts.length)
        ports.choose(
          s,
          "Ricochet Beam",
          e.ordinal === 1
            ? "Deal 3 damage to an enemy."
            : "Deal 3 damage to an enemy with an upgrade attached.",
          opts.map((t) =>
            O(
              t.id,
              t.label,
              [
                E("damage", {
                  target: t.id,
                  amount: 3,
                  attack: true,
                  attackInitiated: true,
                  source: "hero",
                  abilitySource: e.piece.id,
                  eventCode: e.piece.code,
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "cyclops:brilliance":
      search(
        s,
        ports,
        "Tactical Brilliance",
        s.player.discard.filter((p) => trait(p, "Tactic")),
        after,
        false,
      );
      break;
    case "cyclops:rapport-choice": {
      const opts: Option[] = [];
      if (s.player.discard.some(signature))
        opts.push(
          O(
            "recover",
            "Return a Cyclops card",
            [C("rapport-recover")],
            "33023",
          ),
        );
      for (const seat of playerOrder(s)) {
        const f = seatView(s, seat).player.inPlay.find((p) =>
          ["34002a", "34002b"].includes(p.code),
        );
        if (f)
          opts.push(
            O(
              f.id,
              "Place 2 power counters on Phoenix Force",
              [C("rapport-power", { id: f.id, actorId: seat.id })],
              f.code,
            ),
          );
      }
      if (opts.length)
        ports.choose(s, "Psychic Rapport", "Choose an effect.", opts);
      break;
    }
    case "cyclops:rapport-recover":
      search(
        s,
        ports,
        "Psychic Rapport",
        s.player.discard.filter(signature),
        after,
        false,
      );
      break;
    case "cyclops:rapport-power": {
      const p = own(s, e.id);
      if (p && ["34002a", "34002b"].includes(p.code)) {
        p.counters += 2;
        if (p.code === "34002b" && p.counters >= 4) p.code = "34002a";
      }
      break;
    }
    case "cyclops:leadership":
      s.flags[`cyclopsLeadership:${e.id}`] =
        Number(s.flags[`cyclopsLeadership:${e.id}`] || 0) + 1;
      break;
    case "cyclops:ally-window": {
      const options = entryOptions(s, e, ports);
      if (options.length)
        ports.choose(
          s,
          "X-Men ally enters play",
          "Choose an optional response.",
          [
            ...options,
            O(
              "continue",
              "Continue",
              after.map((x) => ({ ...x, actorId: e.origin })),
            ),
          ],
        );
      else ports.queue(s, ...after.map((x) => ({ ...x, actorId: e.origin })));
      break;
    }
    case "cyclops:entry-own": {
      const ally = friendly(s).find((p) => p.id === e.id);
      if (!ally) break;
      s.flags[`${e.token}:${ally.id}`] = true;
      const resume = [{ ...e, type: "cyclops:ally-window", actorId: e.origin }];
      if (ally.code === "33002")
        search(
          s,
          ports,
          "Phoenix",
          s.player.discard.filter(signature),
          resume,
          false,
        );
      else if (ally.code === "33011")
        search(
          s,
          ports,
          "Beast",
          [...s.player.deck, ...s.player.discard].filter(
            (p) => card(p).type_code === "resource",
          ),
          resume,
          true,
        );
      else if (ally.code === "33014") {
        ports.revealHidden(s);
        const top = s.encounter.deck.slice(0, 5);
        ports.choose(
          s,
          "Blindfold",
          "Discard 1 inspected encounter card; preserve the remaining order.",
          top.map((p) =>
            O(
              p.id,
              card(p).name,
              [C("blindfold-discard", { id: p.id, after: resume })],
              p.code,
            ),
          ),
        );
      }
      break;
    }
    case "cyclops:blindfold-discard": {
      const i = s.encounter.deck.slice(0, 5).findIndex((p) => p.id === e.id);
      need(i >= 0, "The inspected encounter card is unavailable.");
      s.encounter.discard.push(s.encounter.deck.splice(i, 1)[0]);
      ports.queue(s, ...after);
      break;
    }
    case "cyclops:utopia": {
      const p = allInPlay(s).find((p) => p.id === e.support);
      need(p && !p.exhausted && !isTextBlank(s, p!), "Utopia is unavailable.");
      const targets = ports
        .friendlyTargets(s)
        .filter(
          (t) => ports.hasTrait(s, t.id, "X-Men") && ports.canReady(s, t.id),
        );
      if (targets.length)
        ports.choose(
          s,
          "Utopia",
          "Choose an X-Men character to ready.",
          targets.map((t) =>
            O(
              t.id,
              t.label,
              [
                C("utopia-ready", {
                  ...e,
                  type: "cyclops:utopia-ready",
                  target: t.id,
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "cyclops:utopia-ready": {
      const p = allInPlay(s).find((p) => p.id === e.support);
      need(
        p &&
          !p.exhausted &&
          ports.canReady(s, e.target) &&
          ports.hasTrait(s, e.target, "X-Men"),
        "Utopia needs its actual ready support and a character that can ready.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: e.target }), {
        ...e,
        type: "cyclops:ally-window",
        actorId: e.origin,
      });
      break;
    }
    case "cyclops:danger": {
      const p = allInPlay(s).find((p) => p.id === e.support);
      need(
        p && !p.exhausted && !isTextBlank(s, p!) && s.player.form === "alter",
        "Danger Room is unavailable.",
      );
      p!.exhausted = true;
      search(
        s,
        ports,
        "Danger Room",
        [...s.player.deck, ...s.player.discard].filter((p) =>
          trait(p, "Training"),
        ),
        [{ ...e, type: "cyclops:ally-window", actorId: e.origin }],
        true,
        e.id,
      );
      break;
    }
    case "cyclops:lost-visor": {
      const obligation: Piece = e.piece;
      ports.keepObligation(s, obligation);
      const p = [
        ...s.player.hand,
        ...s.player.deck,
        ...s.player.discard,
        ...s.player.inPlay,
      ].find((p) => p.code === "33003");
      if (p) {
        if (s.player.inPlay.some((q) => q.id === p.id))
          ports.discardPiece(s, p.id);
        for (const z of [s.player.hand, s.player.deck, s.player.discard]) {
          const i = z.findIndex((q) => q.id === p.id);
          if (i >= 0) z.splice(i, 1);
        }
        (obligation.storedCards ||= []).push(p);
      }
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "cyclops:recover-visor": {
      const p = own(s, e.id);
      need(
        p?.code === "33027" &&
          active(s) &&
          s.player.form === "alter" &&
          !s.player.exhausted,
        "Lost Visor needs ready Scott Summers.",
      );
      s.player.exhausted = true;
      s.player.hand.push(...(p!.storedCards || []));
      p!.storedCards = [];
      ports.removeEncounter(s, p!);
      break;
    }
    case "cyclops:reveal-setaside": {
      const i = s.player.setAside?.findIndex((p) => p.id === e.id) ?? -1;
      if (i >= 0) ports.revealEncounter(s, s.player.setAside!.splice(i, 1)[0]);
      break;
    }
    case "cyclops:shuffle-nemesis":
      for (const id of e.ids as string[]) {
        const i = s.player.setAside?.findIndex((p) => p.id === id) ?? -1;
        if (i >= 0) s.encounter.deck.push(s.player.setAside!.splice(i, 1)[0]);
      }
      ports.shuffleEncounter(s);
      break;
    case "cyclops:genetics": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) => p.code === "33030",
      );
      if (p) {
        s.encounter.deck = s.encounter.deck.filter((q) => q.id !== p.id);
        s.encounter.discard = s.encounter.discard.filter((q) => q.id !== p.id);
        ports.revealEncounter(s, p);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "cyclops:gene-therapy": {
      const available = [s.villain, ...s.minions].filter(
        (p) =>
          !s.attachments.some(
            (q) => q.code === "33030" && q.attachedTo === p.id,
          ),
      );
      const lowest = Math.min(...available.map((p) => card(p)?.attack || 0));
      const targets = available.filter(
        (p) => (card(p)?.attack || 0) === lowest,
      );
      if (!targets.length) ports.queue(s, E("surge", { sourceCode: "33030" }));
      else
        ports.choose(
          s,
          "Gene Therapy",
          "Choose the enemy with lowest printed ATK.",
          targets.map((p) =>
            O(
              p.id,
              card(p)?.name || "Minion",
              [C("gene-attach", { piece: e.piece, target: p.id })],
              p.code,
            ),
          ),
        );
      break;
    }
    case "cyclops:gene-attach":
      ports.attachEncounter(s, e.piece, e.target);
      break;
    case "cyclops:gene-attack":
      if (s.attack) {
        s.attack.overkill = true;
        s.attack.piercing = true;
        (s.attack.afterActivation ||= []).push(E("discardPiece", { id: e.id }));
      }
      break;
    default:
      throw Error(`Unknown Cyclops effect ${e.type}`);
  }
  return true;
}
