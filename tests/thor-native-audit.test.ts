import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { seatView } from "../src/game/team";
import type { Command, GameState, Piece } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let state = dispatch(input, cmd);
  expect(state.error, JSON.stringify(state.prompt)).toBeUndefined();
  let guard = 0;
  while (state.review && guard++ < 60)
    state = dispatch(state, { type: "PROCEED" });
  expect(state.error).toBeUndefined();
  return state;
}

function base(heroId = "thor", villainId = "rhino") {
  let state = newGame({
    heroId,
    villainId,
    aspect: "aggression",
    seed: 87,
    pacing: "expert",
  });
  state = command(state, { type: "MULLIGAN", ids: [] });
  state.player.form = "hero";
  state.player.hand = [];
  state.player.inPlay = [];
  state.player.discard = [];
  state.minions = [];
  state.sideSchemes = [];
  state.attachments = [];
  state.queue = [];
  state.prompt = null;
  state.review = null;
  return state;
}

function inPlay(state: GameState, code: string) {
  const piece = makePiece(state, code);
  state.player.inPlay.push(piece);
  return piece;
}

function hand(state: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => makePiece(state, code));
  state.player.hand = pieces;
  return pieces;
}

function choose(state: GameState, id: string) {
  expect(state.prompt?.kind).toBe("choice");
  return command(state, { type: "CHOOSE", id });
}

function reveal(state: GameState, code: string) {
  state.queue = [{ type: "reveal", piece: makePiece(state, code), skip: true }];
  state.prompt = {
    kind: "choice",
    title: "Encounter reveal fixture",
    text: "",
    options: [{ id: "go", label: "Reveal", effects: [] }],
  };
  return choose(state, "go");
}

