import { magikPending, magikTopPlayable } from "./magik.js";
import catalog from "../data/catalog-cards.json" with { type: "json" };
import players from "../data/core-player.json" with { type: "json" };
import type { Card, GameState, Piece } from "./types.js";
import { novaIronheartPackTextBlank } from "./nova-ironheart-pack.js";

const definitions = new Map(
  ([...catalog, ...players] as Card[]).map((c) => [c.code, c]),
);

const seatViewForBlank = (s: GameState, id: string) =>
  id === s.activePlayerId
    ? s.player
    : s.players.find((seat) => seat.id === id)!.player;

/** Tech Theft blanks printed text, while retaining stats, traits and icons. */
export function isTextBlank(
  s: GameState,
  p: (Pick<Piece, "code"> & { id?: string }) | string,
) {
  if (typeof p !== "string" && "treatedAsAlly" in p && p.treatedAsAlly)
    return true;
  const printedCode = typeof p === "string" ? p : p.code;
  if (["40037a", "40037b"].includes(printedCode)) {
    const id = typeof p === "string" ? undefined : p.id;
    const owner = s.players.find(
      (seat) =>
        seat.heroId === "domino" &&
        (!id || id === "hero" || id === `hero:${seat.id}`),
    );
    if (
      owner &&
      seatViewForBlank(s, owner.id).inPlay.some((q) => q.code === "40065")
    )
      return true;
  }
  const dpIdentity = definitions.get(printedCode);
  const dpSeat = ["hero", "alter_ego"].includes(dpIdentity?.type_code || "")
    ? s.players.find((seat) => seat.heroId === dpIdentity?.set_code)
    : undefined;
  const dpTarget =
    (dpSeat ? `hero:${dpSeat.id}` : undefined) ||
    (typeof p !== "string" ? p.id : undefined);
  if (
    dpTarget &&
    s.players.some(
      (seat) =>
        (seat.id === s.activePlayerId ? s.flags : seat.flags)[
          `deadpoolRay:${dpTarget}`
        ],
    )
  )
    return true;
  if (
    dpTarget &&
    s.attachments.some((a) => a.code === "44035" && a.attachedTo === dpTarget)
  )
    return true;
  if (
    dpTarget &&
    s.attack &&
    s.attachments.some(
      (a) => a.code === "44040" && a.attachedTo === s.attack!.attacker,
    )
  ) {
    const target =
      s.attack.defender && s.attack.defender !== "none"
        ? s.attack.defender
        : s.attack.originalTarget ||
          `hero:${s.attack.targetPlayerId || s.activePlayerId}`;
    if (
      dpTarget ===
      (target === "hero"
        ? `hero:${s.attack.targetPlayerId || s.activePlayerId}`
        : target)
    )
      return true;
  }
  if (
    typeof p !== "string" &&
    p.id &&
    s.minions.some((m) => m.id === p.id) &&
    s.players.some(
      (seat) =>
        (seat.id === s.activePlayerId ? s.flags : seat.flags)[
          `stormBlank:${p.id}`
        ] === s.round,
    )
  )
    return true;
  const kelly = s.sabretooth?.kelly;
  if (
    printedCode === "32066" &&
    kelly &&
    (typeof p === "string" || !p.id || p.id === kelly.id) &&
    s.scheme.code === "32063b" &&
    s.sideSchemes.some(
      (scheme) => scheme.code === "32065a" && scheme.id === kelly.attachedTo,
    )
  )
    return true;
  if (["31001b", "31002b"].includes(printedCode)) return false;
  const physical =
    typeof p !== "string" && p.id
      ? [{ id: p.id }]
      : [
          s.villain,
          ...s.minions,
          ...s.sideSchemes,
          ...s.attachments,
          ...s.players.flatMap((seat) =>
            seat.id === s.activePlayerId ? s.player.inPlay : seat.player.inPlay,
          ),
        ].filter(
          (piece) => piece.code === (typeof p === "string" ? p : p.code),
        );
  if (physical.some((piece) => novaIronheartPackTextBlank(s, piece)))
    return true;
  if (typeof p !== "string" && "treatedAsMinion" in p && p.treatedAsMinion)
    return true;
  const physicalCode = typeof p === "string" ? p : p.code;
  if (["26002", "26002b"].includes(physicalCode)) {
    const owner = [
      s.player,
      ...s.players
        .filter((seat) => seat.id !== s.activePlayerId)
        .map((seat) => seat.player),
    ].find((player) =>
      player.inPlay.some((piece) =>
        typeof p !== "string" && p.id
          ? piece.id === p.id
          : piece.code === physicalCode,
      ),
    );
    if (owner?.inPlay.some((piece) => piece.code === "26028")) return true;
  }
  if (
    !s.sideSchemes.some(
      (scheme) =>
        scheme.code === "12026" && !novaIronheartPackTextBlank(s, scheme),
    )
  )
    return false;
  const code = typeof p === "string" ? p : p.code;
  const inPlay = [
    s.player,
    ...s.players
      .filter((seat) => seat.id !== s.activePlayerId)
      .map((seat) => seat.player),
  ].some((player) =>
    player.inPlay.some((piece) =>
      typeof p !== "string" && p.id ? piece.id === p.id : piece.code === code,
    ),
  );
  if (!inPlay) return false;
  const c = definitions.get(code);
  return (
    !!c &&
    c.faction_code !== "encounter" &&
    (c.traits || "").split(/\.\s*/).includes("Tech")
  );
}

