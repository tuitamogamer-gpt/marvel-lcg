import { card } from "./card-definitions.js";
import { isTextBlank, eventPlaySources } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Effect, GameState, Option, Piece } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const I = (type: string, args: Record<string, unknown> = {}) =>
  E(`iceman:${type}`, args);
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
const phase = (s: GameState) => `${s.round}:${s.phase}`;
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const attached = (s: GameState, id: string) =>
  [...allInPlay(s), ...s.attachments].filter((p) => p.attachedTo === id);
const trait = (p: Piece, t: string) =>
  (card(p).traits || "").split(/\.\s*/).includes(t);
const globalFlags = (s: GameState) => seatView(s, s.firstPlayerId).flags;
const triggerBlocked = (s: GameState, p?: Piece) => {
  const owner = p && controller(s, p.id);
  return deadpoolTriggeredBlocked(owner ? seatView(s, owner) : s);
};
const frostbites = (s: GameState, id?: string) =>
  allInPlay(s).filter(
    (p) => p.code === "46002" && (!id || p.attachedTo === id),
  );
const reserve = (s: GameState) =>
  playerOrder(s).flatMap((seat) =>
    (seatView(s, seat).player.setAside || []).filter((p) => p.code === "46002"),
  );
const isHero = (s: GameState) =>
  s.heroId === "iceman" && s.player.form === "hero";
const icons = (p?: Piece) =>
  p
    ? ["energy", "mental", "physical", "wild"].reduce(
        (n, r) =>
          n +
          Number(
            (card(p) as unknown as Record<string, number>)[`resource_${r}`] ||
              0,
          ),
        0,
      )
    : 0;

export const ICEMAN_SCRIPT_CODES = [
  "46001a",
  "46001b",
  ...Array.from({ length: 31 }, (_, i) => String(46002 + i)),
];
export interface IcemanPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  find(s: GameState, id: string): Piece | undefined;
  makePiece(s: GameState, code: string): Piece;
  enemies(
    s: GameState,
    attack: boolean,
  ): { id: string; label: string; code?: string }[];
  schemes(
    s: GameState,
    thwart: boolean,
  ): { id: string; label: string; code?: string }[];
  characters(s: GameState): { id: string; label: string; code?: string }[];
  hasTrait(s: GameState, id: string, name: string): boolean;
  canPay(s: GameState, p: Piece): boolean;
  reaction(s: GameState, p: Piece, effects: Effect[], after: Effect[]): void;
  discard(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  mill(s: GameState, n: number): Piece[];
  drawOne(s: GameState): Piece | undefined;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  hidden(s: GameState): void;
  ready(s: GameState): void;
  canReady(s: GameState): boolean;
  heal(s: GameState, id: string, n: number): void;
  attachEncounter(s: GameState, p: Piece, target: string): void;
  keepObligation(s: GameState, p: Piece): void;
  discardEncounterTop(s: GameState): Piece | undefined;
  putMinion(s: GameState, p: Piece): void;
  activate(s: GameState, id: string): void;
  batch(s: GameState, ids: string[], n: number, source: string): void;
}

export function icemanInitialize(
  s: GameState,
  ports: Pick<IcemanPorts, "makePiece">,
) {
  if (s.heroId !== "iceman" || s.flags.icemanInitialized) return;
  s.flags.icemanInitialized = true;
  (s.player.setAside ||= []).push(
    ...[
      ...Array(6).fill("46002"),
      "46025",
      "46026",
      "46027",
      "46028",
      "46028",
    ].map((code) => ports.makePiece(s, code)),
  );
}
export function icemanStats(s: GameState) {
  const slide = isHero(s) ? live(s, "46006").length : 0;
  return {
    attack: slide,
    thwart: slide,
    defense: slide,
    health: live(s, "46004").length * 3,
    aerial: slide > 0,
  };
}
export function icemanResourceSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (
    s.player.form !== "hero" ||
    triggerBlocked(s) ||
    !targetCode ||
    !(card(targetCode).traits || "").split(/\.\s*/).includes("Ice")
  )
    return [];
  return live(s, "46004")
    .filter((p) => !p.exhausted)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      resources: ["wild"],
      kind: "ability",
      description:
        "Exhaust Power Belt to generate a wild resource for an Ice card.",
    }));
}
export function icemanResourceSpent(s: GameState, id: string) {
  const p = live(s, "46004").find((p) => p.id === id);
  if (!p) return false;
  need(!p.exhausted && s.player.form === "hero", "Power Belt is unavailable.");
  p.exhausted = true;
  return true;
}
export const icemanEnemyModifier = (s: GameState, id: string) =>
  -frostbites(s, id).filter((p) => !isTextBlank(s, p)).length;
