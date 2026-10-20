import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { card } from "./card-definitions.js";
import { eventPlaySources, isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type {
  Effect,
  GameState,
  Option,
  Piece,
  Prompt,
  Resource,
} from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const J = (type: string, args: Record<string, unknown> = {}) =>
  E(`jubilee:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const hero = (s: GameState) => s.player.form === "hero";
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const types: Resource[] = ["energy", "mental", "physical", "wild"];
const printedResources = (p: Piece) =>
  types.flatMap((r) =>
    Array<Resource>(Number(card(p)[`resource_${r}`] || 0)).fill(r),
  );
const hasTrait = (p: Piece, trait: string) =>
  (card(p).traits || "")
    .toLowerCase()
    .split(/\.\s*/)
    .includes(trait.toLowerCase());
const paid = (s: GameState, id: string): Resource[] => {
  const receipt = s.flags[`jubileePaid:${id}`];
  return typeof receipt === "string" ? JSON.parse(receipt) : [];
};
const target = (title: string, group: string, action: Effect, attack = false) =>
  E("target", {
    title,
    group,
    action: attack ? { ...action, attack: true, source: "hero" } : action,
  });
const attack = (amount: number, args: Record<string, unknown> = {}) =>
  E("damage", { amount, attack: true, source: "hero", ...args });
const thwart = (amount: number) =>
  E("thwart", { amount, action: true, source: "hero" });

export const JUBILEE_SCRIPT_CODES = [
  "47001a",
  "47001b",
  "47002",
  "47003",
  "47004",
  "47005",
  "47006",
  "47007a",
  "47007b",
  "47007c",
  "47008a",
  "47008b",
  "47008c",
  "47009",
  "47010a",
  "47010b",
  "47010c",
  ...Array.from({ length: 24 }, (_, i) => String(47011 + i)),
];

export interface JubileeTarget {
  id: string;
  label: string;
  code?: string;
}
export interface JubileePorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  enemies(s: GameState, attack: boolean): JubileeTarget[];
  schemes(s: GameState, thwart: boolean): JubileeTarget[];
  controlled(s: GameState): JubileeTarget[];
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  maxHP(s: GameState, p: Piece): number;
  canReady(s: GameState): boolean;
  canPay(
    s: GameState,
    cost: number,
    exclude?: string,
    code?: string,
    req?: Resource[],
  ): boolean;
  canPayCard(s: GameState, p: Piece): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    after: Effect[],
    requirements?: Resource[],
    cancelAfter?: Effect[],
  ): void;
  reaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
    cancelAfter?: Effect[],
    commit?: Effect[],
  ): void;
  discard(s: GameState, id: string): void;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  transfer(s: GameState, id: string, player: string): void;
  canPut(s: GameState, p: Piece): boolean;
  put(s: GameState, p: Piece): void;
  playAlly(s: GameState, p: Piece): void;
  returnAlly(s: GameState, id: string): void;
  keepObligation(s: GameState, p: Piece): void;
  attach(s: GameState, p: Piece, target: string): void;
  discardEncounterTop(s: GameState): Piece | undefined;
  reveal(s: GameState, p: Piece): void;
  canStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  basic(
    s: GameState,
    id: string,
    power: "attack" | "thwart",
    bonus: number,
  ): void;
  basicPowers(s: GameState, id: string): ("attack" | "thwart")[];
  heroPower(s: GameState, power: "attack" | "thwart"): number;
  allyPower(s: GameState, p: Piece, power: "attack" | "thwart"): number;
}

export function jubileeInitialize(
  s: GameState,
  makePiece: JubileePorts["makePiece"],
) {
  if (s.heroId !== "jubilee" || s.flags.jubileeInitialized) return;
  for (const code of ["47024", "47025", "47026", "47027", "47027"])
    (s.player.setAside ||= []).push(makePiece(s, code));
  s.flags.jubileeInitialized = true;
}

export function jubileeStats(s: GameState) {
  return {
    attack:
      hero(s) && s.heroId === "jubilee"
        ? allInPlay(s).filter((p) => p.code === "47005" && !isTextBlank(s, p))
            .length
        : 0,
    thwart:
      hero(s) && s.heroId === "jubilee"
        ? allInPlay(s).filter((p) => p.code === "47004" && !isTextBlank(s, p))
            .length
        : 0,
  };
}
export function jubileeResourceSources(s: GameState): PaymentSource[] {
  return s.heroId === "jubilee" &&
    hero(s) &&
    !s.player.exhausted &&
    !isTextBlank(s, "47001a")
    ? [
        {
          id: "jubilee-like-totally",
          name: "Like, totally!",
          code: "47001a",
          resources: ["wild"],
          kind: "ability",
          description: "Exhaust Jubilee · generate 1 wild resource",
        },
      ]
    : [];
}
export function jubileeSpendResource(s: GameState, id: string) {
  if (id !== "jubilee-like-totally") return false;
  need(
    jubileeResourceSources(s).length,
    "Jubilee must be ready in hero form to generate this resource.",
  );
  s.player.exhausted = true;
  return true;
}
/** RRG1.8 p48: every Wild can be declared E/M/P/W independently. P13:
 * overpaid resources were not paid for the cost and cannot increase this receipt. */
export function jubileeTrackPayment(s: GameState, p: Prompt) {
  return (
    !!p.after?.some((e) => e.jubileeResources) ||
    !!(
      p.card &&
      !p.abilityCost &&
      card(p.card).type_code === "event" &&
      (card(p.card).pack_code === "jubilee" ||
        live(s, "47004").length ||
        live(s, "47005").length)
    )
  );
}
export function jubileePayment(
  s: GameState,
  p: Piece | undefined,
  used: Resource[],
) {
  if (p && card(p).type_code === "event")
    s.flags[`jubileePaid:${p.id}`] = JSON.stringify(used);
}

export function jubileePlayRestriction(
  s: GameState,
  p: Piece,
  ports: JubileePorts,
): string | null {
  if (
    p.code === "47006" &&
    !ports
      .enemies(s, false)
      .some(
        (t) =>
          ports.canStatus(s, t.id, "stunned") ||
          ports.canStatus(s, t.id, "confused"),
      )
  )
    return "Blinding Flash requires an enemy that can receive a stun or confuse status.";
  if (["47014", "47029"].includes(p.code))
    return "Available in its printed response or interrupt window.";
  if (
    p.code === "47013" &&
    !playerOrder(s).some((seat) => !live(seatView(s, seat), "47013").length)
  )
    return "Each player already controls Disguise.";
  if (p.code === "47018" && !ports.hasTrait(s, "hero", "X-Men"))
    return "Synch requires an X-Men identity.";
  if (p.code === "47022" && !teamUp(s))
    return "Unlikely Duo requires Jubilee and Wolverine in play.";
  if (
    p.code === "47022" &&
    !ports.enemies(s, true).some((t) => ports.canStatus(s, t.id, "confused")) &&
    !ports
      .enemies(s, true)
      .some(
        (t) =>
          (t.id === s.villain.id ? s.villain : ports.find(s, t.id))?.confused,
      )
  )
    return "Unlikely Duo requires an enemy that can be confused or a confused enemy that can be attacked.";
  if (p.code === "47028" && !allyPairs(s, ports).length)
    return "Mutant Mayhem requires two different allies: one X-Force and one X-Men.";
  return null;
}
const teamUp = (s: GameState) => {
  const names = [
    ...playerOrder(s)
      .filter((seat) => seatView(s, seat).player.form === "hero")
      .map(
        (seat) =>
          card(
            seatView(s, seat).heroId === "jubilee"
              ? "47001a"
              : seatView(s, seat).heroId === "wolverine"
                ? "35001a"
                : "01001a",
          ).name,
      ),
    ...allInPlay(s)
      .filter((p) => card(p).type_code === "ally")
      .map((p) => card(p).name),
  ];
  return (
    names.includes("Jubilee") &&
    names.includes("Wolverine") &&
    (["jubilee", "wolverine"].includes(s.heroId) ||
      s.player.inPlay.some(
        (p) =>
          card(p).type_code === "ally" &&
          ["Jubilee", "Wolverine"].includes(card(p).name),
      ))
  );
};
const allies = (s: GameState) =>
  [
    ...allInPlay(s),
    ...(s.sabretooth?.kelly ? [s.sabretooth.kelly] : []),
  ].filter(
    (p) =>
      !p.treatedAsMinion && (card(p).type_code === "ally" || p.treatedAsAlly),
  );
const allyPairs = (s: GameState, ports: JubileePorts) =>
  allies(s)
    .filter(
      (p) =>
        card(p).faction_code !== "encounter" &&
        ports.hasTrait(s, p.id, "X-Force"),
    )
    .flatMap((a) =>
      allies(s)
        .filter(
          (b) =>
            card(b).faction_code !== "encounter" &&
            b.id !== a.id &&
            ports.hasTrait(s, b.id, "X-Men"),
        )
        .map((b) => [a, b]),
    );

export function jubileeBeforePlay(s: GameState, p: Piece): Effect[] | null {
  return p.code === "47028" &&
    typeof s.flags[`jubileeMayhem:${p.id}`] !== "string"
    ? [J("mayhem-select", { id: p.id })]
    : null;
}
export function jubileePaymentCommit(s: GameState, p: Piece): Effect[] {
  return p.code === "47028" ? [J("mayhem-return", { id: p.id })] : [];
}
export function jubileePaymentPreflight(
  s: GameState,
  p: Piece,
  ports: JubileePorts,
) {
  if (p.code !== "47028") return;
  const raw = s.flags[`jubileeMayhem:${p.id}`];
  const ids: string[] = typeof raw === "string" ? JSON.parse(raw) : [];
  need(
    allyPairs(s, ports).some(
      (pair) => pair[0].id === ids[0] && pair[1].id === ids[1],
    ),
    "The two Mutant Mayhem allies must still be in play.",
  );
}
export function jubileeEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "47019") p.counters = 3;
  return p.code === "47013" ? [J("disguise-controller", { id: p.id })] : [];
}
export function jubileeFormChanged(s: GameState, previous: string): Effect[] {
  return previous !== "alter" && s.player.form === "alter"
    ? live(s, "47002")
        .filter((p) => p.damage > 0)
        .map((p) =>
          E("optional", {
            title: "Wolverine",
            text: "Heal 3 damage from Wolverine?",
            effects: [E("heal", { target: p.id, amount: 3 })],
          }),
        )
    : [];
}
export function jubileeCanRemoveThreat(
  s: GameState,
  id: string,
  source = "hero",
) {
  const scheme = s.sideSchemes.find(
    (p) => p.id === id && p.code === "47003" && !isTextBlank(s, p),
  );
  if (!scheme) return true;
  const p = [...allInPlay(s), ...s.resolving, ...s.sideSchemes].find(
    (p) => p.id === source,
  );
  if (p && ["support", "player_side_scheme"].includes(card(p).type_code))
    return true;
  if (p && card(p).type_code === "ally") return false;
  if (source.startsWith("hero:"))
    return seatView(s, source.slice(5)).player.form === "alter";
  return s.player.form === "alter";
}
export function jubileeGenerationBonus(
  s: GameState,
  id: string,
  targetId: string,
  ports: Pick<JubileePorts, "hasTrait">,
) {
  return s.sideSchemes.some(
    (p) => p.id === targetId && p.code === "47016" && !isTextBlank(s, p),
  ) && ports.hasTrait(s, id, "X-Men")
    ? 1
    : 0;
}
export function jubileeSideReward(s: GameState, p: Piece): Effect[] {
  if (p.code === "47003")
    return [J("search", { title: "Shopping Spree", item: true, put: true })];
  if (p.code === "47016")
    return playerOrder(s).map((seat) =>
      J("search", {
        title: "Generation X",
        event: true,
        optional: true,
        actorId: seat.id,
      }),
    );
  return [];
}
export function jubileeTrapDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "47031")
    return [E("damage", { target: "hero", amount: 2, source: p.id })];
  if (p.code === "47032")
    return s.player.stunned
      ? [J("trap-discard")]
      : [E("status", { target: "hero", status: "stunned" })];
  if (p.code === "47033")
    return s.player.confused
      ? [E("threat", { target: "main", amount: 2 })]
      : [E("status", { target: "hero", status: "confused" })];
  return [];
}
export function jubileeCanDamage(s: GameState, id: string) {
  const p = s.minions.find((p) => p.id === id && p.code === "47030");
  return (
    !p || isTextBlank(s, p) || !s.sideSchemes.some((q) => hasTrait(q, "Trap!"))
  );
}
export function jubileeEnemyHealth(s: GameState, p: Piece) {
  return (
    s.attachments.filter(
      (a) => a.attachedTo === p.id && a.code === "47026" && !isTextBlank(s, a),
    ).length * 3
  );
}
export function jubileeEnemyScheme(s: GameState, p: Piece): number | undefined {
  return s.attachments.some(
    (a) => a.code === "47027" && a.attachedTo === p.id && !isTextBlank(s, a),
  )
    ? card(p).thwart || 0
    : undefined;
}
export function jubileeEnemyTrait(s: GameState, id: string, trait: string) {
  return (
    (trait.toLowerCase() === "regressed" &&
      s.attachments.some(
        (a) => a.code === "47027" && a.attachedTo === id && !isTextBlank(s, a),
      )) ||
    (trait.toLowerCase() === "aerial" &&
      s.attachments.some(
        (a) => a.code === "47026" && a.attachedTo === id && !isTextBlank(s, a),
      ))
  );
}

export function jubileeEvent(
  s: GameState,
  p: Piece,
  used: Resource[] = paid(s, p.id),
): Effect[] | null {
  const count = new Set(used).size;
  const code = p.code;
  if (code === "47006") return [J("flash", { remaining: count, chosen: [] })];
  if (/^47007[abc]$/.test(code))
    return [target("Firecracker", "enemy", J("firecracker", { count }), true)];
  if (/^47008[abc]$/.test(code))
    return [
      target("Flash of Light", "scheme", thwart(3)),
      ...(count === 2
        ? [
            J("status-choice", {
              title: "Flash of Light · confuse",
              status: "confused",
            }),
          ]
        : []),
    ];
  if (code === "47009") return [J("finale", { remaining: count + 1 })];
  if (code === "47015") return [J("steps", { remaining: count })];
  if (code === "47021")
    return [
      ...(used.includes("physical")
        ? [target("Multitalented · damage", "enemy", attack(2), true)]
        : []),
      ...(used.includes("mental")
        ? [target("Multitalented · threat", "scheme", thwart(2))]
        : []),
      ...(used.includes("energy")
        ? [E("heal", { target: "hero", amount: 2 })]
        : []),
      ...(!used.includes("mental")
        ? [
            E("scarletHeroThwartResponse", {
              snapshot: {
                scheme: "",
                beforeThreat: 0,
                removed: 0,
                playerId: s.activePlayerId,
                wasHero: true,
                source: "hero",
                basic: false,
                thwart: true,
                removedAllThreat: false,
              },
            }),
          ]
        : []),
      ...(!used.includes("physical")
        ? [
            E("heroAttackResponses", {
              target: "",
              wasMinion: false,
              excessDamage: 0,
            }),
          ]
        : []),
    ];
  if (code === "47022")
    return [
      J("status-choice", {
        title: "Unlikely Duo · confuse",
        status: "confused",
        attack: true,
      }),
      J("duo-damage", {
        initiallyConfused: [s.villain, ...s.minions]
          .filter((p) => p.confused)
          .map((p) => p.id),
      }),
    ];
  if (code === "47028") return [J("mayhem-replays", { id: p.id })];
  if (["47014", "47029"].includes(code)) return [];
  return null;
}

export function jubileeAfterEventOptions(
  s: GameState,
  p: Piece,
  used: string[],
  after: Effect[],
): Option[] {
  const result: Option[] = [];
  const text = card(p).traits || "";
  const amount = new Set(paid(s, p.id)).size;
  for (const [code, trait, power] of [
    ["47004", "Thwart.", "thwart"],
    ["47005", "Attack.", "attack"],
  ])
    if (hero(s) && amount && text.includes(trait))
      for (const q of live(s, code).filter(
        (q) => !q.exhausted && !used.includes(q.id),
      ))
        result.push(
          O(
            q.id,
            `${card(q).name} · ${power === "attack" ? "deal damage" : "remove threat"}`,
            [
              J("coat-response", { id: q.id, amount, power }),
              ...after.map((e) => ({ ...e, jubileeUsed: [...used, q.id] })),
            ],
            q.code,
          ),
        );
  if (card(p).set_code === "jubilee")
    for (const q of live(s, "47023").filter((q) => !used.includes(q.id)))
      result.push(
        O(
          q.id,
          "Grounded · remove from the game",
          [
            J("remove-grounded", { id: q.id }),
            ...after.map((e) => ({ ...e, jubileeUsed: [...used, q.id] })),
          ],
          q.code,
        ),
      );
  return result;
}
export function jubileeAfterThwartOptions(
  s: GameState,
  removedAll: boolean,
  after: Effect[],
  ports: JubileePorts,
): Option[] {
  if (!hero(s)) return [];
  return eventPlaySources(s)
    .filter((p) => p.code === "47014" && ports.canPayCard(s, p))
    .map((p) =>
      O(
        p.id,
        `Play Waylay · ${removedAll ? 7 : 4} damage`,
        [J("waylay", { id: p.id, amount: removedAll ? 7 : 4, after })],
        p.code,
      ),
    );
}
export function jubileeSynchOptions(
  s: GameState,
  packet: Effect,
  power: string,
): Option[] {
  if (packet.jubileeSynchHandled || deadpoolTriggeredBlocked(s)) return [];
  return live(s, "47018")
    .filter((p) => !p.exhausted)
    .map((p) =>
      O(
        p.id,
        `Synch · +1 ${power.toUpperCase()}`,
        [J("synch", { id: p.id, packet })],
        p.code,
      ),
    );
}
export function jubileeBeforeAlly(
  s: GameState,
  p: Piece,
  packet: Effect,
  ports: JubileePorts,
): Effect[] | null {
  if (
    deadpoolTriggeredBlocked(s) ||
    p.code !== "47012" ||
    packet.jubileeHuskHandled ||
    isTextBlank(s, p) ||
    (packet.kind === "attack" ? p.stunned : p.confused)
  )
    return null;
  const continuation = { ...packet, jubileeHuskHandled: true };
  const options = [1, 2, 3]
    .filter((n) => ports.canPay(s, n))
    .map((n) =>
      O(
        String(n),
        `Spend ${n} resource${n === 1 ? "" : "s"}`,
        [J("husk-pay", { id: p.id, amount: n, packet: continuation })],
        p.code,
      ),
    );
  return options.length
    ? [
        J("choice", {
          title: "Husk",
          text: "Spend up to 3 resources before this basic power?",
          options: [
            ...options,
            O("continue", "Continue without spending", [continuation]),
          ],
        }),
      ]
    : null;
}
export function jubileeChamberConsequence(
  s: GameState,
  p: Piece,
  targetId: string,
) {
  return p.code === "47011" &&
    !isTextBlank(s, p) &&
    !!(
      s.minions.find((q) => q.id === targetId) ||
      (s.villain.id === targetId ? s.villain : undefined)
    )?.confused
    ? 1
    : 0;
}

export function jubileeAbilityOptions(
  s: GameState,
  id: string,
  ports: JubileePorts,
): Option[] {
  if (["identity", "hero"].includes(id))
    return s.heroId === "jubilee" &&
      s.player.form === "alter" &&
      !isTextBlank(s, "47001b") &&
      s.flags.jubileeMallPhase !== phase(s) &&
      s.player.deck.some((p) => p.code === "47003")
      ? [
          O(
            "mall-rat",
            "Mall Rat · find Shopping Spree",
            [J("mall-rat")],
            "47001b",
          ),
        ]
      : [];
  const scheme = s.sideSchemes.find(
    (p) => p.id === id && p.code === "47003" && !isTextBlank(s, p),
  );
  if (scheme)
    return s.player.form === "alter" &&
      !s.player.exhausted &&
      scheme.counters > 0
      ? [
          O(
            "shopping-spree",
            "Shopping Spree · remove 1 threat",
            [J("shopping", { id })],
            scheme.code,
          ),
        ]
      : [];
  const p = s.player.inPlay.find((p) => p.id === id && !isTextBlank(s, p));
  if (!p || p.exhausted) return [];
  if (
    p.code === "47013" &&
    !s.player.exhausted &&
    ports.schemes(s, true).length
  )
    return [
      O(
        "disguise",
        "Disguise · remove 2 threat",
        [J("disguise", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "47019" &&
    p.counters > 0 &&
    playerOrder(s).some(
      (seat) => phoneCharacters(seatView(s, seat), ports).length,
    )
  )
    return [
      O(
        "cell-phone",
        "Cell Phone · call for a basic power",
        [J("phone", { id })],
        p.code,
      ),
    ];
  return [];
}
const phoneCharacters = (s: GameState, ports: JubileePorts) =>
  ports.controlled(s).filter((t) => ports.basicPowers(s, t.id).length > 0);

export function jubileeGrounded(s: GameState) {
  return s.heroId === "jubilee" &&
    s.player.form === "alter" &&
    s.phase === "player" &&
    s.turnPlayerId === s.activePlayerId
    ? live(s, "47023").length
    : 0;
}
export function jubileeGroundedOptions(
  s: GameState,
  counts: boolean,
  targetForm: string | undefined,
  ports: JubileePorts,
): Option[] {
  const cost = jubileeGrounded(s) * 2;
  return types
    .filter((r) =>
      ports.canPay(
        s,
        cost,
        undefined,
        undefined,
        Array<Resource>(cost).fill(r),
      ),
    )
    .map((r) =>
      O(
        r,
        `Spend ${cost} ${r} resources`,
        [J("grounded-pay", { cost, resource: r, counts, targetForm })],
        "47023",
      ),
    );
}

export function jubileeThreatOptions(
  s: GameState,
  packet: Effect,
  ports: JubileePorts,
): Option[] {
  if (!hero(s) || packet.target !== "main" || packet.amount <= 0) return [];
  const characters = ports.controlled(s).filter((t) => {
    if (t.id === "hero" || t.id === `hero:${s.activePlayerId}`)
      return !s.player.exhausted;
    return !ports.find(s, t.id)?.exhausted;
  });
  const pairs = characters
    .filter((t) => ports.hasTrait(s, t.id, "X-Force"))
    .flatMap((a) =>
      characters
        .filter((b) => b.id !== a.id && ports.hasTrait(s, b.id, "X-Men"))
        .map((b) => [a, b]),
    );
  if (!pairs.length) return [];
  return eventPlaySources(s)
    .filter((p) => p.code === "47029" && ports.canPayCard(s, p))
    .map((p) =>
      O(
        p.id,
        "Play Serve and Protect",
        [J("serve", { id: p.id, pairs, packet })],
        p.code,
      ),
    );
}
export function jubileeEnemyAttacked(
  s: GameState,
  p: Piece | undefined,
  playerId: string,
): Effect[] {
  return p?.code === "47024" &&
    !isTextBlank(s, p) &&
    allies(seatView(s, playerId)).some(
      (q) => controller(s, q.id)?.id === playerId,
    )
    ? [J("nanny", { actorId: playerId })]
    : [];
}
export function jubileeShadows(s: GameState): Effect[] | null {
  return s.heroId === "jubilee" ? [J("shadows")] : null;
}
export function jubileeEncounter(s: GameState, p: Piece): Effect[] | null {
  if (JUBILEE_SCRIPT_CODES.includes(p.code) && isTextBlank(s, p)) return [];
  if (p.code === "47023") return [J("grounded", { piece: p })];
  if (p.code === "47025") return [J("naughty", { id: p.id })];
  if (p.code === "47026") return [J("battle-suit", { piece: p })];
  if (p.code === "47027") return [J("lost-child", { piece: p })];
  if (p.code === "47030") return [J("find-trap")];
  if (p.code === "47034") return [J("elaborate")];
  if (["47024", "47031", "47032", "47033"].includes(p.code)) return [];
  return null;
}

export function resolveJubileeEffect(
  s: GameState,
  e: Effect,
  ports: JubileePorts,
): boolean {
  if (!e.type.startsWith("jubilee:")) return false;
  switch (e.type.slice(8)) {
    case "shadows": {
      const zone = s.player.setAside || [];
      const minion = zone.find((p) => p.code === "47024"),
        scheme = zone.find((p) => p.code === "47025");
      if (!minion) {
        ports.queue(s, E("surge"));
        break;
      }
      const cards = zone.filter((p) =>
        ["47024", "47025", "47026", "47027"].includes(p.code),
      );
      for (const p of cards) zone.splice(zone.indexOf(p), 1);
      s.encounter.deck.push(
        ...cards.filter((p) => p !== minion && p !== scheme),
      );
      ports.shuffleEncounter(s);
      s.flags.nemesis = true;
      ports.queue(
        s,
        E("reveal", { piece: minion }),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    case "choice":
      ports.choose(s, e.title, e.text, e.options);
      break;
    case "mall-rat": {
      need(
        s.heroId === "jubilee" &&
          s.player.form === "alter" &&
          s.flags.jubileeMallPhase !== phase(s),
        "Mall Rat is unavailable.",
      );
      const i = s.player.deck.findIndex((p) => p.code === "47003");
      need(i >= 0, "Shopping Spree is not in your deck.");
      const p = s.player.deck[i];
      need(ports.canPut(s, p), "Shopping Spree cannot enter play.");
      s.flags.jubileeMallPhase = phase(s);
      s.player.deck.splice(i, 1);
      ports.put(s, p);
      ports.shuffle(s);
      break;
    }
    case "shopping": {
      const p = s.sideSchemes.find(
        (p) => p.id === e.id && p.code === "47003" && !isTextBlank(s, p),
      );
      need(
        p && s.player.form === "alter" && !s.player.exhausted,
        "Shopping Spree requires a ready alter-ego.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("thwart", { target: e.id, amount: 1, source: e.id }));
      break;
    }
    case "search": {
      const candidates = [...s.player.deck, ...s.player.discard].filter((p) =>
        e.item
          ? hasTrait(p, "Item") && ports.canPut(s, p)
          : card(p).type_code === "event" && card(p).set_code === s.heroId,
      );
      ports.choose(
        s,
        e.title,
        e.put
          ? "Search your deck and discard for an Item to put into play."
          : "Search your deck and discard for an identity-specific event.",
        [
          ...candidates.map((p) =>
            O(
              p.id,
              card(p).name,
              [J("search-take", { id: p.id, put: e.put })],
              p.code,
            ),
          ),
          O("none", e.optional ? "Do not search" : "Finish the search", [
            J("shuffle"),
          ]),
        ],
      );
      break;
    }
    case "search-take": {
      const zone = [s.player.deck, s.player.discard].find((z) =>
        z.some((p) => p.id === e.id),
      );
      const i = zone?.findIndex((p) => p.id === e.id) ?? -1;
      need(
        zone && i >= 0,
        "The searched physical card is no longer available.",
      );
      const p = zone!.splice(i, 1)[0];
      if (e.put) ports.put(s, p);
      else s.player.hand.push(p);
      ports.shuffle(s);
      break;
    }
    case "shuffle":
      ports.shuffle(s);
      break;
    case "flash": {
      const candidates = ports
        .enemies(s, false)
        .filter(
          (t) =>
            !e.chosen.includes(t.id) &&
            (ports.canStatus(s, t.id, "stunned") ||
              ports.canStatus(s, t.id, "confused")),
        );
      if (e.remaining <= 0 || !candidates.length) break;
      ports.choose(
        s,
        "Blinding Flash",
        "Choose a different enemy to stun and confuse.",
        candidates.map((t) =>
          O(
            t.id,
            t.label,
            [
              E("status", { target: t.id, status: "stunned" }),
              E("status", { target: t.id, status: "confused" }),
              J("flash", {
                remaining: e.remaining - 1,
                chosen: [...e.chosen, t.id],
              }),
            ],
            t.code,
          ),
        ),
      );
      break;
    }
    case "status-choice": {
      const choices = ports
        .enemies(s, !!e.attack)
        .filter((t) => ports.canStatus(s, t.id, e.status));
      if (choices.length)
        ports.choose(
          s,
          e.title,
          `Choose an enemy to ${e.status === "confused" ? "confuse" : "stun"}.`,
          choices.map((t) =>
            O(
              t.id,
              t.label,
              [
                ...(e.attack
                  ? [attack(0, { target: t.id, noDamageInstance: true })]
                  : []),
                E("status", { target: t.id, status: e.status }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "firecracker":
      ports.queue(
        s,
        attack(4, { target: e.target }),
        ...(e.count === 2
          ? [E("status", { target: e.target, status: "stunned" })]
          : []),
      );
      break;
    case "finale":
      if (e.remaining > 0 && ports.enemies(s, true).length)
        ports.queue(
          s,
          target(
            "Grande Finale",
            "enemy",
            J("finale-hit", { remaining: e.remaining }),
            true,
          ),
        );
      break;
    case "finale-hit":
      ports.queue(
        s,
        attack(2, { target: e.target }),
        J("finale", { remaining: e.remaining - 1 }),
      );
      break;
    case "steps":
      if (e.remaining > 0 && ports.schemes(s, true).length)
        ports.queue(
          s,
          target(
            "Three Steps Ahead",
            "scheme",
            J("step", { remaining: e.remaining, action: true, source: "hero" }),
          ),
        );
      break;
    case "step":
      ports.queue(
        s,
        { ...thwart(2), target: e.target },
        J("steps", { remaining: e.remaining - 1 }),
      );
      break;
    case "duo-damage": {
      const choices = ports
        .enemies(s, true)
        .filter(
          (t) =>
            (t.id === s.villain.id ? s.villain : ports.find(s, t.id))?.confused,
        );
      if (choices.length)
        ports.choose(
          s,
          "Unlikely Duo",
          "Deal 4 damage to a confused enemy.",
          choices.map((t) =>
            O(
              t.id,
              t.label,
              [
                attack(4, {
                  target: t.id,
                  psylockeConfusedAtInitiation: e.initiallyConfused.includes(
                    t.id,
                  ),
                }),
              ],
              t.code,
            ),
          ),
        );
      break;
    }
    case "coat-response": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && !p.exhausted && !isTextBlank(s, p),
      );
      need(
        p && hero(s),
        "This response requires its ready upgrade and hero form.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        target(
          card(p!).name,
          e.power === "attack" ? "enemy" : "scheme",
          e.power === "attack" ? attack(e.amount) : thwart(e.amount),
          e.power === "attack",
        ),
      );
      break;
    }
    case "remove-grounded": {
      const p = s.player.inPlay.find(
        (p) => p.id === e.id && p.code === "47023",
      );
      if (p) {
        s.player.inPlay.splice(s.player.inPlay.indexOf(p), 1);
        s.removed.push(p);
      }
      break;
    }
    case "waylay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "47014",
      );
      need(p, "Waylay is no longer available.");
      ports.reaction(
        s,
        p!,
        [target("Waylay", "enemy", attack(e.amount), true)],
        e.after,
      );
      break;
    }
    case "synch": {
      const p = s.player.inPlay.find(
        (p) =>
          p.id === e.id &&
          p.code === "47018" &&
          !p.exhausted &&
          !isTextBlank(s, p),
      );
      need(p, "Synch is no longer ready.");
      p!.exhausted = true;
      ports.queue(s, {
        ...e.packet,
        amount: Number(e.packet.amount || 0) + 1,
        jubileeSynchHandled: true,
      });
      break;
    }
    case "husk-pay":
      ports.pay(
        s,
        "Husk",
        e.amount,
        [
          J("husk-paid", {
            id: e.id,
            packet: e.packet,
            paymentReceipt: true,
            jubileeResources: true,
          }),
        ],
        [],
        [e.packet],
      );
      break;
    case "husk-paid": {
      const p = ports.find(s, e.id);
      if (!p || p.code !== "47012") break;
      const used: Resource[] = e.paidForCard || [];
      ports.queue(
        s,
        ...(used.includes("mental")
          ? [E("heal", { target: p.id, amount: 1 })]
          : []),
        {
          ...e.packet,
          amount:
            (e.packet.amount ??
              ports.allyPower(
                s,
                p,
                e.packet.kind === "attack" ? "attack" : "thwart",
              )) + Number(used.includes("energy")),
        },
        ...(used.includes("physical") ? [E("ready", { target: p.id })] : []),
      );
      break;
    }
    case "disguise-controller": {
      const p = ports.find(s, e.id);
      if (!p) break;
      const seats = playerOrder(s).filter(
        (seat) => !live(seatView(s, seat), "47013").some((q) => q.id !== p.id),
      );
      need(seats.length, "No player can control this Disguise.");
      ports.choose(
        s,
        "Disguise",
        "Choose the player who controls this upgrade.",
        seats.map((seat) =>
          O(
            seat.id,
            `${seat.heroId} · ${seat.id}`,
            [J("transfer", { id: p.id, player: seat.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "transfer":
      ports.transfer(s, e.id, e.player);
      break;
    case "disguise": {
      const p = s.player.inPlay.find(
        (p) =>
          p.id === e.id &&
          p.code === "47013" &&
          !p.exhausted &&
          !isTextBlank(s, p),
      );
      need(
        p && !s.player.exhausted,
        "Disguise and your identity must be ready.",
      );
      p!.exhausted = true;
      s.player.exhausted = true;
      ports.queue(s, target("Disguise", "scheme", thwart(2)));
      break;
    }
    case "phone": {
      const p = s.player.inPlay.find(
        (p) =>
          p.id === e.id &&
          p.code === "47019" &&
          !p.exhausted &&
          p.counters > 0 &&
          !isTextBlank(s, p),
      );
      need(p, "Cell Phone needs a charge and must be ready.");
      p!.exhausted = true;
      p!.counters--;
      const seats = playerOrder(s).filter(
        (seat) => phoneCharacters(seatView(s, seat), ports).length,
      );
      ports.choose(
        s,
        "Cell Phone",
        "Choose a player to make a basic attack or thwart.",
        seats.map((seat) =>
          O(
            seat.id,
            `${seat.heroId} · ${seat.id}`,
            [J("phone-character", { actorId: seat.id })],
            p!.code,
          ),
        ),
      );
      if (!p!.counters) ports.discard(s, p!.id);
      break;
    }
    case "phone-character": {
      const options = phoneCharacters(s, ports).flatMap((t) =>
        ports
          .basicPowers(s, t.id)
          .map((power) =>
            O(
              `${t.id}:${power}`,
              `${t.label} · basic ${power} (+1)`,
              [J("phone-basic", { id: t.id, power })],
              t.code,
            ),
          ),
      );
      if (options.length)
        ports.choose(
          s,
          "Cell Phone",
          "Choose a ready character and its basic power.",
          options,
        );
      break;
    }
    case "phone-basic":
      ports.basic(s, e.id, e.power, 1);
      break;
    case "grounded": {
      const seat = playerOrder(s).find((seat) => seat.heroId === "jubilee");
      if (!seat) {
        ports.queue(s, E("removeEncounter", { piece: e.piece }));
        break;
      }
      ports.queue(s, J("grounded-keep", { piece: e.piece, actorId: seat.id }));
      break;
    }
    case "grounded-keep":
      if (!s.player.inPlay.some((p) => p.id === e.piece.id))
        ports.keepObligation(s, e.piece);
      if (s.player.form === "hero")
        ports.queue(s, E("flip", { counts: false, target: "alter" }));
      break;
    case "grounded-pay":
      ports.pay(
        s,
        "Grounded · change to hero form",
        e.cost,
        [J("grounded-flip", { counts: e.counts, targetForm: e.targetForm })],
        Array<Resource>(e.cost).fill(e.resource),
      );
      break;
    case "grounded-flip":
      s.flags.jubileeGroundedPaid = true;
      ports.queue(s, E("flip", { counts: e.counts, target: e.targetForm }));
      break;
    case "naughty": {
      const p = s.sideSchemes.find((p) => p.id === e.id);
      if (p)
        ports.queue(
          s,
          E("threat", {
            target: p.id,
            amount: new Set(s.player.hand.flatMap(printedResources)).size,
          }),
        );
      break;
    }
    case "battle-suit": {
      const remaining = s.minions.map((p) => ({
        p,
        hp: ports.maxHP(s, p) - p.damage,
      }));
      const lowest = Math.min(...remaining.map((x) => x.hp));
      const choices = remaining.filter((x) => x.hp === lowest);
      if (!choices.length) {
        ports.queue(s, E("surge"));
        break;
      }
      ports.choose(
        s,
        "Battle Suit",
        "Attach to a minion with the fewest remaining hit points.",
        choices.map(({ p }) =>
          O(
            p.id,
            card(p).name,
            [J("attach", { piece: e.piece, target: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "lost-child": {
      const candidates = allies(s).filter(
        (p) =>
          !s.attachments.some(
            (a) => a.code === "47027" && a.attachedTo === p.id,
          ),
      );
      const highest = Math.max(...candidates.map((p) => card(p).cost || 0));
      const choices = candidates.filter((p) => (card(p).cost || 0) === highest);
      if (!choices.length) {
        ports.queue(s, E("surge"));
        break;
      }
      ports.choose(
        s,
        '"Lost" Child',
        "Attach to an ally with the highest printed cost.",
        choices.map((p) =>
          O(
            p.id,
            card(p).name,
            [J("attach", { piece: e.piece, target: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "attach":
      ports.attach(s, e.piece, e.target);
      break;
    case "nanny": {
      const zones = [
        s.encounter.deck,
        s.encounter.discard,
        ...playerOrder(s).map(
          (seat) => seatView(s, seat).player.setAside || [],
        ),
      ];
      const zone = zones.find((z) => z.some((p) => p.code === "47027"));
      const i = zone?.findIndex((p) => p.code === "47027") ?? -1;
      if (zone && i >= 0) {
        ports.reveal(s, zone.splice(i, 1)[0]);
        ports.shuffleEncounter(s);
      }
      break;
    }
    case "find-trap": {
      // RRG1.8 p17: a discard-until effect ends at exhaustion, even though
      // the encounter discard immediately reshuffles into a new deck.
      const maximum = s.encounter.deck.length;
      for (let n = 0; n < maximum; n++) {
        const p = ports.discardEncounterTop(s);
        if (!p) break;
        if (card(p).type_code === "side_scheme" && hasTrait(p, "Trap!")) {
          ports.reveal(s, p);
          break;
        }
      }
      break;
    }
    case "elaborate": {
      const traps = s.sideSchemes.filter(
        (p) => hasTrait(p, "Trap!") && !isTextBlank(s, p),
      );
      const effects = traps
        .map((p) => ({
          id: p.id,
          title: card(p).name,
          effects: jubileeTrapDefeated(s, p),
        }))
        .filter((x) => x.effects.length);
      ports.queue(
        s,
        ...(effects.length
          ? [
              E("forcedResponses", {
                responses: effects,
                actorId: s.activePlayerId,
              }),
            ]
          : [J("find-trap")]),
      );
      break;
    }
    case "trap-discard": {
      const choices = s.player.inPlay.filter((p) =>
        ["ally", "upgrade"].includes(card(p).type_code),
      );
      if (choices.length)
        ports.choose(
          s,
          "Arcade's Funhouse",
          "Discard an ally or upgrade you control.",
          choices.map((p) =>
            O(p.id, card(p).name, [J("discard", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "discard":
      ports.discard(s, e.id);
      break;
    case "mayhem-select": {
      const pairs = allyPairs(s, ports);
      ports.choose(
        s,
        "Mutant Mayhem",
        "Choose the two allies returned as an additional cost.",
        pairs.map(([a, b]) =>
          O(`${a.id}:${b.id}`, `${card(a).name} + ${card(b).name}`, [
            J("mayhem-selected", { id: e.id, ids: [a.id, b.id] }),
          ]),
        ),
      );
      if (s.prompt) s.prompt.cancelable = true;
      break;
    }
    case "mayhem-selected": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "47028");
      need(p, "Mutant Mayhem is no longer in hand.");
      s.flags[`jubileeMayhem:${e.id}`] = JSON.stringify(e.ids);
      ports.queue(s, E("playRequest", { piece: p }));
      break;
    }
    case "mayhem-cancel":
      delete s.flags[`jubileeMayhem:${e.id}`];
      break;
    case "mayhem-return": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "47028");
      need(p, "Mutant Mayhem is no longer in hand.");
      jubileePaymentPreflight(s, p!, ports);
      const ids: string[] = JSON.parse(
        String(s.flags[`jubileeMayhem:${e.id}`]),
      );
      const pieces = ids.map((id) => ports.find(s, id)!);
      const replays = pieces.map((p) => ({
        id: p.id,
        owner: p.ownerId || controller(s, p.id)!.id,
      }));
      for (const p of pieces) ports.returnAlly(s, p.id);
      s.flags[`jubileeMayhemReplays:${e.id}`] = JSON.stringify(replays);
      delete s.flags[`jubileeMayhem:${e.id}`];
      break;
    }
    case "mayhem-replays": {
      const raw = s.flags[`jubileeMayhemReplays:${e.id}`];
      const replays: { id: string; owner: string }[] =
        typeof raw === "string" ? JSON.parse(raw) : [];
      delete s.flags[`jubileeMayhemReplays:${e.id}`];
      ports.queue(
        s,
        ...replays.map((p) =>
          J("mayhem-replay", { id: p.id, actorId: p.owner }),
        ),
      );
      break;
    }
    case "mayhem": {
      const pairs = allyPairs(s, ports);
      if (pairs.length)
        ports.choose(
          s,
          "Mutant Mayhem",
          "Choose two different allies to return and replay.",
          pairs.map(([a, b]) =>
            O(`${a.id}:${b.id}`, `${card(a).name} + ${card(b).name}`, [
              J("mayhem-pair", { ids: [a.id, b.id] }),
            ]),
          ),
        );
      break;
    }
    case "mayhem-pair": {
      const pieces: Piece[] = e.ids
        .map((id: string) => ports.find(s, id))
        .filter(Boolean);
      if (pieces.length !== 2) break;
      const owners = pieces.map((p) => ({
        id: p.id,
        owner: p.ownerId || controller(s, p.id)!.id,
      }));
      for (const p of pieces) ports.returnAlly(s, p.id);
      ports.queue(
        s,
        ...owners.map((x) =>
          J("mayhem-replay", { id: x.id, actorId: x.owner }),
        ),
      );
      break;
    }
    case "mayhem-replay": {
      const p = s.player.hand.find((p) => p.id === e.id);
      if (p) ports.playAlly(s, p);
      break;
    }
    case "serve": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "47029",
      );
      need(p, "Serve and Protect is no longer available.");
      const options = e.pairs.map(([a, b]: JubileeTarget[]) =>
        O(`${a.id}:${b.id}`, `${a.label} + ${b.label}`, [
          J("serve-pay", { id: p!.id, ids: [a.id, b.id], packet: e.packet }),
        ]),
      );
      ports.choose(
        s,
        "Serve and Protect",
        "Choose two different ready characters.",
        options,
      );
      break;
    }
    case "serve-pay": {
      const p = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "47029",
      );
      need(
        p &&
          e.ids.every((id: string) =>
            id === "hero"
              ? !s.player.exhausted
              : !!ports.find(s, id) && !ports.find(s, id)!.exhausted,
          ),
        "The chosen characters must remain ready.",
      );
      ports.reaction(
        s,
        p!,
        e.ids.map((id: string) => E("status", { target: id, status: "tough" })),
        [],
        [e.packet],
        [J("serve-commit", { ids: e.ids })],
      );
      break;
    }
    case "serve-commit":
      need(
        e.ids.every((id: string) =>
          id === "hero" || id === `hero:${s.activePlayerId}`
            ? !s.player.exhausted
            : !!ports.find(s, id) && !ports.find(s, id)!.exhausted,
        ),
        "Each Serve and Protect character must pay a separate ready exhaust cost.",
      );
      for (const id of e.ids) {
        if (id === "hero" || id === `hero:${s.activePlayerId}`)
          s.player.exhausted = true;
        else {
          const p = ports.find(s, id);
          if (p) p.exhausted = true;
        }
      }
      break;
    default:
      throw Error(`Unimplemented Jubilee effect: ${e.type}`);
  }
  return true;
}
