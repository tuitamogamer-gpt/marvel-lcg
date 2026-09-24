import { card, heroCard, pieceHP } from "./cards";
import { allInPlay } from "./team";
import type { GameState } from "./types";

export function combatCharacter(s: GameState, id: string) {
  if (id === "hero") {
    const c = heroCard(s);
    return { code: c.code, name: c.name, hp: s.player.hp };
  }
  const p = [s.villain, ...s.minions, ...allInPlay(s)].find((p) => p.id === id);
  if (!p) return undefined;
  return {
    code: p.code,
    name: card(p).name,
    hp: p.id === s.villain.id ? s.villain.hp : pieceHP(s, p) - p.damage,
  };
}

/** Capture printed faces before defeated cards leave play or a stage changes. */
export function recordCombat(
  s: GameState,
  attacker: ReturnType<typeof combatCharacter>,
  target: ReturnType<typeof combatCharacter>,
  targetId: string,
  enemy: boolean,
) {
  if (!attacker || !target) return;
  const after = combatCharacter(s, targetId);
  (s.combatEvents ||= []).push({
    attacker: { code: attacker.code, name: attacker.name },
    target: { code: target.code, name: target.name },
    blocked: !!after && after.code === target.code && after.hp >= target.hp,
    enemy,
  });
}