describe("Thor native lifecycle audit", () => {
  it.each([
    ["Mean Swing", "06015", "06009"],
    ["Teamwork", "06032", "06011"],
  ])(
    "%s consumes Helicarrier's next-card discount even though its printed cost is zero",
    (_name, eventCode, costCode) => {
      let state = base();
      const helicarrier = inPlay(state, "01092");
      const costSource = inPlay(state, costCode);
      const [event, physique] = hand(state, eventCode, "06034", "06024");
      state = command(state, {
        type: "ABILITY",
        id: helicarrier.id,
        action: "special",
      });
      expect(state.flags.discount).toBe(1);
      state = command(state, { type: "BASIC", action: "attack" });
      state = choose(state, event.id);
      state = choose(state, costSource.id);
      expect(state.player.discard.some((p) => p.id === event.id)).toBe(true);
      state = command(state, { type: "PLAY", id: physique.id });
      expect(state.prompt?.kind).toBe("payment");
      expect(state.prompt?.cost).toBe(2);
    },
  );

  it.each([
    ["Mean Swing", "06015", "06019"],
    ["Teamwork", "06032", "06011"],
  ])(
    "%s consumes Nakia's next-card discount after Ms. Marvel changes to hero form",
    (_name, eventCode, costCode) => {
      let state = base("ms_marvel");
      state.player.form = "alter";
      const nakia = inPlay(state, "05008");
      const costSource = inPlay(state, costCode);
      const [event, physique] = hand(state, eventCode, "06034", "06024");
      state = command(state, {
        type: "ABILITY",
        id: nakia.id,
        action: "nakia",
      });
      expect(state.flags.msNakiaDiscount).toBe(1);
      state = command(state, { type: "FLIP" });
      state = command(state, { type: "BASIC", action: "attack" });
      state = choose(state, event.id);
      state = choose(state, costSource.id);
      if (state.prompt?.title === "After your hero attacks")
        state = choose(state, "continue");
      state = command(state, { type: "PLAY", id: physique.id });
      expect(state.prompt?.kind).toBe("payment");
      expect(state.prompt?.cost).toBe(2);
    },
  );

  it("all Retaliate from one simultaneous Shield Toss resolves before any optional Jarnbjorn response", () => {
    let state = base("captain_america");
    inPlay(state, "03009");
    inPlay(state, "06019");
    const enemies: Piece[] = [
      makePiece(state, "01184"),
      makePiece(state, "01184"),
    ];
    for (const enemy of enemies) enemy.engagedWith = state.activePlayerId;
    state.minions = enemies;
    state.player.hp = 4;
    const [toss, firstDiscard, secondDiscard] = hand(
      state,
      "03006",
      "03003",
      "03003",
      "06024",
    );
    state = command(state, { type: "PLAY", id: toss.id });
    state = command(state, {
      type: "SELECT",
      ids: [firstDiscard.id, secondDiscard.id],
    });
    state = command(state, {
      type: "SELECT",
      ids: enemies.map((enemy) => enemy.id),
    });
    expect(state.minions.map((enemy) => enemy.damage)).toEqual([4, 4]);
    expect(state.prompt?.title).toBe("Forced responses");
    state = choose(state, state.prompt!.options[0].id);
    expect(state.phase).toBe("lost");
    expect(state.prompt).toBeNull();
  });

  it("saving at Helmet's defeat replacement preserves the second mandatory Retaliate ahead of Jarnbjorn", () => {
    let state = base("captain_america", "klaw");
    inPlay(state, "03009");
    inPlay(state, "03008");
    inPlay(state, "06019");
    const blasters = makePiece(state, "01119");
    blasters.attachedTo = state.villain.id;
    state.attachments.push(blasters);
    const modok = makePiece(state, "01184");
    modok.engagedWith = state.activePlayerId;
    state.minions = [modok];
    state.player.hp = 1;
    const [toss, firstDiscard, secondDiscard] = hand(
      state,
      "03006",
      "03003",
      "03003",
      "06024",
    );
    state = command(state, { type: "PLAY", id: toss.id });
    state = command(state, {
      type: "SELECT",
      ids: [firstDiscard.id, secondDiscard.id],
    });
    state = command(state, {
      type: "SELECT",
      ids: [modok.id, state.villain.id],
    });
    expect(state.prompt?.title).toBe("Forced responses");
    const modokResponse = state.prompt!.options.find((option) =>
      option.label.includes("M.O.D.O.K."),
    );
    expect(modokResponse).toBeTruthy();
    state = choose(state, modokResponse!.id);
    expect(state.prompt?.title).toBe("Captain America’s Helmet");
    expect(state.player.hp).toBe(0);
    state = JSON.parse(JSON.stringify(state)) as GameState;
    state = choose(state, "helmet");
    expect(state.phase).toBe("lost");
    expect(state.prompt).toBeNull();
    expect(state.player.discard.some((piece) => piece.code === "03008")).toBe(
      true,
    );
  });

  it.each([false, true])(
    "the first player chooses Retaliate2 before Retaliate1 so Tough preserves the attacker (multiplayer=%s)",
    (team) => {
      let state = base("captain_america", "klaw");
      if (team) {
        state = newGame({
          heroId: "thor",
          villainId: "klaw",
          aspect: "aggression",
          seed: 87,
          pacing: "expert",
          heroes: [
            { heroId: "thor", aspect: "aggression" },
            { heroId: "captain_america", aspect: "aggression" },
          ],
        });
        state = command(state, { type: "MULLIGAN", ids: [] });
        state = command(state, { type: "MULLIGAN", ids: [] });
        state = command(state, { type: "END_TURN" });
        expect(state.turnPlayerId).toBe("p2");
        state.player.form = "hero";
        state.player.hand = [];
        state.player.inPlay = [];
        state.player.discard = [];
        state.minions = [];
        state.sideSchemes = [];
        state.attachments = [];
        state.queue = [];
        state.prompt = null;
        state.review = null;
      }
      const attackerId = state.activePlayerId;
      inPlay(state, "03009");
      inPlay(state, "06019");
      const body = makePiece(state, "01119");
      body.attachedTo = state.villain.id;
      state.attachments.push(body);
      const modok = makePiece(state, "01184");
      modok.engagedWith = attackerId;
      state.minions = [modok];
      state.player.hp = 2;
      state.player.tough = true;
      state.player.toughCards = 1;
      const [toss, firstDiscard, secondDiscard] = hand(
        state,
        "03006",
        "03003",
        "03003",
        "06024",
      );
      state = command(state, { type: "PLAY", id: toss.id });
      state = command(state, {
        type: "SELECT",
        ids: [firstDiscard.id, secondDiscard.id],
      });
      state = command(state, {
        type: "SELECT",
        ids: [state.villain.id, modok.id],
      });
      expect(state.prompt?.title).toBe("Forced responses");
      expect(state.activePlayerId).toBe(state.firstPlayerId);
      expect(seatView(state, attackerId).player.hp).toBe(2);
      expect(seatView(state, attackerId).player.tough).toBe(true);
      const modokResponse = state.prompt?.options.find((option) =>
        option.label.includes("M.O.D.O.K."),
      );
      expect(modokResponse).toBeTruthy();
      state = JSON.parse(JSON.stringify(state)) as GameState;
      state = choose(state, modokResponse!.id);
      expect(seatView(state, attackerId).player.hp).toBe(1);
      expect(seatView(state, attackerId).player.tough).toBe(false);
      expect(
        state.players.find((seat) => seat.id === attackerId)?.eliminated,
      ).not.toBe(true);
      expect(state.phase).toBe("player");
      expect(state.prompt?.title).toBe("After your hero attacks");
      expect(state.activePlayerId).toBe(attackerId);
    },
  );

  it("Battle Fury is offered after a defeated minion's forced interrupt finishes", () => {
    let state = base();
    inPlay(state, "06009");
    const fury = inPlay(state, "06018");
    const soldier = makePiece(state, "02023");
    soldier.engagedWith = state.activePlayerId;
    soldier.damage = 2;
    state.minions = [soldier];
    const hp = state.player.hp;
    state = command(state, { type: "BASIC", action: "attack" });
    state = choose(state, soldier.id);
    expect(state.minions).toEqual([]);
    expect(state.player.hp).toBe(hp - 1);
    expect(state.prompt?.title).toBe("After your hero attacks");
    state = choose(state, fury.id);
    expect(state.player.hp).toBe(hp - 2);
    expect(state.player.exhausted).toBe(false);
    expect(state.player.discard.some((piece) => piece.id === fury.id)).toBe(
      true,
    );
  });

  it("Precision Strike completes its conditional healing before offering Battle Fury for that attack", () => {
    let state = base();
    const fury = inPlay(state, "06018");
    const soldier = makePiece(state, "02023");
    soldier.engagedWith = state.activePlayerId;
    soldier.damage = 3;
    state.minions = [soldier];
    state.player.hp = 2;
    state.player.exhausted = true;
    const [strike, resource] = hand(state, "35018", "06024");
    state = command(state, { type: "PLAY", id: strike.id });
    state = command(state, { type: "PAY", ids: [resource.id] });
    state = choose(state, soldier.id);
    expect(state.minions).toEqual([]);
    expect(state.prompt?.title).toBe("After your hero attacks");
    expect(state.player.hp).toBe(3);
    state = choose(state, fury.id);
    expect(state.player.hp).toBe(2);
    expect(state.player.exhausted).toBe(false);
    expect(state.phase).toBe("player");
  });

  it("Drop Kick's bonus draw makes its new physical resource available for Jarnbjorn's response", () => {
    let state = base("hulk");
    const axe = inPlay(state, "06019");
    const modok = makePiece(state, "01184");
    modok.engagedWith = state.activePlayerId;
    state.minions = [modok];
    const drawn = makePiece(state, "10007");
    state.player.deck.unshift(drawn);
    const [kick, resource] = hand(state, "10014", "10007");
    state = command(state, { type: "PLAY", id: kick.id });
    state = command(state, { type: "PAY", ids: [resource.id] });
    state = choose(state, modok.id);
    expect(state.player.hand.some((piece) => piece.id === drawn.id)).toBe(true);
    expect(state.minions.find((piece) => piece.id === modok.id)?.stunned).toBe(
      true,
    );
    expect(state.prompt?.title).toBe("After your hero attacks");
    expect(state.prompt?.options.some((option) => option.id === axe.id)).toBe(
      true,
    );
  });

  it("Hall of Heroes attributes Thunderclap's non-attack event defeat to the identity", () => {
    let state = base("hulk");
    const hall = inPlay(state, "06017");
    const soldier = makePiece(state, "01101");
    soldier.engagedWith = state.activePlayerId;
    state.minions = [soldier];
    const [thunderclap, resource] = hand(state, "10005", "10007");
    state = command(state, { type: "PLAY", id: thunderclap.id });
    state = command(state, { type: "PAY", ids: [resource.id] });
    state = command(state, { type: "SELECT", ids: [soldier.id] });
    expect(state.minions).toEqual([]);
    expect(state.prompt?.title).toBe("Hall of Heroes");
    state = choose(state, "yes");
    expect(
      state.player.inPlay.find((piece) => piece.id === hall.id)?.counters,
    ).toBe(1);
  });

  it("Odin's Anger omits a locked hero-form change and still resolves its Mjolnir branch", () => {
    let state = base();
    const hammer = inPlay(state, "06009");
    const lock = makePiece(state, "02048");
    lock.attachedTo = "hero:" + state.activePlayerId;
    state.attachments.push(lock);
    state = reveal(state, "06026");
    expect(state.prompt?.options.map((option) => option.id)).toEqual([
      "discard",
    ]);
    state = choose(state, "discard");
    expect(state.player.form).toBe("hero");
    expect(state.player.stunned).toBe(true);
    expect(state.player.discard.some((piece) => piece.id === hammer.id)).toBe(
      true,
    );
    expect(
      state.encounter.discard.some((piece) => piece.code === "06026"),
    ).toBe(true);
  });

  it("Odin's Anger retains a legal exhaust/remove choice when locked already in alter-ego form", () => {
    let state = base();
    state.player.form = "alter";
    const lock = makePiece(state, "02048");
    lock.attachedTo = "hero:" + state.activePlayerId;
    state.attachments.push(lock);
    state = reveal(state, "06026");
    expect(state.prompt?.options.map((option) => option.id)).toEqual([
      "exhaust",
    ]);
    state = choose(state, "exhaust");
    expect(state.player.form).toBe("alter");
    expect(state.player.exhausted).toBe(true);
    expect(state.removed.some((piece) => piece.code === "06026")).toBe(true);
  });
});
