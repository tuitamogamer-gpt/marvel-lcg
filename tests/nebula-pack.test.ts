import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { consumeTough, giveStatus, statusCards } from "../src/game/keywords";
import { allInPlay, controller, seatView, syncSeat } from "../src/game/team";
import * as pack from "../src/game/nebula-pack";
import type { Card, Effect, GameState, Piece } from "../src/game/types";

const raw = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "nebula-pack:" + type,
  ...args,
});
const basic = (p: Piece, kind = "attack"): Effect => ({
  type: "allyBasic",
  kind,
  id: p.id,
  source: p.id,
  target: "villain",
});
function fixture(team = false) {
  let s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 22020,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.resolving = [];
  s.scheme.threat = 5;
  s.encounter.deck = [];
  s.encounter.discard = [];
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
  }
  const norm = (state: GameState, id: string) =>
    id === "hero" ? `hero:${state.activePlayerId}` : id;
  const piece = (state: GameState, id: string) =>
    allInPlay(state).find((p) => p.id === id) ||
    state.minions.find((p) => p.id === id);
  const ports: pack.NebulaPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    hasTrait: (state, id, trait) => {
      const target = norm(state, id);
      if (
        trait === "Guardian" &&
        pack.nebulaPackModifiers(state, target, ports).guardian
      )
        return true;
      if (target.startsWith("hero:")) {
        const v = seatView(state, target.slice(5));
        return (
          trait === "Guardian" &&
          (!!v.flags.guardian || ["gam", "nebu"].includes(v.heroId))
        );
      }
      const p = piece(state, target);
      return (
        !!p &&
        ((raw.get(p.code)?.traits || "").split(/\.\s*/).includes(trait) ||
          (trait === "Guardian" && !!state.flags[`guardian:${p.id}`]))
      );
    },
    friendlyTargets: (state) => [
      ...state.players
        .filter((p) => !p.eliminated)
        .map((p) => ({ id: `hero:${p.id}`, label: p.heroId })),
      ...allInPlay(state)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    enemyTargets: (state) => [
      { id: state.villain.id, label: "Rhino" },
      ...state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    canGiveStatus: (state, id, kind) => {
      const p = state.minions.find((p) => p.id === id);
      return !!p && giveStatus({ ...p }, card(p), kind);
    },
    canReady: (state) => !state.flags.cannotReady,
    cardCost: (_state, p) => raw.get(p.code)?.cost || 0,
    canPay: vi.fn(() => true),
    heroThwart: (state) => Number(state.flags.heroThwart ?? 1),
    discardPiece: vi.fn((state, id) => {
      const c = controller(state, id)!;
      const zone = seatView(state, c).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, p.ownerId || c.id).player.discard.push(p);
    }),
    attach: vi.fn((state, id, target) => {
      allInPlay(state).find((p) => p.id === id)!.attachedTo = norm(
        state,
        target,
      );
    }),
    transferControl: vi.fn((state, id, playerId) => {
      const c = controller(state, id)!;
      const zone = seatView(state, c).player.inPlay;
      seatView(state, playerId).player.inPlay.push(
        ...zone.splice(
          zone.findIndex((p) => p.id === id),
          1,
        ),
      );
    }),
    shufflePlayerDeck: vi.fn(),
    shuffleEncounter: vi.fn(),
    revealHidden: vi.fn(),
    revealEncounterFromDeck: vi.fn((state, id, after) => {
      const [p] = state.encounter.deck.splice(
        state.encounter.deck.findIndex((p: Piece) => p.id === id),
        1,
      );
      state.resolving.push(p);
      state.queue.unshift({ type: "nativeReveal", id, after });
    }),
    discardPlayerTop: vi.fn((state, playerId) => {
      const v = seatView(state, playerId),
        p = v.player.deck.shift();
      if (p) v.player.discard.push(p);
      return p;
    }),
    discardEncounterTop: vi.fn((state) => {
      const p = state.encounter.deck.shift();
      if (p) state.encounter.discard.push(p);
      return p;
    }),
    canCancelBoostAbility: vi.fn(
      (state, p) =>
        !!p &&
        state.resolving.some((b: Piece) => b.id === p.id) &&
        /Boost/.test(raw.get(p.code)?.text || "") &&
        !state.flags.uncancelableBoost,
    ),
    cancelBoostAbility: vi.fn((state, id) => {
      state.flags[`canceledBoost:${id}`] = true;
    }),
  };
  const put = (
    code: string,
    zone: "inPlay" | "hand" | "deck" | "discard" = "inPlay",
    playerId = s.activePlayerId,
  ) => {
    const p = makePiece(s, code);
    p.ownerId = playerId;
    seatView(s, playerId).player[zone].push(p);
    return p;
  };
  const encounter = (code: string, zone: "deck" | "discard" = "deck") => {
    const p = makePiece(s, code);
    s.encounter[zone].push(p);
    return p;
  };
  const minion = (code = "01101", playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const run = (e: Effect, state = s) =>
    pack.resolveNebulaPackEffect(state, e, ports);
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    expect(option).toBeDefined();
    s.prompt = null;
    s.queue.unshift(...option.effects);
    return option;
  };
  const drain = () => {
    while (s.queue.length && !s.prompt) {
      const e = s.queue.shift()!;
      if (run(e)) continue;
      if (e.type === "status")
        giveStatus(
          s.minions.find((p) => p.id === e.target)!,
          card(s.minions.find((p) => p.id === e.target)!),
          e.status,
        );
      else if (e.type === "ready") s.player.exhausted = false;
      else if (e.type === "damage") {
        const p = allInPlay(s).find((p) => p.id === e.target)!;
        if (!consumeTough(p)) p.damage += e.amount;
        if (p.damage >= (raw.get(p.code)?.health || 99))
          ports.discardPiece(s, p.id);
      } else throw Error("Fixture cannot drain " + e.type);
    }
  };
  const save = () => {
    syncSeat(s);
    s = JSON.parse(JSON.stringify(s));
    const seat = s.players.find((p) => p.id === s.activePlayerId)!;
    s.player = seat.player;
    s.flags = seat.flags;
    return s;
  };
  return {
    get s() {
      return s;
    },
    ports,
    put,
    minion,
    encounter,
    run,
    choose,
    drain,
    save,
  };
}
const thwart = (
  overrides: Partial<pack.NebulaPackThwartSnapshot> = {},
): pack.NebulaPackThwartSnapshot => ({
  playerId: "p1",
  source: "hero",
  thwart: true,
  basic: true,
  removedAllThreat: true,
  ...overrides,
});

