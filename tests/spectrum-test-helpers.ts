import { expect } from "vitest";
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  SPECTRUM_FORM_CODES,
  type SpectrumEnergyForm,
} from "../src/game/spectrum.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  native,
  physical,
} from "./dv-test-helpers.js";

type SourceState = GameState & { dvSourceIds?: Record<string, string[]> };
export const isForm = (p: Piece) =>
  Object.values(SPECTRUM_FORM_CODES).some((code) => code === p.code);
export function spectrumStarting(
  other?: "spider_man" | "drax",
  spectrumSeat = "p1",
) {
  const spectrum = { heroId: "spectrum", aspect: "leadership" as const };
  const teammate = other
    ? {
        heroId: other,
        aspect:
          other === "drax" ? ("protection" as const) : ("justice" as const),
      }
    : undefined;
  return newGame({
    ...spectrum,
    villainId: "rhino",
    seed: 21001,
    pacing: "expert",
    ...(teammate
      ? {
          heroes:
            spectrumSeat === "p1" ? [spectrum, teammate] : [teammate, spectrum],
        }
      : {}),
  });
}
/** Retains all 43 actual original Spectrum source IDs, including three setup
 * Permanents; focused cards are moved rather than replacing the source deck. */
export function spectrumBase(
  other?: "spider_man" | "drax",
  spectrumSeat = "p1",
) {
  let s = spectrumStarting(other, spectrumSeat);
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    const source = [
      ...v.player.deck,
      ...v.player.hand,
      ...v.player.discard,
      ...v.player.inPlay,
    ];
    expect(source).toHaveLength(seat.heroId === "spectrum" ? 43 : 40);
    source.forEach((p) => (p.ownerId = seat.id));
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = source.filter(isForm);
    v.player.deck = source.filter((p) => !isForm(p));
    v.player.form = seat.heroId === "spectrum" ? "alter" : "hero";
    v.player.exhausted = false;
    v.player.flipped = false;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.attachments = [];
  s.sideSchemes = [];
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as SourceState).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, spectrumSeat);
  s = finish(native(s, { type: "beginTurn", actorId: spectrumSeat }));
  return s;
}
export function enterSpectrum(
  s: GameState,
  form: SpectrumEnergyForm = "gamma",
) {
  const id = s.player.inPlay.find(
    (p) => p.code === SPECTRUM_FORM_CODES[form],
  )!.id;
  s = command(s, { type: "FLIP" });
  expect(s.prompt?.title).toBe("Energy Transformation");
  expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
    s.player.inPlay
      .filter(isForm)
      .map((p) => p.id)
      .sort(),
  );
  return finish(choose(s, id));
}
