import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  heroStats,
  resources,
  imageFor,
} from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  dispatch,
  paymentSources,
  nativeHeroAbilityOptions,
  playable,
} from "../src/game/engine.js";
import { deckErrors } from "../src/game/decks.js";
import { seatView } from "../src/game/team.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  psiEnergy,
  psylockeSideSchemeDefeated,
  psylockeMentalIcons,
  PSYLOCKE_SCRIPT_CODES,
} from "../src/game/psylocke.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  minion,
  side,
  attach,
  play,
  pay,
  respond,
  reload,
  top,
} from "./dv-test-helpers.js";
import type { GameState } from "../src/game/types.js";
function start(team = false) {
  return newGame({
    heroId: "psylocke",
    aspect: "justice",
    villainId: "rhino",
    seed: 41001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "psylocke", aspect: "justice" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(form: "hero" | "alter" = "hero", team = false) {
  let s = start(team);
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(...v.player.hand.splice(0));
    v.player.form = seat.heroId === "psylocke" ? form : "alter";
    v.player.exhausted = false;
  }
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  return reload(s);
}
const resolve = (s: GameState, target?: string) =>
  finish(s, (v) =>
    target && v.prompt?.options.some((o) => o.id === target)
      ? target
      : undefined,
  );
const flipWeapon = (s: GameState, id: string) =>
  native(s, { type: "psylocke:flip", id });
const attack = (s: GameState) =>
  native(s, { type: "enemyAttack", id: s.villain.id });

describe("Psylocke complete native original pack", () => {
  it("preserves two physical reversible Permanents outside forty playing cards and five physical nemesis cards", () => {
    let s = start();
    expect(deckCodes("psylocke", "justice")).toHaveLength(42);
    expect(
      deckErrors("psylocke", "justice", deckCodes("psylocke", "justice")),
    ).toEqual([]);
    expect(s.player.deck.length + s.player.hand.length).toBe(40);
    const ids = s.player
      .setAside!.filter((p) => p.code === "41002a")
      .map((p) => p.id);
    expect(ids).toHaveLength(2);
    s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
    expect(psiEnergy(s).map((p) => p.id)).toEqual(ids);
    expect(s.player.setAside).toHaveLength(5);
    expect(s.player.hand).toHaveLength(6);
    expect(PSYLOCKE_SCRIPT_CODES.every(hasExecutableScript)).toBe(true);
    expect(imageFor("41001a")).toContain("41001a");
  });
  it("basic attack flips exactly one physical weapon before calculating ATK and gives Piercing", () => {
    let s = base();
    s.villain.tough = true;
    const ids = psiEnergy(s).map((p) => p.id);
    expect(heroStats(s).thwart).toBe(3);
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.title).toBe("Psi-Energy Control");
    s = choose(s, ids[0]);
    s = resolve(s, s.villain.id);
    expect(heroStats(s).attack).toBe(2);
    expect(heroStats(s).thwart).toBe(2);
    expect(s.villain.hp).toBe(48);
    expect(s.villain.tough).toBe(false);
    expect(psiEnergy(s).map((p) => p.id)).toEqual(ids);
  });
  it("Stun replaces basic attack without opening Psi-Energy Control", () => {
    let s = base();
    s.player.stunned = true;
    s = resolve(command(s, { type: "BASIC", action: "attack" }));
    expect(psiEnergy(s).every((p) => p.code === "41002a")).toBe(true);
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
  });
  it("resource abilities keep printed resource provenance, exhaust both actual sources and finish optional flips before event resolution", () => {
    let s = base();
    const [p] = hand(s, "41005");
    const ids = psiEnergy(s).map((p) => p.id);
    s = command(s, { type: "PLAY", id: p.id });
    s = pay(s, [], undefined, ids);
    s = choose(s, "yes");
    s = choose(s, "yes");
    s = resolve(s, "main");
    expect(psiEnergy(s).every((p) => p.exhausted && p.code === "41002b")).toBe(
      true,
    );
    expect(s.scheme.threat).toBe(5);
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("resource flip can be declined and becomes unavailable in alter ego", () => {
    let s = base();
    const [p] = hand(s, "41005");
    s = command(s, { type: "PLAY", id: p.id });
    s = pay(
      s,
      [],
      undefined,
      psiEnergy(s).map((p) => p.id),
    );
    s = resolve(s, "main");
    expect(s.scheme.threat).toBe(1);
    expect(psiEnergy(s).every((p) => p.code === "41002a")).toBe(true);
    s.player.form = "alter";
    expect(paymentSources(s).filter((p) => p.code === "41002a")).toHaveLength(
      0,
    );
  });
  it("Power of the Mind doubles only for Psionic cards, including nonbasic Psionic cards", () => {
    expect(resources(card("41021"), card("41005"))).toEqual([
      "mental",
      "mental",
    ]);
    expect(resources(card("41021"), card("41024"))).toEqual([
      "mental",
      "mental",
    ]);
    expect(resources(card("41021"), card("41022"))).toEqual(["mental"]);
    expect(resources(card("40028"), card("41005"))).toEqual([
      "mental",
      "mental",
    ]);
  });
  it("Flurry of Blades resolves one attack with separate damage/Confuse targets based on final faces", () => {
    let s = base();
    psiEnergy(s)[0].code = "41002b";
    const [p, a, b] = hand(s, "41004", "01089", "01090");
    s = resolve(play(s, p, [a, b]), s.villain.id);
    expect(s.villain.hp).toBe(46);
    expect(s.villain.confused).toBe(true);
  });
  it("Stun replaces the entire Flurry ability including its confuse clauses", () => {
    let s = base();
    s.player.stunned = true;
    const [p, a, b] = hand(s, "41004", "01089", "01090");
    s = resolve(play(s, p, [a, b]), s.villain.id);
    expect(s.villain.hp).toBe(50);
    expect(s.villain.confused).toBe(false);
  });
  it("Angel readies only after actual PLAY from hand", () => {
    let s = base();
    s.player.exhausted = true;
    const [p, a, b] = hand(s, "41003", "01089", "01090");
    s = play(s, p, [a, b]);
    s = choose(s, "yes");
    s = resolve(s);
    expect(s.player.exhausted).toBe(false);
    s.player.exhausted = true;
    s = resolve(native(s, { type: "allyEnter", id: p.id, fromHand: false }));
    expect(s.player.exhausted).toBe(true);
  });
  it("Training Regimen searches actual Skills, shuffles, then discards in hero form", () => {
    let s = base();
    const reg = put(s, "41008");
    hand(s, "01089");
    s = command(s, { type: "ABILITY", id: reg.id, action: "search" });
    const skill = s.prompt!.options.find((o) => o.image === "41009")!;
    expect(skill).toBeTruthy();
    s = choose(s, skill.id);
    expect(s.prompt?.title).toBe("Training Regimen");
    s = choose(s, skill.id);
    expect(s.player.discard.some((p) => p.id === skill.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === reg.id)?.exhausted).toBe(true);
  });
  it("Betsy exhausts a physical weapon to shuffle a selected Psionic card from discard", () => {
    let s = base("alter");
    const [p] = hand(s, "41005");
    s.player.discard.push(s.player.hand.pop()!);
    const id = psiEnergy(s)[0].id;
    s = command(s, { type: "ABILITY", id: "identity", action: id });
    s = choose(s, p.id);
    s = resolve(s);
    expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
    expect(psiEnergy(s).find((q) => q.id === id)?.exhausted).toBe(true);
  });
  it("Body Swapped flips and exhausts both originals, blocks reverse flip, and discards through a real Psionic hand cost", () => {
    let s = base();
    const obligation = makePiece(s, "41025");
    s = resolve(native(s, { type: "reveal", piece: obligation }));
    expect(psiEnergy(s).every((p) => p.code === "41002b" && p.exhausted)).toBe(
      true,
    );
    s.player.exhausted = false;
    s = resolve(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    expect(s.villain.hp).toBe(47);
    s.player.form = "alter";
    const [p] = hand(s, "41005");
    s = command(s, { type: "ABILITY", id: obligation.id, action: "discard" });
    s = choose(s, p.id);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Telepathy requires two mental resources and exhausts only after payment", () => {
    let s = base();
    const p = put(s, "41024");
    s = command(s, { type: "ABILITY", id: p.id, action: "special" });
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(false);
    s = pay(
      s,
      [],
      undefined,
      psiEnergy(s).map((p) => p.id),
    );
    s = resolve(s, "main");
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Telekinesis uses native attack and consumes Stun instead of dealing damage", () => {
    let s = base();
    s.player.stunned = true;
    const p = put(s, "41033");
    s = command(s, { type: "ABILITY", id: p.id, action: "special" });
    s = pay(
      s,
      [],
      undefined,
      psiEnergy(s).map((p) => p.id),
    );
    s = resolve(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Psi-Bow Attack has ranged and preserves its printed trait restriction", () => {
    let s = base();
    const [p, r] = hand(s, "41030", "01089");
    put(s, "41017");
    s.villain.confused = true;
    s = resolve(play(s, p, [r]), s.villain.id);
    expect(s.villain.hp).toBe(45);
    s.heroId = "spider_man";
    const [blocked] = hand(s, "41030");
    expect(playable(s, blocked)).toContain("Psionic");
  });
  it("Captain Britain reduces consequential damage against minions and side schemes only", () => {
    let s = base();
    const p = put(s, "41012"),
      m = minion(s);
    s = resolve(
      command(s, { type: "ABILITY", id: p.id, action: "attack" }),
      m.id,
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
    s.player.inPlay.find((q) => q.id === p.id)!.exhausted = false;
    const scheme = side(s, undefined, 5);
    s = resolve(
      command(s, { type: "ABILITY", id: p.id, action: "thwart" }),
      scheme.id,
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(2);
  });
  it("Cypher draws after actual damage to a confused enemy but not Tough prevention", () => {
    let s = base();
    const p = put(s, "41013");
    s.villain.confused = true;
    s = command(s, { type: "ABILITY", id: p.id, action: "attack" });
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = choose(s, "yes");
    s = resolve(s);
    expect(s.player.hand).toHaveLength(1);
    s.player.inPlay.find((q) => q.id === p.id)!.exhausted = false;
    s.villain.tough = true;
    s = resolve(
      command(s, { type: "ABILITY", id: p.id, action: "attack" }),
      s.villain.id,
    );
    expect(s.player.hand).toHaveLength(1);
  });
  it("Domino swaps actual top and hand cards without draw or shuffle", () => {
    let s = base();
    const p = put(s, "41031");
    const [held] = hand(s, "01089");
    const topId = s.player.deck[0].id;
    s = command(s, { type: "ABILITY", id: p.id, action: "thwart" });
    if (s.prompt?.options.some((o) => o.id === "main")) s = choose(s, "main");
    s = choose(s, "yes");
    s = choose(s, held.id);
    s = resolve(s);
    expect(s.player.deck[0].id).toBe(held.id);
    expect(s.player.hand.some((q) => q.id === topId)).toBe(true);
  });
  it("Float Like a Butterfly transfers control and boosts that controller's attacks only", () => {
    let s = base("hero", true);
    const [p, r] = hand(s, "41017", "01089");
    s = play(s, p, [r]);
    s = choose(s, "p2");
    s = resolve(s);
    expect(seatView(s, "p2").player.inPlay.some((q) => q.id === p.id)).toBe(
      true,
    );
    s.villain.confused = true;
    s = resolve(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    expect(s.villain.hp).toBe(49);
  });
  it("IPAC pays by dealing to the selected teammate before that teammate draws", () => {
    let s = base("hero", true);
    const p = put(s, "41022");
    const before = seatView(s, "p2").player.hand.length;
    s = command(s, { type: "ABILITY", id: p.id, action: "ipac" });
    s = choose(s, "p2");
    s = resolve(s);
    expect(seatView(s, "p2").player.hand).toHaveLength(before + 2);
    expect(s.encounter.dealt.some((p) => p.dealtTo === "p2")).toBe(true);
    expect(s.activePlayerId).toBe("p1");
  });
  it("X-Bunker searches only top X using current victory side schemes and chosen Mutant owner", () => {
    let s = base("alter");
    const p = put(s, "41023");
    s.victoryDisplay = [makePiece(s, "41016"), makePiece(s, "01107")];
    const ids = s.player.deck.slice(0, 2).map((p) => p.id);
    s = command(s, { type: "ABILITY", id: p.id, action: "search" });
    s = choose(s, "p1");
    expect(
      s.prompt!.options.filter((o) => o.id !== "fail").map((o) => o.id),
    ).toEqual(ids);
    s = choose(s, ids[1]);
    s = resolve(s);
    expect(s.player.hand[0].id).toBe(ids[1]);
  });
  it("Lay the Trap callback attributes 5 per player nonattack damage to the defeating player", () => {
    let s = base("hero", true);
    const p = makePiece(s, "41016");
    const effect = psylockeSideSchemeDefeated(s, p, "p2");
    expect(effect[0]).toMatchObject({
      source: p.id,
      actorId: "p2",
      amount: 10,
    });
    expect(effect[0].attack).toBeUndefined();
    s = resolve(native(s, ...effect));
    expect(s.villain.hp).toBe(40);
    expect(s.activePlayerId).toBe("p1");
  });
  it("Shadows reveals the original five nemesis objects without manufacturing replacements", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = resolve(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.minions.some((p) => p.code === "41026")).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "41027")?.counters).toBe(4);
    expect(
      [
        ...s.minions,
        ...s.sideSchemes,
        ...s.encounter.deck,
        ...s.encounter.discard,
      ].filter((p) => ids.includes(p.id)),
    ).toHaveLength(5);
  });
  it("Chimera snapshots printed mental icons on all controlled cards for activation", () => {
    let s = base();
    const m = minion(s, "41026");
    put(s, "41010");
    s = resolve(native(s, { type: "enemyAttack", id: m.id }));
    expect(s.player.hp).toBe(6);
  });
  it("Telekinetic Dragon boost offers actual typed payment or confusion", () => {
    let s = base();
    s = native(s, { type: "boostEffect", piece: makePiece(s, "41029") });
    s = choose(s, "pay");
    s = pay(s, [], undefined, [psiEnergy(s)[0].id]);
    s = resolve(s);
    expect(s.player.confused).toBe(false);
    expect(psiEnergy(s)[0].exhausted).toBe(true);
  });
  it("Psionic Illusion failed resource prediction redirects the actual attack and discards actual attachment", () => {
    let s = base();
    const illusion = attach(s, "41028", "hero:p1");
    top(s, "01089");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, "continue");
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = choose(s, "physical");
    if (s.prompt)
      s = choose(
        s,
        s.prompt.options.find((o) => o.id === "hero" || o.id === "hero:p1")!.id,
      );
    s = resolve(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(9);
    expect(s.encounter.discard.some((p) => p.id === illusion.id)).toBe(true);
  });
  it("Soaring Hearts retrieves an actual signature event and readies Psylocke plus Angel ally", () => {
    let s = base();
    const angel = put(s, "41003");
    angel.exhausted = true;
    s.player.exhausted = true;
    const [p, r, event] = hand(s, "41020", "01089", "41005");
    s.player.discard.push(
      s.player.hand.splice(
        s.player.hand.findIndex((q) => q.id === event.id),
        1,
      )[0],
    );
    s = play(s, p, [r]);
    s = choose(s, event.id);
    s = resolve(s);
    expect(s.player.hand.some((q) => q.id === event.id)).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === angel.id)?.exhausted).toBe(
      false,
    );
  });
});

describe("Psylocke native interrupts and responses", () => {
  it("Confused replaces all of Mental Detection including its card draw", () => {
    let s = base();
    psiEnergy(s).forEach((p) => (p.code = "41002b"));
    s.player.confused = true;
    const [p, r] = hand(s, "41005", "01089");
    s = resolve(play(s, p, [r]));
    expect(s.scheme.threat).toBe(6);
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.confused).toBe(false);
  });
  it("Psionic Redirect pays through native event PLAY, prevents damage and confuses based on current faces", () => {
    let s = base();
    psiEnergy(s)[0].code = "41002b";
    const [p, r] = hand(s, "41006", "41021");
    s = attack(s);
    s = choose(s, "take");
    expect(s.prompt?.options.some((o) => o.id === p.id)).toBe(true);
    s = choose(s, p.id);
    s = pay(s, [r]);
    s = resolve(s);
    expect(s.player.hp).toBe(10);
    expect(s.villain.confused).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Telepathic Suggestion cancels When Revealed but preserves minion entry and performs both Knife removals", () => {
    let s = base();
    const [p, r] = hand(s, "41007", "41021");
    const bomber = makePiece(s, "01110");
    s = native(s, { type: "reveal", piece: bomber, fromEncounterDeck: true });
    s = choose(s, p.id);
    s = pay(s, [r]);
    s = resolve(s, "main");
    expect(s.minions.some((p) => p.id === bomber.id)).toBe(true);
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(4);
  });
  it("Telepathic Suggestion is unavailable for a reveal that did not come from encounter deck", () => {
    let s = base();
    const [p] = hand(s, "41007", "41021");
    s = native(s, { type: "reveal", piece: makePiece(s, "01112") });
    expect(s.prompt?.options.some((o) => o.id === p.id)).not.toBe(true);
    s = resolve(s);
    expect(s.player.confused).toBe(true);
  });
  it("Pete Wisdom heals only when this controller resolves a treachery's When Revealed text", () => {
    let s = base();
    const p = put(s, "41018");
    p.damage = 2;
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01112"),
      fromEncounterDeck: true,
    });
    s = choose(s, "yes");
    s = resolve(s);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
    expect(s.player.confused).toBe(true);
  });
  it("Pete Wisdom does not trigger from canceled When Revealed text", () => {
    let s = base();
    const pete = put(s, "41018");
    pete.damage = 2;
    const [p, r] = hand(s, "41007", "41021");
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01112"),
      fromEncounterDeck: true,
    });
    s = choose(s, p.id);
    s = pay(s, [r]);
    s = resolve(s, "main");
    expect(s.player.inPlay.find((q) => q.id === pete.id)?.damage).toBe(2);
  });
  it("Upside the Head stuns an already-confused enemy after actual basic damage and is an actual paid PLAY", () => {
    let s = base();
    s.villain.confused = true;
    const [p, r] = hand(s, "41015", "01089");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, "continue");
    s = choose(s, p.id);
    s = pay(s, [r]);
    s = resolve(s);
    expect(s.villain.hp).toBe(49);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Directed Force uses the Katana's basic Piercing and adds two damage only once per attack", () => {
    let s = base();
    psiEnergy(s)[0].code = "41002b";
    const [p, second] = hand(s, "41019", "41019");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, "continue");
    s = choose(s, p.id);
    s = resolve(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.hand.some((q) => q.id === second.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Martial Arts Training gives real DEF and readies after a basic defense", () => {
    let s = base();
    const p = put(s, "41009");
    expect(heroStats(s).defense).toBe(3);
    s = attack(s);
    s = choose(s, "hero");
    s = choose(s, psiEnergy(s)[0].id);
    s = respond(s, /Martial Arts Training/);
    s = resolve(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Psi-Flail Strike is a paid response attack after defense and deals damage plus Stun", () => {
    let s = base();
    const [p, r] = hand(s, "41032", "01089");
    s = attack(s);
    s = choose(s, "hero");
    s = choose(s, "continue");
    s = respond(s, /Psi-Flail Strike/);
    s = pay(s, [r]);
    s = resolve(s);
    expect(s.villain.hp).toBe(47);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Weapons Training grants Retaliate and readies actual exhausted weapons after an attack", () => {
    let s = base();
    const p = put(s, "41011");
    psiEnergy(s).forEach((p) => (p.exhausted = true));
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, "continue");
    s = choose(s, "yes");
    s = resolve(s);
    expect(psiEnergy(s).every((p) => !p.exhausted)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Psionic Training ignores Guard and Patrol and can be discarded after thwart to confuse", () => {
    let s = base();
    const p = put(s, "41010");
    minion(s, "01103");
    const [event, r] = hand(s, "41005", "01089");
    s = play(s, event, [r]);
    s = choose(s, "main");
    s = choose(s, "yes");
    s = resolve(s, s.villain.id);
    expect(s.villain.confused).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
});

describe("Psylocke printed rules edge cases", () => {
  it("counts controlled player side schemes exactly once, including printed mental icons despite blanked text", () => {
    const s = base("hero", true);
    const ours = makePiece(s, "42017");
    Object.assign(ours, { ownerId: "p2", playerSideSchemeController: "p1" });
    const theirs = makePiece(s, "42017");
    Object.assign(theirs, { ownerId: "p2", playerSideSchemeController: "p2" });
    const before = psylockeMentalIcons(s);
    s.sideSchemes.push(ours, theirs);
    expect(psylockeMentalIcons(s)).toBe(before + 1);
    expect(s.player.inPlay.some((p) => p.id === ours.id)).toBe(false);
  });
  it("never offers Permanent Psi-Katanas for the Restricted discard choice", () => {
    let s = base();
    psiEnergy(s).forEach((p) => (p.code = "41002b"));
    const weapon = put(s, "06019");
    s = native(s, { type: "restrictedLimit" });
    expect(s.prompt!.options.map((o) => o.id)).toEqual([weapon.id]);
    s = resolve(s, weapon.id);
    expect(psiEnergy(s)).toHaveLength(2);
    expect(s.player.discard.some((p) => p.id === weapon.id)).toBe(true);
  });
  it("IPAC cannot be exhausted without an encounter card to pay its cost", () => {
    const s = base();
    const p = put(s, "41022");
    s.encounter.deck = [];
    s.encounter.discard = [];
    expect(nativeHeroAbilityOptions(s, p.id)).toEqual([]);
  });
  it("one Flurry attack triggers Retaliate once for each distinct surviving target", () => {
    let s = base();
    psiEnergy(s).forEach((p) => (p.code = "41002b"));
    const m = minion(s, "01184");
    const [event, a, b] = hand(s, "41004", "01089", "01090");
    s = resolve(play(s, event, [a, b]), m.id);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(6);
    expect(s.player.hp).toBe(8);
  });
  it("Illusion checks each new Flurry target, including confuse, but not repeated targets", () => {
    let s = base();
    const illusion = attach(s, "41028", "hero:p1");
    const m = minion(s, "01103");
    const [event, a, b] = hand(s, "41004", "01089", "01090");
    const top1 = top(s, "01088");
    s = play(s, event, [a, b]);
    s = choose(s, m.id);
    s = choose(s, "energy");
    expect(s.player.discard.some((p) => p.id === top1.id)).toBe(true);
    // Same enemy is already checked for this one attack.
    s = choose(s, m.id);
    expect(s.prompt?.title).toContain("confuse");
    s = choose(s, s.villain.id);
    expect(s.prompt?.title).toBe("Psionic Illusion");
    s = resolve(choose(s, "wild"), "hero");
    expect(s.player.confused).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === illusion.id)).toBe(true);
  });
});