describe("Nebula original supplementary player pool", () => {
  it("covers fourteen dedicated faces and six physically identical Core printings", () => {
    expect(pack.NEBULA_PACK_SCRIPT_CODES).toHaveLength(14);
    expect(pack.NEBULA_PACK_CORE_ALIASES).toHaveLength(6);
    const expected = Array.from({ length: 16 }, (_, i) =>
      String(22011 + i),
    ).concat(["22032", "22033", "22034", "22035"]);
    expect(
      [
        ...pack.NEBULA_PACK_SCRIPT_CODES,
        ...pack.NEBULA_PACK_CORE_ALIASES,
      ].sort(),
    ).toEqual(expected.sort());
    const core = ["01062", "01065", "01086", "01088", "01089", "01090"];
    for (let i = 0; i < core.length; i++)
      for (const field of [
        "name",
        "type_code",
        "cost",
        "faction_code",
        "text",
        "traits",
        "resource_energy",
        "resource_mental",
        "resource_physical",
        "resource_wild",
      ] as const)
        expect(raw.get(pack.NEBULA_PACK_CORE_ALIASES[i])![field]).toEqual(
          raw.get(core[i])![field],
        );
    expect(pack.NEBULA_PACK_SCRIPT_CODES).toContain("22018");
    expect(raw.get("22018")!.name).toBe("Brains Over Brawn");
  });
  it("keeps Determination, Cosmo and Knowhere dedicated physical reprints", () => {
    for (const code of ["22016", "22020", "22021"])
      expect(pack.NEBULA_PACK_SCRIPT_CODES).toContain(code);
    const f = fixture(),
      p = f.put("22020");
    expect(p.code).toBe("22020");
    expect(raw.get(p.code)!.text).toContain(
      "a player deck or the encounter deck",
    );
    expect(pack.NEBULA_PACK_RULES_SOURCE).toContain("v18");
  });
  it("does not claim unrelated cards or foreign effects", () => {
    const f = fixture(),
      p = f.put("01084");
    expect(pack.nebulaPackEvent(f.s, p)).toBeNull();
    expect(pack.nebulaPackAllyEnter(f.s, p, true)).toBeNull();
    expect(pack.nebulaPackAbility(f.s, p.id, f.ports)).toBe(false);
    expect(pack.nebulaPackCardEntered(f.s, p)).toEqual([]);
    expect(f.run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => f.run(P("unknown"))).toThrow(/Unknown Nebula/);
  });
});

