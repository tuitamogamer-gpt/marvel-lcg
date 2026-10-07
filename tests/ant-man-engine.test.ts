/** Native Ant-Man acceptance: actual commands, physical cards and saved decisions. */
import { describe, expect, it } from "vitest";
import {
  card,
  handSize,
  heroCard,
  heroStats,
  maxHP,
  pieceHP,
} from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let guard = 0; s.review && guard < 80; guard++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt!.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function respond(s: GameState, text: RegExp, code?: string) {
  for (let guard = 0; guard < 12; guard++) {
    expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
    const o =
      s.prompt!.options.find(
        (o) => text.test(o.label) || (code && o.image === code),
      ) ||
      (text.test(s.prompt!.title)
        ? s.prompt!.options.find((o) => o.id === "yes")
        : undefined);
    if (o) return choose(s, o.id);
    s = skip(s);
  }
  throw Error(`Missing response ${text}: ${JSON.stringify(s.prompt)}`);
}
function skip(s: GameState) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  const o = s.prompt!.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  );
  expect(o, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, o!.id);
}
function skipAll(s: GameState) {
  for (let guard = 0; s.prompt && guard < 20; guard++) s = skip(s);
  expect(s.prompt).toBeNull();
  return s;
}
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function base(team = false) {
  let s = newGame({
    heroId: "ant",
    aspect: "leadership",
    villainId: "rhino",
    seed: 12001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "ant", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    if (v.heroId === "ant") v.player.heroForm = "tiny";
    v.player.flipped = false;
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.deck = Array.from({ length: 12 }, () => makePiece(s, "12021"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 5;
  s.villain.hp = s.villain.maxHp = 40;
  return s;
}
function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code = "12027", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
}
function paid(s: GameState, piece: Piece, ids: string[]) {
  s = command(s, { type: "PLAY", id: piece.id });
  if (s.prompt?.kind === "payment") s = command(s, { type: "PAY", ids });
  return s;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function theft(s: GameState) {
  const p = makePiece(s, "12026");
  p.counters = 2;
  s.sideSchemes.push(p);
  return p;
}
function otherHero(heroId: string) {
  let s = newGame({
    heroId,
    aspect: "protection",
    villainId: "rhino",
    seed: 12,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  return s;
}

describe("Ant-Man's complete retail pack through actual engine commands", () => {
  it("launches the exact source 40-card Leadership deck with all original printing IDs", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-12001a")!;
    const codes = heroStarterCodes("ant");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("12"))).toBe(true);
    expect(deckErrors("ant", "leadership", codes)).toEqual([]);
    const s = newGame({
      heroId: "ant",
      aspect: "leadership",
      villainId: "rhino",
      heroes: [{ heroId: "ant", aspect: "leadership", deckCards: codes }],
      seed: 12001,
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual([...codes].sort());
    expect(
      new Set([...s.player.hand, ...s.player.deck].map((p) => p.id)).size,
    ).toBe(40);
    expect(s.player.hp).toBe(12);
    expect(heroCard(s).code).toBe("12001b");
    expect(handSize(s)).toBe(6);
  });

  it("voluntary form change offers both other forms, supports cancellation and survives JSON hydration", () => {
    let s = base();
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("Change form");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual([
      "alter",
      "giant",
    ]);
    expect(s.player.flipped).toBe(false);
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.form).toBe("hero");
    expect(s.player.heroForm).toBe("tiny");
    s = command(s, { type: "FLIP" });
    s = choose(reload(s), "giant");
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "giant",
      flipped: true,
    });
    expect(heroCard(s).code).toBe("12001c");
    expect(heroCard(s).traits).toBe("Avenger. Giant.");
    expect(heroStats(s)).toMatchObject({
      attack: 3,
      thwart: 1,
      defense: 3,
      recover: 3,
    });
    expect(handSize(s)).toBe(4);
    s = skipAll(s);
    expect(dispatch(s, { type: "FLIP", target: "tiny" }).error).toBeTruthy();
  });

  it("Scott Lang can select Tiny directly and the physical identity face supplies its printed stats and traits", () => {
    let s = base();
    s.player.form = "alter";
    s = command(s, { type: "FLIP", target: "tiny" });
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "tiny",
      flipped: true,
    });
    expect(heroCard(s).code).toBe("12001a");
    expect(heroCard(s).traits).toBe("Avenger. Tiny.");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
    expect(handSize(s)).toBe(5);
    s = skipAll(s);
    expect(s.scheme.threat).toBe(5);
  });

  it("Puny Pest is an optional native response with a legal scheme target", () => {
    let s = base();
    s.player.form = "alter";
    s = command(s, { type: "FLIP", target: "tiny" });
    expect(s.scheme.threat).toBe(5);
    s = respond(reload(s), /Puny Pest|remove 1 threat/i, "12001a");
    s = target(s, "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(4);
  });

  it("Giant Nuisance is optional and does not consume Stunned because its damage is not an attack", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "FLIP", target: "giant" });
    expect(s.villain.hp).toBe(40);
    s = respond(reload(s), /Giant Nuisance|deal 1 damage/i, "12001c");
    s = target(s, s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.player.stunned).toBe(true);
  });

  it("Time to Unwind can be declined or heal exactly 1 when changing to Scott Lang", () => {
    let s = base();
    s.player.hp = 7;
    s = command(s, { type: "FLIP", target: "alter" });
    expect(heroCard(s).code).toBe("12001b");
    expect(handSize(s)).toBe(6);
    expect(s.player.hp).toBe(7);
    s = respond(reload(s), /Time to Unwind|heal 1/i, "12001b");
    s = skipAll(s);
    expect(s.player.hp).toBe(8);
  });

  it("Puny Pest removes threat through Crisis and Patrol because its response is not a thwart", () => {
    let s = base();
    s.player.form = "alter";
    const crisis = makePiece(s, "01108");
    crisis.counters = 4;
    s.sideSchemes.push(crisis);
    minion(s, "16136");
    s.player.confused = true;
    s.player.confuseCards = 1;
    s = command(s, { type: "FLIP", target: "tiny" });
    s = respond(s, /Puny Pest/);
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(4);
    expect(s.player.confused).toBe(true);
    expect(s.sideSchemes[0].counters).toBe(4);
  });

  it("Resize can change hero forms after a voluntary change and draws exactly one card", () => {
    let s = base();
    s = skipAll(command(s, { type: "FLIP", target: "giant" }));
    const [resize] = hand(s, "12005"),
      drawn = s.player.deck[0];
    s = command(s, { type: "PLAY", id: resize.id });
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "tiny",
      flipped: true,
    });
    s = skipAll(reload(s));
    expect(s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
    expect(s.player.discard.filter((p) => p.id === resize.id)).toHaveLength(1);
    expect(dispatch(s, { type: "FLIP", target: "alter" }).error).toBeTruthy();
  });

  it("an effect-driven Resize leaves the voluntary change available and cannot be played in alter-ego", () => {
    let s = base();
    const [resize] = hand(s, "12005");
    s = skipAll(command(s, { type: "PLAY", id: resize.id }));
    expect(s.player.heroForm).toBe("giant");
    expect(s.player.flipped).toBe(false);
    s = skipAll(command(s, { type: "FLIP", target: "alter" }));
    const [second] = hand(s, "12005");
    expect(playable(s, second)).toBeTruthy();
  });

  it("Helmet and each Giant Strength remain separate optional responses, with bonuses lasting only the turn", () => {
    let s = base(true);
    put(s, "12008");
    put(s, "12009");
    put(s, "12009");
    s.player.hp = 7;
    s = command(s, { type: "FLIP", target: "giant" });
    expect(s.player.hp).toBe(7);
    expect(heroStats(s).attack).toBe(3);
    s = respond(s, /Helmet|heal 2/i, "12008");
    expect(s.player.hp).toBe(9);
    for (let i = 0; i < 2; i++)
      s = respond(reload(s), /Giant Strength/i, "12009");
    s = skipAll(s);
    expect(heroStats(s).attack).toBe(5);
    s = command(reload(s), { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p2");
    expect(heroStats(seatView(s, "p1")).attack).toBe(3);
  });

  it("Tiny Helmet draws its physical top card only when accepted", () => {
    let s = base();
    put(s, "12008");
    s.player.heroForm = "giant";
    const drawn = s.player.deck[0];
    s = command(s, { type: "FLIP", target: "tiny" });
    expect(s.player.hand).toEqual([]);
    s = respond(reload(s), /Helmet|draw 1/i, "12008");
    s = skipAll(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
  });

  it("the shared form window lets Helmet draw a new Moxie and play it before Puny Pest", () => {
    let s = base();
    s.player.heroForm = "giant";
    put(s, "12008");
    const moxie = makePiece(s, "12016");
    s.player.deck.unshift(moxie);
    s = command(s, { type: "FLIP", target: "tiny" });
    expect(s.prompt?.title).toBe("After changing form");
    s = respond(reload(s), /Helmet/);
    expect(s.player.hand.map((p) => p.id)).toEqual([moxie.id]);
    expect(s.prompt?.options.some((o) => o.id === moxie.id)).toBe(true);
    s = choose(reload(s), moxie.id);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    expect(s.scheme.threat).toBe(5);
    s = respond(reload(s), /Puny Pest/);
    s = target(s, "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.discard.filter((p) => p.id === moxie.id)).toHaveLength(1);
  });

  it("preserves all 40 source instances and stacked form stats through saved response choices", () => {
    let s = newGame({
      heroId: "ant",
      aspect: "leadership",
      villainId: "rhino",
      seed: 12001,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    const source = [...s.player.hand, ...s.player.deck];
    const ids = source.map((p) => p.id).sort();
    expect(ids).toHaveLength(40);
    const take = (code: string) => {
      const i = source.findIndex((p) => p.code === code);
      expect(i, `Missing source printing ${code}`).toBeGreaterThanOrEqual(0);
      return source.splice(i, 1)[0];
    };
    const helmet = take("12008"),
      strengths = [take("12009"), take("12009")],
      moxie = take("12016"),
      resize = take("12005");
    s.player.inPlay = [helmet, ...strengths];
    s.player.hand = [resize];
    s.player.deck = [moxie, ...source];
    s.player.form = "hero";
    s.player.heroForm = "giant";
    s.player.hp = 7;
    const conserve = (state: GameState) => {
      const physical = [
        ...state.player.hand,
        ...state.player.deck,
        ...state.player.discard,
        ...state.player.inPlay,
      ];
      expect(physical.map((p) => p.id).sort()).toEqual(ids);
      expect(new Set(physical.map((p) => p.id)).size).toBe(40);
    };
    conserve(s);
    s = command(reload(s), { type: "FLIP", target: "tiny" });
    s = respond(reload(s), /Helmet/);
    expect(s.player.hand.map((p) => p.id)).toContain(moxie.id);
    s = choose(reload(s), moxie.id);
    s = skipAll(reload(s));
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    conserve(reload(s));

    s = command(reload(s), { type: "PLAY", id: resize.id });
    s = respond(reload(s), /Giant Strength/);
    s = respond(reload(s), /Helmet/);
    s = respond(reload(s), /Giant Strength/);
    s = skipAll(reload(s));
    expect(s.player.heroForm).toBe("giant");
    expect(s.player.hp).toBe(9);
    expect(heroStats(s)).toMatchObject({ attack: 6, thwart: 2, defense: 4 });
    expect(s.player.discard.map((p) => p.id)).toEqual([moxie.id, resize.id]);
    conserve(reload(s));
  });

  it.each(["tiny", "giant"] as const)(
    "Pym Particles spent in %s opens an optional response after a real payment",
    (form) => {
      let s = base();
      s.player.heroForm = form;
      s.player.hp = 6;
      const h = hand(s, "12009", "12006"),
        drawn = s.player.deck[0];
      s = command(s, { type: "PLAY", id: h[0].id });
      s = command(s, { type: "CANCEL" });
      expect(s.player.hand.map((p) => p.id)).toContain(h[1].id);
      expect(s.player.hp).toBe(6);
      s = paid(s, h[0], [h[1].id]);
      expect(s.player.discard.filter((p) => p.id === h[1].id)).toHaveLength(1);
      s = respond(reload(s), /Pym Particles/i, "12006");
      s = skipAll(s);
      expect(s.player.hp).toBe(form === "giant" ? 8 : 6);
      expect(s.player.hand.map((p) => p.id)).toEqual(
        form === "tiny" ? [drawn.id] : [],
      );
      expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    },
  );

  it("spending Pym Particles in alter-ego gives its resource without a hero response", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 6;
    const h = hand(s, "12009", "12006");
    s = paid(s, h[0], [h[1].id]);
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(6);
    expect(s.player.hand).toEqual([]);
  });

  it("Army of Ants deals non-attack damage only in Tiny form and exhausts its actual instance", () => {
    let s = base();
    const ants = put(s, "12007");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "ABILITY", id: ants.id, action: "army-of-ants" });
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(39);
    expect(s.player.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ants.id)?.exhausted).toBe(true);
    s.player.inPlay.find((p) => p.id === ants.id)!.exhausted = false;
    s.player.heroForm = "giant";
    expect(
      dispatch(s, { type: "ABILITY", id: ants.id, action: "army-of-ants" })
        .error,
    ).toBeTruthy();
  });

  it.each([
    ["tiny", "12021", "energy", "confused"],
    ["giant", "12023", "physical", "stunned"],
  ] as const)(
    "Wrist Gauntlets in %s use printed matching resources and defer exhaustion through canceled saved payment",
    (form, resource, symbol, status) => {
      let s = base();
      s.player.heroForm = form;
      const gauntlets = put(s, "12010"),
        [payCard] = hand(s, resource);
      s = command(s, {
        type: "ABILITY",
        id: gauntlets.id,
        action: "wrist-gauntlets",
      });
      if (s.prompt?.kind === "choice") s = choose(s, s.villain.id);
      expect(s.prompt?.kind).toBe("payment");
      expect(s.prompt?.requirements).toEqual([symbol, symbol]);
      expect(
        s.player.inPlay.find((p) => p.id === gauntlets.id)?.exhausted,
      ).toBe(false);
      s = command(reload(s), { type: "CANCEL" });
      expect(s.player.hand.map((p) => p.id)).toContain(payCard.id);
      expect(
        s.player.inPlay.find((p) => p.id === gauntlets.id)?.exhausted,
      ).toBe(false);
      s = command(s, {
        type: "ABILITY",
        id: gauntlets.id,
        action: "wrist-gauntlets",
      });
      if (s.prompt?.kind === "choice") s = choose(s, s.villain.id);
      s = command(reload(s), { type: "PAY", ids: [payCard.id] });
      expect(s.villain[status]).toBe(true);
      expect(
        s.player.inPlay.find((p) => p.id === gauntlets.id)?.exhausted,
      ).toBe(true);
      expect(s.player.discard.filter((p) => p.id === payCard.id)).toHaveLength(
        1,
      );
    },
  );

  it("Hive Mind counts controlled Army supports and obeys native Confused replacement", () => {
    let s = base();
    for (let i = 0; i < 3; i++) put(s, "12007");
    s.scheme.threat = 10;
    const h = hand(s, "12004", "12023");
    s = paid(s, h[0], [h[1].id]);
    s = target(s, "main");
    expect(s.scheme.threat).toBe(5);
    s.player.confused = true;
    s.player.confuseCards = 1;
    const h2 = hand(s, "12004", "12023");
    s = paid(s, h2[0], [h2[1].id]);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.confused).toBe(false);
    s.player.heroForm = "giant";
    const [wrong] = hand(s, "12004");
    expect(playable(s, wrong)).toBeTruthy();
  });

  it("Giant Stomp deals its two native attack packets and is unavailable in Tiny form", () => {
    let s = base();
    const [wrong] = hand(s, "12003");
    expect(playable(s, wrong)).toBeTruthy();
    s.player.heroForm = "giant";
    const enemy = minion(s, "12027"),
      h = hand(s, "12003", "12021", "12022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = target(s, s.villain.id);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(32);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Stunned replaces the entire paid Giant Stomp attack before either damage sentence", () => {
    let s = base();
    s.player.heroForm = "giant";
    s.player.stunned = true;
    s.player.stunCards = 1;
    const enemy = minion(s, "12027"),
      h = hand(s, "12003", "12021", "12022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(40);
    expect(s.player.stunned).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it.each([false, true])(
    "Giant Stomp resolves Retaliate once after the whole attack if its target survives: %s",
    (survives) => {
      let s = base();
      s.player.heroForm = "giant";
      const jacket = minion(s);
      if (survives) {
        // Two native HP modifiers let this fixture survive both attack packets.
        for (let i = 0; i < 2; i++) {
          const enhanced = makePiece(s, "01163");
          enhanced.attachedTo = jacket.id;
          s.attachments.push(enhanced);
        }
      }
      const h = hand(s, "12003", "12021", "12022");
      s = paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      );
      s = target(s, jacket.id);
      expect(s.player.hp).toBe(survives ? 11 : 12);
      expect(s.minions.find((p) => p.id === jacket.id)?.damage).toBe(
        survives ? 9 : undefined,
      );
    },
  );

  it("Giant Stomp removes a Guard in its first sentence before selecting the villain for eight damage", () => {
    let s = base();
    s.player.heroForm = "giant";
    const guard = minion(s, "01101");
    guard.damage = 2;
    const h = hand(s, "12003", "12021", "12022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = target(s, s.villain.id);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(false);
    expect(s.villain.hp).toBe(32);
  });

  it("Wasp's optional entrance response uses the current Tiny or Giant form", () => {
    let s = base();
    const h = hand(s, "12002", "12021", "12022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = respond(reload(s), /Wasp|remove 2 threat/i, "12002");
    s = target(s, "main");
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
  });

  it("Swarm Tactics requires Wasp, switches the actual hero form and readies without using the voluntary flip", () => {
    let s = base();
    let h = hand(s, "12020", "12021");
    expect(playable(s, h[0])).toBeTruthy();
    put(s, "12002");
    s.player.exhausted = true;
    h = hand(s, "12020", "12021");
    s = paid(s, h[0], [h[1].id]);
    s = skipAll(reload(s));
    expect(s.player).toMatchObject({
      heroForm: "giant",
      exhausted: false,
      flipped: false,
    });
  });

  it("Tech Theft blanks the Helmet text while it remains in play", () => {
    let s = base();
    put(s, "12008");
    const theft = makePiece(s, "12026");
    theft.counters = 2;
    s.sideSchemes.push(theft);
    s.player.hp = 5;
    s = command(s, { type: "FLIP", target: "giant" });
    expect(
      s.prompt?.options.some(
        (o) => o.image === "12008" || /Helmet/.test(o.label),
      ),
    ).toBe(false);
    s = skipAll(s);
    expect(s.player.hp).toBe(5);
    const gauntlets = put(s, "12010");
    hand(s, "12023");
    expect(
      dispatch(s, {
        type: "ABILITY",
        id: gauntlets.id,
        action: "wrist-gauntlets",
      }).error,
    ).toBeTruthy();
  });

  it("Yellowjacket's Plan reveals the exact discarded physical nemesis card and keeps skipped cards discarded", () => {
    let s = base();
    const skipped = makePiece(s, "01169"),
      jacket = makePiece(s, "12027"),
      rest = makePiece(s, "01170");
    s.encounter.deck = [skipped, jacket, rest];
    s = reveal(reload(s), "12029");
    expect(s.minions.find((p) => p.id === jacket.id)?.code).toBe("12027");
    expect(s.encounter.discard.some((p) => p.id === skipped.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === jacket.id)).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([rest.id]);
  });

  it("Size Increase attaches to Yellowjacket first, initializes three counters and falls back to villain", () => {
    let s = base();
    const jacket = minion(s);
    s = reveal(s, "12028");
    expect(s.attachments[0]).toMatchObject({
      code: "12028",
      attachedTo: jacket.id,
      counters: 3,
    });
    s.minions = [];
    s = reveal(reload(s), "12028");
    expect(s.attachments[1]).toMatchObject({
      attachedTo: s.villain.id,
      counters: 3,
    });
  });

  it("Yellowjacket gains Tiny attack or Giant retaliation from its engaged player's current form", () => {
    let s = base();
    const jacket = minion(s);
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: jacket.id });
    s = choose(s, "take");
    expect(s.player.hp).toBe(hp - 3);
    s.player.heroForm = "giant";
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, jacket.id);
    expect(s.minions.find((p) => p.id === jacket.id)?.damage).toBe(3);
    expect(s.player.hp).toBe(hp - 4);
  });

  it("Size Increase boosts real activations and uses each of its three counters before discarding", () => {
    let s = base();
    s.player.heroForm = "giant";
    const jacket = minion(s);
    s = reveal(s, "12028");
    const increaseId = s.attachments[0].id;
    for (let i = 0; i < 3; i++) {
      const blocker = put(s, ["12002", "12013", "01041"][i]);
      s = native(reload(s), { type: "enemyAttack", id: jacket.id });
      expect(s.attack?.base).toBe(4);
      s = choose(s, blocker.id);
      expect(s.player.inPlay.some((p) => p.id === blocker.id)).toBe(false);
      if (i < 2)
        expect(s.attachments.find((p) => p.id === increaseId)?.counters).toBe(
          2 - i,
        );
    }
    expect(s.attachments.some((p) => p.id === increaseId)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === increaseId)).toHaveLength(
      1,
    );
    expect(s.player.hp).toBe(12);
  });

  it("Care for Cassie preserves its physical obligation through a saved optional flip and removes it after exhausting Scott", () => {
    let s = base();
    const obligation = makePiece(s, "12025");
    s.player.hp = 6;
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(reload(s), "flip");
    s = respond(s, /Time to Unwind/);
    expect(s.player.hp).toBe(7);
    s = choose(reload(s), "remove");
    expect(s.player).toMatchObject({
      form: "alter",
      exhausted: true,
      flipped: false,
    });
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(false);
  });

  it("Care for Cassie discards the chosen physical hand card and blocks both voluntary and Resize changes", () => {
    let s = base();
    const h = hand(s, "12005", "12021");
    s = reveal(s, "12025");
    s = choose(s, "stay");
    s = choose(reload(s), "discard");
    s = choose(reload(s), h[1].id);
    expect(s.player.discard.filter((p) => p.id === h[1].id)).toHaveLength(1);
    expect(dispatch(s, { type: "FLIP", target: "giant" }).error).toBeTruthy();
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === h[0].id)!,
      ),
    ).toBeTruthy();
    expect(s.encounter.discard.filter((p) => p.code === "12025")).toHaveLength(
      1,
    );
  });

  it("Hank Pym's actual overpaid resources set his HP and preserve the physical ally", () => {
    let s = base();
    const h = hand(s, "12011", "12021", "12022");
    expect(playable(s, h[0])).toBeNull();
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [h[1].id, h[2].id] });
    s = skipAll(s);
    const hank = s.player.inPlay.find((p) => p.id === h[0].id)!;
    expect(hank).toBeTruthy();
    expect(hank.counters).toBe(4);
    expect(pieceHP(s, hank)).toBe(4);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      [h[1].id, h[2].id].sort(),
    );
  });

  it("Giant-Man's remaining HP and Ronin's actual attachment affect real basic attacks", () => {
    let s = base();
    const giant = put(s, "12012");
    s = command(s, { type: "ABILITY", id: giant.id, action: "attack" });
    expect(s.villain.hp).toBe(36);
    const updated = s.player.inPlay.find((p) => p.id === giant.id)!;
    updated.exhausted = false;
    updated.damage = 2;
    s = command(s, { type: "ABILITY", id: giant.id, action: "attack" });
    expect(s.villain.hp).toBe(34);
    const ronin = put(s, "12013"),
      suit = put(s, "12018");
    suit.attachedTo = ronin.id;
    expect(pieceHP(s, ronin)).toBe(5);
    s = command(s, { type: "ABILITY", id: ronin.id, action: "attack" });
    expect(s.villain.hp).toBe(31);
  });

  it("Stinger requires the identity's live Avenger trait and is excluded from the controlled ally limit", () => {
    let s = base();
    s.player.form = "alter";
    let h = hand(s, "12014", "12021");
    expect(playable(s, h[0])).toBeTruthy();
    s.player.form = "hero";
    for (const code of ["01041", "01050", "01051"]) put(s, code);
    h = hand(s, "12014", "12021");
    s = paid(s, h[0], [h[1].id]);
    expect(s.prompt).toBeNull();
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(4);
  });

  it("Call for Aid returns the first physical Avenger ally after discarding intervening cards", () => {
    let s = base();
    const discarded = makePiece(s, "12009"),
      ronin = makePiece(s, "12013"),
      rest = makePiece(s, "12021");
    s.player.deck = [discarded, ronin, rest];
    const [event] = hand(s, "12015");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.player.hand.map((p) => p.id)).toEqual([ronin.id]);
    expect(s.player.discard.map((p) => p.id)).toContain(discarded.id);
    expect(s.player.deck.map((p) => p.id)).toEqual([rest.id]);
  });

  it("Moxie is only playable from the form-response window and its three bonuses last through the round", () => {
    let s = base();
    const [moxie] = hand(s, "12016");
    expect(playable(s, moxie)).toBeTruthy();
    s = command(s, { type: "FLIP", target: "giant" });
    s = respond(s, /Moxie/i, "12016");
    s = skipAll(s);
    expect(heroStats(s)).toMatchObject({ attack: 4, thwart: 2, defense: 4 });
    expect(s.player.discard.filter((p) => p.id === moxie.id)).toHaveLength(1);
    s = native(reload(s), { type: "newRound" });
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 1, defense: 3 });
  });

  it("Lay Down the Law uses the actual mental resource paid", () => {
    let s = base();
    s.scheme.threat = 7;
    const h = hand(s, "12031", "12022");
    expect(playable(s, h[0])).toBeTruthy();
    s = command(s, { type: "FLIP", target: "giant" });
    s = respond(s, /Lay Down the Law/i, "12031");
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = target(s, "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(3);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Confused replaces Lay Down the Law's paid response thwart and consumes exactly that status", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    const h = hand(s, "12031", "12022");
    s = command(s, { type: "FLIP", target: "giant" });
    s = respond(s, /Lay Down the Law/);
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = target(s, "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.confused).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Moment of Triumph heals the actual excess damage from a native attack defeat", () => {
    let s = base();
    s.player.heroForm = "giant";
    s.player.hp = 4;
    const enemy = minion(s, "12027");
    enemy.damage = pieceHP(s, enemy) - 1;
    const [triumph] = hand(s, "12030");
    expect(playable(s, triumph)).toBeTruthy();
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, enemy.id);
    s = respond(reload(s), /Moment of Triumph/i, "12030");
    s = skipAll(s);
    expect(s.player.hp).toBe(6);
    expect(s.player.discard.filter((p) => p.id === triumph.id)).toHaveLength(1);
  });

  it("Power Gloves optional response deals one damage after its attached Avenger attacks", () => {
    let s = base();
    const ronin = put(s, "12013"),
      gloves = put(s, "12017");
    gloves.attachedTo = ronin.id;
    s = command(s, { type: "ABILITY", id: ronin.id, action: "attack" });
    expect(s.villain.hp).toBe(37);
    s = respond(reload(s), /Power Gloves/i, "12017");
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(36);
    expect(s.player.inPlay.find((p) => p.id === ronin.id)?.damage).toBe(1);
  });

  it("Team-Building Exercise checks current hero traits and applies its reduction to the chosen physical card", () => {
    let s = base();
    const exercise = put(s, "12024"),
      h = hand(s, "12007", "12009");
    s = command(s, {
      type: "ABILITY",
      id: exercise.id,
      action: "team-building",
    });
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === h[1].id)).toBe(false);
    s = choose(reload(s), h[0].id);
    expect(s.player.inPlay.find((p) => p.id === exercise.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id]);
  });

  it("Team-Building Exercise grants its native immediate card play during a teammate's turn", () => {
    let s = base(true);
    s.turnPlayerId = "p2";
    const exercise = put(s, "12024"),
      h = hand(s, "12013", "12021");
    s = command(s, {
      type: "ABILITY",
      id: exercise.id,
      action: "team-building",
      playerId: "p1",
    });
    s = choose(reload(s), h[0].id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(2);
    expect(s.prompt?.cancelable).toBe(false);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === exercise.id)
        ?.exhausted,
    ).toBe(true);
    const canceled = dispatch(reload(s), { type: "CANCEL" });
    expect(canceled.error).toBe("This decision cannot be canceled.");
    expect(canceled.prompt).toEqual(s.prompt);
    expect(
      seatView(canceled, "p1").player.inPlay.find((p) => p.id === exercise.id)
        ?.exhausted,
    ).toBe(true);
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === exercise.id)
        ?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === h[0].id)).toBe(
      true,
    );
    expect(s.turnPlayerId).toBe("p2");
  });

  it("Gauntlets exhaustion is paid atomically before optional responses to two spent Pym cards", () => {
    let s = base();
    s.player.heroForm = "giant";
    s.player.hp = 4;
    const gauntlets = put(s, "12010"),
      h = hand(s, "12006", "12006");
    s = command(s, {
      type: "ABILITY",
      id: gauntlets.id,
      action: "wrist-gauntlets",
    });
    s = target(s, s.villain.id);
    s = command(reload(s), {
      type: "PAY",
      ids: h.map((p) => p.id),
      wildAs: "physical",
    });
    expect(s.player.inPlay.find((p) => p.id === gauntlets.id)?.exhausted).toBe(
      true,
    );
    expect(
      s.player.discard.filter((p) => h.some((x) => x.id === p.id)),
    ).toHaveLength(2);
    for (let i = 0; i < 2; i++) s = respond(reload(s), /Pym Particles/);
    expect(s.player.hp).toBe(8);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === gauntlets.id)?.exhausted).toBe(
      true,
    );
  });

  it("Muster Courage uses the villain stage and allows up to that many friendly Tough recipients", () => {
    let s = base();
    const ally = put(s, "12013"),
      h = hand(s, "12032", "12021", "12022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.prompt?.kind).toBe("choice");
    s = choose(s, ally.id);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(true);
    expect(s.player.tough).toBe(false);
    expect(s.prompt).toBeNull();
  });

  it("Assess the Situation increases the current form's hand size and expires at the phase boundary", () => {
    let s = base();
    const [event] = hand(s, "12033");
    s = command(s, { type: "PLAY", id: event.id });
    expect(handSize(s)).toBe(6);
    s.player.heroForm = "giant";
    expect(handSize(s)).toBe(5);
    s = native(reload(s), { type: "beginVillain" });
    expect(handSize(s)).toBe(4);
  });
});

