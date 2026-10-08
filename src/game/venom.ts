import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts, AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
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
const V = (type: string, args: Record<string, unknown> = {}) =>
  E(`venom:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const definition = (p: Piece) => cards.get(p.code)!;
const active = (s: GameState) => ["vnm", "venom"].includes(s.heroId);
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const trait = (p: Piece, name: string) =>
  (definition(p)?.traits || "").split(/\.\s*/).includes(name);
const weaponUpgrade = (p: Piece) =>
  definition(p)?.type_code === "upgrade" && trait(p, "Weapon");
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const reservedNemesis = (s: GameState) =>
  new Set(
    String(s.flags.venomReservedNemesis || "")
      .split(",")
      .filter(Boolean),
  );
const releaseNemesis = (s: GameState, id: string) => {
  const reserved = reservedNemesis(s);
  reserved.delete(id);
  if (reserved.size) s.flags.venomReservedNemesis = [...reserved].join(",");
  else delete s.flags.venomReservedNemesis;
};

export const VENOM_SCRIPT_CODES = [
  "20001a",
  "20001b",
  "20002",
  "20003",
  "20004",
  "20005",
  "20006",
  "20007",
  "20008",
  "20009",
  "20010",
  "20023",
  "20024",
  "20025",
] as const;
export const VENOM_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const VENOM_INSERT_SOURCE =
  "https://hallofheroeslcg.com/wp-content/uploads/2021/07/venominsert.jpg";

export interface VenomAttackInitiation {
  attacker: string;
  playerId: string;
  isVillain: boolean;
  /** Physical Spider-Sense copies already used for this attack initiation. */
  usedIds?: string[];
  /** Native shared initiation window. This flat serialized continuation lets
   * Spider-Sense's draw expose every player's interrupt before boosts resume. */
  sharedWindow?: Effect;
}
export type VenomBasicPower = "attack" | "thwart" | "defense";
export interface VenomPorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  shufflePlayerDeck(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  /** Discard one actual top card and perform ordinary deck-exhaustion handling.
   * emptied describes the original deck, even if it has already been recycled. */
  discardPlayerTop(s: GameState): { piece?: Piece; emptied: boolean };
  cardCost(s: GameState, p: Piece): number;
  heroMaxHP(s: GameState): number;
  /** Taking damage as a cost requires the FULL amount actually taken. The
   * availability check must reject Tough, immunity and compulsory prevention. */
  canTakeDamageCost(s: GameState, amount: number): boolean;
  takeDamageCost(s: GameState, amount: number): boolean;
  /** One simultaneous non-attack damage batch, with normal defeat handling. */
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  /** Move this actual card into play, without its When Revealed ability. */
  putMinion(s: GameState, p: Piece, playerId: string): void;
  /** Retain the actual pending boost card so activation cleanup cannot discard
   * it after this ability has put it into play. */
  putBoostMinion(s: GameState, p: Piece, playerId: string): void;
  /** Cancel the initiated attack before boost/defender resolution. Resolve the
   * event's remaining clauses, finish its physical resolution, then open the
   * native after-defense window (heroDefended=true, basic=false, damage=0).
   * Preserve end-of-activation cleanup and the surrounding phase continuation;
   * do not resolve after-attack/after-activation abilities for a canceled attack. */
  cancelVillainAttack(s: GameState, clauses: Effect[]): void;
}

/** Both identity faces grant the extra general Restricted slot. */
export function venomRestrictedAllowance(s: GameState): number {
  return active(s) ? 1 : 0;
}

/** Called once during native hero creation, and once for an old save missing
 * this field. An existing empty zone is never replenished. */
export function venomInitializeNemesis(
  s: GameState,
  ports: Pick<VenomPorts, "makePiece">,
): void {
  if (!active(s) || s.player.setAside !== undefined) return;
  s.player.setAside = ["20024", "20025", "20025", "20025", "20025"].map(
    (code) => ports.makePiece(s, code),
  );
}
export function venomSetup(s: GameState): Effect[] {
  return active(s) ? [V("setup")] : [];
}

/** The Venom insert replaces the ordinary one-nemesis-minion procedure with
 * ALL remaining actual Enraged Symbiotes. Queue normal reveals in printed
 * order, then shuffle any remaining cards into the encounter deck. */
export function venomShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [];
  const minions = zone.filter((p) => p.code === "20025");
  const scheme = zone.find((p) => p.code === "20024");
  const moved = new Set(
    [...minions, ...(scheme ? [scheme] : [])].map((p) => p.id),
  );
  const rest = zone.filter(
    (p) => definition(p)?.set_code === "vnm_nemesis" && !moved.has(p.id),
  );
  for (const p of rest) moved.add(p.id);
  if (moved.size) s.flags.venomReservedNemesis = [...moved].join(",");
  return [
    ...minions.map((p) =>
      V("reveal-setaside", { id: p.id, actorId: s.activePlayerId }),
    ),
    ...(scheme
      ? [V("reveal-setaside", { id: scheme.id, actorId: s.activePlayerId })]
      : []),
    V("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!minions.length ? [E("surge")] : []),
  ];
}

export function venomResourceSources(
  s: GameState,
  ports: Pick<VenomPorts, "canTakeDamageCost">,
): PaymentSource[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.flags.venomBondPhase !== phaseKey(s) &&
    ports.canTakeDamageCost(s, 1)
    ? [
        {
          id: "symbiotic-bond",
          name: "Symbiotic Bond",
          code: "20001a",
          resources: ["wild"],
          description:
            "Take 1 damage · generate 1 wild resource · once per phase",
          kind: "ability",
        },
      ]
    : [];
}
export function venomResourceSpent(
  s: GameState,
  id: string,
  ports: Pick<VenomPorts, "canTakeDamageCost" | "takeDamageCost">,
): boolean {
  if (id !== "symbiotic-bond") return false;
  need(
    venomResourceSources(s, ports).length,
    "Symbiotic Bond cannot pay its full damage cost.",
  );
  need(
    ports.takeDamageCost(s, 1),
    "Symbiotic Bond must actually take its full damage cost.",
  );
  s.flags.venomBondPhase = phaseKey(s);
  return true;
}
export function venomPhaseEnded(s: GameState): void {
  for (const seat of s.players) delete seatView(s, seat).flags.venomBondPhase;
}

/** The host supplies resources actually allocated to the card's cost, after
 * choosing wild types and excluding resources overpaid for that cost (RRG13). */
export function venomPaidOnly(paid: Resource[], type: Resource): boolean {
  return paid.length > 0 && paid.every((resource) => resource === type);
}
export function venomPlayRestriction(s: GameState, p: Piece): string | null {
  if (
    ["20002", "20003", "20005", "20006"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "This event requires hero form.";
  if (
    p.code === "20003" &&
    (!s.attack?.isVillain ||
      (s.attack.originalPlayerId ||
        s.attack.targetPlayerId ||
        s.activePlayerId) !== s.activePlayerId)
  )
    return "Grasping Tendrils requires a villain initiating an attack against you.";
  return null;
}
export function venomEvent(
  _s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  switch (p.code) {
    case "20002":
      return [V("behind", { bonus: venomPaidOnly(paid, "mental") })];
    case "20003":
      return [V("tendrils", { bonus: venomPaidOnly(paid, "physical") })];
    case "20004":
      return [V("loaded")];
    case "20005":
      return [V("run")];
    case "20006":
      return [
        E("target", {
          group: "enemy",
          title: "Savage Attack",
          attack: true,
          action: E("damage", {
            amount: 5,
            attack: true,
            overkill: venomPaidOnly(paid, "energy"),
            source: "hero",
          }),
        }),
      ];
    default:
      return null;
  }
}

/** Global lock: a Symbiote ENEMY in play locks each unblanked Klyntar Frenzy.
 * The enemy's traits remain printed even if its abilities have been blanked. */
export function venomSchemeLocked(s: GameState, target: string): boolean {
  const scheme = s.sideSchemes.find(
    (p) => p.id === target && p.code === "20024",
  );
  return (
    !!scheme &&
    !isTextBlank(s, scheme) &&
    [s.villain, ...s.minions].some((p) => trait(p, "Symbiote"))
  );
}
function schemeTargets(
  s: GameState,
  thwart: boolean,
  ports: VenomPorts,
): AntManTarget[] {
  const crisis = s.sideSchemes.some(
    (p) => definition(p)?.scheme_crisis && !isTextBlank(s, p),
  );
  return ports
    .schemeTargets(s, thwart)
    .filter((t) => !venomSchemeLocked(s, t.id) && !(t.id === "main" && crisis));
}

export function venomAbilityOptions(
  s: GameState,
  id: string,
  ports: VenomPorts,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || ports.isTextBlank(s, p)) return [];
  if (p.code === "20007" && s.player.form === "alter")
    return [
      ...(s.player.deck.length || s.player.discard.length
        ? [
            option(
              "rebirth-draw",
              "Project Rebirth 2.0 · exhaust, draw 1 card",
              [V("rebirth", { id, mode: "draw" })],
              p.code,
            ),
          ]
        : []),
      ...(s.player.hp < ports.heroMaxHP(s)
        ? [
            option(
              "rebirth-heal",
              "Project Rebirth 2.0 · exhaust, heal 3 damage",
              [V("rebirth", { id, mode: "heal" })],
              p.code,
            ),
          ]
        : []),
    ];
  if (p.code !== "20008" || s.player.form !== "hero") return [];
  return [
    ...(ports.enemyTargets(s, false).length
      ? [
          option(
            "multi-damage",
            "Multi-Gun · exhaust, deal 2 damage to an enemy",
            [V("multi", { id, mode: "damage" })],
            p.code,
          ),
        ]
      : []),
    ...(s.minions.length
      ? [
          option(
            "multi-minions",
            "Multi-Gun · exhaust, deal 1 damage to each minion engaged with a chosen player",
            [V("multi", { id, mode: "minions" })],
            p.code,
          ),
        ]
      : []),
    ...(schemeTargets(s, false, ports).length
      ? [
          option(
            "multi-threat",
            "Multi-Gun · exhaust, remove 2 threat from a scheme",
            [V("multi", { id, mode: "threat" })],
            p.code,
          ),
        ]
      : []),
  ];
}
export function venomAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: VenomPorts,
): Effect[] | null {
  const options = venomAbilityOptions(s, id, ports);
  return (
    (
      options.find((o) => o.id === action) ||
      (!action && options.length === 1 ? options[0] : undefined)
    )?.effects || null
  );
}

/** Call after native status replacement checks, with a saved basicPower amount.
 * Every actual ready Pistol may be used once for this use; exhausting it removes
 * it from the next optional window. Defense requires a native basic defender. */
export function venomBasicPowerOptions(
  s: GameState,
  power: VenomBasicPower,
  after: Effect[],
  ports: VenomPorts,
): Option[] {
  if (!active(s) || s.player.form !== "hero") return [];
  if (
    (power === "attack" && s.player.stunned) ||
    (power === "thwart" && s.player.confused)
  )
    return [];
  if (
    power === "defense" &&
    (!s.attack?.basicDefense ||
      !["hero", `hero:${s.activePlayerId}`].includes(s.attack.defender || ""))
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "20010" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) =>
      option(
        p.id,
        `Venom's Pistol · exhaust, +1 ${power === "attack" ? "ATK" : power === "thwart" ? "THW" : "DEF"} for this basic power`,
        [V("pistol", { id: p.id, power, after })],
        p.code,
      ),
    );
}

