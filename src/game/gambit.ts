import { card, CATALOG_CARDS } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const G = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`gambit:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, text: string) => {
  if (!ok) throw Error(text);
};
const identitySets = new Set(
  CATALOG_CARDS.filter((c) => c.type_code === "hero").map((c) => c.set_code),
);
const active = (s: GameState) => s.heroId === "gambit";
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const find = (s: GameState, id: string) =>
  [...allInPlay(s), ...s.minions, ...s.attachments, ...s.sideSchemes].find(
    (p) => p.id === id,
  );
const trait = (p: Piece, name: string) =>
  !!card(p).traits?.split(/\.\s*/).includes(name);
export const GAMBIT_SCRIPT_CODES = [
  "37001a",
  "37001b",
  ...Array.from({ length: 34 }, (_, i) => String(37002 + i)),
].filter((c) => !["37022", "37023", "37024"].includes(c));
export interface GambitPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  enemies(s: GameState, attack: boolean): AntManTarget[];
  schemes(s: GameState, thwart: boolean): AntManTarget[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  canReady(s: GameState): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    after: Effect[],
    requirements?: Resource[],
    commit?: Effect[],
  ): void;
  canPay(s: GameState, p: Piece): boolean;
  reaction(s: GameState, p: Piece, effects: Effect[], after: Effect[]): void;
  reactionEvents(s: GameState): Piece[];
  attack(s: GameState, effects: Effect[], after: Effect[]): void;
  makePiece(s: GameState, code: string): Piece;
  discard(s: GameState, id: string): void;
  shufflePlayer(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  hidden(s: GameState): void;
  attach(s: GameState, p: Piece, id: string): void;
  keepObligation(s: GameState, p: Piece): void;
  removeObligation(s: GameState, p: Piece): void;
}
export const gambitCharges = (s: GameState) =>
  Number(s.flags.gambitCharges || 0);
const identityActive = (s: GameState) =>
  active(s) &&
  !isTextBlank(s, {
    code: s.player.form === "hero" ? "37001a" : "37001b",
    id: `hero:${s.activePlayerId}`,
  });
export function gambitInitialize(s: GameState, make: GambitPorts["makePiece"]) {
  if (!active(s)) return;
  s.flags.gambitCharges = 0;
  for (const code of ["37026", "37027", "37028", "37028", "37029"]) {
    const p = make(s, code);
    p.ownerId = s.activePlayerId;
    (s.player.setAside ||= []).push(p);
  }
}
export function gambitAbilityOptions(
  s: GameState,
  id: string,
  ports: GambitPorts,
): Option[] {
  if (id === "identity" && identityActive(s)) {
    if (s.player.form === "hero" && s.flags.gambitChargeRound !== s.round)
      return [
        O(
          "charge-de-card",
          `Charge de Card · ${gambitCharges(s)} charge counters`,
          [G("charge")],
          "37001a",
        ),
      ];
    if (
      s.player.form === "alter" &&
      !s.player.exhausted &&
      s.encounter.deck.length &&
      (s.player.confused || ports.schemes(s, true).length)
    )
      return [
        O(
          "thief-extraordinaire",
          "Thief Extraordinaire · look at 2 encounter cards",
          [G("thief")],
          "37001b",
        ),
      ];
  }
  const p = find(s, id);
  if (
    p?.code === "37025" &&
    active(s) &&
    s.player.form === "alter" &&
    !s.player.exhausted
  )
    return [
      O(
        "guild-business",
        "Guild Business · exhaust and spend energy",
        [G("obligation-pay", { id })],
        p.code,
      ),
    ];
  return [];
}
export function gambitAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: GambitPorts,
): Effect[] | null {
  const options = gambitAbilityOptions(s, id, ports);
  if (!(id === "identity" && active(s)) && find(s, id)?.code !== "37025")
    return null;
  const selected =
    options.find((o) => o.id === action) ||
    (!action && options.length === 1 ? options[0] : undefined);
  need(selected, "This Gambit ability is unavailable.");
  return selected!.effects;
}
export function gambitBeforeEvent(
  s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  if (
    !identityActive(s) ||
    s.player.form !== "hero" ||
    !card(p).traits?.includes("Attack.") ||
    gambitCharges(s) < 1
  )
    return null;
  return [G("throw", { id: p.id, after })];
}
/** Reaction events use the same paid event interrupt as proactive events. */
export function gambitBeforeReaction(s: GameState, p: Piece, after: Effect[]) {
  return gambitBeforeEvent(s, p, after) || after;
}
export const gambitDamageBonus = (s: GameState) =>
  Number(s.flags[`gambitEvent:${s.currentEventId}`] || 0);
export function gambitEventFinished(s: GameState, id: string) {
  for (const seat of s.players)
    delete seatView(s, seat).flags[`gambitEvent:${id}`];
}
export function gambitPayment(s: GameState, p: Piece): Effect[] {
  return p.code === "37010" && active(s) && s.player.form === "hero"
    ? [G("resource-charge")]
    : [];
}
export const gambitDiscount = (s: GameState, c: Card) =>
  c.code === "37002" ? gambitCharges(s) : 0;
export function gambitPlayRestriction(
  s: GameState,
  p: Piece,
  ports: GambitPorts,
): string | undefined {
  if (p.code === "37008")
    return "Natural Agility requires an actual defense interrupt.";
  if (
    ["37006", "37007", "37014", "37019", "38020", "37020"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "Hero form required.";
  if (["37009", "37021", "37031"].includes(p.code) && s.player.form !== "alter")
    return "Alter-ego form required.";
  if (
    p.code === "37015" &&
    !["Spy", "Thief"].some((t) => ports.hasTrait(s, "hero", t))
  )
    return "A Spy or Thief identity is required.";
  if (
    ["37021", "37031"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Mutant")
  )
    return "A Mutant identity is required.";
  if (["37013", "37030"].includes(p.code) && live(s, p.code).length)
    return "Max 1 per player.";
  if (["37019", "38020"].includes(p.code)) {
    const names = playerOrder(s)
      .filter((seat) => seatView(s, seat).player.form === "hero")
      .map((seat) => seat.heroId);
    names.push(
      ...allInPlay(s)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => card(p).name.toLowerCase()),
    );
    if (
      !["gambit", "rogue"].includes(s.heroId) ||
      !names.includes("gambit") ||
      !names.includes("rogue")
    )
      return "Beauty and the Thief requires your Gambit or Rogue identity and both characters in play.";
  }
}
export function gambitEvent(_s: GameState, p: Piece): Effect[] | null {
  return [
    "37006",
    "37007",
    "37009",
    "37014",
    "37015",
    "37019",
    "38020",
    "37020",
    "37021",
    "37031",
  ].includes(p.code)
    ? [G("event", { piece: p })]
    : null;
}
export function gambitEntered(_s: GameState, p: Piece): Effect[] {
  if (p.code === "37013") p.counters = 3;
  return p.code === "37012" ? [G("dazzler", { id: p.id })] : [];
}
export function gambitThwartWindow(s: GameState, e: Effect): Effect[] | null {
  if (
    e.gambitOperative ||
    !e.action ||
    s.player.confused ||
    (e.source && e.source !== "hero")
  )
    return null;
  const cards = live(s, "37013").filter((p) => p.counters > 0);
  return cards.length
    ? [G("operative", { packet: e, ids: cards.map((p) => p.id) })]
    : null;
}
export function gambitAttackOptions(s: GameState, after: Effect[]): Option[] {
  if (s.player.form !== "hero" || !s.attack) return [];
  return live(s, "37004")
    .filter((p) => !p.exhausted)
    .map((p) =>
      O(
        p.id,
        "Gambit's Staff · deal 1 damage",
        [G("staff", { id: p.id, target: s.attack!.attacker, after })],
        p.code,
      ),
    );
}
export function gambitDefenseOptions(
  s: GameState,
  ports: GambitPorts,
): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    !s.attack ||
    s.attack.defender !== "hero"
  )
    return [];
  return ports
    .reactionEvents(s)
    .filter((p) => p.code === "37008" && ports.canPay(s, p))
    .map((p) =>
      O(
        p.id,
        "Natural Agility · gain a charge and DEF",
        [G("agility-play", { id: p.id })],
        p.code,
      ),
    );
}
export function gambitDefenseAfter(s: GameState, e: Effect): Effect[] {
  const r = e.snapshot;
  if (!r) return [];
  const view = seatView(s, r.playerId || s.activePlayerId);
  return [
    G("after-attack", {
      actorId: view.activePlayerId,
      identityAttacked: true,
      defended: r.heroDefended,
      damage: r.heroDamage || 0,
    }),
  ];
}
export function gambitBeforeAlly(
  s: GameState,
  p: Piece,
  e: Effect,
): Effect[] | null {
  return p.code === "37011" &&
    e.kind === "attack" &&
    !e.gambitBishop &&
    !p.stunned &&
    p.counters &&
    !isTextBlank(s, p)
    ? [G("bishop", { id: p.id, packet: e })]
    : null;
}
export function gambitAllyBonus(s: GameState, p: Piece, kind: string) {
  return kind === "attack" ? Number(s.flags[`gambitBishop:${p.id}`] || 0) : 0;
}
export function gambitAfterAlly(
  s: GameState,
  p: Piece,
  target: string,
  attack: boolean,
): Effect[] {
  delete s.flags[`gambitBishop:${p.id}`];
  return attack
    ? [
        G("war-room", {
          target,
          owner: controller(s, p.id)?.id || s.activePlayerId,
        }),
      ]
    : [];
}
export function gambitEnemyAfter(
  s: GameState,
  code: string,
  target: string,
  enemyBlank: boolean,
): Effect[] {
  const defeated = target === "hero" ? s.player.hp <= 0 : !find(s, target);
  if (!defeated) return [];
  return [
    ...(!enemyBlank && ["37026", "37028"].includes(code)
      ? [E("threat", { target: "main", amount: code === "37026" ? 2 : 1 })]
      : []),
    ...(card(code)?.traits?.includes("Assassin.")
      ? s.sideSchemes
          .filter((p) => p.code === "37027" && !isTextBlank(s, p))
          .map((p) => E("threat", { target: p.id, amount: 2 }))
      : []),
  ];
}
export function gambitShield(
  s: GameState,
  p: Piece,
  ports: Pick<GambitPorts, "discard">,
): boolean {
  if (!s.minions.some((m) => m.id === p.id)) return false;
  const shield = s.attachments.find(
    (a) => a.code === "37034" && a.attachedTo === p.id && !isTextBlank(s, a),
  );
  if (!shield) return false;
  p.damage = 0;
  delete p.pendingDefeat;
  // The defeat interrupts have resolved, but the minion remains in play.
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags[`cyclopsPriority:${p.id}`];
    delete flags[`mutantGenesisGatekeeperHandled:${p.id}`];
    delete flags[`acolytesDefeat:${p.id}`];
    delete flags[`magnetoDefeat:${p.id}`];
  }
  ports.discard(s, shield.id);
  return true;
}
export function gambitShadows(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  return [G("nemesis")];
}
export function gambitEncounter(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      "37025",
      "37026",
      "37027",
      "37028",
      "37029",
      "37032",
      "37033",
      "37034",
      "37035",
    ].includes(p.code)
  )
    return null;
  if (p.code === "37025") return [G("obligation", { piece: p })];
  if (p.code === "37029") return [G("assassination")];
  if (p.code === "37032")
    return [G("search-encounter", { code: "37034", attach: p.id })];
  if (p.code === "37034") return [G("shield", { piece: p })];
  if (p.code === "37035") {
    const ms = s.minions.filter(
      (m) =>
        (m.engagedWith || s.activePlayerId) === s.activePlayerId &&
        trait(m, "Acolyte"),
    );
    return ms.length
      ? ms.map((m) =>
          E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
            id: m.id,
          }),
        )
      : [E("surge", { sourceCode: p.code })];
  }
  return [];
}
export function gambitBoost(_s: GameState, p: Piece): Effect[] | null {
  return GAMBIT_SCRIPT_CODES.includes(p.code) &&
    card(p).faction_code === "encounter"
    ? p.code === "37035"
      ? [
          E("status", { target: "hero", status: "stunned" }),
          E("status", { target: "hero", status: "confused" }),
        ]
      : []
    : null;
}
export const gambitSchemeDefeated = (_s: GameState, p: Piece): Effect[] =>
  p.code === "37033" ? [G("search-encounter", { code: "37032" })] : [];
function pick(
  s: GameState,
  ports: GambitPorts,
  title: string,
  targets: AntManTarget[],
  effect: (id: string) => Effect[],
) {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) => O(t.id, t.label, effect(t.id), t.code)),
    );
}
export function resolveGambitEffect(
  s: GameState,
  e: Effect,
  ports: GambitPorts,
): boolean {
  if (!e.type.startsWith("gambit:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "gambit:charge":
      need(
        gambitAbilityOptions(s, "identity", ports).some(
          (o) => o.id === "charge-de-card",
        ),
        "Charge de Card is unavailable.",
      );
      s.flags.gambitChargeRound = s.round;
      s.flags.gambitCharges = gambitCharges(s) + 1;
      break;
    case "gambit:resource-charge":
      s.flags.gambitCharges = gambitCharges(s) + 1;
      break;
    case "gambit:throw":
      ports.choose(
        s,
        "Throw de Card",
        "Remove up to 3 charge counters for this Attack event.",
        Array.from({ length: Math.min(3, gambitCharges(s)) + 1 }, (_, n) =>
          O(
            String(n),
            n ? `Remove ${n} charge counters` : "Keep charge counters",
            [G("throw-spend", { id: e.id, n, after })],
            "37001a",
          ),
        ),
      );
      break;
    case "gambit:throw-spend":
      need(e.n <= gambitCharges(s), "Not enough charge counters.");
      s.flags.gambitCharges = gambitCharges(s) - e.n;
      s.flags[`gambitEvent:${e.id}`] = e.n;
      ports.queue(s, ...after);
      break;
    case "gambit:thief": {
      need(
        gambitAbilityOptions(s, "identity", ports).some(
          (o) => o.id === "thief-extraordinaire",
        ),
        "Thief Extraordinaire is unavailable.",
      );
      s.player.exhausted = true;
      ports.hidden(s);
      ports.choose(
        s,
        "Thief Extraordinaire",
        "Discard one of these top encounter cards; leave the other on top.",
        s.encounter.deck
          .slice(0, 2)
          .map((p) =>
            O(
              p.id,
              `${card(p).name} · ${card(p).boost || 0} boost icons`,
              [G("thief-discard", { id: p.id })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "gambit:thief-discard": {
      const i = s.encounter.deck.findIndex((p) => p.id === e.id);
      need(i >= 0 && i < 2, "The looked-at card moved.");
      const p = s.encounter.deck.splice(i, 1)[0];
      s.encounter.discard.push(p);
      const schemes = ports.schemes(s, true);
      if (!schemes.length && s.player.confused) {
        ports.queue(
          s,
          E("thwart", {
            target: "main",
            amount: card(p).boost || 0,
            action: true,
          }),
        );
        break;
      }
      pick(s, ports, "Thief Extraordinaire", schemes, (target) => [
        E("thwart", { target, amount: card(p).boost || 0, action: true }),
        ...(s.player.confused ? [] : [G("guild-window")]),
      ]);
      break;
    }
    case "gambit:guild-window": {
      const p = live(s, "37003").find((p) => !p.exhausted);
      if (p && s.player.form === "alter" && ports.schemes(s, false).length)
        ports.choose(s, "The Thieves Guild", "Use its response?", [
          O(
            "yes",
            "Exhaust The Thieves Guild",
            [G("guild", { id: p.id })],
            p.code,
          ),
          O("pass", "Continue", []),
        ]);
      break;
    }
    case "gambit:guild": {
      const p = find(s, e.id);
      if (!p || p.exhausted) break;
      p.exhausted = true;
      pick(s, ports, "The Thieves Guild", ports.schemes(s, false), (target) => [
        G("clear", { target, amount: 1, reward: "draw", action: false }),
      ]);
      break;
    }
    case "gambit:clear": {
      const before =
        e.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((p) => p.id === e.target)?.counters || 0;
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: e.amount, action: e.action }),
        G("clear-after", { target: e.target, before, reward: e.reward }),
      );
      break;
    }
    case "gambit:clear-after": {
      const now =
        e.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((p) => p.id === e.target)?.counters || 0;
      if (e.before > 0 && now === 0)
        ports.queue(
          s,
          e.reward === "draw"
            ? E("draw", { amount: 1 })
            : E("status", { target: s.villain.id, status: "confused" }),
        );
      break;
    }
    case "gambit:event": {
      const p: Piece = e.piece;
      if (p.code === "37007") {
        s.flags.gambitCharges = gambitCharges(s) + 1;
        ports.attack(
          s,
          [G("shot", { id: p.id, code: p.code, amount: 0, remaining: 3 })],
          [],
        );
      } else if (["37006", "37014", "37019", "38020", "37020"].includes(p.code))
        ports.queue(
          s,
          G("shot", {
            id: p.id,
            code: p.code,
            amount: p.code === "37020" ? 2 : 4,
            remaining: 1,
          }),
        );
      else if (p.code === "37009")
        pick(s, ports, card(p).name, ports.schemes(s, true), (target) => [
          G("clear", { target, amount: 3, reward: "confuse", action: true }),
        ]);
      else if (p.code === "37015")
        pick(s, ports, card(p).name, ports.schemes(s, true), (target) => [
          E("thwart", { target, amount: 3, action: true }),
        ]);
      else ports.queue(s, G("educate", { kind: p.code, selected: [] }));
      break;
    }
    case "gambit:shot":
      pick(s, ports, card(e.code).name, ports.enemies(s, true), (target) => [
        G("hit", { ...e, type: "gambit:hit", target }),
      ]);
      break;
    case "gambit:hit": {
      const n = Number(s.flags[`gambitEvent:${e.id}`] || 0);
      const damage = E("damage", {
        target: e.target,
        amount: e.amount,
        attack: true,
        source: "hero",
        ranged: e.code === "37006" && n >= 1,
        piercing: e.code === "37006" && n >= 2,
        overkill: e.code === "37006" && n >= 3,
      });
      const after = G("shot-after", { ...e, type: "gambit:shot-after" });
      // Royal Flush is one attack with three sequential damage instances.
      if (e.code === "37007") ports.queue(s, damage, after);
      else ports.attack(s, [damage], [after]);
      break;
    }
    case "gambit:shot-after":
      if (e.remaining > 1)
        ports.queue(
          s,
          G("shot", { ...e, type: "gambit:shot", remaining: e.remaining - 1 }),
        );
      else if (
        ["37019", "38020", "37020"].includes(e.code) ||
        (e.code === "37014" && !find(s, e.target))
      )
        pick(
          s,
          ports,
          card(e.code).name,
          ports.schemes(s, ["37019", "38020", "37020"].includes(e.code)),
          (target) => [
            E("thwart", {
              target,
              amount: e.code === "37014" || e.code === "37020" ? 2 : 4,
              action: e.code !== "37014",
            }),
          ],
        );
      break;
    case "gambit:educate": {
      const chosen: string[] = e.selected;
      const candidates = s.player.discard.filter(
        (p) =>
          !chosen.includes(p.id) &&
          (e.kind === "37031"
            ? card(p).type_code === "ally" && trait(p, "X-Men")
            : identitySets.has(card(p).set_code) &&
              card(p).faction_code !== "encounter"),
      );
      if (chosen.length === 2 || !candidates.length) {
        ports.queue(s, G("educated", { selected: chosen }));
        break;
      }
      ports.choose(
        s,
        card(e.kind).name,
        "Choose up to two cards to shuffle into your deck.",
        [
          ...candidates.map((p) =>
            O(
              p.id,
              card(p).name,
              [G("educate", { kind: e.kind, selected: [...chosen, p.id] })],
              p.code,
            ),
          ),
          O("done", "Finish selection", [G("educated", { selected: chosen })]),
        ],
      );
      break;
    }
    case "gambit:educated":
      for (const id of e.selected) {
        const i = s.player.discard.findIndex((p) => p.id === id);
        if (i >= 0) s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      }
      ports.shufflePlayer(s);
      if (
        allInPlay(s).some((p) => ["32049", "36025", "37018"].includes(p.code))
      )
        ports.queue(s, E("draw", { amount: 1 }));
      break;
    case "gambit:operative":
      ports.choose(
        s,
        "Operative Skill",
        "Spend an operative counter to remove 1 additional threat?",
        [
          ...e.ids.map((id: string) =>
            O(
              id,
              "Spend 1 operative counter",
              [G("operative-use", { id, packet: e.packet })],
              "37013",
            ),
          ),
          O("continue", "Continue thwart", [
            { ...e.packet, gambitOperative: true },
          ]),
        ],
      );
      break;
    case "gambit:operative-use": {
      const p = find(s, e.id);
      need(p && p.counters > 0, "No operative counter.");
      p!.counters--;
      if (!p!.counters) ports.discard(s, p!.id);
      ports.queue(s, {
        ...e.packet,
        amount: e.packet.amount + 1,
        gambitOperative: true,
      });
      break;
    }
    case "gambit:dazzler": {
      const p = find(s, e.id);
      if (p)
        ports.choose(s, "Dazzler", "Confuse an enemy?", [
          ...ports
            .enemies(s, false)
            .map((t) =>
              O(
                t.id,
                t.label,
                [E("status", { target: t.id, status: "confused" })],
                t.code,
              ),
            ),
          O("pass", "Continue", []),
        ]);
      break;
    }
    case "gambit:staff": {
      const p = find(s, e.id);
      need(p && !p.exhausted, "Staff is exhausted.");
      p!.exhausted = true;
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 1, source: p!.id }),
        ...after,
      );
      break;
    }
    case "gambit:agility-play": {
      const p = ports.reactionEvents(s).find((p) => p.id === e.id);
      need(p, "Natural Agility unavailable.");
      ports.reaction(
        s,
        p!,
        [G("agility")],
        [E("spectrumDefenseWindow", { used: [] })],
      );
      break;
    }
    case "gambit:agility":
      s.flags.gambitCharges = gambitCharges(s) + 1;
      if (s.attack)
        s.attack.defenseBonus =
          Number(s.attack.defenseBonus || 0) + gambitCharges(s);
      break;
    case "gambit:after-attack": {
      const options: Option[] = [];
      if (e.identityAttacked)
        for (const p of live(s, "37011"))
          options.push(
            O(
              p.id,
              "Bishop · place 1 energy counter",
              [G("bishop-charge", { id: p.id })],
              p.code,
            ),
          );
      if (
        active(s) &&
        s.player.form === "hero" &&
        e.defended &&
        e.damage === 0 &&
        s.player.exhausted &&
        ports.canReady(s)
      )
        for (const p of live(s, "37005").filter((p) => !p.exhausted))
          options.push(
            O(
              p.id,
              "Guild Armor · ready Gambit",
              [G("armor", { id: p.id })],
              p.code,
            ),
          );
      if (options.length)
        ports.choose(s, "After the enemy attack", "Choose a response.", [
          ...options
            .map((o) => ({
              ...o,
              effects: [
                ...o.effects,
                G("after-attack", {
                  ...e,
                  type: "gambit:after-attack",
                  used: [...(e.used || []), o.id],
                }),
              ],
            }))
            .filter((o) => !(e.used || []).includes(o.id)),
          O("pass", "Continue", []),
        ]);
      break;
    }
    case "gambit:bishop-charge": {
      const p = find(s, e.id);
      if (p) p.counters++;
      break;
    }
    case "gambit:armor": {
      const p = find(s, e.id);
      if (p && !p.exhausted) {
        p.exhausted = true;
        ports.queue(s, E("ready", { target: "hero" }));
      }
      break;
    }
    case "gambit:bishop":
      ports.choose(s, "Bishop", "Remove all energy counters for this attack?", [
        O("yes", "Spend energy counters", [
          G("bishop-spend", { id: e.id, packet: e.packet }),
        ]),
        O("continue", "Attack without spending", [
          { ...e.packet, gambitBishop: true },
        ]),
      ]);
      break;
    case "gambit:bishop-spend": {
      const p = find(s, e.id);
      if (p) {
        s.flags[`gambitBishop:${p.id}`] = Math.min(6, p.counters * 2);
        p.counters = 0;
      }
      ports.queue(s, {
        ...e.packet,
        ...(e.packet.amount !== undefined
          ? {
              amount:
                e.packet.amount + Number(s.flags[`gambitBishop:${e.id}`] || 0),
            }
          : {}),
        gambitBishop: true,
      });
      break;
    }
    case "gambit:war-room": {
      if (find(s, e.target)) break;
      const view = seatView(s, e.owner);
      const p = live(view, "37030").find((p) => !p.exhausted);
      if (p && ports.schemes(view, false).length)
        ports.choose(s, "War Room", "Exhaust War Room to remove 1 threat?", [
          O(
            "yes",
            "Use War Room",
            [G("war-room-use", { id: p.id, actorId: e.owner })],
            p.code,
          ),
          O("pass", "Continue", []),
        ]);
      break;
    }
    case "gambit:war-room-use": {
      const p = find(s, e.id);
      if (p && !p.exhausted) {
        p.exhausted = true;
        pick(s, ports, "War Room", ports.schemes(s, false), (target) => [
          E("thwart", { target, amount: 1 }),
        ]);
      }
      break;
    }
    case "gambit:obligation":
      ports.keepObligation(s, e.piece);
      break;
    case "gambit:obligation-pay":
      need(
        active(s) && s.player.form === "alter" && !s.player.exhausted,
        "Ready Remy LeBeau required.",
      );
      ports.pay(
        s,
        "Guild Business",
        1,
        [G("obligation-paid", { id: e.id })],
        ["energy"],
        [G("obligation-cost")],
      );
      break;
    case "gambit:obligation-cost":
      need(!s.player.exhausted, "Remy cannot exhaust.");
      s.player.exhausted = true;
      break;
    case "gambit:obligation-paid": {
      const p = find(s, e.id);
      need(p, "Guild Business is unavailable.");
      ports.removeObligation(s, p!);
      break;
    }
    case "gambit:nemesis": {
      const zone = s.player.setAside || [];
      const selected = zone.filter((p) =>
        ["37026", "37027", "37028", "37029"].includes(p.code),
      );
      s.player.setAside = zone.filter((p) => !selected.includes(p));
      s.encounter.deck.push(
        ...selected.filter((p) => ["37028", "37029"].includes(p.code)),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        ...selected
          .filter((p) => ["37026", "37027"].includes(p.code))
          .map((p) => E("reveal", { piece: p })),
      );
      break;
    }
    case "gambit:assassination": {
      const assassins = s.minions.filter((p) => trait(p, "Assassin"));
      if (assassins.length)
        ports.queue(s, ...assassins.map((p) => E("enemyAttack", { id: p.id })));
      else ports.queue(s, G("search-encounter", { trait: "Assassin" }));
      break;
    }
    case "gambit:search-encounter": {
      const choices = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) => (e.code ? p.code === e.code : trait(p, e.trait)),
      );
      ports.hidden(s);
      if (choices.length)
        ports.choose(
          s,
          "Search encounter cards",
          "Choose the physical card.",
          choices.map((p) =>
            O(
              p.id,
              card(p).name,
              [G("found", { id: p.id, attach: e.attach })],
              p.code,
            ),
          ),
        );
      else ports.shuffleEncounter(s);
      break;
    }
    case "gambit:found": {
      let p: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i >= 0) p = zone.splice(i, 1)[0];
      }
      ports.shuffleEncounter(s);
      if (p) {
        if (e.attach && s.minions.some((m) => m.id === e.attach))
          ports.attach(s, p, e.attach);
        else ports.queue(s, E("reveal", { piece: p }));
      }
      break;
    }
    case "gambit:shield":
      if (!s.minions.length)
        ports.queue(s, E("surge", { sourceCode: "37034" }));
      else
        pick(
          s,
          ports,
          "Psionic Shield",
          s.minions.map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
          })),
          (target) => [G("shield-attach", { piece: e.piece, target })],
        );
      break;
    case "gambit:shield-attach":
      ports.attach(s, e.piece, e.target);
      break;
  }
  return true;
}
