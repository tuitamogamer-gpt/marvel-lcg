/** Native acceptance contract. These tests intentionally require the real
 * Ghost-Spider host/metadata; no pure effect resolver or synthetic hero fallback. */
import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import {
  makePiece,
  newGame,
  dispatch,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  encounterConserved,
  encounterPhysical,
  finish,
  hand,
  minion,
  native,
  owned,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { dvSourceIds?: Record<string, string[]> };
function starting(ghostSeat = "p1", team = false) {
  const ghost = { heroId: "ghost_spider", aspect: "protection" as const };
  const other = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...ghost,
    villainId: "rhino",
    seed: 27001,
    pacing: "expert",
    ...(team
      ? { heroes: ghostSeat === "p1" ? [ghost, other] : [other, ghost] }
      : {}),
  });
}
function base(ghostSeat = "p1", team = false) {
  let s = starting(ghostSeat, team);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligation = s.encounter.deck.find((p) => p.code === "27025")!;
  for (const seat of s.players) {
    const view = seatView(s, seat),
      source = physical(s, seat.id);
    expect(source).toHaveLength(40);
    source.forEach((p) => (p.ownerId = seat.id));
    view.player.deck = source;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.flipped = false;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [
    ...Array.from({ length: 15 }, () => makePiece(s, "01174")),
    obligation,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, ghostSeat);
  s.turnPlayerId = ghostSeat;
  return s;
}
function basic(
  s: GameState,
  action: "attack" | "thwart",
  id = action === "attack" ? s.villain.id : "main",
) {
  return target(command(s, { type: "BASIC", action }), id);
}
function exactEncounter(s: GameState, code: string): Piece {
  for (const z of [
    s.player.setAside || [],
    s.encounter.deck,
    s.encounter.dealt,
    s.encounter.discard,
  ]) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  throw Error(`Original physical encounter ${code} missing`);
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}
function playResponse(s: GameState, p: Piece, resources: Piece[] = []) {
  s = respond(
    s,
    new RegExp(card(p).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    p.code,
  );
  return pay(s, resources);
}
describe("Ghost-Spider original source through native initialization", () => {
  it("creates the original40 and separate actual five-card nemesis and obligation", () => {
    const s = starting(),
      source = STARTER_DECKS.find((d) => d.id === "starter-27001a")!;
    expect(deckCodes("ghost_spider", "protection").sort()).toEqual(
      catalogDeckCodes(source).sort(),
    );
    expect(physical(s)).toHaveLength(40);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(source).sort());
    const factions = { hero: 0, protection: 0, basic: 0 };
    for (const p of physical(s))
      factions[card(p).faction_code as keyof typeof factions]++;
    expect(factions).toEqual({ hero: 15, protection: 15, basic: 10 });
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("27001b");
    expect(handSize(s)).toBe(6);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "27026",
      "27027",
      "27028",
      "27029",
      "27029",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(s.encounter.deck.filter((p) => p.code === "27025")).toHaveLength(1);
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 1,
      defense: 3,
      recover: 3,
    });
  });
  it("uses actual original nemesis IDs through Shadows and keeps source40", () => {
    let s = base();
    const source = physical(s),
      nemesis = [...s.player.setAside!];
    s = finish(reveal(s, makePiece(s, "01190")));
    expect(s.minions.find((p) => p.code === "27027")?.id).toBe(
      nemesis.find((p) => p.code === "27027")!.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "27026")).toMatchObject({
      id: nemesis.find((p) => p.code === "27026")!.id,
      counters: 5,
    });
    expect(s.player.setAside).toEqual([]);
    conserved(s, source);
    encounterConserved(s, nemesis);
    expect(new Set(encounterPhysical(s).map((p) => p.id)).size).toBe(
      encounterPhysical(s).length,
    );
  });
  it("migration does not replenish a consumed set-aside zone after JSON reload", () => {
    let s = base("p2", true);
    s.player.setAside = [];
    activateSeat(s, "p1");
    const next = s.nextId;
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    expect(seatView(s, "p2").player.setAside).toEqual([]);
    expect(s.nextId).toBe(next);
  });
});

