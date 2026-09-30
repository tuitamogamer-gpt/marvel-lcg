import { describe, expect, it } from "vitest";
import { keywordsIn, shortReason } from "../src/game/glossary";

describe("card glossary", () => {
  it("recognises printed keywords regardless of case or HTML formatting", () => {
    expect(
      keywordsIn(
        "<b>hero action</b> (attack): stun an enemy. <i>QUICKSTRIKE</i>",
      ).map((g) => g.term),
    ).toEqual(["Stunned", "Quickstrike", "Hero Action"]);
  });
  it("keeps mandatory abilities separate from optional windows", () => {
    expect(
      keywordsIn("<b>Forced Interrupt:</b> Before an attack.").map(
        (g) => g.term,
      ),
    ).toEqual(["Forced Interrupt"]);
    expect(
      keywordsIn(
        "Forced Response: After an attack. Response: Draw a card.",
      ).map((g) => g.term),
    ).toEqual(["Forced Response", "Response"]);
  });
  it("distinguishes missing resources from targets and timing restrictions", () => {
    expect(shortReason("Not enough resources in your hand or play area.")).toBe(
      "NEED RESOURCES",
    );
    expect(
      shortReason("You cannot pay 3 for Swinging Web Kick right now."),
    ).toBe("NEED RESOURCES");
    expect(shortReason("There is no minion to attack.")).toBe("NO TARGET");
    expect(shortReason("Change to alter-ego form first.")).toBe("ALTER-EGO");
    expect(shortReason("Finish the current decision first.")).toBe("WAIT");
  });
});
