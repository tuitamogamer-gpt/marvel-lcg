import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import { dispatch, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

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
      { heroId: "storm", aspect: "leadership" as const, heroCode: "36001a" },
      { heroId: "valk", aspect: "aggression" as const, heroCode: "25001a" },
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
    const ally = this.take("36022", "p2"); // Original Storm-precon Forge.
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
    const minion = this.take("01103"); // Original Rhino-set Shocker, a non-Elite minion.
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
  convert(target: Piece, code: "36038" | "25031"): Piece {
    const attachment = this.take(code, code === "25031" ? "p3" : undefined);
    // While the When Revealed choice is pending the previous treatment remains active.
    this.effect({ type: "reveal", piece: attachment });
    this.expected = {
      id: target.id,
      type: "minion",
      zone: "minions",
      ownerId: target.ownerId,
      trait: code === "36038" ? "Controlled" : "Enthralled",
    };
    this.choose(target.id);
    this.finish();
    return attachment;
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

describe("latest physical control attachment integration", () => {
  it("Mind Control then Possessed: removing Possessed immediately restores the same controlled ally", () => {
    const f = new Fixture(),
      minion = f.targetMinion();
    const mind = f.mindControl(minion),
      possessed = f.convert(minion, "36038");
    f.discard(possessed, allyAt(minion, "p1", true));
    f.discard(mind, enemy(minion));
  });

  it("Mind Control then Possessed: removing Mind Control first preserves the Controlled minion, then its original type", () => {
    const f = new Fixture(),
      minion = f.targetMinion();
    const mind = f.mindControl(minion),
      possessed = f.convert(minion, "36038");
    f.discard(mind, enemy(minion, "Controlled"));
    f.discard(possessed, enemy(minion));
  });

  it.each(["36038", "25031"] as const)(
    "%s then Mind Control: the newest physical attachment wins despite older allocation",
    (code) => {
      const f = new Fixture(),
        ally = f.targetAlly();
      const first = f.convert(ally, code),
        mind = f.mindControl(ally);
      f.discard(
        mind,
        enemy(ally, code === "36038" ? "Controlled" : "Enthralled"),
      );
      f.discard(first, allyAt(ally, "p2"));
    },
  );

  it.each(["36038", "25031"] as const)(
    "%s then Mind Control: removing the older attachment does not override active control or lose the original controller",
    (code) => {
      const f = new Fixture(),
        ally = f.targetAlly();
      const first = f.convert(ally, code),
        mind = f.mindControl(ally);
      f.discard(first, allyAt(ally, "p1", true));
      f.discard(mind, allyAt(ally, "p2"));
    },
  );

  it("Possessed, Mind Control and Beguiled resolve the latest active treatment after each attachment leaves", () => {
    const f = new Fixture(),
      ally = f.targetAlly();
    const possessed = f.convert(ally, "36038"),
      mind = f.mindControl(ally),
      beguiled = f.convert(ally, "25031");
    f.discard(beguiled, allyAt(ally, "p1", true));
    f.discard(mind, enemy(ally, "Controlled"));
    f.discard(possessed, allyAt(ally, "p2"));
  });
});
