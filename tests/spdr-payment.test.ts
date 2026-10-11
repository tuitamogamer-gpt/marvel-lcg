import { describe, expect, it } from "vitest";
import { card, deckCodes } from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import { attachmentsFor } from "../src/game/presentation.js";
import { dispatch, newGame, paymentSources } from "../src/game/engine.js";
import { spdrChangedForm, spdrSuit } from "../src/game/spdr.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Command, GameState, Piece } from "../src/game/types.js";

const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(s: GameState, c: Command) {
  let next = dispatch(reload(s), c);
  expect(next.error, JSON.stringify(next.prompt)).toBeUndefined();
  for (let n = 0; next.review && n < 80; n++)
    next = dispatch(reload(next), { type: "PROCEED" });
  expect(next.error, JSON.stringify(next.prompt)).toBeUndefined();
  return next;
}
function pieces(s: GameState): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
  ];
}
function relocate(
  s: GameState,
  seat: string,
  code: string,
  to: "hand" | "inPlay",
) {
  const p = seatView(s, seat).player;
  for (const zone of [p.hand, p.deck, p.discard, p.inPlay]) {
    const i = zone.findIndex((c) => c.code === code);
    if (i < 0) continue;
    const actual = zone.splice(i, 1)[0];
    p[to].push(actual);
    return actual;
  }
  throw Error(`Actual source printing ${seat}:${code} is missing.`);
}
function fixture(twoClarities?: "same" | "distinct") {
  const avenger = deckCodes("captain_marvel", "leadership");
  avenger[avenger.indexOf("01083")] = "22020";
  avenger[avenger.indexOf("01084")] = "25036";
  if (twoClarities === "distinct") avenger[avenger.indexOf("01073")] = "31029";
  const pilot = deckCodes("spdr", "leadership");
  pilot[pilot.indexOf("01073")] = "31029";
  if (twoClarities === "same") pilot[pilot.indexOf("01074")] = "31029";
  expect(avenger).toHaveLength(40);
  expect(pilot).toHaveLength(40);
  expect(deckErrors("captain_marvel", "leadership", avenger)).toEqual([]);
  expect(deckErrors("spdr", "leadership", pilot)).toEqual([]);
  let s = newGame({
    heroId: "captain_marvel",
    aspect: "leadership",
    villainId: "rhino",
    seed: 31029,
    pacing: "expert",
    heroes: [
      { heroId: "captain_marvel", aspect: "leadership", deckCards: avenger },
      { heroId: "spdr", aspect: "leadership", deckCards: pilot },
    ],
  });
  expect(s.error).toBeUndefined();
  s = command(s, { type: "MULLIGAN", ids: [] });
  s = command(s, { type: "MULLIGAN", ids: [] });
  expect(s.phase).toBe("player");
  expect(s.prompt).toBeNull();
  activateSeat(s, "p2");
  const from = s.player.form;
  s.player.form = "hero";
  spdrChangedForm(s, from, "hero");
  activateSeat(s, "p1");
  s.player.form = "hero";
  s.player.exhausted = true;
  const cosmo = relocate(s, "p1", "22020", "inPlay");
  cosmo.exhausted = true;
  const clarity = relocate(s, "p2", "31029", "inPlay");
  clarity.attachedTo = "hero:p2";
  const extraClarity = twoClarities
    ? relocate(s, twoClarities === "same" ? "p2" : "p1", "31029", "inPlay")
    : undefined;
  if (extraClarity) extraClarity.attachedTo = "hero:p1";
  const event = relocate(s, "p1", "25036", "hand"),
    energy = relocate(s, "p1", "01088", "hand");
  const owned = Object.fromEntries(
    s.players.map((seat) => [
      seat.id,
      pieces(s)
        .filter(
          (p) =>
            p.ownerId === seat.id && card(p.code).faction_code !== "encounter",
        )
        .map((p) => p.id),
    ]),
  );
  expect(owned.p1).toHaveLength(40);
  expect(owned.p2).toHaveLength(42);
  const exact = (state: GameState) => {
    for (const [owner, ids] of Object.entries(owned))
      for (const id of ids) {
        const matches = pieces(state).filter((p) => p.id === id);
        expect(matches, `${owner}:${id}`).toHaveLength(1);
        expect(matches[0].ownerId).toBe(owner);
      }
  };
  s = command(s, { type: "PLAY", id: event.id });
  expect(s.prompt?.kind).toBe("payment");
  expect(s.prompt?.alliance).toBe(true);
  const teammate = paymentSources(s, event.id, event.code, false, true).find(
    (p) => p.localId === clarity.id && p.playerId === "p2",
  )!;
  expect(teammate.id).toBe(`alliance:p2:${clarity.id}`);
  exact(s);
  return { s, cosmo, clarity, extraClarity, event, energy, teammate, exact };
}

