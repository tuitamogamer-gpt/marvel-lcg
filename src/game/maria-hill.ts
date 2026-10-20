import { card, DB } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import type { PaymentSource } from "./payment.js";
import type {
  Effect,
  GameState,
  Option,
  Piece,
  Prompt,
  Resource,
} from "./types.js";

// Read the current printed identity without importing the script registry.
const heroCard = (s: GameState) => {
  const form = s.player.form === "hero" ? "hero" : "alter_ego";
  if (form === "hero" && s.heroId === "ironheart" && s.player.ironheartIdentity)
    return card(s.player.ironheartIdentity);
  if (
    form === "hero" &&
    ["ant", "wsp"].includes(s.heroId) &&
    s.player.heroForm === "giant"
  )
    return card(s.heroId === "ant" ? "12001c" : "13001c");
  if (
    form === "hero" &&
    s.heroId === "angel" &&
    s.player.angelForm === "archangel"
  )
    return card("42001c");
  return Object.values(DB).find(
    (c) => c.set_code === s.heroId && c.type_code === form,
  )!;
};

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  ...args,
  type,
});
const M = (type: string, args: Record<string, unknown> = {}) =>
  E(`maria:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, text: string) => {
  if (!value) throw Error(text);
};
const optional = (title: string, effects: Effect[], actorId?: string) =>
  E("optional", { title, text: `Use ${title}?`, effects, actorId });
const own = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const normalize = (t: string) => t.replace(/\.$/, "").toLowerCase();
const printedTraits = (p: Piece | string) =>
  (card(p).traits || "").replace(/\.$/, "").split(/\.\s+/).map(normalize);
const printedResources = (p: Piece): Resource[] =>
  (["energy", "mental", "physical", "wild"] as Resource[]).flatMap((r) =>
    Array(Number(card(p)[`resource_${r}`] || 0)).fill(r),
  );
const active = (s: GameState, p?: Piece) =>
  !deadpoolTriggeredBlocked(
    p && controller(s, p.id) ? seatView(s, controller(s, p.id)!) : s,
  );
const globalFlags = (s: GameState) => seatView(s, s.firstPlayerId).flags;
const uses = (p: Piece) => /\bUses\s*\(/i.test(card(p).text || "");
export const MARIA_HILL_SCRIPT_CODES = [
  "50001a",
  "50001b",
  ...Array.from({ length: 32 }, (_, i) => String(50002 + i)),
].filter((code) => code !== "50024");
export interface MariaHillPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  enemies(s: GameState): { id: string; label: string; code?: string }[];
  schemes(s: GameState): { id: string; label: string; code?: string }[];
  characters(s: GameState): { id: string; label: string; code?: string }[];
  canStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  canReady(s: GameState, id: string): boolean;
  ready(s: GameState, id: string): void;
  discard(s: GameState, id: string): void;
  remove(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  shuffle(s: GameState): void;
  recycle(s: GameState): void;
  hidden(s: GameState): void;
  canPut(s: GameState, p: Piece): boolean;
  put(s: GameState, p: Piece, playerId: string): void;
  canPay(s: GameState, cost: number, requirements: Resource[]): boolean;
  allyAttack(s: GameState, p: Piece): number;
  shuffleEncounter(s: GameState): void;
  requestPayment(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
  ): void;
  restorePayment(
    s: GameState,
    payment: Prompt,
    queue: Effect[],
    actorId?: string,
  ): void;
  keepObligation(s: GameState, p: Piece): void;
  cancelReveal(s: GameState, p: Piece, after: Effect[]): void;
  drawEncounter(s: GameState): Piece | undefined;
  removeTough(s: GameState, id: string): void;
  batch(s: GameState, ids: string[], n: number, source: string): void;
}
export function mariaHillTrait(s: GameState, id: string, t: string): boolean {
  if (normalize(t) !== normalize("S.H.I.E.L.D.")) return false;
  const seat = controller(s, id);
  if (!seat) return false;
  const view = seatView(s, seat);
  return (
    view.heroId === "maria_hill" &&
    view.player.form === "hero" &&
    !isTextBlank(view, "50001a") &&
    card(allInPlay(s).find((p) => p.id === id)!).type_code === "ally"
  );
}
export const mariaHillSupports = (s: GameState, ownOnly = false) =>
  (ownOnly ? s.player.inPlay : allInPlay(s)).filter(
    (p) =>
      card(p).type_code === "support" &&
      printedTraits(p).includes(normalize("S.H.I.E.L.D.")),
  );
export function mariaHillChangeCounters(
  s: GameState,
  p: Piece,
  amount: number,
  ports: Pick<MariaHillPorts, "discard">,
) {
  const before = p.counters;
  p.counters = Math.max(0, before + amount);
  if (
    amount < 0 &&
    before > 0 &&
    p.counters === 0 &&
    uses(p) &&
    !isTextBlank(s, p)
  )
    ports.discard(s, p.id);
}
export function mariaHillInitialize(
  s: GameState,
  ports: Pick<MariaHillPorts, "makePiece">,
) {
  if (s.heroId !== "maria_hill" || s.flags.mariaInitialized) return;
  s.flags.mariaInitialized = true;
  (s.player.setAside ||= []).push(
    ...["50030", "50031", "50032", "50033", "50033"].map((code) =>
      ports.makePiece(s, code),
    ),
  );
}
const orgKey = (id: string) => `mariaOrg:${id}`;
export function mariaHillOrgEligible(
  s: GameState,
  ports: Pick<MariaHillPorts, "hasTrait">,
) {
  const traits = (heroCard(s).traits || "").replace(/\.$/, "").split(/\.\s+/);
  return s.player.inPlay.filter(
    (p) =>
      !p.exhausted &&
      ["ally", "support"].includes(card(p).type_code) &&
      traits.some(
        (t) =>
          ports.hasTrait(s, p.id, t.endsWith(".") ? t : `${t}.`) ||
          ports.hasTrait(s, p.id, t),
      ),
  );
}
export function mariaHillOrgResources(
  s: GameState,
  p: Piece,
): Resource[] | undefined {
  if (p.code !== "50014") return undefined;
  const saved = s.flags[orgKey(p.id)];
  if (typeof saved === "string")
    return [
      ...printedResources(p),
      ...(JSON.parse(saved) as { resources: Resource[] }).resources,
    ];
  // Payment discovery advertises only a realizable upper bound; PAY asks for
  // the exact physical exhaust sources before validating or spending anything.
  const identityTraits = (heroCard(s).traits || "")
    .replace(/\.$/, "")
    .split(/\.\s+/)
    .map(normalize);
  const candidates = s.player.inPlay.filter(
    (q) =>
      !q.exhausted &&
      ["ally", "support"].includes(card(q).type_code) &&
      (printedTraits(q).some((t) => identityTraits.includes(t)) ||
        (mariaHillTrait(s, q.id, "S.H.I.E.L.D.") &&
          identityTraits.includes(normalize("S.H.I.E.L.D.")))),
  );
  return [
    ...printedResources(p),
    ...candidates
      .sort((a, b) => printedResources(b).length - printedResources(a).length)
      .slice(0, 3)
      .flatMap(printedResources),
  ];
}
export function mariaHillOrgPreflight(
  s: GameState,
  payment: Prompt,
  sources: PaymentSource[],
  queue: Effect[],
  ports: MariaHillPorts,
) {
  const source = sources.find(
    (q) =>
      q.code === "50014" &&
      !seatView(s, q.playerId || s.activePlayerId).flags[
        orgKey(q.localId || q.id)
      ],
  );
  if (!source) return false;
  ports.queue(
    s,
    M("org-choose", {
      id: source.localId || source.id,
      actorId: source.playerId || s.activePlayerId,
      payment,
      queue,
      returnActor: s.activePlayerId,
      ids: [],
    }),
  );
  s.prompt = null;
  return true;
}
export function mariaHillOrgSpend(
  s: GameState,
  p: Piece,
  ports: MariaHillPorts,
) {
  if (p.code !== "50014") return;
  const saved = JSON.parse(
    String(s.flags[orgKey(p.id)] || '{"ids":[],"resources":[]}'),
  ) as { ids: string[] };
  need(
    saved.ids.every((id) =>
      mariaHillOrgEligible(s, ports).some((q) => q.id === id),
    ),
    "Organizational Support's chosen exhaust sources are unavailable.",
  );
  for (const id of saved.ids) ports.find(s, id)!.exhausted = true;
  delete s.flags[orgKey(p.id)];
}
export function mariaHillClearPayment(s: GameState) {
  for (const seat of s.players)
    for (const key of Object.keys(seatView(s, seat).flags))
      if (key.startsWith("mariaOrg:")) delete seatView(s, seat).flags[key];
}
export function mariaHillResourceSources(
  s: GameState,
  payerId = s.activePlayerId,
): PaymentSource[] {
  if (
    !active(s) ||
    !printedTraits(heroCard(seatView(s, payerId)).code).includes(
      normalize("S.H.I.E.L.D."),
    )
  )
    return [];
  return own(s, "50008")
    .filter((p) => !p.exhausted && p.counters > 0)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      kind: "ability",
      resources: ["wild"],
      description:
        "Exhaust Support Staff and spend 1 staff counter · generate 1 Wild",
    }));
}
export function mariaHillCanShareStaff(s: GameState, p: Piece) {
  return (
    p.code === "50008" &&
    printedTraits(heroCard(s).code).includes(normalize("S.H.I.E.L.D."))
  );
}
export function mariaHillResourceSpent(
  s: GameState,
  id: string,
  ports: MariaHillPorts,
) {
  const p = own(s, "50008").find((p) => p.id === id);
  if (!p) return false;
  need(
    !p.exhausted && p.counters > 0 && active(s, p),
    "Support Staff is unavailable.",
  );
  p.exhausted = true;
  mariaHillChangeCounters(s, p, -1, ports);
  return true;
}
export function mariaHillEntered(s: GameState, p: Piece): Effect[] {
  const initial: Record<string, number> = {
    "50008": 3,
    "50009": 3,
    "50016": 3,
    "50017": 2,
    "50018": 3,
    "50019": 3,
    "50020": 2,
  };
  if (initial[p.code] !== undefined) p.counters = initial[p.code];
  const effects: Effect[] = [];
  const funding = globalFlags(s)[`mariaFunding:${p.id}`];
  delete globalFlags(s)[`mariaFunding:${p.id}`];
  if (typeof funding === "string")
    for (const source of JSON.parse(funding) as {
      actorId: string;
      id: string;
    }[])
      effects.push(
        optional(
          "Special Funding",
          [M("add-counter", { target: p.id })],
          source.actorId,
        ),
      );
  if (isTextBlank(s, p)) return effects;
  if (p.code === "50012" && active(s, p))
    effects.push(optional("Victoria Hand", [M("ready-one")]));
  if (["50015", "50028"].includes(p.code))
    effects.unshift(M("control-support", { id: p.id }));
  return effects;
}
export function mariaHillPlayRestriction(s: GameState, p: Piece) {
  if (p.code === "50003" && !mariaHillSupports(s, true).length)
    return "All-Points Bulletin requires a S.H.I.E.L.D. support you control.";
  if (
    p.code === "50004" &&
    !mariaHillSupports(s).some((q) => q.exhausted && (card(q).cost || 0) <= 6)
  )
    return "On the Double requires an exhausted S.H.I.E.L.D. support costing 6 or less.";
  if (
    p.code === "50005" &&
    !mariaHillSupports(s).some((q) => (card(q).cost || 0) <= 6)
  )
    return "Reinforcements requires a S.H.I.E.L.D. support costing 6 or less.";
  if (p.code === "50006" && !mariaHillSupports(s, true).length)
    return "The Hard Call requires your own S.H.I.E.L.D. support.";

  if (
    p.code === "50015" &&
    s.players.every((seat) =>
      seatView(s, seat).player.inPlay.some((q) =>
        printedTraits(q).includes("team"),
      ),
    )
  )
    return "Each player already controls a Team card.";
  if (
    p.code === "50028" &&
    s.players.every((seat) =>
      seatView(s, seat).player.inPlay.some((q) => q.code === "50028"),
    )
  )
    return "Each player already controls Front Organization.";
  return undefined;
}
export function mariaHillEvent(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "50003":
      return [M("bulletin", { remaining: 0, start: true })];
    case "50004":
    case "50005":
      return [
        M("support-budget", {
          kind: p.code === "50004" ? "ready" : "counter",
          ids: [],
          budget: 6,
        }),
      ];
    case "50006":
      return [M("hard-call")];
    default:
      return null;
  }
}
export function mariaHillAbilityOptions(
  s: GameState,
  id: string,
  ports: MariaHillPorts,
): Option[] {
  const p = s.player.inPlay.find((p) => p.id === id);
  if (!active(s) && p?.code !== "50029") return [];
  if (
    id === "identity" &&
    s.heroId === "maria_hill" &&
    !isTextBlank(s, heroCard(s))
  ) {
    if (
      s.player.form === "alter" &&
      !s.player.exhausted &&
      s.player.deck.some(
        (p) =>
          card(p).type_code === "support" &&
          printedTraits(p).includes(normalize("S.H.I.E.L.D.")),
      )
    )
      return [
        O(
          "shield-search",
          "Search for a S.H.I.E.L.D. support",
          [M("search")],
          "50001b",
        ),
      ];
    if (
      s.player.form === "hero" &&
      s.flags.mariaReassignment !== s.round &&
      mariaHillSupports(s).some((p) => p.counters > 0) &&
      mariaHillSupports(s).length > 1
    )
      return [
        O(
          "reassignment",
          "Reassignment · move 1 all-purpose counter",
          [M("move-from")],
          "50001a",
        ),
      ];
  }
  if (!p || isTextBlank(s, p)) return [];
  if (p.code === "50029" && s.player.form === "alter" && !s.player.exhausted)
    return [
      O(
        "press-conference",
        "Exhaust identity · discard Press Conference",
        [M("obligation-discard", { id })],
        p.code,
      ),
    ];
  if (p.exhausted) return [];
  if (
    p.code === "50016" &&
    !ports.characters(s).some((t) => {
      const q = ports.find(s, t.id);
      return q && card(q).type_code === "ally" && ports.canReady(s, t.id);
    })
  )
    return [];
  if (
    p.code === "50017" &&
    !playerOrder(s).some((seat) => {
      const v = seatView(s, seat);
      return v.player.hand.some(
        (q) => card(q).type_code === "ally" && ports.canPut(v, q),
      );
    })
  )
    return [];
  if (p.code === "50011" && mariaHillSupports(s).length)
    return [
      O(
        "director",
        "S.H.I.E.L.D. Director · add 1 counter",
        [M("director", { id })],
        p.code,
      ),
    ];
  if (
    ["50009", "50016", "50017", "50018", "50019", "50020"].includes(p.code) &&
    p.counters > 0
  )
    return [
      O("support-action", card(p).name, [M("support-action", { id })], p.code),
    ];
  return [];
}
export function mariaHillHandOptions(s: GameState, id: string): Option[] {
  const p = s.player.hand.find((p) => p.id === id && p.code === "50013");
  return p && active(s)
    ? [
        O(
          "slingshot",
          "Slingshot · spend Energy to enter under any player's control",
          [M("slingshot", { id })],
          p.code,
        ),
      ]
    : [];
}
export function mariaHillAllyUsed(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p) || !active(s, p)) return [];
  if (p.code === "50002" && mariaHillSupports(s).length)
    return [optional("Nick Fury", [M("counter-target")])];
  if (p.code === "50023")
    return [optional("Melinda May", [M("look-encounter")])];
  return [];
}
export function mariaHillPhaseEnd(
  s: GameState,
  playerPhase: boolean,
): Effect[] {
  const effects: Effect[] = [];
  for (const seat of playerOrder(s)) {
    const v = seatView(s, seat);
    for (const p of v.player.inPlay) {
      if (p.code === "50013" && globalFlags(s)[`mariaSlingshot:${p.id}`])
        effects.push(M("slingshot-return", { id: p.id, actorId: seat.id }));
      if (playerPhase && p.code === "50029" && !isTextBlank(v, p))
        effects.push(M("press", { actorId: seat.id }));
    }
  }
  return effects;
}
export function mariaHillActivation(s: GameState, id: string): Effect[] {
  const p = s.minions.find(
    (p) => p.id === id && p.code === "50030" && !isTextBlank(s, p),
  );
  return p ? [M("controller", { id })] : [];
}
export function mariaHillEncounter(s: GameState, p: Piece): Effect[] | null {
  if (isTextBlank(s, p) && MARIA_HILL_SCRIPT_CODES.includes(p.code)) return [];
  switch (p.code) {
    case "50029":
      return [M("obligation", { piece: p })];
    case "50030":
    case "50032":
      return [];
    case "50031":
      return [M("find-environment")];
    case "50033":
      return [M("controller")];
    default:
      return null;
  }
}
export function mariaHillSchemeDefeated(_s: GameState, p: Piece): Effect[] {
  return p.code === "50031" && !isTextBlank(_s, p) ? [M("army-defeated")] : [];
}
export function mariaHillShadows(s: GameState): Effect[] | null {
  return s.heroId === "maria_hill" ? [M("shadows")] : null;
}
export function mariaHillRevealed(s: GameState, p: Piece): Effect[] {
  if (card(p).type_code !== "treachery") return [];
  return own(s, "50022")
    .filter((p) => active(s, p))
    .map((p) => M("ward", { id: p.id }));
}
export function mariaHillLmdOptions(s: GameState, after: Effect[]): Option[] {
  return active(s)
    ? own(s, "50010").map((p) =>
        O(
          p.id,
          "Life Model Decoy · prevent all attack damage",
          [M("lmd", { id: p.id, after })],
          p.code,
        ),
      )
    : [];
}
export function mariaHillTeamOptions(
  s: GameState,
  p: Piece,
  after: Effect[],
  ports: MariaHillPorts,
): Option[] {
  if (!active(s)) return [];
  const allShield = [
    "hero",
    ...s.player.inPlay
      .filter((q) => card(q).type_code === "ally")
      .map((q) => q.id),
  ].every((id) => ports.hasTrait(s, id, "S.H.I.E.L.D."));
  return allShield
    ? own(s, "50015")
        .filter((q) => !q.exhausted)
        .map((q) =>
          O(
            q.id,
            "Agents of S.H.I.E.L.D. · replace this encounter",
            [M("team-cancel", { id: q.id, piece: p, after })],
            q.code,
          ),
        )
    : [];
}
export function mariaHillFrontOptions(
  s: GameState,
  target: Piece,
  after: Effect[],
): Option[] {
  const seat = controller(s, target.id);
  if (!seat) return [];
  const view = seatView(s, seat);
  if (!active(view)) return [];
  return own(view, "50028")
    .filter((p) => p.id !== target.id)
    .map((p) =>
      O(
        p.id,
        "Front Organization · discard this instead",
        [M("front-replace", { id: p.id, after })],
        p.code,
      ),
    );
}
/** Only encounter instructions call this entry point; player costs use discard. */
export function mariaHillEncounterDiscard(
  s: GameState,
  id: string,
  source: string | undefined,
  ports: MariaHillPorts,
  after: Effect[] = [],
) {
  const target = ports.find(s, id);
  if (target && mariaHillFrontOptions(s, target, []).length)
    ports.queue(s, M("front-window", { target: id, source, after }));
  else {
    if (target) ports.discard(s, id);
    ports.queue(s, ...after);
  }
}
export function mariaHillControlled(s: GameState, ports: MariaHillPorts) {
  if (
    !(s.environments || []).some(
      (p) => p.code === "50032" && !isTextBlank(s, p),
    )
  )
    return;
  const p = s.player.deck.shift();
  if (!p) return;
  p.mariaControlled = true;
  p.damage = 0;
  p.counters = 0;
  p.exhausted = false;
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  ports.hidden(s);
  ports.recycle(s);
}
export function resolveMariaHillEffect(
  s: GameState,
  e: Effect,
  ports: MariaHillPorts,
): boolean {
  if (!e.type.startsWith("maria:")) return false;
  const p = e.id ? ports.find(s, e.id) : undefined;
  const chooseTargets = (
    title: string,
    list: { id: string; label: string; code?: string }[],
    action: Effect,
  ) => {
    if (list.length)
      ports.choose(
        s,
        title,
        "Choose a card.",
        list.map((t) =>
          O(t.id, t.label, [{ ...action, target: t.id }], t.code),
        ),
      );
  };
  const supportTargets = (list = mariaHillSupports(s)) =>
    list.map((q) => ({ id: q.id, label: card(q).name, code: q.code }));
  switch (e.type.slice(6)) {
    case "search": {
      need(
        !s.player.exhausted && s.player.form === "alter",
        "Maria Hill is unavailable.",
      );
      s.player.exhausted = true;
      ports.hidden(s);
      chooseTargets(
        "Maria Hill",
        s.player.deck
          .filter(
            (q) =>
              card(q).type_code === "support" &&
              printedTraits(q).includes(normalize("S.H.I.E.L.D.")),
          )
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        M("search-take"),
      );
      break;
    }
    case "search-take": {
      const i = s.player.deck.findIndex((q) => q.id === e.target);
      need(i >= 0, "The searched support is unavailable.");
      s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shuffle(s);
      break;
    }
    case "move-from":
      chooseTargets(
        "Reassignment · source",
        supportTargets(mariaHillSupports(s).filter((q) => q.counters > 0)),
        M("move-to"),
      );
      break;
    case "move-to":
      chooseTargets(
        "Reassignment · destination",
        supportTargets(mariaHillSupports(s).filter((q) => q.id !== e.target)),
        M("move-commit", { from: e.target }),
      );
      break;
    case "move-commit": {
      const from = ports.find(s, e.from),
        to = ports.find(s, e.target);
      need(
        from &&
          to &&
          from.counters > 0 &&
          s.flags.mariaReassignment !== s.round,
        "Reassignment is unavailable.",
      );
      s.flags.mariaReassignment = s.round;
      to!.counters++;
      mariaHillChangeCounters(s, from!, -1, ports);
      break;
    }
    case "director":
      need(p && !p.exhausted, "Director is unavailable.");
      p!.exhausted = true;
      ports.queue(s, M("counter-target"));
      break;
    case "counter-target":
      chooseTargets(
        "Place 1 all-purpose counter",
        supportTargets(),
        M("add-counter"),
      );
      break;
    case "add-counter": {
      const q = ports.find(s, e.target);
      if (q && card(q).type_code === "support") q.counters++;
      break;
    }
    case "ready-one":
      chooseTargets(
        "Ready a S.H.I.E.L.D. support",
        supportTargets(
          mariaHillSupports(s).filter(
            (q) => q.exhausted && ports.canReady(s, q.id),
          ),
        ),
        E("ready"),
      );
      break;
    case "support-budget": {
      const ids = e.ids as string[],
        budget = Number(e.budget);
      const possible = mariaHillSupports(s).filter(
        (q) =>
          !ids.includes(q.id) &&
          (card(q).cost || 0) <= budget &&
          (e.kind !== "ready" || (q.exhausted && ports.canReady(s, q.id))),
      );
      ports.choose(
        s,
        e.kind === "ready" ? "On the Double" : "Reinforcements",
        `Choose supports with ${budget} printed cost remaining.`,
        [
          ...possible.map((q) =>
            O(
              q.id,
              card(q).name,
              [
                M("support-budget", {
                  ...e,
                  type: undefined,
                  ids: [...ids, q.id],
                  budget: budget - (card(q).cost || 0),
                }),
              ],
              q.code,
            ),
          ),
          O("done", "Finish selection", [
            M("support-budget-commit", { ids, kind: e.kind }),
          ]),
        ],
      );
      break;
    }
    case "support-budget-commit":
      for (const id of e.ids) {
        const q = ports.find(s, id);
        if (q) {
          if (e.kind === "ready") ports.ready(s, id);
          else q.counters++;
        }
      }
      break;
    case "bulletin": {
      const n = e.start ? mariaHillSupports(s, true).length : e.remaining;
      if (n <= 0) break;
      ports.choose(
        s,
        "All-Points Bulletin",
        `${n} support effect(s) remaining.`,
        [
          ...ports
            .enemies(s)
            .map((t) =>
              O(
                `damage:${t.id}`,
                `Deal 1 damage to ${t.label}`,
                [
                  E("damage", { target: t.id, amount: 1 }),
                  M("bulletin", { remaining: n - 1 }),
                ],
                t.code,
              ),
            ),
          ...ports
            .schemes(s)
            .map((t) =>
              O(
                `threat:${t.id}`,
                `Remove 1 threat from ${t.label}`,
                [
                  E("thwart", { target: t.id, amount: 1, action: false }),
                  M("bulletin", { remaining: n - 1 }),
                ],
                t.code,
              ),
            ),
        ],
      );
      break;
    }
    case "hard-call":
      chooseTargets(
        "The Hard Call · discard a support",
        supportTargets(mariaHillSupports(s, true)),
        M("hard-discard"),
      );
      break;
    case "hard-discard": {
      const q = ports.find(s, e.target);
      need(
        q && mariaHillSupports(s, true).some((p) => p.id === q.id),
        "Choose your own S.H.I.E.L.D. support.",
      );
      const n = card(q!).cost || 0;
      ports.discard(s, q!.id);
      ports.batch(
        s,
        [s.villain, ...s.minions].map((p) => p.id),
        n,
        s.currentEventId || "hero",
      );
      break;
    }
    case "support-action": {
      need(p && !p.exhausted && p.counters > 0, "Support is unavailable.");
      p!.exhausted = true;
      const code = p!.code;
      mariaHillChangeCounters(s, p!, -1, ports);
      if (code === "50009")
        ports.choose(s, "The Iliad", "Choose an effect.", [
          O("damage", "Deal 5 damage", [M("iliad-damage")]),
          O("thwart", "Remove 4 threat", [M("iliad-thwart")]),
          O("heal", "Heal an identity by 3", [M("iliad-heal")]),
        ]);
      if (code === "50016")
        chooseTargets(
          "Command Team",
          ports
            .characters(s)
            .filter(
              (t) =>
                card(ports.find(s, t.id) || "")?.type_code === "ally" &&
                ports.canReady(s, t.id),
            ),
          E("ready"),
        );
      if (code === "50017") ports.queue(s, M("circe-player"));
      if (code === "50018") ports.queue(s, M("bellerophon-player"));
      if (code === "50019")
        ports.queue(
          s,
          ...["main", ...s.sideSchemes.map((q) => q.id)].map((target) =>
            E("thwart", {
              target,
              amount: 2,
              ignoreCrisis: true,
              action: false,
            }),
          ),
        );
      if (code === "50020") ports.queue(s, M("pericles", { step: 0 }));
      break;
    }
    case "iliad-damage":
      chooseTargets("The Iliad", ports.enemies(s), E("damage", { amount: 5 }));
      break;
    case "iliad-thwart":
      chooseTargets(
        "The Iliad",
        ports.schemes(s),
        E("thwart", { amount: 4, action: false }),
      );
      break;
    case "iliad-heal":
      chooseTargets(
        "The Iliad",
        playerOrder(s).map((seat) => ({
          id: `hero:${seat.id}`,
          label: seat.heroId,
        })),
        E("heal", { amount: 3 }),
      );
      break;
    case "circe-player":
    case "bellerophon-player":
      chooseTargets(
        card(e.type.endsWith("circe-player") ? "50017" : "50018").name,
        playerOrder(s)
          .filter(
            (seat) =>
              !e.type.endsWith("circe-player") ||
              seatView(s, seat).player.hand.some(
                (q) =>
                  card(q).type_code === "ally" &&
                  ports.canPut(seatView(s, seat), q),
              ),
          )
          .map((seat) => ({ id: seat.id, label: seat.heroId })),
        M(
          e.type.endsWith("circe-player") ? "circe-ally" : "bellerophon-damage",
        ),
      );
      break;
    case "circe-ally": {
      const v = seatView(s, e.target);
      chooseTargets(
        "The Circe",
        v.player.hand
          .filter((q) => card(q).type_code === "ally" && ports.canPut(v, q))
          .map((q) => ({ id: q.id, label: card(q).name, code: q.code })),
        M("circe-put", { playerId: e.target }),
      );
      break;
    }
    case "circe-put": {
      const v = seatView(s, e.playerId),
        q = v.player.hand.find((q) => q.id === e.target);
      need(q && ports.canPut(v, q), "The chosen ally is unavailable.");
      ports.put(s, q!, e.playerId);
      break;
    }
    case "bellerophon-damage": {
      const ids = [
        s.villain.id,
        ...s.minions
          .filter((q) => (q.engagedWith || s.activePlayerId) === e.target)
          .map((q) => q.id),
      ];
      for (const id of ids) ports.removeTough(s, id);
      ports.batch(s, ids, 3, "The Bellerophon");
      break;
    }
    case "pericles": {
      const list =
        e.step === 0
          ? [
              ...playerOrder(s)
                .filter((seat) => seatView(s, seat).player.form === "hero")
                .map((seat) => ({
                  id: `hero:${seat.id}`,
                  label: seat.heroId,
                })),
              { id: s.villain.id, label: card(s.villain).name },
            ]
          : [
              ...allInPlay(s).filter((q) => card(q).type_code === "ally"),
              ...s.minions,
            ].map((q) => ({ id: q.id, label: card(q).name, code: q.code }));
      const eligible = list.filter((q) =>
        (["stunned", "confused", "tough"] as const).some((status) =>
          ports.canStatus(s, q.id, status),
        ),
      );
      if (eligible.length)
        chooseTargets(
          "The Pericles",
          eligible,
          M("pericles-status", { step: e.step }),
        );
      else if (e.step === 0) ports.queue(s, M("pericles", { step: 1 }));
      break;
    }
    case "pericles-status":
      ports.choose(
        s,
        "The Pericles",
        "Choose a status card.",
        (["stunned", "confused", "tough"] as const)
          .filter((status) => ports.canStatus(s, e.target, status))
          .map((status) =>
            O(status, status, [
              E("status", { target: e.target, status }),
              ...(e.step === 0 ? [M("pericles", { step: 1 })] : []),
            ]),
          ),
      );
      break;
    case "control-support": {
      if (!p) break;
      const eligible = playerOrder(s).filter(
        (seat) =>
          !seatView(s, seat).player.inPlay.some(
            (q) =>
              q.id !== p.id &&
              (p.code === "50028"
                ? q.code === "50028"
                : printedTraits(q).includes("team")),
          ),
      );
      chooseTargets(
        card(p).name,
        eligible.map((seat) => ({ id: seat.id, label: seat.heroId })),
        M("support-controller", { id: p.id }),
      );
      break;
    }
    case "support-controller": {
      need(p, "Support is unavailable.");
      for (const seat of s.players) {
        const zone = seatView(s, seat).player.inPlay;
        const i = zone.findIndex((q) => q.id === p!.id);
        if (i >= 0) zone.splice(i, 1);
      }
      seatView(s, e.target).player.inPlay.push(p!);
      break;
    }
    case "slingshot":
      ports.requestPayment(
        s,
        "Slingshot",
        1,
        ["energy"],
        [M("slingshot-player", { id: e.id })],
      );
      break;
    case "slingshot-player":
      chooseTargets(
        "Slingshot",
        playerOrder(s).map((seat) => ({ id: seat.id, label: seat.heroId })),
        M("slingshot-put", { id: e.id }),
      );
      break;
    case "slingshot-put": {
      const q = s.player.hand.find((q) => q.id === e.id && q.code === "50013");
      need(
        q && ports.canPut(seatView(s, e.target), q),
        "Slingshot cannot enter play.",
      );
      globalFlags(s)[`mariaSlingshot:${q!.id}`] = true;
      ports.put(s, q!, e.target);
      break;
    }
    case "slingshot-return": {
      if (!p) break;
      delete globalFlags(s)[`mariaSlingshot:${p.id}`];
      const owner =
        s.players.find((seat) => seat.id === p.ownerId) || controller(s, p.id);
      ports.discard(s, p.id);
      if (owner) {
        const v = seatView(s, owner),
          i = v.player.discard.findIndex((q) => q.id === p.id);
        if (i >= 0) v.player.hand.push(v.player.discard.splice(i, 1)[0]);
      }
      break;
    }
    case "look-encounter": {
      const q = s.encounter.deck[0];
      if (q) {
        ports.hidden(s);
        s.encounter.knownTop = { id: q.id, playerId: s.activePlayerId };
        ports.choose(s, "Melinda May", `Top encounter card: ${card(q).name}`, [
          O(
            "discard",
            "Discard it",
            [M("discard-encounter", { id: q.id })],
            q.code,
          ),
          O("leave", "Leave it on top", []),
        ]);
      }
      break;
    }
    case "discard-encounter":
      if (s.encounter.deck[0]?.id === e.id)
        s.encounter.discard.push(ports.drawEncounter(s)!);
      break;
    case "ward":
      if (p) {
        ports.choose(
          s,
          "Grant Ward",
          "Spend a Mental resource or take his current ATK in damage and remove him.",
          [
            ...(ports.canPay(s, 1, ["mental"])
              ? [
                  O("pay", "Spend Mental", [
                    E("payRequest", {
                      title: "Grant Ward",
                      cost: 1,
                      requirements: ["mental"],
                      after: [],
                      cancelable: false,
                    }),
                  ]),
                ]
              : []),
            O("take", "Take damage and remove Grant Ward", [
              M("ward-fail", { id: p.id }),
            ]),
          ],
        );
      }
      break;
    case "ward-fail":
      if (p) {
        ports.queue(
          s,
          E("damage", {
            target: "hero",
            amount: ports.allyAttack(s, p),
            source: p.id,
          }),
          M("ward-remove", { id: p.id }),
        );
      }
      break;
    case "ward-remove":
      if (p) ports.remove(s, p.id);
      break;
    case "lmd":
      need(p, "Life Model Decoy is unavailable.");
      ports.discard(s, p!.id);
      if (s.attack) s.attack.preventAllDamage = true;
      ports.queue(s, ...e.after);
      break;
    case "team-cancel":
      need(p && !p.exhausted, "Agents of S.H.I.E.L.D. is unavailable.");
      p!.exhausted = true;
      ports.cancelReveal(s, e.piece, [
        E("reveal", {
          piece: ports.drawEncounter(s),
          actorId: s.activePlayerId,
        }),
      ]);
      break;
    case "front-window": {
      const target = ports.find(s, e.target);
      if (!target) {
        ports.queue(s, ...(e.after || []));
        break;
      }
      const options = mariaHillFrontOptions(s, target, e.after || []);
      if (options.length)
        ports.choose(
          s,
          "Front Organization",
          "Discard Front Organization instead of the card this encounter effect would discard?",
          [
            ...options,
            O("allow", "Discard the original card", [
              M("front-original", { target: target.id, after: e.after || [] }),
            ]),
          ],
        );
      else {
        ports.discard(s, target.id);
        ports.queue(s, ...(e.after || []));
      }
      break;
    }
    case "front-original":
      ports.discard(s, e.target);
      ports.queue(s, ...(e.after || []));
      break;
    case "front-replace":
      if (p) ports.discard(s, p.id);
      ports.queue(s, ...e.after);
      break;
    case "obligation":
      ports.keepObligation(s, e.piece);
      break;
    case "obligation-discard":
      need(
        p && s.player.form === "alter" && !s.player.exhausted,
        "Press Conference requires a ready alter ego.",
      );
      s.player.exhausted = true;
      ports.discard(s, p!.id);
      break;
    case "press":
      for (const q of [...s.player.inPlay].filter(
        (q) => card(q).type_code === "support" && q.counters > 0,
      ))
        mariaHillChangeCounters(s, q, -1, ports);
      break;
    case "controller": {
      const supports = allInPlay(s).filter(
        (q) => card(q).type_code === "support" && q.counters > 0,
      );
      if (supports.length)
        chooseTargets(
          "Remove 1 all-purpose counter",
          supportTargets(supports),
          M("controller-remove"),
        );
      else mariaHillControlled(s, ports);
      break;
    }
    case "controller-remove": {
      const q = ports.find(s, e.target);
      if (q) mariaHillChangeCounters(s, q, -1, ports);
      mariaHillControlled(s, ports);
      break;
    }
    case "find-environment": {
      for (const zone of [
        s.encounter.deck,
        s.encounter.discard,
        ...playerOrder(s).map(
          (seat) => seatView(s, seat).player.setAside || [],
        ),
      ]) {
        const i = zone.findIndex((q) => q.code === "50032");
        if (i >= 0) {
          const q = zone.splice(i, 1)[0];
          (s.environments ||= []).push(q);
          break;
        }
      }
      break;
    }
    case "army-defeated": {
      const controlled = s.minions.filter(
        (q) => q.mariaControlled || printedTraits(q).includes("controlled"),
      );
      for (const q of controlled) ports.discard(s, q.id);
      for (let i = 0; i < controlled.length; i++)
        ports.queue(s, M("any-support-counter"));
      break;
    }
    case "any-support-counter":
      chooseTargets(
        "Army of the Controlled",
        supportTargets(
          allInPlay(s).filter((q) => card(q).type_code === "support"),
        ),
        M("add-counter"),
      );
      break;
    case "shadows": {
      const zone = s.player.setAside || [],
        pieces: Piece[] = [];
      for (const code of ["50030", "50031", "50032", "50033", "50033"]) {
        const i = zone.findIndex((q) => q.code === code);
        if (i >= 0) pieces.push(zone.splice(i, 1)[0]);
      }
      const minion = pieces.find((q) => q.code === "50030"),
        scheme = pieces.find((q) => q.code === "50031");
      if (minion) {
        minion.engagedWith = s.activePlayerId;
        s.minions.push(minion);
      } else ports.queue(s, E("surge", { sourceCode: "01190" }));
      if (scheme) ports.queue(s, E("reveal", { piece: scheme }));
      s.encounter.deck.push(
        ...pieces.filter((q) => q.id !== minion?.id && q.id !== scheme?.id),
      );
      ports.shuffleEncounter(s);
      break;
    }
    case "org-choose": {
      const ids = e.ids as string[],
        possible = mariaHillOrgEligible(s, ports).filter(
          (q) => !ids.includes(q.id),
        );
      ports.choose(
        s,
        "Organizational Support",
        `Choose up to 3 ready allies or supports sharing an identity trait (${ids.length} selected).`,
        [
          ...(ids.length < 3
            ? possible.map((q) =>
                O(
                  q.id,
                  card(q).name,
                  [
                    M("org-choose", {
                      ...e,
                      type: undefined,
                      ids: [...ids, q.id],
                    }),
                  ],
                  q.code,
                ),
              )
            : []),
          O("done", "Finish resource generation", [
            M("org-save", { ...e, type: undefined }),
          ]),
        ],
      );
      break;
    }
    case "org-save": {
      const pieces = (e.ids as string[]).map((id) => ports.find(s, id)!);
      s.flags[orgKey(e.id)] = JSON.stringify({
        ids: e.ids,
        resources: pieces.flatMap(printedResources),
      });
      ports.restorePayment(s, e.payment, e.queue, e.returnActor);
      break;
    }
    default:
      throw Error(`Unknown Maria Hill effect: ${e.type}`);
  }
  return true;
}

/** Actual physical Special Funding sources allocated to the cost, excluding overpayment. */
export function mariaHillFundingAllocations(
  selected: PaymentSource[],
  cost: number,
  requirements: Resource[],
  wildAs: Resource,
  paid?: Resource[],
  generated?: Resource[],
  declared?: Resource[],
  allocate?: (
    resources: Resource[],
    cost: number,
    requirements: Resource[],
    wildAs: Resource,
  ) => Resource[][],
): string[][] {
  const key = (rs: Resource[]) => [...rs].sort().join(":");
  type Receipt = { rs: Resource[]; declared: Resource[]; ids: string[] };
  let states = new Map<string, Receipt>([
    ["", { rs: [], declared: [], ids: [] }],
  ]);
  let i = 0;
  for (const source of selected)
    for (const r of source.resources) {
      const assignment = declared?.[i++],
        next = new Map(states);
      for (const state of states.values()) {
        if (state.rs.length >= cost) continue;
        const ids =
          source.kind === "card" && source.code === "50007"
            ? [...new Set([...state.ids, source.id])].sort()
            : state.ids;
        const rs = [...state.rs, r],
          ds = assignment ? [...state.declared, assignment] : state.declared;
        next.set(`${ids.join(",")}|${key(rs)}|${key(ds)}`, {
          rs,
          declared: ds,
          ids,
        });
      }
      states = next;
    }
  const choices = new Map<string, string[]>();
  for (const state of states.values()) {
    if (
      state.rs.length !== cost ||
      (generated && key(state.rs) !== key(generated))
    )
      continue;
    const allocations = declared
      ? [state.declared]
      : allocate
        ? allocate(state.rs, cost, requirements, wildAs)
        : [];
    if (allocations.some((a) => !paid || key(a) === key(paid)))
      choices.set(state.ids.join(","), state.ids);
  }
  return [...choices.values()];
}
export function mariaHillRecordFunding(
  s: GameState,
  target: Piece,
  selected: PaymentSource[],
  ids: string[],
) {
  if (
    card(target).type_code !== "support" ||
    !printedTraits(target).includes(normalize("S.H.I.E.L.D."))
  )
    return;
  globalFlags(s)[`mariaFunding:${target.id}`] = JSON.stringify(
    ids.map((id) => {
      const source = selected.find((q) => q.id === id)!;
      return {
        id: source.localId || id,
        actorId: source.playerId || s.activePlayerId,
      };
    }),
  );
}
export function mariaHillControlledDefeated(s: GameState, p: Piece): Effect[] {
  return (p.mariaControlled || printedTraits(p).includes("controlled")) &&
    (s.environments || []).some((q) => q.code === "50032" && !isTextBlank(s, q))
    ? [E("threat", { target: "main", amount: 1 })]
    : [];
}
