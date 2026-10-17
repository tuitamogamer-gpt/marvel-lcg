import { describe, expect, it } from "vitest";
import { aerial, card, heroCard } from "../src/game/cards.js";
import { captainPackHasTrait } from "../src/game/captain-pack.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type {
  Aspect,
  Command,
  Effect,
  GameState,
  Piece,
} from "../src/game/types.js";

import { command, choose, finish, pay, target } from "./dv-test-helpers.js";

type Located = { zone: string; piece: Piece };
type Expected = {
  id: string;
  type: "ally" | "minion";
  zone: string;
  ownerId?: string;
  trait?: string;
};
function locations(s: GameState): Located[] {
  const result: Located[] = [];
  const visit = (zone: string, pieces: Piece[]) => {
    for (const piece of pieces) {
      result.push({ zone, piece });
      visit(`${zone}:${piece.id}:stored`, piece.storedCards || []);
      visit(`${zone}:${piece.id}:captured`, piece.captured || []);
    }
  };
  for (const seat of s.players) {
    const player = seatView(s, seat).player;
    for (const zone of [
      "hand",
      "deck",
      "discard",
      "inPlay",
      "setAside",
    ] as const)
      visit(`${seat.id}:${zone}`, player[zone] || []);
  }
  for (const zone of [
    "minions",
    "attachments",
    "sideSchemes",
    "resolving",
    "removed",
  ] as const)
    visit(zone, s[zone]);
  visit("environments", s.environments || []);
  for (const zone of ["deck", "discard", "dealt"] as const)
    visit(`encounter:${zone}`, s.encounter[zone]);
  return result;
}
class Fixture {
  s: GameState;
  observed = new Map<string, string>();
  expected?: Expected;
  characterState?: Pick<Piece, "damage" | "counters" | "exhausted">;
  constructor() {
    const seats = [
      { heroId: "phoenix", aspect: "justice" as const, heroCode: "34001a" },
      { heroId: "rogue", aspect: "protection" as const, heroCode: "38001a" },
      { heroId: "storm", aspect: "leadership" as const, heroCode: "36001a" },
    ];
    this.s = newGame({
      heroId: "phoenix",
      aspect: "justice",
      villainId: "rhino",
      modules: ["shadow_king"],
      seed: 3400936038,
      pacing: "expert",
      heroes: seats.map(({ heroId, aspect, heroCode }) => ({
        heroId,
        aspect,
        deckCards: catalogDeckCodes(
          STARTER_DECKS.find((d) => d.id === `starter-${heroCode}`)!,
        ),
      })),
    });
    for (let i = 0; i < seats.length; i++)
      this.step({ type: "MULLIGAN", ids: [] });
    this.finish((s) =>
      s.prompt?.title === "Choose starting weather"
        ? s.prompt.options.find((o) => o.label === "Clear Skies")?.id
        : undefined,
    );
    for (const seat of this.s.players) {
      activateSeat(this.s, seat.id);
      this.s.player.deck.push(...this.s.player.hand, ...this.s.player.discard);
      this.s.player.hand = [];
      this.s.player.discard = [];
      this.s.player.form = "hero";
      this.s.player.exhausted = false;
    }
    activateSeat(this.s, "p1");
    this.s.turnPlayerId = "p1";
  }
  verify(s = this.s) {
    const all = locations(s);
    for (const [id, code] of this.observed) {
      const matches = all.filter((p) => p.piece.id === id);
      expect(
        matches,
        `${code}:${id} exists in exactly one physical zone`,
      ).toHaveLength(1);
      expect(matches[0].piece.code).toBe(code);
    }
    if (this.expected) {
      const want = this.expected;
      const matches = all.filter(({ piece }) => piece.id === want.id);
      expect(matches, `target ${want.id} physical identity`).toHaveLength(1);
      const found = matches[0];
      expect(found.zone, `${want.id} canonical zone`).toBe(want.zone);
      expect(
        card(found.piece).type_code,
        `${want.id} effective card type`,
      ).toBe(want.type);
      expect(found.piece.ownerId, `${want.id} original owner`).toBe(
        want.ownerId,
      );
      if (this.characterState)
        expect(
          found.piece,
          `${want.id} retained character state`,
        ).toMatchObject(this.characterState);
      if (want.trait) {
        expect(card(found.piece).traits).toContain(want.trait);
        expect(card(found.piece).text).toBe("");
      }
    }
  }
  step(command: Command) {
    this.s = dispatch(JSON.parse(JSON.stringify(this.s)) as GameState, command);
    expect(this.s.error, JSON.stringify(this.s.prompt)).toBeUndefined();
    this.verify();
    // A completed command must already be canonical. A later dispatch must not repair it.
    this.s = JSON.parse(JSON.stringify(this.s)) as GameState;
    this.verify();
    for (let n = 0; this.s.review && n < 100; n++) {
      this.s = dispatch(this.s, { type: "PROCEED" });
      expect(this.s.error).toBeUndefined();
      this.verify();
      this.s = JSON.parse(JSON.stringify(this.s)) as GameState;
      this.verify();
    }
  }
  choose(id: string) {
    expect(this.s.prompt?.kind).toBe("choice");
    expect(this.s.prompt?.options.some((o) => o.id === id)).toBe(true);
    this.step({ type: "CHOOSE", id });
  }
  finish(prefer?: (s: GameState) => string | undefined) {
    for (let n = 0; this.s.prompt && n < 50; n++) {
      const options = this.s.prompt.options;
      const id =
        prefer?.(this.s) ||
        options.find((o) => /^(continue|no|skip|none|pass|done)$/.test(o.id))
          ?.id ||
        (options.length === 1 ? options[0].id : undefined);
      expect(id, JSON.stringify(this.s.prompt)).toBeTruthy();
      this.choose(id!);
    }
    expect(this.s.prompt).toBeNull();
  }
  effect(...effects: Effect[]) {
    expect(this.s.prompt).toBeNull();
    this.s.queue = effects;
    this.s.prompt = {
      kind: "choice",
      title: "Original physical control fixture",
      text: "",
      options: [{ id: "run", label: "Resolve", effects: [] }],
    };
    this.choose("run");
  }
  take(code: string, playerId?: string): Piece {
    const zones = playerId
      ? [
          seatView(this.s, playerId).player.deck,
          seatView(this.s, playerId).player.hand,
          seatView(this.s, playerId).player.discard,
          seatView(this.s, playerId).player.setAside || [],
        ]
      : [
          this.s.encounter.deck,
          this.s.encounter.discard,
          this.s.encounter.dealt,
        ];
    const zone = zones.find((pieces) => pieces.some((p) => p.code === code));
    expect(zone, `original physical ${code}`).toBeDefined();
    const piece = zone!.splice(
      zone!.findIndex((p) => p.code === code),
      1,
    )[0];
    this.observed.set(piece.id, piece.code);
    return piece;
  }
  targetAlly(): Piece {
    const ally = this.take("38010", "p2"); // Original Rogue-precon Iceman.
    this.characterState = { damage: 1, counters: 2, exhausted: true };
    Object.assign(ally, this.characterState);
    seatView(this.s, "p2").player.inPlay.push(ally);
    this.expected = {
      id: ally.id,
      type: "ally",
      zone: "p2:inPlay",
      ownerId: "p2",
    };
    this.verify();
    return ally;
  }
  targetMinion(): Piece {
    const minion = this.take("01101"); // Original Rhino-set Hydra Mercenary; SCH 0 ties Karma for Possessed.
    this.characterState = { damage: 1, counters: 2, exhausted: true };
    Object.assign(minion, this.characterState);
    minion.engagedWith = "p2";
    this.s.minions.push(minion);
    this.expected = {
      id: minion.id,
      type: "minion",
      zone: "minions",
      ownerId: minion.ownerId,
    };
    this.verify();
    return minion;
  }
  mindControl(target: Piece): Piece {
    activateSeat(this.s, "p1");
    this.s.turnPlayerId = "p1";
    const mind = this.take("34009", "p1");
    const energy = this.take("34025", "p1"),
      genius = this.take("34026", "p1");
    this.s.player.hand.push(mind, energy, genius);
    this.step({ type: "PLAY", id: mind.id });
    this.choose(target.id);
    expect(this.s.prompt?.kind).toBe("payment");
    this.expected = {
      id: target.id,
      type: "ally",
      zone: "p1:inPlay",
      ownerId: target.ownerId,
      trait: "Controlled",
    };
    this.step({ type: "PAY", ids: [energy.id, genius.id] });
    this.finish();
    return mind;
  }
  convert(target: Piece): Piece {
    const attachment = this.take("36038");
    // While the When Revealed choice is pending the previous treatment remains active.
    this.effect({ type: "reveal", piece: attachment });
    this.expected = {
      id: target.id,
      type: "minion",
      zone: "minions",
      ownerId: target.ownerId,
      trait: "Controlled",
    };
    this.choose(target.id);
    this.finish();
    return attachment;
  }
  karma(target: Piece): Piece {
    activateSeat(this.s, "p2");
    this.s.turnPlayerId = "p2";
    const karma = this.take("38011", "p2");
    const energy = this.take("38021", "p2"),
      genius = this.take("38022", "p2");
    this.s.player.hand.push(karma, energy, genius);
    this.step({ type: "PLAY", id: karma.id });
    expect(this.s.prompt?.kind).toBe("payment");
    this.step({ type: "PAY", ids: [energy.id, genius.id] });
    this.finish((s) => {
      const response = s.prompt?.options.find((o) => /Karma/.test(o.label));
      if (response) return response.id;
      if (s.prompt?.title.includes("Karma")) {
        if (s.prompt.options.some((o) => o.id === "yes")) return "yes";
        if (s.prompt.options.some((o) => o.id === target.id)) {
          this.expected = allyAt(target, "p2", true);
          return target.id;
        }
      }
      return undefined;
    });
    expect(
      this.s.players[1].player.inPlay.some((p) => p.id === target.id),
    ).toBe(true);
    expect(
      card(this.s.players[1].player.inPlay.find((p) => p.id === target.id)!),
    ).toMatchObject({ attack_cost: 2, thwart_cost: 2 });
    return karma;
  }
  discard(attachment: Piece, expected: Expected) {
    this.expected = expected;
    this.effect({ type: "discardPiece", id: attachment.id });
    this.finish();
  }
}

