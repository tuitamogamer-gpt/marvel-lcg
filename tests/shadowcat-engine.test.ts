import { describe, expect, it } from "vitest";
import { deckCodes, heroCard } from "../src/game/cards.js";
import {
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { shadowcatMassForm } from "../src/game/shadowcat.js";
import type { GameState } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  encounterConserved,
  finish,
  hand,
  minion,
  native,
  pay,
  physical,
  play,
  put,
  respond,
  side,
  target,
  until,
} from "./dv-test-helpers.js";

function start(heroId = "shadowcat") {
  return newGame({
    heroId,
    aspect: heroId === "shadowcat" ? "aggression" : "protection",
    villainId: "rhino",
    seed: 32030,
    pacing: "expert",
  });
}
function base(heroId = "shadowcat") {
  let s = finish(command(start(heroId), { type: "MULLIGAN", ids: [] }), (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  const original = physical(s),
    mass = original.find((p) => ["32031a", "32031b"].includes(p.code));
  s.player.deck = original.filter((p) => p.id !== mass?.id);
  s.player.hand = [];
  s.player.inPlay = mass ? [mass] : [];
  s.player.discard = [];
  s.player.form = "hero";
  s.player.flipped = false;
  s.player.exhausted = false;
  s.player.stunned = s.player.confused = s.player.tough = false;
  s.player.stunCards = s.player.confuseCards = s.player.toughCards = 0;
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  s.encounter.deck = Array.from({ length: 25 }, () => makePiece(s, "01186"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  return s;
}
const mass = (s: GameState) =>
  s.player.inPlay.find((p) => ["32031a", "32031b"].includes(p.code))!;
function phase(s: GameState) {
  mass(s).code = "32031b";
}
function attack(s: GameState) {
  return native(s, { type: "enemyAttack", id: s.villain.id });
}

describe("Shadowcat actual native commands with JSON saves", () => {
  it("opens with six cards and one physical Permanent outside original40 before mulligan", () => {
    const s = start(),
      reserve = s.player.setAside || [];
    expect(heroCard(s).code).toBe("32030b");
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.hand.length + s.player.deck.length).toBe(40);
    expect(reserve.filter((p) => p.code === "32031a")).toHaveLength(1);
    expect(
      reserve.filter((p) =>
        ["32056", "32057", "32058", "32059"].includes(p.code),
      ),
    ).toHaveLength(5);
    expect(deckCodes("shadowcat", "aggression")).toHaveLength(41);
  });
  it("setup puts that same Permanent Solid faceup after mulligan", () => {
    let s = start();
    const p = s.player.setAside!.find((p) => p.code === "32031a")!;
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    expect(mass(s)).toMatchObject({ id: p.id, code: "32031a", ownerId: "p1" });
    expect(physical(s)).toHaveLength(41);
  });
  it("Phase Control is once-round native AE Action and retains physical exhaustion plus identity budget", () => {
    let s = base();
    s.player.form = "alter";
    s.player.flipped = true;
    mass(s).exhausted = true;
    const id = mass(s).id;
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "phase-control" }),
    );
    expect(mass(s)).toMatchObject({ id, code: "32031b", exhausted: true });
    expect(s.player.exhausted).toBe(false);
    expect(s.player.flipped).toBe(true);
    expect(
      nativeHeroAbilityOptions(s).some((o) => o.id === "phase-control"),
    ).toBe(false);
  });
  it("Solid's optional native basic attack flip can be declined", () => {
    let s = base();
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    expect(s.villain.hp).toBe(48);
    expect(shadowcatMassForm(s)).toBe("solid");
  });
  it("Solid's optional native basic attack flip can be accepted exactly once", () => {
    let s = base();
    const id = mass(s).id;
    s = respond(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
      /Solid.*flip/,
    );
    s = finish(s);
    expect(mass(s)).toMatchObject({ id, code: "32031b" });
  });
  it("Phased's native basic attack forces Solid before optional response choice", () => {
    let s = base();
    phase(s);
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    expect(s.villain.hp).toBe(48);
    expect(shadowcatMassForm(s)).toBe("solid");
  });
  it("paid Surprise deals three, readies, and offers one Solid completion", () => {
    let s = base();
    s.player.exhausted = true;
    const p = hand(s, "32037", "01088");
    s = play(s, p[0], [p[1]]);
    s = target(s, s.villain.id);
    s = respond(s, /Solid.*flip/);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.exhausted).toBe(false);
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.discard.some((q) => q.id === p[0].id)).toBe(true);
  });
  it("real Solid Physical resource pays Attack and retains exhaustion after its optional flip", () => {
    let s = base();
    const p = hand(s, "32037", "01091");
    const id = mass(s).id;
    expect(
      paymentSources(s, p[0].id, p[0].code).some((source) => source.id === id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "32039").some((source) => source.id === id),
    ).toBe(false);
    s = command(s, { type: "PLAY", id: p[0].id });
    s = pay(s, [p[1]], undefined, [id]);
    s = target(s, s.villain.id);
    s = finish(respond(s, /Solid.*flip/));
    expect(mass(s)).toMatchObject({ id, code: "32031b", exhausted: true });
  });
  it("Acute Control response uses exact Guard source before the villain attack resolves", () => {
    let s = base();
    phase(s);
    const pawn = minion(s, "32058"),
      upgrade = put(s, "32034");
    s = target(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "32034"));
    expect(s.villain.hp).toBe(50);
    expect(
      s.prompt!.options.find((o) => o.image === "32034")!.effects[0].target,
    ).toBe(pawn.id);
    s = finish(respond(s, /Acute Control/, "32034"));
    expect(s.villain.hp).toBe(48);
    expect(s.minions.find((p) => p.id === pawn.id)!.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)!.exhausted).toBe(
      true,
    );
    expect(shadowcatMassForm(s)).toBe("solid");
  });
  it("Patrol and Crisis are captured separately before Phased basic main-scheme thwart", () => {
    let s = base();
    phase(s);
    const pawn = minion(s, "32058"),
      crisis = side(s, "01125", 4);
    put(s, "32034");
    put(s, "32035");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = until(s, (v) => v.prompt?.title === "Shadowcat · ignored restrictions");
    expect(s.scheme.threat).toBe(8);
    expect(s.prompt!.options.filter((o) => o.image === "32034")).toHaveLength(
      1,
    );
    expect(s.prompt!.options.filter((o) => o.image === "32035")).toHaveLength(
      1,
    );
    s = respond(s, /Intangible Interference/, "32035");
    s = finish(respond(s, /Acute Control/, "32034"));
    expect(s.scheme.threat).toBe(6);
    expect(s.sideSchemes.find((p) => p.id === crisis.id)!.counters).toBe(2);
    expect(s.minions.find((p) => p.id === pawn.id)!.damage).toBe(2);
    expect(shadowcatMassForm(s)).toBe("phased");
  });
  it("attacking a minion does not invent a Guard-ignored response", () => {
    let s = base();
    phase(s);
    const pawn = minion(s, "32058");
    put(s, "32034");
    s = target(command(s, { type: "BASIC", action: "attack" }), pawn.id);
    expect(s.prompt?.options.some((o) => o.image === "32034")).not.toBe(true);
    s = finish(s);
    expect(s.minions.find((p) => p.id === pawn.id)!.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.code === "32034")!.exhausted).toBe(
      false,
    );
  });
  it("ordinary allies do not inherit Phased identity target permissions", () => {
    let s = base();
    phase(s);
    minion(s, "32058");
    side(s, "01125", 3);
    minion(s, "32058");
    const ally = put(s, "32032");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt!.options.some((o) => o.id === s.villain.id)).toBe(false);
  });
  it.each(["attack", "thwart"] as const)(
    "printed Shadowcat ally bypasses her own Guard/Patrol/Crisis on native %s",
    (kind) => {
      let s = base("colossus");
      minion(s, "32058");
      side(s, "01125", 4);
      const ally = put(s, "32002");
      s = target(
        command(s, { type: "ABILITY", id: ally.id, action: kind }),
        kind === "attack" ? s.villain.id : "main",
      );
      s = finish(s);
      expect(kind === "attack" ? s.villain.hp : s.scheme.threat).toBe(
        kind === "attack" ? 48 : 6,
      );
      expect(s.player.inPlay.find((p) => p.id === ally.id)!.damage).toBe(1);
    },
  );
  it("Quick Shift declares event defense before effects and prevents native incoming attack damage", () => {
    let s = base();
    const p = hand(s, "32040")[0],
      hp = s.player.hp;
    s = respond(attack(s), /Quick Shift/, "32040");
    s = pay(s);
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(shadowcatMassForm(s)).toBe("solid");
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Phased native basic defense prevents boost damage before attack completion", () => {
    let s = base();
    phase(s);
    const boost = makePiece(s, "01098");
    s.encounter.deck.unshift(boost);
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero"),
    );
    s = finish(choose(s, "hero"));
    expect(s.player.hp).toBe(hp);
    expect(shadowcatMassForm(s)).toBe("solid");
  });
  it("Phased Strike native attachment choice occurs before its forced flip", () => {
    let s = base();
    phase(s);
    const attachment = attach(s, "01100", s.villain.id);
    const p = hand(s, "32038", "01088", "01091");
    s = target(play(s, p[0], p.slice(1)), s.villain.id);
    s = until(
      s,
      (v) => !!v.prompt?.options.some((o) => o.id === attachment.id),
    );
    expect(shadowcatMassForm(s)).toBe("phased");
    s = finish(choose(s, attachment.id));
    expect(s.attachments).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.id === attachment.id)).toBe(true);
    expect(shadowcatMassForm(s)).toBe("solid");
  });
  it("Phased Lockheed non-thwart removal ignores Crisis even in alter ego", () => {
    let s = base();
    phase(s);
    s.player.form = "alter";
    side(s, "01125", 3);
    const p = hand(s, "32032", "01088");
    s = play(s, p[0], [p[1]]);
    s = respond(s, /Lockheed/);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(6);
  });
  it("obligation locks actual actions until Kitty exhausts to remove actual card", () => {
    let s = base();
    const ob = makePiece(s, "32055");
    s = finish(native(s, { type: "reveal", piece: ob }));
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.inPlay.some((p) => p.id === ob.id)).toBe(true);
    const attackCard = hand(s, "32037", "01088")[0];
    expect(playable(s, attackCard)).toMatch(
      /prevents attacking|cannot attack/i,
    );
    s = finish(command(s, { type: "FLIP" }));
    s = finish(command(s, { type: "ABILITY", id: ob.id, action: "remove" }));
    expect(s.player.inPlay.some((p) => p.id === ob.id)).toBe(false);
    expect(s.removed.some((p) => p.id === ob.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
  });
  it("Shadows reveals original Queen/Club and shuffles original two Pawns/Restraint IDs", () => {
    let s = base();
    const pieces = [...s.player.setAside!],
      queen = pieces.find((p) => p.code === "32056")!,
      club = pieces.find((p) => p.code === "32057")!;
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.minions.find((p) => p.id === queen.id)).toBeTruthy();
    expect(s.sideSchemes.find((p) => p.id === club.id)).toBeTruthy();
    expect(s.player.setAside).toEqual([]);
    for (const p of pieces.filter((p) => ["32058", "32059"].includes(p.code)))
      expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    encounterConserved(s, pieces);
  });
});

