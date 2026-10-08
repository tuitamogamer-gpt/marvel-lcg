/** Real newGame → dispatch → JSON reload acceptance of Spectrum's source. */
import { describe, expect, it } from "vitest";
import { card, handSize, heroCard, heroStats } from "../src/game/cards.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { deckErrors } from "../src/game/decks.js";
import { makePiece, paymentSources, playable } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  spectrumEnergyForm,
  spectrumFormFaceup,
} from "../src/game/spectrum.js";
import {
  choose,
  command,
  conserved,
  encounterConserved,
  finish,
  hand,
  minion,
  native,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  target,
  until,
} from "./dv-test-helpers.js";
import {
  enterSpectrum,
  isForm,
  spectrumBase,
  spectrumStarting,
} from "./spectrum-test-helpers.js";

describe("Spectrum's physical source and forms", () => {
  it("extracts the same three setup IDs before opening draw from 43 original source cards", () => {
    let s = spectrumStarting();
    const codes = heroStarterCodes("spectrum");
    expect(codes).toHaveLength(43);
    expect(deckErrors("spectrum", "leadership", codes)).toEqual([]);
    const all = physical(s);
    expect(all.map((p) => p.code).sort()).toEqual([...codes].sort());
    expect(new Set(all.map((p) => p.id)).size).toBe(43);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.deck).toHaveLength(34);
    expect(s.player.inPlay.map((p) => p.code).sort()).toEqual([
      "21002",
      "21003",
      "21004",
    ]);
    expect(s.player.inPlay.every((p) => !spectrumFormFaceup(s, p))).toBe(true);
    expect(s.flags.spectrumSetupComplete).toBe(true);
    expect(heroCard(s).code).toBe("21001b");
    expect(heroStats(s).recover).toBe(3);
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    conserved(s, all);
  });

  it.each(["gamma", "photon", "pulsar"] as const)(
    "requires a real Hero-entry %s choice with printed statistics",
    (form) => {
      let s = enterSpectrum(spectrumBase(), form);
      expect(spectrumEnergyForm(s)).toBe(form);
      expect(
        s.player.inPlay.filter((p) => spectrumFormFaceup(s, p)),
      ).toHaveLength(1);
      expect(heroStats(s)).toMatchObject({
        attack: form === "gamma" ? 3 : 1,
        thwart: form === "photon" ? 3 : 1,
        defense: form === "pulsar" ? 3 : 1,
      });
      expect(handSize(s)).toBe(5);
      const ids = s.player.inPlay.map((p) => p.id);
      s.player.flipped = false;
      s = finish(command(s, { type: "FLIP" }));
      expect(spectrumEnergyForm(s)).toBeUndefined();
      expect(s.player.inPlay.map((p) => p.id)).toEqual(ids);
      expect(s.player.inPlay.every((p) => !spectrumFormFaceup(s, p))).toBe(
        true,
      );
    },
  );

  it("keeps actual physical setup/active form flags through a saved round boundary", () => {
    let s = enterSpectrum(spectrumBase(), "photon");
    const ids = s.player.inPlay.filter(isForm).map((p) => p.id);
    s.flags.spectrumRetaliatePhase = `${s.round}:${s.phase}`;
    s.flags.spectrumRetaliateAmount = 2;
    s = finish(native(reload(s), { type: "newRound" }));
    expect(s.flags.spectrumSetupComplete).toBe(true);
    expect(spectrumEnergyForm(s)).toBe("photon");
    expect(s.player.inPlay.filter(isForm).map((p) => p.id)).toEqual(ids);
    expect(s.flags.spectrumRetaliateAmount).toBeUndefined();
  });

  it("protects all three Permanent IDs from native forced discard choices", () => {
    let s = enterSpectrum(spectrumBase());
    const formIds = s.player.inPlay.filter(isForm).map((p) => p.id);
    const duplicate = put(s, "21006");
    s = native(s, { type: "reveal", piece: makePiece(s, "01188") });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([duplicate.id]);
    s = finish(choose(s, duplicate.id));
    expect(s.player.inPlay.filter(isForm).map((p) => p.id)).toEqual(formIds);
  });

  it("counts only the face-up Permanent as an upgrade for Electric Whip damage", () => {
    let s = enterSpectrum(spectrumBase());
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: makePiece(s, "01173") });
    expect(s.prompt?.options).toHaveLength(1);
    expect(s.prompt?.options[0].label).toBe("Take 1 damage");
    s = finish(choose(s, "damage"));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.filter(isForm)).toHaveLength(3);
  });
});

