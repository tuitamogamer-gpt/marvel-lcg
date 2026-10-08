import { describe, it, expect } from "vitest";
import { newGame } from "../src/game/engine";
import { significantEvent } from "../src/milestones";
const base = () =>
  newGame({
    heroId: "ironheart",
    aspect: "leadership",
    villainId: "rhino",
    module: "armadillo",
    seed: 42,
  });
describe("significant event motion", () => {
  it("stays quiet for ordinary attacks, draws and restored snapshots", () => {
    const before = base(),
      after = structuredClone(before);
    after.combatEvents = [
      {
        attacker: { code: "29001a", name: "Ironheart" },
        target: { code: after.villain.code, name: "Rhino" },
        blocked: false,
        enemy: false,
      },
    ];
    after.villain.hp--;
    expect(significantEvent(before, after)).toBeNull();
    expect(significantEvent(after, structuredClone(after))).toBeNull();
  });
  it("prioritizes a new outcome over a stage change and never replays it", () => {
    const before = base(),
      after = structuredClone(before);
    after.phase = "won";
    after.villain.stage++;
    expect(significantEvent(before, after)?.kind).toBe("victory");
    expect(significantEvent(after, structuredClone(after))).toBeNull();
    after.phase = "lost";
    expect(significantEvent(before, after)?.kind).toBe("defeat");
  });
  it("recognizes a stage advance but not damage or a form change", () => {
    const before = base(),
      after = structuredClone(before);
    after.villain.code = "01095";
    expect(significantEvent(before, after)).toBeNull();
    after.villain.stage++;
    expect(significantEvent(before, after)?.kind).toBe("stage");
  });
  it("recognizes the actual physical upgraded Ironheart identity", () => {
    const before = base(),
      after = structuredClone(before);
    const seat = after.players[0];
    seat.player.ironheartIdentity = {
      ...seat.player.ironheartIdentity!,
      code: "29002a",
    };
    expect(significantEvent(before, after)).toMatchObject({
      kind: "upgrade",
      detail: "Ironheart · Version 2",
    });
    expect(significantEvent(after, structuredClone(after))).toBeNull();
  });
});
