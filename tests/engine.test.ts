import { describe, expect, it } from "vitest";
import {
  CARDS,
  HEROES,
  VILLAINS,
  ASPECTS,
  DB,
  card,
  deckCodes,
  maxHP,
  handSize,
  pieceHP,
} from "../src/game/cards";
import {
  newGame,
  dispatch,
  makePiece,
  paymentSources,
  playable,
} from "../src/game/engine";
import type { GameState, Resource, Piece } from "../src/game/types";
import { heroRequiredCards } from "../src/game/hero-runtime";
function base(
  heroId = "spider_man",
  villainId = "rhino",
  aspect: any = "justice",
): GameState {
  let s = newGame({ heroId, villainId, aspect, seed: 12345 });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  return settle(s);
}
function payIds(s: GameState) {
  const p = s.prompt!;
  const sources = paymentSources(s, p.card?.id, p.paymentTarget);
  const req = [...(p.requirements || [])];
  const ids: string[] = [];
  const pool: Resource[] = [];
  for (const r of req) {
    let i = pool.indexOf(r);
    if (i < 0) i = pool.indexOf("wild");
    if (i >= 0) {
      pool.splice(i, 1);
      continue;
    }
    const src = sources.find(
      (x) =>
        !ids.includes(x.id) &&
        (x.resources.includes(r) || x.resources.includes("wild")),
    );
    if (!src) return null;
    ids.push(src.id);
    pool.push(...src.resources);
    i = pool.indexOf(r);
    if (i < 0) i = pool.indexOf("wild");
    pool.splice(i, 1);
  }
  let total = ids.reduce(
    (n, id) => n + sources.find((x) => x.id === id)!.resources.length,
    0,
  );
  for (const src of sources) {
    if (total >= (p.cost || 0)) break;
    if (!ids.includes(src.id)) {
      ids.push(src.id);
      total += src.resources.length;
    }
  }
  return total >= (p.cost || 0) ? ids : null;
}
function settle(input: GameState, max = 200) {
  let s = input;
  let n = 0;
  while (s.prompt && n++ < max) {
    const p = s.prompt;
    let next: GameState;
    if (p.kind === "payment") {
      const ids = payIds(s);
      if (!ids) {
        if (p.cancelable) return dispatch(s, { type: "CANCEL" });
        throw Error(`Cannot pay mandatory prompt ${p.title}`);
      }
      next = dispatch(s, {
        type: "PAY",
        ids,
        wildAs: p.requirements?.[0] || "energy",
      });
    } else if (p.kind === "select") {
      next = dispatch(s, {
        type: "SELECT",
        ids: p.options.slice(0, p.min || 0).map((o) => o.id),
      });
    } else {
      const opt =
        p.options.find((o) =>
          [
            "resolve",
            "allow",
            "take",
            "skip",
            "pass",
            "threat",
            "exhaust",
          ].includes(o.id),
        ) || p.options[0];
      next = dispatch(s, { type: "CHOOSE", id: opt.id });
    }
    if (next.error) throw Error(`${p.title}: ${next.error}`);
    s = next;
  }
  if (n >= max) throw Error("Prompt loop");
  return s;
}
function putHand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((c) => makePiece(s, c));
}
function enough(s: GameState, code: string) {
  putHand(s, code, ...Array(8).fill("01044"));
  s.player.form = "hero";
  s.player.hp = 5;
  s.scheme.threat = 3;
}
function withMinion(s: GameState, code = "01101") {
  const p = makePiece(s, code);
  s.minions.push(p);
  return p;
}
function withSupport(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.inPlay.push(p);
  return p;
}
function encounterFixture(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.queue = [{ type: "reveal", piece: p }];
  s.prompt = {
    kind: "choice",
    title: "fixture",
    text: "",
    options: [{ id: "go", label: "go", effects: [] }],
  };
  return dispatch(s, { type: "CHOOSE", id: "go" });
}
describe("core set and setup", () => {
  it("contains all 209 distinct card faces", () =>
    expect(CARDS).toHaveLength(209));
  for (const h of HEROES)
    for (const a of ASPECTS)
      it(`${h.name} / ${a.name} has a legal 40-card starter deck`, () => {
        const codes = deckCodes(h.id, a.id);
        expect(codes).toHaveLength(40);
        const required = heroRequiredCards(h.id);
        const signatureCodes = codes.filter((code) =>
          Object.hasOwn(required, code),
        );
        expect(signatureCodes).toHaveLength(
          Object.values(required).reduce((total, count) => total + count, 0),
        );
        for (const [code, quantity] of Object.entries(required))
          expect(codes.filter((candidate) => candidate === code)).toHaveLength(
            quantity,
          );
        const counts: Record<string, number> = {};
        for (const c of codes)
          counts[card(c).name] = (counts[card(c).name] || 0) + 1;
        for (const c of new Set(codes)) {
          if (card(c).name !== "Wakanda Forever!")
            expect(counts[card(c).name]).toBeLessThanOrEqual(
              card(c).deck_limit || 3,
            );
        }
      });
  it("uses a deterministic shuffle", () =>
    expect(
      newGame({
        heroId: "spider_man",
        villainId: "rhino",
        aspect: "justice",
        seed: 9,
      }),
    ).toEqual(
      newGame({
        heroId: "spider_man",
        villainId: "rhino",
        aspect: "justice",
        seed: 9,
      }),
    ));
  it("mulligans without redrawing the discarded instances", () => {
    let s = newGame({
      heroId: "spider_man",
      villainId: "rhino",
      aspect: "justice",
      seed: 9,
    });
    const ids = s.player.hand.slice(0, 3).map((p) => p.id);
    s = dispatch(s, { type: "MULLIGAN", ids });
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.discard.map((p) => p.id)).toEqual(ids);
    expect(s.player.hand.some((p) => ids.includes(p.id))).toBe(false);
  });
  it("uses 31 encounter cards for Spider-Man vs Rhino with Bomb Scare", () =>
    expect(
      newGame({ heroId: "spider_man", villainId: "rhino", aspect: "justice" })
        .encounter.deck,
    ).toHaveLength(31));
  it("Klaw starts with Defense Network and a minion", () => {
    const s = base("spider_man", "klaw");
    expect(s.minions.length).toBeGreaterThan(0);
    expect(s.sideSchemes.some((p) => p.code === "01125")).toBe(true);
  });
  it("Ultron creates a drone from the player deck", () => {
    const s = base("spider_man", "ultron");
    expect(s.minions[0].code).toBe("drone");
    expect(s.player.deck).toHaveLength(33);
  });
  it("expert uses stages II and III and adds the expert encounter set", () => {
    let s = newGame({
      heroId: "spider_man",
      villainId: "rhino",
      aspect: "justice",
      difficulty: "expert",
    });
    expect(s.encounter.deck).toHaveLength(34);
    s = settle(dispatch(s, { type: "MULLIGAN", ids: [] }));
    expect(s.villain.stage).toBe(2);
    expect(s.sideSchemes.some((p) => p.code === "01107")).toBe(true);
  });
});
describe("player actions and costs", () => {
  it("can only change form once per turn", () => {
    let s = base();
    s = dispatch(s, { type: "FLIP" });
    expect(s.player.form).toBe("hero");
    const next = dispatch(s, { type: "FLIP" });
    expect(next.error).toMatch(/already/);
    expect(next.player.form).toBe("hero");
  });
  it("blocks attacks in alter-ego and recovery in hero form", () => {
    let s = base();
    expect(dispatch(s, { type: "BASIC", action: "attack" }).error).toBeTruthy();
    s = dispatch(s, { type: "FLIP" });
    expect(
      dispatch(s, { type: "BASIC", action: "recover" }).error,
    ).toBeTruthy();
  });
  it("exhausts when attacking and prevents a second basic action", () => {
    let s = base();
    s.player.form = "hero";
    s = settle(dispatch(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(12);
    expect(s.player.exhausted).toBe(true);
    expect(dispatch(s, { type: "BASIC", action: "attack" }).error).toBeTruthy();
  });
  it("pays exactly selected cards and deals 8 damage", () => {
    let s = base();
    s.player.form = "hero";
    putHand(s, "01005", "01089", "01087", "01006");
    const [kick, genius, haymaker] = s.player.hand;
    s = dispatch(s, { type: "PLAY", id: kick.id });
    expect(s.prompt?.cost).toBe(3);
    s = dispatch(s, { type: "PAY", ids: [genius.id, haymaker.id] });
    expect(s.error).toBeUndefined();
    expect(s.villain.hp).toBe(6);
    expect(s.player.hand.map((p) => p.code)).toEqual(["01006"]);
    expect(s.player.discard).toHaveLength(3);
  });
  it("rejects duplicate, insufficient, and foreign payment sources atomically", () => {
    let s = base();
    s.player.form = "hero";
    putHand(s, "01005", "01089", "01087");
    const [kick, g] = s.player.hand;
    s = dispatch(s, { type: "PLAY", id: kick.id });
    for (const ids of [[g.id], [g.id, g.id], ["unknown"]]) {
      const n = dispatch(s, { type: "PAY", ids });
      expect(n.error).toBeTruthy();
      expect(n.player.hand).toEqual(s.player.hand);
      expect(n.villain.hp).toBe(14);
    }
  });
  it("supports canceling payment without spending cards", () => {
    let s = base();
    enough(s, "01005");
    const hand = structuredClone(s.player.hand);
    s = dispatch(s, { type: "PLAY", id: s.player.hand[0].id });
    s = dispatch(s, { type: "CANCEL" });
    expect(s.player.hand).toEqual(hand);
    expect(s.prompt).toBeNull();
  });
  it("Scientist generates one mental resource per round", () => {
    let s = base();
    putHand(s, "01006");
    s = dispatch(s, { type: "PLAY", id: s.player.hand[0].id });
    s = dispatch(s, { type: "PAY", ids: ["scientist"] });
    expect(s.error).toBeUndefined();
    expect(s.player.inPlay[0].code).toBe("01006");
    expect(paymentSources(s).some((x) => x.id === "scientist")).toBe(false);
  });
  it("wild resources can satisfy typed payments and exhaust the source", () => {
    let s = base("iron_man");
    s.player.form = "hero";
    const boots = withSupport(s, "01039");
    putHand(s, "01044");
    s = dispatch(s, { type: "ABILITY", id: boots.id });
    s = dispatch(s, {
      type: "PAY",
      ids: [s.player.hand[0].id],
      wildAs: "mental",
    });
    expect(s.error).toBeUndefined();
    expect(s.flags.aerial).toBe(true);
    expect(s.player.inPlay[0].exhausted).toBe(true);
  });
  it("stunned replaces an attack and confused replaces a thwart", () => {
    let s = base();
    s.player.form = "hero";
    s.player.stunned = true;
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(14);
    expect(s.player.stunned).toBe(false);
    s.player.exhausted = false;
    s.player.confused = true;
    s.scheme.threat = 3;
    s = dispatch(s, { type: "BASIC", action: "thwart" });
    expect(s.scheme.threat).toBe(3);
    expect(s.player.confused).toBe(false);
  });
  it("guard blocks attacks on the villain", () => {
    let s = base();
    s.player.form = "hero";
    const min = withMinion(s);
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(14);
    expect(s.minions[0].damage).toBe(2);
  });
  it("crisis prevents thwarting the main scheme", () => {
    let s = base();
    s.player.form = "hero";
    s.scheme.threat = 3;
    const side = makePiece(s, "01108");
    side.counters = 2;
    s.sideSchemes.push(side);
    s = dispatch(s, { type: "BASIC", action: "thwart" });
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes[0].counters).toBe(1);
  });
  it("tough prevents one instance of damage", () => {
    let s = base();
    s.player.form = "hero";
    s.villain.tough = true;
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(14);
    expect(s.villain.tough).toBe(false);
  });
  it("Iron Man hand size and armor track Tech upgrades", () => {
    let s = base("iron_man");
    s.player.form = "hero";
    expect(handSize(s)).toBe(1);
    withSupport(s, "01036");
    withSupport(s, "01039");
    expect(handSize(s)).toBe(3);
    expect(maxHP(s)).toBe(16);
  });
  it("Webbed Up replaces one attack then stun replaces the next", () => {
    let s = base();
    s.player.form = "hero";
    const p = withSupport(s, "01009");
    p.attachedTo = s.villain.id;
    s.queue = [{ type: "enemyAttack", id: s.villain.id }];
    s.prompt = {
      kind: "choice",
      title: "fixture",
      text: "",
      options: [{ id: "go", label: "go", effects: [] }],
    };
    s = dispatch(s, { type: "CHOOSE", id: "go" });
    expect(s.player.hp).toBe(10);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.discard.some((p) => p.code === "01009")).toBe(true);
    s.queue = [{ type: "enemyAttack", id: s.villain.id }];
    s.prompt = {
      kind: "choice",
      title: "fixture",
      text: "",
      options: [{ id: "go", label: "go", effects: [] }],
    };
    s = dispatch(s, { type: "CHOOSE", id: "go" });
    expect(s.villain.stunned).toBe(false);
    expect(s.prompt).toBeNull();
  });
});
describe("scenario resolution", () => {
  it("advances Rhino without carrying over excess damage", () => {
    let s = base();
    s.player.form = "hero";
    s.villain.hp = 1;
    s = settle(dispatch(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.stage).toBe(2);
    expect(s.villain.hp).toBe(15);
    expect(s.sideSchemes.some((p) => p.code === "01107")).toBe(true);
  });
  it("wins after defeating the final stage", () => {
    let s = base();
    s.player.form = "hero";
    s.villain.stage = 2;
    s.villain.code = "01095";
    s.villain.hp = 1;
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.phase).toBe("won");
  });
  it("loses when Rhino reaches 7 threat", () => {
    let s = base();
    s.scheme.threat = 6;
    s = dispatch(s, { type: "END_TURN" });
    expect(s.phase).toBe("lost");
  });
  it("readies before the villain phase and keeps a defender exhausted next turn", () => {
    let s = base();
    s.player.form = "hero";
    s.player.exhausted = true;
    putHand(s, "01088", "01089", "01090");
    s.player.deck = s.player.deck.filter((p) => p.code !== "01061");
    s.encounter.deck = [
      makePiece(s, "01186"),
      makePiece(s, "01105"),
      ...s.encounter.deck,
    ];
    s = dispatch(s, { type: "END_TURN" });
    expect(s.prompt?.title).toMatch(/attacks/);
    expect(s.player.exhausted).toBe(false);
    s = dispatch(s, { type: "CHOOSE", id: "hero" });
    s = settle(s);
    expect(s.phase).toBe("player");
    expect(s.round).toBe(2);
    expect(s.player.exhausted).toBe(true);
  });
  it("Backflip prevents all attack damage after seeing boost cards", () => {
    let s = base();
    s.player.form = "hero";
    putHand(s, "01003");
    s.player.deck = s.player.deck.filter((p) => p.code !== "01061");
    s.encounter.deck = [
      makePiece(s, "01186"),
      makePiece(s, "01105"),
      ...s.encounter.deck,
    ];
    s = dispatch(s, { type: "END_TURN" });
    s = dispatch(s, { type: "CHOOSE", id: "take" });
    expect(s.prompt?.options.some((o) => o.id === "backflip")).toBe(true);
    s = dispatch(s, { type: "CHOOSE", id: "backflip" });
    s = settle(s);
    expect(s.player.hp).toBe(10);
  });
  it("serializes a pending payment and resumes deterministically", () => {
    let s = base();
    enough(s, "01005");
    s = dispatch(s, { type: "PLAY", id: s.player.hand[0].id });
    const saved = JSON.parse(JSON.stringify(s));
    const ids = payIds(s)!;
    expect(dispatch(saved, { type: "PAY", ids })).toEqual(
      dispatch(s, { type: "PAY", ids }),
    );
  });
  it("all core encounter cards resolve without missing handlers or stuck prompts", () => {
    for (const c of CARDS.filter((c) =>
      [
        "minion",
        "treachery",
        "side_scheme",
        "attachment",
        "obligation",
      ].includes(c.type_code),
    )) {
      let s = base(
        c.set_code?.replace("_nemesis", "") &&
          HEROES.some((h) => h.id === c.set_code?.replace("_nemesis", ""))
          ? c.set_code!.replace("_nemesis", "")
          : "spider_man",
        c.set_code === "klaw"
          ? "klaw"
          : c.set_code === "ultron"
            ? "ultron"
            : "rhino",
      );
      s.player.form = "hero";
      s.player.hp = 100;
      s.villain.hp = 100;
      s.villain.maxHp = 100;
      putHand(s, ...Array(7).fill("01044"));
      withSupport(s, "01057");
      s = encounterFixture(s, c.code);
      expect(s.error, `${c.code} ${c.name}`).toBeUndefined();
      s = settle(s);
      expect(s.error, `${c.code} ${c.name}`).toBeUndefined();
    }
  });
  it("all proactive core player events resolve in a valid fixture", () => {
    for (const c of CARDS.filter(
      (c) =>
        c.type_code === "event" &&
        c.faction_code !== "encounter" &&
        !["01003", "01004", "01061", "01077", "01078", "01085"].includes(
          c.code,
        ),
    )) {
      let s = base(
        c.set_code || "spider_man",
        "rhino",
        ASPECTS.some((a) => a.id === c.faction_code)
          ? c.faction_code
          : "justice",
      );
      enough(s, c.code);
      withMinion(s);
      withSupport(s, "01047");
      withSupport(s, "01048");
      withSupport(s, "01066");
      s.player.discard.push(makePiece(s, "01067"));
      s.flags.basicAttack = true;
      s.flags.heroKill = true;
      if (c.text?.includes("Alter-Ego")) s.player.form = "alter";
      const p = s.player.hand[0];
      expect(playable(s, p), `${c.name}: playable`).toBeNull();
      s = settle(dispatch(s, { type: "PLAY", id: p.id }));
      expect(s.error, `${c.name}: resolution`).toBeUndefined();
    }
  });
});
describe("regressions from tabletop review", () => {
  it("allies can attack while the identity is in alter-ego", () => {
    let s = base();
    const p = withSupport(s, "01002");
    s = dispatch(s, { type: "ABILITY", id: p.id, action: "attack" });
    expect(s.error).toBeUndefined();
    expect(s.villain.hp).toBe(13);
    expect(s.player.form).toBe("alter");
    expect(s.player.inPlay[0].damage).toBe(0);
  });
  it("guard also blocks allies from attacking the villain", () => {
    let s = base();
    withMinion(s);
    const p = withSupport(s, "01002");
    s = dispatch(s, { type: "ABILITY", id: p.id, action: "attack" });
    expect(s.villain.hp).toBe(14);
    expect(s.minions[0].damage).toBe(1);
  });
  it("playing a fourth ally asks which ally to discard", () => {
    let s = base();
    withSupport(s, "01002");
    withSupport(s, "01058");
    withSupport(s, "01059");
    enough(s, "01083");
    s = dispatch(s, { type: "PLAY", id: s.player.hand[0].id });
    s = dispatch(s, { type: "PAY", ids: payIds(s)! });
    expect(s.prompt?.title).toBe("Ally limit");
    s = dispatch(s, { type: "CHOOSE", id: s.prompt!.options[0].id });
    s = settle(s);
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(3);
    expect(s.villain.stunned).toBe(true);
  });
  it("removing Mark V Armor reduces remaining HP by six", () => {
    let s = base("iron_man");
    const armor = withSupport(s, "01036");
    s.player.hp = 10;
    s.queue = [{ type: "discardPiece", id: armor.id }];
    s.prompt = {
      kind: "choice",
      title: "fixture",
      text: "",
      options: [{ id: "go", label: "go", effects: [] }],
    };
    s = dispatch(s, { type: "CHOOSE", id: "go" });
    expect(s.player.hp).toBe(4);
    expect(maxHP(s)).toBe(9);
  });
  it("Ultron III enhances printed Drone minions as well as facedown drones", () => {
    let s = base("spider_man", "ultron");
    s.villain.code = "01136";
    s.villain.stage = 3;
    const minion = withMinion(s, "01143");
    expect(pieceHP(s, minion)).toBe(card("01143").health! + 1);
  });
  it("retaliate still triggers when tough prevents attack damage", () => {
    let s = base();
    s.player.form = "hero";
    const p = withMinion(s, "01184");
    p.tough = true;
    s = dispatch(s, { type: "BASIC", action: "attack" });
    s = dispatch(s, { type: "CHOOSE", id: p.id });
    expect(s.player.hp).toBe(8);
    expect(s.minions[0].damage).toBe(0);
  });
  it("scheme boost effects resolve before threat-placement reactions", () => {
    let s = base();
    s.player.hand = [];
    s.encounter.deck.unshift(makePiece(s, "01144a"));
    s.queue = [{ type: "enemyScheme", id: s.villain.id }];
    s.prompt = {
      kind: "choice",
      title: "fixture",
      text: "",
      options: [{ id: "go", label: "go", effects: [] }],
    };
    s = dispatch(s, { type: "CHOOSE", id: "go" });
    expect(s.prompt?.title).toBe("Android Efficiency");
    expect(s.scheme.threat).toBe(0);
    s = settle(s);
    expect(s.scheme.threat).toBeGreaterThan(0);
  });
});

