import { describe, expect, it } from "vitest";
import {
  paymentStatus,
  suggestPayment,
  type PaymentSource,
} from "../src/game/payment";

const source = (id: string, value = 1, localId?: string): PaymentSource => ({
  id,
  localId,
  code: "01089",
  name: id,
  kind: "card",
  resources: Array(value).fill("physical"),
  description: "Printed resources",
});

describe("Joining Forces preserves a whole physical ally pair before Alliance payment", () => {
  it("chooses an affordable alternative pair instead of spending its last Guardian", () => {
    const sources = [
      source("avenger-a"),
      source("avenger-b"),
      source("guardian"),
      source("energy", 2),
    ];
    const pairs = [
      ["avenger-a", "guardian"],
      ["avenger-b", "guardian"],
    ];
    const ids = suggestPayment(sources, 3, [], () => 0, [], undefined, pairs);
    expect(ids).not.toBeNull();
    expect(ids).not.toContain("guardian");
    expect(ids).toContain("energy");
    expect(
      paymentStatus(sources, ids!, 3, [], [], undefined, pairs).ready,
    ).toBe(true);
  });

  it("rejects consuming a donor's retained ally using its owner-qualified resource ID", () => {
    const sources = [
      source("avenger"),
      source("alliance:p2:guardian", 1, "guardian"),
      source("energy", 2),
    ];
    const pairs = [["avenger", "guardian"]];
    const status = paymentStatus(
      sources,
      ["alliance:p2:guardian", "energy"],
      3,
      [],
      [],
      undefined,
      pairs,
    );
    expect(status.total).toBe(3);
    expect(status.retainedAlternative).toBe(false);
    expect(status.ready).toBe(false);
    expect(
      suggestPayment(sources, 3, [], () => 0, [], undefined, pairs),
    ).toBeNull();
  });

  it("preserves required resource abilities together with the unspent pair", () => {
    const sources = [
      source("avenger"),
      source("guardian"),
      { ...source("ability"), kind: "ability" as const },
      source("energy", 2),
    ];
    const pairs = [["avenger", "guardian"]];
    const required = {
      ids: ["ability"],
      minimum: 1,
      label: "Use the required ability",
    };
    expect(
      suggestPayment(sources, 3, [], () => 0, [], required, pairs),
    ).toEqual(["ability", "energy"]);
  });
});