describe("Nebula physical attachments and control", () => {
  it("Energy Spear attaches to any player's Guardian ally, not a hero or non-Guardian ally", () => {
    const f = fixture(true),
      guardian = f.put("22020", "inPlay", "p2"),
      other = f.put("01084");
    expect(
      pack.nebulaPackAttachmentTargets(f.s, "22032", f.ports).map((p) => p.id),
    ).toEqual([guardian.id]);
    const spear = f.put("22032");
    f.run(pack.nebulaPackCardEntered(f.s, spear)[0]);
    f.choose(guardian.id);
    f.drain();
    expect(spear).toMatchObject({ ownerId: "p1", attachedTo: guardian.id });
    expect(pack.nebulaPackModifiers(f.s, guardian.id, f.ports)).toMatchObject({
      attack: 2,
      piercing: true,
      health: 0,
    });
    expect(pack.nebulaPackModifiers(f.s, other.id, f.ports).attack).toBe(0);
  });
  it("Honorary Guardian can attach to a teammate hero or ally and changes current HP and traits", () => {
    const f = fixture(true);
    f.s.flags.guardian = true;
    const honorary = f.put("22035"),
      ally = f.put("01084", "inPlay", "p2");
    expect(pack.nebulaPackPlayRestriction(f.s, honorary, f.ports)).toBeNull();
    f.run(pack.nebulaPackCardEntered(f.s, honorary)[0]);
    f.choose("hero:p2");
    f.drain();
    expect(pack.nebulaPackModifiers(f.s, "hero:p2", f.ports)).toMatchObject({
      health: 1,
      guardian: true,
    });
    expect(f.ports.hasTrait(f.s, "hero:p2", "Guardian")).toBe(true);
    expect(pack.nebulaPackModifiers(f.s, ally.id, f.ports).health).toBe(0);
  });
  it("Honorary Guardian requires the playing identity's current Guardian trait in either form", () => {
    const f = fixture(),
      p = f.put("22035", "hand");
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toMatch(/Guardian/);
    f.s.player.form = "alter";
    f.s.flags.guardian = true;
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toBeNull();
  });
  it("canonicalizes the engine's local hero target before attaching and checking the Max limit", () => {
    const f = fixture(),
      honorary = f.put("22035");
    f.ports.friendlyTargets = () => [{ id: "hero", label: "Spider-Man" }];
    expect(
      pack.nebulaPackAttachmentTargets(f.s, "22035", f.ports).map((p) => p.id),
    ).toEqual(["hero:p1"]);
    f.run(pack.nebulaPackCardEntered(f.s, honorary)[0]);
    f.choose("hero:p1");
    f.drain();
    expect(honorary.attachedTo).toBe("hero:p1");
    expect(pack.nebulaPackAttachmentTargets(f.s, "22035", f.ports)).toEqual([]);
    expect(pack.nebulaPackModifiers(f.s, "hero", f.ports).health).toBe(1);
  });
  it.each(["22032", "22035"])(
    "%s keeps its physical Max 1 attachment limit while the first copy is blank",
    (code) => {
      const f = fixture(),
        ally = f.put("22020"),
        first = f.put(code);
      first.attachedTo = ally.id;
      f.s.flags[`blank:${first.id}`] = true;
      expect(
        pack
          .nebulaPackAttachmentTargets(f.s, code, f.ports)
          .some((p) => p.id === ally.id),
      ).toBe(false);
      expect(pack.nebulaPackModifiers(f.s, ally.id, f.ports)).toEqual({
        attack: 0,
        health: 0,
        guardian: false,
        piercing: false,
      });
    },
  );
  it("attachment choices survive JSON reload and reject a departed physical target without attaching", () => {
    const f = fixture(),
      ally = f.put("22020"),
      p = f.put("22032");
    f.run(pack.nebulaPackCardEntered(f.s, p)[0]);
    f.save();
    const effect = f.s.prompt!.options.find((o) => o.id === ally.id)!
      .effects[0];
    f.ports.discardPiece(f.s, ally.id);
    expect(() => f.run(effect)).toThrow(/target/);
    expect(f.ports.attach).not.toHaveBeenCalled();
  });
  it("printed Team limit includes other titled Team supports and survives blanking", () => {
    const f = fixture(true),
      team = f.put("22033");
    const differentTeam = f.put("21015", "inPlay", "p2");
    expect(raw.get(differentTeam.code)!.traits).toContain("Team");
    f.s.flags[`blank:${differentTeam.id}`] = true;
    expect(
      pack.nebulaPackPlayRestriction(f.s, f.put("22033", "hand"), f.ports),
    ).toMatch(/Team/);
    expect(pack.nebulaPackCardEntered(f.s, team)).toHaveLength(1);
  });
  it("Justice Served can transfer control, preserves original owner, and returns to owner discard", () => {
    const f = fixture(true),
      p = f.put("22014");
    f.run(pack.nebulaPackCardEntered(f.s, p)[0]);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    f.choose("p2");
    f.drain();
    expect(controller(f.s, p.id)!.id).toBe("p2");
    expect(p.ownerId).toBe("p1");
    f.ports.discardPiece(f.s, p.id);
    expect(f.s.player.discard).toContain(p);
    expect(seatView(f.s, "p2").player.discard).toHaveLength(0);
  });
  it("Max 1 per player picks the only eligible teammate and rechecks saved choices", () => {
    const f = fixture(true);
    f.put("22014");
    const p = f.put("22014");
    f.run(pack.nebulaPackCardEntered(f.s, p)[0]);
    expect(f.s.prompt).toBeNull();
    expect(controller(f.s, p.id)!.id).toBe("p2");
    const second = fixture(true),
      t = second.put("22033");
    second.run(pack.nebulaPackCardEntered(second.s, t)[0]);
    const choice = second.s.prompt!.options.find((o) => o.id === "p2")!
      .effects[0];
    second.save();
    second.put("22033", "inPlay", "p2");
    expect(() => second.run(choice)).toThrow(/another copy/);
  });
});

describe("Guardian after-play and Team-Up responses", () => {
  it("Knowhere increases only its controller's ally limit in either form, unless blank", () => {
    const f = fixture(true),
      p = f.put("22021");
    f.s.player.form = "alter";
    expect(pack.nebulaPackAllyLimit(f.s, f.ports)).toBe(1);
    expect(pack.nebulaPackAllyLimit(seatView(f.s, "p2"), f.ports)).toBe(0);
    f.s.flags[`blank:${p.id}`] = true;
    expect(pack.nebulaPackAllyLimit(f.s, f.ports)).toBe(0);
  });
  it("Knowhere exhausts its controller's physical support and draws for a different player who PLAYED the ally", () => {
    const f = fixture(true),
      support = f.put("22021"),
      ally = f.put("22020", "inPlay", "p2");
    const response = pack.nebulaPackAllyPlayed(f.s, ally, "p2", f.ports)[0];
    expect(response).toMatchObject({ actorId: "p1", image: "22021" });
    f.run(response.effects[0]);
    expect(support.exhausted).toBe(true);
    expect(f.s.queue[0]).toEqual({ type: "draw", amount: 1, actorId: "p2" });
    expect(pack.nebulaPackAllyPlayed(f.s, ally, "p2", f.ports)).toEqual([]);
  });
  it("Knowhere uses dynamic Guardian traits and does not invent an enter-play response", () => {
    const f = fixture(),
      support = f.put("22021"),
      ally = f.put("01084");
    expect(pack.nebulaPackAllyPlayed(f.s, ally, "p1", f.ports)).toEqual([]);
    f.s.flags[`guardian:${ally.id}`] = true;
    expect(pack.nebulaPackAllyPlayed(f.s, ally, "p1", f.ports)).toHaveLength(1);
    expect(pack.nebulaPackCardEntered(f.s, support)).toEqual([]);
    expect(pack.nebulaPackAllyEnter(f.s, f.put("22020"), false)).toEqual([]);
  });
  it("Guardians of the Galaxy requires every controlled CHARACTER and ignores non-character supports", () => {
    const f = fixture(),
      support = f.put("22033"),
      guardian = f.put("22020"),
      nonGuardian = f.put("01084"),
      upgrade = f.put("22032");
    upgrade.attachedTo = guardian.id;
    f.s.flags.guardian = true;
    f.put("01087");
    expect(pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports)).toEqual(
      [],
    );
    const title = f.put("22035");
    title.attachedTo = nonGuardian.id;
    expect(
      pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports)[0],
    ).toMatchObject({
      image: support.code,
      actorId: "p1",
      effects: [{ type: "draw", amount: 1, actorId: "p1" }],
    });
    f.s.flags[`blank:${title.id}`] = true;
    expect(pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports)).toEqual(
      [],
    );
  });
  it("Guardians support reacts to its controller's upgrade PLAY on a teammate ally, after attachment", () => {
    const f = fixture(true),
      support = f.put("22033"),
      teammate = f.put("22020", "inPlay", "p2"),
      upgrade = f.put("22032");
    f.s.flags.guardian = true;
    expect(pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports)).toEqual(
      [],
    );
    upgrade.attachedTo = teammate.id;
    expect(
      pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports),
    ).toHaveLength(1);
    expect(pack.nebulaPackUpgradePlayed(f.s, upgrade, "p2", f.ports)).toEqual(
      [],
    );
    f.s.flags[`blank:${support.id}`] = true;
    expect(pack.nebulaPackUpgradePlayed(f.s, upgrade, "p1", f.ports)).toEqual(
      [],
    );
  });
  it.each(["hero", "alter"] as const)(
    "Daughters of Thanos accepts a friendly Nebula identity in %s form",
    (form) => {
      const f = fixture(true),
        p = f.put("22022", "hand");
      f.s.heroId = f.s.players[0].heroId = "gam";
      f.s.players[1].heroId = "nebu";
      seatView(f.s, "p2").player.form = form;
      expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toBeNull();
      expect(pack.nebulaPackEvent(f.s, p)).toEqual([
        { type: "draw", amount: 3 },
      ]);
    },
  );
  it("Daughters of Thanos allows friendly named allies but excludes enemy and eliminated identities", () => {
    const f = fixture(true),
      p = f.put("22022", "hand");
    f.s.heroId = f.s.players[0].heroId = "nebu";
    const gamora = f.put("19020");
    expect(raw.get(gamora.code)!.name).toBe("Gamora");
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.ports.discardPiece(f.s, gamora.id);
    f.minion("22028");
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /Gamora and Nebula/,
    );
    f.s.players[1].heroId = "gam";
    f.s.players[1].eliminated = true;
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /Gamora and Nebula/,
    );
  });
});

