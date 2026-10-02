import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import type { Command, Effect, GameState } from "../src/game/types";

function cmd(state: GameState, command: Command): GameState {
  let s = dispatch(state, command);
  expect(s.error, `${command.type}: ${s.error || ""}`).toBeUndefined();
  for (let count = 0; s.review && count < 30; count++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
const choose = (s: GameState, id: string) => cmd(s, { type: "CHOOSE", id });
function settle(state: GameState): GameState {
  let s = state;
  for (let count = 0; s.prompt && count < 30; count++) {
    expect(s.prompt.kind).toBe("choice");
    const option =
      s.prompt.options.find((o) =>
        ["take", "resolve", "allow", "pass", "skip"].includes(o.id),
      ) || s.prompt.options[0];
    s = choose(s, option.id);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function base(
  heroId = "spider_man",
  players = 1,
  difficulty: "standard" | "expert" = "standard",
): GameState {
  let s = newGame({
    heroId,
    aspect: "justice",
    villainId: "mutagen_formula",
    difficulty,
    seed: 971,
    pacing: "expert",
    module: "goblin_gimmicks",
    ...(players === 2
      ? {
          heroes: [
            { heroId, aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (let count = 0; s.phase === "mulligan" && count < 10; count++)
    s =
      s.prompt?.kind === "choice"
        ? choose(s, s.prompt.options[0].id)
        : cmd(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    s.player.form = "hero";
    s.player.hand = [];
    s.player.inPlay = [];
    s.player.discard = [];
    s.player.deck = Array.from({ length: 8 }, () => makePiece(s, "01089"));
  }
  activateSeat(s, "p1");
  s.minions = [];
  s.attachments = [];
  s.sideSchemes = [];
  s.encounter.deck = ["02029", "02019", "02020", "02021"].map((code) =>
    makePiece(s, code),
  );
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.queue = [];
  s.prompt = null;
  return s;
}
function native(s: GameState, ...effects: Effect[]): GameState {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Review fixture",
    text: "Resolve native rules.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function hydrate(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

describe("Mutagen final adversarial native review", () => {
  it("revalidates Knight's source after selected Retaliate defeats it, including a hydrated forced window", () => {
    let s = base("black_panther");
    const knight = makePiece(s, "02022");
    knight.engagedWith = "p1";
    knight.damage = 6;
    s.minions.push(knight);
    const deckBefore = s.encounter.deck.map((p) => p.id);
    s.player.tough = true;
    s.player.toughCards = 1;
    s = native(s, { type: "enemyAttack", id: knight.id });
    s = choose(s, "take");
    expect(s.prompt?.title).toBe("Forced responses");
    s = choose(hydrate(s), "retaliate");
    s = settle(s);
    expect(s.minions.some((p) => p.id === knight.id)).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deckBefore);
    expect(s.encounter.discard.filter((p) => p.id === knight.id)).toHaveLength(
      1,
    );
  });

  it("routes Pumpkin Bombs to the other ally defender's controller after hydration", () => {
    let s = base("spider_man", 2);
    const pumpkin = makePiece(s, "02021");
    pumpkin.attachedTo = s.villain.id;
    s.attachments.push(pumpkin);
    const ally = makePiece(s, "01083");
    ally.ownerId = "p2";
    seatView(s, "p2").player.inPlay.push(ally);
    const hp1 = seatView(s, "p1").player.hp;
    const hp2 = seatView(s, "p2").player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(hydrate(s), ally.id);
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.text).toMatch(/indirect/i);
    s = choose(hydrate(s), "hero");
    s = choose(hydrate(s), "hero");
    s = settle(s);
    expect(seatView(s, "p1").player.hp).toBe(hp1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 2);
    expect(s.scheme.threat).toBe(4); // Ally damage does not trigger Goblin.
  });

  it("deals Overconfidence Surge to its revealer when another player's ally receives the attack damage", () => {
    let s = base("spider_man", 2);
    const ally = makePiece(s, "01083");
    ally.ownerId = "p2";
    seatView(s, "p2").player.inPlay.push(ally);
    s = native(s, { type: "reveal", piece: makePiece(s, "02031"), skip: true });
    s = choose(hydrate(s), ally.id);
    s = settle(s);
    expect(s.encounter.dealt.map((p) => [p.code, p.dealtTo])).toEqual([
      ["02019", "p1"],
    ]);
    expect(s.scheme.threat).toBe(4);
  });

  it.each(["02022", "02025"])(
    "returns delayed %s boost when its attack ends by eliminating one player",
    (code) => {
      let s = base("spider_man", 2);
      s.player.hp = 1;
      const knight = makePiece(s, code);
      s.encounter.deck.unshift(knight);
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "take");
      s = settle(s);
      expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
      expect(s.phase).not.toBe("lost");
      expect(s.encounter.deck.filter((p) => p.id === knight.id)).toHaveLength(
        1,
      );
      expect(s.encounter.discard.some((p) => p.id === knight.id)).toBe(false);
    },
  );

  it("returns an established Knight delay when a later Hysteria boost eliminates the attacked hero", () => {
    let s = base("spider_man", 2);
    s.player.hp = 1;
    const hysteria = makePiece(s, "02020");
    hysteria.attachedTo = s.villain.id;
    s.attachments.push(hysteria);
    const knight = makePiece(s, "02022");
    const whirlwind = makePiece(s, "01130");
    s.encounter.deck.unshift(knight, whirlwind);
    const hp2 = seatView(s, "p2").player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(hydrate(s), "take");
    s = settle(s);
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 1); // Entire already-initiated boost ability resolves.
    expect(s.attack).toBeNull();
    expect(s.encounter.deck.filter((p) => p.id === knight.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === knight.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === whirlwind.id),
    ).toHaveLength(1);
  });

  it("preserves stageII response's captured one-threat amount when chosen Retaliate advances to stageIII", () => {
    let s = base("black_panther", 1, "expert");
    s.villain.hp = 1;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.prompt?.title).toBe("Forced responses");
    s = choose(hydrate(s), "retaliate");
    s = settle(s);
    expect(s.villain.stage).toBe(3);
    expect(s.encounter.dealt).toHaveLength(3);
    expect(s.scheme.threat).toBe(3); // StageII response captured1, not newstageIII's2.
  });
});