/** Event sources available only for native PLAY. George permits the actual
 * attached event as if in hand; random discards, resource sources and explicit
 * hand costs continue to use the physical hand directly. */
export function eventPlaySources(s: GameState): Piece[] {
  if (Number(s.flags.ghostSpiderColdBloodLock || 0) > 0) return [];
  const event = (p: Piece) => definitions.get(p.code)?.type_code === "event";
  return [
    ...s.player.hand.filter(event),
    ...[magikTopPlayable(s)].filter((p): p is Piece => !!p && event(p)),
    ...s.player.inPlay
      .filter((p) => p.code === "27007" && !isTextBlank(s, p))
      .flatMap((p) => (p.storedCards || []).filter(event)),
  ];
}

/** Revalidate a native event PLAY continuation after its source may have been
 * staged for payment. Pending events are never added to availability lists. */
export function eventPlaySource(s: GameState, id: string): Piece | undefined {
  return (
    eventPlaySources(s).find((p) => p.id === id) ||
    s.resolving.find(
      (p) =>
        p.id === id &&
        p.ownerId === s.activePlayerId &&
        definitions.get(p.code)?.type_code === "event" &&
        magikPending(s, p),
    )
  );
}

/** Actual Defense events available to this controller. Jocasta permits playing
 * its attached events as if they were in hand, without exposing or moving them
 * before the native PLAY resolves. Stored cards remain separate from resources. */
export function defenseEventSources(s: GameState): Piece[] {
  if (Number(s.flags.ghostSpiderColdBloodLock || 0) > 0) return [];
  const defense = (p: Piece) => {
    const c = definitions.get(p.code);
    return (
      c?.type_code === "event" &&
      (c.traits || "").split(/\.\s*/).includes("Defense")
    );
  };
  return [
    ...s.player.hand.filter(defense),
    ...[magikTopPlayable(s)].filter((p): p is Piece => !!p && defense(p)),
    ...s.player.inPlay
      .filter((p) => ["26013", "27007"].includes(p.code) && !isTextBlank(s, p))
      .flatMap((p) => (p.storedCards || []).filter(defense)),
  ];
}

/** Read-only view for older continuous-effect adapters. Physical zones in the
 * real state remain intact; only sources of printed continuous text are hidden. */
export function textActiveState(s: GameState): GameState {
  if (
    !s.sideSchemes.some(
      (scheme) =>
        scheme.code === "12026" && !novaIronheartPackTextBlank(s, scheme),
    ) &&
    !s.players.some((seat) =>
      (seat.id === s.activePlayerId
        ? s.player.inPlay
        : seat.player.inPlay
      ).some((piece) => novaIronheartPackTextBlank(s, piece)),
    )
  )
    return s;
  const player = (p: GameState["player"]) => ({
    ...p,
    inPlay: p.inPlay.filter((piece) => !isTextBlank(s, piece)),
  });
  return {
    ...s,
    player: player(s.player),
    players: s.players.map((seat) => ({
      ...seat,
      player: player(seat.player),
    })),
  };
}