describe("actual stored event PLAY and shared completed-event response windows", () => {
  it("Counterspell cancels a paid Ghost Kick, consuming its PLAY/max but offering no resolved-ability ready or Bracelet", () => {
    let s = base();
    const source = physical(s),
      bracelet = put(s, "27009"),
      [kick, another, energy, mental] = hand(
        s,
        "27002",
        "27002",
        "27020",
        "27021",
      ),
      counterspell = makePiece(s, "09030");
    counterspell.attachedTo = "hero:p1";
    s.attachments.push(counterspell);
    s = basic(s, "attack");
    s = playResponse(s, kick, [energy]);
    expect(
      s.prompt?.options.some(
        (o) =>
          o.image === "27002" ||
          o.image === "27009" ||
          /Dizzying Reflexes/i.test(o.label),
      ),
    ).toBeFalsy();
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === bracelet.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.discard.filter((p) => p.id === kick.id)).toHaveLength(1);
    expect(s.player.hand.map((p) => p.id)).toEqual([another.id, mental.id]);
    expect(s.attachments.some((p) => p.id === counterspell.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === counterspell.id),
    ).toHaveLength(1);
    conserved(s, source);
  });
  it("George exhausts to store the actual ID and paid reaction PLAY moves that ID to resolving/discard", () => {
    let s = base();
    const source = physical(s),
      g = put(s, "27007"),
      [kick, resource] = hand(s, "27002", "27020");
    s = command(s, { type: "ABILITY", id: g.id, action: "george-store" });
    s = choose(s, kick.id);
    expect(
      s.player.inPlay.find((p) => p.id === g.id)?.storedCards?.map((p) => p.id),
    ).toEqual([kick.id]);
    expect(s.player.hand.map((p) => p.id)).toEqual([resource.id]);
    expect(paymentSources(s, resource.id).some((p) => p.id === kick.id)).toBe(
      false,
    );
    conserved(s, source);
    s = basic(s, "attack");
    expect(s.villain.hp).toBe(48);
    s = playResponse(s, kick, [resource]);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(42);
    expect(s.player.discard.map((p) => p.id)).toContain(kick.id);
    expect(s.player.inPlay.find((p) => p.id === g.id)?.storedCards).toEqual([]);
    conserved(s, source);
  });
  it("canceling stored response payment retains actual storage and permits a later retry in that same window", () => {
    let s = base();
    const source = physical(s),
      g = put(s, "27007"),
      [kick, resource] = hand(s, "27002", "27020");
    s = command(s, { type: "ABILITY", id: g.id, action: "george-store" });
    s = choose(s, kick.id);
    s = basic(s, "attack");
    s = respond(s, /Ghost Kick/i, "27002");
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    expect(
      s.player.inPlay.find((p) => p.id === g.id)?.storedCards?.map((p) => p.id),
    ).toEqual([kick.id]);
    s = playResponse(s, kick, [resource]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(42);
    conserved(s, source);
  });
  it("Web-Bracelet draws Turn the Tide into the same actual Phantom Flip thwart-response window", () => {
    let s = base();
    const source = physical(s),
      bracelet = put(s, "27009"),
      [flip, resource] = hand(s, "27004", "27020"),
      scheme = side(s, "01107", 5);
    const tide = owned(s, "15015");
    s.player.deck.unshift(tide);
    s = basic(s, "attack");
    s = playResponse(s, flip, [resource]);
    s = target(s, scheme.id);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    s = respond(s, /Web.Br[a-z]*|Web-Bracelet/i, "27009");
    expect(s.player.hand.some((p) => p.id === tide.id)).toBe(true);
    s = respond(s, /Turn the Tide/i, "15015");
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(s.player.inPlay.find((p) => p.id === bracelet.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.filter((p) => p.id === tide.id)).toHaveLength(1);
    conserved(s, source);
  });
  it("native Stun replacement consumes Ghost Kick play/max without Dizzy or Bracelet", () => {
    let s = base();
    const source = physical(s),
      bracelet = put(s, "27009"),
      [kick, resource] = hand(s, "27002", "27020");
    s = basic(s, "thwart");
    s.player.stunned = true;
    s = playResponse(s, kick, [resource]);
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === bracelet.id)?.exhausted).toBe(
      false,
    );
    expect(s.villain.hp).toBe(50);
    expect(s.player.discard.some((p) => p.id === kick.id)).toBe(true);
    conserved(s, source);
  });
  it("native Confuse replacement of Phantom Flip creates no completed response ability", () => {
    let s = base();
    const b = put(s, "27009"),
      [flip, resource] = hand(s, "27004", "27020");
    s = basic(s, "attack");
    s.player.confused = true;
    s = finish(playResponse(s, flip, [resource]));
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(false);
    expect(s.scheme.threat).toBe(6);
  });
  it("a second basic use in one phase has a new response receipt while Dizzy remains limited", () => {
    let s = base();
    const source = physical(s),
      [first, second, energy, genius] = hand(
        s,
        "27002",
        "27002",
        "27020",
        "27021",
      );
    s = basic(s, "attack");
    s = playResponse(s, first, [energy]);
    s = target(s, s.villain.id);
    s = respond(s, /Dizzying Reflexes/i, "27001a");
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.hp).toBe(42);
    s = basic(s, "attack");
    s = playResponse(s, second, [genius]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(34);
    expect(s.player.exhausted).toBe(true);
    conserved(s, source);
  });
  it("both Bracelet copies share one event-play Max even after the first draw", () => {
    let s = base();
    const a = put(s, "27009"),
      b = put(s, "27009"),
      [kick, resource] = hand(s, "27002", "27020");
    s = basic(s, "attack");
    s = playResponse(s, kick, [resource]);
    s = target(s, s.villain.id);
    s = respond(s, /Web.Br[a-z]*|Web-Bracelet/i, "27009");
    s = finish(s);
    expect(
      s.player.inPlay.filter((p) => [a.id, b.id].includes(p.id) && p.exhausted),
    ).toHaveLength(1);
    expect(s.player.hand).toHaveLength(1);
  });
});