describe("Spectrum native event timing and resources", () => {
  it("Gamma Blast first deals seven, then offers Gamma's separate one-damage response", () => {
    let s = enterSpectrum(spectrumBase(), "photon");
    const [blast, energy, wild] = hand(s, "21007", "21023", "21010");
    const hp = s.villain.hp;
    s = target(play(s, blast, [energy, wild]), s.villain.id);
    expect(spectrumEnergyForm(s)).toBe("gamma");
    expect(s.villain.hp).toBe(hp - 7);
    expect(s.prompt?.title).toBe("Gamma energy form");
    s = choose(s, s.player.inPlay.find((p) => p.code === "21002")!.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(hp - 8);
    expect(s.player.discard.some((p) => p.id === blast.id)).toBe(true);
  });

  it("Gamma Blast already in Gamma gains Overkill through a real minion defeat", () => {
    let s = enterSpectrum(spectrumBase());
    const m = minion(s, "01101");
    const hp = card(m).health!;
    const villainHP = s.villain.hp;
    const cards = hand(s, "21007", "21023", "21010");
    s = finish(target(play(s, cards[0], cards.slice(1)), m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(villainHP - (7 - hp));
    expect(spectrumEnergyForm(s)).toBe("gamma");
  });

  it("Photon Speed already in Photon ignores Crisis for its actual thwart", () => {
    let s = enterSpectrum(spectrumBase(), "photon");
    side(s, "01108", 4);
    const [event, resource] = hand(s, "21008", "21023");
    s = play(s, event, [resource]);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(2);
  });

  it("changing to Photon preserves Crisis for the four-threat event and its later response", () => {
    let s = enterSpectrum(spectrumBase());
    const crisis = side(s, "01108", 5);
    const [event, resource] = hand(s, "21008", "21023");
    s = play(s, event, [resource]);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = target(s, crisis.id);
    expect(s.sideSchemes.find((p) => p.id === crisis.id)?.counters).toBe(1);
    s = choose(s, s.player.inPlay.find((p) => p.code === "21003")!.id);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = finish(target(s, crisis.id));
    expect(s.scheme.threat).toBe(6);
    expect(s.sideSchemes).toHaveLength(0);
  });

  it.each(["stunned", "confused"] as const)(
    "%s replaces the whole paid event including its energy transition",
    (status) => {
      let s = enterSpectrum(spectrumBase(), "pulsar");
      s.player[status] = true;
      const cards = hand(
        s,
        status === "stunned" ? "21007" : "21008",
        "21023",
        ...(status === "stunned" ? ["21010"] : []),
      );
      s = finish(play(s, cards[0], cards.slice(1)));
      expect(spectrumEnergyForm(s)).toBe("pulsar");
      expect(s.player[status]).toBe(false);
      expect(s.villain.hp).toBe(50);
      expect(s.scheme.threat).toBe(6);
      expect(s.player.discard.some((p) => p.id === cards[0].id)).toBe(true);
    },
  );

  it("Speed of Light uses a different real form, draws before its optional response, and does not spend a flip", () => {
    let s = enterSpectrum(spectrumBase());
    const event = hand(s, "21010")[0];
    const photon = s.player.inPlay.find((p) => p.code === "21003")!;
    const gamma = s.player.inPlay.find((p) => p.code === "21002")!;
    s = play(s, event);
    expect(s.prompt?.title).toBe("Speed of Light");
    expect(s.prompt?.options.some((o) => o.id === gamma.id)).toBe(false);
    s = choose(s, photon.id);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.flipped).toBe(true);
    expect(s.prompt?.title).toBe("Photon energy form");
    s = finish(s);
    expect(spectrumEnergyForm(s)).toBe("photon");
  });

  it.each([
    ["gamma", "physical"],
    ["photon", "mental"],
    ["pulsar", "energy"],
  ] as const)(
    "Energy Duplication spends only the actual current %s icon",
    (form, type) => {
      let s = enterSpectrum(spectrumBase(), form);
      const source = put(s, "21006");
      const payment = paymentSources(s).find((p) => p.id === source.id)!;
      expect(payment.resources).toEqual([type]);
      const [upgrade, resource] = hand(s, "21006", "21010");
      s = command(s, { type: "PLAY", id: upgrade.id });
      s = finish(pay(s, [resource], undefined, [source.id]));
      expect(s.player.inPlay.find((p) => p.id === source.id)?.exhausted).toBe(
        true,
      );
      expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    },
  );

  it("Blue Marvel's paid entry changes a form only after its actual ally enters", () => {
    let s = enterSpectrum(spectrumBase());
    const cards = hand(s, "21005", "21023", "21024");
    s = play(s, cards[0], cards.slice(1));
    expect(s.player.inPlay.some((p) => p.id === cards[0].id)).toBe(true);
    s = respond(s, /Blue Marvel/);
    s = choose(s, s.player.inPlay.find((p) => p.code === "21004")!.id);
    s = finish(s);
    expect(spectrumEnergyForm(s)).toBe("pulsar");
  });

  it("interleaves Gamma, Moxie and Ready to Rumble in one saved energy-response window", () => {
    let s = enterSpectrum(spectrumBase(), "photon");
    const rumble = put(s, "21022");
    const [speed, moxie] = hand(s, "21010", "21017");
    s.player.exhausted = true;
    s = choose(
      play(s, speed),
      s.player.inPlay.find((p) => p.code === "21002")!.id,
    );
    expect(s.prompt?.title).toBe("Gamma energy form");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining([
        rumble.id,
        moxie.id,
        s.flags.spectrumEnergyFormId,
      ]),
    );
    s = choose(s, rumble.id);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === rumble.id)).toBe(true);
    s = choose(s, moxie.id);
    expect(heroStats(s).attack).toBe(4);
    s = choose(s, s.player.inPlay.find((p) => p.code === "21002")!.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(49);
    expect(s.player.discard.some((p) => p.id === moxie.id)).toBe(true);
  });

  it("a p2 Spectrum pays and changes only its own physical source cards", () => {
    let s = enterSpectrum(spectrumBase("spider_man", "p2"), "gamma");
    const teammate = seatView(s, "p1");
    const hp = teammate.player.hp;
    const forms = s.player.inPlay.filter(isForm).map((p) => p.id);
    const event = hand(s, "21010")[0];
    s = choose(
      play(s, event),
      forms.find(
        (id) => s.player.inPlay.find((p) => p.id === id)?.code === "21004",
      )!,
    );
    s = finish(s);
    expect(s.activePlayerId).toBe("p2");
    expect(s.turnPlayerId).toBe("p2");
    expect(spectrumEnergyForm(s)).toBe("pulsar");
    expect(seatView(s, "p1").player.hp).toBe(hp);
    expect(seatView(s, "p1").player.inPlay.filter(isForm)).toHaveLength(0);
  });
});

