import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine.js";
import { heroStats } from "../src/game/cards.js";
import {
  command,
  choose,
  finish,
  put,
  side,
  hand,
  pay,
} from "./dv-test-helpers.js";
const base = () => {
  let s = newGame({
    heroId: "wsp",
    aspect: "aggression",
    villainId: "rhino",
    seed: 43,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  s.player.heroForm = "giant";
  s.player.exhausted = false;
  s.player.hand = [];
  s.player.inPlay = [];
  s.sideSchemes = [];
  s.scheme.threat = 10;
  put(s, "13010");
  return s;
};
describe("Giant Wasp basic thwarts against Assault", () => {
  it("uses ATK instead of Helmet-enhanced THW against the only eligible scheme", () => {
    let s = base();
    s.scheme.threat = 0;
    const scheme = side(s, "01107", 10);
    const approach = put(s, "43020");
    approach.attachedTo = scheme.id;
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 3 });
    s = command(s, { type: "BASIC", action: "thwart" });
    s = finish(s);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(8);
  });
  it("shares one ATK pool between an Assault scheme and an ordinary scheme", () => {
    let s = base();
    const assault = side(s, "43018", 10);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === `${assault.id}:3`)).toBe(
      false,
    );
    expect(s.prompt?.options.some((o) => o.id === "main:1")).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === "main:3")).toBe(true);
    s = choose(s, `${assault.id}:1`);
    if (s.prompt) s = choose(s, "main:1");
    s = finish(s);
    expect(s.scheme.threat).toBe(9);
    expect(s.sideSchemes.find((p) => p.id === assault.id)?.counters).toBe(9);
  });
  it("retains the THW pool when the division only targets ordinary schemes", () => {
    let s = base();
    const assault = side(s, "43018", 10);
    const ordinary = side(s, "43039", 10);
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, "main:2");
    if (s.prompt) {
      expect(s.prompt.options.some((o) => o.id.startsWith(assault.id))).toBe(
        false,
      );
      s = choose(s, `${ordinary.id}:1`);
    }
    s = finish(s);
    expect(s.scheme.threat).toBe(8);
    expect(s.sideSchemes.find((p) => p.id === ordinary.id)?.counters).toBe(9);
    expect(s.sideSchemes.find((p) => p.id === assault.id)?.counters).toBe(10);
  });
  it("adds Rapid Growth's basic-power bonus to the Assault ATK pool", () => {
    let s = base();
    s.scheme.threat = 0;
    s.player.heroForm = "tiny";
    const scheme = side(s, "01107", 10);
    put(s, "43020").attachedTo = scheme.id;
    const [rapid, resource] = hand(s, "13005", "01089");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, rapid.id);
    s = finish(pay(s, [resource]));
    expect(s.player.heroForm).toBe("giant");
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(6);
  });
});
