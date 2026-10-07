import { expect } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

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
      /^(skip|pass|none|done|continue|no|decline)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  )?.id;
}
export function finish(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
) {
  for (let n = 0; s.prompt && n < 100; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
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
export function base(
  heroId: "stld" | "gam",
  other?: "stld" | "gam" | "spider_man",
) {
  const aspect = heroId === "stld" ? "leadership" : "aggression";
  let s = newGame({
    heroId,
    aspect,
    villainId: "rhino",
    seed: 17001,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId, aspect },
            {
              heroId: other,
              aspect:
                other !== "gam"
                  ? ("leadership" as const)
                  : ("aggression" as const),
            },
          ],
        }
      : {}),
  });
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) => v.prompt?.options.find((o) => o.image === "17007")?.id);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.deck = Array.from({ length: 15 }, () =>
      owned(s, "18022", seat.id),
    );
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
  return s;
}
export function owned(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  return p;
}
export function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => owned(s, code));
  return [...s.player.hand];
}
export function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = owned(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
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
export function facedown(
  s: GameState,
  amount: number,
  playerId = s.activePlayerId,
) {
  const p = Array.from({ length: amount }, () => owned(s, "01104", playerId));
  for (const card of p) card.dealtTo = playerId;
  s.encounter.dealt.push(...p);
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
/** Decline optional before-play costs; never consume the event's target choice. */
export function play(s: GameState, piece: Piece, resources: Piece[] = []) {
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
  if (s.prompt?.kind === "payment")
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
  return s;
}
export function paidPlay(s: GameState, ...codes: string[]) {
  const p = hand(s, ...codes);
  return play(s, p[0], p.slice(1));
}
export function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
export function physical(s: GameState, playerId = s.activePlayerId) {
  const v = seatView(s, playerId);
  return [
    ...v.player.hand,
    ...v.player.deck,
    ...v.player.discard,
    ...v.player.inPlay,
    ...s.resolving.filter((p) => !p.ownerId || p.ownerId === playerId),
  ];
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
      p.code,
    ).toHaveLength(1);
}