const allyAt = (p: Piece, seat: string, controlled = false): Expected => ({
  id: p.id,
  type: "ally",
  zone: `${seat}:inPlay`,
  ownerId: p.ownerId,
  ...(controlled ? { trait: "Controlled" } : {}),
});
const enemy = (p: Piece, trait?: string): Expected => ({
  id: p.id,
  type: "minion",
  zone: "minions",
  ownerId: p.ownerId,
  ...(trait ? { trait } : {}),
});

describe("four-pack control integration with earlier packs", () => {
  it("Karma, Possessed and Mind Control restore the newest surviving treatment after JSON reload", () => {
    const f = new Fixture(),
      target = f.targetMinion();
    const karma = f.karma(target),
      possessed = f.convert(target),
      mind = f.mindControl(target);
    f.discard(mind, enemy(target, "Controlled"));
    f.discard(possessed, allyAt(target, "p2", true));
    f.discard(karma, enemy(target));
  });
  it("removing older Karma leaves newer Mind Control active until its own attachment leaves", () => {
    const f = new Fixture(),
      target = f.targetMinion();
    const karma = f.karma(target),
      possessed = f.convert(target),
      mind = f.mindControl(target);
    f.discard(karma, allyAt(target, "p1", true));
    f.discard(possessed, allyAt(target, "p1", true));
    f.discard(mind, enemy(target));
  });
  it("a physical player ally keeps its original owner through Possessed and Karma", () => {
    const f = new Fixture(),
      target = f.targetAlly();
    const possessed = f.convert(target),
      karma = f.karma(target);
    f.discard(karma, enemy(target, "Controlled"));
    f.discard(possessed, allyAt(target, "p2"));
  });
});