export const icemanHasUpgrade = (s: GameState, id: string) =>
  attached(s, id).some((p) => card(p).type_code === "upgrade");
export const icemanSnowCloneReduction = (
  s: GameState,
  p: Piece,
  target: string,
) =>
  p.code === "46003" && !isTextBlank(s, p) && frostbites(s, target).length > 0
    ? 1
    : 0;
export const icemanSharkGirlBonus = (s: GameState, p: Piece, target: string) =>
  p.code === "46012" && !isTextBlank(s, p)
    ? attached(s, target).filter((p) => card(p).type_code === "upgrade").length
    : 0;
export function icemanCanAttachUpgrade(s: GameState, target: string) {
  const p = allInPlay(s).find((p) => p.id === target);
  return !p || p.code !== "46003" || isTextBlank(s, p);
}
export function icemanReturnFrostbite(s: GameState, p: Piece) {
  const seat =
    s.players.find((seat) => seat.id === p.ownerId) || controller(s, p.id);
  if (!seat) return;
  for (const current of s.players) {
    const zone = seatView(s, current).player.inPlay;
    const i = zone.findIndex((q) => q.id === p.id);
    if (i >= 0) zone.splice(i, 1);
  }
  const clean = { ...p, damage: 0, counters: 0, exhausted: false };
  delete clean.attachedTo;
  clean.stunned = false;
  clean.confused = false;
  clean.tough = false;
  if (seat.eliminated) s.removed.push(clean);
  else (seatView(s, seat).player.setAside ||= []).push(clean);
}
export function icemanEnemyLeft(s: GameState, id: string) {
  // Permanent remains in play if Merc prevents its triggered return.
  for (const p of frostbites(s, id))
    if (!isTextBlank(s, p) && !triggerBlocked(s, p))
      icemanReturnFrostbite(s, p);
}
export function icemanActivated(s: GameState, id: string): Effect[] {
  const ids = frostbites(s, id)
    .filter((p) => !isTextBlank(s, p) && !triggerBlocked(s, p))
    .map((p) => p.id);
  return ids.length ? [I("return", { ids })] : [];
}
export function icemanFreezeOptions(
  s: GameState,
  packet: Effect,
  ports: IcemanPorts,
): Option[] {
  if (
    !isHero(s) ||
    triggerBlocked(s) ||
    isTextBlank(s, { code: "46001a", id: `hero:${s.activePlayerId}` }) ||
    packet.icemanFreezeHandled ||
    !reserve(s).length ||
    ![s.villain, ...s.minions].some((p) => p.id === packet.target)
  )
    return [];
  return [
    O(
      "freeze",
      "Freeze! · attach Frostbite",
      [
        I("freeze", {
          target: packet.target,
          packet: { ...packet, icemanFreezeHandled: true },
        }),
      ],
      "46001a",
    ),
  ];
}
export function icemanBasicAttackOptions(
  s: GameState,
  packet: Effect,
  ports: IcemanPorts,
): Option[] {
  if (
    !packet.basic ||
    !packet.attack ||
    s.player.form !== "hero" ||
    s.player.stunned
  )
    return [];
  const opts = icemanFreezeOptions(s, packet, ports);
  if (icemanHasUpgrade(s, packet.target))
    opts.push(
      ...eventPlaySources(s)
        .filter((p) => p.code === "46015" && ports.canPay(s, p))
        .map((p) =>
          O(
            p.id,
            "Surprise Move · +2 ATK; ready if this attack defeats its enemy",
            [I("surprise", { id: p.id, packet })],
            p.code,
          ),
        ),
    );
  return opts;
}
export function icemanAttachFrostbite(
  s: GameState,
  target: string,
  ports: IcemanPorts,
): Effect[] {
  if (![s.villain, ...s.minions].some((p) => p.id === target)) return [];
  const p = reserve(s)[0];
  if (!p) return [];
  const owner = s.players.find((seat) => seat.id === p.ownerId)!;
  const view = seatView(s, owner);
  view.player.setAside!.splice(view.player.setAside!.indexOf(p), 1);
  p.attachedTo = target;
  view.player.inPlay.push(p);
  return live(s, "46024").map((q) =>
    E("damage", { target: "hero", amount: 1, source: q.id }),
  );
}
export function icemanFrozenSolid(
  s: GameState,
  id: string,
  ports: IcemanPorts,
) {
  const solid = allInPlay(s).find(
    (p) =>
      p.code === "46007" &&
      p.attachedTo === id &&
      !isTextBlank(s, p) &&
      !triggerBlocked(s, p),
  );
  if (!solid) return false;
  const actorId = controller(s, solid.id)?.id || solid.ownerId;
  ports.discard(s, solid.id);
  ports.queue(s, I("attach-frostbite", { target: id, actorId }));
  return true;
}
export const icemanHasWall = (s: GameState) =>
  allInPlay(s).some(
    (p) => p.code === "46008" && !isTextBlank(s, p) && !triggerBlocked(s, p),
  );