describe("Eros actual paid resources and separate status choices", () => {
  it("uses the native synthetic Drone definition for saved labels and no-port status eligibility", () => {
    const f = fixture(),
      eros = f.put("22011"),
      drone = f.minion("drone");
    expect(raw.has("drone")).toBe(false);
    expect(card(drone).name).toBe("Ultron Drone");
    const effects = pack.nebulaPackAllyEnter(f.s, eros, true, ["mental"]);
    expect(effects?.[0].effects).toEqual([
      P("eros", { id: eros.id, count: 1 }),
    ]);
    f.run(effects![0].effects[0]);
    expect(f.s.prompt?.options).toEqual([
      expect.objectContaining({
        id: drone.id,
        label: "Ultron Drone",
        image: "drone",
      }),
    ]);
    f.save();
    f.choose(drone.id);
    f.drain();
    expect(f.s.minions.find((p) => p.id === drone.id)?.confused).toBe(true);
    expect(pack.nebulaPackAllyEnter(f.s, eros, true, ["mental"])).toEqual([]);
  });
  it("offers the physical response only after a from-hand play with actual Mental resources", () => {
    const f = fixture(),
      p = f.put("22011");
    f.minion();
    const response = pack.nebulaPackAllyEnter(
      f.s,
      p,
      true,
      ["mental", "mental"],
      f.ports,
    )!;
    expect(response[0]).toMatchObject({
      actorId: "p1",
      image: "22011",
      effects: [{ type: "nebula-pack:eros", id: p.id, count: 2 }],
    });
    expect(
      pack.nebulaPackAllyEnter(f.s, p, false, ["mental"], f.ports),
    ).toEqual([]);
    expect(
      pack.nebulaPackAllyEnter(f.s, p, true, ["energy", "wild"], f.ports),
    ).toEqual([]);
    f.s.flags[`blank:${p.id}`] = true;
    expect(pack.nebulaPackAllyEnter(f.s, p, true, ["mental"], f.ports)).toEqual(
      [],
    );
  });
  it("does not offer an effect that cannot confuse any minion", () => {
    const f = fixture(),
      p = f.put("22011");
    expect(pack.nebulaPackAllyEnter(f.s, p, true, ["mental"], f.ports)).toEqual(
      [],
    );
    const minion = f.minion();
    giveStatus(minion, raw.get(minion.code)!, "confused");
    expect(pack.nebulaPackAllyEnter(f.s, p, true, ["mental"], f.ports)).toEqual(
      [],
    );
  });
  it("lets two separately paid Mental resources choose the same physical Steady minion twice", () => {
    const f = fixture(),
      eros = f.put("22011"),
      steady = f.minion("27122");
    f.run(
      pack.nebulaPackAllyEnter(
        f.s,
        eros,
        true,
        ["mental", "mental"],
        f.ports,
      )![0].effects[0],
    );
    f.choose(steady.id);
    f.drain();
    expect(statusCards(steady, "confused")).toBe(1);
    expect(steady.confused).toBe(false);
    expect(f.s.prompt!.options.some((o) => o.id === steady.id)).toBe(true);
    f.save();
    f.choose(steady.id);
    f.drain();
    const actual = f.s.minions.find((p) => p.id === steady.id)!;
    expect(statusCards(actual, "confused")).toBe(2);
    expect(actual.confused).toBe(true);
    expect(f.s.prompt).toBeNull();
  });
  it("targets minions engaged with another player, excludes an already-confused normal minion", () => {
    const f = fixture(true),
      eros = f.put("22011"),
      a = f.minion("01101"),
      b = f.minion("01101", "p2");
    giveStatus(a, raw.get(a.code)!, "confused");
    f.run(P("eros", { id: eros.id, count: 2 }));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([b.id]);
    f.choose(b.id);
    f.drain();
    expect(b.confused).toBe(true);
    expect(f.s.prompt).toBeNull();
  });
  it("stops if no eligible minion remains and does not invent a target for zero Mental resources", () => {
    const f = fixture(),
      eros = f.put("22011");
    f.run(P("eros", { id: eros.id, count: 3 }));
    expect(f.s.prompt).toBeNull();
    f.minion();
    f.run(P("eros", { id: eros.id, count: 0 }));
    expect(f.s.prompt).toBeNull();
  });
});