function teamFixture(specs: [string, Aspect, string][]) {
  let s = newGame({
    heroId: specs[0][0],
    aspect: specs[0][1],
    villainId: "rhino",
    seed: 374142,
    pacing: "expert",
    heroes: specs.map(([heroId, aspect, heroCode]) => ({
      heroId,
      aspect,
      deckCards: catalogDeckCodes(
        STARTER_DECKS.find((d) => d.id === `starter-${heroCode}`)!,
      ),
    })),
  });
  for (const _ of specs) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    s.player.deck.push(...s.player.hand, ...s.player.discard);
    s.player.hand = [];
    s.player.discard = [];
    s.player.form = "hero";
    s.player.exhausted = true;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 12;
  return s;
}
function takeSource(
  s: GameState,
  code: string,
  zone: "hand" | "discard" = "hand",
) {
  const i = s.player.deck.findIndex((p) => p.code === code);
  expect(i, `original source ${code}`).toBeGreaterThanOrEqual(0);
  const p = s.player.deck.splice(i, 1)[0];
  s.player[zone].push(p);
  return p;
}
function conserved(s: GameState, ids: string[]) {
  const saved = JSON.parse(JSON.stringify(s)) as GameState;
  for (const id of ids)
    expect(
      locations(saved).filter((p) => p.piece.id === id),
      id,
    ).toHaveLength(1);
}