/** Ice Wall's published ruling attaches only after the current attack ends. */
export function icemanWall(
  s: GameState,
  target: string,
  n: number,
  enemyId: string,
  ports: IcemanPorts,
) {
  if (
    n <= 0 ||
    ![s.villain, ...s.minions].some((p) => p.id === enemyId) ||
    !(target === "hero" || target.startsWith("hero:"))
  )
    return false;
  const wall = allInPlay(s).find(
    (p) => p.code === "46008" && !isTextBlank(s, p) && !triggerBlocked(s, p),
  );
  if (!wall) return false;
  wall.damage += n;
  if (wall.damage >= 8) {
    const actorId = controller(s, wall.id)?.id || wall.ownerId;
    ports.discard(s, wall.id);
    const effect = I("attach-frostbite", { target: enemyId, actorId });
    if (s.attack) {
      const key = `icemanWallAfter:${s.attack.id}`;
      const pending = JSON.parse(
        String(globalFlags(s)[key] || "[]"),
      ) as Effect[];
      globalFlags(s)[key] = JSON.stringify([...pending, effect]);
    } else ports.queue(s, effect);
  }
  return true;
}
export function icemanAfterAttack(s: GameState, attackId?: string): Effect[] {
  const key = `icemanWallAfter:${attackId}`;
  const pending = JSON.parse(String(globalFlags(s)[key] || "[]")) as Effect[];
  delete globalFlags(s)[key];
  return pending;
}
export function icemanFormChanged(s: GameState): Effect[] {
  if (s.player.form !== "alter") return [];
  const effects = live(s, "46006")
    .filter((p) => !triggerBlocked(s, p))
    .map((p) => I("slide-return", { id: p.id }));
  if (
    s.heroId === "iceman" &&
    !triggerBlocked(s) &&
    !isTextBlank(s, "46001b") &&
    frostbites(s).length &&
    s.player.discard.some((p) => trait(p, "Ice"))
  )
    effects.push(
      optional("Cool Off", [I("cool", { remaining: frostbites(s).length })]),
    );
  return effects;
}
export const icemanRecovered = (s: GameState) =>
  s.player.form === "alter"
    ? live(s, "46024").map((p) =>
        optional("Hot-Headed", [E("discardPiece", { id: p.id })]),
      )
    : [];