describe("Cosmo current errata and saved physical top cards", () => {
  it("names the card type BEFORE choosing a deck and never shows hidden card faces", () => {
    const f = fixture(true),
      cosmo = f.put("22020");
    f.put("01088", "deck");
    f.put("01084", "deck", "p2");
    f.encounter("01104");
    const option = pack.nebulaPackBeforeAllyBasicOptions(
      f.s,
      cosmo,
      basic(cosmo),
      [],
      f.ports,
    )[0];
    f.run(option.effects[0]);
    expect(f.s.prompt!.options.some((o) => o.id === "resource")).toBe(true);
    expect(f.s.prompt!.options.some((o) => o.id === "p1")).toBe(false);
    f.choose("resource");
    f.drain();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([
      "p1",
      "p2",
      "encounter",
    ]);
    expect(f.s.prompt!.options.every((o) => !o.image)).toBe(true);
    expect(f.ports.revealHidden).not.toHaveBeenCalled();
  });
  it("never offers Invocation or any auxiliary deck under RRG1.8p67", () => {
    const f = fixture(),
      cosmo = f.put("22020");
    f.s.player.invocationDeck = [
      makePiece(f.s, "09032"),
      makePiece(f.s, "09033"),
    ];
    f.s.player.setAside = [makePiece(f.s, "09032")];
    expect(
      pack.nebulaPackBeforeAllyBasicOptions(
        f.s,
        cosmo,
        basic(cosmo),
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.put("01088", "deck");
    f.run(
      P("cosmo-deck", {
        id: cosmo.id,
        packet: basic(cosmo),
        named: "resource",
        after: [],
      }),
    );
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["p1"]);
  });
  it("discards a teammate's exact physical top card into that player's discard and delays ONE-use protection", () => {
    const f = fixture(true),
      cosmo = f.put("22020"),
      top = f.put("01088", "deck", "p2"),
      other = f.put("01089", "deck", "p2");
    f.run(
      P("cosmo-deck", {
        id: cosmo.id,
        packet: basic(cosmo),
        named: "resource",
        after: [{ type: "after-marker" }],
      }),
    );
    f.save();
    f.choose("p2");
    f.run(f.s.queue.shift()!);
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([
      top.id,
    ]);
    expect(seatView(f.s, "p2").player.deck.map((p) => p.id)).toEqual([
      other.id,
    ]);
    expect(f.s.queue[0]).toMatchObject({
      target: "villain",
      nebulaPackCosmoHandled: true,
      nebulaPackCosmoSafe: true,
      nebulaPackCosmoId: cosmo.id,
    });
    const receipt = f.s.queue[0];
    expect(
      pack.nebulaPackConsequentialDamage(f.s, cosmo, receipt, 3, f.ports),
    ).toBe(0);
    expect(
      pack.nebulaPackConsequentialDamage(f.s, cosmo, basic(cosmo), 1, f.ports),
    ).toBe(1);
    expect(
      pack.nebulaPackConsequentialDamage(
        f.s,
        f.put("22020"),
        receipt,
        1,
        f.ports,
      ),
    ).toBe(1);
    expect(f.s.queue[1].type).toBe("after-marker");
  });
  it("encounter discard and a wrong prediction leave the actual card in encounter discard without protection", () => {
    const f = fixture(),
      cosmo = f.put("22020"),
      top = f.encounter("01104");
    f.run(
      P("cosmo-discard", {
        id: cosmo.id,
        named: "resource",
        deck: "encounter",
        topId: top.id,
        packet: basic(cosmo),
        after: [],
      }),
    );
    expect(f.s.encounter.discard).toEqual([top]);
    expect(f.s.queue[0].nebulaPackCosmoSafe).toBe(false);
    expect(
      pack.nebulaPackConsequentialDamage(f.s, cosmo, f.s.queue[0], 1, f.ports),
    ).toBe(1);
  });
  it("saved choices reject a changed physical top before discarding or opening any other effects", () => {
    const f = fixture(),
      cosmo = f.put("22020"),
      original = f.put("01088", "deck");
    f.run(
      P("cosmo-deck", {
        id: cosmo.id,
        named: "resource",
        packet: basic(cosmo),
        after: [],
      }),
    );
    f.save();
    const effect = f.s.prompt!.options[0].effects[0];
    f.put("01089", "deck");
    f.s.player.deck.reverse();
    expect(() => f.run(effect)).toThrow(/physical top/);
    expect(f.ports.discardPlayerTop).not.toHaveBeenCalled();
    expect(f.s.player.discard).toHaveLength(0);
    expect(f.s.player.deck.some((p) => p.id === original.id)).toBe(true);
  });
  it("uses the returned physical discarded card even when that discard immediately resets its deck", () => {
    const f = fixture(),
      cosmo = f.put("22020"),
      top = f.put("01088", "deck");
    f.ports.discardPlayerTop = vi.fn((state, playerId) => {
      const v = seatView(state, playerId),
        p = v.player.deck.shift()!;
      v.player.discard.push(p);
      v.player.deck.push(...v.player.discard.splice(0));
      return p;
    });
    f.run(
      P("cosmo-discard", {
        id: cosmo.id,
        named: "resource",
        deck: "p1",
        topId: top.id,
        packet: basic(cosmo),
        after: [],
      }),
    );
    expect(f.s.player.deck.map((p) => p.id)).toEqual([top.id]);
    expect(f.s.player.discard).toHaveLength(0);
    expect(f.s.queue[0].nebulaPackCosmoSafe).toBe(true);
  });
  it.each(["attack", "thwart"])(
    "status-replaced %s and already-handled uses do not open Cosmo",
    (kind) => {
      const f = fixture(),
        cosmo = f.put("22020");
      f.put("01088", "deck");
      if (kind === "attack") cosmo.stunned = true;
      else cosmo.confused = true;
      expect(
        pack.nebulaPackBeforeAllyBasicOptions(
          f.s,
          cosmo,
          basic(cosmo, kind),
          [],
          f.ports,
        ),
      ).toEqual([]);
      cosmo.stunned = cosmo.confused = false;
      expect(
        pack.nebulaPackBeforeAllyBasicOptions(
          f.s,
          cosmo,
          { ...basic(cosmo, kind), nebulaPackCosmoHandled: true },
          [],
          f.ports,
        ),
      ).toEqual([]);
    },
  );
  it("does not open for blank text or an unrelated basic action", () => {
    const f = fixture(),
      cosmo = f.put("22020");
    f.put("01088", "deck");
    expect(
      pack.nebulaPackBeforeAllyBasicOptions(
        f.s,
        cosmo,
        basic(cosmo, "recover"),
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.flags[`blank:${cosmo.id}`] = true;
    expect(
      pack.nebulaPackBeforeAllyBasicOptions(
        f.s,
        cosmo,
        basic(cosmo),
        [],
        f.ports,
      ),
    ).toEqual([]);
  });
  it("completed prediction protection persists if Cosmo's text later becomes blank", () => {
    const f = fixture(),
      cosmo = f.put("22020");
    f.s.flags[`blank:${cosmo.id}`] = true;
    expect(
      pack.nebulaPackConsequentialDamage(
        f.s,
        cosmo,
        {
          ...basic(cosmo),
          nebulaPackCosmoSafe: true,
          nebulaPackCosmoId: cosmo.id,
        },
        2,
        f.ports,
      ),
    ).toBe(0);
  });
});

describe("Venom consequential damage and Determination", () => {
  it("Venom checks current main-scheme threat after a thwart, including all consequential icons", () => {
    const f = fixture(),
      venom = f.put("22013");
    expect(
      pack.nebulaPackConsequentialDamage(f.s, venom, basic(venom), 2, f.ports),
    ).toBe(2);
    f.s.scheme.threat = 0;
    expect(
      pack.nebulaPackConsequentialDamage(f.s, venom, basic(venom), 2, f.ports),
    ).toBe(1);
    expect(
      pack.nebulaPackConsequentialDamage(
        f.s,
        venom,
        basic(venom, "thwart"),
        3,
        f.ports,
      ),
    ).toBe(2);
    expect(
      pack.nebulaPackConsequentialDamage(f.s, venom, basic(venom), 0, f.ports),
    ).toBe(0);
    f.s.flags[`blank:${venom.id}`] = true;
    expect(
      pack.nebulaPackConsequentialDamage(f.s, venom, basic(venom), 2, f.ports),
    ).toBe(2);
  });
  it("Determination is an actual spent Hero resource response, preserving its print and non-thwart origin", () => {
    const f = fixture(),
      determination = f.put("22016", "discard"),
      other = f.put("01089", "discard");
    const effects = pack.nebulaPackResourcesSpent(f.s, [determination, other]);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ image: "22016", actorId: "p1" });
    expect(effects[0].effects[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 1,
      action: false,
    });
    f.s.player.form = "alter";
    expect(pack.nebulaPackResourcesSpent(f.s, [determination])).toEqual([]);
  });
});

describe("One Way or Another physical before-arrow cost", () => {
  it("requires an actual side scheme in encounter DECK, excluding encounter discard and set-aside", () => {
    const f = fixture(),
      event = f.put("22015", "hand"),
      side = f.encounter("01107", "discard");
    expect(raw.get(side.code)!.type_code).toBe("side_scheme");
    f.s.player.setAside = [makePiece(f.s, "01107")];
    expect(pack.nebulaPackPlayRestriction(f.s, event, f.ports)).toMatch(
      /encounter deck/,
    );
    expect(() => f.run(P("one-way-cost", { after: [] }))).toThrow(
      /physical side scheme/,
    );
    f.encounter("01107");
    expect(pack.nebulaPackPlayRestriction(f.s, event, f.ports)).toBeNull();
  });
  it("Max 1 per round is global across seats and is marked on actual play before cancellation", () => {
    const f = fixture(true),
      event = f.put("22015", "hand"),
      side = f.encounter("01107");
    pack.nebulaPackCardPlayed(f.s, event);
    const teammate = seatView(f.s, "p2");
    expect(
      pack.nebulaPackPlayRestriction(
        teammate,
        makePiece(f.s, "22015"),
        f.ports,
      ),
    ).toMatch(/across all players/);
    pack.nebulaPackRoundEnded(f.s);
    expect(pack.nebulaPackPlayRestriction(teammate, event, f.ports)).toBeNull();
    expect(side.id).toBe(f.s.encounter.deck[0].id);
  });
  it("search reveals and queues the selected physical instance before event benefit; shuffle remains after draw", () => {
    const f = fixture(),
      event = f.put("22015", "hand"),
      side = f.encounter("01107");
    f.encounter("01104");
    const benefit = pack.nebulaPackEvent(f.s, event)!;
    f.run(pack.nebulaPackBeforeEvent(f.s, event, benefit)[0]);
    expect(f.ports.revealHidden).toHaveBeenCalledOnce();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([side.id]);
    f.save();
    f.choose(side.id);
    f.run(f.s.queue.shift()!);
    expect(f.s.resolving[0].id).toBe(side.id);
    expect(f.s.queue[0]).toMatchObject({
      type: "nativeReveal",
      id: side.id,
      after: [
        { type: "draw", amount: 3 },
        { type: "nebula-pack:shuffle-encounter" },
      ],
    });
    expect(f.ports.shuffleEncounter).not.toHaveBeenCalled();
    f.run(benefit[1]);
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
  });
  it("canceled reveal still carries its original draw continuation rather than generating another side scheme", () => {
    const f = fixture(),
      event = f.put("22015", "hand"),
      side = f.encounter("01107"),
      after = pack.nebulaPackEvent(f.s, event)!;
    f.run(P("one-way-reveal", { id: side.id, after }));
    const reveal = f.s.queue.shift()!;
    f.s.encounter.discard.push(...f.s.resolving.splice(0));
    f.s.queue.push(...reveal.after);
    expect(f.s.queue[0]).toEqual({ type: "draw", amount: 3 });
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([side.id]);
  });
  it("saved search choices revalidate the exact physical source before mutation", () => {
    const f = fixture(),
      a = f.encounter("01107"),
      b = f.encounter("01107");
    f.run(P("one-way-cost", { after: [] }));
    f.save();
    const effect = f.s.prompt!.options.find((o) => o.id === a.id)!.effects[0];
    f.s.encounter.discard.push(f.s.encounter.deck.shift()!);
    expect(() => f.run(effect)).toThrow(/no longer/);
    expect(f.ports.revealEncounterFromDeck).not.toHaveBeenCalled();
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual([b.id]);
  });
});

describe("Justice Served and Brains Over Brawn actual thwart responses", () => {
  it("last-threat thwart can discard the controlled physical Justice Served and ready the exhausted hero", () => {
    const f = fixture(),
      p = f.put("22014");
    f.s.player.exhausted = true;
    const options = pack.nebulaPackAfterThwartOptions(
      f.s,
      thwart(),
      [],
      f.ports,
    );
    expect(options.map((o) => o.id)).toEqual([p.id]);
    f.run(options[0].effects[0]);
    f.drain();
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.discard).toContain(p);
  });
  it.each([
    { source: "ally" },
    { playerId: "p2" },
    { thwart: false },
    { removedAllThreat: false },
  ])("Justice Served does not respond to %j", (invalid) => {
    const f = fixture();
    f.put("22014");
    f.s.player.exhausted = true;
    expect(
      pack.nebulaPackAfterThwartOptions(f.s, thwart(invalid), [], f.ports),
    ).toEqual([]);
  });
  it("Justice Served is unavailable when readying cannot change the game state or text is blank", () => {
    const f = fixture(),
      p = f.put("22014");
    expect(
      pack.nebulaPackAfterThwartOptions(f.s, thwart(), [], f.ports),
    ).toEqual([]);
    f.s.player.exhausted = true;
    f.s.flags.cannotReady = true;
    expect(
      pack.nebulaPackAfterThwartOptions(f.s, thwart(), [], f.ports),
    ).toEqual([]);
    expect(() => f.run(P("justice-served", { id: p.id }))).toThrow(
      /cannot ready/,
    );
    f.s.flags.cannotReady = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(
      pack.nebulaPackAfterThwartOptions(f.s, thwart(), [], f.ports),
    ).toEqual([]);
  });
  it("Brains Over Brawn uses a payable physical hand event after any BASIC thwart, even without clearing", () => {
    const f = fixture(),
      p = f.put("22018", "hand");
    const option = pack.nebulaPackAfterThwartOptions(
      f.s,
      thwart({ removedAllThreat: false }),
      [{ type: "resume" }],
      f.ports,
    )[0];
    expect(option.id).toBe(p.id);
    expect(pack.nebulaPackPlayRestriction(f.s, p, f.ports)).toMatch(
      /automatically/,
    );
    f.run(option.effects[0]);
    expect(f.s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 2,
      piece: { id: p.id, code: "22018" },
      after: [
        {
          type: "resolveHandEvent",
          id: p.id,
          after: [{ type: "nebula-pack:brains" }],
          continuation: [{ type: "resume" }],
        },
      ],
    });
    f.s.flags.heroThwart = 4;
    f.run(P("brains"));
    expect(f.s.queue[0]).toMatchObject({
      type: "target",
      group: "enemy",
      attack: true,
      action: { type: "damage", amount: 4, attack: true, source: "hero" },
    });
  });
  it("Brains Over Brawn is not offered for event thwart or unavailable payment and rechecks its hand source", () => {
    const f = fixture(),
      p = f.put("22018", "hand");
    expect(
      pack.nebulaPackAfterThwartOptions(
        f.s,
        thwart({ basic: false }),
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.ports.canPay = vi.fn(() => false);
    expect(
      pack.nebulaPackAfterThwartOptions(f.s, thwart(), [], f.ports),
    ).toEqual([]);
    expect(() => f.run(P("brains-pay", { id: p.id, after: [] }))).toThrow(
      /unavailable/,
    );
    f.ports.canPay = vi.fn(() => true);
    f.s.player.hand = [];
    expect(() => f.run(P("brains-pay", { id: p.id, after: [] }))).toThrow(
      /unavailable/,
    );
  });
});

describe("Wraith paid boost interrupts", () => {
  it("queues exhaust and actual dealt-damage cost before ability-only cancellation and the original continuation", () => {
    const f = fixture(),
      wraith = f.put("22012"),
      boost = makePiece(f.s, "01154");
    f.s.resolving.push(boost);
    expect(raw.get(boost.code)!.text).toContain("Boost");
    const option = pack.nebulaPackBoostInterruptOptions(
      f.s,
      boost,
      [{ type: "continueBoost" }],
      f.ports,
    )[0];
    f.run(option.effects[0]);
    expect(wraith.exhausted).toBe(true);
    expect(f.s.queue).toMatchObject([
      { type: "damage", target: wraith.id, amount: 1, cost: true },
      { type: "nebula-pack:wraith-cancel", boostId: boost.id },
      { type: "continueBoost" },
    ]);
    expect(f.ports.cancelBoostAbility).not.toHaveBeenCalled();
    const icons = raw.get(boost.code)!.boost;
    f.run(f.s.queue[1]);
    expect(f.ports.cancelBoostAbility).toHaveBeenCalledWith(f.s, boost.id);
    expect(raw.get(boost.code)!.boost).toBe(icons);
  });
  it("Tough can prevent Wraith's dealt-damage cost and still allows cancellation", () => {
    const f = fixture(),
      wraith = f.put("22012"),
      boost = makePiece(f.s, "01154");
    f.s.resolving.push(boost);
    wraith.tough = true;
    f.run(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports)[0]
        .effects[0],
    );
    f.drain();
    expect(wraith.damage).toBe(0);
    expect(wraith.tough).toBe(false);
    expect(f.ports.cancelBoostAbility).toHaveBeenCalledOnce();
  });
  it("Wraith may be defeated by the paid damage while the already-paid cancellation still resolves", () => {
    const f = fixture(),
      wraith = f.put("22012"),
      boost = makePiece(f.s, "01154");
    f.s.resolving.push(boost);
    wraith.damage = 2;
    f.run(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports)[0]
        .effects[0],
    );
    f.drain();
    expect(f.s.player.discard).toContain(wraith);
    expect(f.ports.cancelBoostAbility).toHaveBeenCalledOnce();
  });
  it("requires Hero form, ready unblanked Wraith and a currently cancelable face-up boost ability", () => {
    const f = fixture(),
      wraith = f.put("22012"),
      boost = makePiece(f.s, "01154");
    f.s.resolving.push(boost);
    f.s.player.form = "alter";
    expect(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports),
    ).toEqual([]);
    f.s.player.form = "hero";
    wraith.exhausted = true;
    expect(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports),
    ).toEqual([]);
    wraith.exhausted = false;
    f.s.flags[`blank:${wraith.id}`] = true;
    expect(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports),
    ).toEqual([]);
    delete f.s.flags[`blank:${wraith.id}`];
    f.s.flags.uncancelableBoost = true;
    expect(
      pack.nebulaPackBoostInterruptOptions(f.s, boost, [], f.ports),
    ).toEqual([]);
    expect(() =>
      f.run(P("wraith", { id: wraith.id, boost, after: [] })),
    ).toThrow(/cannot cancel/);
    expect(wraith.exhausted).toBe(false);
  });
});

