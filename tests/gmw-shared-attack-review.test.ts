/** A shared GMW card must retain its interrupt on older native hero attacks. */
import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  command,
  choose,
  conserved,
  finish,
  hand,
  minion,
  owned,
  play,
  put,
  reload,
  respond,
  target,
} from "./gmw-test-helpers.js";

describe("GMW shared attack adapters", () => {
  it("offers Follow Through on Heroic Strike before damage and preserves its physical-resource stun on the surviving villain stage", () => {
    let s = newGame({
      heroId: "captain_america",
      aspect: "aggression",
      villainId: "rhino",
      seed: 16045,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s.player.form = "hero";
    s.player.inPlay = [];
    s.player.hand = [];
    s.player.discard = [];
    s.minions = [];
    s.sideSchemes = [];
    s.attachments = [];
    s.villain.hp = 2;
    const follow = put(s, "16045"),
      retaliation = owned(s, "01153");
    retaliation.attachedTo = s.villain.id;
    s.attachments.push(retaliation);
    const hp = s.player.hp,
      h = hand(s, "03004", "16051", "16049");
    s = target(play(s, h[0], h.slice(1)), s.villain.id);
    expect(
      s.prompt?.options.some((o) => o.id === follow.id),
      JSON.stringify(s.prompt),
    ).toBe(true);
    expect(s.villain.hp).toBe(2);
    expect(s.villain.stunned).toBe(false);
    s = finish(respond(reload(s), /Follow Through/i, "16045"));
    expect(s.villain.stage).toBe(2);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === follow.id)?.exhausted).toBe(
      false,
    );
    conserved(s, [follow, ...h]);
  });
  it("offers Follow Through on the final Vibranium Suit special without moving hero damage a second time after reload", () => {
    let s = newGame({
      heroId: "black_panther",
      aspect: "aggression",
      villainId: "rhino",
      seed: 16049,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    if (s.prompt) s = choose(s, s.prompt.options[0].id);
    s.player.form = "hero";
    s.player.inPlay = [];
    s.player.hand = [];
    s.player.discard = [];
    s.minions = [];
    s.sideSchemes = [];
    s.attachments = [];
    s.player.hp = 9;
    const follow = put(s, "16045"),
      suit = put(s, "01049"),
      enemy = minion(s, "01110", "p1", 1);
    const h = hand(s, "01043a", "16049");
    s = play(s, h[0], h.slice(1));
    s = target(choose(s, suit.id), enemy.id);
    expect(
      s.prompt?.options.some((o) => o.id === follow.id),
      JSON.stringify(s.prompt),
    ).toBe(true);
    expect(s.player.hp).toBe(11);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    s = finish(respond(reload(s), /Follow Through/i, "16045"));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.find((p) => p.id === follow.id)?.exhausted).toBe(
      false,
    );
    conserved(s, [follow, suit, ...h]);
  });
  it("keeps the first player as chooser for Shield Toss's simultaneous Retaliate responses when Captain is in the second seat", () => {
    let s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 16303,
      pacing: "expert",
      heroes: [
        { heroId: "spider_man", aspect: "justice" },
        { heroId: "captain_america", aspect: "aggression" },
      ],
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s = command(s, { type: "MULLIGAN", ids: [] });
    for (const seat of s.players) {
      const view = seatView(s, seat);
      view.player.form = "hero";
      view.player.inPlay = [];
      view.player.hand = [];
      view.player.discard = [];
    }
    s.minions = [];
    s.sideSchemes = [];
    s.attachments = [];
    const shield = put(s, "03009", "p2"),
      follow = put(s, "16045", "p2");
    const modok = minion(s, "01184", "p2"),
      sleeper = minion(s, "04130", "p2");
    sleeper.tough = false;
    const h = ["03006", "16049", "16050"].map((code) => owned(s, code, "p2"));
    seatView(s, "p2").player.hand = h;
    const firstHP = seatView(s, "p1").player.hp,
      captainHP = seatView(s, "p2").player.hp;
    s = command(s, { type: "PLAY", id: h[0].id, playerId: "p2" });
    expect(s.prompt?.title).toMatch(/Shield Toss.*discard/i);
    s = command(s, { type: "SELECT", ids: h.slice(1).map((p) => p.id) });
    expect(s.prompt?.title).toMatch(/Shield Toss.*targets/i);
    s = command(s, { type: "SELECT", ids: [modok.id, sleeper.id] });
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.firstPlayerId).toBe("p1");
    expect(s.activePlayerId).toBe("p1");
    expect(s.prompt?.options).toHaveLength(2);
    expect(s.minions.find((p) => p.id === modok.id)?.damage).toBe(4);
    expect(s.minions.find((p) => p.id === sleeper.id)?.damage).toBe(4);
    expect(seatView(s, "p2").player.hp).toBe(captainHP);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === follow.id)
        ?.exhausted,
    ).toBe(false);
    const selected = s.prompt!.options.find((o) =>
      /M\.O\.D\.O\.K\./.test(o.label),
    )!;
    expect(selected).toBeTruthy();
    s = finish(choose(reload(s), selected.id));
    expect(seatView(s, "p2").player.hp).toBe(captainHP - 3);
    expect(seatView(s, "p1").player.hp).toBe(firstHP);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === shield.id)).toBe(
      true,
    );
    expect(seatView(s, "p2").player.discard.some((p) => p.id === h[0].id)).toBe(
      true,
    );
  });
});