export function icemanAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: IcemanPorts,
): { id: string; label: string; code?: string }[] | null {
  if (!["46007", "46014"].includes(p.code)) return null;
  return ports
    .enemies(s, false)
    .filter(
      (t) =>
        (p.code !== "46014" || s.minions.some((m) => m.id === t.id)) &&
        !allInPlay(s).some(
          (q) => q.id !== p.id && q.code === p.code && q.attachedTo === t.id,
        ),
    );
}
export function icemanPlayRestriction(
  s: GameState,
  p: Piece,
  ports: IcemanPorts,
) {
  if (p.code === "46002")
    return "Frostbite is a set-aside Permanent, not a player-deck card.";
  if (p.code === "46015")
    return "Play Surprise Move in a basic attack interrupt window.";
  if (
    ["46013", "46019"].includes(p.code) &&
    !ports.hasTrait(s, "hero", "X-Men")
  )
    return "Your identity must have the X-Men trait.";
  if (p.code === "46007" && s.player.form !== "hero")
    return "Frozen Solid requires hero form.";
  if (
    ["46007", "46014"].includes(p.code) &&
    !icemanAttachmentTargets(s, p, ports)?.length
  )
    return "There is no legal enemy attachment target.";
  if (
    p.code === "46016" &&
    !ports.enemies(s, true).some((t) => icemanHasUpgrade(s, t.id))
  )
    return "Take That! requires an enemy with an upgrade attached.";
  return undefined;
}
export function icemanEvent(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "46009":
      return [I("arctic")];
    case "46010":
      return [I("blast-player")];
    case "46011":
      return [
        E("target", {
          group: "scheme",
          title: "Chill Out!",
          action: E("thwart", { amount: 3, action: true }),
        }),
        I("frostbite-target"),
      ];
    case "46015":
      return [];
    case "46016":
      return [I("take-that")];
    default:
      return null;
  }
}
export function icemanEntered(
  s: GameState,
  p: Piece,
  fromHand = false,
  allyEntry = false,
): Effect[] {
  if (isTextBlank(s, p) || (card(p).type_code === "ally" && !allyEntry))
    return [];
  if (["46007", "46014"].includes(p.code) && !p.attachedTo)
    return [I("attach-upgrade", { id: p.id })];
  if (p.code === "46013") return [optional("Glob", [I("glob")])];
  if (p.code === "46019" && fromHand && s.sideSchemes.length)
    return [optional("Shadowcat", [I("shadowcat")])];
  if (p.code === "46020" && fromHand)
    return [
      optional("Beak", [
        E("target", {
          group: "scheme",
          title: "Beak",
          thwarting: false,
          action: E("thwart", {
            amount: s.player.inPlay.filter(
              (q) => card(q).type_code === "ally" && trait(q, "X-Men"),
            ).length,
            action: false,
            source: p.id,
          }),
        }),
      ]),
    ];
  return [];
}
export function icemanMinionDefeated(
  s: GameState,
  p: Piece,
  source: string,
  attack: boolean,
  maximumHP: number,
): Effect[] {
  if (
    s.player.hp >= maximumHP ||
    !attack ||
    !["hero", `hero:${s.activePlayerId}`].includes(source) ||
    s.player.form !== "hero"
  )
    return [];
  return live(s, "46014")
    .filter((q) => q.attachedTo === p.id)
    .map((q) =>
      optional("Suppressing Fire", [
        E("heal", { target: "hero", amount: 2, source: q.id }),
      ]),
    );
}
export function icemanSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (isTextBlank(s, p)) return [];
  if (p.code === "46026") return [I("burn", { amount: 3, source: p.id })];
  if (p.code === "46030") return [I("sauron-deal")];
  if (p.code === "46018")
    return [
      I("pressure"),
      ...playerOrder(s).map((seat) =>
        optional("Keep Up the Pressure", [
          I("search-attack", { actorId: seat.id }),
        ]),
      ),
    ];
  return [];
}
export const icemanAttackEventBonus = (s: GameState, eventId?: string) =>
  globalFlags(s).icemanPressure === phase(s) &&
  eventId &&
  s.resolving.some((p) => p.id === eventId && trait(p, "Attack"))
    ? 1
    : 0;
export const icemanSchemeIconsSuppressed = (s: GameState, p: Piece) =>
  globalFlags(s)[`icemanNoIcons:${p.id}`] === s.round;
