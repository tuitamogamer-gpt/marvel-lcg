import { describe, expect, it } from "vitest";
import { makePiece, newGame } from "../src/game/engine.js";
import type { Aspect, GameState } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  finish,
  hand,
  minion,
  native,
  play,
  put,
  reload,
  side,
  target,
} from "./dv-test-helpers.js";

function base(heroId = "spider_man", aspect: Aspect = "leadership") {
  let s = newGame({
    heroId,
    aspect,
    villainId: "rhino",
    module: "bomb_scare",
    seed: 50028,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  s = finish(command(s, { type: "FLIP" }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.scheme.threat = 0;
  s.villain.hp = s.villain.maxHp = 100;
  s.encounter.deck = Array.from({ length: 30 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function front(input: GameState) {
  const [p] = hand(input, "50028");
  const s = finish(play(input, p));
  expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  return { s, p };
}
const reveal = (s: GameState, code: string) =>
  native(s, { type: "reveal", piece: makePiece(s, code), skip: true });

describe("explicit legacy encounter discard instructions", () => {
  it("Crisis on Halfworld waits for Front replacement before checking the actual upgrade and gaining Surge", () => {
    const setup = front(base("rocket", "aggression"));
    let s = setup.s;
    const upgrade = put(s, "16035");
    const surge = s.encounter.deck[0];
    s = choose(reveal(s, "16053"), "stay");
    s = choose(s, "discard");
    expect(s.prompt?.title).toBe("Front Organization");
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    s = finish(choose(reload(s), setup.p.id));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === setup.p.id)).toBe(true);
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([surge.id]);
    conserved(s, [upgrade, setup.p]);
  });

  it.each([1, 2])(
    "Home by Dawn protects Bruno's actual tucked card with %s Persona choice(s), and Front counts as a discarded support",
    (count) => {
      const setup = front(base("ms_marvel", "protection"));
      let s = setup.s;
      const bruno = put(s, "05007");
      const stored = makePiece(s, "05003");
      stored.ownerId = s.activePlayerId;
      bruno.storedCards = [stored];
      if (count === 2) put(s, "05008");
      s = choose(reveal(s, "05025"), "stay");
      s = choose(s, "discard");
      if (count === 2) s = choose(reload(s), bruno.id);
      expect(s.prompt?.title).toBe("Front Organization");
      s = finish(choose(reload(s), setup.p.id));
      expect(
        s.player.inPlay
          .find((p) => p.id === bruno.id)
          ?.storedCards?.map((p) => p.id),
      ).toEqual([stored.id]);
      expect(s.player.discard.some((p) => p.id === setup.p.id)).toBe(true);
      expect(s.player.discard.some((p) => p.id === stored.id)).toBe(false);
      expect(s.encounter.dealt).toHaveLength(0);
      expect(
        s.encounter.discard.filter((p) => p.code === "05025"),
      ).toHaveLength(1);
      conserved(s, [bruno, stored, setup.p]);
    },
  );

  it.each([true, false])(
    "Infiltration pauses its two-card draw until the saved Front choice resolves (replace=%s)",
    (replace) => {
      const setup = front(base());
      let s = setup.s;
      const mansion = put(s, "01091");
      const infiltration = makePiece(s, "32082");
      const next = s.player.deck[0];
      s.player.deck.unshift(infiltration);
      s = native(s, { type: "draw", amount: 2 });
      expect(s.prompt?.title).toBe("Infiltration");
      s = choose(reload(s), mansion.id);
      expect(s.prompt?.title).toBe("Front Organization");
      expect(s.player.hand.map((p) => p.id)).toEqual([infiltration.id]);
      expect(s.player.deck[0].id).toBe(next.id);
      s = finish(choose(reload(s), replace ? setup.p.id : "allow"));
      expect(s.player.hand.map((p) => p.id)).toEqual([
        infiltration.id,
        next.id,
      ]);
      expect(s.player.inPlay.some((p) => p.id === mansion.id)).toBe(replace);
      expect(s.player.inPlay.some((p) => p.id === setup.p.id)).toBe(!replace);
      expect(
        s.player.discard.some(
          (p) => p.id === (replace ? setup.p.id : mansion.id),
        ),
      ).toBe(true);
      conserved(s, [mansion, setup.p]);
    },
  );

  it("enemy Gamora's actual attack damage permits Front replacement for the victim's upgrade", () => {
    const setup = front(base("nebu", "justice"));
    let s = setup.s;
    const upgrade = put(s, "22004");
    const gamora = minion(s, "22028");
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: gamora.id });
    s = choose(s, "take");
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.prompt?.title).toBe("Gamora");
    s = choose(reload(s), upgrade.id);
    expect(s.prompt?.title).toBe("Front Organization");
    s = finish(choose(reload(s), setup.p.id));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === setup.p.id)).toBe(true);
    conserved(s, [upgrade, setup.p]);
  });

  it("defeating Funhouse while already stunned replaces its actual upgrade discard", () => {
    const setup = front(base());
    let s = setup.s;
    const upgrade = put(s, "01081");
    const trap = side(s, "47032", 1);
    s.player.stunned = true;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, trap.id);
    expect(s.prompt?.title).toBe("Arcade's Funhouse");
    s = choose(reload(s), upgrade.id);
    expect(s.prompt?.title).toBe("Front Organization");
    s = finish(choose(reload(s), setup.p.id));
    expect(s.sideSchemes.some((p) => p.id === trap.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === setup.p.id)).toBe(true);
    conserved(s, [upgrade, setup.p]);
  });

  it("Front never replaces the player's Lethal Weapon upgrade-discard cost", () => {
    const setup = front(base("nebu", "justice"));
    let s = finish(reveal(setup.s, "22030"));
    const weapon = s.attachments.find((p) => p.code === "22030")!;
    const upgrade = put(s, "22004");
    s = command(s, { type: "ABILITY", id: weapon.id, action: "lethal-weapon" });
    s = finish(choose(reload(s), upgrade.id));
    expect(s.player.inPlay.some((p) => p.id === setup.p.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === weapon.id)).toBe(false);
    conserved(s, [upgrade, setup.p]);
  });
});