/** This window belongs to the initial attacked hero, before boost cards or a
 * defender are chosen. Drawing with Spider-Sense can reveal a new Tendrils. */
export function venomAttackInitiatedOptions(
  s: GameState,
  snapshot: VenomAttackInitiation,
  after: Effect[],
  ports: VenomPorts,
): Option[] {
  if (
    !snapshot.isVillain ||
    snapshot.playerId !== s.activePlayerId ||
    s.player.form !== "hero"
  )
    return [];
  const used = snapshot.usedIds || [];
  const options = s.player.inPlay
    .filter(
      (p) =>
        p.code === "20009" &&
        !ports.isTextBlank(s, p) &&
        !used.includes(p.id) &&
        (s.player.deck.length || s.player.discard.length),
    )
    .map((p) =>
      option(
        p.id,
        "Spider-Sense · draw 1 card",
        [V("sense", { id: p.id, snapshot, after })],
        p.code,
      ),
    );
  for (const p of s.player.hand.filter(
    (p) =>
      p.code === "20003" &&
      ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
  ))
    options.push(
      option(
        p.id,
        "Grasping Tendrils · pay to cancel this villain attack",
        [
          E("payRequest", {
            title: "Grasping Tendrils",
            cost: ports.cardCost(s, p),
            requirements: [],
            piece: p,
            cancelable: true,
            targetCode: p.code,
            after: [E("resolveHandEvent", { id: p.id, continuation: [] })],
          }),
        ],
        p.code,
      ),
    );
  return options;
}

