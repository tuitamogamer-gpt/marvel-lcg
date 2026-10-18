import { describe, expect, it } from "vitest";
import {
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import { heroStats } from "../src/game/cards.js";
import {
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  pay,
  play,
  put,
  side,
  target,
} from "./dv-test-helpers.js";

function position(heroId = "deadpool", team = false) {
  let s = newGame({
    heroId,
    aspect: "pool",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 44059,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "deadpool", aspect: "pool" as const },
            { heroId: "spider_man", aspect: "pool" as const },
          ],
        }
      : {}),
  });
  while (s.phase === "mulligan") s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.deck.push(...view.player.hand.splice(0));
  }
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 3;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}

describe("independent Deadpool shared-engine rules regressions", () => {
  it("Merc blocks another player's hand interrupt during Deadpool's turn", () => {
    let s = position("deadpool", true);
    put(s, "44032", "p1");
    activateSeat(s, "p2");
    hand(s, "01004", "01088");
    s.turnPlayerId = "p1";
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01105"),
      fromEncounterDeck: true,
    });
    expect(s.prompt?.options.some((o) => o.image === "01004")).not.toBe(true);
    s = finish(s);
    expect(s.villain.tough).toBe(true);
  });

  it("Merc does not block that same native hand interrupt during the villain phase", () => {
    let s = position("deadpool", true);
    put(s, "44032", "p1");
    activateSeat(s, "p2");
    const [event, resource] = hand(s, "01004", "01088");
    s.phase = "villain";
    s.turnPlayerId = "p1";
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01105"),
      fromEncounterDeck: true,
    });
    const response = s.prompt?.options.find((o) => o.image === event.code);
    expect(response, JSON.stringify(s.prompt)).toBeDefined();
    s = choose(s, response!.id);
    s = finish(pay(s, [resource]));
    expect(s.villain.tough).toBe(false);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
  });

  it("Merc also prevents another identity's mandatory card response during Deadpool's turn", () => {
    let s = position("deadpool", true);
    put(s, "44032", "p1");
    activateSeat(s, "p2");
    s.turnPlayerId = "p1";
    const before = s.player.hand.length;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(s.player.hand.length).toBe(before);
    s = finish(s);
    expect(seatView(s, "p2").player.hand.length).toBe(before);
  });

  it("Merc still permits another player to make a basic defense during Deadpool's turn", () => {
    let s = position("deadpool", true);
    put(s, "44032", "p1");
    const ally = put(s, "01002", "p2");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(s.prompt?.options.some((o) => o.id === "hero:p2")).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === ally.id)).toBe(true);
    s = finish(choose(s, "hero:p2"));
    expect(seatView(s, "p2").player.exhausted).toBe(true);
  });

  it("Merc prevents allies from readying during the ordinary end-phase refill", () => {
    let s = position();
    const ally = put(s, "44002");
    ally.exhausted = true;
    const truck = put(s, "44008");
    truck.exhausted = true;
    put(s, "44032");
    s.player.exhausted = true;
    s = finish(native(s, { type: "refill" }));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === truck.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.exhausted).toBe(false);
  });

  it("Laser Swords occupy two Restricted slots and force a real existing Weapon discard", () => {
    let s = position();
    const katana = put(s, "44010");
    const [swords, payment] = hand(s, "44055", "44025");
    s = play(s, swords, [payment]);
    expect(s.prompt?.title).toBe("Restricted limit");
    s = finish(choose(s, katana.id));
    expect(s.player.inPlay.some((p) => p.id === swords.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === katana.id)).toBe(true);
  });

  it("Tabula Rasa also blanks Spider-Man's printed mandatory identity response", () => {
    let s = position("spider_man");
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "44035") }));
    expect(s.attachments.filter((p) => p.code === "44035")).toHaveLength(1);
    const before = s.player.hand.length;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(s.player.hand.length).toBe(before);
    s = finish(s);
    expect(s.player.hand.length).toBe(before);
  });

  it("Tabula Rasa suppresses Drax's printed ATK bonus without removing his physical counters", () => {
    let s = position("drax");
    s.flags.draxVengeanceCounters = 3;
    expect(heroStats(s).attack).toBe(4);
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "44035") }));
    expect(s.attachments.filter((p) => p.code === "44035")).toHaveLength(1);
    expect(heroStats(s).attack).toBe(1);
    expect(s.flags.draxVengeanceCounters).toBe(3);
    const tabula = s.attachments.find((p) => p.code === "44035")!;
    s = finish(native(s, { type: "discardPiece", id: tabula.id }));
    expect(s.attachments.some((p) => p.id === tabula.id)).toBe(false);
    expect(s.player.form).toBe("hero");
    expect(s.flags.draxVengeanceCounters).toBe(3);
    expect(heroStats(s).attack).toBe(4);
  });

  it("Tabula Rasa's public alter-ego action pays two mental resources and discards its actual attachment", () => {
    let s = position();
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "44035") }));
    const tabula = s.attachments.find((p) => p.code === "44035")!;
    s = finish(command(s, { type: "FLIP" }));
    const [resource] = hand(s, "01089");
    s = command(s, { type: "ABILITY", id: tabula.id, action: "tabula" });
    s = finish(pay(s, [resource]));
    expect(s.attachments.some((p) => p.id === tabula.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === tabula.id)).toHaveLength(
      1,
    );
  });

  it("an exhausted Bazooka can still pay its discard cost and resolve an attack", () => {
    let s = position();
    const bazooka = put(s, "44052");
    bazooka.exhausted = true;
    side(s, "01107", 3);
    expect(
      nativeHeroAbilityOptions(s, bazooka.id).some((o) => o.id === "bazooka"),
    ).toBe(true);
    s = command(s, { type: "ABILITY", id: bazooka.id, action: "bazooka" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(79);
    expect(s.player.discard.some((p) => p.id === bazooka.id)).toBe(true);
  });

  it("Armed to the Teeth swaps the actual stored Weapon in ready with its initial Uses", () => {
    let s = position();
    const storage = put(s, "44009");
    const outgoing = put(s, "44010");
    outgoing.exhausted = true;
    outgoing.counters = 3;
    const incoming = makePiece(s, "20015");
    incoming.ownerId = s.activePlayerId;
    storage.storedCards = [incoming];
    s = command(s, { type: "ABILITY", id: storage.id, action: "swap" });
    s = finish(choose(s, outgoing.id));
    const actual = s.player.inPlay.find((p) => p.id === incoming.id);
    expect(actual).toMatchObject({ exhausted: false, counters: 2 });
    expect(s.player.inPlay.some((p) => p.id === outgoing.id)).toBe(false);
    expect(
      s.player.inPlay.find((p) => p.id === storage.id)?.storedCards,
    ).toEqual([expect.objectContaining({ id: outgoing.id, counters: 0 })]);
  });

  it("Blackout moving a side scheme's last threat resolves its normal defeat", () => {
    let s = position();
    const board = put(s, "44053");
    const scheme = side(s, "01107", 1);
    const [resource] = hand(s, "01088");
    s = command(s, { type: "ABILITY", id: board.id, action: "metagame" });
    s = choose(s, "0");
    s = pay(s, [resource]);
    s = finish(target(s, scheme.id));
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === board.id)?.counters).toBe(1);
  });

  it("Blackout cannot move main-scheme threat through a Crisis icon", () => {
    let s = position();
    const board = put(s, "44053");
    side(s, "01108", 2);
    const [resource] = hand(s, "01088");
    s = command(s, { type: "ABILITY", id: board.id, action: "metagame" });
    s = choose(s, "0");
    s = pay(s, [resource]);
    expect(s.prompt?.options.some((o) => o.id === "main")).not.toBe(true);
    expect(s.scheme.threat).toBe(3);
  });

  it("Tic-Tac-Toe deals all five accumulated damage when its third top-row space completes a line", () => {
    let s = position();
    const board = put(s, "44057");
    board.deadpoolSpaces = [0, 1, 3, 5];
    board.counters = 4;
    s.villain.hp = 79;
    const [resource] = hand(s, "01088");
    s = command(s, { type: "ABILITY", id: board.id, action: "metagame" });
    s = choose(s, "2");
    s = pay(s, [resource]);
    s = target(s, s.villain.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(75);
    expect(s.player.discard.some((p) => p.id === board.id)).toBe(true);
  });

  it("Rock Paper Scissors retrieves the actual winning last card after immediate deck reset", () => {
    let s = position();
    const board = put(s, "44056");
    const [chosen, last] = hand(s, "01088", "01089");
    s.player.hand = s.player.hand.filter((p) => p.id !== last.id);
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(last);
    const dealtBefore = s.encounter.dealt.length;
    s = command(s, { type: "ABILITY", id: board.id, action: "rps" });
    s = finish(choose(s, chosen.id));
    expect(s.encounter.dealt).toHaveLength(dealtBefore + 1);
    expect(s.player.hand.some((p) => p.id === last.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === last.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === last.id)).toBe(false);
  });

  it("Get in Front of Me draws for its event player when another hero defends the replacement attack", () => {
    let s = position("deadpool", true);
    const [event, resource] = hand(s, "44047", "01088");
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01105"),
      fromEncounterDeck: true,
    });
    const response = s.prompt?.options.find((o) => o.image === event.code);
    expect(response, JSON.stringify(s.prompt)).toBeDefined();
    s = choose(s, response!.id);
    s = pay(s, [resource]);
    s = finish(choose(s, "hero:p2"));
    expect(seatView(s, "p1").player.hand).toHaveLength(1);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.villain.tough).toBe(false);
    expect(
      Object.keys(seatView(s, "p1").flags).some((k) =>
        k.startsWith("deadpoolFront:"),
      ),
    ).toBe(false);
  });

  it("Anti-Regeneration Ray on a hero blanks a minion's Retaliate throughout a basic attack", () => {
    let s = position();
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "44040") }));
    expect(s.attachments.filter((p) => p.code === "44040")).toHaveLength(1);
    const ray = s.attachments.find((p) => p.code === "44040")!;
    expect(ray.attachedTo).toBe(s.villain.id);
    const resources = hand(s, "01088", "01089", "01090");
    s = command(s, { type: "ABILITY", id: ray.id, action: "ray" });
    s = finish(pay(s, resources));
    expect(s.attachments.filter((p) => p.id === ray.id)).toHaveLength(1);
    expect(s.attachments.find((p) => p.id === ray.id)?.attachedTo).toBe(
      "hero:p1",
    );
    const enemy = minion(s, "01172");
    const hp = s.player.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
    expect(s.player.hp).toBe(hp);
  });
});