describe("complete seeded missions", () => {
  for (const h of HEROES)
    for (const v of VILLAINS)
      it(`${h.name} vs ${v.name} reaches a result without losing cards or locking`, () => {
        let s = newGame({
          heroId: h.id,
          villainId: v.id,
          aspect: h.aspect,
          seed: 90210,
        });
        s = settle(dispatch(s, { type: "MULLIGAN", ids: [] }));
        const command = (c: any) => {
          s = settle(dispatch(s, c));
          expect(s.error).toBeUndefined();
        };
        for (
          let round = 0;
          round < 50 && !["won", "lost"].includes(s.phase);
          round++
        ) {
          if (s.player.form === "alter") {
            if (s.player.hp < maxHP(s) && !s.player.exhausted)
              command({ type: "BASIC", action: "recover" });
            if (
              (h.id === "captain_marvel" && !s.flags.commander) ||
              (h.id === "iron_man" && !s.flags.futurist)
            )
              command({ type: "ABILITY", id: "identity" });
            if (!s.player.flipped) command({ type: "FLIP" });
          }
          for (let count = 0; count < 5 && s.phase === "player"; count++) {
            const p = s.player.hand
              .filter((p) => playable(s, p) === null)
              .sort((a, b) => {
                const score = (p: Piece) =>
                  card(p).type_code === "event"
                    ? 3
                    : card(p).type_code === "ally"
                      ? 2
                      : 1;
                return score(b) - score(a);
              })[0];
            if (!p) break;
            command({ type: "PLAY", id: p.id });
          }
          if (s.phase !== "player") break;
          for (const p of [...s.player.inPlay].filter(
            (p) => card(p).type_code === "ally" && !p.exhausted,
          )) {
            if (s.phase !== "player") break;
            command({
              type: "ABILITY",
              id: p.id,
              action:
                s.scheme.threat >= 3 || s.sideSchemes.length
                  ? "thwart"
                  : "attack",
            });
          }
          if (s.phase !== "player") break;
          if (!s.player.exhausted && s.player.form === "hero")
            command({
              type: "BASIC",
              action:
                s.scheme.threat >= 3 || s.sideSchemes.length
                  ? "thwart"
                  : "attack",
            });
          if (s.phase !== "player") break;
          if (s.player.hp <= 3 && !s.player.flipped) command({ type: "FLIP" });
          if (s.phase !== "player") break;
          command({
            type: "END_TURN",
            discard: s.player.hand.map((p) => p.id),
          });
          const pieces = [
            ...s.player.hand,
            ...s.player.deck,
            ...s.player.discard,
            ...s.player.inPlay,
            ...s.minions.flatMap((p) => (p.droneCard ? [p.droneCard] : [])),
            ...s.sideSchemes.flatMap((p) => p.captured || []),
          ];
          expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
          expect(pieces.length).toBe(40);
        }
        expect(["won", "lost"]).toContain(s.phase);
      });
});
describe("status cancellation of compound effects", () => {
  it("stunned cancels the entire Repulsor Blast after its resource cost is paid", () => {
    let s = base("iron_man");
    enough(s, "01031");
    s.player.stunned = true;
    const before = s.player.deck.length;
    s = settle(dispatch(s, { type: "PLAY", id: s.player.hand[0].id }));
    expect(s.player.stunned).toBe(false);
    expect(s.player.deck.length).toBe(before);
    expect(s.villain.hp).toBe(14);
  });
  it("stunned Photonic Blast does not draw its bonus card", () => {
    let s = base("captain_marvel");
    enough(s, "01013");
    s.player.stunned = true;
    const before = s.player.deck.length;
    s = settle(dispatch(s, { type: "PLAY", id: s.player.hand[0].id }));
    expect(s.player.deck.length).toBe(before);
    expect(s.villain.hp).toBe(14);
  });
  it("a basic attack canceled by stunned does not enable One-Two Punch", () => {
    let s = base("she_hulk");
    s.player.form = "hero";
    s.player.stunned = true;
    s = dispatch(s, { type: "BASIC", action: "attack" });
    putHand(s, "01024", "01044");
    expect(playable(s, s.player.hand[0])).toMatch(/immediately/);
  });
});
