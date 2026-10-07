import { describe, expect, it } from "vitest";
import { card, heroStats } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Command, Effect, GameState } from "../src/game/types.js";

function run(input: GameState, command: Command) {
  let s = dispatch(input, command);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 80; n++) s = dispatch(s, { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
const saved = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return run(saved(s), { type: "CHOOSE", id });
}
function use(s: GameState, title: RegExp, code?: string) {
  const option =
    s.prompt?.options.find(
      (o) => title.test(o.label) || (code && o.image === code),
    ) ||
    (s.prompt && title.test(s.prompt.title)
      ? s.prompt.options.find((o) => o.id === "yes")
      : undefined);
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, option!.id);
}
function decline(s: GameState) {
  for (let n = 0; s.prompt && n < 40; n++) {
    const option = s.prompt.options.find(
      (o) =>
        /^(skip|pass|none|done|continue|no|resolve|decline|fail)$/.test(o.id) ||
        /^(skip|pass|continue without|do not|no response|decline)/i.test(
          o.label,
        ),
    );
    expect(option, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, option!.id);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function base(heroId = "qsv", team = false) {
  let s = newGame({
    heroId,
    aspect: "protection",
    villainId: "rhino",
    seed: 14009,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "qsv", aspect: "protection" as const },
          ],
        }
      : {}),
  });
  s = run(s, { type: "MULLIGAN", ids: [] });
  if (team) s = run(s, { type: "MULLIGAN", ids: [] });
  for (const player of s.players) {
    const view = seatView(s, player);
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.flipped = false;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.deck = Array.from({ length: 12 }, () => makePiece(s, "14021"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 8;
  s.villain.hp = s.villain.maxHp = 40;
  s.encounter.deck = Array.from({ length: 10 }, () => makePiece(s, "01101"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Independent rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code = "01101") {
  const p = makePiece(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}

describe("independent Quicksilver rules review regressions", () => {
  it.each([
    { power: "attack" as const, status: "stunned" as const },
    { power: "thwart" as const, status: "confused" as const },
  ])("a $status basic $power does not use Super Speed", ({ power, status }) => {
    let s = base();
    s.player[status] = true;
    const brute = makePiece(s, "14029");
    s.player.inPlay.push(brute);
    s = run(s, { type: "BASIC", action: power });
    expect(s.player[status]).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(40);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.inPlay.some((p) => p.id === brute.id)).toBe(true);
  });

  it("recovery is not one of Super Speed's three qualifying basic powers", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 1;
    s = run(s, { type: "BASIC", action: "recover" });
    expect(s.player.hp).toBe(4);
    expect(s.player.exhausted).toBe(true);
    expect(s.prompt).toBeNull();
  });

  it("Super Speed and Friction Resistance open only after a defended attack places damage", () => {
    let s = base();
    const friction = makePiece(s, "14009");
    friction.exhausted = true;
    s.player.inPlay.push(friction);
    const enemy = minion(s, "01102");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    expect(s.prompt?.options.some((o) => /Super Speed/i.test(o.label))).toBe(
      false,
    );
    s = choose(s, "hero");
    expect(s.prompt?.title).toMatch(/Super Speed/i);
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(true);
    s = use(s, /Super Speed/i, "14001a");
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      true,
    );
    s = use(s, /Friction Resistance/i, "14009");
    s = decline(s);
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      false,
    );
  });

  it.each([
    { form: "hero" as const, exhausted: false },
    { form: "alter" as const, exhausted: true },
  ])(
    "Friction Resistance does not respond to readying an $form identity already ready=$exhausted",
    ({ form, exhausted }) => {
      let s = base();
      s.player.form = form;
      s.player.exhausted = exhausted;
      const friction = makePiece(s, "14009");
      friction.exhausted = true;
      s.player.inPlay.push(friction);
      s = native(s, { type: "ready", target: "hero" });
      expect(s.player.exhausted).toBe(false);
      expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
        true,
      );
      expect(s.prompt).toBeNull();
    },
  );

  it.each(["attack", "thwart"] as const)(
    "Scarlet Witch's canceled basic %s neither reveals nor discards a boost",
    (power) => {
      let s = base();
      const witch = makePiece(s, "14002");
      if (power === "attack") witch.stunned = true;
      else witch.confused = true;
      s.player.inPlay.push(witch);
      const top = s.encounter.deck[0].id;
      s = run(s, { type: "ABILITY", id: witch.id, action: power });
      s = target(s, power === "attack" ? s.villain.id : "main");
      expect(s.encounter.deck[0].id).toBe(top);
      expect(s.encounter.discard).toEqual([]);
      expect(s.player.inPlay.find((p) => p.id === witch.id)?.damage).toBe(0);
      expect(s.prompt).toBeNull();
    },
  );

  it("Scarlet Witch ignores a star boost and its ability when discarding it for her own power", () => {
    let s = base();
    const witch = makePiece(s, "14002");
    s.player.inPlay.push(witch);
    const star = makePiece(s, "14028");
    expect(card(star).boost_star).toBeTruthy();
    expect(card(star).boost || 0).toBe(0);
    s.encounter.deck = [star, makePiece(s, "01101")];
    s = run(s, { type: "ABILITY", id: witch.id, action: "attack" });
    s = use(s, /Scarlet Witch/i, "14002");
    s = target(s, s.villain.id);
    s = decline(s);
    expect(s.villain.hp).toBe(39);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === star.id)).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === witch.id)?.damage).toBe(1);
  });

  it("Serval's two-card shuffle is an effect and can resolve with one matching physical card", () => {
    let s = base();
    s.player.form = "alter";
    const serval = makePiece(s, "14007");
    s.player.inPlay.push(serval);
    const signature = makePiece(s, "14003");
    const aspect = makePiece(s, "14014");
    s.player.discard.push(signature, aspect);
    s = run(s, { type: "ABILITY", id: serval.id });
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([signature.id]);
    s = run(saved(s), { type: "SELECT", ids: [signature.id] });
    expect(s.player.deck.filter((p) => p.id === signature.id)).toHaveLength(1);
    expect(s.player.discard.map((p) => p.id)).toEqual([aspect.id]);
    expect(s.player.inPlay.find((p) => p.id === serval.id)?.exhausted).toBe(
      true,
    );
  });

  it("Maximum Velocity survives the player-phase ready step and expires only at round end", () => {
    let s = base();
    const cards = hand(s, "14005", "14019");
    s = run(s, { type: "PLAY", id: cards[0].id });
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    s = decline(native(s, { type: "refill" }));
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    s.phase = "villain";
    expect(heroStats(s).defense).toBe(3);
    s = decline(native(s, { type: "newRound" }));
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1, defense: 1 });
  });

  it("Need for Speed blocks both direct and player-phase readying through the next round", () => {
    let s = base();
    s = native(s, { type: "reveal", piece: makePiece(s, "14024"), skip: true });
    s = choose(s, "stay");
    const keep = s.prompt?.options.find((o) =>
      /cannot ready|next turn/i.test(o.label),
    );
    expect(keep, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, keep!.id);
    s = decline(s);
    expect(s.player.exhausted).toBe(true);
    s = decline(
      native(
        s,
        { type: "ready", target: "hero" },
        { type: "refill" },
        { type: "newRound" },
        { type: "ready", target: "hero" },
      ),
    );
    expect(s.player.exhausted).toBe(true);
    const event = hand(s, "14003", "14021")[0];
    const invalid = dispatch(saved(s), { type: "PLAY", id: event.id });
    expect(invalid.error).toBeTruthy();
    expect(invalid.prompt).toBeNull();
    expect(invalid.player.hand.some((p) => p.id === event.id)).toBe(true);
  });

  it("Brute Force's piercing and discard apply to an actual basic attack only", () => {
    let s = base();
    const brute = makePiece(s, "14029");
    s.player.inPlay.push(brute);
    const enemy = minion(s);
    enemy.tough = true;
    enemy.toughCards = 1;
    s = run(s, { type: "BASIC", action: "attack" });
    s = target(s, enemy.id);
    s = decline(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === enemy.id)?.tough).toBe(false);
    expect(s.player.discard.filter((p) => p.id === brute.id)).toHaveLength(1);
  });

  it("Tough prevents damage before a Side Step damage interrupt can become available", () => {
    let s = base();
    hand(s, "14015", "14019");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: s.villain.id,
    });
    expect(s.player.hp).toBe(9);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand).toHaveLength(2);
    expect(s.prompt).toBeNull();
  });

  it("Side Step prevents generic direct damage without inventing a reflecting enemy", () => {
    let s = base();
    const cards = hand(s, "14015", "14019");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "Review damage",
    });
    s = use(s, /Side Step/i, "14015");
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    s = decline(s);
    expect(s.player.hp).toBe(8);
    expect(s.villain.hp).toBe(40);
  });

  it("Side Step's energy payment reflects damage to the actual direct-damage enemy", () => {
    let s = base();
    const enemy = minion(s);
    const cards = hand(s, "14015", "14019");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: enemy.id,
    });
    s = use(s, /Side Step/i, "14015");
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    s = decline(s);
    expect(s.player.hp).toBe(8);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(40);
  });

  it.each([false, true])(
    "Vibration Resistance reduces a whole Giant Stomp once, with Tough=%s",
    (tough) => {
      let s = base("ant");
      s.player.heroForm = "giant";
      const enemy = minion(s, "14026");
      for (let n = 0; n < 2; n++) {
        const hp = makePiece(s, "01163");
        hp.attachedTo = enemy.id;
        s.attachments.push(hp);
      }
      const resistance = makePiece(s, "14027");
      resistance.attachedTo = enemy.id;
      s.attachments.push(resistance);
      enemy.tough = tough;
      enemy.toughCards = tough ? 1 : 0;
      const cards = hand(s, "12003", "12021", "12022");
      s = run(s, { type: "PLAY", id: cards[0].id });
      s = run(saved(s), { type: "PAY", ids: cards.slice(1).map((p) => p.id) });
      s = target(s, enemy.id);
      s = decline(s);
      // Constant reduction has priority over Tough (RRG 1.8 p. 57). Its first
      // packet becomes zero, preserving Tough for the second packet of eight.
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(
        tough ? 0 : 8,
      );
      expect(s.minions.find((p) => p.id === enemy.id)?.tough).toBe(false);
    },
  );

  it("Vibration Resistance applies freshly to each separate basic attack and never to nonattack damage", () => {
    let s = base("spider_man");
    const enemy = minion(s, "14026");
    const resistance = makePiece(s, "14027");
    resistance.attachedTo = enemy.id;
    s.attachments.push(resistance);
    s = decline(target(run(s, { type: "BASIC", action: "attack" }), enemy.id));
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    s = native(s, { type: "ready", target: "hero" });
    s = decline(target(run(s, { type: "BASIC", action: "attack" }), enemy.id));
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
    s = native(s, {
      type: "damage",
      target: enemy.id,
      amount: 1,
      source: "hero",
    });
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(3);
  });

  it("a revealed Earthquake canceled by Order and Chaos still resolves Incite", () => {
    let s = base();
    s.scheme.threat = 0;
    const witch = makePiece(s, "14002");
    s.player.inPlay.push(witch);
    const cards = hand(s, "14018", "14021", "14003");
    const encounter = makePiece(s, "14028");
    s.encounter.dealt = [encounter];
    s = native(s, { type: "revealDealt" });
    s = use(s, /Order and Chaos/i, "14018");
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    s = decline(s);
    expect(s.scheme.threat).toBe(1);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([cards[2].id]);
    expect(s.villain.hp).toBe(38);
    expect(
      s.encounter.discard.filter((p) => p.id === encounter.id),
    ).toHaveLength(1);
  });

  it("Multiple Man's optional response also follows a physical card put into play", () => {
    let s = base();
    const ally = makePiece(s, "14012");
    s.player.inPlay.push(ally);
    const copy = hand(s, "14012")[0];
    const beforeDeck = s.player.deck.map((p) => p.id);
    const beforeBoundary = s.hiddenInfo || 0;
    s = native(s, { type: "allyEnter", id: ally.id, fromHand: false });
    expect(s.prompt?.title).toMatch(/Multiple Man/i);
    s = use(s, /Multiple Man/i, "14012");
    s = choose(s, "hand");
    s = target(s, copy.id);
    s = decline(s);
    expect(
      s.player.inPlay
        .filter((p) => p.code === "14012")
        .map((p) => p.id)
        .sort(),
    ).toEqual([ally.id, copy.id].sort());
    expect(s.player.hand).toEqual([]);
    // Choosing a known hand copy does not inspect or shuffle the deck.
    expect(s.player.deck.map((p) => p.id)).toEqual(beforeDeck);
    expect(s.hiddenInfo || 0).toBe(beforeBoundary);
  });

  it("Double Time's non-thwart removal bypasses Patrol and Confused while respecting Crisis", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    const crisis = makePiece(s, "01108");
    crisis.counters = 4;
    s.sideSchemes.push(crisis);
    const patrol = minion(s, "16119");
    // The card's printed Patrol keeps this fixture on the same native keyword path.
    expect(card(patrol).text).toContain("Patrol");
    const cards = hand(s, "14004", "14019");
    s = run(s, { type: "PLAY", id: cards[0].id });
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    s = use(s, /remove.*threat/i);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = target(s, crisis.id);
    s = use(s, /remove.*threat/i);
    s = target(s, crisis.id);
    s = decline(s);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confused).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(false);
  });

  it("a completed Multiple Man deck search shuffles before the next entry response", () => {
    let s = base();
    const ally = makePiece(s, "14012");
    s.player.inPlay.push(ally);
    const copy = makePiece(s, "14012");
    s.player.deck.unshift(copy);
    s = native(s, { type: "allyEnter", id: ally.id, fromHand: false });
    s = use(s, /Multiple Man/i, "14012");
    s = choose(s, "deck");
    const searchedBoundary = s.hiddenInfo || 0;
    s = choose(s, copy.id);
    expect(s.prompt?.title).toBe("Multiple Man");
    expect(s.player.inPlay.some((p) => p.id === copy.id)).toBe(true);
    expect(s.hiddenInfo || 0).toBeGreaterThan(searchedBoundary);
    expect(s.player.deck.some((p) => p.id === copy.id)).toBe(false);
    s = decline(s);
  });

  it.each([
    { boost: "01130", heroHP: 8, stun: true },
    { boost: "01118", heroHP: 7, stun: false },
  ])(
    "Never Back Down checks attack damage separately from $boost boost-ability damage",
    ({ boost, heroHP, stun }) => {
      let s = base();
      const cards = hand(s, "14014", "14021");
      s.encounter.deck = [makePiece(s, boost), makePiece(s, "01101")];
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "hero");
      s = use(s, /Never Back Down/i, "14014");
      s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
      s = decline(s);
      expect(s.player.hp).toBe(heroHP);
      expect(s.villain.stunned).toBe(stun);
    },
  );

  it.each([
    { boost: "01101", heroHP: 9, stun: true },
    { boost: "01118", heroHP: 7, stun: false },
  ])(
    "Side Step's event defense opens Never Back Down without applying basic DEF against $boost",
    ({ boost, heroHP, stun }) => {
      let s = base();
      const cards = hand(s, "14015", "14014", "14019", "14021");
      s.encounter.deck = [makePiece(s, boost), makePiece(s, "01101")];
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "take");
      s = use(s, /Side Step/i, "14015");
      s = run(saved(s), { type: "PAY", ids: [cards[2].id] });
      s = use(s, /Never Back Down/i, "14014");
      s = run(saved(s), { type: "PAY", ids: [cards[3].id] });
      s = decline(s);
      expect(s.player.hp).toBe(heroHP);
      expect(s.villain.stunned).toBe(stun);
      expect(s.villain.hp).toBe(39);
      expect(s.player.exhausted).toBe(false);
    },
  );

  it("Need for Speed's lock expires when its owner's next turn ends, independently of a teammate", () => {
    let s = base("qsv", true);
    s.turnPlayerId = "p2";
    activateSeat(s, "p2");
    s = native(s, { type: "reveal", piece: makePiece(s, "14024"), skip: true });
    s = choose(s, "stay");
    const lock = s.prompt!.options.find((o) =>
      /cannot ready|next turn/i.test(o.label),
    );
    expect(lock).toBeTruthy();
    s = choose(s, lock!.id);
    s = native(s, { type: "newRound" });
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    s.turnPlayerId = "p1";
    activateSeat(s, "p1");
    s = run(s, { type: "END_TURN", discard: [] });
    expect(s.activePlayerId).toBe("p2");
    s = native(s, { type: "ready", target: "hero" });
    expect(s.player.exhausted).toBe(true);
    s = run(s, { type: "END_TURN", discard: [] });
    for (let n = 0; s.prompt?.kind === "select" && n < 2; n++)
      s = run(saved(s), { type: "SELECT", ids: [] });
    expect(seatView(s, "p2").player.exhausted).toBe(false);
  });

  it("Order and Chaos is unavailable when a treachery is revealed outside the encounter deck", () => {
    let s = base();
    s.player.inPlay.push(makePiece(s, "14002"));
    hand(s, "14018", "14021");
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "14028"),
      fromEncounterDeck: false,
    });
    expect(s.prompt?.options.some((o) => o.image === "14018")).toBe(false);
    expect(s.villain.hp).toBe(40);
  });

  it("Always Be Running cannot ready a teammate's faceup Pietro Maximoff", () => {
    let s = base("qsv", true);
    seatView(s, "p2").player.form = "alter";
    seatView(s, "p2").player.exhausted = true;
    const event = hand(s, "14003", "14021")[0];
    const invalid = dispatch(saved(s), { type: "PLAY", id: event.id });
    expect(invalid.error).toBeTruthy();
    expect(invalid.prompt).toBeNull();
    expect(seatView(invalid, "p2").player.exhausted).toBe(true);
    expect(invalid.player.hand.some((p) => p.id === event.id)).toBe(true);
  });

  it("Earthquake's boost cannot choose an ineffectual exhaust instead of affordable physical payment", () => {
    let s = base();
    const resource = hand(s, "14021")[0];
    s.encounter.deck = [makePiece(s, "14028"), makePiece(s, "01101")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    expect(s.prompt?.title).toBe("Earthquake · boost");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["pay"]);
    s = choose(s, "pay");
    s = run(saved(s), { type: "PAY", ids: [resource.id] });
    s = decline(s);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    expect(s.player.hp).toBe(8);
  });

  it("Side Step reflects Avalanche's indirect damage back to that actual minion", () => {
    let s = base();
    s.scheme.threat = 0;
    const cards = hand(s, "14015", "14019");
    const avalanche = makePiece(s, "14026");
    s = native(s, { type: "reveal", piece: avalanche, skip: true });
    s = choose(s, "incite");
    const damage = s.prompt?.options.find((o) =>
      /indirect damage/i.test(o.label),
    );
    expect(damage, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, damage!.id);
    s = choose(s, "hero");
    s = choose(s, "hero");
    s = use(s, /Side Step/i, "14015");
    s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
    s = decline(s);
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === avalanche.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(40);
  });
});
