import {
  CARDS,
  DB,
  HEROES,
  VILLAINS,
  card,
  deckCodes,
  resources,
  heroCard,
  heroStats,
  handSize,
  has,
  maxHP,
  aerial,
  pieceHP,
  plain,
} from "./cards";
import type {
  Aspect,
  Attack,
  Card,
  Command,
  Effect,
  GameState,
  Option,
  Piece,
  Prompt,
  Resource,
} from "./types";
import {
  activateSeat,
  allInPlay,
  controller,
  engaged,
  playerOrder,
  seatView,
  syncSeat,
  upgradeSave,
} from "./team";
import {
  boardSnapshot,
  recordReview,
  continuesReview,
  mergeReviews,
} from "./review";
import { paymentSources, paymentStatus } from "./payment";
import { combatCharacter, recordCombat } from "./combat";
export { paymentSources } from "./payment";
export const SAVE_KEY = "champions.save.v1";
const E = (type: string, args: Record<string, any> = {}): Effect => ({
  type,
  ...args,
});
const option = (
  id: string,
  label: string,
  effects: Effect[],
  detail?: string,
  image?: string,
): Option => ({ id, label, effects, detail, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
export function log(
  s: GameState,
  text: string,
  kind: "info" | "good" | "bad" | "phase" = "info",
) {
  s.log.push({
    id: s.nextId++,
    round: s.round,
    text:
      s.playerCount > 1
        ? `${HEROES.find((h) => h.id === s.heroId)!.name} · ${text}`
        : text,
    kind,
  });
  if (s.log.length > 350) s.log.shift();
}
function random(s: GameState) {
  let x = s.seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.seed = x >>> 0;
  return s.seed / 4294967296;
}
function shuffle<T>(s: GameState, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function makePiece(s: GameState, code: string): Piece {
  return {
    id: `c${s.nextId++}`,
    code,
    ownerId:
      card(code).faction_code !== "encounter" ? s.activePlayerId : undefined,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: keyword(code, "Toughness"),
    stunned: false,
    confused: false,
  };
}
function keyword(p: Piece | string, name: string) {
  return new RegExp(`\\b${name}\\b`).test(
    plain(card(p).text).split(
      /(?:Action|Response|Interrupt|When Revealed|Boost):/,
    )[0],
  );
}
// A card that leaves play loses all memory of its previous instance (RRG 27).
function resetPiece(p: Piece, entering = false): Piece {
  return {
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: entering && keyword(p, "Toughness"),
    stunned: false,
    confused: false,
  };
}
function beginResolution(s: GameState, p: Piece) {
  if (!s.resolving.some((x) => x.id === p.id)) s.resolving.push(p);
}
function finishResolution(s: GameState, id: string) {
  const index = s.resolving.findIndex((p) => p.id === id);
  if (index < 0) return;
  const [p] = s.resolving.splice(index, 1);
  if (card(p).faction_code === "encounter")
    s.encounter.discard.push(resetPiece(p));
  else {
    const owner = s.players.find((seat) => seat.id === p.ownerId);
    if (owner?.eliminated) s.removed.push(resetPiece(p));
    else (owner ? seatView(s, owner) : s).player.discard.push(resetPiece(p));
  }
}
function add(s: GameState, ...effects: Effect[]) {
  s.queue.unshift(...effects.map((e) => ({ actorId: s.activePlayerId, ...e })));
}
function choose(
  s: GameState,
  title: string,
  text: string,
  options: Option[],
  cancelable = false,
) {
  if (!options.length) {
    log(s, `${title}: no eligible target.`);
    return;
  }
  s.prompt = { kind: "choice", title, text, options, cancelable };
}
function select(
  s: GameState,
  title: string,
  text: string,
  pieces: Piece[],
  min: number,
  max: number,
  action: Effect,
) {
  s.prompt = {
    kind: "select",
    title,
    text,
    options: pieces.map((p) =>
      option(p.id, card(p).name, [], plain(card(p).text), p.code),
    ),
    min,
    max,
    selectAction: action,
  };
}
const allPieces = (s: GameState) => [
  s.villain,
  ...s.minions,
  ...s.sideSchemes,
  ...allInPlay(s),
  ...s.attachments,
];
const find = (s: GameState, id: string) =>
  allPieces(s).find((p) => p.id === id);
const friends = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p).type_code === "ally");
const villainAt = (s: GameState, code: string) =>
  s.attachments.filter((p) => p.code === code && p.attachedTo === s.villain.id);
function discardHand(s: GameState, id: string) {
  const i = s.player.hand.findIndex((p) => p.id === id);
  need(i >= 0, "That card is no longer in your hand.");
  const [p] = s.player.hand.splice(i, 1);
  s.player.discard.push(p);
  return p;
}
function randomDiscard(s: GameState) {
  if (!s.player.hand.length) return undefined;
  return discardHand(
    s,
    s.player.hand[Math.floor(random(s) * s.player.hand.length)].id,
  );
}
function recyclePlayer(s: GameState) {
  if (!s.player.deck.length && s.player.discard.length) {
    s.player.deck = shuffle(s, s.player.discard.splice(0));
    dealEncounter(s);
    log(
      s,
      "Your deck reshuffles. You are dealt an extra encounter card.",
      "bad",
    );
  }
}
function takePlayer(s: GameState) {
  recyclePlayer(s);
  const p = s.player.deck.shift();
  if (p) recyclePlayer(s);
  return p;
}
function draw(s: GameState, n: number) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    const p = takePlayer(s);
    if (p) {
      s.player.hand.push(p);
      count++;
    }
  }
  if (count) log(s, `Draw ${count} card${count === 1 ? "" : "s"}.`);
}
function mill(s: GameState, n: number) {
  const a: Piece[] = [];
  const available = Math.min(n, s.player.deck.length);
  for (let i = 0; i < available; i++) {
    const p = s.player.deck.shift();
    if (p) {
      a.push(p);
      s.player.discard.push(p);
    }
  }
  recyclePlayer(s);
  return a;
}
function recycleEncounter(s: GameState) {
  if (!s.encounter.deck.length && s.encounter.discard.length) {
    s.encounter.deck = shuffle(s, s.encounter.discard.splice(0));
    s.encounter.acceleration++;
    log(s, "Encounter deck reshuffles: +1 acceleration token.", "bad");
  }
}
function drawEncounter(s: GameState) {
  recycleEncounter(s);
  const p = s.encounter.deck.shift();
  recycleEncounter(s);
  return p;
}
function dealEncounter(s: GameState, playerId = s.activePlayerId) {
  const p = drawEncounter(s);
  if (p) {
    p.dealtTo = playerId;
    s.encounter.dealt.push(p);
  }
}
function discardPiece(s: GameState, id: string) {
  const controlling = controller(s, id);
  let p: Piece | undefined;
  for (const zone of [
    ...s.players.map((x) => seatView(s, x).player.inPlay),
    s.minions,
    s.sideSchemes,
    s.attachments,
  ]) {
    const i = zone.findIndex((x) => x.id === id);
    if (i >= 0) {
      [p] = zone.splice(i, 1);
      break;
    }
  }
  if (!p) return;
  for (const a of [...allInPlay(s), ...s.attachments].filter(
    (a) => a.attachedTo === id,
  ))
    discardPiece(s, a.id);
  if (p.code === "drone") {
    if (p.droneCard) {
      const owner = s.players.find((x) => x.id === p!.droneCard!.ownerId);
      if (owner && !owner.eliminated)
        seatView(s, owner).player.discard.push(p.droneCard);
      else s.removed.push(p.droneCard);
    }
  } else if (card(p).faction_code === "encounter")
    s.encounter.discard.push(resetPiece(p));
  else {
    const owner =
      s.players.find((x) => x.id === p!.ownerId) ||
      controlling ||
      s.players.find((x) => x.id === s.activePlayerId)!;
    const discarded = resetPiece(p);
    if (owner.eliminated) s.removed.push(discarded);
    else seatView(s, owner).player.discard.push(discarded);
    const view = controlling ? seatView(s, controlling) : s;
    if (p.code === "01036") view.player.hp -= 6;
    if (p.code === "01039") view.player.hp--;
    view.player.hp = Math.min(view.player.hp, maxHP(view));
  }
}
function endGame(s: GameState, won: boolean, reason: string) {
  s.encounter.discard.push(
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  );
  if (s.attack) s.attack.pendingBoosts = [];
  if (s.scheming) s.scheming.pendingBoosts = [];
  for (const p of [...s.resolving]) finishResolution(s, p.id);
  s.phase = won ? "won" : "lost";
  s.result = reason;
  s.queue = [];
  s.prompt = null;
  log(s, reason, won ? "good" : "bad");
}
function check(s: GameState) {
  syncSeat(s);
  const active = s.activePlayerId;
  for (const seat of playerOrder(s)) {
    if (seatView(s, seat).player.hp <= 0) continue;
    activateSeat(s, seat.id);
    recyclePlayer(s);
  }
  activateSeat(s, active);
  recycleEncounter(s);
  for (const p of [
    ...s.minions,
    ...allInPlay(s).filter((x) => card(x).type_code === "ally"),
  ]) {
    if (find(s, p.id) && p.damage >= pieceHP(s, p)) defeatCharacter(s, p);
  }
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (
      friends(view).length > 3 + Number(has(view, "01073")) &&
      !(s.prompt?.title === "Ally limit" && s.activePlayerId === seat.id) &&
      !s.queue.some(
        (e) =>
          ["allyLimit", "discardForLimit"].includes(e.type) &&
          (e.actorId || s.activePlayerId) === seat.id,
      )
    )
      add(s, E("allyLimit", { actorId: seat.id }));
  }
  for (const seat of s.players) {
    seat.player.hp = Math.max(0, seat.player.hp);
    if (seat.player.hp > 0 || seat.eliminated || s.phase === "won") continue;
    seat.eliminated = true;
    seat.ended = true;
    if (s.attack?.targetPlayerId === seat.id) {
      s.encounter.discard.push(...(s.attack.pendingBoosts || []));
      for (const id of s.attack.boostIds || []) finishResolution(s, id);
      s.attack = null;
    }
    const i = s.players.indexOf(seat);
    const next = [...s.players.slice(i + 1), ...s.players.slice(0, i)].find(
      (p) => !p.eliminated,
    );
    log(
      s,
      `${HEROES.find((h) => h.id === seat.heroId)!.name} is defeated.${next ? " The remaining heroes continue the mission." : ""}`,
      "bad",
    );
    if (!next) {
      endGame(s, false, "Every hero has been defeated. The villain wins.");
      return;
    }
    if (s.firstPlayerId === seat.id) s.firstPlayerId = next.id;
    for (const m of s.minions)
      if (m.engagedWith === seat.id) m.engagedWith = next.id;
    for (const other of s.players) {
      const state = seatView(s, other).player;
      for (const key of ["hand", "deck", "discard", "inPlay"] as const) {
        for (const piece of [...state[key]])
          if (piece.ownerId === seat.id || other.id === seat.id) {
            if (key === "inPlay") discardPiece(s, piece.id);
            else {
              state[key].splice(state[key].indexOf(piece), 1);
              s.removed.push(piece);
            }
          }
      }
    }
    s.encounter.discard.push(
      ...s.encounter.dealt.filter((p) => p.dealtTo === seat.id),
    );
    s.encounter.dealt = s.encounter.dealt.filter((p) => p.dealtTo !== seat.id);
  }
}
export function schemeLimit(s: GameState) {
  return (
    (card(s.scheme.code).threat || 0) *
    (card(s.scheme.code).threat_fixed ? 1 : s.playerCount)
  );
}
export function escalation(s: GameState) {
  return (
    (card(s.scheme.code).escalation_threat || 0) *
    (card(s.scheme.code).escalation_threat_fixed ? 1 : s.playerCount)
  );
}
function eachPlayer(s: GameState, effect: Effect) {
  return playerOrder(s).map((p) => ({ ...effect, actorId: p.id }));
}
function choosePlayer(
  s: GameState,
  title: string,
  effects: Effect[],
  eligible = playerOrder(s),
) {
  if (eligible.length === 1) {
    add(s, ...effects.map((e) => ({ ...e, actorId: eligible[0].id })));
    return;
  }
  choose(
    s,
    title,
    "Choose which hero receives this effect.",
    eligible.map((p) =>
      option(
        p.id,
        HEROES.find((h) => h.id === p.heroId)!.name,
        effects.map((e) => ({ ...e, actorId: p.id })),
        undefined,
        heroCard(seatView(s, p)).code,
      ),
    ),
  );
}
function heal(s: GameState, target: string, n: number): number {
  if (target?.startsWith("hero:"))
    return heal(seatView(s, target.slice(5)), "hero", n);
  if (target === "hero") {
    const amount = Math.min(n, maxHP(s) - s.player.hp);
    s.player.hp += amount;
    log(s, `Heal ${amount} damage.`, "good");
  } else if (target === s.villain.id) {
    const amount = Math.min(n, s.villain.maxHp - s.villain.hp);
    s.villain.hp += amount;
    log(s, `${card(s.villain).name} heals ${amount}.`, "bad");
    return amount;
  } else {
    const p = find(s, target);
    if (p) p.damage = Math.max(0, p.damage - n);
  }
  return n;
}
function dealDamage(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  attack = false,
  overkill = false,
  panther = false,
) {
  const original = find(s, target);
  const code = original?.code;
  applyDamage(s, target, n, source, attack, overkill, panther);
  // Retaliate responds to the attack, even when its damage is prevented.
  // The attacked character must still be in play (a new villain stage is not it).
  if (
    attack &&
    original &&
    find(s, target)?.code === code &&
    !["won", "lost"].includes(s.phase)
  ) {
    const amount =
      target === s.villain.id
        ? villainAt(s, "01119").length + villainAt(s, "01153").length
        : code === "01184"
          ? 2
          : code === "01172"
            ? 1
            : 0;
    if (amount)
      add(s, E("damage", { target: source, amount, source: "retaliate" }));
  }
}
function applyDamage(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  attack = false,
  overkill = false,
  panther = false,
) {
  if (target?.startsWith("hero:")) {
    const prev = s.activePlayerId;
    activateSeat(s, target.slice(5));
    dealDamage(s, "hero", n, source, attack, overkill, panther);
    activateSeat(s, prev);
    return;
  }
  if (n <= 0) return;
  const p = target === "hero" ? s.player : find(s, target);
  if (!p) return;
  if (p.tough) {
    p.tough = false;
    log(s, "Tough prevents the damage.");
    return;
  }
  if (target === "hero") {
    s.player.hp -= n;
    log(s, `You take ${n} damage.`, "bad");
    check(s);
    return;
  }
  if (target === s.villain.id) {
    if (
      s.villainId === "ultron" &&
      s.villain.stage === 3 &&
      s.minions.some((p) => card(p).traits?.includes("Drone."))
    ) {
      log(s, "Ultron is protected by his drones.");
      return;
    }
    const armor = villainAt(s, "01098")[0];
    if (armor) {
      armor.damage += n;
      log(s, `Armored Rhino Suit absorbs ${n} damage.`);
      if (armor.damage >= 5) discardPiece(s, armor.id);
      return;
    }
    s.villain.hp -= n;
    log(s, `${card(s.villain).name} takes ${n} damage.`, "good");
    if (s.villain.hp <= 0) {
      advanceVillain(s);
      return;
    }
    if (villainAt(s, "01152").length) s.villain.tough = true;
    return;
  }
  const m = find(s, target)!;
  if (m.code === "01157" && panther) {
    log(s, "Killmonger is immune to Black Panther upgrades.");
    return;
  }
  if (m.code === "01181" && s.sideSchemes.some((x) => x.code === "01180")) {
    log(s, "Legions of Hydra protects Madame Hydra.");
    return;
  }
  const remain = pieceHP(s, m) - m.damage;
  m.damage += n;
  log(s, `${card(m).name} takes ${n} damage.`, "good");
  if (m.damage >= pieceHP(s, m)) {
    const defeated = defeatCharacter(s, m, source, attack);
    if (defeated && overkill && n > remain)
      dealDamage(s, s.villain.id, n - remain, source, false);
  }
}
function defeatCharacter(s: GameState, m: Piece, source = "", attack = false) {
  const bio = s.attachments.find(
    (a) => a.code === "01185" && a.attachedTo === m.id,
  );
  if (bio) {
    m.damage = 0;
    discardPiece(s, bio.id);
    log(s, "Biomechanical Upgrades restores the minion.");
    return false;
  }
  const minion = s.minions.some((x) => x.id === m.id);
  const tracers = allInPlay(s).filter(
    (a) => a.code === "01007" && a.attachedTo === m.id,
  );
  const name = card(m).name;
  discardPiece(s, m.id);
  log(s, `${name} is defeated.`, "good");
  if (minion) {
    s.flags.defeatedMinion = true;
    if (source === "hero" && attack) s.flags.heroKill = true;
    for (const tracer of tracers)
      add(
        s,
        E("target", {
          actorId: tracer.ownerId || s.activePlayerId,
          group: "scheme",
          action: E("thwart", { amount: 3 }),
          title: "Spider-Tracer",
        }),
      );
    const room = s.player.inPlay.find(
      (p) => p.code === "01063" && !p.exhausted,
    );
    if (room)
      add(
        s,
        E("optional", {
          title: "Interrogation Room",
          text: "Exhaust Interrogation Room to remove 1 threat?",
          effects: [
            E("exhaust", { id: room.id }),
            E("target", {
              group: "scheme",
              action: E("thwart", { amount: 1 }),
              title: "Interrogation Room",
            }),
          ],
        }),
      );
    if (m.code === "01143")
      add(s, E("drone", { actorId: m.engagedWith || s.activePlayerId }));
    if (m.code === "01182") dealEncounter(s, m.engagedWith);
    const tigra = find(s, source);
    if (tigra?.code === "01051") tigra.damage = Math.max(0, tigra.damage - 1);
  }
  return true;
}
function advanceVillain(s: GameState) {
  const last = s.difficulty === "expert" ? 3 : 2;
  if (s.villain.stage === last) {
    endGame(
      s,
      true,
      `${card(s.villain).name} is defeated. The city is safe — for now.`,
    );
    return;
  }
  const config = VILLAINS.find((v) => v.id === s.villainId)!;
  s.villain.stage++;
  s.villain.code = config.codes[s.villain.stage - 1];
  s.villain.maxHp =
    card(s.villain).health! * s.playerCount +
    (s.sideSchemes.some((p) => p.code === "01127") ? 10 : 0);
  s.villain.hp = s.villain.maxHp;
  s.villain.tough = keyword(s.villain, "Toughness");
  log(s, `${config.name} advances to stage ${s.villain.stage}!`, "bad");
  villainSetup(s);
}
function villainSetup(s: GameState) {
  if (s.villain.code === "01095")
    add(s, E("searchEncounter", { code: "01107", reveal: true }));
  if (s.villain.code === "01096")
    for (const seat of playerOrder(s))
      if (seatView(s, seat).player.form === "hero")
        seatView(s, seat).player.stunned = true;
  if (s.villain.code === "01114")
    add(s, E("searchEncounter", { code: "01127", reveal: true }));
  if (s.villain.code === "01136")
    add(s, E("searchEncounter", { code: "01150", reveal: true }));
}
function threat(
  s: GameState,
  target: string,
  n: number,
  skipInterrupt = false,
) {
  if (n <= 0) return;
  if (!skipInterrupt) {
    const opts: Option[] = [];
    for (const seat of playerOrder(s)) {
      const v = seatView(s, seat),
        name = HEROES.find((h) => h.id === seat.heroId)!.name;
      if (
        v.heroId === "she_hulk" &&
        v.player.form === "alter" &&
        !v.flags.objection
      )
        opts.push(
          option(
            `object${s.playerCount > 1 ? `:${seat.id}` : ""}`,
            `${s.playerCount > 1 ? `${name} · ` : ""}I Object!`,
            [
              E("flag", { actorId: seat.id, key: "objection", value: true }),
              E("threat", {
                actorId: s.activePlayerId,
                target,
                amount: Math.max(0, n - 1),
                skip: true,
              }),
            ],
            "Prevent 1 threat.",
          ),
        );
      const gr = v.player.hand.find((p) => p.code === "01061");
      if (gr && v.player.form === "hero")
        opts.push(
          option(
            `responsibility${s.playerCount > 1 ? `:${seat.id}` : ""}`,
            `${s.playerCount > 1 ? `${name} · ` : ""}Great Responsibility`,
            [
              E("resolveHandEvent", {
                actorId: seat.id,
                id: gr.id,
                after: [E("damage", { target: "hero", amount: n })],
              }),
            ],
            `Take ${n} damage instead.`,
          ),
        );
    }
    if (opts.length) {
      opts.push(
        option("allow", `Place ${n} threat`, [
          E("threat", { target, amount: n, skip: true }),
        ]),
      );
      choose(
        s,
        "Threat incoming",
        `${n} threat will be placed on ${target === "main" ? card(s.scheme.code).name : card(find(s, target)!).name}.`,
        opts,
      );
      return;
    }
  }
  if (target === "main") {
    s.scheme.threat += n;
    log(s, `+${n} threat on ${card(s.scheme.code).name}.`, "bad");
    if (s.scheme.threat >= schemeLimit(s)) {
      const v = VILLAINS.find((v) => v.id === s.villainId)!;
      if (s.scheme.index >= v.schemes.length - 1) {
        endGame(
          s,
          false,
          `${card(s.scheme.code).name} is complete. The villain's plan succeeds.`,
        );
        return;
      }
      s.scheme.index++;
      s.scheme.code = v.schemes[s.scheme.index];
      s.scheme.threat =
        (card(s.scheme.code).base_threat || 0) *
        (card(s.scheme.code).base_threat_fixed ? 1 : s.playerCount);
      log(s, `The main scheme advances: ${card(s.scheme.code).name}.`, "bad");
      add(
        s,
        ...(s.villainId === "klaw"
          ? [E("findMinion", { actorId: s.firstPlayerId })]
          : eachPlayer(s, E("drone"))),
      );
    }
  } else {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (p) p.counters += n;
  }
}
function thwart(s: GameState, target: string, n: number) {
  if (target === "main") {
    if (
      s.sideSchemes.some((p) => card(p).scheme_crisis) ||
      s.scheme.code === "01139b"
    ) {
      log(s, "Threat cannot be removed from the main scheme.");
      return 0;
    }
    const removed = Math.min(n, s.scheme.threat);
    s.scheme.threat -= removed;
    log(s, `Remove ${removed} threat from the main scheme.`, "good");
    return removed;
  } else {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (!p) return 0;
    const removed = Math.min(n, p.counters);
    p.counters = Math.max(0, p.counters - n);
    log(s, `Remove ${removed} threat from ${card(p).name}.`, "good");
    if (!p.counters) {
      log(s, `${card(p).name} is defeated.`, "good");
      if (p.code === "01166" && p.captured)
        for (const x of p.captured) {
          const owner = s.players.find((a) => a.id === x.ownerId);
          if (owner && !owner.eliminated)
            seatView(s, owner).player.hand.push(x);
          else s.removed.push(x);
        }
      if (p.code === "01127") {
        s.villain.maxHp -= 10;
        s.villain.hp -= 10;
      }
      discardPiece(s, p.id);
      if (s.villain.hp <= 0) advanceVillain(s);
    }
    return removed;
  }
}
export function targets(
  s: GameState,
  group: string,
  attack = false,
): { id: string; label: string; code?: string }[] {
  switch (group) {
    case "character":
      return [...targets(s, "friendly"), ...targets(s, "enemy")];
    case "enemy":
      return [
        ...(!attack || !engaged(s).some((p) => card(p).text?.includes("Guard."))
          ? [
              {
                id: s.villain.id,
                label: card(s.villain).name,
                code: s.villain.code,
              },
            ]
          : []),
        ...s.minions.map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
      ];
    case "minion":
      return s.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      }));
    case "scheme":
      return [
        ...(!s.sideSchemes.some((p) => card(p).scheme_crisis) &&
        s.scheme.code !== "01139b" &&
        s.scheme.threat > 0
          ? [
              {
                id: "main",
                label: card(s.scheme.code).name,
                code: s.scheme.code,
              },
            ]
          : []),
        ...s.sideSchemes
          .filter((p) => p.counters > 0)
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
      ];
    case "ally":
      return allInPlay(s)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        }));
    case "controlled":
      return [
        { id: "hero", label: heroCard(s).name, code: heroCard(s).code },
        ...friends(s).map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
      ];
    case "friendly":
      return [
        ...playerOrder(s).map((p) => ({
          id: p.id === s.activePlayerId ? "hero" : `hero:${p.id}`,
          label: heroCard(seatView(s, p)).name,
          code: heroCard(seatView(s, p)).code,
        })),
        ...targets(s, "ally"),
      ];
    default:
      return [];
  }
}
function targetPrompt(s: GameState, e: Effect) {
  const source = e.action.source || e.action.id || "hero";
  const character = source === "hero" ? s.player : find(s, source);
  if (
    (e.action.attack && character?.stunned) ||
    ((e.action.action ||
      (e.action.type === "allyAction" && e.action.kind === "thwart")) &&
      character?.confused)
  ) {
    add(s, { ...e.action, target: "" });
    return;
  }
  const list = targets(s, e.group, !!e.action.attack).filter(
    (t) => !e.exclude || t.id !== e.exclude,
  );
  if (list.length === 1) {
    add(s, { ...e.action, target: list[0].id });
    return;
  }
  choose(
    s,
    e.title || "Choose a target",
    e.text || "Select the target for this effect.",
    list.map((t) =>
      option(t.id, t.label, [{ ...e.action, target: t.id }], undefined, t.code),
    ),
  );
}
function attackAction(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  overkill = false,
  panther = false,
) {
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (p.stunned) {
    p.stunned = false;
    if (source === "hero") s.flags.basicAttack = false;
    log(s, "Stunned is removed instead of attacking.");
    return;
  }
  if (!targets(s, "enemy", true).some((t) => t.id === target)) {
    log(s, "The attack has no eligible target.");
    return;
  }
  const attacker = combatCharacter(s, source);
  const defender = combatCharacter(s, target);
  dealDamage(s, target, n, source, true, overkill, panther);
  recordCombat(s, attacker, defender, target, false);
  if (source === "hero") {
    const strengths = s.player.inPlay.filter((p) => p.code === "01028");
    for (const st of strengths) {
      const enemy = find(s, target);
      if (enemy && !enemy.stunned) {
        enemy.stunned = true;
        discardPiece(s, st.id);
      }
    }
  }
}
function thwartAction(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
) {
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (p.confused) {
    p.confused = false;
    log(s, "Confused is removed instead of thwarting.");
    return;
  }
  thwart(s, target, n);
}
function requestPayment(
  s: GameState,
  title: string,
  cost: number,
  after: Effect[],
  requirements: Resource[] = [],
  piece?: Piece,
  cancelable = false,
  targetCode?: string,
) {
  if (cost === 0 && !requirements.length) {
    add(s, ...after.map((e) => ({ ...e, paid: [] })));
    return;
  }
  s.prompt = {
    kind: "payment",
    title,
    text: "Choose cards to spend as resources. Cards spent from your hand are discarded.",
    options: [],
    cost,
    requirements,
    card: piece,
    after,
    cancelable,
    paymentTarget: targetCode || piece?.code,
    wildAs: requirements[0] || "energy",
  };
}
function pay(s: GameState, ids: string[], wildAs: Resource = "energy") {
  const p = s.prompt!;
  need(p?.kind === "payment", "No payment is pending.");
  need(new Set(ids).size === ids.length, "Choose each resource source once.");
  const sources = paymentSources(s, p.card?.id, p.paymentTarget);
  const selected = ids.map((id) => sources.find((x) => x.id === id));
  need(selected.every(Boolean), "A selected resource is unavailable.");
  const { printed, missing } = paymentStatus(
    sources,
    ids,
    p.cost || 0,
    p.requirements,
  );
  need(printed.length >= (p.cost || 0), "Not enough resources.");
  need(!missing.length, `You need a ${missing[0]} resource.`);
  const req = [...(p.requirements || [])];
  for (const id of ids) {
    if (id === "scientist") s.flags.scientist = true;
    else if (s.player.hand.some((x) => x.id === id)) discardHand(s, id);
    else {
      const source = find(s, id)!;
      source.exhausted = true;
      if (source.code === "01008") {
        source.counters--;
        if (!source.counters) discardPiece(s, id);
      }
    }
  }
  const paid = printed.map((r) => (r === "wild" ? wildAs : r));
  for (const k of req) if (!paid.includes(k)) paid.push(k);
  s.prompt = null;
  log(
    s,
    `Paid ${printed.length} resource${printed.length === 1 ? "" : "s"} for ${p.title}: ${selected.map((x) => x!.name).join(", ")}.`,
  );
  add(s, ...(p.after || []).map((e) => ({ ...e, paid })));
}
export function newGame(config: {
  heroId: string;
  aspect: Aspect;
  villainId: string;
  difficulty?: "standard" | "expert";
  module?: string;
  seed?: number;
  heroes?: { heroId: string; aspect: Aspect }[];
  guided?: boolean;
}): GameState {
  const team = config.heroes || [
    { heroId: config.heroId, aspect: config.aspect },
  ];
  need(team.length >= 1 && team.length <= 3, "Choose one to three heroes.");
  need(
    new Set(team.map((p) => p.heroId)).size === team.length,
    "Each hero may only join the team once.",
  );
  need(
    team.every((p) => HEROES.some((h) => h.id === p.heroId)),
    "Unknown hero.",
  );
  const v = VILLAINS.find((v) => v.id === config.villainId) || VILLAINS[0];
  const difficulty = config.difficulty || "standard",
    stage = difficulty === "expert" ? 2 : 1;
  const players = team.map((h, i) => ({
    id: `p${i + 1}`,
    ...h,
    ended: false,
    eliminated: false,
    mulliganDone: false,
    flags: {},
    player: {
      form: "alter" as const,
      hp: card(HEROES.find((x) => x.id === h.heroId)!.code).health!,
      exhausted: false,
      flipped: false,
      stunned: false,
      confused: false,
      tough: false,
      hand: [] as Piece[],
      deck: [] as Piece[],
      discard: [] as Piece[],
      inPlay: [] as Piece[],
    },
  }));
  const hp = card(v.codes[stage - 1]).health! * team.length;
  const s: GameState = {
    version: 1,
    seed: config.seed || Date.now() >>> 0 || 1,
    nextId: 1,
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId: v.id,
    difficulty,
    module: config.module || v.module,
    phase: "mulligan",
    round: 1,
    players,
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: team.length,
    guided: config.guided ?? false,
    review: null,
    reviewCount: 0,
    player: players[0].player,
    villain: {
      id: "villain",
      code: v.codes[stage - 1],
      hp,
      maxHp: hp,
      stage,
      exhausted: false,
      damage: 0,
      counters: 0,
      tough: keyword(v.codes[stage - 1], "Toughness"),
      stunned: false,
      confused: false,
    },
    scheme: { code: v.schemes[0], threat: 0, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    prompt: null,
    queue: [],
    log: [],
    flags: players[0].flags,
    attack: null,
  };
  for (const seat of players) {
    activateSeat(s, seat.id);
    s.player.deck = shuffle(
      s,
      deckCodes(seat.heroId, seat.aspect).map((c) => makePiece(s, c)),
    );
    draw(s, handSize(s));
  }
  activateSeat(s, "p1");
  s.encounter.deck = shuffle(
    s,
    CARDS.filter(
      (c) =>
        c.faction_code === "encounter" &&
        (((c.set_code === s.module ||
          c.set_code === v.id ||
          c.set_code === "standard" ||
          (difficulty === "expert" && c.set_code === "expert")) &&
          !["villain", "main_scheme", "environment"].includes(c.type_code)) ||
          (team.some((h) => h.heroId === c.set_code) &&
            c.type_code === "obligation")),
    ).flatMap((c) =>
      Array.from({ length: c.quantity }, () => makePiece(s, c.code)),
    ),
  );
  log(
    s,
    `${team.length} hero${team.length > 1 ? "es" : ""} vs. ${v.name} · ${difficulty}. Confirm each opening hand.`,
    "phase",
  );
  syncSeat(s);
  return s;
}
function initialSetup(s: GameState) {
  activateSeat(s, s.firstPlayerId);
  s.phase = "player";
  log(s, "Round 1 · Hero phase", "phase");
  const setup: Effect[] = [];
  for (const seat of playerOrder(s))
    if (seat.heroId === "black_panther")
      setup.push(
        E("searchDeck", {
          actorId: seat.id,
          trait: "Black Panther.",
          title: "Foresight",
        }),
      );
  if (s.villainId === "klaw")
    setup.push(
      E("searchEncounter", {
        code: "01125",
        reveal: true,
        actorId: s.firstPlayerId,
      }),
      E("findMinion", { actorId: s.firstPlayerId }),
    );
  if (s.villainId === "ultron") setup.push(...eachPlayer(s, E("drone")));
  // Queue stage setup after scenario setup and before the first turn.
  add(
    s,
    ...setup,
    E("stageSetup"),
    E("beginTurn", { actorId: s.firstPlayerId }),
  );
}
const reactionCards = ["01003", "01004", "01061", "01077", "01078", "01085"];
export function playable(s: GameState, p: Piece): string | null {
  const c = card(p);
  if (s.phase !== "player" || s.prompt || s.review)
    return "Finish the current decision first.";
  if (
    s.activePlayerId !== s.turnPlayerId &&
    !(c.type_code === "event" && c.text?.includes("Action"))
  )
    return "Only Action events can be played during a teammate’s turn.";
  if (c.type_code === "resource")
    return "Spend this card to pay for another card.";
  if (reactionCards.includes(p.code))
    return "Available automatically during its reaction window.";
  if (
    (c.text?.includes("<b>Hero Action") ||
      c.text?.includes("Hero form only")) &&
    s.player.form !== "hero"
  )
    return "Change to hero form first.";
  if (c.text?.includes("<b>Alter-Ego Action") && s.player.form !== "alter")
    return "Change to alter-ego form first.";
  if (c.is_unique && allInPlay(s).some((x) => card(x).name === c.name))
    return "This unique card is already in play.";
  if (
    c.text?.includes("Max 1 per player") &&
    (c.text?.includes("any player")
      ? playerOrder(s).every((p) => has(seatView(s, p), c.code))
      : has(s, c.code))
  )
    return "You already control one.";
  if (p.code === "01024" && !s.flags.basicAttack)
    return "Play immediately after your basic attack.";
  if (p.code === "01023" && s.player.hand.length < 2)
    return "Legal Practice requires at least one other card to discard.";
  if (p.code === "01052" && !s.flags.heroKill)
    return "Play after your hero attacks and defeats an enemy.";
  if (p.code === "01007" && !s.minions.length)
    return "A minion must be in play.";
  if (
    ["01069", "01074"].includes(p.code) &&
    !allInPlay(s).some((p) => card(p).type_code === "ally")
  )
    return "You need an ally in play.";
  if (p.code === "01053" && !s.minions.length && !s.player.stunned)
    return "There is no minion to attack.";
  if (
    p.code.startsWith("01043") &&
    !s.player.inPlay.some((p) => card(p).traits?.includes("Black Panther."))
  )
    return "Play a Black Panther upgrade first.";
  if (
    p.code === "01071" &&
    !s.players
      .flatMap((p) => seatView(s, p).player.discard)
      .some(
        (x) =>
          card(x).type_code === "ally" &&
          !allInPlay(s).some((p) => card(p).name === card(x).name) &&
          paymentSources(s, p.id, x.code).reduce(
            (n, p) => n + p.resources.length,
            0,
          ) >= card(x).cost!,
      )
  )
    return "No affordable ally in your discard pile.";
  const available = paymentSources(s, p.id, p.code).reduce(
    (n, p) => n + p.resources.length,
    0,
  );
  if (available < Math.max(0, (c.cost || 0) - Number(s.flags.discount || 0)))
    return "Not enough resources in your hand or play area.";
  return null;
}
function play(s: GameState, p: Piece, paid: Resource[] = []) {
  const c = card(p);
  const i = s.player.hand.findIndex((x) => x.id === p.id);
  need(i >= 0, "Card is no longer in hand.");
  s.player.hand.splice(i, 1);
  s.flags.discount = 0;
  log(s, `Play ${c.name}.`, "good");
  s.flags.basicAttack = false;
  s.flags.heroKill = false;
  if (c.type_code === "event") {
    beginResolution(s, p);
    add(s, E("finishResolution", { id: p.id }));
    if (c.text?.includes("(attack)") && s.player.stunned) {
      s.player.stunned = false;
      log(s, `Stunned cancels ${c.name}.`);
      return;
    }
    if (
      p.code !== "01023" &&
      c.text?.includes("(thwart)") &&
      s.player.confused
    ) {
      s.player.confused = false;
      log(s, `Confused cancels ${c.name}.`);
      return;
    }
    event(s, p, paid);
  } else {
    Object.assign(p, resetPiece(p, true));
    s.player.inPlay.push(p);
    if (["01057", "01065", "01081"].includes(p.code) && s.playerCount > 1)
      choosePlayer(
        s,
        c.name,
        [E("transferUpgrade", { id: p.id })],
        playerOrder(s).filter(
          (seat) =>
            !seatView(s, seat).player.inPlay.some(
              (x) => x.code === p.code && x.id !== p.id,
            ),
        ),
      );
    if (["01008", "01056", "01064", "01080"].includes(p.code)) p.counters = 3;
    if (p.code === "01066") p.counters = 4;
    if (p.code === "01036") s.player.hp += 6;
    if (p.code === "01039") s.player.hp++;
    if (c.type_code === "ally")
      add(s, E("allyLimit"), E("allyEnter", { id: p.id }));
    if (["01007", "01009", "01074"].includes(p.code))
      add(
        s,
        E("target", {
          group:
            p.code === "01007"
              ? "minion"
              : p.code === "01009"
                ? "enemy"
                : "ally",
          title: c.name,
          action: E("attachPlayer", { id: p.id }),
        }),
      );
  }
}
function allyEnter(s: GameState, p: Piece) {
  switch (p.code) {
    case "01002": {
      const cards = mill(s, 2);
      for (const x of cards)
        if (
          card(x).resource_mental &&
          s.player.discard.some((p) => p.id === x.id)
        ) {
          s.player.discard = s.player.discard.filter((y) => y.id !== x.id);
          s.player.hand.push(x);
        }
      break;
    }
    case "01011":
      s.villain.confused = true;
      break;
    case "01041":
      add(s, E("searchDeck", { typeCode: "upgrade", title: "Shuri" }));
      break;
    case "01067":
      add(s, ...eachPlayer(s, E("draw", { amount: 1 })));
      break;
    case "01083":
      add(
        s,
        E("target", {
          group: "enemy",
          title: "Mockingbird",
          action: E("status", { status: "stunned" }),
        }),
      );
      break;
    case "01084":
      choose(s, "Nick Fury", "Choose Nick Fury’s entrance effect.", [
        option("draw", "Draw 3 cards", [E("draw", { amount: 3 })]),
        option("damage", "Deal 4 damage", [
          E("target", {
            group: "enemy",
            action: E("damage", { amount: 4 }),
            title: "Nick Fury",
          }),
        ]),
        option("thwart", "Remove 2 threat", [
          E("target", {
            group: "scheme",
            action: E("thwart", { amount: 2 }),
            title: "Nick Fury",
          }),
        ]),
      ]);
      break;
  }
}
function event(s: GameState, p: Piece, paid: Resource[]) {
  const a = (amount: number, extra: Record<string, any> = {}) =>
    E("target", {
      group: "enemy",
      title: card(p).name,
      action: E("damage", { amount, attack: true, ...extra }),
    });
  const t = (amount: number) =>
    E("target", {
      group: "scheme",
      title: card(p).name,
      action: E("thwart", { amount, action: true }),
    });
  switch (p.code) {
    case "01005":
      add(s, a(8));
      break;
    case "01012":
      add(
        s,
        E("target", {
          group: "scheme",
          title: "Crisis Interdiction",
          action: E("crisisInterdiction"),
        }),
      );
      break;
    case "01013":
      add(
        s,
        a(5),
        ...(paid.includes("energy") ? [E("draw", { amount: 1 })] : []),
      );
      break;
    case "01021":
      add(s, a(Math.min(15, maxHP(s) - s.player.hp)));
      break;
    case "01022":
      add(
        s,
        ...targets(s, "enemy").map((x) =>
          E("damage", { target: x.id, amount: 1 }),
        ),
      );
      break;
    case "01023":
      select(
        s,
        "Legal Practice",
        s.player.confused
          ? "Discard 1–5 cards to pay the additional cost. Confused then cancels the thwart: remove Confused, but no threat."
          : "Discard 1–5 cards to pay the additional cost. Remove 1 threat per card.",
        s.player.hand,
        1,
        Math.min(5, s.player.hand.length),
        E("legalPractice"),
      );
      break;
    case "01024":
      s.player.exhausted = false;
      s.flags.basicAttack = false;
      break;
    case "01025":
      flip(s, false);
      draw(s, Math.max(0, heroCard(s).hand_size! - s.player.hand.length));
      break;
    case "01031": {
      const aCards = mill(s, 5);
      const amount =
        1 + aCards.reduce((n, p) => n + (card(p).resource_energy || 0) * 2, 0);
      log(
        s,
        `Repulsor Blast reveals ${aCards.map((p) => card(p).name).join(", ")}: ${amount} damage.`,
      );
      add(s, a(amount));
      break;
    }
    case "01032":
      add(s, a(aerial(s) ? 8 : 4));
      break;
    case "01042": {
      const unique = s.player.discard.filter(
        (p, i, a) => a.findIndex((x) => card(x).name === card(p).name) === i,
      );
      select(
        s,
        "Ancestral Knowledge",
        "Shuffle up to 3 different cards into your deck.",
        unique,
        0,
        3,
        E("ancestral"),
      );
      break;
    }
    case "01043a":
    case "01043b":
    case "01043c":
    case "01043d":
      add(
        s,
        E("wakanda", {
          remaining: s.player.inPlay
            .filter((x) => card(x).traits?.includes("Black Panther."))
            .map((x) => x.id),
        }),
      );
      break;
    case "01052":
      add(s, t(2));
      break;
    case "01053":
      add(
        s,
        E("target", {
          group: "minion",
          title: "Relentless Assault",
          action: E("damage", {
            amount: 5,
            attack: true,
            overkill: paid.includes("physical"),
          }),
        }),
      );
      break;
    case "01054":
      add(s, a(5));
      break;
    case "01060":
      add(s, t(paid.includes("mental") ? 4 : 3));
      break;
    case "01069":
      add(
        s,
        E("target", { group: "ally", title: "Get Ready", action: E("ready") }),
      );
      break;
    case "01070":
      choosePlayer(s, "Lead from the Front", [E("lead")]);
      break;
    case "01071": {
      const opts = s.players
        .filter((p) => !p.eliminated)
        .flatMap((p) => seatView(s, p).player.discard)
        .filter(
          (x) =>
            card(x).type_code === "ally" &&
            !allInPlay(s).some((y) => card(x).name === card(y).name) &&
            paymentSources(s, undefined, x.code).reduce(
              (n, p) => n + p.resources.length,
              0,
            ) >= card(x).cost!,
        )
        .map((x) =>
          option(
            x.id,
            card(x).name,
            [
              E("payRequest", {
                title: "Make the Call",
                cost: card(x).cost,
                targetCode: x.code,
                after: [E("returnAlly", { id: x.id })],
              }),
            ],
            `Cost ${card(x).cost}`,
            x.code,
          ),
        );
      choose(
        s,
        "Make the Call",
        "Choose an ally from any hero’s discard pile.",
        opts,
      );
      break;
    }
    case "01086":
      add(
        s,
        E("target", {
          group: "character",
          title: "First Aid",
          action: E("heal", { amount: 2 }),
        }),
      );
      break;
    case "01087":
      add(s, a(3));
      break;
    default:
      throw Error(`No player event script for ${p.code}.`);
  }
}
function flip(s: GameState, counts = true) {
  if (counts) {
    need(!s.player.flipped, "You already changed form this turn.");
    s.player.flipped = true;
  }
  s.player.form = s.player.form === "hero" ? "alter" : "hero";
  log(s, `Change form to ${heroCard(s).name}.`);
  if (s.player.form === "hero" && s.heroId === "she_hulk")
    add(
      s,
      E("target", {
        group: "enemy",
        title: "Do You Even Lift?",
        action: E("damage", { amount: 2 }),
      }),
    );
}
export function abilityOptions(
  s: GameState,
  p: Piece,
): { id: string; label: string; disabled?: string }[] {
  const c = card(p);
  const hero = s.player.form === "hero";
  if (c.type_code === "ally")
    return [
      {
        id: "attack",
        label: `Attack ${allyStat(s, p, "attack")}`,
        disabled: p.exhausted ? "Exhausted" : undefined,
      },
      {
        id: "thwart",
        label: `Thwart ${allyStat(s, p, "thwart")}`,
        disabled: p.exhausted ? "Exhausted" : undefined,
      },
      ...(["01020", "01030", "01068"].includes(p.code)
        ? [
            {
              id: "special",
              label:
                p.code === "01020"
                  ? "Return to hand"
                  : p.code === "01030"
                    ? "Suppressive fire"
                    : "Density control",
              disabled:
                p.code === "01020" || p.code === "01068"
                  ? undefined
                  : p.exhausted
                    ? "Exhausted"
                    : undefined,
            },
          ]
        : []),
    ];
  const labels: Record<string, string> = {
    "01006": "Heal Peter Parker · 4",
    "01015": "Cycle a card",
    "01018": "Charge energy",
    "01026": "Remove 2 threat",
    "01027": "Take 1 damage · draw 1",
    "01034": "Recover a Tech upgrade",
    "01035": "Ready Iron Man",
    "01037": "Remove 1 threat",
    "01038": `Deal ${aerial(s) ? 2 : 1} damage`,
    "01039": "Gain Aerial",
    "01045": "Draw 2 cards",
    "01056": "Deal 2 damage",
    "01064": "Remove 1 threat",
    "01080": "Heal 2 damage",
    "01091": "Draw 1 card",
    "01092": "Next card costs 1 less",
    "01093": "Ready your hero",
  };
  if (!labels[p.code]) return [];
  const alterOnly = ["01006", "01026", "01034", "01045"].includes(p.code);
  const heroOnly = [
    "01027",
    "01035",
    "01037",
    "01038",
    "01039",
    "01093",
  ].includes(p.code);
  const disabled = p.exhausted
    ? "Exhausted"
    : alterOnly && hero
      ? "Alter-ego form required"
      : heroOnly && !hero
        ? "Hero form required"
        : undefined;
  return [
    { id: "special", label: labels[p.code], disabled },
    ...(p.code === "01018"
      ? [
          {
            id: "fire",
            label: `Release ${Math.min(10, p.counters * 2)} damage`,
            disabled: !hero
              ? "Hero form required"
              : !p.counters
                ? "Charge first"
                : undefined,
          },
        ]
      : []),
  ];
}
function allyStat(s: GameState, p: Piece, kind: "attack" | "thwart") {
  return (
    (card(p)[kind] || 0) +
    Number(s.flags.lead || 0) +
    allInPlay(s).filter((x) => x.code === "01074" && x.attachedTo === p.id)
      .length +
    (kind === "attack"
      ? p.bonusAtk || 0
      : (p.bonusThw || 0) + (p.code === "01059" ? s.sideSchemes.length : 0))
  );
}
function ability(s: GameState, id: string, action = "special") {
  if (id === "identity") {
    if (s.player.form === "alter") {
      if (s.heroId === "captain_marvel") {
        need(!s.flags.commander, "Commander has been used this round.");
        s.flags.commander = true;
        choosePlayer(s, "Commander", [E("draw", { amount: 1 })]);
      } else if (s.heroId === "iron_man") {
        need(!s.flags.futurist, "Futurist has been used this round.");
        need(s.player.deck.length, "There are no cards to look at.");
        s.flags.futurist = true;
        const looked = s.player.deck.slice(0, 3);
        const options = looked.map((p) =>
          option(
            p.id,
            card(p).name,
            [E("futurist", { id: p.id, ids: looked.map((x) => x.id) })],
            plain(card(p).text),
            p.code,
          ),
        );
        choose(
          s,
          "Futurist",
          "Keep one of the top 3 cards. Discard the others.",
          options,
        );
      } else
        throw Error(
          "This identity ability is automatic or available during payment.",
        );
    } else if (s.heroId === "captain_marvel") {
      need(
        !s.flags.rechannel && s.player.hp < maxHP(s),
        "Rechannel requires damage and is once per round.",
      );
      requestPayment(
        s,
        "Rechannel",
        1,
        [
          E("flag", { key: "rechannel", value: true }),
          E("heal", { target: "hero", amount: 1 }),
          E("draw", { amount: 1 }),
        ],
        ["energy"],
        undefined,
        true,
      );
    } else throw Error("This hero ability triggers automatically.");
    return;
  }
  const p = s.player.inPlay.find((p) => p.id === id);
  need(p, "This hero does not control that card.");
  const x = p!;
  const choices = abilityOptions(s, x);
  const selected = choices.find((o) => o.id === action);
  need(
    selected && !selected.disabled,
    selected?.disabled || "Ability unavailable.",
  );
  if (card(x).type_code === "ally" && ["attack", "thwart"].includes(action)) {
    x.exhausted = true;
    add(
      s,
      E("target", {
        group: action === "attack" ? "enemy" : "scheme",
        title: card(x).name,
        action: E("allyAction", {
          id,
          kind: action,
          attack: action === "attack",
          amount: allyStat(s, x, action as "attack" | "thwart"),
        }),
      }),
    );
    return;
  }
  const activate = (...eff: Effect[]) => add(s, E("exhaust", { id }), ...eff);
  switch (x.code) {
    case "01006":
      need(s.player.hp < maxHP(s), "Peter Parker is already at full health.");
      activate(E("heal", { target: "hero", amount: 4 }));
      break;
    case "01015":
      need(s.player.hand.length, "You need a card to discard.");
      select(
        s,
        "Alpha Flight Station",
        "Choose 1 card to discard.",
        s.player.hand,
        1,
        1,
        E("alpha", { id }),
      );
      break;
    case "01018":
      if (action === "fire") {
        const n = Math.min(10, x.counters * 2);
        discardPiece(s, id);
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Energy Channel",
            action: E("damage", { amount: n, attack: true }),
          }),
        );
      } else
        requestPayment(
          s,
          "Energy Channel",
          1,
          [E("chargeEnergy", { id })],
          ["energy"],
          undefined,
          true,
        );
      break;
    case "01020":
      s.player.inPlay = s.player.inPlay.filter((p) => p.id !== id);
      for (const a of s.player.inPlay.filter((p) => p.attachedTo === id))
        discardPiece(s, a.id);
      s.player.hand.push({ ...x, damage: 0, exhausted: false });
      break;
    case "01026":
      requestPayment(
        s,
        "Superhuman Law Division",
        1,
        [
          E("exhaust", { id }),
          E("target", {
            group: "scheme",
            title: "Superhuman Law Division",
            action: E("thwart", { amount: 2 }),
          }),
        ],
        ["mental"],
        undefined,
        true,
      );
      break;
    case "01027":
      need(!s.player.tough, "Tough prevents paying the take-damage cost.");
      x.exhausted = true;
      dealDamage(s, "hero", 1, "cost");
      add(s, E("draw", { amount: 1 }));
      break;
    case "01030":
      need(
        pieceHP(s, x) - x.damage >= 2,
        "War Machine needs at least 2 remaining hit points.",
      );
      activate(
        E("damage", { target: id, amount: 2 }),
        ...targets(s, "enemy").map((t) =>
          E("damage", { target: t.id, amount: 1 }),
        ),
      );
      break;
    case "01034": {
      const eligible = playerOrder(s).filter((p) =>
        seatView(s, p).player.discard.some(
          (x) =>
            card(x).type_code === "upgrade" &&
            card(x).traits?.includes("Tech."),
        ),
      );
      need(eligible.length, "No Tech upgrade in the team's discard piles.");
      x.exhausted = true;
      choosePlayer(s, "Stark Tower", [E("recoverTech")], eligible);
      break;
    }
    case "01035":
      need(s.player.exhausted, "Iron Man is already ready.");
      activate(E("ready", { target: "hero" }));
      break;
    case "01037":
      activate(
        ...(aerial(s)
          ? [E("thwartAll", { amount: 1 })]
          : [
              E("target", {
                group: "scheme",
                title: "Mark V Helmet",
                action: E("thwart", { amount: 1, action: true }),
              }),
            ]),
      );
      break;
    case "01038":
      activate(
        E("target", {
          group: "enemy",
          title: "Powered Gauntlets",
          action: E("damage", { amount: aerial(s) ? 2 : 1, attack: true }),
        }),
      );
      break;
    case "01039":
      requestPayment(
        s,
        "Rocket Boots",
        1,
        [E("exhaust", { id }), E("flag", { key: "aerial", value: true })],
        ["mental"],
        undefined,
        true,
      );
      break;
    case "01045":
      activate(E("draw", { amount: 2 }));
      break;
    case "01056":
    case "01064":
    case "01080": {
      const group =
        x.code === "01056"
          ? "enemy"
          : x.code === "01064"
            ? "scheme"
            : "friendly";
      const type =
        x.code === "01056" ? "damage" : x.code === "01064" ? "thwart" : "heal";
      activate(
        E("useCounter", { id }),
        E("target", {
          group,
          title: card(x).name,
          action: E(type, { amount: x.code === "01064" ? 1 : 2 }),
        }),
      );
      break;
    }
    case "01068":
      need(!x.used, "Vision already used Density Control this round.");
      choose(
        s,
        "Density Control",
        "Spend an energy resource to boost one power by 2 this phase.",
        ["attack", "thwart"].map((kind) =>
          option(kind, kind === "attack" ? "+2 ATK" : "+2 THW", [
            E("payRequest", {
              title: "Density Control",
              cost: 1,
              requirements: ["energy"],
              after: [E("vision", { id, kind })],
            }),
          ]),
        ),
      );
      break;
    case "01091":
      x.exhausted = true;
      choosePlayer(s, "Avengers Mansion", [E("draw", { amount: 1 })]);
      break;
    case "01092":
      x.exhausted = true;
      choosePlayer(s, "Helicarrier", [E("discount")]);
      break;
    case "01093":
      need(s.player.exhausted, "Your hero is already ready.");
      requestPayment(
        s,
        "Tenacity",
        1,
        [E("discardPiece", { id }), E("ready", { target: "hero" })],
        ["physical"],
        undefined,
        true,
      );
      break;
    default:
      throw Error("This card has no action ability.");
  }
}
function addDrone(s: GameState) {
  const p = takePlayer(s);
  if (!p) return;
  const drone = makePiece(s, "drone");
  drone.droneCard = p;
  drone.engagedWith = s.activePlayerId;
  s.minions.push(drone);
  log(s, "An Ultron Drone engages you.", "bad");
  minionEntered(s, drone);
}
function minionEntered(s: GameState, p: Piece) {
  const underlying = p.droneCard;
  Object.assign(p, resetPiece(p, true));
  if (underlying) p.droneCard = underlying;
  p.engagedWith = s.activePlayerId;
  s.resolving = s.resolving.filter((x) => x.id !== p.id);
  log(
    s,
    `${card(p).name} engages ${HEROES.find((h) => h.id === s.heroId)!.name}.`,
    "bad",
  );
  add(s, E("minionReactions", { id: p.id }));
}
function minionResponses(s: GameState, p: Piece) {
  const hawk = allInPlay(s).find((x) => x.code === "01066" && x.counters > 0);
  if (hawk)
    add(
      s,
      E("optional", {
        actorId: controller(s, hawk.id)?.id,
        title: "Hawkeye",
        text: `Spend an arrow to deal 2 damage to ${card(p).name}?`,
        effects: [
          E("counter", { id: hawk.id, amount: -1 }),
          E("damage", { target: p.id, amount: 2 }),
        ],
      }),
    );
}
function enemyAttack(s: GameState, id: string, extra?: string) {
  const p = find(s, id);
  if (!p) return;
  if (p.stunned) {
    p.stunned = false;
    log(s, `${card(p).name} loses stunned instead of attacking.`);
    return;
  }
  const web = allInPlay(s).find(
    (a) => a.code === "01009" && a.attachedTo === id,
  );
  if (web) {
    discardPiece(s, web.id);
    p.stunned = true;
    log(
      s,
      `Webbed Up prevents ${card(p).name}'s attack and stuns them.`,
      "good",
    );
    return;
  }
  const isVillain = id === s.villain.id;
  if (isVillain && s.heroId === "spider_man" && s.player.form === "hero")
    draw(s, 1);
  const base = enemyATK(s, p, s.activePlayerId);
  log(
    s,
    `${card(p).name} attacks ${heroCard(s).name}: ${base} base ATK${isVillain ? " before boost cards" : ""}.`,
    "bad",
  );
  s.flags.attacksPerformed = Number(s.flags.attacksPerformed || 0) + 1;
  s.attack = {
    targetPlayerId: s.activePlayerId,
    originalPlayerId: s.activePlayerId,
    attacker: id,
    isVillain,
    base,
    boostCodes: [],
    boostIds: [],
    boostEffects: [],
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: isVillain && !!villainAt(s, "01099").length,
    extra,
  };
  if (p.code === "01130" && extra !== "whirlwind")
    add(
      s,
      ...playerOrder(s)
        .filter(
          (seat) =>
            seat.id !== s.activePlayerId &&
            seatView(s, seat).player.form === "hero",
        )
        .map((seat) =>
          E("enemyAttack", { id, extra: "whirlwind", actorId: seat.id }),
        ),
    );
  add(s, E("prepareAttackBoosts"), E("declareDefense"));
  // Forced drone entry, including its responses, completes before defense.
  if (isVillain && s.villain.code === "01135") add(s, E("drone"));
}
function enemyATK(s: GameState, p: Piece, originalPlayerId: string): number {
  return p.id === s.villain.id
    ? (card(p).attack || 0) +
        s.attachments
          .filter((a) => a.attachedTo === p.id)
          .reduce((n, a) => n + (card(a).attack || 0), 0) +
        (s.villain.code === "01135"
          ? engaged(s, originalPlayerId).filter((p) =>
              card(p).traits?.includes("Drone."),
            ).length
          : 0)
    : p.code === "drone"
      ? pieceHP(s, p)
      : p.code === "01162"
        ? pieceHP(s, p) - p.damage
        : (card(p).attack || 0) +
          (s.villain.code === "01136" && card(p).traits?.includes("Drone.")
            ? 1
            : 0);
}
function prepareAttackBoosts(s: GameState) {
  const a = s.attack;
  if (!a || a.pendingBoosts) return;
  a.pendingBoosts = [];
  const n = a.isVillain ? (s.villainId === "klaw" ? 2 : 1) : 0;
  for (let i = 0; i < n; i++) {
    const p = drawEncounter(s);
    if (p) a.pendingBoosts.push(p);
  }
}
function declareDefense(s: GameState) {
  const a = s.attack;
  if (!a) return;
  const p = find(s, a.attacker);
  if (!p) {
    s.attack = null;
    return;
  }
  const base = enemyATK(s, p, a.originalPlayerId || s.activePlayerId);
  a.base = base;
  const opts: Option[] = [
    option(
      "take",
      "Take the attack",
      [E("defender", { id: "none" }), E("boostAttack")],
      "Keep your characters ready.",
    ),
  ];
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (view.player.form === "hero" && !view.player.exhausted)
      opts.push(
        option(
          seat.id === s.activePlayerId ? "hero" : `hero:${seat.id}`,
          `Defend with ${heroCard(view).name} · ${heroStats(view).defense} DEF`,
          [
            E("defender", { id: "hero", actorId: seat.id }),
            E("boostAttack", { actorId: seat.id }),
          ],
          "Exhaust this hero; this hero becomes the attack's target.",
          heroCard(view).code,
        ),
      );
    for (const ally of friends(view).filter((p) => !p.exhausted))
      opts.push(
        option(
          ally.id,
          `Defend with ${card(ally).name}`,
          [
            E("defender", { id: ally.id, actorId: seat.id }),
            E("boostAttack", { actorId: seat.id }),
          ],
          `${HEROES.find((h) => h.id === seat.heroId)!.name} · ${pieceHP(s, ally) - ally.damage} hit points`,
          ally.code,
        ),
      );
  }
  const allowed =
    p.code === "01132" && friends(s).some((p) => !p.exhausted)
      ? opts.filter((o) => o.id !== "take" && !o.id.startsWith("hero"))
      : opts;
  // Hawkeye's optional window must resolve before declaring a defender.
  add(
    s,
    E("defensePrompt", {
      options: allowed,
      name: card(p).name,
      base,
      isVillain: a.isVillain,
    }),
  );
}
function boostEffects(s: GameState, p: Piece) {
  const code = p.code;
  switch (code) {
    case "01121":
      s.encounter.discard = s.encounter.discard.filter((x) => x.id !== p.id);
      s.minions.push(p);
      minionEntered(s, p);
      break;
    case "01129":
      randomDiscard(s);
      break;
    case "01130":
      add(
        s,
        ...playerOrder(s)
          .filter((p) => seatView(s, p).player.form === "hero")
          .map((p) =>
            E("damage", {
              actorId: p.id,
              target: "hero",
              amount: 1,
              source: "boost",
            }),
          ),
      );
      break;
    case "01131":
    case "01158":
      s.villain.tough = true;
      break;
    case "01132":
      friends(s).forEach((p) => (p.exhausted = true));
      break;
    case "01144a":
    case "01144b":
    case "01144c": {
      const resource = code.endsWith("a")
        ? "energy"
        : code.endsWith("b")
          ? "mental"
          : "physical";
      add(s, E("boostDroneChoice", { resource }));
      break;
    }
    case "01146":
      heal(
        s,
        s.villain.id,
        engaged(s).filter((p) => card(p).traits?.includes("Drone.")).length,
      );
      break;
    case "01154":
      add(
        s,
        ...targets(s, "controlled").map((t) =>
          E("damage", { target: t.id, amount: 1, source: "boost" }),
        ),
      );
      break;
    case "01164":
      if (s.scheming || s.attack) {
        const boost = drawEncounter(s);
        if (boost) {
          if (s.scheming) s.scheming.pendingBoosts.push(boost);
          else if (s.attack!.pendingBoosts) s.attack!.pendingBoosts.push(boost);
          else add(s, E("legacyBoost", { piece: boost }));
        }
      }
      break;
    case "01123":
    case "01168":
    case "01173":
    case "01178":
      if (s.attack) s.attack.boostEffects.push(E("afterBoost", { code }));
      break;
  }
}
function enemyScheme(s: GameState, id: string, extra?: string) {
  const p = find(s, id);
  if (!p) return;
  if (p.confused) {
    p.confused = false;
    log(s, `${card(p).name} loses confused instead of scheming.`);
    return;
  }
  const boost = id === s.villain.id ? drawEncounter(s) : undefined;
  s.scheming = {
    attacker: id,
    boostCodes: [],
    boostIds: [],
    pendingBoosts: boost ? [boost] : [],
    extra,
  };
  add(s, E(boost ? "revealSchemeBoost" : "finishScheme"));
}
function finishScheme(s: GameState) {
  const activation = s.scheming;
  if (!activation) return;
  const { attacker: id, extra } = activation;
  const p = find(s, id);
  if (!p) return;
  const amount =
    (card(p).scheme || 0) +
    s.attachments
      .filter((a) => a.attachedTo === id)
      .reduce((n, a) => n + (card(a).scheme || 0), 0) +
    activation.boostCodes.reduce((n, code) => n + (card(code).boost || 0), 0);
  log(s, `${card(p).name} schemes for ${amount} threat.`, "bad");
  const after = [
    E("threat", { target: "main", amount }),
    ...(extra === "rage" ? [E("mill", { amount })] : []),
    ...(id === s.villain.id && villainAt(s, "01141").length
      ? s.sideSchemes.map((p) => E("threat", { target: p.id, amount: 1 }))
      : []),
    ...(p.code === "01181"
      ? s.sideSchemes
          .filter((p) => p.code === "01180")
          .map((p) => E("threat", { target: p.id, amount: 2 }))
      : []),
    ...activation.boostIds.map((id) => E("finishResolution", { id })),
    E("endScheme"),
  ];
  schemeWindow(s, id, amount, after);
}
function calculateAttack(s: GameState) {
  const a = s.attack;
  if (!a) return;
  const attacker = find(s, a.attacker);
  if (attacker)
    a.base =
      enemyATK(
        s,
        attacker,
        a.originalPlayerId || a.targetPlayerId || s.activePlayerId,
      ) + a.boostCodes.reduce((n, code) => n + (card(code).boost || 0), 0);
  if (
    a.defender &&
    !["none", "hero"].includes(a.defender) &&
    !find(s, a.defender)
  ) {
    a.defender = "none";
    a.basicDefense = false;
    log(
      s,
      `The ally defender left play. ${heroCard(s).name} is now the attack target.`,
      "bad",
    );
  }
  if (a.basicDefense) a.defense = heroStats(s).defense;
}
function schemeWindow(
  s: GameState,
  id: string,
  amount: number,
  after: Effect[],
) {
  const original = s.activePlayerId;
  const follow = after.map((e) => ({ actorId: original, ...e }));
  const opts: Option[] = [];
  if (id === s.villain.id)
    for (const seat of playerOrder(s)) {
      const emergency = seatView(s, seat).player.hand.find(
        (p) => p.code === "01085",
      );
      if (emergency)
        opts.push(
          option(
            seat.id === original ? "reduce" : `reduce:${seat.id}`,
            `Play Emergency${s.playerCount > 1 ? ` · ${heroCard(seatView(s, seat)).name}` : ""}`,
            [
              E("resolveHandEvent", {
                actorId: seat.id,
                id: emergency.id,
                after: [E("emergency", { amount, after: follow })],
              }),
            ],
          ),
        );
    }
  if (opts.length)
    choose(s, "Emergency", `The villain will place ${amount} threat.`, [
      ...opts,
      option("allow", "Let the scheme resolve", follow),
    ]);
  else add(s, ...follow);
}
function finishAttack(s: GameState) {
  const a = s.attack!;
  if (!a) return;
  const p = find(s, a.attacker);
  const target = a.defender && a.defender !== "none" ? a.defender : "hero";
  const visualAttacker = combatCharacter(s, a.attacker);
  const visualTarget = combatCharacter(s, target);
  const damage = Math.max(0, a.base - a.defense - a.prevented);
  const before =
    target === "hero"
      ? s.player.hp
      : find(s, target)
        ? pieceHP(s, find(s, target)!) - find(s, target)!.damage
        : 0;
  const wasTough = target === "hero" ? s.player.tough : find(s, target)?.tough;
  log(
    s,
    `${a.base} ATK − ${a.defense} DEF − ${Math.min(a.prevented, Math.max(0, a.base - a.defense))} prevented = ${damage} incoming damage to ${target === "hero" ? heroCard(s).name : find(s, target) ? card(find(s, target)!).name : "the defender"}.`,
    "bad",
  );
  dealDamage(s, target, damage, a.attacker);
  a.damage = wasTough ? 0 : Math.min(before, damage);
  if (a.overkill && target !== "hero" && damage > before && !wasTough)
    dealDamage(s, "hero", damage - before, a.attacker);
  recordCombat(s, visualAttacker, visualTarget, target, true);
  if (s.phase === "lost" || s.phase === "won") return;
  if (
    target === "hero" &&
    s.player.hp > 0 &&
    s.heroId === "black_panther" &&
    s.player.form === "hero"
  )
    dealDamage(s, a.attacker, 1, "retaliate");
  if (a.isVillain) {
    for (const c of [...villainAt(s, "01099")]) discardPiece(s, c.id);
    if (s.villain.code === "01134") add(s, E("ultronChoice", { amount: 1 }));
    if (
      (a.extra === "stampede" || villainAt(s, "01118").length) &&
      a.damage > 0
    ) {
      const x = target === "hero" ? s.player : find(s, target);
      if (x) x.stunned = true;
    }
    if (a.extra === "vengeance" && a.damage > 0)
      add(s, E("threat", { target: "main", amount: 1 }));
    if (a.extra === "rage") mill(s, a.damage);
  }
  if (p?.code === "01129") randomDiscard(s);
  if (p?.code === "01131") p.tough = true;
  if (p?.code === "01177")
    add(
      s,
      ...s.sideSchemes
        .filter((p) => p.code === "01176")
        .map((p) => E("threat", { target: p.id, amount: 1 })),
    );
  if (p?.code === "01181")
    add(
      s,
      ...s.sideSchemes
        .filter((p) => p.code === "01180")
        .map((p) => E("threat", { target: p.id, amount: 2 })),
    );
  add(
    s,
    ...a.boostEffects,
    ...(a.boostIds || []).map((id) => E("finishResolution", { id })),
    E("defenseResponses", {
      defended: target === "hero" && a.defender !== "none",
      attacker: a.attacker,
    }),
  );
}
function affordable(
  s: GameState,
  cost: number,
  req: Resource[] = [],
  exclude?: string,
) {
  const rs = paymentSources(s, exclude).flatMap((p) => p.resources);
  if (rs.length < cost) return false;
  for (const r of req) {
    let i = rs.indexOf(r);
    if (i < 0) i = rs.indexOf("wild");
    if (i < 0) return false;
    rs.splice(i, 1);
  }
  return true;
}
function reveal(s: GameState, p: Piece, skip = false) {
  beginResolution(s, p);
  s.lastEncounter = p.code;
  log(s, `${skip ? "Resolve" : "Encounter"}: ${card(p).name}.`, "bad");
  if (!skip) {
    const opts: Option[] = [];
    const revealing = s.activePlayerId;
    for (const seat of playerOrder(s)) {
      const view = seatView(s, seat);
      if (card(p).type_code === "treachery" && view.player.form === "hero")
        for (const code of ["01004", "01078"]) {
          const interrupt = view.player.hand.find((x) => x.code === code);
          if (interrupt && affordable(view, 1, [], interrupt.id))
            opts.push(
              option(
                code + (seat.id === revealing ? "" : `:${seat.id}`),
                `Play ${card(code).name}${s.playerCount > 1 ? ` · ${heroCard(view).name}` : ""}`,
                [
                  E("payRequest", {
                    actorId: seat.id,
                    title: card(code).name,
                    cost: 1,
                    piece: interrupt,
                    after: [
                      E("resolveHandEvent", {
                        id: interrupt.id,
                        after: [
                          E("cancelEncounter", {
                            actorId: revealing,
                            piece: p,
                          }),
                          ...(code === "01078"
                            ? [
                                E("enemyAttack", {
                                  actorId: seat.id,
                                  id: s.villain.id,
                                }),
                              ]
                            : []),
                        ],
                      }),
                    ],
                  }),
                ],
                "Spend 1 resource.",
                code,
              ),
            );
        }
      const widow = view.player.inPlay.find(
        (p) => p.code === "01075" && !p.exhausted,
      );
      if (widow && affordable(view, 1, ["mental"]))
        opts.push(
          option(
            `widow${seat.id === revealing ? "" : `:${seat.id}`}`,
            `Use Black Widow · ${heroCard(view).name}`,
            [
              E("payRequest", {
                actorId: seat.id,
                title: "Black Widow",
                cost: 1,
                requirements: ["mental"],
                after: [
                  E("exhaust", { id: widow.id }),
                  E("discardEncounter", { piece: p }),
                  E("revealNext"),
                ],
              }),
            ],
            "Her controller pays and reveals the replacement encounter.",
            "01075",
          ),
        );
    }
    if (opts.length) {
      opts.push(
        option("resolve", "Resolve the encounter", [
          E("reveal", { piece: p, skip: true }),
        ]),
      );
      choose(s, card(p).name, "You have an interrupt available.", opts);
      return;
    }
    // Reveal first; the player acknowledges the card before its text resolves.
    add(s, E("reveal", { piece: p, skip: true }));
    return;
  }
  const c = card(p);
  add(s, E("finishResolution", { id: p.id }));
  if (c.type_code === "minion") {
    s.minions.push(p);
    minionEntered(s, p);
    if (p.code === "01103")
      add(
        s,
        ...playerOrder(s)
          .filter((p) => seatView(s, p).player.form === "hero")
          .map((p) =>
            E("damage", { actorId: p.id, target: "hero", amount: 1 }),
          ),
      );
    if (p.code === "01110")
      choose(s, "Hydra Bomber", "Choose the consequence of the explosion.", [
        option("damage", "Take 2 damage", [
          E("damage", { target: "hero", amount: 2 }),
        ]),
        option("threat", "Place 1 threat", [
          E("threat", { target: "main", amount: 1 }),
        ]),
      ]);
  } else if (c.type_code === "side_scheme") {
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    p.counters =
      (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
    s.sideSchemes.push(p);
    if (
      ["01107", "01109", "01125", "01126", "01161", "01171", "01176"].includes(
        p.code,
      )
    )
      add(s, E("threat", { target: p.id, amount: s.playerCount }));
    if (p.code === "01127") {
      s.villain.maxHp += 10;
      s.villain.hp += 10;
    }
    if (p.code === "01128")
      add(
        s,
        E("findMinion", {
          trait: "Masters of Evil.",
          actorId: s.firstPlayerId,
        }),
      );
    if (p.code === "01148")
      add(s, ...eachPlayer(s, E("drone")), E("factoryThreat", { id: p.id }));
    if (p.code === "01149") add(s, ...eachPlayer(s, E("mill", { amount: 3 })));
    if (p.code === "01150")
      add(
        s,
        E("drone", { actorId: s.firstPlayerId }),
        E("drone", { actorId: s.firstPlayerId }),
      );
    if (p.code === "01151")
      add(s, ...eachPlayer(s, E("underAttack", { id: p.id })));
    if (p.code === "01166")
      add(s, ...eachPlayer(s, E("capture", { id: p.id })));
    if (p.code === "01180")
      add(
        s,
        E("searchEncounter", { code: "01181", reveal: false }),
        E("hydraThreat", { id: p.id }),
      );
    if (p.code === "01183")
      add(s, E("searchEncounter", { code: "01184", reveal: false }));
  } else if (c.type_code === "attachment") {
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    if (["01163", "01185"].includes(p.code)) {
      const candidates = [...s.minions]
        .filter(
          (x) =>
            p.code !== "01185" ||
            !s.attachments.some(
              (a) => a.code === "01185" && a.attachedTo === x.id,
            ),
        )
        .sort((a, b) => (card(b).health || 1) - (card(a).health || 1));
      if (candidates.length) {
        p.attachedTo = candidates[0].id;
        s.attachments.push(p);
      } else {
        s.encounter.discard.push(p);
        if (p.code === "01163") add(s, E("surge", { sourceCode: p.code }));
      }
    } else {
      p.attachedTo = s.villain.id;
      s.attachments.push(p);
    }
  } else if (c.type_code === "obligation") {
    obligation(s, p);
    return;
  } else {
    if (keyword(p, "Surge") && c.text?.includes("When Revealed")) {
      choose(
        s,
        `${c.name} · When Revealed`,
        "Choose the order of the card’s When Revealed ability and Surge.",
        [
          option("text-first", "Card ability, then Surge", [
            E("treacheryText", { piece: p }),
            E("surge", { sourceCode: p.code }),
          ]),
          option("surge-first", "Surge, then card ability", [
            E("surge", { sourceCode: p.code }),
            E("treacheryText", { piece: p }),
          ]),
        ],
      );
      return;
    }
    treachery(s, p);
  }
  if (keyword(p, "Surge")) add(s, E("surge", { sourceCode: p.code }));
}
function obligation(s: GameState, p: Piece) {
  const owner = s.players.find(
    (seat) => seat.heroId === card(p).set_code && !seat.eliminated,
  );
  if (!owner) {
    finishResolution(s, p.id);
    return;
  }
  activateSeat(s, owner.id);
  const second: Effect[] =
    p.code === "01155"
      ? [E("chooseDiscard", { filter: "panther" })]
      : p.code === "01160"
        ? [E("accelerate")]
        : p.code === "01165"
          ? [E("randomDiscard"), E("surge", { sourceCode: p.code })]
          : p.code === "01170"
            ? [E("exhaustUpgrades")]
            : [
                E("status", { target: "hero", status: "stunned" }),
                E("surge", { sourceCode: p.code }),
              ];
  const opts = [
    option(
      "penalty",
      "Accept the obligation",
      [...second, E("discardEncounter", { piece: p })],
      p.code === "01155"
        ? "Discard a Black Panther upgrade."
        : p.code === "01160"
          ? "Add an acceleration token."
          : p.code === "01165"
            ? "Discard a random card; surge."
            : p.code === "01170"
              ? "Exhaust every upgrade."
              : "Become stunned; surge.",
    ),
  ];
  if (!s.player.exhausted)
    opts.unshift(
      option(
        "resolve",
        "Settle your affairs",
        [E("settle", { piece: p })],
        `Change to ${HEROES.find((h) => h.id === s.heroId)!.identity} and exhaust to remove this obligation.`,
      ),
    );
  choose(
    s,
    card(p).name,
    "Your life outside the mask needs your attention.",
    opts,
  );
}
function treachery(s: GameState, p: Piece) {
  const hero = s.player.form === "hero";
  const att = (extra?: string) => E("enemyAttack", { id: s.villain.id, extra });
  const sch = (extra?: string) => E("enemyScheme", { id: s.villain.id, extra });
  const surge = () => add(s, E("surge", { sourceCode: p.code }));
  switch (p.code) {
    case "01104":
    case "01124":
      if (p.code === "01124" && hero)
        add(
          s,
          E("damage", { target: "hero", amount: 2 }),
          E("heal", { target: s.villain.id, amount: 2 }),
        );
      else if (!heal(s, s.villain.id, 4)) surge();
      break;
    case "01105":
      if (s.villain.tough) surge();
      else s.villain.tough = true;
      break;
    case "01106":
      if (hero) add(s, att("stampede"));
      else surge();
      break;
    case "01111": {
      const scheme = s.sideSchemes.find((p) => p.code === "01109");
      if (scheme) add(s, E("assignDamage", { remaining: scheme.counters }));
      else surge();
      break;
    }
    case "01112":
      if (s.player.confused) surge();
      else s.player.confused = true;
      break;
    case "01122":
      if (hero) add(s, att("vengeance"));
      else randomDiscard(s);
      break;
    case "01123": {
      const opts = [
        option("exhaust", "Exhaust all your characters", [
          E("exhaustCharacters"),
        ]),
      ];
      if (affordable(s, 3, ["energy", "mental", "physical"]))
        opts.unshift(
          option("pay", "Spend 3 different resources", [
            E("payRequest", {
              title: "Sonic Boom",
              cost: 3,
              requirements: ["energy", "mental", "physical"],
              after: [],
            }),
          ]),
        );
      choose(
        s,
        "Sonic Boom",
        "Spend energy, mental, and physical resources, or exhaust your characters.",
        opts,
      );
      break;
    }
    case "01133": {
      const minions = s.minions.filter(
        (p) =>
          card(p).traits?.includes("Masters of Evil.") &&
          seatView(s, p.engagedWith || s.activePlayerId).player.form === "hero",
      );
      add(
        s,
        E("attackSequence", {
          attacks: minions.map((p) =>
            E("enemyAttack", {
              id: p.id,
              actorId: p.engagedWith || s.activePlayerId,
            }),
          ),
          fallback: [
            E("searchEncounter", { trait: "Masters of Evil.", reveal: false }),
          ],
        }),
      );
      break;
    }
    case "01144a":
    case "01144b":
    case "01144c":
      add(s, ...eachPlayer(s, E("drone")));
      break;
    case "01145":
      add(s, hero ? att("rage") : sch("rage"));
      break;
    case "01146":
      if (
        !heal(
          s,
          s.villain.id,
          2 *
            engaged(s).filter((p) => card(p).traits?.includes("Drone.")).length,
        )
      )
        surge();
      break;
    case "01147": {
      const drones = engaged(s).filter((p) =>
        card(p).traits?.includes("Drone."),
      );
      add(
        s,
        E("attackSequence", {
          attacks: hero
            ? drones.map((p) => E("enemyAttack", { id: p.id }))
            : [],
          fallback: [E("drone")],
        }),
      );
      break;
    }
    case "01154":
      add(
        s,
        ...targets(s, "friendly").map((t) =>
          E("damage", { target: t.id, amount: 1 }),
        ),
      );
      break;
    case "01158":
      s.villain.tough = true;
      engaged(s).forEach((p) => (p.tough = true));
      break;
    case "01159": {
      const b = drawEncounter(s);
      if (b) s.encounter.discard.push(b);
      const amount = 1 + (b ? card(b).boost || 0 : 0);
      choose(
        s,
        "Ritual Combat",
        `The boost card sets the amount to ${amount}.`,
        [
          option("damage", `Take ${amount} damage`, [
            E("damage", { target: "hero", amount }),
          ]),
          option("threat", `Place ${amount} threat`, [
            E("threat", { target: "main", amount }),
          ]),
        ],
      );
      break;
    }
    case "01164": {
      const titania = s.minions.find((p) => p.code === "01162");
      add(
        s,
        E("attackSequence", {
          attacks:
            titania && hero ? [E("enemyAttack", { id: titania.id })] : [],
          fallback: [
            ...(titania
              ? [E("heal", { target: titania.id, amount: titania.damage })]
              : []),
            E("surge", { sourceCode: p.code }),
          ],
        }),
      );
      break;
    }
    case "01168":
      if (hero) s.player.stunned = true;
      if (s.minions.some((p) => p.code === "01167")) surge();
      break;
    case "01169":
      add(s, E("vulturePlans"));
      break;
    case "01173": {
      const up = s.player.inPlay.filter((p) => card(p).type_code === "upgrade");
      const opts = [
        option("damage", `Take ${up.length} damage`, [
          E("damage", { target: "hero", amount: up.length }),
        ]),
      ];
      if (up.length)
        opts.push(
          option("discard", "Discard an upgrade", [
            E("chooseDiscard", { filter: "upgrade" }),
          ]),
        );
      choose(s, "Electric Whip Attack", "Choose the consequence.", opts);
      break;
    }
    case "01174":
      add(s, ...eachPlayer(s, E("backlash")));
      break;
    case "01178":
      add(s, E("threat", { target: "main", amount: 1 }));
      break;
    case "01179": {
      const cards = s.player.hand.filter((p) => card(p).resource_energy);
      if (!cards.length) surge();
      else cards.forEach((p) => discardHand(s, p.id));
      break;
    }
    case "01186":
      add(s, sch());
      break;
    case "01187":
      if (hero) add(s, att());
      else surge();
      break;
    case "01188":
      if (
        s.player.inPlay.some((p) =>
          ["support", "upgrade"].includes(card(p).type_code),
        )
      )
        add(s, E("chooseDiscard", { filter: "supportUpgrade" }));
      else surge();
      break;
    case "01189":
      if (hero)
        add(s, att(), ...engaged(s).map((p) => E("enemyAttack", { id: p.id })));
      else surge();
      break;
    case "01190": {
      if (s.flags.nemesis) {
        surge();
        break;
      }
      s.flags.nemesis = true;
      const set = CARDS.filter((c) => c.set_code === `${s.heroId}_nemesis`);
      const minion = set.find((c) => c.type_code === "minion")!;
      const scheme = set.find((c) => c.type_code === "side_scheme")!;
      s.encounter.deck.push(
        ...set
          .filter((c) => c !== minion && c !== scheme)
          .flatMap((c) =>
            Array.from({ length: c.quantity }, () => makePiece(s, c.code)),
          ),
      );
      shuffle(s, s.encounter.deck);
      add(
        s,
        E("reveal", { piece: makePiece(s, minion.code) }),
        E("reveal", { piece: makePiece(s, scheme.code) }),
      );
      log(s, `Your nemesis enters the fight!`, "bad");
      break;
    }
    case "01191":
      s.player.exhausted = true;
      break;
    case "01192":
      if (s.sideSchemes.length)
        add(
          s,
          ...s.sideSchemes.map((p) => E("threat", { target: p.id, amount: 4 })),
        );
      else add(s, E("findEncounter", { typeCode: "side_scheme" }));
      break;
    case "01193":
      add(s, E("revealNext"));
      break;
    default:
      throw Error(`No encounter script for ${p.code}.`);
  }
}
function resolve(s: GameState, e: Effect) {
  switch (e.type) {
    case "resolveHandEvent": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      need(i >= 0, "The reaction card is no longer in hand.");
      const [p] = s.player.hand.splice(i, 1);
      beginResolution(s, p);
      log(s, `Play ${card(p).name}.`, "good");
      add(s, ...e.after, E("finishResolution", { id: p.id }));
      break;
    }
    case "treacheryText":
      treachery(s, e.piece);
      break;
    case "finishResolution":
      finishResolution(s, e.id);
      break;
    case "minionReactions": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          ...(keyword(p, "Quickstrike") && s.player.form === "hero"
            ? [E("enemyAttack", { id: p.id })]
            : []),
          E("minionResponses", { id: p.id }),
        );
      break;
    }
    case "minionResponses": {
      const p = find(s, e.id);
      if (p) minionResponses(s, p);
      break;
    }
    case "attackSequence":
      add(
        s,
        ...e.attacks,
        E("noAttack", {
          before: s.players.reduce(
            (n, p) => n + Number(seatView(s, p).flags.attacksPerformed || 0),
            0,
          ),
          fallback: e.fallback,
        }),
      );
      break;
    case "noAttack":
      if (
        s.players.reduce(
          (n, p) => n + Number(seatView(s, p).flags.attacksPerformed || 0),
          0,
        ) === e.before
      )
        add(s, ...e.fallback);
      break;
    case "allyEnter": {
      const p = find(s, e.id);
      if (p) allyEnter(s, p);
      break;
    }
    case "allyLimit":
      if (friends(s).length > 3 + (has(s, "01073") ? 1 : 0))
        choose(
          s,
          "Ally limit",
          "Choose an ally to discard to make room.",
          friends(s).map((p) =>
            option(
              p.id,
              card(p).name,
              [E("discardForLimit", { id: p.id })],
              undefined,
              p.code,
            ),
          ),
        );
      break;
    case "discardForLimit":
      discardPiece(s, e.id);
      break;
    case "draw":
      draw(s, e.amount);
      break;
    case "mill":
      mill(s, e.amount);
      break;
    case "damage":
      if (e.target?.startsWith("hero:")) {
        add(s, { ...e, target: "hero", actorId: e.target.slice(5) });
        break;
      }
      if (
        !e.attack &&
        e.target === "hero" &&
        !e.skip &&
        e.amount > 0 &&
        !s.player.tough &&
        s.player.form === "hero"
      ) {
        const flight = s.player.inPlay.find((p) => p.code === "01017");
        if (flight) {
          choose(
            s,
            "Incoming damage",
            `${heroCard(s).name} would take ${e.amount} damage.`,
            [
              option(
                "flight",
                "Discard Cosmic Flight · prevent 3",
                [
                  E("discardPiece", { id: flight.id }),
                  { ...e, amount: Math.max(0, e.amount - 3) },
                ],
                undefined,
                flight.code,
              ),
              option("allow", `Take ${e.amount} damage`, [
                { ...e, skip: true },
              ]),
            ],
          );
          break;
        }
      }
      if (e.attack)
        attackAction(
          s,
          e.target,
          e.amount,
          e.source || "hero",
          e.overkill,
          e.panther,
        );
      else
        dealDamage(
          s,
          e.target,
          e.amount,
          e.source,
          e.attack,
          e.overkill,
          e.panther,
        );
      break;
    case "heal":
      heal(s, e.target, e.amount);
      break;
    case "threat":
      threat(s, e.target, e.amount, e.skip);
      break;
    case "thwart":
      if (e.action) thwartAction(s, e.target, e.amount, e.source);
      else thwart(s, e.target, e.amount);
      break;
    case "target":
      targetPrompt(s, e);
      break;
    case "flag":
      s.flags[e.key] = e.value;
      break;
    case "status": {
      const p = e.target === "hero" ? s.player : find(s, e.target);
      if (p) (p as any)[e.status] = true;
      break;
    }
    case "exhaust":
      if (e.id === "hero") s.player.exhausted = true;
      else {
        const p = find(s, e.id);
        if (p) p.exhausted = true;
      }
      break;
    case "ready":
      if (e.target === "hero") s.player.exhausted = false;
      else {
        const p = find(s, e.target);
        if (p) p.exhausted = false;
      }
      break;
    case "discardHand":
      discardHand(s, e.id);
      break;
    case "discardPiece":
      discardPiece(s, e.id);
      break;
    case "counter": {
      const p = find(s, e.id);
      if (p) p.counters += e.amount;
      break;
    }
    case "useCounter": {
      const p = find(s, e.id);
      if (p) {
        p.counters--;
        if (p.counters <= 0) discardPiece(s, p.id);
      }
      break;
    }
    case "play":
      play(s, e.piece, e.paid);
      break;
    case "payRequest":
      requestPayment(
        s,
        e.title,
        e.cost,
        e.after,
        e.requirements,
        e.piece,
        e.cancelable,
        e.targetCode,
      );
      break;
    case "attachPlayer": {
      const p = find(s, e.id);
      if (p) {
        const duplicate = allInPlay(s).some(
          (x) =>
            x.id !== p.id && x.code === p.code && x.attachedTo === e.target,
        );
        if (duplicate && p.code !== "01007") {
          discardPiece(s, p.id);
          log(s, "This target already has that upgrade.");
        } else {
          p.attachedTo = e.target;
          const allyController =
            p.code === "01074" ? controller(s, e.target) : undefined;
          if (allyController && allyController.id !== s.activePlayerId) {
            s.player.inPlay.splice(s.player.inPlay.indexOf(p), 1);
            seatView(s, allyController).player.inPlay.push(p);
          }
        }
      }
      break;
    }
    case "optional":
      choose(s, e.title, e.text, [
        option("yes", "Use ability", e.effects),
        option("skip", "Pass", []),
      ]);
      break;
    case "fromDiscard": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(...s.player.discard.splice(i, 1));
      break;
    }
    case "futurist": {
      for (const id of e.ids as string[]) {
        const i = s.player.deck.findIndex((p) => p.id === id);
        if (i >= 0) {
          const [p] = s.player.deck.splice(i, 1);
          (id === e.id ? s.player.hand : s.player.discard).push(p);
        }
      }
      recyclePlayer(s);
      break;
    }
    case "searchDeck": {
      const opts = s.player.deck
        .filter(
          (p) =>
            (!e.trait || card(p).traits?.includes(e.trait)) &&
            (!e.typeCode || card(p).type_code === e.typeCode),
        )
        .map((p) =>
          option(
            p.id,
            card(p).name,
            [E("fromDeck", { id: p.id })],
            plain(card(p).text),
            p.code,
          ),
        );
      choose(
        s,
        e.title,
        "Choose a card to add to your hand. Your deck will be shuffled.",
        opts,
      );
      break;
    }
    case "fromDeck": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(...s.player.deck.splice(i, 1));
      shuffle(s, s.player.deck);
      break;
    }
    case "legalPractice":
      e.ids.forEach((id: string) => discardHand(s, id));
      if (s.player.confused) {
        s.player.confused = false;
        log(
          s,
          "Confused cancels Legal Practice after its discard cost is paid.",
        );
        break;
      }
      add(
        s,
        E("target", {
          group: "scheme",
          title: "Legal Practice",
          action: E("thwart", { amount: e.ids.length, action: true }),
        }),
      );
      break;
    case "ancestral":
      for (const id of e.ids) {
        const i = s.player.discard.findIndex((p) => p.id === id);
        if (i >= 0) s.player.deck.push(...s.player.discard.splice(i, 1));
      }
      shuffle(s, s.player.deck);
      break;
    case "alpha":
      e.ids.forEach((id: string) => discardHand(s, id));
      find(s, e.id)!.exhausted = true;
      draw(s, s.player.form === "alter" ? 2 : 1);
      break;
    case "chargeEnergy": {
      const p = find(s, e.id);
      if (p)
        p.counters += (e.paid as Resource[]).filter(
          (r) => r === "energy",
        ).length;
      break;
    }
    case "vision": {
      const p = find(s, e.id);
      if (p) {
        p.used = true;
        if (e.kind === "attack") p.bonusAtk = 2;
        else p.bonusThw = 2;
      }
      break;
    }
    case "thwartAll":
      if (s.player.confused) {
        s.player.confused = false;
        log(s, "Confused cancels the thwart ability.");
      } else for (const t of targets(s, "scheme")) thwart(s, t.id, e.amount);
      break;
    case "crisisInterdiction": {
      if (s.player.confused) {
        s.player.confused = false;
        log(s, "Confused cancels Crisis Interdiction.");
        break;
      }
      const removed = thwart(s, e.target, 2);
      if (removed === 2 && aerial(s))
        add(
          s,
          E("target", {
            group: "scheme",
            exclude: e.target,
            title: "Crisis Interdiction · Aerial",
            action: E("thwart", { amount: 2 }),
          }),
        );
      break;
    }
    case "returnAlly": {
      const pile = s.players
        .map((p) => seatView(s, p).player.discard)
        .find((a) => a.some((p) => p.id === e.id));
      const i = pile?.findIndex((p) => p.id === e.id) ?? -1;
      if (pile && i >= 0) {
        const [p] = pile.splice(i, 1);
        Object.assign(p, resetPiece(p, true));
        p.counters = p.code === "01066" ? 4 : 0;
        s.player.inPlay.push(p);
        /* put into play responses do not include Black Cat's after-you-play effect */ add(
          s,
          E("allyLimit"),
          ...(p.code !== "01002" ? [E("allyEnter", { id: p.id })] : []),
        );
      }
      break;
    }
    case "allyAction": {
      const p = find(s, e.id);
      if (!p) break;
      const attack = e.kind === "attack";
      const stunned = attack ? p.stunned : p.confused;
      const queuedBefore = s.queue.length;
      if (attack) attackAction(s, e.target, e.amount, p.id);
      else thwartAction(s, e.target, e.amount, p.id);
      if (stunned) break;
      const responses = s.queue.splice(0, s.queue.length - queuedBefore);
      add(
        s,
        ...responses,
        E("allyResponse", { id: p.id, attack }),
        E("allyConsequence", {
          id: p.id,
          amount: attack ? card(p).attack_cost || 0 : card(p).thwart_cost || 0,
        }),
      );
      break;
    }
    case "allyResponse": {
      const p = find(s, e.id);
      if (!p) break;
      if (p.code === "01058" && !e.attack)
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Daredevil",
            action: E("damage", { amount: 1 }),
          }),
        );
      if (p.code === "01050" && e.attack) add(s, E("hulk"));
      break;
    }
    case "allyConsequence": {
      const p = find(s, e.id);
      if (p && e.amount) dealDamage(s, p.id, e.amount, "consequential");
      break;
    }
    case "hulk": {
      const p = mill(s, 1)[0];
      if (!p) break;
      const res = resources(card(p));
      log(s, `Hulk reveals ${card(p).name}.`);
      if (res.includes("physical") || res.includes("wild"))
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Hulk",
            action: E("damage", { amount: 2 }),
          }),
        );
      if (res.includes("energy") || res.includes("wild"))
        add(
          s,
          ...[...targets(s, "enemy"), ...targets(s, "friendly")].map((t) =>
            E("damage", { target: t.id, amount: 1 }),
          ),
        );
      if (res.includes("mental") || res.includes("wild")) {
        const h = s.player.inPlay.find((p) => p.code === "01050");
        if (h) add(s, E("discardPiece", { id: h.id }));
      }
      break;
    }
    case "wakanda": {
      const remaining = (e.remaining as string[]).filter((id) => find(s, id));
      if (!remaining.length) break;
      choose(
        s,
        "Wakanda Forever!",
        remaining.length === 1
          ? "Resolve the final upgrade with its enhanced effect."
          : "Choose the next upgrade. The last one gets its enhanced effect.",
        remaining.map((id) => {
          const p = find(s, id)!;
          return option(
            id,
            card(p).name,
            [
              E("pantherSpecial", { id, final: remaining.length === 1 }),
              E("wakanda", { remaining: remaining.filter((x) => x !== id) }),
            ],
            plain(card(p).text),
            p.code,
          );
        }),
      );
      break;
    }
    case "pantherSpecial": {
      const p = find(s, e.id);
      if (!p) break;
      const k = e.final ? 2 : 1;
      if (p.code === "01046")
        choose(
          s,
          "Energy Daggers",
          "Choose a hero’s engaged enemies. The villain is also hit.",
          playerOrder(s).map((seat) =>
            option(
              seat.id,
              HEROES.find((h) => h.id === seat.heroId)!.name,
              [s.villain, ...engaged(s, seat.id)].map((p) =>
                E("damage", { target: p.id, amount: k, panther: true }),
              ),
            ),
          ),
        );
      if (p.code === "01047")
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Panther Claws",
            action: E("damage", { amount: k * 2, attack: true, panther: true }),
          }),
        );
      if (p.code === "01048")
        add(
          s,
          E("target", {
            group: "scheme",
            title: "Tactical Genius",
            action: E("thwart", { amount: k, action: true }),
          }),
        );
      if (p.code === "01049" && s.player.hp < maxHP(s))
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Vibranium Suit",
            action: E("moveDamage", {
              amount: Math.min(k, maxHP(s) - s.player.hp),
              attack: true,
            }),
          }),
        );
      break;
    }
    case "moveDamage":
      if (s.player.stunned) {
        s.player.stunned = false;
        break;
      }
      if (find(s, e.target)?.code === "01157") {
        log(s, "Killmonger is immune to Vibranium Suit.");
        break;
      }
      heal(s, "hero", e.amount);
      dealDamage(s, e.target, e.amount, "hero", true, false, true);
      break;
    case "emergency": {
      const reduction = s.player.confused ? 0 : 1;
      if (s.player.confused) {
        s.player.confused = false;
        log(s, "Confused cancels Emergency.");
      }
      add(
        s,
        ...e.after.map((effect: Effect) =>
          (effect.type === "threat" && effect.target === "main") ||
          effect.type === "mill"
            ? { ...effect, amount: Math.max(0, effect.amount - reduction) }
            : effect,
        ),
      );
      break;
    }
    case "schemeWindow":
      schemeWindow(s, e.id, e.amount, e.after);
      break;
    case "revealSchemeBoost": {
      const a = s.scheming;
      if (!a) break;
      const p = a.pendingBoosts.shift();
      if (p) {
        beginResolution(s, p);
        a.boostCodes.push(p.code);
        a.boostIds.push(p.id);
        log(
          s,
          `Scheme boost: ${card(p).name} adds ${card(p).boost || 0}.`,
          "bad",
        );
        add(
          s,
          ...(card(p).boost_star ? [E("boostEffect", { piece: p })] : []),
          E("completeBoost", { id: p.id, scheme: true }),
        );
      }
      break;
    }
    case "finishScheme":
      finishScheme(s);
      break;
    case "endScheme":
      delete s.scheming;
      break;
    case "declareDefense":
      declareDefense(s);
      break;
    case "drone":
      addDrone(s);
      break;
    case "enemyAttack":
      enemyAttack(s, e.id, e.extra);
      break;
    case "enemyScheme":
      enemyScheme(s, e.id, e.extra);
      break;
    case "defensePrompt":
      choose(
        s,
        `${e.name} attacks`,
        `${e.base} base ATK${e.isVillain ? " + facedown boost cards" : ""}. Choose your defender before boosts are revealed.`,
        e.options,
      );
      break;
    case "defender":
      if (s.attack) {
        s.attack.defender = e.id;
        s.attack.targetPlayerId = s.activePlayerId;
        log(
          s,
          e.id === "none"
            ? `${heroCard(s).name} takes the attack undefended.`
            : `${e.id === "hero" ? heroCard(s).name : card(find(s, e.id)!).name} defends the attack.`,
        );
        if (e.id === "hero") {
          s.attack.basicDefense = true;
          s.player.exhausted = true;
          s.attack.defense = heroStats(s).defense;
        } else if (e.id !== "none") {
          const p = find(s, e.id);
          if (p) p.exhausted = true;
        }
      }
      break;
    case "boostAttack": {
      const a = s.attack;
      if (!a) break;
      if (!a.pendingBoosts) prepareAttackBoosts(s);
      add(s, E(a.pendingBoosts?.length ? "revealBoost" : "damageWindow"));
      break;
    }
    case "prepareAttackBoosts":
      prepareAttackBoosts(s);
      break;
    case "revealBoost": {
      const a = s.attack;
      if (!a) break;
      // Saves from before the 1.8 update stored individual reveal steps.
      const legacy = !a.pendingBoosts;
      const p =
        e.piece || (legacy ? drawEncounter(s) : a.pendingBoosts!.shift());
      if (p) {
        beginResolution(s, p);
        (a.boostIds ||= []).push(p.id);
        a.base += card(p).boost || 0;
        a.boostCodes.push(p.code);
        add(
          s,
          ...(card(p).boost_star ? [E("boostEffect", { piece: p })] : []),
          E("completeBoost", { id: p.id, legacy }),
        );
      }
      log(
        s,
        `Attack total: ${a.base}${a.boostCodes.length ? ` · Boost: ${a.boostCodes.map((c) => `${card(c).name} (+${card(c).boost || 0})`).join(", ")}` : ""}.`,
        "bad",
      );
      break;
    }
    case "completeBoost":
      finishResolution(s, e.id);
      if (e.legacy) break;
      if (e.scheme && s.scheming)
        add(
          s,
          E(
            s.scheming.pendingBoosts.length
              ? "revealSchemeBoost"
              : "finishScheme",
          ),
        );
      else if (!e.scheme && s.attack)
        add(
          s,
          E(s.attack.pendingBoosts?.length ? "revealBoost" : "damageWindow"),
        );
      break;
    case "legacyBoost":
      resolve(s, { ...e, type: "revealBoost" });
      break;
    case "boostEffect":
      boostEffects(s, e.piece);
      break;
    case "damageWindow": {
      const a = s.attack;
      if (!a) break;
      calculateAttack(s);
      const opts = [
        option(
          "resolve",
          `Resolve ${Math.max(0, a.base - a.defense - a.prevented)} damage`,
          [E("finishAttack")],
        ),
      ];
      const heroTarget =
        !a.defender || a.defender === "none" || a.defender === "hero";
      if (
        heroTarget &&
        !s.player.tough &&
        s.player.form === "hero" &&
        a.base - a.defense - a.prevented > 0
      ) {
        const back = s.player.hand.find((p) => p.code === "01003");
        if (back)
          opts.unshift(
            option(
              "backflip",
              "Backflip · prevent all damage",
              [
                E("resolveHandEvent", {
                  id: back.id,
                  after: [E("preventAttack", { amount: 99 })],
                }),
                E("finishAttack"),
              ],
              undefined,
              "01003",
            ),
          );
        const flight = s.player.inPlay.find((p) => p.code === "01017");
        if (flight && s.player.form === "hero")
          opts.unshift(
            option(
              "flight",
              "Discard Cosmic Flight · prevent 3",
              [
                E("discardPiece", { id: flight.id }),
                E("preventAttack", { amount: 3 }),
                E("damageWindow"),
              ],
              undefined,
              "01017",
            ),
          );
      }
      if (opts.length === 1) add(s, E("finishAttack"));
      else
        choose(
          s,
          "Incoming attack",
          `Total ATK ${a.base} − defense ${a.defense}.`,
          opts,
        );
      break;
    }
    case "preventAttack":
      if (s.attack) {
        s.attack.prevented += e.amount;
        if (!s.attack.defender || s.attack.defender === "none")
          s.attack.defender = "hero";
      }
      break;
    case "finishAttack":
      finishAttack(s);
      break;
    case "afterBoost": {
      const a = s.attack;
      if (!a) break;
      if (
        e.code === "01123" &&
        a.damage > 0 &&
        (!a.defender || ["none", "hero"].includes(a.defender))
      )
        s.player.exhausted = true;
      if (e.code === "01168" && a.damage > 0) {
        const p =
          a.defender && a.defender !== "none" && a.defender !== "hero"
            ? find(s, a.defender)
            : s.player;
        if (p) p.stunned = true;
      }
      if (e.code === "01173" && a.defender === "none")
        add(s, E("chooseDiscard", { filter: "upgrade" }));
      if (e.code === "01178" && a.defender === "none")
        add(s, E("threat", { target: "main", amount: 1 }));
      break;
    }
    case "defenseResponses": {
      s.attack = null;
      if (!e.defended) break;
      const ind = s.player.inPlay.find((p) => p.code === "01082");
      const counter = s.player.hand.find((p) => p.code === "01077");
      const opts = [option("pass", "Continue", [])];
      if (ind)
        opts.unshift(
          option(
            "indomitable",
            "Indomitable · ready your hero",
            [
              E("discardPiece", { id: ind.id }),
              E("ready", { target: "hero" }),
              E("defenseResponses", { ...e, defended: true }),
            ],
            undefined,
            "01082",
          ),
        );
      if (
        counter &&
        (s.player.stunned ||
          targets(s, "enemy", true).some((t) => t.id === e.attacker))
      )
        opts.unshift(
          option(
            "counter",
            "Counter-Punch",
            [
              E("resolveHandEvent", {
                id: counter.id,
                after: [
                  E("damage", {
                    target: e.attacker,
                    amount: heroStats(s).attack,
                    attack: true,
                  }),
                ],
              }),
              E("defenseResponses", { ...e, defended: true }),
            ],
            `Deal ${heroStats(s).attack} damage.`,
            "01077",
          ),
        );
      if (opts.length > 1)
        choose(s, "After defending", "You can trigger a response.", opts);
      break;
    }
    case "boostDroneChoice": {
      const opts = [option("drone", "Create a drone", [E("drone")])];
      if (affordable(s, 1, [e.resource]))
        opts.unshift(
          option("pay", `Spend a ${e.resource} resource`, [
            E("payRequest", {
              title: "Android Efficiency",
              cost: 1,
              requirements: [e.resource],
              after: [],
            }),
          ]),
        );
      choose(s, "Android Efficiency", "Resolve the boost ability.", opts);
      break;
    }
    case "ultronChoice":
      choose(s, "Ultron adapts", "Choose how Ultron advances his plan.", [
        option("threat", `Place ${e.amount} threat`, [
          E("threat", { target: "main", amount: e.amount }),
        ]),
        option("drone", "Create a drone", [E("drone")]),
      ]);
      break;
    case "revealNext": {
      const p = drawEncounter(s);
      if (p) reveal(s, p);
      break;
    }
    case "reveal":
      reveal(s, e.piece, e.skip);
      break;
    case "discardEncounter":
      beginResolution(s, e.piece);
      finishResolution(s, e.piece.id);
      break;
    case "cancelEncounter":
      finishResolution(s, e.piece.id);
      log(s, `${card(e.piece).name}: When Revealed effects canceled.`, "good");
      break;
    case "surge":
      dealEncounter(s);
      log(
        s,
        "Surge deals one facedown encounter card. Reveal it after this hero’s other dealt cards during the villain phase.",
        "bad",
      );
      break;
    case "searchEncounter": {
      if (e.code && s.minions.some((p) => p.code === e.code)) break;
      let found: Piece | undefined;
      for (const pile of [s.encounter.deck, s.encounter.discard]) {
        const i = pile.findIndex((p) =>
          e.code ? p.code === e.code : card(p).traits?.includes(e.trait),
        );
        if (i >= 0) {
          [found] = pile.splice(i, 1);
          break;
        }
      }
      shuffle(s, s.encounter.deck);
      if (found) {
        if (e.reveal) reveal(s, found);
        else {
          s.minions.push(found);
          minionEntered(s, found);
        }
      }
      break;
    }
    case "findMinion":
    case "findEncounter": {
      const max = s.encounter.deck.length;
      for (let i = 0; i < max; i++) {
        const p = s.encounter.deck.shift();
        if (!p) break;
        if (
          card(p).type_code === (e.typeCode || "minion") &&
          (!e.trait || card(p).traits?.includes(e.trait))
        ) {
          if (e.type === "findMinion") {
            s.minions.push(p);
            minionEntered(s, p);
          } else reveal(s, p);
          break;
        }
        s.encounter.discard.push(p);
      }
      recycleEncounter(s);
      break;
    }
    case "chooseDiscard": {
      const eligible = s.player.inPlay.filter((p) =>
        e.filter === "panther"
          ? card(p).traits?.includes("Black Panther.")
          : e.filter === "upgrade"
            ? card(p).type_code === "upgrade"
            : ["support", "upgrade"].includes(card(p).type_code),
      );
      choose(
        s,
        "Discard a card",
        "Choose a card to discard from play.",
        eligible.map((p) =>
          option(
            p.id,
            card(p).name,
            [E("discardPiece", { id: p.id })],
            undefined,
            p.code,
          ),
        ),
      );
      break;
    }
    case "assignDamage":
      if (e.remaining > 0)
        add(
          s,
          E("target", {
            group: "friendly",
            title: `Explosion · ${e.remaining} damage to assign`,
            text: "Assign damage before applying it simultaneously to each chosen character.",
            action: E("assignOne", {
              remaining: e.remaining,
              assigned: e.assigned || {},
            }),
          }),
        );
      break;
    case "assignOne": {
      const assigned = {
        ...e.assigned,
        [e.target]: (e.assigned?.[e.target] || 0) + 1,
      };
      if (e.remaining > 1)
        add(s, E("assignDamage", { remaining: e.remaining - 1, assigned }));
      else
        add(
          s,
          ...Object.entries(assigned).map(([target, amount]) =>
            E("damage", { target, amount, source: "explosion" }),
          ),
        );
      break;
    }
    case "hydraThreat": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          E("threat", {
            target: p.id,
            amount:
              s.minions.filter((p) => card(p).traits?.includes("Hydra."))
                .length * 2,
          }),
        );
      break;
    }
    case "randomDiscard":
      randomDiscard(s);
      break;
    case "accelerate":
      s.encounter.acceleration++;
      break;
    case "exhaustCharacters":
      s.player.exhausted = true;
      friends(s).forEach((p) => (p.exhausted = true));
      break;
    case "exhaustUpgrades":
      s.player.inPlay
        .filter((p) => card(p).type_code === "upgrade")
        .forEach((p) => (p.exhausted = true));
      break;
    case "settle":
      s.player.form = "alter";
      s.player.exhausted = true;
      s.removed.push(e.piece);
      s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
      log(s, `${card(e.piece).name} is removed from the game.`, "good");
      break;
    case "nextMulligan": {
      const next = s.players.find((p) => !p.mulliganDone);
      if (next) activateSeat(s, next.id);
      else initialSetup(s);
      break;
    }
    case "stageSetup":
      if (s.difficulty === "expert") villainSetup(s);
      break;
    case "beginTurn":
      s.turnPlayerId = s.activePlayerId;
      log(s, `${heroCard(s).name} takes their turn.`, "phase");
      break;
    case "prepareDiscard": {
      if (e.selected) {
        for (const id of e.selected) discardHand(s, id);
        need(
          s.player.hand.length <= handSize(s),
          "Discard down to your hand size.",
        );
        break;
      }
      select(
        s,
        `${heroCard(s).name} · end of hero phase`,
        `Discard any unwanted cards. You will draw up to ${handSize(s)} cards after the whole team has finished.`,
        s.player.hand,
        Math.max(0, s.player.hand.length - handSize(s)),
        s.player.hand.length,
        E("endDiscard"),
      );
      break;
    }
    case "endDiscard":
      for (const id of e.ids) discardHand(s, id);
      log(s, `Discarded ${e.ids.length} card(s) before refilling.`);
      break;
    case "allReady":
      add(s, ...eachPlayer(s, E("refill")));
      break;
    case "refill":
      draw(s, Math.max(0, handSize(s) - s.player.hand.length));
      s.player.exhausted = false;
      for (const p of s.player.inPlay) {
        p.exhausted = false;
        p.bonusAtk = 0;
        p.bonusThw = 0;
      }
      s.flags.lead = 0;
      s.flags.aerial = false;
      s.flags.discount = 0;
      log(s, `${heroCard(s).name} and their cards are ready.`, "phase");
      break;
    case "beginVillain":
      s.phase = "villain";
      log(s, "Villain phase · threat, activations, then encounters.", "phase");
      add(
        s,
        E("villainStepOne"),
        ...eachPlayer(s, E("villainActivate")),
        E("dealEncounters"),
        E("newRound"),
      );
      break;
    case "villainStepOne":
      log(
        s,
        `Place ${escalation(s)} threat for ${s.playerCount} starting hero(es), plus ${s.encounter.acceleration + s.sideSchemes.reduce((n, p) => n + (card(p).scheme_acceleration || 0), 0)} acceleration.`,
        "bad",
      );
      add(
        s,
        E("threat", {
          target: "main",
          amount:
            escalation(s) +
            s.encounter.acceleration +
            s.sideSchemes.reduce(
              (n, p) => n + (card(p).scheme_acceleration || 0),
              0,
            ),
        }),
        ...(s.scheme.code === "01138b"
          ? eachPlayer(s, E("ultronChoice", { amount: 2 }))
          : []),
      );
      break;
    case "villainActivate":
      add(
        s,
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: s.villain.id,
        }),
        E("minionActivations"),
      );
      break;
    case "minionActivations": {
      const remaining =
        (e.remaining as string[] | undefined) || engaged(s).map((p) => p.id);
      const minions = remaining
        .map((id) => find(s, id))
        .filter((p): p is Piece => !!p);
      const effects = (p: Piece) => [
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: p.id,
        }),
        E("minionActivations", {
          remaining: remaining.filter((id) => id !== p.id),
        }),
      ];
      if (minions.length === 1) add(s, ...effects(minions[0]));
      else if (minions.length > 1)
        choose(
          s,
          "Minions activate",
          "Choose the next engaged minion to activate.",
          minions.map((p) =>
            option(p.id, card(p).name, effects(p), undefined, p.code),
          ),
        );
      break;
    }
    case "dealEncounters": {
      const order = playerOrder(s);
      for (const seat of order) dealEncounter(s, seat.id);
      const hazard = s.sideSchemes.reduce(
        (n, p) => n + (card(p).scheme_hazard || 0),
        0,
      );
      for (let i = 0; i < hazard; i++)
        dealEncounter(s, order[i % order.length].id);
      log(
        s,
        `Deal 1 encounter card to each hero${hazard ? ` and ${hazard} additional hazard card(s) in player order` : ""}.`,
        "bad",
      );
      add(s, ...eachPlayer(s, E("revealDealt")));
      break;
    }
    case "revealDealt": {
      const i = s.encounter.dealt.findIndex(
        (p) => (p.dealtTo || s.activePlayerId) === s.activePlayerId,
      );
      if (i >= 0) {
        const [p] = s.encounter.dealt.splice(i, 1);
        add(s, E("revealDealt"));
        reveal(s, p);
      }
      break;
    }
    case "newRound": {
      const prev = s.activePlayerId;
      for (const seat of playerOrder(s)) {
        activateSeat(s, seat.id);
        for (const p of [...s.player.inPlay].filter((p) => p.code === "01084"))
          discardPiece(s, p.id);
        s.flags = { nemesis: s.flags.nemesis || false };
        s.player.flipped = false;
        seat.ended = false;
        for (const p of s.player.inPlay) {
          p.used = false;
          p.bonusAtk = 0;
          p.bonusThw = 0;
        }
      }
      activateSeat(s, prev);
      const order = playerOrder(s);
      s.firstPlayerId = (order[1] || order[0]).id;
      s.round++;
      s.phase = "player";
      s.attack = null;
      activateSeat(s, s.firstPlayerId);
      s.turnPlayerId = s.firstPlayerId;
      log(
        s,
        `Round ${s.round} · ${heroCard(s).name} holds the first-player token.`,
        "phase",
      );
      break;
    }
    case "lead":
      log(
        s,
        "Each character you control gets +1 ATK and +1 THW until the end of this phase.",
        "good",
      );
      s.flags.lead = Number(s.flags.lead || 0) + 1;
      break;
    case "discount":
      log(s, "Your next card this phase costs 1 fewer resource.", "good");
      s.flags.discount = Number(s.flags.discount || 0) + 1;
      break;
    case "recoverTech": {
      const tech = [...s.player.discard]
        .reverse()
        .find(
          (p) =>
            card(p).type_code === "upgrade" &&
            card(p).traits?.includes("Tech."),
        );
      if (tech) add(s, E("fromDiscard", { id: tech.id }));
      break;
    }
    case "transferUpgrade": {
      const owner = controller(s, e.id);
      const p = find(s, e.id);
      if (owner && p && owner.id !== s.activePlayerId) {
        const zone = seatView(s, owner).player.inPlay;
        zone.splice(zone.indexOf(p), 1);
        s.player.inPlay.push(p);
        log(s, `${card(p).name} is now controlled by ${heroCard(s).name}.`);
      }
      break;
    }
    case "factoryThreat": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          E("threat", {
            target: p.id,
            amount: s.minions.filter((m) => card(m).traits?.includes("Drone."))
              .length,
          }),
        );
      break;
    }
    case "underAttack":
      choose(
        s,
        "Under Attack",
        `${heroCard(s).name} must choose a consequence.`,
        [
          option("threat", "Place 2 threat on Under Attack", [
            E("threat", { target: e.id, amount: 2 }),
          ]),
          ...(s.player.form === "hero"
            ? [
                option("damage", "Deal 3 damage to your hero", [
                  E("damage", { target: "hero", amount: 3 }),
                ]),
              ]
            : []),
        ],
      );
      break;
    case "capture": {
      const p = find(s, e.id);
      if (p && s.player.hand.length) {
        const [x] = s.player.hand.splice(
          Math.floor(random(s) * s.player.hand.length),
          1,
        );
        (p.captured ||= []).push(x);
        log(s, "Highway Robbery captures a card from your hand.");
      }
      break;
    }
    case "backlash": {
      const cards = mill(s, 5);
      add(
        s,
        E("damage", {
          target: "hero",
          amount: cards.reduce((n, p) => n + (card(p).resource_energy || 0), 0),
        }),
      );
      break;
    }
    case "vulturePlans": {
      const prev = s.activePlayerId;
      const types = new Set<Resource>();
      for (const seat of playerOrder(s)) {
        activateSeat(s, seat.id);
        const p = randomDiscard(s);
        if (p) resources(card(p)).forEach((r) => types.add(r));
      }
      activateSeat(s, prev);
      add(s, E("threat", { target: "main", amount: types.size }));
      break;
    }
    default:
      throw Error(`Unimplemented effect: ${e.type}`);
  }
}
function run(s: GameState) {
  let pending = s.review;
  s.review = null;
  let n = 0;
  while (
    !s.review &&
    !s.prompt &&
    s.queue.length &&
    !["won", "lost"].includes(s.phase)
  ) {
    need(n++ < 600, "Effect loop exceeded its limit.");
    const e = s.queue.shift()!;
    const actor = s.players.find(
      (p) => p.id === (e.actorId || s.activePlayerId),
    );
    const global = [
      "newRound",
      "dealEncounters",
      "beginVillain",
      "villainStepOne",
      "nextMulligan",
      "allReady",
      "finishResolution",
      "endScheme",
      "completeBoost",
    ].includes(e.type);
    if (actor?.eliminated && !global) continue;
    activateSeat(
      s,
      actor?.eliminated ? s.firstPlayerId : e.actorId || s.activePlayerId,
    );
    const before = boardSnapshot(s);
    resolve(s, e);
    check(s);
    syncSeat(s);
    recordReview(s, before, e);
    if (s.review) pending = mergeReviews(pending, s.review);
    s.review = null;
    if (s.prompt) break;
    if (pending && !continuesReview(s, e)) {
      s.review = pending;
      pending = null;
      break;
    }
  }
  if (s.prompt && pending) s.prompt.context = pending;
  else if (!s.review && pending) {
    // Cleanup alone is already visible in the log and previous action card.
    const meaningful =
      pending.changes.some((c) => c.kind !== "cards") ||
      pending.cards?.some((c) => !["discarded", "moved"].includes(c.kind)) ||
      pending.payment ||
      pending.calculation;
    if (meaningful) s.review = pending;
  }
  if (!s.review && !s.prompt && !s.queue.length && s.phase === "player") {
    const turn = s.players.find((p) => p.id === s.turnPlayerId);
    if (turn && !turn.eliminated) activateSeat(s, turn.id);
    else {
      const next = playerOrder(s).find((p) => !p.ended);
      if (next) {
        activateSeat(s, next.id);
        s.turnPlayerId = next.id;
      } else {
        add(
          s,
          ...eachPlayer(s, E("prepareDiscard")),
          E("allReady"),
          E("beginVillain", { actorId: s.firstPlayerId }),
        );
        run(s);
      }
    }
  }
}
export function dispatch(state: GameState, command: Command): GameState {
  const s = upgradeSave(structuredClone(state));
  s.combatEvents = [];
  delete s.error;
  try {
    if (
      (command.type === "PLAY" || command.type === "ABILITY") &&
      command.playerId &&
      command.playerId !== s.activePlayerId
    ) {
      need(
        s.phase === "player" && !s.review && !s.prompt,
        "Finish the current action before requesting a teammate’s action.",
      );
      const seat = s.players.find(
        (p) => p.id === command.playerId && !p.eliminated,
      );
      need(seat, "That hero is not in the mission.");
      activateSeat(s, command.playerId);
    }
    if (command.type === "ABILITY" && s.activePlayerId !== s.turnPlayerId) {
      const p =
        command.id === "identity"
          ? heroCard(s)
          : card(find(s, command.id) || "");
      need(
        p?.text?.includes("Action") &&
          !["attack", "thwart"].includes(command.action || ""),
        "Basic powers and ally attacks or thwarts require that hero’s own turn.",
      );
    }
    const before = boardSnapshot(s);
    if (command.type === "PROCEED") {
      need(s.review, "There is no action to acknowledge.");
      s.review = null;
      run(s);
      syncSeat(s);
      return s;
    }
    need(!s.review, "Read the current action and click Proceed first.");
    if (command.type === "MULLIGAN") {
      need(s.phase === "mulligan", "Mulligan is finished.");
      need(
        new Set(command.ids).size === command.ids.length,
        "Select each card once.",
      );
      const discarded = command.ids.map((id) => {
        const i = s.player.hand.findIndex((p) => p.id === id);
        need(i >= 0, "Unknown card.");
        return s.player.hand.splice(i, 1)[0];
      });
      draw(s, discarded.length);
      s.player.discard.push(...discarded);
      log(
        s,
        discarded.length
          ? `Mulligan: replaced ${discarded.length} cards.`
          : "Opening hand kept.",
      );
      s.players.find((p) => p.id === s.activePlayerId)!.mulliganDone = true;
      add(s, E("nextMulligan"));
    } else if (command.type === "CHOOSE") {
      need(s.prompt?.kind === "choice", "No choice is pending.");
      const opt = s.prompt!.options.find((o) => o.id === command.id);
      need(opt, "Invalid choice.");
      log(s, `${s.prompt!.title}: ${opt!.label}.`);
      s.prompt = null;
      add(s, ...opt!.effects);
    } else if (command.type === "SELECT") {
      const p = s.prompt!;
      need(p?.kind === "select", "No selection is pending.");
      need(
        new Set(command.ids).size === command.ids.length &&
          command.ids.every((id) => p.options.some((o) => o.id === id)),
        "Invalid selection.",
      );
      need(
        command.ids.length >= (p.min || 0) &&
          command.ids.length <= (p.max || 0),
        "Choose the requested number of cards.",
      );
      s.prompt = null;
      add(s, { ...p.selectAction!, ids: command.ids });
    } else if (command.type === "PAY") pay(s, command.ids, command.wildAs);
    else if (command.type === "CANCEL") {
      need(s.prompt?.cancelable, "This decision cannot be canceled.");
      s.prompt = null;
      s.queue = [];
    } else {
      need(
        s.phase === "player" &&
          !s.prompt &&
          (["PLAY", "ABILITY"].includes(command.type) ||
            s.activePlayerId === s.turnPlayerId) &&
          !s.players.find((p) => p.id === s.activePlayerId)!.eliminated,
        "Finish the pending decision first.",
      );
      if (command.type === "PLAY") {
        const p = s.player.hand.find((p) => p.id === command.id);
        need(p, "Card is not in your hand.");
        const reason = playable(s, p!);
        need(!reason, reason || "");
        const cost = Math.max(
          0,
          (card(p!).cost || 0) - Number(s.flags.discount || 0),
        );
        requestPayment(
          s,
          card(p!).name,
          cost,
          [E("play", { piece: p })],
          [],
          p,
          true,
        );
      } else {
        s.flags.basicAttack = false;
        s.flags.heroKill = false;
        if (command.type === "FLIP") flip(s);
        else if (command.type === "BASIC") {
          need(!s.player.exhausted, "Your identity is exhausted.");
          const stats = heroStats(s);
          if (command.action === "recover") {
            need(s.player.form === "alter", "Recover in alter-ego form.");
            need(s.player.hp < maxHP(s), "You are at full health.");
            s.player.exhausted = true;
            heal(s, "hero", stats.recover);
          } else {
            need(s.player.form === "hero", "Change to hero form first.");
            need(
              (command.action === "attack"
                ? s.player.stunned
                : s.player.confused) ||
                targets(
                  s,
                  command.action === "attack" ? "enemy" : "scheme",
                  command.action === "attack",
                ).length,
              "There are no eligible targets.",
            );
            s.player.exhausted = true;
            if (command.action === "attack") {
              s.flags.basicAttack = true;
              add(
                s,
                E("target", {
                  group: "enemy",
                  title: "Basic attack",
                  action: E("damage", { amount: stats.attack, attack: true }),
                }),
              );
            } else
              add(
                s,
                E("target", {
                  group: "scheme",
                  title: "Basic thwart",
                  action: E("thwart", { amount: stats.thwart, action: true }),
                }),
              );
          }
        } else if (command.type === "ABILITY") {
          if (s.attachments.some((p) => p.id === command.id)) {
            const p = find(s, command.id)!;
            need(s.player.form === "hero", "Hero form required.");
            const req: Record<string, Resource[]> = {
              "01100": ["physical", "physical", "physical"],
              "01118": ["energy", "mental", "physical"],
              "01119": ["energy", "mental", "physical"],
              "01141": ["mental", "mental"],
              "01142": ["energy", "mental", "physical"],
              "01152": ["physical", "physical"],
              "01153": ["energy", "energy"],
            };
            const r = req[p.code];
            need(r, "This attachment has no removal action.");
            const exhaust = ["01141", "01152", "01153"].includes(p.code);
            need(!exhaust || !s.player.exhausted, "Your hero must be ready.");
            requestPayment(
              s,
              `Remove ${card(p).name}`,
              r.length,
              [
                ...(exhaust ? [E("exhaust", { id: "hero" })] : []),
                E("discardPiece", { id: p.id }),
              ],
              r,
              undefined,
              true,
            );
          } else ability(s, command.id, command.action);
        } else if (command.type === "END_TURN") {
          // Discard/refill happens after the entire team has finished its turns.
          const seat = s.players.find((p) => p.id === s.activePlayerId)!;
          seat.ended = true;
          log(s, `${heroCard(s).name} ends their turn.`, "phase");
          const next = playerOrder(s).find((p) => !p.ended);
          if (next) add(s, E("beginTurn", { actorId: next.id }));
          else {
            const order = playerOrder(s);
            add(
              s,
              ...order.map((p) =>
                E("prepareDiscard", {
                  actorId: p.id,
                  selected:
                    s.playerCount === 1 ? command.discard || [] : undefined,
                }),
              ),
              E("allReady", { actorId: s.firstPlayerId }),
              E("beginVillain", { actorId: s.firstPlayerId }),
            );
          }
        }
      }
    }
    check(s);
    syncSeat(s);
    recordReview(s, before, command);
    // A click on a choice/payment/basic power is already confirmation. Resolve
    // to the next real decision or result, carrying its receipt into that view.
    if (["CHOOSE", "SELECT"].includes(command.type) && before.prompt?.context)
      s.review = s.review
        ? mergeReviews(before.prompt.context, s.review)
        : before.prompt.context;
    run(s);
    syncSeat(s);
    return s;
  } catch (error) {
    return {
      ...state,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
export function summarize(s: GameState) {
  return {
    phase: s.phase,
    activePlayerId: s.activePlayerId,
    firstPlayerId: s.firstPlayerId,
    turnPlayerId: s.turnPlayerId,
    players: s.players.map((p) => ({
      id: p.id,
      heroId: p.heroId,
      name: HEROES.find((h) => h.id === p.heroId)!.name,
      hp: seatView(s, p).player.hp,
      form: seatView(s, p).player.form,
      hand: seatView(s, p).player.hand.length,
      deck: seatView(s, p).player.deck.length,
      exhausted: seatView(s, p).player.exhausted,
      statuses: {
        tough: seatView(s, p).player.tough,
        stunned: seatView(s, p).player.stunned,
        confused: seatView(s, p).player.confused,
      },
      ended: p.ended,
      eliminated: p.eliminated,
    })),
    review: s.review,
    round: s.round,
    identity: heroCard(s).name,
    heroHP: s.player.hp,
    maxHP: maxHP(s),
    exhausted: s.player.exhausted,
    form: s.player.form,
    stats: heroStats(s),
    statuses: {
      stunned: s.player.stunned,
      confused: s.player.confused,
      tough: s.player.tough,
    },
    villain: {
      name: card(s.villain).name,
      hp: s.villain.hp,
      stage: s.villain.stage,
    },
    scheme: {
      name: card(s.scheme.code).name,
      threat: s.scheme.threat,
      limit: schemeLimit(s),
    },
    hand: s.player.hand.map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      cost: card(p).cost,
      playable: playable(s, p) === null,
    })),
    inPlay: s.player.inPlay.map((p) => ({
      id: p.id,
      name: card(p).name,
      exhausted: p.exhausted,
      counters: p.counters,
    })),
    minions: s.minions.map((p) => ({
      id: p.id,
      name: card(p).name,
      hp: pieceHP(s, p) - p.damage,
      engagedWith: p.engagedWith,
    })),
    sideSchemes: s.sideSchemes.map((p) => ({
      id: p.id,
      name: card(p).name,
      threat: p.counters,
    })),
    deck: s.player.deck.length,
    discard: s.player.discard.length,
    prompt: s.prompt
      ? {
          kind: s.prompt.kind,
          title: s.prompt.title,
          text: s.prompt.text,
          context: s.prompt.context,
          cost: s.prompt.cost,
          min: s.prompt.min,
          max: s.prompt.max,
          requirements: s.prompt.requirements,
          options: s.prompt.options.map((o) => ({ id: o.id, label: o.label })),
          sources:
            s.prompt.kind === "payment"
              ? paymentSources(s, s.prompt.card?.id, s.prompt.paymentTarget)
              : undefined,
        }
      : null,
    error: s.error,
    result: s.result,
  };
}
