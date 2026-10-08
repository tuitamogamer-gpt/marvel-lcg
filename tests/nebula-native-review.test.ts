/** Independent native review: original starter instances, ordinary dispatch,
 * serialized decisions, and physical source conservation. No module resolvers
 * or mock ports are invoked by this suite. */
import { describe, expect, it } from "vitest";
import { card, heroStats } from "../src/game/cards.js";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

type ReviewState = GameState & {
  reviewSourceIds: Record<string, string[]>;
  reviewNemesisIds?: string[];
};
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(s: GameState, cmd: Command) {
  s = dispatch(reload(s), cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(reload(s), { type: "PROCEED" });
    expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  }
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function pass(s: GameState) {
  return s.prompt?.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no|decline|take)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  )?.id;
}
function finish(s: GameState) {
  for (let n = 0; s.prompt && n < 100; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    const id =
      pass(s) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  conserved(s);
  return s;
}
function until(s: GameState, predicate: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !predicate(s) && n < 100; n++) {
    const id = pass(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(predicate(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function named(s: GameState, title: RegExp) {
  s = until(s, (v) => !!v.prompt && title.test(v.prompt.title));
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Independent Nebula native review",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function sourcePieces(s: GameState): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.attack?.pendingBoosts || []),
  ];
}
function conserved(s: GameState) {
  const all = sourcePieces(s);
  for (const [owner, ids] of Object.entries(
    (s as ReviewState).reviewSourceIds || {},
  ))
    for (const id of ids) {
      const found = all.filter((p) => p.id === id);
      expect(found, `${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
  for (const id of (s as ReviewState).reviewNemesisIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original nemesis:${id}`,
    ).toHaveLength(1);
}
type Partner = "gam" | "spider_man" | "drax";
function opening(other?: Partner, nebulaSecond = false) {
  const partner = other
    ? {
        heroId: other,
        aspect:
          other === "gam"
            ? ("aggression" as const)
            : other === "drax"
              ? ("protection" as const)
              : ("justice" as const),
        // A legal 40-card Protection deck uses actual First Hit printings instead
        // of the two Counter-Punch slots. newGame validates and creates every ID.
        ...(other === "drax"
          ? {
              deckCards: heroStarterCodes("drax").map((code) =>
                code === "19014" ? "18015" : code,
              ),
            }
          : {}),
      }
    : undefined;
  const seats = other
    ? nebulaSecond
      ? [partner!, { heroId: "nebu", aspect: "justice" as const }]
      : [{ heroId: "nebu", aspect: "justice" as const }, partner!]
    : undefined;
  let s = newGame({
    heroId: "nebu",
    aspect: "justice",
    villainId: "rhino",
    seed: 22031,
    pacing: "expert",
    ...(seats ? { heroes: seats } : {}),
  });
  const ids: Record<string, string[]> = {};
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const all = [...p.deck, ...p.hand, ...p.inPlay];
    expect(all).toHaveLength(40);
    ids[seat.id] = all.map((p) => p.id);
    if (seat.heroId === "nebu")
      expect(all.map((p) => p.code).sort()).toEqual(
        [...heroStarterCodes("nebu")].sort(),
      );
  }
  (s as ReviewState).reviewSourceIds = ids;
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  return finish(s);
}
function base(other?: Partner, nebulaSecond = false) {
  const s = opening(other, nebulaSecond);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.deck.push(...p.hand.splice(0), ...p.discard.splice(0));
    p.form = "hero";
    p.exhausted = false;
    p.flipped = false;
  }
  s.scheme.threat = 8;
  s.villain.hp = s.villain.maxHp = 50;
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
  playerId = s.activePlayerId,
): Piece {
  const p = seatView(s, playerId).player;
  for (const from of [p.deck, p.hand, p.discard, p.inPlay]) {
    const index = from.findIndex((p) => p.code === code);
    if (index >= 0) {
      const found = from.splice(index, 1)[0];
      p[zone].push(found);
      return found;
    }
  }
  throw Error(`Original ${playerId} source has no available ${code}`);
}
function top(s: GameState, ...codes: string[]) {
  const found = codes.map((code) => take(s, code));
  for (const p of found)
    s.player.hand.splice(
      s.player.hand.findIndex((v) => v.id === p.id),
      1,
    );
  s.player.deck.unshift(...found);
  return found;
}
function encounter(
  s: GameState,
  code: string,
  zone: "source" | "deck" | "minions" | "sideSchemes" = "source",
) {
  for (const from of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = from.findIndex((p) => p.code === code);
    if (i >= 0) {
      const p = from.splice(i, 1)[0];
      if (zone === "deck") s.encounter.deck.unshift(p);
      else if (zone === "minions") {
        p.engagedWith = s.activePlayerId;
        s.minions.push(p);
      } else if (zone === "sideSchemes") s.sideSchemes.push(p);
      return p;
    }
  }
  throw Error(`Original encounter source has no ${code}`);
}
function play(s: GameState, p: Piece, resources: Piece[] = []) {
  s = command(s, { type: "PLAY", id: p.id });
  if (s.prompt?.kind === "payment")
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
  return s;
}
function begin(s: GameState, playerId = s.activePlayerId) {
  return native(s, { type: "beginTurn", actorId: playerId });
}

describe("Independent Nebula native Technique timing", () => {
  it("launches all forty original physical cards and printed source stats", () => {
    const s = opening();
    expect(heroStats(s)).toMatchObject({ recover: 3 });
    expect(sourcePieces(s).filter((p) => p.ownerId === "p1")).toHaveLength(40);
    conserved(s);
  });
  it("own turn resolves ordered Specials with Cutthroat active until Weapons Master finishes", () => {
    let s = base();
    const cut = take(s, "22004", "inPlay"),
      weapon = take(s, "22007", "inPlay");
    s = begin(s);
    expect(s.prompt?.title).toBe("Combat Protocols");
    s = choose(s, cut.id);
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(5);
    expect(s.player.inPlay.some((p) => p.id === cut.id)).toBe(true);
    s = choose(reload(s), weapon.id);
    s = choose(reload(s), s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.discard.map((p) => p.id)).toEqual([cut.id, weapon.id]);
  });
  it("Stun replaces only the first real Weapons Master Special and both resolved sources discard", () => {
    let s = base();
    const a = take(s, "22007", "inPlay"),
      b = take(s, "22007", "inPlay");
    s.player.stunned = true;
    s = begin(s);
    s = choose(s, a.id);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    s = choose(s, b.id);
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.player.discard.map((p) => p.id)).toEqual([a.id, b.id]);
  });
  it("Confuse with no threat replaces one Special, while the next unable copy remains", () => {
    let s = base();
    const a = take(s, "22004", "inPlay"),
      b = take(s, "22004", "inPlay");
    s.scheme.threat = 0;
    s.player.confused = true;
    s = begin(s);
    s = choose(s, a.id);
    expect(s.player.confused).toBe(false);
    s = finish(choose(s, b.id));
    expect(s.player.inPlay.map((p) => p.id)).toEqual([b.id]);
    expect(s.player.discard.map((p) => p.id)).toEqual([a.id]);
  });
  it("Tough prevents Unyielding Special resolution so its continuous bonus survives the forced response", () => {
    let s = base();
    const p = take(s, "22006", "inPlay");
    s.player.tough = true;
    s = finish(choose(begin(s), p.id));
    expect(s.player.inPlay.map((p) => p.id)).toEqual([p.id]);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 2 });
  });
  it("does not activate AE Techniques at own turn start", () => {
    let s = base();
    const p = take(s, "22007", "inPlay");
    s.player.form = "alter";
    s = finish(begin(s));
    expect(s.player.inPlay.map((p) => p.id)).toEqual([p.id]);
    expect(s.villain.hp).toBe(50);
  });
  it("ending another player's turn activates Nebula's real physical next-seat Techniques", () => {
    let s = base("spider_man", true);
    const p = take(s, "22007", "inPlay", "p2");
    s = command(s, { type: "END_TURN" });
    expect(s.activePlayerId).toBe("p2");
    expect(s.turnPlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("Combat Protocols");
    s = choose(s, p.id);
    s = finish(choose(s, s.villain.id));
    expect(s.players[0].player.discard).toEqual([]);
    expect(seatView(s, "p2").player.discard.some((v) => v.id === p.id)).toBe(
      true,
    );
  });
  it("mandatory protocol order cannot be canceled after a saved choice", () => {
    let s = base();
    take(s, "22007", "inPlay");
    s = begin(s);
    const original = reload(s);
    const rejected = dispatch(reload(s), { type: "CANCEL" });
    expect(rejected.error).toMatch(/cannot be canceled/);
    expect(rejected.prompt).toEqual(original.prompt);
    expect(rejected.queue).toEqual(original.queue);
    conserved(rejected);
  });
});

describe("Independent Nebula native PLAY versus PUT and resets", () => {
  it("an actual AE Technique play opens Cybernetic once, with decline preserving the round use", () => {
    let s = base();
    s.player.form = "alter";
    const a = take(s, "22004"),
      b = take(s, "22004"),
      c = take(s, "22007");
    const x = take(s, "22009"),
      y = take(s, "22009"),
      z = take(s, "22010");
    s = named(play(s, a, [x]), /Cybernetic Upgrades/);
    s = choose(s, "skip");
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
    s = named(play(s, b, [y]), /Cybernetic Upgrades/);
    const handBefore = s.player.hand.length;
    s = finish(choose(reload(s), "yes"));
    expect(s.player.hand).toHaveLength(handBefore + 2);
    s = finish(play(s, c, [z]));
    expect(s.flags.nebulaCyberneticRound).toBe(s.round);
    expect(s.player.inPlay.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
  });
  it("canceling a saved Technique payment spends no resource, play trigger or physical source", () => {
    let s = base();
    s.player.form = "alter";
    const p = take(s, "22004");
    take(s, "22024");
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toBeNull();
    expect(s.player.hand.some((v) => v.id === p.id)).toBe(true);
    expect(s.player.inPlay).toEqual([]);
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
    conserved(s);
  });
  it("Combat Ready puts the found Technique after native entry, resolves Special and does not trigger draw", () => {
    let s = base();
    s.player.form = "alter";
    const event = take(s, "22009");
    const [before, found, after] = top(s, "22003", "22006", "22010");
    s = choose(play(s, event), "find");
    s = finish(s);
    expect(s.player.inPlay.map((p) => p.id)).toEqual([found.id]);
    expect(s.player.tough).toBe(true);
    expect(s.player.discard.some((p) => p.id === before.id)).toBe(true);
    expect(s.player.deck[0].id).toBe(after.id);
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
  });
  it("Combat Ready last Technique resets once then retrieves the same physical ID from the new deck", () => {
    let s = base();
    s.player.form = "alter";
    const event = take(s, "22009");
    const found = take(s, "22006");
    s.player.hand.splice(
      s.player.hand.findIndex((p) => p.id === found.id),
      1,
    );
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(found);
    const dealt = s.encounter.dealt.length;
    s = finish(choose(play(s, event), "find"));
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    expect(s.player.inPlay.map((p) => p.id)).toEqual([found.id]);
    expect(s.player.tough).toBe(true);
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
  });
  it("Combat Ready exhausted without a Technique stops original milling and never puts a discarded-pile copy", () => {
    let s = base();
    s.player.form = "alter";
    const event = take(s, "22009"),
      prior = take(s, "22006", "discard"),
      last = take(s, "22003");
    s.player.hand.splice(
      s.player.hand.findIndex((p) => p.id === last.id),
      1,
    );
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(last);
    const dealt = s.encounter.dealt.length;
    s = finish(choose(play(s, event), "find"));
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.deck.some((p) => p.id === prior.id)).toBe(true);
    expect(s.player.tough).toBe(false);
  });
});

describe("Independent Nebula native continuous targeting and immunity", () => {
  it("hero Evasive ignores actual Guard and Crisis in real basic target prompts", () => {
    let s = base();
    const evasive = take(s, "22005", "inPlay");
    encounter(s, "01101", "minions");
    const crisis = encounter(s, "01108", "sideSchemes");
    crisis.counters = 4;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(true);
    s = finish(choose(s, s.villain.id));
    s.player.exhausted = false;
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = finish(choose(s, "main"));
    expect(s.scheme.threat).toBe(6);
    expect(s.player.inPlay.some((p) => p.id === evasive.id)).toBe(true);
  });
  it("Unyielding prevents native Stun and Confuse while hero and allows them after actual flip", () => {
    let s = base();
    take(s, "22006", "inPlay");
    s = native(
      s,
      { type: "status", target: "hero", status: "stunned" },
      { type: "status", target: "hero", status: "confused" },
    );
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(false);
    s = finish(command(s, { type: "FLIP" }));
    s = finish(
      native(
        s,
        { type: "status", target: "hero", status: "stunned" },
        { type: "status", target: "hero", status: "confused" },
      ),
    );
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
  });
  it("an actual unmodified Technique Special event has native play restriction when no useful Special exists", () => {
    const s = base();
    const event = take(s, "22010");
    expect(playable(s, event)).toBeTruthy();
    const blocked = dispatch(reload(s), { type: "PLAY", id: event.id });
    expect(blocked.error).toBeTruthy();
    expect(blocked.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(blocked.player.inPlay).toEqual([]);
    conserved(blocked);
  });
});

function shadow(s: GameState) {
  const p = encounter(s, "01190");
  s = finish(native(s, { type: "reveal", piece: p }));
  expect(s.sideSchemes.some((p) => p.code === "22029")).toBe(true);
  expect(
    [...s.encounter.deck, ...s.encounter.discard].filter(
      (p) => p.code === "22031",
    ),
  ).toHaveLength(2);
  const original = sourcePieces(s).filter((p) =>
    /^220(?:28|29|30|31)$/.test(p.code),
  );
  expect(original).toHaveLength(5);
  (s as ReviewState).reviewNemesisIds = original.map((p) => p.id);
  return s;
}
function oldRivals(s: GameState) {
  const p = encounter(s, "22031");
  return { piece: p, state: native(s, { type: "reveal", piece: p }) };
}

describe("Independent Old Rivals actual attack and Surge review", () => {
  it("First Hit ending an already initiated Gamora attack deals no attack damage and does not grant Surge", () => {
    let s = shadow(base("drax"));
    const enemy = s.minions.find((p) => p.code === "22028")!;
    enemy.damage = 4;
    const firstHit = take(s, "18015", "hand", "p2"),
      resource = take(s, "19024", "hand", "p2");
    const hp = s.player.hp,
      dealt = s.encounter.dealt.length;
    s = oldRivals(s).state;
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "18015"));
    const response = s.prompt!.options.find((o) => o.image === "18015")!;
    s = choose(reload(s), response.id);
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.activePlayerId).toBe("p1");
    expect(s.player.hp).toBe(hp);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.dealt).toHaveLength(dealt);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === firstHit.id),
    ).toBe(true);
    conserved(s);
  });
  it("source-generated Old Rivals attacks using the actual native-played Gamora ally and consequential damage", () => {
    let s = shadow(base());
    const enemy = s.minions.find((p) => p.code === "22028")!;
    s = finish(native(s, { type: "discardPiece", id: enemy.id }));
    const ally = take(s, "22002"),
      energy = take(s, "22024"),
      mental = take(s, "22010");
    s = finish(play(s, ally, [energy, mental]));
    const hp = s.player.hp;
    s = finish(oldRivals(s).state);
    expect(s.player.hp).toBe(hp - 3); // Self-Preservation boosts the actual allied Gamora.
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      exhausted: false,
      damage: 1,
    });
    expect(s.encounter.discard.filter((p) => p.code === "22031")).toHaveLength(
      1,
    );
    conserved(s);
  });
  it("actual Gamora ally Stun replacement grants Surge and does not pay consequential damage", () => {
    let s = shadow(base());
    const enemy = s.minions.find((p) => p.code === "22028")!;
    s = finish(native(s, { type: "discardPiece", id: enemy.id }));
    const ally = take(s, "22002", "inPlay");
    ally.stunned = true;
    const hp = s.player.hp;
    s = finish(oldRivals(s).state);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      stunned: false,
      damage: 0,
      exhausted: false,
    });
    expect(
      s.log.some((entry) =>
        /Surge/i.test(typeof entry === "string" ? entry : entry.text),
      ),
    ).toBe(true);
    conserved(s);
  });
  it("native friendly Gamora hero attack returns to the revealed player's saved actor without exhausting source", () => {
    let s = shadow(base("gam"));
    expect(s.minions.some((p) => p.code === "22028")).toBe(false);
    const hp = s.player.hp,
      source = seatView(s, "p2").player;
    source.exhausted = true;
    s = finish(oldRivals(reload(s)).state);
    expect(s.activePlayerId).toBe("p1");
    expect(s.player.hp).toBe(hp - 3);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    conserved(s);
  });
  it("no actual Gamora character grants Surge without inventing a friendly source", () => {
    let s = shadow(base());
    const enemy = s.minions.find((p) => p.code === "22028")!;
    s = finish(native(s, { type: "discardPiece", id: enemy.id }));
    const hp = s.player.hp;
    s = finish(oldRivals(s).state);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay).toEqual([]);
    expect(
      s.log.some((entry) =>
        /Surge/i.test(typeof entry === "string" ? entry : entry.text),
      ),
    ).toBe(true);
    conserved(s);
  });
});
