import { describe, expect, it } from "vitest";
import {
  abilityOptions,
  canChangeIdentityForm,
  dispatch,
  makePiece,
  newGame,
  targets,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import { card } from "../src/game/cards.js";
import { spectrumEnergyForm } from "../src/game/spectrum.js";
import {
  actualEncounter,
  base,
  choose,
  command,
  conserved,
  hand,
  native,
  physical,
  put,
  reload,
  settle,
  until,
} from "./project-wideawake-test-helpers.js";

function targetedSpdr() {
  let s = newGame({
    heroId: "spdr",
    aspect: "protection",
    villainId: "project_wideawake",
    captureAllocation: [0],
    seed: 321070,
    pacing: "expert",
  });
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s = settle(command(s, { type: "FLIP" }));
  const protocol = put(s, "31008");
  put(s, "31011");
  const marker = actualEncounter(s, "32107"),
    sentinel = actualEncounter(s, "32105");
  marker.attachedTo = "hero:p1";
  sentinel.engagedWith = "p1";
  s.attachments.push(marker);
  s.minions.push(sentinel);
  return { s, protocol };
}

describe("Sentinels actual native card rules", () => {
  it("Targeted attaches its original source, blocks only hero-to-alter, and pays identity exhaustion", () => {
    let s = base();
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    sentinel.engagedWith = s.activePlayerId;
    s.minions.push(sentinel);
    s = settle(native(s, { type: "reveal", piece: marker, skip: true }));
    expect(s.attachments.find((p) => p.id === marker.id)?.attachedTo).toBe(
      "hero:p1",
    );
    expect(canChangeIdentityForm(s)).toBe(false);
    const denied = dispatch(reload(s), { type: "FLIP" });
    expect(denied.error).toMatch(/Targeted for Elimination/);
    expect(denied.player).toMatchObject({
      form: "hero",
      flipped: false,
      exhausted: false,
    });
    s.player.form = "alter";
    expect(canChangeIdentityForm(s)).toBe(true);
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("hero");
    const option = abilityOptions(
      s,
      s.attachments.find((p) => p.id === marker.id)!,
    )[0];
    s = settle(
      command(s, { type: "ABILITY", id: marker.id, action: option.id }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === marker.id)).toBe(true);
    expect(canChangeIdentityForm(s)).toBe(true);
    conserved(s);
  });

  it("Targeted remains restricted by another card's Sentinel trait while the minion text is blank", () => {
    let s = base();
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    marker.attachedTo = "hero:p1";
    sentinel.engagedWith = "p1";
    s.attachments.push(marker);
    s.minions.push(sentinel);
    s.flags[`novaIronheartPackBlank:${sentinel.id}`] = s.round;
    expect(canChangeIdentityForm(s)).toBe(false);
    s.flags[`novaIronheartPackBlank:${marker.id}`] = s.round;
    expect(canChangeIdentityForm(s)).toBe(true);
    conserved(s);
  });

  it("Targeted permits Ant-Man's hero-face changes but prevents a native forced default flip to alter-ego", () => {
    let s = base("ant");
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    marker.attachedTo = "hero:p1";
    sentinel.engagedWith = "p1";
    s.attachments.push(marker);
    s.minions.push(sentinel);
    s.player.heroForm = "tiny";
    expect(canChangeIdentityForm(s)).toBe(true);
    s = settle(native(s, { type: "flip", counts: false }));
    expect(s.player).toMatchObject({ form: "hero", heroForm: "tiny" });
    s = settle(command(s, { type: "FLIP", target: "giant" }));
    expect(s.player).toMatchObject({ form: "hero", heroForm: "giant" });
    conserved(s);
  });

  it("Targeted prevents a generic obligation from offering a prohibited alter-ego flip", () => {
    let s = base();
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    marker.attachedTo = "hero:p1";
    sentinel.engagedWith = "p1";
    s.attachments.push(marker);
    s.minions.push(sentinel);
    const obligation = s.encounter.deck.find(
      (p) =>
        card(p).type_code === "obligation" && card(p).set_code === s.heroId,
    )!;
    expect(obligation).toBeTruthy();
    s.encounter.deck.splice(s.encounter.deck.indexOf(obligation), 1);
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["penalty"]);
    s = settle(choose(s, "penalty"));
    expect(s.player).toMatchObject({ form: "hero", exhausted: false });
    conserved(s);
  });

  it.each([
    ["captain_america", "03026"],
    ["ms_marvel", "05025"],
    ["ant", "12025"],
    ["wsp", "13026"],
  ])(
    "Targeted prevents %s's actual obligation from offering an alter-ego flip or exhaustion cost",
    (heroId, code) => {
      let s = base(heroId);
      const marker = actualEncounter(s, "32107"),
        sentinel = actualEncounter(s, "32105"),
        obligation = actualEncounter(s, code);
      marker.attachedTo = "hero:p1";
      sentinel.engagedWith = "p1";
      s.attachments.push(marker);
      s.minions.push(sentinel);
      s = native(s, { type: "reveal", piece: obligation, skip: true });
      expect(s.prompt?.options.some((o) => o.id === "flip")).toBe(false);
      if (s.prompt?.options.some((o) => o.id === "stay")) s = choose(s, "stay");
      expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
      expect(s.player).toMatchObject({ form: "hero", exhausted: false });
      expect(s.resolving.some((p) => p.id === obligation.id)).toBe(true);
      conserved(s);
    },
  );

  it.each([
    ["captain_america", "03026"],
    ["ms_marvel", "05025"],
    ["ant", "12025"],
    ["wsp", "13026"],
  ])(
    "%s's saved obligation flip revalidates Targeted before changing form or paying exhaustion",
    (heroId, code) => {
      let s = base(heroId);
      const obligation = actualEncounter(s, code);
      s = native(s, { type: "reveal", piece: obligation, skip: true });
      expect(s.prompt?.options.some((o) => o.id === "flip")).toBe(true);
      const marker = actualEncounter(s, "32107"),
        sentinel = actualEncounter(s, "32105");
      marker.attachedTo = "hero:p1";
      sentinel.engagedWith = "p1";
      s.attachments.push(marker);
      s.minions.push(sentinel);
      const rejected = dispatch(reload(s), { type: "CHOOSE", id: "flip" });
      expect(rejected.error).toBeTruthy();
      expect(rejected.player).toMatchObject({
        form: "hero",
        exhausted: false,
      });
      expect(rejected.resolving.some((p) => p.id === obligation.id)).toBe(true);
      conserved(rejected);
    },
  );

  it("Targeted permits Spectrum's actual energy-form event while still preventing alter-ego", () => {
    let s = newGame({
      heroId: "spectrum",
      aspect: "leadership",
      villainId: "project_wideawake",
      captureAllocation: [0],
      seed: 321071,
      pacing: "expert",
    });
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s = command(s, { type: "FLIP" });
    const pulsar = s.player.inPlay.find((p) => p.code === "21004")!;
    s = settle(choose(s, pulsar.id));
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    marker.attachedTo = "hero:p1";
    sentinel.engagedWith = "p1";
    s.attachments.push(marker);
    s.minions.push(sentinel);
    expect(canChangeIdentityForm(s, "alter")).toBe(false);
    const speed = hand(s, "21010")[0],
      photon = s.player.inPlay.find((p) => p.code === "21003")!;
    s = command(s, { type: "PLAY", id: speed.id });
    expect(s.prompt?.options.some((o) => o.id === photon.id)).toBe(true);
    s = settle(choose(s, photon.id));
    expect(spectrumEnergyForm(s)).toBe("photon");
    expect(s.player.form).toBe("hero");
    expect(s.player.discard.filter((p) => p.id === speed.id)).toHaveLength(1);
    expect(s.player.inPlay.filter((p) => p.id === photon.id)).toHaveLength(1);
    expect(canChangeIdentityForm(s, "alter")).toBe(false);
  });

  it("a teammate cannot exhaust their identity to remove another player's marker", () => {
    let s = base("spider_man", true);
    const marker = actualEncounter(s, "32107");
    marker.attachedTo = "hero:p1";
    s.attachments.push(marker);
    activateSeat(s, "p2");
    expect(abilityOptions(s, marker)).toEqual([]);
    const result = dispatch(reload(s), {
      type: "ABILITY",
      id: marker.id,
      action: `discard:${marker.id}`,
    });
    expect(result.error).toBeTruthy();
    expect(seatView(result, "p2").player.exhausted).toBe(false);
    expect(result.attachments.some((p) => p.id === marker.id)).toBe(true);
    conserved(result);
  });

  it("Targeted blocks only Ejection Protocol's final flip while its other printed effects resolve", () => {
    let { s, protocol } = targetedSpdr();
    s.player.hp = 3;
    s.player.tough = false;
    protocol.exhausted = true;
    const interfaceIds = s.player.inPlay
      .filter((p) => card(p).traits?.includes("Interface."))
      .map((p) => p.id);
    expect(interfaceIds.length).toBeGreaterThan(0);
    expect(
      abilityOptions(s, protocol).some((o) => o.id === "ejection-protocol"),
    ).toBe(true);
    s = settle(
      command(s, {
        type: "ABILITY",
        id: protocol.id,
        action: "ejection-protocol",
      }),
    );
    expect(s.player).toMatchObject({ hp: 6, tough: true, form: "hero" });
    expect(s.player.inPlay.some((p) => p.id === protocol.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === protocol.id)).toHaveLength(
      1,
    );
    for (const id of interfaceIds)
      expect(s.player.inPlay.find((p) => p.id === id)?.exhausted).toBe(true);
    expect(physical(s).filter((p) => p.id === protocol.id)).toHaveLength(1);
  });

  it("Ejection Protocol cannot pay its discard cost when every effect is already satisfied or prohibited", () => {
    const { s, protocol } = targetedSpdr();
    s.player.hp = 6;
    s.player.tough = true;
    for (const p of s.player.inPlay)
      if (card(p).traits?.includes("Interface.")) p.exhausted = true;
    expect(
      abilityOptions(s, protocol).some((o) => o.id === "ejection-protocol"),
    ).toBe(false);
    const rejected = dispatch(reload(s), {
      type: "ABILITY",
      id: protocol.id,
      action: "ejection-protocol",
    });
    expect(rejected.error).toBeTruthy();
    expect(rejected.player).toMatchObject({ hp: 6, tough: true, form: "hero" });
    expect(
      rejected.player.inPlay.some((p) => p.id === protocol.id && !p.exhausted),
    ).toBe(true);
    expect(physical(rejected).filter((p) => p.id === protocol.id)).toHaveLength(
      1,
    );
  });

  it("Mark V attacks its actual alter-ego target when already marked", () => {
    let s = base();
    const marker = actualEncounter(s, "32107"),
      sentinel = actualEncounter(s, "32105");
    marker.attachedTo = "hero:p1";
    s.attachments.push(marker);
    s.player.form = "alter";
    s = settle(native(s, { type: "reveal", piece: sentinel, skip: true }));
    expect(s.player.hp).toBe(7);
    expect(s.enemyAttackCounts?.[sentinel.id]).toBe(1);
    conserved(s);
  });

  it("Mark V searches and reveals the actual Targeted card without an extra attack", () => {
    let s = base();
    const sentinel = actualEncounter(s, "32105");
    s = settle(native(s, { type: "reveal", piece: sentinel, skip: true }));
    expect(s.attachments.filter((p) => p.code === "32107")).toHaveLength(1);
    expect(s.player.hp).toBe(10);
    expect(s.enemyAttackCounts?.[sentinel.id] || 0).toBe(0);
    conserved(s);
  });

  it("Mark VI performs native Quickstrike once after its actual entry", () => {
    let s = base();
    const sentinel = actualEncounter(s, "32106");
    s = settle(native(s, { type: "reveal", piece: sentinel, skip: true }));
    expect(s.player.hp).toBe(8);
    expect(s.enemyAttackCounts?.[sentinel.id]).toBe(1);
    expect(physical(s).filter((p) => p.id === sentinel.id)).toHaveLength(1);
    conserved(s);
  });

  it("Mark VI boost goes to the first player's chosen marked identity and still counts Amplify", () => {
    let s = base("spider_man", true);
    const boost = actualEncounter(s, "32106"),
      a = actualEncounter(s, "32107"),
      b = actualEncounter(s, "32107");
    a.attachedTo = "hero:p1";
    b.attachedTo = "hero:p2";
    s.attachments.push(a, b);
    const mayhem = makePiece(s, "32081");
    mayhem.counters = 3;
    s.sideSchemes.push(mayhem);
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = until(s, (v) => v.prompt?.title === "Sentinel Mark VI");
    expect(s.activePlayerId).toBe(s.firstPlayerId);
    s = settle(choose(s, "p1"));
    expect(s.encounter.dealt.find((p) => p.id === boost.id)?.dealtTo).toBe(
      "p1",
    );
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(physical(s).filter((p) => p.id === boost.id)).toHaveLength(1);
    conserved(s);
  });

  it("Relentless Robots blocks the engaged player's actual thwart even with Phased, while non-thwart removal is legal", () => {
    let s = base("shadowcat", true);
    const scheme = actualEncounter(s, "32108"),
      sentinel = actualEncounter(s, "32105");
    scheme.counters = 6;
    sentinel.engagedWith = "p1";
    s.sideSchemes.push(scheme);
    s.minions.push(sentinel);
    const mass = s.player.inPlay.find((p) =>
      ["32031a", "32031b"].includes(p.code),
    )!;
    mass.code = "32031b";
    expect(
      targets(s, "scheme", false, true).some((p) => p.id === scheme.id),
    ).toBe(false);
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 2,
        action: true,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(6);
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 2,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(4);
    activateSeat(s, "p2");
    expect(
      targets(s, "scheme", false, true).some((p) => p.id === scheme.id),
    ).toBe(true);
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 2,
        action: true,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
    conserved(s);
  });
});
