import { consumeStatus } from "./keywords.js";
import { card } from "./card-definitions.js";
import { isTextBlank, eventPlaySources } from "./card-text.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
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

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`psylocke:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const optional = (title: string, effects: Effect[]) =>
  E("optional", { title, text: `Use ${title}?`, effects });
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const active = (s: GameState) => s.heroId === "psylocke";
const trait = (p: Piece | string, t: string) =>
  (card(p)?.traits || "").split(/\.\s*/).includes(t);
const enemy = (s: GameState, id: string) =>
  id === s.villain.id ? s.villain : s.minions.find((p) => p.id === id);
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
export const PSYLOCKE_SCRIPT_CODES = [
  "41001a",
  "41001b",
  "41002a",
  "41002b",
  ...Array.from(
    { length: 31 },
    (_, i) => `410${String(i + 3).padStart(2, "0")}`,
  ),
  "42021",
];
export const PSYLOCKE_SOURCE = "https://hallofheroeslcg.com/psylocke/";
export interface PsylockePorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  cardCost(s: GameState, p: Piece): number;
  pay(
    s: GameState,
    title: string,
    cost: number,
    req: Resource[],
    after: Effect[],
  ): void;
  playReaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
  ): void;
  shufflePlayer(s: GameState, after: Effect[]): void;
  shuffleEncounter(s: GameState): void;
  discardTop(s: GameState): { piece?: Piece; emptied: boolean };
  friendlyTargets(s: GameState): AntManTarget[];
  transferControl(s: GameState, id: string, playerId: string): void;
  dealEncounter(s: GameState, playerId: string): void;
  indirect(s: GameState, amount: number, source: string): void;
  keyword(s: GameState, id: string, name: string): boolean;
  prevent(s: GameState, packet: Effect, amount: number): void;
  declareDefense(s: GameState): void;
}

export const psiEnergy = (s: GameState) =>
  s.player.inPlay.filter((p) => ["41002a", "41002b"].includes(p.code));
const bodySwapped = (s: GameState) => live(s, "41025").length > 0;
export const psylockeCanFlip = (s: GameState, p: Piece) =>
  p.code === "41002a" || (p.code === "41002b" && !bodySwapped(s));
export function psylockeInitialize(
  s: GameState,
  ports: Pick<PsylockePorts, "makePiece">,
) {
  if (!active(s) || s.flags.psylockeInitialized) return;
  const zones = [
    s.player.deck,
    s.player.hand,
    s.player.discard,
    s.player.inPlay,
    (s.player.setAside ||= []),
  ];
  const weapons = zones
    .flat()
    .filter((p) => ["41002a", "41002b"].includes(p.code));
  need(
    weapons.length <= 2,
    "Psylocke owns exactly two physical Psi-Energy upgrades.",
  );
  while (weapons.length < 2) weapons.push(ports.makePiece(s, "41002a"));
  for (const p of weapons) {
    for (const z of zones) {
      const i = z.findIndex((q) => q.id === p.id);
      if (i >= 0) z.splice(i, 1);
    }
    p.code = "41002a";
    p.ownerId = s.activePlayerId;
    s.player.setAside.push(p);
  }
  for (const code of ["41026", "41027", "41028", "41029", "41029"]) {
    const p = ports.makePiece(s, code);
    p.ownerId = s.activePlayerId;
    s.player.setAside.push(p);
  }
  s.flags.psylockeInitialized = true;
}
export function psylockeSetup(s: GameState): Effect[] {
  if (!active(s)) return [];
  const z = s.player.setAside || [];
  for (const p of [...z].filter((p) => p.code === "41002a"))
    s.player.inPlay.push(z.splice(z.indexOf(p), 1)[0]);
  return [];
}
export function psylockeStats(s: GameState) {
  const hero = active(s) && s.player.form === "hero";
  return {
    attack: hero ? live(s, "41002b").length : 0,
    thwart: hero ? live(s, "41002a").length : 0,
    defense: hero ? live(s, "41009").length : 0,
    piercing: hero && live(s, "41002b").length > 0,
    retaliate: hero ? live(s, "41011").length : 0,
  };
}
export const psylockeIgnoresGuardPatrol = (s: GameState) =>
  active(s) && s.player.form === "hero" && !!live(s, "41010").length;
export function psylockeBasicOptions(s: GameState, packet: Effect): Option[] {
  if (
    !active(s) ||
    s.player.form !== "hero" ||
    isTextBlank(s, "41001a") ||
    packet.psylockeBasicHandled
  )
    return [];
  return psiEnergy(s)
    .filter((p) => psylockeCanFlip(s, p))
    .map((p) =>
      O(
        p.id,
        `Flip ${card(p).name}`,
        [P("flip", { id: p.id }), { ...packet, psylockeBasicHandled: true }],
        p.code,
      ),
    );
}
export function psylockeResourceSources(s: GameState): PaymentSource[] {
  if (s.player.form !== "hero") return [];
  return psiEnergy(s)
    .filter((p) => !p.exhausted && !isTextBlank(s, p))
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      resources: [p.code === "41002a" ? "mental" : "physical"],
      kind: "ability",
      description:
        "Exhaust to generate the printed resource; optionally flip this physical upgrade.",
    }));
}
export const psylockeIsResource = (s: GameState, id: string) =>
  psiEnergy(s).some((p) => p.id === id);
export function psylockeResourceSpent(s: GameState, id: string): Effect[] {
  const p = own(s, id);
  need(
    p && psylockeResourceSources(s).some((q) => q.id === id),
    "Psi-Energy resource is unavailable.",
  );
  p!.exhausted = true;
  return psylockeCanFlip(s, p!)
    ? [optional(card(p!).name, [P("flip", { id })])]
    : [];
}
export function psylockePowerOfMind(
  c: Card,
  target?: Card,
): Resource[] | undefined {
  if (!["41021", "40028"].includes(c.code)) return undefined;
  return target?.traits?.split(/\.\s*/).includes("Psionic")
    ? ["mental", "mental"]
    : ["mental"];
}
function reaction(
  s: GameState,
  code: string,
  action: Effect,
  after: Effect[],
  ports: PsylockePorts,
): Option[] {
  if (s.player.form !== "hero") return [];
  return eventPlaySources(s)
    .filter(
      (p) =>
        p.code === code &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code),
    )
    .map((p) =>
      O(
        p.id,
        `Play ${card(p).name}`,
        [P("reaction", { id: p.id, action, after })],
        p.code,
      ),
    );
}
export function psylockePlayRestriction(
  s: GameState,
  p: Piece,
  ports: PsylockePorts,
): string | undefined {
  if (["41006", "41007", "41015", "41019", "41032"].includes(p.code))
    return "Play this event in its printed interrupt or response window.";
  if (
    ["41018", "41022"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "X-Force")
  )
    return "This card requires an X-Force identity.";
  if (
    ["41024", "41030", "41032", "41033"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "Psionic")
  )
    return "This card requires a Psionic identity.";
  if (["41024", "41033"].includes(p.code) && live(s, p.code).length)
    return "Max 1 per player.";
  if (
    p.code === "41017" &&
    playerOrder(s).every((seat) => live(seatView(s, seat), p.code).length)
  )
    return "Every player already controls Float Like a Butterfly.";
  if (
    ["41020", "42021"].includes(p.code) &&
    (!["psylocke", "angel"].includes(s.heroId) ||
      teamCharacters(s).length !== 2)
  )
    return "Soaring Hearts requires your Angel or Psylocke hero and both characters in play.";
  return undefined;
}
function teamCharacters(s: GameState): AntManTarget[] {
  return ["angel", "psylocke"].flatMap((name) => {
    const seat = playerOrder(s).find(
      (p) => p.heroId === name && seatView(s, p).player.form === "hero",
    );
    if (seat) return [{ id: `hero:${seat.id}`, label: name }];
    const ally = allInPlay(s).find(
      (p) =>
        card(p).type_code === "ally" && card(p).name.toLowerCase() === name,
    );
    return ally ? [{ id: ally.id, label: card(ally).name }] : [];
  });
}
export function psylockeEvent(
  _s: GameState,
  p: Piece,
  paid: Resource[] = [],
): Effect[] | null {
  return ["41004", "41005", "41014", "41020", "42021", "41030"].includes(p.code)
    ? [P("event", { piece: p, paid })]
    : ["41006", "41007", "41015", "41019", "41032"].includes(p.code)
      ? []
      : null;
}
export function psylockeCardEntered(
  s: GameState,
  p: Piece,
  fromHand = false,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "41003" && fromHand)
    return [optional("Angel", [E("ready", { target: "hero" })])];
  if (p.code === "41017") return [P("control", { id: p.id })];
  return [];
}
export function psylockeAbilityOptions(
  s: GameState,
  id: string,
  ports: PsylockePorts,
): Option[] {
  if (id === "identity")
    return active(s) &&
      s.player.form === "alter" &&
      !isTextBlank(s, "41001b") &&
      s.player.discard.some((p) => trait(p, "Psionic"))
      ? psiEnergy(s)
          .filter((p) => !p.exhausted)
          .map((p) =>
            O(
              p.id,
              `Psionic Manifestation · exhaust ${card(p).name}`,
              [P("manifest", { id: p.id })],
              p.code,
            ),
          )
      : [];
  const p = own(s, id);
  if (!p || isTextBlank(s, p)) return [];
  if (p.code === "41025")
    return s.player.form === "alter" &&
      s.player.hand.some((q) => trait(q, "Psionic"))
      ? [
          O(
            "discard",
            "Discard a Psionic card to discard Body Swapped",
            [P("obligation-remove", { id })],
            p.code,
          ),
        ]
      : [];
  if (p.exhausted) return [];
  if (p.code === "41008")
    return [
      O(
        "search",
        "Search the deck for a Skill",
        [P("regimen", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "41022" &&
    s.player.form === "hero" &&
    (s.encounter.deck.length || s.encounter.discard.length)
  )
    return [
      O(
        "ipac",
        "Deal an encounter card and draw 2",
        [P("ipac", { id })],
        p.code,
      ),
    ];
  if (
    p.code === "41023" &&
    (s.victoryDisplay || []).some((q) =>
      ["side_scheme", "player_side_scheme"].includes(card(q).type_code),
    ) &&
    playerOrder(s).some((seat) =>
      ports.hasTrait(s, `hero:${seat.id}`, "Mutant"),
    )
  )
    return [O("search", "Search with X-Bunker", [P("bunker", { id })], p.code)];
  if (
    ["41024", "41033"].includes(p.code) &&
    s.player.form === "hero" &&
    ports.canPay(s, 2, ["mental", "mental"]) &&
    (p.code === "41024"
      ? ports.schemeTargets(s, true)
      : ports.enemyTargets(s, true)
    ).length
  )
    return [
      O(
        "special",
        p.code === "41024"
          ? "Telepathy · remove 2 threat"
          : "Telekinesis · deal 3 damage",
        [P("superpower", { id })],
        p.code,
      ),
    ];
  return [];
}
export function psylockeAbility(
  s: GameState,
  id: string,
  action: string,
  ports: PsylockePorts,
): Effect[] | null {
  if (
    id !== "identity" &&
    !["41008", "41022", "41023", "41024", "41025", "41033"].includes(
      own(s, id)?.code || "",
    )
  )
    return null;
  if (id === "identity" && !active(s)) return null;
  const opts = psylockeAbilityOptions(s, id, ports),
    selected =
      opts.find((o) => o.id === action) ||
      (action === "special" ? opts[0] : undefined);
  need(selected, "This Psylocke ability is unavailable.");
  return selected!.effects;
}
export function psylockeDamageBonus(
  s: GameState,
  source: string,
  target: string,
): number {
  const victim = enemy(s, target);
  if (!victim?.confused) return 0;
  const owner =
    source === "hero"
      ? s.activePlayerId
      : source.startsWith("hero:")
        ? source.slice(5)
        : controller(s, source)?.id;
  return owner && live(seatView(s, owner), "41017").length ? 1 : 0;
}
export function psylockeAttackOptions(
  s: GameState,
  packet: Effect,
  ports: PsylockePorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    s.player.stunned ||
    (packet.source && packet.source !== "hero")
  )
    return [];
  const token = packet.psylockeToken;
  const keyword =
    packet.overkill ||
    packet.piercing ||
    packet.ranged ||
    (packet.basic && psylockeStats(s).piercing) ||
    ["Overkill", "Piercing", "Ranged"].some((k) => ports.keyword(s, "hero", k));
  return keyword && !s.flags[`psylockeDirected:${token}`]
    ? reaction(s, "41019", P("directed", { packet }), [], ports)
    : [];
}
export function psylockeAttackFinished(
  s: GameState,
  receipt: Effect,
  ports: PsylockePorts,
): Effect[] {
  const effects: Effect[] = [];
  if (active(s) && s.player.form === "hero")
    for (const p of live(s, "41011"))
      if (s.player.inPlay.some((q) => trait(q, "Weapon") && q.exhausted))
        effects.push(
          optional("Weapons Training", [P("weapons-ready", { id: p.id })]),
        );
  if (
    receipt.draxBasicAttack &&
    receipt.actualDamage > 0 &&
    enemy(s, receipt.target)
  )
    effects.push(P("upside-window", { target: receipt.target }));
  return effects;
}
export function psylockeThwartFinished(s: GameState): Effect[] {
  return active(s) && s.player.form === "hero"
    ? live(s, "41010").map((p) =>
        optional("Psionic Training", [P("psionic-training", { id: p.id })]),
      )
    : [];
}
export function psylockeDefenseFinished(s: GameState, e: Effect): Effect[] {
  const effects: Effect[] = [];
  if (e.snapshot?.heroDefended && s.player.form === "hero") {
    if (active(s))
      for (const p of live(s, "41009"))
        effects.push(
          optional("Martial Arts Training", [P("martial", { id: p.id })]),
        );
    if (enemy(s, e.attacker))
      effects.push(P("flail-window", { target: e.attacker }));
  }
  const ally = allInPlay(s).find((p) => p.id === e.snapshot?.defender);
  if (
    e.snapshot?.basicDefense === false &&
    ally?.code === "41031" &&
    !isTextBlank(s, ally)
  )
    effects.push(...psylockeAllyUsed(s, ally));
  return effects;
}
export function psylockeDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
  ports: PsylockePorts,
): Option[] {
  if (
    packet.amount <= 0 ||
    !["hero", `hero:${s.activePlayerId}`].includes(packet.target) ||
    s.player.tough
  )
    return [];
  return reaction(s, "41006", P("redirect", { packet }), after, ports);
}
export function psylockeRevealOptions(
  s: GameState,
  p: Piece,
  fromDeck: boolean,
  after: Effect[],
  ports: PsylockePorts,
): Option[] {
  return fromDeck && !/cannot be cancel(?:ed|led)/i.test(card(p).text || "")
    ? reaction(s, "41007", P("suggestion", { piece: p }), after, ports)
    : [];
}
export function psylockeTreacheryResolved(
  s: GameState,
  playerId: string,
): Effect[] {
  return live(seatView(s, playerId), "41018")
    .filter((p) => p.damage > 0)
    .map((p) => ({
      ...optional("Pete Wisdom", [E("heal", { target: p.id, amount: 1 })]),
      actorId: playerId,
    }));
}
export function psylockeAllyUsed(s: GameState, p: Piece): Effect[] {
  return p.code === "41031" &&
    !isTextBlank(s, p) &&
    s.player.hand.length &&
    s.player.deck.length
    ? [optional("Domino", [P("swap")])]
    : [];
}
export function psylockeConsequence(
  s: GameState,
  p: Piece,
  target: string,
  attack: boolean,
): number {
  return p.code === "41012" &&
    !isTextBlank(s, p) &&
    (attack ? target !== s.villain.id : target !== "main")
    ? 1
    : 0;
}
export function psylockeCypher(
  s: GameState,
  p: Piece,
  confused: boolean,
  damage: number,
): Effect[] {
  return p.code === "41013" && !isTextBlank(s, p) && confused && damage > 0
    ? [optional("Cypher", [E("draw", { amount: 1 })])]
    : [];
}
export function psylockeSideSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  return p.code === "41016" && !isTextBlank(s, p)
    ? [
        E("damage", {
          target: s.villain.id,
          amount: 5 * s.playerCount,
          source: p.id,
          actorId: playerId,
        }),
      ]
    : [];
}
export function psylockeMentalIcons(s: GameState): number {
  const controlledSchemes = s.sideSchemes.filter(
    (p) =>
      card(p).type_code === "player_side_scheme" &&
      ((p as Piece & { playerSideSchemeController?: string })
        .playerSideSchemeController || p.ownerId) === s.activePlayerId,
  );
  return [...s.player.inPlay, ...controlledSchemes].reduce(
    (n, p) => n + (card(p).resource_mental || 0),
    0,
  );
}
export function psylockeActivationBonus(s: GameState, id: string): number {
  const p = s.minions.find((p) => p.id === id);
  return p?.code === "41026" && !isTextBlank(s, p) ? psylockeMentalIcons(s) : 0;
}
export function psylockeIllusion(
  s: GameState,
  packet: Effect,
): Effect[] | null {
  if (
    (!packet.attack && !packet.psylockeAttackChoice) ||
    packet.psylockeIllusionHandled ||
    s.player.stunned ||
    (packet.source && packet.source !== "hero") ||
    !enemy(s, packet.target)
  )
    return null;
  const token =
    packet.attackProgramId ||
    s.currentAttackProgramId ||
    packet.eventId ||
    s.currentEventId ||
    packet.psylockeToken;
  const p = s.attachments.find(
    (p) =>
      p.code === "41028" &&
      p.attachedTo === `hero:${s.activePlayerId}` &&
      !isTextBlank(s, p),
  );
  if (!p || s.flags[`psylockeIllusionChecked:${token}:${packet.target}`])
    return null;
  return [P("illusion", { id: p.id, packet, token })];
}
export function psylockeEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (!["41025", "41026", "41027", "41028", "41029"].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  if (p.code === "41025") return [P("obligation", { piece: p })];
  if (p.code === "41027")
    return [
      E("threat", {
        target: p.id,
        amount: allInPlay(s).filter((q) => card(q).type_code === "upgrade")
          .length,
      }),
    ];
  if (p.code === "41028") return [P("illusion-attach", { piece: p })];
  if (p.code === "41029") return [P("dragon", { piece: p })];
  return [];
}
export function psylockeBoost(_s: GameState, p: Piece): Effect[] | null {
  return p.code === "41029" ? [P("dragon-boost")] : null;
}
export function psylockeShadowOfPast(s: GameState): Effect[] | null {
  return active(s) ? [P("shadows")] : null;
}
function select(
  s: GameState,
  title: string,
  targets: AntManTarget[],
  effect: Effect,
  ports: PsylockePorts,
  after: Effect[] = [],
) {
  if (!targets.length) {
    ports.queue(s, ...after);
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    targets.map((t) =>
      O(t.id, t.label, [{ ...effect, target: t.id }, ...after], t.code),
    ),
  );
}
export function resolvePsylockeEffect(
  s: GameState,
  e: Effect,
  ports: PsylockePorts,
): boolean {
  if (!e.type.startsWith("psylocke:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "psylocke:flip": {
      const p = own(s, e.id);
      need(
        p && psylockeCanFlip(s, p),
        "Body Swapped prevents this Psi-Katana from flipping.",
      );
      p!.code = p!.code === "41002a" ? "41002b" : "41002a";
      break;
    }
    case "psylocke:manifest": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.form === "alter",
        "Psionic Manifestation is unavailable.",
      );
      p!.exhausted = true;
      select(
        s,
        "Psionic Manifestation",
        s.player.discard
          .filter((p) => trait(p, "Psionic"))
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        P("return-deck"),
        ports,
      );
      break;
    }
    case "psylocke:return-deck": {
      const i = s.player.discard.findIndex((p) => p.id === e.target);
      need(i >= 0, "The actual discarded card is missing.");
      s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      ports.shufflePlayer(s, []);
      break;
    }
    case "psylocke:reaction": {
      const p = eventPlaySources(s).find((p) => p.id === e.id);
      need(p, "The actual reaction event is unavailable.");
      ports.playReaction(s, p!, [e.action], after);
      break;
    }
    case "psylocke:event": {
      const p = e.piece as Piece,
        knives = live(s, "41002a").length,
        katanas = live(s, "41002b").length;
      if (p.code === "41004")
        ports.attackProgram(
          s,
          [P("flurry", { knives, katanas, first: true })],
          [],
        );
      if (p.code === "41005" && s.player.confused) {
        consumeStatus(s.player, "confused");
        break;
      }
      if (p.code === "41005")
        select(
          s,
          "Mental Detection",
          ports.schemeTargets(s, true),
          P("detection", { amount: 1 + 2 * knives, draw: katanas }),
          ports,
        );
      if (p.code === "41014")
        ports.attackProgram(
          s,
          [P("concussive", { physical: (e.paid || []).includes("physical") })],
          [],
        );
      if (p.code === "41030")
        ports.attackProgram(
          s,
          [
            E("target", {
              group: "enemy",
              action: E("damage", { amount: 4, attack: true, ranged: true }),
            }),
          ],
          [],
        );
      if (["41020", "42021"].includes(p.code)) {
        const candidates = s.player.discard.filter(
          (q) => card(q).type_code === "event" && card(q).set_code === s.heroId,
        );
        const ready = teamCharacters(s).map((t) =>
          E("ready", { target: t.id }),
        );
        if (candidates.length)
          ports.choose(
            s,
            "Soaring Hearts",
            "Search for an identity-specific event.",
            [
              ...candidates.map((q) =>
                O(
                  q.id,
                  card(q).name,
                  [P("retrieve", { id: q.id }), ...ready],
                  q.code,
                ),
              ),
              O("fail", "Finish search without finding an event", ready),
            ],
          );
        else ports.queue(s, ...ready);
      }
      break;
    }
    case "psylocke:retrieve": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "psylocke:flurry": {
      if (e.first)
        select(
          s,
          "Flurry of Blades",
          ports.enemyTargets(s, true),
          E("damage", { amount: 2, attack: true }),
          ports,
          [{ ...e, first: false }],
        );
      else if (e.knives > 0)
        select(
          s,
          "Flurry of Blades · confuse",
          ports.enemyTargets(s, false),
          P("flurry-confuse"),
          ports,
          [{ ...e, knives: e.knives - 1 }],
        );
      else if (e.katanas > 0)
        select(
          s,
          "Flurry of Blades · damage",
          ports.enemyTargets(s, true),
          E("damage", {
            amount: 2,
            attack: true,
            attackAlreadyInitiated: true,
          }),
          ports,
          [{ ...e, katanas: e.katanas - 1 }],
        );
      break;
    }
    case "psylocke:flurry-confuse": {
      const packet = E("status", {
        target: e.target,
        status: "confused",
        psylockeAttackChoice: true,
        psylockeToken: s.currentAttackProgramId,
      });
      ports.queue(s, ...(psylockeIllusion(s, packet) || [packet]));
      break;
    }
    case "psylocke:concussive":
      select(
        s,
        "Concussive Blow",
        ports.enemyTargets(s, true),
        P("concussive-hit", { physical: e.physical }),
        ports,
      );
      break;
    case "psylocke:concussive-hit":
      ports.queue(
        s,
        E("status", { target: e.target, status: "confused" }),
        ...(e.physical
          ? [E("damage", { target: e.target, amount: 3, attack: true })]
          : []),
      );
      break;
    case "psylocke:detection":
      ports.queue(
        s,
        E("thwart", {
          target: e.target,
          amount: e.amount,
          action: true,
          thwartStatusChecked: true,
        }),
        ...(e.draw ? [E("draw", { amount: e.draw })] : []),
      );
      break;
    case "psylocke:redirect": {
      const amount = 2 + 2 * live(s, "41002b").length;
      ports.prevent(s, e.packet, amount);
      ports.declareDefense(s);
      const id = s.attack?.attacker || e.packet.attacker;
      if (id)
        ports.queue(
          s,
          ...live(s, "41002a").map(() =>
            E("status", { target: id, status: "confused" }),
          ),
        );
      break;
    }
    case "psylocke:suggestion":
      if (/When Revealed/i.test(card(e.piece).text || ""))
        s.flags[`ghostCancelReveal:${e.piece.id}`] = true;
      ports.queue(
        s,
        P("suggestion-damage", { count: live(s, "41002b").length }),
        P("suggestion-thwart", { count: live(s, "41002a").length }),
      );
      break;
    case "psylocke:suggestion-damage":
      if (e.count > 0)
        select(
          s,
          "Telepathic Suggestion",
          ports.enemyTargets(s, false),
          E("damage", { amount: 2 }),
          ports,
          [{ ...e, count: e.count - 1 }],
        );
      break;
    case "psylocke:suggestion-thwart":
      if (e.count > 0)
        select(
          s,
          "Telepathic Suggestion",
          ports.schemeTargets(s, false),
          E("thwart", { amount: 1 }),
          ports,
          [{ ...e, count: e.count - 1 }],
        );
      break;
    case "psylocke:regimen": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "Training Regimen is unavailable.");
      p!.exhausted = true;
      ports.revealHidden(s);
      const cards = s.player.deck.filter((p) => trait(p, "Skill"));
      ports.choose(s, "Training Regimen", "Search your deck for a Skill.", [
        ...cards.map((p) =>
          O(p.id, card(p).name, [P("regimen-found", { id: p.id })], p.code),
        ),
        O("fail", "Finish search without a card", [P("regimen-found")]),
      ]);
      break;
    }
    case "psylocke:regimen-found": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shufflePlayer(
        s,
        s.player.form === "hero" && s.player.hand.length
          ? [P("regimen-discard")]
          : [],
      );
      break;
    }
    case "psylocke:regimen-discard":
      ports.choose(
        s,
        "Training Regimen",
        "Discard one actual hand card.",
        s.player.hand.map((p) =>
          O(p.id, card(p).name, [P("discard-hand", { id: p.id })], p.code),
        ),
      );
      break;
    case "psylocke:discard-hand":
      ports.discardHand(s, e.id);
      break;
    case "psylocke:martial":
      ports.discardPiece(s, e.id);
      ports.queue(s, E("ready", { target: "hero" }));
      break;
    case "psylocke:psionic-training":
      ports.discardPiece(s, e.id);
      select(
        s,
        "Psionic Training",
        ports.enemyTargets(s, false),
        E("status", { status: "confused" }),
        ports,
      );
      break;
    case "psylocke:weapons-ready":
      ports.discardPiece(s, e.id);
      ports.queue(
        s,
        ...s.player.inPlay
          .filter((p) => trait(p, "Weapon"))
          .map((p) => E("ready", { target: p.id })),
      );
      break;
    case "psylocke:upside-window": {
      const opts = reaction(
        s,
        "41015",
        P("upside", { target: e.target }),
        [],
        ports,
      );
      if (opts.length)
        ports.choose(
          s,
          "Upside the Head",
          "Respond after basic attack damage?",
          [...opts, O("continue", "Continue", [])],
        );
      break;
    }
    case "psylocke:upside": {
      const p = enemy(s, e.target);
      if (p)
        ports.queue(
          s,
          E("status", {
            target: e.target,
            status: p.confused ? "stunned" : "confused",
          }),
        );
      break;
    }
    case "psylocke:directed":
      s.flags[`psylockeDirected:${e.packet.psylockeToken}`] = true;
      s.flags[`psylockeDirectedBonus:${e.packet.psylockeToken}`] = 2;
      ports.queue(s, { ...e.packet, psylockeDirectedHandled: true });
      break;
    case "psylocke:flail-window": {
      const opts = ports.hasTrait(s, "hero", "Psionic")
        ? reaction(s, "41032", P("flail", { target: e.target }), [], ports)
        : [];
      if (opts.length)
        ports.choose(s, "Psi-Flail Strike", "Respond after defending?", [
          ...opts,
          O("continue", "Continue", []),
        ]);
      break;
    }
    case "psylocke:flail":
      ports.attackProgram(
        s,
        [
          E("damage", { target: e.target, amount: 3, attack: true }),
          E("status", { target: e.target, status: "stunned" }),
        ],
        [],
      );
      break;
    case "psylocke:control":
      ports.choose(
        s,
        "Float Like a Butterfly",
        "Choose its controller.",
        playerOrder(s)
          .filter(
            (p) => !live(seatView(s, p), "41017").some((q) => q.id !== e.id),
          )
          .map((p) =>
            O(p.id, p.heroId, [P("transfer", { id: e.id, target: p.id })]),
          ),
      );
      break;
    case "psylocke:transfer":
      ports.transferControl(s, e.id, e.target);
      break;
    case "psylocke:ipac": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "IPAC is exhausted.");
      need(
        s.encounter.deck.length || s.encounter.discard.length,
        "IPAC requires an encounter card to pay its cost.",
      );
      ports.choose(
        s,
        "IPAC",
        "Choose the player who receives the encounter card and draws.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.heroId, [
            P("ipac-commit", { id: e.id, target: seat.id }),
          ]),
        ),
      );
      break;
    }
    case "psylocke:ipac-commit": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "IPAC is exhausted.");
      need(
        s.encounter.deck.length || s.encounter.discard.length,
        "IPAC requires an encounter card to pay its cost.",
      );
      p!.exhausted = true;
      ports.dealEncounter(s, e.target);
      ports.queue(s, E("draw", { amount: 2, actorId: e.target }));
      break;
    }
    case "psylocke:bunker":
      ports.choose(
        s,
        "X-Bunker",
        "Choose a Mutant identity.",
        playerOrder(s)
          .filter((seat) => ports.hasTrait(s, `hero:${seat.id}`, "Mutant"))
          .map((seat) =>
            O(seat.id, seat.heroId, [
              P("bunker-commit", { id: e.id, target: seat.id }),
            ]),
          ),
      );
      break;
    case "psylocke:bunker-commit": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "X-Bunker is unavailable.");
      p!.exhausted = true;
      ports.queue(s, P("bunker-search", { actorId: e.target }));
      break;
    }
    case "psylocke:bunker-search": {
      const n = (s.victoryDisplay || []).filter((p) =>
        ["side_scheme", "player_side_scheme"].includes(card(p).type_code),
      ).length;
      ports.revealHidden(s);
      const cards = s.player.deck.slice(0, n);
      ports.choose(s, "X-Bunker", "Search the top cards of your deck.", [
        ...cards.map((p) =>
          O(p.id, card(p).name, [P("bunker-found", { id: p.id })], p.code),
        ),
        O("fail", "Finish search without a card", [P("bunker-found")]),
      ]);
      break;
    }
    case "psylocke:bunker-found": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.deck.splice(i, 1)[0]);
      ports.shufflePlayer(s, []);
      break;
    }
    case "psylocke:superpower": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "This Superpower is exhausted.");
      ports.pay(
        s,
        card(p!).name,
        2,
        ["mental", "mental"],
        [P("superpower-paid", { id: e.id })],
      );
      break;
    }
    case "psylocke:superpower-paid": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "This Superpower is exhausted.");
      p!.exhausted = true;
      if (p!.code === "41024")
        select(
          s,
          "Telepathy",
          ports.schemeTargets(s, true),
          E("thwart", { amount: 2, action: true }),
          ports,
        );
      else
        ports.attackProgram(
          s,
          [
            E("target", {
              group: "enemy",
              action: E("damage", { amount: 3, attack: true }),
            }),
          ],
          [],
        );
      break;
    }
    case "psylocke:swap":
      ports.choose(
        s,
        "Domino",
        "Swap an actual hand card with the top card.",
        s.player.hand.map((p) =>
          O(p.id, card(p).name, [P("swap-card", { id: p.id })], p.code),
        ),
      );
      break;
    case "psylocke:swap-card": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      need(
        i >= 0 && s.player.deck.length,
        "The cards to swap are unavailable.",
      );
      const p = s.player.hand[i];
      s.player.hand[i] = s.player.deck[0];
      s.player.deck[0] = p;
      break;
    }
    case "psylocke:obligation": {
      const p = e.piece as Piece;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      if (!s.player.inPlay.some((q) => q.id === p.id)) s.player.inPlay.push(p);
      for (const q of psiEnergy(s)) {
        q.code = "41002b";
        q.exhausted = true;
      }
      break;
    }
    case "psylocke:obligation-remove":
      select(
        s,
        "Body Swapped",
        s.player.hand
          .filter((p) => trait(p, "Psionic"))
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
        P("obligation-discard", { id: e.id }),
        ports,
      );
      break;
    case "psylocke:obligation-discard":
      ports.discardHand(s, e.target);
      ports.discardPiece(s, e.id);
      break;
    case "psylocke:illusion-attach": {
      const p = e.piece as Piece;
      p.attachedTo = `hero:${s.activePlayerId}`;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      if (!s.attachments.some((q) => q.id === p.id)) s.attachments.push(p);
      break;
    }
    case "psylocke:illusion":
      ports.choose(
        s,
        "Psionic Illusion",
        "Name one printed resource type.",
        (["mental", "physical", "energy", "wild"] as Resource[]).map((r) =>
          O(
            r,
            r,
            [P("illusion-mill", { ...e, type: undefined, resource: r })].map(
              (x) => ({ ...x, type: "psylocke:illusion-mill" }),
            ),
          ),
        ),
      );
      break;
    case "psylocke:illusion-mill": {
      const p = ports.discardTop(s).piece;
      s.flags[`psylockeIllusionChecked:${e.token}:${e.packet.target}`] = true;
      if (p && card(p)[`resource_${e.resource}` as keyof Card])
        ports.queue(s, { ...e.packet, psylockeIllusionHandled: true });
      else
        select(
          s,
          "Psionic Illusion",
          ports.friendlyTargets(s),
          P("illusion-redirect", {
            id: e.id,
            packet: e.packet,
            token: e.token,
          }),
          ports,
        );
      break;
    }
    case "psylocke:illusion-redirect":
      ports.discardPiece(s, e.id);
      ports.queue(s, {
        ...e.packet,
        target: e.target,
        attackAlreadyInitiated: true,
        psylockeIllusionHandled: true,
      });
      break;
    case "psylocke:dragon": {
      const n = psylockeMentalIcons(s);
      if (n) ports.indirect(s, n, e.piece.id);
      else ports.queue(s, E("surge"));
      break;
    }
    case "psylocke:dragon-boost":
      ports.choose(
        s,
        "Telekinetic Dragon",
        "Spend a mental resource or become confused.",
        [
          ...(ports.canPay(s, 1, ["mental"])
            ? [O("pay", "Spend a mental resource", [P("dragon-pay")])]
            : []),
          O("confuse", "Confuse your identity", [
            E("status", { target: "hero", status: "confused" }),
          ]),
        ],
      );
      break;
    case "psylocke:dragon-pay":
      ports.pay(s, "Telekinetic Dragon", 1, ["mental"], []);
      break;
    case "psylocke:shadows": {
      const reserve = s.player.setAside || [];
      const minion = reserve.find((p) => p.code === "41026"),
        scheme = reserve.find((p) => p.code === "41027");
      if (!minion || !scheme) {
        ports.queue(s, E("surge"));
        break;
      }
      s.player.setAside = reserve.filter(
        (p) => !card(p).set_code?.includes("psylocke_nemesis"),
      );
      s.encounter.deck.push(
        ...reserve.filter(
          (p) =>
            card(p).set_code === "psylocke_nemesis" &&
            p !== minion &&
            p !== scheme,
        ),
      );
      ports.shuffleEncounter(s);
      ports.queue(
        s,
        E("reveal", { piece: minion }),
        E("reveal", { piece: scheme }),
      );
      break;
    }
    default:
      throw Error(`Unknown Psylocke effect ${e.type}`);
  }
  return true;
}
