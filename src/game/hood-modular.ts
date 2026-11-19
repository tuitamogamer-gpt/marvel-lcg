import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { HoodPorts } from "./hood.js";
import type { MutagenForcedResponse } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** The Hood scenario pack's nine modular encounter sets. They can be chosen
 * in every scenario that uses modular sets. */
export const HOOD_MODULAR_CODES = [
  // Beasty Boys
  "24014",
  "24015",
  "24016",
  "24017",
  // Brothers Grimm
  "24018",
  "24019",
  "24020",
  "24021",
  "24022",
  // Crossfire's Crew
  "24023",
  "24024",
  "24025",
  "24026",
  "24027",
  "24028",
  // Mister Hyde
  "24033",
  "24034",
  "24035",
  "24036",
  // Ransacked Armory
  "24037",
  "24038",
  "24039",
  "24040",
  "24041",
  // Sinister Syndicate
  "24042",
  "24043",
  "24044",
  "24045",
  "24046",
  "24047",
  "24048",
  // State of Emergency
  "24055",
  "24056",
  "24057",
  "24058",
  "24059",
  // Streets of Mayhem
  "24060",
  "24061",
  "24062",
  "24063",
  // Wrecking Crew
  "24064",
  "24065",
  "24066",
  "24067",
  "24068",
  "24069",
  "24070",
] as const;

/** Their encounter set codes, printed in The Hood scenario pack. */
export const HOOD_MODULAR_SETS = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "state_of_emergency",
  "streets_of_mayhem",
  "wrecking_crew_modular",
] as const;

const BEAST_MODE = "24014";
const GRIFFIN = "24015";
const MANDRILL = "24016";
const DOUBLE_TROUBLE = "24017";
const BROTHERS_GRIMM = "24018";
const BLACKBIRD_PELLETS = "24019";
const CORROSIVE_EGG_BOMB = "24020";
const PARALYTIC_STARDUST = "24021";
const UNBREAKABLE_THREAD = "24022";
const OUT_FOR_BLOOD = "24023";
const CONTROLLER = "24024";
const CORRUPTOR = "24025";
const CROSSFIRE = "24026";
const MISTER_FEAR = "24027";
const CAUGHT_IN_THE_CROSSFIRE = "24028";
const SELF_EXPERIMENTATION = "24033";
const CALVIN_ZABO = "24034";
const MISTER_HYDE = "24035";
const HYDE_FORMULA = "24036";
const FLAMETHROWER = "24037";
const HOLOSHIELD = "24038";
const JETPACK = "24039";
const TECH_GAUNTLETS = "24040";
const CRIME_PAYS = "24042";
const BEETLE = "24043";
const BOOMERANG = "24044";
const SHOCKER = "24045";
const SPEED_DEMON = "24046";
const WHITE_RABBIT = "24047";
const SINISTER_ONSLAUGHT = "24048";
const FEISTY_HEIST = "24055";
const DISASTER_AT_THE_DOCKS = "24056";
const OFFSHORE_INFERNO = "24057";
const HOT_PURSUIT = "24058";
const CITYWIDE_CRISIS = "24059";
const BACK_ALLEY_ENCLAVE = "24060";
const SECRET_LAIR = "24061";
const SEWER_TUNNELS = "24062";
const WAREHOUSE_DISTRICT = "24063";
const TOP_TALENT = "24064";
const WRECKER = "24065";
const BULLDOZER = "24066";
const THUNDERBALL = "24068";
const COMBINED_EFFORT = "24069";
const MAGIC_MUSCLE = "24070";
const GRIMM_ITEMS = [
  BLACKBIRD_PELLETS,
  CORROSIVE_EGG_BOMB,
  PARALYTIC_STARDUST,
  UNBREAKABLE_THREAD,
];
const SETTINGS = [
  BACK_ALLEY_ENCLAVE,
  SECRET_LAIR,
  SEWER_TUNNELS,
  WAREHOUSE_DISTRICT,
];

