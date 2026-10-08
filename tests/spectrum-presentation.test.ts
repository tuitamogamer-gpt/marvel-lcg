import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerCardImage } from "../src/App.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";

function fixture() {
  const game = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 21002,
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      { heroId: "captain_marvel", aspect: "leadership" },
    ],
  });
  game.players[1].heroId = "spectrum";
  const owner = seatView(game, game.players[1]);
  owner.player.form = "hero";
  owner.player.inPlay = [];
  const forms = ["21002", "21003", "21004"].map((code) =>
    makePiece(owner, code),
  );
  owner.player.inPlay.push(...forms);
  owner.flags.spectrumEnergyFormId = forms[1].id;
  return { game, owner, forms };
}
const render = (game: GameState, piece: Piece) =>
  renderToStaticMarkup(createElement(PlayerCardImage, { game, piece }));

describe("physical Spectrum energy form presentation", () => {
  it.each(["owner", "teammate"])(
    "renders only the selected physical form faceup in the %s view",
    (viewer) => {
      const { game, owner, forms } = fixture();
      const view = viewer === "owner" ? owner : game;
      const ids = forms.map((p) => p.id);
      expect(render(view, forms[0])).toContain('data-card-preview="back:hero"');
      expect(render(view, forms[0])).not.toContain('data-card-preview="21002"');
      expect(render(view, forms[1])).toContain('data-card-preview="21003"');
      expect(render(view, forms[1])).toContain('alt="Photon"');
      expect(render(view, forms[2])).toContain('data-card-preview="back:hero"');
      expect(forms.map((p) => p.id)).toEqual(ids);
    },
  );
  it("reads the physical owner's flags rather than the active viewer's conflicting form flag", () => {
    const { game, forms } = fixture();
    game.flags.spectrumEnergyFormId = forms[0].id;
    expect(render(game, forms[0])).toContain('data-card-preview="back:hero"');
    expect(render(game, forms[1])).toContain('data-card-preview="21003"');
  });
  it("keeps all three physical forms facedown after power-down and JSON reload", () => {
    const { game, owner, forms } = fixture();
    owner.player.form = "alter";
    delete owner.flags.spectrumEnergyFormId;
    const restored = JSON.parse(JSON.stringify(game)) as GameState;
    for (const p of forms)
      expect(render(restored, p)).toContain('data-card-preview="back:hero"');
    expect(restored.players[1].player.inPlay.map((p) => p.id)).toEqual(
      forms.map((p) => p.id),
    );
  });
  it("uses the normal printed image for other physical player cards", () => {
    const { game } = fixture();
    const ally = makePiece(game, "21019");
    expect(render(game, ally)).toContain('data-card-preview="21019"');
    expect(render(game, ally)).not.toContain('data-card-preview="back:hero"');
  });
});