describe("Shadowcat native encounter physical conservation", () => {
  it("Hellfire Club's defeat PUTs one actual set-aside Pawn without resolving Surge", () => {
    let s = base();
    const zone = s.player.setAside!,
      clubIndex = zone.findIndex((p) => p.code === "32057");
    const club = zone.splice(clubIndex, 1)[0],
      pawn = zone.find((p) => p.code === "32058")!;
    club.counters = 1;
    s.sideSchemes.push(club);
    const original = [club, ...zone];
    s = target(command(s, { type: "BASIC", action: "thwart" }), club.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === pawn.id));
    s = finish(choose(s, pawn.id));
    expect(s.minions.find((p) => p.id === pawn.id)).toMatchObject({
      code: "32058",
      engagedWith: "p1",
    });
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.sideSchemes).toHaveLength(0);
    encounterConserved(s, original);
  });
  it("Pawn boost enters as that same physical ID and avoids later boost discard", () => {
    let s = base();
    const zone = s.player.setAside!,
      i = zone.findIndex((p) => p.code === "32058"),
      pawn = zone.splice(i, 1)[0];
    s.encounter.deck.unshift(pawn);
    s = finish(attack(s));
    expect(s.minions.find((p) => p.id === pawn.id)).toMatchObject({
      engagedWith: "p1",
    });
    expect(s.encounter.discard.some((p) => p.id === pawn.id)).toBe(false);
    expect(s.resolving.some((p) => p.id === pawn.id)).toBe(false);
    expect(s.encounter.dealt).toHaveLength(0);
    encounterConserved(s, [pawn]);
  });
  it("blanking the printed Shadowcat ally restores ordinary Guard targeting", () => {
    let s = base("colossus");
    minion(s, "32058");
    minion(s, "32058");
    const ally = put(s, "32002");
    s.flags[`novaIronheartPackBlank:${ally.id}`] = s.round;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(false);
    expect(s.villain.hp).toBe(50);
  });
});
