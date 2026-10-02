import { describe, expect, it } from "vitest";
import { newGame, dispatch } from "../src/game/engine";
import { fairClone } from "../src/game/lookahead";
import { activateSeat, syncSeat } from "../src/game/team";

describe("native hidden-information boundaries", () => {
  it("keeps only the faceup Invocation fixed when sampling the supplementary deck", () => {
    let a = newGame({
      heroId: "doctor_strange",
      aspect: "protection",
      villainId: "rhino",
      seed: 41,
    });
    a = dispatch(a, { type: "MULLIGAN", ids: [] });
    while (a.review) a = dispatch(a, { type: "PROCEED" });
    expect(a.phase).toBe("player");
    const b = structuredClone(a);
    activateSeat(b, b.activePlayerId);
    const [top, ...hidden] = b.player.invocationDeck!;
    b.player.invocationDeck = [top, ...hidden.reverse()];
    syncSeat(b);
    const sampleA = fairClone(a, () => 0.25),
      sampleB = fairClone(b, () => 0.25);
    expect(sampleA.player.invocationDeck?.[0].id).toBe(
      a.player.invocationDeck?.[0].id,
    );
    expect(sampleA.player.invocationDeck).toEqual(
      sampleB.player.invocationDeck,
    );
    expect(sampleA.player.invocationDeck).toHaveLength(5);
  });
  it("samples every Invocation while its top is still facedown during setup", () => {
    const a = newGame({
      heroId: "doctor_strange",
      aspect: "protection",
      villainId: "rhino",
      seed: 43,
    });
    const b = structuredClone(a);
    activateSeat(b, b.activePlayerId);
    b.player.invocationDeck!.reverse();
    syncSeat(b);
    expect(fairClone(a, () => 0.25).player.invocationDeck).toEqual(
      fairClone(b, () => 0.25).player.invocationDeck,
    );
  });
  it("preserves a looked-at encounter only for its observer and only while the actual top remains", () => {
    const s = newGame({
      heroId: "doctor_strange",
      aspect: "protection",
      villainId: "rhino",
      seed: 42,
      heroes: [
        { heroId: "doctor_strange", aspect: "protection" },
        { heroId: "black_widow", aspect: "justice" },
      ],
    });
    const top = s.encounter.deck[0];
    s.encounter.knownTop = { id: top.id, playerId: "p1" };
    expect(fairClone(s, () => 0).encounter.deck[0].id).toBe(top.id);
    const unknown = structuredClone(s);
    delete unknown.encounter.knownTop;
    activateSeat(s, "p2");
    activateSeat(unknown, "p2");
    expect(fairClone(s, () => 0).encounter.deck).toEqual(
      fairClone(unknown, () => 0).encounter.deck,
    );
    activateSeat(s, "p1");
    activateSeat(unknown, "p1");
    s.encounter.deck.push(s.encounter.deck.shift()!);
    unknown.encounter.deck.push(unknown.encounter.deck.shift()!);
    expect(fairClone(s, () => 0).encounter.deck).toEqual(
      fairClone(unknown, () => 0).encounter.deck,
    );
  });
});
