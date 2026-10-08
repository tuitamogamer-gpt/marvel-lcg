import { expect } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { card } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import type {
  Command,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";

export type Hero = "drax" | "vnm";
type SourceState = GameState & { dvSourceIds?: Record<string, string[]> };
export const reload = (s: GameState): GameState =>
  JSON.parse(JSON.stringify(s));
export function command(input: GameState, cmd: Command) {
  let s = dispatch(reload(input), cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++)
    s = dispatch(reload(s), { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
export function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
export function passId(s: GameState) {
  return s.prompt?.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no|decline|take)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  )?.id;
}
export function finish(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
) {
  for (let n = 0; s.prompt && n < 120; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  originalsConserved(s);
  return s;
}
export function until(s: GameState, available: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !available(s) && n < 100; n++) {
    const id = passId(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(available(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
export function respond(s: GameState, name: RegExp, code?: string) {
  s = until(
    s,
    (v) =>
      !!v.prompt?.options.some(
        (o) => name.test(o.label) || (code && o.image === code),
      ) ||
      !!(
        v.prompt &&
        name.test(v.prompt.title) &&
        v.prompt.options.some((o) => o.id === "yes")
      ),
  );
  const o =
    s.prompt?.options.find(
      (v) => name.test(v.label) || (code && v.image === code),
    ) || s.prompt?.options.find((v) => v.id === "yes");
  return choose(s, o!.id);
}
export function starting(heroId: Hero, other?: Hero | "spider_man" | "stld") {
  const aspect = heroId === "drax" ? "protection" : "justice";
  return newGame({
    heroId,
    aspect,
    villainId: "rhino",
    seed: 19001,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId, aspect },
            {
              heroId: other,
              aspect:
                other === "drax"
                  ? ("protection" as const)
                  : other === "stld"
                    ? ("leadership" as const)
                    : ("justice" as const),
            },
          ],
        }
      : {}),
  });
}
export function physical(s: GameState, playerId = s.activePlayerId) {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return nestedPieces([
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
      ]).filter(
        (p) => p.ownerId === playerId || (!p.ownerId && seat.id === playerId),
      );
    }),
    ...nestedPieces([
      ...s.resolving,
      ...s.removed,
      ...s.minions,
      ...s.sideSchemes,
      ...s.attachments,
      ...(s.environments || []),
      ...s.encounter.deck,
      ...s.encounter.dealt,
      ...s.encounter.discard,
    ]).filter((p) => p.ownerId === playerId),
  ].filter((p) => card(p).faction_code !== "encounter");
}
/** Count actual nested cards, without deduplicating IDs or hiding two-zone
 * ownership defects. Stored events and George beneath an obligation are
 * physical sources even though those nested cards are not in play. */
function nestedPieces(pieces: Piece[]): Piece[] {
  return pieces.flatMap((p) => [
    p,
    ...nestedPieces(p.storedCards || []),
    ...nestedPieces(p.captured || []),
    ...(p.droneCard ? nestedPieces([p.droneCard]) : []),
  ]);
}
/** Focused positions retain all forty original starter instances. Source cards
 * are moved into the requested zones; extra fixture cards are explicitly owned.
 * Venom's five physical set-aside encounters remain outside the player deck. */
export function base(heroId: Hero, other?: Hero | "spider_man" | "stld") {
  let s = starting(heroId, other);
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) =>
    v.prompt?.title === "Peter Quill setup"
      ? v.prompt.options[0]?.id
      : undefined,
  );
  for (const seat of s.players) {
    const v = seatView(s, seat);
    const source = [
      ...v.player.deck,
      ...v.player.hand,
      ...v.player.discard,
      ...v.player.inPlay,
    ];
    expect(source).toHaveLength(40);
    for (const p of source) p.ownerId = seat.id;
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.deck = source;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 6;
  s.villain.hp = s.villain.maxHp = 50;
  (s as SourceState).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  return s;
}
function originalsConserved(s: GameState) {
  for (const [seatId, ids] of Object.entries(
    (s as SourceState).dvSourceIds || {},
  )) {
    const cards = physical(s, seatId);
    for (const id of ids)
      expect(
        cards.filter((p) => p.id === id),
        `original source ${seatId}:${id}`,
      ).toHaveLength(1);
  }
}
export function owned(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  return p;
}
function take(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  for (const zone of [p.deck, p.discard, p.hand]) {
    const i = zone.findIndex((c) => c.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  return owned(s, code, playerId);
}
export function hand(s: GameState, ...codes: string[]) {
  s.player.deck.push(...s.player.hand.splice(0));
  const pieces = codes.map((code) => take(s, code));
  s.player.hand.push(...pieces);
  return pieces;
}
export function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
export function top(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.deck.unshift(p);
  return p;
}
export function minion(
  s: GameState,
  code = "01103",
  playerId = s.activePlayerId,
  damage = 0,
) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  p.damage = damage;
  s.minions.push(p);
  return p;
}
export function side(s: GameState, code = "01107", counters = 3) {
  const p = makePiece(s, code);
  p.counters = counters;
  s.sideSchemes.push(p);
  return p;
}
export function attach(s: GameState, code: string, target: string) {
  const p = makePiece(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
export function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Independent printed-rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
export function allocation(s: GameState, type: Resource) {
  if (
    s.prompt?.kind === "choice" &&
    /allocat|paid|resource type|payment/i.test(s.prompt.title)
  ) {
    const o = s.prompt.options.find(
      (o) => o.id === type || new RegExp(type, "i").test(o.label),
    );
    expect(o, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, o!.id);
  }
  return s;
}
export function pay(
  s: GameState,
  resources: Piece[] = [],
  type?: Resource,
  sourceIds: string[] = [],
) {
  if (s.prompt?.kind === "payment")
    s = command(s, {
      type: "PAY",
      ids: [...resources.map((p) => p.id), ...sourceIds],
      ...(type ? { wildAs: type } : {}),
    });
  return type ? allocation(s, type) : s;
}
export function play(
  s: GameState,
  piece: Piece,
  resources: Piece[] = [],
  type?: Resource,
) {
  s = command(s, { type: "PLAY", id: piece.id });
  for (
    let n = 0;
    n < 20 &&
    s.prompt?.kind === "choice" &&
    s.player.hand.some((p) => p.id === piece.id) &&
    passId(s);
    n++
  )
    s = choose(s, passId(s)!);
  return pay(s, resources, type);
}
export function paidPlay(s: GameState, ...codes: string[]) {
  const p = hand(s, ...codes);
  return play(s, p[0], p.slice(1));
}
export function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
export function conserved(
  s: GameState,
  pieces: Piece[],
  playerId = s.activePlayerId,
) {
  const all = physical(s, playerId);
  for (const p of pieces)
    expect(
      all.filter((q) => q.id === p.id),
      `${p.code}:${p.id}`,
    ).toHaveLength(1);
}
export function encounterPhysical(s: GameState) {
  return nestedPieces([
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
    ...s.players.flatMap((seat) => seatView(s, seat).player.setAside || []),
    ...s.resolving.filter((p) => card(p).faction_code === "encounter"),
    ...s.removed.filter((p) => card(p).faction_code === "encounter"),
  ]).filter((p) => card(p).faction_code === "encounter");
}
export function encounterConserved(s: GameState, pieces: Piece[]) {
  const all = encounterPhysical(s);
  for (const p of pieces)
    expect(
      all.filter((q) => q.id === p.id),
      `${p.code}:${p.id}`,
    ).toHaveLength(1);
}