describe("native defender ownership and In Cold Blood attack-resolved timing", () => {
  it("the p2 defender owns completed-basic-defense Kick, Dizzy and Bracelet", () => {
    let s = base("p2", true);
    const source = physical(s, "p2"),
      b = put(s, "27009"),
      [kick, resource] = hand(s, "27002", "27020");
    s.phase = "villain";
    activateSeat(s, "p1");
    const m = minion(s, "01103", "p1");
    s = native(s, { type: "enemyAttack", id: m.id });
    s = choose(s, "hero:p2");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "27002"));
    expect(s.activePlayerId).toBe("p2");
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.attack).toBeFalsy();
    s = playResponse(s, kick, [resource]);
    s = target(s, s.villain.id);
    s = respond(s, /Web.Br[a-z]*|Web-Bracelet/i, "27009");
    s = respond(s, /Dizzying Reflexes/i, "27001a");
    s = finish(s);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === b.id)?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === kick.id)).toBe(
      true,
    );
    expect(seatView(s, "p1").player.discard.some((p) => p.id === kick.id)).toBe(
      false,
    );
    conserved(s, source, "p2");
  });
  it("In Cold Blood forbids revealer events during defense but unlocks Kick at step6 after forced Retaliate", () => {
    let s = base();
    const source = physical(s),
      lizard = exactEncounter(s, "27027"),
      cold = exactEncounter(s, "27029");
    lizard.engagedWith = "p1";
    lizard.damage = 3;
    s.minions.push(lizard);
    const retaliate = put(s, "16016"),
      [kick, resource] = hand(s, "27002", "27020");
    s = reveal(s, cold);
    expect(s.prompt?.title).toBe("The Lizard attacks");
    expect(
      s.prompt?.options.some((o) => o.id === "hero" && o.image === "27001a"),
    ).toBe(true);
    expect(s.flags.ghostSpiderColdBloodLock).toBeGreaterThan(0);
    expect(playable(s, kick)).toMatch(/In Cold Blood|cannot|prevents/i);
    s = choose(s, "hero");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "27002"));
    expect(s.flags.ghostSpiderColdBloodLock || 0).toBe(0);
    expect(s.minions.find((p) => p.id === lizard.id)?.damage).toBe(4);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.some((p) => p.id === retaliate.id)).toBe(true);
    s = playResponse(s, kick, [resource]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(44);
    conserved(s, source);
  });
  it("a stunned Lizard causes native no-attack Surge and releases the lock", () => {
    let s = base();
    const lizard = exactEncounter(s, "27027"),
      cold = exactEncounter(s, "27029");
    lizard.stunned = true;
    lizard.engagedWith = "p1";
    s.minions.push(lizard);
    const dealt = s.encounter.dealt.length;
    s = finish(reveal(s, cold));
    expect(s.minions.find((p) => p.id === lizard.id)?.stunned).toBe(false);
    expect(s.attack).toBeFalsy();
    expect(s.flags.ghostSpiderColdBloodLock || 0).toBe(0);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
});