describe("Spectrum defense and actual encounter ownership", () => {
  it("Pulsar Shield changes to Pulsar before recalculating basic defense and readies the actual defender", () => {
    let s = enterSpectrum(spectrumBase());
    const [shield, resource] = hand(s, "21009", "21010");
    s.player.hp = 8;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    s = choose(s, "hero");
    expect(s.prompt?.title).toBe("Spectrum defense interrupts");
    s = choose(s, shield.id);
    s = pay(s, [resource]);
    expect(spectrumEnergyForm(s)).toBe("pulsar");
    expect(s.player.exhausted).toBe(false);
    expect(s.attack?.defense).toBe(3);
    s = choose(s, s.player.inPlay.find((p) => p.code === "21004")!.id);
    s = finish(s);
    expect(s.player.hp).toBeGreaterThanOrEqual(8);
    expect(s.player.discard.some((p) => p.id === shield.id)).toBe(true);
  });

  it("Shield already in Pulsar grants Retaliate for this phase and expires before the next", () => {
    let s = enterSpectrum(spectrumBase(), "pulsar");
    const [shield, resource] = hand(s, "21009", "21010");
    const hp = s.villain.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero")),
      "hero",
    );
    s = finish(pay(choose(s, shield.id), [resource]));
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.flags.spectrumRetaliateAmount).toBe(1);
    s = finish(native(s, { type: "newRound" }));
    expect(s.flags.spectrumRetaliateAmount).toBeUndefined();
  });

  it("cannot play a Defense-response Shield before actually defending", () => {
    const s = enterSpectrum(spectrumBase());
    const shield = hand(s, "21009", "21010")[0];
    expect(playable(s, shield)).toMatch(/defend/i);
  });

  for (const form of ["hero", "alter"] as const) {
    it(`Radioactive Blast resolves its original ${form} clause through the native reveal pipeline`, () => {
      let s = spectrumBase();
      if (form === "hero") s = enterSpectrum(s);
      s.scheme.threat = 1;
      const hp = s.player.hp;
      const exposure = makePiece(s, "21030");
      s = finish(native(s, { type: "reveal", piece: exposure }));
      expect(s.player.hp).toBe(hp - (form === "hero" ? 2 : 0));
      expect(s.scheme.threat).toBe(form === "alter" ? 3 : 1);
      encounterConserved(s, [exposure]);
    });
  }

  it("Loss of Control retains its exact revealed physical ID and prevents event transitions", () => {
    let s = enterSpectrum(spectrumBase());
    const obligation = makePiece(s, "21026");
    s = finish(native(s, { type: "reveal", piece: obligation }));
    expect(s.player.inPlay.some((p) => p.id === obligation.id)).toBe(true);
    const event = hand(s, "21010")[0];
    s = finish(play(s, event));
    expect(spectrumEnergyForm(s)).toBe("gamma");
    expect(s.player.hand).toHaveLength(1);
    s.player.flipped = false;
    s = finish(command(s, { type: "FLIP" }));
    expect(spectrumEnergyForm(s)).toBeUndefined();
    s = finish(
      command(s, { type: "ABILITY", id: obligation.id, action: "remove" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === obligation.id)).toBe(false);
  });

  it("Sap Power deals damage only after its attached player's own turn and pays two actual Energy to discard", () => {
    let s = enterSpectrum(spectrumBase("spider_man"));
    const sap = makePiece(s, "21029");
    s = finish(native(s, { type: "reveal", piece: sap }));
    expect(s.attachments.find((p) => p.id === sap.id)?.attachedTo).toBe(
      "hero:p1",
    );
    const hp = s.player.hp;
    s = finish(command(s, { type: "END_TURN" }));
    expect(seatView(s, "p1").player.hp).toBe(hp - 1);
    expect(s.turnPlayerId).toBe("p2");
    s = finish(native(s, { type: "beginTurn", actorId: "p1" }));
    s.player.flipped = false;
    s = finish(command(s, { type: "FLIP" }));
    const energy = hand(s, "21023")[0];
    s = command(s, { type: "ABILITY", id: sap.id, action: "discard" });
    s = finish(pay(s, [energy]));
    expect(s.attachments.some((p) => p.id === sap.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === sap.id)).toHaveLength(1);
  });

  it("Radioactive Man's completed activation deals one to every character controlled by its target", () => {
    let s = enterSpectrum(spectrumBase("spider_man"));
    const ally = put(s, "21005");
    const radio = minion(s, "21027");
    const hp = s.player.hp;
    const otherHP = seatView(s, "p2").player.hp;
    s.player.tough = true;
    s = finish(native(s, { type: "enemyAttack", id: radio.id }));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(seatView(s, "p2").player.hp).toBe(otherHP);
  });

  it("a stunned Radioactive Man does not complete an activation or trigger its forced damage", () => {
    let s = enterSpectrum(spectrumBase());
    const ally = put(s, "21005");
    const radio = minion(s, "21027");
    radio.stunned = true;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: radio.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    expect(s.minions.find((p) => p.id === radio.id)?.stunned).toBe(false);
  });

  it("Radioactive Man's completed scheme damages his controller's characters in Alter-Ego", () => {
    let s = spectrumBase("spider_man");
    const ally = put(s, "21005");
    const radio = minion(s, "21027");
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyScheme", id: radio.id }));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(seatView(s, "p2").player.hp).toBe(10);
  });

  it("Radioactive Man's activation follows the actual p2 defending player", () => {
    let s = enterSpectrum(spectrumBase("spider_man", "p2"), "pulsar");
    const ownAlly = put(s, "21005");
    const otherAlly = put(s, "01002", "p1");
    const radio = minion(s, "21027", "p1");
    const hp1 = seatView(s, "p1").player.hp,
      hp2 = s.player.hp;
    s = finish(native(s, { type: "beginTurn", actorId: "p1" }));
    s = native(s, { type: "enemyAttack", id: radio.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero:p2")),
      "hero:p2",
    );
    s = finish(s);
    expect(seatView(s, "p1").player.hp).toBe(hp1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ownAlly.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === otherAlly.id)
        ?.damage,
    ).toBe(0);
  });

  it("Radioactive Man's boost uses the current defending player's characters", () => {
    let s = enterSpectrum(spectrumBase("spider_man", "p2"), "pulsar");
    const ownAlly = put(s, "21005");
    const otherAlly = put(s, "01002", "p1");
    const boost = makePiece(s, "21027");
    s.encounter.deck.unshift(boost);
    const hp1 = seatView(s, "p1").player.hp,
      hp2 = s.player.hp;
    s = finish(native(s, { type: "beginTurn", actorId: "p1" }));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero:p2")),
      "hero:p2",
    );
    s = finish(s);
    expect(seatView(s, "p1").player.hp).toBe(hp1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ownAlly.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === otherAlly.id)
        ?.damage,
    ).toBe(0);
    encounterConserved(s, [boost]);
  });

  it("Shadows of the Past enters the exact five Spectrum nemesis cards without touching setup forms", () => {
    let s = enterSpectrum(spectrumBase());
    const ids = s.player.inPlay.filter(isForm).map((p) => p.id);
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.minions.filter((p) => p.code === "21027")).toHaveLength(1);
    expect(s.sideSchemes.filter((p) => p.code === "21028")).toHaveLength(1);
    expect(s.encounter.deck.filter((p) => p.code === "21029")).toHaveLength(2);
    expect(s.encounter.deck.filter((p) => p.code === "21030")).toHaveLength(1);
    expect(s.player.inPlay.filter(isForm).map((p) => p.id)).toEqual(ids);
  });

  it("Reactor Meltdown defeat commits both seats' damage and each physical ally from the original snapshot", () => {
    let s = enterSpectrum(spectrumBase("spider_man"));
    const ownAlly = put(s, "21005"),
      otherAlly = put(s, "01002", "p2");
    const reactor = side(s, "21028", 1);
    const hp1 = s.player.hp,
      hp2 = seatView(s, "p2").player.hp;
    s = finish(
      native(s, {
        type: "thwart",
        target: reactor.id,
        amount: 1,
        source: "hero",
        thwart: true,
      }),
    );
    expect(s.player.hp).toBe(hp1 - 1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 1);
    expect(s.player.inPlay.find((p) => p.id === ownAlly.id)?.damage).toBe(1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === otherAlly.id)
        ?.damage,
    ).toBe(1);
    expect(s.encounter.discard.some((p) => p.id === reactor.id)).toBe(true);
    expect(s.player.inPlay.filter(isForm)).toHaveLength(3);
  });

  it("the saved multiplayer batch offers Drax's physical Parry before any friendly HP changes", () => {
    let s = enterSpectrum(spectrumBase("drax"));
    const sourceHP = s.player.hp;
    const draxHP = seatView(s, "p2").player.hp;
    const ally = put(s, "19002", "p2");
    activateSeat(s, "p2");
    const parry = hand(s, "19006")[0];
    activateSeat(s, "p1");
    const reactor = side(s, "21028", 1);
    s = native(s, {
      type: "thwart",
      target: reactor.id,
      amount: 1,
      source: "hero",
      thwart: true,
    });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === parry.id));
    expect(s.activePlayerId).toBe("p2");
    expect(seatView(s, "p1").player.hp).toBe(sourceHP);
    expect(s.player.hp).toBe(draxHP);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    s = finish(choose(s, parry.id));
    expect(seatView(s, "p1").player.hp).toBe(sourceHP - 1);
    expect(seatView(s, "p2").player.hp).toBe(draxHP);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === parry.id),
    ).toBe(true);
  });

  it("commits simultaneous damage before Drax's HP1 defeat replacement and an ally's defeat", () => {
    let s = enterSpectrum(spectrumBase("drax"));
    const drax = seatView(s, "p2");
    drax.player.hp = 1;
    drax.flags.draxVengeanceCounters = 2;
    const stubborn = put(s, "19011", "p2");
    const ally = put(s, "19002", "p2");
    ally.damage = 2;
    const reactor = side(s, "21028", 1);
    s = native(s, {
      type: "thwart",
      target: reactor.id,
      amount: 1,
      source: "hero",
      thwart: true,
    });
    s = until(s, (v) => v.prompt?.title === "Too Stubborn to Die");
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(0);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(seatView(s, "p2").player.discard.some((p) => p.id === ally.id)).toBe(
      true,
    );
    s = finish(choose(s, stubborn.id));
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBe(false);
    expect(s.removed.filter((p) => p.id === stubborn.id)).toHaveLength(1);
  });
});
