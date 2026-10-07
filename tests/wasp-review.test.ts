import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { card, pieceHP } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Command, Effect, GameState } from "../src/game/types.js";

function run(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
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
function decline(s: GameState) {
  for (let n = 0; s.prompt && n < 30; n++) {
    const option = s.prompt.options.find(
      (o) =>
        /^(skip|pass|none|done|continue|no)$/.test(o.id) ||
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
function use(s: GameState, name: RegExp, code?: string) {
  const option =
    s.prompt?.options.find(
      (o) => name.test(o.label) || (code && o.image === code),
    ) ||
    (s.prompt && name.test(s.prompt.title)
      ? s.prompt.options.find((o) => o.id === "yes")
      : undefined);
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, option!.id);
}
function base(team = false, waspSecond = false) {
  let s = newGame({
    heroId: "wsp",
    aspect: "aggression",
    villainId: "rhino",
    seed: 13028,
    pacing: "expert",
    ...(team
      ? {
          heroes: waspSecond
            ? [
                { heroId: "spider_man", aspect: "justice" as const },
                { heroId: "wsp", aspect: "aggression" as const },
              ]
            : [
                { heroId: "wsp", aspect: "aggression" as const },
                { heroId: "spider_man", aspect: "justice" as const },
              ],
        }
      : {}),
  });
  s = run(s, { type: "MULLIGAN", ids: [] });
  if (team) s = run(s, { type: "MULLIGAN", ids: [] });
  for (const player of s.players) {
    const view = seatView(s, player);
    view.player.form = "hero";
    if (view.heroId === "wsp") view.player.heroForm = "tiny";
    view.player.exhausted = false;
    view.player.flipped = false;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.deck = Array.from({ length: 10 }, () => makePiece(s, "13021"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 8;
  s.villain.hp = s.villain.maxHp = 40;
  s.encounter.discard = [];
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Review fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code = "01101", playerId = s.activePlayerId) {
  const piece = makePiece(s, code);
  piece.engagedWith = playerId;
  s.minions.push(piece);
  return piece;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}

describe("independent Wasp rules review regressions", () => {
  it("applies the exact published Beetle errata without changing the imported printing", () => {
    const original = catalog.find((c) => c.code === "13028")!;
    expect(original.text).toContain(
      "When Beetle is defeated, choose to either",
    );
    expect(card("13028").text).toContain(
      "When Beetle is defeated, the defeating player chooses to either",
    );
    expect(card("13028").errata?.reference).toBe(
      "FFG Rules Reference 1.8, p. 66",
    );
  });

  it("Into the Fray's non-thwart excess removal remains blocked by Crisis", () => {
    let s = base();
    const crisis = makePiece(s, "01108");
    crisis.counters = 2;
    expect(card(crisis).scheme_crisis).toBeTruthy();
    s.sideSchemes.push(crisis);
    const enemy = minion(s);
    const cards = hand(s, "13013", "13021", "13022");
    s = run(s, { type: "PLAY", id: cards[0].id });
    s = run(saved(s), { type: "PAY", ids: cards.slice(1).map((p) => p.id) });
    s = target(s, enemy.id);
    s = decline(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.scheme.threat).toBe(8);
  });

  it("Tough prevents damage before Tiny Bio-Synthetic Wings can interrupt taking it", () => {
    let s = base();
    const wings = makePiece(s, "13009");
    s.player.inPlay.push(wings);
    s.player.tough = true;
    s.player.toughCards = 1;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "Review fixture",
    });
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.find((p) => p.id === wings.id)?.exhausted).toBe(
      false,
    );
    expect(s.prompt).toBeNull();
  });

  it("a Tiny identity upgrade defeat can trigger Small but Mighty after its discard cost", () => {
    let s = base();
    const trap = makePiece(s, "13017");
    trap.ownerId = s.activePlayerId;
    s.player.inPlay.push(trap);
    const enemy = makePiece(s, "01101");
    expect(pieceHP(s, enemy)).toBe(3);
    s = native(s, { type: "reveal", piece: enemy, skip: true });
    s = use(s, /Lie in Wait/i, "13017");
    expect(s.player.discard.some((p) => p.id === trap.id)).toBe(true);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    s = use(s, /Small but Mighty/i, "13001a");
    s = decline(s);
    expect(s.villain.hp).toBe(39);
  });

  it.each([
    { form: "giant" as const, lock: false, damage: 4 },
    { form: "tiny" as const, lock: true, damage: 3 },
  ])(
    "Rapid Growth boosts a basic power in $form even if its form change cannot occur",
    ({ form, lock, damage }) => {
      let s = base();
      s.player.heroForm = form;
      if (lock) {
        const tied = makePiece(s, "02048");
        tied.attachedTo = `hero:${s.activePlayerId}`;
        s.attachments.push(tied);
      }
      const cards = hand(s, "13005", "13023");
      s = run(s, { type: "BASIC", action: "attack" });
      s = use(s, /Rapid Growth/i, "13005");
      s = run(saved(s), { type: "PAY", ids: [cards[1].id] });
      s = target(s, s.villain.id);
      s = decline(s);
      expect(s.player.heroForm).toBe(form);
      expect(s.villain.hp).toBe(40 - damage);
      expect(s.player.discard.some((p) => p.id === cards[0].id)).toBe(true);
      expect(s.player.flipped).toBe(false);
    },
  );

  it.each([
    { power: "attack" as const, status: "stunned" as const },
    { power: "thwart" as const, status: "confused" as const },
  ])(
    "a $status basic $power is replaced before Rapid Growth can be offered",
    ({ power, status }) => {
      let s = base();
      const cards = hand(s, "13005", "13023");
      s.player[status] = true;
      if (status === "stunned") s.player.stunCards = 1;
      else s.player.confuseCards = 1;
      s = run(s, { type: "BASIC", action: power });
      expect(s.player[status]).toBe(false);
      expect(s.player.exhausted).toBe(true);
      expect(s.player.heroForm).toBe("tiny");
      expect(s.player.hand.map((p) => p.id)).toEqual(cards.map((p) => p.id));
      expect(s.villain.hp).toBe(40);
      expect(s.scheme.threat).toBe(8);
      expect(s.prompt).toBeNull();
    },
  );

  it("Beetle's interrupt is paid by the defeating teammate, not the engaged player", () => {
    let s = base(true);
    const enemy = minion(s, "13028", "p1");
    enemy.damage = pieceHP(s, enemy) - 2;
    const resource = makePiece(s, "13023");
    resource.ownerId = "p2";
    seatView(s, "p2").player.hand.push(resource);
    s.turnPlayerId = "p2";
    activateSeat(s, "p2");
    s = run(s, { type: "BASIC", action: "attack" });
    s = target(s, enemy.id);
    expect(s.prompt?.title).toBe("Beetle");
    s = choose(s, "pay");
    expect(s.prompt?.kind).toBe("payment");
    s = run(saved(s), { type: "PAY", ids: [resource.id] });
    s = decline(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === enemy.id)).toHaveLength(
      1,
    );
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === resource.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === resource.id),
    ).toBe(false);
    expect(s.villain.hp).toBe(40);
  });

  it("a teammate's Hero Action event during Wasp's turn never becomes Wasp's defeat", () => {
    let s = base(true);
    const enemy = minion(s);
    const cards = ["13013", "13021", "13022"].map((code) => {
      const p = makePiece(s, code);
      p.ownerId = "p2";
      return p;
    });
    seatView(s, "p2").player.hand.push(...cards);
    s = run(s, { type: "PLAY", id: cards[0].id, playerId: "p2" });
    s = run(saved(s), { type: "PAY", ids: cards.slice(1).map((p) => p.id) });
    s = target(s, enemy.id);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.prompt).toBeNull();
    expect(s.activePlayerId).toBe("p1");
    expect(s.villain.hp).toBe(40);
    expect(
      seatView(s, "p2")
        .player.discard.map((p) => p.id)
        .sort(),
    ).toEqual(cards.map((p) => p.id).sort());
    expect(seatView(s, "p1").player.discard).toEqual([]);
  });

  it("shuffled Beetle keeps its one physical card but loses all in-play memory and attachments", () => {
    let s = base();
    const enemy = minion(s, "13028");
    const armor = makePiece(s, "13029");
    armor.attachedTo = enemy.id;
    s.attachments.push(armor);
    enemy.damage = pieceHP(s, enemy) - 1;
    enemy.exhausted = true;
    enemy.confused = true;
    enemy.confuseCards = 1;
    enemy.counters = 2;
    s = run(s, { type: "BASIC", action: "attack" });
    s = target(s, enemy.id);
    expect(s.prompt?.title).toBe("Beetle");
    s = choose(s, "shuffle");
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.deck.filter((p) => p.id === enemy.id)).toHaveLength(1);
    expect(s.encounter.deck.find((p) => p.id === enemy.id)).toMatchObject({
      damage: 0,
      counters: 0,
      exhausted: false,
      confused: false,
    });
    expect(
      s.encounter.deck.find((p) => p.id === enemy.id)?.engagedWith,
    ).toBeUndefined();
    expect(s.encounter.discard.filter((p) => p.id === armor.id)).toHaveLength(
      1,
    );
    s = use(s, /Small but Mighty/i, "13001a");
    s = decline(s);
    expect(s.villain.hp).toBe(39);
  });

  it.each(["stunned", "webbed"] as const)(
    "Beetle Mania gains Surge when %s replaces its attack",
    (status) => {
      let s = base();
      const enemy = minion(s, "13028");
      let webId: string | undefined;
      if (status === "stunned") {
        enemy.stunned = true;
        enemy.stunCards = 1;
      } else {
        const web = makePiece(s, "01009");
        web.ownerId = s.activePlayerId;
        web.attachedTo = enemy.id;
        webId = web.id;
        s.player.inPlay.push(web);
      }
      const next = makePiece(s, "01108");
      s.encounter.deck = [next, makePiece(s, "01101")];
      s = native(s, {
        type: "reveal",
        piece: makePiece(s, "13030"),
        skip: true,
      });
      expect(s.encounter.dealt.some((p) => p.id === next.id)).toBe(true);
      expect(s.player.hp).toBe(11);
      expect(s.attack).toBeNull();
      expect(s.minions.find((p) => p.id === enemy.id)?.stunned).toBe(
        status === "webbed",
      );
      if (webId)
        expect(s.player.discard.some((p) => p.id === webId)).toBe(true);
      expect(s.prompt).toBeNull();
    },
  );

  it("Beetle Armor's villain hit points persist across a same-character stage advance", () => {
    let s = base();
    const armor = makePiece(s, "13029");
    armor.attachedTo = s.villain.id;
    s.attachments.push(armor);
    s.villain.maxHp = card(s.villain).health! + 4;
    s.villain.hp = 1;
    s = native(s, {
      type: "damage",
      target: s.villain.id,
      amount: 1,
      source: "hero",
    });
    s = decline(s);
    expect(s.villain.stage).toBe(2);
    expect(s.attachments.find((p) => p.id === armor.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.villain.maxHp).toBe(card(s.villain).health! + 4);
    expect(s.villain.hp).toBe(s.villain.maxHp);
  });

  it("a split attack places every packet before Beetle's forced defeat interrupt and later retaliate", () => {
    let s = base();
    s.player.heroForm = "giant";
    const beetle = minion(s, "13028");
    beetle.damage = pieceHP(s, beetle) - 1;
    const retaliator = minion(s, "12027");
    expect(card(retaliator).text).toContain("retaliate 1");
    s = run(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${beetle.id}:1`);
    expect(s.prompt?.title).toBe("Beetle");
    expect(s.minions.find((p) => p.id === retaliator.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === beetle.id)?.pendingDefeat).toBe(true);
    expect(s.player.hp).toBe(11);
    s = choose(s, "shuffle");
    s = decline(s);
    expect(s.player.hp).toBe(10);
    expect(s.minions.find((p) => p.id === retaliator.id)?.damage).toBe(1);
  });

  it("Mother's Orders exhausts Wasp with resource payment before the spent Pym Particles response", () => {
    let s = base();
    const orders = makePiece(s, "13027");
    orders.counters = 2;
    s.sideSchemes.push(orders);
    const cards = hand(s, "13007");
    s = run(s, { type: "BASIC", action: "attack" });
    expect(s.player.exhausted).toBe(false);
    s = run(saved(s), { type: "PAY", ids: [cards[0].id] });
    expect(s.prompt?.title).toBe("Pym Particles");
    expect(s.player.exhausted).toBe(true);
    s = use(s, /Pym Particles/i, "13007");
    s = target(s, s.villain.id);
    s = decline(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(1);
    expect(s.villain.hp).toBe(39);
  });

  it("Wasp as second player chooses her divided attack's retaliate order and receives both packets", () => {
    let s = base(true, true);
    s.turnPlayerId = "p2";
    activateSeat(s, "p2");
    s.player.heroForm = "giant";
    const first = minion(s, "01172", "p2");
    const second = minion(s, "01184", "p2");
    const teammateHp = seatView(s, "p1").player.hp;
    s = run(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${first.id}:1`);
    s = choose(s, `${second.id}:1`);
    expect(s.minions.find((p) => p.id === first.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === second.id)?.damage).toBe(1);
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.activePlayerId).toBe("p2");
    const modok = s.prompt!.options.find((o) => o.label.includes("M.O.D.O.K."));
    expect(modok).toBeTruthy();
    s = choose(s, modok!.id);
    s = decline(s);
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(seatView(s, "p1").player.hp).toBe(teammateHp);
  });

  it("Mean Swing's paid weapon exhaustion adds three to Wasp's actual basic attack", () => {
    let s = base();
    const weapon = makePiece(s, "06019");
    weapon.ownerId = s.activePlayerId;
    s.player.inPlay.push(weapon);
    const cards = hand(s, "06015");
    s = run(s, { type: "BASIC", action: "attack" });
    s = use(s, /Mean Swing/i, "06015");
    s = target(s, weapon.id);
    s = decline(s);
    expect(s.player.inPlay.find((p) => p.id === weapon.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.some((p) => p.id === cards[0].id)).toBe(true);
    expect(s.villain.hp).toBe(36);
  });

  it("Interrogation Room's own side-scheme defeat does not create a second identity response", () => {
    let s = base();
    s.scheme.threat = 0;
    const room = makePiece(s, "01063");
    room.ownerId = s.activePlayerId;
    s.player.inPlay.push(room);
    const scheme = makePiece(s, "01107");
    scheme.counters = 1;
    s.sideSchemes.push(scheme);
    const enemy = minion(s);
    enemy.damage = pieceHP(s, enemy) - 1;
    s = target(run(s, { type: "BASIC", action: "attack" }), enemy.id);
    let mightyResponses = 0;
    let usedRoom = false;
    for (let n = 0; s.prompt && n < 12; n++) {
      if (s.prompt.title === "Interrogation Room") {
        usedRoom = true;
        s = use(s, /Interrogation Room/i, "01063");
      } else {
        expect(s.prompt.title).toBe("Small but Mighty");
        mightyResponses++;
        s = choose(s, "skip");
      }
    }
    expect(usedRoom).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(mightyResponses).toBe(1);
    expect(s.villain.hp).toBe(40);
    expect(s.prompt).toBeNull();
  });

  it.each([
    { code: "03002", name: "Agent 13", threat: 2 },
    { code: "03011", name: "Falcon", threat: 1 },
    { code: "04045", name: "Spider-Man", threat: 3 },
  ])(
    "$name's entry side-scheme defeat belongs to the ally rather than Tiny Wasp",
    ({ code, name, threat }) => {
      let s = base();
      s.scheme.threat = 0;
      const ally = makePiece(s, code);
      ally.ownerId = s.activePlayerId;
      s.player.inPlay.push(ally);
      const scheme = makePiece(s, "01107");
      scheme.counters = threat;
      s.sideSchemes.push(scheme);
      if (code === "03011")
        s.encounter.deck = [
          makePiece(s, "01104"),
          makePiece(s, "01101"),
          makePiece(s, "01101"),
        ];
      s = native(s, { type: "allyEnter", id: ally.id, fromHand: true });
      s = use(s, new RegExp(name), code);
      if (s.prompt?.title === "Falcon · encounter preview")
        s = choose(s, "continue");
      s = target(s, scheme.id);
      expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
      expect(s.villain.hp).toBe(40);
      expect(s.prompt).toBeNull();
    },
  );
});