describe("current Worried Father actual native capture and owner-aware cleanup", () => {
  it("attaches the real George ID under the obligation, discards real stored events, then recovers that ID", () => {
    let s = base();
    const source = physical(s),
      g = put(s, "27007"),
      [event] = hand(s, "27004");
    s = command(s, { type: "ABILITY", id: g.id, action: "george-store" });
    s = choose(s, event.id);
    const obligation = exactEncounter(s, "27025");
    s = finish(reveal(s, obligation));
    const captured = s.player.inPlay.find((p) => p.id === obligation.id)!;
    expect(captured.storedCards?.map((p) => p.id)).toEqual([g.id]);
    expect(captured.storedCards?.[0].storedCards).toEqual([]);
    expect(s.player.discard.map((p) => p.id)).toContain(event.id);
    expect(s.player.setAside?.some((p) => p.id === g.id)).not.toBe(true);
    conserved(s, source);
    encounterConserved(s, [obligation]);
    s = command(s, { type: "FLIP" });
    s = finish(
      command(s, {
        type: "ABILITY",
        id: obligation.id,
        action: "worried-father",
      }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.map((p) => p.id)).toContain(obligation.id);
    expect(s.player.hand.filter((p) => p.id === g.id)).toHaveLength(1);
    conserved(s, source);
    encounterConserved(s, [obligation]);
  });
  it("revealing for p1 gives Worried Father to p2 Gwen and captures only her actual source", () => {
    let s = base("p2", true);
    const source = physical(s, "p2"),
      g = put(s, "27007"),
      ob = exactEncounter(s, "27025");
    activateSeat(s, "p1");
    s = finish(reveal(s, ob));
    expect(
      seatView(s, "p2")
        .player.inPlay.find((p) => p.id === ob.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([g.id]);
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === ob.id)).toBe(
      false,
    );
    conserved(s, source, "p2");
  });
});

describe("native Ticket and Parental Guidance actual physical sources", () => {
  it("Ticket preserves the existing deck, removes its actual ID, draws current hand size and readies only Ghost signatures", () => {
    let s = base();
    const source = physical(s),
      ticket = put(s, "27008"),
      george = put(s, "27007"),
      bracelet = put(s, "27009"),
      ally = put(s, "27012"),
      suit = put(s, "27191");
    hand(s, "27002", "27020");
    const existing = s.player.deck.map((p) => p.id),
      acceleration = s.encounter.acceleration;
    s.player.exhausted = true;
    for (const p of s.player.inPlay) p.exhausted = true;
    s = finish(
      command(s, {
        type: "ABILITY",
        id: ticket.id,
        action: "ticket-multiverse",
      }),
    );
    expect(s.removed.filter((p) => p.id === ticket.id)).toHaveLength(1);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.exhausted).toBe(false);
    for (const p of [george, bracelet])
      expect(s.player.inPlay.find((a) => a.id === p.id)?.exhausted).toBe(false);
    for (const p of [ally, suit])
      expect(s.player.inPlay.find((a) => a.id === p.id)?.exhausted).toBe(true);
    expect([...s.player.deck, ...s.player.hand].map((p) => p.id)).toEqual(
      expect.arrayContaining(existing),
    );
    expect(s.player.discard).toEqual([]);
    expect(s.encounter.acceleration).toBe(acceleration);
    conserved(s, source);
  });
  it("Gwen shuffles the actual discarded Ticket once per round without exhausting her identity", () => {
    let s = base();
    const source = physical(s),
      ticket = top(s, "27008");
    s.player.deck.shift();
    s.player.discard.push(ticket);
    s.player.form = "alter";
    s = finish(
      command(s, { type: "ABILITY", id: "hero", action: "gwen-ticket" }),
    );
    expect(s.player.deck.filter((p) => p.id === ticket.id)).toHaveLength(1);
    expect(s.player.exhausted).toBe(false);
    const george = put(s, "27007");
    george.exhausted = true;
    const refused = dispatch(reload(s), {
      type: "ABILITY",
      id: "hero",
      action: "gwen-george",
    });
    expect(refused.error).toMatch(/unavailable|round|used|control/i);
    expect(
      refused.player.inPlay.find((p) => p.id === george.id)?.exhausted,
    ).toBe(true);
    conserved(s, source);
  });
  it("Parental Guidance finds the actual deck George in hand and shuffles without PUTting him", () => {
    let s = base();
    const source = physical(s),
      george = top(s, "27007"),
      [guidance] = hand(s, "27003");
    s.player.form = "alter";
    s = play(s, guidance);
    s = choose(s, george.id);
    s = finish(s);
    expect(s.player.hand.filter((p) => p.id === george.id)).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === george.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === guidance.id)).toHaveLength(
      1,
    );
    conserved(s, source);
  });
  it("Parental Guidance attaches the actual discard event and enforces George's three-event maximum", () => {
    let s = base();
    const source = physical(s),
      george = put(s, "27007"),
      event = top(s, "27004");
    s.player.deck.shift();
    s.player.discard.push(event);
    const [guidance] = hand(s, "27003");
    s.player.form = "alter";
    s = play(s, guidance);
    s = choose(s, event.id);
    s = finish(s);
    const current = s.player.inPlay.find((p) => p.id === george.id)!;
    expect(current.storedCards?.map((p) => p.id)).toEqual([event.id]);
    for (const code of ["27002", "27005"]) {
      const p = top(s, code);
      s.player.deck.shift();
      current.storedCards!.push(p);
    }
    const [replay] = hand(s, "27003");
    expect(replay.id).toBe(guidance.id);
    expect(playable(s, replay)).toMatch(/three|3|hold/i);
    expect(current.storedCards).toHaveLength(3);
    conserved(s, source);
  });
});

