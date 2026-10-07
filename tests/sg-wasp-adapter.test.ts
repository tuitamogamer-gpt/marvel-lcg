import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine.js";
import { heroStats } from "../src/game/cards.js";
import {
  choose,
  command,
  finish,
  minion,
  put,
  respond,
  target,
} from "./sg-test-helpers.js";

function giant() {
  let s = newGame({
    heroId: "wsp",
    aspect: "aggression",
    villainId: "rhino",
    seed: 18018,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.heroForm = "giant";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.prompt = null;
  s.review = null;
  s.queue = [];
  return s;
}

describe("Godslayer with Giant Wasp's single simultaneous basic attack", () => {
  it("adds two total ATK only after a unique enemy is actually declared, preserving the original target set", () => {
    let s = giant();
    const sword = put(s, "18018");
    const unique = minion(s, "01172", undefined, 3);
    const other = minion(s, "01110");
    const unchosen = minion(s, "01121");
    const hp = s.player.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${unique.id}:1`);
    s = target(s, `${other.id}:1`);
    s = respond(s, /Godslayer/);
    expect(s.prompt?.title).toBe("Godslayer damage");
    expect(
      s.prompt?.options.some((o) => o.id.startsWith(unchosen.id + ":")),
    ).toBe(false);
    expect(
      s.prompt?.options.some((o) => o.id.startsWith(s.villain.id + ":")),
    ).toBe(false);
    expect(s.minions.find((p) => p.id === unique.id)?.damage).toBe(3);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(0);
    s = choose(s, `${unique.id}:1`);
    s = finish(choose(s, `${other.id}:1`));
    expect(s.minions.map((p) => p.id)).toEqual([unchosen.id]);
    expect(s.player.hp).toBe(hp);
    expect(s.villain.hp).toBe(50);
    expect(heroStats(s).attack).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      true,
    );
  });
  it("can decline Godslayer without changing the original division or exhausting the sword", () => {
    let s = giant();
    const sword = put(s, "18018");
    const unique = minion(s, "01103");
    const guard = minion(s, "01101");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${unique.id}:1`);
    s = finish(target(s, `${guard.id}:1`));
    expect(s.minions.find((p) => p.id === unique.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      false,
    );
  });
  it("does not qualify merely because an unchosen unique villain is an available target", () => {
    let s = giant();
    const sword = put(s, "18018");
    const first = minion(s, "01110"),
      second = minion(s, "01121");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${first.id}:1`);
    s = finish(target(s, `${second.id}:1`));
    expect(s.minions.find((p) => p.id === first.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === second.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      false,
    );
  });
  it("does not offer Godslayer or damage allocation when Stun replaces Giant Wasp's power", () => {
    let s = giant();
    const sword = put(s, "18018");
    s.player.stunned = true;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      false,
    );
  });
  it("stacks two physical Godslayers into four additional total damage with saved allocation choices", () => {
    let s = giant();
    const first = put(s, "18018"),
      second = put(s, "18018");
    const unique = minion(s, "01172"),
      other = minion(s, "01110");
    const hp = s.player.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${unique.id}:1`);
    s = target(s, `${other.id}:1`);
    s = respond(s, /Godslayer/);
    s = respond(s, /Godslayer/);
    expect(s.prompt?.text).toContain("4 additional damage");
    s = choose(s, `${unique.id}:3`);
    s = finish(choose(s, `${other.id}:1`));
    expect(s.minions).toHaveLength(0);
    expect(s.player.hp).toBe(hp);
    expect(heroStats(s).attack).toBe(2);
    expect(
      s.player.inPlay
        .filter((p) => [first.id, second.id].includes(p.id))
        .every((p) => p.exhausted),
    ).toBe(true);
  });
  it("adds Godslayer once to Hand Cannon's distributed attack before each enemy's Follow Through and Overkill", () => {
    let s = giant();
    put(s, "18018");
    const cannon = put(s, "16046");
    cannon.counters = 3;
    put(s, "16045");
    const unique = minion(s, "01103", undefined, 2),
      other = minion(s, "01110");
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Hand Cannon/);
    s = choose(s, `${unique.id}:2`);
    s = target(s, `${other.id}:2`);
    s = respond(s, /Godslayer/);
    s = choose(s, `${other.id}:2`);
    s = respond(s, /Follow Through/);
    s = respond(s, /Follow Through/);
    s = finish(s);
    expect(s.minions).toHaveLength(0);
    expect(s.villain.hp).toBe(45);
    expect(heroStats(s).attack).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === cannon.id)).toMatchObject({
      counters: 2,
      exhausted: true,
    });
  });
});