export interface HoodModularPorts extends HoodPorts {
  /** Remaining hit points of an ally or enemy in play. */
  remainingHP(s: GameState, p: Piece): number;
  /** Current ATK of a hero-form identity ("hero:<id>") or an ally. */
  attackOf(s: GameState, id: string): number;
  /** Indirect damage from this source, assigned by the player. */
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  randomDiscard(s: GameState, playerId: string): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  giveTough(s: GameState, p: Piece): void;
  /** Discard the top card of the player's deck; `emptied` when it was the
   * last card, which ends a search. */
  discardPlayerTop(
    s: GameState,
    playerId: string,
  ): { piece?: Piece; emptied: boolean };
  /** Put this minion into play engaged with the player from any zone. */
  enterMinion(s: GameState, p: Piece, playerId: string): void;
  /** The enemy attacks one specific character controlled by this player. */
  attackCharacter(
    s: GameState,
    enemyId: string,
    playerId: string,
    targetId: string,
    modifier: number,
    after?: Effect,
  ): void;
  /** Resolve the When Revealed abilities of a side scheme in play again. */
  resolveWhenRevealed(s: GameState, p: Piece, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => def(p)?.type_code;
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hoodmod:${type}`,
  ...args,
});
const scripted = new Set<string>(HOOD_MODULAR_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const traits = (p: Piece) =>
  (def(p)?.traits || "")
    .split(/\.\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
const hasTrait = (p: Piece, trait: string) => traits(p).includes(trait);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const inPlay = (s: GameState, code: string) =>
  [...s.sideSchemes, ...(s.environments || []), ...s.minions].filter(
    (p) => p.code === code && active(s, p),
  );
const enemies = (s: GameState): Piece[] => [
  ...(s.villain ? [s.villain as Piece] : []),
  ...s.minions,
];
const attachedTo = (s: GameState, id: string, code: string) =>
  s.attachments.filter(
    (a) => a.attachedTo === id && a.code === code && active(s, a),
  );
const boostIcons = (p: Piece) => Number(def(p)?.boost || 0);
const costOf = (p: Piece) => {
  const cost = Number(def(p)?.cost);
  return Number.isFinite(cost) ? Math.max(0, cost) : 0;
};

/** Each player's identity ("hero:<id>") and allies, in player order. */
function friendlyCharacters(
  s: GameState,
  ports: Pick<HoodModularPorts, "allies">,
  playerId?: string,
): { id: string; playerId: string }[] {
  return playerOrder(s)
    .filter((seat) => !seat.eliminated && (!playerId || seat.id === playerId))
    .flatMap((seat) => [
      { id: `hero:${seat.id}`, playerId: seat.id },
      ...ports.allies(s, seat.id).map((p) => ({ id: p.id, playerId: seat.id })),
    ]);
}
function characterPiece(s: GameState, id: string) {
  if (id.startsWith("hero:")) return seatView(s, id.slice(5)).player;
  for (const seat of s.players) {
    const p = seatView(s, seat).player.inPlay.find((q) => q.id === id);
    if (p) return p;
  }
  return undefined;
}
function characterHP(
  s: GameState,
  id: string,
  ports: Pick<HoodModularPorts, "remainingHP">,
) {
  if (id.startsWith("hero:")) return seatView(s, id.slice(5)).player.hp;
  const p = characterPiece(s, id) as Piece | undefined;
  return p ? ports.remainingHP(s, p) : 0;
}
function characterName(s: GameState, id: string, ports: HoodModularPorts) {
  if (id.startsWith("hero:")) return ports.heroName(s, id.slice(5));
  const p = characterPiece(s, id) as Piece | undefined;
  return p ? name(p) : id;
}
/** The characters tied for the fewest remaining hit points. */
function weakest(
  s: GameState,
  ports: HoodModularPorts,
): { id: string; playerId: string }[] {
  const all = friendlyCharacters(s, ports);
  if (!all.length) return [];
  const low = Math.min(...all.map((c) => characterHP(s, c.id, ports)));
  return all.filter((c) => characterHP(s, c.id, ports) === low);
}
function status(target: string, kind: "stunned" | "confused"): Effect {
  return { type: "status", target, status: kind };
}
function damage(
  target: string,
  amount: number,
  playerId: string,
  source = "encounter",
): Effect {
  return { type: "damage", target, amount, source, actorId: playerId };
}
/** Discard from the encounter deck until a card matches; the deck may run
 * out once, after which the search stops. */
function discardUntil(
  s: GameState,
  ports: HoodModularPorts,
  match: (p: Piece) => boolean,
): Piece | undefined {
  for (let guard = 0; guard < 200; guard++) {
    const last = s.encounter.deck.length <= 1;
    const { piece, emptied } = ports.discardTop(s);
    if (!piece) return undefined;
    if (match(piece)) return piece;
    if (emptied || last) return undefined;
  }
  return undefined;
}
function chooseOne(
  s: GameState,
  ports: HoodModularPorts,
  title: string,
  text: string,
  ids: string[],
  effect: (id: string) => Effect[],
) {
  if (!ids.length) return;
  if (ids.length === 1) {
    ports.queue(s, ...effect(ids[0]));
    return;
  }
  ports.choose(
    s,
    title,
    text,
    ids.map((id) => {
      const p = characterPiece(s, id) as Piece | undefined;
      return {
        id,
        label: characterName(s, id, ports),
        ...(p && "code" in p ? { image: p.code } : {}),
        effects: effect(id),
      };
    }),
  );
}

// ------------------------------------------------------------ constants

/** Streets of Mayhem: constant effects of the Setting in play. */
export function hoodModularGlobal(s: GameState) {
  const settings = (s.environments || []).filter(
    (p) => SETTINGS.includes(p.code) && active(s, p),
  );
  const count = (code: string) =>
    settings.filter((p) => p.code === code).length;
  return {
    attack: count(BACK_ALLEY_ENCLAVE),
    thwart: count(SECRET_LAIR),
    retaliate: count(SEWER_TUNNELS),
    steady: count(WAREHOUSE_DISTRICT) > 0,
  };
}

/** Secret Lair: each enemy in play gains 1 acceleration icon. */
export function hoodModularAcceleration(s: GameState): number {
  const lairs = (s.environments || []).filter(
    (p) => p.code === SECRET_LAIR && active(s, p),
  ).length;
  return lairs ? lairs * enemies(s).length : 0;
}

export function hoodModularKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword === "Retaliate") {
    let n = attachedTo(s, p.id, HOLOSHIELD).length * 2;
    if (p.code === MANDRILL && active(s, p)) {
      const confused =
        s.players.filter(
          (seat) => !seat.eliminated && seatView(s, seat).player.confused,
        ).length +
        s.players.reduce(
          (sum, seat) =>
            sum +
            seatView(s, seat).player.inPlay.filter(
              (q) => typeOf(q) === "ally" && q.confused,
            ).length,
          0,
        ) +
        enemies(s).filter((q) => q.confused).length;
      n += confused;
    }
    const talent = inPlay(s, TOP_TALENT).length;
    if (
      talent &&
      (p.id === s.villain?.id ||
        (s.minions.some((m) => m.id === p.id) && hasTrait(p, "Elite")))
    )
      n += talent;
    return n;
  }
  const attacking = s.attack?.attacker === p.id;
  if (keyword === "Overkill" && attacking)
    return Number(
      (p.code === BULLDOZER && active(s, p)) ||
        (p.code === CROSSFIRE && active(s, p)) ||
        attachedTo(s, p.id, TECH_GAUNTLETS).length > 0,
    );
  if (keyword === "Ranged" && attacking)
    return Number(p.code === CROSSFIRE && active(s, p));
  return 0;
}

/** Holoshield Generator: +4 hit points. Tech Gauntlets: +3 hit points. */
export function hoodModularHealth(s: GameState, p: Piece): number {
  return (
    attachedTo(s, p.id, HOLOSHIELD).length * 4 +
    attachedTo(s, p.id, TECH_GAUNTLETS).length * 3
  );
}

/** Wrecker: +2 ATK while attacking if the attack is undefended. */
export function hoodModularEnemyAttack(s: GameState, p: Piece): number {
  const a = s.attack;
  if (!a || a.attacker !== p.id || p.code !== WRECKER || !active(s, p))
    return 0;
  return a.defender === "none" && !a.eventDefense ? 2 : 0;
}

/** Flamethrower: the attached minion's attacks deal indirect damage. */
export function hoodModularIndirectAttack(s: GameState, attackerId: string) {
  return attachedTo(s, attackerId, FLAMETHROWER).length > 0;
}

/** Steady from Warehouse District applies to every character. */
export function hoodModularSteady(s: GameState) {
  return hoodModularGlobal(s).steady;
}

// ------------------------------------------------------------ damage

/** Beast Mode and Controller increase damage that would be taken. */
export function hoodModularIncreaseDamage(
  s: GameState,
  target: string,
  amount: number,
  attackerId: string | undefined,
  ports: Pick<HoodModularPorts, "attackOf">,
): number {
  if (amount <= 0) return amount;
  const friendly =
    target.startsWith("hero:") ||
    target === "hero" ||
    s.players.some((seat) =>
      seatView(s, seat).player.inPlay.some(
        (q) => q.id === target && typeOf(q) === "ally",
      ),
    );
  if (!friendly) return amount;
  const id = target === "hero" ? `hero:${s.activePlayerId}` : target;
  const p = characterPiece(s, id);
  let n = amount;
  if (p && (p.stunned || p.confused)) n += inPlay(s, BEAST_MODE).length;
  const attacker = attackerId
    ? s.minions.find((m) => m.id === attackerId)
    : undefined;
  if (attacker?.code === CONTROLLER && active(s, attacker))
    n += Math.max(0, ports.attackOf(s, id));
  return n;
}

/** Self-Experimentation: damage a Brute enemy would take removes threat from
 * the scheme instead. Returns the effects that replace the damage. */
export function hoodModularReplaceDamage(
  s: GameState,
  target: string,
  amount: number,
): Effect[] | null {
  if (amount <= 0) return null;
  const enemy = enemies(s).find((p) => p.id === target);
  if (!enemy || !hasTrait(enemy, "Brute")) return null;
  // A scheme without threat cannot remove any instead: it is already being
  // defeated, and the damage is dealt.
  const scheme = s.sideSchemes.find(
    (p) =>
      p.code === SELF_EXPERIMENTATION &&
      active(s, p) &&
      p.counters > 0 &&
      !p.pendingDefeat,
  );
  if (!scheme) return null;
  return [M("experiment", { id: scheme.id, amount })];
}

/** Jetpack: damage from an attack to the attached minion is reduced by the
 * boost icons on the top card of the encounter deck, which is discarded. */
export function hoodModularJetpack(
  s: GameState,
  target: string,
  amount: number,
  ports: Pick<HoodModularPorts, "discardTop" | "log">,
): number {
  if (amount <= 0) return amount;
  let n = amount;
  for (const _jetpack of attachedTo(s, target, JETPACK)) {
    const { piece } = ports.discardTop(s);
    if (!piece) break;
    const icons = boostIcons(piece);
    ports.log(
      s,
      `Jetpack discards ${name(piece)}: ${icons} boost icon${icons === 1 ? "" : "s"} prevent${icons === 1 ? "s" : ""} damage.`,
      icons ? "bad" : "info",
    );
    n = Math.max(0, n - icons);
  }
  return n;
}

// ------------------------------------------------------------ activations

/** Crossfire attacks the friendly character with the fewest remaining hit
 * points. Return the effects that replace this attack's target. */
export function hoodModularAttackRedirect(
  s: GameState,
  enemyId: string,
  originalTarget: string | undefined,
  playerId: string,
  ports: HoodModularPorts,
): { playerId: string; target: string }[] | null {
  const p = s.minions.find((m) => m.id === enemyId);
  if (!p || p.code !== CROSSFIRE || !active(s, p) || originalTarget)
    return null;
  const tied = weakest(s, ports);
  if (!tied.length) return null;
  // Prefer the attacked player's own character when several are tied.
  const own = tied.filter((c) => c.playerId === playerId);
  return (own.length ? own : tied).map((c) => ({
    playerId: c.playerId,
    target: c.id.startsWith("hero:") ? "hero" : c.id,
  }));
}

/** Forced interrupts when an enemy attacks you. */
export function hoodModularAttackInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === enemyId);
  if (!p || !active(s, p)) return [];
  if (p.code === WHITE_RABBIT)
    return [{ type: "randomDiscard", actorId: playerId }];
  return [];
}

/** Brothers Grimm: when he activates against you, discard until an
 * attachment is discarded and reveal it. */
export function hoodModularActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === enemyId);
  if (!p || p.code !== BROTHERS_GRIMM || !active(s, p)) return [];
  return [M("grimm-hunt", { playerId, actorId: playerId })];
}

/** Forced responses after an enemy attacks. */
export function hoodModularAttackResponses(
  s: GameState,
  r: {
    token: string;
    attackerId: string;
    attackerCode: string;
    playerId: string;
    /** The characters this attack damaged: "hero:<id>" or allies. */
    damagedIds: string[];
    identityDamaged: boolean;
    textBlank: boolean;
  },
  ports: Pick<HoodModularPorts, "allies">,
): MutagenForcedResponse[] {
  if (r.textBlank || over(s) || !alive(s, r.playerId)) return [];
  const effects = attackResponseEffects(s, r, ports);
  return effects.length
    ? [
        {
          id: `${r.token}:hoodmod:${r.attackerId}`,
          sourceId: r.attackerId,
          title: name(r.attackerCode),
          effects,
        },
      ]
    : [];
}
function attackResponseEffects(
  s: GameState,
  r: Parameters<typeof hoodModularAttackResponses>[1],
  ports: Pick<HoodModularPorts, "allies">,
): Effect[] {
  switch (r.attackerCode) {
    case GRIFFIN:
      return r.damagedIds.map((id) => ({
        ...status(id, "stunned"),
        actorId: r.playerId,
      }));
    case BEETLE:
      return r.identityDamaged
        ? [M("discard-lowest", { playerId: r.playerId, kind: "upgrade" })]
        : [];
    case BOOMERANG:
      return ports
        .allies(s, r.playerId)
        .map((a) => damage(a.id, 1, r.playerId, r.attackerId));
    case THUNDERBALL:
      return friendlyCharacters(s, ports, r.playerId).map((c) =>
        damage(c.id, 1, r.playerId, r.attackerId),
      );
    default:
      return [];
  }
}

/** Brothers Grimm's items: after the attached enemy activates against you. */
export function hoodModularAfterActivation(
  s: GameState,
  r: { token: string; attackerId: string; playerId: string },
): MutagenForcedResponse[] {
  if (over(s) || !alive(s, r.playerId)) return [];
  return s.attachments
    .filter(
      (a) =>
        a.attachedTo === r.attackerId &&
        GRIMM_ITEMS.includes(a.code) &&
        active(s, a),
    )
    .map((a) => ({
      id: `${r.token}:hoodmod:${a.id}`,
      sourceId: a.id,
      title: name(a),
      effects: [
        M("grimm-item", {
          id: a.id,
          playerId: r.playerId,
          actorId: r.playerId,
        }),
      ],
    }));
}

/** Shocker: after he is attacked, stun the attacking character. */
export function hoodModularEnemyAttacked(
  s: GameState,
  targetId: string,
  attackerId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === targetId);
  if (!p || p.code !== SHOCKER || !active(s, p)) return [];
  const id =
    attackerId === "hero" || attackerId.startsWith("hero:")
      ? `hero:${attackerId.startsWith("hero:") ? attackerId.slice(5) : playerId}`
      : attackerId;
  return [{ ...status(id, "stunned"), actorId: playerId }];
}

/** Speed Demon: when a character attacks him, he attacks that character
 * first. Return the interrupt, then the attack continues. */
export function hoodModularSpeedDemon(
  s: GameState,
  e: Effect,
): Effect[] | null {
  if (!e.attack || e.hoodSpeedDemonHandled) return null;
  const p = s.minions.find((m) => m.id === e.target);
  if (!p || p.code !== SPEED_DEMON || !active(s, p)) return null;
  const source = (e.source as string | undefined) || "hero";
  const playerId = source.startsWith("hero:")
    ? source.slice(5)
    : e.actorId || s.activePlayerId;
  // A stunned character's attack is replaced by removing the stun: it does
  // not attack Speed Demon.
  const attacker = characterPiece(
    s,
    source === "hero" ? `hero:${playerId}` : source,
  );
  if (!e.attackInitiated && attacker?.stunned) return null;
  return [
    M("speed-demon", {
      id: p.id,
      playerId,
      target: source === "hero" || source.startsWith("hero:") ? "hero" : source,
      actorId: playerId,
    }),
    { ...e, hoodSpeedDemonHandled: true },
  ];
}

/** Mister Fear: the engaged player must spend a mental resource to ready a
 * hero or ally they control. */
export function hoodModularReadyCost(
  s: GameState,
  e: Effect,
  ports: Pick<HoodModularPorts, "canPay">,
): Effect[] | null {
  if (e.hoodFearPaid) return null;
  const target = (e.target || e.id) as string | undefined;
  if (!target) return null;
  let playerId: string | undefined;
  if (target === "hero") playerId = e.actorId || s.activePlayerId;
  else if (target.startsWith("hero:")) playerId = target.slice(5);
  else
    playerId = s.players.find((seat) =>
      seatView(s, seat).player.inPlay.some(
        (q) => q.id === target && typeOf(q) === "ally",
      ),
    )?.id;
  if (!playerId) return null;
  const fear = s.minions.some(
    (m) => m.code === MISTER_FEAR && m.engagedWith === playerId && active(s, m),
  );
  if (!fear) return null;
  const piece = characterPiece(
    s,
    target === "hero" ? `hero:${playerId}` : target,
  );
  if (!piece || !piece.exhausted) return null;
  return [
    M("fear-cost", {
      playerId,
      actorId: playerId,
      after: { ...e, hoodFearPaid: true },
    }),
  ];
}

/** When Defeated abilities of minions. */
export function hoodModularMinionDefeated(
  s: GameState,
  p: Piece,
  engagedWith: string | undefined,
): Effect[] {
  if (!known(p)) return [];
  if (p.code === GRIFFIN) return [M("griffin-defeated", { id: p.id })];
  if (p.code === CALVIN_ZABO)
    return [
      M("zabo-defeated", {
        playerId: engagedWith || s.activePlayerId,
        actorId: engagedWith || s.activePlayerId,
      }),
    ];
  return [];
}

// ------------------------------------------------------------ reveal

export function hoodModularReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (GRIMM_ITEMS.includes(p.code))
    return [M("attach-mystic", { piece: p, playerId })];
  if ([FLAMETHROWER, HOLOSHIELD].includes(p.code))
    return [M("attach-armory", { piece: p, playerId, search: true })];
  if ([JETPACK, TECH_GAUNTLETS].includes(p.code))
    return [M("attach-armory", { piece: p, playerId, search: false })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  switch (p.code) {
    case MANDRILL:
      return [M("confuse-all", { playerId })];
    case DOUBLE_TROUBLE:
      return [M("double-trouble", { playerId })];
    case OUT_FOR_BLOOD:
      return [M("out-for-blood", { playerId })];
    case CORRUPTOR:
      return [M("corruptor", { playerId })];
    case CAUGHT_IN_THE_CROSSFIRE:
      return [M("caught", { playerId })];
    case SELF_EXPERIMENTATION:
      return [M("find-hyde", { playerId })];
    case CALVIN_ZABO:
      return [M("zabo", { id: p.id, playerId })];
    case MISTER_HYDE:
      return [M("hyde", { id: p.id, playerId })];
    case HYDE_FORMULA:
      return [M("formula", { playerId, sourceCode: p.code })];
    case CRIME_PAYS:
      return [M("crime-pays", { playerId, sourceCode: p.code })];
    case SINISTER_ONSLAUGHT:
      return [M("onslaught", { playerId, hero, sourceCode: p.code })];
    case FEISTY_HEIST:
      return [M("heist", { playerId })];
    case DISASTER_AT_THE_DOCKS:
      return [
        M("indirect", { playerId, amount: 3, source: p.id, title: name(p) }),
      ];
    case OFFSHORE_INFERNO:
      return [M("discard-lowest", { playerId, kind: "any" })];
    case HOT_PURSUIT:
      return [M("pursuit", { playerId })];
    case CITYWIDE_CRISIS:
      return [M("crisis", { playerId })];
    case BACK_ALLEY_ENCLAVE:
    case SECRET_LAIR:
    case SEWER_TUNNELS:
    case WAREHOUSE_DISTRICT:
      return [M("setting", { id: p.id })];
    case COMBINED_EFFORT:
      return [M("combined", { sourceCode: p.code })];
    case MAGIC_MUSCLE:
      return [M("muscle", { playerId })];
    default:
      return [];
  }
}

export function hoodModularBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case DOUBLE_TROUBLE:
      return [M("double-trouble", { playerId })];
    case BROTHERS_GRIMM:
      return [M("grimm-boost", { id: p.id })];
    case OUT_FOR_BLOOD:
      return [M("out-for-blood", { playerId })];
    case CORRUPTOR:
      return [M("exhaust-one", { playerId })];
    case MISTER_FEAR:
      return [M("fear-boost", { playerId })];
    case BEETLE:
      return [M("choose-discard", { playerId, kind: "upgrade" })];
    case BOOMERANG:
      return [M("boomerang", { playerId })];
    case SHOCKER:
      return [M("shocker", { playerId })];
    case SPEED_DEMON:
      return [M("discard-lowest", { playerId, kind: "support" })];
    case WHITE_RABBIT:
      return [M("rabbit", { playerId })];
    case CITYWIDE_CRISIS:
      return [M("crisis", { playerId })];
    case COMBINED_EFFORT:
      return [M("combined-boost")];
    default:
      return [];
  }
}

// ------------------------------------------------------------ resolver

export function resolveHoodModularEffect(
  s: GameState,
  e: Effect,
  ports: HoodModularPorts,
): boolean {
  if (!e.type.startsWith("hoodmod:")) return false;
  switch (e.type) {
    case "hoodmod:confuse-all":
      if (alive(s, e.playerId))
        ports.queue(
          s,
          ...friendlyCharacters(s, ports, e.playerId).map((c) => ({
            ...status(c.id, "confused"),
            actorId: e.playerId,
          })),
        );
      break;
    case "hoodmod:double-trouble": {
      if (!alive(s, e.playerId)) break;
      const ids = friendlyCharacters(s, ports, e.playerId).map((c) => c.id);
      ports.queue(s, M("double-confuse", { playerId: e.playerId }));
      chooseOne(
        s,
        ports,
        name(DOUBLE_TROUBLE),
        "Stun a character you control.",
        ids,
        (id) => [{ ...status(id, "stunned"), actorId: e.playerId }],
      );
      break;
    }
    case "hoodmod:double-confuse": {
      if (!alive(s, e.playerId)) break;
      const ids = friendlyCharacters(s, ports, e.playerId).map((c) => c.id);
      chooseOne(
        s,
        ports,
        name(DOUBLE_TROUBLE),
        "Confuse a character you control.",
        ids,
        (id) => [{ ...status(id, "confused"), actorId: e.playerId }],
      );
      break;
    }
    case "hoodmod:attach-mystic": {
      const p = e.piece as Piece;
      const mystic = s.minions.filter((m) => hasTrait(m, "Mystic"));
      if (!mystic.length) {
        if (s.villain) ports.attach(s, p, s.villain.id);
        break;
      }
      if (mystic.length === 1) {
        ports.attach(s, p, mystic[0].id);
        break;
      }
      ports.choose(
        s,
        name(p),
        "Choose the Mystic minion this card attaches to.",
        mystic.map((m) => ({
          id: m.id,
          label: name(m),
          image: m.code,
          effects: [M("attach-to", { piece: p, id: m.id })],
        })),
      );
      break;
    }
    case "hoodmod:attach-to":
      if (s.minions.some((m) => m.id === e.id) || s.villain?.id === e.id)
        ports.attach(s, e.piece, e.id);
      break;
    case "hoodmod:attach-armory": {
      const p = e.piece as Piece;
      if (s.minions.length) {
        const hp = Math.max(...s.minions.map((m) => ports.remainingHP(s, m)));
        const tied = s.minions.filter((m) => ports.remainingHP(s, m) === hp);
        if (tied.length === 1) ports.attach(s, p, tied[0].id);
        else
          ports.choose(
            s,
            name(p),
            "Choose a minion tied for the most remaining hit points.",
            tied.map((m) => ({
              id: m.id,
              label: name(m),
              image: m.code,
              effects: [M("attach-to", { piece: p, id: m.id })],
            })),
          );
        break;
      }
      if (!e.search) {
        ports.queue(s, { type: "surge", sourceCode: p.code });
        break;
      }
      // Search the encounter deck and discard pile for a minion.
      const zones = [s.encounter.deck, s.encounter.discard];
      let found: Piece | undefined;
      for (const zone of zones) {
        const i = zone.findIndex((q) => typeOf(q) === "minion");
        if (i >= 0) {
          found = zone[i];
          break;
        }
      }
      if (found && alive(s, e.playerId)) {
        ports.enterMinion(s, found, e.playerId);
        if (s.minions.some((m) => m.id === found!.id))
          ports.attach(s, p, found.id);
        else ports.discardPiece(s, p.id);
      } else ports.discardPiece(s, p.id);
      ports.shuffleEncounter(s);
      break;
    }
    case "hoodmod:out-for-blood": {
      if (over(s)) break;
      const tied = weakest(s, ports);
      if (!tied.length) break;
      const hit = (id: string, playerId: string): Effect[] => [
        damage(id, 1, playerId, OUT_FOR_BLOOD),
        M("out-for-blood-check", { id, playerId: e.playerId }),
      ];
      if (tied.length === 1)
        ports.queue(s, ...hit(tied[0].id, tied[0].playerId));
      else
        ports.choose(
          s,
          name(OUT_FOR_BLOOD),
          "Deal 1 damage to the friendly character with the fewest remaining hit points.",
          tied.map((c) => {
            const p = characterPiece(s, c.id) as Piece | undefined;
            return {
              id: c.id,
              label: characterName(s, c.id, ports),
              ...(p && "code" in p ? { image: p.code } : {}),
              effects: hit(c.id, c.playerId),
            };
          }),
        );
      break;
    }
    case "hoodmod:out-for-blood-check": {
      // Repeat when that character was defeated.
      const id = e.id as string;
      const defeated = id.startsWith("hero:")
        ? !alive(s, id.slice(5)) || seatView(s, id.slice(5)).player.hp <= 0
        : !characterPiece(s, id);
      if (defeated && !over(s))
        ports.queue(s, M("out-for-blood", { playerId: e.playerId }));
      break;
    }
    case "hoodmod:corruptor": {
      if (!alive(s, e.playerId)) break;
      const ready = ports.allies(s, e.playerId).filter((a) => !a.exhausted);
      for (const a of ready) a.exhausted = true;
      if (ready.length)
        ports.queue(s, {
          type: "threat",
          target: "main",
          amount: ready.length,
        });
      ports.log(
        s,
        `Corruptor exhausts ${ready.length} all${ready.length === 1 ? "y" : "ies"}.`,
        ready.length ? "bad" : "info",
      );
      break;
    }
    case "hoodmod:exhaust-one": {
      if (!alive(s, e.playerId)) break;
      const ids = friendlyCharacters(s, ports, e.playerId)
        .map((c) => c.id)
        .filter((id) => !characterPiece(s, id)?.exhausted);
      chooseOne(
        s,
        ports,
        name(CORRUPTOR),
        "Choose and exhaust a character you control.",
        ids,
        (id) => [
          {
            type: "exhaust",
            id: id.startsWith("hero:") ? "hero" : id,
            actorId: e.playerId,
          },
        ],
      );
      break;
    }
    case "hoodmod:caught": {
      if (!alive(s, e.playerId)) break;
      const crew = (p: Piece) =>
        typeOf(p) === "minion" && hasTrait(p, "Crossfire's Crew");
      const found = discardUntil(s, ports, crew);
      ports.queue(s, M("caught-damage", { playerId: e.playerId }));
      if (found) ports.reveal(s, found, e.playerId);
      break;
    }
    case "hoodmod:caught-damage": {
      const n = s.minions.filter((m) => hasTrait(m, "Crossfire's Crew")).length;
      if (n && alive(s, e.playerId))
        ports.indirect(
          s,
          e.playerId,
          n,
          CAUGHT_IN_THE_CROSSFIRE,
          name(CAUGHT_IN_THE_CROSSFIRE),
        );
      break;
    }
    case "hoodmod:fear-boost": {
      if (!alive(s, e.playerId)) break;
      for (let guard = 0; guard < 80; guard++) {
        const { piece, emptied } = ports.discardPlayerTop(s, e.playerId);
        if (!piece || typeOf(piece) === "ally" || emptied) break;
      }
      break;
    }
    case "hoodmod:fear-cost": {
      if (!alive(s, e.playerId)) break;
      if (!ports.canPay(s, 1, ["mental"])) {
        ports.log(
          s,
          "Mister Fear: no mental resource is available, so the card does not ready.",
          "bad",
        );
        break;
      }
      ports.pay(s, 1, ["mental"], [e.after], name(MISTER_FEAR), true);
      break;
    }
    case "hoodmod:find-hyde": {
      let found: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((q) => q.code === MISTER_HYDE);
        if (i >= 0) {
          found = zone[i];
          break;
        }
      }
      if (found) ports.reveal(s, found, e.playerId);
      ports.queue(s, M("shuffle"));
      break;
    }
    case "hoodmod:shuffle":
      ports.shuffleEncounter(s);
      break;
    case "hoodmod:experiment": {
      const scheme = s.sideSchemes.find((p) => p.id === e.id);
      if (!scheme) break;
      const removed = Math.min(scheme.counters, e.amount);
      scheme.counters -= removed;
      ports.log(
        s,
        `Self-Experimentation: ${removed} threat is removed instead of damage.`,
        "good",
      );
      if (removed && !scheme.counters)
        ports.queue(s, { type: "defeatScheme", id: scheme.id, source: "hero" });
      break;
    }
    case "hoodmod:zabo": {
      const zabo = s.minions.find((m) => m.id === e.id);
      const hyde = s.minions.find(
        (m) => m.code === MISTER_HYDE && active(s, m),
      );
      if (!zabo || !hyde || !alive(s, e.playerId)) break;
      ports.discardPiece(s, zabo.id);
      ports.attackCharacter(s, hyde.id, e.playerId, "hero", 2, undefined);
      // "That attack gains overkill."
      if (s.attack?.attacker === hyde.id) s.attack.overkill = true;
      break;
    }
    case "hoodmod:zabo-defeated": {
      let found: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((q) => q.code === MISTER_HYDE);
        if (i >= 0) {
          found = zone[i];
          break;
        }
      }
      if (found && alive(s, e.playerId))
        ports.enterMinion(s, found, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "hoodmod:hyde": {
      const hyde = s.minions.find((m) => m.id === e.id);
      if (!hyde) break;
      const zabo = s.minions.find(
        (m) => m.code === CALVIN_ZABO && m.engagedWith,
      );
      if (zabo) {
        const engaged = zabo.engagedWith!;
        ports.discardPiece(s, zabo.id);
        hyde.engagedWith = engaged;
      }
      ports.giveTough(s, hyde);
      ports.queue(
        s,
        ...friendlyCharacters(s, ports)
          .filter(
            (c) =>
              !c.id.startsWith("hero:") ||
              seatView(s, c.playerId).player.form === "hero",
          )
          .map((c) => damage(c.id, 1, c.playerId, hyde.id)),
      );
      break;
    }
    case "hoodmod:formula": {
      const zabo = s.minions.find(
        (m) => m.code === CALVIN_ZABO && active(s, m),
      );
      const hyde = s.minions.find(
        (m) => m.code === MISTER_HYDE && active(s, m),
      );
      if (!zabo && !hyde) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      // Calvin Zabo's part resolves first. Mister Hyde's part checks for him
      // when it resolves: a defeated Zabo may have brought him into play.
      ports.queue(s, M("formula-hyde", { playerId: e.playerId }));
      if (zabo)
        ports.activate(s, {
          enemyId: zabo.id,
          playerId: e.playerId,
          kind: "scheme",
          modifier: 3,
          after: M("formula-damage", { id: zabo.id, playerId: e.playerId }),
        });
      break;
    }
    case "hoodmod:formula-damage":
      if (s.minions.some((m) => m.id === e.id))
        ports.queue(s, damage(e.id, 4, e.playerId, HYDE_FORMULA));
      break;
    case "hoodmod:formula-hyde": {
      const hyde = s.minions.find(
        (m) => m.code === MISTER_HYDE && active(s, m),
      );
      if (!hyde || !alive(s, e.playerId)) break;
      ports.giveTough(s, hyde);
      ports.attackCharacter(s, hyde.id, e.playerId, "hero", 0, undefined);
      break;
    }
    case "hoodmod:crime-pays": {
      const criminals = s.encounter.deck.filter(
        (q) => typeOf(q) === "minion" && hasTrait(q, "Criminal"),
      );
      const distinct = criminals.filter(
        (q, i) => criminals.findIndex((r) => r.code === q.code) === i,
      );
      if (!distinct.length || !alive(s, e.playerId)) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        ports.shuffleEncounter(s);
        break;
      }
      if (distinct.length === 1) {
        ports.enterMinion(s, distinct[0], e.playerId);
        ports.shuffleEncounter(s);
        break;
      }
      ports.choose(
        s,
        name(CRIME_PAYS),
        "Search the encounter deck for a Criminal minion and put it into play engaged with you.",
        distinct.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [M("enter", { id: q.id, playerId: e.playerId })],
        })),
      );
      break;
    }
    case "hoodmod:enter": {
      const p = s.encounter.deck.find((q) => q.id === e.id);
      if (p && alive(s, e.playerId)) ports.enterMinion(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "hoodmod:onslaught": {
      const criminals = enemies(s).filter((q) => hasTrait(q, "Criminal"));
      if (!criminals.length || !alive(s, e.playerId)) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      for (const q of criminals)
        ports.queue(
          s,
          M("activate", {
            id: q.id,
            playerId: e.playerId,
            kind: e.hero ? "attack" : "scheme",
            actorId: e.playerId,
          }),
        );
      break;
    }
    case "hoodmod:activate":
      if (alive(s, e.playerId) && enemies(s).some((q) => q.id === e.id))
        ports.activate(s, {
          enemyId: e.id,
          playerId: e.playerId,
          kind: e.kind,
          modifier: 0,
        });
      break;
    case "hoodmod:heist": {
      if (!alive(s, e.playerId)) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length) break;
      const top = Math.max(...hand.map(costOf));
      const tied = hand.filter((q) => costOf(q) === top);
      if (tied.length === 1) ports.discardHandCard(s, e.playerId, tied[0].id);
      else
        ports.choose(
          s,
          name(FEISTY_HEIST),
          "Discard the highest-cost card from your hand.",
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [M("hand-discard", { playerId: e.playerId, id: q.id })],
          })),
        );
      break;
    }
    case "hoodmod:hand-discard":
      if (seatView(s, e.playerId).player.hand.some((q) => q.id === e.id))
        ports.discardHandCard(s, e.playerId, e.id);
      break;
    case "hoodmod:indirect":
      if (alive(s, e.playerId))
        ports.indirect(s, e.playerId, e.amount, e.source, e.title);
      break;
    case "hoodmod:discard-lowest": {
      // Offshore Inferno: any non-permanent card you control; Beetle: an
      // upgrade; Speed Demon: a support.
      if (!alive(s, e.playerId)) break;
      const kinds =
        e.kind === "any" ? ["ally", "upgrade", "support"] : [e.kind as string];
      const options = seatView(s, e.playerId).player.inPlay.filter(
        (q) => kinds.includes(typeOf(q) || "") && ports.canDiscard(s, q),
      );
      if (!options.length) break;
      const low = Math.min(...options.map(costOf));
      const tied = options.filter((q) => costOf(q) === low);
      if (tied.length === 1) ports.discardPiece(s, tied[0].id);
      else
        ports.choose(
          s,
          "Discard",
          `Discard the lowest-cost ${e.kind === "any" ? "card" : e.kind} you control.`,
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [{ type: "discardPiece", id: q.id }],
          })),
        );
      break;
    }
    case "hoodmod:choose-discard": {
      if (!alive(s, e.playerId)) break;
      const options = seatView(s, e.playerId).player.inPlay.filter(
        (q) => typeOf(q) === e.kind && ports.canDiscard(s, q),
      );
      if (!options.length) break;
      ports.choose(
        s,
        "Discard",
        `Choose and discard ${e.kind === "upgrade" ? "an upgrade" : `a ${e.kind}`} you control.`,
        options.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [{ type: "discardPiece", id: q.id }],
        })),
      );
      break;
    }
    case "hoodmod:pursuit": {
      if (!alive(s, e.playerId)) break;
      const found = discardUntil(s, ports, (q) => typeOf(q) === "minion");
      if (found) ports.enterMinion(s, found, e.playerId);
      break;
    }
    case "hoodmod:crisis": {
      if (over(s)) break;
      const schemes = s.sideSchemes.filter(
        (p) =>
          active(s, p) &&
          /<b>When Revealed[^<]*<\/b>/i.test(def(p)?.text || ""),
      );
      if (!schemes.length) {
        ports.queue(
          s,
          { type: "threat", target: "main", amount: 2 },
          ...s.sideSchemes.map((p) => ({
            type: "threat",
            target: p.id,
            amount: 2,
          })),
        );
        break;
      }
      for (const p of schemes) ports.resolveWhenRevealed(s, p, e.playerId);
      break;
    }
    case "hoodmod:setting": {
      for (const p of [...(s.environments || [])])
        if (
          p.id !== e.id &&
          hasTrait(p, "Setting") &&
          s.environments?.some((q) => q.id === p.id)
        )
          ports.discardPiece(s, p.id);
      break;
    }
    case "hoodmod:combined": {
      const elite = s.minions.filter(
        (m) => hasTrait(m, "Elite") && m.engagedWith && alive(s, m.engagedWith),
      );
      if (!elite.length) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      for (const m of elite)
        ports.queue(
          s,
          M("activate", {
            id: m.id,
            playerId: m.engagedWith,
            kind:
              seatView(s, m.engagedWith!).player.form === "hero"
                ? "attack"
                : "scheme",
            actorId: m.engagedWith,
          }),
        );
      break;
    }
    case "hoodmod:combined-boost": {
      const activation = s.attack || s.scheming;
      const n = s.minions.filter((m) => hasTrait(m, "Elite")).length;
      if (activation && n)
        activation.extraBoostIcons = (activation.extraBoostIcons || 0) + n;
      break;
    }
    case "hoodmod:muscle": {
      const brutes = enemies(s).filter((q) => hasTrait(q, "Brute"));
      let given = 0;
      for (const q of brutes) {
        const before = !!q.tough;
        ports.giveTough(s, q);
        if (!before && q.tough) given++;
      }
      if (given) break;
      const found = discardUntil(
        s,
        ports,
        (q) => typeOf(q) === "minion" && hasTrait(q, "Brute"),
      );
      if (found) ports.reveal(s, found, e.playerId);
      break;
    }
    case "hoodmod:grimm-hunt": {
      if (!alive(s, e.playerId)) break;
      const found = discardUntil(s, ports, (q) => typeOf(q) === "attachment");
      if (found) ports.reveal(s, found, e.playerId);
      break;
    }
    case "hoodmod:grimm-boost": {
      // After this activation ends, Brothers Grimm enters play engaged with
      // the first player instead of being discarded.
      const activation = s.attack || s.scheming;
      if (activation && !activation.retainedBoostIds?.includes(e.id))
        (activation.retainedBoostIds ||= []).push(e.id);
      const effect = M("grimm-enter", { id: e.id });
      if (activation) (activation.afterActivation ||= []).push(effect);
      else ports.queue(s, effect);
      break;
    }
    case "hoodmod:grimm-enter": {
      const zones = [s.resolving, s.encounter.discard];
      let p: Piece | undefined;
      for (const zone of zones) {
        p = zone.find((q) => q.id === e.id);
        if (p) break;
      }
      const first = s.firstPlayerId;
      if (p && alive(s, first)) ports.enterMinion(s, p, first);
      break;
    }
    case "hoodmod:grimm-item": {
      const item = s.attachments.find((a) => a.id === e.id);
      if (!item || !alive(s, e.playerId)) break;
      ports.discardPiece(s, item.id);
      const deal: Effect = { type: "dealEncounter", playerId: e.playerId };
      switch (item.code) {
        case BLACKBIRD_PELLETS:
          ports.randomDiscard(s, e.playerId);
          ports.queue(s, deal);
          break;
        case CORROSIVE_EGG_BOMB:
          ports.queue(s, deal);
          ports.indirect(s, e.playerId, 3, item.id, name(item));
          break;
        case PARALYTIC_STARDUST:
          ports.queue(
            s,
            { ...status(`hero:${e.playerId}`, "stunned"), actorId: e.playerId },
            deal,
          );
          break;
        case UNBREAKABLE_THREAD: {
          ports.queue(s, deal);
          const options = seatView(s, e.playerId).player.inPlay.filter(
            (q) =>
              ["ally", "support", "upgrade"].includes(typeOf(q) || "") &&
              ports.canDiscard(s, q),
          );
          if (options.length)
            ports.choose(
              s,
              name(UNBREAKABLE_THREAD),
              "Choose and discard an ally, support or upgrade you control.",
              options.map((q) => ({
                id: q.id,
                label: name(q),
                image: q.code,
                effects: [{ type: "discardPiece", id: q.id }],
              })),
            );
          break;
        }
      }
      break;
    }
    case "hoodmod:griffin-defeated": {
      const stunned = friendlyCharacters(s, ports).some(
        (c) => characterPiece(s, c.id)?.stunned,
      );
      if (!stunned) break;
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (p) ports.shuffleIntoEncounter(s, p);
      break;
    }
    case "hoodmod:boomerang": {
      if (!alive(s, e.playerId)) break;
      const ids = ports.allies(s, e.playerId).map((a) => a.id);
      chooseOne(
        s,
        ports,
        name(BOOMERANG),
        "Deal 2 damage to an ally you control.",
        ids,
        (id) => [damage(id, 2, e.playerId, BOOMERANG)],
      );
      break;
    }
    case "hoodmod:shocker": {
      if (!alive(s, e.playerId)) break;
      const chars = friendlyCharacters(s, ports, e.playerId);
      if (!chars.length) break;
      const high = Math.max(...chars.map((c) => ports.attackOf(s, c.id)));
      const ids = chars
        .filter((c) => ports.attackOf(s, c.id) === high)
        .map((c) => c.id);
      chooseOne(
        s,
        ports,
        name(SHOCKER),
        "Stun the character you control with the highest ATK.",
        ids,
        (id) => [{ ...status(id, "stunned"), actorId: e.playerId }],
      );
      break;
    }
    case "hoodmod:rabbit": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      const options = view.player.hand.filter(
        (q) => def(q)?.faction_code === "hero",
      );
      if (!options.length) break;
      ports.choose(
        s,
        name(WHITE_RABBIT),
        "Choose and discard an identity-specific card from your hand.",
        options.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [M("hand-discard", { playerId: e.playerId, id: q.id })],
        })),
      );
      break;
    }
    case "hoodmod:speed-demon": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      ports.attackCharacter(s, p.id, e.playerId, e.target, 0, undefined);
      break;
    }
    default:
      return false;
  }
  return true;
}

/** Codes this module makes playable, for the explicit script registry. */
export const HOOD_MODULAR_SCRIPT_CODES = HOOD_MODULAR_CODES;
export type { Option };
