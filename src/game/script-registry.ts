import catalog from "../data/catalog-cards.json" with { type: "json" };
import players from "../data/core-player.json" with { type: "json" };
import encounters from "../data/core-encounter.json" with { type: "json" };
import type { Card, GameState, Piece } from "./types.js";
import { compileCardScript } from "./scripts/compiler.js";
import { staticModifierValue } from "./scripts/runtime.js";
import type { StaticModifier } from "./scripts/types.js";
import { EXPLICIT_CARD_SCRIPTS } from "./engine-support.js";

const originals = [...players, ...encounters] as Card[];
const originalCodes = new Set(originals.map((c) => c.code));
const entries = new Map((catalog as Card[]).map((c) => [c.code, c]));
// Native handlers use the corrected Core cards at execution time. Compiling the
// original snapshot keeps exact reprint comparison independent of that overlay.
for (const c of originals) entries.set(c.code, c);
export const CARD_SCRIPTS = new Map(
  [...entries].map(([code, c]) => [code, compileCardScript(c)]),
);
export const cardScript = (code: string | Pick<Piece, "code">) =>
  CARD_SCRIPTS.get(typeof code === "string" ? code : code.code);
export function hasExecutableScript(code: string | Pick<Piece, "code">) {
  const id = typeof code === "string" ? code : code.code;
  return (
    originalCodes.has(id) ||
    EXPLICIT_CARD_SCRIPTS.has(id) ||
    cardScript(id)?.status === "supported"
  );
}
export function scriptedModifier(
  s: GameState,
  stat: StaticModifier["stat"],
  target?: Piece,
) {
  const targetOwner = target
    ? s.players.find((seat) =>
        (seat.id === s.activePlayerId ? s.player : seat.player).inPlay.some(
          (p) => p.id === target.id,
        ),
      )?.id
    : s.activePlayerId;
  return s.players
    .filter((seat) => !seat.eliminated)
    .reduce(
      (total, seat) =>
        total +
        (seat.id === s.activePlayerId ? s.player : seat.player).inPlay.reduce(
          (sum, source) => {
            const script = cardScript(source);
            if (
              !script ||
              script.implementation !== "script" ||
              // These native handlers enforce form/recipient timing themselves.
              ["05023", "05033", "09009", "09010", "09026"].includes(
                source.code,
              ) ||
              entries.get(source.code)?.name === "Team Training"
            )
              return sum;
            return (
              sum +
              staticModifierValue(script, {
                stat,
                target: target ? "ally" : "hero",
                targetId: target?.id,
                source,
                sourceOwnerId: seat.id,
                targetOwnerId: targetOwner,
              })
            );
          },
          0,
        ),
      0,
    );
}
