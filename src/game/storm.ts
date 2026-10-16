import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank, defenseEventSources } from "./card-text.js";
import { playerOrder, seatView, allInPlay, controlledNPCs } from "./team.js";
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

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const S = (type: string, args: Record<string, unknown> = {}) =>
  E(`storm:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const active = (s: GameState) => s.heroId === "storm";
const c = (p: Piece) => cards.get(p.code)!;
const trait = (p: Piece, t: string) =>
  (c(p)?.traits || "").split(/\.\s*/).includes(t);
const phase = (s: GameState) => `${s.round}:${s.phase}`;
export const STORM_WEATHER_CODES = [
  "36002",
  "36003",
  "36004",
  "36005",
] as const;
export const STORM_SCRIPT_CODES = [
  "36001a",
  "36001b",
  ...Array.from({ length: 39 }, (_, i) => String(36002 + i)).filter(
    (code) => !["36027", "36028", "36029", "36040"].includes(code),
  ),
];
export const STORM_CORE_ALIASES = ["36027", "36028", "36029"] as const;
export const STORM_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/ororo-munroe-storm/";
export const STORM_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
const weatherCode = (code: string) =>
  (STORM_WEATHER_CODES as readonly string[]).includes(code);
export interface StormPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  makePiece(s: GameState, code: string): Piece;
  isTextBlank(s: GameState, p: Piece): boolean;
  identityBlank(s: GameState): boolean;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  friendlyTargets(s: GameState): AntManTarget[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  enemyStats(s: GameState, p: Piece): { attack: number; scheme: number };
  allyStat(s: GameState, p: Piece, kind: "attack" | "thwart"): number;
  heroAttack(s: GameState): number;
  maxHeroHP(s: GameState): number;
  alliedPieces(s: GameState): Piece[];
  canReady(s: GameState, id: string): boolean;
  canStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    code?: string,
  ): boolean;
  cost(s: GameState, p: Piece): number;
  playDefense(s: GameState, p: Piece, after: Effect[]): void;
  attackProgram(s: GameState, effects: Effect[], after: Effect[]): void;
  thwartDistribution(
    s: GameState,
    packets: { target: string; amount: number }[],
    after: Effect[],
  ): void;
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  shufflePlayer(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  reveal(s: GameState, p: Piece): void;
  discard(s: GameState, id: string): void;
  returnAlly(s: GameState, id: string): void;
  putAlly(s: GameState, id: string, after: Effect[]): void;
  discardEncounterTop(s: GameState): Piece | undefined;
  flipAlter(s: GameState): void;
  attach(s: GameState, p: Piece, id: string): void;
  remove(s: GameState, p: Piece): void;
  searchEncounter(
    s: GameState,
    codes: string[],
    includeSetAside: boolean,
    after: Effect[],
  ): void;
  activate(s: GameState, id: string, after: Effect[]): void;
}
/** Weather remains active in alter ego. It applies to ALL characters. */
export function stormWeather(s: GameState): Piece | undefined {
  return s.player.inPlay.find((p) => weatherCode(p.code));
}
export function stormGlobal(s: GameState) {
  const weather = allInPlay(s).filter(
    (p) => weatherCode(p.code) && !isTextBlank(s, p),
  );
  return {
    attack: weather.reduce(
      (n, p) => n + (p.code === "36004" ? 1 : p.code === "36005" ? -1 : 0),
      0,
    ),
    retaliate: weather.filter((p) => p.code === "36003").length,
    stalwart: weather.some((p) => p.code === "36002"),
  };
}
export function stormStats(s: GameState) {
  const has = (code: string) =>
    active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === code && !isTextBlank(s, p));
  return {
    thwart: Number(has("36006")),
    defense: Number(has("36007")),
    aerial: has("36007"),
  };
}
export function stormInitialize(
  s: GameState,
  ports: Pick<StormPorts, "makePiece">,
) {
  if (!active(s) || s.flags.stormInitialized) return;
  const reserve = (s.player.setAside ||= []);
  for (const code of [
    ...STORM_WEATHER_CODES,
    "36031",
    "36032",
    "36033",
    "36034",
    "36034",
  ]) {
    const p = ports.makePiece(s, code);
    p.ownerId = s.activePlayerId;
    reserve.push(p);
  }
  s.flags.stormInitialized = true;
}
export function stormSetup(s: GameState): Effect[] {
  return active(s) ? [S("choose-weather", { setup: true })] : [];
}
export function stormCanChangeForm(s: GameState, to: string) {
  return (
    to !== "hero" ||
    !s.player.inPlay.some((p) => p.code === "36030" && !isTextBlank(s, p))
  );
}
export function stormFreezeModifier(
  s: GameState,
  p: Piece,
  playerId: string,
): number {
  const f = seatView(s, playerId).flags;
  return f.stormFreezePhase === phase(s)
    ? -3 * Number(f[`stormFreeze:${p.id}`] || 0)
    : 0;
}
export function stormPiercing(s: GameState, p: Piece) {
  return s.attachments.some(
    (a) => a.code === "36033" && a.attachedTo === p.id && !isTextBlank(s, a),
  );
}
/** Attachments are kept in their physical entry order; the latest active control effect wins. */
export function stormLatestControl(s: GameState, p: Piece): string | undefined {
  return [...allInPlay(s), ...s.attachments]
    .filter(
      (a) =>
        ["34009", "36038", "25031"].includes(a.code) &&
        a.attachedTo === p.id &&
        !isTextBlank(s, a),
    )
    .sort((a, b) => (b.controlOrder || 0) - (a.controlOrder || 0))[0]?.code;
}
export function stormProtected(s: GameState, p: Piece) {
  return (
    p.code === "36036" &&
    !isTextBlank(s, p) &&
    s.minions.some((m) => m.stormControlled)
  );
}
export function stormAllyHP(s: GameState, p: Piece): number {
  const seat = s.players.find((seat) =>
    seatView(s, seat).player.inPlay.some((a) => a.id === p.id),
  );
  return seat && trait(p, "X-Men")
    ? seatView(s, seat).player.inPlay.filter(
        (a) => a.code === "36018" && !isTextBlank(s, a),
      ).length
    : 0;
}
export function stormDiscount(
  s: GameState,
  p: Piece,
  ports: Pick<StormPorts, "hasTrait">,
): number {
  return c(p)?.type_code === "ally" &&
    trait(p, "X-Men") &&
    ports.hasTrait(s, "hero", "X-Men") &&
    [
      ...s.player.inPlay.filter((a) => c(a)?.type_code === "ally"),
      ...controlledNPCs(s),
    ].every((a) => ports.hasTrait(s, a.id, "X-Men")) &&
    s.player.inPlay.some((a) => a.code === "36018" && !isTextBlank(s, a))
    ? 1
    : 0;
}
export function stormResourceSources(s: GameState): PaymentSource[] {
  return s.player.inPlay.flatMap((p) => {
    if (p.exhausted || isTextBlank(s, p)) return [];
    let resource: Resource | undefined;
    if (p.code === "36006" && active(s) && s.player.form === "hero") {
      const w = stormWeather(s);
      if (w)
        resource = (
          {
            "36002": "wild",
            "36003": "physical",
            "36004": "energy",
            "36005": "mental",
          } as Record<string, Resource>
        )[w.code];
    }
    return resource
      ? [
          {
            id: p.id,
            code: p.code,
            name: c(p).name,
            kind: "ability" as const,
            resources: [resource],
            description: `Exhaust ${c(p).name}`,
          },
        ]
      : [];
  });
}
export function stormSpendResource(s: GameState, id: string) {
  const p = own(s, id);
  if (!p || p.code !== "36006") return false;
  need(
    stormResourceSources(s).some((x) => x.id === id),
    "This resource source is unavailable.",
  );
  p.exhausted = true;
  return true;
}
export function stormAbilityOptions(
  s: GameState,
  id: string,
  ports: StormPorts,
): Option[] {
  if (id === "identity")
    return active(s) &&
      s.player.form === "hero" &&
      !ports.identityBlank(s) &&
      s.flags.stormWeatherRound !== s.round
      ? [
          O(
            "weather",
            "Weather Control · change weather",
            [S("choose-weather", { limit: true })],
            "36001a",
          ),
        ]
      : [];
  const p = own(s, id);
  if (!p || p.exhausted || isTextBlank(s, p)) return [];
  if (p.code === "36030")
    return s.player.form === "alter" && !s.player.exhausted
      ? [
          O(
            "claustrophobia",
            "Exhaust Ororo · remove Claustrophobia",
            [S("remove-obligation", { id })],
            p.code,
          ),
        ]
      : [];
  if (
    p.code === "36008" &&
    s.player.form === "alter" &&
    s.player.hp < ports.maxHeroHP(s)
  )
    return [
      O("garden", "Ororo's Garden · heal 2", [S("garden", { id })], p.code),
    ];
  return [];
}
export function stormEvent(s: GameState, p: Piece): Effect[] | null {
  const type = (
    {
      "36009": "goddess",
      "36010": "rain",
      "36011": "lightning",
      "36012": "freeze",
      "36013": "wind",
      "36020": "to-me",
    } as Record<string, string>
  )[p.code];
  return type ? [S(type, { piece: p })] : null;
}
export function stormPlayRestriction(
  s: GameState,
  p: Piece,
  ports: StormPorts,
): string | null {
  if (
    ["36009", "36010", "36011", "36012", "36013"].includes(p.code) &&
    (!active(s) || s.player.form !== "hero")
  )
    return "Storm's events require her hero form.";
  if (p.code === "36012")
    return "Flash Freeze requires the villain to attack you.";
  if (p.code === "36020" && !ports.hasTrait(s, "hero", "X-Men"))
    return "Your identity must have the X-Men trait.";
  if (
    p.code === "36018" &&
    playerOrder(s).every((seat) =>
      seatView(s, seat).player.inPlay.some((a) => trait(a, "Team")),
    )
  )
    return "Each player can control only one Team card.";
  if (p.code === "36019" && s.player.inPlay.some((a) => a.code === p.code))
    return "Max 1 Leadership Skill per player.";
  if (p.code === "36035" && s.player.inPlay.some((a) => a.code === p.code))
    return "Max 1 Hangar Bay per player.";
  return null;
}
export function stormDefenseOptions(
  s: GameState,
  after: Effect[],
  ports: StormPorts,
): Option[] {
  const a = s.attack;
  if (
    !a ||
    !a.isVillain ||
    (a.originalPlayerId || a.targetPlayerId) !== s.activePlayerId ||
    s.player.form !== "hero" ||
    !active(s)
  )
    return [];
  return defenseEventSources(s)
    .filter(
      (p) =>
        p.code === "36012" &&
        !isTextBlank(s, p) &&
        ports.canPay(s, ports.cost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        "Flash Freeze · enemies get −3 ATK",
        [S("play-freeze", { id: p.id, after })],
        p.code,
      ),
    );
}
export function stormCardEntered(
  s: GameState,
  p: Piece,
  fromHand: boolean,
): Effect[] {
  if (p.code === "36019") p.counters = 3;
  if (p.code === "36015")
    return [
      E("optional", {
        title: "Mirage",
        image: p.code,
        text: "Stun an enemy with lower SCH than Mirage's THW?",
        effects: [S("mirage", { id: p.id })],
      }),
    ];
  if (p.code === "36017" && fromHand)
    return [
      E("optional", {
        title: "Pixie",
        image: p.code,
        text: "Return an X-Men ally from your discard pile?",
        effects: [S("pixie")],
      }),
    ];
  if (p.code === "36022")
    return [
      E("optional", {
        title: "Forge",
        image: p.code,
        text: "Search your deck and discard pile for an X-Men or X-Force support?",
        effects: [S("forge")],
      }),
    ];
  return [];
}
export function stormAllyAction(
  s: GameState,
  p: Piece,
  packet: Effect,
  ports: StormPorts,
): Effect[] {
  const attack = !!packet.attack;
  const result: Effect[] = [];
  if (attack && p.code === "36014" && !isTextBlank(s, p))
    result.push(S("havok", { id: p.id, packet }));
  else result.push(S("leadership-window", { id: p.id, packet }));
  return result;
}
export function stormHangar(s: GameState, ally: Piece): Effect[] {
  return playerOrder(s).flatMap((seat) =>
    seatView(s, seat)
      .player.inPlay.filter(
        (p) => p.code === "36035" && !p.exhausted && !isTextBlank(s, p),
      )
      .map((p) =>
        E("optional", {
          title: "Hangar Bay",
          image: p.code,
          text: `Ready ${c(ally).name}?`,
          effects: [
            S("hangar", { id: p.id, allyId: ally.id, actorId: seat.id }),
          ],
        }),
      ),
  );
}
export function stormPhaseEnded(s: GameState): Effect[] {
  return playerOrder(s).flatMap((seat) => {
    const v = seatView(s, seat),
      result: Effect[] = [];
    for (const key of Object.keys(v.flags))
      if (key.startsWith("stormReturn:") && v.flags[key] === phase(s)) {
        result.push(S("return-ally", { id: key.slice(12), actorId: seat.id }));
        delete v.flags[key];
      }
    return result;
  });
}
export function stormLeftPlay(s: GameState, p: Piece) {
  for (const seat of s.players) {
    const f = seatView(s, seat).flags;
    delete f[`stormReturn:${p.id}`];
    delete f[`stormBlank:${p.id}`];
    delete f[`stormFreeze:${p.id}`];
    delete f[`stormController:${p.id}`];
  }
}
export function stormEncounterReveal(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      "36030",
      "36031",
      "36032",
      "36033",
      "36034",
      "36036",
      "36037",
      "36038",
      "36039",
    ].includes(p.code)
  )
    return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "36030") {
    const seat = playerOrder(s).find((seat) => seat.heroId === "storm");
    return seat ? [S("obligation", { piece: p, actorId: seat.id })] : [];
  }
  if (p.code === "36033") return [S("switchblade", { piece: p })];
  if (p.code === "36034") return [S("knife", { piece: p })];
  if (p.code === "36036") return [S("find-possessed")];
  if (p.code === "36038") return [S("possessed", { piece: p })];
  if (p.code === "36039") return [S("astral")];
  return [];
}
export function stormBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      "36030",
      "36031",
      "36032",
      "36033",
      "36034",
      "36036",
      "36037",
      "36038",
      "36039",
    ].includes(p.code)
  )
    return null;
  if (
    p.code === "36037" &&
    s.minions.some(
      (m) => m.stormControlled && m.engagedWith === s.activePlayerId,
    )
  )
    return [S("reveal-boost", { piece: p })];
  if (p.code === "36039") return [S("recycle-shadow")];
  return [];
}
export function stormSideDefeated(_s: GameState, p: Piece): Effect[] {
  return p.code === "36032"
    ? [S("find-knife")]
    : p.code === "36037"
      ? [S("discard-possessed")]
      : [];
}
export function stormShadows(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  return [S("nemesis")];
}
function select(
  s: GameState,
  title: string,
  ts: AntManTarget[],
  effect: Effect,
  ports: StormPorts,
  after: Effect[] = [],
) {
  if (!ts.length) {
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    ts.map((t) =>
      O(t.id, t.label, [{ ...effect, target: t.id }, ...after], t.code),
    ),
  );
}
function specialAfter(s: GameState): Effect[] {
  return [S("cape-window")];
}
export function resolveStormEffect(
  s: GameState,
  e: Effect,
  ports: StormPorts,
): boolean {
  if (!e.type.startsWith("storm:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "storm:choose-weather": {
      if (e.limit)
        need(
          active(s) &&
            s.player.form === "hero" &&
            !ports.identityBlank(s) &&
            s.flags.stormWeatherRound !== s.round,
          "Weather Control is unavailable.",
        );
      const available = (s.player.setAside || []).filter((p) =>
        weatherCode(p.code),
      );
      ports.choose(
        s,
        e.setup ? "Choose starting weather" : "Weather Control",
        e.setup
          ? "Put a Weather support into play. Its Special does not resolve during setup."
          : "Swap your Weather support, then resolve its Special.",
        available.map((p) =>
          O(
            p.id,
            c(p).name,
            [S("swap", { id: p.id, setup: !!e.setup, limit: !!e.limit })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "storm:swap": {
      const reserve = s.player.setAside || [],
        p = reserve.find((p) => p.id === e.id && weatherCode(p.code));
      need(p, "Choose a physical Weather support from the Weather deck.");
      if (e.limit) {
        need(
          s.flags.stormWeatherRound !== s.round,
          "Weather Control is once per round.",
        );
        s.flags.stormWeatherRound = s.round;
      }
      reserve.splice(reserve.indexOf(p!), 1);
      const old = stormWeather(s);
      if (old) {
        s.player.inPlay.splice(s.player.inPlay.indexOf(old), 1);
        reserve.push(old);
      }
      s.player.inPlay.push(p!);
      if (!e.setup) ports.queue(s, S("special", { id: p!.id }));
      else s.flags.stormSetupComplete = true;
      break;
    }
    case "storm:goddess":
      ports.queue(s, S("choose-weather"));
      break;
    case "storm:special": {
      const p = stormWeather(s);
      if (!p || p.id !== e.id || isTextBlank(s, p)) break;
      const tail = specialAfter(s);
      if (p.code === "36002") ports.queue(s, E("draw", { amount: 1 }), ...tail);
      if (p.code === "36003")
        select(
          s,
          "Hurricane",
          ports.schemeTargets(s, false),
          E("thwart", { amount: 2, action: false }),
          ports,
          tail,
        );
      if (p.code === "36004")
        select(
          s,
          "Thunderstorm",
          ports.enemyTargets(s, false),
          E("damage", { amount: 2, source: p.id }),
          ports,
          tail,
        );
      if (p.code === "36005")
        select(
          s,
          "Blizzard",
          s.minions
            .filter((m) => !trait(m, "Elite"))
            .map((m) => ({
              id: m.id,
              label: c(m)?.name || "Minion",
              code: m.code,
            })),
          S("blank"),
          ports,
          tail,
        );
      break;
    }
    case "storm:blank": {
      const p = s.minions.find((p) => p.id === e.target && !trait(p, "Elite"));
      if (p) s.flags[`stormBlank:${p.id}`] = s.round;
      break;
    }
    case "storm:cape-window": {
      const p = s.player.inPlay.find(
        (p) => p.code === "36007" && !p.exhausted && !isTextBlank(s, p),
      );
      if (
        p &&
        s.player.form === "hero" &&
        s.player.exhausted &&
        ports.canReady(s, "hero")
      )
        ports.queue(
          s,
          E("optional", {
            title: "Storm's Cape",
            image: p.code,
            text: "Exhaust Storm's Cape to ready Storm?",
            effects: [S("cape", { id: p.id })],
          }),
        );
      break;
    }
    case "storm:cape": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && !isTextBlank(s, p) && s.player.form === "hero",
        "Storm's Cape is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    }
    case "storm:garden": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.form === "alter" && !isTextBlank(s, p),
        "Ororo's Garden is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(s, E("heal", { target: "hero", amount: 2 }));
      break;
    }
    case "storm:rain": {
      ports.queue(
        s,
        S("rain-divide", {
          remaining: 3,
          total: 3,
          packets: [],
          legal: ports.schemeTargets(s, true),
        }),
      );
      break;
    }
    case "storm:rain-divide": {
      const packets: { target: string; amount: number }[] = e.packets || [],
        ts: AntManTarget[] = (e.legal || []).filter(
          (t: AntManTarget) => !packets.some((p) => p.target === t.id),
        );
      if (!ts.length) {
        ports.queue(s, S("rain-finish", { packets }));
        break;
      }
      ports.choose(
        s,
        "Torrential Rain",
        `Divide ${e.remaining} remaining threat removal among schemes.`,
        ts.flatMap((t) =>
          Array.from({ length: e.remaining }, (_, i) => {
            const amount = i + 1,
              next = [...packets, { target: t.id, amount }];
            return O(
              `${t.id}:${amount}`,
              `${t.label} · ${amount} threat`,
              [
                amount === e.remaining
                  ? S("rain-finish", { packets: next })
                  : { ...e, packets: next, remaining: e.remaining - amount },
              ],
              t.code,
            );
          }),
        ),
      );
      break;
    }
    case "storm:rain-finish":
      ports.thwartDistribution(s, e.packets, [
        S("matching-special", { code: "36003" }),
      ]);
      break;
    case "storm:lightning":
      select(
        s,
        "Lightning Bolt",
        ports.enemyTargets(s, true),
        S("lightning-hit"),
        ports,
      );
      break;
    case "storm:lightning-hit":
      ports.attackProgram(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 8,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
        ],
        [S("matching-special", { code: "36004" })],
      );
      break;
    case "storm:matching-special": {
      const p = stormWeather(s);
      if (p && p.code === e.code) ports.queue(s, S("special", { id: p.id }));
      break;
    }
    case "storm:wind":
      ports.choose(
        s,
        "Blast of Wind",
        "Choose a player.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.heroId, [S("wind-hit", { playerId: seat.id })]),
        ),
      );
      break;
    case "storm:wind-hit": {
      const w = stormWeather(s);
      ports.queue(s, ...(w ? [S("special", { id: w.id })] : []));
      ports.damageBatch(
        s,
        [
          s.villain.id,
          ...s.minions
            .filter((p) => (p.engagedWith || s.activePlayerId) === e.playerId)
            .map((p) => p.id),
        ],
        3,
        "hero",
      );
      break;
    }
    case "storm:play-freeze": {
      const p = defenseEventSources(s).find((p) => p.id === e.id);
      need(
        p && stormDefenseOptions(s, after, ports).some((o) => o.id === p.id),
        "Flash Freeze is unavailable.",
      );
      ports.playDefense(s, p!, after);
      break;
    }
    case "storm:freeze": {
      need(s.attack?.isVillain, "Flash Freeze requires a villain attack.");
      if (s.flags.stormFreezePhase !== phase(s))
        for (const key of Object.keys(s.flags))
          if (key.startsWith("stormFreeze:")) delete s.flags[key];
      s.flags.stormFreezePhase = phase(s);
      for (const id of [
        s.villain.id,
        ...s.minions
          .filter(
            (p) => (p.engagedWith || s.activePlayerId) === s.activePlayerId,
          )
          .map((p) => p.id),
      ])
        s.flags[`stormFreeze:${id}`] =
          Number(s.flags[`stormFreeze:${id}`] || 0) + 1;
      if (
        !s.attack!.defender ||
        ["none", "hero"].includes(s.attack!.defender!)
      ) {
        s.attack!.defender = "hero";
        s.attack!.targetPlayerId = s.activePlayerId;
        s.attack!.eventDefense = true;
      }
      ports.queue(s, S("matching-special", { code: "36005" }));
      break;
    }
    case "storm:mirage": {
      const p = own(s, e.id);
      if (!p || isTextBlank(s, p)) break;
      select(
        s,
        "Mirage",
        ports.enemyTargets(s, false).filter((t) => {
          const enemy = [s.villain, ...s.minions].find((p) => p.id === t.id);
          return (
            enemy &&
            ports.enemyStats(s, enemy).scheme <
              ports.allyStat(s, p, "thwart") &&
            ports.canStatus(s, t.id, "stunned")
          );
        }),
        E("status", { status: "stunned" }),
        ports,
      );
      break;
    }
    case "storm:pixie":
      select(
        s,
        "Pixie",
        s.player.discard
          .filter((p) => c(p)?.type_code === "ally" && trait(p, "X-Men"))
          .map((p) => ({ id: p.id, label: c(p).name, code: p.code })),
        S("return-discard"),
        ports,
      );
      break;
    case "storm:return-discard": {
      const i = s.player.discard.findIndex((p) => p.id === e.target);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "storm:forge": {
      const ts = [...s.player.deck, ...s.player.discard]
        .filter(
          (p) =>
            c(p)?.type_code === "support" &&
            (trait(p, "X-Men") || trait(p, "X-Force")),
        )
        .map((p) => ({ id: p.id, label: c(p).name, code: p.code }));
      ports.choose(
        s,
        "Forge",
        "Search your deck and discard pile, then shuffle.",
        [
          ...ts.map((t) =>
            O(t.id, t.label, [S("forge-take", { id: t.id })], t.code),
          ),
          O("none", "Finish search", [S("forge-take")]),
        ],
      );
      break;
    }
    case "storm:forge-take": {
      for (const zone of [s.player.deck, s.player.discard]) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i >= 0) s.player.hand.push(zone.splice(i, 1)[0]);
      }
      ports.shufflePlayer(s, []);
      break;
    }
    case "storm:to-me": {
      const ts = s.player.deck
        .slice(0, 5)
        .filter((p) => c(p)?.type_code === "ally" && trait(p, "X-Men"));
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
      ports.choose(
        s,
        '"To Me, My X-Men!"',
        "Search the top 5 cards for an X-Men ally.",
        [
          ...ts.map((p) =>
            O(p.id, c(p).name, [S("to-me-put", { id: p.id })], p.code),
          ),
          O("none", "Finish search", [S("to-me-shuffle")]),
        ],
      );
      break;
    }
    case "storm:to-me-put": {
      need(
        s.player.deck.slice(0, 5).some((p) => p.id === e.id),
        "Choose an ally among the searched top five.",
      );
      ports.putAlly(s, e.id, [
        S("to-me-record", { id: e.id }),
        S("to-me-shuffle"),
      ]);
      break;
    }
    case "storm:to-me-shuffle":
      ports.shufflePlayer(s, []);
      break;
    case "storm:to-me-record":
      if (allInPlay(s).some((p) => p.id === e.id))
        s.flags[`stormReturn:${e.id}`] = phase(s);
      break;
    case "storm:return-ally":
      ports.returnAlly(s, e.id);
      break;
    case "storm:mansion": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && !isTextBlank(s, p),
        "X-Mansion is unavailable.",
      );
      select(
        s,
        "X-Mansion",
        ports
          .friendlyTargets(s)
          .filter(
            (t) =>
              ports.hasTrait(s, t.id, "Mutant") ||
              ports.hasTrait(s, t.id, "X-Men"),
          ),
        S("mansion-heal", { id: p!.id }),
        ports,
      );
      break;
    }
    case "storm:mansion-heal": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "X-Mansion is exhausted.");
      p!.exhausted = true;
      ports.queue(s, E("heal", { target: e.target, amount: 1 }));
      break;
    }
    case "storm:havok": {
      const discarded = ports.discardEncounterTop(s),
        bonus = discarded ? Number(c(discarded)?.boost || 0) : 0;
      ports.queue(
        s,
        S("leadership-window", {
          id: e.id,
          packet: {
            ...e.packet,
            stormHavok: bonus,
            stormBonus: Number(e.packet.stormBonus || 0) + bonus,
          },
        }),
      );
      break;
    }
    case "storm:leadership-window": {
      const used: string[] = e.used || [],
        p = allInPlay(s).find((p) => p.id === e.id);
      if (!p) {
        ports.queue(s, e.packet);
        break;
      }
      const choices = allInPlay(s).filter(
        (a) =>
          a.code === "36019" &&
          a.counters > 0 &&
          !isTextBlank(s, a) &&
          !used.includes(a.id),
      );
      const packet = { ...e.packet, stormAllyHandled: true };
      if (!choices.length) {
        ports.queue(s, packet);
        break;
      }
      ports.choose(
        s,
        "Leadership Skill",
        "Spend a leadership counter to add +1 ATK and +1 THW for this action?",
        [
          ...choices.map((a) =>
            O(
              a.id,
              "Leadership Skill · spend 1 counter",
              [
                S("leadership", {
                  id: a.id,
                  window: {
                    ...e,
                    used: [...used, a.id],
                    packet: {
                      ...packet,
                      stormBonus: Number(packet.stormBonus || 0) + 1,
                    },
                  },
                }),
              ],
              a.code,
            ),
          ),
          O("continue", "Continue", [packet]),
        ],
      );
      break;
    }
    case "storm:leadership": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      need(
        p && p.counters > 0 && !isTextBlank(s, p),
        "Leadership Skill is unavailable.",
      );
      p!.counters--;
      if (!p!.counters) ports.discard(s, p!.id);
      ports.queue(s, e.window);
      break;
    }
    case "storm:hangar": {
      const p = own(s, e.id),
        ally = ports.alliedPieces(s).find((a) => a.id === e.allyId);
      if (p && !p.exhausted && !isTextBlank(s, p) && ally && ally.exhausted) {
        p.exhausted = true;
        ports.queue(s, E("ready", { target: ally.id }));
      }
      break;
    }
    case "storm:obligation": {
      ports.flipAlter(s);
      const p = e.piece as Piece;
      ports.remove(s, p);
      p.ownerId = s.activePlayerId;
      s.player.inPlay.push(p);
      break;
    }
    case "storm:remove-obligation": {
      const p = own(s, e.id);
      need(
        p && s.player.form === "alter" && !s.player.exhausted,
        "Exhaust Ororo to remove Claustrophobia.",
      );
      s.player.exhausted = true;
      ports.remove(s, p!);
      s.removed.push(p!);
      break;
    }
    case "storm:nemesis": {
      const zone = s.player.setAside || [],
        cards = zone.filter((p) =>
          ["36031", "36032", "36033", "36034"].includes(p.code),
        );
      for (const p of cards) zone.splice(zone.indexOf(p), 1);
      const shown = cards.filter((p) => ["36031", "36032"].includes(p.code));
      s.encounter.deck.push(
        ...cards.filter((p) => !["36031", "36032"].includes(p.code)),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...shown.map((p) => E("reveal", { piece: p })),
        ...(!shown.some((p) => p.code === "36031")
          ? [E("surge", { sourceCode: "01190" })]
          : []),
      );
      break;
    }
    case "storm:switchblade": {
      const high = Math.max(...s.minions.map((p) => Number(c(p)?.attack || 0))),
        ts = s.minions
          .filter((p) => Number(c(p)?.attack || 0) === high)
          .map((p) => ({
            id: p.id,
            label: c(p)?.name || "Minion",
            code: p.code,
          }));
      if (!ts.length) ports.queue(s, E("surge", { sourceCode: "36033" }));
      else select(s, "Switchblade", ts, S("attach", { piece: e.piece }), ports);
      break;
    }
    case "storm:attach":
      ports.attach(s, e.piece, e.target);
      break;
    case "storm:knife": {
      ports.queue(s, S("knife-choose"));
      break;
    }
    case "storm:knife-choose": {
      if (s.player.form === "alter") {
        ports.queue(s, E("surge", { sourceCode: "36034" }));
        break;
      }
      const all = [s.villain, ...s.minions],
        high = Math.max(...all.map((p) => ports.enemyStats(s, p).attack));
      select(
        s,
        "Knife Fight",
        all
          .filter((p) => ports.enemyStats(s, p).attack === high)
          .map((p) => ({
            id: p.id,
            label: c(p)?.name || "Enemy",
            code: p.code,
          })),
        S("knife-damage"),
        ports,
      );
      break;
    }
    case "storm:knife-damage": {
      const p = [s.villain, ...s.minions].find((p) => p.id === e.target);
      if (p)
        ports.queue(
          s,
          E("damage", {
            target: `hero:${s.activePlayerId}`,
            amount: ports.enemyStats(s, p).attack,
            source: p.id,
          }),
          E("damage", {
            target: p.id,
            amount: ports.heroAttack(s),
            source: "hero",
          }),
        );
      break;
    }
    case "storm:find-knife":
      ports.searchEncounter(s, ["36034"], true, []);
      break;
    case "storm:find-possessed":
      ports.searchEncounter(s, ["36038"], false, []);
      break;
    case "storm:possessed": {
      const allies = ports
        .alliedPieces(s)
        .filter(
          (p) =>
            !s.attachments.some(
              (a) => a.code === "36038" && a.attachedTo === p.id,
            ),
        );
      const low = Math.min(
          ...allies.map((p) => ports.allyStat(s, p, "thwart")),
        ),
        ts = allies
          .filter((p) => ports.allyStat(s, p, "thwart") === low)
          .map((p) => ({ id: p.id, label: c(p).name, code: p.code }));
      if (!ts.length) {
        ports.discard(s, e.piece.id);
        ports.queue(s, E("surge", { sourceCode: "36038" }));
      } else
        select(s, "Possessed", ts, S("possess", { piece: e.piece }), ports);
      break;
    }
    case "storm:possess":
      ports.attach(s, e.piece, e.target);
      break;
    case "storm:discard-possessed":
      select(
        s,
        "Ruler of the Astral Plane",
        s.attachments
          .filter((p) => p.code === "36038")
          .map((p) => ({ id: p.id, label: c(p).name, code: p.code })),
        S("discard-target"),
        ports,
      );
      break;
    case "storm:discard-target":
      ports.discard(s, e.target);
      break;
    case "storm:astral": {
      const minions = s.minions.filter((p) => p.stormControlled);
      if (!minions.length) ports.queue(s, E("surge", { sourceCode: "36039" }));
      else
        ports.queue(
          s,
          S("activate-controlled", { ids: minions.map((p) => p.id) }),
        );
      break;
    }
    case "storm:activate-controlled": {
      const ids: string[] = e.ids || [];
      if (ids.length)
        ports.activate(s, ids[0], [
          S("activate-controlled", { ids: ids.slice(1) }),
        ]);
      break;
    }
    case "storm:reveal-boost":
      ports.reveal(s, e.piece);
      break;
    case "storm:recycle-shadow": {
      const pieces = s.encounter.discard.filter(
        (p) => c(p)?.set_code === "shadow_king",
      );
      for (const p of pieces)
        s.encounter.discard.splice(s.encounter.discard.indexOf(p), 1);
      s.encounter.deck.push(...pieces);
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Storm effect: ${e.type}`);
  }
  return true;
}