describe("Defensive Training physical Uses and atomic costs", () => {
  it("enters with two Uses, targets only exact own Protection event instances, and shuffles the selected event", () => {
    const f = fixture(true),
      training = f.put("22034"),
      event = f.put("01077", "discard"),
      other = f.put("01080", "discard"),
      teammate = f.put("01077", "discard", "p2");
    expect(raw.get(event.code)!.faction_code).toBe("protection");
    expect(raw.get(event.code)!.type_code).toBe("event");
    pack.nebulaPackCardEntered(f.s, training);
    f.s.player.form = "alter";
    expect(training.counters).toBe(2);
    expect(pack.nebulaPackAbility(f.s, training.id, f.ports, "training")).toBe(
      true,
    );
    f.drain();
    expect(f.s.prompt!.options.map((o) => o.id)).toContain(event.id);
    expect(f.s.prompt!.options.map((o) => o.id)).not.toContain(teammate.id);
    f.save();
    f.choose(event.id);
    f.drain();
    const actual = allInPlay(f.s).find((p) => p.id === training.id)!;
    expect(actual).toMatchObject({ counters: 1, exhausted: true });
    expect(f.s.player.deck.map((p) => p.id)).toContain(event.id);
    expect(f.s.player.discard.map((p) => p.id)).toContain(other.id);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("last training counter discards the original support to owner while preserving the event in deck", () => {
    const f = fixture(),
      training = f.put("22034"),
      event = f.put("01077", "discard");
    training.counters = 1;
    f.s.player.form = "alter";
    f.run(P("training-shuffle", { id: training.id, cardId: event.id }));
    expect(f.s.player.inPlay).toHaveLength(0);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([training.id]);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([event.id]);
    expect(event.ownerId).toBe("p1");
  });
  it.each(["form", "exhausted", "counter", "target", "blank"])(
    "revalidates %s before paying any part of a saved Training choice",
    (change) => {
      const f = fixture(),
        training = f.put("22034"),
        event = f.put("01077", "discard");
      training.counters = 2;
      f.s.player.form = "alter";
      f.run(P("training", { id: training.id }));
      f.save();
      const effect = f.s.prompt!.options[0].effects[0],
        actual = f.s.player.inPlay[0];
      if (change === "form") f.s.player.form = "hero";
      if (change === "exhausted") actual.exhausted = true;
      if (change === "counter") actual.counters = 0;
      if (change === "target") f.s.player.discard = [];
      if (change === "blank") f.s.flags[`blank:${training.id}`] = true;
      const before = JSON.stringify({
        counters: actual.counters,
        exhausted: actual.exhausted,
        discard: f.s.player.discard,
        deck: f.s.player.deck,
      });
      expect(() => f.run(effect)).toThrow(/complete cost/);
      expect(
        JSON.stringify({
          counters: actual.counters,
          exhausted: actual.exhausted,
          discard: f.s.player.discard,
          deck: f.s.player.deck,
        }),
      ).toBe(before);
      expect(f.ports.shufflePlayerDeck).not.toHaveBeenCalled();
    },
  );
  it("no eligible target means no action or counter consumption", () => {
    const f = fixture(),
      training = f.put("22034");
    training.counters = 2;
    f.s.player.form = "alter";
    f.put("01088", "discard");
    expect(pack.nebulaPackAbilityOptions(f.s, training.id, f.ports)).toEqual(
      [],
    );
    expect(pack.nebulaPackAbility(f.s, training.id, f.ports)).toBe(false);
    expect(training).toMatchObject({ counters: 2, exhausted: false });
  });
});