describe("SP//dr Clarity of Purpose native multiplayer payment ownership", () => {
  it("shows physical Pilot and actual Clarity once through either active Suit host alias, then isolates the inactive Suit after a native paired flip", () => {
    const f = fixture("distinct");
    const spdr = seatView(f.s, "p2").player;
    const suitId = spdr.spdrSuitId!,
      pilotId = spdr.spdrPilotId!;
    const expected = [pilotId, f.clarity.id].sort();
    for (const host of [suitId, "hero:p2"])
      expect(
        attachmentsFor(reload(f.s), host)
          .map((p) => p.id)
          .sort(),
      ).toEqual(expected);
    expect(attachmentsFor(f.s, "hero:p1").map((p) => p.id)).toEqual([
      f.extraClarity!.id,
    ]);
    expect(attachmentsFor(f.s, pilotId)).toEqual([]);
    let s = command(f.s, { type: "CANCEL" });
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.activePlayerId).toBe("p2");
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    expect(s.player.spdrIdentity!.id).toBe(pilotId);
    for (const host of [pilotId, "hero:p2", "hero"])
      expect(attachmentsFor(reload(s), host).map((p) => p.id)).toEqual([
        f.clarity.id,
      ]);
    expect(attachmentsFor(s, suitId)).toEqual([]);
    expect(attachmentsFor(s, "hero:p1").map((p) => p.id)).toEqual([
      f.extraClarity!.id,
    ]);
    f.exact(reload(s));
  });

  it("applies Nova's Wild doubling once to the already generated Clarity snapshot and to the completed native Lightspeed payment", () => {
    const codes = deckCodes("nova", "leadership");
    codes[codes.indexOf("01073")] = "31029";
    expect(codes).toHaveLength(40);
    expect(deckErrors("nova", "leadership", codes)).toEqual([]);
    let s = newGame({
      heroId: "nova",
      aspect: "leadership",
      heroes: [{ heroId: "nova", aspect: "leadership", deckCards: codes }],
      villainId: "rhino",
      seed: 31029,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    expect(s.prompt).toBeNull();
    s.player.form = "hero";
    s.scheme.threat = 10;
    const clarity = relocate(s, "p1", "31029", "inPlay"),
      event = relocate(s, "p1", "28004", "hand");
    clarity.attachedTo = "hero:p1";
    const ids = pieces(s)
      .filter((p) => p.ownerId === "p1" && card(p).faction_code !== "encounter")
      .map((p) => p.id);
    expect(ids).toHaveLength(40);
    const hp = s.player.hp;
    s = command(s, { type: "PLAY", id: event.id });
    const source = paymentSources(s, event.id, event.code).find(
      (p) => p.id === clarity.id,
    )!;
    expect(source.resources).toEqual(["wild", "wild"]);
    const pending = reload(s);
    pending.player.inPlay.find((p) => p.id === clarity.id)!.exhausted = true;
    pending.prompt!.committedResources = [{ ...source, playerId: "p1" }];
    const committed = paymentSources(
      reload(pending),
      event.id,
      event.code,
    ).filter((p) => p.id === clarity.id);
    expect(committed).toHaveLength(1);
    expect(committed[0].resources).toEqual(["wild", "wild"]);
    s = command(s, { type: "PAY", ids: [clarity.id], wildAs: "wild" });
    if (s.prompt?.options.some((o) => o.id === "main"))
      s = command(s, { type: "CHOOSE", id: "main" });
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(hp - 1);
    expect(s.scheme.threat).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === clarity.id)?.exhausted).toBe(
      true,
    );
    const payments = s.log.filter((e) =>
      /^Paid .* for Lightspeed Flight/.test(e.text),
    );
    expect(payments).toHaveLength(1);
    expect(payments[0].text).toMatch(/^Paid 2 resources /);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    for (const id of ids)
      expect(
        pieces(reload(s)).filter((p) => p.id === id),
        id,
      ).toHaveLength(1);
  });

  it("retains exactly one already generated teammate resource after JSON instead of cloning it into other Alliance seats", () => {
    const f = fixture();
    const clarity = seatView(f.s, "p2").player.inPlay.find(
      (p) => p.id === f.clarity.id,
    )!;
    clarity.exhausted = true;
    f.s.prompt!.committedResources = [f.teammate];
    const saved = reload(f.s);
    const sources = paymentSources(
      saved,
      f.event.id,
      f.event.code,
      false,
      true,
    ).filter((p) => p.code === "31029");
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      id: f.teammate.id,
      localId: clarity.id,
      playerId: "p2",
      resources: ["wild"],
    });
    f.exact(saved);
  });

  it("pays Cosmic Alliance with the actual teammate Clarity, deals its cost to that teammate and completes the physical event", () => {
    const f = fixture(),
      hp = seatView(f.s, "p2").player.hp,
      payerHP = f.s.player.hp;
    let s = command(f.s, {
      type: "PAY",
      ids: [f.energy.id, f.teammate.id],
      wildAs: "energy",
    });
    expect(s.prompt?.title, JSON.stringify(s.prompt)).toBe("Cosmic Alliance");
    const pair = `hero:p1|${f.cosmo.id}`;
    expect(s.prompt?.options.some((o) => o.id === pair)).toBe(true);
    s = command(s, { type: "CHOOSE", id: pair });
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(payerHP);
    expect(seatView(s, "p2").player.hp).toBe(hp - 1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === f.clarity.id),
    ).toMatchObject({
      code: "31029",
      exhausted: true,
      ownerId: "p2",
      attachedTo: "hero:p2",
    });
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === f.cosmo.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.discard.filter((p) => p.id === f.event.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === f.energy.id)).toHaveLength(
      1,
    );
    expect(
      Object.keys(seatView(s, "p2").flags).some((key) =>
        key.startsWith("spdrClarityCommitted:"),
      ),
    ).toBe(false);
    expect(spdrSuit(seatView(s, "p2"))!.ownerId).toBe("p2");
    f.exact(reload(s));
  });

  it.each(["same", "distinct"] as const)(
    "commits two real Clarities controlled by %s contributors, completing each separate damage cost once",
    (contributors) => {
      const f = fixture(contributors),
        hp = seatView(f.s, "p2").player.hp,
        payerHP = f.s.player.hp;
      const second = paymentSources(
        f.s,
        f.event.id,
        f.event.code,
        false,
        true,
      ).find((p) => (p.localId || p.id) === f.extraClarity!.id)!;
      expect(second).toBeTruthy();
      expect(second.playerId).toBe(contributors === "same" ? "p2" : undefined);
      let s = command(f.s, {
        type: "PAY",
        ids: [f.energy.id, f.teammate.id, second.id],
        wildAs: "energy",
      });
      expect(s.prompt?.title, JSON.stringify(s.prompt)).toBe("Cosmic Alliance");
      s = command(s, { type: "CHOOSE", id: `hero:p1|${f.cosmo.id}` });
      expect(s.prompt).toBeNull();
      expect(s.player.hp).toBe(payerHP - 1);
      expect(seatView(s, "p2").player.hp).toBe(hp - 1);
      for (const p of [f.clarity, f.extraClarity!]) {
        const actual = pieces(s).filter((q) => q.id === p.id);
        expect(actual).toHaveLength(1);
        expect(actual[0]).toMatchObject({
          code: "31029",
          exhausted: true,
          ownerId: p.ownerId,
          attachedTo: p.attachedTo,
        });
      }
      expect(s.player.discard.filter((p) => p.id === f.event.id)).toHaveLength(
        1,
      );
      expect(s.player.discard.filter((p) => p.id === f.energy.id)).toHaveLength(
        1,
      );
      for (const seat of s.players)
        expect(
          Object.keys(seatView(s, seat).flags).some((key) =>
            key.startsWith("spdrClarityCommitted:"),
          ),
        ).toBe(false);
      f.exact(reload(s));
    },
  );
});