export function icemanSchemeIcon(
  s: GameState,
  p: Piece,
  key:
    | "scheme_acceleration"
    | "scheme_hazard"
    | "scheme_amplify"
    | "scheme_crisis",
) {
  return icemanSchemeIconsSuppressed(s, p) ? 0 : Number(card(p)[key] || 0);
}
export function icemanEncounter(s: GameState, p: Piece): Effect[] | null {
  if (isTextBlank(s, p) && ICEMAN_SCRIPT_CODES.includes(p.code)) return [];
  switch (p.code) {
    case "46024":
      return [I("obligation", { piece: p })];
    case "46025":
    case "46026":
    case "46030":
      return [];
    case "46027":
    case "46031":
      return [I("encounter-attach", { piece: p })];
    case "46028":
      return [
        I("burn", {
          amount: s.minions.some((m) => m.code === "46025") ? 3 : 2,
          source: p.id,
        }),
      ];
    case "46029":
      return [I("search-encounter", { code: "46031", reveal: true })];
    case "46032":
      return [I("eye")];
    default:
      return null;
  }
}
export const icemanBoostExtra = (s: GameState, id: string) =>
  Number(globalFlags(s)[`icemanBurn:${id}`] || 0);
export function icemanBoost(_s: GameState, p: Piece): Effect[] | null {
  if (p.code === "46028") return [I("burn-boost", { id: p.id })];
  if (p.code === "46029") return [I("sauron-boost")];
  return null;
}
export const icemanShadows = (s: GameState): Effect[] | null =>
  s.heroId === "iceman" ? [I("shadows")] : null;
export function icemanAttackStarted(s: GameState, id: string): Effect[] {
  const responses = s.attachments
    .filter(
      (p) =>
        p.attachedTo === id &&
        !isTextBlank(s, p) &&
        ["46027", "46031"].includes(p.code),
    )
    .map((p) => ({
      id: p.id,
      title: card(p).name,
      effects: [I(p.code === "46027" ? "flamethrower" : "life-drain", { id })],
    }));
  return responses.length ? [E("forcedResponses", { responses })] : [];
}
export const icemanPyroIndirect = (s: GameState, p: Piece) =>
  p.code === "46025" && !isTextBlank(s, p);
export const icemanFlamethrowerBonus = (s: GameState, id: string) =>
  s.attack?.attacker === id
    ? Number(globalFlags(s)[`icemanFlame:${s.attack.id}`] || 0)
    : 0;

