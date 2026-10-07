import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Command, Effect, GameState } from "../src/game/types.js";

const saved = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function run(input: GameState, command: Command) {
  let s = dispatch(saved(input), command);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++)
    s = dispatch(saved(s), { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return run(s, { type: "CHOOSE", id });
}
function use(s: GameState, label: RegExp, code?: string) {
  const option = s.prompt?.options.find(
    (o) => label.test(o.label) || (code && o.image === code),
  );
  const yes =
    s.prompt && label.test(s.prompt.title)
      ? s.prompt.options.find((o) => o.id === "yes")
      : undefined;
  expect(option || yes, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, (option || yes)!.id);
}
function finish(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 100; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    const id =
      prefer?.(s) ||
      s.prompt.options.find(
        (o) =>
          /^(skip|pass|continue|none|no|done)$/.test(o.id) ||
          /^(continue|skip|decline|no response)/i.test(o.label),
      )?.id ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function until(s: GameState, available: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !available(s) && n < 80; n++) {
    const option = s.prompt.options.find(
      (o) =>
        /^(skip|pass|continue|none|no)$/.test(o.id) ||
        /^(continue|skip|decline)/i.test(o.label),
    );
    expect(option, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, option!.id);
  }
  expect(available(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function base(heroId = "scw", team = false) {
  let s = newGame({
    heroId,
    aspect: "justice",
    villainId: "rhino",
    seed: 15009,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "scw", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (let n = 0; n < s.players.length; n++)
    s = run(s, { type: "MULLIGAN", ids: [] });
  for (const player of s.players) {
    const view = seatView(s, player);
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.flipped = false;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.deck = Array.from({ length: 12 }, () => makePiece(s, "15021"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 0;
  s.villain.hp = s.villain.maxHp = 40;
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function owned(s: GameState, code: string, ownerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = ownerId;
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => owned(s, code));
  return [...s.player.hand];
}
function area(s: GameState, code: string, ownerId = s.activePlayerId) {
  const p = owned(s, code, ownerId);
  seatView(s, ownerId).player.inPlay.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Independent printed-rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function paidPlay(s: GameState, codes: string[]) {
  const pieces = hand(s, ...codes);
  s = run(s, { type: "PLAY", id: pieces[0].id });
  if (s.prompt?.kind === "payment")
    s = run(s, { type: "PAY", ids: pieces.slice(1).map((p) => p.id) });
  return s;
}
function nextEvolution(s: GameState) {
  const p = makePiece(s, "15024");
  p.counters = 4;
  s.sideSchemes.push(p);
  return p;
}
function damageChoices(s: GameState) {
  if (s.prompt?.options.some((o) => o.id === s.villain.id)) return s.villain.id;
  return s.prompt?.options.find(
    (o) =>
      /deal 2 damage|2 damage|damage result/i.test(o.label) &&
      !/control|crest/i.test(o.label),
  )?.id;
}

describe("independent Scarlet Witch printed-rules dispatch and reload review", () => {
  it("includes two different physical Slipping Sanity cards during native setup", () => {
    const s = newGame({
      heroId: "scw",
      aspect: "justice",
      villainId: "rhino",
      seed: 15023,
    });
    const obligations = [
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.encounter.dealt,
      ...s.resolving,
    ].filter((p) => p.code === "15023");
    expect(obligations).toHaveLength(2);
    expect(new Set(obligations.map((p) => p.id)).size).toBe(2);
  });

  it("Hex Bolt's nonattack damage bypasses Guard and retains both Stunned and Confused", () => {
    let s = base();
    s.player.stunned = true;
    s.player.confused = true;
    const guard = makePiece(s, "01101");
    guard.engagedWith = s.activePlayerId;
    s.minions.push(guard);
    s = paidPlay(s, ["15004", "15021"]);
    s = finish(s, damageChoices);
    expect(s.villain.hp).toBe(34);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(true);
  });

  it("discarded star-only cards count as zero without resolving their boost ability", () => {
    let s = base();
    s.encounter.deck = ["01121", "01132", "01154", "01104"].map((code) =>
      makePiece(s, code),
    );
    const originalHp = s.player.hp;
    s = finish(paidPlay(s, ["15004", "15021"]), damageChoices);
    expect(s.villain.hp).toBe(34);
    expect(s.player.hp).toBe(originalHp);
    expect(s.minions).toHaveLength(0);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.discard).toHaveLength(3);
  });

  it("Hex Bolt stops its physical batch at encounter exhaustion instead of milling recycled cards", () => {
    let s = base();
    const original = [makePiece(s, "01104"), makePiece(s, "01105")];
    s.encounter.deck = original;
    s.encounter.discard = [makePiece(s, "01104")];
    s = finish(paidPlay(s, ["15004", "15021"]), damageChoices);
    expect(s.villain.hp).toBe(36);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toHaveLength(3);
    expect(s.encounter.discard).toHaveLength(0);
    expect(
      original.every((p) => s.encounter.deck.some((q) => q.id === p.id)),
    ).toBe(true);
  });

  it("Molecular Decay applies its additional icons in one damage packet that Tough completely prevents", () => {
    let s = base();
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s.encounter.deck = ["01118", "01119", "01104"].map((code) =>
      makePiece(s, code),
    );
    s = finish(paidPlay(s, ["15005", "15021", "15020"]));
    expect(s.villain.hp).toBe(40);
    expect(s.villain.tough).toBe(false);
    expect(s.encounter.discard).toHaveLength(2);
  });

  it("Stunned replaces Molecular Decay before its encounter-discard and count effects", () => {
    let s = base();
    s.player.stunned = true;
    const before = s.encounter.deck.map((p) => p.id);
    s = finish(paidPlay(s, ["15005", "15021", "15020"]));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(40);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
    expect(s.encounter.discard).toHaveLength(0);
  });

  it("The Next Evolution increases every discarded Molecular Decay count, including zero-icon cards", () => {
    let s = base();
    nextEvolution(s);
    s = finish(paidPlay(s, ["15005", "15021", "15020"]));
    expect(s.villain.hp).toBe(33);
    expect(s.encounter.discard).toHaveLength(2);
  });

  it("Amplify modifies an activation boost but does not modify discarded Molecular Decay cards", () => {
    let s = base();
    const amplify = makePiece(s, "16054");
    amplify.counters = 2;
    s.sideSchemes.push(amplify);
    s = finish(paidPlay(s, ["15005", "15021", "15020"]));
    expect(s.villain.hp).toBe(35);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = finish(s);
    expect(s.player.hp).toBe(7);
  });

  it("Chaos Control's discarded replacement does not inherit the original boost card's Amplify icon", () => {
    let s = base();
    const amplify = makePiece(s, "16054");
    amplify.counters = 2;
    s.sideSchemes.push(amplify);
    s.encounter.deck.unshift(makePiece(s, "01101"), makePiece(s, "01104"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = use(s, /Chaos Control/);
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.encounter.discard).toHaveLength(2);
  });

  it("a boost star discards the Crest before the activation's later numerical-count window", () => {
    let s = base();
    const crest = area(s, "15009");
    s.encounter.deck.unshift(makePiece(s, "01173"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(
      s.prompt?.options.some((o) => o.id === crest.id),
      JSON.stringify(s.prompt),
    ).toBe(true);
    expect(s.prompt?.options.some((o) => o.image === "15001a")).toBe(false);
    s = choose(s, crest.id);
    expect(s.player.inPlay.some((p) => p.id === crest.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === crest.id)).toBe(true);
    expect(s.prompt?.options.some((o) => /Chaos Control/.test(o.label))).toBe(
      true,
    );
    expect(s.prompt?.options.some((o) => o.image === "15009")).toBe(false);
    s = finish(s);
    expect(s.player.hp).toBe(8);
  });

  it("Chaos Control replaces only the number after the original star, and does not execute the discarded replacement's star", () => {
    let s = base();
    const original = makePiece(s, "01158"),
      replacement = makePiece(s, "01123");
    s.encounter.deck.unshift(original, replacement);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.villain.tough).toBe(true);
    s = use(s, /Chaos Control/);
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.tough).toBe(true);
    for (const p of [original, replacement])
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
  });

  it("the Crest's ordinary Interrupt can modify a boost count while its controller is in alter-ego", () => {
    let s = base("spider_man");
    s.player.form = "alter";
    const crest = area(s, "15009");
    s.encounter.deck.unshift(makePiece(s, "01101"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, `crest:${crest.id}:+1`);
    s = finish(s);
    expect(s.player.hp).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === crest.id)?.exhausted).toBe(
      true,
    );
  });

  it("the official Crest and Preemptive Strike interaction cancels the added icon, deals two damage before the star, and does not recount canceled icons", () => {
    let s = base();
    const crest = area(s, "15009");
    const [event, resource] = hand(s, "05014", "15021");
    const original = makePiece(s, "01158");
    s.encounter.deck.unshift(original);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = use(s, /Preemptive Strike/, event.code);
    s = run(s, { type: "PAY", ids: [resource.id] });
    s = until(
      s,
      (x) => !!x.prompt?.options.some((o) => o.id === `crest:${crest.id}:+1`),
    );
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(40);
    s = choose(s, `crest:${crest.id}:+1`);
    expect(s.prompt).toBeNull();
    expect(s.attack).toBeNull();
    expect(s.villain.hp).toBe(38);
    expect(s.villain.tough).toBe(true);
    expect(s.player.hp).toBe(8);
    expect(
      s.encounter.discard.filter((p) => p.id === original.id),
    ).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });

  it("Chaos Control followed by the Crest modifies the replacement's count rather than the original count", () => {
    let s = base();
    const crest = area(s, "15009");
    nextEvolution(s);
    s.encounter.deck.unshift(makePiece(s, "01119"), makePiece(s, "01104"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = use(s, /Chaos Control/);
    s = choose(s, `crest:${crest.id}:-1`);
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.encounter.discard).toHaveLength(2);
    expect(s.player.inPlay.find((p) => p.id === crest.id)?.exhausted).toBe(
      true,
    );
  });

  it("Chaos Control can be used again in a different phase of the same round", () => {
    let s = base();
    s.encounter.deck.unshift(
      ...["01119", "01104", "01119", "01104"].map((code) => makePiece(s, code)),
    );
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = use(s, /Chaos Control/);
    s = finish(s);
    expect(s.player.hp).toBe(8);
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = use(s, /Chaos Control/);
    s = finish(s);
    expect(s.player.hp).toBe(6);
    expect(s.encounter.discard).toHaveLength(4);
  });

  it("a teammate's Scarlet Witch can replace the actual active player's activation count without stealing the damage or original star", () => {
    let s = base("scw", true);
    const active = s.activePlayerId;
    s.encounter.deck.unshift(makePiece(s, "01158"), makePiece(s, "01104"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, "chaos:p2");
    s = finish(s);
    expect(s.activePlayerId).toBe(active);
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.villain.tough).toBe(true);
  });

  it("Spiritual Meditation can be the only hand card and discards one of its two actual draws", () => {
    let s = base();
    const drawIds = s.player.deck.slice(0, 2).map((p) => p.id);
    s = paidPlay(s, ["15019"]);
    expect(s.prompt?.title).toMatch(/Spiritual Meditation/);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawIds);
    s = choose(s, drawIds[1]);
    expect(s.player.hand.map((p) => p.id)).toEqual([drawIds[0]]);
    expect(s.player.discard.some((p) => p.id === drawIds[1])).toBe(true);
  });

  it("Spiritual Meditation checks the actual identity's Mystic trait", () => {
    let s = base("spider_man");
    const event = hand(s, "15019")[0];
    const invalid = dispatch(saved(s), { type: "PLAY", id: event.id });
    expect(invalid.error).toMatch(/Mystic/);
    expect(invalid.player.hand.some((p) => p.id === event.id)).toBe(true);
  });

  it.each(["15010", "15011"])(
    "Confused replaces %s's thwart and does not trigger its response",
    (code) => {
      let s = base();
      s.scheme.threat = 5;
      const ally = area(s, code);
      ally.confused = true;
      const deckIds = s.encounter.deck.map((p) => p.id);
      s = run(s, { type: "ABILITY", id: ally.id, action: "thwart" });
      expect(s.prompt).toBeNull();
      expect(s.scheme.threat).toBe(5);
      const actual = s.player.inPlay.find((p) => p.id === ally.id)!;
      expect(actual.confused).toBe(false);
      expect(actual.exhausted).toBe(true);
      expect(actual.damage).toBe(0);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(deckIds);
    },
  );

  it("Speed's ready response precedes the consequential damage that defeats him", () => {
    let s = base();
    s.scheme.threat = 5;
    const ally = area(s, "15010");
    ally.damage = 3;
    s = run(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    expect(s.prompt?.title).toBe("Speed");
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(3);
    s = use(s, /Speed/);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.scheme.threat).toBe(3);
  });

  it("Wiccan's damage response precedes lethal consequential damage and ignores Guard", () => {
    let s = base();
    s.scheme.threat = 5;
    const ally = area(s, "15011");
    ally.damage = 2;
    const guard = makePiece(s, "01101");
    guard.engagedWith = s.activePlayerId;
    s.minions.push(guard);
    s.encounter.deck.unshift(makePiece(s, "01119"));
    s = run(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = use(s, /Wiccan/);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
    s = finish(s, (x) =>
      x.prompt?.options.some((o) => o.id === x.villain.id)
        ? x.villain.id
        : undefined,
    );
    expect(s.villain.hp).toBe(37);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
  });

  it("Last Stand is unavailable for an ally's Stunned attack replacement", () => {
    let s = base();
    const ally = area(s, "15002");
    ally.stunned = true;
    const event = hand(s, "15029")[0];
    s = run(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(40);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.stunned).toBe(false);
  });

  it("Last Stand waits for the ally's actual consequential damage before its delayed discard", () => {
    let s = base();
    const ally = area(s, "15002"),
      shield = area(s, "15008");
    ally.damage = 3;
    hand(s, "15029");
    s = run(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = use(s, /Last Stand/, "15029");
    s = until(
      s,
      (x) => !!x.prompt?.options.some((o) => o.image === shield.code),
    );
    expect(s.villain.hp).toBe(35);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(3);
    s = finish(choose(s, "allow"));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === shield.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.flags[`scwPackLastStand:${ally.id}`]).toBeUndefined();
  });

  it("a Stunned villain's replacement does not suppress Bait and Switch's independent thwart", () => {
    let s = base();
    s.scheme.threat = 5;
    s.villain.stunned = true;
    s = finish(paidPlay(s, ["15030", "15021"]));
    expect(s.scheme.threat).toBe(1);
    expect(s.villain.stunned).toBe(false);
    expect(s.player.hp).toBe(10);
  });

  it("Bait and Switch can cause an attack even if Crisis prevents its independent threat-removal effect", () => {
    let s = base();
    s.scheme.threat = 5;
    const crisis = makePiece(s, "01108");
    crisis.counters = 3;
    s.sideSchemes.push(crisis);
    s = paidPlay(s, ["15030", "15021"]);
    s = choose(s, "take");
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.scheme.threat).toBe(5);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(true);
  });

  it("Confused replaces all of Bait and Switch, including the requested villain attack", () => {
    let s = base();
    s.scheme.threat = 5;
    s.player.confused = true;
    const ids = s.encounter.deck.map((p) => p.id);
    s = finish(paidPlay(s, ["15030", "15021"]));
    expect(s.scheme.threat).toBe(5);
    expect(s.player.confused).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(ids);
  });

  it("Crisis Averted requires a committed mental resource when Crisis is blocking the main scheme", () => {
    let s = base();
    s.scheme.threat = 5;
    const crisis = makePiece(s, "01108");
    crisis.counters = 3;
    s.sideSchemes.push(crisis);
    const [event, mental, energy, physical] = hand(
      s,
      "15012",
      "15021",
      "15020",
      "15022",
    );
    s = run(s, { type: "PLAY", id: event.id });
    const invalid = dispatch(saved(s), {
      type: "PAY",
      ids: [energy.id, physical.id],
    });
    expect(invalid.error).toBeTruthy();
    expect(invalid.scheme.threat).toBe(5);
    expect(invalid.player.hand.map((p) => p.id)).toEqual(
      s.player.hand.map((p) => p.id),
    );
    s = run(saved(s), { type: "PAY", ids: [mental.id, energy.id] });
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(true);
  });

  it.each(["15024", "15025", "15026", "01121"])(
    "Warp Reality cancels %s before all physical entry, keywords and text, then discards the counted number",
    (code) => {
      let s = base();
      const [warp, resource] = hand(s, "15006", "15021"),
        encounter = makePiece(s, code);
      const hp = s.player.hp,
        originalDeckSize = s.encounter.deck.length;
      s = native(s, {
        type: "reveal",
        piece: encounter,
        fromEncounterDeck: true,
      });
      s = use(s, /Warp Reality/, warp.code);
      s = run(s, { type: "PAY", ids: [resource.id] });
      s = finish(s);
      expect(s.minions).toHaveLength(0);
      expect(s.sideSchemes).toHaveLength(0);
      expect(s.attachments).toHaveLength(0);
      expect(s.player.hp).toBe(hp);
      expect(s.scheme.threat).toBe(0);
      expect(s.encounter.dealt).toHaveLength(0);
      expect(s.encounter.deck).toHaveLength(
        originalDeckSize - (card(code).boost || 0),
      );
      expect(
        s.encounter.discard.filter((p) => p.id === encounter.id),
      ).toHaveLength(1);
      expect(s.player.discard.filter((p) => p.id === warp.id)).toHaveLength(1);
    },
  );

  it("Warp Reality is unavailable for an encounter card revealed from outside the encounter deck", () => {
    let s = base();
    const [warp] = hand(s, "15006", "15021");
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "15025"),
      fromEncounterDeck: false,
    });
    expect(!!s.prompt?.options.some((o) => o.image === warp.code)).toBe(false);
    expect(s.player.hand.some((p) => p.id === warp.id)).toBe(true);
  });

  it("Chaos Magic completely resolves Nick Fury's entry response before its independent encounter discard", () => {
    let s = base();
    const deckIds = s.encounter.deck.map((p) => p.id);
    const [magic, nick] = hand(s, "15003", "01084");
    s = run(s, { type: "PLAY", id: magic.id });
    s = until(s, (x) => !!x.prompt?.options.some((o) => o.id === nick.id));
    s = choose(s, nick.id);
    expect(s.prompt?.title).toMatch(/Nick Fury/);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deckIds);
    s = use(s, /draw 3/i);
    s = finish(s);
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.inPlay.some((p) => p.id === nick.id)).toBe(true);
    expect(s.encounter.discard).toHaveLength(4);
    expect(s.player.discard.filter((p) => p.id === magic.id)).toHaveLength(1);
  });

  it("Chaos Magic ignores a nested card's cost increases but discards only its printed cost", () => {
    let s = base();
    const suspension = makePiece(s, "15026");
    suspension.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(suspension);
    const [magic, ally, resource] = hand(s, "15003", "15002", "15021");
    s = run(s, { type: "PLAY", id: magic.id });
    expect(s.prompt?.cost).toBe(1);
    s = run(s, { type: "PAY", ids: [resource.id] });
    s = choose(s, ally.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.encounter.discard).toHaveLength(4);
    expect(s.player.discard.filter((p) => p.id === resource.id)).toHaveLength(
      1,
    );
  });

  it("Chaos Magic keeps an interrupt-only card's play restriction instead of free-playing it as an action", () => {
    const s = base();
    const [magic] = hand(s, "15003", "15006");
    const invalid = dispatch(saved(s), { type: "PLAY", id: magic.id });
    expect(invalid.error).toBeTruthy();
    expect(invalid.player.hand).toHaveLength(2);
    expect(invalid.encounter.discard).toHaveLength(0);
  });

  it("Magic Shield's optional prevention cannot preserve a Tough status that has already prevented the damage", () => {
    let s = base();
    const shield = area(s, "15008");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: s.villain.id,
    });
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === shield.id)).toBe(true);
  });

  it("Magic Shield's prevention does not turn an undefended attack into a defense-event window", () => {
    let s = base("qsv");
    const shield = area(s, "15008");
    hand(s, "14014", "15021");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (x) => !!x.prompt?.options.some((o) => o.id === "take"));
    s = choose(s, "take");
    s = until(s, (x) => !!x.prompt?.options.some((o) => o.image === "15008"));
    s = use(s, /Magic Shield/, shield.code);
    expect(s.prompt).toBeNull();
    expect(s.attack).toBeNull();
    expect(s.player.hp).toBe(9);
    expect(s.player.hand.some((p) => p.code === "14014")).toBe(true);
  });

  it("Magic Shield prevents a teammate's actual ally consequential damage and physically discards under its owner", () => {
    let s = base("scw", true);
    const shield = area(s, "15008", "p2"),
      ally = area(s, "15011", "p1");
    s.scheme.threat = 5;
    activateSeat(s, "p1");
    s = run(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = choose(s, "skip");
    s = use(s, /Magic Shield/, shield.code);
    s = finish(s);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(0);
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === shield.id),
    ).toBe(false);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === shield.id),
    ).toHaveLength(1);
  });

  it("Slipping Sanity counts only physical star fields, without any numerical-count interrupts or Next Evolution bonus", () => {
    let s = base();
    const crest = area(s, "15009");
    nextEvolution(s);
    const obligation = makePiece(s, "15023");
    s.encounter.deck.unshift(
      ...["01121", "01158", "01119", "01101", "01104"].map((code) =>
        makePiece(s, code),
      ),
    );
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "stay");
    s = choose(s, "discard");
    expect(s.prompt).toBeNull();
    expect(s.scheme.threat).toBe(2);
    expect(s.encounter.discard).toHaveLength(6);
    expect(s.player.inPlay.find((p) => p.id === crest.id)?.exhausted).toBe(
      false,
    );
  });

  it("only the attached player can remove Magical Suspension by exhausting their hero", () => {
    let s = base("scw", true);
    const suspension = makePiece(s, "15026");
    suspension.attachedTo = "hero:p2";
    s.attachments.push(suspension);
    const rejected = dispatch(saved(s), {
      type: "ABILITY",
      id: suspension.id,
      action: "remove",
    });
    expect(rejected.error).toBeTruthy();
    expect(seatView(rejected, "p1").player.exhausted).toBe(false);
    expect(seatView(rejected, "p2").player.exhausted).toBe(false);
    expect(rejected.attachments.some((p) => p.id === suspension.id)).toBe(true);
    activateSeat(s, "p2");
    s = run(s, { type: "ABILITY", id: suspension.id, action: "remove" });
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === suspension.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === suspension.id),
    ).toHaveLength(1);
  });

  it("Chaos Manipulation can activate an already engaged Luminous against the actual revealer without changing her engagement", () => {
    let s = base("scw", true);
    const luminous = makePiece(s, "15025");
    luminous.engagedWith = "p2";
    s.minions.push(luminous);
    // Searching shuffles even when the unique minion is already in play.
    s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01119"));
    s = native(s, { type: "reveal", piece: makePiece(s, "15027"), skip: true });
    s = until(s, (x) => !!x.prompt?.options.some((o) => o.id === "take"));
    s = choose(s, "take");
    s = finish(s);
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.minions.find((p) => p.id === luminous.id)?.engagedWith).toBe("p2");
  });
});