describe("native Web Binding activation ownership and absolute Requirement", () => {
  it("p2 Ghost cancels a minion activation against p1 and deals four nonattack damage to that same minion", () => {
    let s = base("p2", true);
    const source = physical(s, "p2"),
      [binding, mental] = hand(s, "27006", "27021"),
      lizard = exactEncounter(s, "27027");
    lizard.engagedWith = "p1";
    s.minions.push(lizard);
    activateSeat(s, "p1");
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: lizard.id });
    s = playResponse(s, binding, [mental]);
    s = finish(s);
    expect(s.minions.find((p) => p.id === lizard.id)?.damage).toBe(4);
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.enemyAttackCounts?.[lizard.id] || 0).toBe(0);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === binding.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === binding.id),
    ).toBe(false);
    conserved(s, source, "p2");
  });
  it("two real Helicarriers reduce Binding to zero but actual Mental spending remains mandatory", () => {
    let s = base("p2", true);
    const carrierOne = put(s, "01092", "p1"),
      carrierTwo = put(s, "01092", "p2"),
      [binding, mental] = hand(s, "27006", "27021");
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    s = command(s, { type: "ABILITY", id: carrierOne.id });
    s = target(s, "p2");
    s = finish(s);
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    s = command(s, { type: "ABILITY", id: carrierTwo.id });
    s = target(s, "p2");
    s = finish(s);
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Web Binding/i, "27006");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    expect(s.prompt?.requirements).toEqual(["mental"]);
    const refused = dispatch(reload(s), { type: "PAY", ids: [] });
    expect(refused.error).toMatch(/mental|requirement/i);
    expect(refused.player.hand.map((p) => p.id)).toEqual(
      s.player.hand.map((p) => p.id),
    );
    s = pay(s, [mental], "mental");
    s = finish(s);
    expect(s.villain.hp).toBe(50);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([binding.id, mental.id]),
    );
  });
});