export function resolveIcemanEffect(
  s: GameState,
  e: Effect,
  ports: IcemanPorts,
): boolean {
  if (!e.type.startsWith("iceman:")) return false;
  const p = e.id ? ports.find(s, e.id) : undefined;
  switch (e.type.slice(7)) {
    case "attach-frostbite":
      ports.queue(s, ...icemanAttachFrostbite(s, e.target, ports));
      break;
    case "return":
      for (const id of e.ids as string[]) {
        const q = allInPlay(s).find((p) => p.id === id && p.code === "46002");
        if (q && !triggerBlocked(s, q)) icemanReturnFrostbite(s, q);
      }
      break;
    case "freeze": {
      ports.queue(
        s,
        ...icemanAttachFrostbite(s, e.target, ports),
        ...live(s, "46005")
          .filter((p) => !p.exhausted)
          .map((p) =>
            optional("Cryokinetic Perception", [I("perception", { id: p.id })]),
          ),
        e.packet,
      );
      break;
    }
    case "perception": {
      need(
        p && p.code === "46005" && !p.exhausted && !isTextBlank(s, p),
        "Cryokinetic Perception is unavailable.",
      );
      p!.exhausted = true;
      const drawn = ports.drawOne(s);
      if (drawn && trait(drawn, "Ice") && ports.canReady(s)) ports.ready(s);
      break;
    }
    case "surprise": {
      const q = eventPlaySources(s).find(
        (p) => p.id === e.id && p.code === "46015",
      );
      need(
        q && icemanHasUpgrade(s, e.packet.target),
        "Surprise Move needs an upgrade on the attacked enemy.",
      );
      const next = {
        ...e.packet,
        amount: e.packet.amount + 2,
        afterResolved: [...(e.packet.afterResolved || []), I("surprise-ready")],
      };
      ports.reaction(s, q!, [], [next]);
      break;
    }
    case "surprise-ready":
      if (e.damageReceipt?.defeated && ports.canReady(s)) ports.ready(s);
      break;
    case "slide-return": {
      if (!p || p.code !== "46006") break;
      const owner = controller(s, p.id);
      ports.discard(s, p.id);
      const view = owner ? seatView(s, owner) : s,
        i = view.player.discard.findIndex((q) => q.id === p.id);
      if (i >= 0) view.player.deck.push(view.player.discard.splice(i, 1)[0]);
      ports.shuffle(view);
      break;
    }
    case "cool": {
      const options = s.player.discard.filter((p) => trait(p, "Ice"));
      if (!e.remaining || !options.length) {
        ports.shuffle(s);
        break;
      }
      ports.choose(
        s,
        "Cool Off",
        "Shuffle an Ice card for each Frostbite in play.",
        options.map((p) =>
          O(
            p.id,
            card(p).name,
            [I("cool-card", { id: p.id, remaining: e.remaining })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "cool-card": {
      const i = s.player.discard.findIndex(
        (p) => p.id === e.id && trait(p, "Ice"),
      );
      need(i >= 0, "That Ice card is no longer discarded.");
      s.player.deck.push(s.player.discard.splice(i, 1)[0]);
      ports.queue(s, I("cool", { remaining: e.remaining - 1 }));
      break;
    }
    case "attach-upgrade": {
      if (!p) break;
      const possible = icemanAttachmentTargets(s, p, ports) || [];
      ports.choose(
        s,
        card(p).name,
        "Choose an enemy for this upgrade.",
        possible.map((t) =>
          O(
            t.id,
            t.label,
            [I("upgrade-target", { id: p.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "upgrade-target":
      need(
        p &&
          icemanAttachmentTargets(s, p, ports)?.some((t) => t.id === e.target),
        "That attachment target is no longer legal.",
      );
      p!.attachedTo = e.target;
      break;
    case "frostbite-target": {
      if (!reserve(s).length) break;
      ports.choose(
        s,
        "Frostbite",
        "Choose an enemy to receive a set-aside Frostbite.",
        ports
          .enemies(s, false)
          .map((t) =>
            O(t.id, t.label, [I("attach-frostbite", { target: t.id })], t.code),
          ),
      );
      break;
    }
    case "arctic":
      ports.choose(s, "Arctic Attack", "Choose its printed attack effect.", [
        O("freeze", "4 damage and attach Frostbite", [
          I("arctic-target", { freeze: true }),
        ]),
        ...(ports.enemies(s, true).some((t) => frostbites(s, t.id).length)
          ? [
              O("damage", "6 damage to an enemy with Frostbite", [
                I("arctic-target"),
              ]),
            ]
          : []),
      ]);
      break;
    case "arctic-target":
      ports.choose(
        s,
        "Arctic Attack",
        "Choose an enemy.",
        ports
          .enemies(s, true)
          .filter((t) => e.freeze || frostbites(s, t.id).length)
          .map((t) =>
            O(
              t.id,
              t.label,
              [I("arctic-hit", { target: t.id, freeze: e.freeze })],
              t.code,
            ),
          ),
      );
      break;
    case "arctic-hit": {
      // Damage and attachment in the first bullet are simultaneous. Establish
      // the physical Frostbite before native damage performs defeat cleanup.
      const responses = e.freeze
        ? icemanAttachFrostbite(s, e.target, ports)
        : [];
      ports.queue(
        s,
        E("damage", {
          target: e.target,
          amount: e.freeze ? 4 : 6,
          attack: true,
        }),
        ...responses,
      );
      break;
    }
    case "blast-player":
      ports.choose(
        s,
        "Ice Blast",
        "Choose a player whose enemies receive Frostbite.",
        playerOrder(s).map((seat) =>
          O(seat.id, seat.heroId, [
            I("blast-attach", {
              ids: [
                s.villain.id,
                ...s.minions
                  .filter(
                    (p) => (p.engagedWith || s.activePlayerId) === seat.id,
                  )
                  .map((p) => p.id),
              ],
            }),
          ]),
        ),
      );
      break;
    case "blast-attach": {
      const ids = (e.ids as string[]).filter((id) => !!ports.find(s, id));
      if (!ids.length || !reserve(s).length) {
        ports.queue(s, I("blast-damage"));
        break;
      }
      ports.choose(
        s,
        "Ice Blast · attach Frostbite",
        "Choose the next enemy. Continue until every selected enemy has received one or the reserve is empty.",
        ids.map((id) =>
          O(
            id,
            card(ports.find(s, id)!).name,
            [
              I("attach-frostbite", { target: id }),
              I("blast-attach", { ids: ids.filter((q) => q !== id) }),
            ],
            ports.find(s, id)!.code,
          ),
        ),
      );
      break;
    }
    case "blast-damage":
      ports.batch(
        s,
        [s.villain, ...s.minions]
          .filter((p) => frostbites(s, p.id).length)
          .map((p) => p.id),
        3,
        s.currentEventId || "hero",
      );
      break;
    case "take-that":
      ports.choose(
        s,
        "Take That!",
        "Attack an enemy with an upgrade attached.",
        ports
          .enemies(s, true)
          .filter((t) => icemanHasUpgrade(s, t.id))
          .map((t) =>
            O(
              t.id,
              t.label,
              [E("damage", { target: t.id, amount: 7, attack: true })],
              t.code,
            ),
          ),
      );
      break;
    case "glob":
      ports.choose(
        s,
        "Glob",
        "Deal 2 damage to an enemy with an upgrade attached.",
        ports
          .enemies(s, false)
          .filter((t) => icemanHasUpgrade(s, t.id))
          .map((t) =>
            O(
              t.id,
              t.label,
              [E("damage", { target: t.id, amount: 2 })],
              t.code,
            ),
          ),
      );
      break;
    case "shadowcat":
      ports.choose(
        s,
        "Shadowcat",
        "Choose a side scheme to lose its icons for this round.",
        s.sideSchemes.map((p) =>
          O(p.id, card(p).name, [I("no-icons", { id: p.id })], p.code),
        ),
      );
      break;
    case "no-icons":
      if (s.sideSchemes.some((p) => p.id === e.id))
        globalFlags(s)[`icemanNoIcons:${e.id}`] = s.round;
      break;
    case "pressure":
      globalFlags(s).icemanPressure = phase(s);
      break;
    case "search-attack": {
      ports.hidden(s);
      const found = [...s.player.deck, ...s.player.discard].filter(
        (p) => card(p).type_code === "event" && trait(p, "Attack"),
      );
      ports.choose(
        s,
        "Keep Up the Pressure",
        "Add an Attack event to your hand, then shuffle.",
        [
          ...found.map((p) =>
            O(
              p.id,
              card(p).name,
              [I("search-attack-card", { id: p.id })],
              p.code,
            ),
          ),
          O("none", "Find no card", [I("search-attack-card")]),
        ],
      );
      break;
    }
    case "search-attack-card":
      for (const zone of [s.player.deck, s.player.discard]) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i >= 0) s.player.hand.push(zone.splice(i, 1)[0]);
      }
      ports.shuffle(s);
      break;
    case "obligation":
      ports.keepObligation(s, e.piece);
      break;
    case "burn": {
      const cards = ports.mill(s, e.amount);
      ports.queue(
        s,
        E("indirect", {
          amount: cards.reduce((n, p) => n + icons(p), 0),
          source: e.source,
        }),
      );
      break;
    }
    case "burn-boost": {
      const n = icons(ports.mill(s, 1)[0]);
      if (s.scheming || s.attack) globalFlags(s)[`icemanBurn:${e.id}`] = n;
      break;
    }
    case "sauron-boost": {
      const id = (s.scheming || s.attack)?.attacker;
      if (id)
        ports.queue(
          s,
          E("heal", { target: id, amount: 3 }),
          E("status", { target: id, status: "tough" }),
        );
      break;
    }
    case "flamethrower":
      if (s.attack && s.attack.attacker === e.id)
        globalFlags(s)[`icemanFlame:${s.attack.id}`] = icons(
          ports.mill(s, 1)[0],
        );
      break;
    case "life-drain":
      ports.queue(
        s,
        E("damage", { target: "hero", amount: 2, source: e.id }),
        E("status", { target: e.id, status: "tough" }),
      );
      break;
    case "encounter-attach": {
      const q = e.piece as Piece;
      const pyros = s.minions.filter((p) => p.code === "46025");
      const hp = Math.max(0, ...s.minions.map((p) => card(p).health || 0));
      const possible =
        q.code === "46027"
          ? pyros
          : s.minions.filter((p) => (card(p).health || 0) === hp);
      if (!possible.length) {
        ports.queue(s, E("surge", { sourceCode: q.code }));
        break;
      }
      ports.choose(
        s,
        card(q).name,
        "Choose the required minion.",
        possible.map((p) =>
          O(
            p.id,
            card(p).name,
            [I("encounter-attached", { piece: q, target: p.id })],
            p.code,
          ),
        ),
      );
      break;
    }
    case "encounter-attached":
      ports.attachEncounter(s, e.piece, e.target);
      if (e.piece.code === "46031") ports.activate(s, e.target);
      break;
    case "search-encounter": {
      ports.hidden(s);
      let found: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((p) => p.code === e.code);
        if (i >= 0) {
          found = zone.splice(i, 1)[0];
          break;
        }
      }
      ports.shuffleEncounter(s);
      if (found) ports.queue(s, E("reveal", { piece: found }));
      break;
    }
    case "sauron-deal": {
      ports.hidden(s);
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex((p) => p.code === "46029");
        if (i >= 0) {
          const [found] = zone.splice(i, 1);
          found.dealtTo = s.activePlayerId;
          s.encounter.dealt.push(found);
          break;
        }
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "eye": {
      const discarded = ports.mill(
        s,
        s.minions.some((p) => p.code === "46029") ? 3 : 2,
      );
      const effects = discarded.flatMap((p) =>
        ["energy", "mental", "physical", "wild"].flatMap((r) =>
          Array.from(
            {
              length: Number(
                (card(p) as unknown as Record<string, number>)[
                  `resource_${r}`
                ] || 0,
              ),
            },
            () =>
              r === "energy"
                ? E("threat", { target: "main", amount: 1 })
                : r === "mental"
                  ? I("discard-hand")
                  : r === "physical"
                    ? E("damage", { target: "hero", amount: 1 })
                    : I("exhaust-character"),
          ),
        ),
      );
      ports.queue(s, ...effects);
      break;
    }
    case "discard-hand":
      if (s.player.hand.length)
        ports.choose(
          s,
          "The Eye of Sauron",
          "Discard a card from hand.",
          s.player.hand.map((p) =>
            O(
              p.id,
              card(p).name,
              [I("discard-selected", { id: p.id })],
              p.code,
            ),
          ),
        );
      break;
    case "discard-selected":
      ports.discardHand(s, e.id);
      break;
    case "exhaust-character": {
      const possible = ports
        .characters(s)
        .filter((t) =>
          t.id === "hero"
            ? !s.player.exhausted
            : !ports.find(s, t.id)?.exhausted,
        );
      if (possible.length)
        ports.choose(
          s,
          "The Eye of Sauron",
          "Exhaust a character you control.",
          possible.map((p) =>
            O(p.id, p.label, [E("exhaust", { id: p.id })], p.code),
          ),
        );
      break;
    }
    case "shadows": {
      const zone = s.player.setAside || [],
        codes = ["46025", "46026", "46027", "46028", "46028"],
        pieces: Piece[] = [];
      for (const code of codes) {
        const i = zone.findIndex((p) => p.code === code);
        if (i >= 0) pieces.push(zone.splice(i, 1)[0]);
      }
      const pyro = pieces.find((p) => p.code === "46025"),
        scheme = pieces.find((p) => p.code === "46026");
      if (!pyro) ports.queue(s, E("surge", { sourceCode: "01190" }));
      else ports.putMinion(s, pyro);
      if (scheme) ports.queue(s, E("reveal", { piece: scheme }));
      s.encounter.deck.push(
        ...pieces.filter((p) => ![pyro?.id, scheme?.id].includes(p.id)),
      );
      ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Iceman effect: ${e.type}`);
  }
  return true;
}
