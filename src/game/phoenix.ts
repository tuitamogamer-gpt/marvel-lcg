import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const definitions = new Map((catalog as Card[]).map((c) => [c.code, c]));
const card = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)!;
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`phoenix:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const active = (s: GameState) => s.heroId === "phoenix";
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const normalized = (s: GameState, id: string) =>
  id === "hero" ? `hero:${s.activePlayerId}` : id;
const phase = (s: GameState) => `${s.round}:${s.phase}`;
export const PHOENIX_SCRIPT_CODES = [
  "34001a",
  "34001b",
  "34002a",
  "34002b",
  ...Array.from(
    { length: 33 },
    (_, i) => `340${String(i + 3).padStart(2, "0")}`,
  ),
].filter((code) => !["34025", "34026", "34027"].includes(code));
export const PHOENIX_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/jean-grey-phoenix/";
export const PHOENIX_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export interface PhoenixPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  makePiece(s: GameState, code: string): Piece;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  schemeTargets(s: GameState, thwart: boolean): AntManTarget[];
  characterTargets(s: GameState): AntManTarget[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  allyStat(s: GameState, p: Piece, kind: "attack" | "thwart"): number;
  heroThwart(s: GameState): number;
  canReady(s: GameState, id: string): boolean;
  discard(s: GameState, id: string): void;
  remove(s: GameState, id: string): void;
  shufflePlayer(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  canPay(s: GameState, p: Piece): boolean;
  playReaction(s: GameState, p: Piece, after: Effect[]): void;
  preventDamage(s: GameState, packet: Effect, amount: number): void;
  declareDefense(s: GameState): void;
  moveThreat(s: GameState, from: string, to: string, amount: number): void;
  printedHP(s: GameState): number;
  maxHP(s: GameState): number;
  revealHidden(s: GameState): void;
  lose(s: GameState, reason: string): void;
  reveal(s: GameState, p: Piece): void;
  removeEncounter(s: GameState, p: Piece): void;
  discardEncounter(s: GameState, p: Piece): void;
}
export const phoenixForce = (s: GameState) =>
  active(s)
    ? s.player.inPlay.find((p) => ["34002a", "34002b"].includes(p.code))
    : undefined;
export const phoenixUnleashed = (s: GameState) =>
  phoenixForce(s)?.code === "34002b";
export function phoenixChangeCounters(s: GameState, amount: number) {
  const force = phoenixForce(s);
  if (!force) return;
  const before = force.counters;
  force.counters = Math.max(0, force.counters + amount);
  if (!isTextBlank(s, force)) {
    if (force.code === "34002a" && before > 0 && force.counters === 0)
      force.code = "34002b";
    else if (force.code === "34002b" && amount > 0 && force.counters >= 4)
      force.code = "34002a";
  }
}
export function phoenixInitialize(
  s: GameState,
  ports: Pick<PhoenixPorts, "makePiece">,
) {
  if (!active(s)) return;
  if (!phoenixForce(s)) {
    const i = s.player.deck.findIndex((p) =>
      ["34002a", "34002b"].includes(p.code),
    );
    const p =
      i < 0 ? ports.makePiece(s, "34002a") : s.player.deck.splice(i, 1)[0];
    p.code = "34002a";
    p.counters = 4;
    p.ownerId = s.activePlayerId;
    s.player.inPlay.push(p);
  }
  if (!(s.player.setAside || []).some((p) => p.code === "34029"))
    for (const code of ["34029", "34030", "34031", "34031", "34031"]) {
      const p = ports.makePiece(s, code);
      p.ownerId = s.activePlayerId;
      (s.player.setAside ||= []).push(p);
    }
}
export function phoenixStats(s: GameState) {
  const force = phoenixForce(s);
  const unleashed =
    s.player.form === "hero" &&
    force?.code === "34002b" &&
    !isTextBlank(s, force);
  return { attack: unleashed ? 2 : 0, thwart: unleashed ? -2 : 0 };
}
export function phoenixTraits(s: GameState): string[] {
  const force = phoenixForce(s);
  return [
    ...(force && !isTextBlank(s, force)
      ? [force.code === "34002b" ? "Unleashed" : "Restrained"]
      : []),
    ...(active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "34005" && !isTextBlank(s, p))
      ? ["Aerial"]
      : []),
  ];
}
export function phoenixSuit(s: GameState) {
  const equipped =
    active(s) &&
    s.player.inPlay.some((p) => p.code === "34005" && !isTextBlank(s, p));
  return {
    steady: equipped && phoenixTraits(s).includes("Restrained"),
    retaliate: equipped && phoenixTraits(s).includes("Unleashed") ? 1 : 0,
  };
}
export function phoenixResourceSources(s: GameState): PaymentSource[] {
  return active(s) &&
    s.player.form === "hero" &&
    (phoenixForce(s)?.counters || 0) > 0 &&
    s.flags.phoenixBond !== phase(s) &&
    !isTextBlank(s, "34001a")
    ? [
        {
          id: "phoenix-bond",
          name: "Psionic Bond",
          code: "34001a",
          resources: ["wild"],
          kind: "ability",
          description:
            "Remove 1 power counter from Phoenix Force · once per phase",
        },
      ]
    : [];
}
export function phoenixResourceSpent(s: GameState, id: string) {
  if (id !== "phoenix-bond") return false;
  need(phoenixResourceSources(s).length, "Psionic Bond is unavailable.");
  s.flags.phoenixBond = phase(s);
  phoenixChangeCounters(s, -1);
  return true;
}
export function phoenixRecovered(s: GameState): Effect[] {
  return active(s) && s.player.form === "alter" && !isTextBlank(s, "34001b")
    ? [
        E("optional", {
          title: "Jean Grey",
          text: "Place 1 power counter on Phoenix Force?",
          effects: [P("counters", { amount: 1 })],
        }),
      ]
    : [];
}
export function phoenixFormChanged(s: GameState): Effect[] {
  return s.player.form === "alter"
    ? s.player.inPlay
        .filter((p) => p.code === "34008" && !isTextBlank(s, p))
        .map((p) => P("discard", { id: p.id }))
    : [];
}
export function phoenixCanActivate(s: GameState, id: string) {
  return !allInPlay(s).some(
    (p) => p.code === "34008" && p.attachedTo === id && !isTextBlank(s, p),
  );
}
const minions = (s: GameState) =>
  s.minions.filter((p) => !card(p).traits?.includes("Elite."));
export function phoenixAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: PhoenixPorts,
): AntManTarget[] | null {
  if (["34008", "34009"].includes(p.code))
    return minions(s).map((p) => ({
      id: p.id,
      label: card(p).name,
      code: p.code,
    }));
  if (p.code === "34007") return ports.characterTargets(s);
  if (p.code === "34016")
    return ports
      .characterTargets(s)
      .filter(
        (t) =>
          !t.id.startsWith("hero") &&
          ports.hasTrait(s, t.id, "X-Men") &&
          !allInPlay(s).some(
            (a) =>
              a.attachedTo === t.id && card(a).traits?.includes("Training."),
          ),
      );
  return null;
}
const team = (s: GameState, names: string[]) => {
  const result: AntManTarget[] = [];
  for (const seat of playerOrder(s))
    if (
      seatView(s, seat).player.form === "hero" &&
      names.includes(
        seat.heroId === "phoenix"
          ? "Phoenix"
          : seat.heroId === "storm"
            ? "Storm"
            : seat.heroId === "cyclops"
              ? "Cyclops"
              : "",
      )
    )
      result.push({
        id: `hero:${seat.id}`,
        label:
          seat.heroId === "phoenix"
            ? "Phoenix"
            : seat.heroId === "cyclops"
              ? "Cyclops"
              : "Storm",
      });
  for (const p of allInPlay(s))
    if (card(p)?.type_code === "ally" && names.includes(card(p).name))
      result.push({ id: p.id, label: card(p).name });
  return result;
};
export function phoenixPlayRestriction(
  s: GameState,
  p: Piece,
  ports: PhoenixPorts,
): string | undefined {
  if (
    [
      "34008",
      "34010",
      "34011",
      "34012",
      "34013",
      "34018",
      "34019",
      "34023",
      "34032",
      "34033",
      "34034",
      "34035",
    ].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "Hero form required.";
  if (
    ["34017", "34032", "34033", "34034"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Psionic")
  )
    return "Your identity needs the Psionic trait.";
  if (p.code === "34022" && !ports.hasTrait(s, "hero", "Mutant"))
    return "Your identity needs the Mutant trait.";
  if (
    p.code === "34018" &&
    (!ports.hasTrait(s, "hero", "X-Men") || s.player.exhausted)
  )
    return "Mutant Peacekeepers requires your ready X-Men hero.";
  if (["34017", "34033"].includes(p.code) && !s.flags.phoenixReaction)
    return "Play this event in its printed interrupt window.";
  if (
    p.code === "34023" &&
    (!["phoenix", "cyclops"].includes(s.heroId) ||
      !["Phoenix", "Cyclops"].every((name) =>
        team(s, ["Phoenix", "Cyclops"]).some((t) => t.label === name),
      ))
  )
    return "Psychic Rapport requires Cyclops and Phoenix in play and one as your identity.";
  if (
    p.code === "34035" &&
    (!["phoenix", "storm"].includes(s.heroId) ||
      !["Phoenix", "Storm"].every((name) =>
        team(s, ["Phoenix", "Storm"]).some((t) => t.label === name),
      ))
  )
    return "Soul Sisters requires Phoenix and Storm in play and one as your identity.";
  const attachment = phoenixAttachmentTargets(s, p, ports);
  if (attachment && !attachment.length)
    return "There is no legal attachment target.";
  if (
    p.code === "34034" &&
    !ports
      .characterTargets(s)
      .some((t) => !t.id.startsWith("hero") && ports.canReady(s, t.id))
  )
    return "There is no ally to ready.";
  return undefined;
}
export function phoenixAbilityOptions(
  s: GameState,
  id: string,
  ports: Pick<PhoenixPorts, "maxHP">,
): Option[] {
  const p = own(s, id);
  if (!p || p.exhausted || isTextBlank(s, p) || s.player.form !== "alter")
    return [];
  if (p.code === "34004")
    return [
      O("power", "White Hot Room · place 1 power counter", [
        P("room", { id, mode: "power" }),
      ]),
      ...(s.player.hp < ports.maxHP(s)
        ? [
            O("heal", "White Hot Room · heal 2 damage", [
              P("room", { id, mode: "heal" }),
            ]),
          ]
        : []),
    ];
  if (p.code === "34022")
    return [
      O("cerebro", "Cerebro · search for an X-Men ally", [
        P("cerebro", { id }),
      ]),
    ];
  return [];
}
export function phoenixAbility(
  s: GameState,
  id: string,
  choice: string,
  ports: Pick<PhoenixPorts, "maxHP">,
): Effect[] | null {
  const options = phoenixAbilityOptions(s, id, ports);
  const option = options.find((o) => o.id === choice);
  return option ? option.effects : null;
}
export function phoenixCardEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === "34009") return [P("control", { id: p.id })];
  return [];
}
export function phoenixAllyEntered(s: GameState, p: Piece): Effect[] | null {
  return p.code === "34003"
    ? [
        E("optional", {
          title: "Cyclops",
          text: "Place 2 power counters on Phoenix Force?",
          effects: [P("counters", { amount: 2 })],
        }),
      ]
    : null;
}
export function phoenixCardLeft(s: GameState, p: Piece): Effect[] {
  const owner = controller(s, p.id);
  const effects =
    p.code === "34003" && !isTextBlank(s, p)
      ? [
          E("optional", {
            title: "Cyclops",
            actorId: owner?.id,
            text: "Remove 2 power counters from Phoenix Force?",
            effects: [P("counters", { actorId: owner?.id, amount: -2 })],
          }),
        ]
      : [];
  return effects;
}
/** Control changes retain physical cards. Compare actual attachment play order,
 * including encounter attachments, rather than card allocation/printed order. */
export function phoenixLatestControl(
  s: GameState,
  p: Piece,
): Piece | undefined {
  return [...allInPlay(s), ...s.attachments]
    .filter(
      (a) =>
        a.attachedTo === p.id &&
        ["34009", "36038", "25031"].includes(a.code) &&
        !isTextBlank(s, a),
    )
    .sort((a, b) => (b.controlOrder || 0) - (a.controlOrder || 0))[0];
}
export function phoenixSyncControlled(s: GameState) {
  for (const a of [...allInPlay(s), ...s.attachments])
    if (
      ["34009", "36038", "25031"].includes(a.code) &&
      a.attachedTo &&
      a.controlOrder === undefined
    )
      a.controlOrder = s.nextId++;
  for (const p of [...allInPlay(s), ...s.minions]) {
    const latest = phoenixLatestControl(s, p);
    if (latest?.code === "34009") {
      const seat = controller(s, latest.id);
      if (!seat || seat.eliminated) continue;
      const current = controller(s, p.id);
      if (current?.id !== seat.id) {
        if (current) {
          const player = seatView(s, current).player;
          player.inPlay = player.inPlay.filter((q) => q.id !== p.id);
        }
        s.minions = s.minions.filter((q) => q.id !== p.id);
        seatView(s, seat).player.inPlay.push(p);
      }
      p.treatedAsAlly = true;
      delete p.treatedAsMinion;
      delete (p as Piece & { stormControlled?: boolean }).stormControlled;
    } else if (p.treatedAsAlly) {
      delete p.treatedAsAlly;
      if (card(p).type_code === "minion") {
        const seat = controller(s, p.id);
        if (seat) {
          const player = seatView(s, seat).player;
          player.inPlay = player.inPlay.filter((q) => q.id !== p.id);
          p.engagedWith = seat.id;
          if (!s.minions.some((q) => q.id === p.id)) s.minions.push(p);
        }
      } else if (!latest && card(p).type_code === "ally") {
        // RRG control: when a control-changing ability ends, an originally
        // player-owned ally returns to its owner, not its last controller.
        const current = controller(s, p.id);
        const owner = s.players.find(
          (seat) => seat.id === p.ownerId && !seat.eliminated,
        );
        if (owner && current?.id !== owner.id) {
          if (current) {
            const player = seatView(s, current).player;
            player.inPlay = player.inPlay.filter((q) => q.id !== p.id);
          }
          s.minions = s.minions.filter((q) => q.id !== p.id);
          delete p.engagedWith;
          seatView(s, owner).player.inPlay.push(p);
        }
      }
    }
  }
}
export function phoenixAllyModifiers(s: GameState, p: Piece) {
  const trained = allInPlay(s).filter(
    (a) => a.code === "34016" && a.attachedTo === p.id && !isTextBlank(s, a),
  ).length;
  const seat = controller(s, p.id);
  const bonus =
    seat && seatView(s, seat).flags[`phoenixKicker:${p.id}`] === phase(s)
      ? 2
      : 0;
  return { attack: bonus, thwart: trained + bonus, health: 2 * trained };
}
export function phoenixAllyUsed(
  s: GameState,
  p: Piece,
  kind: string,
): Effect[] {
  const seat = controller(s, p.id);
  if (seat) delete seatView(s, seat).flags[`phoenixKicker:${p.id}`];
  return p.code === "34014" &&
    kind === "thwart" &&
    !isTextBlank(s, p) &&
    s.minions.length
    ? [
        E("optional", {
          title: "Banshee",
          text: "Confuse a minion?",
          effects: [P("banshee")],
        }),
      ]
    : [];
}
export function phoenixBeforeAlly(
  s: GameState,
  p: Piece,
  e: Effect,
): Effect[] | null {
  if (
    e.phoenixAllyHandled ||
    isTextBlank(s, p) ||
    (e.kind === "attack" ? p.stunned : p.confused)
  )
    return null;
  if (p.code === "34015" && e.kind === "attack") {
    const m = s.minions.find((m) => m.id === e.target);
    if (m)
      return [
        E("optional", {
          title: "Marvel Girl",
          text: `Remove ${card(m).scheme || 0} threat from the main scheme?`,
          effects: [
            E("thwart", {
              target: "main",
              amount: card(m).scheme || 0,
              ignoreCrisis: true,
              source: p.id,
            }),
          ],
        }),
        { ...e, phoenixAllyHandled: true },
      ];
  }
  if (p.code === "34021" && e.kind === "thwart")
    return [
      P("storm-move", {
        from: e.target,
        after: [{ ...e, phoenixAllyHandled: true }],
      }),
    ];
  return null;
}
export function phoenixEvent(s: GameState, p: Piece): Effect[] | null {
  return [
    "34010",
    "34011",
    "34012",
    "34013",
    "34017",
    "34018",
    "34023",
    "34032",
    "34033",
    "34034",
    "34035",
  ].includes(p.code)
    ? [P("event", { piece: p })]
    : null;
}
export function phoenixPayment(s: GameState, spent: Piece, event?: Piece) {
  if (
    spent.code === "34020" &&
    event &&
    card(event).traits?.includes("Thwart.")
  )
    s.flags[`phoenixPassion:${event.id}`] =
      Number(s.flags[`phoenixPassion:${event.id}`] || 0) + 1;
}
/** Alterations belong to one play, even when the same physical event returns
 * to hand before its resolving-zone cleanup runs. */
export function phoenixEventFinished(s: GameState, id: string) {
  for (const seat of s.players)
    delete seatView(s, seat).flags[`phoenixPassion:${id}`];
}
export const phoenixThwartBonus = (s: GameState) =>
  Number(s.flags[`phoenixPassion:${s.currentEventId}`] || 0);
export function phoenixForcedDamage(
  s: GameState,
  packet: Effect,
  ports: PhoenixPorts,
): Effect[] | null {
  if (
    !(packet.enemyAttack || ["attack", "overkill"].includes(packet.kind)) ||
    packet.amount <= 0
  )
    return null;
  const target = normalized(s, packet.target);
  const p = allInPlay(s).find(
    (p) =>
      p.code === "34007" &&
      normalized(s, p.attachedTo || "") === target &&
      !isTextBlank(s, p),
  );
  if (!p) return null;
  const id = target.startsWith("hero:") ? target.slice(5) : undefined;
  if (
    id
      ? seatView(s, id).player.tough
      : allInPlay(s).find((q) => q.id === target)?.tough
  )
    return null;
  return [P("shield", { id: p.id, packet })];
}
export function phoenixDefeatOptions(s: GameState): Option[] {
  return s.player.inPlay
    .filter((p) => p.code === "34006" && !isTextBlank(s, p))
    .map((p) =>
      O(
        p.id,
        "Rise from the Ashes · restore printed hit points",
        [P("rise", { id: p.id })],
        p.code,
      ),
    );
}
export function phoenixReactionOptions(
  s: GameState,
  kind: "scheme" | "attack",
  after: Effect[],
  ports: PhoenixPorts,
): Option[] {
  const code = kind === "scheme" ? "34017" : "34033";
  if (
    !ports.hasTrait(s, "hero", "Psionic") ||
    (kind === "attack" &&
      (s.player.form !== "hero" ||
        !s.attack ||
        !ports.enemyTargets(s, false).some((t) => t.id !== s.attack!.attacker)))
  )
    return [];
  return s.player.hand
    .filter((p) => p.code === code && ports.canPay(s, p))
    .map((p) =>
      O(p.id, card(p).name, [P("reaction", { id: p.id, kind, after })], p.code),
    );
}
export function phoenixShadowOfPast(s: GameState): Effect[] | null {
  return active(s) ? [P("shadow")] : null;
}
export function phoenixEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (["34028", "34029", "34030", "34031"].includes(p.code))
    return [P("encounter", { piece: p })];
  return null;
}
export function phoenixThreatPlaced(
  s: GameState,
  p: Piece,
  ports: Pick<PhoenixPorts, "lose">,
) {
  if (p.code === "34030" && p.counters >= 12 && !isTextBlank(s, p))
    ports.lose(s, "Consume the World reaches 12 threat.");
}
export function phoenixSchemeTarget(s: GameState, p: Piece) {
  return p.code === "34029" && !isTextBlank(s, p)
    ? s.sideSchemes.find((q) => q.code === "34030")?.id || "main"
    : "main";
}
function findEncounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
}
function target(
  s: GameState,
  title: string,
  list: AntManTarget[],
  effect: Effect,
  ports: PhoenixPorts,
) {
  if (list.length)
    ports.choose(
      s,
      title,
      "Choose a legal target.",
      list.map((t) => O(t.id, t.label, [{ ...effect, target: t.id }], t.code)),
    );
}
export function resolvePhoenixEffect(
  s: GameState,
  e: Effect,
  ports: PhoenixPorts,
) {
  if (!e.type.startsWith("phoenix:")) return false;
  switch (e.type) {
    case "phoenix:counters":
      phoenixChangeCounters(s, e.amount);
      break;
    case "phoenix:discard":
      ports.discard(s, e.id);
      break;
    case "phoenix:room": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.form === "alter",
        "White Hot Room is unavailable.",
      );
      p!.exhausted = true;
      if (e.mode === "power") phoenixChangeCounters(s, 1);
      else ports.queue(s, E("heal", { target: "hero", amount: 2 }));
      break;
    }
    case "phoenix:cerebro": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Cerebro is unavailable.",
      );
      p!.exhausted = true;
      ports.revealHidden(s);
      const psionic = ports
        .characterTargets(s)
        .some(
          (t) =>
            (t.id === `hero:${s.activePlayerId}` || !!own(s, t.id)) &&
            ports.hasTrait(s, t.id, "Psionic"),
        );
      const pool = (psionic ? s.player.deck : s.player.deck.slice(0, 5)).filter(
        (p) =>
          card(p).type_code === "ally" && card(p).traits?.includes("X-Men."),
      );
      ports.choose(s, "Cerebro", "Search your deck for an X-Men ally.", [
        ...pool.map((p) =>
          O(p.id, card(p).name, [P("cerebro-found", { id: p.id })], p.code),
        ),
        O("none", "Find no ally", [P("cerebro-found")]),
      ]);
      break;
    }
    case "phoenix:cerebro-found": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shufflePlayer(s);
      break;
    }
    case "phoenix:control": {
      const a = own(s, e.id);
      const m = [...s.minions, ...allInPlay(s)].find(
        (p) => p.id === a?.attachedTo,
      );
      need(
        a && m && !card(m).traits?.includes("Elite."),
        "Mind Control needs its actual non-Elite minion.",
      );
      a!.controlOrder ||= s.nextId++;
      phoenixSyncControlled(s);
      break;
    }
    case "phoenix:event": {
      const p = e.piece as Piece;
      const unleashed = phoenixTraits(s).includes("Unleashed");
      if (p.code === "34010")
        target(
          s,
          "Telekinetic Attack",
          ports.enemyTargets(s, true),
          E("damage", {
            amount: unleashed ? 9 : 7,
            attack: true,
            overkill: unleashed,
          }),
          ports,
        );
      if (p.code === "34011")
        ports.queue(
          s,
          E("damage", { target: s.villain.id, amount: 4 }),
          ...(unleashed
            ? s.minions
                .filter(
                  (m) =>
                    (m.engagedWith || s.activePlayerId) === s.activePlayerId,
                )
                .map((m) => E("damage", { target: m.id, amount: 4 }))
            : []),
        );
      if (p.code === "34012")
        target(
          s,
          "Telepathic Trickery",
          ports.schemeTargets(s, true),
          P("trickery", { unleashed }),
          ports,
        );
      if (p.code === "34013")
        ports.choose(s, "Phoenix Firebird", "Choose one.", [
          ...((phoenixForce(s)?.counters || 0) > 0 && ports.canReady(s, "hero")
            ? [
                O("ready", "Remove 1 power counter → ready Phoenix", [
                  P("firebird-ready"),
                ]),
              ]
            : []),
          O("power", "Place 2 power counters", [P("counters", { amount: 2 })]),
        ]);
      if (p.code === "34017") {
        need(s.scheming, "There is no villain scheme activation.");
        s.flags[`phoenixManipulation:${s.scheming!.id}`] = true;
        s.flags[`phoenixManipulationBonus:${s.scheming!.id}`] =
          phoenixThwartBonus(s);
        delete s.flags[`phoenixPassion:${s.currentEventId}`];
      }
      if (p.code === "34018") {
        need(!s.player.exhausted, "Mutant Peacekeepers requires a ready hero.");
        s.player.exhausted = true;
        ports.queue(
          s,
          P("peacekeepers", {
            amount: ports.heroThwart(s) + phoenixThwartBonus(s),
            used: [],
          }),
        );
      }
      if (p.code === "34023")
        ports.queue(
          s,
          ...team(s, ["Phoenix", "Cyclops"]).map((t) =>
            E("ready", { target: t.id }),
          ),
          P("rapport-choice"),
        );
      if (p.code === "34032")
        target(
          s,
          "Psychic Assault",
          ports.enemyTargets(s, true),
          P("assault"),
          ports,
        );
      if (p.code === "34033") {
        ports.declareDefense(s);
        target(
          s,
          "Psychic Misdirection",
          ports
            .enemyTargets(s, false)
            .filter((t) => t.id !== s.attack?.attacker),
          P("misdirect"),
          ports,
        );
      }
      if (p.code === "34034")
        target(
          s,
          "Psychic Kicker",
          ports
            .characterTargets(s)
            .filter((t) => !t.id.startsWith("hero") && ports.canReady(s, t.id)),
          P("kicker"),
          ports,
        );
      if (p.code === "34035")
        ports.queue(
          s,
          ...team(s, ["Phoenix", "Storm"]).flatMap((t) => [
            E("ready", { target: t.id }),
            E("heal", { target: t.id, amount: 2 }),
          ]),
        );
      break;
    }
    case "phoenix:rapport-choice": {
      const options: Option[] = [];
      const phoenixSeat = s.players.find(
        (seat) => seat.heroId === "phoenix" && !seat.eliminated,
      );
      if (phoenixSeat && phoenixForce(seatView(s, phoenixSeat)))
        options.push(
          O("power", "Place 2 power counters on Phoenix Force", [
            P("counters", { amount: 2, actorId: phoenixSeat.id }),
          ]),
        );
      for (const p of s.player.discard.filter(
        (p) => card(p).set_code === "cyclops",
      ))
        options.push(
          O(
            p.id,
            `Return ${card(p).name} to hand`,
            [P("rapport-return", { id: p.id })],
            p.code,
          ),
        );
      if (options.length)
        ports.choose(s, "Psychic Rapport", "Choose one.", options);
      break;
    }
    case "phoenix:rapport-return": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "phoenix:firebird-ready":
      need(
        (phoenixForce(s)?.counters || 0) > 0,
        "Phoenix Force has no power counter.",
      );
      phoenixChangeCounters(s, -1);
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    case "phoenix:trickery":
      ports.queue(
        s,
        E("thwart", { target: e.target, amount: 4, thwart: true }),
        ...(e.unleashed ? [P("trickery-status")] : []),
      );
      break;
    case "phoenix:trickery-status":
      target(
        s,
        "Telepathic Trickery",
        ports.enemyTargets(s, false),
        P("stun-confuse"),
        ports,
      );
      break;
    case "phoenix:stun-confuse":
      ports.queue(
        s,
        E("status", { target: e.target, status: "stunned" }),
        E("status", { target: e.target, status: "confused" }),
      );
      break;
    case "phoenix:assault":
      ports.queue(
        s,
        E("damage", { target: e.target, amount: 3, attack: true }),
        E("status", { target: e.target, status: "confused" }),
      );
      break;
    case "phoenix:kicker": {
      const seat = controller(s, e.target);
      if (seat) seatView(s, seat).flags[`phoenixKicker:${e.target}`] = phase(s);
      ports.queue(s, E("ready", { target: e.target }));
      break;
    }
    case "phoenix:peacekeepers": {
      const allies = allInPlay(s).filter(
        (p) =>
          card(p).type_code === "ally" &&
          !p.exhausted &&
          ports.hasTrait(s, p.id, "X-Men"),
      );
      ports.choose(
        s,
        "Mutant Peacekeepers",
        "Exhaust any number of X-Men allies, then divide threat removal.",
        [
          ...allies.map((p) =>
            O(
              p.id,
              card(p).name,
              [P("peacekeeper-add", { id: p.id, amount: e.amount })],
              p.code,
            ),
          ),
          O("done", `Remove ${e.amount} threat`, [
            P("divide", { amount: e.amount }),
          ]),
        ],
      );
      break;
    }
    case "phoenix:peacekeeper-add": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      need(p && !p.exhausted, "That ally is exhausted.");
      p!.exhausted = true;
      ports.queue(
        s,
        P("peacekeepers", {
          amount: e.amount + ports.allyStat(s, p!, "thwart"),
        }),
      );
      break;
    }
    case "phoenix:divide": {
      if (e.amount <= 0) break;
      const choices = ports
        .schemeTargets(s, true)
        .filter((t) =>
          t.id === "main"
            ? s.scheme.threat > 0
            : s.sideSchemes.some((p) => p.id === t.id && p.counters > 0),
        );
      target(
        s,
        "Mutant Peacekeepers",
        choices,
        P("divide-one", { amount: e.amount }),
        ports,
      );
      break;
    }
    case "phoenix:divide-one":
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: 1,
          thwart: true,
          additional: true,
        }),
        P("divide", { amount: e.amount - 1 }),
      );
      break;
    case "phoenix:banshee":
      target(
        s,
        "Banshee",
        s.minions.map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        E("status", { status: "confused" }),
        ports,
      );
      break;
    case "phoenix:storm-move": {
      const list = ports.schemeTargets(s, false).filter((t) => t.id !== e.from);
      const amount =
        e.from === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((p) => p.id === e.from)?.counters || 0;
      if (!list.length || !amount) {
        ports.queue(s, ...e.after);
        break;
      }
      ports.choose(
        s,
        "Storm",
        "Move up to 2 threat to another scheme before thwarting.",
        [
          ...list.map((t) =>
            O(
              t.id,
              t.label,
              [
                P("move-threat", {
                  from: e.from,
                  target: t.id,
                  amount: Math.min(2, amount),
                }),
                ...e.after,
              ],
              t.code,
            ),
          ),
          O("skip", "Continue without moving threat", e.after),
        ],
      );
      break;
    }
    case "phoenix:move-threat":
      ports.moveThreat(s, e.from, e.target, e.amount);
      break;
    case "phoenix:shield": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      if (!p) {
        ports.queue(s, e.packet);
        break;
      }
      const amount = Number(e.packet.amount);
      p.damage += amount;
      ports.preventDamage(s, e.packet, amount);
      ports.queue(s, e.packet);
      if (p.damage >= 5) ports.discard(s, p.id);
      break;
    }
    case "phoenix:rise": {
      const p = own(s, e.id);
      need(p && p.code === "34006", "Rise from the Ashes is unavailable.");
      s.flags.phoenixDefeatPending = false;
      ports.remove(s, e.id);
      s.player.hp = ports.printedHP(s);
      s.player.exhausted = false;
      phoenixChangeCounters(s, -(phoenixForce(s)?.counters || 0));
      break;
    }
    case "phoenix:allow-defeat":
      s.flags.phoenixDefeatPending = false;
      s.flags.phoenixDefeatDeclined = true;
      break;
    case "phoenix:reaction": {
      const p = s.player.hand.find((p) => p.id === e.id);
      need(p, "The reaction event is no longer in hand.");
      s.flags.phoenixReaction = true;
      ports.playReaction(s, p!, [P("reaction-end"), ...e.after]);
      break;
    }
    case "phoenix:reaction-end":
      delete s.flags.phoenixReaction;
      break;
    case "phoenix:misdirect":
      if (s.attack) s.flags[`phoenixMisdirection:${s.attack.id}`] = e.target;
      break;
    case "phoenix:shadow": {
      const dark = findEncounter(s, "34029"),
        world = findEncounter(s, "34030");
      const rest = (s.player.setAside || []).filter((p) => p.code === "34031");
      s.player.setAside = (s.player.setAside || []).filter(
        (p) => p.code !== "34031",
      );
      s.encounter.deck.push(...rest);
      ports.shuffleEncounter(s);
      if (dark) ports.reveal(s, dark);
      if (world) ports.reveal(s, world);
      if (!dark) ports.queue(s, E("surge"));
      break;
    }
    case "phoenix:encounter": {
      const p = e.piece as Piece;
      if (p.code === "34028") {
        const seat = s.players.find(
          (p) => p.heroId === "phoenix" && !p.eliminated,
        );
        if (!seat) {
          ports.discardEncounter(s, p);
          break;
        }
        const view = seatView(s, seat);
        if (phoenixTraits(view).includes("Unleashed")) {
          const dark = findEncounter(s, "34029");
          ports.shuffleEncounter(s);
          if (dark)
            ports.queue(s, E("reveal", { piece: dark, actorId: seat.id }));
          ports.removeEncounter(s, p);
        } else {
          if (phoenixTraits(view).includes("Restrained")) {
            phoenixChangeCounters(view, -1);
            ports.queue(s, E("surge", { actorId: seat.id }));
          }
          ports.discardEncounter(s, p);
        }
      }
      if (p.code === "34029") {
        const world = findEncounter(s, "34030");
        ports.shuffleEncounter(s);
        if (world) ports.reveal(s, world);
      }
      if (p.code === "34030")
        phoenixThreatPlaced(
          s,
          s.sideSchemes.find((q) => q.id === p.id) || p,
          ports,
        );
      if (p.code === "34031") {
        const dark = s.minions.find((q) => q.code === "34029");
        if (dark)
          ports.queue(
            s,
            E("minionActivate", { id: dark.id, playerId: s.activePlayerId }),
          );
        else {
          const world = s.sideSchemes.find((q) => q.code === "34030");
          ports.queue(
            s,
            ...(world ? [E("threat", { target: world.id, amount: 1 })] : []),
            E("surge"),
          );
        }
      }
      break;
    }
    default:
      throw Error(`Unknown Phoenix effect ${e.type}`);
  }
  return true;
}