describe("native Pirouette numeric boost count and exact reveal cancellation", () => {
  it("damages before canceling only Exhaustion's When Revealed while its original Surge deals the next actual card for later reveal", () => {
    let s = base();
    const source = physical(s),
      [pirouette, mental] = hand(s, "27005", "27021"),
      exhaustion = makePiece(s, "01191"),
      mercenary = makePiece(s, "01101");
    s.player.stunned = true;
    s.encounter.deck.unshift(exhaustion, mercenary);
    s = native(s, { type: "revealNext" });
    s = playResponse(s, pirouette, [mental]);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.stunned).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === exhaustion.id),
    ).toHaveLength(1);
    expect(s.encounter.dealt.filter((p) => p.id === mercenary.id)).toHaveLength(
      1,
    );
    s = finish(native(s, { type: "revealDealt" }));
    expect(s.minions.filter((p) => p.id === mercenary.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === pirouette.id)).toHaveLength(
      1,
    );
    conserved(s, source);
  });
  it("counts no star for damage and preserves a revealed minion's entry and later Forced Response", () => {
    let s = base();
    const [pirouette, mental] = hand(s, "27005", "27021"),
      tiger = makePiece(s, "01131");
    s.encounter.deck.unshift(tiger);
    s = native(s, { type: "revealNext" });
    s = playResponse(s, pirouette, [mental]);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.minions.filter((p) => p.id === tiger.id)).toHaveLength(1);
    s = native(s, { type: "enemyAttack", id: tiger.id });
    s = choose(s, "take");
    s = finish(s);
    expect(s.minions.find((p) => p.id === tiger.id)?.tough).toBe(true);
    expect(s.player.discard.filter((p) => p.id === pirouette.id)).toHaveLength(
      1,
    );
  });
});

describe("actual George storage in existing native event timing windows", () => {
  it("stored Skilled Strike resolves and readies Ghost before the pending basic attack deals damage", () => {
    let s = base();
    const source = physical(s),
      george = put(s, "27007"),
      [strike] = hand(s, "09037");
    s = command(s, { type: "ABILITY", id: george.id, action: "george-store" });
    s = choose(s, strike.id);
    expect(paymentSources(s).some((p) => p.id === strike.id)).toBe(false);
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Skilled Strike/i, "09037");
    expect(s.villain.hp).toBe(50);
    expect(s.player.exhausted).toBe(true);
    expect(
      s.prompt?.options.some((o) => /Dizzying Reflexes/i.test(o.label)),
    ).toBe(true);
    s = respond(s, /Dizzying Reflexes/i, "27001a");
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.hp).toBe(46);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(
      s.player.inPlay.find((p) => p.id === george.id)?.storedCards,
    ).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === strike.id)).toHaveLength(1);
    s = finish(basic(s, "attack"));
    expect(s.villain.hp).toBe(44);
    conserved(s, source);
  });
  it("stored Turn the Tide uses the same actual Phantom Flip scheme-thwart response window", () => {
    let s = base();
    const source = physical(s),
      george = put(s, "27007"),
      [tide, flip, energy] = hand(s, "15015", "27004", "27020"),
      scheme = side(s, "01107", 5);
    s = command(s, { type: "ABILITY", id: george.id, action: "george-store" });
    s = choose(s, tide.id);
    expect(paymentSources(s, flip.id).some((p) => p.id === tide.id)).toBe(
      false,
    );
    s = basic(s, "attack");
    s = playResponse(s, flip, [energy]);
    s = target(s, scheme.id);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    s = respond(s, /Turn the Tide/i, "15015");
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(
      s.player.inPlay.find((p) => p.id === george.id)?.storedCards,
    ).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === tide.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === flip.id)).toHaveLength(1);
    conserved(s, source);
  });
});