describe("Tech Theft uses the existing native engines' live blanking boundary", () => {
  it("removes Web-Shooter resources without removing printed resource icons or Tech traits", () => {
    const s = otherHero("spider_man"),
      shooter = put(s, "01008");
    shooter.counters = 3;
    expect(paymentSources(s).map((p) => p.id)).toContain(shooter.id);
    theft(s);
    expect(paymentSources(s).map((p) => p.id)).not.toContain(shooter.id);
    expect(card(shooter).traits).toContain("Tech.");
    expect(card(shooter).resource_physical).toBe(1);
  });

  it("blanks and restores Mark V Armor's printed HP while Iron Man still counts its Tech trait for hand size", () => {
    let s = otherHero("iron_man");
    put(s, "01036");
    expect(maxHP(s)).toBe(15);
    expect(handSize(s)).toBe(2);
    const scheme = theft(s);
    expect(maxHP(s)).toBe(9);
    expect(handSize(s)).toBe(2);
    s = native(reload(s), { type: "discardPiece", id: scheme.id });
    expect(maxHP(s)).toBe(15);
  });

  it("removes Energy Barrier's damage prevention window while leaving its counters untouched", () => {
    let s = otherHero("ms_marvel");
    const barrier = put(s, "05017");
    barrier.counters = 3;
    theft(s);
    const hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 2,
      source: "Fixture",
    });
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.inPlay.find((p) => p.id === barrier.id)?.counters).toBe(3);
  });

  it("preserves Electrostatic Armor without Tech while blanking both new attached Tech effects", () => {
    let s = base();
    const armor = put(s, "10031"),
      ronin = put(s, "12013"),
      gloves = put(s, "12017"),
      suit = put(s, "12018");
    gloves.attachedTo = suit.attachedTo = ronin.id;
    theft(s);
    expect(pieceHP(s, ronin)).toBe(3);
    s.encounter.deck = [makePiece(s, "12033"), makePiece(s, "12033")];
    const hp = s.villain.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    expect(s.prompt?.options.some((o) => o.id === armor.id)).toBe(true);
    s = choose(s, armor.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(hp - 1);
    s = command(s, { type: "ABILITY", id: ronin.id, action: "attack" });
    expect(s.villain.hp).toBe(hp - 4);
    expect(s.prompt).toBeNull();
  });
});