export function venomEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "20023": {
      const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
      return owner ? [V("obligation", { piece: p, actorId: owner.id })] : [];
    }
    case "20024":
    case "20025":
      return [];
    default:
      return null;
  }
}
export function venomBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "20025" ? [V("boost-symbiote", { piece: p })] : null;
}

function selectTarget(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: VenomPorts,
): void {
  if (targets.length === 1)
    ports.queue(s, { ...action, target: targets[0].id });
  else if (targets.length > 1)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        option(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
}
function removePhysicalPlayerCard(s: GameState, id: string): Piece | undefined {
  for (const zone of [s.player.deck, s.player.discard]) {
    const index = zone.findIndex((p) => p.id === id);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  return undefined;
}

export function resolveVenomEffect(
  s: GameState,
  e: Effect,
  ports: VenomPorts,
): boolean {
  if (!e.type.startsWith("venom:")) return false;
  switch (e.type) {
    case "venom:setup": {
      need(active(s), "Armed and Ready belongs to Flash Thompson.");
      while (s.player.deck.length) {
        const { piece, emptied } = ports.discardPlayerTop(s);
        if (!piece) break;
        if (weaponUpgrade(piece)) {
          const actual = removePhysicalPlayerCard(s, piece.id);
          need(
            actual,
            "The discarded Weapon must remain an actual owned card.",
          );
          s.player.hand.push(actual!);
          break;
        }
        if (emptied) break;
      }
      break;
    }
    case "venom:reveal-setaside": {
      const zone = s.player.setAside || [];
      const index = zone.findIndex((p) => p.id === e.id);
      need(
        index >= 0 && reservedNemesis(s).has(e.id),
        "Reveal the reserved actual set-aside nemesis card.",
      );
      const piece = zone.splice(index, 1)[0];
      releaseNemesis(s, piece.id);
      ports.queue(s, E("reveal", { piece, actorId: s.activePlayerId }));
      break;
    }
    case "venom:shuffle-nemesis": {
      const zone = s.player.setAside || [];
      for (const id of e.ids || []) {
        const index = zone.findIndex((p) => p.id === id);
        need(
          index >= 0 && reservedNemesis(s).has(id),
          "Shuffle only reserved actual set-aside nemesis cards.",
        );
        s.encounter.deck.push(zone.splice(index, 1)[0]);
        releaseNemesis(s, id);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "venom:loaded": {
      const weapons = s.player.deck.filter(weaponUpgrade);
      if (weapons.length)
        selectTarget(
          s,
          "Locked and Loaded",
          weapons.map((p) => ({
            id: p.id,
            label: definition(p).name,
            code: p.code,
          })),
          V("loaded-take"),
          ports,
        );
      else ports.shufflePlayerDeck(s);
      break;
    }
    case "venom:loaded-take": {
      const index = s.player.deck.findIndex(
        (p) => p.id === e.target && weaponUpgrade(p),
      );
      need(index >= 0, "Choose an actual Weapon upgrade in your deck.");
      s.player.hand.push(s.player.deck.splice(index, 1)[0]);
      ports.revealHidden(s);
      ports.shufflePlayerDeck(s);
      break;
    }
    case "venom:run":
      need(s.player.form === "hero", "Run and Gun requires hero form.");
      ports.queue(
        s,
        E("ready", { target: "hero" }),
        ...s.player.inPlay
          .filter(weaponUpgrade)
          .map((p) => E("ready", { target: p.id })),
      );
      break;
    case "venom:behind": {
      if (e.bonus) ports.queue(s, V("behind-confuse"));
      selectTarget(
        s,
        "Behind Enemy Lines",
        schemeTargets(s, true, ports),
        E("thwart", { amount: 3, action: true, source: "hero" }),
        ports,
      );
      break;
    }
    case "venom:behind-confuse":
      selectTarget(
        s,
        "Behind Enemy Lines",
        ports
          .enemyTargets(s, false)
          .filter((t) => ports.canGiveStatus(s, t.id, "confused")),
        E("status", { status: "confused" }),
        ports,
      );
      break;
    case "venom:tendrils":
      need(
        !venomPlayRestriction(s, { code: "20003" } as Piece),
        "Grasping Tendrils needs the initiated villain attack against you.",
      );
      ports.cancelVillainAttack(
        s,
        e.bonus
          ? [E("status", { target: s.attack!.attacker, status: "stunned" })]
          : [],
      );
      break;
    case "venom:rebirth": {
      const p = own(s, e.id, "20007");
      const id = e.mode === "draw" ? "rebirth-draw" : "rebirth-heal";
      need(
        p && venomAbilityOptions(s, e.id, ports).some((o) => o.id === id),
        "Project Rebirth 2.0 is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        e.mode === "draw"
          ? E("draw", { amount: 1 })
          : E("heal", { target: "hero", amount: 3 }),
      );
      break;
    }
    case "venom:multi": {
      const p = own(s, e.id, "20008");
      need(
        p &&
          venomAbilityOptions(s, e.id, ports).some(
            (o) => o.id === `multi-${e.mode}`,
          ),
        "Multi-Gun's chosen mode is unavailable.",
      );
      p!.exhausted = true;
      if (e.mode === "damage")
        selectTarget(
          s,
          "Multi-Gun",
          ports.enemyTargets(s, false),
          E("damage", { amount: 2, source: "20008" }),
          ports,
        );
      else if (e.mode === "threat")
        selectTarget(
          s,
          "Multi-Gun",
          schemeTargets(s, false, ports),
          E("thwart", { amount: 2, action: false, source: "20008" }),
          ports,
        );
      else
        selectTarget(
          s,
          "Multi-Gun",
          playerOrder(s)
            .filter((seat) =>
              s.minions.some(
                (p) => (p.engagedWith || s.activePlayerId) === seat.id,
              ),
            )
            .map((seat) => ({
              id: seat.id,
              label: `${seat.id} · ${seat.heroId}`,
            })),
          V("multi-batch"),
          ports,
        );
      break;
    }
    case "venom:multi-batch": {
      const ids = s.minions
        .filter((p) => (p.engagedWith || s.activePlayerId) === e.target)
        .map((p) => p.id);
      ports.damageBatch(s, ids, 1, "20008");
      break;
    }
    case "venom:pistol": {
      const p = own(s, e.id, "20010");
      need(
        p &&
          venomBasicPowerOptions(s, e.power, e.after, ports).some(
            (o) => o.id === p.id,
          ),
        "Venom's Pistol cannot modify this basic power.",
      );
      p!.exhausted = true;
      if (e.power === "defense")
        s.attack!.defenseBonus = (s.attack!.defenseBonus || 0) + 1;
      const after = (e.after || []).map((x: Effect) =>
        e.power !== "defense" && x.type === "basicPower"
          ? {
              ...x,
              amount: x.amount === undefined ? undefined : x.amount + 1,
              venomBasicBonus: (x.venomBasicBonus || 0) + 1,
            }
          : x,
      );
      const options = venomBasicPowerOptions(s, e.power, after, ports);
      if (options.length)
        ports.choose(
          s,
          "Basic power interrupts",
          "Use another ready Venom's Pistol?",
          [...options, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "venom:sense": {
      const snapshot = e.snapshot as VenomAttackInitiation;
      need(
        venomAttackInitiatedOptions(s, snapshot, e.after, ports).some(
          (o) => o.id === e.id,
        ),
        "Spider-Sense cannot trigger again for this initiation.",
      );
      const usedIds = [...(snapshot.usedIds || []), e.id];
      ports.queue(
        s,
        E("draw", { amount: 1 }),
        snapshot.sharedWindow
          ? { ...snapshot.sharedWindow, usedIds }
          : V("attack-window", {
              snapshot: { ...snapshot, usedIds },
              after: e.after,
            }),
      );
      break;
    }
    case "venom:attack-window": {
      const options = venomAttackInitiatedOptions(
        s,
        e.snapshot,
        e.after,
        ports,
      );
      if (options.length)
        ports.choose(
          s,
          "Villain attack interrupts",
          "Resolve an interrupt before the villain's attack continues?",
          [...options, option("continue", "Continue", e.after)],
        );
      else ports.queue(s, ...e.after);
      break;
    }
    case "venom:boost-symbiote":
      need(
        e.piece?.code === "20025",
        "Enraged Symbiote's boost ability needs its actual card.",
      );
      ports.putBoostMinion(s, e.piece, s.activePlayerId);
      break;
    case "venom:obligation":
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Struggle for Control",
          "You may change to alter-ego form.",
          [
            option(
              "alter",
              "Change to alter-ego",
              [
                E("flip", { counts: false, target: "alter" }),
                V("obligation-choices", { piece: e.piece }),
              ],
              "20001b",
            ),
            option("stay", "Stay in hero form", [
              V("obligation-choices", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, V("obligation-choices", { piece: e.piece }));
      break;
    case "venom:obligation-choices": {
      const options = [
        option(
          "symbiote",
          (s.player.setAside || []).some(
            (p) => p.code === "20025" && !reservedNemesis(s).has(p.id),
          )
            ? "Put 1 set-aside Enraged Symbiote into play engaged with the first player"
            : "No set-aside Enraged Symbiote remains · gain surge",
          [V("obligation-symbiote", { piece: e.piece })],
          "20025",
        ),
      ];
      if (
        s.player.form === "alter" &&
        !s.player.exhausted &&
        ports.canTakeDamageCost(s, 2)
      )
        options.unshift(
          option(
            "exhaust",
            "Exhaust Flash Thompson and take 2 damage · discard this obligation",
            [V("obligation-exhaust", { piece: e.piece })],
            "20001b",
          ),
        );
      ports.choose(
        s,
        "Struggle for Control",
        "Choose one obligation effect.",
        options,
      );
      break;
    }
    case "venom:obligation-exhaust":
      need(
        s.player.form === "alter" &&
          !s.player.exhausted &&
          ports.canTakeDamageCost(s, 2),
        "Flash Thompson must pay the full exhaust and damage costs.",
      );
      need(
        ports.takeDamageCost(s, 2),
        "The obligation requires actually taking all 2 damage.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("discardEncounter", { piece: e.piece }));
      break;
    case "venom:obligation-symbiote": {
      const zone = s.player.setAside || [];
      const index = zone.findIndex(
        (p) => p.code === "20025" && !reservedNemesis(s).has(p.id),
      );
      ports.queue(s, E("discardEncounter", { piece: e.piece }));
      if (index >= 0)
        ports.putMinion(s, zone.splice(index, 1)[0], s.firstPlayerId);
      else ports.queue(s, E("surge"));
      break;
    }
    default:
      throw Error(`Unknown Venom effect ${e.type}.`);
  }
  return true;
}
