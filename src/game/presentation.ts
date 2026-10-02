import { card, heroCard } from "./cards.js";
import { allInPlay, seatView } from "./team.js";
import type { Attack, GameState } from "./types.js";

/** Attachments retain their rules-engine zones; the table groups them by host. */
export function attachmentsFor(s: GameState, hostId: string) {
  return [...allInPlay(s), ...s.attachments].filter(
    (piece) => piece.attachedTo === hostId,
  );
}

export function attackContext(s: GameState, attack: Attack | null = s.attack) {
  if (!attack) return undefined;
  const seat = s.players.find(
    (p) => p.id === (attack.targetPlayerId || s.activePlayerId),
  );
  if (!seat) return undefined;
  const identity = heroCard(seatView(s, seat));
  // Keep the participants visible after damage has moved a defeated ally to discard.
  const pieces = [
    s.villain,
    ...s.minions,
    ...allInPlay(s),
    ...s.players.flatMap((p) => seatView(s, p).player.discard),
    ...s.encounter.discard,
    ...s.removed,
  ];
  const attacker = pieces.find((p) => p.id === attack.attacker);
  if (!attacker) return undefined;
  const ally = pieces.find((p) => p.id === attack.defender);
  const target = ally ? card(ally) : identity;
  return {
    attacker: { code: attacker.code, name: card(attacker).name },
    target: { code: target.code, name: target.name, playerId: seat.id },
    identity: { code: identity.code, name: identity.name },
    label: ally
      ? "ALLY DEFENDING"
      : attack.defender === "hero"
        ? "HERO DEFENDING"
        : attack.defender === "none"
          ? "UNDEFENDED ATTACK"
          : "ATTACK TARGET",
  };
}