describe("four-pack shared Team-Up printings dispatch once", () => {
  it.each(["37019", "38020"])(
    "Beauty and the Thief %s resolves one attack and one thwart",
    (code) => {
      let s = teamFixture([
        ["gambit", "justice", "37001a"],
        ["rogue", "protection", "38001a"],
      ]);
      const owner = code === "37019" ? "p1" : "p2";
      activateSeat(s, owner);
      s.turnPlayerId = owner;
      const event = takeSource(s, code),
        resource = takeSource(s, code === "37019" ? "37022" : "38021");
      s = command(s, { type: "PLAY", id: event.id });
      s = pay(s, [resource]);
      s = target(s, s.villain.id);
      s = finish(target(s, "main"));
      expect(s.villain.hp).toBe(46);
      expect(s.scheme.threat).toBe(8);
      expect(
        seatView(s, owner).player.discard.filter((p) => p.id === event.id),
      ).toHaveLength(1);
      conserved(s, [event.id, resource.id]);
    },
  );
  it.each(["41020", "42021"])(
    "Soaring Hearts %s retrieves one physical event and readies both seats",
    (code) => {
      let s = teamFixture([
        ["psylocke", "justice", "41001a"],
        ["angel", "protection", "42001a"],
      ]);
      const owner = code === "41020" ? "p1" : "p2";
      activateSeat(s, owner);
      s.turnPlayerId = owner;
      const event = takeSource(s, code),
        retrieved = takeSource(
          s,
          code === "41020" ? "41005" : "42005",
          "discard",
        );
      const paymentCode = code === "41020" ? "41024" : "42023";
      const payments = [takeSource(s, paymentCode), takeSource(s, paymentCode)];
      s = command(s, { type: "PLAY", id: event.id });
      s = pay(s, payments);
      s = finish(choose(s, retrieved.id));
      for (const seat of s.players)
        expect(seatView(s, seat).player.exhausted).toBe(false);
      expect(seatView(s, owner).player.hand.map((p) => p.id)).toEqual([
        retrieved.id,
      ]);
      expect(
        seatView(s, owner).player.discard.filter((p) => p.id === event.id),
      ).toHaveLength(1);
      conserved(s, [event.id, retrieved.id, ...payments.map((p) => p.id)]);
    },
  );
});

describe("Rogue lasting traits across Angel's three physical faces", () => {
  it("follows the original hero's actual form after Touched moves, including Aerial and Mutant consumers", () => {
    let s = teamFixture([
      ["rogue", "protection", "38001a"],
      ["angel", "protection", "42001a"],
    ]);
    const moira = takeSource(s, "38018"),
      moiraResource = takeSource(s, "38021");
    const touched = locations(s).find(
      ({ piece }) => piece.code === "38002",
    )!.piece;
    s = command(s, { type: "ABILITY", id: "hero", action: "skin-contact" });
    s = finish(choose(s, "hero:p2"));
    expect(aerial(s)).toBe(true);
    expect(captainPackHasTrait(s, "hero", "X-Force")).toBe(true);
    expect(playable(s, moira)).toContain("Mutant");

    const transfer = takeSource(s, "38007"),
      transferResource = takeSource(s, "38022");
    s = command(s, { type: "PLAY", id: transfer.id });
    s = pay(s, [transferResource]);
    s = finish(target(s, s.villain.id));
    expect(
      locations(s).find(({ piece }) => piece.id === touched.id)?.piece
        .attachedTo,
    ).toBe(s.villain.id);
    expect(aerial(s)).toBe(true);

    const used: Piece[] = [];
    for (const form of ["archangel", "alter"] as const) {
      activateSeat(s, "p2");
      s.turnPlayerId = "p2";
      const metamorphosis = takeSource(s, "42005"),
        resource = takeSource(s, "42022");
      used.push(metamorphosis, resource);
      s = command(s, { type: "PLAY", id: metamorphosis.id });
      s = pay(s, [resource]);
      s = choose(s, form);
      s = finish(form === "archangel" ? target(s, s.villain.id) : s);
      expect(heroCard(seatView(s, "p2")).code).toBe(
        form === "archangel" ? "42001c" : "42001b",
      );
      activateSeat(s, "p1");
      s.turnPlayerId = "p1";
      const saved = JSON.parse(JSON.stringify(s)) as GameState;
      expect(aerial(saved)).toBe(form === "archangel");
      expect(captainPackHasTrait(saved, "hero", "X-Force")).toBe(
        form === "archangel",
      );
      expect(captainPackHasTrait(saved, "hero", "Mutant")).toBe(
        form === "alter",
      );
      if (form === "alter") expect(playable(saved, moira)).toBeNull();
      else expect(playable(saved, moira)).toContain("Mutant");
    }
    conserved(s, [
      touched.id,
      moira.id,
      moiraResource.id,
      transfer.id,
      transferResource.id,
      ...used.map((p) => p.id),
    ]);
  });
});
